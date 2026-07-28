// modules.js — tovární funkce pro stavbu jednotlivých SEGMENTŮ varného bloku
// (SPEC v3). Katalogové přístroje (§3.1–3.3) se čtou z catalog.js — zde je
// jen vykreslovací logika (podestavba + panel + ovládací prvky + typové
// detaily na desce), nikoli data katalogu samotná.
//
// PRŮBĚŽNÁ pracovní deska (jedna, přes celý blok) se staví v block.js. Zde se
// staví jen podestavby jednotlivých segmentů.
//
// Souřadný systém jednoho segmentu (lokální prostor skupiny):
//   x .. podél šířky segmentu, střed v x = 0
//   y .. nahoru, y = 0 je podlaha
//   z .. hloubka, z = 0 je čelo (přední strana směrem k obsluze/kameře)

import * as THREE from 'three';
import {
  createStainlessMaterial,
  createPanelMaterial,
  createPlinthMaterial,
  createKnobMaterial,
  createButtonMaterial,
  createSwitchMaterial,
  createCastIronMaterial,
  createGlassCeramicMaterial,
  createGlassMaterial,
  createRecessMaterial,
  createCavityMaterial,
  createEdgeMaterial,
  createBitmapMaterial,
  createLogoMaterial,
  loadBitmapTexture,
} from './materials.js';
import { getById as getCatalogEntry } from './catalog.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// --- Standardní rozměry (v metrech) -----------------------------------------
export const TOP_THICKNESS = 0.05; // tloušťka pracovní desky (50 mm)
export const PLINTH_HEIGHT = 0.15; // výška soklu (150 mm)
export const PANEL_HEIGHT = 0.2; // výška čelního ovládacího panelu (200 mm)

// --- Meze zadatelných rozměrů (mm) ------------------------------------------
export const LENGTH_MIN = 1200;
export const LENGTH_MAX = 6000;
export const LENGTH_STEP = 50;

export const DEPTH_MIN = 500;
export const DEPTH_MAX = 1200;
export const DEPTH_STEP = 10;

export const HEIGHT_MIN = 850;
export const HEIGHT_MAX = 950;
export const HEIGHT_STEP = 10;

export const NEUTRAL_WIDTH_MIN = 200;
export const NEUTRAL_WIDTH_MAX = 1200;
export const NEUTRAL_WIDTH_STEP = 50;

export const CUSTOM_WIDTH_MAX = 1200;
export const CUSTOM_CONTROLS_MAX = 8;

// katalogové přístroje s nastavitelnou šířkou podestavby (indukce, dřez)
export const CATALOG_WIDTH_MAX = 1200;
export const CATALOG_WIDTH_STEP = 50;

// dřez — rozměry vany jsou vlastností INSTANCE segmentu (ne katalogu)
export const SINK_VAT_WIDTH_MIN = 300;
export const SINK_VAT_WIDTH_MAX = 900;
export const SINK_VAT_WIDTH_STEP = 50;
export const SINK_VAT_WIDTH_DEFAULT = 600;
export const SINK_VAT_DEPTH_MIN = 300;
export const SINK_VAT_DEPTH_MAX = 700;
export const SINK_VAT_DEPTH_STEP = 50;
export const SINK_VAT_DEPTH_DEFAULT = 500;
// šířka podestavby dřezu musí být >= šířka vany + tato rezerva
export const SINK_WIDTH_MARGIN_MM = 100;

export const CONTROL_TYPES = [
  { value: 'knob', label: 'Knoflík' },
  { value: 'button', label: 'Tlačítko' },
  { value: 'switch', label: 'Přepínač' },
];

export const NEUTRAL_TYPE = 'neutral';
export const CUSTOM_TYPE = 'custom';

/** Vrátí definici katalogového přístroje (nebo undefined) — viz catalog.js. */
export function getInstrumentDef(type) {
  return getCatalogEntry(type);
}

/** Lidsky čitelný název segmentu (pro seznam v UI). */
export function getSegmentLabel(segment) {
  if (segment.type === NEUTRAL_TYPE) return 'Neutrální modul';
  if (segment.type === CUSTOM_TYPE) return segment.name ? `Vlastní: ${segment.name}` : 'Vlastní modul';
  const def = getCatalogEntry(segment.type);
  return def ? def.name : segment.type;
}

