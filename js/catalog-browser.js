// catalog-browser.js — e-shop overlay továrního katalogu (ZADANI-KATALOG.md §7, etapa D).
// Katalog spravuje JEN obsah palety (add/remove). Přidání na blok je výhradně z palety.
// Detail položky žije uvnitř téhož overlay (#catalog-overlay).

import {
  getManifestItems,
  getCategories,
  getFactoryVersion,
  getItem,
  getItemSync,
  resolveName,
  getEntryDescription,
  getEntryConstruction,
  isInPalette,
  addToPalette,
  removeFromPalette,
} from './catalog.js';
import { t, getLang, onLangChange } from './i18n.js';

const ORIGIN_FLAG_SVGS = {
  IT: `<svg viewBox="0 0 18 12" aria-hidden="true"><rect width="18" height="4" y="0" fill="#009246"/><rect width="18" height="4" y="4" fill="#fff"/><rect width="18" height="4" y="8" fill="#CE2B37"/></svg>`,
  DE: `<svg viewBox="0 0 18 12" aria-hidden="true"><rect width="6" height="12" x="0" fill="#000"/><rect width="6" height="12" x="6" fill="#DD0000"/><rect width="6" height="12" x="12" fill="#FFCE00"/></svg>`,
};

const DEPTH_WARN_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5h1.5v4.5h-1.5V5zm0 6h1.5v1.5h-1.5V11z"/></svg>`;

function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function localizeTypeName(typeKey, categories, lang) {
  const types = categories && Array.isArray(categories.types) ? categories.types : [];
  const found = types.find((entry) => entry && entry.type === typeKey);
  if (found && found.name && typeof found.name === 'object') {
    return found.name[lang] || found.name.en || typeKey;
  }
  return typeKey || '';
}

