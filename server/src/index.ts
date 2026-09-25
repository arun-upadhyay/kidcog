import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';

import { generateRound, publicQuestion, generatedQuestionById, rememberGeneratedQuestion } from './generatedQuestions.js';
import { TRAITS, TRAIT_ORDER, type TraitKey } from './traits.js';
import { profileForAge } from './ageProfiles.js';
import { transcribeAnswer } from './transcribe.js';
import { synthesizeSpeech, SPEECH_MIME } from './speak.js';
import { scoreSubmission } from './scoring.js';
import { generateParentReport, apiKeyProblem } from './grader.js';
import type { PublicQuestion, TestPayload } from './types.js';
import { supabaseReady, userIdFromBearer } from './supabase.js';
import { isAccountDeleted, scheduleAccountDeletion, startPurgeSchedule, PURGE_AFTER_DAYS } from './accountDeletion.js';
import { childBelongsTo, deleteAssessmentSession, deleteChildProfile, findOrCreateChild, getOrCreateSession, historicalAssessment, listChildren, listCompletedSessions, loadGeneratedQuestions, saveGeneratedQuestions, saveReport } from './repository.js';

type AuthRequest = Request & { parentId?: string };
async function requireParent(req: AuthRequest, res: Response, next: NextFunction) {
  if (!supabaseReady()) { res.status(503).json({ error: 'Parent sign-in is not configured on the server.' }); return; }
  const parentId = await userIdFromBearer(req.header('authorization'));
  if (!parentId) { res.status(401).json({ error: 'Please sign in again.' }); return; }
  // A deleted account keeps no access, even with a token issued before it was deleted.
  if (await isAccountDeleted(parentId)) { res.status(403).json({ error: 'This account has been deleted.', code: 'account_deleted' }); return; }
  req.parentId = parentId; next();
}

const app = express();
// On a host like Render every request arrives through its proxy. Without this,
// req.ip is the proxy's address, so the rate limiter below would treat all
// parents as one client and share a single 30-a-minute allowance between them.
app.set('trust proxy', 1);
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
  const mock = false;
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

app.get('/api/categories', requireParent, (_req: Request, res: Response) => {
  res.json(TRAIT_ORDER.map((key) => ({ ...TRAITS[key], group: TRAITS[key].group ?? 'intellectual' })));
});

/**
 * Delete the signed-in parent's account. Sign-in is blocked and the data hidden
 * immediately; everything is permanently erased after PURGE_AFTER_DAYS.
 * The body must say {"confirm":"DELETE"} so a stray request cannot do this.
 */
app.delete('/api/account', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ confirm: z.literal('DELETE') }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Type DELETE to confirm.' }); return; }
  const token = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  try {
    const { purgeAfter } = await scheduleAccountDeletion(req.parentId!, token);
    res.json({ deleted: true, purgeAfter, graceDays: PURGE_AFTER_DAYS });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete the account.', detail: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/children', requireParent, async (req: AuthRequest, res: Response) => {
  try { res.json(await listChildren(req.parentId!)); }
  catch (err) { res.status(500).json({ error: 'Could not load child profiles.', detail: err instanceof Error ? err.message : String(err) }); }
});

app.post('/api/children', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ nickname: z.string().trim().min(1).max(60), age: z.number().int().min(4).max(12) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a first name or nickname.' }); return; }
  try { res.status(201).json(await findOrCreateChild(req.parentId!, parsed.data.nickname, parsed.data.age)); }
  catch (err) { res.status(500).json({ error: 'Could not save child profile.', detail: err instanceof Error ? err.message : String(err) }); }
});

app.delete('/api/children/:childId', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.childId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid child profile.' }); return; }
  try {
    const deleted = await deleteChildProfile(req.parentId!, parsed.data);
    if (!deleted) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Could not delete the child profile.', detail: err instanceof Error ? err.message : String(err) }); }
});

