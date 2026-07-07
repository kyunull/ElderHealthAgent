# L2 API 详细设计：web-frontend

> L2 Backend Designer — API 详设（入参验证/业务逻辑/出参构造/错误码映射）

## 端点清单

| # | 方法 | 路径 | 模块 |
|---|------|------|------|
| 1 | POST | /api/auth/register | Auth |
| 2 | POST | /api/auth/login | Auth |
| 3 | GET | /api/auth/me | Auth |
| 4 | POST | /api/reports/upload | Reports |
| 5 | GET | /api/reports | Reports |
| 6 | GET | /api/reports/:id | Reports |
| 7 | PUT | /api/reports/:id | Reports |
| 8 | DELETE | /api/reports/:id | Reports |
| 9 | GET | /api/medications | Medications |
| 10 | POST | /api/medications | Medications |
| 11 | PUT | /api/medications/:id | Medications |
| 12 | POST | /api/medications/interactions/check | Medications |
| 13 | POST | /api/consultations/specialist | Consultations |
| 14 | POST | /api/consultations/mdt | Consultations |
| 15 | GET | /api/consultations | Consultations |
| 16 | GET | /api/trends/:code | Trends |
| 17 | GET/POST | /api/cga-assessments | CGA |
| 18 | GET/PUT | /api/cga-assessments/:id | CGA |
| 19 | POST | /api/cga-assessments/:id/analyze | CGA |
| 20 | GET/POST | /api/cognitive-screenings | Cognitive |
| 21 | GET/PUT | /api/cognitive-screenings/:id | Cognitive |
| 22 | POST | /api/cognitive-screenings/:id/analyze | Cognitive |
| 23 | GET | /api/cognitive-screenings/trend | Cognitive |
| 24 | GET/PUT | /api/profile | Profile |
| 25 | GET/POST | /api/profile/allergies | Profile |
| 26 | PUT/DELETE | /api/profile/allergies/:id | Profile |
| 27 | PUT | /api/settings/api-key | Settings |
| 28 | POST | /api/settings/api-key/verify | Settings |

---

## 端点详细设计

### 1. POST /api/auth/register

**入参验证**：
```
username:
  - required, string, 3-50 chars, regex: /^[a-zA-Z0-9_]+$/
  - 去首尾空格
  - 数据库查询唯一性（409 CONFLICT if exists）
display_name:
  - required, string, 1-100 chars, trim
password:
  - required, string, min 6 chars
  - 不记录明文日志
```

**业务逻辑**：
1. 校验 username 唯一性 → 409 if duplicate
2. bcrypt.hash(password, 12 rounds) → password_hash
3. INSERT INTO users → 返回 User 对象（不含 password_hash）
4. 生成 JWT token: `{ userId, username, role }, expiresIn: '24h'`
5. 返回 `{ token, user: {...} }`

**错误码**：409 CONFLICT (username exists), 400 VALIDATION_ERROR

### 2. POST /api/auth/login

**入参验证**：username/ password required, trim

**业务逻辑**：
1. SELECT * FROM users WHERE username = ?
2. 用户不存在 → 401 (不提示"用户名不存在"，防止枚举)
3. bcrypt.compare(password, user.password_hash)
4. 不匹配 → 401 (统一提示"用户名或密码错误")
5. 生成 JWT → 返回 `{ token, user }`

### 4. POST /api/reports/upload

**入参验证**：
```
image:
  - required, multipart file
  - mimetype in ['image/jpeg','image/png','application/pdf']
  - max size: 20MB (前端+后端双重校验)
  - 413 if oversized, 415 if unsupported format

report_date: required, ISO date, ≤ 今天
report_type: required, enum ['biochemical','imaging']
hospital_name: optional, string, max 300
department: optional, string, max 200
```

**业务逻辑**：
1. 检查 API Key 是否已配置 → 400 "请先配置 API Key"
2. 保存文件到 `data/uploads/{userId}/{uuid}.{ext}`
3. INSERT HealthReport (status='uploaded')
4. 异步启动 AI 提取（不阻塞响应）：
   a. 读取图片 → base64
   b. 构建 prompt（根据 report_type 使用不同 skill prompt）
   c. 调用 Anthropic API
   d. 解析返回的 JSON → INSERT indicators/findings
   e. UPDATE HealthReport status='processed' or 'review_needed'
5. 同步返回 201 `{ id, status: 'uploaded' }`

### 12. POST /api/medications/interactions/check

**业务逻辑**：
1. SELECT * FROM medications WHERE user_id=? AND status IN ('active','paused')
2. 药物数 < 2 → 返回 `{ interactions: [], total_count: 0 }`
3. 药物两两组合 → 查询相互作用数据库
4. 按 severity 排序（X > D > C > B > A）
5. 统计各级别计数
6. INSERT 检测记录（如果需要）
7. 返回结果

**相互作用数据库查询**（SQLite）：
```sql
SELECT * FROM drug_interactions
WHERE (drug_a = ? AND drug_b = ?) OR (drug_a = ? AND drug_b = ?)
```

### 17-18. CGA 评估端点

**POST /api/cga-assessments** 入参验证：
```
assessment_date: required, ISO date
```

**业务逻辑**：
1. INSERT CGAAssessment (status='draft')
2. 返回 `{ id, status: 'draft', dimensions: {...} }`

**PUT /api/cga-assessments/:id** 入参验证：
```
dimension: required, enum ['adl','iadl','frailty','nutrition','cognitive_quick','depression','fall_risk','social']
data:
  adl: { eating, bathing, grooming, dressing, bowels, bladder, toilet, transfer, mobility, stairs } (0-10 each)
  iadl: { shopping, cooking, cleaning, laundry, transport, medication, finance, phone } (0-1 each)
  frailty: { weight_loss, exhaustion, grip_strength, gait_speed, activity } (0-1 each)
  ...
```

**业务逻辑**：
1. 验证维度归属 → 404 if assessment not found
2. 验证数据格式 → 400 if invalid
3. UPDATE 对应维度 JSON 字段
4. 检查所有维度是否已填写 → 自动计算各维度得分
5. 返回 200

### 19. POST /api/cga-assessments/:id/analyze

**业务逻辑**：
1. 检查所有 8 个维度是否都已填写 → 400 "还有 N 个维度未完成评估"
2. 检查 API Key → 400 if not configured
3. 构建 CGA analysis prompt：
   - system: "你是老年医学专家，请综合分析以下 CGA 评估数据..."
   - user: 各维度得分 + 用户基本信息
4. 调用 Anthropic API
5. 解析返回 → UPDATE summary + recommendations
6. UPDATE status='completed'
7. 返回 `{ summary, recommendations, dimension_summary }`

### 20-22. 认知筛查端点

**PUT /api/cognitive-screenings/:id** (提交答案)：

**入参验证**：
```
answers: required, object
  - 根据 screening_type 校验必答题数：
    AD8: 8 questions, each 0/1
    MMSE: 30 questions, each 0/1 (or 0-5 for some)
    MoCA: 30 questions, varied scoring
    CDR: 6 domains with sub-items
informant_responses: 仅 AD8/CDR 需要
```

**业务逻辑**：
1. 校验答案完整性 → 400 if missing required answers
2. 调用 FastAPI 评分: POST /compute/score
3. UPDATE total_score + subsection_scores + score_interpretation
4. 查找上次同类型筛查记录 → 计算 score_change
5. UPDATE status='scored'
6. 返回 `{ total_score, subscores, interpretation, score_change }`
