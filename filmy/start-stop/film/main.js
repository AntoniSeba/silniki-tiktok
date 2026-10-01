// Start-stop to najdroższy gadżet w twoim aucie. Część 10.
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

const W = 1080, H = 1920, D = 162.31996;
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
  [0, 2.43, "3d", "hook"], [2.43, 3.35, "broll", "b02"], [3.35, 4.46, "3d", "h2"], [4.46, 5.64, "broll", "b05"], [5.64, 6.57, "broll", "b03"],
  [6.57, 9.28, "3d", "promise"], [9.28, 12.12, "3d", "promise2"], [12.12, 14.14, "broll", "b04"], [14.14, 18.58, "board", "gSave"], [18.58, 20.48, "3d", "hero"],
  [20.48, 22.2, "broll", "b12"], [22.2, 28.71, "board", "gLight"], [28.71, 32.52, "board", "gChecks"], [32.52, 34.48, "3d", "k1"], [34.48, 36.04, "broll", "b07"],
  [36.04, 38.48, "broll", "b11"], [38.48, 40.08, "3d", "p1"], [40.08, 47.64, "board", "gRolki"], [47.64, 51.49, "board", "gEvery"], [51.49, 53.19, "broll", "b10"],
  [53.19, 54.7, "3d", "p2"], [54.7, 58.82, "3d", "bearing"], [58.82, 63.14, "board", "gStart"], [63.14, 65.6, "3d", "bearing2"], [65.6, 70.03, "board", "gCount"],
  [70.03, 71.96, "3d", "p3"], [71.96, 78.52, "board", "gBatt"], [78.52, 80.12, "broll", "b06"], [80.12, 81.92, "3d", "short"], [81.92, 83.87, "3d", "p4"],
  [83.87, 92.6, "board", "gCurrent"], [92.6, 97.26, "3d", "wear"], [97.26, 102.88, "3d", "p5"], [102.88, 109.08, "board", "gNagar"], [109.08, 112.58, "broll", "b08"],
  [112.58, 116.6, "3d", "honest"], [116.6, 120.84, "board", "gStrong"], [120.84, 124.94, "3d", "cost"], [124.94, 129.02, "board", "gShort"], [129.02, 130.54, "3d", "promised"],
  [130.54, 131.6, "3d", "ans"], [131.6, 138.11, "board", "gTen"], [138.11, 142.52, "3d", "stopShort"], [142.52, 146.79, "board", "gFive"], [146.79, 148.54, "3d", "pickA"],
  [148.54, 151.49, "board", "gOff"], [151.49, 161.48, "3d", "yt"], [161.48, D + 1, "3d", "outro"],
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
  let seed = 20260930;
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
  hook: [[0, P0], [0.6, Pw(-2.45, 0.24, 3550, -250)], [2.43, Pw(-2.1, 0.2, 3350, -230)]],
  h2: [[3.35, Pw(1.15, 0.28, 3300, 60)], [4.46, Pw(1.4, 0.24, 3300, 60)]],
  promise: [[6.57, P(1.15, 0.32, 5600, CX, 200, 0, 32, 60)], [9.28, P(0.7, 0.26, 5600, CX, 200, 0, 32, 60)]],
  promise2: [[9.28, P(-0.8, 0.3, 5000, CX, 200, 0, 32, 80)], [12.12, P(-1.05, 0.24, 5000, CX, 200, 0, 32, 80)]],
  hero: [[18.58, Pw(-2.95, 0.1, 3100)], [20.48, Pw(-2.65, 0.15, 3100)]],
  k1: [[32.52, P(SIN + 0.3, 0.3, 3000, -20, 150, 0, 32, 20)], [34.48, P(SIN + 0.1, 0.26, 3000, -20, 150, 0, 32, 20)]],
  p1: [[38.48, Pw(-0.6, 0.3, 3300)], [40.08, Pw(-0.4, 0.26, 3300)]],
  p2: [[53.19, Pw(2.0, 0.22, 3300)], [54.7, Pw(1.8, 0.2, 3300)]],
  bearing: [[54.7, PB(SIN + 0.1, 0.05, 2000, 0, -30, 0, 32, 170)], [58.82, PB(SIN - 0.06, 0.03, 2000, 0, -30, 0, 32, 170)]],
  bearing2: [[63.14, PB(SIN - 0.1, 0.04, 2000, 0, -30, 0, 32, 170)], [65.6, PB(SIN - 0.2, 0.03, 2000, 0, -30, 0, 32, 170)]],
  p3: [[70.03, Pw(0.5, 0.26, 3300)], [71.96, Pw(0.75, 0.2, 3300)]],
  short: [[80.12, Pw(-1.2, 0.24, 3300)], [81.92, Pw(-1.0, 0.2, 3300)]],
  p4: [[81.92, P(0.35, 0.2, 2200, 170, 100, 0, 32, 60)], [83.87, P(0.15, 0.18, 2200, 170, 100, 0, 32, 60)]],
  wear: [[92.6, P(0.6, 0.22, 2500, 120, 100, 0, 32, 60)], [97.26, P(0.2, 0.2, 2500, 120, 100, 0, 32, 60)]],
  p5: [[97.26, P(EXH - 0.5, 0.26, 2500, -20, 150, -110, 32, 60)], [102.88, P(EXH - 0.2, 0.2, 2500, -20, 150, -110, 32, 60)]],
  honest: [[112.58, Pw(1.95, 0.18, 3300)], [116.6, Pw(1.5, 0.24, 3300)]],
  cost: [[120.84, Pw(-2.7, 0.22, 3300)], [124.94, Pw(-2.1, 0.26, 3300)]],
  promised: [[129.02, Pw(0.95, 0.3, 3700)], [130.54, Pw(0.78, 0.26, 3700)]],
  ans: [[130.54, Pw(-0.6, 0.14, 3300, 80)], [131.6, Pw(-0.4, 0.11, 3300, 80)]],
  stopShort: [[138.11, Pw(2.3, 0.2, 3300)], [142.52, Pw(1.9, 0.24, 3300)]],
  pickA: [[146.79, Pw(0.9, 0.22, 3500, 300)], [148.54, Pw(0.72, 0.2, 3500, 300)]],
  yt: [[151.49, P(1.3, 0.26, 6700, CX, 230, 0, 32, 330)], [161.48, P(-0.4, 0.3, 6700, CX, 230, 0, 32, 330)]],
  outro: [[161.48, Pw(-2.95, 0.34, 4300, -290)], [D, P0], [D + 1, Pw(-2.45, 0.24, 3550, -250)]],
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
const HOOK_END = 6.4;
const BEATS = [1.02];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const FLASHES = [[1.02, 0.14, 0.5], [3.61, 0.16, 0.5], [4.84, 0.18, 0.45]];
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
    case "hook": s.ex = 0.9 * Math.pow(1 - clamp01(t / 0.55), 2); s.fire = 1; s.fireHard = 1; s.pow = 1; s.gTurbo = 0.7 * easeOut(win(t, 1.02, 1.3)); break;
    case "outro": s.ex = 0.9 * Math.pow(win(t, 161.48, D), 2); s.fire = 1; s.fireHard = t >= 161.9 ? 1 : 0; s.pow = t >= 161.9 ? 1 : 0; break;
    case "h2": s.fire = 1; s.fireHard = t < HOOK_END ? 1 : 0; break;
    case "promise": s.ex = 0.75 * easeOut(win(t, 6.57, 6.93)); break;
    case "promise2": s.ex = 0.75 * (1 - easeIO(win(t, 9.28, 11.98))); break;
    case "hero": s.fire = 1; break;
    case "k1": s.section = 1; s.noInd = 1; s.fire = 1; break;
    case "p1": s.fire = 1; break;
    case "p2": s.fire = 1; break;
    case "bearing": s.bear = 1; base = BP; break;
    case "bearing2": s.bear = 1; base = BP; break;
    case "p3": s.fire = 1; break;
    case "short": s.fire = 1; break;
    case "p4": s.fire = 1; s.gFly = 0.9 * easeOut(win(t, 82.85, 83.4)); break;
    case "wear": s.fire = 1; s.gFly = 0.6 + 0.3 * easeIO(win(t, 94.72, 96.0)); break;
    case "p5": s.fire = t < 101.71 ? 1 : 0; s.gExh = 0.9 * easeOut(win(t, 98.84, 99.8)); break;
    case "honest": s.fire = 1; break;
    case "cost": s.fire = 1; break;
    case "promised": break;
    case "ans": s.fire = 1; break;
    case "stopShort": s.fire = 1; break;
    case "pickA": s.fire = 1; break;
    case "yt": s.ex = easeIO(win(t, 151.9, 159.6)); break;
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
  if (name === "bearing2") {
    const k = easeIO(win(t, 63.14, 64.4));
    return { ang: -(63.14 * CRANK_RATE) * D2R * 0.5, e: lerp(0.09, CLEAR * 0.985, k), fill: lerp(1, 0.08, k), glow: 0, oilGlow: 0 };
  }
  return { ang: -deg * D2R * 0.5, e: 0.09, fill: 1, glow: 0, oilGlow: 0 };
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
  { t0: 82.85, t1: 83.87, text: "Tu zazębia się rozrusznik", a: () => FLY_C, off: [-150, -300], c: "oil" },
  { t0: 98.16, t1: 102.88, text: "Turbina", a: () => TURBO_C, off: [-170, -300], c: "hot" },
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
  [3.35, "Start-stop", "Nie powstał <em>po to</em>"],
  [9.28, "Żeby", "Silnik <em>oszczędzał</em>"],
  [18.58, "Więc czemu", "Tyle osób <em>wyłącza go</em>"],
  [32.52, "Nie każdy postój", "Się <em>kwalifikuje</em>"],
  [38.48, "Powód 1", "<em>Test</em>"],
  [53.19, "Powód 2", "<em>Panewki</em>"],
  [54.7, "Mówiłem już", "Klin olejowy <em>powstaje</em>"],
  [57.3, "Kiedy wał", "Się <em>kręci</em>"],
  [63.14, "Przez moment", "Metal <span class=\"hot\">dotyka metalu</span>"],
  [70.03, "Powód 3", "<em>Akumulator</em>"],
  [80.12, "I to ty", "Go <em>wymieniasz</em>"],
  [81.92, "Powód 4", "<em>Rozrusznik</em>"],
  [92.6, "Jest wzmocniony", "Ale to nadal <em>część</em>"],
  [94.72, "Która", "Zużywa się <span class=\"hot\">z każdym odpaleniem</span>"],
  [97.26, "Powód 5", "<em>Turbo</em>"],
  [98.84, "Jedziesz", "Turbina <span class=\"hot\">rozgrzana</span>"],
  [101.71, "A silnik", "<span class=\"hot\">Staje</span>"],
  [112.58, "Uczciwie?", "Przy <em>długim postoju</em>"],
  [114.44, "W korku", "Oszczędza <span class=\"ok\">realne paliwo</span>"],
  [120.84, "Wzmocnienie", "Jest <em>kosztem</em>"],
  [123.43, "I tak siedzi", "W <em>cenie auta</em>"],
  [138.11, "Każdy krótszy postój", "To <span class=\"hot\">zużyty rozrusznik</span>"],
  [140.76, "I", "Zero <span class=\"hot\">oszczędności</span>"],
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

