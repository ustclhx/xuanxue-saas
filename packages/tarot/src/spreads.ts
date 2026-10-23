import type { Locale, Position, Spread, SpreadId } from './types.ts'

function positions(entries: readonly (readonly [string, string])[]): Position[] {
  return entries.map(([name, meaning]) => ({ name, meaning }))
}
const daily = {
  en: positions([['Daily reflection', 'A theme to reflect on today, not a forecast.']]),
  'zh-Hant': positions([['每日省思', '今天可反思的主題，不是預測。']]),
  'zh-Hans': positions([['每日省思', '今天可反思的主题，不是预测。']]),
  ko: positions([['오늘의 성찰', '예측이 아닌 오늘 돌아볼 주제입니다.']]),
}
const yesNo = {
  en: positions([
    ['Yes / No / Maybe', 'A symbolic prompt from the fixed card mapping, not a factual answer.'],
  ]),
  'zh-Hant': positions([['是／否／也許', '來自固定牌義對照的象徵提示，不是事實答案。']]),
  'zh-Hans': positions([['是／否／也许', '来自固定牌义对照的象征提示，不是事实答案。']]),
  ko: positions([
    ['예 / 아니요 / 아마도', '고정 카드 해석의 상징적 안내이며 사실 판단이 아닙니다.'],
  ]),
}
const threeCard = {
  en: positions([
    ['Past', 'Experiences that shaped the question.'],
    ['Present', 'What deserves attention now.'],
    ['Future', 'A possible direction to consider, not a prediction.'],
  ]),
  'zh-Hant': positions([
    ['過去', '影響此問題的經驗。'],
    ['現在', '當下值得留意的事。'],
    ['未來', '可思考的方向，不代表預測。'],
  ]),
  'zh-Hans': positions([
    ['过去', '影响此问题的经验。'],
    ['现在', '当下值得留意的事。'],
    ['未来', '可思考的方向，不代表预测。'],
  ]),
  ko: positions([
    ['과거', '질문에 영향을 준 경험입니다.'],
    ['현재', '지금 주목할 점입니다.'],
    ['미래', '예측이 아닌 생각해 볼 방향입니다.'],
  ]),
}
const celticCross = {
  en: positions([
    ['Present', 'The central situation.'],
    ['Challenge', 'A tension or obstacle to explore.'],
    ['Foundation', 'Underlying influences.'],
    ['Recent past', 'Experiences carried into this moment.'],
    ['Conscious focus', 'An intention or aspiration.'],
    ['Possible direction', 'A path to consider, not a forecast.'],
    ['Your approach', 'Your stance toward the question.'],
    ['Environment', 'Surrounding influences and support.'],
    ['Hopes and fears', 'Expectations that color your perspective.'],
    ['Integration', 'A theme to reflect on as you choose your next step.'],
  ]),
  'zh-Hant': positions([
    ['現況', '當前核心情境。'],
    ['挑戰', '值得探索的張力或阻礙。'],
    ['根基', '潛在影響。'],
    ['近因', '延續至今的經驗。'],
    ['意識焦點', '目標或期望。'],
    ['可能方向', '可思考的路徑，不是預測。'],
    ['自身態度', '你面對問題的立場。'],
    ['環境', '周遭影響與支持。'],
    ['希望與恐懼', '影響觀點的期待。'],
    ['整合', '選擇下一步時可反思的主題。'],
  ]),
  'zh-Hans': positions([
    ['现况', '当前核心情境。'],
    ['挑战', '值得探索的张力或阻碍。'],
    ['根基', '潜在影响。'],
    ['近因', '延续至今的经验。'],
    ['意识焦点', '目标或期望。'],
    ['可能方向', '可思考的路径，不是预测。'],
    ['自身态度', '你面对问题的立场。'],
    ['环境', '周遭影响与支持。'],
    ['希望与恐惧', '影响观点的期待。'],
    ['整合', '选择下一步时可反思的主题。'],
  ]),
  ko: positions([
    ['현재 상황', '질문의 중심 상황입니다.'],
    ['과제', '살펴볼 긴장이나 장애물입니다.'],
    ['기반', '밑바탕의 영향입니다.'],
    ['최근 과거', '지금까지 이어진 경험입니다.'],
    ['의식의 초점', '의도나 바람입니다.'],
    ['가능한 방향', '예측이 아닌 고려할 경로입니다.'],
    ['자신의 태도', '질문을 대하는 자세입니다.'],
    ['환경', '주변의 영향과 지원입니다.'],
    ['희망과 두려움', '관점에 영향을 주는 기대입니다.'],
    ['통합', '다음 행동을 선택하며 성찰할 주제입니다.'],
  ]),
}
export const SPREADS: Readonly<Record<SpreadId, Spread>> = {
  daily: { id: 'daily', positions: daily },
  'yes-or-no': { id: 'yes-or-no', positions: yesNo },
  'three-card': { id: 'three-card', positions: threeCard },
  'celtic-cross': { id: 'celtic-cross', positions: celticCross },
}
export function spreadPositions(id: SpreadId, locale: Locale): readonly Position[] {
  return SPREADS[id].positions[locale]
}
