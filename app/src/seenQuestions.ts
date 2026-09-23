import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remembering which questions a child has already been given.
 *
 * This is what makes reassessment worth doing. A second run on the same items
 * measures whether the child remembers the answers, not whether they can
 * reason — so the next round has to draw on material they have not seen.
 *
 * Kept on the device rather than on a server. Two reasons: there are no
 * accounts yet, and nothing about the child leaves the phone this way, which
 * keeps the app out of scope for the children's-data obligations that storing
 * it server-side would bring. The cost is that reinstalling loses the history.
 *
 * Stored per child name so two children sharing a device do not exclude each
 * other's questions. Names are lower-cased and stripped to letters, so the key
 * is stable but is not a tidy record of who has used the app.
 */

const PREFIX = 'kidcog.seen.v1.';

function keyFor(childName?: string): string {
  const slug = (childName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
  return `${PREFIX}${slug || 'default'}`;
}

/** Ids this child has already been shown. Empty on any failure. */
export async function loadSeen(childName?: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(childName));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // Storage can be unavailable or hold junk. Losing the history means a
    // repeated question, which is far better than failing to start.
    return [];
  }
}

/** Add ids to the remembered set. Never throws. */
export async function rememberSeen(ids: string[], childName?: string): Promise<void> {
  if (ids.length === 0) return;
  try {
    const existing = await loadSeen(childName);
    const merged = Array.from(new Set([...existing, ...ids]));
    // Bounded: the bank will never be this large, and an unbounded list would
    // eventually make the exclude parameter unwieldy.
    const capped = merged.slice(-500);
    await AsyncStorage.setItem(keyFor(childName), JSON.stringify(capped));
  } catch {
    // Same reasoning as above: a lost record is a repeated question, not a
    // broken app.
  }
}

/** Start this child over, so the whole bank is available again. */
export async function forgetSeen(childName?: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(childName));
  } catch {
    // nothing useful to do
  }
}
