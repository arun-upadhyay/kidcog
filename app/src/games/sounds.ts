/**
 * Little sound effects for the games: a happy chime, a soft "oops", a pop.
 *
 * Kept quiet and short so they cheer rather than startle, and they can be
 * switched off from the menu (remembered on this device). Any playback
 * problem is ignored: a missing sound must never interrupt a game.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const FILES = {
  yay: require('../../assets/sounds/yay.wav'),
  oops: require('../../assets/sounds/oops.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  tada: require('../../assets/sounds/tada.wav'),
} as const;
export type SoundName = keyof typeof FILES;

const SOUND_KEY = 'kidcog.soundEffects.v1';
let enabled = true;
const listeners = new Set<(on: boolean) => void>();
AsyncStorage.getItem(SOUND_KEY).then(value => { if (value === 'off') setEnabled(false, false); }).catch(() => {});

function setEnabled(on: boolean, save = true) {
  enabled = on;
  listeners.forEach(listener => listener(on));
  if (save) AsyncStorage.setItem(SOUND_KEY, on ? 'on' : 'off').catch(() => {});
}
export const setSoundEffects = (on: boolean) => setEnabled(on);

/** Whether sound effects are on, updating when the menu switch changes. */
export function useSoundEffects(): boolean {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn);
    return () => { listeners.delete(setOn); };
  }, []);
  return on;
}

const players = new Map<SoundName, AudioPlayer>();
export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(FILES[name]);
      player.volume = name === 'whoosh' ? 0.35 : 0.55;
      players.set(name, player);
    }
    player.seekTo(0).catch(() => {});
    player.play();
  } catch { /* no sound is fine */ }
}
