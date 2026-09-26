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
  | 'sensitivity_others'
  | 'extensive_vocabulary'
  | 'advanced_reading'
  | 'self_motivated_writing'
  | 'viewpoint_mood_intention'
  | 'advanced_spelling'
  | 'how_things_work'
  | 'mental_math'
  | 'strategy_games'
  | 'categories_hierarchies'
  | 'intuitive_problem_solving';

export type Measurability = 'direct' | 'inferred' | 'behaviour';

export interface TraitMetaPublic {
  group?: 'intellectual' | 'social_emotional' | 'verbal_linguistic' | 'logical_mathematical';
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
  | 'choice'
  | 'game';
/**
 * Play-and-learn games. Made by code from a small content pack, not by the
 * AI: instant, free, and always correct. The answer travels with the game
 * because the app checks it on the spot to give the child instant feedback;
 * these are practice games, so that is fine (the server re-checks on submit).
 */
export interface GameThing {
  /** An emoji, or a short number/word shown on a card. */
  emoji: string;
  /** The word said and shown for it ("apple"). */
  name: string;
  /** Plural when it isn't just name + "s" ("fish", "butterflies"). */
  plural?: string;
}
export type GameShape = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
export type GameSpec =
  | { kind: 'count'; thing: GameThing; count: number; choices: number[]; answer: number }
  | { kind: 'add'; thing: GameThing; a: number; b: number; choices: number[]; answer: number }
  | { kind: 'subtract'; thing: GameThing; start: number; away: number; choices: number[]; answer: number }
  | { kind: 'compare'; ask: 'more' | 'fewer'; groups: [{ thing: GameThing; count: number }, { thing: GameThing; count: number }]; answer: number }
  | { kind: 'numberline'; max: number; start: number; hop: number; animal: GameThing; answer: number }
  | { kind: 'tenframe'; filled: number; choices: number[]; answer: number }
  | { kind: 'shapes'; target: GameShape; shapes: GameShape[]; answer: number[] }
  | { kind: 'pattern'; sequence: GameThing[]; choices: GameThing[]; answer: number }
  | { kind: 'sort'; baskets: [GameThing, GameThing]; items: GameThing[]; answer: number[] }
  | { kind: 'order'; ask: string; items: GameThing[]; answer: number[] }
  | { kind: 'match'; pairs: GameThing[]; answer: null }
  | { kind: 'oddoneout'; items: GameThing[]; answer: number }
  | { kind: 'truefalse'; picture: string; answer: boolean };
export type GameKind = GameSpec['kind'];

/**
 * What the app sends back for a game: the final value, how many slips there
 * were on the way, and whether it was solved.
 */
export interface GameResult {
  v: unknown;
  mistakes: number;
  solved: boolean;
}


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
  type: 'mcq' | 'open' | 'challenge' | 'game';
  prompt: string;
  options: McqOption[] | null;
  timeLimitSeconds: number | null;
  visual: string | null;
  figure: FigureSpec | null;
  format: ItemFormat;
  spoken: string | null;
  /** Challenge items only: which question follows each choice. */
  followUp: Record<string, string> | null;
  /** Games only: what to show and the answer to check against. */
  game?: GameSpec | null;
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
  avatar?: string;
}

export interface SavedChildProfile {
  id: string;
  nickname: string;
  age: number | null;
  /** Picture key from avatars.ts; null until one is picked. */
  avatar: string | null;
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
  type: 'mcq' | 'open' | 'challenge' | 'game';
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
  group?: 'intellectual' | 'social_emotional' | 'verbal_linguistic' | 'logical_mathematical';
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
  /** True while the written note is still being prepared; fetch it with getParentReport. */
  parentReportPending?: boolean;
}
