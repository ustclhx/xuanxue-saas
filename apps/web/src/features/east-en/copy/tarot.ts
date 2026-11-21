import type { SpreadId } from '@xuanxue/tarot'
import type { FeelingsCardCopy, FeelingsIndexCopy, SpreadCopy } from './types.ts'

// 东方站英文塔罗牌阵页与 as feelings 牌页的正文和界面词：按事实单（tarot-*、card-index）直接用英文写作，
// 以「故事、一张、挑一张、牌位详解、对方感受」为角度，不改写西方站英文（openspec add-locales-eu-ja 5b）。
export const SPREADS: Record<SpreadId, SpreadCopy> = {
  'three-card': {
    h1: 'Past, present, future tarot spread',
    intro:
      'Three cards, read left to right as one short story: how this started, where it stands, and where it leans if nothing changes. Type a question, shuffle, and turn the cards over one by one.',
    feelingsNote:
      'Asking about a person rather than a plan? Each card also has a page that reads it as [tarot cards as feelings](feelings), which helps when the story is about someone else.',
    templates: [
      'What is really going on between me and my ex?',
      'Where is this situationship heading?',
      'How can we keep a long-distance relationship steady this year?',
      'Should I say something to my crush at work?',
      'What keeps pulling me back to the same kind of job?',
      'What do I need to understand about this friendship before I move?',
    ],
    positionsTitle: 'The three positions',
    positions: [
      'The opening chapter. Events, habits or old feelings that set this situation up, including things you may have stopped noticing.',
      'The middle of the story. What is actually on the table right now, which is often a little different from what the question assumed.',
      'The next chapter as it is currently written. Read it as a direction you can steer toward or away from, not a fixed ending.',
    ],
    sections: [
      {
        heading: 'Read it as a story, not three separate answers',
        paragraphs: [
          'The point of this spread is the line that runs through the three cards. Before you look anything up, say the story out loud in one sentence: “It began with this, it has become this, and it is drifting toward this.” If the sentence sounds wrong, the mismatch itself is useful; it usually means the question was framed around the wrong person or the wrong moment.',
          'Watch for change between the cards. A Cups card in the past followed by Swords in the present suggests a feeling that has turned into an argument or a decision. Two Major Arcana cards in a row point to something larger than a single week’s mood. A reversed card in the middle position often marks the place where things are stuck.',
        ],
      },
      {
        heading: 'Questions about relationships',
        paragraphs: [
          'Most people bring this spread to an ex, a situationship or someone they are not sure about. Keep the question about the connection itself rather than a yes or a no, for example “What is this between us?” instead of “Will they text me?” The cards reflect patterns rather than predict what another person will do, and the reading is meant for self-reflection.',
        ],
      },
    ],
    moreTitle: 'Other spreads to try',
    more: {
      daily:
        'For a quick morning check-in with a single card, use the [one card tarot pull](one-card).',
      'yes-or-no':
        'When you only need a lean on a direct question, try [pick a card tarot](pick-a-card).',
      'celtic-cross':
        'For a tangled situation with many moving parts, lay out the ten-card [Celtic Cross spread](celtic-cross).',
    },
    faq: [
      {
        q: 'How do you read a past present future tarot spread?',
        a: 'Turn the cards in order and link them into one sentence before reading any single card in depth. The past card explains the setup, the present card names the real issue, and the future card shows the current direction, which you can still change.',
        origin: 'local',
      },
      {
        q: 'Is a 3 card past present future spread good for love questions?',
        a: 'Yes, as long as the question is about the relationship rather than about controlling someone. It shows how a connection got here and what pattern is repeating, which is often more useful than a single answer.',
        origin: 'local',
      },
      {
        q: 'What if the future card looks bad?',
        a: 'Treat it as the direction things lean today, not a verdict. Go back to the present card and ask what you could do differently there; the future card is the part of the story most open to change.',
        origin: 'adapted',
      },
    ],
  },
  daily: {
    h1: 'One card tarot pull',
    intro:
      'One card, one theme for the day. Draw it in the morning, keep it in mind, and look at it again in the evening to see where it showed up.',
    feelingsNote:
      'If your card makes you think of someone, look it up among [all 78 cards as feelings](feelings) to read it from their side.',
    templates: [
      'What should I pay attention to today?',
      'How can I handle seeing my ex at the party tonight?',
      'What do I need to remember before my call with my long-distance partner?',
      'How should I show up at work around my crush today?',
      'What is draining my energy this week?',
      'What small thing would make today go better?',
    ],
    positionsTitle: 'The single position',
    positions: [
      'One theme to carry through the day. Notice where it appears in conversations, choices and moods, then check back with it before bed.',
    ],
    sections: [
      {
        heading: 'Why a single card works',
        paragraphs: [
          'A one card tarot pull is the simplest habit in tarot. With no other cards to compare against, you cannot hide in the details; you have to decide what this one image is saying to you today. That makes it a good way to learn the deck, since you live with each card for a full day instead of skimming past it.',
          'Keep the question small and present. “What do I need today?” works better than “How will this year go?” If the card is reversed, read it as the same theme turned inward or blocked, rather than its opposite.',
        ],
      },
      {
        heading: 'Keeping a card journal',
        paragraphs: [
          'Write down the card, one word it brings to mind, and one line in the evening about what actually happened. After a few weeks you will see which cards keep coming back and which suits dominate. A single pull is for reflection; it does not predict the day, but a written record shows you your own patterns surprisingly fast.',
          'It also helps to note the suit. A week of Cups pulls suggests your days may be shaped by feelings and relationships; a run of Pentacles points to money, work and the body. If the Major Arcana keep turning up, something larger than routine is asking for attention.',
        ],
      },
    ],
    moreTitle: 'Other spreads to try',
    more: {
      'three-card':
        'When one card is not enough, the [past present future tarot](spreads) spread tells the whole story in three.',
      'yes-or-no':
        'With a direct question between two options, you can [pick a card](pick-a-card) for a yes, no or maybe lean.',
      'celtic-cross':
        'For a full look at a complicated situation, read the [Celtic Cross positions](celtic-cross) one by one.',
    },
    faq: [
      {
        q: 'Can a one card tarot pull answer yes or no?',
        a: 'It can give a lean, but this page is set up for a daily theme. For a direct question with two options, the pick a card spread is built for that and shows a yes, no or maybe beside the card.',
        origin: 'local',
      },
      {
        q: 'How often should I draw a tarot card for today?',
        a: 'Once a day is plenty. Drawing again and again for the same question until you get a card you like tells you more about your hopes than about the situation.',
        origin: 'local',
      },
      {
        q: 'What does it mean if I keep pulling the same card?',
        a: 'A card that repeats usually marks a theme you have not finished with. Write down what was happening each time it appeared and look for the common thread.',
        origin: 'adapted',
      },
    ],
  },
  'yes-or-no': {
    h1: 'Pick a card tarot',
    intro:
      'Ask a question that has two clear options, choose one card from the spread, and see whether it leans yes, no or maybe. The lean comes from a fixed list for all 78 cards, so the same card in the same orientation always gives the same answer.',
    feelingsNote:
      'For questions like “Do they still care?” the card’s page in [tarot cards as feelings](feelings) adds the emotional side to the plain answer.',
    templates: [
      'Should I reply to my ex’s message?',
      'Is it a good idea to define things in this situationship?',
      'Should I book the flight to visit my long-distance partner?',
      'Should I ask my coworker crush to get coffee?',
      'Should I reach out to an old friend this week?',
      'Should I start the course I have been considering?',
    ],
    positionsTitle: 'The single position',
    positions: [
      'The card you picked and the answer it carries. Read the image as well as the label: it tells you why the lean goes the way it does and what to watch for.',
    ],
    sections: [
      {
        heading: 'How the yes, no or maybe is decided',
        paragraphs: [
          'Every card in the deck, upright and reversed, is assigned a yes, no or maybe in advance, following common tarot practice: cards of growth, success and union lean yes, cards of loss, conflict or stalling lean no, and cards of waiting or mixed signals lean maybe. Nothing is decided after you pick. That keeps the result consistent, because you cannot be nudged toward the answer you hoped for.',
          'A maybe is not a failure. It usually means the outcome depends on something you have not yet done, or on information you do not have. Read the card for what that missing piece is.',
        ],
      },
      {
        heading: 'Writing a good pick a card question',
        paragraphs: [
          'Ask about your own action, phrased so that yes and no are both clear: “Should I reply to the message?” rather than “Does he love me?” Ask once, take the answer as a prompt for reflection, and then make the decision yourself. A card cannot predict another person’s choices, and a quick lean is a starting point, not the final word.',
          'Pay attention to how you feel the moment the answer appears. Relief at a no, or a sinking feeling at a yes, tells you something the card alone cannot.',
        ],
      },
    ],
    moreTitle: 'Other spreads to try',
    more: {
      daily:
        'No urgent question today? A [one card tarot pull](one-card) gives you one theme to carry instead.',
      'three-card':
        'If the answer raises a “why,” turn to one of the longer [tarot spreads](spreads) for the backstory.',
      'celtic-cross':
        'For a decision with a lot riding on it, the [Celtic Cross spread](celtic-cross) looks at it from ten angles.',
    },
    faq: [
      {
        q: 'Is pick a card tarot yes or no accurate?',
        a: 'The draw is random and the yes, no or maybe comes from a fixed traditional list, so it is consistent rather than prophetic. Use it to check your gut feeling about a choice, not as proof of what will happen.',
        origin: 'local',
      },
      {
        q: 'Which tarot cards mean yes?',
        a: 'Upright, cards like The Sun, The Star, the Ace of Cups and the Ten of Cups lean yes, while The Tower, the Three of Swords and the Five of Pentacles lean no. Reversed, most of them soften to maybe, though The Tower stays a no. The page shows the lean beside whichever card you pick.',
        origin: 'local',
      },
      {
        q: 'Can I ask the same question twice?',
        a: 'You can, but the first card is the one to work with. If you keep redrawing, write down why the first answer bothered you; that reaction is often the real answer.',
        origin: 'adapted',
      },
    ],
  },
  'celtic-cross': {
    h1: 'The Celtic Cross spread, position by position',
    intro:
      'Ten cards in two parts: a cross of six cards around the heart of the question, and a staff of four cards that looks at you and your surroundings. Each position below explains what that card is answering, in the order the cards are laid.',
    feelingsNote:
      'When the question is about a partner or an ex, the cards in the environment and hopes positions read well alongside [all 78 cards as feelings](feelings).',
    templates: [
      'What is the full picture with my ex, and what am I not seeing?',
      'Where is this situationship really going, and what is holding it back?',
      'What would it take to close the distance in my relationship?',
      'How should I handle my feelings for someone I work with?',
      'Should I change careers, and what is in the way?',
      'What do I need to understand about this family conflict?',
    ],
    positionsTitle: 'The ten positions explained',
    positions: [
      'The heart of the matter. This card sits in the center and describes the situation as it stands, the thing every other card is commenting on.',
      'Laid across the first card. It names the friction, the obstacle or the competing pull that keeps the situation from moving on its own.',
      'Below the cross. The roots of the question, often older than the question itself: an upbringing, a past decision or a belief you take for granted.',
      'To the left. Something that has just happened or is just ending, whose effects are still being felt.',
      'Above the cross. What you are aiming for or thinking about on purpose, which may or may not match what you actually want.',
      'To the right. Where things are moving next if the present forces continue, a direction you can still adjust.',
      'The bottom of the staff. How you are handling the situation: your attitude, your habits and the part you play.',
      'Second on the staff. Other people and circumstances around you, including the people the question is about.',
      'Third on the staff. What you are hoping for and what you are afraid of, which are often the same thing seen from two sides.',
      'The top of the staff. The card that pulls the reading together and suggests what to take forward into your next step.',
    ],
    sections: [
      {
        heading: 'The order matters',
        paragraphs: [
          'The usual order of the Celtic Cross spread positions is center, crossing card, below, left, above, right, then the four cards of the staff from bottom to top. Some books swap the left and right cards or put the conscious focus below; this page keeps one order throughout so that every reading can be compared with the last.',
          'Read the cross first as a small spread of its own, then let the staff comment on it. The crossing card is the key to the first half: if it is gentle, the situation is mostly about timing; if it is harsh, it is about a real conflict that needs facing.',
        ],
      },
      {
        heading: 'Reading the spread for a relationship',
        paragraphs: [
          'For questions about how someone feels about you, the eighth position carries the most weight, since it describes the other person and their circumstances. Compare it with the ninth, your own hopes and fears: when the two cards share a suit, both of you may be responding to the same theme in different ways. The tenth card is a theme for reflection about what you want to do next. It does not predict their choices.',
        ],
      },
    ],
    moreTitle: 'Other spreads to try',
    more: {
      daily:
        'Too much for today? You can [draw a tarot card for today](one-card) and come back later.',
      'three-card':
        'For a shorter version of the story, start with one of the simpler [tarot spreads](spreads).',
      'yes-or-no': 'If you just need a lean on one choice, [pick a card](pick-a-card) is quicker.',
    },
    faq: [
      {
        q: 'What is the order of the Celtic Cross spread positions?',
        a: 'Center card, crossing card, the card below, the card to the left, the card above, the card to the right, then the staff of four cards from bottom to top: your approach, environment, hopes and fears, and integration.',
        origin: 'local',
      },
      {
        q: 'How do I ask the Celtic Cross how he feels about me?',
        a: 'Ask about the relationship as a whole, for example “What is happening between us?” Then read the environment card for his side, the hopes and fears card for yours, and the crossing card for what stands between you.',
        origin: 'local',
      },
      {
        q: 'Is the Celtic Cross too complicated for beginners?',
        a: 'It looks like a lot, but each position asks one clear question. Read one card at a time with its position explanation open, and write a single sentence for each before you try to connect them.',
        origin: 'adapted',
      },
    ],
  },
}

