import type { GeneratedQuestion } from './generatedQuestions.js';
import type { Report, ResponseInput } from './types.js';
import { supabaseAdmin } from './supabase.js';
import { TRAITS, TRAIT_ORDER, type TraitKey } from './traits.js';

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

// The avatar column arrives with migration 202609270001. Until it is applied,
// fall back to the old columns so child profiles keep working (pictures just
// don't save), and say so once in the server log.
const CHILD_COLUMNS = 'id,nickname,age,avatar,created_at';
const CHILD_COLUMNS_NO_AVATAR = 'id,nickname,age,created_at';
let avatarColumnMissing = false;
function isMissingAvatarColumn(error: { message: string } | null) {
  if (!error || !/avatar/i.test(error.message)) return false;
  if (!avatarColumnMissing) console.warn('  ⚠ child_profiles.avatar is missing. Run supabase/migrations/202609270001_child_profile_avatar.sql so avatar choices are saved.');
  avatarColumnMissing = true;
  return true;
}
function childColumns() { return avatarColumnMissing ? CHILD_COLUMNS_NO_AVATAR : CHILD_COLUMNS; }

type ChildRow = { id: string; nickname: string; age: number | null; avatar?: string | null; created_at: string };
function toChild(row: ChildRow) {
  return { id: row.id, nickname: row.nickname, age: row.age, avatar: row.avatar ?? null, createdAt: row.created_at };
}

/** Runs a child_profiles query, retrying once without the avatar column if it isn't there yet. */
async function withChildColumns<T extends { error: { message: string } | null }>(run: (columns: string) => PromiseLike<T>): Promise<T> {
  const first = await run(childColumns());
  if (isMissingAvatarColumn(first.error)) return run(childColumns());
  return first;
}

export async function listChildren(parentId: string) {
  const { data, error } = await withChildColumns(columns => supabaseAdmin.from('child_profiles').select(columns).eq('parent_id', parentId).order('created_at'));
  fail(error); return ((data ?? []) as unknown as ChildRow[]).map(toChild);
}

export async function findOrCreateChild(parentId: string, nickname: string, age: number, avatar?: string) {
  const existing = await withChildColumns(columns => supabaseAdmin.from('child_profiles').select(columns).eq('parent_id', parentId).ilike('nickname', nickname).limit(1).maybeSingle());
  fail(existing.error);
  let row = existing.data as unknown as ChildRow | null;
  // Only send the avatar when there is one and the column exists.
  const withAvatar = <T extends object>(fields: T) => (avatar && !avatarColumnMissing ? { ...fields, avatar } : fields);
  if (row) {
    const id = row.id;
    const updated = await withChildColumns(columns => supabaseAdmin.from('child_profiles').update(withAvatar({ age })).eq('id', id).eq('parent_id', parentId).select(columns).single());
    fail(updated.error); row = updated.data as unknown as ChildRow;
  } else {
    const inserted = await withChildColumns(columns => supabaseAdmin.from('child_profiles').insert(withAvatar({ parent_id: parentId, nickname, age })).select(columns).single());
    fail(inserted.error); row = inserted.data as unknown as ChildRow;
  }
  if (!row) throw new Error('Could not save child profile.');
  return toChild(row);
}

/** Changes a child's picture. Returns null when the child isn't this parent's. */
export async function updateChildAvatar(parentId: string, childId: string, avatar: string) {
  const missing = new Error('Avatar pictures need the latest database update (migration 202609270001_child_profile_avatar.sql).');
  if (avatarColumnMissing) throw missing;
  const { data, error } = await supabaseAdmin.from('child_profiles').update({ avatar }).eq('id', childId).eq('parent_id', parentId).select(CHILD_COLUMNS).maybeSingle();
  if (isMissingAvatarColumn(error)) throw missing;
  fail(error); return data ? toChild(data as unknown as ChildRow) : null;
}

export async function childBelongsTo(parentId: string, childId: string) {
  const { data, error } = await supabaseAdmin.from('child_profiles').select('id').eq('id', childId).eq('parent_id', parentId).maybeSingle();
  fail(error); return Boolean(data);
}

export async function deleteChildProfile(parentId: string, childId: string) {
  const { data, error } = await supabaseAdmin.from('child_profiles').delete().eq('id', childId).eq('parent_id', parentId).select('id').maybeSingle();
  fail(error);
  return Boolean(data);
}

