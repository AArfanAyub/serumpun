// One-off QA helper: click through Serumpun's offline user flow in a real mobile viewport.
// Usage: node qa-artifacts/cdp-flow.mjs "Use a sample field" "Describe my field" ...
import { writeFileSync } from 'node:fs';

const steps = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('No page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 1;
const pending = new Map();
const problems = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    problems.push('EXCEPTION: ' + (message.params?.exceptionDetails?.text ?? 'unknown'));
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
    problems.push('CONSOLE ERROR: ' + message.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await sleep(5000);

async function state(label) {
  const info = await evaluate(`JSON.stringify({
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    h2: document.querySelector('h2')?.textContent?.trim() ?? null,
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean),
    text: document.body.innerText.slice(0, 320).replace(/\\n+/g, ' | '),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  })`);
  const parsed = JSON.parse(info);
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL(`./${name}.png`, import.meta.url), Buffer.from(result.data, 'base64'));
  console.log(`saved ${name}.png`);
}

await state('S0 welcome');
await shot('flow-00-welcome');

for (let i = 0; i < steps.length; i += 1) {
  const needle = steps[i];
  const clicked = await evaluate(`(() => {
    const target = ${JSON.stringify(needle)};
    const buttons = [...document.querySelectorAll('button, a[role="button"], a')];
    const match = buttons.find(b => b.textContent.toLowerCase().includes(target.toLowerCase()));
    if (!match) return 'NOT FOUND: ' + target;
    match.click();
    return 'CLICKED: ' + match.textContent.trim();
  })()`);
  console.log(`\nstep ${i + 1}: ${clicked}`);
  await sleep(1400);
  await state(`after "${needle}"`);
  await shot(`flow-${String(i + 1).padStart(2, '0')}`);
}

console.log('\n=== RUNTIME PROBLEMS ===');
console.log(problems.length ? problems.join('\n') : 'none');
ws.close();
