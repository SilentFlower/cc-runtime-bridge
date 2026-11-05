/** 固定登记的精简产物身份；CLI 候选须完成任务验收，外部 manifest 不能自行添加授信。 */
export const COMPACT_RUNTIMES: readonly { launcherSha256: string; imageSha256: string; imageBytes: number }[] = [
  { launcherSha256: 'ae4fd1da7ccdb05aa205539fa998a51ded52a739c75992f5835d596573052ac2', imageSha256: 'd73e858911efbeb78642f0575722c9e6618699107432f3f7902345cbfea60e85', imageBytes: 112778424 },
];
