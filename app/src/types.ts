/**
 * The shapes the API returns.
 *
 * These deliberately mirror `server/src/types.ts`. Two small packages, two
 * copies — which is fine at this size, but the moment they drift you will get
 * a bug that TypeScript cannot see, because the boundary between them is JSON
 * over HTTP and nothing typechecks across it.
 *
 * When that starts to hurt, the fix is to move these into a shared workspace
 * package (e.g. `packages/shared`) that both `app` and `server` depend on, and
 * import the types from there instead of redeclaring them.
 */

export type DomainKey =
  | 'verbal_reasoning'
  | 'quantitative_reasoning'
  | 'pattern_reasoning'
  | 'working_memory';

export interface DomainMeta {
  label: string;
  blurb: string;
}

export interface McqOption {
  key: string;
  text: string;
}

export interface PublicQuestion {
  id: string;
  domain: DomainKey;
  type: 'mcq' | 'open';
  prompt: string;
  options: McqOption[] | null;
  timeLimitSeconds: number | null;
}

export interface TestPayload {
  domains: Record<DomainKey, DomainMeta>;
  questionCount: number;
  questions: PublicQuestion[];
}

export interface ChildProfile {
  firstName?: string;
  age?: number;
}

export interface ResponseInput {
  questionId: string;
  answer: string;
  elapsedSeconds?: number;
}

export interface ScoredResponse {
  questionId: string;
  domain: DomainKey;
  type: 'mcq' | 'open';
  prompt: string;
  answer: string;
  earned: number;
  possible: number;
  elapsedSeconds: number | null;
  note: string;
  correct?: boolean;
  band?: number;
  ungraded?: boolean;
}

export interface DomainReport {
  key: DomainKey;
  label: string;
  blurb: string;
  questionCount: number;
  earned: number;
  possible: number;
  percent: number;
  band: string;
}

export interface ParentReport {
  opening: string;
  strengths: string[];
  stuckPoints: string[];
  thinkingNotes: string;
  practiceIdeas: string[];
  closing: string;
}

export interface Report {
  version: number;
  generatedAt: string;
  overall: { earned: number; possible: number; percent: number };
  domains: DomainReport[];
  strongest: string | null;
  growthArea: string | null;
  responses: ScoredResponse[];
  graderFailed: string | null;
  disclaimer: string;
  parentReport?: ParentReport | null;
  parentReportError?: string;
}
