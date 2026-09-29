import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';
import { GameSurface, GameStartCard, GameFrame, WinCard, useNative } from './common';

/**
 * Trace & Draw: follow the dotted guide with a finger (or the mouse) to write
 * numbers and letters. The green dot shows where to go next; the ink turns
 * colourful as each part is traced. Generous hit area, no timer, no mistakes —
 * just "Skip" if a child has had enough of one.
 */
type Pt = [number, number];
type Stroke = Pt[];

/** Points round an ellipse, in the 0–100 box (y points down). Angles in degrees; from > to goes anticlockwise. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Stroke {
  const n = Math.max(6, Math.round(Math.abs(to - from) / 12));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
}
const join = (...parts: Stroke[]): Stroke => parts.flat();

/** How to write each character, stroke by stroke, in the order children are taught. */
export const GLYPHS: Record<string, Stroke[]> = {
  '0': [arc(50, 50, 28, 40, -90, -450)],
  '1': [[[34, 26], [50, 10], [50, 90]]],
  '2': [join(arc(50, 32, 25, 22, 195, 390), [[24, 90], [78, 90]])],
  '3': [join(arc(48, 30, 25, 20, 200, 450), arc(48, 70, 27, 20, 270, 520))],
  '4': [[[56, 10], [22, 64], [80, 64]], [[62, 32], [62, 90]]],
  '5': [join([[72, 10], [30, 10], [27, 47]], arc(48, 65, 27, 25, 215, 520))],
  '6': [join(arc(50, 50, 28, 40, -55, -180), arc(50, 68, 28, 22, 180, -180))],
  '7': [[[22, 10], [78, 10], [40, 90]]],
  '8': [join(arc(50, 30, 22, 20, 270, 90), arc(50, 70, 26, 20, 270, 630), arc(50, 30, 22, 20, 90, -90))],
  '9': [join(arc(50, 32, 26, 22, 0, -360), [[72, 90]])],
  A: [[[20, 90], [50, 10], [80, 90]], [[33, 60], [67, 60]]],
  B: [[[25, 10], [25, 90]], join([[25, 10], [55, 10]], arc(55, 30, 20, 20, -90, 90), [[25, 50]]), join([[25, 50], [57, 50]], arc(57, 70, 20, 20, -90, 90), [[25, 90]])],
  C: [arc(55, 50, 32, 40, -40, -320)],
  D: [[[25, 10], [25, 90]], join([[25, 10], [43, 10]], arc(43, 50, 34, 40, -90, 90), [[25, 90]])],
  E: [[[75, 10], [25, 10], [25, 90], [75, 90]], [[25, 50], [65, 50]]],
  F: [[[75, 10], [25, 10], [25, 90]], [[25, 50], [65, 50]]],
  G: [join(arc(52, 50, 30, 40, -40, -360), [[60, 50]])],
  H: [[[25, 10], [25, 90]], [[75, 10], [75, 90]], [[25, 50], [75, 50]]],
  I: [[[50, 10], [50, 90]], [[32, 10], [68, 10]], [[32, 90], [68, 90]]],
  J: [join([[70, 10], [70, 68]], arc(48, 68, 22, 22, 0, 180))],
  K: [[[25, 10], [25, 90]], [[75, 10], [25, 56]], [[42, 42], [76, 90]]],
  L: [[[25, 10], [25, 90], [75, 90]]],
  M: [[[20, 90], [22, 10], [50, 60], [78, 10], [80, 90]]],
  N: [[[25, 90], [25, 10], [75, 90], [75, 10]]],
  O: [arc(50, 50, 30, 40, -90, -450)],
  P: [[[25, 10], [25, 90]], join([[25, 10], [52, 10]], arc(52, 30, 22, 20, -90, 90), [[25, 50]])],
  Q: [arc(50, 50, 30, 40, -90, -450), [[58, 70], [82, 94]]],
  R: [[[25, 10], [25, 90]], join([[25, 10], [52, 10]], arc(52, 30, 22, 20, -90, 90), [[25, 50]]), [[44, 50], [76, 90]]],
  S: [join(arc(50, 30, 24, 20, -20, -270), arc(50, 70, 26, 20, -90, 160))],
  T: [[[20, 10], [80, 10]], [[50, 10], [50, 90]]],
  U: [join([[25, 10], [25, 62]], arc(50, 62, 25, 28, 180, 0), [[75, 10]])],
  V: [[[20, 10], [50, 90], [80, 10]]],
  W: [[[14, 10], [30, 90], [50, 36], [70, 90], [86, 10]]],
  X: [[[22, 10], [78, 90]], [[78, 10], [22, 90]]],
  Y: [[[22, 10], [50, 50], [50, 90]], [[78, 10], [50, 50]]],
  Z: [[[22, 10], [78, 10], [22, 90], [78, 90]]],
};

