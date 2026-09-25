import * as THREE from 'three';
import * as T from './src/lib/trochoid.js';

// rebuild the module's flank constant by re-deriving: patch approach is easier,
// so recompute the chamber area here with a parametric crown
const R = T.R, E = T.ECC, W = T.WIDTH;
function flankArc(a0, a1, midR) {
  const A = new THREE.Vector2(R*Math.cos(a0), R*Math.sin(a0));
  const B = new THREE.Vector2(R*Math.cos(a1), R*Math.sin(a1));
  const mid = new THREE.Vector2().addVectors(A,B).multiplyScalar(0.5);
  const out = mid.clone().normalize();
  const crown = midR - mid.length();
  const chord = A.distanceTo(B);
  const r = (chord*chord)/(8*crown) + crown/2;
  const c = mid.clone().add(out.clone().multiplyScalar(r - crown));
  const start = Math.atan2(A.y-c.y, A.x-c.x);
  let span = Math.atan2(B.y-c.y, B.x-c.x) - start;
  while (span <= -Math.PI) span += 2*Math.PI;
  while (span > Math.PI) span -= 2*Math.PI;
  return { c, r, start, span };
}
function outline(midR, n = 220) {
  const pts = [];
  for (let k = 0; k < 3; k++) {
    const f = flankArc(k*2*Math.PI/3, (k+1)*2*Math.PI/3, midR);
    for (let i = 0; i <= n; i++) {
      const t = f.start + f.span*i/n;
      pts.push(new THREE.Vector2(f.c.x + f.r*Math.cos(t), f.c.y + f.r*Math.sin(t)));
    }
  }
  return pts;
}
// fastest check of the chamber area: rotate the outline by -theta and translate
function areasFor(midR, theta) {
  const pts = outline(midR);
  const c = new THREE.Vector2(E*Math.cos(theta), E*Math.sin(theta));
  const s = theta/3;
  const world = pts.map(p => new THREE.Vector2(
    c.x + p.x*Math.cos(s) - p.y*Math.sin(s),
    c.y + p.x*Math.sin(s) + p.y*Math.cos(s)));
  // contact params: apex k at angle s + 120k
  const cs = [0,1,2].map(k => {
    const ax = c.x + R*Math.cos(s + k*2*Math.PI/3), ay = c.y + R*Math.sin(s + k*2*Math.PI/3);
    let best = 1e18, bt = 0;
    for (let i = 0; i <= 6000; i++) {
      const t = i/6000*2*Math.PI;
      const p = T.housingPoint(t);
      const d = (p.x-ax)**2 + (p.y-ay)**2;
      if (d < best) { best = d; bt = t; }
    }
    return bt;
  });
  const fnv = h => ((h%1)+1)%1;
  const out = [];
  for (let k = 0; k < 3; k++) {
    const t0 = cs[k];
    let span = fnv((cs[(k+1)%3]-t0)/(2*Math.PI))*2*Math.PI;
    const poly = [];
    for (let i = 0; i <= 40; i++) poly.push(T.housingPoint(t0 + span*i/40));
    // flank points of this sector: rotor-local angle between 120k and 120(k+1)
    const a0 = k*2*Math.PI/3;
    const sel = [];
    for (const p of pts) {
      const la = fnv((Math.atan2(p.y,p.x) - a0)/(2*Math.PI));
      if (la <= 1/3 + 1e-9) {
        sel.push(new THREE.Vector2(c.x + p.x*Math.cos(s) - p.y*Math.sin(s), c.y + p.x*Math.sin(s) + p.y*Math.cos(s)));
      }
    }
    for (let i = sel.length-1; i >= 0; i--) poly.push(sel[i]);
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i+1)%poly.length]; a += p.x*q.y - q.x*p.y; }
    out.push(Math.abs(a)/2);
  }
  return out;
}
let vMax = 0, vMin = 1e9;
for (let i = 0; i < 24; i++) {
  const th = i/24*2*Math.PI;
  for (const a of areasFor(67.5, th)) { const v = a*W/1000; vMax = Math.max(vMax,v); vMin = Math.min(vMin,v); }
}
console.log('crown 15 (midR 67.5):  Vmax ' + vMax.toFixed(0) + ' Vmin ' + vMin.toFixed(0) + ' CR ' + (vMax/vMin).toFixed(2));
for (const midR of [72, 78, 82, 84, 86, 87, 88]) {
  let mx = 0, mn = 1e9;
  for (let i = 0; i < 24; i++) {
    const th = i/24*2*Math.PI;
    for (const a of areasFor(midR, th)) { const v = a*W/1000; mx = Math.max(mx,v); mn = Math.min(mn,v); }
  }
  console.log('midR ' + midR + ' (crown ' + (midR-52.5).toFixed(1) + '): Vmax ' + mx.toFixed(0) + ' Vmin ' + mn.toFixed(0) + ' CR ' + (mx/mn).toFixed(2) + ' swept ' + (mx-mn).toFixed(0));
}
