// Silniki Audi są ch*jowe. Hook: "Cztery zera na masce, piąte w środku" (piąte zero = pierścień zgarniający).
// Bohater: Audi 2.2 T R5 Antoniego (projekty/audi-22t-engine). Bez napisów na środku.
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia.
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

const W = 1080, H = 1920, D = 168.62;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
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

/* ================= ujęcia (czasy = słowa lektora) ================= */
const SHOTS = [
  [0, 3.1, "3d", "hook"], [3.1, 4.82, "3d", "verdict"], [4.82, 8.26, "3d", "mem"], [8.26, 10.16, "3d", "promise"],
  [10.16, 13.8, "3d", "promise2"], [13.8, 17.72, "3d", "kontra"], [17.72, 21.46, "board", "gMech"], [21.46, 24.12, "3d", "wezmy"],
  [24.12, 31.26, "board", "gEA"], [31.26, 32.98, "3d", "p1"], [32.98, 37.12, "3d", "ring3d"], [37.12, 46.4, "board", "gRing"],
  [46.4, 48.16, "broll", "brDym"], [48.16, 51.52, "board", "gPist"], [51.52, 53.3, "3d", "p2"], [53.3, 60.86, "board", "gChain"],
  [60.86, 63.02, "3d", "crash"], [63.02, 64.38, "broll", "brVan"], [64.38, 68.6, "board", "gV8"], [68.6, 71.72, "broll", "brRozbior"], [71.72, 75.44, "board", "gCel"],
  [75.44, 84.78, "board", "gObd"], [84.78, 86.4, "3d", "p3"], [86.4, 95.72, "board", "gValve"], [95.72, 99.64, "3d", "walnut"],
  [99.64, 101.48, "3d", "p4"], [101.48, 104.48, "board", "gCar"], [104.48, 110.08, "3d", "belt"], [110.08, 116.38, "board", "gCar"],
  [116.38, 118.12, "3d", "p5"], [118.12, 126.96, "board", "gCam"], [126.96, 129.92, "3d", "fair"], [129.92, 134.4, "board", "gTrophy"],
  [134.4, 137.5, "3d", "gen3"], [137.5, 140.26, "board", "gBill"], [140.26, 141.44, "3d", "promised"], [141.44, 145.96, "3d", "answer"],
  [145.96, 153.96, "board", "gOil"], [153.96, 156.76, "3d", "pickA"], [156.76, 158.7, "broll", "brKasa"], [158.7, 167.3, "3d", "yt"],
  [167.3, D + 1, "3d", "outro"],
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
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a);
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
const pist5 = CYLS.map((c) => glowMats(cyl5(c.id).piston));
const rod5 = CYLS.map((c) => glowMats(cyl5(c.id).rod));
// pierścień zgarniający (trzeci od góry) na każdym tłoku: "piąte zero"
const oilRing = (id) => cyl5(id).piston.getObjectByName("Piston_Ring_3");
const ring5 = CYLS.map((c) => glowMats(oilRing(c.id)));
const valve5 = glowMats(E5.head.groups.valvetrain, RED);
const cam5 = glowMats(E5.head.groups.cams);
const port5 = glowMats(E5.head.groups.intake);
const manif5 = glowMats(E5.accessories.groups.intake);
const belt5 = glowMats(E5.rotating.timing);
const exh5 = glowMats(E5.accessories.groups.exhaust, RED);
const turb5 = glowMats(E5.turbo.groups.turb, RED);
const pistonsRoot5 = E5.rotating.root.getObjectByName("PISTONS_AND_RODS");
const fireAt5 = (c) => wrap(c.cycleOffset + 360, 720);
const flash5 = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(44, 24, 16), mat);
  m.position.set(0, K5.LAYOUT.deckHeight - 16, c.z);
  m.scale.set(1, 0.6, 1);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
