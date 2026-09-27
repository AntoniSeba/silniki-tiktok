// Rozgrzewając silnik na postoju, zabijasz go. Bohater: Audi 2.2 T R5 (projekty/audi-22t-engine),
// do callbacku panewka z filmu o 1200 obrotach. Hook i pętla: plansza na b-rollu (jak "1200 obrotów").
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia, bez pompowania.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/r5-audi/lib/materials.js";
import { buildStudioEnvironment } from "../model/r5-audi/lib/environment.js";
import { buildEngine as build5 } from "../model/r5-audi/scene.js";
import * as K5 from "../model/r5-audi/lib/kinematics.js";
import { buildBearing, CLEAR } from "./bearing.js";

const W = 1080, H = 1920, D = 173.06;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const easeIn = (x) => { x = clamp01(x); return x * x * x; };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const frac = (x) => x - Math.floor(x);
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
const mmss = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* ================= ujęcia ================= */
// plate = plansza na b-rollu (hook i pętla), broll = wideo z napisami, 3d = scena, board = plansza graficzna
const SHOTS = [
  [0, 4.66, "plate", "hook"], [4.66, 6.9, "broll", "osiedle"], [6.9, 9.5, "3d", "promise"], [9.5, 13.25, "3d", "promise2"],
  [13.25, 15.43, "3d", "kontra"], [15.43, 17.02, "broll", "mech"], [17.02, 19.99, "board", "gSay"], [19.99, 27.78, "board", "gManual"],
  [27.78, 30.5, "3d", "who"], [30.5, 32.0, "3d", "cold"], [32.0, 34.91, "board", "gFunnel"], [34.91, 38.92, "3d", "coldcyl"],
  [38.92, 41.5, "board", "gWall"], [41.5, 43.16, "3d", "p1"], [43.16, 49.7, "board", "gWall"], [49.7, 52.38, "3d", "rings"],
  [52.38, 59.85, "board", "gWear"], [59.85, 61.52, "3d", "p2"], [61.52, 67.15, "3d", "drops"], [67.15, 73.93, "board", "gMix"],
  [73.93, 76.26, "board", "gMayo"], [76.26, 80.92, "3d", "bear"], [80.92, 82.54, "3d", "p3"], [82.54, 86.18, "3d", "idle"],
  [86.18, 92.56, "board", "gTemp"], [92.56, 100.61, "board", "gGauge"], [100.61, 102.44, "3d", "p4"], [102.44, 106.07, "3d", "dieselIdle"],
  [106.07, 109.84, "board", "gKwad"], [109.84, 112.26, "broll", "soot"], [112.26, 119.16, "board", "gDpf"], [119.16, 121.89, "3d", "honest"],
  [121.89, 124.53, "3d", "oilpath"], [124.53, 128.65, "board", "g30"], [128.65, 134.9, "board", "gTach"], [134.9, 137.8, "3d", "notTen"],
  [137.8, 139.13, "3d", "promised"], [139.13, 143.03, "board", "gPostoj"], [143.03, 146.93, "board", "gSign"], [146.93, 149.2, "broll", "scrape"],
  [149.2, 152.72, "3d", "answer"], [152.72, 156.34, "board", "gRcpt"], [156.34, 158.25, "3d", "pickA"], [158.25, 162.5, "3d", "pickB"],
  [162.5, 171.85, "3d", "yt"], [171.85, D + 1, "plate", "outro"],
];
const shotIdx = (t) => { for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) return i; return SHOTS.length - 1; };
const shotAt = (t) => SHOTS[shotIdx(t)];

