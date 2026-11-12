# 纳入任务的预热与准备状态调查

## 用户范围决定
用户确认将热池失效、准备状态接口、并发备用策略合并到11-12-native-request-stage-diagnostics。

## 首次业务失效路径
- 原生beta.4激活完成于2026-11-12T00:33:44.988Z，握手回执PID9，绑定代次14。
- 首条业务开始于00:35:28.861Z，sender配置修改于00:35:29.064Z；请求实际使用PID17/23，本地准备6503/11390ms。
- create_environment初始化quota_identity为空。existing_transport和候选probe保持该观察字段。transport首次业务补写权威额度身份。
- pool_identity序列化整个SenderConfig，quota_identity参与复用标识。checkout在标识变化时退役旧空闲进程并进入准备路径。
- 上述路径已使用实际Python transport方法和实际Rust池方法在隔离副本复现。Rust定向测试1 passed，0 failed；生产时序与该路径一致。

## 页面待检查
- 网关/admin/native-preparations返回数组，实际Cc2ApiClient._request仅接受dict。数组被拒绝，native_preparation_snapshots捕获错误返回空字典。
- 环境投影因此返回unknown/binding_unverified。同一时刻sender实时读取为ready、代次14、beta.4。
- 实际Cc2ApiClient配合回环HTTP合成数组已复现“cc2api响应必须是JSON object”。

## 并发备用
- 生产V3_NATIVE_PREWARM_ACCOUNT_ID为空，native_adaptive_prewarm=false。并发扩容三次本地准备为12452/12399/8156ms。
- 稳定阶段100条样本全部命中暖进程，prepared_ms中位数88、P95为222，checkout等待为0。
- 本次调查与离线复现的模型请求数为0。

## 私有证据
bench的.deploy/system-update-migrations/production-22a0bd08/prewarm-root-cause.json、quota-pool-repro.log、quota-transport-repro.json。生产私有操作目录另存配置时间线及新鲜状态。业务正文和凭据保持私有。
