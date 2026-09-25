// Panewki i 1200 obrotów, wersja 2: ten sam lektor, wizualia w stylu filmu o V8.
// Cały obraz jest czystą funkcją czasu (hf-seek), bez zegara i bez losowości.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/src/lib/materials.js";
import { buildStudioEnvironment, makeShadowFloor } from "../model/src/lib/environment.js";
import { buildEngine } from "../model/src/scene.js";
import * as L6 from "../model/src/lib/layout.js";
import { buildBearing, Rj, Ri, Ro, RoH, BW, CLEAR } from "./bearing.js";
import { buildTurbo } from "./turbo.js";

const W = 1080, H = 1920, D = 75.5;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const easeIn = (x) => { x = clamp01(x); return x * x * x; };
const backOut = (x) => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const pl = (v, d) => v.toFixed(d).replace(".", ",");
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
// całka z prędkości spróbkowana raz: kąt zawsze taki sam dla tej samej sekundy
function integral(f, dt = 1 / 240) {
  const n = Math.ceil(D / dt) + 2, tab = new Float64Array(n);
  for (let i = 1; i < n; i++) tab[i] = tab[i - 1] + f((i - 0.5) * dt) * dt;
  return (t) => { const x = Math.max(0, t) / dt, i = Math.min(n - 2, Math.floor(x)), k = x - i; return tab[i] * (1 - k) + tab[i + 1] * k; };
}

/* ================= ujęcia ================= */
// plate = plansza na b-rollu, 3d = scena, board = plansza graficzna, broll = wideo z napisami
const SHOTS = [
  [0, 5.26, "plate", "hook"],
  [5.26, 6.60, "3d", "dive"],
  [6.60, 8.20, "3d", "gap"],
  [8.20, 12.10, "3d", "oil"],
  [12.10, 13.40, "3d", "rpm"],
  [13.40, 16.50, "3d", "wedge"],
  [16.50, 18.65, "3d", "splitRpm"],
  [18.65, 21.85, "plate", "plate2"],
  [21.85, 24.40, "3d", "thin"],
  [24.40, 26.30, "3d", "splitCyl"],
  [26.30, 27.90, "broll"],
  [27.90, 30.22, "3d", "turbo"],
  [30.22, 32.20, "3d", "load"],
  [32.20, 36.48, "board", "gPump"],
  [36.48, 39.36, "board", "gNeed"],
  [39.36, 42.40, "broll"],
  [42.40, 46.88, "3d", "shock"],
  [46.88, 48.72, "3d", "dmf"],
  [48.72, 51.14, "board", "gRoar"],
  [51.14, 53.36, "3d", "ok"],
  [53.36, 56.33, "3d", "problem"],
  [56.33, 59.60, "board", "gRule"],
  [59.60, 61.38, "broll"],
  [61.38, 69.93, "board", "gLcd"],
  [69.93, 74.30, "3d", "blind"],
  [74.30, D + 1, "plate", "outro"],
];
const shotAt = (t) => { for (const s of SHOTS) if (t >= s[0] && t < s[1]) return s; return SHOTS[SHOTS.length - 1]; };
const SPLIT = new Set(["splitRpm", "splitCyl"]);

/* ================= fizyka łożyska (schematycznie) ================= */
// obroty czopu w ujęciach z łożyskiem; w "klinie" wał rusza od zera i sam się podnosi na oleju
const rpmB = (t) => {
  if (t < 12.3) return 2000;
  if (t < 13.4) return lerp(2000, 3000, easeIO(win(t, 12.3, 12.9)));
  if (t < 16.5) return 3000 * easeIn(win(t, 13.49, 15.3)) * 0.35 + 3000 * easeIO(win(t, 13.9, 15.6)) * 0.65;
  if (t < 51.14) return lerp(3000, 1200, easeIO(win(t, 16.73, 17.6)));
  if (t < 69.9) return 1300;
  return 1200;
};
const loadB = (t) => {
  if (t < 25.9) return 0;
  if (t < 30.22) return 0.55 * easeOut(win(t, 25.98, 26.3));
  if (t < 32.2) return easeOut(win(t, 30.5, 30.72));
  if (t < 53.36) return 0;
  if (t < 69.9) return easeOut(win(t, 55.55, 55.8));
  return 1;
};
const eccOf = (rpm, load) => {
  const rn = clamp01((rpm - 900) / 2100);
  let base = 0.215 - 0.165 * rn;
  if (rpm < 900) base = lerp(CLEAR - 0.006, 0.215, clamp01(rpm / 900));
  return Math.min(base + load * (CLEAR - base - 0.006), CLEAR - 0.006);
};
// na ekranie 1500 obr/min to jeden obrót na sekundę, żeby kreskowanie czopu dało się śledzić
const OMEGA = (2 * Math.PI) / 1500;
const angB = integral((t) => rpmB(t) * OMEGA);
const angTop = (t) => angB(16.5) + 3000 * OMEGA * (t - 16.5);
const umOf = (e) => ((CLEAR - e) / CLEAR) * 9;
const fillB = (t) => (t < 8.2 ? 0 : t < 12.1 ? easeIO(win(t, 8.3, 9.75)) : 1);

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
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
const key = new THREE.DirectionalLight(0xfffaf2, 2.5);
key.position.set(1400, 2100, 1600);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 300, far: 6500, left: -900, right: 900, top: 900, bottom: -900 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6; key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.32); fill.position.set(-1700, 800, 1200); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-600, 1300, -1900); scene.add(rim);
const bounce = new THREE.DirectionalLight(0xd9c7a8, 0.22); bounce.position.set(400, -900, 300); scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.45));
const floor = makeShadowFloor(9000);
floor.position.y = -196;
floor.material.depthWrite = false;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(36, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(36, W / H, 20, 16000);

/* ================= silnik V6 (model Antoniego) ================= */
const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10);
const glowMats = (obj, col = RED) => {
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
const engine = buildEngine(M);
applyMaterialVariation(engine.root, M);
engine.ring.visible = false;
engine.charge.visible = false;
scene.add(engine.root);
const crank = engine.rotating.crank, flywheel = engine.rotating.flywheel;
const cyl = (id) => engine.rotating.cylinders.find((c) => c.def.id === id);
const E = { journals: {} };
crank.traverse((o) => {
  if (!o.isMesh) return;
  const m = /^Crank_RodJournal_Cyl(\d)$/.exec(o.name);
  if (m) { o.material = M.steel.clone(); o.material.emissive = RED.clone(); o.material.emissiveIntensity = 0; E.journals[m[1]] = o.material; }
});
const glowPiston = glowMats(cyl(1).piston), glowRod = glowMats(cyl(1).rod), glowFly = glowMats(flywheel);
const glowCrank = [];
crank.children.forEach((o) => { if (o.isMesh && /Counterweight|Shaft|Main/.test(o.name)) glowCrank.push(...glowMats(o)); });
// błyski zapłonu i świecenie suwu pracy
const flashes = L6.CYLINDERS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(52, 24, 16), mat);
  const d = L6.BANK_DIR[c.bank], s = L6.LAYOUT.deckHeight - 24;
  m.position.set(d.x * s, d.y * s, c.z);
  m.scale.set(1, 0.7, 1);
  m.visible = false;
  engine.root.add(m);
  return { c, m, mat };
});
const pows = L6.CYLINDERS.map((c) => {
  const d = L6.BANK_DIR[c.bank], axis = new THREE.Vector3(d.x, d.y, 0).normalize();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 1, 32), mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  m.visible = false;
  engine.root.add(m);
  return { c, m, mat, axis };
});
// jednostki do rozrzucania (S) i chowania osprzętu (core)
engine.root.updateMatrixWorld(true);
const pistonsRoot = engine.rotating.root.getObjectByName("PISTONS_AND_RODS");
const partRoots = new Set([engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root, engine.rotating.root, pistonsRoot]);
const units = [], seen = new Set();
const center = new THREE.Vector3(0, 150, 0);
function addUnit(o) {
  if (!o || seen.has(o) || o === pistonsRoot) return;
  seen.add(o);
  const box = new THREE.Box3().setFromObject(o);
  const cw = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const dir = cw.clone().sub(center);
  if (dir.lengthSq() < 1) dir.set(0, 1, 0);
  dir.normalize(); dir.y += 0.25; dir.normalize();
  const qInv = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const i = units.length;
  units.push({
    o, base: o.position.clone(),
    top: partRoots.has(o.parent) || o === engine.intake.root,
    sdir: dir.applyQuaternion(qInv), smag: 2400 + hash(i) * 1200, kS: hash(i + 17),
    isCrank: o === crank, isFly: o === flywheel,
    core: /^HEADER_|^CAM_COVER_|^TIMING_COVER$/.test(o.name) || o.parent === engine.accessories.root || o === engine.intake.root || o === engine.rotating.timing,
  });
}
engine.explodeGroups.forEach(addUnit);
[engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root].forEach((r) => r.children.slice().forEach(addUnit));
addUnit(engine.intake.root);
engine.rotating.root.children.slice().forEach((c) => { if (c !== crank && c !== pistonsRoot) addUnit(c); });
pistonsRoot.children.slice().forEach(addUnit);
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const crank6 = (() => {
  // wał V6: wolno w ujęciu z uderzeniem, szybciej przy zapłonach
  const segs = [[24.4, 150], [26.3, 260], [42.4, 150], [46.88, 45], [48.72, 110], [D, 110]];
  const K = [[0, 0]];
  let ca = 0, ct = 0;
  for (const [t1, w] of segs) { ca += w * (t1 - ct); ct = t1; K.push([ct, ca]); }
  return mono(K);
})();