// gSave: kolejka aut i wskaźnik paliwa
const SV = (() => {
  const g = $("svG");
  const cars = [];
  for (let i = 0; i < 5; i++) { const c = carIcon(g, FG2); c.setAttribute("transform", `translate(${180 + i * 140} 730)`); c.setAttribute("opacity", 0); cars.push(c); }
  L_(g, 90, 745, 830, 745, "rgba(150,165,182,0.45)", 8);
  const lab = T_(g, "KOREK", 90, 640, 26, FG2, { opacity: 0 });
  const cx = 300, cy = 1040, r = 190;
  const pt = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const arc = (a0, a1, rr) => { const p0 = pt(a0, rr), p1 = pt(a1, rr); return `M ${f1(p0[0])} ${f1(p0[1])} A ${rr} ${rr} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`; };
  mkEl("path", { d: arc(Math.PI, 2 * Math.PI, r), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 26, "stroke-linecap": "round" }, g);
  mkEl("path", { d: arc(Math.PI * 1.4, Math.PI * 1.7, r), fill: "none", stroke: OKc, "stroke-width": 26 }, g);
  T_(g, "ZUŻYCIE PALIWA", cx, cy + 60, 24, FG2, { "text-anchor": "middle" });
  const needle = L_(g, cx, cy, cx + 100, cy - 120, O, 10);
  C_(g, cx, cy, 18, { fill: O });
  return { cars, lab, needle, cx, cy };
})();

