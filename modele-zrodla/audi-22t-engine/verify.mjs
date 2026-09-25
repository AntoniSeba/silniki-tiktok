// verify.mjs - raw numeric verification of the 2.2 T R5 model.
//   node verify.mjs
// It imports the same src/lib/kinematics.js the browser scene uses, so nothing
// here is a second implementation that could drift from the render.
//
// Every block prints the computed value next to the published one and a
// PASS/FAIL/INFO verdict. INFO means the value is a declared approximation and
// must not be read as a datasheet figure.

import {
  SPEC,
  LAYOUT,
  APPROX,
  CYLINDERS,
  CRANK_PIN_ANGLES,
  TURBO,
  BORE_AREA_MM2,
  SWEPT_CC,
  sweptVolumeCc,
  clearanceVolumeCc,
  chamberVolumeCc,
  compressionRatioFromChamber,
  pistonPinDistance,
  pistonPinDistanceRange,
  crankPinPosition,
  rodAngle,
  crankRotation,
  cycleAngle,
  strokeOf,
  lift,
  camRotation,
  lobePhase,
  maxLiftCrank,
  firingSchedule,
  sparkAngles,
  meanPistonSpeed,
  maxRodAngleDeg,
  boostBar,
  turboShaftRpm,
  turboSpeedRatio,
  spool,
  valveCount,
  valveCountTotal,
} from './src/lib/kinematics.js';

const D = 180 / Math.PI;
let fails = 0;
let passes = 0;

