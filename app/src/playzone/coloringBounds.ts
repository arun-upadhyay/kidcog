/**
 * Where each Coloring Book picture actually sits inside its 100 × 100 drawing
 * box: [x, y, width, height], with a little margin. The studio zooms to this
 * box, so pictures fill the screen instead of floating in white space (an
 * upright figure gets a tall canvas on a phone, for example).
 *
 * Made by measuring every part, line and caption in coloringPages.ts.
 * Regenerate after adding or changing a page; a page missing here simply shows
 * its whole 100 × 100 box.
 */
export const PAGE_BOUNDS: Record<string, [number, number, number, number]> = {
  "apple": [0, 0, 100, 100],
  "balloons": [0, 0, 100, 100],
  "cat": [0, 0, 100, 100],
  "fish": [0, 0, 100, 100],
  "sun": [0, 0, 100, 100],
  "tree": [0, 0, 100, 100],
  "owl": [7, 13, 86, 82],
  "lion": [15, 11, 70, 70],
  "butterfly": [11, 9, 78, 70],
  "dino": [0, 13, 100, 87],
  "turtle": [0, 27, 100, 73],
  "rocket": [6.2, 8, 86.5, 89],
  "moon": [11.3, 11, 79.4, 81.7],
  "planet": [7, 6, 87, 86.2],
  "astronaut-helmet": [4.2, 7, 90.5, 84],
  "drum": [0, 6, 100, 94],
  "guitar": [15, 3, 56, 88],
  "xylophone": [5, 4, 84, 79],
  "trumpet": [7, 12.3, 86, 72.7],
  "shape-friends": [7, 9, 85.1, 74],
  "kite": [21, 5, 58, 95],
  "egg-nest": [11, 27, 78, 66.7],
  "clock": [12, 0, 76, 95],
  "count-ducks": [0, 0, 100, 100],
  "car": [0, 29, 100, 71],
  "train": [0, 4, 100, 85],
  "boat": [0, 6, 100, 94],
  "plane": [7, 6, 88, 86],
  "ice-cream": [24, 4, 52, 93],
  "cupcake": [13, 1, 74, 90],
  "pizza": [13, 7.7, 74, 87.3],
  "fruit-bowl": [9, 16, 82, 77],
  "snowman": [0, 11, 100, 89],
  "pumpkin": [0, 17, 100, 83],
  "present": [11, 13, 78, 78],
  "house": [0, 3, 100, 97],
  "rainbow": [0, 5, 100, 79],
  "flowers": [0, 15, 100, 85],
  "heart-card": [9, 9, 82, 82],
  "hero": [22, 7, 56, 88],
  "princess": [24, 3, 52, 88],
  "astronaut": [22, 3, 56, 92],
  "robot": [19, 2, 62, 91],
  "pirate": [23.5, 9.7, 57.5, 85.3],
};
