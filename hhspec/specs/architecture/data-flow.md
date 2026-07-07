# 数据流设计：web-frontend

> L1.3 架构设计 — 跨上下文数据流

## 1. 核心数据流

### 1.1 健康报告上传与 AI 识别

```
User Browser                    Express BFF                   Anthropic API           SQLite
     │                              │                              │                     │
     │ POST /reports/upload         │                              │                     │
     │ (multipart: image+metadata)  │                              │                     │
     │─────────────────────────────>│                              │                     │
     │                              │ 1. 保存图片到本地存储         │                     │
     │                              │ 2. INSERT HealthReport       │                     │
     │                              │    (status=uploaded)         │────────────────────>│
     │  201 {id, status:uploaded}   │                              │                     │
     │<─────────────────────────────│                              │                     │
     │                              │ 3. 异步: 读取图片             │                     │
     │                              │ 4. 构建 extraction prompt     │                     │
     │                              │ POST /v1/messages            │                     │
     │                              │─────────────────────────────>│                     │
     │                              │                              │ AI OCR + 结构化      │
     │                              │  AI 返回结构化 JSON           │                     │
     │                              │<─────────────────────────────│                     │
     │                              │ 5. UPDATE HealthReport       │                     │
     │                              │    (status=processed)        │                     │
     │                              │ 6. INSERT Indicators/Findings│────────────────────>│
     │                              │                              │                     │
     │ GET /reports/{id}            │                              │                     │
     │─────────────────────────────>│ SELECT + JOIN                │                     │
     │                              │──────────────────────────────────────────────────>│
     │ 200 {indicators:[...]}       │                              │                     │
     │<─────────────────────────────│                              │                     │
```

### 1.2 专科咨询 / MDT 会诊

```
User Browser                    Express BFF                     Skills/ dir         Anthropic API
     │                              │                              │                     │
     │ POST /consultations/         │                              │                     │
     │   specialist                 │                              │                     │
     │─────────────────────────────>│                              │                     │
     │                              │ 1. INSERT Consultation       │                     │
     │                              │    (status=pending)          │                     │
     │  201 {id, status:pending}    │                              │                     │
     │<─────────────────────────────│                              │                     │
     │                              │ 2. 异步: 收集健康数据        │                     │
     │                              │ 3. 读取 specialist prompt    │                     │
     │                              │─────────────────────────────>│                     │
     │                              │   返回 Skill MD 内容          │                     │
     │                              │<─────────────────────────────│                     │
     │                              │ 4. 构建 API 调用:            │                     │
     │                              │    system=skill_prompt       │                     │
     │                              │    user=健康数据+主诉         │                     │
     │                              │ POST /v1/messages            │                     │
     │                              │──────────────────────────────────────────────────>│
     │                              │                              │                     │
     │                              │  AI 返回分析报告              │                     │
     │                              │<──────────────────────────────────────────────────│
     │                              │ 5. UPDATE Consultation       │                     │
     │                              │    (status=completed,        │                     │
     │                              │     ai_response=...)         │                     │
     │                              │                              │                     │
     │ GET /consultations/{id}      │                              │                     │
     │─────────────────────────────>│                              │                     │
     │ 200 {ai_response: "..."}     │                              │                     │
     │<─────────────────────────────│                              │                     │
```

### 1.3 健康趋势分析

```
User Browser                    Express BFF                  FastAPI (:5000)         SQLite
     │                              │                              │                     │
     │ GET /trends/GLU?period=6m    │                              │                     │
     │─────────────────────────────>│                              │                     │
     │                              │ 1. 查询该用户该指标历史数据    │                     │
     │                              │──────────────────────────────────────────────────>│
     │                              │                              │                     │
     │                              │ 2. 如果数据点 ≥ 2：           │                     │
     │                              │ POST /compute/trend          │                     │
     │                              │  (data_points: [...])        │                     │
     │                              │─────────────────────────────>│                     │
     │                              │                              │ 3. 线性回归           │
     │                              │                              │    移动平均           │
     │                              │                              │    异常检测           │
     │                              │  TrendResult                 │                     │
     │                              │<─────────────────────────────│                     │
     │                              │                              │                     │
     │ 200 {trend_direction: "↓",   │                              │                     │
     │      data_points: [...],     │                              │                     │
     │      avg: 5.8, ...}          │                              │                     │
     │<─────────────────────────────│                              │                     │
```

