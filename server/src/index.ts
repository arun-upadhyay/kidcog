import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';

import { publicQuestion, rememberGeneratedQuestion } from './generatedQuestions.js';
import { bankStatus, prefetchForChild, retireQuestion, roundForChild, seedFromFiles } from './questionBank.js';
import { questionSource } from './questionFiles.js';
import { clampLevel, defaultLevel, gameShare, makeGames } from './games.js';
import type { GeneratedQuestion } from './generatedQuestions.js';
import { TRAITS, TRAIT_ORDER, type TraitKey } from './traits.js';
import { profileForAge } from './ageProfiles.js';
import { transcribeAnswer } from './transcribe.js';
import { registerSpeech, speechForKey, synthesizeSpeech, SPEECH_MIME } from './speak.js';
import { scoreSubmission } from './scoring.js';
import { generateParentReport, apiKeyProblem } from './grader.js';
import type { PublicQuestion, TestPayload } from './types.js';
import { supabaseReady, userIdFromBearer } from './supabase.js';
import { isAccountDeleted, scheduleAccountDeletion, startPurgeSchedule, PURGE_AFTER_DAYS } from './accountDeletion.js';
import { storeAppleAuthorizationCode } from './appleSignIn.js';
import { childBelongsTo, deleteAssessmentSession, deleteChildProfile, findOrCreateChild, updateChildAvatar, getOrCreateSession, historicalAssessment, listChildren, listCompletedSessions, loadGeneratedQuestions, bankQuestionReporterCount, saveContentReport, saveGeneratedQuestions, saveParentReport, saveReport } from './repository.js';
import type { Report } from './types.js';

/**
 * Raw error text (database messages, stack details) helps while developing
 * but gives an attacker hints in production. On Render, or with
 * NODE_ENV=production, responses carry only the friendly message and the
 * details go to the server log instead. SHOW_ERROR_DETAIL=1 brings them back
 * for debugging.
 */
const SHOW_ERROR_DETAIL = process.env.SHOW_ERROR_DETAIL === '1' || (process.env.NODE_ENV !== 'production' && !process.env.RENDER);
function errorDetail(err: unknown): string | undefined {
  const message = err instanceof Error ? err.message : String(err);
  if (SHOW_ERROR_DETAIL) return message;
  console.error('  x request failed:', message);
  return undefined;
}

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
// Which websites may call this server from a browser. Set ALLOWED_ORIGINS in
// production (for example https://kidcog.ritvikglobal.com); left unset, any
// origin is allowed, which is what local development needs. The phone apps
// send no Origin, and every data route still requires a signed-in parent.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors(allowedOrigins.length === 0 ? undefined : {
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)),
}));
/**
 * A simple sliding-window counter: at most `max` hits per key in `windowMs`.
 * In memory, so it resets when the server restarts and is per server; fine
 * for one Render instance. Old keys are swept every minute so the map cannot
 * grow without limit.
 */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      const kept = times.filter(t => now - t < windowMs);
      if (kept.length) hits.set(key, kept); else hits.delete(key);
    }
  }, 60_000);
  sweep.unref();
  return (key: string) => {
    const now = Date.now();
    const times = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    times.push(now);
    hits.set(key, times);
    return times.length <= max;
  };
}

// Per IP address, for every request. Runs before the body is read, so a
// flood of large requests is turned away without the server parsing them.
const perIp = limiter(Number(process.env.RATE_LIMIT_PER_MINUTE) || 30, 60_000);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!perIp(req.ip ?? 'unknown')) { res.status(429).json({ error: 'Too many requests, slow down.' }); return; }
  next();
});

// Only the voice-answer route needs room for base64 audio; everything else
// is small JSON (the largest, a finished round, is well under 1 MB).
app.use('/api/transcribe', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));

/**
 * Caps per signed-in parent on the routes that cost OpenAI credit, so one
 * account (even spread over many IP addresses) cannot run up the bill: a short
 * burst limit and a daily limit. Generous for a family playing all day.
 */