export const TRACE_LEVELS = [
  { name: 'Numbers 1 to 5', chars: ['1', '2', '3', '4', '5'] },
  { name: 'Numbers 6 to 0', chars: ['6', '7', '8', '9', '0'] },
  { name: 'Letters A to I', chars: 'ABCDEFGHI'.split('') },
  { name: 'Letters J to R', chars: 'JKLMNOPQR'.split('') },
  { name: 'Letters S to Z', chars: 'STUVWXYZ'.split('') },
];

const SPACING = 7; // one checkpoint every 7 units along the guide
const HIT = 12; // how close (in units) a finger has to come to a checkpoint
const INK = ['#E8724F', '#4A8FC4', '#3F9A6E', '#9B7EDE', '#E0AA2F'];

/** Evenly spaced checkpoints along a stroke, first and last point included. */
export function resample(stroke: Stroke): Pt[] {
  const out: Pt[] = [stroke[0]!];
  let carry = 0;
  for (let i = 1; i < stroke.length; i++) {
    const [ax, ay] = stroke[i - 1]!, [bx, by] = stroke[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    let d = SPACING - carry;
    while (d <= len) { out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]); d += SPACING; }
    carry = len - (d - SPACING);
  }
  const last = stroke[stroke.length - 1]!;
  const end = out[out.length - 1]!;
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 2) out.push(last);
  return out;
}

