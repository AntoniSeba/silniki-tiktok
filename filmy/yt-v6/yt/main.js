// Długi film o V6 (YouTube, 16:9). Wszystko jest czystą funkcją czasu t.
// Czasy zdań lektora są w timeline.js (generowane przez tools/build_yt.py).
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
import { LAYOUT, CYLINDERS, BANK_DIR, cycleAngle, strokeOf, lift, pistonPinDistance } from "../model/src/lib/layout.js";
import { T, BRI, EST, D } from "./timeline.js";

const W = 1920, H = 1080, END = T.end;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const easeBack = (x) => { x = clamp01(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// widoczność z wejściem i wyjściem
const vis = (t, a, b, fi = 0.3, fo = 0.3) => (t < a || t >= b ? 0 : easeOut(win(t, a, a + fi)) * (1 - easeIO(win(t, b - fo, b))));
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
// przesunięcie w środku beatu, skalowane prawdziwą długością zdania z nagrania
const at = (b, off) => T[b] + off * (D[b] && EST[b] ? D[b] / EST[b] : 1);
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

/* ================= rozdziały ================= */
const CHAP = [
  { id: "01", ti: "Anatomia", head: "Anatomia <em>V6</em>", t: T.ch1 },
  { id: "02", ti: "Cykl pracy", head: "Cykl <em>pracy</em>", t: T.ch2 },
  { id: "03", ti: "Kąt rozwarcia", head: "Kąt <em>rozwarcia</em>", t: T.ch3 },
  { id: "04", ti: "Czop dzielony", head: "Czop <em>dzielony</em>", t: T.ch4, q: true },
  { id: "05", ti: "Wyważenie", head: "<em>Wyważenie</em>", t: T.ch5 },
  { id: "06", ti: "V6, R6 czy V8", head: "V6, R6 czy <em>V8</em>", t: T.ch6, bar: "V6/R6/V8" },
  { id: "07", ti: "Od kombi po F1", head: "Od kombi <em>po F1</em>", t: T.ch7, bar: "Wszędzie" },
];
CHAP.forEach((c, i) => { c.end = i < CHAP.length - 1 ? CHAP[i + 1].t : END; });
const chapAt = (t) => { let k = -1; CHAP.forEach((c, i) => { if (t >= c.t) k = i; }); return k; };

// pierwsza minuta: cold open, zajawki, mapa
const TEASE = [
  { t: T.co_works, n: "02", ti: "Cykl pracy" }, { t: T.co_60, n: "03", ti: "Kąt rozwarcia" }, { t: T.co_shake, n: "05", ti: "Wyważenie" },
  { t: T.co_four, n: "04", ti: "???", q: true },
];
const MAP = [T.map, T.ch1];

/* ================= kąt wału ================= */
const CK = [[0, 0]];
let ca = 0, ct = 0;
const run = (t1, w) => { ca += w * (t1 - ct); ct = t1; CK.push([ct, ca]); };
const goTo = (t1, deg) => { ct = t1; ca = deg; CK.push([ct, ca]); };
const nextCong = (x, r, mod) => { let v = Math.floor(x / mod) * mod + r; while (v < x) v += mod; return v; };
run(T.co_thanks, 40); run(T.co_works, 120); run(T.co_60, 150); run(T.co_shake, 200); run(T.co_four, 240); run(T.map, 120); run(T.ch1, 30);
run(T.a_cyl, 90); run(T.a_bottom, 40); run(T.ch2, 90);
goTo(T.c_intake, nextCong(ca + 200, 0, 720));
goTo(T.c_comp, ca + 180); goTo(T.c_spark, ca + 180); goTo(T.c_power, ca + 8); goTo(T.c_exh, ca + 172); goTo(T.c_timing, ca + 180);
goTo(T.c_camcrank, ca + 720); goTo(T.c_six, ca + 720);
run(T.c_loop, 260); run(T.ch3, 60); run(T.ch4, 90);
run(T.p_share, 200); run(T.p_uneven, 140); run(T.p_cut, 240);
goTo(at("p_cut", 1.2), nextCong(ca + 150, 300, 360)); goTo(T.p_1977, ca);
run(T.p_sub, 160); run(T.ch5, 150);
run(T.b_i3, 720); run(T.b_r6, 200); run(T.b_shaft, 150); run(T.ch6, 80); run(T.f_cut, 120);
goTo(END, nextCong(ca + 180, 0, 720));
const crankAt = mono(CK);

/* ================= tory stanu ================= */
const S = ease([[0, 1], [T.co_thanks, 1], [T.co_film, 0], [T.p_cut, 0], [at("p_cut", 1.4), 1], [T.p_sub, 1], [at("p_sub", 2.0), 0], [T.f_cut, 0], [END, 1]]);
const G = ease([
  [0, 0], [T.co_60, 0], [T.co_60, 1], [T.co_shake, 1], [T.co_shake, 0], [T.co_four, 0], [T.co_four, 1], [T.map, 1], [T.map, 0],
  [T.a_cyl, 0], [at("a_cyl", 0.8), 1], [T.a_bottom, 1], [at("a_bottom", 0.4), 0],
  [at("c_four", 1.4), 0], [at("c_four", 2.4), 1], [at("p_sub", 0.4), 1], [at("p_sub", 2.0), 0],
  [T.ch5, 0], [T.ch5 + 0.6, 1], [T.b_i3, 1], [at("b_i3", 0.5), 0], [T.b_cw, 0], [at("b_cw", 0.6), 1], [T.b_shaft, 1], [T.b_shaft, 0],
]);
const RRw = [[T.co_60, T.co_shake], [T.k_q, T.p_share], [T.p_uneven, T.p_cut]];
const LO = ease([[0, 0], [T.co_shake, 0], [T.co_shake + 0.35, 1], [T.co_four, 1], [T.co_four, 0], [at("b_i3", 0.4), 0], [at("b_i3", 1.3), 1], [at("b_cw", 4.5), 1], [at("b_cw", 5.6), 0]]);
const ROCK = ease([[0, 0], [T.co_shake + 0.3, 0], [T.co_shake + 0.6, 1], [T.co_four, 1], [T.co_four, 0], [T.w_swing - 0.3, 0], [T.w_swing + 0.5, 1], [at("b_cw", 1.0), 1], [at("b_cw", 4.0), 0]]);
const CWg = ease([[0, 0], [T.b_cw, 0], [at("b_cw", 0.5), 1], [T.b_shaft - 0.3, 1], [T.b_shaft, 0]]);
const PG = ease([
  [0, 1], [T.co_thanks + 0.4, 1], [T.co_thanks + 2.0, 0], [T.co_four, 0], [T.co_four, 1], [T.map, 1], [T.map, 0],
  [T.w_remember - 0.3, 0], [T.w_remember + 0.2, 1], [T.ch2, 1], [at("c_four", 1.0), 0],
  [T.c_loop, 0], [T.c_loop, 1], [T.ch3, 1], [T.ch3, 0],
  [T.p_share, 0], [at("p_share", 0.5), 1], [at("p_sub", 2.0), 1], [at("p_sub", 2.6), 0],
  [T.f_cut, 0], [END, 1],
]);
const SPL = ease([[0, 1], [T.p_cut, 1], [at("p_cut", 0.8), 0], [T.p_60, 0], [at("p_60", 1.4), 1], [T.p_90, 1], [at("p_90", 0.8), 0.5], [T.p_1977, 0.5], [at("p_1977", 0.8), 1]]);
const CUT = ease([[0, 0], [T.w_cutword, 0], [T.w_cutword + 0.1, 1], [T.w_cutword + 0.8, 0]]);
const GAP = ease([[0, 0], [T.w_cutword, 0], [T.w_cutword + 0.3, 1], [T.p_60, 1], [at("p_60", 0.6), 0.25], [T.p_sub, 0.25], [at("p_sub", 0.6), 0]]);
const SHK = ease([[0, 0], [at("p_uneven", 3.0), 0], [at("p_uneven", 3.6), 1], [T.p_buick, 1], [at("p_buick", 0.6), 0.45], [T.p_cut - 0.2, 0.45], [T.p_cut, 0]]);
const UNEV = ease([[0, 0], [at("p_uneven", 1.5), 0], [at("p_uneven", 2.4), 1], [T.p_cut, 1], [T.p_cut, 0]]);
const FIREw = [[T.c_six, T.c_loop], [T.p_rem, T.p_cut]];
const CYCw = [T.c_intake, T.c_camcrank];

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = buildStudioEnvironment(renderer).env;
{
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, "#1c232c"); lin.addColorStop(0.5, "#151b22"); lin.addColorStop(1, "#0a0d11");
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  const rad = g.createRadialGradient(W * 0.6, H * 0.45, 40, W * 0.6, H * 0.45, 900);
  rad.addColorStop(0, "rgba(120,150,190,0.16)"); rad.addColorStop(1, "rgba(120,150,190,0)");
  g.fillStyle = rad; g.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 90) for (let y = 0; y <= H; y += 90) {
    const dx = (x - W * 0.6) / (W * 0.5), dy = (y - H * 0.45) / (H * 0.6);
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
Object.assign(key.shadow.camera, { near: 300, far: 6500, left: -1100, right: 1100, top: 1100, bottom: -1100 });
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
const camera = new THREE.PerspectiveCamera(30, W / H, 20, 16000);

const M = createMaterials();
for (const k of Object.keys(M)) { const m = M[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const engine = buildEngine(M);
applyMaterialVariation(engine.root, M);
scene.add(engine.root);
engine.ring.visible = false;
const crank = engine.rotating.crank, flywheel = engine.rotating.flywheel;
const rearFlange = crank.getObjectByName("CrankRearFlange");

/* ---------- podświetlenia ---------- */
const AMBER = new THREE.Color(0xff8a1c);
const glowMat = (base, col) => { const m = base.clone(); m.emissive = new THREE.Color(col); m.emissiveIntensity = 0; return m; };
const pinA = glowMat(M.steel, 0xff8a1c), pinB = glowMat(M.steel, 0xff8a1c), cwMat = glowMat(M.crankSteel, 0xff8a1c);
const rodHi = glowMat(M.darkSteel, 0xff8a1c);
const valI = glowMat(M.valveSteel, 0x3f8cff), valE = glowMat(M.valveSteel, 0xff7a2a);
const chainHi = glowMat(M.chainSteel, 0xff8a1c);
const journals = {};
crank.traverse((o) => {
  if (!o.isMesh) return;
  const m = /^Crank_RodJournal_Cyl(\d)$/.exec(o.name);
  if (m) { journals[m[1]] = { mesh: o, base: o.position.clone() }; o.material = m[1] === "1" || m[1] === "2" ? pinA : pinB; }
  if (o.name.startsWith("Crank_Counterweight")) o.material = cwMat;
});
engine.rotating.cylinders.forEach((c) => { if (c.def.id <= 2) c.rod.traverse((o) => { if (o.isMesh) o.material = rodHi; }); });
engine.valvetrain.forEach((vt) => { if (vt.cylId === 1) { vt.vhead.material = vt.which === "intake" ? valI : valE; vt.stem.material = vt.vhead.material; } });
const chainMesh = engine.root.getObjectByName("Timing_Chain");
if (chainMesh) chainMesh.material = chainHi;
const cylA = CYLINDERS.find((c) => c.id === 1), cylB = CYLINDERS.find((c) => c.id === 2);
const PIN_Z = 108;
const cutMat = new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const cutDisc = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3, 40), cutMat);
cutDisc.rotation.x = Math.PI / 2;
crank.add(cutDisc);
const flashes = CYLINDERS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), mat);
  const d = BANK_DIR[c.bank], s = LAYOUT.deckHeight - 24;
  m.position.set(d.x * s, d.y * s, c.z);
  engine.root.add(m);
  return { c, m, mat };
});
// moneta na kolektorze: "stoi jak wryty"
const coin = new THREE.Mesh(new THREE.CylinderGeometry(10.75, 10.75, 2.1, 48), M.brass);
coin.rotation.z = Math.PI / 2;
coin.position.set(0, 400 + 10.75, 40);
coin.castShadow = true;
engine.intake.root.add(coin);