const pow5 = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(K5.SPEC.bore / 2 - 2, K5.SPEC.bore / 2 - 2, 1, 32), mat);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
// rozkład kaskadą: góra silnika rusza pierwsza
const EX5 = E5.explode.map((x, i) => ({ ...x, k: clamp01(0.5 - x.delta.y / 900 + hash(i) * 0.2) }));
// żar zapłonu: łagodnie narasta przez 30° i gaśnie przez 150°, bez błysku
const softFire = (x) => (x < 30 ? easeIO(x / 30) : x < 180 ? 1 - easeIO((x - 30) / 150) : 0);
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const CORE5 = [E5.head.groups.covers, E5.accessories.root, E5.turbo.root, E5.block.groups.timingCover, E5.block.groups.filter].filter(Boolean);
const worldCenter = (o) => { R5W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); };
E5.update(0); R5W.updateMatrixWorld(true);
const CYL1 = (() => { const v = new THREE.Vector3(); cyl5(1).piston.getWorldPosition(v); return new THREE.Vector3(v.x, 175, v.z); })();
const PORT_C = worldCenter(E5.head.groups.intake);
const TIM_C = worldCenter(E5.rotating.timing);

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260926;
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
// az = 0: od tyłu (+X), SIDE: od strony wydechu (+Z), FRONT: od przodu (-X), -SIDE: od strony dolotu
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const Pv = (az, el, r, v, fov, oy) => ({ az, el, r, x: v.x, y: v.y, z: v.z, fov, oy });
const SIDE = Math.PI / 2, FRONT = Math.PI;
const P0 = P(SIDE + 0.55, 0.2, 3050, -60, 150, 0, 32, -150);
const CAM = {
  hook: [[0, P0], [3.1, P(SIDE + 0.3, 0.16, 3050, -60, 150, 0, 32, -150)]],
  verdict: [[3.1, P(0.95, 0.06, 3400, 0, 110, 0, 32, 60)], [4.82, P(1.2, 0.08, 3400, 0, 110, 0, 32, 60)]],
  mem: [[4.82, P(2.6, 0.2, 3600, 0, 110, 0, 32, 60)], [8.26, P(2.05, 0.14, 3600, 0, 110, 0, 32, 60)]],
  promise: [[8.26, P(1.1, 0.3, 5400, 0, 220, 0, 32, 60)], [10.16, P(0.85, 0.26, 5100, 0, 220, 0, 32, 60)]],
  promise2: [[10.16, P(-0.9, 0.3, 5400, 0, 220, 0, 32, 80)], [13.8, P(-1.35, 0.22, 4900, 0, 220, 0, 32, 80)]],
  kontra: [[13.8, P(2.5, 0.16, 3400, 0, 110, 0, 32, 60)], [17.72, P(1.4, 0.32, 3000, 0, 110, 0, 32, 60)]],
  wezmy: [[21.46, P(-2.5, 0.12, 3400, 0, 110, 0, 32, 60)], [24.12, P(-2.1, 0.16, 3050, 0, 110, 0, 32, 60)]],
  p1: [[31.26, P(SIDE + 0.35, 0.35, 2900, 0, 120, 0, 32, 40)], [32.98, P(SIDE + 0.15, 0.3, 2900, 0, 120, 0, 32, 40)]],
  ring3d: [[32.98, Pv(SIDE + 0.45, 0.14, 820, CYL1, 32, 40)], [37.12, Pv(SIDE + 0.12, 0.1, 820, CYL1, 32, 40)]],
  p2: [[51.52, P(FRONT - 0.5, 0.2, 3000, 0, 120, 0, 32, 60)], [53.3, P(FRONT - 0.28, 0.18, 3000, 0, 120, 0, 32, 60)]],
  crash: [[60.86, P(SIDE - 0.4, 0.3, 2300, -40, 190, 0, 32, 60)], [64.38, P(SIDE - 0.05, 0.26, 2300, -40, 190, 0, 32, 60)]],
  p3: [[84.78, Pv(-SIDE + 0.4, 0.32, 2300, PORT_C, 32, 60)], [86.4, Pv(-SIDE + 0.18, 0.28, 2300, PORT_C, 32, 60)]],
  walnut: [[95.72, P(-SIDE - 0.45, 0.24, 3900, 0, 200, 0, 32, 60)], [99.64, P(-SIDE - 0.05, 0.2, 3900, 0, 200, 0, 32, 60)]],
  p4: [[99.64, P(SIDE + 0.3, 0.06, 3400, 0, 110, 0, 32, 60)], [101.48, P(SIDE + 0.08, 0.05, 3400, 0, 110, 0, 32, 60)]],
  belt: [[104.48, Pv(FRONT + 0.45, 0.14, 2300, TIM_C, 32, 40)], [110.08, Pv(FRONT + 0.05, 0.1, 2300, TIM_C, 32, 40)]],
  p5: [[116.38, P(0.5, 0.5, 2600, 0, 250, 0, 32, 80)], [118.12, P(0.72, 0.46, 2600, 0, 250, 0, 32, 80)]],
  fair: [[126.96, P(-2.4, 0.14, 3500, 0, 110, 0, 32, 60)], [129.92, P(-2.05, 0.16, 3500, 0, 110, 0, 32, 60)]],
  gen3: [[134.4, P(SIDE - 0.5, 0.28, 2800, 0, 120, 0, 32, 90)], [137.5, P(SIDE - 0.22, 0.24, 2800, 0, 120, 0, 32, 90)]],
  promised: [[140.26, P(0.95, 0.3, 3700, 0, 110, 0, 32, 60)], [141.44, P(0.75, 0.25, 3700, 0, 110, 0, 32, 60)]],
  answer: [[141.44, P(-0.6, 0.12, 3300, 0, 110, 0, 32, 80)], [145.96, P(-0.1, 0.1, 3300, 0, 110, 0, 32, 80)]],
  pickA: [[153.96, P(0.9, 0.22, 3400, 0, 110, 0, 32, 280)], [156.76, P(0.62, 0.2, 3400, 0, 110, 0, 32, 280)]],
  yt: [[158.7, P(1.3, 0.26, 6900, 0, 250, 0, 32, 330)], [167.3, P(-0.4, 0.3, 6900, 0, 250, 0, 32, 330)]],
  outro: [[167.3, P(SIDE + 0.95, 0.26, 3050, -60, 150, 0, 32, -150)], [D, P0], [D + 1, P(SIDE + 0.469, 0.187, 3050, -60, 150, 0, 32, -150)]],
};
// bez pompowania: w obrębie ujęcia kamera krąży w stałej odległości, nigdy nie przybliża i nie oddala
for (const name in CAM) {
  const r = /^(hook|outro)$/.test(name) ? P0.r : CAM[name][CAM[name].length - 1][1].r;
  CAM[name] = CAM[name].map(([tk, k]) => [tk, { ...k, r }]);
}
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam = camera, si = shotIdx(t)) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  if (si > 0 && si < SHOTS.length - 1) {
    // każde cięcie wchodzi płynnym dojazdem w azymucie, odległość stała
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
const blank = () => ({ e: 0, g: 0, core: 0, fire: 0, pow: 0, smoke: 0, pist: 0, pistC: AMBER, ring: 0, valves: 0, cams: 0, ports: 0, manif: 0, belt: 0, exh: 0, turb: 0, lift: 0 });
const hookE = (t) => 0.3 * (1 - easeOut(win(t, 0, 1.6)));
function states(t, name) {
  const s = blank();
  switch (name) {
    case "hook": s.e = hookE(t); s.g = 1; s.core = 1; s.fire = 1; s.ring = 1; break;
    case "outro": s.e = 0.3 * easeIO(win(t, 167.3, D)); s.g = 1; s.core = 1; s.fire = 1; s.ring = 1; break;
    case "verdict": s.exh = 0.7; s.turb = 0.45; break;
    case "mem": s.fire = 1; break;
    case "promise": s.e = 0.75; break;
    case "promise2": s.e = 0.75 * (1 - easeIO(win(t, 10.16, 12.4))); break;
    case "kontra": break;
    case "wezmy": s.fire = 1; break;
    case "p1": s.g = 1; s.core = 1; s.pist = 0.7 * easeOut(win(t, 31.4, 31.9)); break;
    case "ring3d": s.g = 1; s.core = 1; s.ring = 1.6 * easeOut(win(t, 33.5, 34.0)); break;
    case "p2": break;
    case "crash": s.g = 1; s.core = 1; s.valves = 0.9 * easeOut(win(t, 61.2, 61.7)); s.pist = 0.9 * easeOut(win(t, 61.6, 62.3)); s.pistC = RED; break;
    case "p3": s.g = 1; s.core = 1; s.ports = 0.9 * easeOut(win(t, 85.0, 85.5)); break;
    case "walnut": s.e = 0.4 * easeIO(win(t, 96.4, 97.8)); s.manif = 0.7 * easeOut(win(t, 96.56, 97.0)); break;
    case "p4": break;
    case "belt": s.core = 1; s.belt = 0.8 * easeOut(win(t, 104.8, 105.3)); break;
    case "p5": s.g = 1; s.core = 1; s.cams = 0.9 * easeOut(win(t, 116.6, 117.1)); break;
    case "fair": s.fire = 1; break;
    case "gen3": s.g = 1; s.core = 1; s.fire = 1; s.pist = 0.7 * easeOut(win(t, 136.2, 136.7)); s.pistC = GREEN; break;
    case "promised": break;
    case "answer": s.fire = 1; s.turb = 0.3; break;
    case "pickA": s.fire = 1; break;
    case "yt": s.e = easeIO(win(t, 159.1, 165.6)); break;
  }
  return s;
}

function pose5(st, deg, t) {
  E5.update(deg, { turboDeg: t * TB_RATE, boost: 0.6 });
  for (const x of EX5) x.obj.position.copy(x.rest).addScaledVector(x.delta, st.e > 0 ? stag(st.e, x.k) : 0);
  CORE5.forEach((o) => { o.visible = !st.core; });
  pistonsRoot5.visible = true;
  setCasingGhost(M5, st.g);
  CYLS.forEach((c, i) => {
    setGlow(pist5[i], st.pist, st.pistC);
    setGlow(rod5[i], st.pist * 0.6, st.pistC);
    setGlow(ring5[i], st.ring);
  });
  setGlow(valve5, st.valves);
  setGlow(cam5, st.cams);
  setGlow(port5, st.ports);
  setGlow(manif5, st.manif);
  setGlow(belt5, st.belt);
  setGlow(exh5, st.exh);
  setGlow(turb5, st.turb);
  const cm = wrap(deg, 720);
  flash5.forEach((f) => {
    const k = st.fire ? softFire(wrap(cm - fireAt5(f.c), 720)) : 0;
    f.m.visible = k > 0.01;
    f.mat.opacity = 0.45 * k;
    f.mat.color.setRGB(1.3, 0.55, 0.16);
  });
  pow5.forEach((g) => {
    const ph = K5.cycleAngle(g.c, deg);
    const on = !!st.pow && ph >= 360 && ph < 540;
    g.m.visible = on;
    if (!on) return;
    const { s } = K5.pistonPinDistance(g.c, deg);
    const crown = s + K5.LAYOUT.pistonCompressionHeight;
    const len = Math.max(2, K5.LAYOUT.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.set(0, crown + len / 2, g.c.z);
    const f = (ph - 360) / 180;
    // spalany olej: szaroniebieski dym zamiast pomarańczowego gazu
    g.mat.opacity = (st.smoke ? 0.42 : 0.55) * Math.sin(Math.PI * f);
    if (st.smoke) g.mat.color.setRGB(0.45 + 0.1 * f, 0.55 + 0.05 * f, 0.72);
    else g.mat.color.setRGB(1.3 - 0.3 * f, 0.5 - 0.2 * f, 0.12);
  });
  R5W.position.y = st.lift * 480;
  R5W.updateMatrixWorld(true);
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
const op = (el, k) => el.setAttribute("opacity", f1(k));

// etykiety z linią (pozycja rzutowana z części silnika)
const ringPt = () => { const v = new THREE.Vector3(); oilRing(1).getWorldPosition(v); return v; };
const TAGS = [
  { t0: 34.7, t1: 37.12, text: "Pierścień zgarniający", a: ringPt, off: [-170, -330], c: "oil" },
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
    x = Math.max(250, Math.min(y > 1000 ? 700 : 830, x));
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

// "piąte zero": pierścień zgarniający tłoka 1 obrysowany świecącą elipsą
const RING_R = K5.SPEC.bore / 2 + 1.5;
function drawZero(k) {
  const z = $("zero");
  z.setAttribute("opacity", f1(k));
  if (k <= 0.001) return null;
  const ring = oilRing(1);
  let d = "", cx = 0, top = 1e9;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2, p = localPoint(ring, Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
    d += (i ? " L " : "M ") + f1(p.x) + " " + f1(p.y);
    cx += p.x / 49; top = Math.min(top, p.y);
  }
  z.setAttribute("d", d + " Z");
  return { cx, top };
}
// cztery zera "na masce": cztery szare pierścienie pod nagłówkiem hooka
const HK_RY = 600, HK_RX = [150, 238, 326, 414];
const hkRings = HK_RX.map((x) => mkEl("circle", { cx: x, cy: HK_RY, r: 58, fill: "none", stroke: "#b6c1cf", "stroke-width": 9 }, $("hkR")));
const hkLink = mkEl("path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 4, "stroke-dasharray": "12 10" }, $("hkR"));
function drawHook(t, name) {
  const on = name === "hook" || name === "outro";
  show($("hk"), on);
  $("hkR").setAttribute("opacity", on ? 1 : 0);
  const zk = on ? (name === "outro" ? easeOut(win(t, 167.45, 167.85)) : 1) : name === "ring3d" ? easeOut(win(t, 33.2, 33.7)) : 0;
  const zp = drawZero(zk);
  if (!on) { hkLink.setAttribute("opacity", 0); return; }
  const ak = name === "outro" ? easeOut(win(t, 167.35, 167.75)) : 1;
  $("hkR").setAttribute("opacity", f1(ak));
  pop($("hkK"), t, name === "outro" ? 167.35 : -1);
  pop($("hkH"), t, name === "outro" ? 167.4 : -1);
  const l1 = $("hkL1"), l2 = $("hkL2");
  place(l1, 94, HK_RY + 84); l1.style.opacity = ak;
  if (zp) {
    // łącznik od czwartego zera do piątego, w tłoku
    const x0 = HK_RX[3] + 62, y0 = HK_RY;
    hkLink.setAttribute("d", `M ${f1(x0)} ${f1(y0)} C ${f1(x0 + 160)} ${f1(y0)}, ${f1(zp.cx + 40)} ${f1(zp.top - 150)}, ${f1(zp.cx)} ${f1(zp.top - 14)}`);
    hkLink.setAttribute("opacity", f1(ak * 0.9));
    place(l2, Math.max(70, zp.cx - 360), zp.top + 70); l2.style.opacity = ak;
  }
}

/* ================= górny blok ================= */
const TOPS = [
  [3.1, "Werdykt", "Silniki Audi są <span class=\"hot\">ch*jowe</span>"],
  [4.82, "Tak, wiem", "Sam <em>chwaliłem</em>"],
  [5.86, "Poprzedni odcinek", "Piątkę <em>od Audi</em>"],
  [10.16, "Ile oleju", "Według <em>samego Audi</em>"],
  [12.2, "Ile oleju", "To jeszcze <em>norma</em>"],
  [13.8, "Tylko że", "Audi to <em>niemiecka precyzja</em>"],
  [16.16, "Slogan", "<em>Vorsprung</em> durch Technik"],
  [21.46, "Weźmy", "Jeden <em>silnik</em>"],
  [22.3, "Który siedział", "Prawie <em>w każdym Audi</em>"],
  [31.26, "Powód 1", "<em>Pierścienie</em>"],
  [32.98, "To jest to", "<em>Piąte zero</em>"],
  [34.5, "Na każdym tłoku", "Pierścień <em>zgarniający</em>"],
  [51.52, "Powód 2", "<em>Łańcuch</em>"],
  [60.86, "Wtedy", "Zawory spotykają się <span class=\"hot\">z tłokami</span>"],
  [84.78, "Powód 3", "<em>Nagar</em>"],
  [95.72, "Lekarstwo?", "Rozebrać <em>dolot</em>"],
  [97.66, "I piaskować zawory", "<em>Łupiną orzecha</em>"],
  [99.64, "Powód 4", "<em>Zabudowa</em>"],
  [104.48, "Żeby wymienić", "<em>Pasek rozrządu</em>"],
  [105.66, "W silnikach", "<em>1.8 T</em> albo <em>2.5 TDI</em>"],
  [108.3, "Zdejmujesz", "<span class=\"hot\">Cały przód</span> auta"],
  [116.38, "Powód 5", "<em>Diesel</em>"],
  [126.96, "Uczciwie?", "Audi potrafi zrobić <span class=\"ok\">świetny silnik</span>"],
  [134.4, "A trzecia generacja", "Dwulitrowego <em>TFSI</em>"],
  [136.2, "Trzecia generacja", "Oleju <span class=\"ok\">już nie pije</span>"],
];
// górny blok zależy od renderowanego ujęcia, więc przy przenikaniu w planszę gaśnie razem z 3D
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // hook ma własny nagłówek; przy obietnicy i odpowiedzi mówi bęben; od karty wyboru do końca cisza
  const nm = SHOTS[si][3];
  const off = nm === "hook" || nm === "outro" || nm === "promise" || nm === "promised" || nm === "answer" || SHOTS[si][0] >= 153.9;
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.4));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const C_OIL = "#f5aa3c", C_HOT = "#ff6a4d", C_OK = "#86dba1", C_FG = "#eef2f7", C_FG2 = "#b6c1cf", C_ICE = "#7cc4ff";
const txt = (s, x, y, size, col = C_FG, anchor = "start", extra = "") => ({ x, y, "text-anchor": anchor, style: `font-size:${size}px;font-weight:600;fill:${col};${extra}` });
// punkt na łamanej: [[x,y], ...], u 0..1
function polyAt(pts, u) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let s = clamp01(u) * tot;
  for (let i = 0; i < L.length; i++) { if (s <= L[i] || i === L.length - 1) { const k = L[i] ? Math.min(1, s / L[i]) : 0; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; } s -= L[i]; }
  return pts[pts.length - 1];
}

// --- mechanik kontra właściciel ---
const ME = [
  { lab: "MECHANIK", y: 640, col: C_OK, to: 0.92, at: 18.34 },
  { lab: "WŁAŚCICIEL", y: 900, col: C_HOT, to: 0.22, at: 20.42 },
];
ME.forEach((r) => {
  r.g = mkEl("g", {}, $("meG"));
  mkT(r.lab, { class: "sans", ...txt("", 90, r.y, 64) }, r.g);
  mkEl("rect", { x: 90, y: r.y + 34, width: 760, height: 70, rx: 10, fill: "rgba(150,165,182,0.1)", stroke: "rgba(150,165,182,0.4)", "stroke-width": 3 }, r.g);
  r.bar = mkEl("rect", { x: 96, y: r.y + 40, height: 58, rx: 7, fill: r.col, width: 0 }, r.g);
});

// --- EA888: cztery cylindry w rzędzie ---
const eaCyl = [];
for (let i = 0; i < 4; i++) eaCyl.push(mkEl("circle", { cx: 150 + i * 150, cy: 900, r: 58, fill: "rgba(245,170,60,0.22)", stroke: C_OIL, "stroke-width": 6, opacity: 0 }, $("eaG")));

// --- pierścień zgarniający w przekroju ---
const RG = {};
{
  const g = $("rgG");
  mkT("KOMORA SPALANIA", txt("", 110, 530, 26, C_FG2), g);
  RG.flame = mkEl("ellipse", { cx: 520, cy: 520, rx: 230, ry: 44, fill: "rgba(255,120,40,0.5)", opacity: 0, style: "filter: blur(10px)" }, g);
  // ściana cylindra i film oleju
  mkEl("rect", { x: 790, y: 470, width: 60, height: 860, fill: "rgba(150,165,182,0.22)", stroke: C_FG2, "stroke-width": 4 }, g);
  mkEl("rect", { x: 781, y: 820, width: 9, height: 510, fill: "rgba(245,170,60,0.75)" }, g);
  mkT("ŚCIANA", txt("", 820, 1370, 22, C_FG2, "middle"), g);
  // tłok (prawa część w przekroju) z pustym wnętrzem
  mkEl("path", { d: "M 130 560 L 772 560 L 772 1300 L 610 1300 L 610 820 L 130 820 Z", fill: "rgba(150,165,182,0.2)", stroke: C_FG2, "stroke-width": 4 }, g);
  mkT("TŁOK", txt("", 170, 640, 40, C_FG, "start", "font-family:Oswald"), g);
  mkT("WNĘTRZE TŁOKA", txt("", 160, 900, 22, C_FG2), g);
  // rowki i pierścienie
  for (const y of [610, 670]) {
    mkEl("rect", { x: 728, y: y - 12, width: 44, height: 24, fill: "#0b0e13" }, g);
    mkEl("rect", { x: 734, y: y - 9, width: 52, height: 18, rx: 3, fill: C_FG2 }, g);
  }
  mkEl("rect", { x: 716, y: 732, width: 56, height: 76, fill: "#0b0e13" }, g);
  RG.oil = mkEl("g", {}, g);
  mkEl("rect", { x: 724, y: 736, width: 64, height: 14, rx: 3, fill: C_OIL }, RG.oil);
  mkEl("rect", { x: 724, y: 790, width: 64, height: 14, rx: 3, fill: C_OIL }, RG.oil);
  mkEl("path", { d: "M 728 758 L 740 782 L 752 758 L 764 782 L 776 758", fill: "none", stroke: C_OIL, "stroke-width": 5 }, RG.oil);
  // otworki spływowe przez ściankę tłoka do środka
  RG.hole = mkEl("rect", { x: 610, y: 760, width: 108, height: 22, fill: "#0b0e13", stroke: C_FG2, "stroke-width": 2 }, g);
  RG.holeHi = mkEl("rect", { x: 606, y: 752, width: 116, height: 38, rx: 8, fill: "none", stroke: C_OIL, "stroke-width": 4, opacity: 0 }, g);
  RG.carbon = [640, 672, 700].map((x) => mkEl("circle", { cx: x, cy: 771, r: 0, fill: "#050608", stroke: "#3a3f46", "stroke-width": 2 }, g));
  mkEl("path", { d: "M 470 1150 L 470 1300 M 446 1272 L 470 1300 L 494 1272", fill: "none", stroke: C_OIL, "stroke-width": 6, "stroke-linecap": "round" }, g);
  mkT("DO MISKI", txt("", 470, 1350, 26, C_OIL, "middle"), g);
  RG.drops = [];
  for (let i = 0; i < 12; i++) RG.drops.push(mkEl("circle", { r: 9, fill: C_OIL, opacity: 0 }, g));
}
const RG_DOWN = [[785, 1180], [785, 800], [760, 780], [700, 771], [620, 771], [540, 900], [480, 1280]];
const RG_UP = [[785, 1180], [785, 600], [760, 560], [620, 520], [480, 510]];

// --- stare i nowe tłoki ---
function pistonIcon(g, cx, holes, holeR, col) {
  const p = mkEl("g", {}, g);
  mkEl("path", { d: `M ${cx - 130} 1000 L ${cx - 130} 620 Q ${cx - 130} 560 ${cx - 70} 560 L ${cx + 70} 560 Q ${cx + 130} 560 ${cx + 130} 620 L ${cx + 130} 1000 Z`, fill: "rgba(150,165,182,0.16)", stroke: C_FG2, "stroke-width": 5 }, p);
  for (const y of [620, 660]) mkEl("rect", { x: cx - 134, y, width: 268, height: 12, fill: C_FG2 }, p);
  mkEl("rect", { x: cx - 134, y: 700, width: 268, height: 34, fill: "rgba(245,170,60,0.3)", stroke: col, "stroke-width": 3 }, p);
  for (let i = 0; i < holes; i++) mkEl("circle", { cx: cx - 90 + i * 45, cy: 717, r: holeR, fill: "#050608", stroke: col, "stroke-width": 3 }, p);
  mkEl("circle", { cx, cy: 850, r: 34, fill: "#161b22", stroke: C_FG2, "stroke-width": 5 }, p);
  return p;
}
const psNew = pistonIcon($("psG"), 290, 5, 11, C_OK);
mkT("NOWE", { class: "sans", ...txt("", 290, 1080, 60, C_OK, "middle") }, psNew);
const psOld = pistonIcon($("psG"), 650, 5, 4, C_HOT);
mkT("TWOJE", { class: "sans", ...txt("", 650, 1080, 60, C_HOT, "middle") }, psOld);

// --- łańcuch i napinacz ---
const CH = { cx: 470, cy: 640, R: 130, kx: 470, ky: 1180, r: 70 };
{
  const g = $("chG");
  CH.cam = mkEl("g", {}, g);
  mkEl("circle", { cx: 0, cy: 0, r: CH.R - 8, fill: "rgba(150,165,182,0.14)", stroke: C_FG2, "stroke-width": 5 }, CH.cam);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * 360; mkEl("rect", { x: -7, y: -CH.R - 6, width: 14, height: 16, rx: 3, fill: C_FG2, transform: `rotate(${a})` }, CH.cam); }
  mkEl("circle", { cx: 0, cy: 0, r: 26, fill: "#161b22", stroke: C_FG2, "stroke-width": 4 }, CH.cam);
  CH.mark = mkEl("path", { d: `M -14 ${-CH.R + 34} L 14 ${-CH.R + 34} L 0 ${-CH.R + 10} Z`, fill: C_OIL }, CH.cam);
  CH.ghost = mkEl("path", { d: `M ${CH.cx - 14} ${CH.cy - CH.R + 34} L ${CH.cx + 14} ${CH.cy - CH.R + 34} L ${CH.cx} ${CH.cy - CH.R + 10} Z`, fill: "none", stroke: C_FG, "stroke-width": 3, "stroke-dasharray": "6 5", opacity: 0 }, g);
  CH.crank = mkEl("g", {}, g);
  mkEl("circle", { cx: 0, cy: 0, r: CH.r - 8, fill: "rgba(150,165,182,0.14)", stroke: C_FG2, "stroke-width": 5 }, CH.crank);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * 360; mkEl("rect", { x: -6, y: -CH.r - 5, width: 12, height: 14, rx: 3, fill: C_FG2, transform: `rotate(${a})` }, CH.crank); }
  mkT("WAŁEK", txt("", CH.cx, CH.cy + 8, 26, C_FG, "middle"), g);
  mkT("WAŁ", txt("", CH.kx, CH.ky + 118, 26, C_FG, "middle"), g);
  CH.chain = mkEl("path", { fill: "none", stroke: C_OIL, "stroke-width": 11, "stroke-dasharray": "16 8" }, g);
  CH.guide = mkEl("path", { fill: "none", stroke: "#586270", "stroke-width": 16, "stroke-linecap": "round" }, g);
  CH.body = mkEl("rect", { x: 150, y: 860, width: 110, height: 100, rx: 10, fill: "rgba(150,165,182,0.2)", stroke: C_FG2, "stroke-width": 4 }, g);
  CH.plunger = mkEl("rect", { y: 896, height: 28, fill: C_FG2 }, g);
  mkT("NAPINACZ", txt("", 205, 1000, 24, C_FG2, "middle"), g);
  CH.lock = mkT("BRAK BLOKADY", txt("", 205, 1044, 30, C_HOT, "middle"), g);
  // manometr ciśnienia oleju
  CH.gauge = mkEl("g", {}, g);
  mkEl("circle", { cx: 740, cy: 990, r: 92, fill: "rgba(9,12,17,0.9)", stroke: "rgba(150,165,182,0.45)", "stroke-width": 3 }, CH.gauge);
  for (let i = 0; i <= 4; i++) { const a = (225 - i * 67.5) * D2R; mkEl("line", { x1: f1(740 + Math.cos(a) * 70), y1: f1(990 - Math.sin(a) * 70), x2: f1(740 + Math.cos(a) * 84), y2: f1(990 - Math.sin(a) * 84), stroke: C_FG2, "stroke-width": 4 }, CH.gauge); }
  CH.needle = mkEl("line", { x1: 740, y1: 990, stroke: C_OIL, "stroke-width": 6, "stroke-linecap": "round" }, CH.gauge);
  mkEl("circle", { cx: 740, cy: 990, r: 9, fill: C_FG }, CH.gauge);
  CH.val = mkT("", txt("", 740, 1050, 30, C_FG, "middle"), CH.gauge);
  mkT("CIŚNIENIE OLEJU", txt("", 740, 1118, 22, C_FG2, "middle"), CH.gauge);
}
const chPress = (t) => 3.5 * (1 - easeIO(win(t, 55.4, 56.6)));
const chJump = (t) => easeIO(win(t, 59.58, 59.95));

