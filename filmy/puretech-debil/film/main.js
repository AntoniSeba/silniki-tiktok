// Kurwa, tylko debil kupiłby ten silnik (1.2 PureTech). Część 8.
// Bohater: trzycylindrowy silnik z turbo i paskiem rozrządu w oleju (model R3 z filmu o downsizingu),
// do callbacku przekrój panewki z filmu o panewkach. Bez napisów na środku.
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia, bez pompowania kamery.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "../model/r3-turbo/lib/materials.js";
import { buildStudioEnvironment } from "../model/r3-turbo/lib/environment.js";
import { buildEngine } from "../model/r3-turbo/scene.js";
import * as K from "../model/r3-turbo/lib/engine.js";
import { buildBearing, CLEAR } from "./bearing.js";

const W = 1080, H = 1920, D = 166.527;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const backOut = (x) => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const frac = (x) => x - Math.floor(x);
const f1 = (v) => v.toFixed(1);
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

/* ================= ujęcia (każde wejście na słowie lektora) ================= */
const SHOTS = [
  [0, 1.8, "3d", "hook"], [1.8, 2.55, "broll", "b01"], [2.55, 4.55, "3d", "name"], [4.55, 5.85, "broll", "b02"],
  [5.85, 6.91, "broll", "b03"], [6.91, 9.64, "3d", "promise"], [9.64, 12.31, "3d", "promise2"], [12.31, 14.19, "broll", "b04"],
  [14.19, 17.18, "board", "gBrands"], [17.18, 20.07, "3d", "modern"], [20.07, 23.19, "broll", "b05"], [23.19, 26.03, "3d", "anatomy"],
  [26.03, 28.03, "3d", "turbo"], [28.03, 31.98, "board", "gCrankFire"], [31.98, 35.35, "3d", "belt"], [35.35, 36.91, "3d", "p1"],
  [36.91, 42.27, "board", "gDryWet"], [42.27, 46.83, "3d", "decay"], [46.83, 48.27, "broll", "b06"], [48.27, 51.07, "3d", "fall"],
  [51.07, 56.27, "3d", "sitko"], [56.27, 60.23, "board", "gPress"], [60.23, 63.23, "3d", "bearing"], [63.23, 66.47, "board", "gLamp"],
  [66.47, 68.14, "3d", "p3"], [68.14, 72.86, "3d", "vac"], [72.86, 76.34, "board", "gClaims"], [76.34, 78.03, "board", "gPedal"],
  [78.03, 79.75, "broll", "b07"], [79.75, 81.83, "3d", "p4"], [81.83, 86.11, "3d", "drip"], [86.11, 90.1, "board", "gDilute"],
  [90.1, 92.59, "3d", "p5"], [92.59, 100.92, "board", "gInterval"], [100.92, 105.02, "board", "gWarranty"], [105.02, 107.58, "3d", "nobody"],
  [107.58, 110.91, "broll", "b08"], [110.91, 113.88, "broll", "b09"], [113.88, 117.15, "3d", "lampWait"], [117.15, 124.98, "board", "gScan"],
  [124.98, 127.16, "3d", "noBelt"], [127.16, 128.67, "broll", "b10"], [128.67, 130.43, "board", "gCart"], [130.43, 133.0, "3d", "riposta"],
  [133.0, 135.96, "broll", "b11"], [135.96, 137.15, "3d", "promised"], [137.15, 138.19, "3d", "ans"], [138.19, 145.79, "board", "gTrophy"],
  [145.79, 147.37, "broll", "b12"], [147.37, 151.07, "board", "gOld"], [151.07, 152.56, "3d", "pickA"], [152.56, 156.12, "board", "gR4"],
  [156.12, 165.07, "3d", "yt"], [165.07, D + 1, "3d", "outro"],
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
renderer.toneMappingExposure = 1.0;
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
const key = new THREE.DirectionalLight(0xfffaf2, 2.8);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 200, far: 8000, left: -1100, right: 1100, top: 1100, bottom: -1100 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.45); scene.add(fill); scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xffffff, 0.8); scene.add(rim); scene.add(rim.target);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));
// światło kluczowe zawsze po stronie kamery, żeby przód silnika nie był pod światło
function lightAt(b, cam) {
  const sx = cam.position.x >= b.x ? 1 : -1, sz = cam.position.z >= b.z ? 1 : -1;
  key.position.set(b.x + sx * 1400, b.y + 2100, b.z + sz * 1600); key.target.position.copy(b);
  fill.position.set(b.x - sx * 1700, b.y + 800, b.z + sz * 1200); fill.target.position.copy(b);
  rim.position.set(b.x - sx * 600, b.y + 1300, b.z - sz * 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a);
function glowMats(root, col = AMBER, skip = null) {
  const out = [];
  if (!root) return out;
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || (skip && skip(o))) return;
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
const additive = (col, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side });

/* ================= R3 turbo (1.2 PureTech) ================= */
const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E = buildEngine(M);
applyMaterialVariation(E.root, M);
fixNormals(E.root);
E.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(E.root);
const PT = E.parts;
const B = PT.block, R = PT.rotating, HD = PT.head, IND = PT.induction, TM = PT.timing;
const NC = K.CYL_X.length;
const crank = R.groups.crank;
const pistons = R.groups.pistons, rods = R.groups.rods;
const pistGlow = pistons.map((p) => glowMats(p));
const rodGlow = rods.map((r) => glowMats(r));
const mainGlow = K.MAIN_X.map((_, i) => glowMats(crank.getObjectByName(`MainJournal_${i + 1}`)));
const crankGlow = glowMats(crank, AMBER, (o) => /^MainJournal_/.test(o.name));
const deckMeshes = ["Deck_Plate", "Deck_FaceMachined"].map((n) => B.groups.core.getObjectByName(n)).filter(Boolean);
const turbo = IND.turbos[0];
const turboGlow = glowMats(turbo.group);
const fuelGlow = glowMats(HD.groups.fuel);
const beltMesh = TM.root.getObjectByName("Timing_Belt");
beltMesh.material = beltMesh.material.clone();
beltMesh.material.transparent = true;
beltMesh.material.emissive = AMBER.clone(); beltMesh.material.emissiveIntensity = 0;
const BELT_COL0 = beltMesh.material.color.clone(), BELT_ROT = new THREE.Color(0x3a2616);
const DECK = K.L.deckY, BORE_R = K.L.boreR;

// żar zapłonu i gaz suwu pracy
const flashes = [], pows = [], sprays = [];
for (let i = 0; i < NC; i++) {
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), additive(0xff8a2a));
  f.scale.set(1, 0.55, 1); f.visible = false; E.root.add(f); flashes.push({ m: f, mat: f.material });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 3, BORE_R - 3, 1, 32), additive(0xff7a1a));
  p.visible = false; E.root.add(p); pows.push({ m: p, mat: p.material });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(34, 90, 24, 1, true), additive(0xffd27a, THREE.DoubleSide));
  cone.visible = false; E.root.add(cone); sprays.push({ m: cone, mat: cone.material });
}
const softFire = (x) => (x < 30 ? easeIO(x / 30) : x < 180 ? 1 - easeIO((x - 30) / 150) : 0);

// olej w rozrządzie: pasek pracuje w oleju
const BELT_X = K.L.camSprocketX;
const oilMat = new THREE.MeshStandardMaterial({ color: 0xd08a20, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.0, emissive: new THREE.Color(0x3a1c00), emissiveIntensity: 0.2, depthWrite: false });
const oilBox = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 360), oilMat);
oilBox.position.set(BELT_X, 0, -10);
oilBox.visible = false;
E.root.add(oilBox);
// smok: sitko pompy oleju na dnie miski
const STRAIN = new THREE.Vector3(-60, -170, 0);
const strainer = new THREE.Group();
strainer.position.copy(STRAIN);
E.root.add(strainer);
const strainMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.5, roughness: 0.7, emissive: RED.clone(), emissiveIntensity: 0 });
{
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.8, roughness: 0.4 });
  strainer.add(new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 10, 32), steel));
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 11, 32), strainMat);
  strainer.add(mesh);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 150, 16), steel);
  tube.position.set(0, 80, 0);
  strainer.add(tube);
}
strainer.visible = false;
// olej płynący w górę rurki smoka
const flowDots = [];
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), additive(0xffb04a));
  m.visible = false; E.root.add(m); flowDots.push(m);
}
// olej w misce (widoczny w przekroju), rozrzedzany benzyną
const panOilMat = new THREE.MeshStandardMaterial({ color: 0xb8740f, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0, emissive: new THREE.Color(0x3a1c00), emissiveIntensity: 0.35, depthWrite: false });
const panOil = new THREE.Mesh(new THREE.BoxGeometry(330, 1, 190), panOilMat);
panOil.visible = false;
E.root.add(panOil);
const PAN_OIL_A = new THREE.Color(0xb8740f), PAN_OIL_B = new THREE.Color(0xe6d59a);
// benzyna spływająca po ściankach cylindrów
const drips = [];
for (let i = 0; i < NC; i++) for (let j = 0; j < 5; j++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), additive(0xffe7a0));
  m.scale.set(1, 1.8, 1); m.visible = false; E.root.add(m);
  drips.push({ m, i, j, ph: hash(i * 7 + j * 3.1) });
}
// pompa podciśnienia na końcu wałka wydechowego, zasilana olejem
const VAC = new THREE.Vector3(K.L.blockXRear + 55, K.L.camY - 10, -40);
const vacMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, metalness: 0.75, roughness: 0.35, emissive: RED.clone(), emissiveIntensity: 0 });
const vacPump = new THREE.Group();
vacPump.position.copy(VAC);
E.root.add(vacPump);
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 64, 40), vacMat);
  body.rotation.z = Math.PI / 2; vacPump.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(40, 50, 14, 40), vacMat);
  lid.rotation.z = Math.PI / 2; lid.position.x = 38; vacPump.add(lid);
  const port = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 70, 16), new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.8 }));
  port.position.set(10, 60, 0); vacPump.add(port);
}
const vacLineMat = new THREE.MeshStandardMaterial({ color: 0x6c737c, metalness: 0.7, roughness: 0.4, emissive: AMBER.clone(), emissiveIntensity: 0 });
const vacLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(VAC.x - 10, VAC.y - 48, VAC.z), new THREE.Vector3(VAC.x - 20, VAC.y - 160, VAC.z - 50), new THREE.Vector3(K.L.blockXRear - 10, 60, -K.L.blockWallZ - 6),
]), 40, 6, 10, false), vacLineMat);
E.root.add(vacLine);
E.root.updateMatrixWorld(true);
// płatki paska: odrywają się, spływają do miski, zatykają sitko; kilka leci do pompy podciśnienia
const beltPts = [];
{
  const pos = beltMesh.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 12) { v.fromBufferAttribute(pos, i); beltMesh.localToWorld(v); beltPts.push(E.root.worldToLocal(v.clone())); }
}
const flakeMat = new THREE.MeshStandardMaterial({ color: 0x3e3a36, roughness: 0.6, metalness: 0.1, emissive: new THREE.Color(0x5a2a08), emissiveIntensity: 0.5 });
const flakes = [];
for (let i = 0; i < 90; i++) {
  const s = beltPts[Math.floor(hash(i * 3.3) * beltPts.length)];
  const m = new THREE.Mesh(new THREE.BoxGeometry(16 + hash(i) * 16, 4, 12 + hash(i + 5) * 18), flakeMat);
  m.visible = false;
  E.root.add(m);
  const drift = new THREE.Vector3(-18 - hash(i + 13) * 26, (hash(i + 17) - 0.5) * 40, (hash(i + 19) - 0.5) * 60);
  flakes.push({ m, s, drift, e: STRAIN.clone().add(new THREE.Vector3((hash(i + 1) - 0.5) * 70, 8 + hash(i + 2) * 20, (hash(i + 4) - 0.5) * 70)), d: hash(i + 9) * 0.5, sp: hash(i + 11) });
}
const vacFlakes = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 10), flakeMat);
  m.visible = false; E.root.add(m);
  vacFlakes.push({ m, d: hash(i * 5.7) * 0.6 });
}
const vacCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(K.L.blockXRear - 10, 60, -K.L.blockWallZ - 6), new THREE.Vector3(VAC.x - 20, VAC.y - 160, VAC.z - 50), new THREE.Vector3(VAC.x - 10, VAC.y - 48, VAC.z)]);
const worldCenter = (o) => { E.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); };
const TURBO_C = worldCenter(turbo.group);
const FUEL_C = worldCenter(HD.groups.fuel);
const BELT_C = worldCenter(beltMesh);

