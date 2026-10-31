import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Button from '../components/Button';
import Cog from '../components/Cog';
import Sheet from '../components/Sheet';
import { fetchEntitlement } from '../api';
import { colors, spacing, type } from '../theme';
import { OPEN, type Entitlement } from './entitlement';
import { purchaseAvailable, restorePurchases, startEarlySupporterPurchase } from './purchase';

/**
 * Explore first, subscribe later: holds what this family has unlocked and the
 * three pop-ups around it.
 *
 *   askGrownUp(reason)  a child reached something locked: Cog asks for a grown-up
 *   openPlans()         the early-supporter plan, always behind a parental gate
 *
 * With SUBSCRIPTIONS_ENABLED off on the server, `entitlement.enabled` is false
 * and none of this ever appears. If the server can't be reached the family
 * keeps full access.
 */
export type LockReason = 'activities' | 'game';

type Ctx = {
  entitlement: Entitlement;
  refresh: () => void;
  setEntitlement: (next: Entitlement) => void;
  askGrownUp: (reason: LockReason) => void;
  openPlans: () => void;
  /** Goes up each time Cog asks for a grown-up, so open pop-ups elsewhere can close first. */
  lockCount: number;
};
const SubscriptionContext = createContext<Ctx>({ entitlement: OPEN, refresh: () => {}, setEntitlement: () => {}, askGrownUp: () => {}, openPlans: () => {}, lockCount: 0 });
export const useSubscription = () => useContext(SubscriptionContext);

/** A gate passed in the last few minutes is not asked again. */
const GATE_TRUST_MS = 5 * 60_000;
const GAME_NAMES: Record<string, string> = { animals: 'Animal Explorer', states: 'USA Map', 'art-music': 'Art & Music', snake: 'Number Snake', bubbles: 'Bubble Pop', maze: 'Maze Runner', trace: 'Trace & Draw', dots: 'Connect the Dots', add: 'Magic Add' };

export default function SubscriptionProvider({ parentId, children }: { parentId: string | undefined; children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState<Entitlement>(OPEN);
  const [view, setView] = useState<null | 'ask' | 'gate' | 'plans'>(null);
  const [reason, setReason] = useState<LockReason>('game');
  const [lockCount, setLockCount] = useState(0);
  const gatePassedAt = useRef(0);

  const refresh = useCallback(() => {
    if (!parentId) { setEntitlement(OPEN); return; }
    void fetchEntitlement().then(setEntitlement).catch(() => {});
  }, [parentId]);
  useEffect(() => { setEntitlement(OPEN); refresh(); }, [refresh]);

  const openPlans = useCallback(() => {
    setView(Date.now() - gatePassedAt.current < GATE_TRUST_MS ? 'plans' : 'gate');
  }, []);
  const askGrownUp = useCallback((why: LockReason) => { setReason(why); setLockCount(n => n + 1); setView('ask'); }, []);
  const close = () => setView(null);

  const value = useMemo(() => ({ entitlement, refresh, setEntitlement, askGrownUp, openPlans, lockCount }), [entitlement, refresh, askGrownUp, openPlans, lockCount]);
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <Sheet visible={view === 'ask'} onClose={close}>
        <SheetBody><AskGrownUp reason={reason} entitlement={entitlement} onGrownUp={openPlans} onClose={close} /></SheetBody>
      </Sheet>
      <Sheet visible={view === 'gate'} onClose={close}>
        {view === 'gate' ? <SheetBody><ParentalGate onPass={() => { gatePassedAt.current = Date.now(); setView('plans'); }} onClose={close} /></SheetBody> : null}
      </Sheet>
      <Sheet visible={view === 'plans'} onClose={close}>
        <SheetBody><PlansSheet entitlement={entitlement} onClose={close} onChanged={refresh} /></SheetBody>
      </Sheet>
    </SubscriptionContext.Provider>
  );
}