// gLight: światła, pedał hamulca i silnik gaśnie i odpala
const LG = (() => {
  const g = $("lgG");
  const tl = trafficLight(g, 130, 560);
  const eng = mkEl("g", {}, g);
  const box = R_(eng, 420, 640, 380, 180, { rx: 22, fill: "rgba(150,165,182,0.1)", stroke: FG2, "stroke-width": 5 });
  S_(eng, "SILNIK", 610, 746, 62, FG, { "text-anchor": "middle" });
  const pill = R_(eng, 650, 590, 150, 56, { rx: 10, fill: OKc });
  const pillT = S_(eng, "ON", 725, 634, 40, "#0c1a10", { "text-anchor": "middle" });
  const pedal = mkEl("g", {}, g);
  R_(pedal, 130, 930, 190, 64, { rx: 10, fill: "#2a2f36", stroke: FG2, "stroke-width": 4 });
  T_(g, "HAMULEC", 130, 1040, 24, FG2, {});
  return { tl, box, pill, pillT, pedal };
})();

// gChecks: co sprawdza system przed wyłączeniem
const CK = (() => {
  const g = $("ckG");
  const rows = ["AKUMULATOR", "TEMPERATURA", "OBCIĄŻENIE"].map((nm, i) => {
    const y = 600 + i * 130, r = mkEl("g", { opacity: 0 }, g);
    R_(r, 90, y, 720, 100, { rx: 14, fill: "rgba(20,26,34,0.95)", stroke: FG2, "stroke-width": 3 });
    S_(r, nm, 130, y + 70, 56, FG, {});
    const ck = checkPath(g, 690, y + 52);
    return { r, ck };
  });
  return { rows };
})();

// gRolki: auto na rolkach i przebieg testu z postojami
const RL = (() => {
  const g = $("rlG");
  const car = carIcon(g); car.setAttribute("transform", "translate(330 700) scale(1.9)");
  const rollers = [C_(g, 262, 790, 44, { fill: "#161b22", stroke: FG2, "stroke-width": 5 }), C_(g, 398, 790, 44, { fill: "#161b22", stroke: FG2, "stroke-width": 5 })];
  const spokes = rollers.map((c) => L_(g, 0, 0, 0, 0, FG2, 5));
  const v = [0, 0.6, 0.6, 0, 0, 0.75, 0.75, 0, 0, 0.5, 0.5, 0, 0, 0.8, 0.8, 0];
  const px = (i) => 90 + (i * 720) / (v.length - 1), py = (k) => 1000 - k * 130;
  const stops = [];
  for (let i = 0; i < v.length - 1; i++) if (v[i] === 0 && v[i + 1] === 0) stops.push(R_(g, px(i), 870, px(i + 1) - px(i), 130, { fill: "rgba(134,219,161,0.0)" }));
  let d = "";
  v.forEach((k, i) => { d += (i ? " L " : "M ") + f1(px(i)) + " " + f1(py(k)); });
  const prof = mkEl("path", { d, fill: "none", stroke: O, "stroke-width": 6, "stroke-linejoin": "round", opacity: 0 }, g);
  T_(g, "PRZEBIEG TESTU", 90, 862, 24, FG2, {});
  const off = [];
  stops.forEach((s) => { const x = +s.getAttribute("x") + +s.getAttribute("width") / 2; off.push(T_(g, "OFF", x, 960, 26, OKc, { "text-anchor": "middle", opacity: 0 })); });
  T_(g, "WYNIK NA PAPIERZE", 90, 1090, 24, FG2, {});
  R_(g, 90, 1104, 720, 44, { rx: 6, fill: "rgba(150,165,182,0.15)" });
  const res = R_(g, 90, 1104, 720, 44, { rx: 6, fill: HT });
  return { rollers, spokes, prof, stops, off, res };
})();

