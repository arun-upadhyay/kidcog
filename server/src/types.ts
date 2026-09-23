/**
 * Shared types for the assessment domain.
 *
 * Two worth reading carefully.
 *
 * `Question` is a discriminated union on `type`, so TypeScript will not let you
 * read `answerKey` off an open-ended item or `rubric` off a multiple-choice
 * one. That mistake is easy to make by hand and produces silently wrong scores.
 *
 * Every item carries a `trait` — one of the eight Intellectual Ability rows
 * from the Harmony GATE rating scale. Scoring aggregates by trait, so a parent
 * filling that form gets evidence per row rather than one undifferentiated
 * number. See traits.ts for what each trait is and how reachable it is.
 */

import type { FigureCell, FigureSpec } from './figures.js';
import type { TraitKey, Measurability } from './traits.js';

export type { TraitKey, Measurability };

/**
 * The kind of item, within a trait. Recorded because "strong on analogies,
 * weaker on classification" is more useful than a single number, and because
 * the question generator can be asked for a particular format.
 */
export type ItemFormat =
  | 'analogy'
  | 'classification'
  | 'sentence_completion'
  | 'figure_matrix'
  | 'figure_series'
  | 'figure_classification'
  | 'spot_the_difference'
  | 'number_series'
  | 'quantitative_relation'
  | 'prediction'
  | 'explanation'
  | 'choice';

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
  /** A drawn shape, for figural items. Rendered identically to the question. */
  figure?: FigureCell;
}

interface QuestionBase {
  id: string;
  /** Which Intellectual Ability row this item is evidence for. */
  trait: TraitKey;
  format: ItemFormat;
  /** Inclusive [min, max] age range this item suits. */
  ageBand: [number, number];
  /** Multiplier on the item's point value within its trait. */
  weight: number;
  prompt: string;
  timeLimitSeconds?: number;
  /** A large visual — shapes, emoji, a counted row — shown above the question. */
  visual?: string;
  /**
   * A drawn figure — matrix, series or group. Non-verbal items cannot be
   * expressed in text, and emoji render differently on every platform, which
   * for a test item means the child may see a different shape than the one the
   * question was written around.
   */
  figure?: FigureSpec;
  /** What the voice says, when the written prompt would sound wrong spoken. */
  spoken?: string;
  /**
   * Kept out of the normal sequence. Used for the follow-ups behind a challenge
   * choice: they are served only when the child picks that path.
   */
  hidden?: boolean;
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq';
  options: McqOption[];
  /** The `key` of the correct option. Never sent to the client. */
  answerKey: string;
  /** Private rubric score for each option key. Never sent to the client. */
  optionScores?: Record<string, number>;
}

export interface OpenQuestion extends QuestionBase {
  type: 'open';
  /** Rubric bands, highest first. Never sent to the client. */
  rubric: string[];
}

/**
 * A real choice between an easy and a hard puzzle.
 *
 * This is how "chooses and enjoys challenging tasks" gets measured. No question
 * can ask a child whether they enjoy difficulty and get a useful answer, but
 * offering the choice and seeing what they reach for is evidence.
 *
 * The choice is honoured: whichever they pick is the question they then get.
 * Offering a choice and ignoring it would teach the child their choice does not
 * matter, which is both dishonest and the opposite of what we want to observe.
 */
export interface ChallengeQuestion extends QuestionBase {
  type: 'challenge';
  /** Exactly two: the easy path and the hard path. */
  options: McqOption[];
  /** Option key -> id of the question to serve next. */
  followUp: Record<string, string>;
  /** Which option key represents reaching for the harder task. */
  hardKey: string;
}

export type Question = McqQuestion | OpenQuestion | ChallengeQuestion;

/** The shape the app receives — answer keys and rubrics stripped out. */
export interface PublicQuestion {
  id: string;
  trait: TraitKey;
  type: Question['type'];
  format: ItemFormat;
  prompt: string;
  options: McqOption[] | null;
  timeLimitSeconds: number | null;
  visual: string | null;
  figure: FigureSpec | null;
  spoken: string | null;
  /** Challenge items only: which question follows each choice. */
  followUp: Record<string, string> | null;
  /**
   * Everything the child needs to hear, composed server-side: the question AND,
   * for multiple choice, the options. A pre-reader who hears only the question
   * is choosing between words they cannot read.
   */
  speechText: string;
}

export interface TraitMetaPublic {
  group?: 'intellectual' | 'social_emotional';
  key: TraitKey;
  label: string;
  blurb: string;
  measurable: Measurability;
}

export interface TestPayload {
  sessionId: string;
  traits: TraitMetaPublic[];
  questionCount: number;
  questions: PublicQuestion[];
  /**
   * Follow-ups behind challenge choices, keyed by id. Sent up front so picking
   * a path does not need another round trip mid-session.
   */
  followUpQuestions: Record<string, PublicQuestion>;
  profile: AgeProfile;
  /**
   * True when the exclusion list left too few unseen questions to fill a
   * session. The app says so rather than quietly serving a short test.
   */
  poolExhausted: boolean;
  /** How many unseen items remain for this age after this session. */
  remainingUnseen: number;
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
  trait: TraitKey;
  prompt: string;
  rubric: string[];
  answer: string;
}

export interface Grade {
  id: string;
  points: number;
  note: string;
  /**
   * Did the child reach the answer by an unusual but valid route? Evidence for
   * "chooses original methods", which no dedicated question can ask for.
   */
  originalMethod?: boolean;
  /**
   * Did they wonder beyond the question — raise their own question, or a "what
   * if"? Evidence for "demonstrates great curiosity".
   */
  showedCuriosity?: boolean;
  incomplete?: boolean;
}

export interface ScoredResponse {
  questionId: string;
  trait: TraitKey;
  type: Question['type'];
  prompt: string;
  answer: string;
  earned: number;
  possible: number;
  elapsedSeconds: number | null;
  note: string;
  correct?: boolean;
  band?: number;
  ungraded?: boolean;
  /** Left blank: reported as missing evidence rather than scored as wrong. */
  skipped?: boolean;
  /** Challenge items: whether the child reached for the harder task. */
  choseHarder?: boolean;
}

export interface TraitReport {
  group?: 'intellectual' | 'social_emotional';
  key: TraitKey;
  label: string;
  blurb: string;
  measurable: Measurability;
  questionCount: number;
  earned: number;
  possible: number;
  percent: number;
  band: string;
  /**
   * Null when the session produced no evidence for this trait. Reported as
   * "not seen" rather than zero: a parent reading 0 beside "demonstrates great
   * curiosity" would take it as a judgement, not as missing data.
   */
  formScale: { value: number; label: string } | null;
  /** Plain sentence describing how thin or solid the evidence is. */
  evidence: string;
}

/**
 * The written report for the parent, produced by the model from the scored
 * session. Structured rather than one blob of prose so the app can lay it out,
 * and so a weak section is visibly weak instead of hiding inside a paragraph.
 */
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
  traits: TraitReport[];
  strongest: string | null;
  growthArea: string | null;
  responses: ScoredResponse[];
  /** Ids served this session, for the app to remember and exclude next time. */
  seenQuestionIds: string[];
  graderFailed: string | null;
  disclaimer: string;
  parentReport?: ParentReport | null;
  parentReportError?: string;
}
