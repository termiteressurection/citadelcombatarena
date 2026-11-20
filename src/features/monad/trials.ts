/**
 * The daily trial corpus — one Stoic exercise per weekday, performed at the
 * altar between setting the anchor (gate) and writing the inscription.
 *
 * Practical, not decorative. Each trial is a small real act, completable
 * with one tap plus an optional field note. The field note is inscribed
 * to the journal tagged `daily-trial`.
 */

export interface Trial {
  id: string;
  /** 0 = Sunday … 6 = Saturday (Date.getDay()) */
  weekday: number;
  title: string;
  instruction: string;
  fieldPrompt: string;
}

export const TRIALS: Trial[] = [
  {
    id: 'view-from-above',
    weekday: 0,
    title: 'THE VIEW FROM ABOVE',
    instruction:
      'Climb. Look down at today from high enough that your deadlines are anthills and your anxieties are weather. Hold it for sixty seconds. Then come back down and act like someone who has seen the map.',
    fieldPrompt: 'What looks small from up there?',
  },
  {
    id: 'premeditate-the-blow',
    weekday: 1,
    title: 'PREMEDITATE THE BLOW',
    instruction:
      "Pick the worst thing that could realistically happen today. Walk through it slowly — what breaks, what you'd actually do, who you'd call. You're not inviting it. You're disarming it.",
    fieldPrompt: 'Name the blow, and your first move if it lands:',
  },
  {
    id: 'sort-the-two-piles',
    weekday: 2,
    title: 'SORT THE TWO PILES',
    instruction:
      'Two piles. Pile one: everything about today you control — your effort, your responses, your preparation. Pile two: everything else. Name one item from pile two you will stop gripping.',
    fieldPrompt: 'What are you releasing to pile two?',
  },
  {
    id: 'memento-mori-briefly',
    weekday: 3,
    title: 'MEMENTO MORI, BRIEFLY',
    instruction:
      "You get a finite number of Wednesdays. Spend thirty seconds holding that — not morbidly, precisely. Then pick the one thing today that deserves a mortal's full attention.",
    fieldPrompt: 'What deserves it today?',
  },
  {
    id: 'one-voluntary-discomfort',
    weekday: 4,
    title: 'ONE VOLUNTARY DISCOMFORT',
    instruction:
      "Choose one small discomfort and do it on purpose before noon — cold water, the hard conversation, the task you're circling. Comfort is a cage with good lighting.",
    fieldPrompt: "What's the discomfort?",
  },
  {
    id: 'amor-fati-drill',
    weekday: 5,
    title: 'AMOR FATI DRILL',
    instruction:
      'Take the worst part of this week and practice loving it — not tolerating, loving — as the exact material your life needed. Find one way it forged something.',
    fieldPrompt: 'What did the worst part forge?',
  },
  {
    id: 'the-obstacle-is-the-way',
    weekday: 6,
    title: 'THE OBSTACLE IS THE WAY',
    instruction:
      'Name the biggest thing blocking you right now. Now flip it: write down what this obstacle makes possible that ease never could. The impediment is the path.',
    fieldPrompt: 'What does the obstacle make possible?',
  },
];

export function getTrialForDate(date: Date): Trial {
  const weekday = date.getDay();
  return TRIALS.find((t) => t.weekday === weekday) ?? TRIALS[0];
}
