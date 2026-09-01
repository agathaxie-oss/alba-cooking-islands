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
import { computeLayout, computeMonoDocModel } from './floorplan.js';
import {
  getSegmentLabel, getInstrumentDef, DRAWERS_TYPE, getSegmentDrawerCount, SINK_VAT_HEIGHT_MM,
  getSegmentBodyStyle, hasPanelFlag, hasShelfFlag, getSegmentFinish, BODY_STACK_MM,
} from './modules.js';
import {
  ARM_SPOUT_HEIGHT, ARM_REACH, ARM_ANGLE_MAX, ARM_BACK_OFFSET_DEFAULT, ARM_CENTER_OFFSET_DEFAULT,
} from './arms.js';
// ÚKOL 21 (ZADANI-PUDORYS-MONO.md, Agent D, §4) — pevné konstrukční konstanty
// pro věty tabulky „Popis varného bloku". computeMonoDocModel je JEDINÝ zdroj
// POLOH a ČÍSLOVÁNÍ (to se odsud nikdy nedopočítává), ale schválené znění vět
// (mono.doc.*Value klíče níž) potřebuje pár napevno daných rozměrů stavby
// herdbloku, které model jako pole nevrací (výška herdbloku, čelo/přesah
// desky, panel…) — stejný princip, jakým report.js už výš u SEGMENTU čerpá
// ARM_SPOUT_HEIGHT/ARM_REACH/ARM_ANGLE_MAX přímo z arms.js.
import {
  END_TYPES as MONO_END_TYPES, sideInsetMM as monoSideInsetMM,
  HERDBLOK_HEIGHT_MM as MONO_HERDBLOK_HEIGHT_MM,
  DESK_FACE_HEIGHT_MM as MONO_DESK_FACE_HEIGHT_MM,
  DESK_OVERHANG_FRONT_MM as MONO_DESK_OVERHANG_FRONT_MM,
  PANEL_HEIGHT_MM as MONO_PANEL_HEIGHT_MM,
  PANEL_SETBACK_MM as MONO_PANEL_SETBACK_MM,
  LISTA_HEIGHT_MM as MONO_LISTA_HEIGHT_MM,
  END_STRAIGHT_MM as MONO_END_STRAIGHT_MM,
  END_CHAMFER_MM as MONO_END_CHAMFER_MM,
} from './mono-geometry.js';

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
    [t('field.plinth'), state.plinth ? t(`plinth.${state.plinth.type}`) : '—'],
    [t('field.plinthHeight'), state.plinth ? `${state.plinth.heightMM} mm` : '—'],
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
    t(`bodyStyle.${getSegmentBodyStyle(seg)}`),
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
      getSegmentFinish(seg),
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

// ============================================================================
// ALBA MONO — §4 dokument (ZADANI-PUDORYS-MONO.md, Agent D)
// ============================================================================
// Rozsah VÝHRADNĚ produkt MONO — SEGMENT (vše výš) zůstává NEDOTČENÉ, tenhle
// blok se přidává VEDLE. Jediný zdroj poloh a číslování je
// computeMonoDocModel(state) z floorplan.js — nic z toho se tu nedopočítává,
// jen se čte a skládá do karet/tabulky podle §4.

