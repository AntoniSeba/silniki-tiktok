import * as THREE from 'three';
import * as T from './src/lib/trochoid.js';
const th = 140 * Math.PI / 180;
for (let k = 0; k < 3; k++) {
  const poly = T.chamberPolygon(th, k, 44, 34);
  const tri = THREE.ShapeUtils.triangulateShape(poly.map(p => p.clone()), []);
  let a = 0;
  for (const f of tri) {
    const p = poly[f[0]], q = poly[f[1]], r = poly[f[2]];
    a += Math.abs((q.x-p.x)*(r.y-p.y) - (r.x-p.x)*(q.y-p.y)) / 2;
  }
  let sl = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i+1)%poly.length]; sl += p.x*q.y - q.x*p.y; }
  const xs = poly.map(p=>p.x), ys = poly.map(p=>p.y);
  console.log(`chamber ${k}: pts ${poly.length} shoelace ${(Math.abs(sl)/2).toFixed(0)} mm2 | tris ${tri.length} (need ${poly.length-2}) triArea ${a.toFixed(0)} | bbox x[${Math.min(...xs).toFixed(0)},${Math.max(...xs).toFixed(0)}] y[${Math.min(...ys).toFixed(0)},${Math.max(...ys).toFixed(0)}]`);
}
