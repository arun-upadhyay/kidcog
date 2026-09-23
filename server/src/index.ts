import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';

import { selectQuestions, toPublicQuestion, bankProblems } from './questions.js';
import { TRAITS, TRAIT_ORDER, type TraitKey } from './traits.js';
import { profileForAge } from './ageProfiles.js';
import { transcribeAnswer } from './transcribe.js';
import { synthesizeSpeech, SPEECH_MIME } from './speak.js';
import { scoreSubmission } from './scoring.js';
import { generateParentReport, apiKeyProblem } from './grader.js';
import type { PublicQuestion, TestPayload } from './types.js';

const app = express();
app.use(cors());
// Raised from 256kb because spoken answers arrive as base64 audio.
app.use(express.json({ limit: '12mb' }));

// Crude in-memory rate limit. Replace with a real one before you go public.
const hits = new Map<string, number[]>();
app.use((req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const entry = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  entry.push(now);
  hits.set(ip, entry);
  if (entry.length > max) {
    res.status(429).json({ error: 'Too many requests, slow down.' });
    return;
  }
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  const mock = process.env.USE_MOCK_GRADER === '1';
  const keyProblem = mock ? null : apiKeyProblem();
  res.json({
    ok: true,
    mockGrader: mock,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    // So `curl /health` answers "is AI actually going to work?" without
    // having to submit a session to find out.
    aiReady: mock || keyProblem === null,
    keyProblem,
  });
});

app.get('/api/categories', (_req: Request, res: Response) => {
  res.json(TRAIT_ORDER.map((key) => TRAITS[key]));
});

/** The test the app should present. Answer keys and rubrics stay on the server. */
app.get('/api/test', (req: Request, res: Response) => {
  const age = req.query.age !== undefined ? Number(req.query.age) : undefined;
  if (age !== undefined && (Number.isNaN(age) || age < 4 || age > 18)) {
    res.status(400).json({ error: 'age must be a number between 4 and 18' });
    return;
  }
  // Ids the child has already been given. A reassessment must serve fresh
  // material: a second run on the same items measures memory, not thinking.
  const excludeRaw = typeof req.query.exclude === 'string' ? req.query.exclude : '';
  const exclude = excludeRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);

  const profile = profileForAge(age);
  const trait = req.query.trait;
  const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
  if ((trait !== undefined && (typeof trait !== 'string' || !TRAIT_ORDER.includes(trait as TraitKey))) || ![2, 5, 6].includes(limit)) {
    res.status(400).json({ error: 'Choose a valid category and a round length of 2, 5, or 6.' });
    return;
  }
  const selection = selectQuestions({ age, limit, exclude, trait: trait as TraitKey | undefined });

  const followUpQuestions: Record<string, PublicQuestion> = {};
  for (const q of selection.followUps) {
    followUpQuestions[q.id] = toPublicQuestion(q);
  }

  const payload: TestPayload = {
    traits: TRAIT_ORDER.map((k) => ({
      key: k,
      label: TRAITS[k].label,
      blurb: TRAITS[k].blurb,
      measurable: TRAITS[k].measurable,
    })),
    questionCount: selection.questions.length,
    questions: selection.questions.map(toPublicQuestion),
    followUpQuestions,
    profile,
    poolExhausted: selection.poolExhausted,
    remainingUnseen: selection.remainingUnseen,
  };
  res.json(payload);
});

/**
 * Speech for a question, as plain audio at a URL.
 *
 * A GET returning audio bytes rather than base64 in JSON, because then the
 * audio player can stream the URL directly on every platform — no blobs, no
 * temporary files, no base64 round trip. The text is the app's own question
 * text, never anything about the child.
 */
