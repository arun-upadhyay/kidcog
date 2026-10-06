/**
 * Animal sounds. These functions never substitute a spoken imitation for an
 * animal recording: callers can use hasRecording() to decide whether to show
 * a sound control.
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
import type { Animal } from './animals';

const RECORDINGS: Record<string, number> = {
  dog: require('../../assets/animal-sounds/dog.wav'),
  cat: require('../../assets/animal-sounds/cat.wav'),
  cow: require('../../assets/animal-sounds/cow.mp3'),
  pig: require('../../assets/animal-sounds/pig.mp3'),
  sheep: require('../../assets/animal-sounds/sheep.mp3'),
  horse: require('../../assets/animal-sounds/horse.wav'),
  hen: require('../../assets/animal-sounds/hen.mp3'),
  rooster: require('../../assets/animal-sounds/rooster.wav'),
  duck: require('../../assets/animal-sounds/duck.wav'),
  goat: require('../../assets/animal-sounds/goat.wav'),
  mouse: require('../../assets/animal-sounds/mouse.wav'),
  lion: require('../../assets/animal-sounds/lion.wav'),
  bear: require('../../assets/animal-sounds/bear.mp3'),
  wolf: require('../../assets/animal-sounds/wolf.wav'),
  snake: require('../../assets/animal-sounds/snake.wav'),
  frog: require('../../assets/animal-sounds/frog.mp3'),
  owl: require('../../assets/animal-sounds/owl.wav'),
  dove: require('../../assets/animal-sounds/dove.wav'),
  cricket: require('../../assets/animal-sounds/cricket.wav'),
  mosquito: require('../../assets/animal-sounds/mosquito.wav'),
};

export const hasRecording = (key: string) => key in RECORDINGS;

const players = new Map<string, AudioPlayer>();
let activePlayer: AudioPlayer | null = null;
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
    if (activePlayer && activePlayer !== player) {
      try { activePlayer.pause(); } catch { /* It may already be stopped. */ }
      activePlayer.seekTo(0).catch(() => {});
    }
    player.seekTo(0).catch(() => {});
    player.play();
    activePlayer = player;
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

/** Play the animal's real call. False means the UI should not offer sound. */
export function playAnimal(animal: Animal): boolean {
  return playRecording(animal.key);
}
