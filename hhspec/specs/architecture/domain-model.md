# 领域模型：web-frontend

> L1.1 架构设计 — 限界上下文与领域建模

## 限界上下文总览

```
┌──────────────────────────────────────────────────────────┐
│                    Web UI Context                         │
│              Vue 3 SPA + Element Plus                     │
│         用户交互 / 路由 / 表单验证 / 图表渲染              │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP REST (JSON)
┌──────────────────────▼───────────────────────────────────┐
│               API Gateway Context                         │
│              Node.js Express (BFF)                        │
│  认证鉴权 / 请求路由 / 数据校验 / AI 代理 / 文件处理       │
└──┬────────────────────────────────────┬──────────────────┘
   │ 内部 HTTP (localhost:5000)          │ SQL (better-sqlite3)
┌──▼──────────────────────┐  ┌─────────▼──────────────────┐
│ Medical Compute Context  │  │   Data Store Context       │
│   Python FastAPI         │  │   SQLite (WAL mode)        │
│  统计计算 / 趋势分析     │  │  ORM / 迁移 / 查询         │
│  异常检测 / 分数校正     │  │  数据完整性 / 备份         │
└──────────────────────────┘  └────────────────────────────┘
```

## 限界上下文详细设计

### 1. Web UI Context

**职责**：前端渲染与用户交互。不直接访问数据库或 AI API。

**聚合根/页面模块**：

