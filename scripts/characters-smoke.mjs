import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.GAME_URL || 'http://localhost:5176';
const out = fileURLToPath(new URL('../artifacts/', import.meta.url));
const key = 'puzzle-minesweeper-character-v1';
const ids = ['classic', 'chiikawa', 'hachiware', 'usagi', 'mole-croquette', 'old-dog', 'bear-raincoat', 'bear-pajama', 'bear-ninja', 'kurimanju', 'momonga', 'rakko', 'shisa', 'furuhonya', 'bear-strawberry', 'bear-frog', 'bear-astronaut', 'bear-chef', 'bear-pirate'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [], errors = [], checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const selected = page => page.locator('[data-character][aria-pressed="true"]').getAttribute('data-character');
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth === innerWidth);

async function setup(options = {}, mode = '', raw = '') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  contexts.push(context);
  if (mode) await context.addInitScript(({ mode, key, raw }) => {
    if (mode === 'blocked') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    else if (mode === 'quota') Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    else if (!sessionStorage.getItem('character-seeded')) { localStorage.setItem(key, raw); sessionStorage.setItem('character-seeded', '1'); }
  }, { mode, key, raw });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#crew-avatar').waitFor();
  return page;
}

try {
  await mkdir(out, { recursive: true });
  const page = await setup();
  check('default companion is named and has useful image alt text', await selected(page) === 'classic' && await page.locator('#crew-name').textContent() === '自嘲熊' && (await page.locator('#crew-avatar').getAttribute('alt')).includes('Joke Bear'));
  check('companion is a native details selector without another dialog', await page.locator('details#crew-selector').count() === 1 && await page.locator('dialog').count() === 1);
  check('closed companion does not overlap the board', await page.evaluate(() => {
    const companion = document.querySelector('#crew-selector').getBoundingClientRect(), board = document.querySelector('#board').getBoundingClientRect();
    return companion.right <= board.left || companion.left >= board.right || companion.bottom <= board.top || companion.top >= board.bottom;
  }));
  await page.screenshot({ path: `${out}/characters-desktop.png`, fullPage: true });
  await page.locator('#crew-summary').click();
  check('all nineteen avatar choices have accessible names', await page.locator('[data-character]').count() === 19 && await page.locator('[data-character]').evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-label')?.startsWith('选择'))));
  await page.waitForFunction(() => [...document.querySelectorAll('.crew-grid img')].every(image => image.complete && image.naturalWidth > 0));
  check('all nineteen local WebP portraits load successfully', await page.locator('.crew-grid img').evaluateAll(images => images.length === 19 && images.every(image => image.complete && image.naturalWidth > 0 && image.src.endsWith('.webp') && image.alt.length > 0)));
  check('local roster IDs match all original catalog identities', JSON.stringify(await page.locator('[data-character]').evaluateAll(buttons => buttons.map(button => button.dataset.character))) === JSON.stringify(ids));
  await page.screenshot({ path: `${out}/characters-roster-desktop.png`, fullPage: true });
  await page.locator('[data-character="bear-astronaut"]').click();
  check('choosing a portrait updates companion, selection and collapsed state', await selected(page) === 'bear-astronaut' && await page.locator('#crew-name').textContent() === '太空熊' && await page.locator('#crew-selector').getAttribute('open') === null && await page.locator('#crew-avatar').getAttribute('src').then(src => src.includes('bear-astronaut.webp')));
  check('selection returns focus to summary and saves separately', await page.locator('#crew-summary').evaluate(el => el === document.activeElement) && await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id === 'bear-astronaut', key));
  await page.reload({ waitUntil: 'networkidle' });
  check('portrait choice survives reload', await selected(page) === 'bear-astronaut');
  await page.locator('#crew-summary').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  check('keyboard expands roster and reaches a clearly focused choice', await page.locator('#crew-selector').getAttribute('open') !== null && await page.locator('[data-character="classic"]').evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'));
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  check('keyboard can select a different companion', await selected(page) === 'chiikawa' && await page.locator('#crew-selector').getAttribute('open') === null);
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
  check('Escape collapses roster and returns focus to summary', await page.locator('#crew-selector').getAttribute('open') === null && await page.locator('#crew-summary').evaluate(el => el === document.activeElement));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('f');
  check('companion keyboard actions never flag or reveal game cells', await page.locator('.cell.flagged,.cell.revealed').count() === 0);
  await page.locator('[data-index="0"]').focus(); await page.keyboard.press('f');
  check('board keyboard flagging remains intact', await page.locator('[data-index="0"]').getAttribute('class').then(value => value.includes('flagged')));
  await page.locator('#restart').click(); await page.locator('[data-difficulty="hard"]').click();
  check('restarting and changing difficulty preserve chosen companion', await selected(page) === 'chiikawa' && await page.locator('.cell').count() === 144);

  const mobile = await setup({ viewport: { width: 360, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  check('360px closed companion has no horizontal overflow', await noOverflow(mobile));
  await mobile.locator('#crew-summary').tap();
  check('360px open roster stays within viewport', await noOverflow(mobile) && await mobile.locator('.crew-grid').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
  await mobile.locator('[data-character="bear-pirate"]').tap();
  check('touch can select the final roster character and close', await selected(mobile) === 'bear-pirate' && await mobile.locator('#crew-name').textContent() === '海盗熊' && await mobile.locator('#crew-selector').getAttribute('open') === null);
  await mobile.locator('[data-difficulty="hard"]').tap();
  check('360px challenge and companion together remain within page', await noOverflow(mobile) && await mobile.locator('.cell').count() === 144);
  await mobile.screenshot({ path: `${out}/characters-mobile-360.png`, fullPage: true });
  await mobile.locator('#crew-summary').tap();
  await mobile.screenshot({ path: `${out}/characters-roster-mobile-360.png`, fullPage: true });
  await mobile.keyboard.press('Escape');
  await mobile.reload({ waitUntil: 'networkidle' });
  check('mobile choice also survives refresh', await selected(mobile) === 'bear-pirate');

  for (const [name, raw] of [['corrupt JSON', '{broken'], ['illegal ID', '{"version":1,"id":"not-real"}'], ['unsupported version', '{"version":7,"id":"usagi"}']]) {
    const invalid = await setup({}, 'seed', raw);
    check(`${name} falls back to the default companion`, await selected(invalid) === 'classic');
  }
  for (const mode of ['blocked', 'quota']) {
    const unavailable = await setup({}, mode);
    await unavailable.locator('#crew-summary').click(); await unavailable.locator('[data-character="hachiware"]').click();
    check(`${mode} storage permits in-memory companion selection`, await selected(unavailable) === 'hachiware' && await unavailable.locator('#crew-selector').getAttribute('open') === null);
    await unavailable.locator('#crew-summary').click();
    check(`${mode} storage gives a clear persistence warning`, await unavailable.locator('#crew-save-note').isVisible());
    await unavailable.keyboard.press('Escape'); await unavailable.locator('[data-index="0"]').click();
    check(`${mode} storage leaves the game playable`, await unavailable.locator('.cell.revealed').count() > 0);
  }
  check('no cheat globals, page errors, console errors or HTTP failures', errors.length === 0 && await page.evaluate(() => !('game' in window) && !('__GAME__' in window) && !('__characters' in window)));
  await writeFile(`${out}/characters-results.json`, JSON.stringify({ base, passed: checks.length, checks, errors }, null, 2));
  console.log(`\n${checks.length} companion checks passed against ${base}.`);
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  if (errors.length) console.error(errors);
}
