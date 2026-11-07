# 规划研究

- 原始证据为 artifacts/active-cli-20261107T011516593183Z/actual-agent-ingress.json、actual-agent-details.json，来自实际 293 CLI 的独立无外网回环。
- replay-proof.json 只读重放得到两条仍记为 main 的分类调用；两份父会话请求含同一子代理的成功启动记录，通过 tool_use_id 配对得到 Explore 类型，与实际子代理 ID 相符。本轮新增模型调用为 0。
- 官方 SHA256：8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。只读源码 Rdo 构造使用 querySource=auto_mode，并按阶段使用 block/severity 终止结构；不能据 max_tokens=64 或单个 stop 字段识别全部分类变体。
- 多次分类 system 至少两种指纹，差异是 User Deny Rules 段；静态开头与末尾保持。因此一次采集的整份提示词哈希不是通用合同。
- 固定源码的 async_launched 分支生成成功启动文本和 agentId 行；继续代理选项会改变同行后续内容。解析须遵循已验证结构，不能在任意文本中搜索 agentId。
- 启动结果是客户端所提供的结构化工具历史证据，不是身份认证或配置/执行授权。后来关联不得冒充实际已发送的上下文。
- 旧池断连任务独立保留；本任务不把三次真实成功解释为解决网络问题。

## 实施中核验

- 无用户 CLAUDE.md 附件时分类只有一个 transcript 消息，有附件时另有前置上下文；两种均由实际 CLI 验证，不将消息数固定成二。
- 固定构造的第二阶段仍用同一 system，输出上限为 8192 加思考预算、没有第一阶段 stop 字段，收尾摘要不同。独立离线探针 artifacts/cli-attribution-stage2-probe 证实该路径及 SubagentHandback 完整回传，真实模型调用为 0。
- 实现保存 system/规则固定尾部/两阶段收尾的摘要，已验证的 deny rules 列表作为唯一动态插槽；参数预算保留原值。
- 关联查询在数据库先按声明去重再限量；33 个请求携带相同启动历史仍能关联，不因长会话重复历史耗尽额度。不同声明超限则 incomplete。
