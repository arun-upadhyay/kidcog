import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Owl from '../components/Owl';
import type { ChildProgress } from '../progress';
import { colors, column, spacing, GUTTER } from '../theme';
import { ScrollLockContext, type GameKey } from '../playzone/common';
import NumberSnake from '../playzone/NumberSnake';
import BubblePop from '../playzone/BubblePop';
import MazeRunner from '../playzone/MazeRunner';
import TraceDraw from '../playzone/TraceDraw';
import DotToDot from '../playzone/DotToDot';
import { defaultDotLevel } from '../playzone/dotPictures';
import CollectionShelf from '../playzone/Collections';
import type { OwlOutfit } from '../progress';
import AnimalExplorer from '../playzone/AnimalExplorer';
import { ANIMALS } from '../explore/animals';
import { defaultAnimalLevel } from '../explore/animalQuiz';
import { useAppHeaderScroll } from '../headerScroll';

/**
 * The Play Zone: the Animal Explorer and four short learning games, kept apart from the thinking
 * activities. Games are brain-breaks, not the main event, so two of them open
 * once a child has done some thinking activities, and the usual "time for a
 * break" reminder still applies (App.tsx).
 */
type GameInfo = { key: GameKey; emoji: string; name: string; blurb: string; background: string; border: string; ink: string; unlockAfter: number; isNew?: boolean };
export const GAMES: GameInfo[] = [
  { key: 'animals', emoji: '🦁', name: 'Animal Explorer', blurb: 'Animal quiz, sounds and your own album', background: '#FFF4D6', border: '#F4C966', ink: '#8A5A0A', unlockAfter: 0, isNew: true },
  { key: 'snake', emoji: '🐍', name: 'Number Snake', blurb: 'Eat the numbers in order', background: '#E5F5EA', border: '#63AA7D', ink: '#34734E', unlockAfter: 0 },
  { key: 'bubbles', emoji: '🫧', name: 'Bubble Pop', blurb: 'Pop the bubbles that match', background: '#E5F3FF', border: '#68A8D6', ink: '#2F6F9D', unlockAfter: 0 },
  { key: 'maze', emoji: '🦉', name: 'Maze Runner', blurb: 'Lead Owl to the flag', background: '#EEE9FF', border: '#A68AE2', ink: '#5D439B', unlockAfter: 1 },
  { key: 'trace', emoji: '✏️', name: 'Trace & Draw', blurb: 'Write numbers and letters', background: '#FFE9E3', border: '#E88970', ink: '#A84733', unlockAfter: 3 },
  { key: 'dots', emoji: '🖍️', name: 'Connect the Dots', blurb: 'Join 1, 2, 3… and a picture appears', background: '#E3F1FB', border: '#5B9BD0', ink: '#286A98', unlockAfter: 0, isNew: true },
];

function GameCard({ game, locked, score, level, remaining, albumCount, width, reduceMotion, onPress }: {
  game: GameInfo; locked: boolean; score?: { stars: number; level: number }; level: number; remaining: number; albumCount: number;
  width: '50%' | '100%'; reduceMotion: boolean; onPress: () => void;
}) {
  const motion = useRef(new Animated.Value(0)).current;
  const hovering = useRef(false);
  const [hovered, setHovered] = useState(false);
  const animate = (toValue: number) => {
    if (reduceMotion || locked) { motion.setValue(0); return; }
    Animated.spring(motion, { toValue, damping: 11, stiffness: 240, mass: 0.7, useNativeDriver: true }).start();
  };
  const hoverIn = () => { if (locked) return; hovering.current = true; setHovered(true); animate(1); };
  const hoverOut = () => { hovering.current = false; setHovered(false); animate(0); };
  const left = remaining;
  return (
    <Animated.View style={[styles.cardWrap, { width }, { transform: [
      { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
      { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
    ] }]}>
      <Pressable
        onPress={onPress}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(hovering.current ? 1 : 0)}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={locked ? `${game.name}, locked` : `Play ${game.name}`}
        style={({ pressed }) => [styles.card, { backgroundColor: game.background, borderColor: game.border }, locked && styles.cardLocked, hovered && styles.cardHovered, pressed && styles.pressed]}
      >
        <Animated.View style={[styles.cardIcon, { borderColor: game.border }, { transform: [
          { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] }) },
          { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] }) },
        ] }]}>
          <Text style={styles.cardEmoji}>{locked ? '🔒' : game.emoji}</Text>
        </Animated.View>
        <Text style={[styles.cardName, { color: game.ink }]}>{game.name}</Text>
        <Text style={styles.cardBlurb}>{locked ? `Opens after ${left} more ${left === 1 ? 'activity' : 'activities'}` : game.blurb}</Text>
        {!locked ? <View style={styles.cardMeta}>
          {game.isNew ? <Text style={[styles.metaPill, styles.newPill]}>NEW</Text> : null}
          {game.key === 'animals' ? <Text style={styles.metaPill}>📒 {albumCount}/{ANIMALS.length}</Text> : <Text style={styles.metaPill}>Level {level}</Text>}
          {score?.stars ? <Text style={styles.metaPill}>⭐ {score.stars}</Text> : null}
        </View> : null}
        <Animated.Text accessibilityElementsHidden style={[styles.cardSparkle, { opacity: motion, transform: [{ scale: motion }] }]}>✨</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

