# 实施计划

- [x] 取得本批 Brief 批准并完成日志子任务后，读取最新 NativeMessage 与官方 ZQ/oze/uVe 定义和现有六类用例。
- [x] 新增完整工具历史 Prompt ID、显式复用/自动生成、混合块、无可归属轮次的实际原版回环断言。
- [x] 修复 cli.ts 中归因位置；验证工具结果、消息内容、提醒与原生 CC 保真均不被改写。
- [x] 构建 preload；使用无外网原版回环完成普通/原生、六类、off/verify；类型检查与构建通过。
- [ ] 按质量与完成链更新规范、记录独立提交范围；真实重测留到最后一个子任务联合进行。

## 回滚

只回退本项的归因位置、相应测试和 API 文档。保留原版身份、其它子任务修复和原有脏文件。

## 执行记录

- 原实现新增八个归因测试中六个失败、两个子代理父 prompt 回退场景通过；主/压缩/辅助/侧答与混合结果均证实缺头，无用户历史原先错误放行。
- 归因修复后定向测试 8 pass；env -i + unshare 下原版完整回归 64 pass、38 skip、0 fail，退出 0。原始输出：artifacts/api-integrity-20261107T143214420014Z/prompt-native-full.log。
- 独立 OpenSSL/TLS off/verify 各覆盖六类，12 次实际回环接收，2 pass、34 filtered、0 fail；报告 prompt-tls-report.json。其间曾把 verifyCch 的对象回执误断言为 boolean，已按实际定义修正测试，未产生真实上游调用。
- 类型检查、构建（原版脚本内）、diff 检查通过；full Check-All 三维通过，CHK=0、FBK=0、DOC=0。Spec written 记录于 runtime-contract.md。
- 三项均已获同批确认，本项保持 in_progress 等统一精确 Git 计划，继续 disabled thinking 子任务。

- 本批最终联合回归通过：211 项单元/集成、64 项原版及 42 项独立 TLS；四次真实 API 均成功，历史 17 条保留，21 条日志页面正常。证据目录：artifacts/api-integrity-20261107T143214420014Z。等待统一 Git 确认，尚未提交。