// --- schematické ikony (přenesené 1:1 z mockup-pudorys-mono.html, objekt ICO)
// — pro položky bez fotky z katalogu (podestavby, zásuvky, společné prvky,
// přístroje bez cardImage a neutrální plochy). Stejné tvary, jaké mockup
// odsouhlasil zadavatel. */
const MONO_ITEM_ICONS = {
  door: '<rect x="6" y="8" width="38" height="30" fill="none" stroke="#5d6b7a"/>'
    + '<line x1="25" y1="8" x2="25" y2="38" stroke="#5d6b7a" stroke-width="2"/>',
  drawers: '<rect x="6" y="8" width="38" height="30" fill="none" stroke="#5d6b7a"/>'
    + '<line x1="6" y1="23" x2="44" y2="23" stroke="#5d6b7a"/>',
  runners: '<rect x="6" y="6" width="38" height="34" fill="none" stroke="#5d6b7a"/>'
    + [0, 1, 2, 3, 4, 5].map((i) => `<line x1="10" y1="${10 + i * 5}" x2="18" y2="${10 + i * 5}" stroke="#5d6b7a"/>`
      + `<line x1="32" y1="${10 + i * 5}" x2="40" y2="${10 + i * 5}" stroke="#5d6b7a"/>`).join(''),
  shelf: '<rect x="6" y="8" width="38" height="30" fill="none" stroke="#5d6b7a"/>'
    + '<line x1="6" y1="23" x2="44" y2="23" stroke="#5d6b7a" stroke-dasharray="3 2"/>',
  socket: '<rect x="12" y="14" width="26" height="18" fill="none" stroke="#5d6b7a"/>'
    + '<circle cx="25" cy="23" r="4" fill="#5d6b7a"/>',
  plain: '<rect x="6" y="12" width="38" height="22" fill="none" stroke="#5d6b7a"/>'
    + '<line x1="6" y1="12" x2="44" y2="12" stroke="#5d6b7a" stroke-width="2.5"/>',
  end: '<rect x="18" y="4" width="14" height="38" fill="#e8ecf0" stroke="#5d6b7a"/>',
  endch: '<polygon points="18,4 32,4 32,10 32,36 32,42 18,42" fill="#e8ecf0" stroke="#5d6b7a"/>'
    + '<line x1="32" y1="10" x2="26" y2="4" stroke="#5d6b7a"/>',
  plinth: '<rect x="6" y="18" width="38" height="12" fill="#e8ecf0" stroke="#5d6b7a"/>',
  arm: '<path d="M17 40 L17 18 A8 8 0 0 1 33 18 L33 40" fill="none" stroke="#5d6b7a" stroke-width="2"/>',
};

function buildMonoIcon(icoKey) {
  const wrap = el('div', { className: 'report-item-icon' });
  wrap.innerHTML = `<svg width="96" height="88" viewBox="0 0 50 46">${MONO_ITEM_ICONS[icoKey] || ''}</svg>`;
  return wrap;
}

// --- karta položky (§4: „záhlaví = code + name; tělo = fotka vedle popisu")
// — společný stavební kámen pro všechny čtyři druhy položek (přístroj,
// podestavba, zásuvka, společný prvek). ŽÁDNÉ sloupce rozměry/příkon/poloha —
// všechno je už hotové v item.params (viz computeMonoDocModel).
function buildMonoItemCard(item, media) {
  const card = el('div', { className: 'report-item' });
  const head = el('div', { className: 'report-item-head' });
  head.appendChild(el('span', { className: 'report-item-pos', text: item.code }));
  head.appendChild(el('span', { className: 'report-item-name', text: item.name }));
  card.appendChild(head);
  const body = el('div', { className: 'report-item-body' }, [
    media,
    el('div', { className: 'report-item-desc', text: (item.params || []).join(' · ') }),
  ]);
  card.appendChild(body);
  return card;
}

// --- karty podle druhu položky — jen výběr fotka/ikona, popis je vždy
// item.params.join(' · ') (viz buildMonoItemCard). --------------------------
function buildMonoDeviceCard(device) {
  const media = el('div', { className: 'report-item-photo' });
  const cardImage = !device.isSurface && device.def && device.def.cardImage;
  if (cardImage) {
    const img = document.createElement('img');
    img.src = cardImage;
    img.alt = device.name;
    media.appendChild(img);
  } else {
    // neutrální plocha i přístroj bez fotky v katalogu → schematická ikona
    media.appendChild(buildMonoIcon('plain'));
  }
  return buildMonoItemCard(device, media);
}

function buildMonoCabinetCard(cab) {
  const icoKey = cab.kind === 'drawers'
    ? 'drawers'
    : cab.kind === 'gnRack'
      ? 'runners'
      : (cab.bodyStyle === 'open' ? 'shelf' : 'door');
  const media = el('div', { className: 'report-item-photo' }, [buildMonoIcon(icoKey)]);
  return buildMonoItemCard(cab, media);
}

function buildMonoSocketCard(sock) {
  const media = el('div', { className: 'report-item-photo' }, [buildMonoIcon('socket')]);
  return buildMonoItemCard(sock, media);
}

