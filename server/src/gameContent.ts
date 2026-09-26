/**
 * Everything the play-and-learn games show, written once, by hand.
 *
 * Kept deliberately plain: familiar objects a four-year-old knows by sight,
 * emoji that exist on every phone, and facts with one clear answer. Add to any
 * list freely; the generators pick at random.
 */
import type { GameThing } from './types.js';

const t = (emoji: string, name: string, plural?: string): GameThing => (plural ? { emoji, name, plural } : { emoji, name });

/** Things to count, add and take away. */
export const COUNTABLES: GameThing[] = [
  t('🍎', 'apple'), t('🐟', 'fish', 'fish'), t('⭐', 'star'), t('🦆', 'duck'), t('🚗', 'car'),
  t('⚽', 'ball'), t('🌸', 'flower'), t('🍪', 'cookie'), t('🐝', 'bee'), t('🎈', 'balloon'),
  t('🍓', 'strawberry', 'strawberries'), t('🐸', 'frog'), t('🧁', 'cupcake'), t('🦋', 'butterfly', 'butterflies'),
  t('🚀', 'rocket'), t('🐢', 'turtle'), t('🍌', 'banana'), t('🐶', 'puppy', 'puppies'), t('🐦', 'bird'), t('🍩', 'donut'),
];

/** Things that can float away in a take-away game (they look right leaving upwards). */
export const FLOATERS: GameThing[] = [
  t('🎈', 'balloon'), t('🦋', 'butterfly', 'butterflies'), t('🐦', 'bird'), t('🐝', 'bee'), t('🚀', 'rocket'), t('🦆', 'duck'),
];

/** Who hops along the number line. */
export const HOPPERS: GameThing[] = [t('🐸', 'frog'), t('🐰', 'bunny', 'bunnies'), t('🦘', 'kangaroo')];

/** Two baskets and what belongs in each. Also used to build "odd one out". */
export const SORT_SETS: Array<{ baskets: [GameThing, GameThing]; groups: [GameThing[], GameThing[]] }> = [
  {
    baskets: [t('🍇', 'Fruit'), t('🥕', 'Vegetables')],
    groups: [
      [t('🍎', 'apple'), t('🍌', 'banana'), t('🍊', 'orange'), t('🍉', 'watermelon'), t('🍐', 'pear'), t('🍒', 'cherries', 'cherries'), t('🍍', 'pineapple')],
      [t('🥦', 'broccoli', 'broccoli'), t('🌽', 'corn', 'corn'), t('🍆', 'eggplant'), t('🥒', 'cucumber'), t('🥔', 'potato', 'potatoes'), t('🧅', 'onion'), t('🌶️', 'pepper')],
    ],
  },
  {
    baskets: [t('🌊', 'Lives in water'), t('🌳', 'Lives on land')],
    groups: [
      [t('🐟', 'fish', 'fish'), t('🐙', 'octopus', 'octopuses'), t('🐬', 'dolphin'), t('🐳', 'whale'), t('🦀', 'crab'), t('🦈', 'shark')],
      [t('🐘', 'elephant'), t('🐄', 'cow'), t('🦁', 'lion'), t('🐇', 'rabbit'), t('🐒', 'monkey'), t('🦒', 'giraffe')],
    ],
  },
  {
    baskets: [t('☁️', 'Flies in the sky'), t('🛣️', 'Stays on the ground')],
    groups: [
      [t('🐦', 'bird'), t('🦋', 'butterfly', 'butterflies'), t('✈️', 'plane'), t('🚁', 'helicopter'), t('🦅', 'eagle'), t('🎈', 'balloon')],
      [t('🚗', 'car'), t('🐢', 'turtle'), t('🐌', 'snail'), t('🚲', 'bike'), t('🚜', 'tractor'), t('🐘', 'elephant')],
    ],
  },
  {
    baskets: [t('🔥', 'Hot'), t('❄️', 'Cold')],
    groups: [
      [t('☀️', 'sun'), t('☕', 'hot drink'), t('🌋', 'volcano'), t('🍲', 'hot soup', 'hot soup'), t('🕯️', 'candle')],
      [t('🧊', 'ice', 'ice'), t('🍦', 'ice cream', 'ice creams'), t('⛄', 'snowman', 'snowmen'), t('🐧', 'penguin'), t('🏔️', 'snowy mountain')],
    ],
  },
  {
    baskets: [t('🧸', 'Toys'), t('🍽️', 'Food')],
    groups: [
      [t('🪁', 'kite'), t('⚽', 'ball'), t('🎲', 'dice', 'dice'), t('🧩', 'puzzle'), t('🪀', 'yo-yo'), t('🎨', 'paints', 'paints')],
      [t('🍕', 'pizza'), t('🍞', 'bread', 'bread'), t('🧀', 'cheese', 'cheese'), t('🥞', 'pancakes', 'pancakes'), t('🍝', 'pasta', 'pasta'), t('🍪', 'cookie')],
    ],
  },
];

