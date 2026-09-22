/**
 * Shared types for the assessment domain.
 *
 * The one worth reading carefully is `Question`. It is a discriminated union on
 * `type`, which means TypeScript will not let you read `answerKey` off an
 * open-ended item or `rubric` off a multiple-choice one. That mistake is easy
 * to make by hand and produces silently wrong scores, so it is worth letting
 * the compiler own it.
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

interface QuestionBase {
  id: string;
  domain: DomainKey;
  /** Inclusive [min, max] age range this item suits. */
  ageBand: [number, number];
  /** Multiplier on the item's point value within its domain. */
  weight: number;
  prompt: string;
  timeLimitSeconds?: number;
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq';
  options: McqOption[];
  /** The `key` of the correct option. Never sent to the client. */
  answerKey: string;
}

export interface OpenQuestion extends QuestionBase {
  type: 'open';
  /** Rubric bands, highest first. Never sent to the client. */
  rubric: string[];
}

export type Question = McqQuestion | OpenQuestion;

/** The shape the app receives — answer keys and rubrics stripped out. */
export interface PublicQuestion {
  id: string;
  domain: DomainKey;
  type: Question['type'];
  prompt: string;
  options: McqOption[] | null;
  timeLimitSeconds: number | null;
}

export interface TestPayload {
  domains: Record<DomainKey, DomainMeta>;
  questionCount: number;
  questions: PublicQuestion[];
}

export interface ResponseInput {
  questionId: string;
  answer: string;
  elapsedSeconds?: number;
}

export interface ChildProfile {
  firstName?: string;
  age?: number;
}

/** What the grader is handed for a single open item. */
export interface GradeRequestItem {
  id: string;
  domain: DomainKey;
  prompt: string;
  rubric: string[];
  answer: string;
}

export interface Grade {
  id: string;
  points: number;
  note: string;
  incomplete?: boolean;
}

export interface ScoredResponse {
  questionId: string;
  domain: DomainKey;
  type: Question['type'];
  prompt: string;
  answer: string;
  earned: number;
  possible: number;
  elapsedSeconds: number | null;
  note: string;
  /** MCQ only. */
  correct?: boolean;
  /** Open only: the 0-3 rubric band awarded. */
  band?: number;
  /** Open only: set when grading failed and the item was left out of totals. */
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
  /** Added by the route once scoring succeeds. */
  summary?: string | null;
  summaryError?: string;
}
