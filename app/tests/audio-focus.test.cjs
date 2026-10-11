const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness() {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible'; doc.hasFocus = () => true;
  const spoken = [], players = [], effects = [], cache = new Map();
  let resolveRegistration;
  const registration = new Promise(resolve => { resolveRegistration = resolve; });
  const mocks = {
    react: { useSyncExternalStore() {}, useState: x => [x, () => {}], useEffect: fn => effects.push(fn) },
    'react-native': { Platform: { OS: 'web' }, AppState: {} },
    'expo-speech': { speak: (text, options) => spoken.push({text, options}), stop: async () => {} },
    'expo-audio': {
      setAudioModeAsync: async () => {},
      createAudioPlayer: () => {
        const p = { playing: false, playCount: 0, play() { this.playing = true; this.playCount++; }, pause() { this.playing = false; }, remove() {}, seekTo: async () => {}, addListener: () => ({remove() {}}) };
        players.push(p); return p;
      },
    },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
  };
  function load(filename) {
    filename = path.resolve(__dirname, '../src', filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    vm.runInNewContext(js, {
      module, exports: module.exports, window: win, document: doc, AbortController, URL,
      setTimeout: () => 1, clearTimeout() {},
      fetch: async () => ({ok: true, blob: async () => new Blob(['audio'])}),
      require: id => {
        if (mocks[id]) return mocks[id];
        if (id.endsWith('/api') || id === './api') return { API_BASE_URL: 'https://test.invalid', registerSpeech: () => registration };
        if (/\.(wav|mp3)$/.test(id)) return 1;
        return load(path.resolve(path.dirname(filename), id + '.ts'));
      },
    });
    return module.exports;
  }
  return {load, win, doc, spoken, players, effects, resolveRegistration};
}

test('narration stops on blur, resumes once, and ignores stale completion', async () => {
  const h = harness(), speech = h.load('speech.ts');
  await speech.speak('Pop three bubbles', {voice: 'device'});
  h.win.dispatchEvent(new Event('blur'));
  h.spoken[0].options.onStopped();
  await speech.speak('Hidden prompt', {voice: 'device'});
  assert.equal(h.spoken.length, 1);
  h.win.dispatchEvent(new Event('focus'));
  h.win.dispatchEvent(new Event('focus'));
  assert.equal(h.spoken.length, 2);
  assert.equal(h.spoken[1].text, 'Pop three bubbles');
});
test('navigation cancels the interrupted prompt', async () => {
  const h = harness(), speech = h.load('speech.ts');
  await speech.speak('Old activity', {voice: 'device'});
  h.win.dispatchEvent(new Event('blur'));
  speech.stopSpeaking();
  h.win.dispatchEvent(new Event('focus'));
  assert.equal(h.spoken.length, 1);
});
test('a pending generated voice cannot start after losing focus', async () => {
  const h = harness(), speech = h.load('speech.ts');
  const pending = speech.speak('Loading question');
  await Promise.resolve();
  h.win.dispatchEvent(new Event('blur'));
  h.resolveRegistration('key');
  await pending;
  assert.equal(h.players.length, 0);
  assert.equal(h.spoken.length, 0);
  speech.stopSpeaking();
});
test('visibility and window focus both gate audio', () => {
  const h = harness(), focus = h.load('audioFocus.ts');
  h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(new Event('visibilitychange'));
  h.win.dispatchEvent(new Event('focus'));
  assert.equal(focus.isAudioFocused(), false);
  h.doc.visibilityState = 'visible'; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(focus.isAudioFocused(), true);
});
test('looping music pauses and resumes, cleanup prevents resurrection', () => {
  const h = harness(); h.load('playzone/gameMusic.ts').useGameMusic('playful');
  const cleanup = h.effects.map(fn => fn()).filter(Boolean);
  const p = h.players[0]; assert.equal(p.playing, true);
  h.win.dispatchEvent(new Event('blur')); assert.equal(p.playing, false);
  h.win.dispatchEvent(new Event('focus')); assert.equal(p.playing, true);
  cleanup.forEach(fn => fn());
  h.win.dispatchEvent(new Event('blur')); h.win.dispatchEvent(new Event('focus'));
  assert.equal(p.playing, false);
});
test('one-shot effects stop and are not queued in the background', () => {
  const h = harness(), sounds = h.load('games/sounds.ts');
  sounds.playSound('pop'); const p = h.players[0];
  h.win.dispatchEvent(new Event('blur')); assert.equal(p.playing, false);
  sounds.playSound('yay'); assert.equal(h.players.length, 1);
  h.win.dispatchEvent(new Event('focus')); assert.equal(p.playCount, 1);
});