/* ================= panewka (callback do odcinka o panewkach), stanowisko 80 m niżej ================= */
const BP = new THREE.Vector3(0, -80000, 0);
const bear = buildBearing();
bear.group.position.copy(BP);
bear.group.scale.setScalar(100);
scene.add(bear.group);

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260928;
  const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const orig = Math.random;
  Math.random = seeded;
  ssaoPass = new SSAOPass(scene, camera, W, H);
  Math.random = orig;
  Object.assign(ssaoPass, { kernelRadius: 160, minDistance: 40, maxDistance: 1400 });
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
// wał wzdłuż X, rozrząd z przodu (-X), turbo i wydech po -Z, dolot po +Z
// az = 0: od tyłu (+X), FRONT: od przodu (-X), SIN: od dolotu (+Z), EXH: od wydechu (-Z)
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const Pv = (az, el, r, v, fov, oy) => ({ az, el, r, x: v.x, y: v.y, z: v.z, fov, oy });
const PB = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x: BP.x + x, y: BP.y + y, z: BP.z + z, fov, oy });
const SIN = Math.PI / 2, EXH = -Math.PI / 2, FRONT = Math.PI;
const CX = -70, CY = 120, CZ = -20;
const Pw = (az, el, r, oy = 60, fov = 32) => P(az, el, r, CX, CY, CZ, fov, oy);
const P0 = Pw(-2.7, 0.3, 4300, -290);
const CAM = {
  hook: [[0, P0], [0.6, Pw(-2.45, 0.24, 3550, -250)], [1.8, Pw(-2.2, 0.2, 3350, -230)]],
  name: [[2.55, P(-1.85, 0.34, 2800, CX, 220, -60, 32, 60)], [4.55, P(-1.6, 0.3, 2800, CX, 220, -60, 32, 60)]],
  mem: [[4.55, Pw(2.45, 0.2, 3300)], [7.65, Pw(2.0, 0.17, 3300)]],
  promise: [[6.91, P(1.15, 0.32, 5600, CX, 200, 0, 32, 60)], [9.64, P(0.7, 0.26, 5600, CX, 200, 0, 32, 60)]],
  promise2: [[9.64, P(-0.8, 0.3, 5000, CX, 200, 0, 32, 80)], [12.31, P(-1.25, 0.22, 5000, CX, 200, 0, 32, 80)]],
  sold: [[12.31, Pw(-2.85, 0.14, 3300)], [14.19, Pw(-2.5, 0.2, 3300)]],
  modern: [[17.18, Pw(1.15, 0.3, 3300, 110)], [20.07, Pw(1.6, 0.22, 3300, 110)]],
  why: [[20.07, Pw(-2.95, 0.1, 3100)], [23.19, Pw(-2.62, 0.15, 3100)]],
  anatomy: [[23.19, P(SIN + 0.3, 0.3, 3000, -20, 150, 0, 32, 20)], [26.03, P(SIN + 0.12, 0.26, 3000, -20, 150, 0, 32, 20)]],
  turbo: [[26.03, P(EXH - 0.5, 0.26, 2500, -20, 150, -110, 32, 60)], [28.03, P(EXH - 0.28, 0.2, 2500, -20, 150, -110, 32, 60)]],
  crank: [[28.03, P(FRONT - 0.5, 0.25, 1500, -205, 0, 0, 30, -40)], [29.1, P(FRONT - 0.04, 0.02, 1500, -205, 0, 0, 30, -40)], [30.2, P(FRONT, 0, 1500, -205, 0, 0, 30, -40)]],
  fire: [[30.2, P(0.4, 0.95, 2900, -20, 180, 0, 32, 170)], [31.98, P(0.62, 0.9, 2900, -20, 180, 0, 32, 170)]],
  belt: [[31.98, P(FRONT + 0.4, 0.2, 2300, -217, 170, 0, 32, 40)], [35.35, P(FRONT + 0.14, 0.12, 2300, -217, 170, 0, 32, 40)]],
  p1: [[35.35, P(FRONT - 0.6, 0.3, 2700, -150, 150, 0, 32, 60)], [36.91, P(FRONT - 0.4, 0.25, 2700, -150, 150, 0, 32, 60)]],
  decay: [[42.27, P(FRONT + 0.32, 0.1, 1900, -217, 170, 0, 32, 40)], [46.83, P(FRONT + 0.1, 0.06, 1900, -217, 170, 0, 32, 40)]],
  p2: [[46.83, P(FRONT + 0.8, 0.12, 3000, -60, 30, 0, 32, 60)], [48.27, P(FRONT + 0.95, 0.09, 3000, -60, 30, 0, 32, 60)]],
  fall: [[48.27, P(FRONT - 0.85, 0.06, 2400, -120, 10, 0, 32, 60)], [51.07, P(FRONT - 1.05, 0.03, 2400, -120, 10, 0, 32, 60)]],
  sitko: [[51.07, P(FRONT + 0.72, 0.12, 2000, -60, -90, 0, 32, 40)], [56.27, P(FRONT + 1.02, 0.14, 2000, -60, -90, 0, 32, 40)]],
  bearing: [[60.23, PB(SIN + 0.1, 0.05, 2000, 0, -30, 0, 32, 170)], [63.23, PB(SIN - 0.06, 0.03, 2000, 0, -30, 0, 32, 170)]],
  p3: [[66.47, Pw(0.5, 0.26, 3300)], [68.14, Pw(0.75, 0.2, 3300)]],
  vac: [[68.14, P(-0.55, 0.26, 2400, 150, 260, -50, 32, 60)], [72.86, P(-0.2, 0.2, 2400, 150, 260, -50, 32, 60)]],
  p4: [[79.75, P(SIN + 0.45, 0.28, 3000, -20, 120, 0, 32, 60)], [81.83, P(SIN + 0.3, 0.24, 3000, -20, 120, 0, 32, 60)]],
  drip: [[81.83, P(SIN + 0.12, 0.08, 2100, 0, 60, 0, 32, 60)], [86.11, P(SIN - 0.08, 0.06, 2100, 0, 60, 0, 32, 60)]],
  p5: [[90.1, P(FRONT - 0.4, 0.22, 3000, -110, 150, 0, 32, 60)], [92.59, P(FRONT - 0.2, 0.18, 3000, -110, 150, 0, 32, 60)]],
  nobody: [[105.02, Pw(-2.2, 0.28, 3300)], [107.58, Pw(-1.85, 0.22, 3300)]],
  honest: [[107.58, Pw(1.95, 0.18, 3300)], [110.91, Pw(1.5, 0.24, 3300)]],
  care: [[110.91, P(FRONT - 0.36, 0.16, 2300, -217, 170, 0, 32, 110)], [113.88, P(FRONT - 0.14, 0.12, 2300, -217, 170, 0, 32, 110)]],
  lampWait: [[113.88, P(SIN - 0.3, 0.1, 2600, -20, 20, 0, 32, 60)], [117.15, P(SIN - 0.1, 0.08, 2600, -20, 20, 0, 32, 60)]],
  noBelt: [[124.98, P(FRONT + 0.52, 0.25, 2200, -217, 170, 0, 32, 40)], [128.67, P(FRONT + 0.3, 0.2, 2200, -217, 170, 0, 32, 40)]],
  riposta: [[130.43, Pw(-2.7, 0.22, 3300)], [135.96, Pw(-2.1, 0.26, 3300)]],
  promised: [[135.96, Pw(0.95, 0.3, 3700)], [137.15, Pw(0.78, 0.26, 3700)]],
  ans: [[137.15, Pw(-0.6, 0.14, 3300, 80)], [138.19, Pw(-0.4, 0.11, 3300, 80)]],
  jury: [[145.79, Pw(2.25, 0.2, 3300)], [147.37, Pw(2.0, 0.16, 3300)]],
  pickA: [[151.07, Pw(0.9, 0.22, 3500, 300)], [152.56, Pw(0.72, 0.2, 3500, 300)]],
  yt: [[156.12, P(1.3, 0.26, 6700, CX, 230, 0, 32, 330)], [165.07, P(-0.4, 0.3, 6700, CX, 230, 0, 32, 330)]],
  outro: [[165.07, Pw(-2.95, 0.34, 4300, -290)], [D, P0], [D + 1, Pw(-2.45, 0.24, 3550, -250)]],
};
// bez pompowania: w obrębie ujęcia kamera krąży w stałej odległości
for (const name in CAM) {
  // hook ma dojazd jak w filmie o 2JZ; poza nim odległość stała
  if (name === "hook") continue;
  const r = name === "outro" ? P0.r : CAM[name][CAM[name].length - 1][1].r;
  CAM[name] = CAM[name].map(([tk, k]) => [tk, { ...k, r }]);
}
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
// efekty z hooka 2JZ tylko do końca hooka: błysk, najazd i drgnięcie na mocnych słowach
const HOOK_END = 7.65;
const BEATS = [0.81, 2.55, 6.91];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const FLASHES = [[0.81, 0.14, 0.5], [2.55, 0.16, 0.55], [6.91, 0.18, 0.45]];
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam = camera, si = shotIdx(t)) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  if (t < HOOK_END) {
    // hook jak w filmie o 2JZ: cięcie wpada z odjazdu i skrętu, mocne słowa dają najazd i krótkie drgnięcie
    if (si > 0) {
      const cut = 1 - easeOut(win(t, SHOTS[si][0], SHOTS[si][0] + 0.5));
      v.r *= 1 + 0.22 * cut;
      v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.16 * cut;
      v.el += 0.05 * cut;
    }
    const bk = beatK(t);
    v.r *= 1 - 0.07 * bk;
    const shk = 0.9 * bk;
    if (shk > 0) { v.az += shk * 0.012 * Math.sin(t * 47); v.el += shk * 0.009 * Math.sin(t * 59 + 1); }
  } else if (si > 0 && si < SHOTS.length - 1) {
    // po cięciu miękkie osiadanie tylko w azymucie, odległość stała
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
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silnika ================= */
const blank = () => ({
  ex: 0, fireHard: 0, section: 0, noInd: 0, noPan: 0, crankOnly: 0, fire: 0, pow: 0, spray: 0, gP: 0, mains: 0, gCrank: 0,
  gTurbo: 0, gFuel: 0, oil: 0, belt: 0, beltCol: AMBER, rot: 0, beltFade: 0, flakes: -1, strainer: 0, clog: 0, flow: 0,
  vac: 0, vacOil: 0, vacFl: -1, drip: 0, panOil: 0, dilute: 0, bear: 0,
});
const hookE = (t) => 0.55 * (1 - easeOut(win(t, 0, 1.6)));
function states(t, name) {
  const s = blank();
  let base = new THREE.Vector3(CX, CY, CZ);
  switch (name) {
    case "hook": s.ex = 0.9 * Math.pow(1 - clamp01(t / 0.55), 2); s.fire = 1; s.fireHard = 1; s.pow = 1; s.gTurbo = 0.7 * easeOut(win(t, 0.81, 1.1)); break;
    case "outro": s.ex = 0.9 * Math.pow(win(t, 165.07, D), 2); s.fire = 1; s.fireHard = t >= 165.8 ? 1 : 0; s.pow = t >= 165.8 ? 1 : 0; break;
    case "name": s.fire = 1; s.fireHard = 1; s.gTurbo = 0.25 * easeOut(win(t, 2.6, 3.1)); break;
    case "mem": s.fire = 1; break;
    case "promise": s.ex = 0.75 * easeOut(win(t, 6.91, 7.25)); break;
    case "promise2": s.ex = 0.75 * (1 - easeIO(win(t, 9.64, 11.9))); break;
    case "sold": s.fire = 1; break;
    case "modern": s.gTurbo = 0.2; break;
    case "why": s.oil = 1; s.belt = 0.5 * easeOut(win(t, 21.87, 22.4)); s.beltCol = RED; break;
    case "anatomy": s.section = 1; s.noInd = 1; s.gP = 0.9 * easeOut(win(t, 23.4, 23.9)); break;
    case "turbo": s.gTurbo = 0.5 * easeOut(win(t, 26.03, 26.5)); s.gFuel = 1.0 * easeOut(win(t, 26.41, 26.8)); break;
    case "crank": s.crankOnly = 1; s.gCrank = 0.25 * easeOut(win(t, 28.8, 29.2)); break;
    case "fire": s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1; break;
    case "belt": s.noInd = 1; s.belt = 0.6 * easeOut(win(t, 32.66, 33.1)); s.oil = easeIO(win(t, 33.66, 34.9)); break;
    case "p1": s.noInd = 1; s.oil = 1; s.belt = 0.45; break;
    case "decay": {
      s.noInd = 1; s.oil = 1;
      s.rot = easeIO(win(t, 43.41, 44.6));
      s.belt = 0.25 + 0.3 * easeOut(win(t, 43.41, 43.9)); s.beltCol = RED;
      s.flakes = t >= 44.59 ? 0.22 * easeOut(win(t, 44.59, 46.83)) : -1;
      break;
    }
    case "p2": s.noInd = 1; s.section = 1; s.noPan = 1; s.strainer = 1; s.rot = 1; s.flakes = 0.22; s.panOil = 1; break;
    case "fall": s.noInd = 1; s.section = 1; s.noPan = 1; s.strainer = 1; s.rot = 1; s.panOil = 1; s.flakes = 0.22 + 0.58 * easeIO(win(t, 48.4, 50.6)); break;
    case "sitko": {
      s.noInd = 1; s.section = 1; s.noPan = 1; s.strainer = 1; s.rot = 1; s.panOil = 1;
      s.flakes = 0.8 + 0.2 * easeIO(win(t, 54.79, 55.8)); s.panOil = 0;
      s.clog = 0.9 * easeOut(win(t, 55.2, 55.9));
      s.flow = (t >= 53.3 ? easeOut(win(t, 53.3, 53.7)) : 0) * (1 - 0.85 * easeIO(win(t, 55.2, 56.0)));
      break;
    }
    case "bearing": {
      s.bear = 1;
      base = BP;
      break;
    }
    case "p3": s.vac = 0.2 * easeOut(win(t, 66.8, 67.3)); break;
    case "vac": s.vac = 0.25; s.vacOil = 0.9 * easeOut(win(t, 71.41, 71.9)); break;
    case "p4": s.section = 1; s.noInd = 1; s.spray = 1; s.gFuel = 0.8; s.fire = 1; break;
    case "drip": s.section = 1; s.noInd = 1; s.spray = 1; s.gFuel = 0.6; s.drip = easeOut(win(t, 84.0, 84.5)); s.panOil = 1; s.noPan = 1; s.dilute = 0.5 * easeIO(win(t, 85.55, 86.11)); break;
    case "p5": s.noInd = 1; s.oil = 1; s.belt = 0.55; break;
    case "nobody": s.fire = 1; s.belt = 0.35 * easeOut(win(t, 106.49, 106.9)); s.beltCol = RED; break;
    case "honest": s.fire = 1; break;
    case "care": s.noInd = 1; s.oil = 1; s.belt = 0.6 * easeOut(win(t, 112.8, 113.2)); s.beltCol = GREEN; break;
    case "lampWait": s.section = 1; s.noInd = 1; s.noPan = 1; s.mains = 0.9 * easeOut(win(t, 115.41, 115.9)); s.gCrank = 0.15 * easeOut(win(t, 115.41, 115.9)); break;
    case "noBelt": s.noInd = 1; s.oil = 1; s.belt = 0.4; s.rot = 0.6; break;
    case "riposta": {
      s.fire = 1; s.noInd = t >= 132.9 ? 1 : 0; s.oil = t >= 132.9 ? 1 : 0;
      s.belt = 0.4 * easeOut(win(t, 133.0, 133.4)); s.beltCol = RED; s.rot = easeIO(win(t, 133.0, 134.2));
      s.flakes = t >= 133.34 ? 0.2 * easeOut(win(t, 133.34, 135.9)) : -1;
      break;
    }
    case "promised": break;
    case "ans": s.fire = 1; break;
    case "jury": s.fire = 1; break;
    case "pickA": s.fire = 1; s.belt = 0.3; break;
    case "yt": s.ex = easeIO(win(t, 156.5, 163.0)); break;
  }
  return { s, base };
}

function pose(st, deg, t) {
  E.update(deg, { explode: st.ex, turboDeg: t * TB_RATE });
  const co = !!st.crankOnly;
  B.root.visible = !co;
  HD.root.visible = !co;
  TM.root.visible = !co;
  IND.root.visible = !co && !st.noInd;
  pistons.forEach((p) => { p.visible = !co; });
  rods.forEach((r) => { r.visible = !co; });
  R.groups.flywheel.visible = !co;
  for (const g of [B.groups.skinIn, B.groups.skinEx, HD.groups.skinIn, HD.groups.skinEx]) g.visible = !st.section;
  deckMeshes.forEach((o) => { o.visible = !st.section; });
  B.groups.pan.visible = !st.noPan;
  TM.groups.covers.visible = false;
  for (let i = 0; i < NC; i++) { setGlow(pistGlow[i], st.gP, AMBER); setGlow(rodGlow[i], st.gP * 0.6, AMBER); }
  mainGlow.forEach((ms, i) => setGlow(ms, st.mains * (1.3 + 0.2 * Math.sin(i * 1.7)), RED));
  setGlow(crankGlow, st.gCrank, st.mains > 0 ? RED : AMBER);
  setGlow(turboGlow, st.gTurbo, AMBER);
  setGlow(fuelGlow, st.gFuel, AMBER);
  // pasek: kolor gumy ciemnieje i brązowieje, gdy olej go rozkłada
  const bm = beltMesh.material;
  bm.color.lerpColors(BELT_COL0, BELT_ROT, st.rot);
  bm.emissive.copy(st.beltCol);
  bm.emissiveIntensity = st.belt;
  bm.opacity = 1 - st.beltFade;
  beltMesh.visible = !co && st.beltFade < 0.99;
  // zapłon jako miękki żar i gaz suwu pracy
  for (let i = 0; i < NC; i++) {
    const ph = wrap(deg - K.firePhaseDeg(i + 1), 720);
    flashes[i].m.position.set(K.CYL_X[i], DECK + 12, 0);
    if (st.fireHard && !co) {
      // w hooku zapłon jak w 2JZ: ostry błysk, który szybko gaśnie
      const k = ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
      flashes[i].m.visible = k > 0.01;
      flashes[i].mat.opacity = k;
      flashes[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    } else {
      const k = st.fire && !co ? softFire(ph) : 0;
      flashes[i].m.visible = k > 0.01;
      flashes[i].mat.opacity = 0.45 * k;
      flashes[i].mat.color.setRGB(1.3, 0.55, 0.16);
    }
    const on = !!st.pow && ph < 180 && !co;
    pows[i].m.visible = on;
    if (on) {
      const crown = K.pistonCrownY(deg, i + 1), len = Math.max(2, DECK + 8 - crown);
      pows[i].m.scale.set(1, len, 1);
      pows[i].m.position.set(K.CYL_X[i], crown + len / 2, 0);
      pows[i].mat.opacity = 0.55 * Math.sin(Math.PI * (ph / 180));
      pows[i].mat.color.setRGB(1.3 - 0.3 * (ph / 180), 0.5 - 0.2 * (ph / 180), 0.12);
    }
    // wtrysk w suwie ssania: stożek mgły paliwa, łagodnie narasta i gaśnie
    const intake = ph > 540 ? (ph - 540) / 180 : -1;
    const sk = st.spray && !co && intake >= 0 ? st.spray * Math.sin(intake * Math.PI) : 0;
    sprays[i].m.visible = sk > 0.02;
    sprays[i].m.position.set(K.CYL_X[i] - 6, DECK - 30, 6);
    sprays[i].mat.opacity = 0.7 * sk;
  }
  // olej w rozrządzie
  oilBox.visible = !co && st.oil > 0.01;
  if (oilBox.visible) { const h = 20 + 560 * st.oil; oilBox.scale.y = h; oilBox.position.y = -110 + h / 2; }
  // sitko, przepływ, zatkanie
  strainer.visible = !co && st.strainer > 0;
  strainMat.emissiveIntensity = st.clog;
  flowDots.forEach((m, i) => {
    m.visible = strainer.visible && st.flow > 0.02;
    if (!m.visible) return;
    const p = frac(t * 0.9 * (0.15 + 0.85 * st.flow) + i / flowDots.length);
    m.position.set(STRAIN.x, STRAIN.y + 8 + p * 140, STRAIN.z);
    m.material.opacity = 0.85 * st.flow * Math.sin(p * Math.PI);
  });
  // olej w misce
  panOil.visible = !co && st.panOil > 0 && !!st.section;
  if (panOil.visible) {
    const h = 26 + 10 * st.dilute;
    panOil.scale.y = h; panOil.position.set(0, K.L.panBottomY + 2 + h / 2, 0);
    panOilMat.color.lerpColors(PAN_OIL_A, PAN_OIL_B, st.dilute);
  }
  // benzyna po ściankach
  drips.forEach((d) => {
    d.m.visible = !co && st.drip > 0.02;
    if (!d.m.visible) return;
    const p = frac(t * 0.55 + d.ph);
    const y = lerp(DECK - 40, K.L.panBottomY + 30, easeIO(p));
    d.m.position.set(K.CYL_X[d.i] + (d.j - 2) * 15, y, BORE_R - 3);
    d.m.material.opacity = 0.9 * st.drip * Math.sin(p * Math.PI);
  });
  // pompa podciśnienia
  vacPump.visible = !co;
  vacLine.visible = !co;
  vacMat.emissive.copy(st.vacFl >= 0 ? RED : AMBER);
  vacMat.emissiveIntensity = st.vac;
  vacLineMat.emissiveIntensity = st.vacOil;
  vacFlakes.forEach((f) => {
    f.m.visible = !co && st.vacFl >= 0;
    if (!f.m.visible) return;
    const p = clamp01((st.vacFl - f.d) / 0.4);
    f.m.position.copy(vacCurve.getPoint(0.2 + 0.8 * p));
    f.m.rotation.set(f.d * 9, f.d * 5, 0);
  });
  // płatki paska
  flakes.forEach((f, i) => {
    const on = !co && st.flakes >= 0;
    f.m.visible = on;
    if (!on) return;
    // pierwsza ćwiartka: odrywanie się od paska w oleju, potem spływ do sitka
    const pe = clamp01((st.flakes - f.d * 0.3) / 0.25);
    const pf = clamp01((st.flakes - 0.25 - f.d * 0.5) / (0.75 - f.d * 0.5));
    const e = pf * pf * (3 - 2 * pf);
    const from = f.s.clone().addScaledVector(f.drift, easeOut(pe));
    f.m.position.lerpVectors(from, f.e, e);
    f.m.visible = pe > 0.02;
    f.m.rotation.set(i + pe * 1.2 + e * 2, i * 2 + e * 1.4, i);
  });
  E.root.updateMatrixWorld(true);
  // panewka
  bear.group.visible = !!st.bear;
}
// panewka: klin olejowy znika, czop opada, metal trze o metal
function bearState(t, deg) {
  const k = easeIO(win(t, 60.5, 61.6));
  return { ang: -deg * D2R * 0.5, e: lerp(0.09, CLEAR * 0.985, k), fill: lerp(1, 0.08, k), glow: 0, oilGlow: 0 };
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
const popS = (el, t, at, dy = 30) => { const k = easeOut(win(t, at, at + 0.4)); el.setAttribute("opacity", f1(k)); el.setAttribute("transform", `translate(0 ${f1((1 - k) * dy)})`); return k; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const mkT = (txt, attrs, parent) => { const e = mkEl("text", attrs, parent); e.textContent = txt; return e; };
const dash = (el, k, L = 1600) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
const stepH = (el, t, list) => { let cur = list[0]; for (const x of list) if (t >= x[0]) cur = x; setH(el, cur[1], t, cur[0]); };
// stempel: miękkie wejście, bez uderzenia
const stampK = (el, t, at, base = "translate(-50%,-50%) rotate(-7deg)") => {
  const k = easeOut(win(t, at, at + 0.4));
  el.style.opacity = k;
  el.style.transform = base + " scale(" + (1.12 - 0.12 * k).toFixed(3) + ")";
};

// etykiety z linią
const W3 = (x, y, z) => () => E.root.localToWorld(new THREE.Vector3(x, y, z));
const TAGS = [
  { t0: 26.03, t1: 28.03, text: "Turbo", a: () => TURBO_C, off: [-170, -300], c: "oil" },
  { t0: 26.41, t1: 28.03, text: "Wtrysk bezpośredni", a: () => FUEL_C, off: [150, -330], c: "oil" },
  { t0: 32.66, t1: 35.35, text: "Pasek rozrządu", a: () => beltPts[Math.floor(beltPts.length * 0.3)].clone().applyMatrix4(E.root.matrixWorld), off: [190, -250], c: "oil" },
  { t0: 51.53, t1: 56.27, text: "Smok · sitko", a: () => STRAIN.clone().applyMatrix4(E.root.matrixWorld), off: [150, 250], c: "hot" },
  { t0: 68.38, t1: 72.86, text: "Pompa podciśnienia", a: () => VAC.clone().applyMatrix4(E.root.matrixWorld), off: [-160, -330], c: "hot" },
  { t0: 71.41, t1: 72.86, text: "Olej", a: () => vacCurve.getPoint(0.45).applyMatrix4(E.root.matrixWorld), off: [160, 260], c: "oil" },
  { t0: 84.4, t1: 86.11, text: "Benzyna", a: W3(K.CYL_X[1], 60, BORE_R), off: [170, 280], c: "hot" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = { hot: "#e2492b", ok: "#86dba1" }[tg.c] || "#f5aa3c";
  tg.line = mkEl("path", { fill: "none", stroke: col, "stroke-width": 2.5 }, $("tagLines"));
  tg.dot = mkEl("circle", { r: 7, fill: col }, $("tagLines"));
});
function drawTags(t) {
  const sh = shotAt(t);
  for (const tg of TAGS) {
    const on = inR(t, tg.t0, tg.t1 + 0.18) && sh === shotAt(tg.t0);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    const p = project(tg.a());
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    y = Math.max(560, Math.min(1400, y));
    x = Math.max(210, Math.min(y > 1000 ? 700 : 860, x));
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
// numery cylindrów nad głowicą
const badges = K.CYL_X.map((x, i) => { const el = document.createElement("div"); el.className = "badge"; el.textContent = String(i + 1); $("badges").appendChild(el); return { el, x }; });
// gwiazda wykorbień z przodu wału: 3 ramiona co 120°
const STAR_X = K.MAIN_X[0] - 42;
const starArms = [1, 2, 3].map((id) => {
  const ln = mkEl("path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, $("star"));
  const cc = mkEl("circle", { r: 26, fill: "rgba(10,14,19,0.92)", stroke: "#f5aa3c", "stroke-width": 4 }, $("star"));
  const tx = mkT(String(id), { "text-anchor": "middle", "dominant-baseline": "central", style: "font-size:28px;font-weight:600;fill:#eef2f7" }, $("star"));
  return { id, ln, cc, tx, a: K.pinOffsetDeg(id) * D2R };
});
const starHub = mkEl("circle", { r: 16, fill: "#f5aa3c" }, $("star"));
const starArc = mkEl("path", { fill: "rgba(245,170,60,0.16)", stroke: "#eef2f7", "stroke-width": 3 }, $("star"));
const starArcT = mkT("120°", { "text-anchor": "middle", "dominant-baseline": "central", style: "font-size:54px;font-weight:600;fill:#f5aa3c;paint-order:stroke;stroke:rgba(6,8,11,0.92);stroke-width:10px" }, $("star"));
const cp = (a, r) => localPoint(crank, STAR_X, Math.cos(a) * r, Math.sin(a) * r);
function drawStar(t, on) {
  $("star").setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  const hub = cp(0, 0);
  starHub.setAttribute("cx", f1(hub.x)); starHub.setAttribute("cy", f1(hub.y));
  starArms.forEach((arm, i) => {
    const k = easeOut(win(t, 28.3 + i * 0.16, 28.3 + i * 0.16 + 0.45));
    const e = cp(arm.a, 118 * k);
    arm.ln.setAttribute("d", `M ${f1(hub.x)} ${f1(hub.y)} L ${f1(e.x)} ${f1(e.y)}`);
    arm.ln.setAttribute("opacity", k > 0.01 ? 1 : 0);
    const lab = cp(arm.a, 152);
    const lk = clamp01((k - 0.7) / 0.3);
    arm.cc.setAttribute("cx", f1(lab.x)); arm.cc.setAttribute("cy", f1(lab.y));
    arm.tx.setAttribute("x", f1(lab.x)); arm.tx.setAttribute("y", f1(lab.y));
    arm.cc.setAttribute("opacity", lk); arm.tx.setAttribute("opacity", lk);
  });
  // łuk 120° między ramieniem cylindra 1 i 2, na słowie "120"
  const ak = easeOut(win(t, 28.9, 29.3));
  const a0 = starArms[0].a, a1 = starArms[1].a;
  let d = `M ${f1(hub.x)} ${f1(hub.y)}`;
  for (let i = 0; i <= 16; i++) { const p = cp(lerp(a0, lerp(a0, a1, ak), i / 16), 96); d += ` L ${f1(p.x)} ${f1(p.y)}`; }
  starArc.setAttribute("d", d + " Z");
  starArc.setAttribute("opacity", ak > 0.01 ? 1 : 0);
  const pt = cp((a0 + a1) / 2, 196);
  starArcT.setAttribute("x", f1(pt.x)); starArcT.setAttribute("y", f1(pt.y));
  starArcT.setAttribute("opacity", ak);
}
// tarcza zapłonu: 3 znaczniki co 240° w cyklu 720°
const dialTicks = [0, 1, 2].map(() => mkEl("circle", { r: 11 }, $("dialTicks")));
function drawDial(on, deg, k0) {
  $("dial").setAttribute("opacity", on ? k0 : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", f1(200 + Math.cos(rad) * 92));
  $("dialP").setAttribute("y2", f1(1290 + Math.sin(rad) * 92));
  dialTicks.forEach((e, i) => {
    const fa = K.firePhaseDeg(i + 1);
    const r2 = (fa / 2 - 90) * D2R;
    e.setAttribute("cx", f1(200 + Math.cos(r2) * 80));
    e.setAttribute("cy", f1(1290 + Math.sin(r2) * 80));
    const x = wrap(cm - fa, 720), k = x < 80 ? 1 - x / 80 : 0;
    e.setAttribute("r", f1(10 + 7 * k));
    e.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
  });
}

/* ================= górny blok ================= */
const HOOK_TOP = ["Seria silniki · część 8", "Tylko debil <em>kupiłby</em> ten silnik"];
const TOPS = [
  [4.55, "Tak, wiem", "Pewnie masz go <em>pod maską</em>"],
  [9.64, "Ten sam silnik", "Ile razy <em>z rzędu?</em>"],
  [10.96, "Tytuł", "<em>Silnik roku</em>"],
  [12.31, "Tylko że", "Sprzedał się <em>w milionach</em>"],
  [17.18, "Opinia", "Mówi się, <em>że to</em>"],
  [20.07, "Więc czemu", "<em>Mechanicy</em> na jego widok"],
  [21.87, "Więc czemu", "Łapią się <span class=\"hot\">za głowę?</span>"],
  [23.19, "Budowa", "<em>3</em> cylindry"],
  [23.93, "Budowa", "Niecałe <em>400 cm³</em> każdy"],
  [26.03, "Budowa", "Turbo i <em>wtrysk bezpośredni</em>"],
  [28.03, "Wał", "Wykorbienia <em>co 120°</em>"],
  [30.2, "Zapłon", "Co <em>240°</em>"],
  [31.98, "Rozrząd", "Napędza go <em>pasek</em>"],
  [33.66, "Rozrząd", "Który pracuje <span class=\"hot\">w oleju</span>"],
  [35.35, "Powód 1", "<em>Pasek</em>"],
  [42.27, "Tylko że", "Guma <em>w oleju</em>"],
  [43.41, "Guma w oleju", "<span class=\"hot\">Puchnie</span>"],
  [44.04, "Guma w oleju", "<span class=\"hot\">Mięknie</span>"],
  [44.59, "Guma w oleju", "Łuszczy się <span class=\"hot\">warstwa po warstwie</span>"],
  [46.83, "Powód 2", "<em>Smok</em>"],
  [48.27, "Okruchy paska", "Spływają <em>z olejem</em>"],
  [50.01, "Okruchy paska", "Na <em>dno miski</em>"],
  [51.07, "Tam czeka", "<em>Smok</em>"],
  [51.92, "Smok, czyli", "<em>Sitko</em>"],
  [52.72, "Przez sitko", "Pompa <em>zasysa olej</em>"],
  [54.79, "Okruchy", "Je <span class=\"hot\">zatykają</span>"],
  [60.23, "Panewka", "Klin olejowy <span class=\"hot\">znika</span>"],
  [61.61, "Panewka", "Metal trze <span class=\"hot\">o metal</span>"],
  [66.47, "Powód 3", "<em>Hamulce</em>"],
  [68.14, "Pompa podciśnienia", "Daje <em>wspomaganie</em> hamulca"],
  [71.03, "Pompa podciśnienia", "Smarowana <em>tym olejem</em>"],
  [79.75, "Powód 4", "Paliwo <em>w oleju</em>"],
  [81.83, "Przy wtrysku", "<em>Bezpośrednim</em>"],
  [83.19, "Część benzyny", "Spływa <span class=\"hot\">po ściankach</span>"],
  [85.55, "Część benzyny", "Do <span class=\"hot\">miski</span>"],
  [90.1, "Powód 5", "Przyznanie się <em>producenta</em>"],
  [105.02, "Nikt", "Nie przedłuża <em>gwarancji</em>"],
  [106.49, "Nikt nie przedłuża gwarancji", "Na coś, co <span class=\"ok\">działa</span>"],
  [107.58, "Uczciwie?", "Da się <em>z nim żyć</em>"],
  [109.4, "Uczciwie?", "Ale trzeba go <em>pilnować</em>"],
  [113.88, "I nie czekać", "Na <em>kontrolkę</em>"],
  [115.41, "Kontrolka", "Zapala się <span class=\"hot\">za późno</span>"],
  [124.98, "Skaner", "Paska <span class=\"hot\">nie pokaże</span>"],
  [125.94, "Ale wiesz", "Co się <em>dzieje</em>"],
  [127.16, "Ale wiesz", "Zanim zrobi się <em>drogo</em>"],
  [130.43, "Ale silnik", "Którego trzeba <em>pilnować</em>"],
  [131.79, "Ale silnik", "Pilnować <em>skanerem</em>"],
  [133.0, "Żeby nie", "Zjadł <span class=\"hot\">sam siebie</span>"],
  [134.32, "Taki silnik", "Nie jest <span class=\"hot\">dobrym silnikiem</span>"],
  [145.79, "Jury", "Jeździło nim <em>nowym</em>"],
];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // przy obietnicy i odpowiedzi mówi bęben, przy kartach na końcu nagłówek milczy
  const nm = SHOTS[si][3];
  const off = nm === "hook" || nm === "name" || nm === "outro" || nm === "promise" || nm === "promised" || nm === "ans" || nm === "pickA" || nm === "yt" || nm === "care";
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = TOPS[ti][0] < 0 ? 1 : easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.4));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const rowsOf = (id) => [...$(id).querySelectorAll(".rw")].map((el) => ({ el, t: +el.dataset.t, st: +(el.dataset.st || 0), stEl: el.querySelector(".st") }));
const BR_ROWS = rowsOf("gBrands");
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.3)); r.stEl.style.opacity = k; r.stEl.style.transform = "translateX(" + ((1 - k) * 20).toFixed(1) + "px)"; }
  });
}
// pasek na dwóch kołach (widok z boku) z zębami rysowanymi przerywaną linią
function beltLoop(g, x0, x1, cy, r, col) {
  mkEl("circle", { cx: x0, cy, r: r - 14, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkEl("circle", { cx: x1, cy, r: r - 14, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkEl("circle", { cx: x0, cy, r: 10, fill: "#b6c1cf" }, g);
  mkEl("circle", { cx: x1, cy, r: 10, fill: "#b6c1cf" }, g);
  const d = `M ${x0} ${cy - r} L ${x1} ${cy - r} A ${r} ${r} 0 0 1 ${x1} ${cy + r} L ${x0} ${cy + r} A ${r} ${r} 0 0 1 ${x0} ${cy - r} Z`;
  mkEl("path", { d, fill: "none", stroke: col, "stroke-width": 16, "stroke-linejoin": "round" }, g);
  return mkEl("path", { d, fill: "none", stroke: "rgba(6,8,11,0.55)", "stroke-width": 16, "stroke-dasharray": "6 12" }, g);
}
// gCrankFire: gwiazda wykorbień co 120° i tarcza zapłonu co 240°
const CF = { cx: 450, cy: 800, R: 190, dx: 450, dy: 1210, dr: 120 };
{
  const g = $("cfG");
  mkEl("circle", { cx: CF.cx, cy: CF.cy, r: CF.R + 50, fill: "rgba(150,165,182,0.06)", stroke: "rgba(150,165,182,0.25)", "stroke-width": 3 }, g);
  mkEl("path", { id: "cfArc", fill: "rgba(245,170,60,0.16)", stroke: "#eef2f7", "stroke-width": 3 }, g);
  mkT("120°", { id: "cfArcT", x: CF.cx + 130, y: CF.cy - 150, "text-anchor": "middle", style: "font-size:64px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
  for (let i = 0; i < 3; i++) {
    mkEl("path", { "data-arm": i, fill: "none", stroke: "#f5aa3c", "stroke-width": 16, "stroke-linecap": "round" }, g);
    mkEl("circle", { "data-armc": i, r: 34, fill: "#0d1117", stroke: "#f5aa3c", "stroke-width": 5 }, g);
    mkT(String(i + 1), { "data-armt": i, "text-anchor": "middle", style: "font-size:38px;font-weight:600;fill:#eef2f7" }, g);
  }
  mkEl("circle", { cx: CF.cx, cy: CF.cy, r: 22, fill: "#f5aa3c" }, g);
  const d = mkEl("g", { id: "cfDial", opacity: 0 }, g);
  mkEl("circle", { cx: CF.dx, cy: CF.dy, r: CF.dr, fill: "rgba(9,12,17,0.9)", stroke: "rgba(150,165,182,0.4)", "stroke-width": 3 }, d);
  mkT("CYKL 720°", { x: CF.dx, y: CF.dy + CF.dr + 44, "text-anchor": "middle", style: "font-size:24px" }, d);
  for (let i = 0; i < 3; i++) mkEl("circle", { "data-dt": i, r: 16, fill: "#f5aa3c" }, d);
  mkEl("line", { id: "cfPtr", x1: CF.dx, y1: CF.dy, x2: CF.dx, y2: CF.dy - CF.dr + 20, stroke: "#eef2f7", "stroke-width": 6, "stroke-linecap": "round" }, d);
  mkEl("circle", { cx: CF.dx, cy: CF.dy, r: 10, fill: "#eef2f7" }, d);
}
// gDryWet: zwykły pasek na sucho za osłoną, pasek PureTecha w gorącym oleju
{
  const g = $("dwG");
  const a = mkEl("g", { id: "dwA" }, g);
  mkT("ZWYKŁY SILNIK", { x: 90, y: 540, style: "font-size:30px;fill:#eef2f7" }, a);
  beltLoop(a, 250, 560, 680, 90, "#2a2f36");
  mkEl("rect", { id: "dwCover", x: 130, y: 560, width: 550, height: 240, rx: 30, fill: "rgba(150,165,182,0.2)", stroke: "#b6c1cf", "stroke-width": 4, opacity: 0 }, a);
  mkT("OSŁONA", { id: "dwCoverT", x: 405, y: 690, "text-anchor": "middle", style: "font-size:30px;fill:#eef2f7", opacity: 0 }, a);
  mkT("NA SUCHO", { id: "dwDry", class: "sans", x: 720, y: 700, style: "font-size:56px;font-weight:600;fill:#86dba1", opacity: 0 }, a);
  const b = mkEl("g", { id: "dwB" }, g);
  mkT("1.2 PURETECH", { x: 90, y: 900, style: "font-size:30px;fill:#f5aa3c" }, b);
  mkEl("clipPath", { id: "dwClip" }, b).appendChild(mkEl("rect", { x: 120, y: 920, width: 570, height: 260, rx: 30 }));
  mkEl("rect", { x: 120, y: 920, width: 570, height: 260, rx: 30, fill: "rgba(150,165,182,0.06)", stroke: "#b6c1cf", "stroke-width": 3 }, b);
  mkEl("rect", { id: "dwOil", x: 120, y: 1180, width: 570, height: 0, fill: "rgba(208,138,32,0.5)", "clip-path": "url(#dwClip)" }, b);
  beltLoop(b, 250, 560, 1050, 90, "#2a2f36");
  const hw = mkEl("g", { id: "dwHeat", opacity: 0 }, b);
  for (let i = 0; i < 3; i++) mkEl("path", { "data-hw": i, d: "", fill: "none", stroke: "#ff6a4d", "stroke-width": 4, "stroke-linecap": "round" }, hw);
}
// gPress: manometr ciśnienia oleju
const PR = { cx: 450, cy: 1000, r: 300 };
const prAng = (bar) => Math.PI + (bar / 5) * Math.PI;
{
  const g = $("prG");
  const arc = (b0, b1, r) => { const a0 = prAng(b0), a1 = prAng(b1); return `M ${f1(PR.cx + Math.cos(a0) * r)} ${f1(PR.cy + Math.sin(a0) * r)} A ${r} ${r} 0 0 1 ${f1(PR.cx + Math.cos(a1) * r)} ${f1(PR.cy + Math.sin(a1) * r)}`; };
  mkEl("path", { d: arc(0, 5, PR.r), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 26 }, g);
  mkEl("path", { d: arc(0, 0.8, PR.r), fill: "none", stroke: "#e2492b", "stroke-width": 26 }, g);
  for (let b = 0; b <= 5; b++) {
    const a = prAng(b);
    mkEl("line", { x1: f1(PR.cx + Math.cos(a) * (PR.r - 40)), y1: f1(PR.cy + Math.sin(a) * (PR.r - 40)), x2: f1(PR.cx + Math.cos(a) * (PR.r - 14)), y2: f1(PR.cy + Math.sin(a) * (PR.r - 14)), stroke: "#eef2f7", "stroke-width": 4 }, g);
    mkT(String(b), { x: f1(PR.cx + Math.cos(a) * (PR.r - 80)), y: f1(PR.cy + Math.sin(a) * (PR.r - 80) + 14), "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#eef2f7" }, g);
  }
  mkT("CIŚNIENIE OLEJU · BAR", { x: PR.cx, y: PR.cy + 70, "text-anchor": "middle", style: "font-size:26px" }, g);
  mkEl("line", { id: "prNeedle", x1: PR.cx, y1: PR.cy, x2: PR.cx, y2: PR.cy - PR.r + 60, stroke: "#f5aa3c", "stroke-width": 10, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx: PR.cx, cy: PR.cy, r: 22, fill: "#f5aa3c" }, g);
  const c = mkEl("g", { id: "prCall", opacity: 0 }, g);
  mkEl("rect", { x: 90, y: 1150, width: 700, height: 110, fill: "rgba(20,26,34,0.95)", stroke: "rgba(150,165,182,0.3)", "stroke-width": 2 }, c);
  mkEl("rect", { x: 90, y: 1150, width: 8, height: 110, fill: "#f5aa3c" }, c);
  mkT("POPRZEDNI ODCINEK", { x: 126, y: 1192, style: "font-size:22px;fill:#f5aa3c" }, c);
  mkT("Płacisz panewkami", { class: "sans", x: 126, y: 1242, style: "font-size:44px;font-weight:600;fill:#eef2f7" }, c);
}
// gLamp: ciśnienie spada, kontrolka zapala się dopiero przy samym dnie
const LP = { x0: 110, x1: 830, y0: 560, y1: 1080 };
const lpP = (u) => 4.2 * Math.pow(1 - u, 1.6) + 0.08;
const lpY = (bar) => LP.y1 - (bar / 4.5) * (LP.y1 - LP.y0);
const LAMP_BAR = 0.35, LAMP_U = 1 - Math.pow((LAMP_BAR - 0.08) / 4.2, 1 / 1.6);
{
  const g = $("lpG");
  mkEl("line", { x1: LP.x0, x2: LP.x1, y1: LP.y1, y2: LP.y1, stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }, g);
  mkEl("line", { x1: LP.x0, x2: LP.x0, y1: LP.y0, y2: LP.y1, stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }, g);
  mkT("CIŚNIENIE", { x: LP.x0 + 14, y: LP.y0 + 10, style: "font-size:24px" }, g);
  mkT("CZAS", { x: LP.x1, y: LP.y1 + 44, "text-anchor": "end", style: "font-size:24px" }, g);
  // strefa, w której panewki już cierpią
  const hurtU = 0.62;
  mkEl("rect", { id: "lpHurt", x: f1(LP.x0 + hurtU * (LP.x1 - LP.x0)), y: LP.y0, width: f1((1 - hurtU) * (LP.x1 - LP.x0)), height: LP.y1 - LP.y0, fill: "rgba(226,73,43,0.16)", opacity: 0 }, g);
  mkT("PANEWKI JUŻ CIERPIĄ", { id: "lpHurtT", x: f1(LP.x0 + hurtU * (LP.x1 - LP.x0) + 12), y: LP.y0 + 50, style: "font-size:22px;fill:#ff6a4d", opacity: 0 }, g);
  mkEl("line", { x1: LP.x0, x2: LP.x1, y1: f1(lpY(LAMP_BAR)), y2: f1(lpY(LAMP_BAR)), stroke: "#b6c1cf", "stroke-width": 2, "stroke-dasharray": "10 8" }, g);
  mkT("PRÓG KONTROLKI", { x: LP.x0 + 14, y: f1(lpY(LAMP_BAR) - 14), style: "font-size:22px" }, g);
  let d = "";
  for (let i = 0; i <= 80; i++) { const u = i / 80; d += (i ? " L " : "M ") + f1(LP.x0 + u * (LP.x1 - LP.x0)) + " " + f1(lpY(lpP(u))); }
  mkEl("path", { id: "lpCurve", d, fill: "none", stroke: "#f5aa3c", "stroke-width": 7, "stroke-linejoin": "round" }, g);
  mkEl("circle", { id: "lpDot", r: 12, fill: "#eef2f7" }, g);
  // kontrolka oleju (konewka)
  const lamp = mkEl("g", { id: "lpLamp", transform: "translate(250 1180)" }, g);
  mkEl("rect", { x: 0, y: 0, width: 380, height: 180, rx: 24, fill: "#0d1117", stroke: "rgba(150,165,182,0.45)", "stroke-width": 3 }, lamp);
  mkEl("path", { id: "lpCan", d: "M 70 120 L 70 80 Q 70 64 86 64 L 150 64 L 178 50 L 196 50 L 196 64 L 240 64 L 300 44 L 308 52 L 262 110 Q 254 120 240 120 Z M 316 90 Q 322 104 316 112 Q 310 104 316 90 Z", fill: "#3a3f47", stroke: "#b6c1cf", "stroke-width": 3 }, lamp);
  mkT("ZA PÓŹNO", { id: "lpLate", class: "sans", x: 190, y: 164, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#ff6a4d", opacity: 0 }, lamp);
}
// gClaims: okruchy w przewodzie olejowym pompy podciśnienia
{
  const g = $("clG");
  mkEl("path", { d: "M 90 900 L 560 900", stroke: "#6c737c", "stroke-width": 44, "stroke-linecap": "round", fill: "none" }, g);
  mkEl("path", { id: "clOil", d: "M 90 900 L 560 900", stroke: "#d08a20", "stroke-width": 26, "stroke-linecap": "round", fill: "none" }, g);
  mkT("OLEJ", { x: 100, y: 980, style: "font-size:26px;fill:#f5aa3c" }, g);
  const pump = mkEl("g", { id: "clPump" }, g);
  mkEl("circle", { id: "clPumpC", cx: 680, cy: 900, r: 120, fill: "rgba(150,165,182,0.14)", stroke: "#b6c1cf", "stroke-width": 6 }, pump);
  mkEl("path", { d: "M 680 840 L 680 960 M 620 900 L 740 900", stroke: "#b6c1cf", "stroke-width": 6 }, pump);
  mkT("POMPA", { x: 680, y: 1070, "text-anchor": "middle", style: "font-size:26px;fill:#eef2f7" }, pump);
  mkT("PODCIŚNIENIA", { x: 680, y: 1102, "text-anchor": "middle", style: "font-size:26px;fill:#eef2f7" }, pump);
  for (let i = 0; i < 14; i++) mkEl("rect", { "data-cf": i, x: -9, y: -6, width: 18, height: 12, rx: 3, fill: "#3e3a36", stroke: "#8a5a2a", "stroke-width": 2, opacity: 0 }, g);
  mkEl("path", { id: "clX", d: "M 610 830 L 750 970 M 750 830 L 610 970", stroke: "#ff3b2a", "stroke-width": 14, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
}
// gPedal: twardy pedał i dłuższa droga hamowania
{
  const g = $("pdG");
  mkEl("path", { d: "M 160 520 L 160 600", stroke: "#b6c1cf", "stroke-width": 10 }, g);
  const ped = mkEl("g", { id: "pdPed" }, g);
  mkEl("path", { d: "M 160 600 L 300 860", stroke: "#b6c1cf", "stroke-width": 14, "stroke-linecap": "round" }, ped);
  mkEl("rect", { x: 250, y: 850, width: 130, height: 34, rx: 8, fill: "#2a2f36", stroke: "#b6c1cf", "stroke-width": 4, transform: "rotate(-28 315 867)" }, ped);
  mkEl("path", { id: "pdFoot", d: "M 520 760 Q 470 780 420 830 L 395 870 Q 420 905 470 880 L 600 800 Z", fill: "rgba(245,170,60,0.3)", stroke: "#f5aa3c", "stroke-width": 4 }, g);
  mkT("TWARDY", { id: "pdHard", class: "sans", x: 470, y: 640, style: "font-size:84px;font-weight:600;fill:#ff6a4d", opacity: 0 }, g);
}
// gDilute: benzyna rozrzedza olej, a rozrzedzony olej szybciej zjada pasek
{
  const g = $("diG");
  mkEl("clipPath", { id: "diClip" }, g).appendChild(mkEl("rect", { x: 100, y: 520, width: 300, height: 440, rx: 20 }));
  mkEl("rect", { id: "diOil", x: 100, y: 800, width: 300, height: 160, fill: "#c07a14", "clip-path": "url(#diClip)" }, g);
  mkEl("path", { d: "M 100 520 L 100 940 Q 100 960 120 960 L 380 960 Q 400 960 400 940 L 400 520", fill: "none", stroke: "#b6c1cf", "stroke-width": 6 }, g);
  mkT("OLEJ", { x: 250, y: 1010, "text-anchor": "middle", style: "font-size:26px;fill:#eef2f7" }, g);
  for (let i = 0; i < 6; i++) mkEl("ellipse", { "data-drop": i, cx: 160 + i * 36, cy: 480, rx: 10, ry: 15, fill: "#ffe7a0", opacity: 0 }, g);
  mkT("GĘSTOŚĆ OLEJU", { x: 480, y: 560, style: "font-size:24px" }, g);
  mkEl("rect", { x: 480, y: 580, width: 330, height: 40, rx: 6, fill: "rgba(150,165,182,0.15)" }, g);
  mkEl("rect", { id: "diVisc", x: 480, y: 580, width: 330, height: 40, rx: 6, fill: "#f5aa3c" }, g);
  mkT("", { id: "diViscT", x: 480, y: 680, style: "font-size:30px;fill:#ff6a4d" }, g);
  const belts = mkEl("g", { id: "diBelts", opacity: 0 }, g);
  mkT("PASEK W CZYSTYM OLEJU", { x: 90, y: 1090, style: "font-size:24px;fill:#86dba1" }, belts);
  mkEl("rect", { x: 90, y: 1106, width: 700, height: 50, rx: 8, fill: "#2a2f36" }, belts);
  mkEl("rect", { id: "diB1", x: 90, y: 1106, width: 0, height: 50, rx: 8, fill: "rgba(226,73,43,0.8)" }, belts);
  mkT("PASEK W OLEJU Z BENZYNĄ", { x: 90, y: 1220, style: "font-size:24px;fill:#ff6a4d" }, belts);
  mkEl("rect", { x: 90, y: 1236, width: 700, height: 50, rx: 8, fill: "#2a2f36" }, belts);
  mkEl("rect", { id: "diB2", x: 90, y: 1236, width: 0, height: 50, rx: 8, fill: "rgba(226,73,43,0.8)" }, belts);
}
// gInterval: interwał wymiany paska skrócony
{
  const g = $("inG");
  const col = (id, x, big, unit, color) => {
    const c = mkEl("g", { id, opacity: 0 }, g);
    mkT(big, { x, y: 700, style: `font-size:170px;font-weight:600;fill:${color};letter-spacing:-0.04em` }, c);
    mkT(unit, { class: "sans", x: x + 6, y: 770, style: "font-size:52px;font-weight:600;fill:#eef2f7" }, c);
    return c;
  };
  col("inY10", 90, "10", "LAT", "#f5aa3c");
  col("inK175", 420, "175", "TYS. KM", "#f5aa3c");
  mkEl("path", { id: "inX", d: "M 80 640 L 830 640", stroke: "#ff3b2a", "stroke-width": 12, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  const n = mkEl("g", { id: "inNew" }, g);
  const c6 = mkEl("g", { id: "inY6", opacity: 0 }, n);
  mkT("6", { x: 90, y: 1000, style: "font-size:170px;font-weight:600;fill:#ff6a4d;letter-spacing:-0.04em" }, c6);
  mkT("LAT", { class: "sans", x: 96, y: 1070, style: "font-size:52px;font-weight:600;fill:#eef2f7" }, c6);
  const c100 = mkEl("g", { id: "inK100", opacity: 0 }, n);
  mkT("100", { x: 420, y: 1000, style: "font-size:170px;font-weight:600;fill:#ff6a4d;letter-spacing:-0.04em" }, c100);
  mkT("TYS. KM", { class: "sans", x: 426, y: 1070, style: "font-size:52px;font-weight:600;fill:#eef2f7" }, c100);
  mkT("ALBO", { id: "inOr", x: 330, y: 690, "text-anchor": "middle", style: "font-size:28px", opacity: 0 }, g);
  mkT("ALBO", { id: "inOr2", x: 330, y: 990, "text-anchor": "middle", style: "font-size:28px", opacity: 0 }, g);
  // pasek przebiegu: 175 tys. skurczone do 100 tys.
  mkEl("rect", { x: 90, y: 1170, width: 720, height: 40, rx: 6, fill: "rgba(150,165,182,0.15)" }, g);
  mkEl("rect", { id: "inBar", x: 90, y: 1170, width: 0, height: 40, rx: 6, fill: "#f5aa3c" }, g);
  mkT("PRZEBIEG DO WYMIANY PASKA", { x: 90, y: 1150, style: "font-size:22px" }, g);
}
// gScan: gniazdo diagnostyczne pod kierownicą i skaner
{
  const g = $("scG");
  mkEl("path", { d: "M 60 560 Q 300 520 560 560 L 560 660 Q 300 630 60 660 Z", fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkT("DESKA ROZDZIELCZA · POD KIEROWNICĄ", { x: 70, y: 700, style: "font-size:20px" }, g);
  mkEl("path", { d: "M 180 760 L 380 760 L 360 830 L 200 830 Z", fill: "#0d1117", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  for (let i = 0; i < 8; i++) { mkEl("circle", { cx: 212 + i * 20, cy: 782, r: 5, fill: "#6c737c" }, g); if (i < 7) mkEl("circle", { cx: 222 + i * 20, cy: 808, r: 5, fill: "#6c737c" }, g); }
  mkT("GNIAZDO OBD", { id: "scPortT", x: 280, y: 870, "text-anchor": "middle", style: "font-size:22px;fill:#f5aa3c", opacity: 0 }, g);
  const s = mkEl("g", { id: "scDev", opacity: 0 }, g);
  mkEl("path", { d: "M 196 836 L 364 836 L 350 900 L 210 900 Z", fill: "#1c232c", stroke: "#f5aa3c", "stroke-width": 5 }, s);
  mkEl("rect", { x: 200, y: 900, width: 160, height: 150, rx: 18, fill: "#1c232c", stroke: "#f5aa3c", "stroke-width": 5 }, s);
  mkEl("circle", { id: "scLed", cx: 280, cy: 975, r: 14, fill: "#3a3f47" }, s);
  mkEl("path", { id: "scLink", d: "M 370 960 Q 430 930 470 960", fill: "none", stroke: "#7cc4ff", "stroke-width": 5, "stroke-dasharray": "10 10", opacity: 0 }, g);
}
// gCart: strzałka do koszyka na dole filmu
{
  const g = $("caG");
  mkEl("path", { id: "caArr", d: "M 230 820 L 230 1330 M 180 1270 L 230 1330 L 280 1270", fill: "none", stroke: "#f5aa3c", "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  mkT("W KOSZYKU", { id: "caT", class: "sans", x: 320, y: 1200, style: "font-size:72px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
  mkT("NA DOLE FILMU", { id: "caT2", class: "sans", x: 320, y: 1280, style: "font-size:56px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
}
// gTrophy: 4 puchary 2015 - 2018
{
  const g = $("tpG");
  for (let i = 0; i < 4; i++) {
    const cx = 250 + (i % 2) * 360, y = 560 + Math.floor(i / 2) * 290;
    const c = mkEl("g", { "data-cup": i, opacity: 0 }, g);
    mkEl("path", { d: `M ${cx - 62} ${y} L ${cx + 62} ${y} L ${cx + 54} ${y + 62} Q ${cx + 44} ${y + 112} ${cx} ${y + 120} Q ${cx - 44} ${y + 112} ${cx - 54} ${y + 62} Z`, fill: "rgba(245,170,60,0.35)", stroke: "#f5aa3c", "stroke-width": 6, "stroke-linejoin": "round" }, c);
    mkEl("path", { d: `M ${cx - 60} ${y + 16} Q ${cx - 100} ${y + 24} ${cx - 78} ${y + 64} M ${cx + 60} ${y + 16} Q ${cx + 100} ${y + 24} ${cx + 78} ${y + 64}`, fill: "none", stroke: "#f5aa3c", "stroke-width": 6 }, c);
    mkEl("rect", { x: cx - 10, y: y + 120, width: 20, height: 30, fill: "#f5aa3c" }, c);
    mkEl("rect", { x: cx - 48, y: y + 150, width: 96, height: 20, rx: 5, fill: "#f5aa3c" }, c);
    mkT(String(2015 + i), { x: cx, y: y + 222, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#eef2f7" }, c);
  }
}
// gOld: nowy pasek i pasek po 100 000 km
function beltStrip(g, y, worn) {
  const s = mkEl("g", {}, g);
  mkEl("rect", { x: 90, y, width: 720, height: 70, rx: 10, fill: worn ? "#3a2c22" : "#23272d", stroke: worn ? "#8a5a2a" : "#6c737c", "stroke-width": 3 }, s);
  for (let i = 0; i < 24; i++) {
    const x = 102 + i * 30;
    const miss = worn && hash(i * 2.7) > 0.72;
    if (!miss) mkEl("rect", { x, y: y + 70, width: 18, height: 22, rx: 3, fill: worn ? "#3a2c22" : "#23272d", stroke: worn ? "#8a5a2a" : "#6c737c", "stroke-width": 2 }, s);
  }
  if (worn) {
    for (let i = 0; i < 9; i++) {
      const x = 130 + i * 76 + hash(i) * 20;
      mkEl("path", { d: `M ${f1(x)} ${y + 4} L ${f1(x + 10)} ${y + 28} L ${f1(x - 6)} ${y + 46} L ${f1(x + 8)} ${y + 66}`, fill: "none", stroke: "#ff6a4d", "stroke-width": 3 }, s);
    }
  }
  return s;
}
{
  const g = $("olG");
  const n = mkEl("g", { id: "olNew" }, g);
  mkT("NOWY, PROSTO Z FABRYKI", { x: 90, y: 560, style: "font-size:24px;fill:#86dba1" }, n);
  beltStrip(n, 580, false);
  const o = mkEl("g", { id: "olWorn", opacity: 0 }, g);
  mkT("PO 100 000 KM", { x: 90, y: 790, style: "font-size:24px;fill:#ff6a4d" }, o);
  beltStrip(o, 810, true);
  mkT("0", { id: "olKm", x: 90, y: 1080, style: "font-size:120px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  mkT("KM", { id: "olKmU", class: "sans", x: 720, y: 1080, style: "font-size:52px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
}
// gR4: stara wolnossąca czwórka
{
  const g = $("r4G");
  for (let i = 0; i < 4; i++) mkEl("circle", { "data-r4": i, cx: 200 + i * 170, cy: 700, r: 66, fill: "rgba(150,165,182,0.14)", stroke: "#b6c1cf", "stroke-width": 6, opacity: 0 }, g);
  mkT("BEZ TURBO", { id: "r4a", class: "sans", x: 90, y: 900, style: "font-size:64px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
  mkT("PROSTA", { id: "r4b", class: "sans", x: 470, y: 900, style: "font-size:64px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gBrands") {
    stepH($("brH"), t, [[14.19, "Pod maską"], [15.68, "Wszędzie <em>go wsadzili</em>"]]);
    drawRows(BR_ROWS, t);
  } else if (id === "gCrankFire") {
    stepH($("cfH"), t, [[28.03, "Wykorbienia <em>co 120°</em>"], [30.2, "Zapłon <em>co 240°</em>"]]);
    const rot = crankAt(t) * 0.15 * D2R;
    for (let i = 0; i < 3; i++) {
      const k = easeOut(win(t, 28.2 + i * 0.16, 28.6 + i * 0.16));
      const a = rot - Math.PI / 2 + i * (2 * Math.PI / 3);
      const ex = CF.cx + Math.cos(a) * CF.R * k, ey = CF.cy + Math.sin(a) * CF.R * k;
      const arm = $("cfG").querySelector(`[data-arm="${i}"]`);
      arm.setAttribute("d", `M ${CF.cx} ${CF.cy} L ${f1(ex)} ${f1(ey)}`);
      arm.setAttribute("opacity", k > 0.01 ? 1 : 0);
      const lx = CF.cx + Math.cos(a) * (CF.R + 50), ly = CF.cy + Math.sin(a) * (CF.R + 50);
      const lk = clamp01((k - 0.6) / 0.4);
      const c = $("cfG").querySelector(`[data-armc="${i}"]`), tx = $("cfG").querySelector(`[data-armt="${i}"]`);
      c.setAttribute("cx", f1(lx)); c.setAttribute("cy", f1(ly)); c.setAttribute("opacity", f1(lk));
      tx.setAttribute("x", f1(lx)); tx.setAttribute("y", f1(ly + 13)); tx.setAttribute("opacity", f1(lk));
    }
    const ak = easeOut(win(t, 28.9, 29.3));
    let d = `M ${CF.cx} ${CF.cy}`;
    for (let i = 0; i <= 20; i++) { const a = rot - Math.PI / 2 + (i / 20) * (2 * Math.PI / 3) * ak; d += ` L ${f1(CF.cx + Math.cos(a) * 120)} ${f1(CF.cy + Math.sin(a) * 120)}`; }
    $("cfArc").setAttribute("d", d + " Z"); $("cfArc").setAttribute("opacity", ak > 0.01 ? 1 : 0);
    const am = rot - Math.PI / 2 + Math.PI / 3;
    $("cfArcT").setAttribute("x", f1(CF.cx + Math.cos(am) * 175)); $("cfArcT").setAttribute("y", f1(CF.cy + Math.sin(am) * 175 + 20));
    $("cfArcT").setAttribute("opacity", f1(ak));
    const dk = easeOut(win(t, 30.2, 30.6));
    $("cfDial").setAttribute("opacity", f1(dk));
    $("cfDial").setAttribute("transform", `translate(0 ${f1((1 - dk) * 30)})`);
    const cm = wrap(crankAt(t), 720);
    const pa = (cm / 720) * 2 * Math.PI - Math.PI / 2;
    $("cfPtr").setAttribute("x2", f1(CF.dx + Math.cos(pa) * (CF.dr - 20))); $("cfPtr").setAttribute("y2", f1(CF.dy + Math.sin(pa) * (CF.dr - 20)));
    for (let i = 0; i < 3; i++) {
      const fa = i * 240, a = (fa / 720) * 2 * Math.PI - Math.PI / 2;
      const e = $("cfG").querySelector(`[data-dt="${i}"]`);
      e.setAttribute("cx", f1(CF.dx + Math.cos(a) * (CF.dr - 20))); e.setAttribute("cy", f1(CF.dy + Math.sin(a) * (CF.dr - 20)));
      const x = wrap(cm - fa, 720), k = x < 90 ? 1 - x / 90 : 0;
      e.setAttribute("r", f1(14 + 10 * k)); e.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
    }
  } else if (id === "gDryWet") {
    stepH($("dwH"), t, [[36.91, "Normalny <em>pasek rozrządu</em>"], [38.74, "Pracuje <span class=\"ok\">na sucho</span>"], [40.27, "Tu kąpie się <span class=\"hot\">w gorącym oleju</span>"]]);
    popS($("dwA"), t, 36.95, 30);
    const ck = easeOut(win(t, 39.49, 39.9));
    $("dwCover").setAttribute("opacity", f1(ck)); $("dwCoverT").setAttribute("opacity", f1(ck));
    $("dwCover").setAttribute("transform", `translate(${f1((1 - ck) * -40)} 0)`);
    $("dwDry").setAttribute("opacity", f1(easeOut(win(t, 38.88, 39.2))));
    popS($("dwB"), t, 40.27, 30);
    const ok = easeIO(win(t, 40.5, 41.5));
    $("dwOil").setAttribute("y", f1(1180 - 250 * ok)); $("dwOil").setAttribute("height", f1(250 * ok));
    const hk = easeOut(win(t, 41.02, 41.4));
    $("dwHeat").setAttribute("opacity", f1(hk));
    [...$("dwHeat").children].forEach((p, i) => {
      const x = 330 + i * 80;
      let d = "";
      for (let k = 0; k <= 10; k++) { const y = 1000 - k * 9; d += (k ? " L " : "M ") + f1(x + Math.sin(k * 0.9 + t * 2.2 + i) * 9) + " " + f1(y); }
      p.setAttribute("d", d);
    });
  } else if (id === "gPress") {
    stepH($("prH"), t, [[56.27, "Ciśnienie <span class=\"hot\">spada</span>"], [57.22, "A co wtedy <em>z panewkami?</em>"], [59.2, "Już <em>mówiłem</em>"]]);
    const bar = lerp(3.2, 0.3, easeIO(win(t, 56.35, 57.4)));
    const a = prAng(bar);
    $("prNeedle").setAttribute("x2", f1(PR.cx + Math.cos(a) * (PR.r - 60)));
    $("prNeedle").setAttribute("y2", f1(PR.cy + Math.sin(a) * (PR.r - 60)));
    popS($("prCall"), t, 59.2, 30);
  } else if (id === "gLamp") {
    stepH($("lpH"), t, [[63.23, "A <em>kontrolka</em> oleju"], [64.2, "Zapala się"], [65.22, "Kiedy jest już <span class=\"hot\">za późno</span>"]]);
    const u = easeIO(win(t, 63.4, 65.6)) * LAMP_U;
    dash($("lpCurve"), u + 0.001, 1200);
    $("lpDot").setAttribute("cx", f1(LP.x0 + u * (LP.x1 - LP.x0))); $("lpDot").setAttribute("cy", f1(lpY(lpP(u))));
    const hk = easeOut(win(t, 64.4, 64.8));
    $("lpHurt").setAttribute("opacity", f1(hk)); $("lpHurtT").setAttribute("opacity", f1(hk));
    const on = easeOut(win(t, 65.55, 65.9));
    $("lpCan").setAttribute("fill", on > 0.5 ? "#ff3b2a" : "#3a3f47");
    $("lpCan").setAttribute("fill-opacity", f1(0.3 + 0.7 * on));
    $("lpLate").setAttribute("opacity", f1(easeOut(win(t, 65.67, 66.0))));
  } else if (id === "gClaims") {
    stepH($("clH"), t, [[72.86, "Są <em>zgłoszenia</em>"], [73.82, "Że te same <em>okruchy</em>"], [74.65, "Zapychają <span class=\"hot\">zasilanie</span>"]]);
    [...$("clG").querySelectorAll("[data-cf]")].forEach((r) => {
      const i = +r.dataset.cf;
      const p = easeIO(win(t, 73.9 + i * 0.1, 74.9 + i * 0.1));
      const x = lerp(110, 540 - (i % 5) * 16, p), y = 900 + ((i % 3) - 1) * 10;
      r.setAttribute("transform", `translate(${f1(x)} ${f1(y)}) rotate(${i * 37})`);
      r.setAttribute("opacity", f1(easeOut(win(t, 73.9 + i * 0.1, 74.1 + i * 0.1))));
    });
    const bk = easeOut(win(t, 75.2, 75.7));
    $("clOil").setAttribute("stroke", `rgba(208,138,32,${f1(1 - 0.7 * bk)})`);
    $("clPumpC").setAttribute("stroke", bk > 0.5 ? "#ff3b2a" : "#b6c1cf");
    $("clX").setAttribute("opacity", f1(bk));
  } else if (id === "gPedal") {
    stepH($("pdH"), t, [[76.34, "Wtedy <em>pedał</em>"], [76.93, "Robi się <span class=\"hot\">twardy</span>"]]);
    const push = easeIO(win(t, 76.6, 77.3));
    $("pdPed").setAttribute("transform", `rotate(${f1(4 * push)} 160 600)`);
    $("pdFoot").setAttribute("transform", `translate(${f1(-24 * push)} ${f1(6 * push)})`);
    $("pdHard").setAttribute("opacity", f1(easeOut(win(t, 77.38, 77.7))));
  } else if (id === "gDilute") {
    stepH($("diH"), t, [[86.11, "Olej się <span class=\"hot\">rozrzedza</span>"], [87.35, "A olej <em>z benzyną</em>"], [88.18, "Jeszcze szybciej <span class=\"hot\">zjada pasek</span>"]]);
    const dk = easeIO(win(t, 86.2, 87.4));
    [...$("diG").querySelectorAll("[data-drop]")].forEach((e) => {
      const i = +e.dataset.drop;
      const p = frac((t - 86.2) * 1.1 + i / 6);
      const live = t >= 86.2 && t < 87.6;
      e.setAttribute("cy", f1(lerp(470, 820 - 30 * dk, p)));
      e.setAttribute("opacity", live ? f1(Math.sin(p * Math.PI)) : 0);
    });
    const lvl = 160 + 60 * dk;
    $("diOil").setAttribute("y", f1(960 - lvl)); $("diOil").setAttribute("height", f1(lvl));
    const c0 = [192, 122, 20], c1 = [230, 213, 154];
    $("diOil").setAttribute("fill", `rgb(${c0.map((v, i) => Math.round(lerp(v, c1[i], dk))).join(",")})`);
    $("diVisc").setAttribute("width", f1(330 * (1 - 0.55 * dk)));
    $("diViscT").textContent = dk > 0.5 ? "RZADSZY" : "";
    const bk = easeOut(win(t, 88.18, 88.5));
    $("diBelts").setAttribute("opacity", f1(bk));
    const wear = easeIO(win(t, 88.5, 89.9));
    $("diB1").setAttribute("width", f1(700 * 0.22 * wear));
    $("diB2").setAttribute("width", f1(700 * 0.7 * wear));
  } else if (id === "gInterval") {
    stepH($("inH"), t, [[92.59, "Na początku <em>pasek miał</em>"], [93.75, "Wytrzymać"], [97.63, "Potem <span class=\"hot\">skrócili</span>"]]);
    popS($("inY10"), t, 94.31, 30);
    popS($("inK175"), t, 95.27, 30);
    $("inOr").setAttribute("opacity", f1(easeOut(win(t, 94.96, 95.3))));
    const bar = easeIO(win(t, 95.5, 96.4)) * 720 * (1 - (75 / 175) * easeIO(win(t, 99.46, 100.3)));
    $("inBar").setAttribute("width", f1(bar));
    $("inBar").setAttribute("fill", t >= 99.46 ? "#ff6a4d" : "#f5aa3c");
    dash($("inX"), easeOut(win(t, 97.91, 98.4)), 760);
    const fade = 1 - 0.55 * easeOut(win(t, 97.91, 98.4));
    $("inY10").setAttribute("opacity", f1(easeOut(win(t, 94.31, 94.71)) * fade));
    $("inK175").setAttribute("opacity", f1(easeOut(win(t, 95.27, 95.67)) * fade));
    popS($("inY6"), t, 98.75, 30);
    popS($("inK100"), t, 99.46, 30);
    $("inOr2").setAttribute("opacity", f1(easeOut(win(t, 99.17, 99.5))));
  } else if (id === "gWarranty") {
    stepH($("waH"), t, [[100.92, "A w końcu"], [101.36, "<em>Stellantis</em>"], [102.0, "Przedłużył <em>gwarancję</em>"]]);
    const dk = easeOut(win(t, 101.36, 101.8));
    $("waDoc").style.opacity = dk;
    $("waDoc").style.transform = "translateY(" + f1((1 - dk) * 40) + "px)";
    $("waL2").style.opacity = easeOut(win(t, 102.64, 103.0));
    $("waY").style.opacity = easeOut(win(t, 104.11, 104.45));
    $("waL3").style.opacity = easeOut(win(t, 104.3, 104.6));
    stampK($("stWar"), t, 104.5);
  } else if (id === "gScan") {
    stepH($("scH"), t, [[117.15, "Dlatego <em>w takim aucie</em>"], [118.82, "Mały <em>skaner diagnostyczny</em>"], [120.58, "Wpinasz <em>pod kierownicą</em>"], [122.05, "Na <em>telefonie</em>"], [123.27, "Widzisz <em>błędy i parametry</em>"]]);
    $("scPortT").setAttribute("opacity", f1(easeOut(win(t, 121.07, 121.4))));
    const dv = easeOut(win(t, 119.06, 119.5));
    const up = easeIO(win(t, 120.58, 121.3));
    $("scDev").setAttribute("opacity", f1(dv));
    $("scDev").setAttribute("transform", `translate(0 ${f1(170 - 170 * up + (1 - dv) * 30)})`);
    $("scLed").setAttribute("fill", up > 0.98 ? "#86dba1" : "#3a3f47");
    const pk = easeOut(win(t, 122.23, 122.65));
    $("scPhone").style.opacity = pk;
    $("scPhone").style.transform = "translateY(" + f1((1 - pk) * 40) + "px)";
    $("scLink").setAttribute("opacity", f1(pk));
    pop($("scE1"), t, 123.27, 0.25, 20);
    [...$("scPhone").querySelectorAll(".pr")].forEach((r) => pop(r, t, +r.dataset.t, 0.25, 16));
  } else if (id === "gCart") {
    stepH($("caH"), t, [[128.67, "Masz go <em>w koszyku</em>"], [129.44, "Na dole <em>filmu</em>"]]);
    const ck = easeOut(win(t, 128.7, 129.1));
    $("caCard").style.opacity = ck;
    $("caCard").style.transform = "translateY(" + f1((1 - ck) * 30) + "px)";
    dash($("caArr"), easeIO(win(t, 129.3, 129.9)), 700);
    $("caT").setAttribute("opacity", f1(easeOut(win(t, 129.02, 129.4))));
    $("caT2").setAttribute("opacity", f1(easeOut(win(t, 129.59, 129.95))));
  } else if (id === "gTrophy") {
    stepH($("tpH"), t, [[138.19, "Od <em>2015</em> do <em>2018</em>"], [140.63, "<em>1.2 PureTech</em>"], [142.11, "Zdobywał <em>silnik roku</em>"], [144.17, "W swojej <em>klasie</em>"]]);
    [...$("tpG").querySelectorAll("[data-cup]")].forEach((c) => { const i = +c.dataset.cup; popS(c, t, 138.36 + i * 0.45, 36); });
  } else if (id === "gOld") {
    stepH($("olH"), t, [[147.37, "Nikt <em>nie zajrzał</em>"], [148.08, "Jak wygląda <em>ten pasek</em>"], [149.12, "Po <em>100 000 km</em>"]]);
    popS($("olWorn"), t, 148.81, 30);
    const km = Math.round(100000 * easeIO(win(t, 149.19, 150.18)));
    $("olKm").textContent = fmt(km);
    $("olKm").setAttribute("opacity", f1(easeOut(win(t, 149.12, 149.4))));
    $("olKmU").setAttribute("opacity", f1(easeOut(win(t, 149.12, 149.4))));
  } else if (id === "gR4") {
    [...$("r4G").querySelectorAll("[data-r4]")].forEach((c) => { const i = +c.dataset.r4; popS(c, t, 152.6 + i * 0.1, 24); });
    $("r4a").setAttribute("opacity", f1(easeOut(win(t, 152.98, 153.3))));
    $("r4b").setAttribute("opacity", f1(easeOut(win(t, 153.4, 153.7))));
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Pasek", "Olej", "Turbo", "Smok", "PureTech"];
const RN = RW.length, RROW = 50, ANS = "4× silnik roku", T_ANS = 137.2;
const BURSTS = [[7.9, 8.9, 2 * RN], [35.4, 36.1, 2 * RN], [46.9, 47.6, 2 * RN], [66.5, 67.2, 2 * RN], [79.8, 80.5, 2 * RN], [90.15, 90.85, 2 * RN], [107.6, 108.3, 2 * RN], [136.0, 136.55, 2 * RN], [136.6, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  $("flash").style.opacity = Math.max(0, ...FLASHES.map(([a, dur, amp]) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0))).toFixed(3);
  const rb = $("reelBar");
  const rOn = inR(t, 7.65, 139.2);
  rb.style.opacity = rOn ? (easeOut(win(t, 7.65, 7.95)) * (1 - easeIO(win(t, 138.8, 139.2)))).toFixed(3) : 0;
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
      easeOut(win(t, 7.65, 8.05)) * (1 - easeIO(win(t, 9.2, 9.7))),
      easeIO(win(t, 135.96, 136.35)) * (1 - easeIO(win(t, 138.2, 138.7))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 145.79, 149.4);
  sc.style.opacity = sOn ? (easeOut(win(t, 145.79, 146.2)) * (1 - easeIO(win(t, 149.0, 149.4)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 145.79, 146.3))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 151.07, 156.05);
  pc.style.opacity = pOn ? (easeOut(win(t, 151.07, 151.45)) * (1 - easeIO(win(t, 155.75, 156.05)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 151.07, 151.45))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 151.65 ? (t < 152.56 ? easeOut(win(t, 151.65, 151.85)) : 0.5) : 0;
    const gB = t > 152.56 ? easeOut(win(t, 152.56, 152.76)) : 0;
    on("pkA", Math.max(gA, t > 154.35 ? 0.5 + 0.5 * Math.sin((t - 154.35) * 3) : 0)); on("pkB", t > 154.35 ? 0.5 - 0.5 * Math.sin((t - 154.35) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 154.35, 154.7));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 156.12, 164.95);
  yc.style.opacity = yOn ? (easeOut(win(t, 156.12, 156.5)) * (1 - easeIO(win(t, 164.65, 164.95)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 156.12, 156.6))) * -60).toFixed(1) + "px)";
}

/* ================= B-roll: napisy natywne dosłownie ze słów lektora ================= */
const BR_CAP = {
  b01: [[1.8, "Tylko debil kupiłby", "Ten <span class=\"hot\">silnik</span>"]],
  b02: [[4.55, "Tak, wiem", "Pewnie <em>masz go</em>"]],
  b03: [[5.85, "Tak, wiem", "Pod <em>maską</em>"]],
  b04: [[12.31, "Tylko że", "Sprzedał się <em>w milionach</em>"]],
  b05: [[20.07, "Więc czemu", "<em>Mechanicy</em> na jego widok"], [21.87, "Więc czemu", "Łapią się <span class=\"hot\">za głowę?</span>"]],
  b06: [[46.83, "Powód 2", "<em>Smok</em>"]],
  b07: [[78.03, "A auto", "Hamuje <span class=\"hot\">dużo gorzej</span>"]],
  b08: [[107.58, "Uczciwie?", "Da się <em>z nim żyć</em>"], [109.4, "Uczciwie?", "Ale trzeba go <em>pilnować</em>"]],
  b09: [[110.91, "Pilnować", "<span class=\"ok\">Dobry olej</span>"], [111.61, "Pilnować", "<span class=\"ok\">Częstsze wymiany</span>"], [112.8, "Pilnować", "<span class=\"ok\">Pasek wcześniej</span>"]],
  b10: [[127.16, "Wiesz, co się dzieje", "Zanim zrobi się <span class=\"hot\">drogo</span>"]],
  b11: [[133.0, "Żeby nie", "Zjadł <span class=\"hot\">sam siebie</span>"], [134.32, "Taki silnik", "Nie jest <span class=\"hot\">dobrym silnikiem</span>"]],
  b12: [[145.79, "Jury", "Jeździło nim <em>nowym</em>"]],
};
function drawBroll(t, name) {
  const list = BR_CAP[name] || [];
  let cur = list[0];
  for (const x of list) if (t >= x[0]) cur = x;
  if (!cur) return;
  if ($("brK").textContent !== cur[1]) $("brK").textContent = cur[1];
  setH($("brH"), cur[2], t, cur[0]);
}

/* ================= render klatki ================= */
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: +el.dataset.t }));
const hkChips = [...document.querySelectorAll("#hkC .hc")].map((el) => ({ el, t: +el.dataset.t }));
const chipSets = ["chNew", "chCare"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chNew: "modern", chCare: "care" };

// plansza i 3D przenikają się przez 0,4 s zamiast twardego cięcia
const XF = 0.4;
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const si = shotIdx(t), [s0, , kind, name] = SHOTS[si], prev = SHOTS[si - 1];
  const fresh = prev && prev[2] !== kind && prev[2] !== "broll" && kind !== "broll" && t - s0 < XF;
  let boardK = 0, boardName = null, si3 = -1;
  if (kind === "board") { boardName = name; boardK = fresh ? easeIO((t - s0) / XF) : 1; if (fresh) si3 = si - 1; }
  else { si3 = si; if (fresh) { boardName = prev[3]; boardK = 1 - easeIO((t - s0) / XF); } }
  if (kind === "broll") { boardK = 0; boardName = null; si3 = -1; }
  bd.style.opacity = boardK.toFixed(3);
  if (boardName) drawBoard(t, boardName);
  $("brUi").style.opacity = kind === "broll" ? 1 : 0;
  if (kind === "broll") drawBroll(t, name);
  const on3d = si3 >= 0;
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (on3d) render3D(t, si3);
}
function render3D(t, si) {
  const [s0, , , name] = SHOTS[si];
  const deg = crankAt(t);
  const A = states(t, name);
  pose(A.s, deg, t);
  if (A.s.bear) bear.setState(bearState(t, deg));
  applyCam(t, name, camera, si);
  lightAt(A.base, camera);
  projCam = camera;

  drawTop(t, si);
  drawDial(name === "fire", deg, easeOut(win(t, s0, s0 + 0.4)));
  drawStar(t, name === "crank");
  const bOn = name === "anatomy";
  badges.forEach(({ el, x }, i) => {
    if (!bOn) { el.style.opacity = 0; return; }
    const p = localPoint(E.root, x, K.L.coverTopY + 150, 0);
    place(el, p.x, p.y);
    const k = easeOut(win(t, 23.35 + i * 0.12, 23.65 + i * 0.12));
    el.style.opacity = k;
    el.style.transform = "translateY(" + f1((1 - k) * 16) + "px)";
  });
  $("cnt").style.opacity = 0;
  chipSets.forEach((cs) => {
    const on = CHIP_SHOT[cs.el.id] === name;
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.25, 24));
  });
  // hook: słowa zapalają się na słowach lektora, DEBIL dostaje akcent; w pętli wraca stan z klatki 0
  const hookOn = name === "hook", outroOn = name === "outro";
  show($("hk"), hookOn || outroOn);
  if (hookOn || outroOn) {
    $("hk").style.opacity = hookOn ? 1 : easeOut(win(t, 165.07, 165.5)).toFixed(3);
    hkWords.forEach((w) => {
      const k = hookOn ? easeOut(win(t, w.t, w.t + 0.16)) : 0;
      w.el.style.opacity = (0.5 + 0.5 * k).toFixed(3);
      w.el.style.color = k > 0.5 && w.el.textContent === "kupiłby" ? "#f5aa3c" : "";
      w.el.style.transform = "translateY(" + f1(-8 * Math.sin(Math.PI * clamp01((t - w.t) / 0.25)) * (hookOn ? 1 : 0)) + "px)";
    });
    const bk = hookOn ? easeOut(win(t, 0.81, 0.95)) : 0;
    const hit = hookOn ? Math.max(0, 1 - Math.abs(t - 0.86) / 0.35) : 0;
    $("hkBig").style.opacity = (0.5 + 0.5 * bk).toFixed(3);
    $("hkBig").style.color = bk > 0.5 ? "#ff6a4d" : "";
    $("hkBig").style.transform = "scale(" + (1 + 0.24 * hit).toFixed(3) + ") rotate(" + (-3 * hit).toFixed(2) + "deg)";
  }
  show($("hkC"), name === "name");
  if (name === "name") hkChips.forEach((c) => { const k = backOut(win(t, c.t, c.t + 0.24)); c.el.style.opacity = clamp01(k * 3); c.el.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")"; });
  const stN = $("stName");
  if (name === "name") stampK(stN, t, 2.7); else stN.style.opacity = 0;
  $("split").style.opacity = 0; $("pA").style.opacity = 0; $("pB").style.opacity = 0;
  drawTags(t);
  usePassCam(camera);
  composer.render();
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, bear, camera, composer, scene, SHOTS, K };
