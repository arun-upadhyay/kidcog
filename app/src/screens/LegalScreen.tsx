import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Owl from '../components/Owl';
import Button from '../components/Button';
import { colors, spacing, column, GUTTER } from '../theme';
import { COMPANY, CONTACT_EMAIL, DELETE_ACCOUNT_PATH, POLICY_UPDATED, PRIVACY_PATH, WEB_URL } from '../legal';

type Section = { title: string; paragraphs?: string[]; bullets?: string[] };

/**
 * KidCog's privacy policy. Keep it true to what the code does: if a new kind
 * of data or a new service is added, update this page in the same change.
 */
const PRIVACY: Section[] = [
  { title: 'Who we are', paragraphs: [`Little Hoot is made by ${COMPANY} ("we", "us"). Little Hoot is a playful thinking and learning activity for children aged about 4 to 7, used together with a parent or guardian. Accounts belong to parents and guardians; children do not have their own accounts and do not sign in.`] },
  { title: 'What we collect', bullets: [
    'Parent account: your email address, and your name and profile picture if you sign in with Google, Facebook or Apple. If you use email sign-in, your password is stored securely (hashed) by our sign-in provider; we never see it.',
    'About each child you add: a nickname or first name you choose, their age (4–7) and a picture you pick from our built-in animal pictures. Please use a nickname or first name only.',
    'Activity results: the questions your child was given, their answers (taps, and spoken answers turned into text), scores, and the short written note for you.',
    'Spoken answers: when your child taps the microphone, a short voice recording is sent to our server to be turned into text. We do not keep the recording after it has been turned into text.',
    'Reports you send us about content in the app, and messages you send to us.',
    'On your device only: stars, stickers, game levels and settings such as sound effects. These stay on your device and are not sent to us.',
  ] },
  { title: 'What we do not do', bullets: [
    'No advertising and no ad tracking.',
    'No analytics or tracking tools, and no selling or renting of personal information.',
    'We do not ask children for their full name, school, address, photos or contact details.',
    'Little Hoot is not an IQ test or a clinical assessment, and it never gives an IQ score, percentile or comparison with other children.',
  ] },
  { title: 'How we use information', bullets: [
    'To run the activities, score answers and show results to you.',
    'To write the short note for you after each round.',
    'To keep your account secure, to fix problems, and to review content that parents report.',
    'To reply when you contact us.',
  ] },
  { title: 'Service providers we use', paragraphs: ['We share information only with companies that help us run Little Hoot, and only what they need:'], bullets: [
    'OpenAI: turns spoken answers into text, checks spoken and written answers, writes the note for you (using your child’s nickname and age), and reads questions aloud. Under OpenAI’s API terms, this data is not used to train its models.',
    'Supabase: sign-in and our database, where accounts, child profiles and results are stored.',
    'Render and Vercel: host our server and website.',
    'Google, Facebook and Apple: only if you choose to sign in with them.',
    'Stripe and PayPal: only if you choose to make an optional support payment on our website. They handle the payment; we do not receive your card details.',
  ] },
  { title: 'Children’s privacy', paragraphs: [
    'Little Hoot is designed to be used by children with a parent or guardian. A parent creates the account and confirms consent before a child plays. We collect only what is needed for the activities, as listed above.',
    'You can review your child’s results in the app at any time, delete a child’s profile or a single result, or delete your whole account. You can also contact us to ask what we hold, to correct it, or to delete it.',
  ] },
  { title: 'How long we keep information', paragraphs: [
    'We keep your account, child profiles and results until you delete them. When you delete your account, you are signed out and it is blocked straight away, and everything is permanently erased 30 days later (this short delay lets us restore an account deleted by mistake). Reports about content are kept for review without your account details once your account is erased.',
  ] },
  { title: 'Security', paragraphs: ['Information is sent over encrypted connections (HTTPS) and stored with access limited to our server. No system is perfectly secure, but we work to protect your information.'] },
  { title: 'Your choices and rights', paragraphs: [
    `Depending on where you live, you may have rights to access, correct, delete or get a copy of your information. Use the options in the app, or email us at ${CONTACT_EMAIL}. We will reply within 30 days.`,
  ] },
  { title: 'Changes to this policy', paragraphs: ['If we change this policy, we will update the date below and, for important changes, tell you in the app.'] },
  { title: 'Contact us', paragraphs: [`${COMPANY} · ${CONTACT_EMAIL}`] },
];

