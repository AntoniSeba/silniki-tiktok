import * as T from './src/lib/trochoid.js';
// 1. apexes must ride the housing
let worst = 0, worstTheta = 0;
for (let i = 0; i < 720; i++) {
  const th = (i / 720) * Math.PI * 2;
  const pose = T.rotorPose(th);
  const cs = T.contactParams(th);
  for (let k = 0; k < 3; k++) {
    const p = T.housingPoint(cs[k]);
    const d = p.distanceTo(pose.apexes[k]);
    if (d > worst) { worst = d; worstTheta = th; }
  }
}
console.log('max apex-to-wall gap:', worst.toFixed(4), 'mm at theta', (worstTheta*180/Math.PI).toFixed(1), 'deg');
// 2. swept volume from the formula vs geometry
console.log('displacement formula:', T.sweptVolume().toFixed(1), 'cm3 (13B is 654)');
// 3. areas over a full 360 crank degrees: sum must be constant, and max-min gives the CR
let sumMin = 1e9, sumMax = 0, vMax = 0, vMin = 1e9;
for (let i = 0; i < 360; i++) {
  const th = (i / 360) * Math.PI * 2;
  const areas = T.chamberAreas(th);
  const s = areas.reduce((a, b) => a + b, 0);
  sumMin = Math.min(sumMin, s); sumMax = Math.max(sumMax, s);
  for (const a of areas) { vMax = Math.max(vMax, a * T.WIDTH / 1000); vMin = Math.min(vMin, a * T.WIDTH / 1000); }
}
console.log('sum of 3 chamber areas: min', sumMin.toFixed(2), 'max', sumMax.toFixed(2), 'mm2 (should be constant)');
console.log('chamber volume max', vMax.toFixed(1), 'cc  min', vMin.toFixed(1), 'cc');
console.log('swept per chamber (max-min):', (vMax - vMin).toFixed(1), 'cc');
console.log('geometric compression ratio:', (vMax / vMin).toFixed(2));
// 4. volumes over one 1080 deg cycle for chamber 0
const samples = [];
for (let d = 0; d <= 1080; d += 30) samples.push(`${d}:${T.chamberVolumes(d*Math.PI/180)[0].toFixed(0)}`);
console.log('chamber0 cc by crank deg:', samples.join(' '));
