import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { playSound } from '../games/sounds';
import { colors } from '../theme';
import { DirPad, GameSurface, GameStartCard, GameFrame, WinCard, shuffle, useArrowKeys, useSwipe, type Dir, useUsableHeight } from './common';

/**
 * Maze Runner: help the owl through the maze to the flag, picking up stars on
 * the way. No timer and no way to lose: a wall just stops the owl. Bigger mazes
 * at higher levels.
 */
const SIZES = [5, 6, 7, 8, 9];
export const MAZE_LEVELS = SIZES.length;

type Cell = { x: number; y: number };
/** walls[y][x] = which sides of that cell are closed. */
type Walls = { up: boolean; down: boolean; left: boolean; right: boolean }[][];
const STEP: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** A "perfect" maze (exactly one path between any two cells), by recursive backtracking. */
export function makeMaze(size: number): Walls {
  const walls: Walls = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ up: true, down: true, left: true, right: true })));
  const seen = Array.from({ length: size }, () => Array(size).fill(false) as boolean[]);
  const stack: Cell[] = [{ x: 0, y: 0 }];
  seen[0]![0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const options = shuffle(Object.keys(STEP) as Dir[]).filter(d => {
      const nx = cur.x + STEP[d].x, ny = cur.y + STEP[d].y;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && !seen[ny]![nx];
    });
    const dir = options[0];
    if (!dir) { stack.pop(); continue; }
    const next = { x: cur.x + STEP[dir].x, y: cur.y + STEP[dir].y };
    walls[cur.y]![cur.x]![dir] = false;
    walls[next.y]![next.x]![OPPOSITE[dir]] = false;
    seen[next.y]![next.x] = true;
    stack.push(next);
  }
  return walls;
}

/** Three stars in dead ends away from the start and the flag, so finding them is a small detour. */
function placeStars(walls: Walls, size: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if ((x === 0 && y === 0) || (x === size - 1 && y === size - 1)) continue;
    cells.push({ x, y });
  }
  const openSides = (c: Cell) => (['up', 'down', 'left', 'right'] as Dir[]).filter(d => !walls[c.y]![c.x]![d]).length;
  const deadEnds = shuffle(cells.filter(c => openSides(c) === 1 && c.x + c.y > 1));
  const rest = shuffle(cells.filter(c => !deadEnds.includes(c) && c.x + c.y > 1));
  return [...deadEnds, ...rest].slice(0, 3);
}

