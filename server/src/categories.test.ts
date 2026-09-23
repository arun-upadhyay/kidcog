import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, toPublicQuestion } from './questions.js';
import { TRAIT_ORDER } from './traits.js';
import { scoreSubmission } from './scoring.js';
process.env.USE_MOCK_GRADER = '1';

test('each category has age-appropriate questions, bounded rounds, and no exposed answers', () => {
  for (const age of [4, 5, 7, 8, 12]) for (const trait of TRAIT_ORDER) for (const limit of [2, 5, 6]) {
    const selection = selectQuestions({ age, trait, limit });
    assert.ok(selection.questions.length > 0, `${age}/${trait}`);
    assert.ok(selection.questions.length <= limit);
    for (const q of selection.questions) {
      assert.equal(q.trait, trait);
      assert.ok(age >= q.ageBand[0] && age <= q.ageBand[1]);
      const publicQuestion = toPublicQuestion(q);
      assert.ok(!('answerKey' in publicQuestion));
      assert.ok(!('rubric' in publicQuestion));
      if (q.type === 'challenge') for (const id of Object.values(q.followUp)) {
        assert.ok(selection.followUps.some(f => f.id === id));
      }
    }
    const next = selectQuestions({ age, trait, limit, exclude: selection.questions.map(q => q.id) });
    assert.ok(next.questions.every(q => !selection.questions.some(prev => prev.id === q.id)));
  }
});

test('combined answers preserve both categories and all eight report rows', async () => {
  const first = selectQuestions({ age: 5, trait: 'abstract_concepts', limit: 2 });
  const second = selectQuestions({ age: 5, trait: 'cause_effect', limit: 2 });
  const responses = [...first.questions, ...second.questions].map(q => ({ questionId: q.id, answer: q.type === 'mcq' ? q.answerKey : 'Because pushing it makes it move.' }));
  const report = await scoreSubmission(responses);
  assert.equal(report.traits.length, 8);
  assert.equal(report.responses.length, responses.length);
  for (const key of ['abstract_concepts', 'cause_effect']) assert.ok(report.traits.find(t => t.key === key)!.questionCount > 0);
  assert.equal(report.traits.find(t => t.key === 'challenge_seeking')!.formScale, null);
});

test('dedicated curiosity and originality prompts count as their own scored evidence', async () => {
  for (const trait of ['curiosity', 'original_methods'] as const) {
    const selection = selectQuestions({ age: 5, trait, limit: 2 });
    const report = await scoreSubmission(selection.questions.map(q => ({ questionId: q.id, answer: 'I would try a different way and watch what happens.' })));
    const row = report.traits.find(t => t.key === trait)!;
    assert.equal(row.questionCount, 2);
    assert.ok(row.formScale);
    assert.ok(report.overall.possible > 0);
  }
});

test('skipped dedicated answers leave the category unscored', async () => {
  const selection = selectQuestions({ age: 5, trait: 'curiosity', limit: 2 });
  const report = await scoreSubmission(selection.questions.map(q => ({ questionId: q.id, answer: '' })));
  assert.equal(report.traits.find(t => t.key === 'curiosity')!.formScale, null);
  assert.equal(report.overall.possible, 0);
});


test('skipped multiple-choice and challenge responses are missing evidence, not low scores', async () => {
  for (const trait of ['abstract_concepts', 'challenge_seeking'] as const) {
    const selection = selectQuestions({ age: 5, trait, limit: 2 });
    const report = await scoreSubmission(selection.questions.map(q => ({ questionId: q.id, answer: '' })));
    assert.equal(report.traits.find(t => t.key === trait)!.formScale, null);
    assert.equal(report.overall.possible, 0);
  }
});
