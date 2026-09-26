import test from 'node:test';
import assert from 'node:assert/strict';
import { salvageBatch } from './generatedQuestions.js';
import { assembleRound } from './questionBank.js';

const rubric = ['3 - Relevant idea with a reason.', '2 - Relevant idea partly explained.', '1 - Related idea without a reason.', '0 - No interpretable relevant idea.'];
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  type: n % 2 === 0 ? 'mcq' : 'open',
  prompt: `Look at these objects in puzzle number ${n} ${'abcdefghij'[n % 10]}. What would you pick?`,
  skillFacet: `facet ${n}`,
  targetEvidence: 'The child identifies the relevant rule.',
  alignmentRationale: 'The answer requires applying the selected category rule.',
  rubric, visual: null,
  options: n % 2 === 0 ? [{ key: 'a', text: 'A ball', symbol: '⚽', shape: null, points: 3 }, { key: 'b', text: 'A block', symbol: null, shape: 'square', points: 1 }] : null,
  answerKey: n % 2 === 0 ? 'a' : null,
  ...extra,
});

test('a batch keeps its good questions and drops only the broken ones', () => {
  const raw = JSON.stringify({ questions: [
    item(0), item(1), item(2), item(3),
    item(4, { options: [{ key: 'a', text: 'one two three four five six seven', symbol: null, shape: null, points: 3 }, { key: 'b', text: 'Block', symbol: null, shape: null, points: 0 }] }), // choice too long for age 5
    item(5, { options: [{ key: 'a', text: 'Yes', symbol: null, shape: null, points: 3 }, { key: 'b', text: 'No', symbol: null, shape: null, points: 0 }], answerKey: 'a' }), // spoken question with choices
    item(0),                    // exact repeat of the first
    { type: 'mcq', prompt: 'x' }, // wrong format
  ] });
  const { items, rejected } = salvageBatch(raw, 5);
  assert.equal(items.length, 4);
  assert.equal(rejected.length, 4);
  assert.match(rejected.join(' '), /too long/);
  assert.match(rejected.join(' '), /must not contain choices/);
  assert.match(rejected.join(' '), /repeats question 1/);
  assert.match(rejected.join(' '), /wrong format/);
});

const pool = (types: Array<'open' | 'mcq'>) => types.map((type, i) => ({ id: `q${i}`, type, skillFacet: `facet ${i}`, prompt: `A completely different question number ${i} about ${['cats', 'boats', 'trees', 'kites', 'cups', 'socks', 'drums', 'bees'][i]}`, servedCount: 0 }));

test('a round has the right size and mix of spoken and choice questions', () => {
  for (const count of [2, 5, 6]) {
    const round = assembleRound(pool(['mcq', 'mcq', 'mcq', 'mcq', 'open', 'open', 'open', 'open']), count)!;
    assert.equal(round.length, count);
    const need = count >= 5 ? 2 : 1;
    assert.ok(round.filter(q => q.type === 'mcq').length >= need);
    assert.ok(round.filter(q => q.type === 'open').length >= need);
    assert.equal(new Set(round.map(q => q.id)).size, count);
  }
});

test('no round when the pool cannot supply the mix or the count', () => {
  assert.equal(assembleRound(pool(['mcq', 'mcq', 'mcq']), 2), null);
  assert.equal(assembleRound(pool(['mcq', 'open', 'mcq', 'open']), 5), null);
  assert.equal(assembleRound([], 2), null);
});

test('two questions testing the same thing the same way are never paired', () => {
  const twins = [
    { id: 'a', type: 'mcq' as const, skillFacet: 'rhyme', prompt: 'Which word rhymes with cat: hat or dog?', servedCount: 0 },
    { id: 'b', type: 'mcq' as const, skillFacet: 'rhyme', prompt: 'Which word rhymes with cat: hat or sun?', servedCount: 0 },
    { id: 'c', type: 'open' as const, skillFacet: 'story', prompt: 'Tell me a tiny story about a brave snail.', servedCount: 0 },
  ];
  for (let i = 0; i < 20; i++) {
    const round = assembleRound(twins, 2)!;
    assert.ok(!(round.some(q => q.id === 'a') && round.some(q => q.id === 'b')));
  }
});

test('least-used questions are preferred', () => {
  const items = pool(['mcq', 'open', 'mcq', 'open']).map((q, i) => ({ ...q, servedCount: i < 2 ? 50 : 0 }));
  const round = assembleRound(items, 2, () => 0.5)!;
  assert.deepEqual(round.map(q => q.id).sort(), ['q2', 'q3']);
});
