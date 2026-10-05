import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { playSound } from '../games/sounds';
import { stopSpeaking } from '../speech';
import { colors, spacing } from '../theme';
import { GameFrame, GameSurface, WinCard, useNative, useScrollLock } from './common';
import { DOT_LEVELS, DOT_PICTURES, dotLabel, type Extra, type Pt } from './dotPictures';

/**
 * Connect the Dots: tap 1, 2, 3… (or slide a finger from dot to dot) and a
 * picture appears. When the last dot joins up, the picture fills with colour,
 * its details pop in, and the hint names it (read aloud only when the child
 * taps the hint's 🔊).
 *
 * Gentle by design: a wrong dot just wiggles and the next dot glows, there is
 * no timer, and the youngest level always shows which dot comes next.
 */
const HIT = 9; // grid units (of 100) a tap can land from a dot's centre
const pts = (list: Pt[]) => list.map(([x, y]) => `${x},${y}`).join(' ');
// The app's sans-serif on the web too (SVG text otherwise falls back to a serif font there).
const LABEL_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' : undefined;

function ExtraShape({ extra }: { extra: Extra }) {
  if ('circle' in extra) return <Circle cx={extra.circle[0]} cy={extra.circle[1]} r={extra.circle[2]} fill={extra.fill} />;
  if ('line' in extra) {
    const [x1, y1, x2, y2] = extra.line;
    return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={extra.color} strokeWidth={extra.width ?? 1.5} strokeLinecap="round" />;
  }
  return <Polygon points={pts(extra.shape)} fill={extra.fill} />;
}

/** Where a dot's label goes: just outside the picture, away from its middle. */
function labelSpot(dot: Pt, centre: Pt): Pt {
  const dx = dot[0] - centre[0], dy = dot[1] - centre[1];
  const len = Math.hypot(dx, dy) || 1;
  const x = dot[0] + (dx / len) * 6.5, y = dot[1] + (dy / len) * 6.5 + 1.8;
  return [Math.min(96, Math.max(4, x)), Math.min(98, Math.max(5, y))];
}