/* ================= łożysko i turbo: osobne "stanowiska" daleko od silnika ================= */
// kamera ma zasięg 16 m, więc stanowiska oddalone o 40 m i więcej nigdy się nie widzą nawzajem
const BP = new THREE.Vector3(0, -80000, 0), TP = new THREE.Vector3(0, -80000, 45000);
const bear = buildBearing();
bear.group.position.copy(BP);
bear.group.scale.setScalar(100);
scene.add(bear.group);
const turbo = buildTurbo();
turbo.group.position.copy(TP);
turbo.group.scale.setScalar(100);
scene.add(turbo.group);
const turboSpin = integral((t) => (t < 27.9 ? 6 : 6 + 34 * easeIO(win(t, 27.94, 28.9))));

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
  Object.assign(ssaoPass, { kernelRadius: 190, minDistance: 40, maxDistance: 1400 });
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
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const PB = (az, el, r, x, y, z, fov, oy) => P(az, el, r, BP.x + x, BP.y + y, BP.z + z, fov, oy);
const PT = (az, el, r, x, y, z, fov, oy) => P(az, el, r, TP.x + x, TP.y + y, TP.z + z, fov, oy);
const FR = Math.PI / 2, REAR = -Math.PI / 2;
const OYA = 400, OYB = -150;
const CAM = {
  dive: [[5.26, P(0.72, 0.2, 2700, 0, 110, 0, 34, 80)], [5.9, P(0.85, 0.12, 1500, 0, 60, 60, 34, 60)], [6.6, P(1.0, 0.05, 420, 0, 0, 108, 38, 0)]],
  gap: [[6.6, PB(FR + 0.08, 0.05, 2150, 0, 0, 0, 32, 170)], [8.2, PB(FR - 0.02, 0.03, 1900, 0, -30, 0, 32, 170)]],
  oil: [[8.2, PB(FR - 0.35, 0.22, 2000, 0, 0, 0, 32, 180)], [10.4, PB(FR - 0.2, 0.14, 1750, 0, -20, 0, 32, 180)], [12.1, PB(FR - 0.14, 0.1, 1700, 0, -30, 0, 32, 180)]],
  rpm: [[12.1, PB(FR + 0.5, 0.3, 1950, 0, 0, 0, 32, 170)], [13.4, PB(FR + 0.25, 0.18, 1800, 0, 0, 0, 32, 170)]],
  wedge: [[13.4, PB(FR + 0.03, 0.02, 900, 0, -95, 0, 32, 60)], [15.2, PB(FR - 0.05, 0.02, 1100, 0, -85, 0, 32, 80)], [16.5, PB(FR - 0.12, 0.06, 2100, 0, -60, 0, 32, 230)]],
  splitRpmA: [[16.5, PB(FR - 0.12, 0.06, 2100, 0, -40, 0, 30, 360)], [18.65, PB(FR - 0.04, 0.04, 1950, 0, -40, 0, 30, 360)]],
  splitRpmB: [[16.5, PB(FR - 0.12, 0.06, 2100, 0, -40, 0, 30, -250)], [18.65, PB(FR - 0.04, 0.04, 1950, 0, -40, 0, 30, -250)]],
  thin: [[21.85, PB(FR + 0.35, 0.1, 2000, 0, -40, 0, 32, 230)], [24.4, PB(FR + 0.05, 0.02, 1500, 0, -90, 0, 32, 200)]],
  splitCylA: [[24.4, PB(FR, 0.03, 1900, 0, -60, 0, 30, 360)], [26.3, PB(FR - 0.05, 0.03, 1700, 0, -70, 0, 30, 360)]],
  splitCylB: [[24.4, P(-0.15, 0.3, 2900, -60, 230, 0, 32, OYB)], [26.3, P(-0.05, 0.26, 2700, -60, 230, 0, 32, OYB)]],
  turbo: [[27.9, PT(1.05, 0.35, 1750, 0, 20, 0, 34, 170)], [29.1, PT(0.6, 0.24, 1400, 0, 20, 0, 34, 170)], [30.22, PT(0.36, 0.2, 1300, 0, 20, 0, 34, 170)]],
  load: [[30.22, PB(FR + 0.25, 0.3, 2300, 0, 60, 0, 32, 120)], [30.6, PB(FR + 0.15, 0.2, 2150, 0, 40, 0, 32, 120)], [32.2, PB(FR, 0.05, 1800, 0, -40, 0, 32, 150)]],
  shock: [[42.4, P(0.4, 0.22, 1800, 60, 200, 108, 34, 120)], [44.0, P(0.3, 0.12, 1450, 40, 40, 108, 34, 120)], [45.4, P(-0.35, 0.12, 1800, 0, 0, -120, 34, 120)], [46.88, P(-0.75, 0.1, 1950, 0, 0, -230, 34, 120)]],
  dmf: [[46.88, P(REAR + 0.85, 0.2, 2100, 0, 40, -200, 34, 110)], [48.72, P(REAR + 0.6, 0.14, 1850, 0, 30, -220, 34, 110)]],
  ok: [[51.14, PB(FR - 0.3, 0.2, 2150, 0, 0, 0, 32, 200)], [53.36, PB(FR - 0.12, 0.12, 2000, 0, 0, 0, 32, 200)]],
  problem: [[53.36, PB(FR + 0.3, 0.15, 2150, 0, 20, 0, 32, 160)], [55.5, PB(FR + 0.15, 0.1, 2000, 0, 0, 0, 32, 160)], [56.33, PB(FR + 0.05, 0.06, 1750, 0, -40, 0, 32, 180)]],
  blind: [[69.93, PB(FR, 0.04, 1900, 0, -60, 0, 32, -250)], [74.3, PB(FR - 0.1, 0.04, 1750, 0, -70, 0, 32, -250)]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, shk, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  v.az += 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += 0.004 * Math.sin(t * 0.53);
  if (shk > 0) { v.az += shk * 0.014 * Math.sin(t * 47); v.el += shk * 0.011 * Math.sin(t * 59 + 1); }
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * (1 + 0.004 * Math.sin(t * 0.9));
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silnika ================= */
const _p = new THREE.Vector3();
function poseEngine(st, t) {
  engine.root.visible = st.vis;
  if (!st.vis) return;
  const deg = crank6(t);
  engine.updateCrank(deg);
  for (const u of units) {
    _p.copy(u.base);
    let vis = true;
    if (u.top && !u.isCrank && st.s > 0) {
      const k = stag(st.s, u.kS);
      _p.addScaledVector(u.sdir, k * u.smag);
      if (k > 0.985) vis = false;
    }
    if (u.isFly && st.s > 0) { const k = stag(st.s, u.kS); _p.z -= k * 2600; if (k > 0.985) vis = false; }
    if (st.core && u.core) vis = false;
    u.o.position.copy(_p);
    u.o.visible = vis;
  }
  setCasingGhost(M, st.g);
  M.coverPlastic.opacity *= 1 - 0.9 * st.g;
  M.plastic.opacity *= 1 - 0.75 * st.g;
  const cm = wrap(deg, 720);
  flashes.forEach((f) => {
    let k = 0;
    if (st.fire) { const x = wrap(cm - wrap(f.c.cycleOffset + 360, 720), 720); k = x < 90 ? Math.pow(1 - x / 90, 1.6) : 0; }
    f.m.visible = k > 0.01;
    f.mat.opacity = k;
    f.mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    f.m.scale.set(0.7 + 0.5 * k, 0.5 + 0.4 * k, 0.7 + 0.5 * k);
  });
  pows.forEach((g) => {
    const ph = L6.cycleAngle(g.c, deg);
    const on = st.fire && ph >= 360 && ph < 540;
    g.m.visible = on;
    if (!on) return;
    const { s } = L6.pistonPinDistance(g.c, deg);
    const crown = s + L6.LAYOUT.pistonHeight / 2 - 2;
    const len = Math.max(2, L6.LAYOUT.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.copy(g.axis).multiplyScalar(crown + len / 2);
    g.m.position.z = g.c.z;
    const f = (ph - 360) / 180;
    g.mat.opacity = 0.85 - 0.45 * f;
    g.mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
  });
  glowPiston.forEach((m) => { m.emissiveIntensity = st.gPiston; });
  glowRod.forEach((m) => { m.emissiveIntensity = st.gRod; });
  glowFly.forEach((m) => { m.emissiveIntensity = st.gFly; });
  glowCrank.forEach((m) => { m.emissiveIntensity = st.gCrank; });
  for (const id in E.journals) E.journals[id].emissiveIntensity = id === "1" ? st.gPin : 0;
  // bicie dwumasy
  flywheel.rotation.x = st.wob * 0.035 * Math.sin(t * 23);
  flywheel.rotation.y = st.wob * 0.025 * Math.sin(t * 17 + 1);
  engine.root.updateMatrixWorld(true);
}
const blankE = () => ({ vis: false, s: 0, g: 0, core: 0, fire: 0, gPiston: 0, gRod: 0, gFly: 0, gCrank: 0, gPin: 0, wob: 0 });

/* ================= stan łożyska w ujęciu ================= */
function bearState(t, name, panel) {
  let rpm = rpmB(t), load = loadB(t), ang = angB(t);
  if (name === "splitRpm" && panel === "A") { rpm = 3000; ang = angTop(t); }
  if (name === "splitCyl") load = 0.35 * easeOut(win(t, 25.98, 26.3));
  const e = name === "gap" ? 0.05 : eccOf(rpm, load);
  return { rpm, load, ang, e, fill: fillB(t), glow: 0, oilGlow: name === "wedge" ? easeOut(win(t, 15.26, 15.8)) : 0 };
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
let projCam = camera;
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
const bLocal = (x, y, z = BW / 2 + 0.01) => { _w.set(x, y, z); bear.group.localToWorld(_w); return project(_w); };
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px) scale(" + (1 + (1 - k) * 0.12).toFixed(3) + ")";
  return k;
};
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const worldOf = (obj, local) => obj.localToWorld(local.clone());
const centerLocal = (obj) => { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); return obj.worldToLocal(b.getCenter(new THREE.Vector3())); };

// etykiety z linią wiodącą
const anc = { rod1: centerLocal(cyl(1).rod), pis1: centerLocal(cyl(1).piston) };
const bearAt = (x, y, z) => () => { _w.set(x, y, z); return bear.group.localToWorld(_w.clone()); };
const TAGS = [
  { t0: 6.69, t1: 8.2, text: "Wał", a: () => { const e = bear.journal.position.y; _w.set(-0.45, 0.35 + e, BW / 2); return bear.group.localToWorld(_w.clone()); }, off: [-190, -160], c: "oil" },
  { t0: 7.05, t1: 8.2, text: "Szczelina", a: () => { _w.set(0.55, -(Ri + Rj + 0.05) / 2 - 0.02, BW / 2); return bear.group.localToWorld(_w.clone()); }, off: [200, 150], c: "hot" },
  { t0: 7.55, t1: 8.2, text: "Panewka", a: bearAt(Math.cos(3.6) * 1.4, Math.sin(3.6) * 1.4, BW / 2), off: [-40, 240], c: "oil" },
  { t0: 9.28, t1: 10.4, text: "Olej", a: bearAt(Math.cos(0.9) * 1.13, Math.sin(0.9) * 1.13, BW / 2), off: [170, -190], c: "oil" },
  { t0: 13.9, t1: 16.4, text: "Klin olejowy", a: () => { _w.set(-0.35, -1.18, BW / 2); return bear.group.localToWorld(_w.clone()); }, off: [-210, 170], c: "oil" },
  { t0: 42.66, t1: 44.0, text: "Tłok", a: () => worldOf(cyl(1).piston, anc.pis1), off: [-230, -160], c: "hot" },
  { t0: 44.06, t1: 44.46, text: "Korbowód", a: () => worldOf(cyl(1).rod, anc.rod1), off: [-240, -140], c: "hot" },
  { t0: 44.46, t1: 45.6, text: "Panewki", a: () => worldOf(crank, crank.getObjectByName("Crank_RodJournal_Cyl1").position.clone()), off: [-220, 170], c: "hot" },
  { t0: 45.8, t1: 46.88, text: "Dwumasa", a: () => worldOf(crank, new THREE.Vector3(0, 0, -240)), off: [200, -230], c: "hot" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = tg.c === "hot" ? "#e2492b" : tg.c === "ok" ? "#86dba1" : "#f5aa3c";
  tg.line = mkEl("path", { fill: "none", stroke: col, "stroke-width": 2.5 }, $("tagLines"));
  tg.dot = mkEl("circle", { r: 7, fill: col }, $("tagLines"));
});
function drawTags(t) {
  for (const tg of TAGS) {
    const on = inR(t, tg.t0, tg.t1 + 0.18) && shotAt(t) === shotAt(tg.t0);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.3)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    const p = project(tg.a());
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(160, Math.min(y > 1000 ? 720 : 900, x));
    y = Math.max(560, Math.min(1130, y));
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

// cząstki oleju w szczelinie: płyną z połową prędkości czopu, zagęszczają się w klinie
const FLOWN = 22;
const flowEls = Array.from({ length: FLOWN }, () => ({
  tail: mkEl("path", { fill: "none", stroke: "#ffc46b", "stroke-width": 5, "stroke-linecap": "round" }, $("flow")),
  dot: mkEl("circle", { r: 6, fill: "#ffe2a8" }, $("flow")),
}));
function drawFlow(st, alpha) {
  const g = $("flow");
  g.setAttribute("opacity", alpha.toFixed(3));
  if (alpha < 0.02) return;
  flowEls.forEach((f, i) => {
    const a = (i / FLOWN) * Math.PI * 2 + st.ang * 0.5;
    const gp = (a0) => { const gap = CLEAR + st.e * Math.sin(a0); const r = Rj - st.e * Math.sin(a0) + gap * 0.5; return bLocal(Math.cos(a0) * r, Math.sin(a0) * r); };
    const p = gp(a), q = gp(a - 0.16);
    f.dot.setAttribute("cx", p.x.toFixed(1)); f.dot.setAttribute("cy", p.y.toFixed(1));
    f.tail.setAttribute("d", `M ${q.x.toFixed(1)} ${q.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  });
}
// poduszka: rozkład ciśnienia w filmie jako wykres biegunowy pod łożyskiem
const cushFill = mkEl("path", { fill: "rgba(245,170,60,0.22)", stroke: "#f5aa3c", "stroke-width": 4 }, $("cush"));
const cushTicks = Array.from({ length: 13 }, () => mkEl("path", { fill: "none", stroke: "#ffcf8a", "stroke-width": 4, "stroke-linecap": "round" }, $("cush")));
function drawCushion(amp, hot, peakDeg = -108, width = 55) {
  const g = $("cush");
  g.setAttribute("opacity", amp > 0.01 ? 1 : 0);
  if (amp <= 0.01) return;
  const col = hot > 0.5 ? "#ff6a4d" : "#f5aa3c";
  cushFill.setAttribute("stroke", col);
  cushFill.setAttribute("fill", hot > 0.5 ? "rgba(255,106,77,0.25)" : "rgba(245,170,60,0.22)");
  const R0 = RoH + 0.08;
  const pr = (d) => { const x = (d - peakDeg) / width; return Math.exp(-x * x * 2.2) * amp; };
  let d = "";
  for (let k = 0; k <= 60; k++) {
    const deg = -175 + (170 * k) / 60, a = deg * D2R, r = R0 + pr(deg) * 0.7;
    const p = bLocal(Math.cos(a) * r, Math.sin(a) * r, BW / 2);
    d += (k ? " L " : "M ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  for (let k = 60; k >= 0; k--) {
    const deg = -175 + (170 * k) / 60, a = deg * D2R;
    const p = bLocal(Math.cos(a) * R0, Math.sin(a) * R0, BW / 2);
    d += " L " + p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  cushFill.setAttribute("d", d + " Z");
  cushTicks.forEach((tk, i) => {
    const deg = -165 + (150 * i) / 12, a = deg * D2R, h = pr(deg) * 0.7;
    if (h < 0.05) { tk.setAttribute("opacity", 0); return; }
    const p = bLocal(Math.cos(a) * (R0 + h), Math.sin(a) * (R0 + h), BW / 2), q = bLocal(Math.cos(a) * (R0 + 0.04), Math.sin(a) * (R0 + 0.04), BW / 2);
    tk.setAttribute("d", `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
    tk.setAttribute("stroke", col);
    tk.setAttribute("opacity", 0.9);
  });
}
// strzałka nacisku wzdłuż korbowodu
function drawLoad(k, t, at) {
  const g = $("loadA");
  g.setAttribute("opacity", k > 0.01 ? 1 : 0);
  if (k <= 0.01) return;
  const drop = 1 - easeOut(win(t, at, at + 0.2));
  const top = bLocal(0, 3.6 + drop * 3, BW / 2 + 0.05), tip = bLocal(0, RoH + 0.25 + drop * 3, BW / 2 + 0.05);
  $("loadS").setAttribute("d", `M ${top.x.toFixed(1)} ${top.y.toFixed(1)} L ${tip.x.toFixed(1)} ${(tip.y - 40).toFixed(1)}`);
  $("loadS").setAttribute("stroke-width", (16 + 18 * k).toFixed(1));
  const w = 38 + 24 * k;
  $("loadH").setAttribute("d", `M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${(tip.x - w).toFixed(1)} ${(tip.y - w * 1.3).toFixed(1)} L ${(tip.x + w).toFixed(1)} ${(tip.y - w * 1.3).toFixed(1)} Z`);
}
// fale uderzenia (tłok -> korbowód -> panewka -> dwumasa)
const ringEls = Array.from({ length: 5 }, () => mkEl("circle", { fill: "none", stroke: "#ff6a4d", "stroke-width": 6 }, $("rings")));
const SHOCK = [
  [42.66, () => worldOf(cyl(1).piston, anc.pis1)],
  [44.06, () => worldOf(cyl(1).rod, anc.rod1)],
  [44.46, () => worldOf(crank, crank.getObjectByName("Crank_RodJournal_Cyl1").position.clone())],
  [45.8, () => worldOf(crank, new THREE.Vector3(0, 0, -240))],
  [46.15, () => worldOf(crank, new THREE.Vector3(0, 0, -330))],
];
function drawRings(t, on) {
  ringEls.forEach((r, i) => {
    const [at, a] = SHOCK[i];
    const x = t - at;
    if (!on || x < 0 || x > 0.7) { r.setAttribute("opacity", 0); return; }
    const p = project(a());
    r.setAttribute("cx", p.x.toFixed(1)); r.setAttribute("cy", p.y.toFixed(1));
    r.setAttribute("r", (20 + 220 * easeOut(x / 0.7)).toFixed(1));
    r.setAttribute("opacity", (1 - x / 0.7).toFixed(3));
    r.setAttribute("stroke-width", (10 * (1 - x / 0.7) + 2).toFixed(1));
  });
}

/* ================= plansza hooka ================= */
const plBar = $("plBar");
const barSeg = Array.from({ length: 20 }, () => { const i = document.createElement("i"); plBar.appendChild(i); return i; });
function setRevBar(rpm) {
  barSeg.forEach((s, i) => {
    const lim = ((i + 1) / 20) * 7000;
    const lit = rpm >= lim - 175;
    s.style.background = lit ? (lim <= 3000 ? "#86dba1" : lim <= 5500 ? "#f5aa3c" : "#ff4a2d") : "rgba(150,165,182,0.16)";
  });
}
function drawPlate(t, name) {
  const pn = $("plN");
  let rpm = 2700, nK = 1, kick = "Sytuacja, którą znasz", kickK = 1;
  if (name === "hook") {
    rpm = t < 0.72 ? lerp(2700, 1200, easeOut(t / 0.72)) : 1200;
  } else if (name === "plate2") {
    kick = "A teraz ty";
    kickK = easeOut(win(t, 18.7, 18.95));
    rpm = t < 19.17 ? 2000 : lerp(2000, 1200, easeOut(win(t, 19.17, 19.7)));
    nK = easeOut(win(t, 18.72, 18.95));
  } else {
    // pętla: plansza wraca i obroty rosną do 2700, jak na klatce 0
    kickK = easeOut(win(t, 74.4, 74.8));
    nK = easeOut(win(t, 74.45, 74.7));
    rpm = lerp(1200, 2700, easeIO(win(t, 74.55, 75.35)));
  }
  if ($("plK").textContent !== kick) $("plK").textContent = kick;
  $("plK").style.opacity = kickK;
  const v = String(Math.round(rpm / 10) * 10);
  if (pn.textContent !== v) pn.textContent = v;
  const bump = name === "hook" && t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.25) : name === "plate2" && t > 19.7 ? Math.max(0, 1 - (t - 19.7) / 0.25) : 0;
  pn.style.opacity = nK;
  pn.style.transform = "scale(" + (1 + 0.08 * Math.sin(bump * Math.PI)).toFixed(3) + ")";
  pn.style.color = rpm < 1500 ? "#ff6a4d" : "#f5aa3c";
  setRevBar(rpm);
  plBar.style.opacity = nK;
  const pdim = $("plate").querySelector(".pdim");
  pdim.style.opacity = name === "outro" ? easeOut(win(t, 74.3, 74.5)) : 1;
  const uAt = name === "hook" ? 1.52 : name === "plate2" ? 18.9 : 99;
  pop($("plU"), t, uAt, 0.2, 14);
  const cAt = name === "hook" ? [2.07, 2.55, 2.95] : name === "plate2" ? [20.17, 20.67, 21.14] : [99, 99, 99];
  ["pc1", "pc2", "pc3"].forEach((id, i) => {
    const k = backOut(win(t, cAt[i], cAt[i] + 0.22));
    $(id).style.opacity = clamp01(k * 3);
    $(id).style.transform = "scale(" + (0.6 + 0.4 * k).toFixed(3) + ")";
  });
  pop($("plX"), t, name === "hook" ? 2.72 : 99, 0.22, 20);
  const lk = name === "plate2" ? easeOut(win(t, 20.67, 21.1)) : 0;
  $("plL").style.opacity = name === "plate2" ? easeOut(win(t, 19.9, 20.2)) : 0;
  $("plLb").style.width = (100 * lk).toFixed(1) + "%";
  $("plLv").textContent = Math.round(100 * lk) + "%";
  const va = $("plV").querySelector(".a"), vb = $("plV").querySelector(".b");
  pop(va, t, name === "hook" ? 3.89 : 99, 0.2, 20);
  const vk = name === "hook" ? easeOut(win(t, 4.44, 4.56)) : 0;
  vb.style.opacity = vk;
  const sh = name === "hook" && t > 4.44 ? Math.max(0, 1 - (t - 4.44) / 0.5) : 0;
  vb.style.transform = "scale(" + (1.6 - 0.6 * vk).toFixed(3) + ") translate(" + (sh * 10 * Math.sin(t * 90)).toFixed(1) + "px," + (sh * 6 * Math.sin(t * 70)).toFixed(1) + "px)";
  vb.style.transformOrigin = "0% 50%";
}

/* ================= górny blok ================= */
const TOPS = [
  [5.26, "W środku", "Zobacz, co się <em>dzieje</em>"],
  [6.64, "Łożysko ślizgowe", "Wał <em>nie dotyka</em> panewek"],
  [8.26, "Między nimi", "Cienka warstwa <em>oleju</em>"],
  [10.45, "Między nimi", "Nie z <span class=\"hot\">ciśnienia</span>"],
  [12.16, "Skąd się bierze", "Z <em>obrotów</em>"],
  [13.44, "Klin olejowy", "Wał sam <em>wciąga</em> olej"],
  [15.26, "Klin olejowy", "Robi sobie <em>poduszkę</em>"],
  [21.89, "1200 obr/min", "Najcieńsza <span class=\"hot\">warstwa</span>"],
  [23.56, "1200 obr/min", "W całym <em>zakresie</em>"],
  [27.94, "Doładowanie", "Turbo <em>dmucha</em>"],
  [28.81, "Doładowanie", "Wtrysk <span class=\"hot\">na maksa</span>"],
  [30.28, "Efekt", "Największy <span class=\"hot\">nacisk</span>"],
  [31.06, "Efekt", "Na najsłabszą <em>poduszkę</em>"],
  [42.44, "Uderzenia", "Idą przez <em>korbowód</em>"],
  [44.46, "Uderzenia", "W <span class=\"hot\">panewki</span>"],
  [45.39, "Uderzenia", "Dalej w <em>dwumasę</em>"],
  [46.15, "Uderzenia", "I w <em>skrzynię</em>"],
  [46.93, "Dwumasa", "<span class=\"hot\">Siada</span> od tego"],
  [51.19, "Żeby było jasne", "Po płaskim, <span class=\"ok\">bez gazu</span>"],
  [51.94, "Żeby było jasne", "Jedź na <span class=\"ok\">1300</span>"],
  [53.41, "Problem", "Niskie obroty…"],
  [55.55, "Problem", "Niskie obroty <span class=\"hot\">+ gaz</span>"],
];
const TOP_OFF = [[0, 5.26], [16.5, 21.85], [24.4, 27.9], [32.2, 42.4], [48.72, 51.14], [56.33, D + 1]];
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
function gearPath(cx, cy, r, n, th, ang) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = ang + (i / n) * Math.PI * 2, s = Math.PI * 2 / n;
    const pts = [[r - th * 0.4, a0], [r + th * 0.6, a0 + s * 0.18], [r + th * 0.6, a0 + s * 0.45], [r - th * 0.4, a0 + s * 0.63]];
    pts.forEach(([rr, aa], k) => { d += (i === 0 && k === 0 ? "M " : " L ") + (cx + Math.cos(aa) * rr).toFixed(1) + " " + (cy + Math.sin(aa) * rr).toFixed(1); });
  }
  return d + " Z";
}
const rpmPump = (t) => lerp(2000, 1200, easeIO(win(t, 34.7, 35.4)));
const pumpAng = integral((t) => rpmPump(t) / 2000 * 2.4);
const puDrops = Array.from({ length: 16 }, () => mkEl("circle", { r: 11, fill: "#f5aa3c" }, $("puDrops")));
// dwa zegary: potrzeba i dostawa oleju
function dialSvg(g, cx, cy, title) {
  mkEl("path", { d: `M ${cx - 210} ${cy} A 210 210 0 0 1 ${cx + 210} ${cy}`, fill: "none", stroke: "rgba(150,165,182,0.25)", "stroke-width": 30 }, g);
  const arc = mkEl("path", { fill: "none", "stroke-width": 30 }, g);
  const ndl = mkEl("line", { x1: cx, y1: cy, stroke: "#eef2f7", "stroke-width": 8, "stroke-linecap": "round" }, g);
  mkEl("circle", { cx, cy, r: 16, fill: "#eef2f7" }, g);
  const t1 = mkEl("text", { x: cx, y: cy + 70, "text-anchor": "middle" }, g); t1.textContent = title;
  const v = mkEl("text", { x: cx, y: cy + 170, "text-anchor": "middle", style: "font-size:110px;font-weight:600;letter-spacing:0" }, g);
  return { cx, cy, arc, ndl, v };
}
const dA = dialSvg($("dialA"), 290, 960, "POTRZEBUJESZ OLEJU");
const dB = dialSvg($("dialB"), 790, 960, "MASZ OLEJU");
{ const c = mkEl("text", { x: 540, y: 1300, "text-anchor": "middle" }, $("dialB")); c.textContent = "1200 OBR/MIN, GAZ DO DECHY"; }
function setDial(d, k, col, txt) {
  const a = Math.PI + k * Math.PI;
  d.ndl.setAttribute("x2", (d.cx + Math.cos(a) * 180).toFixed(1));
  d.ndl.setAttribute("y2", (d.cy + Math.sin(a) * 180).toFixed(1));
  d.arc.setAttribute("d", `M ${d.cx - 210} ${d.cy} A 210 210 0 0 1 ${(d.cx + Math.cos(a) * 210).toFixed(1)} ${(d.cy + Math.sin(a) * 210).toFixed(1)}`);
  d.arc.setAttribute("stroke", col);
  d.v.textContent = txt;
  d.v.style.fill = col;
}
// obrotomierz "ryczeć na trójce"
const roT = $("roTach");
const RC = { cx: 540, cy: 980, r: 330 };
for (let i = 0; i <= 7; i++) {
  const a = (210 - (240 * i) / 7) * D2R;
  mkEl("line", { x1: (RC.cx + Math.cos(a) * RC.r * 0.86).toFixed(1), y1: (RC.cy - Math.sin(a) * RC.r * 0.86).toFixed(1), x2: (RC.cx + Math.cos(a) * RC.r).toFixed(1), y2: (RC.cy - Math.sin(a) * RC.r).toFixed(1), stroke: i >= 6 ? "#ff4a2d" : "#b6c1cf", "stroke-width": 8 }, roT);
  const tx = mkEl("text", { x: (RC.cx + Math.cos(a) * RC.r * 0.72).toFixed(1), y: (RC.cy - Math.sin(a) * RC.r * 0.72 + 12).toFixed(1), "text-anchor": "middle", style: "font-size:40px;font-weight:600;fill:" + (i >= 6 ? "#ff4a2d" : "#eef2f7") }, roT);
  tx.textContent = String(i);
}
const redA0 = (210 - (240 * 6) / 7) * D2R, redA1 = -30 * D2R;
mkEl("path", { d: `M ${(RC.cx + Math.cos(redA0) * RC.r * 1.06).toFixed(1)} ${(RC.cy - Math.sin(redA0) * RC.r * 1.06).toFixed(1)} A ${RC.r * 1.06} ${RC.r * 1.06} 0 0 1 ${(RC.cx + Math.cos(redA1) * RC.r * 1.06).toFixed(1)} ${(RC.cy - Math.sin(redA1) * RC.r * 1.06).toFixed(1)}`, fill: "none", stroke: "#ff4a2d", "stroke-width": 16 }, roT);
const roN = mkEl("line", { x1: RC.cx, y1: RC.cy, stroke: "#ff6a4d", "stroke-width": 12, "stroke-linecap": "round" }, roT);
mkEl("circle", { cx: RC.cx, cy: RC.cy, r: 26, fill: "#eef2f7" }, roT);
const injDrops = Array.from({ length: 26 }, () => mkEl("circle", { r: 8, fill: "#9fe3ff" }, $("injD")));
const dash = (el, k) => { const L = 1000; el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gPump") {
    const second = t >= 34.54;
    const h = second ? "Niskie obroty = <span class=\"hot\">tłoczy najmniej</span>" : "Napędzana <em>od wału</em>";
    if ($("puH").innerHTML !== h) $("puH").innerHTML = h;
    pop($("puH"), t, second ? 34.54 : 33.35, 0.24, 20);
    const a = pumpAng(t);
    const C = [330, 1000, 190], P1 = [548, 817, 95], P2 = [738, 817, 95];
    $("gearC").setAttribute("d", gearPath(C[0], C[1], C[2], 26, 26, a));
    $("gearP1").setAttribute("d", gearPath(P1[0], P1[1], P1[2], 13, 22, -a * 2 + 0.12));
    $("gearP2").setAttribute("d", gearPath(P2[0], P2[1], P2[2], 13, 22, a * 2 + 0.1));
    const rpm = rpmPump(t), fl = rpm / 2000;
    const shown = Math.round(16 * fl);
    puDrops.forEach((d, i) => {
      const s = wrap(i / 16 + a * 0.35, 1);
      const x = lerp(850, 930, s), y = lerp(800, 600, s) - Math.sin(s * Math.PI) * 30;
      d.setAttribute("cx", x.toFixed(1)); d.setAttribute("cy", y.toFixed(1));
      d.setAttribute("opacity", i < shown ? (1 - s * 0.5).toFixed(2) : 0);
    });
    $("puBar").setAttribute("width", (740 * fl * 0.9).toFixed(1));
    $("puBar").setAttribute("fill", fl < 0.7 ? "#ff6a4d" : "#f5aa3c");
    $("puRpm").textContent = Math.round(rpm / 10) * 10 + " OBR/MIN";
  } else if (id === "gNeed") {
    const second = t >= 38.49;
    const h = second ? "Masz go <span class=\"hot\">najmniej</span>" : "Kiedy potrzebujesz <em>najbardziej</em>";
    if ($("neH").innerHTML !== h) $("neH").innerHTML = h;
    pop($("neH"), t, second ? 38.49 : 36.58, 0.24, 20);
    const ka = lerp(0.3, 0.98, easeOut(win(t, 37.11, 37.86))) + (t > 37.86 ? 0.015 * Math.sin(t * 40) : 0);
    const kb = lerp(0.7, 0.07, easeOut(win(t, 38.49, 38.8)));
    setDial(dA, ka, ka > 0.8 ? "#ff6a4d" : "#f5aa3c", t > 37.86 ? "MAX" : "");
    setDial(dB, kb, kb < 0.3 ? "#ff6a4d" : "#86dba1", t > 38.8 ? "MIN" : "");
  } else if (id === "gRoar") {
    const x = win(t, 48.9, 49.8);
    const rpm = lerp(800, 6300, easeOut(x)) + (t > 49.6 ? 120 * Math.sin(t * 60) : 0);
    const a = (210 - (240 * rpm) / 7000) * D2R;
    roN.setAttribute("x2", (RC.cx + Math.cos(a) * RC.r * 0.9).toFixed(1));
    roN.setAttribute("y2", (RC.cy - Math.sin(a) * RC.r * 0.9).toFixed(1));
    const sh = t > 49.6 ? 4 * Math.sin(t * 80) : 0;
    $("roTach").setAttribute("transform", `translate(${sh.toFixed(1)} ${(sh * 0.6).toFixed(1)})`);
    dash($("roX1"), easeOut(win(t, 50.24, 50.42)));
    dash($("roX2"), easeOut(win(t, 50.4, 50.6)));
  } else if (id === "gRule") {
    $("ruP").setAttribute("width", (780 * 0.64 * easeOut(win(t, 56.65, 57.2))).toFixed(1));
    pop($("ruPt"), t, 56.98, 0.22, 20);
    $("ruR").setAttribute("width", (780 * (1200 / 6000) * easeOut(win(t, 57.32, 57.8))).toFixed(1));
    pop($("ruRt"), t, 57.69, 0.22, 20);
    const q = $("ruQ");
    const qk = easeOut(win(t, 58.06, 58.2)) * (1 - win(t, 58.88, 58.95));
    q.style.opacity = qk;
    q.style.transform = "scale(" + (1.4 - 0.4 * easeOut(win(t, 58.06, 58.2))).toFixed(3) + ")";
    const r = $("ruRed");
    const rk = easeOut(win(t, 58.92, 59.04));
    r.style.opacity = rk;
    const sh = t > 58.92 ? Math.max(0, 1 - (t - 58.92) / 0.5) : 0;
    r.style.transform = "scale(" + (1.6 - 0.6 * rk).toFixed(3) + ") translate(" + (sh * 10 * Math.sin(t * 90)).toFixed(1) + "px,0)";
  } else if (id === "gLcd") {
    const lcd = $("lcd1");
    const inj = t >= 67.5;
    const hs = t >= 67.56 ? "Ile paliwa <em>w tej sekundzie</em>?" : t >= 66.03 ? "Mierzy <em>jedną rzecz</em>" : t >= 62.82 ? "Spalanie <em>spada</em>" : "Komputer ci to <em>pokazuje</em>";
    if ($("lcH").innerHTML !== hs) $("lcH").innerHTML = hs;
    pop($("lcH"), t, t >= 67.56 ? 67.56 : t >= 66.03 ? 66.03 : t >= 62.82 ? 62.82 : 61.43, 0.24, 20);
    const k0 = easeOut(win(t, 61.43, 61.7));
    const zoom = easeIO(win(t, 66.03, 66.6));
    const out = easeIO(win(t, 67.5, 67.8));
    lcd.style.opacity = (k0 * (1 - out)).toFixed(3);
    lcd.style.transform = `translateY(${((1 - k0) * 60 - out * 80).toFixed(1)}px) scale(${(0.92 + 0.08 * k0 + 0.12 * zoom).toFixed(3)})`;
    // bieg 4 -> 5 jak bęben, spalanie 8,4 -> 5,8
    $("lcG").style.transform = "translateY(" + (-150 * easeIO(win(t, 62.9, 63.3))).toFixed(1) + "px)";
    const cons = lerp(8.4, 5.8, easeIO(win(t, 63.75, 64.9)));
    $("lcV").textContent = pl(cons, 1);
    $("lcV").style.color = t > 64.9 ? "#b8ffcf" : "#c9fff1";
    const dk = easeOut(win(t, 65.1, 65.24));
    const st = $("stDow");
    st.style.opacity = dk * (1 - out);
    st.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.8 - 0.8 * dk).toFixed(3) + ")";
    // ramka "mierzy tylko to" wokół liczby
    const bk = easeOut(win(t, 66.6, 67.0)) * (1 - out);
    $("lcBr").setAttribute("d", "M 130 690 L 110 690 L 110 930 L 130 930 M 560 690 L 580 690 L 580 930 L 560 930");
    $("lcBr").setAttribute("opacity", bk);
    $("lcM").style.opacity = easeOut(win(t, 66.89, 67.1)) * (1 - out);
    // wtryskiwacz: dawka paliwa w tej sekundzie
    $("injG").setAttribute("opacity", inj ? easeOut(win(t, 67.6, 67.85)) : 0);
    if (inj) injDrops.forEach((d, i) => {
      const s = wrap(i / 26 + t * 2.2 + hash(i + 3) * 0.3, 1);
      const spread = (hash(i) - 0.5) * 0.9;
      d.setAttribute("cx", (540 + spread * 300 * s).toFixed(1));
      d.setAttribute("cy", (830 + 280 * s).toFixed(1));
      d.setAttribute("r", (4 + 7 * s).toFixed(1));
      d.setAttribute("opacity", (1 - s).toFixed(2));
    });
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Wydech", "Olej", "Turbo", "Pompa", "Panewki"];
const RN = RW.length, RROW = 50;
const BURSTS = [[5.35, 6.3, 2 * RN], [18.75, 19.6, 2 * RN], [32.3, 33.1, 2 * RN], [48.8, 49.6, 2 * RN], [65.0, 66.26, 2 * RN + 5]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 5.3, 67.6);
  rb.style.opacity = rOn ? (easeOut(win(t, 5.3, 5.55)) * (1 - easeIO(win(t, 67.2, 67.6)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const w0 = i0 === FIN ? "Ślepy komputer" : RW[i0 % RN], w1 = i0 + 1 === FIN ? "Ślepy komputer" : RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= 66.26;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Odpowiedź:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    $("reelFlash").style.opacity = done ? (0.85 * Math.max(0, 1 - (t - 66.26) / 0.4)).toFixed(3) : 0;
    let bump = 0;
    for (const [, b] of BURSTS) if (t >= b && t < b + 0.25) bump = Math.sin(((t - b) / 0.25) * Math.PI) * 6;
    const big = easeIO(win(t, 64.9, 65.3)) * (1 - easeIO(win(t, 66.8, 67.2)));
    rb.style.transform = "translate(" + (-40 * big).toFixed(1) + "px," + (900 * big - bump).toFixed(1) + "px) scale(" + (1 + 0.7 * big).toFixed(3) + ")";
  }
  const pc = $("pickCard");
  const pOn = inR(t, 59.64, 61.38);
  pc.style.opacity = pOn ? (easeOut(win(t, 59.64, 59.9)) * (1 - easeIO(win(t, 61.1, 61.38)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 59.64, 59.9))) * 30).toFixed(1) + "px)";
    const ph = t - 59.9;
    const fA = t > 59.9 ? 0.5 + 0.5 * Math.sin(ph * (6 + ph * 2)) : 0;
    const on = (id, g) => {
      $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")";
      $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")";
    };
    on("pkA", fA); on("pkB", t > 59.9 ? 1 - fA : 0);
    $("pickC").style.opacity = easeOut(win(t, 60.2, 60.45));
  }
  const sc = $("serCard");
  const sOn = inR(t, 67.1, 69.85);
  sc.style.opacity = sOn ? (easeOut(win(t, 67.1, 67.45)) * (1 - easeIO(win(t, 69.5, 69.85)))).toFixed(3) : 0;
  if (sOn) {
    sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 67.1, 67.5))) * -60).toFixed(1) + "px)";
    $("serBtn").style.transform = "scale(" + (1 + 0.08 * Math.max(0, Math.sin((t - 66.5) * 7))).toFixed(3) + ")";
  }
  // błyski przejść: wejście w łożysko, werdykt, uderzenie nacisku, "redukuj"
  const fl = (a, dur, amp) => (t >= a && t < a + dur ? amp * (1 - (t - a) / dur) : 0);
  $("flash").style.opacity = Math.max(fl(6.5, 0.22, 0.9), fl(4.44, 0.16, 0.3), fl(30.64, 0.2, 0.3), fl(58.92, 0.2, 0.28)).toFixed(3);
}

