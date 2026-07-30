// catalog.js — datový model katalogu přístrojů (SPEC v3 §3.1–3.3, §7;
// SPEC v4 §10 — topFixed, allowedBodyStyles, katalogové technické údaje;
// §13 — vícejazyčné názvy vestavěných přístrojů).
// Katalog = vestavěné přístroje (nemazatelné, ale skrytelné A PLNĚ
// EDITOVATELNÉ — §7.2) + uživatelské přístroje uložené v localStorage.
//
// Datový model přístroje (viz SPEC §3.1 + §7.1 + v4 §10 + §13):
// { id, name, nameCustom, builtin, visible, widthMM, minWidthMM, depthMM,
//   minDepthMM, widthAdjustable, topFeature:{type}, controls:{type,count},
//   imageDataURL,
//   topFixed,             // §10.1 — prvek na desce v pevné (jmenovité) velikosti
//   allowedBodyStyles,    // §10.2 — podmnožina ['closed','doors','open']
//   powerKW, voltage, gasKW, descriptionText, descriptionCustom,
//   constructionText, constructionCustom, catalogCode }
// topFeature.type: burners4 | ceramic4 | fryer1 | fryer2 | grill | bainmarie |
//                  multipan | sink | induction | none | bitmap
//
// §13 — název vestavěného přístroje: pokud uživatel přístroj nepřejmenoval
// (nameCustom=false), název se bere z překladu podle `id` (viz i18n.js klíče
// `device.<id>`) a `name`/`nameCustom` se v uloženém katalogu nepoužívají pro
// zobrazení. Jakmile uživatel název ve Správci přístrojů změní, uloží se
// doslovně a nameCustom=true — takový přístroj (i vlastní/duplikovaný) se už
// nepřekládá. Viz getEntryDisplayName() níže.
//
// ZADANI-KATALOG.md — stejný mechanismus platí i pro popis funkcí a popis
// konstrukce (descriptionText/constructionText): dokud je nemá uživatel
// upravené (descriptionCustom/constructionCustom = false), berou se u
// vestavěného přístroje z překladu (klíče `device.<id>.description` /
// `device.<id>.construction`); jinak se zobrazují doslovně. Chybějící
// příznaky ve starších uložených katalozích se považují za neupravené
// (custom = false). Viz getEntryDescription() / getEntryConstruction() níže.
//
// Pozn.: dřívější katalogové pole `bodyStyle` (jediný pevný styl podestavby)
// bylo nahrazeno `allowedBodyStyles` — konkrétní styl instance segmentu se
// nyní volí v seznamu segmentů (viz modules.js getSegmentBodyStyle).

import { t } from './i18n.js';

export const CATALOG_STORAGE_KEY = 'alba-katalog-v1';

const CONTROL_TYPES = ['knob', 'button', 'switch'];
const BODY_STYLES = ['closed', 'doors', 'open'];
// v2 — přidány značkové drop-in přístroje (Lotus PCD-68G/FTLD-66ET/F10D-64ET,
// Berner BI1EG5) a ALBA Bain Marie EBM 1/1; migrateIfNeeded doplní chybějící
// tovární přístroje do starších uložených katalogů.
const CURRENT_SCHEMA_VERSION = 2;

// meze normalizace minimální/výchozí hloubky (§7.1)
const DEPTH_FLOOR = 400;
const DEPTH_CEIL = 1200;
const DEPTH_DEFAULT = 700;

// katalogové technické údaje (§10.3) — u vestavěných zůstávají PRÁZDNÉ,
// aplikace si žádné technické parametry nevymýšlí; vyplní si je uživatel.
const EMPTY_CATALOG_INFO = {
  powerKW: null, voltage: '', gasKW: null,
  descriptionText: '', constructionText: '', catalogCode: '',
  descriptionCustom: false, constructionCustom: false,
};

