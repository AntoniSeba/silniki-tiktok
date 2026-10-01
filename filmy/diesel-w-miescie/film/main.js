// Jeśli jeździsz dieslem po mieście, twoje auto potrzebuje psychologa, nie mechanika. Część 9.
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

const W = 1080, H = 1920, D = 167.3715;
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
  [0, 2.07, "3d", "hook"], [2.07, 3.24, "broll", "b01"], [3.24, 4.09, "broll", "b02"], [4.09, 5.1, "broll", "b05"], [5.1, 8.64, "3d", "name"],
  [8.64, 9.44, "broll", "b03"], [9.44, 12.26, "3d", "promise"], [12.26, 14.14, "3d", "promise2"], [14.14, 16.15, "broll", "b04"], [16.15, 19.38, "board", "gRep"],
  [19.38, 23.94, "3d", "sick"], [23.94, 25.96, "3d", "plugs"], [25.96, 28.5, "board", "gCompress"], [28.5, 32.18, "3d", "ignite"], [32.18, 35.68, "broll", "b08"],
  [35.68, 37.74, "3d", "short"], [37.74, 40.28, "3d", "p1"], [40.28, 44.38, "board", "gDPF"], [44.38, 46.97, "3d", "hot"], [46.97, 49.98, "board", "gRegen"],
  [49.98, 51.64, "3d", "notin"], [51.64, 60.51, "board", "gTrip"], [60.51, 62.18, "broll", "b12"], [62.18, 64.56, "3d", "p2"], [64.56, 68.62, "board", "gEGR"],
  [68.62, 72.94, "3d", "paste"], [72.94, 75.5, "board", "gLoad"], [75.5, 77.59, "3d", "clog"], [77.59, 80.26, "board", "gLimp"], [80.26, 81.6, "3d", "p3"],
  [81.6, 86.46, "board", "gPost"], [86.46, 89.17, "3d", "drip"], [89.17, 91.94, "broll", "b09"], [91.94, 93.96, "board", "gDilute"], [93.96, 97.98, "3d", "bearing"],
  [97.98, 100.22, "3d", "p4"], [100.22, 104.94, "board", "gDMF"], [104.94, 106.74, "broll", "b07"], [106.74, 110.5, "board", "gKm"], [110.5, 112.1, "broll", "b06"],
  [112.1, 113.66, "broll", "b10"], [113.66, 116.48, "3d", "honest"], [116.48, 121.66, "board", "gRoute"], [121.66, 130.41, "board", "gScan"], [130.41, 133.9, "3d", "note"],
  [133.9, 135.74, "board", "gCart"], [135.74, 140.74, "board", "gVerdict"], [140.74, 142.04, "3d", "promised"], [142.04, 143.64, "3d", "ans"], [143.64, 149.51, "board", "gThermo"],
  [149.51, 152.26, "broll", "b11"], [152.26, 153.78, "3d", "pickA"], [153.78, 157.34, "board", "gPetrol"], [157.34, 166.26, "3d", "yt"], [166.26, D + 1, "3d", "outro"],
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
  let seed = 20260929;
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
  hook: [[0, P0], [0.6, Pw(-2.45, 0.24, 3550, -250)], [2.07, Pw(-2.15, 0.2, 3350, -230)]],
  name: [[5.1, P(-1.85, 0.34, 2800, CX, 220, -60, 32, 60)], [8.64, P(-1.45, 0.3, 2800, CX, 220, -60, 32, 60)]],
  promise: [[9.44, P(1.15, 0.32, 5600, CX, 200, 0, 32, 60)], [12.26, P(0.7, 0.26, 5600, CX, 200, 0, 32, 60)]],
  promise2: [[12.26, P(-0.8, 0.3, 5000, CX, 200, 0, 32, 80)], [14.14, P(-1.05, 0.24, 5000, CX, 200, 0, 32, 80)]],
  sick: [[19.38, Pw(-2.95, 0.1, 3100)], [23.94, Pw(-2.4, 0.18, 3100)]],
  plugs: [[23.94, P(SIN + 0.3, 0.3, 3000, -20, 150, 0, 32, 20)], [25.96, P(SIN + 0.12, 0.26, 3000, -20, 150, 0, 32, 20)]],
  ignite: [[28.5, P(SIN + 0.5, 0.2, 2300, 0, 120, 0, 32, 60)], [32.18, P(SIN + 0.2, 0.14, 2300, 0, 120, 0, 32, 60)]],
  short: [[35.68, Pw(-0.6, 0.3, 3300)], [37.74, Pw(-0.4, 0.26, 3300)]],
  p1: [[37.74, P(EXH - 0.5, 0.26, 2900, 0, 100, -190, 32, 60)], [40.28, P(EXH - 0.28, 0.2, 2900, 0, 100, -190, 32, 60)]],
  hot: [[44.38, P(EXH + 0.4, 0.22, 2900, 0, 100, -190, 32, 60)], [46.97, P(EXH + 0.62, 0.18, 2900, 0, 100, -190, 32, 60)]],
  notin: [[49.98, P(EXH + 1.0, 0.24, 2900, 0, 100, -190, 32, 60)], [51.64, P(EXH + 1.2, 0.2, 2900, 0, 100, -190, 32, 60)]],
  p2: [[62.18, P(SIN + 0.35, 0.3, 2800, -20, 240, 60, 32, 60)], [64.56, P(SIN + 0.15, 0.26, 2800, -20, 240, 60, 32, 60)]],
  paste: [[68.62, P(SIN - 0.35, 0.25, 2300, -20, 250, 80, 32, 60)], [72.94, P(SIN - 0.6, 0.2, 2300, -20, 250, 80, 32, 60)]],
  clog: [[75.5, P(SIN - 0.2, 0.3, 2600, -20, 220, 60, 32, 60)], [77.59, P(SIN - 0.05, 0.26, 2600, -20, 220, 60, 32, 60)]],
  p3: [[80.26, P(SIN + 0.12, 0.08, 2100, 0, 60, 0, 32, 60)], [81.6, P(SIN + 0.02, 0.07, 2100, 0, 60, 0, 32, 60)]],
  drip: [[86.46, P(SIN - 0.1, 0.06, 2100, 0, 60, 0, 32, 60)], [89.17, P(SIN - 0.28, 0.06, 2100, 0, 60, 0, 32, 60)]],
  bearing: [[93.96, PB(SIN + 0.1, 0.05, 2000, 0, -30, 0, 32, 170)], [97.98, PB(SIN - 0.06, 0.03, 2000, 0, -30, 0, 32, 170)]],
  p4: [[97.98, P(0.35, 0.2, 2200, 170, 100, 0, 32, 60)], [100.22, P(0.15, 0.18, 2200, 170, 100, 0, 32, 60)]],
  honest: [[113.66, Pw(1.95, 0.18, 3300)], [116.48, Pw(1.5, 0.24, 3300)]],
  note: [[130.41, Pw(-2.7, 0.22, 3300)], [133.9, Pw(-2.1, 0.26, 3300)]],
  promised: [[140.74, Pw(0.95, 0.3, 3700)], [142.04, Pw(0.78, 0.26, 3700)]],
  ans: [[142.04, Pw(-0.6, 0.14, 3300, 80)], [143.64, Pw(-0.4, 0.11, 3300, 80)]],
  pickA: [[152.26, Pw(0.9, 0.22, 3500, 300)], [153.78, Pw(0.72, 0.2, 3500, 300)]],
  yt: [[157.34, P(1.3, 0.26, 6700, CX, 230, 0, 32, 330)], [166.26, P(-0.4, 0.3, 6700, CX, 230, 0, 32, 330)]],
  outro: [[166.26, Pw(-2.95, 0.34, 4300, -290)], [D, P0], [D + 1, Pw(-2.45, 0.24, 3550, -250)]],
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
const HOOK_END = 7.6;
const BEATS = [0.79];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const FLASHES = [[0.79, 0.14, 0.5], [3.24, 0.16, 0.5], [4.24, 0.18, 0.45]];
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
    case "hook": s.ex = 0.9 * Math.pow(1 - clamp01(t / 0.55), 2); s.fire = 1; s.fireHard = 1; s.pow = 1; s.gTurbo = 0.7 * easeOut(win(t, 0.79, 1.1)); break;
    case "outro": s.ex = 0.9 * Math.pow(win(t, 166.26, D), 2); s.fire = 1; s.fireHard = t >= 166.75 ? 1 : 0; s.pow = t >= 166.75 ? 1 : 0; break;
    case "name": s.fire = 1; s.fireHard = t < HOOK_END ? 1 : 0; break;
    case "promise": s.ex = 0.75 * easeOut(win(t, 9.44, 9.8)); break;
    case "promise2": s.ex = 0.75 * (1 - easeIO(win(t, 12.26, 14.0))); break;
    case "sick": s.fire = 1; s.gExh = 0.9 * easeOut(win(t, 22.21, 22.9)); break;
    case "plugs": s.section = 1; s.noInd = 1; break;
    case "ignite": {
      s.section = 1; s.noInd = 1; s.gFuel = 0.8;
      s.spray = 1 - easeOut(win(t, 30.6, 30.96));
      s.fire = t >= 30.96 ? 1 : 0; s.pow = t >= 30.96 ? 1 : 0;
      break;
    }
    case "short": s.fire = 1; break;
    case "p1": s.fire = 1; s.dpf = 1; s.gExh = 0.7 * easeOut(win(t, 37.74, 38.4)); break;
    case "hot": s.fire = 1; s.dpf = 1; s.gExh = 0.7 + 0.3 * easeOut(win(t, 45.29, 46.4)); s.dpfHot = 0.9 * easeOut(win(t, 45.66, 46.6)); break;
    case "notin": s.fire = 1; s.dpf = 1; s.gExh = 0.25; break;
    case "p2": s.fire = 1; s.gInd = 0.9 * easeOut(win(t, 62.18, 62.7)); break;
    case "paste": s.fire = 1; s.gInd = 0.9; s.indCol = BROWN; break;
    case "clog": s.fire = 1; s.gInd = 0.9; s.indCol = RED; break;
    case "p3": s.section = 1; s.noInd = 1; s.noPan = 1; s.panOil = 1; break;
    case "drip": s.section = 1; s.noInd = 1; s.noPan = 1; s.spray = 1; s.gFuel = 0.6; s.drip = easeOut(win(t, 86.7, 87.2)); s.panOil = 1; s.dilute = 0.3 * easeIO(win(t, 88.3, 89.17)); break;
    case "bearing": s.bear = 1; base = BP; break;
    case "p4": s.fire = 1; s.gFly = 0.9 * easeOut(win(t, 98.2, 98.8)); break;
    case "honest": s.fire = 1; break;
    case "note": s.fire = 1; break;
    case "promised": break;
    case "ans": s.fire = 1; break;
    case "pickA": s.fire = 1; break;
    case "yt": s.ex = easeIO(win(t, 157.8, 164.6)); break;
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
function bearState(t, deg) {
  const k = easeIO(win(t, 96.5, 97.5));
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
  { t0: 24.62, t1: 25.96, text: "Bez świec", a: W3(K.CYL_X[1], K.L.coverTopY, 0), off: [160, -300], c: "hot" },
  { t0: 38.73, t1: 40.28, text: "Filtr cząstek stałych", a: DPF_C, off: [-120, -320], c: "oil" },
  { t0: 63.37, t1: 64.56, text: "Zawór EGR", a: () => PLEN_C, off: [-170, -300], c: "oil" },
  { t0: 76.49, t1: 77.59, text: "Dolot", a: () => PLEN_C, off: [-170, -300], c: "hot" },
  { t0: 86.7, t1: 89.17, text: "Paliwo", a: W3(K.CYL_X[1], 60, BORE_R), off: [170, 280], c: "hot" },
  { t0: 98.92, t1: 100.22, text: "Koło dwumasowe", a: () => FLY_C, off: [-170, -300], c: "oil" },
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
  [5.1, "Diesel", "<em>Tak, wiem</em>"],
  [6.6, "Diesel", "To <em>niezniszczalny silnik</em>"],
  [12.26, "Żeby", "Filtr sam się <em>wyczyścił</em>"],
  [19.38, "Mówi się", "Że to silnik <em>bez wad</em>"],
  [21.08, "Więc czemu", "W mieście <em>choruje</em>"],
  [22.68, "Jak żaden", "<span class=\"hot\">Inny?</span>"],
  [23.94, "Diesel", "Nie ma <em>świec zapłonowych</em>"],
  [28.5, "Robi się", "Tak <em>gorące</em>"],
  [29.84, "Wtryśnięte", "<em>Paliwo</em>"],
  [30.96, "Zapala się", "<span class=\"ok\">Samo</span>"],
  [35.68, "Zbudowany do", "Długiej <em>pracy</em>"],
  [35.95, "Nie do skoków", "Po <em>100 metrów</em>"],
  [37.74, "Powód 1", "<em>Filtr</em> cząstek stałych"],
  [44.38, "Do tego", "Spaliny <em>bardzo gorące</em>"],
  [49.98, "W mieście", "Tego <span class=\"hot\">nie dostaniesz</span>"],
  [62.18, "Powód 2", "Zawór <em>EGR</em>"],
  [68.62, "Spaliny diesla", "To <em>sadza</em>"],
  [70.71, "Z parami oleju", "Robi <span class=\"hot\">lepką pastę</span>"],
  [75.5, "Zawór", "Się <span class=\"hot\">klei</span>"],
  [76.49, "Dolot", "<span class=\"hot\">Zarasta</span>"],
  [80.26, "Powód 3", "<em>Olej</em>"],
  [86.46, "Część paliwa", "Spływa <span class=\"hot\">po ściankach</span>"],
  [88.27, "Do", "<span class=\"hot\">Miski</span>"],
  [93.96, "Panewki", "Już <em>mówiłem</em>"],
  [96.47, "Panewka", "Klin olejowy <span class=\"hot\">znika</span>"],
  [97.98, "Powód 4", "Koło <em>dwumasowe</em>"],
  [113.66, "Uczciwie?", "Na trasie <em>diesel</em>"],
  [115.53, "Uczciwie?", "Jest <span class=\"ok\">rewelacyjny</span>"],
  [130.41, "Skaner", "Filtra <span class=\"hot\">nie wyczyści</span>"],
  [131.42, "Ale wiesz", "Co się <em>dzieje</em>"],
  [132.75, "Ale wiesz", "Zanim zrobi się <em>drogo</em>"],
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
  R_(c, -50, -34, 100, 34, { rx: 12, fill: "#1c232c", stroke: col, "stroke-width": 4 }, c);
  R_(c, -28, -58, 58, 26, { rx: 10, fill: "#1c232c", stroke: col, "stroke-width": 4 }, c);
  C_(c, -28, 0, 12, { fill: FG2 }); C_(c, 28, 0, 12, { fill: FG2 });
  c.querySelectorAll("circle").forEach((e) => e.parentNode !== c && c.appendChild(e));
  return c;
};
const skyline = (g, x0, x1, base, seed) => {
  const s = mkEl("g", { opacity: 0 }, g);
  let x = x0;
  const bars = [];
  for (let i = 0; x < x1; i++) {
    const w = 46 + hash(seed + i) * 40, h = 90 + hash(seed + i + 40) * 210;
    bars.push(R_(s, x, base - h, Math.min(w, x1 - x - 6), h, { fill: "rgba(150,165,182,0.1)", stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }));
    for (let j = 0; j < 3; j++) for (let k = 0; k < Math.floor(h / 70); k++) R_(s, x + 10 + j * 22, base - h + 14 + k * 40, 10, 16, { fill: "rgba(245,170,60,0.28)" });
    x += w + 8;
  }
  L_(s, x0, base, x1, base, FG2, 5);
  return s;
};

