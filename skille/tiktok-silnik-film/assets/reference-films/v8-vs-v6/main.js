// V8 kontra V6: cały film sterowany czasem (hf-seek), deterministycznie.
// Dwa silniki w jednej scenie: V6 (model/src) i V8 (model/src8, 90°, wał krzyżowy).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/src/lib/materials.js";
import { buildStudioEnvironment, makeShadowFloor } from "../model/src/lib/environment.js";
import { buildEngine as build6 } from "../model/src/scene.js";
import { buildEngine as build8 } from "../model/src8/scene.js";
import * as L6 from "../model/src/lib/layout.js";
import * as L8 from "../model/src8/lib/layout.js";

const W = 1080, H = 1920, D = 91.0;
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

function ease(keys, fn = easeIO) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t < b[0]) { const h = b[0] - a[0]; return h <= 0 ? b[1] : lerp(a[1], b[1], fn((t - a[0]) / h)); }
    }
    return keys[keys.length - 1][1];
  };
}
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
// kąt wału: odcinki ze stałą prędkością (°/s), koniec domknięty do wielokrotności 720°, żeby pętla była bez szwu
function crankTrack(segs) {
  const K = [[0, 0]];
  let ca = 0, ct = 0;
  for (const [t1, w] of segs) { ca += w * (t1 - ct); ct = t1; K.push([ct, ca]); }
  const last = segs[segs.length - 1][1];
  K.push([D, Math.ceil((ca + last * (D - ct)) / 720) * 720]);
  return mono(K);
}

/* ================= ujęcia: co jest na ekranie ================= */
// 3d = scena z modelami, board = plansza graficzna, broll = wideo
const SHOTS = [
  [0, 3.45, "3d", "hook"],
  [3.45, 7.75, "board", "gPromise"],
  [7.75, 9.85, "broll"],
  [9.85, 11.72, "3d", "cut6"],
  [11.72, 13.50, "3d", "uneven6"],
  [13.50, 14.95, "broll"],
  [14.95, 17.25, "3d", "patch6"],
  [17.25, 19.20, "3d", "hero8"],
  [19.20, 20.05, "broll"],
  [20.05, 23.0, "3d", "fire8"],
  [23.0, 28.45, "3d", "banks8"],
  [28.45, 33.05, "3d", "pin8"],
  [33.05, 37.45, "board", "gGraph"],
  [37.45, 43.05, "3d", "stackPow"],
  [43.05, 44.65, "board", "gLevel"],
  [44.65, 47.8, "3d", "rock6"],
  [47.8, 50.15, "3d", "cw8"],
  [50.15, 51.5, "3d", "stackRock"],
  [51.5, 53.95, "board", "gShaft"],
  [53.95, 57.35, "3d", "coin"],
  [57.35, 61.25, "3d", "cross"],
  [61.25, 66.0, "3d", "bank8"],
  [66.0, 69.85, "board", "gBulgot"],
  [69.85, 72.8, "3d", "flat"],
  [72.8, 75.85, "board", "gKrzyk"],
  [75.85, 76.45, "board", "gUcz"],
  [76.45, 78.4, "3d", "length"],
  [78.4, 82.2, "broll"],
  [82.2, 85.3, "3d", "pick"],
  [85.3, 89.6, "3d", "rebuild"],
  [89.6, D + 1, "3d", "outro"],
];
const SPLIT = new Set(["hook", "stackPow", "stackRock", "length", "outro"]);
const splitY = (t, name) => (name === "outro" ? lerp(H, 840, easeIO(win(t, 89.75, 90.6))) : 840);
const shotAt = (t) => { for (const s of SHOTS) if (t >= s[0] && t < s[1]) return s; return SHOTS[SHOTS.length - 1]; };

const crank6 = crankTrack([[3.45, 150], [9.85, 100], [11.72, 70], [13.5, 260], [14.95, 90], [17.25, 60], [37.45, 90], [43.05, 100], [44.65, 100], [47.8, 170], [51.5, 200], [76.45, 100], [78.4, 0.01], [89.6, 90]]);
const crank8 = crankTrack([[3.45, 150], [17.25, 120], [19.2, 200], [23.0, 240], [28.45, 60], [33.05, 90], [37.45, 100], [43.05, 100], [47.8, 120], [51.5, 220], [53.95, 160], [57.35, 300], [61.25, 45], [66.0, 280], [69.85, 90], [72.8, 45], [76.45, 60], [78.4, 0.01], [82.2, 60], [85.3, 60], [89.6, 150]]);

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
  // tło jak w poprzednich odcinkach: ciemny radial i delikatna siatka 90 px
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
const key = new THREE.DirectionalLight(0xfffaf2, 2.5);
key.position.set(1400, 2100, 1600);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 300, far: 7500, left: -1500, right: 1500, top: 1500, bottom: -1500 });
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
const cameraB = new THREE.PerspectiveCamera(36, W / H, 20, 16000); // dolny panel podzielonego ekranu

/* ================= silniki ================= */
const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a);
const glowMats = (obj) => {
  const out = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.emissive = AMBER.clone();
    o.material.emissiveIntensity = 0;
    out.push(o.material);
  });
  return out;
};

function mkEngine(build, L, tag) {
  const M = createMaterials();
  for (const k of Object.keys(M)) {
    const m = M[k];
    if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3;
  }
  const engine = build(M);
  applyMaterialVariation(engine.root, M);
  engine.ring.visible = false;
  engine.charge.visible = false;
  scene.add(engine.root);
  const R = { tag, L, M, engine, root: engine.root, crank: engine.rotating.crank, flywheel: engine.rotating.flywheel };
  const crank = R.crank;

  // czopy korbowodowe i przeciwwagi: własne materiały, żeby świecić pojedynczo
  R.journals = {};
  R.cws = [];
  crank.traverse((o) => {
    if (!o.isMesh) return;
    const m = /^Crank_RodJournal_Cyl(\d)$/.exec(o.name);
    if (m) {
      o.material = M.steel.clone(); o.material.emissive = AMBER.clone(); o.material.emissiveIntensity = 0;
      R.journals[m[1]] = { mesh: o, base: o.position.clone(), mat: o.material };
    }
    const c = /^Crank_Counterweight_(\d)([ab])$/.exec(o.name);
    if (c) {
      o.material = M.crankSteel.clone(); o.material.emissive = AMBER.clone(); o.material.emissiveIntensity = 0;
      o.material.transparent = true;
      R.cws.push({ mesh: o, pin: +c[1] - 1, rz: o.rotation.z, mat: o.material });
    }
  });

  // błyski zapłonu i świecenie suwu pracy w każdym cylindrze
  R.flashes = L.CYLINDERS.map((c) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(52, 24, 16), mat);
    const d = L.BANK_DIR[c.bank];
    const s = L.LAYOUT.deckHeight - 24;
    m.position.set(d.x * s, d.y * s, c.z);
    m.scale.set(1, 0.7, 1);
    m.visible = false;
    engine.root.add(m);
    return { c, m, mat };
  });
  R.pow = L.CYLINDERS.map((c) => {
    const d = L.BANK_DIR[c.bank];
    const axis = new THREE.Vector3(d.x, d.y, 0).normalize();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 1, 32), mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    m.visible = false;
    engine.root.add(m);
    return { c, m, mat, axis };
  });

  // jednostki do rozkładania (E), rozrzucania (S) i odsuwania lewego rzędu (LO)
  engine.root.updateMatrixWorld(true);
  const pistonsRoot = engine.rotating.root.getObjectByName("PISTONS_AND_RODS");
  const partRoots = new Set([engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root, engine.rotating.root, pistonsRoot]);
  const units = [], seen = new Set();
  const bankL = new Set([
    ...engine.rotating.cylinders.filter((c) => c.def.bank === "L").map((c) => c.wrap),
    engine.heads.heads.L.wrap,
    engine.heads.root.getObjectByName("CAM_COVER_L"),
    engine.headers.root.getObjectByName("HEADER_L"),
  ].filter(Boolean));
  const center = new THREE.Vector3(0, 150, 0);
  const addUnit = (o) => {
    if (!o || seen.has(o) || o === pistonsRoot) return;
    seen.add(o);
    const box = new THREE.Box3().setFromObject(o);
    const cw = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const dir = cw.clone().sub(center);
    if (dir.lengthSq() < 1) dir.set(0, 1, 0);
    dir.normalize(); dir.y += 0.25; dir.normalize();
    const qInv = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const i = units.length + (tag === "8" ? 50 : 0);
    units.push({
      o, base: o.position.clone(),
      d: o.userData.explode ? o.userData.explode.clone() : null,
      top: partRoots.has(o.parent) || o === engine.intake.root,
      sdir: dir.applyQuaternion(qInv),
      smag: 2400 + hash(i) * 1200,
      kS: hash(i + 17), kE: 0,
      ldir: bankL.has(o) ? new THREE.Vector3(L.BANK_DIR.L.x, L.BANK_DIR.L.y, 0).applyQuaternion(qInv) : null,
      isCrank: o === crank, isFly: o === R.flywheel,
      // osprzęt, który zasłania cylindry: chowamy go w ujęciach z zapłonami
      core: /^HEADER_|^CAM_COVER_|^TIMING_COVER$/.test(o.name) || o.parent === engine.accessories.root || o === engine.intake.root || o === engine.rotating.timing,
      cap: o.name === "MAIN_BEARING_CAPS",
      y: cw.y,
    });
  };
  engine.explodeGroups.forEach(addUnit);
  [engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root].forEach((r) => r.children.slice().forEach(addUnit));
  addUnit(engine.intake.root);
  engine.rotating.root.children.slice().forEach((c) => { if (c !== crank && c !== pistonsRoot) addUnit(c); });
  pistonsRoot.children.slice().forEach(addUnit);
  const ys = units.map((u) => u.y), yMin = Math.min(...ys), yMax = Math.max(...ys);
  units.forEach((u) => { u.kE = 1 - (u.y - yMin) / (yMax - yMin + 1e-6); });
  R.units = units;
  R.rearFlange = crank.getObjectByName("CrankRearFlange");
  R.nose = ["CrankSprocket", "CrankSprocketBolt", "CrankSnout"].map((n) => crank.getObjectByName(n)).filter(Boolean);
  R.cyl = (id) => engine.rotating.cylinders.find((c) => c.def.id === id);
  return R;
}

