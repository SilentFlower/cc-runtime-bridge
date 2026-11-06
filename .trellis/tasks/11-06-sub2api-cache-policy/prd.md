# 可选 sub2api 缓存断点策略

## Goal

让没有自主管理消息缓存断点的调用方显式采用 sub2api 尾部选点，同时保持默认原生保真。

## Background

父任务为 11-06-cache-telemetry-controls，原始需求与研究证据分别见其 prd.md 和 research/source-findings.md。现有原生保真合同位于 .trellis/spec/backend/runtime-contract.md:110，真实发送边界为 src/runtime/293/job.ts:runNativeJob。

## Requirements

- C1：CCRB_CACHE_POLICY 接受 preserve/sub2api，默认 preserve；非法值启动失败，变更重建引擎生效，调用方请求不能覆盖。
- C2：preserve 保持现有行为；sub2api 保留 system/tools 标记。调用方已有消息断点或使用根自动缓存时保持原布局，并明确跳过原因。
- C3：可优化时优先给最后一条消息的最后一个可缓存块选点；消息数至少四条时，再选择倒数第二条 user 消息中的最后一个可缓存块。候选为 assistant text 或 user text/tool_result，排除 thinking、redacted_thinking、tool_use 和仅图片的块。
- C4：本轮采用最多四个显式断点的保守预算；不足时尾部优先。已有标记或缓存结构无法明确处理时保留原样并说明，不修改调用方的 TTL/scope。
- C5：新消息标记默认为 ephemeral/1h；有 5m 或省略 TTL 的前置 system/tools 标记时，新标记采用 5m。已有标记类型或 TTL 无法明确处理时整体保留并说明，不新增 TTL 强制改写配置。
- C6：策略结果在日志中可辨认，原始入站不变；所有改动发生在原生最终 CCH 生成前，唯一模型发送、取消及响应字节合同继续有效。
- C7：工作进程必须证明支持所选策略；显式选择 sub2api 时不能让旧精简产物静默忽略该设置。

## Acceptance Criteria

- [x] CA1 / C1、C7：配置默认值/非法值、直接引擎入口、worker 协议归属及旧产物能力不足的失败有验证。
- [x] CA2 / C2、C4：原生带标记、root 自动缓存、预算耗尽和未知缓存结构均有保留对照及明确原因；preserve 下不增加断点或规范化字符串。
- [x] CA3 / C3、C5：短历史、四条及以上历史、assistant 尾部、string content、tool_result、thinking、仅图片、1h/5m 混合前缀的选点和 TTL 可核对。
- [x] CA4 / C6：普通 API 与原生入站均有本地真实最终接收样本；独立核对 CCH，模型请求数为一，无真实上游访问。
- [x] CA5 / C6：日志标明模式、应用/保留/跳过及原因，历史缺诊断仍可读；wire_final 不误标为已采集。
- [x] CA6：原版和新精简产物回归通过，新构建固定摘要、接纳和体积规则成立。

## Non-Goals

- 不移植 cc2api 清除调用方断点的完整重写行为，也不新增 system/tools 断点。
- 不实现 stateful 主线存储、跨请求前缀诊断面板、付费缓存命中率实验或用本地指纹证明命中。
- 不调整账号归属、提示词顺序、原生 telemetry 或页面管理功能。