export async function getOrCreateSession(parentId: string, childId: string, age: number, sessionId?: string | null) {
  if (sessionId) {
    const { data, error } = await supabaseAdmin.from('assessment_sessions').select('id').eq('id', sessionId).eq('parent_id', parentId).eq('child_id', childId).maybeSingle();
    fail(error); if (!data) throw new Error('Assessment session was not found.'); return data.id as string;
  }
  const { data, error } = await supabaseAdmin.from('assessment_sessions').insert({ parent_id: parentId, child_id: childId, age_snapshot: age, status: 'in_progress' }).select('id').single();
  fail(error); if (!data) throw new Error('Could not create assessment session.'); return data.id as string;
}

export async function saveGeneratedQuestions(parentId: string, sessionId: string, questions: GeneratedQuestion[]) {
  const rows = questions.map(question => ({ id: question.id, session_id: sessionId, parent_id: parentId, category_key: question.trait, question_type: question.type, prompt: question.prompt, private_payload: question, ...(question.bankQuestionId ? { bank_question_id: question.bankQuestionId } : {}) }));
  let { error } = await supabaseAdmin.from('generated_questions').upsert(rows, { onConflict: 'id' });
  // Before the question-bank migration there is no bank_question_id column.
  if (error && /bank_question_id/i.test(error.message)) {
    ({ error } = await supabaseAdmin.from('generated_questions').upsert(rows.map(({ bank_question_id: _unused, ...row }: Record<string, unknown>) => row), { onConflict: 'id' }));
  }
  fail(error);
}

// ---------------------------------------------------------------------------
// Shared question bank (migration 202609280001_question_bank.sql)
// ---------------------------------------------------------------------------

export type BankCandidate = { id: string; type: 'open' | 'mcq'; skillFacet: string; prompt: string; question: GeneratedQuestion; servedCount: number; seen: boolean };

/** Bank questions for this category and age, least used first, flagged if this child has had them. */
export async function bankCandidates(parentId: string, childId: string, trait: string, age: number): Promise<BankCandidate[]> {
  const { data, error } = await supabaseAdmin.rpc('bank_candidates', { p_parent: parentId, p_child: childId, p_category: trait, p_age: age, p_limit: 300 });
  fail(error);
  return ((data ?? []) as Array<{ id: string; question_type: 'open' | 'mcq'; skill_facet: string; prompt: string; payload: GeneratedQuestion; served_count: number; seen: boolean }>)
    .map(row => ({ id: row.id, type: row.question_type, skillFacet: row.skill_facet, prompt: row.prompt, question: row.payload, servedCount: row.served_count, seen: row.seen }));
}

/** Adds checked questions to the bank. A question already there (same wording) is skipped. */
export async function insertBankQuestions(trait: string, age: number, questions: GeneratedQuestion[]) {
  if (questions.length === 0) return;
  const rows = questions.map(q => ({ id: q.id, category_key: trait, age, question_type: q.type, skill_facet: q.skillFacet ?? '', prompt: q.prompt, payload: q }));
  const { error } = await supabaseAdmin.from('question_bank').upsert(rows, { onConflict: 'category_key,age,prompt_key', ignoreDuplicates: true });
  fail(error);
}

/**
 * Makes sure reviewed file questions are in the bank under their own ids, with
 * the reviewed wording. Keeps each row's use count and "retired" flag, so a
 * question a parent reported stays out even if it is still in a file.
 * Returns how many rows could not be written (for example, the same wording
 * already stored under a different id).
 */
export async function upsertBankQuestionsById(trait: string, age: number, questions: GeneratedQuestion[]): Promise<number> {
  if (questions.length === 0) return 0;
  const rows = questions.map(q => ({ id: q.id, category_key: trait, age, question_type: q.type, skill_facet: q.skillFacet ?? '', prompt: q.prompt, payload: q }));
  const { error } = await supabaseAdmin.from('question_bank').upsert(rows, { onConflict: 'id' });
  if (!error) return 0;
  // One bad row fails the whole batch; retry one by one so the rest get in.
  let failed = 0;
  for (const row of rows) {
    const single = await supabaseAdmin.from('question_bank').upsert(row, { onConflict: 'id' });
    if (single.error) { failed++; console.warn(`  ⚠ Question ${row.id} (${trait}, age ${age}) could not be stored: ${single.error.message}`); }
  }
  return failed;
}

