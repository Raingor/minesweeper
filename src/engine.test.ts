import { describe, expect, it } from 'vitest';
import { createGame, DIFFICULTIES, flagCount, neighbors, reveal, revealedCount, toggleFlag, type Difficulty } from './engine';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
const difficulties = Object.keys(DIFFICULTIES) as Difficulty[];

describe('deferred finite mine placement', () => {
  for (const difficulty of difficulties) for (const seed of [0, 1, 2, 7, 13, 24, 42, 83, 117, 256, 999, 2026]) {
    it(`${difficulty} seed ${seed}: every first-click neighborhood safe, exact count and adjacency`, () => {
      const initial = createGame(difficulty);
      const n = initial.size;
      for (const first of [0, n - 1, n * (n - 1), n * n - 1, n + 1, Math.floor(n * n / 2) + Math.floor(n / 2)]) {
        const game = reveal(initial, first, seeded(seed));
        expect(game.cells.filter(cell => cell.mine)).toHaveLength(game.mineCount);
        for (const safe of [first, ...neighbors(first, n)]) expect(game.cells[safe].mine).toBe(false);
        expect(game.cells[first].adjacent).toBe(0);
        expect(game.cells[first].revealed).toBe(true);
        game.cells.forEach((cell, index) => expect(cell.adjacent).toBe(neighbors(index, n).filter(near => game.cells[near].mine).length));
        expect(initial.cells.every(cell => !cell.mine && !cell.revealed)).toBe(true);
      }
    });
  }
  it('has no mines at creation or after flagging, and flagging never calls the RNG', () => {
    const game = toggleFlag(createGame(), 0);
    let calls = 0;
    expect(reveal(game, 0, () => { calls++; return 0; })).toBe(game);
    expect(calls).toBe(0);
    expect(game.status).toBe('ready');
    expect(game.cells.some(cell => cell.mine)).toBe(false);
  });
  it.each([0, 1, -1, NaN, Infinity])('constant RNG %s terminates in exactly mineCount draws', value => {
    let draws = 0;
    const game = reveal(createGame('hard'), 65, () => { draws++; return value; });
    expect(draws).toBe(24);
    expect(game.cells.filter(cell => cell.mine)).toHaveLength(24);
  });
  it('equal seed and first click produce reproducible boards', () => {
    expect(reveal(createGame(), 0, seeded(42))).toEqual(reveal(createGame(), 0, seeded(42)));
  });
});

describe('boundaries, flags and flood fill', () => {
  it('does not wrap across rows', () => {
    expect(neighbors(7, 8)).toEqual([6, 14, 15]);
    expect(neighbors(8, 8)).toEqual([0, 1, 9, 16, 17]);
    expect(neighbors(0, 8)).toEqual([1, 8, 9]);
    expect(neighbors(63, 8)).toEqual([54, 55, 62]);
  });
  it('interior has exactly eight unique neighbors', () => {
    expect(new Set(neighbors(27, 8)).size).toBe(8);
  });
  it('flood fill opens blank region and boundary numbers without opening mines or flags', () => {
    const game = reveal(toggleFlag(createGame(), 9), 0, seeded(22));
    expect(game.cells[9].mine).toBe(false);
    expect(game.cells[9].flagged).toBe(true);
    expect(game.cells[9].revealed).toBe(false);
    expect(revealedCount(game)).toBeGreaterThan(3);
    expect(game.cells.filter(cell => cell.revealed).every(cell => !cell.mine)).toBe(true);
  });
  it('flags toggle on hidden cells and cannot mark revealed cells', () => {
    const flagged = toggleFlag(createGame(), 3);
    expect(flagCount(flagged)).toBe(1);
    expect(flagCount(toggleFlag(flagged, 3))).toBe(0);
    const game = reveal(createGame(), 0, seeded(22));
    expect(toggleFlag(game, 0)).toBe(game);
  });
  it('flags are not artificially limited by mine count', () => {
    let game = createGame();
    for (let i = 0; i < 11; i++) game = toggleFlag(game, i);
    expect(game.mineCount - flagCount(game)).toBe(-1);
    expect(game.status).toBe('ready');
  });
  it.each([-1, 64, 0.5, NaN, Infinity])('ignores invalid index %s without randomness', index => {
    const game = createGame();
    expect(reveal(game, index, () => { throw new Error('must not draw'); })).toBe(game);
    expect(toggleFlag(game, index)).toBe(game);
  });
  it('revealing an already revealed cell is a no-op', () => {
    const game = reveal(createGame(), 0, seeded(9));
    expect(reveal(game, 0)).toBe(game);
  });
  it('removing a safe flag allows that cell to be revealed later', () => {
    let game = reveal(toggleFlag(createGame(), 9), 0, seeded(22));
    game = toggleFlag(game, 9);
    expect(reveal(game, 9).cells[9].revealed).toBe(true);
  });
});

describe('terminal states', () => {
  it.each(difficulties)('%s wins only by revealing every safe cell, with no flags required', difficulty => {
    let game = reveal(createGame(difficulty), 0, seeded(7));
    const safe = game.cells.flatMap((cell, index) => cell.mine ? [] : [index]);
    const last = [...safe].reverse().find(index => !game.cells[index].revealed)!;
    game = toggleFlag(game, last); // Keep flood expansion from opening the chosen final cell.
    for (const index of safe) if (index !== last) game = reveal(game, index);
    expect(game.status).toBe('playing');
    game = reveal(toggleFlag(game, last), last);
    expect(game.status).toBe('won');
    expect(flagCount(game)).toBe(0);
    expect(revealedCount(game)).toBe(game.size ** 2 - game.mineCount);
    expect(reveal(game, game.cells.findIndex(cell => cell.mine))).toBe(game);
    expect(toggleFlag(game, 1)).toBe(game);
  });
  it('correctly flagging all mines alone is not a win', () => {
    let game = reveal(createGame(), 0, seeded(5));
    game.cells.forEach((cell, index) => { if (cell.mine) game = toggleFlag(game, index); });
    expect(flagCount(game)).toBe(10);
    expect(game.status).toBe('playing');
  });
  it('a flagged safe cell prevents victory until unflagged and revealed', () => {
    let game = reveal(toggleFlag(createGame(), 9), 0, seeded(5));
    game.cells.forEach((cell, index) => { if (!cell.mine) game = reveal(game, index); });
    expect(game.status).toBe('playing');
    game = reveal(toggleFlag(game, 9), 9);
    expect(game.status).toBe('won');
  });
  it('mine click loses and locks both revealing and flags', () => {
    let game = reveal(createGame(), 0, seeded(8));
    const mine = game.cells.findIndex(cell => cell.mine);
    game = reveal(game, mine);
    expect(game.status).toBe('lost');
    expect(game.exploded).toBe(mine);
    expect(game.cells[mine].revealed).toBe(true);
    expect(reveal(game, 63)).toBe(game);
    expect(toggleFlag(game, 63)).toBe(game);
  });
  it('fresh games do not reuse flags, mines or terminal status', () => {
    const a = toggleFlag(reveal(createGame(), 0, seeded(0)), 63);
    const b = createGame('hard');
    expect(b.cells.every(cell => !cell.flagged && !cell.revealed && !cell.mine)).toBe(true);
    expect(b.cells).not.toBe(a.cells);
    expect(b.status).toBe('ready');
  });
});
