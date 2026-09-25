// Litr z turbo to największe kłamstwo motoryzacji.
// Modele: R3 turbo (trzycylindrowy wariant modelu 2JZ Antoniego), BMW S54 jako duży silnik bez turbo,
// V6 do karty YouTube, osobna turbina w przekroju. Cały obraz jest czystą funkcją czasu (hf-seek).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "../model/r3/lib/materials.js";
import { buildStudioEnvironment } from "../model/r3/lib/environment.js";
import { buildEngine } from "../model/r3/scene.js";
import * as K from "../model/r3/lib/engine.js";
import { createMaterials as createMaterialsS, applyMaterialVariation as varyS } from "../model/s54/lib/materials.js";
import { buildEngine as buildS54 } from "../model/s54/parts/engine.js";
import * as KS from "../model/s54/kinematics.js";
import { createMaterials as createMaterials6 } from "../model/v6/lib/materials.js";
import { buildEngine as buildV6 } from "../model/v6/scene.js";
import { buildTurbo } from "./turbo.js";
import { CAPS } from "./captions.js";

const W = 1080, H = 1920, D = 168.55;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const backOut = (x) => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const bump = (t, a, b) => Math.sin(win(t, a, b) * Math.PI);
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const f1 = (v) => v.toFixed(1);
function mono(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
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
  [0, 3.36, "3d", "hook"], [3.36, 4.71, "3d", "ty"], [4.71, 8.47, "3d", "promise"], [8.47, 10.44, "board", "gTitle"],
  [10.44, 15.28, "3d", "splitSize"], [15.28, 18.05, "3d", "plusy"], [18.05, 21.95, "board", "gPaper"], [21.95, 28.45, "board", "gNedc"],
  [28.45, 31.85, "3d", "noBoost"], [31.85, 33.34, "3d", "lazyTurbo"], [33.34, 36.02, "3d", "calm"], [36.02, 37.78, "board", "gCatalog"],
  [37.78, 40.98, "broll"], [40.98, 44.16, "3d", "load"], [44.16, 46.01, "3d", "turboHot"], [46.01, 49.58, "3d", "fuel"],
  [49.58, 53.46, "3d", "cool"], [53.46, 54.85, "board", "gReceipt"], [54.85, 60.3, "3d", "splitGap"], [60.3, 62.77, "board", "gGap"],
  [62.77, 64.45, "3d", "notAll"], [64.45, 68.65, "3d", "pressure"], [68.65, 71.3, "3d", "lowRpm"], [71.3, 74.7, "3d", "lspi"],
  [74.7, 78.49, "3d", "ring"], [78.49, 82.97, "board", "gOil"], [82.97, 86.37, "3d", "belt"], [86.37, 89.35, "3d", "oilFill"],
  [89.35, 90.81, "3d", "quiet"], [90.81, 94.7, "3d", "decay"], [94.7, 98.65, "3d", "sitko"], [98.65, 102.81, "board", "gCases"],
  [102.81, 105.7, "board", "gWarranty"], [105.7, 108.38, "3d", "honest"], [108.38, 111.65, "3d", "city"], [111.65, 113.89, "board", "gTorque"],
  [113.89, 118.15, "board", "gHeavy"], [118.15, 119.49, "3d", "promised"], [119.49, 126.8, "board", "gRde"], [126.8, 131.09, "3d", "smoke"],
  [131.09, 135.81, "board", "gLambda"], [135.81, 137.69, "3d", "cant"], [137.69, 139.41, "3d", "whatDid"], [139.41, 145.2, "board", "gRight"],
  [145.2, 150.21, "3d", "naBig"], [150.21, 153.45, "board", "gWord"], [153.45, 155.29, "3d", "bigger"], [155.29, 157.27, "3d", "pickA"],
  [157.27, 159.8, "3d", "pickB"], [159.8, 163.11, "3d", "yt1"], [163.11, 166.45, "3d", "yt2"], [166.45, 168.3, "3d", "yt3"],
  [168.3, D + 1, "3d", "outro"],
];
const shotIdx = (t) => { for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) return i; return SHOTS.length - 1; };
const shotAt = (t) => SHOTS[shotIdx(t)];
const SPLIT = new Set(["splitSize", "splitGap"]);

/* ================= kąt wału ================= */
const CK = [[0, 0]];
let ca = 0, ct = 0;
const run = (t1, w) => { ca += w * (t1 - ct); ct = t1; CK.push([ct, ca]); };
run(3.36, 420); run(4.71, 300); run(8.47, 120); run(15.28, 160); run(18.05, 200); run(28.45, 150); run(31.85, 90); run(36.02, 100);
run(40.98, 150); run(44.16, 330); run(46.01, 330); run(49.58, 110); run(53.46, 90); run(60.3, 200); run(64.45, 200); run(68.65, 100);
run(71.3, 80); run(74.7, 45); run(78.49, 25); run(82.97, 150); run(89.35, 120); run(94.7, 90); run(98.65, 60); run(108.38, 150);
run(113.89, 160); run(126.8, 150); run(131.09, 130); run(137.69, 380); run(145.2, 150); run(150.21, 110); run(155.29, 180);
run(159.8, 160); run(168.3, 120);
CK.push([D, Math.ceil((ca + 380 * (D - ct)) / 720) * 720]);
const crankAt = mono(CK);
const TB_RATE = (360 * Math.round(2 * D)) / D;

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
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
  const rad = g.createRadialGradient(W / 2, H * 0.44, 40, W / 2, H * 0.44, 900);
  rad.addColorStop(0, "rgba(120,150,190,0.16)"); rad.addColorStop(1, "rgba(120,150,190,0)");
  g.fillStyle = rad; g.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 90) for (let y = 0; y <= H; y += 90) {
    const dx = (x - W / 2) / (W * 0.72), dy = (y - H * 0.44) / (H * 0.46);
    const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.8) * 0.07;
    g.fillStyle = "rgba(150,165,182," + a.toFixed(3) + ")";
    g.fillRect(x, y - 45, 1, 90); g.fillRect(x - 45, y, 90, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
const key = new THREE.DirectionalLight(0xfffaf2, 3.0);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 200, far: 8000, left: -1100, right: 1100, top: 1100, bottom: -1100 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.5); scene.add(fill); scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xffffff, 0.8); scene.add(rim); scene.add(rim.target);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));
function lightAt(b) {
  key.position.set(b.x - 1400, b.y + 2100, b.z + 1600); key.target.position.copy(b);
  fill.position.set(b.x + 1700, b.y + 800, b.z - 1200); fill.target.position.copy(b);
  rim.position.set(b.x + 600, b.y + 1300, b.z - 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

/* ================= R3 turbo ================= */
const AMBER = new THREE.Color(0xff8a1c), ICE = new THREE.Color(0x3aa0ff), GREEN = new THREE.Color(0x3cff7a), HOT = new THREE.Color(0xff2a10), GOLD = new THREE.Color(0xffb020);
function glowMats(root, col = AMBER, skip = null) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || (skip && skip(o))) return;
    o.material = o.material.clone();
    o.material.emissive = col.clone();
    o.material.emissiveIntensity = 0;
    out.push(o.material);
  });
  return out;
}
const setGlow = (mats, k, col) => mats.forEach((m) => { if (col) m.emissive.copy(col); m.emissiveIntensity = k; });
const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E = buildEngine(M);
applyMaterialVariation(E.root, M);
E.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(E.root);
const P = E.parts;
const B = P.block, R = P.rotating, HD = P.head, IND = P.induction, TM = P.timing;
const NC = K.CYL_X.length;
const crank = R.groups.crank;
const pistons = R.groups.pistons, rods = R.groups.rods;
const pistGlow = pistons.map((p) => glowMats(p));
const rodGlow = rods.map((r) => glowMats(r));
const crankGlow = glowMats(crank, AMBER, (o) => /^MainJournal_/.test(o.name));
const mainGlow = K.MAIN_X.map((_, i) => glowMats(crank.getObjectByName(`MainJournal_${i + 1}`)));
const deckMeshes = ["Deck_Plate", "Deck_FaceMachined"].map((n) => B.groups.core.getObjectByName(n)).filter(Boolean);
const blockGlow = [...glowMats(B.groups.core, AMBER, (o) => o.parent === B.groups.oilJets), ...glowMats(B.groups.skinIn), ...glowMats(B.groups.skinEx)];
const turbo = IND.turbos[0];
const turboGlow = glowMats(turbo.group);
const fuelGlow = glowMats(HD.groups.fuel);
const manGlow = glowMats(IND.groups.manifolds);
const exhGlow = glowMats(IND.groups.exhaust);
const beltMesh = TM.root.getObjectByName("Timing_Belt");
beltMesh.material = beltMesh.material.clone();
beltMesh.material.transparent = true;
const beltGlow = [beltMesh.material];
beltMesh.material.emissive = AMBER.clone(); beltMesh.material.emissiveIntensity = 0;
// tłok 1 i jego pierścienie: do rozbicia
const p1 = pistons[0];
const p1Parts = p1.children.filter((o) => o.isMesh).map((o, i) => ({ o, base: o.position.clone(), rot: o.rotation.clone(), dir: new THREE.Vector3(o.position.x + (hash(i) - 0.5) * 30, 10 + hash(i + 7) * 30, o.position.z + (hash(i + 3) - 0.5) * 30).normalize(), ring: /Piston_Ring_1_/.test(o.name) }));

// zapłon, gaz, wtrysk
const DECK = K.L.deckY, BORE_R = K.L.boreR;
const flashes = [], pows = [], sprays = [];
for (let i = 0; i < NC; i++) {
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), fm);
  f.scale.set(1, 0.55, 1);
  E.root.add(f);
  flashes.push({ m: f, mat: fm });
  const pm = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 3, BORE_R - 3, 1, 32), pm);
  E.root.add(p);
  pows.push({ m: p, mat: pm });
  const sm = new THREE.MeshBasicMaterial({ color: 0xffa530, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(38, 95, 24, 1, true), sm);
  E.root.add(cone);
  sprays.push({ m: cone, mat: sm });
}
// samozapłon: ognisko w cylindrze 1 i iskra
const lspiMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const lspi = new THREE.Mesh(new THREE.SphereGeometry(44, 24, 16), lspiMat);
E.root.add(lspi);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const spark = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), sparkMat);
E.root.add(spark);
// olej w rozrządzie, płatki paska, sitko
const BELT_X = K.L.camSprocketX;
const oilMat = new THREE.MeshStandardMaterial({ color: 0xd08a20, transparent: true, opacity: 0.26, roughness: 0.1, metalness: 0.0, emissive: new THREE.Color(0x3a1c00), emissiveIntensity: 0.25, depthWrite: false });
const oilBox = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 360), oilMat);
oilBox.position.set(BELT_X, 0, -10);
E.root.add(oilBox);
const STRAIN = new THREE.Vector3(-60, -175, 0);
const strainer = new THREE.Group();
strainer.position.copy(STRAIN);
E.root.add(strainer);
{
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 10, 32), new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.8, roughness: 0.4 }));
  strainer.add(disc);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 11, 32), new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.5, roughness: 0.7 }));
  strainer.add(mesh);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 150, 16), new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.8, roughness: 0.4 }));
  tube.position.set(0, 80, 0);
  strainer.add(tube);
}
E.root.updateMatrixWorld(true);
const beltPts = [];
{
  const pos = beltMesh.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 12) { v.fromBufferAttribute(pos, i); beltMesh.localToWorld(v); beltPts.push(v.clone()); }
}
const flakeMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6, metalness: 0.1, emissive: new THREE.Color(0x7a3a0a), emissiveIntensity: 0.7 });
const flakes = [];
for (let i = 0; i < 90; i++) {
  const s = beltPts[Math.floor(hash(i * 3.3) * beltPts.length)];
  const m = new THREE.Mesh(new THREE.BoxGeometry(18 + hash(i) * 18, 5, 14 + hash(i + 5) * 20), flakeMat);
  E.root.add(m);
  flakes.push({ m, s, e: STRAIN.clone().add(new THREE.Vector3((hash(i + 1) - 0.5) * 70, 8 + hash(i + 2) * 22, (hash(i + 4) - 0.5) * 70)), d: hash(i + 9) * 0.5, sp: hash(i + 11) });
}
const headBaseY = HD.root.position.y;