/** Thinking activities finished so far (all categories, all visits). */
export const activitiesDone = (progress: ChildProgress | null) =>
  Object.values(progress?.visited ?? {}).reduce((sum, v) => sum + (v?.plays ?? 0), 0);

/** Where a game starts: the level reached last time, or a sensible first level for the child's age. */
export function startLevel(game: GameKey, progress: ChildProgress | null, age: number | undefined) {
  const saved = progress?.arcade?.[game]?.level;
  if (saved) return saved;
  if (game === 'trace') return (age ?? 4) >= 6 ? 3 : 1; // 6 and up start on letters
  if (game === 'animals') return defaultAnimalLevel(age);
  if (game === 'dots') return defaultDotLevel(age);
  return 1;
}

export default function PlayZoneScreen({ childName, age, progress, onBack, onFinish, onAnimalsFound, onPicture, onOutfit, initialGame = null }: {
  childName?: string;
  age?: number;
  progress: ChildProgress | null;
  onBack: () => void;
  /** A game was won: record the stars and the next level. */
  onFinish: (game: GameKey, stars: number, nextLevel: number) => void;
  /** Animal Explorer: animals the child has just met, for their album. */
  onAnimalsFound?: (keys: string[]) => void;
  /** Connect the Dots: a picture was finished or coloured in, for the child's wall. */
  onPicture?: (key: string, colours?: string[]) => void;
  /** Owl's new outfit (Dress up Owl). */
  onOutfit?: (outfit: OwlOutfit) => void;
  /** Open straight into one game (the Animal Explorer banner on the home screen). */
  initialGame?: GameKey | null;
}) {
  const onHeaderScroll = useAppHeaderScroll();
  const [playing, setPlaying] = useState<GameKey | null>(initialGame);
  // Off while a finger is on a game board (see ScrollLockContext).
  const [scrollOn, setScrollOn] = useState(true);
  const lockScroll = useCallback((locked: boolean) => setScrollOn(!locked), []);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { width } = useWindowDimensions();
  const done = activitiesDone(progress);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove();
  }, []);

  if (playing) {
    const props = {
      level: startLevel(playing, progress, age),
      onBack: () => setPlaying(null),
      onFinish: (stars: number, nextLevel: number) => onFinish(playing, stars, nextLevel),
    };
    return (
      <ScrollLockContext.Provider value={lockScroll}>
      <ScrollView style={styles.gameScroll} contentContainerStyle={styles.gameScreen} scrollEnabled={scrollOn} onScroll={onHeaderScroll} scrollEventThrottle={16}>
        {playing === 'animals' ? <AnimalExplorer {...props} found={progress?.animals ?? []} onFound={keys => onAnimalsFound?.(keys)} /> : null}
        {playing === 'snake' ? <NumberSnake {...props} /> : null}
        {playing === 'bubbles' ? <BubblePop {...props} /> : null}
        {playing === 'maze' ? <MazeRunner {...props} /> : null}
        {playing === 'trace' ? <TraceDraw {...props} /> : null}
        {playing === 'dots' ? <DotToDot {...props} wall={progress?.pictures} onPicture={onPicture} /> : null}
      </ScrollView>
      </ScrollLockContext.Provider>
    );
  }

  const twoColumns = width >= 420;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} onScroll={onHeaderScroll} scrollEventThrottle={16}>
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

      <CollectionShelf progress={progress} childName={childName} onOutfit={outfit => onOutfit?.(outfit)} />

      <View style={styles.grid}>
        {GAMES.map(game => {
          const locked = done < game.unlockAfter;
          const score = progress?.arcade?.[game.key];
          return (
            <GameCard
              key={game.key}
              game={game}
              locked={locked}
              score={score}
              level={locked ? 0 : startLevel(game.key, progress, age)}
              remaining={Math.max(0, game.unlockAfter - done)}
              albumCount={progress?.animals?.length ?? 0}
              width={twoColumns ? '50%' : '100%'}
              reduceMotion={reduceMotion}
              onPress={() => !locked && setPlaying(game.key)}
            />
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
  cardHovered: { borderWidth: 3, shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  cardIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 40 },
  cardSparkle: { position: 'absolute', right: 12, bottom: 10, fontSize: 20 },
  cardName: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  cardBlurb: { fontSize: 14, fontWeight: '700', color: '#5E5249', textAlign: 'center' },
  cardMeta: { flexDirection: 'row', gap: spacing(0.75), marginTop: 2 },
  newPill: { color: '#FFFFFF', backgroundColor: '#E8724F' },
  metaPill: { fontSize: 12, fontWeight: '900', color: '#6D5A49', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: spacing(1), paddingVertical: 3, overflow: 'hidden' },
  note: { fontSize: 13, lineHeight: 19, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: spacing(1) },
});
