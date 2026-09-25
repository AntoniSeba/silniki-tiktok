// V8 to najlepszy silnik na świecie. V8 z filmu "V8 kontra V6" (wałki w głowicach) i small block
// Antoniego (projekty/v8-engine: jeden wałek w bloku, popychacze). Bez napisów na środku ekranu.
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/src/lib/materials.js";
import { buildStudioEnvironment } from "../model/src/lib/environment.js";
import { buildEngine as build8 } from "../model/src8/scene.js";
import * as L8 from "../model/src8/lib/layout.js";
import { createMaterials as createMaterialsSB } from "../model/sb/lib/materials.js";
import { buildEngine as buildSB } from "../model/sb/scene.js";

const W = 1080, H = 1920, D = 141.6;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const bump = (t, a, b) => Math.sin(win(t, a, b) * Math.PI);
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const f1 = (v) => v.toFixed(1);
function mono(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { const h = xs[i + 1] - xs[i]; d.push(h > 0 ? (ys[i + 1] - ys[i]) / h : 0); }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t >= xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h <= 0) return ys[i + 1];
    const s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
function crankTrack(segs) {
  const K = [[0, 0]];
  let ca = 0, ct = 0;
  for (const [t1, w] of segs) { ca += w * (t1 - ct); ct = t1; K.push([ct, ca]); }
  const last = segs[segs.length - 1][1];
  K.push([D, Math.ceil((ca + last * (D - ct)) / 720) * 720]);
  return mono(K);
}

/* ================= ujęcia ================= */
const SHOTS = [
  [0, 3.89, "3d", "hook"], [3.89, 4.86, "3d", "count"], [4.86, 7.94, "3d", "promise"], [7.94, 10.6, "3d", "promise2"],
  [10.6, 12.78, "board", "gList"], [12.78, 15.78, "board", "gTruck"], [15.78, 20.03, "board", "gF1"], [20.03, 23.32, "board", "gTach"],
  [23.32, 27.5, "broll"], [27.5, 28.98, "3d", "obsesja"], [28.98, 31.25, "3d", "anatomy"], [31.25, 33.38, "3d", "angle"],
  [33.38, 36.26, "3d", "pin"], [36.26, 38.14, "3d", "pins4"], [38.14, 42.24, "3d", "fire"], [42.24, 44.92, "3d", "fireAngle"],
  [44.92, 47.28, "3d", "pow"], [47.28, 49.72, "3d", "pow2"], [49.72, 54.94, "board", "gOverlap"], [54.94, 58.09, "board", "gCall"],
  [58.09, 61.8, "3d", "cross"], [61.8, 64.93, "3d", "cw"], [64.93, 67.9, "3d", "coin"], [67.9, 70.26, "3d", "capTitle"],
  [70.26, 74.4, "board", "gCap"], [74.4, 78.7, "3d", "bigCyl"], [78.7, 81.28, "board", "gTorque"], [81.28, 84.21, "board", "gQuote"],
  [84.21, 86.78, "3d", "slow"], [86.78, 89.45, "board", "gCops"], [89.45, 92.82, "board", "gOdo"], [92.82, 93.84, "3d", "sound3d"],
  [93.84, 98.46, "board", "gWaves"], [98.46, 101.76, "3d", "honest"], [101.76, 104.16, "board", "gEurope"], [104.16, 107.27, "board", "gRepl"],
  [107.27, 108.48, "3d", "promised"], [108.48, 112.25, "3d", "sb"], [112.25, 117.34, "3d", "splitCam"], [117.34, 120.16, "3d", "sbLow"],
  [120.16, 124.1, "board", "gSize"], [124.1, 128.7, "board", "gSwap"], [128.7, 132.49, "board", "g100m"], [132.49, 135.74, "3d", "vette"],
  [135.74, 137.8, "3d", "pickA"], [137.8, 140.18, "3d", "pickB"], [140.18, D + 1, "3d", "outro"],
];
const shotIdx = (t) => { for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) return i; return SHOTS.length - 1; };
const shotAt = (t) => SHOTS[shotIdx(t)];
const SPLIT = new Set(["splitCam"]);

// wał: stała prędkość w odcinkach, koniec domknięty do wielokrotności 720°
const crank8 = crankTrack([[3.89, 360], [10.6, 140], [28.98, 160], [33.38, 150], [38.14, 70], [44.92, 150], [49.72, 90], [58.09, 160],
  [64.93, 60], [67.9, 45], [74.4, 160], [78.7, 70], [84.21, 120], [86.78, 50], [98.46, 150], [101.76, 150], [107.27, 150],
  [112.25, 150], [117.34, 110], [120.16, 150], [132.49, 150], [135.74, 150], [140.18, 160], [D, 360]]);

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = buildStudioEnvironment(renderer).env;
{
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, "#1c232c"); lin.addColorStop(0.45, "#151b22"); lin.addColorStop(1, "#0a0d11");
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  const rad = g.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.46, 900);
  rad.addColorStop(0, "rgba(120,150,190,0.16)"); rad.addColorStop(1, "rgba(120,150,190,0)");
  g.fillStyle = rad; g.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 90) for (let y = 0; y <= H; y += 90) {
    const dx = (x - W / 2) / (W * 0.72), dy = (y - H * 0.46) / (H * 0.46);
    const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.8) * 0.07;
    g.fillStyle = "rgba(150,165,182," + a.toFixed(3) + ")";
    g.fillRect(x, y - 45, 1, 90); g.fillRect(x - 45, y, 90, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
const key = new THREE.DirectionalLight(0xfffaf2, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 300, far: 7500, left: -1500, right: 1500, top: 1500, bottom: -1500 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.35); scene.add(fill); scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xffffff, 0.7); scene.add(rim); scene.add(rim.target);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.5));
function lightAt(b) {
  key.position.set(b.x + 1400, b.y + 2100, b.z + 1600); key.target.position.copy(b);
  fill.position.set(b.x - 1700, b.y + 800, b.z + 1200); fill.target.position.copy(b);
  rim.position.set(b.x - 600, b.y + 1300, b.z - 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(34, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(34, W / H, 20, 16000);

/* ================= V8 z wałkami w głowicach ================= */
const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a), ICE = new THREE.Color(0x3aa0ff);
function glowMats(obj, col = AMBER) {
  const out = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.emissive = col.clone();
    o.material.emissiveIntensity = 0;
    out.push(o.material);
  });
  return out;
}
const setGlow = (mats, k, col) => mats.forEach((m) => { if (col) m.emissive.copy(col); m.emissiveIntensity = k; });
// zdegenerowane normalne dają NaN w shaderze i czarne plamy po SSAO
function fixNormals(root) {
  root.traverse((o) => {
    const n = o.isMesh && o.geometry.attributes.normal;
    if (!n) return;
    let f = false;
    for (let i = 0; i < n.count; i++) if (Math.abs(n.getX(i)) + Math.abs(n.getY(i)) + Math.abs(n.getZ(i)) < 1e-6) { n.setXYZ(i, 0, 1, 0); f = true; }
    if (f) n.needsUpdate = true;
  });
}

