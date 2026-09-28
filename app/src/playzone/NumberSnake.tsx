import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';
import { DirPad, GameFrame, WinCard, randomInt, shuffle, useArrowKeys, useBoardSize, useSwipe, type Dir } from './common';

/**
 * Number Snake: steer the snake to eat the numbers in order. It grows with each
 * right number. Friendly rules for small children: the walls wrap round, the
 * snake can cross itself, and a wrong number just wiggles away — no game over.
 */
const LEVELS = [
  { name: 'Count to 5', sequence: [1, 2, 3, 4, 5], grid: 8, speed: 460 },
  { name: 'Count to 10', sequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], grid: 9, speed: 410 },
  { name: 'Count to 15', sequence: Array.from({ length: 15 }, (_, i) => i + 1), grid: 10, speed: 370 },
  { name: 'Count by 2s', sequence: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], grid: 10, speed: 340 },
  { name: 'Count by 5s', sequence: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], grid: 11, speed: 310 },
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
  const board = useBoardSize(440);
  const cell = Math.floor((board - BORDER * 2) / cfg.grid);
  const [, render] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const [oops, setOops] = useState<number | null>(null);
  const game = useRef({ snake: [] as Cell[], dir: 'right' as Dir, queued: [] as Dir[], food: [] as Food[], next: 0, grow: 0, mistakes: 0, foodId: 0 });

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
    const others = shuffle(cfg.sequence.filter(v => v !== target && !cfg.sequence.slice(0, g.next).includes(v))).slice(0, 2);
    const decoys = others.length ? others : [target + 1, target + 2];
    const taken: Cell[] = [...g.snake];
    g.food = [target, ...decoys].map(value => { const c = freeCell(taken); taken.push(c); return { ...c, value, id: ++g.foodId }; });
  }, [cfg.sequence, freeCell]);

  const reset = useCallback(() => {
    const mid = Math.floor(cfg.grid / 2);
    game.current = { snake: [{ x: 2, y: mid }, { x: 1, y: mid }, { x: 0, y: mid }], dir: 'right', queued: [], food: [], next: 0, grow: 0, mistakes: 0, foodId: 0 };
    placeFood();
    setWon(null); setRunning(false); render(n => n + 1);
  }, [cfg.grid, placeFood]);
  useEffect(() => { reset(); }, [reset]);

  const turn = useCallback((dir: Dir) => {
    const g = game.current;
    const last = g.queued[g.queued.length - 1] ?? g.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    if (g.queued.length < 2) g.queued.push(dir);
    if (!running && won === null) setRunning(true);
  }, [running, won]);
  useArrowKeys(turn, won === null);
  const swipe = useSwipe(turn);

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
          g.next++; g.grow++;
          playSound('pop');
          if (g.next >= cfg.sequence.length) {
            setRunning(false);
            const stars = g.mistakes === 0 ? 3 : g.mistakes <= 2 ? 2 : 1;
            setWon(stars); playSound('tada');
            onFinish(stars, Math.min(LEVELS.length, level + 1));
          } else placeFood();
        } else {
          g.mistakes++;
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
  return (
    <GameFrame emoji="🐍" title="Number Snake" level={level} onBack={onBack}
      hint={won === null ? (oops !== null ? `Oops, that's ${oops}! Find ${target}.` : `Eat the numbers in order: find ${target ?? ''}`) : ''}>
      <View style={styles.progress}>
        {cfg.sequence.map((v, i) => (
          <Text key={v} style={[styles.chip, i < g.next && styles.chipDone, i === g.next && styles.chipNext]}>{v}</Text>
        ))}
      </View>
      <View {...swipe.panHandlers} style={[styles.board, { width: cell * cfg.grid + BORDER * 2, height: cell * cfg.grid + BORDER * 2 }]} accessibilityLabel={`Snake board. Find number ${target}.`}>
        {g.food.map(f => (
          <View key={f.id} style={[styles.food, { left: f.x * cell + 2, top: f.y * cell + 2, width: cell - 4, height: cell - 4, borderRadius: cell / 2 }, f.value === target ? styles.foodTarget : null]}>
            <Text style={[styles.foodText, { fontSize: Math.max(11, cell * 0.42) }]}>{f.value}</Text>
          </View>
        ))}
        {g.snake.map((s, i) => (
          <View key={i} style={[styles.body, { left: s.x * cell + 1, top: s.y * cell + 1, width: cell - 2, height: cell - 2, borderRadius: i === 0 ? cell / 2.5 : cell / 3.5, backgroundColor: i === 0 ? '#2E8B57' : i % 2 ? '#5CB87A' : '#4CAF6E' }]}>
            {i === 0 ? <Text style={{ fontSize: cell * 0.45 }}>👀</Text> : null}
          </View>
        ))}
        {!running && won === null ? (
          <Pressable style={styles.start} onPress={() => setRunning(true)} accessibilityRole="button">
            <Text style={styles.startText}>{g.next === 0 ? '▶  Tap to start' : '▶  Keep going'}</Text>
            <Text style={styles.startSub}>Swipe or use the arrows to steer</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.controls}>
        <DirPad onDir={turn} disabled={won !== null} />
        {running ? <Pressable onPress={() => setRunning(false)} style={styles.pause} accessibilityRole="button"><Text style={styles.pauseText}>⏸ Pause</Text></Pressable> : null}
      </View>
      {won !== null ? (
        <WinCard stars={won} message={`${cfg.name}: you ate every number in order!`} onExit={onBack} onAgain={reset}
          onNext={level < LEVELS.length ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, maxWidth: 440 },
  chip: { minWidth: 30, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 5, borderRadius: 8, backgroundColor: '#F3EEE7', color: colors.inkSoft, fontWeight: '800', fontSize: 13, overflow: 'hidden' },
  chipDone: { backgroundColor: colors.goSoft, color: colors.accent },
  chipNext: { backgroundColor: '#FFF0C9', color: '#8A5A0A', borderWidth: 2, borderColor: '#F4C966' },
  board: { backgroundColor: '#E9F6EC', borderRadius: 16, borderWidth: BORDER, borderColor: '#A9D7B8', overflow: 'hidden' },
  food: { position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E0CFB5', alignItems: 'center', justifyContent: 'center' },
  foodTarget: { borderColor: '#F4C966', backgroundColor: '#FFF8DF' },
  foodText: { fontWeight: '900', color: '#3F3126' },
  body: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  start: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', gap: spacing(0.5) },
  startText: { fontSize: 24, fontWeight: '900', color: '#2E8B57' },
  startSub: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  controls: { alignItems: 'center', gap: spacing(1) },
  pause: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  pauseText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