export async function markBankServed(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.rpc('bank_mark_served', { p_ids: ids });
  fail(error);
}

/** Takes a question out of the shared bank so no child is given it again. */
export async function retireBankQuestion(id: string) {
  const { error } = await supabaseAdmin.from('question_bank').update({ retired: true }).eq('id', id);
  fail(error);
}

// ---------------------------------------------------------------------------
// Reports about AI-made content (migration 202609300001_content_reports.sql)
// ---------------------------------------------------------------------------

export type ContentReport = {
  parentId: string; sessionId: string; kind: 'question' | 'note';
  questionId?: string | null; bankQuestionId?: string | null; content: string;
  reason: 'inappropriate' | 'wrong' | 'confusing' | 'other'; details?: string | null;
};

export async function saveContentReport(report: ContentReport) {
  const { error } = await supabaseAdmin.from('content_reports').insert({
    parent_id: report.parentId, session_id: report.sessionId, kind: report.kind,
    question_id: report.questionId ?? null, bank_question_id: report.bankQuestionId ?? null,
    content: report.content.slice(0, 4000), reason: report.reason, details: report.details ?? null,
  });
  fail(error);
}

/** How many different parents have reported this bank question. */
export async function bankQuestionReporterCount(bankQuestionId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from('content_reports').select('parent_id').eq('bank_question_id', bankQuestionId).limit(1000);
  fail(error);
  return new Set((data ?? []).map(row => (row as { parent_id: string }).parent_id)).size;
}

/** The written report arrives after the scores; this adds it to the saved result. */
export async function saveParentReport(parentId: string, sessionId: string, report: Report) {
  const { error } = await supabaseAdmin.from('assessment_sessions').update({ parent_report: report.parentReport ?? null, report_snapshot: report }).eq('id', sessionId).eq('parent_id', parentId);
  fail(error);
}

export async function loadGeneratedQuestions(parentId: string, sessionId: string, ids: string[]): Promise<GeneratedQuestion[]> {
  const { data, error } = await supabaseAdmin.from('generated_questions').select('private_payload').eq('parent_id', parentId).eq('session_id', sessionId).in('id', ids);
  fail(error); return (data ?? []).map(row => row.private_payload as GeneratedQuestion);
}

export async function saveReport(parentId: string, sessionId: string, responses: ResponseInput[], report: Report) {
  const scored = new Map(report.responses.map(item => [item.questionId, item]));
  const answerRows = responses.map(response => {
    const score = scored.get(response.questionId);
    return { parent_id: parentId, session_id: sessionId, question_id: response.questionId, answer_text: response.answer, elapsed_seconds: response.elapsedSeconds ?? null, earned: score?.earned ?? 0, possible: score?.possible ?? 0, note: score?.note ?? '', skipped: score?.skipped ?? false, ungraded: score?.ungraded ?? false };
  });
  let result = await supabaseAdmin.from('assessment_answers').upsert(answerRows, { onConflict: 'session_id,question_id' }); fail(result.error);
  const categoryRows = report.traits.map(trait => ({ parent_id: parentId, session_id: sessionId, category_key: trait.key, label: trait.label, earned: trait.earned, possible: trait.possible, percent: trait.percent, evidence: trait.evidence, form_scale: trait.formScale }));
  result = await supabaseAdmin.from('category_results').upsert(categoryRows, { onConflict: 'session_id,category_key' }); fail(result.error);
  const updated = await supabaseAdmin.from('assessment_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), overall_earned: report.overall.earned, overall_possible: report.overall.possible, overall_percent: report.overall.percent, parent_report: report.parentReport ?? null, report_snapshot: report, disclaimer: report.disclaimer }).eq('id', sessionId).eq('parent_id', parentId);
  fail(updated.error);
}

export async function listCompletedSessions(parentId: string, childId: string, limit: number, offset: number) {
  if (!await childBelongsTo(parentId, childId)) return null;
  const { data, error } = await supabaseAdmin.from('assessment_sessions')
    .select('id,started_at,completed_at,age_snapshot,overall_earned,overall_possible,overall_percent,report_snapshot')
    .eq('parent_id', parentId).eq('child_id', childId).eq('status', 'completed')
    .order('completed_at', { ascending: false }).range(offset, offset + limit);
  fail(error);
  const rows = data ?? [];
  const ids = rows.map(row => row.id);
  const categoryResult = ids.length ? await supabaseAdmin.from('category_results').select('session_id,label').in('session_id', ids).gt('possible', 0) : { data: [], error: null };
  fail(categoryResult.error);
  const categories = new Map<string, string[]>();
  for (const row of categoryResult.data ?? []) categories.set(row.session_id, [...(categories.get(row.session_id) ?? []), row.label]);
  return {
    sessions: rows.slice(0, limit).map(row => {
      const snapshot = row.report_snapshot as Report | null;
      return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at, age: row.age_snapshot, overall: { earned: Number(row.overall_earned ?? 0), possible: Number(row.overall_possible ?? 0), percent: Number(row.overall_percent ?? 0) }, categories: categories.get(row.id) ?? [], questionCount: snapshot?.responses.length ?? 0 };
    }),
    hasMore: rows.length > limit,
  };
}

