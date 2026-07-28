// catalog.js — datový model katalogu přístrojů (SPEC v3 §3.1–3.3).
// Katalog = vestavěné přístroje (nemazatelné, ale skrytelné) + uživatelské
// přístroje uložené v localStorage. Samotný dialog "Správce přístrojů" (§3.4)
// je předmětem druhé etapy — zde je jen datový model + helpery, na které
// bude moci navázat.
//
// Datový model přístroje (viz SPEC §3.1):
// { id, name, builtin, visible, widthMM, minWidthMM, widthAdjustable,
//   topFeature:{type}, controls:{type,count}, imageDataURL, bodyStyle }
// topFeature.type: burners4 | ceramic4 | fryer2 | grill | bainmarie |
//                  multipan | sink | induction | none | bitmap

export const CATALOG_STORAGE_KEY = 'alba-katalog-v1';

const CONTROL_TYPES = ['knob', 'button', 'switch'];
const BODY_STYLES = ['closed', 'doors', 'open'];

// --- vestavěný základ katalogu (SPEC §3.2 + nové přístroje §3.3) ------------
const BUILTIN_DEFAULTS = [
  {
    id: 'gas_stove', name: 'Sporák plynový', builtin: true, visible: true,
    widthMM: 800, minWidthMM: 800, widthAdjustable: false,
    topFeature: { type: 'burners4' }, controls: { type: 'knob', count: 4 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    id: 'electric_stove', name: 'Sklokeramika', builtin: true, visible: true,
    widthMM: 800, minWidthMM: 800, widthAdjustable: false,
    topFeature: { type: 'ceramic4' }, controls: { type: 'knob', count: 4 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    id: 'fryer', name: 'Fritéza', builtin: true, visible: true,
    widthMM: 400, minWidthMM: 400, widthAdjustable: false,
    topFeature: { type: 'fryer2' }, controls: { type: 'knob', count: 2 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    id: 'grill', name: 'Gril / grilovací deska', builtin: true, visible: true,
    widthMM: 800, minWidthMM: 800, widthAdjustable: false,
    topFeature: { type: 'grill' }, controls: { type: 'knob', count: 2 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    id: 'bain_marie', name: 'Vodní lázeň', builtin: true, visible: true,
    widthMM: 400, minWidthMM: 400, widthAdjustable: false,
    topFeature: { type: 'bainmarie' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    id: 'multi_pan', name: 'Multifunkční pánev', builtin: true, visible: true,
    widthMM: 800, minWidthMM: 800, widthAdjustable: false,
    topFeature: { type: 'multipan' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    // Dřez s volitelnými rozměry vany — šířka podestavby nastavitelná,
    // rozměry vany (vatWidthMM/vatDepthMM) jsou pole INSTANCE segmentu.
    id: 'sink', name: 'Dřez', builtin: true, visible: true,
    widthMM: 800, minWidthMM: 400, widthAdjustable: true,
    topFeature: { type: 'sink' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, bodyStyle: 'closed',
  },
  {
    // Indukce — jedna varná zóna 400×400 mm, šířka podestavby 500–1200 mm.
    id: 'induction', name: 'Indukce', builtin: true, visible: true,
    widthMM: 500, minWidthMM: 500, widthAdjustable: true,
    topFeature: { type: 'induction' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, bodyStyle: 'closed',
  },
];

function cloneEntry(entry) {
  return JSON.parse(JSON.stringify(entry));
}

function normalizeEntry(raw, fallbackBuiltin) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Přístroj',
    builtin: !!(raw.builtin ?? fallbackBuiltin),
    visible: raw.visible !== false,
    widthMM: Number(raw.widthMM) > 0 ? Math.round(Number(raw.widthMM)) : 400,
    minWidthMM: Number(raw.minWidthMM) > 0 ? Math.round(Number(raw.minWidthMM)) : 200,
    widthAdjustable: !!raw.widthAdjustable,
    topFeature: raw.topFeature && typeof raw.topFeature === 'object' && raw.topFeature.type
      ? { type: String(raw.topFeature.type) }
      : { type: 'none' },
    controls: {
      type: raw.controls && CONTROL_TYPES.includes(raw.controls.type) ? raw.controls.type : 'knob',
      count: raw.controls ? Math.min(Math.max(Math.round(Number(raw.controls.count)) || 0, 0), 8) : 0,
    },
    imageDataURL: typeof raw.imageDataURL === 'string' ? raw.imageDataURL : null,
    bodyStyle: BODY_STYLES.includes(raw.bodyStyle) ? raw.bodyStyle : 'closed',
  };
}

/** Sloučí uložená data s vestavěným základem — builtin nelze smazat ani upravit
 *  (kromě viditelnosti); vlastní přístroje se přebírají tak, jak jsou uložené. */
function mergeWithBuiltins(stored) {
  const byId = new Map();
  BUILTIN_DEFAULTS.forEach((def) => byId.set(def.id, cloneEntry(def)));
  (Array.isArray(stored) ? stored : []).forEach((raw) => {
    const entry = normalizeEntry(raw, false);
    if (!entry) return;
    if (byId.has(entry.id)) {
      byId.get(entry.id).visible = entry.visible; // builtin — jen viditelnost je proměnlivá
    } else {
      byId.set(entry.id, { ...entry, builtin: false });
    }
  });
  return Array.from(byId.values());
}

let catalog = null; // in-memory cache, naplní se při prvním přístupu

function persist() {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch (err) {
    console.error('Katalog přístrojů se nepodařilo uložit.', err);
  }
}

function ensureLoaded() {
  if (catalog) return;
  let stored = null;
  try {
    const json = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (json) stored = JSON.parse(json);
  } catch (err) {
    console.error('Uložený katalog přístrojů se nepodařilo načíst, používám výchozí.', err);
  }
  catalog = mergeWithBuiltins(stored);
}

/** Vrátí celý katalog (vestavěné + vlastní). */
export function getCatalog() {
  ensureLoaded();
  return catalog;
}

/** Přístroje nabízené v „Přidat segment" (visible=true). */
export function getVisible() {
  return getCatalog().filter((entry) => entry.visible);
}

/** Najde přístroj podle id. */
export function getById(id) {
  return getCatalog().find((entry) => entry.id === id);
}

/** Vytvoří nový nebo aktualizuje existující (vlastní) přístroj; builtin lze
 *  jen přepnout viditelnost. Vrací uloženou položku. */
export function upsert(rawEntry) {
  ensureLoaded();
  const existing = rawEntry && rawEntry.id ? getById(rawEntry.id) : null;
  const normalized = normalizeEntry(rawEntry, existing ? existing.builtin : false);
  if (!normalized) return null;
  if (!normalized.id) {
    normalized.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  const idx = catalog.findIndex((entry) => entry.id === normalized.id);
  if (idx >= 0) {
    if (catalog[idx].builtin) {
      catalog[idx].visible = normalized.visible; // builtin — nepřepisovat pevné vlastnosti
    } else {
      catalog[idx] = normalized;
    }
  } else {
    catalog.push(normalized);
  }
  persist();
  return getById(normalized.id);
}

/** Nastaví viditelnost přístroje (funguje i pro builtin — skrytí, ne smazání). */
export function setVisible(id, visible) {
  const entry = getById(id);
  if (!entry) return;
  entry.visible = !!visible;
  persist();
}

/** Smaže vlastní přístroj. Vestavěné nelze smazat (vrátí false). */
export function remove(id) {
  ensureLoaded();
  const entry = getById(id);
  if (!entry || entry.builtin) return false;
  catalog = catalog.filter((e) => e.id !== id);
  persist();
  return true;
}

/** Vytvoří kopii přístroje (i vestavěného) jako nový vlastní přístroj. */
export function duplicate(id) {
  ensureLoaded();
  const src = getById(id);
  if (!src) return null;
  const copy = cloneEntry(src);
  copy.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  copy.name = `${src.name} (kopie)`;
  copy.builtin = false;
  copy.visible = true;
  catalog.push(copy);
  persist();
  return copy;
}

/** Sloučí katalog z importované konfigurace (JSON export) — tolerantní,
 *  nikdy nezahodí builtin přístroje. Používá se při načtení uložené sestavy. */
export function importCatalog(rawArray) {
  if (!Array.isArray(rawArray)) return;
  ensureLoaded();
  const customOnly = catalog.filter((entry) => !entry.builtin);
  catalog = mergeWithBuiltins([...customOnly, ...rawArray]);
  persist();
}
