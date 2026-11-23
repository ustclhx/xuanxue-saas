/**
 * 토정비결工具页的界面文案（只有 ko，合쇼체）。说明长文、FAQ 与 TDK 在 content/tojeong/ko/index.mdx。
 * 合规声明沿用站上「依据传统方法推算、仅供参考与潜意识探索、不预测未来」的 ko 对应说法。
 */
export const TOJEONG_COPY = {
  home: '홈',
  toolCrumb: '토정비결',
  formLabel: '생년월일 입력',
  calendar: '달력',
  solar: '양력',
  lunar: '음력',
  birthDate: '생년월일',
  year: '년',
  month: '월',
  day: '일',
  leapMonth: '윤달',
  targetYear: '보고 싶은 해',
  targetYearOption: (year: number) => `${year}년`,
  hint: '브라우저에서 계산하며 회원 가입이 필요 없습니다. 생년월일은 저장하지 않습니다.',
  submit: '토정비결 무료로 보기',
  invalidDate:
    '생년월일을 다시 확인해 주십시오. 1900년부터 2100년 사이의 실제 날짜만 계산할 수 있습니다.',
  invalidLeap: '그해 그 달에는 윤달이 없습니다. 윤달 표시를 해제하고 다시 계산해 주십시오.',
  invalidTarget: '보고 싶은 해는 태어난 해와 같거나 그 뒤여야 합니다.',
  solarNote: (year: number, month: number, day: number, leap: boolean) =>
    `양력으로 입력하신 날짜를 음력 ${year}년 ${leap ? '윤' : ''}${month}월 ${day}일로 바꾸어 계산했습니다.`,
  lunarNote: (year: number, month: number, day: number, leap: boolean) =>
    `음력 ${year}년 ${leap ? '윤' : ''}${month}월 ${day}일로 계산했습니다.`,
  leapNote: '윤달에 태어나신 경우 같은 숫자의 평달로 보아 계산합니다.',
  shortMonthNote: (year: number, month: number) =>
    `${year}년 음력 ${month}월은 29일까지만 있어 생일을 29일로 보아 하괘를 계산했습니다.`,
  resultTitle: (year: number) => `${year}년 괘`,
  gwaeLabel: '괘 번호',
  sang: '상괘',
  jung: '중괘',
  ha: '하괘',
  sangBasis: '나이',
  jungBasis: '생월',
  haBasis: '생일',
  ageLabel: (year: number) => `${year}년 나이`,
  ageValue: (age: number) => `${age}세 (세는나이)`,
  workings: (r: {
    countingAge: number
    taeseNumber: number
    sang: number
    monthDays: number
    wolgeonNumber: number
    jung: number
    day: number
    iljinNumber: number
    ha: number
  }) => [
    `상괘: 나이 ${r.countingAge} + 태세수 ${r.taeseNumber} = ${r.countingAge + r.taeseNumber}, 8로 나눈 나머지 → ${r.sang}`,
    `중괘: 생월 날수 ${r.monthDays} + 월건수 ${r.wolgeonNumber} = ${r.monthDays + r.wolgeonNumber}, 6으로 나눈 나머지 → ${r.jung}`,
    `하괘: 생일 ${r.day} + 일진수 ${r.iljinNumber} = ${r.day + r.iljinNumber}, 3으로 나눈 나머지 → ${r.ha}`,
  ],
  workingsTitle: '계산 과정',
  summaryTitle: '총평',
  themesTitle: '올해 돌아볼 주제',
  themes: { work: '일과 배움', people: '사람과 관계', self: '생활과 마음' },
  loading: '풀이를 불러오는 중입니다.',
  loadFailed: '풀이를 불러오지 못했습니다. 잠시 후 다시 시도해 주십시오.',
  sharedNote: (year: number) =>
    `공유받은 링크의 ${year}년 괘입니다. 생년월일은 링크에 담겨 있지 않습니다. 직접 계산하시려면 위에 생년월일을 입력해 주십시오.`,
  copyLink: '결과 링크 복사',
  copied: '복사했습니다',
  copyHint: '링크에는 괘 번호와 연도만 담기며 생년월일은 포함되지 않습니다.',
  disclaimer:
    '전통 방법에 따라 계산한 결과이며, 참고와 잠재의식 탐색을 위한 것으로 미래를 예측하지 않습니다. 건강 문제는 전문의와 상담하시기 바랍니다.',
  faqTitle: '자주 묻는 질문',
  relatedTitle: '관련 도구',
  yearlyLink: {
    before: '같은 해를 타고난 사주 전체로 살펴보고 싶으시면 ',
    anchor: '2027 신년 사주',
    after: '에서 일간과 세운의 관계를 함께 확인하실 수 있습니다.',
  },
} as const
