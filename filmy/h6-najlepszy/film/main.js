// Bokser Porsche to najlepszy silnik na świecie. Bohater: Porsche 4.0 H6 (9A2 evo, modele-zrodla/porsche-h6-engine),
// do porównań BMW S54 (rzędowa szóstka, długość) i V6 (wysokość środka ciężkości). Bez napisów na środku.
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia, bez pompowania kamery.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "../model/h6-porsche/lib/materials.js";
import { buildStudioEnvironment } from "../model/h6-porsche/lib/environment.js";
import { buildEngine as buildH6 } from "../model/h6-porsche/scene.js";
import * as KH from "../model/h6-porsche/lib/layout.js";
import { createMaterials as createMaterials6, applyMaterialVariation as applyVar6 } from "../model/r6-s54/lib/materials.js";
import { buildEngine as build6 } from "../model/r6-s54/parts/engine.js";
import * as K6 from "../model/r6-s54/kinematics.js";
import { createMaterials as createMaterialsV } from "../model/v6-ohc/lib/materials.js";
import { buildEngine as buildV6 } from "../model/v6-ohc/scene.js";

const W = 1080, H = 1920, D = 142.52, SEAM = 840;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const f1 = (v) => v.toFixed(1);
const fmtN = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

/* ================= ujęcia ================= */
const SHOTS = [
  [0, 0.87, "3d", "hook"], [0.87, 1.67, "3d", "hookB"], [1.67, 2.8, "3d", "hookC"], [2.8, 4.2, "3d", "promise"], [4.2, 5.42, "3d", "promiseB"],
  [5.42, 6.46, "3d", "promise2"], [6.46, 8.15, "3d", "revs"], [8.15, 9.43, "3d", "kontra"], [9.43, 10.09, "3d", "kontraB"],
  [10.09, 12.71, "board", "gOdd"], [12.71, 16.43, "3d", "hero"], [16.43, 20.92, "3d", "anatomy"], [20.92, 22.32, "3d", "crank"],
  [22.32, 24.61, "3d", "fire"], [24.61, 28.21, "board", "gOrder"], [28.21, 29.81, "3d", "pow1"], [29.81, 34.18, "3d", "opp"],
  [34.18, 40.03, "board", "gForces"], [40.03, 41.91, "3d", "zero"], [41.91, 46.47, "3d", "lenSplit"], [46.47, 48.53, "3d", "pow2"],
  [48.53, 53.7, "board", "gCoG"], [53.7, 57.53, "board", "gRoll"], [57.53, 59.89, "3d", "subaru"], [59.89, 62.47, "3d", "cogSplit"],
  [62.47, 63.8, "3d", "pow3"], [63.8, 67.1, "3d", "crankLen"], [67.1, 71.14, "board", "gTwist"], [71.14, 74.92, "3d", "mains"],
  [74.92, 77.46, "3d", "support"], [77.46, 79.08, "3d", "pow4"], [79.08, 82.2, "3d", "air3d"], [82.2, 89.27, "board", "gAir"],
  [89.27, 90.79, "3d", "pow5"], [90.79, 95.92, "board", "gRace"], [95.92, 101.28, "board", "gLeMans"], [101.28, 103.61, "3d", "fullgas"],
  [103.61, 106.8, "3d", "honest"], [106.8, 109.77, "3d", "drop"], [109.77, 113.98, "board", "gBetween"], [113.98, 115.09, "3d", "promised"],
  [115.09, 117.92, "3d", "gt3"], [117.92, 121.29, "board", "gSpec"], [121.29, 125.16, "board", "gRev"], [125.16, 128.41, "3d", "perLitre"],
  [128.41, 129.65, "3d", "pickA"], [129.65, 132.76, "3d", "pickB"], [132.76, 141.63, "3d", "yt"], [141.63, D + 1, "3d", "outro"],
];
const shotIdx = (t) => { for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) return i; return SHOTS.length - 1; };
const shotAt = (t) => SHOTS[shotIdx(t)];
const SPLIT = new Set(["lenSplit", "cogSplit"]);

// wał kręci się cały czas tym samym, spokojnym tempem; D mieści całkowitą liczbę cykli 720°, więc pętla się domyka
const CRANK_RATE = (720 * Math.round((D * 130) / 720)) / D;
const crankAt = (t) => t * CRANK_RATE;

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
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
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.4); scene.add(fill); scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xffffff, 0.75); scene.add(rim); scene.add(rim.target);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));
// światło kluczowe zawsze po stronie kamery, żeby oglądana strona silnika nie była pod światło
function lightAt(b, cam) {
  const sx = cam.position.x >= b.x ? 1 : -1, sz = cam.position.z >= b.z ? 1 : -1;
  key.position.set(b.x + sx * 1400, b.y + 2100, b.z + sz * 1600); key.target.position.copy(b);
  fill.position.set(b.x - sx * 1700, b.y + 800, b.z + sz * 1200); fill.target.position.copy(b);
  rim.position.set(b.x - sx * 600, b.y + 1300, b.z - sz * 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

const AMBER = new THREE.Color(0xff8a1c), GREEN = new THREE.Color(0x3cff7a), ICE = new THREE.Color(0x4fb4ff);
function glowMats(obj, col = AMBER) {
  const out = [];
  if (!obj) return out;
  obj.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
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
const shadows = (root) => root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const boost = (M) => { for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial) m.envMapIntensity = (m.envMapIntensity ?? 1) * 1.3; } };

/* ================= Porsche H6 ================= */
// wał wzdłuż Z (+Z przód), bank A (cylindry 1, 2, 3) przy +X, bank B (4, 5, 6) przy -X
const MH = createMaterials();
boost(MH);
const EH = buildH6(MH);
applyMaterialVariation(EH.root, MH);
fixNormals(EH.root);
shadows(EH.root);
const H6W = new THREE.Group(); H6W.add(EH.root); scene.add(H6W);
const CYLS = KH.CYLINDERS;
const LH = KH.LAYOUT;
const crankH = EH.rotating.crank;
const cylH = (id) => EH.rotating.recip.cylinders.find((c) => c.def.id === id);
const byName = (n) => EH.root.getObjectByName(n);
const pistH = CYLS.map((c) => glowMats(cylH(c.id).piston));
const rodH = CYLS.map((c) => glowMats(cylH(c.id).rod));
const pinH = CYLS.map((c) => glowMats(crankH.getObjectByName(`Crank_RodJournal_Cyl${c.id}`)));
const mainH = [];
crankH.children.forEach((o) => { if (/^Crank_MainJournal_/.test(o.name)) mainH.push(...glowMats(o, GREEN)); });
// kadłub półprzezroczysty: własne klony materiałów obudowy, żeby nie ruszać części ruchomych
const GHOST_ROOTS = ["HALF_CASE_A", "HALF_CASE_B", "HEAD_A", "HEAD_B"].map(byName);
const ghostMats = [];
{
  const map = new Map();
  GHOST_ROOTS.forEach((r) => r.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (!map.has(o.material)) { const m = o.material.clone(); m.userData.op = m.opacity; map.set(o.material, m); ghostMats.push(m); }
    o.material = map.get(o.material);
  }));
}
let ghostOn = -1;
function setGhost(g) {
  const on = g > 0.001;
  ghostMats.forEach((m) => {
    m.opacity = 1 - 0.84 * g;
    if (on !== (ghostOn === 1)) { m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; }
  });
  ghostOn = on ? 1 : 0;
}
// w trybie przezroczystym chowamy osprzęt, żeby było widać tłoki i wał
const CORE_H = ["INTAKE_SYSTEM", "EXHAUST_SYSTEM", "CAM_COVER_A", "CAM_COVER_B", "TIMING_COVER", "THERMAL_MANAGEMENT", "OIL_SYSTEM", "ACCESSORY_DRIVE", "ENGINE_MOUNTS", "STARTER_MOTOR", "TIMING_DRIVE"].map(byName).filter(Boolean);
const NOT_CRANK = [EH.block.root, EH.heads.root, EH.intake.root, EH.exhaust.root, EH.covers.root, EH.rotating.recip.root, byName("FLYWHEEL_ASSEMBLY"), byName("STARTER_MOTOR"), byName("TIMING_DRIVE"), byName("ACCESSORY_DRIVE")].filter(Boolean);
// żar zapłonu: łagodnie narasta przez 30° i gaśnie przez 150°, bez błysku
const softFire = (x) => (x < 30 ? easeIO(x / 30) : x < 180 ? 1 - easeIO((x - 30) / 150) : 0);
const flashH = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 16), mat);
  m.position.set(c.bankSign * (LH.deckHeight - 14), 0, c.z);
  m.scale.set(0.6, 1, 1);
  m.visible = false;
  EH.root.add(m);
  return { c, m, mat };
});
const powH = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(LH.bore / 2 - 2, LH.bore / 2 - 2, 1, 32), mat);
  m.rotation.z = Math.PI / 2;
  m.visible = false;
  EH.root.add(m);
  return { c, m, mat };
});
// rozkład kaskadą: góra silnika rusza pierwsza
const EXH = EH.explode.map((x, i) => ({ ...x, k: clamp01(0.45 - x.delta.y / 1200 + hash(i) * 0.25) }));
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const boxH = (() => { EH.update(0); H6W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(EH.root); })();

/* ================= BMW S54 R6, stanowisko 80 m niżej ================= */
const SP = new THREE.Vector3(0, -80000, 0);
const M6 = createMaterials6();
boost(M6);
const E6 = build6(M6);
applyVar6(E6.root, M6);
fixNormals(E6.root);
shadows(E6.root);
E6.root.position.copy(SP);
scene.add(E6.root);
const flash6 = [];
for (let i = 0; i < 6; i++) {
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), fm);
  f.position.set(K6.CYL_X[i], K6.DECK + 14, 0);
  f.scale.set(1, 0.6, 1);
  f.visible = false;
  E6.root.add(f);
  flash6.push({ m: f, mat: fm });
}
const box6 = (() => { E6.update(K6.state(0), { cut: 0, explode: 0 }); E6.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(E6.root); })();

