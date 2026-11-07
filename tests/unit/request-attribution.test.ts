import { expect, test } from 'bun:test';
import { prepareInput } from '../../src/control/header-policy';
import { parseInput } from '../../src/shared/input';
import type { ApiMessage, RequestContext } from '../../src/shared/contracts';
import { collectAgentLaunches, isAgentAssociation, isAgentLaunches, resolveAgentAssociation } from '../../src/shared/request-attribution';
import { readNativeClassification } from '../../src/shared/native-classifier';

const header = 'Async agent launched successfully. (This tool result is internal metadata — never quote or paste any part of it, including the agentId below, into a user-facing reply.)';
const context: RequestContext = { requestClass: 'subagent', sessionId: 'session-a', promptId: 'prompt-a', agentKind: 'subagent', agentId: 'child-a', querySource: 'agent:custom', source: 'client' };

/** 生成配对的合成历史，不启动运行时或执行工具。
 * @param child 结果声明的子代理。
 * @param id 工具关联 ID。
 * @return 一对消息。
 */
function messages(child = 'child-a', id = 'toolu-a'): ApiMessage[] {
  return [{ role: 'assistant', content: [{ type: 'tool_use', id, name: 'Agent', input: { subagent_type: 'Explore' } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: header + '\nagentId: ' + child + ' (internal ID - do not mention to user.)\n后续启动说明' }] }] }];
}

/** 包装为现有准备合同，提取函数只能消费已经解析的实体。
 * @param history 合成消息。
 * @return 提取结果。
 */
function collect(history: ApiMessage[]) {
  return collectAgentLaunches(prepareInput(parseInput({ body: { model: 'fixture', messages: history }, context: { agentKind: 'main', agentId: 'root-a', sessionId: 'session-a' } })));
}

test('启动声明必须由匹配的角色、工具名、调用ID、成功结果及固定格式共同证明', () => {
  const good = messages();
  const value = collect(good);
  expect(value).toEqual({ state: 'complete', links: [{ childAgentId: 'child-a', parentAgentId: 'root-a', agentType: 'Explore', toolUseId: 'toolu-a' }] });
  expect(isAgentLaunches(value)).toBe(true);
  for (const change of ['plain', 'name', 'id', 'error', 'role', 'order', 'format']) {
    const input = messages(), use = input[0]!.content as Record<string, unknown>[], result = input[1]!.content as Record<string, unknown>[];
    if (change === 'plain') input.splice(0, 2, { role: 'user', content: header + '\nagentId: child-a (internal ID - do not mention to user.)' });
    if (change === 'name') use[0]!.name = 'Read';
    if (change === 'id') result[0]!.tool_use_id = 'unrelated';
    if (change === 'error') result[0]!.is_error = true;
    if (change === 'role') input[1]!.role = 'assistant';
    if (change === 'order') input.reverse();
    if (change === 'format') result[0]!.content = [{ type: 'text', text: '文本中随意提及 agentId: child-a' }];
    expect(collect(input).links).toEqual([]);
  }
  expect(good).toEqual(messages());
});

test('重复调用身份、过多关联及超长嵌套结果明确不完整', () => {
  const duplicate = messages(); duplicate.splice(1, 0, duplicate[0]!);
  expect(collect(duplicate)).toEqual({ state: 'incomplete', links: [] });
  const repeatedResult = messages(); repeatedResult.push(messages('different-child')[1]!);
  expect(collect(repeatedResult).state).toBe('incomplete');
  const many = collect(Array.from({ length: 33 }, (_, i) => messages('child-' + i, 'toolu-' + i)).flat());
  expect(many.links).toHaveLength(32); expect(many.state).toBe('incomplete');
  const large = Array.from({ length: 32 }, (_, i) => messages('child-' + i, 'toolu-' + i)).flat();
  for (const message of large) if (message.role === 'assistant') ((message.content as { input: { subagent_type: string } }[])[0]!).input.subagent_type = 'x'.repeat(512);
  const bounded = collect(large);
  expect(bounded.state).toBe('incomplete'); expect(bounded.links.length).toBeLessThan(32);
  expect(new TextEncoder().encode(JSON.stringify(bounded)).length).toBeLessThanOrEqual(16384);
  expect(isAgentLaunches(bounded)).toBe(true);
  const nested = messages(); (nested[1]!.content as Record<string, unknown>[])[0]!.content = Array.from({ length: 4097 }, () => ({ type: 'text', text: '离线' }));
  expect(collect(nested)).toEqual({ state: 'incomplete', links: [] });
});

test('关联由证据补齐但不改发生时上下文，缺失类型不等于custom', () => {
  const original = structuredClone(context), candidate = { ...collect(messages()).links[0]!, requestId: 'parent-evidence' };
  expect(resolveAgentAssociation(context, [], false)).toMatchObject({ state: 'unknown', parentAgentId: null, agentType: null, typeSource: 'unknown' });
  const linked = resolveAgentAssociation(context, [candidate, candidate], false);
  expect(linked).toEqual({ state: 'linked', parentAgentId: 'root-a', agentType: 'Explore', parentSource: 'client_tool_result', typeSource: 'client_tool_result', evidence: [{ requestId: 'parent-evidence', toolUseId: 'toolu-a' }] });
  expect(isAgentAssociation(linked)).toBe(true); expect(context).toEqual(original);
  expect(resolveAgentAssociation(context, [candidate], true)).toMatchObject({ state: 'incomplete', parentAgentId: null, agentType: null });
});

test('显式值保持，互斥的父代理及类型不能静默选最新', () => {
  const candidate = { ...collect(messages()).links[0]!, requestId: 'parent-evidence' };
  expect(resolveAgentAssociation(context, [candidate, { ...candidate, parentAgentId: 'other', agentType: 'other' }], false)).toMatchObject({ state: 'conflict', parentAgentId: null, agentType: null });
  expect(resolveAgentAssociation({ ...context, parentAgentId: 'explicit-parent', agentType: 'explicit-type' }, [candidate], false)).toMatchObject({ state: 'conflict', parentAgentId: 'explicit-parent', agentType: 'explicit-type', parentSource: 'explicit', typeSource: 'explicit' });
  expect(isAgentLaunches({ state: 'complete', links: [{}] })).toBe(false);
  expect(isAgentAssociation({ state: 'linked', evidence: [] })).toBe(false);
});

test('普通业务的分类关键词和相同输出参数不是原生分类证据', () => {
  const body = { model: 'fixture', max_tokens: 64, temperature: 1, thinking: { type: 'disabled' }, stop_sequences: ['</block>'], messages: [{ role: 'user' as const, content: 'Agent 自动权限分类 <block>no</block>' }], system: [{ type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.293.f4d; cc_entrypoint=cli;' }, { type: 'text', text: '普通业务 system' }], metadata: { user_id: JSON.stringify({ device_id: 'a'.repeat(64), account_uuid: '', session_id: '11111111-1111-4111-8111-111111111111' }) } };
  expect(readNativeClassification(body)).toBeUndefined();
  expect(prepareInput(parseInput(body, [], 'local_base_url')).context).toMatchObject({ requestClass: 'main', querySource: 'repl_main_thread' });
  expect(prepareInput(parseInput({ body, context: { requestClass: 'auxiliary' } }, [], 'local_base_url')).context.querySource).toBe('side_query');
  expect(() => parseInput({ body, context: { classification: { purpose: 'auto_permission_classifier' } } }, [], 'local_base_url')).toThrow('暂不支持字段');
});