/* ---------- jednostki: rozrzut, etapy rozbierania, rząd L ---------- */
engine.root.updateMatrixWorld(true);
const byName = (n) => engine.root.getObjectByName(n);
const pistonsRoot = engine.rotating.root.getObjectByName("PISTONS_AND_RODS");
const center = new THREE.Vector3(0, 150, 0);
const U = new Map();
function unit(o) {
  if (!o) return null;
  if (U.has(o)) return U.get(o);
  const box = new THREE.Box3().setFromObject(o);
  const cw = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const dir = cw.clone().sub(center);
  if (dir.lengthSq() < 1) dir.set(0, 1, 0);
  dir.normalize(); dir.y += 0.25; dir.normalize();
  const qInv = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const i = U.size;
  const u = { o, base: o.position.clone(), d: o.userData.explode ? o.userData.explode.clone() : null, sdir: dir.applyQuaternion(qInv), smag: 1300 + hash(i) * 900, kS: hash(i + 17), top: false, stage: -1, seqK: 0, mul: 1.35, qInv, ldir: null };
  U.set(o, u);
  return u;
}
[engine.block.root, engine.heads.root, engine.headers.root, engine.accessories.root].forEach((r) => r.children.slice().forEach((c) => { unit(c).top = true; }));
unit(engine.intake.root).top = true;
engine.rotating.root.children.slice().forEach((c) => { if (c !== crank && c !== pistonsRoot) unit(c).top = true; });
pistonsRoot.children.slice().forEach((c) => { unit(c).top = true; });
unit(flywheel).top = true;
const fwd = new THREE.Vector3(0, 0.1, 1).normalize().multiplyScalar(420);
const STAGES = [
  { objs: [engine.intake.root, byName("ThrottleBody")], t: T.a_intake, n: "Kolektor dolotowy", s: "powietrze dla 6 cylindrów", a: engine.intake.root },
  { objs: [byName("CAM_COVER_R"), byName("CAM_COVER_L")], t: T.a_covers, n: "Pokrywy zaworów", s: "pod nimi wałki rozrządu", a: byName("CAM_COVER_R") },
  { objs: [byName("HEADER_R"), byName("HEADER_L")], t: T.a_headers, n: "Kolektory wydechowe", s: "3 w 1, po jednym na rząd", a: byName("HEADER_R") },
  { objs: [byName("SERPENTINE_DRIVE"), byName("ACCESSORY_UNITS"), byName("WaterPump"), byName("Alternator"), byName("Crank_Damper")], t: T.a_acc, n: "Osprzęt", s: "alternator, pompa wody, pasek", a: byName("Alternator") },
  { objs: [byName("TIMING_COVER")], t: T.a_timing, n: "Pokrywa rozrządu", s: "pod nią łańcuszek", a: byName("TIMING_COVER") },
  { objs: [byName("HEAD_R"), byName("HEAD_L"), byName("HEAD_BOLTS"), engine.rotating.timing], t: T.a_heads, n: "Głowice", s: "2 wałki rozrządu · 12 zaworów", a: byName("HEAD_R") },
  { objs: [byName("OIL_PAN_ASSEMBLY"), byName("OIL_FILTER")], t: T.a_bottom, n: "Miska olejowa", s: "zapas oleju pod wałem", a: byName("OIL_PAN_ASSEMBLY") },
  { objs: engine.rotating.cylinders.map((c) => c.wrap), t: Math.min(T.w_litres + 0.9, T.a_bottom - 0.2), n: "Tłoki i korbowody", s: "tłok Ø 94 mm · korbowód 148 mm", a: engine.rotating.cylinders[0].piston, seq: true, mul: 0.95 },
  { objs: [byName("MAIN_BEARING_CAPS")], t: T.w_caps, n: "Pokrywy łożysk", s: "4 łożyska główne trzymają wał", a: byName("MAIN_BEARING_CAPS"), mul: 2.6 },
  { objs: [crank, flywheel], t: T.a_crank, n: "Wał korbowy", s: "skok 85 mm · i jeden sekret", a: crank },
];
STAGES.forEach((st, si) => st.objs.forEach((o, k) => {
  const u = unit(o);
  if (!u) return;
  u.stage = si;
  u.seqK = st.seq ? k : 0;
  if (st.mul) u.mul = st.mul;
  if (!u.d) u.d = fwd.clone().applyQuaternion(u.qInv);
}));
const STAGE_ORDER = STAGES.map((s, i) => i).sort((a, b) => STAGES[a].t - STAGES[b].t);
// rząd L (trzycylindrowiec w rozdziale 5)
[byName("HEAD_L"), byName("HEADER_L"), ...engine.rotating.cylinders.filter((c) => c.def.bank === "L").map((c) => c.wrap)].forEach((o) => {
  const u = unit(o);
  if (u) u.ldir = new THREE.Vector3(BANK_DIR.L.x, BANK_DIR.L.y, 0).applyQuaternion(u.qInv);
});
const units = [...U.values()];
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
// ponowne złożenie na starcie rozdziału 2: odwrotna kolejność
const stageK = (t, si, seqK) => {
  const st = STAGES[si];
  const t0 = st.t + seqK * 0.32;
  const rise = easeBack(win(t, t0, t0 + 0.95));
  const ord = STAGE_ORDER.length - 1 - STAGE_ORDER.indexOf(si);
  const f0 = T.c_four - 0.1 + ord * 0.16 + seqK * 0.04;
  const fall = easeIO(win(t, f0, f0 + 0.85));
  return rise * (1 - fall);
};

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
  Object.assign(ssao, { kernelRadius: 190, minDistance: 40, maxDistance: 1400 });
  composer.addPass(ssao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.2, 0.7, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.32 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv - 0.5) * vec2(1.0, 0.75); float v = smoothstep(0.85, 0.2, length(p) * 1.3); c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }",
}));
composer.setSize(W, H);

/* ================= kamera ================= */
const P = (az, el, r, x, y, z, fov, ox) => ({ az, el, r, x, y, z, fov, ox });
const REAR = -Math.PI / 2, FRONT = Math.PI / 2;
const V = {
  hero: P(0.72, 0.2, 2000, 0, 180, 0, 32, -330),
  frontX: P(1.52, 0.08, 1000, 80, 150, PIN_Z, 32, -200),
  front: P(FRONT, 0.08, 2300, 0, 170, 0, 30, -260),
  rear: P(REAR, 0.1, 1850, 0, 175, 0, 30, -260),
  side: P(0.12, 0.14, 2050, 40, 170, 0, 30, -260),
  pin: P(1.18, 0.22, 470, 0, 0, PIN_Z, 34, -160),
  axial: P(FRONT, 0.02, 760, 0, 10, PIN_Z, 32, -300),
  high: P(0.95, 0.35, 2450, 0, 180, 0, 30, -300),
};
const mod = (v, o) => Object.assign({}, v, o);
const s0 = STAGES.map((s) => s.t);
const CAM = [
  { t: 0, k: [[0, V.pin], [T.co_thanks, mod(V.pin, { az: 1.3, el: 0.18, r: 420 })], [T.co_thanks + 1.4, P(1.05, 0.2, 1100, 0, 60, 60, 34, -220)], [T.co_film, mod(V.hero, { r: 2000 })], [T.co_works, mod(V.hero, { az: 0.62, el: 0.22, r: 1900 })]] },
  { t: T.co_works, k: [[T.co_works, V.frontX], [T.co_60, V.frontX]] },
  { t: T.co_60, k: [[T.co_60, V.rear], [T.co_shake, mod(V.rear, { r: 1620 })]] },
  { t: T.co_shake, k: [[T.co_shake, V.side], [T.co_four, mod(V.side, { az: -0.05, r: 1880 })]] },
  { t: T.co_four, k: [[T.co_four, mod(V.pin, { az: 1.25, el: 0.25, r: 560, ox: -60 })], [T.map, mod(V.pin, { az: 1.15, el: 0.2, r: 470, ox: -60 })]] },
  // rozdział 1: kamera odjeżdża razem z rosnącym rozkładem
  { t: T.ch1, k: [[T.ch1, P(-2.25, 0.3, 2500, 0, 200, 0, 30, -260)], [T.a_intake, P(-2.3, 0.3, 2700, 0, 330, 0, 30, -260)], [T.a_covers, P(-1.95, 0.4, 2700, 0, 380, 0, 30, -260)], [T.a_headers - 0.01, P(-1.85, 0.42, 2750, 0, 380, 0, 30, -260)]] },
  { t: T.a_headers, k: [[T.a_headers, P(0.28, 0.06, 2600, 250, 180, 0, 30, -260)], [T.a_acc, P(0.8, 0.14, 2900, 60, 180, 200, 30, -260)], [T.a_timing, P(1.35, 0.16, 3000, 0, 200, 300, 30, -260)], [at("a_timing", 6), P(1.45, 0.12, 2200, 0, 220, 200, 30, -260)], [T.a_heads - 0.01, P(1.5, 0.12, 2150, 0, 220, 200, 30, -260)]] },
  { t: T.a_heads, k: [[T.a_heads, P(1.8, 0.36, 3200, 0, 380, 0, 30, -260)], [at("a_heads", 3.5), P(FRONT, 0.12, 2600, 0, 200, 0, 30, -260)], [T.a_cyl - 0.01, P(FRONT + 0.05, 0.14, 2450, 0, 200, 0, 30, -260)]] },
  { t: T.a_cyl, k: [[T.a_cyl, P(1.3, 0.12, 1250, 80, 150, PIN_Z, 30, -260)], [at("a_cyl", 8.2), P(1.42, 0.1, 1100, 80, 150, PIN_Z, 30, -260)], [T.a_bottom - 0.01, P(1.2, 0.2, 2600, 0, 300, 0, 30, -260)]] },
  { t: T.a_bottom, k: [[T.a_bottom, P(-0.55, -0.05, 3000, 0, -250, 0, 30, -260)], [T.a_crank - 0.01, P(-1.3, 0.02, 2900, 0, -250, 0, 30, -260)]] },
  { t: T.a_crank, k: [[T.a_crank, P(-2.35, 0.08, 2300, 0, -250, -100, 30, -260)], [at("a_crank", 4), P(-2.2, 0.18, 3500, 0, 0, 0, 30, -260)], [T.ch2, P(-2.0, 0.28, 4700, 0, 150, 0, 30, -300)]] },
  // rozdział 2: cykl na cylindrze 1
  { t: T.c_four, k: [[T.c_four, P(1.2, 0.22, 3000, 0, 180, 0, 30, -260)], [at("c_four", 2.6), mod(V.frontX, { r: 1150 })], [T.c_timing, mod(V.frontX, { az: 1.46, r: 1000 })]] },
  { t: T.c_timing, k: [[T.c_timing, P(1.7, 0.1, 950, 60, 160, PIN_Z, 30, -120)], [T.c_camcrank, P(1.62, 0.12, 900, 60, 160, PIN_Z, 30, -120)]] },
  { t: T.c_camcrank, k: [[T.c_camcrank, P(1.1, 0.25, 1500, 60, 200, 60, 30, -120)], [T.c_six, P(1.0, 0.25, 1450, 60, 200, 60, 30, -120)]] },
  { t: T.c_six, k: [[T.c_six, mod(V.high, { ox: -120 })], [T.c_loop, mod(V.high, { az: 0.75, ox: -120 })]] },
  { t: T.c_loop, k: [[T.c_loop, mod(V.pin, { az: 1.25, el: 0.25, r: 560, ox: -120 })], [T.ch3, mod(V.pin, { az: 1.1, el: 0.2, r: 480, ox: -120 })]] },
  // rozdział 3: widok z tyłu na kąt V
  { t: T.ch3, k: [[T.ch3, V.rear], [T.k_60, mod(V.rear, { r: 1750 })], [T.k_90, mod(V.rear, { r: 1600 })]] },
  // rozdział 4
  { t: T.p_rem, k: [[T.p_rem, mod(V.rear, { r: 2000 })], [T.p_share, mod(V.rear, { r: 1800 })]] },
  { t: T.p_share, k: [[T.p_share, P(1.35, 0.12, 1300, 0, 60, PIN_Z, 30, -260)], [T.p_uneven, P(1.5, 0.1, 1150, 0, 60, PIN_Z, 30, -260)]] },
  { t: T.p_uneven, k: [[T.p_uneven, P(-1.66, 0.05, 1900, 0, 150, 0, 32, -300)], [T.p_cut, P(-1.58, 0.04, 1700, 0, 140, 0, 32, -300)]] },
  { t: T.p_cut, k: [[T.p_cut, P(1.2, 0.22, 2350, 0, 160, 0, 30, -260)], [at("p_cut", 1.4), P(1.3, 0.18, 1050, 0, 20, 80, 32, -260)], [at("p_cut", 2.4), mod(V.pin, { az: 1.12, ox: -300 })], [T.p_60 - 0.2, mod(V.pin, { az: 1.26, r: 520, ox: -300 })], [at("p_60", 0.6), V.axial], [T.p_1977, mod(V.axial, { r: 720 })]] },
  { t: T.p_1977, k: [[T.p_1977, mod(V.pin, { az: 1.0, el: 0.3, r: 620, ox: -300 })], [T.p_hero, mod(V.pin, { az: 1.3, el: 0.2, r: 560, ox: -300 })], [T.p_sub, mod(V.pin, { az: 1.7, el: 0.28, r: 600, ox: -260 })], [at("p_sub", 2.4), V.hero], [T.ch5, mod(V.hero, { az: 0.6 })]] },
  // rozdział 5
  { t: T.ch5, k: [[T.ch5, P(0.2, 0.1, 1300, 100, 180, 60, 30, -260)], [T.b_i3, P(0.1, 0.1, 1200, 100, 180, 60, 30, -260)]] },
  { t: T.b_i3, k: [[T.b_i3, P(1.0, 0.4, 2300, 0, 170, 0, 30, -260)], [at("b_i3", 3.2), P(0.08, 0.14, 2250, 40, 170, 0, 30, -260)], [T.b_r6, P(0.0, 0.12, 2200, 40, 170, 0, 30, -260)]] },
  { t: T.b_cw, k: [[T.b_cw, P(-0.2, 0.2, 1850, 0, 90, 0, 30, -260)], [T.b_shaft, P(-0.3, 0.2, 1750, 0, 90, 0, 30, -260)]] },
  { t: T.w_coin - 0.2, k: [[T.w_coin - 0.2, P(0.9, 0.12, 380, 0, 410, 40, 30, -200)], [T.b_ok, P(0.75, 0.1, 340, 0, 410, 40, 30, -200)], [at("b_ok", 1.2), V.hero], [T.ch6, mod(V.hero, { az: 0.9 })]] },
  // rozdział 6 i 7: bohater silnika pod listą aut i pytaniem
  { t: T.v_cta, k: [[T.v_cta, mod(V.hero, { az: 1.1, el: 0.25 })], [T.ch7, mod(V.hero, { az: 0.9, el: 0.2 })]] },
  { t: T.ch7, k: [[T.ch7, P(-0.9, 0.0, 2000, 0, 210, 0, 34, -330)], [T.f_idea, P(-0.4, 0.06, 1950, 0, 210, 0, 34, -330)], [T.f_cut, P(0.5, 0.15, 2100, 0, 200, 0, 32, -300)], [at("f_cut", 1.2), P(1.05, 0.2, 1100, 0, 60, 60, 34, -220)], [END, V.pin]] },
];
CAM.sort((a, b) => a.t - b.t);
const PK = ["az", "el", "r", "x", "y", "z", "fov", "ox"];
CAM.forEach((s) => { s.f = {}; PK.forEach((p) => { s.f[p] = mono(s.k.map((k) => [k[0], k[1][p]])); }); });
const PUNCH = [...TEASE.map((x) => x.t), ...CHAP.map((c) => c.t), ...s0, T.w_cutword, T.c_power, T.p_60, T.b_cw].sort((a, b) => a - b);
const camTgt = new THREE.Vector3();
function applyCam(t, shk) {
  let s = CAM[0];
  for (const c of CAM) if (t >= c.t) s = c;
  const v = {};
  PK.forEach((p) => { v[p] = s.f[p](t); });
  const jit = clamp01(t / 1.0) * clamp01((END - t) / 1.0);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  if (shk > 0) { v.az += shk * 0.01 * Math.sin(t * 47); v.el += shk * 0.007 * Math.sin(t * 59 + 1); }
  camTgt.set(v.x, v.y, v.z);
  const r = v.r * (1 + jit * 0.004 * Math.sin(t * 0.9));
  camera.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  let punch = 0;
  for (const tk of PUNCH) { const d = t - tk; if (d >= 0 && d < 1) punch += 3.2 * Math.exp(-d * 6); }
  camera.fov = v.fov - punch;
  camera.setViewOffset(W, H, v.ox, 0, W, H);
  camera.updateProjectionMatrix();
  camera.lookAt(camTgt);
  camera.updateMatrixWorld();
}