/* ================= V6, stanowisko 160 m niżej ================= */
const SV = new THREE.Vector3(0, -160000, 0);
const MV = createMaterialsV();
boost(MV);
const EV = buildV6(MV);
EV.ring.visible = false;
EV.charge.visible = false;
fixNormals(EV.root);
shadows(EV.root);
EV.root.position.copy(SV);
scene.add(EV.root);
const boxV = (() => { EV.updateCrank(0); EV.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(EV.root); })();

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
// H6: az = 0 bok od banku A (+X, widać długość wału), SIDE = przód (+Z, płaska sylwetka), el bliskie π/2 = z góry
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const Ps = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x: SP.x + x, y: SP.y + y, z: SP.z + z, fov, oy });
const Pv = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x: SV.x + x, y: SV.y + y, z: SV.z + z, fov, oy });
const SIDE = Math.PI / 2;
const P0 = P(0.72, 0.3, 3700, 0, -20, 20, 32, -70);
const CAM = {
  hook: [[0, P0], [0.87, P(1.3, 0.24, 3700, 0, -20, 20, 32, -70)]],
  hookB: [[0.87, P(SIDE - 0.45, 0.16, 3000, 0, 0, 0, 32, 20)], [1.67, P(SIDE + 0.3, 0.1, 3000, 0, 0, 0, 32, 20)]],
  hookC: [[1.67, P(SIDE + 0.7, 1.26, 3300, 0, 0, 0, 32, 20)], [2.8, P(SIDE - 0.35, 1.33, 3300, 0, 0, 0, 32, 20)]],
  promise: [[2.8, P(2.7, 0.36, 4800, 0, 0, 0, 32, 40)], [4.2, P(1.75, 0.28, 4800, 0, 0, 0, 32, 40)]],
  promiseB: [[4.2, P(-0.15, -0.06, 3500, 0, 0, 0, 32, 20)], [5.42, P(-0.85, 0.06, 3500, 0, 0, 0, 32, 20)]],
  promise2: [[5.42, P(1.0, 0.4, 2100, 0, 0, -20, 30, 20)], [6.46, P(0.35, 0.26, 2100, 0, 0, -20, 30, 20)]],
  revs: [[6.46, P(-0.5, 0.1, 3500, 0, -20, 0, 32, 60)], [8.15, P(-1.25, 0.22, 3500, 0, -20, 0, 32, 60)]],
  kontra: [[8.15, P(SIDE - 0.4, 0.1, 3700, 0, -20, 0, 32, 40)], [9.43, P(SIDE + 0.2, 0.05, 3700, 0, -20, 0, 32, 40)]],
  kontraB: [[9.43, P(2.35, -0.14, 3300, 0, -20, 0, 32, 40)], [10.09, P(1.95, -0.08, 3300, 0, -20, 0, 32, 40)]],
  hero: [[12.71, P(-2.3, 0.22, 3450, 0, -20, 0, 32, 30)], [16.43, P(-1.8, 0.3, 3450, 0, -20, 0, 32, 30)]],
  anatomy: [[16.43, P(SIDE + 0.55, 0.95, 3000, 0, 0, 0, 32, 20)], [20.92, P(SIDE + 0.2, 1.08, 3000, 0, 0, 0, 32, 20)]],
  crank: [[20.92, P(0.95, 0.42, 2100, 0, 0, -20, 30, 20)], [22.32, P(0.7, 0.36, 2100, 0, 0, -20, 30, 20)]],
  fire: [[22.32, P(-0.9, 0.62, 2900, 0, 0, 0, 32, 60)], [24.61, P(-0.6, 0.55, 2900, 0, 0, 0, 32, 60)]],
  pow1: [[28.21, P(2.5, 0.2, 3450, 0, -20, 0, 32, 30)], [29.81, P(2.25, 0.18, 3450, 0, -20, 0, 32, 30)]],
  opp: [[29.81, P(SIDE + 0.3, 1.3, 2850, 0, 0, 0, 32, 40)], [34.18, P(SIDE - 0.05, 1.36, 2850, 0, 0, 0, 32, 40)]],
  zero: [[40.03, P(1.15, -0.02, 3450, 0, 0, 0, 32, 20)], [41.91, P(0.9, 0.02, 3450, 0, 0, 0, 32, 20)]],
  lenSplitA: [[41.91, Ps(SIDE, 0.05, 5400, 0, 140, 0, 32, 380)], [46.47, Ps(SIDE, 0.05, 5400, 0, 140, 0, 32, 380)]],
  lenSplitB: [[41.91, P(0, 0.05, 5400, 0, 0, 30, 32, -130)], [46.47, P(0, 0.05, 5400, 0, 0, 30, 32, -130)]],
  pow2: [[46.47, P(SIDE + 0.3, 0.14, 3700, 0, -20, 0, 32, 30)], [48.53, P(SIDE + 0.05, 0.1, 3700, 0, -20, 0, 32, 30)]],
  subaru: [[57.53, P(-0.55, 0.2, 3450, 0, -20, 0, 32, 30)], [59.89, P(-0.85, 0.24, 3450, 0, -20, 0, 32, 30)]],
  cogSplitA: [[59.89, Pv(SIDE, 0.04, 4600, 0, 60, 0, 32, 355)], [62.47, Pv(SIDE, 0.04, 4600, 0, 60, 0, 32, 355)]],
  cogSplitB: [[59.89, P(SIDE, 0.04, 4600, 0, 60, 0, 32, -170)], [62.47, P(SIDE, 0.04, 4600, 0, 60, 0, 32, -170)]],
  pow3: [[62.47, P(0.55, 0.4, 3000, 0, 0, 0, 32, 30)], [63.8, P(0.35, 0.36, 3000, 0, 0, 0, 32, 30)]],
  crankLen: [[63.8, P(0.25, 0.18, 2200, 0, 0, 0, 30, 20)], [67.1, P(-0.1, 0.12, 2200, 0, 0, 0, 30, 20)]],
  mains: [[71.14, P(-0.35, 0.42, 3200, 0, 0, 0, 32, 30)], [74.92, P(-0.75, 0.36, 3200, 0, 0, 0, 32, 30)]],
  support: [[74.92, P(-0.95, 0.3, 2150, 0, 0, -20, 30, 20)], [77.46, P(-0.65, 0.26, 2150, 0, 0, -20, 30, 20)]],
  pow4: [[77.46, P(SIDE - 0.2, 1.2, 3550, 0, 0, 0, 32, 30)], [79.08, P(SIDE + 0.15, 1.24, 3550, 0, 0, 0, 32, 30)]],
  air3d: [[79.08, P(1.05, 0.3, 3700, 0, -20, 0, 32, 30)], [82.2, P(0.8, 0.26, 3700, 0, -20, 0, 32, 30)]],
  pow5: [[89.27, P(2.7, 0.08, 3200, 0, -20, 0, 32, 30)], [90.79, P(2.45, 0.1, 3200, 0, -20, 0, 32, 30)]],
  fullgas: [[101.28, P(0.9, 0.55, 2850, 0, 0, 0, 32, 40)], [103.61, P(0.6, 0.5, 2850, 0, 0, 0, 32, 40)]],
  honest: [[103.61, P(SIDE - 0.08, 0.12, 3850, 0, -20, 0, 32, 20)], [106.8, P(SIDE + 0.12, 0.12, 3850, 0, -20, 0, 32, 20)]],
  drop: [[106.8, P(-2.45, 0.16, 3850, 0, -120, 0, 32, 120)], [109.77, P(-2.2, 0.14, 3850, 0, -120, 0, 32, 120)]],
  promised: [[113.98, P(2.15, 0.28, 3800, 0, -20, 0, 32, -20)], [115.09, P(1.95, 0.25, 3800, 0, -20, 0, 32, -20)]],
  gt3: [[115.09, P(-0.75, 0.16, 3600, 0, -20, 0, 32, -60)], [117.92, P(-0.4, 0.14, 3600, 0, -20, 0, 32, -60)]],
  perLitre: [[125.16, P(2.05, 0.3, 3900, 0, -20, 0, 32, 170)], [128.41, P(2.45, 0.26, 3900, 0, -20, 0, 32, 170)]],
  pickA: [[128.41, P(0.9, 0.24, 3700, 0, -20, 0, 32, 300)], [129.65, P(0.78, 0.22, 3700, 0, -20, 0, 32, 300)]],
  pickB: [[129.65, Ps(-0.9, 0.22, 4600, 0, 140, 0, 32, 300)], [132.76, Ps(-1.15, 0.18, 4600, 0, 140, 0, 32, 300)]],
  yt: [[132.76, P(1.5, 0.3, 6600, 0, 0, 0, 32, 230)], [141.63, P(-0.1, 0.34, 6600, 0, 0, 0, 32, 230)]],
  outro: [[141.63, P(0.45, 0.33, 3700, 0, -20, 20, 32, -70)], [D, P0], [D + 1, P(0.8, 0.285, 3700, 0, -20, 20, 32, -70)]],
};
// bez pompowania: w obrębie ujęcia kamera krąży w stałej odległości, nigdy nie przybliża i nie oddala
for (const name in CAM) {
  const r = /^(hook|outro)/.test(name) ? P0.r : CAM[name][CAM[name].length - 1][1].r;
  CAM[name] = CAM[name].map(([tk, k]) => [tk, { ...k, r }]);
}
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam = camera, si = shotIdx(t)) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  if (si > 0 && si < SHOTS.length - 1) {
    // każde cięcie wchodzi miękkim osiadaniem w azymucie, bez zmiany odległości
    const cut = 1 - easeIO(win(t, SHOTS[si][0], SHOTS[si][0] + 1.1));
    v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.07 * cut;
  }
  const jit = clamp01(t / 1.0) * clamp01((D - t) / 1.0);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  camTgt.set(v.x, v.y, v.z);
  const r = v.r;
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  // widok prawie z góry: "góra" kadru to przód silnika
  cam.up.set(0, 1, 0);
  if (v.el > 1.2) cam.up.set(-Math.cos(v.az), 0, -Math.sin(v.az));
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silników ================= */
const blank = () => ({ e: 0, g: 0, core: 0, crankOnly: 0, fire: 0, pow: 0, pist: 0, pin: 0, main: 0, drop: 0, fire6: 0 });
const hookE = (t) => 0.75 * (1 - easeOut(win(t, 0, 0.85)));
function states(t, name, panel) {
  const s = blank();
  let base = new THREE.Vector3();
  switch (name) {
    case "hook": s.e = hookE(t); s.fire = 1; break;
    case "outro": s.e = 0.75 * easeIO(win(t, 141.63, D)); s.fire = 1; break;
    case "promise": s.e = 0.75; break;
    case "hookB": s.g = 1; s.core = 1; s.pist = 0.9; s.fire = 1; break;
    case "hookC": s.g = 1; s.core = 1; s.fire = 1; s.pow = 1; break;
    case "promiseB": s.e = 0.75 * (1 - easeIO(win(t, 4.2, 5.3))); s.fire = 1; break;
    case "promise2": s.crankOnly = 1; s.pin = 0.7; s.main = 0.5; break;
    case "revs": s.fire = 1; break;
    case "kontraB": s.fire = 1; break;
    case "hero": s.fire = 1; break;
    case "anatomy": s.g = 1; s.core = 1; s.pist = 0.9 * easeOut(win(t, 18.93, 19.4)); break;
    case "crank": s.crankOnly = 1; s.pin = 0.6 * easeOut(win(t, 21.35, 21.8)); break;
    case "fire": s.g = 1; s.core = 1; s.fire = 1; s.pow = 1; break;
    case "pow1": s.pist = 0; break;
    case "opp": s.g = 1; s.core = 1; s.pist = 0.8 * easeOut(win(t, 30.14, 30.6)); break;
    case "lenSplit": if (panel === "A") base = SP; else s.core = 1; break;
    case "subaru": s.fire = 1; break;
    case "cogSplit": if (panel === "A") base = SV; break;
    case "pow3": s.g = 1; s.core = 1; s.pin = 0.5 * easeOut(win(t, 62.9, 63.3)); s.main = 0.5 * easeOut(win(t, 62.9, 63.3)); break;
    case "crankLen": s.crankOnly = 1; s.pin = 0.45; break;
    case "mains": s.g = 1; s.core = 1; s.main = 0.9 * easeOut(win(t, 73.52, 74.0)); break;
    case "support": s.crankOnly = 1; s.main = 0.9; s.pin = 0.6 * easeOut(win(t, 75.29, 75.7)); break;
    case "pow5": s.fire = 1; break;
    case "fullgas": s.g = 1; s.core = 1; s.fire = 1; s.pow = 1; break;
    case "drop": s.drop = easeIO(win(t, 107.98, 109.5)); break;
    case "gt3": s.fire = 1; break;
    case "perLitre": s.fire = 1; break;
    case "pickA": s.fire = 1; break;
    case "pickB": base = SP; s.fire6 = 1; break;
    case "yt": s.e = easeIO(win(t, 133.1, 139.6)); break;
  }
  return { s, base };
}