// --- V8 4.2 FSI z boku: łańcuchy z tyłu ---
const V8 = {};
{
  const g = $("v8G");
  V8.eng = mkEl("g", {}, g);
  mkEl("path", { d: "M 150 1060 L 150 820 L 190 720 L 560 720 L 600 820 L 600 1060 Z", fill: "rgba(150,165,182,0.16)", stroke: C_FG2, "stroke-width": 5 }, V8.eng);
  mkEl("rect", { x: 210, y: 640, width: 330, height: 80, rx: 14, fill: "rgba(150,165,182,0.1)", stroke: C_FG2, "stroke-width": 4 }, V8.eng);
  mkEl("rect", { x: 190, y: 1060, width: 380, height: 60, rx: 10, fill: "rgba(150,165,182,0.1)", stroke: C_FG2, "stroke-width": 4 }, V8.eng);
  mkT("V8", { class: "sans", ...txt("", 370, 920, 90, C_FG, "middle") }, V8.eng);
  V8.chains = mkEl("g", { opacity: 0 }, V8.eng);
  V8.c1 = mkEl("path", { d: "M 575 700 L 575 1080 Q 575 1105 560 1105 Q 545 1105 545 1080 L 545 700 Q 545 675 560 675 Q 575 675 575 700 Z", fill: "none", stroke: C_HOT, "stroke-width": 8, "stroke-dasharray": "12 6" }, V8.chains);
  V8.gb = mkEl("path", { d: "M 604 820 L 700 850 L 840 885 L 840 995 L 700 1030 L 604 1060 Z", fill: "rgba(150,165,182,0.1)", stroke: C_FG2, "stroke-width": 5 }, g);
  V8.gbT = mkT("SKRZYNIA", txt("", 722, 950, 24, C_FG2, "middle"), g);
  mkT("PRZÓD", txt("", 150, 1170, 24, C_FG2), g);
  mkEl("path", { d: "M 150 1190 L 90 1190 M 110 1172 L 90 1190 L 110 1208", fill: "none", stroke: C_FG2, "stroke-width": 4 }, g);
  V8.tag = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M 560 670 L 560 590", stroke: C_HOT, "stroke-width": 3 }, V8.tag);
  mkT("ŁAŃCUCHY", txt("", 560, 575, 30, C_HOT, "middle"), V8.tag);
}