const E6 = mkEngine(build6, L6, "6");
const E8 = mkEngine(build8, L8, "8");
const stag = (x, k, spread = 0.55) => easeIO(clamp01(x * (1 + spread) - k * spread));

// V6: czop dzielony (cylindry 1 i 2 na czopie z = 108) i błysk cięcia
const PIN6 = 108;
const cylA6 = L6.CYLINDERS.find((c) => c.id === 1), cylB6 = L6.CYLINDERS.find((c) => c.id === 2);
const cutMat = new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const cutDisc = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3, 40), cutMat);
cutDisc.rotation.x = Math.PI / 2;
E6.crank.add(cutDisc);

// V8: wał krzyżowy -> płaski. Czopy 1..4 (od przodu): 0°, 90°, 270°, 180° -> 0°, 180°, 180°, 360°
const PINS8 = L8.Z_SLOTS.map((z, p) => {
  const cyls = L8.CYLINDERS.filter((c) => c.z === z);
  return { z, J: cyls[0].journalAngle, ids: cyls.map((c) => String(c.id)), dA: [0, 90, -90, 180][p] };
});
// korbowody pierwszego czopu świecą w ujęciu makro
const rodGlow8 = [...glowMats(E8.cyl(1).rod), ...glowMats(E8.cyl(2).rod)];
const KEEP8 = new Set([E8.cyl(1).wrap, E8.cyl(2).wrap]);

// moneta na kolektorze dolotowym V8 (test stojącej monety na wolnych obrotach)
const coin = new THREE.Mesh(
  new THREE.CylinderGeometry(12, 12, 2.4, 48),
  new THREE.MeshStandardMaterial({ color: 0xd9b35c, metalness: 1, roughness: 0.26, envMapIntensity: 1.6 })
);
coin.castShadow = true;
// moneta stoi na krawędzi, ustawiona pod kątem do kamery, żeby było widać, że stoi
coin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(0.3), 0, Math.sin(0.3)));
{
  E8.root.updateMatrixWorld(true);
  const plen = E8.engine.intake.root.getObjectByName("IntakePlenum");
  const b = new THREE.Box3().setFromObject(plen || E8.engine.intake.root);
  coin.position.set(0, b.max.y + 12, 30);
  E8.engine.intake.root.add(coin);
  E8.engine.intake.root.worldToLocal(coin.position);
}
coin.visible = false;
const COIN_Y = (() => { E8.root.updateMatrixWorld(true); return coin.getWorldPosition(new THREE.Vector3()).y; })();

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260923;
  const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const orig = Math.random;
  Math.random = seeded;
  const ssao = new SSAOPass(scene, camera, W, H);
  Math.random = orig;
  Object.assign(ssao, { kernelRadius: 190, minDistance: 40, maxDistance: 1400 });
  composer.addPass(ssao);
  ssaoPass = ssao;
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.7, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.3 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv - 0.5) * vec2(1.0, 0.8); float v = smoothstep(0.95, 0.25, length(p) * 1.35); c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }",
}));
composer.setSize(W, H);
// SSAO czyta macierz projekcji tylko przy starcie; kadry zmieniają fov i przesunięcie, więc odświeżamy ją co render
function usePassCam(cam) {
  renderPass.camera = cam;
  ssaoPass.camera = cam;
  ssaoPass.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);
  ssaoPass.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);
}

/* ================= kamera ================= */
// az, el w radianach, r w mm, cel x y z, fov, oy = przesunięcie kadru (px, dodatnie podnosi obraz)
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const FRONT = Math.PI / 2, REAR = -Math.PI / 2;
// podzielony ekran: górny panel do y = 840 (V8), dolny od 840 (V6); oy ustawia środek silnika w panelu
const OYA = 400, OYB = -120;
const P0A = P(0.70, 0.17, 5300, 0, 90, 0, 32, OYA);
const P0B = P(0.92, 0.17, 5300, 0, 90, 0, 32, OYB);
const CAM = {
  hookA: [[0, P0A], [3.45, P(0.92, 0.13, 4700, 0, 90, 0, 32, OYA)]],
  hookB: [[0, P0B], [3.45, P(0.70, 0.13, 4700, 0, 90, 0, 32, OYB)]],
  cut6: [[9.85, P(0.20, 0.32, 1100, 40, 0, 60, 36, 60)], [11.72, P(0.42, 0.26, 960, 40, 0, 60, 36, 60)]],
  uneven6: [[11.72, P(REAR - 0.06, 0.06, 1950, 0, 150, 0, 40, 150)], [13.5, P(REAR + 0.02, 0.05, 1780, 0, 150, 0, 40, 150)]],
  patch6: [[14.95, P(0.62, 0.42, 1050, 40, 0, 60, 36, 40)], [17.25, P(0.40, 0.30, 920, 40, 0, 60, 36, 40)]],
  hero8: [[17.25, P(1.0, -0.02, 3100, 0, 120, 0, 34, 10)], [19.2, P(0.72, 0.10, 2300, 0, 120, 0, 34, 10)]],
  fire8: [[20.05, P(-0.38, 0.64, 2750, 0, 110, 0, 34, 170)], [23.0, P(-0.12, 0.58, 2550, 0, 110, 0, 34, 170)]],
  banks8: [[23.0, P(REAR - 0.1, 0.06, 2800, 0, 150, 0, 34, 20)], [26.1, P(REAR, 0.05, 2600, 0, 150, 0, 34, 20)], [28.45, P(REAR + 0.04, 0.05, 2550, 0, 150, 0, 34, 20)]],
  pin8: [[28.45, P(0.55, 0.16, 1250, 0, 110, 110, 36, 40)], [30.5, P(0.85, 0.22, 1100, 0, 110, 110, 36, 40)], [33.05, P(1.1, 0.26, 1050, 0, 110, 110, 36, 40)]],
  stackPowA: [[37.45, P(0.40, 0.42, 4300, -230, 130, 0, 32, OYA)], [43.05, P(0.60, 0.38, 4100, -230, 130, 0, 32, OYA)]],
  stackPowB: [[37.45, P(0.40, 0.42, 4300, -230, 130, 0, 32, OYB)], [43.05, P(0.60, 0.38, 4100, -230, 130, 0, 32, OYB)]],
  rock6: [[44.65, P(1.15, 0.46, 2400, 0, 170, 0, 34, 150)], [46.4, P(0.4, 0.2, 2300, 40, 170, 0, 34, 150)], [47.8, P(0.1, 0.15, 2250, 40, 170, 0, 34, 150)]],
  cw8: [[47.8, P(0.78, 0.40, 1500, 0, 0, 0, 34, 60)], [50.15, P(0.48, 0.24, 1350, 0, 0, 0, 34, 60)]],
  stackRockA: [[50.15, P(0.18, 0.16, 3900, 0, 150, 0, 32, OYA)], [51.5, P(0.10, 0.15, 3700, 0, 150, 0, 32, OYA)]],
  stackRockB: [[50.15, P(0.18, 0.16, 3900, 0, 150, 0, 32, OYB)], [51.5, P(0.10, 0.15, 3700, 0, 150, 0, 32, OYB)]],
  coin: [[53.95, P(1.10, 0.10, 760, 0, COIN_Y, 30, 30, 60)], [57.35, P(0.86, 0.05, 560, 0, COIN_Y, 30, 30, 60)]],
  cross: [[57.35, P(FRONT - 0.55, 0.28, 1900, 0, 80, 0, 36, 60)], [58.55, P(FRONT - 0.04, 0.02, 1250, 0, 0, 0, 30, -40)], [61.25, P(FRONT, 0.0, 1150, 0, 0, 0, 30, -40)]],
  bank8: [[61.25, P(0.20, 0.62, 2800, 0, 110, 0, 34, 250)], [66.0, P(0.40, 0.56, 2650, 0, 110, 0, 34, 250)]],
  flat: [[69.85, P(FRONT + 0.2, 0.18, 1250, 0, 0, 0, 30, 260)], [70.9, P(FRONT, 0.02, 1180, 0, 0, 0, 30, 260)], [72.8, P(FRONT - 0.06, 0.04, 1160, 0, 0, 0, 30, 260)]],
  lengthA: [[76.45, P(0.0, 0.06, 4500, 0, 180, 0, 30, OYA - 60)], [78.4, P(0.02, 0.07, 4300, 0, 180, 0, 30, OYA - 60)]],
  lengthB: [[76.45, P(0.0, 0.06, 4500, 0, 180, 0, 30, OYB - 40)], [78.4, P(0.02, 0.07, 4300, 0, 180, 0, 30, OYB - 40)]],
  pick: [[82.2, P(FRONT - 0.12, 0.08, 1250, 0, 0, 0, 30, 300)], [85.3, P(FRONT + 0.08, 0.05, 1180, 0, 0, 0, 30, 300)]],
  rebuild: [[85.3, P(FRONT - 0.1, 0.12, 1500, 0, 40, 0, 32, 300)], [86.8, P(1.2, 0.22, 2700, 0, 110, 0, 34, 170)], [89.6, P(0.92, 0.2, 3100, 0, 120, 0, 34, 150)]],
  outroA: [[89.6, P(0.92, 0.2, 3100, 0, 120, 0, 34, 150)], [90.7, P0A], [D + 1, P0A]],
  outroB: [[89.6, P(0.92, 0.17, 5300, 0, 90, 0, 32, OYB - 1100)], [90.6, P0B], [D + 1, P0B]],
};
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, shk, cam = camera) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  const jit = clamp01(t / 1.0) * clamp01((D - t) / 1.0);
  const br = 1 + jit * 0.004 * Math.sin(t * 0.9);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  if (shk > 0) { v.az += shk * 0.012 * Math.sin(t * 47); v.el += shk * 0.009 * Math.sin(t * 59 + 1); }
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * br;
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silników w danym ujęciu ================= */
const blank = () => ({ vis: false, pos: [0, 0, 0], e: 0, s: 0, lo: 0, g: 0, core: 0, fly: 0, keep: null, pinOnly: -1, cwGhost: 0, powBank: null, rock: 0, shake: 0, fl: 0, spl: 1, gap: 0, cut: 0, pin: 0, pinCol: AMBER, cw: 0, rod: 0, fire: null, unev: 0, pow: 0, coin: false, hum: 0 });
const hookE = (t) => 0.62 * easeOut(clamp01(t / 1.7));

