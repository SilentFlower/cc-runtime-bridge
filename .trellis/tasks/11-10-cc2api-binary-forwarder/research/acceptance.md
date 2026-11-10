# 二进制及消费者验收记录

## 范围与身份

- 二进制：官方 Claude Code 2.1.293，Linux x64；分发 27387960 B / SHA256 a6998db0128cb3d0a9862f3b72e9e359e434840c9be4d57b69d56092847fd800。
- 实际执行体：112839864 B / SHA256 ea2cc610928260ca76054fc1818c7c83bb95efe183b06ce98e3d6be7dc31b9b1。两次独立构建完全一致，manifest 的24份桥接输入与当前源码逐一匹配。
- 根仓、cc2api 子仓和 bench 的原基线见 integration-boundaries.md；本任务保护原有其他任务和协议研究变更。
- 全部网络模型验收采用合成凭据与隔离 TLS 上游。独立二进制在无外网干净容器运行；V3 验证器另外检查管理网关公网拒绝计数。

## 已通过验证

| 验证 | 结果与覆盖 |
| --- | --- |
| TypeScript 类型、单元、集成 | typecheck通过，176单元与48集成通过；包含固定官方实际CLI离线子套件 |
| 原版/精简原生 | 候选65通过；原版首次63通过与2项日志线程启动超时，两项单独补验通过；原版TLS44通过 |
| 干净容器独立部署 | 隐藏源码、Bun及官方源，3普通/6Haiku共9次TLS实收和独立CCH核验；memory.max=2550136832，peak=1631354880，oom=oom_kill=0 |
| Rust完整回归 | 共享池前全量755单元及默认integration通过。最新全量单元755通过、1项异步usage等待5秒超时；该项已在串行聚焦复验通过。最新全部默认integration已通过；旧vendor warning归属既有依赖 |
| 最新实际HTTP消费者 | Rust池+Gateway+私有HTTP+本二进制，共17次TLS提交、峰值6；普通与原生293、子代理流式工具、thinking/工具历史、CCH、多值白名单、401一次、取消/代次、账号隔离与诊断来源通过 |
| 最新实际SOCKS消费者 | 同17次/峰值6，随机鉴权CONNECT保持TLS；另有鉴权/目标拒绝单元、平台备用实现编译冒烟和Fast/1M授权单元通过 |
| 账号数据库 | SQLite历史默认、两账号独立更新/回退及忙时门禁通过；本地独立PostgreSQL实际历史迁移、创建、全量/局部更新和回退通过 |
| UI构建 | npm run build（vue-tsc + vite）通过；创建/编辑/reset/OAuth默认及列表标签静态链路已核对 |
| Python/部署 | 原141项运行时、8项physical、4项原生预算、32项manage通过；最新84项account_runtime通过，覆盖停止sender后重建与忙时拒绝 |

Rust完整回归之后的平台守卫、诊断UUID与准备错误分类由最新聚焦编译、实际HTTP/SOCKS和V3批次覆盖。混合权重、FIFO及降并发沿用同一AccountQueue入口，完整Rust测试中的account_queue相关场景通过；新原生分流位于共用许可取得之后。

## 实际 V3 批次

最新镜像为 native-20261110-shared1，清单 /tmp/ccrb-native-v3-shared1.json，日志 /tmp/ccrb-native-v3-shared1-test.log。实际两账号、三角色、3普通/6Haiku及按账号回退等29组场景全部通过。1536 MiB限额下，HTTP峰值676216832 B，SOCKS峰值677347328 B，oom/oom_kill均0；空闲60秒后回收至1个暖进程，占用198385664 B。原始结果在artifacts/cc2api-binary-forwarder-20261110/v3-shared1/results.json。

历史失败记录保留：初始30秒启动等待先于项目库初始化完成；改用已有150秒上限。旧重启夹具12.68秒自然结束；改为恢复后显式放行，重启及字节哈希随后通过。原生布局遇到配置事务已停止的sender时查询HTTP失败；改用已有_running_sender_active，并以84项回归覆盖。

## 发布阶段验收