/** Vrátí šířku segmentu v mm (instance-aware — neutrál/custom i nastavitelné
 *  katalogové přístroje mají vlastní šířku uloženou na instanci). */
export function getSegmentWidthMM(segment) {
  if (segment.type === NEUTRAL_TYPE || segment.type === CUSTOM_TYPE) {
    return Math.round(segment.widthMM) || 0;
  }
  const def = getCatalogEntry(segment.type);
  const instanceWidth = Number(segment.widthMM);
  if (Number.isFinite(instanceWidth) && instanceWidth > 0) return Math.round(instanceWidth);
  return def ? def.widthMM : 400; // neznámý typ (např. z cizí konfigurace) — bezpečný odhad
}

// --- Obrysové hrany ----------------------------------------------------------

/** Přidá k mesh objektu obrysové hrany (EdgesGeometry) jako dítě — sdílí transformaci. */
function addEdges(mesh) {
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), createEdgeMaterial());
  mesh.add(edges);
  return mesh;
}

function box(width, height, depth, material, withEdges = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (withEdges) addEdges(mesh);
  return mesh;
}

// --- Základní stavební bloky sdílené všemi segmenty ---------------------------

/** Sokl (podstavba) — grafitový, mírně zapuštěný. */
export function buildPlinth(group, widthM, depthM) {
  const plinth = box(widthM - 0.006, PLINTH_HEIGHT, depthM - 0.006, createPlinthMaterial());
  plinth.position.set(0, PLINTH_HEIGHT / 2, depthM / 2);
  group.add(plinth);
}

/**
 * Uzavřený korpus (plný box) — používá se u přístrojů, vlastního modulu,
 * výplně a u neutrálního modulu s dvířky (jako podklad pod dvířky).
 */
function buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY) {
  const height = bodyTopY - bodyBottomY;
  const body = box(widthM - 0.003, height, depthM - 0.003, createStainlessMaterial());
  body.position.set(0, bodyBottomY + height / 2, depthM / 2);
  group.add(body);
  return body;
}

// --- Otevřená podestavba (§4 SPEC v3 — oprava dutiny a police) ---------------

const OPEN_WALL_T = 0.018; // tloušťka boků/dna/zad
const OPEN_LIP_DEPTH = 0.02; // hloubka rámového lemu kolem otvoru
const OPEN_SHELF_RECESS_M = 0.025; // police zapuštěná 25 mm od čela (rozsah 20–30 mm)
const OPEN_SHELF_THICKNESS = 0.02;

/**
 * Otevřená podestavba — rám (boky/dno/záda/lem) + čitelná světlejší dutina +
 * volitelná police vystředěná v dutině a zapuštěná od čela.
 * `cavityTopY` je horní hranice DUTINY (pokud segment má panel, dutina pod
 * ním končí — panel do dutiny nepatří), zatímco `bodyTopY` je plná
 * konstrukční výška korpusu (boky jdou až k desce i za panelem).
 */
function buildOpenBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, hasShelf) {
  const stainless = createStainlessMaterial();
  const cavity = createCavityMaterial();
  const height = bodyTopY - bodyBottomY;
  const wallT = OPEN_WALL_T;
  const lipDepth = OPEN_LIP_DEPTH;

  // boční stěny (celá výška korpusu, i za panelem — žádná díra vzadu)
  [-1, 1].forEach((side) => {
    const wall = box(wallT, height, depthM, stainless);
    wall.position.set((side * (widthM - wallT)) / 2, bodyBottomY + height / 2, depthM / 2);
    group.add(wall);
  });

  // zadní stěna
  const back = box(widthM - wallT * 2, height, wallT, stainless);
  back.position.set(0, bodyBottomY + height / 2, depthM - wallT / 2);
  group.add(back);

  // dno
  const bottom = box(widthM - wallT * 2, wallT, depthM - wallT, stainless);
  bottom.position.set(0, bodyBottomY + wallT / 2, depthM / 2 + wallT / 2);
  group.add(bottom);

  // rámový lem kolem otvoru (nahoře i dole) — dá dojem hloubky a lemuje otvor nerezem
  const lipTop = box(widthM - wallT * 2, wallT, lipDepth, stainless);
  lipTop.position.set(0, bodyBottomY + height - wallT / 2, lipDepth / 2);
  group.add(lipTop);
  const lipBottom = box(widthM - wallT * 2, wallT, lipDepth, stainless);
  lipBottom.position.set(0, bodyBottomY + wallT / 2, lipDepth / 2);
  group.add(lipBottom);

  // viditelná světlejší dutina — od dna po cavityTopY (pod panelem, pokud existuje)
  const cavityBottomY = bodyBottomY + wallT;
  const cavityHeight = Math.max(cavityTopY - cavityBottomY, 0.02);
  const innerWidth = Math.max(widthM - wallT * 2 - 0.01, 0.02);
  const cavityDepth = Math.max(depthM - wallT - lipDepth - 0.005, 0.05);
  const innerCavity = new THREE.Mesh(new THREE.BoxGeometry(innerWidth, cavityHeight, cavityDepth), cavity);
  innerCavity.position.set(0, cavityBottomY + cavityHeight / 2, lipDepth + cavityDepth / 2);
  innerCavity.receiveShadow = true;
  group.add(innerCavity);

  if (hasShelf) {
    // police vystředěná ve VÝŠCE dutiny, zapuštěná od čela (nevyčnívá přes lem)
    const shelfDepth = Math.max(depthM - wallT - OPEN_SHELF_RECESS_M - 0.01, 0.05);
    const shelf = box(innerWidth - 0.005, OPEN_SHELF_THICKNESS, shelfDepth, stainless);
    const shelfCenterY = cavityBottomY + cavityHeight / 2;
    shelf.position.set(0, shelfCenterY, OPEN_SHELF_RECESS_M + shelfDepth / 2);
    group.add(shelf);
  }
}

/** Podestavba s dvířky — uzavřený korpus + křídlová dvířka s úchytkami. */
function buildDoorBody(group, widthM, depthM, bodyBottomY, bodyTopY) {
  buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
  const stainless = createStainlessMaterial();
  const knobMat = createKnobMaterial();
  const height = bodyTopY - bodyBottomY;
  const centerY = bodyBottomY + height / 2;

  const doorCount = widthM > mm(600) ? 2 : 1;
  const doorWidth = widthM / doorCount;
  for (let i = 0; i < doorCount; i++) {
    const xCenter = -widthM / 2 + doorWidth * (i + 0.5);
    const door = box(doorWidth - 0.02, height - 0.02, 0.008, stainless);
    door.position.set(xCenter, centerY, -0.006);
    group.add(door);

    // úchytka blíž ke středové spáře (u dvoukřídlých) nebo k okraji (u jednokřídlých)
    const handleX = doorCount === 2
      ? xCenter + (i === 0 ? doorWidth * 0.36 : -doorWidth * 0.36)
      : xCenter + doorWidth * 0.32;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, height * 0.28, 12), knobMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(handleX, centerY, -0.014);
    handle.castShadow = true;
    group.add(handle);
  }
}

/**
 * Postaví "tělo" podestavby dle stylu — dispatcher pro closed / open / doors.
 * `cavityTopY`/`hasShelf` se využijí jen u stylu 'open' (viz buildOpenBody).
 */
function buildBodyByStyle(group, style, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, hasShelf) {
  if (style === 'open') {
    return buildOpenBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY ?? bodyTopY, !!hasShelf);
  }
  if (style === 'doors') return buildDoorBody(group, widthM, depthM, bodyBottomY, bodyTopY);
  return buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
}

/**
 * Čelní ovládací panel — VŽDY předsazený před čelní stěnu korpusu (korpus má
 * čelo na z≈0, viz buildClosedBody/buildOpenBody/buildDoorBody), aby byl
 * zřetelně viditelný a neschovával se v rovině stěny korpusu. Obsahuje i
 * malou nálepku s logem ALBA u pravého okraje (§6 SPEC).
 */
