# 分阶段诊断现状与真实样本

## 采集链路
- `../vibecoding-bench/cc2api/src/service/native_runtime.rs:809-826`：实际接收 `header_policy` 决策并校验 name/action/reason，当前仅记数量。
- `../vibecoding-bench/cc2api/src/service/native_capture.rs:119-164`：debug 私有快照保存 cc_prepared 的有序脱敏头与正文，保留原始字节数、SHA256及截断状态。
- `../vibecoding-bench/cc2api/web/src/components/RequestDiagnostics.vue:195-211`：现有详情仅提供组装后内容。
- `src/shared/input.ts:29-31`：正文浅副本删除三个根本机设置字段，嵌套业务内容保持。

## 生产只读抽查
- 账号11-5，网关账号12，固定2.1.293，环境代次14，候选激活至beta.4。
- 12份已保存debug快照，头与正文均完整。22种头名一致；正文根字段为model/system/messages/max_tokens/stream/tools/safeguards/context_management/output_config/thinking/metadata。
- 子代理类型为subagent/custom，抽查billing的cc_is_subagent=true。父代理头缺失须标明来源未知；billing可选prompt缺失不能记作冲突。
- cch=00000属于组装前封口占位。最终TLS写出属于独立采集位置。
- 审查仅输出字段名和受控协议摘要，生产正文与凭据保持私有。

## 证据位置
完整脱敏字段汇总位于bench私有 `.deploy/system-update-migrations/production-22a0bd08/native-header-body-summary.json`。运行时审计位于US服务器固定部署操作目录。历史组装前删除明细按缺失处理。
