import { useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSoundEffects } from '../games/sounds';
const FILES = [
 require('../../assets/music/c.wav'), require('../../assets/music/d.wav'), require('../../assets/music/e.wav'), require('../../assets/music/f.wav'),
 require('../../assets/music/g.wav'), require('../../assets/music/a.wav'), require('../../assets/music/b.wav'), require('../../assets/music/high-c.wav'),
 require('../../assets/music/kick.wav'), require('../../assets/music/snare.wav'), require('../../assets/music/hat.wav'),
];
/** Bundled synthesized tones: no microphone, streaming, or external recordings. */
export function useMusicAudio() {
 const enabled = useSoundEffects(); const generation = useRef(0); const mounted = useRef(true); const players = useRef(new Map<number, AudioPlayer>());
 const stop = () => { generation.current++; players.current.forEach(p => { try { p.pause(); } catch {} }); };
 useEffect(() => { if (!enabled) stop(); }, [enabled]);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; players.current.forEach(p => { try { p.remove(); } catch {} }); players.current.clear(); }; }, []);
 const play = async (note: number) => {
  if (!mounted.current || !enabled || !FILES[note]) return false;
  const epoch = generation.current;
  try { let p = players.current.get(note); if (!p) { p = createAudioPlayer(FILES[note]); p.volume = 0.45; players.current.set(note, p); } await p.seekTo(0); if (!mounted.current || generation.current !== epoch) return false; p.play(); return true; } catch { return false; }
 };
 return { play, stop, enabled };
}