/* ================= duży bez turbo (S54) i V6 ================= */
const SP = new THREE.Vector3(0, -80000, 0);
const MS = createMaterialsS();
const ES = buildS54(MS);
varyS(ES.root, MS);
ES.root.position.copy(SP);
ES.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(ES.root);
const sGlow = glowMats(ES.root, AMBER);
const VP = new THREE.Vector3(0, -160000, 0);
const M6 = createMaterials6();
const E6 = buildV6(M6);
E6.ring.visible = false; E6.charge.visible = false;
E6.root.position.copy(VP);
scene.add(E6.root);
const v6Base = E6.explodeGroups.map((g) => g.position.clone());
// osobna turbina w przekroju
const TP = new THREE.Vector3(0, -240000, 0);
const bigT = buildTurbo();
bigT.group.position.copy(TP);
bigT.group.scale.setScalar(110);
scene.add(bigT.group);

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
  Object.assign(ssaoPass, { kernelRadius: 160, minDistance: 40, maxDistance: 1400 });
  composer.addPass(ssaoPass);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.26, 0.7, 0.88));
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
const Pc = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.5, x, y, z, fov, oy });
const Ps = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.5, x: SP.x + x, y: SP.y + y, z: SP.z + z, fov, oy });
const Pv = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.3, x: VP.x + x, y: VP.y + y, z: VP.z + z, fov, oy });
const Pt = (az, el, r, fov, oy) => ({ az, el, r, x: TP.x, y: TP.y, z: TP.z, fov, oy });
const SIN = Math.PI / 2, EXH = -Math.PI / 2, FRONT = Math.PI;
const X1 = K.CYL_X[0], TZ = K.L.turboZ, TY = K.L.turboY;
const P0 = Pc(-2.55, 0.3, 2500, 0, 120, 0, 32, -150);
const CAM = {
  hook: [[0, P0], [1.4, Pc(-2.2, 0.2, 1900, 0, 115, 0, 32, -150)], [3.36, Pc(-1.8, 0.12, 1700, 0, 110, 0, 32, -150)]],
  ty: [[3.36, Pc(EXH - 0.5, 0.05, 700, 0, TY, TZ, 32, 60)], [4.71, Pc(EXH - 0.3, 0.02, 560, 0, TY, TZ, 32, 60)]],
  promise: [[4.71, Pc(1.2, 0.34, 2700, 0, 140, 0, 32, 90)], [8.47, Pc(0.6, 0.24, 2450, 0, 140, 0, 32, 90)]],
  splitSizeA: [[10.44, Ps(2.3, 0.2, 2700, 0, 120, 0, 32, 390)], [15.28, Ps(2.0, 0.18, 2500, 0, 120, 0, 32, 390)]],
  splitSizeB: [[10.44, Pc(-2.3, 0.25, 2000, 0, 120, 0, 32, -300)], [15.28, Pc(-2.0, 0.2, 1850, 0, 120, 0, 32, -300)]],
  plusy: [[15.28, Pc(-0.9, 0.3, 2000, 0, 120, 0, 32, 80)], [18.05, Pc(-1.6, 0.22, 1850, 0, 120, 0, 32, 80)]],
  noBoost: [[28.45, Pc(EXH - 0.6, 0.12, 1500, 0, 90, -100, 32, 60)], [31.85, Pc(EXH - 0.35, 0.08, 1350, 0, 80, -120, 32, 60)]],
  lazyTurbo: [[31.85, Pt(0.45, 0.35, 1500, 32, 0)], [33.34, Pt(0.7, 0.28, 1350, 32, 0)]],
  calm: [[33.34, Pc(2.4, 0.2, 2000, 0, 120, 0, 32, 90)], [36.02, Pc(2.1, 0.16, 1850, 0, 120, 0, 32, 90)]],
  load: [[40.98, Pc(EXH - 0.4, 0.15, 1700, 0, 90, -100, 32, 60)], [44.16, Pc(EXH - 0.15, 0.1, 1500, 0, 80, -120, 32, 60)]],
  turboHot: [[44.16, Pt(-0.45, 0.3, 1300, 32, 0)], [46.01, Pt(-0.8, 0.2, 1150, 32, 0)]],
  fuel: [[46.01, Pc(SIN + 0.15, 0.02, 950, 0, 160, 0, 32, 250)], [49.58, Pc(SIN + 0.05, 0.0, 860, 0, 160, 0, 32, 250)]],
  cool: [[49.58, Pc(SIN - 0.3, 0.2, 1100, 0, 170, 0, 32, 250)], [53.46, Pc(SIN - 0.15, 0.15, 1000, 0, 170, 0, 32, 250)]],
  splitGapA: [[54.85, Pc(2.3, 0.2, 2100, 0, 120, 0, 32, 390)], [60.3, Pc(2.05, 0.18, 1950, 0, 120, 0, 32, 390)]],
  splitGapB: [[54.85, Pc(-2.2, 0.22, 2100, 0, 120, 0, 32, -300)], [60.3, Pc(-2.45, 0.2, 1950, 0, 120, 0, 32, -300)]],
  notAll: [[62.77, Pc(0.9, 0.35, 2300, 0, 130, 0, 32, 80)], [64.45, Pc(0.5, 0.28, 2000, 0, 130, 0, 32, 80)]],
  pressure: [[64.45, Pc(SIN + 0.14, 0.1, 1050, 0, 175, 0, 32, 250)], [68.65, Pc(SIN + 0.04, 0.07, 960, 0, 175, 0, 32, 250)]],
  lowRpm: [[68.65, Pc(SIN - 0.25, 0.14, 1000, 0, 170, 0, 32, 230)], [71.3, Pc(SIN - 0.12, 0.1, 900, 0, 170, 0, 32, 230)]],
  lspi: [[71.3, Pc(SIN + 0.1, 0.06, 560, X1, 185, 0, 32, 260)], [74.7, Pc(SIN + 0.02, 0.04, 480, X1, 185, 0, 32, 260)]],
  ring: [[74.7, Pc(SIN - 0.2, 0.12, 520, X1, 150, 0, 32, 260)], [78.49, Pc(SIN - 0.08, 0.1, 460, X1, 150, 0, 32, 260)]],
  belt: [[82.97, Pc(FRONT + 0.35, 0.18, 1500, -217, 190, 0, 32, 40)], [86.37, Pc(FRONT + 0.18, 0.12, 1350, -217, 190, 0, 32, 40)]],
  oilFill: [[86.37, Pc(FRONT - 0.3, 0.14, 1350, -217, 190, 0, 32, 40)], [89.35, Pc(FRONT - 0.15, 0.1, 1250, -217, 190, 0, 32, 40)]],
  quiet: [[89.35, Pc(FRONT + 0.1, 0.25, 1000, -217, 260, -20, 32, 40)], [90.81, Pc(FRONT, 0.2, 920, -217, 260, -20, 32, 40)]],
  decay: [[90.81, Pc(FRONT + 0.4, 0.1, 1300, -217, 150, 0, 32, 40)], [94.7, Pc(FRONT + 0.25, 0.05, 1200, -217, 120, 0, 32, 40)]],
  sitko: [[94.7, Pc(FRONT + 0.75, -0.02, 1150, -100, -40, 0, 32, 60)], [98.65, Pc(FRONT + 0.9, 0.0, 1050, -90, -60, 0, 32, 60)]],
  honest: [[105.7, Pc(-2.7, 0.2, 2100, 0, 120, 0, 32, 90)], [108.38, Pc(-2.4, 0.16, 1950, 0, 120, 0, 32, 90)]],
  city: [[108.38, Pc(1.9, 0.25, 2000, 0, 120, 0, 32, 90)], [111.65, Pc(1.6, 0.2, 1850, 0, 120, 0, 32, 90)]],
  promised: [[118.15, Pc(0.95, 0.32, 2400, 0, 130, 0, 32, 80)], [119.49, Pc(0.75, 0.26, 2200, 0, 130, 0, 32, 80)]],
  smoke: [[126.8, Pc(EXH - 0.5, 0.3, 1600, 0, 120, -80, 32, 60)], [131.09, Pc(EXH - 0.25, 0.22, 1450, 0, 110, -100, 32, 60)]],
  cant: [[135.81, Pc(-2.2, 0.15, 1900, 0, 120, 0, 32, 60)], [137.69, Pc(-2.0, 0.12, 1700, 0, 120, 0, 32, 60)]],
  whatDid: [[137.69, Pc(2.8, 0.3, 2400, 0, 130, 0, 32, 80)], [139.41, Pc(1.6, 0.25, 2200, 0, 130, 0, 32, 80)]],
  naBig: [[145.2, Ps(2.5, 0.2, 2700, 0, 120, 0, 32, 90)], [150.21, Ps(2.1, 0.16, 2450, 0, 120, 0, 32, 90)]],
  bigger: [[153.45, Ps(-2.3, 0.25, 2900, 0, 120, 0, 32, 80)], [154.17, Ps(-2.15, 0.2, 2400, 0, 120, 0, 32, 80)], [155.29, Ps(-2.05, 0.18, 2350, 0, 120, 0, 32, 80)]],
  pickA: [[155.29, Pc(-2.4, 0.25, 2200, 0, 120, 0, 32, 280)], [157.27, Pc(-2.2, 0.2, 2050, 0, 120, 0, 32, 280)]],
  pickB: [[157.27, Ps(2.3, 0.22, 2800, 0, 120, 0, 32, 280)], [159.8, Ps(2.05, 0.2, 2650, 0, 120, 0, 32, 280)]],
  yt1: [[159.8, Pv(0.6, 0.3, 2500, 0, 120, 0, 32, 320)], [163.11, Pv(0.95, 0.24, 2300, 0, 120, 0, 32, 320)]],
  yt2: [[163.11, Pv(-0.6, 0.35, 3000, 0, 150, 0, 32, 320)], [166.45, Pv(-0.95, 0.3, 3300, 0, 150, 0, 32, 320)]],
  yt3: [[166.45, Pv(2.3, 0.4, 3300, 0, 150, 0, 32, 320)], [168.33, Pv(2.0, 0.35, 3100, 0, 150, 0, 32, 320)]],
  _rc2: [[169.61, Pc(SIN + 0.1, 0.1, 1000, 0, 190, 0, 32, 250)], [170.58, Pc(SIN, 0.08, 950, 0, 190, 0, 32, 250)]],
  rc3: [[170.58, Pc(SIN + 0.06, 0.05, 520, X1, 185, 0, 32, 260)], [171.55, Pc(SIN, 0.04, 480, X1, 185, 0, 32, 260)]],
  rc4: [[171.55, Pc(FRONT + 0.3, 0.08, 1250, -217, 140, 0, 32, 40)], [172.53, Pc(FRONT + 0.2, 0.05, 1200, -217, 130, 0, 32, 40)]],
  outro: [[168.3, Pc(-2.7, 0.33, 2750, 0, 120, 0, 32, -150)], [D, P0], [D + 1, Pc(-2.4, 0.26, 2100, 0, 120, 0, 32, -150)]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
// mocne słowa: szarpnięcie kamery i krótki najazd
const BEATS = [0.5, 1.68, 10.82, 12.82, 14.68, 20.86, 30.79, 37.03, 41.5, 44.44, 48.19, 51.71, 55.24, 61.82, 67.51, 69.81, 72.37, 74.06, 75.22, 76.46, 77.3, 81.31, 87.36, 93.18, 95.3, 96.98, 100.08, 101.92, 104.28, 112.34, 117.39, 119.57, 125.65, 130.11, 133.83, 136.78, 141.71, 144.54, 148.19, 152.33, 154.17, 156.38, 157.27, 163.62, 164.61, 167.45];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
const camTgt = new THREE.Vector3();
function applyCam(t, name, shk, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  const si = shotIdx(t);
  if (si > 0 && si < SHOTS.length - 1) {
    // każde cięcie wchodzi płynnym dojazdem, bez szarpnięcia
    const cut = 1 - easeIO(win(t, SHOTS[si][0], SHOTS[si][0] + 1.1));
    v.r *= 1 + 0.12 * cut;
    v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.07 * cut;
  }
  shk = 0;
  const jit = clamp01(t / 1.0) * clamp01((D - t) / 1.0);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  if (shk > 0) { v.az += shk * 0.012 * Math.sin(t * 47); v.el += shk * 0.009 * Math.sin(t * 59 + 1); }
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * (1 + jit * 0.004 * Math.sin(t * 0.9));
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
  return camTgt;
}

/* ================= stan silników ================= */
const blankS = () => ({
  ex: 0, head: 0, section: 0, noInd: 0, fire: 0, pow: 0, spray: 0, gP: [0, 0, 0], gCol: [], mains: [0, 0, 0, 0], gMains: HOT, gCrank: 0,
  gBlock: 0, blockCol: AMBER, gTurbo: 0, turboCol: HOT, turboSpin: 1, gFuel: 0, gMan: 0, gExh: 0, shake: 0,
  oil: 0, flakes: -1, beltFade: 0, strainer: 0, noPan: 0, lspi: 0, spark: 0, shatter: 0, ringOff: 0,
  sEx: 0, sGlow: 0, sScale: 1, v6Ex: 0, big: 0, bigHeat: 0, bigSpin: 1,
});
function pose(st, deg, t) {
  E.update(deg, { explode: st.ex, turboDeg: 0 });
  HD.root.position.y += st.head * 560;
  IND.root.visible = !st.noInd;
  for (const g of [B.groups.skinIn, B.groups.skinEx, HD.groups.skinIn, HD.groups.skinEx]) g.visible = !st.section;
  deckMeshes.forEach((o) => { o.visible = !st.section; });
  B.groups.pan.visible = !st.noPan;
  TM.groups.covers.visible = false;
  for (let i = 0; i < NC; i++) {
    const col = st.gCol[i] || AMBER;
    setGlow(pistGlow[i], st.gP[i], col);
    setGlow(rodGlow[i], st.gP[i] * 0.8, col);
  }
  mainGlow.forEach((ms, i) => setGlow(ms, st.mains[i] * 1.6, st.gMains));
  setGlow(crankGlow, st.gCrank, HOT);
  setGlow(blockGlow, st.gBlock, st.blockCol);
  setGlow(turboGlow, st.gTurbo, st.turboCol);
  setGlow(fuelGlow, st.gFuel, AMBER);
  setGlow(manGlow, st.gMan, HOT);
  setGlow(exhGlow, st.gExh, HOT);
  turbo.shaft.rotation.x = t * TB_RATE * st.turboSpin * D2R;
  // tłok 1: pierścień i pęknięcie
  p1Parts.forEach((q, i) => {
    q.o.position.copy(q.base);
    q.o.rotation.copy(q.rot);
    if (q.ring && st.ringOff > 0) { q.o.position.x += 60 * st.ringOff; q.o.position.y += 40 * st.ringOff; q.o.rotation.z = q.rot.z + 1.2 * st.ringOff; }
    if (st.shatter > 0) { q.o.position.addScaledVector(q.dir, 55 * st.shatter); q.o.rotation.x = q.rot.x + (hash(i) - 0.5) * 1.4 * st.shatter; q.o.rotation.z = q.rot.z + (hash(i + 2) - 0.5) * 1.4 * st.shatter; }
  });
  // zapłon, gaz, wtrysk
  for (let i = 0; i < NC; i++) {
    const ph = wrap(deg - K.firePhaseDeg(i + 1), 720);
    const k = st.fire && ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
    flashes[i].m.visible = k > 0.01;
    flashes[i].m.position.set(K.CYL_X[i], DECK + 12, 0);
    flashes[i].mat.opacity = k;
    flashes[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    const on = !!st.pow && ph < 180;
    pows[i].m.visible = on;
    if (on) {
      const crown = K.pistonCrownY(deg, i + 1), len = Math.max(2, DECK + 8 - crown);
      pows[i].m.scale.set(1, len, 1);
      pows[i].m.position.set(K.CYL_X[i], crown + len / 2, 0);
      const f = ph / 180;
      pows[i].mat.opacity = 0.85 - 0.5 * f;
      pows[i].mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
    }
    // wtrysk w suwie ssania (540..720 fazy) plus pulsowanie
    const intake = ph > 540 ? (ph - 540) / 180 : 0;
    const sk = st.spray * (0.5 + 0.35 * (intake > 0 ? Math.sin(intake * Math.PI) : 0) + 0.15 * Math.sin(t * 9 + i * 2.1));
    sprays[i].m.visible = sk > 0.02;
    sprays[i].m.position.set(K.CYL_X[i] - 6, DECK - 30, 6);
    sprays[i].m.scale.set(0.9 + 0.5 * sk, 0.9 + 0.6 * sk, 0.9 + 0.5 * sk);
    sprays[i].mat.opacity = 0.95 * clamp01(sk);
  }
  // samozapłon i iskra
  lspi.visible = st.lspi > 0.01;
  if (lspi.visible) { lspi.position.set(X1, K.pistonCrownY(deg, 1) + 24, 0); lspi.scale.setScalar(0.5 + 0.9 * st.lspi); lspiMat.opacity = st.lspi; lspiMat.color.setRGB(2.6, 0.9, 0.2); }
  spark.visible = st.spark > 0.01;
  if (spark.visible) { spark.position.set(X1, DECK + 14, 0); spark.scale.setScalar(0.6 + st.spark); sparkMat.opacity = st.spark; }
  // olej w rozrządzie
  oilBox.visible = st.oil > 0.01;
  if (oilBox.visible) { const h = 20 + 560 * st.oil; oilBox.scale.y = h; oilBox.position.y = -110 + h / 2; }
  beltMesh.material.opacity = 1 - st.beltFade;
  beltMesh.visible = st.beltFade < 0.99;
  strainer.visible = st.strainer > 0;
  flakes.forEach((f, i) => {
    const on = st.flakes >= 0;
    f.m.visible = on;
    if (!on) return;
    const p = clamp01((st.flakes - f.d) / (1 - f.d * 0.8));
    const e = p * p * (3 - 2 * p);
    f.m.position.lerpVectors(f.s, f.e, e);
    f.m.position.x += Math.sin(t * 2 + i) * 14 * (1 - e) * p;
    f.m.position.z += Math.cos(t * 1.7 + i) * 14 * (1 - e) * p;
    f.m.rotation.set(t * (1 + f.sp) * (1 - e) + i, t * 0.7 * (1 - e) + i * 2, i);
  });
  E.root.position.y = st.shake ? st.shake * 5 * Math.sin(t * 61) : 0;
  E.root.updateMatrixWorld(true);
  // S54
  ES.update(KS.state(deg), { cut: 0, explode: st.sEx });
  setGlow(sGlow, st.sGlow, AMBER);
  ES.root.scale.setScalar(st.sScale);
  ES.root.updateMatrixWorld(true);
  // V6
  E6.updateCrank(deg);
  E6.explodeGroups.forEach((g, i) => { g.position.copy(v6Base[i]).addScaledVector(g.userData.explode, st.v6Ex); });
  E6.root.updateMatrixWorld(true);
  // osobna turbina
  bigT.setState(t * 40 * st.bigSpin, st.bigHeat);
}

function states(t, name, panel) {
  const s = blankS();
  let shk = 0, base = new THREE.Vector3(0, 0, 0);
  switch (name) {
    case "hook": case "outro": {
      s.fire = 1; s.pow = 1;
      s.ex = name === "hook" ? 0.7 * (1 - easeOut(win(t, 0, 1.4))) : 0.7 + 0.06 * (1 - win(t, 168.3, D));
      const up = name === "hook" ? easeOut(win(t, 1.68, 1.95)) : 0;
      s.gTurbo = 0.1 + 0.9 * up;
      break;
    }
    case "ty": s.gTurbo = 1.1; s.turboSpin = 1.6; s.fire = 1; break;
    case "promise": s.ex = 1; break;
    case "splitSize":
      if (panel === "A") { base = SP; s.sGlow = 0.15 * bump(t, 10.82, 11.8); }
      else { s.gTurbo = 0.8 * easeOut(win(t, 14.68, 15.0)); s.gBlock = 0.2 * bump(t, 13.69, 14.5); }
      break;
    case "plusy": {
      const k = Math.max(bump(t, 15.52, 16.1), bump(t, 16.56, 17.1), bump(t, 17.35, 17.9));
      s.gBlock = 0.1 * k; s.blockCol = GREEN;
      break;
    }
    case "noBoost": s.turboSpin = 0.08; s.gTurbo = 0; break;
    case "lazyTurbo": base = TP; s.bigSpin = 0.12; s.bigHeat = 0; break;
    case "calm": s.turboSpin = 0.1; break;
    case "load": s.gTurbo = 0.3 + 0.8 * easeIO(win(t, 41.5, 44.4)); s.turboSpin = 1.6; s.fire = 1; s.pow = 1; break;
    case "turboHot": base = TP; s.bigSpin = 3.2; s.bigHeat = 1; break;
    case "fuel": case "rc2":
      s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1;
      s.spray = name === "rc2" ? 1.3 : 0.6 + 0.8 * easeOut(win(t, 48.19, 48.5));
      s.gFuel = name === "rc2" ? 1 : 1.2 * easeOut(win(t, 48.19, 48.5));
      break;
    case "cool": {
      s.section = 1; s.noInd = 1; s.fire = 1; s.spray = 1;
      const c = easeIO(win(t, 51.71, 52.9));
      for (let i = 0; i < NC; i++) { s.gP[i] = 1.4 * (1 - c) + 0.9 * c; s.gCol[i] = (new THREE.Color()).lerpColors(HOT, ICE, c); }
      break;
    }
    case "splitGap":
      if (panel === "A") { s.turboSpin = 0.1; s.gBlock = 0.2 * bump(t, 58.42, 59.2); s.blockCol = GREEN; }
      else { s.gTurbo = 1.1; s.turboSpin = 1.6; s.fire = 1; s.pow = 1; s.gMan = 0.4; }
      break;
    case "notAll": s.fire = 1; break;
    case "pressure": s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1; shk = 0.25 * easeOut(win(t, 66.78, 67.0)); break;
    case "lowRpm": s.section = 1; s.noInd = 1; s.pow = 1; break;
    case "lspi": case "rc3": {
      s.section = 1; s.noInd = 1;
      const tb = name === "rc3" ? 170.7 : 72.37;
      s.lspi = t >= tb ? Math.max(0, 1 - (t - tb) / 0.9) * 1.2 : 0;
      s.gP[0] = t >= tb ? 1.4 * Math.max(0.3, 1 - (t - tb) / 1.2) : 0; s.gCol[0] = HOT;
      s.spark = name === "lspi" && t >= 74.06 ? Math.max(0, 1 - (t - 74.06) / 0.5) : 0;
      shk = t >= tb ? Math.max(0, 1 - (t - tb) / 0.6) : 0;
      break;
    }
    case "ring": {
      s.section = 1; s.noInd = 1;
      s.lspi = t >= 75.22 ? Math.max(0, 1 - (t - 75.22) / 0.6) : 0;
      s.ringOff = easeOut(win(t, 76.46, 77.0));
      s.shatter = easeOut(win(t, 77.3, 77.8));
      s.gP[0] = 1.2 * easeOut(win(t, 75.22, 75.5)); s.gCol[0] = HOT;
      shk = Math.max(t >= 75.22 ? Math.max(0, 1 - (t - 75.22) / 0.5) : 0, t >= 77.3 ? Math.max(0, 1 - (t - 77.3) / 0.5) : 0);
      break;
    }
    case "belt": s.noInd = 1; break;
    case "oilFill": s.noInd = 1; s.oil = easeIO(win(t, 87.36, 88.9)); break;
    case "quiet": s.noInd = 1; s.oil = 1; break;
    case "decay": case "rc4": {
      s.noInd = 1; s.oil = 1;
      const t0 = name === "rc4" ? 171.55 - 1.4 : 93.18;
      s.beltFade = easeIO(win(t, t0, t0 + 1.2));
      s.flakes = t >= t0 ? clamp01((t - t0) / 4.5) * 0.55 : -1;
      break;
    }
    case "sitko": {
      s.noInd = 1; s.oil = 0; s.beltFade = 1; s.section = 1; s.noPan = 1; s.strainer = 1;
      s.flakes = 0.55 + 0.45 * easeIO(win(t, 94.7, 96.5));
      const dry = easeOut(win(t, 96.98, 97.3));
      for (let i = 0; i < K.MAIN_X.length; i++) s.mains[i] = dry * (0.7 + 0.3 * Math.sin(t * 9 + i));
      s.gCrank = 0.3 * dry;
      break;
    }
    case "honest": case "city": s.gBlock = 0.07; s.blockCol = GREEN; s.turboSpin = 0.3; break;
    case "promised": break;
    case "smoke": {
      s.section = 1; s.fire = 1; s.pow = 1; s.spray = 1.2; s.gFuel = 1;
      s.gExh = 0.3 + 0.9 * easeOut(win(t, 129.7, 130.2)); s.gMan = s.gExh; s.gTurbo = 0.9;
      break;
    }
    case "cant": s.gBlock = 0.3 * easeIO(win(t, 136.2, 136.9)); s.blockCol = HOT; s.gTurbo = 1.0; s.fire = 1; s.pow = 1; break;
    case "whatDid": break;
    case "naBig": base = SP; s.sGlow = 0.12 * bump(t, 148.19, 149.4); break;
    case "bigger": base = SP; s.sScale = 0.7 + 0.3 * easeIO(win(t, 153.45, 154.4)); s.sGlow = 0.1 * bump(t, 154.17, 155.0); break;
    case "pickA": s.gTurbo = 0.9 * easeOut(win(t, 156.38, 156.7)); s.fire = 1; break;
    case "pickB": base = SP; s.sGlow = 0.06 * bump(t, 157.27, 158.4); break;
    case "yt1": base = VP; break;
    case "yt2": base = VP; s.v6Ex = 0.9 * easeIO(win(t, 163.11, 164.3)); break;
    case "yt3": base = VP; s.v6Ex = 0.9; break;
  }
  return { s, shk, base };
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
let projCam = camera;
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
const wp = (x, y, z, frame = E.root) => { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); };
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
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

// etykiety z linią wiodącą
const wv = (x, y, z) => () => { _w.set(x, y, z); return E.root.localToWorld(_w.clone()); };
const objW = (o, x = 0, y = 0, z = 0) => () => o.localToWorld(new THREE.Vector3(x, y, z));
const TAGS = [
  { t0: 3.4, t1: 4.71, text: "Turbina", a: objW(turbo.group), off: [-180, -330], c: "hot" },
  { t0: 31.9, t1: 33.34, text: "Ledwo się kręci", a: () => TP.clone().add(new THREE.Vector3(150, 0, 0)), off: [60, -380], c: "oil" },
  { t0: 48.19, t1: 49.58, text: "Dodatkowe paliwo", a: wv(K.CYL_X[1], DECK - 40, 20), off: [120, -330], c: "hot" },
  { t0: 83.31, t1: 86.37, text: "Pasek rozrządu", a: () => beltPts[Math.floor(beltPts.length * 0.3)].clone(), off: [170, -260], c: "oil" },
  { t0: 95.3, t1: 98.65, text: "Sitko pompy oleju", a: () => STRAIN.clone(), off: [120, 260], c: "hot" },
  { t0: 147.62, t1: 150.21, text: "Bez turbo", a: () => SP.clone().add(new THREE.Vector3(0, 200, 0)), off: [-120, -330], c: "ok" },
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
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.3)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    projCam = camera;
    const p = project(tg.a());
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(190, Math.min(y > 1000 ? 700 : 880, x));
    y = Math.max(560, Math.min(1400, y));
    if (y > 840 && y < 1040) y = y < 940 ? 840 : 1040;
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
// manometr doładowania
{
  const g = $("gTicks");
  for (let i = 0; i <= 6; i++) {
    const a = (-210 + 240 * (i / 6)) * D2R;
    mkEl("line", { x1: f1(220 + Math.cos(a) * 100), y1: f1(1300 + Math.sin(a) * 100), x2: f1(220 + Math.cos(a) * 118), y2: f1(1300 + Math.sin(a) * 118), stroke: "rgba(238,242,247,0.7)", "stroke-width": 4 }, g);
  }
}
const arcD = (a0, a1, r) => {
  const p0 = [220 + Math.cos(a0 * D2R) * r, 1300 + Math.sin(a0 * D2R) * r], p1 = [220 + Math.cos(a1 * D2R) * r, 1300 + Math.sin(a1 * D2R) * r];
  return `M ${f1(p0[0])} ${f1(p0[1])} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}`;
};
function drawGauge(bar) {
  const a = -210 + 240 * clamp01(bar / 1.8);
  $("gNeedle").setAttribute("x2", f1(220 + Math.cos(a * D2R) * 108)); $("gNeedle").setAttribute("y2", f1(1300 + Math.sin(a * D2R) * 108));
  $("gArc").setAttribute("d", arcD(-210, Math.max(-209, a), 124));
  $("gArc").setAttribute("stroke", bar > 1.0 ? "#ff6a4d" : "#f5aa3c");
  $("gVal").textContent = Math.max(0, bar).toFixed(1).replace(".", ",") + " BAR";
}

/* ================= górny blok ================= */
const TOPS = [
  [4.75, "Na końcu zobaczysz", "Dlaczego producenci <span class=\"hot\">się wycofują</span>"],
  [15.3, "Downsizing", "Mniej <em>wszystkiego</em>"],
  [28.5, "W teście", "Turbo <em>śpi</em>"],
  [31.9, "Turbina", "Ledwo się <em>kręci</em>"],
  [33.4, "Jak zwykły litr", "Pali <span class=\"ok\">mało</span>"],
  [41.0, "Na drodze", "Litr robi robotę <span class=\"hot\">dwóch</span>"],
  [44.2, "Turbo dmucha", "<span class=\"hot\">Cały czas</span>"],
  [46.05, "Pod obciążeniem", "Dodatkowe <span class=\"hot\">paliwo</span>"],
  [49.6, "Nie na moc", "Tylko na <span class=\"ice\">chłodzenie</span>"],
  [62.8, "Ale", "To nie <em>wszystko</em>"],
  [64.5, "W cylindrze", "Ciśnienie jak w <em>aucie sportowym</em>"],
  [68.7, "Niskie obroty", "Gaz <span class=\"hot\">w podłogę</span>"],
  [71.35, "Zanim przeskoczy iskra", "Mieszanka <span class=\"hot\">zapala się sama</span>"],
  [74.75, "Jeden strzał", "Pierścień <span class=\"hot\">i tłok</span>"],
  [83.0, "Do tego", "<em>Rozrząd</em>"],
  [87.36, "Żeby urwać tarcia", "Pasek <em>w oleju</em>"],
  [90.85, "Gorący olej", "Pasek <span class=\"hot\">się rozkłada</span>"],
  [94.75, "Kawałki", "Zatykają <span class=\"hot\">sitko</span>"],
  [96.98, "Silnik", "<span class=\"hot\">Bez smarowania</span>"],
  [105.75, "Uczciwie", "Nie jest zły <em>wszędzie</em>"],
  [108.4, "Tu ma sens", "<span class=\"ok\">Miasto, lekkie auto</span>"],
  [118.2, "A teraz", "<em>Obiecane</em>"],
  [126.85, "Na prawdziwej drodze", "Za dużo <span class=\"hot\">spalin</span>"],
  [135.85, "Mały silnik", "<span class=\"hot\">Tego nie udźwignie</span>"],
  [137.72, "Więc", "Co zrobili <em>producenci</em>?"],
  [145.25, "Mazda", "Dalej <em>bez turbo</em>"],
  [153.5, "Czyli po prostu", "<em>Większy silnik</em>"],
];
const TOP_OFF = [[0, 4.71], [8.47, 15.28], [18.05, 28.45], [36.02, 40.98], [53.46, 62.77], [78.49, 82.97], [98.65, 105.7], [111.65, 118.15], [119.49, 126.8], [131.09, 135.81], [139.41, 145.2], [150.21, 153.45], [155.29, 168.3], [168.3, D + 1]];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  const off = TOP_OFF.some(([a, b]) => inR(t, a, b));
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.3));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= napisy słowo w słowo ================= */
const capLine = $("capLine");
let capCur = -1;
let capSpans = [];
function drawCaps(t) {
  // po "Link w bio" obraz wraca już do klatki 0, więc napis też
  if (t >= 168.3) t = 0;
  let gi = -1;
  for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i].t0 && t < CAPS[i].t1) { gi = i; break; }
  if (gi !== capCur) {
    capCur = gi;
    capLine.innerHTML = "";
    capSpans = gi < 0 ? [] : CAPS[gi].w.map(([w]) => { const s = document.createElement("span"); s.textContent = w; capLine.appendChild(s); return s; });
  }
  if (gi < 0) return;
  const g = CAPS[gi];
  let active = -1;
  g.w.forEach(([, ts], i) => { if (t >= ts) active = i; });
  capSpans.forEach((s, i) => {
    const ts = g.w[i][1];
    const k = gi === 0 ? 1 : easeOut(win(t, ts - 0.06, ts + 0.1));
    const shown = gi === 0 ? true : t >= ts - 0.06;
    s.style.opacity = shown ? 1 : 0;
    s.classList.toggle("on", i === active);
    const sc = i === active ? 1 + 0.05 * (1 - easeIO(win(t, ts, ts + 0.3))) : 1;
    s.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
  });
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const rowsOf = (id) => [...$(id).querySelectorAll(".rw")].map((el) => ({ el, t: +el.dataset.t, st: +(el.dataset.st || 0), stEl: el.querySelector(".st") }));
const caseRows = rowsOf("gCases"), rightRows = rowsOf("gRight");
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.16)); r.stEl.style.opacity = k; r.stEl.style.transform = "scale(" + (1 + (1 - k) * 0.6).toFixed(3) + ")"; }
  });
}
function stampEl(el, on, at, t) {
  if (!on) { el.style.opacity = 0; return; }
  const k = easeOut(win(t, at, at + 0.3));
  el.style.opacity = k;
  el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.15 - 0.15 * k).toFixed(3) + ")";
}
// tytuł: litery spadają
{
  const w = $("ttlWord");
  "DOWNSIZING".split("").forEach((c) => { const s = document.createElement("span"); s.textContent = c; w.appendChild(s); });
  const g = $("ttlStars");
  for (let i = 0; i < 7; i++) {
    const cx = 120 + hash(i) * 720, cy = 380 + hash(i + 3) * 170, r = 18 + hash(i + 5) * 22;
    let d = "";
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr = k % 2 ? r * 0.35 : r; d += (k ? " L " : "M ") + f1(cx + Math.cos(a) * rr) + " " + f1(cy + Math.sin(a) * rr); }
    mkEl("path", { d: d + " Z", fill: "#ffd23a", opacity: 0, "data-i": i }, g);
  }
  const e = $("ttlEng");
  mkEl("rect", { x: 330, y: 1100, width: 320, height: 190, rx: 20, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 4 }, e);
  for (let i = 0; i < 3; i++) mkEl("circle", { cx: 400 + i * 90, cy: 1195, r: 34, fill: "#1a222c", stroke: "#f5aa3c", "stroke-width": 5 }, e);
  mkEl("circle", { cx: 720, cy: 1195, r: 60, fill: "rgba(255,106,77,0.15)", stroke: "#ff6a4d", "stroke-width": 5 }, e);
  mkEl("path", { id: "ttlRot", fill: "none", stroke: "#ff6a4d", "stroke-width": 6 }, e);
  const tx = mkEl("text", { x: 490, y: 1345, "text-anchor": "middle", style: "font-size:30px" }, e); tx.textContent = "3 CYLINDRY + TURBO";
}
// kartka z plusami i hamownia
{
  const g = $("paperG");
  mkEl("rect", { x: 130, y: 470, width: 680, height: 380, rx: 10, fill: "#ebe6da", transform: "rotate(-2 470 660)" }, g);
  ["SPALANIE", "EMISJA CO2", "PODATEK"].forEach((l, i) => {
    const y = 560 + i * 100;
    const t1 = mkEl("text", { x: 180, y, style: "font-family:'IBM Plex Mono',monospace;font-size:40px;font-weight:600;fill:#232a33;letter-spacing:0.08em", transform: "rotate(-2 470 660)" }, g); t1.textContent = l;
    const t2 = mkEl("text", { x: 560, y, style: "font-family:'IBM Plex Mono',monospace;font-size:40px;font-weight:600;fill:#232a33", transform: "rotate(-2 470 660)" }, g); t2.textContent = "NISKO";
    mkEl("path", { d: `M 720 ${y - 14} l 16 18 l 34 -40`, fill: "none", stroke: "#1f9a4c", "stroke-width": 10, "stroke-linecap": "round", "data-ck": i, transform: "rotate(-2 470 660)" }, g);
  });
  const d = $("dynoG");
  mkEl("rect", { x: 140, y: 1300, width: 660, height: 30, fill: "#2a323c" }, d);
  mkEl("circle", { id: "dyR1", cx: 300, cy: 1300, r: 34, fill: "#3a444f", stroke: "#8a95a2", "stroke-width": 4 }, d);
  mkEl("circle", { id: "dyR2", cx: 640, cy: 1300, r: 34, fill: "#3a444f", stroke: "#8a95a2", "stroke-width": 4 }, d);
  mkEl("path", { d: "M 180 1250 L 180 1190 Q 190 1150 260 1140 L 380 1120 Q 450 1060 540 1055 L 660 1055 Q 730 1065 770 1120 L 790 1150 Q 800 1170 800 1250 Z", fill: "rgba(150,165,182,0.14)", stroke: "#b6c1cf", "stroke-width": 4 }, d);
  mkEl("path", { id: "dyS1", fill: "none", stroke: "#f5aa3c", "stroke-width": 5 }, d);
  mkEl("path", { id: "dyS2", fill: "none", stroke: "#f5aa3c", "stroke-width": 5 }, d);
}
// NEDC: miasto (4 x ECE) i trasa
const ECE = [[0, 0], [11, 0], [15, 15], [23, 15], [28, 0], [49, 0], [61, 32], [85, 32], [96, 0], [117, 0], [143, 50], [155, 50], [163, 35], [176, 35], [188, 0], [195, 0]];
const EUDC = [[0, 0], [20, 0], [41, 70], [91, 70], [99, 50], [168, 50], [181, 70], [231, 70], [266, 100], [296, 100], [330, 120], [340, 120], [362, 0], [400, 0]];
const NEDC = [];
for (let c = 0; c < 4; c++) ECE.forEach(([s, v]) => NEDC.push([c * 195 + s, v]));
EUDC.forEach(([s, v]) => NEDC.push([780 + s, v]));
const nedcV = (s) => { for (let i = 0; i < NEDC.length - 1; i++) if (s >= NEDC[i][0] && s <= NEDC[i + 1][0]) { const [a, va] = NEDC[i], [b, vb] = NEDC[i + 1]; return b > a ? lerp(va, vb, (s - a) / (b - a)) : vb; } return 0; };
const nedcS = (t) => t < 26.2 ? 780 * win(t, 22.2, 26.2) : 780 + 400 * win(t, 26.2, 28.2);
const NX = (s) => 90 + (s / 1180) * 760, NY = (v) => 1380 - (v / 120) * 340;
// katalog, paragon, olej, gwarancja, SUV, droga, lambda
{
  const g = $("catG");
  mkEl("rect", { x: 150, y: 480, width: 640, height: 380, rx: 16, fill: "#f2efe8" }, g);
  mkEl("rect", { x: 150, y: 480, width: 640, height: 70, rx: 16, fill: "#1f2833" }, g);
  const a = mkEl("text", { x: 180, y: 527, style: "font-size:30px;fill:#eef2f7;letter-spacing:0.2em" }, g); a.textContent = "DANE TECHNICZNE";
  const b = mkEl("text", { x: 180, y: 620, style: "font-family:'IBM Plex Mono',monospace;font-size:32px;fill:#4a5663;letter-spacing:0.08em" }, g); b.textContent = "ŚREDNIE SPALANIE";
  const c = mkEl("text", { id: "catV", x: 180, y: 780, style: "font-family:'IBM Plex Mono',monospace;font-size:150px;font-weight:600;fill:#1f9a4c" }, g); c.textContent = "5,0";
  const d = mkEl("text", { x: 500, y: 780, style: "font-family:'IBM Plex Mono',monospace;font-size:38px;fill:#4a5663" }, g); d.textContent = "l/100 km";
}
{
  const g = $("rcpG");
  mkEl("path", { id: "rcpP", d: "M 250 0 L 830 0 L 830 360 L 800 380 L 770 360 L 740 380 L 710 360 L 680 380 L 650 360 L 620 380 L 590 360 L 560 380 L 530 360 L 500 380 L 470 360 L 440 380 L 410 360 L 380 380 L 350 360 L 320 380 L 290 360 L 250 380 Z", fill: "#efece4" }, g);
  const lines = [["PALIWO NA JAZDĘ", "OK", "#232a33"], ["PALIWO NA CHŁODZENIE", "+", "#d13a24"], ["RAZEM", "WIĘCEJ", "#d13a24"]];
  lines.forEach(([l, v, c], i) => {
    const y = 90 + i * 100;
    const a = mkEl("text", { x: 290, y, style: `font-family:'IBM Plex Mono',monospace;font-size:34px;font-weight:600;fill:${c};letter-spacing:0.04em`, "data-rl": i }, g); a.textContent = l;
    const b = mkEl("text", { x: 790, y, "text-anchor": "end", style: `font-family:'IBM Plex Mono',monospace;font-size:34px;font-weight:600;fill:${c}`, "data-rl": i }, g); b.textContent = v;
  });
  mkEl("line", { x1: 290, y1: 240, x2: 790, y2: 240, stroke: "#232a33", "stroke-width": 3, "stroke-dasharray": "10 8" }, g);
}
{
  const g = $("oilG");
  const bottle = (x, lab, id) => {
    const b = mkEl("g", { id }, g);
    mkEl("path", { d: `M ${x} 520 L ${x + 110} 520 L ${x + 110} 480 L ${x + 170} 480 L ${x + 170} 520 Q ${x + 240} 530 ${x + 240} 600 L ${x + 240} 840 Q ${x + 240} 860 ${x + 220} 860 L ${x + 20} 860 Q ${x} 860 ${x} 840 Z`, fill: "#1f2833", stroke: "#b6c1cf", "stroke-width": 4 }, b);
    mkEl("rect", { x: x + 30, y: 620, width: 180, height: 150, rx: 10, fill: "#f5aa3c" }, b);
    const t = mkEl("text", { x: x + 120, y: 715, "text-anchor": "middle", style: "font-size:52px;font-weight:600;fill:#1a1206;font-family:Oswald,sans-serif" }, b); t.textContent = lab;
    return b;
  };
  bottle(90, "SN", "oilOld");
  mkEl("path", { id: "oilX", d: "M 100 530 L 320 850 M 320 530 L 100 850", stroke: "#ff3b2a", "stroke-width": 18, "stroke-linecap": "round", fill: "none" }, g);
  bottle(370, "SN+", "oilN1");
  bottle(650, "SP", "oilN2");
  const a = mkEl("text", { id: "oilY1", x: 490, y: 1100, "text-anchor": "middle", style: "font-size:44px;fill:#eef2f7" }, g); a.textContent = "2018";
  const b = mkEl("text", { id: "oilY2", x: 770, y: 1100, "text-anchor": "middle", style: "font-size:44px;fill:#eef2f7" }, g); b.textContent = "2020";
  const c = mkEl("text", { id: "oilWhy", x: 90, y: 1250, style: "font-size:34px;fill:#f5aa3c" }, g); c.textContent = "PRZECIW SAMOZAPŁONOWI";
}
{
  const g = $("casesG");
  const t = mkEl("text", { id: "casesT", x: 90, y: 1150, style: "font-size:34px;fill:#ff6a4d" }, g); t.textContent = "PASEK SIĘ ROZKŁADA  >  SITKO  >  BRAK OLEJU";
}
{
  const g = $("warG");
  mkEl("rect", { x: 170, y: 470, width: 600, height: 420, rx: 12, fill: "#efece4", transform: "rotate(2 470 680)" }, g);
  const a = mkEl("text", { x: 470, y: 560, "text-anchor": "middle", style: "font-size:64px;font-weight:600;fill:#1f2833;font-family:Oswald,sans-serif", transform: "rotate(2 470 680)" }, g); a.textContent = "GWARANCJA";
  for (let i = 0; i < 5; i++) mkEl("rect", { x: 220, y: 610 + i * 50, width: 500 - hash(i) * 160, height: 16, rx: 8, fill: "#c9c3b5", transform: "rotate(2 470 680)" }, g);
  const b = mkEl("text", { x: 470, y: 1110, "text-anchor": "middle", style: "font-size:38px;fill:#eef2f7" }, g); b.textContent = "SILNIKI 1.2 PURETECH";
}
{
  const g0 = $("heavyG");
  const g = mkEl("g", { transform: "translate(0 80)" }, g0);
  mkEl("rect", { id: "hvEng", x: 110, y: 1180, width: 150, height: 110, rx: 14, fill: "rgba(245,170,60,0.2)", stroke: "#f5aa3c", "stroke-width": 5 }, g);
  const t = mkEl("text", { x: 185, y: 1250, "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:#eef2f7" }, g); t.textContent = "1.0";
  mkEl("path", { id: "hvRope", fill: "none", stroke: "#b6c1cf", "stroke-width": 6 }, g);
  const suv = mkEl("g", { id: "hvSuv" }, g);
  mkEl("path", { d: "M 420 1290 L 420 1150 Q 430 1100 490 1090 L 560 1030 Q 580 1010 620 1010 L 790 1010 Q 830 1012 840 1060 L 850 1290 Z", fill: "rgba(150,165,182,0.16)", stroke: "#b6c1cf", "stroke-width": 5 }, suv);
  mkEl("circle", { cx: 500, cy: 1300, r: 46, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, suv);
  mkEl("circle", { cx: 770, cy: 1300, r: 46, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, suv);
  for (let i = 0; i < 3; i++) mkEl("rect", { "data-bag": i, x: 570 + i * 70, y: 962, width: 58, height: 48, rx: 8, fill: "#7a5a36", stroke: "#c9a36a", "stroke-width": 4 }, suv);
  mkEl("path", { id: "hvArrow", fill: "none", stroke: "#ff6a4d", "stroke-width": 12, "stroke-linecap": "round" }, g);
}
{
  const g = $("roadG");
  mkEl("rect", { x: 0, y: 1250, width: 1080, height: 170, fill: "#1b2027" }, g);
  for (let i = 0; i < 8; i++) mkEl("rect", { "data-lane": i, y: 1330, width: 90, height: 12, fill: "#eef2f7" }, g);
  const car = mkEl("g", { id: "rdCar" }, g);
  mkEl("path", { d: "M 330 1240 L 330 1180 Q 336 1150 380 1142 L 460 1128 Q 520 1080 590 1076 L 700 1076 Q 760 1082 790 1130 L 820 1150 Q 830 1162 830 1240 Z", fill: "rgba(150,165,182,0.16)", stroke: "#b6c1cf", "stroke-width": 5 }, car);
  mkEl("circle", { id: "rdW1", cx: 420, cy: 1250, r: 40, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, car);
  mkEl("circle", { id: "rdW2", cx: 730, cy: 1250, r: 40, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, car);
  const pems = mkEl("g", { id: "rdPems" }, g);
  mkEl("rect", { x: 200, y: 1150, width: 110, height: 80, rx: 8, fill: "#f5aa3c", stroke: "#fff3d6", "stroke-width": 3 }, pems);
  const pt = mkEl("text", { x: 255, y: 1200, "text-anchor": "middle", style: "font-size:22px;font-weight:600;fill:#1a1206" }, pems); pt.textContent = "POMIAR";
  mkEl("path", { d: "M 310 1200 L 332 1200", stroke: "#fff3d6", "stroke-width": 8 }, pems);
  mkEl("path", { id: "rdHose", fill: "none", stroke: "#b6c1cf", "stroke-width": 5 }, g);
}
{
  const g = $("lamG");
  const cx = 470, cy = 1330, r = 300;
  const arc = (a0, a1, col, w) => { const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]; mkEl("path", { d: `M ${f1(p0[0])} ${f1(p0[1])} A ${r} ${r} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`, fill: "none", stroke: col, "stroke-width": w }, g); };
  arc(Math.PI, Math.PI * 1.44, "#ff6a4d", 34); arc(Math.PI * 1.44, Math.PI * 1.56, "#86dba1", 34); arc(Math.PI * 1.56, Math.PI * 2, "#7cc4ff", 34);
  const a = mkEl("text", { x: cx - r, y: cy + 60, style: "font-size:30px;fill:#ff6a4d" }, g); a.textContent = "BOGATA";
  const b = mkEl("text", { x: cx + r, y: cy + 60, "text-anchor": "end", style: "font-size:30px;fill:#7cc4ff" }, g); b.textContent = "UBOGA";
  mkEl("line", { id: "lamN", x1: cx, y1: cy, x2: cx, y2: cy - 270, stroke: "#eef2f7", "stroke-width": 8, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx, cy, r: 18, fill: "#eef2f7" }, g);
  const v = mkEl("text", { id: "lamV", x: cx, y: 700, "text-anchor": "middle", style: "font-family:'IBM Plex Mono',monospace;font-size:130px;font-weight:600;fill:#86dba1" }, g); v.textContent = "λ = 1,00";
  const w2 = mkEl("text", { id: "lamW", x: cx, y: 800, "text-anchor": "middle", style: "font-size:40px;fill:#eef2f7" }, g); w2.textContent = "PRAWIE ZAWSZE";
}
{
  const g = $("rightG");
  const a = mkEl("text", { id: "rightM", x: 90, y: 1120, style: "font-size:40px;fill:#86dba1" }, g); a.textContent = "POJEMNOŚĆ ZNOWU ROŚNIE";
}
const gapData = [[2001, 8], [2002, 9], [2003, 10], [2004, 11], [2005, 12], [2006, 14], [2007, 15], [2008, 17], [2009, 19], [2010, 21], [2011, 24], [2012, 27], [2013, 31], [2014, 36], [2015, 40], [2016, 42]];
const GX = (y) => 90 + ((y - 2001) / 15) * 760, GY = (p) => 1380 - (p / 45) * 320;

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gTitle") {
    [...$("ttlWord").children].forEach((s, i) => {
      const k = easeOut(win(t, 8.5 + i * 0.05, 8.95 + i * 0.05));
      s.style.opacity = clamp01(k * 3);
      s.style.transform = "translateY(" + ((1 - k) * -160).toFixed(1) + "px)";
      s.style.color = t >= 9.52 ? "#86dba1" : "";
    });
    pop($("ttlSub"), t, 9.1, 0.24, 30);
    [...$("ttlStars").children].forEach((p, i) => {
      const k = bump(t, 9.52 + i * 0.07, 10.2 + i * 0.07);
      p.setAttribute("opacity", k);
      const cx = 120 + hash(i) * 720, cy = 380 + hash(i + 3) * 170;
      p.setAttribute("transform", `rotate(${(t * 120 + i * 40).toFixed(1)} ${f1(cx)} ${f1(cy)}) translate(${f1(cx)} ${f1(cy)}) scale(${(0.4 + k).toFixed(2)}) translate(${f1(-cx)} ${f1(-cy)})`);
    });
    $("ttlEng").setAttribute("opacity", easeOut(win(t, 8.6, 8.9)));
    const a = t * 14;
    $("ttlRot").setAttribute("d", `M 720 1195 L ${f1(720 + Math.cos(a) * 50)} ${f1(1195 + Math.sin(a) * 50)} M 720 1195 L ${f1(720 + Math.cos(a + 2.1) * 50)} ${f1(1195 + Math.sin(a + 2.1) * 50)} M 720 1195 L ${f1(720 + Math.cos(a + 4.2) * 50)} ${f1(1195 + Math.sin(a + 4.2) * 50)}`);
  } else if (id === "gPaper") {
    $("paperG").setAttribute("transform", `translate(0 ${((1 - easeOut(win(t, 18.05, 18.4))) * 400).toFixed(1)})`);
    [...$("paperG").querySelectorAll("[data-ck]")].forEach((p) => { const i = +p.dataset.ck; dash(p, easeOut(win(t, 18.2 + i * 0.25, 18.4 + i * 0.25)), 90); });
    stampEl($("stLab"), t >= 20.86, 20.86, t);
    const dk = easeOut(win(t, 20.86, 21.2));
    $("dynoG").setAttribute("opacity", dk);
    $("dynoG").setAttribute("transform", `translate(0 ${((1 - dk) * 120).toFixed(1)})`);
    const a = t * 10;
    [["dyS1", 300], ["dyS2", 640]].forEach(([sid, cx]) => $(sid).setAttribute("d", `M ${cx} 1300 L ${f1(cx + Math.cos(a) * 30)} ${f1(1300 + Math.sin(a) * 30)} M ${cx} 1300 L ${f1(cx - Math.cos(a) * 30)} ${f1(1300 - Math.sin(a) * 30)}`));
  } else if (id === "gNedc") {
    const recap = t > 168;
    const s = recap ? 1180 : nedcS(t);
    let d = "";
    for (let q = 0; q <= s; q += 4) d += (d ? " L " : "M ") + f1(NX(q)) + " " + f1(NY(nedcV(q)));
    d += " L " + f1(NX(s)) + " " + f1(NY(nedcV(s)));
    $("nedcLine").setAttribute("d", d);
    $("nedcFill").setAttribute("d", d + ` L ${f1(NX(s))} 1380 L 90 1380 Z`);
    $("nedcDot").setAttribute("cx", f1(NX(s))); $("nedcDot").setAttribute("cy", f1(NY(nedcV(s))));
    const v = recap ? 0 : Math.round(nedcV(s));
    $("nedcV").textContent = String(v);
    $("nedcV").style.color = v >= 100 ? "#ff6a4d" : "#f5aa3c";
    const hit = Math.max(bump(t, 25.6, 26.0), bump(t, 27.45, 27.9));
    $("nedcV").style.transform = "scale(" + (1 + 0.05 * hit).toFixed(3) + ")";
    $("nedcV").style.transformOrigin = "0 60%";
  } else if (id === "gCatalog") {
    const k = easeOut(win(t, 36.27, 36.6));
    $("catG").setAttribute("transform", `translate(0 ${((1 - easeOut(win(t, 36.02, 36.35))) * -500).toFixed(1)})`);
    $("catV").setAttribute("opacity", clamp01(k * 2));
    stampEl($("stKat"), t >= 37.03, 37.03, t);
  } else if (id === "gReceipt") {
    const k = easeOut(win(t, 53.46, 53.9));
    $("rcpG").setAttribute("transform", `translate(-60 ${f1(900 * k - 420)})`);
    [...$("rcpG").querySelectorAll("[data-rl]")].forEach((e) => { const i = +e.dataset.rl; e.setAttribute("opacity", easeOut(win(t, 53.6 + i * 0.3, 53.8 + i * 0.3))); });
  } else if (id === "gGap") {
    const k = easeIO(win(t, 60.4, 61.82));
    const yEnd = 2001 + 15 * k;
    let d = "";
    for (let i = 0; i < gapData.length; i++) {
      const [y, p] = gapData[i];
      if (y > yEnd) { const [y0, p0] = gapData[i - 1]; const f = (yEnd - y0) / (y - y0); d += " L " + f1(GX(yEnd)) + " " + f1(GY(lerp(p0, p, f))); break; }
      d += (d ? " L " : "M ") + f1(GX(y)) + " " + f1(GY(p));
    }
    $("gapLine").setAttribute("d", d);
    $("gapFill").setAttribute("d", d + ` L ${f1(GX(yEnd))} 1380 L 90 1380 Z`);
    let pNow = 8;
    for (let i = 0; i < gapData.length - 1; i++) if (yEnd >= gapData[i][0]) pNow = lerp(gapData[i][1], gapData[i + 1][1], clamp01(yEnd - gapData[i][0]));
    $("gapDot").setAttribute("cx", f1(GX(yEnd))); $("gapDot").setAttribute("cy", f1(GY(pNow)));
    $("gapN").textContent = t >= 61.82 ? "40%+" : "+" + Math.round(pNow) + "%";
    $("gapN").style.transform = "scale(" + (1 + 0.05 * bump(t, 61.6, 62.6)).toFixed(3) + ")";
    $("gapN").style.transformOrigin = "0 60%";
  } else if (id === "gOil") {
    $("oilOld").setAttribute("opacity", easeOut(win(t, 78.5, 78.8)));
    dash($("oilX"), easeOut(win(t, 80.8, 81.1)), 800);
    [["oilN1", "oilY1", 81.31], ["oilN2", "oilY2", 81.71]].forEach(([b, y, at]) => {
      const k = easeOut(win(t, at, at + 0.3));
      $(b).setAttribute("opacity", clamp01(k * 2)); $(b).setAttribute("transform", `translate(0 ${f1((1 - k) * -200)})`);
      $(y).setAttribute("opacity", clamp01(k * 2));
    });
    $("oilWhy").setAttribute("opacity", easeOut(win(t, 82.0, 82.3)));
  } else if (id === "gCases") {
    drawRows(caseRows, t);
    $("casesT").setAttribute("opacity", easeOut(win(t, 101.0, 101.3)));
  } else if (id === "gWarranty") {
    $("warG").setAttribute("transform", `translate(0 ${f1((1 - easeOut(win(t, 102.81, 103.2))) * 500)})`);
    stampEl($("stWar"), t >= 104.28, 104.28, t);
  } else if (id === "gTorque") {
    const k = easeIO(win(t, 111.7, 112.6));
    let dn = "", dt = "";
    for (let i = 0; i <= 60 * k; i++) {
      const u = i / 60, x = 90 + u * 760, rpm = 1000 + u * 6000;
      const na = 120 + 170 * Math.sin(Math.min(1, (rpm - 1000) / 4500) * Math.PI / 2) - 30 * clamp01((rpm - 5500) / 1500);
      const tu = 90 + 250 * clamp01((rpm - 1000) / 700) - 60 * clamp01((rpm - 4500) / 2500);
      dn += (i ? " L " : "M ") + f1(x) + " " + f1(1380 - na);
      dt += (i ? " L " : "M ") + f1(x) + " " + f1(1380 - tu);
    }
    $("tqNa").setAttribute("d", dn); $("tqTu").setAttribute("d", dt);
    $("tqTuT").setAttribute("opacity", easeOut(win(t, 112.34, 112.6))); $("tqNaT").setAttribute("opacity", easeOut(win(t, 112.8, 113.0)));
  } else if (id === "gHeavy") {
    const sk = easeOut(win(t, 116.19, 116.6));
    $("hvSuv").setAttribute("transform", `translate(${f1((1 - sk) * 500)} 0)`);
    [...$("hvSuv").querySelectorAll("[data-bag]")].forEach((b) => { const i = +b.dataset.bag; const k = easeOut(win(t, 117.39 + i * 0.1, 117.6 + i * 0.1)); b.setAttribute("opacity", clamp01(k * 2)); b.setAttribute("transform", `translate(0 ${f1((1 - k) * -300)})`); });
    const strain = easeOut(win(t, 116.6, 117.2));
    const jig = strain * 6 * Math.sin(t * 40);
    $("hvEng").setAttribute("transform", `translate(${f1(jig)} 0)`);
    $("hvEng").setAttribute("fill", `rgba(255,${Math.round(170 - 110 * strain)},${Math.round(60 - 20 * strain)},${(0.2 + 0.3 * strain).toFixed(2)})`);
    $("hvRope").setAttribute("d", `M 260 1235 Q 340 ${f1(1235 + 20 * (1 - strain))} ${f1(420 + (1 - sk) * 500)} 1235`);
    $("hvArrow").setAttribute("d", `M 640 870 L 640 ${f1(870 + 90 * strain)} M 616 ${f1(846 + 90 * strain)} L 640 ${f1(870 + 90 * strain)} L 664 ${f1(846 + 90 * strain)}`);
    $("hvArrow").setAttribute("opacity", 0);
  } else if (id === "gRde") {
    const yk = easeOut(win(t, 119.57, 119.9));
    $("rdeY").style.opacity = clamp01(yk * 2);
    $("rdeY").style.transform = "scale(" + (0.7 + 0.3 * yk).toFixed(3) + ")"; $("rdeY").style.transformOrigin = "0 50%";
    setH($("rdeH"), t >= 125.03 ? "Z <em>aparaturą pomiarową</em>" : t >= 122.35 ? "Test na <em>prawdziwej drodze</em>" : "Nowe auta <em>w Europie</em>", t, t >= 125.03 ? 125.03 : t >= 122.35 ? 122.35 : 120.95);
    const rk = easeOut(win(t, 122.35, 122.8));
    $("roadG").setAttribute("opacity", rk);
    [...$("roadG").querySelectorAll("[data-lane]")].forEach((l) => { const i = +l.dataset.lane; l.setAttribute("x", f1(wrap(i * 150 - t * 700, 1200) - 100)); });
    const a = -t * 12;
    [["rdW1", 420], ["rdW2", 730]].forEach(([wid]) => { $(wid).setAttribute("stroke-dasharray", "30 12"); $(wid).setAttribute("stroke-dashoffset", f1(a * 10)); });
    const pk = easeOut(win(t, 125.03, 125.65));
    $("rdPems").setAttribute("opacity", clamp01(pk * 2));
    $("rdPems").setAttribute("transform", `translate(0 ${f1((1 - pk) * -300)})`);
    $("rdHose").setAttribute("d", pk > 0.99 ? "M 250 1150 Q 250 1100 330 1110" : "");
    $("rdCar").setAttribute("transform", `translate(0 ${f1(Math.sin(t * 20) * 2)})`);
  } else if (id === "gLambda") {
    const lock = easeIO(win(t, 133.4, 133.83));
    const wob = (1 - lock) * (0.45 * Math.sin(t * 5.3) + 0.25 * Math.sin(t * 13.1));
    const ang = -Math.PI / 2 + wob;
    $("lamN").setAttribute("x2", f1(470 + Math.cos(ang) * 270)); $("lamN").setAttribute("y2", f1(1330 + Math.sin(ang) * 270));
    $("lamV").setAttribute("opacity", easeOut(win(t, 133.83, 134.1)));
    $("lamW").setAttribute("opacity", easeOut(win(t, 134.74, 135.0)));
  } else if (id === "gRight") {
    drawRows(rightRows, t);
    $("rightM").setAttribute("opacity", easeOut(win(t, 144.6, 144.9)));
  } else if (id === "gWord") {
    pop($("wdDown"), t, 150.25, 0.2, 30);
    dash($("wdX"), easeOut(win(t, 151.47, 151.75)), 940);
    const k = easeOut(win(t, 152.33, 152.6));
    $("wdRight").style.opacity = clamp01(k * 2);
    $("wdRight").style.transform = "scale(" + (1.4 - 0.4 * k).toFixed(3) + ")"; $("wdRight").style.transformOrigin = "0 50%";
    pop($("wdSub"), t, 153.0, 0.2, 20);
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Normy", "Test", "Paliwo", "Olej", "Pasek"];
const RN = RW.length, RROW = 50, ANS = "Większy silnik", T_ANS = 154.6;
const BURSTS = [[4.8, 5.9, 2 * RN], [21.95, 22.7, 2 * RN], [46.1, 46.8, 2 * RN], [82.97, 83.7, 2 * RN], [105.75, 106.4, 2 * RN], [118.2, 119.3, 2 * RN], [153.5, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 4.75, 156.2);
  rb.style.opacity = rOn ? (easeOut(win(t, 4.75, 5.0)) * (1 - easeIO(win(t, 155.8, 156.2)))).toFixed(3) : 0;
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
    $("reelFlash").style.opacity = done ? (0.85 * Math.max(0, 1 - (t - T_ANS) / 0.4)).toFixed(3) : 0;
    let bmp = 0;
    for (const [, b] of BURSTS) if (t >= b && t < b + 0.25) bmp = Math.sin(((t - b) / 0.25) * Math.PI) * 6;
    const bigK = Math.max(
      easeOut(win(t, 4.75, 5.05)) * (1 - easeIO(win(t, 6.2, 6.55))),
      easeIO(win(t, 118.15, 118.45)) * (1 - easeIO(win(t, 119.3, 119.6))),
      easeIO(win(t, 153.45, 153.75)) * (1 - easeIO(win(t, 155.4, 155.8))),
    );
    // duży bęben stoi nad napisami, żeby ich nie zasłonić
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (480 * bigK - bmp).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const pc = $("pickCard");
  const pOn = inR(t, 155.35, 159.8);
  pc.style.opacity = pOn ? (easeOut(win(t, 155.35, 155.65)) * (1 - easeIO(win(t, 159.5, 159.8)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 155.35, 155.65))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 156.38 ? (t < 157.27 ? 1 : 0.5 + 0.5 * Math.sin((t - 157.27) * 7)) : 0;
    const gB = t > 157.27 ? (t < 158.73 ? 1 - gA * 0.5 : 0.5 - 0.5 * Math.sin((t - 157.27) * 7)) : 0;
    on("pkA", gA); on("pkB", gB);
    $("pickC").style.opacity = easeOut(win(t, 158.73, 159.0));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 159.9, 168.3);
  // urwanie: karta YouTube stoi do ostatniej klatki przed cięciem w hook
  yc.style.opacity = yOn ? easeOut(win(t, 159.9, 160.25)).toFixed(3) : 0;
  if (yOn) {
    yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 159.9, 160.3))) * -80).toFixed(1) + "px)";
    const lk = t >= 167.45 ? 1 + 0.12 * Math.max(0, Math.sin((t - 167.45) * 9)) : 1;
    yc.querySelector(".ytL").style.transform = "scale(" + lk.toFixed(3) + ")";
    yc.querySelector(".ytL").style.display = "inline-block";
    yc.querySelector(".ytM").style.opacity = easeOut(win(t, 164.61, 164.9));
  }
  const fl = (a, dur, amp) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0);
  $("flash").style.opacity = 0;
}

