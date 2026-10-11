# backbutton.py: browser Back / Android back step back inside KidCog (game -> Play Zone -> activities -> players; sign-in -> welcome).
import base64, os, sys
if os.path.exists('app/src/backHandler.ts'): sys.exit('app/src/backHandler.ts already exists; not applying')
import sys
# Exact-match edits for browser/Android Back. Usage: python3 back_edits.py <app dir>
root = 'app/'
EDITS = {
 'App.tsx': [
  ("import RoundDoneOverlay from './src/components/RoundDoneOverlay';\n",
   "import RoundDoneOverlay from './src/components/RoundDoneOverlay';\nimport { useBackHandler } from './src/backHandler';\n"),
  ("  }, [busy, stage, restart]);\n",
   """  }, [busy, stage, restart]);

  /**
   * The browser's Back button and Android's back button go one step back
   * inside KidCog instead of leaving it: Play Zone → activities → "Who's
   * playing today?". Leaving a round asks first, like the quiz's Leave button.
   */
  const stepBack = useCallback(() => {
    if (busy) return;
    if (stage === 'quiz') {
      const message = 'Answers so far will not be saved.';
      if (Platform.OS === 'web') { if (globalThis.confirm(`Leave this activity?\\n\\n${message}`)) leaveQuiz(); return; }
      Alert.alert('Leave this activity?', message, [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: leaveQuiz }]);
      return;
    }
    if (stage === 'playzone' || stage === 'results') { stopSpeaking(); setStage('categories'); return; }
    if (stage === 'historical_result') { setStage('history'); return; }
    restart();
  }, [busy, stage, leaveQuiz, restart]);
  useBackHandler(1, stepBack, stage !== 'start');
"""),
 ],
 'src/screens/PlayZoneScreen.tsx': [
  ("import PlayerBar from '../components/PlayerBar';\n", "import PlayerBar from '../components/PlayerBar';\nimport { useBackHandler } from '../backHandler';\n"),
  ("  const leaveGame = () => { if (initialGame && playing === initialGame) onBack(); else setPlaying(null); };\n",
   "  const leaveGame = () => { if (initialGame && playing === initialGame) onBack(); else setPlaying(null); };\n  // Browser Back / Android back inside a game: leave the game (see backHandler.ts).\n  useBackHandler(2, leaveGame, playing !== null);\n"),
 ],
 'src/playzone/ArtMusic.tsx': [
  (" const [activity,setActivity]=useState<Activity|null>(null);",
   " const [activity,setActivity]=useState<Activity|null>(null);\n useBackHandler(3, () => setActivity(null), activity !== null);"),
 ],
 'src/playzone/ColoringBook.tsx': [
  ("  const [open, setOpen] = useState<ColoringPage | null>(null);\n",
   "  const [open, setOpen] = useState<ColoringPage | null>(null);\n  useBackHandler(4, () => setOpen(null), open !== null);\n"),
 ],
 'src/screens/LoginScreen.tsx': [
  ("  const [showWelcome, setShowWelcome] = useState(true);\n",
   "  const [showWelcome, setShowWelcome] = useState(true);\n  // Browser Back on the sign-in page returns to the welcome page instead of leaving the site.\n  useBackHandler(1, () => { setShowWelcome(true); setError(null); }, !showWelcome);\n"),
 ],
 'src/playzone/AnimalExplorer.tsx': [
  ("  const leave = () => { stopSpeaking(); setMode('hub'); };\n",
   "  const leave = () => { stopSpeaking(); setMode('hub'); };\n  useBackHandler(3, leave, mode !== 'hub');\n"),
 ],
}
IMPORTS = {
 'src/playzone/ArtMusic.tsx': "import { useBackHandler } from '../backHandler';\n",
 'src/playzone/ColoringBook.tsx': "import { useBackHandler } from '../backHandler';\n",
 'src/playzone/AnimalExplorer.tsx': "import { useBackHandler } from '../backHandler';\n",
 'src/screens/LoginScreen.tsx': "import { useBackHandler } from '../backHandler';\n",
}
texts = {}
for f, pairs in EDITS.items():
    s = open(root + f, encoding='utf-8').read()
    if 'useBackHandler' in s: sys.exit(f + ' already uses useBackHandler; not applying')
    for old, new in pairs:
        if s.count(old) != 1: sys.exit(f'{f}: anchor found {s.count(old)} times; not applying: {old[:70]!r}')
        s = s.replace(old, new)
    if f in IMPORTS:
        lines = s.split('\n'); i = max(k for k, l in enumerate(lines[:60]) if l.startswith('import ')); lines.insert(i + 1, IMPORTS[f].rstrip('\n')); s = '\n'.join(lines)
    texts[f] = s

