# 修复定位记录

## 用户实际联调

只读检查 8787 当前 run manual-native-20261106T091357Z 的日志和账本，未重放用户请求。采样时 42 条：35 成功、4 个 HTTP 错误、2 次取消、1 次原生构造错误。

| 证据 | 结论 |
| --- | --- |
| 4ebd39cc、e5b047bf、e29d5c12：约 30.1 秒；POOL_TIMEOUT；账本 upstreamStatus=null、attempted=true、outcome=timeout | 本地 Node 转发器的 30 秒总预算中止了等待，不能据此断言上游返回模型不可用 |
| 9a5fd4ce：claude-sonnet-5；原生入站；71 ms；ensureMessages；无 TLS 和池账本 | 发送上下文种子的业务保留断言阻断了原生正文替换 |
| 9838173e：约 5 秒；ECONNRESET；upstreamStatus=null | 独立网络连接重置，当前证据不足以定位池、代理或中间网络哪一段 |
| fb50895d：池已返回 200；响应前缀不完整；账本 canceled | 真实取消事件，不能误记成池超时 |

完整请求 ID 在 prd.md 中保留。任务资料不复制真实提示词、用户消息或凭据。

## 合成分类复现

命令：使用 env -i 的 PATH/HOME/LANG 和显式 CCRB_TEST_ORIGINAL_BINARY，在 unshare --net 中运行 research/classifier-probe.ts。脚本独立 HOME、回环模拟池、合成鉴权，退出清理自己的临时目录。

- Opus 5.5：200，模拟池收到一次。
- Sonnet 5：422，模拟池零次；重复同样失败。
- Sonnet 4.6：200，模拟池收到一次。
- 原生分支的真实业务正文不进入种子构造；runNativeJob 取得种子发送回调后才 prepareNativeBody。故此处不能借删除真实业务保留断言掩盖错误，应明确区分“业务构造”和“只取传输上下文”。

## Bun 请求上限实测

安装环境 Bun 1.3.14。在隔离回环分别启动 maxRequestBodySize=0 和 Number.MAX_SAFE_INTEGER，发送 3 MiB 合成正文：

- 0：413，不能当成不限大小。
- Number.MAX_SAFE_INTEGER：200，读取 3145728 字节。
- idleTimeout=0 可正常启动；本地类型中 Server.timeout 的 0 明确表示关闭空闲超时。

不得把日志 1 MiB 预览上限扩大成请求拒绝条件。

## 受影响层

- src/shared/input.ts、parameters.ts：范围、枚举和工具组合判断。
- src/runtime/293/job.ts：重复参数判断、传输上下文种子与普通业务共用保留断言。
- src/control/service.ts、server.ts、engine.ts：16 个作业、HTTP 2 MiB、默认 90 秒、两层总预算。
- scripts/local-pool.ts、testing/local-pool-driver.ts：各自硬编码 45 秒。
- scripts/testing/pool-forwarder.ts、pool-common.ts：30 秒、手工与验收混用 2 MiB 限制。
- 原生 worker/Engine 24 MiB 和手工私有进程/协议 8 MiB：移除 HTTP 门槛后仍会成为隐藏的请求大小限制，需要同步处理。
- 日志存储队列、预览、保留天数属于观测资源，独立于业务转发，不在本轮改变。

## 实施中的独立定位

- 另发现手工驱动的 next(50000) 和 TLS 等待核验的 5 秒预算，均会对用户请求生效，手工路径一起去除；保留有限验收预算及关闭清理宽限。
- 26 MiB 场景最初在 cc_prepared 之后读取 /proc 环境时误报合成凭据缺失。核验前移到 ready、投递业务正文之前，逐物理进程缓存启动证据；没有取消凭据隔离检查。
- 原版直接 TLS 回环的 26 MiB 用例通过，排除原生发送或主 worker 的大小门槛；原 Node 接收端诊断记录 ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC，约 523082 字节后接收失败。
- 复制转发缓冲没有修复，已撤回；仅在研究钩子中强制 TLS 1.2 仍出现 ERR_SSL_CIPHER_OPERATION_FAILED，未对交付代码降级 TLS。
- 隔离代理改由 Node 透明转发后，相同原生正文在 Node 接收端完整采集，26 MiB 哈希/CCH 和 46 秒长请求通过；后续完整回归进一步使用 52 秒首响应等待、66 秒全程，覆盖旧 50 秒私有等待预算。
- 以上本地 TLS 故障发生在最终采集之前；用户记录中已经完成最终采集、发生于池发送之后的 ECONNRESET 仍是独立问题，不能合并宣称已修复。
