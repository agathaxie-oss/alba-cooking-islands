// report.js — tiskový dokument (nabídkový list varného bloku), §ČÁST 2 zadání.
//
// export function buildReport(ctx) vrací HTMLElement s hotovým dokumentem,
// který se vloží do #floorplan-svg-container (viz floorplan.js/setupFloorplan,
// main.js). Dokument se TISKNE přímo z prohlížeče (window.print() + tiskový
// styl v css/style.css, blok @media print) — ŽÁDNÁ knihovna na PDF (jsPDF by
// neuměla českou/polskou diakritiku ve vestavěných fontech, html2canvas by
// udělal z textu bitmapu). Tímto zůstává text vektorový a diakritika funguje.
//
// ctx = { state, floorplanSvg, previews }
//   state        — aktuální stav aplikace (main.js) — rozměry, varianta,
//                  segmentsA/B, ramena, jazyk se čte přes i18n.js přímo
//   floorplanSvg — hotový SVG řetězec kresby půdorysu (js/floorplan.js
//                  buildFloorplanSVG) — vkládá se jen kresba, soupis dílů je
//                  tady v této HTML tabulce (§ČÁST 2 bod 3)
//   previews     — data URI náhledů 3D scény ve dvojnásobném rozlišení
//                  (main.js je vyrenderuje VLASTNÍM offscreen rendererem, ať
//                  se nezmění kamera hlavní scény — viz TEST 3):
//                  { perspective } u jednostranného bloku,
//                  { perspective, perspectiveB } u ostrovního bloku
//
// Layout jednotlivých pozic (A1, A2…/B1…), jejich rozměry a definice
// katalogového přístroje bere tento modul z js/floorplan.js/computeLayout —
// STEJNÝ zdroj pravdy jako kresba půdorysu, aby si SVG kresba a HTML soupis
// dílů nikdy neodporovaly.

import { t, getLang } from './i18n.js';
import {
  computeLayout, getBodyStyle, hasPanelFlag, hasShelfFlag, getPlinthType, getFinishType,
} from './floorplan.js';
import {
  getSegmentLabel, getInstrumentDef, DRAWERS_TYPE, getSegmentDrawerCount, SINK_VAT_HEIGHT_MM,
} from './modules.js';
import {
  ARM_SPOUT_HEIGHT, ARM_REACH, ARM_ANGLE_MAX, ARM_BACK_OFFSET_DEFAULT, ARM_CENTER_OFFSET_DEFAULT,
} from './arms.js';

// --- Technická specifikace materiálu — hodnoty jsou překladové KLÍČE (věty se
// musí lokalizovat), ne texty samotné. Prázdný klíč = údaj nedodán, vykreslí
// se jako „—" (viz buildMaterialSection). *** NIC SI NEVYMÝŠLET *** nad rámec
// toho, co dodal uživatel. Od 31. 7. 2026 jsou vyplněné všechny čtyři údaje.
const MATERIAL_SPEC = {
  steelGrade: 'report.steelGradeValue',
  worktopThickness: 'report.worktopThicknessValue',
  bodyThickness: 'report.bodyThicknessValue',
  surface: 'report.surfaceValue',
};

// --- Kontakty firmy (dodáno uživatelem). E-mail a web se odvozují podle
// jazykové mutace — viz companyContact(). Telefon/IČO/DIČ nedodány, zůstávají
// prázdné a do patičky se nepromítnou (viz buildFooter).
const COMPANY = {
  name: 'ALBA Professional s.r.o.',
  street: 'Sklenářka 487/1',
  city: '268 01 Hořovice',
  country: 'Česká republika',
  phone: '',
  regNo: '',
  vatNo: '',
};

// E-mail a web podle jazykové mutace dokumentu: cs/sk -> .cz, de -> .de,
// en/pl -> .com (mapování dodal uživatel, závazné).
function companyContact() {
  const lang = getLang();
  const domain = lang === 'de' ? 'de' : (lang === 'cs' || lang === 'sk') ? 'cz' : 'com';
  return { email: `info@alba-professional.${domain}`, web: `alba-professional.${domain}` };
}

