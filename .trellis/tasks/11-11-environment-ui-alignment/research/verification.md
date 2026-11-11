# 环境页改版证据

## 范围和基线

- 根仓基线 `457629fad9cd319199cdcab683508939eb4d89ff`；任务规划/验证材料由本任务所有。
- bench 基线 `2fdb73e10ac9f5afe162d3a407eeba2821400041`；实现为 `webui/app.js`、`webui/index.html`、新增的 `webui/environments.js`、`webui/environments.css` 和 `deploy/v3/verify_environment_ui.py`。
- cc2api 基线 `d6b21f72eacacd7bcac30f3c8f6d1c12c28c74e0`。浏览器验收使用其现有 `web/dist`。
- 原有工作区与文件摘要冻结于根仓 gitignored `.trellis/.runtime/environment-ui-baseline.json`；其他任务及 303 研究文档保持原归属。

## 验收命令

在 bench 执行 `node --check webui/app.js`、`node --check webui/environments.js`、`node --check webui/projects.js`、`python3 -m py_compile deploy/v3/verify_environment_ui.py`、`git diff --check`，退出码均为 0。

实际浏览器入口为 `python3 deploy/v3/verify_environment_ui.py --output .deploy/environment-ui-alignment/verification-final`。报告 `results.json` 为 passed，14 组场景、零脚本异常、7 次合成业务写入、零实际模型请求。全部 HTTP 请求由 Playwright 夹具响应；网关页面和 iframe 使用现有实际静态资源。此证据属于前端与合成 API 验收。

## 覆盖

1. 实际 gateway 导航、统一会话与 iframe 首屏，进入环境页只读。
2. 1280/720/390px、已有暗/明偏好下均显示主后台暖白色板，无页面横向溢出。
3. 名称/ID 搜索、实际状态筛选和未知状态，刷新保留输入及选择。
4. 物理实测显式刷新，未采集与未限制口径、详情展开保留。
5. 准备弹窗原生格式校验，取消、Esc 与遮罩关闭保持零写入；刷新保持输入、焦点和光标位置。
6. 准备、激活、回滚、恢复对账的真实按钮点击，核对 operation_id、expected_revision、release、expected_sha256 和实际确认目标。
7. CLI 忙碌、候选缺失、灰度外及待对账状态的按钮许可。
8. 打开确认窗口后状态变化，仍提交冻结版本；409 留窗显示错误，阻止自动重放。
9. 直接进入环境页打开原运行窗口表单，增删区间与取消行为可用。
10. 读取故障保留快照；账号名称与错误中的 HTML/脚本作为文本展示。
11. 旧列表故意迟到，较新快照保持。
12. 延迟操作回执，实际轮询保持窗口目标，双击只提交一次；离页清理定时器和窗口，迟到回执不重开窗口。
13. 手机展开长 ID、主机名、完整摘要，读取真正空列表。
14. 离开环境页恢复原终端主题，原主题偏好保持。

## 视觉证据

bench `.deploy/environment-ui-alignment/verification-final/` 包含三个尺寸与两种原偏好的页面截图，以及 `prepare-dialog-1280.png`、`prepare-dialog-390.png`、`kernel-details-390.png`。

首次浏览器试跑发现旧 `:root[data-theme=light]` 优先级覆盖新色板；采用同优先级且后装载的 `:root.environment-page` 修正，正式验收断言卡片为白色、页面背景与 gateway 相同。手机页头刷新按钮已固定收缩行为。
