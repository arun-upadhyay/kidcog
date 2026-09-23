import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, type, scaled } from '../theme';
import { useVoiceCapture, MAX_RECORD_SECONDS } from '../useVoiceCapture';

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
  const { stage, seconds, problem, toggle } = useVoiceCapture((text) => {
    // Append rather than replace: if they typed something first, or spoke
    // twice, nothing they already had should vanish.
    onChange(value.trim() ? `${value.trim()} ${text}` : text);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  });

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
  const size = scaled(120, uiScale);
  const busy = stage === 'working' || stage === 'starting';

  return (
    <View style={{ marginTop: spacing(2) }}>
      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stage === 'recording' ? 'Stop talking' : 'Start talking'}
          onPress={press}
          disabled={busy}
          style={({ pressed }) => [
            styles.mic,
            { width: size, height: size, borderRadius: size / 2 },
            stage === 'recording' && styles.micLive,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <Text style={{ fontSize: scaled(46, uiScale) }}>
              {stage === 'recording' ? '⏹' : '🎤'}
            </Text>
          )}
        </Pressable>

        <Text style={[styles.micLabel, { fontSize: scaled(19, uiScale) }]}>
          {stage === 'recording'
            ? 'Listening… tap when you are done'
            : stage === 'starting' ? 'Starting microphone…' : busy
              ? 'Listening to what you said…'
              : value
                ? 'Tap to say more'
                : 'Tap and tell me'}
        </Text>

        {stage === 'recording' && (
          <Text style={type.soft}>
            {seconds}s{seconds >= MAX_RECORD_SECONDS - 10 ? ' · nearly time to stop' : ''}
          </Text>
        )}
      </View>

      {value || problem ? (
        <View style={styles.transcript}>
          <Text style={type.label}>WHAT I HEARD — A GROWN-UP CAN FIX THIS</Text>
          <TextInput
            style={styles.transcriptInput}
            value={value}
            onChangeText={onChange}
            multiline
            placeholder="Tap the microphone, or type the answer here."
            placeholderTextColor={colors.inkSoft}
            maxLength={4000}
          />
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing(1.5), paddingVertical: spacing(2) },
  mic: {
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLive: { backgroundColor: colors.happySoft, borderColor: colors.primary },
  micLabel: { fontWeight: '700', color: colors.ink, textAlign: 'center' },

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

  transcript: {
    marginTop: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: spacing(2),
    gap: spacing(1),
  },
  transcriptInput: {
    minHeight: 80,
    fontSize: 17,
    lineHeight: 25,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  problem: { color: colors.warn, fontSize: 15 },
});
