// Short o zawieszeniu. Model Antoniego (localhost:8126) sterowany solverem więzów;
// wszystko jest czystą funkcją czasu, zsynchronizowaną ze słowami lektora.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation } from "./model/src/lib/materials.js";
import { buildStudioEnvironment, makeStudioFloor } from "./model/src/lib/environment.js";
import { buildSuspension } from "./model/src/parts/suspension.js";
import { solveCorner, P } from "./model/src/kinematics.js";

const W = 1080, H = 1920, END = 99;
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
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
    if (n === 1 || t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t >= xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h <= 0) return ys[i + 1];
    const s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

/* ================= przedziały warstw ================= */
const BR = [[0, 6.78], [11.07, 12.4], [36.4, 37.5], [44.9, 46.1], [90.0, 91.2], [96.3, 99.0]];
const WHEEL_OFF = [27.3, 40.0];

/* ================= skok koła i skręt pod lektora ================= */
const WORN = { a: 55, z: 0.9, f: 1.4 }, NEW_ = { a: 55, z: 4.2, f: 1.4 };
const bounce = (p, tau) => (tau < 0 ? 0 : p.a * Math.exp(-p.z * tau) * Math.cos(2 * Math.PI * p.f * tau));
const DROOP = -70;
function travelAt(t) {
  if (t < 12.4) return 30 * Math.sin(t * 1.9);
  if (t < 18.3) return 12 * Math.sin(t * 1.4);
  if (t < 19.5) return 45 * Math.sin(Math.PI * win(t, 18.3, 19.45));
  if (t < 21.7) return 35 * Math.sin((t - 19.54) * 3.1) * win(t, 19.5, 19.8);
  if (t < 25.56) return 10 * Math.sin(t * 1.4);
  if (t < 27.0) { const tau = t - 25.56; return 50 * Math.exp(-5 * tau) * Math.cos(16 * tau); }
  if (t < 40.2) return 0;
  if (t < 46.1) return 10 * Math.sin((t - 40.2) * 1.6);
  if (t < 50.9) return bounce(WORN, t - 46.1);
  if (t < 53.7) return 8 * Math.sin((t - 50.9) * 1.6);
  if (t < 61.58) return 0;
  if (t < 63.6) return DROOP * easeIO(win(t, 61.58, 63.6));
  if (t < 68.06) return DROOP;
  if (t < 69.5) return DROOP * (1 - easeOut(win(t, 68.06, 69.2)));
  if (t < 74.7) return 0;
  if (t < 76.9) { const x = (t - 74.7) / 1.1; return 60 * Math.pow(Math.sin(Math.PI * x), 2); }
  if (t < 81.3) return 0;
  if (t < 84.6) return 45 * Math.sin((t - 81.3) * 3.4) * win(t, 81.3, 81.6);
  if (t < 87.2) return 30 * Math.sin((t - 84.66) * 2.6);
  return 12 * Math.sin(t * 1.4);
}
const steerAt = (t) => (inR(t, 21.72, 23.3) ? 0.9 * Math.sin((t - 21.72) * 3.3) * win(t, 21.72, 21.95) * (1 - win(t, 23.0, 23.3)) : 0);
const spinAt = (t) => t * 1.2;

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = buildStudioEnvironment(renderer).env;
{
  // tło w języku filmiku o 1200 obrotach: ciemny gradient, poświata, siatka 90 px
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, "#1c232c"); lin.addColorStop(0.45, "#151b22"); lin.addColorStop(1, "#0a0d11");
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  const rad = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 900);
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
const key = new THREE.DirectionalLight(0xfffaf2, 2.7);
key.position.set(1400, 1900, 1200);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 200, far: 6000, left: -900, right: 900, top: 900, bottom: -900 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.4; key.shadow.radius = 3.5;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.55); fill.position.set(-1500, 700, 900); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(-500, 1200, -1600); scene.add(rim);
const bounceL = new THREE.DirectionalLight(0xd9c7a8, 0.25); bounceL.position.set(300, -900, 400); scene.add(bounceL);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));
const floor = makeStudioFloor(12000);
floor.position.y = 70;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 20000);

const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.25; }
const susp = buildSuspension(M);
applyMaterialVariation(susp.root, M);
scene.add(susp.root);
const byName = (n) => susp.root.getObjectByName(n);
const G = susp.groups;

