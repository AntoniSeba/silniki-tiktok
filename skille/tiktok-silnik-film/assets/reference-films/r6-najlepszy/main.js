// Rzędowa szóstka, najlepszy silnik na świecie. Model BMW S54 Antoniego, V6 do porównań.
// Cały obraz jest czystą funkcją czasu (hf-seek), bez zegara i bez losowości.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "../model/s54/lib/materials.js";
import { buildStudioEnvironment } from "../model/s54/lib/environment.js";
import { buildEngine } from "../model/s54/parts/engine.js";
import { MAIN_X } from "../model/s54/parts/static.js";
import * as K from "../model/s54/kinematics.js";
import { createMaterials as createMaterials6 } from "../model/v6/lib/materials.js";
import { buildEngine as buildEngine6 } from "../model/v6/scene.js";
import { buildTurbo } from "./turbo.js";

const W = 1080, H = 1920, D = 173.0;
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
  [0, 3.45, "3d", "hook"], [3.45, 9.1, "3d", "promise"], [9.1, 15.35, "board", "gList"], [15.35, 18.6, "3d", "bmw"],
  [18.6, 21.7, "broll"], [21.7, 25.45, "board", "gKontra"], [25.45, 29.25, "3d", "length"], [29.25, 31.85, "3d", "love"],
  [31.85, 36.6, "3d", "anatomy"], [36.6, 42.7, "3d", "firing"], [42.7, 47.0, "3d", "splitCut"], [47.0, 52.3, "3d", "star"],
  [52.3, 58.05, "3d", "jerk"], [58.05, 63.8, "board", "gI4"], [63.8, 66.0, "broll"], [66.0, 71.2, "3d", "mirror"],
  [71.2, 74.1, "3d", "cancel"], [74.1, 78.9, "board", "gZero"], [78.9, 80.95, "3d", "fizyka"], [80.95, 83.7, "broll"],
  [83.7, 89.0, "board", "gGraph"], [89.0, 92.25, "3d", "overlap"], [92.25, 93.9, "board", "gGraph"], [93.9, 101.0, "3d", "mains"],
  [101.0, 105.1, "board", "gHp"], [105.1, 107.6, "broll"], [107.6, 114.3, "board", "gWaves"], [114.3, 116.1, "3d", "flaws"],
  [116.1, 120.3, "board", "gBay"], [120.3, 125.5, "3d", "twist"], [125.5, 131.2, "3d", "splitV6"], [131.2, 132.5, "3d", "promised"],
  [132.5, 143.5, "board", "gBack"], [143.5, 149.7, "3d", "turbo"], [149.7, 153.3, "3d", "norms"], [153.3, 157.1, "board", "gMod"],
  [157.1, 158.45, "broll"], [158.45, 161.7, "3d", "win"], [161.7, 166.8, "3d", "pick"], [166.8, 168.1, "3d", "rc1"],
  [168.1, 169.3, "board", "gGraph"], [169.3, 170.8, "3d", "rc3"], [170.8, 172.05, "board", "gBack"], [172.05, D + 1, "3d", "outro"],
];
const shotAt = (t) => { for (const s of SHOTS) if (t >= s[0] && t < s[1]) return s; return SHOTS[SHOTS.length - 1]; };
const SPLIT = new Set(["splitCut", "splitV6"]);

/* ================= kąt wału S54 ================= */
// klucze pod lektora; przy kolejności zapłonów cylinder zapala dokładnie na wypowiadanej cyfrze
const CK = [[0, 0]];
let ca = 0, ct = 0;
const run = (t1, w) => { ca += w * (t1 - ct); ct = t1; CK.push([ct, ca]); };
const jump = (t1, a) => { ct = t1; ca = a; CK.push([ct, ca]); };
run(3.45, 160); run(9.1, 110); run(15.35, 0.01); run(18.6, 150); run(25.45, 0.01); run(29.25, 40); run(31.85, 150); run(36.6, 90);
{
  const W8 = 214;
  const M0 = Math.ceil((ca + 2000) / 720) * 720;
  jump(36.6, M0 - W8 * (39.52 - 36.6));
  run(39.52, W8);
  [40.14, 40.64, 41.2, 41.76, 42.32].forEach((tk, i) => { CK.push([tk, M0 + 120 * (i + 1)]); });
  ca = M0 + 600; ct = 42.32;
}
run(42.7, 214); run(47.0, 80); run(52.3, 45); run(58.05, 200); run(71.2, 200); run(74.1, 200); run(89.0, 150); run(93.9, 110);
run(101, 70); run(120.3, 150); run(125.5, 120); run(143.5, 150); run(158.45, 150); run(161.7, 180); run(166.8, 60); run(169.3, 200); run(172.05, 70);
CK.push([D, Math.ceil((ca + 100 * (D - ct)) / 720) * 720]);
const crankAt = mono(CK);

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
Object.assign(key.shadow.camera, { near: 200, far: 8000, left: -1000, right: 1000, top: 1000, bottom: -1000 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.4); fill.position.set(1700, 800, 1200); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(600, 1300, -1900); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.5));
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

/* ================= BMW S54 ================= */
const AMBER = new THREE.Color(0xff8a1c), ICE = new THREE.Color(0x3aa0ff), GREEN = new THREE.Color(0x3cff7a);
const glowMats = (obj, col = AMBER) => {
  const out = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.emissive = col.clone();
    o.material.emissiveIntensity = 0;
    out.push(o.material);
  });
  return out;
};
const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E = buildEngine(M);
applyMaterialVariation(E.root, M);
scene.add(E.root);
const P = E.parts;
const crank = P.crank;
const pistGlow = P.pistons.map((p) => glowMats(p));
const rodGlow = P.rods.map((r) => glowMats(r));
const mainGlow = MAIN_X.map((_, i) => glowMats(crank.getObjectByName(`MainJournal_${i + 1}`)));
const crankGlow = [];
crank.children.forEach((o) => { if (/^Web_|^Crankpin/.test(o.name)) crankGlow.push(...glowMats(o)); });
const damperGlow = glowMats(crank.getObjectByName("VibrationDamper"), ICE);
const noseParts = ["VibrationDamper", "CrankSprocket", "CrankNose", "Flywheel", "StarterRingGear", "CrankFlange"].map((n) => crank.getObjectByName(n)).filter(Boolean);
crank.children.forEach((o) => { if (/^FlywheelBolt/.test(o.name)) noseParts.push(o); });
const exhaustGrp = E.root.getObjectByName("EXHAUST_WRAP");
const exhaustGlow = glowMats(exhaustGrp);
const blockMats = [M.ironBlock, M.ironBlockDark].filter(Boolean);
blockMats.forEach((m) => { m.emissive = AMBER.clone(); m.emissiveIntensity = 0; });
// eksplozja kaskadowa: od góry silnika
const EX = E.explode.map((e, i) => ({ ...e, k: clamp01(0.5 - e.dir[1] / 600 + hash(i) * 0.2) }));
const HEADSET = new Set(["headR", "headL", "coverR", "coverL", "camIn", "camEx", "coils"]);
// błyski zapłonu i gaz w suwie pracy
const flashes = [], pows = [];
for (let i = 0; i < 6; i++) {
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), fm);
  f.position.set(K.CYL_X[i], K.DECK + 14, 0);
  f.scale.set(1, 0.6, 1);
  E.root.add(f);
  flashes.push({ m: f, mat: fm });
  const pm = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(K.BORE_R - 3, K.BORE_R - 3, 1, 32), pm);
  E.root.add(p);
  pows.push({ m: p, mat: pm });
}
// turbo przy kolektorze wydechowym
E.update(K.state(0), { cut: 0, explode: 0 });
E.root.updateMatrixWorld(true);
const exBox = new THREE.Box3().setFromObject(exhaustGrp);
const turbo = buildTurbo();
{ const c = exBox.getCenter(new THREE.Vector3()); turbo.group.position.set(c.x, exBox.min.y - 95, c.z - 30); }
turbo.group.visible = false;
E.root.add(turbo.group);
const EX_CENTER = exBox.getCenter(new THREE.Vector3());

