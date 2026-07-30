// block.js — skládání celého varného bloku (SPEC v3):
//   1) PRŮBĚŽNÁ pracovní deska přesahující podestavby o 15 mm po celém obvodu
//   2) boční krycí plechy (20 mm) na obou koncích bloku, přes celou hloubku
//      a výšku podestavby, s logem ALBA na vnější straně
//   3) podestavby DVOU NEZÁVISLÝCH stran (A/B u ostrova; jen A u jednostr.)
//   4) napouštěcí ramena umístěná na desce nezávisle na segmentech
//
// Podporuje dvě varianty sestavy:
//   'single' — jednostranný blok u zdi (jen strana A)
//   'island' — ostrovní blok (strana A + strana B, zády k sobě, KAŽDÁ strana
//              má vlastní seznam segmentů — žádné zrcadlení)

import * as THREE from 'three';
import {
  createSegmentMesh,
  createFillerMesh,
  getSegmentWidthMM,
  getSegmentMinDepthMM,
  getSegmentLabel,
  NEUTRAL_TYPE,
  CUSTOM_TYPE,
  DRAWERS_TYPE,
  TOP_THICKNESS,
  box as boxWithEdges,
} from './modules.js';
import {
  createArmMesh,
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
} from './arms.js';
import { createStainlessMaterial, createLogoMaterial } from './materials.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const OVERHANG_MM = 15; // deska přesahuje podestavby o 15 mm po obvodu
export const SIDE_PANEL_MM = 20; // boční krycí plech na obou koncích bloku

// §11.1 SPEC v4 — hloubka podestavby je v rámci strany VŽDY jednotná a
// odvozená z hloubky bloku dané strany: jednostranný blok má mezeru od zdi,
// ostrov má mezeru mezi oběma řadami (75 + 75 = 150 mm).
export const SINGLE_SIDE_MARGIN_MM = 50; // jednostranný blok — mezera od zdi
export const ISLAND_ROW_MARGIN_MM = 75; // ostrov — mezera jedné řady (150 mm dohromady)

/**
 * Spočítá, které segmenty se vejdou do dostupné šířky (v pořadí zleva
 * doprava). Jakmile součet šířek přesáhne kapacitu, tento i všechny další
 * segmenty jsou označeny jako přetékající (nerenderují se).
 */
export function computeCapacity(segments, capacityMM) {
  let cumulative = 0;
  let overflowStarted = false;
  const results = segments.map((seg) => {
    const widthMM = getSegmentWidthMM(seg);
    cumulative += widthMM;
    if (overflowStarted || cumulative > capacityMM) {
      overflowStarted = true;
      return { id: seg.id, fits: false, widthMM };
    }
    return { id: seg.id, fits: true, widthMM };
  });
  const usedMM = segments.reduce((sum, s) => sum + getSegmentWidthMM(s), 0);
  return { results, usedMM, capacityMM };
}

/**
 * Spočítá odvozenou hloubku PODESTAVBY strany a EFEKTIVNÍ hloubku strany
 * bloku (§11.1 SPEC v4). Podestavba je v rámci strany vždy JEDNOTNÁ —
 * `requestedSideDepthMM - marginMM` (mezera od zdi u jednostranného bloku,
 * resp. polovina mezery mezi řadami u ostrova). `minDepthMM` katalogového
 * přístroje (§7.1) nadále platí: pokud by se do odvozené hloubky podestavby
 * nevešel nejhlubší přístrojový segment strany, hloubka podestavby (a tedy
 * i celé strany) se automaticky zvětší — uživatelem zadaná hodnota strany se
 * nikdy nesnižuje. Neutrální a vlastní moduly nemají vlastní minimum, takže
 * se do výpočtu nezapočítávají. Vrací i seznam názvů segmentů, které zvětšení
 * způsobily (pro poznámku v UI, viz ui.js).
 */
