import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Sheet from './Sheet';
import Button from './Button';
import { colors, spacing } from '../theme';
import { DELETE_ACCOUNT_PATH, PRIVACY_PATH, openPublicPage } from '../legal';

/**
 * "About KidCog": everything a parent should know, kept off the main screens so
 * they stay simple. Shown once on first use, then available from the home
 * screen's ⓘ button, the consent line's "Learn more" and the ☰ menu.
 */
const SECTIONS = [
  {
    icon: '🧠',
    title: 'A practice activity',
    body: 'KidCog is for playful thinking practice. It is not an IQ test or a clinical assessment, and it never gives an IQ score, a percentile or a comparison with other children. Each result is a snapshot of one session.',
  },
  {
    icon: '👂',
    title: 'How it works',
    body: 'Tap the speaker to hear a question. Your child answers by tapping a picture or by speaking. For young children, scores are kept for you behind a quick grown-up check.',
  },
  {
    icon: '🔒',
    title: 'Privacy',
    body: 'Spoken and written answers are sent to an AI service (OpenAI) to be turned into text and scored. Use a first name or nickname only, and please don’t include your child’s full name, school or address in answers. Results are saved privately to your parent account, and you can delete the account at any time from the ☰ menu.',
  },
] as const;

export default function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel="Close About KidCog">
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.owl}>🦉</Text>
            <Text style={styles.title}>About KidCog</Text>
            {SECTIONS.map(section => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionBody}>{section.body}</Text>
                </View>
              </View>
            ))}
            <View style={styles.links}>
              <Pressable onPress={() => openPublicPage(PRIVACY_PATH)} accessibilityRole="link" hitSlop={6}><Text style={styles.link}>Privacy policy</Text></Pressable>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={() => openPublicPage(DELETE_ACCOUNT_PATH)} accessibilityRole="link" hitSlop={6}><Text style={styles.link}>Deleting your data</Text></Pressable>
            </View>
            <View style={{ marginTop: spacing(2) }}>
              <Button title="Got it" onPress={onClose} />
            </View>
          </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing(1) },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing(1), marginTop: spacing(2), flexWrap: 'wrap' },
  link: { fontSize: 14, fontWeight: '800', color: colors.primary, textDecorationLine: 'underline' },
  dot: { color: colors.inkSoft },
  owl: { fontSize: 40, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: '#6B4BB0', textAlign: 'center', marginBottom: spacing(1.5) },
  section: { flexDirection: 'row', gap: spacing(1.5), paddingVertical: spacing(1.5), borderTopWidth: 1, borderTopColor: colors.line },
  sectionIcon: { fontSize: 26, width: 34, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#513A27' },
  sectionBody: { fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: 2 },
});
