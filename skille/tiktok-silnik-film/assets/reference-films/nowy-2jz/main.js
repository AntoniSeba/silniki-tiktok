// 2JZ: silnik na 1000 koni, w papierach 280. Model 2JZ-GTE Antoniego (projekty/2jz-engine).
// Cały obraz jest czystą funkcją czasu (hf-seek), bez zegara i bez losowości.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "../model/src/lib/materials.js";
import { buildStudioEnvironment } from "../model/src/lib/environment.js";
import { buildEngine } from "../model/src/scene.js";
import * as K from "../model/src/lib/engine.js";
import { buildTurbo } from "./turbo.js";

const W = 1080, H = 1920, D = 147.3;
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
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const bump = (t, a, b) => Math.sin(win(t, a, b) * Math.PI);
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
  [0, 4.3, "3d", "hook"], [4.3, 7.46, "3d", "splitHook"], [7.46, 12.45, "3d", "promise"], [12.45, 13.89, "3d", "intro"],
  [13.89, 16.95, "3d", "supra"], [16.95, 22.16, "board", "gCars"], [22.16, 24.5, "3d", "nuda"], [24.5, 28.95, "3d", "boring"],
  [28.95, 31.56, "broll"], [31.56, 32.29, "3d", "gold"], [32.29, 34.64, "3d", "anatomy"], [34.64, 39.42, "3d", "square"],
  [39.42, 43.55, "board", "gZero"], [43.55, 46.2, "3d", "free"], [46.2, 50.66, "3d", "splitIron"], [50.66, 54.92, "3d", "deck"],
  [54.92, 58.5, "3d", "pressure"], [58.5, 60.08, "3d", "forged"], [60.08, 64.3, "3d", "mains"], [64.3, 66.92, "3d", "bend"],
  [66.92, 70.55, "3d", "jets"], [70.55, 74.45, "3d", "fireIce"], [74.45, 77.02, "3d", "noburn"], [77.02, 80.42, "3d", "twins"],
  [80.42, 83.55, "3d", "seq1"], [83.55, 87.85, "board", "gSeq"], [87.85, 88.45, "3d", "efekt"], [88.45, 92.55, "board", "gHp"],
  [92.55, 97.0, "3d", "swap"], [97.0, 99.0, "3d", "flaws"], [99.0, 101.55, "board", "gFront"], [101.55, 105.0, "3d", "plumbing"],
  [105.0, 109.0, "3d", "single"], [109.0, 112.9, "board", "gPrice"], [112.9, 114.25, "3d", "promised"], [114.25, 122.58, "board", "gDeal"],
  [122.58, 126.28, "3d", "deal"], [126.28, 130.2, "3d", "splitUsa"], [130.2, 133.72, "3d", "reserve"], [133.72, 139.0, "3d", "pick"],
  [139.0, 140.33, "3d", "rc1"], [140.33, 141.76, "3d", "rc2"], [141.76, 143.0, "3d", "rc3"], [143.0, 143.94, "3d", "rc4"],
  [143.94, D + 1, "3d", "outro"],
];
const shotAt = (t) => { for (const s of SHOTS) if (t >= s[0] && t < s[1]) return s; return SHOTS[SHOTS.length - 1]; };
const SPLIT = new Set(["splitHook", "splitIron", "splitUsa"]);

/* ================= kąt wału ================= */
const CK = [[0, 0]];
let ca = 0, ct = 0;
const run = (t1, w) => { ca += w * (t1 - ct); ct = t1; CK.push([ct, ca]); };
run(7.46, 400); run(12.45, 120); run(13.89, 200); run(16.95, 150); run(22.16, 150); run(24.5, 90); run(28.95, 60);
run(32.29, 100); run(34.64, 150); run(39.42, 70); run(46.2, 200); run(50.66, 60); run(54.92, 100); run(58.5, 120);
run(60.08, 30); run(64.3, 50); run(66.92, 60); run(70.55, 90); run(74.45, 70); run(77.02, 200); run(80.42, 150);
run(83.55, 120); run(88.45, 300); run(92.55, 200); run(97.0, 100); run(101.55, 150); run(109.0, 150); run(122.58, 150);
run(130.2, 150); run(133.72, 120); run(140.33, 150); run(141.76, 80); run(143.0, 90); run(143.94, 150);
CK.push([D, Math.ceil((ca + 330 * (D - ct)) / 720) * 720]);
const crankAt = mono(CK);
// turbiny: prędkość dobrana tak, żeby na końcu kąt wrócił do zera (pętla)
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
key.position.set(-1400, 2100, 1600);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 200, far: 8000, left: -1100, right: 1100, top: 1100, bottom: -1100 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.5); fill.position.set(1700, 800, -1200); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(600, 1300, -1900); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

/* ================= 2JZ ================= */
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
const crank = R.groups.crank;
const pistons = R.groups.pistons, rods = R.groups.rods;
const pistGlow = pistons.map((p) => glowMats(p));
const rodGlow = rods.map((r) => glowMats(r));
const crankGlow = glowMats(crank, AMBER, (o) => /^MainJournal_/.test(o.name));
const mainGlow = [1, 2, 3, 4, 5, 6, 7].map((i) => glowMats(crank.getObjectByName(`MainJournal_${i}`)));
const deckGlow = [], deckMeshes = [];
for (const n of ["Deck_Plate", "Deck_FaceMachined"]) { const o = B.groups.core.getObjectByName(n); if (o) { deckGlow.push(...glowMats(o)); deckMeshes.push(o); } }
const jetGlow = glowMats(B.groups.oilJets, GOLD);
const isJetOrDeck = (o) => deckGlow.includes(o.material) || jetGlow.includes(o.material);
const blockGlow = [...glowMats(B.groups.core, AMBER, isJetOrDeck), ...glowMats(B.groups.skinIn), ...glowMats(B.groups.skinEx)];
const blockAll = [...blockGlow, ...deckGlow];
const blockOrig = blockAll.map((m) => ({ c: m.color.clone(), me: m.metalness, ro: m.roughness }));
function blockLook(mode) {
  blockAll.forEach((m, i) => {
    const o = blockOrig[i];
    if (mode === "iron") { m.color.setHex(0x4b4f55); m.metalness = 0.35; m.roughness = 0.82; }
    else if (mode === "alu") { m.color.setHex(0xd4d9df); m.metalness = 0.75; m.roughness = 0.28; }
    else { m.color.copy(o.c); m.metalness = o.me; m.roughness = o.ro; }
  });
}
const turboGlow = IND.turbos.map((tb) => glowMats(tb.group));
const turboBase = IND.turbos.map((tb) => ({ p: tb.group.position.clone(), s: tb.group.scale.clone() }));
const fuelGlow = glowMats(HD.groups.fuel);
const manGlow = glowMats(IND.groups.manifolds);
const headBaseY = HD.root.position.y;

// błyski zapłonu i gaz w suwie pracy
const DECK = K.L.deckY, BORE_R = K.L.boreR;
const flashes = [], pows = [];
for (let i = 0; i < 6; i++) {
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), fm);
  f.position.set(K.CYL_X[i], DECK + 12, 0);
  f.scale.set(1, 0.55, 1);
  E.root.add(f);
  flashes.push({ m: f, mat: fm });
  const pm = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R - 3, BORE_R - 3, 1, 32), pm);
  E.root.add(p);
  pows.push({ m: p, mat: pm });
}
// strumienie oleju spod tłoków
const OIL_COL = new THREE.Color(0xffc45a);
const streamGeo = new THREE.CylinderGeometry(1, 0.55, 1, 14, 1, true); streamGeo.translate(0, 0.5, 0);
const dropGeo = new THREE.SphereGeometry(1, 12, 8);
const streams = B.jets.map((j) => {
  const mat = new THREE.MeshBasicMaterial({ color: OIL_COL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(streamGeo, mat);
  E.root.add(m);
  const dmat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const drops = [0, 1, 2, 3, 4].map(() => { const d = new THREE.Mesh(dropGeo, dmat); E.root.add(d); return d; });
  const splash = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 10), dmat);
  splash.scale.set(1.4, 0.35, 1.4);
  E.root.add(splash);
  return { j, m, mat, drops, dmat, splash };
});
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _tg = new THREE.Vector3();
const underY = (deg, cyl) => K.pistonCrownY(deg, cyl) - 16;

