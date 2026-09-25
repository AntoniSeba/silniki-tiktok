// main.js - interaktywny model silnika Porsche 4.0 H6 (9A2 evo, 718 Cayman GT4 / Spyder).
// Kinematyka liczona wzorami: dwa banki po trzy cylindry w ukladzie 180 stopni,
// szesc czopow korbowych parami co 180 stopni, siedem czopow glownych, korbowody,
// tloki, dwa walki na glowice z krzywkami, naped lancuchem i paskiem.
// Wnetrza pokazujemy przez odsuwanie skorup, nie przez plaszczyzne tnaca.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor, makeShadowFloor } from './lib/environment.js';
import * as L from './lib/layout.js';
import { buildBlockAssembly } from './parts/block.js';
import { buildHeads, updateValvetrain } from './parts/heads.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildIntake } from './parts/intake.js';
import { buildExhaust } from './parts/exhaust.js';
import { buildCovers } from './parts/covers.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const flag = (k) => params.get(k) === '1';
const lq = flag('lq');

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 5, 40000);
const env = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = env.background || env;
const studioFloor = makeStudioFloor(26000);
studioFloor.position.y = -560;
scene.add(studioFloor);
const shadowFloor = makeShadowFloor(18000);
shadowFloor.position.y = -540;
scene.add(shadowFloor);

const key = new THREE.DirectionalLight(0xfff6ea, 2.5);
key.position.set(-1400, 1900, 1500);
key.castShadow = true;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 800;
key.shadow.camera.far = 9000;
key.shadow.camera.left = -1200;
key.shadow.camera.right = 1200;
key.shadow.camera.top = 1200;
key.shadow.camera.bottom = -1200;
key.shadow.bias = -0.0006;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.45);
fill.position.set(1700, 900, -1200);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.75);
rim.position.set(-600, -700, -1700);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x14161a, 0.35));

// ------------------------------------------------------------------ assembly
const M = createMaterials();
const engine = new THREE.Group();
engine.name = 'ENGINE';
scene.add(engine);

const block = buildBlockAssembly(M);
const heads = buildHeads(M);
const rot = buildRotatingAssembly(M);
const intake = buildIntake(M);
const exhaust = buildExhaust(M);
const covers = buildCovers(M);
engine.add(block.root, heads.root, rot.root, intake.root, exhaust.root, covers.root);
applyMaterialVariation(block.root, M);

const parts = { block, heads, rot, intake, exhaust, covers };

// ------------------------------------------------------------------ state
const state = {
  crank: num('crank', 0),
  rpm: num('rpm', 900),
  playing: !flag('nop'),
  explode: 0,
  cut: false,
  labels: true,
  gas: true,
};

// ------------------------------------------------------------------ camera fit
const bbox = new THREE.Box3().setFromObject(engine);
const centre = bbox.getCenter(new THREE.Vector3());
const radius = bbox.getSize(new THREE.Vector3()).length() / 2;
const FIT = (() => {
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.18;
})();

const VIEWS = {
  os: { dir: new THREE.Vector3(0.06, 0.1, 1), target: centre.clone(), scale: 1.0 },
  tq: { dir: new THREE.Vector3(0.78, 0.5, 0.72), target: centre.clone(), scale: 1.0 },
  bok: { dir: new THREE.Vector3(1, 0.14, 0.06), target: centre.clone(), scale: 0.98 },
  gora: { dir: new THREE.Vector3(0.05, 1, 0.12), target: centre.clone(), scale: 0.96 },
  glowica: { dir: new THREE.Vector3(0.6, 0.62, 0.5), target: new THREE.Vector3(180, 60, 0), scale: 0.3 },
  wal: { dir: new THREE.Vector3(0.35, 0.3, 0.88), target: new THREE.Vector3(0, 0, 60), scale: 0.34 },
  wydech: { dir: new THREE.Vector3(0.55, -0.45, 0.7), target: new THREE.Vector3(280, -300, -300), scale: 0.34 },
  miska: { dir: new THREE.Vector3(0.4, -0.75, 0.5), target: new THREE.Vector3(0, -140, -40), scale: 0.3 },
};

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 90;
controls.maxDistance = FIT * 1.8;