/* ================= rzutowanie i drobne helpery DOM ================= */
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(camera); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
function lp(frame, x, y, z) { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); }
function arcD(frame, r, a0, a1, z, cx = 0, cy = 0, n = 28) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n) * D2R;
    const p = lp(frame, cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    d += (i ? " L " : "M ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  return d;
}
const seg2 = (p, q) => "M " + p.x.toFixed(1) + " " + p.y.toFixed(1) + " L " + q.x.toFixed(1) + " " + q.y.toFixed(1);
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
function setOp(el, v) { const s = v <= 0.001 ? "0" : v.toFixed(3); if (el.style.opacity !== s) el.style.opacity = s; }
function setHTML(el, h) { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px)";
  return k;
};
const mk = (parent, tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

/* ================= etykiety na modelu ================= */
const anchorLocal = new Map();
function anchorW(o) {
  if (!anchorLocal.has(o)) { const b = new THREE.Box3().setFromObject(o); anchorLocal.set(o, o.worldToLocal(b.getCenter(new THREE.Vector3()))); }
  const v = anchorLocal.get(o).clone();
  o.localToWorld(v);
  return v;
}
engine.root.updateMatrixWorld(true);
STAGES.forEach((st) => anchorW(st.a));
const pinWorld = () => { const a = journals["2"].mesh.position, b = journals["1"].mesh.position; const v = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, PIN_Z); crank.localToWorld(v); return v; };
const localW = (frame, x, y, z) => { const v = new THREE.Vector3(x, y, z); frame.localToWorld(v); return v; };
const vt1 = (which) => engine.valvetrain.find((v) => v.cylId === 1 && v.which === which);
const TAGS = [];
STAGE_ORDER.forEach((si, i) => {
  const st = STAGES[si];
  let nx = i < STAGE_ORDER.length - 1 ? STAGES[STAGE_ORDER[i + 1]].t : at("a_crank", 5.4);
  if (st.t === T.a_timing) nx = at("a_timing", 2.7);
  TAGS.push({ t0: st.t + 0.45, t1: nx - 0.05, n: st.n, s: st.s, a: () => anchorW(st.a) });
});
TAGS.push(
  { t0: at("a_timing", 2.8), t1: T.a_heads, n: "Łańcuszek", s: "zwykle na cały żywot silnika", a: () => (chainMesh ? anchorW(chainMesh) : localW(engine.root, 0, 140, 214)) },
  { t0: T.w_valley + 1.2, t1: T.a_cyl, n: "Dolina V", s: "tu siedzi kolektor dolotowy", a: () => localW(engine.root, 0, 190, 180) },
  { t0: T.w_remember, t1: T.ch2, n: "Zapamiętaj go", s: "najciekawsza część filmu", a: pinWorld, hot: true },
  { t0: at("c_intake", 1.0), t1: T.c_comp, n: "Zawór dolotowy", s: "otwarty", a: () => anchorW(vt1("intake").vhead) },
  { t0: at("c_exh", 0.4), t1: T.c_timing, n: "Zawór wydechowy", s: "otwarty", a: () => anchorW(vt1("exhaust").vhead) },
  { t0: at("p_share", 0.8), t1: T.p_uneven, n: "1 czop · 2 korbowody", s: "lewy i prawy rząd", a: pinWorld },
  { t0: T.w_cutword + 0.2, t1: T.p_60, n: "Przecięty na pół", s: "dwie połówki czopu", a: pinWorld, hot: true },
  { t0: T.w_moment, t1: T.b_r6, n: "Moment kołyszący", s: "jak huśtawka", a: () => anchorW(byName("HEAD_R")), hot: true },
  { t0: at("b_cw", 0.6), t1: T.b_shaft, n: "Przeciwwagi", s: "gaszą kołysanie", a: () => anchorW(crank.getObjectByName("Crank_Counterweight_2a") || crank) },
);
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag" + (tg.hot ? " hot" : "");
  tg.el.innerHTML = '<div class="t">' + tg.n + '</div><div class="s">' + tg.s + "</div>";
  $("tags").appendChild(tg.el);
  tg.line = mk($("tagLines"), "path", { fill: "none", stroke: tg.hot ? "#e2492b" : "#f5aa3c", "stroke-width": "2.5", opacity: 0 });
  tg.dot = mk($("tagLines"), "circle", { r: 8, fill: tg.hot ? "#e2492b" : "#f5aa3c", opacity: 0 });
});
function drawTags(t, hidden) {
  for (const tg of TAGS) {
    const on = !hidden && inR(t, tg.t0, tg.t1 + 0.2);
    if (!on) { setOp(tg.el, 0); tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.2));
    const p = project(tg.a());
    const tx = Math.max(330, Math.min(1640, p.x + (p.x > 1250 ? -360 : 360)));
    const ty = Math.max(260, Math.min(880, p.y - 170));
    place(tg.el, tx, ty);
    setOp(tg.el, ap);
    tg.line.setAttribute("d", seg2({ x: tx, y: ty }, p));
    const len = Math.hypot(p.x - tx, p.y - ty);
    tg.line.style.strokeDasharray = len;
    tg.line.style.strokeDashoffset = len * (1 - ap);
    tg.line.setAttribute("opacity", ap);
    tg.dot.setAttribute("cx", p.x.toFixed(1)); tg.dot.setAttribute("cy", p.y.toFixed(1));
    tg.dot.setAttribute("opacity", clamp01((ap - 0.6) / 0.4));
  }
}

/* ================= plansze ================= */
// --- mapa rozdziałów i pasek rozdziałów
CHAP.forEach((c) => {
  const card = document.createElement("div");
  card.className = "card" + (c.q ? " q" : "");
  card.innerHTML = c.q ? '<div class="b"><span>?</span><div class="tm2">' + fmt(c.t) + "</div></div>" : '<div class="b"><span>' + c.id + '</span></div><div class="f"><div class="n">' + c.id + '</div><div class="ti">' + c.ti + '</div><div class="tm">' + fmt(c.t) + "</div></div>";
  $("cards").appendChild(card);
  c.card = card;
  const segEl = document.createElement("div");
  segEl.style.flex = String(c.end - c.t);
  if (c.q) segEl.className = "q";
  segEl.appendChild(document.createElement("i"));
  $("cbRow").appendChild(segEl);
  c.seg = segEl;
  const lab = document.createElement("span");
  lab.style.flex = String(c.end - c.t);
  // na pasku krótka nazwa, gdy rozdział jest za wąski na pełną
  lab.textContent = c.id + " " + (c.q ? "???" : c.bar || c.ti);
  $("cbL").appendChild(lab);
  c.lab = lab;
});
$("tlEnd").textContent = fmt(END);
$("tiM").textContent = Math.round(END / 60) + " minut · 7 rozdziałów · 1 sekret";
$("tzHint").textContent = "odkrywamy w " + fmt(T.ch4);