// --- deska: kontrolka silnika ---
const CE = {};
{
  const g = $("ceG");
  mkEl("rect", { x: 80, y: 560, width: 780, height: 540, rx: 60, fill: "rgba(9,12,17,0.9)", stroke: "rgba(150,165,182,0.35)", "stroke-width": 4 }, g);
  CE.needles = [];
  [[285, 800, "OBR/MIN"], [655, 800, "KM/H"]].forEach(([cx, cy, lab]) => {
    mkEl("circle", { cx, cy, r: 150, fill: "none", stroke: "rgba(150,165,182,0.3)", "stroke-width": 4 }, g);
    for (let i = 0; i <= 10; i++) { const a = (225 - i * 27) * D2R; mkEl("line", { x1: f1(cx + Math.cos(a) * 124), y1: f1(cy - Math.sin(a) * 124), x2: f1(cx + Math.cos(a) * 142), y2: f1(cy - Math.sin(a) * 142), stroke: C_FG2, "stroke-width": i % 5 ? 3 : 6 }, g); }
    mkT(lab, txt("", cx, cy + 70, 20, C_FG2, "middle"), g);
    CE.needles.push({ cx, cy, el: mkEl("line", { x1: cx, y1: cy, stroke: C_HOT, "stroke-width": 6, "stroke-linecap": "round" }, g) });
    mkEl("circle", { cx, cy, r: 12, fill: C_FG2 }, g);
  });
  // piktogram silnika (kontrolka check engine)
  CE.lamp = mkEl("path", { d: "M 395 990 L 395 1010 L 380 1010 L 380 990 Z M 400 975 L 420 975 L 420 965 L 455 965 L 455 975 L 500 975 L 515 990 L 530 990 L 530 1035 L 515 1035 L 500 1055 L 420 1055 L 400 1035 Z M 530 1000 L 548 985 L 548 1045 L 530 1030", fill: "#1c222a", stroke: "#3a424d", "stroke-width": 3 }, g);
  CE.glow = mkEl("ellipse", { cx: 465, cy: 1010, rx: 120, ry: 70, fill: "rgba(245,170,60,0.35)", opacity: 0, style: "filter: blur(16px)" }, g);
  CE.lab = mkT("CHECK ENGINE", txt("", 465, 1085, 22, C_OIL, "middle"), g);
}