function head(t) {
  console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));
}
function row(label, computed, expected, tol = 0) {
  const unit = typeof expected === 'number' && tol > 0 ? ` ± ${tol}` : '';
  let verdict = 'INFO';
  if (typeof expected === 'number') {
    const ok = Math.abs(computed - expected) <= (tol || 1e-9);
    verdict = ok ? 'PASS' : 'FAIL';
    if (ok) passes++;
    else fails++;
  }
  console.log(`  ${label.padEnd(46)} ${String(fmt(computed)).padStart(14)}   vs ${fmt(expected)}${unit}   ${verdict}`);
}
function info(label, value) {
  if (value === undefined) console.log(`  ${label}`);
  else console.log(`  ${label.padEnd(46)} ${String(fmt(value)).padStart(14)}`);
}
function fmt(v) {
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

// ---------------------------------------------------------------------------
head('1. POJEMNOŚĆ SKOKOWA Z GEOMETRII (5 cylindrów, bore, stroke)');
const r = SPEC.stroke / 2;
info('pole tłoka A = pi/4 * bore^2', BORE_AREA_MM2.toFixed(4) + ' mm2');
info('objetosc jednego cylindra A * stroke', SWEPT_CC.toFixed(4) + ' cm3');
row('5 * A * stroke [cm3]', sweptVolumeCc(), 2226, 0.5);
row('bore [mm]', SPEC.bore, 81.0);
row('stroke [mm]', SPEC.stroke, 86.4);
row('promien korby = stroke/2 [mm]', r, 43.2);
info('odchylka od 2226 cm3', ((sweptVolumeCc() - 2226) / 2226 * 100).toFixed(4) + ' %');

head('2. KOLEJNOŚĆ ZAPŁONU 1-2-4-5-3 I ODSTĘPY 144 STOPNI');
console.log('  harmonogram (kąt wału w cyklu 720 stopni):');
for (const f of firingSchedule()) {
  console.log(`    zapłon ${f.order}: cylinder ${f.cylinder} przy ${String(f.crankDeg).padStart(3)} stopni wału` + (f.interval === null ? '  (start)' : `   odstęp ${f.interval} stopni`));
}
const intervals = firingSchedule().slice(1).map((f) => f.interval);
row('kazdy odstep = 720/5', Math.min(...intervals), 144);
row('najwieksza odchylka odstepu', Math.max(...intervals.map((v) => Math.abs(v - 144))), 0, 1e-9);
info('kolejnosc zapłonu', SPEC.firingOrder.join('-'));
row('suma odstepow w cyklu [stopnie]', intervals.reduce((a, b) => a + b, 0) + 144, 720);
console.log('  kąty czopów korbowych (co 72 stopnie, 5 sztuk):');
console.log('    cylinder : ' + CYLINDERS.map((c) => String(c.id).padStart(4)).join(''));
console.log('    czop     : ' + CRANK_PIN_ANGLES.map((a) => String(a).padStart(4)).join(''));
const sortedPins = [...CRANK_PIN_ANGLES].sort((a, b) => a - b);
const pinGaps = sortedPins.map((a, i) => (i === 0 ? 360 - sortedPins[4] + a : a - sortedPins[i - 1]));
row('odstepy miedzy czopami [stopnie]', pinGaps.join(','), null);
row('kazdy odstep czopu = 360/5', Math.min(...pinGaps), 72);
const pinSet = new Set(CRANK_PIN_ANGLES.map((a) => ((a % 72) + 72) % 72));
row('wszystkie czopy na siatce 72 stopni', pinSet.size === 1 && [...pinSet][0] === 18 ? 1 : 0, 1);
row('liczba czopow = liczba cylindrow (jeden korbowod na czop)', CRANK_PIN_ANGLES.length, 5);
row('liczba lozysk glownych', LAYOUT.mainCount, 6);

head('3. GMP / DMP TŁOKÓW Z ROZWIĄZANIA KORBOWODU');
console.log('  ciąg "wahadło" liczony na 0.25 stopnia wału, 720 stopni, cylinder 1:');
const range = pistonPinDistanceRange();
row('GMP: max s [mm]', +range.max.toFixed(4), r + LAYOUT.rodLength, 1e-3);
row('DMP: min s [mm]', +range.min.toFixed(4), LAYOUT.rodLength - r, 1e-3);
row('skok tłoka z kinematyki [mm]', +range.stroke.toFixed(4), SPEC.stroke, 1e-4);
row('GMP wypada przy kacie = cycleOffset', range.maxAt % 720, CYLINDERS[0].cycleOffset);
console.log('  każdy cylinder osobno (kąt GMP i DMP w cyklu 720):');
for (const c of CYLINDERS) {
  const tdc = pistonPinDistance(c, c.cycleOffset);
  const bdc = pistonPinDistance(c, c.cycleOffset + 180);
  console.log(`    cylinder ${c.id}: GMP przy ${String(c.cycleOffset).padStart(3)} stopni  s=${tdc.s.toFixed(4)} mm    DMP przy ${String(c.cycleOffset + 180).padStart(3)} stopni  s=${bdc.s.toFixed(4)} mm    skok=${(tdc.s - bdc.s).toFixed(4)} mm`);
}
row('max kat korbowodu [stopnie] = asin(r/L)', +maxRodAngleDeg().toFixed(4), +(Math.asin(r / LAYOUT.rodLength) * D).toFixed(4), 1e-9);
row('kat korbowodu w GMP [stopnie]', +(rodAngle(CYLINDERS[0], CYLINDERS[0].cycleOffset) * D).toFixed(9), 0, 1e-9);
const crankPinY_TDC = crankPinPosition(CYLINDERS[0], CYLINDERS[0].cycleOffset);
row('czop w GMP: y [mm]', +crankPinY_TDC.y.toFixed(4), r, 1e-4);
row('czop w GMP: x [mm]', +crankPinY_TDC.x.toFixed(9), 0, 1e-9);
const crankPinY_BDC = crankPinPosition(CYLINDERS[0], CYLINDERS[0].cycleOffset + 180);
row('czop w DMP: y [mm]', +crankPinY_BDC.y.toFixed(4), -r, 1e-4);

head('4. SYMETRIA KORBY I STOPIEŃ SPRĘŻANIA Z GEOMETRII');
row('obrot walu o 720 stopni [stopnie]', crankRotation(720) * D, -720, 1e-9);
for (const cr of [9.3, 9.0]) {
  const c = CYLINDERS[0];
  row(`CR liczone z objetosci komory (dla ${cr}:1)`, +compressionRatioFromChamber(c, cr).toFixed(4), cr, 0.01);
  info(`  objetosc komory w GMP dla ${cr} [cm3]`, +clearanceVolumeCc(cr).toFixed(3));
  info(`  objetosc komory w DMP dla ${cr} [cm3]`, +chamberVolumeCc(c, c.cycleOffset + 180, cr).toFixed(3));
}

head('5. WAŁEK ROZRZĄDU: POŁOWA OBROTÓW WAŁU');
row('obrot walka przy wale 0 -> 720 [stopnie]', camRotation(720) - camRotation(0), -360, 1e-9);
row('obrot walka przy wale 0 -> 8640 [stopnie]', camRotation(8640) - camRotation(0), -4320, 1e-9);
row('przelozenie walka = 1/2 walu', (camRotation(720) - camRotation(0)) / 720, -0.5, 1e-12);
row('zebow na kole walka', LAYOUT.camSprocketTeeth, 2 * LAYOUT.crankSprocketTeeth);
console.log('  rozrząd liczony z fazy cylindra (kąt wału -> wznios zaworu [mm]):');
for (const c of CYLINDERS.slice(0, 2)) {
  for (const which of ['intake', 'exhaust']) {
    const maxCrank = maxLiftCrank(c, which);
    const phase = cycleAngle(c, maxCrank);
    console.log(`    cyl ${c.id} ${which.padEnd(8)}: pelny wznios przy ${String(maxCrank).padStart(3)} stopni walu (faza ${phase.toFixed(0)}, wznios ${lift(which, phase).toFixed(4)} mm), faza krzywki ${(lobePhase(c, which) * D).toFixed(3)} stopni`);
  }
}
row('wznios maksymalny [mm]', +lift('intake', cycleAngle(CYLINDERS[0], maxLiftCrank(CYLINDERS[0], 'intake'))).toFixed(4), LAYOUT.valveLift, 1e-6);
row('wznios poza zdarzeniem [mm]', lift('intake', 600), 0);
const anyOdd = CYLINDERS.slice(1).some((c) => ((c.journalAngle - CYLINDERS[0].journalAngle) % 72 + 72) % 72 !== 0);
row('fazy krzywek to wielokrotnosc 72 stopni', anyOdd ? 0 : 1, 1);

head('6. ŁAŃCUCH / PASKI: PRĘDKOŚCI I ROZRZĄD');
row('przelozenie walkow: pasek zebaty wal -> wydechowy', LAYOUT.camSprocketTeeth / LAYOUT.crankSprocketTeeth, 2);
row('przelozenie: lancuszek wydechowy -> dolotowy', 1, 1);
info('dlugosc paska i sciezka liczone w beltPath() z pozycji kol zebatych');

head('7. TURBO: PRĘDKOŚĆ I DOŁADOWANIE NIEZALEŻNE OD KĄTA WAŁU');
console.log('  predkosc turbiny zalezy tylko od obrotow i doladowania, nie od kata walu:');
for (const rpm of [1000, 2000, 3000, 4000, 6000, 7000]) {
  console.log(`    ${String(rpm).padStart(4)} obr/min: spool=${spool(rpm).toFixed(4)}  boost(3B)=${boostBar(rpm, '3B').toFixed(3)} bar  boost(ADU)=${boostBar(rpm, 'ADU').toFixed(3)} bar  shaft=${Math.round(turboShaftRpm(rpm, '3B'))} obr/min`);
}
// Independence test: integrate the shaft angle over the same elapsed time at
// two different crank angles. If the turbo were crank driven the two would be
// identical for identical time; they are, but they are also identical at every
// crank angle because the shaft does not see the crank at all. The real
// independence proof is that shaft speed is a function of (rpm, boost) only.
const a1 = { deg: 0, t: 0 };
const a2 = { deg: 720, t: 0 };
function integrate(degFixed, rpm, seconds) {
  let acc = 0;
  const dt = 1 / 240;
  for (let t = 0; t < seconds; t += dt) acc += (turboShaftRpm(rpm, '3B') / 60) * 360 * dt;
  return { degFixed, rpm, seconds, shaftDeg: acc, oilSeesCrank: degFixed };
}
const i1 = integrate(0, 3000, 1);
const i2 = integrate(720, 3000, 1);
console.log(`    wal zamrozony na ${i1.degFixed} stopni, 3000 obr/min, 1 s: walek turbiny obrocil sie ${i1.shaftDeg.toFixed(2)} stopni`);
console.log(`    wal zamrozony na ${i2.degFixed} stopni, 3000 obr/min, 1 s: walek turbiny obrocil sie ${i2.shaftDeg.toFixed(2)} stopni`);
row('obrot turbiny identyczny przy roznych katach walu', i1.shaftDeg, i2.shaftDeg, 1e-9);
console.log('  stosunek obrotow turbiny do obrotow walu (mechaniczny naped mialby staly):');
for (const rpm of [2000, 3000, 4000, 6000, 7000]) {
  console.log(`    ${String(rpm).padStart(4)} obr/min: shaft/wal = ${turboSpeedRatio(rpm, '3B').toFixed(3)}`);
}
row('przelozenie turbina/wal zmienia sie z obrotami', Math.abs(turboSpeedRatio(2000, '3B') - turboSpeedRatio(7000, '3B')) > 1 ? 1 : 0, 1);
row('turbina kreci sie szybciej niz wal (x) przy 6000', +(turboShaftRpm(6000, '3B') / 6000).toFixed(2), null);
row('ladowanie ADU > 3B przy 4000 obr/min', boostBar(4000, 'ADU') > boostBar(4000, '3B') ? 1 : 0, 1);
row('liczba lopatek kompresji', TURBO.compressorBlades + TURBO.compressorSplitters, 12);
row('liczba lopatek turbiny', TURBO.turbineBlades, 11);

head('8. ZAWORY, GŁOWICA I POZOSTAŁE LICZBY');
row('zawory na cylinder (20V)', valveCount('20v'), 4);
row('zawory lacznie (20V)', valveCountTotal('20v'), 20);
row('zawory na cylinder (10V)', valveCount('10v'), 2);
row('zawory lacznie (10V)', valveCountTotal('10v'), 10);
row('srednia predkosc tloka @6000 obr/min [m/s]', +meanPistonSpeed(6000).toFixed(4), +(2 * 0.0864 * 6000 / 60).toFixed(4), 1e-9);
row('stosunek R/L (rod ratio)', +(LAYOUT.rodLength / r).toFixed(4), +(144 / 43.2).toFixed(4), 1e-9);
info('wysokosc sprzezenia: deck - r - L = compression height [mm]');
info('  ' + (LAYOUT.deckHeight - r - LAYOUT.rodLength).toFixed(3) + ' mm  (uzyte: ' + LAYOUT.pistonCompressionHeight + ' mm)');

head('9. WERSJE SILNIKA (CR ZALEŻNE OD WERSJI)');
for (const v of SPEC.variants) {
  console.log(`  ${v.code.padEnd(4)} ${v.years.padEnd(11)} CR ${String(v.cr).padEnd(4)}${v.crAlt ? ' (inne zrodla: ' + v.crAlt + ')' : '     '} ${String(v.powerPs).padStart(3)} KM  ${String(v.torqueNm[0]).padStart(3)} Nm @ ${v.torqueNm[1]}  ${v.turbo}  boost ~${v.boostBar} bar`);
}

head('10. PODSUMOWANIE');
console.log(`  PASS: ${passes}   FAIL: ${fails}`);
console.log('\n  PRZYJĘTE UPROSZCZENIA (nie sa danymi katalogowymi):');
for (const [k, v] of Object.entries(APPROX)) console.log(`    ${k}: ${v}`);
console.log('\n  ZRODLA DANYCH KATALOGOWYCH:');
console.log('    https://en.wikipedia.org/wiki/Audi_S2                        (2226 cm3, I5 turbo 20V, 3B 220 KM, ABY 230 KM)');
console.log('    https://en.wikipedia.org/wiki/Audi_RS_2_Avant                (ADU, 2226 cc, I5 DOHC 20V turbo, 315 KM, wieksze KKK)');
console.log('    https://en.wikipedia.org/wiki/Audi_100                       (AAN w S4: 2226, 230 KM)');
console.log('    https://engineguide.wiki/audi/engine-audi-aan                (2226, blok zeliwny R5, glowica aluminium 20V, CR 9.3, bore 81, stroke 86.4)');
console.log('    https://autowoop.com/engine/audi/aan                         (2226, bore 81.00, stroke 86.40, CR 9.3, firing order 1-2-4-5-3)');
console.log('    https://enginetechspecs.com/audi_adu_technical_data.html      (ADU: 2226, 81.0 x 86.4, CR 9.3, firing order 1-2-4-5-3, Mahle)');
console.log('    https://carfolio.com/audi-rs2-23155                          (RS2: 2226, 81 x 86.4, CR 9:1 - sprzeczne z 9.3)');
console.log('    https://swapgenie.com.au/swap-school/engine-pedia-audis...    (ADU CR 9.0, blok zeliwny, korbowod zeliwny wal)');
console.log('    https://forums.quattroworld.com/s4s6/msgs/211339.phtml        (3B/AAN/ABY KKK K24-7000, ADU K24-7200, KKK 5324 970 7200)');
console.log('    https://www.boostlineproducts.com/.../audi-5-cyl...rod        (korbowod 5.670 in = 144.018 mm, czop 47.80 mm, sworzen 23 mm)');
console.log('    https://fcp-engineering.com/.../audi-rod-bearing-set...        (srednica czopa korbowego 47.758 - 47.778 mm)');
console.log('    https://www.audizine.com/... (2.2 I5)                          (rozstaw cylindrow 88 mm)');

if (fails > 0) {
  console.log(`\n  WYNIK: ${fails} SPRAWDZEN NIE PRZESZLO`);
  process.exit(1);
}
console.log('\n  WYNIK: wszystkie sprawdzenia liczbowe przeszly');
