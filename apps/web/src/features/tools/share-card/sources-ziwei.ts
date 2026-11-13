import type { ZiweiChart } from '@xuanxue/bazi/ziwei'
import { m } from '../../../paraglide/messages.js'
import { formatDateTime } from '../bazi/glyphs.ts'
import { STAR_LABEL } from '../bazi/ziwei-labels.ts'
import { ziweiCenterText } from '../charts/ziwei-chart.tsx'
import { shareCardBrand, shareCardCommon } from './common.ts'
import type { ShareCardModel } from './model.ts'

// 紫微的分享图模型：图形克隆页面中已渲染的十二宫盘（design D5），结论为五行局、命身宫与命宫主星。
// 盘中宫的出生时间带 data-birth，未勾选「显示出生日期」时由分享图模块移除。

export function ziweiShareCard(chart: Extract<ZiweiChart, { status: 'ok' }>): ShareCardModel {
  const soul = chart.palaces.find((palace) => palace.key === 'soul')
  const stars = soul?.majorStars.map((star) => STAR_LABEL[star.star]()) ?? []
  return {
    ...shareCardCommon('east', 'ziwei'),
    title: m.share_card_title_ziwei({ brand: shareCardBrand('east') }),
    eyebrow: null,
    body: { kind: 'chart', chart: 'ziwei-palaces' },
    headline: ziweiCenterText(chart),
    line: m.share_card_ziwei_stars({
      stars: stars.length > 0 ? stars.join(m.share_card_list_separator()) : m.bazi_ziwei_empty(),
    }),
    birth: formatDateTime(chart.used),
  }
}