export default function MazeRunner({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(MAZE_LEVELS, Math.max(1, startLevel)));
  const size = SIZES[level - 1]!;
  const [availableWidth, setBoardWidth] = useState(320);
  const screenHeight = useUsableHeight();
  // Room for the app bar, game header and controls; short screens (small phones,
  // landscape) get a smaller board so the controls stay on screen.
  const board = Math.min(availableWidth, screenHeight < 450 ? Math.max(140, screenHeight - 300) : Math.max(200, screenHeight - 400));
  const cell = Math.floor((board - 3) / size);
  const [round, setRound] = useState(0);
  const walls = useMemo(() => makeMaze(size), [size, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const starCells = useMemo(() => placeStars(walls, size), [walls, size]);
  const [pos, setPos] = useState<Cell>({ x: 0, y: 0 });
  const [got, setGot] = useState<number[]>([]);
  const [trail, setTrail] = useState<string[]>(['0,0']);
  const [bump, setBump] = useState(false);
  const [won, setWon] = useState<number | null>(null);

  useEffect(() => { setPos({ x: 0, y: 0 }); setGot([]); setTrail(['0,0']); setWon(null); }, [walls]);

  const move = useCallback((dir: Dir) => {
    if (won !== null) return;
    if (walls[pos.y]![pos.x]![dir]) {
      setBump(true); setTimeout(() => setBump(false), 250);
      return;
    }
    const next = { x: pos.x + STEP[dir].x, y: pos.y + STEP[dir].y };
    setPos(next);
    setTrail(t => (t.includes(`${next.x},${next.y}`) ? t : [...t, `${next.x},${next.y}`]));
    const star = starCells.findIndex(s => s.x === next.x && s.y === next.y);
    let collected = got;
    if (star >= 0 && !got.includes(star)) { collected = [...got, star]; setGot(collected); playSound('pop'); }
    if (next.x === size - 1 && next.y === size - 1) {
      const stars = Math.max(1, collected.length);
      setWon(stars); playSound('tada');
      onFinish(stars, Math.min(MAZE_LEVELS, level + 1));
    }
  }, [won, walls, pos, starCells, got, size, level, onFinish]);
  useArrowKeys(move, won === null);
  const swipe = useSwipe(move);

  const line = 3;
  const wallColor = '#6B4FB8';
  return (
    <GameFrame emoji="🦉" title="Maze Runner" level={level} onBack={onBack}
      hint={won === null ? `Help Owl reach the flag 🏁 — grab the stars! (${got.length} of 3)` : ''}>
      <GameSurface theme="purple" eyebrow="THE STAR TRAIL" title="An owl adventure 🦉" badgeLabel="STARS" badge={`${got.length} / 3`} onWidth={setBoardWidth}>
      <View {...swipe.panHandlers} accessibilityLabel={`Maze, ${size} by ${size}. Owl is at column ${pos.x + 1}, row ${pos.y + 1}.`}
        style={[styles.board, { width: cell * size + line, height: cell * size + line }, bump && styles.bump]}>
        {trail.map(k => {
          const [x, y] = k.split(',').map(Number) as [number, number];
          return <View key={k} style={[styles.trail, { left: x * cell + cell * 0.3, top: y * cell + cell * 0.3, width: cell * 0.4, height: cell * 0.4, borderRadius: cell }]} />;
        })}
        {walls.map((row, y) => row.map((w, x) => (
          <React.Fragment key={`${x},${y}`}>
            {w.up ? <View style={[styles.wall, { backgroundColor: wallColor, left: x * cell, top: y * cell, width: cell + line, height: line }]} /> : null}
            {w.left ? <View style={[styles.wall, { backgroundColor: wallColor, left: x * cell, top: y * cell, width: line, height: cell + line }]} /> : null}
            {y === size - 1 && w.down ? <View style={[styles.wall, { backgroundColor: wallColor, left: x * cell, top: (y + 1) * cell, width: cell + line, height: line }]} /> : null}
            {x === size - 1 && w.right ? <View style={[styles.wall, { backgroundColor: wallColor, left: (x + 1) * cell, top: y * cell, width: line, height: cell + line }]} /> : null}
          </React.Fragment>
        )))}
        {starCells.map((s, i) => got.includes(i) ? null : (
          <Text key={`s${i}`} style={[styles.piece, { left: s.x * cell, top: s.y * cell, width: cell, lineHeight: cell, fontSize: cell * 0.5 }]}>⭐</Text>
        ))}
        <Text style={[styles.piece, { left: (size - 1) * cell, top: (size - 1) * cell, width: cell, lineHeight: cell, fontSize: cell * 0.55 }]}>🏁</Text>
        <Text style={[styles.piece, { left: pos.x * cell, top: pos.y * cell, width: cell, lineHeight: cell, fontSize: cell * 0.62 }]}>🦉</Text>
      </View>
      <DirPad onDir={move} disabled={won !== null} />
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={won === 3 ? 'Out of the maze with every star!' : `Out of the maze with ${got.length} ${got.length === 1 ? 'star' : 'stars'}. Can you find all 3 next time?`}
          onExit={onBack} onAgain={() => setRound(r => r + 1)}
          onNext={level < MAZE_LEVELS ? () => setLevel(level + 1) : () => setRound(r => r + 1)} nextLabel={level < MAZE_LEVELS ? 'Bigger maze ▶' : 'New maze ▶'} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: '#F7F3FF', borderRadius: 6 },
  bump: { transform: [{ translateX: 3 }] },
  wall: { position: 'absolute', borderRadius: 2 },
  trail: { position: 'absolute', backgroundColor: '#E2D8FB' },
  piece: { position: 'absolute', textAlign: 'center', color: colors.ink },
});
