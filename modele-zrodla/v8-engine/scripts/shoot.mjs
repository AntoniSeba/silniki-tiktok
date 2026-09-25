// shoot.mjs - minimal CDP driver: navigate to a page, run JS, capture PNGs.
// usage: node shoot.mjs <port> <url> <outDir> '<json plan>'
// plan: [{ "name": "front", "js": "window.__setView('front')", "wait": 1200 }]

import fs from 'node:fs';
import path from 'node:path';

const [, , port, url, outDir, planJson] = process.argv;
const plan = JSON.parse(planJson || '[]');

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
if (!target) throw new Error('no page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const logs = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push(`EXCEPTION: ${d.exception?.description || d.text} @ ${d.url}:${d.lineNumber}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    logs.push(`CONSOLE.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => ws.addEventListener('open', r));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });

let ready = false;
for (let i = 0; i < 120; i++) {
  await sleep(500);
  try {
    const r = await send('Runtime.evaluate', { expression: 'String(window.__READY)', returnByValue: true });
    if (r.result.value === 'true') {
      ready = true;
      break;
    }
  } catch {}
}
console.log('ready:', ready);
console.log('errors:', JSON.stringify(logs, null, 1));

fs.mkdirSync(outDir, { recursive: true });
for (const shot of plan) {
  if (shot.js) await send('Runtime.evaluate', { expression: shot.js, returnByValue: true });
  await sleep(shot.wait ?? 900);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `${shot.name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('shot:', file);
}
console.log('stats:', JSON.stringify((await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__stats ? window.__stats() : null)', returnByValue: true })).result.value));
console.log('late-errors:', JSON.stringify(logs));
ws.close();
process.exit(0);
