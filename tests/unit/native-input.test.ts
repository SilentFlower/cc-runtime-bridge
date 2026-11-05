import { describe, expect, test } from 'bun:test';
import type { MessageBody } from '../../src/shared/contracts';
import { parseInput } from '../../src/shared/input';
import { prepareInput } from '../../src/control/header-policy';
import { readNativeInput, prepareNativeBody } from '../../src/shared/native-input';
import { validateToolChoice } from '../../src/shared/parameters';

const session = '22222222-2222-4222-8222-222222222222';
const prompt = '11111111-1111-4111-8111-111111111111';
const marker = { type: 'ephemeral', ttl: '5m' };

function fixture(): MessageBody {
  return { model: 'claude-sonnet-4-6', system: [{ type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.293.abc; cc_entrypoint=cli; cch=12345; cc_prompt_id=' + prompt + '; cc_turn_origin=human; cc_prompt_index=3; cc_turn_index=4;' }, { type: 'text', text: '调用方业务 system', cache_control: marker }], messages: [{ role: 'user', content: [{ type: 'text', text: '历史', cache_control: marker }] }, { role: 'system', content: '原生会话中的系统消息' }, { role: 'user', content: '下一轮' }], metadata: { user_id: JSON.stringify({ device_id: 'a'.repeat(64), account_uuid: '', session_id: session }), trace_extension: 'keep' }, thread: { type: 'request', previous_message_id: 'msg_previous' }, diagnostics: { previous_message_id: null }, fallbacks: 'default', safeguards: [], future_official: { nested: ['keep'] } };
}

describe('固定 293 原生入站合同', () => {
  test('普通 API 维持窄合同，原生字段及系统角色保留', () => {
    expect(() => parseInput({ model: 'm', messages: [{ role: 'user', content: 'q' }], thread: {} })).toThrow('暂不支持字段');
    const body = fixture(), input = parseInput(body), prepared = prepareInput(input);
    expect(input.inputFormat).toBe('claude_code');
    expect(input.body).toEqual(body);
    expect(prepared.context).toMatchObject({ inputFormat: 'claude_code', sessionId: session, promptId: prompt, agentKind: 'main', requestClass: 'main' });
  });

  test('只替换账号身份及 CCH 占位，不改变原生业务、缓存或线程', () => {
    const body = fixture(), before = structuredClone(body);
    const result = prepareNativeBody(body, { user_id: JSON.stringify({ device_id: 'b'.repeat(64), account_uuid: '33333333-3333-4333-8333-333333333333', session_id: 'should-not-replace-native-session' }) });
    expect(body).toEqual(before);
    expect(JSON.parse((result.metadata as Record<string, string>).user_id!)).toEqual({ device_id: 'b'.repeat(64), account_uuid: '33333333-3333-4333-8333-333333333333', session_id: session });
    expect((result.metadata as Record<string, unknown>).trace_extension).toBe('keep');
    expect((result.system as { text: string }[])[0]!.text).toContain('cch=00000;');
    for (const key of Object.keys(body).filter(key => !['metadata', 'system'].includes(key))) expect(result[key]).toEqual(body[key]);
    expect((result.system as unknown[]).slice(1)).toEqual((body.system as unknown[]).slice(1));
  });

  test('原生省略字段保持省略，空工具不增加默认声明', () => {
    for (const tools of [undefined, []]) {
      const body: MessageBody = { ...fixture(), ...(tools ? { tools } : {}) };
      expect(prepareNativeBody(body, body.metadata).tools).toEqual(tools);
      expect(prepareNativeBody(body, body.metadata).stream).toBeUndefined();
    }
  });

  test('已接纳的 billing 间隔保持原样，CCH 仍须替换为原生占位', () => {
    const body = fixture(), blocks = body.system as { text: string }[];
    blocks[0]!.text = blocks[0]!.text.replace('cch=12345;', 'cch=12345 \t;');
    expect(readNativeInput(body)).not.toBeNull();
    const result = prepareNativeBody(body, body.metadata);
    expect((result.system as { text: string }[])[0]!.text).toBe(blocks[0]!.text.replace('12345', '00000'));
  });

  test('两条接入路径都在构造前拒绝畸形 thinking', () => {
    for (const base of [fixture(), { model: 'm', messages: [{ role: 'user', content: 'q' }] }]) {
      for (const thinking of [{ type: 'unknown' }, { type: 'enabled' }, { type: 'enabled', budget_tokens: 1023 }]) expect(() => parseInput({ ...base, thinking })).toThrow();
    }
  });

  test('原生正文与显式信封或头部不一致时拒绝', () => {
    const body = fixture();
    expect(() => parseInput({ body, context: { sessionId: 'different' } })).toThrow('冲突');
    expect(() => prepareInput(parseInput(body, [['x-claude-code-prompt-id', '33333333-3333-4333-8333-333333333333']]))).toThrow('冲突');
    expect(() => prepareInput(parseInput(body, [['x-claude-code-request-class', 'subagent'], ['x-claude-code-agent-id', 'child']]))).toThrow('主代理上下文');
  });

  test('原生子代理压缩保留分类及父子关系', () => {
    const body = fixture();
    (body.system as { text: string }[])[0]!.text += ' cc_is_subagent=true;';
    const prepared = prepareInput(parseInput(body, [['x-claude-code-request-class', 'compaction'], ['x-claude-code-agent-id', 'child'], ['x-claude-code-parent-agent-id', session], ['x-claude-code-agent-type', 'Explore']]));
    expect(prepared.context).toMatchObject({ requestClass: 'compaction', agentKind: 'subagent', agentId: 'child', parentAgentId: session, querySource: 'compact' });
  });

  test('未知版本、重复归因和不完整身份不能回落成普通 API', () => {
    const change = (text: string) => { const b = fixture(); (b.system as { text: string }[])[0]!.text = text; return b; };
    const billing = (fixture().system as { text: string }[])[0]!.text;
    for (const text of [billing.replace('2.1.293', '2.1.303'), billing + ' cch=aaaaa;', billing.replace('cch=12345;', ''), billing.replace('cc_entrypoint=cli', 'cc_entrypoint=sdk-cli')]) expect(() => parseInput(change(text))).toThrow();
    const repeated = fixture(); (repeated.system as unknown[]).push((repeated.system as unknown[])[0]);
    expect(() => parseInput(repeated)).toThrow('唯一');
    expect(() => parseInput({ ...fixture(), metadata: { user_id: '{}' } })).toThrow('结构不合法');
  });

  test('本机控制字段明确拒绝，合法扩展及工具参数中的同名字段保留', () => {
    for (const key of ['env', 'settings', 'headers', 'proxy_url', 'api_key']) expect(() => parseInput({ ...fixture(), [key]: {} })).toThrow('本机控制字段');
    const body = { ...fixture(), tools: [{ name: 'set_config', input_schema: { type: 'object', properties: { env: { type: 'string' } } } }] };
    expect(parseInput(body).body.tools).toEqual(body.tools);
    expect(readNativeInput({ model: 'm', messages: [] })).toBeNull();
  });
});

describe('工具选择的发送前校验', () => {
  const body: MessageBody = { model: 'm', messages: [{ role: 'user', content: 'q' }], tools: [{ name: 'chosen', input_schema: { type: 'object' } }] };
  test('支持的选择不修改定义，未知工具和畸形类型明确失败', () => {
    const request = { ...body, tool_choice: { type: 'tool', name: 'chosen' } }, before = structuredClone(request);
    validateToolChoice(request); expect(request).toEqual(before);
    for (const choice of [{ type: 'tool', name: 'missing' }, { type: 'function', name: 'chosen' }]) expect(() => validateToolChoice({ ...body, tool_choice: choice })).toThrow();
    expect(() => validateToolChoice({ ...body, tools: [], tool_choice: { type: 'auto' } })).toThrow('非空');
    expect(() => validateToolChoice({ ...body, tools: [body.tools![0]!, body.tools![0]!] })).toThrow('不可重复');
  });
  test('模型能力及 thinking 不支持强制选择时及时拒绝', () => {
    const request = { ...body, tool_choice: { type: 'tool', name: 'chosen' } };
    expect(() => validateToolChoice(request, true)).toThrow('不支持强制');
    for (const type of ['adaptive', 'enabled']) expect(() => validateToolChoice({ ...request, thinking: { type } })).toThrow('不支持强制');
    expect(() => validateToolChoice({ ...request, thinking: { type: 'disabled' } }, false)).not.toThrow();
  });
});
