// geometry.js — čistá geometrie prototypu ALBA MONO.
//
// Jediný veřejný vstup je buildBlock(P, C), kde P jsou číselné parametry
// z params.js a C přepínače. Funkce vrací THREE.Group postavenou
// V MILIMETRECH. Převod na metry dělá VOLAJÍCÍ jediným měřítkem kořenové
// skupiny — konstanta MM_TO_M níže je jediné místo, kde se dělí tisícem.
//
// V tomto souboru NEJSOU natvrdo žádné konstrukční rozměry; všechno, co má
// rozměr, přichází z P.
//
// SOUŘADNICE
//   x … délka bloku, 0 uprostřed herdbloku
//   y … výška od podlahy (y = 0 je podlaha)
//   z … hloubka; z = 0 je LÍC PRACOVNÍ DESKY (čelo bloku), dozadu roste
//       Čelo je tedy na straně −z, stejně jako u stávající aplikace.

import * as THREE from 'three';
import { isBok, noseMetrics } from './params.js';

/** Jediné místo převodu mm → metry (aplikuje se měřítkem kořenové skupiny). */
export const MM_TO_M = 0.001;

// ---------------------------------------------------------------------------
// materiály
// ---------------------------------------------------------------------------

/**
 * Materiály se tvoří ZNOVU při každé přestavbě (drsnost je parametr) a jsou
 * označené userData.disposable, aby je disposeGroup() uklidil.
 */
function makeMaterials(P) {
  const r = P.drsnostPovrchuNerezu;
  const mk = (color, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.9,
      roughness: r,
      envMapIntensity: 1.2,
      ...opts,
    });
    m.userData.disposable = true;
    return m;
  };
  return {
    steel: mk(0xd8dcdf),
    // svařenec pracovní desky je „skořepina" bez objemu → oboustranný materiál
    steelShell: mk(0xd8dcdf, { side: THREE.DoubleSide }),
    panel: mk(0xbfc5ca, { roughness: Math.min(0.95, r + 0.05) }),
    plinth: mk(0xc6cbd0, { roughness: Math.min(0.95, r + 0.1), metalness: 0.85 }),
    knob: mk(0x121212, { metalness: 0.3, roughness: 0.5 }),
    button: mk(0xc1442b, { metalness: 0.2, roughness: 0.4 }),
    socket: mk(0xe8eaec, { metalness: 0.2, roughness: 0.5 }),
    device: mk(0x101014, { metalness: 0.2, roughness: 0.12 }),
    cavity: mk(0x5a6066, { metalness: 0.05, roughness: 0.95, side: THREE.BackSide }),
  };
}

// ---------------------------------------------------------------------------
// drobné pomůcky
// ---------------------------------------------------------------------------

function addMesh(parent, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Kvádr zadaný protilehlými rohy. Nulový nebo záporný rozměr se přeskočí. */
function box(parent, mat, x0, x1, y0, y1, z0, z1, name) {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (!(w > 0 && h > 0 && d > 0)) return null;
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return addMesh(parent, geo, mat, name);
}

/**
 * Vytáhne půdorysný obrys (body {x, z}) svisle z y0 do y1.
 * Shape se staví v rovině XY a otočí se do vodorovné polohy; kvůli tomu je
 * druhá souřadnice shapu −z (viz rotateX(−π/2): lokální y → světové −z).
 */
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.z - p.z) > 1e-6) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.z - b.z) > 1e-6) break;
    out.pop();
  }
  return out;
}