/** Things that happen in order (cause and effect, how things change). */
export const SEQUENCES: Array<{ ask: string; steps: GameThing[] }> = [
  { ask: 'Tap the pictures in order: first, next, last.', steps: [t('🥚', 'egg'), t('🐣', 'hatching chick'), t('🐥', 'chick'), t('🐔', 'hen')] },
  { ask: 'How does a tree grow? Tap them in order.', steps: [t('🌰', 'seed'), t('🌱', 'sprout'), t('🌳', 'tree')] },
  { ask: 'How does a flower grow? Tap them in order.', steps: [t('🌱', 'sprout'), t('🌿', 'plant'), t('🌻', 'flower')] },
  { ask: 'Tap them in order, from youngest to oldest.', steps: [t('👶', 'baby', 'babies'), t('🧒', 'child', 'children'), t('🧑', 'grown-up'), t('🧓', 'grandparent')] },
  { ask: 'What comes first in the day? Tap them in order.', steps: [t('🌅', 'sunrise'), t('☀️', 'middle of the day'), t('🌇', 'sunset'), t('🌙', 'night')] },
  { ask: 'Tap the pictures in order: first, next, last.', steps: [t('☁️', 'clouds'), t('🌧️', 'rain', 'rain'), t('🌈', 'rainbow')] },
  { ask: 'Tap the pictures in order: first, next, last.', steps: [t('🥚', 'egg'), t('🍳', 'cooking'), t('😋', 'yum!')] },
  { ask: 'How does the moon change? Tap them in order.', steps: [t('🌑', 'dark moon'), t('🌓', 'half moon'), t('🌕', 'full moon')] },
];

/** Smallest to biggest, for ordering by size. */
export const SIZE_LADDERS: GameThing[][] = [
  [t('🐜', 'ant'), t('🐭', 'mouse', 'mice'), t('🐱', 'cat'), t('🐴', 'horse'), t('🐘', 'elephant')],
  [t('🍒', 'cherry', 'cherries'), t('🍎', 'apple'), t('🍉', 'watermelon')],
  [t('🐞', 'ladybug'), t('🐇', 'rabbit'), t('🦒', 'giraffe')],
  [t('🚲', 'bike'), t('🚗', 'car'), t('🚌', 'bus', 'buses'), t('✈️', 'plane')],
  [t('🐣', 'chick'), t('🐕', 'dog'), t('🐄', 'cow'), t('🐳', 'whale')],
];

/** True or false, with a picture. One clear answer a young child can know. */
export const FACTS: Array<{ picture: string; text: string; answer: boolean }> = [
  { picture: '🐟', text: 'Fish live in water.', answer: true },
  { picture: '🐱', text: 'A cat can fly like a bird.', answer: false },
  { picture: '🧊', text: 'Ice is cold.', answer: true },
  { picture: '🌙', text: 'We often see the moon at night.', answer: true },
  { picture: '🚗', text: 'A car has wheels.', answer: true },
  { picture: '🍌', text: 'Bananas are blue.', answer: false },
  { picture: '🔥', text: 'Fire is hot.', answer: true },
  { picture: '🐘', text: 'An elephant is smaller than a mouse.', answer: false },
  { picture: '🌧️', text: 'Rain is wet.', answer: true },
  { picture: '🪨', text: 'A big rock floats on water.', answer: false },
  { picture: '🌱', text: 'Plants need water to grow.', answer: true },
  { picture: '🐄', text: 'Cows say moo.', answer: true },
  { picture: '🐶', text: 'Dogs say quack.', answer: false },
  { picture: '❄️', text: 'Snow is hot.', answer: false },
  { picture: '🦒', text: 'A giraffe has a long neck.', answer: true },
  { picture: '🐢', text: 'A turtle runs faster than a car.', answer: false },
  { picture: '🍦', text: 'Ice cream melts in the hot sun.', answer: true },
  { picture: '🎈', text: 'A balloon can float up in the air.', answer: true },
  { picture: '🐝', text: 'Bees make honey.', answer: true },
  { picture: '🥚', text: 'Baby birds hatch from eggs.', answer: true },
  { picture: '🐧', text: 'Penguins live in hot deserts.', answer: false },
  { picture: '🔦', text: 'A torch helps you see in the dark.', answer: true },
  { picture: '🌈', text: 'A rainbow has many colours.', answer: true },
  { picture: '🐌', text: 'A snail carries its shell on its back.', answer: true },
  { picture: '🌳', text: 'Trees grow from tiny seeds.', answer: true },
  { picture: '☀️', text: 'The sun helps plants grow.', answer: true },
  { picture: '🍞', text: 'Bread grows on trees.', answer: false },
];

/** Picture sets for "what comes next?" patterns. */
export const PATTERN_SETS: GameThing[][] = [
  [t('🔴', 'red circle'), t('🔵', 'blue circle'), t('🟡', 'yellow circle'), t('🟢', 'green circle')],
  [t('🍎', 'apple'), t('🍌', 'banana'), t('🍇', 'grapes', 'grapes'), t('🍊', 'orange')],
  [t('🐶', 'puppy', 'puppies'), t('🐱', 'kitty', 'kitties'), t('🐭', 'mouse', 'mice'), t('🐰', 'bunny', 'bunnies')],
  [t('🌙', 'moon'), t('⭐', 'star'), t('☀️', 'sun'), t('☁️', 'cloud')],
  [t('🚗', 'car'), t('🚌', 'bus', 'buses'), t('🚲', 'bike'), t('✈️', 'plane')],
  [t('🟥', 'red square'), t('🟦', 'blue square'), t('🟨', 'yellow square'), t('🟩', 'green square')],
];

/** Pictures for the memory game: easy to tell apart at a glance. */
export const MATCHABLES: GameThing[] = [
  t('🐶', 'puppy'), t('🐱', 'kitty'), t('🦁', 'lion'), t('🐸', 'frog'), t('🐵', 'monkey'), t('🐷', 'pig'),
  t('🍎', 'apple'), t('🍌', 'banana'), t('🍓', 'strawberry'), t('🚗', 'car'), t('🚀', 'rocket'), t('⚽', 'ball'),
  t('🌈', 'rainbow'), t('⭐', 'star'), t('🎈', 'balloon'), t('🦋', 'butterfly'),
];
