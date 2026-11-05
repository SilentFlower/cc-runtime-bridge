import type { MessageBody } from './contracts';
import { BridgeError } from './errors';

/** 在进入原生装配前校验工具选择；模型能力由固定运行时提供，不能从版本名称猜测。
 * @param body 调用方的业务或原生正文。
 * @param requiresAdaptive 固定原生模型工厂是否强制返回 adaptive。
 * @return 校验通过时无返回值，不支持组合明确抛出 4xx。
 */
export function validateToolChoice(body: MessageBody, requiresAdaptive = false): void {
  const tools = body.tools ?? [];
  const names = new Set<string>();
  for (const tool of tools) {
    if (typeof tool.name !== 'string' || !tool.name.trim() || tool.name.length > 256 || /[\0-\x1f\x7f]/.test(tool.name) || names.has(tool.name)) throw new BridgeError('invalid_tools', '工具名称必须有效且不可重复');
    names.add(tool.name);
  }
  const choice = body.tool_choice;
  if (!choice) return;
  if (!['auto', 'none', 'any', 'tool'].includes(String(choice.type))) throw new BridgeError('invalid_tool_choice', 'tool_choice.type 必须为 auto、none、any 或 tool');
  if (choice.type !== 'none' && !tools.length) throw new BridgeError('invalid_tool_choice', 'tool_choice 需要非空工具列表');
  if (choice.type === 'tool' && (typeof choice.name !== 'string' || !names.has(choice.name))) throw new BridgeError('invalid_tool_choice', 'tool_choice.name 必须指向已声明的工具');
  if ((choice.type === 'any' || choice.type === 'tool') && (requiresAdaptive || ['enabled', 'adaptive'].includes(String(body.thinking?.type)))) throw new BridgeError('tool_choice_incompatible', '固定原生模型或当前 thinking 不支持强制工具选择');
}
