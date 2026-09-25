// verify.mjs - numeric checks on the 2JZ-GTE model. Every number printed here is
// computed from the same constants and formulas the browser uses
// (src/lib/engine.js), so it is a measurement of the model, not of a spec sheet.
//
//   node verify.mjs
//
import * as E from './src/lib/engine.js';

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) fails++;
  return cond ? 'OK  ' : 'FAIL';
};
const f = (v, n = 3) => Number(v).toFixed(n);

console.log('=== 2JZ-GTE :: weryfikacja liczbowa modelu ===');
console.log('SPEC:', JSON.stringify({ bore: E.SPEC.bore, stroke: E.SPEC.stroke, cyl: E.SPEC.cylinders, rod: E.SPEC.rodLength, deck: E.SPEC.deckHeight, cr: E.SPEC.compressionRatio }));

// ---------------------------------------------------------------- 1. pojemność
const V = E.sweptVolumeCc();
const Vspec = 86.0 ** 2 * (Math.PI / 4) * 86.0 * 6 / 1000;
console.log('\n[1] Pojemnosc skokowa z geometrii');
console.log(`    pi/4 * ${E.SPEC.bore}^2 * ${E.SPEC.stroke} * ${E.SPEC.cylinders} = ${f(V, 2)} cm3`);
console.log(`    odczyt producenta 2997 cm3 -> blad ${f(Math.abs(V - 2997), 2)} cm3 (${f((Math.abs(V - 2997) / 2997) * 100, 3)} %)`);
console.log(`    ${ok(Math.abs(V - 2997) < 1, 'pojemnosc')} pojemnik na cylinder ${f(E.sweptVolumePerCylinderCc(), 2)} cm3`);

// ---------------------------------------------------------------- 2. tłok
console.log('\n[2] Kinematyka tloka: skok, GMP/DMP, korbowod');
let strokeMin = Infinity;
let strokeMax = -Infinity;
let tdcAngleMeasured = 0;
for (let a = 0; a < 720; a += 0.01) {
  const y = E.pistonPinY(a, 1);
  if (y < strokeMin) strokeMin = y;
  if (y > strokeMax) {
    strokeMax = y;
    tdcAngleMeasured = a;
  }
}
console.log(`    cylinder 1: pin min = ${f(strokeMin)} mm, pin max = ${f(strokeMax)} mm`);
console.log(`    skok zmierzony = ${f(strokeMax - strokeMin)} mm, skok katalogowy = ${f(E.SPEC.stroke)} mm`);
console.log(`    GMP przy kacie walu ${f(tdcAngleMeasured, 2)} deg (katalog: ${f(E.tdcAngle(1), 2)} deg + n*360)`);
console.log(`    korbowod/corner: promien korby ${f(E.CRANK_R)} mm, korbowod ${f(E.ROD_L)} mm, maks. odchylenie korbowodu ${f(E.rodObliquityMaxDeg(), 3)} deg`);
console.log(`    ${ok(Math.abs(strokeMax - strokeMin - E.SPEC.stroke) < 1e-6, 'skok')} skok = 86.000 mm co do 1e-6`);

// TDC / BDC tables for all six
console.log('    cyl | offset czopa | GMP czopa (0..360) | faza zaplonu (0..720) | kat korbowodu w GMP');
for (let c = 1; c <= 6; c++) {
  let best = -Infinity;
  let bestA = 0;
  for (let a = 0; a < 720; a += 0.01) {
    const y = E.pistonPinY(a, c);
    if (y > best) {
      best = y;
      bestA = a;
    }
  }
  console.log(`      ${c}  |   ${String(E.pinOffsetDeg(c)).padStart(3)} deg    |      ${f(bestA, 2)} deg      |       ${String(E.firePhaseDeg(c)).padStart(3)} deg        |    ${f(E.rodAngleDeg(bestA, c), 3)} deg`);
}