function extrudeFootprint(points, holes, y0, y1) {
  const h = y1 - y0;
  // Obrysy pro protažení nesou kvůli párování prstenců i totožné body
  // (schody a degenerovaná zaoblení); triangulaci se dodávají bez nich.
  const pts = dedupe(points);
  if (!(h > 0) || pts.length < 3) return null;
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  if (holes) {
    for (const hole of holes) {
      const hp = dedupe(hole);
      if (hp.length >= 3) {
        shape.holes.push(new THREE.Path(hp.map((p) => new THREE.Vector2(p.x, -p.z))));
      }
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

/** Obdélníkový půdorysný obrys jako pole bodů. */
function rectFootprint(x0, x1, z0, z1) {
  return [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ];
}

/** Vodorovný rám (obdélník s obdélníkovou dírou) mezi y0 a y1. */
function frameBox(parent, mat, x0, x1, z0, z1, t, y0, y1, name) {
  if (!(t > 0)) return null;
  if (x1 - x0 <= 2 * t || z1 - z0 <= 2 * t) {
    return box(parent, mat, x0, x1, y0, y1, z0, z1, name);
  }
  const geo = extrudeFootprint(
    rectFootprint(x0, x1, z0, z1),
    [rectFootprint(x0 + t, x1 - t, z0 + t, z1 - t)],
    y0, y1
  );
  return geo ? addMesh(parent, geo, mat, name) : null;
}

// ---------------------------------------------------------------------------
// půdorysný obrys herdbloku (zakončení vlevo / vpravo)
// ---------------------------------------------------------------------------

/**
 * Vrátí bod(y) jednoho rohu obrysu v pořadí obcházení
 * (čelo zleva doprava → pravý bok dopředu-dozadu → záda zprava doleva →
 *  levý bok zezadu dopředu).
 *
 * Typ rohu je vlastnost konce herdbloku, ne rohu samotného (SPEC §4.3).
 * Počet vrácených bodů závisí JEN na typu, ne na odsazení — díky tomu si
 * odsazené obrysy odpovídají bod po bodu a dá se mezi nimi táhnout profil.
 */
function cornerPoints(which, type, x0, x1, z0, z1, chamfer, radius, segs) {
  const out = [];
  const c = chamfer;
  const r = Math.max(0, radius);
  const put = (x, z) => out.push({ x, z, kind: 'plate' });
  const arc = (cx, cz, a0, a1) => {
    for (let k = 0; k <= segs; k++) {
      const t = a0 + (a1 - a0) * (k / segs);
      put(cx + r * Math.cos(t), cz + r * Math.sin(t));
    }
  };
  const HALF = Math.PI / 2;
  if (which === 'FL') {
    if (type === 'zkosena') { put(x0, z0 + c); put(x0 + c, z0); }
    else if (type === 'zaoblena') arc(x0 + r, z0 + r, Math.PI, Math.PI + HALF);
    else put(x0, z0);
  } else if (which === 'FR') {
    if (type === 'zkosena') { put(x1 - c, z0); put(x1, z0 + c); }
    else if (type === 'zaoblena') arc(x1 - r, z0 + r, Math.PI + HALF, 2 * Math.PI);
    else put(x1, z0);
  } else if (which === 'BR') {
    if (type === 'zkosena') { put(x1, z1 - c); put(x1 - c, z1); }
    else if (type === 'zaoblena') arc(x1 - r, z1 - r, 0, HALF);
    else put(x1, z1);
  } else {
    if (type === 'zkosena') { put(x0 + c, z1); put(x0, z1 - c); }
    else if (type === 'zaoblena') arc(x0 + r, z1 - r, HALF, Math.PI);
    else put(x0, z1);
  }
  return out;
}

// --- zakončení svislou deskou po boku ---------------------------------------
//
// Nos konce má v půdorysu dvě čela: ROVNÉ (leží v rovině líce desky, ale je
// vysoké přes celý herdblok) a na ně navazující ZKOSENÉ, které obrys vrátí
// do roviny boku. Body nosu jsou označené kind:'bok' — právě podle toho pozná
// sweep, že se v tom místě má protahovat 290mm profil místo 40mm čela desky.
//
// Počet vrácených bodů závisí JEN na typu konce a na dělení oblouku, nikdy na
// hodnotách rozměrů — jinak by si odsazené obrysy neodpovídaly bod po bodu.

/**
 * Zaoblený zlom obrysu: (segs+1) bodů oblouku o poloměru r ve vrcholu `v`.
 * Při r ≤ 0 nebo degenerovaném vrcholu vrátí (segs+1) totožných bodů —
 * počet bodů tedy zůstane konstantní a ostrá hrana vznikne sama.
 */
function filletPoints(prev, v, next, r, segs, kind) {
  const same = () => {
    const out = [];
    for (let k = 0; k <= segs; k++) out.push({ x: v.x, z: v.z, kind });
    return out;
  };
  const l1 = Math.hypot(v.x - prev.x, v.z - prev.z);
  const l2 = Math.hypot(next.x - v.x, next.z - v.z);
  if (!(r > 0) || l1 < 1e-6 || l2 < 1e-6) return same();
  const u1x = (v.x - prev.x) / l1;
  const u1z = (v.z - prev.z) / l1;
  const u2x = (next.x - v.x) / l2;
  const u2z = (next.z - v.z) / l2;
  const turn = Math.atan2(u1x * u2z - u1z * u2x, u1x * u2x + u1z * u2z);
  const a = Math.abs(turn);
  if (a < 1e-4 || Math.abs(a - Math.PI) < 1e-4) return same();
  const tanHalf = Math.tan((Math.PI - a) / 2);
  let T = r / tanHalf;
  T = Math.min(T, l1 / 2, l2 / 2);
  const rr = T * tanHalf;
  if (!(rr > 1e-6)) return same();
  const sx = v.x - u1x * T;
  const sz = v.z - u1z * T;
  const sgn = Math.sign(turn);
  const cx = sx + -u1z * sgn * rr;
  const cz = sz + u1x * sgn * rr;
  const a0 = Math.atan2(sz - cz, sx - cx);
  const out = [];
  for (let k = 0; k <= segs; k++) {
    const t = a0 + turn * (k / segs);
    out.push({ x: cx + rr * Math.cos(t), z: cz + rr * Math.sin(t), kind });
  }
  return out;
}

/**
 * Půdorysný obrys nosu ODSAZENÝ dovnitř o `inset`.
 * Vrací hloubku zlomu mezi čely v ose X (`aB`, měřeno od vnějšího líce boku)
 * a polohu zlomu mezi zkosením a bokem v ose Z (`zC`).
 *
 * Zkosené čelo se musí odsazovat KOLMO ke své ploše — kdyby se jen posunulo
 * s odsazenými hranami, přechod 40mm čela do svislé desky by nevyšel jako
 * svislá stěna a nos by prorůstal před ovládací panel.
 */
function noseOffset(nose, zN, inset) {
  const { dx, dz } = nose;
  const L = Math.hypot(dx, dz);
  if (!(L > 1e-6) || !(dz > 1e-6)) return { aB: inset, zC: zN };
  const s = inset * (L - dx) / dz;
  return {
    aB: dx + (inset * dz) / L - (s * dx) / L,
    zC: zN - inset + (inset * dx) / L + (dz * (dx + (inset * dz) / L - inset)) / dx,
  };
}

/** Body předního rohu konce se svislou deskou (2 + 2×(segs+1) bodů). */
function bokFront(cfg, nose, side, x0, x1, z0, z1, segs, inset) {
  const dir = side === 'L' ? 1 : -1;
  const xEnd = side === 'L' ? x0 : x1;
  const zN = z0 - cfg.nosePred;
  const off = noseOffset(nose, zN, inset);
  // Přechod 40mm čelo → svislá deska leží UPROSTŘED čelní hrany, ne v rohu.
  // Odsazený obrys ho proto posouvá JEN v ose Z (x drží na neodsazené hodnotě),
  // aby uzavírací stěna vyšla svisle. Fold-guard: nikdy před zlom mezi čely.
  const aT = Math.max(nose.noseX, off.aB);
  const t0 = { x: xEnd + dir * (aT - inset + cfg.noseNabeh), z: z0, kind: 'plate' };
  const t1 = { x: xEnd + dir * (aT - inset), z: zN, kind: 'bok' };
  const B = { x: xEnd + dir * (off.aB - inset), z: zN };
  const Cc = { x: xEnd, z: off.zC };
  const side1 = { x: xEnd, z: z1 };
  const split = Math.hypot(Cc.x - B.x, Cc.z - B.z) > 1e-6;
  const r = cfg.noseR;
  // vždy v pořadí obcházení obrysu: vlevo od boku dopředu, vpravo od čela k boku
  if (side === 'L') {
    return [
      ...filletPoints(side1, Cc, split ? B : t1, r, segs, 'bok'),
      ...filletPoints(split ? Cc : side1, B, t1, r, segs, 'bok'),
      t1, t0,
    ];
  }
  return [
    t0, t1,
    ...filletPoints(t1, B, split ? Cc : side1, r, segs, 'bok'),
    ...filletPoints(split ? B : t1, Cc, side1, r, segs, 'bok'),
  ];
}

/**
 * Body zadního rohu konce se svislou deskou (vždy 4 body).
 *
 * Zadní přechod je konstrukčně ostrý schod: dva totožné body v půdorysu, mezi
 * kterými se profil přepne z boku zpět na 40mm čelo desky. Kde ten schod leží,
 * závisí na zatažení boku od zadní hrany:
 *   zatažení = 0 → bok obchází i zkosený zadní roh a končí až na zadní hraně
 *   zatažení > 0 → bok končí na bočním líci a zadní roh patří 40mm desce
 * Rozhodnutí se dělá z NEODSAZENÉ hodnoty, aby si odsazené obrysy odpovídaly
 * bod po bodu (jinak by se prstence ve sweepu rozpadly).
 */
function bokBack(cfg, nose, side, x0, x1, z0, z1, inset) {
  const dir = side === 'L' ? 1 : -1;
  const xEnd = side === 'L' ? x0 : x1;
  const zN = z0 - cfg.nosePred;
  const zMin = noseOffset(nose, zN, inset).zC;
  const roh = Math.max(0, Math.min(cfg.noseZadniRoh, (z1 - zMin) / 2));
  const azRoh = { x: xEnd, z: Math.max(zMin, z1 - roh) };
  const bzRoh = { x: xEnd + dir * roh, z: z1 };
  if (cfg.noseZat <= 1e-6) {
    // bok pokračuje i přes zadní roh; schod je až za zkosením na zadní hraně
    const p = (k) => ({ ...azRoh, kind: k });
    const q = (k) => ({ ...bzRoh, kind: k });
    return side === 'L'
      ? [q('plate'), q('bok'), p('bok'), p('bok')]
      : [p('bok'), p('bok'), q('bok'), q('plate')];
  }
  // bok se zastaví na bočním líci, zadní roh už je běžné 40mm čelo desky
  const zc = Math.max(zMin, z1 - Math.max(0, cfg.noseZat - inset));
  const stop = (k) => ({ x: xEnd, z: Math.min(zc, azRoh.z), kind: k });
  return side === 'L'
    ? [{ ...bzRoh, kind: 'plate' }, { ...azRoh, kind: 'plate' }, stop('plate'), stop('bok')]
    : [stop('bok'), stop('plate'), { ...azRoh, kind: 'plate' }, { ...bzRoh, kind: 'plate' }];
}

/**
 * Půdorysný obrys herdbloku odsazený DOVNITŘ o `inset`.
 * Odvěsna zkosení se odsazením nemění (offset 45° zkosení zachovává odvěsnu),
 * poloměr zaoblení se o odsazení zmenší.
 */
function outlineRing(cfg, inset) {
  const x0 = cfg.x0 + inset;
  const x1 = cfg.x1 - inset;
  const z0 = cfg.z0 + inset;
  const z1 = cfg.z1 - inset;
  const halfX = Math.max(0, (x1 - x0) / 2);
  const halfZ = Math.max(0, (z1 - z0) / 2);
  const cham = Math.min(cfg.chamfer, halfX, halfZ);
  const clampR = (r) => Math.min(Math.max(0, r - inset), halfX, halfZ);
  const rL = clampR(cfg.radiusLeft);
  const rR = clampR(cfg.radiusRight);
  const s = cfg.segs;
  const nL = cfg.left === 'bok' ? cfg.nose.left : null;
  const nR = cfg.right === 'bok' ? cfg.nose.right : null;
  return [
    ...(nL ? bokFront(cfg, nL, 'L', x0, x1, z0, z1, s, inset)
          : cornerPoints('FL', cfg.left, x0, x1, z0, z1, cham, rL, s)),
    ...(nR ? bokFront(cfg, nR, 'R', x0, x1, z0, z1, s, inset)
          : cornerPoints('FR', cfg.right, x0, x1, z0, z1, cham, rR, s)),
    ...(nR ? bokBack(cfg, nR, 'R', x0, x1, z0, z1, inset)
          : cornerPoints('BR', cfg.right, x0, x1, z0, z1, cham, rR, s)),
    ...(nL ? bokBack(cfg, nL, 'L', x0, x1, z0, z1, inset)
          : cornerPoints('BL', cfg.left, x0, x1, z0, z1, cham, rL, s)),
  ];
}

/**
 * Protáhne uzavřený profil (body {u, y}) po celém obrysu.
 * `u` je odsazení dovnitř od obrysu, `y` je absolutní světová výška.
 * Vzniká uzavřená obruba — přesně tím se dělá ohnutá hrana pracovní desky
 * včetně facetky 45° u zkosené vlny.
 *
 * `profileFn(i)` vrací profil pro i-tý bod obrysu. Profily smí být RŮZNÉ
 * (40mm čelo desky vs. 290mm svislá deska po boku), musí ale mít stejný počet
 * bodů — jinak by se prstence nespárovaly. Tam, kde se profil mezi sousedními
 * body obrysu změní, vznikne uzavírající stěna; když jsou ty body v půdorysu
 * totožné, je ta stěna svislá (schod), jinak šikmá (náběh).
 */
function sweepClosedProfile(profileFn, ringFn, n) {
  const pos = [];
  const cache = new Map();
  const ring = (u) => {
    if (!cache.has(u)) cache.set(u, ringFn(u));
    return cache.get(u);
  };
  const profs = [];
  for (let i = 0; i < n; i++) profs.push(profileFn(i));
  const m = profs[0].length;
  for (let s = 0; s < m; s++) {
    const s2 = (s + 1) % m;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = profs[i][s];
      const a1 = profs[i][s2];
      const b0 = profs[j][s];
      const b1 = profs[j][s2];
      const A0 = ring(a0.u)[i];
      const A1 = ring(a1.u)[i];
      const B0 = ring(b0.u)[j];
      const B1 = ring(b1.u)[j];
      const p0 = [A0.x, a0.y, A0.z];
      const p1 = [A1.x, a1.y, A1.z];
      const p2 = [B1.x, b1.y, B1.z];
      const p3 = [B0.x, b0.y, B0.z];
      pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // neindexovaná geometrie → computeVertexNormals dá PLOCHÉ stínování,
  // takže ohyby zůstanou ostré (SPEC §12.1: poloměry do ~5 mm se ignorují)
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// odvozené roviny a rozměry
// ---------------------------------------------------------------------------

/** Kolik ubere zakončení daného typu z rohu v půdorysu (osa X). */
function endCut(P, type) {
  if (isBok(type)) return noseMetrics(P, type).noseX;
  if (type === 'zkosena') return P.zakonceniZkoseniOdvesna;
  if (type === 'zaoblena') return P.zakonceniZaobleniR50;
  // Vlna: R3. SPEC §12.1 — poloměry do ~5 mm se ve vizualizaci ignorují.
  return P.zakonceniVlnaR3 > 5 ? P.zakonceniVlnaR3 : 0;
}

/** Kolik ubere zakončení daného typu z rohu v půdorysu (osa Z). */
function endCutZ(P, type) {
  if (isBok(type)) return noseMetrics(P, type).dz;
  return endCut(P, type);
}

/** Typ rohu, jak ho má kreslit obrys (vlna s malým R se kreslí ostře). */
function cornerKind(P, type) {
  if (isBok(type)) return 'bok';
  if (type === 'zkosena') return 'zkosena';
  if (type === 'zaoblena') return 'zaoblena';
  return P.zakonceniVlnaR3 > 5 ? 'zaoblena' : 'ostry';
}

export function derive(P, C) {
  const yTop = P.pracovniVyska;
  const yPlateBottom = yTop - P.vyskaCelaDesky;
  const yHerdBottom = yTop - P.vyskaHerdbloku;
  const panelTop = yPlateBottom - P.sparaMeziDeskouAPanelem;
  const panelBottom = yHerdBottom + P.odsazeniSpodniHranyListyOdSpodkuHerdbloku;

  const bodyX1 = P.delkaHerdbloku / 2;
  const bodyX0 = -bodyX1;
  const plateX0 = bodyX0 - P.presahDeskyBocne;
  const plateX1 = bodyX1 + P.presahDeskyBocne;
  const plateZ0 = 0;
  const plateZ1 = P.hloubkaHerdbloku;
  const bodyZ0 = plateZ0 + P.ustoupeniPanelu;
  const bodyZ1 = Math.max(bodyZ0 + P.ustoupeniPanelu, plateZ1 - P.presahDeskyVzadu);

  const cabZ0 = plateZ0 + P.presahDeskyVpredu;
  const cabZ1 = cabZ0 + P.hloubkaPodestavby;
  const cabTop = yHerdBottom - P.sparaMeziHerdblokemAPodestavbou + P.zapusteniHerdblokuDoPodestavby;

  const segs = Math.max(2, Math.round(P.segmentyOblouku));
  // U typu Vlna se poloměr R3 kreslí jako ostrá hrana (SPEC §12.1); pokud ho
  // uživatel v prototypu zvedne nad 5 mm, obrys ho začne modelovat.
  const endRadius = (type) => (type === 'zaoblena' ? P.zakonceniZaobleniR50 : P.zakonceniVlnaR3);
  const bokLeft = noseMetrics(P, C.konecVlevo);
  const bokRight = noseMetrics(P, C.konecVpravo);
  const nose = { left: bokLeft, right: bokRight };
  // společné vlastnosti nosu, které obrys potřebuje krom vlastních průmětů
  const noseCfg = {
    nose,
    noseR: P.bokPolomerSvislychHran,
    nosePred: P.bokPredsazeniCela,
    noseNabeh: P.bokNabehKPaneli,
    noseZat: P.bokZatazeniOdZadniHrany,
    noseZadniRoh: P.bokZadniRohZkoseni,
  };
  const noneCfg = { ...noseCfg, nose: { left: null, right: null } };
  const plateOutline = {
    x0: plateX0, x1: plateX1, z0: plateZ0, z1: plateZ1,
    left: cornerKind(P, C.konecVlevo), right: cornerKind(P, C.konecVpravo),
    chamfer: P.zakonceniZkoseniOdvesna,
    radiusLeft: endRadius(C.konecVlevo),
    radiusRight: endRadius(C.konecVpravo),
    segs,
    ...noseCfg,
  };
  // Vnitřní obrysy. `useNose` říká, jestli díl nos KOPÍRUJE (korpus herdbloku,
  // který se ke svislé desce přivařuje zevnitř), nebo se před ním jen zastaví
  // ostrým koncem (spodní lišta). Kopírovaný nos má vlastní čelní rovinu, proto
  // nosePred = 0 — předsazení řeší už poloha z0 toho dílu.
  const inner = (x0, x1, useNose) => ({
    ...plateOutline, ...(useNose ? { ...noseCfg, nosePred: 0 } : noneCfg),
    x0, x1, z0: bodyZ0, z1: bodyZ1,
    left: bokLeft ? (useNose ? 'bok' : 'ostry') : plateOutline.left,
    right: bokRight ? (useNose ? 'bok' : 'ostry') : plateOutline.right,
    radiusLeft: bokLeft ? 0 : Math.max(0, endRadius(C.konecVlevo) - P.presahDeskyBocne),
    radiusRight: bokRight ? 0 : Math.max(0, endRadius(C.konecVpravo) - P.presahDeskyBocne),
  });
  const bokInset = P.bokPresahDeskyNadBokem + P.bokTloustka + P.bokZatazeniKorpusu;
  const bodyOutline = inner(bodyX0, bodyX1, false);
  const carcassOutline = inner(
    bokLeft ? plateX0 + bokInset : bodyX0,
    bokRight ? plateX1 - bokInset : bodyX1,
    true
  );
  const listaOutline = inner(
    bokLeft ? plateX0 + P.bokZatazeniSpodniListy : bodyX0,
    bokRight ? plateX1 - P.bokZatazeniSpodniListy : bodyX1,
    false
  );

  // konce výklopné plochy panelu
  const panelStop = P.bokZatazeniPanelu + P.bokSparaPanelKBoku;
  const skinX0 = bokLeft ? plateX0 + panelStop : bodyX0 + endCut(P, C.konecVlevo) + P.sparaKolemPanelu;
  const skinX1 = bokRight ? plateX1 - panelStop : bodyX1 - endCut(P, C.konecVpravo) - P.sparaKolemPanelu;

  // zóna bez přístroje na každém konci, měřená od bodyX
  const zone = P.delkaZakonceniBlokuPotvrzeni;
  const devInset = (bok, cut) => (bok
    ? Math.max(zone, cut - P.presahDeskyBocne, panelStop - P.presahDeskyBocne)
    : Math.max(zone, cut));

  // spodek svislé desky
  const yBokBottom = Math.max(0, yHerdBottom - P.bokPresahPodHerdblok);

  return {
    yTop, yPlateBottom, yHerdBottom, panelTop, panelBottom,
    bodyX0, bodyX1, plateX0, plateX1, plateZ0, plateZ1, bodyZ0, bodyZ1,
    cabZ0, cabZ1, cabTop,
    cutLeft: endCut(P, C.konecVlevo),
    cutRight: endCut(P, C.konecVpravo),
    cutZLeft: endCutZ(P, C.konecVlevo),
    cutZRight: endCutZ(P, C.konecVpravo),
    plateOutline, bodyOutline, carcassOutline, listaOutline,
    bokLeft, bokRight, yBokBottom, skinX0, skinX1,
    devInsetLeft: devInset(bokLeft, endCut(P, C.konecVlevo)),
    devInsetRight: devInset(bokRight, endCut(P, C.konecVpravo)),
    chamfered: C.konecVlevo === 'zkosena' || C.konecVpravo === 'zkosena',
  };
}

// ---------------------------------------------------------------------------
// rozmístění přístrojů a podestaveb
// ---------------------------------------------------------------------------

/** Osové polohy výřezů pro přístroje v ose X (zóna zakončení se vynechává). */
function deviceLayout(P, D) {
  const n = Math.round(P.pocetPristroju);
  if (n <= 0) return [];
  const u0 = D.bodyX0 + D.devInsetLeft;
  const u1 = D.bodyX1 - D.devInsetRight;
  const span = u1 - u0;
  // Ochranné pole se nesčítá (SPEC §8.2) — mezi dvěma přístroji platí to větší,
  // nejméně však pristrojOchrannePoleMin. Šířka se v případě nouze ořízne.
  const pole = P.pristrojOchrannePoleMin;
  const w = Math.min(P.sirkaVyrezuPristroje, (span - (n + 1) * pole) / n);
  if (!(w > 0)) return [];
  const gap = Math.max(pole, (span - n * w) / (n + 1));
  const total = n * w + (n - 1) * gap;
  const start = u0 + (span - total) / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = start + i * (w + gap) + w / 2;
    out.push({ x, w });
  }
  return out;
}

/** Vodorovné rozmístění skříněk pod herdblokem. */
function cabinetLayout(P, D) {
  const n = Math.round(P.pocetPodestaveb);
  if (n <= 0) return [];
  const gap = P.mezeraMeziSousednimiPodestavbami;
  const avail0 = D.bodyX0 + P.zapusteniPodestavbyOdKonce;
  const avail1 = D.bodyX1 - P.zapusteniPodestavbyOdKonce;
  // Řada skříněk se nesmí dostat za linii zatažení od konce herdbloku;
  // když se zadané šířky nevejdou, ořežou se. Jinak řada zůstane vystředěná
  // a skutečné zatažení se odečte z převisu v dopočtech.
  const w = Math.min(P.sirkaPodestavby, Math.max(0, (avail1 - avail0 - (n - 1) * gap) / n));
  const pitch = w + gap;
  const total = n * w + (n - 1) * gap;
  const start = (avail0 + avail1) / 2 - total / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x0 = start + i * pitch;
    out.push({
      x0,
      x1: x0 + w,
      // dělicí spára se kreslí ubráním šířky, ať je mezi korpusy vidět zářez
      drawX0: x0 + (i > 0 ? P.sirkaViditelneSparyMeziKorpusy / 2 : 0),
      drawX1: x0 + w - (i < n - 1 ? P.sirkaViditelneSparyMeziKorpusy / 2 : 0),
      // prostřední skříňka je uzavřená s dvířky, ostatní otevřené s policí
      closed: n >= 3 ? i === Math.floor(n / 2) : i === 0 && n === 1,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// pracovní deska
// ---------------------------------------------------------------------------

function buildPlate(g, M, P, C, D) {
  const t = P.silaPlechuDesky;
  const H = P.vyskaCelaDesky;
  const chamfer = D.chamfered;
  // zkosená vlna: viditelné svislé čelo je zúžené, zbytek nahradí facetka 45°
  const facet = chamfer ? Math.max(0, H - P.zuzeneCeloZkoseneVlny) : 0;
  const uSkin = facet + t;
  const uEdge = uSkin + P.zahnutiHranyDeskyDovnitr;
  const rTop = Math.min(P.polomerHorniHranyDesky, facet > 0 ? facet : H / 2);

  // svislá deska po boku
  const anyBok = !!(D.bokLeft || D.bokRight);
  const oh = P.bokPresahDeskyNadBokem;
  const tB = P.bokTloustka;
  const lipB = P.bokZahnutiSpodniHrany;
  const rB = oh > 0 ? 0 : Math.min(P.bokPolomerPrehybuNahore, P.vyskaHerdbloku / 2);
  const yB = D.yBokBottom;
  // Horní plech musí sahat dovnitř aspoň za vnitřní líc svislé desky, jinak by
  // se plocha desky a vnitřní stěna boku překrývaly.
  const uLip = anyBok ? Math.max(uEdge, oh + tB) : uEdge;

  const ringFn = (u) => outlineRing(D.plateOutline, u);
  const ring0 = ringFn(0);
  const kinds = ring0.map((p) => p.kind);
  const y = D.yTop;

  // Uzavřený profil ohnuté hrany, obcházený proti směru hodinových ručiček
  // v rovině (u = dovnitř, y = výška). Oba profily mají STEJNÝ počet bodů,
  // aby se daly na přechodu spárovat; degenerované body se samy zahodí.
  const plateProfile = [
    { u: rTop, y },
    { u: 0, y: y - rTop },
    facet > 0 ? { u: facet, y: y - facet } : { u: 0, y: y - rTop },
    { u: facet, y: y - H },
    { u: uEdge, y: y - H },
    { u: uEdge, y: y - H + t },
    { u: uSkin, y: y - H + t },
    { u: uSkin, y: y - t },
    { u: uLip, y: y - t },
    { u: uLip, y },
  ];
  const bokProfile = [
    { u: rB, y },
    { u: 0, y: y - Math.max(rB, oh > 0 ? t : 0) },
    { u: oh, y: y - Math.max(t, rB) },
    { u: oh, y: yB },
    { u: oh + tB + lipB, y: yB },
    { u: oh + tB + lipB, y: yB + t },
    { u: oh + tB, y: yB + t },
    { u: oh + tB, y: y - t },
    { u: uLip, y: y - t },
    { u: uLip, y },
  ];
  const profileFn = (i) => (kinds[i] === 'bok' ? bokProfile : plateProfile);

  addMesh(g, sweepClosedProfile(profileFn, ringFn, ring0.length), M.steelShell, 'deska-hrana');

  // zahnutí zadní hrany svislé desky dovnitř (výztužný lem volné hrany)
  if (anyBok && P.bokZahnutiZadniHrany > 0 && yB + t < y - t) {
    for (const end of [
      { bok: D.bokLeft, x: D.plateX0, dir: 1 },
      { bok: D.bokRight, x: D.plateX1, dir: -1 },
    ]) {
      if (!end.bok) continue;
      const zc = Math.max(D.plateZ0 - P.bokPredsazeniCela + end.bok.dz, D.plateZ1 - P.bokZatazeniOdZadniHrany);
      const xi = end.x + end.dir * (oh + tB);
      const xj = xi + end.dir * P.bokZahnutiZadniHrany;
      box(g, M.steel, Math.min(xi, xj), Math.max(xi, xj), yB + t, y - t, zc - t, zc, 'bok-lem-zadni');
    }
  }

  // horní plech desky s výřezy pro přístroje
  const devices = deviceLayout(P, D);
  const zDev0 = Math.max(
    D.plateZ0 + P.pristrojOdPredniHranyMin,
    Math.min(
      D.plateZ0 + P.pristrojOdPredniHranyStandard,
      D.plateZ1 - P.pristrojOdZadniHranyMin - P.hloubkaVyrezuPristroje
    )
  );
  const zDev1 = zDev0 + P.hloubkaVyrezuPristroje;
  const holes = devices.map((d) => rectFootprint(d.x - d.w / 2, d.x + d.w / 2, zDev0, zDev1));
  const cap = extrudeFootprint(ringFn(uLip), holes, y - t, y);
  if (cap) addMesh(g, cap, M.steel, 'deska-plech');

  // navařené lemy kolem otvorů + tmavý přístroj pod nimi
  for (const d of devices) {
    const lem = P.sirkaLemuKolemOtvoruProPristroj;
    if (lem > 0) {
      const geo = extrudeFootprint(
        rectFootprint(d.x - d.w / 2 - lem, d.x + d.w / 2 + lem, zDev0 - lem, zDev1 + lem),
        [rectFootprint(d.x - d.w / 2, d.x + d.w / 2, zDev0, zDev1)],
        y - t, y + P.vyskaLemuNadDeskou
      );
      if (geo) addMesh(g, geo, M.steel, 'lem-vyrezu');
    }
    box(g, M.device, d.x - d.w / 2, d.x + d.w / 2, y - H + t, y - t, zDev0, zDev1, 'pristroj');
  }
  return { zDev0, zDev1, devices };
}

// ---------------------------------------------------------------------------
// těleso herdbloku (ovládací panel, spodní lišta, ovladače)
// ---------------------------------------------------------------------------

function buildHerdblok(g, M, P, C, D, dev) {
  const skinT = P.silaPlechuDesky;

  // korpus herdbloku — obrys protažený od spodku po horní hranu panelu.
  // Čelo je odsazené o tloušťku výklopné plechové desky panelu, aby se dala
  // samostatně vyklopit, aniž by se plochy překrývaly.
  const carcass = {
    ...D.carcassOutline,
    z0: D.carcassOutline.z0 + skinT,
  };
  const geo = extrudeFootprint(outlineRing(carcass, 0), null, D.panelBottom, D.panelTop);
  if (geo) addMesh(g, geo, M.panel, 'herdblok-korpus');

  // spodní plech herdbloku (vidět pod mostem a pod převisem)
  if (P.tloustkaSpodnihoPlechuHerdbloku > 0) {
    const bot = extrudeFootprint(
      outlineRing(D.carcassOutline, 0), null,
      D.panelBottom, D.panelBottom + P.tloustkaSpodnihoPlechuHerdbloku
    );
    if (bot) addMesh(g, bot, M.panel, 'herdblok-spodni-plech');
  }

  // spodní lišta — je součástí panelu a vrací se dopředu skoro do líce desky
  const step = P.ustoupeniPanelu - P.predsazeniSpodniListyPanelu;
  if (step > 0 && P.vyskaSpodniListy > 0) {
    const y0 = D.panelBottom;
    const y1 = y0 + P.vyskaSpodniListy;
    const prof = [
      { u: 0, y: y0 },
      { u: -step, y: y0 },
      { u: -step, y: y1 },
      { u: 0, y: y1 + P.tvarPrechoduPanelDoListy },
    ];
    const ringFn = (u) => outlineRing(D.listaOutline, u);
    const n = ringFn(0).length;
    addMesh(g, sweepClosedProfile(() => prof, ringFn, n), M.steelShell, 'spodni-lista');
  }

  // --- výklopná plocha panelu + ovladače -----------------------------------
  const skinX0 = D.skinX0;
  const skinX1 = D.skinX1;
  const skinY0 = D.panelBottom + P.vyskaSpodniListy + P.tvarPrechoduPanelDoListy;
  const skinY1 = D.panelTop;
  const skinZ0 = D.bodyZ0;
  const skinZ1 = D.bodyZ0 + skinT;

  const flap = new THREE.Group();
  flap.name = 'vyklopny-panel';
  g.add(flap);
  box(flap, M.panel, skinX0, skinX1, skinY0, skinY1, skinZ0, skinZ1, 'panel-lic');

  // ovládací skupiny pod přístroji
  const knobR = P.prumerOtocnehoOvladace / 2;
  const knobY = skinY1 - P.vyskaOsyOvladacuOdHornihoOkrajePanelu;
  const nk = Math.round(P.pocetOvladacuVeSkupine);
  for (const d of dev.devices) {
    for (let i = 0; i < nk; i++) {
      const x = d.x + (i - (nk - 1) / 2) * P.roztecOvladacuVeSkupine;
      if (x - knobR < skinX0 || x + knobR > skinX1) continue;
      const kg = new THREE.CylinderGeometry(knobR, knobR * 0.94, P.vylozeniOtocnehoOvladace, 24);
      kg.rotateX(Math.PI / 2);
      kg.translate(x, knobY, skinZ0 - P.vylozeniOtocnehoOvladace / 2);
      addMesh(flap, kg, M.knob, 'ovladac');
      // drobné tlačítko nad každým ovladačem
      if (P.prumerTlacitka > 0) {
        const bg = new THREE.CylinderGeometry(P.prumerTlacitka / 2, P.prumerTlacitka / 2, P.silaPlechuDesky * 2, 16);
        bg.rotateX(Math.PI / 2);
        bg.translate(x, skinY1 - P.prumerTlacitka, skinZ0 - P.silaPlechuDesky);
        addMesh(flap, bg, M.button, 'tlacitko');
      }
    }
  }

  // zásuvka 230 V mezi první a druhou skupinou
  if (dev.devices.length >= 2 && P.rozmerCelaZasuvky230V > 0) {
    const xs = (dev.devices[0].x + dev.devices[1].x) / 2;
    const w = P.rozmerCelaZasuvky230V;
    box(flap, M.socket, xs - w / 2, xs + w / 2, knobY - w / 2, knobY + w / 2,
      skinZ0 - P.silaPlechuDesky, skinZ0, 'zasuvka-230V');
  }

  // Vyklopení panelu — rotace kolem SPODNÍ hrany výklopného dílu.
  // Geometrie dílů je vytvořená rovnou ve světových souřadnicích, proto se
  // před otočením posune o −pivot a skupina se posadí zpět na pivot.
  if (P.hloubkaVyklopeniPanelu > 0) {
    const h = skinY1 - skinY0;
    if (h > 0) {
      for (const child of flap.children) child.geometry.translate(0, -skinY0, -skinZ0);
      flap.position.set(0, skinY0, skinZ0);
      // záporný úhel = horní hrana jde dopředu (čelo je na straně −z)
      flap.rotation.x = -Math.asin(Math.min(1, P.hloubkaVyklopeniPanelu / h));
    }
  }
}

// ---------------------------------------------------------------------------
// límec
// ---------------------------------------------------------------------------

function buildCollar(g, M, P, C, D) {
  if (C.limec === 'zadny') return;
  const t = P.tloustkaPlechuLimce;
  const off = P.odsazeniLimceOdHranyDesky;
  const y0 = D.yTop;
  const y1 = y0 + P.limecVyska;
  const back = C.limec === 'zadni' || C.limec === 'oba';
  const side = C.limec === 'bocni' || C.limec === 'oba';
  // Límec smí být JEN na rovných hranách (SPEC §4.4), proto se zkosené
  // a zaoblené rohy z rozsahu vynechávají.
  const zBackOuter = D.plateZ1 - off;
  const zBackInner = zBackOuter - t;

  if (back) {
    box(g, M.steel, D.plateX0 + D.cutLeft, D.plateX1 - D.cutRight, y0, y1, zBackInner, zBackOuter, 'limec-zadni');
    if (P.zahnutiHorniHranyLimce > 0) {
      box(g, M.steel, D.plateX0 + D.cutLeft, D.plateX1 - D.cutRight, y1 - t, y1,
        zBackInner - P.zahnutiHorniHranyLimce, zBackInner, 'limec-zadni-lem');
    }
  }
  if (side) {
    for (const end of [
      { x: D.plateX0, cut: D.cutLeft, cutZ: D.cutZLeft, bok: D.bokLeft, left: true },
      { x: D.plateX1, cut: D.cutRight, cutZ: D.cutZRight, bok: D.bokRight, left: false },
    ]) {
      // Ve variantě se svislou deskou smí límec stát přímo nad jejím vnějším
      // lícem — bok bloku je pak jedna svislá rovina od horní hrany límce dolů.
      const flush = end.bok && P.limecZarovnatSBocnici >= 0.5;
      const o = flush ? 0 : off;
      const xa = end.left ? end.x + o : end.x - o - t;
      const xb = end.left ? end.x + o + t : end.x - o;
      // je-li i zadní límec, boční na něj dojede, ať v rohu nezůstane mezera
      const zEnd = back ? zBackInner : D.plateZ1 - end.cut;
      box(g, M.steel, xa, xb, y0, y1, D.plateZ0 + end.cutZ, zEnd, 'limec-bocni');
      if (P.zahnutiHorniHranyLimce > 0) {
        const la = end.left ? xb : xa - P.zahnutiHorniHranyLimce;
        const lb = end.left ? xb + P.zahnutiHorniHranyLimce : xa;
        box(g, M.steel, la, lb, y1 - t, y1, D.plateZ0 + end.cutZ, zEnd, 'limec-bocni-lem');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// podestavby
// ---------------------------------------------------------------------------

/**
 * Průřez korpusu skříňky v rovině XY, protažený po hloubce.
 * Právě tady se dělá hygienický stupeň: H2 zaoblí kouty mezi podlážkou
 * a stěnami, H3 přidá horní plech a zaoblí všechny kouty.
 */
function cabinetShape(P, C, x0, x1, yBot, yTop) {
  const t = P.tloustkaSteny;
  const yFloor = yBot + P.tloustkaPodlazky;
  const inner0 = x0 + t;
  const inner1 = x1 - t;
  const hasTop = C.hygiena === 'H3';
  const yInnerTop = hasTop ? yTop - t : yTop;
  const rMax = Math.min((inner1 - inner0) / 2, (yInnerTop - yFloor) / 2);
  const r = (C.hygiena === 'H2' || C.hygiena === 'H3') ? Math.min(P.radiusH2, Math.max(0, rMax)) : 0;

  const shape = new THREE.Shape();
  if (hasTop) {
    shape.moveTo(x0, yBot);
    shape.lineTo(x1, yBot);
    shape.lineTo(x1, yTop);
    shape.lineTo(x0, yTop);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(inner0 + r, yFloor);
    hole.lineTo(inner1 - r, yFloor);
    if (r > 0) hole.absarc(inner1 - r, yFloor + r, r, -Math.PI / 2, 0, false);
    hole.lineTo(inner1, yInnerTop - r);
    if (r > 0) hole.absarc(inner1 - r, yInnerTop - r, r, 0, Math.PI / 2, false);
    hole.lineTo(inner0 + r, yInnerTop);
    if (r > 0) hole.absarc(inner0 + r, yInnerTop - r, r, Math.PI / 2, Math.PI, false);
    hole.lineTo(inner0, yFloor + r);
    if (r > 0) hole.absarc(inner0 + r, yFloor + r, r, Math.PI, Math.PI * 1.5, false);
    hole.closePath();
    shape.holes.push(hole);
  } else {
    // otevřené „U" — dvě stěny a podlážka, bez horního plechu
    shape.moveTo(x0, yBot);
    shape.lineTo(x1, yBot);
    shape.lineTo(x1, yTop);
    shape.lineTo(inner1, yTop);
    shape.lineTo(inner1, yFloor + r);
    if (r > 0) shape.absarc(inner1 - r, yFloor + r, r, 0, -Math.PI / 2, true);
    shape.lineTo(inner0 + r, yFloor);
    if (r > 0) shape.absarc(inner0 + r, yFloor + r, r, -Math.PI / 2, -Math.PI, true);
    shape.lineTo(inner0, yTop);
    shape.lineTo(x0, yTop);
    shape.closePath();
  }
  return shape;
}

function buildCabinets(g, M, P, C, D, cabs) {
  const yBot = P.vyskaNozicek;
  const yTop = D.cabTop;
  if (!(yTop > yBot)) return;

  for (const cab of cabs) {
    const x0 = cab.drawX0;
    const x1 = cab.drawX1;
    const t = P.tloustkaSteny;
    const yFloor = yBot + P.tloustkaPodlazky;
    const zBack = D.cabZ1 - P.tloustkaZadniStenySkrinky;

    // korpus (stěny + podlážka + případný horní plech) jako jeden protažený profil
    const shape = cabinetShape(P, C, x0, x1, yBot, yTop);
    const rEdge = P.zaobleniSvislychRohuKorpusu;
    const useBevel = rEdge > 0.5 && D.cabZ1 - D.cabZ0 > 4 * rEdge;
    // Svislé rohy korpusu: bevel ExtrudeGeometry zaobluje obrys na koncích
    // protažení. bevelOffset = −bevelSize sráží konce DOVNITŘ, takže vnější
    // rozměr skříňky zůstane přesně takový, jaký je zadaný.
    const opts = useBevel
      ? {
          depth: (D.cabZ1 - D.cabZ0) - 2 * rEdge, bevelEnabled: true,
          bevelThickness: rEdge, bevelSize: rEdge, bevelOffset: -rEdge,
          bevelSegments: 2, curveSegments: 6,
        }
      : { depth: D.cabZ1 - D.cabZ0, bevelEnabled: false, curveSegments: 6 };
    const geo = new THREE.ExtrudeGeometry(shape, opts);
    geo.translate(0, 0, D.cabZ0 + (useBevel ? rEdge : 0));
    addMesh(g, geo, M.steel, 'korpus-skrinky');

    // zadní stěna
    box(g, M.steel, x0 + t, x1 - t, yFloor, yTop, zBack, D.cabZ1, 'zada-skrinky');
    // příčná lišta 20 × 20 jen vpředu
    box(g, M.steel, x0 + t, x1 - t, yTop - P.pricnaListaVyska, yTop,
      D.cabZ0, D.cabZ0 + P.pricnaListaHloubka, 'pricna-lista');

    // tmavá dutina, ať otvor vypadá jako otvor (materiál BackSide — vidět jsou
    // jen odvrácené stěny, takže to působí jako skutečný vnitřek)
    const c = P.silaPlechuKorpusu;
    const cavity = box(g, M.cavity, x0 + t + c, x1 - t - c, yFloor + c,
      yTop - P.pricnaListaVyska - c, D.cabZ0 + c, zBack - c, 'dutina');
    if (cavity) { cavity.castShadow = false; cavity.receiveShadow = false; }

    if (cab.closed) {
      // uzavřená skříňka s dvířky uprostřed
      const gap = P.mezeraMeziDvirky;
      const dy0 = yFloor + gap;
      const dy1 = yTop - P.pricnaListaVyska - gap;
      const dx0 = x0 + t + gap;
      const dx1 = x1 - t - gap;
      const mid = (dx0 + dx1) / 2;
      const dz0 = D.cabZ0;
      const dz1 = D.cabZ0 + P.tloustkaDvirek;
      for (const [a, b] of [[dx0, mid - gap / 2], [mid + gap / 2, dx1]]) {
        box(g, M.steel, a, b, dy0, dy1, dz0, dz1, 'dvirka');
        const hp = P.prurezUchytkyDvirek;
        box(g, M.steel, a + hp, b - hp, dy1 - 2 * hp, dy1 - hp,
          dz0 - P.vylozeniUchytkyDvirek, dz0, 'uchytka');
      }
    } else {
      // otevřená skříňka: lem kolem otvoru + police
      const lem = P.sirkaLemuKolemOtvoruSkrinky;
      if (lem > 0) {
        const oy1 = yTop - P.pricnaListaVyska;
        const lz1 = D.cabZ0 + P.silaPlechuKorpusu * 2;
        box(g, M.steel, x0 + t, x1 - t, yFloor, yFloor + lem, D.cabZ0, lz1, 'lem-dole');
        box(g, M.steel, x0 + t, x1 - t, oy1 - lem, oy1, D.cabZ0, lz1, 'lem-nahore');
        box(g, M.steel, x0 + t, x0 + t + lem, yFloor, oy1, D.cabZ0, lz1, 'lem-vlevo');
        box(g, M.steel, x1 - t - lem, x1 - t, yFloor, oy1, D.cabZ0, lz1, 'lem-vpravo');
      }
      const np = Math.round(P.pocetPolic);
      for (let i = 0; i < np; i++) {
        const sy = yFloor + P.vyskaPoliceNadPodlazkou * (i + 1);
        if (sy + P.tloustkaPolice > yTop - P.pricnaListaVyska) break;
        box(g, M.steel, x0 + t, x1 - t, sy, sy + P.tloustkaPolice,
          D.cabZ0 + P.zapusteniPoliceOdCela, zBack, 'police');
      }
    }

    // nožičky
    if (C.sokl === 'zadny' || C.sokl === 'nozicky') {
      const s = P.rozmerNozicky;
      const ins = Math.min(P.odsazeniNozickyOdRohu, (x1 - x0) / 2 - s, (D.cabZ1 - D.cabZ0) / 2 - s);
      const inset = Math.max(0, ins);
      for (const lx of [x0 + inset, x1 - inset - s]) {
        for (const lz of [D.cabZ0 + inset, D.cabZ1 - inset - s]) {
          box(g, M.plinth, lx, lx + s, 0, P.vyskaNozicek, lz, lz + s, 'nozicka');
        }
      }
    }
  }
}

function buildPlinth(g, M, P, C, D, cabs) {
  if (C.sokl === 'zadny' || cabs.length === 0) return;
  const x0 = cabs[0].x0;
  const x1 = cabs[cabs.length - 1].x1;
  const o = P.odsazeniSoklu;
  const sx0 = x0 + o;
  const sx1 = x1 - o;
  const sz0 = D.cabZ0 + o;
  const sz1 = D.cabZ1 - o;
  const y0 = P.mezeraSokluNadPodlahou;

  if (C.sokl === 'stavebni') {
    // stavební sokl — plný blok pod celým blokem
    box(g, M.plinth, sx0, sx1, 0, P.vyskaNozicek, sz0, sz1, 'stavebni-sokl');
    return;
  }
  const t = C.sokl === 'konstrukcni' ? P.prurezRamuKonstrukcnihoSoklu : P.tloustkaSoklovehoPanelu;
  const h = C.sokl === 'konstrukcni' ? P.vyskaNozicek : Math.min(P.vyskaSoklu, P.vyskaNozicek - y0);
  frameBox(g, M.plinth, sx0, sx1, sz0, sz1, t, y0, y0 + h, 'sokl');
}

/** Krycí panel na bok skříněk pod zakončením herdbloku. */
function buildSideCovers(g, M, P, C, D, cabs) {
  if (cabs.length === 0) return;
  const t = P.tloustkaBocnihoKrytu;
  const zBack = D.cabZ1;
  const ends = [
    { bok: D.bokLeft, dir: 1, plateX: D.plateX0, cabX: cabs[0].x0, name: 'bocni-kryt-vlevo' },
    { bok: D.bokRight, dir: -1, plateX: D.plateX1, cabX: cabs[cabs.length - 1].x1, name: 'bocni-kryt-vpravo' },
  ];
  for (const end of ends) {
    if (end.bok) {
      // Kryt navazuje na SPODNÍ hranu svislé desky, ne na horní líc podestavby —
      // jinak by mezi nimi zůstal schod, ať se posuvníky nastaví jakkoli.
      const y1 = D.yBokBottom - P.bokSparaKrytuPodDeskou;
      const y0 = Math.max(0, D.yTop - P.vyskaBocnihoKrytu);
      if (!(y1 > y0)) continue;
      // vnější líc krytu: buď v rovině svislé desky, nebo (0) na hraně skříňky
      const xOut = P.bokKrytZarovnatSBocnici >= 0.5
        ? end.plateX - end.dir * P.bokZarovnaniKrytuSkrinky
        : end.cabX;
      const xIn = xOut + end.dir * t;
      const zN = D.plateZ0 - P.bokPredsazeniCela;
      let foot;
      if (P.bokKrytKopirujeCelo >= 0.5) {
        // stejný nos jako svislá deska, jen oříznutý tloušťkou krytu
        const dx = Math.min(end.bok.dx, t);
        const dz = end.bok.dx > 0 ? end.bok.dz * (dx / end.bok.dx) : 0;
        foot = [
          { x: xIn, z: zN },
          { x: xOut + end.dir * dx, z: zN },
          { x: xOut, z: zN + dz },
          { x: xOut, z: zBack },
          { x: xIn, z: zBack },
        ];
      } else {
        const zFront = D.cabZ0 - P.presahBocnihoKrytuPresLicPodestavby;
        foot = rectFootprint(Math.min(xIn, xOut), Math.max(xIn, xOut), zFront, zBack);
      }
      const geo = extrudeFootprint(foot, null, y0, y1);
      if (geo) addMesh(g, geo, M.steel, end.name);
      continue;
    }
    // původní chování ostatních zakončení: kryt visí na hraně krajní skříňky
    const extra = P.vyskaBocnihoKrytu - P.vyskaHerdbloku;
    if (!(extra > 0)) continue;
    const y1 = D.cabTop;
    const y0 = Math.max(0, y1 - extra);
    const z0 = D.cabZ0 - P.presahBocnihoKrytuPresLicPodestavby;
    const xa = end.dir > 0 ? end.cabX - t : end.cabX;
    box(g, M.steel, xa, xa + t, y0, y1, z0, zBack, end.name);
  }
}

// ---------------------------------------------------------------------------
// veřejné API
// ---------------------------------------------------------------------------

/**
 * Postaví celý blok z parametrů. Vrací THREE.Group V MILIMETRECH.
 * @param {Record<string,number>} P číselné parametry (params.js)
 * @param {Record<string,string>} C přepínače (params.js)
 */
export function buildBlock(P, C) {
  const g = new THREE.Group();
  g.name = 'blok';
  const M = makeMaterials(P);
  const D = derive(P, C);
  const cabs = cabinetLayout(P, D);

  buildCabinets(g, M, P, C, D, cabs);
  buildPlinth(g, M, P, C, D, cabs);
  buildSideCovers(g, M, P, C, D, cabs);
  const dev = buildPlate(g, M, P, C, D);
  buildHerdblok(g, M, P, C, D, dev);
  buildCollar(g, M, P, C, D);

  g.userData.derived = D;
  g.userData.checks = supportChecks(P, D, cabs);
  return g;
}

/** Převis vlevo/vpravo a největší most (SPEC §3) — jen pro hlášení. */
export function supportChecks(P, D, cabs) {
  if (cabs.length === 0) {
    return { prevysVlevo: D.bodyX1 - D.bodyX0, prevysVpravo: 0, most: 0 };
  }
  let most = 0;
  for (let i = 1; i < cabs.length; i++) {
    most = Math.max(most, cabs[i].x0 - cabs[i - 1].x1);
  }
  return {
    prevysVlevo: cabs[0].x0 - D.bodyX0,
    prevysVpravo: D.bodyX1 - cabs[cabs.length - 1].x1,
    most,
  };
}

/**
 * Uklidí skupinu — uvolní geometrie a materiály označené jako disposable.
 * Bez tohohle by tahání posuvníků postupně sežralo paměť.
 */
export function disposeGroup(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of list) if (m) materials.add(m);
    }
  });
  for (const m of materials) {
    if (m.userData && m.userData.disposable) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  }
  if (group.parent) group.parent.remove(group);
}