function states(t, name) {
  const a = blank(), b = blank(); // a = V6, b = V8
  let floorOn = true, shk = 0;
  switch (name) {
    case "hook":
      Object.assign(a, { vis: true, e: hookE(t - 0.14) });
      Object.assign(b, { vis: true, e: hookE(t) });
      a.pin = easeOut(win(t, 2.66, 2.85)) * (0.75 + 0.25 * Math.sin(t * 14)); a.pinCol = RED;
      floorOn = false;
      break;
    case "cut6":
      Object.assign(a, { vis: true, g: 1, pin: 1, s: 1 });
      a.spl = easeIO(win(t, 10.05, 10.9));
      a.gap = ease([[0, 0], [9.98, 0], [10.2, 1], [10.9, 1], [11.5, 0.25]])(t);
      a.cut = ease([[0, 0], [9.94, 0], [10.0, 1], [10.7, 0]])(t);
      break;
    case "uneven6":
      Object.assign(a, { vis: true, g: 1, fire: "uneven", fly: 1, core: 1 });
      a.spl = 1 - easeIO(win(t, 11.77, 12.3));
      a.unev = easeIO(win(t, 12.16, 12.95));
      a.shake = easeIO(win(t, 13.0, 13.45));
      a.pin = 0.5;
      break;
    case "patch6":
      Object.assign(a, { vis: true, g: 1, spl: 1, gap: 0.25, s: 1 });
      a.pin = 0.7 + 0.3 * Math.sin(t * 6);
      shk = t > 16.06 && t < 16.4 ? 1 - win(t, 16.06, 16.4) : 0;
      break;
    case "hero8":
      Object.assign(b, { vis: true, e: 1 - easeIO(win(t, 17.3, 18.55)) });
      break;
    case "fire8":
      Object.assign(b, { vis: true, g: 1, fire: "all", core: 1, pow: 1 });
      break;
    case "banks8":
      Object.assign(b, { vis: true, g: 1, fly: 1, core: 1 });
      break;
    case "pin8":
      // zostaje sam wał i dwa korbowody pierwszego czopu
      Object.assign(b, { vis: true, g: 1, s: 1, keep: KEEP8, pinOnly: 0 });
      b.rod = easeOut(win(t, 28.7, 29.0)) * (0.4 + 0.1 * Math.sin(t * 6));
      b.pin = easeOut(win(t, 29.9, 30.2));
      b.pinCol = t >= 31.17 ? GREEN : AMBER;
      break;
    case "stackPow":
      Object.assign(a, { vis: true, g: 1, pow: 1, core: 1 });
      Object.assign(b, { vis: true, g: 1, pow: 1, core: 1 });
      floorOn = false;
      break;
    case "rock6":
      Object.assign(a, { vis: true, g: 1, core: 1 });
      a.lo = easeIO(win(t, 44.72, 45.5));
      a.rock = easeIO(win(t, 46.5, 47.2));
      break;
    case "cw8":
      Object.assign(b, { vis: true, g: 1, s: 1 });
      b.cw = easeOut(win(t, 49.38, 49.7)) * (0.45 + 0.1 * Math.sin(t * 7));
      break;
    case "stackRock":
      Object.assign(a, { vis: true, g: 1, rock: 1, core: 1 });
      Object.assign(b, { vis: true, g: 1, cw: 0.4, core: 1 });
      floorOn = false;
      break;
    case "coin":
      Object.assign(b, { vis: true, coin: true, hum: 1 });
      break;
    case "cross":
      Object.assign(b, { vis: true, g: 1, s: easeIO(win(t, 57.45, 58.6)), cwGhost: easeIO(win(t, 58.3, 58.8)) });
      b.pin = easeOut(win(t, 58.6, 59.0));
      floorOn = t < 58.4;
      break;
    case "bank8":
      Object.assign(b, { vis: true, g: 1, fire: "strip", core: 1 });
      break;
    case "flat":
      Object.assign(b, { vis: true, g: 1, s: 1, pin: 1, cwGhost: 1, fl: easeIO(win(t, 69.95, 70.95)) });
      floorOn = false;
      break;
    case "length":
      Object.assign(a, { vis: true, pos: [0, 0, 54] });
      Object.assign(b, { vis: true });
      floorOn = false;
      break;
    case "pick": {
      Object.assign(b, { vis: true, g: 1, s: 1, pin: 1, cwGhost: 1 });
      b.fl = pickFlat(t);
      floorOn = false;
      break;
    }
    case "rebuild":
      Object.assign(b, { vis: true, g: 1 - easeIO(win(t, 86.5, 87.4)), s: 1 - easeIO(win(t, 85.35, 86.7)) });
      b.pin = 1 - win(t, 85.35, 85.8);
      b.cwGhost = 1 - win(t, 85.35, 85.8);
      floorOn = t > 85.9;
      break;
    case "outro":
      Object.assign(a, { vis: true });
      Object.assign(b, { vis: true });
      floorOn = false;
      break;
  }
  return { a, b, floorOn, shk };
}
// karta wyboru: wał przeskakuje krzyż <-> płaski razem z podświetloną odpowiedzią
const pickFlat = (t) => {
  const ph = (t - 82.82) / 1.3;
  if (ph < 0) return 0;
  const c = ph - Math.floor(ph);
  return easeIO(win(c, 0.35, 0.5)) * (1 - easeIO(win(c, 0.85, 1.0)));
};

/* ================= zastosowanie stanu do silnika ================= */
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const ROCK6 = new THREE.Vector3(-L6.BANK_DIR.R.y, L6.BANK_DIR.R.x, 0).normalize();
const fireOf = (c) => wrap(c.cycleOffset + 360, 720);
const UNEVEN6 = [0, 60, 240, 300, 480, 540];

