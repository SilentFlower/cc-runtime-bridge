/** JSON 对象，解析和验证由共享入口统一负责。 */
export type JsonObject = Record<string, unknown>;

/** 保留头名、大小写和重复项的输入表示。 */
export type HeaderPair = [string, string];

/** 固定 293 已识别的请求类别。 */
export type RequestClass = 'main' | 'subagent' | 'workflow' | 'compaction' | 'auxiliary' | 'side_reply';

/** 一个 API 消息，不把用户工具转换为本地可执行工具。 */
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | JsonObject[];
}

/** 首版能够适配的 Messages API 参数。 */
export interface MessageBody {
  model: string;
  messages: ApiMessage[];
  system?: string | JsonObject[];
  tools?: JsonObject[];
  tool_choice?: JsonObject;
  max_tokens?: number;
  thinking?: JsonObject;
  temperature?: number;
  output_config?: JsonObject;
  stream?: boolean;
}

/** 调用方可以显式提供的关联信息。 */
export interface ContextInput {
  requestClass?: RequestClass;
  sessionId?: string;
  promptId?: string;
  agentId?: string;
  parentAgentId?: string;
  agentType?: string;
  agentKind?: 'main' | 'subagent' | 'teammate';
  workflowRunId?: string;
}

/** 经验证的内部调用，不允许头部改变控制配置。 */
export interface BridgeInput {
  schema_version: 1;
  request_id: string;
  body: MessageBody;
  headers: HeaderPair[];
  context: ContextInput;
}

/** 已解析的调用上下文，各表示都以此为同一来源。 */
export interface RequestContext {
  requestClass: RequestClass;
  sessionId: string;
  promptId: string;
  agentId?: string;
  parentAgentId?: string;
  agentType?: string;
  agentKind: 'main' | 'subagent' | 'teammate';
  workflowRunId?: string;
  querySource: string;
  source: 'client' | 'bridge-default';
}

/** 可供日志和页面直接展示的头部处理结果，不记录秘密值。 */
export interface HeaderDecision {
  name: string;
  action: 'keep' | 'drop' | 'runtime' | 'context';
  reason: string;
}

/** 策略结果，运行时不会再从任意头中读取配置。 */
export interface PreparedInput {
  input: BridgeInput;
  context: RequestContext;
  headers: HeaderPair[];
  decisions: HeaderDecision[];
}

/** 请求及流的终态。 */
export type RequestState = 'queued' | 'running' | 'success' | 'http_error' | 'stream_error' | 'incomplete' | 'canceled' | 'error';

/** 采集来源，与传输是否完成分开记录。 */
export type CaptureStage = 'ingress' | 'header_policy' | 'cc_prepared' | 'wire_final' | 'upstream_response';

/** 阶段持久记录；哈希对应原始观测字节，内容为脱敏后的预览。 */
export interface CaptureRecord {
  stage: CaptureStage;
  attempt: number;
  capturedAt: string;
  source: string;
  representation: string;
  status: 'complete' | 'truncated' | 'unavailable' | 'failed' | 'incomplete';
  observedBytes: number;
  storedBytes: number;
  sha256: string | null;
  text: string | null;
  headers: HeaderPair[];
  note: string | null;
}

/** 一个请求的列表行及发生时的运行快照。 */
export interface RequestRow {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  model: string;
  requestClass: string;
  sessionId: string;
  promptId: string;
  agentId: string | null;
  parentAgentId: string | null;
  state: RequestState;
  httpStatus: number | null;
  durationMs: number | null;
  headersMs: number | null;
  firstOutputMs: number | null;
  mode: 'off' | 'summary' | 'debug';
  engine: string;
  binarySha256: string | null;
  error: string | null;
  captureError: string | null;
}

/** 详情接口一次返回可审计的字段与阶段数据。 */
export interface RequestDetail {
  request: RequestRow;
  context: RequestContext | null;
  decisions: HeaderDecision[];
  captures: CaptureRecord[];
}

/** 查询列表时支持的服务端过滤参数。 */
export interface LogFilters {
  requestId?: string;
  model?: string;
  state?: string;
  requestClass?: string;
  sessionId?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/** 控制进程与固定运行时之间的消息。 */
export type RuntimePayload =
  | { type: 'ready'; version: string }
  | { type: 'cc_prepared'; attempt: number; headers: HeaderPair[]; body: string; body_bytes: number; body_sha256: string }
  | { type: 'response_headers'; attempt: number; status: number; headers: HeaderPair[] }
  | { type: 'response_chunk'; attempt: number; data_b64: string }
  | { type: 'completed'; attempt: number; state: RequestState; error?: string }
  | { type: 'error'; error: string; code?: string; status?: number };

/** 每条运行时消息都绑定请求，stdout 不混入普通日志。 */
export type RuntimeEvent = RuntimePayload & { schema_version: 1; request_id: string };

/** 控制进程交给独立工作进程的一次作业。 */
export interface RuntimeJob {
  type: 'request_start';
  schema_version: 1;
  request_id: string;
  prepared: PreparedInput;
}
