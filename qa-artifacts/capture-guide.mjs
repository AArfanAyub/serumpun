// Capture one full-page screenshot for every screen of the LIVE Serumpun web app.
// Used to build the "how to use the website" HTML slide deck.
// Usage: node qa-artifacts/capture-guide.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'guide-screens');
mkdirSync(OUT, { recursive: true });

const PORT = 9226;
const PROFILE = join(tmpdir(), 'serumpun-guide-profile');
rmSync(PROFILE, { recursive: true, force: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = 'https://aarfanayub.github.io/serumpun/';
const WIDTH = 430;
const HEIGHT = 900;

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;

async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* still starting */ }
    await sleep(500);
  }
  throw new Error('Chrome did not expose a page target');
}

let nextId = 1;
const pending = new Map();
const problems = [];
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function click(text, { last = false } = {}) {
  return evaluate(`(() => {
    const needle = ${JSON.stringify(text.toLowerCase())};
    const nodes = [...document.querySelectorAll('button, a')]
      .filter(x => (x.textContent || '').trim().toLowerCase().includes(needle) && !x.disabled);
    const el = ${last ? 'nodes[nodes.length - 1]' : 'nodes[0]'};
    if (!el) return 'NOT FOUND: ' + ${JSON.stringify(text)};
    el.click();
    return 'CLICKED: ' + (el.textContent || '').trim().slice(0, 60);
  })()`);
}
async function heading() {
  return evaluate(`(() => {
    const h = document.querySelector('h1, h2');
    return (h ? h.textContent.trim() : '(no heading)') +
      ' | ' + document.body.innerText.slice(0, 110).replace(/\\n+/g, ' / ');
  })()`);
}
async function capture(name, label) {
  await evaluate('window.scrollTo(0, 0)');
  await sleep(350);
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
  });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`SHOT ${name.padEnd(24)} | ${await heading()}`);
  console.log(`     label: ${label}`);
}
async function step(text, waitMs = 1200, opts = {}) {
  const result = await click(text, opts);
  console.log(`     ${result}`);
  if (result.startsWith('NOT FOUND')) problems.push(`missing button: ${text}`);
  await sleep(waitMs);
}

try {
  const page = await connect();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION: ' + m.params?.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
      problems.push('CONSOLE: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url: SITE });

  // Wait for React to paint.
  for (let i = 0; i < 40; i += 1) {
    const ready = await evaluate(`!!document.querySelector('h1') && document.getElementById('root')?.children.length > 0`);
    if (ready) break;
    await sleep(500);
  }
  await sleep(1500);

  await capture('00-welcome', 'S0 · Welcome');

  await step('Find my field', 1300);
  await capture('01-find-field', 'S1 · Find your field');

  await step('Use a sample field', 4200);
  await capture('02-snapshot', 'S2 · Your field snapshot');

  await step('Describe my field', 1200);
  await capture('03-profile-soil', 'S3 step 1 · Soil');

  await step('Next', 900);
  await capture('04-profile-water', 'S3 step 2 · Water & terrain');

  await step('Next', 900);
  await capture('05-profile-history', 'S3 step 3 · History & size');

  await step('See recommended crops', 4200);
  await capture('06-recommendations', 'S4 · Recommendations');

  await step('Why this crop', 1800);
  await capture('07-why', 'S5 · Why this crop?');

  await step('See 3-season rotation plan', 2200);
  await capture('08-rotation', 'S6 · Three-season rotation plan');

  await step('Compare rotation strategies', 2200);
  await capture('09-strategies', 'S6B · Compare rotation strategies');

  await step('Data & sources', 1600, { last: true });
  await capture('10-data-sources', 'S7 · Data & sources');

  console.log('\n=== PROBLEMS ===');
  console.log(problems.length ? problems.join('\n') : 'none');
  console.log(`\nScreenshots written to ${OUT}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
}
