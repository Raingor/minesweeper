export const DIFFICULTIES = {
  easy: { label: '入门', size: 8, mines: 10 },
  normal: { label: '标准', size: 10, mines: 16 },
  hard: { label: '挑战', size: 12, mines: 24 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export type Status = 'ready' | 'playing' | 'won' | 'lost';
export type Random = () => number;
export interface Cell { mine: boolean; adjacent: number; revealed: boolean; flagged: boolean }
export interface Game {
  difficulty: Difficulty;
  size: number;
  mineCount: number;
  status: Status;
  cells: Cell[];
  exploded: number | null;
}

export function createGame(difficulty: Difficulty = 'easy'): Game {
  const { size, mines } = DIFFICULTIES[difficulty];
  return {
    difficulty, size, mineCount: mines, status: 'ready', exploded: null,
    cells: Array.from({ length: size * size }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })),
  };
}

export function neighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size), col = index % size;
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const r = row + dy, c = col + dx;
    if ((dx || dy) && r >= 0 && r < size && c >= 0 && c < size) result.push(r * size + c);
  }
  return result;
}

const valid = (game: Game, index: number) => Number.isInteger(index) && index >= 0 && index < game.cells.length;
const terminal = (game: Game) => game.status === 'won' || game.status === 'lost';
const copy = (game: Game): Game => ({ ...game, cells: game.cells.map(cell => ({ ...cell })) });

/** Partial Fisher–Yates: a finite number of draws, even for a constant RNG. */
function plant(game: Game, first: number, random: Random): void {
  const safe = new Set([first, ...neighbors(first, game.size)]);
  const candidates = game.cells.map((_, index) => index).filter(index => !safe.has(index));
  if (candidates.length < game.mineCount) throw new Error('Safe area leaves insufficient mine positions');
  for (let i = 0; i < game.mineCount; i++) {
    const value = random();
    const fraction = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
    const j = i + Math.floor(fraction * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    game.cells[candidates[i]].mine = true;
  }
  game.cells.forEach((cell, index) => {
    cell.adjacent = neighbors(index, game.size).filter(near => game.cells[near].mine).length;
  });
}

export function toggleFlag(game: Game, index: number): Game {
  if (!valid(game, index) || terminal(game) || game.cells[index].revealed) return game;
  const next = copy(game);
  next.cells[index].flagged = !next.cells[index].flagged;
  return next;
}

export function reveal(game: Game, index: number, random: Random = Math.random): Game {
  if (!valid(game, index) || terminal(game) || game.cells[index].flagged || game.cells[index].revealed) return game;
  const next = copy(game);
  if (next.status === 'ready') { plant(next, index, random); next.status = 'playing'; }
  if (next.cells[index].mine) {
    next.cells[index].revealed = true;
    next.exploded = index;
    next.status = 'lost';
    return next;
  }
  // Mark when enqueuing: each cell is visited at most once; flags remain intact.
  const queue = [index];
  next.cells[index].revealed = true;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (next.cells[current].adjacent !== 0) continue;
    for (const near of neighbors(current, next.size)) {
      const cell = next.cells[near];
      if (cell.mine || cell.flagged || cell.revealed) continue;
      cell.revealed = true;
      queue.push(near);
    }
  }
  if (next.cells.every(cell => cell.mine || cell.revealed)) next.status = 'won';
  return next;
}

export const flagCount = (game: Game) => game.cells.filter(cell => cell.flagged).length;
export const revealedCount = (game: Game) => game.cells.filter(cell => cell.revealed && !cell.mine).length;
