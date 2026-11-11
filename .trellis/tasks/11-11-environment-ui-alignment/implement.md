# 实施计划

1. 读取 bench 前端组件/状态规范、实际 DOM、样式和弹窗收口函数。固定三仓基线及原有 dirty 路径，记录主后台设计 token 与环境字段来源。研究预览使用合成数据。
2. 完成环境路由样式作用域、内层导航及页面布局；保留原路由和统一会话。实现账号状态/角色/资源摘要、搜索筛选、折叠详情和分组维护入口。
3. 调整内核面板，增加版本输入与目标确认弹窗，接入既有管理 payload、忙碌/失败/冲突与待对账状态。保持轮询、表单焦点、详情展开和导航异步归属。
4. 运行 node --check 以及合成浏览器场景：1280/720/390px，主后台嵌入、长 ID/摘要、空态/失败/未知、灰度外、三种内核操作和取消、迟到响应、轮询中编辑及切页清理。核对无自动写入和模型请求。
5. 完成 Check-All、规范评估与精确 Git 交付。生产部署单独遵循既有 CI/SOP；前端回退沿原批次与静态资源恢复。

## 实施记录

- 已完成独立环境脚本、作用域样式、模板与内核弹窗，公共时段表单在打开窗口时绑定，支持直接进入环境页。
- 已完成搜索/筛选/展开保留、只读进度轮询、请求序号与页面代次保护、冻结操作版本和提交去重。
- 定向验收：`node --check webui/app.js`、`node --check webui/environments.js`、`node --check webui/projects.js`、Python 语法检查与 `git diff --check` 通过。
- `python3 deploy/v3/verify_environment_ui.py --output .deploy/environment-ui-alignment/verification-final`：14 组真实浏览器场景通过，使用实际 gateway 静态产物和合成 API；实际模型请求为零。
- Check-All 完整检查通过，规范同步完成；下一步执行精确 Git 交付并同步任务完成态。