export function computeSideDepth(fittingSegments, requestedSideDepthMM, marginMM) {
  let requiredPlinthDepthMM = 0;
  fittingSegments.forEach((seg) => {
    if (seg.type === NEUTRAL_TYPE || seg.type === CUSTOM_TYPE || seg.type === DRAWERS_TYPE) return;
    const min = getSegmentMinDepthMM(seg);
    if (min > requiredPlinthDepthMM) requiredPlinthDepthMM = min;
  });
  const requestedPlinthDepthMM = Math.max(requestedSideDepthMM - marginMM, 0);
  const plinthDepthMM = Math.max(requestedPlinthDepthMM, requiredPlinthDepthMM);
  const effectiveDepthMM = plinthDepthMM + marginMM;
  const reasons = plinthDepthMM > requestedPlinthDepthMM
    ? fittingSegments
        .filter((seg) => seg.type !== NEUTRAL_TYPE && seg.type !== CUSTOM_TYPE && seg.type !== DRAWERS_TYPE && getSegmentMinDepthMM(seg) === requiredPlinthDepthMM)
        .map((seg) => getSegmentLabel(seg))
    : [];
  return { plinthDepthMM, effectiveDepthMM, reasons };
}

/**
 * @deprecated Zpětně kompatibilní shim pro starší volání (§7.3 SPEC v3),
 * ponecháno jen aby neselhal import v souborech, které dosud nebyly
 * aktualizovány na nový model §11.1 (viz computeSideDepth). Používá výchozí
 * mezeru jednostranného bloku (SINGLE_SIDE_MARGIN_MM).
 */
export function computeEffectiveDepth(fittingSegments, requestedDepthMM) {
  const { effectiveDepthMM, reasons } = computeSideDepth(fittingSegments, requestedDepthMM, SINGLE_SIDE_MARGIN_MM);
  return { effectiveDepthMM, reasons };
}

/**
 * Sestaví podestavby JEDNÉ strany (segmenty + výplň) do lokální skupiny.
 * Lokální prostor: x vystředěno kolem 0 (šířka usableWidthMM), z od 0 (čelo
 * strany) do rowDepthMM.
 *
 * §11.1 SPEC v4: hloubka podestavby je v rámci strany VŽDY JEDNOTNÁ —
 * `rowDepthMM` je odvozená hloubka podestavby (viz computeSideDepth), takže
 * všechny segmenty strany (přístrojové i neutrální) se staví ve STEJNÉ
 * hloubce. Mezera mezi podestavbou a zadní hranou strany (50/75 mm) zůstává
 * záměrně prázdná pod průběžnou deskou (žádná výplň) — viz SPEC „mezera".
 */
function buildSideSegments(fittingSegments, usableWidthMM, rowDepthMM, heightMM) {
  const heightM = mm(heightMM);
  const rowDepthM = mm(rowDepthMM);
  const group = new THREE.Group();
  const selectable = [];

  let cursorM = 0;
  fittingSegments.forEach((seg) => {
    const widthMM = getSegmentWidthMM(seg);
    const widthM = mm(widthMM);
    const xCenterM = mm(usableWidthMM) / 2 - (cursorM + widthM / 2);

    const mesh = createSegmentMesh(seg, rowDepthM, heightM);
    mesh.position.x = xCenterM;
    group.add(mesh);

    selectable.push({ id: seg.id, type: seg.type, label: getSegmentLabel(seg), mesh });
    cursorM += widthM;
  });

  const usedMM = Math.round(cursorM * 1000);
  const leftoverMM = usableWidthMM - usedMM;
  if (leftoverMM > 5) {
    const filler = createFillerMesh(leftoverMM, rowDepthM, heightM);
    filler.position.x = mm(usableWidthMM) / 2 - (cursorM + mm(leftoverMM) / 2);
    group.add(filler);
  }

  return { group, selectable };
}

