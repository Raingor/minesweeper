import './style.css';
import { createGame, DIFFICULTIES, flagCount, reveal, revealedCount, toggleFlag, type Difficulty } from './engine';
import { Clock, formatTime } from './clock';
import { loadRecords, recordBest, saveRecords, type StoragePort } from './storage';
import { icon } from './icons';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let storage: StoragePort | null = null;
try { storage = window.localStorage; } catch { /* A private or blocked browser can still play. */ }
const loaded = loadRecords(storage);
let records = loaded.records;
let storageAvailable = loaded.available;
let game = createGame();
let mode: 'reveal' | 'flag' = 'reveal';
let zoom = false;
let activeCell = 0;
const clock = new Clock();

$('#app').innerHTML = `
  <main class="expedition">
    <header class="masthead">
      <div class="brand-line"><span class="brand-mark" aria-hidden="true">＋</span><span>FIELD NOTES / 001</span><span class="edition">逻辑探索系列</span></div>
      <div class="title-row"><div><p class="eyebrow">MINESWEEPER · 地表勘探</p><h1>探<span>雷</span><i aria-hidden="true">.</i></h1></div><div class="header-note"><span class="signal" aria-hidden="true"></span>保持好奇，谨慎落点。<br><span>每一个数字，都是线索。</span></div></div>
    </header>

    <section class="station" aria-label="扫雷探测仪">
      <div class="plate"><span><span class="plate-dot" aria-hidden="true"></span> AMBER / 手持探测仪</span><span>MS—01</span></div>
      <nav class="difficulty" aria-label="选择难度">${(Object.entries(DIFFICULTIES) as [Difficulty, typeof DIFFICULTIES[Difficulty]][]).map(([key, value]) => `<button type="button" data-difficulty="${key}" aria-pressed="${key === 'easy'}"><span>${value.label}</span><small>${value.size} × ${value.size}<b> / ${value.mines} 雷</b></small></button>`).join('')}</nav>
      <div class="readout">
        <div class="meter"><span class="meter-label">待标记 <small>FLAGS</small></span><strong id="remaining">010</strong></div>
        <button id="restart" class="reset-button" type="button" aria-label="重新开始本局">${icon('reset')}<span>重开</span></button>
        <div class="meter time-meter"><span class="meter-label">用时 <small>TIME</small></span><strong id="timer" aria-label="本局用时">00:00</strong></div>
      </div>
      <div class="field-header"><span id="field-label">A 区 / 08 × 08</span><button id="zoom" class="text-button" type="button" aria-pressed="false">${icon('expand')}<span>放大棋盘</span></button></div>
      <div id="board-scroll" class="board-scroll" tabindex="-1" aria-label="棋盘滚动区域"><div id="board" class="board" role="group" aria-label="扫雷棋盘"></div></div>
      <p id="zoom-note" class="zoom-note" hidden>大格模式 · 在棋盘内滑动查看，点击格子操作。</p>
      <div class="field-footer"><span id="coordinates">安全起步 / 周围一圈无雷</span><span class="safe-mark">${icon('scan')} FIRST CLICK SAFE</span></div>
      <div class="controls">
        <div class="mode-switch" role="group" aria-label="点击操作模式"><button id="mode-reveal" type="button" aria-pressed="true">${icon('scan')}揭开</button><button id="mode-flag" type="button" aria-pressed="false">${icon('flag')}插旗</button></div>
        <button id="help" class="help-button" type="button">${icon('help')}<span>玩法说明</span></button>
      </div>
      <div id="result" class="result" hidden></div>
      <div class="status-line"><span class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite">探测仪就绪。选择一格，开始勘探。</p></div>
    </section>
    <div class="below-station"><p><span class="record-symbol" aria-hidden="true">◇</span> 本地最佳 <strong id="best">— —</strong><span id="best-difficulty">入门</span></p><p class="desktop-hint">左键揭开 · 右键插旗 · 方向键移动 / F 标记</p></div>
    <p id="storage-note" class="storage-note" hidden>本地存储不可用，本次仍可游玩；纪录仅在此页面保留。</p>
    <footer class="page-footer"><span>读懂线索，不靠运气。</span><span>EXPLORE SLOWLY. THINK CLEARLY.</span></footer>
  </main>
  <dialog id="rules" aria-labelledby="rules-title"><div class="dialog-head"><span class="eyebrow">OPERATOR'S MANUAL</span><button id="close-help" class="icon-button" type="button" aria-label="关闭玩法说明">${icon('close')}</button></div><h2 id="rules-title">出发前，读懂信号。</h2><ol class="rules"><li><strong>从安全的第一步开始</strong><p>首次有效揭开才布雷，所选格及周围一圈保证无雷。插旗不开始计时或布雷。</p></li><li><strong>数字，是周围的雷数</strong><p>数字表示周围八格内的地雷数量。空白区域会连片展开，但不会揭开旗帜。</p></li><li><strong>用旗帜留下判断</strong><p>桌面右键，或切换下方「插旗」后点击；再次标记可撤旗。揭开模式不会打开已插旗的格子。旗子数量不限，待标记数可能为负。</p></li><li><strong>揭开所有安全格，即获胜</strong><p>不要求插满旗或正确插旗。触雷即失败，终局显示全部雷与错旗。计时停止，可随时重开或切换难度。</p></li></ol><p class="dialog-tip">触屏：用「揭开 / 插旗」切换操作；大棋盘可点「放大棋盘」后在棋盘内滑动。键盘：Tab 进入棋盘，方向键移动，Enter / 空格按当前模式操作，F 插旗。</p><p class="dialog-tip">仅分难度保存最佳通关用时，不保存未完成对局。切档、重开或刷新都会开始新局。</p><button id="understood" class="primary-button" type="button">明白了，开始勘探 ${icon('scan')}</button></dialog>
`;

