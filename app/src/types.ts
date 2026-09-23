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

export type TraitKey =
  | 'abstract_concepts'
  | 'beyond_experience'
  | 'generalization'
  | 'cause_effect'
  | 'challenge_seeking'
  | 'curiosity'
  | 'original_methods'
  | 'observant'
  | 'perfectionism'
  | 'strong_ideas'
  | 'questions_authority'
  | 'motivation_focus'
  | 'humor'
  | 'sensitivity_others';

export type Measurability = 'direct' | 'inferred' | 'behaviour';

export interface TraitMetaPublic {
  group?: 'intellectual' | 'social_emotional';
  key: TraitKey;
  label: string;
  blurb: string;
  measurable: Measurability;
}

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

// --- Figural questions: the spec the server sends and Figure.tsx draws. ---

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'heart'
  | 'arrow';

export type ShapeFill = 'solid' | 'outline' | 'half';

export interface Shape {
  kind: ShapeKind;
  fill: ShapeFill;
  /** Palette slot, not a hex value: the app owns the actual colours. */
  tone?: 'ink' | 'primary' | 'cool' | 'go' | 'happy';
  rotate?: number;
  scale?: number;
}

export interface FigureCell {
  shapes: Shape[];
  /** The cell the child has to work out. Drawn as a question mark. */
  missing?: boolean;
}

export interface FigureSpec {
  kind: 'matrix' | 'series' | 'group';
  columns: number;
  cells: FigureCell[];
}

export type AgeProfileKey = 'early' | 'middle';

/** Mirrors the server's AgeProfile. Drives how the app presents everything. */
export interface AgeProfile {
  key: AgeProfileKey;
  label: string;
  ageBand: [number, number];
  readAloud: boolean;
  openAnswerMode: 'voice' | 'text' | 'both' | 'none';
  maxQuestions: number;
  showTimer: boolean;
  showScoreToChild: boolean;
  celebrateEachAnswer: boolean;
  uiScale: number;
}

export interface McqOption {
  key: string;
  text: string;
  symbol?: string;
  /** A drawn shape, for figural items. */
  figure?: FigureCell;
}

export interface PublicQuestion {
  id: string;
  trait: TraitKey;
  type: 'mcq' | 'open' | 'challenge';
  prompt: string;
  options: McqOption[] | null;
  timeLimitSeconds: number | null;
  visual: string | null;
  figure: FigureSpec | null;
  format: ItemFormat;
  spoken: string | null;
  /** Challenge items only: which question follows each choice. */
  followUp: Record<string, string> | null;
  /** Question plus options, composed server-side, for the read-aloud voice. */
  speechText: string;
}

export interface TestPayload {
  sessionId: string;
  traits: TraitMetaPublic[];
  questionCount: number;
  questions: PublicQuestion[];
  /** Follow-ups behind challenge choices, keyed by id. */
  followUpQuestions: Record<string, PublicQuestion>;
  profile: AgeProfile;
  /** True when too few unseen questions remained to fill a session. */
  poolExhausted: boolean;
  remainingUnseen: number;
}

export interface ChildProfile {
  id?: string;
  firstName?: string;
  age?: number;
}

export interface SavedChildProfile {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface AssessmentSessionSummary {
  id: string;
  startedAt: string;
  completedAt: string;
  age: number | null;
  overall: { earned: number; possible: number; percent: number };
  categories: string[];
  questionCount: number;
}

export interface HistoricalAssessment {
  id: string;
  childId: string;
  childName: string;
  age: number | null;
  completedAt: string;
  report: Report;
}

export interface ResponseInput {
  questionId: string;
  answer: string;
  elapsedSeconds?: number;
}

export interface ScoredResponse {
  questionId: string;
  trait: TraitKey;
  type: 'mcq' | 'open' | 'challenge';
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
  /** Null when the session produced no evidence: reported as "not seen". */
  formScale: { value: number; label: string } | null;
  /** Plain sentence describing how thin or solid the evidence is. */
  evidence: string;
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
  traits: TraitReport[];
  strongest: string | null;
  growthArea: string | null;
  responses: ScoredResponse[];
  /** Ids served this session, remembered so the next round serves fresh ones. */
  seenQuestionIds: string[];
  graderFailed: string | null;
  disclaimer: string;
  parentReport?: ParentReport | null;
  parentReportError?: string;
}
