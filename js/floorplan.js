// floorplan.js — půdorysné schéma bloku s popisky (SPEC v4 §12).
// Generuje se PŘÍMO ze stavu aplikace (rozměry, segmenty, ramena) jako čisté
// SVG — nejde o snímek 3D kamery. Vykresluje se jako overlay nad 3D
// viewportem (viz #floorplan-overlay v index.html) a lze stáhnout jako
// samostatný .svg soubor (bílé pozadí, černé linky/text — čitelné a
// tisknutelné).
//
// SPEC v4 změny oproti v3:
//  - per-segmentové pole `depthMM` je ZRUŠENO — hloubka podestavby je v celém
//    řádku (straně) JEDNOTNÁ a odvozuje se z hloubky bloku (§11.1):
//      jednostranný blok:  hloubka podestavby = hloubka bloku − 50 mm
//      ostrovní blok:      hloubka podestavby řady = hloubka té strany − 75 mm
//    (mezi podestavbami obou řad tak vznikne mezera 150 mm).
//  - segment má nově `plinth` (nožičky/stavební sokl/konstrukční sokl) a
//    `finish` (HS+/H1/H2/H3) — vypisují se v soupisu prvků.
//  - katalogový přístroj má volitelná pole catalogCode/powerKW/voltage/
//    gasKW/descriptionText/constructionText — vypisují se jen když jsou
//    vyplněná.
//  - kresba má dvě vrstvy: obrys podestavby (plná čára) + schematický
//    půdorys přístroje na desce (hořáky, plotny, vany…) při pohledu shora.
//
// Hloubku podestavby a případné zvětšení strany kvůli minDepthMM (§11.1)
// počítá SDÍLENÁ funkce computeSideDepth z block.js (stejná, jakou pro 3D
// používá block.js/buildBlock) — dřív tu byla vlastní, textově skoro shodná
// kopie, což hrozilo rozjetím obou výpočtů; teď je jen jeden zdroj pravdy.

import {
  computeCapacity, OVERHANG_MM, SIDE_PANEL_MM,
  computeSideDepth, SINGLE_SIDE_MARGIN_MM, ISLAND_ROW_MARGIN_MM,
} from './block.js';
import {
  getSegmentWidthMM,
  getSegmentLabel,
  getInstrumentDef,
  DRAWERS_TYPE,
  getSegmentDrawerCount,
  SINK_VAT_WIDTH_DEFAULT,
  SINK_VAT_DEPTH_DEFAULT,
  PLINTH_TYPES,
  DEFAULT_PLINTH,
  DEFAULT_FINISH,
  PLINTH_HEIGHT_DEFAULT_MM,
  BODY_STACK_MM,
} from './modules.js';
import {
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
  ARM_SPOUT_HEIGHT,
  ARM_REACH,
} from './arms.js';
import { t, getLang } from './i18n.js';
import { getEntryDisplayName } from './catalog.js';
// §ÚKOL PŮDORYS MONO (ZADANI-PUDORYS-MONO.md, Agent G) — computeMonoLayout je
// JEDINÝ zdroj pozic pásu MONO (viz mono-layout.js); computeMonoDocModel níže
// z něj polohy jen PŘEBÍRÁ a převádí do souřadnic kresby (zrcadlení strany B),
// nikdy je nepočítá znovu.
import { computeMonoLayout } from './mono-layout.js';
import {
  END_TYPES as MONO_END_TYPES,
  sideInsetMM as monoSideInsetMM,
  PODESTAVBA_DEPTH_MM,
  DESK_OVERHANG_FRONT_MM,
  END_CHAMFER_MM,
  DRAWER_COUNT as MONO_DRAWER_COUNT,
  GN_RUNNER_COUNT_PER_SIDE,
  GN_RUNNER_PITCH_MM,
  PLINTH_INSET_MM,
} from './mono-geometry.js';

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const round = (v) => Math.round(v);

/** Lokální (řádkové) pozice segmentů jedné strany — kumulativní kurzor
 *  zprava doleva, stejná logika jako block.js buildSideSegments. `mirrorX`
 *  se použije pro stranu B ostrova (otočená o 180° kolem Y — viz block.js).
 *  Hloubka je nyní JEDNOTNÁ pro celou řadu (viz computeSideDepth) — žádné
 *  per-segmentové rozlišování hloubky. */
function layoutRow(segments, usableWidthMM, prefix, mirrorX) {
  const items = [];
  let cursor = 0;
  segments.forEach((seg, idx) => {
    const widthMM = getSegmentWidthMM(seg);
    const xLocalCenter = usableWidthMM / 2 - (cursor + widthMM / 2);
    const xCenter = mirrorX ? xLocalCenter : -xLocalCenter;
    items.push({ seg, label: `${prefix}${idx + 1}`, xCenter, widthMM });
    cursor += widthMM;
  });
  return items;
}

/** Doplní řádkovým položkám absolutní z-rozsah podestavby a definici
 *  katalogového přístroje (pro vykreslení půdorysu přístroje na desce). */
function attachRowGeometry(items, zTop, zBottom) {
  return items.map((it) => ({
    ...it,
    zTop,
    zBottom,
    plinthDepthMM: zBottom - zTop,
    def: getInstrumentDef(it.seg.type),
  }));
}

/** Globální Z-pozice napouštěcího ramene — viz block.js computeArmPlacement. */
function computeArmZ(arm, variant, depthAMM, depthBMM) {
  if (variant === 'island') {
    const offset = clamp(Number(arm.offsetMM) || 0, ARM_CENTER_OFFSET_MIN, ARM_CENTER_OFFSET_MAX);
    return depthAMM + offset;
  }
  const offset = clamp(
    arm.offsetMM != null ? Number(arm.offsetMM) : ARM_BACK_OFFSET_DEFAULT,
    ARM_BACK_OFFSET_MIN,
    ARM_BACK_OFFSET_MAX
  );
  return depthAMM - offset;
}

/** Spočítá layout (segmenty + ramena) ze stavu aplikace, nezávisle na SVG.
 *  Exportováno — js/report.js (tiskový dokument) čerpá stejný layout
 *  (pozice A1/A2…/B1…, rozměry, definice přístroje) pro HTML soupis dílů,
 *  ať jsou pozice v obou dokumentech vždy shodné. */
export function computeLayout(state) {
  const dims = state.dimensions || {};
  const variant = state.variant === 'island' ? 'island' : 'single';
  const isIsland = variant === 'island';
  const lengthMM = Math.max(round(Number(dims.lengthMM) || 0), 1);
  const requestedDepthAMM = Math.max(round(Number(dims.depthAMM) || 0), 1);
  const requestedDepthBMM = isIsland ? Math.max(round(Number(dims.depthBMM) || 0), 1) : 0;
  const heightMM = Math.max(round(Number(dims.heightMM) || 0), 1) || 900;
  const usableWidthMM = Math.max(lengthMM - 2 * SIDE_PANEL_MM, 10);

  const segmentsA = Array.isArray(state.segmentsA) ? state.segmentsA : [];
  const segmentsB = isIsland && Array.isArray(state.segmentsB) ? state.segmentsB : [];
  const arms = Array.isArray(state.arms) ? state.arms : [];

  const capacityA = computeCapacity(segmentsA, usableWidthMM);
  const fitIdsA = new Set(capacityA.results.filter((r) => r.fits).map((r) => r.id));
  const fittingA = segmentsA.filter((s) => fitIdsA.has(s.id));
  const gapA = isIsland ? ISLAND_ROW_MARGIN_MM : SINGLE_SIDE_MARGIN_MM;
  const sideA = computeSideDepth(fittingA, requestedDepthAMM, gapA);
  const grownA = sideA.effectiveDepthMM > requestedDepthAMM;
  const rawItemsA = layoutRow(fittingA, usableWidthMM, 'A', false);

  let rawItemsB = [];
  let sideB = { plinthDepthMM: 0, effectiveDepthMM: 0, reasons: [] };
  let grownB = false;
  if (isIsland) {
    const capacityB = computeCapacity(segmentsB, usableWidthMM);
    const fitIdsB = new Set(capacityB.results.filter((r) => r.fits).map((r) => r.id));
    const fittingB = segmentsB.filter((s) => fitIdsB.has(s.id));
    sideB = computeSideDepth(fittingB, requestedDepthBMM, ISLAND_ROW_MARGIN_MM);
    grownB = sideB.effectiveDepthMM > requestedDepthBMM;
    rawItemsB = layoutRow(fittingB, usableWidthMM, 'B', true);
  }

  const depthAMM = sideA.effectiveDepthMM;
  const depthBMM = isIsland ? sideB.effectiveDepthMM : 0;
  const totalDepthMM = isIsland ? depthAMM + depthBMM : depthAMM;

  // strana A: podestavba od čela (z=0), mezera vzadu (u zdi / u spáry)
  const itemsA = attachRowGeometry(rawItemsA, 0, sideA.plinthDepthMM);
  // strana B: podestavba u vnějšího čela (z=totalDepthMM), mezera u spáry
  const itemsB = isIsland
    ? attachRowGeometry(rawItemsB, totalDepthMM - sideB.plinthDepthMM, totalDepthMM)
    : [];

  const armItems = arms.map((arm, idx) => ({
    arm,
    index: idx,
    xMM: -(lengthMM / 2) + (Number(arm.positionXMM) || 0),
    zMM: computeArmZ(arm, variant, depthAMM, depthBMM),
  }));

  return {
    variant, isIsland, lengthMM, heightMM, usableWidthMM,
    depthAMM, depthBMM, totalDepthMM,
    plinthDepthA: sideA.plinthDepthMM, plinthDepthB: sideB.plinthDepthMM,
    gapA, gapB: ISLAND_ROW_MARGIN_MM,
    depthGrownA: grownA, depthGrownB: isIsland && grownB,
    depthReasonsA: sideA.reasons, depthReasonsB: sideB.reasons,
    itemsA, itemsB, items: itemsA.concat(itemsB), armItems,
  };
}

// --- Schematický půdorys přístroje na desce (pohled shora) -------------------
// Kreslí se NAD obrysem podestavby, uvnitř buňky dané pozice (widthMM ×
// plinthDepthMM), proporcionálně stejně jako odpovídající 3D detaily v
// modules.js (buildGasStoveTop apod.) — díky tomu schéma vizuálně odpovídá
// 3D modelu a je na první pohled jasné, o jaký přístroj jde.

/** Schematické dělení podestavby zásuvek GN 1/1 na 2 nebo 3 pásy (pohled
 *  shora) — jen orientační znázornění počtu zásuvek v půdorysu, ne doslovný
 *  půdorysný obrys zásuvky (ta se dělí po výšce čela, ne po hloubce). */
