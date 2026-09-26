import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Animated, Easing, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, type, scaled } from '../theme';
import { useVoiceCapture, MAX_RECORD_SECONDS } from '../useVoiceCapture';
import { MicIcon } from './Icons';

export interface VoiceAnswerProps {
  value: string;
  onChange: (text: string) => void;
  uiScale: number;
  /**
   * `big` is the only way to answer — a large microphone for children who
   * cannot type. `inline` sits beneath a text box as an alternative to typing.
   */
  variant?: 'big' | 'inline';
}

/**
 * Speaking an answer.
 *
 * One decision worth keeping whichever variant is used: the transcript always
 * lands in an editable text field rather than being submitted straight to the
 * grader. Speech recognition is imperfect, and worse on children's voices. A
 * wrong transcript that got graded silently would produce a confidently wrong
 * result with nothing to catch it — showing it makes the mistake visible, and
 * making it editable means it can be fixed rather than the question redone.
 */
export default function VoiceAnswer({
  value,
  onChange,
  uiScale,
  variant = 'big',
}: VoiceAnswerProps) {
  // "Say it again" replaces the answer; otherwise speaking again adds to it.
  const replaceNext = useRef(false);
  const [editing, setEditing] = useState(false);
  const { stage, seconds, problem, toggle } = useVoiceCapture((text) => {
    // Append rather than replace: if they typed something first, or spoke
    // twice, nothing they already had should vanish.
    if (replaceNext.current) { replaceNext.current = false; onChange(text); }
    else onChange(value.trim() ? `${value.trim()} ${text}` : text);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  });
  useEffect(() => { if (stage === 'recording') setEditing(false); }, [stage]);

  function press() {
    if (stage !== 'recording') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    toggle();
  }

  // ---- inline: a mic button under an existing text box --------------------
  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stage === 'recording' ? 'Stop recording' : 'Record your answer'}
          onPress={press}
          disabled={stage === 'working' || stage === 'starting'}
          style={({ pressed }) => [
            styles.inlineButton,
            stage === 'recording' && styles.inlineButtonLive,
            pressed && { opacity: 0.85 },
          ]}
        >
          {stage === 'working' || stage === 'starting' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.inlineIcon}>{stage === 'recording' ? '⏹' : '🎤'}</Text>
          )}
          <Text style={styles.inlineLabel}>
            {stage === 'recording'
              ? `Listening… ${seconds}s — tap to stop`
              : stage === 'starting' ? 'Starting microphone…' : stage === 'working'
                ? 'Writing it down…'
                : 'Say it instead'}
          </Text>
        </Pressable>
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>
    );
  }

  // ---- big: the only input, for pre-readers -------------------------------
  // Four clearly different looks, so a child always knows what is happening:
  // ready (orange mic, "Tap to talk"), listening (red STOP button with pulsing
  // rings), thinking (spinner), and done (a "You said" bubble).
  const busy = stage === 'working' || stage === 'starting';
  const live = stage === 'recording';
  const heard = value.trim().length > 0;
  // Once there is an answer the words matter most, so the button steps back.
  const size = heard && !live && !busy ? scaled(84, uiScale) : scaled(128, uiScale);

  return (
    <View style={{ marginTop: spacing(1) }}>
      {heard && !live && !busy ? (
        <View style={styles.bubble}>
          <View style={styles.bubbleTop}>
            <Text style={styles.bubbleTitle}>💬 You said</Text>
            <Pressable
              onPress={() => setEditing((e) => !e)}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Done fixing the words' : 'Fix the words'}
              hitSlop={8}
              style={({ pressed }) => [styles.fixButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.fixText}>{editing ? '✓ Done' : '✏️ Fix words'}</Text>
            </Pressable>
          </View>
          {editing ? (
            <TextInput
              style={[styles.bubbleText, styles.bubbleInput]}
              value={value}
              onChangeText={onChange}
              multiline
              autoFocus
              maxLength={4000}
              accessibilityLabel="What I heard. A grown-up can fix this."
            />
          ) : (
            <Text style={styles.bubbleText}>{value}</Text>
          )}
        </View>
      ) : null}

      <View style={styles.center}>
        <View style={{ width: live ? size * 1.6 : size + 16, height: live ? size * 1.6 : size + 16, alignItems: 'center', justifyContent: 'center' }}>
          {live ? <Pulse size={size} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={live ? 'Stop talking' : heard ? 'Say it again' : 'Start talking'}
            onPress={() => { if (!live && heard) replaceNext.current = true; press(); }}
            disabled={busy}
            style={({ pressed }) => [
              styles.mic,
              { width: size, height: size, borderRadius: size / 2 },
              live && styles.micLive,
              busy && styles.micBusy,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : live ? (
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.stopSquare, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.06 }]} />
                <Text style={styles.stopText}>STOP</Text>
              </View>
            ) : (
              <MicIcon size={size * 0.5} color="#FFFFFF" />
            )}
          </Pressable>
        </View>

        <View style={[styles.pill, live && styles.pillLive, busy && styles.pillBusy]}>
          <Text style={[styles.pillText, { fontSize: heard && !live && !busy ? scaled(16, uiScale) : scaled(19, uiScale) }, live && { color: '#FFFFFF' }]}>
            {live ? 'I’m listening… speak now!' : stage === 'starting' ? 'Getting ready…' : busy ? 'Writing down what you said…' : heard ? 'Say it again' : 'Tap to talk'}
          </Text>
        </View>

        {live ? (
          <View style={styles.timeTrack} accessibilityLabel={`${seconds} seconds`}>
            <View style={[styles.timeFill, { width: `${Math.min(100, (seconds / MAX_RECORD_SECONDS) * 100)}%` }]} />
          </View>
        ) : null}
        {live && seconds >= MAX_RECORD_SECONDS - 10 ? <Text style={type.soft}>Nearly time to stop</Text> : null}
        {problem && !live && !busy ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>
    </View>
  );
}