// ---------------------------------------------------------------- 3. kolejność zapłonu
console.log('\n[3] Kolejnosc zaplonu 1-5-3-6-2-4 z faz czopow korby');
const order = [...Array(6).keys()].map((i) => i + 1).sort((a, b) => E.firePhaseDeg(a) - E.firePhaseDeg(b));
const gaps = order.map((c, i) => (E.firePhaseDeg(order[(i + 1) % 6]) - E.firePhaseDeg(c) + 720) % 720);
console.log(`    kolejnosc z faz GMP-sprezania: ${order.join('-')}`);
console.log(`    odstepy zaplonow: ${gaps.map((g) => f(g, 1)).join(', ')} deg`);
console.log(`    ${ok(order.join('-') === '1-5-3-6-2-4', 'kolejnosc')} kolejnosc = 1-5-3-6-2-4`);
console.log(`    ${ok(gaps.every((g) => Math.abs(g - 120) < 1e-9), 'rownomiernosc')} wszystkie odstepy 120 deg (rownomierny zaplon R6)`);
console.log(`    czopy korby (offset katowy): ${E.PIN_OFFSET_DEG.map((o) => ((o % 360) + 360) % 360).join(', ')} deg`);
console.log(`    ${ok(E.PIN_OFFSET_DEG[0] === E.PIN_OFFSET_DEG[5] && E.PIN_OFFSET_DEG[1] === E.PIN_OFFSET_DEG[4] && E.PIN_OFFSET_DEG[2] === E.PIN_OFFSET_DEG[3], 'czopy')} pary czopow 1-6, 2-5, 3-4 zgodne z walem R6`);

// ---------------------------------------------------------------- 4. wałki 1/2
console.log('\n[4] Rozrzad: predkosc walkow = 1/2 predkosci walu');
const dTheta = 1e-4;
console.log(`    d(cam)/d(crank) numerycznie = ${f((E.camAngleDeg(360 + dTheta) - E.camAngleDeg(360 - dTheta)) / (2 * dTheta), 6)}`);
console.log(`    kat walka przy 720 deg walu = ${f(E.camAngleDeg(720 - 1e-6), 4)} deg = 1 pelny obrot (360 mod 360)`);
let ratioOK = true;
for (let a = 0; a < 720; a += 0.37) {
  const r = ((E.camAngleDeg(a + 0.25) - E.camAngleDeg(a)) + 360) % 360 / 0.25;
  if (Math.abs(r - 0.5) > 1e-9) ratioOK = false;
}
console.log(`    ${ok(ratioOK, 'polowa predkosci')} na calym cyklu 0..720 deg stosunek wynosi dokladnie 0.5`);
const lobes = E.camLobePoints(E.SPEC.camBaseR, 720, 'in').map((p) => Math.hypot(p[0], p[1]));
console.log(`    profil krzywki: promien bazowy ${f(Math.min(...lobes))} mm, maks ${f(Math.max(...lobes))} mm, wynioslosc ${f(Math.max(...lobes) - Math.min(...lobes))} mm`);

