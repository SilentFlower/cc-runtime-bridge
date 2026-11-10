# 保留普通 API 显式关闭 thinking 参数

## 目标与范围

落实父任务 R1/A3：普通 API 明确传入且仅含 type=disabled 的 thinking 对象必须到达最终出站，省略仍使用原生默认。负责 src/runtime/293/job.ts、相关原版/单元测试、docs/api.md 与运行时规范；最终联合验收归本项落实并回写父任务。

## 已确认事实

P1：job.ts:199 将 disabled 被省略当作可接受例外；本轮四个最终实体均省略该字段、四个响应均有 thinking，详见父任务 research/review-record-comparison.json。尚无“向同一上游显式发 disabled 后”的真实响应证据。

## 需求

- R1.1：只对普通 API 的显式 thinking={type:disabled} 被原生省略这一已证实场景补齐原值，再执行字段保留校验。
- R1.2：SDK 构造、原生上下文、Ree、唯一发送、原生 CCH 及 TLS 最终采集保持真实来源；init.body、捕获正文、哈希和真实发送一致。
- R1.3：省略 thinking 不补 disabled；其它不支持形状、原生改写 enabled/adaptive、额外 thinking 字段仍沿受控拒绝合同，不能静默转换、删字段或扩大通用模型能力。
- R1.4：完整原生 CC 业务分支保持保真；同次 transport_context 种子不能误应用普通业务补齐。

## 验收

- A1.1 普通显式 disabled 的 JSON/SSE/工具历史，经 off/verify 回环均实际收到该字段；原生与省略场景不变，attempt=1。
- A1.2 init.body、cc_prepared、独立 TLS 实收/最终采样的正文及原始哈希一致；字段保留断言发生于适配之后，身份及 CCH 不手工构造。
- A1.3 上游明确拒绝、仍返回 thinking 或不遵守语义时原样保留证据，不过滤响应伪造关闭、不重发，语义验收单列失败。
- A1.4 构建最新 preload，联合日志与轮次回归；完成类型检查、构建及适用质量检查。
- A1.5 如进行真实联合验证，仅本机已有池配置和 deepseek-flash，最多四次新预算、每次 max_tokens=128、首错停止，覆盖 JSON/SSE/工具调用与续轮；核对响应是否遵守关闭，记录当前 8787 新日志与全部历史保留，TLS verify 保持开启。

## 交付顺序与范围边界

日志和 Prompt 子任务先通过，最后完成本项与联合验收。temperature、强制工具、第三方模型能力表、修改官方二进制及旧精简产物重发版均不纳入。
