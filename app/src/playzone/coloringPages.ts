/**
 * The Coloring Book: original KidCog pictures, drawn here from simple shapes
 * (no copied artwork). Every picture lives in a 100 × 100 box. `parts` are the
 * pieces a child can colour by tapping; `lines` are extra outlines (strings,
 * whiskers) that can't be coloured. `at` is a point inside each part, used to
 * place it in tests and for the "tap here" sparkle.
 */
export type Part = { d: string; at: [number, number] };
export type ColoringPage = { key: string; name: string; emoji: string; group: GroupKey; parts: Part[]; lines?: string[]; caption?: string };
export type GroupKey = 'people' | 'abc' | 'animals' | 'space' | 'music' | 'shapes' | 'go' | 'yummy' | 'seasons';

export const GROUPS: { key: GroupKey; name: string; emoji: string }[] = [
  { key: 'people', name: 'People', emoji: '🦸' },
  { key: 'abc', name: 'ABC', emoji: '🔤' },
  { key: 'animals', name: 'Animals', emoji: '🦁' },
  { key: 'space', name: 'Space', emoji: '🚀' },
  { key: 'music', name: 'Music', emoji: '🎸' },
  { key: 'shapes', name: 'Shapes & numbers', emoji: '🔷' },
  { key: 'go', name: 'Things that go', emoji: '🚗' },
  { key: 'yummy', name: 'Yummy food', emoji: '🧁' },
  { key: 'seasons', name: 'Seasons & fun', emoji: '⛄' },
];