- 已发布 https://github.com/SilentFlower/cc-runtime-bridge/releases/tag/v0.1.0-beta.2 ，包含实际Linux x64二进制、完整manifest和SHA256SUMS。发布标签固定e783aa519c86936ecb377402837256cffadde003，24项构建输入与该提交逐项匹配。
- 三仓业务提交已推送：cc-runtime-bridge e783aa519c86936ecb377402837256cffadde003；cc2api fff3623b7c7b1d2ea070d26dc0024f5f4632daf6；bench 97f1d446e2d4de016bf63cf3beb1a9ce3b4b8ae7。用户精确确认同时覆盖bench历史Flower提交875e414，GC提交9624fe5经脚本审计通过。
- 实际下载目录为artifacts/cc2api-binary-forwarder-20261110/published-v0.1.0-beta.2-3964bd75，二进制27387960 B及分发SHA与清单一致。bench默认公开附件URL下载及N3/1536 MiB配置入口通过，结果为published-bench-stage-f9c9ef68/result.json。
- 正式附件的完整HTTP复验17次/峰值6通过，完整SOCKS旁路抓包复验同样17次/峰值6通过。首轮HTTP和SOCKS的Gateway用例均出现过准备503；后续通过时钟采样和拒绝字段诊断定位，修复及验收见末节。

## 根仓原始证据摘要

路径相对于 gitignored artifacts/cc2api-binary-forwarder-20261110。

| 文件 | SHA256 |
| --- | --- |
| `native.log` | `75713c2210092c4696c8fc2e72b23d71d995ca1c3ff9efe21bfb76a67969e2f7` |
| `native-original-recheck.log` | `e4cdf8a7c08e96539c195c1493f924c9c58602f0855c8c78b70b324e3a241206` |
| `tls-original2.log` | `218bb8d359f07c0b507055060ff9f5977e7d0df2a8ba7fe9e94e7530c7ea89be` |
| `unit.log` | `c817099eab0702743e3bc7063cd805c53d1f458ab6584cd1725084fa940ce59b` |
| `integration.log` | `5795a6345630973c741ee18ecb065d51053d2d4ac331ac00054d16230ff5491a` |
| `consumer-extended-proof.log` | `cb751cc9500c32d35f4dc012fa8f073612466b08594fbf60c611be1d89af6358` |
| `consumer-http-release.log` | `e573265b16d4e8742e3403b64bc18c685de04e9214cbe10a168fa34820919beb` |
| `standalone-3/standalone-report.json` | `70cd2090c45ca2aae682adce4010f810fbd3861ab93bb50b25d91faa99948a4a` |

## 用户确认的内存优化及最新证据

- 用户明确选择先优化再发布。相同封存执行映像共享后，六个就绪进程的current由1226.1 MiB降为692.2 MiB；最终实际V3六路峰值约646 MiB。
- consumer-shared-http.log / consumer-shared-socks.log：共享映像及空闲回收版HTTP/SOCKS均17次提交、峰值6通过。较低1536 MiB配置的HTTP在consumer-shared-budget-http2.log通过；SOCKS初次诊断flush超时，consumer-shared-budget-socks2.log串行复验17次通过。
- 实际Rust池断言共享dev/inode与四项封存、6→1回收、取消→0、缓存映像在全部原进程退出后可重建；原始私有协议与独立CCH核验保持。
- /tmp/ccrb-native-shared-budget-python.log：88项预算/账号运行时通过。/tmp/ccrb-native-shared-format.log：格式检查通过。
- /tmp/cc2api-native-shared-final-serial.log：755通过/1超时/4忽略；/tmp/cc2api-native-shared-usage-recheck.log：对应长压缩响应usage用例通过。/tmp/cc2api-native-shared-integration.log：最新全部默认integration通过。
- native-shared1镜像验证了共享映像池及SQLite部署路径；之后Gateway测试helper改用生产WAL初始化并删除未使用导入，账号store另补充下节的PostgreSQL缓存分组。最终源的相关路径由聚焦测试覆盖；V3控制脚本额外核验共享inode/封存、OOM0和默认60秒回收。

## PostgreSQL单连接缓存补验

SQLx0.7.4原始定义确认Any NULL按i32编码，PG预编译缓存仅以SQL文本为键。新增单连接NULL→实际时间用例在原TEXT转换上明确失败（bind parameter9），见/tmp/cc2api-native-pg-cache-before.log。

账号创建/全量更新追加六个可空参数的布尔缓存键，停用的可空时间使用同一策略。值继续参数绑定，NULL与空字符串语义保持。/tmp/cc2api-native-pg-cache-after.log真实PostgreSQL补验通过，覆盖NULL/实际时间、设备账号UUID/订阅分级、空字符串、独立后端更新与回退。同一SQL每种类型状态独立缓存，键仅固定布尔位。

最终Store回归：/tmp/cc2api-native-store-final.log 8通过；/tmp/cc2api-native-timestamps-final.log SQLite时间/配置集成16通过。上述PG补验使用独立容器与native2测试库，临时资源随后清理。

## 发布附件复验与问题定位过程