/* ================= V6 do porównań, stanowisko 80 m dalej ================= */
const V6P = new THREE.Vector3(0, -80000, 0);
const M6 = createMaterials6();
const E6 = buildEngine6(M6);
E6.ring.visible = false;
E6.charge.visible = false;
E6.root.position.copy(V6P);
scene.add(E6.root);
const j6 = {};
E6.rotating.crank.traverse((o) => {
  const m = /^Crank_RodJournal_Cyl(\d)$/.exec(o.name);
  if (m && o.isMesh) { o.material = o.material.clone(); o.material.emissive = AMBER.clone(); o.material.emissiveIntensity = 0; j6[m[1]] = o; }
});
const v6Hide = [E6.block.root, E6.heads.root, E6.intake.root, E6.headers.root, E6.accessories.root, E6.rotating.root.getObjectByName("PISTONS_AND_RODS"), E6.rotating.flywheel].filter(Boolean);

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260924;
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
// S54 ma prawie metr długości z obudową rozrządu i kołem zamachowym, stąd mnożnik odległości
const Pc = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.5, x, y, z, fov, oy });
const P6 = (az, el, r, x, y, z, fov, oy) => ({ az, el, r: r * 1.3, x: V6P.x + x, y: V6P.y + y, z: V6P.z + z, fov, oy });
const SIDE = Math.PI / 2, FRONT = Math.PI, EXH = -Math.PI / 2;
const P0 = Pc(2.35, 0.22, 2500, 0, 120, 0, 32, -60);
const CAM = {
  hook: [[0, P0], [3.45, Pc(2.0, 0.16, 2200, 0, 110, 0, 32, -60)]],
  promise: [[3.45, Pc(1.25, 0.34, 3000, 0, 140, 0, 32, 70)], [9.1, Pc(0.7, 0.24, 2800, 0, 140, 0, 32, 70)]],
  bmw: [[15.35, Pc(2.65, 0.1, 2200, 0, 130, 0, 32, 70)], [18.6, Pc(2.25, 0.18, 1950, 0, 130, 0, 32, 70)]],
  length: [[25.45, Pc(SIDE, 0.05, 2700, 0, 110, 0, 32, 140)], [29.25, Pc(SIDE - 0.06, 0.05, 2500, 0, 110, 0, 32, 140)]],
  love: [[29.25, Pc(-2.45, 0.3, 2500, 0, 130, 0, 32, 70)], [31.85, Pc(-2.05, 0.2, 2050, 0, 130, 0, 32, 70)]],
  anatomy: [[31.85, Pc(SIDE + 0.18, 0.12, 1920, 0, 150, 0, 32, -60)], [36.6, Pc(SIDE + 0.06, 0.1, 1800, 0, 150, 0, 32, -60)]],
  firing: [[36.6, Pc(SIDE - 0.22, 0.26, 1880, 0, 170, 0, 32, 0)], [42.7, Pc(SIDE - 0.06, 0.18, 1760, 0, 170, 0, 32, 0)]],
  splitCutA: [[42.7, P6(0.25, 0.32, 1150, 40, 0, 60, 34, 380)], [47.0, P6(0.45, 0.26, 1000, 40, 0, 60, 34, 380)]],
  splitCutB: [[42.7, Pc(2.3, 0.3, 1500, 0, 0, 0, 30, -260)], [47.0, Pc(2.0, 0.22, 1350, 0, 0, 0, 30, -260)]],
  star: [[47.0, Pc(FRONT - 0.3, 0.12, 1150, 0, 0, 0, 32, 110)], [48.4, Pc(FRONT - 0.02, 0.02, 1000, 0, 0, 0, 32, 110)], [52.3, Pc(FRONT, 0.0, 960, 0, 0, 0, 32, 110)]],
  jerk: [[52.3, Pc(SIDE + 0.3, 0.14, 1360, -150, 140, 0, 32, -50)], [58.05, Pc(SIDE + 0.12, 0.1, 1240, -150, 140, 0, 32, -50)]],
  mirror: [[66.0, Pc(SIDE, 0.08, 2000, 0, 120, 0, 32, -40)], [71.2, Pc(SIDE + 0.1, 0.1, 1920, 0, 120, 0, 32, -40)]],
  cancel: [[71.2, Pc(SIDE - 0.28, 0.2, 2000, 0, 120, 0, 32, -40)], [74.1, Pc(SIDE - 0.1, 0.12, 1920, 0, 120, 0, 32, -40)]],
  fizyka: [[78.9, Pc(2.5, 0.2, 2400, 0, 120, 0, 32, 90)], [80.95, Pc(2.1, 0.15, 2100, 0, 120, 0, 32, 90)]],
  overlap: [[89.0, Pc(SIDE + 0.05, 0.12, 1880, 0, 160, 0, 32, -50)], [92.25, Pc(SIDE - 0.05, 0.1, 1800, 0, 160, 0, 32, -50)]],
  mains: [[93.9, Pc(SIDE + 0.3, 0.32, 1600, 0, -20, 0, 32, 90)], [97.7, Pc(SIDE + 0.12, 0.14, 1500, 0, -40, 0, 32, 90)], [101.0, Pc(SIDE + 0.05, 0.08, 1450, 0, -40, 0, 32, 90)]],
  flaws: [[114.3, Pc(-0.75, 0.3, 2500, 0, 130, 0, 32, 80)], [116.1, Pc(-1.05, 0.2, 2300, 0, 130, 0, 32, 80)]],
  twist: [[120.3, Pc(SIDE + 0.45, 0.22, 1600, -80, 0, 0, 32, 80)], [125.5, Pc(SIDE + 0.22, 0.1, 1450, -80, 0, 0, 32, 80)]],
  splitV6A: [[125.5, Pc(2.3, 0.2, 2700, 0, 120, 0, 32, 380)], [131.2, Pc(2.0, 0.2, 2500, 0, 120, 0, 32, 380)]],
  splitV6B: [[125.5, P6(0.75, 0.22, 2600, 0, 110, 0, 32, -250)], [131.2, P6(0.95, 0.2, 2450, 0, 110, 0, 32, -250)]],
  promised: [[131.2, Pc(0.95, 0.32, 2700, 0, 130, 0, 32, 80)], [132.5, Pc(0.75, 0.26, 2500, 0, 130, 0, 32, 80)]],
  turbo: [[143.5, Pc(EXH - 0.35, 0.32, 2300, 0, 60, -120, 32, 110)], [146.3, Pc(EXH - 0.12, 0.22, 1950, 0, 40, -150, 32, 110)], [149.7, Pc(EXH + 0.08, 0.18, 1850, 0, 40, -150, 32, 110)]],
  norms: [[149.7, Pc(2.8, 0.75, 2700, 0, 130, 0, 32, 90)], [153.3, Pc(2.5, 0.6, 2500, 0, 130, 0, 32, 90)]],
  win: [[158.45, Pc(-2.7, 0.14, 2900, 0, 120, 0, 32, 130)], [161.7, Pc(-2.05, 0.2, 2400, 0, 120, 0, 32, 130)]],
  pick: [[161.7, Pc(1.95, 0.25, 2600, 0, 120, 0, 32, 280)], [166.8, Pc(1.45, 0.2, 2500, 0, 120, 0, 32, 280)]],
  rc1: [[166.8, Pc(SIDE, 0.1, 1920, 0, 120, 0, 32, -40)], [168.1, Pc(SIDE + 0.08, 0.1, 1880, 0, 120, 0, 32, -40)]],
  rc3: [[169.3, Pc(SIDE + 0.2, 0.2, 1550, 0, -30, 0, 32, 90)], [170.8, Pc(SIDE + 0.1, 0.12, 1500, 0, -30, 0, 32, 90)]],
  outro: [[172.05, Pc(1.9, 0.25, 2450, 0, 120, 0, 32, 60)], [172.8, P0], [D + 1, P0]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, shk, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
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

/* ================= stan S54 ================= */
const blankS = () => ({ ex: 0, section: 0, crankOnly: 0, noseOff: 0, fire: 0, pow: 0, gP: [0, 0, 0, 0, 0, 0], gCol: [], hideP: [0, 0, 0, 0, 0, 0], mains: [0, 0, 0, 0, 0, 0, 0], gCrank: 0, gDamper: 0, gExh: 0, gBlock: 0, head: 0, rock: 0, jerk: 0, turbo: 0 });
function poseS54(st, deg, t) {
  E.update(K.state(deg), { cut: 0, explode: 0 });
  for (const e of EX) {
    let a = st.ex > 0 ? stag(st.ex, e.k) * 1.6 : 0;
    if (HEADSET.has(e.name)) a = Math.max(a, st.head);
    e.obj.position.set(e.base[0] + e.dir[0] * a, e.base[1] + e.dir[1] * a, e.base[2] + e.dir[2] * a);
  }
  P.shellR.visible = !st.section && !st.crankOnly;
  P.shellL.visible = !st.crankOnly;
  P.center.children.forEach((c) => { c.visible = !st.crankOnly || c === crank; });
  for (const o of noseParts) o.visible = !st.noseOff;
  for (let i = 0; i < 6; i++) {
    P.pistons[i].visible = !st.crankOnly && !st.hideP[i];
    P.rods[i].visible = !st.crankOnly && !st.hideP[i];
    const col = st.gCol[i] || AMBER;
    pistGlow[i].forEach((m) => { m.emissive.copy(col); m.emissiveIntensity = st.gP[i]; });
    rodGlow[i].forEach((m) => { m.emissive.copy(col); m.emissiveIntensity = st.gP[i] * 0.8; });
  }
  mainGlow.forEach((ms, i) => ms.forEach((m) => { m.emissiveIntensity = st.mains[i] * 1.5; }));
  crankGlow.forEach((m) => { m.emissiveIntensity = st.gCrank; });
  damperGlow.forEach((m) => { m.emissiveIntensity = st.gDamper; });
  exhaustGlow.forEach((m) => { m.emissiveIntensity = st.gExh; });
  blockMats.forEach((m) => { m.emissiveIntensity = st.gBlock; });
  for (let i = 0; i < 6; i++) {
    const ph = K.cyclePhase(i + 1, deg);
    const k = st.fire && ph < 80 ? Math.pow(1 - ph / 80, 1.5) : 0;
    flashes[i].m.visible = k > 0.01 && !st.crankOnly;
    flashes[i].mat.opacity = k;
    flashes[i].mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    const on = st.pow && ph < 180 && !st.crankOnly;
    pows[i].m.visible = on;
    if (on) {
      const crown = K.pistonCrownY(i + 1, deg), len = Math.max(2, K.DECK + 10 - crown);
      pows[i].m.scale.set(1, len, 1);
      pows[i].m.position.set(K.CYL_X[i], crown + len / 2, 0);
      const f = ph / 180;
      pows[i].mat.opacity = 0.85 - 0.5 * f;
      pows[i].mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
    }
  }
  turbo.group.visible = st.turbo > 0.01;
  turbo.group.scale.setScalar(78 * backOut(st.turbo));
  turbo.setState(t * 30, st.turbo);
  // kołysanie trzycylindrowca i szarpnięcie tłoka
  E.root.rotation.z = st.rock * 0.028 * Math.sin(deg * D2R);
  E.root.position.y = st.jerk * -4 * pistonAcc(deg);
  E.root.updateMatrixWorld(true);
}
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const pistonAcc = (deg) => { const a = K.pinAngle(1, deg) * D2R; return Math.cos(a) + (K.CRANK_R / K.S54.rodLength) * Math.cos(2 * a); };

function states(t, name) {
  const s = blankS();
  let shk = 0;
  switch (name) {
    case "hook": s.ex = easeOut(clamp01(t / 2.8)); break;
    case "promise": s.ex = 1; break;
    case "bmw": case "love": case "fizyka": case "flaws": case "promised": case "norms": case "pick": case "outro": break;
    case "win": s.ex = 0.25 * Math.sin(win(t, 158.45, 161.7) * Math.PI); break;
    case "length": break;
    case "anatomy":
      s.section = 1;
      s.gBlock = 0.35 * Math.sin(win(t, 33.93, 34.75) * Math.PI);
      s.head = 0.55 * Math.sin(win(t, 34.78, 35.8) * Math.PI);
      s.gCrank = 0.9 * Math.sin(win(t, 35.82, 36.6) * Math.PI);
      break;
    case "firing": s.section = 1; s.fire = 1; s.pow = 1; break;
    case "splitCut": s.crankOnly = 1; s.gCrank = t > 45.39 ? 0.22 * easeOut(win(t, 45.39, 45.7)) : 0; break;
    case "star": s.crankOnly = 1; s.noseOff = 1; s.gCrank = 0.18 * easeOut(win(t, 47.6, 48.0)); break;
    case "jerk": {
      s.section = 1;
      s.gP[0] = easeOut(win(t, 54.25, 54.6)) * 1.3;
      s.jerk = easeOut(win(t, 56.54, 56.9));
      shk = 0;
      break;
    }
    case "mirror": case "rc1": {
      s.section = 1;
      const rear = name === "rc1" ? 1 : easeOut(win(t, 69.65, 69.9));
      for (let i = 0; i < 3; i++) { s.gP[i] = 1.1; s.gCol[i] = AMBER; }
      for (let i = 3; i < 6; i++) { s.hideP[i] = rear < 0.5 ? 1 : 0; s.gP[i] = 1.1 * rear; s.gCol[i] = ICE; }
      s.rock = name === "rc1" ? 0 : 1;
      break;
    }
    case "cancel": {
      s.section = 1;
      for (let i = 0; i < 6; i++) { s.gP[i] = 1.1; s.gCol[i] = i < 3 ? AMBER : ICE; }
      s.rock = 1 - easeIO(win(t, 71.8, 73.2));
      break;
    }
    case "overlap": s.section = 1; s.pow = 1; s.fire = 1; break;
    case "mains": case "rc3": {
      s.crankOnly = 1;
      for (let i = 0; i < 7; i++) s.mains[i] = name === "rc3" ? 1 : easeOut(win(t, 94.89 + i * 0.39, 95.1 + i * 0.39));
      break;
    }
    case "twist": s.crankOnly = 1; s.gDamper = t > 122.77 ? 1.2 * easeOut(win(t, 122.77, 123.1)) : 0; break;
    case "splitV6": break;
    case "turbo": s.gExh = 0.4 * easeOut(win(t, 144.78, 145.1)); s.turbo = easeOut(win(t, 146.08, 146.5)); break;
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
const dash = (el, k) => { const L = 1400; el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };

// etykiety z linią wiodącą
const wv = (x, y, z, frame = E.root) => () => { _w.set(x, y, z); return frame.localToWorld(_w.clone()); };
const TAGS = [
  { t0: 25.88, t1: 29.25, text: K.BLOCK_LENGTH.toFixed(0) + " mm samego bloku", a: wv(0, -210, 150), off: [0, 110], c: "hot" },
  { t0: 33.93, t1: 34.78, text: "Jeden blok", a: wv(-60, 60, -20), off: [-150, -260], c: "oil" },
  { t0: 34.78, t1: 35.82, text: "Jedna głowica", a: wv(60, 330, -20), off: [160, -200], c: "oil" },
  { t0: 35.82, t1: 36.6, text: "Jeden wał", a: wv(40, 0, 0), off: [120, 240], c: "oil" },
  { t0: 43.76, t1: 45.39, text: "Czop przecięty", a: () => { const a = j6["1"].position, b = j6["2"].position; return E6.rotating.crank.localToWorld(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, 108)); }, off: [-140, -170], c: "hot" },
  { t0: 54.55, t1: 58.05, text: "Tłok 1", a: () => P.pistons[0].localToWorld(new THREE.Vector3(0, 20, 0)), off: [-200, -210], c: "oil" },
  { t0: 66.51, t1: 71.2, text: "Cylindry 1, 2, 3", a: wv(K.CYL_X[1], K.DECK + 60, 0), off: [-60, -260], c: "oil" },
  { t0: 69.65, t1: 71.2, text: "Cylindry 4, 5, 6", a: wv(K.CYL_X[4], K.DECK + 60, 0), off: [60, -170], c: "ice" },
  { t0: 123.84, t1: 125.5, text: "Tłumik drgań skrętnych", a: () => crank.getObjectByName("VibrationDamper").localToWorld(new THREE.Vector3(0, 60, 0)), off: [160, -230], c: "ice" },
  { t0: 144.78, t1: 146.55, text: "Jeden kolektor", a: () => EX_CENTER.clone(), off: [-120, -250], c: "oil" },
  { t0: 146.55, t1: 149.7, text: "Miejsce na turbo", a: () => turbo.group.getWorldPosition(new THREE.Vector3()), off: [160, 220], c: "oil" },
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
    tg.line.setAttribute("d", `M ${x.toFixed(1)} ${y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
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
// gwiazda wykorbień: trzy pary co 120°
const PAIRS = [[0, "1 + 6"], [120, "2 + 5"], [240, "3 + 4"]];
const armEls = PAIRS.map(([, lab]) => {
  const ln = mkEl("path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, $("arms"));
  const c = mkEl("rect", { rx: 12, fill: "rgba(10,14,19,0.92)", stroke: "#f5aa3c", "stroke-width": 3, width: 130, height: 56 }, $("arms"));
  const tx = mkEl("text", { "text-anchor": "middle", "dominant-baseline": "central", style: "font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:600;fill:#eef2f7" }, $("arms"));
  tx.textContent = lab;
  return { ln, c, tx };
});
const hub = mkEl("circle", { r: 16, fill: "#f5aa3c" }, $("arms"));
function drawArms(t, on, at) {
  $("arms").setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  const x0 = K.CYL_X[0] - 40;
  const h = wp(x0, 0, 0, crank);
  hub.setAttribute("cx", h.x.toFixed(1)); hub.setAttribute("cy", h.y.toFixed(1));
  PAIRS.forEach(([ph], i) => {
    const k = easeOut(win(t, at + i * 0.2, at + i * 0.2 + 0.4));
    const a = -ph * D2R;
    const e = wp(x0, Math.cos(a) * 120 * k, Math.sin(a) * 120 * k, crank);
    armEls[i].ln.setAttribute("d", `M ${h.x.toFixed(1)} ${h.y.toFixed(1)} L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
    armEls[i].ln.setAttribute("opacity", k > 0.01 ? 1 : 0);
    const l = wp(x0, Math.cos(a) * 165, Math.sin(a) * 165, crank);
    const lk = clamp01((k - 0.7) / 0.3) * easeOut(win(t, 47.67, 47.9));
    armEls[i].c.setAttribute("x", (l.x - 65).toFixed(1)); armEls[i].c.setAttribute("y", (l.y - 28).toFixed(1));
    armEls[i].tx.setAttribute("x", l.x.toFixed(1)); armEls[i].tx.setAttribute("y", l.y.toFixed(1));
    armEls[i].c.setAttribute("opacity", lk); armEls[i].tx.setAttribute("opacity", lk);
  });
}
// strzałki kołysania na końcach silnika
const rockEls = [0, 1, 2, 3].map((i) => mkEl("path", { fill: "none", stroke: i < 2 ? "#f5aa3c" : "#7cc4ff", "stroke-width": 7, "stroke-linecap": "round" }, $("rock")));
function rockArrow(el, c, sgn, amp, col) {
  if (amp < 0.02) { el.setAttribute("opacity", 0); return; }
  const L = 80 * amp, y1 = c.y - L, y2 = c.y + L, tip = sgn > 0 ? y1 : y2, bk = sgn > 0 ? 24 : -24;
  el.setAttribute("d", `M ${c.x.toFixed(1)} ${y1.toFixed(1)} L ${c.x.toFixed(1)} ${y2.toFixed(1)} M ${(c.x - 20).toFixed(1)} ${(tip + bk).toFixed(1)} L ${c.x.toFixed(1)} ${tip.toFixed(1)} L ${(c.x + 20).toFixed(1)} ${(tip + bk).toFixed(1)}`);
  el.setAttribute("opacity", 0.95);
}
// tarcza zapłonu: 6 znaczników co 120° w cyklu 720°
const dialTicks = K.FIRE_ANGLE.map(() => mkEl("circle", { r: 11 }, $("dialTicks")));
const orderEls = [...document.querySelectorAll("#order span")];

/* ================= górny blok ================= */
const TOPS = [
  [3.47, "Na końcu zobaczysz", "Czemu Mercedes <span class=\"hot\">wyrzucił V6</span>"],
  [7.27, "Na końcu zobaczysz", "I wrócił do <em>R6</em>?"],
  [15.41, "BMW", "Szóstki <em>od lat 30.</em>"],
  [25.53, "Tylko że", "Jest <span class=\"hot\">długi</span>"],
  [29.33, "Więc dlaczego", "Inżynierowie go <em>kochają</em>?"],
  [31.89, "Budowa", "6 cylindrów <em>w rzędzie</em>"],
  [33.93, "Budowa", "Jeden <em>blok</em>"],
  [34.78, "Budowa", "Jedna <em>głowica</em>"],
  [35.82, "Budowa", "Jeden <em>wał</em>"],
  [36.73, "Zapłon", "Co <em>120°</em>"],
  [38.64, "Zapłon", "W kolejności"],
  [47.09, "Wał", "3 pary <em>wykorbień</em>"],
  [48.58, "Wał", "Co <em>120°</em>"],
  [50.64, "Wał", "Strzela <span class=\"ok\">równo</span>"],
  [52.37, "Prawdziwy sekret", "Jest <em>inny</em>"],
  [54.25, "Prawdziwy sekret", "Każdy tłok <span class=\"hot\">szarpie</span>"],
  [66.05, "Sekret", "Dwa <em>trzycylindrowce</em>"],
  [68.24, "Sekret", "Złożone <em>lustrzanie</em>"],
  [69.65, "Sekret", "Przód = <em>odbicie tyłu</em>"],
  [71.25, "Sekret", "Kołysanie <span class=\"ok\">gaśnie</span>"],
  [78.93, "Rzędowa szóstka", "To nie <em>marketing</em>"],
  [89.09, "Moment", "Zanim jeden <em>skończy</em>"],
  [91.0, "Moment", "Kolejny <em>już pcha</em>"],
  [94.53, "Wał", "Łożysko <em>między każdą parą</em>"],
  [98.49, "Wał", "Most na <em>7 filarach</em>"],
  [114.33, "Uczciwie", "Ma <span class=\"hot\">dwie wady</span>"],
  [120.33, "Wada 2", "Wał skręca się <span class=\"ice\">jak sprężyna</span>"],
  [122.77, "Wada 2", "Stąd <em>tłumik drgań</em>"],
  [131.21, "A teraz", "<em>Obiecane</em>"],
  [143.53, "Dlaczego", "Jeden <em>kolektor</em>"],
  [146.08, "Dlaczego", "Jedno miejsce <em>na turbo</em>"],
  [149.77, "Dlaczego", "Łatwiej <em>doładować</em>"],
  [151.43, "Dlaczego", "Łatwiej przez <em>normy</em>"],
  [158.45, "Ponad sto lat", "Znowu <em>wygrywa</em>"],
  [166.85, "Podsumowanie", "Idealne <em>wyważenie</em>"],
  [169.32, "Podsumowanie", "Wał na <em>7 łożyskach</em>"],
];
const TOP_OFF = [[0, 3.45], [9.1, 15.35], [18.6, 25.45], [42.7, 47.0], [58.05, 66.0], [74.1, 78.9], [80.95, 89.0], [92.25, 93.9], [101.0, 114.3], [116.1, 120.3], [125.5, 131.2], [132.5, 143.5], [153.3, 158.45], [161.7, 166.8], [168.1, 169.3], [170.8, D + 1]];
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
const listRows = rowsOf("gList"), kontraRows = rowsOf("gKontra"), backRows = rowsOf("gBack");
function drawRows(rows, t, recap) {
  rows.forEach((r) => {
    if (recap) { r.el.style.opacity = 1; r.el.style.transform = "none"; } else pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = recap ? 1 : easeOut(win(t, r.st, r.st + 0.16)); r.stEl.style.opacity = k; r.stEl.style.transform = "scale(" + (1 + (1 - k) * 0.6).toFixed(3) + ")"; }
    if (r.xEl) r.xEl.style.transform = "scaleX(" + easeOut(win(t, r.x, r.x + 0.25)).toFixed(3) + ")";
  });
}
// wykres momentu: 6 garbów po 180° co 120°
const GX = (deg) => 90 + (deg / 720) * 740, GB = 1330, GA = 300;
const humpD = (off, frac = 1) => {
  let d = "", started = false;
  for (let s = 0; s <= 180 * frac + 0.01; s += 4) {
    const deg = off + s, wr = deg >= 720;
    const x = GX(wr ? deg - 720 : deg), y = GB - Math.sin(s / 180 * Math.PI) * GA;
    d += (!started || (started && wr && off + s - 4 < 720) ? "M " : " L ") + x.toFixed(1) + " " + y.toFixed(1);
    started = true;
  }
  return d;
};
const humps = Array.from({ length: 6 }, (_, i) => mkEl("path", { fill: i === 5 ? "none" : "rgba(245,170,60,0.08)", stroke: "rgba(238,242,247,0.6)", "stroke-width": 3, d: humpD(i * 120) }, $("grHumps")));
{
  let sd = "";
  for (let deg = 0; deg <= 720; deg += 3) {
    let sum = 0;
    for (let i = 0; i < 6; i++) { const x = wrap(deg - i * 120, 720); if (x < 180) sum += Math.sin(x / 180 * Math.PI); }
    sd += (deg ? " L " : "M ") + GX(deg).toFixed(1) + " " + (GB - sum * GA * 0.62 - 4).toFixed(1);
  }
  $("grSum").setAttribute("d", sd);
}
const bracket = (x0, x1, y) => `M ${x0.toFixed(1)} ${y + 18} L ${x0.toFixed(1)} ${y} L ${x1.toFixed(1)} ${y} L ${x1.toFixed(1)} ${y + 18}`;
// czwórka: 4 tłoki, szarpnięcie 2. rzędu i wałki wyważające
const I4 = { pist: [], arrow: null, shafts: [] };
{
  const g = $("i4G");
  for (let i = 0; i < 4; i++) {
    const x = 210 + i * 170;
    mkEl("rect", { x: x - 70, y: 620, width: 140, height: 330, fill: "rgba(150,165,182,0.08)", stroke: "rgba(150,165,182,0.5)", "stroke-width": 3 }, g);
    I4.pist.push(mkEl("rect", { x: x - 62, width: 124, height: 90, rx: 8, fill: "#8a95a2", stroke: "#d6dde5", "stroke-width": 3 }, g));
  }
  I4.arrow = mkEl("path", { fill: "none", stroke: "#ff6a4d", "stroke-width": 14, "stroke-linecap": "round" }, g);
  for (let i = 0; i < 2; i++) {
    const cx = 330 + i * 300;
    mkEl("circle", { cx, cy: 1180, r: 70, fill: "rgba(20,26,34,0.95)", stroke: "rgba(150,165,182,0.6)", "stroke-width": 3 }, g);
    I4.shafts.push(mkEl("path", { fill: "#f5aa3c" }, g));
  }
  const t1 = mkEl("text", { x: 480, y: 1300, "text-anchor": "middle" }, g); t1.textContent = "WAŁKI WYWAŻAJĄCE, 2x OBROTY WAŁU";
  I4.label = t1;
}
// fale dźwięku
const pulsesAt = (pattern, T, tt, look) => {
  const out = [];
  const c0 = Math.floor((tt - look) / T) - 1, c1 = Math.floor(tt / T) + 1;
  for (let c = c0; c <= c1; c++) pattern.forEach((f, i) => { const p = (c + f) * T; if (p <= tt && p > tt - look) out.push([p, i]); });
  return out;
};
function wavePath(x0, x1, y, amp, t, o) {
  let d = "";
  const spp = o.window / (x1 - x0);
  for (let x = x0; x <= x1; x += 3) {
    const tt = t - (x1 - x) * spp;
    let v = 0;
    for (const [p, i] of pulsesAt(o.pattern, o.T, tt, 0.4)) {
      const dt = tt - p, a = o.lumpy ? (i % 2 ? 0.7 : 1.0) : 1;
      v += a * Math.exp(-dt / o.tau) * Math.sin(2 * Math.PI * o.f * dt);
    }
    if (o.rough) v += 0.35 * Math.sin(tt * 310) * Math.sin(tt * 47);
    d += (x === x0 ? "M " : " L ") + x.toFixed(1) + " " + (y - Math.max(-1.3, Math.min(1.3, v)) * amp).toFixed(1);
  }
  return d;
}
const W_V8 = { pattern: [0, 0.25, 0.375, 0.625], T: 0.5, tau: 0.075, f: 26, window: 1.3, lumpy: true };
const W_R4 = { pattern: [0, 0.5], T: 0.28, tau: 0.05, f: 34, window: 1.3, rough: true };
const W_R6 = { pattern: [0, 1 / 3, 2 / 3], T: 0.2, tau: 0.045, f: 48, window: 1.3 };
// wnęka silnika: rzędowa szóstka w poprzek się nie mieści
{
  const g = $("bayEng");
  mkEl("rect", { x: 100, y: 855, width: 130, height: 150, rx: 10, fill: "#232b36", stroke: "rgba(150,165,182,0.6)", "stroke-width": 2 }, g);
  const tt = mkEl("text", { x: 165, y: 938, "text-anchor": "middle", style: "font-size:17px;letter-spacing:0.1em" }, g); tt.textContent = "SKRZYNIA";
  mkEl("rect", { x: 230, y: 872, width: 590, height: 116, rx: 12, fill: "rgba(150,165,182,0.10)", stroke: "#b6c1cf", "stroke-width": 3 }, g);
  for (let i = 0; i < 6; i++) mkEl("circle", { cx: 287 + i * 95, cy: 930, r: 38, fill: "#1a222c", stroke: "#f5aa3c", "stroke-width": 4 }, g);
}
// moduły po pół litra
const modCubes = [];
{
  const g = $("modG");
  const row = (n, y, lab, at) => {
    for (let i = 0; i < n; i++) {
      const x = 90 + i * 128;
      const r = mkEl("g", {}, g);
      mkEl("rect", { x, y, width: 112, height: 150, rx: 10, fill: "rgba(245,170,60,0.18)", stroke: "#f5aa3c", "stroke-width": 4 }, r);
      const tx = mkEl("text", { x: x + 56, y: y + 88, "text-anchor": "middle", style: "font-size:30px;font-weight:600;fill:#eef2f7;letter-spacing:0" }, r); tx.textContent = "0,5 l";
      modCubes.push({ r, at: at + i * 0.12, y });
    }
    const l = mkEl("text", { x: 90, y: y - 22 }, g); l.textContent = lab;
    modCubes.push({ r: l, at, y, isLab: true });
  };
  row(4, 600, "CZTERY CYLINDRY · 2,0 L", 153.34);
  row(6, 900, "SZEŚĆ CYLINDRÓW · 3,0 L", 153.85);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  const recap = t > 166;
  if (id === "gList") drawRows(listRows, t, false);
  else if (id === "gKontra") drawRows(kontraRows, t, false);
  else if (id === "gBack") {
    drawRows(backRows, t, recap);
    const q = $("whyQ");
    const qk = recap ? 0 : easeOut(win(t, 142.77, 142.95));
    q.style.opacity = qk;
    q.style.transform = "scale(" + (1.5 - 0.5 * qk).toFixed(3) + ")";
    $("gBack").querySelector(".rows").style.opacity = recap ? 1 : 1 - easeIO(win(t, 142.6, 142.8));
  } else if (id === "gI4") {
    const h = t >= 60.93 ? "Dlatego <em>wałki wyważające</em>" : "W czwórce <span class=\"hot\">część zostaje</span>";
    if ($("i4H").innerHTML !== h) $("i4H").innerHTML = h;
    pop($("i4H"), t, t >= 60.93 ? 60.93 : 58.13, 0.24, 20);
    const a = t * 7.5;
    I4.pist.forEach((p, i) => {
      const s = i === 0 || i === 3 ? 1 : -1;
      const y = 700 + 110 * (1 - Math.cos(a) * s) / 2 + 22 * Math.cos(2 * a) * 0.4;
      p.setAttribute("y", y.toFixed(1));
    });
    const k = easeOut(win(t, 59.8, 60.1));
    const amp = 70 * Math.cos(2 * a) * k;
    I4.arrow.setAttribute("d", `M 480 ${(560 - amp).toFixed(1)} L 480 ${(560 + amp).toFixed(1)} M 462 ${(560 + amp - Math.sign(amp) * 22).toFixed(1)} L 480 ${(560 + amp).toFixed(1)} L 498 ${(560 + amp - Math.sign(amp) * 22).toFixed(1)}`);
    I4.arrow.setAttribute("opacity", k);
    const sk = easeOut(win(t, 60.93, 61.2));
    I4.shafts.forEach((s, i) => {
      const ang = (i ? -1 : 1) * a * 2, cx = 330 + i * 300;
      const x1 = cx + Math.cos(ang) * 62, y1 = 1180 + Math.sin(ang) * 62, x2 = cx + Math.cos(ang + Math.PI) * 62, y2 = 1180 + Math.sin(ang + Math.PI) * 62;
      s.setAttribute("d", `M ${cx} 1180 L ${x1.toFixed(1)} ${y1.toFixed(1)} A 62 62 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`);
      s.setAttribute("opacity", sk);
    });
    I4.label.setAttribute("opacity", sk);
  } else if (id === "gZero") {
    [...$("gZero").querySelectorAll(".zr")].forEach((r, i) => {
      const at = [74.17, 74.57, 75.25][i];
      pop(r, t, at, 0.24, 30);
      const zs = r.querySelector(".zs");
      const done = t >= 75.86 + i * 0.12;
      const txt = done ? "0" : String(Math.floor(hash(Math.floor(t * 18) + i * 7) * 90 + 10));
      if (zs.textContent !== txt) zs.textContent = txt;
      r.querySelector("b").style.color = done ? "#86dba1" : "#ff6a4d";
    });
    const sg = $("shG");
    sg.setAttribute("opacity", easeOut(win(t, 76.65, 76.95)));
    const ang = t * 14;
    [["shW1", 330], ["shW2", 750]].forEach(([mid, cx], i) => {
      const off = Math.sin(ang + i * Math.PI) * 40;
      $(mid).setAttribute("d", `M ${cx - 70} ${1198 + off - 60} h 140 a 16 16 0 0 1 16 16 v 88 a 16 16 0 0 1 -16 16 h -140 a 16 16 0 0 1 -16 -16 v -88 a 16 16 0 0 1 16 -16 z`);
    });
    dash($("shX1"), easeOut(win(t, 77.02, 77.25)));
    dash($("shX2"), easeOut(win(t, 77.2, 77.45)));
  } else if (id === "gGraph") {
    const phase2 = t >= 92 || recap;
    const h0 = phase2 ? 1 : win(t, 83.77, 85.2);
    humps[0].setAttribute("d", humpD(0, Math.max(0.02, easeIO(h0))));
    humps.forEach((h, i) => {
      if (i === 0) return;
      const k = phase2 ? 1 : easeOut(win(t, 85.84 + i * 0.16, 86.04 + i * 0.16));
      h.setAttribute("opacity", k);
      h.setAttribute("transform", "translate(0 " + ((1 - k) * 40).toFixed(1) + ")");
    });
    const b1 = phase2 ? 0 : easeOut(win(t, 84.6, 84.9)) * (1 - win(t, 85.7, 85.9));
    $("grBr").setAttribute("d", bracket(GX(0), GX(180), GB - GA - 60)); $("grBr").setAttribute("opacity", b1);
    const t1 = $("grBrT"); t1.setAttribute("x", GX(90)); t1.setAttribute("y", GB - GA - 72); t1.setAttribute("opacity", b1);
    const b2 = phase2 ? 0 : easeOut(win(t, 88.02, 88.3));
    $("grBr2").setAttribute("d", bracket(GX(0), GX(120), GB - GA - 60)); $("grBr2").setAttribute("opacity", b2);
    const t2 = $("grBr2T"); t2.setAttribute("x", GX(60)); t2.setAttribute("y", GB - GA - 72); t2.setAttribute("opacity", b2);
    $("grSum").setAttribute("opacity", phase2 ? easeOut(win(t, recap ? 168.1 : 92.29, (recap ? 168.1 : 92.29) + 0.3)) : 0);
    const big = $("grBig");
    const txt = phase2 ? "" : t >= 88.02 ? "120°" : "180°";
    if (big.textContent !== txt) big.textContent = txt;
    pop(big, t, t >= 88.02 ? 88.02 : 84.6, 0.22, 30);
    const hh = phase2 ? "Moment <em>bez dziur</em>" : t >= 85.84 ? "Zapłon <em>co 120°</em>" : "Suw pracy <em>180°</em>";
    if ($("grH").innerHTML !== hh) $("grH").innerHTML = hh;
    pop($("grH"), t, phase2 ? (recap ? 168.1 : 92.29) : t >= 85.84 ? 85.84 : 83.77, 0.22, 20);
  } else if (id === "gHp") {
    const k = easeOut(win(t, 101.05, 104.09));
    const hp = Math.round(k * 1000);
    $("hpN").textContent = t >= 104.09 ? "1000+" : String(hp);
    $("hpN").style.color = t >= 104.09 ? "#ff6a4d" : "#f5aa3c";
    $("hpB").setAttribute("width", (780 * k).toFixed(1));
    $("hpB").setAttribute("fill", k > 0.33 ? "#ff6a4d" : "#f5aa3c");
  } else if (id === "gWaves") {
    [["wv1", "wa1", 109.33, W_V8, 700], ["wv2", "wa2", 110.99, W_R4, 1000], ["wv3", "wa3", 112.69, W_R6, 1300]].forEach(([wid, pid, at, o, y]) => {
      const k = pop($(wid), t, at, 0.24, 30);
      $(pid).setAttribute("d", wavePath(78, 1002, y, 90 * k, t, o));
      $(pid).setAttribute("opacity", k);
    });
  } else if (id === "gBay") {
    const k = easeOut(win(t, 116.3, 116.8));
    $("bayEng").setAttribute("transform", `translate(0 ${((1 - k) * -520).toFixed(1)})`);
    const ov = t > 119.59 ? 0.55 + 0.45 * Math.sin((t - 119.59) * 14) ** 2 : 0;
    $("ovL").setAttribute("opacity", ov); $("ovR").setAttribute("opacity", ov);
  } else if (id === "gMod") {
    modCubes.forEach((c) => {
      const k = backOut(win(t, c.at, c.at + 0.3));
      c.r.setAttribute("opacity", clamp01(k * 2));
      c.r.setAttribute("transform", c.isLab ? "" : `translate(0 ${((1 - k) * -260).toFixed(1)})`);
    });
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Wydech", "Turbo", "Koszty", "Normy", "Cylindry"];
const RN = RW.length, RROW = 50;
const BURSTS = [[3.6, 4.8, 2 * RN], [21.8, 22.6, 2 * RN], [52.4, 53.2, 2 * RN], [93.95, 94.7, 2 * RN], [142.8, 143.99, 2 * RN + 5]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 3.5, 145.6);
  rb.style.opacity = rOn ? (easeOut(win(t, 3.5, 3.75)) * (1 - easeIO(win(t, 145.2, 145.6)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const w0 = i0 === FIN ? "Jeden rząd" : RW[i0 % RN], w1 = i0 + 1 === FIN ? "Jeden rząd" : RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= 143.99;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Odpowiedź:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    $("reelFlash").style.opacity = done ? (0.85 * Math.max(0, 1 - (t - 143.99) / 0.4)).toFixed(3) : 0;
    let bump = 0;
    for (const [, b] of BURSTS) if (t >= b && t < b + 0.25) bump = Math.sin(((t - b) / 0.25) * Math.PI) * 6;
    const big = Math.max(easeOut(win(t, 3.5, 3.8)) * (1 - easeIO(win(t, 4.9, 5.25))), easeIO(win(t, 142.6, 142.9)) * (1 - easeIO(win(t, 144.7, 145.1))));
    rb.style.transform = "translate(" + (-40 * big).toFixed(1) + "px," + (880 * big - bump).toFixed(1) + "px) scale(" + (1 + 0.7 * big).toFixed(3) + ")";
  }
  const pc = $("pickCard");
  const pOn = inR(t, 161.8, 166.8);
  pc.style.opacity = pOn ? (easeOut(win(t, 161.8, 162.1)) * (1 - easeIO(win(t, 166.5, 166.8)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 161.8, 162.1))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 162.32 ? (t < 163.39 ? 1 : 0.5 + 0.5 * Math.sin((t - 163.4) * 7)) : 0;
    const gB = t > 163.39 ? (t < 164.9 ? 1 - gA * 0.5 : 0.5 - 0.5 * Math.sin((t - 163.4) * 7)) : 0;
    on("pkA", gA); on("pkB", gB);
    $("pickC").style.opacity = easeOut(win(t, 164.93, 165.2));
  }
  const sc = $("serCard");
  const sOn = inR(t, 158.6, 161.65);
  sc.style.opacity = sOn ? (easeOut(win(t, 158.6, 158.95)) * (1 - easeIO(win(t, 161.3, 161.65)))).toFixed(3) : 0;
  if (sOn) {
    sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 158.6, 159.0))) * -60).toFixed(1) + "px)";
    $("serBtn").style.transform = "scale(" + (1 + 0.08 * Math.max(0, Math.sin((t - 159.0) * 7))).toFixed(3) + ")";
  }
  const fl = (a, dur, amp) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0);
  $("flash").style.opacity = Math.max(fl(47.0, 0.18, 0.5), fl(66.0, 0.16, 0.35), fl(143.5, 0.2, 0.4), fl(78.93, 0.16, 0.3)).toFixed(3);
}

