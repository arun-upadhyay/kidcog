# KidCog

A practice activity with two category groups: Intellectual Ability (8 rows) and Social/Emotional/Behavioral (6 rows), in the order of the reference form.

## Run

Start the server with `cd server && npm run dev`, and the app with `cd app && npm start`.
Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `server/.env`. Optionally use `OPENAI_QUESTION_MODEL` for question generation. The active flow always uses AI; `USE_MOCK_GRADER` no longer enables canned grading.

## Rounds and results

Parents select an age, category, and exactly 2, 5, or 6 questions. `POST /api/test` generates a new mixed-interaction round with item-specific rubrics. No fixed bank or canned fallback is used. Generation failures show a retry message. Requests with the same request ID share work for two minutes.

Questions and rubrics stay in server memory for two hours, with bounded capacity. They are lost on restart. Answers are not persisted on the server. The app keeps completed answers for the current session and submits them together for the combined report. AI grades each answered item against its original rubric; skipped and ungraded answers do not count as zero. Arithmetic and schema validation remain deterministic.

Social/emotional results describe responses to scenarios, not enduring personality traits, diagnoses, or school eligibility. The 1–5 evidence indicators are not peer rankings or the official form's ratings.

Speech is tap-only. Report Listen uses AI-generated speech and never falls back to the device screen reader. Buttons reject rapid duplicate taps.

Each generated round mixes answer styles. Two-question rounds include at least one
picture/multiple-choice item and one spoken or written response. Five- and six-question
rounds include at least two of each, with at least one complete set of picture choices.
Picture choices use generated emoji or the app's consistent vector shapes, avoiding a
separate image-generation delay and ambiguous downloaded artwork.

The selected age is sent into both question generation and a separate AI review pass.
Deterministic limits reject questions that are too long, use too many choices, contain
long choice labels, omit the requested interaction mix, or have invalid answer keys.
For ages 4–5, prompts allow one concrete task, use familiar situations, and assume no
reading, arithmetic, technical vocabulary, or multi-step reasoning. Multiple-choice
answers are checked against the private key; AI grades open explanations against their
private, item-specific rubric.

## Checks

- `cd app && npm run typecheck && node --test test/speech.test.cjs`
- `cd server && npm run typecheck && node --import tsx --test src/categories.test.ts && node --test test/*.test.cjs`