function drawDrawersTopView(parts, item, drawX, drawZ, strokeThin) {
  const count = getSegmentDrawerCount(item.seg);
  if (count < 2) return;
  const x1 = drawX(item.xCenter - item.widthMM / 2);
  const x2 = drawX(item.xCenter + item.widthMM / 2);
  const d = item.plinthDepthMM;
  for (let i = 1; i < count; i++) {
    const y = drawZ(item.zTop + (d * i) / count);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
  }
  const cx = (x1 + x2) / 2;
  const halfLen = Math.min((x2 - x1) * 0.18, 10);
  for (let i = 0; i < count; i++) {
    const y = drawZ(item.zTop + (d * (i + 0.22)) / count);
    parts.push(`<line x1="${(cx - halfLen).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cx + halfLen).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
  }
}

function drawDeviceTopView(parts, item, drawX, drawZ, strokeThin, mirrorX = false) {
  const def = item.def;
  const type = def && def.topFeature ? def.topFeature.type : 'none';
  if (type === 'none' || type === 'bitmap' || !type) return;

  // §10.1 SPEC v4 — u topFixed přístrojů (viz modules.js createSegmentMesh)
  // se kresba na desce vykresluje v JMENOVITÉ (katalogové) šířce, vodorovně
  // vystředěná v buňce podestavby, bez ohledu na skutečnou (zvětšenou) šířku
  // podestavby — stejné chování jako ve 3D náhledu. Hloubka (d) se ve 3D u
  // topFixed přístrojů NEfixuje (odvozuje se z jednotné hloubky podestavby
  // řady), proto zůstává beze změny i zde.
  const nominalWidthMM = def && Number(def.widthMM) > 0 ? Number(def.widthMM) : item.widthMM;
  const w = def && def.topFixed ? nominalWidthMM : item.widthMM;
  const d = item.plinthDepthMM;
  const zTop = item.zTop;

  // ZADANI-ZAROVNANI-PRISTROJE.md §6 — posun přístroje v buňce podle
  // segment.deviceAlign (doplňuje main.js/sanitizeSegment, chybějící pole →
  // 'center' = dnešní chování). rozdilMM je 0 mimo topFixed (tam w ===
  // item.widthMM, viz výš) i u přesně padnoucího přístroje (widthMM ===
  // def.widthMM) — posun se tedy sám neuplatní, žádná další podmínka není
  // potřeba.
  const rozdilMM = item.widthMM - w;
  const align = (item.seg && item.seg.deviceAlign) || 'center';
  // Lokální posun VE STEJNÉ KONVENCI jako offsetM v modules.js
  // createSegmentMesh (§3: 'left' kladné, 'right' záporné) — teprve teď se
  // promítá do souřadnic KRESBY, ne do world X.
  const localOffsetMM = align === 'left' ? rozdilMM / 2 : align === 'right' ? -rozdilMM / 2 : 0;
  // ZNAMÉNKO PRO KRESBU (odvozeno z drawX v tomhle souboru, ne opsáno z §3):
  // drawX(xMM) (níž v souboru) roste STEJNÝM směrem jako xMM — větší
  // argument = víc VPRAVO na obrázku. layoutRow (výš) dává straně A
  // `xCenter = -xLocalCenter` a straně B (mirrorX) `xCenter = +xLocalCenter`,
  // tedy STEJNÁ lokální veličina má na obou stranách OPAČNÉ znaménko v
  // souřadnici kresby — to je zrcadlení strany B (`sideB.group.rotation.y =
  // Math.PI` v block.js), promítnuté do 2D. Lokální posun přístroje leží na
  // téže ose jako xCenter (jen v menším měřítku uvnitř buňky), takže musí
  // projít STEJNOU transformací: `mirrorX ? +localOffsetMM : -localOffsetMM`.
  // Kontrola na první segment obou stran (cursor=0, tedy xLocalCenter stejné
  // pro obě): strana A dostane world X = +xLocalCenter (bez rotace) → podle
  // změřeného faktu ze zadání (kladné world X = vlevo na 3D obrazovce) se
  // kreslí vlevo; ve zdejší kresbě má strana A `xCenter = -xLocalCenter`, a
  // protože drawX roste s argumentem, menší (víc záporné) `xCenter` = víc
  // VLEVO na obrázku — sedí to se 3D. Strana B po rotaci o 180° dostane
  // world X = -xLocalCenter → kreslí se VPRAVO na 3D obrazovce; zdejší
  // `xCenter = +xLocalCenter` (stejné číslo, opačné znaménko než u strany A)
  // → větší = víc VPRAVO na obrázku — opět sedí se 3D. Stejnou dvojicí
  // závěrů (A: přímo, B: se znaménkem otočeným) se řídí i posun přístroje:
  // 'left' na straně A se v půdorysu objeví VLEVO v buňce (shoda s 3D), ale
  // 'left' na straně B se objeví VPRAVO v buňce — to je SPRÁVNĚ, protože
  // strana B je fyzicky otočená o 180° (zády ke straně A) a přístroj na ní
  // sedí zrcadlově stejně jako celá řada segmentů.
  const offsetMM = mirrorX ? localOffsetMM : -localOffsetMM;
  const cxMM = item.xCenter + offsetMM;
  const px = (dxMM) => drawX(cxMM + dxMM);
  const pz = (fracOfDepth) => drawZ(zTop + fracOfDepth * d);
  const sw = strokeThin;
  const line = (x1, y1, x2, y2, extra = '') =>
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000" stroke-width="${sw}" ${extra} />`);
  const circle = (cx, cy, r, extra = '') =>
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke="#000" stroke-width="${sw}" ${extra} />`);
  const rect = (x, y, rw, rh, extra = '') =>
    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" stroke="#000" stroke-width="${sw}" ${extra} />`);

  if (type === 'burners4' || type === 'burners2') {
    const r = Math.min(w, d) * (type === 'burners2' ? 0.18 : 0.13);
    const layout = type === 'burners2'
      ? [[0, 0.32], [0, 0.68]]
      : [[-0.25, 0.32], [0.25, 0.32], [-0.25, 0.68], [0.25, 0.68]];
    layout.forEach(([fx, fz]) => {
      const cx = px(fx * w);
      const cy = pz(fz);
      circle(cx, cy, r, 'fill="none"');
      circle(cx, cy, r * 0.32, 'fill="#000"');
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 4) + (Math.PI / 2) * i;
        line(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      }
    });
  } else if (type === 'ceramic4') {
    rect(px(-w * 0.46), pz(0.05), w * 0.92, d * 0.9, 'fill="none"');
    const r = Math.min(w, d) * 0.11;
    [[-0.25, 0.32], [0.25, 0.32], [-0.25, 0.68], [0.25, 0.68]].forEach(([fx, fz]) => {
      circle(px(fx * w), pz(fz), r, 'fill="none"');
    });
  } else if (type === 'induction') {
    rect(px(-w * 0.46), pz(0.05), w * 0.92, d * 0.9, 'fill="none"');
    const sq = Math.min(w * 0.72, d * 0.72);
    rect(px(-sq / 2), pz(0.5) - sq / 2, sq, sq, 'fill="none"');
    circle(px(0), pz(0.5), sq * 0.32, 'fill="none"');
  } else if (type === 'fryer2') {
    const vatW = w * 0.4;
    const vatD = d * 0.62;
    [-0.24, 0.24].forEach((fx) => {
      const x = px(fx * w) - vatW / 2;
      const y = pz(0.19);
      rect(x, y, vatW, vatD, 'fill="none"');
      // naznačený drátěný košík
      line(x + vatW * 0.15, y + vatD * 0.15, x + vatW * 0.85, y + vatD * 0.15);
      line(x + vatW * 0.15, y + vatD * 0.5, x + vatW * 0.85, y + vatD * 0.5);
      line(x + vatW * 0.15, y + vatD * 0.85, x + vatW * 0.85, y + vatD * 0.85);
    });
  } else if (type === 'fryer1') {
    // jedna vana, vycentrovaná — vizuálně shodné s fryer2, jen bez druhé vany
    const vatW = w * 0.4;
    const vatD = d * 0.62;
    const x = px(0) - vatW / 2;
    const y = pz(0.19);
    rect(x, y, vatW, vatD, 'fill="none"');
    // naznačený drátěný košík
    line(x + vatW * 0.15, y + vatD * 0.15, x + vatW * 0.85, y + vatD * 0.15);
    line(x + vatW * 0.15, y + vatD * 0.5, x + vatW * 0.85, y + vatD * 0.5);
    line(x + vatW * 0.15, y + vatD * 0.85, x + vatW * 0.85, y + vatD * 0.85);
  } else if (type === 'grill') {
    // absolutní cookArea z topFeature (FTLRD 680×760) nebo proporční fallback
    const cookWmm = Number(def?.topFeature?.cookAreaWidthMM) > 0
      ? Number(def.topFeature.cookAreaWidthMM)
      : w * 0.94;
    const cookDmm = Number(def?.topFeature?.cookAreaDepthMM) > 0
      ? Number(def.topFeature.cookAreaDepthMM)
      : d * 0.8;
    const cookW = Math.min(cookWmm, w - 20);
    const cookD = Math.min(cookDmm, d - 20);
    const gx = px(-cookW / 2);
    const gy = pz(0.5) - cookD / 2;
    rect(gx, gy, cookW, cookD, 'fill="none"');
    // levá polovina rýhovaná (žebra předozadně), pravá hladká
    const ribs = 6;
    for (let i = 1; i <= ribs; i++) {
      const rx = gx + (cookW * 0.5 * i) / (ribs + 1);
      line(rx, gy + cookD * 0.06, rx, gy + cookD * 0.94);
    }
    rect(px(-cookW * 0.14), gy + cookD * 0.02, cookW * 0.28, cookD * 0.08, 'fill="none"'); // sběr tuku
  } else if (type === 'bainmarie') {
    rect(px(-w * 0.4), pz(0.15), w * 0.8, d * 0.7, 'fill="none"');
    line(px(-w * 0.3), pz(0.5), px(w * 0.3), pz(0.5));
  } else if (type === 'multipan') {
    rect(px(-w * 0.44), pz(0.12), w * 0.88, d * 0.62, 'fill="none"');
    circle(px(w * 0.36), pz(0.2), Math.min(w, d) * 0.05, 'fill="none"');
  } else if (type === 'sink') {
    const vatWmm = clamp(Number(item.seg.vatWidthMM) || SINK_VAT_WIDTH_DEFAULT, 200, w - 20);
    const vatDmm = clamp(Number(item.seg.vatDepthMM) || SINK_VAT_DEPTH_DEFAULT, 200, d - 20);
    const vatCenterFrac = 0.42;
    const x = px(-vatWmm / 2);
    rect(x, pz(vatCenterFrac) - vatDmm / 2, vatWmm, vatDmm, 'fill="none"'); // vana vystředěná mírně vzadu

    // baterie s loketní pákou — vystředěná na ose vany, posunutá dozadu za ni
    // (odpovídá 3D umístění v modules.js/buildSinkTop)
    const vatBackFrac = vatCenterFrac + (vatDmm / 2) / d;
    const faucetFrac = Math.min(vatBackFrac + 60 / d, 0.94);
    const faucetX = px(0);
    const faucetY = pz(faucetFrac);
    circle(faucetX, faucetY, Math.min(w, d) * 0.035, 'fill="#000"');
    // výtok míří dopředu nad vanu (dosah 245 mm); loketní páka je nad ním ve
    // stejné svislé rovině, v půdorysu se tedy promítá do téže čáry
    line(faucetX, faucetY, faucetX, pz(vatCenterFrac));
  }
}

