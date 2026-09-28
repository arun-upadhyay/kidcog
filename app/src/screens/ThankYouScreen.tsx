import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Owl from '../components/Owl';
import Button from '../components/Button';
import { colors, spacing, column, GUTTER } from '../theme';

/** The address Stripe and PayPal send parents back to after a support payment. */
export const THANK_YOU_PATH = '/thank-you';

export function isThankYouPage() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && window.location.pathname.replace(/\/+$/, '') === THANK_YOU_PATH;
}

/**
 * Shown after a parent supports KidCog through Stripe or PayPal. It needs no
 * sign-in: the payment page opened in a new tab, so this may be a fresh tab.
 */
export default function ThankYouScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Owl mood="happy" size={120} />
        <Text style={styles.heart} accessible={false}>💛</Text>
        <Text style={styles.title} accessibilityRole="header">Thank you so much!</Text>
        <Text style={styles.body}>
          Your support means a lot. It helps keep KidCog running and lets us keep adding new activities for curious young minds.
        </Text>
        <Text style={styles.small}>Your payment receipt is on its way to your email.</Text>
        <View style={styles.action}>
          <Button title="Back to KidCog" onPress={onContinue} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: GUTTER, paddingVertical: spacing(5) },
  card: { ...column, backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1.5, borderColor: colors.line, padding: spacing(4), alignItems: 'center', gap: spacing(1.5) },
  heart: { fontSize: 34, marginTop: -spacing(1) },
  title: { fontSize: 28, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  small: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing(1.5) },
});
