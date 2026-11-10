# 实施计划

- [x] 同批 Brief 批准、前两个子任务通过后，读取 generateNativeRequest/runNativeJob、RuntimePayload、固定官方发送和 TLS 夹具定义。
- [x] 增加原生省略 disabled 的回归、严格对象边界、缺省、不同原生值、完整原生输入和 transport_context 反例。
- [x] 实现有界补齐并把 init.body/result/保留校验同步；保留工具/thinking 等其它语义守卫。
- [x] 执行相关单元、控制/存储集成、原版普通与原生回环、六类归因、TLS off/verify；做必要 typecheck/build 并按 trellis-route/check 完成质量检查。
- [x] 如真实验收已获本次材料确认覆盖，创建独立新四次预算账本后再更新 8787 的已验证构建，保留历史、配置与代理，执行 JSON/SSE/工具两轮；否则只读报告缺少该证据。
- [x] 任何真实失败首错停止，记录桥接参数保留与池模型语义的不同结论；不为补证据重放。浏览器只读核对四条新记录及最终采样。
- [ ] 回写父任务联合验收、Spec 与精确 Git 计划；不把源码修复的正确性和上游语义未通过混报成全通过。

## 回滚

只回退本项参数补齐、相应测试和合同更新；8787 退回先前可用构建时保留日志目录，不删除失败账本或修改受保护配置。

## 执行记录

- 修复前实际原版离线 TLS 定向测试 0 pass / 6 fail：四个显式 disabled 场景在实收中缺字段，两个扩展对象场景原先错误放行。证据 thinking-before.log。
- 有界补齐后定向 6 pass / 0 fail；覆盖 off/verify、默认/自定义 Base URL、JSON/SSE/工具历史、缺省 adaptive、原生省略与扩展保留、额外字段/未知类型/enabled 改 adaptive 的 422 零发送。thinking-final-report.json 包含 24 次独立回环实收及正文/整体 HTTP 哈希。
- 缺省测试最初错误假设未知模型省略 thinking；实际固定 293 返回 adaptive/display=updates，已按观测修正断言。未因测试假设改动产品默认行为。
- 类型检查、构建与 diff 检查通过；整体原版回归 64 pass / 44 skip / 0 fail（TLS 专项另行全量执行），输出 final-native.log。
- 新启动器预检 TLS ready、0 模型请求，目标及受保护配置校验值不变。随后按批准预算恰好发送四次，全部通过，账本 remaining=0；不追加调用。

- 最终单元/集成 211 pass、原版 64 pass/44 skip、独立 TLS 全套 42 pass，均 0 fail。TLS 跳过只出现在未启用专项的原版命令，专项已另行完整执行；日志分别为 final-unit-integration.log、final-native.log、final-tls.log。
- 四次真实场景 JSON、SSE、tool-call、tool-followup 均 HTTP 200/success；准备值与最终 TLS 均为 thinking={type:disabled}，响应没有 thinking。工具调用及结果使用同一显式 Prompt ID，最终头、持久上下文一致。证据 live-ledger.json、live-report.json。
- 8787 已更新为 PID 273264 的新源码构建，TLS verify ready；原 17 条日志逐项保持原样，新增 4 条，共 21 条。只读浏览器四条均可见 disabled、Prompt ID、最终 SHA 及刷出成功，页面无错误。配置及原 20 个脏文件哈希不变，139 个证据/实例文件未含真实 Key。
- full Check-All：三个维度通过，CHK=0、FBK=0、DOC=0；Spec written：runtime-contract.md 固化有界补齐、错误边界、反例和实收断言。未执行 Git 写入，等待统一精确计划确认。