const AI_LIMITS = {
  transcribe: { perMinute: 15, perDay: 400 },
  speech: { perMinute: 40, perDay: 1500 },
  submit: { perMinute: 6, perDay: 150 },
  report: { perMinute: 5, perDay: 30 },
} as const;
type AiKind = keyof typeof AI_LIMITS;
const aiCounters = Object.fromEntries(Object.entries(AI_LIMITS).map(([kind, l]) => [kind, {
  minute: limiter(l.perMinute, 60_000),
  day: limiter(Math.max(1, Math.round(l.perDay * (Number(process.env.AI_DAILY_LIMIT_SCALE) || 1))), 24 * 60 * 60_000),
}])) as Record<AiKind, { minute: (key: string) => boolean; day: (key: string) => boolean }>;
function aiQuota(kind: AiKind) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const counter = aiCounters[kind];
    const key = req.parentId ?? req.ip ?? 'unknown';
    if (!counter.minute(key)) { res.status(429).json({ error: 'That was a lot at once. Please wait a minute and try again.' }); return; }
    if (!counter.day(key)) { res.status(429).json({ error: 'Daily limit reached for this account. Please try again tomorrow.' }); return; }
    next();
  };
}

app.get('/health', (_req: Request, res: Response) => {
  const mock = false;
  const keyProblem = mock ? null : apiKeyProblem();
  res.json({
    ok: true,
    mockGrader: mock,
    questionBank: bankStatus(),
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
    res.status(500).json({ error: 'Could not delete the account.', detail: errorDetail(err) });
  }
});

/**
 * After a native Sign in with Apple, the app sends Apple's one-time
 * authorization code so the server can keep a refresh token to revoke if the
 * parent later deletes their account.
 */
app.post('/api/apple/authorization-code', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ code: z.string().min(10).max(2000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Missing authorization code.' }); return; }
  try {
    const stored = await storeAppleAuthorizationCode(req.parentId!, parsed.data.code);
    res.status(stored ? 200 : 202).json({ stored });
  } catch (err) {
    console.error('  ✗ Could not store Apple token:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Could not store the Apple sign-in token.', detail: errorDetail(err) });
  }
});

/** Picture keys the app offers (app/src/avatars.ts); same shape the database checks. */
const AVATAR_KEY = z.string().regex(/^[a-z]{2,16}$/);

app.get('/api/children', requireParent, async (req: AuthRequest, res: Response) => {
  try { res.json(await listChildren(req.parentId!)); }
  catch (err) { res.status(500).json({ error: 'Could not load child profiles.', detail: errorDetail(err) }); }
});

app.post('/api/children', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ nickname: z.string().trim().min(1).max(60), age: z.number().int().min(4).max(12), avatar: AVATAR_KEY.optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a first name or nickname.' }); return; }
  try { res.status(201).json(await findOrCreateChild(req.parentId!, parsed.data.nickname, parsed.data.age, parsed.data.avatar)); }
  catch (err) { res.status(500).json({ error: 'Could not save child profile.', detail: errorDetail(err) }); }
});

app.patch('/api/children/:childId', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ childId: z.string().uuid(), avatar: AVATAR_KEY }).safeParse({ ...req.body, childId: req.params.childId });
  if (!parsed.success) { res.status(400).json({ error: 'Choose one of the pictures.' }); return; }
  try {
    const child = await updateChildAvatar(req.parentId!, parsed.data.childId, parsed.data.avatar);
    if (!child) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.json(child);
  } catch (err) { res.status(500).json({ error: 'Could not change the picture.', detail: errorDetail(err) }); }
});

app.delete('/api/children/:childId', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.childId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid child profile.' }); return; }
  try {
    const deleted = await deleteChildProfile(req.parentId!, parsed.data);
    if (!deleted) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Could not delete the child profile.', detail: errorDetail(err) }); }
});

app.get('/api/children/:childId/sessions', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ childId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).default(0) }).safeParse({ ...req.params, ...req.query });
  if (!parsed.success) { res.status(400).json({ error: 'Invalid history request.' }); return; }
  try {
    const result = await listCompletedSessions(req.parentId!, parsed.data.childId, parsed.data.limit, parsed.data.offset);
    if (!result) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Could not load assessment history.', detail: errorDetail(err) }); }
});

app.get('/api/sessions/:sessionId/report', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid assessment session.' }); return; }
  try {
    const result = await historicalAssessment(req.parentId!, parsed.data);
    if (!result) { res.status(404).json({ error: 'This completed report is unavailable.' }); return; }
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Could not load the assessment report.', detail: errorDetail(err) }); }
});

app.delete('/api/sessions/:sessionId', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid assessment session.' }); return; }
  try {
    const deleted = await deleteAssessmentSession(req.parentId!, parsed.data);
    if (!deleted) { res.status(404).json({ error: 'Assessment result was not found.' }); return; }
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Could not delete the assessment result.', detail: errorDetail(err) }); }
});

