# 原生TLS写入边界预研

## 已验证事实
- 在仅回环网络、合成凭据的实际beta.5进程完成worker_ready后，检查/proc/PID/exe。
- readelf --dyn-syms和--symbols均未找到SSL_write、SSL_read及SSL_CTX_set_keylog_callback等入口。
- 动态依赖仅为librt、libc、ld-linux、libpthread、libdl、libm，没有动态libssl。
- 本次模型请求0。原始有界结果位于gitignored .trellis/.runtime/native-tls-symbol-inspection.json。
- 构建配方复用固定官方程序中的Bun内核。清单Bun revision eecfd55debb281c3fe3518098b1a49f76429637c在公开oven-sh/bun仓库查询返回404；公开bun-v1.4.3标签为c6da4a4d3010e5553438c60f6bd76d981976867c，不能用其符号地址直接充作当前执行体证据。

## 技术门槛
- 通用动态库拦截缺少直接入口，需要核对固定映像的可定位函数和实际覆盖路径。
- 可行性验证必须使用最终固定SHA的真实进程及回环TLS实收。任何只观察组装值或替换TLS的方案不满足本需求。
- 固定偏移探针的宿主能力、稳定性、覆盖（write/部分写入/取消/连接复用）及开销仍待验证。

## 组装记录建议
- 保留组装阶段的来源、归属、哈希及现有诊断能力；最终写出作为核对实际发送的证据。
- 字节一致时可复用正文。CCH封口导致字节变化时须按真实差异保存，不能称两份正文相同。

## 参数入口验证
- SSLKEYLOGFILE环境变量：干净无外网容器9条合成业务通过，未生成指定密钥文件。
- BUN_OPTIONS=--tls-keylog=...：同条件另9条合成业务通过，未生成指定密钥文件。
- 这些结果只描述本次固定构建及调用路径。不能按公开Bun同版本号宣称当前构建具备密钥导出能力。
- 实际映像含SSLKEYLOGFILE与tls-keylog字面量，但字面量存在不等于有效采集入口。
- 本地/sys/kernel/btf/vmlinux及tracefs的uprobe_events存在；探针注册、权限与稳定性尚待独立技术准入。生产宿主能力未核对。

## 已通过的真实写入验证
- 实际映像固定SHA af4cea9e21aa959c5e39c389173ba30ebb19b354b67acfe99164946450e9776d。SSL_write入口0x252e550，返回前0x252e5b3，文件偏移0x232d5b3。
- GDB定位及libbpf只读uprobe两种验证均得到30,418字节，与同次独立TLS实收逐字节相等；每轮仅1次合成模型HTTP提交，真实模型0。
- 采集开关ClientHello完整协议投影一致，JA3 1523504b38f0fae0d881d4b6554aac1b；另外逐项比较了扩展顺序及非随机载荷、签名、key_share组与长度、ALPN。
- 原始隔离工装与私有合成证据位于artifacts/native-tls-write-copy-{on,off,bpf}-20261112。GDB采用断点，产品形态采用PID限定eBPF。

## 异步验证补充
- 每物理worker后台预备一个单次采集器，模型投递只即时take。首条冷进程允许CAPTURE_PREPARING，已就绪的六PID并发回环均完整。
- 高并发时同步卸载超过原250ms窗口，收口改为后台2秒期限；初始保存改record_queued，模型不等待磁盘。
- 每worker一个在途启动，取用期间的迟到结果释放；退役用AbortHandle取消。实际慢启动文件屏障、退出取消与同请求后台保存有专项测试。
- 独立capture_id和业务request_id分别绑定。两种ID在真实六PID快照中分别存在，客户端请求头和实际TLS实体SHA一致。
