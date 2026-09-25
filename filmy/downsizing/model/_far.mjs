import * as THREE from 'three';
import { buildEngine } from './r3/scene.js';
const M = new Proxy({}, { get: (t, k) => (t[k] ||= Object.assign(new THREE.MeshStandardMaterial(), { name: String(k) })) });
const e = buildEngine(M); e.root.updateMatrixWorld(true);
const b = new THREE.Box3();
e.root.traverse((o) => { if (!o.isMesh) return; b.setFromObject(o); if (b.max.x > 200 || b.min.x < -260) console.log(o.name, Math.round(b.min.x), Math.round(b.max.x), o.parent.name); });
