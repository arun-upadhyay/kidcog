import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Owl from '../components/Owl';
import type { ChildProgress } from '../progress';
import { colors, column, spacing, GUTTER } from '../theme';
import type { GameKey } from '../playzone/common';
import NumberSnake from '../playzone/NumberSnake';
import BubblePop from '../playzone/BubblePop';
import MazeRunner from '../playzone/MazeRunner';
import TraceDraw from '../playzone/TraceDraw';

/**
 * The Play Zone: four short learning games, kept apart from the thinking
 * activities. Games are brain-breaks, not the main event, so two of them open
 * once a child has done some thinking activities, and the usual "time for a
 * break" reminder still applies (App.tsx).
 */
type GameInfo = { key: GameKey; emoji: string; name: string; blurb: string; background: string; border: string; ink: string; unlockAfter: number };
export const GAMES: GameInfo[] = [
  { key: 'snake', emoji: '🐍', name: 'Number Snake', blurb: 'Eat the numbers in order', background: '#E5F5EA', border: '#63AA7D', ink: '#34734E', unlockAfter: 0 },
  { key: 'bubbles', emoji: '🫧', name: 'Bubble Pop', blurb: 'Pop the bubbles that match', background: '#E5F3FF', border: '#68A8D6', ink: '#2F6F9D', unlockAfter: 0 },
  { key: 'maze', emoji: '🦉', name: 'Maze Runner', blurb: 'Lead Owl to the flag', background: '#EEE9FF', border: '#A68AE2', ink: '#5D439B', unlockAfter: 1 },
  { key: 'trace', emoji: '✏️', name: 'Trace & Draw', blurb: 'Write numbers and letters', background: '#FFE9E3', border: '#E88970', ink: '#A84733', unlockAfter: 3 },
];

/** Thinking activities finished so far (all categories, all visits). */
export const activitiesDone = (progress: ChildProgress | null) =>
  Object.values(progress?.visited ?? {}).reduce((sum, v) => sum + (v?.plays ?? 0), 0);

/** Where a game starts: the level reached last time, or a sensible first level for the child's age. */
export function startLevel(game: GameKey, progress: ChildProgress | null, age: number | undefined) {
  const saved = progress?.arcade?.[game]?.level;
  if (saved) return saved;
  if (game === 'trace') return (age ?? 4) >= 6 ? 3 : 1; // 6 and up start on letters
  return 1;
}

export default function PlayZoneScreen({ childName, age, progress, onBack, onFinish }: {
  childName?: string;
  age?: number;
  progress: ChildProgress | null;
  onBack: () => void;
  /** A game was won: record the stars and the next level. */
  onFinish: (game: GameKey, stars: number, nextLevel: number) => void;
}) {
  const [playing, setPlaying] = useState<GameKey | null>(null);
  const { width } = useWindowDimensions();
  const done = activitiesDone(progress);

  if (playing) {
    const props = {
      level: startLevel(playing, progress, age),
      onBack: () => setPlaying(null),
      onFinish: (stars: number, nextLevel: number) => onFinish(playing, stars, nextLevel),
    };
    return (
      <ScrollView style={styles.gameScroll} contentContainerStyle={styles.gameScreen}>
        {playing === 'snake' ? <NumberSnake {...props} /> : null}
        {playing === 'bubbles' ? <BubblePop {...props} /> : null}
        {playing === 'maze' ? <MazeRunner {...props} /> : null}
        {playing === 'trace' ? <TraceDraw {...props} /> : null}
      </ScrollView>
    );
  }

  const twoColumns = width >= 420;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
        <Text style={styles.backText}>← Activities</Text>
      </Pressable>

      <View style={styles.hero}>
        <Owl mood="happy" size={64} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>🎮 Play Zone</Text>
          <Text style={styles.heroSub}>{childName ? `Pick a game, ${childName}!` : 'Pick a game!'}</Text>
        </View>
        <View style={styles.starPill} accessibilityLabel={`${progress?.stars ?? 0} stars in total`}>
          <Text style={styles.starText}>⭐ {progress?.stars ?? 0}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {GAMES.map(game => {
          const locked = done < game.unlockAfter;
          const score = progress?.arcade?.[game.key];
          const left = game.unlockAfter - done;
          return (
            <View key={game.key} style={[styles.cardWrap, { width: twoColumns ? '50%' : '100%' }]}>
              <Pressable
                onPress={() => !locked && setPlaying(game.key)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={locked ? `${game.name}, locked` : `Play ${game.name}`}
                style={({ pressed }) => [styles.card, { backgroundColor: game.background, borderColor: game.border }, locked && styles.cardLocked, pressed && styles.pressed]}
              >
                <View style={[styles.cardIcon, { borderColor: game.border }]}><Text style={styles.cardEmoji}>{locked ? '🔒' : game.emoji}</Text></View>
                <Text style={[styles.cardName, { color: game.ink }]}>{game.name}</Text>
                <Text style={styles.cardBlurb}>
                  {locked ? `Opens after ${left} more ${left === 1 ? 'activity' : 'activities'}` : game.blurb}
                </Text>
                {!locked ? (
                  <View style={styles.cardMeta}>
                    <Text style={styles.metaPill}>Level {startLevel(game.key, progress, age)}</Text>
                    {score?.stars ? <Text style={styles.metaPill}>⭐ {score.stars}</Text> : null}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        For grown-ups: each game takes a few minutes and has no timers, ads or buying. Stars won here join the child's star total, and Owl suggests a break after a while of play.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: GUTTER, paddingBottom: spacing(6), gap: spacing(2), ...column },
  gameScroll: { flex: 1, backgroundColor: '#FFF8EF' },
  gameScreen: { flexGrow: 1, paddingBottom: spacing(6), backgroundColor: '#FFF8EF', padding: GUTTER, paddingTop: spacing(1.5), ...column },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  back: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  backText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#EEE9FF', borderRadius: 24, padding: spacing(2), borderWidth: 2, borderColor: '#CABAF0' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#4E3590' },
  heroSub: { fontSize: 15, fontWeight: '700', color: '#6A58A0', marginTop: 2 },
  starPill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.75), borderWidth: 2, borderColor: '#F4C966' },
  starText: { fontSize: 16, fontWeight: '900', color: '#8A5A0A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  cardWrap: { padding: spacing(0.75) },
  card: { minHeight: 196, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: spacing(2), gap: spacing(0.75), shadowColor: '#4A3728', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardLocked: { opacity: 0.6 },
  cardIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 40 },
  cardName: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  cardBlurb: { fontSize: 14, fontWeight: '700', color: '#5E5249', textAlign: 'center' },
  cardMeta: { flexDirection: 'row', gap: spacing(0.75), marginTop: 2 },
  metaPill: { fontSize: 12, fontWeight: '900', color: '#6D5A49', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: spacing(1), paddingVertical: 3, overflow: 'hidden' },
  note: { fontSize: 13, lineHeight: 19, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: spacing(1) },
});
