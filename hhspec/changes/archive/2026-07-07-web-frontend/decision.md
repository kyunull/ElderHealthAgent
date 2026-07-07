# 关键决策：web-frontend

> WellAlly Health Web 前端界面 — L1 架构与技术选型决策

## 决策 1：前端架构 — Vue 3 SPA + Element Plus

- **选择**：Vue 3 (Composition API) + Element Plus + Vue Router + ECharts
- **理由**：
  - Element Plus 提供成熟的医疗数据展示组件（表格、表单、图表、骨架屏）
  - Vue 3 Composition API 适合模块化组织 7 个独立功能模块
  - SPA 架构实现无刷新页面切换，用户体验流畅
  - ECharts 满足健康趋势分析的可视化需求（折线图、雷达图、参考范围标注）
- **备选**：React + Ant Design — 生态丰富但 Vue 在国内社区更活跃，团队偏好 Vue

## 决策 2：后端架构 — BFF + 微服务混合模式

- **选择**：Node.js Express (BFF) + Python FastAPI (医疗计算微服务)
- **理由**：
  - Express 作为 BFF 处理认证、路由、文件上传、基础 CRUD
  - FastAPI 专门处理需要 Python 生态的医疗计算（统计分析、指标异常检测）
  - 两者通过内部 HTTP 调用通信（localhost 本地调用，零网络开销）
  - 共享 SQLite 数据库（单文件，无分布式一致性问题）
- **备选**：
  - 纯 Express — Node.js 在科学计算方面不如 Python 生态丰富
  - 纯 FastAPI — Python 在 Web 中间件/认证/SQLite ORM 方面不如 Node.js 便利

## 决策 3：数据存储 — JSON 文件 → SQLite 迁移

- **选择**：SQLite（WAL 模式），提供自动化 JSON→SQLite 迁移脚本
- **理由**：
  - 支持复杂查询（指标历史趋势、药物相互作用的 JOIN 查询）
  - 事务支持，避免并发写入数据损坏
  - 单文件数据库，保持部署简单（无需额外数据库服务）
  - WAL 模式支持并发读，满足 ≤ 3 个并发用户的场景
- **Breaking Change**：现有 CLI 工具继续使用 JSON 文件（单向迁移，Web 写入 SQLite → 定期同步回 JSON）
- **备选**：保持纯文件系统 — 查询性能差，无法支持趋势分析等复杂场景

## 决策 4：AI 集成 — Anthropic API 直接调用 + CLI 保留

- **选择**：Express 后端封装 Anthropic API 调用，复用现有 skills/ 和 specialists/ 的 prompt 定义；CLI 命令完整保留
- **理由**：
  - 用户配置 API Key → 后端加密存储 → 前端无感知
  - 所有 AI 调用经过 BFF 代理，API Key 不暴露到前端
  - Skill prompt 定义直接作为 system prompt，零重复开发
  - CLI 保留给高级用户和自动化场景
- **备选**：纯 CLI 触发 — Web 只是一个包装器，后台调 CLI，延迟高且不可靠

## 决策 5：认证方案 — 简单本地账户 + JWT

- **选择**：本地 SQLite 存储用户凭证（bcrypt 哈希），JWT Token 会话管理（24h 过期）
- **理由**：
  - 本地部署场景，不需要 OAuth/SSO 等复杂认证
  - JWT 无状态，适合单进程 Express 服务
  - bcrypt 密码哈希，符合安全最佳实践
  - 支持多用户切换（家庭共享场景）
- **备选**：无认证 — 无法支持多用户和数据隔离

## 决策 6：限界上下文划分

```
┌─────────────────────────────────────────────────────┐
│                 Web UI (Vue 3 SPA)                   │
│  前端界面 — 7 个功能模块页面                          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP REST (JSON)
┌──────────────────▼──────────────────────────────────┐
│           API Gateway (Express BFF)                  │
│  认证/路由/CRUD/文件上传/AI 代理                      │
└────┬──────────────────────────────────────┬─────────┘
     │ 内部 HTTP (localhost)                 │ SQL
┌────▼──────────────────────┐  ┌───────────▼─────────┐
│ Medical Compute (FastAPI) │  │  SQLite Database     │
│ 趋势分析/异常检测/统计     │  │  用户/报告/用药/CGA  │
└───────────────────────────┘  └─────────────────────┘
```

- **上下文边界**：
  - Web UI：前端渲染和用户交互，不直接访问数据库或 AI API
  - API Gateway：业务逻辑编排，认证鉴权，数据校验
  - Medical Compute：纯计算服务，无状态，可独立部署
  - Data Store：数据持久化，通过 ORM 访问

## 决策 7：路由与页面结构

- **选择**：7 个一级导航 + Dashboard 首页
- **页面清单**：
  1. `/dashboard` — 首页仪表盘概览
  2. `/reports` — 健康报告管理（上传/查看/复核）
  3. `/medications` — 用药管理 + 相互作用检测
  4. `/consultation` — 专家分析（单专科/MDT）
  5. `/trends` — 健康趋势分析
  6. `/cga` — 老年综合评估
  7. `/cognitive` — 认知筛查
  8. `/profile` — 个人档案 + 过敏史
  9. `/settings` — API Key 配置
- **理由**：按功能模块清晰分组，URL 语义化

## 决策 8：启动与部署

- **选择**：统一启动脚本 `npm start`（启动 Express + 前端 dev server）
- **理由**：
  - `npm start` → 检查 SQLite → 自动迁移 → 启动 Express:3000 + Vite:5173
  - Express 代理前端请求（开发模式代理到 Vite，生产模式 serve 静态文件）
  - 生产模式：`npm run build` 编译前端 → Express serve dist/
  - FastAPI 微服务作为独立进程启动（Python 脚本）
- **备选**：Docker Compose — 过度复杂，本地部署不需要容器化
