# 181秒断流与缓存TTL调查

## 生产观察
- US固定环境11-5，环境15551aa6f302494cb9b5440750899c2c，代次14，内核beta.4。
- 截图两条错误请求的准备分别206/65ms，均warm_hit=true，完整耗时181149/181077ms。网关收到body_error/upstream_body，status200且已有部分响应。
- 实际sender/network容器及原生进程环境均无显式超时覆盖。运行中的Hev使用2.15.0；实际hev.yml无timeout字段。固定标签源码TCP默认读写静默300000ms，连接10000ms；不是180秒总时限。
- 固定Hev源码：https://github.com/heiher/hev-socks5-tunnel/blob/2.15.0/src/hev-config.c

## 已复现根因
- 校验官方固定来源8968405e...后提取模块；api模块chunk-aqh2c7wz.js中的a7→o7→s7围绕fetchOverride设置首响应计时器。firstParty默认180000ms，加ceil(body_bytes/32768)*1000上传余量。
- 本项目generateNativeRequest的fetchOverride等待send回调；runNativeJob的send回调在实际响应到达后仍await released，整流收口才返回。实际Ree沿用了SDK的init.signal，因此首响应计时器误作用于已开始返回的响应流。
- 使用与生产相同SHA bc732aad...的beta.4，独立网络命名空间仅回环、自签TLS与合成代理/凭据，每秒发送一段SSE。短预算10000ms时56ms收头、11050ms报错；默认预算时46ms收头、持续181段、181039ms报错。每轮唯一提交，真实模型调用0。
- 修复版在固定官方来源+当前预加载代码下，原10秒预算的同条件流90ms收头，22099ms正常completed，唯一提交。最终候选长流验证继续记录在artifacts/native-stage-diagnostics-20261112。

## 缓存TTL
- 截图时段25条诊断中，所有实际出现的cache_write_1h_tokens为0；有写入的值均落入cache_write_5m_tokens，包括4108、3009及50。
- 最新20份完整cc_prepared预览均有4个ephemeral断点，ttl省略。官方省略TTL默认为5分钟；响应细分提供了实际写入证据。
- cc2api的cache_control_ttl_rewrite目前仅进入legacy rewrite_body_inner，native分支提前分流，固定worker的缓存布局策略为preserve。
- 增量方案：设置逐请求冻结到NativeSubmission，受信request_input同级字段传入新内核，在cc_prepared/Ree前覆盖已有协议范围TTL。关闭保持原值，5m/1h覆盖仅改TTL；旧内核缺少能力声明时明确拒绝强制模式。
