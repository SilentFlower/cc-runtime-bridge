# 设计

## 原生实体归因

在构造业务实体前定位最近一个 user 且内容不含 tool_result 的业务消息，遵循已核对的官方 ZQ/oze 轮次选择。仅向该实体写本次有效 context.promptId，而非机械地写到数组末尾。其它历史实体与 core.Re/Kc 工厂、human 来源、turnPosition 及原生提醒装配保持各自真实语义。

## 失败与边界

没有合法轮次时停止在构造前，返回受控 unsupported_parameter/422。现有 parseInput/prepareInput 仍负责显式值、头值和冲突，不能为补头绕过冲突检查。原生输入 transport_context 分支使用自身的受控种子，真实原生业务仍按其既有保真合同。

## 标识合同

context.promptId 是本次作业的权威值；显式相同值可由调用方跨 HTTP 续轮复用，省略值仍为新 UUID。内部会话根不跨作业共享。最终 SDK 必须从正确的用户实体取得标识，不在传输层凭关键词改写 billing 或伪造 human。

## 风险

旧接口容忍的无原始用户历史可能转为明确拒绝；须在 API 文档和本次 Brief 显示。混合工具结果块必须与官方选择器一致，不以 every(tool_result) 误接纳含工具结果的用户实体。
