// render-mp4.mjs - deterministic frame renderer over CDP.
// usage: node render-mp4.mjs <port> <url> <outDir> <fps> <duration> <outFile> [frames]
// Renders exact timeline frames by seeking, then encodes with ffmpeg.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [, , port, url, outDir, fpsS, durS, outFile, frameLimit] = process.argv;
const FPS = parseInt(fpsS || '30', 10);
const DUR = parseFloat(durS || '5');
const limit = frameLimit ? parseInt(frameLimit, 10) : null;
const total = Math.round(FPS * DUR);

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
if (!target) throw new Error('no page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const errors = [];
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
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
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
// brightness is read at module init by the page
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__jasnosc = 1.3;' });
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });

for (let i = 0; i < 120; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'String(window.__READY)', returnByValue: true }).catch(() => null);
  if (r?.result?.value === 'true') break;
}
console.log('page ready');
// the cinematic cut carries no captions: switch off the annotation layer
await send('Runtime.evaluate', { expression: `(() => {
  if (window.__labelsVisible) window.__labelsVisible(false);
  if (window.__labels?.setVisible) window.__labels.setVisible(false);
  const n = document.querySelector('.labels'); if (n) n.style.display = 'none';
  return 'labels off';
})()`, returnByValue: true }).catch(() => null);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const t0 = Date.now();
const count = limit ?? total;
for (let i = 0; i < count; i++) {
  const t = (i / FPS) % DUR;
  await send('Runtime.evaluate', { expression: `window.__seek(${t})`, returnByValue: true });
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94, captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
  if (i % 10 === 0 || i === count - 1) {
    const rate = (Date.now() - t0) / (i + 1) / 1000;
    console.log(`frame ${i + 1}/${count}  t=${t.toFixed(2)}s  ${rate.toFixed(2)} s/frame  eta ${(((count - i - 1) * rate) / 60).toFixed(1)} min`);
  }
}
console.log('errors:', JSON.stringify(errors.slice(0, 4)));

if (!limit) {
  const out = path.resolve(outFile);
  execFileSync('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(outDir, '%04d.jpg'),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-movflags', '+faststart',
    out,
  ], { stdio: 'inherit' });
  console.log('wrote', out);
  const probe = execFileSync('/opt/homebrew/bin/ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size,bit_rate',
    '-show_entries', 'stream=width,height,r_frame_rate,codec_name',
    '-of', 'default=noprint_wrappers=1', out,
  ]).toString();
  console.log(probe);
}
ws.close();
process.exit(0);