function setView(name) {
  const v = VIEWS[name] || VIEWS.tq;
  const dist = FIT * (v.scale || 1);
  camera.position.copy(v.target.clone().add(v.dir.clone().normalize().multiplyScalar(dist)));
  camera.near = Math.max(5, dist * 0.01);
  camera.far = dist * 60 + 40000;
  camera.updateProjectionMatrix();
  controls.target.copy(v.target);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

// ------------------------------------------------------------------ explode + cutaway
const REST = new Map();
const EX = [
  ['HEAD_A', new THREE.Vector3(1, 0, 0), 300],
  ['HEAD_B', new THREE.Vector3(-1, 0, 0), 300],
  ['CAM_COVER_A', new THREE.Vector3(1, 0, 0), 470],
  ['CAM_COVER_B', new THREE.Vector3(-1, 0, 0), 470],
  ['HALF_CASE_A', new THREE.Vector3(1, 0.15, 0), 210],
  ['HALF_CASE_B', new THREE.Vector3(-1, -0.15, 0), 210],
  ['INTAKE_SYSTEM', new THREE.Vector3(0, 1, 0), 300],
  ['EXHAUST_SYSTEM', new THREE.Vector3(0, -1, 0), 320],
  ['OIL_SYSTEM', new THREE.Vector3(0, -1, 0), 210],
  ['THERMAL_MANAGEMENT', new THREE.Vector3(0.4, 1, 0.4), 260],
  ['COVERS_AND_DRIVELINE', new THREE.Vector3(0, 0, -1), 60],
  ['TIMING_COVER', new THREE.Vector3(0, 0, -1), 260],
  ['TRANSMISSION', new THREE.Vector3(0, 0, -1), 420],
  ['TIMING_DRIVE', new THREE.Vector3(0, 0, 1), 140],
  ['ACCESSORY_DRIVE', new THREE.Vector3(0, 0, 1), 190],
  ['FLYWHEEL_ASSEMBLY', new THREE.Vector3(0, 0, 1), 300],
  ['STARTER_MOTOR', new THREE.Vector3(0.6, 0, 1), 220],
  ['ENGINE_MOUNTS', new THREE.Vector3(0, 1, 0), 180],
];
for (const [name] of EX) {
  const o = engine.getObjectByName(name);
  if (o) REST.set(o, o.position.clone());
  else console.warn('explode target missing', name);
}

function applyExplode(t) {
  for (const [name, dir, dist] of EX) {
    const o = engine.getObjectByName(name);
    if (!o) continue;
    const rest = REST.get(o);
    o.position.copy(rest).addScaledVector(dir.clone().normalize(), t * dist);
  }
}

// Tryb przekroju: odsuwamy polowke B i jej glowice oraz pokrywy, tak ze widac
// wal, korbowody i tloki w polowce A. Bez plaszczyzny tnacej i bez przezroczystosci.
const CUT_MOVE = [
  ['HALF_CASE_B', new THREE.Vector3(-1, 0, 0), 430],
  ['HEAD_B', new THREE.Vector3(-1, 0, 0), 560],
  ['CAM_COVER_B', new THREE.Vector3(-1, 0, 0), 700],
  ['EXHAUST_BANK_B', new THREE.Vector3(-1, -0.4, 0), 520],
  ['TIMING_COVER', new THREE.Vector3(0, 0, -1), 300],
  ['CAM_COVER_A', new THREE.Vector3(1, 0, 0), 240],
];
for (const [name, , ] of CUT_MOVE) {
  const o = engine.getObjectByName(name);
  if (o && !REST.has(o)) REST.set(o, o.position.clone());
}
function applyCut(on) {
  state.cut = on;
  const cb = document.getElementById('cut');
  if (cb) cb.checked = on;
  for (const [name, dir, dist] of CUT_MOVE) {
    const o = engine.getObjectByName(name);
    if (!o) continue;
    const rest = REST.get(o) || o.position.clone();
    o.position.copy(rest).addScaledVector(dir.clone().normalize(), on ? dist : 0);
  }
}

function applyVisibility() {
  const coversOff = document.getElementById('coversOff')?.checked;
  const o = engine.getObjectByName('TIMING_COVER');
  if (o) {
    const rest = REST.get(o) || o.position.clone();
    o.position.copy(rest).addScaledVector(new THREE.Vector3(0, 0, -1), coversOff ? 340 : 0);
  }
}

// ------------------------------------------------------------------ labels
const LABELS = [
  ['Crankcase_Half_A', 'Skrzynia korbowa, polowka A (AlSi7, komora zamknieta)'],
  ['CylinderBore_1', 'Gladz cylindra z powloka zelazna, 102 mm'],
  ['CRANKSHAFT', 'Wal korbowy kuty (6 czopow korbowych, 7 czopow glownych)'],
  ['Crank_MainJournal_4', 'Czop glowny 67 mm'],
  ['Crank_RodJournal_Cyl1', 'Czop korbowy 53 mm'],
  ['PISTON_Cyl1', 'Tlok kuty z kieszeniami zaworowymi'],
  ['CONNECTING_ROD_Cyl1', 'Korbowod 138 mm'],
  ['CylinderHead_A', 'Glowica banku A (cyl. 1-3), 4 zawory na cylinder'],
  ['CamCover_A', 'Pokrywa walkow rozrzadu'],
  ['CAMSHAFT_INTAKE_A', 'Walek ssacy z krzywkami i VarioCam'],
  ['VarioCam_intake_A', 'Wariator VarioCam (4 walki)'],
  ['Rocker_A_Cyl1_intake_R', 'Dzwignia palcowa z kompensacja hydrauliczna'],
  ['ValveHead_A_1_intake_R', 'Zawor ssacy (24 zawory)'],
  ['SPARK_PLUG_Cyl1', 'Swieca zaplonowa z cewka'],
  ['INJECTOR_Cyl1', 'Wtryskiwacz piezoelektryczny, 200 bar'],
  ['IntakePlenum_Shell', 'Kolektor dolotowy z zaworami rezonansowymi'],
  ['THROTTLE_BODY', 'Przepustnica'],
  ['Exhaust_Collector_A', 'Zbieracz 3-1 banku A'],
  ['Catalyst_A', 'Katalizator z sondami lambda'],
  ['GPF_A', 'Filtr czastek stalych'],
  ['MUFFLER', 'Tlumik siodlowy z klapa wydechu'],
  ['OilPan_Plastic', 'Miska olejowa z tworzywa (o 36,5% lzejsza)'],
  ['OIL_PUMP', 'Pompa oleju o zmiennej wydajnosci'],
  ['OilHeatExchanger', 'Wymiennik olej-woda'],
  ['WATER_PUMP', 'Pompa wody z przelaczaniem'],
  ['THERMOSTAT', 'Termostat sterowany mapa'],
  ['FLYWHEEL_ASSEMBLY', 'Kolo zamachowe dwumasowe i sprzeglo'],
  ['Gearbox_Housing', 'Skrzynia biegow (PDK)'],
  ['Timing_Chain_A', 'Lancuch rozrzadu banku A'],
  ['Accessory_Belt', 'Pasek napedu pomocniczego'],
  ['ALTERNATOR', 'Alternator'],
  ['EngineMount_Front', 'Mocowanie trzypunktowe'],
];
const labels = [];
for (const [name, text] of LABELS) {
  const o = engine.getObjectByName(name);
  if (!o) {
    console.warn('label target missing', name);
    continue;
  }
  const b = new THREE.Box3().setFromObject(o);
  const local = o.worldToLocal(b.getCenter(new THREE.Vector3()));
  labels.push({ el: null, object: o, local, text });
}
const labelOverlay = createLabels(host, camera, labels);

// ------------------------------------------------------------------ hud
const ui = {
  crank: document.getElementById('crank'),
  rpm: document.getElementById('rpm'),
  play: document.getElementById('play'),
  explode: document.getElementById('explode'),
  labels: document.getElementById('labels'),
  cut: document.getElementById('cut'),
  hud: document.getElementById('hud'),
  outCrank: document.getElementById('crankOut'),
  outRpm: document.getElementById('rpmOut'),
  outExplode: document.getElementById('explodeOut'),
  chart: document.getElementById('chart'),
};

const phaseInfo = (cyl, crank) => L.strokeOf(cyl, crank);

function updateHud() {
  if (!ui.hud) return;
  const k = state.rpm > 0 ? (state.rpm * 2 * Math.PI) / 60 : 0;
  const mps = (2 * L.LAYOUT.stroke * state.rpm) / 60 / 1000;
  const cells = L.CYLINDERS.map((c) => {
    const st = phaseInfo(c, state.crank);
    const { s } = L.pistonPinDistance(c, state.crank);
    const li = L.valveLiftCrank(c, 'intake', state.crank);
    const le = L.valveLiftCrank(c, 'exhaust', state.crank);
    const off = state.rpm >= 1600 && state.rpm <= 3000 && (c.bankSign > 0 ? false : true);
    return `<span class="cell${off ? ' off' : ''}"><b>${c.id}${c.bank}</b> ${(s - (L.LAYOUT.rodLength - L.LAYOUT.crankRadius)).toFixed(0)} mm <i>${st.name}</i><br /><em>ss ${li.toFixed(1)} / wy ${le.toFixed(1)} mm</em></span>`;
  }).join('');
  const next = L.FIRING_SEQUENCE.find((c) => {
    const p = (((c.fireAngle - state.crank) % 720) + 720) % 720;
    return p <= 1 || p >= 719;
  });
  ui.hud.innerHTML =
    `<span class="cell">wal <b>${(state.crank % 720).toFixed(0)}°</b> z 720°</span>` +
    `<span class="cell">obroty <b>${state.rpm.toFixed(0)}</b> obr/min</span>` +
    `<span class="cell">predkosc tloka <b>${mps.toFixed(1)}</b> m/s</span>` +
    `<span class="cell">przyspieszenie <b>${(k * k * L.LAYOUT.crankRadius * 1.29 / 1000).toFixed(1)}</b> km/s²</span>` +
    `<span class="cell">zaplon <b>1-6-2-4-3-5</b> ${next ? `teraz cylinder <i>${next.id}</i>` : 'co 120° walu'}</span>` +
    cells;
}

// ------------------------------------------------------------------ chart
const cx = ui.chart?.getContext('2d');
function drawChart() {
  if (!cx) return;
  const w = ui.chart.width;
  const h = ui.chart.height;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = 'rgba(255,255,255,0.035)';
  cx.fillRect(0, 0, w, h);
  const sTop = L.LAYOUT.rodLength + L.LAYOUT.crankRadius;
  const sBot = L.LAYOUT.rodLength - L.LAYOUT.crankRadius;
  const y = (s) => 10 + ((sTop - s) / (sTop - sBot)) * (h - 34);
  const colors = ['#4d8ef7', '#31b98a', '#e2521f', '#d8a437', '#a06bf0', '#39c0d8'];
  L.CYLINDERS.forEach((c, i) => {
    cx.strokeStyle = colors[i];
    cx.lineWidth = 1.5;
    cx.beginPath();
    for (let d = 0; d <= 720; d += 4) {
      const { s } = L.pistonPinDistance(c, d);
      const px = 6 + (d / 720) * (w - 12);
      d ? cx.lineTo(px, y(s)) : cx.moveTo(px, y(s));
    }
    cx.stroke();
  });
  // znaczniki zaplonu
  L.FIRING_SEQUENCE.forEach((c) => {
    const px = 6 + ((c.fireAngle % 720) / 720) * (w - 12);
    cx.strokeStyle = 'rgba(255,255,255,0.22)';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(px, 6);
    cx.lineTo(px, h - 6);
    cx.stroke();
    cx.fillStyle = '#e8ecf1';
    cx.font = '10px system-ui, sans-serif';
    cx.fillText(String(c.id), px + 2, 12);
  });
  // kursor
  const px = 6 + ((state.crank % 720) / 720) * (w - 12);
  cx.strokeStyle = 'rgba(255,255,255,0.75)';
  cx.beginPath();
  cx.moveTo(px, 4);
  cx.lineTo(px, h - 4);
  cx.stroke();
  L.CYLINDERS.forEach((c, i) => {
    const { s } = L.pistonPinDistance(c, state.crank);
    cx.fillStyle = colors[i];
    cx.beginPath();
    cx.arc(px, y(s), 2.4, 0, Math.PI * 2);
    cx.fill();
  });
}

// ------------------------------------------------------------------ composer
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: lq ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
if (!lq) {
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 90;
  ssao.minDistance = 3;
  ssao.maxDistance = 800;
  composer.addPass(ssao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.7, 0.9));
}
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: lq ? 0 : 0.22 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader:
    'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;\n' +
    'void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - amount * smoothstep(0.35, 0.95, d); gl_FragColor = c; }',
});
composer.addPass(vignette);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ ui glue
const syncOut = () => {
  if (ui.outCrank) ui.outCrank.textContent = `${state.crank.toFixed(0)}°`;
  if (ui.outRpm) ui.outRpm.textContent = `${state.rpm.toFixed(0)} obr/min`;
  if (ui.outExplode) ui.outExplode.textContent = state.explode.toFixed(2);
};
ui.crank?.addEventListener('input', () => {
  state.crank = parseFloat(ui.crank.value);
  state.playing = false;
  syncOut();
});
ui.rpm?.addEventListener('input', () => {
  state.rpm = parseFloat(ui.rpm.value);
  syncOut();
});
ui.play?.addEventListener('click', () => {
  state.playing = !state.playing;
  if (ui.play) ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
});
ui.explode?.addEventListener('input', () => {
  state.explode = parseFloat(ui.explode.value);
  applyExplode(state.explode);
  syncOut();
});
ui.cut?.addEventListener('change', (e) => applyCut(e.target.checked));
ui.labels?.addEventListener('change', () => labelOverlay.setVisible(ui.labels.checked));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('keydown', (e) => {
  const keys = { 1: 'os', 2: 'tq', 3: 'bok', 4: 'gora', 5: 'glowica', 6: 'wal', 7: 'wydech', 8: 'miska' };
  if (keys[e.key]) setView(keys[e.key]);
  if (e.key === 'c') applyCut(!state.cut);
});