// wał kręci się cały czas tym samym, spokojnym tempem; D mieści całkowitą liczbę cykli 720°, więc pętla się domyka
const CRANK_RATE = (720 * Math.round((D * 130) / 720)) / D;
const crankAt = (t) => t * CRANK_RATE;
const TB_RATE = (360 * Math.round(2 * D)) / D;

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
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
// światło kluczowe zawsze po stronie kamery, żeby przód silnika nie był pod światło
function lightAt(b, cam) {
  const sx = cam.position.x >= b.x ? 1 : -1, sz = cam.position.z >= b.z ? 1 : -1;
  key.position.set(b.x + sx * 1400, b.y + 2100, b.z + sz * 1600); key.target.position.copy(b);
  fill.position.set(b.x - sx * 1700, b.y + 800, b.z + sz * 1200); fill.target.position.copy(b);
  rim.position.set(b.x - sx * 600, b.y + 1300, b.z - sz * 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), ICE = new THREE.Color(0x3aa0ff);
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
const addMat = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

/* ================= Audi R5 ================= */
// silnik obrócony tak, żeby wał leżał wzdłuż X: przód (+Z modelu) na -X, wydech (+X modelu) na +Z
const M5 = createMaterials();
for (const k of Object.keys(M5)) { const m = M5[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E5 = build5(M5);
applyMaterialVariation(E5.root, M5);
fixNormals(E5.root);
shadows(E5.root);
const R5H = new THREE.Group(); R5H.rotation.y = -Math.PI / 2; R5H.add(E5.root);
const R5W = new THREE.Group(); R5W.add(R5H); scene.add(R5W);
const crank5 = E5.rotating.crank;
const cyl5 = (id) => E5.rotating.cylinders.find((c) => c.def.id === id);
const CYLS = K5.CYLINDERS;
const DECK = K5.LAYOUT.deckHeight, BORE_R = K5.SPEC.bore / 2;
const pist5 = CYLS.map((c) => glowMats(cyl5(c.id).piston, RED));
const exh5 = glowMats(E5.accessories.groups.exhaust, RED);
const cams5 = glowMats(E5.head.groups.cams, AMBER);
const chra5 = glowMats(E5.turbo.groups.chra, AMBER);
const pistonsRoot5 = E5.rotating.root.getObjectByName("PISTONS_AND_RODS");
const fireAt5 = (c) => wrap(c.cycleOffset + 360, 720);
const flash5 = CYLS.map((c) => {
  const mat = addMat(0xff8a2a);
  const m = new THREE.Mesh(new THREE.SphereGeometry(44, 24, 16), mat);
  m.position.set(0, DECK - 16, c.z);
  m.scale.set(1, 0.6, 1);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
// zimne ścianki cylindrów: cienka lodowa tuleja w otworze
const iceMat = addMat(0x3aa0ff);
iceMat.side = THREE.DoubleSide;
const iceWalls = CYLS.map((c) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 1.2, BORE_R - 1.2, 150, 44, 1, true), iceMat);
  m.position.set(0, DECK - 75, c.z);
  m.visible = false;
  E5.root.add(m);
  return m;
});
// wtrysk: stożek mgły paliwa w suwie ssania
const spray5 = CYLS.map((c) => {
  const mat = addMat(0xffd54a);
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(new THREE.ConeGeometry(36, 110, 28, 1, true), mat);
  m.position.set(0, DECK - 58, c.z);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
// paliwo osiadłe na ściankach
const wetMat = addMat(0xffc830);
const wetBeads = [];
CYLS.forEach((c, ci) => {
  for (let i = 0; i < 16; i++) {
    const a = hash(ci * 31 + i) * Math.PI * 2, y = DECK - 18 - hash(ci * 17 + i * 3) * 125;
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.4 + hash(i * 7 + ci) * 2, 10, 8), wetMat);
    m.position.set(Math.cos(a) * (BORE_R - 3), y, c.z + Math.sin(a) * (BORE_R - 3));
    m.scale.set(1, 1.6, 1);
    m.visible = false;
    E5.root.add(m);
    wetBeads.push({ m, ci, a, y });
  }
});
// krople spływające do miski: paliwo (żółte) i woda (niebieska)
const box5 = (() => { E5.update(0); R5W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(E5.root); })();
const SUMP_Y = (() => { R5W.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(E5.block.groups.sump); return E5.root.worldToLocal(new THREE.Vector3(0, b.min.y + 0.35 * (b.max.y - b.min.y), 0)).y; })();
const dropsF = [], dropsW = [];
const dropF = addMat(0xffd23a), dropW = addMat(0x5ab4ff);
for (let i = 0; i < 40; i++) {
  const isW = i >= 22;
  const m = new THREE.Mesh(new THREE.SphereGeometry(isW ? 10 : 9, 14, 12), isW ? dropW : dropF);
  m.scale.set(1, 1.7, 1);
  m.visible = false;
  E5.root.add(m);
  (isW ? dropsW : dropsF).push({ m, i, c: CYLS[i % 5], dx: (hash(i * 9.1) - 0.5) * 60, dz: (hash(i * 4.3) - 0.5) * 40, sp: 0.55 + hash(i * 2.7) * 0.35, ph: hash(i * 5.9) });
}
const sumpOil = new THREE.Mesh(new THREE.BoxGeometry(170, 6, 430), addMat(0xff9a2a));
sumpOil.position.set(0, SUMP_Y, 0);
sumpOil.visible = false;
E5.root.add(sumpOil);
// rozkład kaskadą: góra silnika rusza pierwsza
const EX5 = E5.explode.map((x, i) => ({ ...x, k: clamp01(0.5 - x.delta.y / 900 + hash(i) * 0.2) }));
// żar zapłonu: łagodnie narasta przez 30° i gaśnie przez 150°, bez błysku
const softFire = (x) => (x < 30 ? easeIO(x / 30) : x < 180 ? 1 - easeIO((x - 30) / 150) : 0);
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const CORE5 = [E5.head.groups.covers, E5.accessories.root, E5.turbo.root, E5.block.groups.timingCover, E5.block.groups.filter].filter(Boolean);
const worldCenter = (o) => { R5W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); };
const TURBO_C = worldCenter(E5.turbo.root);
const CAMS_C = worldCenter(E5.head.groups.cams);
const SUMP_C = worldCenter(E5.block.groups.sump);
// szron: odlewy dostają zimną poświatę (wspólne materiały, więc przezroczystość zostaje)
const FROST = [M5.ironCast, M5.ironDark, M5.ironCrankcase, M5.aluCast, M5.camCover].filter(Boolean).map((m) => ({ m, e: m.emissive.clone(), k: m.emissiveIntensity }));
function setFrost(k) {
  FROST.forEach((f) => {
    if (k > 0.001) { f.m.emissive.setHex(0x8cc4ff); f.m.emissiveIntensity = 0.075 * k; }
    else { f.m.emissive.copy(f.e); f.m.emissiveIntensity = f.k; }
  });
}

/* ================= panewka (callback), stanowisko 80 m niżej ================= */
const BP = new THREE.Vector3(0, -80000, 0);
const bear = buildBearing();
bear.group.position.copy(BP);
bear.group.scale.setScalar(100);
bear.group.visible = false;
scene.add(bear.group);

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
// az = 0: od tyłu (+X), SIDE: od strony wydechu (+Z), -SIDE: od strony dolotu
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const PB = (az, el, r, x, y, z, fov, oy) => P(az, el, r, BP.x + x, BP.y + y, BP.z + z, fov, oy);
const SIDE = Math.PI / 2, FR = Math.PI / 2;
const CAM = {
  promise: [[6.9, P(1.1, 0.3, 5400, 0, 220, 0, 32, -190)], [9.5, P(0.8, 0.26, 5400, 0, 220, 0, 32, -190)]],
  promise2: [[9.5, P(-0.9, 0.3, 4400, 0, 170, 0, 32, -110)], [13.25, P(-1.4, 0.22, 4400, 0, 170, 0, 32, -110)]],
  kontra: [[13.25, P(2.5, 0.16, 3400, 0, 110, 0, 32, 60)], [15.43, P(2.15, 0.22, 3400, 0, 110, 0, 32, 60)]],
  who: [[27.78, P(-2.5, 0.12, 3300, 0, 110, 0, 32, 60)], [30.5, P(-2.1, 0.17, 3300, 0, 110, 0, 32, 60)]],
  cold: [[30.5, P(0.55, 0.32, 3300, 0, 110, 0, 32, 60)], [32.0, P(0.35, 0.27, 3300, 0, 110, 0, 32, 60)]],
  coldcyl: [[34.91, P(SIDE + 0.4, 0.36, 3000, 0, 120, 0, 32, -20)], [38.92, P(SIDE + 0.05, 0.28, 3000, 0, 120, 0, 32, -20)]],
  p1: [[41.5, P(-SIDE - 0.45, 0.24, 3300, 0, 110, 0, 32, 60)], [43.16, P(-SIDE - 0.2, 0.2, 3300, 0, 110, 0, 32, 60)]],
  rings: [[49.7, P(SIDE - 0.35, 0.3, 2400, 0, 150, 0, 32, 20)], [52.38, P(SIDE - 0.1, 0.24, 2400, 0, 150, 0, 32, 20)]],
  p2: [[59.85, P(2.3, -0.06, 3300, 0, 30, 0, 32, 40)], [61.52, P(2.05, -0.02, 3300, 0, 30, 0, 32, 40)]],
  drops: [[61.52, P(SIDE + 0.3, 0.12, 3100, 0, 0, 0, 32, -40)], [67.15, P(SIDE - 0.4, 0.2, 3100, 0, 0, 0, 32, -40)]],
  bear: [[76.26, PB(FR + 0.3, 0.12, 2500, 0, -40, 0, 32, 20)], [80.92, PB(FR - 0.12, 0.05, 2500, 0, -40, 0, 32, 20)]],
  p3: [[80.92, P(0.95, 0.36, 3100, 0, 110, 0, 32, 60)], [82.54, P(0.72, 0.3, 3100, 0, 110, 0, 32, 60)]],
  idle: [[82.54, P(-0.55, 0.2, 3400, 0, 110, 0, 32, 130)], [86.18, P(-0.95, 0.15, 3400, 0, 110, 0, 32, 130)]],
  p4: [[100.61, P(2.95, 0.22, 3300, 0, 110, 0, 32, 60)], [102.44, P(2.65, 0.18, 3300, 0, 110, 0, 32, 60)]],
  dieselIdle: [[102.44, P(SIDE + 0.55, 0.2, 3000, 0, 110, 0, 32, 60)], [106.07, P(SIDE + 0.15, 0.14, 3000, 0, 110, 0, 32, 60)]],
  honest: [[119.16, P(-2.2, 0.2, 3400, 0, 110, 0, 32, 60)], [121.89, P(-1.9, 0.25, 3400, 0, 110, 0, 32, 60)]],
  oilpath: [[121.89, P(SIDE - 0.75, 0.55, 3200, 0, 170, 0, 32, 60)], [124.53, P(SIDE - 0.45, 0.48, 3200, 0, 170, 0, 32, 60)]],
  notTen: [[134.9, P(-0.35, 0.26, 3300, 0, 110, 0, 32, 60)], [137.8, P(-0.75, 0.2, 3300, 0, 110, 0, 32, 60)]],
  promised: [[137.8, P(0.95, 0.3, 3700, 0, 110, 0, 32, -60)], [139.13, P(0.75, 0.25, 3700, 0, 110, 0, 32, -60)]],
  answer: [[149.2, P(-0.6, 0.13, 3300, 0, 110, 0, 32, -60)], [152.72, P(-0.25, 0.1, 3300, 0, 110, 0, 32, -60)]],
  pickA: [[156.34, P(0.9, 0.22, 3400, 0, 110, 0, 32, 280)], [158.25, P(0.75, 0.2, 3400, 0, 110, 0, 32, 280)]],
  pickB: [[158.25, P(-0.9, 0.22, 3400, 0, 110, 0, 32, 280)], [162.5, P(-1.25, 0.18, 3400, 0, 110, 0, 32, 280)]],
  yt: [[162.5, P(1.3, 0.26, 6900, 0, 250, 0, 32, 330)], [171.85, P(-0.4, 0.3, 6900, 0, 250, 0, 32, 330)]],
};
// bez pompowania: w obrębie ujęcia kamera krąży w stałej odległości, nigdy nie przybliża i nie oddala
for (const name in CAM) { const r = CAM[name][CAM[name].length - 1][1].r; CAM[name] = CAM[name].map(([tk, k]) => [tk, { ...k, r }]); }
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam, si) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  // po cięciu miękkie osiadanie tylko w azymucie
  const cut = 1 - easeIO(win(t, SHOTS[si][0], SHOTS[si][0] + 1.1));
  v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.07 * cut;
  v.az += 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += 0.004 * Math.sin(t * 0.53);
  camTgt.set(v.x, v.y, v.z);
  const r = v.r;
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silnika ================= */
const blank = () => ({ e: 0, g: 0, core: 0, noCovers: 0, fire: 0, frost: 0, ice: 0, spray: 0, wet: 0, dropF: 0, dropW: 0, sump: 0, ring: 0, oil: 0, exh: 0, bear: 0 });
function states(t, name) {
  const s = blank();
  switch (name) {
    case "promise": s.e = 0.75; break;
    case "promise2": s.e = 0.75 * (1 - easeIO(win(t, 9.5, 11.8))); break;
    case "kontra": case "who": case "honest": case "promised": case "answer": case "pickA": case "p3": s.fire = 1; break;
    case "cold": s.frost = easeOut(win(t, 30.5, 31.0)); break;
    case "coldcyl":
      s.g = 1; s.core = 1; s.frost = 0.6; s.fire = 0.6;
      s.ice = easeOut(win(t, 35.0, 35.6)) * (1 - 0.35 * easeIO(win(t, 37.7, 38.3)));
      s.spray = easeOut(win(t, 37.69, 38.0));
      break;
    case "p1": s.g = 1; s.core = 1; s.spray = 1; s.fire = 0.5; break;
    case "rings": s.g = 1; s.core = 1; s.fire = 0.5; s.wet = 0.8; s.ring = 0.55 * easeOut(win(t, 50.24, 50.7)) * (0.8 + 0.2 * Math.sin(t * 5)); break;
    case "p2": break;
    case "drops":
      s.g = 1; s.core = 1; s.sump = 1;
      s.dropF = easeOut(win(t, 61.6, 62.4));
      s.dropW = easeOut(win(t, 65.36, 65.9));
      break;
    case "bear": s.bear = 1; break;
    case "idle": s.fire = 1; break;
    case "p4": s.fire = 1; break;
    case "dieselIdle": s.g = 1; s.core = 1; s.fire = 0.3; s.frost = 0.35 * easeOut(win(t, 104.56, 105.2)); break;
    case "oilpath": s.noCovers = 1; s.oil = easeOut(win(t, 122.3, 122.9)); break;
    case "notTen": s.fire = 1; break;
    case "pickB": s.g = 1; s.core = 1; s.fire = 1; break;
    case "yt": s.e = easeIO(win(t, 163.0, 170.6)); break;
  }
  return s;
}