// Little drawing helpers: each returns an SVG path in the 100 × 100 box.
const r1 = (n: number) => Math.round(n * 10) / 10;
export const circle = (cx: number, cy: number, r: number): Part => ({ d: `M${r1(cx - r)} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0Z`, at: [cx, cy] });
const ellipse = (cx: number, cy: number, rx: number, ry: number): Part => ({ d: `M${r1(cx - rx)} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`, at: [cx, cy] });
const rect = (x: number, y: number, w: number, h: number, r = 0): Part => ({
  d: r ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`,
  at: [x + w / 2, y + h / 2],
});
const poly = (pts: [number, number][], at?: [number, number]): Part => ({
  d: `M${pts.map(p => p.join(' ')).join('L')}Z`,
  at: at ?? [r1(pts.reduce((s, p) => s + p[0], 0) / pts.length), r1(pts.reduce((s, p) => s + p[1], 0) / pts.length)],
});
const path = (d: string, at: [number, number]): Part => ({ d, at });
const star = (cx: number, cy: number, r: number): Part =>
  poly(Array.from({ length: 10 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180; const k = i % 2 ? r * 0.45 : r; return [r1(cx + Math.cos(a) * k), r1(cy + Math.sin(a) * k)] as [number, number]; }), [cx, cy]);
const heart = (cx: number, cy: number, s: number): Part =>
  path(`M${cx} ${r1(cy + s * 0.9)}C${r1(cx - s * 1.4)} ${r1(cy - s * 0.1)} ${r1(cx - s * 0.7)} ${r1(cy - s * 1.1)} ${cx} ${r1(cy - s * 0.35)}C${r1(cx + s * 0.7)} ${r1(cy - s * 1.1)} ${r1(cx + s * 1.4)} ${r1(cy - s * 0.1)} ${cx} ${r1(cy + s * 0.9)}Z`, [cx, cy]);
const ground = rect(0, 88, 100, 12);

export const PAGES: ColoringPage[] = [
  // ABC
  { key: 'apple', name: 'A is for Apple', emoji: '🍎', group: 'abc', caption: 'A a  Apple', parts: [
    path('M50 30 C30 18 12 34 18 56 C24 80 40 88 50 82 C60 88 76 80 82 56 C88 34 70 18 50 30Z', [50, 56]),
    path('M52 28 C58 14 72 12 78 16 C72 26 62 30 52 28Z', [66, 20]),
    rect(47, 14, 5, 16, 2),
    ground,
  ] },
  { key: 'balloons', name: 'B is for Balloons', emoji: '🎈', group: 'abc', caption: 'B b  Balloons', parts: [
    ellipse(30, 32, 13, 16), ellipse(52, 24, 13, 16), ellipse(73, 34, 13, 16),
    poly([[27, 48], [33, 48], [30, 52]]), poly([[49, 40], [55, 40], [52, 44]]), poly([[70, 50], [76, 50], [73, 54]]),
    ground,
  ], lines: ['M30 52 C34 62 46 70 50 86', 'M52 44 C50 60 52 72 50 86', 'M73 54 C68 66 56 74 50 86'] },
  { key: 'cat', name: 'C is for Cat', emoji: '🐱', group: 'abc', caption: 'C c  Cat', parts: [
    ellipse(52, 66, 22, 18),
    circle(40, 38, 16),
    poly([[26, 32], [28, 14], [38, 24]]), poly([[42, 23], [52, 14], [54, 32]]),
    path('M72 70 C88 66 90 46 82 40 C80 50 78 58 70 60Z', [80, 56]),
    circle(34, 36, 3), circle(46, 36, 3),
    ground,
  ], lines: ['M40 42 L40 46 M36 48 Q40 51 44 48', 'M30 44 L18 42 M30 46 L18 48 M50 44 L62 42 M50 46 L62 48'] },
  { key: 'fish', name: 'F is for Fish', emoji: '🐟', group: 'abc', caption: 'F f  Fish', parts: [
    ellipse(46, 50, 26, 17),
    poly([[70, 50], [90, 34], [90, 66]]),
    poly([[40, 34], [52, 20], [58, 36]]),
    circle(32, 46, 4),
    circle(18, 26, 4), circle(12, 16, 3), circle(24, 12, 2.5),
    path('M0 92 Q12 86 25 92 T50 92 T75 92 T100 92 V100 H0Z', [50, 96]),
  ] },
  { key: 'sun', name: 'S is for Sun', emoji: '☀️', group: 'abc', caption: 'S s  Sun', parts: [
    circle(50, 46, 20),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45) * Math.PI / 180; const c = (d: number, w: number) => [r1(50 + Math.cos(a + w) * d), r1(46 + Math.sin(a + w) * d)] as [number, number];
      return poly([c(24, -0.18), c(36, 0), c(24, 0.18)]);
    }),
    ground,
  ], lines: ['M42 42 L44 42 M56 42 L58 42 M42 52 Q50 58 58 52'] },
  { key: 'tree', name: 'T is for Tree', emoji: '🌳', group: 'abc', caption: 'T t  Tree', parts: [
    rect(44, 52, 12, 36, 2),
    circle(36, 40, 16), circle(64, 40, 16), circle(50, 26, 18),
    circle(40, 34, 4), circle(60, 44, 4), circle(54, 22, 4),
    ground,
  ] },
  // Animals
  { key: 'owl', name: 'Owl', emoji: '🦉', group: 'animals', parts: [
    ellipse(50, 56, 26, 30),
    ellipse(50, 66, 15, 17),
    poly([[28, 34], [30, 16], [42, 28]]), poly([[58, 28], [70, 16], [72, 34]]),
    circle(40, 42, 8), circle(60, 42, 8),
    poly([[47, 50], [53, 50], [50, 56]]),
    rect(10, 86, 80, 6, 3),
  ] },
  { key: 'lion', name: 'Lion', emoji: '🦁', group: 'animals', parts: [
    circle(50, 46, 32),
    circle(50, 48, 20),
    circle(34, 28, 6), circle(66, 28, 6),
    ellipse(50, 56, 7, 5),
    circle(43, 44, 3), circle(57, 44, 3),
  ], lines: ['M50 61 L50 64 M44 66 Q50 70 56 66'] },
  { key: 'butterfly', name: 'Butterfly', emoji: '🦋', group: 'animals', parts: [
    ellipse(32, 36, 18, 16), ellipse(68, 36, 18, 16), ellipse(36, 64, 13, 12), ellipse(64, 64, 13, 12),
    ellipse(50, 50, 4, 24),
    circle(30, 36, 5), circle(70, 36, 5),
  ], lines: ['M48 27 Q42 14 36 12 M52 27 Q58 14 64 12'] },
  { key: 'dino', name: 'Dinosaur', emoji: '🦕', group: 'animals', parts: [
    ellipse(46, 62, 24, 15),
    path('M62 56 C70 40 70 26 76 20 C82 16 90 20 88 26 C84 30 78 30 76 36 C74 46 72 56 68 64Z', [74, 40]),
    path('M24 64 C14 66 8 62 4 56 C12 58 18 58 24 56Z', [14, 60]),
    rect(30, 72, 8, 16, 3), rect(52, 72, 8, 16, 3),
    poly([[30, 48], [34, 40], [38, 48]]), poly([[40, 47], [44, 38], [48, 47]]), poly([[50, 48], [54, 40], [58, 49]]),
    ground,
  ], lines: ['M83 22 L84 23'] },
  { key: 'turtle', name: 'Turtle', emoji: '🐢', group: 'animals', parts: [
    path('M18 64 C18 40 34 30 50 30 C66 30 82 40 82 64Z', [50, 50]),
    circle(88, 58, 8),
    rect(24, 64, 10, 12, 4), rect(66, 64, 10, 12, 4),
    poly([[40, 40], [50, 36], [60, 40], [58, 52], [42, 52]]),
    ground,
  ], lines: ['M91 56 L92 56'] },
  // Space
  { key: 'rocket', name: 'Rocket', emoji: '🚀', group: 'space', parts: [
    path('M38 70 L38 34 Q50 4 62 34 L62 70Z', [50, 52]),
    circle(50, 38, 7),
    poly([[38, 52], [26, 74], [38 , 70]]), poly([[62, 52], [74, 74], [62, 70]]),
    poly([[42, 72], [58, 72], [50, 94]]),
    star(16, 18, 7), star(84, 22, 6), star(82, 80, 5), star(14, 74, 5),
  ] },
  { key: 'moon', name: 'Moon & Stars', emoji: '🌙', group: 'space', parts: [
    path('M56 14 C34 18 24 40 32 60 C40 80 64 86 80 76 C60 76 44 60 46 40 C47 28 52 20 56 14Z', [42, 50]),
    star(72, 24, 9), star(82, 50, 6), star(20, 22, 6), star(62, 60, 5), star(22, 84, 7),
  ] },
  { key: 'planet', name: 'Planet', emoji: '🪐', group: 'space', parts: [
    circle(50, 50, 22),
    path('M10 58 C10 46 90 38 90 46 C90 50 80 54 72 56 C74 52 74 50 72 48 C60 50 40 54 28 60 C26 62 26 64 28 66 C16 66 10 62 10 58Z', [20, 60]),
    circle(84, 16, 7),
    star(16, 18, 6), star(80, 84, 6), star(22, 86, 4),
  ] },
  { key: 'astronaut-helmet', name: 'Space Helmet', emoji: '👩‍🚀', group: 'space', parts: [
    circle(50, 44, 28),
    ellipse(50, 44, 18, 14),
    rect(26, 70, 48, 18, 6),
    circle(38, 79, 4), circle(62, 79, 4),
    star(86, 16, 6), star(12, 20, 5),
  ] },
  // Music
  { key: 'drum', name: 'Drum', emoji: '🥁', group: 'music', parts: [
    rect(20, 44, 60, 36, 4),
    ellipse(50, 44, 30, 10),
    poly([[20, 48], [35, 78], [50, 48], [65, 78], [80, 48], [80, 52], [65, 82], [50, 52], [35, 82], [20, 52]], [50, 64]),
    circle(28, 16, 5), circle(76, 14, 5),
    ground,
  ], lines: ['M30 20 L46 38', 'M72 18 L56 38'] },
  { key: 'guitar', name: 'Guitar', emoji: '🎸', group: 'music', parts: [
    path('M42 46 C30 42 22 52 26 62 C18 70 22 88 40 88 C52 88 60 82 60 72 C68 66 66 52 56 50 C52 46 46 46 42 46Z', [36, 72]),
    circle(42, 64, 6),
    rect(54, 14, 8, 40, 2),
    rect(52, 6, 12, 10, 3),
  ], lines: ['M38 80 L46 80', 'M58 18 L58 52'] },
  { key: 'xylophone', name: 'Xylophone', emoji: '🎶', group: 'music', parts: [
    rect(10, 30, 12, 50, 3), rect(25, 34, 12, 42, 3), rect(40, 38, 12, 34, 3), rect(55, 42, 12, 26, 3), rect(70, 46, 12, 18, 3),
    circle(30, 14, 5), circle(66, 12, 5),
  ], lines: ['M8 60 L86 56', 'M33 18 L48 30', 'M63 16 L58 34'] },
  { key: 'trumpet', name: 'Trumpet', emoji: '🎺', group: 'music', parts: [
    rect(16, 44, 46, 10, 3),
    path('M62 49 L88 30 L88 68Z', [78, 49]),
    rect(10, 42, 8, 14, 2),
    rect(28, 30, 5, 14, 1), rect(37, 30, 5, 14, 1), rect(46, 30, 5, 14, 1),
    rect(24, 54, 30, 10, 4),
  ], lines: ['M70 20 Q76 14 80 18 M80 82 Q86 76 90 80'] },
  // Shapes & numbers
  { key: 'shape-friends', name: 'Shape Friends', emoji: '🔷', group: 'shapes', parts: [
    circle(24, 26, 14), rect(58, 12, 28, 28, 3), poly([[24, 50], [38, 80], [10, 80]]), star(72, 64, 18),
  ], lines: ['M19 24 L20 24 M28 24 L29 24 M19 30 Q24 34 29 30', 'M66 24 L67 24 M77 24 L78 24 M67 31 L77 31'] },
  { key: 'kite', name: 'Diamond Kite', emoji: '🪁', group: 'shapes', parts: [
    poly([[50, 8], [76, 36], [50, 70], [24, 36]]),
    poly([[50, 8], [50, 70], [24, 36]], [40, 36]),
    poly([[56, 80], [64, 76], [62, 86]]), poly([[48, 90], [56, 88], [52, 96]]),
  ], lines: ['M50 70 Q60 78 58 82 Q50 86 52 92 Q46 96 44 100', 'M24 36 L76 36'] },
  { key: 'egg-nest', name: 'Oval Eggs', emoji: '🥚', group: 'shapes', parts: [
    ellipse(36, 52, 12, 16), ellipse(64, 52, 12, 16), ellipse(50, 46, 12, 16),
    path('M14 60 Q50 92 86 60 L84 72 Q50 100 16 72Z', [50, 78]),
  ], lines: ['M30 48 L42 48 M58 58 L70 58'] },
  { key: 'clock', name: 'Clock', emoji: '🕒', group: 'shapes', caption: '3 o’clock', parts: [
    circle(50, 52, 34),
    circle(50, 52, 28),
    circle(24, 20, 9), circle(76, 20, 9),
    rect(26, 84, 8, 8, 2), rect(66, 84, 8, 8, 2),
  ], lines: ['M50 52 L50 30', 'M50 52 L66 52', 'M50 26 L50 29 M76 52 L73 52 M50 78 L50 75 M24 52 L27 52'] },
  { key: 'count-ducks', name: 'Count 3 Ducks', emoji: '🦆', group: 'shapes', caption: '1  2  3', parts: [
    ellipse(22, 64, 14, 9), circle(28, 50, 7), poly([[34, 50], [42, 52], [34, 54]]),
    ellipse(52, 64, 14, 9), circle(58, 50, 7), poly([[64, 50], [72, 52], [64, 54]]),
    ellipse(82, 64, 12, 8), circle(87, 51, 6), poly([[92, 51], [99, 53], [92, 55]]),
    path('M0 76 Q12 70 25 76 T50 76 T75 76 T100 76 V100 H0Z', [50, 88]),
  ] },
  // Things that go
  { key: 'car', name: 'Car', emoji: '🚗', group: 'go', parts: [
    rect(10, 50, 80, 22, 6),
    path('M26 50 L34 32 L66 32 L76 50Z', [50, 42]),
    poly([[36, 36], [48, 36], [48, 48], [32, 48]]), poly([[52, 36], [64, 36], [70, 48], [52, 48]]),
    circle(28, 74, 9), circle(72, 74, 9),
    circle(86, 58, 3),
    ground,
  ] },
  { key: 'train', name: 'Train', emoji: '🚂', group: 'go', parts: [
    rect(14, 36, 26, 38, 3),
    rect(40, 50, 44, 24, 6),
    rect(66, 34, 8, 16, 1),
    rect(18, 42, 18, 14, 2),
    circle(24, 78, 8), circle(48, 78, 7), circle(72, 78, 7),
    circle(70, 22, 6), circle(80, 12, 5),
    rect(10, 30, 34, 6, 2),
  ], lines: ['M0 86 L100 86'] },
  { key: 'boat', name: 'Sail Boat', emoji: '⛵', group: 'go', parts: [
    path('M14 64 L86 64 L74 80 L26 80Z', [50, 72]),
    poly([[50, 14], [50, 58], [20, 58]]),
    poly([[54, 22], [54, 58], [78, 58]]),
    circle(84, 18, 9),
    path('M0 86 Q12 80 25 86 T50 86 T75 86 T100 86 V100 H0Z', [50, 94]),
  ], lines: ['M52 12 L52 64'] },
  { key: 'plane', name: 'Airplane', emoji: '✈️', group: 'go', parts: [
    ellipse(50, 50, 38, 9),
    poly([[44, 48], [60, 48], [40, 20], [32, 20]]),
    poly([[44, 52], [60, 52], [40, 80], [32, 80]]),
    poly([[14, 50], [10, 32], [20, 32], [26, 46]]),
    circle(70, 48, 3), circle(78, 48, 3), circle(62, 48, 3),
    ellipse(20, 14, 10, 5), ellipse(82, 84, 10, 5),
  ] },
  // Yummy food
  { key: 'ice-cream', name: 'Ice Cream', emoji: '🍦', group: 'yummy', parts: [
    poly([[32, 52], [68, 52], [50, 94]]),
    circle(40, 44, 13), circle(60, 44, 13), circle(50, 28, 13),
    circle(50, 12, 5),
  ], lines: ['M38 60 L60 74 M62 60 L42 76 M46 84 L54 84'] },
  { key: 'cupcake', name: 'Cupcake', emoji: '🧁', group: 'yummy', parts: [
    poly([[26, 56], [74, 56], [66, 88], [34, 88]]),
    path('M22 58 C16 40 34 34 40 38 C42 26 58 26 60 38 C66 34 84 40 78 58Z', [50, 46]),
    rect(48, 14, 5, 16, 1),
    path('M50 4 C46 10 48 14 50 14 C52 14 54 10 50 4Z', [50, 11]),
  ], lines: ['M40 58 L42 88 M50 58 L50 88 M60 58 L58 88'] },
  { key: 'pizza', name: 'Pizza', emoji: '🍕', group: 'yummy', parts: [
    path('M16 20 Q50 6 84 20 L50 92Z', [50, 44]),
    path('M16 20 Q50 6 84 20 L80 28 Q50 15 20 28Z', [50, 18]),
    circle(40, 36, 6), circle(60, 38, 6), circle(50, 56, 6), circle(48, 74, 4),
  ] },
  { key: 'fruit-bowl', name: 'Fruit Bowl', emoji: '🍇', group: 'yummy', parts: [
    path('M12 56 L88 56 Q84 90 50 90 Q16 90 12 56Z', [50, 72]),
    circle(30, 46, 11), circle(52, 42, 12),
    path('M64 50 C64 30 80 24 86 30 C82 34 76 44 74 54Z', [76, 38]),
    circle(42, 26, 5), circle(50, 24, 5), circle(46, 32, 5),
  ] },
  // Seasons & fun
  { key: 'snowman', name: 'Snowman', emoji: '⛄', group: 'seasons', parts: [
    circle(50, 72, 20), circle(50, 42, 14), rect(38, 14, 24, 16, 2), rect(32, 28, 36, 4, 2),
    poly([[50, 42], [64, 45], [50, 47]]),
    rect(38, 54, 24, 6, 3),
    ground,
  ], lines: ['M44 38 L45 38 M55 38 L56 38', 'M30 64 L16 52 M70 64 L84 52'] },
  { key: 'pumpkin', name: 'Pumpkin', emoji: '🎃', group: 'seasons', parts: [
    ellipse(50, 60, 34, 26),
    ellipse(50, 60, 14, 26),
    rect(46, 24, 8, 12, 2),
    path('M54 30 C64 20 76 22 78 28 C70 28 62 30 56 34Z', [66, 27]),
    ground,
  ] },
  { key: 'present', name: 'Present', emoji: '🎁', group: 'seasons', parts: [
    rect(18, 44, 64, 44, 3),
    rect(14, 34, 72, 12, 3),
    rect(45, 34, 10, 54),
    path('M50 34 C40 16 24 22 30 30 C34 34 44 34 50 34Z', [36, 28]),
    path('M50 34 C60 16 76 22 70 30 C66 34 56 34 50 34Z', [64, 28]),
  ] },
  { key: 'house', name: 'House', emoji: '🏠', group: 'seasons', parts: [
    rect(20, 46, 60, 42),
    poly([[14, 48], [50, 16], [86, 48]]),
    rect(44, 64, 14, 24, 2),
    rect(26, 54, 12, 12, 1), rect(64, 54, 12, 12, 1),
    rect(66, 20, 8, 18),
    circle(14, 14, 8),
    ground,
  ] },
  { key: 'rainbow', name: 'Rainbow', emoji: '🌈', group: 'seasons', parts: [
    path('M8 70 A42 42 0 0 1 92 70 L84 70 A34 34 0 0 0 16 70Z', [50, 32]),
    path('M16 70 A34 34 0 0 1 84 70 L76 70 A26 26 0 0 0 24 70Z', [50, 40]),
    path('M24 70 A26 26 0 0 1 76 70 L68 70 A18 18 0 0 0 32 70Z', [50, 48]),
    path('M32 70 A18 18 0 0 1 68 70 L60 70 A10 10 0 0 0 40 70Z', [50, 56]),
    ellipse(14, 74, 12, 7), ellipse(86, 74, 12, 7),
    circle(84, 16, 8),
  ] },
  { key: 'flowers', name: 'Flower Garden', emoji: '🌷', group: 'seasons', parts: [
    ...[22, 50, 78].flatMap(x => [circle(x, 34, 6), ...[0, 72, 144, 216, 288].map(a => {
      const t = (a - 90) * Math.PI / 180; return circle(r1(x + Math.cos(t) * 10), r1(34 + Math.sin(t) * 10), 6);
    })]),
    path('M0 80 Q25 70 50 80 T100 80 V100 H0Z', [50, 90]),
  ], lines: ['M22 46 L22 76 M50 46 L50 80 M78 46 L78 76', 'M22 62 Q14 56 12 60 M50 64 Q58 58 60 62'] },
  { key: 'heart-card', name: 'Love Card', emoji: '💝', group: 'seasons', parts: [
    rect(12, 12, 76, 76, 6),
    heart(50, 48, 22),
    heart(24, 24, 6), heart(76, 76, 6),
  ] },
  // People & dress-up: detailed chibi characters to colour. Original KidCog art.
  { key: 'hero', name: 'Superhero', emoji: '🦸', group: 'people', parts: [
    poly([[37, 46], [27, 90], [50, 82], [73, 90], [63, 46]]),
    rect(41, 62, 7, 22, 3), rect(52, 62, 7, 22, 3),
    rect(39, 80, 10, 12, 3), rect(51, 80, 10, 12, 3),
    rect(26, 46, 9, 18, 4), rect(65, 46, 9, 18, 4),
    circle(30, 64, 5), circle(70, 64, 5),
    rect(35, 44, 30, 20, 9),
    rect(37, 60, 26, 10, 4),
    rect(35, 58, 30, 5, 2),
    star(50, 52, 6),
    rect(46, 39, 8, 6, 1),
    circle(50, 26, 16),
    path('M34 24 Q50 15 66 24 Q66 31 59 31 Q54 27 50 29 Q46 27 41 31 Q34 31 34 24Z', [50, 25]),
  ], lines: ['M44 25.5 a1.4 1.4 0 1 0 0.1 0', 'M56 25.5 a1.4 1.4 0 1 0 0.1 0', 'M45 34 Q50 38 55 34'] },
  { key: 'princess', name: 'Princess', emoji: '👑', group: 'people', parts: [
    path('M33 20 Q50 5 67 20 Q70 42 61 48 L58 30 Q50 22 42 30 L39 48 Q30 42 33 20Z', [50, 30]),
    poly([[37, 52], [27, 86], [73, 86], [63, 52]]),
    rect(40, 44, 20, 11, 4),
    circle(35, 48, 6), circle(65, 48, 6),
    rect(31, 50, 6, 13, 3), rect(63, 50, 6, 13, 3),
    circle(34, 63, 3.8), circle(66, 63, 3.8),
    ellipse(44, 85, 5, 3), ellipse(56, 85, 5, 3),
    rect(46, 39, 8, 6, 1),
    circle(50, 27, 15),
    poly([[40, 14], [43, 8], [47, 14], [50, 6], [53, 14], [57, 8], [60, 14], [60, 18], [40, 18]], [50, 13]),
  ], lines: ['M45 27 a1.4 1.4 0 1 0 0.1 0', 'M55 27 a1.4 1.4 0 1 0 0.1 0', 'M46 33 Q50 37 54 33', 'M30 80 Q50 74 70 80'] },
  { key: 'astronaut', name: 'Astronaut', emoji: '🚀', group: 'people', parts: [
    rect(33, 43, 34, 24, 6),
    rect(37, 43, 26, 24, 8),
    rect(27, 46, 9, 18, 4), rect(64, 46, 9, 18, 4),
    circle(30, 64, 5), circle(70, 64, 5),
    rect(41, 65, 8, 19, 3), rect(51, 65, 8, 19, 3),
    rect(39, 81, 10, 11, 3), rect(51, 81, 10, 11, 3),
    rect(37, 61, 26, 5, 2),
    circle(50, 52, 5),
    circle(50, 25, 18),
    ellipse(50, 26, 12, 10),
  ], lines: ['M43 21 Q46 19 49 21', 'M62 11 L66 6', 'M66 6 a2 2 0 1 0 0.1 0'] },
  { key: 'robot', name: 'Robot', emoji: '🤖', group: 'people', parts: [
    circle(50, 8, 3),
    rect(35, 13, 30, 25, 5),
    rect(41, 20, 7, 7, 1), rect(52, 20, 7, 7, 1),
    rect(42, 30, 16, 4, 1),
    rect(46, 38, 8, 5, 1),
    rect(32, 43, 36, 26, 6),
    rect(40, 48, 20, 14, 2),
    circle(45, 53, 2.5), circle(55, 53, 2.5),
    rect(24, 45, 8, 18, 3), rect(68, 45, 8, 18, 3),
    rect(22, 61, 11, 8, 2), rect(67, 61, 11, 8, 2),
    rect(40, 69, 8, 15, 2), rect(52, 69, 8, 15, 2),
    rect(37, 82, 12, 8, 2), rect(51, 82, 12, 8, 2),
  ], lines: ['M50 13 L50 11', 'M46 30 L46 34 M50 30 L50 34 M54 30 L54 34', 'M50 59 a4 4 0 1 0 0.1 0'] },
  { key: 'pirate', name: 'Pirate', emoji: '🏴‍☠️', group: 'people', parts: [
    circle(50, 29, 15),
    path('M34 16 Q50 11 66 16 L66 25 Q50 29 34 25Z', [50, 20]),
    poly([[65, 17], [75, 13], [73, 22], [78, 27], [68, 25]], [71, 20]),
    rect(36, 45, 28, 22, 8),
    rect(27, 47, 9, 18, 4), rect(64, 47, 9, 18, 4),
    circle(31, 64, 4.5), circle(69, 64, 4.5),
    rect(41, 65, 8, 18, 3), rect(51, 65, 8, 18, 3),
    rect(38, 81, 11, 11, 3), rect(51, 81, 11, 11, 3),
    rect(36, 58, 28, 5, 2),
    rect(47, 57, 6, 7, 1),
    ellipse(44, 28, 4, 3),
  ], lines: ['M48 25 L58 21', 'M56 29 a1.4 1.4 0 1 0 0.1 0', 'M47 35 Q51 38 55 35', 'M50 45 L50 58', 'M46 19 a1 1 0 1 0 0.1 0', 'M54 19 a1 1 0 1 0 0.1 0'] },
];

/** The crayons: bright, with names a child knows. */
export const CRAYONS = [
  { name: 'red', hex: '#EF4E43' }, { name: 'orange', hex: '#F7943A' }, { name: 'yellow', hex: '#FFD54A' },
  { name: 'green', hex: '#4CB86A' }, { name: 'light blue', hex: '#7FD0F5' }, { name: 'blue', hex: '#3E7EE0' },
  { name: 'purple', hex: '#8D63D8' }, { name: 'pink', hex: '#F57FB6' }, { name: 'brown', hex: '#9B6A43' },
  { name: 'black', hex: '#3A3240' }, { name: 'grey', hex: '#B6B0BE' }, { name: 'white', hex: '#FFFFFF' },
];