// ------------------------------------------------------------------ loop
function updateEngine(crankDeg) {
  rot.update(crankDeg);
  updateValvetrain(heads.valvetrain, heads.cams, crankDeg);
}

syncOut();
updateEngine(state.crank);
setView(params.get('view') || 'tq');
// tabela danych katalogowych z podanymi zrodlami
const specTable = document.getElementById('specTable');
if (specTable) {
  specTable.innerHTML = L.SPEC.map(([k, v, s]) => `<tr><td>${k}</td><td class="v">${v}</td><td class="s">${s}</td></tr>`).join('');
}
if (flag('cut')) applyCut(true);
if (params.has('explode')) {
  state.explode = parseFloat(params.get('explode'));
  if (ui.explode) ui.explode.value = String(state.explode);
  applyExplode(state.explode);
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing && state.rpm > 0) {
    state.crank = (state.crank + (state.rpm / 60) * 360 * dt) % 720;
    if (ui.crank) ui.crank.value = String(state.crank);
  }
  updateEngine(state.crank);
  labelOverlay.update();
  controls.update();
  composer.render();
  updateHud();
  drawChart();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ------------------------------------------------------------------ harness
window.__set = (crankDeg, rpm) => {
  state.crank = crankDeg;
  if (rpm !== undefined) state.rpm = rpm;
  state.playing = false;
  if (ui.crank) ui.crank.value = String(crankDeg);
  if (ui.rpm && rpm !== undefined) ui.rpm.value = String(rpm);
  updateEngine(state.crank);
  syncOut();
  updateHud();
  drawChart();
  return window.__stats();
};
window.__setView = setView;
window.__setExplode = (t) => {
  state.explode = t;
  if (ui.explode) ui.explode.value = String(t);
  applyExplode(t);
  syncOut();
};
window.__setCut = applyCut;
window.__camera = camera;
window.__state = state;
window.__engine = engine;
window.__parts = parts;
window.__layout = L;
window.__viewList = () => Object.keys(VIEWS);
window.__stats = () => {
  let meshes = 0;
  let tris = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      if (g?.index) tris += g.index.count / 3;
      else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
    }
  });
  const pistons = {};
  for (const c of parts.rot.recip.cylinders) {
    const d = c.def;
    const { s } = L.pistonPinDistance(d, state.crank);
    const world = new THREE.Vector3();
    c.piston.getWorldPosition(world);
    pistons[`cyl${d.id}`] = {
      bank: d.bank,
      stroke: L.strokeOf(d, state.crank).name,
      pinDist: +s.toFixed(3),
      travel: +(s - (L.LAYOUT.rodLength - L.LAYOUT.crankRadius)).toFixed(3),
      worldX: +world.x.toFixed(3),
      intakeLift: +L.valveLiftCrank(d, 'intake', state.crank).toFixed(3),
      exhaustLift: +L.valveLiftCrank(d, 'exhaust', state.crank).toFixed(3),
    };
  }
  const camDeg = (L.camAngleDeg(state.crank) % 360 + 360) % 360;
  return {
    meshes,
    triangles: Math.round(tris),
    crank: +state.crank.toFixed(2),
    rpm: state.rpm,
    camAngle: +camDeg.toFixed(2),
    camSpeedFactor: 0.5,
    bbox: {
      min: bbox.min.toArray().map((v) => +v.toFixed(1)),
      max: bbox.max.toArray().map((v) => +v.toFixed(1)),
    },
    fitDistance: +FIT.toFixed(1),
    cam: camera.position.toArray().map((v) => +v.toFixed(1)),
    pistons,
    firingOrder: L.LAYOUT.firingOrder.join('-'),
    displacementCm3: +L.sweptVolumeTotal().toFixed(2),
    compressionRatio: +L.compressionRatio().toFixed(3),
    cut: state.cut,
    explode: state.explode,
  };
};
window.__READY = true;
