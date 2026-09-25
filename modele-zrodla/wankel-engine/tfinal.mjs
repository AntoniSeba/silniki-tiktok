import * as T from './src/lib/trochoid.js';
let worst = 0;
for (let i = 0; i < 1440; i++) {
  const th = i/1440*2*Math.PI;
  const pose = T.rotorPose(th), cs = T.contactParams(th);
  for (let k = 0; k < 3; k++) worst = Math.max(worst, T.housingPoint(cs[k]).distanceTo(pose.apexes[k]));
}
let vMax=0,vMin=1e9,sMin=1e9,sMax=0;
const curve = [];
for (let i = 0; i < 241; i++) {
  const th = i/240*2*Math.PI;
  const a = T.chamberAreas(th);
  const s = a[0]+a[1]+a[2];
  sMin=Math.min(sMin,s); sMax=Math.max(sMax,s);
  for (const x of a) { const v = x*T.WIDTH/1000; vMax=Math.max(vMax,v); vMin=Math.min(vMin,v); }
  if (i < 120) curve.push((a[0]*T.WIDTH/1000).toFixed(0));
}
console.log('apex gap max:', worst.toFixed(5), 'mm');
console.log('sum of chamber areas: min', sMin.toFixed(1), 'max', sMax.toFixed(1), '(drift', ((sMax-sMin)/sMax*100).toFixed(4), '%)');
console.log('Vmax', vMax.toFixed(1), 'cc   Vmin', vMin.toFixed(1), 'cc   swept', (vMax-vMin).toFixed(1), 'cc   CR', (vMax/vMin).toFixed(2));
console.log('published: swept 654 cc, CR 9.4:1');
console.log('chamber 0 volume over one crank turn (cc, every 3 deg):');
console.log(curve.join(' '));
