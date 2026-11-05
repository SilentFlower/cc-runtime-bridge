import type { HeaderPair, RuntimeEvent, RuntimeJob, RuntimePayload, WorkerCommand, WorkerFrame } from './contracts';
import { BridgeError, isObject } from './errors';

function headerPairs(value: unknown): value is HeaderPair[] {
  return Array.isArray(value) && value.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string');
}

/** 解码私有工作进程事件，避免各消费者分别猜测字段。
 * @param line 完整 JSONL 行。
 * @param requestId 期望绑定的请求。
 * @return 经过边界验证的事件。
 */
export function decodeRuntimeEvent(line: string, requestId: string): RuntimeEvent {
  return validateRuntimeEvent(JSON.parse(line), requestId);
}

function validateRuntimeEvent(value: unknown, requestId: string): RuntimeEvent {
  if (!isObject(value) || value.schema_version !== 1 || value.request_id !== requestId || typeof value.type !== 'string') throw new BridgeError('runtime_protocol', '运行时消息与请求不匹配', 502);
  let valid = false;
  switch (value.type) {
    case 'ready': valid = typeof value.version === 'string'; break;
    case 'cc_prepared': valid = value.attempt === 1 && typeof value.body === 'string' && headerPairs(value.headers) && Number.isSafeInteger(value.body_bytes) && Number(value.body_bytes) >= 0 && typeof value.body_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.body_sha256); break;
    case 'response_headers': valid = value.attempt === 1 && Number.isInteger(value.status) && Number(value.status) >= 200 && Number(value.status) <= 599 && headerPairs(value.headers); break;
    case 'response_chunk': valid = value.attempt === 1 && typeof value.data_b64 === 'string' && value.data_b64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value.data_b64); break;
    case 'completed': valid = value.attempt === 1 && ['success', 'http_error', 'stream_error', 'incomplete', 'canceled', 'error'].includes(String(value.state)) && (value.error === undefined || typeof value.error === 'string'); break;
    case 'error': valid = typeof value.error === 'string' && (value.code === undefined || typeof value.code === 'string') && (value.status === undefined || (Number.isInteger(value.status) && Number(value.status) >= 400 && Number(value.status) <= 599)); break;
  }
  if (!valid) throw new BridgeError('runtime_protocol', '运行时事件格式错误', 502);
  return value as unknown as RuntimeEvent;
}

/** 解码控制进程发送的私有作业。
 * @param value 私有管道读到的 JSON。
 * @return 单次作业。
 */
export function decodeRuntimeJob(value: unknown): RuntimeJob {
  if (!isObject(value) || value.type !== 'request_start' || value.schema_version !== 1 || typeof value.request_id !== 'string' || !isObject(value.prepared)) throw new BridgeError('runtime_protocol', '无效运行时作业');
  const prepared = value.prepared;
  if (isObject(prepared.input) && prepared.input.inputFormat !== undefined && !['api', 'claude_code'].includes(String(prepared.input.inputFormat))) throw new BridgeError('runtime_protocol', '运行时接入类型不合法', 502);
  if (!isObject(prepared.input) || prepared.input.request_id !== value.request_id || !isObject(prepared.input.body) || !Array.isArray(prepared.input.body.messages) || !isObject(prepared.context) || typeof prepared.context.sessionId !== 'string' || typeof prepared.context.promptId !== 'string' || !headerPairs(prepared.headers)) throw new BridgeError('runtime_protocol', '运行时作业缺少上下文');
  return value as unknown as RuntimeJob;
}

/** 建立带版本与归属的运行时事件。
 * @param requestId 请求归属。
 * @param payload 已知事件载荷。
 * @return 可序列化事件。
 */
export function runtimeEvent(requestId: string, payload: RuntimePayload): RuntimeEvent {
  return { ...payload, schema_version: 1, request_id: requestId };
}

/** 校验账号常驻进程收到的指令。
 * @param value 私有管道解析得到的对象。
 * @param workerId 本物理进程的唯一归属。
 * @return 已验证指令；旧协议及跨进程指令明确失败。
 */
export function decodeWorkerCommand(value: unknown, workerId: string): WorkerCommand {
  if (!isObject(value) || value.schema_version !== 2 || value.worker_id !== workerId) throw new BridgeError('runtime_protocol', '工作进程指令归属不匹配', 502);
  if (value.type === 'worker_shutdown') return value as unknown as WorkerCommand;
  if (typeof value.request_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.request_id)) throw new BridgeError('runtime_protocol', '工作进程缺少有效请求归属', 502);
  if (value.type === 'request_cancel') return value as unknown as WorkerCommand;
  if (value.type !== 'request_start') throw new BridgeError('runtime_protocol', '未知工作进程指令', 502);
  // 复用同一 PreparedInput 边界，不允许包装协议绕过原有作业校验。
  decodeRuntimeJob({ ...value, schema_version: 1 });
  return value as unknown as WorkerCommand;
}

/** 校验常驻进程输出的握手及请求事件。
 * @param line 完整 JSONL 行。
 * @param workerId 读取循环绑定的物理进程归属。
 * @return 已验证帧；具体请求状态顺序由引擎统一校验。
 */
export function decodeWorkerFrame(line: string, workerId: string): WorkerFrame {
  const value: unknown = JSON.parse(line);
  if (!isObject(value) || value.schema_version !== 2 || value.worker_id !== workerId) throw new BridgeError('runtime_protocol', '工作进程事件归属不匹配', 502);
  if (value.type === 'worker_error') {
    if (value.code !== 'native_configuration' || value.status !== 503 || typeof value.error !== 'string' || !value.error.trim() || Buffer.byteLength(value.error) > 2048 || Object.keys(value).some(key => !['type', 'schema_version', 'worker_id', 'code', 'status', 'error'].includes(key))) throw new BridgeError('runtime_protocol', '工作进程初始化错误帧格式错误', 502);
    return value as unknown as WorkerFrame;
  }
  if (value.type === 'worker_ready' && typeof value.version === 'string' && Number.isSafeInteger(value.pid) && Number(value.pid) > 0) return value as unknown as WorkerFrame;
  if (typeof value.request_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.request_id)) throw new BridgeError('runtime_protocol', '工作进程事件缺少有效请求归属', 502);
  if (value.type === 'worker_idle') return value as unknown as WorkerFrame;
  if (value.type === 'request_event' && isObject(value.payload)) {
    const payload = value.payload;
    if (['schema_version', 'request_id', 'worker_id'].some(key => key in payload)) throw new BridgeError('runtime_protocol', '请求载荷不能覆盖协议归属', 502);
    // 同一 JSONL 已经解析；直接校验对象，避免完整 CLI 正文再次编码和解析。
    validateRuntimeEvent({ ...payload, schema_version: 1, request_id: value.request_id }, value.request_id);
    if (payload.type === 'ready') throw new BridgeError('runtime_protocol', '请求事件不能替代工作进程握手', 502);
    return value as unknown as WorkerFrame;
  }
  throw new BridgeError('runtime_protocol', '工作进程帧格式错误', 502);
}
