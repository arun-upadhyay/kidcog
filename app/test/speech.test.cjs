const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/speech.ts'), 'utf8');
function setup() {
  const calls = { requests: 0, players: 0, removed: 0, revoked: 0, fallback: 0 };
  let status, device, resolveFetch, signal;
  const timers = new Set();
  const modules = {
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-native': { Platform: { OS: 'web' } },
    'expo-speech': { stop: async () => {}, speak: (_text, options) => { calls.fallback++; device = options; } },
    'expo-audio': {
      setAudioModeAsync: async () => {},
      createAudioPlayer: () => {
        calls.players++;
        return { addListener: (_name, cb) => { status = cb; return { remove() {} }; }, play() {}, remove() { calls.removed++; } };
      },
    },
    './api': { API_BASE_URL: 'http://test' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => modules[name], AbortController,
    setTimeout: cb => { timers.add(cb); return cb; }, clearTimeout: cb => timers.delete(cb),
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => calls.revoked++ },
    fetch: (_url, options) => { calls.requests++; signal = options.signal; return new Promise(resolve => { resolveFetch = resolve; }); },
  });
  return { api: exports, calls, timers,
    respond: (ok = true) => resolveFetch({ ok, status: 503, blob: async () => ({}) }),
    status: value => status(value), device: () => device, signal: () => signal };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('silent until called; rapid taps create one request and stay locked through playback', async () => {
  const h = setup();
  assert.equal(h.calls.requests, 0);
  const first = h.api.speak('Question');
  const second = h.api.speak('Question');
  await tick();
  assert.equal(h.calls.requests, 1);
  assert.equal(h.api.useSpeechState(), 'loading');
  h.respond(); await Promise.all([first, second]);
  h.status({ playing: true });
  await h.api.speak('Question');
  assert.equal(h.calls.requests, 1);
  assert.equal(h.api.useSpeechState(), 'playing');
  h.status({ didJustFinish: true });
  assert.equal(h.api.useSpeechState(), 'idle');
  assert.equal(h.calls.revoked, 1);
  assert.equal(h.timers.size, 0);
  const replay = h.api.speak('Question'); await tick();
  assert.equal(h.calls.requests, 2);
  h.respond(); await replay; h.api.stopSpeaking();
});

test('navigation aborts pending speech and stale responses cannot play or unlock a new request', async () => {
  const h = setup(); const old = h.api.speak('Old question'); await tick();
  h.api.stopSpeaking(); assert.equal(h.signal().aborted, true);
  h.respond(); await old;
  assert.equal(h.calls.players, 0); assert.equal(h.calls.fallback, 0);
  const next = h.api.speak('Next question'); await tick(); h.respond(); await next;
  assert.equal(h.calls.players, 1); h.api.stopSpeaking();
});

test('failed request uses one device fallback and unlocks on completion or error', async () => {
  const h = setup(); const pending = h.api.speak('Question'); await tick(); h.respond(false); await pending;
  assert.equal(h.calls.fallback, 1); assert.equal(h.api.useSpeechState(), 'playing');
  await h.api.speak('Question'); assert.equal(h.calls.requests, 1);
  h.device().onError(); assert.equal(h.api.useSpeechState(), 'idle');
  assert.equal(h.timers.size, 0);
});

test('playback failure releases the player and uses device fallback', async () => {
  const h = setup(); const pending = h.api.speak('Question'); await tick(); h.respond(); await pending;
  h.status({ error: 'Cannot decode' }); assert.equal(h.calls.fallback, 1);
  assert.equal(h.calls.removed, 1); assert.equal(h.calls.revoked, 1);
  h.device().onDone(); assert.equal(h.api.useSpeechState(), 'idle');
});

test('quiz and celebration only invoke speech in explicit press handlers', () => {
  for (const name of ['QuizScreen', 'CelebrationScreen', 'ResultsScreen']) {
    const text = fs.readFileSync(path.join(__dirname, `../src/screens/${name}.tsx`), 'utf8');
    const calls = text.split('\n').filter(line => /\bspeak\(/.test(line));
    assert.ok(calls.length > 0);
    assert.ok(calls.every(line => line.includes('onPress=')), name);
    assert.ok(text.includes('disabled={speechBusy}'), name);
  }
});


test('fast device mode starts immediately with no network request and still blocks repeated taps', async () => {
  const h = setup();
  const first = h.api.speak('Hi, Arya!', { voice: 'device' });
  assert.equal(h.calls.fallback, 1);
  assert.equal(h.calls.requests, 0);
  await Promise.all([first, h.api.speak('Hi, Arya!', { voice: 'device' })]);
  assert.equal(h.calls.fallback, 1);
  h.device().onDone();
  assert.equal(h.api.useSpeechState(), 'idle');
  await h.api.speak('Try a little game.', { voice: 'device' });
  assert.equal(h.calls.fallback, 2);
  h.api.stopSpeaking();
  assert.equal(h.timers.size, 0);
});
