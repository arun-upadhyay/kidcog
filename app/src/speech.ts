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
/**
 * Replaying a question used to download its audio again on every tap (twice on
 * phones: once to check it, once to play it). The server already avoids paying
 * OpenAI twice for the same text; these avoid the repeat downloads too.
 *
 * Web: the audio itself, kept as an in-memory object URL per text, so a replay
 * starts instantly with no network. Bounded, oldest dropped first.
 * Phones: which texts the server has already confirmed, so a replay skips the
 * check and downloads once.
 */
const audioCache = new Map<string, string>();
const MAX_CACHED_AUDIO = 30;
const confirmed = new Set<string>();
function cacheAudio(text: string, url: string) {
  audioCache.set(text, url);
  while (audioCache.size > MAX_CACHED_AUDIO) {
    const [oldest, oldUrl] = audioCache.entries().next().value as [string, string];
    audioCache.delete(oldest);
    URL.revokeObjectURL(oldUrl);
  }
}
/** Forget a text's audio after a playback failure, so the next tap fetches it fresh. */
function forgetAudio(text: string) {
  const url = audioCache.get(text);
  if (url) { audioCache.delete(text); URL.revokeObjectURL(url); }
  confirmed.delete(text);
}
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
  const current = player;
  player = null;
  if (current) {
    // Pause and mute BEFORE releasing. On iPhone and Android, remove() only
    // frees the native player; it does not reliably silence audio that is
    // already playing, so moving to the next question could leave the old
    // question talking over the new one. (On web, remove() pauses by itself.)
    try { current.pause(); } catch { /* Not started yet. */ }
    try { current.volume = 0; } catch { /* Already released. */ }
    try { current.remove(); } catch { /* Already released. */ }
  }
  // Cached audio URLs are kept for replays; they are released only on eviction.
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
export async function speak(text: string, options: { voice?: 'device' | 'generated'; allowDeviceFallback?: boolean } = {}): Promise<void> {
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
  const recover = () => {
    if (options.allowDeviceFallback === false) finish(mine);
    else fallback(trimmed, mine);
  };
  const controller = new AbortController();
  request = controller;
  deadline = setTimeout(() => controller.abort(), 60_000);
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (mine !== generation) return;
    let source: string;
    const cached = Platform.OS === 'web' ? audioCache.get(trimmed) : undefined;
    if (cached) {
      source = cached; // replay: no network at all
    } else if (Platform.OS !== 'web' && confirmed.has(trimmed)) {
      source = speakUrl(trimmed); // replay: the player downloads once, no separate check
    } else {
      const response = await fetch(speakUrl(trimmed), { signal: controller.signal });
      if (!response.ok) throw new Error(`Speech request failed (${response.status}).`);
      if (Platform.OS === 'web') {
        const blob = await response.blob();
        if (mine !== generation) return;
        source = URL.createObjectURL(blob);
        cacheAudio(trimmed, source);
      } else {
        // The native player's stream uses the server's completed audio cache.
        source = speakUrl(trimmed);
        confirmed.add(trimmed);
      }
    }
    if (mine !== generation) return;
    clearDeadline();
    request = null;
    const next = createAudioPlayer({ uri: source });
    player = next;
    // A failed or stalled player must not leave the button locked forever.
    deadline = setTimeout(() => {
      if (mine === generation) { lastSpeechError = 'Audio took too long to load.'; forgetAudio(trimmed); recover(); }
    }, 15_000);
    subscription = next.addListener('playbackStatusUpdate', status => {
      if (mine !== generation) return;
      if (status.error) {
        lastSpeechError = status.error;
        forgetAudio(trimmed);
        recover();
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
    recover();
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
