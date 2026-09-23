import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { API_BASE_URL } from './api';

export type SpeechState = 'idle' | 'loading' | 'playing';
let state: SpeechState = 'idle';
const listeners = new Set<() => void>();
function setState(next: SpeechState) {
  state = next;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function useSpeechState(): SpeechState {
  return useSyncExternalStore(subscribe, () => state, () => 'idle');
}

let player: AudioPlayer | null = null;
let subscription: { remove(): void } | null = null;
let objectUrl: string | null = null;
let request: AbortController | null = null;
let deadline: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
export let lastSpeechError: string | null = null;

function clearDeadline() {
  if (deadline) clearTimeout(deadline);
  deadline = null;
}
function releasePlayer() {
  subscription?.remove();
  subscription = null;
  try { player?.remove(); } catch { /* Already released. */ }
  player = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}
function finish(mine: number) {
  if (mine !== generation) return;
  clearDeadline();
  releasePlayer();
  request = null;
  setState('idle');
}
function fallback(text: string, mine: number) {
  if (mine !== generation) return;
  clearDeadline();
  releasePlayer();
  request = null;
  setState('playing');
  // Recovery if a platform never reports an audio completion callback.
  deadline = setTimeout(() => { if (mine === generation) stopSpeaking(); }, 300_000);
  try {
    Speech.speak(text, {
      rate: 0.85, pitch: 1.05, language: 'en',
      onDone: () => finish(mine), onStopped: () => finish(mine),
      onError: () => finish(mine),
    });
  } catch { finish(mine); }
}
export function speakUrl(text: string): string {
  return `${API_BASE_URL}/api/speak?text=${encodeURIComponent(text)}`;
}

/** Tap-only playback. The synchronous lock rejects even same-frame double taps. */
export async function speak(text: string, options: { voice?: 'device' | 'generated' } = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || state !== 'idle') return;
  const mine = ++generation;
  setState('loading');
  lastSpeechError = null;
  if (options.voice === 'device') {
    // Web speech begins inside the click gesture, without fetching or decoding audio.
    if (Platform.OS !== 'web') {
      try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); }
      catch { /* Still try the installed voice. */ }
    }
    if (mine === generation) fallback(trimmed, mine);
    return;
  }
  const controller = new AbortController();
  request = controller;
  deadline = setTimeout(() => controller.abort(), 20_000);
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (mine !== generation) return;
    const response = await fetch(speakUrl(trimmed), { signal: controller.signal });
    if (!response.ok) throw new Error(`Speech request failed (${response.status}).`);
    let source: string;
    if (Platform.OS === 'web') {
      const blob = await response.blob();
      if (mine !== generation) return;
      source = URL.createObjectURL(blob);
      objectUrl = source;
    } else {
      // The native player's stream uses the server's completed audio cache.
      source = speakUrl(trimmed);
    }
    if (mine !== generation) return;
    clearDeadline();
    request = null;
    const next = createAudioPlayer({ uri: source });
    player = next;
    // A failed or stalled player must not leave the button locked forever.
    deadline = setTimeout(() => {
      if (mine === generation) fallback(trimmed, mine);
    }, 15_000);
    subscription = next.addListener('playbackStatusUpdate', status => {
      if (mine !== generation) return;
      if (status.error) {
        lastSpeechError = status.error;
        fallback(trimmed, mine);
      } else if (status.didJustFinish) {
        finish(mine);
      } else if (status.playing && state === 'loading') {
        clearDeadline();
        setState('playing');
        deadline = setTimeout(() => { if (mine === generation) stopSpeaking(); }, 300_000);
      }
    });
    next.play();
  } catch (err) {
    if (mine !== generation) return; // Cancelled navigation must never start a fallback.
    lastSpeechError = err instanceof Error ? err.message : String(err);
    fallback(trimmed, mine);
  }
}

/** Cancel pending audio and playback on navigation or when recording begins. */
export function stopSpeaking(): void {
  generation++;
  request?.abort();
  request = null;
  clearDeadline();
  releasePlayer();
  void Speech.stop().catch(() => {});
  setState('idle');
}
