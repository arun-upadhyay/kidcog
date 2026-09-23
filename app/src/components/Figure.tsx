import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Rect, Polygon, Path, G, ClipPath, Defs } from 'react-native-svg';

import { colors, spacing, scaled } from '../theme';
import type { FigureCell, FigureSpec, Shape, ShapeKind } from '../types';

/**
 * Drawing the figural questions.
 *
 * The server sends a spec; this turns it into shapes. Nothing about a
 * particular question lives here — adding a matrix item is adding data, not
 * code, and the same component draws both the question grid and the answer
 * options so an option always looks exactly like the thing it answers.
 *
 * Shapes are drawn inside a fixed 100x100 viewBox and scaled by the caller,
 * which is what keeps a triangle in the question the same triangle in the
 * option, at whatever size each needs.
 */

const TONES: Record<NonNullable<Shape['tone']>, string> = {
  ink: colors.ink,
  primary: colors.primary,
  cool: colors.cool,
  go: colors.go,
  happy: colors.happy,
};

/** Outlines are drawn thick: a thin stroke is hard for a young child to see. */
const STROKE = 7;

function pointsFor(kind: ShapeKind): string | null {
  switch (kind) {
    case 'triangle':
      return '50,12 88,82 12,82';
    case 'diamond':
      return '50,10 90,50 50,90 10,50';
    case 'hexagon':
      return '50,8 87,29 87,71 50,92 13,71 13,29';
    case 'star':
      return '50,8 61,38 93,38 67,57 77,88 50,69 23,88 33,57 7,38 39,38';
    case 'arrow':
      // Points up at rotate 0; rotation is applied by the caller.
      return '50,8 78,45 60,45 60,90 40,90 40,45 22,45';
    default:
      return null;
  }
}

function ShapeGlyph({ shape, index }: { shape: Shape; index: number }) {
  const color = TONES[shape.tone ?? 'ink'];
  const solid = shape.fill === 'solid';
  const scale = shape.scale ?? 1;

  // `half` is drawn as a solid shape clipped to its left side, which reads as
  // "half filled" at any shape rather than needing a per-shape special case.
  const clipId = `half-${index}`;

  const fillProps = solid
    ? { fill: color, stroke: color, strokeWidth: STROKE }
    : { fill: 'none', stroke: color, strokeWidth: STROKE };

  const body = (() => {
    if (shape.kind === 'circle') {
      return <Circle cx={50} cy={50} r={40} {...fillProps} />;
    }
    if (shape.kind === 'square') {
      return <Rect x={12} y={12} width={76} height={76} rx={6} {...fillProps} />;
    }
    if (shape.kind === 'heart') {
      return (
        <Path
          d="M50 86 C 18 62, 10 40, 24 26 C 36 14, 50 22, 50 34 C 50 22, 64 14, 76 26 C 90 40, 82 62, 50 86 Z"
          {...fillProps}
        />
      );
    }
    const points = pointsFor(shape.kind);
    if (!points) return <Circle cx={50} cy={50} r={40} {...fillProps} />;
    return <Polygon points={points} {...fillProps} />;
  })();

  const halfOverlay = (() => {
    if (shape.fill !== 'half') return null;
    const points = pointsFor(shape.kind);
    const filled =
      shape.kind === 'circle' ? (
        <Circle cx={50} cy={50} r={40} fill={color} />
      ) : shape.kind === 'square' ? (
        <Rect x={12} y={12} width={76} height={76} rx={6} fill={color} />
      ) : points ? (
        <Polygon points={points} fill={color} />
      ) : (
        <Circle cx={50} cy={50} r={40} fill={color} />
      );

    return (
      <>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={50} height={100} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>{filled}</G>
      </>
    );
  })();

  const rotate = shape.rotate ?? 0;
  const transform = `rotate(${rotate} 50 50) translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})`;

  return (
    <G transform={transform}>
      {shape.fill === 'half' ? (
        <>
          {halfOverlay}
          <Polygon points="" />
          {shape.kind === 'circle' ? (
            <Circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={STROKE} />
          ) : shape.kind === 'square' ? (
            <Rect
              x={12}
              y={12}
              width={76}
              height={76}
              rx={6}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
            />
          ) : (
            <Polygon
              points={pointsFor(shape.kind) ?? ''}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
            />
          )}
        </>
      ) : (
        body
      )}
    </G>
  );
}

export interface CellViewProps {
  cell: FigureCell;
  /** Rendered size in points. */
  size: number;
}

/** One cell: its shapes side by side, or a question mark if it is the gap. */
export function CellView({ cell, size }: CellViewProps) {
  if (cell.missing) {
    return (
      <View style={[styles.missing, { width: size, height: size, borderRadius: size * 0.12 }]}>
        <Text style={{ fontSize: size * 0.45, color: colors.inkSoft, fontWeight: '700' }}>?</Text>
      </View>
    );
  }

  // Several shapes in one cell means "how many" — lay them out in a row and
  // shrink so the cell stays the same size whatever the count.
  const count = Math.max(1, cell.shapes.length);
  const each = count === 1 ? size : Math.min(size / count, size * 0.5);

  return (
    <View style={[styles.cell, { width: size, height: size }]}>
      {cell.shapes.map((shape, i) => (
        <Svg key={i} width={each} height={each} viewBox="0 0 100 100">
          <ShapeGlyph shape={shape} index={i} />
        </Svg>
      ))}
    </View>
  );
}

export interface FigureProps {
  spec: FigureSpec;
  uiScale: number;
}

/** The whole figure: a grid, a row, or an unordered group. */
export default function Figure({ spec, uiScale }: FigureProps) {
  // Measure rather than assume. A six-cell series at a comfortable size is
  // wider than a phone, and a figure that runs off the edge is not a hard
  // question — it is an unanswerable one, because the child cannot see it all.
  const [available, setAvailable] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== available) setAvailable(w);
  };

  const preferred = scaled(spec.columns >= 5 ? 48 : spec.columns >= 4 ? 58 : 70, uiScale);

  // Room taken by gaps and per-cell padding, so the arithmetic matches layout.
  const perCellChrome = spacing(1) + spacing(1);
  const fits =
    available === null
      ? preferred
      : Math.floor((available - spec.columns * perCellChrome) / spec.columns);

  const cellSize = Math.max(28, Math.min(preferred, fits));

  const rows: FigureCell[][] = [];
  for (let i = 0; i < spec.cells.length; i += spec.columns) {
    rows.push(spec.cells.slice(i, i + spec.columns));
  }

  return (
    <View style={styles.figure} onLayout={onLayout}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={[
                styles.slot,
                // A matrix reads as a grid; a series or group reads as loose
                // items, so only the matrix gets boxes around its cells.
                spec.kind === 'matrix' && styles.slotBoxed,
              ]}
            >
              <CellView cell={cell} size={cellSize} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { alignItems: 'center', gap: spacing(1), width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  slot: { alignItems: 'center', justifyContent: 'center', padding: spacing(0.5) },
  slotBoxed: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  cell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inkSoft,
    backgroundColor: colors.surface,
  },
});
