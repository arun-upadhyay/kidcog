# KidCog — a cross-platform children's reasoning activity

A working starter project in TypeScript: an Expo (React Native) app for iOS and Android, and a
Node API that scores the answers. Multiple-choice items are scored deterministically on the server;
written answers are graded against a rubric by an OpenAI model.


```
kidcog/
  server/          Node + Express API (TypeScript, ESM)
    src/types.ts       shared domain types — start here
    src/questions.ts   the question bank (edit this first)
    src/scoring.ts     aggregation, domain percentages, report shape
    src/grader.ts      OpenAI calls: rubric grading + parent summary
    src/index.ts       routes, validation, rate limiting
  app/             Expo app (iOS + Android + web)
    App.tsx            three-stage flow: start -> quiz -> results
    src/types.ts       mirrors the server's API types
    src/api.ts         typed fetch wrapper
    src/screens/       consent & profile, question runner, results
```

Both packages compile under `strict` plus `noUncheckedIndexedAccess`.

## Run it

Two terminals.

**Terminal 1 — the server**

```bash
cd server
npm install
cp .env.example .env        # then put your real OPENAI_API_KEY in .env
npm run dev                 # tsx, reloads on change
```

For production, `npm run build` compiles to `dist/` and `npm start` runs the output.
`npm run typecheck` checks without emitting.

To develop without spending tokens, set `USE_MOCK_GRADER=1` in `.env`. Open answers then get a
crude length-based score so you can exercise the whole flow offline.

Check it: `curl http://localhost:4000/health`

**Terminal 2 — the app**

```bash
cd app
npm install
npx expo start
```

Press `i` for the iOS simulator, `a` for the Android emulator, or scan the QR code with the Expo Go
app on a real phone.

### Reaching the server from the device

This trips up nearly everyone once.

| Where the app runs | What it should call |
|---|---|
| iOS simulator | `http://localhost:4000` (the default) |
| Android emulator | `http://10.0.2.2:4000` (handled automatically in `src/api.ts`) |
| Real phone on your Wi-Fi | your computer's LAN IP |

For a real phone, find your machine's address (`ipconfig getifaddr en0` on macOS,
`hostname -I` on Linux) and start Expo with it:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.24:4000 npx expo start
```

## How scoring works

Every item is worth `weight × 3` points.

- **Multiple choice** is all-or-nothing and never touches the model. There is a known correct
  answer, so sending it to a language model would only add cost, latency, and a chance of being
  graded wrong.
- **Open-ended** items are sent to the model in a single batched call, with their rubrics, and come
  back as a 0–3 band. `temperature` is 0 and the response is constrained by a JSON schema, so
  grading is about as repeatable as a model can be.

The server clamps every band it gets back and fills in anything the model skipped, so one bad grade
cannot corrupt a report. If the grader fails entirely, open items are marked ungraded and excluded
from the totals rather than silently counted as zero — a partial result never masquerades as a
complete one.

Points roll up per domain into a percentage and a plain-language band.

## What this deliberately does not do

It does not output an IQ score, a percentile, or an age equivalent, and the grading prompt forbids
the model from implying one. Those numbers only mean something when a test has been standardised on
a large representative sample of children, with published reliability and validity evidence behind
it. Nothing here has been. Shipping a number like that would let parents read a precise-looking
claim about their child out of what is really a set of practice puzzles.

So the report describes what happened in this session — which kinds of questions went smoothly,
which were harder — and says plainly that it is a practice activity. If you later want a genuine
screening instrument, that is a psychometrics project (item piloting, a normative sample, expert
review) rather than a software one, and worth involving an educational psychologist in.

## Adding your own questions

Open `server/src/questions.ts`. An MCQ:

```js
{
  id: 'vr-05',
  domain: 'verbal_reasoning',
  type: 'mcq',
  ageBand: [8, 12],
  weight: 1,
  prompt: 'Your question text',
  options: [{ key: 'a', text: '…' }, { key: 'b', text: '…' }],
  answerKey: 'b',
}
```

An open-ended one:

```js
{
  id: 'vr-06',
  domain: 'verbal_reasoning',
  type: 'open',
  ageBand: [8, 12],
  weight: 2,
  prompt: 'Your question text',
  timeLimitSeconds: 180,
  rubric: [
    '3 - what a full answer contains',
    '2 - what a partial answer looks like',
    '1 - minimal credit',
    '0 - Blank, off-topic, or unintelligible.',
  ],
}
```

Write rubrics in terms of *what the answer demonstrates*, not how long or polished it is — that is
the single biggest lever on grading quality. Give the model concrete anchors ("names the gap in the
logic") rather than adjectives ("a good answer").

The array ends with `satisfies Question[]`, and that is doing real work. `Question` is a
discriminated union on `type`, so the compiler will reject an item that carries a rubric while
calling itself an `mcq`, uses an unknown domain key, or omits an answer key. The same union means
`scoring.ts` can read `q.answerKey` in the MCQ branch and `q.rubric` in the other with no casts and
no chance of reaching for the wrong one.

Answer keys and rubrics never leave the server: `toPublicQuestion()` strips them before the app sees
anything, and `PublicQuestion` is a separate type with no field to put them in. Keep it that way —
anything in a mobile bundle can be extracted.

## One thing to watch as this grows

`server/src/types.ts` and `app/src/types.ts` are duplicates on purpose — two small packages, no
build tooling between them. Nothing typechecks across the HTTP boundary, so if you change a response
shape on one side and forget the other, TypeScript will not catch it. When that starts to bite, move
the shared types into a workspace package both sides import. It is a twenty-minute change now and a
much larger one later.

## Before you put this in front of real families

The prototype is honest about being a prototype. These are the gaps that matter:

**Privacy and children's data.** Right now nothing is stored, which is the safest possible default.
The moment you add accounts or history you are handling children's personal data, which means COPPA
in the US, GDPR-K in the EU, and India's DPDP Act if you are operating there — verifiable parental
consent, data minimisation, deletion on request. Decide deliberately what you store. Not storing
written answers at all is a legitimate and much simpler choice.

**Your OpenAI key.** It lives on the server, which is correct. Never move it into the app to
"simplify" things; a key in a mobile binary can be pulled out in minutes.

**Abuse and cost control.** The in-memory rate limiter in `index.ts` is a placeholder. Add a real
one, cap spend in the OpenAI dashboard, and put an auth token on `/api/submit` before it is public.

**Storage and auth.** Add Postgres or Supabase for sessions and history, and sign submissions so a
report can be tied to a real account.

**Accessibility.** Buttons already carry roles and touch targets are 52pt+. Still to do: test with
VoiceOver and TalkBack, support dynamic type, and check colour contrast if you change the palette.

**Store submission.** Both stores review apps aimed at children more strictly. You will need a
privacy policy URL, an age rating, and — for Apple — the Kids Category rules if you target it,
which forbid third-party analytics and behavioural ads. Build with `eas build`.

**Reliability of grading.** Before trusting the scores, hand-grade 30–50 real answers yourself and
compare against the model. Where you disagree, the rubric is usually the thing to fix, not the
prompt.
