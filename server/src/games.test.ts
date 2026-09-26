import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_KINDS, gameShare, makeGame, makeGames, numberChoices, scoreGame, defaultLevel } from './games.js';
import type { GameKind, GameSpec, TraitKey } from './types.js';

const ALL: Array<[GameKind, TraitKey]> = Object.entries(GAME_KINDS).flatMap(([trait, kinds]) => kinds!.map(kind => [kind, trait as TraitKey] as [GameKind, TraitKey]));

/** The value a child who gets it right would send. */
function rightValue(spec: GameSpec): unknown {
  return spec.kind === 'match' ? null : spec.answer;
}
function wrongValue(spec: GameSpec): unknown {
  switch (spec.kind) {
    case 'truefalse': return !spec.answer;
    case 'shapes': return spec.answer.slice(1);
    case 'sort': return spec.answer.map(side => 1 - side);
    case 'order': return [...spec.answer].reverse();
    case 'match': return null;
    case 'compare': return 1 - spec.answer;
    case 'pattern': case 'oddoneout': return (spec.answer + 1) % 3;
    default: return (spec.answer as number) + 1;
  }
}

test('every game at every level is well formed and has exactly one right answer', () => {
  for (const [kind, trait] of ALL) {
    for (let level = 1; level <= 5; level++) {
      for (let run = 0; run < 60; run++) {
        const { spec, prompt } = makeGame(kind, trait, level);
        assert.ok(prompt.length > 8, `${kind} needs a prompt`);
        switch (spec.kind) {
          case 'count':
            assert.equal(spec.answer, spec.count);
            assert.ok(spec.choices.includes(spec.answer) && new Set(spec.choices).size === spec.choices.length);
            break;
          case 'add':
            assert.equal(spec.answer, spec.a + spec.b);
            assert.ok(spec.a >= 1 && spec.b >= 1 && spec.choices.includes(spec.answer));
            break;
          case 'subtract':
            assert.equal(spec.answer, spec.start - spec.away);
            assert.ok(spec.away >= 1 && spec.answer >= 1 && spec.choices.includes(spec.answer));
            break;
          case 'compare': {
            const [a, b] = spec.groups.map(g => g.count);
            assert.notEqual(a, b, 'the two sides must differ');
            const want = spec.ask === 'more' ? (a! > b! ? 0 : 1) : (a! < b! ? 0 : 1);
            assert.equal(spec.answer, want);
            break;
          }
          case 'numberline':
            assert.equal(spec.answer, spec.start + spec.hop);
            assert.ok(spec.answer >= 0 && spec.answer <= spec.max && spec.hop !== 0);
            break;
          case 'tenframe':
            assert.equal(spec.answer, 10 - spec.filled);
            assert.ok(spec.filled >= 1 && spec.filled <= 9 && spec.choices.includes(spec.answer));
            break;
          case 'shapes':
            assert.ok(spec.answer.length >= 2);
            assert.deepEqual(spec.answer, spec.shapes.flatMap((s, i) => (s === spec.target ? [i] : [])));
            break;
          case 'pattern':
            assert.equal(spec.choices.length, 3);
            assert.equal(new Set(spec.choices.map(c => c.emoji)).size, 3);
            assert.ok(spec.answer >= 0 && spec.answer < 3);
            break;
          case 'sort':
            assert.equal(spec.items.length, spec.answer.length);
            assert.ok(spec.answer.includes(0) && spec.answer.includes(1));
            break;
          case 'order':
            assert.deepEqual([...spec.answer].sort(), spec.items.map((_, i) => i));
            assert.ok(!spec.answer.every((v, i) => v === i), 'must not start in order');
            if (trait === 'mental_math') {
              const inOrder = spec.answer.map(i => Number(spec.items[i]!.name));
              assert.deepEqual(inOrder, [...inOrder].sort((x, y) => x - y));
            }
            break;
          case 'match':
            assert.equal(new Set(spec.pairs.map(p => p.emoji)).size, spec.pairs.length);
            break;
          case 'oddoneout':
            assert.ok(spec.answer >= 0 && spec.answer < spec.items.length);
            break;
          case 'truefalse':
            assert.equal(typeof spec.answer, 'boolean');
            break;
        }
        // Scoring agrees with the answer the game was made with.
        const right = scoreGame(spec, JSON.stringify({ v: rightValue(spec), mistakes: 0, solved: true }));
        assert.equal(right.points, 3, `${kind}: a right first answer scores 3`);
        if (spec.kind !== 'match') {
          const wrong = scoreGame(spec, JSON.stringify({ v: wrongValue(spec), mistakes: 2, solved: false }));
          assert.equal(wrong.points, 0, `${kind}: a wrong answer scores 0`);
        }
      }
    }
  }
});

test('a second try earns 2, slips on the way still finish', () => {
  const { spec } = makeGame('count', 'mental_math', 3);
  assert.equal(scoreGame(spec, JSON.stringify({ v: (spec as { answer: number }).answer, mistakes: 1, solved: true })).points, 2);
  const sort = makeGame('sort', 'categories_hierarchies', 3).spec as Extract<GameSpec, { kind: 'sort' }>;
  assert.equal(scoreGame(sort, JSON.stringify({ v: sort.answer, mistakes: 2, solved: true })).points, 2);
  assert.equal(scoreGame(sort, JSON.stringify({ v: sort.answer, mistakes: 5, solved: true })).points, 1);
  assert.equal(scoreGame(sort, 'not json').points, 0);
});

test('number choices always include the answer and stay in range', () => {
  for (let i = 0; i < 500; i++) {
    const max = 5 + (i % 10);
    const answer = i % (max + 1);
    const choices = numberChoices(answer, max, Math.random);
    assert.ok(choices.includes(answer));
    assert.equal(new Set(choices).size, 3);
    assert.ok(choices.every(n => n >= 0));
  }
});

test('rounds: maths is all games, mixed categories are half, others none', () => {
  assert.equal(gameShare('mental_math', 5), 5);
  assert.equal(gameShare('categories_hierarchies', 5), 3);
  assert.equal(gameShare('categories_hierarchies', 2), 1);
  assert.equal(gameShare('humor', 6), 0);
  for (let i = 0; i < 50; i++) {
    const round = makeGames('mental_math', 5, defaultLevel(5), 6);
    assert.equal(round.length, 6);
    round.slice(1).forEach((q, j) => assert.notEqual(q.game.kind, round[j]!.game.kind, 'same game twice in a row'));
  }
  // Level 1 keeps the harder maths games locked.
  for (let i = 0; i < 50; i++) {
    for (const q of makeGames('mental_math', 4, 1, 6)) assert.ok(!['numberline', 'tenframe', 'truefalse', 'order'].includes(q.game.kind));
  }
});
