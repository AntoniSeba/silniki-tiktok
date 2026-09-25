import * as T from './src/lib/trochoid.js';
let worst = 0;
for (let i = 0; i < 360; i++) {
  const th = i/360*2*Math.PI;
  const pose = T.rotorPose(th), cs = T.contactParams(th);
  for (let k = 0; k < 3; k++) worst = Math.max(worst, T.housingPoint(cs[k]).distanceTo(pose.apexes[k]));
}
console.log('max apex gap:', worst.toFixed(4), 'mm');
let sMin=1e9,sMax=0,vMax=0,vMin=1e9;
for (let i = 0; i < 180; i++) {
  const th = i/180*2*Math.PI;
  const a = T.chamberAreas(th);
  const s = a[0]+a[1]+a[2];
  sMin=Math.min(sMin,s); sMax=Math.max(sMax,s);
  for (const x of a) { const v = x*T.WIDTH/1000; vMax=Math.max(vMax,v); vMin=Math.min(vMin,v); }
}
console.log('sum areas min', sMin.toFixed(1), 'max', sMax.toFixed(1));
console.log('Vmax', vMax.toFixed(1), 'Vmin', vMin.toFixed(1), 'swept', (vMax-vMin).toFixed(1), 'CR', (vMax/vMin).toFixed(2));
// rotor outline sanity: max radius must be R, and area
let maxR = 0;
for (const p of T.ROTOR_OUTLINE) maxR = Math.max(maxR, p.length());
let ar = 0;
const o = T.ROTOR_OUTLINE;
for (let i = 0; i < o.length; i++) { const p=o[i], q=o[(i+1)%o.length]; ar += p.x*q.y - q.x*p.y; }
console.log('outline: points', o.length, 'max radius', maxR.toFixed(2), 'area', (Math.abs(ar)/2).toFixed(0), 'mm2');
console.log('housing area:', (T.HOUSING.reduce((acc,p,i)=>{const q=T.HOUSING[(i+1)%T.HOUSING.length];return acc+p.x*q.y-q.x*p.y;},0)/2).toFixed(0));
