// One-off QA helper: verify Serumpun at a TRUE 375px mobile viewport via CDP emulation.
import { writeFileSync } from 'node:fs';

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
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
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

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await sleep(6000);

const metrics = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    title: document.title,
    h1: document.querySelector('h1')?.textContent ?? null,
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 8),
    banner: document.querySelector('[class*="banner"]')?.textContent?.trim().slice(0, 160) ?? null,
    rootChildren: document.getElementById('root')?.children.length ?? 0
  })`,
  returnByValue: true,
});
console.log('METRICS', metrics.result.value);

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(
  new URL('./welcome-375.png', import.meta.url),
  Buffer.from(shot.data, 'base64')
);
console.log('SAVED welcome-375.png');
ws.close();
