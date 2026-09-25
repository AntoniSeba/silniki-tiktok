// probe.mjs - evaluate an expression in the page and print the result.
// usage: node probe.mjs <port> <url> '<expression>'
import fs from 'node:fs';

const [, , port, url, expr] = process.argv;
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
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
await send('Network.enable').catch(() => null);
await send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => null);
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'String(window.__READY)', returnByValue: true }).catch(() => null);
  if (r?.result?.value === 'true') break;
}
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(typeof res.result.value === 'string' ? res.result.value : JSON.stringify(res.result.value, null, 1));
ws.close();
process.exit(0);