/** Scrolls when the pop-up is taller than a small or sideways phone. */
function SheetBody({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return <ScrollView style={{ maxHeight: Math.max(240, height * 0.8) }} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

/** What a child sees on something locked: no prices, just Cog asking for a grown-up. */
function AskGrownUp({ reason, entitlement, onGrownUp, onClose }: { reason: LockReason; entitlement: Entitlement; onGrownUp: () => void; onClose: () => void }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Cog mood="happy" size={88} />
      <Text style={styles.kidTitle} accessibilityRole="header">Ask a grown-up! 👋</Text>
      <Text style={styles.kidText}>
        {reason === 'activities'
          ? 'That’s all the thinking games for today. Come back tomorrow for more — or ask a grown-up.'
          : 'This one needs a grown-up to open it. There are lots of other games to play!'}
      </Text>
      <View style={styles.stack}>
        <Button title="I’m a grown-up" onPress={onGrownUp} />
        <Button title="Keep playing" variant="secondary" onPress={onClose} />
      </View>
      {reason === 'activities' && entitlement.freeActivitiesPerDay > 0 ? (
        <Text style={type.soft}>For grown-ups: the free plan includes {entitlement.freeActivitiesPerDay} thinking activities a day. The Play Zone is still open.</Text>
      ) : null}
    </View>
  );
}

/**
 * Grown-ups only: a sum most 4–7 year olds can't do yet, typed as a number.
 * Apple's Kids Category and Google's Families policy expect a gate like this
 * in front of anything about buying.
 */
function ParentalGate({ onPass, onClose }: { onPass: () => void; onClose: () => void }) {
  const newSum = () => ({ a: 3 + Math.floor(Math.random() * 7), b: 6 + Math.floor(Math.random() * 4) });
  const [sum, setSum] = useState(newSum);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const check = () => {
    if (Number(answer.trim()) === sum.a * sum.b) { onPass(); return; }
    setWrong(true); setAnswer(''); setSum(newSum());
  };
  return (
    <View style={styles.stack}>
      <Text style={type.label}>FOR GROWN-UPS</Text>
      <Text style={type.heading} accessibilityRole="header">Please answer to continue</Text>
      <Text style={styles.sum} testID="gate-question">What is {sum.a} × {sum.b}?</Text>
      <TextInput value={answer} onChangeText={text => { setAnswer(text.replace(/[^0-9]/g, '')); setWrong(false); }} onSubmitEditing={check}
        keyboardType="number-pad" inputMode="numeric" maxLength={3} placeholder="Answer" placeholderTextColor={colors.inkSoft}
        accessibilityLabel="Answer" style={styles.input} autoFocus />
      {wrong ? <Text style={styles.warn}>Not quite — here’s another one.</Text> : null}
      <Button title="Continue" onPress={check} disabled={!answer} />
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Cancel</Text></Pressable>
    </View>
  );
}

function PlansSheet({ entitlement, onClose, onChanged }: { entitlement: Entitlement; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { usage, plan, status } = entitlement;
  const games = entitlement.premiumGames.map(key => GAME_NAMES[key] ?? key);
  const until = entitlement.exploreEndsAt ? new Date(entitlement.exploreEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
  const buy = async () => {
    setBusy(true); setMessage(null);
    const result = await startEarlySupporterPurchase().catch(() => ({ ok: false as const, reason: 'failed' as const }));
    setBusy(false);
    if (result.ok) { onChanged(); setMessage('Thank you for supporting KidCog! 💛'); }
    else if (result.reason !== 'cancelled') setMessage('That didn’t go through. Nothing was charged — please try again.');
  };
  const restore = async () => {
    const result = await restorePurchases().catch(() => ({ ok: false as const, reason: 'failed' as const }));
    if (result.ok) onChanged();
    setMessage(result.ok ? 'Your early-supporter plan is back on.' : 'No earlier purchase was found for this account.');
  };
  return (
    <View style={styles.stack}>
      <Text style={type.label}>FOR GROWN-UPS</Text>
      <Text style={styles.planName} accessibilityRole="header">⭐ {plan.name}</Text>
      <Text style={styles.price}>{plan.price}</Text>
      {status === 'premium' ? (
        <Text style={styles.thanks}>Thank you for being an early supporter! 💛 Everything is unlocked.</Text>
      ) : (
        <Text style={type.body}>KidCog is made by a small independent team. Becoming an early supporter keeps everything unlocked for your family and helps KidCog grow, with new activities and games on the way.</Text>
      )}
      {usage.activitiesCompleted + usage.playRounds > 0 ? (
        <Text style={styles.usage}>So far your family has finished {usage.activitiesCompleted} thinking {usage.activitiesCompleted === 1 ? 'activity' : 'activities'} and {usage.playRounds} Play Zone {usage.playRounds === 1 ? 'game' : 'games'}.</Text>
      ) : null}
      <View style={styles.perks}>
        {['Unlimited thinking activities every day', 'A written note for grown-ups after each round', games.length ? `Every Play Zone game, including ${games.join(', ')}` : 'Every Play Zone game', 'New activity packs as they arrive'].map(perk => (
          <Text key={perk} style={type.body}>✓ {perk}</Text>
        ))}
      </View>
      {status === 'exploring' || status === 'invited' ? <Text style={type.soft}>Everything is open for you{until ? ` until ${until}` : ''}. After that, KidCog stays free with the Play Zone basics and {entitlement.freeActivitiesPerDay} thinking activities a day.</Text> : null}
      {status === 'free' ? <Text style={type.soft}>You’re on the free plan: the Play Zone basics and {entitlement.freeActivitiesPerDay} thinking activities a day. Everything your child has earned stays.</Text> : null}
      {status !== 'premium' ? (
        purchaseAvailable
          ? <Button title={`Become an early supporter · ${plan.price}`} onPress={() => void buy()} loading={busy} />
          : <View style={styles.soon}><Text style={styles.soonText}>Early-supporter sign-up opens soon. Thank you for your patience!</Text></View>
      ) : null}
      {message ? <Text style={styles.thanks} accessibilityLiveRegion="polite">{message}</Text> : null}
      {purchaseAvailable ? (
        <>
          <Text style={type.soft}>Renews each month until cancelled. Cancel any time in your App Store, Google Play or account settings.</Text>
          <Pressable onPress={() => void restore()} accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Restore purchases</Text></Pressable>
        </>
      ) : null}
      <Pressable onPress={onClose} accessibilityRole="button" style={styles.link}><Text style={styles.linkText}>Close</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing(1.5) },
  stack: { alignSelf: 'stretch', gap: spacing(1.25) },
  kidTitle: { fontSize: 26, fontWeight: '900', color: '#4E3590', textAlign: 'center' },
  kidText: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sum: { fontSize: 28, fontWeight: '900', color: colors.accent },
  input: { minHeight: 52, borderWidth: 2, borderColor: colors.line, borderRadius: 14, paddingHorizontal: spacing(1.5), fontSize: 22, color: colors.ink, backgroundColor: colors.surface },
  warn: { color: colors.warn, fontWeight: '700' },
  link: { alignSelf: 'center', minHeight: 40, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  planName: { fontSize: 22, fontWeight: '900', color: colors.accent },
  price: { fontSize: 30, fontWeight: '900', color: colors.ink },
  usage: { fontSize: 15, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: 12, padding: spacing(1.25) },
  perks: { gap: spacing(0.5) },
  thanks: { fontSize: 16, fontWeight: '800', color: colors.go },
  soon: { backgroundColor: colors.happySoft, borderRadius: 14, padding: spacing(1.5) },
  soonText: { fontSize: 15, fontWeight: '800', color: '#7A4E08', textAlign: 'center' },
});