function poseEngine(R, st, deg, t) {
  R.root.visible = st.vis;
  if (!st.vis) return;
  R.engine.updateCrank(deg);
  for (const u of R.units) {
    _p.copy(u.base);
    let vis = true;
    if (u.d && st.e > 0) _p.addScaledVector(u.d, stag(st.e, u.kE) * (u.cap ? 2.2 : 1));
    if (u.top && !u.isCrank && st.s > 0 && !(st.keep && st.keep.has(u.o))) {
      const k = stag(st.s, u.kS, 0.6);
      _p.addScaledVector(u.sdir, k * u.smag);
      if (k > 0.985) vis = false;
    }
    if (u.isFly && (st.s > 0 || st.fly > 0)) {
      const k = Math.max(stag(st.s, u.kS, 0.6), st.fly);
      _p.z -= k * 2600;
      if (k > 0.985) vis = false;
    }
    if (u.ldir && st.lo > 0) { _p.addScaledVector(u.ldir, st.lo * 2200); if (st.lo > 0.985) vis = false; }
    if (st.core && u.core) vis = false;
    u.o.position.copy(_p);
    u.o.visible = vis;
  }
  if (R.rearFlange) R.rearFlange.visible = st.s < 0.5 && st.fly < 0.5;
  R.nose.forEach((o) => { o.visible = st.s < 0.5; });
  setCasingGhost(R.M, st.g);
  R.M.coverPlastic.opacity *= 1 - 0.9 * st.g;
  R.M.plastic.opacity *= 1 - 0.75 * st.g;
  const cm = wrap(deg, 720);

  // czopy: V6 dzielony, V8 krzyż -> płaski
  const Rr = R.L.LAYOUT.crankRadius;
  if (R.tag === "6") {
    const a6 = cylB6.journalAngle, a5 = lerp(a6, cylA6.journalAngle, st.spl);
    const j5 = R.journals["1"], j6 = R.journals["2"];
    j5.mesh.position.set(Math.cos(a5 * D2R) * Rr, Math.sin(a5 * D2R) * Rr, j5.base.z + 9 * st.gap);
    j6.mesh.position.set(Math.cos(a6 * D2R) * Rr, Math.sin(a6 * D2R) * Rr, j6.base.z - 9 * st.gap);
    cutDisc.position.set(Math.cos(a6 * D2R) * Rr, Math.sin(a6 * D2R) * Rr, PIN6);
    cutMat.opacity = st.cut * 0.7;
    cutDisc.visible = cutMat.opacity > 0.01;
    for (const id in R.journals) {
      const m = R.journals[id].mat;
      const on = id === "1" || id === "2";
      m.emissive.copy(st.pinCol);
      m.emissiveIntensity = on ? st.pin * 1.7 + st.cut * 0.8 : st.pin * 0.2;
    }
  } else {
    PINS8.forEach((pn, p) => {
      const a = (pn.J + pn.dA * st.fl) * D2R;
      for (const id of pn.ids) {
        const j = R.journals[id];
        j.mesh.position.set(Math.cos(a) * Rr, Math.sin(a) * Rr, j.base.z);
        j.mat.emissive.copy(st.pinCol);
        j.mat.emissiveIntensity = st.pinOnly < 0 || st.pinOnly === p ? st.pin * 1.6 : 0;
      }
    });
    for (const c of R.cws) c.mesh.rotation.z = c.rz + PINS8[c.pin].dA * st.fl * D2R;
    rodGlow8.forEach((m) => { m.emissiveIntensity = st.rod * 1.3; });
    coin.visible = st.coin;
  }
  for (const c of R.cws) {
    c.mat.emissiveIntensity = st.cw * 1.0;
    c.mat.opacity = st.cwGhost ? lerp(1, 0.35, st.cwGhost) : 1;
    c.mat.depthWrite = c.mat.opacity > 0.9;
  }

  // błyski zapłonu
  R.flashes.forEach((f, i) => {
    let k = 0;
    if (st.fire === "all") { const x = wrap(cm - fireOf(f.c), 720); k = x < 90 ? Math.pow(1 - x / 90, 1.6) : 0; }
    else if (st.fire === "uneven") { const fa = lerp(wrap(fireOf(f.c), 720), UNEVEN6[i], st.unev); const x = wrap(cm - fa, 720); k = x < 90 ? Math.pow(1 - x / 90, 1.6) : 0; }
    else if (st.fire === "strip" && f.c.bank === "R") k = stripFire(f.c, deg);
    f.m.visible = k > 0.01;
    f.mat.opacity = k;
    f.mat.color.setRGB(3.2 * k + 0.3, 1.2 * k + 0.1, 0.3 * k);
    f.m.scale.set(0.7 + 0.5 * k, 0.5 + 0.4 * k, 0.7 + 0.5 * k);
  });
  // suw pracy: gaz między denkiem tłoka a głowicą świeci
  let n = 0;
  R.pow.forEach((g) => {
    const ph = R.L.cycleAngle(g.c, deg);
    const on = st.pow > 0 && ph >= 360 && ph < 540 && (!st.powBank || g.c.bank === st.powBank);
    g.m.visible = on;
    if (!on) return;
    n++;
    const { s } = R.L.pistonPinDistance(g.c, deg);
    const crown = s + R.L.LAYOUT.pistonHeight / 2 - 2;
    const len = Math.max(2, R.L.LAYOUT.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.copy(g.axis).multiplyScalar(crown + len / 2);
    g.m.position.z = g.c.z;
    const f = (ph - 360) / 180;
    g.mat.opacity = 0.85 - 0.45 * f;
    g.mat.color.setRGB(1.6 - 0.5 * f, 0.55 - 0.25 * f, 0.12);
  });
  R.powCount = n;

  // kołysanie trzycylindrowca, trzęsienie przy nierównym zapłonie, szum biegu jałowego
  _q.setFromAxisAngle(R.tag === "6" ? ROCK6 : Z_AXIS, st.rock * 0.055 * Math.sin(deg * D2R));
  _q2.setFromAxisAngle(Z_AXIS, st.shake * 0.016 * (Math.sin(t * 43) + 0.6 * Math.sin(t * 71 + 2)));
  R.root.quaternion.copy(_q).multiply(_q2);
  R.root.position.set(
    st.pos[0] + st.shake * 6 * Math.sin(t * 57) + st.hum * 0.3 * Math.sin(t * 91),
    st.pos[1] + st.shake * 5 * Math.sin(t * 39 + 1) + st.hum * 0.25 * Math.sin(t * 77 + 1),
    st.pos[2]
  );
  R.root.updateMatrixWorld(true);
}

/* ================= pasek zapłonów jednego rzędu ================= */
// okno 720° zaczyna się 105° przed pierwszym zapłonem prawego rzędu
const STRIP_O = 105, SX0 = 96, SX1 = 824;
const bankR8 = L8.CYLINDERS.filter((c) => c.bank === "R").map((c) => ({ c, fa: fireOf(c) })).sort((p, q) => p.fa - q.fa);
const EVEN_T = [135, 315, 495, 675];
let stripFlat = 0;
const pulseDeg = (i) => lerp(bankR8[i].fa, EVEN_T[i], stripFlat);
const sx = (deg) => SX0 + (wrap(deg - STRIP_O, 720) / 720) * (SX1 - SX0);
function stripFire(c, deg) {
  const i = bankR8.findIndex((p) => p.c === c);
  const x = wrap(deg - pulseDeg(i), 720);
  return x < 80 ? Math.pow(1 - x / 80, 1.5) : 0;
}
const stripDots = bankR8.map(() => {
  const g = document.createElementNS(NS, "g");
  const ln = document.createElementNS(NS, "line");
  const c = document.createElementNS(NS, "circle");
  ln.setAttribute("stroke", "#f5aa3c"); ln.setAttribute("stroke-width", "6"); ln.setAttribute("stroke-linecap", "round");
  c.setAttribute("fill", "#f5aa3c");
  g.appendChild(ln); g.appendChild(c);
  $("stripP").appendChild(g);
  return { ln, c };
});
const mkPath = (parent, attrs) => { const e = document.createElementNS(NS, "path"); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
const mkText = (parent, attrs, txt) => { const e = document.createElementNS(NS, "text"); for (const k in attrs) e.setAttribute(k, attrs[k]); e.textContent = txt; parent.appendChild(e); return e; };
const brNear = mkPath($("stripBr"), { fill: "none", stroke: "#eef2f7", "stroke-width": 3 });
const brNearT = mkText($("stripBr"), { "text-anchor": "middle", style: "font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:600;fill:#eef2f7;letter-spacing:0.08em" }, "BLISKO");
const brGap = mkPath($("stripBr"), { fill: "none", stroke: "#ff6a4d", "stroke-width": 3 });
const brGapT = mkText($("stripBr"), { "text-anchor": "middle", style: "font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:600;fill:#ff6a4d;letter-spacing:0.08em" }, "PRZERWA");
const bracket = (x0, x1, y) => `M ${x0.toFixed(1)} ${y + 18} L ${x0.toFixed(1)} ${y} L ${x1.toFixed(1)} ${y} L ${x1.toFixed(1)} ${y + 18}`;

function drawStrip(t, deg, on, a0) {
  $("strip").setAttribute("opacity", on ? easeOut(win(t, a0, a0 + 0.3)) : 0);
  if (!on) return;
  stripDots.forEach((d, i) => {
    const x = sx(pulseDeg(i));
    const k = stripFire(bankR8[i].c, deg);
    d.ln.setAttribute("x1", x.toFixed(1)); d.ln.setAttribute("x2", x.toFixed(1));
    d.ln.setAttribute("y1", (1330 - 50 - 50 * k).toFixed(1)); d.ln.setAttribute("y2", "1330");
    d.c.setAttribute("cx", x.toFixed(1)); d.c.setAttribute("cy", (1330 - 58 - 50 * k).toFixed(1));
    d.c.setAttribute("r", (18 + 12 * k).toFixed(1));
    const col = k > 0.05 ? "#ffd08a" : "#f5aa3c";
    d.c.setAttribute("fill", col); d.ln.setAttribute("stroke", col);
  });
  const hx = sx(deg);
  $("stripH").setAttribute("x1", hx.toFixed(1)); $("stripH").setAttribute("x2", hx.toFixed(1));
  // nawiasy "blisko" i "przerwa" tylko przy nierównym rytmie
  const nk = inR(t, 64.18, 66.0) ? easeOut(win(t, 64.18, 64.45)) : 0;
  const x1 = sx(pulseDeg(1)), x2 = sx(pulseDeg(2));
  brNear.setAttribute("d", bracket(x1, x2, 1238)); brNear.setAttribute("opacity", nk);
  brNearT.setAttribute("x", ((x1 + x2) / 2).toFixed(1)); brNearT.setAttribute("y", "1228"); brNearT.setAttribute("opacity", nk);
  const gk = inR(t, 65.37, 66.0) ? easeOut(win(t, 65.37, 65.6)) : 0;
  const x3 = sx(pulseDeg(3));
  brGap.setAttribute("d", bracket(x3, SX1, 1238)); brGap.setAttribute("opacity", gk);
  brGapT.setAttribute("x", ((x3 + SX1) / 2).toFixed(1)); brGapT.setAttribute("y", "1228"); brGapT.setAttribute("opacity", gk);
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui");
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
let projCam = camera;
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H, z: _pv.z }; }
function arcD(frame, cx, cy, z, r, a0, a1, n = 28) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n) * D2R;
    _w.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    frame.localToWorld(_w);
    const p = project(_w);
    d += (i ? " L " : "M ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  return d;
}
function lineD(frame, a, b) {
  _w.copy(a); frame.localToWorld(_w); const p = project(_w);
  _w.copy(b); frame.localToWorld(_w); const q = project(_w);
  return "M " + p.x.toFixed(1) + " " + p.y.toFixed(1) + " L " + q.x.toFixed(1) + " " + q.y.toFixed(1);
}
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
function localPoint(frame, x, y, z) { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px) scale(" + (1 + (1 - k) * 0.12).toFixed(3) + ")";
  return k;
};
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const worldOf = (obj, local) => { const v = local ? local.clone() : new THREE.Vector3(); return obj.localToWorld(v); };
const centerLocal = (obj) => { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); return obj.worldToLocal(b.getCenter(new THREE.Vector3())); };

