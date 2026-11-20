import { expect, it } from 'vitest';
import { emptyRecords, loadRecords, parseRecords, recordBest, saveRecords, STORAGE_KEY, type StoragePort } from './storage';

it('uses its own versioned storage key', () => { expect(STORAGE_KEY).toBe('puzzle-minesweeper-v1'); });
it('loads valid per-difficulty milliseconds including a zero time', () => {
  expect(parseRecords(JSON.stringify({ version: 1, best: { easy: 0, normal: 1234, hard: 999999 } })).best).toEqual({ easy: 0, normal: 1234, hard: 999999 });
});
it.each([null, '', '{broken', 'null', '[]', '42', '{}', '{"version":2,"best":{"easy":100}}', '{"version":1,"best":[]}', '{"version":1,"best":{"easy":"100"}}', '{"version":1,"best":{"easy":-1}}', '{"version":1,"best":{"easy":0.5}}', '{"version":1,"best":{"other":100}}', '{"version":1,"best":{"easy":1e99}}', '{"version":1,"best":{"easy":null}}'])('rejects corrupt, unsupported or invalid storage %s', raw => {
  expect(parseRecords(raw)).toEqual(emptyRecords());
});
it('best records are isolated by difficulty and update only if faster', () => {
  let records = recordBest(emptyRecords(), 'easy', 5000);
  const unchanged = recordBest(records, 'easy', 5001);
  expect(unchanged).toBe(records);
  records = recordBest(records, 'normal', 7000);
  records = recordBest(records, 'easy', 3000);
  expect(records.best).toEqual({ easy: 3000, normal: 7000 });
  expect(recordBest(records, 'easy', 3000)).toBe(records);
});
it.each([-1, NaN, Infinity, 0.1])('ignores invalid candidate time %s', value => {
  const records = emptyRecords();
  expect(recordBest(records, 'easy', value)).toBe(records);
});
it('roundtrips through a minimal independent storage interface', () => {
  const map = new Map<string, string>();
  const storage: StoragePort = { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
  const records = recordBest(emptyRecords(), 'hard', 50000);
  expect(saveRecords(storage, records)).toBe(true);
  expect(loadRecords(storage)).toEqual({ records, available: true });
});
it('unavailable storage is harmless on reads and writes', () => {
  expect(loadRecords(null)).toEqual({ records: emptyRecords(), available: false });
  expect(saveRecords(null, emptyRecords())).toBe(false);
});
it('security and quota exceptions are contained', () => {
  const broken: StoragePort = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  expect(loadRecords(broken).available).toBe(false);
  expect(saveRecords(broken, emptyRecords())).toBe(false);
});