function buildPanelBand(group, widthM, panelBottomY, panelTopY) {
  const height = panelTopY - panelBottomY;
  const thickness = 0.012;
  const centerZ = -0.012; // předsazeno před čelo korpusu (mezera ~6 mm od stěny)
  const panel = box(widthM - 0.01, height, thickness, createPanelMaterial());
  panel.position.set(0, panelBottomY + height / 2, centerZ);
  group.add(panel);
  const centerY = panelBottomY + height / 2;
  const frontZ = centerZ - thickness / 2; // nejpřednější plocha panelu — odsud se umisťují ovládací prvky ještě dál dopředu

  // malá "samolepka" ALBA (~25 mm) u pravého okraje panelu
  const stickerM = mm(25);
  if (widthM > stickerM * 3) {
    const sticker = box(stickerM, stickerM, 0.003, createLogoMaterial(), false);
    sticker.position.set(widthM / 2 - stickerM * 0.7, centerY, frontZ - 0.0016);
    group.add(sticker);
  }

  return { centerY, frontZ };
}

// --- Ovládací prvky na panelu --------------------------------------------------

/** Rovnoměrně rozmístí zadaný počet ovládacích prvků daného druhu na panel. */
export function renderControls(group, widthM, panelCenterY, panelFrontZ, controlType, count) {
  if (!count || count <= 0) return;
  const margin = Math.min(widthM * 0.14, 0.09);
  const usable = Math.max(widthM - margin * 2, 0.01);
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : -usable / 2 + (usable * i) / (count - 1);
    if (controlType === 'button') {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), createButtonMaterial());
      btn.rotation.x = Math.PI / 2;
      btn.position.set(x, panelCenterY, panelFrontZ - 0.006);
      btn.castShadow = true;
      group.add(btn);
    } else if (controlType === 'switch') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), createSwitchMaterial());
      base.rotation.x = Math.PI / 2;
      base.position.set(x, panelCenterY, panelFrontZ - 0.003);
      group.add(base);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.008), createSwitchMaterial());
      lever.rotation.x = -0.35;
      lever.position.set(x, panelCenterY + 0.012, panelFrontZ - 0.008);
      lever.castShadow = true;
      group.add(lever);
    } else {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 20), createKnobMaterial());
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, panelCenterY, panelFrontZ - 0.009);
      knob.castShadow = true;
      group.add(knob);
    }
  }
}

/** Doplňkové dekorace panelu podle typu vrchní funkce (indikátor, displej…). */
function decoratePanelExtras(group, topFeatureType, widthM, panelCenterY, panelFrontZ) {
  if (topFeatureType === 'fryer2') {
    const indicator = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 12), createButtonMaterial());
    indicator.rotation.x = Math.PI / 2;
    indicator.position.set(widthM * 0.32, panelCenterY + 0.03, panelFrontZ - 0.006);
    group.add(indicator);
  } else if (topFeatureType === 'ceramic4') {
    const display = new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.28, 0.02, 0.008), createGlassCeramicMaterial());
    display.position.set(0, panelCenterY + 0.05, panelFrontZ - 0.004);
    group.add(display);
  } else if (topFeatureType === 'induction') {
    const display = new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.22, 0.018, 0.007), createGlassCeramicMaterial());
    display.position.set(0, panelCenterY + 0.045, panelFrontZ - 0.004);
    group.add(display);
  }
}

// --- Vrchní detaily jednotlivých přístrojů (kreslí se NA průběžnou desku) ------
// Tyto funkce přidávají detaily přímo do skupiny segmentu na absolutní y-úrovni
// `topY` (horní plocha průběžné desky), takže musí dostat `topY` jako parametr.

function buildGasStoveTop(group, widthM, depthM, topY) {
  const castIron = createCastIronMaterial();
  const positions = [
    [-widthM * 0.25, depthM * 0.32],
    [widthM * 0.25, depthM * 0.32],
    [-widthM * 0.25, depthM * 0.68],
    [widthM * 0.25, depthM * 0.68],
  ];

  positions.forEach(([x, z]) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.015, 24), castIron);
    base.position.set(x, topY + 0.008, z);
    base.castShadow = true;
    group.add(base);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 24), castIron);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, topY + 0.02, z);
    ring.castShadow = true;
    group.add(ring);

    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), castIron);
    inner.position.set(x, topY + 0.015, z);
    group.add(inner);

    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.008, 0.012), castIron);
      bar.rotation.y = (Math.PI / 4) * i;
      bar.position.set(x, topY + 0.026, z);
      bar.castShadow = true;
      group.add(bar);
    }
  });
}