// --- kąty 60/90/120
const ang = { svg: $("angArt"), items: [] };
[60, 90, 120].forEach((deg, i) => {
  const cx = [440, 960, 1480][i], cy = 800;
  const g0 = mk(ang.svg, "g", {});
  const g = mk(g0, "g", { transform: "translate(" + cx + " " + cy + ") scale(0.7) translate(" + -cx + " " + -cy + ")" });
  const banks = [-1, 1].map((sgn) => {
    const bg = mk(g, "g", { transform: "rotate(" + (sgn * deg / 2) + " " + cx + " " + cy + ")" });
    mk(bg, "rect", { x: cx - 58, y: cy - 300, width: 116, height: 262, rx: 10, fill: "rgba(150,165,182,0.12)", stroke: "#b6c1cf", "stroke-width": 3 });
    mk(bg, "rect", { x: cx - 78, y: cy - 372, width: 156, height: 72, rx: 10, fill: "rgba(150,165,182,0.2)", stroke: "#b6c1cf", "stroke-width": 3 });
    mk(bg, "line", { x1: cx, y1: cy, x2: cx, y2: cy - 330, stroke: "#f5aa3c", "stroke-width": 2, "stroke-dasharray": "10 8" });
    return bg;
  });
  mk(g, "circle", { cx, cy, r: 40, fill: "#232b36", stroke: "#b6c1cf", "stroke-width": 3 });
  const a0 = -90 - deg / 2, a1 = -90 + deg / 2, R = 150;
  const arc = mk(g, "path", { d: "M " + (cx + Math.cos(a0 * D2R) * R) + " " + (cy + Math.sin(a0 * D2R) * R) + " A " + R + " " + R + " 0 0 1 " + (cx + Math.cos(a1 * D2R) * R) + " " + (cy + Math.sin(a1 * D2R) * R), fill: "none", stroke: "#f5aa3c", "stroke-width": 5 });
  const lab = mk(g, "text", { x: cx, y: cy - 175, "text-anchor": "middle", class: "big" }); lab.textContent = deg + "°";
  const desc = mk(g, "text", { x: cx, y: cy + 90, "text-anchor": "middle" });
  desc.textContent = ["wąski, wysoki", "niższy, szerszy", "płaski, szeroki"][i];
  const turbos = mk(g, "g", { opacity: 0 });
  if (deg === 120) {
    [-1, 1].forEach((sgn) => mk(turbos, "circle", { cx: cx + sgn * 62, cy: cy - 150, r: 42, fill: "rgba(255,106,40,0.55)", stroke: "#ff8a3c", "stroke-width": 4 }));
    const tl = mk(turbos, "text", { x: cx, y: cy - 222, "text-anchor": "middle" }); tl.textContent = "TURBO";
  }
  const mark = mk(g, "g", { opacity: 0 });
  mk(mark, "circle", { cx, cy: cy + 150, r: 34, fill: deg === 120 ? "#2c5a3c" : "#5a2620", stroke: deg === 120 ? "#86dba1" : "#e2492b", "stroke-width": 4 });
  const mt = mk(mark, "text", { x: cx, y: cy + 160, "text-anchor": "middle", class: "lab" }); mt.textContent = deg === 120 ? "OK" : "!";
  const note = mk(g, "text", { x: cx, y: cy + 130, "text-anchor": "middle", opacity: 0 });
  note.textContent = ["", "Buick · Mercedes · Audi", "Ferrari 296 · McLaren Artura"][i];
  ang.items.push({ deg, g: g0, turbos, mark, note, arc });
});
{
  // V8 minus dwa cylindry
  const g = mk(ang.svg, "g", { opacity: 0 });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    const c = mk(g, "rect", { x: 1180 + i * 92 + r * 46, y: 200 + r * 86, width: 74, height: 70, rx: 8, fill: "rgba(150,165,182,0.12)", stroke: "#b6c1cf", "stroke-width": 3 });
    if (i === 3) c.setAttribute("data-cut", "1");
  }
  const lab = mk(g, "text", { x: 1180, y: 390, class: "lab" }); lab.textContent = "V8 - 2 cylindry = V6";
  ang.v8 = g;
  ang.v8cut = [...g.querySelectorAll('[data-cut="1"]')];
  const f1 = mk(ang.svg, "text", { x: 960, y: 1000, "text-anchor": "middle", opacity: 0 });
  f1.textContent = "FORMUŁA 1: 90° Z PRZEPISÓW";
  ang.f1 = f1;
}
function drawAng(t) {
  const beat = t < T.k_120 ? 90 : t < T.k_catch ? 120 : 0;
  const hs = beat === 90 ? "90°: <em>z silnika V8</em>" : beat === 120 ? "120°: <em>gorące V</em>" : "Dwa kąty mają <span class=\"hot\">haczyk</span>";
  setHTML($("angH"), hs);
  ang.items.forEach((it, i) => {
    const appear = easeOut(win(t, T.k_90 + i * 0.25, T.k_90 + i * 0.25 + 0.4));
    const active = beat === 0 ? 1 : it.deg === beat ? 1 : it.deg === 60 ? 0.35 : 0.35;
    it.g.setAttribute("opacity", (appear * active).toFixed(3));
    const tk = it.deg === 120 ? easeOut(win(t, at("k_120", 3.0), at("k_120", 3.6))) : 0;
    it.turbos.setAttribute("opacity", (tk * (0.75 + 0.25 * Math.sin(t * 6))).toFixed(3));
    it.turbos.setAttribute("transform", "translate(0 " + ((1 - tk) * -60).toFixed(1) + ")");
    it.mark.setAttribute("opacity", easeOut(win(t, at("k_catch", 0.6) + i * 0.3, at("k_catch", 1.0) + i * 0.3)).toFixed(3));
    const nt = it.deg === 90 ? win(t, at("k_90", 8), at("k_90", 8.4)) * (t < T.k_120 ? 1 : 0) : it.deg === 120 ? win(t, at("k_120", 8), at("k_120", 8.4)) * (t < T.k_catch ? 1 : 0) : 0;
    it.note.setAttribute("opacity", nt.toFixed(3));
  });
  const v8k = t < T.k_120 ? easeOut(win(t, at("k_90", 3.4), at("k_90", 3.8))) : 0;
  ang.v8.setAttribute("opacity", v8k.toFixed(3));
  const cut = easeOut(win(t, at("k_90", 4.6), at("k_90", 5.0)));
  ang.v8cut.forEach((c) => { c.setAttribute("stroke", cut > 0.5 ? "#e2492b" : "#b6c1cf"); c.setAttribute("fill", "rgba(226,73,43," + (0.3 * cut).toFixed(2) + ")"); c.setAttribute("opacity", (1 - 0.6 * cut).toFixed(2)); });
  ang.f1.setAttribute("opacity", (t >= T.k_120 && t < T.k_catch ? easeOut(win(t, at("k_120", 11.5), at("k_120", 11.9))) : 0).toFixed(3));
}

// --- rzędowa szóstka jak lustro
const r6 = { svg: $("r6Art"), pistons: [] };
{
  const g = r6.svg;
  mk(g, "rect", { x: 420, y: 430, width: 1080, height: 300, rx: 16, fill: "rgba(150,165,182,0.08)", stroke: "#b6c1cf", "stroke-width": 3 });
  const THROW = [0, 240, 120, 120, 240, 0];
  for (let i = 0; i < 6; i++) {
    const x = 470 + i * 170;
    mk(g, "rect", { x, y: 450, width: 130, height: 260, rx: 6, fill: "rgba(6,8,11,0.5)", stroke: "rgba(150,165,182,0.4)", "stroke-width": 2 });
    const p = mk(g, "rect", { x: x + 8, y: 560, width: 114, height: 70, rx: 6, fill: i < 3 ? "#f5aa3c" : "#6ab4ff" });
    r6.pistons.push({ p, th: THROW[i] });
    const n = mk(g, "text", { x: x + 65, y: 775, "text-anchor": "middle" }); n.textContent = String(i + 1);
  }
  mk(g, "path", { d: "M 470 800 L 940 800", stroke: "#f5aa3c", "stroke-width": 4 });
  mk(g, "path", { d: "M 980 800 L 1450 800", stroke: "#6ab4ff", "stroke-width": 4 });
  const a = mk(g, "text", { x: 705, y: 845, "text-anchor": "middle" }); a.textContent = "PRZÓD: 3 CYLINDRY";
  const b = mk(g, "text", { x: 1215, y: 845, "text-anchor": "middle" }); b.textContent = "TYŁ: LUSTRZANE ODBICIE";
  r6.arrA = mk(g, "path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 6, "stroke-linecap": "round", opacity: 0 });
  r6.arrB = mk(g, "path", { fill: "none", stroke: "#6ab4ff", "stroke-width": 6, "stroke-linecap": "round", opacity: 0 });
  r6.zero = mk(g, "text", { x: 960, y: 395, "text-anchor": "middle", class: "big", opacity: 0 }); r6.zero.textContent = "= 0";
  r6.bmw = mk(g, "text", { x: 1500, y: 395, "text-anchor": "end", class: "lab", opacity: 0 }); r6.bmw.textContent = "BMW";
}
function curvedArrow(cx, cy, r, a0, a1) {
  const p0 = { x: cx + Math.cos(a0 * D2R) * r, y: cy + Math.sin(a0 * D2R) * r }, p1 = { x: cx + Math.cos(a1 * D2R) * r, y: cy + Math.sin(a1 * D2R) * r };
  const sweep = a1 > a0 ? 1 : 0;
  const dir = a1 > a0 ? 1 : -1;
  const tA = (a1 - dir * 14) * D2R;
  const h1 = { x: cx + Math.cos(tA) * (r - 16), y: cy + Math.sin(tA) * (r - 16) }, h2 = { x: cx + Math.cos(tA) * (r + 16), y: cy + Math.sin(tA) * (r + 16) };
  return "M " + p0.x.toFixed(1) + " " + p0.y.toFixed(1) + " A " + r + " " + r + " 0 0 " + sweep + " " + p1.x.toFixed(1) + " " + p1.y.toFixed(1) + " M " + h1.x.toFixed(1) + " " + h1.y.toFixed(1) + " L " + p1.x.toFixed(1) + " " + p1.y.toFixed(1) + " L " + h2.x.toFixed(1) + " " + h2.y.toFixed(1);
}
function drawR6(t) {
  const th = (t - T.b_r6) * 300;
  r6.pistons.forEach((p) => { p.p.setAttribute("y", (560 - 70 * Math.cos((th + p.th) * D2R)).toFixed(1)); });
  const ak = easeOut(win(t, at("b_r6", 2.5), at("b_r6", 3.0)));
  const sw = 18 * Math.sin(th * D2R);
  r6.arrA.setAttribute("d", curvedArrow(705, 590, 250, -150 + sw, -30 + sw));
  r6.arrB.setAttribute("d", curvedArrow(1215, 590, 250, -30 - sw, -150 - sw));
  r6.arrA.setAttribute("opacity", ak); r6.arrB.setAttribute("opacity", ak);
  r6.zero.setAttribute("opacity", easeOut(win(t, at("b_r6", 4.5), at("b_r6", 4.9))).toFixed(3));
  r6.bmw.setAttribute("opacity", easeOut(win(t, at("b_r6", 7.0), at("b_r6", 7.4))).toFixed(3));
}

// --- wałek wyważający
const sh = { svg: $("shaftArt") };
{
  const g = sh.svg;
  mk(g, "circle", { cx: 700, cy: 600, r: 170, fill: "rgba(150,165,182,0.08)", stroke: "#b6c1cf", "stroke-width": 3 });
  mk(g, "circle", { cx: 1220, cy: 600, r: 120, fill: "rgba(150,165,182,0.08)", stroke: "#6ab4ff", "stroke-width": 3 });
  sh.wA = mk(g, "circle", { r: 34, fill: "#f5aa3c" });
  sh.wB = mk(g, "circle", { r: 28, fill: "#6ab4ff" });
  sh.fA = mk(g, "line", { stroke: "#f5aa3c", "stroke-width": 5 });
  sh.fB = mk(g, "line", { stroke: "#6ab4ff", "stroke-width": 5 });
  const la = mk(g, "text", { x: 700, y: 830, "text-anchor": "middle" }); la.textContent = "WAŁ KORBOWY";
  const lb = mk(g, "text", { x: 1220, y: 830, "text-anchor": "middle" }); lb.textContent = "WAŁEK WYWAŻAJĄCY";
  sh.merc = mk(g, "text", { x: 1500, y: 395, "text-anchor": "end", class: "lab", opacity: 0 }); sh.merc.textContent = "np. Mercedes";
  sh.rotA = mk(g, "path", { d: curvedArrow(700, 600, 215, -60, 30), fill: "none", stroke: "#f5aa3c", "stroke-width": 4 });
  sh.rotB = mk(g, "path", { d: curvedArrow(1220, 600, 160, 30, -60), fill: "none", stroke: "#6ab4ff", "stroke-width": 4 });
}
const shStamps = [...document.querySelectorAll("#slShaft .stp")];
function drawShaft(t) {
  const th = (t - T.b_shaft) * 200;
  const a = -th * D2R, b = th * D2R;
  const ax = 700 + Math.cos(a) * 130, ay = 600 + Math.sin(a) * 130;
  const bx = 1220 + Math.cos(b + Math.PI) * 88, by = 600 + Math.sin(b + Math.PI) * 88;
  sh.wA.setAttribute("cx", ax.toFixed(1)); sh.wA.setAttribute("cy", ay.toFixed(1));
  sh.wB.setAttribute("cx", bx.toFixed(1)); sh.wB.setAttribute("cy", by.toFixed(1));
  sh.fA.setAttribute("x1", 700); sh.fA.setAttribute("y1", 600); sh.fA.setAttribute("x2", ax.toFixed(1)); sh.fA.setAttribute("y2", ay.toFixed(1));
  sh.fB.setAttribute("x1", 1220); sh.fB.setAttribute("y1", 600); sh.fB.setAttribute("x2", bx.toFixed(1)); sh.fB.setAttribute("y2", by.toFixed(1));
  sh.merc.setAttribute("opacity", easeOut(win(t, T.w_merc, T.w_merc + 0.4)).toFixed(3));
  shStamps.forEach((s, i) => pop(s, t, [T.w_mocy, T.w_miejsca, T.w_pieniedzy][i], 0.2, 24));
}

// --- komora silnika (rozdział 6)
const bay = { svg: $("bayArt") };
{
  const g = bay.svg;
  mk(g, "path", { d: "M 520 960 L 520 420 Q 520 330 640 322 L 1280 322 Q 1400 330 1400 420 L 1400 960", fill: "none", stroke: "rgba(150,165,182,0.35)", "stroke-width": 3 });
  mk(g, "rect", { x: 528, y: 520, width: 58, height: 200, rx: 14, fill: "#161b22", stroke: "rgba(150,165,182,0.55)", "stroke-width": 2 });
  mk(g, "rect", { x: 1334, y: 520, width: 58, height: 200, rx: 14, fill: "#161b22", stroke: "rgba(150,165,182,0.55)", "stroke-width": 2 });
  bay.box = mk(g, "rect", { x: 610, y: 440, width: 700, height: 380, fill: "none", stroke: "rgba(150,165,182,0.45)", "stroke-dasharray": "10 10", "stroke-width": 2 });
  const lab = mk(g, "text", { x: 960, y: 860, "text-anchor": "middle" }); lab.textContent = "KOMORA SILNIKA · W POPRZEK AUTA";
  const eng = (cx, n, rows, withAcc) => {
    const grp = mk(g, "g", { opacity: 0 });
    const spacing = 86, blockW = (rows === 2 ? n + 0.5 : n) * spacing + 30, gearW = 150;
    const total = gearW + blockW + (withAcc ? 44 : 0);
    const x0 = cx - total / 2;
    mk(grp, "rect", { x: x0, y: 560, width: gearW, height: 160, rx: 10, fill: "#232b36", stroke: "rgba(150,165,182,0.6)", "stroke-width": 2 });
    const gl = mk(grp, "text", { x: x0 + gearW / 2, y: 648, "text-anchor": "middle" }); gl.textContent = "SKRZYNIA"; gl.setAttribute("style", "font-size:18px");
    const bh = rows === 2 ? 190 : 130;
    mk(grp, "rect", { x: x0 + gearW, y: 640 - bh / 2, width: blockW, height: bh, rx: 12, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 3 });
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      mk(grp, "circle", { cx: x0 + gearW + 15 + spacing / 2 + i * spacing + (rows === 2 && r === 1 ? spacing / 2 : 0), cy: rows === 2 ? (r === 0 ? 598 : 682) : 640, r: 34, fill: "#1a222c", stroke: "#f5aa3c", "stroke-width": 4 });
    }
    let acc = null;
    if (withAcc) acc = mk(grp, "rect", { x: x0 + gearW + blockW, y: 580, width: 44, height: 120, rx: 8, fill: "rgba(245,170,60,0.35)", stroke: "#f5aa3c", "stroke-width": 3 });
    return { grp, x0, total, acc, blockEnd: x0 + gearW + blockW };
  };
  bay.r6 = eng(960, 6, 1, true);
  bay.v8 = eng(960, 4, 2, false);
  bay.ovL = mk(g, "rect", { x: 560, y: 430, width: 50, height: 400, fill: "rgba(226,73,43,0.5)", opacity: 0 });
  bay.ovR = mk(g, "rect", { x: 1310, y: 430, width: 50, height: 400, fill: "rgba(226,73,43,0.5)", opacity: 0 });
  bay.volvo = mk(g, "text", { x: 960, y: 405, "text-anchor": "middle", class: "lab", opacity: 0 }); bay.volvo.textContent = "Volvo: osprzęt z przodu na tył";
}
const bayStamps = [...document.querySelectorAll("#slBay .stp")];
function drawBay(t) {
  const phase = t < T.v_volvo ? 0 : t < T.v_v8 ? 1 : 2;
  $("bayK").textContent = phase === 2 ? "A może V8" : "Rzędowa szóstka";
  setHTML($("bayH"), phase === 0 ? "Rzędowa 6 jest <span class=\"hot\">za długa</span>" : phase === 1 ? "Volvo: <em>osprzęt na tył</em>" : "V8: <em>więcej wszystkiego</em>");
  const r6in = easeOut(win(t, at("v_long", 0.2), at("v_long", 0.7)));
  const r6out = phase === 2 ? easeIO(win(t, T.v_v8, at("v_v8", 0.4))) : 0;
  bay.r6.grp.setAttribute("opacity", (r6in * (1 - r6out)).toFixed(3));
  bay.r6.grp.setAttribute("transform", "translate(0 " + ((1 - r6in) * -300 + r6out * 300).toFixed(1) + ")");
  // Volvo: pasek osprzętu przesuwa się z końca silnika na jego bok, silnik się skraca
  const mv = easeIO(win(t, T.w_volvomove, T.w_volvomove + 1.4));
  if (bay.r6.acc) {
    bay.r6.acc.setAttribute("x", (bay.r6.blockEnd - mv * 260).toFixed(1));
    bay.r6.acc.setAttribute("y", (580 - mv * 110).toFixed(1));
    bay.r6.acc.setAttribute("height", (120 - mv * 70).toFixed(1));
    bay.r6.acc.setAttribute("width", (44 + mv * 160).toFixed(1));
  }
  const over = phase === 0 ? easeOut(win(t, at("v_long", 4.5), at("v_long", 5.0))) * (0.6 + 0.4 * Math.sin((t - T.v_long) * 10) ** 2) : phase === 1 ? 1 - mv : 0;
  bay.ovL.setAttribute("opacity", over.toFixed(3)); bay.ovR.setAttribute("opacity", over.toFixed(3));
  bay.volvo.setAttribute("opacity", (phase === 1 ? easeOut(win(t, at("v_volvo", 0.3), at("v_volvo", 0.7))) : 0).toFixed(3));
  const v8in = phase === 2 ? easeOut(win(t, at("v_v8", 0.2), at("v_v8", 0.6))) : 0;
  bay.v8.grp.setAttribute("opacity", v8in.toFixed(3));
  bay.v8.grp.setAttribute("transform", "translate(0 " + ((1 - v8in) * -300).toFixed(1) + ")");
  bayStamps.forEach((s, i) => { if (phase === 2) pop(s, t, [T.w_v8moc, T.w_tarcia, T.w_masy, T.w_spalanie][i], 0.2, 24); else s.style.opacity = 0; });
}

