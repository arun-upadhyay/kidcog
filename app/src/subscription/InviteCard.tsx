import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Owl from '../components/Owl';
import { colors, spacing, type } from '../theme';
import { useSubscription } from './SubscriptionProvider';

/**
 * The invite to become an early supporter, on the parent's "Who's playing
 * today?" page. Only appears once the family has clearly used KidCog (the
 * server decides: entitlement.canSubscribe), never on a child's screen, and
 * "Not now" hides it on this device for a few days.
 */
const HIDE_KEY = 'kidcog.inviteHiddenUntil.v1';
const HIDE_DAYS = 3;

export default function InviteCard() {
  const { entitlement, openPlans } = useSubscription();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    void AsyncStorage.getItem(HIDE_KEY).then(until => setHidden(Number(until) > Date.now())).catch(() => setHidden(false));
  }, []);
  if (!entitlement.enabled || !entitlement.canSubscribe || entitlement.status === 'premium' || hidden) return null;
  const { activitiesCompleted, playRounds } = entitlement.usage;
  const notNow = () => {
    setHidden(true);
    void AsyncStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000)).catch(() => {});
  };
  const free = entitlement.status === 'free';
  return (
    <View style={styles.card} testID="invite-card">
      <View style={styles.row}>
        <Owl mood="happy" size={56} still />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.label}>FOR GROWN-UPS</Text>
          <Text style={styles.title}>{free ? 'Thanks for exploring KidCog!' : 'Your family is loving KidCog! 🎉'}</Text>
        </View>
      </View>
      <Text style={type.body}>
        {activitiesCompleted + playRounds > 0 ? `You’ve finished ${activitiesCompleted} thinking ${activitiesCompleted === 1 ? 'activity' : 'activities'} and ${playRounds} Play Zone ${playRounds === 1 ? 'game' : 'games'}. ` : ''}
        {free
          ? `Become an early supporter for ${entitlement.plan.price} to unlock everything again and help KidCog grow.`
          : `Become an early supporter for ${entitlement.plan.price} to keep everything unlocked and help KidCog grow.`}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={openPlans} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
          <Text style={styles.primaryText}>See the early-supporter plan</Text>
        </Pressable>
        <Pressable onPress={notNow} accessibilityRole="button" style={styles.secondary}><Text style={styles.secondaryText}>Not now</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderRadius: 22, borderWidth: 2, borderColor: '#B9D8CC', padding: spacing(2), gap: spacing(1.25) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
  title: { fontSize: 19, fontWeight: '900', color: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing(1) },
  primary: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: spacing(1.25), paddingHorizontal: spacing(2) },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(1) },
  secondaryText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
