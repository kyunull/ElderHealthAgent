---
phase: L1_decisions_done
challenger_rounds: 0
session_id: "f3a2d291-f332-4482-8072-c2aa7b0a4c7b"
change_name: "web-frontend"
codebase_path: "D:/coding/WellAlly-health"
change_type: "greenfield"
key_decisions:
  - decision: "前端框架 Vue 3 + Element Plus，SPA 单页应用架构"
    source: "user_input"
    rationale: "企业级健康管理系统，Element Plus 有成熟的表格/表单/图表组件"
  - decision: "后端采用 Node.js Express (BFF) + Python FastAPI（医疗计算微服务）混合架构"
    source: "user_input"
    rationale: "Express 处理用户认证和业务逻辑，FastAPI 处理复杂医疗数据计算"
  - decision: "本地部署，绑定 localhost，数据不外传"
    source: "user_input"
    rationale: "保持数据完全本地化，符合隐私承诺"
  - decision: "数据存储从 JSON 文件迁移到 SQLite"
    source: "user_input"
    rationale: "支持复杂查询和事务，更适合 Web 场景"
  - decision: "AI 能力通过 Anthropic API 调用，同时保留 CLI 方式"
    source: "user_input"
    rationale: "Web 界面直接调用 API，CLI 保留给高级用户"
  - decision: "简单本地账户认证，支持多用户切换"
    source: "user_input"
    rationale: "兼顾个人用户和医疗专业人员场景"
  - decision: "首批覆盖 5 个核心模块：健康报告管理、用户档案管理、专家分析、用药管理、健康趋势分析"
    source: "user_input"
    rationale: "核心功能优先，后续分批迭代扩展"
project_tech_stack:
  frontend: "vue3-element-plus"
  backend: ["node-express", "python-fastapi"]
  storage: "sqlite"
detected_tech_specs:
  - "Node.js v24.13.0 已安装"
  - "npm 11.6.2 可用"
  - "Python 3.12.10 已安装"
has_ui: true
prototype_dir: ""
feature_map_path: ""
linked_features: []
requirement_ids: []
linked_prototype_snapshots: []
operation_paths_file: ""
operation_paths_files: {}
proto_is_frontend: false
field_inventory_path: ""
domain_data_model_path: ""
global_field_dict_path: ""
task_manifest_path: ""
backend_inference_path: ""
backend_requirements_resolved: true
l0_mode: "bootstrap"
baseline_context_path: ""
l0_breaking_changes_count: 0
content_index_path: ""
content_index_paths: {}
content_index_missing_portals: []
page_diff_summary: []
open_questions: []
created_at: "2026-07-07T12:18:21Z"
updated_at: "2026-07-07T15:30:00Z"
---

## 探索进展摘要

### 需求概述
为 WellAlly Health 个人医疗数据中心添加 Web 前端界面，使用户无需 Claude Code 命令行即可在图形化界面中管理健康数据。

### 核心决策
- **前端**: Vue 3 + Element Plus SPA
- **后端**: Node.js Express (BFF) + Python FastAPI (医疗计算微服务)
- **部署**: 本地 localhost
- **数据**: SQLite（从 JSON 文件迁移）
- **AI**: Anthropic API + CLI 并存
- **认证**: 简单本地账户

### 首批功能模块 (5个)
1. 健康报告管理（上传识别/查询/历史）
2. 用户档案管理（基础信息/过敏史）
3. 专家分析（9大专科 + MDT 会诊）
4. 用药管理（用药记录/相互作用检测）
5. 健康趋势分析（指标趋势图/可视化）

### 前提假设
- 数据迁移脚本自动执行
- API Key 本地加密存储
- 并发 ≤ 3 人
- 数据完全本地化，不暴露公网
