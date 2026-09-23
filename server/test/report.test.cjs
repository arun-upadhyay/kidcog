const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('child feedback includes age and concrete answer context without treating skips as wrong', async () => {
  let request;
  const fixture = { opening: 'Hi, Arya! Thanks for exploring.', strengths: [], stuckPoints: ['We can try the snow puzzle together.'], thinkingNotes: '', practiceIdeas: ['Build a pretend shelter.'], closing: 'Keep wondering!' };
  const modules = {
    openai: { default: class { chat = { completions: { create: async payload => {
      request = payload;
      return { choices: [{ message: { content: JSON.stringify(fixture) } }] };
    } } }; } },
    './generatedQuestions.js': { OPEN_MAX_POINTS: 3, generatedQuestionById: () => ({ type: 'open', rubric: ['3 - Suggests shelter with a reason.'] }) },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/grader.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => modules[name], process: { env: { OPENAI_API_KEY: 'sk-test' } } });
  const report = { responses: [
    { questionId: 'snow', type: 'open', trait: 'beyond_experience', prompt: 'What helps in the snow?', answer: 'Ice cream', correct: false, elapsedSeconds: null, note: '' },
    { questionId: 'skip', type: 'open', trait: 'beyond_experience', prompt: 'What else?', answer: '', skipped: true, elapsedSeconds: null, note: '' },
  ], traits: [], overall: { earned: 0, possible: 3, percent: 0 } };
  const result = await exports.generateParentReport(report, 'Arya', 5);
  assert.equal(result.opening, fixture.opening);
  const instructions = request.messages[0].content;
  const evidence = request.messages[1].content;
  assert.match(instructions, /directly TO the child/);
  assert.match(instructions, /80–140 words/);
  assert.match(evidence, /Child's age: 5/);
  assert.match(evidence, /child answered: Ice cream/);
  assert.match(evidence, /rubric: 3 - Suggests shelter with a reason./);
  assert.match(evidence, /skipped — no answer; not wrong and not scored/);
});