/** Spočítá lokální z-pozici a směr ramene podle varianty bloku (SPEC v3 §2). */
function computeArmPlacement(arm, variant, depthAMM, depthBMM) {
  if (variant === 'island') {
    // rameno jen ve středu (na spáře mezi stranami) — posun k A/B
    const offset = clamp(Number(arm.offsetMM) || 0, ARM_CENTER_OFFSET_MIN, ARM_CENTER_OFFSET_MAX);
    return { zLocalMM: depthAMM + offset, baseDir: 1 };
  }
  // jednostranný blok — rameno jen u zadní hrany, odsazené dopředu
  const offset = clamp(
    arm.offsetMM != null ? Number(arm.offsetMM) : ARM_BACK_OFFSET_DEFAULT,
    ARM_BACK_OFFSET_MIN,
    ARM_BACK_OFFSET_MAX
  );
  return { zLocalMM: depthAMM - offset, baseDir: -1 };
}

/**
 * Sestaví THREE.Group reprezentující celý varný blok.
 *
 * @param {Array<object>} segmentsA segmenty strany A (jediná strana u 'single')
 * @param {Array<object>} segmentsB segmenty strany B (jen u 'island')
 * @param {Array<object>} armList napouštěcí ramena
 * @param {{lengthMM, depthAMM, depthBMM, heightMM, variant:'single'|'island'}} dims
 */