/* ================= render klatki ================= */
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const [s0, , kind, name] = shotAt(t);
  bd.style.opacity = kind === "board" ? 1 : 0;
  if (kind === "board") drawBoard(t, name);
  const plateOn = kind === "plate";
  $("plate").style.display = plateOn ? "" : "none";
  if (plateOn) drawPlate(t, name);
  // plansza z b-rollem przy walce o pętlę: canvas niepotrzebny
  const on3d = kind === "3d";
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  $("lcdTop").style.opacity = name === "blind" ? 1 : 0;
  if (!on3d) return;

  /* ---- stany ---- */
  const es = blankE();
  let shk = 0;
  if (name === "dive") Object.assign(es, { vis: true, g: easeIO(win(t, 5.55, 5.95)), s: easeIO(win(t, 5.85, 6.5)) });
  if (name === "splitCyl") Object.assign(es, { vis: true, g: 1, core: 1, fire: 1 });
  if (name === "shock") Object.assign(es, {
    vis: true, g: 1, core: 1,
    gPiston: 1.6 * Math.max(0, 1 - Math.abs(t - 42.9) / 0.9) * (t > 42.6 ? 1 : 0),
    gRod: 1.5 * (inR(t, 44.0, 45.2) ? Math.min(1, (t - 44.0) / 0.15) * (1 - win(t, 44.8, 45.2)) : 0),
    gPin: 2.0 * (inR(t, 44.4, 45.6) ? Math.min(1, (t - 44.4) / 0.12) * (1 - win(t, 45.1, 45.6)) : 0),
    gCrank: 0.6 * (inR(t, 44.9, 46.2) ? Math.sin(win(t, 44.9, 46.2) * Math.PI) : 0),
    gFly: 0.45 * (inR(t, 45.75, 46.9) ? Math.min(1, (t - 45.75) / 0.15) : 0),
  });
  if (name === "dmf") Object.assign(es, { vis: true, g: 0.6, gFly: 0.22 + 0.14 * Math.sin(t * 9) * easeOut(win(t, 47.21, 47.4)), wob: easeOut(win(t, 47.21, 47.5)) });
  poseEngine(es, t);
  const bearOn = !["dive", "shock", "dmf", "turbo"].includes(name);
  bear.group.visible = bearOn;
  const turboOn = name === "turbo";
  turbo.group.visible = turboOn;
  if (turboOn) turbo.setState(turboSpin(t), easeOut(win(t, 28.15, 28.8)));
  floor.visible = ["dive", "shock", "dmf"].includes(name) && es.s < 0.5;
  if (name === "load") shk = t > 30.64 && t < 31.1 ? 1 - win(t, 30.64, 31.1) : 0;
  if (name === "problem") shk = t > 55.55 && t < 55.95 ? 0.8 * (1 - win(t, 55.55, 55.95)) : 0;

  const split = SPLIT.has(name);
  const sA = bearState(t, name, "A");
  if (split) { applyCam(t, name + "A", 0, camera); applyCam(t, name + "B", 0, cameraB); }
  else applyCam(t, name, shk);
  if (bearOn) bear.setState(sA);

  /* ---- HUD łożyska ---- */
  const hudOn = ["gap", "oil", "rpm", "wedge", "thin", "load", "ok", "problem"].includes(name);
  $("hud").style.opacity = hudOn ? (t < 7.6 ? easeOut(win(t, 7.3, 7.6)) : 1) : 0;
  $("note").style.opacity = (hudOn || split || name === "blind") && !["thin", "ok", "problem"].includes(name) ? 0.9 : 0;
  if (hudOn) {
    $("hudR").textContent = String(Math.round(sA.rpm / 10) * 10);
    const um = umOf(sA.e) * (sA.fill > 0.05 ? 1 : 0);
    $("hudF").textContent = sA.fill > 0.05 ? pl(um, 1) : "0,0";
    const col = name === "ok" ? "#86dba1" : um > 4 ? "#86dba1" : um > 1.2 ? "#f5aa3c" : "#ff6a4d";
    $("hudF").style.color = col;
    $("hudFw").style.opacity = (name === "oil" && t > 10.45) || t < 8.3 ? 0 : 1;
    $("hud").firstElementChild.style.opacity = name === "problem" ? 0 : 1;
  }
  // manometr "ciśnienie w układzie": nie stąd
  const manoOn = name === "oil" && t > 10.45;
  $("mano").setAttribute("opacity", manoOn ? easeOut(win(t, 10.45, 10.7)) : 0);
  if (manoOn) {
    const na = (-220 + 190 * easeOut(win(t, 10.5, 11.0)) + 3 * Math.sin(t * 13)) * D2R;
    $("manoN").setAttribute("x2", (700 + Math.cos(na) * 96).toFixed(1));
    $("manoN").setAttribute("y2", (1300 + Math.sin(na) * 96).toFixed(1));
    dash($("manoX1"), easeOut(win(t, 11.04, 11.2)));
    dash($("manoX2"), easeOut(win(t, 11.18, 11.34)));
  }
  // cząstki oleju, poduszka, nacisk
  const flowA = name === "wedge" ? easeOut(win(t, 13.6, 14.2)) : name === "oil" ? easeOut(win(t, 9.4, 9.9)) * 0.8 : ["rpm", "thin", "ok"].includes(name) ? 0.7 : 0;
  projCam = camera;
  drawFlow(sA, flowA);
  let cushA = 0, cushHot = 0;
  if (name === "wedge") cushA = easeOut(win(t, 15.26, 15.7)) * clamp01(sA.rpm / 3000);
  if (name === "thin") cushA = 0.45;
  if (name === "load") { cushA = 0.45 + 0.9 * sA.load; cushHot = sA.load; }
  if (name === "ok") cushA = 0.5;
  if (name === "problem") { cushA = 0.5 + 0.8 * sA.load; cushHot = sA.load; }
  drawCushion(cushA, cushHot, -108 + 14 * cushHot, 55 - 22 * cushHot);
  const ldK = name === "load" ? sA.load : name === "problem" ? sA.load : 0;
  drawLoad(ldK, t, name === "load" ? 30.5 : 55.55);
  // szczelina: "nie dotyka"
  const gapK = name === "gap" ? easeOut(win(t, 7.05, 7.35)) : 0;
  if (gapK > 0) {
    const e = sA.e, p1 = bLocal(0.55, -(Rj + e) * 0.99 - 0.02), p2 = bLocal(0.55, -Ri - 0.01);
    $("gapBr").setAttribute("d", `M ${(p1.x - 26).toFixed(1)} ${p1.y.toFixed(1)} L ${(p1.x + 26).toFixed(1)} ${p1.y.toFixed(1)} M ${(p2.x - 26).toFixed(1)} ${p2.y.toFixed(1)} L ${(p2.x + 26).toFixed(1)} ${p2.y.toFixed(1)} M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
  }
  $("gapBr").setAttribute("opacity", gapK);
  // wykres grubości filmu w funkcji obrotów
  const fgOn = name === "thin";
  $("fgraph").setAttribute("opacity", fgOn ? easeOut(win(t, 22.0, 22.3)) : 0);
  if (fgOn) {
    // film rośnie z obrotami, powyżej ~3000 obr/min się wypłaszcza
    const X = (r) => 96 + ((r - 800) / 5200) * 728, Y = (r) => 1370 - umOf(eccOf(r, 0)) * 22 - Math.max(0, r - 3000) / 3000 * 12;
    let d = "";
    for (let r = 800; r <= 6000; r += 100) d += (r === 800 ? "M " : " L ") + X(r).toFixed(1) + " " + Y(r).toFixed(1);
    $("fgC").setAttribute("d", d);
    const rr = lerp(3000, 1200, easeIO(win(t, 22.0, 22.6)));
    $("fgD").setAttribute("cx", X(rr).toFixed(1)); $("fgD").setAttribute("cy", Y(rr).toFixed(1));
    $("fgT").setAttribute("x", X(1200) + 60); $("fgT").setAttribute("y", Y(1200) - 26);
    $("fgT").setAttribute("opacity", easeOut(win(t, 22.29, 22.5)));
    $("hud").style.opacity = 0;
  }
  // pedał gazu w "problemie"
  const pdOn = name === "problem";
  $("pedal").setAttribute("opacity", pdOn ? easeOut(win(t, 54.8, 55.1)) : 0);
  if (pdOn) {
    const k = easeOut(win(t, 55.55, 55.8));
    $("pedal").setAttribute("transform", "translate(-450 0)");
    $("pedalP").setAttribute("transform", `translate(0 ${(k * 26).toFixed(1)}) rotate(${(k * 14).toFixed(1)} 680 1380)`);
    $("pedalT").textContent = Math.round(k * 70) + "%";
    $("hudFw").style.opacity = 1;
  }
  // chipy "tak jest dobrze"
  show($("chOk"), name === "ok");
  if (name === "ok") [...$("chOk").children].forEach((c) => pop(c, t, parseFloat(c.dataset.t), 0.2, 24));
  if (name === "ok") $("hud").style.opacity = 0;
  const stamp = (id, onS, at, x, y) => {
    const el = $(id);
    if (!onS) { el.style.opacity = 0; return; }
    const k = easeOut(win(t, at, at + 0.14));
    el.style.opacity = k;
    place(el, x, y);
    el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.8 - 0.8 * k).toFixed(3) + ")";
  };
  stamp("stOk", name === "ok" && t >= 52.5, 52.5, 540, 1010);
  stamp("stAge", name === "dmf" && t >= 48.11, 48.11, 540, 1250);
  stamp("stLoad", name === "load" && t >= 31.06, 31.06, 540, 1030);

  // podzielony ekran
  $("split").style.opacity = split || name === "blind" ? 1 : 0;
  const pill = $("splitPill");
  const pillTxt = name === "splitRpm" ? "Im wolniej, tym cieniej" : "Ta sama sekunda";
  if (pill.textContent !== pillTxt) pill.textContent = pillTxt;
  const pk = split || name === "blind" ? easeOut(win(t, s0, s0 + 0.25)) : 0;
  pill.style.opacity = pk;
  pill.style.transform = "translate(-50%,-50%) scale(" + (1.3 - 0.3 * pk).toFixed(3) + ")";
  const pA = $("pA"), pB = $("pB");
  const setPl = (el, b, sp, st, cls, wd) => {
    const bb = el.querySelector("b"), s1 = el.querySelector(".sp"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    bb.classList.toggle("wd", !!wd);
    if (s1.textContent !== sp) s1.textContent = sp;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
  };
  if (name === "splitRpm") {
    const sB = bearState(t, name, "B");
    setPl(pA, "3000", "obr/min", pl(umOf(sA.e), 1) + " µm", "ok");
    setPl(pB, String(Math.round(sB.rpm / 10) * 10), "obr/min", pl(umOf(sB.e), 1) + " µm", umOf(sB.e) > 4 ? "ok" : "hot");
    pop(pA, t, 16.56, 0.2, 20); pop(pB, t, 16.66, 0.2, 20);
  } else if (name === "splitCyl") {
    setPl(pA, "Panewka", "", pl(umOf(sA.e), 1) + " µm", "hot", true);
    setPl(pB, "Cylinder", "", t > 25.98 ? "MAX CIŚNIENIE" : "ZAPŁON", "hot", true);
    pop(pA, t, 24.45, 0.2, 20); pop(pB, t, 24.97, 0.2, 20);
  } else if (name === "blind") {
    setPl(pB, "Panewka", "", "TEGO NIE WIDZI", "hot", true);
    pA.style.opacity = 0;
    pop(pB, t, 70.6, 0.2, 20);
  } else { pA.style.opacity = 0; pB.style.opacity = 0; }
  if (name === "blind") {
    // górny panel: komputer widzi spalanie; "gdyby mierzył" zapala ostrzeżenie o panewce
    const wk = t > 73.42 ? (0.75 + 0.25 * Math.sin((t - 73.42) * 18)) * easeOut(win(t, 73.42, 73.6)) : 0;
    $("ltW").style.opacity = wk.toFixed(3);
    $("ltWv").textContent = pl(umOf(sA.e), 1) + " µm";
    $("ltV").style.opacity = wk > 0.2 ? 0 : 1;
  }

  drawTop(t);
  drawRings(t, name === "shock");
  drawTags(t);

  /* ---- render ---- */
  if (!split) { usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - 840, W, 840);
  composer.render();
  if (name === "splitRpm") bear.setState(bearState(t, name, "B"));
  if (name === "splitCyl") bear.group.visible = false;
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - 840);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { engine, bear, turbo, camera, cameraB, composer, scene, SHOTS };
