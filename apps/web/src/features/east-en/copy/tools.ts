import type { ToolCopy } from './types.ts'

// 东方站英文八字与紫微工具页正文：按事实单（tool-shichu、tool-ziwei）直接用英文写作，
// 八字示例经引擎复算（openspec add-locales-eu-ja 5b）。
export const BAZI: ToolCopy = {
  title: 'BaZi Calculator: Free Four Pillars Chart',
  description:
    'Free BaZi calculator: enter your birth date, time and city for your Four Pillars, Day Master, Ten Gods and luck pillars, worked out by traditional rules.',
  nav: 'BaZi Calculator',
  h1: 'Free BaZi calculator (Four Pillars of Destiny)',
  intro:
    'Enter your birth date, time and city. The calculator converts your local clock time, places it against the solar terms and writes out your four pillars, all in your browser and without an account. If you do not know your birth time, leave it blank and you will still get three pillars.',
  submit: 'Calculate my BaZi chart',
  articleTitle: 'How the BaZi calculator works',
  sections: [
    {
      heading: 'Four pillars, eight characters',
      paragraphs: [
        'BaZi means “eight characters.” Your birth year, month, day and two-hour period each become a pillar, and each pillar is a pair of signs: a Heavenly Stem above and an Earthly Branch below. Ten stems and twelve branches combine into a cycle of sixty pairs that has been used to count years, months, days and hours in China for well over two thousand years. Each stem and branch belongs to one of the five elements and is either Yin or Yang, so a chart is really a small sample of the elements present at the moment you were born.',
        'The stem of the day pillar is called the Day Master. Traditional BaZi treats it as the person, and reads every other sign by its relationship to that stem through the generating and controlling cycles: Wood feeds Fire, Fire makes Earth, Earth bears Metal, Metal carries Water, Water feeds Wood, and each element in turn restrains another.',
      ],
    },
    {
      heading: 'Why your birth city matters',
      paragraphs: [
        'The hour pillar depends on local time, and local time is less simple than it looks, which is why the calculator asks for your birth city. The calculator includes cities such as New York, Los Angeles, Toronto, Vancouver, London, Sydney, Singapore and Kuala Lumpur, each with its full time zone history, so daylight saving time in the year you were born is removed automatically. For anywhere else, choose your UTC offset by hand.',
        'True solar time is an optional second step. Clock time is set for the middle of a time zone, but the sun is overhead at different moments across that zone. Turning the option on corrects the hour by your birthplace’s longitude and by the equation of time. It is off by default; it is worth comparing when your birth time sits close to a two-hour boundary, because that is when the correction can change the hour pillar.',
      ],
    },
    {
      heading: 'A worked example: New York, July 1991',
      paragraphs: [
        'Take a man born on 4 July 1991 at 09:15 on the clock in New York. Daylight saving time was in effect, so the calculator first moves the time back to 08:15 standard time. That puts the birth in the Chen double hour, which runs from 07:00 to 09:00; without the correction it would have fallen into the next double hour and given a different hour pillar.',
        'The four pillars come out as year 辛未 Xin Wei, month 甲午 Jia Wu, day 乙亥 Yi Hai and hour 庚辰 Geng Chen. The month is still Jia Wu because the birth falls a few days before the next solar term. The Day Master is 乙 Yi, Yin Wood. Read against it, the year stem Xin is Seven Killings, the month stem Jia is Rob Wealth and the hour stem Geng is Direct Officer.',
        'For a man born in a Yin year, the ten-year luck pillars run backward through the sixty-pair cycle. Counting back to the previous solar term, the calculator shows that luck pillars begin at 9 years 5 months, which falls in December 2000. The first luck pillar is 癸巳 Gui Si, listed as 2000–2009 and starting at age 10 in the traditional count, where you are 1 at birth. The calculator shows every luck pillar after it in the same way, so you can see which elements each decade brings into the chart.',
      ],
    },
    {
      heading: 'Reading the Ten Gods',
      paragraphs: [
        'The Ten Gods are names for relationships, not deities. Each stem in the chart is compared with the Day Master by element and by Yin or Yang. The same element gives Friend or Rob Wealth; the element the Day Master produces gives Eating God or Hurting Officer; the element it controls gives Indirect Wealth or Direct Wealth; the element that controls it gives Seven Killings or Direct Officer; and the element that produces it gives Indirect Resource or Direct Resource. The hidden stems inside each branch are labeled the same way.',
        'In the example, Yi Wood is pressed by Metal from two sides, Seven Killings in the year and Direct Officer in the hour, while Jia Wood in the month stands beside it as Rob Wealth. A traditional reader would look at how much support Yi Wood gets from Water and Wood elsewhere before deciding what that pressure means. That weighing is what the strength and favorable element sections of your result try to show.',
      ],
    },
    {
      heading: 'What else appears in your result',
      paragraphs: [
        'After the pillars you will see a five element balance, a judgment of whether you have a strong or weak Day Master, the favorable elements that would bring the chart closer to balance, the ten-year luck pillars, symbolic stars and the traditional bone weight. Each block is calculated from the same eight characters, so if your birth time changes, all of them change with it. [BaZi 2027](bazi-2027) compares the Ding Wei annual pillar with your birth chart and the luck pillar in effect that year.',
        'If you want the whole chart explained in plain language, you can request an optional full reading written by AI from your finished chart. It uses credits; see [BaZi reading pricing](pricing). The chart itself stays free.',
      ],
    },
    {
      heading: 'How to use the result',
      paragraphs: [
        'BaZi is a language for describing tendencies and timing. It is useful for reflection: noticing which parts of the chart feel familiar, which do not, and what that suggests about the choices in front of you. The calculation follows traditional rules carefully, but the chart does not predict events and it is not a substitute for medical, legal or financial advice. Treat it as one perspective among several, and compare it with your [Zi Wei Dou Shu chart](ziwei) if you want a second view of the same birth moment.',
      ],
    },
  ],
  faq: [
    {
      q: 'Does a BaZi calculator need my exact birth location?',
      a: 'It needs your birth city, or at least its UTC offset, so it can turn clock time into the correct hour, including any daylight saving time. Longitude only comes into play if you turn on true solar time, which is optional.',
      origin: 'local',
    },
    {
      q: 'What if I don’t know my birth time?',
      a: 'Leave the time empty. The calculator uses 12:00 to settle the date and hides the hour pillar, so you still get the year, month and day pillars and your Day Master. Anything that depends on the hour is left out rather than guessed.',
      origin: 'local',
    },
    {
      q: 'Is BaZi accurate?',
      a: 'The calendar side is rule-based: the pillars follow the solar terms and the sixty-pair cycle, so the same input always gives the same chart here, although schools differ on a few conventions. Interpretation is another matter. Treat it as a traditional framework for reflection, not a prediction.',
      origin: 'local',
    },
    {
      q: 'Why is my BaZi year different from my Chinese New Year animal?',
      a: 'BaZi changes the year at the Beginning of Spring, around 4 February, not at the lunar New Year. If you were born between the two dates, your year pillar may differ from the animal listed on a zodiac calendar.',
      origin: 'adapted',
    },
  ],
}

