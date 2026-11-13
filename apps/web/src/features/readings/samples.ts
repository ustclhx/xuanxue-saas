import type { ReadingKind } from '@xuanxue/db'

/**
 * 详批样例段落（product-improve-ai-content-20261030 tasks 3.2 / D11）：人工撰写，不调用模型、不引用访客数据。
 * 东方站各详批基于首页同一张虚构样例命盘（1990-05-15 10:30 台北 男：庚午 辛巳 庚辰 辛巳，
 * 见 tools/charts/samples.ts）；궁합另配一张虚构命盘（1992-03-08 14:00 台北 女：壬申 癸卯 癸未 己未）；
 * 西方站灵数用 1990-05-15（Life Path 3）；塔罗用虚构牌阵（隐者正位 / 钱币八正位 / 权杖王牌正位）。
 * 段落中的柱位、十神、五行占比、宫位与数字均取自引擎对上述输入的计算结果，引擎规则变化时需复核。
 *
 * 独立成文件、只含字符串：首页枢纽（marketing/home-hub/sample.ts）复用同一份段落，
 * 不能为此把含全部提示词的 catalog 打进首页包。
 */

/**
 * 使用者审定开关（D11）：审定前为 false，解锁卡与首页枢纽都不渲染样例段落；
 * catalog 仍保留全文，供合规与长度测试检查。审定通过后改为 true。
 */
export const SAMPLES_APPROVED = false

export const READING_SAMPLES = {
  'bazi-full': {
    'zh-Hant':
      '示例命盤四柱為庚午、辛巳、庚辰、辛巳，日主庚金生於巳月。年干庚金比肩，月干與時干兩見辛金劫財，金約佔五行的五成六，綜合判為身強；月令巳火藏丙火七殺，像爐火鍛金，壓力同時也是成形的力量。喜用取水、木、火，原局缺水、缺木，代表表達與財星都需要主動經營，才能把一身硬底子轉成看得見的成果。',
    'zh-Hans':
      '示例命盘四柱为庚午、辛巳、庚辰、辛巳，日主庚金生于巳月。年干庚金比肩，月干与时干两见辛金劫财，金约占五行的五成六，综合判为身强；月令巳火藏丙火七杀，像炉火锻金，压力同时也是成形的力量。喜用取水、木、火，原局缺水、缺木，代表表达与财星都需要主动经营，才能把一身硬底子转成看得见的成果。',
  },
  'saju-full': {
    ko: '예시 명식은 경오·신사·경진·신사로, 사월생 경금 일간입니다. 연간 경금 비견에 월간·시간의 신금 겁재가 더해져 금이 오행의 약 56%를 차지하니 신강으로 봅니다. 월지 사화에 숨은 병화 칠살은 쇠를 단련하는 불이라 부담이자 성장의 동력입니다. 용신은 수·목·화인데 원국에 수와 목이 없어, 표현과 재물의 통로를 넓히는 것이 과제입니다.',
  },
  'ziwei-full': {
    'zh-Hant':
      '示例命盤命宮在子，破軍居廟坐命；身宮落在戌位夫妻宮，武曲居廟並化權，五行局為火六局。破軍重開創，不甘於舊有格局；武曲化權把這股衝勁導向務實與擔當，一破一立，形成先拆解、再重建的做事節奏。年干庚引太陽化祿入兄弟宮、天同化忌入子女宮，提示同輩人脈是可借的資源，對晚輩與創作的投入則宜拿捏分寸。',
    'zh-Hans':
      '示例命盘命宫在子，破军居庙坐命；身宫落在戌位夫妻宫，武曲居庙并化权，五行局为火六局。破军重开创，不甘于旧有格局；武曲化权把这股冲劲导向务实与担当，一破一立，形成先拆解、再重建的做事节奏。年干庚引太阳化禄入兄弟宫、天同化忌入子女宫，提示同辈人脉是可借的资源，对晚辈与创作的投入则宜拿捏分寸。',
  },
  'saju-compat': {
    ko: '예시 궁합은 경금 일간(경오·신사·경진·신사)과 계수 일간(임신·계묘·계미·기미)의 만남입니다. 금이 강한 경금은 수가, 신약한 계수는 금이 필요해 금생수로 서로의 용신을 채우는 구조입니다. 오행 보완에서 양쪽 모두 가점을 받아 60점에서 80점이 되었습니다. 다만 직설적인 경금과 섬세한 계수는 속도가 달라 대화의 온도를 맞춰야 합니다.',
  },
  'numerology-full': {
    en: "In this sample chart, the birth date 1990-05-15 reduces to Life Path 3 (1+9+9+0+5+1+5 = 30, then 3+0). Three is the number of expression, sociability and creative range, and it does best when ideas move from conversation into finished work. The Birthday number 6, from the 15th, adds a steady sense of responsibility toward the people close by, which helps balance the 3's tendency to scatter energy across too many projects at once.",
  },
  'tarot-spread': {
    en: 'This sample three-card spread asks about career direction. The Hermit upright sits in the Past, the Eight of Pentacles upright in the Present, and the Ace of Wands upright in the Future. Together they trace a clear line: a stretch of inward reflection, then patient practice that refines a craft, and finally a fresh spark of initiative. The Future card is a direction to consider, not a forecast; it suggests that a new idea deserves a real first step once the groundwork feels solid.',
    'zh-Hant':
      '示例牌陣以「職涯方向」為題：過去位置是隱者正位，現在是錢幣八正位，未來是權杖王牌正位。三張牌串起一條清楚的線：先有一段向內沉澱、釐清自己要什麼的時期，接著以練習與勤勉把手上的技藝磨細；權杖王牌落在「可思考的方向」，提醒新的靈感值得認真跨出第一步，而不是一個保證的結果。',
    'zh-Hans':
      '示例牌阵以“职涯方向”为题：过去位置是隐者正位，现在是钱币八正位，未来是权杖王牌正位。三张牌串起一条清楚的线：先有一段向内沉淀、厘清自己要什么的时期，接着以练习与勤勉把手上的技艺磨细；权杖王牌落在“可思考的方向”，提醒新的灵感值得认真迈出第一步，而不是一个保证的结果。',
    ko: '예시 스프레드의 질문은 진로 방향입니다. 과거에 은둔자, 현재에 펜타클 8, 미래에 완드 에이스가 모두 정방향으로 놓였습니다. 세 장을 이어 보면 먼저 안으로 물러나 원하는 바를 정리한 시기가 있었고, 지금은 연습과 성실함으로 기술을 다듬는 단계입니다. 완드 에이스는 예측이 아닌 생각해 볼 방향으로, 새 영감에 첫걸음을 내디뎌 볼 만하다는 신호입니다.',
  },
} as const satisfies Record<ReadingKind, Readonly<Record<string, string>>>

export type ReadingSampleKind = keyof typeof READING_SAMPLES

/** 某种详批在某语言下的样例全文；不存在时为空字符串（不受审定开关影响） */
export function readingSampleText(kind: string, locale: string): string {
  if (!Object.hasOwn(READING_SAMPLES, kind)) return ''
  const byLocale: Readonly<Record<string, string>> = READING_SAMPLES[kind as ReadingSampleKind]
  return Object.hasOwn(byLocale, locale) ? (byLocale[locale] ?? '') : ''
}
