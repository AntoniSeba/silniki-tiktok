// verify.mjs - numerics first. Everything the model shows is recomputed here
// from the published BMW figures and checked against them, or against a
// closed-form result that does not care about the model.
//
//   node verify.mjs
//
// Nothing in this file imports three.js, so it runs headless in plain node.

import * as K from './src/kinematics.js';

const f = (v, n = 3) => Number(v).toFixed(n);
const pad = (s, n) => String(s).padEnd(n);
const bar = (t) => console.log('\n=== ' + t + ' ' + '='.repeat(Math.max(2, 74 - t.length)));
let fails = 0;
let checks = 0;
function check(label, got, want, tol, unit = '') {
  checks++;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${pad(label, 46)} ${pad(f(got, 4), 13)} ${unit}  (oczekiwane ${f(want, 4)} ± ${tol})`
  );
}
function checkRounded(label, got, want, unit = '') {
  checks++;
  const ok = Math.round(got) === want;
  if (!ok) fails++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${pad(label, 46)} ${pad(f(got, 4), 13)} ${unit}  (zaokrąglone do ${Math.round(got)} vs publikowane ${want})`
  );
}
function checkBool(label, got, want) {
  checks++;
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${pad(label, 46)} ${pad(got, 13)}      (oczekiwane ${want})`);
}

// ---------------------------------------------------------------------------
bar('1. POJEMNOŚĆ Z GEOMETRII, S54B32');
console.log(`pole tłoka            A = pi/4 * ${K.S54.bore}^2   = ${f(K.PISTON_AREA, 2)} mm2`);
console.log(`skok z kinematyki     S = y(pin, GMP) - y(pin, DMP)`);
const yTDC = K.pistonPinY(1, 0);
const yBDC = K.pistonPinY(1, 180);
console.log(`  y(pin) w GMP        = ${f(yTDC, 4)} mm nad osia walu`);
console.log(`  y(pin) w DMP        = ${f(yBDC, 4)} mm nad osia walu`);
check('skok tłoka z kinematyki', yTDC - yBDC, K.S54.stroke, 1e-9, 'mm');
check('pojemność jednego cylindra', K.sweptVolumePerCyl(), 540.9, 0.2, 'cm3');
check('pojemność sześciu cylindrów', K.sweptVolumeTotal(), 3246, 1.0, 'cm3');
checkRounded('pojemność wzorem pi/4*B^2*S*6', K.sweptVolumePublished(K.S54), 3246, 'cm3');
console.log(`\n  BMW podaje 3246 cm3. Różnica modelu vs publikacja: ${f(K.sweptVolumeTotal() - 3246, 4)} cm3`);

bar('2. POJEMNOŚĆ M50B25 (DLA PORÓWNANIA)');
checkRounded('pojemność M50B25', K.sweptVolumePublished(K.M50), 2494, 'cm3');
console.log(`  M50B25: ${K.M50.bore} x ${K.M50.stroke} mm, stopień sprężania ${K.M50.compressionRatio}`);
console.log(`  S54B32: ${K.S54.bore} x ${K.S54.stroke} mm, stopień sprężania ${K.S54.compressionRatio}`);
console.log(`  Różnica skoku: ${f(K.S54.stroke - K.M50.stroke, 1)} mm, różnica średnicy: ${f(K.S54.bore - K.M50.bore, 1)} mm`);
console.log(`  Dławienie tulei przy rozstawie 91 mm: S54 ma ściankę ${f(K.WALL, 1)} mm, M50 ${f(91 - K.M50.bore, 1)} mm`);

bar('3. KOLEJNOŚĆ ZAPŁONU 1-5-3-6-2-4 I FAZY CZOPÓW');
console.log('cylinder   faza zapłonu [deg]   pin_phase = faza mod 360   odstęp od poprzedniego');
let prev = null;
let minGap = 1e9;
let maxGap = -1e9;
for (const e of K.FIRE_ANGLE) {
  const gap = prev === null ? null : e.angle - prev;
  if (gap !== null) {
    minGap = Math.min(minGap, gap);
    maxGap = Math.max(maxGap, gap);
  }
  console.log(
    `   ${e.cyl}      ${pad(e.angle, 18)}   ${pad(K.PIN_PHASE[e.cyl - 1], 24)}   ${gap === null ? '-' : gap}`
  );
  prev = e.angle;
}
const wrapGap = 720 - K.FIRE_ANGLE[K.FIRE_ANGLE.length - 1].angle;
console.log(`ostatni -> pierwszy (przez 720): ${wrapGap}`);
minGap = Math.min(minGap, wrapGap);
maxGap = Math.max(maxGap, wrapGap);
checkBool('kolejność zapłonu', JSON.stringify(K.S54.firingOrder), JSON.stringify([1, 5, 3, 6, 2, 4]));
check('najmniejszy odstęp zapłonów', minGap, 120, 1e-9, 'deg');
check('największy odstęp zapłonów', maxGap, 120, 1e-9, 'deg');
for (const e of K.FIRE_ANGLE) {
  const want = (((e.angle % 360) + 360) % 360);
  check(`faza czopa cylindra ${e.cyl}`, K.PIN_PHASE[e.cyl - 1], want, 1e-9, 'deg');
}
const pinSet = [...new Set(K.PIN_PHASE)].sort((a, b) => a - b);
console.log(`\n  Trzy różne płaszczyzny czopów: ${JSON.stringify(pinSet)} - para cylindrów na każdą`);
console.log(`  Pary: ${K.PIN_PHASE.map((p, i) => `cyl${i + 1}=${p}`).join(' ')}`);
check('liczba różnych płaszczyzn czopów', pinSet.length, 3, 0, 'szt');
// 120 degree crank: pins 1-6, 2-5, 3-4 move together
const pairs = [];
for (let a = 1; a <= 6; a++)
  for (let b = a + 1; b <= 6; b++)
    if (K.PIN_PHASE[a - 1] === K.PIN_PHASE[b - 1]) pairs.push(`${a}-${b}`);
console.log(`  Cylindry o wspólnej fazie czopa: ${pairs.join(', ')}`);
checkBool('trzy pary o wspólnej fazie', pairs.length, 3);

bar('4. GMP / DMP KAŻDEGO TŁOKA');
console.log('cyl    y(pin) GMP     y(korona) GMP   y(pin) DMP     y(korona) DMP   skok');
for (let c = 1; c <= 6; c++) {
  const a = (K.PIN_PHASE[c - 1] + 720) % 360; // crank angle of this cylinder TDC
  const pt = K.pistonPinY(c, a);
  const ct = K.pistonCrownY(c, a);
  const pb = K.pistonPinY(c, a + 180);
  const cb = K.pistonCrownY(c, a + 180);
  console.log(
    `  ${c}   ${pad(f(pt, 4), 13)} ${pad(f(ct, 4), 15)} ${pad(f(pb, 4), 13)} ${pad(f(cb, 4), 15)} ${f(pt - pb, 3)}`
  );
  check(`cylinder ${c}: tłok w GMP dla kata ${a} deg`, pt, yTDC, 1e-9, 'mm');
  check(`cylinder ${c}: skok`, pt - pb, K.S54.stroke, 1e-9, 'mm');
}
// the crown must sit exactly one deck clearance below the deck at TDC
check('korona w GMP = DECK - luz', yTDC + K.S54.compressionHeight, K.DECK - K.S54.deckClearance, 1e-9, 'mm');
check('DECK (wysokość bloku od osi wału)', K.DECK, 218.0, 1e-9, 'mm');
console.log(`\n  Wysokość bloku = r + korbowód + wysokość kompresyjna + luz = ` +
  `${K.CRANK_R} + ${K.S54.rodLength} + ${K.S54.compressionHeight} + ${K.S54.deckClearance} = ${K.DECK} mm`);

bar('5. OBRÓT WAŁKÓW ROZRZĄDU = 1/2 WAŁU');
console.log('kąt wału   kąt wałka (1/2)   skok dolot   skok wydech   vacl zaw. dolotowe/wydechowe');
const samples = [0, 45, 90, 120, 180, 238, 240, 270, 360, 372, 420, 540, 600, 660, 719];
for (const a of samples) {
  const li = K.valveLift('inlet', a, 0);
  const le = K.valveLift('exhaust', a, 0);
  console.log(
    `  ${pad(a, 8)} ${pad(f(K.camAngle(a), 2), 15)} ${pad(f(li, 3), 12)} ${pad(f(le, 3), 13)} ${li > 0.05 && le > 0.05 ? 'OBA (nakładanie)' : li > 0.05 ? 'dolotowy' : le > 0.05 ? 'wydechowy' : '-'}`
  );
}
check('kąt wałka przy wale 360 deg', K.camAngle(360), 180, 1e-12, 'deg');
check('kąt wałka przy wale 720 deg', K.camAngle(720), 360, 1e-12, 'deg');
checkBool('przełożenie wałek/wal = 1/2', Math.abs(K.camAngle(720) / 720 - 0.5) < 1e-12, true);
// the two cams must turn the same direction and at the same speed
let worstRatio = 0;
for (let a = 0; a <= 720; a += 5) worstRatio = Math.max(worstRatio, Math.abs(K.camAngle(a + 5) - K.camAngle(a) - 2.5));
check('stała prędkość wałków (brak skoków)', worstRatio, 0, 1e-12, 'deg');

bar('6. SKOK ZAWORÓW WG KĄTÓW OTWARCIA (bez VANOS)');
const evI = K.valveEvent('inlet', 0);
const evE = K.valveEvent('exhaust', 0);
console.log(`dolotowy: otwarcie ${f(evI.open * 2, 1)} deg (wału), zamknięcie ${f(evI.close * 2, 1)} deg, czas ${f(evI.duration * 2, 1)} deg wału, wznios ${evI.lift} mm`);
console.log(`wydechowy: otwarcie ${f(evE.open * 2, 1)} deg (wału), zamknięcie ${f(evE.close * 2, 1)} deg, czas ${f(evE.duration * 2, 1)} deg wału, wznios ${evE.lift} mm`);
check('wznios dolotowy szczyt', K.valveLift('inlet', evI.open * 2 + evI.duration * 2 / 2, 0), 11.5, 1e-6, 'mm');
check('wznios wydechowy szczyt', K.valveLift('exhaust', evE.open * 2 + evE.duration * 2 / 2, 0), 11.0, 1e-6, 'mm');
check('wznios dolotowy przed otwarciem', K.valveLift('inlet', evI.open * 2 - 1, 0), 0, 1e-12, 'mm');
check('wznios wydechowy po zamknięciu', K.valveLift('exhaust', evE.close * 2 + 1, 0), 0, 1e-12, 'mm');
// lift must be continuous: no jumps, and flat/smooth through the event ends
let jump = 0;
let prevL = K.valveLift('inlet', 0, 0);
for (let a = 0.25; a <= 720; a += 0.25) {
  const l = K.valveLift('inlet', a, 0);
  jump = Math.max(jump, Math.abs(l - prevL));
  prevL = l;
}
check('maks. skok wzniosu miedzy krokami 0.25 deg', jump, 0, 0.35, 'mm');
check('liczba zaworów', 24, K.S54.nValves, 0, 'szt');
console.log(`  4 zawory na cylinder x 6 cylindrów = ${K.S54.valvesPerCylinder * K.S54.nCyl}`);

bar('7. VANOS (podwójny, bezstopniowy)');
console.log(`zakres: dolotowy +${K.VANOS.inletAdvanceCrank} deg wału (przyspieszenie), wydechowy -${K.VANOS.exhaustRetardCrank} deg wału (opóźnienie)`);
console.log('vanos  otwarcie dolotu [deg wału]  zamknięcie dolotu   otwarcie wydechu   zamknięcie wydechu   nakładanie [deg]');
for (const v of [0, 0.25, 0.5, 0.75, 1]) {
  const i = K.valveEvent('inlet', v);
  const e = K.valveEvent('exhaust', v);
  console.log(
    `  ${pad(f(v, 2), 6)} ${pad(f(i.open * 2, 1), 28)} ${pad(f(i.close * 2, 1), 20)} ${pad(f(e.open * 2, 1), 19)} ${pad(f(e.close * 2, 1), 21)} ${f(K.overlap(v), 1)}`
  );
}
check('VANOS 0: nakładanie zaworów', K.overlap(0), 24, 1e-9, 'deg');
checkBool('VANOS pelny: nakladanie wieksze niz bazowe', K.overlap(1) > K.overlap(0), true);
check('VANOS 1: przyspieszenie dolotu', (K.valveEvent('inlet', 0).open - K.valveEvent('inlet', 1).open) * 2, 40, 1e-9, 'deg');
check('VANOS 1: opóźnienie wydechu', (K.valveEvent('exhaust', 1).close - K.valveEvent('exhaust', 0).close) * 2, 25, 1e-9, 'deg');
let liftChange = 0;
for (let a = 0; a < 720; a += 5)
  liftChange = Math.max(liftChange, Math.abs(K.valveLift('inlet', a, 1) - K.valveLift('inlet', a, 0)));
check('VANOS realnie zmienia wznios', liftChange > 1 ? 1 : 0, 1, 0, 'mm');
console.log(`  maks. różnica wzniosu dolotowego miedzy vanos 0 i 1 przy tym samym kacie wału: ${f(liftChange, 3)} mm`);

bar('8. STOPIEŃ SPRĘŻANIA Z GEOMETRII vs 11,5');
console.log(`objętość skokowa cylindra        = ${f(K.sweptVolumePerCyl(), 2)} cm3`);
console.log(`objętość komory z CR 11,5        = ${f(K.impliedClearanceVolume(), 2)} cm3`);
console.log(`  z tego nad koroną (luz 1,2 mm) = ${f(K.deckClearanceVolume(), 2)} cm3`);
console.log(`  zostaje na komorę w głowicy    = ${f(K.chamberVolume(), 2)} cm3  (głębokość ${f(K.chamberDepth(), 2)} mm)`);
check('stopień sprężania z geometrii', K.compressionRatioFromGeometry(), 11.5, 1e-9, ':1');
check('komora w głowicy dodatnia', K.chamberVolume() > 0 ? 1 : 0, 1, 0);

bar('9. ŁAŃCUCH ROZRZĄDU');
const ch = K.timingChainLength();
const rCrank = K.sprocketRadius(K.CHAIN.crankTeeth);
const rCam = K.sprocketRadius(K.CHAIN.camTeeth);
console.log(`koło wału ${K.CHAIN.crankTeeth} zębów -> promień ${f(rCrank, 2)} mm`);
console.log(`koło wałka ${K.CHAIN.camTeeth} zębów -> promień ${f(rCam, 2)} mm`);
console.log(`przełożenie zębów: ${K.CHAIN.camTeeth}/${K.CHAIN.crankTeeth} = ${f(K.CHAIN.camTeeth / K.CHAIN.crankTeeth, 2)}`);
check('przełożenie łańcucha', K.CHAIN.camTeeth / K.CHAIN.crankTeeth, 2, 1e-12);
console.log(`łańcuch główny (wał -> wałek wydechowy): ${f(ch.main, 1)} mm = ${ch.linksMain} ogniw`);
console.log(`łańcuch wtórny (wałek wydechowy -> dolotowy): ${f(ch.secondary, 1)} mm = ${ch.linksSecondary} ogniw`);
console.log(`  krok łańcucha ${K.CHAIN.pitch} mm`);

bar('10. PĘŁNY PRZEBIEG 720 deg: CZTERY S UWAGI NA CYLINDER');
console.log('kąt   cyl1      cyl2      cyl3      cyl4      cyl5      cyl6      zapłon    wznios dolot');
for (let a = 0; a <= 720; a += 30) {
  const cells = [];
  for (let c = 1; c <= 6; c++) cells.push(pad(K.STROKE_PL[K.strokeIndex(c, a)], 9));
  const firing = K.FIRE_ANGLE.filter((e) => e.angle === a % 720).map((e) => e.cyl);
  const lid = K.valveLift('inlet', a, 0);
  const led = K.valveLift('exhaust', a, 0);
  console.log(
    `  ${pad(a, 4)} ${cells.join(' ')} ${pad(firing.length ? firing[0] : '', 8)}  d=${f(lid, 1)} w=${f(led, 1)}`
  );
}
let coverage = 0;
for (let a = 0; a < 720; a += 5) {
  const f = K.FIRE_ANGLE.filter((e) => a >= e.angle && a < e.angle + 180).length;
  coverage = Math.max(coverage, f);
}
// with even 120 degree firing intervals a 180 degree power stroke overlaps its
// neighbour, so one or two cylinders are always on the power stroke
check('maks. liczba cylindrów równocześnie w suwie pracy', coverage, 2, 0, 'szt');
checkBool('przy 720 deg każdy cylinder zapalił raz', K.FIRE_ANGLE.length, 6);

bar('11. PRZEPUSTNICE (6 indywidualnych)');
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  console.log(`  otwarcie ${pad(f(t * 100, 0) + '%', 6)} -> kąt płytki ${f(K.throttlePlateAngle(t), 1)} deg`);
}
check('płytka zamknięta = przepływ przez obejście', K.throttlePlateAngle(0), 0, 1e-12, 'deg');
check('płytka otwarta', K.throttlePlateAngle(1), 80, 1e-12, 'deg');

bar('12. WYMIARY BLOKU I ROZSTAW CYLINDRÓW');
console.log(`rozstaw cylindrów (pitch) = ${K.S54.pitch} mm, średnica cylindra = ${K.S54.bore} mm`);
console.log(`ścianka między cylindrami = ${K.WALL} mm (cylindry siamskie)`);
console.log(`długość bloku = 2*${K.END_WALL} + 6*${K.S54.bore} + 5*${K.WALL} = ${K.BLOCK_LENGTH} mm`);
console.log(`osie cylindrów X = ${K.CYL_X.map((v) => f(v, 1)).join(', ')}`);
check('odstęp osi cylindrów 1-2', K.CYL_X[1] - K.CYL_X[0], 91, 1e-9, 'mm');
check('odstęp osi cylindrów 5-6', K.CYL_X[5] - K.CYL_X[4], 91, 1e-9, 'mm');
check('odcięcie S54', K.S54.redline, 8000, 0, 'obr/min');
check('średnica cylindra', K.S54.bore, 87.0, 0, 'mm');
check('skok', K.S54.stroke, 91.0, 0, 'mm');
check('stopień sprężania (dane)', K.S54.compressionRatio, 11.5, 0, ':1');

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(80)}`);
console.log(`SPRAWDZEŃ: ${checks}, NIEUDANYCH: ${fails}`);
console.log(fails === 0 ? 'WYNIK: wszystkie liczby się zgadzają.' : 'WYNIK: są rozbieżności, patrz FAIL powyżej.');
process.exit(fails === 0 ? 0 : 1);