function buildMonoCommonCard(item, model) {
  let icoKey;
  if (item.kind === 'endPanel') {
    // S1 je vždy levý konec, S2 pravý (pořadí dané computeMonoDocModel) —
    // typ zakončení se čte z FYZICKÝCH konců bloku na modelu, ne ze strany.
    const endType = item.code === 'S1' ? model.leftEndType : model.rightEndType;
    icoKey = endType === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER ? 'endch' : 'end';
  } else if (item.kind === 'plinth') {
    icoKey = 'plinth';
  } else if (item.kind === 'arm') {
    icoKey = 'arm';
  } else {
    icoKey = 'plain'; // pojistka pro neočekávaný kind, do modelu zatím nepřidán
  }
  const media = el('div', { className: 'report-item-photo' }, [buildMonoIcon(icoKey)]);
  return buildMonoItemCard(item, media);
}

// --- §4 bod 3: Popis varného bloku (tabulka klíč/hodnota) -------------------
// Znění vět opsané ze schváleného mockupu přes i18n klíče mono.doc.*Value
// (§3 zadání) — čísla se dosazují parametry t(), nikdy natvrdo v textu.
function monoEndValueText(endType, code) {
  const insetMM = monoSideInsetMM(endType);
  return endType === MONO_END_TYPES.VERTICAL_PLATE_CHAMFER
    ? t('mono.doc.endValue.waterfallChamfered', {
      mm: insetMM, flat: MONO_END_STRAIGHT_MM, chamfer: MONO_END_CHAMFER_MM, code,
    })
    : t('mono.doc.endValue.waterfall', { mm: insetMM, code });
}

function buildMonoBlockSection(model) {
  const section = el('section', { className: 'report-section' });
  section.appendChild(el('h2', { text: t('mono.doc.blockTitle') }));
  const variantKey = model.isIsland ? 'island' : 'single';
  const rows = [
    [t('mono.doc.series'), t(`mono.doc.seriesValue.${variantKey}`)],
    [t('mono.doc.dims'), t('mono.doc.dimsValue', {
      l: model.lengthMM, d: model.totalDepthMM, h: model.workHeightMM,
    })],
    [t('mono.doc.sideDepths'), model.isIsland
      ? t('mono.doc.sideDepthsValue.island', { a: model.depthAMM, b: model.depthBMM, total: model.totalDepthMM })
      : t('mono.doc.sideDepthsValue.single', { d: model.depthAMM })],
    [t('mono.doc.workHeight'), t(`mono.doc.workHeightValue.${model.plinth.type}`, {
      h: model.workHeightMM, body: BODY_STACK_MM, plinth: model.plinth.heightMM,
    })],
    [t('mono.doc.herdblokHeight'), t('mono.doc.herdblokHeightValue', { h: MONO_HERDBLOK_HEIGHT_MM })],
    [t('mono.doc.design'), t(`mono.doc.designValue.${variantKey}`)],
    [t('mono.doc.materials'), t('mono.doc.materialsValue')],
    [t('mono.doc.finish'), t('mono.doc.finishValue')],
    [t('mono.doc.endLeft'), monoEndValueText(model.leftEndType, 'S1')],
    [t('mono.doc.endRight'), monoEndValueText(model.rightEndType, 'S2')],
    [t('mono.doc.worktop'), t(`mono.doc.worktopValue.${variantKey}`, {
      front: MONO_DESK_FACE_HEIGHT_MM, overhang: MONO_DESK_OVERHANG_FRONT_MM,
    })],
    [t('mono.doc.panel'), t(`mono.doc.panelValue.${variantKey}`, {
      h: MONO_PANEL_HEIGHT_MM, setback: MONO_PANEL_SETBACK_MM, strip: MONO_LISTA_HEIGHT_MM,
    })],
    [t('mono.doc.electrical'), t(`mono.doc.electricalValue.${variantKey}`)],
  ];
  section.appendChild(kvTable(rows));
  return section;
}

// --- §4 bod 4: Soupis společných prvků (S1, S2, S3, S4…) --------------------
function buildMonoCommonSection(model) {
  const section = el('section', { className: 'report-section' });
  section.appendChild(el('h2', { text: t('mono.doc.commonTitle') }));
  model.common.forEach((item) => section.appendChild(buildMonoCommonCard(item, model)));
  return section;
}

