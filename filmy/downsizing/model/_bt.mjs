// build-test.mjs - builds every part module in node (three works headless for
// geometry) with a stub material set, so geometry mistakes surface in a second
// instead of inside a WebGL page. Prints per-group mesh and triangle counts.
import * as THREE from 'three';
import { buildBlock } from './r3/parts/block.js';
import { buildRotating } from './r3/parts/rotating.js';
import { buildHead } from './r3/parts/head.js';
import { buildInduction } from './r3/parts/induction.js';
import { buildTiming } from './r3/parts/timing.js';
import * as E from './r3/lib/engine.js';

const M = new Proxy(
  {},
  {
    get: (t, k) => {
      if (!t[k]) {
        const m = new THREE.MeshStandardMaterial();
        m.name = String(k);
        t[k] = m;
      }
      return t[k];
    },
  }
);

function stats(root) {
  let meshes = 0;
  let tris = 0;
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    tris += g.index ? g.index.count / 3 : (g.attributes?.position?.count || 0) / 3;
  });
  box.setFromObject(root);
  return { meshes, tris: Math.round(tris), min: box.min.toArray().map((v) => Math.round(v)), max: box.max.toArray().map((v) => Math.round(v)) };
}

const built = {};
for (const [name, fn] of [
  ['block', buildBlock],
  ['rotating', buildRotating],
  ['head', buildHead],
  ['induction', buildInduction],
  ['timing', buildTiming],
]) {
  try {
    const r = fn(M);
    built[name] = r;
    console.log(name.padEnd(10), JSON.stringify(stats(r.root)));
  } catch (e) {
    console.log(name.padEnd(10), 'ERROR', e.message, '\n', (e.stack || '').split('\n').slice(1, 4).join('\n'));
    process.exitCode = 1;
  }
}

// exercise the moving parts once
if (built.rotating?.update) {
  for (const a of [0, 90, 180, 270, 360, 540, 719]) {
    built.rotating.update(a, { rpm: 3000 });
  }
  console.log('rotating.update ok, piston 1 pin Y at 0/180/360 deg:', [0, 180, 360].map((a) => E.pistonPinY(a, 1).toFixed(2)).join(' / '));
}
if (built.head?.update) {
  for (const a of [0, 120, 250, 360, 465]) built.head.update(a);
  console.log('head.update ok, valve lifts cyl1 in/ex at 465/250:', E.valveLiftMm(465, 1, 'in').toFixed(2), E.valveLiftMm(250, 1, 'ex').toFixed(2));
}
if (built.induction?.update) {
  for (const rpm of [1000, 3000, 6000]) built.induction.update(rpm, 0.5);
  console.log('induction.update ok');
}
