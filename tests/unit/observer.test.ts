import { expect, test } from 'bun:test';
import { ResponseObserver } from '../../src/control/response-observer';

test('分片和 CRLF 不改变 SSE 终态与首输出观察', () => {
  const raw = 'event: content_block_delta\r\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"你好"}}\r\n\r\nevent: message_stop\r\ndata: {"type":"message_stop"}\r\n\r\n';
  const observer = new ResponseObserver(true);
  for (const byte of new TextEncoder().encode(raw)) observer.push(new Uint8Array([byte]));
  observer.finish();
  expect(observer.terminal).toBe(true);
  expect(observer.firstOutput).toBe(true);
  expect(observer.invalid).toBe(false);
});

test('HTTP 200 的 SSE 错误与缺失终态分别识别', () => {
  const error = new ResponseObserver(true);
  error.push(Buffer.from('event: error\ndata: {"type":"error","error":{"message":"failed"}}\n\n'));
  error.finish();
  expect(error.streamError).toBe(true);
  expect(error.terminal).toBe(false);
  const missing = new ResponseObserver(true);
  missing.push(Buffer.from('event: ping\ndata: {"type":"ping"}\n\n'));
  expect(missing.terminal).toBe(false);
});

test('非流式 JSON 完成与错误不靠 HTTP 状态猜测', () => {
  const good = new ResponseObserver(false);
  good.push(Buffer.from('{"type":"message","content":[{"type":"text","text":"ok"}]}'));
  expect(good.finish()).toBe(true);
  expect(good.terminal).toBe(true);
  const bad = new ResponseObserver(false);
  bad.push(Buffer.from('{"type":"error","error":{"message":"failed"}}'));
  bad.finish();
  expect(bad.streamError).toBe(true);
  expect(bad.terminal).toBe(false);
});

test('单个超大 SSE 事件即使一次到齐，也不会被当作已完整验证', () => {
  const observer = new ResponseObserver(true);
  const event = { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x'.repeat(256 * 1024) } };
  observer.push(Buffer.from('data: ' + JSON.stringify(event) + '\n\ndata: {"type":"message_stop"}\n\n'));
  observer.finish();
  expect(observer.invalid).toBe(true);
  expect(observer.terminal).toBe(true);
});