// jedna wielka turbina
const big = buildTurbo();
big.group.visible = false;
big.group.position.set(0, 10, -340);
E.root.add(big.group);

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
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.24, 0.7, 0.88));
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
const Pc = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.75, x, y, z, fov, oy });
const SIN = Math.PI / 2, EXH = -Math.PI / 2;
const X1 = K.CYL_X[0], TZ = K.L.turboZ, TY = K.L.turboY;
const P0 = Pc(-2.6, 0.3, 3000, 0, 120, 0, 32, -120);
const CAM = {
  hook: [[0, P0], [0.55, Pc(-2.3, 0.2, 2250, 0, 115, 0, 32, -120)], [2.06, Pc(-2.05, 0.14, 1950, 0, 110, 0, 32, -120)], [2.4, Pc(-2.0, 0.13, 2150, 0, 110, 0, 32, -120)], [4.3, Pc(-1.6, 0.1, 2000, 0, 110, 0, 32, -120)]],
  splitHookA: [[4.3, Pc(-1.9, 0.18, 2700, 0, 120, 0, 32, 400)], [7.46, Pc(-1.65, 0.15, 2500, 0, 120, 0, 32, 400)]],
  splitHookB: [[4.3, Pc(-2.55, 0.28, 2700, 0, 120, 0, 32, -300)], [7.46, Pc(-2.75, 0.24, 2550, 0, 120, 0, 32, -300)]],
  promise: [[7.46, Pc(1.25, 0.34, 3100, 0, 140, 0, 32, 70)], [12.45, Pc(0.7, 0.24, 2900, 0, 140, 0, 32, 70)]],
  intro: [[12.45, Pc(-2.7, 0.12, 2000, 0, 120, 0, 32, 60)], [13.89, Pc(-2.5, 0.1, 1850, 0, 120, 0, 32, 60)]],
  supra: [[13.89, Pc(2.6, 0.12, 2300, 0, 130, 0, 32, 70)], [16.95, Pc(2.2, 0.18, 2000, 0, 130, 0, 32, 70)]],
  nuda: [[22.16, Pc(SIN, 0.02, 2900, 0, 110, 0, 32, 60)], [24.5, Pc(SIN - 0.02, 0.02, 2850, 0, 110, 0, 32, 60)]],
  boring: [[24.5, Pc(-0.8, 0.3, 2300, 0, 60, 0, 32, 90)], [28.95, Pc(-1.1, 0.2, 2100, 0, 60, 0, 32, 90)]],
  gold: [[31.56, Pc(2.5, 0.2, 2000, 0, 60, 0, 32, 90)], [32.29, Pc(2.35, 0.18, 1850, 0, 60, 0, 32, 90)]],
  anatomy: [[32.29, Pc(SIN + 0.18, 0.12, 1920, 0, 150, 0, 32, -60)], [34.64, Pc(SIN + 0.06, 0.1, 1800, 0, 150, 0, 32, -60)]],
  square: [[34.64, Pc(SIN + 0.12, 0.06, 720, X1, 150, 0, 32, 0)], [39.42, Pc(SIN + 0.02, 0.03, 650, X1, 150, 0, 32, 0)]],
  free: [[43.55, Pc(-2.5, 0.2, 2400, 0, 120, 0, 32, 90)], [46.2, Pc(-2.1, 0.15, 2150, 0, 120, 0, 32, 90)]],
  splitIronA: [[46.2, Pc(-0.75, 0.38, 1750, 0, 40, 0, 32, 380)], [50.66, Pc(-0.55, 0.32, 1600, 0, 40, 0, 32, 380)]],
  splitIronB: [[46.2, Pc(0.75, 0.38, 1750, 0, 40, 0, 32, -250)], [50.66, Pc(0.55, 0.32, 1600, 0, 40, 0, 32, -250)]],
  deck: [[50.66, Pc(-0.9, 1.0, 1500, 0, 200, 0, 32, 60)], [54.92, Pc(-0.7, 1.12, 1350, 0, 200, 0, 32, 60)]],
  pressure: [[54.92, Pc(SIN + 0.12, 0.1, 1300, -110, 170, 0, 32, -40)], [58.5, Pc(SIN + 0.02, 0.08, 1200, -110, 170, 0, 32, -40)]],
  forged: [[58.5, Pc(2.45, 0.3, 1450, 0, 0, 0, 32, 110)], [60.08, Pc(2.25, 0.22, 1300, 0, 0, 0, 32, 110)]],
  mains: [[60.08, Pc(SIN + 0.3, 0.32, 1600, 0, -20, 0, 32, 90)], [64.3, Pc(SIN + 0.1, 0.12, 1450, 0, -30, 0, 32, 90)]],
  bend: [[64.3, Pc(SIN - 0.25, 0.16, 1400, 0, 0, 0, 32, 90)], [66.92, Pc(SIN - 0.12, 0.1, 1300, 0, 0, 0, 32, 90)]],
  jets: [[66.92, Pc(EXH + 0.3, -0.02, 820, -220, 120, 0, 32, 0)], [70.55, Pc(EXH + 0.12, 0.02, 740, -220, 125, 0, 32, 0)]],
  fireIce: [[70.55, Pc(EXH - 0.22, 0.08, 760, X1 + 50, 150, 0, 32, 0)], [74.45, Pc(EXH - 0.1, 0.05, 700, X1 + 50, 150, 0, 32, 0)]],
  noburn: [[74.45, Pc(EXH - 0.35, 0.22, 1500, 0, 150, 0, 32, -60)], [77.02, Pc(EXH - 0.2, 0.16, 1400, 0, 150, 0, 32, -60)]],
  twins: [[77.02, Pc(EXH - 0.3, -0.12, 1900, 0, 60, -150, 32, 160)], [80.42, Pc(EXH - 0.1, -0.08, 1700, 0, 50, -180, 32, 160)]],
  seq1: [[80.42, Pc(-2.2, -0.05, 1000, -165, TY, TZ, 32, 120)], [83.55, Pc(-2.0, -0.08, 900, -120, TY, TZ, 32, 120)]],
  efekt: [[87.85, Pc(-2.2, 0.15, 1900, 0, 120, 0, 32, 60)], [88.45, Pc(-2.05, 0.12, 1550, 0, 120, 0, 32, 60)]],
  swap: [[92.55, Pc(-1.25, 0.55, 3100, 0, 140, 0, 32, 70)], [97.0, Pc(-1.6, 0.48, 2900, 0, 140, 0, 32, 70)]],
  flaws: [[97.0, Pc(SIN, 0.05, 2800, 0, 110, 0, 32, 140)], [99.0, Pc(SIN - 0.06, 0.05, 2650, 0, 110, 0, 32, 140)]],
  plumbing: [[101.55, Pc(EXH - 0.5, 0.35, 1700, 0, 80, -150, 32, 90)], [105.0, Pc(EXH - 0.22, 0.25, 1500, 0, 80, -150, 32, 90)]],
  single: [[105.0, Pc(EXH - 0.45, 0.3, 2100, 0, 60, -150, 32, 110)], [109.0, Pc(EXH - 0.18, 0.22, 1900, 0, 60, -150, 32, 110)]],
  promised: [[112.9, Pc(0.95, 0.32, 2700, 0, 130, 0, 32, 80)], [114.25, Pc(0.75, 0.26, 2500, 0, 130, 0, 32, 80)]],
  deal: [[122.58, Pc(-2.75, 0.14, 2600, 0, 120, 0, 32, 130)], [126.28, Pc(-2.25, 0.2, 2300, 0, 120, 0, 32, 130)]],
  splitUsaA: [[126.28, Pc(-2.3, 0.2, 2700, 0, 120, 0, 32, 380)], [130.2, Pc(-2.0, 0.2, 2500, 0, 120, 0, 32, 380)]],
  splitUsaB: [[126.28, Pc(2.3, 0.22, 2600, 0, 110, 0, 32, -250)], [130.2, Pc(2.0, 0.2, 2450, 0, 110, 0, 32, -250)]],
  reserve: [[130.2, Pc(-1.2, 0.25, 2400, 0, 100, 0, 32, -120)], [133.72, Pc(-1.5, 0.2, 2150, 0, 100, 0, 32, -120)]],
  pick: [[133.72, Pc(EXH - 0.6, 0.3, 2600, 0, 120, 0, 32, 280)], [139.0, Pc(EXH - 0.2, 0.25, 2450, 0, 120, 0, 32, 280)]],
  rc1: [[139.0, Pc(-0.75, 0.38, 1750, 0, 40, 0, 32, 90)], [140.33, Pc(-0.6, 0.33, 1650, 0, 40, 0, 32, 90)]],
  rc2: [[140.33, Pc(SIN + 0.25, 0.25, 1550, 0, -30, 0, 32, 90)], [141.76, Pc(SIN + 0.12, 0.15, 1480, 0, -30, 0, 32, 90)]],
  rc3: [[141.76, Pc(EXH + 0.25, 0.0, 800, -220, 122, 0, 32, 0)], [143.0, Pc(EXH + 0.15, 0.02, 750, -220, 125, 0, 32, 0)]],
  rc4: [[143.0, Pc(EXH - 0.3, 0.3, 2100, 0, 55, -130, 32, 110)], [143.94, Pc(EXH - 0.18, 0.25, 1950, 0, 50, -150, 32, 110)]],
  outro: [[143.94, Pc(-3.2, 0.2, 2300, 0, 120, 0, 32, 40)], [146.3, Pc(-2.85, 0.26, 2500, 0, 120, 0, 32, -120)], [D, P0], [D + 1, Pc(-2.55, 0.29, 2950, 0, 120, 0, 32, -120)]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
// mocne słowa i stemple: szarpnięcie i krótki najazd kamery
const BEATS = [0.55, 2.06, 4.33, 6.73, 13.1, 15.31, 23.82, 31.56, 35.65, 37.16, 38.28, 44.67, 47.44, 50.06, 50.85, 55.33, 57.34, 58.93, 65.59, 68.9, 71.58, 75.07, 82.82, 87.93, 93.2, 94.19, 96.1, 98.51, 103.26, 106.63, 107.52, 112.95, 123.47, 125.33, 129.41, 132.86, 134.9, 136.85];
const beatK = (t) => { let k = 0; for (const b of BEATS) if (t >= b && t < b + 0.4) k = Math.max(k, Math.pow(1 - (t - b) / 0.4, 2)); return k; };
function applyCam(t, name, shk, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  // każde cięcie wpada z odjazdu i skrętu, kierunek zmienia się między ujęciami
  const si = SHOTS.findIndex((x) => t >= x[0] && t < x[1]);
  if (si > 0 && si < SHOTS.length - 1) {
    const cut = 1 - easeOut(win(t, SHOTS[si][0], SHOTS[si][0] + 0.5));
    v.r *= 1 + 0.22 * cut;
    v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.16 * cut;
    v.el += 0.05 * cut;
  }
  const bk = beatK(t);
  v.r *= 1 - 0.07 * bk;
  shk = Math.max(shk, 0.9 * bk);
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
}

/* ================= stan silnika ================= */
const blankS = () => ({
  ex: 0, head: 0, noHead: 0, section: 0, noInd: 0, crankOnly: 0, fire: 0, pow: 0, oil: 0, oilCyl: null,
  gP: [0, 0, 0, 0, 0, 0], gCol: [], mains: [0, 0, 0, 0, 0, 0, 0], gCrank: 0, crankCol: AMBER,
  gBlock: 0, blockCol: AMBER, gDeck: 0, look: "", gTurbo: [0, 0], turboCol: [AMBER, AMBER], turboSpin: [1, 1], turboOut: [0, 0],
  gFuel: 0, gRods: 0, gJets: 0, gMan: 0, big: 0, gBig: 0,
});
function pose(st, deg, t) {
  E.update(deg, { explode: st.ex, turboDeg: 0 });
  HD.root.position.y += st.head * 560;
  HD.root.visible = !st.noHead && !st.crankOnly;
  B.root.visible = !st.crankOnly;
  IND.root.visible = !st.noInd && !st.crankOnly;
  for (const g of [B.groups.skinIn, B.groups.skinEx, HD.groups.skinIn, HD.groups.skinEx]) g.visible = !st.section;
  // w przekroju znika też płyta pokładu, inaczej zasłania tłoki z boku
  deckMeshes.forEach((o) => { o.visible = !st.section; });
  TM.root.children.forEach((c) => { c.visible = !st.crankOnly || c === TM.groups.crankDrive; });
  TM.groups.covers.visible = false;
  for (let i = 0; i < 6; i++) {
    pistons[i].visible = !st.crankOnly;
    rods[i].visible = !st.crankOnly;
    const col = st.gCol[i] || AMBER;
    setGlow(pistGlow[i], st.gP[i], col);
    setGlow(rodGlow[i], Math.max(st.gP[i] * 0.8, st.gRods), st.gRods > st.gP[i] * 0.8 ? HOT : col);
  }
  mainGlow.forEach((ms, i) => setGlow(ms, st.mains[i] * 1.5));
  setGlow(crankGlow, st.gCrank, st.crankCol);
  setGlow(blockGlow, st.gBlock, st.blockCol);
  setGlow(deckGlow, Math.max(st.gDeck, st.gBlock), st.gDeck > st.gBlock ? AMBER : st.blockCol);
  setGlow(jetGlow, st.gJets);
  setGlow(fuelGlow, st.gFuel, HOT);
  setGlow(manGlow, st.gMan, HOT);
  blockLook(st.look);
  // turbiny: kąt z czasu, osobno dla każdej
  const base = t * TB_RATE;
  IND.turbos.forEach((tb, i) => {
    tb.shaft.rotation.x = base * st.turboSpin[i] * D2R;
    setGlow(turboGlow[i], st.gTurbo[i], st.turboCol[i]);
    const o = st.turboOut[i], b = turboBase[i];
    tb.group.position.set(b.p.x + (i ? 1 : -1) * 260 * o, b.p.y + 520 * o, b.p.z - 200 * o);
    tb.group.scale.copy(b.s).multiplyScalar(Math.max(0.001, 1 - 0.9 * o));
    tb.group.rotation.z = o * (i ? -1.2 : 1.2);
    tb.group.visible = o < 0.98;
  });
  big.group.visible = st.big > 0.01 && !st.crankOnly;
  big.group.scale.setScalar(125 * backOut(st.big));
  big.setState(t * 26, st.gBig);
  // zapłon i suw pracy
  for (let i = 0; i < 6; i++) {
    const ph = wrap(deg - K.firePhaseDeg(i + 1), 720);
    const k = st.fire && ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
    flashes[i].m.visible = k > 0.01 && !st.crankOnly;
    flashes[i].mat.opacity = k;
    flashes[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    const on = !!st.pow && ph < 180 && !st.crankOnly;
    pows[i].m.visible = on;
    if (on) {
      const crown = K.pistonCrownY(deg, i + 1), len = Math.max(2, DECK + 8 - crown);
      pows[i].m.scale.set(1, len, 1);
      pows[i].m.position.set(K.CYL_X[i], crown + len / 2, 0);
      const f = ph / 180;
      pows[i].mat.opacity = 0.85 - 0.5 * f;
      pows[i].mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
    }
  }
  // olej
  streams.forEach((s, i) => {
    const k = st.oil * (st.oilCyl ? st.oilCyl[i] : 1);
    const on = k > 0.01 && !st.crankOnly && B.root.visible;
    s.m.visible = on; s.splash.visible = on; s.drops.forEach((d) => { d.visible = on; });
    if (!on) return;
    const tip = s.j.tip;
    _tg.set(K.CYL_X[i], underY(deg, i + 1), -6);
    _dir.subVectors(_tg, tip);
    const len = _dir.length() * clamp01(k * 1.6);
    _dir.normalize();
    s.m.position.copy(tip);
    s.m.quaternion.setFromUnitVectors(_up, _dir);
    const flick = 1 + 0.12 * Math.sin(t * 37 + i * 1.7);
    s.m.scale.set(6.5 * flick, len, 6.5 * flick);
    s.mat.opacity = 0.9 * k;
    s.drops.forEach((d, n) => {
      const f = wrap(t * 2.6 + n / 5 + hash(i * 9 + n) * 0.1, 1);
      d.position.copy(tip).addScaledVector(_dir, len * f);
      d.scale.setScalar(6 + 2.5 * Math.sin(n * 2.1 + t * 9));
    });
    s.dmat.opacity = 0.9 * k;
    s.splash.position.set(K.CYL_X[i], underY(deg, i + 1) - 2, -6);
    s.splash.visible = on && k > 0.6;
  });
  E.root.updateMatrixWorld(true);
}

function states(t, name, panel) {
  const s = blankS();
  let shk = 0;
  switch (name) {
    case "hook": case "outro": {
      s.fire = 1; s.pow = 1;
      s.ex = name === "hook" ? 0.75 * Math.pow(1 - clamp01(t / 0.55), 2) : 0.75 * Math.pow(win(t, 146.35, D), 2);
      const up = name === "hook" ? easeOut(win(t, 2.06, 2.5)) : 1 - easeIO(win(t, 144.2, 146.0));
      s.gTurbo = [0.06 + 0.7 * up, 0.06 + 0.7 * up];
      s.turboCol = [HOT, HOT];
      if (name === "hook") shk = 0.5 * bump(t, 2.06, 2.7);
      break;
    }
    case "splitHook":
      if (panel === "B") break;
      s.fire = 1; s.pow = 1; s.gTurbo = [1, 1]; s.turboCol = [HOT, HOT]; s.gBlock = 0.15; s.blockCol = HOT;
      break;
    case "promise": s.ex = 1; break;
    case "intro": case "supra": case "free": case "promised": case "efekt": break;
    case "nuda": break;
    case "boring": s.head = easeIO(win(t, 24.52, 25.2)) * 0.55; s.gBlock = 0.3 * bump(t, 24.52, 25.6); s.blockCol = AMBER; s.look = "iron"; break;
    case "gold": s.gBlock = 1.0 * easeOut(win(t, 31.56, 31.8)); s.blockCol = GOLD; break;
    case "anatomy": s.section = 1; s.noInd = 1; s.fire = 1; break;
    case "square": s.section = 1; s.noInd = 1; s.gP[0] = 0.5 * easeOut(win(t, 36.68, 37.0)); break;
    case "splitIron":
      s.noHead = 1; s.noInd = 1; s.look = panel === "B" ? "alu" : "iron";
      if (panel === "A") { s.gBlock = 0.35 * bump(t, 49.9, 50.66); s.blockCol = AMBER; }
      break;
    case "deck": s.noHead = 1; s.noInd = 1; s.look = "iron"; s.gDeck = 1.1 * easeOut(win(t, 50.85, 51.2)) * (0.8 + 0.2 * Math.sin(t * 6)); break;
    case "pressure": {
      s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1;
      s.gBlock = 0.2 * easeOut(win(t, 56.92, 57.2)); s.blockCol = GREEN;
      shk = 0.35 * easeOut(win(t, 55.33, 55.6)) * (1 - win(t, 56.8, 57.2));
      break;
    }
    case "forged": { s.crankOnly = 1; const h = easeOut(win(t, 58.9, 59.1)) * (1 - easeIO(win(t, 59.3, 60.05))); s.gCrank = 2.6 * h; s.crankCol = HOT; break; }
    case "mains": case "rc2":
      s.crankOnly = 1;
      for (let i = 0; i < 7; i++) s.mains[i] = name === "rc2" ? 1 : easeOut(win(t, 60.22 + i * 0.12, 60.42 + i * 0.12));
      break;
    case "bend": s.crankOnly = 1; shk = 0.4 * easeOut(win(t, 64.6, 64.9)) * (1 - win(t, 65.5, 65.9)); s.gCrank = 0.25 * easeOut(win(t, 65.59, 65.9)); s.crankCol = GREEN; break;
    case "jets": case "rc3":
      s.section = 1; s.noInd = 1;
      s.gJets = name === "rc3" ? 0.9 : 1.2 * easeOut(win(t, 68.17, 68.5));
      s.oil = name === "rc3" ? 1 : easeOut(win(t, 68.9, 69.2));
      break;
    case "fireIce": {
      s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1;
      s.oil = easeOut(win(t, 72.52, 72.8));
      const heat = easeOut(win(t, 71.58, 71.9)) * (1 - 0.85 * easeIO(win(t, 72.6, 73.6)));
      for (let i = 0; i < 6; i++) { s.gP[i] = 1.6 * heat; s.gCol[i] = HOT; }
      break;
    }
    case "noburn": s.section = 1; s.noInd = 1; s.fire = 1; s.pow = 1; s.oil = 1; break;
    case "twins": case "rc4": {
      if (name === "rc4") { s.gTurbo = [1, 1]; break; }
      s.gTurbo[0] = 0.9 * easeOut(win(t, 77.55, 77.8));
      s.gTurbo[1] = 0.9 * easeOut(win(t, 77.73, 78.0)) * (1 - easeIO(win(t, 78.53, 78.8)));
      s.turboSpin = [1, t < 78.53 ? 1 : 1 - easeIO(win(t, 78.53, 79.2))];
      break;
    }
    case "seq1": s.gTurbo = [1.1, 0]; s.turboSpin = [1.4, 0]; break;
    case "swap": {
      s.ex = 0.8;
      s.gTurbo = [1, 1].map(() => 1.2 * easeOut(win(t, 93.2, 93.5)) * (t < 95.19 ? 1 : 1 - easeIO(win(t, 95.19, 95.5))));
      s.turboCol = [HOT, HOT];
      s.gFuel = 1.4 * easeOut(win(t, 93.66, 93.95)) * (t < 95.19 ? 1 : 1 - easeIO(win(t, 95.19, 95.5)));
      s.gRods = 1.4 * easeOut(win(t, 94.19, 94.45)) * (t < 95.19 ? 1 : 1 - easeIO(win(t, 95.19, 95.5)));
      const iron = easeOut(win(t, 95.19, 95.5));
      s.gBlock = 0.55 * iron; s.blockCol = GREEN; s.gCrank = 0.55 * iron; s.crankCol = GREEN;
      break;
    }
    case "flaws": break;
    case "plumbing": s.gMan = 0.5 * easeOut(win(t, 103.26, 103.5)); s.gTurbo = [0.35, 0.35]; s.turboCol = [HOT, HOT]; break;
    case "single": {
      const out = easeIO(win(t, 106.63, 107.2));
      s.turboOut = [out, out];
      s.big = easeOut(win(t, 107.52, 107.95));
      s.gBig = 0.6 * s.big;
      break;
    }
    case "deal": break;
    case "splitUsa": break;
    case "reserve": s.gBlock = (0.35 + 0.25 * Math.sin(t * 5)) * easeOut(win(t, 130.3, 130.7)); s.blockCol = AMBER; s.gCrank = s.gBlock; break;
    case "pick": {
      const bOn = easeIO(win(t, 136.85, 137.3));
      s.gTurbo = [0.9, 0.9].map((v) => v * easeOut(win(t, 134.9, 135.2)) * (1 - bOn));
      s.turboOut = [bOn, bOn];
      s.big = easeOut(win(t, 137.0, 137.4));
      s.gBig = 0.7 * s.big;
      break;
    }
    case "rc1": s.noHead = 1; s.noInd = 1; s.look = "iron"; s.gBlock = 0.3; s.blockCol = AMBER; break;
  }
  return { s, shk };
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
let projCam = camera;
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
const wp = (x, y, z, frame = E.root) => { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); };
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px) scale(" + (1 + (1 - k) * 0.12).toFixed(3) + ")";
  return k;
};
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const dash = (el, k, L = 1400) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const f1 = (v) => v.toFixed(1);

// etykiety z linią wiodącą
const wv = (x, y, z) => () => { _w.set(x, y, z); return E.root.localToWorld(_w.clone()); };
const objW = (o, x = 0, y = 0, z = 0) => () => o.localToWorld(new THREE.Vector3(x, y, z));
const wgA = IND.root.getObjectByName("Turbo1_WastegateActuator"), wgB = IND.root.getObjectByName("Turbo2_WastegateActuator");
const boxC = (o) => () => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
const TAGS = [
  { t0: 50.85, t1: 54.92, text: "Zamknięty pokład", a: wv(-165, DECK, 100), off: [60, -300], c: "oil" },
  { t0: 68.17, t1: 70.55, text: "Dysza oleju", a: () => B.jets[1].tip.clone(), off: [140, 230], c: "oil" },
  { t0: 71.58, t1: 74.45, text: "Ogień", a: wv(X1, DECK + 6, 0), off: [190, -170], c: "hot" },
  { t0: 72.52, t1: 74.45, text: "Olej", a: () => B.jets[0].tip.clone(), off: [200, 170], c: "oil" },
  { t0: 77.55, t1: 80.42, text: "Turbo 1", a: objW(IND.turbos[0].group), off: [-60, 280], c: "oil" },
  { t0: 77.73, t1: 80.42, text: "Turbo 2", a: objW(IND.turbos[1].group), off: [60, 380], c: "oil" },
  { t0: 103.26, t1: 105.0, text: "Zawór", a: wgA ? objW(wgA) : wv(-165, 120, -140), off: [-160, -230], c: "hot" },
  { t0: 103.52, t1: 105.0, text: "Rura", a: boxC(IND.groups.manifolds), off: [170, -300], c: "hot" },
  { t0: 104.19, t1: 105.0, text: "Zawór", a: wgB ? objW(wgB) : wv(165, 120, -140), off: [150, 200], c: "hot" },
  { t0: 104.45, t1: 105.0, text: "Rura", a: boxC(IND.groups.exhaust), off: [-170, 230], c: "hot" },
  { t0: 108.25, t1: 109.0, text: "Jedna wielka", a: objW(big.group), off: [170, -240], c: "oil" },
  { t0: 130.68, t1: 133.72, text: "Zapas", a: wv(0, 60, 0), off: [-160, -300], c: "oil" },
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
// numery cylindrów na tłokach
const badges = Array.from({ length: 6 }, (_, i) => { const el = document.createElement("div"); el.className = "badge"; el.textContent = String(i + 1); $("badges").appendChild(el); return el; });
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

/* ================= górny blok ================= */
const TOPS = [
  [7.5, "Na końcu zobaczysz", "Dlaczego <em>Toyocie</em>"],
  [9.66, "Na końcu zobaczysz", "<span class=\"hot\">Nie wolno</span> było napisać"],
  [11.04, "Na końcu zobaczysz", "Ile on <em>naprawdę ma</em>"],
  [12.5, "Toyota", "To jest <em>2JZ</em>"],
  [13.95, "Toyota Supra", "Rocznik <em>1993</em>"],
  [22.29, "I serio", "Na papierze"],
  [23.82, "I serio", "To <span class=\"hot\">nuda</span>"],
  [24.55, "Na papierze", "Żeliwny <em>blok</em>"],
  [25.5, "Na papierze", "Z lat <em>90.</em>"],
  [31.6, "Płacą jak", "Za <em>złoto</em>"],
  [32.32, "Liczby", "<em>3 litry</em>"],
  [32.88, "Liczby", "<em>6</em> w jednym rzędzie"],
  [34.68, "Średnica", "<em>86 mm</em>"],
  [36.72, "Skok", "<em>86 mm</em>"],
  [38.3, "Średnica = skok", "Idealny <em>kwadrat</em>"],
  [43.62, "Wyważenie", "Toyota dostała <em>za darmo</em>"],
  [45.05, "I poszła", "<em>Dalej</em>"],
  [50.72, "Blok", "Zamknięty <em>pokład</em>"],
  [52.2, "Ściany cylindrów", "Spięte <em>u samej góry</em>"],
  [55.35, "Pod ciśnieniem", "Z <span class=\"hot\">turbo</span>"],
  [56.47, "Cylindry", "Nie mają jak <span class=\"ok\">się rozchylić</span>"],
  [58.58, "Wał", "Kuty <em>ze stali</em>"],
  [60.12, "Wał", "Na <em>7 łożyskach</em>"],
  [61.95, "Po jednym", "Między <em>każdą parą</em>"],
  [64.38, "Żeby go zgiąć", "Trzeba się <span class=\"hot\">postarać</span>"],
  [66.98, "Pod każdym tłokiem", "Siedzi <em>dysza</em>"],
  [68.92, "Dysza", "Strzela <em>olejem</em>"],
  [70.6, "Z góry", "<span class=\"hot\">Ogień</span>"],
  [72.12, "Od dołu", "<em>Strumień oleju</em>"],
  [74.5, "Dlatego", "<span class=\"ok\">Się nie przepala</span>"],
  [75.92, "Nawet gdy", "Dokręcasz <em>ciśnienie</em>"],
  [77.56, "Do tego", "Dwie <em>turbiny</em>"],
  [78.55, "Ale", "Nie pracują <span class=\"hot\">razem</span>"],
  [80.58, "Niskie obroty", "Dmucha <em>jedna</em>"],
  [82.52, "Więc", "Nie ma <span class=\"ok\">dziury</span>"],
  [87.93, "Efekt", "<em>?</em>"],
  [92.6, "Tunerzy zmieniają", "<span class=\"hot\">Osprzęt</span>"],
  [95.13, "A żelazo", "Zostaje <em>fabryczne</em>"],
  [97.05, "Uczciwie", "Ma <span class=\"hot\">wady</span>"],
  [101.62, "Fabryczne turbo", "<span class=\"hot\">Plątanina</span> rur"],
  [105.1, "Większość tunerów", "<span class=\"hot\">Wyrzuca</span> je"],
  [107.14, "I wkłada", "Jedną <em>wielką</em>"],
  [112.95, "A teraz", "<em>Obiecane</em>"],
  [122.64, "Dżentelmeńska", "<em>Umowa</em>"],
  [124.24, "Toyota wpisała", "<em>280 KM</em>"],
  [130.3, "A zapas", "O którym <span class=\"hot\">nie wolno</span> mówić"],
  [132.41, "Zapas", "Został <em>w żelazie</em>"],
  [139.06, "Podsumowanie", "Blok jak <em>kowadło</em>"],
  [140.37, "Podsumowanie", "Wał na <em>7 łożyskach</em>"],
  [141.81, "Podsumowanie", "Olej <em>pod tłokami</em>"],
  [143.05, "Podsumowanie", "Dwie <em>turbiny</em>"],
  [144.1, "I dlatego po", "<em>30 latach</em>"],
];
const TOP_OFF = [[0, 7.46], [16.95, 22.16], [28.95, 31.56], [39.42, 43.55], [46.2, 50.66], [83.55, 87.85], [88.45, 92.55], [99.0, 101.55], [109.0, 112.9], [114.25, 122.58], [126.28, 130.2], [133.72, 139.0], [146.2, D + 1]];
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

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const rowsOf = (id) => [...$(id).querySelectorAll(".rw")].map((el) => ({ el, t: +el.dataset.t, st: +(el.dataset.st || 0), x: +(el.dataset.x || 0), stEl: el.querySelector(".st"), xEl: el.querySelector(".x") }));
const carRows = rowsOf("gCars");
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.16)); r.stEl.style.opacity = k; r.stEl.style.transform = "scale(" + (1 + (1 - k) * 0.6).toFixed(3) + ")"; }
    if (r.xEl) r.xEl.style.transform = "scaleX(" + easeOut(win(t, r.x, r.x + 0.25)).toFixed(3) + ")";
  });
}
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
// doładowanie od obrotów: turbo 1 od dołu, turbo 2 dołącza koło 4000
const SX = (rpm) => 90 + ((rpm - 1000) / 6000) * 760, SB = 1330, SA = 380;
const ss = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const bst1 = (rpm) => 0.62 * ss(1100, 2600, rpm) * (1 - 0.1 * ss(5500, 7000, rpm));
const bst2 = (rpm) => 0.42 * ss(3800, 4700, rpm);
function curve(fn, r0, r1, fill) {
  let d = "";
  for (let r = r0; r <= r1 + 1; r += 50) d += (d ? " L " : "M ") + f1(SX(r)) + " " + f1(SB - fn(r) * SA);
  if (fill) d += ` L ${f1(SX(r1))} ${SB} L ${f1(SX(r0))} ${SB} Z`;
  return d;
}
function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gCars") drawRows(carRows, t);
  else if (id === "gZero") {
    [...$("gZero").querySelectorAll(".zr")].forEach((r, i) => {
      pop(r, t, 39.6 + i * 0.4, 0.24, 30);
      const zs = r.querySelector(".zs");
      const done = t >= 42.76 + i * 0.1;
      const txt = done ? "0" : String(Math.floor(hash(Math.floor(t * 18) + i * 7) * 90 + 10));
      if (zs.textContent !== txt) zs.textContent = txt;
      r.querySelector("b").style.color = done ? "#86dba1" : "#ff6a4d";
    });
  } else if (id === "gSeq") {
    const rpm = 1000 + 6000 * easeIO(win(t, 83.6, 87.4));
    const shown = t < 84.6 ? Math.round((1000 + 3000 * easeOut(win(t, 83.6, 84.6))) / 50) * 50 : Math.round(rpm / 50) * 50;
    const txt = String(t >= 84.6 && t < 85.14 ? 4000 : shown);
    if ($("rpmN").textContent !== txt) $("rpmN").textContent = txt;
    const r1 = t < 84.6 ? 1000 + 3000 * easeOut(win(t, 83.6, 84.6)) : Math.max(4000, rpm);
    $("c1").setAttribute("d", curve(bst1, 1000, r1));
    $("c1Fill").setAttribute("d", curve(bst1, 1000, r1, true));
    const two = t >= 85.14;
    const tot = (r) => bst1(r) + bst2(r);
    $("c2").setAttribute("d", two ? curve(tot, 3700, Math.max(3750, r1)) : "");
    $("c2Fill").setAttribute("d", two ? curve(tot, 3700, Math.max(3750, r1), true) : "");
    const k2 = easeOut(win(t, 85.14, 85.4));
    $("c2").setAttribute("opacity", k2); $("c2Fill").setAttribute("opacity", k2); $("c2T").setAttribute("opacity", k2);
    const mk = easeOut(win(t, 83.76, 84.0));
    $("m4k").setAttribute("x1", SX(4000)); $("m4k").setAttribute("x2", SX(4000)); $("m4k").setAttribute("opacity", mk);
    $("m4kT").setAttribute("x", SX(4000)); $("m4kT").setAttribute("opacity", mk);
    const h = t >= 86.77 ? "Drugi <em>oddech</em>" : t >= 85.14 ? "Dołącza <em>druga</em>" : "Koło <em>4000 obr.</em>";
    setH($("sqH"), h, t, t >= 86.77 ? 86.77 : t >= 85.14 ? 85.14 : 83.6);
  } else if (id === "gHp") {
    const k = easeOut(win(t, 89.2, 92.09));
    $("hpN").textContent = t >= 92.09 ? "1000+" : String(Math.round(280 + 720 * k));
    $("hpN").style.color = t >= 92.09 ? "#ff6a4d" : "#f5aa3c";
    $("hpB").setAttribute("width", f1(218 + 562 * k));
    $("hpB").setAttribute("fill", k > 0.2 ? "#ff6a4d" : "#f5aa3c");
  } else if (id === "gFront") {
    const k = easeOut(win(t, 99.49, 99.8));
    const p = 1 + 0.15 * Math.sin((t - 99.49) * 10);
    const L = 150 * k * p;
    $("frArrow").setAttribute("d", `M 220 ${f1(900 - L)} L 220 900 M 190 ${f1(870)} L 220 900 L 250 870`);
    $("frArrow").setAttribute("opacity", k);
    $("frArrow2").setAttribute("d", `M 720 ${f1(900 - 50 * k)} L 720 900 M 704 884 L 720 900 L 736 884`);
    $("frArrow2").setAttribute("opacity", k);
    $("frEng").setAttribute("opacity", 0.6 + 0.4 * Math.abs(Math.sin(t * 5)));
  } else if (id === "gPrice") {
    const h = t >= 111.12 ? "Kosztuje jak <em>nowe auto</em>" : "Supra <span class=\"hot\">podrożała</span>";
    setH($("prH"), h, t, t >= 111.12 ? 111.12 : 109.1);
    const k = easeIO(win(t, 109.5, 110.8));
    let d = "", last = [90, 1300];
    for (let i = 0; i <= 60 * k; i++) {
      const u = i / 60, x = 90 + u * 760, y = 1300 - (Math.pow(u, 2.6) * 480 + 12 * Math.sin(u * 23));
      d += (i ? " L " : "M ") + f1(x) + " " + f1(y); last = [x, y];
    }
    $("prLine").setAttribute("d", d);
    $("prFill").setAttribute("d", d ? d + ` L ${f1(last[0])} 1330 L 90 1330 Z` : "");
    $("prDot").setAttribute("cx", f1(last[0])); $("prDot").setAttribute("cy", f1(last[1])); $("prDot").setAttribute("opacity", k > 0.02 ? 1 : 0);
    pop($("prChip"), t, 111.76, 0.2, 24);
  } else if (id === "gDeal") {
    const h = t >= 117.16 ? "Umówili <em>się</em>" : "Japońscy <em>producenci</em>";
    setH($("dlH"), h, t, t >= 117.16 ? 117.16 : 115.5);
    const yk = backOut(win(t, 114.41, 114.7));
    $("dlY").style.opacity = clamp01(yk * 2);
    $("dlY").style.transform = "scale(" + (0.7 + 0.3 * yk).toFixed(3) + ")";
    $("dlY").style.transformOrigin = "0 50%";
    [...$("dlMk").children].forEach((c, i) => {
      const k = backOut(win(t, 116.25 + i * 0.15, 116.45 + i * 0.15));
      c.style.opacity = clamp01(k * 3);
      c.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")";
      c.style.borderTopColor = t >= 117.16 ? "#86dba1" : "";
    });
    const bk = easeOut(win(t, 118.51, 118.8));
    ["dlBarT", "dlBarBg"].forEach((id2) => $(id2).setAttribute("opacity", bk));
    const WALL = 70 + 780 * 0.62;
    const fillK = easeIO(win(t, 118.9, 121.57));
    const over = t >= 121.57 ? 0 : 0;
    const bw = (WALL - 70) * fillK + over;
    $("dlBar").setAttribute("width", f1(bw));
    $("dlBar").setAttribute("fill", t >= 121.57 ? "#ff5a3c" : "#f5aa3c");
    const wk = easeOut(win(t, 119.2, 119.5));
    const shake = t >= 121.57 ? 6 * Math.max(0, 1 - (t - 121.57) / 0.4) * Math.sin(t * 90) : 0;
    $("dlWall").setAttribute("x", f1(WALL + shake)); $("dlWall").setAttribute("opacity", wk);
    const lk = easeOut(win(t, 121.57, 121.72));
    $("dlLim").style.opacity = lk;
    $("dlLim").style.transform = "scale(" + (1.5 - 0.5 * lk).toFixed(3) + ")";
    $("dlLim").style.transformOrigin = "0 50%";
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Moc", "Papiery", "Stany", "Zapas", "Umowa"];
const RN = RW.length, RROW = 50, ANS = "Umowa 280", T_ANS = 123.47;
const BURSTS = [[7.6, 8.7, 2 * RN], [22.2, 22.9, 2 * RN], [46.25, 46.9, 2 * RN], [77.1, 77.8, 2 * RN], [97.05, 97.7, 2 * RN], [113.05, 114.2, 2 * RN], [122.65, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 7.5, 125.0);
  rb.style.opacity = rOn ? (easeOut(win(t, 7.5, 7.75)) * (1 - easeIO(win(t, 124.6, 125.0)))).toFixed(3) : 0;
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
      easeOut(win(t, 7.5, 7.8)) * (1 - easeIO(win(t, 8.9, 9.25))),
      easeIO(win(t, 112.95, 113.25)) * (1 - easeIO(win(t, 114.2, 114.5))),
      easeIO(win(t, 122.55, 122.85)) * (1 - easeIO(win(t, 124.2, 124.6))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (880 * bigK - bmp).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const pc = $("pickCard");
  const pOn = inR(t, 133.8, 139.0);
  pc.style.opacity = pOn ? (easeOut(win(t, 133.8, 134.1)) * (1 - easeIO(win(t, 138.7, 139.0)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 133.8, 134.1))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 134.9 ? (t < 136.85 ? 1 : 0.5 + 0.5 * Math.sin((t - 136.85) * 7)) : 0;
    const gB = t > 136.85 ? (t < 137.89 ? 1 - gA * 0.5 : 0.5 - 0.5 * Math.sin((t - 136.85) * 7)) : 0;
    on("pkA", gA); on("pkB", gB);
    $("pickC").style.opacity = easeOut(win(t, 137.89, 138.15));
  }
  const sc = $("serCard");
  const sOn = inR(t, 130.4, 133.6);
  sc.style.opacity = sOn ? (easeOut(win(t, 130.4, 130.75)) * (1 - easeIO(win(t, 133.25, 133.6)))).toFixed(3) : 0;
  if (sOn) {
    sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 130.4, 130.8))) * -60).toFixed(1) + "px)";
    $("serBtn").style.transform = "scale(" + (1 + 0.08 * Math.max(0, Math.sin((t - 130.8) * 7))).toFixed(3) + ")";
  }
  const fl = (a, dur, amp) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0);
  $("flash").style.opacity = Math.max(fl(0.55, 0.14, 0.5), fl(2.06, 0.16, 0.55), fl(4.3, 0.18, 0.45), fl(31.56, 0.2, 0.5), fl(46.2, 0.16, 0.35), fl(87.85, 0.2, 0.5), fl(112.9, 0.18, 0.35), fl(126.28, 0.16, 0.35), fl(86.77, 0.16, 0.3)).toFixed(3);
}