const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const engine = build8(M);
applyMaterialVariation(engine.root, M);
engine.ring.visible = false;
engine.charge.visible = false;
fixNormals(engine.root);
engine.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(engine.root);
const E8 = { engine, root: engine.root, crank: engine.rotating.crank, flywheel: engine.rotating.flywheel };
const crank = E8.crank;
E8.journals = {};
E8.cws = [];
crank.traverse((o) => {
  if (!o.isMesh) return;
  const m = /^Crank_RodJournal_Cyl(\d)$/.exec(o.name);
  if (m) { o.material = M.steel.clone(); o.material.emissive = AMBER.clone(); o.material.emissiveIntensity = 0; E8.journals[m[1]] = { mesh: o, mat: o.material }; }
  const c = /^Crank_Counterweight_(\d)([ab])$/.exec(o.name);
  if (c) { o.material = M.crankSteel.clone(); o.material.emissive = AMBER.clone(); o.material.emissiveIntensity = 0; E8.cws.push({ mesh: o, mat: o.material }); }
});
const cylOf = (id) => engine.rotating.cylinders.find((c) => c.def.id === id);
const pistGlow = L8.CYLINDERS.map((c) => ({ c, mats: glowMats(cylOf(c.id).piston) }));
const rodGlow = L8.CYLINDERS.map((c) => ({ c, mats: glowMats(cylOf(c.id).rod) }));
const ohcCams = ["CAMSHAFT_L", "CAMSHAFT_R"].map((n) => engine.root.getObjectByName(n)).filter(Boolean);
const ohcGlow = ohcCams.flatMap((o) => glowMats(o));
const hdrGlow = ["HEADER_L", "HEADER_R"].map((n) => engine.root.getObjectByName(n)).filter(Boolean).flatMap((o) => glowMats(o));
// błyski zapłonu i gaz suwu pracy
const fireOf = (c) => wrap(c.cycleOffset + 360, 720);
const flashes = L8.CYLINDERS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(52, 24, 16), mat);
  const d = L8.BANK_DIR[c.bank], s = L8.LAYOUT.deckHeight - 24;
  m.position.set(d.x * s, d.y * s, c.z);
  m.scale.set(1, 0.7, 1);
  m.visible = false;
  engine.root.add(m);
  return { c, m, mat };
});
const pows = L8.CYLINDERS.map((c) => {
  const d = L8.BANK_DIR[c.bank];
  const axis = new THREE.Vector3(d.x, d.y, 0).normalize();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 1, 32), mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  m.visible = false;
  engine.root.add(m);
  return { c, m, mat, axis };
});
// jednostki do rozkładania, rozrzucania i chowania osprzętu
engine.root.updateMatrixWorld(true);
const pistonsRoot = engine.rotating.root.getObjectByName("PISTONS_AND_RODS");
const partRoots = new Set([engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root, engine.rotating.root, pistonsRoot]);
const units = [], seen = new Set();
const center = new THREE.Vector3(0, 150, 0);
const addUnit = (o) => {
  if (!o || seen.has(o) || o === pistonsRoot) return;
  seen.add(o);
  const box = new THREE.Box3().setFromObject(o);
  const cw = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const dir = cw.clone().sub(center);
  if (dir.lengthSq() < 1) dir.set(0, 1, 0);
  dir.normalize(); dir.y += 0.25; dir.normalize();
  const qInv = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const i = units.length;
  units.push({
    o, base: o.position.clone(), d: o.userData.explode ? o.userData.explode.clone() : null,
    top: partRoots.has(o.parent) || o === engine.intake.root,
    sdir: dir.applyQuaternion(qInv), smag: 2400 + hash(i) * 1200, kS: hash(i + 17), kE: 0,
    isCrank: o === crank, isFly: o === E8.flywheel,
    core: /^HEADER_|^CAM_COVER_|^TIMING_COVER$/.test(o.name) || o.parent === engine.accessories.root || o === engine.intake.root || o === engine.rotating.timing,
    cover: /^CAM_COVER_/.test(o.name),
    cap: o.name === "MAIN_BEARING_CAPS", y: cw.y,
  });
};
engine.explodeGroups.forEach(addUnit);
[engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root].forEach((r) => r.children.slice().forEach(addUnit));
addUnit(engine.intake.root);
engine.rotating.root.children.slice().forEach((c) => { if (c !== crank && c !== pistonsRoot) addUnit(c); });
pistonsRoot.children.slice().forEach(addUnit);
{
  const ys = units.map((u) => u.y), yMin = Math.min(...ys), yMax = Math.max(...ys);
  units.forEach((u) => { u.kE = 1 - (u.y - yMin) / (yMax - yMin + 1e-6); });
}
const KEEP1 = new Set([cylOf(1).wrap, cylOf(2).wrap]);
const stag = (x, k, spread = 0.55) => easeIO(clamp01(x * (1 + spread) - k * spread));
// moneta na kolektorze: stoi na wolnych obrotach
const coin = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 2.4, 48), new THREE.MeshStandardMaterial({ color: 0xd9b35c, metalness: 1, roughness: 0.26, envMapIntensity: 1.6 }));
coin.castShadow = true;
coin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(0.3), 0, Math.sin(0.3)));
{
  const plen = engine.intake.root.getObjectByName("IntakePlenum");
  const b = new THREE.Box3().setFromObject(plen || engine.intake.root);
  coin.position.set(0, b.max.y + 12, 30);
  engine.intake.root.add(coin);
  engine.intake.root.worldToLocal(coin.position);
}
coin.visible = false;
const COIN_Y = (() => { engine.root.updateMatrixWorld(true); return coin.getWorldPosition(new THREE.Vector3()).y; })();

/* ================= small block z popychaczami ================= */
const SBP = new THREE.Vector3(0, -80000, 0);
const MS = createMaterialsSB();
const SB = buildSB(MS);
fixNormals(SB.root);
SB.root.position.copy(SBP);
SB.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(SB.root);
const sbCam = SB.rotating.cam;
const sbCamGlow = glowMats(sbCam);
const sbRodsGlow = ["PUSHRODS", "LIFTERS"].map((n) => SB.root.getObjectByName(n)).filter(Boolean).flatMap((o) => glowMats(o));
const sbRockers = [];
SB.heads.root.traverse((o) => { if (o.isMesh && /^Rocker(Arm|Cup)_/.test(o.name)) sbRockers.push(o); });
const sbRockGlow = sbRockers.flatMap((o) => glowMats(o));
const sbCovers = ["VALVE_COVER_L", "VALVE_COVER_R"].map((n) => SB.root.getObjectByName(n)).filter(Boolean);
const sbHeadGlow = [];
const sbBase = SB.explodeGroups.map((g) => g.position.clone());
const castMats = [MS.castIron, MS.castAluminium, MS.castAluminiumBright].filter(Boolean);
castMats.forEach((m) => { m.userData.op = m.opacity; });

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260925;
  const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const orig = Math.random;
  Math.random = seeded;
  ssaoPass = new SSAOPass(scene, camera, W, H);
  Math.random = orig;
  Object.assign(ssaoPass, { kernelRadius: 190, minDistance: 40, maxDistance: 1400 });
  composer.addPass(ssaoPass);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.7, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.3 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv - 0.5) * vec2(1.0, 0.8); float v = smoothstep(0.95, 0.25, length(p) * 1.35); c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }",
}));
composer.setSize(W, H);
function usePassCam(cam) {
  renderPass.camera = cam;
  ssaoPass.camera = cam;
  ssaoPass.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);
  ssaoPass.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);
}

