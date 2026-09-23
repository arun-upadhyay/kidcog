/**
 * A small declarative language for figural questions.
 *
 * Non-verbal reasoning items — figure matrices, figure series, odd-one-out —
 * are the half of gifted screening that this app had nothing for, and they
 * cannot be done with emoji. A rotation, a half-filled shape, or three squares
 * of graded size are not expressible in text, and emoji render differently on
 * every platform, which for a test item is not a cosmetic problem: if the child
 * sees a different shape than the one the item was written around, the item is
 * simply wrong.
 *
 * So figures are DATA, described here and drawn by the app. Three reasons that
 * is worth the extra structure:
 *
 *   1. The question bank stays a data file. Adding a matrix item means adding
 *      an object, not writing drawing code.
 *   2. The same spec draws the question grid and the answer options, so an
 *      option always looks exactly like the thing it is an answer to.
 *   3. Items can be validated. A matrix with the wrong number of cells is a
 *      type error rather than a mystery on screen.
 *
 * Deliberately small: enough vocabulary for genuine K-3 reasoning items, not a
 * general drawing system. Resist growing it without a question that needs it.
 */

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'heart'
  | 'arrow';

/** How much of the shape is filled — a common dimension in matrix items. */
export type ShapeFill = 'solid' | 'outline' | 'half';

export interface Shape {
  kind: ShapeKind;
  fill: ShapeFill;
  /** Palette slot, not a hex value: the app owns the actual colours. */
  tone?: 'ink' | 'primary' | 'cool' | 'go' | 'happy';
  /** Degrees clockwise. Used for rotation-rule items. */
  rotate?: number;
  /** Relative size, 1 being the default. Used for size-progression items. */
  scale?: number;
}

/**
 * One cell of a grid. Several shapes in a cell means "how many", which is how
 * count-rule items work.
 */
export interface FigureCell {
  shapes: Shape[];
  /** The cell the child has to work out. Drawn as a question mark. */
  missing?: boolean;
}

export interface FigureSpec {
  /**
   * matrix - a grid where one cell is missing (the classic matrix item)
   * series - a left-to-right sequence with the last cell missing
   * group  - an unordered set, for odd-one-out
   */
  kind: 'matrix' | 'series' | 'group';
  /** Cells per row. For `series` this is usually the whole length. */
  columns: number;
  cells: FigureCell[];
}

/**
 * Structural checks a type cannot make.
 *
 * Worth running over the bank at startup: a matrix whose cell count does not
 * fill its grid, or one with no missing cell, is a broken question that would
 * otherwise only be noticed by a child sitting in front of it.
 */
export function figureProblems(spec: FigureSpec): string[] {
  const problems: string[] = [];

  if (spec.columns < 2) problems.push('columns must be at least 2');
  if (spec.cells.length === 0) problems.push('figure has no cells');

  if (spec.kind === 'matrix') {
    if (spec.cells.length % spec.columns !== 0) {
      problems.push(
        `matrix has ${spec.cells.length} cells, which does not fill rows of ${spec.columns}`
      );
    }
  }

  const missing = spec.cells.filter((c) => c.missing).length;
  if (spec.kind === 'group') {
    if (missing > 0) problems.push('a group item should have no missing cell');
  } else if (missing !== 1) {
    problems.push(`expected exactly one missing cell, found ${missing}`);
  }

  for (const [i, cell] of spec.cells.entries()) {
    if (!cell.missing && cell.shapes.length === 0) {
      problems.push(`cell ${i} has no shapes and is not marked missing`);
    }
    if (cell.shapes.length > 4) {
      problems.push(`cell ${i} has ${cell.shapes.length} shapes; more than 4 is hard to count`);
    }
  }

  return problems;
}

/** Convenience for the common case of one shape in a cell. */
export function one(shape: Shape): FigureCell {
  return { shapes: [shape] };
}

/** Convenience for a cell repeated `n` times — count-rule items. */
export function many(shape: Shape, n: number): FigureCell {
  return { shapes: Array.from({ length: n }, () => ({ ...shape })) };
}

export const MISSING: FigureCell = { shapes: [], missing: true };