// --- tabela porównawcza
const SCORE = { cols: ["R4", "V6", "R6", "V8"], rows: [["Długość", [4, 4, 1, 3]], ["Równa praca", [2, 4, 5, 4]], ["Masa", [5, 4, 3, 2]], ["Moc", [2, 4, 4, 5]]] };
const scoreBars = [];
{
  const box = $("score");
  const head = document.createElement("div");
  head.className = "srow head";
  head.innerHTML = "<div></div>" + SCORE.cols.map((c) => '<div class="ch' + (c === "V6" ? " v6" : "") + '">' + c + "</div>").join("");
  box.appendChild(head);
  SCORE.rows.forEach(([name, vals], ri) => {
    const row = document.createElement("div");
    row.className = "srow";
    row.innerHTML = '<div class="rk">' + name + "</div>";
    const best = Math.max(...vals);
    vals.forEach((v, ci) => {
      const bars = document.createElement("div");
      bars.className = "bars" + (SCORE.cols[ci] === "V6" ? " v6" : "");
      for (let k = 0; k < 5; k++) bars.appendChild(document.createElement("i"));
      const badge = document.createElement("b");
      badge.textContent = "1.";
      bars.appendChild(badge);
      row.appendChild(bars);
      scoreBars.push({ bars, v, ri, ci, win: v === best && vals.filter((x) => x === best).length === 1 });
    });
    box.appendChild(row);
  });
}
function drawScore(t) {
  scoreBars.forEach((s) => {
    const t0 = at("v_mid", 0.6) + s.ri * 1.3 + s.ci * 0.12;
    const n = Math.round(s.v * easeOut(win(t, t0, t0 + 0.5)));
    [...s.bars.children].forEach((c, k) => { if (c.tagName === "I") c.classList.toggle("on", k < n); });
    s.bars.querySelector("b").style.opacity = s.win ? easeOut(win(t, t0 + 0.6, t0 + 0.8)) : 0;
  });
  pop($("scoreV"), t, at("v_mid", 8.6), 0.3, 20);
}

/* ================= widżety HUD ================= */
// tarcza zapłonu 720°
const EVEN = CYLINDERS.map((c) => (((c.cycleOffset + 360) % 720) + 720) % 720);
const UNEVEN_SET = [0, 60, 240, 300, 480, 540];
const dialTicks = CYLINDERS.map((c, i) => ({ e: mk($("dialTicks"), "circle", { r: 13 }), even: EVEN[i], uneven: UNEVEN_SET[i] }));
const fireAngle = (i, u) => lerp(dialTicks[i].even, dialTicks[i].uneven, u);
// wykres momentu: 6 cylindrów i porównanie z 4
{
  const x0 = 96, wpx = 804, base = 960, amp = 150;
  const X = (deg) => x0 + (deg / 720) * wpx;
  const hump = (off, deg, width = 180) => { const d = ((deg - off) % 720 + 720) % 720; return d < width ? Math.sin((d / width) * Math.PI) : 0; };
  for (let i = 0; i < 6; i++) {
    const off = i * 120;
    let dPath = "", started = false;
    for (let s = 0; s <= 180; s += 4) {
      const deg = (off + s) % 720;
      const wrap = s > 0 && off + s >= 720 && off + s - 4 < 720;
      dPath += (!started || wrap ? "M " : " L ") + X(deg).toFixed(1) + " " + (base - Math.sin((s / 180) * Math.PI) * amp).toFixed(1);
      started = true;
    }
    mk($("gHumps"), "path", { d: dPath, fill: "rgba(245,170,60,0.10)", stroke: "rgba(238,242,247,0.55)", "stroke-width": 2 });
    mk($("gOver"), "rect", { x: X((off + 120) % 720).toFixed(1), y: base - amp - 10, width: (X(60) - X(0)).toFixed(1), height: amp + 10, fill: "rgba(245,170,60,0.28)", class: "gov" });
  }
  let sd = "";
  for (let deg = 0; deg <= 720; deg += 3) {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += hump(i * 120, deg);
    sd += (deg ? " L " : "M ") + X(deg).toFixed(1) + " " + (base - sum * amp - 6).toFixed(1);
  }
  $("gSum").setAttribute("d", sd);
  // 4 cylindry: garby co 180°, między nimi dziury
  const b4 = 740, a4 = 130;
  let d4 = "";
  for (let deg = 0; deg <= 720; deg += 3) {
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += hump(i * 180, deg, 180) ** 2 * 1.15;
    d4 += (deg ? " L " : "M ") + X(deg).toFixed(1) + " " + (b4 - sum * a4).toFixed(1);
  }
  mk($("g4"), "path", { d: d4, fill: "none", stroke: "#b6c1cf", "stroke-width": 5 });
  mk($("g4"), "line", { x1: 96, y1: b4, x2: 900, y2: b4, stroke: "rgba(150,165,182,0.4)", "stroke-width": 2 });
  for (let i = 0; i < 4; i++) mk($("g4"), "circle", { cx: X(i * 180), cy: b4, r: 12, fill: "none", stroke: "#e2492b", "stroke-width": 4 });
}
const govs = [...document.querySelectorAll(".gov")];
// wykres otwarcia zaworów cylindra 1
{
  const x0 = 96, wpx = 804, base = 930, hgt = 200;
  const X = (deg) => x0 + (deg / 720) * wpx;
  const curve = (which) => {
    let d = "M " + X(0) + " " + base;
    for (let p = 0; p <= 720; p += 3) d += " L " + X(p).toFixed(1) + " " + (base - (lift(which, p) / LAYOUT.valveLift) * hgt).toFixed(1);
    return d + " L " + X(720) + " " + base + " Z";
  };
  $("liftI").setAttribute("d", curve("intake"));
  $("liftE").setAttribute("d", curve("exhaust"));
  [[0, "GMP"], [180, "DMP"], [360, "GMP"], [540, "DMP"], [720, "GMP"]].forEach(([p, lab]) => {
    mk($("liftTicks"), "line", { x1: X(p), y1: base, x2: X(p), y2: base + 14, stroke: "rgba(150,165,182,0.6)", "stroke-width": 2 });
    const tx = mk($("liftTicks"), "text", { x: X(p), y: base + 42, "text-anchor": "middle", fill: "#9aa5b2", "font-family": "IBM Plex Mono, monospace", "font-size": 20 });
    tx.textContent = lab;
  });
}

