# L2 数据层详细设计：web-frontend

> L2 Backend Designer — 数据层详设（Repository/DTO/查询优化/事务边界）

## 1. 数据库 Schema (SQLite)

### 创建顺序（按外键依赖）
1. users → 2. allergies → 3. health_reports → 4. biochemical_indicators → 5. imaging_findings
→ 6. medications → 7. drug_interaction_records → 8. specialist_consultations
→ 9. health_trends → 10. cga_assessments → 11. cognitive_screenings → 12. system_config

### 索引策略
```sql
-- 高频查询字段建索引
CREATE INDEX idx_reports_user_date ON health_reports(user_id, report_date DESC);
CREATE INDEX idx_indicators_report ON biochemical_indicators(report_id);
CREATE INDEX idx_indicators_code ON biochemical_indicators(indicator_code) WHERE indicator_code IS NOT NULL;
CREATE INDEX idx_medications_user_status ON medications(user_id, status);
CREATE INDEX idx_consultations_user ON specialist_consultations(user_id, created_at DESC);
CREATE INDEX idx_cga_user ON cga_assessments(user_id, assessment_date DESC);
CREATE INDEX idx_screening_user_type ON cognitive_screenings(user_id, screening_type);
CREATE INDEX idx_screening_previous ON cognitive_screenings(previous_screening_id) WHERE previous_screening_id IS NOT NULL;
```

## 2. DTO 转换

### User ↔ UserProfileDTO
```
DB User: { id, username, password_hash, display_name, role, height_cm, weight_kg, birth_date, gender, blood_type, api_key_encrypted, created_at, updated_at }
API UserProfile: { id, username, display_name, role, height_cm, weight_kg, birth_date, gender, blood_type, api_key_configured: !!api_key_encrypted }
规则: 排除 password_hash, api_key_encrypted, created_at, updated_at
```

### HealthReport ↔ HealthReportDetailDTO
```
HealthReport + JOIN indicators/findings → HealthReportDetail
规则: report_type='biochemical' → 关联 indicators; report_type='imaging' → 关联 findings
```

### CGAAssessment → CGAReportDTO
```
各维度 JSON 字段解析为结构化对象:
  adl_data → { items: {...}, total: number, level: string }
  frailty_data → { items: {...}, total: number, category: string }
  ...
summary → 预留字段，analyze 后填充
recommendations → 预留字段，analyze 后填充
```

## 3. Repository 方法签名

### UserRepository (better-sqlite3)
```typescript
class UserRepository {
  findById(id: number): User | null
  findByUsername(username: string): User | null
  create(dto: CreateUserDto): User
  updateProfile(id: number, dto: UpdateProfileDto): void
  saveApiKey(id: number, encryptedKey: string): void
  getApiKey(id: number): string | null
}
```

### HealthReportRepository
```typescript
class HealthReportRepository {
  findById(id: number): HealthReport | null
  findByUserId(userId: number, filters: ReportFilters): { data: HealthReport[], total: number }
  create(dto: CreateReportDto): HealthReport
  update(id: number, dto: UpdateReportDto): void
  delete(id: number): void

  // 指标操作
  bulkInsertIndicators(reportId: number, indicators: IndicatorDto[]): void
  findIndicators(reportId: number): BiochemicalIndicator[]
  updateIndicator(id: number, dto: UpdateIndicatorDto): void

  // 影像发现操作
  bulkInsertFindings(reportId: number, findings: FindingDto[]): void
  findFindings(reportId: number): ImagingFinding[]
}
```

### MedicationRepository
```typescript
class MedicationRepository {
  findByUserId(userId: number, status?: MedicationStatus): Medication[]
  findById(id: number): Medication | null
  create(userId: number, dto: CreateMedicationDto): Medication
  update(id: number, dto: UpdateMedicationDto): void
  findActiveByUserId(userId: number): Medication[] // status IN (active, paused)
}

class InteractionRepository {
  findByDrugPair(drugA: string, drugB: string): DrugInteraction | null
  createRecord(userId: number, dto: CreateInteractionDto): DrugInteractionRecord
  findByUserId(userId: number): DrugInteractionRecord[]
}
```

### AssessmentRepository
```typescript
class CGARepository {
  findByUserId(userId: number): CGAAssessment[]
  findById(id: number): CGAAssessment | null
  create(userId: number, dto: CreateCGADto): CGAAssessment
  updateDimension(id: number, dimension: string, data: object): void
  updateAnalysis(id: number, summary: string, recommendations: string): void
  updateStatus(id: number, status: string): void
}

class CognitiveScreeningRepository {
  findByUserId(userId: number, type?: string): CognitiveScreening[]
  findById(id: number): CognitiveScreening | null
  create(userId: number, dto: CreateScreeningDto): CognitiveScreening
  updateScores(id: number, totalScore: number, subscores: object, interpretation: string): void
  updateAnalysis(id: number, aiAnalysis: string, riskLevel: string, followUp: string): void
  findPreviousScreening(userId: number, type: string, beforeId: number): CognitiveScreening | null
  getScreeningTrend(userId: number, type?: string): ScreeningTrend[]
}
```

## 4. 事务边界

| 操作 | 事务范围 | 说明 |
|------|---------|------|
| 用户注册 | 单表 INSERT | 原子性要求低 |
| 报告上传 + AI 结果写入 | INSERT report + INSERT indicators (同一事务) | 确保报告和指标同步写入 |
| CGA 评估提交 | UPDATE status + 后续 AI 分析（非事务） | AI 分析在事务外 |
| 数据迁移 | 整批迁移（每 100 条一个事务） | 失败可回滚到批次边界 |
| 相互作用检测 | 只读查询 + INSERT 记录 | INSERT 记录不在读事务内 |

## 5. 查询优化

### N+1 预防
```typescript
// ❌ N+1: 循环查询每个报告的指标
for (const report of reports) {
  report.indicators = repo.findIndicators(report.id);
}

// ✓ 批量查询
const reportIds = reports.map(r => r.id);
const allIndicators = repo.findIndicatorsByReportIds(reportIds);
const indicatorsMap = groupBy(allIndicators, 'report_id');
for (const report of reports) {
  report.indicators = indicatorsMap[report.id] || [];
}
```

### 趋势数据查询
```sql
-- 单次查询获取指标历史，避免 N+1
SELECT b.value, b.unit, h.report_date
FROM biochemical_indicators b
JOIN health_reports h ON b.report_id = h.id
WHERE h.user_id = ? AND b.indicator_code = ? AND h.status = 'confirmed'
ORDER BY h.report_date ASC
```

## 6. 数据迁移策略

### JSON → SQLite 迁移脚本 `/scripts/migrate-json-to-sqlite.js`

```
1. 检测 data/ 目录结构
2. 遍历 生化检查/、影像检查/、手术记录/、出院小结/ 子目录
3. 解析每个 .json 文件
4. 按实体类型插入 SQLite（每 100 条 COMMIT）
5. 记录迁移进度到 system_config（支持断点续传）
6. 迁移完成后写入 system_config { key: 'migration_completed', value: 'true' }
```
