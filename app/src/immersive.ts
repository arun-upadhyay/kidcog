import { useEffect, useState } from 'react';

/**
 * Immersive mode: while a game is open the app's top bar steps aside, so the
 * game gets the whole screen (the game has its own big ✕ to leave).
 */
const listeners = new Set<(on: boolean) => void>();
let immersive = false;

export function setImmersive(on: boolean) {
  if (immersive === on) return;
  immersive = on;
  listeners.forEach(listener => listener(on));
}

export function useImmersive() {
  const [value, setValue] = useState(immersive);
  useEffect(() => {
    listeners.add(setValue);
    setValue(immersive);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}