function poseH(st, deg) {
  EH.update(deg);
  for (const x of EXH) x.obj.position.copy(x.rest).addScaledVector(x.delta, st.e > 0 ? stag(st.e, x.k) : 0);
  const co = !!st.crankOnly;
  NOT_CRANK.forEach((o) => { o.visible = !co; });
  CORE_H.forEach((o) => { o.visible = !co && !st.core; });
  setGhost(st.g);
  CYLS.forEach((c, i) => {
    setGlow(pistH[i], st.pist);
    setGlow(rodH[i], st.pist * 0.5);
    setGlow(pinH[i], st.pin * 1.6);
  });
  setGlow(mainH, st.main * 1.4);
  const cm = wrap(deg, 720);
  flashH.forEach((f) => {
    const k = st.fire && !co ? softFire(wrap(cm - f.c.fireAngle, 720)) : 0;
    f.m.visible = k > 0.01;
    f.mat.opacity = 0.45 * k;
    f.mat.color.setRGB(1.3, 0.55, 0.16);
  });
  powH.forEach((g) => {
    const ph = KH.cyclePhase(g.c, deg);
    const on = !!st.pow && ph < 180 && !co;
    g.m.visible = on;
    if (!on) return;
    const { s } = KH.pistonPinDistance(g.c, deg);
    const crown = s + LH.pistonCompressionHeight;
    const len = Math.max(2, LH.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.set(g.c.bankSign * (crown + len / 2), 0, g.c.z);
    const f = ph / 180;
    g.mat.opacity = 0.55 * Math.sin(Math.PI * f);
    g.mat.color.setRGB(1.3 - 0.3 * f, 0.5 - 0.2 * f, 0.12);
  });
  H6W.position.y = -520 * st.drop;
  H6W.updateMatrixWorld(true);
}
function pose6(st, deg) {
  E6.update(K6.state(deg), { cut: 0, explode: 0 });
  for (let i = 0; i < 6; i++) {
    const k = st.fire6 ? softFire(K6.cyclePhase(i + 1, deg)) : 0;
    flash6[i].m.visible = k > 0.01;
    flash6[i].mat.opacity = 0.45 * k;
    flash6[i].mat.color.setRGB(1.3, 0.55, 0.16);
  }
  E6.root.updateMatrixWorld(true);
}
function poseV(deg) { EV.updateCrank(deg); EV.root.updateMatrixWorld(true); }

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui"), shadeBot = document.querySelector(".shade-bot");
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
const popS = (el, t, at, dy = 30) => { const k = easeOut(win(t, at, at + 0.4)); el.setAttribute("opacity", f1(k)); el.setAttribute("transform", `translate(0 ${f1((1 - k) * dy)})`); return k; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const mkT = (txt, attrs, parent) => { const e = mkEl("text", attrs, parent); e.textContent = txt; return e; };
const dash = (el, k, L = 1600) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
const stepH = (el, t, list) => { let cur = list[0]; for (const x of list) if (t >= x[0]) cur = x; setH(el, cur[1], t, cur[0]); };

// numery cylindrów przy głowicach
const badges = CYLS.map((c) => { const el = document.createElement("div"); el.className = "badge" + (c.bank === "B" ? " b" : ""); el.textContent = String(c.id); $("badges").appendChild(el); return { el, c }; });
// tarcza zapłonu: 6 znaczników co 120° w cyklu 720°
const dialTicks = CYLS.map((c) => {
  const g = mkEl("g", {}, $("dialTicks"));
  const dot = mkEl("circle", { r: 11 }, g);
  const tx = mkT(String(c.id), { "text-anchor": "middle", "dominant-baseline": "central", style: "font-size:24px;font-weight:600;fill:#eef2f7" }, g);
  return { c, dot, tx };
});
function drawDial(on, deg, k0) {
  $("dial").setAttribute("opacity", on ? k0 : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", f1(200 + Math.cos(rad) * 86));
  $("dialP").setAttribute("y2", f1(1290 + Math.sin(rad) * 86));
  dialTicks.forEach(({ c, dot, tx }) => {
    const fa = c.fireAngle;
    const r2 = (fa / 2 - 90) * D2R;
    dot.setAttribute("cx", f1(200 + Math.cos(r2) * 80));
    dot.setAttribute("cy", f1(1290 + Math.sin(r2) * 80));
    tx.setAttribute("x", f1(200 + Math.cos(r2) * 132));
    tx.setAttribute("y", f1(1290 + Math.sin(r2) * 132));
    const x = wrap(cm - fa, 720), k = x < 80 ? 1 - x / 80 : 0;
    dot.setAttribute("r", f1(10 + 7 * k));
    dot.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
  });
}
// strzałki ruchu tłoków: para naprzeciw siebie zawsze w przeciwne strony
const PAIR_COL = ["#f5aa3c", "#7cc4ff", "#86dba1"];
const oppArrows = CYLS.map((c) => ({ c, p: mkEl("path", { fill: "none", stroke: PAIR_COL[c.slot], "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round" }, $("oppG")) }));
function arrowX(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = Math.min(24, L * 0.6);
  return `M ${f1(x0)} ${f1(y0)} L ${f1(x1)} ${f1(y1)} M ${f1(x1 - ux * h - uy * h * 0.8)} ${f1(y1 - uy * h + ux * h * 0.8)} L ${f1(x1)} ${f1(y1)} L ${f1(x1 - ux * h + uy * h * 0.8)} ${f1(y1 - uy * h - ux * h * 0.8)}`;
}
function drawOpp(t, name, deg) {
  const on = name === "opp" && t >= 31.61;
  $("oppG").setAttribute("opacity", on ? f1(easeOut(win(t, 31.61, 32.0))) : 0);
  if (!on) return;
  oppArrows.forEach(({ c, p }) => {
    const v = KH.pistonPinDistance(c, deg + 2).s - KH.pistonPinDistance(c, deg - 2).s; // >0: tłok jedzie na zewnątrz
    const dir = c.bankSign * Math.sign(v) * Math.min(1, Math.abs(v) / 5.5);
    const a = localPoint(EH.root, c.bankSign * 330, 0, c.z), b = localPoint(EH.root, c.bankSign * 330 + dir * 150, 0, c.z);
    p.setAttribute("d", Math.abs(dir) > 0.08 ? arrowX(a.x, a.y, b.x, b.y) : "");
  });
}
// wymiary
const dimG = $("dim");
const mkDim = (col, dashed) => {
  const g = mkEl("g", {}, dimG);
  const ln = mkEl("path", { fill: "none", stroke: col, "stroke-width": 5, "stroke-dasharray": dashed ? "14 10" : "none" }, g);
  const tx = mkT("", { "text-anchor": "middle", style: `font-size:34px;fill:${col};paint-order:stroke;stroke:rgba(6,8,11,0.92);stroke-width:10px` }, g);
  return { g, ln, tx };
};
const DIMS = [mkDim("#ff6a4d"), mkDim("#86dba1"), mkDim("#ff6a4d")];
function dimLine(dm, cam, a, b, label, k, below) {
  projCam = cam;
  const pa = project(a), pb = project(b);
  projCam = camera;
  const x1 = lerp(pa.x, pb.x, k);
  const tk = below ? 18 : -18;
  dm.ln.setAttribute("d", `M ${f1(pa.x)} ${f1(pa.y - tk)} L ${f1(pa.x)} ${f1(pa.y)} L ${f1(x1)} ${f1(pb.y)}` + (k > 0.98 ? ` L ${f1(pb.x)} ${f1(pb.y - tk)}` : ""));
  dm.tx.textContent = label;
  dm.tx.setAttribute("x", f1((pa.x + pb.x) / 2));
  dm.tx.setAttribute("y", f1(pa.y + (below ? 50 : -24)));
  dm.tx.setAttribute("opacity", clamp01((k - 0.6) / 0.4));
  dm.g.setAttribute("opacity", k > 0.01 ? 1 : 0);
}
// długość: blok S54 i skrzynia korbowa H6 (bez napędów na końcach wału)
const HL6 = K6.HALF_LENGTH, HLH = LH.caseZ;
function drawDims(t, name) {
  const on = name === "lenSplit" || name === "honest";
  dimG.setAttribute("opacity", on ? 1 : 0);
  DIMS.forEach((d) => d.g.setAttribute("opacity", 0));
  if (!on) return;
  if (name === "honest") {
    const y = boxH.max.y + 60;
    dimLine(DIMS[0], camera, new THREE.Vector3(boxH.min.x, y, 0), new THREE.Vector3(boxH.max.x, y, 0), "Szeroki", easeIO(win(t, 104.83, 105.5)), false);
    return;
  }
  // linie wymiarów pod silnikami, podpis nad linią (w panelach nie ma miejsca pod spodem)
  const y6 = box6.min.y + 20, yh = boxH.min.y + 20;
  dimLine(DIMS[0], camera, new THREE.Vector3(SP.x - HL6, y6, SP.z + 300), new THREE.Vector3(SP.x + HL6, y6, SP.z + 300), "6 w rzędzie", easeIO(win(t, 43.47, 44.1)), false);
  dimLine(DIMS[1], cameraB, new THREE.Vector3(500, yh, HLH), new THREE.Vector3(500, yh, -HLH), "3 w rzędzie", easeIO(win(t, 45.25, 45.9)), false);
}
// środek ciężkości: kropka i przerywana linia na wysokości środka masy (V6 wyżej, bokser na wysokości wału)
const cogG = $("cogG");
const mkCog = (col) => {
  const g = mkEl("g", {}, cogG);
  const ln = mkEl("line", { stroke: col, "stroke-width": 5, "stroke-dasharray": "16 12" }, g);
  const c = mkEl("circle", { r: 22, fill: "rgba(10,14,19,0.9)", stroke: col, "stroke-width": 6 }, g);
  const x = mkEl("path", { stroke: col, "stroke-width": 4, fill: "none" }, g);
  return { g, ln, c, x };
};
const COGS = [mkCog("#ff6a4d"), mkCog("#86dba1")];
// V6: masa bloku i głowic nad wałem, środek wyraźnie nad osią; bokser: masa po obu stronach wału, środek na osi wału
const COG_V = new THREE.Vector3(SV.x, SV.y + 170, SV.z + 300), COG_H = new THREE.Vector3(0, 0, 450);
function drawCog(t, name) {
  const on = name === "cogSplit";
  cogG.setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  [[COGS[0], camera, COG_V, 60.3], [COGS[1], cameraB, COG_H, 61.74]].forEach(([cg, cam, p, at]) => {
    projCam = cam;
    const q = project(p);
    projCam = camera;
    const k = easeOut(win(t, at, at + 0.4));
    cg.g.setAttribute("opacity", f1(k));
    cg.ln.setAttribute("x1", 80); cg.ln.setAttribute("x2", f1(lerp(80, 1000, easeIO(win(t, at, at + 0.6)))));
    cg.ln.setAttribute("y1", f1(q.y)); cg.ln.setAttribute("y2", f1(q.y));
    cg.c.setAttribute("cx", f1(q.x)); cg.c.setAttribute("cy", f1(q.y));
    cg.x.setAttribute("d", `M ${f1(q.x - 22)} ${f1(q.y)} L ${f1(q.x + 22)} ${f1(q.y)} M ${f1(q.x)} ${f1(q.y - 22)} L ${f1(q.x)} ${f1(q.y + 22)}`);
  });
}
// strumień powietrza wzdłuż cylindrów wystających na boki
const AIR = [];
for (let i = 0; i < 8; i++) {
  const side = i < 4 ? 1 : -1, j = i % 4;
  AIR.push({ side, x: side * (300 + j * 45), y: -90 + j * 60, ph: hash(i + 3), p: mkEl("path", { fill: "none", stroke: "#9fd4ff", "stroke-width": 9, "stroke-linecap": "round" }, $("airG")) });
}
function drawAir(t, name) {
  const on = name === "air3d" && t >= 80.58;
  $("airG").setAttribute("opacity", on ? f1(0.9 * easeOut(win(t, 80.58, 81.0))) : 0);
  if (!on) return;
  AIR.forEach((a) => {
    const u = wrap(t * 0.9 + a.ph, 1);
    const z0 = 700 - u * 1500, z1 = z0 - 260;
    let d = "";
    for (let k = 0; k <= 8; k++) { const z = lerp(z0, z1, k / 8); const p = localPoint(EH.root, a.x, a.y, z); d += (k ? " L " : "M ") + f1(p.x) + " " + f1(p.y); }
    a.p.setAttribute("d", d);
    a.p.setAttribute("opacity", f1(Math.sin(Math.PI * u)));
  });
}

/* ================= górny blok ================= */
const TOPS = [
  [5.44, "Który silnik", "Seryjny, <em>wolnossący</em>"],
  [6.46, "Który silnik", "Do <em>9000</em> obrotów"],
  [8.17, "Mówi się", "Że bokser to..."],
  [9.43, "Mówi się", "To <span class=\"hot\">dziwactwo</span>"],
  [12.73, "Więc czemu", "<em>Porsche</em>"],
  [14.94, "Więc czemu Porsche", "Nie chce <em>niczego innego?</em>"],
  [16.45, "Budowa", "<em>6</em> cylindrów"],
  [17.3, "Budowa", "Po <em>3</em> z każdej strony"],
  [18.93, "Budowa", "Płasko <em>naprzeciw siebie</em>"],
  [20.94, "Budowa", "<em>1</em> wał pośrodku"],
  [22.34, "Zapłon", "Co <em>120°</em>"],
  [28.23, "Powód 1", "<em>Wyważenie</em>"],
  [29.83, "Każdy tłok", "Ma naprzeciwko <em>partnera</em>"],
  [31.61, "W tej samej chwili", "Leci w <em>drugą stronę</em>"],
  [40.05, "Powód 1 · wyważenie", "<em>Zero</em> wałków wyważających"],
  [46.49, "Powód 2", "Środek <em>ciężkości</em>"],
  [57.55, "Subaru", "Też robi <em>boksery</em>"],
  [58.58, "Subaru", "Z tego <em>samego powodu</em>"],
  [62.49, "Powód 3", "<em>Wał</em>"],
  [63.82, "Cylindry naprzeciw siebie", "Wał jest <em>krótki</em>"],
  [66.23, "Wał jest krótki", "Jak w <em>czwórce</em>"],
  [71.16, "Chłodzone powietrzem", "Stare <em>boksery 911</em>"],
  [73.33, "Wał leżał na", "<em>8</em> łożyskach głównych"],
  [74.94, "Każde wykorbienie", "Podparte <em>z obu stron</em>"],
  [77.48, "Powód 4", "<em>Chłodzenie</em>"],
  [79.1, "Cylindry", "Sterczą <em>na boki</em>"],
  [80.58, "Prosto w", "Strumień <em>powietrza</em>"],
  [89.29, "Powód 5", "<em>Wyścigi</em>"],
  [101.3, "Le Mans", "<em>24 godziny</em> pełnego gazu"],
  [103.63, "Wady", "Uczciwie?"],
  [104.28, "Uczciwie", "Bokser jest <span class=\"hot\">szeroki</span>"],
  [105.39, "Uczciwie", "I <span class=\"hot\">drogi</span> w serwisie"],
  [106.82, "Przy niektórych naprawach", "Mechanik opuszcza <span class=\"hot\">cały silnik</span>"],
  [125.18, "911 GT3", "<em>127 KM</em> z litra"],
  [126.97, "911 GT3", "Bez grama <em>doładowania</em>"],
];
// górny blok zależy od renderowanego ujęcia, więc przy przenikaniu w planszę zostaje i gaśnie razem z 3D
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // przy obietnicy i odpowiedzi mówi bęben, w hooku stoi własny nagłówek
  const nm = SHOTS[si][3];
  const off = SHOTS[si][1] <= 10.1 || SPLIT.has(nm) || nm === "hook" || nm === "outro" || nm === "promise" || nm === "promised" || nm === "gt3" || SHOTS[si][0] >= 128;
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
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.3)); r.stEl.style.opacity = k; r.stEl.style.transform = "translateX(" + ((1 - k) * 20).toFixed(1) + "px)"; }
  });
}
const RACE_ROWS = rowsOf("gRace");
const C = { fg: "#eef2f7", fg2: "#b6c1cf", oil: "#f5aa3c", hot: "#ff6a4d", ok: "#86dba1", ice: "#7cc4ff", dim: "rgba(150,165,182,0.12)" };