/** Two soft rings that grow and fade behind the STOP button while listening. */
function Pulse({ size }: { size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const ring = (v: Animated.Value) => Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: native }));
    const first = ring(a); first.start();
    const timer = setTimeout(() => ring(b).start(), 700);
    return () => { clearTimeout(timer); a.stopAnimation(); b.stopAnimation(); };
  }, [a, b]);
  const style = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: '#F28B7A',
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  });
  return (
    <>
      <Animated.View style={[style(a), { pointerEvents: 'none' }]} />
      <Animated.View style={[style(b), { pointerEvents: 'none' }]} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing(1.25), paddingBottom: spacing(1) },
  mic: {
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  micLive: { backgroundColor: '#E5484D', borderColor: '#C4353A' },
  micBusy: { backgroundColor: '#FFFFFF', borderColor: colors.line, shadowOpacity: 0 },
  stopSquare: { backgroundColor: '#FFFFFF' },
  stopText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  pill: { paddingVertical: spacing(1), paddingHorizontal: spacing(2.5), borderRadius: 999, backgroundColor: colors.primarySoft },
  pillLive: { backgroundColor: '#E5484D' },
  pillBusy: { backgroundColor: '#F3EEE7' },
  pillText: { fontWeight: '900', color: colors.primary, textAlign: 'center' },
  timeTrack: { width: '60%', height: 8, borderRadius: 4, backgroundColor: '#F3E1DD', overflow: 'hidden' },
  timeFill: { height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  bubble: { backgroundColor: '#E5F3FF', borderWidth: 2, borderColor: '#A8D4EF', borderRadius: 22, borderBottomLeftRadius: 6, padding: spacing(2), marginBottom: spacing(1.5) },
  bubbleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1) },
  bubbleTitle: { fontSize: 14, fontWeight: '900', color: '#286789' },
  fixButton: { paddingVertical: 4, paddingHorizontal: spacing(1.25), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#A8D4EF' },
  fixText: { fontSize: 13, fontWeight: '800', color: '#286789' },
  // Grown-ups read this, so ordinary reading size; it wraps and grows with the answer.
  bubbleText: { fontSize: 17, lineHeight: 25, fontWeight: '500', color: colors.ink, marginTop: spacing(0.75), width: '100%' },
  bubbleInput: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#A8D4EF', padding: spacing(1), textAlignVertical: 'top', height: 128 },

  inlineRow: { marginTop: spacing(1.5), gap: spacing(1) },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    alignSelf: 'flex-start',
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2),
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    minHeight: 44,
  },
  inlineButtonLive: { backgroundColor: colors.happySoft },
  inlineIcon: { fontSize: 18 },
  inlineLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },

  problem: { color: colors.warn, fontSize: 15 },
});
