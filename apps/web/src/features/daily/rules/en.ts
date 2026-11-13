import type { WestRules } from './types.ts'

/** English daily numerology copy (drafted by Claude; adopted under the change's default decisions) */
export const EN_RULES: WestRules = {
  locale: 'en',
  number: {
    1: {
      keyword: 'Beginnings',
      personal: [
        {
          theme: 'A fresh-start day that favors taking the first step yourself.',
          advice:
            'Start something small and visible: send the first message, write the first line.',
          caution: 'Leading is not the same as going it alone. Let others know what you are doing.',
        },
        {
          theme: 'Your own initiative carries more weight than usual.',
          advice: 'Make one decision you have been postponing and act on it.',
          caution: 'Keep an ear open; confidence works best when it still listens.',
        },
      ],
      universal: [
        'The collective mood leans toward new starts and independent moves.',
        'A good day for everyone to begin rather than to finish.',
      ],
    },
    2: {
      keyword: 'Partnership',
      personal: [
        {
          theme: 'A day for cooperation, patience and paying attention to others.',
          advice: 'Check in with a partner or colleague and ask how you can help.',
          caution: 'Agreeing to keep the peace can leave your own needs unsaid. Say them gently.',
        },
        {
          theme: 'Small details and quiet diplomacy make the difference today.',
          advice: 'Smooth one rough edge in a relationship with a kind word.',
          caution: 'Avoid rushing anyone, including yourself.',
        },
      ],
      universal: [
        'The shared tone favors listening, teamwork and small gestures.',
        'A softer day: cooperation tends to work better than competition.',
      ],
    },
    3: {
      keyword: 'Expression',
      personal: [
        {
          theme: 'Creativity and conversation flow more easily.',
          advice: 'Share an idea, make something, or reach out to a friend just to talk.',
          caution: 'Scattered energy is easy today. Pick one thing to finish.',
        },
        {
          theme: 'A lighter, more social day that rewards playfulness.',
          advice: 'Write, sketch or tell a story — let it be imperfect.',
          caution: 'Words travel fast; keep promises realistic.',
        },
      ],
      universal: [
        'The collective mood is talkative, creative and upbeat.',
        'A day when ideas and messages move quickly between people.',
      ],
    },
    4: {
      keyword: 'Foundations',
      personal: [
        {
          theme: 'Steady, practical work is the theme of the day.',
          advice: 'Tidy a system you rely on: a schedule, a list, a workspace.',
          caution: 'Structure helps, rigidity does not. Leave room for one change of plan.',
        },
        {
          theme: 'A day to build rather than to dream.',
          advice: 'Break a long project into the next three concrete steps.',
          caution: 'Do not mistake being busy for making progress; check the direction once.',
        },
      ],
      universal: [
        'The shared tone favors order, routine and finishing the groundwork.',
        'A good day for everyone to get organized.',
      ],
    },
    5: {
      keyword: 'Change',
      personal: [
        {
          theme: 'Curiosity and movement are in the air.',
          advice: 'Try a different route, a new place or an unfamiliar topic.',
          caution: 'Variety is refreshing; impulsive commitments are not. Sleep on big choices.',
        },
        {
          theme: 'Flexibility is your strength today.',
          advice: 'Say yes to one small unplanned opportunity.',
          caution: 'Keep the promises you already made before adding new ones.',
        },
      ],
      universal: [
        'The collective mood is restless and open to change.',
        'Plans may shift for many people today; leave some slack.',
      ],
    },
    6: {
      keyword: 'Care',
      personal: [
        {
          theme: 'Home, family and responsibility come to the front.',
          advice: 'Do one caring thing for someone close — or for yourself.',
          caution: 'Helping is good; taking over is not. Ask before you fix.',
        },
        {
          theme: 'A day to tend relationships and your living space.',
          advice: 'Make your space a little more comfortable or welcoming.',
          caution: 'Notice where you feel over-responsible and set a kind limit.',
        },
      ],
      universal: [
        'The shared tone favors care, community and keeping commitments.',
        'A good day for everyone to look after the people around them.',
      ],
    },
    7: {
      keyword: 'Reflection',
      personal: [
        {
          theme: 'A quieter day for reflection, study and honest questions.',
          advice: 'Give yourself some uninterrupted time to read, think or walk.',
          caution: 'Slow down before deciding; not every question needs an answer today.',
        },
        {
          theme: 'Your inner voice is easier to hear.',
          advice: 'Write down the thought that keeps returning and look at it closely.',
          caution: 'Solitude helps; isolation does not. Stay in touch with one person.',
        },
      ],
      universal: [
        'The collective mood is inward and thoughtful.',
        'A good day for research, analysis and second looks.',
      ],
    },
    8: {
      keyword: 'Effort',
      personal: [
        {
          theme: 'Focus, ambition and practical results are the theme.',
          advice: 'Tackle the task with the most impact and see it through.',
          caution: 'Drive is useful; pressure on others is not. Check your tone.',
        },
        {
          theme: 'A day to take your goals seriously.',
          advice: 'Review a plan or a budget and make one sensible adjustment.',
          caution: 'Balance effort with rest so the pace is sustainable.',
        },
      ],
      universal: [
        'The shared tone is purposeful and results-minded.',
        'A good day for everyone to organize resources and responsibilities.',
      ],
    },
    9: {
      keyword: 'Completion',
      personal: [
        {
          theme: 'A day for closing loops and letting go.',
          advice: 'Finish, donate, delete or forgive one thing you no longer need.',
          caution: 'Endings can feel heavy; be gentle with yourself.',
        },
        {
          theme: 'Generosity and perspective come more easily.',
          advice: 'Offer help or encouragement with no strings attached.',
          caution: 'Avoid starting something big; clear space first.',
        },
      ],
      universal: [
        'The collective mood favors wrapping up and generosity.',
        'A good day for everyone to finish what is already underway.',
      ],
    },
    11: {
      keyword: 'Insight',
      personal: [
        {
          theme: 'A master-number day of heightened intuition and inspiration.',
          advice: 'Notice ideas that arrive suddenly and write them down.',
          caution: 'Sensitivity runs high; protect some quiet time and rest.',
        },
        {
          theme: 'Your sense of meaning is sharper than usual.',
          advice: 'Share something that inspires you with someone who will appreciate it.',
          caution: 'Inspiration still needs a practical next step — pick one.',
        },
      ],
      universal: [
        'A master-number day: the collective mood is idealistic and intuitive.',
        'Many people may feel more sensitive than usual; kindness goes a long way.',
      ],
    },
    22: {
      keyword: 'Building',
      personal: [
        {
          theme: 'A master-number day for turning big ideas into concrete plans.',
          advice: 'Sketch the structure of a long-term goal and its first milestone.',
          caution: 'Large visions can overwhelm; work on one piece at a time.',
        },
        {
          theme: 'Practical vision is your strength today.',
          advice: 'Bring people or resources together around something useful.',
          caution: 'Do not carry the whole structure alone; delegate where you can.',
        },
      ],
      universal: [
        'A master-number day: the collective mood favors ambitious, practical building.',
        'A good day for everyone to lay foundations for long-term work.',
      ],
    },
  },
}
