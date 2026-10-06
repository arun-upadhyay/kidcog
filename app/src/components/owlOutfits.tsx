import React, { createContext, useContext } from 'react';
import { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import type { OwlOutfit } from '../progress';

/**
 * Owl's dress-up box. Stars unlock items (they are never spent, so nothing is
 * ever lost), and the child picks one per slot. Drawn in the Owl's own SVG
 * coordinates (viewBox 180 130 664 800): head top ≈ y 260, eyes at
 * (392, 520) and (632, 520), radius 128, the tummy below y 760.
 */
export type OwlSlot = 'hat' | 'eyes' | 'neck';
export interface OwlItem { key: string; slot: OwlSlot; name: string; emoji: string; stars: number }

export const OWL_ITEMS: OwlItem[] = [
  { key: 'flower', slot: 'hat', name: 'Flower', emoji: '🌸', stars: 3 },
  { key: 'party', slot: 'hat', name: 'Party hat', emoji: '🥳', stars: 10 },
  { key: 'cap', slot: 'hat', name: 'Cap', emoji: '🧢', stars: 20 },
  { key: 'crown', slot: 'hat', name: 'Crown', emoji: '👑', stars: 40 },
  { key: 'wizard', slot: 'hat', name: 'Wizard hat', emoji: '🧙', stars: 70 },
  { key: 'specs', slot: 'eyes', name: 'Glasses', emoji: '👓', stars: 6 },
  { key: 'sunnies', slot: 'eyes', name: 'Sunglasses', emoji: '🕶️', stars: 25 },
  { key: 'stars', slot: 'eyes', name: 'Star glasses', emoji: '🤩', stars: 55 },
  { key: 'bow', slot: 'neck', name: 'Bow tie', emoji: '🎀', stars: 1 },
  { key: 'scarf', slot: 'neck', name: 'Scarf', emoji: '🧣', stars: 15 },
  { key: 'medal', slot: 'neck', name: 'Gold medal', emoji: '🏅', stars: 90 },
];

export const OWL_SLOTS: { slot: OwlSlot; title: string }[] = [
  { slot: 'hat', title: 'Hats' }, { slot: 'eyes', title: 'Glasses' }, { slot: 'neck', title: 'Neck' },
];

export const isUnlocked = (item: OwlItem, stars: number) => stars >= item.stars;

/** The next item still to unlock, to give the child something to aim for. */
export function nextUnlock(stars: number): OwlItem | null {
  return OWL_ITEMS.filter(i => i.stars > stars).sort((a, b) => a.stars - b.stars)[0] ?? null;
}

/** What the current child's Owl wears everywhere in the app (none when no child is chosen). */
export const OwlOutfitContext = createContext<OwlOutfit | null>(null);
export const useOwlOutfit = () => useContext(OwlOutfitContext);

/** Items that sit behind the eyes (none yet) vs on top; all of these go on top. */
export function OwlAccessories({ outfit }: { outfit: OwlOutfit }) {
  return (
    <G>
      {outfit.neck ? <Neck item={outfit.neck} /> : null}
      {outfit.eyes ? <Eyes item={outfit.eyes} /> : null}
      {outfit.hat ? <Hat item={outfit.hat} /> : null}
    </G>
  );
}

function Hat({ item }: { item: string }) {
  switch (item) {
    case 'flower':
      return (
        <G>
          {[0, 72, 144, 216, 288].map(a => {
            const r = (a * Math.PI) / 180;
            return <Circle key={a} cx={600 + 34 * Math.cos(r)} cy={262 + 34 * Math.sin(r)} r={28} fill="#F7A8C8" stroke="#E07AA6" strokeWidth={6} />;
          })}
          <Circle cx={600} cy={262} r={22} fill="#F4C930" />
        </G>
      );
    case 'party':
      return (
        <G>
          <Polygon points="436,300 588,300 512,138" fill="#3FA7D6" stroke="#2F6F9D" strokeWidth={10} strokeLinejoin="round" />
          <Path d="M470 228 L554 228 M452 266 L572 266" stroke="#F4C930" strokeWidth={16} strokeLinecap="round" />
          <Circle cx={512} cy={140} r={20} fill="#E8524F" />
        </G>
      );
    case 'cap':
      return (
        <G>
          <Path d="M392 300 Q400 176 512 172 Q624 176 632 300 Z" fill="#E8524F" stroke="#B83A37" strokeWidth={10} />
          <Path d="M600 296 Q700 284 748 308 Q700 326 600 316 Z" fill="#B83A37" />
          <Circle cx={512} cy={176} r={14} fill="#B83A37" />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Polygon points="412,306 412,196 462,246 512,176 562,246 612,196 612,306" fill="#F4C930" stroke="#C99A12" strokeWidth={12} strokeLinejoin="round" />
          <Circle cx={512} cy={262} r={18} fill="#E8524F" />
          <Circle cx={452} cy={276} r={13} fill="#3FA7D6" />
          <Circle cx={572} cy={276} r={13} fill="#6CC08B" />
        </G>
      );
    case 'wizard':
      return (
        <G>
          <Polygon points="404,300 620,300 540,136" fill="#4E3590" stroke="#2F1F66" strokeWidth={10} strokeLinejoin="round" />
          <Ellipse cx={512} cy={302} rx={150} ry={26} fill="#2F1F66" />
          <Path d="M500 214 l10 22 24 2 -18 16 6 24 -22 -13 -22 13 6 -24 -18 -16 24 -2 z" fill="#F4C930" />
          <Circle cx={566} cy={268} r={9} fill="#F4C930" />
        </G>
      );
    default:
      return null;
  }
}

function Eyes({ item }: { item: string }) {
  switch (item) {
    case 'specs':
      return (
        <G>
          <Circle cx={392} cy={520} r={146} fill="none" stroke="#E8524F" strokeWidth={22} />
          <Circle cx={632} cy={520} r={146} fill="none" stroke="#E8524F" strokeWidth={22} />
        </G>
      );
    case 'sunnies':
      return (
        <G>
          <Rect x={250} y={430} width={270} height={180} rx={70} fill="#2A2118" />
          <Rect x={504} y={430} width={270} height={180} rx={70} fill="#2A2118" />
          <Path d="M300 470 l60 -14 M554 470 l60 -14" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={16} strokeLinecap="round" />
        </G>
      );
    case 'stars':
      return (
        <G>
          {[392, 632].map(cx => (
            <Path key={cx} d={starPath(cx, 520, 150, 84)} fill="none" stroke="#F48AB8" strokeWidth={22} strokeLinejoin="round" />
          ))}
        </G>
      );
    default:
      return null;
  }
}

function Neck({ item }: { item: string }) {
  switch (item) {
    case 'bow':
      return (
        <G>
          <Polygon points="512,822 420,780 420,866" fill="#E8524F" stroke="#B83A37" strokeWidth={8} strokeLinejoin="round" />
          <Polygon points="512,822 604,780 604,866" fill="#E8524F" stroke="#B83A37" strokeWidth={8} strokeLinejoin="round" />
          <Circle cx={512} cy={822} r={22} fill="#B83A37" />
        </G>
      );
    case 'scarf':
      return (
        <G>
          <Path d="M300 760 Q512 860 724 760 L716 820 Q512 918 308 820 Z" fill="#3FA7D6" stroke="#2F6F9D" strokeWidth={8} />
          <Path d="M620 830 L650 926 L590 926 L574 846 Z" fill="#3FA7D6" stroke="#2F6F9D" strokeWidth={8} />
          <Path d="M360 806 L380 812 M440 826 L460 830 M540 832 L560 830" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" />
        </G>
      );
    case 'medal':
      return (
        <G>
          <Polygon points="430,760 480,760 524,860 490,872" fill="#3FA7D6" />
          <Polygon points="594,760 544,760 500,860 534,872" fill="#E8524F" />
          <Circle cx={512} cy={880} r={46} fill="#F4C930" stroke="#C99A12" strokeWidth={10} />
          <Path d={starPath(512, 880, 26, 12)} fill="#C99A12" />
        </G>
      );
    default:
      return null;
  }
}

function starPath(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ') + ' Z';
}