app.get('/api/speak', async (req: Request, res: Response) => {
  const text = typeof req.query.text === 'string' ? req.query.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  try {
    const { audio, cached } = await synthesizeSpeech(text);
    res.setHeader('Content-Type', SPEECH_MIME);
    res.setHeader('Content-Length', String(audio.byteLength));
    // Let the client cache too: the same question is replayed whenever the
    // child taps the speaker button.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Speech-Cache', cached ? 'hit' : 'miss');
    res.end(audio);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n  x SPEECH FAILED\n    ${detail}\n`);
    // The app falls back to the device voice, so this degrades rather than
    // leaving a pre-reader with no way to hear the question.
    res.status(502).json({ error: 'Could not generate speech', detail });
  }
});

const TranscribeSchema = z.object({
  /** Base64 recording. Chosen over multipart because it is far less fragile
   *  from React Native, at the cost of about a third more bytes. */
  audioBase64: z.string().min(16).max(12_000_000),
  filename: z.string().max(120).default('answer.m4a'),
  /** What the recorder said the audio is. More reliable than the filename. */
  mimeType: z.string().max(80).optional(),
});

app.post('/api/transcribe', async (req: Request, res: Response) => {
  const parsed = TranscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid audio payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const audio = Buffer.from(parsed.data.audioBase64, 'base64');
    const text = await transcribeAnswer(audio, parsed.data.filename, parsed.data.mimeType);
    res.json({ text });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n  x TRANSCRIPTION FAILED\n    ${detail}\n`);
    // The app falls back to letting a grown-up type the answer, so this is a
    // degraded path rather than a dead end.
    res.status(502).json({ error: 'Could not transcribe the recording', detail });
  }
});

const SubmissionSchema = z.object({
  child: z
    .object({
      firstName: z.string().max(60).optional(),
      age: z.number().int().min(4).max(18).optional(),
    })
    .optional(),
  responses: z
    .array(
      z.object({
        questionId: z.string().max(40),
        answer: z.string().max(4000),
        elapsedSeconds: z.number().nonnegative().optional(),
      })
    )
    .min(1)
    .max(100),
});

app.post('/api/submit', async (req: Request, res: Response) => {
  const parsed = SubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid submission', details: parsed.error.flatten() });
    return;
  }

  const { child, responses } = parsed.data;

  try {
    const report = await scoreSubmission(responses);

    // The written report is generated from the scores, not the other way round.
    // If it fails, the scores still stand, so never let it fail the request.
    try {
      report.parentReport = await generateParentReport(report, child?.firstName, child?.age);
    } catch (err) {
      report.parentReport = null;
      report.parentReportError = err instanceof Error ? err.message : String(err);
      console.error(`\n  ✗ REPORT GENERATION FAILED\n    ${report.parentReportError}\n`);
    }

    res.json(report);
  } catch (err) {
    console.error('Scoring failed:', err);
    res.status(500).json({
      error: 'Scoring failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`KidCog API listening on http://localhost:${port}`);

  // A malformed question is worth a loud line here rather than a child
  // discovering it. Non-fatal: one broken item should not stop the server.
  const bad = bankProblems();
  if (bad.length > 0) {
    console.error('');
    console.error(`  !!  ${bad.length} PROBLEM(S) IN THE QUESTION BANK`);
    for (const p of bad) console.error(`     ${p}`);
    console.error('');
  }
  if (process.env.USE_MOCK_GRADER === '1') {
    console.log('Mock grader is ON — open answers are scored by a crude local heuristic.');
    console.log('Set USE_MOCK_GRADER=0 in server/.env for real AI grading.');
    return;
  }

  const problem = apiKeyProblem();
  if (problem) {
    // Refuse to start quietly. Every submission would fail with a 401 and the
    // app would just say "couldn't be graded", which tells nobody anything.
    console.error('');
    console.error('  ⚠  AI GRADING WILL FAIL ON EVERY REQUEST');
    console.error(`     ${problem}`);
    console.error('     Fix: put a real key in server/.env, or set USE_MOCK_GRADER=1.');
    console.error('');
  } else {
    console.log(`AI grading enabled — model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  }
});

export default app;