function pose5(st, deg, t) {
  E5.update(deg, { turboDeg: t * TB_RATE, boost: 0.5 });
  for (const x of EX5) x.obj.position.copy(x.rest).addScaledVector(x.delta, st.e > 0 ? stag(st.e, x.k) : 0);
  CORE5.forEach((o) => { o.visible = !st.core; });
  if (st.noCovers) E5.head.groups.covers.visible = false;
  setCasingGhost(M5, st.g);
  setFrost(st.frost);
  pist5.forEach((mats) => setGlow(mats, st.ring, RED));
  setGlow(exh5, st.exh, RED);
  setGlow(cams5, st.oil * 0.9, AMBER);
  setGlow(chra5, st.oil * 0.9, AMBER);
  const cm = wrap(deg, 720);
  flash5.forEach((f) => {
    const k = st.fire && st.g ? softFire(wrap(cm - fireAt5(f.c), 720)) * st.fire : 0;
    f.m.visible = k > 0.01;
    f.mat.opacity = 0.45 * k;
    f.mat.color.setRGB(1.3, 0.55, 0.16);
  });
  iceMat.opacity = 0.32 * st.ice;
  iceWalls.forEach((m) => { m.visible = st.ice > 0.01; });
  spray5.forEach((s) => {
    const ph = K5.cycleAngle(s.c, deg);
    const k = st.spray > 0 && ph < 300 ? Math.pow(Math.sin(Math.PI * clamp01(ph / 300)), 0.6) : 0;
    s.m.visible = k * st.spray > 0.01;
    s.mat.opacity = 0.85 * k * st.spray;
  });
  wetMat.opacity = 0.9 * st.wet;
  wetBeads.forEach((b) => { b.m.visible = st.wet > 0.01; });
  // krople: pozycja z czasu, każda w swoim rytmie
  const y0 = 40, y1 = SUMP_Y + 6;
  const drop = (d, amt) => {
    const p = frac(t * d.sp * 0.5 + d.ph);
    const y = lerp(y0, y1, p * p);
    d.m.position.set(d.dx * 0.6, y, d.c.z + d.dz);
    d.m.visible = amt > 0.01;
  };
  dropsF.forEach((d) => drop(d, st.dropF));
  dropsW.forEach((d) => drop(d, st.dropW));
  dropF.opacity = 0.95 * st.dropF;
  dropW.opacity = 0.95 * st.dropW;
  sumpOil.visible = st.sump > 0.01;
  sumpOil.material.opacity = 0.34 * st.sump;
  R5W.updateMatrixWorld(true);
}
// panewka: rozrzedzony olej, poduszka cienieje
function poseBear(t) {
  const e = lerp(0.1, CLEAR - 0.045, easeIO(win(t, 77.72, 78.9)));
  bear.setState({ ang: t * 2.4, e, fill: 1, glow: 0, oilGlow: 0.2 });
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
let projCam = camera;
const _pv = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur * 1.6));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px)";
  return k;
};
const popS = (el, t, at, dy = 30) => { const k = easeOut(win(t, at, at + 0.4)); el.setAttribute("opacity", k.toFixed(3)); el.setAttribute("transform", `translate(0 ${f1((1 - k) * dy)})`); return k; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const mkT = (txt, attrs, parent) => { const e = mkEl("text", attrs, parent); e.textContent = txt; return e; };
const dash = (el, k, L = 1600) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
const stepH = (el, t, list) => { let cur = list[0]; for (const x of list) if (t >= x[0]) cur = x; setH(el, cur[1], t, cur[0]); };
const op = (el, k) => el.setAttribute("opacity", clamp01(k).toFixed(3));
const polar = (cx, cy, r, a) => [cx + Math.cos(a * D2R) * r, cy + Math.sin(a * D2R) * r];
function arcD(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f1(x1)} ${f1(y1)}`;
}

// etykiety z linią
const TAGS = [
  { t0: 63.62, t1: 67.15, text: "Miska olejowa", a: () => SUMP_C, off: [-230, 250], c: "oil", shot: "drops" },
  { t0: 123.12, t1: 124.53, text: "Wałki", a: () => CAMS_C, off: [-200, -230], c: "oil", shot: "oilpath" },
  { t0: 123.92, t1: 124.53, text: "Turbo", a: () => TURBO_C, off: [170, 260], c: "oil", shot: "oilpath" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = { hot: "#e2492b", ice: "#7cc4ff" }[tg.c] || "#f5aa3c";
  tg.line = mkEl("path", { fill: "none", stroke: col, "stroke-width": 2.5 }, $("tagLines"));
  tg.dot = mkEl("circle", { r: 7, fill: col }, $("tagLines"));
});
function drawTags(t, name) {
  for (const tg of TAGS) {
    const on = tg.shot === name && inR(t, tg.t0, tg.t1 + 0.18);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    const p = project(tg.a());
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    y = Math.max(560, Math.min(1400, y));
    x = Math.max(200, Math.min(y > 1000 ? 700 : 880, x));
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

/* ================= górny blok ================= */
const TOPS = [
  [9.5, "Na końcu zobaczysz", "Ile <em>może cię kosztować</em>"],
  [10.2, "Na końcu zobaczysz", "Druga <em>minuta</em> rozgrzewania"],
  [12.06, "I nie chodzi", "Nie <em>o paliwo</em>"],
  [13.28, "Tylko że", "Każdy..."],
  [14.51, "Tylko że", "Każdy <em>tata</em>"],
  [27.78, "Więc", "Kto ma <em>rację</em>?"],
  [29.1, "Więc kto ma rację", "<em>Tata</em> czy <em>fabryka</em>?"],
  [30.5, "Rano", "Zimny <span class=\"ice\">start</span>"],
  [31.32, "Zimny start", "Na <span class=\"ice\">mrozie</span>"],
  [34.91, "Zimny start", "Ścianki cylindrów"],
  [36.16, "Ścianki cylindrów", "Są <span class=\"ice\">lodowate</span>"],
  [37.69, "Komputer", "Leje <em>więcej paliwa</em>"],
  [41.52, "Powód 1", "<em>Paliwo</em>"],
  [49.7, "Powód 1 · paliwo", "Pierścienie <span class=\"hot\">trą</span>"],
  [51.35, "Pierścienie trą", "Prawie <span class=\"hot\">na sucho</span>"],
  [59.87, "Powód 2", "<em>Olej</em>"],
  [61.52, "Powód 2 · olej", "Część <em>benzyny</em>"],
  [62.32, "Część benzyny", "Spływa <em>do miski</em>"],
  [64.36, "Do tego", "W <span class=\"ice\">zimnym silniku</span>"],
  [65.36, "W zimnym silniku", "Skrapla się <span class=\"ice\">woda</span>"],
  [76.46, "Poduszka olejowa", "<em>Rozrzedzony</em> olej"],
  [77.72, "Rozrzedzony olej", "To <em>cieńsza poduszka</em>"],
  [78.66, "Cieńsza poduszka", "Na <em>panewkach</em>"],
  [80.94, "Powód 3", "<em>Czas</em>"],
  [82.54, "Powód 3 · czas", "Na <em>jałowym</em>"],
  [84.24, "Na jałowym", "Prawie <em>bez obciążenia</em>"],
  [100.63, "Powód 4", "<em>Diesel</em>"],
  [102.44, "Diesel", "Jest tak <em>oszczędny</em>"],
  [104.56, "Na jałowym", "Daje <span class=\"ice\">jeszcze mniej ciepła</span>"],
  [119.16, "Żeby było jasne", "<em>Uczciwie?</em>"],
  [119.94, "Uczciwie", "Chwilę silnik <em>jednak potrzebuje</em>"],
  [121.89, "Chwilę po starcie", "Olej musi <em>dotrzeć</em>"],
  [134.9, "Uczciwie", "Ale <span class=\"ok\">30 sekund</span>"],
  [136.43, "Ale 30 sekund", "A nie <span class=\"hot\">10 minut</span>"],
];
// przy obietnicy i odpowiedzi mówi bęben, od karty wyboru mówią karty, więc górny blok milczy
const TOP_OFF = new Set(["promise", "promised", "answer", "pickA", "pickB", "yt"]);
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  const nm = SHOTS[si][3];
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0] && x[0] >= SHOTS[si][0] - 0.05) ti = i; });
  const off = TOP_OFF.has(nm);
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.4));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= plansza hooka i napisy na b-rollu ================= */
function drawPlate(t, name) {
  const hook = name === "hook";
  const inK = hook ? 1 : easeOut(win(t, 171.85, 172.25));
  ["plK", "plN", "plU", "plT"].forEach((id) => { $(id).style.opacity = inK; });
  const secs = hook ? 600 * easeIO(win(t, 0.3, 4.4)) : 0;
  const tm = mmss(secs);
  if ($("plTm").textContent !== tm) $("plTm").textContent = tm;
  const a = $("plVa"), b = $("plVb");
  if (hook && t >= 3.01) {
    setH(a, "A nauczył cię tego", t, 3.01);
    b.className = "b oil";
    if (b.textContent !== "Ojciec") b.textContent = "Ojciec";
    pop(b, t, 4.05, 0.3, 30);
  } else {
    if (a.innerHTML !== "Rozgrzewając silnik na postoju,") a.innerHTML = "Rozgrzewając silnik na postoju,";
    a.style.opacity = inK; a.style.transform = "none";
    b.className = "b";
    if (b.textContent !== "Zabijasz go") b.textContent = "Zabijasz go";
    if (hook) pop(b, t, 2.03, 0.3, 30); else { b.style.opacity = 0; }
  }
}
const BR_UI = {
  osiedle: { k: "Tak, wiem", c1: [4.66, "Tak, wiem."], c2: [5.54, "Całe osiedle <em>tak robi</em>"] },
  mech: { k: "Tylko że", c1: [15.43, "I każdy <em>mechanik</em>"], c2: [16.1, "Mówi <em>to samo</em>"] },
  soot: { k: "Diesel na postoju", c1: [110.68, "W filtrze"], c2: [111.2, "<em>Cząstek stałych</em>"], stamp: 109.84 },
  scrape: { k: "Nawet jeśli", c1: [146.93, "Nawet jeśli tylko"], c2: [148.22, "Skrobiesz <em>szyby</em>"] },
};
function drawBr(t, name) {
  const u = BR_UI[name];
  if ($("brK").textContent !== u.k) $("brK").textContent = u.k;
  const set = (el, c) => { if (el.innerHTML !== c[1]) el.innerHTML = c[1]; pop(el, t, c[0], 0.25, 24); };
  set($("cap1"), u.c1); set($("cap2"), u.c2);
  const st = $("brSt");
  const sk = u.stamp ? easeOut(win(t, u.stamp, u.stamp + 0.4)) : 0;
  st.style.opacity = sk;
  st.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.12 - 0.12 * sk).toFixed(3) + ")";
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const stamp = (el, t, at) => { const k = easeOut(win(t, at, at + 0.4)); el.style.opacity = k; el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.12 - 0.12 * k).toFixed(3) + ")"; };

// --- instrukcja obsługi ---
const MN = {};
{
  const g = $("mnG");
  MN.book = mkEl("g", {}, g);
  mkEl("rect", { x: 170, y: 540, width: 740, height: 800, rx: 10, fill: "rgba(0,0,0,0.35)", transform: "translate(14 18)" }, MN.book);
  MN.page = mkEl("g", {}, MN.book);
  mkEl("rect", { x: 170, y: 540, width: 740, height: 800, rx: 10, fill: "#eceee9", stroke: "#b6c1cf", "stroke-width": 3 }, MN.page);
  MN.tab = mkEl("g", {}, MN.page);
  mkEl("rect", { x: 210, y: 575, width: 330, height: 50, fill: "#1b2733" }, MN.tab);
  mkT("ŠKODA · JAZDA", { x: 226, y: 609, style: "font-size:24px;font-weight:600;fill:#eef2f7;letter-spacing:0.12em" }, MN.tab);
  mkT("URUCHAMIANIE SILNIKA", { x: 212, y: 680, style: "font-size:24px;font-weight:600;fill:#56616d;letter-spacing:0.2em" }, MN.page);
  for (let i = 0; i < 3; i++) mkEl("rect", { x: 212, y: 700 + i * 30, width: i === 2 ? 380 : 650, height: 12, rx: 6, fill: "#c9ced4" }, MN.page);
  MN.hl1 = [mkEl("rect", { x: 206, y: 820, height: 66, fill: "rgba(245,170,60,0.85)" }, MN.page), mkEl("rect", { x: 206, y: 890, height: 66, fill: "rgba(245,170,60,0.85)" }, MN.page)];
  MN.t1 = [mkT("Nie rozgrzewać silnika", { class: "sans", x: 214, y: 874, style: "font-size:60px;font-weight:600;fill:#10151b" }, MN.page), mkT("na postoju.", { class: "sans", x: 214, y: 944, style: "font-size:60px;font-weight:600;fill:#10151b" }, MN.page)];
  MN.hl2 = [0, 1, 2].map((i) => mkEl("rect", { x: 206, y: 1000 + i * 56, height: 50, fill: "rgba(134,219,161,0.75)" }, MN.page));
  MN.t2 = ["Jeżeli to możliwe, należy ruszyć", "natychmiast po uruchomieniu", "silnika."].map((s, i) => mkT(s, { class: "sans", x: 214, y: 1040 + i * 56, style: "font-size:42px;font-weight:600;fill:#2a323c" }, MN.page));
  for (let i = 0; i < 4; i++) mkEl("rect", { x: 212, y: 1200 + i * 30, width: i === 3 ? 300 : 650, height: 12, rx: 6, fill: "#c9ced4" }, MN.page);
  MN.cover = mkEl("g", {}, MN.book);
  mkEl("rect", { x: 170, y: 540, width: 740, height: 800, rx: 10, fill: "#1b2733", stroke: "#3a4a5c", "stroke-width": 4 }, MN.cover);
  mkEl("rect", { x: 170, y: 540, width: 40, height: 800, fill: "#121a23" }, MN.cover);
  mkT("INSTRUKCJA", { class: "sans", x: 540, y: 860, "text-anchor": "middle", style: "font-size:96px;font-weight:600;fill:#eef2f7" }, MN.cover);
  mkT("OBSŁUGI", { class: "sans", x: 540, y: 960, "text-anchor": "middle", style: "font-size:96px;font-weight:600;fill:#f5aa3c" }, MN.cover);
  mkEl("line", { x1: 330, x2: 750, y1: 1010, y2: 1010, stroke: "#3a4a5c", "stroke-width": 3 }, MN.cover);
}
// --- lejki: gęsty zimny olej kontra rozgrzany ---
const FU = { L: { cx: 270, col: "#7cc4ff" }, R: { cx: 650, col: "#f5aa3c" } };
{
  const g = $("fuG");
  for (const side of ["L", "R"]) {
    const f = FU[side], cx = f.cx, gg = mkEl("g", {}, g);
    f.g = gg;
    mkEl("path", { d: `M ${cx - 150} 600 L ${cx + 150} 600 L ${cx + 24} 790 L ${cx + 24} 860 L ${cx - 24} 860 L ${cx - 24} 790 Z`, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 5, "stroke-linejoin": "round" }, gg);
    mkEl("path", { d: `M ${cx - 132} 620 L ${cx + 132} 620 L ${cx + 18} 786 L ${cx + 18} 850 L ${cx - 18} 850 L ${cx - 18} 786 Z`, fill: side === "L" ? "rgba(170,120,40,0.9)" : "rgba(245,170,60,0.9)" }, gg);
    f.drop = mkEl("ellipse", { cx, cy: 870, rx: 14, ry: 18, fill: side === "L" ? "#b98a3c" : "#f5aa3c" }, gg);
    f.stream = mkEl("line", { x1: cx, x2: cx, y1: 860, y2: 1250, stroke: "#f5aa3c", "stroke-width": 16, "stroke-linecap": "round", "stroke-dasharray": "40 14" }, gg);
    mkEl("path", { d: `M ${cx - 120} 1000 L ${cx - 120} 1290 Q ${cx - 120} 1310 ${cx - 100} 1310 L ${cx + 100} 1310 Q ${cx + 120} 1310 ${cx + 120} 1290 L ${cx + 120} 1000`, fill: "rgba(150,165,182,0.07)", stroke: "#b6c1cf", "stroke-width": 5 }, gg);
    f.lvl = mkEl("rect", { x: cx - 114, width: 228, y: 1304, height: 0, fill: side === "L" ? "rgba(170,120,40,0.9)" : "rgba(245,170,60,0.9)" }, gg);
    f.lab = mkT(side === "L" ? "MRÓZ" : "ROZGRZANY", { class: "sans", x: cx, y: 1390, "text-anchor": "middle", style: `font-size:56px;font-weight:600;fill:${f.col}` }, gg);
  }
  FU.snow = mkT("−8°C", { x: 270, y: 570, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#7cc4ff" }, g);
}
// --- przekrój cylindra: ścianki, film oleju, tłok, wtrysk ---
const WA = { x0: 300, x1: 640, yTop: 560, yBot: 1330, drops: [] };
{
  const g = $("waG");
  WA.walls = mkEl("g", {}, g);
  for (const [x, w] of [[240, 60], [640, 60]]) mkEl("rect", { x, y: 540, width: w, height: 800, fill: "rgba(124,196,255,0.12)", stroke: "#7cc4ff", "stroke-width": 4 }, WA.walls);
  mkEl("rect", { x: 220, y: 500, width: 500, height: 60, fill: "rgba(150,165,182,0.16)", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkEl("rect", { x: 452, y: 470, width: 36, height: 70, fill: "#3a4a5c", stroke: "#b6c1cf", "stroke-width": 3 }, g);
  mkT("WTRYSK", { x: 500, y: 490, style: "font-size:22px" }, g);
  // film oleju w segmentach, żeby dało się go zmywać kawałkami
  WA.film = [];
  for (let i = 0; i < 16; i++) {
    const y = 560 + i * 48;
    WA.film.push([mkEl("rect", { x: 300, y, width: 9, height: 48, fill: "#f5aa3c" }, g), mkEl("rect", { x: 631, y, width: 9, height: 48, fill: "#f5aa3c" }, g), y]);
  }
  WA.piston = mkEl("g", {}, g);
  mkEl("rect", { x: 310, y: 0, width: 320, height: 190, rx: 6, fill: "rgba(150,165,182,0.28)", stroke: "#b6c1cf", "stroke-width": 4 }, WA.piston);
  WA.rings = [];
  for (const dy of [20, 42]) for (const x of [310, 614]) WA.rings.push(mkEl("rect", { x, y: dy, width: 16, height: 10, fill: "#0d1117", stroke: "#eef2f7", "stroke-width": 2 }, WA.piston));
  WA.cone = mkEl("path", { d: "M 470 548 L 340 820 L 600 820 Z", fill: "rgba(255,213,74,0.14)" }, g);
  WA.dropG = mkEl("g", {}, g);
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1, ang = 18 + hash(i * 3.3) * 50;
    const tx = side > 0 ? 628 : 312, ty = 548 + (Math.abs(tx - 470) / Math.tan(ang * D2R));
    WA.drops.push({ i, side, tx, ty: Math.min(1180, ty), el: mkEl("ellipse", { rx: 7, ry: 9, fill: "#ffd54a" }, WA.dropG), bt: 38.95 + i * 0.075 });
  }
  WA.tagO = mkEl("g", {}, g);
  mkEl("path", { d: "M 300 700 L 150 640", stroke: "#f5aa3c", "stroke-width": 3, fill: "none" }, WA.tagO);
  mkT("OLEJ", { class: "sans", x: 80, y: 630, style: "font-size:48px;font-weight:600;fill:#f5aa3c" }, WA.tagO);
  WA.tagF = mkEl("g", {}, g);
  mkEl("path", { d: "M 630 820 L 760 760", stroke: "#ffd54a", "stroke-width": 3, fill: "none" }, WA.tagF);
  mkT("PALIWO", { class: "sans", x: 700, y: 745, style: "font-size:48px;font-weight:600;fill:#ffd54a" }, WA.tagF);
}
// --- zużycie po zimnym starcie ---
const WE = { x0: 130, x1: 850, y0: 1000, y1: 590 };
{
  const g = $("weG");
  WE.axes = mkEl("g", {}, g);
  mkEl("path", { d: `M ${WE.x0} ${WE.y1 - 20} L ${WE.x0} ${WE.y0} L ${WE.x1} ${WE.y0}`, fill: "none", stroke: "#b6c1cf", "stroke-width": 4 }, WE.axes);
  mkT("ZUŻYCIE", { x: WE.x0 + 16, y: WE.y1 - 4, style: "font-size:24px" }, WE.axes);
  mkT("CZAS OD ZIMNEGO STARTU →", { x: WE.x1, y: WE.y0 + 44, "text-anchor": "end", style: "font-size:24px" }, WE.axes);
  const curve = (tau) => { let d = ""; for (let x = WE.x0; x <= WE.x1; x += 5) { const u = (x - WE.x0) / (WE.x1 - WE.x0); d += (x === WE.x0 ? "M " : " L ") + x + " " + f1(WE.y0 - 40 - 330 * Math.exp(-u / tau)); } return d; };
  WE.cDrive = mkEl("path", { d: curve(0.1), fill: "none", stroke: "#eef2f7", "stroke-width": 7, "stroke-linejoin": "round" }, g);
  WE.cIdle = mkEl("path", { d: curve(0.42), fill: "none", stroke: "#ff6a4d", "stroke-width": 7, "stroke-dasharray": "18 12", "stroke-linejoin": "round" }, g);
  WE.peak = mkEl("g", {}, g);
  mkEl("circle", { cx: WE.x0, cy: WE.y0 - 370, r: 18, fill: "#ff6a4d" }, WE.peak);
  mkT("ZIMNY START", { class: "sans", x: WE.x0 + 34, y: WE.y0 - 360, style: "font-size:44px;font-weight:600;fill:#ff6a4d" }, WE.peak);
  WE.rows = [];
  [["JAZDA", 1130, 0.14], ["POSTÓJ", 1270, 0.62]].forEach(([lab, y, len]) => {
    const r = { g: mkEl("g", {}, g), len };
    mkT(lab, { class: "sans", x: WE.x0 - 60, y: y + 44, style: "font-size:50px;font-weight:600;fill:#eef2f7" }, r.g);
    mkEl("rect", { x: 330, y, width: WE.x1 - 330, height: 60, fill: "rgba(134,219,161,0.25)", stroke: "#86dba1", "stroke-width": 3 }, r.g);
    r.bad = mkEl("rect", { x: 330, y, height: 60, fill: "rgba(226,73,43,0.85)" }, r.g);
    WE.rows.push(r);
  });
}
// --- olej w misce: paliwo i woda ---
const MX = { drops: [] };
{
  const g = $("mxG");
  mkEl("path", { d: "M 120 640 L 120 1190 Q 120 1240 170 1240 L 640 1240 Q 690 1240 690 1190 L 690 640", fill: "rgba(150,165,182,0.07)", stroke: "#b6c1cf", "stroke-width": 6 }, g);
  mkEl("rect", { x: 126, y: 780, width: 558, height: 454, fill: "rgba(245,170,60,0.55)" }, g);
  mkEl("path", { d: "M 126 780 L 684 780", stroke: "#f5aa3c", "stroke-width": 5 }, g);
  for (let i = 0; i < 16; i++) {
    const w = i >= 10;
    MX.drops.push({ i, w, x: 170 + hash(i * 7.7) * 460, y: 850 + hash(i * 3.1) * 330, r: w ? 22 : 17, el: mkEl("circle", { r: w ? 22 : 17, fill: w ? "#5ab4ff" : "#ffd54a", stroke: "rgba(6,8,11,0.5)", "stroke-width": 2 }, g) });
  }
  MX.steam = [];
  for (let i = 0; i < 9; i++) MX.steam.push(mkEl("path", { d: "", fill: "none", stroke: "rgba(238,242,247,0.6)", "stroke-width": 6, "stroke-linecap": "round" }, g));
  // termometr
  mkEl("rect", { x: 766, y: 600, width: 56, height: 560, rx: 28, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  mkEl("circle", { cx: 794, cy: 1200, r: 50, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  MX.bulb = mkEl("circle", { cx: 794, cy: 1200, r: 38, fill: "#ff6a4d" }, g);
  MX.col = mkEl("rect", { x: 780, width: 28, rx: 14, fill: "#ff6a4d" }, g);
  MX.tagF = mkEl("g", {}, g);
  mkT("BENZYNA", { class: "sans", x: 130, y: 1330, style: "font-size:50px;font-weight:600;fill:#ffd54a" }, MX.tagF);
  MX.tagW = mkEl("g", {}, g);
  mkT("WODA", { class: "sans", x: 420, y: 1330, style: "font-size:50px;font-weight:600;fill:#7cc4ff" }, MX.tagW);
}
// --- korek wlewu z majonezem ---
const MY = { blobs: [] };
{
  const g = $("myG");
  mkEl("circle", { cx: 470, cy: 870, r: 300, fill: "#22282f", stroke: "#56616d", "stroke-width": 10 }, g);
  mkEl("circle", { cx: 470, cy: 870, r: 250, fill: "#1a1f25", stroke: "#3a4450", "stroke-width": 6, "stroke-dasharray": "22 10" }, g);
  mkEl("circle", { cx: 470, cy: 870, r: 130, fill: "#2b323a", stroke: "#3a4450", "stroke-width": 5 }, g);
  const blob = (cx, cy, r, i) => {
    let d = "";
    // miękka, obła plama: kilka harmonicznych zamiast szumu, więc bez ząbków
    const p1 = hash(i * 3.7) * 6.28, p2 = hash(i * 5.3) * 6.28;
    for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2, rr = r * (1 + 0.16 * Math.sin(3 * a + p1) + 0.09 * Math.sin(5 * a + p2)); d += (k ? " L " : "M ") + f1(cx + Math.cos(a) * rr) + " " + f1(cy + Math.sin(a) * rr); }
    return mkEl("path", { d: d + " Z", fill: "#ece3cb", stroke: "#cbbd98", "stroke-width": 4, "stroke-linejoin": "round" }, g);
  };
  [[400, 760, 70], [560, 800, 58], [510, 950, 80], [370, 930, 48], [620, 930, 40], [460, 850, 52], [330, 830, 36], [590, 700, 34]].forEach(([x, y, r], i) => MY.blobs.push({ el: blob(x, y, r, i), x, y, i }));
  MY.tag = mkEl("g", {}, g);
  mkT("KOREK WLEWU OLEJU", { x: 470, y: 1250, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#eef2f7" }, MY.tag);
}
// --- temperatura oleju: postój kontra jazda ---
const TM = { x0: 130, x1: 850, y0: 1060, y1: 600 };
{
  const g = $("tmG");
  TM.axes = mkEl("g", {}, g);
  mkEl("path", { d: `M ${TM.x0} ${TM.y1 - 20} L ${TM.x0} ${TM.y0} L ${TM.x1} ${TM.y0}`, fill: "none", stroke: "#b6c1cf", "stroke-width": 4 }, TM.axes);
  mkEl("line", { x1: TM.x0, x2: TM.x1, y1: TM.y1 + 40, y2: TM.y1 + 40, stroke: "#86dba1", "stroke-width": 3, "stroke-dasharray": "14 10" }, TM.axes);
  mkT("TEMPERATURA PRACY", { x: TM.x1, y: TM.y1 + 26, "text-anchor": "end", style: "font-size:24px;fill:#86dba1" }, TM.axes);
  mkT("CZAS →", { x: TM.x1, y: TM.y0 + 44, "text-anchor": "end", style: "font-size:24px" }, TM.axes);
  const curve = (tau) => { let d = ""; for (let x = TM.x0; x <= TM.x1; x += 5) { const u = (x - TM.x0) / (TM.x1 - TM.x0); d += (x === TM.x0 ? "M " : " L ") + x + " " + f1(TM.y0 - 20 - (TM.y0 - TM.y1 - 60) * (1 - Math.exp(-u / tau))); } return d; };
  TM.cIdle = mkEl("path", { d: curve(1.1), fill: "none", stroke: "#7cc4ff", "stroke-width": 8, "stroke-linejoin": "round" }, g);
  TM.cDrive = mkEl("path", { d: curve(0.2), fill: "none", stroke: "#86dba1", "stroke-width": 8, "stroke-linejoin": "round" }, g);
  TM.lIdle = mkT("POSTÓJ", { class: "sans", x: 690, y: 910, style: "font-size:52px;font-weight:600;fill:#7cc4ff" }, g);
  TM.lDrive = mkT("JAZDA", { class: "sans", x: 560, y: 745, style: "font-size:52px;font-weight:600;fill:#86dba1" }, g);
  TM.q = mkEl("g", {}, g);
  mkEl("rect", { x: 70, y: 1160, width: 780, height: 170, fill: "#eceee9", rx: 6 }, TM.q);
  mkEl("rect", { x: 70, y: 1160, width: 12, height: 170, fill: "#f5aa3c" }, TM.q);
  mkT("„Nie rozgrzewać silnika", { class: "sans", x: 110, y: 1228, style: "font-size:50px;font-weight:600;fill:#10151b" }, TM.q);
  mkT("na postoju.”   ŠKODA", { class: "sans", x: 110, y: 1296, style: "font-size:50px;font-weight:600;fill:#10151b" }, TM.q);
}
// --- zegary: płyn i olej ---
const GA = {};
{
  const g = $("gaG");
  const gauge = (cx, lab, dashed) => {
    const o = { cx, cy: 930, r: 190, g: mkEl("g", {}, g) };
    mkEl("path", { d: arcD(cx, 930, 190, 180, 360), fill: "none", stroke: dashed ? "#7cc4ff" : "#b6c1cf", "stroke-width": 10, "stroke-dasharray": dashed ? "18 12" : "none", "stroke-linecap": "round" }, o.g);
    for (let i = 0; i <= 8; i++) { const a = 180 + i * 22.5, [x0, y0] = polar(cx, 930, 168, a), [x1, y1] = polar(cx, 930, 144, a); mkEl("line", { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), stroke: "#b6c1cf", "stroke-width": i % 4 === 0 ? 6 : 3 }, o.g); }
    mkT("C", { class: "sans", x: cx - 168, y: 995, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#7cc4ff" }, o.g);
    mkT("H", { class: "sans", x: cx + 168, y: 995, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#ff6a4d" }, o.g);
    o.lab = mkT(lab, { class: "sans", x: cx, y: 1060, "text-anchor": "middle", style: "font-size:58px;font-weight:600;fill:#eef2f7" }, o.g);
    o.needle = mkEl("line", { x1: cx, y1: 930, stroke: "#ff6a4d", "stroke-width": 9, "stroke-linecap": "round" }, o.g);
    mkEl("circle", { cx, cy: 930, r: 18, fill: "#eef2f7" }, o.g);
    return o;
  };
  GA.c = gauge(260, "PŁYN", false);
  GA.o = gauge(650, "OLEJ", true);
  GA.clock = mkEl("g", {}, g);
  mkEl("rect", { x: 70, y: 1170, width: 780, height: 130, fill: "rgba(9,12,17,0.9)", stroke: "rgba(150,165,182,0.3)", "stroke-width": 2 }, GA.clock);
  mkT("NA POSTOJU", { x: 100, y: 1248, style: "font-size:28px;fill:#b6c1cf" }, GA.clock);
  GA.clockT = mkT("0:00", { x: 820, y: 1268, "text-anchor": "end", style: "font-size:84px;font-weight:600;fill:#eef2f7" }, GA.clock);
}
const needle = (o, v) => { const [x, y] = polar(o.cx, 930, 156, 180 + 180 * clamp01(v)); o.needle.setAttribute("x2", f1(x)); o.needle.setAttribute("y2", f1(y)); };
// --- kwadrans na postoju ---
const KW = {};
{
  const g = $("kwG");
  KW.time = mkT("0:00", { x: 70, y: 700, style: "font-size:250px;font-weight:600;fill:#7cc4ff;letter-spacing:-0.04em" }, g);
  mkT("NA POSTOJU", { x: 80, y: 770, style: "font-size:30px;fill:#eef2f7" }, g);
  // płatek śniegu
  const sn = mkEl("g", { transform: "translate(760 850)" }, g);
  for (let i = 0; i < 6; i++) { const a = i * 60; mkEl("line", { x1: 0, y1: 0, x2: f1(Math.cos(a * D2R) * 52), y2: f1(Math.sin(a * D2R) * 52), stroke: "#7cc4ff", "stroke-width": 8, "stroke-linecap": "round" }, sn); }
  KW.snow = sn;
  KW.bar = mkEl("g", {}, g);
  mkT("TEMPERATURA SILNIKA", { x: 70, y: 1000, style: "font-size:26px" }, KW.bar);
  mkEl("rect", { x: 70, y: 1020, width: 780, height: 90, fill: "rgba(150,165,182,0.14)", stroke: "rgba(150,165,182,0.4)", "stroke-width": 3 }, KW.bar);
  KW.fill = mkEl("rect", { x: 72, y: 1022, height: 86, fill: "#3aa0ff" }, KW.bar);
  mkEl("line", { x1: 690, x2: 690, y1: 1005, y2: 1125, stroke: "#86dba1", "stroke-width": 4, "stroke-dasharray": "10 8" }, KW.bar);
  mkT("PRACA", { x: 700, y: 1160, style: "font-size:24px;fill:#86dba1" }, KW.bar);
}
// --- DPF: kanaliki, sadza, temperatura spalin ---
const DP = { layers: [] };
{
  const g = $("dpG");
  mkEl("rect", { x: 100, y: 540, width: 750, height: 400, rx: 30, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 6 }, g);
  for (let i = 0; i < 7; i++) {
    const y = 570 + i * 50;
    mkEl("rect", { x: 140, y, width: 670, height: 34, fill: "rgba(196,206,218,0.3)", stroke: "rgba(150,165,182,0.5)", "stroke-width": 2 }, g);
    mkEl("rect", { x: i % 2 ? 140 : 792, y, width: 18, height: 34, fill: "#56616d" }, g);
  }
  for (let k = 0; k < 6; k++) DP.layers.push(mkEl("g", { opacity: 0 }, g));
  DP.layers.forEach((lg, k) => { for (let i = 0; i < 7; i += 2) mkEl("rect", { x: 158, y: 570 + i * 50 + 34 - (k + 1) * 5.5, width: 634, height: 5.5, fill: "#0b0c0d" }, lg); });
  DP.flow = mkEl("path", { d: "M 60 740 L 130 740 M 820 740 L 900 740", stroke: "#b6c1cf", "stroke-width": 8, "stroke-dasharray": "22 14", fill: "none" }, g);
  DP.temp = mkEl("g", {}, g);
  mkT("TEMPERATURA SPALIN", { x: 70, y: 1010, style: "font-size:26px" }, DP.temp);
  mkEl("rect", { x: 70, y: 1030, width: 780, height: 70, fill: "rgba(150,165,182,0.14)", stroke: "rgba(150,165,182,0.4)", "stroke-width": 3 }, DP.temp);
  DP.tFill = mkEl("rect", { x: 72, y: 1032, height: 66, fill: "#3aa0ff" }, DP.temp);
  DP.burn = mkEl("g", {}, g);
  mkEl("line", { x1: 700, x2: 700, y1: 1015, y2: 1115, stroke: "#ff6a4d", "stroke-width": 5 }, DP.burn);
  mkT("WYPALANIE", { x: 690, y: 1150, "text-anchor": "end", style: "font-size:28px;font-weight:600;fill:#ff6a4d" }, DP.burn);
  DP.days = ["PON", "WT", "ŚR", "CZW", "PT"].map((d, i) => { const e = mkEl("g", {}, g); mkEl("rect", { x: 70 + i * 156, y: 1210, width: 140, height: 76, fill: "rgba(9,12,17,0.92)", stroke: "rgba(150,165,182,0.3)", "stroke-width": 2 }, e); mkT(d, { class: "sans", x: 140 + i * 156, y: 1266, "text-anchor": "middle", style: "font-size:46px;font-weight:600;fill:#eef2f7" }, e); return e; });
}
const DP_DAYS = [115.0, 115.4, 115.88, 116.2, 116.61];
// --- 30 sekund ---
const T3 = {};
{
  const g = $("t3G");
  mkEl("circle", { cx: 470, cy: 830, r: 230, fill: "rgba(9,12,17,0.6)", stroke: "rgba(150,165,182,0.25)", "stroke-width": 26 }, g);
  T3.ring = mkEl("path", { d: arcD(470, 830, 230, -90, 269.9), fill: "none", stroke: "#f5aa3c", "stroke-width": 26, "stroke-linecap": "round" }, g);
  T3.num = mkT("0", { x: 470, y: 880, "text-anchor": "middle", style: "font-size:190px;font-weight:600;fill:#eef2f7" }, g);
  mkT("SEKUND", { x: 470, y: 950, "text-anchor": "middle", style: "font-size:30px;fill:#b6c1cf" }, g);
  const icon = (x, draw) => { const e = mkEl("g", {}, g); mkEl("rect", { x: x - 100, y: 1130, width: 200, height: 180, rx: 16, fill: "rgba(9,12,17,0.92)", stroke: "rgba(150,165,182,0.3)", "stroke-width": 3 }, e); draw(e, x); const ck = mkEl("path", { d: `M ${x + 40} 1160 L ${x + 62} 1184 L ${x + 100} 1138`, fill: "none", stroke: "#86dba1", "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round" }, e); return { e, ck }; };
  T3.belt = icon(250, (e, x) => { mkEl("path", { d: `M ${x - 60} 1160 L ${x + 50} 1290`, stroke: "#eef2f7", "stroke-width": 16, "stroke-linecap": "round" }, e); mkEl("rect", { x: x - 10, y: 1210, width: 44, height: 30, rx: 6, fill: "#f5aa3c", transform: `rotate(50 ${x + 12} 1225)` }, e); });
  T3.mirror = icon(520, (e, x) => { mkEl("rect", { x: x - 70, y: 1190, width: 140, height: 70, rx: 30, fill: "rgba(124,196,255,0.25)", stroke: "#eef2f7", "stroke-width": 7 }, e); mkEl("line", { x1: x, x2: x, y1: 1260, y2: 1290, stroke: "#eef2f7", "stroke-width": 8 }, e); });
}
// --- obrotomierz ---
const TH = { cx: 470, cy: 880, r: 280 };
const thA = (v) => 135 + (v / 8) * 270;
{
  const g = $("thG");
  mkEl("path", { d: arcD(TH.cx, TH.cy, TH.r, 135, 405), fill: "none", stroke: "rgba(150,165,182,0.35)", "stroke-width": 16 }, g);
  TH.green = mkEl("path", { d: arcD(TH.cx, TH.cy, TH.r, thA(2), thA(3.5)), fill: "none", stroke: "#86dba1", "stroke-width": 30 }, g);
  TH.redHi = mkEl("path", { d: arcD(TH.cx, TH.cy, TH.r, thA(6), thA(8)), fill: "none", stroke: "#ff2a10", "stroke-width": 30 }, g);
  TH.redLo = mkEl("path", { d: arcD(TH.cx, TH.cy, TH.r, thA(0.8), thA(1.5)), fill: "none", stroke: "#ff2a10", "stroke-width": 30 }, g);
  for (let v = 0; v <= 8; v++) {
    const [x0, y0] = polar(TH.cx, TH.cy, TH.r - 28, thA(v)), [x1, y1] = polar(TH.cx, TH.cy, TH.r - 60, thA(v)), [xt, yt] = polar(TH.cx, TH.cy, TH.r - 104, thA(v));
    mkEl("line", { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), stroke: "#eef2f7", "stroke-width": 6 }, g);
    mkT(String(v), { class: "sans", x: f1(xt), y: f1(yt + 18), "text-anchor": "middle", style: "font-size:52px;font-weight:600;fill:#eef2f7" }, g);
  }
  mkT("× 1000 OBR/MIN", { x: TH.cx, y: TH.cy + 150, "text-anchor": "middle", style: "font-size:24px" }, g);
  TH.needle = mkEl("line", { x1: TH.cx, y1: TH.cy, stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx: TH.cx, cy: TH.cy, r: 26, fill: "#eef2f7" }, g);
  TH.gear = mkEl("g", {}, g);
  mkEl("rect", { x: 100, y: 1180, width: 150, height: 150, rx: 14, fill: "rgba(28,10,8,0.9)", stroke: "#ff6a4d", "stroke-width": 5 }, TH.gear);
  mkT("5", { class: "sans", x: 175, y: 1300, "text-anchor": "middle", style: "font-size:130px;font-weight:600;fill:#ff6a4d" }, TH.gear);
  mkT("BIEG", { x: 270, y: 1270, style: "font-size:30px;fill:#ffb0a0" }, TH.gear);
}
// --- postój: zegar ---
const PO = {};
{
  const g = $("poG");
  PO.time = mkT("0:00", { x: 470, y: 760, "text-anchor": "middle", style: "font-size:260px;font-weight:600;fill:#eef2f7;letter-spacing:-0.04em" }, g);
  PO.car = mkEl("g", {}, g);
  mkEl("path", { d: "M 200 1010 L 200 960 Q 206 936 250 930 L 330 870 L 560 870 L 650 930 Q 700 940 700 970 L 700 1010 Z", fill: "rgba(150,165,182,0.2)", stroke: "#b6c1cf", "stroke-width": 5 }, PO.car);
  mkEl("circle", { cx: 290, cy: 1015, r: 38, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, PO.car);
  mkEl("circle", { cx: 610, cy: 1015, r: 38, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, PO.car);
  PO.puff = [0, 1, 2].map((i) => mkEl("circle", { r: 20, fill: "rgba(238,242,247,0.35)" }, PO.car));
}
// --- znak obszaru zabudowanego i silnik ---
const SN = {};
{
  const g = $("snG");
  SN.sign = mkEl("g", {}, g);
  mkEl("rect", { x: 170, y: 520, width: 600, height: 400, rx: 18, fill: "#f4f5f2", stroke: "#10151b", "stroke-width": 10 }, SN.sign);
  mkEl("rect", { x: 196, y: 546, width: 548, height: 348, rx: 8, fill: "none", stroke: "#10151b", "stroke-width": 4 }, SN.sign);
  mkEl("path", { d: "M 220 860 L 220 760 L 270 760 L 270 700 L 330 700 L 330 780 L 380 780 L 380 640 L 410 610 L 440 640 L 440 800 L 500 800 L 500 720 L 560 720 L 560 660 L 610 660 L 610 760 L 660 760 L 660 700 L 720 700 L 720 860 Z", fill: "#10151b" }, SN.sign);
  SN.sw = mkEl("g", {}, g);
  mkT("SILNIK", { class: "sans", x: 80, y: 1120, style: "font-size:64px;font-weight:600;fill:#eef2f7" }, SN.sw);
  SN.track = mkEl("rect", { x: 330, y: 1052, width: 250, height: 90, rx: 45, fill: "#e2492b" }, SN.sw);
  SN.knob = mkEl("circle", { cy: 1097, r: 36, fill: "#eef2f7" }, SN.sw);
  SN.on = mkT("ON", { class: "sans", x: 620, y: 1120, style: "font-size:64px;font-weight:600;fill:#ff6a4d" }, SN.sw);
  SN.law = mkT("POSTÓJ = POWYŻEJ 1 MINUTY · ART. 60 UST. 2 PKT 3 PORD", { x: 70, y: 1300, style: "font-size:21px;fill:#b6c1cf;letter-spacing:0.08em" }, g);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gSay") {
    pop($("bub1"), t, 17.04, 0.3, 40);
    pop($("bub2"), t, 18.2, 0.3, 40);
    $("bub1").style.opacity = (easeOut(win(t, 17.04, 17.52)) * (1 - 0.45 * easeIO(win(t, 18.2, 18.6)))).toFixed(3);
  } else if (id === "gManual") {
    stepH($("mnH"), t, [[19.99, "A teraz otwórz <em>instrukcję</em>"], [21.77, "Škoda pisze <em>wprost</em>"]]);
    popS(MN.book, t, 20.0, 40);
    const ok = easeIO(win(t, 20.98, 21.6));
    MN.cover.setAttribute("transform", `translate(170 0) scale(${Math.max(0.001, 1 - ok).toFixed(4)} 1) translate(-170 0)`);
    MN.cover.setAttribute("opacity", ok > 0.995 ? 0 : 1);
    op(MN.tab, easeOut(win(t, 21.77, 22.1)));
    const sweep = (rects, a, b, w) => rects.forEach((r, i) => { const n = rects.length; const k = easeIO(win(t, a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n)); r.setAttribute("width", f1(w[i] * k)); });
    // zakreślacz dokładnie na długość tekstu (mierzone na żywo, bo zależy od fontu)
    sweep(MN.hl1, 23.26, 24.95, MN.t1.map((e) => e.getComputedTextLength() + 16));
    sweep(MN.hl2, 25.5, 27.2, MN.t2.map((e) => e.getComputedTextLength() + 16));
  } else if (id === "gFunnel") {
    stepH($("fuH"), t, [[32.0, "Olej jest"], [32.99, "Nawet <em>100×</em> gęstszy"], [33.92, "Niż <span class=\"ok\">rozgrzany</span>"]]);
    const L = FU.L, R = FU.R;
    popS(L.g, t, 32.02, 30);
    op(R.g, easeOut(win(t, 32.1, 32.5)) * (t >= 33.92 ? 1 : 0.45));
    // zimny: kropla rośnie i spada raz na ~1,3 s
    const p = frac((t - 32.0) / 1.3);
    const grow = clamp01(p / 0.75), fall = clamp01((p - 0.75) / 0.25);
    L.drop.setAttribute("cy", f1(868 + 12 * grow + 380 * fall * fall));
    L.drop.setAttribute("ry", f1(6 + 16 * grow)); L.drop.setAttribute("rx", f1(6 + 10 * grow));
    L.stream.setAttribute("opacity", 0);
    L.lvl.setAttribute("y", f1(1304 - 20 * win(t, 32.0, 34.9))); L.lvl.setAttribute("height", f1(20 * win(t, 32.0, 34.9)));
    R.drop.setAttribute("opacity", 0);
    R.stream.style.strokeDashoffset = f1(-(t * 420) % 54);
    const rl = 240 * easeIO(win(t, 32.2, 34.9));
    R.lvl.setAttribute("y", f1(1304 - rl)); R.lvl.setAttribute("height", f1(rl));
    L.lab.setAttribute("opacity", 1); R.lab.setAttribute("opacity", 1);
    op(FU.snow, easeOut(win(t, 32.02, 32.4)));
  } else if (id === "gWall") {
    const B = t >= 43;
    $("waK").textContent = B ? "Powód 1 · paliwo" : "Przekrój cylindra";
    stepH($("waH"), t, B
      ? [[43.16, "<em>Benzyna</em>"], [44.27, "Która <span class=\"hot\">nie odparowała</span>"], [45.13, "Osiada <em>na ściankach</em>"], [46.77, "Działa jak <em>rozpuszczalnik</em>"], [48.53, "Zmywa <span class=\"hot\">olej</span>"]]
      : [[38.92, "Na zimnym <span class=\"ice\">metalu</span>"], [40.08, "Benzyna <span class=\"hot\">słabo paruje</span>"]]);
    // tłok chodzi powoli w dół i w górę
    const py = 880 + 170 * Math.cos((t - 38.92) * 2.2);
    WA.piston.setAttribute("transform", `translate(0 ${f1(py)})`);
    WA.cone.setAttribute("opacity", (0.75 * (1 - 0.6 * easeIO(win(t, 45.2, 46.0)))).toFixed(3));
    WA.drops.forEach((d) => {
      const bt = B ? 38.95 + (d.bt - 38.95) * 0.4 : d.bt;
      const fly = easeIn(win(t, bt, bt + 0.35));
      let x = lerp(470, d.tx, fly), y = lerp(560, d.ty, fly);
      // spływanie po ściance od "działa jak rozpuszczalnik"
      const run = B ? easeIn(win(t, 46.9 + hash(d.i) * 0.5, 49.3 + hash(d.i) * 0.4)) : 0;
      y += run * (1310 - d.ty);
      d.el.setAttribute("cx", f1(x)); d.el.setAttribute("cy", f1(y));
      d.el.setAttribute("ry", f1(fly >= 1 ? 9 + run * 10 : 7));
      d.el.setAttribute("opacity", t >= bt ? 1 : 0);
    });
    // film oleju znika tam, gdzie spłynęła benzyna
    WA.film.forEach(([a, b, y], i) => {
      const wash = B ? easeIO(win(t, 47.3 + (y - 560) / 770 * 1.6, 48.9 + (y - 560) / 770 * 1.2)) : 0;
      const k = 1 - 0.88 * wash;
      a.setAttribute("opacity", (k).toFixed(3)); b.setAttribute("opacity", (k).toFixed(3));
    });
    op(WA.tagO, B ? easeOut(win(t, 43.3, 43.7)) * (1 - easeIO(win(t, 44.9, 45.2))) + easeOut(win(t, 48.53, 48.9)) : 0);
    op(WA.tagF, B ? easeOut(win(t, 45.13, 45.5)) * (1 - easeIO(win(t, 48.3, 48.53))) : 0);
    WA.walls.setAttribute("opacity", 1);
  } else if (id === "gWear") {
    stepH($("weH"), t, [[52.38, "Silnik <em>zużywa się</em> najbardziej"], [54.34, "Zaraz po <span class=\"ice\">zimnym starcie</span>"], [55.78, "W jeździe <span class=\"ok\">szybko mijają</span>"], [58.05, "Na postoju <span class=\"hot\">je przedłużasz</span>"]]);
    popS(WE.axes, t, 52.4, 20);
    dash(WE.cDrive, easeIO(win(t, 52.6, 53.9)), 1500);
    op(WE.peak, easeOut(win(t, 53.73, 54.1)));
    op(WE.cIdle, t >= 58.05 ? 1 : 0);
    dash(WE.cIdle, easeIO(win(t, 58.1, 59.4)), 1500);
    WE.rows.forEach((r, i) => {
      const at = i === 0 ? 55.88 : 58.31;
      popS(r.g, t, at, 24);
      r.bad.setAttribute("width", f1((850 - 330) * r.len * easeIO(win(t, at + 0.2, at + 1.1))));
    });
  } else if (id === "gMix") {
    stepH($("mxH"), t, [[67.15, "<em>Gorący</em> olej"], [68.44, "By to <em>odparował</em>"], [69.23, "Ale na <em>jałowym</em>"], [70.31, "Grzeje się <span class=\"ice\">tak wolno</span>"], [71.57, "Benzyna i woda <span class=\"hot\">zostają</span>"]]);
    const hot = t < 69.23;
    // termometr: w wersji "gdyby" wysoko, potem na jałowym nisko i rośnie powoli
    const lvl = hot ? lerp(0.2, 0.92, easeIO(win(t, 67.2, 67.9))) : lerp(0.92, 0.14, easeIO(win(t, 69.23, 69.8))) + 0.08 * win(t, 70.3, 73.9);
    const col = hot ? "#ff6a4d" : "#3aa0ff";
    MX.col.setAttribute("y", f1(1170 - 540 * lvl)); MX.col.setAttribute("height", f1(540 * lvl + 10));
    MX.col.setAttribute("fill", col); MX.bulb.setAttribute("fill", col);
    MX.drops.forEach((d) => {
      // przy gorącym oleju krople unoszą się i znikają, na jałowym zostają i się kołyszą
      const ev = hot ? easeIn(win(t, 68.2 + hash(d.i) * 0.6, 68.9 + hash(d.i) * 0.5)) : 0;
      const back = hot ? 1 : easeOut(win(t, 69.4 + hash(d.i * 2) * 0.5, 69.9 + hash(d.i * 2) * 0.5));
      const y = d.y - ev * (d.y - 700) + Math.sin(t * 1.3 + d.i) * 6;
      d.el.setAttribute("cx", f1(d.x + Math.sin(t * 0.9 + d.i * 2) * 8)); d.el.setAttribute("cy", f1(y));
      d.el.setAttribute("opacity", ((1 - ev) * back).toFixed(3));
    });
    MX.steam.forEach((s, i) => {
      const x = 180 + i * 60, k = hot ? easeOut(win(t, 68.3 + i * 0.05, 68.8)) * (1 - easeIO(win(t, 69.0, 69.3))) : 0;
      const off = (t * 60 + i * 30) % 60;
      s.setAttribute("d", `M ${x} ${f1(760 - off)} q 18 -30 0 -60 q -18 -30 0 -60`);
      s.setAttribute("opacity", (k).toFixed(3));
    });
    op(MX.tagF, easeOut(win(t, 71.75, 72.1)));
    op(MX.tagW, easeOut(win(t, 72.44, 72.8)));
  } else if (id === "gMayo") {
    stepH($("myH"), t, [[73.93, "Stąd"], [74.35, "Biały <em>majonez</em>"], [75.18, "Pod korkiem <em>wlewu</em>"]]);
    MY.blobs.forEach((b) => {
      const k = easeOut(win(t, 74.74 + b.i * 0.07, 75.1 + b.i * 0.07));
      b.el.setAttribute("transform", `translate(${b.x} ${b.y}) scale(${(0.3 + 0.7 * k).toFixed(3)}) translate(${-b.x} ${-b.y})`);
      b.el.setAttribute("opacity", (k).toFixed(3));
    });
    op(MY.tag, easeOut(win(t, 75.32, 75.7)));
  } else if (id === "gTemp") {
    stepH($("tmH"), t, [[86.18, "Daje <span class=\"ice\">mało ciepła</span>"], [87.51, "Grzeje się <em>dużo wolniej</em>"], [89.14, "Niż w <span class=\"ok\">spokojnej jeździe</span>"], [90.64, "Dlatego fabryka <em>każe ruszać</em>"]]);
    popS(TM.axes, t, 86.3, 20);
    dash(TM.cIdle, easeIO(win(t, 87.6, 89.0)), 1500);
    op(TM.lIdle, easeOut(win(t, 88.7, 89.0)));
    op(TM.cDrive, t >= 89.14 ? 1 : 0);
    dash(TM.cDrive, easeIO(win(t, 89.2, 90.3)), 1500);
    op(TM.lDrive, easeOut(win(t, 89.9, 90.2)));
    popS(TM.q, t, 90.64, 30);
  } else if (id === "gGauge") {
    stepH($("gaH"), t, [[92.56, "A <em>wskazówka</em>"], [93.66, "<span class=\"hot\">Oszukuje</span> cię"], [94.55, "Pokazuje <em>płyn</em>"], [95.77, "Nie <span class=\"ice\">olej</span>"], [96.64, "Drgnie po <em>kilku minutach</em>"], [98.4, "Olej <span class=\"ice\">daleko w tyle</span>"]]);
    popS(GA.c.g, t, 92.6, 30);
    popS(GA.o.g, t, 95.77, 30);
    GA.c.lab.setAttribute("style", `font-size:58px;font-weight:600;fill:${t >= 94.55 ? "#f5aa3c" : "#eef2f7"}`);
    const run = easeIO(win(t, 96.64, 98.3));
    needle(GA.c, 0.04 + 0.46 * run);
    needle(GA.o, 0.04 + 0.1 * easeIO(win(t, 98.4, 100.5)));
    popS(GA.clock, t, 96.64, 24);
    const tm = mmss(300 * run);
    if (GA.clockT.textContent !== tm) GA.clockT.textContent = tm;
  } else if (id === "gKwad") {
    stepH($("kwH"), t, [[106.07, "Na <span class=\"ice\">mrozie</span>"], [106.68, "Potrafi stać <em>kwadrans</em>"], [108.23, "Wskazówka <span class=\"ice\">ledwo drgnie</span>"]]);
    const s = 900 * easeIO(win(t, 106.7, 107.9));
    const tm = mmss(s);
    if (KW.time.textContent !== tm) KW.time.textContent = tm;
    KW.snow.setAttribute("transform", `translate(760 850) rotate(${f1(t * 12)})`);
    popS(KW.bar, t, 108.23, 24);
    KW.fill.setAttribute("width", f1(776 * 0.07 * easeIO(win(t, 108.5, 109.4))));
  } else if (id === "gDpf") {
    stepH($("dpH"), t, [[112.26, "Spaliny są <span class=\"ice\">za zimne</span>"], [114.04, "Żeby ją <em>wypalić</em>"], [114.99, "Każde <em>poranne</em> rozgrzewanie"], [116.79, "Krok bliżej do"]]);
    DP.flow.style.strokeDashoffset = f1(-(t * 80) % 36);
    popS(DP.temp, t, 112.45, 24);
    DP.tFill.setAttribute("width", f1(776 * 0.22 * easeIO(win(t, 112.6, 113.5))));
    popS(DP.burn, t, 114.33, 20);
    op(DP.layers[0], 1);
    DP.days.forEach((d, i) => popS(d, t, DP_DAYS[i], 24));
    DP.layers.forEach((lg, k) => { if (k > 0) op(lg, easeOut(win(t, DP_DAYS[k - 1] + 0.1, DP_DAYS[k - 1] + 0.4))); });
    stamp($("dpSt"), t, 118.39);
  } else if (id === "g30") {
    stepH($("t3H"), t, [[124.53, "<em>Zapnij pas</em>"], [125.53, "<em>Ustaw lusterka</em>"]]);
    const k = easeIO(win(t, 124.6, 127.7));
    dash(T3.ring, k, 1450);
    T3.ring.setAttribute("stroke", t >= 127.7 ? "#86dba1" : "#f5aa3c");
    const n = String(Math.round(30 * k));
    if (T3.num.textContent !== n) T3.num.textContent = n;
    popS(T3.belt.e, t, 125.02, 24); dash(T3.belt.ck, easeOut(win(t, 125.2, 125.5)), 120);
    popS(T3.mirror.e, t, 125.9, 24); dash(T3.mirror.ck, easeOut(win(t, 126.1, 126.4)), 120);
  } else if (id === "gTach") {
    stepH($("thH"), t, [[128.65, "Potem jedź <span class=\"ok\">spokojnie</span>"], [130.16, "Dopóki olej <span class=\"ice\">jest zimny</span>"], [131.61, "Ani <span class=\"hot\">pod odcięcie</span>"], [132.91, "Ani na <span class=\"hot\">1200 w piątce</span>"]]);
    op(TH.green, easeOut(win(t, 129.27, 129.7)));
    op(TH.redHi, easeOut(win(t, 132.14, 132.5)));
    op(TH.redLo, easeOut(win(t, 133.4, 133.8)));
    popS(TH.gear, t, 134.35, 24);
    const v = 2.6 + 0.35 * Math.sin((t - 128.65) * 1.3);
    const [x, y] = polar(TH.cx, TH.cy, TH.r - 70, thA(v));
    TH.needle.setAttribute("x2", f1(x)); TH.needle.setAttribute("y2", f1(y));
  } else if (id === "gPostoj") {
    stepH($("poH"), t, [[139.13, "Auto <em>stoi</em>"], [139.96, "Dłużej niż <em>minutę</em>"], [141.25, "W przepisach to już"]]);
    const s = t < 140.55 ? 60 * easeIO(win(t, 139.3, 140.55)) : 60 + (t - 140.55) * 2;
    const tm = mmss(s);
    if (PO.time.textContent !== tm) PO.time.textContent = tm;
    PO.time.setAttribute("style", `font-size:260px;font-weight:600;fill:${s >= 60 ? "#ff6a4d" : "#eef2f7"};letter-spacing:-0.04em`);
    popS(PO.car, t, 139.49, 24);
    PO.puff.forEach((p, i) => { const q = frac(t * 0.8 + i / 3); p.setAttribute("cx", f1(180 - q * 120)); p.setAttribute("cy", f1(990 - q * 40)); p.setAttribute("r", f1(14 + q * 34)); p.setAttribute("opacity", (0.8 * (1 - q)).toFixed(3)); });
    stamp($("poSt"), t, 142.17);
  } else if (id === "gSign") {
    stepH($("snH"), t, [[143.03, "Na <em>postoju</em>"], [144.0, "W terenie <em>zabudowanym</em>"], [145.19, "Silnik ma być <span class=\"ok\">wyłączony</span>"]]);
    popS(SN.sign, t, 144.0, 30);
    popS(SN.sw, t, 145.19, 24);
    const off = easeIO(win(t, 146.12, 146.5));
    SN.knob.setAttribute("cx", f1(lerp(535, 375, off)));
    SN.track.setAttribute("fill", off > 0.5 ? "#2f7a4a" : "#e2492b");
    SN.on.textContent = off > 0.5 ? "OFF" : "ON";
    SN.on.setAttribute("style", `font-size:64px;font-weight:600;fill:${off > 0.5 ? "#86dba1" : "#ff6a4d"}`);
    op(SN.law, easeOut(win(t, 145.5, 145.9)));
  } else if (id === "gRcpt") {
    stepH($("rcH"), t, [[152.72, "Płacisz <em>dwa razy</em>"], [154.06, "Raz <em>mechanikowi</em>"], [155.31, "Raz <span class=\"hot\">policji</span>"]]);
    pop($("rc1"), t, 154.06, 0.3, 60);
    pop($("rc2"), t, 155.31, 0.3, 60);
    $("rc1").style.transform = $("rc1").style.transform + " rotate(-2.5deg)";
    $("rc2").style.transform = $("rc2").style.transform + " rotate(2deg)";
  }
}

/* ================= engagement ================= */
const RW = ["??? zł", "Paliwo", "500 zł", "Turbo", "DPF", "Silnik"];
const RN = RW.length, RROW = 50, ANS = "100 zł mandatu", T_ANS = 151.34;
const BURSTS = [[7.9, 8.9, 2 * RN], [41.55, 42.25, 2 * RN], [59.9, 60.6, 2 * RN], [80.95, 81.65, 2 * RN], [100.65, 101.35, 2 * RN], [119.2, 119.9, 2 * RN], [137.85, 138.75, 2 * RN], [149.4, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 7.68, 153.1);
  rb.style.opacity = rOn ? (easeOut(win(t, 7.68, 8.0)) * (1 - easeIO(win(t, 152.7, 153.1)))).toFixed(3) : 0;
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
      easeOut(win(t, 7.68, 8.1)) * (1 - easeIO(win(t, 9.0, 9.5))),
      easeIO(win(t, 137.8, 138.2)) * (1 - easeIO(win(t, 138.7, 139.13))),
      easeIO(win(t, 149.2, 149.6)) * (1 - easeIO(win(t, 152.3, 152.72))),
    );
    rb.style.transform = "translate(" + (-60 * bigK).toFixed(1) + "px," + (300 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 152.95, 156.3);
  sc.style.opacity = sOn ? (easeOut(win(t, 152.95, 153.35)) * (1 - easeIO(win(t, 155.95, 156.3)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 152.95, 153.45))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 156.34, 162.5);
  pc.style.opacity = pOn ? (easeOut(win(t, 156.34, 156.74)) * (1 - easeIO(win(t, 162.2, 162.5)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 156.34, 156.74))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 157.65 ? (t < 158.45 ? easeOut(win(t, 157.65, 157.85)) : 0.5) : 0;
    const gB = t > 158.45 ? easeOut(win(t, 158.45, 158.65)) : 0;
    const alt = t > 160.38 ? 0.5 + 0.5 * Math.sin((t - 160.38) * 3) : -1;
    on("pkA", alt >= 0 ? alt : gA); on("pkB", alt >= 0 ? 1 - alt : gB);
    $("pickC").style.opacity = easeOut(win(t, 160.38, 160.7));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 162.5, 171.8);
  yc.style.opacity = yOn ? (easeOut(win(t, 162.5, 162.9)) * (1 - easeIO(win(t, 171.5, 171.8)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 162.5, 163.0))) * -60).toFixed(1) + "px)";
}

/* ================= render klatki ================= */
// plansza i 3D przenikają się przez 0,4 s zamiast twardego cięcia
const XF = 0.4;
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const si = shotIdx(t), [s0, , kind, name] = SHOTS[si], prev = SHOTS[si - 1];
  const fresh = prev && t - s0 < XF && ((prev[2] === "board" && kind === "3d") || (prev[2] === "3d" && kind === "board"));
  let boardK = 0, boardName = null, si3 = -1;
  if (kind === "board") { boardName = name; boardK = fresh ? easeIO((t - s0) / XF) : 1; if (fresh) si3 = si - 1; }
  else if (kind === "3d") { si3 = si; if (fresh) { boardName = prev[3]; boardK = 1 - easeIO((t - s0) / XF); } }
  bd.style.opacity = boardK.toFixed(3);
  if (boardName) drawBoard(t, boardName);
  $("plate").style.display = kind === "plate" ? "block" : "none";
  if (kind === "plate") drawPlate(t, name);
  $("brUi").style.display = kind === "broll" ? "block" : "none";
  if (kind === "broll") drawBr(t, name);
  const on3d = si3 >= 0;
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (on3d) render3D(t, si3);
}
function render3D(t, si) {
  const name = SHOTS[si][3];
  const deg = crankAt(t);
  const st = states(t, name);
  const bearOn = !!st.bear;
  R5W.visible = !bearOn;
  bear.group.visible = bearOn;
  if (bearOn) poseBear(t); else pose5(st, deg, t);
  applyCam(t, name, camera, si);
  lightAt(bearOn ? BP : new THREE.Vector3(0, 0, 0), camera);
  projCam = camera;
  drawTop(t, si);
  // obciążenie na jałowym
  const lOn = name === "idle";
  $("load").style.opacity = lOn ? easeOut(win(t, 84.24, 84.6)) : 0;
  $("loadB").style.width = (lOn ? 5 * easeIO(win(t, 84.5, 85.3)) : 0).toFixed(1) + "%";
  // callback do filmu o panewkach
  const cb = $("cbCard");
  if (name === "bear") pop(cb, t, 79.5, 0.3, 30); else cb.style.opacity = 0;
  drawTags(t, name);
  usePassCam(camera);
  composer.render();
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E5, bear, camera, composer, scene, SHOTS, K5, box5, SUMP_Y };
renderAt(0);
