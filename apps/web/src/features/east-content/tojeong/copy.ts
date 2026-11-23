/**
 * 토정비결工具页的界面文案（只有 ko，合쇼체）。说明长文、FAQ 与 TDK 在 content/tojeong/ko/index.mdx。
 * 合规声明沿用韩语站的「참고와 자기 탐색」表述。
 */
export const TOJEONG_COPY = {
  home: '홈',
  toolCrumb: '토정비결',
  formLabel: '생년월일 입력',
  calendar: '양력·음력',
  solar: '양력',
  lunar: '음력',
  birthDate: '생년월일',
  year: '년',
  month: '월',
  day: '일',
  leapMonth: '윤달',
  targetYear: '보고 싶은 해',
  targetYearOption: (year: number) => `${year}년`,
  hint: '가입 없이 브라우저에서 계산합니다. 생년월일은 저장하지 않습니다.',
  submit: '토정비결 무료로 보기',
  invalidDate:
    '생년월일을 확인해 주십시오. 1900년부터 2100년 사이의 유효한 날짜를 입력하실 수 있습니다.',
  invalidLeap: '입력하신 해에 해당 윤달이 없습니다. 생년월일과 윤달 표시를 확인해 주십시오.',
  invalidTarget: '음력으로 태어난 해와 같거나 그 이후의 해를 선택해 주십시오.',
  solarNote: (year: number, month: number, day: number, leap: boolean) =>
    `양력으로 입력하신 날짜를 음력 ${year}년 ${leap ? '윤' : ''}${month}월 ${day}일로 바꾸어 계산했습니다.`,
  lunarNote: (year: number, month: number, day: number, leap: boolean) =>
    `음력 ${year}년 ${leap ? '윤' : ''}${month}월 ${day}일로 계산했습니다.`,
  leapNote: '윤달 생일은 선택하신 해의 같은 달 평달을 기준으로 계산했습니다.',
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
  ageValue: (age: number) => `${age}세(세는 나이)`,
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
    `상괘: 세는 나이 ${r.countingAge} + 태세수 ${r.taeseNumber} = ${r.countingAge + r.taeseNumber}, 8로 나눈 나머지 ${r.sang % 8} → ${r.sang}`,
    `중괘: 그해 생월의 전체 일수 ${r.monthDays} + 월건수 ${r.wolgeonNumber} = ${r.monthDays + r.wolgeonNumber}, 6으로 나눈 나머지 ${r.jung % 6} → ${r.jung}`,
    `하괘: 계산에 쓴 생일 ${r.day}일 + 일진수 ${r.iljinNumber} = ${r.day + r.iljinNumber}, 3으로 나눈 나머지 ${r.ha % 3} → ${r.ha}`,
  ],
  workingsTitle: '계산 과정',
  summaryTitle: '총평',
  themesTitle: '올해 돌아볼 주제',
  themes: { work: '일과 배움', people: '사람과 관계', self: '생활과 마음' },
  loading: '풀이를 불러오는 중입니다.',
  loadFailed: '풀이를 불러오지 못했습니다. 잠시 후 다시 시도해 주십시오.',
  sharedNote: (year: number) =>
    `공유 링크에 담긴 ${year}년 괘입니다. 본인의 괘는 위에 생년월일을 입력해 계산하실 수 있습니다.`,
  copyLink: '결과 링크 복사',
  copied: '복사했습니다',
  copyHint: '링크에는 괘 번호와 연도만 담기며 생년월일은 포함되지 않습니다.',
  disclaimer:
    '전통 규칙에 따라 계산한 결과입니다. 참고와 자기 탐색을 위한 것이며 미래를 예측하지 않습니다. 건강 문제는 전문의와 상담하시기 바랍니다.',
  faqTitle: '자주 묻는 질문',
  relatedTitle: '관련 도구',
  yearlyLink: {
    before: '2027년을 사주로 살펴보시려면 ',
    anchor: '2027 신년 사주',
    after: '에서 일간과 세운의 관계를 함께 확인하실 수 있습니다.',
  },
} as const
