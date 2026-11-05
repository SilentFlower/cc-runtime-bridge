import { isObject } from '../shared/errors';

/** 有界观察响应语义，观察失败不改写返回调用方的字节。 */
export class ResponseObserver {
  private decoder = new TextDecoder();
  private buffer = '';
  private discard = false;
  private json = '';
  private jsonOverflow = false;
  public terminal = false;
  public streamError = false;
  public firstOutput = false;
  public invalid = false;

  /** 指定响应类型。
   * @param streaming 是否为 SSE。
   */
  constructor(private readonly streaming: boolean) {}

  /** 观察新片段。
   * @param bytes 原始响应逻辑字节。
   * @return 本片段是否首次发现有效输出。
   */
  push(bytes: Uint8Array): boolean {
    const before = this.firstOutput;
    const text = this.decoder.decode(bytes, { stream: true });
    if (!this.streaming) {
      if (this.json.length + text.length <= 10 * 1024 * 1024) this.json += text;
      else this.jsonOverflow = true;
      return false;
    }
    this.buffer += text;
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer)) !== null) {
      const block = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      if (block.length > 256 * 1024) this.invalid = true;
      else if (!this.discard) this.event(block);
      this.discard = false;
    }
    if (this.buffer.length > 256 * 1024) { this.buffer = ''; this.discard = true; this.invalid = true; }
    return !before && this.firstOutput;
  }

  private event(block: string): void {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    let value: unknown;
    try { value = JSON.parse(data); } catch { this.invalid = true; return; }
    if (!isObject(value)) return;
    if (value.type === 'message_stop') this.terminal = true;
    if (value.type === 'error') this.streamError = true;
    const delta = value.delta;
    const content = value.content_block;
    if (isObject(delta) && ['text', 'thinking', 'partial_json'].some(key => typeof delta[key] === 'string' && String(delta[key]).trim().length > 0)) this.firstOutput = true;
    if (isObject(content) && ((typeof content.text === 'string' && content.text.trim()) || ((content.type === 'tool_use' || content.type === 'server_tool_use') && typeof content.name === 'string' && typeof content.id === 'string'))) this.firstOutput = true;
  }

  /** 完成观察，非流式响应在此验证 message/error 形状。
   * @return 是否首次在完整 JSON 中发现有效输出。
   */
  finish(): boolean {
    if (this.streaming) { if (this.buffer.trim()) this.invalid = true; return false; }
    if (this.jsonOverflow) { this.invalid = true; return false; }
    try {
      const value: unknown = JSON.parse(this.json + this.decoder.decode());
      if (!isObject(value)) { this.invalid = true; return false; }
      this.streamError = value.type === 'error';
      this.terminal = value.type === 'message' && Array.isArray(value.content);
      if (this.terminal) this.firstOutput = (value.content as unknown[]).some(block => isObject(block) && (block.type === 'tool_use' || block.type === 'server_tool_use' || (typeof block.text === 'string' && block.text.trim().length > 0)));
    } catch { this.invalid = true; }
    return this.firstOutput;
  }
}
