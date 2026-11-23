import type { YearlyToolCopy } from './types.ts'

/**
 * en（东方站根路径英文 `/bazi-2027`）：按英文搜索习惯另写，术语以 i18n/glossary/en-east.json 为准
 * （Day Master、Ten Gods、luck pillars、annual pillar、favorable element）。
 */
export const COPY: YearlyToolCopy = {
  seo: {
    title: 'BaZi 2027: Your Chart in the Fire Goat Year',
    description:
      'Free BaZi 2027 calculator for the Fire Goat year. Compare Ding Wei with your Four Pillars and luck pillar. See your Ten Gods, Tai Sui and favorable elements.',
  },
  crumb: 'BaZi 2027',
  h1: 'BaZi 2027: Your Chart for the Fire Goat Year',
  intro:
    'Enter your birth details for a free BaZi 2027 chart comparison. See how Ding Wei (丁未), the Fire Goat year, relates to your Day Master, your Four Pillars and the luck pillar that covers 2027.',
  submit: 'Compare my chart with 2027',
  result: {
    natalTitle: 'Your Four Pillars',
    yearTitle: '2027 annual pillar',
    yearSpan: 'From Li Chun in 2027 to the start of Li Chun in 2028',
    yearLabel: 'Annual',
    tenGodTitle: 'Ten Gods of the year',
    tenGodLead:
      'The chart uses your Day Master ({dm}) as the reference. For the branch, the table uses its main hidden stem.',
    tenGodCols: ['2027', 'Ten God', 'Element', 'Role'],
    stemRow: 'Stem {gz}',
    branchRow: 'Branch {gz}',
    hiddenNote: 'Other hidden stems: {list}.',
    favorable: 'Favorable',
    unfavorable: 'Unfavorable',
    relTitle: 'How 2027 relates to each pillar',
    relLead:
      'The calculator checks the stems for combinations and the branches for Six Harmony, shared Three Harmony groups, clashes and punishments.',
    relCols: ['Pillar', 'Relation'],
    decadeLabel: 'Luck pillar',
    decadeValue: 'Luck pillar {gz}',
    decadeStart: 'This luck pillar starts in 2027',
    noDecade: '2027 falls outside the ten luck pillars calculated for this chart.',
    relTypes: {
      stemCombine: 'Stem combination',
      sixCombine: 'Six Harmony',
      triad: 'Three Harmony (same group)',
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
    favorTitle: 'Favorable elements',
    favorText:
      'By the support-and-restrain method, the stem ({stemEl}) is {stemRole} and the branch ({branchEl}) is {branchRole} for your chart.',
    ruleNote:
      'Read each relation alongside the strength of your Day Master and your favorable elements.',
    approximate:
      'Approximate result. The chart uses your year, month and day pillars. The calculator estimates when the luck pillars begin using local noon on your birth date.',
    unlockLead:
      'The full reading explains your birth chart and luck pillars and includes a year-by-year chapter.',
  },
  article: {
    title: 'A guide to your BaZi 2027 results',
    sections: [
      {
        heading: 'Start with your birth chart',
        body: 'A BaZi chart gives you a stem and a branch for each of four parts of your birth date and time: the year, month, day and hour. Each pair is called a pillar. The calculator builds your chart from the date, local clock time and place of birth. Enter the calendar your birth record uses. The month changes at the solar term that begins a BaZi month, and the calculator uses local standard time to place the birth hour. You can also choose true solar time. If you were born during daylight saving time, enter the time shown on your birth record. The calculator makes the adjustment for the time zone. If your family recorded your birthday in the lunar calendar, select that option before filling in the date. The form also lets you mark a leap month. The free calculation runs in your browser without an account.',
      },
      {
        heading: 'Read the two rows of the Ten Gods table',
        body: 'Your Day Master is the stem at the top of your day pillar. Put that next to the annual stem, Ding, which is yin Fire. Their elements and yin or yang polarity determine the Ten God shown in the first row. The branch, Wei, is yin Earth. Its row uses Ji Earth, the main hidden stem of Wei, to calculate a Ten God against the same Day Master. Look below the table for the other hidden stems, Ding Fire and Yi Wood, with their own Ten Gods. Those entries let you trace each Ten God back to its own stem.\n\nTry reading one label at a time. Direct Resource, for instance, is traditionally linked with learning and support. If that is the label you see, you might use it to think about where you turn for help or what you want to learn. The label can vary from one chart to the next even though the annual stem and branch stay the same.',
      },
      {
        heading: 'Check which pillar a relation belongs to',
        body: 'The relations table names the pillar on each row. Each comparison uses the annual stem against the stem of that pillar and the annual branch against its branch. Look for stem combinations and the branch relations Six Harmony, Three Harmony, clash and punishment. A Three Harmony label means the two branches share a group. A pair alone leaves the third branch unaccounted for. If a row catches your eye, use its position as context. In traditional reading, the month pillar is often associated with work and social roles. You might use a relation there to consider how you divide your time or what responsibilities you want to revisit.',
      },
      {
        heading: 'Read the luck pillar and favorable elements separately',
        body: 'Look at the last line of the relations table for the luck pillar whose start and end years cover 2027. That comparison uses the same rules as the rows above. When the year is the first in that luck pillar, the calculator marks it. If 2027 lies outside the ten luck pillars calculated for your chart, the table explains why there is no luck pillar to compare.\n\nThe elements panel answers a different question. In this tool, favorable elements come from the traditional support-and-restrain method, which considers the strength of the Day Master across the chart. The panel checks Fire for Ding and Earth for Wei against that set of elements. Read it alongside the Ten Gods for context. The results follow traditional rules and are for reference and self-reflection only. They do not predict the future.',
      },
      {
        heading: 'Know what Tai Sui covers',
        body: 'If you came here looking for your zodiac animal, the Tai Sui panel is the part that uses the branch of your birth year alone. A chart whose year branch is Wei has the same branch as the Fire Goat year. Tradition calls that meeting Tai Sui. An Ox year branch is Chou, which clashes with Wei. Both people can have entirely different Day Masters and luck pillars. Think of the animal as a label for one branch of the chart. The comparison of stems and branches elsewhere in the results gives you the rest of the context.',
      },
      {
        heading: 'Use Li Chun as the BaZi year boundary',
        body: 'The annual pillar changes at the Beginning of Spring (Li Chun) on February 4, 2027 in the calendar used here. At that solar term, Bing Wu (丙午, Fire Horse) gives way to Ding Wei. The Fire Goat year lasts until Li Chun on February 4, 2028. Lunar New Year in 2027 falls on February 6 in the Chinese calendar. Those boundaries can assign different animals to the same birthday. Enter the place and time if your birth falls close to a solar term and check the resulting year pillar.',
      },
      {
        heading: 'What you can see with three pillars',
        body: 'Select “I don’t know my birth time” to get an approximate result. You can still read the Ten Gods and see relations for the year, month and day pillars. The hour pillar is left blank. The calculator uses local noon as an estimate for the start of the luck pillars. If you later confirm your birth time, run the calculation again. Check the luck pillar row in particular if 2027 was close to a transition.',
      },
    ],
  },
  faq: [
    {
      q: 'Do I need to know my Day Master before I start?',
      a: 'Enter your birth details and find the Day Master at the top of the day pillar in the chart. The Ten Gods table also names it so you can refer to it as you read.',
    },
    {
      q: 'Why does my result show a new luck pillar?',
      a: 'The calculator found a luck pillar with 2027 as its start year. That marker refers to the year. The result still shows just one luck pillar for 2027.',
    },
    {
      q: 'Can I look at my whole birth chart and every luck pillar?',
      a: 'Use the Four Pillars of Destiny calculator in Related reading for the full list of luck pillars and details about your birth chart.',
    },
    {
      q: 'Will I see the price before I request a full reading?',
      a: 'The unlock button shows the credit cost. The full reading includes a year-by-year chapter. If the reading fails, you keep your credits.',
    },
    {
      q: 'Can I compare 2027 BaZi results with just my zodiac animal?',
      a: 'The year branch is enough to check whether it matches or clashes with Wei. Enter your birth details to compare Ding Wei with the rest of your chart and its luck pillars.',
    },
  ],
  linksTitle: 'Related',
}
