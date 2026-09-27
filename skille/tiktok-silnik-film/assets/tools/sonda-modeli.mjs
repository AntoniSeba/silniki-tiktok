// sonda modeli: node sonda-modeli.mjs <url do _sonda.html> <katalog na zdjęcia> <model...>
// serwer: npx http-server -p 8093 -s assets/models; url: http://localhost:8093/_sonda.html
// wynik: spin = części kręcące się w miejscu w poprzek osi (pałki), discs = tarcze na osi wału ustawione w poprzek
import { chromium } from 'playwright';
import fs from 'fs';
const [,, base, out, ...models] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const m of models) {
  const p = await b.newPage({ viewport: { width: 800, height: 800 } });
  p.on('pageerror', (e) => console.log(m, 'pageerror:', e.message));
  await p.goto(`${base}?m=${m}`);
  try { await p.waitForFunction('window.READY', null, { timeout: 120000 }); } catch (e) { console.log(m, 'TIMEOUT'); await p.close(); continue; }
  console.log(JSON.stringify(await p.evaluate('window.info')));
  const shots = process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [[0.8, 0.35, 1.5, 0], [0.8, 0.35, 1.5, 100], [2.4, 0.3, 1.5, 50], [-0.8, 0.3, 1.5, 200], [-2.4, -0.35, 1.5, 300], [1.57, 1.35, 1.5, 150]];
  let i = 0;
  for (const s of shots) { const d = await p.evaluate(`window.shot(${s.join(',')})`); fs.writeFileSync(`${out}/${m}-${i++}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
  await p.close();
}
await b.close();
