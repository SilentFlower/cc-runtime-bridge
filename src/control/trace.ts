import { createHash, randomUUID } from 'node:crypto';
import type { CaptureRecord, CaptureStage, HeaderPair, PreparedInput, RequestRow, RequestState, RuntimeEvent } from '../shared/contracts';
import type { LogSnapshot } from './log-schema';
import { LogStore } from './log-store';
import { Redactor } from './redaction';
import { ResponseObserver } from './response-observer';

/** 单次采集的模式、预览上限和显式秘密来源。 */
interface TraceOptions {
  mode: 'off' | 'summary' | 'debug';
  engine: string;
  binarySha256?: string | null;
  maxBodyBytes: number;
  secrets?: Record<string, unknown>;
  ingressText?: string;
}

/** 单请求的内存状态及日志投影，只有此处计算采集完整性与性能。 */
export class RequestTrace {
  public readonly row: RequestRow;
  public readonly redactor = new Redactor();
  private readonly captures = new Map<CaptureStage, CaptureRecord>();
  private readonly begin = performance.now();
  private sentAt: number | null = null;
  private observer: ResponseObserver | null = null;
  private responseHash = createHash('sha256');
  private observedBytes = 0;
  private saved: Uint8Array[] = [];
  private savedBytes = 0;
  private responseHeaders: HeaderPair[] = [];
  private finalized = false;

  /** 建立请求发生时的快照，非法输入的上下文保持未解析。
   * @param prepared 已验证输入，拒绝请求可为空。
   * @param raw 原始业务输入。
   * @param headers 入站头。
   * @param store 异步日志存储。
   * @param options 采集模式与限制。
   */
  constructor(private readonly prepared: PreparedInput | null, raw: unknown, headers: HeaderPair[], private readonly store: LogStore, private readonly options: TraceOptions) {
    this.redactor.register(raw); this.redactor.register(headers); this.redactor.register(options.secrets);
    const context = prepared?.context;
    this.row = {
      id: prepared?.input.request_id ?? randomUUID(), createdAt: new Date().toISOString(), finishedAt: null,
      model: prepared?.input.body.model ?? '未解析', requestClass: context?.requestClass ?? 'unknown', sessionId: context?.sessionId ?? '', promptId: context?.promptId ?? '',
      agentId: context?.agentId ?? null, parentAgentId: context?.parentAgentId ?? null, state: 'queued', httpStatus: null, durationMs: null, headersMs: null, firstOutputMs: null,
      mode: options.mode, engine: options.engine, binarySha256: options.binarySha256 ?? null, error: null, captureError: null,
    };
    this.capture('ingress', options.ingressText ?? (typeof raw === 'string' ? raw : JSON.stringify(raw)), headers, 'http_ingress', 'utf8');
    this.capture('header_policy', JSON.stringify(prepared?.decisions ?? []), [], 'header_policy', 'json');
    for (const stage of ['cc_prepared', 'wire_final', 'upstream_response'] as const) {
      this.captures.set(stage, { stage, attempt: 1, capturedAt: new Date().toISOString(), source: 'unavailable', representation: 'unknown', status: 'unavailable', observedBytes: 0, storedBytes: 0, sha256: null, text: null, headers: [], note: stage === 'wire_final' ? '原生最终处理在 JS 拦截点之后，本版本未采集真实最终字节' : '尚未取得该阶段数据' });
    }
    this.save();
  }

  private capture(stage: CaptureStage, text: string, headers: HeaderPair[], source: string, representation: string): void {
    const bytes = Buffer.from(text);
    const safe = this.options.mode === 'debug' ? this.redactor.preview(text, this.options.maxBodyBytes) : null;
    const storedText = safe?.text ?? null;
    this.captures.set(stage, {
      stage, attempt: 1, capturedAt: new Date().toISOString(), source, representation,
      status: safe?.truncated ? 'truncated' : 'complete',
      observedBytes: bytes.length, storedBytes: storedText === null ? 0 : Buffer.byteLength(storedText),
      sha256: createHash('sha256').update(bytes).digest('hex'), text: storedText,
      headers: this.options.mode === 'debug' ? this.redactor.headers(headers) : [],
      note: this.options.mode === 'summary' ? 'summary 模式不保存原文' : null,
    });
  }

  private save(): void {
    if (this.options.mode === 'off') return;
    const snapshot: LogSnapshot = {
      request: this.redactor.value({ ...this.row }) as RequestRow,
      context: this.prepared ? this.redactor.value(this.prepared.context) as PreparedInput['context'] : null,
      decisions: this.redactor.value(this.prepared?.decisions ?? []) as LogSnapshot['decisions'],
      captures: [...this.captures.values()],
    };
    if (!this.store.record(snapshot)) this.row.captureError = this.store.error;
  }

