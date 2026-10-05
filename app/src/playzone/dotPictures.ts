/**
 * Pictures for Connect the Dots. Each picture is drawn on a 100 × 100 grid
 * (y points down). `dots` are visited in order — every dot is a corner of the
 * outline, so joining them in order draws the picture. `closed` joins the last
 * dot back to the first. `extras` are little details (eyes, a door, a window)
 * that appear once the picture is finished.
 *
 * Keep dots at least 9 units apart so a finger can't hit two at once
 * (checked by checkDotPicture below).
 */
export type Pt = [number, number];
export type Extra =
  | { circle: [number, number, number]; fill: string }
  | { line: [number, number, number, number]; color: string; width?: number }
  | { shape: Pt[]; fill: string };

export interface DotPicture {
  key: string;
  name: string;
  /** Said and shown when it's finished: "It's a fish!" */
  spoken: string;
  emoji: string;
  fill: string;
  outline: string;
  closed: boolean;
  dots: Pt[];
  extras?: Extra[];
}

const EYE = '#3F3126';

/** A star with `points` tips, starting at the top. */
function star(cx: number, cy: number, outer: number, inner: number, points: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    return [Math.round((cx + r * Math.cos(a)) * 10) / 10, Math.round((cy + r * Math.sin(a)) * 10) / 10] as Pt;
  });
}

