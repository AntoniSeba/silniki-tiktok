// Instrukcja: jak zabić silnik, nie robiąc nic złego. Część 11. Forma: instrukcja obsługi, bez bębna i kart.
// Bohater: trzycylindrowy silnik z turbo (model R3 jako zastępnik diesla, bez świec zapłonowych),
// filtr DPF, koło dwumasowe i callback do panewki. Bez napisów na środku.
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

const W = 1080, H = 1920, D = 143.38848;
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
  [0, 2.23, "3d", "hook"], [2.23, 3.43, "broll", "b03"], [3.43, 6.3, "board", "gSteps"], [6.3, 9.5, "broll", "b05"], [9.5, 11.22, "broll", "b12"],
  [11.22, 16.02, "board", "gK1"], [16.02, 21.94, "3d", "cold"], [21.94, 25.18, "3d", "bearing"], [25.18, 27.18, "broll", "b04"], [27.18, 29.3, "3d", "inside"],
  [29.3, 35.7, "board", "gK2"], [35.7, 41.25, "board", "gWear"], [41.25, 44.14, "broll", "b08"], [44.14, 49.93, "board", "gK3"], [49.93, 55.13, "3d", "hotTurbo"],
  [55.13, 60.66, "board", "gNagar"], [60.66, 65.94, "3d", "fix"], [65.94, 70.98, "board", "gK4"], [70.98, 79.9, "board", "gTank"], [79.9, 80.9, "broll", "b06"],
  [80.9, 86.29, "board", "gK5"], [86.29, 88.09, "broll", "b07"], [88.09, 93.94, "3d", "gasket"], [93.94, 97.4, "board", "gQ"], [97.4, 99.02, "broll", "b10"],
  [99.02, 103.97, "board", "gList"], [103.97, 108.33, "3d", "warranty"], [108.33, 110.93, "broll", "b11"], [110.93, 115.14, "3d", "broken"], [115.14, 121.45, "board", "gFlip"],
  [121.45, 123.93, "3d", "r1"], [123.93, 127.53, "board", "gRpm2"], [127.53, 130.14, "3d", "r3"], [130.14, 131.1, "broll", "b02"], [131.1, 133.62, "board", "gLamp"],
  [133.62, 140.82, "board", "gBack"], [140.82, D + 1, "3d", "outro"],
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

const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a), BROWN = new THREE.Color(0x9a5a14);
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

// filtr cząstek stałych: stalowa puszka na wydechu za turbo (tylko w ujęciach o filtrze)
const dpfSteel = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, metalness: 0.85, roughness: 0.32, emissive: RED.clone(), emissiveIntensity: 0 });
const dpf = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 300, 48), dpfSteel);
  body.rotation.z = Math.PI / 2; dpf.add(body);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x5c636b, metalness: 0.7, roughness: 0.45 });
  for (const x of [-95, 95]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(68, 68, 22, 48), bandMat); b.rotation.z = Math.PI / 2; b.position.x = x; dpf.add(b); }
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(64, 26, 80, 48), dpfSteel);
  c1.rotation.z = -Math.PI / 2; c1.position.x = -190; dpf.add(c1);
  const c2 = new THREE.Mesh(new THREE.CylinderGeometry(64, 26, 80, 48), dpfSteel);
  c2.rotation.z = Math.PI / 2; c2.position.x = 190; dpf.add(c2);
  const pipe = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.8, roughness: 0.4 });
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 120, 24), pipe); p1.rotation.z = Math.PI / 2; p1.position.x = -290; dpf.add(p1);
  const p2 = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 120, 24), pipe); p2.rotation.z = Math.PI / 2; p2.position.x = 290; dpf.add(p2);
}
dpf.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
dpf.visible = false;
E.root.add(dpf);
{
  // stoi za turbo po stronie wydechu (-Z), niżej niż turbina
  const c = E.root.worldToLocal(TURBO_C.clone());
  dpf.position.set(c.x, c.y - 30, c.z - 270);
}
const DPF_C = () => dpf.getWorldPosition(new THREE.Vector3());
const exhGlow = glowMats(IND.groups.manifolds).concat(glowMats(IND.groups.exhaust));
const indGlow = glowMats(IND.groups.plenum);
const flyGlow = glowMats(R.groups.flywheel);
const PLEN_C = worldCenter(IND.groups.plenum);
const FLY_C = worldCenter(R.groups.flywheel);

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
  let seed = 20261001;
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
  hook: [[0, P0], [0.6, Pw(-2.45, 0.24, 3550, -250)], [2.23, Pw(-2.1, 0.2, 3350, -230)]],
  cold: [[16.02, P(SIN + 0.12, 0.08, 2100, 0, 60, 0, 32, 60)], [21.94, P(SIN - 0.2, 0.06, 2100, 0, 60, 0, 32, 60)]],
  bearing: [[21.94, PB(SIN + 0.1, 0.05, 2000, 0, -30, 0, 32, 170)], [25.18, PB(SIN - 0.06, 0.03, 2000, 0, -30, 0, 32, 170)]],
  inside: [[27.18, Pw(2.2, 0.22, 3300)], [29.3, Pw(1.9, 0.26, 3300)]],
  hotTurbo: [[49.93, P(EXH - 0.5, 0.26, 2500, -20, 150, -110, 32, 60)], [55.13, P(EXH - 0.2, 0.2, 2500, -20, 150, -110, 32, 60)]],
  fix: [[60.66, Pw(-2.7, 0.24, 3300)], [65.94, Pw(-2.2, 0.28, 3300)]],
  gasket: [[88.09, P(SIN + 0.3, 0.3, 3000, -20, 150, 0, 32, 20)], [93.94, P(SIN + 0.05, 0.24, 3000, -20, 150, 0, 32, 20)]],
  warranty: [[103.97, Pw(1.95, 0.18, 3300)], [108.33, Pw(1.5, 0.24, 3300)]],
  broken: [[110.93, Pw(-0.6, 0.3, 3300)], [115.14, Pw(-0.3, 0.26, 3300)]],
  r1: [[121.45, Pw(0.9, 0.22, 3300)], [123.93, Pw(0.7, 0.2, 3300)]],
  r3: [[127.53, P(EXH + 0.4, 0.22, 2500, -20, 150, -110, 32, 60)], [130.14, P(EXH + 0.6, 0.18, 2500, -20, 150, -110, 32, 60)]],
  outro: [[140.82, Pw(-2.95, 0.34, 4300, -290)], [D, P0], [D + 1, Pw(-2.45, 0.24, 3550, -250)]],
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
const HOOK_END = 0;
const BEATS = [];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const FLASHES = [];
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
  ex: 0, fireHard: 0, section: 0, noInd: 0, noPan: 0, fire: 0, pow: 0, spray: 0, gP: 0, gTurbo: 0, gFuel: 0,
  gExh: 0, exhCol: RED, gInd: 0, indCol: AMBER, gFly: 0, dpf: 0, dpfHot: 0, drip: 0, panOil: 0, dilute: 0, bear: 0,
});
function states(t, name) {
  const s = blank();
  let base = new THREE.Vector3(CX, CY, CZ);
  switch (name) {
    case "hook": s.ex = 0.9 * Math.pow(1 - clamp01(t / 1.2), 2); s.fire = 1; s.pow = 1; break;
    case "outro": s.ex = 0.9 * Math.pow(win(t, 140.82, D), 2); s.fire = 1; s.pow = t >= 141.4 ? 1 : 0; break;
    case "cold": s.section = 1; s.noInd = 1; s.noPan = 1; s.panOil = 1; s.fire = 1; break;
    case "bearing": s.bear = 1; base = BP; break;
    case "inside": s.fire = 1; break;
    case "hotTurbo": s.fire = 1; s.gExh = 0.9 * easeOut(win(t, 53.18, 54.4)); break;
    case "fix": s.fire = 1; s.gExh = 0.8 * (1 - easeIO(win(t, 61.66, 64.4))); break;
    case "gasket": s.section = 1; s.noInd = 1; s.fire = 1; s.gP = 0.7 * easeOut(win(t, 88.6, 90.0)); s.gExh = 0.9 * easeIO(win(t, 90.82, 93.3)); break;
    case "warranty": s.fire = 1; break;
    case "broken": s.fire = 0; s.gP = 0.6; s.gExh = 0.85; break;
    case "r1": s.fire = 1; break;
    case "r3": s.fire = 1; s.gTurbo = 0.6 * (1 - easeIO(win(t, 127.53, 129.7))); break;
  }
  return { s, base };
}