/* ================= kamera ================= */
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const Ps = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x: SBP.x + x, y: SBP.y + y, z: SBP.z + z, fov, oy });
const FRONT = Math.PI / 2;
const C1 = L8.CYLINDERS.find((c) => c.id === 1);
const C1X = L8.BANK_DIR[C1.bank].x * 150, C1Y = L8.BANK_DIR[C1.bank].y * 150;
const P0 = P(0.95, 0.2, 3500, 0, 110, 0, 34, -110);
const CAM = {
  hook: [[0, P0], [1.6, P(0.8, 0.17, 3000, 0, 110, 0, 34, -110)], [3.89, P(0.55, 0.14, 2800, 0, 110, 0, 34, -110)]],
  count: [[3.89, P(FRONT - 0.45, 0.22, 2700, 0, 110, 0, 34, 40)], [4.86, P(FRONT - 0.3, 0.18, 2550, 0, 110, 0, 34, 40)]],
  promise: [[4.86, P(1.25, 0.34, 4300, 0, 150, 0, 34, 80)], [7.94, P(0.8, 0.28, 4000, 0, 150, 0, 34, 80)]],
  promise2: [[7.94, P(-0.9, 0.3, 4300, 0, 150, 0, 34, 80)], [10.6, P(-1.3, 0.24, 4000, 0, 150, 0, 34, 80)]],
  obsesja: [[27.5, P(2.2, 0.12, 2800, 0, 120, 0, 34, 60)], [28.98, P(2.45, 0.1, 2600, 0, 120, 0, 34, 60)]],
  anatomy: [[28.98, P(0.55, 0.45, 2700, 0, 110, 0, 34, 60)], [31.25, P(0.78, 0.4, 2550, 0, 110, 0, 34, 60)]],
  angle: [[31.25, P(FRONT + 0.12, 0.05, 2500, 0, 120, 0, 34, 60)], [33.38, P(FRONT + 0.03, 0.04, 2350, 0, 120, 0, 34, 60)]],
  pin: [[33.38, P(0.55, 0.16, 1300, 0, 110, 110, 36, 40)], [36.26, P(0.9, 0.22, 1150, 0, 110, 110, 36, 40)]],
  pins4: [[36.26, P(0.3, 0.3, 2000, 0, 60, 0, 34, 60)], [38.14, P(0.6, 0.22, 1850, 0, 60, 0, 34, 60)]],
  fire: [[38.14, P(-0.4, 0.64, 2800, 0, 110, 0, 34, 170)], [42.24, P(-0.14, 0.58, 2600, 0, 110, 0, 34, 170)]],
  fireAngle: [[42.24, P(FRONT - 0.1, 0.12, 2450, 0, 130, 0, 34, 170)], [44.92, P(FRONT - 0.02, 0.08, 2300, 0, 130, 0, 34, 170)]],
  pow: [[44.92, P(0.4, 0.45, 2650, 0, 130, 0, 34, 120)], [47.28, P(0.6, 0.4, 2500, 0, 130, 0, 34, 120)]],
  pow2: [[47.28, P(-0.5, 0.5, 2600, 0, 130, 0, 34, 120)], [49.72, P(-0.3, 0.45, 2450, 0, 130, 0, 34, 120)]],
  cross: [[58.09, P(FRONT - 0.55, 0.28, 1950, 0, 80, 0, 36, 60)], [59.4, P(FRONT - 0.04, 0.02, 1300, 0, 0, 0, 30, -40)], [61.8, P(FRONT, 0.0, 1200, 0, 0, 0, 30, -40)]],
  cw: [[61.8, P(0.8, 0.4, 1550, 0, 0, 0, 34, 60)], [64.93, P(0.5, 0.26, 1400, 0, 0, 0, 34, 60)]],
  coin: [[64.93, P(1.05, 0.5, 1000, 0, COIN_Y, 30, 30, 60)], [67.9, P(0.85, 0.42, 820, 0, COIN_Y, 30, 30, 60)]],
  capTitle: [[67.9, P(2.4, 0.25, 3100, 0, 120, 0, 34, 80)], [70.26, P(2.1, 0.2, 2900, 0, 120, 0, 34, 80)]],
  bigCyl: [[74.4, P(0.25, 0.3, 950, C1X, C1Y, C1.z, 34, 40)], [78.7, P(0.45, 0.22, 820, C1X, C1Y, C1.z, 34, 40)]],
  slow: [[84.21, P(-2.3, 0.16, 3100, 0, 120, 0, 34, 80)], [86.78, P(-2.0, 0.12, 2900, 0, 120, 0, 34, 80)]],
  sound3d: [[92.82, P(-0.2, 0.08, 1500, 250, 60, 0, 34, 60)], [93.84, P(-0.05, 0.06, 1350, 250, 60, 0, 34, 60)]],
  honest: [[98.46, P(2.8, 0.22, 3200, 0, 120, 0, 34, 80)], [101.76, P(2.5, 0.18, 3000, 0, 120, 0, 34, 80)]],
  promised: [[107.27, P(0.95, 0.32, 3600, 0, 130, 0, 34, 80)], [108.48, P(0.75, 0.26, 3400, 0, 130, 0, 34, 80)]],
  sb: [[108.48, Ps(0.9, 0.28, 2800, 0, 150, 0, 34, 60)], [112.25, Ps(0.6, 0.2, 2550, 0, 150, 0, 34, 60)]],
  splitCamA: [[112.25, P(0.6, 0.4, 3100, 0, 230, 0, 34, 400)], [117.34, P(0.85, 0.34, 2900, 0, 230, 0, 34, 400)]],
  splitCamB: [[112.25, Ps(0.6, 0.45, 2700, 0, 200, 0, 34, -300)], [117.34, Ps(0.85, 0.38, 2550, 0, 200, 0, 34, -300)]],
  sbLow: [[117.34, Ps(0.08, 0.02, 2700, 0, 150, 0, 34, 60)], [120.16, Ps(0.2, 0.04, 2550, 0, 150, 0, 34, 60)]],
  vette: [[132.49, Ps(-0.9, 0.3, 2700, 0, 150, 0, 34, 260)], [135.74, Ps(-1.2, 0.25, 2550, 0, 150, 0, 34, 260)]],
  pickA: [[135.74, Ps(0.9, 0.22, 2800, 0, 150, 0, 34, 280)], [137.8, Ps(0.7, 0.18, 2650, 0, 150, 0, 34, 280)]],
  pickB: [[137.8, P(-0.9, 0.22, 3300, 0, 120, 0, 34, 280)], [140.18, P(-1.15, 0.18, 3100, 0, 120, 0, 34, 280)]],
  outro: [[140.18, P(1.3, 0.26, 4000, 0, 110, 0, 34, -110)], [D, P0], [D + 1, P(0.8, 0.17, 3000, 0, 110, 0, 34, -110)]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  const si = shotIdx(t);
  if (si > 0 && si < SHOTS.length - 1) {
    // każde cięcie wchodzi płynnym dojazdem
    const cut = 1 - easeIO(win(t, SHOTS[si][0], SHOTS[si][0] + 1.1));
    v.r *= 1 + 0.12 * cut;
    v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.07 * cut;
  }
  const jit = clamp01(t / 1.0) * clamp01((D - t) / 1.0);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * (1 + jit * 0.004 * Math.sin(t * 0.9));
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silników ================= */
const blank = () => ({ e: 0, s: 0, g: 0, core: 0, fly: 0, keep: null, pin: 0, pinOnly: -1, pinCol: AMBER, cw: 0, rod: 0, fire: 0, pow: 0, coin: false, hum: 0, bank: { L: 0, R: 0 }, one: 0, cams: 0, covers: 0, hdr: 0, sbE: 0, sbCam: 0, sbRods: 0, sbGhost: 0, sbCovers: 0, sbHead: 0 });
const hookE = (t) => 0.62 * (1 - easeOut(win(t, 0, 1.6)));
function states(t, name, panel) {
  const s = blank();
  let base = new THREE.Vector3();
  switch (name) {
    case "hook": s.e = hookE(t); s.fire = 1; break;
    case "outro": s.e = 0.62 * easeIO(win(t, 140.18, D)); s.fire = 1; break;
    case "count": s.g = 1; s.fire = 1; s.core = 1; break;
    case "promise": case "promise2": s.e = 1; break;
    case "obsesja": s.hdr = 0.35 * bump(t, 27.6, 28.9); break;
    case "anatomy": s.g = 1; s.core = 1; s.bank.R = 1.1 * easeOut(win(t, 30.28, 30.6)); s.bank.L = 1.1 * easeOut(win(t, 30.8, 31.1)); break;
    case "angle": s.g = 1; s.core = 1; s.bank.R = 0.6; s.bank.L = 0.6; break;
    case "pin": s.g = 1; s.s = 1; s.keep = KEEP1; s.pinOnly = 0; s.rod = easeOut(win(t, 35.15, 35.5)); s.pin = easeOut(win(t, 33.46, 33.8)); break;
    case "pins4": s.g = 1; s.s = 1; s.pin = 1; s.pinCol = AMBER; break;
    case "fire": s.g = 1; s.core = 1; s.fire = 1; break;
    case "fireAngle": s.g = 1; s.core = 1; s.fire = 1; s.bank.R = 0.4; s.bank.L = 0.4; break;
    case "pow": case "pow2": s.g = 1; s.core = 1; s.pow = 1; s.fire = 1; break;
    case "cross": s.g = 1; s.s = easeIO(win(t, 58.2, 59.3)); s.pin = easeOut(win(t, 60.6, 61.0)); break;
    case "cw": s.g = 1; s.s = 1; s.cw = 0.5 * easeOut(win(t, 61.87, 62.3)); break;
    case "coin": s.coin = true; s.hum = 1; break;
    case "capTitle": break;
    case "bigCyl": s.g = 1; s.core = 1; s.one = 1; s.pow = 1; break;
    case "slow": break;
    case "sound3d": s.hdr = 0.6 * easeOut(win(t, 92.9, 93.3)); s.fire = 1; break;
    case "honest": s.hdr = 0.2; break;
    case "promised": break;
    case "sb": base = SBP; s.sbHead = 0; break;
    case "splitCam":
      if (panel === "A") { s.covers = 1; s.cams = 1.4 * easeOut(win(t, 112.67, 113.1)); }
      else { base = SBP; s.sbCovers = 1; s.sbGhost = 1; s.sbCam = 1.6 * easeOut(win(t, 114.29, 114.7)); s.sbRods = 1.4 * easeOut(win(t, 116.29, 116.7)); }
      break;
    case "sbLow": base = SBP; s.sbHead = 0.12 * easeOut(win(t, 117.34, 117.8)); break;
    case "vette": base = SBP; s.sbCovers = 1; s.sbGhost = 1; s.sbCam = 1.0; s.sbRods = 0.8; break;
    case "pickA": base = SBP; s.sbCam = 0.8 * easeOut(win(t, 136.58, 136.9)); s.sbCovers = 1; s.sbGhost = 1; break;
    case "pickB": s.covers = 1; s.cams = 1.2 * easeOut(win(t, 137.8, 138.2)); break;
  }
  return { s, base };
}

const _p = new THREE.Vector3();
function pose8(st, deg, t) {
  engine.updateCrank(deg);
  for (const u of units) {
    _p.copy(u.base);
    let vis = true;
    if (u.d && st.e > 0) _p.addScaledVector(u.d, stag(st.e, u.kE) * (u.cap ? 2.2 : 1));
    if (u.top && !u.isCrank && st.s > 0 && !(st.keep && st.keep.has(u.o))) {
      const k = stag(st.s, u.kS, 0.6);
      _p.addScaledVector(u.sdir, k * u.smag);
      if (k > 0.985) vis = false;
    }
    if (u.isFly && (st.s > 0 || st.fly > 0)) { const k = Math.max(stag(st.s, u.kS, 0.6), st.fly); _p.z -= k * 2600; if (k > 0.985) vis = false; }
    if (st.core && u.core) vis = false;
    if (st.covers && u.cover) vis = false;
    u.o.position.copy(_p);
    u.o.visible = vis;
  }
  setCasingGhost(M, st.g);
  M.coverPlastic.opacity *= 1 - 0.9 * st.g;
  M.plastic.opacity *= 1 - 0.75 * st.g;
  L8.CYLINDERS.forEach((c) => {
    const j = E8.journals[String(c.id)];
    if (!j) return;
    const p = L8.Z_SLOTS.indexOf(c.z);
    j.mat.emissive.copy(st.pinCol);
    j.mat.emissiveIntensity = st.pinOnly < 0 || st.pinOnly === p ? st.pin * 1.6 : 0;
  });
  E8.cws.forEach((c) => { c.mat.emissiveIntensity = st.cw; });
  pistGlow.forEach(({ c, mats }) => setGlow(mats, st.bank[c.bank] + (st.one && c.id === 1 ? 0.8 : 0), c.bank === "R" ? AMBER : ICE));
  rodGlow.forEach(({ c, mats }) => setGlow(mats, (c.id <= 2 ? st.rod * 1.3 : 0) + st.bank[c.bank] * 0.6, c.bank === "R" ? AMBER : ICE));
  setGlow(ohcGlow, st.cams, AMBER);
  setGlow(hdrGlow, st.hdr, RED);
  coin.visible = st.coin;
  const cm = wrap(deg, 720);
  flashes.forEach((f) => {
    let k = 0;
    if (st.fire && (!st.one || f.c.id === 1)) { const x = wrap(cm - fireOf(f.c), 720); k = x < 90 ? Math.pow(1 - x / 90, 1.6) : 0; }
    f.m.visible = k > 0.01;
    f.mat.opacity = k;
    f.mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    f.m.scale.set(0.7 + 0.5 * k, 0.5 + 0.4 * k, 0.7 + 0.5 * k);
  });
  let n = 0;
  pows.forEach((g) => {
    const ph = L8.cycleAngle(g.c, deg);
    const on = !!st.pow && ph >= 360 && ph < 540 && (!st.one || g.c.id === 1);
    g.m.visible = on;
    if (!on) return;
    n++;
    const { s } = L8.pistonPinDistance(g.c, deg);
    const crown = s + L8.LAYOUT.pistonHeight / 2 - 2;
    const len = Math.max(2, L8.LAYOUT.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.copy(g.axis).multiplyScalar(crown + len / 2);
    g.m.position.z = g.c.z;
    const f = (ph - 360) / 180;
    g.mat.opacity = 0.85 - 0.45 * f;
    g.mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
  });
  E8.powCount = n;
  engine.root.position.set(0, st.hum * 0.25 * Math.sin(t * 91), 0);
  engine.root.updateMatrixWorld(true);
}
function poseSB(st, deg) {
  SB.setCrankAngle(deg);
  sbCam.rotation.z = -deg * 0.5 * D2R;
  SB.explodeGroups.forEach((g, i) => { g.position.copy(sbBase[i]).addScaledVector(g.userData.explode, st.sbE); });
  sbCovers.forEach((o) => { o.visible = !st.sbCovers; });
  const intake = SB.intake.root;
  intake.visible = !st.sbCovers;
  castMats.forEach((m) => { m.transparent = st.sbGhost > 0; m.opacity = st.sbGhost > 0 ? 0.28 : m.userData.op; m.depthWrite = !(st.sbGhost > 0); });
  setGlow(sbCamGlow, st.sbCam, AMBER);
  setGlow(sbRodsGlow, st.sbRods, AMBER);
  setGlow(sbRockGlow, st.sbRods * 0.8, AMBER);
  setGlow(sbHeadGlow, st.sbHead, GREEN);
  SB.root.updateMatrixWorld(true);
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
let projCam = camera;
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
function localPoint(frame, x, y, z) { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur * 1.6));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px)";
  return k;
};
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const dash = (el, k, L = 1600) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
const worldOf = (obj, local) => { const v = local ? local.clone() : new THREE.Vector3(); return obj.localToWorld(v); };
const centerLocal = (obj) => { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); return obj.worldToLocal(b.getCenter(new THREE.Vector3())); };

