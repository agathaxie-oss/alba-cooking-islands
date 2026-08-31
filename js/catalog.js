// catalog.js — tovární katalog z katalog/manifest.json + lazy polozky/<id>.json
// (ZADANI-KATALOG.md §3, §9–§10, §12, §14.1; etapy B + D).
// Továrna se do localStorage NEZAPISUJE. Osobní předvolba = množina id
// **v paletě** (alba-katalog-paleta-v1). Kompatibilní most (getById/getCatalog/…)
// drží device-manager a starý kód při životě do etapy G.

import { getLang } from './i18n.js';

export const CATALOG_STORAGE_KEY = 'alba-katalog-v1';
export const PALETTE_STORAGE_KEY = 'alba-katalog-paleta-v1';
const HIDDEN_STORAGE_KEY = 'alba-katalog-skryte-v1';

const CONTROL_TYPES = ['knob', 'button', 'switch'];
const BODY_STYLES = ['closed', 'doors', 'open'];
const DEPTH_FLOOR = 400;
const DEPTH_CEIL = 1200;
const DEPTH_DEFAULT = 700;

/** Stará id → kanonické nové id (nebo null = záměrně bez položky). */
const ALIASES = {
  lotus_pcd_68g: 'al-pg22-800-g',
  lotus_f10d_64et: 'al-fr10-400-e',
  berner_bi1eg5: 'al-ind5-500-e',
  lotus_ftld_66et: null,
  alba_ebm_11: null,
};

let factoryVersion = 0;
/** @type {Array<object>} */
let manifestItems = [];
/** @type {object|null} */
let categories = null;
/** Cache normalizovaných továrních položek (kanonické id → item). */
const itemCache = new Map();
/** Paměťová vrstva z načteného projektu — NESLUČUJE se do továrny. */
const projectSnapshot = new Map();
/** @type {Set<string>} id továrních položek v osobní paletě */
let paletteIds = new Set();

function clampNum(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

function normalizeOptionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAllowedBodyStyles(rawAllowed) {
  const arr = Array.isArray(rawAllowed) ? rawAllowed.filter((v) => BODY_STYLES.includes(v)) : [];
  const unique = Array.from(new Set(arr));
  return unique.length ? unique : ['closed', 'doors', 'open'];
}

const ZONE_FUELS = ['gas', 'electric'];
const ZONE_POSITIONS = [
  'front-left',
  'front-right',
  'back-left',
  'back-right',
  'front',
  'back',
];

/** Zóny/hořáky: pořadí = RM zóna 1…N; `position` = místo na desce (viz 3D layout). */
function normalizeZones(rawZones) {
  if (!Array.isArray(rawZones) || rawZones.length === 0) return null;
  const zones = rawZones.map((z) => {
    if (!z || typeof z !== 'object') return null;
    const powerKW = z.powerKW === null || z.powerKW === undefined || z.powerKW === ''
      ? null
      : normalizeOptionalNumber(z.powerKW);
    const fuel = ZONE_FUELS.includes(z.fuel) ? z.fuel : null;
    const position = ZONE_POSITIONS.includes(z.position) ? z.position : null;
    return { powerKW, fuel, position };
  }).filter(Boolean);
  return zones.length ? zones : null;
}

function localizeField(field, lang) {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return '';
  const code = lang || 'en';
  if (typeof field[code] === 'string' && field[code]) return field[code];
  if (typeof field.en === 'string') return field.en;
  return '';
}

/**
 * Vyřeší alias. Vrací:
 * - kanonické id (string),
 * - null pokud alias cíleně nemá položku,
 * - vstupní id pokud není v mapě aliasů.
 */
function resolveAlias(id) {
  if (id == null || id === '') return null;
  const key = String(id);
  if (Object.prototype.hasOwnProperty.call(ALIASES, key)) {
    return ALIASES[key];
  }
  return key;
}

function allManifestIds() {
  return manifestItems.map((entry) => String(entry.id)).filter(Boolean);
}

function readPaletteIdsRaw() {
  try {
    const json = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.map((v) => String(v)).filter(Boolean));
  } catch (err) {
    console.error('Seznam id v paletě se nepodařilo načíst.', err);
    return null;
  }
}

function readLegacyHiddenIds() {
  try {
    const json = localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.map((v) => String(v)).filter(Boolean));
  } catch (err) {
    console.error('Legacy seznam skrytých položek se nepodařilo načíst.', err);
    return null;
  }
}

function writePaletteIds() {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(Array.from(paletteIds)));
  } catch (err) {
    console.error('Seznam id v paletě se nepodařilo uložit.', err);
  }
}