// --- Pevné katalogové údaje výrobků (zadané uživatelem, ověřené) — NEMĚNIT
// a nedohledávat jinde. Výška/dosah/úhel napouštěcího ramene se berou přímo
// z js/arms.js (ARM_SPOUT_HEIGHT/ARM_REACH/ARM_ANGLE_MAX) — jediné, co tu
// chybí, je označení modelu (v arms.js není jako konstanta, jen v komentáři).
const ARM_MODEL = 'Klarco 1E.2959';
const FAUCET_MODEL = 'Klarco 1E.2904.82.76';
const FAUCET_HEIGHT_MM = 330;
const FAUCET_REACH_MM = 245;
const FAUCET_BODY_DIAMETER_MM = 55;
const FAUCET_FLANGE_DIAMETER_MM = 47;
const FAUCET_TUBE_DIAMETER_MM = 25;

// nad jakou celkovou délkou bloku dát půdorys na samostatnou stránku (§ČÁST 2 bod 3)
const FLOORPLAN_PAGE_BREAK_LENGTH_MM = 3000;

const LOCALE_MAP = { en: 'en-GB', de: 'de-DE', pl: 'pl-PL', cs: 'cs-CZ', sk: 'sk-SK' };

function formatDate() {
  const locale = LOCALE_MAP[getLang()] || 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
  } catch (err) {
    return new Date().toLocaleDateString();
  }
}

// --- malý DOM helper (bez šablonovacího enginu — čistý DOM, ať se dá snadno
// tisknout a stylovat stejnou cestou jako zbytek aplikace) -------------------
function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  children.forEach((child) => {
    if (child) node.appendChild(child);
  });
  return node;
}

