# 原生 TLS 接受边界采集器

此目录提供 Linux x64 的 PID 限定 eBPF 旁路观测。原生运行时继续拥有 TLS 握手、HTTP 字节及唯一业务提交。探针在固定 `SSL_write` 共同返回前读取正返回值对应的明文副本。

已准入执行体为 beta.5，SHA256 `af4cea9e21aa959c5e39c389173ba30ebb19b354b67acfe99164946450e9776d`。文件偏移 `0x232d5b3`，指令片段 `4883c4185b415c415d415e415f5dc3`。ABI：RBX 为 SSL 对象，R14 为缓冲地址，R15d 为提交长度，EAX 为实际接受长度。新映像需要重新完成来源、ABI、回环实收及握手对照准入。

## 构建与启用

```bash
python3 native/tls-observer/build.py
python3 -m unittest discover -s native/tls-observer -p 'test_*.py'
```

构建机使用 clang 和 Linux UAPI 头。运行机使用 Python 3.11+、libbpf.so.1、支持 BPF ring buffer 与 PID 命名空间查询的 Linux 内核。实际准入需通过 perf/BPF、读取目标执行体及用户内存所需权限和安全策略检查。容器宿主权限与生产启用独立走上线授权。

在 Rust sender 的受控启动环境中设置 `CCRB_TLS_OBSERVER` 为 `observer.py` 的绝对路径，保持该文件、同目录 Python 模块和 `capture.bpf.o` 的可信文件权限。已配置私有采集目录时，sender 为每个已验证物理worker后台预备一个单次采集器。debug作业即时取用就绪实例。准备中记录CAPTURE_PREPARING，业务继续投递。启动和收口各自有2秒后台期限，退出回收等待上限25ms。初始和最终文件在后台写入，文件保存使用两个许可及250ms结果等待。缺配置、权限、未知映像或帮助进程失败通过阶段原因显示。

## 私有协议

- 启动参数：`--pid`、`--image`、`--worker`、`--capture`，分别为直属 worker 的实际 PID、精确执行体 SHA、物理 worker ID 和独立采集代次 ID。采集器校验实际 PPID、执行体及固定指令后附着，返回 `schema_version=1,ready=true` 及相同归属。
- sender 收到 `cc_prepared` 后保留其唯一 `x-client-request-id`。在实际响应头到达或取消收口时发送一行 `{capture_id,client_request_id}`。
- 返回对象固定来源 `native_tls_uprobe`、表示 `http_entity_from_tls_accepted_write`，包含实际有序头、实体预览、完整性、实体字节与SHA、整体HTTP字节与SHA、worker/PID、SSL连接及接受次数。`flushed=null`，表示网络刷出证据独立。
- 只处理有唯一 Content-Length 的 HTTP/1.1 `POST /v1/messages`。未知协议、歧义长度、额外字节及错误归属按缺证收口。部分实体与事件丢失的全量摘要和范围均为 null。
- 每事件最多16KiB、非阻塞ring 4MiB、最多8条SSL连接、头128KiB、每连接正文预览2MiB。独立内核计数核对接受次数、总字节、丢弃、读取失败和超限。正文全量哈希按实际事件增量计算。
- PID通过实际命名空间dev/inode查询，不把宿主TGID冒充容器PID。帮助进程只通过私有管道交付原文。Rust持久化前统一注册秘密、脱敏并应用共同2MiB预算。
- 复制和哈希前按本次Content-Length限定实体范围。同连接后续请求的字节直接丢弃，并保留HTTP_EXTRA_BYTES原因。事件序号缺口后停止本代全部连接解析；最终对账故障会清空头与正文预览，避免跨缺口拼接留下凭据片段。Rust保存层对非HTTP_PARTIAL的不完整证据再次清空原文，截断状态明确记录。

关闭或杀死帮助进程将释放探针、映射及文件描述符。业务由原有worker继续执行。取消守卫使用旧作业的固定ID收口，完整证据优先于迟到的初始快照或缺证回执。

## 异步与准备缺口

每个worker最多一个在途预备。业务取用时的迟到启动结果会释放。worker退役直接取消在途启动并关闭就绪帮助进程。完整TLS实体收口后可在响应流期间预备下一份，worker_idle合并补偿。首次冷worker和连续快速请求可能取得CAPTURE_PREPARING。

初始快照返回queued并记录CAPTURE_PENDING；后台按真实request_id、worker及binding_generation原子更新。最终完整证据优先于迟到初始写入。保存失败按固定原因和作业标识记录安全日志。页面按相同尝试有限重读，关闭或换请求通过取消代次作废旧结果。

采集器私有帧使用schema_version=1和capture_id。实际业务request_id由sender拥有，并通过cc_prepared中唯一x-client-request-id绑定实收HTTP。TLS接受完整性、网络刷出及上游实收分别表示。
