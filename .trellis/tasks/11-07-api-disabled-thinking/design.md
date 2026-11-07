# 设计

## 有界显式参数保留

在 generateNativeRequest 的 business fetchOverride 中，原生 SDK 已产出 result 后、显式保留断言和发送前，仅识别调用方 thinking 完整对象恰为 {type:disabled} 且 result.thinking 缺失的情形。将此明确 API 值复制到 result 并同步序列化 init.body，再执行完整 thinking subset 校验，去除“disabled 省略即可接受”的静默例外。

仅修改普通 API 明确值；结果已有不同 thinking 时继续受控拒绝，不能覆盖它以掩盖原生不兼容。省略参数保持原生默认，原生输入的 transport_context 种子不应用 business 补齐。更新 docs/api.md 与 runtime-contract.md，明确这处普通 API 参数保留属于桥接适配。

## 唯一发送与证据

后续 runNativeJob 仍应用现有头策略、stream 与缓存策略，生成 cc_prepared 后由同一官方 api.Ree 发送；native TLS 和最终 CCH 仍发生在官方传输。不得引入第二客户端、二次模型调用、模型回退或把中间值替代 wire_final。

## 上游语义边界

显式字段正确写出并不保证自定义池遵守；离线接收器验证适配合同，受控真实验收验证本机现有池的行为。若该池仍返回 thinking，完整保留响应与失败报告，不能自动删响应块、更换模型或重试，也不能把模型无思考的能力宣称为已实现。

## 风险

更改序列化后需同步所有字节数与哈希采样；无 CCH 的自定义 Base URL 和正常 CCH 路径都验收。真实新预算最多四次且首错停止，原有账本不可覆盖，敏感配置只读。
