import type { BaziChart, PillarKey } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import {
  BRANCH_HANGUL,
  BRANCH_HANZI,
  formatDateTime,
  STEM_ELEMENT,
  STEM_HANGUL,
  STEM_HANZI,
} from '../bazi/glyphs.ts'
import { ELEMENT_LABEL, PILLAR_LABEL } from '../bazi/labels.ts'
import { PILLAR_ORDER } from '../charts/layout/pillars.ts'
import { shareCardBrand, shareCardCommon } from './common.ts'
import type { ShareCardModel, ShareCardPillar } from './model.ts'

// 八字（繁简首页）与만세력（韩语首页）的分享图模型：四柱 + 日主强弱 + 用神喜神，
// 文字全部取自结果区块现有文案，不新增命理判断；不读取出生地。

/** 出生日期（时辰未知时只写日期），取标准时间而非真太阳时校正后的时间，与访客输入一致 */
function baziBirth(chart: BaziChart): string {
  const { year, month, day, hour, minute } = chart.time.standard
  return formatDateTime(chart.hourKnown ? { year, month, day, hour, minute } : { year, month, day })
}

export function baziShareCard(
  chart: BaziChart,
  tool: 'bazi' | 'manseryeok',
  locale: 'zh-Hant' | 'zh-Hans' | 'ko',
): ShareCardModel {
  const korean = locale === 'ko'
  const order: readonly PillarKey[] = korean ? PILLAR_ORDER.korean : PILLAR_ORDER.chinese
  const pillars: ShareCardPillar[] = order.map((key) => {
    const pillar = chart.pillars[key]
    return {
      label: PILLAR_LABEL[key](),
      stem: pillar ? STEM_HANZI[pillar.stem] : null,
      branch: pillar ? BRANCH_HANZI[pillar.branch] : null,
      stemReading: pillar && korean ? STEM_HANGUL[pillar.stem] : undefined,
      branchReading: pillar && korean ? BRANCH_HANGUL[pillar.branch] : undefined,
      day: key === 'day',
    }
  })
  const [primary, secondary] = chart.useful.favorable
  const title = tool === 'manseryeok' ? m.share_card_title_manseryeok : m.share_card_title_bazi
  const verdict =
    chart.strength.verdict === 'strong' ? m.bazi_strength_strong() : m.bazi_strength_weak()
  const dayMaster = `${STEM_HANZI[chart.dayMaster]}${ELEMENT_LABEL[STEM_ELEMENT[chart.dayMaster]]()}`
  return {
    ...shareCardCommon('east', tool),
    title: title({ brand: shareCardBrand('east') }),
    eyebrow: null,
    body: { kind: 'pillars', pillars },
    headline: `${m.bazi_day_master()} ${dayMaster} · ${verdict}`,
    line: primary
      ? m.bazi_useful_primary({
          primary: ELEMENT_LABEL[primary](),
          secondary: secondary ? ELEMENT_LABEL[secondary]() : '—',
        })
      : '',
    birth: baziBirth(chart),
  }
}
