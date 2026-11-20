import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://localhost:5176';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const key = 'puzzle-minesweeper-v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], checks = [], contexts = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const cell = (page, index) => page.locator(`[data-index="${index}"]`);
const revealed = page => page.locator('.cell.revealed').count();
const getSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const tap = (page, selector) => page.locator(selector).tap();
async function lockedClick(page, index, button = 'left') {
  const box = await cell(page, index).boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button });
}

// Test-side oracle for constant Math.random = 0. No imports from /src, no product hooks.
function field(size, count, first = 0) {
  const near = index => {
    const row = Math.floor(index / size), col = index % size, result = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = row + dy, x = col + dx;
      if ((dx || dy) && y >= 0 && y < size && x >= 0 && x < size) result.push(y * size + x);
    }
    return result;
  };
  const safe = new Set([first, ...near(first)]);
  const mines = Array.from({ length: size * size }, (_, i) => i).filter(i => !safe.has(i)).slice(0, count);
  return { mines, safe: Array.from({ length: size * size }, (_, i) => i).filter(i => !mines.includes(i)), adjacent: i => near(i).filter(j => mines.includes(j)).length };
}

async function setup(options = {}, storageMode = '', save, randomSeed = 0) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  contexts.push(context);
  await context.addInitScript(({ key, storageMode, save, randomSeed }) => {
    let state = randomSeed >>> 0;
    Math.random = randomSeed ? () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; } : () => 0;
    if (storageMode === 'blocked') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    else if (storageMode === 'quota') Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    else if (storageMode && !sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, storageMode === 'corrupt' ? '{broken' : JSON.stringify(save));
      sessionStorage.setItem('seeded', '1');
    }
  }, { key, storageMode, save, randomSeed });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`pageerror ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await cell(page, 0).waitFor();
  return { page, context };
}

try {
  await mkdir(out, { recursive: true });
  const { page } = await setup();
  check('desktop starts with 64 hidden cells, correct mine counter, ready timer', await page.locator('.cell').count() === 64 && await revealed(page) === 0 && await page.locator('#remaining').textContent() === '010' && await page.locator('#timer').textContent() === '00:00');
  check('desktop has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await cell(page, 9).click({ button: 'right' });
  await page.waitForTimeout(1100);
  check('right click flags without starting timer or revealing cells', await cell(page, 9).getAttribute('class').then(v => v.includes('flagged')) && await revealed(page) === 0 && await page.locator('#timer').textContent() === '00:00');
  await cell(page, 9).click();
  check('left click never reveals a flagged cell', await revealed(page) === 0);
  await cell(page, 0).click();
  check('real first reveal expands region but retains neighboring safe flag', await revealed(page) > 1 && !await cell(page, 9).getAttribute('class').then(v => v.includes('revealed')) && await page.locator('#board').getAttribute('data-status') === 'playing');
  await page.waitForTimeout(1100);
  check('timer starts on first effective reveal', await page.locator('#timer').textContent() !== '00:00');
  await cell(page, 9).click({ button: 'right' }); await cell(page, 9).click();
  check('unflagging allows safe reveal', await cell(page, 9).getAttribute('class').then(v => v.includes('revealed')));
  await cell(page, 0).focus();
  await page.keyboard.press('ArrowRight');
  check('arrow key moves cell focus with a visible ring', await cell(page, 1).evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'));
  await page.locator('#help').focus(); await page.keyboard.press('Enter');
  check('keyboard opens complete rules dialog', await page.locator('#rules').isVisible() && (await page.locator('.rules').textContent()).includes('不要求插满旗'));
  const beforeHelp = await revealed(page);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  check('modal traps focus and arrows cannot operate board', await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)) && await revealed(page) === beforeHelp);
  await page.screenshot({ path: `${out}/rules-desktop.png`, fullPage: true });
  await page.keyboard.press('Escape');
  check('Escape closes rules and restores opener focus', !await page.locator('#rules').isVisible() && await page.locator('#help').evaluate(el => el === document.activeElement));
  await page.locator('#restart').click();
  check('restart clears cells, flags, status and timer', await revealed(page) === 0 && await page.locator('.flagged').count() === 0 && await page.locator('#timer').textContent() === '00:00' && await page.locator('#board').getAttribute('data-status') === 'ready');
  await page.locator('[data-difficulty="normal"]').click();
  check('standard difficulty rebuilds 100 cells and 16 mines', await page.locator('.cell').count() === 100 && await page.locator('#remaining').textContent() === '016');
  await page.locator('[data-difficulty="hard"]').click();
  check('challenge difficulty rebuilds 144 cells and 24 mines', await page.locator('.cell').count() === 144 && await page.locator('#remaining').textContent() === '024');
  await cell(page, 0).focus(); await page.keyboard.press('f');
  check('F key flags without starting a challenge game', await cell(page, 0).getAttribute('class').then(v => v.includes('flagged')) && await page.locator('#board').getAttribute('data-status') === 'ready');
  await page.keyboard.press('f'); await page.keyboard.press('Enter');
  check('Enter reveals a keyboard-selected cell', await cell(page, 0).getAttribute('class').then(v => v.includes('revealed')));
  await page.locator('#restart').dblclick();
  check('rapid restart clears old timer and board state', await revealed(page) === 0 && await page.locator('#timer').textContent() === '00:00');
  await page.locator('[data-difficulty="easy"]').click();

  // Win by revealing every non-mine through UI. Protect a real final cell from flood fill.
  const oracle = field(8, 10);
  const last = oracle.safe.find(i => i > 9 && oracle.adjacent(i) > 0);
  assert.notEqual(last, undefined);
  await cell(page, last).click({ button: 'right' });
  await cell(page, 0).click();
  for (const index of oracle.safe) if (index !== last && !await cell(page, index).getAttribute('class').then(v => v.includes('revealed'))) await cell(page, index).click();
  check('all but protected final safe cell is not yet a victory', await page.locator('#board').getAttribute('data-status') === 'playing' && await revealed(page) === 53);
  await page.waitForTimeout(1100);
  await cell(page, last).click({ button: 'right' }); await cell(page, last).click();
  check('real final safe reveal wins without any flags required', await page.locator('#board').getAttribute('data-status') === 'won' && await page.locator('#result').isVisible() && await page.locator('.cell.mine').count() === 10 && await page.locator('.flagged').count() === 0 && await revealed(page) === 54);
  const frozenWin = await page.locator('#timer').textContent();
  const saved = await getSave(page);
  check('victory saves versioned per-difficulty best time', saved.version === 1 && saved.best.easy >= 1000 && saved.best.normal === undefined);
  await page.waitForTimeout(1100); await lockedClick(page, oracle.mines[0]); await lockedClick(page, oracle.mines[0], 'right');
  check('won game locks reveals and flags and freezes timer', await page.locator('#board').getAttribute('data-status') === 'won' && await page.locator('.flagged').count() === 0 && await page.locator('#timer').textContent() === frozenWin);
  await page.screenshot({ path: `${out}/victory.png`, fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  check('reload retains best but starts a fresh game', JSON.stringify(await getSave(page)) === JSON.stringify(saved) && await revealed(page) === 0 && await page.locator('#best').textContent() === frozenWin);
  await page.locator('[data-difficulty="normal"]').click();
  check('records are isolated by difficulty', await page.locator('#best').textContent() === '— —');
  await page.locator('[data-difficulty="easy"]').click();
  await cell(page, 63).click({ button: 'right' }); await cell(page, 0).click();
  await page.screenshot({ path: `${out}/desktop-1440.png`, fullPage: true });
  await cell(page, oracle.mines[0]).click();
  check('real mine click loses, shows all mines and identifies incorrect flag', await page.locator('#board').getAttribute('data-status') === 'lost' && await page.locator('.mine').count() === 10 && await page.locator('.exploded').count() === 1 && await cell(page, 63).getAttribute('class').then(v => v.includes('wrong')));
  const frozenLoss = await page.locator('#timer').textContent();
  const flagsLoss = await page.locator('.flagged').count(), revealedLoss = await revealed(page);
  await page.waitForTimeout(1100); await lockedClick(page, 63, 'right'); await lockedClick(page, 62);
  check('lost game locks reveal, flags and timer without changing best', await page.locator('.flagged').count() === flagsLoss && await revealed(page) === revealedLoss && await page.locator('#timer').textContent() === frozenLoss && JSON.stringify(await getSave(page)) === JSON.stringify(saved));
  await page.screenshot({ path: `${out}/game-over.png`, fullPage: true });
  await page.locator('#play-again').click();
  check('result restart returns to playable ready state', await page.locator('#board').getAttribute('data-status') === 'ready' && !await page.locator('#result').isVisible());
  check('no game object or cheat global exposed', await page.evaluate(() => !('game' in window) && !('__GAME__' in window) && !('__minesweeper' in window)));

  const mobile = (await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).page;
  await tap(mobile, '#mode-flag'); await cell(mobile, 9).tap();
  check('real mobile touch mode flags without revealing', await cell(mobile, 9).getAttribute('class').then(v => v.includes('flagged')) && await revealed(mobile) === 0);
  await tap(mobile, '#mode-reveal'); await cell(mobile, 9).tap();
  check('mobile reveal mode respects flags', await revealed(mobile) === 0);
  await cell(mobile, 0).tap();
  check('real mobile reveal expands safe area', await revealed(mobile) > 1);
  await tap(mobile, '#mode-flag'); await cell(mobile, 9).tap(); await tap(mobile, '#mode-reveal'); await cell(mobile, 9).tap();
  check('real mobile unflag then reveal works', await cell(mobile, 9).getAttribute('class').then(v => v.includes('revealed')));
  check('390px touch screen has no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await mobile.screenshot({ path: `${out}/mobile-390.png`, fullPage: true });
  await tap(mobile, '#help');
  check('mobile rules dialog is bounded and scrollable', await mobile.locator('#rules').isVisible() && await mobile.locator('#rules').evaluate(el => el.getBoundingClientRect().width <= innerWidth - 32));
  await tap(mobile, '#understood'); await tap(mobile, '#restart');
  check('mobile touch restart resets active game and mode', await revealed(mobile) === 0 && await mobile.locator('#mode-reveal').getAttribute('aria-pressed') === 'true');
  await tap(mobile, '[data-difficulty="hard"]'); await cell(mobile, 0).tap();
  check('mobile challenge board supports real touch input', await mobile.locator('.cell').count() === 144 && await revealed(mobile) > 1);
  await tap(mobile, '#zoom');
  check('zoom provides large touch cells with internal rather than page overflow', await cell(mobile, 0).evaluate(el => el.getBoundingClientRect().width >= 48) && await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth) && await mobile.locator('#board-scroll').evaluate(el => el.scrollWidth > el.clientWidth));
  await mobile.locator('#board-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight; });
  await tap(mobile, '#mode-flag'); await cell(mobile, 143).tap();
  check('far corner of zoomed challenge board can be flagged by touch', await cell(mobile, 143).getAttribute('class').then(v => v.includes('flagged')));
  await tap(mobile, '#zoom');
  check('zoom can return to fit screen', await mobile.locator('#zoom').getAttribute('aria-pressed') === 'false' && await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await mobile.screenshot({ path: `${out}/mobile-challenge-390.png`, fullPage: true });

  const small = (await setup({ viewport: { width: 360, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).page;
  await tap(small, '[data-difficulty="hard"]'); await cell(small, 0).tap();
  check('360px largest board stays within page', await small.evaluate(() => document.documentElement.scrollWidth === innerWidth) && await small.locator('.cell').count() === 144);
  check('reduced-motion disables animation without blocking gameplay', await small.locator('.station').evaluate(el => getComputedStyle(el).animationName === 'none') && await revealed(small) > 1);
  await small.screenshot({ path: `${out}/mobile-360-reduced-motion.png`, fullPage: true });
  const blocked = (await setup({}, 'blocked')).page;
  await cell(blocked, 0).click();
  check('blocked storage retains playable game and explicit warning', await blocked.locator('#storage-note').isVisible() && await revealed(blocked) > 1);
  const quota = (await setup({}, 'quota')).page;
  check('quota failure is contained with warning', await quota.locator('#storage-note').isVisible());
  const corrupt = (await setup({}, 'corrupt')).page;
  check('corrupt JSON resets to valid empty records', JSON.stringify(await getSave(corrupt)) === JSON.stringify({ version: 1, best: {} }));
  const invalid = (await setup({}, 'fixture', { version: 1, best: { easy: 'bad' } })).page;
  check('invalid fields safely reset', JSON.stringify(await getSave(invalid)) === JSON.stringify({ version: 1, best: {} }));
  const unsupported = (await setup({}, 'fixture', { version: 42, best: { easy: 1000 } })).page;
  check('unsupported storage version safely resets', JSON.stringify(await getSave(unsupported)) === JSON.stringify({ version: 1, best: {} }));
  const showcase = (await setup({}, '', undefined, 2026)).page;
  await cell(showcase, 27).click();
  const hiddenShowcase = showcase.locator('.cell:not(.revealed)').last();
  await hiddenShowcase.click({ button: 'right' });
  await showcase.waitForTimeout(1100);
  check('seeded varied desktop board remains genuinely in progress', await showcase.locator('#board').getAttribute('data-status') === 'playing');
  await showcase.screenshot({ path: `${out}/desktop-1440.png`, fullPage: true });
  const touchShowcase = (await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '', undefined, 2026)).page;
  await cell(touchShowcase, 27).tap(); await tap(touchShowcase, '#mode-flag');
  await touchShowcase.locator('.cell:not(.revealed)').last().tap(); await tap(touchShowcase, '#mode-reveal');
  await touchShowcase.waitForTimeout(1100);
  check('seeded mobile showcase uses real touch and remains in progress', await touchShowcase.locator('#board').getAttribute('data-status') === 'playing');
  await touchShowcase.screenshot({ path: `${out}/mobile-390.png`, fullPage: true });
  check('no pageerror, console errors or failing resource responses', errors.length === 0);
  await writeFile(`${out}/smoke-results.json`, JSON.stringify({ base, passed: checks.length, checks, errors }, null, 2));
  console.log(`\n${checks.length} browser checks passed against ${base}. Screenshots: ${out}`);
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  if (errors.length) console.error(errors);
}
