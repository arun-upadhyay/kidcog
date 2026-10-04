/**
 * Animal sounds: a real recording when we have one, otherwise the read-aloud
 * voice says it ("The lion says roar!").
 *
 * Recordings live in assets/animal-sounds/ (see CREDITS.md there for where
 * each came from and its licence). To add one: put a short mp3 named after the
 * animal's key there, add it to RECORDINGS below and to RECORDED_CALLS in
 * recordings.ts. Only use sounds you may use in an app (CC0, public domain,
 * or a licence whose credit you add to CREDITS.md).
 *
 * Animal sounds are what the activity is about, so they play even when the
 * little game sound effects are switched off in the menu.
 */
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { speak, stopSpeaking } from '../speech';
import { spokenName, withArticle, type Animal } from './animals';

const RECORDINGS: Record<string, number> = {
  cow: require('../../assets/animal-sounds/cow.mp3'),
  pig: require('../../assets/animal-sounds/pig.mp3'),
  sheep: require('../../assets/animal-sounds/sheep.mp3'),
  hen: require('../../assets/animal-sounds/hen.mp3'),
};

export const hasRecording = (key: string) => key in RECORDINGS;

const players = new Map<string, AudioPlayer>();
let audioModeSet = false;

/** Play an animal's real recording. Returns false when there is none. */
export function playRecording(key: string): boolean {
  const file = RECORDINGS[key];
  if (!file) return false;
  stopSpeaking();
  try {
    if (!audioModeSet && Platform.OS !== 'web') {
      audioModeSet = true;
      // Play even with the phone's silent switch on, like the read-aloud voice does.
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
    let player = players.get(key);
    if (!player) {
      player = createAudioPlayer(file);
      player.volume = 0.9;
      players.set(key, player);
    }
    player.seekTo(0).catch(() => {});
    player.play();
    return true;
  } catch {
    return false;
  }
}

/** Read a line aloud, cutting off anything still playing. */
export function say(text: string) {
  stopSpeaking();
  void speak(text);
}

/** "Moo!" — the recording if there is one, otherwise the voice says it. */
export function playAnimal(animal: Animal) {
  if (playRecording(animal.key)) return;
  const name = spokenName(animal);
  say(animal.says ? `The ${name} says ${animal.says}!` : `This is ${withArticle(name)}!`);
}
