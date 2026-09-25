import * as T from './src/lib/trochoid.js';
// find the crank angle where chamber 0 is smallest, then dump its polygon
let best = { v: 1e18, th: 0 };
for (let i = 0; i < 3600; i++) {
  const th = i / 3600 * 2 * Math.PI;
  const v = T.chamberArea(th, 0);
  if (v < best.v) best = { v, th };
}
console.log('min area', best.v.toFixed(0), 'mm2 at theta', (best.th * 180 / Math.PI).toFixed(2), 'deg');
const poly = T.chamberPolygon(best.th, 0, 12, 8);
console.log('polygon points:', poly.length);
console.log(poly.map(p => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' '));
// gap between the rotor flank and the wall: sample the wall and report the nearest rotor distance
const pose = T.rotorPose(best.th);
const cs = T.contactParams(best.th);
console.log('apex world:', pose.apexes.map(a => `(${a.x.toFixed(1)},${a.y.toFixed(1)})`).join(' '));
console.log('contact t:', cs.map(c => (c * 180 / Math.PI).toFixed(1)).join(' '));
console.log('rotor centre', pose.centre.x.toFixed(1), pose.centre.y.toFixed(1), 'spin deg', (pose.spin * 180 / Math.PI).toFixed(1));
