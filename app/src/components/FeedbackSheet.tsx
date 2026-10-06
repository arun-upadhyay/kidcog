import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Sheet from './Sheet';
import Button from './Button';
import { submitFeedback, type FeedbackCategory } from '../api';
import { colors, spacing, type } from '../theme';

const CATEGORIES: { key: FeedbackCategory; icon: string; label: string }[] = [
  { key: 'idea', icon: '💡', label: 'An idea' },
  { key: 'problem', icon: '🛠️', label: 'A problem' },
  { key: 'praise', icon: '💛', label: 'Something I like' },
  { key: 'other', icon: '💬', label: 'Something else' },
];

export default function FeedbackSheet({ visible, screen, onClose }: { visible: boolean; screen: string; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [allowContact, setAllowContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCategory('idea'); setRating(null); setMessage(''); setAllowContact(false); setBusy(false); setError(null); setSent(false);
  }, [visible]);

  async function send() {
    const clean = message.trim();
    setError(null);
    if (clean.length < 10) { setError('Please tell us a little more (at least 10 characters).'); return; }
    setBusy(true);
    try {
      await submitFeedback({ category, rating, message: clean, allowContact, screen });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your feedback. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose} closeLabel="Close feedback">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView style={[styles.scroll, { maxHeight: Math.max(260, height * 0.82) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          {sent ? (
            <View style={styles.success} accessibilityLiveRegion="polite">
              <View style={styles.successIcon}><Text style={styles.successEmoji}>🦉</Text></View>
              <Text style={styles.successTitle}>Thank you!</Text>
              <Text style={styles.successBody}>Your feedback helps make KidCog better for every family.</Text>
              <Button title="Done" onPress={onClose} />
            </View>
          ) : (
            <>
              <View style={styles.headingRow}>
                <View style={styles.headingIcon}><Text style={styles.headingEmoji}>💬</Text></View>
                <View style={styles.headingCopy}>
                  <Text accessibilityRole="header" style={styles.title}>Help us improve KidCog</Text>
                  <Text style={type.soft}>Ideas, problems, and happy moments are all welcome.</Text>
                </View>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close feedback" style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
              </View>

              <Text style={styles.label}>WHAT WOULD YOU LIKE TO SHARE?</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(item => {
                  const selected = category === item.key;
                  return <Pressable key={item.key} onPress={() => setCategory(item.key)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={item.label} style={({ pressed }) => [styles.category, selected && styles.categorySelected, pressed && styles.pressed]}>
                    <Text style={styles.categoryIcon}>{item.icon}</Text><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
                  </Pressable>;
                })}
              </View>

              <Text style={styles.label}>HOW IS YOUR EXPERIENCE?</Text>
              <View style={styles.ratingRow} accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map(value => <Pressable key={value} onPress={() => setRating(value)} accessibilityRole="radio" accessibilityLabel={`${value} out of 5 stars`} accessibilityState={{ selected: rating === value }} style={({ pressed }) => [styles.starButton, rating === value && styles.starSelected, pressed && styles.pressed]}><Text style={styles.star}>{rating !== null && value <= rating ? '★' : '☆'}</Text></Pressable>)}
              </View>

              <Text style={styles.label}>YOUR MESSAGE</Text>
              <TextInput
                value={message}
                onChangeText={text => { setMessage(text.slice(0, 2000)); setError(null); }}
                placeholder={category === 'problem' ? 'What happened, and what did you expect?' : 'Tell us what is on your mind…'}
                placeholderTextColor="#8A8178"
                multiline
                textAlignVertical="top"
                maxLength={2000}
                accessibilityLabel="Feedback message"
                style={styles.message}
              />
              <View style={styles.inputMeta}><Text style={styles.privacy}>🔒 Please leave out children’s names and personal details.</Text><Text style={styles.count}>{message.length}/2000</Text></View>

              <Pressable onPress={() => setAllowContact(value => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: allowContact }} style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}>
                <View style={[styles.checkbox, allowContact && styles.checkboxChecked]}><Text style={styles.checkmark}>{allowContact ? '✓' : ''}</Text></View>
                <Text style={styles.contactText}>You may contact me about this feedback at my account email.</Text>
              </Pressable>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Button title={busy ? 'Sending…' : 'Send feedback'} onPress={() => void send()} disabled={busy} loading={busy} />
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}><Text style={styles.cancelText}>Maybe later</Text></Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  keyboard: { flexShrink: 1 },
  scroll: { flexShrink: 1 },
  content: { gap: spacing(1.5), paddingBottom: spacing(0.5) },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), marginBottom: spacing(0.5) },
  headingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center' },
  headingEmoji: { fontSize: 24 }, headingCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: '900', color: colors.ink, marginBottom: 2 },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 29, lineHeight: 32, color: colors.inkSoft },
  label: { ...type.label, marginTop: spacing(0.5) },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  category: { width: '48%', flexGrow: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing(1), paddingHorizontal: spacing(1.25), borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface },
  categorySelected: { borderColor: '#7650C7', backgroundColor: '#F1ECFF' }, categoryIcon: { fontSize: 21 },
  categoryText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.ink }, categoryTextSelected: { color: '#56389A' },
  ratingRow: { flexDirection: 'row', gap: spacing(0.75) },
  starButton: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  starSelected: { borderColor: colors.happy, backgroundColor: colors.happySoft }, star: { fontSize: 25, color: '#D99A17' },
  message: { minHeight: 116, maxHeight: 190, borderWidth: 1.5, borderColor: colors.line, borderRadius: 15, backgroundColor: '#FFFCF8', color: colors.ink, fontSize: 16, lineHeight: 23, padding: spacing(1.5) },
  inputMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(1) }, privacy: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.inkSoft }, count: { fontSize: 12, color: colors.inkSoft },
  contactRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), padding: spacing(1.25), backgroundColor: colors.coolSoft, borderRadius: 13 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.cool, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxChecked: { backgroundColor: colors.cool }, checkmark: { color: '#fff', fontWeight: '900' }, contactText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.ink },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.25), borderRadius: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] }, cancel: { minHeight: 40, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.inkSoft, fontWeight: '700' },
  success: { alignItems: 'stretch', gap: spacing(1.5), paddingVertical: spacing(2) }, successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.happySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  successEmoji: { fontSize: 43 }, successTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', color: colors.ink }, successBody: { ...type.body, textAlign: 'center', marginBottom: spacing(1) },
});
