# 环境页设计

## 风格与结构

沿主后台 `#f9f6f1` 背景、`#ffffff` 卡片、`#29261e` 正文、`#8c8475` 次文字、`#e8e2d9` 描边和 `#c4704f` 主色。正文使用系统无衬线，ID/摘要局部等宽。圆角约 12px，边框轻量，状态使用有文字的徽章。

页头包含「账号环境」、简短说明及手动刷新。随后为紧凑的环境统计和搜索/状态筛选。账号卡片在宽屏两列、窄屏单列，按「名称和状态 → 三角色与资源 → 内核 → 运行窗口 → 详情和维护」组织。技术字段折叠，故障和交接提示直接可见。内核为灰度外时使用明确的静态说明，操作能力仍只由 native_kernel 决定。

在环境路由上设置明确的页面作用域标记，CSS 仅在此作用域覆盖旧主题、直角 reset、扫描线与内层 topbar/hintbar；导航保持原路由和入口。离开环境路由恢复原页面样式。保持主后台 iframe 及统一会话原样。

## 操作与状态

沿现有 `API`、`renderEnvironments`、`renderNativeKernel` 和弹窗管理方式实现。准备弹窗输入发布标签；激活/回滚弹窗展示明确账号、当前版本和目标版本，提交前保留二次确认。提示范围针对实际 worker 切换，不把容器重建与内核切换合并。

`native_kernel` 字段、state、prepared/current/previous、revision、error、pid、image_sha256 已在 `orchestrator/native_kernel_upgrade.py:198` 定义。表单冻结打开时的 expected_revision；冲突显示服务器错误，用户重新读取后操作。operation_id 仍按现有 UUID 生成。不会在冲突或错误后自动重放写操作。

列表数据保存在现有 state 命名空间；筛选为本地派生，不发写请求。搜索、状态筛选和已展开环境 ID 保持本页会话态。加载刷新与 DOM 重绘区分，模态表单位于列表重绘区域外，保留输入和焦点；导航通过 viewGeneration 校验异步回执，并清理本页轮询和弹窗资源。实测刷新继续只在用户点击时提交。

## 变更边界与验证

环境视图收敛到 bench 的 `webui/environments.js` 与 `webui/environments.css`，`webui/index.html` 装载两项静态资源并提供模板和弹窗。`webui/app.js` 保留路由、单一 state 与共享时段配置，只增加环境路由的挂载/离页收口。原 `style.css` 继续服务其他页面。不调整 Python/Rust 服务端或网关业务页面。

使用 Playwright 与合成 API 响应观察现有页和改版页，包括嵌入主后台场景；捕获所有写请求并核对明确点击及 payload。合成夹具使用显著演示标记，阻断实际上游和凭据访问。通过桌面和手机截图比较及交互验收后再进入 Check-All。

## 布局预览

`research/environment-preview.html` 为本设计的独立合成布局预览，桌面与手机截图位于根仓 `artifacts/environment-ui-alignment/`。预览按钮不连接业务接口；正式实现按上述服务器字段与交互合同验收。