export const DOT_PICTURES: Record<string, DotPicture> = {
  kite: {
    key: 'kite', name: 'Kite', spoken: "It's a kite!", emoji: '🪁', fill: '#F7A8B8', outline: '#C2416B', closed: true,
    dots: [[50, 10], [78, 42], [50, 76], [22, 42]],
    extras: [
      { line: [50, 10, 50, 76], color: '#C2416B', width: 1.5 }, { line: [22, 42, 78, 42], color: '#C2416B', width: 1.5 },
      { line: [50, 76, 44, 84], color: '#7A6A5A', width: 1.2 }, { line: [44, 84, 54, 90], color: '#7A6A5A', width: 1.2 },
      { line: [54, 90, 48, 97], color: '#7A6A5A', width: 1.2 },
      { circle: [46, 86, 2.2], fill: '#F4C966' }, { circle: [52, 92, 2.2], fill: '#7EC8E3' },
    ],
  },
  house: {
    key: 'house', name: 'House', spoken: "It's a house!", emoji: '🏠', fill: '#F9D58B', outline: '#B9781F', closed: true,
    dots: [[20, 88], [20, 46], [50, 14], [80, 46], [80, 88]],
    extras: [
      { shape: [[20, 46], [50, 14], [80, 46]], fill: '#E8724F' },
      { shape: [[42, 88], [42, 64], [58, 64], [58, 88]], fill: '#8A5A2B' },
      { shape: [[26, 54], [26, 66], [38, 66], [38, 54]], fill: '#BDE3F5' },
      { shape: [[62, 54], [62, 66], [74, 66], [74, 54]], fill: '#BDE3F5' },
      { circle: [55, 77, 1.3], fill: '#F4C966' },
    ],
  },
  boat: {
    key: 'boat', name: 'Boat', spoken: "It's a sailboat!", emoji: '⛵', fill: '#9FD3F0', outline: '#2F6F9D', closed: true,
    dots: [[50, 10], [80, 56], [90, 64], [74, 86], [26, 86], [10, 64]],
    extras: [
      { shape: [[50, 10], [80, 56], [50, 56]], fill: '#FFFFFF' },
      { shape: [[50, 18], [24, 56], [50, 56]], fill: '#FFE4A8' },
      { line: [50, 10, 50, 64], color: '#7A5A3A', width: 1.8 },
      { shape: [[10, 64], [90, 64], [74, 86], [26, 86]], fill: '#E8724F' },
      { line: [4, 92, 96, 92], color: '#68A8D6', width: 2 },
    ],
  },
  heart: {
    key: 'heart', name: 'Heart', spoken: "It's a heart!", emoji: '❤️', fill: '#F48A9B', outline: '#C2416B', closed: true,
    dots: [[50, 28], [66, 14], [84, 20], [91, 38], [82, 58], [50, 88], [18, 58], [9, 38], [16, 20], [34, 14]],
    extras: [{ circle: [30, 30, 4], fill: '#FFFFFF' }],
  },
  star: {
    key: 'star', name: 'Star', spoken: "It's a star!", emoji: '⭐', fill: '#FFD95A', outline: '#C99A12', closed: true,
    dots: star(50, 54, 44, 19, 5),
    extras: [{ circle: [43, 52, 2.4], fill: EYE }, { circle: [57, 52, 2.4], fill: EYE }, { line: [44, 60, 50, 64], color: EYE, width: 1.6 }, { line: [50, 64, 56, 60], color: EYE, width: 1.6 }],
  },
  fish: {
    key: 'fish', name: 'Fish', spoken: "It's a fish!", emoji: '🐟', fill: '#FFB067', outline: '#C2621B', closed: true,
    dots: [[10, 50], [26, 32], [48, 25], [67, 33], [80, 45], [94, 28], [94, 72], [80, 55], [67, 67], [48, 75], [26, 68]],
    extras: [
      { circle: [25, 45, 3.6], fill: '#FFFFFF' }, { circle: [25, 45, 1.8], fill: EYE },
      { line: [40, 36, 40, 64], color: '#C2621B', width: 1.2 }, { line: [52, 34, 52, 66], color: '#C2621B', width: 1.2 },
      { circle: [6, 36, 2], fill: '#BDE3F5' }, { circle: [3, 26, 1.4], fill: '#BDE3F5' },
    ],
  },
  owl: {
    key: 'owl', name: 'Owl', spoken: "It's an owl, just like me!", emoji: '🦉', fill: '#8B6CC9', outline: '#4E3590', closed: true,
    dots: [[26, 10], [40, 24], [60, 24], [74, 10], [79, 34], [85, 56], [78, 78], [64, 90], [36, 90], [22, 78], [15, 56], [21, 34]],
    extras: [
      { shape: [[30, 54], [50, 46], [70, 54], [64, 84], [36, 84]], fill: '#FFF3DC' },
      { circle: [38, 40, 9], fill: '#FFFFFF' }, { circle: [62, 40, 9], fill: '#FFFFFF' },
      { circle: [38, 40, 4], fill: EYE }, { circle: [62, 40, 4], fill: EYE },
      { shape: [[46, 50], [54, 50], [50, 58]], fill: '#F2994A' },
    ],
  },
  cat: {
    key: 'cat', name: 'Cat', spoken: "It's a cat! Meow!", emoji: '🐱', fill: '#F6C177', outline: '#B9781F', closed: true,
    dots: [[30, 32], [20, 8], [42, 24], [58, 24], [80, 8], [70, 32], [83, 50], [80, 70], [66, 86], [50, 91], [34, 86], [20, 70], [17, 50]],
    extras: [
      { shape: [[25, 14], [36, 26], [29, 30]], fill: '#F7A8B8' }, { shape: [[75, 14], [64, 26], [71, 30]], fill: '#F7A8B8' },
      { circle: [39, 52, 3.5], fill: EYE }, { circle: [61, 52, 3.5], fill: EYE },
      { shape: [[46, 62], [54, 62], [50, 67]], fill: '#E8724F' },
      { line: [30, 64, 12, 60], color: EYE, width: 1 }, { line: [30, 68, 12, 70], color: EYE, width: 1 },
      { line: [70, 64, 88, 60], color: EYE, width: 1 }, { line: [70, 68, 88, 70], color: EYE, width: 1 },
    ],
  },
  rocket: {
    key: 'rocket', name: 'Rocket', spoken: "It's a rocket! Whoosh!", emoji: '🚀', fill: '#E9EEF5', outline: '#4A6280', closed: true,
    dots: [[50, 5], [62, 19], [66, 38], [66, 60], [80, 74], [80, 90], [64, 82], [58, 90], [42, 90], [36, 82], [20, 90], [20, 74], [34, 60], [34, 38], [38, 19]],
    extras: [
      { shape: [[50, 5], [62, 19], [38, 19]], fill: '#E8724F' },
      { circle: [50, 42, 8], fill: '#7EC8E3' }, { circle: [50, 42, 5], fill: '#BDE3F5' },
      { shape: [[42, 90], [58, 90], [50, 99]], fill: '#F4C966' },
      { shape: [[66, 60], [80, 74], [80, 90], [64, 82]], fill: '#E8724F' }, { shape: [[34, 60], [20, 74], [20, 90], [36, 82]], fill: '#E8724F' },
    ],
  },
  tree: {
    key: 'tree', name: 'Tree', spoken: "It's a pine tree!", emoji: '🌲', fill: '#6CC08B', outline: '#2F7A4F', closed: true,
    dots: [[50, 5], [66, 24], [55, 24], [76, 44], [64, 44], [86, 66], [56, 66], [56, 90], [44, 90], [44, 66], [14, 66], [36, 44], [24, 44], [45, 24], [34, 24]],
    extras: [
      { shape: [[44, 66], [56, 66], [56, 90], [44, 90]], fill: '#8A5A2B' },
      { circle: [44, 36, 2.4], fill: '#E8724F' }, { circle: [58, 52, 2.4], fill: '#F4C966' }, { circle: [36, 58, 2.4], fill: '#7EC8E3' },
      { circle: [66, 60, 2.4], fill: '#F7A8B8' },
    ],
  },
  castle: {
    key: 'castle', name: 'Castle', spoken: "It's a castle!", emoji: '🏰', fill: '#D9CBEF', outline: '#6A58A0', closed: true,
    dots: [[10, 90], [10, 30], [22, 30], [22, 42], [36, 42], [36, 20], [64, 20], [64, 42], [78, 42], [78, 30], [90, 30], [90, 90], [60, 90], [60, 68], [40, 68], [40, 90]],
    extras: [
      { line: [50, 20, 50, 6], color: '#6A58A0', width: 1.5 }, { shape: [[50, 6], [62, 10], [50, 14]], fill: '#E8724F' },
      { shape: [[40, 68], [60, 68], [60, 90], [40, 90]], fill: '#8A5A2B' },
      { shape: [[45, 30], [55, 30], [55, 40], [45, 40]], fill: '#FFF3DC' },
      { shape: [[14, 50], [19, 50], [19, 58], [14, 58]], fill: '#FFF3DC' }, { shape: [[81, 50], [86, 50], [86, 58], [81, 58]], fill: '#FFF3DC' },
    ],
  },
  butterfly: {
    key: 'butterfly', name: 'Butterfly', spoken: "It's a butterfly!", emoji: '🦋', fill: '#9DD4F2', outline: '#2F6F9D', closed: true,
    dots: [[50, 30], [62, 12], [82, 8], [93, 22], [86, 42], [66, 50], [84, 62], [86, 82], [70, 91], [55, 74], [50, 84],
      [45, 74], [30, 91], [14, 82], [16, 62], [34, 50], [14, 42], [7, 22], [18, 8], [38, 12]],
    extras: [
      { shape: [[47, 28], [53, 28], [53, 82], [47, 82]], fill: '#4A3728' },
      { line: [49, 28, 42, 14], color: '#4A3728', width: 1.2 }, { line: [51, 28, 58, 14], color: '#4A3728', width: 1.2 },
      { circle: [74, 28, 6], fill: '#F4C966' }, { circle: [26, 28, 6], fill: '#F4C966' },
      { circle: [72, 72, 4.5], fill: '#F7A8B8' }, { circle: [28, 72, 4.5], fill: '#F7A8B8' },
    ],
  },
};

