# 总体实施计划

1. 依次展示三个子任务的最新 Brief，已取得同一批材料的明确实施确认；各子任务按批准顺序激活。
2. 先激活 atomic-log-snapshots，通过 trellis-route 进入实现；测试、Check-All、Spec 与提交按所属流程推进。
3. 再依次激活 api-tool-prompt-id、api-disabled-thinking；同批已明确批准且材料范围未变时不重复询问同一决定。
4. 子任务分别验证，联合验证放在最后一项完成后的父级验收记录：普通/原生输入、六类上下文、off/verify、单次发送、TLS 实收与响应字节、日志读页。
5. 源码回归通过后构建最新 preload。更新本机 8787 时保留当前数据、代理和上游配置，继续开启 verify；读取页面不触发推理。
6. 如进行真实回归，先单独登记最多四次、max_tokens=128 的新账本，首错停止；新预算授权以本次展示材料的确认或随后明确授权为依据，不使用已耗尽旧账本。
7. 最终只对本轮任务及实际修复文件生成精确 Git 计划；父任务保留三项来源与验收，不接管其它脏文件。

## 联合验收记录

- 最新源码构建与预检通过，原版 SHA 和 TLS 辅助程序 SHA 保持固定。新 8787 服务 PID=273264；目录沿用 persistent-service，TLS verify 开启，遥测 off，总请求预算配置为 0。
- 211 项单元/集成、64 项普通/原生原版回归、42 项独立 TLS 测试均通过，0 fail。未开启专项的原版命令跳过 44 项；TLS 42 项已另行完整执行，不把 skip 算作通过。
- 四次真实新预算全部使用，max_tokens 均 128，JSON/SSE/工具两轮均成功。四次最终写出包含明确 disabled，响应无 thinking，未发生重发；工具两轮显式 promptId 相同，最终头与持久上下文一致。
- 只读浏览器看见全部四条新日志及完整 TLS 来源、SHA、刷出成功；历史 17 条逐项相同，总数 21，页面无异常。原配置和原 20 项脏文件未变；专用证据与当前实例 139 个文件无真实 Key。
- 三个子任务均完成实现、验证、Check-All 与 Spec，等待统一精确 Git 计划确认；尚未 add/commit/push，不将任务状态提前标为 completed。

| 验收 | 证据 | 结果 |
| --- | --- | --- |
| A1 日志并发与回滚 | storage 两条新增回归，控制层日志故障/锁等待，final-unit-integration.log | 通过 |
| A2 工具续轮及六类上下文 | native.test.ts 八条归因回归，TLS off/verify 六类独立实收，真实工具两轮 | 通过 |
| A3 显式 disabled 与默认/原生保真 | thinking-final-report.json，final-tls-report.json，live-report.json | 通过 |
| A4 单次发送与最终哈希 | 独立 OpenSSL 实收实体/HTTP SHA，原生 CCH，off unavailable | 通过 |
| A5 有限真实验证及页面/历史 | live-ledger.json、browser-audit.json、history-audit.json、secret-scan.json | 通过 |

原始完整证据位于 artifacts/api-integrity-20261107T143214420014Z；真实预算已耗尽，不为补证据再调用。现有 temperature、强制工具的通用兼容与旧连接偶发异常仍属于本轮排除范围。