// auto z góry: silnik za tylną osią
{
  const g = $("odG");
  mkEl("path", { d: "M 470 560 C 330 560 300 620 296 720 L 290 1060 C 288 1250 300 1330 340 1370 Q 470 1400 600 1370 C 640 1330 652 1250 650 1060 L 644 720 C 640 620 610 560 470 560 Z", fill: "rgba(150,165,182,0.07)", stroke: C.fg2, "stroke-width": 5 }, g);
  mkEl("path", { d: "M 330 830 Q 470 800 610 830 L 600 900 Q 470 880 340 900 Z", fill: "rgba(124,196,255,0.14)", stroke: C.fg2, "stroke-width": 3 }, g);
  mkEl("path", { d: "M 340 1080 Q 470 1100 600 1080 L 596 1030 Q 470 1045 344 1030 Z", fill: "rgba(124,196,255,0.1)", stroke: C.fg2, "stroke-width": 3 }, g);
  for (const [x, y] of [[250, 640], [650, 640], [250, 1110], [650, 1110]]) mkEl("rect", { x, y, width: 44, height: 140, rx: 12, fill: "#161b22", stroke: C.fg2, "stroke-width": 5 }, g);
  mkEl("line", { id: "odAxle", x1: 200, x2: 740, y1: 1180, y2: 1180, stroke: C.fg2, "stroke-width": 6, "stroke-dasharray": "16 10", opacity: 0.6 }, g);
  mkT("TYLNA OŚ", { id: "odAxleT", x: 760, y: 1188, style: "font-size:22px", opacity: 0 }, g);
  mkT("PRZÓD", { x: 470, y: 540, "text-anchor": "middle", style: "font-size:22px" }, g);
  const e = mkEl("g", { id: "odEng" }, g);
  mkEl("rect", { x: 330, y: -45, width: 280, height: 90, rx: 12, fill: "rgba(245,170,60,0.35)", stroke: C.oil, "stroke-width": 5 }, e);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) mkEl("circle", { cx: 470 + s * 100, cy: -24 + i * 24, r: 10, fill: C.oil }, e);
  mkEl("path", { id: "odW", d: "M 330 70 L 610 70 M 330 55 L 330 85 M 610 55 L 610 85", stroke: C.hot, "stroke-width": 5, fill: "none", opacity: 0 }, e);
}
// kolejność zapłonu: bokser z góry, bank A po prawej, bank B po lewej, przód u góry
const ORDER_T = [25.53, 26.11, 26.32, 26.64, 27.22, 27.68];
const ORDER_ID = [1, 6, 2, 4, 3, 5];
const orderGlow = (t, i) => { const a = ORDER_T[i], b = i < 5 ? ORDER_T[i + 1] : 28.1; return easeOut(win(t, a - 0.05, a + 0.12)) * (1 - easeIO(win(t, b - 0.05, b + 0.12))); };
const OPOS = (id) => { const c = CYLS.find((q) => q.id === id); return { x: 470 + c.bankSign * 230, y: 760 + c.slot * 230 }; };
{
  const g = $("orG");
  mkEl("rect", { x: 440, y: 640, width: 60, height: 700, rx: 30, fill: "rgba(150,165,182,0.12)", stroke: C.fg2, "stroke-width": 4 }, g);
  mkT("WAŁ", { x: 470, y: 1380, "text-anchor": "middle", style: "font-size:22px" }, g);
  mkT("PRZÓD", { x: 470, y: 612, "text-anchor": "middle", style: "font-size:22px" }, g);
  ORDER_ID.forEach((id, i) => {
    if (i === 0) return;
    const a = OPOS(ORDER_ID[i - 1]), b = OPOS(id), mx = (a.x + b.x) / 2 + (a.y === b.y ? 0 : 0), my = (a.y + b.y) / 2 - 110;
    mkEl("path", { "data-arc": i, d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, fill: "none", stroke: C.oil, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.85 }, g);
  });
  for (let id = 1; id <= 6; id++) {
    const p = OPOS(id), c = mkEl("g", { "data-cyl": id }, g);
    mkEl("circle", { cx: p.x, cy: p.y, r: 70, fill: "rgba(150,165,182,0.1)", stroke: C.fg2, "stroke-width": 5 }, c);
    mkT(String(id), { class: "sans", x: p.x, y: p.y + 24, "text-anchor": "middle", style: "font-size:68px;font-weight:600;fill:#eef2f7" }, c);
  }
}
// pary tłoków: siły w przeciwne strony gaszą się
const FR = [{ y: 660, ph: 0, at: 34.18 }, { y: 900, ph: 240, at: 37.81 }, { y: 1140, ph: 120, at: 38.02 }];
{
  const g = $("frG");
  FR.forEach((r) => {
    r.g = mkEl("g", {}, g);
    mkEl("line", { x1: 150, x2: 790, y1: r.y, y2: r.y, stroke: "rgba(150,165,182,0.25)", "stroke-width": 3 }, r.g);
    mkEl("circle", { cx: 470, cy: r.y, r: 20, fill: "#161b22", stroke: C.fg2, "stroke-width": 4 }, r.g);
    r.L = mkEl("rect", { width: 90, height: 120, rx: 10, fill: "rgba(245,170,60,0.3)", stroke: C.oil, "stroke-width": 5 }, r.g);
    r.R = mkEl("rect", { width: 90, height: 120, rx: 10, fill: "rgba(245,170,60,0.3)", stroke: C.oil, "stroke-width": 5 }, r.g);
    r.aL = mkEl("path", { fill: "none", stroke: C.hot, "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }, r.g);
    r.aR = mkEl("path", { fill: "none", stroke: C.hot, "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }, r.g);
    r.eq = mkT("= 0", { class: "sans", x: 470, y: r.y + 115, "text-anchor": "middle", style: "font-size:60px;font-weight:600;fill:#86dba1", opacity: 0 }, r.g);
  });
  mkT("MOMENTY TEŻ = 0", { id: "frM", x: 470, y: 1380, "text-anchor": "middle", style: "font-size:28px;fill:#86dba1", opacity: 0 }, g);
}
// auto z boku: silnik nisko, środek ciężkości tuż nad asfaltem
{
  const g = mkEl("g", { transform: "translate(0 -110)" }, $("cgG"));
  mkEl("line", { x1: 60, x2: 880, y1: 1250, y2: 1250, stroke: C.fg2, "stroke-width": 4 }, g);
  mkT("ASFALT", { x: 70, y: 1290, style: "font-size:22px" }, g);
  mkEl("path", { d: "M 110 1170 L 110 1100 Q 120 1060 200 1050 L 330 1040 Q 420 930 540 925 Q 690 925 780 1030 Q 840 1050 850 1100 L 850 1170 Z", fill: "rgba(150,165,182,0.08)", stroke: C.fg2, "stroke-width": 5 }, g);
  mkEl("path", { d: "M 360 1040 Q 430 955 530 950 L 560 1040 Z M 580 1040 L 560 952 Q 660 960 730 1040 Z", fill: "rgba(124,196,255,0.12)", stroke: C.fg2, "stroke-width": 3 }, g);
  for (const x of [240, 700]) mkEl("circle", { cx: x, cy: 1180, r: 68, fill: "#161b22", stroke: C.fg2, "stroke-width": 6 }, g);
  mkEl("rect", { id: "cgEng", x: 730, y: 1085, width: 120, height: 70, rx: 10, fill: "rgba(245,170,60,0.35)", stroke: C.oil, "stroke-width": 5 }, g);
  mkEl("line", { id: "cgLn", x1: 790, x2: 790, y1: 1155, y2: 1250, stroke: C.ok, "stroke-width": 5, "stroke-dasharray": "10 8", opacity: 0 }, g);
  mkT("TUŻ NAD ASFALTEM", { id: "cgT", x: 560, y: 1380, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  const cg = mkEl("g", { id: "cgDot", opacity: 0 }, g);
  mkEl("circle", { cx: 0, cy: 0, r: 24, fill: "rgba(10,14,19,0.9)", stroke: C.ok, "stroke-width": 6 }, cg);
  mkEl("path", { d: "M -24 0 L 24 0 M 0 -24 L 0 24", stroke: C.ok, "stroke-width": 4 }, cg);
}
// auto od tyłu w zakręcie: niżej środek ciężkości, mniejszy przechył
{
  const g = $("rlG");
  mkEl("line", { x1: 60, x2: 880, y1: 1300, y2: 1300, stroke: C.fg2, "stroke-width": 4 }, g);
  const car = (id, col, dashd) => {
    const c = mkEl("g", { id }, g);
    const st = { fill: "none", stroke: col, "stroke-width": 5, "stroke-dasharray": dashd ? "14 10" : "none" };
    mkEl("path", { d: "M 230 1180 L 230 1030 Q 240 960 330 940 Q 470 870 610 940 Q 700 960 710 1030 L 710 1180 Z", ...st, fill: dashd ? "none" : "rgba(150,165,182,0.08)" }, c);
    mkEl("path", { d: "M 330 950 Q 470 895 610 950 L 590 1000 Q 470 965 350 1000 Z", ...st }, c);
    return c;
  };
  car("rlHigh", C.hot, true);
  car("rlLow", C.fg2, false);
  for (const x of [200, 650]) mkEl("rect", { x, y: 1150, width: 90, height: 150, rx: 14, fill: "#161b22", stroke: C.fg2, "stroke-width": 5 }, g);
  mkEl("rect", { id: "rlLoadL", x: 212, width: 66, rx: 6, fill: "rgba(245,170,60,0.55)" }, g);
  mkEl("rect", { id: "rlLoadR", x: 662, width: 66, rx: 6, fill: "rgba(245,170,60,0.55)" }, g);
  mkEl("path", { id: "rlGrip", d: "M 190 1318 L 300 1318 M 640 1318 L 750 1318", stroke: C.ok, "stroke-width": 10, "stroke-linecap": "round", opacity: 0 }, g);
  const dot = mkEl("g", { id: "rlDot" }, g);
  mkEl("circle", { cx: 0, cy: 0, r: 22, fill: "rgba(10,14,19,0.9)", stroke: C.ok, "stroke-width": 6 }, dot);
  mkEl("path", { d: "M -22 0 L 22 0 M 0 -22 L 0 22", stroke: C.ok, "stroke-width": 4 }, dot);
  mkT("ŚRODEK CIĘŻKOŚCI", { x: 470, y: 1370, "text-anchor": "middle", style: "font-size:24px" }, g);
}
// skręcanie wału: długi wał R6 wije się bardziej niż krótki wał boksera
{
  const g = $("twG");
  [["R6 · długi wał", 700, 850, C.hot, "twA"], ["H6 · krótki wał", 1060, 470, C.ok, "twB"]].forEach(([lab, y, x1, col, id]) => {
    mkT(lab, { class: "sans", x: 90, y: y - 90, style: `font-size:48px;font-weight:600;fill:${col}` }, g);
    mkEl("rect", { x: 90, y: y - 26, width: x1 - 90, height: 52, rx: 26, fill: "rgba(150,165,182,0.12)", stroke: C.fg2, "stroke-width": 3 }, g);
    mkEl("path", { id, fill: "none", stroke: col, "stroke-width": 7, "stroke-linecap": "round" }, g);
  });
  mkEl("path", { id: "twRpm", d: "M 560 1060 A 110 110 0 1 1 780 1060", fill: "none", stroke: C.oil, "stroke-width": 10, "stroke-linecap": "round", opacity: 0 }, g);
  mkEl("path", { id: "twRpmA", d: "M 755 1015 L 780 1060 L 815 1030", fill: "none", stroke: C.oil, "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, g);
}
// chłodzenie powietrzem: lata, chłodnica przekreślona, wentylator i żebra
{
  const g = $("arG");
  const rad = mkEl("g", { id: "arRad" }, g);
  mkEl("rect", { x: 110, y: 820, width: 300, height: 240, rx: 12, fill: "rgba(150,165,182,0.08)", stroke: C.fg2, "stroke-width": 5 }, rad);
  for (let i = 1; i < 10; i++) mkEl("line", { x1: 110 + i * 30, x2: 110 + i * 30, y1: 830, y2: 1050, stroke: "rgba(150,165,182,0.45)", "stroke-width": 3 }, rad);
  mkT("CHŁODNICA", { x: 260, y: 1100, "text-anchor": "middle", style: "font-size:24px" }, rad);
  mkEl("path", { id: "arX", d: "M 95 805 L 425 1075 M 425 805 L 95 1075", stroke: C.hot, "stroke-width": 12, "stroke-linecap": "round", fill: "none" }, g);
  const fan = mkEl("g", { id: "arFan" }, g);
  mkEl("circle", { cx: 0, cy: 0, r: 150, fill: "rgba(124,196,255,0.08)", stroke: C.ice, "stroke-width": 5 }, fan);
  const bl = mkEl("g", { id: "arBl" }, fan);
  for (let i = 0; i < 9; i++) mkEl("path", { d: "M 0 -20 Q 60 -70 40 -135 Q 5 -120 -10 -22 Z", fill: "rgba(124,196,255,0.45)", stroke: C.ice, "stroke-width": 3, transform: `rotate(${i * 40})` }, bl);
  mkEl("circle", { cx: 0, cy: 0, r: 28, fill: "#161b22", stroke: C.ice, "stroke-width": 5 }, fan);
  mkT("WENTYLATOR", { x: 0, y: 200, "text-anchor": "middle", style: "font-size:24px" }, fan);
  const fin = mkEl("g", { id: "arFin" }, g);
  mkEl("rect", { x: 340, y: 1180, width: 260, height: 170, rx: 8, fill: "rgba(150,165,182,0.1)", stroke: C.fg2, "stroke-width": 4 }, fin);
  for (let i = 0; i < 8; i++) mkEl("rect", { "data-fin": i, x: 250, y: 1186 + i * 21, width: 440, height: 10, rx: 5, fill: C.oil }, fin);
  mkT("ŻEBRA NA CYLINDRZE", { x: 470, y: 1395, "text-anchor": "middle", style: "font-size:24px" }, fin);
}
// Le Mans: sześć zwycięstw z rzędu
{
  const g = $("lmG");
  for (let i = 0; i < 6; i++) {
    const cx = 250 + (i % 3) * 220, y = 600 + Math.floor(i / 3) * 330;
    const c = mkEl("g", { "data-cup": i, opacity: 0 }, g);
    mkEl("path", { d: `M ${cx - 55} ${y} L ${cx + 55} ${y} L ${cx + 48} ${y + 55} Q ${cx + 40} ${y + 100} ${cx} ${y + 106} Q ${cx - 40} ${y + 100} ${cx - 48} ${y + 55} Z`, fill: "rgba(245,170,60,0.35)", stroke: C.oil, "stroke-width": 5, "stroke-linejoin": "round" }, c);
    mkEl("path", { d: `M ${cx - 53} ${y + 14} Q ${cx - 90} ${y + 20} ${cx - 70} ${y + 56} M ${cx + 53} ${y + 14} Q ${cx + 90} ${y + 20} ${cx + 70} ${y + 56}`, fill: "none", stroke: C.oil, "stroke-width": 5 }, c);
    mkEl("rect", { x: cx - 9, y: y + 106, width: 18, height: 26, fill: C.oil }, c);
    mkEl("rect", { x: cx - 42, y: y + 132, width: 84, height: 18, rx: 4, fill: C.oil }, c);
    mkT(String(1982 + i), { x: cx, y: y + 198, "text-anchor": "middle", style: "font-size:36px;font-weight:600;fill:#eef2f7" }, c);
  }
}
// uczciwie: szeroki, ale nisko między kołami
{
  const g = $("bwG");
  mkEl("line", { x1: 60, x2: 880, y1: 1300, y2: 1300, stroke: C.fg2, "stroke-width": 4 }, g);
  mkEl("path", { d: "M 170 1150 L 170 980 Q 180 900 290 880 Q 470 800 650 880 Q 760 900 770 980 L 770 1150 Z", fill: "rgba(150,165,182,0.07)", stroke: C.fg2, "stroke-width": 5 }, g);
  for (const x of [120, 730]) mkEl("rect", { "data-wh": 1, x, y: 1100, width: 90, height: 200, rx: 14, fill: "#161b22", stroke: C.fg2, "stroke-width": 5 }, g);
  mkEl("rect", { id: "bwEng", x: 250, y: 1150, width: 440, height: 90, rx: 12, fill: "rgba(245,170,60,0.35)", stroke: C.oil, "stroke-width": 5 }, g);
  mkT("BOKSER", { x: 470, y: 1206, "text-anchor": "middle", class: "sans", style: "font-size:40px;font-weight:600;fill:#eef2f7" }, g);
  mkEl("path", { id: "bwArr", d: "M 240 1195 L 222 1195 M 700 1195 L 718 1195 M 232 1180 L 216 1195 L 232 1210 M 708 1180 L 724 1195 L 708 1210", stroke: C.ok, "stroke-width": 6, fill: "none", "stroke-linecap": "round", opacity: 0 }, g);
  const hi = mkEl("g", { id: "bwHi", opacity: 0 }, g);
  mkEl("path", { d: "M 330 830 L 400 690 L 540 690 L 610 830 Z", fill: "none", stroke: C.hot, "stroke-width": 5, "stroke-dasharray": "14 10" }, hi);
  mkT("WYSOKO", { x: 470, y: 780, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#ff6a4d" }, hi);
  mkEl("path", { d: "M 320 680 L 620 840", stroke: C.hot, "stroke-width": 8, "stroke-linecap": "round" }, hi);
}
// GT3: sześć cylindrów na płasko, po trzy naprzeciw siebie
{
  const g = $("spG");
  mkEl("rect", { x: 450, y: 960, width: 40, height: 420, rx: 20, fill: "rgba(150,165,182,0.12)", stroke: C.fg2, "stroke-width": 4 }, g);
  for (let i = 0; i < 6; i++) {
    const s2 = i < 3 ? 1 : -1, y = 1030 + (i % 3) * 140;
    const c = mkEl("g", { "data-sc": i, opacity: 0 }, g);
    mkEl("rect", { x: s2 > 0 ? 520 : 190, y: y - 50, width: 230, height: 100, rx: 14, fill: "rgba(245,170,60,0.25)", stroke: C.oil, "stroke-width": 5 }, c);
    mkEl("line", { x1: s2 > 0 ? 490 : 450, x2: s2 > 0 ? 520 : 420, y1: y, y2: y, stroke: C.fg2, "stroke-width": 6 }, c);
  }
}
// obrotomierz do 9000
{
  const g = $("rvG");
  const cx = 470, cy = 900, R = 300;
  const ang = (v) => (-225 + (v / 9000) * 270) * D2R;
  const arcD = (v0, v1, r) => { const a0 = ang(v0), a1 = ang(v1); return `M ${f1(cx + Math.cos(a0) * r)} ${f1(cy + Math.sin(a0) * r)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f1(cx + Math.cos(a1) * r)} ${f1(cy + Math.sin(a1) * r)}`; };
  mkEl("path", { d: arcD(0, 9000, R), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 14 }, g);
  mkEl("path", { d: arcD(8000, 9000, R), fill: "none", stroke: C.hot, "stroke-width": 14 }, g);
  mkEl("path", { id: "rvArc", d: arcD(0, 9000, R), fill: "none", stroke: C.oil, "stroke-width": 14 }, g);
  for (let v = 0; v <= 9; v++) {
    const a = ang(v * 1000);
    mkEl("line", { x1: f1(cx + Math.cos(a) * (R - 30)), y1: f1(cy + Math.sin(a) * (R - 30)), x2: f1(cx + Math.cos(a) * (R - 6)), y2: f1(cy + Math.sin(a) * (R - 6)), stroke: v >= 8 ? C.hot : C.fg2, "stroke-width": 5 }, g);
    mkT(String(v), { class: "sans", x: f1(cx + Math.cos(a) * (R - 75)), y: f1(cy + Math.sin(a) * (R - 75) + 16), "text-anchor": "middle", style: `font-size:46px;font-weight:600;fill:${v >= 8 ? C.hot : C.fg}` }, g);
  }
  mkT("× 1000 OBR/MIN", { x: cx, y: cy + 120, "text-anchor": "middle", style: "font-size:24px" }, g);
  mkEl("line", { id: "rvN", x1: cx, y1: cy, x2: cx, y2: cy - R + 40, stroke: C.fg, "stroke-width": 8, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx, cy, r: 20, fill: C.fg }, g);
  g.dataset.cx = cx; g.dataset.cy = cy;
}
const rvAng = (v) => (-225 + (v / 9000) * 270) * D2R;

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gOdd") {
    stepH($("odH"), t, [[10.09, "<em>Płaski</em>"], [10.53, "Płaski, <em>szeroki</em>"], [11.32, "Wsadzony za <em>tylną oś</em>"]]);
    const e = $("odEng"), k = easeOut(win(t, 10.15, 10.6)), sk = easeIO(win(t, 11.32, 12.1));
    e.setAttribute("transform", `translate(0 ${f1(lerp(1000, 1270, sk) + (1 - k) * 30)})`);
    e.setAttribute("opacity", f1(k));
    $("odW").setAttribute("opacity", f1(easeOut(win(t, 10.53, 10.9)) * (1 - easeIO(win(t, 11.32, 11.6)))));
    const ak = easeOut(win(t, 11.86, 12.2));
    $("odAxle").setAttribute("stroke", ak > 0.5 ? C.oil : C.fg2); $("odAxle").setAttribute("opacity", f1(0.6 + 0.4 * ak));
    $("odAxleT").setAttribute("opacity", f1(ak));
  } else if (id === "gOrder") {
    stepH($("orH"), t, [[24.61, "Kolejność <em>zapłonu</em>"]]);
    [...$("orG").querySelectorAll("[data-cyl]")].forEach((c) => {
      const cid = +c.dataset.cyl, i = ORDER_ID.indexOf(cid), a = ORDER_T[i];
      const on = easeOut(win(t, a - 0.05, a + 0.2)), now = orderGlow(t, i);
      popS(c, t, 24.7 + (cid - 1) * 0.08, 20);
      const circ = c.querySelector("circle"), tx = c.querySelector("text");
      circ.setAttribute("fill", `rgba(245,170,60,${(0.1 + 0.25 * on + 0.6 * now).toFixed(3)})`);
      circ.setAttribute("stroke", on > 0.05 ? C.oil : C.fg2);
      tx.setAttribute("style", `font-size:68px;font-weight:600;fill:${now > 0.5 ? "#1a1206" : "#eef2f7"}`);
    });
    [...$("orG").querySelectorAll("[data-arc]")].forEach((p) => { const i = +p.dataset.arc; dash(p, easeIO(win(t, ORDER_T[i] - 0.25, ORDER_T[i] + 0.05)), 900); });
  } else if (id === "gForces") {
    stepH($("frH"), t, [[34.18, "Jeden pcha <em>w lewo</em>"], [35.27, "Drugi <em>w prawo</em>"], [36.26, "Siły gaszą się <em>w parach</em>"], [37.81, "6 cylindrów gasi <em>momenty</em>"]]);
    FR.forEach((r, ri) => {
      const k = popS(r.g, t, r.at, 30);
      const ph = (t * 220 + r.ph) * D2R, off = 55 * Math.cos(ph), vel = -Math.sin(ph);
      r.L.setAttribute("x", f1(470 - 170 - off - 90)); r.L.setAttribute("y", r.y - 60);
      r.R.setAttribute("x", f1(470 + 170 + off)); r.R.setAttribute("y", r.y - 60);
      const aL = ri > 0 || t >= 34.18, aR = ri > 0 || t >= 35.27;
      const len = 70 * vel;
      const xl = 470 - 170 - off - 45, xr = 470 + 170 + off + 45;
      r.aL.setAttribute("d", aL && Math.abs(len) > 2 ? arrowX(xl, r.y - 95, xl - len, r.y - 95) : "");
      r.aR.setAttribute("d", aR && Math.abs(len) > 2 ? arrowX(xr, r.y - 95, xr + len, r.y - 95) : "");
      const aw = ri === 0 ? Math.max(easeOut(win(t, 34.18, 34.4)) * (t < 35.27 ? 1 : 1), 0) : k;
      r.aL.setAttribute("opacity", f1(aw)); r.aR.setAttribute("opacity", f1(ri === 0 ? easeOut(win(t, 35.27, 35.5)) : k));
      r.eq.setAttribute("opacity", f1(easeOut(win(t, ri === 0 ? 36.62 : 38.86, (ri === 0 ? 36.62 : 38.86) + 0.35))));
    });
    $("frM").setAttribute("opacity", f1(easeOut(win(t, 39.28, 39.6))));
  } else if (id === "gCoG") {
    stepH($("cgH"), t, [[48.53, "Leży <em>płasko</em>"], [49.78, "<em>Nisko</em> przy ziemi"], [50.95, "Najcięższa część <em>auta</em>"], [52.16, "Tuż nad <em>asfaltem</em>"]]);
    const hk = easeOut(win(t, 50.95, 51.3));
    $("cgEng").setAttribute("fill", `rgba(245,170,60,${(0.35 + 0.35 * hk).toFixed(3)})`);
    const dk = easeIO(win(t, 51.56, 52.4));
    const dot = $("cgDot");
    dot.setAttribute("opacity", f1(easeOut(win(t, 49.78, 50.1))));
    dot.setAttribute("transform", `translate(${f1(lerp(480, 790, dk))} ${f1(lerp(1080, 1120, dk))})`);
    $("cgLn").setAttribute("opacity", f1(easeOut(win(t, 52.57, 52.9))));
    $("cgT").setAttribute("opacity", f1(easeOut(win(t, 52.77, 53.1))));
  } else if (id === "gRoll") {
    stepH($("rlH"), t, [[53.7, "Mniej <em>przechyłów</em>"], [54.56, "Mniej przenoszenia <em>masy</em>"], [56.19, "Więcej <span class=\"ok\">przyczepności</span>"]]);
    const sway = 0.5 + 0.5 * Math.sin((t - 53.7) * 1.6 - 1.2);
    const hiK = easeOut(win(t, 53.75, 54.1));
    $("rlHigh").setAttribute("transform", `rotate(${f1(7 * sway)} 470 1180)`);
    $("rlHigh").setAttribute("opacity", f1(0.9 * hiK));
    $("rlLow").setAttribute("transform", `rotate(${f1(2.4 * sway)} 470 1180)`);
    const rad = 2.4 * sway * D2R;
    $("rlDot").setAttribute("transform", `translate(${f1(470 + Math.sin(rad) * 60)} ${f1(1120)})`);
    const mk = easeIO(win(t, 54.56, 55.4));
    const tr = lerp(0.8, 0.3, mk) * sway;
    const hl = 90 * (1 - tr), hr = 90 * (1 + tr);
    $("rlLoadL").setAttribute("y", f1(1290 - hl)); $("rlLoadL").setAttribute("height", f1(hl));
    $("rlLoadR").setAttribute("y", f1(1290 - hr)); $("rlLoadR").setAttribute("height", f1(hr));
    $("rlGrip").setAttribute("opacity", f1(easeOut(win(t, 56.19, 56.6))));
  } else if (id === "gTwist") {
    stepH($("twH"), t, [[67.1, "<em>Krótki</em> wał"], [67.63, "Prawie się <em>nie skręca</em>"], [68.7, "Wchodzi na <em>wysokie obroty</em>"]]);
    [["twA", 850, 700, 26, 67.2], ["twB", 470, 1060, 4, 67.63]].forEach(([idd, x1, y, amp, at]) => {
      const k = easeOut(win(t, at, at + 0.5));
      let d = "";
      for (let x = 90; x <= x1; x += 6) { const u = (x - 90) / (x1 - 90); d += (x === 90 ? "M " : " L ") + x + " " + f1(y + k * amp * u * Math.sin(u * 7 + t * 7)); }
      $(idd).setAttribute("d", d);
    });
    const rk = easeOut(win(t, 69.42, 69.8));
    $("twRpm").setAttribute("opacity", f1(rk)); $("twRpmA").setAttribute("opacity", f1(rk));
    $("twRpm").setAttribute("transform", `rotate(${f1((t - 69.4) * 140)} 670 1060)`); $("twRpmA").setAttribute("transform", `rotate(${f1((t - 69.4) * 140)} 670 1060)`);
  } else if (id === "gAir") {
    stepH($("arH"), t, [[82.2, "Przez <em>ponad 30 lat</em>"], [83.86, "Porsche <em>911</em>"], [85.01, "Obywało się <span class=\"hot\">bez chłodnicy</span>"], [86.62, "Wystarczył <em>wentylator</em>"], [87.95, "I <em>żebra</em> na cylindrach"]]);
    const n = Math.round(30 * easeIO(win(t, 82.5, 83.6)));
    const v = t >= 83.69 ? "30+" : String(n);
    if ($("arN").textContent !== v) $("arN").textContent = v;
    pop($("arN"), t, 82.3, 0.3, 30);
    pop($("arU"), t, 83.69, 0.3, 20);
    const radK = easeOut(win(t, 85.01, 85.4));
    $("arRad").setAttribute("opacity", f1(radK * (1 - 0.55 * easeOut(win(t, 86.62, 87.0)))));
    $("arX").setAttribute("opacity", f1(easeOut(win(t, 85.84, 86.1)) * (1 - 0.55 * easeOut(win(t, 86.62, 87.0)))));
    $("arX").style.strokeDasharray = 900; $("arX").style.strokeDashoffset = 900 * (1 - easeOut(win(t, 85.84, 86.2)));
    const fk = easeOut(win(t, 86.62, 87.0));
    $("arFan").setAttribute("opacity", f1(fk));
    $("arFan").setAttribute("transform", `translate(690 ${f1(940 + (1 - fk) * 30)})`);
    $("arBl").setAttribute("transform", `rotate(${f1(t * 260)})`);
    $("arFin").setAttribute("opacity", f1(easeOut(win(t, 87.95, 88.2))));
    [...$("arFin").querySelectorAll("[data-fin]")].forEach((f) => { const i = +f.dataset.fin, k = easeOut(win(t, 88.12 + i * 0.07, 88.42 + i * 0.07)); f.setAttribute("width", f1(440 * k)); f.setAttribute("x", f1(470 - 220 * k)); });
  } else if (id === "gRace") {
    stepH($("rcH"), t, [[90.79, "Płaskie szóstki"], [91.51, "Płaskie szóstki <em>z turbo</em>"]]);
    drawRows(RACE_ROWS, t);
  } else if (id === "gLeMans") {
    stepH($("lmH"), t, [[95.92, "<em>6 zwycięstw</em> z rzędu"], [98.12, "Od <em>1982</em> do <em>1987</em>"]]);
    [...$("lmG").querySelectorAll("[data-cup]")].forEach((c) => {
      const i = +c.dataset.cup;
      popS(c, t, 96.15 + i * 0.12, 36);
      c.querySelector("text").setAttribute("opacity", f1(easeOut(win(t, 98.28 + i * 0.45, 98.58 + i * 0.45))));
    });
  } else if (id === "gBetween") {
    stepH($("bwH"), t, [[109.77, "Szerokość leży <em>nisko</em>"], [111.51, "<em>Między kołami</em>"], [112.49, "A nie <span class=\"hot\">wysoko nad nimi</span>"]]);
    const wk = easeOut(win(t, 111.51, 111.9));
    [...$("bwG").querySelectorAll("[data-wh]")].forEach((w) => w.setAttribute("stroke", wk > 0.5 ? C.ok : C.fg2));
    $("bwArr").setAttribute("opacity", f1(wk));
    const hk = easeOut(win(t, 112.66, 113.0));
    $("bwHi").setAttribute("opacity", f1(hk));
    $("bwHi").setAttribute("transform", `translate(0 ${f1((1 - hk) * -30)})`);
  } else if (id === "gSpec") {
    const lk = Math.round(40 * easeIO(win(t, 117.95, 118.3)));
    const lt = (lk / 10).toFixed(1).replace(".", ",");
    if ($("spN").textContent !== lt) $("spN").textContent = lt;
    pop($("spN"), t, 117.92, 0.3, 30);
    pop($("spU"), t, 118.28, 0.3, 20);
    [...$("spC").children].forEach((c) => pop(c, t, +c.dataset.t, 0.25, 24));
    [...$("spG").querySelectorAll("[data-sc]")].forEach((c) => { const i = +c.dataset.sc; popS(c, t, 118.77 + (i % 3) * 0.12 + (i >= 3 ? 0.06 : 0), 24); });
  } else if (id === "gRev") {
    stepH($("rvH"), t, [[121.29, "Kręci się do"], [121.97, "<em>9000</em> obrotów"], [123.67, "I daje"]]);
    const rpm = 9000 * easeIO(win(t, 121.9, 123.0));
    const a = rvAng(rpm), cx = 470, cy = 900;
    $("rvN").setAttribute("x2", f1(cx + Math.cos(a) * 260)); $("rvN").setAttribute("y2", f1(cy + Math.sin(a) * 260));
    dash($("rvArc"), rpm / 9000, 1420);
    const hp = Math.round(510 * easeIO(win(t, 124.02, 124.8)));
    if ($("rvKm").textContent !== String(hp)) $("rvKm").textContent = String(hp);
    pop($("rvKm"), t, 123.9, 0.3, 30);
    pop($("rvKmU"), t, 124.7, 0.3, 20);
  }
}

/* ================= napisy w pierwszych 10 s ================= */
// słowo w słowo z transkrypcji, max 3 słowa i 17 znaków, kluczowe słowo na pomarańczowo, wejście płynne (bez skoku skali)
const CAP_END = 10.09;
const CAP_KEY = { bokser: "k", porsche: "k", najlepszy: "k", świecie: "k", końcu: "k", wolnossący: "k", dziewięciu: "k", tysięcy: "k", dziwactwo: "h" };
// grupy słów z assets/transcript.json (start pierwszego słowa)
const CAPS = [{"t0": 0.06, "w": ["Bokser", "Porsche"]}, {"t0": 0.87, "w": ["to", "najlepszy"]}, {"t0": 1.67, "w": ["silnik", "na", "świecie."]}, {"t0": 2.8, "w": ["Na", "końcu"]}, {"t0": 3.33, "w": ["zobaczysz,"]}, {"t0": 3.85, "w": ["który", "seryjny"]}, {"t0": 4.72, "w": ["wolnossący", "silnik"]}, {"t0": 5.77, "w": ["kręci", "się", "do"]}, {"t0": 6.46, "w": ["dziewięciu"]}, {"t0": 6.99, "w": ["tysięcy", "obrotów."]}, {"t0": 8.15, "w": ["Mówi", "się,"]}, {"t0": 8.7, "w": ["że", "bokser", "to"]}, {"t0": 9.43, "w": ["dziwactwo."]}];
for (let i = 0; i < CAPS.length; i++) CAPS[i].t2 = i + 1 < CAPS.length ? CAPS[i + 1].t0 : CAP_END;
function drawCaps(t) {
  const el = $("cap");
  const c = CAPS.find((x) => t >= x.t0 - 0.04 && t < x.t2);
  if (!c) { el.style.opacity = 0; return; }
  const html = c.w.map((x) => { const k = CAP_KEY[x.toLowerCase().replace(/[^a-ząćęłńóśźż]/g, "")]; return k ? `<span class="${k}">${x.replace(/[,.]$/, "")}</span>` : x.replace(/[,.]$/, ""); }).join(" ");
  if (el.innerHTML !== html) el.innerHTML = html;
  const k = easeOut(win(t, c.t0 - 0.04, c.t0 + 0.12));
  el.style.opacity = k;
  el.style.transform = `translate(-50%, ${f1((1 - k) * 22)}px)`;
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Cayman", "Subaru", "Carrera", "Turbo S", "GT4"];
const RN = RW.length, RROW = 50, ANS = "911 GT3", T_ANS = 117.3;
const BURSTS = [[2.9, 3.8, 3 * RN], [4.25, 4.9, 2 * RN], [28.3, 29.0, 2 * RN], [46.5, 47.2, 2 * RN], [62.5, 63.2, 2 * RN], [77.5, 78.2, 2 * RN], [89.3, 90.0, 2 * RN], [103.7, 104.4, 2 * RN], [114.0, 114.9, 2 * RN], [115.3, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 2.8, 119.6);
  rb.style.opacity = rOn ? (easeOut(win(t, 2.8, 3.1)) * (1 - easeIO(win(t, 119.2, 119.6)))).toFixed(3) : 0;
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
    const bigK = Math.max(
      easeOut(win(t, 2.8, 3.2)) * (1 - easeIO(win(t, 5.0, 5.42))),
      easeIO(win(t, 113.98, 114.4)) * (1 - easeIO(win(t, 117.6, 118.1))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 125.3, 128.35);
  sc.style.opacity = sOn ? (easeOut(win(t, 125.3, 125.7)) * (1 - easeIO(win(t, 127.95, 128.35)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 125.3, 125.8))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 128.41, 132.76);
  pc.style.opacity = pOn ? (easeOut(win(t, 128.41, 128.8)) * (1 - easeIO(win(t, 132.45, 132.76)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 128.41, 128.8))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 128.96 ? (t < 129.65 ? easeOut(win(t, 128.96, 129.16)) : 0.5) : 0;
    const gB = t > 129.65 ? easeOut(win(t, 129.65, 129.85)) : 0;
    on("pkA", Math.max(gA, t > 130.87 ? 0.5 + 0.5 * Math.sin((t - 130.87) * 3) : 0)); on("pkB", t > 130.87 ? 0.5 - 0.5 * Math.sin((t - 130.87) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 130.87, 131.2));
  }
  // dyskretna karta sklepu (skaner diagnostyczny), tylko obraz, bez zmiany lektora
  const sh = $("shop");
  // trzy różne teksty w kontekście lektora, strzałka w dół na koszyk (lewy dół, nad podpisem)
  const SHOP = [[57.5, 59.9, "Masz Subaru albo Porsche?", "Błędy przeczytasz z telefonu"], [86.4, 88.9, "Check engine?", "Sprawdź, zanim pojedziesz do serwisu"], [105.4, 108.2, "Drogi serwis?", "Sprawdź błąd, zanim zapłacisz"]];
  const sw = SHOP.find(([a, b]) => t >= a && t < b);
  if (sw && $("shA").textContent !== sw[2]) { $("shA").textContent = sw[2]; $("shB").textContent = sw[3]; }
  sh.style.opacity = sw ? (easeOut(win(t, sw[0], sw[0] + 0.4)) * (1 - easeIO(win(t, sw[1] - 0.35, sw[1])))).toFixed(3) : 0;
  if (sw) sh.style.transform = "translateY(" + ((1 - easeOut(win(t, sw[0], sw[0] + 0.45))) * 24).toFixed(1) + "px)";
  const yc = $("ytCard");
  const yOn = inR(t, 132.9, 141.5);
  yc.style.opacity = yOn ? (easeOut(win(t, 132.9, 133.3)) * (1 - easeIO(win(t, 141.2, 141.5)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 132.9, 133.4))) * -60).toFixed(1) + "px)";
}

/* ================= render klatki ================= */
const SPLIT_UI = {
  lenSplit: { pills: [[41.91, "Idealnie wyważony"], [45.25, "O połowę krótszy"]], a: ["R6", "wyważona", "ok", 43.24], b: ["H6", "wyważony", "ok", 42.43] },
  cogSplit: { pills: [[61.74, "Tak nisko"]], a: ["V6", "wyżej", "hot", 60.3], b: ["H6", "nisko", "ok", 61.74] },
};

// plansza i 3D przenikają się przez 0,4 s zamiast twardego cięcia
const XF = 0.4;
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawCaps(t);
  drawEng(t);
  const si = shotIdx(t), [s0, , kind, name] = SHOTS[si], prev = SHOTS[si - 1];
  const fresh = prev && prev[2] !== kind && t - s0 < XF;
  let boardK = 0, boardName = null, si3 = -1;
  if (kind === "board") { boardName = name; boardK = fresh ? easeIO((t - s0) / XF) : 1; if (fresh) si3 = si - 1; }
  else { si3 = si; if (fresh) { boardName = prev[3]; boardK = 1 - easeIO((t - s0) / XF); } }
  bd.style.opacity = boardK.toFixed(3);
  if (boardName) drawBoard(t, boardName);
  const on3d = si3 >= 0;
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (on3d) render3D(t, si3);
}
function render3D(t, si) {
  const [s0, , , name] = SHOTS[si];
  const deg = crankAt(t);
  const split = SPLIT.has(name);
  const A = states(t, name, "A");
  poseH(A.s, deg);
  pose6(A.s, deg);
  poseV(deg);
  applyCam(t, split ? name + "A" : name, camera, si);
  // kamera panelu B ustawiona od razu, bo nakładki SVG (wymiary, środek ciężkości) rzutują przez nią jeszcze przed renderem panelu
  if (split) applyCam(t, name + "B", cameraB, si);
  lightAt(A.base, camera);
  projCam = camera;

  show($("hk"), SHOTS[si][1] <= 2.9 || name === "outro");
  // tytuł hooka mówią teraz napisy, zostaje tylko kicker serii (tak samo na końcu pętli)
  $("hkH").style.opacity = 0; $("hkS").style.opacity = 0;
  shadeBot.style.opacity = split ? 0.25 : 1;
  drawTop(t, si);
  drawDial(name === "fire", deg, easeOut(win(t, s0, s0 + 0.4)));
  // numery cylindrów
  const bOn = name === "anatomy";
  badges.forEach(({ el, c }, i) => {
    if (!bOn) { el.style.opacity = 0; return; }
    const p = localPoint(EH.root, c.bankSign * 400, 170, c.z);
    place(el, p.x, p.y);
    const at = c.bank === "A" ? 17.52 : 17.95;
    const k = easeOut(win(t, at + c.slot * 0.1, at + c.slot * 0.1 + 0.3));
    el.style.opacity = k;
    el.style.transform = "translateY(" + f1((1 - k) * 16) + "px)";
  });
  // licznik lat
  const revOn = name === "revs";
  if (revOn) {
    $("cnt").style.opacity = easeOut(win(t, 6.46, 6.7));
    const v = fmtN(Math.round(9000 * easeIO(win(t, 6.5, 7.45)) / 10) * 10);
    if ($("cntN").textContent !== v) $("cntN").textContent = v;
    if ($("cntL").innerHTML !== "<b>obr/min</b>bez turbo") $("cntL").innerHTML = "<b>obr/min</b>bez turbo";
  }
  const cntOn = name === "hero" && t >= 14.09;
  if (!revOn) $("cnt").style.opacity = cntOn ? easeOut(win(t, 14.09, 14.49)) : 0;
  if (cntOn) {
    const n = Math.round(60 * easeIO(win(t, 14.09, 14.75)));
    const v = t >= 14.77 ? "60+" : String(n);
    if ($("cntN").textContent !== v) $("cntN").textContent = v;
    if ($("cntL").innerHTML !== "<b>lat</b>ciągle bokser") $("cntL").innerHTML = "<b>lat</b>ciągle bokser";
  }

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const su = SPLIT_UI[name];
  const pill = $("splitPill");
  const setPl = (el, [b, st, cls, at]) => {
    const bb = el.querySelector("b"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
    pop(el, t, at, 0.25, 20);
  };
  if (split) {
    let cur = su.pills[0];
    for (const x of su.pills) if (t >= x[0]) cur = x;
    if (pill.textContent !== cur[1]) pill.textContent = cur[1];
    pill.style.opacity = easeOut(win(t, cur[0], cur[0] + 0.4));
    setPl($("pA"), su.a); setPl($("pB"), su.b);
  } else { pill.style.opacity = 0; $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawOpp(t, name, deg);
  drawDims(t, name);
  drawCog(t, name);
  drawAir(t, name);

  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - SEAM, W, SEAM);
  composer.render();
  const Bs = states(t, name, "B");
  poseH(Bs.s, deg);
  applyCam(t, name + "B", cameraB, si);
  lightAt(Bs.base, cameraB);
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - SEAM);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { EH, E6, EV, camera, cameraB, composer, scene, SHOTS, KH, boxH, box6, boxV };
