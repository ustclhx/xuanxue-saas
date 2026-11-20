import { m } from '../../../paraglide/messages.js'
import type { NumerologyToolId } from './routes.ts'

type Copy = () => string

/**
 * 四个工具内页的说明长文（方法、算例、解读、差异或用法各一节）与补充 FAQ。算例由 @xuanxue/numerology 复算；
 * 正文不加链接，页面正文内链数不变。只由 tool-route-page.tsx（工具页组件分包）引用，
 * 不进公共入口包与首页预算；head 不使用长文。
 */
function guides(): Record<NumerologyToolId, readonly [Copy, readonly (readonly [Copy, Copy])[]]> {
  return {
    'numerology-calculator': [
      m.numerology_guide_calc_title,
      [
        [m.numerology_guide_calc_method_h, m.numerology_guide_calc_method],
        [m.numerology_guide_calc_example_h, m.numerology_guide_calc_example],
        [m.numerology_guide_calc_reading_h, m.numerology_guide_calc_reading],
        [m.numerology_guide_calc_differences_h, m.numerology_guide_calc_differences],
      ],
    ],
    'numerology-chart': [
      m.numerology_guide_chart_title,
      [
        [m.numerology_guide_chart_method_h, m.numerology_guide_chart_method],
        [m.numerology_guide_chart_example_h, m.numerology_guide_chart_example],
        [m.numerology_guide_chart_reading_h, m.numerology_guide_chart_reading],
        [m.numerology_guide_chart_lifepath_h, m.numerology_guide_chart_lifepath],
      ],
    ],
    'name-numerology': [
      m.numerology_guide_name_title,
      [
        [m.numerology_guide_name_method_h, m.numerology_guide_name_method],
        [m.numerology_guide_name_example_h, m.numerology_guide_name_example],
        [m.numerology_guide_name_reading_h, m.numerology_guide_name_reading],
        [m.numerology_guide_name_choice_h, m.numerology_guide_name_choice],
      ],
    ],
    'life-path-compatibility': [
      m.numerology_guide_compat_title,
      [
        [m.numerology_guide_compat_method_h, m.numerology_guide_compat_method],
        [m.numerology_guide_compat_example_h, m.numerology_guide_compat_example],
        [m.numerology_guide_compat_reading_h, m.numerology_guide_compat_reading],
        [m.numerology_guide_compat_use_h, m.numerology_guide_compat_use],
      ],
    ],
  }
}

/**
 * 补充 FAQ：在页面上接在 copy.ts toolFaq 之后显示。为不增加首页与入口包，head 的 FAQPage 仍只用 toolFaq
 * （FAQPage 是可见问答的子集）。
 */
const EXTRA_FAQ: Record<NumerologyToolId, readonly (readonly [Copy, Copy])[]> = {
  'numerology-calculator': [[m.numerology_faq_calc_q4, m.numerology_faq_calc_a4]],
  'numerology-chart': [
    [m.numerology_faq_chart_q3, m.numerology_faq_chart_a3],
    [m.numerology_faq_chart_q4, m.numerology_faq_chart_a4],
  ],
  'name-numerology': [
    [m.numerology_faq_name_q3, m.numerology_faq_name_a3],
    [m.numerology_faq_name_q4, m.numerology_faq_name_a4],
  ],
  'life-path-compatibility': [
    [m.numerology_faq_compat_q3, m.numerology_faq_compat_a3],
    [m.numerology_faq_compat_q4, m.numerology_faq_compat_a4],
  ],
}

export function numerologyToolExtraFaq(id: NumerologyToolId) {
  return EXTRA_FAQ[id].map(([question, answer]) => ({ question: question(), answer: answer() }))
}

export function numerologyToolGuide(id: NumerologyToolId) {
  const [title, sections] = guides()[id]
  return {
    title: title(),
    sections: sections.map(([heading, body]) => ({
      heading: heading(),
      body: body(),
    })),
  }
}
