import * as THREE from 'three';
import { buildEngine } from './r3/scene.js';
const M = new Proxy({}, { get: (t, k) => (t[k] ||= Object.assign(new THREE.MeshStandardMaterial(), { name: String(k) })) });
const e = buildEngine(M); e.update(100, { explode: 0.5, turboDeg: 30 });
const b = new THREE.Box3().setFromObject(e.root); console.log('scene ok', b.min.toArray().map(Math.round), b.max.toArray().map(Math.round));
