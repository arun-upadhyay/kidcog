import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Owl from '../components/Owl';
import { playSound } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { useNative, useScrollLock, useUsableHeight } from './common';
import { drawingTouchStyle } from './common';

/**
 * Rainbow Letters: trace big letters, numbers, little words and shapes with
 * rainbow ink. Follow the fat grey path; when most of it is covered, Owl
 * cheers, stars burst and the next one comes up. No timer, no wrong answers.
 */
import { GLYPHS } from './TraceDraw';
import { guideFor, checkpoints, SETS, SHAPES, type Pt } from './rainbowContent';

const RAINBOW = ['#EF4E43', '#F7943A', '#FFD54A', '#4CB86A', '#3E9BE0', '#8D63D8', '#F57FB6'];
const say = (item: string) => (item.length === 1 && /[a-z]/i.test(item) ? `${item.toUpperCase()}` : item);

export default function RainbowLetters() {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
  const [set, setSet] = useState(SETS[0]!);
  const [index, setIndex] = useState(0);
  const [ink, setInk] = useState<{ points: Pt[]; hue: number }[]>([]);
  const [done, setDone] = useState(false);
  const [starsWon, setStarsWon] = useState(0);
  const lock = useScrollLock();
  const burst = useRef(new Animated.Value(0)).current;
  const hue = useRef(0);
  const item = set.items[index]!;
  const guide = guideFor(item, GLYPHS);
  const targets = checkpoints(guide);
  const board = Math.floor(Math.max(220, Math.min(width - 48, 520, height - 330)));

  useEffect(() => () => lock(false), [lock]);
  useEffect(() => { setInk([]); setDone(false); }, [item]);

  const covered = (lines: { points: Pt[] }[]) => {
    const pts = lines.flatMap(l => l.points);
    if (!pts.length) return 0;
    const hit = targets.filter(([x, y]) => pts.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 49)).length;
    return hit / targets.length;
  };

  function at(e: GestureResponderEvent): Pt {
    return [Math.max(0, Math.min(100, (e.nativeEvent.locationX / board) * 100)), Math.max(0, Math.min(100, (e.nativeEvent.locationY / board) * 100))];
  }
  function begin(e: GestureResponderEvent) {
    if (done) return;
    lock(true);
    hue.current = (hue.current + 1) % RAINBOW.length;
    const p = at(e);
    setInk(list => [...list.slice(-60), { points: [p, [p[0] + 0.1, p[1] + 0.1]], hue: hue.current }]);
  }
  function move(e: GestureResponderEvent) {
    if (done) return;
    const p = at(e);
    setInk(list => {
      const last = list[list.length - 1];
      if (!last || last.points.length > 800) return list;
      return [...list.slice(0, -1), { ...last, points: [...last.points, p] }];
    });
  }
  function end() {
    lock(false);
    if (done) return;
    if (covered(ink) >= 0.85) {
      setDone(true); setStarsWon(s => s + 1);
      playSound('yay');
      stopSpeaking(); void speak(`${say(item)}! Great tracing!`);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 900, useNativeDriver: useNative }).start();
    }
  }
  const next = () => { setIndex(i => (i + 1) % set.items.length); };
  const progress = Math.round(covered(ink) * 100);

  return (
    <View style={styles.panel}>
      <View style={styles.sets}>
        {SETS.map(s => (
          <Pressable key={s.key} onPress={() => { setSet(s); setIndex(0); }} accessibilityRole="tab" accessibilityState={{ selected: s.key === set.key }}
            style={({ pressed }) => [styles.set, s.key === set.key && styles.setOn, pressed && styles.pressed]}>
            <Text style={styles.setEmoji}>{s.emoji}</Text>
            <Text style={[styles.setText, s.key === set.key && styles.setTextOn]}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.head}>
        <Owl size={52} mood={done ? 'happy' : 'idle'} still={!done} />
        <Text style={styles.prompt} accessibilityRole="header">{done ? `⭐ You traced ${item}!` : `Trace ${item.length > 1 && !SHAPES[item] ? `“${item}”` : item}`}</Text>
        <Pressable onPress={() => { stopSpeaking(); void speak(SHAPES[item] ? `Trace the ${item.toLowerCase()}` : `Trace ${say(item)}`); }}
          accessibilityRole="button" accessibilityLabel={`Hear: trace ${item}`} style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}>
          <Text style={styles.speakerText}>🔊</Text>
        </Pressable>
      </View>

      <View testID="rainbow-board" accessibilityLabel={`Tracing board for ${item}`}
        style={[styles.board, drawingTouchStyle, { width: board, height: board }]}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={begin} onResponderMove={move} onResponderRelease={end} onResponderTerminate={end} onResponderTerminationRequest={() => false}>
        <Svg width={board} height={board} viewBox="0 0 100 100" pointerEvents="none">
          {guide.map((s, i) => <Polyline key={`g${i}`} points={s.map(p => p.join(',')).join(' ')} fill="none" stroke="#E6E0F2" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />)}
          {guide.map((s, i) => <Polyline key={`d${i}`} points={s.map(p => p.join(',')).join(' ')} fill="none" stroke="#B9A9D9" strokeWidth={1.4} strokeDasharray="2.5 2.5" strokeLinecap="round" />)}
          {guide.map((s, i) => <Circle key={`s${i}`} cx={s[0]![0]} cy={s[0]![1]} r={3.2} fill="#4CB86A" />)}
          {ink.map((line, i) => <Polyline key={`i${i}`} points={line.points.map(p => p.join(',')).join(' ')} fill="none" stroke={RAINBOW[line.hue]} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
        <Animated.Text pointerEvents="none" style={[styles.burst, { opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }] }]}>🌟</Animated.Text>
      </View>

      <View style={styles.meter} accessibilityLabel={`${progress} percent traced`}>
        <View style={[styles.meterFill, { width: `${done ? 100 : progress}%` }]} />
      </View>

      <View style={styles.tools}>
        <Pressable onPress={() => setInk([])} accessibilityRole="button" style={({ pressed }) => [styles.tool, pressed && styles.pressed]}><Text style={styles.toolText}>🧽 Clear</Text></Pressable>
        <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [styles.tool, done && styles.toolGo, pressed && styles.pressed]}>
          <Text style={[styles.toolText, done && { color: '#FFFFFF' }]}>{done ? 'Next ▶' : 'Skip ▶'}</Text>
        </Pressable>
      </View>
      <Text style={styles.stars} accessibilityLabel={`${starsWon} stars today`}>{starsWon ? `${'⭐'.repeat(Math.min(10, starsWon))}${starsWon > 10 ? ` +${starsWon - 10}` : ''}` : 'Start at the green dot ✨'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 28, padding: 14 },
  sets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  set: { alignItems: 'center', minWidth: 74, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  setOn: { backgroundColor: '#2F7BDB', borderColor: '#1D57A6' },
  setEmoji: { fontSize: 24 },
  setText: { fontSize: 13, fontWeight: '900', color: '#1D57A6' },
  setTextOn: { color: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prompt: { fontSize: 26, fontWeight: '900', color: '#53347E' },
  speaker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE9FF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  speakerText: { fontSize: 20 },
  board: { backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 4, borderBottomWidth: 9, borderColor: '#7FD0F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  burst: { position: 'absolute', fontSize: 110 },
  meter: { width: '80%', maxWidth: 420, height: 14, borderRadius: 7, backgroundColor: '#EEE9FF', overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#4CB86A', borderRadius: 7 },
  tools: { flexDirection: 'row', gap: 10 },
  tool: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  toolGo: { backgroundColor: '#2F9A5B', borderColor: '#1F7042' },
  toolText: { fontSize: 16, fontWeight: '900', color: '#53347E' },
  stars: { fontSize: 18, fontWeight: '800', color: '#5A4B66', textAlign: 'center' },
  pressed: { transform: [{ scale: 0.95 }] },
});