export default function DotToDot({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(DOT_LEVELS.length, Math.max(1, startLevel)));
  const cfg = DOT_LEVELS[level - 1]!;
  const [index, setIndex] = useState(0);
  const picture = DOT_PICTURES[cfg.pictures[index]!]!;
  const [availableWidth, setBoardWidth] = useState(320);
  const { height: screenHeight } = useWindowDimensions();
  // Same room as the other games: app bar, game header and the button row below.
  const size = Math.min(availableWidth, screenHeight < 450 ? Math.max(130, screenHeight - 300) : Math.max(200, screenHeight - 400));

  const [joined, setJoined] = useState(1); // dot 1 is where you start
  const [complete, setComplete] = useState(false);
  const [missed, setMissed] = useState(false);
  const [wrong, setWrong] = useState<number | null>(null);
  const [idle, setIdle] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  // While a finger (or the mouse button) is down: where it is and the path it took,
  // so the child sees the line stretching from the last dot to their finger.
  const [finger, setFinger] = useState<Pt | null>(null);
  const [trail, setTrail] = useState<Pt[]>([]);
  const live = useRef({ joined: 1, complete: false, mistakes: 0 });
  const reveal = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  const centre = useMemo<Pt>(() => {
    const xs = picture.dots.map(d => d[0]), ys = picture.dots.map(d => d[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }, [picture]);

  const resetPicture = useCallback(() => {
    live.current = { ...live.current, joined: 1, complete: false };
    setJoined(1); setComplete(false); setMissed(false); setWrong(null); setIdle(false); setFinger(null); setTrail([]); reveal.setValue(0);
  }, [reveal]);
  useEffect(() => { resetPicture(); }, [picture, resetPicture]);
  useEffect(() => { setIndex(0); setWon(null); live.current.mistakes = 0; }, [level]);
  useEffect(() => () => stopSpeaking(), []);

  // The next dot glows on the first level, after a wrong tap, or after a little wait.
  useEffect(() => {
    if (complete) return;
    setIdle(false);
    const t = setTimeout(() => setIdle(true), 7000);
    return () => clearTimeout(t);
  }, [joined, complete]);
  const glow = !complete && (level === 1 || missed || idle);
  useEffect(() => {
    if (!glow) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow, pulse]);

  const finishPicture = useCallback(() => {
    live.current.complete = true;
    setComplete(true);
    playSound('yay');
    Animated.timing(reveal, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: useNative }).start();
  }, [reveal]);

  /** A finger landed on (or slid over) a spot on the board. */
  const touch = useCallback((x: number, y: number, tapped: boolean) => {
    const s = live.current;
    if (s.complete) return;
    const dots = picture.dots;
    let hit = -1, best = HIT;
    dots.forEach(([dx, dy], i) => { const d = Math.hypot(dx - x, dy - y); if (d <= best) { best = d; hit = i; } });
    if (hit < 0) return;
    if (hit === s.joined) {
      s.joined++;
      setJoined(s.joined); setWrong(null); setMissed(false);
      if (s.joined >= dots.length) finishPicture();
      else playSound('pop');
    } else if (tapped && hit > s.joined) {
      // Only a deliberate tap on a later dot counts; sliding past dots never does.
      s.mistakes++;
      setMissed(true); setWrong(hit);
      playSound('oops');
      wiggle.setValue(0);
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 70, useNativeDriver: useNative }),
        Animated.timing(wiggle, { toValue: -1, duration: 70, useNativeDriver: useNative }),
        Animated.timing(wiggle, { toValue: 0, duration: 70, useNativeDriver: useNative }),
      ]).start(() => setWrong(null));
    }
  }, [picture, finishPicture, wiggle]);

  const toUnits = useCallback((lx: number, ly: number): Pt => [(lx / size) * 100, (ly / size) * 100], [size]);
  const lockScroll = useScrollLock();
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => { lockScroll(false); setFinger(null); setTrail([]); },
    onPanResponderTerminate: () => { lockScroll(false); setFinger(null); setTrail([]); },
    onPanResponderGrant: e => {
      lockScroll(true);
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setFinger(p); setTrail([p]);
      touch(p[0], p[1], true);
    },
    onPanResponderMove: e => {
      const p = toUnits(e.nativeEvent.locationX, e.nativeEvent.locationY);
      setFinger(p); setTrail(t => [...t.slice(-60), p]);
      touch(p[0], p[1], false);
    },
  }), [toUnits, touch, lockScroll]);

  const nextPicture = useCallback(() => {
    stopSpeaking();
    if (index + 1 < cfg.pictures.length) { setIndex(index + 1); return; }
    const m = live.current.mistakes;
    const stars = m <= 1 ? 3 : m <= 4 ? 2 : 1;
    setWon(stars); playSound('tada');
    onFinish(stars, Math.min(DOT_LEVELS.length, level + 1));
  }, [index, cfg.pictures.length, level, onFinish]);

  const dots = picture.dots;
  const path = dots.slice(0, joined);
  const next = dots[joined];
  const nextLabel = complete ? '' : dotLabel(joined, cfg.labels);
  const hint = won !== null ? '' : complete ? `${picture.spoken} 🎉`
    : joined === 1 ? `Start at ${dotLabel(0, cfg.labels)}, then tap ${dotLabel(1, cfg.labels)}.`
    : `Now find ${nextLabel}.`;
  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [(9 / 100) * size, (14 / 100) * size] });
  const shake = wiggle.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  const pop = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const dotR = 2.6;

  return (
    <GameFrame emoji="🖍️" title="Dot to Dot" level={level} onBack={onBack} hint={hint}>
      <GameSurface theme="blue" eyebrow="THE PICTURE PUZZLE" title={cfg.name} badgeLabel="NEXT" badge={complete ? picture.emoji : nextLabel} onWidth={setBoardWidth}>
        <View style={styles.row} accessibilityLabel={`Picture ${index + 1} of ${cfg.pictures.length}`}>
          {cfg.pictures.map((k, i) => (
            <Text key={k + i} style={[styles.chip, i < index && styles.chipDone, i === index && styles.chipNow]}>
              {i < index ? DOT_PICTURES[k]!.emoji : '?'}
            </Text>
          ))}
        </View>
        <Animated.View style={[styles.canvas, { width: size, height: size, transform: [{ translateX: shake }] }]}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              {/* Lines joined so far. */}
              {path.length > 1 ? <Polyline points={pts(path)} fill="none" stroke={picture.outline} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {/* The finger's path, faint, and a stretchy line from the last dot to the finger. */}
              {finger && !complete && trail.length > 1 ? <Polyline points={pts(trail)} fill="none" stroke={picture.outline} strokeOpacity={0.22} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {finger && !complete ? (
                <>
                  <Line x1={dots[joined - 1]![0]} y1={dots[joined - 1]![1]} x2={finger[0]} y2={finger[1]} stroke={picture.outline} strokeOpacity={0.75} strokeWidth={1.8} strokeLinecap="round" />
                  <Circle cx={finger[0]} cy={finger[1]} r={3.4} fill={picture.outline} fillOpacity={0.3} />
                </>
              ) : null}
              {/* The next line, faint, so the child sees where they are heading. */}
              {next && joined > 0 && glow ? <Line x1={dots[joined - 1]![0]} y1={dots[joined - 1]![1]} x2={next[0]} y2={next[1]} stroke={picture.outline} strokeOpacity={0.25} strokeWidth={1.2} strokeDasharray="2 2" /> : null}
              {dots.map(([x, y], i) => {
                const done = i < joined;
                const isNext = i === joined && !complete;
                const [lx, ly] = labelSpot([x, y], centre);
                return (
                  <React.Fragment key={i}>
                    <Circle cx={x} cy={y} r={isNext ? dotR + 0.6 : dotR} fill={done ? picture.outline : i === wrong ? '#F48A9B' : isNext ? '#3F9A6E' : '#FFFFFF'}
                      stroke={done ? picture.outline : '#6D5A49'} strokeWidth={0.8} />
                    <SvgText x={lx} y={ly} fontSize={dots.length > 15 ? 4.6 : 5.4} fontWeight="900" fontFamily={LABEL_FONT} textAnchor="middle"
                      fill={done ? '#B5A898' : isNext ? '#2F7A4F' : '#4A3728'}>{dotLabel(i, cfg.labels)}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
          {glow && next ? (
            <Animated.View pointerEvents="none" style={[styles.ringWrap, { left: (next[0] / 100) * size, top: (next[1] / 100) * size }]}>
              <Animated.View style={[styles.ring, {
                width: ring, height: ring,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] }),
              }]} />
            </Animated.View>
          ) : null}
          {/* The finished picture: coloured in, with its details. */}
          {complete ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: reveal, transform: [{ scale: pop }] }]}>
              <Svg width={size} height={size} viewBox="0 0 100 100">
                {picture.closed ? <Polygon points={pts(dots)} fill={picture.fill} stroke={picture.outline} strokeWidth={1.8} strokeLinejoin="round" /> : null}
                {(picture.extras ?? []).map((e, i) => <ExtraShape key={i} extra={e} />)}
              </Svg>
            </Animated.View>
          ) : null}
          {/* An empty layer on top takes the touches, measured from the board corner. */}
          <View style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'pointer' } as object) : null]} {...responder.panHandlers}
            accessible accessibilityRole="adjustable" accessibilityLabel={complete ? picture.spoken : `Dot board. Next dot: ${nextLabel}`}
            accessibilityActions={[{ name: 'increment', label: 'Join the next dot' }]}
            onAccessibilityAction={() => { if (next) touch(next[0], next[1], true); }} />
        </Animated.View>
        {complete ? (
          <View style={styles.doneRow}>
            <Pressable onPress={nextPicture} accessibilityRole="button" style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
              <Text style={styles.nextText}>{index + 1 < cfg.pictures.length ? 'Next picture ▶' : 'Finish ⭐'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.doneRow}>
            <Pressable onPress={resetPicture} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionText}>↺ Start again</Text>
            </Pressable>
          </View>
        )}
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={`${cfg.name}: ${cfg.pictures.map(k => DOT_PICTURES[k]!.emoji).join(' ')} all found!`} onExit={onBack}
          onAgain={() => { setIndex(0); setWon(null); live.current.mistakes = 0; resetPicture(); }}
          onNext={level < DOT_LEVELS.length ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  chip: { minWidth: 36, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#F3EEE7', color: colors.inkSoft, fontWeight: '900', fontSize: 16, overflow: 'hidden' },
  chipDone: { backgroundColor: colors.goSoft },
  chipNow: { backgroundColor: '#FFF0C9', color: '#8A5A0A', borderWidth: 2, borderColor: '#F4C966' },
  canvas: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 3, borderColor: '#CFE4F5', overflow: 'hidden' },
  ringWrap: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 3, borderColor: '#3F9A6E' },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing(1), minHeight: 48 },
  next: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(2), borderRadius: 999, backgroundColor: '#E8724F' },
  nextText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(2), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  actionText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
