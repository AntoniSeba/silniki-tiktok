// tiktok-main.js - boot for the vertical 1080x1920 cut: one slow, seamless,
// caption free loop of an exploded V6 that assembles, opens a real section
// through cylinder 1 and idles through the four stroke cycle.
//
// URL params: ?t=12.5 seek and pause | ?lq=1 fast render (no AO/MSAA)
//             ?rec=1 record the loop and download a WebM | ?safe=1 overlay

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor } from './lib/environment.js';
import { buildEngine } from './scene.js';
import { createLabels } from './labels.js';
import { createTikTokDirector, DURATION } from './tiktok.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const lq = params.get('lq') === '1';
const clean = params.get('clean') === '1';
const W = 1080;
const H = 1920;

const stage = document.getElementById('stage');
function fit() {
  const bar = document.querySelector('.bar')?.style.display === 'none' ? 0 : 96;
  const s = Math.min(window.innerWidth / W, (window.innerHeight - bar) / H);
  stage.style.transform = `translate(-50%, -50%) scale(${clean ? 1 : s})`;
}
window.addEventListener('resize', fit);
fit();

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72 * (window.__jasnosc || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.domElement.style.width = `${W}px`;
renderer.domElement.style.height = `${H}px`;
host.appendChild(renderer.domElement);

// Mnoznik jasnosci ustawiany z zewnatrz (window.__jasnosc). Telefon i tak
// wyswietla ciemne ujecia jako czarna plame, wiec podnosimy swiatlo wypelniajace.
const JAS = window.__jasnosc || 1;

const scene = new THREE.Scene();
const { env, background } = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = background;

// ------------------------------------------------------------------ lighting
const key = new THREE.DirectionalLight(0xfffaf2, 1.55 * JAS);
key.position.set(1300, 2200, 1500);
key.castShadow = !lq;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 300;
key.shadow.camera.far = 8000;
key.shadow.camera.left = -1200;
key.shadow.camera.right = 1200;
key.shadow.camera.top = 1200;
key.shadow.camera.bottom = -1200;
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004;
key.shadow.normalBias = 1.8;
key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.3 + 0.85 * (JAS - 1));
fill.position.set(-1800, 900, 1200);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.55 * JAS);
rim.position.set(-600, 1500, -2000);
scene.add(rim);
const bounce = new THREE.DirectionalLight(0xd9c7a8, 0.24 + 0.6 * (JAS - 1));
bounce.position.set(400, -900, 300);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.5 + 0.9 * (JAS - 1)));

// Quiet reflective studio floor: soft environment reflection plus contact
// shadow, so the machine sits on something instead of floating in the void.
const floor = makeStudioFloor(16000);
floor.position.y = -196;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(38, W / H, 80, 20000);
camera.position.set(-1500, 900, 1500);

const M = createMaterials();
for (const k of Object.keys(M)) {
  const m = M[k];
  if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3;
}
const engine = buildEngine(M);
applyMaterialVariation(engine.root, M);
scene.add(engine.root);
const labelOverlay = createLabels(host, camera, engine.labels);

// ------------------------------------------------------------------ clean
// ?clean=1 hides the control bar and pins the stage to 1:1 so the viewport
// capture is exactly the 1080x1920 frame (used by the MP4 renderer).
if (clean) document.querySelector('.bar').style.display = 'none';

// ----------------------------------------------------------------- composer
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: lq ? 0 : 2 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));

// subtle depth of field: focuses on the middle of the machine and lets the far
// and near extremities fall off, which is what makes a 3D render read as film
let bokeh = null;
if (params.get('dof') !== '0') {
  bokeh = new BokehPass(scene, camera, { focus: 3400, aperture: 0.00022, maxblur: 0.0065 });
  bokeh.needsSwap = true;
  composer.addPass(bokeh);
}
if (!lq && params.get('ao') !== '0') {
  const ssao = new SSAOPass(scene, camera, W, H);
  ssao.kernelRadius = 190;
  ssao.minDistance = 40;
  ssao.maxDistance = 1400;
  ssao.output = SSAOPass.OUTPUT.default ?? SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.13, 0.6, 0.94));
composer.addPass(new OutputPass());
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: 0.4 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float r = length((vUv - 0.5)) * 1.45;
        c.rgb *= mix(1.0 - strength, 1.0, smoothstep(1.0, 0.2, r));
        gl_FragColor = c;
      }`,
  })
);
composer.setSize(W, H);

const director = createTikTokDirector({ engine, M, camera });
const DOF_POINT = new THREE.Vector3(0, 190, 0);

// --------------------------------------------------------------- playback
let time = num('t', 0);
let playing = !params.has('t');
let last = performance.now();
const $ = (id) => document.getElementById(id);
const setPlaying = (on) => {
  playing = on;
  $('play').textContent = on ? 'PAUZA' : 'ODTWÓRZ';
};
$('play').addEventListener('click', () => setPlaying(!playing));
$('restart').addEventListener('click', () => {
  time = 0;
  setPlaying(true);
});
$('scrub').addEventListener('input', (e) => {
  time = (parseFloat(e.target.value) / 1000) * DURATION;
  setPlaying(false);
});
if (params.get('safe') === '1') document.body.classList.add('safe-on');
$('safe').checked = params.get('safe') === '1';
$('safe').addEventListener('change', (e) => document.body.classList.toggle('safe-on', e.target.checked));
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    setPlaying(!playing);
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'r') {
    time = 0;
    setPlaying(true);
  }
  if (e.key.toLowerCase() === 's') {
    document.body.classList.toggle('safe-on');
    $('safe').checked = document.body.classList.contains('safe-on');
  }
});

// ------------------------------------------------------------------ export
$('png').addEventListener('click', () => {
  composer.render();
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `v6-tiktok-${time.toFixed(1)}s.png`;
  a.click();
});

function record() {
  const stream = renderer.domElement.captureStream(30);
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16000000 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'v6-tiktok-loop.webm';
    a.click();
    URL.revokeObjectURL(a.href);
    setPlaying(false);
  };
  time = 0;
  setPlaying(true);
  rec.start();
  setTimeout(() => rec.stop(), (DURATION + 0.5) * 1000);
}
$('rec').addEventListener('click', record);
if (params.get('rec') === '1') setTimeout(record, 1500);

// -------------------------------------------------------------------- loop
let frames = 0;
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (playing) time += dt;
  director.update(time);
  labelOverlay.update();
  if (playing) $('scrub').value = String(Math.round(((time % DURATION) / DURATION) * 1000));
  if (bokeh) {
    // keep the focal plane on the machine, wherever the camera has moved to
    bokeh.uniforms['focus'].value = camera.position.distanceTo(DOF_POINT);
  }
  composer.render();
  frames++;
  if (frames === 6) window.__READY = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__labels = labelOverlay;
window.__labelsVisible = (on) => labelOverlay.setVisible(on);
window.__labelsFiltr = (lista) => labelOverlay.setFiltr(lista);
window.__engine = engine;
window.__director = director;
window.__seek = (t) => {
  time = t;
  setPlaying(false);
  // let the damped camera settle before the screenshot
  for (let i = 0; i < 45; i++) director.update(t);
  labelOverlay.update();
  composer.render();
};
window.__stats = () => {
  let n = 0;
  engine.root.traverse((o) => {
    if (o.isMesh) n++;
  });
  return { meshes: n, time, cam: camera.position.toArray().map((v) => Math.round(v)) };
};
