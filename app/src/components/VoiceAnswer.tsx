import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { colors, spacing, type, scaled } from '../theme';
import { transcribeAudio } from '../api';
import { stopSpeaking } from '../speech';

export interface VoiceAnswerProps {
  /** The transcript so far, lifted into the parent screen's answer state. */
  value: string;
  onChange: (text: string) => void;
  uiScale: number;
}

type Stage = 'idle' | 'recording' | 'working' | 'done' | 'failed';

/** Longest we let a child ramble before stopping for them. */
const MAX_SECONDS = 45;

/**
 * A big talk button for children who cannot type.
 *
 * Two deliberate choices here.
 *
 * The transcript is always shown, and always editable. Speech recognition on
 * young voices is noticeably worse than on adults, and a wrong transcript that
 * is silently graded would produce a confidently wrong result with no way for
 * anyone to notice. Showing it makes the mistake visible; making it editable
 * means a parent can fix it rather than redo the question.
 *
 * And if recording or transcription fails for any reason — no microphone, no
 * permission, a network error — the component degrades to a plain text box
 * rather than blocking the child from continuing.
 */
export default function VoiceAnswer({ value, onChange, uiScale }: VoiceAnswerProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [stage, setStage] = useState<Stage>(value ? 'done' : 'idle');
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  // Stop for them if they keep going — a 4-year-old will not watch a timer.
  useEffect(() => {
    if (stage === 'recording' && seconds >= MAX_SECONDS) {
      void stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, stage]);

  async function start() {
    setProblem(null);
    stopSpeaking(); // don't record the question being read aloud
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setProblem('I need permission to use the microphone.');
        setStage('failed');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setStage('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not start recording.');
      setStage('failed');
    }
  }

  async function stop() {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    setStage('working');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was captured.');

      const base64 = await readAsBase64(uri);
      const filename = uri.split('/').pop() || 'answer.m4a';
      const { text } = await transcribeAudio(base64, filename);

      if (!text.trim()) {
        setProblem("I couldn't hear that. Try again, or a grown-up can type it.");
        setStage('failed');
        return;
      }
      onChange(text);
      setStage('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not understand the recording.');
      setStage('failed');
    }
  }

  const big = scaled(120, uiScale);

  return (
    <View style={{ marginTop: spacing(2) }}>
      {stage === 'idle' || stage === 'recording' ? (
        <View style={styles.center}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={stage === 'recording' ? 'Stop talking' : 'Start talking'}
            onPress={() => (stage === 'recording' ? void stop() : void start())}
            style={({ pressed }) => [
              styles.mic,
              { width: big, height: big, borderRadius: big / 2 },
              stage === 'recording' && styles.micLive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={{ fontSize: scaled(46, uiScale) }}>
              {stage === 'recording' ? '⏹' : '🎤'}
            </Text>
          </Pressable>
          <Text style={[styles.micLabel, { fontSize: scaled(19, uiScale) }]}>
            {stage === 'recording' ? `Listening… tap when done` : 'Tap and tell me'}
          </Text>
          {stage === 'recording' && (
            <Text style={type.soft}>
              {seconds}s {seconds >= MAX_SECONDS - 10 ? '· nearly time to stop' : ''}
            </Text>
          )}
        </View>
      ) : null}

      {stage === 'working' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.micLabel, { fontSize: scaled(18, uiScale) }]}>
            Listening to what you said…
          </Text>
        </View>
      )}

      {(stage === 'done' || stage === 'failed' || value) && (
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
          <Pressable onPress={() => void start()} style={styles.again}>
            <Text style={styles.againText}>🎤 Say it again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/**
 * Read the recording as base64.
 *
 * On native the file lives on disk; on web the recorder hands back a blob URL.
 * fetch handles both, which avoids a platform branch and an extra dependency.
 */
async function readAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
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
  micLive: { backgroundColor: colors.primary, borderColor: colors.ink },
  micLabel: { fontWeight: '700', color: colors.ink, textAlign: 'center' },
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
  again: { alignSelf: 'flex-start', paddingVertical: spacing(1) },
  againText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});