/* ================= render klatki ================= */
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: +el.dataset.t }));
const hkChips = [...document.querySelectorAll("#hkC .hc")].map((el) => ({ el, t: +el.dataset.t }));
const chipSets = ["chLen", "chTurbo", "chNorm"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));

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
  const { s, shk } = states(t, name);
  poseS54(s, deg, t);
  // V6: tylko w ujęciach dzielonych
  const v6on = SPLIT.has(name);
  E6.root.visible = v6on;
  if (v6on) {
    E6.updateCrank(t * 90);
    const cutMode = name === "splitCut";
    v6Hide.forEach((o) => { o.visible = !cutMode; });
    for (const id in j6) j6[id].material.emissiveIntensity = cutMode && (id === "1" || id === "2") ? 2.6 * (0.8 + 0.2 * Math.sin(t * 6)) : 0;
    E6.root.updateMatrixWorld(true);
  }
  const split = SPLIT.has(name);
  if (split) { applyCam(t, name + "A", 0, camera); applyCam(t, name + "B", 0, cameraB); }
  else applyCam(t, name, shk);

  /* ---- hook ---- */
  const hookOn = name === "hook", loopEnd = name === "outro" && t >= 172.4;
  show($("hk"), hookOn || loopEnd);
  if (hookOn) {
    $("hkK").style.opacity = 1;
    hkWords.forEach((w) => pop(w.el, t, w.t, 0.18, 30));
    hkChips.forEach((c) => { const k = backOut(win(t, c.t, c.t + 0.22)); c.el.style.opacity = clamp01(k * 3); c.el.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")"; });
  } else if (loopEnd) {
    hkWords.forEach((w) => { w.el.style.opacity = 0; });
    hkChips.forEach((c) => { c.el.style.opacity = 0; });
    $("hkK").style.opacity = easeOut(win(t, 172.4, 172.8));
  }
  drawTop(t);

  /* ---- 3D -> 2D ---- */
  projCam = camera;
  // wymiar długości bloku
  const lenOn = name === "length";
  const dk = lenOn ? easeOut(win(t, 25.6, 26.3)) : 0;
  if (lenOn) {
    const a = wp(-K.HALF_LENGTH, -200, 150), b = wp(lerp(-K.HALF_LENGTH, K.HALF_LENGTH, dk), -200, 150);
    $("dimL").setAttribute("d", `M ${a.x.toFixed(1)} ${(a.y - 18).toFixed(1)} L ${a.x.toFixed(1)} ${(a.y + 18).toFixed(1)} M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} M ${b.x.toFixed(1)} ${(b.y - 18).toFixed(1)} L ${b.x.toFixed(1)} ${(b.y + 18).toFixed(1)}`);
  }
  $("dimL").setAttribute("opacity", dk);
  chipSets.forEach((cs) => {
    const on = (cs.el.id === "chLen" && lenOn) || (cs.el.id === "chTurbo" && name === "turbo") || (cs.el.id === "chNorm" && name === "norms");
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.2, 24));
  });
  // numery cylindrów
  const bOn = name === "anatomy";
  badges.forEach((el, i) => {
    if (!bOn) { el.style.opacity = 0; return; }
    const at = 31.95 + i * 0.12;
    const p = wp(K.CYL_X[i], K.pistonCrownY(i + 1, deg) + 40, 60);
    place(el, p.x, p.y);
    const k = easeOut(win(t, at, at + 0.16)) * (1 - win(t, 33.6, 33.9));
    el.style.opacity = k;
    el.style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")";
  });
  // tarcza i kolejność zapłonów
  const fOn = name === "firing";
  $("dial").setAttribute("opacity", fOn && t < 39.3 ? easeOut(win(t, 36.73, 37.0)) * (1 - win(t, 39.0, 39.3)) : 0);
  show($("order"), fOn);
  if (fOn) {
    const cm = wrap(deg, 720);
    const rad = (cm / 2 - 90) * D2R;
    $("dialP").setAttribute("x2", (200 + Math.cos(rad) * 92).toFixed(1));
    $("dialP").setAttribute("y2", (1290 + Math.sin(rad) * 92).toFixed(1));
    K.FIRE_ANGLE.forEach((fa, i) => {
      const r2 = (fa.angle / 2 - 90) * D2R, e = dialTicks[i];
      e.setAttribute("cx", (200 + Math.cos(r2) * 80).toFixed(1)); e.setAttribute("cy", (1290 + Math.sin(r2) * 80).toFixed(1));
      const x = wrap(cm - fa.angle, 720), k = x < 80 ? 1 - x / 80 : 0;
      e.setAttribute("r", (10 + 7 * k).toFixed(1));
      e.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
    });
    const ORD_T = [39.52, 40.14, 40.64, 41.2, 41.76, 42.32];
    let cur = -1;
    ORD_T.forEach((tk, i) => { if (t >= tk) cur = i; });
    orderEls.forEach((el, i) => {
      const k = backOut(win(t, ORD_T[i], ORD_T[i] + 0.2));
      el.style.opacity = clamp01(k * 3);
      el.style.transform = `scale(${(0.6 + 0.4 * k).toFixed(3)})`;
      el.classList.toggle("on", i === cur);
    });
  }
  // gwiazda wykorbień
  drawArms(t, name === "star", 47.3);
  // strzałka siły od tłoka 1
  const jOn = name === "jerk" && t > 55.3;
  $("force").setAttribute("opacity", jOn ? easeOut(win(t, 55.3, 55.6)) : 0);
  if (jOn) {
    const acc = pistonAcc(deg);
    const c = project(P.pistons[0].localToWorld(new THREE.Vector3(0, 60, 0)));
    const L = 160 * acc, y2 = c.y - L;
    $("forceS").setAttribute("d", `M ${c.x.toFixed(1)} ${c.y.toFixed(1)} L ${c.x.toFixed(1)} ${y2.toFixed(1)}`);
    const sg = Math.sign(L) || 1;
    $("forceH").setAttribute("d", `M ${(c.x - 30).toFixed(1)} ${(y2 + sg * 30).toFixed(1)} L ${c.x.toFixed(1)} ${(y2 - sg * 12).toFixed(1)} L ${(c.x + 30).toFixed(1)} ${(y2 + sg * 30).toFixed(1)} Z`);
  }
  // kołysanie: czerwone strzałki trzycylindrowca, potem przeciwne pary gaszą się
  const front = wp(-K.HALF_LENGTH - 30, 260, 0), rear = wp(K.HALF_LENGTH + 30, 260, 0);
  const sn = Math.sin(deg * D2R);
  if (name === "mirror" && t < 69.65) {
    rockArrow(rockEls[0], front, sn, Math.abs(sn), 0); rockArrow(rockEls[1], rear, -sn, Math.abs(sn), 0);
    rockEls[2].setAttribute("opacity", 0); rockEls[3].setAttribute("opacity", 0);
  } else if ((name === "mirror" && t >= 69.65) || name === "cancel") {
    const amp = name === "cancel" ? 1 - easeIO(win(t, 71.8, 73.2)) : 1;
    const f2 = wp(-K.HALF_LENGTH - 30, 90, 0), r2 = wp(K.HALF_LENGTH + 30, 90, 0);
    rockArrow(rockEls[0], front, sn, Math.abs(sn) * amp, 0); rockArrow(rockEls[1], rear, -sn, Math.abs(sn) * amp, 0);
    rockArrow(rockEls[2], f2, -sn, Math.abs(sn) * amp, 1); rockArrow(rockEls[3], r2, sn, Math.abs(sn) * amp, 1);
  } else rockEls.forEach((e) => e.setAttribute("opacity", 0));
  // płaszczyzna lustra
  const mOn = (name === "mirror" && t > 68.24) || name === "rc1";
  if (mOn) { const a = wp(0, -170, 0), b = wp(0, 440, 0); $("mirror").setAttribute("d", `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`); }
  $("mirror").setAttribute("opacity", mOn ? easeOut(win(t, name === "rc1" ? 166.8 : 68.24, (name === "rc1" ? 166.8 : 68.24) + 0.3)) : 0);
  // licznik: 7 łożysk, 2 wady
  const cntOn = name === "mains" || name === "flaws" || name === "rc3";
  $("cnt").style.opacity = cntOn ? 1 : 0;
  if (cntOn) {
    let n = 0, lab = "";
    if (name === "mains" || name === "rc3") { for (let i = 0; i < 7; i++) if (name === "rc3" || t >= 94.89 + i * 0.39) n = i + 1; lab = "<b>łożysk</b>głównych"; }
    else { n = t >= 115.12 ? 2 : 0; lab = "<b>wady</b>uczciwie"; }
    if ($("cntN").textContent !== String(n)) $("cntN").textContent = String(n);
    if ($("cntL").innerHTML !== lab) $("cntL").innerHTML = lab;
  }
  // filary mostu pod łożyskami
  const pilOn = name === "mains" && t > 98.49;
  const pg = $("pillars");
  pg.setAttribute("opacity", pilOn ? 1 : 0);
  if (pilOn) {
    while (pg.firstChild) pg.removeChild(pg.firstChild);
    const g0 = wp(MAIN_X[0] - 60, -190, 0), g1 = wp(MAIN_X[6] + 60, -190, 0);
    mkEl("path", { d: `M ${g0.x.toFixed(1)} ${g0.y.toFixed(1)} L ${g1.x.toFixed(1)} ${g1.y.toFixed(1)}`, stroke: "#b6c1cf", "stroke-width": 5, fill: "none" }, pg);
    MAIN_X.forEach((x, i) => {
      const k = easeOut(win(t, 98.6 + i * 0.12, 98.9 + i * 0.12));
      const a = wp(x, -40, 0), b = wp(x, -190, 0);
      mkEl("path", { d: `M ${a.x.toFixed(1)} ${lerp(b.y, a.y, k).toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`, stroke: "#f5aa3c", "stroke-width": 16, "stroke-linecap": "round", fill: "none", opacity: 0.85 }, pg);
    });
  }
  // wał jak sprężyna
  const spOn = name === "twist";
  $("spring").setAttribute("opacity", spOn ? easeOut(win(t, 120.9, 121.2)) : 0);
  if (spOn) {
    let d = "";
    const amp = 26 * (0.6 + 0.4 * Math.sin(t * 9));
    for (let i = 0; i <= 120; i++) {
      const x = lerp(-K.HALF_LENGTH - 40, K.HALF_LENGTH, i / 120);
      const a = i * 0.9 - t * 12;
      const p = wp(x, Math.sin(a) * 70, Math.cos(a) * 70, crank);
      d += (i ? " L " : "M ") + p.x.toFixed(1) + " " + (p.y + Math.sin(i * 0.2 - t * 8) * amp * 0.2).toFixed(1);
    }
    $("spring").setAttribute("d", d);
  }
  // stemple
  const stamp = (id, onS, at, x, y) => {
    const el = $(id);
    if (!onS) { el.style.opacity = 0; return; }
    const k = easeOut(win(t, at, at + 0.14));
    el.style.opacity = k;
    place(el, x, y);
    el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.8 - 0.8 * k).toFixed(3) + ")";
  };
  stamp("stCut", name === "splitCut" && t >= 45.39, 45.39, 540, 1300);
  stamp("stFiz", name === "fizyka" && t >= 80.1, 80.1, 540, 1150);
  stamp("stWin", name === "win" && t >= 160.51, 160.51, 540, 940);

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const pill = $("splitPill");
  const pillTxt = name === "splitCut" ? "Pamiętasz?" : "Koniec lat 90.";
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
  if (name === "splitCut") { setPl($("pA"), "V6", "Czop przecięty", "hot", 43.76); setPl($("pB"), "R6", t >= 45.39 ? "Nic nie tnie" : "", "ok", 45.39); }
  else if (name === "splitV6") { setPl($("pA"), "R6", t >= 129.3 ? "BMW zostaje" : "", "ok", 125.6); setPl($("pB"), "V6", "Prawie wszyscy", "hot", 127.87); }
  else { $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawTags(t);

  /* ---- render ---- */
  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - 840, W, 840);
  composer.render();
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - 840);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E, E6, camera, cameraB, composer, scene, SHOTS, K };