/* ================= render klatki ================= */
const brLab = $("brLab");
const fgVids = BRI.map((b, i) => $("bf" + i));
const cards = CHAP.map((c) => c.card);
const hkChips = $("chips");
// zestawy chipów per beat: [start, koniec, [[opóźnienie, tekst, klasa]]]
const CHIPS = [
  [T.w_chain, T.a_heads, [[0, "Łańcuszek, nie pasek", ""]]],
  [T.w_compact, T.a_cyl, [[0, "Krótki i zwarty", "ok"]]],
  [T.w_half, T.k_90, [[0, "60° = 120° ÷ 2", ""], [T.w_vq - T.w_half, "Nissan VQ", ""], [T.w_vq - T.w_half + 0.5, "GT-R · VR38", ""]]],
  [T.w_normal, T.p_share, [[0, "Ferrari · McLaren: zwykły wał", "ok"], [T.w_stairs - T.w_normal, "Schody przy mniejszych kątach", "hot"]]],
  [at("b_mass", 8.0), T.b_i3, [[0, "Siły bezwładności", "hot"]]],
  [at("b_ok", 0.2), T.ch6, [[0, "Nie idealnie", "hot"], [T.w_notfeel - T.b_ok - 0.2, "Ale nie poczujesz", "ok"]]],
  [T.w_idea2, at("f_cut", 1.2), [[0, "2 rzędy × 3", ""], [1.2, "1 wał", ""], [T.f_cut - T.w_idea2, "1 cięcie", "hot"]]],
];
let chipKey = "";
function drawChips(t) {
  const set = CHIPS.find((c) => inR(t, c[0], c[1]));
  const k = set ? String(set[0]) : "";
  if (k !== chipKey) {
    chipKey = k;
    hkChips.innerHTML = set ? set[2].map((c) => '<span class="chip ' + c[2] + '">' + c[1] + "</span>").join("") : "";
  }
  if (set) [...hkChips.children].forEach((el, i) => { const a = set[0] + set[2][i][0]; setOp(el, vis(t, a, set[1], 0.25, 0.25)); });
}
// linie opisu
const LINES = [
  [T.w_bore - 0.2, T.w_litres - 0.3, "Średnica <b>94 mm</b> · skok <b>85 mm</b>"],
  [T.w_onlypower, T.c_exh, "Jedyny suw, który <b>daje moc</b>"],
  [at("c_timing", 1.0), T.c_camcrank, "Dolotowy: otwiera <b>10° przed GMP</b>, zamyka <b>50° po DMP</b>", 470],
  [at("c_i4", 1.0), T.c_loop, "4 cylindry: <span class=\"hot\">dziury</span> · 6 cylindrów: <b>bez przerwy</b>", 440],
  [at("k_q", 1.8), T.k_60, "Pod jakim kątem rozchylić <b>dwa rzędy</b>?"],
  [T.p_rem, T.w_normal - 0.1, "Zapłon ma wypadać <b>co 120°</b>"],
  [T.w_jerk, T.p_buick, "Silnik <span class=\"hot\">szarpie</span>, zwłaszcza na wolnych obrotach"],
  [at("p_hero", 0.5), T.p_sub, "Bez tego V6 byłby <b>połówką V8</b>"],
  [at("b_mass", 0.2), T.w_hundred + 2.2, "Przy 3000 obr/min tłok zatrzymuje się <b>100 razy na sekundę</b>"],
  [T.w_coin + 0.3, T.b_ok, "Na biegu jałowym stoi <b>jak wryty</b>"],
  [at("f_idea", 0.5), T.f_cut, "Od kombi po najszybsze auta świata: <b>ten sam pomysł</b>"],
];
function drawLine(t) {
  const L = LINES.find((l) => inR(t, l[0], l[1]));
  const el = $("line");
  if (!L) { setOp(el, 0); return; }
  setHTML(el, L[2]);
  el.style.top = (L[3] || 880) + "px";
  setOp(el, vis(t, L[0], L[1], 0.3, 0.25));
  el.style.transform = "translateX(" + ((1 - easeOut(win(t, L[0], L[0] + 0.35))) * 18).toFixed(1) + "px)";
}
// duże odczyty
const BIGS = [
  [T.w_litres - 0.3, Math.min(T.w_litres + 2.2, T.a_bottom - 0.1), "6 × 590 cm³", "≈ 3,5<small>l</small>"],
  [T.w_ten - 0.2, T.c_spark, "Stopień sprężania", "10 : 1"],
  [T.w_hundred - 0.1, T.b_i3, "Zatrzymań tłoka na sekundę", "100<small>×</small>"],
];
function drawBig(t) {
  const B = BIGS.find((b) => inR(t, b[0], b[1]));
  const el = $("big");
  if (!B) { setOp(el, 0); return; }
  $("bigK").textContent = B[2];
  setHTML($("bigV"), B[3]);
  setOp(el, vis(t, B[0], B[1], 0.25, 0.25));
  el.style.transform = "scale(" + (1 + 0.1 * (1 - easeOut(win(t, B[0], B[0] + 0.3)))).toFixed(3) + ")";
}
// równania
const EQS = [
  [T.p_60, T.p_90, [["60°", T.w_e1], ["+", T.w_e2], ["60°", T.w_e3], ["=", T.w_e4], ["120°", T.w_e5, "res"]]],
  [T.p_90, T.p_1977, [["90°", T.w_f1], ["+", T.w_f2], ["30°", T.w_f3], ["=", T.w_f4], ["120°", T.w_f5, "res"]]],
];
let eqKey = "";
function drawEq(t) {
  const E = EQS.find((e) => inR(t, e[0], e[1]));
  const el = $("eq");
  const k = E ? String(E[0]) : "";
  if (k !== eqKey) { eqKey = k; el.innerHTML = E ? E[2].map((p) => '<span class="' + (p[2] || "") + '">' + p[0] + "</span>").join("") : ""; }
  if (!E) { setOp(el, 0); return; }
  setOp(el, 1);
  [...el.children].forEach((s, i) => pop(s, t, E[2][i][1], 0.18, 28));
}