export const FEELINGS_INDEX: FeelingsIndexCopy = {
  title: 'Tarot Cards as Feelings: All 78 Cards',
  description:
    'Tarot cards as feelings: all 78 cards read for how someone feels about you, from a crush or partner to an ex, upright and reversed, for reflection only.',
  nav: 'Tarot Cards as Feelings',
  h1: 'Tarot cards as feelings',
  intro:
    'When you ask how someone feels, the card you draw stands for their side of the connection. Each of the 78 pages below reads one card that way, for a partner, a crush and an ex, upright and reversed. Draw a card in the [past present future tarot](spreads) spread or [pick a card](pick-a-card), then come back here to read it as feelings. These readings are for reflection and do not predict what anyone will do.',
  groups: {
    major: {
      about:
        'When a Major Arcana card shows up as someone’s feelings, it usually points to something bigger than a passing mood: a turning point, a belief about love, or a pattern that keeps repeating between you. Read these cards slowly and ask what has been building for a while. Several of them, such as The Tower or Death, sound alarming out of context, yet as feelings they usually describe an ending of one stage rather than an ending of care. The Lovers, The Star and The Sun are the most openly warm; The Hermit and The Hanged Man tend to mean someone is holding feelings in suspense.',
      title: 'Major Arcana',
      note: 'Twenty-two cards for feelings that run deep or change the shape of a relationship.',
    },
    wands: {
      about:
        'Wands carry heat. As feelings they describe pull, curiosity and the urge to act, sometimes faster than either of you can plan. The open question with this suit is whether the spark has somewhere steady to land. The early cards in the suit read like a first text or a bold invitation, while the later ones show the same energy turning into rivalry, defensiveness or exhaustion. The court cards often describe a particular person’s style of pursuing you more than a single mood.',
      title: 'Wands',
      note: 'Attraction, excitement and drive: how strongly someone is drawn toward you.',
    },
    cups: {
      about:
        'Cups speak most directly about the heart. They range from a new, shy affection to grief and nostalgia, and they often show what someone feels but has not said. Pay attention to whether the cup is offered, held back or spilled. The Two and Ten of Cups are the clearest signs of mutual warmth in the whole deck, while the Five and Eight usually point to regret or a quiet decision to walk away. Reversed, many Cups cards describe feelings that exist but are not being expressed.',
      title: 'Cups',
      note: 'Tenderness, longing and emotional openness, the suit most often tied to love.',
    },
    swords: {
      about:
        'Swords move the story into the mind. As feelings they can mean honesty and clear decisions, or worry, guilt and arguments replayed at night. They are a reminder that what someone thinks about you and what they feel are not always the same. The Three, Nine and Ten of Swords look heavy, but they often describe pain that is being processed rather than a verdict on the relationship. The Ace and the Queen point to clarity: someone who knows what they want and is willing to say it.',
      title: 'Swords',
      note: 'Thoughts, doubts and hard conversations: what someone is turning over in their head.',
    },
    pentacles: {
      about:
        'Pentacles judge feelings by what happens next: time given, plans kept, money and effort shared. A Pentacles card rarely sounds romantic, yet it often says the most about whether someone intends to stay. When the Ace or the Ten turns up, the feelings usually want a future, from a first real plan to a shared home. The Four and the Five sit at the opposite edge: someone holds back because they fear losing what they have, or fear having too little to give. Slow, practical gestures such as remembering a routine or fixing something without being asked count as feelings here, even when nobody uses the word love. When you read this suit about someone, ask what they are ready to build, budget for or show up for each week. People in this suit often show care through steady action rather than words, so a quiet card is not necessarily a cold one. If a reading feels unclear, compare it with what the person actually does: whether they keep their promises, turn up when they said they would and make room in their life for you.',
      title: 'Pentacles',
      note: 'Commitment, security and effort: whether feelings are backed by steady action.',
    },
  },
}

