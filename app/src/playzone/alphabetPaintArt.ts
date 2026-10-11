import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaintStroke = { points: [number, number][]; color: string; width: number; erase?: boolean; opacity?: number };
export type PaintArt = { fills: string[]; strokes: PaintStroke[] };
export const blankArt = (): PaintArt => ({ fills: [], strokes: [] });
export const paintKey = (childId: string, page: string) => `kidcog.art.v1.${childId}.alphabet.${page}`;
// Order writes and wait for pending saves before reopening the same picture.
const pending = new Map<string, Promise<void>>();
export function savePaint(key: string, art: PaintArt) {
  const previous = pending.get(key) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(art)));
  pending.set(key, write);
  const cleanup = () => { if (pending.get(key) === write) pending.delete(key); };
  void write.then(cleanup, cleanup);
  return write;
}
export async function loadPaint(key: string): Promise<PaintArt> {
  await pending.get(key)?.catch(() => {});
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return blankArt();
  const value = JSON.parse(raw) as PaintArt;
  if (!Array.isArray(value.fills) || !value.fills.every(c => c === null || typeof c === 'string') || !Array.isArray(value.strokes) || !value.strokes.every(s =>
    s && typeof s.color === 'string' && Number.isFinite(s.width) && Array.isArray(s.points) && s.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) {
    throw new Error('This saved picture could not be opened.');
  }
  return value;
}
