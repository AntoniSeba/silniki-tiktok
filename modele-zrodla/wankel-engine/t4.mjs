import fs from 'node:fs';
const src = fs.readFileSync('./src/lib/trochoid.js', 'utf8');
async function variant(midR, apexR = 11.5) {
  let s = src.replace(/export const FLANK_MID = [^;]+;/, `export const FLANK_MID = ${midR};`);
  s = s.replace(/export const APEX_TIP_R = [^;]+;/, `export const APEX_TIP_R = ${apexR};`);
  const f = `./src/lib/_v_${midR}_${apexR}.js`;
  fs.writeFileSync(f, s.replace(/from 'three'/, "from 'three'"));
  const m = await import(f + '?v=' + Math.random());
  let vMax = 0, vMin = 1e9, sMin = 1e9, sMax = 0;
  for (let i = 0; i < 200; i++) {
    const th = i / 200 * 2 * Math.PI;
    const a = m.chamberAreas(th);
    const s2 = a[0] + a[1] + a[2];
    sMin = Math.min(sMin, s2); sMax = Math.max(sMax, s2);
    for (const x of a) { const v = x * m.WIDTH / 1000; vMax = Math.max(vMax, v); vMin = Math.min(vMin, v); }
  }
  let maxR = 0; for (const p of m.ROTOR_OUTLINE) maxR = Math.max(maxR, p.length());
  fs.unlinkSync(f);
  return { vMax, vMin, swept: vMax - vMin, cr: vMax / vMin, maxR, close: (sMax - sMin) / sMax };
}
console.log('midR | crown | Vmax | Vmin | swept | CR | outline maxR');
for (const midR of [60, 65, 67.5, 70, 72, 74, 76, 78, 80, 82, 84, 86]) {
  const r = await variant(midR);
  console.log(`${String(midR).padStart(5)} | ${(midR - 52.5).toFixed(1).padStart(5)} | ${r.vMax.toFixed(0).padStart(5)} | ${r.vMin.toFixed(0).padStart(5)} | ${r.swept.toFixed(0).padStart(5)} | ${r.cr.toFixed(2).padStart(5)} | ${r.maxR.toFixed(2)}`);
}
