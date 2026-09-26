/**
 * Pictures a child can pick for their player tile.
 *
 * Stored on the server by key (not by emoji), so the list can be restyled later
 * without touching saved profiles. Keep keys lowercase letters only; the
 * database checks that shape.
 */
type Avatar = { key: string; emoji: string; name: string };
const a = (key: string, emoji: string, name: string): Avatar => ({ key, emoji, name });

/**
 * The picture library, in groups a child can browse. FEATURED_KEYS are the
 * ones shown straight away on the "add a child" form; "More" opens the rest.
 * Keys are permanent once shipped (saved profiles point at them), so rename
 * the `name`, never the `key`.
 */
export const AVATAR_GROUPS: { key: string; title: string; icon: string; items: Avatar[] }[] = [
  { key: 'animals', title: 'Animals', icon: '🐾', items: [
    a('bear', '🐻', 'Bear'), a('fox', '🦊', 'Fox'), a('panda', '🐼', 'Panda'), a('koala', '🐨', 'Koala'),
    a('tiger', '🐯', 'Tiger'), a('lion', '🦁', 'Lion'), a('bunny', '🐰', 'Bunny'), a('puppy', '🐶', 'Puppy'),
    a('kitty', '🐱', 'Kitty'), a('frog', '🐸', 'Frog'), a('monkey', '🐵', 'Monkey'), a('penguin', '🐧', 'Penguin'),
    a('cow', '🐮', 'Cow'), a('pig', '🐷', 'Pig'), a('mouse', '🐭', 'Mouse'), a('hamster', '🐹', 'Hamster'),
    a('wolf', '🐺', 'Wolf'), a('horse', '🐴', 'Horse'), a('zebra', '🦓', 'Zebra'), a('giraffe', '🦒', 'Giraffe'),
    a('elephant', '🐘', 'Elephant'), a('hedgehog', '🦔', 'Hedgehog'), a('sloth', '🦥', 'Sloth'), a('otter', '🦦', 'Otter'),
  ] },
  { key: 'birds', title: 'Birds & bugs', icon: '🦋', items: [
    a('owl', '🦉', 'Owl'), a('parrot', '🦜', 'Parrot'), a('chick', '🐥', 'Chick'), a('duck', '🦆', 'Duck'),
    a('peacock', '🦚', 'Peacock'), a('flamingo', '🦩', 'Flamingo'), a('swan', '🦢', 'Swan'), a('bee', '🐝', 'Bee'),
    a('butterfly', '🦋', 'Butterfly'), a('ladybug', '🐞', 'Ladybug'), a('snail', '🐌', 'Snail'), a('caterpillar', '🐛', 'Caterpillar'),
  ] },
  { key: 'sea', title: 'Sea', icon: '🐳', items: [
    a('octopus', '🐙', 'Octopus'), a('dolphin', '🐬', 'Dolphin'), a('whale', '🐳', 'Whale'), a('shark', '🦈', 'Shark'),
    a('fish', '🐠', 'Fish'), a('blowfish', '🐡', 'Blowfish'), a('turtle', '🐢', 'Turtle'), a('crab', '🦀', 'Crab'),
    a('squid', '🦑', 'Squid'), a('lobster', '🦞', 'Lobster'), a('shrimp', '🦐', 'Shrimp'), a('seal', '🦭', 'Seal'),
  ] },
  { key: 'magic', title: 'Magic & dinos', icon: '🦄', items: [
    a('unicorn', '🦄', 'Unicorn'), a('dino', '🦖', 'Dinosaur'), a('longneck', '🦕', 'Long-neck dino'), a('dragon', '🐉', 'Dragon'),
    a('fairy', '🧚', 'Fairy'), a('wizard', '🧙', 'Wizard'), a('mermaid', '🧜', 'Mermaid'), a('genie', '🧞', 'Genie'),
    a('superhero', '🦸', 'Superhero'), a('robot', '🤖', 'Robot'), a('alien', '👽', 'Alien'), a('ghost', '👻', 'Friendly ghost'),
  ] },
  { key: 'space', title: 'Sky & space', icon: '🚀', items: [
    a('rocket', '🚀', 'Rocket'), a('planet', '🪐', 'Planet'), a('star', '🌟', 'Star'), a('moon', '🌙', 'Moon'),
    a('sun', '🌞', 'Sun'), a('rainbow', '🌈', 'Rainbow'), a('comet', '☄️', 'Comet'), a('saucer', '🛸', 'Flying saucer'),
  ] },
  { key: 'food', title: 'Yummy', icon: '🍓', items: [
    a('apple', '🍎', 'Apple'), a('banana', '🍌', 'Banana'), a('strawberry', '🍓', 'Strawberry'), a('watermelon', '🍉', 'Watermelon'),
    a('cherries', '🍒', 'Cherries'), a('pineapple', '🍍', 'Pineapple'), a('avocado', '🥑', 'Avocado'), a('carrot', '🥕', 'Carrot'),
    a('pizza', '🍕', 'Pizza'), a('donut', '🍩', 'Donut'), a('cupcake', '🧁', 'Cupcake'), a('icecream', '🍦', 'Ice cream'),
  ] },
  { key: 'play', title: 'Play', icon: '⚽', items: [
    a('soccer', '⚽', 'Football'), a('basketball', '🏀', 'Basketball'), a('tennis', '🎾', 'Tennis'), a('kite', '🪁', 'Kite'),
    a('guitar', '🎸', 'Guitar'), a('drum', '🥁', 'Drum'), a('paint', '🎨', 'Paint'), a('teddy', '🧸', 'Teddy'),
    a('balloon', '🎈', 'Balloon'), a('car', '🚗', 'Car'), a('train', '🚂', 'Train'), a('plane', '✈️', 'Plane'),
  ] },
];