// --- komputer OBD2 i telefon ---
const OB = {};
{
  const g = $("obG");
  mkEl("path", { d: "M 60 560 L 470 560 L 470 640 Q 420 700 320 700 L 60 700 Z", fill: "rgba(150,165,182,0.12)", stroke: C_FG2, "stroke-width": 4 }, g);
  mkT("POD KIEROWNICĄ", txt("", 90, 610, 24, C_FG2), g);
  mkEl("path", { d: "M 175 720 L 335 720 L 320 790 L 190 790 Z", fill: "#0b0e13", stroke: C_FG2, "stroke-width": 4 }, g);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) mkEl("rect", { x: 196 + i * 15 + r * 4, y: 738 + r * 26, width: 7, height: 14, fill: C_FG2 }, g);
  OB.dongle = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M -70 0 L 70 0 L 60 -60 L -60 -60 Z", fill: "#2a313b", stroke: C_FG2, "stroke-width": 3 }, OB.dongle);
  mkEl("rect", { x: -80, y: 0, width: 160, height: 200, rx: 26, fill: "#1b2028", stroke: C_OIL, "stroke-width": 4 }, OB.dongle);
  mkT("OBD2", txt("", 0, 110, 40, C_FG, "middle", "font-family:Oswald"), OB.dongle);
  OB.led = mkEl("circle", { cx: 0, cy: 160, r: 12, fill: "#26303a" }, OB.dongle);
  OB.phone = mkEl("g", { opacity: 0 }, g);
  mkEl("rect", { x: 520, y: 560, width: 320, height: 580, rx: 40, fill: "#10141a", stroke: C_FG2, "stroke-width": 5 }, OB.phone);
  mkEl("rect", { x: 540, y: 610, width: 280, height: 490, rx: 16, fill: "#0a0d12" }, OB.phone);
  mkT("DIAGNOSTYKA", txt("", 680, 660, 22, C_FG2, "middle"), OB.phone);
  OB.err = mkEl("g", { opacity: 0 }, OB.phone);
  mkEl("rect", { x: 556, y: 700, width: 248, height: 170, rx: 10, fill: "rgba(226,73,43,0.14)", stroke: C_HOT, "stroke-width": 3 }, OB.err);
  mkT("P0016", txt("", 680, 780, 64, C_HOT, "middle"), OB.err);
  mkT("KORELACJA", txt("", 680, 825, 20, C_FG2, "middle"), OB.err);
  mkT("WAŁ / WAŁEK", txt("", 680, 852, 20, C_FG2, "middle"), OB.err);
  OB.btn = mkEl("rect", { x: 580, y: 990, width: 200, height: 70, rx: 12, fill: "rgba(245,170,60,0.2)", stroke: C_OIL, "stroke-width": 3, opacity: 0 }, OB.phone);
  OB.btnT = mkT("SKASUJ", txt("", 680, 1036, 30, C_OIL, "middle"), OB.phone);
  OB.ok = mkEl("g", { opacity: 0 }, OB.phone);
  mkEl("path", { d: "M 640 760 L 670 792 L 726 730", fill: "none", stroke: C_OK, "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round" }, OB.ok);
  mkT("BRAK BŁĘDÓW", txt("", 680, 850, 28, C_OK, "middle"), OB.ok);
  // strzałka na koszyk TikTok Shop (lewy dół, nad podpisem)
  OB.arrow = mkEl("path", { d: "M 200 1150 L 200 1480 M 160 1436 L 200 1482 L 240 1436", fill: "none", stroke: C_OIL, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round", style: "filter: drop-shadow(0 0 14px rgba(245,170,60,0.7))" }, g);
  OB.arrowT = mkT("KOSZYK", txt("", 260, 1320, 40, C_OIL, "start", "font-family:Oswald"), g);
}

// --- zawór dolotowy i nagar ---
const VA = {};
{
  const g = $("vaG");
  mkEl("rect", { x: 60, y: 470, width: 800, height: 300, fill: "rgba(150,165,182,0.12)", stroke: C_FG2, "stroke-width": 4 }, g);
  VA.port = mkEl("path", { d: "M 60 560 C 250 560 360 620 400 760", fill: "none", stroke: "#0b0e13", "stroke-width": 86 }, g);
  mkT("DOLOT", txt("", 90, 530, 26, C_FG2), g);
  VA.valve = mkEl("path", { d: "M 424 470 L 424 740 L 360 772 L 488 772 L 424 740", fill: "rgba(150,165,182,0.55)", stroke: C_FG2, "stroke-width": 6, "stroke-linejoin": "round" }, g);
  mkT("ZAWÓR", txt("", 500, 560, 26, C_FG2), g);
  mkEl("path", { d: "M 250 772 L 250 1180 M 790 772 L 790 1180", stroke: C_FG2, "stroke-width": 6 }, g);
  VA.piston = mkEl("rect", { x: 258, y: 1060, width: 524, height: 110, fill: "rgba(150,165,182,0.2)", stroke: C_FG2, "stroke-width": 4 }, g);
  // wtryskiwacz w cylindrze
  mkEl("rect", { x: 262, y: 800, width: 60, height: 26, rx: 6, fill: C_ICE, transform: "rotate(28 292 813)" }, g);
  mkT("WTRYSKIWACZ", txt("", 270, 880, 22, C_ICE), g);
  VA.spray = mkEl("g", {}, g);
  [[560, 930], [600, 1010], [520, 1040]].forEach(([x, y]) => mkEl("line", { x1: 320, y1: 830, x2: x, y2: y, stroke: C_ICE, "stroke-width": 5, "stroke-dasharray": "4 12", "stroke-linecap": "round" }, VA.spray));
  VA.mist = [];
  for (let i = 0; i < 10; i++) VA.mist.push(mkEl("circle", { r: 8, fill: "#8a7a62", opacity: 0 }, g));
  VA.carbon = [[396, 752, 16], [452, 752, 16], [424, 718, 12], [424, 680, 10], [372, 764, 10], [476, 764, 10]].map(([x, y, r]) => ({ el: mkEl("circle", { cx: x, cy: y, r: 0, fill: "#050608", stroke: "#2c3036", "stroke-width": 2 }, g), r }));
}
const VA_PORT = [[70, 560], [220, 565], [320, 610], [380, 680], [410, 740]];

// --- auto z boku: silnik przed przednią osią ---
const CA = {};
{
  const g = $("caG");
  mkEl("path", { d: "M 70 950 L 70 860 Q 80 820 150 812 L 330 800 L 440 700 Q 460 690 490 690 L 700 690 Q 740 692 770 720 L 870 800 Q 910 810 920 860 L 920 950 Z", fill: "rgba(150,165,182,0.08)", stroke: C_FG2, "stroke-width": 5 }, g);
  for (const x of [250, 760]) { mkEl("circle", { cx: x, cy: 950, r: 72, fill: "#161b22", stroke: C_FG2, "stroke-width": 5 }, g); mkEl("circle", { cx: x, cy: 950, r: 26, fill: "none", stroke: C_FG2, "stroke-width": 4 }, g); }
  CA.front = [
    mkEl("path", { d: "M 58 870 Q 50 910 58 950 L 84 950 L 84 870 Z", fill: "rgba(150,165,182,0.3)", stroke: C_FG2, "stroke-width": 3 }, g),
    mkEl("rect", { x: 92, y: 816, width: 16, height: 124, fill: "rgba(150,165,182,0.3)", stroke: C_FG2, "stroke-width": 3 }, g),
    mkEl("g", {}, g),
  ];
  mkEl("rect", { x: 114, y: 830, width: 10, height: 104, fill: C_ICE, opacity: 0.6 }, CA.front[2]);
  mkEl("rect", { x: 128, y: 830, width: 10, height: 104, fill: C_ICE, opacity: 0.6 }, CA.front[2]);
  CA.eng = mkEl("g", {}, g);
  mkEl("rect", { x: 150, y: 820, width: 170, height: 86, rx: 8, fill: "rgba(245,170,60,0.35)", stroke: C_OIL, "stroke-width": 4 }, CA.eng);
  mkEl("rect", { x: 320, y: 834, width: 150, height: 60, rx: 8, fill: "rgba(150,165,182,0.2)", stroke: C_FG2, "stroke-width": 3 }, CA.eng);
  mkT("SILNIK", txt("", 235, 872, 22, C_FG, "middle"), CA.eng);
  mkT("SKRZYNIA", txt("", 395, 872, 18, C_FG2, "middle"), CA.eng);
  CA.axle = mkEl("path", { d: "M 250 690 L 250 1050", stroke: C_HOT, "stroke-width": 5, "stroke-dasharray": "14 10" }, g);
  CA.axleT = mkT("PRZEDNIA OŚ", txt("", 266, 668, 24, C_HOT), g);
  CA.over = mkEl("rect", { x: 150, y: 812, width: 100, height: 102, fill: "rgba(226,73,43,0.35)", opacity: 0 }, g);
  CA.clocks = [[150, 1125, "2 H", C_OK], [430, 1125, "CAŁY DZIEŃ", C_HOT]].map(([cx, cy, lab, col]) => {
    const c = mkEl("g", { opacity: 0 }, g);
    mkEl("circle", { cx, cy, r: 58, fill: "rgba(9,12,17,0.9)", stroke: col, "stroke-width": 5 }, c);
    const hand = mkEl("line", { x1: cx, y1: cy, stroke: col, "stroke-width": 6, "stroke-linecap": "round" }, c);
    mkT(lab, txt("", cx + 74, cy + 14, 40, col, "start", "font-family:Oswald"), c);
    return { c, hand, cx, cy };
  });
}

// --- krzywka wałka rozrządu 2.5 TDI ---
const CM = { cx: 470, cy: 900, R: 105 };
{
  const g = $("cmG");
  CM.orig = mkEl("path", { fill: "none", stroke: C_FG, "stroke-width": 3, "stroke-dasharray": "10 8", opacity: 0 }, g);
  CM.lobe = mkEl("path", { fill: "rgba(150,165,182,0.22)", stroke: C_FG2, "stroke-width": 6 }, g);
  mkEl("circle", { cx: CM.cx, cy: CM.cy, r: 30, fill: "#161b22", stroke: C_FG2, "stroke-width": 4 }, g);
  CM.fol = mkEl("g", {}, g);
  mkEl("rect", { x: -90, y: -130, width: 180, height: 130, rx: 10, fill: "rgba(150,165,182,0.2)", stroke: C_FG2, "stroke-width": 5 }, CM.fol);
  CM.folFace = mkEl("rect", { x: -90, y: -14, width: 180, height: 14, fill: C_FG2 }, CM.fol);
  CM.pits = [-50, -10, 34, 62].map((x) => mkEl("circle", { cx: x, cy: -7, r: 0, fill: "#050608" }, CM.fol));
  mkT("POPYCHACZ", txt("", 0, -60, 24, C_FG, "middle"), CM.fol);
  mkT("KRZYWKA", txt("", CM.cx + 170, CM.cy + 20, 24, C_FG2), g);
  CM.bars = mkEl("g", {}, g);
  CM.b1 = mkEl("rect", { x: 90, y: 1170, height: 50, rx: 6, fill: C_HOT, width: 0 }, CM.bars);
  CM.b2 = mkEl("rect", { x: 90, y: 1250, height: 50, rx: 6, fill: C_OK, width: 0 }, CM.bars);
  CM.t1 = mkT("WAŁKI", txt("", 100, 1160, 24, C_HOT), CM.bars);
  CM.t2 = mkT("RESZTA SILNIKA", txt("", 100, 1240, 24, C_OK), CM.bars);
}
// promień krzywki w kierunku (kąt względem nosa); nos zużywa się z czasem
const lobeR = (a, h) => { const c = Math.cos(a); return CM.R + (c > 0 ? h * Math.pow(c, 3) : 0); };
const lobePath = (h, rot) => { let d = ""; for (let i = 0; i <= 90; i++) { const a = (i / 90) * Math.PI * 2, r = lobeR(a, h); d += (i ? " L " : "M ") + f1(CM.cx + Math.cos(a + rot) * r) + " " + f1(CM.cy + Math.sin(a + rot) * r); } return d + " Z"; };
const camWear = (t) => easeIO(win(t, 121.36, 124.9));

// --- puchary 2010 do 2018 ---
{
  const g = $("tpG");
  for (let i = 0; i < 9; i++) {
    const cx = 210 + (i % 3) * 240, y = 540 + Math.floor(i / 3) * 215;
    const c = mkEl("g", { "data-cup": i, opacity: 0 }, g);
    mkEl("path", { d: `M ${cx - 50} ${y} L ${cx + 50} ${y} L ${cx + 44} ${y + 50} Q ${cx + 36} ${y + 90} ${cx} ${y + 96} Q ${cx - 36} ${y + 90} ${cx - 44} ${y + 50} Z`, fill: "rgba(245,170,60,0.35)", stroke: C_OIL, "stroke-width": 5, "stroke-linejoin": "round" }, c);
    mkEl("path", { d: `M ${cx - 48} ${y + 14} Q ${cx - 82} ${y + 20} ${cx - 64} ${y + 52} M ${cx + 48} ${y + 14} Q ${cx + 82} ${y + 20} ${cx + 64} ${y + 52}`, fill: "none", stroke: C_OIL, "stroke-width": 5 }, c);
    mkEl("rect", { x: cx - 8, y: y + 96, width: 16, height: 24, fill: C_OIL }, c);
    mkEl("rect", { x: cx - 38, y: y + 120, width: 76, height: 16, rx: 4, fill: C_OIL }, c);
    mkT(String(2010 + i), txt("", cx, y + 176, 32, C_FG, "middle"), c);
  }
}

// --- rachunek ---
const BI = { rows: [] };
{
  const g = $("biG");
  const paper = mkEl("g", { transform: "rotate(-2 470 850)" }, g);
  mkEl("path", { d: "M 170 500 L 770 500 L 770 1180 L 740 1200 L 710 1180 L 680 1200 L 650 1180 L 620 1200 L 590 1180 L 560 1200 L 530 1180 L 500 1200 L 470 1180 L 440 1200 L 410 1180 L 380 1200 L 350 1180 L 320 1200 L 290 1180 L 260 1200 L 230 1180 L 200 1200 L 170 1180 Z", fill: "#e9e3d5" }, paper);
  mkT("RACHUNEK", txt("", 470, 575, 34, "#1a1d22", "middle", "letter-spacing:0.3em"), paper);
  mkEl("line", { x1: 210, x2: 730, y1: 605, y2: 605, stroke: "#1a1d22", "stroke-width": 2, "stroke-dasharray": "6 6" }, paper);
  ["Nowe tłoki i pierścienie", "Napinacz łańcucha", "Czyszczenie zaworów", "Wałki i popychacze"].forEach((s, i) => {
    const r = mkEl("g", { opacity: 0 }, paper);
    mkEl("path", { d: `M 215 ${680 + i * 92} L 230 ${695 + i * 92} L 256 ${664 + i * 92}`, fill: "none", stroke: "#1a1d22", "stroke-width": 5 }, r);
    mkT(s, { x: 280, y: 700 + i * 92, style: "font-family:Oswald;font-size:40px;font-weight:600;fill:#1a1d22;letter-spacing:0" }, r);
    BI.rows.push(r);
  });
  mkEl("line", { x1: 210, x2: 730, y1: 1040, y2: 1040, stroke: "#1a1d22", "stroke-width": 3 }, paper);
  BI.pay = mkEl("g", { opacity: 0 }, paper);
  mkT("PŁACI:", txt("", 215, 1100, 28, "#1a1d22"), BI.pay);
  mkT("PIERWSZY WŁAŚCICIEL", { x: 215, y: 1148, style: "font-family:Oswald;font-size:46px;font-weight:600;fill:#c8321a;letter-spacing:0" }, BI.pay);
}

// --- olej: litr, miska, 30 000 km, sześć misek ---
const OI = { minis: [] };
{
  const g = $("oiG");
  OI.bottle = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M 120 560 L 150 520 L 150 490 L 200 490 L 200 520 L 250 560 L 250 780 Q 250 800 230 800 L 140 800 Q 120 800 120 780 Z", fill: "rgba(245,170,60,0.55)", stroke: C_OIL, "stroke-width": 5 }, OI.bottle);
  mkT("1 L", txt("", 185, 700, 56, "#1a1206", "middle", "font-family:Oswald"), OI.bottle);
  OI.sump = mkEl("g", { opacity: 0 }, g);
  mkEl("path", { d: "M 340 540 L 360 800 L 820 800 L 840 540", fill: "rgba(150,165,182,0.1)", stroke: C_FG2, "stroke-width": 5 }, OI.sump);
  OI.sumpFill = mkEl("rect", { x: 356, width: 468, fill: "rgba(245,170,60,0.55)" }, OI.sump);
  OI.sumpT = mkT("4,6 L", txt("", 590, 700, 64, C_FG, "middle", "font-family:Oswald"), OI.sump);
  mkT("MISKA", txt("", 590, 850, 24, C_FG2, "middle"), OI.sump);
  OI.odo = mkEl("g", { opacity: 0 }, g);
  OI.dig = [];
  for (let i = 0; i < 6; i++) {
    mkEl("rect", { x: 90 + i * 86, y: 880, width: 76, height: 104, rx: 8, fill: "#0d1117", stroke: "rgba(150,165,182,0.45)", "stroke-width": 3 }, OI.odo);
    OI.dig.push(mkT("0", txt("", 128 + i * 86, 960, 76, C_FG, "middle"), OI.odo));
  }
  mkT("KM", txt("", 620, 960, 50, C_FG, "start", "font-family:Oswald"), OI.odo);
  for (let i = 0; i < 6; i++) {
    const m = mkEl("g", { opacity: 0 }, g), x = 90 + i * 126;
    mkEl("path", { d: `M ${x} 1020 L ${x + 8} 1110 L ${x + 102} 1110 L ${x + 110} 1020`, fill: "none", stroke: C_FG2, "stroke-width": 4 }, m);
    const fl = mkEl("rect", { x: x + 6, width: 98, fill: "rgba(245,170,60,0.7)" }, m);
    OI.minis.push({ m, fl });
  }
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gMech") {
    stepH($("meH"), t, [[17.72, "Więc czemu <em>mechanicy</em>"], [18.86, "Kochają Audi <em>bardziej</em>"], [20.14, "Niż <span class=\"hot\">właściciele?</span>"]]);
    ME.forEach((r, i) => {
      popS(r.g, t, i ? 20.14 : 17.9, 30);
      r.bar.setAttribute("width", f1(748 * r.to * easeIO(win(t, r.at, r.at + 0.8))));
    });
  } else if (id === "gEA") {
    pop($("eaN"), t, 24.12, 0.3, 30);
    pop($("eaU"), t, 25.58, 0.3, 20);
    stepH($("eaH"), t, [[26.74, "<em>4 cylindry</em> w rzędzie"]]);
    eaCyl.forEach((c, i) => popS(c, t, 26.9 + i * 0.12, 24));
    [...$("eaC").children].forEach((c) => pop(c, t, +c.dataset.t, 0.25, 24));
  } else if (id === "gRing") {
    stepH($("rgH"), t, [[37.12, "Zbiera olej <em>ze ściany</em>"], [39.54, "Oddaje przez <em>otworki</em>"], [41.22, "Otworki <span class=\"hot\">za małe</span>"], [43.54, "Zapychały się <span class=\"hot\">nagarem</span>"], [44.84, "Pierścień <span class=\"hot\">stawał w rowku</span>"]]);
    const hk = easeOut(win(t, 39.6, 40.0)) * (1 - easeIO(win(t, 41.1, 41.5)));
    op(RG.holeHi, hk);
    const small = easeIO(win(t, 41.22, 41.9));
    RG.hole.setAttribute("y", f1(760 + 7 * small)); RG.hole.setAttribute("height", f1(22 - 14 * small));
    RG.hole.setAttribute("stroke", small > 0.5 ? C_HOT : C_FG2);
    RG.carbon.forEach((c, i) => c.setAttribute("r", f1(12 * easeOut(win(t, 43.6 + i * 0.25, 44.2 + i * 0.25)))));
    const stuck = easeIO(win(t, 44.84, 45.4));
    [...RG.oil.children].forEach((e) => { e.setAttribute(e.tagName === "path" ? "stroke" : "fill", stuck > 0.5 ? C_HOT : C_OIL); });
    const clog = easeIO(win(t, 43.54, 44.6)), up = easeIO(win(t, 45.0, 45.8));
    RG.drops.forEach((d, i) => {
      const u = wrap(i / RG.drops.length + (t - 37) * 0.28, 1);
      const lim = lerp(1, 0.38, clog);
      const pd = polyAt(RG_DOWN, Math.min(u, lim)), pu = polyAt(RG_UP, u);
      const useUp = hash(i + 3) < up;
      const p = useUp ? pu : pd;
      d.setAttribute("cx", f1(p[0])); d.setAttribute("cy", f1(p[1]));
      const fade = useUp ? 1 - win(u, 0.85, 1) : 1 - win(u, 0.9, 1);
      op(d, easeOut(win(t, 37.3 + i * 0.05, 37.7 + i * 0.05)) * fade);
    });
    op(RG.flame, 0.9 * easeOut(win(t, 45.6, 46.2)));
  } else if (id === "gPist") {
    stepH($("psH"), t, [[48.16, "Audi po cichu <em>zmieniło tłoki</em>"], [50.14, "Tobie <span class=\"hot\">zostały stare</span>"]]);
    popS(psNew, t, 48.9, 30);
    popS(psOld, t, 50.14, 30);
    const sk = easeOut(win(t, 50.96, 51.36));
    $("stStare").style.opacity = sk;
    $("stStare").style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.12 - 0.12 * sk).toFixed(3) + ")";
  } else if (id === "gChain") {
    stepH($("chH"), t, [[53.3, "Napinacz trzyma <em>ciśnieniem oleju</em>"], [55.34, "Po postoju <span class=\"hot\">ciśnienia nie ma</span>"], [57.0, "Napinacz <span class=\"hot\">bez blokady</span>"], [58.64, "Łańcuch <span class=\"hot\">przeskakuje o ząb</span>"]]);
    const p = chPress(t), slack = 1 - p / 3.5, jump = chJump(t);
    const camA = (t - 53) * 40, crA = camA * 2;
    CH.cam.setAttribute("transform", `translate(${CH.cx} ${CH.cy}) rotate(${f1(camA + 9 * jump)})`);
    CH.crank.setAttribute("transform", `translate(${CH.kx} ${CH.ky}) rotate(${f1(crA)})`);
    // oczekiwane położenie znacznika (przerywane) i prawdziwe (czerwone po przeskoku)
    CH.ghost.setAttribute("transform", `rotate(${f1(camA)} ${CH.cx} ${CH.cy})`);
    op(CH.ghost, easeOut(win(t, 59.7, 60.0)));
    CH.mark.setAttribute("fill", jump > 0.5 ? C_HOT : C_OIL);
    const bow = lerp(34, -22, easeIO(slack));
    CH.chain.setAttribute("d", `M 340 640 A 130 130 0 0 1 600 640 L 540 1180 A 70 70 0 0 1 400 1180 Q ${f1(372 + bow)} 910 340 640 Z`);
    CH.chain.style.strokeDashoffset = f1(-(t - 53) * 120);
    const gx = 362 + bow * 0.5;
    CH.guide.setAttribute("d", `M ${f1(gx - 8)} 780 Q ${f1(gx - 2)} 910 ${f1(gx - 8)} 1040`);
    CH.plunger.setAttribute("x", 260); CH.plunger.setAttribute("width", f1(Math.max(4, gx - 16 - 260)));
    const na = (225 - (p / 4) * 270) * D2R;
    CH.needle.setAttribute("x2", f1(740 + Math.cos(na) * 70)); CH.needle.setAttribute("y2", f1(990 - Math.sin(na) * 70));
    CH.needle.setAttribute("stroke", p < 1 ? C_HOT : C_OIL);
    CH.val.textContent = (Math.round(p * 10) / 10).toFixed(1).replace(".", ",") + " BAR";
    op(CH.lock, easeOut(win(t, 57.12, 57.5)));
  } else if (id === "gV8") {
    stepH($("v8H"), t, [[64.38, "A w <em>V8 4.2</em>"], [66.22, "Łańcuchy <span class=\"hot\">z tyłu</span>"], [67.48, "Od strony <em>skrzyni</em>"]]);
    popS(V8.eng, t, 64.5, 30);
    op(V8.chains, easeOut(win(t, 66.22, 66.6)));
    V8.c1.style.strokeDashoffset = f1(-(t - 64) * 60);
    op(V8.tag, easeOut(win(t, 66.5, 66.9)));
    const gk = easeOut(win(t, 67.48, 67.9));
    V8.gb.setAttribute("stroke", gk > 0.5 ? C_OIL : C_FG2); V8.gb.setAttribute("fill", `rgba(245,170,60,${f1(0.25 * gk)})`);
    V8.gbT.setAttribute("style", `font-size:24px;font-weight:600;fill:${gk > 0.5 ? C_OIL : C_FG2}`);
  } else if (id === "gCel") {
    stepH($("ceH"), t, [[71.72, "Mała <em>rzecz</em>"], [72.58, "Rozciągnięty <em>łańcuch</em>"], [73.8, "Najpierw zapala <em>check engine</em>"]]);
    CE.needles.forEach((n, i) => {
      const v = i ? 0.35 + 0.01 * Math.sin(t * 1.3) : 0.12 + 0.012 * Math.sin(t * 2.1);
      const a = (225 - v * 270) * D2R;
      n.el.setAttribute("x2", f1(n.cx + Math.cos(a) * 118)); n.el.setAttribute("y2", f1(n.cy - Math.sin(a) * 118));
    });
    const lk = easeOut(win(t, 74.62, 75.0));
    CE.lamp.setAttribute("fill", lk > 0.02 ? `rgba(245,170,60,${f1(0.25 + 0.75 * lk)})` : "#1c222a");
    CE.lamp.setAttribute("stroke", lk > 0.5 ? C_OIL : "#3a424d");
    op(CE.glow, lk); op(CE.lab, lk);
  } else if (id === "gObd") {
    stepH($("obH"), t, [[75.44, "Mały <em>komputer</em>"], [77.16, "Wpinasz <em>pod kierownicą</em>"], [78.8, "Na telefonie <em>czytasz błędy</em>"], [80.2, "I je <em>kasujesz</em>"], [81.1, "Wiesz, <em>zanim silnik pójdzie</em>"], [82.92, "Masz go <em>w koszyku</em>"]]);
    const dk = easeOut(win(t, 75.5, 75.9)), plug = easeIO(win(t, 77.16, 77.9));
    op(OB.dongle, dk);
    OB.dongle.setAttribute("transform", `translate(255 ${f1(lerp(1010, 850, plug) + (1 - dk) * 30)})`);
    OB.led.setAttribute("fill", t >= 77.9 ? C_ICE : "#26303a");
    const pk = easeOut(win(t, 78.64, 79.1));
    op(OB.phone, pk);
    OB.phone.setAttribute("transform", `translate(0 ${f1((1 - pk) * 40)})`);
    const ek = easeOut(win(t, 79.28, 79.6)) * (1 - easeIO(win(t, 80.5, 80.85)));
    op(OB.err, ek);
    op(OB.btn, easeOut(win(t, 79.6, 79.9)));
    OB.btn.setAttribute("fill", t >= 80.36 ? "rgba(245,170,60,0.75)" : "rgba(245,170,60,0.2)");
    OB.btnT.setAttribute("style", `font-size:30px;font-weight:600;fill:${t >= 80.36 ? "#1a1206" : C_OIL}`);
    op(OB.btnT, easeOut(win(t, 79.6, 79.9)));
    op(OB.ok, easeOut(win(t, 80.8, 81.2)));
    const ak = easeIO(win(t, 82.92, 83.5));
    dash(OB.arrow, ak, 700);
    op(OB.arrow, ak > 0.01 ? 1 : 0);
    op(OB.arrowT, easeOut(win(t, 83.3, 83.7)));
  } else if (id === "gValve") {
    stepH($("vaH"), t, [[86.4, "Wtrysk <em>bezpośredni</em>"], [87.58, "Paliwo <em>prosto do cylindra</em>"], [89.48, "Nic nie myje <span class=\"hot\">zaworów</span>"], [91.38, "Olej <em>z odmy</em>"], [93.06, "Zawory <span class=\"hot\">zarastają</span>"], [93.84, "Silnik <span class=\"hot\">traci moc</span>"], [95.1, "I <span class=\"hot\">szarpie</span>"]]);
    const sp = easeOut(win(t, 87.58, 88.0));
    op(VA.spray, sp * (0.55 + 0.35 * Math.sin(t * 5.5)));
    VA.piston.setAttribute("y", f1(1060 + 20 * Math.sin(t * 2.2)));
    const mk = easeOut(win(t, 91.38, 91.8));
    VA.mist.forEach((m, i) => { const u = wrap(i / VA.mist.length + (t - 91) * 0.32, 1); const p = polyAt(VA_PORT, u); m.setAttribute("cx", f1(p[0])); m.setAttribute("cy", f1(p[1])); op(m, mk * (1 - win(u, 0.85, 1)) * 0.9); });
    VA.carbon.forEach((c, i) => c.el.setAttribute("r", f1(c.r * easeOut(win(t, 92.0 + i * 0.22, 92.7 + i * 0.22)))));
    VA.valve.setAttribute("stroke", t >= 93.06 ? C_HOT : C_FG2);
  } else if (id === "gCar") {
    const ph2 = t >= 110;
    const ek = easeOut(win(t, 101.6, 102.4));
    CA.eng.setAttribute("transform", `translate(0 ${f1(ph2 ? 0 : (1 - ek) * -160)})`);
    op(CA.eng, ph2 ? 1 : ek);
    const axk = ph2 ? 1 : easeIO(win(t, 103.3, 103.8));
    dash(CA.axle, axk, 400); op(CA.axleT, axk);
    op(CA.over, ph2 ? 0.8 : 0.8 * easeOut(win(t, 103.6, 104.0)));
    if (!ph2) {
      stepH($("caH"), t, [[101.48, "Silnik <em>wzdłużnie</em>"], [103.22, "Przed <em>przednią osią</em>"]]);
      CA.front.forEach((f) => { f.setAttribute("transform", ""); op(f, 1); });
      CA.clocks.forEach((c) => op(c.c, 0));
    } else {
      stepH($("caH"), t, [[110.08, "<span class=\"hot\">Zderzak</span>"], [110.74, "<span class=\"hot\">Pas przedni</span>"], [111.6, "<span class=\"hot\">Chłodnice</span>"], [113.9, "W innym aucie <em>dwie godziny</em>"], [114.68, "Tu <span class=\"hot\">cały dzień</span>"]]);
      [110.08, 110.74, 111.6].forEach((a, i) => {
        const k = easeIO(win(t, a, a + 0.6));
        CA.front[i].setAttribute("transform", `translate(${f1(-150 * k)} ${f1(-60 * k)})`);
        op(CA.front[i], 1 - 0.8 * k);
      });
      const c1 = CA.clocks[0], c2 = CA.clocks[1];
      popS(c1.c, t, 113.9, 20); popS(c2.c, t, 114.9, 20);
      const a1 = -90 + 720 * easeIO(win(t, 113.9, 114.6)), a2 = -90 + (t > 114.9 ? (t - 114.9) * 520 : 0);
      c1.hand.setAttribute("x2", f1(c1.cx + Math.cos(a1 * D2R) * 42)); c1.hand.setAttribute("y2", f1(c1.cy + Math.sin(a1 * D2R) * 42));
      c2.hand.setAttribute("x2", f1(c2.cx + Math.cos(a2 * D2R) * 42)); c2.hand.setAttribute("y2", f1(c2.cy + Math.sin(a2 * D2R) * 42));
    }
  } else if (id === "gCam") {
    stepH($("cmH"), t, [[118.12, "<em>2.5 TDI</em> V6"], [120.38, "Wałki <em>rozrządu</em>"], [121.36, "<span class=\"hot\">Ścierały się</span>"], [122.4, "Razem z <em>popychaczami</em>"], [123.18, "Krzywki <span class=\"hot\">zjedzone</span>"], [124.34, "Do <span class=\"hot\">gołego metalu</span>"], [125.34, "Długo <em>przed resztą silnika</em>"]]);
    const w = camWear(t), h = lerp(92, 22, w), rot = (t - 118) * 1.6;
    CM.lobe.setAttribute("d", lobePath(h, rot));
    CM.orig.setAttribute("d", lobePath(92, rot));
    op(CM.orig, easeOut(win(t, 121.6, 122.0)) * 0.7);
    CM.lobe.setAttribute("stroke", w > 0.3 ? C_HOT : C_FG2);
    // popychacz leży na krzywce: podnosi go promień krzywki skierowany w górę
    const up = lobeR(-Math.PI / 2 - rot, h);
    CM.fol.setAttribute("transform", `translate(${CM.cx} ${f1(CM.cy - up - 4)})`);
    CM.folFace.setAttribute("fill", t >= 122.4 ? C_HOT : C_FG2);
    CM.pits.forEach((p, i) => p.setAttribute("r", f1(6 * easeOut(win(t, 122.6 + i * 0.2, 123.0 + i * 0.2)))));
    const bk = easeIO(win(t, 125.34, 126.2));
    CM.b1.setAttribute("width", f1(200 * bk)); CM.b2.setAttribute("width", f1(740 * easeIO(win(t, 125.5, 126.6))));
    op(CM.bars, easeOut(win(t, 125.34, 125.6)));
  } else if (id === "gTrophy") {
    stepH($("tpH"), t, [[129.92, "Piątka <em>2.5 TFSI</em>"], [131.88, "<em>9 razy</em> z rzędu"], [133.1, "<em>Silnik roku</em>"]]);
    [...$("tpG").querySelectorAll("[data-cup]")].forEach((c) => { const i = +c.dataset.cup; popS(c, t, 131.95 + i * 0.16, 36); });
  } else if (id === "gBill") {
    stepH($("biH"), t, [[137.5, "Ale to <em>poprawki</em>"], [138.46, "Na koszt <span class=\"hot\">pierwszych właścicieli</span>"]]);
    BI.rows.forEach((r, i) => popS(r, t, 137.7 + i * 0.28, 16));
    popS(BI.pay, t, 139.0, 20);
  } else if (id === "gOil") {
    stepH($("oiH"), t, [[145.96, "<em>Litr</em>"], [146.52, "W misce <em>niecałe pięć</em>"], [148.32, "Co <em>30 000 km</em>"], [150.2, "Możesz dolać <em>6 pełnych misek</em>"], [152.32, "Tego nie nazywam <span class=\"hot\">precyzją</span>"]]);
    popS(OI.bottle, t, 146.0, 30);
    popS(OI.sump, t, 146.52, 30);
    const fk = easeIO(win(t, 146.8, 147.7));
    OI.sumpFill.setAttribute("y", f1(795 - 220 * fk)); OI.sumpFill.setAttribute("height", f1(220 * fk));
    op(OI.sumpT, easeOut(win(t, 147.36, 147.7)));
    popS(OI.odo, t, 148.32, 24);
    const km = Math.round(30000 * easeIO(win(t, 148.6, 151.5)));
    const s = String(km).padStart(6, "0"), lead = 6 - String(km).length;
    OI.dig.forEach((d, i) => { if (d.textContent !== s[i]) d.textContent = s[i]; d.setAttribute("style", `font-size:76px;font-weight:600;fill:${i >= lead && km > 0 ? C_OIL : C_FG}`); });
    OI.minis.forEach((m, i) => {
      popS(m.m, t, 148.5 + i * 0.08, 16);
      const k = clamp01(km / 5000 - i);
      m.fl.setAttribute("y", f1(1106 - 82 * k)); m.fl.setAttribute("height", f1(82 * k));
    });
  }
}


