// klatki3.mjs - renderuje jedno ujecie 3D w trybie pelnej kontroli.
// usage: node klatki3.mjs <port> <url> <outDir> <fps> <sekundy> <outFile> <json-ujecia>
// json-ujecia: {"jasnosc":1.7,"reveal":1,"crankOd":0,"crankDo":180,
//               "az":-0.9,"elev":0.22,"zoom":0.45,"tx":null,"ty":null,"tz":null}

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [, , port, url, outDir, fpsS, durS, outFile, ujJson] = process.argv;
const FPS = parseInt(fpsS || '30', 10);
const DUR = parseFloat(durS || '3');
const UJ = JSON.parse(ujJson || '{}');
const count = Math.round(FPS * DUR);

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find((t) => t.type === 'page');
if (!target) throw new Error('brak strony do renderu');

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
await send('Runtime.enable');
await send('Network.enable');
// Moduly ES siedza w pamieci podrecznej przegladarki i po zmianie pliku
// strona dalej odpala stary kod. Bez tego renderuje sie nieaktualna wersja.
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__jasnosc = ${UJ.jasnosc ?? 1};`,
});

await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now() });
for (let i = 0; i < 120; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'String(window.__READY)', returnByValue: true }).catch(() => null);
  if (r?.result?.value === 'true') break;
}

// podpisy czesci: domyslnie wylaczone, wlaczane ustawieniem podpisy:true
await send('Runtime.evaluate', {
  expression: `if (window.__labelsVisible) window.__labelsVisible(${UJ.podpisy ? 'true' : 'false'});`,
  returnByValue: true,
});
if (UJ.filtr) {
  await send('Runtime.evaluate', {
    expression: `if (window.__labelsFiltr) window.__labelsFiltr(${JSON.stringify(UJ.filtr)});`,
    returnByValue: true,
  });
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

const t0 = Date.now();
for (let i = 0; i < count; i++) {
  const postep = count > 1 ? i / (count - 1) : 0;
  const ujecie = { ...UJ, postep, jasnosc: undefined };
  await send('Runtime.evaluate', {
    expression: `window.__ujecie = ${JSON.stringify(ujecie)}; window.__seek(${(i / FPS).toFixed(4)});`,
    returnByValue: true,
  });
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, `${String(i).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
  if (i % 30 === 0 || i === count - 1) {
    const rate = (Date.now() - t0) / (i + 1) / 1000;
    console.log(`  klatka ${i + 1}/${count}  postep=${postep.toFixed(2)}  ${rate.toFixed(2)} s/klatke`);
  }
}

const out = path.resolve(outFile);
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', String(FPS), '-i', path.join(outDir, '%04d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out,
], { stdio: 'inherit' });

const probe = execFileSync('/opt/homebrew/bin/ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-show_entries', 'stream=width,height', '-of', 'default=noprint_wrappers=1', out,
]).toString().trim().replace(/\n/g, ' ');
console.log(`  zapisano ${out}  ${probe}`);
console.log('  bledy:', JSON.stringify(errors.slice(0, 3)));
ws.close();
process.exit(0);
