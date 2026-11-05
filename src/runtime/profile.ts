import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** 唯一已验证的官方程序与其内部接口，升级必须重新验证。 */
export const PROFILE_293 = {
  version: '2.1.293',
  sha256: '8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978',
  modules: {
    core: '/$bunfs/root/chunk-g263vvvn.js',
    api: '/$bunfs/root/chunk-aqh2c7wz.js',
    context: '/$bunfs/root/chunk-cxjvwxsa.js',
    state: '/$bunfs/root/chunk-g79wjybr.js',
    permissions: '/$bunfs/root/chunk-vecj8twx.js',
  },
} as const;

/** 核对实际程序，不通过执行真实账号请求判断版本。
 * @param path 官方程序路径。
 * @return 完整二进制的 SHA256。
 */
export async function verifyBinary(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const digest = hash.digest('hex');
  if (digest !== PROFILE_293.sha256) throw new Error('官方二进制校验不匹配，仅支持已验证的 2.1.293');
  return digest;
}