// gEvery: prawie każde auto ma start-stop
const EV = (() => {
  const g = $("evG");
  const cars = [];
  for (let i = 0; i < 12; i++) {
    const x = 170 + (i % 4) * 190, y = 650 + Math.floor(i / 4) * 150;
    const c = mkEl("g", { opacity: 0 }, g);
    const ci = carIcon(c, FG2); ci.setAttribute("transform", `translate(${x} ${y})`);
    C_(c, x + 46, y - 62, 22, { fill: "#0c2a16", stroke: OKc, "stroke-width": 4 });
    T_(c, "A", x + 46, y - 53, 26, OKc, { "text-anchor": "middle" });
    cars.push(c);
  }
  return { cars };
})();

// gStart: wał stoi, ciśnienie oleju dopiero rośnie
const ST = (() => {
  const g = $("stG");
  C_(g, 260, 800, 150, { fill: "rgba(150,165,182,0.06)", stroke: FG2, "stroke-width": 6 });
  C_(g, 260, 842, 104, { fill: "#2a2f36", stroke: O, "stroke-width": 6 });
  T_(g, "PANEWKA", 260, 1010, 24, FG2, { "text-anchor": "middle" });
  const contact = C_(g, 260, 946, 22, { fill: "#ff3b2a", opacity: 0 });
  T_(g, "CIŚNIENIE OLEJU", 560, 580, 24, FG2, {});
  R_(g, 600, 620, 70, 380, { rx: 10, fill: "rgba(150,165,182,0.15)" });
  const bar = R_(g, 600, 1000, 70, 0, { rx: 10, fill: O });
  return { contact, bar };
})();

// gCount: odpalenia w ciągu dnia
const CT = (() => {
  const g = $("ctG");
  T_(g, "BEZ START-STOP", 90, 660, 24, FG2, {});
  L_(g, 90, 740, 810, 740, "rgba(150,165,182,0.45)", 6);
  const one = L_(g, 450, 700, 450, 740, O, 10, { opacity: 0 });
  T_(g, "ZE START-STOP", 90, 860, 24, FG2, {});
  L_(g, 90, 940, 810, 940, "rgba(150,165,182,0.45)", 6);
  const ticks = [];
  for (let i = 0; i < 36; i++) ticks.push(L_(g, 100 + i * 20, 900, 100 + i * 20, 940, HT, 7, { opacity: 0 }));
  return { one, ticks };
})();