/* ================= engagement ================= */
const RW = ["? ? ?", "Pół litra", "Szklanka", "Litr", "Norma?", "Miska"];
const RN = RW.length, RROW = 50, ANS = "1 l / 1000 km", T_ANS = 144.3;
const BURSTS = [[8.4, 9.4, 2 * RN], [31.3, 32.0, 2 * RN], [51.6, 52.3, 2 * RN], [84.85, 85.55, 2 * RN], [99.7, 100.4, 2 * RN], [116.45, 117.15, 2 * RN], [127.0, 127.7, 2 * RN], [140.35, 141.2, 2 * RN], [142.3, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
const SHOP = [["shop1", 95.1, 97.6], ["shop2", 115.24, 117.74], ["shop3", 134.9, 137.4]];
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 8.26, 146.6);
  rb.style.opacity = rOn ? (easeOut(win(t, 8.26, 8.56)) * (1 - easeIO(win(t, 146.2, 146.6)))).toFixed(3) : 0;
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
      easeOut(win(t, 8.26, 8.66)) * (1 - easeIO(win(t, 9.7, 10.2))),
      easeIO(win(t, 140.26, 140.65)) * (1 - easeIO(win(t, 141.0, 141.4))),
      easeIO(win(t, 141.6, 142.0)) * (1 - easeIO(win(t, 145.5, 145.95))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  // TikTok Shop: trzy ciche karty ze strzałką w dół, na koszyk
  SHOP.forEach(([id, a, b]) => {
    const el = $(id), on = inR(t, a, b);
    el.style.opacity = on ? (easeOut(win(t, a, a + 0.35)) * (1 - easeIO(win(t, b - 0.35, b)))).toFixed(3) : 0;
    if (on) el.style.transform = "translateY(" + ((1 - easeOut(win(t, a, a + 0.4))) * 24).toFixed(1) + "px)";
  });
  const sc = $("serCard");
  const sOn = inR(t, 149.4, 152.9);
  sc.style.opacity = sOn ? (easeOut(win(t, 149.4, 149.8)) * (1 - easeIO(win(t, 152.5, 152.9)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 149.4, 149.9))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 153.96, 158.7);
  pc.style.opacity = pOn ? (easeOut(win(t, 153.96, 154.35)) * (1 - easeIO(win(t, 158.35, 158.7)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 153.96, 154.35))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 155.16 ? (t < 155.94 ? easeOut(win(t, 155.16, 155.36)) : 0.5) : 0;
    const gB = t > 155.94 ? easeOut(win(t, 155.94, 156.14)) : 0;
    on("pkA", Math.max(gA, t > 156.76 ? 0.5 + 0.5 * Math.sin((t - 156.76) * 3) : 0));
    on("pkB", t > 156.76 ? 0.5 - 0.5 * Math.sin((t - 156.76) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 156.76, 157.1));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 158.8, 167.25);
  yc.style.opacity = yOn ? (easeOut(win(t, 158.8, 159.2)) * (1 - easeIO(win(t, 166.95, 167.25)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 158.8, 159.3))) * -60).toFixed(1) + "px)";
}

