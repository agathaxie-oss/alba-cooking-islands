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
} from './modules.js';
import {
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
} from './arms.js';
import { t } from './i18n.js';

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

function drawDeviceTopView(parts, item, drawX, drawZ, strokeThin) {
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
  const cxMM = item.xCenter;
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

/** Sestaví kompletní SVG schéma (jako řetězec) z aktuálního stavu aplikace. */
export function buildFloorplanSVG(state) {
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
  function drawRow(rowItems) {
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
      drawDeviceTopView(parts, item, drawX, drawZ, strokeThin);
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
  drawRow(itemsA);
  if (isIsland) drawRow(itemsB);

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