export const ZIWEI: ToolCopy = {
  title: 'Zi Wei Dou Shu Chart Calculator (Free)',
  description:
    'Free Zi Wei Dou Shu chart: twelve palaces, Life Palace and Body Palace, the 14 main stars and Four Transformations from your birth date and exact time.',
  nav: 'Zi Wei Dou Shu Chart',
  h1: 'Free Zi Wei Dou Shu chart (Purple Star Astrology)',
  intro:
    'Enter your birth date, exact time and city to lay out your twelve palaces. Zi Wei Dou Shu needs the birth hour, because the hour decides where the Life Palace sits. The chart is drawn in your browser, needs no account and uses the same birth details as the BaZi calculator.',
  submit: 'Draw my Zi Wei chart',
  articleTitle: 'How a Zi Wei Dou Shu chart is built',
  sections: [
    {
      heading: 'Twelve palaces on a fixed ring',
      paragraphs: [
        'Zi Wei Dou Shu, often translated as Purple Star Astrology, is named after the Zi Wei star, the pole star of Chinese sky lore. The chart is a ring of twelve squares, each tied to one of the twelve Earthly Branches. Every square is a palace for one area of life: Life, Siblings, Spouse, Children, Wealth, Health, Travel, Friends, Career, Property, Fortune and Parents. The palaces always run in that order, but where the ring starts is different for every chart.',
        'Two palaces are marked. The Life Palace describes temperament and the overall shape of the chart. The Body Palace, which shares a square with one of the other palaces, is traditionally read as where your attention and effort tend to settle as life goes on.',
      ],
    },
    {
      heading: 'From birth time to star positions',
      paragraphs: [
        'The method works on the Chinese lunar calendar. Your birth is converted to a lunar month, a lunar day and one of the twelve double hours. The month and hour together set the Life Palace and the Body Palace. The stem and branch of the Life Palace then give the Five Elements Bureau (such as Water 2 Bureau), and that bureau, together with the lunar day, decides where the Zi Wei star lands. The other main stars follow from Zi Wei in fixed patterns, so 14 main stars end up spread across the ring, some palaces holding two and some holding none.',
        'Because each double hour moves the Life Palace by one square, a birth time that is off by an hour can rotate every palace. That is why the chart asks for an exact time and uses your birth city’s time zone history, including daylight saving time, before it starts.',
      ],
    },
    {
      heading: 'Main stars, brightness and the Four Transformations',
      paragraphs: [
        'Each main star has its own character. Zi Wei and Tian Fu are often read as steadying stars, Wu Qu is tied to resources, Tai Yang and Tai Yin to outward and inward light, and Qi Sha, Po Jun and Tan Lang to change and appetite. A star is also rated for brightness in its palace, since the same star is read as stronger or weaker depending on where it sits.',
        'The Four Transformations, or Si Hua, come from the Heavenly Stem of your birth year. Four stars take on Hua Lu, Hua Quan, Hua Ke and Hua Ji, usually glossed as wealth, power, reputation and obstacle. The chart marks each one beside the star it affects, so you can see which palaces carry extra emphasis.',
      ],
    },
    {
      heading: 'Reading the chart, and where it fits with BaZi',
      paragraphs: [
        'A practical way in is to read the Life Palace first, then the palaces directly across from it and at the two angles of its triangle, since traditional readers treat those four squares as one group. After that, look at the palace for the question on your mind: Career for work, Spouse for relationships, Wealth for money. An empty palace is read through the stars in the palace opposite it.',
        'Brightness and transformations change the tone of what you find. A bright star in the Career Palace with Hua Quan beside it reads very differently from the same star dim and marked Hua Ji. Rather than memorizing single stars, note the combinations that repeat across the Life Palace group, since those are what traditional readers lean on most. Write down two or three themes in your own words before reading anyone else’s interpretation.',
        'Zi Wei Dou Shu and the [BaZi calculator](bazi) start from the same birth moment but organize it differently, one by elements and the Day Master, the other by palaces and stars. For an example of how BaZi reads a single year, use the [2027 BaZi calculator](bazi-2027) to compare the Ding Wei annual pillar with your birth chart. The calculation follows classical rules; the chart is for reference and self-reflection and does not predict events. Optional full readings written by AI from your chart use credits, as shown on the [pricing](pricing) page.',
      ],
    },
  ],
  faq: [
    {
      q: 'How do I start with Zi Wei Dou Shu chart interpretation?',
      a: 'Find the Life Palace, note its main stars and their brightness, then read the palaces opposite it and at the two corners of its triangle. Only after that move to the palace for your question, and check whether a Four Transformations mark sits in any of them.',
      origin: 'local',
    },
    {
      q: 'Purple Star Astrology vs BaZi: which is better?',
      a: 'Neither is better in general. BaZi weighs the five elements and works even without a birth time. Purple Star Astrology needs the hour but gives a palace for each area of life. Many people use BaZi for the overall pattern and Zi Wei for detail.',
      origin: 'local',
    },
    {
      q: 'Can I draw a Zi Wei chart without a birth time?',
      a: 'No. The hour sets the Life Palace and the Body Palace, and every other palace follows from them. If your time is unknown, use the BaZi calculator, which can still show three pillars.',
      origin: 'local',
    },
    {
      q: 'Why does the chart say a palace has no main star?',
      a: 'There are 14 main stars and twelve palaces, and the fixed patterns cluster some stars together, so some palaces usually end up with no main star. Traditional practice reads an empty palace by borrowing the stars of the palace opposite it.',
      origin: 'adapted',
    },
  ],
}