/* podświetlenia: każda grupa dostaje własne kopie materiałów */
const AMBER = 0xff8a1c, RED = 0xff2a12;
function hi(objs) {
  const map = new Map(), mats = [];
  objs.filter(Boolean).forEach((r) => r.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let c = map.get(o.material);
    if (!c) { c = o.material.clone(); c.emissive = new THREE.Color(AMBER); c.emissiveIntensity = 0; map.set(o.material, c); mats.push(c); }
    o.material = c;
  }));
  return { mats, set(k, col = AMBER) { for (const c of mats) { c.emissive.setHex(col); c.emissiveIntensity = k; } } };
}
const hArms = hi([G.lowerArm, G.upperArm]);
const hKnuckle = hi([G.knuckle]);
const hDamper = hi([G.damper]);
const hArb = hi([byName("ANTI_ROLL_BAR"), G.arbArm]);
const hLink = hi([G.droplink]);
const hTie = hi([G.tieRod]);
const hBoot = hi([byName("LowerBallJoint_Boot"), byName("UpperBallJoint_Boot")]);
const hBJ = hi([byName("LowerBallJoint_Housing")]);
const hBushL = hi([byName("LCA_Bush_Front"), byName("LCA_Bush_Rear")]);
const hBushU = hi([byName("UCA_Bush_Front"), byName("UCA_Bush_Rear")]);
const bushBase = hBushL.mats.map((m) => m.color.clone());

/* woda i piach wlatujące pod pękniętą osłonę */
const grains = [];
for (let i = 0; i < 34; i++) {
  const water = i % 3 === 0;
  const m = new THREE.Mesh(new THREE.SphereGeometry(water ? 3.2 : 2.4, 10, 8), new THREE.MeshStandardMaterial({ color: water ? 0x5aa6ff : 0xb89a6a, roughness: water ? 0.1 : 0.9, metalness: 0, emissive: water ? 0x1a4aa0 : 0x2a2012, emissiveIntensity: 0.6 }));
  m.visible = false;
  scene.add(m);
  const a = hash(i) * Math.PI * 2, r = 120 + hash(i + 3) * 90;
  grains.push({ m, from: new THREE.Vector3(Math.cos(a) * r, 60 + hash(i + 7) * 120, Math.sin(a) * r), delay: hash(i + 11) * 1.6 });
}

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
{
  let seed = 20260923;
  const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const orig = Math.random;
  Math.random = seeded;
  const ssao = new SSAOPass(scene, camera, W, H);
  Math.random = orig;
  Object.assign(ssao, { kernelRadius: 130, minDistance: 20, maxDistance: 900 });
  composer.addPass(ssao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.18, 0.65, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.32 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv - 0.5) * vec2(1.0, 0.8); float v = smoothstep(0.95, 0.25, length(p) * 1.35); c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }",
}));
composer.setSize(W, H);