/* ================= B-roll ================= */
// wideo pokazuje HyperFrames według data-start / data-duration; tu tylko warstwa z napisami natywnymi
const BR_VIDS = [...document.querySelectorAll("video.broll")];
const CAPS = { brDym: [46.4, "Prosto <i>do spalania</i>"], brVan: [63.02, "Silnik <i>do wyrzucenia</i>"], brRozbior: [68.6, "Wyciągasz <i>cały silnik</i>"] };
function drawBroll(t, name) {
  $("brUi").style.opacity = name ? 1 : 0;
  $("brShadeB").style.opacity = name === "brKasa" ? 1 : 0;
  BR_VIDS.forEach((v) => { const a = +v.dataset.start; v.style.opacity = t >= a && t < a + +v.dataset.duration ? 1 : 0; });
  const c = $("brCap"), cp = name && CAPS[name];
  if (!cp) { c.style.opacity = 0; return; }
  if (c.innerHTML !== cp[1]) c.innerHTML = cp[1];
  pop(c, t, cp[0] + 0.05, 0.22, 24);
}

/* ================= render klatki ================= */
// plansza i 3D przenikają się przez 0,4 s zamiast twardego cięcia
const XF = 0.4;
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const si = shotIdx(t), [s0, , kind, name] = SHOTS[si], prev = SHOTS[si - 1];
  // przenikanie tylko między 3D a planszą; B-roll wchodzi i schodzi twardym cięciem
  const fresh = prev && t - s0 < XF && ((prev[2] === "3d" && kind === "board") || (prev[2] === "board" && kind === "3d"));
  let boardK = 0, boardName = null, si3 = -1;
  if (kind === "board") { boardName = name; boardK = fresh ? easeIO((t - s0) / XF) : 1; if (fresh) si3 = si - 1; }
  else { if (kind === "3d") si3 = si; if (fresh) { boardName = prev[3]; boardK = 1 - easeIO((t - s0) / XF); } }
  drawBroll(t, kind === "broll" ? name : null);
  bd.style.opacity = boardK.toFixed(3);
  if (boardName) drawBoard(t, boardName);
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
  pose5(st, deg, t);
  applyCam(t, name, camera, si);
  lightAt(new THREE.Vector3(0, st.lift * 480, 0), camera);
  projCam = camera;
  drawHook(t, name);
  drawTop(t, si);
  drawTags(t);
  usePassCam(camera);
  composer.render();
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
// rozgrzewka: shader przezroczystego odlewu kompiluje się przy pierwszym renderze, więc klatka 0 musi być drugim renderem
renderAt(0); renderAt(0);
window.__dbg = { E5, camera, composer, scene, SHOTS, K5 };
