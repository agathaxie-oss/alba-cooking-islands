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
  DEFAULT_PLINTH,
  PLINTH_HEIGHT_DEFAULT_MM,
  PLINTH_INSET_MM,
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
import { createStainlessMaterial, createLogoMaterial, createPlinthMaterial } from './materials.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const OVERHANG_MM = 15; // deska přesahuje podestavby o 15 mm po obvodu
export const SIDE_PANEL_MM = 20; // boční krycí plech na obou koncích bloku

// --- sokl NA ÚROVNI BLOKU (ZADANI-SOKL.md, 31. 8. 2026) ---------------------
// Nožičky (`legs`/`legs_plinth`) staví buildPlinth() PER SEGMENT (modules.js).
// Nerezový rám (`construction`) a soklová zástěna (`legs_plinth`) jsou ale
// vlastností CELÉHO BLOKU — NE ale po celém půdorysném obvodu bloku (to byla
// VADA, nahlášená 1. 9. 2026: sokl běžel i tam, kde žádný segment není —
// prázdná strana, nedoplněný zbytek řady). Oprava: sokl v ose X sahá jen tam,
// kam sahá SKUTEČNÁ řada segmentů (viz buildBlockPlinth i buildBlock níž) —
// hloubkové (Z) chování se NEMĚNÍ, sokl dál jede přes celou totalDepthMM,
// protože segmenty už dnes zabírají celou hloubku své strany (na rozdíl od
// MONO podestaveb). Uskočené PLINTH_INSET_MM ze všech stran. V zadání není
// dané číslo tloušťky plechu — 20 mm konzistentně s ostatními plechovými
// díly bloku (SIDE_PANEL_MM výš, WALL_MM v modules.js).
const PLINTH_WALL_THICKNESS_MM = 20;
// výchozí sokl, když volající (main.js, fáze 2) parametr nedodá — zachovává
// dosavadní chování (konstrukční, 150 mm) beze změny.
const DEFAULT_BLOCK_PLINTH = { type: DEFAULT_PLINTH, heightMM: PLINTH_HEIGHT_DEFAULT_MM };

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
 * Sestaví podestavby JEDNÉ strany (segmenty + výplň) do lokální skupiny.
 * Lokální prostor: x vystředěno kolem 0 (šířka usableWidthMM), z od 0 (čelo
 * strany) do rowDepthMM.
 *
 * §11.1 SPEC v4: hloubka podestavby je v rámci strany VŽDY JEDNOTNÁ —
 * `rowDepthMM` je odvozená hloubka podestavby (viz computeSideDepth), takže
 * všechny segmenty strany (přístrojové i neutrální) se staví ve STEJNÉ
 * hloubce. Mezera mezi podestavbou a zadní hranou strany (50/75 mm) zůstává
 * záměrně prázdná pod průběžnou deskou (žádná výplň) — viz SPEC „mezera".
 * `plinth` (`{type, heightMM}`) se protahuje do každého segmentu/výplně beze
 * změny — je to vlastnost CELÉHO BLOKU (ZADANI-SOKL.md), ne téhle řady.
 *
 * Vrací i `usedMM` (souhrnná šířka SKUTEČNÝCH segmentů, bez filleru) — sokl
 * na úrovni bloku (oprava „sokl jen pod skříňkami") z ní odvozuje, kam
 * v ose X řada segmentů skutečně sahá (viz volání v buildBlock níž).
 */
function buildSideSegments(fittingSegments, usableWidthMM, rowDepthMM, heightMM, plinth) {
  const heightM = mm(heightMM);
  const rowDepthM = mm(rowDepthMM);
  const group = new THREE.Group();
  const selectable = [];

  let cursorM = 0;
  fittingSegments.forEach((seg) => {
    const widthMM = getSegmentWidthMM(seg);
    const widthM = mm(widthMM);
    const xCenterM = mm(usableWidthMM) / 2 - (cursorM + widthM / 2);

    const mesh = createSegmentMesh(seg, rowDepthM, heightM, plinth);
    mesh.position.x = xCenterM;
    group.add(mesh);

    selectable.push({ id: seg.id, type: seg.type, label: getSegmentLabel(seg), mesh });
    cursorM += widthM;
  });

  const usedMM = Math.round(cursorM * 1000);
  const leftoverMM = usableWidthMM - usedMM;
  if (leftoverMM > 5) {
    const filler = createFillerMesh(leftoverMM, rowDepthM, heightM, plinth);
    filler.position.x = mm(usableWidthMM) / 2 - (cursorM + mm(leftoverMM) / 2);
    group.add(filler);
  }

  return { group, selectable, usedMM };
}

/**
 * Sokl NA ÚROVNI CELÉHO BLOKU (ZADANI-SOKL.md + oprava „sokl jen pod
 * skříňkami", 1. 9. 2026) — nerezový RÁM (`construction`) nebo ZÁSTĚNA
 * kryjící nožičky (`legs_plinth`). V ose X sahá jen od `xMinMM` do `xMaxMM`
 * (dodá volající, buildBlock níž — odvozeno z toho, kam SKUTEČNĚ sahá řada
 * segmentů, ne z lengthMM celého bloku), uskočený PLINTH_INSET_MM od TOHOTO
 * rozsahu ZE VŠECH STRAN (i v Z). Pro `building`/`legs` nekreslí nic —
 * nožičky `legs`/`legs_plinth` staví createSegmentMesh/createFillerMesh PER
 * SEGMENT (buildPlinth v modules.js), ne tahle funkce.
 *
 * Hloubkové (Z) chování je STEJNÉ jako před opravou — `depthMM` je pořád
 * CELÁ hloubka bloku od z=0 (segmenty už dnes zabírají celou hloubku své
 * strany, viz buildSideSegments výš, takže tu není co ořezávat) — oprava se
 * týká JEN osy X.
 *
 * `hasBack` řídí zadní stěnu (u varianty `single` strana u zdi): `construction`
 * ji má VŽDY, i u `single` ("VŠECHNY strany vždy") — `legs_plinth` ji u
 * `single` vynechává, u `island` má všechny čtyři (viz volání v buildBlock).
 *
 * Souřadnice: stejný prostor jako zbytek buildBlock() — x centrováno kolem 0,
 * z od 0 (čelo/přední líc) do depthMM.
 */
export function buildBlockPlinth(group, xMinMM, xMaxMM, depthMM, heightMM, plinthType, hasBack) {
  if (plinthType !== 'construction' && plinthType !== 'legs_plinth') return;
  if (xMaxMM - xMinMM <= 0) return; // žádná řada segmentů — nic k podepření

  const mat = createPlinthMaterial();
  const heightM = mm(heightMM);
  const t = mm(PLINTH_WALL_THICKNESS_MM);
  const insetM = mm(PLINTH_INSET_MM);
  const xMin = mm(xMinMM) + insetM;
  const xMax = mm(xMaxMM) - insetM;
  const zMin = insetM;
  const zMax = mm(depthMM) - insetM;
  const innerLengthM = Math.max(xMax - xMin, 0.001);
  const innerDepthM = Math.max(zMax - zMin, 0.001);

  const plinthGroup = new THREE.Group();
  plinthGroup.name = plinthType === 'construction' ? 'sokl-ram' : 'sokl-zastena';

  const front = boxWithEdges(innerLengthM, heightM, t, mat);
  front.position.set((xMin + xMax) / 2, heightM / 2, zMin + t / 2);
  front.name = 'sokl-predni';
  plinthGroup.add(front);

  if (hasBack) {
    const back = boxWithEdges(innerLengthM, heightM, t, mat);
    back.position.set((xMin + xMax) / 2, heightM / 2, zMax - t / 2);
    back.name = 'sokl-zadni';
    plinthGroup.add(back);
  }

  // boční stěny přes CELOU hloubku (zMin..zMax), aby v rozích nevznikla mezera
  [xMin, xMax - t].forEach((xWall, i) => {
    const side = boxWithEdges(t, heightM, innerDepthM, mat);
    side.position.set(xWall + t / 2, heightM / 2, (zMin + zMax) / 2);
    side.name = i === 0 ? 'sokl-levy' : 'sokl-pravy';
    plinthGroup.add(side);
  });

  group.add(plinthGroup);
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
 * @param {{type:string, heightMM:number}} [plinth]  sokl je vlastnost CELÉHO
 *   BLOKU (ZADANI-SOKL.md, 31. 8. 2026), ne segmentu — `state.plinth` dodá
 *   volající (main.js, fáze 2). Výchozí `{type:'construction', heightMM:150}`
 *   zachovává dosavadní chování, když volající parametr nedodá.
 */
export function buildBlock(segmentsA, segmentsB, armList, dims, plinth = DEFAULT_BLOCK_PLINTH) {
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
  const sideA = buildSideSegments(fittingA, usableWidthMM, plinthDepthAMM, heightMM, plinth);
  sideA.group.name = 'strana-a';
  group.add(sideA.group);
  selectable = selectable.concat(sideA.selectable);

  // --- strana B (jen ostrov) — VLASTNÍ segmenty, ne zrcadlo strany A -------
  let sideB = null;
  if (isIsland) {
    sideB = buildSideSegments(fittingB, usableWidthMM, plinthDepthBMM, heightMM, plinth);
    sideB.group.name = 'strana-b';
    sideB.group.rotation.y = Math.PI; // zády ke straně A, čelem ven
    sideB.group.position.z = mm(totalDepthMM);
    group.add(sideB.group);
    selectable = selectable.concat(sideB.selectable);
  }

  // --- sokl NA ÚROVNI BLOKU (rám/zástěna) — OPRAVA „sokl jen pod skříňkami"
  // (1. 9. 2026): v ose X sahá jen tam, kam sahá SKUTEČNÁ řada segmentů
  // (usedMM z buildSideSegments výš, BEZ filleru) — ne přes celou lengthMM
  // jako dřív. buildSideSegments klade segmenty k PRAVÉMU okraji řady
  // (strana A), po otočení 180° tedy k LEVÉMU okraji (strana B) — viz jeho
  // komentář výš — takže world-x rozsah řady A je [U/2 − usedMM, U/2] a
  // řady B (world-x = −local-x po rotaci) je [−U/2, usedMM − U/2], kde
  // U = usableWidthMM. Hloubka (Z) se NEMĚNÍ — buildBlockPlinth pořád
  // dostává totalDepthMM (viz jeho JSDoc, segmenty už dnes zabírají celou
  // hloubku své strany, takže tu není co ořezávat). U ostrova s NEROVNOMĚRNĚ
  // zaplněnýma řadama (jedna plná, druhá s mezerou) proto vyjde sokl ze
  // SJEDNOCENÍ obou řad (běží tam, kde má segment ALESPOŇ jedna z nich) —
  // vědomé zjednodušení dané "minimálním zásahem" a nezměněnou hloubkou
  // (jeden společný Z-rozsah neumožňuje mít pro každou řadu jinou X-mezeru).
  const plinthHasBack = plinth.type === 'construction' ? true : isIsland;
  const halfUsableMM = usableWidthMM / 2;
  const runA = sideA.usedMM > 0 ? { minMM: halfUsableMM - sideA.usedMM, maxMM: halfUsableMM } : null;
  const runB = sideB && sideB.usedMM > 0 ? { minMM: -halfUsableMM, maxMM: sideB.usedMM - halfUsableMM } : null;
  const plinthRuns = [runA, runB].filter(Boolean);
  if (plinthRuns.length > 0) {
    const xMinMM = Math.min(...plinthRuns.map((r) => r.minMM));
    const xMaxMM = Math.max(...plinthRuns.map((r) => r.maxMM));
    buildBlockPlinth(group, xMinMM, xMaxMM, totalDepthMM, plinth.heightMM, plinth.type, plinthHasBack);
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
