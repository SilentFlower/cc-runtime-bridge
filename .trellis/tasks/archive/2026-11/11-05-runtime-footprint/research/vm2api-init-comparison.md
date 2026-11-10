# vm2api 构建与初始化对照

## 对象与结论

本次测量对象为本机 `/root/project/vm2api/share/wrap-cli/cli-node`，SHA256 为 8484c4c58f4b7782a190f7cab7c8aa5d1f706ae26b2d2a5cafe81af070f0611b，与 deploy/arm64-cli.json 的输入身份一致。程序自报 Claude Code 2.1.303，实际内嵌 Bun 版本探针为 1.3.14；不能以版本字符串证明它等同官方发行程序。

它采用单 JS 应用包的 Bun 可执行构建，再经 UPX 压缩；原生循环有专用启动分支，一个常驻进程内提供 20 个逻辑槽位。较慢的可执行解压和解析成本在新进程启动时支付，后续 job_start 复用同一进程。

上一版方案只围绕原版二进制裁剪设定 140 MiB 目标，未先实测这个构建及进程复用差异；用户已否定，不能沿用该目标或依据该方案开工。

## 体积与嵌入结构

| 对象 | 字节数 | MiB |
| --- | ---: | ---: |
| vm2api 当前压缩版 | 27933052 | 26.64 |
| 同一文件经 UPX 解压 | 118306944 | 112.83 |
| 解压文件的 `.bun` 应用区 | 24680029 | 23.54 |
| 从该区核对的单份 JS | 24679899 | 23.54 |
| 本项目固定官方 293 | 252755128 | 241.05 |
| 固定官方 293 的 `.bun` 应用区 | 163574530 | 156.00 |

vm2api 的应用区除这份 JS 仅多 130 字节的布局开销，没有空间容纳原版那种约 104 MiB 的额外应用字节码及专用共享表。这是产物层面的结构对照，不代表已取得完整 amd64 构建命令，也不证明两个版本具有完全相同功能。

vm2api 的 deploy/build-native-cli.py:40-52 也定义了从 UPX 解包产物中定位 runNativeMessagesLoop、提取单份 JS 并核对源哈希的流程；本次取得的源码摘要为 ced77bcd9639314e6f277c23d91c98f5e178add7eb1eb93538d51ad1cb500830，与固定清单一致。专有提取源码保留在临时研究目录，没有收入仓库。

## 实际启动路径

- 提取文件的 main2（701002 行）先处理版本查询，再检查 NATIVE_SLOTS。设置该项时，只启用配置并进入 runNativeMessagesLoop，提前返回，不进入常规 CLI 主界面初始化。
- runNativeMessagesLoop（627422 行）在一个 Map 内创建槽位，先发 host_ready，再依次发出 20 个 slot_ready。
- stdin 接收 job_start、cancel、ping 等帧，后续任务通过已有槽位调用 runJob。六次任务期间子进程 PID 不变并保持存活。
- 20 个 slot_ready 是逻辑协议就绪，不代表 20 个独立 CC 进程、20 份完整 SDK 预热或已经连接真实模型。首次实际请求另外测量。

项目侧对应证据为 src/lib/transport/rust-kernel-supervisor.mjs:103-105 的预开槽位配置、:850-853 的 local_cli 与 slots_per_worker，以及 docs/INFERENCE.md:10、:40 的说明。test/e2e/cli-hop-max-tokens.e2e.test.mjs 提供了相同的环境开关和 job_start 协议；本次未调用其真实服务入口。

## 测量方法

- Linux x64，同机顺序测量压缩版与解压版，各五个新进程，没有并行压缩任务。
- 整个测试脚本在新的 `unshare --net` 中运行，仅启用该命名空间回环接口。
- 每个进程使用新 HOME、配置目录及环境白名单，只有合成 API key，本地 HTTP 上游立即返回合成 SSE。
- 程序不带额外启动参数，设置 CLAUDE_CODE_NATIVE_SLOTS=20；从 Popen 前开始计时，到收到全部 20 个不同槽位的 slot_ready 为止。
- 同一进程再顺序完成六次 job_start：首轮单列，后五轮统计复用中位数。每轮均收到文本及 job_done，且模拟上游仅收到一次模型请求。
- 文件页缓存未清理，因此是新进程启动对照，不是冷磁盘或整机启动基准；不包含 Docker/VM 开机、Rust 控制面代理、外网或模型生成时间。

## 实测结果

| 指标 | 当前压缩版 | 同文件解压版 |
| --- | ---: | ---: |
| `--version` 五次中位数 | 2.531 秒 | 0.597 秒 |
| 20 槽协议就绪五次中位数 | 3.024 秒 | 0.912 秒 |
| 20 槽协议就绪最小至最大 | 2.836–3.818 秒 | 0.780–1.028 秒 |
| 就绪后首轮模拟请求中位数 | 129.483 毫秒 | 96.656 毫秒 |
| 就绪后复用模拟请求中位数 | 13.876 毫秒 | 12.213 毫秒 |
| 五次观测到的最大就绪峰值 RSS | 228.92 MiB | 206.77 MiB |

两组各五个进程均成功，总计 60 次本地合成模型请求。模拟响应没有模型计算和公网延迟，不能将约 14 毫秒宣传为真实模型响应速度。

上一轮原版 0.1491 秒是五个内嵌模块导入探针，不是相同的 native_messages 协议就绪指标，不能与本表直接比较。

## 保存的证据

- vm2api-comparison/study.json：固定产物、解包及源文本摘要。
- vm2api-comparison/runtime-version.json：内嵌 Bun 版本及原文件实验后哈希，确认未覆盖原安装。
- vm2api-comparison/benchmark-results.json：全部独立样本、握手、首轮/复用请求、单次发送计数和 RSS 记录。
- vm2api-comparison/benchmark.py：本次临时研究脚本快照；ROOT 为本次临时目录，不是通用产品脚本。复现须准备相同固定输入和 study.json，始终在新的网络命名空间运行。

实际测量命令为：

```bash
env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/unshare --net /usr/bin/python3 /tmp/ccrb-vm2api-study-542b7872/benchmark.py
```

本次未修改 vm2api、宿主账号或本项目运行代码。用户随后已确认将常驻复用纳入，主要目标为磁盘体积及速度达到本标杆；最新范围与隔离设计见本任务三件套。不能把 vm2api 的定制入口直接视为当前固定官方 293 的兼容实现。
