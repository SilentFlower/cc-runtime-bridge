# vm2api实际参考与样式规格

## 来源与采集

- 来源仓库/root/project/vm2api，固定HEAD e0fbed172c40721bd68d7d9d5d8a53a4205b1e0c。
- 从该HEAD导出前端至私有运行目录，以现有依赖运行Vite。Playwright仅返回合成管理API数据，外部请求阻断；真实模型调用0。
- 实际截图位于.trellis/.runtime/vm2api-reference-20261112/：logs-desktop.png、logs-detail.png、logs-desktop-light.png、logs-detail-light.png、logs-mobile.png；reference.json保存computedStyle、动画和按钮三态。
- 实际详情页签为“概览、决策链、性能、原始数据”。源文件web/src/features/logs/log-detail/log-detail-dialog.tsx使用固定标题、页签与内部滚动；列表使用状态徽标、紧凑工具栏，筛选默认折叠。

## 五层风格规格

1. 色板：目标以vm2api亮色参考为默认，保持已有深色偏好兼容。映射现有--background→oklch(0.995 0.001 258)、--foreground→oklch(0.21 0.008 258)、--card→oklch(1 0 0)、--muted→oklch(0.968 0.003 258)、--muted-foreground→oklch(0.5 0.014 258)、--border→oklch(0.916 0.005 258)、--primary→oklch(0.52 0.115 157)、--primary-foreground→white；保留现有变量名称。
2. 字体：实际正文使用系统sans栈，-apple-system/Segoe UI/Roboto/Noto Sans；数字和请求ID使用ui-monospace/SFMono-Regular/Menlo/Consolas。标题样本24px、700字重，工具栏按钮14px。复用系统中文回退字体。
3. 形状：参考根--radius=0.75rem，取样按钮高度34px、圆角12px，常态无box-shadow；使用细描边与轻量层次，替换目标页面大块空白。
4. 组件：请求列表突出时间、账号、状态和实际耗时；ID用短文本及复制入口。详情按概览/请求链路/性能/原始数据分区，保持固定标题、可切换页签、内部滚动、Esc关闭与焦点返回；目标只展示当前API实际存在的数据。
5. 动效：参考观测到ping 1000ms、页面进入240ms及推广倒计时。目标只采用相关交互过渡；新动效提供prefers-reduced-motion静态等价。推广浮层不属于业务目标。

## 行为边界与差异

- 保留用户要求的顶部Tab导航，不迁入参考站侧边导航结构。
- vm2api数据模型与本项目不同，费用、会话与业务发送字段按本项目实际证据展示；缺失保持未观测。
- 当前请求详情按debug就提供采集读取按钮，capture_status=disabled仍读取不存在文件。改为按冻结状态控制入口，说明关闭状态并直达环境采集开关。
- 前端详情中的CC组装值、最终TLS证据、缺失与截断状态继续按现有独立语义呈现。
