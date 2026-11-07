# 三项修复的已核验依据

- 源码基线为 71d12dd66b2d86edfeb3902b91db1a73d7e58076。原有 20 个展开脏文件归其它工作，父任务 intentRouting.baseline 已保存精确范围，不混入本轮交付。
- 原始真实证据在 artifacts/plain-api-tls-20261107T134346418310Z/；精简安全回执已复制到本目录。复核与合成日志复现未新增模型调用。
- 官方原版 2.1.293 SHA256=8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978；TLS 辅助程序 SHA256=f41c1aff4c4836767790a67cab57370446a7610cb7ec79ae9d7c44e5ec02fb01。
- R2：实际 LogStore.record/detail 在独立库中读到 success + 旧 upstream_response.incomplete；不是仅有检查脚本假设。写入 src/control/log-writer.ts:53/:63 无事务；详情 src/control/log-store.ts:154/:158 分次 SELECT。
- R3：固定 293 的 ZQ 排除任意含 tool_result 的记录，oze 向前选用户轮次，uVe 从该实体取 promptId，IOe 对主会话不提供父 prompt 回退；K_t 将其交给 yN，值为空时不生成对应头。当前 cli.ts:98 只给最后一条实体写 ID，因此工具续轮丢失。
- R1：job.ts:199 放行 disabled 被省略；当前四条真实出站无 thinking 且响应都有 thinking。原生默认 effort=high 也存在，但现有证据不足以断言它是上游返回 thinking 的唯一原因。
- vm2api 本机源码 e0fbed172c40721bd68d7d9d5d8a53a4205b1e0c 的普通 API 有 wireThinking/wireBody/wireMessages 及 honorCallerThinking 私有通道；其模型策略可能将 disabled 改 adaptive、强制工具改 auto。它不是官方 293 绑定，不能直接移植。
- 当前 8787 为官方原版 + TLS verify，数据目录为 artifacts/native-live-20261107T122232677998Z/persistent-service/data；本轮规划不重启实例或修改历史。后续更新前重新读取 PID/健康/条数并保留全部历史。