const DELETE: Section[] = [
  { title: 'Delete in the app (quickest)', bullets: [
    'Open Little Hoot and sign in.',
    'Tap the ☰ menu at the top left.',
    'Tap “Delete account” at the bottom, type DELETE, and confirm.',
  ] },
  { title: 'Or ask us by email', paragraphs: [`Email ${CONTACT_EMAIL} from the email address you use for Little Hoot, with the subject “Delete my Little Hoot account”. We will delete it within 30 days and confirm by email.`] },
  { title: 'What is deleted', bullets: [
    'Your parent account and sign-in details.',
    'All child profiles (nicknames, ages, pictures).',
    'All results: questions, answers, scores and notes.',
  ] },
  { title: 'When', paragraphs: ['You are signed out and the account is blocked straight away. Everything is permanently erased 30 days later; until then we can restore it if you contact us. Stars and settings stored on your own device are removed when you uninstall the app or clear the website’s data.'] },
  { title: 'What may be kept', bullets: [
    'Reports you sent about content, without any link to your account.',
    'Records of optional support payments, which Stripe or PayPal keep as required by law.',
  ] },
  { title: 'Delete only some data', paragraphs: ['You can delete a single child’s profile (and their results) from the child’s ⋯ menu on the home screen, or a single result from a child’s history, without deleting your account.'] },
];

export function isLegalPage(): 'privacy' | 'delete' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === PRIVACY_PATH ? 'privacy' : path === DELETE_ACCOUNT_PATH ? 'delete' : null;
}

export default function LegalScreen({ page, onContinue }: { page: 'privacy' | 'delete'; onContinue: () => void }) {
  const sections = page === 'privacy' ? PRIVACY : DELETE;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroBubble}><Owl mood="idle" size={44} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>LITTLE HOOT</Text>
          <Text style={styles.title} accessibilityRole="header">{page === 'privacy' ? 'Privacy policy' : 'Delete your Little Hoot account'}</Text>
          <Text style={styles.updated}>{page === 'privacy' ? `Last updated ${POLICY_UPDATED}` : 'How to delete your account and data'}</Text>
        </View>
      </View>
      {sections.map(section => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{section.title}</Text>
          {section.paragraphs?.map((p, i) => <Text key={i} style={styles.body}>{p}</Text>)}
          {section.bullets?.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>{page === 'delete' && section.title.startsWith('Delete in the app') ? `${i + 1}.` : '•'}</Text>
              <Text style={[styles.body, { flex: 1 }]}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
      <Pressable onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)} accessibilityRole="link" style={styles.mail}>
        <Text style={styles.mailText}>✉️ {CONTACT_EMAIL}</Text>
      </Pressable>
      <Text style={styles.small}>
        {page === 'privacy' ? `See also: how to delete your account — ${WEB_URL}${DELETE_ACCOUNT_PATH}` : `See also: privacy policy — ${WEB_URL}${PRIVACY_PATH}`}
      </Text>
      <Button title="Go to Little Hoot" variant="secondary" onPress={onContinue} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF8EF' },
  content: { padding: GUTTER, paddingBottom: spacing(6), gap: spacing(1.5), ...column },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#EEE9FF', borderRadius: 24, padding: spacing(2), borderWidth: 2, borderColor: '#CABAF0', marginTop: spacing(1) },
  heroBubble: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#6D5B91' },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '900', color: '#4E3590' },
  updated: { fontSize: 13, color: '#6D5B91', marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 2, borderColor: '#EEDFCB', padding: spacing(2), gap: spacing(1) },
  heading: { fontSize: 17, fontWeight: '900', color: '#513A27' },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  bulletRow: { flexDirection: 'row', gap: spacing(1) },
  bullet: { fontSize: 15, lineHeight: 23, fontWeight: '900', color: colors.primary, minWidth: 16 },
  mail: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(2) },
  mailText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  small: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, textAlign: 'center' },
});