function pose(st, deg, t) {
  E.update(deg, { explode: st.ex, turboDeg: t * TB_RATE });
  IND.root.visible = !st.noInd;
  for (const g of [B.groups.skinIn, B.groups.skinEx, HD.groups.skinIn, HD.groups.skinEx]) g.visible = !st.section;
  deckMeshes.forEach((o) => { o.visible = !st.section; });
  B.groups.pan.visible = !st.noPan;
  TM.groups.covers.visible = false;
  HD.groups.ignition.visible = false; // diesel nie ma świec ani cewek zapłonowych
  vacPump.visible = false;
  vacLine.visible = false;
  for (let i = 0; i < NC; i++) { setGlow(pistGlow[i], st.gP, AMBER); setGlow(rodGlow[i], st.gP * 0.6, AMBER); }
  setGlow(turboGlow, st.gExh > 0 ? st.gExh : st.gTurbo, st.gExh > 0 ? st.exhCol : AMBER);
  setGlow(exhGlow, st.gExh, st.exhCol);
  setGlow(indGlow, st.gInd, st.indCol);
  setGlow(flyGlow, st.gFly, AMBER);
  setGlow(fuelGlow, st.gFuel, AMBER);
  dpf.visible = !!st.dpf;
  dpfSteel.emissiveIntensity = st.dpfHot;
  // zapłon jako miękki żar i gaz suwu pracy
  for (let i = 0; i < NC; i++) {
    const ph = wrap(deg - K.firePhaseDeg(i + 1), 720);
    flashes[i].m.position.set(K.CYL_X[i], DECK + 12, 0);
    if (st.fireHard) {
      // w hooku zapłon jak w 2JZ: ostry błysk, który szybko gaśnie
      const k = ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
      flashes[i].m.visible = k > 0.01;
      flashes[i].mat.opacity = k;
      flashes[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    } else {
      const k = st.fire ? softFire(ph) : 0;
      flashes[i].m.visible = k > 0.01;
      flashes[i].mat.opacity = 0.45 * k;
      flashes[i].mat.color.setRGB(1.3, 0.55, 0.16);
    }
    const on = !!st.pow && ph < 180;
    pows[i].m.visible = on;
    if (on) {
      const crown = K.pistonCrownY(deg, i + 1), len = Math.max(2, DECK + 8 - crown);
      pows[i].m.scale.set(1, len, 1);
      pows[i].m.position.set(K.CYL_X[i], crown + len / 2, 0);
      pows[i].mat.opacity = 0.55 * Math.sin(Math.PI * (ph / 180));
      pows[i].mat.color.setRGB(1.3 - 0.3 * (ph / 180), 0.5 - 0.2 * (ph / 180), 0.12);
    }
    // wtrysk: stożek mgły paliwa, łagodnie narasta i gaśnie
    const intake = ph > 540 ? (ph - 540) / 180 : -1;
    const sk = st.spray && intake >= 0 ? st.spray * Math.sin(intake * Math.PI) : 0;
    sprays[i].m.visible = sk > 0.02;
    sprays[i].m.position.set(K.CYL_X[i] - 6, DECK - 30, 6);
    sprays[i].mat.opacity = 0.7 * sk;
  }
  // olej w misce
  panOil.visible = st.panOil > 0 && !!st.section;
  if (panOil.visible) {
    const h = 26 + 10 * st.dilute;
    panOil.scale.y = h; panOil.position.set(0, K.L.panBottomY + 2 + h / 2, 0);
    panOilMat.color.lerpColors(PAN_OIL_A, PAN_OIL_B, st.dilute);
  }
  // paliwo po ściankach
  drips.forEach((d) => {
    d.m.visible = st.drip > 0.02;
    if (!d.m.visible) return;
    const p = frac(t * 0.55 + d.ph);
    const y = lerp(DECK - 40, K.L.panBottomY + 30, easeIO(p));
    d.m.position.set(K.CYL_X[d.i] + (d.j - 2) * 15, y, BORE_R - 3);
    d.m.material.opacity = 0.9 * st.drip * Math.sin(p * Math.PI);
  });
  E.root.updateMatrixWorld(true);
  bear.group.visible = !!st.bear;
}
// panewka: klin olejowy znika, czop opada, metal trze o metal
function bearState(t, deg, name) {
  const k = easeIO(win(t, 24.4, 25.1));
  return { ang: -deg * D2R * 0.5, e: lerp(CLEAR * 0.985, 0.09, 0), fill: 0.1 + 0.0 * k, glow: 0, oilGlow: 0 };
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
  { t0: 16.4, t1: 21.94, text: "Zimny olej", a: () => E.root.localToWorld(new THREE.Vector3(0, K.L.panBottomY + 20, 0)), off: [-150, 260], c: "oil" },
  { t0: 88.6, t1: 93.94, text: "Uszczelka", a: W3(K.CYL_X[1], K.L.deckY, K.L.blockWallZ), off: [170, -300], c: "hot" },
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
const TOPS = [
  [16.02, "Olej w misce", "Jest <em>zimny</em>"],
  [17.36, "Zimny i", "<em>Gęsty</em>"],
  [18.52, "W pierwszych sekundach", "Musi dojść do <em>każdej panewki</em>"],
  [21.94, "Zanim dojdzie", "Silnik <span class=\"hot\">już pracuje</span>"],
  [23.98, "Pod", "<span class=\"hot\">Obciążeniem</span>"],
  [27.18, "Bo dzieje się", "<em>W środku</em>"],
  [49.93, "Turbina", "Kręci się jeszcze <em>100 tysięcy</em>"],
  [52.29, "Razy", "Na <em>minutę</em>"],
  [53.18, "I jest", "Rozgrzana <span class=\"hot\">do czerwoności</span>"],
  [60.66, "Kilkadziesiąt sekund", "Spokojniejszej <em>jazdy</em>"],
  [63.01, "Przed parkingiem", "By to <span class=\"ok\">naprawiło</span>"],
  [64.67, "Ale ty", "Się <span class=\"hot\">spieszysz</span>"],
  [88.09, "Uszczelka", "Pod <em>głowicą</em>"],
  [89.52, "Nie ma", "<em>Kontrolki</em>"],
  [90.82, "Ma tylko", "<em>Cierpliwość</em>"],
  [92.24, "I ta kończy się", "<span class=\"hot\">Na raz</span>"],
  [103.97, "Robi tak", "Wielu <em>kierowców</em>"],
  [105.62, "I wiele silników", "Dożywa <em>końca gwarancji</em>"],
  [110.93, "Silnik", "Się zepsuł <span class=\"hot\">sam</span>"],
  [112.53, "Tak to wygląda", "Kiedy <em>nikt nie jest winny</em>"],
  [121.45, "Minuta", "Spokojnej <em>jazdy</em>"],
  [122.45, "Po", "<em>Odpaleniu</em>"],
  [127.53, "Kilkadziesiąt sekund", "Przed <em>wyłączeniem turbo</em>"],
];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // przy obietnicy i odpowiedzi mówi bęben, przy kartach na końcu nagłówek milczy
  const nm = SHOTS[si][3];
  const off = nm === "hook" || nm === "outro" || nm === "promise" || nm === "promised" || nm === "ans" || nm === "pickA" || nm === "yt";
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
const O = "#f5aa3c", HT = "#ff6a4d", OKc = "#86dba1", IC = "#7cc4ff", FG = "#eef2f7", FG2 = "#b6c1cf", SOOT = "#5a5148";
const L_ = (g, x1, y1, x2, y2, col, w = 4, a = {}) => mkEl("line", { x1, y1, x2, y2, stroke: col, "stroke-width": w, "stroke-linecap": "round", ...a }, g);
const R_ = (g, x, y, w, h, a = {}) => mkEl("rect", { x, y, width: w, height: h, ...a }, g);
const C_ = (g, cx, cy, r, a = {}) => mkEl("circle", { cx, cy, r, ...a }, g);
const T_ = (g, s, x, y, size, col, a = {}) => mkT(s, { x, y, style: `font-size:${size}px;fill:${col}`, ...a }, g);
const S_ = (g, s, x, y, size, col, a = {}) => mkT(s, { class: "sans", x, y, style: `font-size:${size}px;font-weight:600;fill:${col}`, ...a }, g);
const op = (el, v) => el.setAttribute("opacity", f1(clamp01(v)));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixC = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(",")})`; };
const carIcon = (g, col = O) => {
  const c = mkEl("g", {}, g);
  R_(c, -50, -34, 100, 34, { rx: 12, fill: "#1c232c", stroke: col, "stroke-width": 4 });
  R_(c, -28, -58, 58, 26, { rx: 10, fill: "#1c232c", stroke: col, "stroke-width": 4 });
  C_(c, -28, 0, 12, { fill: FG2 }); C_(c, 28, 0, 12, { fill: FG2 });
  return c;
};
const trafficLight = (g, x, y) => {
  const t = mkEl("g", {}, g);
  R_(t, x, y, 110, 290, { rx: 22, fill: "#0d1117", stroke: FG2, "stroke-width": 5 });
  const r = C_(t, x + 55, y + 62, 36, { fill: "#3a1410" });
  const a = C_(t, x + 55, y + 145, 36, { fill: "#3a2e10" });
  const gr = C_(t, x + 55, y + 228, 36, { fill: "#103a1c" });
  return { r, a, g: gr };
};
const setLight = (tl, st) => {
  tl.r.setAttribute("fill", st === "r" ? "#ff3b2a" : "#3a1410");
  tl.g.setAttribute("fill", st === "g" ? "#3cff7a" : "#103a1c");
};
const skyline = (g, x0, x1, base, seed) => {
  const s = mkEl("g", { opacity: 0 }, g);
  let x = x0;
  for (let i = 0; x < x1; i++) {
    const w = 46 + hash(seed + i) * 40, h = 90 + hash(seed + i + 40) * 210;
    R_(s, x, base - h, Math.min(w, x1 - x - 6), h, { fill: "rgba(150,165,182,0.1)", stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 });
    x += w + 8;
  }
  L_(s, x0, base, x1, base, FG2, 5);
  return s;
};
const checkPath = (g, x, y, col = OKc) => mkEl("path", { d: `M ${x} ${y} L ${x + 26} ${y + 26} L ${x + 70} ${y - 26}`, fill: "none", stroke: col, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, g);

const STEPS = ["ODPAL I JEDŹ", "ZIMNY SILNIK NA OBROTY", "GORĄCE TURBO OD RAZU OFF", "JAZDA NA OPARACH", "KONTROLKA? JESZCZE KILOMETR"];
const bigNum = (g, n) => mkT(String(n), { x: 50, y: 980, style: "font-size:420px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.06em", opacity: 0.95 }, g);
const gauge = (g, cx, cy, r, zones) => {
  const pt = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const arc = (a0, a1, rr) => { const p0 = pt(a0, rr), p1 = pt(a1, rr); return `M ${f1(p0[0])} ${f1(p0[1])} A ${rr} ${rr} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`; };
  mkEl("path", { d: arc(Math.PI, 2 * Math.PI, r), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 26, "stroke-linecap": "round" }, g);
  (zones || []).forEach(([a, b, c]) => mkEl("path", { d: arc(Math.PI * (1 + a), Math.PI * (1 + b), r), fill: "none", stroke: c, "stroke-width": 26 }, g));
  const needle = L_(g, cx, cy, cx, cy - r + 40, O, 10);
  C_(g, cx, cy, 16, { fill: O });
  const set = (k, col) => { const a = Math.PI * (1 + k); needle.setAttribute("x2", f1(cx + Math.cos(a) * (r - 34))); needle.setAttribute("y2", f1(cy + Math.sin(a) * (r - 34))); if (col) needle.setAttribute("stroke", col); };
  return { needle, set };
};
const rowsList = (g, x0 = 90) => STEPS.map((nm, i) => {
  const y = 580 + i * 110, r = mkEl("g", { opacity: 0 }, g);
  const box = R_(r, x0, y, 740, 92, { rx: 14, fill: "rgba(20,26,34,0.95)", stroke: HT, "stroke-width": 3 });
  const tx = S_(r, nm, x0 + 30, y + 64, 40, FG, {});
  const n = T_(r, String(i + 1), x0 + 690, y + 62, 40, FG2, { "text-anchor": "middle" });
  const ck = checkPath(r, x0 + 660, y + 48);
  return { r, box, tx, ck };
});

// gSteps: pięć kroków wygląda niewinnie
const SP_ = (() => {
  const g = $("spG");
  const chips = [1, 2, 3, 4, 5].map((n, i) => {
    const c = mkEl("g", { opacity: 0 }, g);
    R_(c, 90 + i * 146, 660, 120, 140, { rx: 18, fill: "rgba(20,26,34,0.95)", stroke: FG2, "stroke-width": 4 });
    S_(c, String(n), 150 + i * 146, 770, 90, FG, { "text-anchor": "middle" });
    const ok = checkPath(g, 110 + i * 146, 840, OKc); ok.setAttribute("transform", "scale(0.7)"); ok.setAttribute("transform-origin", "0 0");
    return { c, ok, x: 110 + i * 146 };
  });
  return { chips };
})();

// gK1: odpal i od razu jedź, rano, w zimie, bez czekania
const K1 = (() => {
  const g = $("k1G"); bigNum(g, 1);
  const st = mkEl("g", { opacity: 0 }, g);
  C_(st, 560, 690, 96, { fill: "rgba(20,26,34,0.95)", stroke: O, "stroke-width": 8 });
  S_(st, "START", 560, 706, 46, O, { "text-anchor": "middle" });
  const snow = mkEl("g", { opacity: 0 }, g);
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; L_(snow, 760 - Math.cos(a) * 72, 690 - Math.sin(a) * 72, 760 + Math.cos(a) * 72, 690 + Math.sin(a) * 72, IC, 8); }
  const clock = mkEl("g", { opacity: 0 }, g);
  C_(clock, 560, 920, 80, { fill: "none", stroke: FG2, "stroke-width": 8 });
  L_(clock, 560, 920, 560, 860, FG, 8);
  S_(clock, "0 s", 700, 940, 60, FG, {});
  return { st, snow, clock };
})();

// gK2: zimny silnik, obroty do 3-4 tysięcy
const K2 = (() => {
  const g = $("k2G"); bigNum(g, 2);
  const temp = mkEl("g", { opacity: 0 }, g);
  T_(temp, "TEMPERATURA SILNIKA", 380, 620, 24, FG2, {});
  R_(temp, 380, 640, 440, 44, { rx: 8, fill: "rgba(150,165,182,0.15)" });
  R_(temp, 380, 640, 50, 44, { rx: 8, fill: IC });
  const gz = gauge(g, 600, 940, 160, [[0, 0.5, OKc], [0.5, 1, HT]]);
  T_(g, "OBROTY", 600, 985, 24, FG2, { "text-anchor": "middle" });
  gz.set(0.02);
  return { temp, gz };
})();

// gWear: największe zużycie w pierwszych minutach
const WR = (() => {
  const g = $("wrG");
  const lab = T_(g, "MÓWI SIĘ", 90, 600, 26, FG2, { opacity: 0 });
  const b1 = R_(g, 140, 1000, 230, 0, { rx: 12, fill: HT });
  const b2 = R_(g, 500, 1000, 230, 0, { rx: 12, fill: OKc });
  L_(g, 90, 1002, 830, 1002, FG2, 5);
  const t1 = S_(g, "PIERWSZE MINUTY", 255, 1056, 34, FG, { "text-anchor": "middle", opacity: 0 });
  const t2 = S_(g, "TRASA", 615, 1056, 34, FG, { "text-anchor": "middle", opacity: 0 });
  return { lab, b1, b2, t1, t2 };
})();

// gK3: dojedź pod dom i zgaś silnik
const K3 = (() => {
  const g = $("k3G"); bigNum(g, 3);
  const house = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M 690 700 L 750 640 L 810 700 L 800 700 L 800 790 L 700 790 L 700 700 Z", fill: "rgba(150,165,182,0.15)", stroke: FG2, "stroke-width": 5, "stroke-linejoin": "round" }, house);
  L_(g, 380, 800, 830, 800, "rgba(150,165,182,0.45)", 8);
  const car = carIcon(g); car.setAttribute("opacity", 0);
  const off = mkEl("g", { opacity: 0 }, g);
  R_(off, 480, 860, 260, 90, { rx: 14, fill: "rgba(28,10,8,0.85)", stroke: "#ff5a3c", "stroke-width": 5 });
  S_(off, "SILNIK OFF", 610, 925, 46, "#ff5a3c", { "text-anchor": "middle" });
  return { house, car, off };
})();

// gNagar: olej przestaje płynąć i koksuje się w gorącym łożysku turbo
const NG = (() => {
  const g = $("ngG");
  const housing = R_(g, 90, 740, 730, 170, { rx: 22, fill: "rgba(150,165,182,0.1)", stroke: FG2, "stroke-width": 5 });
  R_(g, 90, 805, 730, 40, { fill: "#2a2f36", stroke: FG2, "stroke-width": 3 });
  T_(g, "ŁOŻYSKO TURBINY", 90, 1000, 24, FG2, {});
  R_(g, 90, 690, 730, 34, { rx: 8, fill: "rgba(150,165,182,0.12)" });
  const dep = R_(g, 90, 690, 0, 34, { rx: 8, fill: "#2a1e14", stroke: "#0a0806", "stroke-width": 3 });
  const dots = [];
  for (let i = 0; i < 14; i++) dots.push(C_(g, 0, 707, 9, { fill: O, opacity: 0 }));
  const heat = R_(g, 90, 740, 730, 170, { rx: 22, fill: "rgba(255,70,30,0.35)", opacity: 0 });
  return { housing, dep, dots, heat };
})();

// gK4: jazda na oparach, 40 zł
const K4 = (() => {
  const g = $("k4G"); bigNum(g, 4);
  const gz = gauge(g, 560, 860, 150, [[0, 0.15, HT]]);
  T_(g, "PALIWO", 560, 910, 24, FG2, { "text-anchor": "middle" });
  gz.set(0.03);
  const disp = mkEl("g", { opacity: 0 }, g);
  R_(disp, 680, 620, 160, 100, { rx: 12, fill: "#0d1117", stroke: O, "stroke-width": 5 });
  T_(disp, "40 ZŁ", 760, 690, 46, O, { "text-anchor": "middle" });
  return { gz, disp };
})();

// gTank: pompa chłodzona paliwem, osad na dnie baku
const TK = (() => {
  const g = $("tkG");
  R_(g, 90, 620, 740, 290, { rx: 44, fill: "rgba(150,165,182,0.06)", stroke: FG2, "stroke-width": 6 });
  const fuel = R_(g, 96, 640, 728, 250, { rx: 38, fill: "rgba(245,170,60,0.3)" });
  const pump = mkEl("g", {}, g);
  const pb = R_(pump, 410, 830, 100, 60, { rx: 10, fill: "#2a2f36", stroke: IC, "stroke-width": 6 });
  T_(g, "POMPA", 460, 950, 24, FG2, { "text-anchor": "middle" });
  const debris = [];
  for (let i = 0; i < 26; i++) debris.push(C_(g, 120 + hash(i * 1.7) * 680, 884 + hash(i * 2.3) * 8, 7 + hash(i) * 6, { fill: "#6b4a26", opacity: 0 }));
  return { fuel, pb, debris };
})();

// gK5: kontrolka temperatury
const K5 = (() => {
  const g = $("k5G"); bigNum(g, 5);
  const gz = gauge(g, 560, 880, 150, [[0.7, 1, HT]]);
  T_(g, "TEMPERATURA", 560, 930, 24, FG2, { "text-anchor": "middle" });
  gz.set(0.4);
  const lamp = mkEl("g", { opacity: 0.25 }, g);
  R_(lamp, 740, 610, 34, 120, { rx: 17, fill: "none", stroke: HT, "stroke-width": 7 });
  C_(lamp, 757, 750, 34, { fill: HT });
  return { gz, lamp };
})();

// gQ: czy zepsuty, ile kosztuje nowy
const QQ = (() => {
  const g = $("qqG");
  const a = mkEl("g", { opacity: 0 }, g);
  S_(a, "CZY SILNIK", 90, 680, 96, FG2, {}); S_(a, "JEST ZEPSUTY?", 90, 790, 96, FG2, {});
  const strike = L_(g, 90, 740, 800, 740, "#ff3b2a", 12, { opacity: 0 });
  const b = mkEl("g", { opacity: 0 }, g);
  S_(b, "ILE KOSZTUJE", 90, 960, 96, O, {}); S_(b, "NOWY?", 90, 1070, 96, O, {});
  return { a, strike, b };
})();

// gList: trzy z pięciu, nie jesteś sam
const LS = (() => {
  const g = $("lsG");
  const rows = rowsList(g);
  const cars = [];
  for (let i = 0; i < 7; i++) { const c = carIcon(g, FG2); c.setAttribute("transform", `translate(${150 + i * 105} 1190) scale(0.8)`); c.setAttribute("opacity", 0); cars.push(c); }
  return { rows, cars };
})();

// gFlip: każdy krok da się odwrócić i nie kosztuje nic
const FL = (() => {
  const g = $("flG");
  const rows = rowsList(g);
  const zl = mkT("0 ZŁ", { x: 90, y: 1260, style: "font-size:160px;font-weight:600;fill:#86dba1;letter-spacing:-0.04em", opacity: 0 }, g);
  return { rows, zl };
})();

// gRpm2: 2000 obrotów zamiast czterech
const R2 = (() => {
  const g = $("r2G");
  const gz = gauge(g, 450, 900, 240, [[0, 0.3, OKc], [0.5, 1, HT]]);
  for (let k = 0; k <= 8; k += 2) { const a = Math.PI * (1 + k / 8); T_(g, String(k), 450 + Math.cos(a) * 185, 900 + Math.sin(a) * 185 + 10, 28, FG2, { "text-anchor": "middle" }); }
  T_(g, "OBROTY · TYS.", 450, 950, 24, FG2, { "text-anchor": "middle" });
  gz.set(0.02);
  const ghost = L_(g, 450, 900, 450 + Math.cos(Math.PI * 1.5) * 200, 900 + Math.sin(Math.PI * 1.5) * 200, HT, 8, { "stroke-dasharray": "12 10", opacity: 0 });
  const x = mkEl("path", { d: "M 430 640 L 490 700 M 490 640 L 430 700", stroke: "#ff3b2a", "stroke-width": 14, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  return { gz, ghost, x };
})();

// gLamp: zatrzymanie się, kiedy kontrolka się zapali
const LP = (() => {
  const g = $("lpG");
  const lamp = mkEl("g", { opacity: 0.3 }, g);
  R_(lamp, 230, 620, 50, 200, { rx: 25, fill: "none", stroke: HT, "stroke-width": 10 });
  C_(lamp, 255, 850, 54, { fill: HT });
  const pts = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; pts.push(`${f1(640 + Math.cos(a) * 140)},${f1(740 + Math.sin(a) * 140)}`); }
  const stop = mkEl("g", { opacity: 0 }, g);
  mkEl("polygon", { points: pts.join(" "), fill: "#c4251a", stroke: FG, "stroke-width": 8 }, stop);
  S_(stop, "STOP", 640, 775, 84, FG, { "text-anchor": "middle" });
  return { lamp, stop };
})();

// gBack: lista czytana od końca
const BK = (() => {
  const g = $("bkG");
  const rows = rowsList(g);
  const free = mkEl("g", { opacity: 0 }, g);
  R_(free, 90, 1180, 560, 120, { rx: 14, fill: "rgba(8,22,14,0.85)", stroke: OKc, "stroke-width": 6 });
  S_(free, "ZA DARMO", 370, 1268, 84, OKc, { "text-anchor": "middle" });
  return { rows, free };
})();

const rowTick = (rows, i, k, col) => { const r = rows[i]; r.box.setAttribute("stroke", col); r.ck.setAttribute("stroke", col); r.ck.style.strokeDasharray = 160; r.ck.style.strokeDashoffset = 160 * (1 - k); op(r.ck, k > 0 ? 1 : 0); };
function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gSteps") {
    stepH($("spH"), t, [[3.43, "Pięć <em>kroków</em>"], [4.74, "Każdy wygląda <em>niewinnie</em>"]]);
    SP_.chips.forEach((c, i) => {
      const k = easeOut(win(t, 3.74 + i * 0.2, 4.1 + i * 0.2));
      c.c.setAttribute("opacity", f1(k)); c.c.setAttribute("transform", `translate(0 ${f1((1 - k) * 24)})`);
      const ok = easeOut(win(t, 5.44 + i * 0.1, 5.8 + i * 0.1));
      c.ok.style.strokeDasharray = 160; c.ok.style.strokeDashoffset = 160 * (1 - ok); op(c.ok, ok > 0 ? 1 : 0);
    });
  } else if (id === "gK1") {
    stepH($("k1H"), t, [[11.22, "Krok <em>pierwszy</em>"], [12.14, "Odpal i <em>od razu jedź</em>"], [13.78, "Rano, w zimie, <em>bez czekania</em>"]]);
    op(K1.st, easeOut(win(t, 12.14, 12.5))); op(K1.snow, easeOut(win(t, 14.25, 14.6))); op(K1.clock, easeOut(win(t, 14.79, 15.15)));
  } else if (id === "gK2") {
    stepH($("k2H"), t, [[29.3, "Krok <em>drugi</em>"], [30.18, "Jeźdź na zimnym silniku <em>jak na ciepłym</em>"], [32.57, "Kręć do <em>trzech, czterech</em> tysięcy"]]);
    op(K2.temp, easeOut(win(t, 30.56, 30.9)));
    K2.gz.set(lerp(0.02, 0.45, easeIO(win(t, 32.57, 34.4))), t > 34.0 ? HT : O);
  } else if (id === "gWear") {
    stepH($("wrH"), t, [[35.7, "Mówi się"], [37.01, "Największe <em>zużycie</em>"], [38.45, "W pierwszych <em>minutach</em>"], [40.2, "A nie <em>na trasie</em>"]]);
    op(WR.lab, easeOut(win(t, 35.7, 36.1)));
    const h1 = 380 * easeIO(win(t, 37.01, 39.3)), h2 = 110 * easeIO(win(t, 40.2, 41.0));
    WR.b1.setAttribute("y", f1(1000 - h1)); WR.b1.setAttribute("height", f1(h1));
    WR.b2.setAttribute("y", f1(1000 - h2)); WR.b2.setAttribute("height", f1(h2));
    op(WR.t1, easeOut(win(t, 38.45, 38.8))); op(WR.t2, easeOut(win(t, 40.59, 40.95)));
  } else if (id === "gK3") {
    stepH($("k3H"), t, [[44.14, "Krok <em>trzeci</em>"], [45.06, "Dojedź <em>turbodoładowanym</em> autem pod dom"], [47.81, "Szybko i od razu <em>zgaś silnik</em>"]]);
    op(K3.house, easeOut(win(t, 46.6, 47.0)));
    const k = easeIO(win(t, 45.06, 47.4));
    op(K3.car, easeOut(win(t, 45.06, 45.4)));
    K3.car.setAttribute("transform", `translate(${f1(lerp(440, 640, k))} 800)`);
    op(K3.off, easeOut(win(t, 49.13, 49.5)));
  } else if (id === "gNagar") {
    stepH($("ngH"), t, [[55.13, "Olej <em>przestaje płynąć</em>"], [57.7, "Zostaje <span class=\"hot\">w gorącym</span> łożysku"], [59.06, "Zamienia się <span class=\"hot\">w nagar</span>"]]);
    const flow = 1 - easeIO(win(t, 56.47, 57.3));
    NG.dots.forEach((d, i) => { const p = frac(t * 0.35 + i / 14); d.setAttribute("cx", f1(100 + p * 710)); op(d, flow * Math.sin(p * Math.PI)); });
    const hk = easeIO(win(t, 57.7, 58.7));
    op(NG.heat, hk * 0.9);
    NG.housing.setAttribute("stroke", mixC(FG2, "#ff6a4d", hk));
    NG.dep.setAttribute("width", f1(730 * easeIO(win(t, 59.12, 60.5))));
  } else if (id === "gK4") {
    stepH($("k4H"), t, [[65.94, "Krok <em>czwarty</em>"], [66.86, "Jeźdź <em>na oparach</em>"], [68.22, "Dolewaj"], [69.84, "Bo po co <em>więcej?</em>"]]);
    op(K4.disp, easeOut(win(t, 68.79, 69.15)));
  } else if (id === "gTank") {
    stepH($("tkH"), t, [[70.98, "Mówi się"], [71.69, "Pompa chłodzi się <em>paliwem</em>"], [73.92, "Na dnie <em>zbiera się wszystko</em>"], [77.54, "Kiedy paliwa jest <span class=\"hot\">mało</span>"], [79.12, "Do pompy wpada <span class=\"hot\">właśnie to</span>"]]);
    const low = easeIO(win(t, 77.54, 78.6));
    const h = lerp(250, 40, low);
    TK.fuel.setAttribute("y", f1(890 - h)); TK.fuel.setAttribute("height", f1(h));
    TK.pb.setAttribute("stroke", t < 77.54 ? (t >= 72.49 ? IC : FG2) : mixC(IC, HT, low));
    TK.debris.forEach((d, i) => {
      const a = easeOut(win(t, 74.03 + i * 0.05, 74.5 + i * 0.05));
      const fl = easeIO(win(t, 79.12 + (i % 6) * 0.06, 79.8 + (i % 6) * 0.06));
      const x0 = 120 + hash(i * 1.7) * 680;
      d.setAttribute("cx", f1(lerp(x0, 460, fl * (i % 2 ? 1 : 0.7))));
      d.setAttribute("cy", f1(lerp(886, 860, fl * 0.6)));
      op(d, a);
    });
  } else if (id === "gK5") {
    stepH($("k5H"), t, [[80.9, "Krok <em>piąty</em>"], [81.78, "Kontrolka <em>temperatury</em>"], [83.25, "Zapala się"], [84.57, "I myślisz, że <em>jeszcze dojedziesz</em>"]]);
    K5.gz.set(lerp(0.4, 0.88, easeIO(win(t, 81.78, 83.4))), t > 83.25 ? HT : O);
    op(K5.lamp, 0.25 + 0.75 * easeOut(win(t, 83.25, 83.6)));
  } else if (id === "gQ") {
    stepH($("qqH"), t, [[93.94, "Wtedy"]]);
    op(QQ.a, easeOut(win(t, 94.5, 94.9)));
    QQ.strike.style.strokeDasharray = 720; QQ.strike.style.strokeDashoffset = 720 * (1 - easeIO(win(t, 96.07, 96.6))); op(QQ.strike, t >= 96.07 ? 1 : 0);
    op(QQ.b, easeOut(win(t, 96.82, 97.2)));
  } else if (id === "gList") {
    stepH($("lsH"), t, [[99.02, "<em>Gratulacje</em>"], [99.86, "Robisz <em>trzy z pięciu?</em>"], [102.93, "Nie jesteś <em>sam</em>"]]);
    LS.rows.forEach((r, i) => op(r.r, easeOut(win(t, 99.02 + i * 0.12, 99.4 + i * 0.12))));
    [[0, 100.53], [1, 100.85], [3, 101.11]].forEach(([i, t0]) => rowTick(LS.rows, i, easeOut(win(t, t0, t0 + 0.4)), OKc));
    LS.cars.forEach((c, i) => op(c, easeOut(win(t, 103.08 + i * 0.1, 103.4 + i * 0.1))));
  } else if (id === "gFlip") {
    stepH($("flH"), t, [[115.14, "Teraz <em>najlepsze</em>"], [116.18, "Każdy krok da się <em>odwrócić</em>"], [119.64, "Nie kosztuje <em>ani złotówki</em>"]]);
    FL.rows.forEach((r, i) => {
      op(r.r, easeOut(win(t, 115.14 + i * 0.1, 115.5 + i * 0.1)));
      const k = easeIO(win(t, 117.8 + i * 0.15, 118.4 + i * 0.15));
      r.box.setAttribute("stroke", mixC(HT, OKc, k));
      rowTick(FL.rows, i, k, OKc);
    });
    op(FL.zl, easeOut(win(t, 120.48, 120.9)));
  } else if (id === "gRpm2") {
    stepH($("r2H"), t, [[123.93, "Dwa tysiące <em>obrotów</em>"], [125.17, "Zamiast <span class=\"hot\">czterech</span>"], [126.2, "Na zimnym <em>silniku</em>"]]);
    R2.gz.set(lerp(0.02, 0.25, easeIO(win(t, 123.93, 124.9))), OKc);
    op(R2.ghost, easeOut(win(t, 125.63, 126.0)));
    op(R2.x, easeOut(win(t, 126.0, 126.35)));
  } else if (id === "gLamp") {
    stepH($("lpH"), t, [[131.1, "Zatrzymanie się"], [132.04, "Kiedy <em>kontrolka</em> się zapali"]]);
    op(LP.lamp, 0.3 + 0.7 * easeOut(win(t, 132.77, 133.05)));
    op(LP.stop, easeOut(win(t, 132.95, 133.3)));
  } else if (id === "gBack") {
    stepH($("bkH"), t, [[133.62, "Dobra"], [134.14, "To była <em>instrukcja</em>"], [136.42, "Przeczytaj ją <em>od końca</em>"], [139.81, "Wszystko jest <em>za darmo</em>"]]);
    BK.rows.forEach((r, i) => {
      op(r.r, easeOut(win(t, 133.62 + i * 0.1, 134.0 + i * 0.1)));
      const t0 = 137.9 + (4 - i) * 0.4;
      const k = easeIO(win(t, t0, t0 + 0.4));
      r.box.setAttribute("stroke", mixC(HT, OKc, k));
      rowTick(BK.rows, i, k, OKc);
    });
    op(BK.free, easeOut(win(t, 140.18, 140.6)));
  }
}

/* ================= engagement (tylko błyski hooka; ten film nie ma bębna ani kart) ================= */
function drawEng(t) {
  $("flash").style.opacity = Math.max(0, ...FLASHES.map(([a, dur, amp]) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0))).toFixed(3);
}

/* ================= B-roll: napisy natywne dosłownie ze słów lektora ================= */
const BR_CAP = {
  b03: [[2.23, "Nie robiąc", "<em>Nic złego</em>"]],
  b05: [[6.3, "Żaden krok", "Nie wymaga <em>narzędzi</em>"], [7.96, "Ani", "<em>Wysiłku</em>"], [8.56, "Ani", "<em>Wiedzy</em>"]],
  b12: [[9.5, "Wystarczy", "Że się <em>spieszysz</em>"]],
  b04: [[25.18, "Nikt na to", "Nie <em>patrzy</em>"], [26.44, "Nikt tego", "Nie <em>słyszy</em>"]],
  b08: [[41.25, "Masz z głowy", "<em>Tysiące kilometrów</em>"], [43.13, "W", "<em>Kwadrans</em>"]],
  b06: [[79.9, "Do pompy wpada", "<span class=\"hot\">Właśnie to</span>"]],
  b07: [[86.29, "Jeszcze kilometr", "<em>Jeszcze dwa</em>"]],
  b10: [[97.4, "Ile kosztuje", "<span class=\"hot\">Nowy</span>"]],
  b11: [[108.33, "Nikt nie wie", "Dlaczego <span class=\"hot\">padły</span>"]],
  b02: [[130.14, "Ćwierć", "<em>Baku</em>"]],
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
  if (A.s.bear) bear.setState(bearState(t, deg, name));
  applyCam(t, name, camera, si);
  lightAt(A.base, camera);
  projCam = camera;

  drawTop(t, si);
  $("cnt").style.opacity = 0;
  // hook jak tabliczka ostrzegawcza w instrukcji: tekst pisze się literka po literce, bez błysków i bez wielkiego słowa; w pętli wraca pusta tabliczka
  const hookOn = name === "hook", outroOn = name === "outro";
  show($("hk"), hookOn || outroOn);
  if (hookOn || outroOn) {
    $("hk").style.opacity = hookOn ? 1 : easeOut(win(t, 140.82, 141.22)).toFixed(3);
    hkWords.forEach((w) => {
      if (!w.full) w.full = w.el.textContent;
      const k = hookOn ? clamp01((t - w.t) / 0.42) : 0;
      w.el.textContent = w.full.slice(0, Math.ceil(w.full.length * k));
    });
  }
  $("split").style.opacity = 0; $("pA").style.opacity = 0; $("pB").style.opacity = 0;
  drawTags(t);
  usePassCam(camera);
  composer.render();
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, bear, camera, composer, scene, SHOTS, K, dpf, TURBO_C };
