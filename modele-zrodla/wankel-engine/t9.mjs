import fs from 'node:fs';
const src = fs.readFileSync('./src/lib/trochoid.js', 'utf8');
async function cr(midR) {
  const s = src.replace(/export const FLANK_MID = [^;]+;/, `export const FLANK_MID = ${midR};`);
  const f = `./src/lib/_c_${midR}.js`;
  fs.writeFileSync(f, s);
  const m = await import(f + '?v=' + Math.random());
  let vMax = 0, vMin = 1e9, sMin = 1e9, sMax = 0;
  for (let i = 0; i < 240; i++) {
    const a = m.chamberAreas(i / 240 * 2 * Math.PI);
    const t = a[0] + a[1] + a[2];
    sMin = Math.min(sMin, t); sMax = Math.max(sMax, t);
    for (const x of a) { const v = x * m.WIDTH / 1000; vMax = Math.max(vMax, v); vMin = Math.min(vMin, v); }
  }
  fs.unlinkSync(f);
  return { vMax, vMin, swept: vMax - vMin, cr: vMax / vMin };
}
for (const midR of [70.6, 72, 73, 74, 75, 76, 77]) {
  const r = await cr(midR);
  console.log(`crown midR ${midR} (crown ${(midR-52.5).toFixed(1)}) Vmax ${r.vMax.toFixed(1)} Vmin ${r.vMin.toFixed(1)} swept ${r.swept.toFixed(1)} CR ${r.cr.toFixed(2)}`);
}
