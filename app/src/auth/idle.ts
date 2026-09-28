import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sign the parent out after a stretch with no taps, clicks or key presses,
 * so a shared or borrowed device does not stay signed in.
 *
 * EXPO_PUBLIC_IDLE_LOGOUT_MINUTES changes the limit (default 30; 0 turns it off).
 */
const configured = Number(process.env.EXPO_PUBLIC_IDLE_LOGOUT_MINUTES ?? '30');
export const IDLE_LIMIT_MS = (Number.isFinite(configured) && configured >= 0 ? configured : 30) * 60 * 1000;
/** "30 minutes", "1 minute": for messages. */
export function idleMinutes() {
  const n = Math.round(IDLE_LIMIT_MS / 60000);
  return `${n} minute${n === 1 ? '' : 's'}`;
}

/** A "Still there?" warning shows this long before the sign-out. */
export const IDLE_WARNING_MS = Math.min(2 * 60 * 1000, IDLE_LIMIT_MS / 2);

const LAST_ACTIVE_KEY = 'kidcog.lastActive.v1';
const NOTICE_KEY = 'kidcog.signedOutIdle.v1';
/** Saving on every tap would be wasteful; this often is plenty. */
const SAVE_EVERY_MS = 10 * 1000;

let lastActive = 0;
let lastSaved = 0;

/** Call on any sign of a person using the app. Cheap enough to call on every event. */
export function markActive(force = false) {
  const now = Date.now();
  lastActive = now;
  if (!force && now - lastSaved < SAVE_EVERY_MS) return;
  lastSaved = now;
  // Saved so a reopened app (or another browser tab) knows when the app was last used.
  void AsyncStorage.setItem(LAST_ACTIVE_KEY, String(now)).catch(() => {});
}

/**
 * The latest activity seen here, in another tab, or at sign-in. Signing in
 * counts as activity, so an old timestamp left over from an earlier visit
 * never signs out a parent who has only just signed in.
 */
export async function lastActivity(signedInAt?: string | null): Promise<number> {
  let stored = 0;
  try { stored = Number(await AsyncStorage.getItem(LAST_ACTIVE_KEY)) || 0; } catch { /* storage unavailable: use memory */ }
  const signIn = signedInAt ? Date.parse(signedInAt) || 0 : 0;
  return Math.max(lastActive, stored, signIn);
}

/** Remembered until the sign-in screen shows it, even across a reload. */
export async function rememberIdleSignOut() {
  lastActive = 0; lastSaved = 0;
  try {
    await AsyncStorage.multiRemove([LAST_ACTIVE_KEY]);
    await AsyncStorage.setItem(NOTICE_KEY, '1');
  } catch { /* the notice is a nicety */ }
}

/** True once, right after an automatic sign-out. */
export async function takeIdleSignOutNotice(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTICE_KEY);
    if (value) await AsyncStorage.removeItem(NOTICE_KEY);
    return value === '1';
  } catch { return false; }
}

/** A manual sign-in or sign-out starts fresh. */
export async function clearIdleNotice() {
  try { await AsyncStorage.removeItem(NOTICE_KEY); } catch { /* ignore */ }
}
