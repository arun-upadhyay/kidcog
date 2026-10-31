import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { speak, stopSpeaking } from '../speech';
import { useMusicAudio } from './musicAudio';
import { useGameMusic } from './gameMusic';
import { useNative, useUsableHeight } from './common';

/**
 * Calm Bubbles: a quiet, no-score corner. Soft bubbles drift up; tap one and
 * it pops with a gentle note and says its colour. A breathing bubble in the
 * corner grows and shrinks ("breathe in… breathe out") for a calm moment.
 * No timer, no score, nothing to get wrong.
 */
export const BUBBLE_COLOURS = [
  { name: 'red', hex: '#FF8A80', note: 0 }, { name: 'orange', hex: '#FFB870', note: 1 }, { name: 'yellow', hex: '#FFE27A', note: 2 },
  { name: 'green', hex: '#8EDB9E', note: 3 }, { name: 'blue', hex: '#8CC8FF', note: 4 }, { name: 'purple', hex: '#C3A6F5', note: 5 },
  { name: 'pink', hex: '#FFA8D2', note: 6 },
];

type Bubble = { id: number; x: number; size: number; colour: number; rise: Animated.Value; sway: Animated.Value; popping: Animated.Value };

export default function CalmBubbles() {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
  const audio = useMusicAudio();
  useGameMusic('calm');
  const fieldWidth = Math.min(width - 48, 820);
  const fieldHeight = Math.max(300, Math.min(height - 300, 620));
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [said, setSaid] = useState<{ name: string; hex: string } | null>(null);
  const [popped, setPopped] = useState(0);
  const nextId = useRef(0);
  const breathe = useRef(new Animated.Value(0)).current;
  const [breathIn, setBreathIn] = useState(true);

  // A new bubble every so often; at most 9 on screen.
  useEffect(() => {
    const add = () => setBubbles(list => {
      if (list.length >= 9) return list;
      const size = 64 + Math.round(Math.random() * 40);
      const b: Bubble = { id: ++nextId.current, x: Math.random() * Math.max(10, fieldWidth - size), size, colour: Math.floor(Math.random() * BUBBLE_COLOURS.length),
        rise: new Animated.Value(0), sway: new Animated.Value(0), popping: new Animated.Value(0) };
      Animated.timing(b.rise, { toValue: 1, duration: 9000 + Math.random() * 5000, easing: Easing.linear, useNativeDriver: useNative })
        .start(({ finished }) => { if (finished) setBubbles(l => l.filter(x => x.id !== b.id)); });
      Animated.loop(Animated.sequence([
        Animated.timing(b.sway, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
        Animated.timing(b.sway, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      ])).start();
      return [...list, b];
    });
    for (let i = 0; i < 4; i++) setTimeout(add, i * 500);
    const timer = setInterval(add, 1300);
    return () => clearInterval(timer);
  }, [fieldWidth]);

  // Breathing bubble: 4 seconds in, 4 seconds out.
  useEffect(() => {
    let alive = true;
    const cycle = () => {
      if (!alive) return;
      setBreathIn(true);
      Animated.timing(breathe, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }).start(() => {
        if (!alive) return;
        setBreathIn(false);
        Animated.timing(breathe, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }).start(cycle);
      });
    };
    cycle();
    return () => { alive = false; breathe.stopAnimation(); };
  }, [breathe]);

  function pop(b: Bubble) {
    const c = BUBBLE_COLOURS[b.colour]!;
    b.rise.stopAnimation();
    void audio.play(c.note);
    setSaid(c); setPopped(n => n + 1);
    stopSpeaking(); void speak(c.name);
    Animated.timing(b.popping, { toValue: 1, duration: 260, useNativeDriver: useNative }).start(() => setBubbles(l => l.filter(x => x.id !== b.id)));
  }

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Animated.View style={[styles.breath, { transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }] }]}>
          <Text style={styles.breathText}>{breathIn ? 'Breathe in…' : 'Breathe out…'}</Text>
        </Animated.View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>🫧 Pop a bubble, hear its colour</Text>
          <Text style={[styles.said, said ? { color: '#3F3550', backgroundColor: said.hex } : null]} accessibilityLiveRegion="polite">
            {said ? `${said.name}!` : 'Tap any bubble'}
          </Text>
        </View>
      </View>
      <View style={[styles.field, { width: fieldWidth, height: fieldHeight }]} testID="calm-field">
        {bubbles.map(b => {
          const c = BUBBLE_COLOURS[b.colour]!;
          return (
            <Animated.View key={b.id} style={[styles.bubbleWrap, { left: b.x, width: b.size, height: b.size, opacity: b.popping.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [
              { translateY: b.rise.interpolate({ inputRange: [0, 1], outputRange: [fieldHeight, -b.size] }) },
              { translateX: b.sway.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) },
              { scale: b.popping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
            ] }]}>
              <Pressable onPress={() => pop(b)} accessibilityRole="button" accessibilityLabel={`${c.name} bubble`} testID="calm-bubble"
                style={[styles.bubble, { borderRadius: b.size / 2, backgroundColor: c.hex }]}>
                <View style={[styles.shine, { width: b.size * 0.26, height: b.size * 0.14, borderRadius: b.size }]} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.count}>{popped ? `${popped} bubble${popped === 1 ? '' : 's'} popped ✨` : 'No hurry. Pop as many as you like.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 28, padding: 14 },
  head: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12 },
  breath: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#D8F1FB', borderWidth: 3, borderColor: '#8CC8FF', alignItems: 'center', justifyContent: 'center' },
  breathText: { fontSize: 14, fontWeight: '900', color: '#1D57A6', textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#53347E', textAlign: 'center' },
  said: { marginTop: 6, fontSize: 26, fontWeight: '900', color: '#8C7FA3', paddingHorizontal: 18, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
  field: { backgroundColor: '#EAF6FF', borderRadius: 26, borderWidth: 3, borderColor: '#B9DDF7', overflow: 'hidden' },
  bubbleWrap: { position: 'absolute', top: 0 },
  bubble: { flex: 1, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', opacity: 0.92 },
  shine: { position: 'absolute', top: '16%', left: '22%', backgroundColor: 'rgba(255,255,255,0.85)', transform: [{ rotate: '-30deg' }] },
  count: { fontSize: 16, fontWeight: '800', color: '#5A4B66' },
});