/** The test the app should present. Answer keys and rubrics stay on the server. */
const TRAIT_KEY = z.enum(TRAIT_ORDER as [typeof TRAIT_ORDER[number], ...typeof TRAIT_ORDER[number][]]);
const pendingRounds = new Map<string, Promise<TestPayload>>();
app.post('/api/test', requireParent, async (req: AuthRequest, res: Response) => {
  const input = z.object({ childProfileId: z.string().uuid(), sessionId: z.string().uuid().nullable().optional(), age: z.number().int().min(4).max(12), trait: TRAIT_KEY, count: z.union([z.literal(2), z.literal(5), z.literal(6)]), requestId: z.string().uuid(), level: z.number().int().min(1).max(5).optional() }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Choose an age, category, and 2, 5, or 6 questions.' }); return; }
  const { childProfileId, sessionId: requestedSessionId, age, trait, count, requestId, level } = input.data;
  const key = JSON.stringify([req.parentId, requestId, age, trait, count]);
  try {
    if (!await childBelongsTo(req.parentId!, childProfileId)) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    let work = pendingRounds.get(key);
    if (!work) {
      work = (async () => {
        const began = Date.now();
        const sessionId = await getOrCreateSession(req.parentId!, childProfileId, age, requestedSessionId);
        // Games (made by code, instantly) plus, for most categories, questions
        // from the reviewed question files (server/questions). Maths is all games.
        const games = makeGames(trait, age, clampLevel(level ?? defaultLevel(age)), gameShare(trait, count));
        const fromBank = games.length < count
          ? await roundForChild({ parentId: req.parentId!, childId: childProfileId, age, trait, count: count - games.length })
          : { questions: [] as GeneratedQuestion[], source: 'games' };
        // Alternate, starting with a game: a quick win first keeps it fun.
        const questions: GeneratedQuestion[] = [];
        for (let i = 0; questions.length < games.length + fromBank.questions.length; i++) {
          if (games[i]) questions.push(games[i]!);
          if (fromBank.questions[i]) questions.push(fromBank.questions[i]!);
        }
        await saveGeneratedQuestions(req.parentId!, sessionId, questions);
        console.info(`[round] ${trait} age ${age}, ${games.length} games + ${fromBank.questions.length} from ${fromBank.source} in ${Date.now() - began}ms`);
        const profile = profileForAge(age);
        const publicQuestions = questions.map(publicQuestion);
        // Game prompts are made fresh each time (the numbers change), so their
        // audio is only made when someone taps Listen; bank questions repeat,
        // so theirs is worth making ahead.
        if (profile.readAloud) warmSpeech(publicQuestions.filter(q => q.type !== 'game').map(q => q.speechText ?? q.prompt));
        return { sessionId, traits: TRAIT_ORDER.map(k => ({ ...TRAITS[k], group: TRAITS[k].group ?? 'intellectual' })), questions: publicQuestions, questionCount: questions.length, followUpQuestions: {}, profile, poolExhausted: false, remainingUnseen: -1 };
      })();
      pendingRounds.set(key, work);
      void work.then(() => { const timer = setTimeout(() => pendingRounds.delete(key), 120_000); timer.unref(); }, () => pendingRounds.delete(key));
    }
    res.json(await work);
  } catch (err) {
    res.status(502).json({ error: 'Could not get this round ready. Please try again.', detail: errorDetail(err) });
  }
});

/**
 * Called when a category is opened, before "Let's play": starts making
 * questions in the background if this child doesn't have a round's worth
 * ready. Answers straight away; never waits for the AI.
 */
app.post('/api/prefetch', requireParent, async (req: AuthRequest, res: Response) => {
  const input = z.object({ childProfileId: z.string().uuid(), age: z.number().int().min(4).max(12), trait: TRAIT_KEY }).safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Choose a child, age and category.' }); return; }
  try {
    if (!await childBelongsTo(req.parentId!, input.data.childProfileId)) { res.status(404).json({ error: 'Child profile was not found.' }); return; }
    res.status(202).json(await prefetchForChild({ parentId: req.parentId!, childId: input.data.childProfileId, age: input.data.age, trait: input.data.trait, largest: 6 - gameShare(input.data.trait, 6) }));
  } catch (err) {
    // Only a head start; the round itself will still work without it.
    res.status(202).json({ ready: false, working: false, detail: errorDetail(err) });
  }
});

/**
 * Make read-aloud audio for a new round in the background, two at a time, so
 * tapping "Listen" plays straight away. Each text is made once ever (speak.ts
 * keeps it), so a bank question served to many children is paid for once.
 * Set TTS_PREWARM=0 to only make audio when someone taps.
 */
function warmSpeech(texts: string[]) {
  if (process.env.TTS_PREWARM === '0' || process.env.USE_MOCK_GRADER === '1') return;
  const queue = [...new Set(texts.filter(Boolean))];
  const worker = async () => {
    for (let text = queue.shift(); text; text = queue.shift()) {
      await synthesizeSpeech(text).catch(error => console.warn(`[speak] warm-up failed: ${error instanceof Error ? error.message : error}`));
    }
  };
  void Promise.all([worker(), worker()]);
}

/**
 * Read-aloud, in two steps.
 *
 * 1. POST /api/speech-key (signed in) with the text; the answer is a code.
 * 2. GET /api/speak?key=<code> returns the audio.
 *
 * The audio is a plain GET so the player can stream it directly on every
 * platform (no blobs, temporary files or base64). It cannot carry a sign-in
 * header, which is why step 1 exists: only texts a signed-in parent registered
 * can be turned into new audio, so the open address cannot be used to spend
 * OpenAI credit, and the text itself (which can include a child's name) never
 * appears in an address or a server log.
 */
app.post('/api/speech-key', requireParent, aiQuota('speech'), (req: AuthRequest, res: Response) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(2500) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Send the text to read, up to 2,500 characters.' }); return; }
  try { res.json({ key: registerSpeech(parsed.data.text) }); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
});

app.get('/api/speak', async (req: Request, res: Response) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  if (!/^[0-9a-f]{64}$/.test(key)) {
    res.status(400).json({ error: 'Ask for a speech key first (POST /api/speech-key).' });
    return;
  }
  try {
    const result = await speechForKey(key);
    if (!result) { res.status(404).json({ error: 'Unknown speech key. Register the text again.', code: 'unknown_key' }); return; }
    res.setHeader('Content-Type', SPEECH_MIME);
    res.setHeader('Content-Length', String(result.audio.byteLength));
    // The same audio is replayed whenever the child taps Listen. Private: a
    // note read aloud can include the child's name.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Speech-Cache', result.cached ? 'hit' : 'miss');
    res.end(result.audio);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`\n  x SPEECH FAILED\n    ${detail}\n`);
    // The app falls back to the device voice, so this degrades rather than
    // leaving a pre-reader with no way to hear the question.
    res.status(502).json({ error: 'Could not generate speech', detail: SHOW_ERROR_DETAIL ? detail : undefined });
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

app.post('/api/transcribe', requireParent, aiQuota('transcribe'), async (req: Request, res: Response) => {
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
    res.status(502).json({ error: 'Could not transcribe the recording', detail: SHOW_ERROR_DETAIL ? detail : undefined });
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

/** Written notes still being prepared, by session, so the app can wait for them. */
/** Different parents who must report a bank question before it is retired automatically. */
const REPORTS_TO_RETIRE = Math.max(1, Number(process.env.REPORTS_TO_RETIRE) || 2);

const pendingReports = new Map<string, { parentId: string; work: Promise<Report> }>();

/**
 * A parent reports AI-made content: a question, or the written note. Google
 * Play requires this for apps that generate content with AI. A reported bank
 * question is retired at once, so no other child is given it; every report is
 * kept in content_reports for review.
 */
const ReportBody = z.object({
  kind: z.enum(['question', 'note']),
  sessionId: z.string().uuid(),
  questionId: z.string().min(1).max(100).optional(),
  reason: z.enum(['inappropriate', 'wrong', 'confusing', 'other']),
  details: z.string().trim().max(500).optional(),
}).strict();

app.post('/api/reports', requireParent, aiQuota('report'), async (req: AuthRequest, res: Response) => {
  const parsed = ReportBody.safeParse(req.body);
  if (!parsed.success || (parsed.data.kind === 'question' && !parsed.data.questionId)) { res.status(400).json({ error: 'That report could not be read.' }); return; }
  const { kind, sessionId, questionId, reason, details } = parsed.data;
  const parentId = req.parentId!;
  try {
    let content = '';
    let bankQuestionId: string | null = null;
    if (kind === 'question') {
      // Only a question this parent was actually given in this session.
      const [question] = await loadGeneratedQuestions(parentId, sessionId, [questionId!]).catch(() => [] as GeneratedQuestion[]);
      if (!question) { res.status(404).json({ error: 'That question could not be found.' }); return; }
      content = question.prompt;
      bankQuestionId = question.bankQuestionId ?? null;
    } else {
      const pending = pendingReports.get(sessionId);
      const note = pending && pending.parentId === parentId ? (await pending.work).parentReport : (await historicalAssessment(parentId, sessionId))?.report.parentReport;
      if (!note) { res.status(404).json({ error: 'That note could not be found.' }); return; }
      content = [note.opening, ...note.strengths, ...note.stuckPoints, note.thinkingNotes, ...note.practiceIdeas, note.closing].filter(Boolean).join('\n');
    }

    let saved = false;
    try {
      await saveContentReport({ parentId, sessionId, kind, questionId: questionId ?? null, bankQuestionId, content, reason, details: details || null });
      saved = true;
    } catch (err) {
      // Before the migration is run the report still reaches the logs.
      console.warn('  ⚠ Content report not saved (run supabase/migrations/202609300001_content_reports.sql):', err instanceof Error ? err.message : err);
      console.warn('    REPORT', JSON.stringify({ kind, sessionId, questionId, bankQuestionId, reason, details, content: content.slice(0, 300) }));
    }

    // One report no longer removes a question for everyone (a single account
    // could otherwise empty the bank on purpose). It is retired once enough
    // different parents have reported it; the rest wait for review in
    // content_reports.
    let removed = false;
    if (bankQuestionId && saved) {
      try {
        if (await bankQuestionReporterCount(bankQuestionId) >= REPORTS_TO_RETIRE) { await retireQuestion(bankQuestionId); removed = true; }
      } catch (err) { console.warn('  ⚠ Could not check or retire a reported question:', err instanceof Error ? err.message : err); }
    }
    console.log(`[report] ${kind} ${reason}${removed ? ' — question retired from the bank' : ''}`);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Could not send the report. Please try again.', detail: errorDetail(err) });
  }
});

app.get('/api/sessions/:sessionId/parent-report', requireParent, async (req: AuthRequest, res: Response) => {
  const parsed = z.string().uuid().safeParse(req.params.sessionId);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid assessment session.' }); return; }
  try {
    const pending = pendingReports.get(parsed.data);
    if (pending && pending.parentId === req.parentId) {
      const finished = await pending.work;
      res.json({ parentReport: finished.parentReport ?? null, parentReportError: finished.parentReportError ?? null });
      return;
    }
    const saved = await historicalAssessment(req.parentId!, parsed.data);
    if (!saved) { res.status(404).json({ error: 'This result is unavailable.' }); return; }
    res.json({ parentReport: saved.report.parentReport ?? null, parentReportError: saved.report.parentReport ? null : 'The written note is not available for this result.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not load the written note.', detail: errorDetail(err) });
  }
});

app.post('/api/submit', requireParent, aiQuota('submit'), async (req: AuthRequest, res: Response) => {
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
    const began = Date.now();
    const report = await scoreSubmission(responses);

    // Scores go back as soon as they exist; the written note for the grown-up
    // is written afterwards and fetched by the app (GET .../parent-report).
    // It used to be generated first, which added a second AI call's worth of
    // waiting to every finished round.
    report.parentReportPending = true;
    await saveReport(req.parentId!, sessionId, responses, report);
    console.info(`[submit] scored ${responses.length} answers in ${Date.now() - began}ms`);
    res.json(report);

    const writing = (async () => {
      const finished: Report = { ...report, parentReportPending: false };
      try {
        finished.parentReport = await generateParentReport(report, child?.firstName, child?.age);
      } catch (err) {
        finished.parentReport = null;
        finished.parentReportError = err instanceof Error ? err.message : String(err);
        console.error(`\n  ✗ REPORT GENERATION FAILED\n    ${finished.parentReportError}\n`);
      }
      await saveParentReport(req.parentId!, sessionId, finished).catch(err => console.error('Could not save the written report:', err));
      return finished;
    })();
    pendingReports.set(sessionId, { parentId: req.parentId!, work: writing });
    void writing.finally(() => { const timer = setTimeout(() => pendingReports.delete(sessionId), 120_000); timer.unref(); });
  } catch (err) {
    console.error('Scoring failed:', err);
    res.status(500).json({
      error: 'Scoring failed',
      detail: errorDetail(err),
    });
  }
});

// Last stop for errors Express raises itself (a request that is too large or
// is not valid JSON). Without this, Express answers with an HTML page that can
// include a stack trace.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = Number((err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode) || 500;
  if (status >= 500) console.error('  x unhandled error:', err);
  res.status(status).json({ error: status === 413 ? 'That request is too large.' : status < 500 ? 'That request could not be read.' : 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`KidCog API listening on http://localhost:${port}`);
  startPurgeSchedule();
  if (questionSource() === 'files') {
    void seedFromFiles().catch(error => console.warn(`  ⚠ Could not load the reviewed questions into the bank yet: ${error instanceof Error ? error.message : error}`));
  } else {
    console.log('  Questions: written by AI (no reviewed files in server/questions yet, or QUESTION_SOURCE=ai).');
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
