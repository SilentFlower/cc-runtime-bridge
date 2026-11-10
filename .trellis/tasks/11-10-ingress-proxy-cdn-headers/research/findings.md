# 请求头白名单依据

## 证据边界

- `header-inventory.json` 只保存头名、计数、类别、阶段、采集来源与完整性。历史详情和日志记录可能重叠，不能相加为独立请求数。
- 已读取普通 API 的 5 份历史详情、实际 CLI 的 20 份历史详情，以及三份有数据的只读 SQLite 日志，共 143 条记录。两个其他历史数据库当前为空，记录这一缺口。
- 143 条日志包含主会话、子代理、辅助与压缩请求。独立的三份 TLS 回环 captures 共包含 29 条上游接收记录。
- `cc_prepared` 是原生传输前参数。`wire_final` 保留 `native_tls_verifier` 或 `local_pool_node_tls_receiver` 的原采集位置。TLS 回环 captures 按自身 receiver/upstream 标签记录，空 receiver 保持为空。
- 普通 API 历史请求包含 `x-api-client-probe`；TLS 矩阵包含 `x-special`、`x-duplicate`、`x-fixture-close`。这些属于探针或测试字段，出现于历史样本不构成协议准入依据。
- `x-new-api-version`、`x-oneapi-request-id`、`x-amz-cf-id`、`x-amz-cf-pop` 等出现在已读取详情的上游响应阶段。响应记录不作为入站请求白名单依据。

## vm2api 参考

- `/root/project/vm2api/src/lib/identity/crs-headers.mjs:23` 的 `KEEP` 是头部提取集合。
- 同文件 `protocolHeadersOnly`、`conditionalHeaders`、`slotDeviceHeaders` 和 `resolveVmCharacteristicHeaders` 进一步区分协议参数、代理关联和设备字段。提取集合不等于最终发送集合。
- 本轮借鉴字段归属与明确登记方式。版本、UA、Stainless 常量继续采用本项目固定 293 的运行时来源。

## 初始字段归属

| 类别 | 精确字段或既有规则 | 依据与处理 |
| --- | --- | --- |
| 可透传内容协商 | `accept`、`accept-language`、`cache-control` | 当前 `MERGEABLE` 定义；Accept 的历史实收及既有合法多值合同 |
| 能力及版本 | `anthropic-version`、`anthropic-beta` | 历史入站与最终 TLS；继续沿 API/原生适配分支处理 |
| 已有协议开关 | `anthropic-dangerous-direct-browser-access` | vm2api、历史入站与最终 TLS；保持单值及同名覆盖合同 |
| 固定 293 可选字段 | `x-claude-code-prev-tool-durations`、`x-claude-code-compaction`、`x-claude-code-context-compacted` | vm2api 和固定 293 的 `pon`/`mon` 构造定义；本轮样本未出现，来源摘要见 `native-header-definitions.json` |
| 调用上下文 | `x-claude-code-request-class`、`x-claude-code-session-id`、`x-claude-code-prompt-id`、`x-claude-code-agent-id`、`x-claude-code-parent-agent-id`、`x-claude-code-agent-type` | 本项目 `CONTEXT_HEADERS` 定义和主子代理等历史样本；继续与 context、metadata、billing 对齐 |
| 运行时字段 | 现有 `RUNTIME_HEADERS` 与 `x-stainless-*` 规则 | 输入值由实际运行时归属覆盖；仅原生实际生成的字段进入发送 |
| 连接及凭据 | 现有连接级字段、Connection 声明和调用方凭据规则 | 继续按专用原因删除 |
| 其余调用方字段 | 代理/CDN、客户端私有、追踪、测试探针及未知扩展 | 格式合法时统一删除并逐项记录原因；不新增来源识别或测试旁路 |

## 验证影响

- `tests/unit/header-policy.test.ts`、`tests/integration/control.test.ts` 和 `tests/native/native.test.ts` 现有未知扩展保留断言需要按已批准的兼容行为更新。
- `tests/native/tls-verifier.test.ts:90`、`:358`、`:392` 使用 `x-fixture-mode` 控制独立 Python 上游。白名单实施后该头按普通未知字段删除，夹具需改用已有私有 stdin/JSONL 通道，保留对 HTTP 错误、长流、取消、部分读取和重建场景的真实验证。
- 第二段测试池转发接收的是原生实际请求，沿既有传输合同处理，不增加另一套入站白名单。
- `README.md`、`docs/api.md`、`docs/header-policy.md`、`AGENTS.md` 和 `.trellis/spec/backend/runtime-contract.md` 中原先默认保留未知头的描述需要同步。
