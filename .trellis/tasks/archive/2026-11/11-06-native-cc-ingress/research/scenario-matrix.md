# 全场景矩阵

原 23 组普通 API 保持稳定 ID；原生场景使用固定原版验证过的合成正文，补充 3 个边界后共 26 组。正式抓包只作为脱敏结构参考，原始账号、正文和凭据不参与本轮测试。

两份运行时分别通过下表，全部已发送正文均由独立 Node.js TLS 接收器核验 CCH；所有测试无外网，真实上游请求为 0。

## 原 23 组普通 API

| 稳定 ID | 原结果 | 预期 HTTP | 原版 HTTP / 发送次数 | 精简版 HTTP / 发送次数 | CCH |
| --- | ---: | ---: | --- | --- | --- |
| minimal | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| empty-tools | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| custom-tool | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| forced-tool | 504 | 400 | 400 / 0 | 400 / 0 | 未发送，不适用 |
| custom-system | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| empty-system | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| empty-array-system | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| tool-history | 504 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| thinking-disabled | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| title | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| unicode | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| headers | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| subagent | 504 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| main-compaction | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| child-compaction | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| auxiliary | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| side-reply | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| workflow | 200 | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| diagnostics | 422 | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| thread | 422 | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| fallbacks | 422 | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| safeguards | 422 | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| metadata | 422 | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |

三项旧 504 的新结果：forced-tool=400；tool-history=200；subagent=200。其余 5 类原字段负例仍属于普通 API 的支持边界，明确 422；它们在完整原生分支被保留。

## 新增原生入站 26 组

| 稳定 ID | 预期 HTTP | 原版 HTTP / 发送次数 | 精简版 HTTP / 发送次数 | CCH |
| --- | ---: | --- | --- | --- |
| native-plain | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-empty-tools | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-custom-tool | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-history | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-forced-supported | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-mid-system | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-official-fields | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-unicode | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-structured-output | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-shadow-cch | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-omitted-fields | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-main | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-subagent | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-workflow | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-compaction | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-auxiliary | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-class-side-reply | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-reject-version | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| native-reject-context | 400 | 400 / 0 | 400 / 0 | 未发送，不适用 |
| native-reject-control | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| native-reject-forced | 400 | 400 / 0 | 400 / 0 | 未发送，不适用 |
| native-child-compaction | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-missing-prompt | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-billing-spacing | 200 | 200 / 1 | 200 / 1 | 两份均通过 |
| native-reject-thinking-type | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |
| native-reject-thinking-budget | 422 | 422 / 0 | 422 / 0 | 未发送，不适用 |

## 补充断言与范围

- 20 组原生成功样本逐字段核对：只允许 metadata.user_id 中 device_id/account_uuid 变化和 billing CCH 变化；会话、其余 billing、业务正文、缓存位置及省略状态保持。
- 原生 tools 省略、空列表、显式自定义工具分别覆盖；不添加默认 CLI 工具、提醒或默认参数。
- main、subagent、workflow、compaction、auxiliary、side_reply 及子代理压缩均保持上下文；缺少可选 prompt ID 时仍保持 metadata 会话。
- 畸形 thinking 类型/预算、版本不支持、显式上下文冲突、本机控制字段及不支持强制工具组合均在发送前拒绝。重复 billing、重复字段、非法身份、未知工具、缺失工具等由单元反例补充。
- 49 项原生套件还覆盖单次发送、响应透传、SSE/HTTP 错误、取消、背压、进程退出、同会话隔离和本地工具禁止执行。
- cc2api 对照实际采用同一入站正文，原生组为 Rewriter(ClaudeCode)+send_direct，普通 API 组为 Rewriter(API)+send_direct；未覆盖完整 Gateway 准入、调度、配置和 TLS 指纹。原生拒绝项不运行该转发探针，不能用探针判断 cc2api 网关是否接受这些输入。

## 证据入口

- artifacts/native-cc-ingress-20261106/{api-original-release-scenes,api-release-scenes,native-original-release-scenes,native-release-scenes}/comparison.json
- artifacts/native-cc-ingress-20261106/{native-original-boundary,native-release}/requests.json
- artifacts/native-cc-ingress-20261106/preview-import-release.json：20 组原生保真逐条核验与 135 条既有记录哈希保护。