// gBatt: zwykły akumulator kontra AGM/EFB
const BT = (() => {
  const g = $("btG");
  const bat = (x, col) => {
    const b = mkEl("g", {}, g);
    R_(b, x, 660, 280, 190, { rx: 16, fill: "rgba(20,26,34,0.95)", stroke: col, "stroke-width": 6 });
    R_(b, x + 40, 630, 50, 30, { rx: 6, fill: col }); R_(b, x + 190, 630, 50, 30, { rx: 6, fill: col });
    return b;
  };
  bat(90, FG2);
  const fillL = R_(g, 106, 676, 248, 158, { rx: 8, fill: OKc });
  const xL = mkEl("path", { d: "M 160 690 L 290 820 M 290 690 L 160 820", stroke: "#ff3b2a", "stroke-width": 16, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  S_(g, "ZWYKŁY", 230, 920, 52, FG2, { "text-anchor": "middle" });
  const right = mkEl("g", { opacity: 0 }, g);
  const br = bat(490, OKc); right.appendChild(br);
  R_(right, 506, 676, 248, 158, { rx: 8, fill: OKc });
  const ckR = checkPath(right, 580, 770); ckR.setAttribute("opacity", 1); ckR.setAttribute("stroke", "#0c1a10");
  S_(right, "DROŻSZY", 630, 920, 52, OKc, { "text-anchor": "middle" });
  T_(right, "AGM · EFB", 630, 980, 26, FG2, { "text-anchor": "middle" });
  return { fillL, xL, right };
})();

// gCurrent: prąd z akumulatora do rozrusznika i z alternatora z powrotem
const CU = (() => {
  const g = $("cuG");
  const node = (x, y, w, h, nm) => { R_(g, x, y, w, h, { rx: 16, fill: "rgba(20,26,34,0.95)", stroke: FG2, "stroke-width": 4 }); S_(g, nm, x + w / 2, y + h / 2 + 18, 38, FG, { "text-anchor": "middle" }); };
  node(90, 720, 250, 130, "AKUMULATOR");
  node(540, 600, 280, 110, "ROZRUSZNIK");
  node(540, 860, 280, 110, "ALTERNATOR");
  const a1 = mkEl("path", { d: "M 340 750 L 440 750 L 440 655 L 530 655", fill: "none", stroke: HT, "stroke-width": 18, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
  const a2 = mkEl("path", { d: "M 540 915 L 440 915 L 440 820 L 350 820", fill: "none", stroke: OKc, "stroke-width": 12, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
  const ticks = [];
  for (let i = 0; i < 8; i++) ticks.push(R_(g, 560 + i * 32, 560, 18, 28, { rx: 4, fill: O, opacity: 0 }));
  return { a1, a2, ticks, L1: 0, L2: 0 };
})();

// gNagar: olej zostaje w gorącym łożysku turbo i zamienia się w nagar
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

// gStrong: co wzmacniają producenci
const SG = (() => {
  const g = $("sgG");
  const rows = ["ROZRUSZNIK", "AKUMULATOR", "PANEWKI"].map((nm, i) => {
    const y = 600 + i * 130, r = mkEl("g", { opacity: 0 }, g);
    R_(r, 90, y, 720, 100, { rx: 14, fill: "rgba(20,26,34,0.95)", stroke: OKc, "stroke-width": 3 });
    mkEl("path", { d: `M 120 ${y + 18} L 170 ${y + 18} L 170 ${y + 55} Q 145 ${y + 86} 120 ${y + 55} Z`, fill: "rgba(134,219,161,0.25)", stroke: OKc, "stroke-width": 4 }, r);
    S_(r, nm, 200, y + 70, 56, FG, {});
    return r;
  });
  const often = mkEl("g", { opacity: 0 }, g);
  R_(often, 580, 872, 200, 56, { rx: 10, fill: O });
  S_(often, "CZĘSTO", 680, 914, 38, "#1a1206", { "text-anchor": "middle" });
  return { rows, often };
})();

// gShort: długi korek kontra krótkie światła
const SH = (() => {
  const g = $("shG");
  const a = mkEl("g", { opacity: 0 }, g);
  S_(a, "DŁUGI KOREK", 90, 640, 52, FG, {});
  R_(a, 90, 670, 720, 60, { rx: 10, fill: "rgba(150,165,182,0.12)" });
  const barA = R_(a, 90, 670, 0, 60, { rx: 10, fill: OKc });
  const b = mkEl("g", { opacity: 0 }, g);
  S_(b, "KRÓTKIE ŚWIATŁA", 90, 860, 52, FG, {});
  R_(b, 90, 890, 720, 60, { rx: 10, fill: "rgba(150,165,182,0.12)" });
  const barB = R_(b, 90, 890, 0, 60, { rx: 10, fill: HT });
  const x = mkEl("path", { d: "M 250 880 L 330 960 M 330 880 L 250 960", stroke: "#ff3b2a", "stroke-width": 14, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  return { a, barA, b, barB, x };
})();

// gTen: paliwo na postoju kontra koszt ponownego odpalenia
const TN = (() => {
  const g = $("tnG");
  const X = (s) => 90 + (720 * s) / 20;
  const ax = mkEl("g", { opacity: 0 }, g);
  L_(ax, 90, 900, 810, 900, FG2, 5);
  for (let s = 0; s <= 20; s += 5) { L_(ax, X(s), 900, X(s), 916, FG2, 4); T_(ax, String(s), X(s), 948, 24, s === 10 ? O : FG2, { "text-anchor": "middle" }); }
  T_(ax, "POSTÓJ · SEKUNDY", 810, 985, 22, FG2, { "text-anchor": "end" });
  const idle = L_(g, X(0), 900, X(20), 700, HT, 8, { opacity: 0 });
  const rst = L_(g, X(0), 800, X(20), 800, IC, 8, { "stroke-dasharray": "16 12", opacity: 0 });
  const zone = R_(g, X(10), 640, X(20) - X(10), 260, { fill: "rgba(134,219,161,0.12)", opacity: 0 });
  const cross = mkEl("g", { opacity: 0 }, g);
  L_(cross, X(10), 800, X(10), 900, O, 4, { "stroke-dasharray": "8 8" });
  C_(cross, X(10), 800, 14, { fill: O });
  const l1 = T_(g, "PALIWO NA POSTOJU", 90, 1040, 24, HT, { opacity: 0 });
  const l2 = T_(g, "KOSZT ODPALENIA", 450, 1040, 24, IC, { opacity: 0 });
  return { X, ax, idle, rst, zone, cross, l1, l2 };
})();

// gFive: pięć sekund to za mało
const FV = (() => {
  const g = $("fvG");
  const tl = trafficLight(g, 130, 560); setLight(tl, "r");
  T_(g, "POSTÓJ", 330, 620, 24, FG2, {});
  R_(g, 330, 640, 480, 60, { rx: 10, fill: "rgba(150,165,182,0.12)" });
  const fill = R_(g, 330, 640, 0, 60, { rx: 10, fill: HT });
  L_(g, 570, 630, 570, 710, O, 4, { "stroke-dasharray": "8 8" });
  const late = S_(g, "ZA KRÓTKO", 330, 800, 64, HT, { opacity: 0 });
  const x = mkEl("path", { d: "M 330 830 L 400 900 M 400 830 L 330 900", stroke: "#ff3b2a", "stroke-width": 14, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  return { fill, late, x };
})();

// gOff: przycisk start-stop
const OF = (() => {
  const g = $("ofG");
  R_(g, 210, 600, 300, 300, { rx: 50, fill: "rgba(20,26,34,0.95)", stroke: FG2, "stroke-width": 6 });
  C_(g, 360, 750, 84, { fill: "none", stroke: O, "stroke-width": 10 });
  mkEl("path", { d: "M 430 690 L 446 730 L 404 722", fill: "none", stroke: O, "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  S_(g, "A", 360, 782, 100, O, { "text-anchor": "middle" });
  const slash = L_(g, 250, 640, 470, 860, "#ff3b2a", 16, { opacity: 0 });
  T_(g, "START-STOP", 360, 960, 26, FG2, { "text-anchor": "middle" });
  return { slash };
})();

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gSave") {
    stepH($("svH"), t, [[14.14, "<em>Oszczędza</em>"], [15.06, "Mówi się"], [15.87, "W <em>korku</em>"], [16.78, "Kilka procent <em>mniej paliwa</em>"]]);
    op(SV.lab, easeOut(win(t, 15.87, 16.2)));
    SV.cars.forEach((c, i) => op(c, easeOut(win(t, 15.87 + i * 0.1, 16.2 + i * 0.1))));
    const a = lerp(1.55, 1.42, easeIO(win(t, 16.78, 18.0))) * Math.PI;
    SV.needle.setAttribute("x2", f1(SV.cx + Math.cos(a) * 150)); SV.needle.setAttribute("y2", f1(SV.cy + Math.sin(a) * 150));
  } else if (id === "gLight") {
    stepH($("lgH"), t, [[22.2, "Start-stop to <em>komputer</em>"], [24.4, "Na światłach <em>gasi silnik</em>"], [26.16, "Puszczasz <em>hamulec</em>"], [27.46, "Odpala <em>znowu</em>"]]);
    const red = t >= 24.4 && t < 26.6;
    setLight(LG.tl, red ? "r" : "g");
    const press = easeIO(win(t, 24.4, 24.7)) * (1 - easeIO(win(t, 26.16, 26.5)));
    LG.pedal.setAttribute("transform", `translate(0 ${f1(10 * press)})`);
    const off = t >= 25.21 && t < 27.46;
    LG.pill.setAttribute("fill", off ? HT : OKc);
    LG.pillT.textContent = off ? "OFF" : "ON";
    LG.box.setAttribute("stroke", off ? HT : FG2);
  } else if (id === "gChecks") {
    stepH($("ckH"), t, [[28.71, "Przedtem <em>sprawdza</em>"]]);
    [29.77, 30.61, 31.39].forEach((t0, i) => {
      op(CK.rows[i].r, easeOut(win(t, t0, t0 + 0.3)));
      const ck = CK.rows[i].ck;
      ck.style.strokeDasharray = 160; ck.style.strokeDashoffset = 160 * (1 - easeOut(win(t, t0 + 0.25, t0 + 0.65)));
      op(ck, t >= t0 + 0.25 ? 1 : 0);
    });
  } else if (id === "gRolki") {
    stepH($("rlH"), t, [[40.08, "Norma emisji <em>mierzy</em>"], [40.9, "Auto <em>na rolkach</em>"], [42.47, "Dużo <em>postoju</em>"], [44.24, "Silnik <span class=\"ok\">wyłączony</span>"], [45.75, "Poprawia wynik <em>na papierze</em>"]]);
    RL.rollers.forEach((c, i) => {
      const a = t * 4 + i;
      const cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy");
      RL.spokes[i].setAttribute("x1", cx); RL.spokes[i].setAttribute("y1", cy);
      RL.spokes[i].setAttribute("x2", f1(cx + Math.cos(a) * 34)); RL.spokes[i].setAttribute("y2", f1(cy + Math.sin(a) * 34));
    });
    op(RL.prof, easeOut(win(t, 40.9, 41.4)));
    RL.prof.style.strokeDasharray = 1500; RL.prof.style.strokeDashoffset = 1500 * (1 - easeIO(win(t, 40.9, 43.0)));
    RL.stops.forEach((s) => s.setAttribute("fill", `rgba(${t >= 44.24 ? "134,219,161" : "124,196,255"},${f1(0.18 * easeOut(win(t, 42.47, 43.0)))})`));
    RL.off.forEach((o, i) => op(o, easeOut(win(t, 44.24 + i * 0.12, 44.6 + i * 0.12))));
    const k = easeIO(win(t, 45.75, 46.9));
    RL.res.setAttribute("width", f1(720 * lerp(1, 0.62, k)));
    RL.res.setAttribute("fill", mixC(HT, OKc, k));
  } else if (id === "gEvery") {
    stepH($("evH"), t, [[47.64, "Trafił do <em>prawie każdego</em> auta"], [50.54, "Nie <span class=\"hot\">dlatego, że</span>"]]);
    EV.cars.forEach((c, i) => { const k = easeOut(win(t, 47.8 + i * 0.12, 48.2 + i * 0.12)); c.setAttribute("opacity", f1(k)); c.setAttribute("transform", `translate(0 ${f1((1 - k) * 18)})`); });
  } else if (id === "gStart") {
    stepH($("stH"), t, [[58.82, "W chwili <em>odpalenia</em>"], [59.97, "Wał <span class=\"hot\">stoi</span>"], [60.64, "Ciśnienie oleju <em>dopiero rośnie</em>"]]);
    op(ST.contact, easeOut(win(t, 59.97, 60.4)));
    ST.bar.setAttribute("y", f1(1000 - 380 * 0.45 * easeIO(win(t, 60.64, 63.0))));
    ST.bar.setAttribute("height", f1(380 * 0.45 * easeIO(win(t, 60.64, 63.0))));
  } else if (id === "gCount") {
    stepH($("ctH"), t, [[65.6, "Start-stop robi to"], [66.6, "<em>Kilkadziesiąt</em> razy w mieście"], [68.36, "Zamiast raz <em>dziennie</em>"]]);
    CT.ticks.forEach((l, i) => op(l, easeOut(win(t, 66.6 + i * 0.04, 66.75 + i * 0.04))));
    op(CT.one, easeOut(win(t, 68.36, 68.7)));
  } else if (id === "gBatt") {
    stepH($("btH"), t, [[71.96, "Zwykły <span class=\"hot\">nie wytrzyma</span>"], [74.14, "Dostaje <em>droższy</em>"], [76.62, "Typ <em>AGM albo EFB</em>"]]);
    const dr = easeIO(win(t, 72.59, 73.58));
    BT.fillL.setAttribute("width", f1(248 * (1 - dr))); BT.fillL.setAttribute("fill", mixC(OKc, HT, dr));
    op(BT.xL, easeOut(win(t, 73.4, 73.8)));
    const rk = easeOut(win(t, 74.54, 75.0));
    BT.right.setAttribute("opacity", f1(rk)); BT.right.setAttribute("transform", `translate(${f1((1 - rk) * 40)} 0)`);
  } else if (id === "gCurrent") {
    stepH($("cuH"), t, [[83.87, "Kręci <em>wielokrotnie częściej</em>"], [86.68, "Pobiera <em>duży prąd</em>"], [90.29, "Oddaje <em>alternator</em>"]]);
    if (!CU.L1) { CU.L1 = CU.a1.getTotalLength(); CU.L2 = CU.a2.getTotalLength(); }
    CU.ticks.forEach((r, i) => op(r, easeOut(win(t, 83.9 + i * 0.12, 84.2 + i * 0.12))));
    CU.a1.style.strokeDasharray = CU.L1; CU.a1.style.strokeDashoffset = CU.L1 * (1 - easeIO(win(t, 87.5, 89.3)));
    CU.a2.style.strokeDasharray = CU.L2; CU.a2.style.strokeDashoffset = CU.L2 * (1 - easeIO(win(t, 90.6, 92.1)));
    op(CU.a1, t >= 87.5 ? 1 : 0); op(CU.a2, t >= 90.6 ? 1 : 0);
  } else if (id === "gNagar") {
    stepH($("ngH"), t, [[102.88, "Olej przestaje ją <em>chłodzić</em>"], [104.46, "Zostaje <span class=\"hot\">w gorącym</span> łożysku"], [106.4, "Zamienia się <span class=\"hot\">w nagar</span>"]]);
    const flow = 1 - easeIO(win(t, 103.9, 104.5));
    NG.dots.forEach((d, i) => {
      const p = frac(t * 0.35 + i / 14);
      d.setAttribute("cx", f1(100 + p * 710));
      op(d, (t >= 102.88 ? 1 : 0) * flow * Math.sin(p * Math.PI) + (t < 102.88 ? Math.sin(p * Math.PI) : 0));
    });
    const hk = easeIO(win(t, 104.46, 105.4));
    op(NG.heat, hk * 0.9);
    NG.housing.setAttribute("stroke", mixC(FG2, "#ff6a4d", hk));
    NG.dep.setAttribute("width", f1(730 * easeIO(win(t, 106.4, 108.3))));
  } else if (id === "gStrong") {
    stepH($("sgH"), t, [[116.6, "Producenci <em>wzmacniają</em>"]]);
    [117.19, 118.64, 119.49].forEach((t0, i) => op(SG.rows[i], easeOut(win(t, t0, t0 + 0.3))));
    op(SG.often, easeOut(win(t, 119.49, 119.85)));
  } else if (id === "gShort") {
    stepH($("shH"), t, [[124.94, "A jeśli stoisz <em>na krótkich światłach</em>"], [127.25, "Wyłączenie <span class=\"hot\">nie daje nic</span>"]]);
    op(SH.a, easeOut(win(t, 124.94, 125.3)));
    SH.barA.setAttribute("width", f1(720 * easeIO(win(t, 125.0, 126.6))));
    op(SH.b, easeOut(win(t, 125.35, 125.75)));
    SH.barB.setAttribute("width", f1(110 * easeIO(win(t, 125.91, 126.5))));
    op(SH.x, easeOut(win(t, 128.17, 128.5)));
  } else if (id === "gTen") {
    stepH($("tnH"), t, [[131.6, "Tyle <em>postoju</em>"], [132.96, "Żeby wyłączony silnik <em>spalił mniej</em>"], [135.76, "Niż kosztuje <em>ponowne odpalenie</em>"]]);
    op(TN.ax, easeOut(win(t, 131.6, 131.95)));
    TN.idle.style.strokeDasharray = 800; TN.idle.style.strokeDashoffset = 800 * (1 - easeIO(win(t, 132.1, 134.6)));
    op(TN.idle, t >= 132.1 ? 1 : 0);
    op(TN.l1, easeOut(win(t, 133.25, 133.6)));
    op(TN.rst, easeOut(win(t, 135.76, 136.2)));
    op(TN.l2, easeOut(win(t, 135.95, 136.3)));
    op(TN.cross, easeOut(win(t, 137.21, 137.6)));
    op(TN.zone, easeOut(win(t, 137.3, 137.9)));
  } else if (id === "gFive") {
    stepH($("fvH"), t, [[142.52, "Nie jest <em>głupi</em>"], [144.24, "Jest głupi, gdy stoisz <span class=\"hot\">5 sekund</span>"]]);
    FV.fill.setAttribute("width", f1(240 * easeIO(win(t, 144.24, 145.98))));
    op(FV.late, easeOut(win(t, 145.98, 146.3)));
    op(FV.x, easeOut(win(t, 146.2, 146.5)));
  } else if (id === "gOff") {
    stepH($("ofH"), t, [[148.54, "Albo <em>wyłączony</em>"]]);
    op(OF.slash, easeOut(win(t, 148.75, 149.1)));
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Test", "Panewki", "Akumulator", "Rozrusznik", "Turbo"];
const RN = RW.length, RROW = 50, ANS = "10 sekund", T_ANS = 130.54;
const BURSTS = [[6.85, 7.85, 2 * RN], [38.6, 39.3, 2 * RN], [53.3, 54.0, 2 * RN], [70.1, 70.8, 2 * RN], [82.0, 82.7, 2 * RN], [97.35, 98.05, 2 * RN], [112.65, 113.35, 2 * RN], [129.6, 129.95, 2 * RN], [129.98, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  $("flash").style.opacity = Math.max(0, ...FLASHES.map(([a, dur, amp]) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0))).toFixed(3);
  const rb = $("reelBar");
  const rOn = inR(t, 6.57, 132.2);
  rb.style.opacity = rOn ? (easeOut(win(t, 6.57, 6.87)) * (1 - easeIO(win(t, 131.8, 132.2)))).toFixed(3) : 0;
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
      easeOut(win(t, 6.57, 6.97)) * (1 - easeIO(win(t, 8.3, 8.8))),
      easeIO(win(t, 129.02, 129.4)) * (1 - easeIO(win(t, 131.1, 131.6))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 138.3, 142.0);
  sc.style.opacity = sOn ? (easeOut(win(t, 138.3, 138.7)) * (1 - easeIO(win(t, 141.6, 142.0)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 138.3, 138.8))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 146.79, 151.4);
  pc.style.opacity = pOn ? (easeOut(win(t, 146.79, 147.17)) * (1 - easeIO(win(t, 151.0, 151.4)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 146.79, 147.17))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 147.98 ? (t < 148.75 ? easeOut(win(t, 147.98, 148.18)) : 0.5) : 0;
    const gB = t > 148.75 ? easeOut(win(t, 148.75, 148.95)) : 0;
    on("pkA", Math.max(gA, t > 149.64 ? 0.5 + 0.5 * Math.sin((t - 149.64) * 3) : 0)); on("pkB", t > 149.64 ? 0.5 - 0.5 * Math.sin((t - 149.64) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 149.64, 150.0));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 151.49, 161.2);
  yc.style.opacity = yOn ? (easeOut(win(t, 151.49, 151.87)) * (1 - easeIO(win(t, 160.9, 161.2)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 151.49, 151.97))) * -60).toFixed(1) + "px)";
}

/* ================= B-roll: napisy natywne dosłownie ze słów lektora ================= */
const BR_CAP = {
  b02: [[2.43, "Start-stop", "W twoim <em>aucie</em>"]],
  b05: [[4.46, "Żebyś ty", "<em>Oszczędzał</em>"]],
  b03: [[5.64, "Start-stop", "<em>Posłuchaj</em>"]],
  b04: [[12.12, "Tylko że", "Producent <em>twierdzi</em>"]],
  b12: [[20.48, "Wyłącza go", "<em>Przyciskiem</em>"], [20.99, "Przy każdym", "<em>Odpaleniu</em>"]],
  b07: [[34.48, "Dlatego", "Raz <em>działa</em>"]],
  b11: [[36.04, "A raz", "<span class=\"hot\">Nie</span>"], [36.68, "Nikt ci nie mówi", "<em>Dlaczego</em>"]],
  b10: [[51.49, "Nie dlatego, że", "Ktoś liczył twój <em>rachunek</em>"]],
  b06: [[78.52, "Kosztuje", "Kilkaset złotych <span class=\"hot\">więcej</span>"]],
  b08: [[109.08, "W wielu autach", "Po <em>szybkiej jeździe</em>"], [111.04, "System", "Po prostu <span class=\"hot\">się nie włącza</span>"]],
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
  // hook: słowa zapalają się na słowach lektora, DEBIL dostaje akcent; w pętli wraca stan z klatki 0
  const hookOn = name === "hook", outroOn = name === "outro";
  show($("hk"), hookOn || outroOn);
  if (hookOn || outroOn) {
    $("hk").style.opacity = hookOn ? 1 : easeOut(win(t, 161.48, 161.88)).toFixed(3);
    hkWords.forEach((w) => {
      const k = hookOn ? easeOut(win(t, w.t, w.t + 0.16)) : 0;
      w.el.style.opacity = (0.5 + 0.5 * k).toFixed(3);
      w.el.style.color = "";
      w.el.style.transform = "translateY(" + f1(-8 * Math.sin(Math.PI * clamp01((t - w.t) / 0.25)) * (hookOn ? 1 : 0)) + "px)";
    });
    const bk = hookOn ? easeOut(win(t, 1.02, 1.16)) : 0;
    const hit = hookOn ? Math.max(0, 1 - Math.abs(t - 1.07) / 0.35) : 0;
    $("hkBig").style.opacity = (0.5 + 0.5 * bk).toFixed(3);
    $("hkBig").style.color = bk > 0.5 ? "#ff6a4d" : "";
    $("hkBig").style.transform = "scale(" + (1 + 0.24 * hit).toFixed(3) + ") rotate(" + (-3 * hit).toFixed(2) + "deg)";
  }
  $("split").style.opacity = 0; $("pA").style.opacity = 0; $("pB").style.opacity = 0;
  drawTags(t);
  usePassCam(camera);
  composer.render();
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, bear, camera, composer, scene, SHOTS, K, dpf, TURBO_C };