// ============================================================================
// ALBA MONO — §1 datový model (ZADANI-PUDORYS-MONO.md, Agent G) + §2 kresba
// ============================================================================
// Rozsah VÝHRADNĚ produkt MONO — vše výš (SEGMENT: computeLayout,
// buildFloorplanSVG níž) zůstává NEDOTČENÉ. computeMonoDocModel(state) je
// JEDINÝ zdroj pozic a číslování pro půdorys MONO i pro budoucí tiskový
// dokument (js/report.js, etapa 2) — report.js si nic nedopočítává, jen
// z modelu čte.

/** Tolerantní čtení typu zakončení — stejné jednořádkové pravidlo jako
 *  main.js/mono-block.js/mono-layout.js (každý modul má vlastní kopii,
 *  mono-geometry.js zůstává bez vazby na state a tyhle moduly na sobě
 *  navzájem záměrně nezávisí — viz hlavičky těch souborů). */
function readMonoEndType(value) {
  return value === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER
    ? MONO_END_TYPES.VERTICAL_PLATE_CHAMFER
    : MONO_END_TYPES.VERTICAL_PLATE;
}

// --- zrcadlení strany B do souřadnic KRESBY ----------------------------------
// computeMonoLayout(state,'B') měří xMM od VLASTNÍHO levého kraje strany B
// (mono-layout.js pro B prohazuje čtecí pravidlo leftEndType/rightEndType),
// ne od levého kraje bloku v kresbě. Bez zrcadlení by strana B v půdorysu
// vyšla zprava doleva obráceně (viz zadání, úkol 18). Plocha (má widthMM) se
// zrcadlí přes lengthMM − xMM − widthMM, bodový prvek (zásuvka v panelu) jen
// přes lengthMM − xMM. Fyzické konce bloku (leftEndType/rightEndType) se
// NIKDY nezrcadlí — patří bloku, ne straně.
function mirrorMonoAreaX(xMM, widthMM, lengthMM) {
  return lengthMM - xMM - widthMM;
}
function mirrorMonoPointX(xMM, lengthMM) {
  return lengthMM - xMM;
}

// --- §1 „popis položky se skládá automaticky" — VÝHRADNĚ přes t() ----------
// Doplnění zadání (koordinátor, po prvním konceptu): params NESMÍ obsahovat
// natvrdo psané české řetězce — každá položka pole vzniká voláním
// t('mono.param.<neco>', {…}), klíče přidává souběžně druhý agent do
// i18n.js. Skládá se JEN z toho, co položka skutečně nese (žádné nové pole
// katalogu, žádné vymyšlené hodnoty — chybějící údaj se do params nedává).

/** §1 — desetinné číslo v params PODLE AKTUÁLNÍHO JAZYKA (koordinátor,
 *  oprava po přejímce): katalog nese powerKW/gasKW jako číslo s TEČKOU
 *  (13.6), ale cs/sk/de/pl píšou desetinnou ČÁRKOU — syrové vložení čísla
 *  do řetězce by dalo "13.6 kW" i v češtině. Celé číslo zůstává BEZ
 *  desetinné části (22, ne 22,0) — Number.isInteger rozhoduje ještě PŘED
 *  záměnou tečky za čárku. Zaokrouhlení na 1 desetinné místo kopíruje
 *  catalog.js#normalizeOptionalNumber (powerKW/gasKW nikdy nemají víc). Volá
 *  se u VŠECH čísel v params, která by teoreticky mohla vyjít desetinná
 *  (příkon, plyn, rozměry) — i tam, kde je dnes vždy celé, aby nespadlo,
 *  kdyby jednou desetinné přišlo. */
function formatMonoNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return getLang() === 'en' ? text : text.replace('.', ',');
}

function buildMonoDeviceParams(isSurface, widthMM, depthMM, def) {
  const params = [t('mono.param.size', { w: formatMonoNumber(widthMM), d: formatMonoNumber(depthMM) })];
  if (isSurface) {
    params.push(t('mono.param.surfaceNote'));
    return params;
  }
  if (!def) return params;
  let hasConnection = false;
  if (def.gasKW) { params.push(t('mono.param.gas', { kw: formatMonoNumber(def.gasKW) })); hasConnection = true; }
  if (def.powerKW) { params.push(t('mono.param.power', { kw: formatMonoNumber(def.powerKW) })); hasConnection = true; }
  if (def.voltage) { params.push(t('mono.param.voltage', { v: def.voltage })); hasConnection = true; }
  if (Array.isArray(def.zones) && def.zones.length) {
    params.push(t('mono.param.zones', { n: def.zones.length }));
    hasConnection = true;
  }
  if (!hasConnection) params.push(t('mono.param.noConnection'));
  return params;
}

function buildMonoCabinetParams(item, widthMM, drawerCount, runnerPairs) {
  const params = [t('mono.param.size', { w: formatMonoNumber(widthMM), d: formatMonoNumber(PODESTAVBA_DEPTH_MM) })];
  if (item.kind === 'drawers') {
    // MONO zásuvky jsou VŽDY na GN 1/1 (mono-geometry.js) a vždy 2 kusy (§5
    // zadání — MonoCabinet se nerozšiřuje).
    params.push(t('mono.param.drawers', { n: drawerCount, gn: '1/1' }));
  } else if (item.kind === 'gnRack') {
    params.push(t(`bodyStyle.${item.bodyStyle || 'open'}`));
    params.push(t('mono.param.runners', { n: runnerPairs, gn: '2/1', pitch: formatMonoNumber(GN_RUNNER_PITCH_MM) }));
  } else {
    params.push(t(`bodyStyle.${item.bodyStyle || 'closed'}`));
    if (item.bodyStyle === 'open' && item.hasShelf) params.push(t('mono.param.shelf'));
  }
  params.push(t('mono.param.finish', { code: item.finish || DEFAULT_FINISH }));
  params.push(t('mono.param.material'));
  return params;
}

function buildMonoSocketParams(xMM) {
  return [t('mono.param.posFromLeft', { mm: formatMonoNumber(xMM) })];
}

function buildMonoEndPanelParams(endType, insetMM, totalDepthMM) {
  const params = [
    t('mono.param.endPanelSize', { w: formatMonoNumber(insetMM), d: formatMonoNumber(totalDepthMM) }),
    t('mono.param.material'),
  ];
  params.push(endType === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER
    ? t('mono.param.endChamfer', { c: formatMonoNumber(END_CHAMFER_MM) })
    : t('mono.param.endWaterfall'));
  return params;
}

function buildMonoPlinthParams(plinth) {
  return [
    t('mono.param.plinthHeight', { mm: formatMonoNumber(plinth.heightMM) }),
    t(`plinth.${plinth.type}`),
    t('mono.param.plinthInset', { mm: formatMonoNumber(PLINTH_INSET_MM) }),
    t('mono.param.plinthFrame'),
    t('mono.param.plinthUnderCabinets'),
  ];
}

function buildMonoArmParams(arm, isIsland, xMM) {
  const params = [
    t('mono.param.armHeight', { mm: formatMonoNumber(Math.round(ARM_SPOUT_HEIGHT * 1000)) }),
    t('mono.param.armReach', { mm: formatMonoNumber(Math.round(ARM_REACH * 1000)) }),
    t('mono.param.armSwivel'),
  ];
  if (isIsland) {
    // mono.param.armOnSeam už NESE „… mm od levého konce" jako součást věty
    // ("na spáře mezi řadami, {mm} mm od levého konce") — je to NÁHRADA za
    // posFromLeft (bere polohu xMM, ne offsetMM od spáry), ne doplněk vedle
    // něj.
    params.push(t('mono.param.armOnSeam', { mm: formatMonoNumber(xMM) }));
  } else {
    // U `single` popisují posFromLeft (poloha X) a armOnBack (odsazení od
    // ZADNÍ hrany, Z) dva NEZÁVISLÉ údaje — armOnBack sám o sobě polohu po
    // délce neříká ("{mm} mm od zadní hrany"), proto jde VEDLE posFromLeft,
    // ne místo něj (na rozdíl od armOnSeam u ostrova výš). Hodnota je STEJNÝ
    // vzorec jako computeArmZ() výš — z pole state.arms[i].offsetMM,
    // výchozí ARM_BACK_OFFSET_DEFAULT, ořezané do ARM_BACK_OFFSET_MIN..MAX
    // (klíč doplnil druhý agent do i18n.js na pokyn koordinátora).
    const backOffsetMM = clamp(
      arm.offsetMM != null ? Number(arm.offsetMM) : ARM_BACK_OFFSET_DEFAULT,
      ARM_BACK_OFFSET_MIN,
      ARM_BACK_OFFSET_MAX
    );
    params.push(t('mono.param.posFromLeft', { mm: formatMonoNumber(xMM) }));
    params.push(t('mono.param.armOnBack', { mm: formatMonoNumber(backOffsetMM) }));
  }
  return params;
}

