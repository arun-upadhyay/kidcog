import { AppState, Platform } from 'react-native';

/** One synchronous audio gate for tab switches, window blur and native backgrounding. */
const web = Platform.OS === 'web' && typeof document !== 'undefined';
let focused = web ? document.visibilityState !== 'hidden' && document.hasFocus() : AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
const listeners = new Set<(active: boolean) => void>();
function update(active: boolean) {
  if (focused === active) return;
  focused = active;
  listeners.forEach(listener => listener(active));
}
if (web) {
  window.addEventListener('blur', () => update(false));
  window.addEventListener('focus', () => update(document.visibilityState !== 'hidden'));
  document.addEventListener('visibilitychange', () => update(document.visibilityState !== 'hidden' && document.hasFocus()));
} else {
  AppState.addEventListener('change', state => update(state === 'active'));
  if (Platform.OS === 'android') {
    AppState.addEventListener('blur', () => update(false));
    AppState.addEventListener('focus', () => update(AppState.currentState === 'active'));
  }
}
export const isAudioFocused = () => focused;
export function subscribeAudioFocus(listener: (active: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
