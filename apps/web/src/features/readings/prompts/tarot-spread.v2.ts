import { TAROT_SPREAD_V1 } from './tarot-spread.v1.ts'

/**
 * 塔罗牌阵详批提示词 v2：沿用 v1 全文，追加 5.1 staging 抽检发现的约束（大阿尔克那张数说错、
 * 繁中夹杂简体字、韩语夹杂汉字数字）。牌数据新增 arcana 字段（引擎 tarot@2）。system 仍固定。
 */
const VERSION = 'tarot-spread.v2'

const en = {
  ...TAROT_SPREAD_V1.en,
  version: VERSION,
  system: `${TAROT_SPREAD_V1.en.system}

## Accuracy (must follow)
- Each card has arcana "major" (Major Arcana) or "minor" (Minor Arcana). When you count or contrast Major and Minor Arcana cards, use this field exactly.
- Keep every card name, position and orientation exactly as given.`,
} as const

const zhHant = {
  ...TAROT_SPREAD_V1['zh-Hant'],
  version: VERSION,
  system: `${TAROT_SPREAD_V1['zh-Hant'].system}

## 用字與資料一致（必須遵守）
- 每張牌的 arcana 為 major（大阿爾克那）或 minor（小阿爾克那）；提到大牌、小牌或其張數時以此為準。
- 只使用台灣慣用的繁體字，不得夾雜任何簡體字，也不要夾雜英文單字。容易寫錯的字例如：與、後、點、話、認、換、願、邊、鬆（放鬆）。`,
} as const

const ko = {
  ...TAROT_SPREAD_V1.ko,
  version: VERSION,
  system: `${TAROT_SPREAD_V1.ko.system}

## 표기와 데이터 일치(반드시 지킬 것)
- 각 카드의 arcana는 major(메이저 아르카나) 또는 minor(마이너 아르카나)입니다. 메이저·마이너 카드를 세거나 구분할 때는 이 값을 그대로 따르세요.
- 숫자는 아라비아 숫자나 한글로 쓰고, 한자나 영어 단어를 섞지 마세요.`,
} as const

export const TAROT_SPREAD_V2 = { en, 'zh-Hant': zhHant, ko } as const
