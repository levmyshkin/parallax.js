#!/usr/bin/env node
/*
 * Behavioural comparison between the original jQuery parallax.js 1.5.0
 * (test/original/) and the dependency-free rewrite (parallax.js).
 *
 * Every case in test/cases.js runs in Chrome against each implementation;
 * after every action (scroll, resize, plugin call) the mirror/slider styles,
 * instance state and static state are compared. API checks for the rewrite
 * live in test/api-tests.js.
 *
 *   npm test                    # everything
 *   node test/run.js options    # selected cases
 *
 * Env: CHROME_PATH (defaults to the installed Chrome), FILE (build to test
 * instead of parallax.js, e.g. parallax.min.js), API=1 (run the API checks
 * even when case names are given).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'node_modules');
const vendor = {
  'jquery-1.js': path.join(modules, 'jquery1/dist/jquery.js'),
  'jquery-3.js': path.join(modules, 'jquery3/dist/jquery.js'),
  'jquery-4.js': path.join(modules, 'jquery4/dist/jquery.js')
};
const types = { '.js': 'application/javascript', '.html': 'text/html', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = null;
    if (url.startsWith('/vendor/')) { file = vendor[url.slice(8)]; }
    if (url.startsWith('/repo/')) { file = path.join(root, url.slice(6)); }
    if (!file || !file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCase(browser, base, config, name, meta) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, userAgent: meta.ua || undefined });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const file = process.env.FILE && config.impl === 'vanilla' ? '&file=' + process.env.FILE : '';
  await page.goto(`${base}/repo/test/harness.html?impl=${config.impl}&jq=${config.jq}&case=${name}${file}`);
  await page.waitForFunction(() => window.READY || window.LOAD_ERROR);
  const loadError = await page.evaluate(() => window.LOAD_ERROR);
  if (loadError) { throw new Error('failed to load ' + loadError); }
  await page.waitForLoadState('load');
  const actions = await page.evaluate((n) => T.setup(n), name);
  await sleep(300);
  const snaps = [await page.evaluate(() => T.snap())];
  for (const a of actions) {
    if (a.scroll !== undefined) {
      await page.evaluate((y) => window.scrollTo(0, y), a.scroll);
    } else if (a.resize) {
      await page.setViewportSize({ width: a.resize[0], height: a.resize[1] });
    } else if (a.plugin) {
      await page.evaluate((x) => T.plugin(x[0], x[1]), a.plugin);
    } else if (a.js) {
      await page.evaluate((code) => { (0, eval)(code); }, a.js);
    }
    await sleep(a.wait || 150);
    snaps.push(await page.evaluate(() => T.snap()));
  }
  await context.close();
  return { snaps, errors };
}

function diff(a, b, where, out) {
  if (out.length > 12) { return out; }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${where}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  } else if (a && typeof a === 'object') {
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => diff(a[k], b[k], `${where}.${k}`, out));
  } else if (a !== b) {
    out.push(`${where}:\n      original: ${a}\n      rewrite:  ${b}`);
  }
  return out;
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome'
  });

  const page = await browser.newPage();
  await page.goto(`${base}/repo/test/harness.html?impl=vanilla&jq=none`);
  await page.waitForFunction(() => window.READY);
  const meta = await page.evaluate(() => {
    const out = {};
    Object.keys(T.cases).forEach((k) => { out[k] = { jqOnly: !!T.cases[k].jqOnly, ua: T.cases[k].ua || null }; });
    return out;
  });
  await page.close();

  const args = process.argv.slice(2);
  const names = args.length ? args : Object.keys(meta);
  let failures = 0;

  for (const name of names) {
    const pairs = ['1', '3', '4'].map((jq) => [{ impl: 'original', jq }, { impl: 'vanilla', jq }]);
    if (!meta[name].jqOnly) { pairs.push([{ impl: 'original', jq: '3' }, { impl: 'vanilla', jq: 'none' }]); }
    const results = await Promise.all(pairs.map(async ([ref, test]) => {
      const safe = (c) => runCase(browser, base, c, name, meta[name]).catch((e) => ({ snaps: [], errors: ['runner: ' + e.message.split(/\r?\n/)[0]] }));
      const [a, b] = await Promise.all([safe(ref), safe(test)]);
      const problems = [];
      if (a.errors.length) { problems.push('original page errors: ' + a.errors.join('; ')); }
      if (b.errors.length) { problems.push('rewrite page errors: ' + b.errors.join('; ')); }
      diff(a.snaps, b.snaps, 'step', problems);
      return { label: `jq ${ref.jq} vs rewrite/jq ${test.jq}`, problems };
    }));
    for (const r of results) {
      if (r.problems.length) { failures++; }
      console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${name} [${r.label}]`);
      r.problems.forEach((p) => console.log('    ' + p));
    }
  }

  // Rewrite-only API checks, with and without jQuery.
  for (const jq of args.length && !process.env.API ? [] : ['none', '3', '1']) {
    const tests = await (async () => {
      const p = await browser.newPage();
      await p.goto(`${base}/repo/test/harness.html?impl=vanilla&jq=${jq}`);
      await p.waitForFunction(() => window.READY);
      const list = await p.evaluate(() => Object.keys(window.API_TESTS));
      await p.close();
      return list;
    })();
    for (const t of tests) {
      // A fresh page per check: the plugin keeps global state.
      const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      const p = await context.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(`${base}/repo/test/harness.html?impl=vanilla&jq=${jq}`);
      await p.waitForFunction(() => window.READY);
      await p.waitForLoadState('load');
      const res = await p.evaluate(async (n) => {
        try { await window.API_TESTS[n](); return null; } catch (e) { return e.message; }
      }, t);
      const problem = res || (errors.length ? 'page errors: ' + errors.join('; ') : null);
      if (problem) { failures++; }
      console.log(`${problem ? 'FAIL' : 'ok  '} api: ${t} [jq ${jq}]`);
      if (problem) { console.log('    ' + problem); }
      await context.close();
    }
  }

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failing check(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
