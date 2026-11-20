import { expect, it } from 'vitest';
import { CHARACTERS, CHARACTER_STORAGE_KEY, isCharacterId, loadCharacter, parseCharacter, saveCharacter } from './characters';

it('contains all nineteen distinct local identities', () => {
  expect(CHARACTERS).toHaveLength(19);
  expect(new Set(CHARACTERS.map(character => character.id)).size).toBe(19);
  expect(CHARACTERS[0].id).toBe('classic');
  expect(CHARACTERS.at(-1)?.id).toBe('bear-pirate');
});
it.each(CHARACTERS)('roundtrips $id from validated versioned JSON', character => {
  expect(isCharacterId(character.id)).toBe(true);
  expect(parseCharacter(JSON.stringify({ version: 1, id: character.id }))).toBe(character.id);
});
it.each([null, '', '{broken', 'null', '[]', '42', '"chiikawa"', '{"version":1,"id":"missing"}', '{"version":2,"id":"chiikawa"}', '{"version":1,"id":1}', '{"version":1,"id":"__proto__"}'])('invalid data falls back safely: %s', raw => {
  expect(parseCharacter(raw)).toBe('classic');
});
it('saves to an isolated key, not the game-record key', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  expect(saveCharacter(storage, 'hachiware')).toBe(true);
  expect(loadCharacter(storage)).toBe('hachiware');
  expect([...map.keys()]).toEqual([CHARACTER_STORAGE_KEY]);
  expect(CHARACTER_STORAGE_KEY).not.toBe('puzzle-minesweeper-v1');
});
it('storage unavailability and exceptions never block selection fallback', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  expect(loadCharacter(null)).toBe('classic');
  expect(loadCharacter(blocked)).toBe('classic');
  expect(saveCharacter(null, 'chiikawa')).toBe(false);
  expect(saveCharacter(blocked, 'chiikawa')).toBe(false);
});