/**
 * §1 ZADANI-PUDORYS-MONO.md — JEDINÝ zdroj pozic a číslování pro půdorys
 * MONO i pro tiskový dokument (js/report.js, etapa 2, čte tenhle model beze
 * změny). Polohy se NEPOČÍTAJÍ znovu — berou se z computeMonoLayout(state,
 * side) (mono-layout.js), tahle funkce je jen PŘEVÁDÍ do souřadnic kresby
 * (mirrorMonoAreaX/mirrorMonoPointX výš) a přidává číslování.
 *
 * KLÍČOVÉ: xMM v modelu je VŽDY v souřadnicích KRESBY (levý konec bloku = 0,
 * roste doprava) — strana A beze změny, strana B ZRCADLENÁ. leftEndType/
 * rightEndType jsou naproti tomu FYZICKÉ konce bloku, NEZAMĚNĚNÉ (na rozdíl
 * od toho, co pro stranu B vrací computeMonoLayout — to je čtecí pravidlo
 * pásu, ne vlastnost bloku).
 *
 * Číslování (rozhodnutí zadavatele 1. 9. 2026): A1.x/A2.x/A3.x a B1.x/B2.x/
 * B3.x, x od 1 v pořadí položek v PÁSU (ne v zrcadlené kresbě); kind:'gap'
 * se přeskakuje — nedostává číslo ani se nekreslí. Společné prvky: S1 (levý
 * zakončovací plech), S2 (pravý), S3 (sokl — VŽDY v soupisu, i pro
 * plinth.type==='building', kdy se nic nekreslí), S4… (napouštěcí ramena,
 * v pořadí state.arms).
 *
 * ODCHYLKY OD PSANÉHO TVARU V ZADÁNÍ (nahlášeno v přejímce, neopravováno
 * "podle svého" — jen doplněno tak, aby report.js (etapa 2) měl z modelu
 * VŠECHNO a nic si nedopočítával, přesně jak zadání žádá):
 *  1) Schéma v §1 ukazuje `params` jen u CommonItem, ale věta hned pod ním
 *     ("popis položky se skládá automaticky") i §4 (karty A1/A2/A3 mají mít
 *     JEN kód+název+foto+popis, žádné sloupce rozměry/příkon) čekají
 *     `params` na VŠECH položkách — doplněno i na Device/Cabinet/Socket.
 *  2) CommonItem dostává navíc `xMM` u kind:'arm' (rameno potřebuje
 *     číselnou polohu pro kresbu i pro dokument, schéma ji ale neuvádí) — u
 *     S1/S2/S3 se `xMM` nepřidává, jejich poloha/tvar je dána geometrií
 *     konce/soklu, ne jedním číslem.
 */
export function computeMonoDocModel(state) {
  const dims = (state && state.dimensions) || {};
  const monoState = (state && state.mono) || {};
  const isIsland = state && state.variant === 'island';

  const lengthMM = Math.max(round(Number(dims.lengthMM) || 0), 1);
  const depthAMM = Math.max(round(Number(dims.depthAMM) || 0), 1);
  const depthBMM = isIsland ? Math.max(round(Number(dims.depthBMM) || 0), 1) : 0;
  const totalDepthMM = isIsland ? depthAMM + depthBMM : depthAMM;

  const plinthRaw = (state && state.plinth) || {};
  const plinth = {
    type: PLINTH_TYPES.includes(plinthRaw.type) ? plinthRaw.type : DEFAULT_PLINTH,
    heightMM: Number.isFinite(Number(plinthRaw.heightMM)) ? Math.round(Number(plinthRaw.heightMM)) : PLINTH_HEIGHT_DEFAULT_MM,
  };
  const workHeightMM = Number.isFinite(Number(dims.heightMM)) && Number(dims.heightMM) > 0
    ? Math.round(Number(dims.heightMM))
    : BODY_STACK_MM + plinth.heightMM;

  // FYZICKÉ konce bloku — NEZAMĚNĚNÉ (na rozdíl od computeMonoLayout, který
  // je pro stranu B čte prohozené, viz mono-layout.js).
  const leftEndType = readMonoEndType(monoState.leftEndType);
  const rightEndType = readMonoEndType(monoState.rightEndType);

  function buildSide(side) {
    const layout = computeMonoLayout(state, side);
    const mirror = side === 'B';

    let devIdx = 0;
    const devices = layout.herdblok.map(({ item, xMM, widthMM }) => {
      devIdx += 1;
      const isSurface = item.type === 'surface';
      const def = isSurface ? null : getInstrumentDef(item.type);
      const depthMM = def && Number(def.depthMM) > 0 ? Number(def.depthMM) : PODESTAVBA_DEPTH_MM;
      const drawXMM = mirror ? mirrorMonoAreaX(xMM, widthMM, lengthMM) : xMM;
      return {
        code: `${side}1.${devIdx}`,
        type: item.type,
        name: isSurface ? t('mono.item.surface') : (def ? getEntryDisplayName(def) : item.type),
        xMM: drawXMM,
        widthMM,
        depthMM,
        frontOffsetMM: Number(item.frontOffsetMM) || 0,
        isSurface,
        def,
        params: buildMonoDeviceParams(isSurface, widthMM, depthMM, def),
      };
    });

    let cabIdx = 0;
    const cabinets = [];
    layout.podestavby.forEach(({ item, xMM, widthMM }) => {
      if (!item || item.kind === 'gap') return; // §1 — gap se nečísluje ani nekreslí
      cabIdx += 1;
      const drawerCount = item.kind === 'drawers' ? MONO_DRAWER_COUNT : null;
      const runnerPairs = item.kind === 'gnRack' ? GN_RUNNER_COUNT_PER_SIDE : null;
      const name = item.kind === 'drawers'
        ? t(widthMM === 600 ? 'mono.item.drawers21' : 'mono.item.drawers11')
        : item.kind === 'gnRack'
          ? t(widthMM === 600 ? 'mono.item.gnRack21' : 'mono.item.gnRack11')
          : t('mono.item.cabinet');
      const drawXMM = mirror ? mirrorMonoAreaX(xMM, widthMM, lengthMM) : xMM;
      cabinets.push({
        code: `${side}2.${cabIdx}`,
        kind: item.kind,
        name,
        xMM: drawXMM,
        widthMM,
        depthMM: PODESTAVBA_DEPTH_MM,
        bodyStyle: item.bodyStyle || null,
        hasShelf: !!item.hasShelf,
        finish: item.finish || DEFAULT_FINISH,
        drawerCount,
        runnerPairs,
        params: buildMonoCabinetParams(item, widthMM, drawerCount, runnerPairs),
      });
    });

    let sockIdx = 0;
    const sockets = layout.panelItems.map(({ item, xMM }) => {
      sockIdx += 1;
      const drawXMM = mirror ? mirrorMonoPointX(xMM, lengthMM) : xMM;
      return {
        code: `${side}3.${sockIdx}`,
        kind: item.kind,
        name: t(item.kind === 'socketCEE' ? 'mono.panel.socketCEE' : 'mono.panel.socket230'),
        xMM: drawXMM,
        params: buildMonoSocketParams(drawXMM),
      };
    });

    return { devices, cabinets, sockets };
  }

  const sides = {
    A: buildSide('A'),
    B: isIsland ? buildSide('B') : { devices: [], cabinets: [], sockets: [] },
  };

  // --- společné prvky S1, S2, S3, S4… -----------------------------------------
  const leftInsetMM = monoSideInsetMM(leftEndType);
  const rightInsetMM = monoSideInsetMM(rightEndType);
  const common = [
    {
      code: 'S1', kind: 'endPanel', name: t('mono.doc.endPanel'),
      params: buildMonoEndPanelParams(leftEndType, leftInsetMM, totalDepthMM),
    },
    {
      code: 'S2', kind: 'endPanel', name: t('mono.doc.endPanel'),
      params: buildMonoEndPanelParams(rightEndType, rightInsetMM, totalDepthMM),
    },
    {
      code: 'S3', kind: 'plinth', name: t('mono.doc.plinthItem'),
      params: buildMonoPlinthParams(plinth),
    },
  ];
  const arms = Array.isArray(state && state.arms) ? state.arms : [];
  arms.forEach((arm, idx) => {
    const armXMM = clamp(Number(arm.positionXMM) || 0, 0, lengthMM);
    common.push({
      code: `S${4 + idx}`,
      kind: 'arm',
      name: t('mono.doc.arm'),
      xMM: armXMM,
      params: buildMonoArmParams(arm, isIsland, armXMM),
    });
  });

  return {
    lengthMM, depthAMM, depthBMM, totalDepthMM,
    isIsland,
    workHeightMM, plinth,
    leftEndType, rightEndType,
    sides,
    common,
  };
}

// --- obrys bloku / koncová zóna (S1/S2) se zkosením -------------------------
// Čisté funkce (jen mm vstupy) sdílené mezi kresbou níž a případně
// dokumentem. `isIsland` řídí, jestli se kromě PŘEDNÍHO rohu zkosí i ZADNÍ
// (§2 bod 6: single = jen přední roh, island = oba rohy toho konce) — stejné
// pravidlo jako cornerPoints()/chamferAllCorners v mono-geometry.js.
function monoOutlinePolygon(lengthMM, totalDepthMM, leftChamfer, rightChamfer, isIsland) {
  const CH = END_CHAMFER_MM;
  const leftBack = leftChamfer && isIsland;
  const rightBack = rightChamfer && isIsland;
  const pts = [];
  pts.push(leftChamfer ? [CH, 0] : [0, 0]);
  pts.push(rightChamfer ? [lengthMM - CH, 0] : [lengthMM, 0]);
  if (rightChamfer) pts.push([lengthMM, CH]);
  pts.push(rightBack ? [lengthMM, totalDepthMM - CH] : [lengthMM, totalDepthMM]);
  if (rightBack) pts.push([lengthMM - CH, totalDepthMM]);
  pts.push(leftBack ? [CH, totalDepthMM] : [0, totalDepthMM]);
  if (leftBack) pts.push([0, totalDepthMM - CH]);
  if (leftChamfer) pts.push([0, CH]);
  return pts;
}

/** Vnější hranice koncové zóny (S1/S2) na dané straně — sleduje stejné
 *  zkosení jako monoOutlinePolygon ("zakončovací plech zkosení sleduje", §2
 *  bod 6), jen omezená na pás od kraje bloku po insetMM. */
function monoEndZonePolygon(side, insetMM, lengthMM, totalDepthMM, isChamfer, isIsland) {
  const CH = END_CHAMFER_MM;
  const chamferBack = isChamfer && isIsland;
  const outer = side === 'left'
    ? [
      ...(isChamfer ? [[CH, 0], [0, CH]] : [[0, 0]]),
      ...(chamferBack ? [[0, totalDepthMM - CH], [CH, totalDepthMM]] : [[0, totalDepthMM]]),
    ]
    : [
      ...(isChamfer ? [[lengthMM - CH, 0], [lengthMM, CH]] : [[lengthMM, 0]]),
      ...(chamferBack ? [[lengthMM, totalDepthMM - CH], [lengthMM - CH, totalDepthMM]] : [[lengthMM, totalDepthMM]]),
    ];
  const innerX = side === 'left' ? insetMM : lengthMM - insetMM;
  return [...outer, [innerX, totalDepthMM], [innerX, 0]];
}