// --- §4 bod 5: Půdorys — beze změny principu, jen jiný zdroj lengthMM (model
// místo computeLayout, který je SEGMENT-specific) pro rozhodnutí o zalomení
// stránky; samotné SVG dodává ctx.floorplanSvg (Agent G, buildMonoFloorplanSVG
// v main.js/floorplan.js). ---------------------------------------------------
function buildMonoFloorplanSection(ctx, model) {
  const section = el('section', { className: 'report-section report-section-floorplan' });
  if (model.lengthMM > FLOORPLAN_PAGE_BREAK_LENGTH_MM) {
    section.classList.add('report-page-break');
  }
  section.appendChild(el('h2', { text: t('report.sectionFloorplan') }));
  const wrap = document.createElement('div');
  wrap.className = 'report-floorplan-wrap';
  wrap.innerHTML = ctx.floorplanSvg || '';
  section.appendChild(wrap);
  return section;
}

// --- §4 bod 6: Soupis prvků podle stran (A1/A2/A3, B1/B2/B3) ----------------
// Prázdná kategorie (např. žádné zásuvky v panelu) se nevypisuje s prázdným
// podnadpisem — v zadání není výslovně řešeno, ohlášeno v přejímce.
function buildMonoSideParts(sideModel, sideLabel) {
  const frag = document.createDocumentFragment();
  frag.appendChild(el('h3', { text: sideLabel }));
  if (sideModel.devices.length) {
    frag.appendChild(el('h4', { text: t('mono.doc.devices') }));
    sideModel.devices.forEach((d) => frag.appendChild(buildMonoDeviceCard(d)));
  }
  if (sideModel.cabinets.length) {
    frag.appendChild(el('h4', { text: t('mono.doc.cabinets') }));
    sideModel.cabinets.forEach((c) => frag.appendChild(buildMonoCabinetCard(c)));
  }
  if (sideModel.sockets.length) {
    frag.appendChild(el('h4', { text: t('mono.doc.sockets') }));
    sideModel.sockets.forEach((s) => frag.appendChild(buildMonoSocketCard(s)));
  }
  return frag;
}

function buildMonoPartsSection(model) {
  const section = el('section', { className: 'report-section report-section-parts' });
  section.appendChild(el('h2', { text: t('mono.doc.partsTitle') }));
  section.appendChild(buildMonoSideParts(model.sides.A, t('view.sideA')));
  if (model.isIsland) {
    section.appendChild(buildMonoSideParts(model.sides.B, t('view.sideB')));
  }
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
 *  přes main.js) ho vloží do #floorplan-svg-container.
 *
 *  ÚKOL 21 (ZADANI-PUDORYS-MONO.md §4) — výhybka na MONO. Pořadí oddílů u
 *  MONO: hlavička → náhledy 3D → Popis varného bloku → Soupis společných
 *  prvků → Půdorys → Soupis prvků podle stran → patička. Oddíl ramen a
 *  baterií (§7, SEGMENT) se u MONO VYNECHÁVÁ — ramena jsou už mezi
 *  společnými prvky jako S4… (viz computeMonoDocModel). Větev SEGMENTU níž
 *  je beze změny. */
export function buildReport(ctx) {
  const { state } = ctx;
  const root = el('div', { className: 'report-document' });
  root.appendChild(buildHeader());
  root.appendChild(buildPreviewsSection(ctx));

  if (state && state.productType === 'mono') {
    const model = computeMonoDocModel(state);
    root.appendChild(buildMonoBlockSection(model));
    root.appendChild(buildMonoCommonSection(model));
    root.appendChild(buildMonoFloorplanSection(ctx, model));
    root.appendChild(buildMonoPartsSection(model));
  } else {
    root.appendChild(buildBlockSection(ctx));
    root.appendChild(buildMaterialSection());
    root.appendChild(buildFloorplanSection(ctx));
    root.appendChild(buildPartsSection(ctx));
    const fittings = buildFittingsSection(ctx);
    if (fittings) root.appendChild(fittings);
  }

  root.appendChild(buildFooter());
  return root;
}
