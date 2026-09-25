import * as THREE from 'three';
import * as T from './src/lib/trochoid.js';
const th = 140*Math.PI/180;
const poly = T.chamberPolygon(th, 0, 44, 34);
console.log('points', poly.length, 'first', poly[0].x.toFixed(1), poly[0].y.toFixed(1));
console.log('sequence (every 6th):');
console.log(poly.filter((_,i) => i % 6 === 0).map(p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' '));
console.log('last three:', poly.slice(-3).map(p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' '));
