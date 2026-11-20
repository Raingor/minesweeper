import { DIFFICULTIES, type Difficulty } from './engine';

export const STORAGE_KEY = 'puzzle-minesweeper-v1';
export interface Records { version: 1; best: Partial<Record<Difficulty, number>> }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const emptyRecords = (): Records => ({ version: 1, best: {} });

export function parseRecords(raw: string | null): Records {
  try {
    if (!raw) return emptyRecords();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyRecords();
    const record = data as Record<string, unknown>;
    if (record.version !== 1 || !record.best || typeof record.best !== 'object' || Array.isArray(record.best)) return emptyRecords();
    const best: Records['best'] = {};
    for (const [difficulty, value] of Object.entries(record.best)) {
      if (!Object.hasOwn(DIFFICULTIES, difficulty) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return emptyRecords();
      best[difficulty as Difficulty] = value;
    }
    return { version: 1, best };
  } catch { return emptyRecords(); }
}

export function loadRecords(storage: StoragePort | null): { records: Records; available: boolean } {
  try { return { records: parseRecords(storage?.getItem(STORAGE_KEY) ?? null), available: storage !== null }; }
  catch { return { records: emptyRecords(), available: false }; }
}

export function saveRecords(storage: StoragePort | null, records: Records): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch { return false; }
}

export function recordBest(records: Records, difficulty: Difficulty, elapsedMs: number): Records {
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) return records;
  const previous = records.best[difficulty];
  if (previous !== undefined && previous <= elapsedMs) return records;
  return { version: 1, best: { ...records.best, [difficulty]: elapsedMs } };
}