const board = $('#board');
const dialog = $<HTMLDialogElement>('#rules');
let cells: HTMLButtonElement[] = [];

function buildBoard(): void {
  board.style.setProperty('--size', String(game.size));
  board.setAttribute('aria-label', `${DIFFICULTIES[game.difficulty].label}扫雷棋盘，${game.size}行${game.size}列，${game.mineCount}雷`);
  board.innerHTML = '';
  const fragment = document.createDocumentFragment();
  cells = game.cells.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.dataset.index = String(index);
    button.tabIndex = index === activeCell ? 0 : -1;
    fragment.append(button);
    return button;
  });
  board.append(fragment);
}

function render(): void {
  const ended = game.status === 'won' || game.status === 'lost';
  board.dataset.status = game.status;
  cells.forEach((button, index) => {
    const cell = game.cells[index];
    const shownMine = ended && cell.mine;
    const wrongFlag = ended && cell.flagged && !cell.mine;
    let content = '';
    let name = '未揭开';
    if (shownMine) { content = icon('mine'); name = cell.flagged ? '地雷，已正确标记' : '地雷'; }
    else if (wrongFlag) { content = icon('flag') + '<span class="wrong-cross" aria-hidden="true">×</span>'; name = '错误旗帜'; }
    else if (cell.flagged) { content = icon('flag'); name = '已插旗'; }
    else if (cell.revealed) { content = cell.adjacent ? String(cell.adjacent) : ''; name = cell.adjacent ? `已揭开，周围 ${cell.adjacent} 雷` : '已揭开，空白'; }
    button.className = `cell${cell.revealed ? ' revealed' : ''}${cell.flagged ? ' flagged' : ''}${shownMine ? ' mine' : ''}${wrongFlag ? ' wrong' : ''}${game.exploded === index ? ' exploded' : ''}`;
    button.dataset.number = String(cell.adjacent);
    if (button.innerHTML !== content) button.innerHTML = content;
    button.setAttribute('aria-label', `${Math.floor(index / game.size) + 1}行${index % game.size + 1}列，${name}`);
    button.setAttribute('aria-disabled', String(ended || cell.revealed));
  });
  $('#remaining').textContent = String(game.mineCount - flagCount(game)).padStart(3, '0');
  $('#remaining').setAttribute('aria-label', `待标记 ${game.mineCount - flagCount(game)}，地雷数减去旗帜数`);
  $('#timer').textContent = formatTime(clock.elapsed());
  $('#field-label').textContent = `${({ easy: 'A', normal: 'B', hard: 'C' } as const)[game.difficulty]} 区 / ${String(game.size).padStart(2, '0')} × ${String(game.size).padStart(2, '0')}`;
  $('#coordinates').textContent = game.status === 'ready' ? '安全起步 / 周围一圈无雷' : `已探明 ${revealedCount(game)} / ${game.cells.length - game.mineCount} 安全格`;
  $('#mode-reveal').setAttribute('aria-pressed', String(mode === 'reveal'));
  $('#mode-flag').setAttribute('aria-pressed', String(mode === 'flag'));
  board.dataset.mode = mode;
  document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.difficulty === game.difficulty)));
  const best = records.best[game.difficulty];
  $('#best').textContent = best === undefined ? '— —' : formatTime(best);
  $('#best-difficulty').textContent = DIFFICULTIES[game.difficulty].label;
  $('#storage-note').hidden = storageAvailable;
  const status = game.status === 'ready' ? (mode === 'flag' ? '标记模式。插旗不会布雷，切回「揭开」开始。' : '探测仪就绪。选择一格，开始勘探。') : game.status === 'playing' ? (mode === 'flag' ? '标记模式。再次点击旗帜，即可撤销标记。' : '勘探进行中。数字是周围八格的雷数。') : game.status === 'won' ? '区域安全，勘探完成。计时已停止。' : '触发地雷，本次勘探结束。计时已停止。';
  $('#status').textContent = status;
  const result = $('#result');
  result.hidden = !ended;
  result.classList.toggle('loss', game.status === 'lost');
  if (ended) result.innerHTML = `<span class="result-icon">${icon(game.status === 'won' ? 'check' : 'mine')}</span><div><h2>${game.status === 'won' ? '全域安全。漂亮的判断！' : '信号中断。再试一次？'}</h2><p>${game.status === 'won' ? `已揭开所有安全格 · ${formatTime(clock.elapsed())}` : '雷区已显现，带着线索重新出发。'}</p></div><button type="button" id="play-again">再探一次</button>`;
}

