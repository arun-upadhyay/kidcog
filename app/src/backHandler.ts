import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * One "go back" for the whole app: Android's back button and the browser's
 * Back button both take the child one step back inside KidCog (game → Play
 * Zone → activities → "Who's playing today?") instead of closing the app or
 * leaving the website.
 *
 * Screens register what "back" means for them with useBackHandler(depth, fn).
 * The deepest enabled one wins (a game inside the Play Zone beats the Play
 * Zone itself), whatever order they mounted in.
 */
type Entry = { depth: number; handler: () => void };
const entries = new Set<Entry>();

function top(): Entry | null {
  let best: Entry | null = null;
  entries.forEach(e => { if (!best || e.depth >= best.depth) best = e; });
  return best;
}

let installed = false;
let guarded = false;
function guard() {
  // Browser: keep one extra history entry while there is somewhere to go back
  // to inside the app, so Back lands here instead of leaving the site.
  if (Platform.OS !== 'web' || typeof window === 'undefined' || guarded || !entries.size) return;
  window.history.pushState({ kidcog: true }, '');
  guarded = true;
}
function install() {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      guarded = false;
      const entry = top();
      if (entry) entry.handler();
      // Re-arm on the next tick, once the screen has changed.
      setTimeout(guard, 0);
    });
  } else {
    BackHandler.addEventListener('hardwareBackPress', () => {
      const entry = top();
      if (!entry) return false; // nothing to go back to: let Android close the app
      entry.handler();
      return true;
    });
  }
}

/** While `enabled`, the back button / browser Back runs `onBack`. Deeper screens use a bigger `depth`. */
export function useBackHandler(depth: number, onBack: () => void, enabled = true) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!enabled) return;
    install();
    const entry: Entry = { depth, handler: () => ref.current() };
    entries.add(entry);
    guard();
    return () => { entries.delete(entry); };
  }, [depth, enabled]);
}
