import { usePauseWhenAway } from './common';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';
import { DirPad, GameSurface, GameStartCard, GameFrame, WinCard, randomInt, shuffle, useArrowKeys, useScrollLock, type Dir, useUsableHeight } from './common';

/**
 * Number Snake: steer the snake to eat the numbers in order. It grows with each
 * right number. Friendly rules for small children: the walls wrap round, the
 * snake can cross itself, and a wrong number just wiggles away — no game over.
 */
const LEVELS = [
  { name: 'Count to 5', sequence: [1, 2, 3, 4, 5], grid: 8, speed: 650 },
  { name: 'Count to 10', sequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], grid: 9, speed: 580 },
  { name: 'Count to 15', sequence: Array.from({ length: 15 }, (_, i) => i + 1), grid: 10, speed: 520 },
  { name: 'Count by 2s', sequence: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], grid: 10, speed: 470 },
  { name: 'Count by 5s', sequence: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], grid: 11, speed: 430 },
];

type Cell = { x: number; y: number };
type Food = Cell & { value: number; id: number };
const STEP: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const BORDER = 3;
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export default function NumberSnake({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(LEVELS.length, Math.max(1, startLevel)));
  const cfg = LEVELS[level - 1]!;
  const [availableWidth, setAvailableWidth] = useState(320);
  const viewportHeight = useUsableHeight();
  // Square cells keep the snake compact and movement equal in both directions.
  const board = Math.floor(Math.min(availableWidth, 460, Math.max(180, viewportHeight - (viewportHeight >= 650 ? 420 : 360))));
  const boardHeight = board;
  const cellWidth = (board - BORDER * 2) / cfg.grid;
  const cellHeight = cellWidth;
  const cell = cellWidth;
  const bodySize = cell * 0.72;
  const [, render] = useState(0);
  const [running, setRunning] = useState(false);
  usePauseWhenAway(() => setRunning(false));
  const [won, setWon] = useState<number | null>(null);
  const [oops, setOops] = useState<number | null>(null);
  const game = useRef({ snake: [] as Cell[], dir: 'right' as Dir, queued: [] as Dir[], food: [] as Food[], next: 0, grow: 0, mistakes: 0, foodId: 0, placedAt: 0, missed: false });

  const freeCell = useCallback((taken: Cell[]): Cell => {
    for (let tries = 0; tries < 200; tries++) {
      const c = { x: randomInt(0, cfg.grid - 1), y: randomInt(0, cfg.grid - 1) };
      if (!taken.some(t => t.x === c.x && t.y === c.y)) return c;
    }
    return { x: 0, y: 0 };
  }, [cfg.grid]);

  /** The next number to eat plus two others, in empty cells. */
  const placeFood = useCallback(() => {
    const g = game.current;
    const target = cfg.sequence[g.next];
    if (target === undefined) { g.food = []; return; }
    g.placedAt = Date.now(); g.missed = false;
    const others = shuffle(cfg.sequence.filter(v => v !== target && !cfg.sequence.slice(0, g.next).includes(v))).slice(0, 2);
    const decoys = others.length ? others : [target + 1, target + 2];
    const taken: Cell[] = [...g.snake];
    g.food = [target, ...decoys].map(value => { const c = freeCell(taken); taken.push(c); return { ...c, value, id: ++g.foodId }; });
  }, [cfg.sequence, freeCell]);

  const reset = useCallback(() => {
    const mid = Math.floor(cfg.grid / 2);
    game.current = { snake: [{ x: 2, y: mid }, { x: 1, y: mid }], dir: 'right', queued: [], food: [], next: 0, grow: 0, mistakes: 0, foodId: 0, placedAt: 0, missed: false };
    placeFood();
    setWon(null); setRunning(false); render(n => n + 1);
  }, [cfg.grid, placeFood]);
  useEffect(() => { reset(); }, [reset]);

  const turn = useCallback((dir: Dir) => {
    const g = game.current;
    const last = g.queued[g.queued.length - 1] ?? g.dir;
    if (won !== null || dir === OPPOSITE[last]) return;
    if (!running) setRunning(true);
    if (dir === last) return;
    if (g.queued.length < 2) g.queued.push(dir);
  }, [running, won]);
  useArrowKeys(turn, won === null);
  // Measure each segment, so a child can turn repeatedly without lifting a finger.
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const lockScroll = useScrollLock();
  const swipe = useMemo(() => {
    let anchorX = 0, anchorY = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { anchorX = 0; anchorY = 0; lockScroll(true); },
      onPanResponderRelease: (event, gesture) => {
        lockScroll(false);
        if (Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) >= 12) return;
        const head = game.current.snake[0];
        if (!head) return;
        const dx = event.nativeEvent.locationX - (head.x + .5) * cellWidth;
        const dy = event.nativeEvent.locationY - (head.y + .5) * cellHeight;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * .5) return;
        turnRef.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      },
      onPanResponderTerminate: () => lockScroll(false),
      onPanResponderMove: (_event, gesture) => {
        const dx = gesture.dx - anchorX, dy = gesture.dy - anchorY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
        turnRef.current(Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        anchorX = gesture.dx; anchorY = gesture.dy;
      },
    });
  }, [lockScroll, cellWidth, cellHeight, cell]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const g = game.current;
      if (g.queued.length) g.dir = g.queued.shift()!;
      const head = g.snake[0]!;
      const step = STEP[g.dir];
      const next = { x: (head.x + step.x + cfg.grid) % cfg.grid, y: (head.y + step.y + cfg.grid) % cfg.grid };
      g.snake = [next, ...g.snake];
      if (g.grow > 0) g.grow--; else g.snake.pop();
      const eaten = g.food.find(f => f.x === next.x && f.y === next.y);
      if (eaten) {
        if (eaten.value === cfg.sequence[g.next]) {
          g.next++; if (g.snake.length < 5) g.grow++;
          playSound('pop');
          if (g.next >= cfg.sequence.length) {
            setRunning(false);
            const stars = g.mistakes === 0 ? 3 : g.mistakes <= 2 ? 2 : 1;
            setWon(stars); playSound('tada');
            onFinish(stars, Math.min(LEVELS.length, level + 1));
          } else placeFood();
        } else {
          g.mistakes++;
          g.missed = true;
          playSound('oops');
          setOops(eaten.value);
          setTimeout(() => setOops(null), 900);
          // The wrong number hops somewhere else.
          const moved = freeCell([...g.snake, ...g.food]);
          g.food = g.food.map(f => (f.id === eaten.id ? { ...f, ...moved } : f));
        }
      }
      render(n => n + 1);
    }, cfg.speed);
    return () => clearInterval(timer);
  }, [running, cfg, level, placeFood, freeCell, onFinish]);

  const g = game.current;
  const target = cfg.sequence[g.next];
  // The right number glows only when it helps: always on level 1, otherwise
  // after a wrong bite or about 8 seconds of searching, so children count.
  const glow = level === 1 || g.missed || (running && Date.now() - g.placedAt > 8000);
  return (
    <GameFrame emoji="🐍" title="Number Snake" level={level} onBack={onBack}
      hint={won === null ? (oops !== null ? `Oops, that's ${oops}! Find ${target}.` : `Eat the numbers in order: find ${target ?? ''}`) : ''}>
      <GameSurface theme="green" eyebrow="THE COUNTING GARDEN" title={`${cfg.name} 🌿`} badgeLabel="FIND NEXT" badge={target ?? '★'} onWidth={setAvailableWidth}>
      <View style={styles.progress}>
        {cfg.sequence.map((v, i) => (
          <Text key={v} style={[styles.chip, i < g.next && styles.chipDone, i === g.next && styles.chipNext]}>{i < g.next ? '✓' : v}</Text>
        ))}
      </View>
      <View style={styles.journey}><View style={[styles.journeyFill, { width: `${g.next / cfg.sequence.length * 100}%` }]} /></View>
      <View testID="snake-board" {...(running ? swipe.panHandlers : {})} style={[styles.board, { width: board, height: boardHeight }, running && Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as object) : null]} accessibilityLabel={`Snake board. Find number ${target}.`}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({ length: cfg.grid * cfg.grid }, (_, i) => <View key={i} style={{ position: 'absolute', left: (i % cfg.grid) * cellWidth, top: Math.floor(i / cfg.grid) * cellHeight, width: cellWidth, height: cellHeight, backgroundColor: (i % cfg.grid + Math.floor(i / cfg.grid)) % 2 ? '#E0F1CF' : '#EBF7DE', borderWidth: 0.5, borderColor: '#D8EBC9' }} />)}
        </View>
        {g.food.map(f => (
          <View pointerEvents="none" key={f.id} style={[styles.food, { left: f.x * cellWidth + (cellWidth - cell) / 2 + 2, top: f.y * cellHeight + (cellHeight - cell) / 2 + 2, width: cell - 4, height: cell - 4, borderRadius: cell / 2 }, f.value === target && glow ? styles.foodTarget : null]}>
            <Text style={[styles.foodText, { fontSize: Math.max(11, cell * 0.42) }]}>{f.value}</Text>
          </View>
        ))}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={board - BORDER * 2} height={boardHeight - BORDER * 2}>
            {g.snake.slice(1).map((tail, i) => {
              const head = g.snake[i]!;
              const x1 = (head.x + .5) * cell, y1 = (head.y + .5) * cell;
              const x2 = (tail.x + .5) * cell, y2 = (tail.y + .5) * cell;
              const edge = cell * cfg.grid;
              // A wrapped pair joins through the two edges, never across the board.
              let d = `M ${x1} ${y1} L ${x2} ${y2}`;
              if (Math.abs(head.x - tail.x) > 1) {
                d = `M ${x1} ${y1} L ${head.x === 0 ? -cell : edge + cell} ${y1} M ${x2} ${y2} L ${tail.x === 0 ? -cell : edge + cell} ${y2}`;
              } else if (Math.abs(head.y - tail.y) > 1) {
                d = `M ${x1} ${y1} L ${x1} ${head.y === 0 ? -cell : edge + cell} M ${x2} ${y2} L ${x2} ${tail.y === 0 ? -cell : edge + cell}`;
              }
              return <Path key={i} d={d} fill="none" stroke="#43B883" strokeWidth={bodySize} strokeLinecap="round" strokeLinejoin="round" />;
            })}
          </Svg>
        </View>
        {g.snake.map((s, i) => (
          <View pointerEvents="none" testID={i === 0 ? "snake-head" : "snake-segment"} key={i} style={[styles.body, { left: s.x * cellWidth + (cell - bodySize) / 2, top: s.y * cellHeight + (cell - bodySize) / 2, width: bodySize, height: bodySize, borderRadius: bodySize / 2, backgroundColor: i === 0 ? '#147C60' : '#43B883' }]}>
            {i === 0 ? <Text style={{ fontSize: cell * 0.45 }}>👀</Text> : null}
          </View>
        ))}
        {!running && won === null ? (
          <GameStartCard emoji="🐍" title="Ready, little explorer?" hint="Tap ahead of Snake or swipe to turn. Find the next number!" onStart={() => setRunning(true)} resume={g.next > 0} />
        ) : null}
      </View>
      {viewportHeight >= 650 && <Text style={styles.tip}>🌼 {g.next} / {cfg.sequence.length} collected · Friendly walls: pop out the other side!</Text>}
      {viewportHeight >= 650 && <Text style={styles.startSub}>Tap ahead or swipe to steer</Text>}
      <View style={styles.controls}>
        <DirPad optional onDir={turn} disabled={won !== null} />
        {running ? <Pressable onPress={() => setRunning(false)} style={styles.pause} accessibilityRole="button"><Text style={styles.pauseText}>⏸ Pause</Text></Pressable> : null}
      </View>
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={`${cfg.name}: you ate every number in order!`} onExit={onBack} onAgain={reset}
          onNext={level < LEVELS.length ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  adventure: { width: '100%', maxWidth: 760, alignItems: 'center', gap: 12, backgroundColor: '#F2F7EC', borderRadius: 28 },
  mission: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#4E7860' },
  missionTitle: { fontSize: 23, fontWeight: '900', color: '#235E46', marginTop: 5 },
  targetBadge: { backgroundColor: '#FFF1BD', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: '#F3D273' },
  targetLabel: { fontSize: 9, fontWeight: '900', color: '#805218', letterSpacing: 1 },
  targetNumber: { fontSize: 28, fontWeight: '900', color: '#805218' },
  journey: { width: '90%', height: 8, borderRadius: 4, backgroundColor: '#D9E7CF', overflow: 'hidden' },
  journeyFill: { height: '100%', backgroundColor: '#53AE77', borderRadius: 4 },
  startCard: { width: '86%', maxWidth: 330, backgroundColor: '#FFFCF3', borderRadius: 26, borderWidth: 2, borderColor: '#FFFFFF', padding: 18, gap: 12, alignItems: 'center', shadowColor: '#315B35', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  mascot: { fontSize: 42 },
  startTitle: { fontSize: 20, fontWeight: '900', color: '#285E45', textAlign: 'center' },
  tip: { fontSize: 12, lineHeight: 18, color: '#47684B', textAlign: 'center', paddingHorizontal: 16 },
  progress: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, paddingHorizontal: 12 },
  chip: { minWidth: 30, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 5, borderRadius: 8, backgroundColor: '#FFFFFF', color: colors.inkSoft, fontWeight: '800', fontSize: 13, overflow: 'hidden' },
  chipDone: { backgroundColor: colors.goSoft, color: colors.accent },
  chipNext: { backgroundColor: '#FFF0C9', color: '#8A5A0A', borderWidth: 2, borderColor: '#F4C966' },
  board: { backgroundColor: '#EBF7DE', alignSelf: 'center', borderRadius: 24, borderWidth: BORDER, borderColor: '#75B78D', overflow: 'hidden' },
  food: { position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E0CFB5', alignItems: 'center', justifyContent: 'center' },
  foodTarget: { borderColor: '#ECA829', backgroundColor: '#FFE798' },
  foodText: { fontWeight: '900', color: '#3F3126' },
  body: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  start: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(224,243,210,0.35)', alignItems: 'center', justifyContent: 'center', gap: spacing(0.5) },
  startText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', backgroundColor: '#7650C7', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 18, overflow: 'hidden' },
  startSub: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing(1), paddingBottom: 8 },
  pause: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  pauseText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