/* ================= render klatki ================= */
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: +el.dataset.t }));
const hkChips = [...document.querySelectorAll("#hkC .hc")].map((el) => ({ el, t: +el.dataset.t }));
const chipSets = ["chBoring", "chSwap", "chFlaw"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chBoring: "boring", chSwap: "swap", chFlaw: "flaws" };

function stamp(id, on, at, x, y, t) {
  const el = $(id);
  if (!on) { el.style.opacity = 0; return; }
  const k = easeOut(win(t, at, at + 0.14));
  el.style.opacity = k;
  place(el, x, y);
  el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.8 - 0.8 * k).toFixed(3) + ")";
}

function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
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
  const { s, shk } = states(t, name, "A");
  pose(s, deg, t);
  if (split) applyCam(t, name + "A", 0, camera);
  else applyCam(t, name, shk);

  /* ---- hook ---- */
  const hookOn = name === "hook", loopEnd = name === "outro" && t >= 146.3;
  show($("hk"), hookOn || loopEnd);
  if (hookOn || loopEnd) {
    const k0 = hookOn ? 1 : easeOut(win(t, 146.3, 146.6));
    $("hkK").style.opacity = k0; $("hkH").style.opacity = k0; $("hkN").style.opacity = k0;
    // licznik rusza w klatce 0 i wali w 1000 na słowie "1000"
    const n = hookOn ? (t < 2.06 ? 280 + 720 * Math.pow(win(t, 0, 2.06), 1.6) : 1000) : 280;
    const txt = String(Math.round(n / 10) * 10);
    if ($("hkNv").textContent !== txt) $("hkNv").textContent = txt;
    const hit = hookOn ? Math.max(0, 1 - Math.abs(t - 2.1) / 0.35) : 0;
    const jig = hookOn && t < 2.06 ? 0.03 * Math.sin(t * 60) : 0;
    $("hkN").style.transform = "scale(" + (1 + 0.28 * hit + jig).toFixed(3) + ") rotate(" + (hookOn && t >= 2.06 ? -3 * hit : 0).toFixed(2) + "deg)";
    $("hkNv").style.color = hookOn && t >= 2.06 ? "#ff6a4d" : "";
    hkChips.forEach((c) => { const k = hookOn ? backOut(win(t, c.t, c.t + 0.22)) : 0; c.el.style.opacity = clamp01(k * 3); c.el.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")"; });
  }
  drawTop(t);

  /* ---- 3D -> 2D ---- */
  projCam = camera;
  // długość silnika
  const lenOn = name === "flaws";
  const dk = lenOn ? easeOut(win(t, 98.51, 99.0)) : 0;
  if (lenOn) {
    const a = wp(-450, -250, 160), b = wp(lerp(-450, 440, dk), -250, 160);
    $("dimL").setAttribute("d", `M ${f1(a.x)} ${f1(a.y - 18)} L ${f1(a.x)} ${f1(a.y + 18)} M ${f1(a.x)} ${f1(a.y)} L ${f1(b.x)} ${f1(b.y)} M ${f1(b.x)} ${f1(b.y - 18)} L ${f1(b.x)} ${f1(b.y + 18)}`);
  }
  $("dimL").setAttribute("opacity", dk);
  chipSets.forEach((cs) => {
    const on = CHIP_SHOT[cs.el.id] === name;
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.2, 24));
  });
  // numery cylindrów
  const bOn = name === "anatomy";
  badges.forEach((el, i) => {
    if (!bOn) { el.style.opacity = 0; return; }
    const at = 32.99 + i * 0.1;
    const p = wp(K.CYL_X[i], K.pistonCrownY(deg, i + 1) + 40, 60);
    place(el, p.x, p.y);
    const k = easeOut(win(t, at, at + 0.16));
    el.style.opacity = k;
    el.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")";
  });
  // kwadrat: średnica = skok
  const sqOn = name === "square";
  $("sqG").setAttribute("opacity", sqOn ? 1 : 0);
  if (sqOn) {
    const top = K.L.pistonCrownAtTdcY, bot = top - 2 * K.CRANK_R, z = 60;
    const bk = easeOut(win(t, 35.65, 36.0));
    const a = wp(X1 - BORE_R, top + 26, z), b = wp(lerp(X1 - BORE_R, X1 + BORE_R, bk), top + 26, z);
    $("dimB").setAttribute("d", bk > 0.01 ? `M ${f1(a.x)} ${f1(a.y - 14)} L ${f1(a.x)} ${f1(a.y + 14)} M ${f1(a.x)} ${f1(a.y)} L ${f1(b.x)} ${f1(b.y)} M ${f1(b.x)} ${f1(b.y - 14)} L ${f1(b.x)} ${f1(b.y + 14)}` : "");
    const bm = wp(X1, top + 26, z);
    $("dimBT").setAttribute("x", f1(bm.x)); $("dimBT").setAttribute("y", f1(bm.y - 24)); $("dimBT").setAttribute("opacity", bk);
    const sk = easeOut(win(t, 37.16, 37.5));
    const c = wp(X1 + BORE_R + 22, top, z), d = wp(X1 + BORE_R + 22, lerp(top, bot, sk), z);
    $("dimS").setAttribute("d", sk > 0.01 ? `M ${f1(c.x - 14)} ${f1(c.y)} L ${f1(c.x + 14)} ${f1(c.y)} M ${f1(c.x)} ${f1(c.y)} L ${f1(d.x)} ${f1(d.y)} M ${f1(d.x - 14)} ${f1(d.y)} L ${f1(d.x + 14)} ${f1(d.y)}` : "");
    const sm = wp(X1 + BORE_R + 22, (top + bot) / 2, z);
    $("dimST").setAttribute("x", f1(sm.x + 20)); $("dimST").setAttribute("y", f1(sm.y + 12)); $("dimST").setAttribute("opacity", sk);
    const qk = easeOut(win(t, 38.28, 38.6));
    const q = [wp(X1 - BORE_R, top, z), wp(X1 + BORE_R, top, z), wp(X1 + BORE_R, bot, z), wp(X1 - BORE_R, bot, z)];
    $("sqFill").setAttribute("d", `M ${q.map((p) => f1(p.x) + " " + f1(p.y)).join(" L ")} Z`);
    $("sqFill").setAttribute("opacity", qk);
    $("sqFill").setAttribute("stroke-width", 4 + 4 * bump(t, 38.28, 38.9));
  }
  // ciśnienie rozpycha cylindry, ściany trzymają
  const prOn = name === "pressure" && t > 55.33;
  const pg = $("press");
  pg.setAttribute("opacity", prOn ? easeOut(win(t, 55.33, 55.6)) : 0);
  if (prOn) {
    while (pg.firstChild) pg.removeChild(pg.firstChild);
    const hold = easeOut(win(t, 56.92, 57.2));
    for (let i = 0; i < 6; i++) {
      const x = K.CYL_X[i], ph = wrap(deg - K.firePhaseDeg(i + 1), 720), pk = ph < 180 ? 1 - ph / 180 : 0.15;
      const c = wp(x, 185, 50);
      for (const sg of [-1, 1]) {
        const e = wp(x + sg * (12 + 26 * pk), 185, 50);
        mkEl("path", { d: `M ${f1(c.x)} ${f1(c.y)} L ${f1(e.x)} ${f1(e.y)} M ${f1(e.x - sg * 12)} ${f1(e.y - 10)} L ${f1(e.x)} ${f1(e.y)} L ${f1(e.x - sg * 12)} ${f1(e.y + 10)}`, stroke: "#ff6a4d", "stroke-width": 6, fill: "none", "stroke-linecap": "round" }, pg);
        if (hold > 0.01) {
          const w0 = wp(x + sg * BORE_R, 150, 50), w1 = wp(x + sg * BORE_R, DECK, 50);
          mkEl("path", { d: `M ${f1(w0.x)} ${f1(w0.y)} L ${f1(w1.x)} ${f1(w1.y)}`, stroke: "#86dba1", "stroke-width": 8, opacity: hold, "stroke-linecap": "round" }, pg);
        }
      }
    }
  }
  // siła próbująca zgiąć wał
  const fOn = name === "bend" && t > 64.6;
  $("force").setAttribute("opacity", fOn ? easeOut(win(t, 64.6, 64.85)) : 0);
  if (fOn) {
    const push = 0.75 + 0.25 * Math.sin(t * 16);
    const c = wp(0, 60, 0, crank), top = wp(0, 60 + 260 * push, 0, crank);
    $("forceS").setAttribute("d", `M ${f1(top.x)} ${f1(top.y)} L ${f1(c.x)} ${f1(c.y - 30)}`);
    $("forceH").setAttribute("d", `M ${f1(c.x - 34)} ${f1(c.y - 44)} L ${f1(c.x)} ${f1(c.y + 4)} L ${f1(c.x + 34)} ${f1(c.y - 44)} Z`);
  }
  // manometr doładowania
  const gOn = name === "noburn";
  $("gauge").setAttribute("opacity", gOn ? easeOut(win(t, 74.6, 74.9)) : 0);
  if (gOn) {
    const bar = 0.3 + 0.9 * easeIO(win(t, 75.91, 76.8)) + 0.03 * Math.sin(t * 13);
    const a = -210 + 240 * clamp01(bar / 1.5);
    $("gNeedle").setAttribute("x2", f1(220 + Math.cos(a * D2R) * 108)); $("gNeedle").setAttribute("y2", f1(1300 + Math.sin(a * D2R) * 108));
    $("gArc").setAttribute("d", arcD(-210, Math.max(-209, a), 124));
    $("gArc").setAttribute("stroke", bar > 1.0 ? "#ff6a4d" : "#f5aa3c");
    $("gVal").textContent = bar.toFixed(1).replace(".", ",") + " BAR";
  }
  // liczniki
  const cntOn = name === "supra" || name === "mains" || name === "seq1" || name === "rc2";
  $("cnt").style.opacity = cntOn ? 1 : 0;
  if (cntOn) {
    let n = "", lab = "";
    if (name === "supra") { n = String(t >= 15.31 ? 1993 : Math.round(1960 + 33 * easeOut(win(t, 14.0, 15.31)))); lab = "<b>Supra</b>Toyota A80"; }
    else if (name === "mains" || name === "rc2") { let c = 0; for (let i = 0; i < 7; i++) if (name === "rc2" || t >= 60.22 + i * 0.12) c = i + 1; n = String(c); lab = "<b>łożysk</b>głównych"; }
    else { n = String(Math.round((1000 + 2400 * easeIO(win(t, 80.6, 83.4))) / 50) * 50); lab = "<b>obr/min</b>dmucha jedna"; }
    if ($("cntN").textContent !== n) $("cntN").textContent = n;
    if ($("cntL").innerHTML !== lab) $("cntL").innerHTML = lab;
  }
  // stemple
  stamp("st30", name === "splitHook" && t >= 6.73, 6.73, 760, 700, t);
  stamp("stNuda", name === "nuda" && t >= 23.82, 23.82, 540, 1180, t);
  stamp("stFree", name === "free" && t >= 44.67, 44.67, 540, 1180, t);
  stamp("stKow", name === "splitIron" && t >= 50.06, 50.06, 540, 840, t);
  stamp("stHold", name === "pressure" && t >= 57.34, 57.34, 500, 1230, t);
  stamp("stBend", name === "bend" && t >= 65.59, 65.59, 500, 1230, t);
  stamp("stBurn", name === "noburn" && t >= 75.07, 75.07, 560, 1060, t);
  stamp("stHole", name === "seq1" && t >= 82.82, 82.82, 560, 880, t);
  stamp("stFab", name === "swap" && t >= 96.1, 96.1, 500, 1060, t);
  stamp("st280", name === "deal" && t >= 125.33, 125.33, 520, 1180, t);

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const pill = $("splitPill");
  const pillTxt = name === "splitHook" ? "Ten sam silnik" : name === "splitIron" ? "Z czego blok?" : "Ta sama Supra";
  if (pill.textContent !== pillTxt) pill.textContent = pillTxt;
  const pk = split ? easeOut(win(t, s0, s0 + 0.25)) * (name === "splitHook" ? 1 - easeIO(win(t, 6.5, 6.73)) : name === "splitIron" ? 1 - easeIO(win(t, 47.1, 47.4)) : 1) : 0;
  pill.style.opacity = pk;
  pill.style.transform = "translate(-50%,-50%) scale(" + (1.3 - 0.3 * easeOut(win(t, s0, s0 + 0.25))).toFixed(3) + ")";
  const setPl = (el, b, st, cls, at) => {
    const bb = el.querySelector("b"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
    s2.style.display = st ? "" : "none";
    pop(el, t, at, 0.2, 20);
  };
  if (name === "splitHook") { setPl($("pA"), "1000 KM", "Realnie", "ok", 4.33); setPl($("pB"), "280 KM", "W papierach", "hot", 4.6); }
  else if (name === "splitIron") { setPl($("pA"), "Żeliwo", t >= 49.33 ? "Sztywny" : t >= 48.47 ? "Cięższy" : "2JZ", t >= 49.33 || t < 48.47 ? "ok" : "hot", 46.3); setPl($("pB"), "Aluminium", t >= 47.44 ? "Nie tutaj" : "", "hot", 47.44); }
  else if (name === "splitUsa") { setPl($("pA"), "Japonia", "280 KM", "hot", 126.4); setPl($("pB"), "USA", t >= 129.41 ? "320 KM" : "", "ok", 127.64); }
  else { $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawTags(t);

  /* ---- render ---- */
  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - 840, W, 840);
  composer.render();
  const sb = states(t, name, "B").s;
  pose(sb, deg + (name === "splitHook" ? 0 : 0), t);
  applyCam(t, name + "B", 0, cameraB);
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - 840);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, camera, cameraB, composer, scene, SHOTS, K, streams, big };
