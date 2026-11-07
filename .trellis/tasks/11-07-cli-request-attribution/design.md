# 技术设计

## 边界

两项修复共享请求归因合同，统一处理入口证据、持久投影和详情展示。分类识别影响当前请求上下文；后到的代理关联只影响可追溯的日志视图，不改过去的发送值。

## 分类识别

- 在原生识别与头部上下文准备之间引入固定 293 归因识别，复用官方版本和 SHA 身份。结合原生构造特征、system/消息结构和多项参数，不靠单个 stop、max_tokens、模型名、billing 后缀或业务关键词。
- 原生分类 system 会插入用户 deny rules，须按官方生成结构规范化静态特征/片段指纹，不只固定一次采集的整份哈希。不将完整专有提示词收入仓库。仅处理已验证变体，未知格式保持可转发及明确未识别。
- 已识别请求使用既有 requestClass=auxiliary、实际官方 querySource=auto_mode；可选 classification 含 purpose=auto_permission_classifier、source=native_profile、profile=cc293-auto-mode-xml-s1|cc293-auto-mode-xml-s2。第一/第二阶段使用不同的已验证收尾摘要；输出上限会叠加思考预算，其值不作为身份条件。该来源不是身份认证，HTTP 不可注入内部识别标记。
- 显式上下文冲突沿集中入口处理；普通 API、普通 auxiliary、主请求和已知子代理合同保持。

## 启动证据持久化

- 只配对 assistant 的 Agent tool_use 与 user 的同 tool_use_id 成功 tool_result，按固定 293 已验证启动格式提取；自由文本、失败结果、孤立工具块不建立关联。
- 候选含 childAgentId、parentAgentId（证据所属请求的既有规范上下文）、agentType（匹配的 subagent_type）、toolUseId。证据请求和会话来自所属记录；父代理规范 ID 缺失则保持空，不从任意同会话记录猜父代理。
- 在既有请求 payload 中增加可选、已脱敏的启动证据，不加数据库表、不迁移或重写旧记录。提取数量、字段长度与总字节有界，超限明示证据不完整。
- 沿 RequestTrace / LogSnapshot / 日志线程持久化，off 不新增，summary 只保留必要关联摘要；容量、保留期和清理仍生效。

## 关联视图与页面

- LogStore 详情按既有 session 索引和 childAgentId 只读查询证据，不扫描调试正文或启动运行时；重启后仍可读取。查询有界且检测溢出，相同证据去重、不同父代理/类型标冲突，跨会话不关联。
- RequestDetail 的可选 agentAssociation 含 state、parentAgentId、agentType、parentSource、typeSource、evidence；evidence 是配对的 {requestId,toolUseId} 数组，避免两个独立数组错位。状态为 explicit、linked、unknown、conflict、incomplete；字段来源为 explicit、client_tool_result、unknown。由 shared/contracts.ts 定义、shared/log-api.ts 集中解码。
- 显式值不被派生值覆盖；后到证据在刷新时可见，context、请求行原始关联及 capture/SHA 不变。旧记录没有新元数据则保持未知，不从旧正文补猜。
- 页面展示有效关联、证据来源和缺失原因，区分“发生时上下文”；展示分类用途。默认 querySource 不能冒充实际代理类型。沿用 textContent、旧记录兼容和手机布局。

## 失败及运行

- 提取/归因失败不能控制配置、执行工具、改变业务字段、重放或阻塞模型。未知、超限、冲突和查询失败各自可见，不用伪造值回退。
- 使用独立离线实例验证；不修改用户原版 CLI、账号或代理，不创建额外真实预算。常驻服务更新不得覆盖旧运行目录。