/** Every picture, in browsing order. */
export const AVATARS: Avatar[] = AVATAR_GROUPS.flatMap(g => g.items);

/** Shown straight away on the add-a-child form (plus a Browse button for the rest). */
const FEATURED_KEYS = ['bear', 'fox', 'panda', 'koala', 'tiger', 'lion', 'bunny', 'puppy', 'kitty', 'frog', 'monkey', 'penguin', 'unicorn', 'dino', 'octopus'];
export const FEATURED_AVATARS: Avatar[] = FEATURED_KEYS.map(key => AVATARS.find(item => item.key === key)!);

export function avatarGroupOf(key: string | null | undefined): string {
  return AVATAR_GROUPS.find(g => g.items.some(i => i.key === key))?.key ?? AVATAR_GROUPS[0]!.key;
}

export type AvatarKey = string;

const BY_KEY = new Map<string, Avatar>(AVATARS.map(item => [item.key, item]));

/** Pictures shown for older profiles that never picked one (by position). */
const DEFAULT_AVATAR_KEYS = AVATARS.slice(0, 4);

/** The key shown for a child without a saved picture. */
export function defaultAvatarKey(fallbackIndex: number): AvatarKey {
  return DEFAULT_AVATAR_KEYS[Math.abs(fallbackIndex) % DEFAULT_AVATAR_KEYS.length]!.key;
}

export function isAvatarKey(key: unknown): key is AvatarKey {
  return typeof key === 'string' && BY_KEY.has(key);
}

/** The picture for a saved child, falling back to one picked by position. */
export function avatarEmoji(key: string | null | undefined, fallbackIndex = 0): string {
  return (key && BY_KEY.get(key)?.emoji) || DEFAULT_AVATAR_KEYS[Math.abs(fallbackIndex) % DEFAULT_AVATAR_KEYS.length]!.emoji;
}

export function avatarName(key: string | null | undefined): string {
  return (key && BY_KEY.get(key)?.name) || 'Picture';
}

/** A friendly default for a new child: the first picture no sibling uses yet. */
export function firstFreeAvatar(taken: (string | null | undefined)[]): AvatarKey {
  const used = new Set(taken.filter(Boolean));
  return (AVATARS.find(item => !used.has(item.key)) ?? AVATARS[0]!).key;
}
