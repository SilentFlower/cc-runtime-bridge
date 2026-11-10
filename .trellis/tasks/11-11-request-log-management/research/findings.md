# 现有日志链研究

- 页面当前以 selected 状态在表格下方展开，读取使用统一 API client、AbortController 与 generation；弹窗可复用这些归属保护。
- 已有 ui/dialog 组件，Accounts.vue 提供受控 open、固定高度与内部滚动的实际样式。
- DiagnosticsStore 写入队列容量 1024，后台每小时 prune；SQL 先删关联尝试再删请求，时间边界当前为开始时间减 8 天。
- native_capture 的保存是独立有界阻塞任务，最多 2 个许可、等待 250 ms；原文件 0700/0600，原子重命名，按数量与字节回收。
- Info 应在完整内容持久化入口前门控。Debug 继续沿按账号采集保护，只读取属于当前请求的尝试。
- 单独的按天回收需要覆盖数据库摘要和私有快照，后台处理休眠账号时保持只读目录访问和既有环境状态。

- 既有 gateway 的 format_request_capture 会输出脱敏完整头和正文，429 与非流式专项开关分别在 gateway.rs:3257/:2598 读取；info 需要同时门控这些出口，避免仍经专项日志保存内容。非流式响应既有采集同样保持 info 摘要语义。
- AccountRuntime._heartbeat 每 5 秒分派执行租约续期。七天清理采用独立后台生命周期，避免慢磁盘工作占据续期池。
