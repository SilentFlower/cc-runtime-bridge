import { expect, test } from 'bun:test';
import { decodeWorkerCommand, decodeWorkerFrame, runtimeEvent } from '../../src/shared/protocol';
import { parseInput } from '../../src/shared/input';
import { prepareInput } from '../../src/control/header-policy';
import type { WorkerCommand, WorkerFrame } from '../../src/shared/contracts';

const workerId = '11111111-1111-4111-8111-111111111111';
const prepared = prepareInput(parseInput({ request_id: 'protocol-job', body: { model: 'fixture', messages: [{ role: 'user', content: '测试' }] } }));

test('常驻协议同时校验进程与作业归属，不接纳旧协议握手', () => {
  const command: WorkerCommand = { schema_version: 2, type: 'request_start', worker_id: workerId, request_id: prepared.input.request_id, prepared };
  expect(decodeWorkerCommand(command, workerId)).toEqual(command);
  expect(() => decodeWorkerCommand({ ...command, worker_id: 'other' }, workerId)).toThrow('归属');
  expect(() => decodeWorkerCommand({ ...command, prepared: { ...prepared, input: { ...prepared.input, request_id: 'other' } } }, workerId)).toThrow('上下文');
  expect(() => decodeWorkerFrame(JSON.stringify({ schema_version: 1, type: 'ready', version: '2.1.293' }), workerId)).toThrow('归属');
  expect(() => decodeWorkerFrame(JSON.stringify({ schema_version: 2, worker_id: workerId, type: 'worker_ready', version: '2.1.293', pid: 0 }), workerId)).toThrow();
});

test('包装事件继续严格验证原生载荷及单次发送，不接受请求内伪造握手', () => {
  const event: WorkerFrame = { schema_version: 2, type: 'request_event', worker_id: workerId, request_id: 'protocol-job', payload: { type: 'response_chunk', attempt: 1, data_b64: '5rWL6K+V' } };
  expect(decodeWorkerFrame(JSON.stringify(event), workerId)).toEqual(event);
  expect(() => decodeWorkerFrame(JSON.stringify({ ...event, payload: { ...event.payload, attempt: 2 } }), workerId)).toThrow('格式');
  expect(() => decodeWorkerFrame(JSON.stringify({ ...event, payload: { type: 'ready', version: '2.1.293' } }), workerId)).toThrow('握手');
  expect(() => decodeWorkerFrame(JSON.stringify({ ...event, payload: { ...event.payload, data_b64: 'invalid!' } }), workerId)).toThrow('格式');
  expect(() => decodeWorkerFrame(JSON.stringify({ ...event, payload: { ...event.payload, request_id: 'old-request' } }), workerId)).toThrow('归属');
  expect(() => decodeWorkerFrame(JSON.stringify({ ...event, payload: { ...event.payload, schema_version: 1 } }), workerId)).toThrow('归属');
  const payload = { type: 'completed' as const, attempt: 1, state: 'success' as const, schema_version: 2, request_id: 'old-request' };
  expect(runtimeEvent('current', payload).request_id).toBe('current');
  expect(runtimeEvent('current', payload).schema_version).toBe(1);
});
