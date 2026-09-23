import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { API_BASE_URL } from './api';

/**
 * Reading questions aloud.
 *
 * For the 4-7 band this is not a convenience — it is how the child receives the
 * question at all, since most children that age cannot read a sentence
 * reliably. So the quality of the voice is a functional concern, not a polish
 * one: a flat robotic delivery is harder for a small child to follow.
 *
 * The audio comes from OpenAI via the server, which streams it as plain mp3 at
 * a URL. The device's own synthesiser stays as a fallback, because a child who
 * cannot read must still be able to hear the question when the network is down
 * or speech generation fails.
 */

let player: AudioPlayer | null = null;
let generation = 0;

/** Play through the phone's speaker even when the ringer switch is silenced. */
let audioModeReady: Promise<void> | null = null;
function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // Not fatal: audio may still play, just not in silent mode.
    });
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
 *
 * Calling it again cancels whatever was playing: two questions talking over
 * each other is worse than either alone.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Guards against a slow request for an earlier question arriving after the
  // child has already moved on.
  const mine = ++generation;

  stopSpeaking();
  await ensureAudioMode();
  if (mine !== generation) return;

  try {
    const next = createAudioPlayer({ uri: speakUrl(trimmed) });
    if (mine !== generation) {
      next.remove();
      return;
    }
    player = next;
    next.play();
  } catch {
    // Network down, speech generation failed, audio unavailable — the child
    // still needs to hear the question, so fall back to the device voice.
    if (mine === generation) speakWithDevice(trimmed);
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