// etykiety
const anc = { rod1: centerLocal(cylOf(1).rod), rod2: centerLocal(cylOf(2).rod), cw: centerLocal(crank.getObjectByName("Crank_Counterweight_2a") || crank), sbCam: centerLocal(sbCam) };
const pin1W = () => worldOf(crank, E8.journals["1"].mesh.position.clone().setZ(162));
const sbPush = SB.root.getObjectByName("PUSHRODS");
const anc2 = { push: centerLocal(sbPush) };
const TAGS = [
  { t0: 33.46, t1: 36.26, text: "Jeden czop", a: pin1W, off: [-40, 240], c: "oil" },
  { t0: 35.15, t1: 36.26, text: "Dwa korbowody", a: () => worldOf(cylOf(1).rod, anc.rod1), off: [-230, -40], c: "oil" },
  { t0: 61.87, t1: 64.93, text: "Przeciwwagi", a: () => worldOf(crank.getObjectByName("Crank_Counterweight_2a") || crank, anc.cw), off: [-150, -260], c: "oil" },
  { t0: 113.0, t1: 117.34, text: "Wałki w głowicach", a: () => worldOf(ohcCams[0] || engine.root, ohcCams[0] ? centerLocal(ohcCams[0]) : null), off: [-60, -250], c: "oil" },
  { t0: 114.29, t1: 117.34, text: "Jeden wałek", a: () => worldOf(sbCam, anc.sbCam), off: [-60, 420], c: "oil", cam: "B" },
  { t0: 116.29, t1: 117.34, text: "Popychacze", a: () => worldOf(sbPush, anc2.push), off: [220, 300], c: "oil", cam: "B" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = { hot: "#e2492b", ok: "#86dba1", ice: "#7cc4ff" }[tg.c] || "#f5aa3c";
  tg.line = mkEl("path", { fill: "none", stroke: col, "stroke-width": 2.5 }, $("tagLines"));
  tg.dot = mkEl("circle", { r: 7, fill: col }, $("tagLines"));
});
function drawTags(t) {
  const sh = shotAt(t);
  for (const tg of TAGS) {
    const on = inR(t, tg.t0, tg.t1 + 0.18) && sh === shotAt(tg.t0);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    projCam = tg.cam === "B" ? cameraB : camera;
    const p = project(tg.a());
    projCam = camera;
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(190, Math.min(y > 1000 ? 700 : 880, x));
    y = Math.max(tg.cam === "B" ? 1080 : 560, Math.min(1400, y));
    if (!tg.cam && SPLIT.has(sh[3])) y = Math.min(y, 800);
    place(tg.el, x, y);
    tg.el.style.opacity = ap;
    tg.line.setAttribute("d", `M ${f1(x)} ${f1(y)} L ${f1(p.x)} ${f1(p.y)}`);
    const len = Math.hypot(p.x - x, p.y - y);
    tg.line.style.strokeDasharray = len;
    tg.line.style.strokeDashoffset = len * (1 - ap);
    tg.line.setAttribute("opacity", 0.9);
    tg.dot.setAttribute("cx", p.x); tg.dot.setAttribute("cy", p.y);
    tg.dot.setAttribute("opacity", clamp01((ap - 0.6) / 0.4));
  }
}
// numery cylindrów
const badges = L8.CYLINDERS.map((c) => { const el = document.createElement("div"); el.className = "badge"; el.textContent = String(c.id); $("badges").appendChild(el); return { el, c }; });
// krzyż z przodu wału
const PINS8 = L8.Z_SLOTS.map((z) => ({ z, J: L8.CYLINDERS.find((c) => c.z === z).journalAngle }));
const crossArms = PINS8.map((pn, p) => {
  const ln = mkEl("path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, $("cross"));
  const c = mkEl("circle", { r: 26, fill: "rgba(10,14,19,0.92)", stroke: "#f5aa3c", "stroke-width": 4 }, $("cross"));
  const tx = mkEl("text", { "text-anchor": "middle", "dominant-baseline": "central", style: "font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;fill:#eef2f7" }, $("cross"));
  tx.textContent = String(p + 1);
  return { ln, c, tx };
});
const crossHub = mkEl("circle", { r: 16, fill: "#f5aa3c" }, $("cross"));
function drawCross(t, on, drawAt) {
  $("cross").setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  const hub = localPoint(crank, 0, 0, 0);
  crossHub.setAttribute("cx", f1(hub.x)); crossHub.setAttribute("cy", f1(hub.y));
  crossArms.forEach((arm, p) => {
    const k = easeOut(win(t, drawAt + p * 0.16, drawAt + p * 0.16 + 0.5));
    const a = PINS8[p].J * D2R;
    const e = localPoint(crank, Math.cos(a) * 118 * k, Math.sin(a) * 118 * k, 0);
    arm.ln.setAttribute("d", `M ${f1(hub.x)} ${f1(hub.y)} L ${f1(e.x)} ${f1(e.y)}`);
    arm.ln.setAttribute("opacity", k > 0.01 ? 1 : 0);
    const lab = localPoint(crank, Math.cos(a) * 150, Math.sin(a) * 150, 0);
    const lk = clamp01((k - 0.7) / 0.3);
    arm.c.setAttribute("cx", f1(lab.x)); arm.c.setAttribute("cy", f1(lab.y));
    arm.tx.setAttribute("x", f1(lab.x)); arm.tx.setAttribute("y", f1(lab.y));
    arm.c.setAttribute("opacity", lk); arm.tx.setAttribute("opacity", lk);
  });
}
// tarcza zapłonu: 8 znaczników w cyklu 720°
const dialTicks = L8.CYLINDERS.map(() => mkEl("circle", { r: 11 }, $("dialTicks")));
function drawDial(t, on, deg, k0) {
  $("dial").setAttribute("opacity", on ? k0 : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", f1(200 + Math.cos(rad) * 92));
  $("dialP").setAttribute("y2", f1(1290 + Math.sin(rad) * 92));
  dialTicks.forEach((e, i) => {
    const fa = fireOf(L8.CYLINDERS[i]);
    const r2 = (fa / 2 - 90) * D2R;
    e.setAttribute("cx", f1(200 + Math.cos(r2) * 80));
    e.setAttribute("cy", f1(1290 + Math.sin(r2) * 80));
    const x = wrap(cm - fa, 720), k = x < 80 ? 1 - x / 80 : 0;
    e.setAttribute("r", f1(10 + 7 * k));
    e.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
  });
}

/* ================= górny blok ================= */
const TOPS = [
  [3.95, "Zaraz to", "<em>Policzymy</em>"],
  [4.9, "Na końcu zobaczysz", "Silnik z lat 50. w <em>100 mln sztuk</em>"],
  [27.55, "Więc skąd", "Ta <em>obsesja</em>?"],
  [29.0, "Budowa", "<em>8</em> cylindrów"],
  [30.1, "Budowa", "<em>2 rzędy</em> po 4"],
  [31.3, "Rozchylone o", "<em>90°</em>"],
  [33.4, "Budowa", "<em>1</em> wał"],
  [35.15, "Na każdym czopie", "<em>2</em> korbowody"],
  [36.3, "Budowa", "<em>4</em> czopy, <em>8</em> tłoków"],
  [38.2, "Powód 1", "<em>8</em> zapłonów na 2 obroty"],
  [40.2, "Powód 1", "Zapłon co <em>90°</em>"],
  [42.26, "Dokładnie tyle", "Ile kąt <em>między rzędami</em>"],
  [44.95, "Suw pracy", "Trwa <em>180°</em>"],
  [47.3, "Cały czas", "Pchają <em>dwa tłoki</em>"],
  [58.1, "Powód 2", "Wał wygląda <em>jak krzyż</em>"],
  [61.85, "Ciężkie przeciwwagi", "Zjadają <em>kołysanie</em>"],
  [64.95, "Na wolnych obrotach", "Tylko <em>mruczy</em>"],
  [67.92, "Powód 3", "Najprostszy"],
  [74.42, "Każdy cylinder", "Jest <em>wielki</em>"],
  [75.85, "Więc silnik", "Nie musi <em>się kręcić</em>"],
  [84.25, "Kręci się wolno", "Więc się <span class=\"ok\">nie męczy</span>"],
  [92.85, "I ten", "<em>Dźwięk</em>"],
  [98.5, "Uczciwie", "Ma <span class=\"hot\">wady</span>"],
  [107.3, "A teraz", "<em>Obiecane</em>"],
  [108.55, "Chevrolet · 1955", "<em>Small block</em>"],
  [117.36, "Small block", "Mały, <em>prosty, tani</em>"],
  [132.5, "Ten sam pomysł", "Siedzi w Corvecie <em>do dziś</em>"],
];
const TOP_OFF = [[0, 3.89], [10.6, 27.5], [49.72, 58.09], [70.26, 74.4], [78.7, 84.21], [86.78, 92.82], [93.84, 98.46], [101.76, 107.27], [112.25, 117.34], [120.16, 132.49], [135.74, D + 1]];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  const off = TOP_OFF.some(([a, b]) => inR(t, a, b));
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.4));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const rowsOf = (id) => [...$(id).querySelectorAll(".rw")].map((el) => ({ el, t: +el.dataset.t, st: +(el.dataset.st || 0), stEl: el.querySelector(".st") }));
const R_LIST = rowsOf("gList"), R_REPL = rowsOf("gRepl"), R_SWAP = rowsOf("gSwap");
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.3)); r.stEl.style.opacity = k; r.stEl.style.transform = "translateX(" + ((1 - k) * 20).toFixed(1) + "px)"; }
  });
}
// pickup z przyczepą
{
  const g = $("truckG");
  mkEl("rect", { x: 0, y: 1250, width: 1080, height: 150, fill: "#1b2027" }, g);
  for (let i = 0; i < 8; i++) mkEl("rect", { "data-lane": i, y: 1320, width: 90, height: 12, fill: "#eef2f7" }, g);
  const tr = mkEl("g", { id: "truck" }, g);
  mkEl("path", { d: "M 420 1230 L 420 1130 Q 424 1100 460 1096 L 520 1040 Q 540 1025 580 1025 L 680 1025 L 690 1110 L 820 1110 Q 840 1112 840 1140 L 840 1230 Z", fill: "rgba(150,165,182,0.16)", stroke: "#b6c1cf", "stroke-width": 5 }, tr);
  mkEl("circle", { cx: 490, cy: 1245, r: 42, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, tr);
  mkEl("circle", { cx: 770, cy: 1245, r: 42, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, tr);
  mkEl("rect", { x: 440, y: 1070, width: 90, height: 50, rx: 8, fill: "rgba(245,170,60,0.3)", stroke: "#f5aa3c", "stroke-width": 3 }, tr);
  const v8t = mkEl("text", { x: 485, y: 1104, "text-anchor": "middle", style: "font-size:28px;font-weight:600;fill:#f5aa3c" }, tr); v8t.textContent = "V8";
  const trl = mkEl("g", { id: "trailer" }, g);
  mkEl("rect", { x: 70, y: 1050, width: 300, height: 170, rx: 10, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 5 }, trl);
  mkEl("path", { d: "M 370 1200 L 420 1200", stroke: "#b6c1cf", "stroke-width": 6 }, trl);
  mkEl("circle", { cx: 220, cy: 1245, r: 38, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, trl);
  const tt = mkEl("text", { x: 90, y: 600, style: "font-size:34px" }, g); tt.textContent = "PRZEZ CAŁĄ AMERYKĘ";
}
// obrotomierz F1
{
  const g = $("tachG");
  const cx = 470, cy = 1180, r = 260;
  for (let i = 0; i <= 18; i += 2) {
    const a = (-210 + 240 * (i / 18)) * D2R;
    mkEl("line", { x1: f1(cx + Math.cos(a) * (r - 30)), y1: f1(cy + Math.sin(a) * (r - 30)), x2: f1(cx + Math.cos(a) * r), y2: f1(cy + Math.sin(a) * r), stroke: i >= 16 ? "#ff6a4d" : "rgba(238,242,247,0.7)", "stroke-width": 5 }, g);
    const tx = mkEl("text", { x: f1(cx + Math.cos(a) * (r - 70)), y: f1(cy + Math.sin(a) * (r - 70) + 10), "text-anchor": "middle", style: "font-size:30px" }, g); tx.textContent = String(i);
  }
  mkEl("path", { id: "tachArc", fill: "none", stroke: "#ff6a4d", "stroke-width": 16, "stroke-linecap": "round" }, g);
  mkEl("line", { id: "tachNd", x1: cx, y1: cy, x2: cx, y2: cy - r + 40, stroke: "#eef2f7", "stroke-width": 7, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx, cy, r: 16, fill: "#eef2f7" }, g);
  const t2 = mkEl("text", { x: cx, y: cy + 90, "text-anchor": "middle", style: "font-size:30px" }, g); t2.textContent = "X 1000 OBR/MIN";
}
const tachArcD = (a1) => { const cx = 470, cy = 1180, r = 285, a0 = -210; const p0 = [cx + Math.cos(a0 * D2R) * r, cy + Math.sin(a0 * D2R) * r], p1 = [cx + Math.cos(a1 * D2R) * r, cy + Math.sin(a1 * D2R) * r]; return `M ${f1(p0[0])} ${f1(p0[1])} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}`; };
// kto pcha: suwy pracy V8, V6, R4 na osi 720°
const OVX = (d) => 90 + (d / 720) * 760;
const OV_ROWS = [
  { lab: "V8", n: 8, step: 90, y: 560, col: "#f5aa3c", at: 49.8 },
  { lab: "V6", n: 6, step: 120, y: 820, col: "#b6c1cf", at: 50.6 },
  { lab: "R4", n: 4, step: 180, y: 1080, col: "#b6c1cf", at: 52.86, eff: 150 },
];
{
  const g = $("ovG");
  OV_ROWS.forEach((row) => {
    const grp = mkEl("g", { "data-row": row.lab }, g);
    const tt = mkEl("text", { x: 90, y: row.y - 20, style: `font-size:40px;font-weight:600;fill:${row.col}` }, grp); tt.textContent = row.lab;
    row.cnt = mkEl("text", { x: 850, y: row.y - 20, "text-anchor": "end", style: "font-size:30px;fill:#eef2f7" }, grp);
    mkEl("line", { x1: 90, y1: row.y + 150, x2: 850, y2: row.y + 150, stroke: "rgba(150,165,182,0.35)", "stroke-width": 2 }, grp);
    const len = row.eff || 180;
    for (let i = 0; i < row.n; i++) {
      const lane = i % 2;
      for (const off of [0, 720]) {
        const s = i * row.step - off;
        const x0 = Math.max(90, OVX(s)), x1 = Math.min(850, OVX(s + len));
        if (x1 <= x0) continue;
        mkEl("rect", { x: f1(x0), y: row.y + 10 + lane * 66, width: f1(x1 - x0), height: 56, rx: 8, fill: row.col, opacity: 0.85 }, grp);
      }
    }
    row.grp = grp;
    if (row.eff) {
      for (let i = 0; i < row.n; i++) {
        const x0 = OVX(i * row.step + row.eff), x1 = OVX((i + 1) * row.step);
        mkEl("rect", { "data-gap": 1, x: f1(x0), y: row.y + 10, width: f1(x1 - x0), height: 122, fill: "rgba(226,73,43,0.55)", opacity: 0 }, grp);
      }
    }
  });
  mkEl("line", { id: "ovCur", y1: 540, y2: 1250, stroke: "#eef2f7", "stroke-width": 4 }, g);
}
// litry i cylindry
{
  const g = $("capG");
  for (let i = 0; i < 4; i++) mkEl("rect", { "data-cyl": i, x: 520 + (i % 2) * 150, y: 600 + Math.floor(i / 2) * 230, width: 120, height: 200, rx: 14, fill: "rgba(245,170,60,0.16)", stroke: "#f5aa3c", "stroke-width": 4 }, g);
}
// radiowóz i taksówka
{
  const g = $("copsG");
  const car = (x, y, col, lab, id) => {
    const c = mkEl("g", { id }, g);
    mkEl("path", { d: `M ${x} ${y + 120} L ${x} ${y + 60} Q ${x + 6} ${y + 36} ${x + 50} ${y + 30} L ${x + 120} ${y} L ${x + 290} ${y} L ${x + 350} ${y + 30} Q ${x + 380} ${y + 40} ${x + 380} ${y + 70} L ${x + 380} ${y + 120} Z`, fill: col, stroke: "#b6c1cf", "stroke-width": 4 }, c);
    mkEl("circle", { cx: x + 80, cy: y + 125, r: 32, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, c);
    mkEl("circle", { cx: x + 300, cy: y + 125, r: 32, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, c);
    const tx = mkEl("text", { x: x + 190, y: y + 200, "text-anchor": "middle", style: "font-size:34px;fill:#eef2f7" }, c); tx.textContent = lab;
    return c;
  };
  car(80, 600, "rgba(60,90,160,0.35)", "RADIOWÓZ", "copA");
  mkEl("rect", { x: 230, y: 580, width: 80, height: 18, rx: 6, fill: "#ff3b3b" }, $("copA"));
  car(470, 1060, "rgba(245,200,40,0.35)", "TAKSÓWKA", "copB");
}
// fala V8: dwa zapłony blisko, potem przerwa
const W_V8 = { pattern: [0, 0.25, 0.375, 0.625], T: 0.5, tau: 0.075, f: 26, window: 1.3 };
const pulsesAt = (o, tt, look) => { const out = []; const c0 = Math.floor((tt - look) / o.T) - 1, c1 = Math.floor(tt / o.T) + 1; for (let c = c0; c <= c1; c++) o.pattern.forEach((f, i) => { const p = (c + f) * o.T; if (p <= tt && p > tt - look) out.push([p, i]); }); return out; };
function wavePath(x0, x1, y, amp, t, o) {
  let d = "";
  const spp = o.window / (x1 - x0);
  for (let x = x0; x <= x1; x += 3) {
    const tt = t - (x1 - x) * spp;
    let v = 0;
    for (const [p, i] of pulsesAt(o, tt, 0.4)) { const dt = tt - p, a = i % 2 ? 0.7 : 1.0; v += a * Math.exp(-dt / o.tau) * Math.sin(2 * Math.PI * o.f * dt); }
    d += (x === x0 ? "M " : " L ") + x.toFixed(1) + " " + (y - Math.max(-1.3, Math.min(1.3, v)) * amp).toFixed(1);
  }
  return d;
}
{
  const g = $("wvBr");
  mkEl("path", { id: "brNear", fill: "none", stroke: "#eef2f7", "stroke-width": 4 }, g);
  const a = mkEl("text", { id: "brNearT", "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#eef2f7" }, g); a.textContent = "BLISKO";
  mkEl("path", { id: "brGap", fill: "none", stroke: "#ff6a4d", "stroke-width": 4 }, g);
  const b = mkEl("text", { id: "brGapT", "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#ff6a4d" }, g); b.textContent = "PRZERWA";
}
// Europa: V8 skreślone
{
  const g = $("euG");
  mkEl("circle", { cx: 470, cy: 900, r: 230, fill: "none", stroke: "#3c6fd8", "stroke-width": 10 }, g);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mkEl("circle", { cx: f1(470 + Math.cos(a) * 230), cy: f1(900 + Math.sin(a) * 230), r: 16, fill: "#ffd23a" }, g); }
  const v = mkEl("text", { x: 470, y: 950, "text-anchor": "middle", style: "font-family:Oswald,sans-serif;font-size:170px;font-weight:600;fill:#eef2f7" }, g); v.textContent = "V8";
  mkEl("path", { id: "euX", d: "M 300 740 L 640 1060", stroke: "#ff3b2a", "stroke-width": 22, "stroke-linecap": "round", fill: "none" }, g);
  const n = mkEl("text", { x: 470, y: 1250, "text-anchor": "middle", style: "font-size:36px;fill:#eef2f7" }, g); n.textContent = "NORMY SPALIN";
}
// rozmiar: 6.0 z popychaczami kontra silnik z 4 wałkami
{
  const g = $("szG");
  const box = (x, w, h, col, lab, sub, id) => {
    const b = mkEl("g", { id }, g);
    mkEl("rect", { x, y: 1300 - h, width: w, height: h, rx: 16, fill: col, stroke: "#eef2f7", "stroke-width": 4 }, b);
    const a = mkEl("text", { x: x + w / 2, y: 1300 - h - 60, "text-anchor": "middle", style: "font-size:32px;font-weight:600;fill:#eef2f7" }, b); a.textContent = lab;
    const s = mkEl("text", { x: x + w / 2, y: 1300 - h - 22, "text-anchor": "middle", style: "font-size:26px;fill:#b6c1cf" }, b); s.textContent = sub;
    return b;
  };
  box(90, 330, 330, "rgba(245,170,60,0.22)", "6.0 SMALL BLOCK", "1 WAŁEK, POPYCHACZE", "szA");
  box(470, 380, 470, "rgba(150,165,182,0.16)", "V8 Z 4 WAŁKAMI", "WAŁKI W GŁOWICACH", "szB");
}
// sto milionów
{
  const g = $("mG");
  for (let i = 0; i < 30; i++) mkEl("rect", { "data-blk": i, x: 90 + (i % 10) * 76, y: 900 + Math.floor(i / 10) * 76, width: 64, height: 64, rx: 8, fill: "#f5aa3c", opacity: 0 }, g);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gList") drawRows(R_LIST, t);
  else if (id === "gTruck") {
    const k = easeOut(win(t, 12.8, 13.6));
    $("truck").setAttribute("transform", `translate(${f1((1 - k) * 700)} 0)`);
    $("trailer").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 13.8, 14.6))) * 700)} 0)`);
    [...$("truckG").querySelectorAll("[data-lane]")].forEach((l) => { const i = +l.dataset.lane; l.setAttribute("x", f1(wrap(i * 150 - t * 600, 1200) - 100)); });
  } else if (id === "gF1") {
    pop($("f1a"), t, 16.03, 0.3, 40);
    pop($("f1b"), t, 17.23, 0.3, 40);
    pop($("f1H"), t, 18.69, 0.3, 30);
  } else if (id === "gTach") {
    const k = easeIO(win(t, 20.2, 22.22));
    const rpm = 18000 * k;
    $("tachN").textContent = String(Math.round(rpm / 100) * 100).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const a = -210 + 240 * (rpm / 18000);
    $("tachNd").setAttribute("x2", f1(470 + Math.cos(a * D2R) * 220)); $("tachNd").setAttribute("y2", f1(1180 + Math.sin(a * D2R) * 220));
    $("tachArc").setAttribute("d", tachArcD(Math.max(-209, a)));
  } else if (id === "gOverlap") {
    const cyc = wrap((t - 49.72) * 240, 720);
    $("ovCur").setAttribute("x1", f1(OVX(cyc))); $("ovCur").setAttribute("x2", f1(OVX(cyc)));
    const h = t >= 52.86 ? "W R4 <span class=\"hot\">nie pcha nikt</span>" : t >= 50.6 ? "V6: dwa <em>przez połowę czasu</em>" : "V8: zawsze <em>dwa tłoki</em>";
    setH($("ovH"), h, t, t >= 52.86 ? 52.86 : t >= 50.6 ? 50.6 : 49.75);
    OV_ROWS.forEach((row) => {
      const k = easeOut(win(t, row.at, row.at + 0.4));
      row.grp.setAttribute("opacity", k);
      row.grp.setAttribute("transform", `translate(0 ${f1((1 - k) * 30)})`);
      let n = 0;
      for (let i = 0; i < row.n; i++) { const x = wrap(cyc - i * row.step, 720); if (x < (row.eff || 180)) n++; }
      row.cnt.textContent = "PCHA: " + n;
      row.cnt.setAttribute("style", `font-size:30px;font-weight:600;fill:${n === 0 ? "#ff6a4d" : n >= 2 ? "#86dba1" : "#eef2f7"}`);
      if (row.eff) [...row.grp.querySelectorAll("[data-gap]")].forEach((r) => r.setAttribute("opacity", easeOut(win(t, 54.38, 54.7))));
    });
  } else if (id === "gCall") {
    [...$("gCall").querySelectorAll(".zr")].forEach((r, i) => pop(r, t, 55.1 + i * 0.25, 0.3, 30));
    pop($("callB"), t, 58.0 - 0.9, 0.3, 20);
  } else if (id === "gCap") {
    const v = t >= 72.9 ? "7" : t >= 71.83 ? "6" : "5";
    if ($("litN").textContent !== v) $("litN").textContent = v;
    const lastAt = t >= 72.9 ? 72.9 : t >= 71.83 ? 71.83 : 71.29;
    $("litN").style.opacity = easeOut(win(t, 71.29, 71.6));
    $("litN").style.transform = "translateY(" + f1((1 - easeOut(win(t, lastAt, lastAt + 0.3))) * 30) + "px)";
    [...$("capG").querySelectorAll("[data-cyl]")].forEach((r) => { const i = +r.dataset.cyl; const k = easeOut(win(t, 70.4 + i * 0.15, 70.8 + i * 0.15)); r.setAttribute("opacity", k); r.setAttribute("transform", `translate(0 ${f1((1 - k) * 40)})`); });
  } else if (id === "gTorque") {
    const k = easeIO(win(t, 78.8, 80.0));
    let dv = "", ds = "";
    for (let i = 0; i <= 60 * k; i++) {
      const u = i / 60, x = 90 + u * 760, rpm = 1000 + u * 6000;
      const v8 = 110 + 330 * clamp01((rpm - 1000) / 1000) - 60 * clamp01((rpm - 4500) / 2500);
      const sm = 70 + 150 * Math.sin(clamp01((rpm - 1000) / 5000) * Math.PI / 2);
      dv += (i ? " L " : "M ") + f1(x) + " " + f1(1380 - v8);
      ds += (i ? " L " : "M ") + f1(x) + " " + f1(1380 - sm);
    }
    $("tqV8").setAttribute("d", dv); $("tqSm").setAttribute("d", ds);
    const mk = easeOut(win(t, 79.94, 80.3)), x2 = 90 + (1000 / 6000) * 760;
    $("tq2k").setAttribute("x1", f1(x2)); $("tq2k").setAttribute("x2", f1(x2)); $("tq2k").setAttribute("opacity", mk);
    $("tq2kT").setAttribute("x", f1(x2)); $("tq2kT").setAttribute("opacity", mk);
  } else if (id === "gQuote") {
    pop($("qTxt"), t, 82.35, 0.35, 30);
  } else if (id === "gCops") {
    $("copA").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 87.96, 88.6))) * -700)} 0)`);
    $("copB").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 88.59, 89.2))) * 700)} 0)`);
  } else if (id === "gOdo") {
    const km = Math.round(480000 * easeIO(win(t, 89.5, 92.2)));
    const s = String(km).padStart(6, "0");
    [...$("odo").children].forEach((sp, i) => { if (sp.textContent !== s[i]) sp.textContent = s[i]; sp.classList.toggle("u", i < 6 - String(km).length ? false : true); });
  } else if (id === "gWaves") {
    const k = easeOut(win(t, 93.9, 94.3));
    $("wv8").setAttribute("d", wavePath(78, 1002, 1000, 150 * k, t, W_V8));
    const h = t >= 96.32 ? "<em>Bulgot</em> nie do pomylenia" : t >= 95.3 ? "Potem <span class=\"hot\">przerwa</span>" : "Dwa zapłony <em>blisko</em>";
    setH($("wvH"), h, t, t >= 96.32 ? 96.32 : t >= 95.3 ? 95.3 : 93.9);
    const bk = (id2, show2, x0, x1, y) => { $(id2).setAttribute("d", `M ${x0} ${y + 18} L ${x0} ${y} L ${x1} ${y} L ${x1} ${y + 18}`); $(id2).setAttribute("opacity", show2); };
    const n = easeOut(win(t, 94.44, 94.8)) * (1 - easeOut(win(t, 96.2, 96.5))), gp = easeOut(win(t, 95.58, 95.9)) * (1 - easeOut(win(t, 96.2, 96.5)));
    bk("brNear", n, 560, 720, 780); $("brNearT").setAttribute("x", 640); $("brNearT").setAttribute("y", 760); $("brNearT").setAttribute("opacity", n);
    bk("brGap", gp, 740, 960, 1230); $("brGapT").setAttribute("x", 850); $("brGapT").setAttribute("y", 1290); $("brGapT").setAttribute("opacity", gp);
  } else if (id === "gEurope") {
    dash($("euX"), easeOut(win(t, 102.81, 103.3)), 480);
  } else if (id === "gRepl") drawRows(R_REPL, t);
  else if (id === "gSize") {
    const h = t >= 121.02 ? "Mniejszy niż <em>silnik z 4 wałkami</em>" : "Sześć <em>litrów</em>";
    setH($("szH"), h, t, t >= 121.02 ? 121.02 : 120.2);
    ["szA", "szB"].forEach((sid, i) => { const k = easeOut(win(t, i ? 121.61 : 120.2, (i ? 121.61 : 120.2) + 0.5)); $(sid).setAttribute("opacity", k); $(sid).setAttribute("transform", `translate(0 ${f1((1 - k) * 60)})`); });
  } else if (id === "gSwap") drawRows(R_SWAP, t);
  else if (id === "g100m") {
    const k = easeIO(win(t, 129.0, 130.87));
    const n = Math.round(100000000 * k);
    $("mN").textContent = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    setH($("mH"), t >= 130.87 ? "<em>Stumilionowy</em> egzemplarz" : "Z taśmy zjechał", t, t >= 130.87 ? 130.87 : 129.8);
    [...$("mG").querySelectorAll("[data-blk]")].forEach((r) => { const i = +r.dataset.blk; r.setAttribute("opacity", k >= (i + 1) / 30 ? 0.9 : 0.12); });
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Wałek", "Popychacze", "Chevrolet", "1955", "Corvette"];
const RN = RW.length, RROW = 50, ANS = "Small block", T_ANS = 111.67;
const BURSTS = [[4.9, 6.0, 2 * RN], [23.4, 24.1, 2 * RN], [44.95, 45.6, 2 * RN], [67.95, 68.6, 2 * RN], [98.5, 99.2, 2 * RN], [107.3, 108.4, 2 * RN], [110.5, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 4.9, 113.2);
  rb.style.opacity = rOn ? (easeOut(win(t, 4.9, 5.2)) * (1 - easeIO(win(t, 112.8, 113.2)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const w0 = i0 === FIN ? ANS : RW[i0 % RN], w1 = i0 + 1 === FIN ? ANS : RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= T_ANS;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Odpowiedź:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    $("reelFlash").style.opacity = 0;
    const bigK = Math.max(
      easeOut(win(t, 4.9, 5.3)) * (1 - easeIO(win(t, 6.4, 6.9))),
      easeIO(win(t, 107.27, 107.6)) * (1 - easeIO(win(t, 108.3, 108.7))),
      easeIO(win(t, 110.4, 110.8)) * (1 - easeIO(win(t, 112.3, 112.8))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 128.9, 132.4);
  sc.style.opacity = sOn ? (easeOut(win(t, 128.9, 129.3)) * (1 - easeIO(win(t, 132.0, 132.4)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 128.9, 129.4))) * -60).toFixed(1) + "px)";
  const yc = $("ytCard");
  const yOn = inR(t, 132.6, 135.7);
  yc.style.opacity = yOn ? (easeOut(win(t, 132.6, 133.0)) * (1 - easeIO(win(t, 135.4, 135.7)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 132.6, 133.1))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 135.8, 140.18);
  pc.style.opacity = pOn ? easeOut(win(t, 135.8, 136.2)).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 135.8, 136.2))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 136.74 ? (t < 137.54 ? 1 : 0.5 + 0.5 * Math.sin((t - 137.54) * 4)) : 0;
    const gB = t > 137.8 ? 1 - gA * 0.5 : 0;
    on("pkA", gA); on("pkB", gB);
    $("pickC").style.opacity = easeOut(win(t, 138.66, 139.0));
  }
  $("flash").style.opacity = 0;
}

/* ================= render klatki ================= */
const chipSets = ["chHeavy", "chSb", "chVette"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chHeavy: "honest", chSb: "sbLow" };
function stamp(id, on, at, t) {
  const el = $(id);
  if (!on) { el.style.opacity = 0; return; }
  const k = easeOut(win(t, at, at + 0.3));
  el.style.opacity = k;
  el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.15 - 0.15 * k).toFixed(3) + ")";
}

function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const [s0, , kind, name] = shotAt(t);
  bd.style.opacity = kind === "board" ? 1 : 0;
  if (kind === "board") drawBoard(t, name);
  $("brUi").style.opacity = kind === "broll" ? 1 : 0;
  if (kind === "broll") { stamp("stPrz", t >= 24.6, 24.6, t); stamp("stPal", t >= 25.88, 25.88, t); stamp("stDin", t >= 26.65, 26.65, t); }
  const on3d = kind === "3d";
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (!on3d) return;

  const deg = crank8(t);
  const split = SPLIT.has(name);
  const A = states(t, name, "A");
  pose8(A.s, deg, t);
  poseSB(A.s, deg);
  lightAt(A.base);
  applyCam(t, split ? name + "A" : name, camera);

  // hook: nagłówek i tarcza od pierwszej klatki; na końcu ten sam stan
  const hookOn = name === "hook" || name === "outro";
  show($("hk"), hookOn);
  drawTop(t);
  projCam = camera;
  // tarcza zapłonu
  const dialOn = hookOn || name === "count" || name === "fire" || name === "fireAngle";
  drawDial(t, dialOn, deg, hookOn ? 1 : easeOut(win(t, s0, s0 + 0.4)));
  const dlOn = name === "fire" && t >= 40.5 || name === "fireAngle";
  $("dialL").style.opacity = dlOn ? easeOut(win(t, name === "fire" ? 40.52 : s0, (name === "fire" ? 40.52 : s0) + 0.35)) : 0;
  // kąt 90° między rzędami
  const arcOn = name === "angle" || name === "fireAngle";
  $("arcG").setAttribute("opacity", arcOn ? easeOut(win(t, name === "angle" ? 31.94 : 43.45, (name === "angle" ? 31.94 : 43.45) + 0.4)) : 0);
  if (arcOn) {
    const c = localPoint(engine.root, 0, 0, 180);
    const R1 = 420, a0 = 45, a1 = 135;
    let d = `M ${f1(c.x)} ${f1(c.y)}`;
    for (let i = 0; i <= 24; i++) { const a = lerp(a0, a1, i / 24) * D2R; const p = localPoint(engine.root, Math.cos(a) * R1 * 0.55, Math.sin(a) * R1 * 0.55, 180); d += ` L ${f1(p.x)} ${f1(p.y)}`; }
    $("arc90").setAttribute("d", d + " Z");
    const pl = localPoint(engine.root, Math.cos(135 * D2R) * R1, Math.sin(135 * D2R) * R1, 180), pr = localPoint(engine.root, Math.cos(45 * D2R) * R1, Math.sin(45 * D2R) * R1, 180);
    $("arcL").setAttribute("d", `M ${f1(c.x)} ${f1(c.y)} L ${f1(pl.x)} ${f1(pl.y)}`);
    $("arcR").setAttribute("d", `M ${f1(c.x)} ${f1(c.y)} L ${f1(pr.x)} ${f1(pr.y)}`);
    const pt = localPoint(engine.root, 0, R1 * 0.72, 180);
    $("arcT").setAttribute("x", f1(pt.x)); $("arcT").setAttribute("y", f1(pt.y));
  }
  // krzyż wału
  drawCross(t, name === "cross", 60.52);
  // numery cylindrów
  badges.forEach(({ el, c }, i) => {
    if (name !== "anatomy") { el.style.opacity = 0; return; }
    const d = L8.BANK_DIR[c.bank];
    const p = localPoint(engine.root, d.x * 330, d.y * 330, c.z);
    place(el, p.x, p.y);
    const k = easeOut(win(t, 29.22 + i * 0.08, 29.5 + i * 0.08));
    el.style.opacity = k;
    el.style.transform = "translateY(" + f1((1 - k) * 16) + "px)";
  });
  // licznik
  const cntOn = name === "pow2" || name === "pins4" || name === "slow";
  $("cnt").style.opacity = cntOn ? easeOut(win(t, s0 + 0.2, s0 + 0.6)) : 0;
  if (cntOn) {
    let n = "", lab = "";
    if (name === "pow2") { n = String(E8.powCount); lab = "<b>tłoki</b>pchają teraz"; }
    else if (name === "pins4") { n = t >= 37.05 ? "8" : "4"; lab = t >= 37.05 ? "<b>tłoków</b>" : "<b>czopy</b>"; }
    else { n = String(Math.round(1500 + 50 * Math.sin(t))); lab = "<b>obr/min</b>spokojnie"; }
    if ($("cntN").textContent !== n) $("cntN").textContent = n;
    if ($("cntL").innerHTML !== lab) $("cntL").innerHTML = lab;
  }
  chipSets.forEach((cs) => {
    const on = CHIP_SHOT[cs.el.id] === name;
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.25, 24));
  });

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const pill = $("splitPill");
  if (pill.textContent !== "Zamiast") pill.textContent = "Zamiast";
  const pk = split ? easeOut(win(t, s0, s0 + 0.4)) : 0;
  pill.style.opacity = pk;
  const setPl = (el, b, st, cls, at) => {
    const bb = el.querySelector("b"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
    s2.style.display = st ? "" : "none";
    pop(el, t, at, 0.25, 20);
  };
  if (split) { setPl($("pA"), "4 wałki", "w głowicach", "hot", 112.3); setPl($("pB"), "1 wałek", t >= 116.29 ? "i popychacze" : "w środku", "ok", 113.92); }
  else { $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawTags(t);

  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - 840, W, 840);
  composer.render();
  const Bs = states(t, name, "B");
  pose8(Bs.s, deg, t);
  poseSB(Bs.s, deg);
  lightAt(Bs.base);
  applyCam(t, name + "B", cameraB);
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - 840);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { engine, SB, camera, cameraB, composer, scene, SHOTS, L8 };