  /** 标记离开等待队列。
   * @return 无。
   */
  start(): void { this.row.state = 'running'; this.save(); }

  /** 更新运行时事件的摘要及采集结果。
   * @param event 已验证事件。
   * @return 无。
   */
  event(event: RuntimeEvent): void {
    if (event.type === 'cc_prepared') {
      this.sentAt = performance.now();
      this.redactor.register(event.headers);
      this.capture('cc_prepared', event.body, event.headers, this.options.engine.startsWith('demo') ? 'demo_fixture' : 'claude_code_293_cli_prepared', 'json_before_native_transport');
      const captured = this.captures.get('cc_prepared')!;
      captured.observedBytes = event.body_bytes;
      captured.sha256 = event.body_sha256;
      this.save();
    } else if (event.type === 'response_headers') {
      this.row.httpStatus = event.status;
      this.row.headersMs = Math.round(performance.now() - (this.sentAt ?? this.begin));
      this.responseHeaders = this.redactor.headers(event.headers);
      const contentType = event.headers.find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? '';
      this.observer = new ResponseObserver(contentType.includes('text/event-stream'));
      this.captures.set('upstream_response', {
        stage: 'upstream_response', attempt: 1, capturedAt: new Date().toISOString(), source: this.options.engine.startsWith('demo') ? 'demo_fixture' : 'native_response',
        representation: 'response_logical_bytes', status: 'incomplete', observedBytes: 0, storedBytes: 0, sha256: null, text: null,
        headers: this.options.mode === 'debug' ? this.responseHeaders : [], note: '已收到响应头，正文仍在采集中',
      });
      this.save();
    } else if (event.type === 'response_chunk') {
      const chunk = Buffer.from(event.data_b64, 'base64');
      this.observedBytes += chunk.length; this.responseHash.update(chunk);
      const remaining = this.options.maxBodyBytes - this.savedBytes;
      if (this.options.mode === 'debug' && remaining > 0) { const part = chunk.subarray(0, remaining); this.saved.push(Buffer.from(part)); this.savedBytes += part.length; }
      if (this.observer?.push(chunk) && this.row.firstOutputMs === null) this.row.firstOutputMs = Math.round(performance.now() - (this.sentAt ?? this.begin));
    }
  }

  /** 保存终态，HTTP 200 和成功的流终态分别判定。
   * @param state 运行时或控制层终态。
   * @param error 可选的故障说明。
   * @return 最终状态。
   */
  finish(state: RequestState, error?: string): RequestState {
    if (this.finalized) return this.row.state;
    this.finalized = true;
    if (this.observer?.finish() && this.row.firstOutputMs === null) this.row.firstOutputMs = Math.round(performance.now() - (this.sentAt ?? this.begin));
    if (state === 'success') {
      if (this.observer?.streamError) { state = 'stream_error'; error = '上游响应包含错误'; }
      else if (!this.observer?.terminal || this.observer.invalid) { state = 'incomplete'; error = '响应没有可验证的完整终态'; }
    }
    if (this.row.httpStatus !== null && this.row.httpStatus >= 400 && state !== 'canceled') state = 'http_error';
    this.row.state = state; this.row.error = error ? this.redactor.text(error) : null;
    this.row.finishedAt = new Date().toISOString(); this.row.durationMs = Math.round(performance.now() - this.begin);
    if (this.observer) {
      const incomplete = this.observedBytes > this.savedBytes || ['canceled', 'incomplete', 'error'].includes(state);
      const prefix = new TextDecoder().decode(Buffer.concat(this.saved), { stream: incomplete });
      const preview = this.options.mode === 'debug' ? this.redactor.preview(prefix, this.options.maxBodyBytes, incomplete) : null;
      const text = preview?.text ?? null;
      this.captures.set('upstream_response', {
        stage: 'upstream_response', attempt: 1, capturedAt: new Date().toISOString(), source: this.options.engine.startsWith('demo') ? 'demo_fixture' : 'native_response', representation: 'response_logical_bytes',
        status: state === 'canceled' || state === 'incomplete' || state === 'error' ? 'incomplete' : preview?.truncated ? 'truncated' : 'complete',
        observedBytes: this.observedBytes, storedBytes: text === null ? 0 : Buffer.byteLength(text), sha256: this.responseHash.digest('hex'), text,
        headers: this.options.mode === 'debug' ? this.responseHeaders : [], note: this.options.mode === 'summary' ? 'summary 模式不保存原文' : incomplete ? '原文前缀可能省略截断边界，避免保存部分凭据' : null,
      });
    }
    this.saved = [];
    this.save();
    return state;
  }
}