function buildElectricStoveTop(group, widthM, depthM, topY) {
  const glassCeramic = createGlassCeramicMaterial();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.02, 0.012, depthM - 0.02), glassCeramic);
  plate.position.set(0, topY + 0.006, depthM / 2);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const zoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.3, roughness: 0.25 });
  const positions = [
    [-widthM * 0.25, depthM * 0.32],
    [widthM * 0.25, depthM * 0.32],
    [-widthM * 0.25, depthM * 0.68],
    [widthM * 0.25, depthM * 0.68],
  ];
  positions.forEach(([x, z]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.004, 8, 32), zoneMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, topY + 0.013, z);
    group.add(ring);
  });
}

/** Indukce — jedna varná zóna 400×400 mm (§3.3 SPEC v3). */
function buildInductionTop(group, widthM, depthM, topY) {
  const glassCeramic = createGlassCeramicMaterial();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.02, 0.012, depthM - 0.02), glassCeramic);
  plate.position.set(0, topY + 0.006, depthM / 2);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const zoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.3, roughness: 0.25 });
  const zoneRadius = Math.min(mm(190), widthM * 0.42, depthM * 0.42);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(zoneRadius, 0.005, 8, 32), zoneMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, topY + 0.013, depthM * 0.5);
  group.add(ring);

  // naznačený čtvercový obrys 400×400 mm zóny
  const squareSize = Math.min(mm(400), widthM * 0.9, depthM * 0.9);
  const squareOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(squareSize, squareSize)),
    new THREE.LineBasicMaterial({ color: 0x3a3a3e })
  );
  squareOutline.rotation.x = -Math.PI / 2;
  squareOutline.position.set(0, topY + 0.0135, depthM * 0.5);
  group.add(squareOutline);
}

function buildFryerTop(group, widthM, depthM, topY) {
  const glass = createGlassMaterial();
  const recessMat = createRecessMaterial();
  const vatWidth = widthM * 0.42;
  const centers = [-widthM * 0.24, widthM * 0.24];

  centers.forEach((x) => {
    const vat = new THREE.Mesh(new THREE.BoxGeometry(vatWidth, 0.14, depthM * 0.6), recessMat);
    vat.position.set(x, topY - 0.06, depthM * 0.5);
    group.add(vat);

    const basketGeo = new THREE.BoxGeometry(vatWidth - 0.03, 0.11, depthM * 0.5);
    const basket = new THREE.LineSegments(
      new THREE.EdgesGeometry(basketGeo),
      new THREE.LineBasicMaterial({ color: 0x8c8c8c })
    );
    basket.position.set(x, topY - 0.03, depthM * 0.5);
    group.add(basket);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(vatWidth, 0.01, depthM * 0.6), glass);
    lid.position.set(x, topY + 0.1, depthM * 0.78);
    lid.rotation.x = -Math.PI * 0.32;
    group.add(lid);
  });
}

function buildGrillTop(group, widthM, depthM, topY) {
  const glassCeramic = createGlassCeramicMaterial();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.02, 0.02, depthM - 0.06), glassCeramic);
  plate.position.set(0, topY + 0.01, depthM / 2);
  plate.castShadow = true;
  group.add(plate);

  const grooveMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.2, roughness: 0.6 });
  const grooveCount = 8;
  for (let i = 0; i < grooveCount; i++) {
    const z = 0.06 + ((depthM - 0.12) * i) / (grooveCount - 1);
    const groove = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.06, 0.006, 0.015), grooveMat);
    groove.position.set(0, topY + 0.021, z);
    group.add(groove);
  }

  const tray = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.1, 0.01, 0.05), createRecessMaterial());
  tray.position.set(0, topY + 0.006, 0.05);
  group.add(tray);
}

function addBasin(group, widthM, depthM, topY, options = {}) {
  const {
    basinWidth = widthM - 0.08,
    basinDepth = depthM - 0.15,
    basinDepthY = 0.16,
    zOffset = 0,
  } = options;
  const recessMat = createRecessMaterial();
  const stainless = createStainlessMaterial();

  const rim = new THREE.Mesh(new THREE.BoxGeometry(basinWidth + 0.03, 0.012, basinDepth + 0.03), stainless);
  rim.position.set(0, topY + 0.006, depthM / 2 + zOffset);
  rim.castShadow = true;
  group.add(rim);

  const basin = new THREE.Mesh(new THREE.BoxGeometry(basinWidth, basinDepthY, basinDepth), recessMat);
  basin.position.set(0, topY - basinDepthY / 2 + 0.01, depthM / 2 + zOffset);
  group.add(basin);
}

