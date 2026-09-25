// tiktok.js - vertical shorts loop, 5 seconds, one complete four-stroke cycle.
//
// The internals are revealed by moving the outer shells away (block casting,
// deck plates, head castings, cam covers, manifolds, covers, pan, flywheel)
// while every mechanism part stays exactly where it belongs and runs the
// cycle in place. No clipping planes, no transparency: nothing can end up as
// a hollow half-cut shell.
//
//   t 0.0-1.0  assembled, slow drift
//   t 1.0-2.2  the shells glide away, mechanism revealed
//   t 2.2-4.0  the four stroke cycle continues, everything visible
//   t 4.0-5.0  the shells glide back, seamless loop
// The crank covers exactly 720 deg across the five seconds, so the loop is
// perfectly continuous.

import * as THREE from 'three';
import { CYLINDERS, cycleAngle, lift, camRotation, LAYOUT } from './lib/layout.js';

export const DURATION = 15;
const T_OPEN_A = 2.6;
const T_OPEN_B = 7.8;   // five slow seconds of disassembly
const T_CLOSE_A = 11.6;
const T_CLOSE_B = 14.2;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const smoother = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a, b, t) => a + (b - a) * t;

export function createTikTokDirector({ engine, M, camera }) {
  const { BUCKET_TOP, BUCKET_H } = engine.heads.constants;
  const focus = engine.focus;

  // ---------------------------------------------------------- shell reveal
  // Each entry: object + the offset that gets it out of the way, expressed in
  // that object's own parent space.
  const byName = (n) => engine.root.getObjectByName(n);
  const shells = [];
  const addShell = (obj, ox, oy, oz) => {
    if (!obj) return;
    shells.push({ obj, home: obj.position.clone(), offset: new THREE.Vector3(ox, oy, oz) });
  };

  addShell(byName('CylinderBlock_Casting'), 0, -560, -120);
  for (const bank of ['L', 'R']) {
    addShell(byName(`Block_DeckPlate_${bank}`), 0, bank === 'R' ? 420 : 420, 0);
    addShell(byName(`CylinderHead_${bank}`), 0, 430, 0); // bank-local +Y = outboard
    const cover = engine.heads.root.getObjectByName(`CAM_COVER_${bank}`);
    if (cover) {
      // cam cover group is rotated with the bank, so move it along its own +Y
      cover.userData.home = cover.position.clone();
      shells.push({
        obj: cover,
        home: cover.position.clone(),
        offset: new THREE.Vector3(0, 430, 0),
        local: true,
        bank,
      });
    }
  }
  addShell(engine.intake.root, 0, 360, 0); // carries the throttle body with it
  addShell(byName('HEADER_L'), -400, 130, 0);
  addShell(byName('HEADER_R'), 400, 130, 0);
  addShell(byName('TIMING_COVER'), 0, 120, 380);
  addShell(byName('OIL_PAN_ASSEMBLY'), 0, -300, -60);

  const baseOf = new Map();
  engine.root.updateMatrixWorld(true);
  shells.forEach((s, i) => {
    baseOf.set(s.obj, s.home.clone());
    s.box = new THREE.Box3().setFromObject(s.obj);
    s.factor = 0;
    // stagger: the block and pan go first, the covers and manifolds last, so
    // the reveal reads as a sequence instead of one rigid block
    s.delay = (i / Math.max(1, shells.length - 1)) * 0.45;
  });

  function applyShells(reveal) {
    for (const s of shells) {
      const home = baseOf.get(s.obj);
      const local = smoother((reveal - s.delay) / (1 - s.delay || 1));
      s.factor = local;
      s.obj.position.copy(home).addScaledVector(s.offset, local);
    }
  }

  // Extents of the machine right now, from the precomputed boxes shifted by
  // however far each shell has travelled. Cheap, and it means the camera can
  // breathe with the reveal instead of sitting at a fixed safe distance.
  const currentBox = new THREE.Box3();
  const shifted = new THREE.Box3();
  function measure() {
    currentBox.copy(boxBase);
    for (const s of shells) {
      shifted.copy(s.box);
      shifted.min.addScaledVector(s.offset, s.factor);
      shifted.max.addScaledVector(s.offset, s.factor);
      currentBox.union(shifted);
    }
    return currentBox;
  }

  // ------------------------------------------------------------ valve motion
  function setValves(crank) {
    for (const vt of engine.valvetrain) {
      const cyl = CYLINDERS.find((c) => c.id === vt.cylId);
      const phase = cycleAngle(cyl, crank);
      const l = lift(vt.which, phase);
      vt.bucket.position.y = BUCKET_TOP - l - BUCKET_H / 2;
      vt.retainer.position.y = BUCKET_TOP - BUCKET_H - 2 - l;
      vt.stem.position.y = 250 - l;
      vt.vhead.position.y = LAYOUT.deckHeight - 4 - l;
      vt.spring.position.y = vt.springSeat;
      vt.spring.scale.y = Math.max(0.35, (60 - l) / vt.springFree);
    }
    const a = camRotation(crank) * (Math.PI / 180);
    for (const bank of ['L', 'R']) engine.heads.heads[bank].cam.rotation.z = a;
  }

  function setGas(phase) {
    const m = engine.charge.material;
    const p = phase;
    if (p < 180) {
      m.color.setHex(0x6cb0ff);
      m.opacity = lerp(0.07, 0.22, p / 180);
    } else if (p < 350) {
      m.color.setHex(0x8ecbff);
      m.opacity = lerp(0.24, 0.4, (p - 180) / 170);
    } else if (p < 420) {
      m.color.lerpColors(new THREE.Color(0xffc98a), new THREE.Color(0xff8a3c), (p - 350) / 70);
      m.opacity = lerp(0.6, 0.38, (p - 350) / 70);
    } else if (p < 540) {
      m.color.lerpColors(new THREE.Color(0xff8a3c), new THREE.Color(0x9a8b7c), (p - 420) / 120);
      m.opacity = lerp(0.34, 0.18, (p - 420) / 120);
    } else {
      m.color.lerpColors(new THREE.Color(0x9aa0a6), new THREE.Color(0x71767b), (p - 540) / 180);
      m.opacity = lerp(0.2, 0.05, (p - 540) / 180);
    }
  }

  // ------------------------------------------------------------- framing
  engine.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  engine.root.traverse((o) => {
    if (o.isMesh && o.visible) box.expandByObject(o);
  });
  const boxBase = box.clone();
  const boxOpen = box.clone();
  for (const s of shells) {
    const b = new THREE.Box3().setFromObject(s.obj);
    boxOpen.union(new THREE.Box3(b.min.clone().add(s.offset), b.max.clone().add(s.offset)));
  }
  const size = box.getSize(new THREE.Vector3());
  const sizeOpen = boxOpen.getSize(new THREE.Vector3());
  // widest state = shells out; keep a fixed comfortable distance so the camera
  // never crops and never jitters while the shells move
  const FOV_V = 38;
  camera.fov = FOV_V;
  camera.updateProjectionMatrix();
  const HALF_W = Math.tan((FOV_V / 2) * (Math.PI / 180)) * (1080 / 1920);
  const HALF_H = Math.tan((FOV_V / 2) * (Math.PI / 180));
  // Exact framing: place a trial camera, project the eight corners of the
  // current bounding box, and correct the distance until the worst corner uses
  // at most 90 percent of the frame. No part can ever leave the frame, even
  // when a shell swings toward the lens.
  const corners = [];
  const probe = new THREE.Vector3();
  function fitDistanceExact(b, az, elev, target, start) {
    b.getSize(tmpSize);
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    const c = b.getCenter(tmpCenter);
    const hx = tmpSize.x / 2;
    const hy = tmpSize.y / 2;
    const hz = tmpSize.z / 2;
    corners.length = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(new THREE.Vector3(c.x + sx * hx, c.y + sy * hy, c.z + sz * hz));
    let d = start;
    for (let it = 0; it < 5; it++) {
      camera.position.copy(target).addScaledVector(dir, d);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let worst = 0;
      for (const p of corners) {
        probe.copy(p).project(camera);
        worst = Math.max(worst, Math.abs(probe.x), Math.abs(probe.y));
      }
      if (worst < 1e-4) break;
      d *= worst / 0.93;
    }
    return d;
  }
  const tmpSize = new THREE.Vector3();
  const TARGET = new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.getCenter(new THREE.Vector3()).y, 0);

  const smoothPos = new THREE.Vector3();
  const smoothTarget = TARGET.clone();
  const tmpCenter = new THREE.Vector3();
  let smoothDist = 3000;
  let first = true;

  function update(time) {
    const el = time % DURATION;

    // ---------------------------------------------------------------- tryb ujecia
    // Gdy ustawione jest window.__ujecie, rezyser nie odtwarza petli otwierania
    // i zamykania. Trzyma zadany poziom otwarcia i przesuwa wal korbowy tylko
    // przez zadany zakres suwu, a kamera bierze sie z ustawien ujecia. Dzieki
    // temu kazde ujecie pokazuje inna czynnosc i nie powtarza poprzedniego.
    const uj = window.__ujecie;
    if (uj) {
      const p = clamp01(typeof uj.postep === 'number' ? uj.postep : 0);
      applyShells(typeof uj.reveal === 'number' ? uj.reveal : 1);

      const crank = lerp(uj.crankOd ?? 0, uj.crankDo ?? 720, p);
      engine.updateCrank(crank);
      setValves(crank);

      const phase = cycleAngle(focus, crank);
      engine.charge.visible = uj.gaz !== false;
      if (engine.charge.visible) setGas(phase);
      engine.ring.visible = uj.iskra !== false;
      engine.ring.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(crank * 0.05);

      const azU = uj.az ?? -0.9;
      const elevU = uj.elev ?? 0.22;
      const cbU = measure();
      cbU.getCenter(tmpCenter);
      smoothTarget.copy(tmpCenter);
      if (typeof uj.tx === 'number') smoothTarget.x = uj.tx;
      if (typeof uj.ty === 'number') smoothTarget.y = uj.ty;
      if (typeof uj.tz === 'number') smoothTarget.z = uj.tz;

      const dopasuj = fitDistanceExact(cbU, azU, elevU, smoothTarget, 3000);
      // dystans wprost pozwala wejsc kamera na sam cylinder. Bez tego kamera
      // zawsze obejmuje caly silnik, a ruch tloka to wtedy dwa procent kadru.
      const distU = typeof uj.dystans === 'number' ? uj.dystans : dopasuj * (uj.zoom ?? 1);
      camera.position.set(
        smoothTarget.x + Math.cos(azU) * Math.cos(elevU) * distU,
        smoothTarget.y + Math.sin(elevU) * distU,
        smoothTarget.z + Math.sin(azU) * Math.cos(elevU) * distU
      );
      camera.lookAt(smoothTarget);
      camera.updateMatrixWorld();

      return { reveal: uj.reveal ?? 1, crank, phase, el };
    }

    // ---- shell reveal
    let reveal;
    if (el < T_OPEN_A) reveal = 0;
    else if (el < T_OPEN_B) reveal = smoother((el - T_OPEN_A) / (T_OPEN_B - T_OPEN_A));
    else if (el < T_CLOSE_A) reveal = 1;
    else reveal = 1 - smoother((el - T_CLOSE_A) / (T_CLOSE_B - T_CLOSE_A));
    applyShells(reveal);

    // ---- one full four stroke cycle across the loop
    const crank = (el / DURATION) * 1440; // two complete cycles per loop
    engine.updateCrank(crank);
    setValves(crank);

    const phase = cycleAngle(focus, crank);
    engine.charge.visible = reveal > 0.35 && el < T_CLOSE_A + 1.4;
    if (engine.charge.visible) setGas(phase);
    engine.ring.visible = reveal > 0.35 && el < T_CLOSE_A + 1.6;
    engine.ring.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(el * 3.4);

    // ---- cinematic camera: a long, slow arc, damped, one full turn per loop
    // so the sequence can repeat without a cut.
    const turn = (el / DURATION) * Math.PI * 2;
    const az = -0.72 + turn + Math.sin(turn * 2) * 0.05;
    const elev = 0.215 + 0.045 * Math.sin(turn * 2 - 0.7) + 0.02 * reveal;
    const cb = measure();
    cb.getCenter(tmpCenter);
    smoothTarget.lerp(tmpCenter, 0.16);
    const want = fitDistanceExact(cb, az, elev, smoothTarget, smoothDist);
    smoothDist += (want - smoothDist) * 0.25;
    const dist = smoothDist;
    const desired = new THREE.Vector3(
      smoothTarget.x + Math.cos(az) * Math.cos(elev) * dist,
      smoothTarget.y + Math.sin(elev) * dist,
      smoothTarget.z + Math.sin(az) * Math.cos(elev) * dist
    );
    if (first) {
      smoothPos.copy(desired);
      first = false;
    } else {
      smoothPos.lerp(desired, 0.1);
    }
    camera.position.copy(smoothPos);
    camera.lookAt(smoothTarget);
    camera.updateMatrixWorld();
    {
      // bias the composition up and left, into the TikTok safe area
      const halfH = dist * Math.tan((FOV_V / 2) * (Math.PI / 180));
      const halfW = halfH * (1080 / 1920);
      const viewDir = new THREE.Vector3().subVectors(smoothTarget, smoothPos).normalize();
      const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();
      const shift = right.clone().multiplyScalar(0.03 * halfW).addScaledVector(up, -0.05 * halfH);
      camera.position.add(shift);
      camera.lookAt(smoothTarget.clone().add(shift));
      camera.updateMatrixWorld();
    }

    return { reveal, crank, phase, el };
  }

  return { update, DURATION, setValves };
}
