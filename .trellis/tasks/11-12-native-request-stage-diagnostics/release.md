# 联合上线依赖与验收

## 当前交付状态
- 本轮代码及固定来源桥接候选处于本地验收阶段。线上11-5观测版本为beta.4、环境代次14。
- 官方来源继续固定2.1.293。最终候选两次独立构建一致：launcher SHA256 `64c61cae565e9097de18cf61a35f46e7595f633cb14f7d6b8c6609fcd294ce89`，27388048字节；实际映像SHA256 `af4cea9e21aa959c5e39c389173ba30ebb19b354b67acfe99164946450e9776d`，112839864字节。
- artifacts/native-stage-diagnostics-20261112/final-a与final-b保存候选。signed-fixture中的beta.5标签及随机密钥仅用于隔离验收。正式版本、签名和发布沿项目SOP分配。

## 后续授权上线顺序
1. 按正式发布SOP发布已验收SHA的新内核，保留原固定官方来源及可回滚附件。核对正式签名、公钥及最终下载制品。
2. 在旧平台激活新内核候选。记录当前/上一版、实际worker/PID及映像SHA，验证准备为零模型操作。
3. 安装同批宿主更新器。新更新器在环境重建前冻结实际CPU，并在升级及软件回滚后恢复；当前运行实例的CPU上调不能只依赖新平台读取策略文件。
4. 通过系统更新部署同批网关/sender与调度器/页面。新增私有采集与TTL字段由联合平台交付。现有summary_json和私有文件承载数据，本轮业务表结构保持。
5. 原生备用试点目前关闭。若后续授权启用，核对V3_NATIVE_PREWARM_ACCOUNT_ID=12及sender实际配置，再验证真实准备数量与开启状态。

## 上线后验证
- 责任：执行上线的主会话。只读核对正式制品SHA、平台镜像、宿主更新器源摘要和三角色归属；核对sender=1核、network=0.5核及CLI原额度、cgroup、启动时间和代次。
- 核对原生准备页面与实时sender快照一致。等待用户下一条正常业务，检查worker/PID复用、warm_hit、prepared_ms及阶段证据。实际时延以生产样本为准。
- 保持当前强制1h设置，读取新业务的cc_prepared TTL及响应缓存细分；预期已有ephemeral标记为1h。普通日志仅记录受控原因、关联标识及数字。
- 等待用户自然产生的长流，核对跨181秒完整收口或实际结束原因。隔离回环已经验证185秒持续流；生产代理与官方服务的可用性按新样本判断。
- 通过页面手动保存所需三角色CPU，读取实际额度与持久值；后续计划内重建/回滚核对保留情况。上线验证沿明确授权执行。

## 失败恢复
- 新内核激活失败沿既有排空、原内核真实准备和恢复门禁收口。未知结果保持reconcile。
- 新平台强制TTL要求worker能力cache_ttl_rewrite_protocol=1。回滚旧内核前先将cache_control_ttl_rewrite调整为off，并核对已生效。否则新平台明确拒绝强制模式。
- 平台失败按上一完整发行回滚；新宿主更新器按操作记录恢复原三角色实际CPU。私有快照新增字段可选，旧读者保持原读取合同。
- CPU接口更新失败核对原不可变容器并恢复原额度与策略；恢复未知保留reconcile操作记录。

## 本地验证证据
- /tmp/native-stage-final-{a,b}-build.log：两次最终构建；/tmp/native-stage-final-candidate-native.log与final-source-native.log：实际原生行为。
- /tmp/native-stage-final-rust.log：866项通过、8项条件跳过；policy-validation.log：新增无效TTL提前拒绝。
- /tmp/native-stage-final-python.log：184项通过；contract-focused.log：11项通过；review-cpu.log：36项通过；host-regression.log：15项通过。
- /tmp/native-stage-web-build.log、browser.log、environment-browser.log：前端构建及21个浏览器场景。
- artifacts/native-stage-diagnostics-20261112/evidence：旧版181秒复现、新候选185秒完整流、取消及31次联合业务的合成回环报告。全部使用合成凭据与本地上游。