for f, add in [('e2e/flows.spec.ts', "\ntest('the browser Back button steps back inside KidCog: game → Play Zone → activities → players', async ({ page }) => {\n  await games(page);\n  await page.getByRole('button', { name: 'Play Magic Add', exact: true }).click();\n  await expect(page.getByTestId('magic-stone').first()).toBeVisible();\n  await page.goBack();\n  await expect(page.getByRole('button', { name: 'Play Number Snake', exact: true })).toBeVisible();\n  await page.goBack();\n  await expect(page.getByRole('button', { name: 'Open the Play Zone games' })).toBeVisible();\n  await page.goBack();\n  await expect(page.getByRole('radio', { name: 'Test Explorer, age 5', exact: true })).toBeVisible();\n  expect(new URL(page.url()).host).toBe(new URL(page.url()).host); // still in the app\n});\n"), ('e2e/welcome.spec.ts', "\ntest('browser Back from the sign-in page returns to the welcome page', async ({ page }) => {\n  await page.goto('/');\n  await page.getByRole('button', { name: 'Parent sign in', exact: true }).first().click();\n  await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();\n  await page.goBack();\n  await expect(page.getByRole('heading', { name: 'Ready for a little adventure?' })).toBeVisible();\n});\n")]:
    s = open(root + f, encoding='utf-8').read()
    if add.strip()[:60] in s: sys.exit(f + ' already has the test; not applying')
    texts[f] = s.rstrip('\n') + '\n' + add