// ---------------------------------------------------------------- 5. rozrząd vs zapłon
console.log('\n[5] Rozrzad 24v: wzniosy zaworow i zgodnosc z kolejnoscia zaplonu');
function events(cyl, which) {
  // collect every lift event in a window wide enough that no event is cut in
  // half, then report the one whose peak falls inside the first cycle
  const evs = [];
  let open = null;
  let peak = 0;
  let peakA = 0;
  for (let a = -420; a < 1500; a += 0.05) {
    const l = E.valveLiftMm(a, cyl, which);
    if (l > 0 && open === null) {
      open = a;
      peak = 0;
    }
    if (l > peak) {
      peak = l;
      peakA = a;
    }
    if (l === 0 && open !== null) {
      evs.push({ open, close: a, peak, nose: peakA });
      open = null;
    }
  }
  const norm = (x) => ((x % 720) + 720) % 720;
  const ev = evs.find((e) => e.nose >= 0 && e.nose < 720) || evs[0];
  return { open: norm(ev.open), close: norm(ev.open) + (ev.close - ev.open), peak: ev.peak, peakA: norm(ev.nose), dur: ev.close - ev.open };
}
// the firing order is a cycle, so any rotation of it is the same sequence
const rotations = (arr) => arr.map((_, i) => arr.slice(i).concat(arr.slice(0, i)).join('-'));
console.log('    cyl | ssacy: otwarcie -> zamkniecie (deg walu) | szczyt | wydech: otwarcie -> zamkniecie | szczyt');
for (let c = 1; c <= 6; c++) {
  const i = events(c, 'in');
  const e = events(c, 'ex');
  console.log(
    `      ${c}  |   ${f(i.open, 1)} -> ${f(i.close, 1)}  (${f(i.dur, 1)} deg)  |  ${f(i.peak, 2)} mm @ ${f(i.peakA, 1)}  |   ${f(e.open, 1)} -> ${f(e.close, 1)}  (${f(e.dur, 1)} deg)  |  ${f(e.peak, 2)} mm @ ${f(e.peakA, 1)}`
  );
}
const noseOrderIn = [...Array(6).keys()].map((i) => i + 1).sort((a, b) => E.valveNoseDeg(a, 'in') - E.valveNoseDeg(b, 'in'));
const noseOrderEx = [...Array(6).keys()].map((i) => i + 1).sort((a, b) => E.valveNoseDeg(a, 'ex') - E.valveNoseDeg(b, 'ex'));
const noseAngles = noseOrderIn.map((c) => E.valveNoseDeg(c, 'in'));
const noseGaps = noseAngles.map((a, i) => ((noseAngles[(i + 1) % 6] - a) + 720) % 720);
console.log(`    kolejnosc szczytow zaworow ssacych     : ${noseOrderIn.join('-')} (cykl, start dowolny)`);
console.log(`    kolejnosc szczytow zaworow wydechowych: ${noseOrderEx.join('-')} (cykl, start dowolny)`);
console.log(`    odstepy szczytow ssacych: ${noseGaps.map((g) => f(g, 1)).join(', ')} deg`);
console.log(`    dopuszczalne rotacje kolejnosci zaplonu: ${rotations([1, 5, 3, 6, 2, 4]).join(' | ')}`);
console.log(`    ${ok(rotations([1, 5, 3, 6, 2, 4]).includes(noseOrderIn.join('-')) && rotations([1, 5, 3, 6, 2, 4]).includes(noseOrderEx.join('-')), 'rozrzad')} rozrzad biegnie ta sama cykliczna kolejnosc co zaplon`);
console.log(`    ${ok(noseGaps.every((g) => Math.abs(g - 120) < 1e-9), 'rozstaw')} szczyt kazdego zaworu 120 deg po poprzednim`);
const i1 = events(1, 'in');
const e1 = events(1, 'ex');
console.log(`    cylinder 1: ssanie od ${f(i1.open, 1)} deg (GMP = 360, DMP = 540) -> ${f(i1.close, 1)} deg = ${f(360 - i1.open, 1)} deg przed GMP, ${f(i1.close - 540, 1)} deg za DMP`);
console.log(`    cylinder 1: wydech od ${f(e1.open, 1)} deg (DMP = 180, GMP = 360) -> ${f(e1.close, 1)} deg = ${f(180 - e1.open, 1)} deg przed DMP, ${f(e1.close - 360, 1)} deg za GMP`);
console.log(`    ${ok(Math.abs(i1.peak - E.SPEC.valveLift) < 1e-9, 'wznios')} maks. wznios = ${f(i1.peak)} mm = spec ${E.SPEC.valveLift} mm, 24 zawory (${E.SPEC.valvesPerCylinder} na cylinder x 6)`);

// ---------------------------------------------------------------- 6. zawór vs tłok
console.log('\n[6] Kolizja zawor-tlok');
let minClear = Infinity;
let minAt = null;
for (let c = 1; c <= 6; c++) {
  for (const w of ['in', 'ex']) {
    for (let a = 0; a < 720; a += 0.05) {
      const gap = E.valveHeadBottomY(a, c, w) - E.pistonCrownY(a, c);
      if (gap < minClear) {
        minClear = gap;
        minAt = { c, w, a };
      }
    }
  }
}
console.log(`    najmniejsza odleglosc dolnej krawedzi zaworu od korony tloka = ${f(minClear)} mm`);
console.log(`    wystapila: cylinder ${minAt.c}, zawor ${minAt.w === 'in' ? 'ssacy' : 'wydechowy'}, kat walu ${f(minAt.a, 2)} deg`);
console.log(`    wznios przy GMP cylindra 1 (kat 360): ssacy ${f(E.valveLiftMm(360, 1, 'in'), 4)} mm, wydechowy ${f(E.valveLiftMm(360, 1, 'ex'), 4)} mm`);
console.log(`    ${ok(minClear > 0, 'kolizja')} brak kolizji w calym cyklu, luz dodatni`);

