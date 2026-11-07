import { expect, test } from 'bun:test';
import type { RequestDetail } from '../../src/shared/contracts';
import { decodeLogDetail, decodeLogList } from '../../src/shared/log-api';
import { prepareInput } from '../../src/control/header-policy';
import { parseInput } from '../../src/shared/input';
import { decodeRuntimeJob } from '../../src/shared/protocol';

/** 创建只用于边界解码的旧版详情。
 * @return 不含新字段的完整旧记录。
 */
function fixture(): RequestDetail {
  return { request: { id: 'fixture', createdAt: '2026-11-07T00:00:00Z', finishedAt: '2026-11-07T00:00:00Z', model: 'fixture', requestClass: 'subagent', sessionId: 'session', promptId: 'prompt', agentId: 'child', parentAgentId: null, state: 'success', httpStatus: 200, durationMs: 1, headersMs: 1, firstOutputMs: 1, mode: 'summary', engine: 'demo/fixture', binarySha256: null, error: null, captureError: null }, context: { requestClass: 'subagent', sessionId: 'session', promptId: 'prompt', agentId: 'child', agentKind: 'subagent', querySource: 'agent:custom', source: 'client' }, decisions: [], captures: [] };
}

test('旧日志保持可读，关联字段来源与空值必须一致', () => {
  const value = fixture(); expect(decodeLogDetail(value)).toEqual(value);
  value.agentAssociation = { state: 'linked', parentAgentId: 'parent', agentType: 'Explore', parentSource: 'client_tool_result', typeSource: 'client_tool_result', evidence: [{ requestId: 'evidence', toolUseId: 'toolu' }] };
  expect(decodeLogDetail(value)).toEqual(value);
  expect(() => decodeLogDetail({ ...value, agentAssociation: { ...value.agentAssociation, state: 'unknown' } })).toThrow('关联视图');
  value.agentAssociation.parentAgentId = null;
  expect(() => decodeLogDetail(value)).toThrow('关联视图');
  value.request.agentLaunches = { state: 'complete', links: [] };
  expect(decodeLogList({ rows: [value.request], total: 1 }).rows[0]?.agentLaunches).toEqual({ state: 'complete', links: [] });
  expect(() => decodeLogList({ rows: [{ ...value.request, agentLaunches: { state: 'complete', links: [{}] } }], total: 1 })).toThrow('启动证据');
});

test('分类用途须与auxiliary和auto_mode一致，私有作业不能只贴识别标签', () => {
  const value = fixture(), classification = { purpose: 'auto_permission_classifier' as const, source: 'native_profile' as const, profile: 'cc293-auto-mode-xml-s1' as const };
  value.context = { ...value.context!, inputFormat: 'claude_code', requestClass: 'auxiliary', querySource: 'auto_mode', classification };
  expect(decodeLogDetail(value).context?.classification).toEqual(classification);
  value.context.querySource = 'repl_main_thread';
  expect(() => decodeLogDetail(value)).toThrow('分类证据');
  const prepared = prepareInput(parseInput({ model: 'fixture', messages: [{ role: 'user', content: '离线' }] }));
  prepared.context.classification = classification;
  expect(() => decodeRuntimeJob({ type: 'request_start', schema_version: 1, request_id: prepared.input.request_id, prepared })).toThrow('分类证据');
});