function renderAt(t) {
  t = Math.max(0, Math.min(END, t));
  const ci = chapAt(t);

  /* ---- plansze pełnoekranowe ---- */
  const SL = [
    ["map", MAP[0], MAP[1]],
    ["slAng", T.k_90, T.ch4],
    ["slR6", T.b_r6, T.b_cw],
    ["slShaft", T.b_shaft, T.w_coin - 0.2],
    ["slBay", T.v_long, T.v_mid],
    ["slScore", T.v_mid, T.v_cta],
  ];
  let slideOn = null;
  for (const [id, a, b] of SL) {
    const on = inR(t, a, b);
    $(id).style.opacity = on ? 1 : 0;
    if (on) slideOn = id;
  }
  if (slideOn === "map") drawMap(t);
  if (slideOn === "slAng") drawAng(t);
  if (slideOn === "slR6") drawR6(t);
  if (slideOn === "slShaft") drawShaft(t);
  if (slideOn === "slBay") drawBay(t);
  if (slideOn === "slScore") drawScore(t);

  /* ---- pasek rozdziałów i karty rozdziałów ---- */
  const cbOn = t >= CHAP[0].t + 1.6;
  const tailK = 1 - win(t, at("f_cut", 0.6), at("f_cut", 1.6));
  setOp($("cb"), cbOn ? tailK : 0);
  if (cbOn) CHAP.forEach((c, i) => {
    c.seg.firstChild.style.width = (100 * clamp01((t - c.t) / (c.end - c.t))).toFixed(2) + "%";
    c.lab.classList.toggle("on", i === ci);
    setHTML(c.lab, c.id + " " + (c.q && t < c.t + 1.2 ? "???" : c.bar || c.ti));
    c.seg.className = c.q && t < c.t + 1.2 ? "q" : "";
  });
  const cc = ci >= 0 ? CHAP[ci] : null;
  const cardK = cc ? vis(t, cc.t, cc.t + (cc.q ? 2.2 : 1.6), 0.2, 0.3) : 0;
  setOp($("chCard"), cardK);
  if (cc && cardK > 0) {
    const reveal = cc.q ? t >= cc.t + 1.0 : true;
    $("chCardN").textContent = cc.id;
    $("chCardN").classList.toggle("q", !!cc.q && !reveal);
    $("chCardT").textContent = reveal ? cc.ti : "???";
    const flip = cc.q ? Math.abs(Math.cos(Math.PI * clamp01((t - cc.t - 0.8) / 0.4))) : 1;
    $("chCardIn").style.transform = "translateX(" + ((1 - easeOut(win(t, cc.t, cc.t + 0.4))) * -80).toFixed(1) + "px) scaleY(" + (cc.q && inR(t, cc.t + 0.8, cc.t + 1.2) ? flip : 1).toFixed(3) + ")";
  }

  /* ---- przebitki B-roll ---- */
  const bri = BRI.find((b) => inR(t, b.t0, b.t1));
  if (bri) {
    setHTML(brLab, bri.kick + "<b>" + bri.title + "</b>");
    brLab.style.right = (1920 - (bri.pos === "r" ? 1290 : 740) + 34) + "px";
    setOp(brLab, easeOut(win(t, bri.t0 + 0.1, bri.t0 + 0.35)));
    brLab.style.transform = "translateX(" + ((1 - easeOut(win(t, bri.t0 + 0.1, bri.t0 + 0.4))) * 30).toFixed(1) + "px)";
  } else setOp(brLab, 0);
  BRI.forEach((b, i) => {
    const v = fgVids[i];
    if (!v || !inR(t, b.t0, b.t1)) return;
    const k = easeOut(win(t, b.t0, b.t0 + 0.22));
    v.style.transform = "translateY(" + ((1 - k) * 60).toFixed(1) + "px) scale(" + (0.96 + 0.04 * k + 0.02 * win(t, b.t0, b.t1)).toFixed(4) + ")";
  });

  const covered = slideOn !== null;
  canvas.style.opacity = covered || bri ? 0 : 1;
  $("svg").style.opacity = covered || bri ? 0 : 1;
  $("ui").style.opacity = slideOn && slideOn !== "map" ? 0 : slideOn === "map" ? 0 : 1;
  if (slideOn) { setOp($("cb"), slideOn === "map" ? 0 : 1); }
  if (covered) return;

  /* ---- stan modelu ---- */
  const crankDeg = crankAt(t);
  engine.updateCrank(crankDeg);
  const s = S(t), lo = LO(t);
  const tz = TEASE.findIndex((x, i) => t >= x.t && t < (TEASE[i + 1] ? TEASE[i + 1].t : T.map));
  const tzId = tz >= 0 ? TEASE[tz].n : null;
  const rr = RRw.some((w) => inR(t, w[0], w[1]));
  const loT = tzId === "05" ? easeOut(win(t, T.co_shake, T.co_shake + 0.35)) : lo;
  for (const u of units) {
    const p = _p.copy(u.base);
    let v = true;
    if (u.top && u.o !== crank) {
      const k = stag(s, u.kS);
      if (k > 0) p.addScaledVector(u.sdir, k * u.smag);
      if (k > 0.985) v = false;
    }
    if (u.stage >= 0) { const k = stageK(t, u.stage, u.seqK); if (k > 0) p.addScaledVector(u.d, k * u.mul); }
    if (u.ldir && loT > 0) { p.addScaledVector(u.ldir, loT * 1900); if (loT > 0.985) v = false; }
    if (u.o === flywheel && rr) v = false;
    if ((u.stage === 3 || u.stage === 4 || u.o === engine.rotating.timing) && inR(t, T.a_cyl, T.a_bottom)) v = false;
    u.o.position.copy(p);
    u.o.visible = v;
  }
  if (rearFlange) rearFlange.visible = !rr;
  // czop dzielony
  const spl = SPL(t), gap = GAP(t);
  const a6 = cylB.journalAngle, a5 = a6 + 60 * spl;
  {
    const R = LAYOUT.crankRadius, j5 = journals["1"], j6 = journals["2"];
    j5.mesh.position.set(Math.cos(a5 * D2R) * R, Math.sin(a5 * D2R) * R, j5.base.z + 9 * gap);
    j6.mesh.position.set(Math.cos(a6 * D2R) * R, Math.sin(a6 * D2R) * R, j6.base.z - 9 * gap);
    cutDisc.position.set(Math.cos(a6 * D2R) * R, Math.sin(a6 * D2R) * R, PIN_Z);
    cutMat.opacity = CUT(t) * 0.7;
    cutDisc.visible = cutMat.opacity > 0.01;
  }
  const g = G(t);
  setCasingGhost(M, g);
  M.coverPlastic.opacity *= 1 - 0.9 * g;
  M.plastic.opacity *= 1 - 0.75 * g;
  const pulse = 0.82 + 0.18 * Math.sin(t * 6);
  pinA.emissiveIntensity = PG(t) * 1.7 * pulse + CUT(t) * 0.8;
  pinB.emissiveIntensity = PG(t) * 0.25;
  cwMat.emissiveIntensity = CWg(t) * 2.0 * pulse;
  rodHi.emissiveIntensity = inR(t, T.p_share, T.p_uneven) ? easeOut(win(t, at("p_share", 0.5), at("p_share", 1.0))) * 1.2 : 0;
  chainHi.emissiveIntensity = inR(t, at("a_timing", 2.6), T.a_heads) ? easeOut(win(t, at("a_timing", 2.6), at("a_timing", 3.2))) * 1.3 * pulse : 0;
  // ładunek, zawory i zapłony
  const cyc = inR(t, CYCw[0], CYCw[1]) || tzId === "02";
  engine.charge.visible = cyc && g > 0.5;
  const ph1 = cycleAngle(engine.focus, crankDeg);
  if (engine.charge.visible) {
    const m = engine.charge.material;
    if (ph1 < 180) { m.color.setHex(0x5aa6ff); m.opacity = lerp(0.1, 0.25, ph1 / 180); }
    else if (ph1 < 360) { m.color.setHex(0x7cc0ff); m.opacity = lerp(0.25, 0.48, (ph1 - 180) / 180); }
    else if (ph1 < 400) { m.color.setHex(0xff7a2a); m.opacity = lerp(0.9, 0.55, (ph1 - 360) / 40); }
    else if (ph1 < 540) { m.color.setHex(0xd06a3a); m.opacity = lerp(0.55, 0.3, (ph1 - 400) / 140); }
    else { m.color.setHex(0x8d8a86); m.opacity = lerp(0.34, 0.08, (ph1 - 540) / 180); }
  }
  valI.emissiveIntensity = cyc ? (lift("intake", ph1) / LAYOUT.valveLift) * 1.6 : 0;
  valE.emissiveIntensity = cyc ? (lift("exhaust", ph1) / LAYOUT.valveLift) * 1.6 : 0;
  const unev = UNEV(t);
  const fireOn = (FIREw.some((w) => inR(t, w[0], w[1])) || (cyc && inR(t, T.c_spark, T.c_exh))) && g > 0.5 && s < 0.2;
  const cm = ((crankDeg % 720) + 720) % 720;
  flashes.forEach((f, i) => {
    const only1 = inR(t, T.c_spark, T.c_exh);
    if (!fireOn || (only1 && f.c.id !== 1)) { f.m.visible = false; return; }
    const fa = fireAngle(i, unev);
    const x = ((cm - fa) % 720 + 720) % 720;
    const k = x < 90 ? Math.pow(1 - x / 90, 1.6) : 0;
    f.m.visible = k > 0.01;
    f.mat.opacity = k;
    f.mat.color.setRGB(2.4 * k + 0.3, 0.9 * k + 0.1, 0.25 * k);
  });
  coin.visible = inR(t, T.w_coin - 0.7, T.ch6);
  // kołysanie i trzęsienie
  const rock = tzId === "05" ? easeOut(win(t, T.co_shake + 0.3, T.co_shake + 0.6)) : ROCK(t);
  const shk = SHK(t);
  _q.setFromAxisAngle(ROCK_AXIS, rock * 0.06 * Math.sin(crankDeg * D2R));
  _q2.setFromAxisAngle(Z_AXIS, shk * 0.014 * (Math.sin(t * 43) + 0.6 * Math.sin(t * 71 + 2)));
  engine.root.quaternion.copy(_q).multiply(_q2);
  engine.root.position.set(shk * 5 * Math.sin(t * 57), shk * 4 * Math.sin(t * 39 + 1), 0);
  engine.root.updateMatrixWorld(true);
  applyCam(t, shk);
  canvas.style.filter = tzId === "04" || inR(t, T.c_loop, T.ch3) ? "blur(" + (14 + 4 * Math.sin(t * 3)).toFixed(1) + "px) brightness(0.8)" : "none";

  /* ---- warstwa HTML ---- */
  // cold open i tytuł
  const coOn = t < T.co_thanks + 0.4;
  $("co").style.display = coOn ? "" : "none";
  if (coOn) { pop($("co1"), t, 0.02, 0.25, 30); pop($("co2"), t, T.co_wale, 0.25, 20); $("co").style.opacity = 1 - win(t, T.co_thanks, T.co_thanks + 0.4); }
  const tiOn = inR(t, T.co_film - 0.2, T.co_works);
  $("ti").style.display = tiOn ? "" : "none";
  if (tiOn) {
    const k = easeOut(win(t, T.co_film, T.co_film + 0.22));
    $("tiV").style.opacity = k;
    $("tiV").style.transform = "scale(" + (1.35 - 0.35 * k).toFixed(3) + ")";
    $("tiV").style.textShadow = "0 0 " + (70 * Math.max(0, 1 - (t - T.co_film) / 0.6)).toFixed(0) + "px rgba(245,170,60,0.8)";
    pop($("tiS"), t, T.co_film + 0.25, 0.25, 20);
    pop($("tiM"), t, T.co_film + 0.5, 0.25, 14);
  }
  // zajawki i zapowiedź rozdziału 4 w rozdziale 2
  const loopOn = inR(t, T.c_loop, T.ch3);
  const tzOn = tz >= 0 || loopOn;
  $("tz").style.display = tzOn ? "" : "none";
  if (tzOn) {
    const TT = loopOn ? { t: T.c_loop, n: "04", ti: "???", q: true } : TEASE[tz];
    $("tzK").textContent = loopOn ? "Za dwa rozdziały" : "W tym filmie";
    $("tzNum").textContent = TT.n;
    $("tzT").textContent = TT.ti;
    $("tzT").classList.toggle("q", !!TT.q);
    pop($("tzN"), t, TT.t, 0.18, 16);
    $("tzHint").style.opacity = TT.q ? easeOut(win(t, TT.t + 0.4, TT.t + 0.7)) : 0;
  }
  // nagłówek rozdziału
  const hOn = cc && t >= cc.t + (cc.q ? 2.2 : 1.6);
  setOp($("ch"), hOn ? easeOut(win(t, cc.t + 1.6, cc.t + 2.0)) * (1 - win(t, at("f_cut", 0.6), at("f_cut", 1.6))) : 0);
  if (hOn) { $("chK").textContent = "Rozdział " + cc.id; setHTML($("chH"), cc.head); }
  // licznik elementów w rozdziale 1
  const cntOn = inR(t, T.a_intake, T.ch2);
  setOp($("cnt"), cntOn ? 1 : 0);
  if (cntOn) { const n = STAGES.filter((st) => t >= st.t).length; setHTML($("cntV"), String(Math.max(1, n)).padStart(2, "0") + "<span>/10</span>"); }
  // suwy
  const s0t = Math.min(T.w_ssie, T.c_four) - 0.2;
  const strOn = inR(t, s0t, T.c_timing);
  setOp($("strokes"), strOn ? easeOut(win(t, s0t, s0t + 0.3)) : 0);
  if (strOn) {
    const st = t < T.c_intake ? null : strokeOf(engine.focus, crankDeg);
    [...$("strokes").children].forEach((c, i) => { c.classList.toggle("on", c.dataset.s === st); const ws = [T.w_ssie, T.w_spreza, T.w_pracuje, T.w_wydycha][i]; c.style.opacity = easeOut(win(t, ws - 0.05, ws + 0.2)); });
  }
  drawChips(t);
  drawLine(t);
  drawBig(t);
  drawEq(t);
  drawHud(t, crankDeg, unev);
  drawOverlays3D(t, crankDeg);
  drawCards(t);
  drawTags(t, !!bri);
  if (!bri) composer.render();
}
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const ROCK_AXIS = new THREE.Vector3(-BANK_DIR.R.y, BANK_DIR.R.x, 0).normalize();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function drawMap(t) {
  pop(document.querySelector("#map .sk"), t, T.map, 0.25, 10);
  pop(document.querySelector("#map .sh"), t, T.map + 0.05, 0.25, 20);
  CHAP.forEach((c, i) => {
    const el = c.card;
    if (c.q) {
      const k = easeOut(win(t, T.w_secret - 0.1, T.w_secret + 0.2));
      const pl = t > T.w_secret + 0.2 ? 0.5 + 0.5 * Math.sin((t - T.w_secret) * 5) : 0;
      el.style.opacity = k;
      el.style.transform = "scale(" + (1 + pl * 0.03).toFixed(3) + ")";
      el.querySelector(".b").style.boxShadow = "0 0 " + (20 + 30 * pl).toFixed(0) + "px rgba(226,73,43," + (0.25 + 0.35 * pl).toFixed(2) + ")";
      return;
    }
    const a0 = T.map + 0.25 + (i > 3 ? i - 1 : i) * 0.12;
    const inK = easeOut(win(t, a0 - 0.25, a0));
    const flip = easeIO(win(t, a0, a0 + 0.35));
    el.style.opacity = inK;
    el.style.transform = "translateY(" + ((1 - inK) * 40).toFixed(1) + "px) rotateY(" + (flip * 180).toFixed(1) + "deg)";
  });
  $("tlF").style.width = (100 * easeIO(win(t, T.w_secret + 0.3, T.ch1))).toFixed(2) + "%";
  $("mapV").style.opacity = 0;
}

function drawHud(t, crankDeg, unev) {
  const cm = ((crankDeg % 720) + 720) % 720;
  // tarcza zapłonu
  const dialOn = inR(t, T.c_six, T.c_overlap) || inR(t, T.p_rem, T.p_buick);
  const d0 = t < T.ch3 ? T.c_six : T.p_rem;
  $("dial").setAttribute("opacity", dialOn ? vis(t, d0, t < T.ch3 ? T.c_overlap : T.p_buick, 0.3, 0.3).toFixed(3) : 0);
  setOp($("dialV"), dialOn ? vis(t, d0, t < T.ch3 ? T.c_overlap : T.p_buick, 0.3, 0.3) : 0);
  if (dialOn) {
    const rad = (cm / 2 - 90) * D2R;
    $("dialP").setAttribute("x2", (260 + Math.cos(rad) * 124).toFixed(1));
    $("dialP").setAttribute("y2", (740 + Math.sin(rad) * 124).toFixed(1));
    dialTicks.forEach((d, i) => {
      const fa = fireAngle(i, unev), r2 = (fa / 2 - 90) * D2R;
      d.e.setAttribute("cx", (260 + Math.cos(r2) * 108).toFixed(1));
      d.e.setAttribute("cy", (740 + Math.sin(r2) * 108).toFixed(1));
      const x = ((cm - fa) % 720 + 720) % 720, k = x < 80 ? 1 - x / 80 : 0;
      d.e.setAttribute("r", (12 + 8 * k).toFixed(1));
      d.e.setAttribute("fill", unev > 0.5 ? (k > 0 ? "#ff6a4d" : "#8a3a2c") : k > 0 ? "#ffd08a" : "#f5aa3c");
    });
    const txt = unev > 0.5 ? "60° / 180°" : "120°";
    if ($("dialVv").textContent !== txt) $("dialVv").textContent = txt;
    $("dialVv").classList.toggle("hot", unev > 0.5);
    $("dialK").textContent = unev > 0.5 ? "Zwykły wał" : "Zapłon co";
  }
  // wykres momentu i porównanie z czwórką
  const grOn = inR(t, T.c_overlap, T.c_loop);
  $("graph").setAttribute("opacity", grOn ? vis(t, T.c_overlap, T.c_loop, 0.3, 0.3).toFixed(3) : 0);
  setOp($("g6L"), grOn ? vis(t, T.c_overlap, T.c_loop, 0.3, 0.3) : 0);
  if (grOn) {
    $("gclipR").setAttribute("width", (804 * easeIO(win(t, T.c_overlap, at("c_overlap", 1.8)))).toFixed(1));
    const ovk = easeOut(win(t, at("c_overlap", 2.0), at("c_overlap", 2.4))) * (0.6 + 0.4 * Math.sin(t * 7) ** 2);
    govs.forEach((r) => r.setAttribute("opacity", ovk.toFixed(3)));
    const hx = 96 + ((((crankDeg - crankAt(T.c_overlap)) % 720) + 720) % 720) / 720 * 804;
    $("gHead").setAttribute("x1", hx.toFixed(1)); $("gHead").setAttribute("x2", hx.toFixed(1));
    const k4 = easeOut(win(t, at("c_i4", 0.2), at("c_i4", 0.7)));
    $("g4").setAttribute("opacity", k4.toFixed(3));
    setOp($("g4L"), k4);
  } else setOp($("g4L"), 0);
  // otwarcie zaworów
  const lfOn = inR(t, T.c_timing, T.c_camcrank);
  $("lift").setAttribute("opacity", lfOn ? vis(t, T.c_timing, T.c_camcrank, 0.3, 0.3).toFixed(3) : 0);
  setOp($("liftL"), lfOn ? vis(t, T.c_timing, T.c_camcrank, 0.3, 0.3) : 0);
  if (lfOn) {
    const ph = cycleAngle(engine.focus, crankDeg);
    const hx = 96 + (ph / 720) * 804;
    $("liftHead").setAttribute("x1", hx.toFixed(1)); $("liftHead").setAttribute("x2", hx.toFixed(1));
  }
  // wał i wałek rozrządu
  const ccOn = inR(t, T.c_camcrank, T.c_six);
  const ccK = ccOn ? vis(t, T.c_camcrank, T.c_six, 0.3, 0.3) : 0;
  $("cc").setAttribute("opacity", ccK.toFixed(3));
  ["ccLA", "ccLB", "ccVA", "ccVB"].forEach((id) => setOp($(id), ccK));
  if (ccOn) {
    const d = crankDeg - crankAt(T.c_camcrank);
    const ra = (d - 90) * D2R, rb = (d / 2 - 90) * D2R;
    $("ccA").setAttribute("x2", (230 + Math.cos(ra) * 96).toFixed(1)); $("ccA").setAttribute("y2", (760 + Math.sin(ra) * 96).toFixed(1));
    $("ccB").setAttribute("x2", (560 + Math.cos(rb) * 96).toFixed(1)); $("ccB").setAttribute("y2", (760 + Math.sin(rb) * 96).toFixed(1));
    $("ccVA").textContent = Math.round(Math.max(0, d)) + "°";
    $("ccVB").textContent = Math.round(Math.max(0, d / 2)) + "°";
  }
}