/* ================= kamera ================= */
const Pv = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const CAM = [
  { t: 6.78, k: [[6.78, Pv(1.25, 0.30, 3300, 540, 330, 0, 32, 70)], [11.07, Pv(1.05, 0.26, 3000, 540, 330, 0, 32, 70)]] },
  { t: 12.4, k: [
    [12.4, Pv(1.35, 0.28, 3200, 520, 330, 0, 32, 70)], [14.3, Pv(1.25, 0.30, 2900, 520, 330, 0, 32, 70)],
    [16.76, Pv(1.10, 0.32, 2600, 540, 400, 0, 32, 70)], [19.54, Pv(-0.70, 0.55, 2800, 470, 280, -150, 32, 70)],
    [21.72, Pv(-1.35, 0.28, 2400, 500, 220, -150, 32, 70)], [23.2, Pv(1.20, 0.34, 3300, 520, 330, 0, 32, 70)],
    [27.0, Pv(1.25, 0.33, 3200, 520, 330, 0, 32, 70)]] },
  { t: 27.06, k: [[27.06, Pv(1.20, 0.32, 3000, 540, 300, 0, 32, 70)], [29.2, Pv(0.92, 0.20, 1000, 740, 150, 40, 34, 130)], [36.4, Pv(0.80, 0.16, 880, 740, 150, 40, 34, 130)]] },
  { t: 37.5, k: [[37.5, Pv(1.25, 0.22, 1150, 740, 170, 40, 34, 130)], [40.1, Pv(1.10, 0.20, 1050, 740, 170, 40, 34, 130)]] },
  { t: 40.2, k: [[40.2, Pv(1.45, 0.22, 1900, 540, 400, 0, 34, 90)], [44.9, Pv(1.38, 0.20, 1800, 540, 400, 0, 34, 90)]] },
  { t: 46.1, k: [[46.1, Pv(1.52, 0.06, 3000, 560, 330, 0, 32, 230)], [53.7, Pv(1.45, 0.08, 2850, 560, 330, 0, 32, 230)]] },
  { t: 53.7, k: [[53.7, Pv(1.30, 0.25, 2200, 420, 200, 150, 32, 70)], [55.26, Pv(1.30, 0.22, 1150, 360, 175, 215, 34, 170)], [61.5, Pv(1.34, 0.20, 1080, 360, 175, 215, 34, 170)]] },
  { t: 61.58, k: [[61.58, Pv(1.40, 0.14, 2600, 500, 230, 100, 32, 70)], [67.9, Pv(1.35, 0.14, 2450, 500, 230, 100, 32, 70)], [69.4, Pv(1.30, 0.22, 1150, 360, 175, 215, 34, 170)], [79.2, Pv(1.34, 0.20, 1080, 360, 175, 215, 34, 170)]] },
  { t: 79.3, k: [[79.3, Pv(1.22, 0.24, 1250, 380, 180, 215, 34, 170)], [84.6, Pv(1.18, 0.22, 1150, 380, 180, 215, 34, 170)]] },
  { t: 84.66, k: [[84.66, Pv(-0.90, 0.45, 1500, 465, 240, -280, 34, 150)], [87.2, Pv(-0.80, 0.40, 1400, 465, 240, -280, 34, 150)]] },
  { t: 87.26, k: [[87.26, Pv(1.20, 0.34, 3200, 540, 330, 0, 32, 70)], [90.0, Pv(1.10, 0.32, 3050, 540, 330, 0, 32, 70)]] },
  { t: 91.2, k: [[91.2, Pv(2.60, 0.80, 2600, 520, 220, -40, 32, 230)], [96.3, Pv(2.75, 0.76, 2450, 520, 220, -40, 32, 230)]] },
];
const PK = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
CAM.forEach((s) => { s.f = {}; PK.forEach((p) => { s.f[p] = mono(s.k.map((k) => [k[0], k[1][p]])); }); });
const camTgt = new THREE.Vector3();
function applyCam(t, shake) {
  let s = CAM[0];
  for (const c of CAM) if (t >= c.t) s = c;
  const v = {};
  PK.forEach((p) => { v[p] = s.f[p](t); });
  v.az += 0.006 * Math.sin(t * 0.37 + 1.3) + shake * 0.01 * Math.sin(t * 53);
  v.el += 0.004 * Math.sin(t * 0.53) + shake * 0.008 * Math.sin(t * 61 + 1);
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * (1 + 0.004 * Math.sin(t * 0.9));
  camera.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  camera.fov = v.fov;
  camera.setViewOffset(W, H, 0, v.oy, W, H);
  camera.updateProjectionMatrix();
  camera.lookAt(camTgt);
  camera.updateMatrixWorld();
}

/* ================= nakładki ================= */
const svg = $("svg"), ui = $("ui");
const _pv = new THREE.Vector3();
const project = (v) => { _pv.copy(v).project(camera); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; };
const place = (el, x, y) => { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px) scale(" + (1 + (1 - k) * 0.12).toFixed(3) + ")";
};
const NS = "http://www.w3.org/2000/svg";

// oś tulei dolnego wahacza i przednia ścianka tulei (tu malujemy znaczniki jak mechanik)
const AXIS_L = new THREE.Vector3().subVectors(P.lcaRear, P.lcaFront).normalize();
const FACE = P.lcaFront.clone().addScaledVector(AXIS_L, -46);
const U0 = new THREE.Vector3(0, 1, 0).addScaledVector(AXIS_L, -AXIS_L.y).normalize();
const markDir = (ang) => U0.clone().applyAxisAngle(AXIS_L, ang);
const DROOP_ANGLE = solveCorner(DROOP, 0).angleLower;

// połączenia: 4 tuleje, 2 sworznie, 2 końcówki drążka, 2 przeguby łącznika, 2 mocowania amortyzatora
const jointPts = (sol) => [
  P.lcaFront, P.lcaRear, P.ucaFront, P.ucaRear, sol.lower, sol.upper,
  sol.tieRod.a, sol.tieRod.b, sol.arbArmEndNow, sol.linkOnWishbone, P.damperTop, sol.damperLowerNow,
];
const jointEls = [];
for (let i = 0; i < 12; i++) {
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("r", "13"); c.setAttribute("fill", "none"); c.setAttribute("stroke-width", "4");
  $("joints").appendChild(c);
  jointEls.push(c);
}

