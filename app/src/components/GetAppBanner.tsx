import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

/**
 * "Get the KidCog app" bar for people visiting the website on a phone, like
 * the ones banks and shops show. iPhone/iPad visitors get the App Store link,
 * Android visitors the Google Play link; computers see nothing.
 *
 * Each store link comes from an env var (EXPO_PUBLIC_APP_STORE_URL,
 * EXPO_PUBLIC_PLAY_STORE_URL), so the bar only appears once the app is
 * actually live in that store. Closing it hides it for 30 days on that browser.
 */
const APP_STORE_URL = (process.env.EXPO_PUBLIC_APP_STORE_URL ?? '').trim();
const PLAY_STORE_URL = (process.env.EXPO_PUBLIC_PLAY_STORE_URL ?? '').trim();
const DISMISS_KEY = 'kidcog.getAppDismissedAt';
const HIDE_FOR_MS = 30 * 24 * 60 * 60 * 1000;

type Store = { url: string; label: string };

function storeForThisDevice(): Store | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac, so also check for a touch screen.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  if (ios && /^https:\/\//.test(APP_STORE_URL)) return { url: APP_STORE_URL, label: 'Free on the App Store' };
  if (android && /^https:\/\//.test(PLAY_STORE_URL)) return { url: PLAY_STORE_URL, label: 'Free on Google Play' };
  return null;
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(globalThis.localStorage?.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < HIDE_FOR_MS;
  } catch { return false; }
}

export default function GetAppBanner() {
  const [store, setStore] = useState<Store | null>(null);
  useEffect(() => { if (!recentlyDismissed()) setStore(storeForThisDevice()); }, []);
  if (!store) return null;

  const dismiss = () => {
    try { globalThis.localStorage?.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setStore(null);
  };

  return (
    <View style={styles.bar}>
      <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
      <Image source={require('../../assets/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors />
      <View style={styles.copy}>
        <Text style={styles.title}>KidCog app</Text>
        <Text style={styles.sub} numberOfLines={1}>{store.label}</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Get the KidCog app, ${store.label}`}
        onPress={() => { if (typeof window !== 'undefined') window.location.href = store.url; }}
        style={({ pressed }) => [styles.get, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.getText}>Get</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), paddingVertical: spacing(1), paddingHorizontal: spacing(1.5), backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  close: { width: 24, alignItems: 'center' },
  closeText: { fontSize: 15, color: colors.inkSoft, fontWeight: '700' },
  icon: { width: 40, height: 40, borderRadius: 10 },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  get: { paddingHorizontal: spacing(2.25), paddingVertical: spacing(0.875), borderRadius: 999, backgroundColor: '#6B4BB0' },
  getText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
