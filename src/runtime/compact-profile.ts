/** 固定登记的精简产物身份；CLI 候选须完成任务验收，外部 manifest 不能自行添加授信。 */
export const COMPACT_RUNTIMES: readonly { launcherSha256: string; imageSha256: string; imageBytes: number }[] = [
  { launcherSha256: '20f3cb6d928aaf9c863275a02a99a4244fa6db7e5a6b1e957af8bedf1a2605f9', imageSha256: '67a49e01124d189620ce630c198f0c3db074649ebe93e895d4a87ca8c80966f2', imageBytes: 112831672 },
  { launcherSha256: 'a8a3bc686830c8e8c065eb0dae4e10741ef1b05ab6cfdf7a5f7786ba8fdaa670', imageSha256: 'c69e297c6e9f320de8cfd29b4b45649c50d3f7be8e8fb4156d7e6e7eabcf0ea4', imageBytes: 112786616 },
  { launcherSha256: '9573d2b95d8da1840619e934963bdd2f6e19fbc416ffbae4ab453fa64ac0c8c1', imageSha256: '92db6d58144c1ff12be157d2044da620318a6de54caf98b5b64826a5ab77c36d', imageBytes: 112786616 },
];
