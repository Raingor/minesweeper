import './characters.css';

/** Local catalog: no runtime dependency on any sibling game. */
export const CHARACTERS = [
  { id: 'classic', name: 'Joke Bear', short: '自嘲熊' },
  { id: 'chiikawa', name: '吉伊', short: '吉伊' },
  { id: 'hachiware', name: '小八', short: '小八' },
  { id: 'usagi', name: '乌萨奇', short: '乌萨奇' },
  { id: 'mole-croquette', name: '鼹鼠饼', short: '鼹鼠饼' },
  { id: 'old-dog', name: '老头狗', short: '老头狗' },
  { id: 'bear-raincoat', name: '小黄鸭雨衣熊', short: '雨衣熊' },
  { id: 'bear-pajama', name: '睡衣派对熊', short: '睡衣熊' },
  { id: 'bear-ninja', name: '夜行忍者熊', short: '忍者熊' },
  { id: 'kurimanju', name: '栗子馒头', short: '栗子馒头' },
  { id: 'momonga', name: '飞鼠', short: '飞鼠' },
  { id: 'rakko', name: '海獭', short: '海獭' },
  { id: 'shisa', name: '狮萨', short: '狮萨' },
  { id: 'furuhonya', name: '古本屋', short: '古本屋' },
  { id: 'bear-strawberry', name: '草莓熊', short: '草莓熊' },
  { id: 'bear-frog', name: '青蛙熊', short: '青蛙熊' },
  { id: 'bear-astronaut', name: '太空熊', short: '太空熊' },
  { id: 'bear-chef', name: '厨师熊', short: '厨师熊' },
  { id: 'bear-pirate', name: '海盗熊', short: '海盗熊' },
] as const;
export const CHARACTER_STORAGE_KEY = 'puzzle-minesweeper-character-v1';
export type CharacterId = typeof CHARACTERS[number]['id'];
interface SelectionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && CHARACTERS.some(character => character.id === value);
}
export function parseCharacter(raw: string | null): CharacterId {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (record.version === 1 && isCharacterId(record.id)) return record.id;
    }
  } catch { /* Corrupt data never blocks the game. */ }
  return 'classic';
}
export function loadCharacter(storage: SelectionStorage | null): CharacterId {
  try { return parseCharacter(storage?.getItem(CHARACTER_STORAGE_KEY) ?? null); }
  catch { return 'classic'; }
}
export function saveCharacter(storage: SelectionStorage | null, id: CharacterId): boolean {
  try {
    if (!storage || !isCharacterId(id)) return false;
    storage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify({ version: 1, id }));
    return true;
  } catch { return false; }
}

export function mountCharacters(host: HTMLElement): void {
  let storage: SelectionStorage | null = null;
  try { storage = window.localStorage; } catch { /* Optional persistence only. */ }
  let selected = loadCharacter(storage);
  const path = (id: CharacterId) => `./characters-2d/${id}.webp`;
  host.innerHTML = `<details class="crew-selector" id="crew-selector">
    <summary id="crew-summary" aria-label="更换勘探伙伴，当前为自嘲熊">
      <span class="crew-portrait"><img id="crew-avatar" src="${path(selected)}" alt="" width="72" height="72"><span class="crew-online" aria-hidden="true"></span></span>
      <span class="crew-copy"><small>FIELD COMPANION / 勘探伙伴</small><strong id="crew-name"></strong><span>慢慢来，我陪你读懂线索。</span></span>
      <span class="crew-change" aria-hidden="true">换伙伴<span class="crew-chevron">⌄</span></span>
    </summary>
    <div class="crew-roster"><div class="crew-roster-head"><span>选择同行伙伴</span><small>19 位 · 全部可选</small></div><div class="crew-grid" role="group" aria-label="选择勘探伙伴">${CHARACTERS.map(character => `<button type="button" data-character="${character.id}" aria-pressed="false" aria-label="选择${character.name}"><img src="${path(character.id)}" alt="${character.name}头像" width="56" height="56"><span>${character.short}</span></button>`).join('')}</div><p class="crew-save-note" id="crew-save-note" hidden>本地存储不可用，伙伴选择仅在此页面保留。</p></div>
  </details>`;
  const details = host.querySelector<HTMLDetailsElement>('details')!;
  const summary = host.querySelector<HTMLElement>('summary')!;
  const avatar = host.querySelector<HTMLImageElement>('#crew-avatar')!;
  const name = host.querySelector<HTMLElement>('#crew-name')!;
  const note = host.querySelector<HTMLElement>('#crew-save-note')!;
  function render(): void {
    const character = CHARACTERS.find(candidate => candidate.id === selected)!;
    avatar.src = path(selected);
    avatar.alt = `${character.name}，你的勘探伙伴`;
    name.textContent = character.short;
    summary.setAttribute('aria-label', `更换勘探伙伴，当前为${character.name}`);
    host.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === selected)));
  }
  host.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-character]');
    if (!button || !isCharacterId(button.dataset.character)) return;
    selected = button.dataset.character;
    note.hidden = saveCharacter(storage, selected);
    render();
    details.open = false;
    summary.focus({ preventScroll: true });
  });
  host.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !details.open) return;
    event.preventDefault();
    details.open = false;
    summary.focus({ preventScroll: true });
  });
  note.hidden = saveCharacter(storage, selected);
  render();
}
