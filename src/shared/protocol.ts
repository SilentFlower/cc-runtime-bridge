import type { HeaderPair, RuntimeEvent, RuntimeJob, RuntimePayload } from './contracts';
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
  const value: unknown = JSON.parse(line);
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
  if (!isObject(prepared.input) || prepared.input.request_id !== value.request_id || !isObject(prepared.input.body) || !Array.isArray(prepared.input.body.messages) || !isObject(prepared.context) || typeof prepared.context.sessionId !== 'string' || typeof prepared.context.promptId !== 'string' || !headerPairs(prepared.headers)) throw new BridgeError('runtime_protocol', '运行时作业缺少上下文');
  return value as unknown as RuntimeJob;
}

/** 建立带版本与归属的运行时事件。
 * @param requestId 请求归属。
 * @param payload 已知事件载荷。
 * @return 可序列化事件。
 */
export function runtimeEvent(requestId: string, payload: RuntimePayload): RuntimeEvent {
  return { schema_version: 1, request_id: requestId, ...payload };
}
