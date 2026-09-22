import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';

import { getQuestions, toPublicQuestion, DOMAINS } from './questions.js';
import { scoreSubmission } from './scoring.js';
import { generateParentReport, apiKeyProblem } from './grader.js';
import type { TestPayload } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

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

/** The test the app should present. Answer keys and rubrics stay on the server. */
app.get('/api/test', (req: Request, res: Response) => {
  const age = req.query.age !== undefined ? Number(req.query.age) : undefined;
  if (age !== undefined && (Number.isNaN(age) || age < 4 || age > 18)) {
    res.status(400).json({ error: 'age must be a number between 4 and 18' });
    return;
  }
  const questions = getQuestions({ age }).map(toPublicQuestion);
  const payload: TestPayload = {
    domains: DOMAINS,
    questionCount: questions.length,
    questions,
  };
  res.json(payload);
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
      report.parentReport = await generateParentReport(report, child?.firstName);
    } catch (err) {
      report.parentReport = null;
      report.parentReportError = err instanceof Error ? err.message : String(err);
      console.error(`\n  x REPORT GENERATION FAILED\n    ${report.parentReportError}\n`);
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
    console.error('  !!  AI GRADING WILL FAIL ON EVERY REQUEST');
    console.error(`     ${problem}`);
    console.error('     Fix: put a real key in server/.env, or set USE_MOCK_GRADER=1.');
    console.error('');
  } else {
    console.log(`AI grading enabled - model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  }
});

export default app;
