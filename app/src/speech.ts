import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { API_BASE_URL } from './api';

/**
 * Reading text aloud.
 *
 * For the 4-7 band this is not a convenience — it is how the child receives
 * the question at all, since most children that age cannot read a sentence
 * reliably. So the quality of the voice is a functional concern: a flat
 * robotic delivery is harder for a small child to follow.
 *
 * Audio comes from OpenAI via the server. The device's own synthesiser stays
 * as a fallback, because a child who cannot read must still be able to hear
 * the question when the network is down or generation fails.
 *
 * The fetch-before-play below is the important part. Handing a URL straight to
 * the player looks simpler, but the player loads it asynchronously and a failed
 * load is silent — no exception to catch, so the fallback never fires and the
 * child just gets nothing. Checking the response first means a failure is a
 * value we can act on rather than an absence we cannot see.
 */

let player: AudioPlayer | null = null;
let generation = 0;

/** Surfaced so a caller can log or show why the good voice was unavailable. */
export let lastSpeechError: string | null = null;

let audioModeReady: Promise<void> | null = null;
function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    // Play through the speaker even when the ringer switch is silenced —
    // otherwise a muted phone means a child hears nothing and nobody knows why.
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }
  return audioModeReady;
}

function speakWithDevice(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { rate: 0.85, pitch: 1.05, language: 'en' });
  } catch {
    // A device with no installed voice must still leave the app usable.
  }
}

function releasePlayer(): void {
  if (player) {
    try {
      player.remove();
    } catch {
      // already gone
    }
    player = null;
  }
}

export function speakUrl(text: string): string {
  return `${API_BASE_URL}/api/speak?text=${encodeURIComponent(text)}`;
}

/**
 * Speak `text`. Resolves once playback has started, not once it has finished.
 * Calling it again cancels whatever was playing — two things talking over each
 * other is worse than either alone.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Guards against a slow request for an earlier question arriving after the
  // child has already moved on.
  const mine = ++generation;
  stopSpeaking();
  generation = mine;

  await ensureAudioMode();
  if (mine !== generation) return;

  let source: string;
  try {
    const response = await fetch(speakUrl(trimmed));
    if (mine !== generation) return;

    if (!response.ok) {
      // Read the server's explanation rather than reporting a bare status.
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.detail) detail = String(body.detail);
        else if (body?.error) detail = String(body.error);
      } catch {
        // non-JSON error body; the status will do
      }
      throw new Error(detail);
    }

    if (Platform.OS === 'web') {
      // Play the bytes we already have rather than fetching them twice.
      const blob = await response.blob();
      source = URL.createObjectURL(blob);
    } else {
      // Native players stream a URL happily, and the server caches the audio,
      // so the second request is cheap.
      source = speakUrl(trimmed);
    }
  } catch (err) {
    lastSpeechError = err instanceof Error ? err.message : String(err);
    console.warn(`[speech] falling back to the device voice: ${lastSpeechError}`);
    if (mine === generation) speakWithDevice(trimmed);
    return;
  }

  if (mine !== generation) {
    if (Platform.OS === 'web') URL.revokeObjectURL(source);
    return;
  }

  try {
    const next = createAudioPlayer({ uri: source });
    player = next;
    next.play();
    lastSpeechError = null;
  } catch (err) {
    lastSpeechError = err instanceof Error ? err.message : String(err);
    console.warn(`[speech] playback failed, using the device voice: ${lastSpeechError}`);
    speakWithDevice(trimmed);
  }
}

export function stopSpeaking(): void {
  generation++;
  releasePlayer();
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