// gRep: mało pali, pół miliona kilometrów
const RP = (() => {
  const g = $("rpG"), cx = 300, cy = 800, r = 210;
  const pt = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const arc = (a0, a1, rr) => { const p0 = pt(a0, rr), p1 = pt(a1, rr); return `M ${f1(p0[0])} ${f1(p0[1])} A ${rr} ${rr} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`; };
  mkEl("path", { d: arc(Math.PI, 2 * Math.PI, r), fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 28, "stroke-linecap": "round" }, g);
  mkEl("path", { d: arc(Math.PI, Math.PI * 1.3, r), fill: "none", stroke: OKc, "stroke-width": 28, "stroke-linecap": "round" }, g);
  T_(g, "ZUŻYCIE PALIWA", cx, cy + 62, 24, FG2, { "text-anchor": "middle" });
  const needle = L_(g, cx, cy, cx, cy - 160, O, 10);
  C_(g, cx, cy, 20, { fill: O });
  const low = S_(g, "MAŁO", cx, cy - 70, 64, OKc, { "text-anchor": "middle", opacity: 0 });
  const lab = T_(g, "PRZEBIEG", 70, 950, 24, FG2, { opacity: 0 });
  const km = mkT("0", { x: 70, y: 1090, style: "font-size:170px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  return { cx, cy, needle, low, lab, km };
})();

// gCompress: powietrze sprężane 16 razy
const CM = (() => {
  const g = $("cmG"), x0 = 270, x1 = 570, yT = 520, yB = 1060;
  const air = R_(g, x0 + 3, yT, x1 - x0 - 6, 480, { fill: "rgba(124,196,255,0.25)" });
  const dots = [];
  for (let i = 0; i < 44; i++) dots.push(C_(g, 0, 0, 4, { fill: "#eef2f7", opacity: 0.55 }));
  L_(g, x0, yT, x0, yB, FG2, 6); L_(g, x1, yT, x1, yB, FG2, 6);
  R_(g, x0 - 20, yT - 30, x1 - x0 + 40, 30, { fill: "#2a2f36", stroke: FG2, "stroke-width": 4, rx: 6 });
  const piston = R_(g, x0 + 4, 1000, x1 - x0 - 8, 62, { fill: "#3a3f47", stroke: O, "stroke-width": 5, rx: 8 });
  const rod = L_(g, (x0 + x1) / 2, 1062, (x0 + x1) / 2, 1130, FG2, 18);
  const big = mkT("16×", { x: 620, y: 800, style: "font-size:140px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  return { air, dots, piston, rod, big, x0, x1, yT };
})();

// gDPF: filtr cząstek stałych łapie sadzę i się zapełnia
const DF = (() => {
  const g = $("dfG"), x0 = 70, x1 = 830, y0 = 690, y1 = 920;
  const can = R_(g, x0, y0, x1 - x0, y1 - y0, { rx: 34, fill: "rgba(150,165,182,0.06)", stroke: FG2, "stroke-width": 5 });
  const glow = R_(g, x0, y0, x1 - x0, y1 - y0, { rx: 34, fill: "rgba(255,90,40,0.28)", opacity: 0 });
  for (let i = 0; i < 12; i++) L_(g, 330 + i * 22, y0 + 18, 330 + i * 22, y1 - 18, "rgba(182,193,207,0.35)", 3);
  R_(g, 322, y0 + 12, 268, y1 - y0 - 24, { fill: "none", stroke: "rgba(182,193,207,0.6)", "stroke-width": 3, rx: 6 });
  T_(g, "SPALINY", x0 + 20, y0 - 22, 24, FG2, {});
  L_(g, 96, 805, 250, 805, FG2, 6, { "stroke-dasharray": "14 10" });
  T_(g, "FILTR", 456, y1 + 44, 24, FG2, { "text-anchor": "middle" });
  const layer = R_(g, 298, y0 + 14, 22, y1 - y0 - 28, { fill: SOOT, opacity: 0 });
  const dots = [];
  for (let i = 0; i < 28; i++) dots.push(C_(g, 0, 0, 7, { fill: "#7a6f62", stroke: "rgba(0,0,0,0.55)", "stroke-width": 2, opacity: 0 }));
  T_(g, "ZAPEŁNIENIE", 70, 985, 24, FG2, {});
  R_(g, 70, 1000, 760, 44, { fill: "rgba(150,165,182,0.15)", rx: 6 });
  const bar = R_(g, 70, 1000, 0, 44, { fill: O, rx: 6 });
  return { can, glow, layer, dots, bar };
})();

// gRegen: wypalanie wymaga kilkunastu minut jazdy bez przerwy
const RG = (() => {
  const g = $("rgG"), cx = 300, cy = 790, r = 170, C = 2 * Math.PI * r;
  C_(g, cx, cy, r, { fill: "none", stroke: "rgba(150,165,182,0.25)", "stroke-width": 26 });
  const arc = C_(g, cx, cy, r, { fill: "none", stroke: O, "stroke-width": 26, "stroke-linecap": "round", transform: `rotate(-90 ${cx} ${cy})`, "stroke-dasharray": `0 ${f1(C)}` });
  const t1 = S_(g, "KILKANAŚCIE", cx, cy + 6, 46, FG, { "text-anchor": "middle", opacity: 0 });
  const t2 = T_(g, "MINUT", cx, cy + 50, 26, FG2, { "text-anchor": "middle", opacity: 0 });
  L_(g, 90, 1055, 830, 1055, "rgba(150,165,182,0.45)", 10);
  const dash = L_(g, 90, 1055, 830, 1055, "#0a0c10", 4, { "stroke-dasharray": "22 26" });
  const car = carIcon(g);
  return { C, arc, t1, t2, dash, car };
})();

// gTrip: krótkie trasy, wypalanie urywa się w połowie
const TR = (() => {
  const g = $("trG");
  mkEl("path", { d: "M 90 660 L 130 620 L 170 660 L 160 660 L 160 700 L 100 700 L 100 660 Z", fill: "rgba(150,165,182,0.15)", stroke: FG2, "stroke-width": 4, "stroke-linejoin": "round" }, g);
  R_(g, 740, 640, 100, 66, { fill: "rgba(150,165,182,0.15)", stroke: FG2, "stroke-width": 4, rx: 6 });
  mkEl("path", { d: "M 740 640 L 750 612 L 830 612 L 840 640 Z", fill: "rgba(245,170,60,0.4)", stroke: O, "stroke-width": 4 }, g);
  L_(g, 200, 700, 720, 700, "rgba(150,165,182,0.45)", 8, { "stroke-dasharray": "18 14" });
  const car = carIcon(g);
  const km = S_(g, "2 KM", 460, 650, 56, O, { "text-anchor": "middle", opacity: 0 });
  const off = mkEl("g", { opacity: 0 }, g);
  R_(off, 690, 740, 170, 56, { rx: 8, fill: "rgba(28,10,8,0.85)", stroke: "#ff5a3c", "stroke-width": 4 });
  S_(off, "SILNIK OFF", 775, 780, 32, "#ff5a3c", { "text-anchor": "middle" });
  const pg = mkEl("g", { opacity: 0 }, g);
  T_(pg, "WYPALANIE FILTRA", 70, 858, 24, FG2, {});
  R_(pg, 70, 872, 760, 44, { fill: "rgba(150,165,182,0.15)", rx: 6 });
  const pf = R_(pg, 70, 872, 0, 44, { fill: O, rx: 6 });
  const xm = mkEl("path", { d: "M 430 864 L 490 924 M 490 864 L 430 924", stroke: "#ff3b2a", "stroke-width": 12, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  const cut = S_(g, "PRZERWANE", 70, 990, 56, HT, { opacity: 0 });
  const cnt = mkT("×1", { x: 70, y: 1090, style: "font-size:120px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  const fil = mkEl("g", { opacity: 0 }, g);
  R_(fil, 400, 1010, 240, 100, { rx: 16, fill: "rgba(150,165,182,0.12)", stroke: FG2, "stroke-width": 5 });
  const fF = R_(fil, 400, 1010, 240, 100, { rx: 16, fill: "#e2492b", opacity: 0 });
  S_(fil, "FILTR", 520, 1075, 46, FG, { "text-anchor": "middle" });
  const lamp = mkEl("g", { opacity: 0 }, g);
  const lampC = C_(lamp, 760, 1060, 44, { fill: "none", stroke: O, "stroke-width": 6 });
  S_(lamp, "!", 760, 1080, 60, O, { "text-anchor": "middle" });
  return { car, km, off, pg, pf, xm, cut, cnt, fil, fF, lamp, lampC };
})();

// gEGR: część spalin wraca do dolotu, spada temperatura spalania
const EG = (() => {
  const g = $("egG");
  R_(g, 300, 700, 300, 170, { rx: 20, fill: "rgba(150,165,182,0.1)", stroke: FG2, "stroke-width": 5 });
  S_(g, "SILNIK", 450, 800, 60, FG, { "text-anchor": "middle" });
  L_(g, 90, 760, 300, 760, "rgba(124,196,255,0.6)", 22);
  L_(g, 600, 820, 830, 820, "rgba(150,165,182,0.6)", 22);
  T_(g, "DOLOT", 90, 722, 24, IC, {});
  T_(g, "WYDECH", 830, 872, 24, FG2, { "text-anchor": "end" });
  const loop = mkEl("path", { d: "M 720 820 L 720 560 L 200 560 L 200 760", fill: "none", stroke: O, "stroke-width": 14, "stroke-linejoin": "round", opacity: 0.9 }, g);
  const valve = mkEl("g", { opacity: 0 }, g);
  C_(valve, 460, 560, 46, { fill: "#0d1117", stroke: O, "stroke-width": 6 });
  T_(valve, "EGR", 460, 571, 30, O, { "text-anchor": "middle" });
  const dots = [], gas = [];
  for (let i = 0; i < 10; i++) dots.push(C_(g, 0, 0, 9, { fill: O, opacity: 0 }));
  for (let i = 0; i < 6; i++) gas.push(C_(g, 0, 820, 8, { fill: "#b6c1cf", opacity: 0 }));
  T_(g, "TEMPERATURA SPALANIA", 70, 985, 24, FG2, {});
  R_(g, 70, 1000, 760, 44, { fill: "rgba(150,165,182,0.15)", rx: 6 });
  const bar = R_(g, 70, 1000, 760, 44, { fill: HT, rx: 6 });
  return { loop, valve, dots, gas, bar, L: 0 };
})();

// gLoad: niskie obciążenie, nic nie przedmuchuje pasty
const LD = (() => {
  const g = $("ldG");
  T_(g, "OBCIĄŻENIE", 90, 572, 24, FG2, {});
  R_(g, 90, 590, 720, 54, { rx: 8, fill: "rgba(150,165,182,0.15)" });
  const bar = R_(g, 90, 590, 0, 54, { rx: 8, fill: IC });
  const low = S_(g, "NISKIE", 90, 730, 72, IC, { opacity: 0 });
  R_(g, 90, 830, 740, 130, { rx: 16, fill: "rgba(150,165,182,0.06)", stroke: FG2, "stroke-width": 5 });
  const blobs = [];
  for (let i = 0; i < 14; i++) blobs.push(C_(g, 130 + i * 50 + hash(i * 2) * 20, hash(i) > 0.5 ? 848 + hash(i) * 12 : 942 - hash(i) * 12, 14 + hash(i + 3) * 10, { fill: "#6b4a26", stroke: "#3a2610", "stroke-width": 3, opacity: 0 }));
  const flow = L_(g, 110, 895, 320, 895, "rgba(182,193,207,0.7)", 8, { "stroke-dasharray": "14 12", opacity: 0 });
  const x = mkEl("path", { d: "M 350 865 L 420 925 M 420 865 L 350 925", stroke: "#ff3b2a", "stroke-width": 12, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  T_(g, "PRZEDMUCH", 110, 985, 24, FG2, {});
  return { bar, low, blobs, flow, x };
})();

// gLimp: auto szarpie i wpada w tryb awaryjny
const LM = (() => {
  const g = $("lmG");
  const lamp = mkEl("g", { opacity: 0, transform: "translate(0 -80)" }, g);
  mkEl("path", { d: "M 250 700 L 290 700 L 310 680 L 400 680 L 400 700 L 430 700 L 430 780 L 400 780 L 400 840 L 330 840 L 310 820 L 250 820 Z", fill: "rgba(245,170,60,0.25)", stroke: O, "stroke-width": 7, "stroke-linejoin": "round" }, lamp);
  T_(g, "MOMENT", 90, 812, 24, FG2, {});
  const wave = mkEl("path", { fill: "none", stroke: O, "stroke-width": 6, "stroke-linejoin": "round" }, g);
  T_(g, "MOC", 90, 985, 24, FG2, {});
  R_(g, 90, 1000, 720, 44, { fill: "rgba(150,165,182,0.15)", rx: 6 });
  const bar = R_(g, 90, 1000, 720, 44, { fill: OKc, rx: 6 });
  return { lamp, wave, bar };
})();

// gPost: cykl 720°, dodatkowy wtrysk po spaleniu
const PS = (() => {
  const g = $("psG"), cx = 330, cy = 780, r = 190;
  const P = (deg, rr) => { const a = (deg / 720) * 2 * Math.PI - Math.PI / 2; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
  const arc = (d0, d1, rr) => { const p0 = P(d0, rr), p1 = P(d1, rr); return `M ${f1(p0[0])} ${f1(p0[1])} A ${rr} ${rr} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`; };
  const defs = [["SSANIE", 0, IC], ["SPRĘŻANIE", 180, "#c6a06a"], ["PRACA", 360, HT], ["WYDECH", 540, FG2]];
  const arcs = defs.map(([nm, d0, col]) => {
    const p = mkEl("path", { d: arc(d0 + 4, d0 + 176, r), fill: "none", stroke: col, "stroke-width": 34, "stroke-linecap": "butt", opacity: 0.5 }, g);
    const lp = P(d0 + 90, r + 62);
    T_(g, nm, lp[0], lp[1] + 8, 22, FG2, { "text-anchor": "middle" });
    return p;
  });
  const main = C_(g, P(340, r)[0], P(340, r)[1], 13, { fill: O, opacity: 0 });
  const ep = P(470, r);
  const ring = C_(g, ep[0], ep[1], 26, { fill: "none", stroke: HT, "stroke-width": 5, opacity: 0 });
  const extra = C_(g, ep[0], ep[1], 20, { fill: HT, opacity: 0 });
  const ptr = L_(g, cx, cy, cx, cy - r + 30, FG, 6, { opacity: 0.9 });
  C_(g, cx, cy, 12, { fill: FG });
  const leg = mkEl("g", { opacity: 0 }, g);
  C_(leg, 90, 1050, 12, { fill: O });
  T_(leg, "GŁÓWNY WTRYSK", 116, 1058, 22, FG2, {});
  C_(leg, 470, 1050, 15, { fill: HT });
  T_(leg, "DODATKOWY", 498, 1058, 22, FG2, {});
  return { P, cx, cy, r, arcs, main, ring, extra, ptr, leg };
})();

// gDilute: paliwo rozrzedza olej
const DI = (() => {
  const g = $("diG");
  mkEl("clipPath", { id: "diClip" }, g).appendChild(mkEl("rect", { x: 100, y: 520, width: 300, height: 440, rx: 20 }));
  const oil = R_(g, 100, 800, 300, 160, { fill: "#c07a14", "clip-path": "url(#diClip)" });
  mkEl("path", { d: "M 100 520 L 100 940 Q 100 960 120 960 L 380 960 Q 400 960 400 940 L 400 520", fill: "none", stroke: FG2, "stroke-width": 6 }, g);
  T_(g, "OLEJ", 250, 1010, 26, FG, { "text-anchor": "middle" });
  const drops = [];
  for (let i = 0; i < 6; i++) drops.push(mkEl("ellipse", { cx: 160 + i * 36, cy: 480, rx: 10, ry: 15, fill: "#ffe7a0", opacity: 0 }, g));
  T_(g, "GĘSTOŚĆ OLEJU", 480, 560, 24, FG2, {});
  R_(g, 480, 580, 330, 40, { rx: 6, fill: "rgba(150,165,182,0.15)" });
  const visc = R_(g, 480, 580, 330, 40, { rx: 6, fill: O });
  const vt = T_(g, "", 480, 680, 30, HT, {});
  return { oil, drops, visc, vt };
})();

// gDMF: szarpanie silnika tłumione przez koło dwumasowe
const DM = (() => {
  const g = $("dmG");
  const wIn = mkEl("path", { fill: "none", stroke: HT, "stroke-width": 6, "stroke-linejoin": "round" }, g);
  const wMid = mkEl("path", { fill: "none", stroke: HT, "stroke-width": 6, "stroke-linejoin": "round" }, g);
  const wOut = mkEl("path", { fill: "none", stroke: HT, "stroke-width": 6, "stroke-linejoin": "round" }, g);
  const box = mkEl("g", { opacity: 0 }, g);
  R_(box, 440, 680, 170, 170, { rx: 16, fill: "#0d1117", stroke: FG2, "stroke-width": 5 });
  for (const y0 of [710, 790]) {
    let d = `M 460 ${y0}`;
    for (let i = 0; i < 6; i++) d += ` L ${470 + i * 22} ${y0 + (i % 2 ? -22 : 22)}`;
    d += ` L 590 ${y0}`;
    mkEl("path", { d, fill: "none", stroke: O, "stroke-width": 6, "stroke-linejoin": "round" }, box);
  }
  T_(g, "SILNIK", 90, 900, 24, FG2, {});
  T_(g, "KOŁO", 525, 900, 24, FG2, { "text-anchor": "middle" });
  T_(g, "SKRZYNIA", 830, 900, 24, FG2, { "text-anchor": "end" });
  return { wIn, wMid, wOut, box };
})();

// gKm: koło zużywa się przed 150 000 km
const KM = (() => {
  const g = $("kmG");
  const lab = T_(g, "PRZED", 70, 650, 30, FG2, { opacity: 0 });
  const num = mkT("0", { x: 70, y: 820, style: "font-size:170px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  const unit = S_(g, "KM", 70, 930, 84, FG, { opacity: 0 });
  const wheel = mkEl("g", { opacity: 0 }, g);
  C_(wheel, 600, 1060, 96, { fill: "rgba(150,165,182,0.1)", stroke: FG2, "stroke-width": 6 });
  C_(wheel, 600, 1060, 38, { fill: "#0d1117", stroke: FG2, "stroke-width": 5 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 2 * Math.PI; L_(wheel, 600 + Math.cos(a) * 44, 1060 + Math.sin(a) * 44, 600 + Math.cos(a) * 84, 1060 + Math.sin(a) * 84, FG2, 8); }
  const cracks = mkEl("g", { opacity: 0 }, wheel);
  mkEl("path", { d: "M 600 964 L 590 1000 L 612 1020 L 598 1050", fill: "none", stroke: "#ff3b2a", "stroke-width": 6, "stroke-linejoin": "round" }, cracks);
  mkEl("path", { d: "M 690 1080 L 656 1072 L 648 1094", fill: "none", stroke: "#ff3b2a", "stroke-width": 6, "stroke-linejoin": "round" }, cracks);
  return { lab, num, unit, wheel, cracks };
})();

// gRoute: trasa czyści filtr, sklep nie
const RO = (() => {
  const g = $("roG");
  const tA = S_(g, "TRASA", 90, 570, 64, OKc, { opacity: 0 });
  R_(g, 90, 600, 720, 64, { rx: 10, fill: "rgba(150,165,182,0.15)" });
  const soot1 = R_(g, 90, 600, 720, 64, { rx: 10, fill: SOOT, opacity: 0 });
  const ck = mkEl("path", { d: "M 330 540 L 356 566 L 400 516", fill: "none", stroke: OKc, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, g);
  const tB = S_(g, "SKLEP", 90, 870, 64, HT, { opacity: 0 });
  R_(g, 90, 900, 720, 64, { rx: 10, fill: "rgba(150,165,182,0.15)" });
  const soot2 = R_(g, 90, 900, 720, 64, { rx: 10, fill: SOOT, opacity: 0 });
  const cr = mkEl("path", { d: "M 330 842 L 390 890 M 390 842 L 330 890", stroke: "#ff3b2a", "stroke-width": 12, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  T_(g, "FILTR", 90, 705, 22, FG2, {});
  T_(g, "FILTR", 90, 1005, 22, FG2, {});
  return { tA, soot1, ck, tB, soot2, cr };
})();

// gScan: gniazdo diagnostyczne pod kierownicą i skaner
const SC = (() => {
  const g = $("scG");
  const city = skyline(g, 70, 850, 1000, 3);
  mkEl("path", { d: "M 60 560 Q 300 520 560 560 L 560 660 Q 300 630 60 660 Z", fill: "rgba(150,165,182,0.1)", stroke: FG2, "stroke-width": 4 }, g);
  T_(g, "DESKA ROZDZIELCZA · POD KIEROWNICĄ", 70, 700, 20, FG2, {});
  mkEl("path", { d: "M 180 760 L 380 760 L 360 830 L 200 830 Z", fill: "#0d1117", stroke: FG2, "stroke-width": 5 }, g);
  for (let i = 0; i < 8; i++) { C_(g, 212 + i * 20, 782, 5, { fill: "#6c737c" }); if (i < 7) C_(g, 222 + i * 20, 808, 5, { fill: "#6c737c" }); }
  const port = T_(g, "GNIAZDO OBD", 280, 870, 22, O, { "text-anchor": "middle", opacity: 0 });
  const dev = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M 196 836 L 364 836 L 350 900 L 210 900 Z", fill: "#1c232c", stroke: O, "stroke-width": 5 }, dev);
  R_(dev, 200, 900, 160, 150, { rx: 18, fill: "#1c232c", stroke: O, "stroke-width": 5 });
  const led = C_(dev, 280, 975, 14, { fill: "#3a3f47" });
  const link = mkEl("path", { d: "M 370 960 Q 430 930 470 960", fill: "none", stroke: IC, "stroke-width": 5, "stroke-dasharray": "10 10", opacity: 0 }, g);
  return { city, port, dev, led, link };
})();

// gCart: strzałka do koszyka na dole filmu
const CA = (() => {
  const g = $("caG");
  const arr = mkEl("path", { d: "M 230 820 L 230 1330 M 180 1270 L 230 1330 L 280 1270", fill: "none", stroke: O, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  const t1 = S_(g, "W KOSZYKU", 320, 1200, 72, FG, { opacity: 0 });
  const t2 = S_(g, "NA DOLE FILMU", 320, 1280, 56, O, { opacity: 0 });
  return { arr, t1, t2 };
})();

// gVerdict: skaner nie zmieni fizyki, miejski diesel potrzebuje trasy
const VD = (() => {
  const g = $("vdG");
  const a = mkEl("g", { opacity: 0 }, g);
  R_(a, 90, 560, 380, 110, { rx: 14, fill: "rgba(20,26,34,0.95)", stroke: FG2, "stroke-width": 3 });
  S_(a, "SKANER", 130, 640, 64, FG, {});
  const arr = mkEl("g", { opacity: 0 }, g);
  L_(arr, 280, 686, 280, 810, FG2, 8, { "stroke-dasharray": "12 12" });
  mkEl("path", { d: "M 256 792 L 280 820 L 304 792", fill: "none", stroke: FG2, "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }, arr);
  const x = mkEl("path", { d: "M 250 726 L 310 786 M 310 726 L 250 786", stroke: "#ff3b2a", "stroke-width": 14, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  const b = mkEl("g", { opacity: 0 }, g);
  R_(b, 90, 830, 380, 110, { rx: 14, fill: "rgba(20,26,34,0.95)", stroke: O, "stroke-width": 3 });
  S_(b, "FIZYKA", 130, 910, 64, O, {});
  const road = L_(g, 90, 1050, 830, 1050, "rgba(150,165,182,0.45)", 10, { opacity: 0 });
  const dash = L_(g, 90, 1050, 830, 1050, "#0a0c10", 4, { "stroke-dasharray": "22 26", opacity: 0 });
  const car = carIcon(g);
  car.setAttribute("opacity", 0);
  return { a, arr, x, b, road, dash, car };
})();

// gThermo: 600 stopni potrzebnych do wypalenia, miasto daje 200 do 300
const TH = (() => {
  const g = $("thG");
  const X = (v) => 90 + (720 * v) / 700;
  T_(g, "TEMPERATURA SPALIN", 90, 572, 24, FG2, {});
  R_(g, 90, 600, 720, 60, { rx: 10, fill: "rgba(150,165,182,0.15)" });
  const city = R_(g, X(200), 600, X(300) - X(200), 60, { fill: "rgba(226,73,43,0.35)", stroke: "#ff5a3c", "stroke-width": 3, opacity: 0 });
  const bar = R_(g, 90, 600, 0, 60, { rx: 10, fill: O });
  for (let v = 0; v <= 700; v += 100) {
    L_(g, X(v), 668, X(v), 684, FG2, 3);
    T_(g, String(v), X(v), 712, 22, v === 600 ? O : FG2, { "text-anchor": "middle", opacity: v === 600 ? 1 : 0.8 });
  }
  const mk = mkEl("g", { opacity: 0 }, g);
  L_(mk, X(600), 588, X(600), 672, HT, 5);
  S_(mk, "WYPALANIE SADZY", 830, 584, 30, HT, { "text-anchor": "end" });
  const cl = S_(g, "MIASTO", (X(200) + X(300)) / 2, 780, 44, "#ff8a70", { "text-anchor": "middle", opacity: 0 });
  const gap = mkEl("g", { opacity: 0 }, g);
  L_(gap, X(300) + 6, 850, X(600) - 6, 850, FG2, 6, { "stroke-dasharray": "14 12" });
  mkEl("path", { d: `M ${X(600) - 26} 830 L ${X(600) - 4} 850 L ${X(600) - 26} 870`, fill: "none", stroke: FG2, "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, gap);
  S_(gap, "BRAKUJE", (X(300) + X(600)) / 2, 920, 56, FG, { "text-anchor": "middle" });
  return { X, city, bar, mk, cl, gap };
})();

// gPetrol: albo benzyna w mieście
const PTR = (() => {
  const g = $("ptG");
  const sk = skyline(g, 70, 850, 1000, 11);
  const cyl = [];
  for (let i = 0; i < 4; i++) {
    const c = mkEl("g", { opacity: 0 }, g);
    C_(c, 165 + i * 170, 700, 66, { fill: "rgba(150,165,182,0.14)", stroke: FG2, "stroke-width": 6 });
    mkEl("path", { d: `M ${165 + i * 170 + 8} 668 L ${165 + i * 170 - 18} 706 L ${165 + i * 170 + 2} 706 L ${165 + i * 170 - 10} 736 L ${165 + i * 170 + 22} 692 L ${165 + i * 170 + 2} 692 Z`, fill: O }, c);
    cyl.push(c);
  }
  return { sk, cyl };
})();

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gRep") {
    stepH($("rpH"), t, [[16.15, "Mało <em>pali</em>"], [17.13, "Potrafi <em>przejechać</em>"], [17.77, "Pół miliona <em>kilometrów</em>"]]);
    const a = lerp(1.85, 1.15, easeIO(win(t, 16.2, 17.0))) * Math.PI;
    RP.needle.setAttribute("x2", f1(RP.cx + Math.cos(a) * 160)); RP.needle.setAttribute("y2", f1(RP.cy + Math.sin(a) * 160));
    op(RP.low, easeOut(win(t, 16.6, 16.95)));
    RP.km.textContent = fmt(Math.round(500000 * easeIO(win(t, 17.3, 18.6))));
    op(RP.km, easeOut(win(t, 17.13, 17.5))); op(RP.lab, easeOut(win(t, 17.13, 17.5)));
  } else if (id === "gCompress") {
    stepH($("cmH"), t, [[25.96, "Powietrze jest <em>sprężane</em>"], [27.44, "<em>16</em> razy"]]);
    const k = easeIO(win(t, 26.5, 27.9));
    const top = lerp(1000, 550, k);
    CM.piston.setAttribute("y", f1(top)); CM.rod.setAttribute("y1", f1(top + 62)); CM.rod.setAttribute("y2", f1(top + 130));
    const h = top - CM.yT;
    CM.air.setAttribute("height", f1(h));
    CM.air.setAttribute("fill", `rgba(${Math.round(lerp(124, 255, k))},${Math.round(lerp(196, 106, k))},${Math.round(lerp(255, 60, k))},${f1(lerp(0.25, 0.6, k))})`);
    CM.dots.forEach((d, i) => {
      d.setAttribute("cx", f1(CM.x0 + 14 + hash(i * 1.7) * 272));
      d.setAttribute("cy", f1(CM.yT + 8 + hash(i * 2.3 + 9) * Math.max(4, h - 16)));
    });
    op(CM.big, easeOut(win(t, 27.44, 27.8)));
  } else if (id === "gDPF") {
    stepH($("dfH"), t, [[40.28, "Łapie <em>sadzę</em> ze spalin"], [41.78, "Kiedy się <em>zapełni</em>"], [42.76, "Komputer musi ją <span class=\"hot\">wypalić</span>"]]);
    const burn = easeIO(win(t, 43.63, 44.3));
    DF.dots.forEach((d, i) => {
      const t0 = 40.4 + i * 0.045;
      const k = easeOut(win(t, t0, t0 + 0.8));
      d.setAttribute("cx", f1(lerp(100, 288 - (i % 7) * 9, k)));
      d.setAttribute("cy", f1(722 + hash(i * 3.7) * 170));
      op(d, (k > 0.02 ? 1 : 0) * (1 - burn));
    });
    const fill = easeIO(win(t, 41.78, 43.4)) * (1 - burn);
    DF.bar.setAttribute("width", f1(760 * fill));
    DF.bar.setAttribute("fill", fill > 0.75 ? HT : O);
    op(DF.layer, 0.9 * fill);
    op(DF.glow, 0.9 * burn * (1 - win(t, 44.0, 44.38)));
    DF.can.setAttribute("stroke", burn > 0.3 ? HT : FG2);
  } else if (id === "gRegen") {
    stepH($("rgH"), t, [[46.97, "A to <em>wymaga</em>"], [47.6, "Kilkunastu <em>minut</em>"], [48.62, "Jazdy <em>bez przerwy</em>"]]);
    const k = easeIO(win(t, 47.19, 49.16));
    RG.arc.setAttribute("stroke-dasharray", `${f1(RG.C * k)} ${f1(RG.C)}`);
    op(RG.t1, easeOut(win(t, 47.6, 47.95))); op(RG.t2, easeOut(win(t, 47.6, 47.95)));
    RG.car.setAttribute("transform", `translate(${f1(120 + 660 * win(t, 47.2, 49.9))} 1043)`);
    RG.dash.style.strokeDashoffset = ((t * 90) % 48).toFixed(1);
  } else if (id === "gTrip") {
    stepH($("trH"), t, [[51.64, "Jedziesz <em>dwa kilometry</em>"], [53.48, "Gasisz <span class=\"hot\">silnik</span>"], [54.52, "Wypalanie <span class=\"hot\">urywa się</span>"], [56.38, "Powtórz to <em>kilkadziesiąt razy</em>"], [58.03, "Filtr jest <span class=\"hot\">zapchany</span>"], [59.36, "A <em>kontrolka</em>"]]);
    TR.car.setAttribute("transform", `translate(${f1(lerp(240, 680, easeIO(win(t, 51.7, 53.4))))} 712)`);
    op(TR.km, easeOut(win(t, 52.31, 52.6)));
    op(TR.off, easeOut(win(t, 53.48, 53.8)));
    op(TR.pg, easeOut(win(t, 54.52, 54.85)));
    TR.pf.setAttribute("width", f1(760 * 0.5 * easeIO(win(t, 54.58, 55.61))));
    op(TR.xm, easeOut(win(t, 55.66, 55.95)));
    op(TR.cut, easeOut(win(t, 55.66, 55.95)));
    TR.cnt.textContent = "×" + Math.round(lerp(1, 40, easeOut(win(t, 56.38, 57.72))));
    op(TR.cnt, easeOut(win(t, 56.38, 56.75)));
    op(TR.fil, easeOut(win(t, 57.97, 58.3)));
    op(TR.fF, 0.85 * easeIO(win(t, 58.03, 58.61)));
    const lit = t >= 60.41;
    op(TR.lamp, lit ? 1 : easeOut(win(t, 59.42, 59.8)) * 0.3);
    TR.lampC.setAttribute("fill", lit ? "rgba(245,170,60,0.4)" : "none");
  } else if (id === "gEGR") {
    stepH($("egH"), t, [[64.56, "Zawraca część <em>spalin</em>"], [65.88, "Do <em>dolotu</em>"], [66.48, "Żeby obniżyć <em>temperaturę</em>"]]);
    if (!EG.L) EG.L = EG.loop.getTotalLength();
    const k = easeIO(win(t, 64.7, 65.9));
    EG.loop.style.strokeDasharray = EG.L; EG.loop.style.strokeDashoffset = EG.L * (1 - k);
    op(EG.valve, easeOut(win(t, 65.1, 65.5)));
    EG.dots.forEach((d, i) => {
      const p = frac((t - 65.4) * 0.3 + i / 10);
      const pt = EG.loop.getPointAtLength(EG.L * p);
      d.setAttribute("cx", f1(pt.x)); d.setAttribute("cy", f1(pt.y));
      op(d, t > 65.5 ? Math.sin(p * Math.PI) * easeOut(win(t, 65.5, 65.9)) : 0);
    });
    EG.gas.forEach((d, i) => {
      const p = frac(t * 0.45 + i / 6);
      d.setAttribute("cx", f1(600 + p * 230));
      op(d, Math.sin(p * Math.PI) * easeOut(win(t, 64.6, 65.0)));
    });
    const tk = easeIO(win(t, 67.24, 68.3));
    EG.bar.setAttribute("width", f1(760 * lerp(1, 0.5, tk)));
    EG.bar.setAttribute("fill", mixC(HT, IC, tk));
  } else if (id === "gLoad") {
    stepH($("ldH"), t, [[72.94, "Na <em>niskim</em> obciążeniu"], [73.96, "Nic jej <span class=\"hot\">nie przedmuchuje</span>"]]);
    LD.bar.setAttribute("width", f1(720 * 0.14 * easeOut(win(t, 73.0, 73.5))));
    op(LD.low, easeOut(win(t, 73.0, 73.4)));
    LD.blobs.forEach((b, i) => op(b, easeOut(win(t, 72.98 + i * 0.03, 73.3 + i * 0.03))));
    op(LD.flow, easeOut(win(t, 73.96, 74.3)));
    LD.flow.style.strokeDashoffset = (-(t * 40) % 26).toFixed(1);
    op(LD.x, easeOut(win(t, 74.32, 74.6)));
  } else if (id === "gLimp") {
    stepH($("lmH"), t, [[77.59, "Auto <span class=\"hot\">szarpie</span>"], [78.47, "Wpada w <span class=\"hot\">tryb awaryjny</span>"]]);
    const amp = 70 * easeOut(win(t, 77.59, 77.9)) * (1 - 0.85 * easeIO(win(t, 78.47, 79.4)));
    let d = "";
    for (let x = 90; x <= 830; x += 8) {
      const n = Math.sin(x * 0.07 + t * 9) * (0.6 + 0.4 * Math.sin(x * 0.031 - t * 5)) + 0.4 * Math.sin(x * 0.19 + t * 13);
      d += (x === 90 ? "M " : " L ") + x + " " + f1(875 + amp * n);
    }
    LM.wave.setAttribute("d", d);
    op(LM.lamp, easeOut(win(t, 78.47, 78.8)));
    const pk = easeIO(win(t, 78.47, 79.4));
    LM.bar.setAttribute("width", f1(720 * lerp(1, 0.35, pk)));
    LM.bar.setAttribute("fill", mixC(OKc, HT, pk));
  } else if (id === "gPost") {
    stepH($("psH"), t, [[81.6, "Żeby <em>wypalić</em> filtr"], [82.86, "Silnik dostaje <em>dodatkową porcję paliwa</em>"], [85.33, "Już <span class=\"hot\">po spaleniu</span>"]]);
    PS.arcs.forEach((a, i) => a.setAttribute("opacity", f1(i === 2 ? 0.5 + 0.4 * easeOut(win(t, 85.33, 85.9)) : 0.5)));
    const cyc = wrap(crankAt(t), 720);
    const pe = PS.P(cyc, PS.r - 30);
    PS.ptr.setAttribute("x2", f1(pe[0])); PS.ptr.setAttribute("y2", f1(pe[1]));
    op(PS.main, easeOut(win(t, 81.8, 82.2)));
    const ek = easeOut(win(t, 83.77, 84.2));
    op(PS.extra, ek);
    op(PS.ring, ek * (0.6 + 0.4 * Math.sin(t * 3)));
    op(PS.leg, easeOut(win(t, 84.4, 84.8)));
  } else if (id === "gDilute") {
    stepH($("diH"), t, [[91.94, "Poziom <em>rośnie</em>"], [92.81, "Olej się <span class=\"hot\">rozrzedza</span>"]]);
    const dk = easeIO(win(t, 91.98, 93.1));
    DI.drops.forEach((e, i) => {
      const p = frac((t - 91.98) * 1.1 + i / 6);
      const live = t >= 91.98 && t < 93.3;
      e.setAttribute("cy", f1(lerp(470, 820 - 30 * dk, p)));
      e.setAttribute("opacity", live ? f1(Math.sin(p * Math.PI)) : 0);
    });
    const lvl = 160 + 60 * dk;
    DI.oil.setAttribute("y", f1(960 - lvl)); DI.oil.setAttribute("height", f1(lvl));
    DI.oil.setAttribute("fill", mixC("#c07a14", "#e6d59a", dk));
    DI.visc.setAttribute("width", f1(330 * (1 - 0.55 * easeIO(win(t, 92.81, 93.9)))));
    DI.vt.textContent = t > 93.3 ? "RZADSZY" : "";
  } else if (id === "gDMF") {
    stepH($("dmH"), t, [[100.22, "Diesel <span class=\"hot\">szarpie</span>"], [101.09, "Przy każdym <em>zapłonie</em>"], [102.55, "Koło ma to <em>wytłumić</em>"], [103.83, "<em>Sprężynami</em>"]]);
    const A = 75 * easeOut(win(t, 100.4, 100.9));
    const bo = easeOut(win(t, 102.57, 102.95));
    op(DM.box, bo);
    const damp = lerp(1, 0.14, easeIO(win(t, 103.27, 103.9)));
    const sp = (x) => { const ph = frac((x - t * 150) / 74), d = (ph - 0.5) * 8; return Math.exp(-d * d); };
    const wave = (x0, x1, k) => { let d = ""; for (let x = x0; x <= x1; x += 6) d += (x === x0 ? "M " : " L ") + x + " " + f1(765 - A * k * sp(x)); return d; };
    DM.wIn.setAttribute("d", wave(90, 440, 1));
    DM.wMid.setAttribute("d", wave(440, 610, 1)); DM.wMid.setAttribute("opacity", f1(1 - bo));
    DM.wOut.setAttribute("d", wave(610, 830, damp));
    DM.wOut.setAttribute("stroke", mixC(HT, OKc, 1 - damp));
  } else if (id === "gKm") {
    stepH($("kmH"), t, [[106.74, "Zużywa się <em>często</em>"]]);
    op(KM.lab, easeOut(win(t, 107.9, 108.25)));
    KM.num.textContent = fmt(Math.round(150000 * easeIO(win(t, 107.95, 109.45))));
    op(KM.num, easeOut(win(t, 107.9, 108.25)));
    op(KM.unit, easeOut(win(t, 109.52, 109.85)));
    op(KM.wheel, easeOut(win(t, 107.0, 107.4)));
    op(KM.cracks, easeOut(win(t, 109.52, 109.9)));
  } else if (id === "gRoute") {
    stepH($("roH"), t, [[116.48, "Jedziesz <em>godzinę</em>"], [117.55, "Filtr <span class=\"ok\">sam się czyści</span>"], [118.9, "Kupiłeś <em>narzędzie do trasy</em>"], [120.29, "Używasz go <span class=\"hot\">do sklepu</span>"]]);
    op(RO.tA, easeOut(win(t, 116.48, 116.85)));
    op(RO.soot1, 1);
    RO.soot1.setAttribute("width", f1(720 * (1 - easeIO(win(t, 117.55, 118.4)))));
    op(RO.ck, easeOut(win(t, 118.9, 119.25)));
    op(RO.tB, easeOut(win(t, 120.29, 120.65)));
    op(RO.soot2, easeOut(win(t, 120.29, 120.65)));
    op(RO.cr, easeOut(win(t, 120.99, 121.3)));
  } else if (id === "gScan") {
    stepH($("scH"), t, [[121.66, "Jeśli już musisz <em>jeździć po mieście</em>"], [123.67, "Woź w aucie mały <em>skaner diagnostyczny</em>"], [126.06, "Wpinasz go <em>pod kierownicą</em>"], [127.5, "Na <em>telefonie</em>"], [128.17, "Widzisz <em>błędy</em> i <em>temperaturę silnika</em>"]]);
    op(SC.city, easeOut(win(t, 121.66, 122.05)) * (1 - easeOut(win(t, 124.2, 124.6))));
    op(SC.port, easeOut(win(t, 126.54, 126.9)));
    const dv = easeOut(win(t, 124.47, 124.9));
    const up = easeIO(win(t, 126.06, 126.9));
    op(SC.dev, dv);
    SC.dev.setAttribute("transform", `translate(0 ${f1(170 - 170 * up + (1 - dv) * 30)})`);
    SC.led.setAttribute("fill", up > 0.98 ? OKc : "#3a3f47");
    const pk = easeOut(win(t, 127.5, 127.95));
    $("scPhone").style.opacity = pk;
    $("scPhone").style.transform = "translateY(" + f1((1 - pk) * 40) + "px)";
    op(SC.link, pk);
    pop($("scE1"), t, 128.6, 0.25, 20);
    [...$("scPhone").querySelectorAll(".pr")].forEach((r) => pop(r, t, +r.dataset.t, 0.25, 16));
  } else if (id === "gCart") {
    stepH($("caH"), t, [[133.9, "Masz go <em>w koszyku</em>"], [134.67, "Na dole <em>filmu</em>"]]);
    const ck = easeOut(win(t, 133.95, 134.3));
    $("caCard").style.opacity = ck;
    $("caCard").style.transform = "translateY(" + f1((1 - ck) * 30) + "px)";
    CA.arr.style.strokeDasharray = 700; CA.arr.style.strokeDashoffset = 700 * (1 - easeIO(win(t, 134.3, 134.95)));
    op(CA.t1, easeOut(win(t, 134.28, 134.6)));
    op(CA.t2, easeOut(win(t, 134.78, 135.1)));
  } else if (id === "gVerdict") {
    stepH($("vdH"), t, [[135.74, "Ale <em>skaner</em>"], [136.61, "Nie zmieni <em>fizyki</em>"], [138.32, "Miejski <em>diesel</em>"], [139.28, "Potrzebuje <em>trasy</em>"]]);
    const fade = 1 - 0.75 * easeIO(win(t, 138.32, 138.9));
    op(VD.a, easeOut(win(t, 135.9, 136.25)) * fade);
    op(VD.arr, easeOut(win(t, 136.6, 136.95)) * fade);
    op(VD.x, easeOut(win(t, 136.83, 137.15)) * fade);
    op(VD.b, easeOut(win(t, 137.3, 137.65)) * fade);
    const rk = easeOut(win(t, 138.32, 138.7));
    op(VD.road, rk); op(VD.dash, rk); op(VD.car, rk);
    VD.car.setAttribute("transform", `translate(${f1(lerp(120, 780, easeIO(win(t, 139.0, 140.7))))} 1043)`);
    VD.dash.style.strokeDashoffset = ((t * 90) % 48).toFixed(1);
  } else if (id === "gThermo") {
    stepH($("thH"), t, [[143.64, "Tyle muszą mieć <em>spaliny</em>"], [145.05, "Żeby sadza <em>się wypaliła</em>"], [147.18, "W mieście mają <span class=\"hot\">200, 300</span>"]]);
    const k = easeIO(win(t, 143.64, 145.0));
    const city = easeIO(win(t, 147.18, 147.9));
    const T = lerp(600 * k, 250, city);
    TH.bar.setAttribute("width", f1(TH.X(T) - 90));
    TH.bar.setAttribute("fill", city > 0.5 ? HT : O);
    op(TH.mk, easeOut(win(t, 145.3, 145.7)));
    op(TH.city, easeOut(win(t, 147.18, 147.6)));
    op(TH.cl, easeOut(win(t, 147.4, 147.8)));
    op(TH.gap, easeOut(win(t, 148.64, 149.0)));
  } else if (id === "gPetrol") {
    stepH($("ptH"), t, [[153.78, "Albo <em>benzyna</em> w mieście"]]);
    op(PTR.sk, easeOut(win(t, 154.1, 154.6)));
    PTR.cyl.forEach((c, i) => op(c, easeOut(win(t, 153.9 + i * 0.12, 154.2 + i * 0.12))));
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Filtr", "EGR", "Olej", "Koło", "Trasa"];
const RN = RW.length, RROW = 50, ANS = "600 stopni", T_ANS = 142.04;
const BURSTS = [[9.7, 10.7, 2 * RN], [37.8, 38.5, 2 * RN], [62.25, 62.95, 2 * RN], [80.3, 81.0, 2 * RN], [98.05, 98.75, 2 * RN], [113.7, 114.4, 2 * RN], [140.8, 141.35, 2 * RN], [141.4, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  $("flash").style.opacity = Math.max(0, ...FLASHES.map(([a, dur, amp]) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0))).toFixed(3);
  const rb = $("reelBar");
  const rOn = inR(t, 9.44, 144.2);
  rb.style.opacity = rOn ? (easeOut(win(t, 9.44, 9.74)) * (1 - easeIO(win(t, 143.8, 144.2)))).toFixed(3) : 0;
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
      easeOut(win(t, 9.44, 9.84)) * (1 - easeIO(win(t, 11.2, 11.7))),
      easeIO(win(t, 140.74, 141.1)) * (1 - easeIO(win(t, 143.2, 143.64))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 147.18, 150.7);
  sc.style.opacity = sOn ? (easeOut(win(t, 147.18, 147.6)) * (1 - easeIO(win(t, 150.3, 150.7)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 147.18, 147.7))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 152.26, 157.3);
  pc.style.opacity = pOn ? (easeOut(win(t, 152.26, 152.64)) * (1 - easeIO(win(t, 156.9, 157.3)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 152.26, 152.64))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 152.78 ? (t < 153.78 ? easeOut(win(t, 152.78, 152.98)) : 0.5) : 0;
    const gB = t > 153.78 ? easeOut(win(t, 153.78, 153.98)) : 0;
    on("pkA", Math.max(gA, t > 155.42 ? 0.5 + 0.5 * Math.sin((t - 155.42) * 3) : 0)); on("pkB", t > 155.42 ? 0.5 - 0.5 * Math.sin((t - 155.42) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 155.42, 155.78));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 157.34, 166.0);
  yc.style.opacity = yOn ? (easeOut(win(t, 157.34, 157.72)) * (1 - easeIO(win(t, 165.7, 166.0)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 157.34, 157.82))) * -60).toFixed(1) + "px)";
}

/* ================= B-roll: napisy natywne dosłownie ze słów lektora ================= */
const BR_CAP = {
  b01: [[2.07, "Diesel po mieście", "Twoje auto <em>potrzebuje</em>"]],
  b02: [[3.24, "Twoje auto potrzebuje", "<em>Psychologa</em>"]],
  b05: [[4.09, "Nie", "<span class=\"hot\">Mechanika</span>"]],
  b03: [[8.64, "Tak, wiem", "<em>Posłuchaj</em>"]],
  b04: [[14.14, "Tylko że", "Diesel ma <em>świetną opinię</em>"]],
  b08: [[32.18, "Silnik", "Jest <em>ciężki</em>"], [33.23, "Zbudowany", "Do <em>długiej pracy</em>"], [34.74, "Pod", "<em>Obciążeniem</em>"]],
  b12: [[60.51, "Kontrolka", "Zapali się <em>dopiero</em>"], [61.05, "Kontrolka", "Gdy jest już <span class=\"hot\">źle</span>"]],
  b09: [[89.17, "Wypalanie", "<span class=\"hot\">Przerwane</span>"], [90.5, "Paliwo", "Zostaje <span class=\"hot\">w oleju</span>"]],
  b07: [[104.94, "W mieście", "Pracuje <span class=\"hot\">bez przerwy</span>"]],
  b06: [[110.5, "Wymiana", "Ze <em>sprzęgłem</em>"]],
  b10: [[112.1, "Kosztuje", "Kilka <span class=\"hot\">tysięcy złotych</span>"]],
  b11: [[149.51, "Twój diesel", "Nie jest <span class=\"ok\">zepsuty</span>"], [151.21, "On się", "<span class=\"hot\">Dusi</span>"]],
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
  if (A.s.bear) bear.setState(bearState(t, deg));
  applyCam(t, name, camera, si);
  lightAt(A.base, camera);
  projCam = camera;

  drawTop(t, si);
  $("cnt").style.opacity = 0;
  // hook: słowa zapalają się na słowach lektora, DEBIL dostaje akcent; w pętli wraca stan z klatki 0
  const hookOn = name === "hook", outroOn = name === "outro";
  show($("hk"), hookOn || outroOn);
  if (hookOn || outroOn) {
    $("hk").style.opacity = hookOn ? 1 : easeOut(win(t, 166.26, 166.66)).toFixed(3);
    hkWords.forEach((w) => {
      const k = hookOn ? easeOut(win(t, w.t, w.t + 0.16)) : 0;
      w.el.style.opacity = (0.5 + 0.5 * k).toFixed(3);
      w.el.style.color = "";
      w.el.style.transform = "translateY(" + f1(-8 * Math.sin(Math.PI * clamp01((t - w.t) / 0.25)) * (hookOn ? 1 : 0)) + "px)";
    });
    const bk = hookOn ? easeOut(win(t, 0.79, 0.93)) : 0;
    const hit = hookOn ? Math.max(0, 1 - Math.abs(t - 0.84) / 0.35) : 0;
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
