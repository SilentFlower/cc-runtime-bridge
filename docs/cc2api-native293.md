# cc2api 原生 293 转发

Linux x64 分发文件为 `ccrb-runtime-linux-x64`，实际大小 **27387960 字节（26.12 MiB）**。它是内含固定官方 2.1.293 构造和发送逻辑的执行内核。cc2api 提供账号管理、鉴权、调度、凭据刷新和用量记录。

## 运行与身份

运行环境需要 Linux x64、glibc、`/proc`、可执行的 memfd 和独立可写 HOME/config/cwd。初始化需要可写 `/tmp`。Python、Bun、官方 CLI 源文件、解压目录及构建工具属于构建或验收侧依赖。

| 身份 | SHA256 |
| --- | --- |
| 官方来源 2.1.293 | `8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978` |
| 分发文件 | `a6998db0128cb3d0a9862f3b72e9e359e434840c9be4d57b69d56092847fd800` |
| memfd 执行体（112839864 字节） | `ea2cc610928260ca76054fc1818c7c83bb95efe183b06ce98e3d6be7dc31b9b1` |

两次独立构建得到相同分发字节及执行体。加载器校验展开载荷并封存 memfd；消费者通过已校验文件 FD 启动，核对就绪 PID、版本、能力及 `/proc/<pid>/exe`。

## 按账号接入

1. 在同一批 V3 镜像中加入新 cc2api 消费者及原生二进制。bench 构建从固定 beta 附件获取文件，并校验上述 SHA256。发布前可用 `V3_NATIVE_RUNTIME_ASSET=/绝对路径/ccrb-runtime` 指定同校验值的本地候选。
2. 显式设置 `V3_NATIVE_SENDER_MEMORY`，并保证已冻结的账号 RAM 总预算足够。账号标准并发 3 需要覆盖 6 个 Haiku 物理进程，预检最低为 `1408m`，已验证的部署配置使用 `1536m`。例如账号总 RAM 为 `4g` 时，network 保留 256 MiB，原生 sender 1536 MiB，CLI 2304 MiB。额外 swap 只属于 CLI。
3. 在 cc2api 账号创建或编辑中选择“原生运行时 2.1.293”，对应 `request_backend=native293`。历史账号和省略值为 `legacy`。后端切换要求账号空闲；sender 布局变化会在账号环境无活动作业时重建角色实例。
4. `POST /v1/messages` 在 Rust 协议改写之前交给二进制。普通 Messages API 与完整原生 293 输入沿各自构造合同处理。白名单过滤调用方头，运行时生成自身身份、上下文和 CCH。
5. 原生模型请求保持单次提交。上游错误返回本次调用方。账号空闲时选择“原有转发”可恢复 `legacy`。

首版使用 V3 账号 sender。原生进程只取得当前 bearer、设备和账号身份。refresh token 由网关持有。缺二进制、能力、资源或身份校验失败时返回准备错误。其余端点继续走现有发送方式。

共享池预算公式为 `256 + 192 × 2 × 标准并发` MiB。bench 的账号创建流程默认标准并发 4，对应最低 1792 MiB sender 预算；也可将该账号标准并发显式设为 3，使用已实测的 1536 MiB 配置。更高并发按公式及账号总 RAM 校验，满载资源仍需在部署环境实测。

## 共享映像与空闲回收

首个进程的实际执行映像经过长度、SHA256及四项封存核验后，由本账号池持有只读FD。后续进程从同一映像重新exec，并核对实际dev/inode；每个进程保留独立堆、SDK、HOME/config/cwd和作业根。额外进程空闲60秒后回收，保留一个暖进程，下一批请求按账号并发额度扩容。

## 私有协议

启动时设置 `CCRB_WORKER_ID`，使用私有 stdin/stdout JSONL。握手为 schema 2 `worker_ready`，并声明 `raw_input_protocol:1`。请求示例：

```json
{"type":"request_input","schema_version":2,"worker_id":"11111111-1111-4111-8111-111111111111","request_id":"request-001","input":{"schema_version":1,"request_id":"request-001","body":{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"测试"}]},"headers":[],"context":{}}}
```

二进制依次返回实际 `header_policy` 决策、`cc_prepared` 组装快照、响应头、base64 响应片段、唯一终态和匹配 `worker_idle`。组装快照是原生封口前值。只有终态及 idle 收齐后才复用进程。取消和通道错误退役进程，下一请求按需重建。

## 离线验收

```bash
# 真实 Rust 消费者、V3 内部 HTTP 和独立 TLS 上游
CCRB_TEST_CC2API=/绝对路径/cc2api \
CCRB_TEST_BINARY=/绝对路径/ccrb-runtime \
bun scripts/testing/cc2api-native.ts

# 干净固定镜像：独立二进制、无外网、有限 RAM
python3 scripts/testing/standalone-native.py \
  --binary /绝对路径/ccrb-runtime --output /新的验证目录
```

当前共享池在真实V3三角色、两账号、HTTP/SOCKS离线TLS场景中，分别完成3路普通和6路Haiku请求；29组场景全部通过。sender上限为1536 MiB，HTTP峰值676216832 B（约645 MiB），SOCKS峰值677347328 B（约646 MiB），OOM计数均为0。60秒空闲回收后，一个暖进程的sender占用为198385664 B（约189 MiB）。这些数字来自合成短请求，实际请求体量会影响堆和缓冲占用。

早期独立映像的干净Python夹具完成9次TLS实收，2432 MiB上限内峰值1631354880 B，包含TLS夹具和校验器。该批次记录保留在任务验收文件。运行时内存展开与分发文件体积分别统计。
