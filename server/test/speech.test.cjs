const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('concurrent identical speech requests share generation; failures allow retry', async () => {
  let count = 0, resolve, reject;
  const modules = {
    'node:crypto': require('node:crypto'),
    openai: { default: class { audio = { speech: { create: () => { count++; return new Promise((yes, no) => { resolve = yes; reject = no; }); } } }; } },
    './grader.js': { apiKeyProblem: () => null },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/speak.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => modules[name], process: { env: {} }, Buffer });
  const first = exports.synthesizeSpeech('Same question');
  const second = exports.synthesizeSpeech('Same question');
  assert.equal(count, 1);
  resolve({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a.audio, b.audio);
  assert.equal((await exports.synthesizeSpeech('Same question')).cached, true);
  assert.equal(count, 1);
  const failed = exports.synthesizeSpeech('Retry me');
  reject(new Error('offline'));
  await assert.rejects(failed, /offline/);
  const retry = exports.synthesizeSpeech('Retry me');
  assert.equal(count, 3);
  resolve({ arrayBuffer: async () => new ArrayBuffer(1) });
  await retry;
});
