import type { YearlyToolCopy } from './types.ts'

/**
 * en（东方站根路径英文 `/bazi-2027`）：按英文搜索习惯另写，术语以 i18n/glossary/en-east.json 为准
 * （Day Master、Ten Gods、luck pillars、annual pillar、favorable element）。
 */
export const COPY: YearlyToolCopy = {
  seo: {
    title: 'BaZi 2027: Your Chart in the Fire Goat Year',
    description:
      'Free BaZi 2027 calculator: how the Fire Goat year meets your Four Pillars: Ten Gods, clashes and combinations, luck pillar, Tai Sui and favorable elements.',
  },
  crumb: 'BaZi 2027',
  h1: 'BaZi 2027: How the Fire Goat Year Meets Your Chart',
  intro:
    'Enter your birth details to build your Four Pillars chart, then see how the 2027 annual pillar, Ding Wei (丁未), relates to your Day Master, each pillar and your current luck pillar. The Fire Goat year begins at the Beginning of Spring on February 4, 2027.',
  submit: 'See my 2027 chart',
  result: {
    natalTitle: 'Your Four Pillars',
    yearTitle: '2027 annual pillar',
    yearSpan: 'From the Beginning of Spring on 2027-02-04 to 2028-02-04',
    yearLabel: 'Annual',
    tenGodTitle: 'Ten Gods of the year',
    tenGodLead: 'Measured against your Day Master, {dm}; the branch uses its main hidden stem.',
    tenGodCols: ['2027', 'Ten God', 'Element', 'Role'],
    stemRow: 'Stem {gz}',
    branchRow: 'Branch {gz}',
    hiddenNote: 'Other hidden stems: {list}.',
    favorable: 'Favorable',
    unfavorable: 'Unfavorable',
    relTitle: 'Combinations and clashes with your pillars and luck pillar',
    relLead:
      'Stems are checked for combinations; branches for Six Harmony, Three Harmony, clash and punishment.',
    relCols: ['Pillar', 'Relation'],
    decadeLabel: 'Luck pillar',
    decadeValue: 'Luck pillar {gz}',
    decadeStart: 'A new luck pillar begins in 2027',
    noDecade:
      'In 2027 your first luck pillar has not started yet, or the year falls after the tenth one, so this row is skipped.',
    relTypes: {
      stemCombine: 'Stem combination',
      sixCombine: 'Six Harmony',
      triad: 'Three Harmony (same frame)',
      clash: 'Clash',
      punish: 'Punishment',
    },
    relNone: 'None',
    relSeparator: ', ',
    taiSuiTitle: 'Tai Sui',
    taiSuiZhi:
      'Your year branch is the same as the 2027 branch, {branch}. Tradition calls this meeting Tai Sui.',
    taiSuiChong:
      'Your year branch {natal} clashes with the 2027 branch {branch}. Tradition calls this clashing with Tai Sui.',
    taiSuiNone:
      'Your year branch {natal} neither matches nor clashes with the 2027 branch {branch}.',
    favorTitle: 'Favorable or not',
    favorText:
      'Using the support-and-restrain method, the 2027 stem ({stemEl}) is {stemRole} and the branch ({branchEl}) is {branchRole} for your chart.',
    ruleNote:
      'Only relations that match a rule are listed. How much weight each one carries depends on the strength and favorable elements of the whole chart.',
    approximate:
      'No birth time entered: the result uses the year, month and day pillars only, and the start of your luck pillars is estimated, so treat it as approximate.',
    unlockLead:
      'The full reading goes through the Ten Gods, combinations and luck pillar of 2027 for your own chart, and includes a year-by-year chapter.',
  },
  article: {
    title: 'Reading your 2027 BaZi',
    sections: [
      {
        heading: 'When does the Fire Goat year start?',
        body: 'In BaZi the year does not turn on January 1 or on Lunar New Year. It turns at the Beginning of Spring (Li Chun), the solar term that opens the year. In 2027 that falls on February 4, two days before Lunar New Year on February 6. From that day the year pillar changes from Bing Wu (丙午, Fire Horse) to Ding Wei (丁未, Fire Goat), and it stays Ding Wei until the Beginning of Spring on February 4, 2028. If you were born in January or early February, your own year pillar may belong to the previous year, and so may your Chinese zodiac animal.\n\nDing is yin Fire and Wei is yin Earth. Inside Wei sit three hidden stems: Ji Earth as the main one, Ding Fire and Yi Wood as the minor ones. The Na Yin sound for the pair is Heavenly River Water. These facts are the same for everyone. What differs is where Ding Wei lands in your own Heavenly Stems and Earthly Branches.',
      },
      {
        heading: 'How the calculator works',
        body: 'First it builds your Four Pillars from the birth date, time and place you enter. The month pillar changes at each solar term, and the hour pillar uses local clock time at the birthplace, with an option for true solar time.\n\nNext it compares the 2027 stem, Ding, with your Day Master to find its Ten God, and does the same for the main hidden stem of Wei. The two minor hidden stems are listed as well. It then sets Ding Wei against your year, month, day and hour pillars one by one, recording stem combinations and the branch relations Six Harmony, Three Harmony, clash and punishment. The luck pillar you are in during 2027 is checked the same way, and the table notes it if a new luck pillar begins that year.\n\nFinally it looks at Tai Sui and your favorable elements. A year branch that matches the 2027 branch is said to meet Tai Sui; one that clashes with it is said to clash with Tai Sui. Whether Fire and Earth count as favorable comes from the support-and-restrain method used in our BaZi calculator. Everything runs in your browser, and no account is needed.',
      },
      {
        heading: 'How to read the Ten Gods and relations',
        body: 'The Ten Gods are categories for the relationship between the year and your Day Master, not verdicts. In traditional reading, the Officer stars point to rules and responsibility, the Resource stars to support and learning, the Wealth stars to resources and practical matters, Eating God and Hurting Officer to expression and output, and Friend and Rob Wealth to peers and independence. The same Ten God is weighed differently in a strong chart and a weak one, which is why the favorable column sits next to it.\n\nThe relations table lists only what matches a rule. A Six Harmony suggests that pillar and the year pull toward each other; a clash suggests the area that pillar stands for may call for some rearranging. Traditionally the year pillar relates to family and elders, the month pillar to work and social role, the day branch to partners and to yourself, and the hour pillar to children and long-term plans. Use these links as prompts for reflection about where you want to pay attention this year. The results follow traditional rules, are for reference and reflection, and do not predict events.',
      },
      {
        heading: 'If you do not know your birth time',
        body: 'Tick "I don\'t know my birth time" and submit. The calculator then works with three pillars, so relations involving the hour pillar will not appear, and the result is marked as approximate. The age at which luck pillars begin is also calculated from the birth moment, so without it the start is estimated and 2027 could be placed one luck pillar off. If you find your birth time later, enter it again for the full four-pillar result.',
      },
      {
        heading: 'Why this differs from a zodiac forecast',
        body: 'A general Year of the Goat forecast looks only at your birth-year branch. Someone born in an Ox year, for example, meets the Chou-Wei clash in 2027, and someone born in a Goat year meets the same branch again. That is one character out of eight. Your 2027 BaZi brings in the Day Master, the month branch, the day branch and the luck pillar you are in, so two people with the same animal can get very different results. For the complete chart, including every luck pillar, use the BaZi calculator after you have seen your 2027 result.',
      },
    ],
  },
  faq: [
    {
      q: 'What Chinese zodiac year is 2027?',
      a: '2027 is a Ding Wei year, the Year of the Fire Goat (also called the Fire Sheep or Ram). In BaZi it begins at the Beginning of Spring on February 4, 2027; Lunar New Year falls on February 6.',
    },
    {
      q: 'Which signs clash with Tai Sui in 2027?',
      a: 'By traditional rules, people born in Goat years meet Tai Sui and people born in Ox years clash with it. Some schools also count punishment, harm and destruction; this calculator marks only meeting and clashing, and treats them as one character in a larger chart.',
    },
    {
      q: 'Is a clash in my 2027 chart a bad sign?',
      a: 'Not by itself. A clash is read as movement and adjustment, and its meaning depends on which pillar it touches, whether the year’s elements are favorable for you and how your luck pillar supports it. The calculator lists the relations; it does not label the year good or bad.',
    },
    {
      q: 'What does the full reading add?',
      a: 'The free result lists the Ten Gods, relations, Tai Sui and favorable elements for 2027. The full reading explains each of them for your chart and includes a year-by-year chapter. You see the credit cost and your balance before confirming, and credits are not used if generation fails.',
    },
  ],
  linksTitle: 'Related',
}