function act(index: number, flag = mode === 'flag'): void {
  const previous = game;
  game = flag ? toggleFlag(game, index) : reveal(game, index);
  if (previous === game) return;
  if (previous.status === 'ready' && game.status !== 'ready') clock.start();
  if (game.status === 'won' || game.status === 'lost') {
    clock.stop();
    if (game.status === 'won') {
      records = recordBest(records, game.difficulty, Math.floor(clock.elapsed()));
      storageAvailable = saveRecords(storage, records) && storageAvailable;
    }
  }
  render();
}

function restart(difficulty = game.difficulty): void {
  clock.reset();
  game = createGame(difficulty);
  mode = 'reveal';
  activeCell = 0;
  buildBoard();
  render();
  $('#board-scroll').scrollTo({ left: 0, top: 0 });
}

board.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-index]');
  if (button) act(Number(button.dataset.index));
});
board.addEventListener('contextmenu', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-index]');
  if (button) { event.preventDefault(); act(Number(button.dataset.index), true); }
});
board.addEventListener('focusin', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-index]');
  if (!button) return;
  cells[activeCell].tabIndex = -1;
  activeCell = Number(button.dataset.index);
  button.tabIndex = 0;
});
board.addEventListener('keydown', event => {
  if (dialog.open) return;
  const row = Math.floor(activeCell / game.size), col = activeCell % game.size;
  let next = activeCell;
  if (event.key === 'ArrowLeft') next = row * game.size + Math.max(0, col - 1);
  else if (event.key === 'ArrowRight') next = row * game.size + Math.min(game.size - 1, col + 1);
  else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * game.size + col;
  else if (event.key === 'ArrowDown') next = Math.min(game.size - 1, row + 1) * game.size + col;
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); if (!event.repeat) act(activeCell, true); return; }
  else return;
  event.preventDefault();
  cells[next].focus();
});
$('#restart').addEventListener('click', () => restart());
$('#result').addEventListener('click', event => { if ((event.target as Element).closest('#play-again')) restart(); });
document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(button => button.addEventListener('click', () => restart(button.dataset.difficulty as Difficulty)));
$('#mode-reveal').addEventListener('click', () => { mode = 'reveal'; render(); });
$('#mode-flag').addEventListener('click', () => { mode = 'flag'; render(); });
$('#zoom').addEventListener('click', () => {
  zoom = !zoom;
  $('#board-scroll').classList.toggle('zoomed', zoom);
  $('#zoom').setAttribute('aria-pressed', String(zoom));
  $('#zoom span').textContent = zoom ? '适应屏幕' : '放大棋盘';
  $('#zoom-note').hidden = !zoom;
});
$('#help').addEventListener('click', () => dialog.showModal());
$('#close-help').addEventListener('click', () => dialog.close());
$('#understood').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
dialog.addEventListener('close', () => $('#help').focus());
// One presentation interval only. Resetting a game never creates another timer.
setInterval(() => { if (clock.running) $('#timer').textContent = formatTime(clock.elapsed()); }, 200);
if (storageAvailable) storageAvailable = saveRecords(storage, records);
buildBoard();
render();