- consumer-published-http.log与consumer-published-socks-complete.log：池用例均通过；Gateway的gateway-error预期401，实际得到503及“原生请求准备失败”。错误由runtime_transport::submit_native消费私有before-send标记后映射，当时仅取得统一错误；本次后续诊断已定位墙钟回拨导致期限上限误拒绝。
- consumer-published-http-complete.log：正常完整HTTP17次/峰值6通过。diagnostic-consumer/ordinary-observed.log：原始驱动、真实Cargo和旁路抓包的完整SOCKS17次/峰值6通过。
- consumer-published-http-gateway-recheck.log：4次网关定向复验通过；三轮strace定向、完整HTTP strace与完整SOCKS GDB分别通过。diagnostic-consumer/repeat-cargo.log：实际Cargo消费者连续6轮网关复验通过。
- 诊断采用gitignored源码副本和编译包装器，只在既有准备错误发生后打印调用栈；业务源码提交保持原内容。副本full-socks.log曾在agent项得到503，该次没有触发unavailable调用栈。早期pcap有末包缓冲缺口，后续改为immediate-mode，并补充独立nsenter旁路抓包。多轮通过不等于已定位或修复先前错误。
- 所有模型请求均使用合成凭据及本地模拟TLS上游。真实Anthropic服务的鉴权、风控与模型推理属于独立验收。

## CHK-001 修复与最终重检证据

- 用户明确选择“修复全部”。180秒墙钟/单调时钟采样记录6次墙钟回拨，单次1175–1275毫秒。连续网关诊断实际捕捉`remaining_ms=120509`，UUID、账号、环境、代次、origin与目标检查均为true；sender随后返回binding/target mismatch并被网关映射为准备503。
- 根因为绝对期限的120秒上限校验及原生池重复校验依赖墙钟。接收端现允许最多5秒时钟偏差，剩余预算钳制120秒并一次转换为Tokio单调截止，legacy发送及原生启动/执行共用该截止。过期、超过5秒偏差及归属/目标错误继续拒绝；已就绪进程到期时在投递业务指令前结束。平台备用实现同步签名。
- 确定性回拨1275毫秒回归在修复前失败，修复后通过；覆盖5秒边界、超界、过期及临近到期的1秒剩余预算。实际二进制用例补充暖进程预算过期后的零业务投递检查。
- `cargo test --locked`最终756单元、85默认集成通过；默认忽略项按原条件保留。`cargo fmt --package claude-code-gateway --check`及根仓`bun run typecheck`通过。临时拒绝诊断已整理完毕。
- 正式下载二进制的HTTP/SOCKS完整复验各17次/峰值6通过，包含401一次及取消/凭据代次/账号隔离。相同SOCKS夹具随后连续6轮网关复验通过，每轮4次TLS提交。全部使用合成凭据与隔离模拟TLS上游。
- 根仓驱动在子阶段断言前持久化可选报告。缺失合成二进制故障注入返回101，报告保留code=101与空实收列表，现场保留回归通过。
- 本次修复发生在Rust消费者和测试驱动。正式beta.2分发SHA保持a6998db0128cb3d0a9862f3b72e9e359e434840c9be4d57b69d56092847fd800。

修复证据路径相对正式下载目录`artifacts/cc2api-binary-forwarder-20261110/published-v0.1.0-beta.2-3964bd75`：

| 文件 | SHA256 |
| --- | --- |
| `repair-clock.json` | `30e6113e227c9277991a15807c27ad987497119b64cf3f5afffd27330252acbb` |
| `repair-gateway-clock-repro.log` | `e3ece7aa68bb96c1fef05a0124cd0a8bab7a3417b591dd1822071c66a5e1c90e` |
| `repair-clock-regression-before.log` | `fa3f4a247f33ebeeec61393692a9cbef709e8a17a2b74600ed04be955e5b5389` |
| `repair-clock-regression-after.log` | `1c0b89a0822eaf2d25a9ba322e2a2e1efbd9875edb31cc879c95a7b9173556b4` |
| `repair-cargo-final.log` | `6e587f1763e09977aab1d2a7a7a13b55611f95e357d1f22bcad12aeacf8a4878` |
| `repair-final-http.json` | `cd31ebef8aa557d2de22f9ce4da59b3da90b2cda8611f5a9383285b000286a07` |
| `repair-final-socks.json` | `c55566ea5b0543ef860d72ae5251ccc57782ceabba8000a48ee824c5f82d783d` |
| `repair-gateway-recheck.log` | `80f2eabb8080c04574f41016179f9b00935bcd2887201e473d1425ae526d44f7` |
| `repair-failure-evidence.json` | `1faaa839518798a295e1f910e69bf1c98fa5b57637e31f8c94f973017770d526` |
