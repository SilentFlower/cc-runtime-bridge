# 会话与实现证据

- 最近项目会话：01a1c944-f680-7722-bcad-11ced376f8f6，最近两条缺口均CAPTURE_PREPARING；由原始对话和native Codex read_thread交叉核对。
- 关联仓native_runtime.rs:841-851：worker.ready_at在TLS预备前记录，slot.warm启动后立即返回。
- native_tls_observer.rs:89-144：后台tokio任务启动探针；take立即返回ready或当前reason。
- native_runtime.rs:1395起：prepare持有原warmup写锁并从同一checkout获取worker；start_spare在Worker::start返回后放入idle。
- 同文件submit_validated先等待后台准备，再checkout；取消后的物理进程和探针沿Drop/retire收口。
- 本仓native/tls-observer/README.md:48及logging-guidelines保留首次冷worker可CAPTURE_PREPARING的旧说明。本轮需以正常后台就绪路径和真实故障分别限定合同。
- 关联仓HEAD=e62d82926937be1cb9bf5b9a0f1f66a213f959c4；本仓HEAD=7cfe8b3734111dae4758a7e2006f43e5f1cc71e9。

## 已执行的回归

- 慢探针的交接回归在旧异步立即返回语义下失败，新增有界就绪交接后通过。
- 原生TLS回环9次合成请求：6worker并发、1次慢流取消、同身份零模型准备后连续2次请求；完整实体与TLS实收摘要核对通过，替换PID与原PID不同。
- 第一次扩展验收在取消后立即断言proc目录消失时失败；回收与proc可见性采用同一有界退出等待后通过，原失败日志原样保留于runtime。

- 最终Rust全量回归采用RUST_TEST_THREADS=4，791项库测试与85项集成测试通过；8项原环境依赖项保持显式ignored。默认并发的先前回归出现SQLite锁与本地接收超时，失败日志保留，限并发复查通过。
- v1.1.2两镜像实际候选构建完成，manage.inspect_images核对通过。账号候选隔离验收退出0、OOMKilled=false，六worker完整、512KiB及4MiB以上实体SHA一致、握手投影一致、真实模型请求0。
- 实现保留原prepare和20秒巡检协调机制；新进程初始化和复用checkout交接有界等待TLS就绪。取消后的补热沿原零模型prepare路径，业务最多一次提交。

- 最新源码的完整原生离线回归通过，两个真实测试共28次模拟请求、并发峰值6；随后最新TLS专项再次通过，9次模拟请求、并发峰值6。真实模型请求增量0。
- 关联平台业务源码0fad8e42e896d16a237695d29c13f24dccf83b1b的构建43247609752成功，手动发行运行43249142781已按同一源码启动。

## 正式发行验收

- v1.1.2发行system-ci-43249142781-1成功，来源0fad8e42e896d16a237695d29c13f24dccf83b1b。
- 使用既有宿主策略公钥独立验签通过；6个公开附件的大小和SHA、两角色GHCR仓库及配置摘要、八来源双库演练全部核对。
- updates/v3-migrations推进到51439fb09392e9c6ace48ec63ef3ac159d744af7，序号[207,1]；旧v1通道按原[196,1]及原发行集合续签。
- 发布地址：https://github.com/SilentFlower/vibecoding-bench/releases/tag/system-ci-43249142781-1。
