# 🏥 颐年家庭医生

面向老年人及家属的家庭健康管理系统（Web 应用）。支持健康报告管理、用药追踪提醒、CGA 老年综合评估、认知筛查、AI 专家会诊、健康趋势分析等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Element Plus + ECharts + Vue Router + Axios |
| 后端 | Express.js + SQLite (node:sqlite) |
| 认证 | JWT + bcrypt |
| 构建 | Vite |

## 功能概览

### 🏠 首页仪表盘
登录后展示用户健康数据摘要和快捷入口。用户跟随指引在首页一步步建档完善信息。

### 📋 健康报告管理
- 上传生化/影像检查单（JPG/PNG/PDF）
- AI 自动提取检查指标和参考范围
- 生成异常指标标注和趋势追踪
- 按日期、类型浏览历史报告

### 💊 用药管理
- 药品名称、剂量、频率、时间安排
- 智能药物相互作用检测
- 时间表与用药提醒（短信/电话/App）

### 🩺 AI 专家分析
- 单专科咨询：心内、内分泌、消化、肾内、神经、呼吸、老年科等
- 多学科会诊（MDT）：基于多agent的并行分析 + 综合意见

### 📈 健康趋势
- 生化指标趋势图（ECharts 可视化）
- 时间维度对比和异常预警

### 👴 老年综合评估（CGA）
- ADL / IADL 日常生活能力评估
- 衰弱评估（Frailty Scale）
- 营养评估（MNA-SF）
- 抑郁筛查（GDS）
- 跌倒风险评估
- 多重用药标记
- 社会支持评估

### 🧠 认知筛查
- MMSE / MoCA / Mini-Cog 等多种工具
- 教育程度校正
- 知情者问卷（AD8）
- CDR 临床痴呆评定量表
- 历史筛查对比与变化追踪
- AI 辅助分析及随访建议

### 👤 个人档案 & ⚙️ 设置
- 基本信息、过敏史、健康指标管理
- 系统配置、API Key 管理

## 目录结构

```
yinian-family-doctor/
├── backend/                    # Express.js 后端
│   └── src/
│       ├── server.js           # 应用入口 + 路由
│       ├── database.js         # SQLite 表结构 + 迁移
│       ├── seed.js             # 种子数据
│       ├── middleware/         # auth、error-handler
│       ├── routes/             # auth、reports、medications、
│       │                       # consultations、trends、cga、
│       │                       # cognitive、profile、settings、
│       │                       # reminders、asr
│       ├── services/           # AI 数据提取
│       └── repositories/       # 数据访问层
├── frontend/                   # Vue 3 前端
│   └── src/
│       ├── router/index.js     # 路由 + 导航守卫
│       ├── api/index.js        # Axios 封装 + API
│       ├── views/              # Login、Register、Layout、
│       │                       # Dashboard、Reports、ReportUpload、
│       │                       # ReportDetail、Medications、
│       │                       # Consultation、Trends、
│       │                       # CGAAssessment、CognitiveScreening、
│       │                       # Profile、Settings
│       └── components/         # VoiceInput 等
├── data/                       # SQLite 数据库 + 上传文件
├── .claude/                    # Claude Code 命令/Skills/专家
├── docs/                       # 项目文档
├── scripts/                    # 辅助脚本
└── package.json
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0

### 启动后端
```bash
cd backend
npm install
npm run dev        # http://localhost:3000
```

### 启动前端
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### 初始账号密码
```bash
用户 demo
密码 demo123
```

## API 概览

| 路径 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/register` | POST | 用户注册 | — |
| `/api/auth/login` | POST | 用户登录，返回 JWT | — |
| `/api/reports/upload` | POST | 上传健康检查单 | JWT |
| `/api/reports` | GET | 查询报告列表 | JWT |
| `/api/reports/:id` | GET | 查看报告详情 | JWT |
| `/api/medications` | GET/POST | 用药列表/添加 | JWT |
| `/api/medications/:id` | PUT/DELETE | 编辑/停用用药 | JWT |
| `/api/consultations` | POST | 发起专家会诊 | JWT |
| `/api/trends` | GET | 指标趋势数据 | JWT |
| `/api/cga-assessments` | GET/POST | CGA 评估列表/新建 | JWT |
| `/api/cognitive-screenings` | GET/POST | 认知筛查列表/新建 | JWT |
| `/api/profile` | GET/PUT | 查看/更新个人档案 | JWT |
| `/api/settings` | GET | 系统配置 | JWT |
| `/api/reminders` | GET/POST | 用药提醒列表/新建 | JWT |

## 安全声明

> ⚠️ **免责声明**：本系统所有 AI 分析结果仅供参考，不作为医疗诊断依据。所有诊疗决策请咨询专业医生。如有紧急情况，请立即就医。

- 用户密码使用 bcrypt（12轮）哈希存储
- API 使用 JWT Token 认证
- 数据存储在本地 SQLite 数据库
- 上传文件使用 UUID 命名，防止路径猜测

## License

[MIT](LICENSE)

---

**维护者**: [kyunull](https://github.com/kyunull)
