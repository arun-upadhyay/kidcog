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

export type AgeProfileKey = 'early' | 'middle';

/** Everything that differs between age bands. See ageProfiles.ts. */
export interface AgeProfile {
  key: AgeProfileKey;
  label: string;
  ageBand: [number, number];
  /** Speak questions aloud, for children who cannot read yet. */
  readAloud: boolean;
  /**
   * How open-ended answers are captured.
   *   voice - microphone only (children who cannot type)
   *   text  - keyboard only
   *   both  - keyboard with a microphone beside it
   *   none  - no open-ended items for this band
   */
  openAnswerMode: 'voice' | 'text' | 'both' | 'none';
  /** Cap on questions per session. Young children fade long before we run out. */
  maxQuestions: number;
  /** A visible countdown makes young children rush rather than think. */
  showTimer: boolean;
  /** Whether the child sees the score, or only a grown-up does. */
  showScoreToChild: boolean;
  /** Acknowledge every answer, rather than saving feedback for the end. */
  celebrateEachAnswer: boolean;
  /** Multiplier on touch targets and type size. */
  uiScale: number;
}

export interface McqOption {
  key: string;
  text: string;
  /** A large symbol shown instead of, or beside, the text for pre-readers. */
  symbol?: string;
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
  /**
   * A large visual shown above the question — shapes, emoji, a counted row.
   * For pre-readers this often carries the whole question and the prompt is
   * only what gets spoken aloud.
   */
  visual?: string;
  /**
   * What the read-aloud voice says, when the written prompt would sound wrong
   * spoken (symbols, "___", and so on). Falls back to `prompt`.
   */
  spoken?: string;
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
  visual: string | null;
  spoken: string | null;
}

export interface TestPayload {
  domains: Record<DomainKey, DomainMeta>;
  questionCount: number;
  questions: PublicQuestion[];
  /** Drives how the app presents everything. See ageProfiles.ts. */
  profile: AgeProfile;
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

/**
 * The written report for the parent, produced by the model from the scored
 * session. Structured rather than one blob of prose so the app can lay it out,
 * and so a weak section is visibly weak instead of hiding inside a paragraph.
 */
export interface ParentReport {
  /** Two or three warm sentences opening the report. */
  opening: string;
  /** What went well, each tied to something the child actually did. */
  strengths: string[];
  /** Where they struggled. Framed as observations, never as deficits. */
  stuckPoints: string[];
  /**
   * What the pattern of answers suggests about how the child approached the
   * questions — the part per-item grading cannot see.
   */
  thinkingNotes: string;
  /** Concrete things a parent could do, usable without special materials. */
  practiceIdeas: string[];
  /** Closing caveat about what a single session can and cannot show. */
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
  /** Added by the route once scoring succeeds. Null if generation failed. */
  parentReport?: ParentReport | null;
  parentReportError?: string;
}
