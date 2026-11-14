// Diagnose live API reachability from INSIDE the packaged Electron renderer.
let page = null;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
    page = list.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'));
    if (page) break;
  } catch { /* still starting */ }
  await new Promise((r) => setTimeout(r, 750));
}
if (!page) throw new Error('no renderer');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 1;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const i = id++; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params }));
});
await send('Runtime.enable');

const expression = `(async () => {
  const out = { onLine: navigator.onLine, origin: location.origin, ua: navigator.userAgent.slice(0, 80) };
  const urls = {
    power: 'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=110.42&latitude=-7.55&format=JSON',
    meteo: 'https://api.open-meteo.com/v1/forecast?latitude=-7.55&longitude=110.42&current=temperature_2m&timezone=auto'
  };
  for (const [name, url] of Object.entries(urls)) {
    try {
      const r = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
      const text = await r.text();
      out[name] = { status: r.status, bytes: text.length, sample: text.slice(0, 90) };
    } catch (e) { out[name] = { error: String(e) }; }
  }
  out.localStorageKeys = Object.keys(localStorage);
  return JSON.stringify(out);
})()`;

const result = await send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
});
console.log(result.result?.value ?? JSON.stringify(result));
ws.close();
