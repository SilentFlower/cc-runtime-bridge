import { randomUUID } from 'node:crypto';
import type { BridgeInput, ContextInput, HeaderDecision, HeaderPair, PreparedInput, RequestContext, RequestClass } from '../shared/contracts';
import { REQUEST_CLASSES } from '../shared/input';
import { BridgeError } from '../shared/errors';

const CONNECTION_HEADERS = new Set(['connection', 'keep-alive', 'proxy-connection', 'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const CREDENTIAL_HEADERS = new Set(['authorization', 'x-api-key', 'proxy-authorization', 'cookie']);
const RUNTIME_HEADERS = new Set(['host', 'content-length', 'content-encoding', 'content-type', 'accept-encoding', 'user-agent', 'x-app', 'x-client-request-id']);
const CONTEXT_HEADERS: Record<string, keyof ContextInput> = {
  'x-claude-code-request-class': 'requestClass',
  'x-claude-code-session-id': 'sessionId',
  'x-claude-code-prompt-id': 'promptId',
  'x-claude-code-agent-id': 'agentId',
  'x-claude-code-parent-agent-id': 'parentAgentId',
  'x-claude-code-agent-type': 'agentType',
};
const MERGEABLE = new Set(['anthropic-beta', 'accept', 'accept-language', 'cache-control']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 应用连接级黑名单、运行时归属和原生调用上下文。
 * @param input 共享入口已经验证的输入。
 * @return 含处理决策的原生作业。
 */
export function prepareInput(input: BridgeInput): PreparedInput {
  const connectionNames = new Set<string>();
  const decisions: HeaderDecision[] = [];
  const forwarded: HeaderPair[] = [];
  const seen = new Map<string, string>();
  const context: ContextInput = { ...input.context };
  for (const [name, value] of input.headers) {
    if (!/^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/.test(name) || /[\0-\x08\x0a-\x1f\x7f]/.test(value) || [...value].some(c => c.charCodeAt(0) > 255)) throw new BridgeError('invalid_header', '请求头格式不合法：' + name);
    if (name.toLowerCase() === 'connection') for (const token of value.split(',')) connectionNames.add(token.trim().toLowerCase());
  }
  let supplied = Object.keys(context).length > 0;
  for (const [name, value] of input.headers) {
    const lower = name.toLowerCase();
    const decision = (action: HeaderDecision['action'], reason: string): void => { decisions.push({ name, action, reason }); };
    if (CONNECTION_HEADERS.has(lower) || connectionNames.has(lower)) { decision('drop', '连接级字段，不属于上游请求'); continue; }
    if (CREDENTIAL_HEADERS.has(lower)) { decision('drop', '调用方凭据不作为上游凭据'); continue; }
    if (RUNTIME_HEADERS.has(lower) || lower.startsWith('x-stainless-')) { decision('runtime', '由真实运行时及最终正文生成'); continue; }
    const previous = seen.get(lower);
    if (previous !== undefined && !MERGEABLE.has(lower)) throw new BridgeError('duplicate_header', '无法无损表达重复请求头：' + name);
    seen.set(lower, value);
    const field = CONTEXT_HEADERS[lower];
    if (field) {
      if (!value.trim() || value.length > 512) throw new BridgeError('invalid_context', '上下文请求头不合法：' + name);
      if (context[field] !== undefined && context[field] !== value) throw new BridgeError('context_conflict', '上下文与请求头冲突：' + name);
      Object.assign(context, { [field]: value });
      supplied = true;
      decision('context', '与 agentContext、metadata 和 billing 一起生成');
      continue;
    }
    forwarded.push([name, value]);
    decision(lower === 'anthropic-beta' || lower === 'anthropic-version' ? 'runtime' : 'keep', lower === 'anthropic-beta' || lower === 'anthropic-version' ? '按原生能力校验并合并，不静默删除' : '合法端到端扩展，默认保留');
  }
  const requestClass = context.requestClass ?? (context.agentKind === 'main' ? 'main' : context.agentId ? 'subagent' : 'main');
  if (!REQUEST_CLASSES.includes(requestClass as RequestClass)) throw new BridgeError('unsupported_context', '当前 293 不支持该请求类别', 422);
  const kind = context.agentKind ?? ((requestClass === 'subagent' || requestClass === 'workflow' || context.agentId) ? (context.agentType === 'teammate' ? 'teammate' : 'subagent') : 'main');
  if (requestClass === 'main' && kind !== 'main') throw new BridgeError('context_conflict', '主请求类别与子代理上下文冲突');
  if ((requestClass === 'subagent' || requestClass === 'workflow') && kind === 'main') throw new BridgeError('context_conflict', '子代理请求不能使用主代理上下文');
  if (kind !== 'main' && !context.agentId) throw new BridgeError('incomplete_context', '子代理请求需要显式 agentId，不能猜测其身份');
  if (requestClass === 'workflow' && !context.workflowRunId) throw new BridgeError('incomplete_context', 'workflow 请求需要 workflowRunId');
  const promptId = context.promptId ?? randomUUID();
  if (!UUID.test(promptId)) throw new BridgeError('invalid_prompt_id', 'promptId 必须为 UUID，才能在原生 billing 中保持关联');
  let querySource = 'repl_main_thread';
  if (kind !== 'main' || requestClass === 'subagent' || requestClass === 'workflow') {
    const type = context.agentType;
    querySource = type && type !== 'custom' && type !== 'teammate' ? 'agent:builtin:' + type : 'agent:custom';
  }
  if (requestClass === 'compaction') querySource = 'compact';
  if (requestClass === 'auxiliary') querySource = 'side_query';
  if (requestClass === 'side_reply') querySource = 'side_reply';
  const sessionId = context.sessionId ?? randomUUID();
  const resolved: RequestContext = {
    requestClass: requestClass as RequestClass,
    sessionId,
    promptId,
    agentKind: kind,
    agentId: context.agentId ?? (kind === 'main' ? sessionId : undefined),
    parentAgentId: context.parentAgentId,
    agentType: context.agentType,
    workflowRunId: context.workflowRunId,
    querySource,
    source: supplied ? 'client' : 'bridge-default',
  };
  return { input, context: resolved, headers: forwarded, decisions };
}
