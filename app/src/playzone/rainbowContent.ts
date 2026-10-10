/** Rainbow Letters content: little-letter shapes, shapes, sets and tracing guides (no React here). */
export type Pt = [number, number];
export type Stroke = Pt[];

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Stroke {
  const n = Math.max(6, Math.round(Math.abs(to - from) / 12));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
}
const join = (...parts: Stroke[]): Stroke => parts.flat();

/** Little letters: x-height from 46 to 82, tall letters from 12, tails to 98. */
export const LOWER: Record<string, Stroke[]> = {
  a: [arc(46, 64, 18, 18, 0, -360), [[64, 46], [64, 82]]],
  b: [[[30, 12], [30, 82]], arc(46, 64, 16, 18, 180, -180)],
  c: [arc(52, 64, 18, 18, -40, -320)],
  d: [arc(52, 64, 18, 18, 0, -360), [[70, 12], [70, 82]]],
  e: [join([[33, 64], [67, 64]], arc(50, 64, 17, 18, 0, -300))],
  f: [join(arc(60, 24, 12, 12, -20, -180), [[48, 24], [48, 82]]), [[34, 46], [62, 46]]],
  g: [arc(48, 62, 17, 16, 0, -360), join([[65, 46], [65, 88]], arc(50, 88, 15, 10, 0, 150))],
  h: [[[30, 12], [30, 82]], join(arc(46, 62, 16, 16, 180, 360), [[62, 82]])],
  i: [[[50, 46], [50, 82]], [[50, 28], [50, 31]]],
  j: [join([[55, 46], [55, 88]], arc(43, 88, 12, 10, 0, 160)), [[55, 28], [55, 31]]],
  k: [[[32, 12], [32, 82]], [[66, 44], [32, 68]], [[44, 60], [68, 82]]],
  l: [[[50, 12], [50, 82]]],
  m: [[[22, 46], [22, 82]], join(arc(34, 60, 12, 14, 180, 360), [[46, 82]]), join(arc(58, 60, 12, 14, 180, 360), [[70, 82]])],
  n: [[[30, 46], [30, 82]], join(arc(48, 62, 18, 16, 180, 360), [[66, 82]])],
  o: [arc(50, 64, 18, 18, -90, -450)],
  p: [[[32, 46], [32, 98]], arc(48, 64, 16, 18, 180, -180)],
  q: [arc(50, 64, 16, 18, 0, -360), [[66, 46], [66, 98]]],
  r: [[[34, 46], [34, 82]], arc(50, 60, 16, 14, 180, 300)],
  s: [join(arc(50, 55, 14, 9, -20, -270), arc(50, 73, 15, 9, -90, 160))],
  t: [[[46, 20], [46, 82]], [[32, 46], [62, 46]]],
  u: [join([[32, 46], [32, 66]], arc(48, 66, 16, 16, 180, 0)), [[64, 46], [64, 82]]],
  v: [[[30, 46], [50, 82], [70, 46]]],
  w: [[[18, 46], [32, 82], [50, 54], [68, 82], [82, 46]]],
  x: [[[32, 46], [68, 82]], [[68, 46], [32, 82]]],
  y: [[[32, 46], [50, 82]], [[68, 46], [42, 98]]],
  z: [[[32, 46], [68, 46], [32, 82], [68, 82]]],
};

export const SHAPES: Record<string, Stroke[]> = {
  Circle: [arc(50, 50, 36, 36, -90, 270)],
  Square: [[[18, 18], [82, 18], [82, 82], [18, 82], [18, 18]]],
  Triangle: [[[50, 12], [88, 84], [12, 84], [50, 12]]],
  Star: [Array.from({ length: 11 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180; const r = i % 2 ? 18 : 40; return [50 + Math.cos(a) * r, 52 + Math.sin(a) * r] as Pt; })],
  Heart: [Array.from({ length: 65 }, (_, i) => { const t = i * Math.PI / 32; return [50 + 2.3 * 16 * Math.pow(Math.sin(t), 3), 48 - 2.3 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))] as Pt; })],
  Diamond: [[[50, 10], [86, 50], [50, 90], [14, 50], [50, 10]]],
  Oval: [arc(50, 50, 28, 40, -90, 270)],
  Rectangle: [[[12, 28], [88, 28], [88, 72], [12, 72], [12, 28]]],
};

export const SETS: { key: string; name: string; emoji: string; items: string[] }[] = [
  { key: 'ABC', name: 'Big ABC', emoji: '🔠', items: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { key: 'abc', name: 'Little abc', emoji: '🔡', items: 'abcdefghijklmnopqrstuvwxyz'.split('') },
  { key: '123', name: 'Numbers', emoji: '🔢', items: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
  { key: 'words', name: 'Little words', emoji: '📖', items: ['go', 'big', 'see', 'up', 'look', 'me', 'cat', 'sun', 'dog', 'yes'] },
  { key: 'shapes', name: 'Shapes', emoji: '⭐', items: Object.keys(SHAPES) },
];

/** The guide for any item, fitted into the 100 × 100 board. */
export function guideFor(item: string, GLYPHS: Record<string, Stroke[]> = {}): Stroke[] {
  if (SHAPES[item]) return SHAPES[item]!;
  const chars = [...item];
  const glyph = (c: string) => (/[a-z]/.test(c) ? LOWER[c] : GLYPHS[c]) ?? [];
  if (chars.length === 1) return glyph(chars[0]!);
  // Several characters side by side, each squeezed into its own slot.
  const slot = 100 / chars.length;
  const scale = Math.min(1, slot / 70);
  return chars.flatMap((c, i) => glyph(c).map(stroke => stroke.map(([x, y]) => [i * slot + slot / 2 + (x - 50) * scale, 50 + (y - 50) * scale] as Pt)));
}

/** Points every few units along the guide: what the child's ink has to cover. */
export function checkpoints(strokes: Stroke[]): Pt[] {
  const out: Pt[] = [];
  for (const s of strokes) {
    for (let i = 0; i < s.length; i++) {
      const [x, y] = s[i]!;
      out.push([x, y]);
      const next = s[i + 1];
      if (!next) continue;
      const d = Math.hypot(next[0] - x, next[1] - y);
      for (let k = 4; k < d; k += 4) out.push([x + ((next[0] - x) * k) / d, y + ((next[1] - y) * k) / d]);
    }
  }
  return out;
}

