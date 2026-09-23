import type { GeneratedQuestion } from './generatedQuestions.js';
import type { Report, ResponseInput } from './types.js';
import { supabaseAdmin } from './supabase.js';
import { TRAITS, TRAIT_ORDER, type TraitKey } from './traits.js';

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listChildren(parentId: string) {
  const { data, error } = await supabaseAdmin.from('child_profiles').select('id,nickname,created_at').eq('parent_id', parentId).order('created_at');
  fail(error); return (data ?? []).map(row => ({ id: row.id, nickname: row.nickname, createdAt: row.created_at }));
}

export async function findOrCreateChild(parentId: string, nickname: string) {
  const existing = await supabaseAdmin.from('child_profiles').select('id,nickname,created_at').eq('parent_id', parentId).ilike('nickname', nickname).limit(1).maybeSingle();
  fail(existing.error);
  const row = existing.data ?? (await supabaseAdmin.from('child_profiles').insert({ parent_id: parentId, nickname }).select('id,nickname,created_at').single()).data;
  if (!row) throw new Error('Could not save child profile.');
  return { id: row.id, nickname: row.nickname, createdAt: row.created_at };
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
  const rows = questions.map(question => ({ id: question.id, session_id: sessionId, parent_id: parentId, category_key: question.trait, question_type: question.type, prompt: question.prompt, private_payload: question }));
  const { error } = await supabaseAdmin.from('generated_questions').upsert(rows, { onConflict: 'id' }); fail(error);
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