/**
 * §2 ZADANI-PUDORYS-MONO.md — půdorys ALBA MONO jako SVG řetězec (stejný
 * návratový tvar jako buildFloorplanSVG pro SEGMENT níž). Kresba je
 * PŘENESENÁ z odsouhlaseného mockup-pudorys-mono.html (viz zadání) —
 * vlastní měřítko (S) a okraje (PAD_*) jsou z mockupu, ne z adaptivního
 * systému `U`, který používá SEGMENT (mimo rozsah tohohle úkolu — "kresba
 * je už schválená, nevymýšlej ji znovu").
 *
 * Symboly přístrojů (hořáky/sklokeramika/fritéza/indukce/…) kreslí sdílená
 * drawDeviceTopView() výš (§10.1 SPEC v4) — pokrývá přesně výčet ze zadání
 * (hořáky/sklokeramické zóny/vany fritézy/indukční zóna/jinak prázdný
 * obdélník), takže se NEDUPLIKUJE samostatná verze jen pro MONO (odchylka
 * od doslovného portu mockupu, viz shrnutí v přejímce).
 */
export function buildMonoFloorplanSVG(state) {
  const model = computeMonoDocModel(state);
  const {
    lengthMM: L, totalDepthMM: TOT, depthAMM: DA, depthBMM: DB, isIsland,
    leftEndType, rightEndType, sides,
  } = model;

  const leftChamfer = leftEndType === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER;
  const rightChamfer = rightEndType === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER;
  const insetL = monoSideInsetMM(leftEndType);
  const insetR = monoSideInsetMM(rightEndType);
  const CH = END_CHAMFER_MM;

  // --- měřítko a okraje (z mockupu, beze změny) --------------------------
  const S = 0.30;
  const PAD_T = 190, PAD_B = 215, PAD_L = 96, PAD_R = 74;
  const px = (v) => v * S;
  const X = (mmV) => px(mmV);
  const Y = (zMM) => px(TOT - zMM); // z=0 (čelo strany A) je DOLE — §2 bod 8
  const INK = '#111820', THIN = '#6b7783', ALBA = '#0083C6';
  const ARROW_ID = 'mono-arrow';

  const W = X(L) + PAD_L + PAD_R;
  const H = Y(0) + PAD_T + PAD_B;

  const body = [];
  const g = (str) => body.push(str);

  g(`<defs><marker id="${ARROW_ID}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${INK}"/></marker></defs>`);

  // --- rámeček pozice (kód A1.1 apod.), §2 bod 5 --------------------------
  function tag(cx, cy, key, fs = 13) {
    const w = key.length * fs * 0.66 + 12, h = fs + 8;
    g(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h + 4).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="#fff" stroke="${ALBA}" stroke-width="1.5"/>`);
    g(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${fs}" font-weight="800" fill="${ALBA}" text-anchor="middle">${esc(key)}</text>`);
  }

  // --- odkazová šipka + rámeček pozice + název MIMO rámeček, §2 bod 5/10 --
  function leader(labelX, labelY, tipX, tipY, key, name, up) {
    const kneeY = up ? labelY + 10 : labelY - 10;
    g(`<path d="M ${labelX.toFixed(1)} ${kneeY.toFixed(1)} L ${labelX.toFixed(1)} ${((kneeY + tipY) / 2).toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="0.9" marker-end="url(#${ARROW_ID})"/>`);
    tag(labelX, labelY, key);
    // Název MUSÍ ležet MIMO rámeček pozice (§2 bod 10) — odsazení se počítá
    // z výšky rámečku (tag() výš: fs+8+4), ne natvrdo.
    const TAG_FS = 13;
    const above = labelY - TAG_FS - 4 - 6;
    const below = labelY + 4 + 13;
    if (name) g(`<text x="${labelX.toFixed(1)}" y="${(up ? above : below).toFixed(1)}" font-size="9" fill="${THIN}" text-anchor="middle">${esc(name)}</text>`);
  }

  // --- vodorovná/svislá kóta (z mockupu dim()/vdim()) ----------------------
  function dim(x1, x2, y, label, small) {
    const a = X(x1), b = X(x2);
    g(`<line x1="${a.toFixed(1)}" y1="${y.toFixed(1)}" x2="${b.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`);
    [a, b].forEach((x) => g(`<line x1="${x.toFixed(1)}" y1="${(y - 3.5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 3.5).toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`));
    g(`<text x="${((a + b) / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="${small ? 8.8 : 9.8}" fill="#41505f" text-anchor="middle">${esc(label)}</text>`);
  }
  function vdim(z1, z2, x, label) {
    const a = Y(z1), b = Y(z2);
    g(`<line x1="${x.toFixed(1)}" y1="${a.toFixed(1)}" x2="${x.toFixed(1)}" y2="${b.toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`);
    [a, b].forEach((y) => g(`<line x1="${(x - 3.5).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 3.5).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`));
    g(`<text x="${(x - 5).toFixed(1)}" y="${((a + b) / 2).toFixed(1)}" font-size="9" fill="#41505f" text-anchor="middle" transform="rotate(-90 ${(x - 5).toFixed(1)} ${((a + b) / 2).toFixed(1)})">${esc(label)}</text>`);
  }

  // --- z-rozsah položky v souřadnicích kresby (0 = čelo A, TOT = čelo B) --
  // Zobecněná zr() z mockupu: pro stranu A jde o [fromMM, fromMM+sizeMM] od
  // JEJÍHO vlastního čela (z=0), pro B zrcadleně od TOT.
  function zr(side, fromMM, sizeMM) {
    return side === 'A' ? [fromMM, fromMM + sizeMM] : [TOT - fromMM - sizeMM, TOT - fromMM];
  }

  // ==========================================================================
  // OBRYS BLOKU + ZASTÍNĚNÉ KONCOVÉ ZÓNY (S1/S2) — §2 bod 6
  // ==========================================================================
  const outlinePts = monoOutlinePolygon(L, TOT, leftChamfer, rightChamfer, isIsland);
  g(`<polygon points="${outlinePts.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.7"/>`);
  const leftZonePts = monoEndZonePolygon('left', insetL, L, TOT, leftChamfer, isIsland);
  g(`<polygon points="${leftZonePts.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="#e8ecf0" stroke="${INK}" stroke-width="1.1"/>`);
  const rightZonePts = monoEndZonePolygon('right', insetR, L, TOT, rightChamfer, isIsland);
  g(`<polygon points="${rightZonePts.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="#e8ecf0" stroke="${INK}" stroke-width="1.1"/>`);

  // ==========================================================================
  // PODESTAVBY (§2 body 2/3/4) — čárkovaný obrys, zásuvky/vsuvy/dvířka/
  // police, zásuvky MIMO obrys (bod 3), pozice u ZADNÍ hrany (bod 4)
  // ==========================================================================
  function drawCabinet(side, item) {
    const [z1, z2] = zr(side, DESK_OVERHANG_FRONT_MM, PODESTAVBA_DEPTH_MM);
    const x = X(item.xMM), w = X(item.widthMM), y = Y(z2), h = Y(z1) - Y(z2);
    g(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="7 4"/>`);

    if (item.kind === 'drawers') {
      // §2 bod 3 — zásuvky VÝHRADNĚ PŘED lícem desky, tedy MIMO obrys bloku;
      // vztažná hrana je obrys BLOKU (z=0/TOT), ne líc skříňky. Jedno čelo =
      // jeden pruh, počet pruhů = počet zásuvek (u MONO vždy 2, viz §5).
      const n = item.drawerCount || MONO_DRAWER_COUNT;
      const STEP = 55;
      const edge = side === 'A' ? 0 : TOT;
      const sgn = side === 'A' ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const za = edge + sgn * (i * STEP), zb = edge + sgn * ((i + 1) * STEP);
        const ry1 = Math.min(Y(za), Y(zb)), ry2 = Math.max(Y(za), Y(zb));
        g(`<rect x="${(x + 8).toFixed(1)}" y="${ry1.toFixed(1)}" width="${(w - 16).toFixed(1)}" height="${(ry2 - ry1).toFixed(1)}" fill="#fff" stroke="${INK}" stroke-width="1"/>`);
      }
    }
    if (item.kind === 'gnRack') {
      const n = item.runnerPairs || GN_RUNNER_COUNT_PER_SIDE;
      const zA = z1 + 60, zB = z2 - 60;
      for (let i = 0; i < n; i++) {
        const z = zA + (zB - zA) * (i / (n - 1));
        const yy = Y(z);
        g(`<line x1="${(x + 4).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(x + 24).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${THIN}" stroke-width="1"/>`);
        g(`<line x1="${(x + w - 24).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(x + w - 4).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${THIN}" stroke-width="1"/>`);
      }
    }
    if (item.kind === 'cabinet' && item.bodyStyle === 'open' && item.hasShelf) {
      const zm = (z1 + z2) / 2;
      g(`<line x1="${(x + 8).toFixed(1)}" y1="${Y(zm).toFixed(1)}" x2="${(x + w - 8).toFixed(1)}" y2="${Y(zm).toFixed(1)}" stroke="${THIN}" stroke-width="1" stroke-dasharray="5 3"/>`);
    }
    if (item.kind === 'cabinet' && item.bodyStyle === 'doors') {
      const zf = side === 'A' ? z1 : z2;
      g(`<line x1="${(x + w * 0.3).toFixed(1)}" y1="${Y(zf).toFixed(1)}" x2="${(x + w * 0.7).toFixed(1)}" y2="${Y(zf).toFixed(1)}" stroke="${INK}" stroke-width="2.4"/>`);
    }

    // §2 bod 4 — pozice číslovaná u ZADNÍ hrany (vpředu jsou dvířka/zásuvky)
    tag(x + w / 2, Y(side === 'A' ? z2 - 70 : z1 + 70) + 4, item.code);
  }
  sides.A.cabinets.forEach((item) => drawCabinet('A', item));
  sides.B.cabinets.forEach((item) => drawCabinet('B', item));

  // ==========================================================================
  // PŘÍSTROJE (§2 bod 1) — plná čára, BEZ výplně; neutrální plocha (isSurface)
  // se NEKRESLÍ vůbec, jen dostane odkaz (viz leadery níž). Symbol podle
  // def.topFeature.type kreslí drawDeviceTopView() (výš v souboru).
  // ==========================================================================
  function drawDevice(side, item) {
    if (item.isSurface) return;
    const [z1, z2] = zr(side, item.frontOffsetMM, item.depthMM);
    const x = X(item.xMM), w = X(item.widthMM), y = Y(z2), h = Y(z1) - Y(z2);
    g(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`);
    if (item.def) {
      // Adaptér pro sdílenou drawDeviceTopView() (§10.1 výš) — čeká
      // xCenter/zTop/plinthDepthMM/seg. MONO nemá "seg" (jen katalogové id v
      // item.type); prázdný objekt drží funkci bezpečnou i pro typ 'sink'
      // (Number(undefined) → fallback SINK_VAT_*_DEFAULT), i když MONO dnes
      // sink v herdbloku typicky nenabízí.
      const adapter = { def: item.def, xCenter: item.xMM + item.widthMM / 2, widthMM: item.widthMM, zTop: z1, plinthDepthMM: item.depthMM, seg: {} };
      drawDeviceTopView(body, adapter, X, Y, 1.1);
    }
  }
  sides.A.devices.forEach((item) => drawDevice('A', item));
  sides.B.devices.forEach((item) => drawDevice('B', item));

  // ==========================================================================
  // ZÁSUVKY A PRVKY PANELU (A3.x/B3.x) — bodový prvek, menší značka + kratší
  // odkazová šipka (§2 bod 5)
  // ==========================================================================
  function drawSocket(side, item) {
    const zEdge = side === 'A' ? 25 : TOT - 25; // umístění značky u líce panelu — jen kresba, ne rozměr
    const x = X(item.xMM), y = Y(zEdge);
    g(`<rect x="${(x - 7).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="14" height="10" fill="#fff" stroke="${INK}" stroke-width="1"/>`);
    g(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${INK}"/>`);
    const ly = side === 'A' ? Y(0) + 30 : -16;
    const knee = side === 'A' ? ly - 9 : ly + 9;
    g(`<line x1="${x.toFixed(1)}" y1="${knee.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + (side === 'A' ? 7 : -7)).toFixed(1)}" stroke="${INK}" stroke-width="0.9" marker-end="url(#${ARROW_ID})"/>`);
    tag(x, ly, item.code, 10.5);
  }
  sides.A.sockets.forEach((item) => drawSocket('A', item));
  sides.B.sockets.forEach((item) => drawSocket('B', item));

  // --- pozice S1/S2 (zakončovací plechy) ---------------------------------
  tag(X(insetL / 2), Y(TOT) - 16, 'S1', 11.5);
  tag(X(L - insetR / 2) + 6, Y(TOT) - 16, 'S2', 11.5);

  // ==========================================================================
  // NAPOUŠTĚCÍ RAMENA (S4…) — §2 bod 5, ikonka baterie + odkazová šipka
  // ==========================================================================
  const rawArms = Array.isArray(state && state.arms) ? state.arms : [];
  const armCommon = model.common.filter((c) => c.kind === 'arm');
  rawArms.forEach((rawArm, idx) => {
    const armItem = armCommon[idx];
    if (!armItem) return;
    const zMM = computeArmZ(rawArm, isIsland ? 'island' : 'single', DA, DB);
    const cx = X(armItem.xMM), cy = Y(zMM);
    g(`<path d="M ${(cx - 13).toFixed(1)} ${(cy + 16).toFixed(1)} L ${(cx - 13).toFixed(1)} ${(cy - 6).toFixed(1)} A 13 13 0 0 1 ${(cx + 13).toFixed(1)} ${(cy - 6).toFixed(1)} L ${(cx + 13).toFixed(1)} ${(cy + 16).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
    g(`<circle cx="${cx.toFixed(1)}" cy="${(cy + 16).toFixed(1)}" r="3.4" fill="${INK}"/>`);
    const labelX = cx + (idx % 2 === 0 ? -70 : 70);
    leader(labelX, -94, cx, Y(zMM) - 20, armItem.code, '', true);
  });

  // ==========================================================================
  // ODKAZY NA PŘÍSTROJE (§2 bod 5) — label pod blokem pro A, nad blokem pro B
  // ==========================================================================
  sides.A.devices.forEach((item) => {
    const [z1] = zr('A', item.frontOffsetMM, item.depthMM);
    const cx = X(item.xMM + item.widthMM / 2);
    leader(cx, Y(0) + 176, cx, Y(z1) + 2, item.code, item.name, false);
  });
  sides.B.devices.forEach((item) => {
    const [, z2] = zr('B', item.frontOffsetMM, item.depthMM);
    const cx = X(item.xMM + item.widthMM / 2);
    leader(cx, -142, cx, Y(z2) - 2, item.code, item.name, true);
  });

  // ==========================================================================
  // KÓTY (§2 bod 9) — pod blokem řetězce strany A, nad blokem strany B (u
  // ostrova), koncové zóny, celková délka, svislé hloubky A/B/celkem, u
  // zkoseného konce kóta zkosení. Popisky délek/hloubek přes STÁVAJÍCÍ klíče
  // floorplan.* (sdílené se SEGMENTem); popisky řetězců, použitelné délky a
  // zkosení přes nové mono.doc.chainCabinets/chainDevices/usableLength/
  // chamferDim (doplnil druhý agent do i18n.js na pokyn koordinátora po
  // přejímce — dřív tu chyběly, teď se používají).
  // ==========================================================================
  function chain(items, y, label) {
    items.forEach((it) => {
      if (X(it.widthMM) > 34) dim(it.xMM, it.xMM + it.widthMM, y, `${round(it.widthMM)}`, true);
    });
    g(`<text x="-8" y="${(y + 3).toFixed(1)}" font-size="8.8" fill="${THIN}" text-anchor="end">${esc(label)}</text>`);
  }
  let yd = Y(0) + 66;
  chain(sides.A.cabinets, yd, t('mono.doc.chainCabinets', { side: 'A' }));
  yd += 22; chain(sides.A.devices, yd, t('mono.doc.chainDevices', { side: 'A' }));
  yd += 22;
  dim(0, insetL, yd, `${insetL}`, true);
  dim(L - insetR, L, yd, `${insetR}`, true);
  dim(insetL, L - insetR, yd, t('mono.doc.usableLength', { mm: L - insetL - insetR }), true);
  yd += 22; dim(0, L, yd, t('floorplan.totalLength', { mm: L }), false);

  if (isIsland) {
    chain(sides.B.cabinets, -44, t('mono.doc.chainCabinets', { side: 'B' }));
    chain(sides.B.devices, -66, t('mono.doc.chainDevices', { side: 'B' }));
    vdim(0, DA, -28, t('floorplan.depthA', { mm: DA }));
    vdim(DA, TOT, -28, t('floorplan.depthB', { mm: DB }));
    vdim(0, TOT, -56, t('floorplan.totalDepth', { mm: TOT }));
  } else {
    vdim(0, DA, -28, t('floorplan.blockDepth', { mm: DA }));
  }

  // --- kóta zkosení (§2 bod 6, jen u zkoseného konce) -----------------------
  if (rightChamfer) {
    g(`<line x1="${X(L - CH).toFixed(1)}" y1="${(Y(0) + 12).toFixed(1)}" x2="${X(L).toFixed(1)}" y2="${(Y(0) + 12).toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`);
    g(`<text x="${X(L - CH / 2).toFixed(1)}" y="${(Y(0) + 26).toFixed(1)}" font-size="8.6" fill="#41505f" text-anchor="middle">${esc(t('mono.doc.chamferDim', { c: CH }))}</text>`);
  }
  if (leftChamfer) {
    g(`<line x1="0" y1="${(Y(0) + 12).toFixed(1)}" x2="${X(CH).toFixed(1)}" y2="${(Y(0) + 12).toFixed(1)}" stroke="${THIN}" stroke-width="0.75"/>`);
    g(`<text x="${X(CH / 2).toFixed(1)}" y="${(Y(0) + 26).toFixed(1)}" font-size="8.6" fill="#41505f" text-anchor="middle">${esc(t('mono.doc.chamferDim', { c: CH }))}</text>`);
  }

  // ==========================================================================
  // SESTAVENÍ VÝSLEDNÉHO SVG ŘETĚZCE
  // ==========================================================================
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" font-family="Segoe UI, Arial, sans-serif" text-rendering="geometricPrecision">`);
  parts.push(`<rect x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="#ffffff"/>`);
  parts.push(`<g transform="translate(${PAD_L.toFixed(1)},${PAD_T.toFixed(1)})">`);
  parts.push(...body);
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

/** Sestaví kompletní SVG schéma (jako řetězec) z aktuálního stavu aplikace. */
export function buildFloorplanSVG(state) {
  // §ÚKOL PŮDORYS MONO — výhybka na začátku: SEGMENT (tělo funkce níž)
  // zůstává NEDOTČENÉ, MONO má vlastní kresbu (viz zadání §2).
  if (state.productType === 'mono') return buildMonoFloorplanSVG(state);
  const layout = computeLayout(state);
  const {
    lengthMM, heightMM, depthAMM, depthBMM, totalDepthMM, isIsland,
    plinthDepthA, plinthDepthB, gapA, gapB,
    itemsA, itemsB, items, armItems,
    depthGrownA, depthGrownB,
  } = layout;

  // základní jednotka odvozená z velikosti bloku — vše (čáry, text, mezery)
  // se jí škáluje, aby schéma bylo čitelné bez ohledu na rozměry bloku.
  const U = Math.max(lengthMM, totalDepthMM, 600) / 100;

  const planWidthMM = lengthMM + 2 * OVERHANG_MM;
  const planHeightMM = totalDepthMM + 2 * OVERHANG_MM;

  // --- typografie a linky — VÝRAZNĚ větší než v předchozí verzi (§12.2) -----
  const fontCode = U * 2.4;      // kód pozice (A1, B3…) v rámečku
  const fontLabel = U * 1.3;     // název přístroje na pozici
  const fontDim = U * 1.7;       // kóty
  const fontChain = U * 1.4;     // řetězcová kóta šířek
  const fontTitle = U * 2.3;     // nadpis
  const fontEdge = U * 1.5;      // popisky hran (ČELO/ZEĎ)
  const fontSmall = U * 1.1;     // drobné poznámky
  const strokeThin = Math.max(U * 0.07, 0.7);
  const strokeThick = Math.max(U * 0.14, 1.2);

  // --- rozvržení os kót — sousedící kóty sdílejí stejné odsazení (§12.2) ----
  const dimColStep = U * 9; // odstup mezi jednotlivými "sloupci" svislých kót
  // jednostranný blok: 2 sloupce (podestavba, hloubka bloku); ostrov: 3 sloupce
  // (podestavby A/B, hloubky stran A/B, celková hloubka bloku)
  const dimCols = isIsland ? 3 : 2;
  const leftMargin = U * 12 + dimColStep * dimCols;
  const rightMargin = U * 11; // prostor pro popisky ramen

  const chainBandH = U * 8; // pásmo pro řetězcovou kótu šířek pozic
  const titleH = U * 5.5;
  const totalLenBandH = U * 8;
  const bandGap = U * 2.5;

  // nahoře: nadpis, kóta celkové délky, (u ostrova) řetězcová kóta strany A
  const topMargin = titleH + totalLenBandH + bandGap + (isIsland ? chainBandH + bandGap : 0);
  // dole: řetězcová kóta (strana B u ostrova, jinak jediná strana) + rezerva
  const bottomMargin = chainBandH + bandGap * 1.5;

  const viewW = leftMargin + planWidthMM + rightMargin;

  const drawX = (xMM) => leftMargin + (xMM + lengthMM / 2 + OVERHANG_MM);
  const drawZ = (zMM) => topMargin + (zMM + OVERHANG_MM);

  const parts = [];

  // Soupis dílů (dřívější SVG "legenda" s textovými sloupci) byl přesunut do
  // js/report.js jako HTML <table> — tam, na rozdíl od SVG s pevnými
  // souřadnicemi, se sloupce samy nepřekrývají, i když je delší překlad
  // (§ČÁST 2 zadání — původní vada "Dimensions (w × d × h)" narážející do
  // "Base cabinet"). Toto SVG teď obsahuje JEN kresbu půdorysu.
  const viewH = topMargin + planHeightMM + bottomMargin + U * 4;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW.toFixed(1)} ${viewH.toFixed(1)}" ` +
    `font-family="Segoe UI, Arial, sans-serif" text-rendering="geometricPrecision">`
  );
  parts.push(`<rect x="0" y="0" width="${viewW.toFixed(1)}" height="${viewH.toFixed(1)}" fill="#ffffff" />`);

  // --- nadpis -----------------------------------------------------------------
  const variantLabel = isIsland ? t('floorplan.variantIsland') : t('floorplan.variantSingle');
  parts.push(
    `<text x="${leftMargin.toFixed(1)}" y="${(U * 4).toFixed(1)}" font-size="${fontTitle.toFixed(1)}" ` +
    `font-weight="700" fill="#000">${esc(t('floorplan.title', { variant: variantLabel }))}</text>`
  );

  // --- kóta celkové délky (nad deskou) -----------------------------------------
  // Jediný volající (níže) kótuje vždy CELKOVOU délku bloku, proto má napevno
  // "silné" provedení (tloušťka čar strokeThick, černý text) — viz §ZMĚNA 3.
  function horizontalDimension(x1MM, x2MM, yDim, text, fontSize) {
    const x1 = drawX(x1MM);
    const x2 = drawX(x2MM);
    const tick = U * 1.4;
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${(yDim + tick).toFixed(1)}" x2="${x1.toFixed(1)}" y2="${(yDim - tick).toFixed(1)}" stroke="#000" stroke-width="${strokeThick}" />`);
    parts.push(`<line x1="${x2.toFixed(1)}" y1="${(yDim + tick).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(yDim - tick).toFixed(1)}" stroke="#000" stroke-width="${strokeThick}" />`);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${yDim.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${yDim.toFixed(1)}" stroke="#000" stroke-width="${strokeThick}" />`);
    parts.push(
      `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(yDim - U * 1.1).toFixed(1)}" font-size="${fontSize.toFixed(1)}" ` +
      `fill="#000" text-anchor="middle">${esc(text)}</text>`
    );
  }
  {
    const yTopEdge = drawZ(-OVERHANG_MM);
    const yDim = yTopEdge - totalLenBandH + U * 2;
    // svislé pomocné čáry od hrany desky ke kótě
    [(-lengthMM / 2), (lengthMM / 2)].forEach((xMM) => {
      const x = drawX(xMM);
      parts.push(`<line x1="${x.toFixed(1)}" y1="${yTopEdge.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(yDim - U * 1.4).toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    });
    horizontalDimension(-lengthMM / 2, lengthMM / 2, yDim, t('floorplan.totalLength', { mm: lengthMM }), fontDim);
  }

  // --- kóty hloubky vlevo (blok / podestavba) — zarovnané na společnou osu ----
  // colIndex 0 = nejblíž kresbě, vyšší číslo = dál vlevo (viz xDim níže).
  // U svislých kót platí obrácené pravidlo než u vodorovných: dílčí kóta
  // (podestavba, hloubka strany) patří DOVNITŘ (blíž kresbě, nižší colIndex),
  // celková kóta bloku patří VŽDY VNĚ (dál od kresby, nejvyšší colIndex) —
  // viz §ZMĚNA 1/3 zadání. `isOverall` řídí jen vzhled (silná/slabá čára,
  // velikost písma, barva), NE pozici (tu určuje colIndex).
  function verticalDimension(zTopMM, zBottomMM, colIndex, text, isOverall = false) {
    const z1 = drawZ(zTopMM);
    const z2 = drawZ(zBottomMM);
    const xEdge = drawX(-lengthMM / 2 - OVERHANG_MM);
    const xDim = xEdge - U * 6 - dimColStep * colIndex;
    const tick = U * 1.4;
    const sw = isOverall ? strokeThick : strokeThin;
    const fs = isOverall ? fontDim : fontChain;
    const fill = isOverall ? '#000' : '#333';
    parts.push(`<line x1="${xEdge.toFixed(1)}" y1="${z1.toFixed(1)}" x2="${(xDim - U).toFixed(1)}" y2="${z1.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    parts.push(`<line x1="${xEdge.toFixed(1)}" y1="${z2.toFixed(1)}" x2="${(xDim - U).toFixed(1)}" y2="${z2.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    parts.push(`<line x1="${xDim.toFixed(1)}" y1="${z1.toFixed(1)}" x2="${xDim.toFixed(1)}" y2="${z2.toFixed(1)}" stroke="#000" stroke-width="${sw}" />`);
    parts.push(`<line x1="${(xDim - tick / 2).toFixed(1)}" y1="${z1.toFixed(1)}" x2="${(xDim + tick / 2).toFixed(1)}" y2="${z1.toFixed(1)}" stroke="#000" stroke-width="${sw}" />`);
    parts.push(`<line x1="${(xDim - tick / 2).toFixed(1)}" y1="${z2.toFixed(1)}" x2="${(xDim + tick / 2).toFixed(1)}" y2="${z2.toFixed(1)}" stroke="#000" stroke-width="${sw}" />`);
    const midY = (z1 + z2) / 2;
    parts.push(
      `<text x="${(xDim - U * 1).toFixed(1)}" y="${midY.toFixed(1)}" font-size="${fs.toFixed(1)}" fill="${fill}" ` +
      `text-anchor="middle" transform="rotate(-90 ${(xDim - U * 1).toFixed(1)} ${midY.toFixed(1)})">${esc(text)}</text>`
    );
  }

  // Sloupce (colIndex), od nejblíž kresbě po nejvzdálenější:
  //   ostrov:      0 = podestavby A/B (dílčí), 1 = hloubky stran A/B (dílčí),
  //                2 = CELKOVÁ hloubka bloku (vně)
  //   jednostranný: 0 = podestavba (dílčí), 1 = hloubka bloku — CELKOVÁ (vně)
  if (isIsland) {
    verticalDimension(0, plinthDepthA, 0, t('floorplan.baseDepthA', { mm: round(plinthDepthA) }));
    verticalDimension(totalDepthMM - plinthDepthB, totalDepthMM, 0, t('floorplan.baseDepthB', { mm: round(plinthDepthB) }));
    verticalDimension(0, depthAMM, 1, t('floorplan.depthA', { mm: depthAMM }) + (depthGrownA ? t('floorplan.grownSuffix') : ''));
    verticalDimension(depthAMM, totalDepthMM, 1, t('floorplan.depthB', { mm: depthBMM }) + (depthGrownB ? t('floorplan.grownSuffix') : ''));
    verticalDimension(0, totalDepthMM, 2, t('floorplan.totalDepth', { mm: totalDepthMM }), true);
  } else {
    verticalDimension(0, plinthDepthA, 0, t('floorplan.baseDepth', { mm: round(plinthDepthA) }));
    verticalDimension(0, depthAMM, 1, t('floorplan.blockDepth', { mm: depthAMM }) + (depthGrownA ? t('floorplan.grownSuffix') : ''), true);
  }

  // --- pracovní deska (přesah 15 mm) -------------------------------------------
  parts.push(
    `<rect x="${drawX(-lengthMM / 2 - OVERHANG_MM).toFixed(1)}" y="${drawZ(-OVERHANG_MM).toFixed(1)}" ` +
    `width="${planWidthMM.toFixed(1)}" height="${planHeightMM.toFixed(1)}" fill="#fbfbfb" stroke="#000" stroke-width="${strokeThick}" />`
  );

  // --- popisky hran (ČELO/ZEĎ) -------------------------------------------------
  if (isIsland) {
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${(drawZ(-OVERHANG_MM) + U * 3.6).toFixed(1)}" ` +
      `font-size="${fontEdge.toFixed(1)}" fill="#333" text-anchor="middle" font-weight="600">${esc(t('floorplan.edgeFrontA'))}</text>`
    );
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${(drawZ(totalDepthMM + OVERHANG_MM) - U * 1.6).toFixed(1)}" ` +
      `font-size="${fontEdge.toFixed(1)}" fill="#333" text-anchor="middle" font-weight="600">${esc(t('floorplan.edgeFrontB'))}</text>`
    );
  } else {
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${(drawZ(-OVERHANG_MM) + U * 3.6).toFixed(1)}" ` +
      `font-size="${fontEdge.toFixed(1)}" fill="#333" text-anchor="middle" font-weight="600">${esc(t('floorplan.edgeFrontSingle'))}</text>`
    );
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${(drawZ(totalDepthMM + OVERHANG_MM) - U * 1.6).toFixed(1)}" ` +
      `font-size="${fontEdge.toFixed(1)}" fill="#333" text-anchor="middle" font-weight="600">${esc(t('floorplan.edgeWall'))}</text>`
    );
  }

  // --- boční krycí plechy (20 mm) na obou koncích ------------------------------
  [-1, 1].forEach((side) => {
    const xOuter = side * (lengthMM / 2);
    const xInner = side * (lengthMM / 2 - SIDE_PANEL_MM);
    const xLeft = Math.min(xOuter, xInner);
    parts.push(
      `<rect x="${drawX(xLeft).toFixed(1)}" y="${drawZ(0).toFixed(1)}" width="${SIDE_PANEL_MM.toFixed(1)}" ` +
      `height="${totalDepthMM.toFixed(1)}" fill="#e2e2e2" stroke="#000" stroke-width="${strokeThin}" />`
    );
  });

  // --- mezery za podestavbou (u zdi / u spáry ostrova) — jemně vytečkované ----
  function gapZone(zTopMM, zBottomMM, label) {
    if (zBottomMM - zTopMM < 1) return;
    parts.push(
      `<rect x="${drawX(-lengthMM / 2 + SIDE_PANEL_MM).toFixed(1)}" y="${drawZ(zTopMM).toFixed(1)}" ` +
      `width="${(lengthMM - 2 * SIDE_PANEL_MM).toFixed(1)}" height="${(zBottomMM - zTopMM).toFixed(1)}" ` +
      `fill="none" stroke="#999" stroke-width="${strokeThin}" stroke-dasharray="${(U * 0.7).toFixed(1)},${(U * 0.7).toFixed(1)}" />`
    );
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${(drawZ((zTopMM + zBottomMM) / 2) + fontSmall * 0.35).toFixed(1)}" ` +
      `font-size="${fontSmall.toFixed(1)}" fill="#888" text-anchor="middle" font-style="italic">${esc(label)}</text>`
    );
  }
  if (isIsland) {
    gapZone(plinthDepthA, depthAMM, t('floorplan.gap', { mm: gapA }));
    gapZone(depthAMM, depthAMM + gapB, t('floorplan.gap', { mm: gapB }));
  } else {
    gapZone(plinthDepthA, depthAMM, t('floorplan.gapWall', { mm: gapA }));
  }

  // --- spára mezi stranami A/B (ostrov) ---------------------------------------
  if (isIsland) {
    const ySeam = drawZ(depthAMM);
    parts.push(
      `<line x1="${drawX(-lengthMM / 2).toFixed(1)}" y1="${ySeam.toFixed(1)}" x2="${drawX(lengthMM / 2).toFixed(1)}" y2="${ySeam.toFixed(1)}" ` +
      `stroke="#000" stroke-width="${strokeThin}" stroke-dasharray="${(U * 1).toFixed(1)},${(U * 0.8).toFixed(1)}" />`
    );
  }

  // --- podestavby + přístroje na desce (dvě vrstvy dle §12.1) ------------------
  // mirrorX se předává dál do drawDeviceTopView (posun podle deviceAlign,
  // ZADANI-ZAROVNANI-PRISTROJE.md §6) — musí být STEJNÁ hodnota, jakou pro
  // tutéž stranu dostal layoutRow výš (false pro A, true pro B).
  function drawRow(rowItems, mirrorX) {
    rowItems.forEach((item) => {
      const x = drawX(item.xCenter - item.widthMM / 2);
      const y = drawZ(item.zTop);
      const w = item.widthMM;
      const h = item.plinthDepthMM;

      // vrstva 1 — obrys podestavby (plná čára)
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" ` +
        `fill="#f7f7f7" stroke="#000" stroke-width="${strokeThin}" />`
      );

      // vrstva 2 — schematický půdorys přístroje na desce (příp. dělení
      // podestavby zásuvek GN 1/1 na 2/3 pásy)
      drawDeviceTopView(parts, item, drawX, drawZ, strokeThin, mirrorX);
      if (item.seg.type === DRAWERS_TYPE) {
        drawDrawersTopView(parts, item, drawX, drawZ, strokeThin);
      }

      // kód pozice — velký, v rámečku
      const cx = x + w / 2;
      const codeBoxW = Math.min(w * 0.5, fontCode * 2.4);
      const codeBoxH = fontCode * 1.5;
      const codeBoxX = cx - codeBoxW / 2;
      const codeBoxY = y + U * 1.2;
      parts.push(
        `<rect x="${codeBoxX.toFixed(1)}" y="${codeBoxY.toFixed(1)}" width="${codeBoxW.toFixed(1)}" height="${codeBoxH.toFixed(1)}" ` +
        `fill="#fff" stroke="#000" stroke-width="${strokeThick}" />`
      );
      parts.push(
        `<text x="${cx.toFixed(1)}" y="${(codeBoxY + codeBoxH * 0.72).toFixed(1)}" font-size="${fontCode.toFixed(1)}" ` +
        `font-weight="700" fill="#000" text-anchor="middle">${esc(item.label)}</text>`
      );

      // název přístroje pod kódem (drobněji, detaily jsou v soupisu)
      const label = getSegmentLabel(item.seg);
      parts.push(
        `<text x="${cx.toFixed(1)}" y="${(y + h - U * 1).toFixed(1)}" font-size="${fontLabel.toFixed(1)}" fill="#000" ` +
        `text-anchor="middle">${esc(label)}</text>`
      );
    });
  }
  drawRow(itemsA, false);
  if (isIsland) drawRow(itemsB, true);

  if (items.length === 0) {
    parts.push(
      `<text x="${drawX(0).toFixed(1)}" y="${drawZ(totalDepthMM / 2).toFixed(1)}" font-size="${fontLabel.toFixed(1)}" ` +
      `fill="#888" text-anchor="middle" font-style="italic">${esc(t('floorplan.emptyBlock'))}</text>`
    );
  }

  // --- napouštěcí ramena --------------------------------------------------------
  const armRadius = Math.max(U * 0.9, 2.2);
  armItems.forEach(({ arm, index, xMM, zMM }) => {
    const cx = drawX(xMM);
    const cy = drawZ(zMM);
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${armRadius.toFixed(1)}" fill="#fff" stroke="#000" stroke-width="${strokeThick}" />`);
    parts.push(`<line x1="${(cx - armRadius * 0.6).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + armRadius * 0.6).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${(cy - armRadius * 0.6).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy + armRadius * 0.6).toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    const labelX = cx + armRadius + U * 0.9;
    parts.push(
      `<text x="${labelX.toFixed(1)}" y="${(cy - fontSmall * 0.3).toFixed(1)}" font-size="${fontSmall.toFixed(1)}" ` +
      `fill="#000" font-weight="700">${esc(t('floorplan.armLabel', { n: index + 1 }))}</text>`
    );
    parts.push(
      `<text x="${labelX.toFixed(1)}" y="${(cy + fontSmall * 1.2).toFixed(1)}" font-size="${fontSmall.toFixed(1)}" ` +
      `fill="#444">${esc(t('floorplan.armPositionX', { mm: round(arm.positionXMM) }))}</text>`
    );
  });

  // --- řetězcová kóta šířek jednotlivých pozic (§12.2) -------------------------
  // Řada A: pásmo NAD deskou (u jejího čela) — Řada B (ostrov): pásmo POD
  // deskou (u jejího čela). U jednostranného bloku jediná kóta pod deskou.
  // Je to DÍLČÍ kóta (šířky jednotlivých pozic vůči celkové délce), proto má
  // "slabé" provedení (strokeThin/fontChain/šedý text) — viz §ZMĚNA 3 zadání.
  function widthChainDimension(rowItems, yLineTopSide) {
    if (!rowItems.length) return;
    const sorted = [...rowItems].sort((a, b) => a.xCenter - b.xCenter);
    const yEdge = yLineTopSide ? drawZ(-OVERHANG_MM) : drawZ(totalDepthMM + OVERHANG_MM);
    const yLine = yLineTopSide ? yEdge - chainBandH + U * 1.5 : yEdge + chainBandH - U * 1.5;
    const tick = U * 1.3;
    // svislé pomocné čáry na hranicích pozic
    const bounds = [sorted[0].xCenter - sorted[0].widthMM / 2];
    sorted.forEach((it) => bounds.push(it.xCenter + it.widthMM / 2));
    bounds.forEach((xMM) => {
      const x = drawX(xMM);
      parts.push(`<line x1="${x.toFixed(1)}" y1="${yEdge.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLine.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
      parts.push(`<line x1="${(x - tick / 2).toFixed(1)}" y1="${yLine.toFixed(1)}" x2="${(x + tick / 2).toFixed(1)}" y2="${yLine.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    });
    const xFirst = drawX(bounds[0]);
    const xLast = drawX(bounds[bounds.length - 1]);
    parts.push(`<line x1="${xFirst.toFixed(1)}" y1="${yLine.toFixed(1)}" x2="${xLast.toFixed(1)}" y2="${yLine.toFixed(1)}" stroke="#000" stroke-width="${strokeThin}" />`);
    sorted.forEach((it) => {
      const x1 = drawX(it.xCenter - it.widthMM / 2);
      const x2 = drawX(it.xCenter + it.widthMM / 2);
      const textY = yLineTopSide ? yLine - U * 0.9 : yLine + fontChain + U * 0.3;
      parts.push(
        `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${textY.toFixed(1)}" font-size="${fontChain.toFixed(1)}" ` +
        `fill="#333" text-anchor="middle">${round(it.widthMM)}</text>`
      );
    });
  }
  if (isIsland) {
    widthChainDimension(itemsA, true);
    widthChainDimension(itemsB, false);
  } else {
    widthChainDimension(itemsA, false);
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * Nastaví overlay s tiskovým dokumentem (report.js) nad 3D viewportem —
 * otevření/zavření, stažení půdorysu jako .svg a tisk. `getState()` vrací
 * aktuální stav aplikace (main.js), `buildContent(state)` sestaví obsah
 * překryvu (main.js — spojuje report.js/buildReport s náhledy 3D scény,
 * ke kterým floorplan.js nemá přístup) a vrátí hotový HTMLElement.
 * `onOpenChange(isOpen)` (volitelné) informuje main.js o změně stavu
 * otevřenosti (aby šlo v ui.js zvýraznit #floorplan-btn jako aktivní —
 * §1A), ať už k ní došlo tlačítkem, klávesou Escape nebo kliknutím mimo
 * dokument. Tlačítko s křížkem bylo zrušeno (§1A) — čtvrtým "pohledem" se
 * teď stalo samo #floorplan-btn, viz ui.js/main.js.
 */
export function setupFloorplan({ getState, buildContent, onOpenChange }) {
  const overlay = document.getElementById('floorplan-overlay');
  const container = document.getElementById('floorplan-svg-container');
  const downloadBtn = document.getElementById('floorplan-download-btn');
  const printBtn = document.getElementById('report-print-btn');

  let lastSvgString = '';

  function render() {
    const state = getState();
    // vlastní kresba půdorysu (pro stažení jako samostatné .svg) — nezávisle
    // na obsahu celého tiskového dokumentu níže
    lastSvgString = buildFloorplanSVG(state);
    container.innerHTML = '';
    if (typeof buildContent === 'function') {
      container.appendChild(buildContent(state));
    }
  }

  function isOpen() {
    return !overlay.hidden;
  }

  function notifyOpenChange(value) {
    if (typeof onOpenChange === 'function') onOpenChange(value);
  }

  function open() {
    render();
    overlay.hidden = false;
    notifyOpenChange(true);
  }

  function close() {
    if (overlay.hidden) return; // už zavřeno — nevolat onOpenChange zbytečně znovu
    overlay.hidden = true;
    notifyOpenChange(false);
  }

  function refreshIfOpen() {
    if (isOpen()) render();
  }

  // klik mimo dokument (na samotný překryv) dokument zavře
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
  // §1A — Escape zůstává jako klávesová cesta zpět i po zrušení křížku
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && isOpen()) close();
  });

  downloadBtn.addEventListener('click', () => {
    if (!lastSvgString) return;
    const blob = new Blob([lastSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('floorplan.filenamePrefix')}-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  return { open, close, isOpen, refreshIfOpen };
}
