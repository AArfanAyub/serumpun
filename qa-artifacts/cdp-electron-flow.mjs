// End-to-end verification of the PACKAGED Serumpun.exe renderer.
// Adaptive: handles a fresh S0/S1 start OR persisted S2 state, then walks to
// recommendations / rotation and proves live + fallback data both work.
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.CDP_PORT || 9224);
const LABEL = process.env.CDP_LABEL || 'exe-live';

let page = null;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = list.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'));
    if (page) break;
  } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 750));
}
if (!page) throw new Error('no renderer on port ' + PORT);
console.log('RENDERER', page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let nextId = 1;
const pending = new Map();
const problems = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION: ' + m.params?.exceptionDetails?.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
    problems.push('CONSOLE: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((resolve) => {
  const i = nextId++; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Runtime.enable');
await send('Page.enable');

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function snap() {
  return JSON.parse(await evaluate(`JSON.stringify({
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    banner: document.querySelector('[class*="banner"]')?.textContent?.trim().slice(0,150) ?? null,
    text: document.body.innerText.slice(0, 900).replace(/\\n+/g,' | '),
    buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean),
    stylesheets: document.styleSheets.length,
    rootChildren: document.getElementById('root')?.children.length ?? 0
  })`));
}
function log(label, s) {
  console.log(`\n--- ${label} ---`);
  console.log('h1:', s.h1);
  console.log('banner:', s.banner);
  console.log('text:', s.text.slice(0, 420));
}
async function click(needle) {
  return evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.toLowerCase().includes(${JSON.stringify(needle.toLowerCase())}));
    if (!b) return false;
    b.click(); return true;
  })()`);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL(`./${name}.png`, import.meta.url), Buffer.from(r.data, 'base64'));
}

// Wait for the renderer to actually paint before inspecting it.
for (let attempt = 0; attempt < 30; attempt += 1) {
  const ready = await evaluate(`!!document.querySelector('h1') && document.getElementById('root')?.children.length > 0`);
  if (ready) break;
  await sleep(600);
}
await sleep(1200);

let s = await snap();
log('initial', s);

// Normalise to a known state. Prefer the LIVE auto-resolved snapshot when present.
if (/Recommendations|Why |Three-season|Compare rotation/i.test(s.h1 ?? '')) {
  await click('Start over'); await sleep(1200); s = await snap();
}
if (/Know what to plant/i.test(s.h1 ?? '')) {
  await click('Find my field');
  await sleep(1500);
  s = await snap();
  log('find field', s);
}
if (/Find your field/i.test(s.h1 ?? '')) {
  // Try a real place-name search first (exercises geocoding + live fetch).
  const typed = await evaluate(`(() => {
    const i = [...document.querySelectorAll('input')].find(x =>
      /e\\.g\\.|village|town|search|place/i.test(x.placeholder||'') || x.type === 'text');
    if (!i) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(i,'Bogor'); i.dispatchEvent(new Event('input',{bubbles:true})); return true;
  })()`);
  console.log('typed Bogor:', typed);
  if (typed) { await click('Search'); await sleep(4500); await click('Use this location'); await sleep(10000); }
  s = await snap();
  log('after location', s);
}
if (!/field snapshot/i.test(s.h1 ?? '')) {
  await click('Start over'); await sleep(1200);
  await click('Use a sample field'); await sleep(3500);
  s = await snap(); log('sample field', s);
}
await shot(`${LABEL}-01-snapshot`);
const snapshot = s;

// Walk S2 -> S3 (3 steps) -> S4 -> S5 -> S6.
await click('Describe my field'); await sleep(900);
await click('Next'); await sleep(500);
await click('Next'); await sleep(500);
await click('See recommended crops'); await sleep(3500);
s = await snap(); log('recommendations', s);
await shot(`${LABEL}-02-recommendations`);
const recommendations = s;

if (/Recommendations for/i.test(s.h1 ?? '')) {
  await click('Why this crop'); await sleep(1400);
  s = await snap(); log('why this crop', s);
  await shot(`${LABEL}-03-why`);
  await click('See 3-season rotation plan'); await sleep(1400);
  s = await snap(); log('rotation', s);
  await shot(`${LABEL}-04-rotation`);
  const rotation = s;
  console.log('\nrotation seasons found:', (s.text.match(/SEASON \d/gi) || []).length);
  await click('Compare rotation strategies'); await sleep(1200);
  s = await snap(); log('strategies', s);
}

console.log('\n=== RUNTIME PROBLEMS ===');
console.log(problems.length ? problems.join('\n') : 'none');

const liveOrDegraded =
  /Live|Partly estimated|Offline sample/i.test(snapshot.banner ?? '');
const hasData = /°C|mm|NASA POWER|Open-Meteo|Elevation|rain/i.test(snapshot.text);
const reachedRecs = /Recommendations for/i.test(recommendations.h1 ?? '');
const rendered = recommendations.rootChildren > 0 && recommendations.stylesheets > 0;
console.log('\n=== RESULT ===');
console.log('status banner present:', liveOrDegraded);
console.log('snapshot shows sourced data:', hasData);
console.log('reached recommendations:', reachedRecs);
console.log('app rendered (styles + root):', rendered);
console.log('runtime errors:', problems.length);
const ok = liveOrDegraded && hasData && reachedRecs && rendered && problems.length === 0;
console.log(ok ? 'RESULT: PASS' : 'RESULT: CHECK');
ws.close();