// --- vestavěný základ katalogu (SPEC §3.2 + nové přístroje §3.3) ------------
// Všechny vestavěné přístroje mají minDepthMM/depthMM 700 mm (§7.1) — jde
// o výchozí hodnotu; ve Správci přístrojů ji lze změnit (§7.2), tovární
// hodnoty jdou kdykoli obnovit přes resetBuiltin().
// topFixed (§10.1): sporák, sklokeramika, fritéza a indukce mají prvek na
// desce v pevné (jmenovité) velikosti; ostatní se roztahují s šířkou.
// allowedBodyStyles (§10.2): přístroje s vanami/hořáky → uzavřená/s dvířky;
// dřez navíc umožňuje i otevřenou podestavbu.
const BUILTIN_DEFAULTS = [
  {
    id: 'gas_stove', name: 'Sporák plynový', builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 800, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'burners4' }, controls: { type: 'knob', count: 4 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    id: 'electric_stove', name: 'Sklokeramika', builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 800, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'ceramic4' }, controls: { type: 'knob', count: 4 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    id: 'fryer', name: 'Fritéza', builtin: true, visible: true, nameCustom: false,
    widthMM: 400, minWidthMM: 400, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'fryer2' }, controls: { type: 'knob', count: 2 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    id: 'grill', name: 'Gril / grilovací deska', builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 800, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'grill' }, controls: { type: 'knob', count: 2 },
    imageDataURL: null, topFixed: false, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  // Obecná vodní lázeň — skrytá, protože neurčuje velikost vany (na rozdíl od alba_ebm_11 GN 1/1).
  // Uživatel si ji může zapnout ve správci přístrojů kdykoli.
  {
    id: 'bain_marie', name: 'Vodní lázeň', builtin: true, visible: false, nameCustom: false,
    widthMM: 400, minWidthMM: 400, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'bainmarie' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: false, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    id: 'multi_pan', name: 'Multifunkční pánev', builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 800, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'multipan' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: false, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    // Dřez s volitelnými rozměry vany — šířka podestavby nastavitelná,
    // rozměry vany (vatWidthMM/vatDepthMM) jsou pole INSTANCE segmentu.
    id: 'sink', name: 'Dřez', builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 400, depthMM: 700, minDepthMM: 700, widthAdjustable: true,
    topFeature: { type: 'sink' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: false, allowedBodyStyles: ['closed', 'doors', 'open'],
    ...EMPTY_CATALOG_INFO,
  },
  {
    // Indukce — jedna varná zóna 400×400 mm, šířka podestavby 500–1200 mm.
    id: 'induction', name: 'Indukce', builtin: true, visible: true, nameCustom: false,
    widthMM: 500, minWidthMM: 500, depthMM: 700, minDepthMM: 700, widthAdjustable: true,
    topFeature: { type: 'induction' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors'],
    ...EMPTY_CATALOG_INFO,
  },

  // --- značkové drop-in přístroje (katalog výrobců Lotus/RM Gastro, Berner,
  // ALBA) — topFixed: true (prvek na desce v pevné jmenovité velikosti). ---
  {
    // Lotus PCD-68G — plynová varná deska drop-in, 4 hořáky (3,5+5,5+5,5+7,5 kW).
    id: 'lotus_pcd_68g', name: 'Sporák plynový Lotus 22 kW',
    builtin: true, visible: true, nameCustom: false,
    widthMM: 800, minWidthMM: 800, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'burners4' }, controls: { type: 'knob', count: 4 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors', 'open'],
    powerKW: null, voltage: '', gasKW: 22,
    descriptionText: 'Plynová varná deska drop-in se 4 hořáky (3,5 / 5,5 / 5,5 / 7,5 kW), '
      + 'celkový plynový příkon 22 kW, rozměry 800 × 600 × 110 mm. Nezávislé ovládání '
      + 'jednotlivých hořáků, piezo zapalování.',
    constructionText: 'Nerez CrNi 18/10 AISI 304, deska tl. 2 mm, bezpečnostní ventily '
      + 's termočlánkem, hořáky s modulovaným plamenem, vyjímatelné odkapávací misky, '
      + 'přípojka plynu ISO 7-1 1/2" M.',
    catalogCode: 'PCD-68G',
    descriptionCustom: false, constructionCustom: false,
  },
  {
    // Lotus FTLD-66ET — elektrická grilovací deska drop-in, hladká, 2 zóny.
    id: 'lotus_ftld_66et', name: 'Grilovací deska Lotus 6 kW',
    builtin: true, visible: true, nameCustom: false,
    widthMM: 600, minWidthMM: 600, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'grill' }, controls: { type: 'knob', count: 2 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors', 'open'],
    powerKW: 6, voltage: '400 V/3N (i 230 V/3, 230 V), 50/60 Hz', gasKW: null,
    descriptionText: 'Elektrická grilovací deska drop-in s hladkou varnou plochou, '
      + 'rozměry 600 × 600 × 220 mm, varná plocha cca 555 × 550 mm, dvě samostatně '
      + 'ovládané zóny.',
    constructionText: 'Nerez jemně saténovaná, chromované detaily.',
    catalogCode: 'FTLD-66ET',
    descriptionCustom: false, constructionCustom: false,
  },
  {
    // Lotus F10D-64ET — elektrická fritéza drop-in, 10 l. Vyžaduje dvířka.
    id: 'lotus_f10d_64et', name: 'Fritéza Lotus 10 l',
    builtin: true, visible: true, nameCustom: false,
    widthMM: 400, minWidthMM: 400, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'fryer1' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['doors'],
    powerKW: 7.15, voltage: '400 V~3N / 230 V~3, 50/60 Hz', gasKW: null,
    descriptionText: 'Elektrická fritéza drop-in o objemu 10 l, rozměry 400 × 600 × 390 mm, '
      + 'vana 220 × 350 × 230 mm, koš 200 × 300 × 100 mm, výkon 10 kg/h.',
    constructionText: 'Nerez AISI 304, dvojitý termostat (provozní a bezpečnostní), '
      + 'filtr vany, sklopné topné těleso pro snadné čištění.',
    catalogCode: 'F10D-64ET',
    descriptionCustom: false, constructionCustom: false,
  },
  {
    // Berner BI1EG5 — vestavná indukční varná deska, 1 zóna, výřez cca 400×400 mm.
    id: 'berner_bi1eg5', name: 'Indukce Berner 5 kW',
    builtin: true, visible: true, nameCustom: false,
    widthMM: 500, minWidthMM: 500, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'induction' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors', 'open'],
    powerKW: 5, voltage: '400 V třífázově, 50/60 Hz, jištění 3×16 A', gasKW: null,
    descriptionText: 'Vestavná indukční varná deska s jednou čtvercovou zónou, '
      + 'rozměry/výřez cca 400 × 400 mm, indukční cívka cca 270 × 270 mm, '
      + 'min. průměr nádoby 12 cm.',
    constructionText: 'Sklo Schott Ceran tl. 6 mm, krytí IP11, jištění 3×16 A.',
    catalogCode: 'BI1EG5',
    descriptionCustom: false, constructionCustom: false,
  },
  {
    // ALBA Bain Marie EBM 1/1 — vodní lázeň pro GN 1/1.
    id: 'alba_ebm_11', name: 'Vodní lázeň ALBA GN 1/1',
    builtin: true, visible: true, nameCustom: false,
    widthMM: 400, minWidthMM: 400, depthMM: 700, minDepthMM: 700, widthAdjustable: false,
    topFeature: { type: 'bainmarie' }, controls: { type: 'knob', count: 1 },
    imageDataURL: null, topFixed: true, allowedBodyStyles: ['closed', 'doors', 'open'],
    powerKW: 1.2, voltage: '', gasKW: null,
    descriptionText: 'Elektrická vodní lázeň pro gastronádoby GN 1/1, rozměry vany '
      + '305 × 510 × 200 mm.',
    constructionText: 'Nerezové provedení, zapuštěná vana.',
    catalogCode: 'EBM 1/1',
    descriptionCustom: false, constructionCustom: false,
  },
];

// §13 — dřívější tovární názvy značkových přístrojů (před přejmenováním na
// tvar „<typ> <značka> <parametr>"). Uživatel může mít tyto řetězce uložené
// v localStorage z doby, kdy ještě byly tovární — normalizeEntry je proto
// nesmí vyhodnotit jako ruční přejmenování (nameCustom), jinak by se po
// aktualizaci nového názvu nikdy nedočkal.
const LEGACY_BUILTIN_NAMES = {
  lotus_pcd_68g: ['Lotus PCD-68G — plynová varná deska, 4 hořáky'],
  lotus_ftld_66et: ['Lotus FTLD-66ET — elektrická grilovací deska'],
  lotus_f10d_64et: ['Lotus F10D-64ET — elektrická fritéza, 10 l'],
  berner_bi1eg5: ['Berner BI1EG5 — indukční varná deska, 1 zóna'],
  alba_ebm_11: ['ALBA Bain Marie EBM 1/1 — vodní lázeň, GN 1/1'],
};

function cloneEntry(entry) {
  return JSON.parse(JSON.stringify(entry));
}

/** Migruje katalog ze staršího schématu na aktuální verzi. Zajistí, aby
 *  u vestavěných přístrojů chybějící pole topFixed a allowedBodyStyles
 *  byly doplněny z BUILTIN_DEFAULTS; u vlastních přístrojů odvozuje
 *  allowedBodyStyles ze starého bodyStyle. Schema v2: doplní i tovární
 *  přístroje přidané po uložení katalogu (lotus_pcd_68g, lotus_ftld_66et,
 *  lotus_f10d_64et, berner_bi1eg5, alba_ebm_11), pokud v uloženém katalogu
 *  ještě chybí. */
function migrateIfNeeded(entries, schemaVersion) {
  if (schemaVersion >= CURRENT_SCHEMA_VERSION) {
    return entries;
  }

  const builtinIds = new Set(BUILTIN_DEFAULTS.map((d) => d.id));

  const migrated = entries.map((entry) => {
    if (!entry || !entry.id) return entry;

    const isBuiltin = builtinIds.has(entry.id);
    const migratedEntry = { ...entry };

    if (isBuiltin) {
      // U vestavěných přístrojů: vezmi chybějící pole z BUILTIN_DEFAULTS
      const builtinDefault = BUILTIN_DEFAULTS.find((d) => d.id === entry.id);
      if (builtinDefault) {
        // Pokud chybí topFixed, vezmi z defaults
        if (migratedEntry.topFixed === undefined) {
          migratedEntry.topFixed = builtinDefault.topFixed;
        }
        // Pokud chybí allowedBodyStyles, vezmi z defaults
        if (!Array.isArray(migratedEntry.allowedBodyStyles)) {
          migratedEntry.allowedBodyStyles = [...builtinDefault.allowedBodyStyles];
        }
      }
    } else {
      // U vlastních přístrojů: odvoď allowedBodyStyles ze starého bodyStyle pokud chybí
      if (!Array.isArray(migratedEntry.allowedBodyStyles)) {
        if (migratedEntry.bodyStyle && BODY_STYLES.includes(migratedEntry.bodyStyle)) {
          migratedEntry.allowedBodyStyles = [migratedEntry.bodyStyle];
        } else {
          migratedEntry.allowedBodyStyles = ['closed', 'doors', 'open'];
        }
      }
      // Pokud chybí topFixed, použij false (vlastní přístroje se roztahují s šířkou)
      if (migratedEntry.topFixed === undefined) {
        migratedEntry.topFixed = false;
      }
    }

    // Zajisti, aby allowedBodyStyles bylo validní a neprázdné
    migratedEntry.allowedBodyStyles = normalizeAllowedBodyStyles(
      migratedEntry.allowedBodyStyles,
      migratedEntry.bodyStyle
    );

    return migratedEntry;
  });

  // Doplň tovární přístroje, které v uloženém katalogu ještě nejsou
  // (přidané do BUILTIN_DEFAULTS po uložení katalogu uživatelem).
  const presentIds = new Set(
    migrated.filter((entry) => entry && entry.id).map((entry) => String(entry.id))
  );
  const missingBuiltins = BUILTIN_DEFAULTS
    .filter((def) => !presentIds.has(def.id))
    .map((def) => cloneEntry(def));

  return [...migrated, ...missingBuiltins];
}

function clampNum(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Volitelný kladný číselný katalogový údaj (§10.3) — prázdné/neplatné → null,
 *  nikdy si nic nedomýšlí (u vestavěných zůstává prázdné). */
function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

function normalizeOptionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Povolené styly podestavby (§10.2 SPEC v4) — podmnožina ['closed','doors',
 *  'open'], vždy alespoň jeden. Tolerantní ke starším katalogům, které měly
 *  jen jediné pole `bodyStyle` (fallbackSingle) místo pole allowedBodyStyles. */
function normalizeAllowedBodyStyles(rawAllowed, fallbackSingle) {
  const arr = Array.isArray(rawAllowed) ? rawAllowed.filter((v) => BODY_STYLES.includes(v)) : [];
  const unique = Array.from(new Set(arr));
  if (unique.length) return unique;
  if (BODY_STYLES.includes(fallbackSingle)) return [fallbackSingle];
  return ['closed', 'doors', 'open'];
}

function normalizeEntry(raw, fallbackBuiltin) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const minDepthMM = clampNum(raw.minDepthMM, DEPTH_FLOOR, DEPTH_CEIL, DEPTH_DEFAULT);
  const builtin = !!(raw.builtin ?? fallbackBuiltin);
  const builtinDef = builtin ? BUILTIN_DEFAULTS.find((d) => d.id === String(raw.id)) : null;
  const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
  // §13 — nameCustom rozlišuje přejmenovaný vestavěný přístroj (zobrazuje se
  // doslovně) od nepřejmenovaného (název se bere z překladu podle id).
  // Tolerantní ke starším uloženým datům bez pole nameCustom: pokud uložený
  // název odpovídá tovární (dřívější jednojazyčné) hodnotě nebo je prázdný,
  // bere se jako nepřejmenovaný.
  let nameCustom;
  if (raw.nameCustom !== undefined) {
    nameCustom = !!raw.nameCustom;
  } else if (builtinDef) {
    // starší tovární název (viz LEGACY_BUILTIN_NAMES) se také počítá jako
    // nepřejmenovaný, jinak by se po přejmenování továrního vzoru přejmenování
    // u stávajících uživatelů vůbec neprojevilo
    const legacyNames = LEGACY_BUILTIN_NAMES[builtinDef.id] || [];
    const isLegacyName = legacyNames.includes(rawName);
    nameCustom = !!(rawName && rawName !== builtinDef.name && !isLegacyName);
  } else {
    nameCustom = true; // vlastní přístroje se vždy zobrazují doslovně
  }
  const name = nameCustom ? (rawName || t('catalog.deviceFallbackName')) : '';
  // ZADANI-KATALOG.md — descriptionCustom/constructionCustom rozlišují popis
  // upravený uživatelem (zobrazuje se doslovně) od nepřejmenovaného vestavěného
  // (bere se z překladu). Na rozdíl od nameCustom tu není potřeba heuristika
  // pro starší data bez příznaku — ta se prostě považují za neupravená.
  const descriptionCustom = !!raw.descriptionCustom;
  const constructionCustom = !!raw.constructionCustom;
  return {
    id: String(raw.id),
    name,
    nameCustom,
    builtin,
    visible: raw.visible !== false,
    widthMM: Number(raw.widthMM) > 0 ? Math.round(Number(raw.widthMM)) : 400,
    minWidthMM: Number(raw.minWidthMM) > 0 ? Math.round(Number(raw.minWidthMM)) : 200,
    // hloubka podestavby (§7.1) — minDepthMM je minimum, depthMM výchozí
    // hodnota instance; obojí normalizováno do rozsahu 400–1200 mm.
    minDepthMM,
    depthMM: clampNum(raw.depthMM, DEPTH_FLOOR, DEPTH_CEIL, minDepthMM),
    widthAdjustable: !!raw.widthAdjustable,
    topFeature: raw.topFeature && typeof raw.topFeature === 'object' && raw.topFeature.type
      ? { type: String(raw.topFeature.type) }
      : { type: 'none' },
    controls: {
      type: raw.controls && CONTROL_TYPES.includes(raw.controls.type) ? raw.controls.type : 'knob',
      count: raw.controls ? Math.min(Math.max(Math.round(Number(raw.controls.count)) || 0, 0), 8) : 0,
    },
    imageDataURL: typeof raw.imageDataURL === 'string' ? raw.imageDataURL : null,
    // §10.1 — prvek na desce v pevné (jmenovité) velikosti bez ohledu na šířku
    topFixed: !!raw.topFixed,
    // §10.2 — povolené typy podestavby (nahrazuje dřívější jediné `bodyStyle`)
    allowedBodyStyles: normalizeAllowedBodyStyles(raw.allowedBodyStyles, raw.bodyStyle),
    // §10.3 — volitelné technické údaje, u vestavěných prázdné
    powerKW: normalizeOptionalNumber(raw.powerKW),
    voltage: normalizeOptionalText(raw.voltage),
    gasKW: normalizeOptionalNumber(raw.gasKW),
    descriptionText: normalizeOptionalText(raw.descriptionText),
    descriptionCustom,
    constructionText: normalizeOptionalText(raw.constructionText),
    constructionCustom,
    catalogCode: normalizeOptionalText(raw.catalogCode),
  };
}

/** Sloučí uložená data s vestavěným základem. Vestavěné (id z BUILTIN_DEFAULTS)
 *  lze nyní PLNĚ upravovat (§7.2) — jen builtin:true a id se nepřepisují a
 *  nejde je smazat. Vlastní přístroje se přebírají tak, jak jsou uložené. */
function mergeWithBuiltins(stored) {
  const byId = new Map();
  BUILTIN_DEFAULTS.forEach((def) => byId.set(def.id, cloneEntry(def)));
  (Array.isArray(stored) ? stored : []).forEach((raw) => {
    if (!raw || !raw.id) return;
    const isBuiltinId = byId.has(String(raw.id)) && BUILTIN_DEFAULTS.some((d) => d.id === String(raw.id));
    const entry = normalizeEntry(raw, isBuiltinId);
    if (!entry) return;
    if (isBuiltinId) {
      byId.set(entry.id, { ...entry, builtin: true }); // upravené vlastnosti se přebírají, id/builtin zůstávají pevné
    } else {
      byId.set(entry.id, { ...entry, builtin: false });
    }
  });
  return Array.from(byId.values());
}

let catalog = null; // in-memory cache, naplní se při prvním přístupu

function persist() {
  try {
    const data = {
      schema: CURRENT_SCHEMA_VERSION,
      entries: catalog,
    };
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Katalog přístrojů se nepodařilo uložit.', err);
  }
}

function ensureLoaded() {
  if (catalog) return;
  let stored = null;
  let schemaVersion = 0;
  let needsMigration = false;
  try {
    const json = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      // Kompatibilita se starými katalogy: mohou být holé pole nebo { schema, entries }
      if (Array.isArray(parsed)) {
        stored = parsed;
        schemaVersion = 0; // Stará verze bez schématického formátu
        needsMigration = true;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
        stored = parsed.entries;
        schemaVersion = parsed.schema || 0;
        needsMigration = schemaVersion < CURRENT_SCHEMA_VERSION;
      }
    }
  } catch (err) {
    console.error('Uložený katalog přístrojů se nepodařilo načíst, používám výchozí.', err);
  }

  // Migruj pokud je potřeba
  if (stored && needsMigration) {
    stored = migrateIfNeeded(stored, schemaVersion);
  }

  catalog = mergeWithBuiltins(stored);

  // Pokud se katalog migroval, ulož ho zpět v novém tvaru
  if (needsMigration) {
    persist();
  }
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

/** §13 — zobrazovaný název přístroje: u nepřejmenovaného vestavěného přístroje
 *  se bere z aktuálního jazykového překladu podle jeho `id`; přejmenovaný
 *  i vlastní přístroj se zobrazuje doslovně, tak jak ho zadal uživatel. */
export function getEntryDisplayName(entry) {
  if (!entry) return '';
  if (entry.builtin && !entry.nameCustom) {
    return t(`device.${entry.id}`);
  }
  return entry.name || t('catalog.deviceFallbackName');
}

/** ZADANI-KATALOG.md — zobrazovaný popis funkcí přístroje: u vestavěného
 *  přístroje bez uživatelské úpravy (descriptionCustom=false) se bere
 *  z aktuálního jazykového překladu podle `id` (klíč `device.<id>.description`);
 *  pokud pro daný přístroj popis v překladu není (u většiny vestavěných je
 *  prázdný), vrátí se prázdný řetězec, ne samotný klíč. Upravený i vlastní
 *  přístroj se zobrazuje doslovně. */
export function getEntryDescription(entry) {
  if (!entry) return '';
  if (entry.builtin && !entry.descriptionCustom) {
    const key = `device.${entry.id}.description`;
    const translated = t(key);
    return translated === key ? '' : translated;
  }
  return entry.descriptionText || '';
}

/** Analogicky pro popis konstrukce (constructionText) — klíč `device.<id>.construction`. */
export function getEntryConstruction(entry) {
  if (!entry) return '';
  if (entry.builtin && !entry.constructionCustom) {
    const key = `device.${entry.id}.construction`;
    const translated = t(key);
    return translated === key ? '' : translated;
  }
  return entry.constructionText || '';
}

/** Najde přístroj podle id. */
export function getById(id) {
  return getCatalog().find((entry) => entry.id === id);
}

/** Vytvoří nový nebo aktualizuje existující přístroj (§7.2: i vestavěný lze
 *  plně upravit — jen builtin flag a id se nemění a nejde smazat). Vrací
 *  uloženou položku. */
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
    const wasBuiltin = catalog[idx].builtin;
    catalog[idx] = { ...normalized, id: catalog[idx].id, builtin: wasBuiltin };
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
  // §13 — duplikát je vždy vlastní přístroj, proto se doslovně pojmenuje
  // (nepřekládá se) z AKTUÁLNÍHO zobrazovaného názvu zdroje. Stejně tak popis
  // funkcí a konstrukce se převezmou z AKTUÁLNÍHO zobrazovaného (přeloženého)
  // textu zdroje, ne z jeho interní (třeba nepřeložené) uložené hodnoty.
  copy.name = `${getEntryDisplayName(src)} ${t('catalog.duplicateSuffix')}`;
  copy.nameCustom = true;
  copy.descriptionText = getEntryDescription(src);
  copy.descriptionCustom = true;
  copy.constructionText = getEntryConstruction(src);
  copy.constructionCustom = true;
  copy.builtin = false;
  copy.visible = true;
  catalog.push(copy);
  persist();
  return copy;
}

/** Obnoví tovární hodnoty vestavěného přístroje (§7.2 „Obnovit výchozí").
 *  Vrací obnovenou položku, nebo null (neznámé/nevestavěné id). */
export function resetBuiltin(id) {
  ensureLoaded();
  const def = BUILTIN_DEFAULTS.find((d) => d.id === id);
  if (!def) return null;
  const reset = cloneEntry(def);
  reset.name = ''; // §13 — bez přejmenování se název bere z překladu (nameCustom=false)
  const idx = catalog.findIndex((e) => e.id === id);
  if (idx >= 0) {
    catalog[idx] = reset;
  } else {
    catalog.push(reset);
  }
  persist();
  return reset;
}

/** Sloučí katalog z importované konfigurace (JSON export) — tolerantní,
 *  nikdy nezahodí builtin přístroje. Používá se při načtení uložené sestavy.
 *  Importované data procházejí stejnou migrací jako uložená data. */
export function importCatalog(rawArray) {
  if (!Array.isArray(rawArray)) return;
  ensureLoaded();
  // Migruj importované data (budou bez schémy, takže schemaVersion = 0)
  const migratedArray = migrateIfNeeded(rawArray, 0);
  const customOnly = catalog.filter((entry) => !entry.builtin);
  catalog = mergeWithBuiltins([...customOnly, ...migratedArray]);
  persist();
}