| 页面模块 | 路由 | 核心组件 |
|---------|------|---------|
| AuthModule | /login, /register | LoginForm, RegisterForm |
| DashboardModule | /dashboard | StatCards, RecentReports, AlertBanner |
| ReportModule | /reports/* | ImageUploader, IndicatorTable, ReportReview |
| MedicationModule | /medications/* | MedicationForm, InteractionAlert, DrugList |
| ConsultationModule | /consultation/* | SpecialtyPicker, MDTSelector, ConsultationCard |
| TrendModule | /trends | IndicatorSelector, TrendChart, StatsSummary |
| CGAModule | /cga | MultiStepForm, DimensionScore, RadarChart |
| CognitiveModule | /cognitive | ToolSelector, Questionnaire, ScoreTrend |
| ProfileModule | /profile/* | ProfileForm, AllergyManager, ApiKeyConfig |

**领域服务**：
- `AuthService`：登录/注册表单逻辑、Token 管理
- `ValidationService`：表单校验（文件大小、日期范围、量表完整性）
- `ChartService`：ECharts 渲染（趋势折线图、CGA 雷达图、认知分数柱状图）

### 2. API Gateway Context

**职责**：业务逻辑编排、认证鉴权、数据校验、AI API 代理。

**聚合根**：

- **User**：用户账户聚合
  - 实体：User
  - 值对象：Profile (height, weight, birthDate, gender, bloodType)
  - 实体：Allergy
  - 领域服务：AuthService (login/register/token)、ProfileService

- **HealthReport**：健康报告聚合
  - 实体：HealthReport（聚合根）
  - 实体：BiochemicalIndicator（仅存在于生化报告中）
  - 实体：ImagingFinding（仅存在于影像报告中）
  - 值对象：ReportMetadata (reportDate, hospitalName, department)
  - 领域服务：ReportService (upload/query/update/delete)、AIExtractionService

- **Medication**：用药管理聚合
  - 实体：Medication（聚合根）
  - 实体：DrugInteractionRecord
  - 值对象：DosageInfo (dosage, unit, frequency, route)
  - 值对象：InteractionSeverity (A/B/C/D/X)
  - 领域服务：MedicationService、InteractionCheckService

- **Consultation**：咨询聚合
  - 实体：SpecialistConsultation（聚合根）
  - 值对象：ConsultationType (single_specialist/mdt)
  - 值对象：Specialty (cardiology/endocrinology/...)
  - 领域服务：ConsultationService、MDTCoordinationService

- **Assessment**：老年评估聚合
  - 实体：CGAAssessment（聚合根，含 10 维度值对象）
  - 实体：CognitiveScreening（聚合根，含量表值对象）
  - 值对象：ADLScore、IADLScore、FrailtyScore、NutritionScore、DepressionScore、FallRiskScore
  - 值对象：ScreeningResult (type, totalScore, interpretation, riskLevel)
  - 领域服务：CGAService、CognitiveScreeningService

- **Trend**：趋势分析聚合（只读）
  - 值对象：TrendQuery (indicatorCode, period)
  - 值对象：TrendResult (dataPoints, direction, min, max, avg)
  - 领域服务：TrendAnalysisService

**领域服务接口**：

```typescript
interface IAuthService {
  login(username: string, password: string): Promise<AuthResult>;
  register(username: string, displayName: string, password: string): Promise<AuthResult>;
  verifyToken(token: string): Promise<UserContext>;
}

interface IReportService {
  upload(image: File, metadata: ReportMetadata): Promise<HealthReport>;
  getById(id: number, userId: number): Promise<HealthReport>;
  list(userId: number, filters: ReportFilters): Promise<HealthReport[]>;
  update(id: number, data: Partial<HealthReport>, userId: number): Promise<void>;
  delete(id: number, userId: number): Promise<void>;
}

interface IAIExtractionService {
  extractFromImage(imagePath: string, reportType: ReportType): Promise<ExtractionResult>;
}

interface IMedicationService {
  add(medication: CreateMedicationDto, userId: number): Promise<Medication>;
  update(id: number, data: Partial<Medication>, userId: number): Promise<void>;
  list(userId: number, status?: MedicationStatus): Promise<Medication[]>;
  checkInteractions(userId: number): Promise<InteractionCheckResult>;
}

interface IConsultationService {
  createSpecialist(dto: SpecialistConsultDto, userId: number): Promise<SpecialistConsultation>;
  createMDT(dto: MDTConsultDto, userId: number): Promise<SpecialistConsultation>;
  getResult(id: number, userId: number): Promise<ConsultationResult>;
}

interface ICGAService {
  create(dto: CreateCGADto, userId: number): Promise<CGAAssessment>;
  updateDimension(id: number, dimension: string, data: any, userId: number): Promise<void>;
  submitForAnalysis(id: number, userId: number): Promise<CGAReport>;
}

interface ICognitiveScreeningService {
  create(dto: CreateScreeningDto, userId: number): Promise<CognitiveScreening>;
  submitAnswers(id: number, answers: any, userId: number): Promise<ScreeningResult>;
  getTrend(userId: number, toolType?: string): Promise<ScreeningTrend>;
}
```

### 3. Medical Compute Context

**职责**：纯计算服务，无状态，可独立部署。通过内部 HTTP 调用。

**领域服务**：

```python
class TrendComputeService:
    """趋势分析计算"""
    def compute_trend(data_points: List[DataPoint]) -> TrendResult:
        # 线性回归、移动平均、异常检测
        ...

class ScoreNormalizationService:
    """量表分数校正"""
    def normalize_mmse(raw_score: int, education_years: int) -> float:
        # 受教育程度校正
        ...
    def compute_cdr_global(domain_scores: dict) -> float:
        # CDR 总体评分算法
        ...

class StatisticsService:
    """通用统计"""
    def compute_summary(values: List[float]) -> StatSummary:
        # 均值、标准差、百分位数
        ...
```

### 4. Data Store Context

**职责**：数据持久化，通过 ORM 访问。SQLite WAL 模式。

**Repository 接口**：

```typescript
interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(user: CreateUserDto): Promise<User>;
  update(id: number, data: Partial<User>): Promise<void>;
}

interface IHealthReportRepository {
  findById(id: number): Promise<HealthReport | null>;
  findByUserId(userId: number, filters: ReportFilters): Promise<HealthReport[]>;
  create(report: CreateReportDto): Promise<HealthReport>;
  update(id: number, data: Partial<HealthReport>): Promise<void>;
  delete(id: number): Promise<void>;
  findIndicators(reportId: number): Promise<BiochemicalIndicator[]>;
  updateIndicator(id: number, data: Partial<BiochemicalIndicator>): Promise<void>;
}

// ... 类似的其他 Repository 接口
```

## 跨上下文集成模式

| 调用方向 | 模式 | 说明 |
|---------|------|------|
| Web UI → API Gateway | REST HTTP (JSON) | 前端所有数据请求通过 REST API |
| API Gateway → Medical Compute | Internal HTTP (JSON) | 本地 HTTP 调用，Express → FastAPI |
| API Gateway → Data Store | ORM (better-sqlite3) | 同步方法调用，同进程 |
| API Gateway → Anthropic API | HTTPS (JSON) | AI 分析能力，BFF 代理转发 |
| Medical Compute → Data Store | SQL (直接读取) | 只读查询，不写入 |

## 领域事件

| 事件 | 发布者 | 消费者 | 说明 |
|-----|--------|--------|------|
| `ReportUploaded` | API Gateway | AI Extraction | 报告上传后触发 AI 识别 |
| `MedicationChanged` | API Gateway | Interaction Check | 用药变更后触发相互作用检测 |
| `ConsultationSubmitted` | API Gateway | AI Analysis | 咨询提交后触发 AI 分析 |
| `CGAReadyForAnalysis` | API Gateway | AI Analysis | CGA 完成后触发综合评估 |
| `ScreeningCompleted` | API Gateway | Trend Service | 筛查完成后更新趋势数据 |
