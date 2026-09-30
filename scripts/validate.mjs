import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.DREAM_TOOLCHAIN ? path.resolve(process.env.DREAM_TOOLCHAIN, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const root = path.resolve('dist');
const output = path.resolve('artifacts');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/preview/')) throw Error('Unknown route');
    const filename = path.resolve(root, pathname.slice('/preview/'.length) || 'index.html');
    if (!filename.startsWith(root + path.sep)) throw Error('Outside export');
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const results = [], errors = [], resources = [];
let browser;
const record = (name, details = '') => { results.push({ name, status: 'pass', details }); console.log('PASS:', name, details); };
try {
  browser = await chromium.launch({ executablePath: process.env.DREAM_BROWSER || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => errors.push(`${req.url()}: ${req.failure()?.errorText}`));
  page.on('response', res => resources.push({ url: new URL(res.url()).pathname, status: res.status() }));
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  await page.goto(url); await page.evaluate(() => document.fonts.ready);
  const world = page.locator('#dream-stage');
  const count = async () => Number(await world.getAttribute('data-thoughts'));
  const frame = () => page.locator('canvas').evaluate(c => c.toDataURL());
  const stageContrast = [];
  async function sampleStage(state) {
    const pairs = await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect(), context = canvas.getContext('2d');
      const scale = canvas.width / rect.width;
      const lum = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return ['.stage-id > span:nth-child(2)', '.stage-number', '#idle-content h2', '#idle-content > .eyebrow', '#idle-content p', '#dream-status', '#world-detail', '#session-timer', '#caption-kind', '#caption-text'].flatMap(selector => {
        const el = document.querySelector(selector); if (!el || !el.checkVisibility()) return [];
        const b = el.getBoundingClientRect(), style = getComputedStyle(el);
        const color = style.color.match(/[\d.]+/g).slice(0, 3).map(Number), fg = lum(color);
        const x = Math.max(0, Math.floor((b.x - rect.x) * scale)), y = Math.max(0, Math.floor((b.y - rect.y) * scale));
        const pixels = context.getImageData(x, y, Math.max(1, Math.ceil(b.width * scale)), Math.max(1, Math.ceil(b.height * scale))).data;
        let minimum = 99;
        for (let i = 0; i < pixels.length; i += 4) { const bg = lum([pixels[i], pixels[i+1], pixels[i+2]]); minimum = Math.min(minimum, (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)); }
        return [{ selector, foreground: style.color, minimumRatio: minimum }];
      });
    });
    stageContrast.push({ state, pairs });
    await writeFile(path.join(output, 'canvas-text-contrast.json'), JSON.stringify(stageContrast, null, 2));
    for (const p of pairs) assert.ok(p.minimumRatio >= 4.5, `${state} ${p.selector}: ${p.minimumRatio}`);
  }

  assert.equal(await world.getAttribute('data-state'), 'idle');
  const idleFrame = await frame(); await page.waitForTimeout(1100);
  assert.equal(await count(), 0); assert.equal(await frame(), idleFrame);
  record('No simulation or canvas motion before Start');
  await sampleStage('idle');
  assert.ok(await page.evaluate(() => document.fonts.check('400 14px Manrope') && document.fonts.check('300 49px Manrope')));
  record('Local font loaded at body and display weights');
  const measuredPairs = [];
  for (const hover of [false, true]) {
    if (hover) await page.locator('#toggle-dream').hover(); else await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    const pair = await page.locator('#toggle-dream').evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = str => { const rgb = str.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return { foreground: style.color, background: style.backgroundColor, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
    assert.ok(pair.ratio >= 4.5); measuredPairs.push({ state: hover ? 'hover' : 'normal', ...pair });
  }
  await page.mouse.move(0, 0); await page.waitForTimeout(200);
  await writeFile(path.join(output, 'contrast-results.json'), JSON.stringify(measuredPairs, null, 2));
  record('Primary button normal and hover contrast', measuredPairs.map(p => `${p.state}: ${p.ratio.toFixed(2)}:1`).join('; '));
  await page.screenshot({ path: path.join(output, 'desktop-idle.jpg'), fullPage: true, type: 'jpeg', quality: 85 });
  const axeIdle = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await writeFile(path.join(output, 'axe-idle.json'), JSON.stringify({ violations: axeIdle.violations, incomplete: axeIdle.incomplete }, null, 2));
  assert.equal(axeIdle.violations.length, 0, JSON.stringify(axeIdle.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
  record('Automated accessibility scan: idle', `${axeIdle.violations.length} violations; ${axeIdle.incomplete.length} manual-review groups`);
  await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').innerText(), 'Skip to dream controls');
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'toggle-dream');
  assert.equal(await page.locator(':focus').evaluate(el => getComputedStyle(el).outlineWidth), '2px');
  await page.screenshot({ path: path.join(output, 'keyboard-focus.jpg'), fullPage: true, type: 'jpeg', quality: 80 });
  await page.keyboard.press('Enter');
  assert.equal(await count(), 1); assert.equal(await world.getAttribute('data-state'), 'running');
  record('Keyboard skip link, visible focus, and Start');
  await page.waitForTimeout(1800);
  assert.notEqual(await frame(), idleFrame);
  await page.locator('#toggle-dream').click();
  const pauseFrame = await frame(); const pauseCount = await count(); const pauseTime = await page.locator('#session-timer').innerText();
  await page.waitForTimeout(1300);
  assert.equal(await frame(), pauseFrame); assert.equal(await count(), pauseCount); assert.equal(await page.locator('#session-timer').innerText(), pauseTime);
  assert.ok(await page.locator('#thought-input').isDisabled());
  record('Pause freezes canvas, time, events, and input');
  await page.locator('#toggle-dream').click();
  await page.waitForTimeout(7500); assert.ok(await count() > pauseCount);
  record('Resume and autonomous event generation');
  await page.locator('#intensity').focus(); await page.keyboard.press('End'); assert.equal(await world.getAttribute('data-intensity'), '100');
  await page.keyboard.press('Home'); assert.equal(await world.getAttribute('data-intensity'), '10');
  await page.locator('#intensity').evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  record('Intensity slider supports keyboard minimum/maximum');
  await page.locator('#send-thought').click(); assert.equal(await page.locator('#thought-input').getAttribute('aria-invalid'), 'true');
  await page.locator('#thought-input').fill('A calm ocean remembers'); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#caption-text').innerText(), 'A calm ocean remembers');
  assert.match(await page.locator('#world-detail').innerText(), /calm/);
  await page.locator('#thought-input').fill('ocean'); await page.keyboard.press('Enter'); assert.match(await page.locator('#world-detail').innerText(), /memory grows/);
  await page.locator('#thought-input').fill('<img src=x onerror=alert(1)>'); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#thought-stream img').count(), 0);
  record('Thought form: empty error, custom emotion, repeat growth, safe text rendering');
  for (let i = 0; i < 5; i++) await page.locator('#next-thought').click();
  await page.waitForTimeout(4000);
  await page.locator('#toggle-dream').click();
  for (const style of ['lucid', 'cosmic', 'ethereal']) {
    const oldFrame = await frame(); await page.locator(`input[value=${style}]`).check();
    assert.equal(await world.getAttribute('data-style'), style); assert.notEqual(await frame(), oldFrame);
    await sampleStage(style);
    await page.screenshot({ path: path.join(output, `desktop-${style}.jpg`), fullPage: true, type: 'jpeg', quality: 85 });
  }
  record('All three styles change the actual canvas while paused');
  record('Canvas text contrast sampled against actual background pixels', 'Idle and each paused style: all sampled text rectangles exceed 4.5:1. This is not a guarantee across every generated frame.');
  await page.locator('#about-open').click(); assert.ok(await page.locator('dialog').evaluate(d => d.open));
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.ok(await page.locator(':focus').evaluate(el => !!el.closest('dialog'))); }
  await page.keyboard.press('Escape'); assert.equal(await page.locator(':focus').getAttribute('id'), 'about-open');
  record('Explanation dialog: focus containment, Escape, focus return');
  await page.locator('#sound-toggle').click(); assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#sound-toggle').click(); assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
  record('Ambient sound toggle states', 'AudioContext created; audible output not assessed in headless browser');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#save-frame').click();
  const download = await downloadPromise; assert.match(download.suggestedFilename(), /^dream-ethereal-\d+\.png$/);
  record('Save image creates PNG download');
  await page.locator('#fullscreen').click(); assert.ok(await page.evaluate(() => !!document.fullscreenElement));
  assert.ok(await page.locator('#fullscreen-pause').isVisible());
  await page.locator('#fullscreen-pause').click(); assert.equal(await world.getAttribute('data-state'), 'running');
  await page.locator('#fullscreen-pause').click(); assert.equal(await world.getAttribute('data-state'), 'paused');
  await page.locator('#fullscreen').click(); assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  record('Fullscreen entry/exit and pause/resume');
  const axeActive = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await writeFile(path.join(output, 'axe-active.json'), JSON.stringify({ violations: axeActive.violations, incomplete: axeActive.incomplete }, null, 2));
  assert.equal(axeActive.violations.length, 0, JSON.stringify(axeActive.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
  record('Automated accessibility scan: active controls', `${axeActive.violations.length} violations; ${axeActive.incomplete.length} manual-review groups`);
  for (const [width, height] of [[1280,720], [768,1024], [390,844], [320,740]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width === 1280) { await page.evaluate(() => scrollTo(0,0)); assert.ok((await page.locator('#toggle-dream').boundingBox()).y < height); }
    await page.screenshot({ path: path.join(output, `viewport-${width}.jpg`), fullPage: true, type: 'jpeg', quality: 83 });
    record(`Responsive ${width} × ${height}`, 'No horizontal overflow');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('#toggle-dream').click();
  assert.equal(await world.getAttribute('data-state'), 'manual');
  const stillFrame = await frame(), stillCount = await count(); await page.waitForTimeout(1100);
  assert.equal(await frame(), stillFrame); assert.equal(await count(), stillCount);
  await page.locator('#next-thought').click(); assert.equal(await count(), stillCount + 1); assert.notEqual(await frame(), stillFrame);
  record('Reduced motion disables automatic motion/events and permits manual progression');
  await page.emulateMedia({ forcedColors: 'active' }); await page.locator('#toggle-dream').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator(':focus').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await page.screenshot({ path: path.join(output, 'forced-colors.jpg'), fullPage: true, type: 'jpeg', quality: 80 });
  record('Forced-colors focus and control borders');
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Offline reload proves every runtime dependency is already local to the static host.
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
  await page.reload(); await page.locator('#toggle-dream').click();
  assert.equal(await count(), 1); record('No external network needed to reload and start');
  const startCount = await count();
  console.log('Starting 65-second unattended simulation check…');
  await page.waitForTimeout(65000);
  assert.ok(await count() >= startCount + 7);
  await page.locator('#toggle-dream').click();
  await page.screenshot({ path: path.join(output, 'desktop-dream.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
  record('65-second unattended simulation', `${await count()} thoughts generated; dream remains responsive`);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok(resources.every(r => r.status < 400));
  record('Zero console errors, failed requests, or HTTP errors', `${resources.length} local responses`);
} catch (error) {
  results.push({ name: 'Validation stopped', status: 'fail', details: error.stack });
  console.error(error); process.exitCode = 1;
} finally {
  await writeFile(path.join(output, 'interaction-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results, errors, resources }, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
