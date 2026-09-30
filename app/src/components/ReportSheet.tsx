import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Sheet from './Sheet';
import Button from './Button';
import { reportContent } from '../api';
import { colors, spacing } from '../theme';

type Reason = 'inappropriate' | 'wrong' | 'confusing' | 'other';

const REASONS: { key: Reason; icon: string; label: string }[] = [
  { key: 'inappropriate', icon: '🚫', label: 'Not suitable for children' },
  { key: 'wrong', icon: '❌', label: 'Wrong or makes no sense' },
  { key: 'confusing', icon: '🤔', label: 'Too hard or confusing' },
  { key: 'other', icon: '💬', label: 'Something else' },
];

/**
 * Report AI-made content: a question during a round, or the written note on
 * the results. Google Play requires apps that generate content with AI to let
 * people flag it from inside the app. A reported question is removed from
 * future rounds for every child; every report is kept for review.
 */
export default function ReportSheet({ visible, onClose, kind, sessionId, questionId, onReported }: {
  visible: boolean;
  onClose: () => void;
  kind: 'question' | 'note';
  sessionId: string | null | undefined;
  questionId?: string;
  onReported?: (removed: boolean) => void;
}) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // A fresh form each time it opens.
  useEffect(() => {
    if (!visible) return;
    setReason(null); setDetails(''); setState('idle'); setError(null); setRemoved(false);
  }, [visible, questionId, kind]);

  async function send() {
    if (!reason || !sessionId || state === 'sending') return;
    setState('sending'); setError(null);
    try {
      const result = await reportContent({ kind, sessionId, questionId, reason, details: details.trim() || undefined });
      setRemoved(result.removed);
      setState('sent');
      onReported?.(result.removed);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not send the report. Please try again.');
    }
  }

  const what = kind === 'question' ? 'question' : 'note';
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel="Close report">
      {state === 'sent' ? (
        <View style={styles.body}>
          <Text style={styles.bigIcon} accessible={false}>💛</Text>
          <Text style={styles.title}>Thank you for telling us</Text>
          <Text style={styles.text}>
            {removed
              ? 'We’ve taken this question out, so no child will see it again while we look into it.'
              : `We’ll look into this ${what}.`}
            {kind === 'question' ? ' You can skip it and carry on.' : ''}
          </Text>
          <Button title="Done" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.eyebrow}>FOR GROWN-UPS</Text>
          <Text style={styles.title}>Report this {what}</Text>
          <Text style={styles.text}>Little Hoot’s {kind === 'question' ? 'questions are' : 'notes are'} made with AI. If something isn’t right, let us know.</Text>
          <View style={styles.reasons} accessibilityRole="radiogroup">
            {REASONS.map(option => {
              const on = reason === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setReason(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.reason, on && styles.reasonOn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.reasonIcon} accessible={false}>{option.icon}</Text>
                  <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{option.label}</Text>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Anything else? (optional)"
            placeholderTextColor={colors.inkSoft}
            maxLength={500}
            multiline
            style={styles.input}
            accessibilityLabel="More details, optional"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={state === 'sending' ? 'Sending…' : 'Send report'} onPress={() => void send()} disabled={!reason || !sessionId || state === 'sending'} loading={state === 'sending'} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      )}
    </Sheet>
  );
}

/** The small "🚩 Report" link placed next to AI-made content. */
export function ReportLink({ onPress, label = 'Report', accessibilityLabel }: { onPress: () => void; label?: string; accessibilityLabel: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={styles.linkText}>🚩 {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing(1.5) },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.inkSoft, textAlign: 'center' },
  bigIcon: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  reasons: { gap: spacing(1) },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), minHeight: 52, paddingHorizontal: spacing(1.5), borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  reasonOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  reasonIcon: { fontSize: 20 },
  reasonText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  reasonTextOn: { color: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  input: { minHeight: 70, borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, padding: spacing(1.5), fontSize: 15, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.25), borderRadius: 12, fontSize: 14 },
  cancel: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  cancelText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingHorizontal: spacing(1.25), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  linkText: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
});
