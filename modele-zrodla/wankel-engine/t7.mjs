import * as T from './src/lib/trochoid.js';
// replicate the prism's fan triangulation and compare with the shoelace area
function fanArea(raw) {
  const poly = [];
  for (const p of raw) { const l = poly[poly.length-1]; if (l && Math.hypot(p.x-l.x,p.y-l.y) < 0.6) continue; poly.push(p); }
  while (poly.length > 2 && Math.hypot(poly[0].x-poly[poly.length-1].x, poly[0].y-poly[poly.length-1].y) < 0.6) poly.pop();
  let a = 0;
  for (let i = 1; i < poly.length - 1; i++) {
    const A = poly[0], B = poly[i], C = poly[i+1];
    a += Math.abs((B.x-A.x)*(C.y-A.y) - (C.x-A.x)*(B.y-A.y)) / 2;
  }
  return a;
}
let worst = 0;
for (let d = 0; d < 360; d += 3) {
  const th = d*Math.PI/180;
  for (let k = 0; k < 3; k++) {
    const poly = T.chamberPolygon(th, k, 44, 34);
    const sl = T.chamberArea(th, k);
    const fa = fanArea(poly);
    const err = Math.abs(fa - sl) / sl;
    if (err > worst) worst = err;
  }
}
console.log('max fan-vs-shoelace area error over 360 deg:', (worst*100).toFixed(4), '%');
