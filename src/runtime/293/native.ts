import type { JsonObject } from '../../shared/contracts';

/** 固定 293 的内部消息实体最小接口。 */
export interface NativeMessage {
  type: string;
  message: { role: string; content: unknown; model?: string };
  promptId?: string;
  turnOrigin?: string;
}

/** 来自已核对内嵌模块的消息工厂与查询入口。 */
export interface NativeCore {
  /** 创建用户消息。
   * @param value 官方工厂参数。
   * @return 官方消息实体。
   */
  Re(value: JsonObject): NativeMessage;
  /** 创建助手消息。
   * @param value 官方工厂参数。
   * @return 官方消息实体。
   */
  Kc(value: JsonObject): NativeMessage;
  /** 执行官方构造流程。
   * @param value 已核对的查询参数。
   * @return 官方异步事件序列。
   */
  K_t(value: JsonObject): AsyncGenerator<unknown>;
}

/** 原生 SDK 及唯一默认发送入口。 */
export interface NativeApi {
  /** 创建官方 SDK。
   * @param value 上下文及发送选项。
   * @return 支持原始 Response 的官方客户端。
   */
  yN(value: JsonObject): Promise<{ beta: { messages: {
    /** 创建唯一原生消息请求。
     * @param body 官方构造的正文。
     * @param options 请求取消及头部选项。
     * @return 可取得原始响应的请求。
     */
    create(body: JsonObject, options: JsonObject): {
      /** 取得原始响应，交给桥接器独占读取。
       * @return 上游逻辑响应。
       */
      asResponse(): Promise<Response>;
    };
  } } }>;
  /** 经官方原生传输发送。
   * @param input 上游地址。
   * @param init 原始请求参数。
   * @return 上游原始逻辑响应。
   */
  Ree(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/** 原生会话使用的项目目录。 */
export interface NativeProject { originalCwd: string; projectRoot: string; cwd: string }

/** 只声明本项目确实读取的原生会话字段。 */
export interface NativeSession { host: unknown; id: string; project: NativeProject | null }

/** 固定 293 根会话工厂和作用域读取器。 */
export interface NativeState {
  /** 读取当前异步作用域的会话。
   * @return 当前原生根。
   */
  F(): NativeSession;
  /** 创建独立账本、请求日志和临时状态的根会话。
   * @param value 已有账号 host、本轮 ID 与项目目录。
   * @return 全新原生根。
   */
  nEr(value: { host: unknown; id: string; project: NativeProject | null }): NativeSession;
  /** 注册异步上下文读取器。
   * @param getter 返回当前会话的读取器。
   * @return 无返回值。
   */
  yLs(getter: () => { session: NativeSession } | undefined): void;
  /** 设置本轮会话关联。
   * @param id 本轮会话 ID。
   * @param transition 已验证的迁移类型。
   * @return 无返回值。
   */
  t_(id: string, transition: string): void;
}

/** 原版预加载与精简静态入口共享的原生绑定。 */
export interface NativeBindings {
  core: NativeCore;
  api: NativeApi;
  state: NativeState;
  context: {
    /** 完成官方配置初始化。
     * @return 初始化收口。
     */
    Nst(): Promise<void>;
  };
  permissions: {
    /** 创建官方空权限上下文。
     * @return 原生权限对象。
     */
    su(): unknown;
  };
}
