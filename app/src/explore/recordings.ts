/**
 * Animals with a real recording of their call in assets/animal-sounds/.
 * Kept apart from animalSounds.ts so quiz logic can be tested without loading
 * audio files. Sound activities must only offer animals from this list: a
 * spoken imitation is not an animal sound.
 */
export const RECORDED_CALLS: readonly string[] = [
  'dog', 'cat', 'cow', 'pig', 'sheep', 'horse', 'hen', 'rooster', 'duck',
  'goat', 'mouse', 'lion', 'bear', 'wolf', 'snake', 'frog', 'owl', 'dove',
  'cricket', 'mosquito',
];