function kvTable(rows, extraClass) {
  const table = el('table', { className: `report-table report-kv-table ${extraClass || ''}`.trim() });
  const tbody = document.createElement('tbody');
  rows.forEach(([label, value]) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    const td = document.createElement('td');
    td.textContent = value;
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

// --- logo (img/logo-alba.svg, fill="currentColor") --------------------------
// Aby fungovalo obarvení přes CSS proměnnou (--accent), musí být SVG vložené
// INLINE (do <img src="..."> se currentColor z okolní stránky nepromítne —
// obrázek se vykresluje ve vlastním izolovaném dokumentu). Načte se jednou
// (fetch, cache v modulové proměnné) a vloží se asynchronně, jakmile je
// k dispozici — element hlavičky se vrací synchronně hned.
let logoSvgText = null;
const logoSvgPromise = fetch('img/logo-alba.svg')
  .then((res) => res.text())
  .then((txt) => { logoSvgText = txt; return txt; })
  .catch(() => { logoSvgText = ''; return ''; });

function styleLogoSvg(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('height', '34');
  svg.removeAttribute('width');
  svg.style.height = '34px';
  svg.style.width = 'auto';
  svg.style.display = 'block';
}

function buildLogo() {
  const wrap = el('div', { className: 'report-logo' });
  if (logoSvgText !== null) {
    wrap.innerHTML = logoSvgText;
    styleLogoSvg(wrap);
  } else {
    logoSvgPromise.then((txt) => {
      wrap.innerHTML = txt;
      styleLogoSvg(wrap);
    });
  }
  return wrap;
}

// --- 1. Hlavička -------------------------------------------------------------
function buildHeader() {
  const header = el('header', { className: 'report-header' });
  const row = el('div', { className: 'report-header-row' });
  row.appendChild(buildLogo());

  const titleWrap = el('div', { className: 'report-title-wrap' });
  titleWrap.appendChild(el('h1', { className: 'report-title', text: t('report.title') }));
  titleWrap.appendChild(el('div', { className: 'report-date', text: `${t('report.date')}: ${formatDate()}` }));
  row.appendChild(titleWrap);

  header.appendChild(row);
  header.appendChild(document.createElement('hr')).className = 'report-rule';
  return header;
}

// --- 2. Náhledy 3D ------------------------------------------------------------
function buildPreviewFigure(dataUrl, caption) {
  const figure = el('figure', { className: 'report-preview-figure' });
  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = caption;
    img.className = 'report-preview-img';
    figure.appendChild(img);
  }
  figure.appendChild(el('figcaption', { className: 'report-preview-caption', text: caption }));
  return figure;
}

function buildPreviewsSection(ctx) {
  const { state, previews } = ctx;
  const section = el('section', { className: 'report-previews' });
  const isIsland = state.variant === 'island';
  const row = el('div', {
    className: `report-preview-row ${isIsland ? 'report-preview-row-double' : 'report-preview-row-single'}`,
  });
  if (isIsland) {
    row.appendChild(buildPreviewFigure(previews && previews.perspective, t('view.sideA')));
    row.appendChild(buildPreviewFigure(previews && previews.perspectiveB, t('view.sideB')));
  } else {
    row.appendChild(buildPreviewFigure(previews && previews.perspective, t('report.previewPerspective')));
  }
  section.appendChild(row);
  return section;
}

// --- 3. Půdorys ----------------------------------------------------------------
function buildFloorplanSection(ctx) {
  const { state, floorplanSvg } = ctx;
  const layout = computeLayout(state);
  const section = el('section', { className: 'report-section report-section-floorplan' });
  if (layout.lengthMM > FLOORPLAN_PAGE_BREAK_LENGTH_MM) {
    section.classList.add('report-page-break');
  }
  section.appendChild(el('h2', { text: t('report.sectionFloorplan') }));
  const wrap = document.createElement('div');
  wrap.className = 'report-floorplan-wrap';
  wrap.innerHTML = floorplanSvg || '';
  section.appendChild(wrap);
  return section;
}

// --- 4. Základní údaje bloku ----------------------------------------------------
function sumPower(items) {
  let totalKW = 0;
  let totalGasKW = 0;
  items.forEach((item) => {
    const def = item.def;
    if (!def) return;
    const p = Number(def.powerKW);
    if (p > 0) totalKW += p;
    const g = Number(def.gasKW);
    if (g > 0) totalGasKW += g;
  });
  return { totalKW, totalGasKW };
}

function buildBlockSection(ctx) {
  const { state } = ctx;
  const layout = computeLayout(state);
  const section = el('section', { className: 'report-section' });
  section.appendChild(el('h2', { text: t('report.sectionBlock') }));

  const variantLabel = layout.isIsland ? t('floorplan.variantIsland') : t('floorplan.variantSingle');
  const depthValue = layout.isIsland
    ? `${Math.round(layout.totalDepthMM)} mm ${t('dims.depthBreakdown', { a: Math.round(layout.depthAMM), b: Math.round(layout.depthBMM) })}`
    : `${Math.round(layout.depthAMM)} mm`;

  const { totalKW, totalGasKW } = sumPower(layout.items);

  const rows = [
    [t('report.rowVariant'), variantLabel],
    [t('dims.totalLength'), `${Math.round(layout.lengthMM)} mm`],
    [t('dims.totalDepth'), depthValue],
    [t('dims.totalHeight'), `${Math.round(layout.heightMM)} mm`],
    [t('report.segmentCount'), String(layout.items.length)],
    [t('report.totalPowerEl'), `${totalKW.toFixed(1)} kW — ${t('report.powerApprox')}`],
    [t('report.totalPowerGas'), `${totalGasKW.toFixed(1)} kW — ${t('report.powerApprox')}`],
  ];
  section.appendChild(kvTable(rows));
  return section;
}

// --- 5. Technická specifikace (vyhrazené místo) ---------------------------------
function buildMaterialSection() {
  const section = el('section', { className: 'report-section' });
  section.appendChild(el('h2', { text: t('report.sectionMaterial') }));
  const rows = [
    [t('report.steelGrade'), MATERIAL_SPEC.steelGrade ? t(MATERIAL_SPEC.steelGrade) : '—'],
    [t('report.worktopThickness'), MATERIAL_SPEC.worktopThickness ? t(MATERIAL_SPEC.worktopThickness) : '—'],
    [t('report.bodyThickness'), MATERIAL_SPEC.bodyThickness ? t(MATERIAL_SPEC.bodyThickness) : '—'],
    [t('report.surface'), MATERIAL_SPEC.surface ? t(MATERIAL_SPEC.surface) : '—'],
  ];
  section.appendChild(kvTable(rows));
  return section;
}

// --- 6. Soupis dílů (HTML tabulka — NE SVG texty, viz zadání) -------------------
function buildBaseCellText(item) {
  const seg = item.seg;
  if (seg.type === DRAWERS_TYPE) {
    return [
      t('floorplan.drawersLine', { n: getSegmentDrawerCount(seg) }),
      t('floorplan.panelLine', { value: hasPanelFlag(seg) ? t('common.yes') : t('common.no') }),
    ].join(' · ');
  }
  return [
    t(`bodyStyle.${getBodyStyle(seg, item.def)}`),
    t('floorplan.shelfLine', { value: hasShelfFlag(seg) ? t('common.yes') : t('common.no') }),
    t('floorplan.panelLine', { value: hasPanelFlag(seg) ? t('common.yes') : t('common.no') }),
  ].join(' · ');
}

function buildTechDataCellText(def) {
  if (!def) return '—';
  const parts = [];
  if (Number(def.powerKW) > 0) parts.push(t('floorplan.dataPower', { kw: def.powerKW }));
  if (Number(def.gasKW) > 0) parts.push(t('floorplan.dataGas', { kw: def.gasKW }));
  if (def.voltage) parts.push(t('floorplan.dataVoltage', { value: def.voltage }));
  return parts.length ? parts.join(' · ') : '—';
}

function buildPartsTable(items, heightMM) {
  const table = el('table', { className: 'report-table report-parts-table' });
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    t('floorplan.colPosition'),
    t('floorplan.colDevice'),
    t('field.catalogCode'),
    t('floorplan.colDimensions'),
    t('field.baseType'),
    t('field.plinth'),
    t('field.finish'),
    t('report.colTechData'),
  ].forEach((label) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  items.forEach((item) => {
    const seg = item.seg;
    const def = item.def;
    const cellValues = [
      item.label,
      getSegmentLabel(seg),
      (def && def.catalogCode) || '—',
      `${Math.round(item.widthMM)} × ${Math.round(item.plinthDepthMM)} × ${Math.round(heightMM)} mm`,
      buildBaseCellText(item),
      t(`plinth.${getPlinthType(seg)}`),
      getFinishType(seg),
      buildTechDataCellText(def),
    ];
    const tr = document.createElement('tr');
    cellValues.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function buildPartsSection(ctx) {
  const { state } = ctx;
  const layout = computeLayout(state);
  const section = el('section', { className: 'report-section report-section-parts' });
  section.appendChild(el('h2', { text: t('report.sectionParts') }));
  if (layout.isIsland) {
    section.appendChild(el('h3', { text: t('view.sideA') }));
    section.appendChild(buildPartsTable(layout.itemsA, layout.heightMM));
    section.appendChild(el('h3', { text: t('view.sideB') }));
    section.appendChild(buildPartsTable(layout.itemsB, layout.heightMM));
  } else {
    section.appendChild(buildPartsTable(layout.itemsA, layout.heightMM));
  }
  return section;
}

// --- 7. Ramena a baterie ---------------------------------------------------------
function buildFittingsSection(ctx) {
  const { state } = ctx;
  const layout = computeLayout(state);
  const arms = Array.isArray(state.arms) ? state.arms : [];
  const sinkItems = layout.items.filter(
    (item) => item.def && item.def.topFeature && item.def.topFeature.type === 'sink'
  );

  if (arms.length === 0 && sinkItems.length === 0) return null; // §7 — oddíl se vynechá celý

  const section = el('section', { className: 'report-section' });
  section.appendChild(el('h2', { text: t('report.sectionFittings') }));

  const isIsland = state.variant === 'island';
  arms.forEach((arm, idx) => {
    const block = el('div', { className: 'report-fitting-block' });
    block.appendChild(el('h3', { text: t('report.fittingArm', { n: idx + 1 }) }));
    const offsetLabel = isIsland ? t('arms.offsetCenter') : t('arms.offsetBack');
    const offsetDefault = isIsland ? ARM_CENTER_OFFSET_DEFAULT : ARM_BACK_OFFSET_DEFAULT;
    const offsetValue = arm.offsetMM != null ? Number(arm.offsetMM) : offsetDefault;
    block.appendChild(kvTable([
      [t('field.positionX'), `${Math.round(Number(arm.positionXMM) || 0)} mm`],
      [offsetLabel, `${Math.round(offsetValue)} mm`],
    ]));
    block.appendChild(el('p', {
      className: 'report-fitting-spec',
      text: t('report.armSpecLine', {
        type: ARM_MODEL,
        height: Math.round(ARM_SPOUT_HEIGHT * 1000),
        reach: Math.round(ARM_REACH * 1000),
        angle: ARM_ANGLE_MAX,
      }),
    }));
    section.appendChild(block);
  });

  sinkItems.forEach((item) => {
    const seg = item.seg;
    const block = el('div', { className: 'report-fitting-block' });
    block.appendChild(el('h3', { text: t('report.fittingFaucet', { pos: item.label }) }));
    block.appendChild(el('p', {
      className: 'report-fitting-spec',
      text: t('report.basinSize', {
        w: Math.round(Number(seg.vatWidthMM) || 0),
        d: Math.round(Number(seg.vatDepthMM) || 0),
        h: SINK_VAT_HEIGHT_MM,
      }),
    }));
    block.appendChild(el('p', {
      className: 'report-fitting-spec',
      text: t('report.faucetSpecLine', {
        type: FAUCET_MODEL,
        height: FAUCET_HEIGHT_MM,
        reach: FAUCET_REACH_MM,
        bodyD: FAUCET_BODY_DIAMETER_MM,
        flangeD: FAUCET_FLANGE_DIAMETER_MM,
        tubeD: FAUCET_TUBE_DIAMETER_MM,
      }),
    }));
    section.appendChild(block);
  });

  return section;
}

// --- 8. Patička ------------------------------------------------------------------
function buildFooter() {
  const footer = el('footer', { className: 'report-footer' });
  footer.appendChild(document.createElement('hr')).className = 'report-rule report-rule-footer';
  const contact = companyContact();
  const parts = [
    COMPANY.name, COMPANY.street, COMPANY.city, COMPANY.country,
    COMPANY.phone, contact.email, contact.web, COMPANY.regNo, COMPANY.vatNo,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  footer.appendChild(el('p', { className: 'report-footer-company', text: parts.join(' · ') }));
  return footer;
}

/** Sestaví celý tiskový dokument (nabídkový list varného bloku) a vrátí ho
 *  jako hotový (odpojený) HTMLElement — volající (floorplan.js/setupFloorplan,
 *  přes main.js) ho vloží do #floorplan-svg-container. */
export function buildReport(ctx) {
  const root = el('div', { className: 'report-document' });
  root.appendChild(buildHeader());
  root.appendChild(buildPreviewsSection(ctx));
  root.appendChild(buildBlockSection(ctx));
  root.appendChild(buildMaterialSection());
  root.appendChild(buildFloorplanSection(ctx));
  root.appendChild(buildPartsSection(ctx));
  const fittings = buildFittingsSection(ctx);
  if (fittings) root.appendChild(fittings);
  root.appendChild(buildFooter());
  return root;
}
