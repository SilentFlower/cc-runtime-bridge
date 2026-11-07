import { createHash } from 'node:crypto';
import type { MessageBody, NativeClassification } from './contracts';

// 摘要来自已固定 SHA 的官方 2.1.293 及实际 CLI 实收，不保存完整专有提示词。
const SYSTEM_SHA = '6b368647be9358ea39f4a3a36cb73a5f7b50129eba0b9d5c1c95e44bb9a40ec7';
const FOOTER_S1_SHA = '6ac77994fdcda7ccf62f81cf4e8b1d8c8064e1958afe5627265a9ec17a07f720';
const FOOTER_S2_SHA = 'a82c52d8072c24f95f54f8e47d2b6a78914e8d31de7f0e4213d5944150f3ae68';
const DENY_SUFFIX_SHA = '98e88fbc391d18ae0af0dfcf5ad737ae60d4133610c7967c0f2d62e702d338a3';
const DENY_PREFIX = '- User Deny Rules: The user has configured these permission deny rules: ';

function digest(text: string): string { return createHash('sha256').update(text).digest('hex'); }

/** 识别已经过原生入站校验的固定分类构造，未知变体保持未识别。
 * @param body 保留原始业务字段的固定 293 原生正文。
 * @return 已验证的用途证据，或未知时的 undefined。
 */
export function readNativeClassification(body: MessageBody): NativeClassification | undefined {
  if (body.temperature !== 1 || body.stream === true || body.tools !== undefined || body.tool_choice !== undefined || body.output_config !== undefined) return;
  const firstStage = Array.isArray(body.stop_sequences) && body.stop_sequences.length === 1 && body.stop_sequences[0] === '</block>';
  if (!firstStage && body.stop_sequences !== undefined) return;
  if (!Array.isArray(body.system) || body.system.length !== 2 || body.system[1]!.type !== 'text' || typeof body.system[1]!.text !== 'string') return;
  const text = body.system[1]!.text;
  if (text.length > 160000) return;
  let valid = true, replacements = 0;
  // 只开放官方声明的规则列表插槽；其余整段静态内容仍须逐字节符合固定摘要。
  const normalized = text.replace(/^- User Deny Rules:[^\r\n]*/gm, line => {
    const boundary = line.indexOf('. Each rule names');
    const rules = line.slice(DENY_PREFIX.length, boundary);
    if (++replacements > 1 || !line.startsWith(DENY_PREFIX) || line.length > 16384 || !/^`[^`\r\n]+`(?:, `[^`\r\n]+`)*$/.test(rules) || digest(line.slice(boundary)) !== DENY_SUFFIX_SHA) { valid = false; return line; }
    return '';
  });
  if (!valid || digest(normalized) !== SYSTEM_SHA) return;
  if (body.messages.length < 1 || body.messages.length > 2 || body.messages.some(m => m.role !== 'user' || !Array.isArray(m.content) || !m.content.every(b => b.type === 'text' && typeof b.text === 'string'))) return;
  const blocks = body.messages.at(-1)!.content;
  if (!Array.isArray(blocks) || blocks.length < 4 || blocks[0]!.text !== '<transcript>\n' || blocks.at(-2)!.text !== '</transcript>\n') return;
  const footer = blocks.at(-1)!.text;
  if (typeof footer !== 'string' || digest(footer) !== (firstStage ? FOOTER_S1_SHA : FOOTER_S2_SHA)) return;
  // 官方各阶段的输出上限还会叠加思考预算，预算值本身不是分类身份。
  return { purpose: 'auto_permission_classifier', source: 'native_profile', profile: firstStage ? 'cc293-auto-mode-xml-s1' : 'cc293-auto-mode-xml-s2' };
}
