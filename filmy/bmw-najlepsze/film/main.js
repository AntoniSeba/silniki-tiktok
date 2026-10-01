// Dlaczego BMW robi najlepsze silniki na świecie. Część 10. Bohater: BMW S54 (M3 E46), 2JZ do karty wyboru, panewka do callbacku.
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
import { createMaterials, applyMaterialVariation } from "../model/r6-2jz/lib/materials.js";
import { buildStudioEnvironment } from "../model/r6-2jz/lib/environment.js";
import { buildEngine } from "../model/r6-2jz/scene.js";
import * as K from "../model/r6-2jz/lib/engine.js";
import { createMaterials as createMaterialsS, applyMaterialVariation as varyS } from "../model/r6-s54/lib/materials.js";
import { buildEngine as buildS54 } from "../model/r6-s54/parts/engine.js";
import * as KS from "../model/r6-s54/kinematics.js";
import { buildBearing, CLEAR } from "./bearing.js";

const W = 1080, H = 1920, D = 176.675;
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
  [0, 1.54, "3d", "hook"], [1.54, 3.27, "3d", "hook2"], [3.27, 4.19, "broll", "b02"], [4.19, 6.75, "board", "gBlinker"],
  [6.75, 7.59, "broll", "b08"], [7.59, 10.04, "3d", "promise"], [10.04, 13.15, "3d", "promise2"], [13.15, 15.78, "broll", "b13"],
  [15.78, 17.23, "broll", "b10"], [17.23, 19.82, "3d", "toys"], [19.82, 22.75, "board", "gName"], [22.75, 25.97, "3d", "intro"],
  [25.97, 30.35, "3d", "anatomy"], [30.35, 34.41, "board", "gSpecS"], [34.41, 36.18, "3d", "p1"], [36.18, 41.21, "board", "gV6"],
  [41.21, 44.17, "3d", "crank"], [44.17, 48.52, "3d", "fire"], [48.52, 52.17, "broll", "b04"], [52.17, 53.94, "3d", "p2"],
  [53.94, 60.93, "board", "gTach"], [60.93, 66.32, "board", "gRev"], [66.32, 68.43, "broll", "b15"], [68.43, 70.2, "3d", "p3"],
  [70.2, 75.23, "board", "gVanosY"], [75.23, 81.43, "3d", "vanos"], [81.43, 83.88, "3d", "cams"], [83.88, 88.77, "board", "gEvery"],
  [88.77, 90.54, "3d", "p4"], [90.54, 96.87, "board", "gF1"], [96.87, 99.51, "board", "gTurboFirst"], [99.51, 104.16, "broll", "b16"],
  [104.16, 106.59, "board", "gHp"], [106.59, 108.07, "3d", "p5"], [108.07, 111.45, "broll", "ep9"], [111.45, 118.97, "board", "gModular"],
  [118.97, 123.71, "board", "gB58"], [123.71, 126.66, "broll", "b06"], [126.66, 129.54, "3d", "panewki"], [129.54, 131.15, "3d", "bearing"],
  [131.15, 133.99, "broll", "b17"], [133.99, 140.11, "board", "gScan"], [140.11, 141.66, "board", "gCart"], [141.66, 145.67, "broll", "b11"],
  [145.67, 147.02, "3d", "promised"], [147.02, 148.51, "3d", "ans"], [148.51, 156.75, "board", "gAlt"], [156.75, 161.83, "board", "gClouds"],
  [161.83, 163.51, "3d", "pickA"], [163.51, 166.47, "3d", "pickB"], [166.47, 169.94, "broll", "b18"], [169.94, 175.43, "3d", "yt"],
  [175.43, D + 1, "3d", "outro"],
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

/* ================= 2JZ (karta wyboru), stanowisko 160 m niżej ================= */
const JP = new THREE.Vector3(0, -160000, 0);
const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E = buildEngine(M);
applyMaterialVariation(E.root, M);
fixNormals(E.root);
E.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(E.root);
E.root.position.copy(JP);
E.root.updateMatrixWorld(true);
const PT = E.parts;
const B = PT.block, R = PT.rotating, HD = PT.head, IND = PT.induction, TM = PT.timing;
const NC = K.CYL_X.length;
const crank = R.groups.crank;
const pistons = R.groups.pistons, rods = R.groups.rods;
const pistGlow = pistons.map((p) => glowMats(p));
const rodGlow = rods.map((r) => glowMats(r));
const MAIN_X2 = K.MAIN_X || [0, 1, 2, 3, 4, 5, 6].map((i) => (i - 3) * K.SPEC.boreSpacing);
const mainGlow = MAIN_X2.map((_, i) => glowMats(crank.getObjectByName(`MainJournal_${i + 1}`)));
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


/* ================= BMW S54 (bohater) ================= */
const MS = createMaterialsS();
for (const k of Object.keys(MS)) { const m = MS[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const SE = buildS54(MS);
varyS(SE.root, MS);
fixNormals(SE.root);
SE.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(SE.root);
const SP_ = SE.parts;
const sCrank = SP_.crank;
const sPist = SP_.pistons.map((p) => glowMats(p));
const sRod = SP_.rods.map((r) => glowMats(r));
const sPinGlow = [], sWebGlow = [];
sCrank.children.forEach((o) => { if (/^Crankpin/.test(o.name)) sPinGlow.push(...glowMats(o, RED)); else if (/^Web_/.test(o.name)) sWebGlow.push(...glowMats(o, GREEN)); });
const sExhGrp = SE.root.getObjectByName("EXHAUST_WRAP");
const sExhGlow = sExhGrp ? glowMats(sExhGrp, RED) : [];
const sCamGlow = [...glowMats(SP_.camIn, AMBER), ...glowMats(SP_.camEx, AMBER)];
const SEX = SE.explode.map((e, i) => ({ ...e, k: clamp01(0.5 - e.dir[1] / 600 + hash(i) * 0.2) }));
const sFlash = [], sPow = [];
for (let i = 0; i < 6; i++) {
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), additive(0xff8a2a));
  f.position.set(KS.CYL_X[i], KS.DECK + 14, 0); f.scale.set(1, 0.6, 1); f.visible = false; SE.root.add(f); sFlash.push({ m: f, mat: f.material });
  const g = new THREE.Mesh(new THREE.CylinderGeometry(KS.BORE_R - 3, KS.BORE_R - 3, 1, 32), additive(0xff7a1a));
  g.visible = false; SE.root.add(g); sPow.push({ m: g, mat: g.material });
}
SE.update(KS.state(0), { cut: 0, explode: 0 });
SE.root.updateMatrixWorld(true);
const S_BOX = new THREE.Box3().setFromObject(SE.root);
const S_FRONT = S_BOX.min.x;

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
const CX = 0, CY = 130, CZ = 0;
const Pw = (az, el, r, oy = 60, fov = 32) => P(az, el, r, CX, CY, CZ, fov, oy);
const PJ = (az, el, r, oy = 60) => P(az, el, r, JP.x, JP.y + 120, JP.z, 32, oy);
const P0 = Pw(2.5, 0.3, 5200, -170);
const CAM = {
  hook: [[0, P0], [0.68, Pw(2.3, 0.24, 4300, -160)], [1.54, Pw(2.15, 0.2, 4100, -150)]],
  hook2: [[1.54, P(SIN + 0.55, 0.38, 2400, -150, 300, 60, 32, -150)], [3.27, P(SIN + 0.32, 0.32, 2400, -150, 300, 60, 32, -150)]],
  promise: [[7.59, Pw(1.2, 0.32, 5800)], [10.04, Pw(0.8, 0.26, 5800)]],
  promise2: [[10.04, Pw(-0.8, 0.3, 5200, 80)], [13.15, Pw(-1.25, 0.22, 5200, 80)]],
  toys: [[17.23, Pw(-2.6, 0.16, 4100, 110)], [19.82, Pw(-2.25, 0.2, 4100, 110)]],
  intro: [[22.75, Pw(SIN, 0.06, 4500, 60)], [25.97, Pw(SIN + 0.12, 0.08, 4500, 60)]],
  anatomy: [[25.97, P(SIN + 0.28, 0.16, 3500, 0, 150, 0, 32, -30)], [30.35, P(SIN + 0.1, 0.12, 3500, 0, 150, 0, 32, -30)]],
  p1: [[34.41, Pw(0.6, 0.3, 4200)], [36.18, Pw(0.85, 0.24, 4200)]],
  crank: [[41.21, P(SIN + 0.4, 0.28, 3000, 0, 0, 0, 32, 40)], [44.17, P(SIN + 0.15, 0.2, 3000, 0, 0, 0, 32, 40)]],
  fire: [[44.17, P(0.3, 0.9, 3500, 0, 150, 0, 32, 170)], [48.52, P(0.55, 0.85, 3500, 0, 150, 0, 32, 170)]],
  p2: [[52.17, Pw(FRONT + 0.5, 0.25, 4200)], [53.94, Pw(FRONT + 0.3, 0.2, 4200)]],
  p3: [[68.43, P(FRONT + 0.4, 0.22, 2800, S_FRONT + 60, 260, 0, 32, 40)], [70.2, P(FRONT + 0.2, 0.18, 2800, S_FRONT + 60, 260, 0, 32, 40)]],
  vanos: [[75.23, P(FRONT + 0.75, 0.42, 2300, S_FRONT + 120, 330, 0, 32, 40)], [81.43, P(FRONT + 0.4, 0.34, 2300, S_FRONT + 120, 330, 0, 32, 40)]],
  cams: [[81.43, P(SIN - 0.35, 0.6, 3200, -40, 330, 0, 32, 120)], [83.88, P(SIN - 0.12, 0.54, 3200, -40, 330, 0, 32, 120)]],
  p4: [[88.77, Pw(EXH - 0.5, 0.25, 4200)], [90.54, Pw(EXH - 0.25, 0.2, 4200)]],
  p5: [[106.59, P(SIN + 0.4, 0.25, 3500, 0, 150, 0, 32, 40)], [108.07, P(SIN + 0.2, 0.2, 3500, 0, 150, 0, 32, 40)]],
  panewki: [[126.66, P(SIN + 0.2, 0.12, 2800, 0, 30, 0, 32, 60)], [129.54, P(SIN - 0.05, 0.08, 2800, 0, 30, 0, 32, 60)]],
  bearing: [[129.54, PB(SIN + 0.1, 0.05, 2000, 0, -30, 0, 32, 170)], [131.15, PB(SIN - 0.04, 0.03, 2000, 0, -30, 0, 32, 170)]],
  promised: [[145.67, Pw(0.95, 0.3, 4600)], [147.02, Pw(0.78, 0.26, 4600)]],
  ans: [[147.02, Pw(-0.6, 0.14, 4300, 80)], [148.51, Pw(-0.38, 0.11, 4300, 80)]],
  pickA: [[161.83, Pw(0.9, 0.22, 4400, 300)], [163.51, Pw(0.68, 0.2, 4400, 300)]],
  pickB: [[163.51, PJ(-0.9, 0.22, 5400, 300)], [166.47, PJ(-1.2, 0.2, 5400, 300)]],
  yt: [[169.94, P(1.3, 0.26, 8200, 0, 250, 0, 32, 330)], [175.43, P(0.4, 0.3, 8200, 0, 250, 0, 32, 330)]],
  outro: [[175.43, Pw(2.75, 0.36, 5200, -170)], [D, P0], [D + 1, Pw(2.3, 0.24, 4300, -160)]],
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
const HOOK_END = 8.28;
const BEATS = [0.68, 5.91, 7.59];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const FLASHES = [[0.68, 0.14, 0.55], [5.91, 0.16, 0.5], [7.59, 0.18, 0.45]];
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
  sEx: 0, sSec: 0, sCrankOnly: 0, sFire: 0, sFireHard: 0, sPow: 0, sGP: 0, sPins: 0, sWebs: 0, sExh: 0, sCams: 0, sCovers: 1, vanos: 0,
});
const hookE = (t) => 0.55 * (1 - easeOut(win(t, 0, 1.6)));
function states(t, name) {
  const s = blank();
  let base = new THREE.Vector3(CX, CY, CZ);
  switch (name) {
    case "hook": s.sEx = Math.pow(1 - clamp01(t / 0.55), 2); s.sFire = 1; s.sFireHard = 1; s.sPow = 1; s.sExh = 0.5 * easeOut(win(t, 0.68, 0.9)); break;
    case "hook2": s.sFire = 1; s.sFireHard = 1; s.sCovers = 0; s.sCams = 0.8 * easeOut(win(t, 1.54, 1.9)); break;
    case "outro": s.sEx = Math.pow(win(t, 175.43, D), 2); s.sFire = 1; s.sFireHard = t >= 176.1 ? 1 : 0; s.sPow = t >= 176.1 ? 1 : 0; break;
    case "promise": s.sEx = 0.85 * easeOut(win(t, 7.59, 7.94)); break;
    case "promise2": s.sEx = 0.85 * (1 - easeIO(win(t, 10.04, 12.2))); break;
    case "toys": s.sFire = 1; break;
    case "intro": s.sFire = 1; break;
    case "anatomy": s.sSec = 1; s.sGP = 0.9 * easeOut(win(t, 26.0, 26.5)); break;
    case "p1": s.sFire = 1; s.sPow = 1; break;
    case "crank": s.sCrankOnly = 1; s.sWebs = 0.8 * easeOut(win(t, 41.4, 41.9)); break;
    case "fire": s.sSec = 1; s.sFire = 1; s.sPow = 1; break;
    case "p2": s.sFire = 1; s.sCams = 0.3; break;
    case "p3": s.sCovers = 0; s.sCams = 0.5 * easeOut(win(t, 68.5, 69.0)); break;
    case "vanos": { s.sCovers = 0; s.sCams = 0.9; const ph = clamp01((t - 75.6) / 5.5); s.vanos = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2); break; }
    case "cams": s.sCovers = 0; s.sCams = 1.1; s.vanos = 0.4; break;
    case "p4": s.sExh = 0.7 * easeOut(win(t, 88.9, 89.4)); s.sFire = 1; break;
    case "p5": s.sSec = 1; s.sPow = 1; s.sFire = 1; break;
    case "panewki": s.sSec = 1; s.sPins = 1.2 * easeOut(win(t, 128.0, 128.6)); s.sGP = 0.3; break;
    case "bearing": s.bear = 1; base = BP; break;
    case "promised": break;
    case "ans": s.sFire = 1; break;
    case "pickA": s.sFire = 1; break;
    case "pickB": s.fire = 1; base = JP.clone().add(new THREE.Vector3(0, 120, 0)); break;
    case "yt": s.sEx = 1.4 * easeIO(win(t, 170.3, 174.6)); break;
  }
  return { s, base };
}

