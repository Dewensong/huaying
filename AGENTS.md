# AI 协作规则

## 项目进入
先读 `README.md` → `context.md` → `progress.md` → `decisions.md`，理解当前状态。代码型项目额外读 `.claude/rules/architecture.md`。

## 项目类型
先判断项目属于哪种：
- **内容型**：文档/研究/PRD/素材为主，不产生可运行代码 → 按文件分工使用即可
- **代码型**：可运行代码为主，有 src/ 分层和构建流程 → 额外遵循代码架构分层
- **混合型**：既有内容产出也有代码产物 → 额外遵循代码架构分层

## 工作模式
- 讨论模式：先梳理思路，不改文件
- 执行模式：直接修改文件、生成产物、跑验证
- 整理模式：散乱内容整理进文档
- 复盘模式：总结进展、更新记录、提炼下一步

## 文件分工
- `README.md`：入口、当前状态、下一步
- `context.md`：项目背景、业务信息、约束
- `progress.md`：按日期记录推进
- `decisions.md`：关键决策和原因
- `resources.md`：云端链接、外部资料、素材索引
- `.claude/rules/`：模块化领域规范，按需加载
- `docs/`：稳定文档
- `work/`：推进中的草稿和实验
- `artifacts/`：过程资产
- `deliverables/`：阶段性交付物
- `archive/`：旧版本和废弃方案

## 代码架构分层

代码型项目遵循三层分离。详细规范见 `.claude/rules/architecture.md`。

**后端：Controller → Service → Repository**

| 层 | 职责 | 边界 |
|----|------|------|
| Controller | HTTP 翻译 | ✅ 提取参数、调 Service、返回响应 ❌ 业务逻辑、直接操作 DB |
| Service | 业务逻辑 | ✅ 规则校验、编排调用、事务 ❌ 处理 HTTP 对象、直接写 SQL |
| Repository | 数据访问 | ✅ CRUD、查询、分页 ❌ 业务判断、调外部 API |

铁律：依赖单向 Controller → Service → Repository，不可反向；Controller 不直调 Repository；跨层传递用 DTO。

**前端：Page → Component → Hook/Service**

| 层 | 职责 | 边界 |
|----|------|------|
| Page | 组合布局、路由参数、页面级数据 | ❌ 包含可复用 UI 逻辑 |
| Component | 纯 UI 渲染，props 入，事件出 | ❌ 直接调 API、含业务逻辑 |
| Service | API 调用、数据转换、缓存 | ❌ 操作 DOM、持有 UI 状态 |
| Hook | 可复用状态逻辑 | ❌ 渲染 UI |

**共享层（shared/）**：类型定义、校验规则、纯工具函数。

**目录起步**（功能 < 10 时）：
```
src/
├── frontend/
│   ├── pages/          # 页面
│   ├── components/     # 可复用组件
│   ├── hooks/          # 自定义 hooks
│   ├── services/       # API 调用
│   ├── store/          # 状态管理
│   └── utils/          # 工具函数
├── backend/
│   ├── controllers/    # HTTP 翻译
│   ├── services/       # 业务逻辑
│   ├── repositories/   # 数据访问
│   ├── models/         # 数据模型
│   ├── routes/         # 路由注册
│   ├── middleware/      # 中间件
│   └── config/         # 配置
└── shared/
    ├── types/          # 共享类型
    └── constants/       # 共享常量
```
功能膨胀后渐进迁到垂直切片（`features/xxx/`），详见 `architecture.md`。

## 全局与项目分层
- 方法全局化，材料项目化
- 跨项目 skill 放 `/Users/dewens/.codex/skills/`，脚本放 `Projects/scripts/`，工具放 `Projects/_tools/`
- 项目内材料（背景、数据、素材）只放当前项目文件夹
- 领域规范放 `.claude/rules/`，通过 CLAUDE.md 引用

## 收尾规则
每次完成后：
1. 更新 `progress.md`
2. 必要时更新 `README.md` / `decisions.md` / `resources.md`
3. 项目规范变化时，更新 `.claude/rules/` 对应文件
4. 明确说明本次改了什么、还剩什么

## Git 规则
- 重要变化后建议提交；不提交密钥、密码、敏感数据
- 大型媒体和批量素材优先放云端或 `artifacts/raw/`

## 边界
不删除已有重要内容（除非 Dewens 明确要求）；不把简单任务过度复杂化；内容型项目不强行套代码分层。