// ---------------------------------------------------------------- 7. stopień sprężania
console.log('\n[7] Stopien sprezania z zamodelowanych objetosci komory');
const vc = E.chamberVolumeCc();
const recess = Math.PI * (E.SPEC.bore / 2) ** 2 * E.L.chamberDepth / 1000;
const dish = Math.PI * (E.CHAMBER.dishDia / 2) ** 2 * E.CHAMBER.dishDepth / 1000;
const cr = E.compressionRatio();
console.log(`    wglebienie w glowicy ${E.SPEC.bore} x ${E.L.chamberDepth} mm = ${f(recess, 2)} cm3`);
console.log(`    wytloczenie w tloku  ${E.CHAMBER.dishDia} x ${E.CHAMBER.dishDepth} mm = ${f(dish, 2)} cm3`);
console.log(`    luz nad tlokiem ${E.CHAMBER.clearance} mm = ${f(Math.PI * (E.SPEC.bore / 2) ** 2 * E.CHAMBER.clearance / 1000, 2)} cm3`);
console.log(`    uszczelka ${E.CHAMBER.gasketBore} x ${E.CHAMBER.gasketThickness} mm = ${f(Math.PI * (E.CHAMBER.gasketBore / 2) ** 2 * E.CHAMBER.gasketThickness / 1000, 2)} cm3`);
console.log(`    objetosc komory razem = ${f(vc, 2)} cm3`);
console.log(`    CR = (${f(E.sweptVolumePerCylinderCc(), 2)} + ${f(vc, 2)}) / ${f(vc, 2)} = ${f(cr, 3)} : 1, katalog 8.5 : 1`);
console.log(`    ${ok(Math.abs(cr - 8.5) < 0.05, 'CR')} blad ${f(Math.abs(cr - 8.5), 4)}`);

// ---------------------------------------------------------------- 8. turbo
console.log('\n[8] Turbo: spool, wastegate, predkosc wirnika');
console.log('    obr/min | doladowanie bar | spool bar | wastegate | obroty wirnika | kat walka');
for (const rpm of [0, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7200]) {
  console.log(
    `     ${String(rpm).padStart(4)}   |      ${f(E.boostBar(rpm), 3)}      |   ${f(E.rawBoostBar(rpm), 3)}   |   ${f(E.wastegateOpen(rpm) * 100, 1)} %   |   ${String(Math.round(E.turboRpm(rpm))).padStart(6)}     | ${f(E.camAngleDeg(rpm * 0.1), 1)} deg`
  );
}
console.log(`    ${ok(E.wastegateOpen(1500) === 0, 'wg zamkniety')} wastegate zamkniety na niskich obrotach (1500 obr/min)`);
console.log(`    ${ok(E.wastegateOpen(6000) === 1 && E.wastegateOpen(7200) === 1, 'wg otwarty')} wastegate otwarty przy pelnym doladowaniu (6000 i 7200 obr/min)`);
console.log(`    ${ok(E.boostBar(7200) === E.SPEC.boostTargetBar, 'target')} doladowanie ograniczone do ${E.SPEC.boostTargetBar} bar przez wastegate`);
const sprocketR = E.L.camSprocketR / E.L.crankSprocketR;
const sprocketT = E.L.camTeeth / E.L.crankTeeth;
console.log(`    kolka rozrzadu: wal ${E.L.crankTeeth} zebow (r=${E.L.crankSprocketR} mm) -> walki ${E.L.camTeeth} zebow (r=${E.L.camSprocketR} mm)`);
console.log(`    ${ok(sprocketR === 2 && sprocketT === 2, 'przelozenie')} przelozenie zebow ${sprocketT} : 1 i promieni ${sprocketR} : 1 = polowa predkosci walka`);

// ---------------------------------------------------------------- 9. układ/scena
console.log('\n[9] Geometria ukladu (mm)');
console.log(`    rozstaw cylindrow ${E.SPEC.boreSpacing} mm, X cylindra 1..6: ${E.CYL_X.map((x) => f(x, 0)).join(', ')}`);
console.log(`    dlugosc bloku ${f(E.L.blockXRear - E.L.blockXFront)} mm, wysokosc od osi korby do pokrywy ${f(E.L.coverTopY)} mm`);
console.log(`    os walka rozrzadu ${f(E.L.camY)} mm nad osia korby, promien bazowy ${f(E.SPEC.camBaseR)} mm, gniazdo zaworu ${f(E.L.valveSeatY)} mm`);
console.log(`    promien korby ${f(E.CRANK_R)} + korbowod ${f(E.ROD_L)} + wysokosc tloka do GMP ${f(E.PISTON_CROWN_ABOVE_PIN)} = ${f(E.CRANK_R + E.ROD_L + E.PISTON_CROWN_ABOVE_PIN)} mm = plaszczyzna glowicy ${f(E.L.deckY)} mm minus luz`);
console.log(`    ${ok(Math.abs(E.CRANK_R + E.ROD_L + E.PISTON_CROWN_ABOVE_PIN + 0.5 - E.L.deckY) < 1e-9, 'deck')} lancuch wysokosci GMP zgadza sie z wysokoscia plaszczyzny glowicy`);

console.log(`\n=== ${fails === 0 ? 'WSZYSTKIE TESTY PRZESZLY' : fails + ' TESTOW NIE PRZESZLO'} (${fails} fail) ===`);
process.exit(fails === 0 ? 0 : 1);