// etykiety z linią
const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
const TAGS = [
  { t0: 14.30, t1: 16.6, text: "Wahacz górny", a: (s) => mid(P.ucaFront, s.upper), off: [-120, -200] },
  { t0: 14.45, t1: 16.6, text: "Wahacz dolny", a: (s) => mid(P.lcaFront, s.lower), off: [-80, 190] },
  { t0: 15.58, t1: 16.7, text: "Zwrotnica", a: (s) => s.hubInnerNow, off: [120, -160] },
  { t0: 16.76, t1: 19.45, text: "Amortyzator + sprężyna", a: (s) => mid(P.damperTop, s.damperLowerNow), off: [-170, -220] },
  { t0: 19.54, t1: 21.6, text: "Stabilizator", a: (s) => s.arbArmEndNow, off: [-160, -180] },
  { t0: 21.72, t1: 23.1, text: "Drążek kierowniczy", a: (s) => mid(s.tieRod.a, s.tieRod.b), off: [-140, 180] },
  { t0: 29.34, t1: 30.9, text: "Osłona sworznia", a: (s) => s.lower.clone().add(new THREE.Vector3(0, -20, 0)), off: [-190, -170] },
  { t0: 30.94, t1: 36.3, text: "Pęknięta", a: (s) => s.lower.clone().add(new THREE.Vector3(0, -20, 0)), off: [-190, -170], c: "hot" },
  { t0: 40.20, t1: 42.0, text: "Amortyzator", a: (s) => mid(P.damperTop, s.damperLowerNow), off: [-170, -200] },
  { t0: 55.26, t1: 59.2, text: "Tuleja wahacza", a: () => FACE, off: [-160, -230] },
  { t0: 65.22, t1: 68.0, text: "Zablokowana tutaj", a: () => FACE, off: [-170, -240], c: "hot" },
  { t0: 84.66, t1: 87.2, text: "Łącznik stabilizatora", a: (s) => mid(s.arbArmEndNow, s.linkOnWishbone), off: [-150, -220] },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + (tg.c || "");
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  tg.line = document.createElementNS(NS, "path");
  tg.line.setAttribute("fill", "none");
  tg.line.setAttribute("stroke", tg.c === "hot" ? "#e2492b" : "#f5aa3c");
  tg.line.setAttribute("stroke-width", "2.5");
  tg.dot = document.createElementNS(NS, "circle");
  tg.dot.setAttribute("r", "7");
  tg.dot.setAttribute("fill", tg.c === "hot" ? "#e2492b" : "#f5aa3c");
  $("tagLines").appendChild(tg.line);
  $("tagLines").appendChild(tg.dot);
});
function drawTags(t, sol) {
  for (const tg of TAGS) {
    if (!inR(t, tg.t0, tg.t1 + 0.18)) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    const p = project(tg.a(sol));
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(200, Math.min(y > 1000 ? 700 : 880, x));
    y = Math.max(560, Math.min(1400, y));
    place(tg.el, x, y);
    tg.el.style.opacity = ap;
    tg.line.setAttribute("d", "M " + x.toFixed(1) + " " + y.toFixed(1) + " L " + p.x.toFixed(1) + " " + p.y.toFixed(1));
    const len = Math.hypot(p.x - x, p.y - y);
    tg.line.style.strokeDasharray = len;
    tg.line.style.strokeDashoffset = len * (1 - ap);
    tg.line.setAttribute("opacity", 0.9);
    tg.dot.setAttribute("cx", p.x); tg.dot.setAttribute("cy", p.y);
    tg.dot.setAttribute("opacity", clamp01((ap - 0.6) / 0.4));
  }
}

// wykres odbić: nowy amortyzator gasi po jednym, zużyty buja kilka razy
{
  const X = (tau) => 70 + (tau / 3.4) * 780, Y = (v) => 1330 - v * 1.7;
  let a = "", b = "";
  for (let i = 0; i <= 170; i++) {
    const tau = (i / 170) * 3.4;
    a += (i ? " L " : "M ") + X(tau).toFixed(1) + " " + Y(bounce(NEW_, tau)).toFixed(1);
    b += (i ? " L " : "M ") + X(tau).toFixed(1) + " " + Y(bounce(WORN, tau)).toFixed(1);
  }
  $("bgNew").setAttribute("d", a);
  $("bgOld").setAttribute("d", b);
  $("bgOld").style.strokeDasharray = "3000";
}
// przekrój tulei: promieniste linie gumy, które się skręcają
const rubLines = [];
for (let i = 0; i < 14; i++) {
  const p = document.createElementNS(NS, "path");
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "#f5aa3c"); p.setAttribute("stroke-width", "3"); p.setAttribute("opacity", "0.8");
  $("xsRub").appendChild(p);
  rubLines.push({ p, a: (i / 14) * Math.PI * 2 });
}
function drawXS(tw) {
  const cx = 210, cy = 1300;
  rubLines.forEach(({ p, a }) => {
    const r0 = 46, r1 = 110, a1 = a + tw, am = a + tw * 0.35;
    const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
    const xm = cx + Math.cos(am) * 80, ym = cy + Math.sin(am) * 80;
    const x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
    p.setAttribute("d", "M " + x0.toFixed(1) + " " + y0.toFixed(1) + " Q " + xm.toFixed(1) + " " + ym.toFixed(1) + " " + x1.toFixed(1) + " " + y1.toFixed(1));
  });
}