export interface DotLevel {
  name: string;
  /** How the dots are labelled: 1, 2, 3… or A, B, C… */
  labels: 'numbers' | 'letters';
  pictures: string[];
}

export const DOT_LEVELS: DotLevel[] = [
  { name: 'Count to 6', labels: 'numbers', pictures: ['kite', 'house', 'boat'] },
  { name: 'Count to 11', labels: 'numbers', pictures: ['heart', 'star', 'fish'] },
  { name: 'Count to 15', labels: 'numbers', pictures: ['owl', 'cat', 'rocket'] },
  { name: 'Count to 20', labels: 'numbers', pictures: ['tree', 'castle', 'butterfly'] },
  { name: 'Letters A to T', labels: 'letters', pictures: ['owl', 'rocket', 'butterfly'] },
];

export const dotLabel = (i: number, labels: DotLevel['labels']) => labels === 'letters' ? String.fromCharCode(65 + i) : String(i + 1);

/** First level for a child's age: 4 → 1 … 7+ → 4. */
export const defaultDotLevel = (age: number | undefined) => Math.min(4, Math.max(1, (age ?? 4) - 3));

/** Problems with a picture (dots too close, off the board), for the tests. */
export function checkDotPicture(p: DotPicture): string[] {
  const problems: string[] = [];
  p.dots.forEach(([x, y], i) => {
    if (x < 3 || x > 97 || y < 3 || y > 97) problems.push(`${p.key}: dot ${i + 1} is off the board`);
    p.dots.forEach(([x2, y2], j) => {
      if (j > i && Math.hypot(x - x2, y - y2) < 9) problems.push(`${p.key}: dots ${i + 1} and ${j + 1} are too close`);
    });
  });
  if (p.dots.length > 26) problems.push(`${p.key}: too many dots for letters`);
  return problems;
}
