import type { GeneratedQuestion } from './generatedQuestions.js';
import type { Report, ResponseInput } from './types.js';
import { supabaseAdmin } from './supabase.js';

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

export async function getOrCreateSession(parentId: string, childId: string, sessionId?: string | null) {
  if (sessionId) {
    const { data, error } = await supabaseAdmin.from('assessment_sessions').select('id').eq('id', sessionId).eq('parent_id', parentId).eq('child_id', childId).maybeSingle();
    fail(error); if (!data) throw new Error('Assessment session was not found.'); return data.id as string;
  }
  const { data, error } = await supabaseAdmin.from('assessment_sessions').insert({ parent_id: parentId, child_id: childId, status: 'in_progress' }).select('id').single();
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
  const updated = await supabaseAdmin.from('assessment_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), overall_earned: report.overall.earned, overall_possible: report.overall.possible, overall_percent: report.overall.percent, parent_report: report.parentReport ?? null, disclaimer: report.disclaimer }).eq('id', sessionId).eq('parent_id', parentId);
  fail(updated.error);
}