// etykiety z linią wiodącą
const anc = {
  headR6: centerLocal(E6.engine.heads.heads.R.wrap),
  headR8: centerLocal(E8.engine.heads.heads.R.wrap),
  rod1: centerLocal(E8.cyl(1).rod),
  rod2: centerLocal(E8.cyl(2).rod),
  cw8: centerLocal(E8.crank.getObjectByName("Crank_Counterweight_2a")),
};
const pin6W = () => { const a = E6.journals["2"].mesh.position, b = E6.journals["1"].mesh.position; return worldOf(E6.crank, new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, PIN6)); };
const pin8W = () => worldOf(E8.crank, E8.journals["1"].mesh.position.clone().setZ(162));
const TAGS = [
  { t0: 2.66, t1: 3.45, text: "Sztuczka", a: pin6W, off: [250, -170], c: "hot", cam: "B" },
  { t0: 9.91, t1: 10.52, text: "Czop wału", a: pin6W, off: [-150, -200], c: "oil" },
  { t0: 10.52, t1: 11.72, text: "Przecięty na pół", a: pin6W, off: [-120, -210], c: "hot" },
  { t0: 28.76, t1: 30.5, text: "Korbowód 1", a: () => worldOf(E8.cyl(1).rod, anc.rod1), off: [-230, -30], c: "oil" },
  { t0: 28.92, t1: 30.5, text: "Korbowód 2", a: () => worldOf(E8.cyl(2).rod, anc.rod2), off: [230, -260], c: "oil" },
  { t0: 29.9, t1: 31.17, text: "Jeden czop", a: pin8W, off: [-30, 230], c: "oil" },
  { t0: 31.17, t1: 33.05, text: "Pasuje samo", a: pin8W, off: [-30, 230], c: "ok" },
  { t0: 49.38, t1: 50.15, text: "Przeciwwagi", a: () => worldOf(E8.crank.getObjectByName("Crank_Counterweight_2a"), anc.cw8), off: [-150, -260], c: "oil" },
  { t0: 61.84, t1: 64.1, text: "Jeden rząd", a: () => worldOf(E8.engine.heads.heads.R.wrap, anc.headR8), off: [-40, -230], c: "oil" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = tg.c === "hot" ? "#e2492b" : tg.c === "ok" ? "#86dba1" : "#f5aa3c";
  tg.line = mkPath($("tagLines"), { fill: "none", stroke: col, "stroke-width": 2.5 });
  tg.dot = document.createElementNS(NS, "circle");
  tg.dot.setAttribute("r", "7"); tg.dot.setAttribute("fill", col);
  $("tagLines").appendChild(tg.dot);
});
function drawTags(t) {
  for (const tg of TAGS) {
    const on = inR(t, tg.t0, tg.t1 + 0.18) && shotAt(t) === shotAt(tg.t0);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    projCam = tg.cam === "B" && SPLIT.has(shotAt(t)[3]) ? cameraB : camera;
    const p = project(tg.a());
    projCam = camera;
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(190, Math.min(y > 1000 ? 700 : 880, x));
    y = Math.max(tg.cam === "B" ? 900 : 560, Math.min(tg.cam === "B" ? 1180 : 1400, y));
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

// krzyż z przodu wału: cztery ramiona od osi przez czopy
const crossArms = PINS8.map((pn, p) => {
  const ln = mkPath($("cross"), { fill: "none", stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" });
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("r", "26"); c.setAttribute("fill", "rgba(10,14,19,0.92)"); c.setAttribute("stroke", "#f5aa3c"); c.setAttribute("stroke-width", "4");
  $("cross").appendChild(c);
  const tx = mkText($("cross"), { "text-anchor": "middle", "dominant-baseline": "central", style: "font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;fill:#eef2f7" }, String(p + 1));
  return { ln, c, tx };
});
const crossHub = document.createElementNS(NS, "circle");
crossHub.setAttribute("r", "16"); crossHub.setAttribute("fill", "#f5aa3c");
$("cross").appendChild(crossHub);
function drawCross(t, st, on, drawAt) {
  $("cross").setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  const hub = localPoint(E8.crank, 0, 0, 0);
  crossHub.setAttribute("cx", hub.x.toFixed(1)); crossHub.setAttribute("cy", hub.y.toFixed(1));
  crossArms.forEach((arm, p) => {
    const k = easeOut(win(t, drawAt + p * 0.16, drawAt + p * 0.16 + 0.4));
    const pn = PINS8[p];
    const a = (pn.J + pn.dA * st.fl) * D2R;
    const e = localPoint(E8.crank, Math.cos(a) * 118 * k, Math.sin(a) * 118 * k, 0);
    arm.ln.setAttribute("d", `M ${hub.x.toFixed(1)} ${hub.y.toFixed(1)} L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
    arm.ln.setAttribute("opacity", k > 0.01 ? 1 : 0);
    const lab = localPoint(E8.crank, Math.cos(a) * 150, Math.sin(a) * 150, 0);
    const lk = clamp01((k - 0.7) / 0.3);
    arm.c.setAttribute("cx", lab.x.toFixed(1)); arm.c.setAttribute("cy", lab.y.toFixed(1));
    arm.tx.setAttribute("x", lab.x.toFixed(1)); arm.tx.setAttribute("y", lab.y.toFixed(1));
    arm.c.setAttribute("opacity", lk); arm.tx.setAttribute("opacity", lk);
  });
}

// tarcza zapłonu: V6 (6 znaczników) albo V8 (8 znaczników), cykl 720°
const dialTicks = Array.from({ length: 8 }, () => { const e = document.createElementNS(NS, "circle"); e.setAttribute("r", "11"); $("dialTicks").appendChild(e); return e; });
function drawDial(t, on, R, deg, unev, a0) {
  $("dial").setAttribute("opacity", on ? easeOut(win(t, a0, a0 + 0.3)) : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", (200 + Math.cos(rad) * 92).toFixed(1));
  $("dialP").setAttribute("y2", (1290 + Math.sin(rad) * 92).toFixed(1));
  dialTicks.forEach((e, i) => {
    const c = R.L.CYLINDERS[i];
    if (!c) { e.setAttribute("opacity", 0); return; }
    e.setAttribute("opacity", 1);
    const fa = R.tag === "6" ? lerp(fireOf(c), UNEVEN6[i], unev) : fireOf(c);
    const r2 = (fa / 2 - 90) * D2R;
    e.setAttribute("cx", (200 + Math.cos(r2) * 80).toFixed(1));
    e.setAttribute("cy", (1290 + Math.sin(r2) * 80).toFixed(1));
    const x = wrap(cm - fa, 720);
    const k = x < 80 ? 1 - x / 80 : 0;
    e.setAttribute("r", (10 + 7 * k).toFixed(1));
    e.setAttribute("fill", unev > 0.5 ? (k > 0 ? "#ff6a4d" : "#8a3a2c") : (k > 0 ? "#ffd08a" : "#f5aa3c"));
  });
}

/* ================= górny blok ================= */
const TOPS = [
  [9.85, "Poprzednio · V6", "Czop <em>wału</em>"],
  [10.52, "Poprzednio · V6", "Przecięty <em>na pół</em>"],
  [11.72, "Bez cięcia", "Zwykły czop?"],
  [13.0, "Bez cięcia", "Zapłony <span class=\"hot\">nierówno</span>"],
  [14.95, "Czop dzielony", "To <span class=\"ok\">sprytne</span>"],
  [15.73, "Czop dzielony", "Ale to <span class=\"hot\">łatka</span>"],
  [17.25, "V8 · 90°", "Tego <em>nie potrzebuje</em>"],
  [20.05, "Zapłony", "8 na <em>2 obroty</em> wału"],
  [21.14, "Zapłony", "Jeden co <em>90°</em>"],
  [23.08, "Rzędy", "Rozchylone o…"],
  [25.29, "Rzędy", "Rozchylone o <em>90°</em>"],
  [26.19, "Rzędy i zapłony", "Kąt = <em>odstęp</em>"],
  [28.56, "Jeden czop", "Dwa <em>korbowody</em>"],
  [29.52, "Jeden czop", "Na jednym <em>czopie</em>"],
  [30.59, "Jeden czop", "Pasuje <span class=\"ok\">samo</span>"],
  [37.45, "Suw pracy", "V8: zawsze <em>dwa naraz</em>"],
  [40.68, "Suw pracy", "V6: <span class=\"hot\">połowa czasu</span>"],
  [44.65, "Wyważenie", "Rząd V6 = <em>3 cylindry</em>"],
  [46.64, "Wyważenie", "Który się <span class=\"hot\">kołysze</span>"],
  [47.8, "V8", "Wał <em>krzyżowy</em>"],
  [49.38, "V8", "Wał i <em>przeciwwagi</em>"],
  [50.15, "Wyważenie", "Gaszą to <em>w całości</em>"],
  [53.95, "Wolne obroty", "Duże V8…"],
  [56.3, "Wolne obroty", "Tylko <em>mruczy</em>"],
  [57.35, "Obiecane", "Czemu brzmią <em>inaczej</em>?"],
  [58.56, "Obiecane", "Wał <em>z przodu</em>"],
  [60.61, "Obiecane", "Wygląda jak <em>krzyż</em>"],
  [61.25, "Wał krzyżowy", "Jeden rząd…"],
  [62.41, "Wał krzyżowy", "Zapala <span class=\"hot\">nierówno</span>"],
  [69.85, "Ferrari", "Wał <em>płaski</em>"],
  [70.88, "Ferrari", "Każdy rząd…"],
  [72.43, "Ferrari", "Zapala <span class=\"ok\">równo</span>"],
  [76.45, "Uczciwie", "V8 ma <span class=\"hot\">wady</span>"],
  [85.3, "V8", "Bez żadnych <em>sztuczek</em>"],
];
const TOP_OFF = [[0, 9.85], [37.45, 43.05], [50.15, 51.5], [76.45, 78.4], [82.2, 85.3], [89.6, D + 1]];
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

/* ================= fale dźwięku na planszach ================= */
// impulsy spalania: wał krzyżowy = grupy (90/180/270), płaski = równo co 180° w rzędzie
const BURBLE = [0, 0.25, 0.375, 0.625];
const EVEN4 = [0, 0.25, 0.5, 0.75];
function pulses(pattern, T, tt, look) {
  const out = [];
  const c0 = Math.floor((tt - look) / T) - 1, c1 = Math.floor(tt / T) + 1;
  for (let c = c0; c <= c1; c++) pattern.forEach((f, i) => { const p = (c + f) * T; if (p <= tt && p > tt - look) out.push([p, i]); });
  return out;
}
function wavePath(x0, x1, y, amp, t, o) {
  let d = "";
  const spp = o.window / (x1 - x0);
  for (let x = x0; x <= x1; x += 3) {
    const tt = t - (x1 - x) * spp;
    let v = 0;
    for (const [p, i] of pulses(o.pattern, o.T, tt, 0.4)) {
      const dt = tt - p;
      const a = o.lumpy ? (i % 2 ? 0.75 : 1.0) : 1;
      v += a * Math.exp(-dt / o.tau) * Math.sin(2 * Math.PI * o.f * dt);
    }
    d += (x === x0 ? "M " : " L ") + x.toFixed(1) + " " + (y - Math.max(-1.3, Math.min(1.3, v)) * amp).toFixed(1);
  }
  return d;
}
const W_FER = { pattern: EVEN4, T: 0.22, tau: 0.03, f: 55, window: 1.3 };
const W_MUS = { pattern: BURBLE, T: 0.5, tau: 0.075, f: 26, window: 1.3, lumpy: true };

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const buTxt = $("buTxt");
const setLetters = (el, word) => { if (el.dataset.w === word) return; el.dataset.w = word; el.innerHTML = [...word].map((ch) => `<span>${ch}</span>`).join(""); };
const lvH = $("lvH");
lvH.innerHTML = [..."WYWAŻENIE"].map((ch) => `<span>${ch}</span>`).join("");
const lvL = [...lvH.children];
// wykres suwów pracy: 8 garbów po 180° co 90°
const GX = (deg) => 90 + (deg / 720) * 740;
const GB = 1330, GA = 330;
const humpD = (off, frac = 1) => {
  let d = "", started = false;
  for (let s = 0; s <= 180 * frac + 0.01; s += 4) {
    const deg = off + s;
    const wr = deg >= 720;
    const x = GX(wr ? deg - 720 : deg), y = GB - Math.sin(s / 180 * Math.PI) * GA;
    const brk = started && wr && off + s - 4 < 720;
    d += (!started || brk ? "M " : " L ") + x.toFixed(1) + " " + y.toFixed(1);
    started = true;
  }
  return d;
};
const humps = Array.from({ length: 8 }, (_, i) => mkPath($("grHumps"), { fill: i === 7 ? "none" : "rgba(245,170,60,0.08)", stroke: "rgba(238,242,247,0.6)", "stroke-width": 3, d: humpD(i * 90) }));
{
  let sd = "";
  for (let deg = 0; deg <= 720; deg += 3) {
    let sum = 0;
    for (let i = 0; i < 8; i++) { const x = wrap(deg - i * 90, 720); if (x < 180) sum += Math.sin(x / 180 * Math.PI); }
    sd += (deg ? " L " : "M ") + GX(deg).toFixed(1) + " " + (GB - sum * GA * 0.5 - 4).toFixed(1);
  }
  $("grSum").setAttribute("d", sd);
}

function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gPromise") {
    // dwa sloty: najpierw "? ? ?", potem lądują Ferrari i Mustang
    const slot = (el, name, at) => {
      const landed = t >= at;
      const txt = landed ? name : "? ? ?";
      const nm = el.firstChild;
      if (nm.textContent !== txt) nm.textContent = txt;
      const inK = easeOut(win(t, 4.8, 5.0));
      if (!landed) { el.style.opacity = (0.35 * inK).toFixed(3); el.style.transform = "translateY(" + (Math.sin(t * 40) * 4 * inK).toFixed(1) + "px)"; return; }
      const k = backOut(win(t, at, at + 0.26));
      el.style.opacity = 1;
      el.style.transform = "translateY(" + ((1 - k) * -50).toFixed(1) + "px)";
    };
    slot($("duAn"), "Ferrari ", 5.15);
    slot($("duBn"), "Mustang ", 7.02);
    pop($("duNe"), t, 6.53, 0.2, 0);
    const wa = 0.04 + 0.96 * easeOut(win(t, 5.3, 5.6)), wb = 0.04 + 0.96 * easeOut(win(t, 7.05, 7.3));
    $("waveA").setAttribute("d", wavePath(78, 1002, 700, 90 * wa, t, W_FER));
    $("waveA").setAttribute("opacity", t > 4.8 ? 1 : 0);
    $("waveB").setAttribute("d", wavePath(78, 1002, 1290, 90 * wb, t, W_MUS));
    $("waveB").setAttribute("opacity", t > 4.8 ? 1 : 0);
    $("duQ").style.opacity = 0;
  } else if (id === "gGraph") {
    const h0 = win(t, 33.25, 34.7);
    humps[0].setAttribute("d", humpD(0, Math.max(0.02, easeIO(h0))));
    humps.forEach((h, i) => {
      if (i === 0) { h.setAttribute("opacity", h0 > 0 ? 1 : 0); return; }
      const k = easeOut(win(t, 35.55 + i * 0.13, 35.75 + i * 0.13));
      h.setAttribute("opacity", k);
      h.setAttribute("transform", "translate(0 " + ((1 - k) * 40).toFixed(1) + ")");
    });
    const b1 = easeOut(win(t, 34.02, 34.3));
    $("grBr").setAttribute("d", bracket(GX(0), GX(180), GB - GA - 60));
    $("grBr").setAttribute("opacity", b1 * (1 - win(t, 35.4, 35.6)));
    const t1 = $("grBrT"); t1.setAttribute("x", GX(90)); t1.setAttribute("y", GB - GA - 72); t1.setAttribute("text-anchor", "middle"); t1.setAttribute("opacity", b1 * (1 - win(t, 35.4, 35.6)));
    const b2 = easeOut(win(t, 36.67, 36.95));
    $("grBr2").setAttribute("d", bracket(GX(0), GX(90), GB - GA - 60));
    $("grBr2").setAttribute("opacity", b2);
    const t2 = $("grBr2T"); t2.setAttribute("x", GX(45)); t2.setAttribute("y", GB - GA - 72); t2.setAttribute("text-anchor", "middle"); t2.setAttribute("opacity", b2);
    const sk = easeOut(win(t, 36.9, 37.3));
    $("grSum").setAttribute("opacity", sk);
    const big = $("gr180");
    const second = t >= 36.67;
    const txt = second ? "90°" : "180°";
    if (big.textContent !== txt) big.textContent = txt;
    pop(big, t, second ? 36.67 : 34.02, 0.22, 30);
    const hh = second ? "Zapłon <em>co</em>" : t >= 33.15 ? "Suw pracy <em>trwa</em>" : "";
    if ($("grH").innerHTML !== hh) $("grH").innerHTML = hh;
  } else if (id === "gLevel") {
    lvL.forEach((l, i) => pop(l, t, 43.3 + i * 0.06, 0.16, 40));
    // pęcherzyk wraca na środek z lekkim przestrzeleniem
    const x = t - 43.2;
    const bx = x < 0 ? 300 : 300 * Math.exp(-x * 3.2) * Math.cos(x * 7.5);
    $("lvB").setAttribute("cx", (540 + bx).toFixed(1));
    const ok = t > 44.2;
    ["lvM1", "lvM2"].forEach((m) => $(m).setAttribute("stroke", ok ? "#86dba1" : "#b6c1cf"));
  } else if (id === "gShaft") {
    const ang = t * 14;
    [["shW1", 330], ["shW2", 750]].forEach(([mid, cx], i) => {
      const off = Math.sin(ang + i * Math.PI) * 40;
      $(mid).setAttribute("d", `M ${cx - 70} ${898 + off - 60} h 140 a 16 16 0 0 1 16 16 v 88 a 16 16 0 0 1 -16 16 h -140 a 16 16 0 0 1 -16 -16 v -88 a 16 16 0 0 1 16 -16 z`);
    });
    const x1 = easeOut(win(t, 51.73, 51.95)), x2 = easeOut(win(t, 51.9, 52.12));
    const L = 700;
    $("shX1").style.strokeDasharray = L; $("shX1").style.strokeDashoffset = L * (1 - x1);
    $("shX2").style.strokeDasharray = L; $("shX2").style.strokeDashoffset = L * (1 - x2);
    $("shG").setAttribute("opacity", t > 52.0 ? 0.45 : 1);
    pop($("shT"), t, 52.27, 0.24, 24);
  } else if (id === "gBulgot") {
    const flip = win(t, 68.3, 68.62);
    const fer = flip >= 0.5;
    setLetters(buTxt, fer ? "Ferrari" : "Bulgot");
    buTxt.classList.toggle("fer", fer);
    const ang = fer ? (1 - easeOut((flip - 0.5) * 2)) * -90 : easeIO(flip * 2) * 90;
    $("buCard").style.transform = "rotateX(" + ang.toFixed(1) + "deg)";
    $("buK").textContent = fer ? "Wał płaski · Ferrari" : "Wał krzyżowy · USA";
    const inK = easeOut(win(t, 66.08, 66.4));
    $("buWord").style.opacity = inK;
    [...buTxt.children].forEach((sp, i) => {
      if (fer) { sp.style.transform = "none"; return; }
      // litery podskakują w rytmie bulgotu: dwa blisko, przerwa
      const tt = t - 66.08 - i * 0.035;
      let y = 0;
      for (const [p] of pulses(BURBLE, 0.62, tt, 0.5)) y += Math.exp(-(tt - p) / 0.06);
      sp.style.transform = "translateY(" + (-46 * Math.min(1.4, y)).toFixed(1) + "px) scaleY(" + (1 + 0.08 * Math.min(1, y)).toFixed(3) + ")";
    });
    const sub = fer ? "robi <b>odwrotnie</b>" : "to jest ten <b>amerykański bulgot</b>";
    if ($("buSub").innerHTML !== sub) $("buSub").innerHTML = sub;
    pop($("buSub"), t, fer ? 68.67 : 66.72, 0.22, 20);
    const wk = fer ? 1 - flip : easeOut(win(t, 66.1, 66.5));
    $("waveC").setAttribute("d", wavePath(78, 1002, 1190, 110 * wk, t, W_MUS));
    $("waveC").setAttribute("opacity", fer ? 0 : 1);
  } else if (id === "gKrzyk") {
    [...$("krA").children].forEach((sp) => pop(sp, t, parseFloat(sp.dataset.t), 0.2, 20));
    $("krA").querySelector(".x").style.setProperty("--k", easeOut(win(t, 74.3, 74.6)).toFixed(3));
    const k = easeOut(win(t, 74.78, 74.98));
    const kb = $("krB");
    kb.style.opacity = k;
    const sh = t > 74.78 ? Math.max(0, 1 - (t - 74.78) / 0.8) : 0;
    kb.style.transform = "scale(" + (1.5 - 0.5 * k).toFixed(3) + ") translate(" + (sh * 10 * Math.sin(t * 90)).toFixed(1) + "px," + (sh * 6 * Math.sin(t * 70)).toFixed(1) + "px)";
    const amp = 80 + 60 * easeOut(win(t, 74.78, 75.0));
    $("waveD").setAttribute("d", wavePath(78, 1002, 1180, amp * easeOut(win(t, 72.85, 73.2)), t, W_FER));
  } else if (id === "gUcz") {
    const k = easeOut(win(t, 75.9, 76.08));
    $("ucH").style.opacity = k;
    $("ucH").style.transform = "scale(" + (1.35 - 0.35 * k).toFixed(3) + ")";
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Wydech", "Turbo", "Pojemność", "Obroty", "Tłumik"];
const RN = RW.length, RROW = 50;
const BURSTS = [[3.62, 4.7, 2 * RN], [17.35, 18.2, 2 * RN], [33.15, 33.9, 2 * RN], [43.2, 43.95, 2 * RN], [57.45, 60.61, 3 * RN + 5]];
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 3.55, 61.9);
  rb.style.opacity = rOn ? (easeOut(win(t, 3.55, 3.8)) * (1 - easeIO(win(t, 61.4, 61.9)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
    const w0 = i0 === FIN ? "Krzyż" : RW[i0 % RN], w1 = i0 + 1 === FIN ? "Krzyż" : RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= 60.61;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Odpowiedź:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    $("reelFlash").style.opacity = done ? (0.85 * Math.max(0, 1 - (t - 60.61) / 0.4)).toFixed(3) : 0;
    let bump = 0;
    for (const [, b] of BURSTS) if (t >= b && t < b + 0.25) bump = Math.sin(((t - b) / 0.25) * Math.PI) * 6;
    // bęben wchodzi duży na środek przy obietnicy i przy wypłacie, potem wraca w róg
    const bigA = easeOut(win(t, 3.55, 3.85)) * (1 - easeIO(win(t, 4.75, 5.1)));
    const bigB = easeIO(win(t, 57.35, 57.8)) * (1 - easeIO(win(t, 61.0, 61.4)));
    const big = Math.max(bigA, bigB);
    const sc = 1 + 0.75 * big;
    rb.style.transform = "translate(" + (-40 * big).toFixed(1) + "px," + (330 * bigA + 210 * bigB - bump).toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
  }
  // pytanie-wybór zaraz po "bulgot czy krzyk"
  const pc = $("pickCard");
  const pOn = inR(t, 82.26, 85.3);
  pc.style.opacity = pOn ? (easeOut(win(t, 82.26, 82.55)) * (1 - easeIO(win(t, 85.0, 85.3)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 82.26, 82.55))) * 30).toFixed(1) + "px)";
    const fl = pickFlat(t);
    const gA = t > 82.82 ? 1 - fl : 0, gB = t > 83.45 ? fl : 0;
    const on = (id, g) => {
      $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")";
      $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")";
    };
    on("pkA", gA); on("pkB", gB);
    $("pickC").style.opacity = easeOut(win(t, 84.02, 84.3));
    $("pickC").style.transform = "translateY(" + (t > 84.3 ? -Math.abs(Math.sin((t - 84.3) * 4)) * 8 : 0).toFixed(1) + "px)";
  }
  // seria i obserwuj: znika przed końcem, żeby ostatnia klatka była jak pierwsza
  const sc = $("serCard");
  const sOn = inR(t, 85.45, 88.45);
  sc.style.opacity = sOn ? (easeOut(win(t, 85.45, 85.8)) * (1 - easeIO(win(t, 88.1, 88.45)))).toFixed(3) : 0;
  if (sOn) {
    sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 85.45, 85.85))) * -60).toFixed(1) + "px)";
    $("serBtn").style.transform = "scale(" + (1 + 0.08 * Math.max(0, Math.sin((t - 85.9) * 7))).toFixed(3) + ")";
  }
  // pasek "poprzedni odcinek" na b-rollu
  const tp = $("tape");
  tp.style.opacity = inR(t, 7.75, 9.85) ? easeOut(win(t, 7.8, 8.05)) : 0;
}

/* ================= render klatki ================= */
const hkWords = [...document.querySelectorAll("#hk .w")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const eq8 = [...document.querySelectorAll("#eq8 span")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));
const chH = [...document.querySelectorAll("#chH .chip")].map((el) => ({ el, t: parseFloat(el.dataset.t) }));

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
  if (!on3d) { $("dim").style.opacity = 0; return; }

  /* ---- stan modeli ---- */
  const d6 = crank6(t), d8 = crank8(t);
  const { a, b, floorOn, shk } = states(t, name);
  stripFlat = name === "flat" ? easeIO(win(t, 71.78, 72.43)) : 0;
  poseEngine(E6, a, d6, t);
  poseEngine(E8, b, d8, t);
  floor.visible = floorOn;
  const split = SPLIT.has(name);
  if (split) { applyCam(t, name + "A", shk, camera); applyCam(t, name + "B", shk, cameraB); }
  else applyCam(t, name, shk + (name === "uneven6" ? a.shake * 0.5 : 0));

  /* ---- podzielony ekran: V8 na górze, V6 na dole ---- */
  const sy = split ? splitY(t, name) : H;
  $("split").style.opacity = split && sy < H - 2 ? 1 : 0;
  $("split").style.top = sy.toFixed(1) + "px";
  const pill = $("splitPill");
  const pillTxt = name === "hook" ? "jest lepsze od" : "kontra";
  if (pill.textContent !== pillTxt) pill.textContent = pillTxt;
  const pillK = name === "hook" ? easeOut(win(t, 0.4, 0.62)) : split && name !== "outro" ? easeOut(win(t, s0, s0 + 0.25)) : 0;
  pill.style.opacity = pillK;
  pill.style.transform = "translate(-50%,-50%) scale(" + (1.3 - 0.3 * pillK).toFixed(3) + ")";
  const plA = $("pA"), plB = $("pB");
  const plOn = split && name !== "outro" && name !== "stackPow";
  if (!plOn) { plA.style.opacity = 0; plB.style.opacity = 0; }
  else {
    pop(plA, t, name === "hook" ? 0.08 : s0, 0.2, 24);
    pop(plB, t, name === "hook" ? 1.36 : s0 + 0.1, 0.2, 24);
    const st = (el, txt, cls, at) => {
      const e = el.querySelector(".st");
      e.style.display = txt ? "inline-block" : "none";
      if (!txt) return;
      e.textContent = txt; e.className = "st " + cls;
      const k = easeOut(win(t, at, at + 0.2));
      e.style.opacity = k; e.style.transform = "scale(" + (1.3 - 0.3 * k).toFixed(3) + ")";
    };
    st(plA, name === "stackRock" ? "spokój" : "", "ok", 50.4);
    st(plB, name === "stackRock" ? "kołysze się" : "", "hot", 50.22);
  }

  /* ---- hook ---- */
  const hookOn = name === "hook";
  const loopEnd = name === "outro" && t >= 90.2;
  show($("hk"), hookOn || loopEnd);
  if (hookOn) {
    hkWords.forEach((w) => pop(w.el, t, w.t, 0.18, 30));
    $("hkK").style.opacity = 1;
    // "oszukiwać" drga jak zakłócony sygnał
    const osz = $("hkS").querySelector(".hot");
    const g = t > 2.66 ? Math.max(0, 1 - (t - 2.66) / 0.5) : 0;
    osz.style.textShadow = g > 0 ? `${(8 * g * Math.sin(t * 80)).toFixed(1)}px 0 rgba(0,220,255,0.7), ${(-8 * g * Math.sin(t * 80)).toFixed(1)}px 0 rgba(255,40,60,0.8)` : "none";
  } else if (loopEnd) {
    hkWords.forEach((w) => { w.el.style.opacity = 0; });
    $("hkK").style.opacity = easeOut(win(t, 90.2, 90.6));
  }
  drawTop(t);

  /* ---- 3D -> 2D ---- */
  // tarcza zapłonu: V6 nierówno, V8 co 90°
  const dialOn = name === "uneven6" || name === "fire8";
  drawDial(t, dialOn, name === "fire8" ? E8 : E6, name === "fire8" ? d8 : d6, a.unev, s0);
  show($("dialL"), name === "uneven6");
  if (name === "uneven6") {
    const dv = $("dialL").querySelector(".v");
    const txt = a.unev > 0.5 ? "60° / 180°" : "120°";
    if (dv.textContent !== txt) dv.textContent = txt;
    dv.classList.toggle("hot", a.unev > 0.5);
    $("dialL").querySelector(".k").textContent = a.unev > 0.5 ? "Zwykły czop" : "Zapłon co";
  }
  show($("eq8"), name === "fire8");
  eq8.forEach((c) => pop(c.el, t, c.t, 0.18, 30));
  $("eq8L").style.opacity = name === "fire8" ? easeOut(win(t, 20.3, 20.6)) : 0;

  // łuk między rzędami V8 (widok z tyłu) i równanie
  const fr = E8.root;
  const arcOn = name === "banks8";
  const zc = -270;
  const arcIn = arcOn ? easeOut(win(t, 23.72, 24.6)) : 0;
  const R0 = 90 - L8.LAYOUT.bankTilt, L0 = 90 + L8.LAYOUT.bankTilt;
  $("axR").setAttribute("d", arcOn ? lineD(fr, new THREE.Vector3(0, 0, zc), new THREE.Vector3(Math.cos(R0 * D2R) * 520, Math.sin(R0 * D2R) * 520, zc)) : "");
  $("axL").setAttribute("d", arcOn ? lineD(fr, new THREE.Vector3(0, 0, zc), new THREE.Vector3(Math.cos(L0 * D2R) * 520, Math.sin(L0 * D2R) * 520, zc)) : "");
  $("arcV").setAttribute("d", arcOn ? arcD(fr, 0, 0, zc, 300, R0, lerp(R0, L0, arcIn)) : "");
  const eqK = arcOn ? easeIO(win(t, 26.1, 26.4)) : 0;
  ["axR", "axL", "arcV"].forEach((id) => $(id).setAttribute("opacity", arcOn ? (arcOn && t > 23.1 ? easeOut(win(t, 23.1, 23.4)) : 0) * (1 - 0.7 * eqK) : 0));
  const aMid = localPoint(fr, 0, 390, zc);
  const lab = $("lab90");
  const labK = arcOn ? easeOut(win(t, 25.33, 25.5)) : 0;
  lab.style.opacity = labK * (1 - win(t, 26.19, 26.3));
  place(lab, aMid.x, aMid.y);
  lab.style.transform = "translate(-50%,-50%) scale(" + (1 + 0.4 * Math.max(0, 1 - (t - 25.33) / 0.3) * (t > 25.33 ? 1 : 0)).toFixed(3) + ")";
  $("dim").style.opacity = (eqK * 0.8).toFixed(3);
  const eqB = $("eqBig");
  eqB.style.opacity = eqK;
  if (arcOn && t > 26.1) {
    // lewe 90° przylatuje z łuku, prawe z tarczy zapłonu, "=" zatrzaskuje
    const fa = easeIO(win(t, 26.19, 26.6)), fb = easeIO(win(t, 27.24, 27.62));
    const ox = aMid.x - 70 - 190, oy = aMid.y - 760 - 155;
    $("eqA").style.transform = `translate(${((1 - fa) * ox).toFixed(1)}px,${((1 - fa) * oy).toFixed(1)}px) scale(${(0.5 + 0.5 * fa).toFixed(3)})`;
    $("eqB").style.transform = `translate(${((1 - fb) * -240).toFixed(1)}px,${((1 - fb) * 520).toFixed(1)}px) scale(${(0.5 + 0.5 * fb).toFixed(3)})`;
    $("eqB").style.opacity = fb;
    const sK = easeOut(win(t, 26.72, 26.9));
    $("eqS").style.opacity = sK;
    $("eqS").style.transform = "scale(" + (2 - sK).toFixed(3) + ")";
    const okK = easeOut(win(t, 27.84, 28.05));
    $("eqOk").style.opacity = okK;
    $("eqOk").style.transform = "translateX(-50%) scale(" + (1.3 - 0.3 * okK).toFixed(3) + ")";
    const lock = t > 27.62 ? Math.max(0, 1 - (t - 27.62) / 0.35) : 0;
    ["eqA", "eqB"].forEach((id) => { $(id).style.textShadow = lock > 0 ? `0 0 ${(50 * lock).toFixed(0)}px rgba(245,170,60,${(0.9 * lock).toFixed(2)})` : "none"; });
  }

  // liczniki tłoków w suwie pracy
  const powOn = name === "stackPow";
  const c8 = $("cnt8"), c6 = $("cnt6");
  c8.style.opacity = powOn ? easeOut(win(t, 37.57, 37.85)) : 0;
  c6.style.opacity = powOn ? easeOut(win(t, 40.68, 40.95)) : 0;
  if (powOn) {
    $("cnt8n").textContent = String(Math.max(2, Math.min(2, E8.powCount)));
    const n6 = E6.powCount;
    $("cnt6n").textContent = String(n6);
    $("cnt6n").style.color = n6 >= 2 ? "#f5aa3c" : "#ff6a4d";
    pop($("cnt8p"), t, 39.8, 0.2, 16);
    pop($("cnt6p"), t, 41.95, 0.2, 16);
  }

  // strzałki kołysania rzędu V6
  const rkOn = name === "rock6" || name === "stackRock";
  [["rockA", 190], ["rockB", -190]].forEach(([id, z], i) => {
    if (!rkOn) { $(id).setAttribute("opacity", 0); return; }
    const rk = name === "rock6" ? easeIO(win(t, 46.64, 47.1)) : 1;
    projCam = split ? cameraB : camera;
    const c = localPoint(E6.root, L6.BANK_DIR.R.x * 330, L6.BANK_DIR.R.y * 330, z);
    projCam = camera;
    const sgn = (i === 0 ? 1 : -1) * Math.sin(d6 * D2R);
    const y1 = c.y - 70, y2 = c.y + 70;
    const tip = sgn > 0 ? y1 : y2;
    const bk = sgn > 0 ? 22 : -22;
    $(id).setAttribute("d", `M ${c.x.toFixed(1)} ${y1.toFixed(1)} L ${c.x.toFixed(1)} ${y2.toFixed(1)} M ${(c.x - 18).toFixed(1)} ${(tip + bk).toFixed(1)} L ${c.x.toFixed(1)} ${tip.toFixed(1)} L ${(c.x + 18).toFixed(1)} ${(tip + bk).toFixed(1)}`);
    $(id).setAttribute("opacity", (rk * (0.5 + 0.5 * Math.abs(Math.sin(d6 * D2R)))).toFixed(3));
  });

  // obrotomierz przy monecie
  const coinOn = name === "coin";
  $("tach").style.opacity = coinOn ? easeOut(win(t, 55.16, 55.4)) : 0;
  if (coinOn) {
    const rpm = Math.round(lerp(0, 700, easeOut(win(t, 55.16, 55.7))) + (t > 55.7 ? 4 * Math.sin(t * 9) : 0));
    $("tachV").textContent = String(rpm);
  }

  // krzyż wału i pasek zapłonów
  const crossOn = (name === "cross" && t > 59.5) || name === "flat" || name === "pick";
  drawCross(t, b, crossOn, name === "cross" ? 59.56 : -1);
  const stripOn = name === "bank8" || (name === "flat" && t > 70.88);
  drawStrip(t, d8, stripOn, name === "bank8" ? 61.33 : 70.88);

  // porównanie długości z boku
  const lenOn = name === "length";
  const dk = lenOn ? easeOut(win(t, 77.85, 78.2)) : 0;
  projCam = cameraB;
  $("dim6").setAttribute("d", lenOn ? lineD(E6.root, new THREE.Vector3(0, 520, 190), new THREE.Vector3(0, 520, -190)) : "");
  projCam = camera;
  $("dim8").setAttribute("d", lenOn ? lineD(E8.root, new THREE.Vector3(0, 520, 244), new THREE.Vector3(0, 520, -136)) : "");
  $("dim6").setAttribute("opacity", lenOn ? easeOut(win(t, 76.5, 76.8)) : 0);
  $("dim8").setAttribute("opacity", lenOn ? easeOut(win(t, 76.5, 76.8)) : 0);
  $("dimX").setAttribute("d", lenOn ? lineD(E8.root, new THREE.Vector3(0, 520, -136), new THREE.Vector3(0, 520, lerp(-136, -244, dk))) : "");
  $("dimX").setAttribute("opacity", dk);
  const xl = localPoint(E8.root, 0, 600, -190);
  place($("labX"), xl.x, xl.y);
  $("labX").style.opacity = dk;
  show($("chH"), lenOn);
  chH.forEach((c) => pop(c.el, t, c.t, 0.2, 30));

  // plaster na czop V6 i stemple
  const pt = $("patch");
  const pOn = name === "patch6" && t >= 16.06;
  pt.style.opacity = pOn ? 1 : 0;
  if (pOn) {
    const q = project(pin6W());
    place(pt, q.x, q.y);
    const k = easeOut(win(t, 16.06, 16.2));
    pt.style.transform = "rotate(" + (-22 + 8 * (1 - k)).toFixed(1) + "deg) scale(" + (2.2 - 1.2 * backOut(win(t, 16.06, 16.3))).toFixed(3) + "," + (2.2 - 1.2 * k).toFixed(3) + ")";
  }
  const stamp = (id, onS, at) => {
    const el = $(id);
    if (!onS) { el.style.opacity = 0; return; }
    const k = easeOut(win(t, at, at + 0.14));
    el.style.opacity = k;
    el.style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.8 - 0.8 * k).toFixed(3) + ")";
  };
  stamp("stLatka", name === "patch6" && t >= 16.38, 16.38);
  place($("stLatka"), 540, 1290);
  stamp("stCiecia", name === "pin8" && t >= 32.06, 32.06);
  place($("stCiecia"), 540, 1290);
  stamp("stProsty", name === "rebuild" && t >= 88.93, 88.93);
  place($("stProsty"), 540, 1300);

  drawTags(t);
  if (!split) { usePassCam(camera); composer.render(); return; }
  const v6 = E6.root.visible, v8 = E8.root.visible;
  renderer.setScissorTest(true);
  E6.root.visible = false; E8.root.visible = v8;
  usePassCam(camera);
  renderer.setScissor(0, H - sy, W, sy);
  composer.render();
  if (sy < H - 1) {
    E6.root.visible = v6; E8.root.visible = false;
    usePassCam(cameraB);
    renderer.setScissor(0, 0, W, H - sy);
    composer.render();
  }
  renderer.setScissorTest(false);
  E6.root.visible = v6; E8.root.visible = v8;
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E6, E8, camera, scene, renderer, composer, SHOTS };