/** Inicializace palety po načtení manifestu (§9): paleta → migrace skryté → default všechna id. */
function initPaletteFromStorage() {
  const existing = readPaletteIdsRaw();
  if (existing) {
    paletteIds = existing;
    return;
  }

  const legacyHidden = readLegacyHiddenIds();
  const manifestIdList = allManifestIds();
  if (legacyHidden) {
    paletteIds = new Set(manifestIdList.filter((id) => !legacyHidden.has(id)));
    writePaletteIds();
    try {
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
    return;
  }

  // Default: všechna id z manifestu, ať paleta není prázdná.
  paletteIds = new Set(manifestIdList);
  writePaletteIds();
}

function syncCachedVisibleFlags() {
  itemCache.forEach((item) => {
    if (item) item.visible = paletteIds.has(item.id);
  });
}

function clearLegacyFactoryStorage() {
  try {
    localStorage.removeItem(CATALOG_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

/** topFeature — type + volitelné absolutní mm (fritéza, později gril…). */
function normalizeTopFeature(raw) {
  if (!raw || typeof raw !== 'object' || !raw.type) return { type: 'none' };
  const tf = { type: String(raw.type) };
  for (const key of [
    'vatWidthMM', 'vatDepthMM', 'basketWidthMM', 'basketDepthMM',
    'cookAreaWidthMM', 'cookAreaDepthMM',
    'glassWidthMM', 'glassDepthMM', 'zoneDiameterMM', 'zoneInnerDiameterMM',
  ]) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n > 0) tf[key] = Math.round(n);
  }
  return tf;
}

/** Normalizace položky z katalog/polozky/*.json do tvaru očekávaného appkou. */
function normalizeFactoryItem(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const id = String(raw.id);
  const minDepthMM = clampNum(raw.minDepthMM, DEPTH_FLOOR, DEPTH_CEIL, DEPTH_DEFAULT);
  const lang = getLang();
  const publicCode = normalizeOptionalText(raw.publicCode);
  const descriptionText = raw.description && typeof raw.description === 'object'
    ? localizeField(raw.description, lang)
    : normalizeOptionalText(raw.descriptionText);
  const constructionText = raw.construction && typeof raw.construction === 'object'
    ? localizeField(raw.construction, lang)
    : normalizeOptionalText(raw.constructionText);

  return {
    ...raw,
    id,
    builtin: true,
    visible: paletteIds.has(id),
    name: raw.name && typeof raw.name === 'object' ? raw.name : (typeof raw.name === 'string' ? raw.name : {}),
    catalogCode: publicCode || normalizeOptionalText(raw.catalogCode),
    publicCode,
    descriptionText,
    constructionText,
    topFeature: normalizeTopFeature(raw.topFeature),
    controls: {
      type: raw.controls && CONTROL_TYPES.includes(raw.controls.type) ? raw.controls.type : 'knob',
      count: raw.controls ? Math.min(Math.max(Math.round(Number(raw.controls.count)) || 0, 0), 8) : 0,
    },
    widthMM: Number(raw.widthMM) > 0 ? Math.round(Number(raw.widthMM)) : 400,
    minWidthMM: Number(raw.minWidthMM) > 0 ? Math.round(Number(raw.minWidthMM)) : 200,
    minDepthMM,
    depthMM: clampNum(raw.depthMM, DEPTH_FLOOR, DEPTH_CEIL, minDepthMM),
    widthAdjustable: !!raw.widthAdjustable,
    topFixed: !!raw.topFixed,
    allowedBodyStyles: normalizeAllowedBodyStyles(raw.allowedBodyStyles),
    powerKW: normalizeOptionalNumber(raw.powerKW),
    voltage: normalizeOptionalText(raw.voltage),
    gasKW: normalizeOptionalNumber(raw.gasKW),
    zones: normalizeZones(raw.zones),
  };
}

/** Snapshot / importovaná položka — zachovej data, doplň kompatibilní pole. */
function normalizeSnapshotItem(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const id = String(raw.id);
  const publicCode = normalizeOptionalText(raw.publicCode) || normalizeOptionalText(raw.catalogCode);
  const minDepthMM = clampNum(raw.minDepthMM, DEPTH_FLOOR, DEPTH_CEIL, DEPTH_DEFAULT);
  return {
    ...raw,
    id,
    builtin: !!raw.builtin,
    visible: raw.visible !== false && paletteIds.has(id),
    catalogCode: publicCode,
    publicCode: publicCode || normalizeOptionalText(raw.publicCode),
    descriptionText: normalizeOptionalText(raw.descriptionText)
      || (raw.description && typeof raw.description === 'object'
        ? localizeField(raw.description, getLang())
        : ''),
    constructionText: normalizeOptionalText(raw.constructionText)
      || (raw.construction && typeof raw.construction === 'object'
        ? localizeField(raw.construction, getLang())
        : ''),
    topFeature: normalizeTopFeature(raw.topFeature),
    controls: {
      type: raw.controls && CONTROL_TYPES.includes(raw.controls.type) ? raw.controls.type : 'knob',
      count: raw.controls ? Math.min(Math.max(Math.round(Number(raw.controls.count)) || 0, 0), 8) : 0,
    },
    widthMM: Number(raw.widthMM) > 0 ? Math.round(Number(raw.widthMM)) : 400,
    minWidthMM: Number(raw.minWidthMM) > 0 ? Math.round(Number(raw.minWidthMM)) : 200,
    minDepthMM,
    depthMM: clampNum(raw.depthMM, DEPTH_FLOOR, DEPTH_CEIL, minDepthMM),
    widthAdjustable: !!raw.widthAdjustable,
    topFixed: !!raw.topFixed,
    allowedBodyStyles: normalizeAllowedBodyStyles(raw.allowedBodyStyles),
    powerKW: normalizeOptionalNumber(raw.powerKW),
    voltage: normalizeOptionalText(raw.voltage),
    gasKW: normalizeOptionalNumber(raw.gasKW),
    zones: normalizeZones(raw.zones),
  };
}

function lookupSyncResolved(canonicalId, originalId) {
  if (!canonicalId) return null;
  if (itemCache.has(canonicalId)) {
    const item = itemCache.get(canonicalId);
    return { ...item, visible: paletteIds.has(item.id) };
  }
  if (projectSnapshot.has(canonicalId)) {
    return projectSnapshot.get(canonicalId);
  }
  if (originalId && originalId !== canonicalId && projectSnapshot.has(originalId)) {
    return projectSnapshot.get(originalId);
  }
  return null;
}

// --- povinné API (§14.1) --------------------------------------------------------

export function getFactoryVersion() {
  return factoryVersion;
}

export async function loadManifest() {
  clearLegacyFactoryStorage();
  itemCache.clear();
  manifestItems = [];
  factoryVersion = 0;
  categories = null;
  paletteIds = new Set();

  let res;
  try {
    res = await fetch('katalog/manifest.json');
  } catch (err) {
    console.error('Nepodařilo se načíst katalog/manifest.json', err);
    throw err;
  }
  if (!res.ok) {
    const msg = `katalog/manifest.json: HTTP ${res.status}`;
    console.error(msg);
    throw new Error(msg);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error('katalog/manifest.json: neplatný JSON', err);
    throw err;
  }

  factoryVersion = Number(data.factoryVersion) || 0;
  manifestItems = Array.isArray(data.items) ? data.items.slice() : [];
  initPaletteFromStorage();

  try {
    const catRes = await fetch('katalog/kategorie.json');
    if (catRes.ok) {
      categories = await catRes.json();
    }
  } catch (err) {
    console.warn('katalog/kategorie.json se nepodařilo načíst (volitelné).', err);
  }

  // Teď jen 3 položky — sync getById/getCatalog hned po bootu.
  await Promise.all(manifestItems.map((entry) => getItem(entry.id)));

  return data;
}

export function getManifestItems() {
  return manifestItems.slice();
}

/** Volitelně načtené kategorie (po loadManifest); jinak null. */
export function getCategories() {
  return categories;
}

export async function getItem(id) {
  const originalId = id == null ? '' : String(id);
  const canonical = resolveAlias(originalId);
  if (canonical === null) return null;

  const cached = lookupSyncResolved(canonical, originalId);
  if (cached && itemCache.has(cached.id)) return cached;

  if (projectSnapshot.has(canonical)) return projectSnapshot.get(canonical);
  if (originalId && projectSnapshot.has(originalId)) return projectSnapshot.get(originalId);

  try {
    const res = await fetch(`katalog/polozky/${encodeURIComponent(canonical)}.json`);
    if (!res.ok) {
      console.error(`katalog/polozky/${canonical}.json: HTTP ${res.status}`);
      return null;
    }
    const raw = await res.json();
    const item = normalizeFactoryItem(raw);
    if (!item) return null;
    itemCache.set(item.id, item);
    return { ...item, visible: paletteIds.has(item.id) };
  } catch (err) {
    console.error(`Nepodařilo se načíst katalog/polozky/${canonical}.json`, err);
    return null;
  }
}

export function getItemSync(id) {
  const originalId = id == null ? '' : String(id);
  const canonical = resolveAlias(originalId);
  if (canonical === null) return null;
  return lookupSyncResolved(canonical, originalId);
}

export function resolveName(item, lang) {
  if (!item) return '';
  if (item.name && typeof item.name === 'object' && !Array.isArray(item.name)) {
    return localizeField(item.name, lang);
  }
  return typeof item.name === 'string' ? item.name : '';
}

export function getPaletteIds() {
  return Array.from(paletteIds);
}

export function isInPalette(id) {
  if (id == null || id === '') return false;
  const key = String(id);
  if (paletteIds.has(key)) return true;
  const canonical = resolveAlias(key);
  return !!canonical && paletteIds.has(canonical);
}

export function addToPalette(id) {
  if (id == null || id === '') return;
  const key = String(id);
  const canonical = resolveAlias(key);
  const storeId = canonical || key;
  if (!storeId) return;
  paletteIds.add(storeId);
  writePaletteIds();
  syncCachedVisibleFlags();
}

export function removeFromPalette(id) {
  if (id == null || id === '') return;
  const key = String(id);
  paletteIds.delete(key);
  const canonical = resolveAlias(key);
  if (canonical) paletteIds.delete(canonical);
  writePaletteIds();
  syncCachedVisibleFlags();
}

/** @deprecated Prefer getPaletteIds(); vrací id z manifestu, která NEJSOU v paletě. */
export function getHiddenIds() {
  return allManifestIds().filter((id) => !paletteIds.has(id));
}

/** @deprecated Prefer addToPalette / removeFromPalette — inverzní mapování na paletu. */
export function setItemHidden(id, hidden) {
  console.warn('catalog.setItemHidden: deprecated — mapuje na remove/addFromPalette');
  if (hidden) removeFromPalette(id);
  else addToPalette(id);
}

export async function buildSnapshot(usedIds) {
  const ids = Array.isArray(usedIds) ? usedIds : [];
  const out = [];
  const seen = new Set();
  for (const rawId of ids) {
    const item = await getItem(rawId);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(JSON.parse(JSON.stringify(item)));
  }
  return out;
}

export function lookupForRender(id, snapshot) {
  const originalId = id == null ? '' : String(id);
  const canonical = resolveAlias(originalId);

  if (Array.isArray(snapshot)) {
    const byOriginal = snapshot.find((e) => e && e.id === originalId);
    if (byOriginal) return byOriginal;
    if (canonical && canonical !== originalId) {
      const byCanonical = snapshot.find((e) => e && e.id === canonical);
      if (byCanonical) return byCanonical;
    }
  }

  if (canonical === null) return null;
  return lookupSyncResolved(canonical, originalId);
}

// --- kompatibilní most ----------------------------------------------------------

export function getById(id) {
  return getItemSync(id);
}

export function getCatalog() {
  return manifestItems
    .map((entry) => {
      const item = itemCache.get(entry.id);
      if (!item) return null;
      return { ...item, visible: paletteIds.has(item.id) };
    })
    .filter(Boolean);
}

/** Položky v osobní paletě (pro levý panel). Ne „ne-skryté". */
export function getVisible() {
  return getCatalog().filter((entry) => paletteIds.has(entry.id));
}

export function getEntryDisplayName(entry) {
  if (!entry) return '';
  if (entry.name && typeof entry.name === 'object' && !Array.isArray(entry.name)) {
    return resolveName(entry, getLang());
  }
  return typeof entry.name === 'string' ? entry.name : '';
}

export function getEntryDescription(entry) {
  if (!entry) return '';
  if (entry.description && typeof entry.description === 'object' && !Array.isArray(entry.description)) {
    return localizeField(entry.description, getLang());
  }
  return entry.descriptionText || '';
}

export function getEntryConstruction(entry) {
  if (!entry) return '';
  if (entry.construction && typeof entry.construction === 'object' && !Array.isArray(entry.construction)) {
    return localizeField(entry.construction, getLang());
  }
  return entry.constructionText || '';
}

/**
 * Uloží položky z načteného projektu do paměťové vrstvy projectSnapshot.
 * NESLUČUJE do továrny, nic do localStorage katalogu.
 */
export function importCatalog(rawArray) {
  if (!Array.isArray(rawArray)) return;
  projectSnapshot.clear();
  rawArray.forEach((raw) => {
    const item = normalizeSnapshotItem(raw);
    if (!item) return;
    projectSnapshot.set(item.id, item);
  });
}

export function upsert(_rawEntry) {
  console.warn('catalog.upsert: továrna je jen pro čtení (etapa B) — no-op');
  return null;
}

export function remove(_id) {
  console.warn('catalog.remove: továrna je jen pro čtení (etapa B) — no-op');
  return false;
}

export function duplicate(_id) {
  console.warn('catalog.duplicate: továrna je jen pro čtení (etapa B) — no-op');
  return null;
}

export function resetBuiltin(_id) {
  console.warn('catalog.resetBuiltin: továrna je jen pro čtení (etapa B) — no-op');
  return null;
}

export function setVisible(id, visible) {
  setItemHidden(id, !visible);
}
