/**
 * A child's stars, stickers and game difficulty, kept on this device.
 *
 * Nothing here is sent anywhere. It lives in AsyncStorage per child, so
 * brothers and sisters each have their own sticker book. (Syncing across a
 * family's devices would mean a small server table; easy to add later.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVATARS } from './avatars';
import type { Report, TraitKey } from './types';
import type { GameKey } from './playzone/common';

export interface ChildProgress {
  stars: number;
  /** Sticker keys (from the avatar library), in the order they were won. */
  stickers: string[];
  /** Game difficulty per category, 1 (just starting) to 5 (confident). */
  levels: Partial<Record<TraitKey, number>>;
  /** Categories this child has played, with stars won in each. */
  visited: Partial<Record<TraitKey, { stars: number; plays: number }>>;
  lastTrait?: TraitKey;
  /** Play Zone games: the level to start at next time and the stars won there. */
  arcade?: Partial<Record<GameKey, { level: number; stars: number; plays: number }>>;
  /** Animal Explorer: keys of the animals this child has met (their album). */
  animals?: string[];
  /** Connect the Dots pictures this child has finished, with the colours they chose (their wall). */
  pictures?: Record<string, string[]>;
  /** What Owl is wearing for this child (see playzone/owlOutfits.ts). */
  owl?: OwlOutfit;
}

/** Owl's dress-up: one item per slot, by key. Unlocked by total stars, never spent. */
export type OwlOutfit = { hat?: string; eyes?: string; neck?: string };

export interface RoundReward {
  stars: number;
  totalStars: number;
  /** A newly won sticker, or null when the book is already full. */
  sticker: string | null;
  /** +1 when the games will get a little harder next time, -1 easier. */
  levelChange: -1 | 0 | 1;
}

const EMPTY: ChildProgress = { stars: 0, stickers: [], levels: {}, visited: {} };
const keyFor = (childId: string) => `kidcog.progress.v1.${childId}`;

/** Same starting point the server uses: age 4 → level 1 … age 8+ → level 5. */
export function defaultLevel(age: number | undefined) {
  if (age === undefined || age <= 4) return 1;
  return Math.min(5, age - 3);
}

export async function loadProgress(childId: string): Promise<ChildProgress> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(childId));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<ChildProgress>) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

async function saveProgress(childId: string, progress: ChildProgress) {
  try { await AsyncStorage.setItem(keyFor(childId), JSON.stringify(progress)); } catch { /* best effort */ }
}

export async function forgetProgress(childId: string) {
  try { await AsyncStorage.removeItem(keyFor(childId)); } catch { /* best effort */ }
}

/**
 * Stars, a sticker and the next difficulty after a finished round.
 *
 * A star for every game solved and for every question answered at all: stars
 * reward having a go, never whether a thinking question was "right".
 * Difficulty moves only on games (which have clear answers): 80%+ right first
 * time → a step harder; a third or less → a step easier.
 */
export async function recordRound(childId: string, trait: TraitKey, report: Report, age: number | undefined): Promise<{ progress: ChildProgress; reward: RoundReward }> {
  const progress = await loadProgress(childId);
  const answered = report.responses.filter(r => !r.skipped);
  const stars = answered.filter(r => r.type !== 'game' || (r.band ?? 0) >= 2).length;

  const games = report.responses.filter(r => r.type === 'game' && !r.skipped);
  const current = progress.levels[trait] ?? defaultLevel(age);
  let levelChange: -1 | 0 | 1 = 0;
  if (games.length >= 2) {
    const firstTime = games.filter(r => r.band === 3).length / games.length;
    if (firstTime >= 0.8 && current < 5) levelChange = 1;
    else if (firstTime <= 0.34 && current > 1) levelChange = -1;
  }

  let sticker: string | null = null;
  if (answered.length > 0) {
    const left = AVATARS.filter(a => !progress.stickers.includes(a.key));
    if (left.length > 0) sticker = left[Math.floor(Math.random() * left.length)]!.key;
  }

  const visit = progress.visited[trait] ?? { stars: 0, plays: 0 };
  const next: ChildProgress = {
    // Keep everything else (Play Zone levels, the animal album) as it was.
    ...progress,
    stars: progress.stars + stars,
    stickers: sticker ? [...progress.stickers, sticker] : progress.stickers,
    levels: { ...progress.levels, [trait]: current + levelChange },
    visited: { ...progress.visited, [trait]: { stars: visit.stars + stars, plays: visit.plays + 1 } },
    lastTrait: trait,
  };
  await saveProgress(childId, next);
  return { progress: next, reward: { stars, totalStars: next.stars, sticker, levelChange } };
}

/**
 * A Play Zone game was won: its stars join the child's total, and the game
 * starts at the next level next time. No sticker (those stay for thinking
 * activities, so the games never become the quickest way to fill the book).
 */
/** Animals the child has just met join their album (kept in the order they were met). */
export async function recordAnimalsFound(childId: string, keys: string[]): Promise<ChildProgress> {
  const progress = await loadProgress(childId);
  const have = progress.animals ?? [];
  const added = keys.filter(k => !have.includes(k));
  if (added.length === 0) return progress;
  const next: ChildProgress = { ...progress, animals: [...have, ...added] };
  await saveProgress(childId, next);
  return next;
}

export async function recordArcade(childId: string, game: GameKey, stars: number, nextLevel: number): Promise<ChildProgress> {
  const progress = await loadProgress(childId);
  const current = progress.arcade?.[game] ?? { level: 1, stars: 0, plays: 0 };
  const next: ChildProgress = {
    ...progress,
    stars: progress.stars + stars,
    arcade: { ...progress.arcade, [game]: { level: Math.max(current.level, nextLevel), stars: current.stars + stars, plays: current.plays + 1 } },
  };
  await saveProgress(childId, next);
  return next;
}

/**
 * A Connect the Dots picture is finished (or re-coloured): it goes on the
 * child's wall. Without `colours`, a picture already on the wall keeps its own.
 */
export async function recordPicture(childId: string, key: string, colours?: string[]): Promise<ChildProgress> {
  const progress = await loadProgress(childId);
  const wall = progress.pictures ?? {};
  if (!colours && wall[key]) return progress;
  const next: ChildProgress = { ...progress, pictures: { ...wall, [key]: colours ?? [] } };
  await saveProgress(childId, next);
  return next;
}

/** Owl's outfit for this child. */
export async function recordOwlOutfit(childId: string, outfit: OwlOutfit): Promise<ChildProgress> {
  const progress = await loadProgress(childId);
  const next: ChildProgress = { ...progress, owl: outfit };
  await saveProgress(childId, next);
  return next;
}