/* bęben obietnicy */
const RW = ["? ? ?", "Tanie części", "Dziury", "Zła geometria", "Zła jazda", "Śruby na podnośniku"];
const RN = RW.length, RROW = 50;
const BURSTS = [[6.95, 7.9, 2 * RN], [23.2, 24.0, 2 * RN], [40.2, 41.0, 2 * RN], [61.58, 64.38, 3 * RN + 5]];
const reelRows = [...document.querySelectorAll("#reelStrip div")];
function reelPos(t) { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; }

/* górny blok sekcji */
const TOPS = [
  [6.78, "Na końcu", "Błąd <span class=\"hot\">warsztatu</span>"],
  [12.52, "Anatomia", "Przednie <em>zawieszenie</em>"],
  [14.30, "Anatomia", "Dwa <em>wahacze</em>"],
  [16.76, "Anatomia", "Amortyzator <em>+ sprężyna</em>"],
  [19.54, "Anatomia", "<em>Stabilizator</em>"],
  [21.72, "Anatomia", "<em>Drążek</em> kierowniczy"],
  [23.20, "Anatomia", "Guma <em>albo przegub</em>"],
  [25.56, "Anatomia", "Każde może <span class=\"hot\">stukać</span>"],
  [27.06, "Winowajca nr 1", "Śmiesznie <em>mały</em>"],
  [29.34, "Winowajca nr 1", "Osłona <em>sworznia</em>"],
  [30.94, "Winowajca nr 1", "<span class=\"hot\">Pęka</span>"],
  [31.94, "Winowajca nr 1", "Woda <em>i piach</em>"],
  [33.44, "Winowajca nr 1", "Pasta <span class=\"hot\">ścierna</span>"],
  [37.54, "Rada", "Przy zmianie <em>opon</em>"],
  [40.20, "Winowajca nr 2", "Zużyty <em>amortyzator</em>"],
  [46.10, "Winowajca nr 2", "Kilka odbić <span class=\"hot\">zamiast jednego</span>"],
  [47.64, "Winowajca nr 2", "Każde = <span class=\"hot\">uderzenie</span>"],
  [50.94, "Winowajca nr 2", "Wykańcza <span class=\"hot\">wszystko</span>"],
  [53.70, "Obiecany błąd", "Tuleja <em>wahacza</em>"],
  [59.26, "Obiecany błąd", "Nie <span class=\"hot\">obraca</span> się"],
  [60.39, "Obiecany błąd", "Ona się <em>skręca</em>"],
  [61.58, "Obiecany błąd", "Auto <span class=\"hot\">na podnośniku</span>"],
  [65.22, "Obiecany błąd", "Guma <em>zablokowana</em>"],
  [68.06, "Obiecany błąd", "Auto <em>na kołach</em>"],
  [71.42, "Obiecany błąd", "Skręcona <span class=\"hot\">o 9°</span>"],
  [74.70, "Obiecany błąd", "Każda dziura <span class=\"hot\">więcej</span>"],
  [76.94, "Obiecany błąd", "Pęka po <span class=\"hot\">kilku miesiącach</span>"],
  [79.30, "Jak dobrze", "Dokręcaj <em>na kołach</em>"],
  [84.66, "Jak dobrze", "Łączniki <em>tak samo</em>"],
  [87.26, "Jak dobrze", "Zapytaj <em>mechanika</em>"],
  [91.24, "Twoja kolej", "Co u ciebie <em>stuka?</em>"],
];
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const hkChips = [...document.querySelectorAll("#hkChips .hchip")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const chBoot = [...document.querySelectorAll("#chBoot .chip")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const chDamp = [...document.querySelectorAll("#chDamp .chip")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const xsLab = [...document.querySelectorAll("#xsL div")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));

/* ================= render klatki ================= */
function renderAt(t) {
  t = Math.max(0, Math.min(END, t));
  const brOn = BR.some((b) => inR(t, b[0], b[1]));

  // hook i szew pętli: plansza nad przyciemnionym B-rollem
  const hookOn = t < 6.78 || t >= 98.55;
  show($("hk"), hookOn);
  if (t < 6.78) {
    $("hkK").style.opacity = 1;
    hkWords.forEach((w) => pop(w.el, t, w.t, 0.18, 30));
    hkChips.forEach((c) => pop(c.el, t, c.t, 0.18, 30));
  } else if (hookOn) {
    hkWords.forEach((w) => { w.el.style.opacity = 0; });
    hkChips.forEach((c) => { c.el.style.opacity = 0; });
    $("hkK").style.opacity = easeOut(win(t, 98.55, 98.85));
  }

  // bęben obietnicy
  const rb = $("reelBar");
  const rOn = inR(t, 6.9, 66.2) && !brOn;
  rb.style.opacity = rOn ? (easeOut(win(t, 6.9, 7.2)) * (1 - easeIO(win(t, 65.8, 66.2)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const w0 = RW[i0 % RN], w1 = RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= 64.38;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Błąd:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    $("reelFlash").style.opacity = done ? (0.85 * Math.max(0, 1 - (t - 64.38) / 0.4)).toFixed(3) : 0;
    let bump = 0;
    for (const [, b] of BURSTS) if (t >= b && t < b + 0.25) bump = Math.sin(((t - b) / 0.25) * Math.PI) * 6;
    rb.style.transform = "translateY(" + (-bump).toFixed(1) + "px)";
  }

  // karta wyboru i seria (nad 3D i B-rollem)
  const pc = $("pickCard");
  const pOn = inR(t, 91.24, 94.95);
  pc.style.opacity = pOn ? (easeOut(win(t, 91.24, 91.55)) * (1 - easeIO(win(t, 94.6, 94.95)))).toFixed(3) : 0;
  let gA = 0, gB = 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 91.24, 91.55))) * 30).toFixed(1) + "px)";
    const ph = t - 91.6;
    const fA = t > 91.6 ? 0.5 + 0.5 * Math.sin(ph * (5 + ph * 1.5)) : 0;
    const both = easeOut(win(t, 93.86, 94.1));
    gA = Math.max(fA, both); gB = Math.max(t > 91.6 ? 1 - fA : 0, both);
    $("pkA").style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * gA).toFixed(2) + ")";
    $("pkA").style.boxShadow = "0 0 " + (34 * gA).toFixed(0) + "px rgba(245,170,60," + (0.3 * gA).toFixed(2) + ")";
    $("pkB").style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * gB).toFixed(2) + ")";
    $("pkB").style.boxShadow = "0 0 " + (34 * gB).toFixed(0) + "px rgba(245,170,60," + (0.3 * gB).toFixed(2) + ")";
    $("pickC").style.transform = "translateY(" + (t > 93.86 ? -Math.abs(Math.sin((t - 93.86) * 4)) * 8 : 0).toFixed(1) + "px)";
  }
  const sc = $("serCard");
  const sOn = inR(t, 94.95, 98.35);
  sc.style.opacity = sOn ? (easeOut(win(t, 94.95, 95.3)) * (1 - easeIO(win(t, 98.0, 98.35)))).toFixed(3) : 0;
  if (sOn) {
    sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 94.95, 95.35))) * -60).toFixed(1) + "px)";
    $("serBtn").style.transform = "scale(" + (1 + 0.08 * Math.max(0, Math.sin((t - 95.3) * 7))).toFixed(3) + ")";
  }

  const on3d = !brOn;
  canvas.style.opacity = on3d ? 1 : 0;
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  if (!on3d) return;

  /* ---- model ---- */
  const travel = travelAt(t), steer = steerAt(t);
  const sol = solveCorner(travel, steer);
  const wheelOff = inR(t, WHEEL_OFF[0], WHEEL_OFF[1]);
  G.rimGroup.visible = !wheelOff;
  susp.update(sol, spinAt(t));

  const pulse = 0.75 + 0.25 * Math.sin(t * 7);
  hArms.set(inR(t, 14.3, 16.6) ? 1.1 * pulse * win(t, 14.3, 14.6) : 0);
  hKnuckle.set(inR(t, 15.58, 16.7) ? 1.1 * pulse : 0);
  hDamper.set(inR(t, 16.76, 19.45) || inR(t, 40.2, 44.9) ? 1.0 * pulse : inR(t, 50.94, 53.6) ? 1.2 * pulse : 0, inR(t, 50.94, 53.6) ? RED : AMBER);
  hArb.set(inR(t, 19.54, 21.6) || inR(t, 84.66, 87.2) ? 1.0 * pulse : 0);
  hTie.set(inR(t, 21.72, 23.1) ? 1.1 * pulse : 0);
  const bootRed = inR(t, 30.94, 37.5);
  hBoot.set(inR(t, 29.34, 30.94) ? 1.2 * pulse : bootRed ? 1.6 * pulse : 0, bootRed ? RED : AMBER);
  hBJ.set(inR(t, 35.6, 37.5) ? 1.8 * pulse : 0, RED);

  // uderzenia przy zużytym amortyzatorze: błysk na każdym szczycie odbicia
  let hitK = 0, hits = 0;
  if (inR(t, 46.1, 50.9)) {
    const tau = t - 46.1, per = 1 / (2 * WORN.f);
    hits = Math.min(5, Math.floor(tau / per));
    const d = tau - hits * per;
    hitK = hits >= 1 ? Math.exp(-d * 9) : 0;
  }
  // skręt gumy: guma zablokowana przy dokręcaniu; na podnośniku albo na kołach
  const lock = t < 65.22 ? sol.angleLower : t < 79.3 ? DROOP_ANGLE : 0;
  const twist = (sol.angleLower - lock) * R2D;
  const twK = inR(t, 65.22, 90) ? clamp01(Math.abs(twist) / 14) : 0;
  hBushL.mats.forEach((m, i) => { m.color.copy(bushBase[i]).lerp(new THREE.Color(0x8a1a10), twK * 0.8); });
  const bushHi = Math.max(inR(t, 55.26, 61.5) ? 1.0 * pulse : 0, twK * 1.4, hitK * 2.2, gB * 1.6);
  hBushL.set(bushHi, twK > 0.25 || hitK > 0 ? RED : AMBER);
  hBushU.set(hitK * 2.2, RED);
  if (hitK > 0) hBoot.set(hitK * 2.2, RED);
  hLink.set(Math.max(inR(t, 84.66, 87.2) ? 1.2 * pulse : 0, gA * 1.6));

  // woda i piach
  grains.forEach((g, i) => {
    const k = win(t, 31.94 + g.delay, 33.3 + g.delay);
    g.m.visible = inR(t, 31.94, 35.6) && k > 0 && k < 1;
    if (g.m.visible) g.m.position.copy(sol.lower).add(new THREE.Vector3(0, -20, 0)).addScaledVector(g.from, 1 - easeIO(k));
  });

  const shake = inR(t, 25.56, 26.6) ? 1 - win(t, 25.56, 26.6) : inR(t, 30.94, 31.3) ? 0.6 : inR(t, 35.6, 36.2) ? 0.7 : hitK * 0.5;
  applyCam(t, shake);

  /* ---- HTML / SVG ---- */
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  show(topEl, ti >= 0);
  if (ti >= 0) {
    if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
    const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.3));
    topH.style.opacity = k;
    topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
  }
  // 12 połączeń
  const jOn = inR(t, 23.2, 27.0);
  const jp = jointPts(sol);
  jointEls.forEach((c, i) => {
    if (!jOn) { c.setAttribute("opacity", 0); return; }
    const q = project(jp[i]);
    c.setAttribute("cx", q.x.toFixed(1)); c.setAttribute("cy", q.y.toFixed(1));
    const k = easeOut(win(t, 23.3 + i * 0.1, 23.5 + i * 0.1));
    const red = t >= 25.56 + i * 0.07;
    c.setAttribute("stroke", red ? "#ff4a2a" : "#f5aa3c");
    c.setAttribute("r", (13 + (red ? 6 * Math.max(0, 1 - (t - 25.56 - i * 0.07) / 0.3) : 0)).toFixed(1));
    c.setAttribute("opacity", (k * (1 - win(t, 26.7, 27.0))).toFixed(3));
  });
  const cn = $("cnt");
  show(cn, inR(t, 23.2, 27.0));
  if (inR(t, 23.2, 27.0)) {
    pop(cn, t, 23.46, 0.25, 20);
    cn.querySelector(".v").textContent = String(Math.min(12, Math.max(1, Math.floor((t - 23.3) / 0.1) + 1)));
  }
  // pęknięcie osłony
  const crOn = inR(t, 30.94, 36.4);
  if (crOn) {
    const c0 = project(sol.lower.clone().add(new THREE.Vector3(0, -24, 0)));
    const s = 1.4, k = easeOut(win(t, 30.94, 31.2));
    const pts = [[-40, -30], [-18, -8], [-26, 6], [0, 16], [-6, 30], [20, 42]].map(([x, y]) => [c0.x + x * s * k, c0.y + y * s * k]);
    $("crack").setAttribute("d", "M " + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L "));
  }
  $("crack").setAttribute("opacity", crOn ? 1 : 0);
  show($("chBoot"), inR(t, 33.44, 36.4));
  chBoot.forEach((c) => pop(c.el, t, c.t, 0.2, 24));
  const tip = $("tip");
  show(tip, inR(t, 37.54, 40.2));
  if (inR(t, 37.54, 40.2)) pop(tip, t, 37.6, 0.3, 30);
  show($("chDamp"), inR(t, 42.1, 44.9));
  chDamp.forEach((c) => pop(c.el, t, c.t, 0.2, 24));
  // wykres odbić
  const bgOn = inR(t, 46.1, 53.7);
  $("bgraph").setAttribute("opacity", bgOn ? easeOut(win(t, 46.1, 46.4)) : 0);
  show($("bgL"), bgOn);
  if (bgOn) {
    $("bgL").style.opacity = 1;
    const tau = Math.min(3.4, t - 46.1);
    const hx = 70 + (tau / 3.4) * 780;
    $("bgHead").setAttribute("x1", hx.toFixed(1)); $("bgHead").setAttribute("x2", hx.toFixed(1));
    $("bgOld").style.strokeDashoffset = (3000 * (1 - clamp01(tau / 3.4))).toFixed(1);
  }
  const hitsOn = inR(t, 46.4, 53.7);
  show($("hits"), hitsOn);
  if (hitsOn) { $("hits").style.opacity = 1; $("hitsN").textContent = String(inR(t, 46.1, 50.9) ? hits : 5); }
  // przekrój tulei
  const xsOn = inR(t, 55.26, 61.5);
  $("xs").setAttribute("opacity", xsOn ? easeOut(win(t, 55.26, 55.6)) : 0);
  show($("xsL"), xsOn);
  if (xsOn) {
    $("xsL").style.opacity = 1;
    xsLab.forEach((c) => pop(c.el, t, c.t, 0.2, 16));
    const twx = t >= 60.39 ? 0.6 * Math.sin((t - 60.39) * 3.2) : 0;
    drawXS(twx);
  }
  // znaczniki na tulei i odczyt skrętu
  const mkOn = inR(t, 62.3, 84.6);
  $("marks").setAttribute("opacity", mkOn ? easeOut(win(t, 62.3, 62.6)) : 0);
  if (mkOn) {
    const c0 = project(FACE);
    const pa = project(FACE.clone().addScaledVector(markDir(lock), 115));
    const pb = project(FACE.clone().addScaledVector(markDir(sol.angleLower), 115));
    $("mkA").setAttribute("x1", c0.x); $("mkA").setAttribute("y1", c0.y); $("mkA").setAttribute("x2", pa.x); $("mkA").setAttribute("y2", pa.y);
    $("mkB").setAttribute("x1", c0.x); $("mkB").setAttribute("y1", c0.y); $("mkB").setAttribute("x2", pb.x); $("mkB").setAttribute("y2", pb.y);
    let d = "";
    for (let i = 0; i <= 16; i++) {
      const q = project(FACE.clone().addScaledVector(markDir(lerp(lock, sol.angleLower, i / 16)), 90));
      d += (i ? " L " : "M ") + q.x.toFixed(1) + " " + q.y.toFixed(1);
    }
    $("mkArc").setAttribute("d", d);
    $("mkArc").setAttribute("stroke", t >= 79.3 ? "#86dba1" : "#ff6a4d");
  }
  const twOn = inR(t, 65.22, 84.6);
  show($("tw"), twOn);
  if (twOn) {
    pop($("tw"), t, 65.22, 0.3, 20);
    const v = Math.abs(twist);
    $("twV").textContent = v.toFixed(0) + "°";
    $("twV").style.color = t >= 79.3 && v < 6 ? "#86dba1" : v < 3 ? "#eef2f7" : v < 8 ? "#f5aa3c" : "#ff6a4d";
    $("twK").textContent = t >= 74.7 && t < 79.3 ? "Skręt gumy na dziurze" : t >= 81.3 ? "Skręt gumy na dziurze" : "Skręt gumy na postoju";
  }
  const st = $("stamp");
  const stOn = inR(t, 62.32, 68.0) || inR(t, 79.3, 84.6);
  show(st, stOn);
  if (stOn) {
    const bad = t < 79.3;
    const txt = bad ? "Dokręcone: koło wisi" : "Dokręcone: koło na ziemi";
    if (st.textContent !== txt) st.textContent = txt;
    st.style.color = bad ? "#ff9b85" : "#86dba1";
    st.style.borderColor = bad ? "rgba(226,73,43,0.8)" : "rgba(134,219,161,0.8)";
    pop(st, t, bad ? 62.32 : 79.3, 0.25, 20);
  }
  drawTags(t, sol);

  composer.render();
}

window.__timelines = window.__timelines || {};
window.__timelines["main"] = gsap.timeline({ paused: true });
window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
