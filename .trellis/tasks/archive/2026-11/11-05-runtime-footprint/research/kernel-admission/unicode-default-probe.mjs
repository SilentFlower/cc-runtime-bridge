const text = '中文测试 日本語 ภาษาไทย العربية e\u0301 👨‍👩‍👧‍👦 🏳️‍🌈';
const result = {
  locale: new Intl.NumberFormat().resolvedOptions().locale,
  number: new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(12345.67),
  date: new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', dateStyle: 'full' }).format(new Date('2026-11-05T00:00:00Z')),
  list: new Intl.ListFormat().format(['甲', '乙', '丙']),
  normalized: text.normalize('NFKC'),
  upper: text.toLocaleUpperCase(),
  segments: Object.fromEntries(['en', 'zh', 'ja', 'th', 'ar'].map(locale => [locale, Object.fromEntries(['word', 'grapheme'].map(granularity => [granularity, [...new Intl.Segmenter(locale, { granularity }).segment(text)].map(row => row.segment)]))])),
};
process.stdout.write(JSON.stringify(result) + '\n');
process.exit(0);
