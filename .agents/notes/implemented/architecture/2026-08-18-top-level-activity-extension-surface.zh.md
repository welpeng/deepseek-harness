# Agent Note：顶层 Activity 扩展面

Status: implemented

[English](2026-08-18-top-level-activity-extension-surface.md) | 中文

## 问题

Web 外壳原本只暴露一个顶层产品表面：按 Workspace 行组织的 Sessions。若某个插件的领域横跨多个仓库，例如 Issue 看板或运维收件箱，它只能伪装成某个 Workspace 的内容、替换整个 root frame，或把功能专属导航加进 sidebar 包。第一种做法破坏领域模型，第二种会移除常驻的会话组合，第三种则会让每个新产品表面都需要修改外壳。

现有 slot 系统可以在父级声明 seat 后组合内容，但不拥有全局导航标识和选择状态。因此顶层扩展需要一个用于发现的小型目录和两个 keyed 渲染 seat，同时不能让 React 组件 import 变成插件协议。

## 决策

`@deepseek-ai/dsh-client-ui-layout` 拥有不依赖 React 的 `ctx.activities` 服务。Activity 描述符包含稳定 `id`、跟随当前语言的 `label()` 解析器、可选的紧凑 label 与可选顺序。该服务拥有当前选择和不可变可观察快照；重复、空白或未知 id 会直接失败，移除当前选中的贡献时会回退到内建 `sessions` id，若它不存在则回退到剩余的第一个 Activity。

根 frame 声明 keyed `activity.main`。`@deepseek-ai/dsh-client-ui-sidebar` 声明 keyed `sidebar.activity`，注册内建 Sessions 描述符，并且只在组合了至少两个描述符时显示 Activity 导航。功能插件通过注册一个描述符，并用同一个 key 向这两个 slot 贡献条目来加入该表面。协作经 `ctx.activities` 与 `ctx.slots` 进行；外壳从不 import 功能组件或业务服务。

Sessions 保持为常驻默认项。选择其他 Activity 时，会话子树只隐藏而不卸载，所选 `activity.main` 条目被分派，详情栏宽度派生为零但不会改变存储的面板偏好。因此返回 Sessions 时会话身份和此前的详情偏好仍然保留。所选 Activity 的侧栏只替换 Session／Workspace 浏览区域；字标、Activity 导航、折叠控制与 Settings seat 仍由外壳拥有。

注册使用 Cordis effect 和感知声明生命周期的 slot injection。卸载 Activity 时，它的描述符与 keyed 条目一起移除，选择状态同步回退；重新加载时可以再次注册同一个 id，不会留下过期框架，也不依赖静态激活顺序。此决策扩展了 [slot 类型链实现](2026-07-22-slot-type-chain-implementation.md)和 [GUI Web 客户端架构](2026-07-19-gui-web-client-architecture.md)；两份笔记都不被取代，因为其 slot 所有权与包边界保持不变。

## 备选方案

**把每个看板都视为特殊 Workspace。** 否决，因为跨仓库任务、账号级收件箱和运维视图并不存在唯一文件系统根目录。虚假 Workspace 会让 UI 导航泄漏为业务身份，并迫使来源项选择任意代码目录。

**让每个插件独立添加顶层侧栏按钮。** 否决，因为按钮贡献无法把选择回退、主表面分派、常驻 Session 行为、排序和 HMR teardown 定义成一个约定。每个消费者都要重建一部分状态机。

**注册完整的 root 替换项。** 否决，因为 `root` 是单一独占外壳 seat。替换它会丢弃布局、Settings、会话身份和所有嵌套声明，而不是新增一个应用领域。

**把 Activity 选择存入 Host 或浏览器持久层。** 暂缓，因为选择属于查看状态，初始约定不需要跨设备或重启语义。各 Activity 继续自行拥有持久筛选和领域数据。

## 影响

可选插件现在可以在 Sessions 旁新增一等应用领域，同时保持独立可卸载。导航目录只承载元数据；完整 Activity 必须贡献 key 匹配的主表面与侧栏条目，并自行拥有数据、加载、变更和错误生命周期。

布局与侧边栏包新增一个共享服务依赖，但没有新增功能依赖。未组合任何可选 Activity 时，Activity 切换器保持隐藏，发布页面仍维持此前的单表面外观。

单元测试固定注册表排序、选择、回退、重复拒绝、AppFrame 常驻行为、侧栏分派与折叠行为。真实 vendored Loader 组合会启动实际 slot 服务和 layout 包并组合一个第三方测试 Activity，观察可见的 `Issues` label 与 keyed 主条目，选择该 Activity，然后验证 dispose 贡献方会同时移除两项结果并恢复 Sessions 回退项。
