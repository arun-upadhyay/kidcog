import React from 'react';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import type { DotPicture, Pt } from './dotPictures';

/**
 * Drawing a finished Connect the Dots picture, in the child's own colours.
 *
 * A picture's colourable parts ("regions") are its outline shape (region 0)
 * and then every filled detail (shapes and circles, in order). Lines (a kite's
 * string, whiskers) stay as drawn. A saved colouring is a list of colours, one
 * per region; an empty or short list falls back to the picture's own colours.
 */
export const CRAYONS = ['#E8524F', '#F2994A', '#F4C930', '#6CC08B', '#3FA7D6', '#7B61D1', '#F48AB8', '#8A5A2B', '#FFFFFF', '#3F3126'];

const pts = (list: Pt[]) => list.map(([x, y]) => `${x},${y}`).join(' ');

export function defaultColours(p: DotPicture): string[] {
  return [p.fill, ...(p.extras ?? []).flatMap(e => ('line' in e ? [] : [e.fill]))];
}

export function coloursFor(p: DotPicture, saved?: string[]): string[] {
  const base = defaultColours(p);
  return base.map((c, i) => saved?.[i] ?? c);
}

/** Which region is under a point (grid units), topmost first; -1 for none. */
export function regionAt(p: DotPicture, x: number, y: number): number {
  const fills = (p.extras ?? []).filter(e => !('line' in e));
  for (let i = fills.length - 1; i >= 0; i--) {
    const e = fills[i]!;
    if ('circle' in e) {
      // Small details (eyes) get a bigger target than they look.
      if (Math.hypot(x - e.circle[0], y - e.circle[1]) <= Math.max(e.circle[2] + 1.5, 4)) return i + 1;
    } else if ('shape' in e && inside(e.shape, x, y)) return i + 1;
  }
  return p.closed && inside(p.dots, x, y) ? 0 : -1;
}

function inside(poly: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The finished picture, filled with `colours` (one per region). */
export function PictureArt({ picture, colours, size, highlight = -1 }: { picture: DotPicture; colours?: string[]; size: number; highlight?: number }) {
  const c = coloursFor(picture, colours);
  let region = 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {picture.closed ? <Polygon points={pts(picture.dots)} fill={c[0]} stroke={picture.outline} strokeWidth={highlight === 0 ? 2.6 : 1.8} strokeLinejoin="round" /> : null}
      {(picture.extras ?? []).map((e, i) => {
        if ('line' in e) {
          const [x1, y1, x2, y2] = e.line;
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={e.color} strokeWidth={e.width ?? 1.5} strokeLinecap="round" />;
        }
        region++;
        const fill = c[region];
        const ring = highlight === region ? { stroke: '#2A2118', strokeWidth: 1, strokeDasharray: '2 1.5' } : { stroke: 'rgba(42,33,24,0.35)', strokeWidth: 0.5 };
        return 'circle' in e
          ? <Circle key={i} cx={e.circle[0]} cy={e.circle[1]} r={e.circle[2]} fill={fill} {...ring} />
          : <Polygon key={i} points={pts(e.shape)} fill={fill} strokeLinejoin="round" {...ring} />;
      })}
    </Svg>
  );
}
