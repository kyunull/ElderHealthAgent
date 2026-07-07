# 验收基准：web-frontend

生成时间：2026-07-07T15:30:00Z

## FUNC — 功能验收

| 编号 | 场景标题 | 页面 | 来源 |
|------|---------|------|------|
| FUNC-001 | 用户注册与登录 | LoginPage | acceptance.yml FUNC-001 |
| FUNC-002 | 首次注册新账户 | RegisterPage | acceptance.yml FUNC-002 |
| FUNC-003 | 上传检查单并 AI 识别 | ReportUpload | acceptance.yml FUNC-003 |
| FUNC-004 | 人工复核 AI 识别结果 | ReportReview | acceptance.yml FUNC-004 |
| FUNC-005 | 查看历史健康报告 | ReportList | acceptance.yml FUNC-005 |
| FUNC-006 | 单专科 AI 咨询 | SpecialistConsult | acceptance.yml FUNC-006 |
| FUNC-007 | MDT 多学科会诊 | MDTConsult | acceptance.yml FUNC-007 |
| FUNC-008 | 添加用药记录 | MedicationForm | acceptance.yml FUNC-008 |
| FUNC-009 | 药物相互作用检测与预警 | MedicationList | acceptance.yml FUNC-009 |
| FUNC-010 | 管理用药状态 | MedicationList | acceptance.yml FUNC-010 |
| FUNC-011 | 健康指标趋势图 | HealthTrend | acceptance.yml FUNC-011 |
| FUNC-012 | 无数据时的趋势页面 | HealthTrend | acceptance.yml FUNC-012 |
| FUNC-013 | 编辑个人档案 | ProfilePage | acceptance.yml FUNC-013 |
| FUNC-014 | 管理过敏史 | AllergyPage | acceptance.yml FUNC-014 |
| FUNC-015 | 配置 API Key | SettingsPage | acceptance.yml FUNC-015 |
| FUNC-016 | 首页仪表盘概览 | Dashboard | acceptance.yml FUNC-016 |
| FUNC-017 | 数据迁移（首次启动） | CLI/启动 | acceptance.yml FUNC-017 |
| FUNC-018 | 创建老年综合评估 (CGA) | CGAAssessment | acceptance.yml FUNC-018 |
| FUNC-019 | CGA 评估的分步填写与暂存 | CGAAssessment | acceptance.yml FUNC-019 |
| FUNC-020 | 认知筛查 - AD8 初筛 | CognitiveScreening | acceptance.yml FUNC-020 |
| FUNC-021 | 认知筛查 - MMSE 全面评估 | CognitiveScreening | acceptance.yml FUNC-021 |
| FUNC-022 | 认知筛查 - CDR 临床痴呆评定 | CognitiveScreening | acceptance.yml FUNC-022 |
| FUNC-023 | 认知筛查纵向跟踪对比 | CognitiveScreening | acceptance.yml FUNC-023 |

## EDGE — 边界/异常验收

| 编号 | 场景标题 | 边界类型 | 来源 |
|------|---------|---------|------|
| EDGE-001 | 超大文件上传被拦截 | 输入边界 | BND-001 |
| EDGE-002 | 未配置 API Key 时使用 AI 功能 | 资源边界 | BND-012 |
| EDGE-003 | AI 调用超时处理 | 时序边界 | BND-015 |
| EDGE-004 | 会话过期自动跳转 | 时序边界 | BND-016 |
| EDGE-005 | 跨用户数据隔离 | 权限边界 | BND-021 |
| EDGE-006 | 空表单提交拦截 | 输入边界 | BND-003 |
| EDGE-007 | SQL 注入被防护 | 输入边界 | BND-006 |
| EDGE-008 | 药物相互作用数据库缺失 | 数据边界 | BND-019 |
| EDGE-009 | CGA 部分维度未填写 | 输入边界 | BND-024 |
| EDGE-010 | 认知筛查工具与填写人不匹配 | 输入边界 | BND-025 |
| EDGE-011 | 认知筛查分数异常跳跃 | 数据边界 | BND-026 |

## UI — UI 验收检查点

### 页面清单

| 页面 | 路由 | 核心组件 |
|------|------|---------|
| LoginPage | /login | 登录表单、注册入口 |
| RegisterPage | /register | 注册表单 |
| Dashboard | /dashboard | 概览卡片（报告/用药/指标/咨询） |
| ReportUpload | /reports/upload | 图片上传、日期选择、类型选择 |
| ReportReview | /reports/review/:id | 指标编辑表格、确认按钮 |
| ReportList | /reports | 报告列表、筛选、分页 |
| SpecialistConsult | /consultation/specialist | 科室选择、问题输入、报告关联 |
| MDTConsult | /consultation/mdt | 多科室勾选、主诉输入 |
| MedicationForm | /medications/add | 药品表单（名称/剂量/频率/日期） |
| MedicationList | /medications | 用药列表、状态筛选、相互作用结果 |
| HealthTrend | /trends | 指标选择器、时间范围、趋势图、统计卡片 |
| CGAAssessment | /cga | 10 维评估表单（分步）、雷达图、AI 报告 |
| CognitiveScreening | /cognitive | 筛查工具选择、问卷作答、分数趋势图 |
| ProfilePage | /profile | 档案表单、上传头像 |
| AllergyPage | /profile/allergies | 过敏列表、添加/编辑弹窗 |
| SettingsPage | /settings | API Key 配置、验证状态 |

### 核心约束

→ 参见 decision.md

- SPA 路由：Vue Router hash 模式
- UI 框架：Element Plus（表格/表单/弹窗/消息提示）
- 图表：ECharts（趋势折线图、CGA 雷达图、认知分数柱状图）
- 响应式：移动端 ≤ 768px 折叠导航、表格横向滚动

### 详细字段/交互规格

> 详细页面交互规格将在 L2 前端详设阶段由 ui_test_designer 生成 ui-test-spec.yml。

## PERF — 性能基线

| 指标 | 目标 |
|------|------|
| 首页加载时间 | < 2 秒（含 API 数据） |
| AI 分析响应 | < 60 秒（Anthropic API 调用） |
| 图片上传 | < 5 秒（20MB 以内） |
| 趋势图渲染 | < 1 秒（100 个数据点） |
| 并发用户 | ≤ 3 人 |

## SEC — 安全要求

| 要求 | 实现 |
|------|------|
| 密码安全 | bcrypt 哈希存储 |
| 会话管理 | JWT Token，24h 过期 |
| API Key 保护 | 加密存储，BFF 代理，前端不可见 |
| 数据隔离 | 所有 API 校验 user_id |
| SQL 注入防护 | 参数化查询 |
| XSS 防护 | Vue 默认 HTML 转义 |
| 数据隐私 | 全本地存储，不连接外网（AI API 除外） |
