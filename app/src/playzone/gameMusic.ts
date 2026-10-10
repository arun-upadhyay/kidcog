import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSoundEffects } from '../games/sounds';

/**
 * Soft background music while a game is open: a short original tune that
 * loops quietly (scripts/generate_game_music.py makes it). The 🎵 button in
 * every game turns it off or on, remembered on this device, and switching all
 * sounds off in the menu silences it too. It never plays outside a game.
 */
const TRACKS = {
  playful: require('../../assets/music/loop-playful.mp3'),
  calm: require('../../assets/music/loop-calm.mp3'),
} as const;
export type MusicTrack = keyof typeof TRACKS;

const MUSIC_KEY = 'kidcog.music.v1';
const VOLUME = 0.16;
let on = true;
const listeners = new Set<(value: boolean) => void>();
AsyncStorage.getItem(MUSIC_KEY).then(value => { if (value === 'off') setMusicOn(false, false); }).catch(() => {});

export function setMusicOn(value: boolean, save = true) {
  on = value;
  listeners.forEach(listener => listener(value));
  if (save) AsyncStorage.setItem(MUSIC_KEY, value ? 'on' : 'off').catch(() => {});
}

export function useMusicOn() {
  const [value, setValue] = useState(on);
  useEffect(() => {
    listeners.add(setValue);
    setValue(on);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

/** Plays `track` on a loop while mounted (null = no music for this game). */
export function useGameMusic(track: MusicTrack | null) {
  const musicOn = useMusicOn();
  const sounds = useSoundEffects();
  const playing = !!track && musicOn && sounds;
  useEffect(() => {
    if (!playing || !track) return;
    let player: AudioPlayer | null = null;
    try {
      player = createAudioPlayer(TRACKS[track]);
      player.loop = true;
      player.volume = VOLUME;
      player.play();
    } catch { /* music is a nice-to-have; never break a game over it */ }
    return () => {
      try { player?.pause(); player?.remove(); } catch { /* ignore */ }
    };
  }, [playing, track]);
}
