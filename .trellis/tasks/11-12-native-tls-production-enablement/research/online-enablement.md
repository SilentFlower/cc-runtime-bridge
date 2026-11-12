# 10-30临时启用记录

## 运维边界

用户明确要求先开启10-30。生产变更限定该环境的sender容器、对应sender_container_id登记及受保护的采集器目录。网络/CLI角色、账号指纹、环境代次和当前内核选择保持原值；模型验收采用用户自然流量，隔离测试仅用合成凭据。

## 恢复材料

- 服务器运维目录：/opt/vibebench-v3-us/operations/native-tls-10-30-live-20261112。
- before-container.json保存原容器完整配置，activation.json保存新旧容器ID及操作阶段，原容器以-before-tls后缀停止保留。
- 原sender已有CapDrop ALL，业务用户1001。临时容器的能力边界仅增加SYS_ADMIN，固定file-capability启动器只执行经过SHA校验的观察器。观察器在附着后、ready之前清空全部能力。seccomp按原零能力画像展开，仅追加bpf/perf_event_open；业务进程有效/ambient能力均为零。
- 临时容器NoNewPrivs策略与原部署存在差异。正式方案须在设计和权限验收中明确处理，不能把临时配置当成通用发布能力。
- 临时文件绑定及Python受控入口不在正式联合镜像中，重建/系统更新可能恢复默认；本规划任务承担持久化接入。

## 证据

- probe-result.json：隔离真实内核挂点就绪，业务UID1001、有效/ambient能力为零，观察器ready后有效/ambient能力为零且NoNewPrivs=1。
- tls-verification.json、large-512k-verified.json：独立TLS接收器核对全量实体SHA，实际付费模型调用为0。
- large-probe-applied.json：六档解析容量通过；最大一次接受量8MiB、ring16MiB。超限仅使采集缺证。
- natural-capture-verified.json：真实自然请求完整证据。
- final-verification.json：正式私有读取接口验收结果。
- active-observer-manifest.json：最终启用文件的摘要。
- 临时计数采集在验收后关闭；请求正文及头值仅保留在原有受控快照与私有采集协议中。

## 11-5临时接入与正式读取验收

- 环境15551aa6f302494cb9b5440750899c2c，bench账号14、网关账号12、代次17；同批镜像和固定beta.5，账号采集策略已为true。
- 运维目录`/opt/vibebench-v3-us/operations/native-tls-11-5-live-20261112`保存原容器、切换回执及完整恢复点。独占租约释放完成。
- 自然attempt `949a3cd0-c602-46d5-8ac9-66f41ee51798`，captured_at_ms=1794467642072，实体5,740,091字节，PID15，source=native_tls_uprobe，status=complete。
- 实体SHA256为`bd94168a1bfdf3fac00e301fedc6d32be9e0997548a9bebd2303b7494f39c67b`。正式私有读取接口返回200；安全元数据保存于该运维目录`final-verification.json`。

## 最新默认策略决定

- 用户明确要求默认开启。统一解释缺字段为开启，显式false保留关闭，环境卡作为自助关闭/重新开启入口。
- 全局debug及原有脱敏预算独立保留。能力就绪与单次证据完整性分别展示。

## 永久实现的隔离门槛

- 本地生产等价账号基镜像，容器仅SYS_ADMIN/SETUID/SETGID、NoNewPrivs=1。固定入口派生UID1001、CapEff=0业务；observer附着后能力清零。完整真实beta.5回环通过。
- 512KiB和4MiB以上实体/HTTP SHA与独立TLS接收器一致，六worker并发采集完整；开关ClientHello协议投影一致，真实模型0。初轮夹具768MiB不足以承担六worker；按既有1536MiB部署预算通过。最终候选镜像将使用相同入口复验。
- `/tmp/native-tls-broker-integration.log`保存安全摘要；`/tmp/native-tls-rust-loopback.log`保存实际Rust六PID→Python读取验收，峰值并发6。
- 浏览器18场景通过，覆盖默认开启、取消零写入、关闭再开启、五种能力状态及390px，模型0；结果`/tmp/native-tls-environment-ui/results.json`。
- 动态就绪继续使用既有异步预备与批量巡检。维护锁及独占租约内只核对实际配置；实际ready由后续同代次巡检发布，避免反向查询与维护锁互等。