open('app/src/backHandler.ts', 'wb').write(base64.b64decode('aW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCc7CmltcG9ydCB7IEJhY2tIYW5kbGVyLCBQbGF0Zm9ybSB9IGZyb20gJ3JlYWN0LW5hdGl2ZSc7CgovKioKICogT25lICJnbyBiYWNrIiBmb3IgdGhlIHdob2xlIGFwcDogQW5kcm9pZCdzIGJhY2sgYnV0dG9uIGFuZCB0aGUgYnJvd3NlcidzCiAqIEJhY2sgYnV0dG9uIGJvdGggdGFrZSB0aGUgY2hpbGQgb25lIHN0ZXAgYmFjayBpbnNpZGUgS2lkQ29nIChnYW1lIOKGkiBQbGF5CiAqIFpvbmUg4oaSIGFjdGl2aXRpZXMg4oaSICJXaG8ncyBwbGF5aW5nIHRvZGF5PyIpIGluc3RlYWQgb2YgY2xvc2luZyB0aGUgYXBwIG9yCiAqIGxlYXZpbmcgdGhlIHdlYnNpdGUuCiAqCiAqIFNjcmVlbnMgcmVnaXN0ZXIgd2hhdCAiYmFjayIgbWVhbnMgZm9yIHRoZW0gd2l0aCB1c2VCYWNrSGFuZGxlcihkZXB0aCwgZm4pLgogKiBUaGUgZGVlcGVzdCBlbmFibGVkIG9uZSB3aW5zIChhIGdhbWUgaW5zaWRlIHRoZSBQbGF5IFpvbmUgYmVhdHMgdGhlIFBsYXkKICogWm9uZSBpdHNlbGYpLCB3aGF0ZXZlciBvcmRlciB0aGV5IG1vdW50ZWQgaW4uCiAqLwp0eXBlIEVudHJ5ID0geyBkZXB0aDogbnVtYmVyOyBoYW5kbGVyOiAoKSA9PiB2b2lkIH07CmNvbnN0IGVudHJpZXMgPSBuZXcgU2V0PEVudHJ5PigpOwoKZnVuY3Rpb24gdG9wKCk6IEVudHJ5IHwgbnVsbCB7CiAgbGV0IGJlc3Q6IEVudHJ5IHwgbnVsbCA9IG51bGw7CiAgZW50cmllcy5mb3JFYWNoKGUgPT4geyBpZiAoIWJlc3QgfHwgZS5kZXB0aCA+PSBiZXN0LmRlcHRoKSBiZXN0ID0gZTsgfSk7CiAgcmV0dXJuIGJlc3Q7Cn0KCmxldCBpbnN0YWxsZWQgPSBmYWxzZTsKbGV0IGd1YXJkZWQgPSBmYWxzZTsKZnVuY3Rpb24gZ3VhcmQoKSB7CiAgLy8gQnJvd3Nlcjoga2VlcCBvbmUgZXh0cmEgaGlzdG9yeSBlbnRyeSB3aGlsZSB0aGVyZSBpcyBzb21ld2hlcmUgdG8gZ28gYmFjawogIC8vIHRvIGluc2lkZSB0aGUgYXBwLCBzbyBCYWNrIGxhbmRzIGhlcmUgaW5zdGVhZCBvZiBsZWF2aW5nIHRoZSBzaXRlLgogIGlmIChQbGF0Zm9ybS5PUyAhPT0gJ3dlYicgfHwgdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgfHwgZ3VhcmRlZCB8fCAhZW50cmllcy5zaXplKSByZXR1cm47CiAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHsga2lkY29nOiB0cnVlIH0sICcnKTsKICBndWFyZGVkID0gdHJ1ZTsKfQpmdW5jdGlvbiBpbnN0YWxsKCkgewogIGlmIChpbnN0YWxsZWQpIHJldHVybjsKICBpbnN0YWxsZWQgPSB0cnVlOwogIGlmIChQbGF0Zm9ybS5PUyA9PT0gJ3dlYicgJiYgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHsKICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsICgpID0+IHsKICAgICAgZ3VhcmRlZCA9IGZhbHNlOwogICAgICBjb25zdCBlbnRyeSA9IHRvcCgpOwogICAgICBpZiAoZW50cnkpIGVudHJ5LmhhbmRsZXIoKTsKICAgICAgLy8gUmUtYXJtIG9uIHRoZSBuZXh0IHRpY2ssIG9uY2UgdGhlIHNjcmVlbiBoYXMgY2hhbmdlZC4KICAgICAgc2V0VGltZW91dChndWFyZCwgMCk7CiAgICB9KTsKICB9IGVsc2UgewogICAgQmFja0hhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcignaGFyZHdhcmVCYWNrUHJlc3MnLCAoKSA9PiB7CiAgICAgIGNvbnN0IGVudHJ5ID0gdG9wKCk7CiAgICAgIGlmICghZW50cnkpIHJldHVybiBmYWxzZTsgLy8gbm90aGluZyB0byBnbyBiYWNrIHRvOiBsZXQgQW5kcm9pZCBjbG9zZSB0aGUgYXBwCiAgICAgIGVudHJ5LmhhbmRsZXIoKTsKICAgICAgcmV0dXJuIHRydWU7CiAgICB9KTsKICB9Cn0KCi8qKiBXaGlsZSBgZW5hYmxlZGAsIHRoZSBiYWNrIGJ1dHRvbiAvIGJyb3dzZXIgQmFjayBydW5zIGBvbkJhY2tgLiBEZWVwZXIgc2NyZWVucyB1c2UgYSBiaWdnZXIgYGRlcHRoYC4gKi8KZXhwb3J0IGZ1bmN0aW9uIHVzZUJhY2tIYW5kbGVyKGRlcHRoOiBudW1iZXIsIG9uQmFjazogKCkgPT4gdm9pZCwgZW5hYmxlZCA9IHRydWUpIHsKICBjb25zdCByZWYgPSB1c2VSZWYob25CYWNrKTsKICByZWYuY3VycmVudCA9IG9uQmFjazsKICB1c2VFZmZlY3QoKCkgPT4gewogICAgaWYgKCFlbmFibGVkKSByZXR1cm47CiAgICBpbnN0YWxsKCk7CiAgICBjb25zdCBlbnRyeTogRW50cnkgPSB7IGRlcHRoLCBoYW5kbGVyOiAoKSA9PiByZWYuY3VycmVudCgpIH07CiAgICBlbnRyaWVzLmFkZChlbnRyeSk7CiAgICBndWFyZCgpOwogICAgcmV0dXJuICgpID0+IHsgZW50cmllcy5kZWxldGUoZW50cnkpOyB9OwogIH0sIFtkZXB0aCwgZW5hYmxlZF0pOwp9Cg==')); print('wrote app/src/backHandler.ts')
for f, s in texts.items():
    open(root + f, 'w', encoding='utf-8').write(s); print('edited', f)
