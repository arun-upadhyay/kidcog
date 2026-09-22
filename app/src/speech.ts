import * as Speech from 'expo-speech';

/**
 * Reading questions aloud.
 *
 * For the 4-7 band this is not a convenience feature — it is how the child
 * receives the question at all. Most children that age cannot read a sentence
 * reliably, so without this the app is unusable without an adult narrating.
 *
 * The rate is deliberately below default. Synthesised speech at normal speed is
 * hard for young children to parse, particularly for a question they need to
 * hold in mind while choosing an answer.
 */
const RATE = 0.85;
const PITCH = 1.05;

export function speak(text: string): void {
  if (!text.trim()) return;
  try {
    // Never let two questions talk over each other.
    Speech.stop();
    Speech.speak(text, { rate: RATE, pitch: PITCH, language: 'en' });
  } catch {
    // Speech is an enhancement layer: a device with no voice installed, or a
    // browser that blocks autoplay, must still leave the app usable.
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