export const FEELINGS_CARD: FeelingsCardCopy = {
  crumb: 'Tarot Cards as Feelings',
  facts: { group: 'Group', keywords: 'Feeling words', yesNo: 'Pick a card lean' },
  tryTitle: 'Draw a card about them',
  tryIntro:
    'Think of the person, draw one card and turn it over, then read it here as their feelings.',
  drawLabel: 'Draw a card',
  cardLink: '{name} as feelings',
  relatedTitle: 'Cards to compare',
  relatedIntroMajor:
    'Feelings rarely arrive alone. If you drew {name} for a partner, a crush or an ex, compare it with its neighbors in the Major Arcana, which show what usually comes just before and after this mood, and with one card that answers the same emotional question from a different angle.',
  relatedIntroMinor:
    'Feelings rarely stay still. Its neighbors in the suit show whether the mood behind {name} is warming up or cooling down, and the matching rank from a sister suit shows how the same intensity looks when it is expressed through action, thought or practical care instead.',
  related: {
    before: 'One step earlier',
    after: 'One step later',
    after2: 'Two steps later',
    pairMajor: 'Shared theme',
    pairMinor: 'Same number, other suit',
  },
  band: 'Want to see how {name} fits into a longer story about the two of you? Lay out three free cards for the past, the present and where things are heading.',
  bandLabel: 'past present future tarot',
  faqTitle: 'Questions about this card as feelings',
  note: 'Reading a card as feelings is for reflection on your own relationships; it does not predict what another person thinks or will do.',
}