function drawOverlays3D(t, crankDeg) {
  const fr = engine.root;
  // łuk kąta V: pytanie, 60°, zapłon, rozwiązanie
  const zc = -205;
  const qOn = inR(t, at("k_q", 1.4), T.k_90), remOn = inR(t, at("p_rem", 0.8), at("p_rem", 5.3));
  const soloOn = inR(t, at("p_60", 1.6), T.p_90);
  const teaseOn = inR(t, T.co_60, T.co_shake);
  const arcOn = qOn || remOn || soloOn || teaseOn;
  const zA = soloOn ? PIN_Z : zc;
  let span = 60;
  if (qOn) span = t < T.k_60 ? 90 + 60 * Math.sin((t - T.k_q) * 2.2) : lerp(90 + 60 * Math.sin((T.k_60 - T.k_q) * 2.2), 60, easeIO(win(t, T.k_60, at("k_60", 0.9))));
  if (remOn) span = 120;
  const a0t = qOn ? at("k_q", 1.4) : remOn ? at("p_rem", 0.8) : soloOn ? at("p_60", 1.6) : T.co_60 + 0.1;
  const arcIn = arcOn ? easeOut(win(t, a0t, a0t + 0.45)) : 0;
  const R0 = 90 - span / 2, L0 = 90 + span / 2;
  $("arcV").setAttribute("d", arcD(fr, soloOn ? 260 : 300, R0, lerp(R0, L0, arcIn), zA));
  const ax = (a) => seg2(lp(fr, 0, 0, zA), lp(fr, Math.cos(a * D2R) * 480, Math.sin(a * D2R) * 480, zA));
  $("axR").setAttribute("d", ax(R0)); $("axL").setAttribute("d", ax(L0));
  ["arcV", "axR", "axL"].forEach((id) => $(id).setAttribute("opacity", arcIn.toFixed(3)));
  const lm = lp(fr, 0, soloOn ? 330 : 380, zA);
  place($("lab60"), lm.x, lm.y);
  $("lab60").textContent = qOn && t < at("k_60", 0.6) ? "?" : Math.round(span) + "°";
  setOp($("lab60"), arcIn);
  // łuk między połówkami czopu
  const pinArcOn = inR(t, at("p_60", 0.6), at("p_1977", 0.8));
  const paK = pinArcOn ? easeOut(win(t, at("p_60", 0.8), at("p_60", 1.6))) : 0;
  const a6 = cylB.journalAngle, a5 = a6 + 60 * SPL(t);
  $("pinArc").setAttribute("d", arcD(crank, 92, a6, a5, PIN_Z, 0, 0, 20));
  $("pinArc").setAttribute("opacity", paK.toFixed(3));
  const pm = lp(crank, Math.cos(((a6 + a5) / 2) * D2R) * 150, Math.sin(((a6 + a5) / 2) * D2R) * 150, PIN_Z);
  place($("labPin"), pm.x, pm.y);
  $("labPin").textContent = Math.round(a5 - a6) + "°";
  setOp($("labPin"), paK * clamp01((a5 - a6) / 20));
  // wymiary cylindra 1: średnica i skok
  const dimOn = inR(t, T.w_bore - 0.3, T.w_litres + 0.4);
  const dk = dimOn ? vis(t, T.w_bore - 0.3, T.w_litres + 0.4, 0.5, 0.3) : 0;
  const dir = BANK_DIR.R, ux = -dir.y, uy = dir.x;
  if (dimOn) {
    let d = "";
    for (let i = 0; i <= 32; i++) {
      const f = (i / 32) * Math.PI * 2 * clamp01((t - T.w_bore + 0.3) / 0.9);
      const c = LAYOUT.deckHeight + 6;
      const p = lp(fr, dir.x * c + ux * Math.cos(f) * 49, dir.y * c + uy * Math.cos(f) * 49, 108 + Math.sin(f) * 49);
      d += (i ? " L " : "M ") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    }
    $("dimA").setAttribute("d", d);
    const sMin = LAYOUT.rodLength - LAYOUT.crankRadius, sMax = LAYOUT.rodLength + LAYOUT.crankRadius;
    const off = 76;
    const pA = lp(fr, dir.x * sMin + ux * off, dir.y * sMin + uy * off, 108), pB = lp(fr, dir.x * sMax + ux * off, dir.y * sMax + uy * off, 108);
    const sk = easeOut(win(t, T.w_stroke - 0.2, T.w_stroke + 0.6));
    $("dimB").setAttribute("d", seg2(pA, { x: lerp(pA.x, pB.x, sk), y: lerp(pA.y, pB.y, sk) }));
    $("dimB").setAttribute("opacity", (dk * (sk > 0 ? 1 : 0)).toFixed(3));
    const la = lp(fr, dir.x * (LAYOUT.deckHeight + 60), dir.y * (LAYOUT.deckHeight + 60), 108);
    place($("labA"), la.x, la.y); $("labA").textContent = "Ø 94 mm";
    setOp($("labA"), dk * easeOut(win(t, T.w_bore + 0.2, T.w_bore + 0.6)));
    const lb = lp(fr, dir.x * (sMin + sMax) / 2 + ux * (off + 60), dir.y * (sMin + sMax) / 2 + uy * (off + 60), 108);
    place($("labB"), lb.x, lb.y); $("labB").textContent = "skok 85 mm";
    setOp($("labB"), dk * easeOut(win(t, T.w_stroke + 0.3, T.w_stroke + 0.7)));
  } else { setOp($("labA"), 0); setOp($("labB"), 0); $("dimB").setAttribute("opacity", 0); }
  $("dimA").setAttribute("opacity", dk.toFixed(3));
  // obrys litery V na bloku
  const vOn = inR(t, T.w_valley, T.a_cyl);
  const vk = vOn ? vis(t, T.w_valley, T.a_cyl, 0.6, 0.3) : 0;
  if (vOn) {
    const zf = 200, Lh = 330;
    const pR = lp(fr, BANK_DIR.R.x * Lh, BANK_DIR.R.y * Lh, zf), pC = lp(fr, 0, 0, zf), pL = lp(fr, BANK_DIR.L.x * Lh, BANK_DIR.L.y * Lh, zf);
    const dr = clamp01((t - T.w_valley) / 0.9);
    const mid = { x: lerp(pR.x, pC.x, clamp01(dr * 2)), y: lerp(pR.y, pC.y, clamp01(dr * 2)) };
    const end = { x: lerp(pC.x, pL.x, clamp01(dr * 2 - 1)), y: lerp(pC.y, pL.y, clamp01(dr * 2 - 1)) };
    $("vOut").setAttribute("d", "M " + pR.x.toFixed(1) + " " + pR.y.toFixed(1) + " L " + mid.x.toFixed(1) + " " + mid.y.toFixed(1) + (dr > 0.5 ? " L " + end.x.toFixed(1) + " " + end.y.toFixed(1) : ""));
  }
  $("vOut").setAttribute("opacity", vk.toFixed(3));
  // strzałki kołysania
  const rock = inR(t, T.co_shake, T.co_four) ? easeOut(win(t, T.co_shake + 0.3, T.co_shake + 0.6)) : ROCK(t);
  [["rockA", 190], ["rockB", -190]].forEach(([id, z], i) => {
    const c = lp(fr, BANK_DIR.R.x * 330, BANK_DIR.R.y * 330, z);
    const sgn = (i === 0 ? 1 : -1) * Math.sin(crankDeg * D2R);
    const tip = sgn > 0 ? c.y - 80 : c.y + 80, bk = sgn > 0 ? 24 : -24;
    $(id).setAttribute("d", "M " + c.x.toFixed(1) + " " + (c.y - 80).toFixed(1) + " L " + c.x.toFixed(1) + " " + (c.y + 80).toFixed(1) + " M " + (c.x - 20).toFixed(1) + " " + (tip + bk).toFixed(1) + " L " + c.x.toFixed(1) + " " + tip.toFixed(1) + " L " + (c.x + 20).toFixed(1) + " " + (tip + bk).toFixed(1));
    $(id).setAttribute("opacity", (rock * (0.5 + 0.5 * Math.abs(Math.sin(crankDeg * D2R)))).toFixed(3));
  });
  // historia Buicka
  const hOn = inR(t, T.p_buick, T.p_cut) || inR(t, T.p_1977, T.p_hero);
  const h0 = t < T.p_cut ? T.p_buick : T.p_1977, h1 = t < T.p_cut ? T.p_cut : T.p_hero;
  const hk = hOn ? vis(t, h0, h1, 0.3, 0.3) : 0;
  setOp($("hist"), hk);
  if (hOn) {
    const later = t >= T.p_1977;
    const yr = later ? Math.round(lerp(1962, 1977, easeOut(win(t, at("p_1977", 0.2), at("p_1977", 1.6))))) : 1962;
    if ($("histY").textContent !== String(yr)) $("histY").textContent = String(yr);
    const done = later && t > at("p_1977", 1.6);
    $("histS").textContent = done ? "Równy zapłon" : "Nierówny zapłon";
    $("histS").classList.toggle("ok", done);
    const shake = later ? 0 : 6;
    $("wheel").style.transform = "translate(" + (shake * Math.sin(t * 40)).toFixed(1) + "px," + (shake * 0.6 * Math.sin(t * 53)).toFixed(1) + "px) rotate(" + (shake * 0.8 * Math.sin(t * 37)).toFixed(1) + "deg)";
    $("histS").style.transform = "rotate(-8deg) scale(" + (1 + 0.3 * (1 - easeOut(win(t, h0 + 1.0, h0 + 1.3)))).toFixed(3) + ")";
    $("histS").style.opacity = done ? 1 : later ? 0.4 : easeOut(win(t, h0 + 1.0, h0 + 1.2));
  }
  // subskrypcja
  const sOn = inR(t, at("p_sub", 1.0), T.ch5);
  setOp($("sub"), sOn ? vis(t, at("p_sub", 1.0), T.ch5, 0.3, 0.3) : 0);
  if (sOn) {
    const clicked = t > at("p_sub", 3.6);
    $("subBtn").classList.toggle("done", clicked);
    $("subBtn").textContent = clicked ? "Subskrybujesz" : "Subskrybuj";
    const tap = 1 - 0.1 * Math.max(0, Math.sin(clamp01((t - T.p_sub - 3.4) / 0.3) * Math.PI));
    $("subBtn").style.transform = "scale(" + tap.toFixed(3) + ")";
  }
  // pytanie do komentarzy
  const cOn = inR(t, T.v_cta, T.ch7);
  setOp($("cmt"), cOn ? vis(t, T.v_cta, T.ch7, 0.35, 0.3) : 0);
  if (cOn) {
    const ph = t - T.v_cta - 0.5;
    const fA = ph > 0 ? 0.5 + 0.5 * Math.sin(ph * (5 + ph * 1.5)) : 0;
    const both = easeOut(win(t, at("v_cta", 4.0), at("v_cta", 4.3)));
    [["coA", Math.max(fA, both)], ["coB", Math.max(ph > 0 ? 1 - fA : 0, both)]].forEach(([id, gl]) => {
      $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * gl).toFixed(2) + ")";
      $(id).style.boxShadow = "0 0 " + (34 * gl).toFixed(0) + "px rgba(245,170,60," + (0.3 * gl).toFixed(2) + ")";
    });
  }
}

const carEls = [...document.querySelectorAll(".car")];
const CAR_T = [T.w_audi, T.w_toyota, T.w_vqw, T.f_list2, T.w_ferrari, T.w_f1all];
function drawCards(t) {
  const on = inR(t, T.f_list1, at("f_idea", 1.0));
  carEls.forEach((el, i) => {
    if (!on) { setOp(el, 0); return; }
    const k = easeOut(win(t, CAR_T[i], CAR_T[i] + 0.35));
    const out = easeIO(win(t, T.f_idea + i * 0.06, at("f_idea", 0.5) + i * 0.06));
    setOp(el, k * (1 - out));
    el.style.transform = "translateX(" + ((1 - k) * -60 + out * 400).toFixed(1) + "px)";
  });
}

/* ================= start ================= */
window.__timelines = window.__timelines || {};
if (!window.__timelines["main"]) window.__timelines["main"] = gsap.timeline({ paused: true });
window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