function poseS(st, deg, t) {
  SE.update(KS.state(deg, { vanos: st.vanos }), { cut: 0, explode: 0 });
  for (const e of SEX) {
    const a = st.sEx > 0 ? stagS(Math.min(1, st.sEx), e.k) * 1.6 * Math.max(1, st.sEx) : 0;
    e.obj.position.set(e.base[0] + e.dir[0] * a, e.base[1] + e.dir[1] * a, e.base[2] + e.dir[2] * a);
  }
  const co = !!st.sCrankOnly;
  SP_.shellR.visible = !st.sSec && !co;
  SP_.shellL.visible = !co;
  SP_.center.children.forEach((c) => { c.visible = !co || c === sCrank; });
  const g = SP_.groups;
  for (const k of ["head", "ind", "exhaust", "timing", "timingCase", "anc"]) if (g[k]) g[k].visible = !co;
  if (g.covers) g.covers.visible = !co && !!st.sCovers;
  for (let i = 0; i < 6; i++) {
    SP_.pistons[i].visible = !co; SP_.rods[i].visible = !co;
    setGlow(sPist[i], st.sGP, AMBER); setGlow(sRod[i], st.sGP * 0.6, AMBER);
  }
  setGlow(sPinGlow, st.sPins, RED);
  setGlow(sWebGlow, st.sWebs, GREEN);
  setGlow(sExhGlow, st.sExh, RED);
  setGlow(sCamGlow, st.sCams, AMBER);
  for (let i = 0; i < 6; i++) {
    const ph = KS.cyclePhase(i + 1, deg);
    if (st.sFireHard && !co) {
      const k = ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
      sFlash[i].m.visible = k > 0.01; sFlash[i].mat.opacity = k; sFlash[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    } else {
      const k = st.sFire && !co ? softFire(ph) : 0;
      sFlash[i].m.visible = k > 0.01; sFlash[i].mat.opacity = 0.45 * k; sFlash[i].mat.color.setRGB(1.3, 0.55, 0.16);
    }
    const on = !!st.sPow && ph < 180 && !co;
    sPow[i].m.visible = on;
    if (on) {
      const crown = KS.pistonCrownY(i + 1, deg), len = Math.max(2, KS.DECK + 10 - crown);
      sPow[i].m.scale.set(1, len, 1); sPow[i].m.position.set(KS.CYL_X[i], crown + len / 2, 0);
      sPow[i].mat.opacity = 0.55 * Math.sin(Math.PI * (ph / 180)); sPow[i].mat.color.setRGB(1.3 - 0.3 * (ph / 180), 0.5 - 0.2 * (ph / 180), 0.12);
    }
  }
  SE.root.updateMatrixWorld(true);
}
const stagS = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));

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
  mainGlow.forEach((ms, i) => setGlow(ms, st.mains * (1.3 + 0.2 * Math.sin(i * 1.7)), st.mainsCol || RED));
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
  { t0: 22.75, t1: 25.97, text: "BMW S54", a: () => SE.root.localToWorld(new THREE.Vector3(0, KS.DECK + 120, 0)), off: [-120, -330], c: "oil" },
  { t0: 68.6, t1: 70.2, text: "VANOS", a: () => SE.root.localToWorld(new THREE.Vector3(S_FRONT + 40, 300, 0)), off: [180, -300], c: "oil" },
  { t0: 81.6, t1: 83.88, text: "Wałek dolotowy", a: () => SP_.camIn.localToWorld(new THREE.Vector3(0, 0, 0)), off: [170, -260], c: "oil" },
  { t0: 81.9, t1: 83.88, text: "Wałek wydechowy", a: () => SP_.camEx.localToWorld(new THREE.Vector3(0, 0, 0)), off: [-170, 260], c: "oil" },
  { t0: 128.1, t1: 129.54, text: "Panewki korbowodowe", a: () => sCrank.localToWorld(new THREE.Vector3(KS.CYL_X[2], 0, 0)), off: [160, 300], c: "hot" },
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
const badges = KS.CYL_X.map((x, i) => { const el = document.createElement("div"); el.className = "badge"; el.textContent = String(i + 1); $("badges").appendChild(el); return { el, x }; });
// gwiazda wykorbień z przodu wału: 3 ramiona co 120°
const STAR_X = MAIN_X2[0] - 42;
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
const dialTicks = [0, 1, 2, 3, 4, 5].map(() => mkEl("circle", { r: 11 }, $("dialTicks")));
function drawDial(on, deg, k0) {
  $("dial").setAttribute("opacity", on ? k0 : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", f1(200 + Math.cos(rad) * 92));
  $("dialP").setAttribute("y2", f1(1290 + Math.sin(rad) * 92));
  dialTicks.forEach((e, i) => {
    const fa = i * 120;
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
  [10.04, "Na końcu", "Co <em>BMW</em> budowało"],
  [11.09, "Na końcu", "Zanim zrobiło <em>pierwszy samochód</em>"],
  [17.23, "Mówi się", "Że to..."],
  [22.75, "Weźmy", "<em>S54</em>"],
  [24.14, "Weźmy S54", "Z <em>M3 E46</em>"],
  [25.97, "Budowa", "<em>6</em> cylindrów w rzędzie"],
  [28.58, "Budowa", "<em>3,2</em> litra"],
  [34.41, "Powód 1", "<em>Szóstka</em>"],
  [41.21, "Idealnie wyważona", "Już <em>mówiłem</em>"],
  [44.17, "Zapłon", "Co <em>120°</em>"],
  [52.17, "Powód 2", "<em>Obroty</em>"],
  [68.43, "Powód 3", "<em>VANOS</em>"],
  [75.23, "VANOS", "Wałek obraca się <em>względem koła</em>"],
  [77.82, "Więc silnik ma", "Inny charakter <em>na dole</em>"],
  [80.17, "Więc silnik ma", "Inny <em>na górze</em>"],
  [81.43, "W S54", "Na <em>obu wałkach</em>"],
  [88.77, "Powód 4", "<em>Wyścigi</em>"],
  [106.59, "Powód 5", "<em>Cylinder</em>"],
  [126.66, "W S54", "Lubią puszczać <span class=\"hot\">panewki</span>"],
  [129.54, "O panewkach", "Już <em>mówiłem</em>"],
];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // przy obietnicy i odpowiedzi mówi bęben, przy kartach na końcu nagłówek milczy
  const nm = SHOTS[si][3];
  const off = nm === "hook" || nm === "hook2" || nm === "outro" || nm === "pickB" || nm === "promise" || nm === "promised" || nm === "ans" || nm === "pickA" || nm === "yt" || nm === "care";
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

/* ================= plansze części 9 ================= */
const bigNum = (g, id, x, y, size, col, unit, uSize = 56) => {
  const t = mkT("0", { id, x, y, style: `font-size:${size}px;font-weight:600;fill:${col};letter-spacing:-0.04em`, opacity: 0 }, g);
  mkT(unit, { id: id + "U", class: "sans", x: x + 8, y: y + uSize + 14, style: `font-size:${uSize}px;font-weight:600;fill:#eef2f7`, opacity: 0 }, g);
  return t;
};
// gSpec: 130 KM, 230 Nm, od 1750 obr/min
{
  const g = $("gSpecG");
  bigNum(g, "spK", 90, 680, 190, "#f5aa3c", "KONI");
  bigNum(g, "spN", 90, 980, 190, "#f5aa3c", "NM");
  mkT("OD 1750 OBR/MIN", { id: "spR", class: "sans", x: 90, y: 1190, style: "font-size:72px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
}
// gFriction: czwórka kontra PureTech
const FR_ROWS = [["TŁOKI", "4", "3", 34.89, 38.78], ["ZAWORY", "16", "12", 35.67, 39.7], ["ŁOŻYSKA", "5", "4", 36.71, 40.95]];
{
  const g = $("gFrictionG");
  mkT("R4", { id: "frH4", class: "sans", x: 470, y: 560, "text-anchor": "middle", style: "font-size:64px;font-weight:600;fill:#b6c1cf", opacity: 0 }, g);
  mkT("1.2 PT", { id: "frH3", class: "sans", x: 710, y: 560, "text-anchor": "middle", style: "font-size:64px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  FR_ROWS.forEach(([lab, a, b], i) => {
    const y = 720 + i * 190;
    mkT(lab, { "data-frl": i, x: 90, y, style: "font-size:34px;fill:#eef2f7", opacity: 0 }, g);
    mkT(a, { "data-fra": i, x: 470, y: y + 20, "text-anchor": "middle", style: "font-size:130px;font-weight:600;fill:#b6c1cf", opacity: 0 }, g);
    mkT(b, { "data-frb": i, x: 710, y: y + 20, "text-anchor": "middle", style: "font-size:130px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  });
}
// gLoss: straty na tarcie, poglądowo
{
  const g = $("gLossG");
  mkT("STRATY NA TARCIE · POGLĄDOWO", { x: 90, y: 640, style: "font-size:26px" }, g);
  mkT("R4", { class: "sans", x: 90, y: 745, style: "font-size:52px;font-weight:600;fill:#b6c1cf" }, g);
  mkEl("rect", { id: "loA", x: 280, y: 700, width: 0, height: 60, rx: 8, fill: "#ff6a4d" }, g);
  mkT("1.2 PT", { class: "sans", x: 90, y: 905, style: "font-size:52px;font-weight:600;fill:#86dba1" }, g);
  mkEl("rect", { id: "loB", x: 280, y: 860, width: 0, height: 60, rx: 8, fill: "#86dba1" }, g);
  mkT("MNIEJ PALIWA", { id: "loT", class: "sans", x: 90, y: 1100, style: "font-size:90px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
}
// gChamber: za mała komora traci ciepło, za duża spala wolno
const CH = [{ x: 210, r: 70, lab: "ZA MAŁA" }, { x: 450, r: 100, lab: "" }, { x: 710, r: 125, lab: "ZA DUŻA" }];
{
  const g = $("gChamberG");
  CH.forEach((c, i) => {
    const e = mkEl("g", { "data-ch": i, opacity: 0 }, g);
    mkEl("circle", { cx: c.x, cy: 820, r: c.r, fill: "rgba(245,170,60,0.14)", stroke: "#b6c1cf", "stroke-width": 6 }, e);
    mkT(c.lab, { x: c.x, y: 820 + c.r + 60, "text-anchor": "middle", style: "font-size:28px;fill:#eef2f7" }, e);
  });
  const heat = mkEl("g", { id: "chHeat", opacity: 0 }, g);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; mkEl("path", { d: `M ${f1(210 + Math.cos(a) * 80)} ${f1(820 + Math.sin(a) * 80)} L ${f1(210 + Math.cos(a) * 125)} ${f1(820 + Math.sin(a) * 125)}`, stroke: "#ff6a4d", "stroke-width": 7, "stroke-linecap": "round" }, heat); }
  mkEl("circle", { id: "chFlame", cx: 710, cy: 820, r: 0, fill: "rgba(255,138,42,0.45)", stroke: "#ffb04a", "stroke-width": 5, opacity: 0 }, g);
}
// gScale: złoty środek 400 do 500 cm3
const SCX = (cc) => 90 + ((cc - 300) / 300) * 720;
{
  const g = $("gScaleG");
  mkEl("rect", { id: "scZone", x: SCX(400), y: 760, width: SCX(500) - SCX(400), height: 80, fill: "rgba(134,219,161,0.3)", opacity: 0 }, g);
  mkEl("line", { x1: SCX(300), x2: SCX(600), y1: 800, y2: 800, stroke: "#b6c1cf", "stroke-width": 6 }, g);
  for (let cc = 300; cc <= 600; cc += 50) {
    mkEl("line", { x1: SCX(cc), x2: SCX(cc), y1: 780, y2: 820, stroke: "#b6c1cf", "stroke-width": 4 }, g);
    mkT(String(cc), { "data-scl": cc, x: SCX(cc), y: 880, "text-anchor": "middle", style: `font-size:${cc === 400 || cc === 500 ? 44 : 28}px;font-weight:600;fill:${cc === 400 || cc === 500 ? "#86dba1" : "#b6c1cf"}`, opacity: cc === 400 || cc === 500 ? 0 : 1 }, g);
  }
  mkT("CM³ NA CYLINDER", { x: 90, y: 940, style: "font-size:24px" }, g);
  const bmw = mkEl("g", { id: "scBmw", opacity: 0 }, g);
  mkEl("path", { d: `M ${SCX(500)} 750 L ${SCX(500)} 640`, stroke: "#7cc4ff", "stroke-width": 5 }, bmw);
  mkT("BMW · 500", { class: "sans", x: SCX(500), y: 620, "text-anchor": "middle", style: "font-size:54px;font-weight:600;fill:#7cc4ff" }, bmw);
}
// gTorque i gCompare: krzywe momentu (poglądowo)
const TQX = (r) => 110 + ((r - 1000) / 5000) * 720, TQY = (nm) => 1150 - (nm / 250) * 520;
const ptNm = (r) => (r < 1750 ? 150 + 80 * ((r - 1000) / 750) : r < 4500 ? 230 : 230 - 55 * ((r - 4500) / 1500));
const naNm = (r) => 110 + 50 * Math.sin(Math.min(1, Math.max(0, (r - 1000) / 3250)) * Math.PI / 2) - 20 * Math.max(0, (r - 4250) / 1750);
function tqAxes(g) {
  mkEl("line", { x1: 110, x2: 830, y1: 1150, y2: 1150, stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }, g);
  mkEl("line", { x1: 110, x2: 110, y1: 600, y2: 1150, stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }, g);
  for (const r of [2000, 4000, 6000]) mkT(String(r), { x: TQX(r), y: 1195, "text-anchor": "middle", style: "font-size:24px" }, g);
  mkT("OBR/MIN · POGLĄDOWO", { x: 830, y: 1235, "text-anchor": "end", style: "font-size:22px" }, g);
}
const tqPath = (f) => { let d = ""; for (let i = 0; i <= 80; i++) { const r = 1000 + (i / 80) * 5000; d += (i ? " L " : "M ") + f1(TQX(r)) + " " + f1(TQY(f(r))); } return d; };
{
  const g = $("gTorqueG");
  tqAxes(g);
  mkEl("path", { id: "tqPt", d: tqPath(ptNm), fill: "none", stroke: "#f5aa3c", "stroke-width": 8, "stroke-linejoin": "round" }, g);
  mkEl("line", { id: "tqMk", x1: TQX(1750), x2: TQX(1750), y1: TQY(230), y2: 1150, stroke: "#86dba1", "stroke-width": 4, "stroke-dasharray": "10 8", opacity: 0 }, g);
  mkT("1750", { id: "tqMkT", x: TQX(1750), y: 1150 - 12, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#86dba1;paint-order:stroke;stroke:#0a0c10;stroke-width:8px", opacity: 0 }, g);
  const g2 = $("gCompareG");
  tqAxes(g2);
  mkEl("path", { d: tqPath(ptNm), fill: "none", stroke: "#f5aa3c", "stroke-width": 8, "stroke-linejoin": "round" }, g2);
  mkT("1.2 PT · 230", { x: TQX(2100), y: TQY(230) - 24, style: "font-size:34px;font-weight:600;fill:#f5aa3c" }, g2);
  mkEl("path", { id: "cmNa", d: tqPath(naNm), fill: "none", stroke: "#b6c1cf", "stroke-width": 8, "stroke-linejoin": "round" }, g2);
  mkT("1.6 · 160", { id: "cmNaT", x: TQX(3600), y: TQY(160) + 60, style: "font-size:34px;font-weight:600;fill:#b6c1cf", opacity: 0 }, g2);
  mkEl("line", { id: "cmMk", x1: TQX(4250), x2: TQX(4250), y1: TQY(160), y2: 1150, stroke: "#ff6a4d", "stroke-width": 4, "stroke-dasharray": "10 8", opacity: 0 }, g2);
}
// gChain: łańcuch kontra pasek
{
  const g = $("gChainG");
  const ch = mkEl("g", { id: "caChain", opacity: 0 }, g);
  for (let i = 0; i < 9; i++) mkEl("rect", { x: 90 + i * 76, y: 560, width: 70, height: 36, rx: 18, fill: "none", stroke: "#b6c1cf", "stroke-width": 8 }, ch);
  mkT("ŁAŃCUCH", { class: "sans", x: 90, y: 660, style: "font-size:52px;font-weight:600;fill:#eef2f7" }, ch);
  [["CIĘŻSZY", 90.75], ["GŁOŚNIEJSZY", 91.38], ["WIĘKSZE TARCIE", 92.36]].forEach(([tx, at], i) => mkT(tx, { "data-cc": at, class: "sans", x: 90, y: 790 + i * 110, style: "font-size:80px;font-weight:600;fill:#ff6a4d", opacity: 0 }, g));
}
// gLength: R4 kontra R3
{
  const g = $("gLengthG");
  const row = (y, n, col, lab, id) => {
    const r = mkEl("g", { id, opacity: 0 }, g);
    mkT(lab, { class: "sans", x: 90, y: y - 70, style: `font-size:44px;font-weight:600;fill:${col}` }, r);
    for (let i = 0; i < n; i++) mkEl("circle", { cx: 150 + i * 150, cy: y, r: 60, fill: "rgba(150,165,182,0.12)", stroke: col, "stroke-width": 6 }, r);
    mkEl("path", { d: `M 90 ${y + 100} L ${150 + (n - 1) * 150 + 60} ${y + 100}`, stroke: col, "stroke-width": 5 }, r);
    return r;
  };
  row(640, 4, "#b6c1cf", "R4", "lnA");
  row(940, 3, "#86dba1", "1.2 PT", "lnB");
}
// gCarTop: mniej ciężaru nad przednią osią
{
  const g = $("gCarTopG");
  mkEl("path", { d: "M 250 1150 L 250 600 Q 250 520 330 515 L 590 515 Q 670 520 670 600 L 670 1150 Q 670 1200 610 1200 L 310 1200 Q 250 1200 250 1150 Z", fill: "rgba(150,165,182,0.07)", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  for (const [x, y] of [[215, 610], [670, 610], [215, 1040], [670, 1040]]) mkEl("rect", { x, y, width: 35, height: 110, rx: 10, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkEl("line", { x1: 250, x2: 670, y1: 665, y2: 665, stroke: "rgba(150,165,182,0.5)", "stroke-width": 3, "stroke-dasharray": "10 8" }, g);
  mkEl("rect", { id: "ctEng", x: 350, y: 570, width: 200, height: 90, rx: 12, fill: "rgba(134,219,161,0.3)", stroke: "#86dba1", "stroke-width": 5 }, g);
  mkT("3 CYL.", { x: 450, y: 625, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#eef2f7" }, g);
  mkEl("path", { id: "ctArr", d: "M 780 700 L 780 780 M 755 755 L 780 780 L 805 755", stroke: "#86dba1", "stroke-width": 8, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  mkT("LŻEJ", { id: "ctL", class: "sans", x: 720, y: 680, style: "font-size:48px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  mkEl("path", { id: "ctTurn", d: "M 460 1300 Q 460 950 760 880", fill: "none", stroke: "#f5aa3c", "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": "16 12", opacity: 0 }, g);
}
// gEurope: ponad 5 milionów
{
  const g = $("gEuropeG");
  mkT("0", { id: "euN", x: 90, y: 700, style: "font-size:150px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em" }, g);
  mkT("SPRZEDANYCH SILNIKÓW", { class: "sans", x: 96, y: 780, style: "font-size:52px;font-weight:600;fill:#eef2f7" }, g);
  mkT("W SAMEJ EUROPIE", { id: "euE", class: "sans", x: 96, y: 860, style: "font-size:52px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  mkT("OD 2014", { id: "euY", class: "sans", x: 96, y: 940, style: "font-size:52px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
  for (let i = 0; i < 50; i++) mkEl("circle", { "data-eu": i, cx: 110 + (i % 10) * 76, cy: 1000 + Math.floor(i / 10) * 30, r: 9, fill: "#f5aa3c", opacity: 0 }, g);
}

/* ================= plansze części 10 (BMW) ================= */
const BMWB = "#7cc4ff";
// gBlinker: kierunkowskaz miga, gaśnie, stempel "Opcja za dopłatą"
{
  const g = $("gBlinkerG");
  mkEl("rect", { x: 90, y: 560, width: 760, height: 330, rx: 40, fill: "#0d1117", stroke: "rgba(150,165,182,0.45)", "stroke-width": 4 }, g);
  const arr = (x, dir, id) => mkEl("path", { id, d: dir < 0 ? `M ${x} 725 L ${x + 110} 630 L ${x + 110} 680 L ${x + 230} 680 L ${x + 230} 770 L ${x + 110} 770 L ${x + 110} 820 Z` : `M ${x + 230} 725 L ${x + 120} 630 L ${x + 120} 680 L ${x} 680 L ${x} 770 L ${x + 120} 770 L ${x + 120} 820 Z`, fill: "#1c2a1f", stroke: "#3a4a3e", "stroke-width": 4 }, g);
  arr(140, -1, "blL"); arr(570, 1, "blR");
  mkT("KIERUNKOWSKAZ", { x: 470, y: 960, "text-anchor": "middle", style: "font-size:30px;fill:#eef2f7" }, g);
}
// gName: Bayerische Motoren Werke
{
  const g = $("gNameG");
  [["BAYERISCHE", 640], ["MOTOREN", 800], ["WERKE", 960]].forEach(([w, y], i) => mkT(w, { "data-nm": i, class: "sans", x: 90, y, style: "font-size:130px;font-weight:600;fill:#eef2f7", opacity: 0 }, g));
  mkT("= ZAKŁADY SILNIKOWE", { id: "nmPl", class: "sans", x: 96, y: 1090, style: "font-size:58px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
}
// gSpecS: 343 KM, 8000 obr/min, bez turbo
{
  const g = $("gSpecSG");
  mkT("BEZ TURBO", { id: "ssT", class: "sans", x: 90, y: 560, style: "font-size:64px;font-weight:600;fill:#86dba1", opacity: 0 }, g);
  bigNum(g, "ssK", 90, 800, 190, "#f5aa3c", "KONIE");
  bigNum(g, "ssR", 90, 1100, 190, BMWB, "OBR/MIN");
}
// gV6: wszyscy na V6, BMW zostało przy R6
{
  const g = $("gV6G");
  for (let i = 0; i < 12; i++) {
    const x = 120 + (i % 4) * 190, y = 560 + Math.floor(i / 4) * 130;
    const c = mkEl("g", { "data-v6": i, opacity: 0 }, g);
    mkEl("rect", { x, y, width: 160, height: 96, rx: 14, fill: "rgba(150,165,182,0.1)", stroke: "#6c737c", "stroke-width": 3 }, c);
    mkT("V6", { class: "sans", x: x + 80, y: y + 66, "text-anchor": "middle", style: "font-size:52px;font-weight:600;fill:#6c737c" }, c);
  }
  const b = mkEl("g", { id: "v6B", opacity: 0 }, g);
  mkEl("rect", { x: 90, y: 960, width: 760, height: 170, rx: 20, fill: "rgba(124,196,255,0.14)", stroke: BMWB, "stroke-width": 5 }, b);
  for (let i = 0; i < 6; i++) mkEl("circle", { cx: 160 + i * 75, cy: 1045, r: 30, fill: "rgba(245,170,60,0.3)", stroke: "#f5aa3c", "stroke-width": 4 }, b);
  mkT("BMW R6", { class: "sans", x: 830, y: 1068, "text-anchor": "end", style: "font-size:64px;font-weight:600;fill:#eef2f7" }, b);
}
// gTach: obrotomierz S54 8000 i V8 8400
const TC = { cx: 450, cy: 930, r: 330 };
const tcA = (rpm) => (Math.PI * 0.75) + (rpm / 9000) * Math.PI * 1.5;
function tachFace(g, c) {
  const arc = (r0, r1, rad) => { const a0 = tcA(r0), a1 = tcA(r1); return `M ${f1(c.cx + Math.cos(a0) * rad)} ${f1(c.cy + Math.sin(a0) * rad)} A ${rad} ${rad} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f1(c.cx + Math.cos(a1) * rad)} ${f1(c.cy + Math.sin(a1) * rad)}`; };
  mkEl("path", { d: arc(0, 9000, c.r), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 22 }, g);
  mkEl("path", { d: arc(8000, 9000, c.r), fill: "none", stroke: "#e2492b", "stroke-width": 22 }, g);
  for (let k = 0; k <= 9; k++) { const a = tcA(k * 1000); mkT(String(k), { x: f1(c.cx + Math.cos(a) * (c.r - 70)), y: f1(c.cy + Math.sin(a) * (c.r - 70) + 16), "text-anchor": "middle", style: `font-size:48px;font-weight:600;fill:${k >= 8 ? "#ff6a4d" : "#eef2f7"}` }, g); }
  mkT("x1000 OBR/MIN", { x: c.cx, y: c.cy + 130, "text-anchor": "middle", style: "font-size:24px" }, g);
}
{
  const g = $("gTachG");
  tachFace(g, TC);
  mkEl("line", { id: "tcA", x1: TC.cx, y1: TC.cy, x2: TC.cx, y2: TC.cy, stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, g);
  mkEl("line", { id: "tcB", x1: TC.cx, y1: TC.cy, x2: TC.cx, y2: TC.cy, stroke: BMWB, "stroke-width": 12, "stroke-linecap": "round", opacity: 0 }, g);
  mkEl("circle", { cx: TC.cx, cy: TC.cy, r: 24, fill: "#eef2f7" }, g);
  mkT("S54 · 8000", { id: "tcAT", class: "sans", x: 90, y: 1340, style: "font-size:56px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
  mkT("V8 M3 · 8400", { id: "tcBT", class: "sans", x: 450, y: 1340, style: "font-size:56px;font-weight:600;fill:#7cc4ff", opacity: 0 }, g);
}
// gRev: V10 z M5, ponad 8000, 507 koni
{
  const g = $("gRevG");
  ["L", "R"].forEach((side, b) => {
    const a = (b ? 36 : -36) * D2R;
    const bank = mkEl("g", { "data-vb": b, opacity: 0 }, g);
    for (let i = 0; i < 5; i++) { const r = 120 + i * 80; mkEl("circle", { cx: f1(330 + Math.sin(a) * r * 0.75), cy: f1(1000 - Math.cos(a) * r * 0.75), r: 30, fill: "rgba(124,196,255,0.2)", stroke: BMWB, "stroke-width": 5 }, bank); }
  });
  mkT("V10", { id: "rvL", class: "sans", x: 610, y: 640, style: "font-size:110px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
  mkT("8000+", { id: "rvR", class: "sans", x: 610, y: 760, style: "font-size:70px;font-weight:600;fill:#7cc4ff", opacity: 0 }, g);
  bigNum(g, "rvK", 90, 1230, 170, "#f5aa3c", "KONI");
}
// gVanosY: lata 90.
{
  const g = $("gVanosYG");
  mkT("LATA 90.", { id: "vyY", x: 84, y: 680, style: "font-size:170px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  const cam = mkEl("g", { id: "vyCam", opacity: 0 }, g);
  mkEl("circle", { cx: 450, cy: 980, r: 150, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 6 }, cam);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI; mkEl("rect", { x: 440, y: 818, width: 20, height: 24, fill: "#b6c1cf", transform: `rotate(${f1(a / D2R)} 450 980)` }, cam); }
  mkEl("path", { id: "vyLobe", d: "M 450 900 Q 520 900 530 980 Q 520 1060 450 1060 Q 380 1060 370 980 Q 380 900 450 900 Z", fill: "rgba(245,170,60,0.4)", stroke: "#f5aa3c", "stroke-width": 6 }, cam);
  mkT("KOŁO", { x: 450, y: 1180, "text-anchor": "middle", style: "font-size:26px" }, cam);
}
// gEvery: dziś ma to prawie każdy
const EV = ["VTEC", "VVT-i", "VarioCam", "Ti-VCT", "CVVT", "MultiAir"];
{
  const g = $("gEveryG");
  EV.forEach((n, i) => {
    const x = 90 + (i % 2) * 390, y = 560 + Math.floor(i / 2) * 130;
    const c = mkEl("g", { "data-ev": i, opacity: 0 }, g);
    mkEl("rect", { x, y, width: 360, height: 100, rx: 12, fill: "rgba(150,165,182,0.1)", stroke: "#6c737c", "stroke-width": 3 }, c);
    mkT(n, { class: "sans", x: x + 180, y: y + 68, "text-anchor": "middle", style: "font-size:52px;font-weight:600;fill:#b6c1cf" }, c);
  });
  const b = mkEl("g", { id: "evB", opacity: 0 }, g);
  mkEl("rect", { x: 90, y: 970, width: 750, height: 140, rx: 16, fill: "rgba(245,170,60,0.2)", stroke: "#f5aa3c", "stroke-width": 6 }, b);
  mkT("BMW VANOS", { class: "sans", x: 465, y: 1068, "text-anchor": "middle", style: "font-size:84px;font-weight:600;fill:#f5aa3c" }, b);
}
// gF1: 1983, Piquet, mistrzostwo
{
  const g = $("gF1G");
  mkT("1983", { id: "f1Y", x: 84, y: 760, style: "font-size:220px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  const cup = mkEl("g", { id: "f1Cup", opacity: 0 }, g);
  const cx = 740, y = 560;
  mkEl("path", { d: `M ${cx - 70} ${y} L ${cx + 70} ${y} L ${cx + 60} ${y + 70} Q ${cx + 50} ${y + 125} ${cx} ${y + 135} Q ${cx - 50} ${y + 125} ${cx - 60} ${y + 70} Z`, fill: "rgba(245,170,60,0.35)", stroke: "#f5aa3c", "stroke-width": 6 }, cup);
  mkEl("rect", { x: cx - 12, y: y + 135, width: 24, height: 34, fill: "#f5aa3c" }, cup);
  mkEl("rect", { x: cx - 55, y: y + 169, width: 110, height: 22, rx: 5, fill: "#f5aa3c" }, cup);
  mkT("BRABHAM BT52 · BMW M12/13", { id: "f1C", x: 90, y: 880, style: "font-size:30px;fill:#eef2f7", opacity: 0 }, g);
}
// gTurboFirst: mistrzowie 1950 do 1983, pierwszy z turbo
{
  const g = $("gTurboFirstG");
  for (let i = 0; i < 34; i++) {
    const x = 110 + (i % 9) * 85, y = 600 + Math.floor(i / 9) * 110;
    mkEl("circle", { "data-tf": i, cx: x, cy: y, r: i === 33 ? 34 : 22, fill: i === 33 ? "#f5aa3c" : "rgba(150,165,182,0.35)", opacity: 0 }, g);
  }
  mkT("1950", { x: 110, y: 1060, "text-anchor": "middle", style: "font-size:26px" }, g);
  mkT("1983 · TURBO", { id: "tfT", class: "sans", x: 90, y: 1160, style: "font-size:70px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
}
// gHp: ponad 800 koni z półtora litra
{
  const g = $("gHpG");
  bigNum(g, "hpN", 90, 760, 230, "#f5aa3c", "KONI");
  mkT("Z 1,5 LITRA", { id: "hpL", class: "sans", x: 96, y: 960, style: "font-size:70px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
}
// gModular: pół litra na cylinder, R3, R4, R6
{
  const g = $("gModularG");
  const one = mkEl("g", { id: "mdOne", opacity: 0 }, g);
  mkEl("rect", { x: 90, y: 540, width: 110, height: 150, rx: 16, fill: "rgba(245,170,60,0.35)", stroke: "#f5aa3c", "stroke-width": 5 }, one);
  mkT("0,5 l", { class: "sans", x: 230, y: 640, style: "font-size:84px;font-weight:600;fill:#f5aa3c" }, one);
  [["B38", 3, 780, 113.66], ["B48", 4, 940, 114.12], ["B58", 6, 1100, 114.86]].forEach(([lab, n, y, at], r) => {
    const row = mkEl("g", { "data-md": r, opacity: 0 }, g);
    for (let i = 0; i < n; i++) mkEl("rect", { x: 90 + i * 100, y, width: 86, height: 120, rx: 12, fill: "rgba(245,170,60,0.25)", stroke: "#f5aa3c", "stroke-width": 4 }, row);
    mkT(lab, { class: "sans", x: 830, y: y + 82, "text-anchor": "end", style: "font-size:60px;font-weight:600;fill:#eef2f7" }, row);
  });
}
// gB58
{
  const g = $("gB58G");
  mkT("B58", { id: "b5N", class: "sans", x: 84, y: 800, style: "font-size:260px;font-weight:600;fill:#7cc4ff", opacity: 0 }, g);
  [["3.0 L", 0], ["R6", 1], ["TURBO", 2]].forEach(([tx, i]) => mkT(tx, { "data-b5": i, class: "sans", x: 90 + i * 250, y: 920, style: "font-size:60px;font-weight:600;fill:#eef2f7", opacity: 0 }, g));
  for (let i = 0; i < 5; i++) mkEl("path", { "data-st": i, d: (() => { const cx = 140 + i * 130, cy = 1060; let d = ""; for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 52, a = -Math.PI / 2 + k * Math.PI / 5; d += (k ? " L " : "M ") + f1(cx + Math.cos(a) * r) + " " + f1(cy + Math.sin(a) * r); } return d + " Z"; })(), fill: "#f5aa3c", opacity: 0 }, g);
}
// gAlt: 1919, samolot, 9760 m
{
  const g = $("gAltG");
  mkT("1919", { id: "alY", x: 84, y: 640, style: "font-size:170px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  mkEl("path", { id: "alPath", d: "M 120 1380 Q 400 1300 560 1000 T 800 700", fill: "none", stroke: "rgba(124,196,255,0.5)", "stroke-width": 5, "stroke-dasharray": "14 10" }, g);
  const pl = mkEl("g", { id: "alPlane", opacity: 0 }, g);
  mkEl("path", { d: "M -46 0 L 40 0 L 52 -8 L 40 -14 L -30 -14 Z M -6 -14 L 10 -46 L 20 -46 L 14 -14 Z M -6 0 L 10 32 L 20 32 L 14 0 Z M -46 -6 L -58 -30 L -48 -30 L -36 -8 Z", fill: "#eef2f7" }, pl);
  mkT("0 m", { id: "alM", x: 0, y: 0, style: "font-size:44px;font-weight:600;fill:#eef2f7;paint-order:stroke;stroke:#0a0c10;stroke-width:10px", opacity: 0 }, g);
}
// gClouds: chmury, samolot 1919, pierwszy samochód BMW 1929
{
  const g = $("gCloudsG");
  for (let i = 0; i < 6; i++) mkEl("ellipse", { cx: 130 + i * 140, cy: 700 + (i % 2) * 20, rx: 110, ry: 46, fill: "rgba(238,242,247,0.16)" }, g);
  const pl = mkEl("g", { id: "clPlane", opacity: 0, transform: "translate(250 640)" }, g);
  mkEl("path", { d: "M -46 0 L 40 0 L 52 -8 L 40 -14 L -30 -14 Z M -6 -14 L 10 -46 L 20 -46 L 14 -14 Z M -6 0 L 10 32 L 20 32 L 14 0 Z", fill: "#7cc4ff" }, pl);
  mkT("1919 · SILNIKI LOTNICZE", { id: "clA", x: 90, y: 820, style: "font-size:34px;font-weight:600;fill:#7cc4ff", opacity: 0 }, g);
  const car = mkEl("g", { id: "clCar", opacity: 0 }, g);
  mkEl("path", { d: "M 140 1060 L 140 1010 Q 150 990 190 985 L 260 950 L 400 950 L 450 985 Q 490 990 490 1020 L 490 1060 Z", fill: "rgba(150,165,182,0.25)", stroke: "#b6c1cf", "stroke-width": 4 }, car);
  mkEl("circle", { cx: 210, cy: 1065, r: 26, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, car);
  mkEl("circle", { cx: 420, cy: 1065, r: 26, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, car);
  mkT("1929 · PIERWSZE AUTO BMW", { x: 90, y: 1140, style: "font-size:30px;fill:#eef2f7" }, car);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gBlinker") {
    stepH($("gBlinkerH"), t, [[4.19, "Kierowcy <em>BMW</em>"], [5.07, "Nie używają <span class=\"hot\">kierunkowskazów</span>"]]);
    const blinkOn = t >= 4.3 && t < 5.91 && Math.floor((t - 4.3) / 0.38) % 2 === 0;
    $("blL").setAttribute("fill", blinkOn ? "#3cff7a" : "#1c2a1f");
    $("blL").setAttribute("stroke", blinkOn ? "#86dba1" : "#3a4a3e");
    stampK($("stBlink"), t, 5.95);
  } else if (id === "gName") {
    stepH($("gNameH"), t, [[19.82, "Więc czemu <em>ta firma</em>"], [20.95, "Ma w nazwie <em>słowo silnik?</em>"]]);
    const hk = easeOut(win(t, 21.61, 21.95));
    [...$("gNameG").querySelectorAll("[data-nm]")].forEach((e) => {
      const i = +e.dataset.nm;
      popS(e, t, 19.9 + i * 0.25, 30);
      if (i === 1) e.setAttribute("style", `font-size:130px;font-weight:600;fill:${hk > 0.5 ? "#f5aa3c" : "#eef2f7"}`);
      else e.setAttribute("opacity", f1(easeOut(win(t, 19.9 + i * 0.25, 20.3 + i * 0.25)) * (1 - 0.6 * hk)));
    });
    $("nmPl").setAttribute("opacity", f1(easeOut(win(t, 21.98, 22.3))));
  } else if (id === "gSpecS") {
    stepH($("gSpecSH"), t, [[30.35, "Trzy i dwie dziesiąte <em>litra</em>"]]);
    $("ssT").setAttribute("opacity", f1(easeOut(win(t, 30.35, 30.7))));
    const k = easeIO(win(t, 31.12, 31.9)), r = easeIO(win(t, 32.4, 33.3));
    $("ssK").textContent = String(Math.round(343 * k)); $("ssR").textContent = String(Math.round(8000 * r / 100) * 100);
    for (const [id2, at] of [["ssK", 31.12], ["ssKU", 31.12], ["ssR", 32.4], ["ssRU", 32.4]]) $(id2).setAttribute("opacity", f1(easeOut(win(t, at, at + 0.3))));
  } else if (id === "gV6") {
    stepH($("gV6H"), t, [[36.18, "Kiedy prawie <em>wszyscy</em>"], [37.43, "Przeszli na <span class=\"hot\">V6</span>"], [38.69, "<em>BMW</em> zostało przy R6"]]);
    [...$("gV6G").querySelectorAll("[data-v6]")].forEach((c) => { const i = +c.dataset.v6; popS(c, t, 36.5 + i * 0.09, 24); });
    popS($("v6B"), t, 38.69, 40);
  } else if (id === "gTach") {
    stepH($("gTachH"), t, [[53.94, "<em>S54</em> kręci się"], [55.42, "Do <em>8000</em>"], [56.9, "<em>V8</em> z kolejnego M3"], [59.09, "Do <em>8400</em>"]]);
    const needle = (el, rpm) => { const a = tcA(rpm); el.setAttribute("x2", f1(TC.cx + Math.cos(a) * (TC.r - 40))); el.setAttribute("y2", f1(TC.cy + Math.sin(a) * (TC.r - 40))); };
    needle($("tcA"), lerp(800, 8000, easeOut(win(t, 54.6, 55.9))));
    needle($("tcB"), lerp(800, 8400, easeOut(win(t, 58.3, 59.6))));
    $("tcB").setAttribute("opacity", f1(easeOut(win(t, 56.9, 57.2))));
    $("tcAT").setAttribute("opacity", f1(easeOut(win(t, 55.62, 55.95))));
    $("tcBT").setAttribute("opacity", f1(easeOut(win(t, 59.32, 59.65))));
  } else if (id === "gRev") {
    stepH($("gRevH"), t, [[60.93, "A <em>V10</em> z M5"], [62.22, "Do <em>ponad 8000</em>"], [64.17, "I daje <em>507 koni</em>"]]);
    [...$("gRevG").querySelectorAll("[data-vb]")].forEach((b) => popS(b, t, 61.0 + +b.dataset.vb * 0.2, 30));
    $("rvL").setAttribute("opacity", f1(easeOut(win(t, 61.0, 61.3))));
    $("rvR").setAttribute("opacity", f1(easeOut(win(t, 62.96, 63.3))));
    const k = easeIO(win(t, 64.53, 65.4));
    $("rvK").textContent = String(Math.round(507 * k));
    $("rvK").setAttribute("opacity", f1(easeOut(win(t, 64.53, 64.8)))); $("rvKU").setAttribute("opacity", f1(easeOut(win(t, 64.53, 64.8))));
  } else if (id === "gVanosY") {
    stepH($("gVanosYH"), t, [[70.2, "BMW <em>wsadziło</em>"], [72.64, "Do <em>seryjnych aut</em>"], [73.61, "<em>Zmienne fazy</em> rozrządu"]]);
    popS($("vyY"), t, 70.25, 40);
    const ck = easeOut(win(t, 73.61, 74.0));
    $("vyCam").setAttribute("opacity", f1(ck));
    $("vyLobe").setAttribute("transform", `rotate(${f1(40 * Math.sin((t - 73.6) * 2.2) * ck)} 450 980)`);
  } else if (id === "gEvery") {
    stepH($("gEveryH"), t, [[83.88, "Dziś ma to <em>prawie każdy</em>"], [85.83, "Ale BMW <em>robiło to wcześnie</em>"]]);
    [...$("gEveryG").querySelectorAll("[data-ev]")].forEach((c) => { const i = +c.dataset.ev; popS(c, t, 84.2 + i * 0.16, 24); c.setAttribute("opacity", f1(easeOut(win(t, 84.2 + i * 0.16, 84.6 + i * 0.16)) * (1 - 0.6 * easeOut(win(t, 85.83, 86.2))))); });
    popS($("evB"), t, 86.13, 40);
    stampK($("stEvery"), t, 87.63);
  } else if (id === "gF1") {
    stepH($("gF1H"), t, [[90.54, "W"], [91.71, "<em>Nelson Piquet</em>"], [92.89, "Zdobył <em>mistrzostwo F1</em>"], [95.42, "Z silnikiem <em>BMW</em>"]]);
    popS($("f1Y"), t, 90.59, 40);
    popS($("f1Cup"), t, 93.47, 40);
    $("f1C").setAttribute("opacity", f1(easeOut(win(t, 95.5, 95.8))));
  } else if (id === "gTurboFirst") {
    stepH($("gTurboFirstH"), t, [[96.87, "<em>Pierwszy</em> tytuł w historii"], [98.18, "Dla silnika <em>z turbo</em>"]]);
    [...$("gTurboFirstG").querySelectorAll("[data-tf]")].forEach((c) => { const i = +c.dataset.tf; const at = i === 33 ? 98.87 : 96.95 + i * 0.035; c.setAttribute("opacity", f1(easeOut(win(t, at, at + 0.2)))); });
    $("tfT").setAttribute("opacity", f1(easeOut(win(t, 98.87, 99.2))));
  } else if (id === "gHp") {
    stepH($("gHpH"), t, [[104.16, "W <em>kwalifikacjach</em>"]]);
    const k = easeIO(win(t, 105.09, 106.0));
    $("hpN").textContent = t >= 106.0 ? "800+" : String(Math.round(800 * k));
    $("hpN").setAttribute("opacity", f1(easeOut(win(t, 104.3, 104.6)))); $("hpNU").setAttribute("opacity", f1(easeOut(win(t, 104.3, 104.6))));
    $("hpL").setAttribute("opacity", f1(easeOut(win(t, 104.6, 104.9))));
  } else if (id === "gModular") {
    stepH($("gModularH"), t, [[111.45, "Nowe BMW mają <em>dokładnie tyle</em>"], [113.66, "Trzy, cztery <em>albo sześć</em>"], [116.23, "Ten sam <em>rozmiar cylindra</em>"], [117.68, "Te same <em>części</em>"]]);
    popS($("mdOne"), t, 112.38, 30);
    [...$("gModularG").querySelectorAll("[data-md]")].forEach((r) => { const i = +r.dataset.md; popS(r, t, [113.66, 114.12, 114.86][i], 30); });
  } else if (id === "gB58") {
    stepH($("gB58H"), t, [[118.97, "A <em>B58</em>"], [119.5, "Uchodzi za <em>jedną z najlepszych</em>"], [121.67, "Szóstek, <em>jakie zbudowano</em>"]]);
    popS($("b5N"), t, 118.99, 40);
    [...$("gB58G").querySelectorAll("[data-b5]")].forEach((e) => popS(e, t, 119.4 + +e.dataset.b5 * 0.2, 20));
    [...$("gB58G").querySelectorAll("[data-st]")].forEach((e) => popS(e, t, 120.87 + +e.dataset.st * 0.12, 20));
  } else if (id === "gAlt") {
    stepH($("gAltH"), t, [[148.51, "W <em>1919</em>"], [149.84, "Samolot <em>z silnikiem BMW</em>"], [151.96, "Wzniósł się <em>na</em>"]]);
    popS($("alY"), t, 148.56, 40);
    const path = $("alPath"), L = path.getTotalLength();
    const k = easeIO(win(t, 149.9, 154.5));
    const pt = path.getPointAtLength(L * k), pt2 = path.getPointAtLength(Math.min(L, L * k + 4));
    const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) / D2R;
    $("alPlane").setAttribute("transform", `translate(${f1(pt.x)} ${f1(pt.y)}) rotate(${f1(ang)})`);
    $("alPlane").setAttribute("opacity", f1(easeOut(win(t, 149.84, 150.1))));
    const m = Math.round(9760 * k);
    $("alM").textContent = fmt(m) + " m";
    $("alM").setAttribute("x", f1(Math.min(pt.x - 60, 600))); $("alM").setAttribute("y", f1(pt.y + 80));
    $("alM").setAttribute("opacity", f1(easeOut(win(t, 150.0, 150.3))));
    stampK($("stAlt"), t, 155.56);
  } else if (id === "gClouds") {
    stepH($("gCloudsH"), t, [[156.75, "Zanim powstał"], [157.68, "Pierwszy <em>samochód BMW</em>"], [159.34, "Ich silniki <em>latały</em>"]]);
    $("clCar").setAttribute("opacity", f1(easeOut(win(t, 158.3, 158.6))));
    $("clCar").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 158.3, 158.9))) * -300)} 0)`);
    const pk = easeOut(win(t, 159.58, 159.9));
    $("clPlane").setAttribute("opacity", f1(pk));
    $("clPlane").setAttribute("transform", `translate(${f1(250 + 380 * easeIO(win(t, 159.6, 161.8)))} ${f1(640 - 30 * easeIO(win(t, 159.6, 161.8)))})`);
    $("clA").setAttribute("opacity", f1(easeOut(win(t, 160.14, 160.5))));
  } else if (id === "gSpec") {
    stepH($("gSpecH"), t, [[25.72, "W mocniejszej <em>wersji</em>"]]);
    const k = easeIO(win(t, 27.39, 28.2)), n = easeIO(win(t, 28.77, 29.6));
    $("spK").textContent = String(Math.round(130 * k)); $("spN").textContent = String(Math.round(230 * n));
    for (const [id, at] of [["spK", 27.39], ["spKU", 27.39], ["spN", 28.77], ["spNU", 28.77], ["spR", 30.12]]) $(id).setAttribute("opacity", f1(easeOut(win(t, at, at + 0.3))));
  } else if (id === "gFriction") {
    stepH($("gFrictionH"), t, [[34.29, "Czwórka <em>ma</em>"], [38.5, "Tu <span class=\"ok\">są</span>"]]);
    popS($("frH4"), t, 34.3, 20); popS($("frH3"), t, 38.5, 20);
    FR_ROWS.forEach(([, , , a, b], i) => {
      popS($("gFrictionG").querySelector(`[data-frl="${i}"]`), t, a - 0.05, 20);
      popS($("gFrictionG").querySelector(`[data-fra="${i}"]`), t, a, 30);
      popS($("gFrictionG").querySelector(`[data-frb="${i}"]`), t, b, 30);
    });
  } else if (id === "gLoss") {
    stepH($("gLossH"), t, [[45.74, "Mniej części, <em>które trą</em>"], [47.12, "To mniej <span class=\"ok\">paliwa</span>"], [48.45, "Na samo <em>kręcenie silnikiem</em>"]]);
    $("loA").setAttribute("width", f1(540 * easeIO(win(t, 45.9, 46.6))));
    $("loB").setAttribute("width", f1(540 * 0.74 * easeIO(win(t, 46.5, 47.2))));
    $("loT").setAttribute("opacity", f1(easeOut(win(t, 47.53, 47.9))));
  } else if (id === "gChamber") {
    stepH($("gChamberH"), t, [[54.14, "Za mała <em>komora</em>"], [54.85, "Traci <span class=\"hot\">ciepło</span> przez ścianki"], [56.7, "Za duża"], [57.25, "Spala <span class=\"hot\">wolno</span>"]]);
    popS($("gChamberG").querySelector('[data-ch="0"]'), t, 54.2, 24);
    popS($("gChamberG").querySelector('[data-ch="1"]'), t, 54.3, 24);
    popS($("gChamberG").querySelector('[data-ch="2"]'), t, 56.7, 24);
    const hk = easeOut(win(t, 54.85, 55.2));
    $("chHeat").setAttribute("opacity", f1(hk * (0.7 + 0.3 * Math.sin(t * 5))));
    const fk = win(t, 57.25, 58.5);
    $("chFlame").setAttribute("r", f1(10 + 110 * easeOut(fk)));
    $("chFlame").setAttribute("opacity", f1(fk > 0 ? 1 : 0));
  } else if (id === "gScale") {
    stepH($("gScaleH"), t, [[58.55, "Wielu <em>inżynierów</em> mówi"], [60.21, "<span class=\"ok\">Złoty środek</span>"], [61.35, "Między <em>400</em> a <em>500 cm³</em>"], [63.86, "<em>BMW</em> z tego powodu"], [65.91, "Pół litra <em>na cylinder</em>"]]);
    $("scZone").setAttribute("opacity", f1(easeOut(win(t, 60.21, 60.6))));
    $("gScaleG").querySelector('[data-scl="400"]').setAttribute("opacity", f1(easeOut(win(t, 61.86, 62.2))));
    $("gScaleG").querySelector('[data-scl="500"]').setAttribute("opacity", f1(easeOut(win(t, 62.96, 63.3))));
    popS($("scBmw"), t, 65.91, 30);
  } else if (id === "gTorque") {
    stepH($("gTorqueH"), t, [[71.94, "<em>230 Nm</em>"], [73.31, "Od <em>1750</em> obrotów"]]);
    dash($("tqPt"), easeIO(win(t, 72.0, 73.2)), 1400);
    const mk = easeOut(win(t, 73.56, 73.9));
    $("tqMk").setAttribute("opacity", f1(mk)); $("tqMkT").setAttribute("opacity", f1(mk));
  } else if (id === "gCompare") {
    stepH($("gCompareH"), t, [[76.42, "Stara <em>wolnossąca 1.6</em>"], [79.01, "Miała <span class=\"hot\">160 Nm</span>"], [80.14, "Dopiero <span class=\"hot\">powyżej 4000</span>"]]);
    dash($("cmNa"), easeIO(win(t, 77.6, 79.0)), 1400);
    $("cmNaT").setAttribute("opacity", f1(easeOut(win(t, 79.47, 79.8))));
    $("cmMk").setAttribute("opacity", f1(easeOut(win(t, 80.82, 81.1))));
  } else if (id === "gChain") {
    stepH($("gChainH"), t, [[88.7, "Tak, <em>ten sam</em>"], [90.05, "<em>Łańcuch</em> jest"]]);
    popS($("caChain"), t, 90.05, 24);
    [...$("gChainG").querySelectorAll("[data-cc]")].forEach((e) => popS(e, t, +e.dataset.cc, 24));
  } else if (id === "gLength") {
    stepH($("gLengthH"), t, [[101.06, "<em>Trzy</em> cylindry"], [101.82, "To <span class=\"ok\">krótki</span>, <span class=\"ok\">lekki</span> silnik"]]);
    popS($("lnA"), t, 101.1, 24); popS($("lnB"), t, 101.4, 24);
  } else if (id === "gCarTop") {
    stepH($("gCarTopH"), t, [[103.61, "Mniej ciężaru <em>nad przednią osią</em>"], [105.58, "Małe auto <span class=\"ok\">lepiej skręca</span>"]]);
    const ak = easeOut(win(t, 104.59, 104.95));
    $("ctArr").setAttribute("opacity", f1(ak)); $("ctL").setAttribute("opacity", f1(ak));
    const tk = easeIO(win(t, 106.2, 107.1));
    $("ctTurn").setAttribute("opacity", tk > 0 ? 1 : 0); dash($("ctTurn"), tk, 900);
  } else if (id === "gEurope") {
    stepH($("gEuropeH"), t, [[135.49, "Tyle takich <em>silników</em>"], [136.69, "Według <em>Stellantisa</em>"]]);
    const n = Math.round(5000000 * easeIO(win(t, 135.6, 137.4)));
    $("euN").textContent = t >= 137.4 ? "5 000 000+" : fmt(n);
    $("euE").setAttribute("opacity", f1(easeOut(win(t, 138.8, 139.1))));
    $("euY").setAttribute("opacity", f1(easeOut(win(t, 139.9, 140.2))));
    [...$("gEuropeG").querySelectorAll("[data-eu]")].forEach((c) => { const i = +c.dataset.eu; c.setAttribute("opacity", f1(easeOut(win(t, 135.7 + i * 0.035, 135.9 + i * 0.035)))); });
  } else if (id === "gBrands") {
    stepH($("brH"), t, [[16.94, "Więc czemu <em>Stellantis</em>"], [18.17, "Wkłada go do <em>prawie każdego</em> auta?"]]);
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
    stepH($("scH"), t, [[133.99, "Mały <em>skaner diagnostyczny</em>"], [135.49, "Wpinasz <em>pod kierownicą</em>"], [137.0, "Na <em>telefonie</em>"], [137.66, "Widzisz <em>błędy</em>"], [138.61, "Zanim zrobi się <span class=\"hot\">drogo</span>"]]);
    $("scPortT").setAttribute("opacity", f1(easeOut(win(t, 136.16, 136.5))));
    const dv = easeOut(win(t, 134.21, 134.6));
    const up = easeIO(win(t, 135.49, 136.2));
    $("scDev").setAttribute("opacity", f1(dv));
    $("scDev").setAttribute("transform", `translate(0 ${f1(170 - 170 * up + (1 - dv) * 30)})`);
    $("scLed").setAttribute("fill", up > 0.98 ? "#86dba1" : "#3a3f47");
    const pk = easeOut(win(t, 137.21, 137.6));
    $("scPhone").style.opacity = pk;
    $("scPhone").style.transform = "translateY(" + f1((1 - pk) * 40) + "px)";
    $("scLink").setAttribute("opacity", f1(pk));
    pop($("scE1"), t, 138.09, 0.25, 20);
    [...$("scPhone").querySelectorAll(".pr")].forEach((r) => pop(r, t, +r.dataset.t, 0.25, 16));
  } else if (id === "gCart") {
    stepH($("caH"), t, [[140.11, "Masz go <em>w koszyku</em>"], [140.83, "Na dole <em>filmu</em>"]]);
    const ck = easeOut(win(t, 140.15, 140.5));
    $("caCard").style.opacity = ck;
    $("caCard").style.transform = "translateY(" + f1((1 - ck) * 30) + "px)";
    dash($("caArr"), easeIO(win(t, 140.5, 141.1)), 700);
    $("caT").setAttribute("opacity", f1(easeOut(win(t, 140.44, 140.75))));
    $("caT2").setAttribute("opacity", f1(easeOut(win(t, 140.94, 141.2))));
  } else if (id === "gTrophy") {
    stepH($("tpH"), t, [[110.28, "<em>4</em> tytuły silnika roku"], [112.07, "Z rzędu. <em>Już mówiłem</em>"]]);
    [...$("tpG").querySelectorAll("[data-cup]")].forEach((c) => { const i = +c.dataset.cup; popS(c, t, 110.4 + i * 0.25, 36); });
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
const RW = ["? ? ?", "M3", "VANOS", "F1", "Motocykle", "Turbo"];
const RN = RW.length, RROW = 50, ANS = "Silniki lotnicze", T_ANS = 147.05;
const BURSTS = [[8.3, 9.2, 2 * RN], [34.45, 35.15, 2 * RN], [52.2, 52.9, 2 * RN], [68.5, 69.2, 2 * RN], [88.8, 89.5, 2 * RN], [106.6, 107.3, 2 * RN], [123.75, 124.45, 2 * RN], [145.7, 146.4, 2 * RN], [146.45, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  $("flash").style.opacity = Math.max(0, ...FLASHES.map(([a, dur, amp]) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0))).toFixed(3);
  const rb = $("reelBar");
  const rOn = inR(t, 8.28, 149.3);
  rb.style.opacity = rOn ? (easeOut(win(t, 8.28, 8.55)) * (1 - easeIO(win(t, 148.9, 149.3)))).toFixed(3) : 0;
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
      easeOut(win(t, 8.28, 8.65)) * (1 - easeIO(win(t, 9.6, 10.1))),
      easeIO(win(t, 145.67, 146.05)) * (1 - easeIO(win(t, 148.2, 148.7))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 156.9, 161.6);
  sc.style.opacity = sOn ? (easeOut(win(t, 156.9, 157.3)) * (1 - easeIO(win(t, 161.2, 161.6)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 156.9, 157.4))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 161.83, 166.4);
  pc.style.opacity = pOn ? (easeOut(win(t, 161.83, 162.2)) * (1 - easeIO(win(t, 166.1, 166.4)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 161.83, 162.2))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 162.55 ? (t < 163.8 ? easeOut(win(t, 162.55, 162.75)) : 0.5) : 0;
    const gB = t > 163.8 ? easeOut(win(t, 163.8, 164.0)) : 0;
    on("pkA", Math.max(gA, t > 164.66 ? 0.5 + 0.5 * Math.sin((t - 164.66) * 3) : 0)); on("pkB", t > 164.66 ? 0.5 - 0.5 * Math.sin((t - 164.66) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 164.66, 165.0));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 166.47, 175.35);
  yc.style.opacity = yOn ? (easeOut(win(t, 166.47, 166.85)) * (1 - easeIO(win(t, 175.05, 175.35)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 166.47, 166.95))) * -60).toFixed(1) + "px)";
}

/* ================= B-roll: napisy natywne dosłownie ze słów lektora ================= */
const BR_CAP = {
  b02: [[3.27, "Tak, wiem", "Tak, <em>wiem</em>"]],
  b08: [],
  b13: [[13.15, "Tylko że", "Wszyscy znają BMW <em>z jednego</em>"]],
  b10: [[15.78, "Z jednego", "Z <span class=\"hot\">rachunków</span> od mechanika"]],
  b04: [[48.52, "BMW robi je", "Od <em>dziesięcioleci</em>"], [50.42, "BMW robi je", "I nigdy <em>nie odpuściło</em>"]],
  b15: [[66.32, "Bez turbo", "Z <em>czystej mechaniki</em>"]],
  b16: [[99.51, "Silnik F1 BMW", "<em>Półtora</em> litra"], [100.44, "Silnik F1 BMW", "<em>Cztery</em> cylindry"], [101.56, "Silnik F1 BMW", "Blok z <em>seryjnego</em> silnika"]],
  ep9: [[108.07, "Poprzedni odcinek, część 9", "Mówiłem o <em>pół litra</em>"]],
  b06: [[123.71, "Uczciwie?", "BMW kocha <span class=\"hot\">drogie naprawy</span>"]],
  b17: [[131.15, "Dlatego w BMW", "Nie czekaj <em>na kontrolkę</em>"]],
  b11: [[141.66, "Ale silnik", "Który kręci się do <em>8000</em>"], [144.33, "Taki silnik", "Zawsze <span class=\"hot\">kosztuje</span>"]],
  b18: [],
};
function drawBroll(t, name) {
  const list = BR_CAP[name] || [];
  let cur = list[0];
  for (const x of list) if (t >= x[0]) cur = x;
  $("brUi").style.opacity = cur ? 1 : 0;
  if (!cur) return;
  if ($("brK").textContent !== cur[1]) $("brK").textContent = cur[1];
  setH($("brH"), cur[2], t, cur[0]);
}

// obrotomierz w hooku: na "najlepsze" wskazówka wskakuje na 8000; w pętli wraca na wolne obroty
const HT = { cx: 190, cy: 1330, r: 115 };
const htA = (rpm) => (Math.PI * 0.75) + (rpm / 9000) * Math.PI * 1.5;
const htG = mkEl("g", { id: "hkTach", opacity: 0 }, $("svg"));
{
  const arc = (r0, r1, rad) => { const a0 = htA(r0), a1 = htA(r1); return `M ${f1(HT.cx + Math.cos(a0) * rad)} ${f1(HT.cy + Math.sin(a0) * rad)} A ${rad} ${rad} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f1(HT.cx + Math.cos(a1) * rad)} ${f1(HT.cy + Math.sin(a1) * rad)}`; };
  mkEl("circle", { cx: HT.cx, cy: HT.cy, r: HT.r + 18, fill: "rgba(9,12,17,0.9)", stroke: "rgba(150,165,182,0.35)", "stroke-width": 3 }, htG);
  mkEl("path", { d: arc(0, 9000, HT.r - 10), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 10 }, htG);
  mkEl("path", { d: arc(8000, 9000, HT.r - 10), fill: "none", stroke: "#e2492b", "stroke-width": 10 }, htG);
  for (let k = 0; k <= 9; k++) {
    const a = htA(k * 1000);
    mkT(String(k), { x: f1(HT.cx + Math.cos(a) * (HT.r - 42)), y: f1(HT.cy + Math.sin(a) * (HT.r - 42) + 10), "text-anchor": "middle", style: `font-size:26px;font-weight:600;fill:${k >= 8 ? "#ff6a4d" : "#eef2f7"}` }, htG);
  }
  mkEl("line", { id: "htN", x1: HT.cx, y1: HT.cy, x2: HT.cx, y2: HT.cy - HT.r + 30, stroke: "#7cc4ff", "stroke-width": 7, "stroke-linecap": "round" }, htG);
  mkEl("circle", { cx: HT.cx, cy: HT.cy, r: 12, fill: "#7cc4ff" }, htG);
  mkT("x1000 OBR/MIN", { x: HT.cx, y: HT.cy + 70, "text-anchor": "middle", style: "font-size:18px;fill:#b6c1cf" }, htG);
}
function drawHkTach(t, name) {
  const on = name === "hook" || name === "hook2" || name === "outro";
  htG.setAttribute("opacity", on ? (name === "outro" ? f1(easeOut(win(t, 175.43, 175.83))) : 1) : 0);
  if (!on) return;
  let rpm = 900;
  if (name === "hook") rpm = lerp(900, 8000, easeOut(win(t, 0.05, 0.68)));
  else if (name === "hook2") rpm = 8000 - 1200 * easeIO(win(t, 2.5, 3.27));
  const a = htA(rpm);
  $("htN").setAttribute("x2", f1(HT.cx + Math.cos(a) * (HT.r - 30))); $("htN").setAttribute("y2", f1(HT.cy + Math.sin(a) * (HT.r - 30)));
  $("htN").setAttribute("stroke", rpm >= 7900 ? "#ff6a4d" : "#7cc4ff");
}

/* ================= render klatki ================= */
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: +el.dataset.t }));
const chipSets = ["chToys", "chFire"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chToys: "toys", chFire: "fire" };

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
  poseS(A.s, deg, t);
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
    const p = localPoint(SE.root, x, KS.DECK + 300, 0);
    place(el, p.x, p.y);
    const k = easeOut(win(t, 26.0 + i * 0.1, 26.3 + i * 0.1));
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
  const hookOn = name === "hook" || name === "hook2", outroOn = name === "outro";
  show($("hk"), hookOn || outroOn);
  if (hookOn || outroOn) {
    $("hk").style.opacity = hookOn ? 1 : easeOut(win(t, 175.43, 175.83)).toFixed(3);
    hkWords.forEach((w) => {
      const k = hookOn ? easeOut(win(t, w.t, w.t + 0.16)) : 0;
      w.el.style.opacity = (0.5 + 0.5 * k).toFixed(3);
      w.el.style.color = k > 0.5 && w.el.textContent === "BMW" ? "#7cc4ff" : "";
      w.el.style.transform = "translateY(" + f1(-8 * Math.sin(Math.PI * clamp01((t - w.t) / 0.25)) * (hookOn ? 1 : 0)) + "px)";
    });
    const bk = hookOn ? easeOut(win(t, 0.68, 0.82)) : 0;
    const hit = hookOn ? Math.max(0, 1 - Math.abs(t - 0.73) / 0.35) : 0;
    $("hkBig").style.opacity = (0.5 + 0.5 * bk).toFixed(3);
    $("hkBig").style.color = bk > 0.5 ? "#7cc4ff" : "";
    $("hkBig").style.transform = "scale(" + (1 + 0.12 * hit).toFixed(3) + ") rotate(" + (-3 * hit).toFixed(2) + "deg)";
    // logo BMW (oficjalny plik z Wikimedia Commons): puls na "BMW", na "najlepsze" obrót monety w osi Y
    const pulse = hookOn ? Math.sin(Math.PI * clamp01((t - 0.05) / 0.35)) : 0;
    $("hkLogo").style.transform = "perspective(900px) rotateY(" + (hookOn ? 360 * easeIO(win(t, 0.68, 1.25)) : 0).toFixed(1) + "deg) scale(" + (1 + 0.12 * pulse + 0.08 * hit).toFixed(3) + ")";
  }
  drawHkTach(t, name);
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
