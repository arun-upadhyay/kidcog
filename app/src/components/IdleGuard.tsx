import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import Sheet from './Sheet';
import Button from './Button';
import Owl from './Owl';
import { IDLE_LIMIT_MS, IDLE_WARNING_MS, idleMinutes, lastActivity, markActive, rememberIdleSignOut } from '../auth/idle';
import { colors, spacing } from '../theme';

const CHECK_EVERY_MS = 5 * 1000;
const WEB_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Wraps the signed-in app. Any tap, click, key press or scroll counts as
 * activity (on this device or in another tab). After IDLE_LIMIT_MS without
 * any, the parent is signed out; two minutes before, a "Still there?" card
 * offers to stay signed in. Timers pause while the app is in the background,
 * so the check also runs whenever the app or tab comes back into view.
 */
export default function IdleGuard({ signedInAt, onTimeout, children }: {
  signedInAt?: string | null;
  onTimeout: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const enabled = IDLE_LIMIT_MS > 0;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const done = useRef(false);

  const check = useCallback(async () => {
    if (!enabled || done.current) return;
    const idleFor = Date.now() - await lastActivity(signedInAt);
    if (idleFor >= IDLE_LIMIT_MS) {
      done.current = true;
      setSecondsLeft(null);
      await rememberIdleSignOut();
      await onTimeout();
    } else if (idleFor >= IDLE_LIMIT_MS - IDLE_WARNING_MS) {
      setSecondsLeft(Math.max(1, Math.ceil((IDLE_LIMIT_MS - idleFor) / 1000)));
    } else {
      setSecondsLeft(null);
    }
  }, [enabled, signedInAt, onTimeout]);

  useEffect(() => {
    if (!enabled) return;
    void check(); // a reopened app may already be past the limit
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    let removeWeb = () => {};
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onActivity = () => markActive();
      const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
      WEB_EVENTS.forEach(name => window.addEventListener(name, onActivity, { capture: true, passive: true }));
      document.addEventListener('visibilitychange', onVisible);
      removeWeb = () => {
        WEB_EVENTS.forEach(name => window.removeEventListener(name, onActivity, { capture: true }));
        document.removeEventListener('visibilitychange', onVisible);
      };
    }
    return () => { clearInterval(timer); appState.remove(); removeWeb(); };
  }, [enabled, check]);

  // The countdown ticks every second while the warning is up.
  const warning = secondsLeft !== null;
  useEffect(() => {
    if (!warning) return;
    const tick = setInterval(() => setSecondsLeft(s => (s !== null && s > 1 ? s - 1 : s)), 1000);
    return () => clearInterval(tick);
  }, [warning]);

  const stay = useCallback(() => { markActive(true); setSecondsLeft(null); }, []);
  const noteTouch = useCallback(() => { markActive(); return false; }, []);

  const left = secondsLeft ?? 0;
  const countdown = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left} seconds`;

  return (
    // Touches are noted on the way down and never captured, so every button still works.
    <View style={styles.fill} onStartShouldSetResponderCapture={noteTouch} onMoveShouldSetResponderCapture={noteTouch}>
      {children}
      <Sheet visible={warning} onClose={stay} closeLabel="Stay signed in">
        <View style={styles.body}>
          <Owl mood="idle" size={84} />
          <Text style={styles.title}>Still there?</Text>
          <Text style={styles.text}>
            Nothing has happened for a while, so Little Hoot will sign you out in <Text style={styles.count}>{countdown}</Text> to keep your family’s account safe.
          </Text>
          <View style={styles.actions}>
            <Button title="Stay signed in" onPress={stay} />
            <Button title="Sign out now" variant="secondary" onPress={() => { done.current = true; setSecondsLeft(null); void onTimeout(); }} />
          </View>
          <Text style={styles.small}>This happens after {idleMinutes()} without any taps or clicks.</Text>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { alignItems: 'center', gap: spacing(1.5) },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 23, color: colors.inkSoft, textAlign: 'center' },
  count: { fontWeight: '900', color: colors.ink },
  actions: { alignSelf: 'stretch', gap: spacing(1) },
  small: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
});
