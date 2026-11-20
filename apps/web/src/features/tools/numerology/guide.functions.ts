import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { m } from '../../../paraglide/messages.js'
import { NUMEROLOGY_LOCALE, NUMEROLOGY_TOOLS, type NumerologyToolId } from './routes.ts'

type Copy = (inputs: Record<string, never>, options: { locale: 'en' }) => string

/**
 * 四个工具内页的说明长文（方法、算例、解读、差异或用法各一节）与补充 FAQ。算例由 @xuanxue/numerology 复算；
 * 正文不加链接，页面正文内链数不变。文案只在服务端取出：页面预渲染为静态 HTML，客户端路由跳转时
 * 才调用，长文案不进公共入口包与首页预算（与 content.functions.ts 的数字页正文相同）。
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

/** 补充 FAQ：接在 copy.ts toolFaq 的原有问答之后，页面与 FAQPage 同用 */
function extraFaq(): Record<NumerologyToolId, readonly (readonly [Copy, Copy])[]> {
  return {
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
}

const TOOL_IDS = Object.keys(NUMEROLOGY_TOOLS) as [NumerologyToolId, ...NumerologyToolId[]]

export const getNumerologyToolGuide = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.enum(TOOL_IDS) }))
  .handler(({ data }) => {
    const options = { locale: NUMEROLOGY_LOCALE } as const
    const [title, sections] = guides()[data.id]
    return {
      title: title({}, options),
      sections: sections.map(([heading, body]) => ({
        heading: heading({}, options),
        body: body({}, options),
      })),
      faq: extraFaq()[data.id].map(([question, answer]) => ({
        question: question({}, options),
        answer: answer({}, options),
      })),
    }
  })

export type NumerologyToolGuide = Awaited<ReturnType<typeof getNumerologyToolGuide>>
