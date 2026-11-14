// One-off QA helper: prove the packaged Serumpun.exe actually rendered the app.
// Connects to Electron's --remote-debugging-port and inspects the real renderer DOM.
import { writeFileSync } from 'node:fs';

const PORT = Number(process.env.CDP_PORT || 9224);
const LABEL = process.env.CDP_LABEL || 'electron';

async function targets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  if (!response.ok) throw new Error(`DevTools endpoint returned ${response.status}`);
  return response.json();
}

let list = [];
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    list = await targets();
    if (list.some((t) => t.type === 'page')) break;
  } catch {
    /* app still starting */
  }
  await new Promise((r) => setTimeout(r, 750));
}

const page = list.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'));
if (!page) {
  console.log('TARGETS', JSON.stringify(list, null, 2));
  throw new Error('No Serumpun renderer page found');
}
console.log('PAGE', page.url, page.title);

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
  if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
    problems.push('LOG ERROR: ' + message.params.entry.text);
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await new Promise((r) => setTimeout(r, 1500));

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const info = JSON.parse(
  await evaluate(`JSON.stringify({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 10),
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    bodyText: document.body.innerText.slice(0, 420).replace(/\\n+/g, ' | '),
    hasModuleScript: !!document.querySelector('script[type="module"]'),
    stylesheetCount: document.styleSheets.length,
    swSupported: 'serviceWorker' in navigator,
    origin: location.origin
  })`)
);
console.log('DOM', JSON.stringify(info, null, 2));

const shot = await send('Page.captureScreenshot', { format: 'png' });
const file = new URL(`./${LABEL}-desktop.png`, import.meta.url);
writeFileSync(file, Buffer.from(shot.data, 'base64'));
console.log('SCREENSHOT', file.pathname ?? file.href);

console.log('PROBLEMS', problems.length ? JSON.stringify(problems, null, 2) : 'none');

const ok =
  info.h1 === 'Know what to plant, and why.' &&
  info.rootChildren > 0 &&
  info.stylesheetCount > 0 &&
  problems.length === 0;
console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
ws.close();
process.exit(ok ? 0 : 1);