const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export default function TraceDraw({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(TRACE_LEVELS.length, Math.max(1, startLevel)));
  const cfg = TRACE_LEVELS[level - 1]!;
  const [size, setBoardWidth] = useState(320);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [won, setWon] = useState<number | null>(null);
  const char = cfg.chars[index]!;
  const checkpoints = useMemo(() => GLYPHS[char]!.map(resample), [char]);

  // Where the child has got to: which stroke, and how many of its checkpoints.
  const [stroke, setStroke] = useState(0);
  const [done, setDone] = useState(0);
  const [ink, setInk] = useState<Pt[][]>([]);
  const [glyphDone, setGlyphDone] = useState(false);
  const cheer = useRef(new Animated.Value(0)).current;
  const live = useRef({ stroke: 0, done: 0, finished: false });

  const resetGlyph = useCallback(() => {
    live.current = { stroke: 0, done: 0, finished: false };
    setStroke(0); setDone(0); setInk([]); setGlyphDone(false); cheer.setValue(0);
  }, [cheer]);
  useEffect(() => { resetGlyph(); }, [char, resetGlyph]);
  useEffect(() => { setIndex(0); setSkipped(0); setWon(null); }, [level]);

  const nextGlyph = useCallback((wasSkipped: boolean) => {
    const skippedNow = skipped + (wasSkipped ? 1 : 0);
    if (wasSkipped) setSkipped(skippedNow);
    if (index + 1 < cfg.chars.length) { setIndex(index + 1); return; }
    const stars = skippedNow === 0 ? 3 : skippedNow <= 2 ? 2 : 1;
    setWon(stars); playSound('tada');
    onFinish(stars, Math.min(TRACE_LEVELS.length, level + 1));
  }, [skipped, index, cfg.chars.length, level, onFinish]);

  const finishGlyph = useCallback(() => {
    setGlyphDone(true); playSound('yay');
    Animated.sequence([
      Animated.spring(cheer, { toValue: 1, friction: 4, useNativeDriver: useNative }),
      Animated.delay(700),
    ]).start(() => nextGlyph(false));
  }, [cheer, nextGlyph]);

  /** Moves the progress on when the finger is near the next checkpoint (or one or two further on). */
  const touch = useCallback((x: number, y: number) => {
    const s = live.current;
    if (s.finished) return;
    const cps = checkpoints[s.stroke];
    if (!cps) return;
    let moved = false;
    for (let j = s.done; j < Math.min(s.done + 3, cps.length); j++) {
      const [cx, cy] = cps[j]!;
      if (Math.hypot(cx - x, cy - y) <= HIT) { s.done = j + 1; moved = true; }
    }
    if (!moved) return;
    if (s.done >= cps.length) {
      if (s.stroke + 1 < checkpoints.length) { s.stroke++; s.done = 0; playSound('pop'); }
      else { s.finished = true; finishGlyph(); }
    }
    setStroke(s.stroke); setDone(s.done);
  }, [checkpoints, finishGlyph]);

  const toUnits = useCallback((lx: number, ly: number): Pt => [(lx / size) * 100, (ly / size) * 100], [size]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setInk(list => [...list, [p]]);
      touch(p[0], p[1]);
    },
    onPanResponderMove: e => {
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setInk(list => {
        const copy = list.slice();
        const last = copy[copy.length - 1] ?? [];
        copy[copy.length - 1] = [...last, p];
        return copy;
      });
      touch(p[0], p[1]);
    },
  }), [toUnits, touch]);

  const next = checkpoints[stroke]?.[done];
  const color = INK[index % INK.length]!;
  const scale = cheer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <GameFrame emoji="✏️" title="Trace & Draw" level={level} onBack={onBack}
      hint={won === null ? (glyphDone ? `Beautiful ${char}! ✨` : `Trace the ${/\d/.test(char) ? 'number' : 'letter'} ${char}. Start at the green dot.`) : ''}>
      <GameSurface theme="coral" eyebrow="THE CREATIVE CORNER" title={cfg.name} badgeLabel="TRACE" badge={char} onWidth={setBoardWidth}>
      <View style={styles.row}>
        {cfg.chars.map((c, i) => (
          <Text key={c} style={[styles.chip, i < index && styles.chipDone, i === index && styles.chipNext]}>{c}</Text>
        ))}
      </View>
      <Animated.View style={[styles.canvas, { width: size, height: size, transform: [{ scale }] }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            {/* The faint letter shape, then its dotted middle line. */}
            {GLYPHS[char]!.map((s, i) => <Polyline key={`g${i}`} points={pts(s)} fill="none" stroke="#EFE6DA" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />)}
            {checkpoints.map((cps, i) => cps.map(([x, y], j) => (
              <Circle key={`d${i}-${j}`} cx={x} cy={y} r={1.3} fill={i < stroke || (i === stroke && j < done) ? color : '#C9B8A3'} />
            )))}
            {/* What's been traced so far, in colour. */}
            {checkpoints.map((cps, i) => {
              const upto = i < stroke ? cps.length : i === stroke ? done : 0;
              return upto > 1 ? <Polyline key={`t${i}`} points={pts(cps.slice(0, upto))} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" /> : null;
            })}
            {/* The child's own finger trail. */}
            {ink.map((line, i) => line.length > 1
              ? <Polyline key={`i${i}`} points={pts(line)} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              : null)}
            {next && !glyphDone ? <Circle cx={next[0]} cy={next[1]} r={5} fill="#3F9A6E" stroke="#FFFFFF" strokeWidth={1.5} /> : null}
          </Svg>
        </View>
        {/* An empty layer on top takes the touches, so finger positions are measured from the canvas corner. */}
        <View style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'crosshair' } as object) : null]} {...responder.panHandlers}
          accessibilityLabel={`Tracing area for ${char}`} />
      </Animated.View>
      <View style={styles.actions}>
        <Pressable onPress={resetGlyph} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>↺ Start again</Text></Pressable>
        <Pressable onPress={() => nextGlyph(true)} disabled={glyphDone} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Skip ▶</Text></Pressable>
      </View>
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={`${cfg.name}: all traced!`} onExit={onBack}
          onAgain={() => { setIndex(0); setSkipped(0); setWon(null); resetGlyph(); }}
          onNext={level < TRACE_LEVELS.length ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { minWidth: 32, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#F3EEE7', color: colors.inkSoft, fontWeight: '900', fontSize: 15, overflow: 'hidden' },
  chipDone: { backgroundColor: colors.goSoft, color: colors.accent },
  chipNext: { backgroundColor: '#FFF0C9', color: '#8A5A0A', borderWidth: 2, borderColor: '#F4C966' },
  canvas: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 3, borderColor: '#F0D9BE' },
  actions: { flexDirection: 'row', gap: spacing(2) },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(2), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  actionText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