### 1.4 认知筛查量表评分

```
User Browser                    Express BFF                  FastAPI (:5000)         SQLite
     │                              │                              │                     │
     │ PUT /cognitive-screenings/   │                              │                     │
     │     {id} (answers: {...})    │                              │                     │
     │─────────────────────────────>│                              │                     │
     │                              │ 1. 识别筛查类型 (MMSE/MoCA)   │                     │
     │                              │ 2. POST /compute/score       │                     │
     │                              │    {type: "MMSE",            │                     │
     │                              │     answers: {...},          │                     │
     │                              │     education_years: 12}     │                     │
     │                              │─────────────────────────────>│                     │
     │                              │                              │ 3. 计算各维度分        │
     │                              │                              │    教育校正            │
     │                              │  {total_score: 26,           │                     │
     │                              │   subscores: {...},         │                     │
     │                              │   interpretation: "normal"} │                     │
     │                              │<─────────────────────────────│                     │
     │                              │ 4. 查找历史筛查记录           │                     │
     │                              │──────────────────────────────────────────────────>│
     │                              │ 5. 计算分数变化               │                     │
     │                              │ 6. UPDATE screening          │                     │
     │                              │    (scores + score_change)   │                     │
     │                              │                              │                     │
     │ 200 {total_score: 26,        │                              │                     │
     │      score_change: -2, ...}  │                              │                     │
     │<─────────────────────────────│                              │                     │
```

## 2. 数据存储策略

### 2.1 双写兼容（Web + CLI 并存期间）

```
┌─────────────────────┐     ┌─────────────────────┐
│   Web (Express)      │     │   CLI (Claude Code)  │
│   读写 SQLite         │     │   读写 JSON 文件      │
└──────────┬──────────┘     └──────────┬──────────┘
           │                            │
           ▼                            ▼
   ┌──────────────┐           ┌──────────────────┐
   │   SQLite DB   │  ◄sync►  │  data/*.json      │
   │   (主存储)     │  (脚本)  │  (CLI 兼容保留)    │
   └──────────────┘           └──────────────────┘

同步策略：
- Web 写入 → SQLite（主）
- 定期同步脚本：SQLite → JSON（单向导出，保持 CLI 可用）
- CLI 写入 → JSON（保持现有逻辑不变）
- 定期同步脚本：JSON → SQLite（单向导入，保持 Web 数据完整）
- 冲突解决：基于 updated_at 时间戳，最后写入胜出
```

### 2.2 文件存储

| 类型 | 路径 | 说明 |
|------|------|------|
| 检查单原始图片 | `data/uploads/{userId}/{reportId}.{ext}` | Web 上传的图片 |
| SQLite 数据库 | `data/wellally.db` | 主数据存储 |
| SQLite WAL 日志 | `data/wellally.db-wal` | WAL 模式日志 |
| 备份 | `data/backups/wellally-{date}.db` | 定期自动备份 |

## 3. 错误传播路径

```
AI API 调用失败:
  Anthropic API ──timeout──> Express BFF ──503──> Web UI
  处理: BFF 重试1次 → 仍失败 → 返回 503 + "AI 分析超时，请稍后重试"

FastAPI 不可用:
  Express BFF ──connection refused──> FastAPI
  处理: BFF 降级 → 使用 Node.js 内置统计方法计算基础趋势
        返回 200 + warning: "高级分析暂时不可用，展示基础趋势"

SQLite 写入失败:
  better-sqlite3 ──SQLITE_BUSY──> Express BFF ──503──> Web UI
  处理: WAL 模式下自动重试3次 → 仍失败 → 503 + "系统繁忙"

认证失败:
  JWT 验证失败 ──401──> Web UI ──跳转──> LoginPage
  处理: 前端拦截器捕获401 → 清除 Token → 跳转登录页
