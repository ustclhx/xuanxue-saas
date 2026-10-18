import type { CardMeaning } from '../types.ts'

export const meanings: Readonly<Record<string, CardMeaning>> = {
  'major-00': {
    name: 'The Fool',
    keywords: ['beginnings', 'openness'],
    upright: 'Reflect on beginnings, openness.',
    reversed: 'Consider how recklessness, hesitation may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of beginnings, openness; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of recklessness, hesitation; it is not a prediction.',
    },
  },
  'major-01': {
    name: 'The Magician',
    keywords: ['initiative', 'skill'],
    upright: 'Reflect on initiative, skill.',
    reversed: 'Consider how manipulation, scattered focus may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of initiative, skill; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of manipulation, scattered focus; it is not a prediction.',
    },
  },
  'major-02': {
    name: 'The High Priestess',
    keywords: ['intuition', 'reflection'],
    upright: 'Reflect on intuition, reflection.',
    reversed: 'Consider how secrecy, ignored intuition may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of intuition, reflection; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of secrecy, ignored intuition; it is not a prediction.',
    },
  },
  'major-03': {
    name: 'The Empress',
    keywords: ['creativity', 'nurture'],
    upright: 'Reflect on creativity, nurture.',
    reversed: 'Consider how dependence, neglect may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of creativity, nurture; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of dependence, neglect; it is not a prediction.',
    },
  },
  'major-04': {
    name: 'The Emperor',
    keywords: ['structure', 'leadership'],
    upright: 'Reflect on structure, leadership.',
    reversed: 'Consider how rigidity, control may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of structure, leadership; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of rigidity, control; it is not a prediction.',
    },
  },
  'major-05': {
    name: 'The Hierophant',
    keywords: ['tradition', 'learning'],
    upright: 'Reflect on tradition, learning.',
    reversed: 'Consider how conformity, questioning may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of tradition, learning; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of conformity, questioning; it is not a prediction.',
    },
  },
  'major-06': {
    name: 'The Lovers',
    keywords: ['alignment', 'choice'],
    upright: 'Reflect on alignment, choice.',
    reversed: 'Consider how discord, misalignment may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of alignment, choice; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of discord, misalignment; it is not a prediction.',
    },
  },
  'major-07': {
    name: 'The Chariot',
    keywords: ['direction', 'resolve'],
    upright: 'Reflect on direction, resolve.',
    reversed: 'Consider how force, lost direction may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of direction, resolve; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of force, lost direction; it is not a prediction.',
    },
  },
  'major-08': {
    name: 'Strength',
    keywords: ['patience', 'courage'],
    upright: 'Reflect on patience, courage.',
    reversed: 'Consider how self-doubt, impatience may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of patience, courage; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of self-doubt, impatience; it is not a prediction.',
    },
  },
  'major-09': {
    name: 'The Hermit',
    keywords: ['solitude', 'insight'],
    upright: 'Reflect on solitude, insight.',
    reversed: 'Consider how isolation, withdrawal may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of solitude, insight; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of isolation, withdrawal; it is not a prediction.',
    },
  },
  'major-10': {
    name: 'Wheel of Fortune',
    keywords: ['cycles', 'adaptability'],
    upright: 'Reflect on cycles, adaptability.',
    reversed: 'Consider how resistance, instability may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of cycles, adaptability; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of resistance, instability; it is not a prediction.',
    },
  },
  'major-11': {
    name: 'Justice',
    keywords: ['fairness', 'accountability'],
    upright: 'Reflect on fairness, accountability.',
    reversed: 'Consider how bias, avoidance may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of fairness, accountability; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of bias, avoidance; it is not a prediction.',
    },
  },
  'major-12': {
    name: 'The Hanged Man',
    keywords: ['pause', 'perspective'],
    upright: 'Reflect on pause, perspective.',
    reversed: 'Consider how stalling, resistance may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of pause, perspective; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of stalling, resistance; it is not a prediction.',
    },
  },
  'major-13': {
    name: 'Death',
    keywords: ['endings', 'transition'],
    upright: 'Reflect on endings, transition.',
    reversed: 'Consider how stagnation, clinging may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of endings, transition; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of stagnation, clinging; it is not a prediction.',
    },
  },
  'major-14': {
    name: 'Temperance',
    keywords: ['balance', 'moderation'],
    upright: 'Reflect on balance, moderation.',
    reversed: 'Consider how excess, imbalance may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of balance, moderation; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of excess, imbalance; it is not a prediction.',
    },
  },
  'major-15': {
    name: 'The Devil',
    keywords: ['attachment', 'habits'],
    upright: 'Reflect on attachment, habits.',
    reversed: 'Consider how release, awareness may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of attachment, habits; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of release, awareness; it is not a prediction.',
    },
  },
  'major-16': {
    name: 'The Tower',
    keywords: ['disruption', 'revelation'],
    upright: 'Reflect on disruption, revelation.',
    reversed: 'Consider how avoidance, delayed change may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of disruption, revelation; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of avoidance, delayed change; it is not a prediction.',
    },
  },
  'major-17': {
    name: 'The Star',
    keywords: ['hope', 'renewal'],
    upright: 'Reflect on hope, renewal.',
    reversed: 'Consider how discouragement, disconnection may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of hope, renewal; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of discouragement, disconnection; it is not a prediction.',
    },
  },
  'major-18': {
    name: 'The Moon',
    keywords: ['uncertainty', 'imagination'],
    upright: 'Reflect on uncertainty, imagination.',
    reversed: 'Consider how clarification, unease may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of uncertainty, imagination; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of clarification, unease; it is not a prediction.',
    },
  },
  'major-19': {
    name: 'The Sun',
    keywords: ['joy', 'clarity'],
    upright: 'Reflect on joy, clarity.',
    reversed: 'Consider how muted joy, overconfidence may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of joy, clarity; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of muted joy, overconfidence; it is not a prediction.',
    },
  },
  'major-20': {
    name: 'Judgement',
    keywords: ['reflection', 'renewal'],
    upright: 'Reflect on reflection, renewal.',
    reversed: 'Consider how self-criticism, avoidance may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of reflection, renewal; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of self-criticism, avoidance; it is not a prediction.',
    },
  },
  'major-21': {
    name: 'The World',
    keywords: ['completion', 'integration'],
    upright: 'Reflect on completion, integration.',
    reversed: 'Consider how unfinished work, delay may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of completion, integration; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of unfinished work, delay; it is not a prediction.',
    },
  },
  'wands-01': {
    name: 'Ace of Wands',
    keywords: ['inspiration', 'initiative'],
    upright: 'Reflect on inspiration, initiative.',
    reversed: 'Consider how blocked spark, delay may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of inspiration, initiative; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of blocked spark, delay; it is not a prediction.',
    },
  },
  'wands-02': {
    name: 'Two of Wands',
    keywords: ['planning', 'options'],
    upright: 'Reflect on planning, options.',
    reversed: 'Consider how hesitation, limited vision may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of planning, options; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of hesitation, limited vision; it is not a prediction.',
    },
  },
  'wands-03': {
    name: 'Three of Wands',
    keywords: ['expansion', 'foresight'],
    upright: 'Reflect on expansion, foresight.',
    reversed: 'Consider how setbacks, impatience may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of expansion, foresight; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of setbacks, impatience; it is not a prediction.',
    },
  },
  'wands-04': {
    name: 'Four of Wands',
    keywords: ['celebration', 'belonging'],
    upright: 'Reflect on celebration, belonging.',
    reversed: 'Consider how instability, exclusion may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of celebration, belonging; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of instability, exclusion; it is not a prediction.',
    },
  },
  'wands-05': {
    name: 'Five of Wands',
    keywords: ['competition', 'friction'],
    upright: 'Reflect on competition, friction.',
    reversed: 'Consider how avoided conflict, compromise may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of competition, friction; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of avoided conflict, compromise; it is not a prediction.',
    },
  },
  'wands-06': {
    name: 'Six of Wands',
    keywords: ['recognition', 'confidence'],
    upright: 'Reflect on recognition, confidence.',
    reversed: 'Consider how ego, overlooked effort may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of recognition, confidence; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of ego, overlooked effort; it is not a prediction.',
    },
  },
  'wands-07': {
    name: 'Seven of Wands',
    keywords: ['conviction', 'boundaries'],
    upright: 'Reflect on conviction, boundaries.',
    reversed: 'Consider how overwhelm, defensiveness may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of conviction, boundaries; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of overwhelm, defensiveness; it is not a prediction.',
    },
  },
  'wands-08': {
    name: 'Eight of Wands',
    keywords: ['momentum', 'communication'],
    upright: 'Reflect on momentum, communication.',
    reversed: 'Consider how haste, miscommunication may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of momentum, communication; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of haste, miscommunication; it is not a prediction.',
    },
  },
  'wands-09': {
    name: 'Nine of Wands',
    keywords: ['resilience', 'vigilance'],
    upright: 'Reflect on resilience, vigilance.',
    reversed: 'Consider how exhaustion, distrust may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of resilience, vigilance; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of exhaustion, distrust; it is not a prediction.',
    },
  },
  'wands-10': {
    name: 'Ten of Wands',
    keywords: ['burden', 'responsibility'],
    upright: 'Reflect on burden, responsibility.',
    reversed: 'Consider how release, delegation may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of burden, responsibility; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of release, delegation; it is not a prediction.',
    },
  },
  'wands-11': {
    name: 'Page of Wands',
    keywords: ['curiosity', 'exploration'],
    upright: 'Reflect on curiosity, exploration.',
    reversed: 'Consider how restlessness, lack of direction may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of curiosity, exploration; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of restlessness, lack of direction; it is not a prediction.',
    },
  },
  'wands-12': {
    name: 'Knight of Wands',
    keywords: ['adventure', 'enthusiasm'],
    upright: 'Reflect on adventure, enthusiasm.',
    reversed: 'Consider how impulsiveness, inconsistency may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of adventure, enthusiasm; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of impulsiveness, inconsistency; it is not a prediction.',
    },
  },
  'wands-13': {
    name: 'Queen of Wands',
    keywords: ['warmth', 'confidence'],
    upright: 'Reflect on warmth, confidence.',
    reversed: 'Consider how jealousy, insecurity may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of warmth, confidence; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of jealousy, insecurity; it is not a prediction.',
    },
  },
  'wands-14': {
    name: 'King of Wands',
    keywords: ['vision', 'leadership'],
    upright: 'Reflect on vision, leadership.',
    reversed: 'Consider how domination, impatience may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of vision, leadership; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of domination, impatience; it is not a prediction.',
    },
  },
  'cups-01': {
    name: 'Ace of Cups',
    keywords: ['openness', 'compassion'],
    upright: 'Reflect on openness, compassion.',
    reversed: 'Consider how repression, depletion may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of openness, compassion; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of repression, depletion; it is not a prediction.',
    },
  },
  'cups-02': {
    name: 'Two of Cups',
    keywords: ['connection', 'reciprocity'],
    upright: 'Reflect on connection, reciprocity.',
    reversed: 'Consider how imbalance, disconnection may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of connection, reciprocity; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of imbalance, disconnection; it is not a prediction.',
    },
  },
  'cups-03': {
    name: 'Three of Cups',
    keywords: ['friendship', 'celebration'],
    upright: 'Reflect on friendship, celebration.',
    reversed: 'Consider how exclusion, excess may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of friendship, celebration; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of exclusion, excess; it is not a prediction.',
    },
  },
  'cups-04': {
    name: 'Four of Cups',
    keywords: ['contemplation', 'dissatisfaction'],
    upright: 'Reflect on contemplation, dissatisfaction.',
    reversed: 'Consider how renewed interest, awareness may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of contemplation, dissatisfaction; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of renewed interest, awareness; it is not a prediction.',
    },
  },
  'cups-05': {
    name: 'Five of Cups',
    keywords: ['disappointment', 'grief'],
    upright: 'Reflect on disappointment, grief.',
    reversed: 'Consider how acceptance, recovery may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of disappointment, grief; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of acceptance, recovery; it is not a prediction.',
    },
  },
  'cups-06': {
    name: 'Six of Cups',
    keywords: ['memory', 'kindness'],
    upright: 'Reflect on memory, kindness.',
    reversed: 'Consider how nostalgia, clinging may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of memory, kindness; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of nostalgia, clinging; it is not a prediction.',
    },
  },
  'cups-07': {
    name: 'Seven of Cups',
    keywords: ['options', 'fantasy'],
    upright: 'Reflect on options, fantasy.',
    reversed: 'Consider how clarity, narrowing options may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of options, fantasy; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of clarity, narrowing options; it is not a prediction.',
    },
  },
  'cups-08': {
    name: 'Eight of Cups',
    keywords: ['departure', 'searching'],
    upright: 'Reflect on departure, searching.',
    reversed: 'Consider how avoidance, indecision may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of departure, searching; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of avoidance, indecision; it is not a prediction.',
    },
  },
  'cups-09': {
    name: 'Nine of Cups',
    keywords: ['contentment', 'gratitude'],
    upright: 'Reflect on contentment, gratitude.',
    reversed: 'Consider how dissatisfaction, indulgence may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of contentment, gratitude; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of dissatisfaction, indulgence; it is not a prediction.',
    },
  },
  'cups-10': {
    name: 'Ten of Cups',
    keywords: ['harmony', 'belonging'],
    upright: 'Reflect on harmony, belonging.',
    reversed: 'Consider how discord, idealization may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of harmony, belonging; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of discord, idealization; it is not a prediction.',
    },
  },
  'cups-11': {
    name: 'Page of Cups',
    keywords: ['sensitivity', 'imagination'],
    upright: 'Reflect on sensitivity, imagination.',
    reversed: 'Consider how immaturity, blocked expression may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of sensitivity, imagination; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of immaturity, blocked expression; it is not a prediction.',
    },
  },
  'cups-12': {
    name: 'Knight of Cups',
    keywords: ['romance', 'invitation'],
    upright: 'Reflect on romance, invitation.',
    reversed: 'Consider how unrealistic ideals, moodiness may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of romance, invitation; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of unrealistic ideals, moodiness; it is not a prediction.',
    },
  },
  'cups-13': {
    name: 'Queen of Cups',
    keywords: ['empathy', 'inner calm'],
    upright: 'Reflect on empathy, inner calm.',
    reversed: 'Consider how overgiving, blurred boundaries may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of empathy, inner calm; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of overgiving, blurred boundaries; it is not a prediction.',
    },
  },
  'cups-14': {
    name: 'King of Cups',
    keywords: ['composure', 'compassion'],
    upright: 'Reflect on composure, compassion.',
    reversed: 'Consider how suppression, manipulation may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of composure, compassion; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of suppression, manipulation; it is not a prediction.',
    },
  },
  'swords-01': {
    name: 'Ace of Swords',
    keywords: ['clarity', 'insight'],
    upright: 'Reflect on clarity, insight.',
    reversed: 'Consider how confusion, harshness may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of clarity, insight; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of confusion, harshness; it is not a prediction.',
    },
  },
  'swords-02': {
    name: 'Two of Swords',
    keywords: ['stalemate', 'deliberation'],
    upright: 'Reflect on stalemate, deliberation.',
    reversed: 'Consider how overload, avoidance may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of stalemate, deliberation; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of overload, avoidance; it is not a prediction.',
    },
  },
  'swords-03': {
    name: 'Three of Swords',
    keywords: ['sorrow', 'painful truth'],
    upright: 'Reflect on sorrow, painful truth.',
    reversed: 'Consider how release, forgiveness may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of sorrow, painful truth; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of release, forgiveness; it is not a prediction.',
    },
  },
  'swords-04': {
    name: 'Four of Swords',
    keywords: ['rest', 'contemplation'],
    upright: 'Reflect on rest, contemplation.',
    reversed: 'Consider how restlessness, exhaustion may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of rest, contemplation; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of restlessness, exhaustion; it is not a prediction.',
    },
  },
  'swords-05': {
    name: 'Five of Swords',
    keywords: ['conflict', 'hollow victory'],
    upright: 'Reflect on conflict, hollow victory.',
    reversed: 'Consider how reconciliation, regret may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of conflict, hollow victory; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of reconciliation, regret; it is not a prediction.',
    },
  },
  'swords-06': {
    name: 'Six of Swords',
    keywords: ['transition', 'perspective'],
    upright: 'Reflect on transition, perspective.',
    reversed: 'Consider how resistance, unfinished baggage may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of transition, perspective; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of resistance, unfinished baggage; it is not a prediction.',
    },
  },
  'swords-07': {
    name: 'Seven of Swords',
    keywords: ['strategy', 'secrecy'],
    upright: 'Reflect on strategy, secrecy.',
    reversed: 'Consider how disclosure, accountability may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of strategy, secrecy; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of disclosure, accountability; it is not a prediction.',
    },
  },
  'swords-08': {
    name: 'Eight of Swords',
    keywords: ['restriction', 'self-limitation'],
    upright: 'Reflect on restriction, self-limitation.',
    reversed: 'Consider how agency, release may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of restriction, self-limitation; it is not a prediction.',
      reversed:
        'Yes: this fixed entertainment mapping reflects the themes of agency, release; it is not a prediction.',
    },
  },
  'swords-09': {
    name: 'Nine of Swords',
    keywords: ['worry', 'rumination'],
    upright: 'Reflect on worry, rumination.',
    reversed: 'Consider how perspective, seeking support may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of worry, rumination; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of perspective, seeking support; it is not a prediction.',
    },
  },
  'swords-10': {
    name: 'Ten of Swords',
    keywords: ['ending', 'exhaustion'],
    upright: 'Reflect on ending, exhaustion.',
    reversed: 'Consider how recovery, renewal may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of ending, exhaustion; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of recovery, renewal; it is not a prediction.',
    },
  },
  'swords-11': {
    name: 'Page of Swords',
    keywords: ['inquiry', 'alertness'],
    upright: 'Reflect on inquiry, alertness.',
    reversed: 'Consider how gossip, haste may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of inquiry, alertness; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of gossip, haste; it is not a prediction.',
    },
  },
  'swords-12': {
    name: 'Knight of Swords',
    keywords: ['drive', 'directness'],
    upright: 'Reflect on drive, directness.',
    reversed: 'Consider how recklessness, aggression may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of drive, directness; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of recklessness, aggression; it is not a prediction.',
    },
  },
  'swords-13': {
    name: 'Queen of Swords',
    keywords: ['discernment', 'honesty'],
    upright: 'Reflect on discernment, honesty.',
    reversed: 'Consider how coldness, harsh judgement may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of discernment, honesty; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of coldness, harsh judgement; it is not a prediction.',
    },
  },
  'swords-14': {
    name: 'King of Swords',
    keywords: ['reason', 'integrity'],
    upright: 'Reflect on reason, integrity.',
    reversed: 'Consider how rigidity, misuse of authority may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of reason, integrity; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of rigidity, misuse of authority; it is not a prediction.',
    },
  },
  'pentacles-01': {
    name: 'Ace of Pentacles',
    keywords: ['opportunity', 'grounding'],
    upright: 'Reflect on opportunity, grounding.',
    reversed: 'Consider how missed opportunity, poor planning may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of opportunity, grounding; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of missed opportunity, poor planning; it is not a prediction.',
    },
  },
  'pentacles-02': {
    name: 'Two of Pentacles',
    keywords: ['adaptability', 'priorities'],
    upright: 'Reflect on adaptability, priorities.',
    reversed: 'Consider how overload, imbalance may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of adaptability, priorities; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of overload, imbalance; it is not a prediction.',
    },
  },
  'pentacles-03': {
    name: 'Three of Pentacles',
    keywords: ['teamwork', 'craftsmanship'],
    upright: 'Reflect on teamwork, craftsmanship.',
    reversed: 'Consider how poor coordination, undervaluing skill may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of teamwork, craftsmanship; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of poor coordination, undervaluing skill; it is not a prediction.',
    },
  },
  'pentacles-04': {
    name: 'Four of Pentacles',
    keywords: ['security', 'conservation'],
    upright: 'Reflect on security, conservation.',
    reversed: 'Consider how possessiveness, release may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of security, conservation; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of possessiveness, release; it is not a prediction.',
    },
  },
  'pentacles-05': {
    name: 'Five of Pentacles',
    keywords: ['scarcity', 'exclusion'],
    upright: 'Reflect on scarcity, exclusion.',
    reversed: 'Consider how support, rebuilding may shape your perspective.',
    yesNoReason: {
      upright:
        'No: this fixed entertainment mapping reflects the themes of scarcity, exclusion; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of support, rebuilding; it is not a prediction.',
    },
  },
  'pentacles-06': {
    name: 'Six of Pentacles',
    keywords: ['generosity', 'exchange'],
    upright: 'Reflect on generosity, exchange.',
    reversed: 'Consider how unequal exchange, strings attached may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of generosity, exchange; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of unequal exchange, strings attached; it is not a prediction.',
    },
  },
  'pentacles-07': {
    name: 'Seven of Pentacles',
    keywords: ['patience', 'assessment'],
    upright: 'Reflect on patience, assessment.',
    reversed: 'Consider how impatience, misdirected effort may shape your perspective.',
    yesNoReason: {
      upright:
        'Maybe: this fixed entertainment mapping reflects the themes of patience, assessment; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of impatience, misdirected effort; it is not a prediction.',
    },
  },
  'pentacles-08': {
    name: 'Eight of Pentacles',
    keywords: ['practice', 'diligence'],
    upright: 'Reflect on practice, diligence.',
    reversed: 'Consider how perfectionism, shortcuts may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of practice, diligence; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of perfectionism, shortcuts; it is not a prediction.',
    },
  },
  'pentacles-09': {
    name: 'Nine of Pentacles',
    keywords: ['independence', 'appreciation'],
    upright: 'Reflect on independence, appreciation.',
    reversed: 'Consider how dependence, overwork may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of independence, appreciation; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of dependence, overwork; it is not a prediction.',
    },
  },
  'pentacles-10': {
    name: 'Ten of Pentacles',
    keywords: ['legacy', 'stability'],
    upright: 'Reflect on legacy, stability.',
    reversed: 'Consider how family tension, instability may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of legacy, stability; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of family tension, instability; it is not a prediction.',
    },
  },
  'pentacles-11': {
    name: 'Page of Pentacles',
    keywords: ['study', 'practical goals'],
    upright: 'Reflect on study, practical goals.',
    reversed: 'Consider how procrastination, distraction may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of study, practical goals; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of procrastination, distraction; it is not a prediction.',
    },
  },
  'pentacles-12': {
    name: 'Knight of Pentacles',
    keywords: ['reliability', 'persistence'],
    upright: 'Reflect on reliability, persistence.',
    reversed: 'Consider how stagnation, inflexibility may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of reliability, persistence; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of stagnation, inflexibility; it is not a prediction.',
    },
  },
  'pentacles-13': {
    name: 'Queen of Pentacles',
    keywords: ['resourcefulness', 'care'],
    upright: 'Reflect on resourcefulness, care.',
    reversed: 'Consider how self-neglect, imbalance may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of resourcefulness, care; it is not a prediction.',
      reversed:
        'Maybe: this fixed entertainment mapping reflects the themes of self-neglect, imbalance; it is not a prediction.',
    },
  },
  'pentacles-14': {
    name: 'King of Pentacles',
    keywords: ['stewardship', 'stability'],
    upright: 'Reflect on stewardship, stability.',
    reversed: 'Consider how materialism, control may shape your perspective.',
    yesNoReason: {
      upright:
        'Yes: this fixed entertainment mapping reflects the themes of stewardship, stability; it is not a prediction.',
      reversed:
        'No: this fixed entertainment mapping reflects the themes of materialism, control; it is not a prediction.',
    },
  },
}