/* ================= render klatki ================= */
const chipSets = ["chPlus", "chLoad", "chQuiet", "chCity", "chNa"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chPlus: "plusy", chLoad: "load", chQuiet: "quiet", chCity: "city", chNa: "naBig" };
function stamp(id, on, at, x, y, t) {
  const el = $(id);
  if (!on) { el.style.opacity = 0; return; }
  const k = easeOut(win(t, at, at + 0.3));
  el.style.opacity = k;
  place(el, x, y);
  el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.15 - 0.15 * k).toFixed(3) + ")";
}

const capsBox = $("caps");
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  drawCaps(t);
  // na podzielonym ekranie napisy wchodzą do górnego panelu, nad szew
  capsBox.style.top = SPLIT.has(shotAt(t)[3]) ? "680px" : "880px";
  const [s0, , kind, name] = shotAt(t);
  bd.style.opacity = kind === "board" ? 1 : 0;
  if (kind === "board") drawBoard(t, name);
  const on3d = kind === "3d";
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (!on3d) return;

  const deg = crankAt(t);
  const split = SPLIT.has(name);
  const A = states(t, name, "A");
  pose(A.s, deg, t);
  lightAt(A.base);
  if (split) applyCam(t, name + "A", 0, camera);
  else applyCam(t, name, A.shk);

  /* ---- hook: spalanie z katalogu rośnie od pierwszej klatki ---- */
  const hookOn = name === "hook", loopEnd = name === "outro";
  show($("hk"), hookOn || loopEnd);
  if (hookOn || loopEnd) {
    const k0 = 1;
    ["hkK", "hkL", "hkN", "hkS"].forEach((id) => { $(id).style.opacity = k0; });
    const v = hookOn ? (t < 1.68 ? 5 + 2 * Math.pow(win(t, 0, 1.68), 1.5) : 7) : 5;
    const txt = v.toFixed(1).replace(".", ",");
    if ($("hkNv").textContent !== txt) $("hkNv").textContent = txt;
    const hit = hookOn ? 0.5 - 0.5 * Math.cos(Math.PI * clamp01(1 - Math.abs(t - 1.9) / 0.6)) : 0;
    $("hkN").style.transform = "scale(" + (1 + 0.08 * hit).toFixed(3) + ")";
    $("hkNv").style.color = hookOn && t >= 1.68 ? "#ff6a4d" : "";
    const dk = hookOn ? easeOut(win(t, 1.68, 2.0)) : 0;
    $("hkS2").style.opacity = clamp01(dk * 3);
    $("hkS2").style.transform = "translateY(" + ((1 - dk) * 16).toFixed(1) + "px)";
    $("hkS2").style.display = "inline-block";
  }
  drawTop(t);

  /* ---- 3D -> 2D ---- */
  projCam = camera;
  chipSets.forEach((cs) => {
    const on = CHIP_SHOT[cs.el.id] === name;
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.2, 24));
  });
  // manometr: śpi w teście, rośnie na drodze
  const gOn = name === "noBoost" || name === "load";
  $("gauge").setAttribute("opacity", gOn ? easeOut(win(t, s0 + 0.1, s0 + 0.35)) : 0);
  $("gauge").setAttribute("transform", name === "load" ? "translate(480 0)" : "");
  if (gOn) drawGauge(name === "noBoost" ? 0.02 + 0.02 * Math.sin(t * 9) : 0.1 + 1.5 * easeIO(win(t, 41.3, 44.44)) + 0.04 * Math.sin(t * 11));
  // HUD: niskie obroty i pełny gaz
  const hOn = name === "lowRpm";
  $("hud").setAttribute("opacity", hOn ? easeOut(win(t, 68.7, 68.95)) : 0);
  if (hOn) {
    $("hudRpm").textContent = String(Math.round((1400 + 150 * easeOut(win(t, 68.81, 69.3))) / 50) * 50);
    $("hudGas").setAttribute("width", f1(300 * easeOut(win(t, 69.81, 70.2))));
  }
  // lampka oleju
  const oOn = name === "sitko" && t >= 96.98;
  $("oilLamp").setAttribute("opacity", oOn ? (0.55 + 0.45 * Math.abs(Math.sin((t - 96.98) * 6))) * easeOut(win(t, 96.98, 97.1)) : 0);
  // licznik spalania i obrotów
  const cntOn = name === "calm" || name === "city";
  $("cnt").style.opacity = cntOn ? easeOut(win(t, name === "calm" ? 35.32 : 111.04, (name === "calm" ? 35.32 : 111.04) + 0.25)) : 0;
  if (cntOn) {
    const n = "5,0", lab = "<b>l/100 km</b>" + (name === "calm" ? "w teście" : "w mieście");
    if ($("cntN").textContent !== n) $("cntN").textContent = n;
    if ($("cntL").innerHTML !== lab) $("cntL").innerHTML = lab;
    $("cntN").style.color = "#86dba1";
  }
  // fala ciśnienia w cylindrze
  const prOn = name === "pressure" && t > 65.0;
  const pg = $("press");
  pg.setAttribute("opacity", prOn ? easeOut(win(t, 65.0, 65.3)) : 0);
  if (prOn) {
    while (pg.firstChild) pg.removeChild(pg.firstChild);
    for (let i = 0; i < NC; i++) {
      const x = K.CYL_X[i], ph = wrap(deg - K.firePhaseDeg(i + 1), 720), pk = ph < 180 ? 1 - ph / 180 : 0.15;
      const c = wp(x, 185, 50);
      for (const sg of [-1, 1]) {
        const e = wp(x + sg * (12 + 26 * pk), 185, 50);
        mkEl("path", { d: `M ${f1(c.x)} ${f1(c.y)} L ${f1(e.x)} ${f1(e.y)} M ${f1(e.x - sg * 12)} ${f1(e.y - 10)} L ${f1(e.x)} ${f1(e.y)} L ${f1(e.x - sg * 12)} ${f1(e.y + 10)}`, stroke: "#ff6a4d", "stroke-width": 7, fill: "none", "stroke-linecap": "round" }, pg);
      }
      const u = wp(x, 185, 50), u2 = wp(x, 185 + 30 * pk, 50);
      mkEl("path", { d: `M ${f1(u.x)} ${f1(u.y)} L ${f1(u2.x)} ${f1(u2.y)}`, stroke: "#ff6a4d", "stroke-width": 7, "stroke-linecap": "round" }, pg);
    }
  }
  // fala uderzeniowa samozapłonu
  const shOn = (name === "lspi" && t >= 72.37) || (name === "rc3" && t >= 170.7) || (name === "ring" && t >= 75.22 && t < 76.0);
  const tb = name === "rc3" ? 170.7 : name === "ring" ? 75.22 : 72.37;
  $("shock").setAttribute("opacity", shOn ? Math.max(0, 1 - (t - tb) / 0.7) : 0);
  if (shOn) {
    const c = wp(X1, K.pistonCrownY(deg, 1) + 24, 0);
    const r = 40 + 420 * easeOut(win(t, tb, tb + 0.7));
    ["shock1", "shock2"].forEach((id, i) => { $(id).setAttribute("cx", f1(c.x)); $(id).setAttribute("cy", f1(c.y)); $(id).setAttribute("r", f1(r * (1 - 0.3 * i))); });
  }
  // stemple
  stamp("stKlam", name === "hook" && t >= 1.68, 1.68, 470, 1260, t);
  stamp("stZero", name === "noBoost" && t >= 30.79, 30.79, 560, 760, t);
  stamp("stSam", (name === "lspi" && t >= 72.37) || (name === "rc3" && t >= 170.7), name === "rc3" ? 170.7 : 72.37, 470, 1230, t);
  stamp("stSpal", name === "smoke" && t >= 130.11, 130.11, 470, 1230, t);
  stamp("stUdz", name === "cant" && t >= 136.78, 136.78, 470, 1230, t);
  stamp("stGore", name === "load" && t >= 41.5, 41.5, 640, 760, t);

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const pill = $("splitPill");
  const pillTxt = name === "splitSize" ? "Zamiast" : "Efekt?";
  if (pill.textContent !== pillTxt) pill.textContent = pillTxt;
  const pk = split ? easeOut(win(t, s0, s0 + 0.25)) : 0;
  pill.style.opacity = pk;
  pill.style.transform = "translate(-50%,-50%) scale(" + (1.3 - 0.3 * pk).toFixed(3) + ")";
  const setPl = (el, b, st, cls, at) => {
    const bb = el.querySelector("b"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
    s2.style.display = st ? "" : "none";
    pop(el, t, at, 0.2, 20);
  };
  if (name === "splitSize") { setPl($("pA"), "Duży", t >= 11.64 ? "Bez turbo" : "", "ok", 10.82); setPl($("pB"), "Mały", t >= 14.68 ? "3 cylindry i turbo" : t >= 13.69 ? "3 cylindry" : "", "hot", 12.82); }
  else if (name === "splitGap") { setPl($("pA"), "Katalog", t >= 58.42 ? "5,0 l" : "", "ok", 55.24); setPl($("pB"), "Droga", t >= 59.82 ? "7,0 l" : "", "hot", 57.82); }
  else { $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawTags(t);

  /* ---- render ---- */
  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - 840, W, 840);
  composer.render();
  const Bs = states(t, name, "B");
  pose(Bs.s, deg, t);
  lightAt(Bs.base);
  applyCam(t, name + "B", 0, cameraB);
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - 840);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, ES, E6, bigT, camera, cameraB, composer, scene, SHOTS, K };