function formatMm(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.round(n)} mm`;
}

function formatWidth(item) {
  if (!item) return '';
  if (item.widthAdjustable) {
    const min = Number(item.minWidthMM) || Number(item.widthMM) || 0;
    return t('catalog.widthFrom', { mm: Math.round(min) });
  }
  const w = Number(item.widthMM) || Number(item.minWidthMM) || 0;
  return w ? t('catalog.widthExact', { mm: Math.round(w) }) : '';
}

function formatDepth(item) {
  if (!item) return '';
  const depth = Number(item.depthMM) || 0;
  const min = Number(item.minDepthMM) || 0;
  if (depth && min && depth !== min) {
    return `${formatMm(depth)} (${t('catalog.detailMinDepth')}: ${formatMm(min)})`;
  }
  return formatMm(depth || min);
}

function formatControls(controls) {
  if (!controls) return '';
  const typeKey = controls.type ? `controlType.${controls.type}` : '';
  const typeLabel = typeKey ? t(typeKey) : '';
  const count = Number(controls.count);
  if (typeLabel && Number.isFinite(count) && count > 0) {
    return t('catalog.detailControlsValue', { type: typeLabel, count });
  }
  return typeLabel || '';
}

function formatBodyStyles(styles) {
  if (!Array.isArray(styles) || styles.length === 0) return '';
  return styles.map((s) => t(`bodyStyle.${s}`)).join(', ');
}

function formatKwNumber(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const lang = getLang();
  const locale = { en: 'en-GB', de: 'de-DE', pl: 'pl-PL', cs: 'cs-CZ', sk: 'sk-SK' }[lang] || 'en-GB';
  return n.toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

const ZONE_POSITION_I18N = {
  'front-left': 'catalog.zone.frontLeft',
  'front-right': 'catalog.zone.frontRight',
  'back-left': 'catalog.zone.backLeft',
  'back-right': 'catalog.zone.backRight',
  front: 'catalog.zone.front',
  back: 'catalog.zone.back',
};

const ZONE_POSITION_ABBR = {
  'front-left': 'catalog.zoneAbbr.frontLeft',
  'front-right': 'catalog.zoneAbbr.frontRight',
  'back-left': 'catalog.zoneAbbr.backLeft',
  'back-right': 'catalog.zoneAbbr.backRight',
  front: 'catalog.zoneAbbr.front',
  back: 'catalog.zoneAbbr.back',
};

/** Krátký souhrn výkonů pro kartu: „VL 7,5 · VP 5,5 · …“ nebo „7,5 / 5,5 kW“. */
function formatZonesCardSummary(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return '';
  const withPos = zones.every((z) => z && z.position && ZONE_POSITION_I18N[z.position]);
  if (withPos) {
    const parts = zones.map((z) => {
      const abbr = t(ZONE_POSITION_ABBR[z.position]);
      const kw = formatKwNumber(z.powerKW);
      return kw === '—' ? null : `${abbr} ${kw}`;
    });
    if (parts.some((p) => p == null)) return '';
    return parts.join(' · ');
  }
  const parts = zones.map((z) => formatKwNumber(z && z.powerKW));
  if (parts.some((p) => p === '—')) return '';
  return `${parts.join(' / ')} kW`;
}

function formatZonePositionLabel(position) {
  const key = ZONE_POSITION_I18N[position];
  return key ? t(key) : '';
}

function formatZonePowerLine(index, zone) {
  const kw = formatKwNumber(zone && zone.powerKW);
  const posLabel = formatZonePositionLabel(zone && zone.position);
  if (posLabel) return t('catalog.zonePowerAt', { position: posLabel, kw });
  return t('catalog.zonePower', { n: index + 1, kw });
}

/** Mini schématko půdorysu zón (pohled shora, front dole = čelo u panelu). */
function buildZonesSchematic(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return null;
  const byPos = new Map();
  zones.forEach((z) => {
    if (z && z.position) byPos.set(z.position, z);
  });

  const hasQuad = ['front-left', 'front-right', 'back-left', 'back-right']
    .some((p) => byPos.has(p));
  const hasPair = byPos.has('front') || byPos.has('back');
  if (!hasQuad && !hasPair) return null;

  const schematic = document.createElement('div');
  schematic.className = 'cat-zones-schematic';
  schematic.setAttribute('aria-hidden', 'true');

  const caption = document.createElement('div');
  caption.className = 'cat-zones-schematic-caption';
  caption.textContent = t('catalog.zoneSchematicCaption');
  schematic.appendChild(caption);

  const grid = document.createElement('div');
  grid.className = hasQuad ? 'cat-zones-grid cat-zones-grid-2x2' : 'cat-zones-grid cat-zones-grid-1x2';

  const cellOrder = hasQuad
    ? ['back-left', 'back-right', 'front-left', 'front-right']
    : ['back', 'front'];

  cellOrder.forEach((pos) => {
    const cell = document.createElement('div');
    cell.className = 'cat-zones-cell';
    const zone = byPos.get(pos);
    if (zone) {
      const abbr = document.createElement('span');
      abbr.className = 'cat-zones-cell-abbr';
      abbr.textContent = t(ZONE_POSITION_ABBR[pos]);
      const kw = document.createElement('span');
      kw.className = 'cat-zones-cell-kw';
      kw.textContent = `${formatKwNumber(zone.powerKW)} kW`;
      cell.appendChild(abbr);
      cell.appendChild(kw);
    } else {
      cell.classList.add('is-empty');
      cell.textContent = '—';
    }
    grid.appendChild(cell);
  });

  schematic.appendChild(grid);

  const frontHint = document.createElement('div');
  frontHint.className = 'cat-zones-schematic-front';
  frontHint.textContent = t('catalog.zoneSchematicFront');
  schematic.appendChild(frontHint);

  return schematic;
}

/** Skutečná fotka zhora (ne SVG placeholder). */
function isRealTopPhoto(path) {
  if (!path) return false;
  const clean = String(path).split('?')[0].toLowerCase();
  return /\.(webp|jpe?g|png|gif|avif)$/.test(clean);
}

function zoneMapByPosition(zones) {
  const byPos = new Map();
  if (!Array.isArray(zones)) return byPos;
  zones.forEach((z) => {
    if (z && z.position) byPos.set(z.position, z);
  });
  return byPos;
}

/** ALBA token z :root (fallback = hodnoty z css/style.css). */
function cssToken(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Paleta pro SVG topview — jen design-system neutrals/text, žádné Tailwind šedé. */
function schematicPalette() {
  return {
    plate: cssToken('--bg-panel-alt', '#EBECEC'),
    plateInset: cssToken('--border', '#D8D9D9'),
    ink: cssToken('--text-main', '#2B2A29'),
    muted: cssToken('--text-muted', '#5B5B5B'),
    metalDeep: cssToken('--border', '#D8D9D9'),
    glass: cssToken('--text-main', '#2B2A29'),
    glassMark: cssToken('--bg-panel-alt', '#EBECEC'),
    glassLabel: cssToken('--bg-panel', '#FEFEFE'),
  };
}

/**
 * SVG půdorys z topFeature + zones (front = dole u ovládacího panelu).
 * Používá se v detailu, když chybí reálná top fotka.
 */
function buildTopViewSchematic(item) {
  if (!item) return null;
  const type = item.topFeature && item.topFeature.type ? item.topFeature.type : 'none';
  const byPos = zoneMapByPosition(item.zones);
  const hasZones = byPos.size > 0;
  if (type === 'none' && !hasZones) return null;

  const widthMM = Math.max(1, Number(item.widthMM) || Number(item.minWidthMM) || 800);
  const depthMM = Math.max(
    1,
    Number(item.minCutoutDepthMM) || Number(item.depthMM) || Number(item.minDepthMM) || 700
  );

  const maxW = 400;
  const maxH = 300;
  const scale = Math.min(maxW / widthMM, maxH / depthMM);
  const W = Math.round(widthMM * scale);
  const H = Math.round(depthMM * scale);
  const pad = 14;
  const vbW = W + pad * 2;
  const vbH = H + pad * 2 + 22;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  svg.setAttribute('role', 'img');
  svg.classList.add('cat-detail-top-svg');
  svg.setAttribute('aria-label', t('catalog.detailTopImage'));

  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    if (text != null) node.textContent = text;
    return node;
  };

  const c = schematicPalette();

  // nerezová deska (ALBA neutrals)
  svg.appendChild(el('rect', {
    x: pad, y: pad, width: W, height: H, rx: 4, ry: 4,
    fill: c.plate, stroke: c.muted, 'stroke-width': 1.5,
  }));
  svg.appendChild(el('rect', {
    x: pad + 3, y: pad + 3, width: W - 6, height: H - 6, rx: 2, ry: 2,
    fill: 'none', stroke: c.plateInset, 'stroke-width': 1,
  }));

  const px = (fx) => pad + W * (0.5 + fx);
  // fy: 0 = vzadu (nahoře), 1 = vpředu (dole)
  const py = (fy) => pad + H * fy;
  const stroke = c.ink;

  const drawBurner = (fx, fy, r, label) => {
    const cx = px(fx);
    const cy = py(fy);
    const g = el('g');
    g.appendChild(el('circle', {
      cx, cy, r, fill: 'none', stroke, 'stroke-width': 1.6,
    }));
    g.appendChild(el('circle', {
      cx, cy, r: r * 0.28, fill: stroke, stroke: 'none',
    }));
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) + (Math.PI / 2) * i;
      g.appendChild(el('line', {
        x1: cx + Math.cos(a) * r * 0.42,
        y1: cy + Math.sin(a) * r * 0.42,
        x2: cx + Math.cos(a) * r * 0.92,
        y2: cy + Math.sin(a) * r * 0.92,
        stroke, 'stroke-width': 1.2,
      }));
    }
    if (label) {
      g.appendChild(el('text', {
        x: cx, y: cy + r + 12,
        'text-anchor': 'middle',
        'font-family': 'system-ui, sans-serif',
        'font-size': 11,
        'font-weight': 600,
        fill: c.ink,
      }, label));
    }
    svg.appendChild(g);
  };

  const zoneLabel = (pos) => {
    const z = byPos.get(pos);
    if (!z || z.powerKW == null || z.powerKW === '') return '';
    return `${formatKwNumber(z.powerKW)} kW`;
  };

  const tf = item.topFeature || {};

  if (type === 'burners4' || (type === 'none' && ['front-left', 'front-right', 'back-left', 'back-right'].some((p) => byPos.has(p)))) {
    const r = Math.min(W, H) * 0.13;
    // pořadí: BL, BR, FL, FR — front dole
    [
      ['back-left', -0.25, 0.30],
      ['back-right', 0.25, 0.30],
      ['front-left', -0.25, 0.70],
      ['front-right', 0.25, 0.70],
    ].forEach(([pos, fx, fy]) => drawBurner(fx, fy, r, zoneLabel(pos)));
  } else if (type === 'burners2' || (type === 'none' && (byPos.has('front') || byPos.has('back')))) {
    const r = Math.min(W, H) * 0.16;
    drawBurner(0, 0.30, r, zoneLabel('back'));
    drawBurner(0, 0.70, r, zoneLabel('front'));
  } else if (type === 'ceramic4') {
    svg.appendChild(el('rect', {
      x: pad + W * 0.06, y: pad + H * 0.06, width: W * 0.88, height: H * 0.88,
      fill: c.glass, stroke: stroke, 'stroke-width': 1.2, rx: 2,
    }));
    const r = Math.min(W, H) * 0.11;
    [
      ['back-left', -0.25, 0.30],
      ['back-right', 0.25, 0.30],
      ['front-left', -0.25, 0.70],
      ['front-right', 0.25, 0.70],
    ].forEach(([pos, fx, fy]) => {
      const cx = px(fx);
      const cy = py(fy);
      svg.appendChild(el('circle', {
        cx, cy, r, fill: 'none', stroke: c.glassMark, 'stroke-width': 1.5,
      }));
      const lab = zoneLabel(pos);
      if (lab) {
        svg.appendChild(el('text', {
          x: cx, y: cy + 4,
          'text-anchor': 'middle',
          'font-family': 'system-ui, sans-serif',
          'font-size': 10,
          'font-weight': 600,
          fill: c.glassLabel,
        }, lab));
      }
    });
  } else if (type === 'induction') {
    svg.appendChild(el('rect', {
      x: pad + W * 0.06, y: pad + H * 0.06, width: W * 0.88, height: H * 0.88,
      fill: c.glass, stroke: stroke, 'stroke-width': 1.2, rx: 2,
    }));
    const sq = Math.min(W, H) * 0.55;
    svg.appendChild(el('rect', {
      x: pad + (W - sq) / 2, y: pad + (H - sq) / 2, width: sq, height: sq,
      fill: 'none', stroke: c.glassMark, 'stroke-width': 1.4,
    }));
    svg.appendChild(el('circle', {
      cx: pad + W / 2, cy: pad + H / 2, r: sq * 0.32,
      fill: 'none', stroke: c.glassMark, 'stroke-width': 1.4,
    }));
  } else if (type === 'fryer2' || type === 'fryer1') {
    const vatWmm = Number(tf.vatWidthMM) > 0 ? Number(tf.vatWidthMM) : widthMM * 0.38;
    const vatDmm = Number(tf.vatDepthMM) > 0 ? Number(tf.vatDepthMM) : depthMM * 0.55;
    const vatW = Math.min(vatWmm * scale, W * 0.42);
    const vatD = Math.min(vatDmm * scale, H * 0.7);
    const centers = type === 'fryer1' ? [0] : [-0.24, 0.24];
    centers.forEach((fx) => {
      const x = px(fx) - vatW / 2;
      const y = pad + H * 0.14;
      svg.appendChild(el('rect', {
        x, y, width: vatW, height: vatD,
        fill: c.metalDeep, stroke, 'stroke-width': 1.4, rx: 2,
      }));
      [0.2, 0.5, 0.8].forEach((f) => {
        svg.appendChild(el('line', {
          x1: x + vatW * 0.12, y1: y + vatD * f,
          x2: x + vatW * 0.88, y2: y + vatD * f,
          stroke: c.muted, 'stroke-width': 1,
        }));
      });
    });
  } else if (type === 'grill') {
    const cookWmm = Number(tf.cookAreaWidthMM) > 0 ? Number(tf.cookAreaWidthMM) : widthMM * 0.9;
    const cookDmm = Number(tf.cookAreaDepthMM) > 0 ? Number(tf.cookAreaDepthMM) : depthMM * 0.78;
    const cookW = Math.min(cookWmm * scale, W - 16);
    const cookD = Math.min(cookDmm * scale, H - 16);
    const gx = pad + (W - cookW) / 2;
    const gy = pad + (H - cookD) / 2;
    svg.appendChild(el('rect', {
      x: gx, y: gy, width: cookW, height: cookD,
      fill: c.muted, stroke, 'stroke-width': 1.4,
    }));
    for (let i = 1; i <= 6; i++) {
      const rx = gx + (cookW * 0.5 * i) / 7;
      svg.appendChild(el('line', {
        x1: rx, y1: gy + cookD * 0.06,
        x2: rx, y2: gy + cookD * 0.94,
        stroke, 'stroke-width': 1,
      }));
    }
  } else if (type === 'bainmarie' || type === 'multipan' || type === 'sink') {
    const rw = W * (type === 'sink' ? 0.55 : 0.8);
    const rh = H * (type === 'sink' ? 0.45 : 0.62);
    svg.appendChild(el('rect', {
      x: pad + (W - rw) / 2,
      y: pad + (H - rh) * (type === 'sink' ? 0.38 : 0.22),
      width: rw, height: rh,
      fill: c.metalDeep, stroke, 'stroke-width': 1.4, rx: 3,
    }));
  } else if (hasZones) {
    // fallback: textová mřížka zón bez známého topFeature tvaru
    const positions = ['back-left', 'back-right', 'front-left', 'front-right'];
    const hasQuad = positions.some((p) => byPos.has(p));
    if (hasQuad) {
      const r = Math.min(W, H) * 0.12;
      [
        ['back-left', -0.25, 0.30],
        ['back-right', 0.25, 0.30],
        ['front-left', -0.25, 0.70],
        ['front-right', 0.25, 0.70],
      ].forEach(([pos, fx, fy]) => {
        if (!byPos.has(pos)) return;
        drawBurner(fx, fy, r, zoneLabel(pos));
      });
    }
  }

  // popisek „vpředu“
  svg.appendChild(el('text', {
    x: pad + W / 2,
    y: pad + H + 16,
    'text-anchor': 'middle',
    'font-family': 'system-ui, sans-serif',
    'font-size': 11,
    fill: c.muted,
  }, t('catalog.zoneSchematicFront')));

  return svg;
}

/** Blok top view v detailu: reálná fotka, jinak generovaný půdorys. */
function buildDetailTopView(item, name) {
  const topWrap = document.createElement('div');
  topWrap.className = 'cat-detail-top';
  topWrap.setAttribute('data-top-view', '1');

  const topLabel = document.createElement('div');
  topLabel.className = 'cat-detail-top-label';
  topLabel.textContent = t('catalog.detailTopImage');
  topWrap.appendChild(topLabel);

  if (isRealTopPhoto(item.topImage)) {
    const topImg = document.createElement('img');
    topImg.src = catalogAssetUrl(item.topImage);
    topImg.alt = name;
    topWrap.appendChild(topImg);
    return topWrap;
  }

  const schematic = buildTopViewSchematic(item);
  if (schematic) {
    topWrap.appendChild(schematic);
    return topWrap;
  }

  // poslední možnost: i placeholder SVG (ať není úplně prázdno, pokud cesta existuje)
  if (item.topImage) {
    const topImg = document.createElement('img');
    topImg.src = catalogAssetUrl(item.topImage);
    topImg.alt = name;
    topWrap.appendChild(topImg);
    return topWrap;
  }

  return null;
}

function formatTopFeature(topFeature) {
  if (!topFeature || !topFeature.type) return '';
  const key = `topFeature.${topFeature.type}`;
  const label = t(key);
  return label === key ? topFeature.type : label;
}

/** Relativní cesta + lehký cache-bust podle factoryVersion (ne absolutní URL). */
function catalogAssetUrl(path) {
  if (!path) return '';
  const ver = getFactoryVersion();
  if (!ver) return path;
  return path.includes('?') ? `${path}&v=${ver}` : `${path}?v=${ver}`;
}

/**
 * @param {{
 *   getBlockDepthMM?: () => number,
 *   onPaletteChange?: () => void,
 * }} opts
 */
export function setupCatalogBrowser(opts = {}) {
  const overlay = document.getElementById('catalog-overlay');
  const dialogEl = overlay ? overlay.querySelector('.cat-dialog') : null;
  const gridEl = document.getElementById('catalog-grid');
  const emptyEl = document.getElementById('catalog-empty');
  const detailEl = document.getElementById('catalog-detail');
  const depthSelect = document.getElementById('catalog-filter-depth');
  const typeSelect = document.getElementById('catalog-filter-type');
  const searchInput = document.getElementById('catalog-filter-search');
  const closeBtn = document.getElementById('catalog-close-btn');
  const depthHintEl = document.getElementById('catalog-depth-hint');
  const footEl = document.getElementById('catalog-foot');
  const titleEl = document.getElementById('catalog-title');
  const toolbarEl = overlay ? overlay.querySelector('.cat-toolbar') : null;

  if (!overlay || !gridEl || !detailEl) {
    console.error('catalog-browser: chybí #catalog-overlay / #catalog-grid / #catalog-detail v DOM');
    return { open() {}, close() {}, isOpen() { return false; }, refresh() {} };
  }

  let openState = false;
  /** @type {'grid' | 'detail'} */
  let viewMode = 'grid';
  /** @type {string | null} */
  let detailId = null;
  let detailLoadToken = 0;
  const scrollEl = overlay.querySelector('.cat-scroll');

  function lockPageScroll() {
    document.documentElement.classList.add('cat-overlay-open');
    document.body.classList.add('cat-overlay-open');
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('cat-overlay-open');
    document.body.classList.remove('cat-overlay-open');
  }

  function blockDepthMM() {
    const n = Number(opts.getBlockDepthMM?.());
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function setViewMode(mode) {
    viewMode = mode;
    const isDetail = mode === 'detail';
    if (dialogEl) dialogEl.classList.toggle('cat-is-detail', isDetail);
    if (toolbarEl) toolbarEl.hidden = isDetail;
    gridEl.hidden = isDetail;
    if (emptyEl && isDetail) emptyEl.hidden = true;
    detailEl.hidden = !isDetail;
    if (titleEl) {
      titleEl.textContent = isDetail ? t('catalog.detailTitle') : t('catalog.title');
    }
  }

  function fillFilterOptions() {
    const items = getManifestItems();
    const categories = getCategories();
    const lang = getLang();

    const depths = Array.from(new Set(
      items.map((it) => Number(it.minCutoutDepthMM)).filter((n) => Number.isFinite(n) && n > 0),
    )).sort((a, b) => a - b);

    const prevDepth = depthSelect ? depthSelect.value : '';
    if (depthSelect) {
      depthSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = t('catalog.allDepths');
      depthSelect.appendChild(allOpt);
      depths.forEach((mm) => {
        const opt = document.createElement('option');
        opt.value = String(mm);
        opt.textContent = `${mm} mm`;
        depthSelect.appendChild(opt);
      });
      if ([...depthSelect.options].some((o) => o.value === prevDepth)) {
        depthSelect.value = prevDepth;
      }
    }

    const typesInManifest = Array.from(new Set(items.map((it) => it.type).filter(Boolean))).sort();
    const prevType = typeSelect ? typeSelect.value : '';
    if (typeSelect) {
      typeSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = t('catalog.allTypes');
      typeSelect.appendChild(allOpt);
      typesInManifest.forEach((typeKey) => {
        const opt = document.createElement('option');
        opt.value = typeKey;
        opt.textContent = localizeTypeName(typeKey, categories, lang);
        typeSelect.appendChild(opt);
      });
      if ([...typeSelect.options].some((o) => o.value === prevType)) {
        typeSelect.value = prevType;
      }
    }

    if (searchInput) {
      searchInput.placeholder = t('catalog.searchPlaceholder');
    }
  }

  function filteredItems() {
    const items = getManifestItems();
    const depthVal = depthSelect ? depthSelect.value : '';
    const typeVal = typeSelect ? typeSelect.value : '';
    const q = searchInput ? norm(searchInput.value) : '';
    const lang = getLang();

    return items.filter((it) => {
      if (depthVal && String(it.minCutoutDepthMM) !== depthVal) return false;
      if (typeVal && it.type !== typeVal) return false;
      if (!q) return true;
      const name = norm(resolveName(it, lang));
      const code = norm(it.publicCode || '');
      const tags = Array.isArray(it.tags) ? norm(it.tags.join(' ')) : '';
      return name.includes(q) || code.includes(q) || tags.includes(q);
    });
  }

  function togglePalette(id) {
    if (isInPalette(id)) removeFromPalette(id);
    else addToPalette(id);
    opts.onPaletteChange?.();
  }

  function buildCard(item) {
    const lang = getLang();
    const categories = getCategories();
    const depth = blockDepthMM();
    const minCut = Number(item.minCutoutDepthMM) || 0;
    const inPalette = isInPalette(item.id);
    const name = resolveName(item, lang) || t('catalog.deviceFallbackName');
    const code = item.publicCode || '';
    const typeLabel = localizeTypeName(item.type, categories, lang);
    const showDepthBadge = depth > 0 && minCut > depth;

    const article = document.createElement('article');
    article.className = 'cat-card';
    article.dataset.id = item.id;
    article.tabIndex = 0;
    article.setAttribute('role', 'button');
    article.setAttribute('aria-label', name);

    const media = document.createElement('div');
    media.className = 'cat-card-media';
    if (item.cardImage) {
      const img = document.createElement('img');
      img.src = catalogAssetUrl(item.cardImage);
      img.alt = name;
      img.width = 400;
      img.height = 300;
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
    }
    if (item.origin) {
      const flag = document.createElement('span');
      flag.className = 'cat-flag';
      flag.title = t('catalog.originLabel');
      flag.innerHTML = (ORIGIN_FLAG_SVGS[item.origin] || '') + ` ${item.origin}`;
      media.appendChild(flag);
    }
    article.appendChild(media);

    const body = document.createElement('div');
    body.className = 'cat-card-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'cat-card-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);

    if (code) {
      const codeEl = document.createElement('div');
      codeEl.className = 'cat-card-code';
      codeEl.textContent = code;
      body.appendChild(codeEl);
    }

    const meta = document.createElement('div');
    meta.className = 'cat-card-meta';
    if (minCut) {
      const chip = document.createElement('span');
      chip.className = 'cat-chip';
      chip.textContent = `${minCut} mm`;
      meta.appendChild(chip);
    }
    if (typeLabel) {
      const chip = document.createElement('span');
      chip.className = 'cat-chip';
      chip.textContent = typeLabel;
      meta.appendChild(chip);
    }
    const fullItem = getItemSync(item.id);
    const zonesSummary = formatZonesCardSummary(fullItem && fullItem.zones);
    if (zonesSummary && zonesSummary.length <= 40) {
      const chip = document.createElement('span');
      chip.className = 'cat-chip cat-chip-zones';
      chip.textContent = zonesSummary;
      chip.title = t('catalog.detailZones');
      meta.appendChild(chip);
    }
    if (showDepthBadge) {
      const badge = document.createElement('span');
      badge.className = 'cat-badge-depth';
      badge.innerHTML = DEPTH_WARN_ICON + ' ' + t('catalog.depthWarnBadge', { mm: minCut });
      meta.appendChild(badge);
    }
    body.appendChild(meta);

    if (inPalette) {
      const status = document.createElement('div');
      status.className = 'cat-card-status';
      status.textContent = t('catalog.inPalette');
      body.appendChild(status);
    }

    // Mockup A: jedno CTA (paleta). Detail = klik na kartu / Enter.
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cat-card-cta' + (inPalette ? ' cat-in-palette' : '');
    cta.textContent = inPalette ? t('catalog.removeFromPalette') : t('catalog.addToPalette');
    cta.addEventListener('click', (ev) => {
      ev.stopPropagation();
      togglePalette(item.id);
      renderGrid();
    });
    body.appendChild(cta);

    article.appendChild(body);

    article.addEventListener('click', () => openDetail(item.id));
    article.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openDetail(item.id);
      }
    });

    return article;
  }

  function appendDetailRow(dl, label, value) {
    if (value == null || value === '') return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function buildDetail(item) {
    const lang = getLang();
    const categories = getCategories();
    const depth = blockDepthMM();
    const minCut = Number(item.minCutoutDepthMM) || 0;
    const inPalette = isInPalette(item.id);
    const name = resolveName(item, lang) || t('catalog.deviceFallbackName');
    const showDepthBadge = depth > 0 && minCut > depth;

    const root = document.createElement('div');
    root.className = 'cat-detail-inner';

    const nav = document.createElement('div');
    nav.className = 'cat-detail-nav';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'cat-detail-back';
    backBtn.textContent = t('catalog.detailBack');
    backBtn.addEventListener('click', showGrid);
    nav.appendChild(backBtn);

    const crumb = document.createElement('nav');
    crumb.className = 'cat-detail-crumb';
    crumb.setAttribute('aria-label', t('catalog.detailTitle'));
    const crumbCatalog = document.createElement('button');
    crumbCatalog.type = 'button';
    crumbCatalog.className = 'cat-detail-crumb-link';
    crumbCatalog.textContent = t('catalog.title');
    crumbCatalog.addEventListener('click', showGrid);
    const crumbSep = document.createElement('span');
    crumbSep.className = 'cat-detail-crumb-sep';
    crumbSep.textContent = '/';
    const crumbName = document.createElement('span');
    crumbName.className = 'cat-detail-crumb-current';
    crumbName.textContent = name;
    crumb.appendChild(crumbCatalog);
    crumb.appendChild(crumbSep);
    crumb.appendChild(crumbName);
    nav.appendChild(crumb);
    root.appendChild(nav);

    const layout = document.createElement('div');
    layout.className = 'cat-detail-layout';

    const media = document.createElement('div');
    media.className = 'cat-detail-media';
    if (item.cardImage) {
      const img = document.createElement('img');
      img.className = 'cat-detail-card-img';
      img.src = catalogAssetUrl(item.cardImage);
      img.alt = name;
      media.appendChild(img);
    }
    const topView = buildDetailTopView(item, name);
    if (topView) media.appendChild(topView);
    if (item.origin) {
      const flag = document.createElement('span');
      flag.className = 'cat-flag cat-detail-flag';
      flag.title = t('catalog.originLabel');
      flag.innerHTML = (ORIGIN_FLAG_SVGS[item.origin] || '') + ` ${item.origin}`;
      media.appendChild(flag);
    }
    layout.appendChild(media);

    const info = document.createElement('div');
    info.className = 'cat-detail-info';

    const nameEl = document.createElement('h3');
    nameEl.className = 'cat-detail-name';
    nameEl.textContent = name;
    info.appendChild(nameEl);

    if (item.publicCode) {
      const codeEl = document.createElement('div');
      codeEl.className = 'cat-detail-code';
      codeEl.textContent = item.publicCode;
      info.appendChild(codeEl);
    }

    if (showDepthBadge) {
      const badge = document.createElement('div');
      badge.className = 'cat-badge-depth';
      badge.innerHTML = DEPTH_WARN_ICON + ' ' + t('catalog.depthWarnBadge', { mm: minCut });
      info.appendChild(badge);
    }

    if (inPalette) {
      const status = document.createElement('div');
      status.className = 'cat-card-status';
      status.textContent = t('catalog.inPalette');
      info.appendChild(status);
    }

    const specs = document.createElement('dl');
    specs.className = 'cat-detail-specs';
    appendDetailRow(specs, t('catalog.detailOrigin'), item.origin || '');
    appendDetailRow(specs, t('catalog.detailType'), localizeTypeName(item.type, categories, lang));
    appendDetailRow(specs, t('catalog.detailMinCutout'), formatMm(minCut));
    appendDetailRow(specs, t('catalog.detailWidth'), formatWidth(item));
    if (item.widthAdjustable) {
      appendDetailRow(specs, t('catalog.detailWidthAdjustable'), t('common.yes'));
      if (item.minWidthMM) {
        appendDetailRow(specs, t('catalog.detailMinWidth'), formatMm(item.minWidthMM));
      }
    } else if (item.minWidthMM && Number(item.minWidthMM) !== Number(item.widthMM)) {
      appendDetailRow(specs, t('catalog.detailMinWidth'), formatMm(item.minWidthMM));
    }
    appendDetailRow(specs, t('catalog.detailDepth'), formatDepth(item));
    if (item.powerKW != null && item.powerKW !== '') {
      appendDetailRow(specs, t('catalog.detailPower'), `${item.powerKW} kW`);
    }
    appendDetailRow(specs, t('catalog.detailVoltage'), item.voltage || '');
    if (item.gasKW != null && item.gasKW !== '') {
      appendDetailRow(specs, t('catalog.detailGas'), `${item.gasKW} kW`);
    }
    appendDetailRow(specs, t('catalog.detailTopFeature'), formatTopFeature(item.topFeature));
    appendDetailRow(specs, t('catalog.detailControls'), formatControls(item.controls));
    appendDetailRow(specs, t('catalog.detailAllowedBodyStyles'), formatBodyStyles(item.allowedBodyStyles));
    appendDetailRow(specs, t('catalog.detailTopFixed'), item.topFixed ? t('common.yes') : t('common.no'));
    info.appendChild(specs);

    if (Array.isArray(item.zones) && item.zones.length > 0) {
      const section = document.createElement('section');
      section.className = 'cat-detail-section cat-detail-zones';
      const h = document.createElement('h4');
      h.textContent = t('catalog.detailZones');
      section.appendChild(h);
      const schematic = buildZonesSchematic(item.zones);
      if (schematic) section.appendChild(schematic);
      const list = document.createElement('ul');
      list.className = 'cat-detail-zones-list';
      item.zones.forEach((zone, index) => {
        const li = document.createElement('li');
        li.textContent = formatZonePowerLine(index, zone);
        list.appendChild(li);
      });
      section.appendChild(list);
      info.appendChild(section);
    }

    const description = getEntryDescription(item);
    if (description) {
      const section = document.createElement('section');
      section.className = 'cat-detail-section';
      const h = document.createElement('h4');
      h.textContent = t('catalog.detailDescription');
      const p = document.createElement('p');
      p.textContent = description;
      section.appendChild(h);
      section.appendChild(p);
      info.appendChild(section);
    }

    const construction = getEntryConstruction(item);
    if (construction) {
      const section = document.createElement('section');
      section.className = 'cat-detail-section';
      const h = document.createElement('h4');
      h.textContent = t('catalog.detailConstruction');
      const p = document.createElement('p');
      p.textContent = construction;
      section.appendChild(h);
      section.appendChild(p);
      info.appendChild(section);
    }

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cat-card-cta cat-detail-cta' + (inPalette ? ' cat-in-palette' : '');
    cta.textContent = inPalette ? t('catalog.removeFromPalette') : t('catalog.addToPalette');
    cta.addEventListener('click', () => {
      togglePalette(item.id);
      renderDetailContent(item.id);
    });
    info.appendChild(cta);

    layout.appendChild(info);
    root.appendChild(layout);
    return root;
  }

  function renderDetailContent(id) {
    const token = ++detailLoadToken;
    detailId = id;
    setViewMode('detail');
    detailEl.innerHTML = '';
    const loading = document.createElement('p');
    loading.className = 'cat-detail-loading';
    loading.textContent = t('catalog.detailLoading');
    detailEl.appendChild(loading);

    getItem(id).then((item) => {
      if (token !== detailLoadToken || viewMode !== 'detail' || detailId !== id) return;
      detailEl.innerHTML = '';
      if (!item) {
        const err = document.createElement('p');
        err.className = 'cat-detail-error';
        err.textContent = t('catalog.detailError');
        detailEl.appendChild(err);
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'cat-detail-back';
        backBtn.textContent = t('catalog.detailBack');
        backBtn.addEventListener('click', showGrid);
        detailEl.appendChild(backBtn);
        return;
      }
      detailEl.appendChild(buildDetail(item));
      if (footEl) {
        footEl.textContent = `${item.publicCode || item.id} · factoryVersion ${getFactoryVersion()}`;
      }
    }).catch((err) => {
      console.error('catalog-browser detail:', err);
      if (token !== detailLoadToken) return;
      detailEl.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'cat-detail-error';
      msg.textContent = t('catalog.detailError');
      detailEl.appendChild(msg);
    });
  }

  function openDetail(id) {
    if (!id) return;
    if (scrollEl) scrollEl.scrollTop = 0;
    renderDetailContent(id);
  }

  function showGrid() {
    detailLoadToken += 1;
    detailId = null;
    setViewMode('grid');
    renderGrid();
    if (scrollEl) scrollEl.scrollTop = 0;
    if (searchInput) searchInput.focus();
  }

  function renderGrid() {
    fillFilterOptions();
    const items = filteredItems();
    const all = getManifestItems();
    const depth = blockDepthMM();

    gridEl.innerHTML = '';
    items.forEach((item) => gridEl.appendChild(buildCard(item)));

    if (emptyEl) {
      if (viewMode === 'detail') {
        emptyEl.hidden = true;
      } else if (all.length === 0) {
        emptyEl.hidden = false;
        emptyEl.textContent = t('catalog.empty');
      } else if (items.length === 0) {
        emptyEl.hidden = false;
        emptyEl.textContent = t('catalog.noResults');
      } else {
        emptyEl.hidden = true;
      }
    }

    if (depthHintEl) {
      const hasDeeper = all.some((it) => Number(it.minCutoutDepthMM) > depth && depth > 0);
      if (hasDeeper) {
        depthHintEl.hidden = false;
        depthHintEl.innerHTML = DEPTH_WARN_ICON + ' '
          + t('catalog.depthWarnStrip', { mm: Math.max(...all.map((it) => Number(it.minCutoutDepthMM) || 0)) });
      } else {
        depthHintEl.hidden = true;
        depthHintEl.textContent = '';
      }
    }

    if (footEl && viewMode === 'grid') {
      footEl.textContent = `${items.length} / ${all.length} · factoryVersion ${getFactoryVersion()}`;
    }
  }

  function refresh() {
    if (viewMode === 'detail' && detailId) {
      renderDetailContent(detailId);
    } else {
      renderGrid();
    }
  }

  function open() {
    openState = true;
    overlay.hidden = false;
    lockPageScroll();
    if (scrollEl) scrollEl.scrollTop = 0;
    showGrid();
  }

  function close() {
    openState = false;
    detailLoadToken += 1;
    detailId = null;
    viewMode = 'grid';
    if (dialogEl) dialogEl.classList.remove('cat-is-detail');
    if (toolbarEl) toolbarEl.hidden = false;
    gridEl.hidden = false;
    detailEl.hidden = true;
    detailEl.innerHTML = '';
    overlay.hidden = true;
    unlockPageScroll();
    if (titleEl) titleEl.textContent = t('catalog.title');
    opts.onPaletteChange?.();
  }

  function onBackdropClick(ev) {
    if (ev.target === overlay) close();
  }

  function onKeyDown(ev) {
    if (!openState) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (viewMode === 'detail') showGrid();
      else close();
    }
  }

  /** Wheel na overlay ať nepropaguje na body/sidebar pod dialogem. */
  function onOverlayWheel(ev) {
    if (!openState) return;
    ev.stopPropagation();
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', onBackdropClick);
  overlay.addEventListener('wheel', onOverlayWheel, { passive: true });
  document.addEventListener('keydown', onKeyDown);
  if (depthSelect) depthSelect.addEventListener('change', () => { if (viewMode === 'grid') renderGrid(); });
  if (typeSelect) typeSelect.addEventListener('change', () => { if (viewMode === 'grid') renderGrid(); });
  if (searchInput) searchInput.addEventListener('input', () => { if (viewMode === 'grid') renderGrid(); });

  onLangChange(() => {
    if (!openState) return;
    refresh();
  });

  setViewMode('grid');

  return {
    open,
    close,
    isOpen: () => openState,
    refresh,
  };
}