export async function historicalAssessment(parentId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin.from('assessment_sessions')
    .select('id,child_id,completed_at,age_snapshot,report_snapshot,parent_report,disclaimer,overall_earned,overall_possible,overall_percent,child_profiles!inner(nickname)')
    .eq('id', sessionId).eq('parent_id', parentId).eq('status', 'completed').maybeSingle();
  fail(error);
  if (!data) return null;
  const child = data.child_profiles as unknown as { nickname: string };
  if (data.report_snapshot) return { id: data.id, childId: data.child_id, childName: child.nickname, age: data.age_snapshot, completedAt: data.completed_at, report: data.report_snapshot as Report };

  const [categoriesResult, answersResult] = await Promise.all([
    supabaseAdmin.from('category_results').select('category_key,label,earned,possible,percent,evidence,form_scale').eq('session_id', sessionId).eq('parent_id', parentId),
    supabaseAdmin.from('assessment_answers').select('question_id,answer_text,elapsed_seconds,earned,possible,note,skipped,ungraded,generated_questions!inner(private_payload)').eq('session_id', sessionId).eq('parent_id', parentId),
  ]);
  fail(categoriesResult.error); fail(answersResult.error);
  const answers = answersResult.data ?? [];
  const questionCount = new Map<TraitKey, number>();
  const responses = answers.map(row => {
    const question = (row.generated_questions as unknown as { private_payload: GeneratedQuestion }).private_payload;
    questionCount.set(question.trait, (questionCount.get(question.trait) ?? 0) + 1);
    return { questionId: row.question_id, trait: question.trait, type: question.type, prompt: question.prompt, answer: row.answer_text, earned: Number(row.earned), possible: Number(row.possible), elapsedSeconds: row.elapsed_seconds === null ? null : Number(row.elapsed_seconds), note: row.note, skipped: row.skipped, ungraded: row.ungraded };
  });
  const byCategory = new Map((categoriesResult.data ?? []).map(row => [row.category_key as TraitKey, row]));
  const traits = TRAIT_ORDER.map(key => {
    const row = byCategory.get(key); const meta = TRAITS[key]; const scale = row?.form_scale as { value: number; label: string } | null | undefined;
    return { ...meta, group: meta.group ?? 'intellectual' as const, key, questionCount: questionCount.get(key) ?? 0, earned: Number(row?.earned ?? 0), possible: Number(row?.possible ?? 0), percent: Number(row?.percent ?? 0), band: scale?.label ?? 'Not observed in this session', formScale: scale ?? null, evidence: row?.evidence ?? 'This session did not include evidence for this category.' };
  });
  const observed = traits.filter(trait => trait.possible > 0).sort((a, b) => b.percent - a.percent);
  const report: Report = { version: 1, generatedAt: data.completed_at, overall: { earned: Number(data.overall_earned ?? 0), possible: Number(data.overall_possible ?? 0), percent: Number(data.overall_percent ?? 0) }, traits, strongest: observed[0]?.key ?? null, growthArea: observed.at(-1)?.key ?? null, responses, seenQuestionIds: responses.map(row => row.questionId), graderFailed: null, disclaimer: data.disclaimer ?? 'This practice activity is not an IQ test or clinical assessment.', parentReport: data.parent_report as Report['parentReport'] };
  return { id: data.id, childId: data.child_id, childName: child.nickname, age: data.age_snapshot, completedAt: data.completed_at, report };
}

export async function deleteAssessmentSession(parentId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin.from('assessment_sessions').delete().eq('id', sessionId).eq('parent_id', parentId).select('id').maybeSingle();
  fail(error);
  return Boolean(data);
}
