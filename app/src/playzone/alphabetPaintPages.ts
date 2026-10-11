import { PAGES, type ColoringPage } from './coloringPages';

export type PaintPage = { key: string; name: string; emoji: string; letter: string; width: number; height: number; legacy?: ColoringPage; parts?: { name: string; d: string }[]; lines?: string[] };
const umbrella: ColoringPage = { key: 'umbrella', name: 'U is for Umbrella', emoji: '☂️', group: 'abc', parts: [
  { d: 'M15 49 Q50 -4 85 49 Q72 39 62 49 Q50 39 38 49 Q27 39 15 49Z', at: [50,30] },
  { d: 'M38 49 Q39 19 50 15 Q61 19 62 49 Q50 39 38 49Z', at: [50,35] },
  { d: 'M48 46 H52 V79 C52 98 27 97 27 80 H32 C32 91 48 91 48 79Z', at: [50,65] },
  ...[18,72,87].map((x,i)=>({d:`M${x} ${60+i*4} q-13 17 0 18 q13 -1 0 -18Z`,at:[x,70+i*4] as [number,number]})),
] };


/** Original line art: every closed region is a separate paint-bucket target. */
export const RAINY_UNICORN: PaintPage = {
  key: 'rainy-unicorn', name: 'Unicorn & Umbrella', emoji: '🦄', letter: 'U', width: 120, height: 90,
  parts: [
    { name: 'letter U', d: 'M9 10 Q9 7 12 7 Q15 7 15 10 V24 Q15 31 22 31 Q29 31 29 24 V10 Q29 7 32 7 Q35 7 35 10 V24 Q35 38 22 38 Q9 38 9 24Z' },
    { name: 'cloud', d: 'M42 13 C39 9 44 5 48 7 C50 1 60 3 60 8 C68 5 72 14 66 17 H45 Q40 17 42 13Z' },
    { name: 'puddle', d: 'M13 80 C5 76 12 71 24 73 C37 69 66 72 66 78 C68 84 40 85 32 82 C22 85 14 84 13 80Z' },
    { name: 'tail', d: 'M24 56 C10 52 19 43 13 41 C3 38 3 56 13 59 C7 65 10 72 19 71 C13 65 24 64 26 61Z' },
    { name: 'back legs', d: 'M28 65 L28 76 Q28 80 32 80 Q36 80 36 76 L37 66 M44 63 L45 76 Q45 80 49 80 Q53 80 53 76 L52 62Z' },
    { name: 'body', d: 'M25 51 C19 54 20 63 25 67 L24 76 Q24 80 28 80 Q32 80 32 76 L33 69 Q39 72 46 68 L47 77 Q48 81 52 80 Q56 79 55 75 L53 62 C57 58 58 54 57 49 L62 48 Q69 48 67 41 L62 33 Q57 25 51 30 Q46 34 46 42 L44 49 Q36 47 30 49Z' },
    { name: 'mane', d: 'M53 30 C42 27 45 35 39 36 Q43 39 46 37 Q44 43 39 43 Q41 47 45 46 Q43 51 38 52 Q44 57 49 51 L51 40 Q49 36 56 33Z' },
    { name: 'ear', d: 'M54 32 Q49 23 52 21 Q59 25 59 33Z' },
    { name: 'horn', d: 'M60 34 L67 20 L66 38Z' },
    { name: 'muzzle', d: 'M59 43 Q63 40 67 43 Q73 51 66 54 Q61 55 57 50 Q55 47 59 43Z' },
    { name: 'cheek', d: 'M54 44 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0Z' },
    { name: 'heart', d: 'M35 57 C30 51 26 57 30 60 L35 64 L40 60 C44 55 38 52 35 57Z' },
    { name: 'front hoof', d: 'M47 74 L55 74 L55 77 Q54 81 50 80 Q47 80 47 77Z' },
    { name: 'back hoof', d: 'M24 74 H32 V77 Q32 81 28 80 Q24 80 24 77Z' },
    { name: 'umbrella handle', d: 'M83 37 H86 V71 C86 85 70 85 70 74 Q70 71 73 72 Q75 72 75 75 C75 79 82 79 83 71Z' },
    { name: 'left umbrella panel', d: 'M62 37 Q66 18 84 17 Q75 25 75 39 Q68 33 62 37Z' },
    { name: 'middle umbrella panel', d: 'M75 39 Q75 24 84 17 Q95 24 96 39 Q85 33 75 39Z' },
    { name: 'right umbrella panel', d: 'M96 39 Q95 24 84 17 Q104 17 112 37 Q104 33 96 39Z' },
    ...[[76,7],[105,10],[96,51],[109,58],[87,60],[42,22]].map(([x,y],i)=>({name: `raindrop ${i+1}`, d: `M${x} ${y} c-2 4 -6 7 -3 10 c2 3 7 1 6 -2 c0 -3 -2 -6 -3 -8Z`})),
    { name: 'flower stem', d: 'M104 74 H106 V83 H104Z' },
    { name: 'flower leaf', d: 'M104 80 Q95 80 98 76 Q102 75 104 80Z' },
    { name: 'flower petals', d: 'M102 69 C97 60 109 60 108 68 C117 64 119 76 110 75 C115 84 103 87 103 77 C95 83 91 70 102 69Z' },
    { name: 'flower middle', d: 'M102 73 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0Z' },
  ],
  lines: [
    'M57 38 Q60 35 62 38 M58 39 Q59 42 61 39 M63 47 l.2 .2 M66 48 l.2 .2',
    'M60 33 L66 34 M62 29 L66 30 M64 25 L67 26',
    'M14 46 Q9 53 17 56 Q23 59 16 65 M46 33 Q49 32 51 32 M45 41 L49 39',
    'M84 17 V14 M16 78 Q19 76 22 78 M58 79 H62',
  ],
};
export const PAINT_PAGES: PaintPage[] = [RAINY_UNICORN, ...[...PAGES.filter(p => p.group === 'abc'), umbrella].map(p => ({key:p.key,name:p.name,emoji:p.emoji,letter:p.name[0]!,width:100,height:100,legacy:p}))];