function buildBainMarieTop(group, widthM, depthM, topY) {
  addBasin(group, widthM, depthM, topY, { basinDepthY: 0.1, basinDepth: depthM - 0.2 });
}

function buildMultiPanTop(group, widthM, depthM, topY) {
  const glass = createGlassMaterial();
  const knobMat = createKnobMaterial();

  addBasin(group, widthM, depthM, topY, { basinWidth: widthM - 0.1, basinDepth: depthM * 0.55, basinDepthY: 0.15 });

  const lid = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.12, 0.012, depthM * 0.56), glass);
  lid.position.set(0, topY + 0.32, depthM * 0.85);
  lid.rotation.x = -Math.PI * 0.42;
  group.add(lid);

  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 12), knobMat);
  lever.rotation.z = Math.PI / 2.6;
  lever.position.set(widthM / 2 - 0.05, topY + 0.05, depthM * 0.25);
  lever.castShadow = true;
  group.add(lever);
}

/** Dřez s volitelnými rozměry vany (§3.3 SPEC v3) — vatWidthM/vatDepthM
 *  přichází z instance segmentu (main.js), ne z katalogu. */
function buildSinkTop(group, widthM, depthM, topY, vatWidthM, vatDepthM) {
  const stainless = createStainlessMaterial();
  const knobMat = createKnobMaterial();

  addBasin(group, widthM, depthM, topY, {
    basinWidth: vatWidthM,
    basinDepth: vatDepthM,
    basinDepthY: 0.18,
    zOffset: -depthM * 0.06,
  });

  const faucetBaseX = widthM * 0.32;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.05, 16), stainless);
  base.position.set(faucetBaseX, topY + 0.025, depthM * 0.75);
  base.castShadow = true;
  group.add(base);

  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.22, 12), stainless);
  riser.position.set(faucetBaseX, topY + 0.15, depthM * 0.75);
  riser.castShadow = true;
  group.add(riser);

  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 20, Math.PI), stainless);
  spout.rotation.set(0, Math.PI / 2, 0);
  spout.position.set(faucetBaseX, topY + 0.25, depthM * 0.75 - 0.09);
  spout.castShadow = true;
  group.add(spout);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 10), knobMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(faucetBaseX + 0.03, topY + 0.28, depthM * 0.75);
  group.add(handle);
}

/** Dispatcher vrchních detailů podle topFeature.type katalogového přístroje. */
function applyTopFeature(group, def, segment, widthM, depthM, topY) {
  const type = def.topFeature ? def.topFeature.type : 'none';
  switch (type) {
    case 'burners4':
      buildGasStoveTop(group, widthM, depthM, topY);
      break;
    case 'ceramic4':
      buildElectricStoveTop(group, widthM, depthM, topY);
      break;
    case 'induction':
      buildInductionTop(group, widthM, depthM, topY);
      break;
    case 'fryer2':
      buildFryerTop(group, widthM, depthM, topY);
      break;
    case 'grill':
      buildGrillTop(group, widthM, depthM, topY);
      break;
    case 'bainmarie':
      buildBainMarieTop(group, widthM, depthM, topY);
      break;
    case 'multipan':
      buildMultiPanTop(group, widthM, depthM, topY);
      break;
    case 'sink': {
      const vatWidthM = mm(clamp(Number(segment.vatWidthMM) || SINK_VAT_WIDTH_DEFAULT, SINK_VAT_WIDTH_MIN, SINK_VAT_WIDTH_MAX));
      const vatDepthM = mm(clamp(Number(segment.vatDepthMM) || SINK_VAT_DEPTH_DEFAULT, SINK_VAT_DEPTH_MIN, SINK_VAT_DEPTH_MAX));
      buildSinkTop(group, widthM, depthM, topY, vatWidthM, vatDepthM);
      break;
    }
    default:
      break; // 'none' / 'bitmap' — bez typové kresby na desce
  }
}

// --- Bitmapový overlay (horní plocha desky segmentu) --------------------------