app.get('/api/children/:childId/sessions', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ childId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).default(0) }).safeParse({ ...req.params, ...req.query });
  if (!parsed.success) { res.status(400).json({ error: 'Invalid history request.' }); return; }
  try {
    const result = await listCompletedSessions(req.parentId!, parsed.data.childId, parsed.data.limit, parsed.data.offset);
    if (!result) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Could not load assessment history.', detail: err instanceof Error ? err.message : String(err) }); }
});

app.get('/api/sessions/:sessionId/report', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid assessment session.' }); return; }
  try {
    const result = await historicalAssessment(req.parentId!, parsed.data);
    if (!result) { res.status(404).json({ error: 'This completed report is unavailable.' }); return; }
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Could not load the assessment report.', detail: err instanceof Error ? err.message : String(err) }); }
});

app.delete('/api/sessions/:sessionId', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid assessment session.' }); return; }
  try {
    const deleted = await deleteAssessmentSession(req.parentId!, parsed.data);
    if (!deleted) { res.status(404).json({ error: 'Assessment result was not found.' }); return; }
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Could not delete the assessment result.', detail: err instanceof Error ? err.message : String(err) }); }
});

/** The test the app should present. Answer keys and rubrics stay on the server. */
const pendingRounds = new Map<string, Promise<TestPayload>>();
app.post('/api/test', requireParent, async (req: AuthRequest, res: Response) => {
  const input = z.object({ childProfileId: z.string().uuid(), sessionId: z.string().uuid().nullable().optional(), age: z.number().int().min(4).max(12), trait: z.enum(TRAIT_ORDER as [typeof TRAIT_ORDER[number], ...typeof TRAIT_ORDER[number][]]), count: z.union([z.literal(2), z.literal(5), z.literal(6)]), requestId: z.string().uuid() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Choose an age, category, and 2, 5, or 6 questions.' }); return; }
  const { childProfileId, sessionId: requestedSessionId, age, trait, count, requestId } = input.data;
  const key = JSON.stringify([req.parentId, requestId, age, trait, count]);
  try {
    if (!await childBelongsTo(req.parentId!, childProfileId)) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    let work = pendingRounds.get(key);
    if (!work) {
      work = (async () => {
        const sessionId = await getOrCreateSession(req.parentId!, childProfileId, age, requestedSessionId);
        const questions = await generateRound(age, trait, count);
        await saveGeneratedQuestions(req.parentId!, sessionId, questions);
        return { sessionId, traits: TRAIT_ORDER.map(k => ({ ...TRAITS[k], group: TRAITS[k].group ?? 'intellectual' })), questions: questions.map(publicQuestion), questionCount: questions.length, followUpQuestions: {}, profile: profileForAge(age), poolExhausted: false, remainingUnseen: -1 };
      })();
      pendingRounds.set(key, work);
      void work.then(() => { const timer = setTimeout(() => pendingRounds.delete(key), 120_000); timer.unref(); }, () => pendingRounds.delete(key));
    }
    res.json(await work);
  } catch (err) {
    res.status(502).json({ error: 'AI could not generate this round. Please try again.', detail: err instanceof Error ? err.message : String(err) });
  }
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

app.post('/api/transcribe', requireParent, async (req: Request, res: Response) => {
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
  sessionId: z.string().uuid(),
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

app.post('/api/submit', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = SubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid submission', details: parsed.error.flatten() });
    return;
  }

  const { sessionId, child, responses } = parsed.data;

  try {
    if (new Set(responses.map(r => r.questionId)).size !== responses.length) { res.status(400).json({ error: 'A question was submitted more than once.' }); return; }
    const ownedQuestions = await loadGeneratedQuestions(req.parentId!, sessionId, responses.map(r => r.questionId));
    if (ownedQuestions.length !== responses.length) { res.status(410).json({ error: 'These questions do not belong to this parent session.' }); return; }
    ownedQuestions.forEach(rememberGeneratedQuestion);
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

    await saveReport(req.parentId!, sessionId, responses, report);

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
  startPurgeSchedule();


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