export function buildBlock(segmentsA, segmentsB, armList, dims) {
  const { lengthMM, depthAMM: requestedDepthAMM, depthBMM: requestedDepthBMM, heightMM, variant } = dims;
  const isIsland = variant === 'island';
  const group = new THREE.Group();
  group.name = 'varny-blok';

  const usableWidthMM = Math.max(lengthMM - 2 * SIDE_PANEL_MM, 10);

  const capacityA = computeCapacity(segmentsA, usableWidthMM);
  const fitIdsA = new Set(capacityA.results.filter((r) => r.fits).map((r) => r.id));
  const fittingA = segmentsA.filter((s) => fitIdsA.has(s.id));
  // §11.1 SPEC v4 — hloubka podestavby strany A je jednotná (odvozená z
  // hloubky strany minus mezera od zdi); automaticky se zvětší, pokud by se
  // do ní nevešel nejhlubší přístroj (minDepthMM) — zadaná hodnota se nikdy
  // nesnižuje.
  const marginA = isIsland ? ISLAND_ROW_MARGIN_MM : SINGLE_SIDE_MARGIN_MM;
  const { plinthDepthMM: plinthDepthAMM, effectiveDepthMM: depthAMM, reasons: depthReasonsA } =
    computeSideDepth(fittingA, requestedDepthAMM, marginA);

  let capacityB = { usedMM: 0, capacityMM: usableWidthMM, results: [] };
  let fittingB = [];
  let depthBMM = 0;
  let plinthDepthBMM = 0;
  let depthReasonsB = [];
  if (isIsland) {
    capacityB = computeCapacity(segmentsB, usableWidthMM);
    const fitIdsB = new Set(capacityB.results.filter((r) => r.fits).map((r) => r.id));
    fittingB = segmentsB.filter((s) => fitIdsB.has(s.id));
    const effB = computeSideDepth(fittingB, requestedDepthBMM, ISLAND_ROW_MARGIN_MM);
    plinthDepthBMM = effB.plinthDepthMM;
    depthBMM = effB.effectiveDepthMM;
    depthReasonsB = effB.reasons;
  }

  const totalDepthMM = isIsland ? depthAMM + depthBMM : depthAMM;

  let selectable = [];

  // --- strana A — podestavby ve JEDNOTNÉ hloubce plinthDepthAMM ------------
  const sideA = buildSideSegments(fittingA, usableWidthMM, plinthDepthAMM, heightMM);
  sideA.group.name = 'strana-a';
  group.add(sideA.group);
  selectable = selectable.concat(sideA.selectable);

  // --- strana B (jen ostrov) — VLASTNÍ segmenty, ne zrcadlo strany A -------
  if (isIsland) {
    const sideB = buildSideSegments(fittingB, usableWidthMM, plinthDepthBMM, heightMM);
    sideB.group.name = 'strana-b';
    sideB.group.rotation.y = Math.PI; // zády ke straně A, čelem ven
    sideB.group.position.z = mm(totalDepthMM);
    group.add(sideB.group);
    selectable = selectable.concat(sideB.selectable);
  }

  // --- průběžná pracovní deska (přesah OVERHANG_MM po celém obvodu) --------
  const deskLengthM = mm(lengthMM + 2 * OVERHANG_MM);
  const deskDepthM = mm(totalDepthMM + 2 * OVERHANG_MM);
  const desk = boxWithEdges(deskLengthM, TOP_THICKNESS, deskDepthM, createStainlessMaterial());
  desk.position.set(0, mm(heightMM) - TOP_THICKNESS / 2, mm(totalDepthMM) / 2);
  group.add(desk);

  // --- boční krycí plechy (20 mm) na obou koncích bloku, s logem ALBA -------
  const panelHeightM = mm(heightMM) - TOP_THICKNESS;
  const panelDepthM = mm(totalDepthMM);
  [-1, 1].forEach((side) => {
    const panel = boxWithEdges(mm(SIDE_PANEL_MM), panelHeightM, panelDepthM, createStainlessMaterial());
    const xCenter = side * (mm(lengthMM) / 2 - mm(SIDE_PANEL_MM) / 2);
    panel.position.set(xCenter, panelHeightM / 2, panelDepthM / 2);
    panel.name = 'krycí-plech';
    group.add(panel);

    // velké logo na vnější (pohledové) straně plechu — cca 60 % výšky plechu
    const logoSize = Math.max(Math.min(panelHeightM * 0.6, panelDepthM * 0.9), 0.05);
    const logo = new THREE.Mesh(new THREE.BoxGeometry(0.003, logoSize, logoSize), createLogoMaterial());
    const logoX = side * (mm(lengthMM) / 2 + 0.0016);
    logo.position.set(logoX, panelHeightM / 2, panelDepthM / 2);
    group.add(logo);
  });

  // --- napouštěcí ramena -----------------------------------------------------
  const armsGroup = new THREE.Group();
  armsGroup.name = 'ramena';
  const workHeightM = mm(heightMM);
  armList.forEach((arm) => {
    const clampedX = clamp(arm.positionXMM, 0, lengthMM);
    const { zLocalMM, baseDir } = computeArmPlacement(arm, variant, depthAMM, depthBMM);
    const armMesh = createArmMesh(
      { ...arm, positionXMM: clampedX },
      { lengthMM, zLocalMM, baseDir, workHeightM }
    );
    armsGroup.add(armMesh);
  });
  group.add(armsGroup);

  const dimensions = {
    lengthMM: Math.round(lengthMM),
    depthMM: Math.round(totalDepthMM),
    depthAMM: Math.round(depthAMM),
    depthBMM: isIsland ? Math.round(depthBMM) : 0,
    // §11.1 SPEC v4 — jednotná hloubka PODESTAVBY (bez mezery od zdi/mezi
    // řadami), pro info v UI/půdorysu
    plinthDepthAMM: Math.round(plinthDepthAMM),
    plinthDepthBMM: isIsland ? Math.round(plinthDepthBMM) : 0,
    heightMM: Math.round(heightMM),
    // hloubka byla automaticky zvětšena oproti zadané hodnotě (§7.3/§11.1) —
    // ui.js z toho sestaví poznámku typu „Zvětšeno na 900 mm kvůli: Indukce"
    depthGrownA: depthAMM > requestedDepthAMM,
    depthGrownB: isIsland && depthBMM > requestedDepthBMM,
    depthReasonsA,
    depthReasonsB,
  };

  return { group, dimensions, selectable, capacityA, capacityB };
}