/** Přidá tenkou desku s texturou nahrané bitmapy na horní plochu segmentu. */
function addBitmapOverlay(group, widthM, depthM, topY, dataURL) {
  const overlayWidth = Math.max(widthM - 0.02, 0.02);
  const overlayDepth = Math.max(depthM - 0.02, 0.02);
  const geometry = new THREE.BoxGeometry(overlayWidth, 0.004, overlayDepth);
  const material = createBitmapMaterial(null);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, topY + 0.004, depthM / 2);
  mesh.receiveShadow = true;
  group.add(mesh);

  loadBitmapTexture(dataURL, (texture) => {
    material.map = texture;
    material.needsUpdate = true;
  });

  return mesh;
}

// --- Veřejné tovární funkce pro celé segmenty -----------------------------------

/**
 * Vytvoří kompletní segment (podestavba + panel + ovládací prvky + typové
 * detaily na desce). `topY` je absolutní výška horní plochy průběžné desky
 * (workHeightM), použitá pro umístění detailů, které "sedí" na desce.
 */
export function createSegmentMesh(segment, depthM, workHeightM) {
  const widthMM = getSegmentWidthMM(segment);
  const widthM = mm(widthMM);
  const bodyTopY = workHeightM - TOP_THICKNESS; // podklad těsně pod průběžnou deskou
  const panelBottomY = bodyTopY - PANEL_HEIGHT;

  const group = new THREE.Group();
  group.userData.id = segment.id;
  group.userData.type = segment.type;
  group.userData.widthMM = widthMM;
  group.userData.label = getSegmentLabel(segment);

  buildPlinth(group, widthM, depthM);

  if (segment.type === NEUTRAL_TYPE) {
    // Dutina = vnitřní prostor podestavby; pokud má segment panel, dutina
    // pod ním končí (panel do dutiny nepatří) — §4 SPEC v3.
    const style = segment.podestavba === 'open' ? 'open' : 'doors';
    const cavityTopY = segment.hasPanel ? panelBottomY : bodyTopY;
    buildBodyByStyle(group, style, widthM, depthM, PLINTH_HEIGHT, bodyTopY, cavityTopY, !!segment.hasShelf);
    if (segment.hasPanel) {
      // ovládací panel je jen předsazená dekorace navíc před horní pás čela,
      // korpus pod ním zůstává celý (žádná díra vzadu)
      buildPanelBand(group, widthM, panelBottomY, bodyTopY);
    }
    return group;
  }

  if (segment.type === CUSTOM_TYPE) {
    buildClosedBody(group, widthM, depthM, PLINTH_HEIGHT, bodyTopY);
    const { centerY, frontZ } = buildPanelBand(group, widthM, panelBottomY, bodyTopY);
    renderControls(group, widthM, centerY, frontZ, segment.controlsType || 'knob', segment.controlsCount || 0);
    if (segment.imageDataURL) {
      addBitmapOverlay(group, widthM, depthM, workHeightM, segment.imageDataURL);
    }
    return group;
  }

  // katalogový přístroj (built-in i vlastní z katalogu)
  const def = getCatalogEntry(segment.type);
  if (!def) {
    // neznámý typ — vykreslí se jako prázdná uzavřená výplň, ať aplikace nespadne
    buildClosedBody(group, widthM, depthM, PLINTH_HEIGHT, bodyTopY);
    return group;
  }
  buildBodyByStyle(group, def.bodyStyle, widthM, depthM, PLINTH_HEIGHT, bodyTopY);
  const { centerY, frontZ } = buildPanelBand(group, widthM, panelBottomY, bodyTopY);
  renderControls(group, widthM, centerY, frontZ, def.controls.type, def.controls.count);
  decoratePanelExtras(group, def.topFeature ? def.topFeature.type : 'none', widthM, centerY, frontZ);
  applyTopFeature(group, def, segment, widthM, depthM, workHeightM);
  if (def.imageDataURL) {
    addBitmapOverlay(group, widthM, depthM, workHeightM, def.imageDataURL);
  }
  return group;
}

/** Vytvoří jednoduchou "výplňovou" podestavbu bez panelu (prázdný úsek desky). */
export function createFillerMesh(widthMM, depthM, workHeightM) {
  const widthM = mm(widthMM);
  const group = new THREE.Group();
  group.userData.filler = true;
  buildPlinth(group, widthM, depthM);
  buildClosedBody(group, widthM, depthM, PLINTH_HEIGHT, workHeightM - TOP_THICKNESS);
  return group;
}

export { addEdges, box };
