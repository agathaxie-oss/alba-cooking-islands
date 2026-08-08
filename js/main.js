// main.js — bootstrap aplikace: scéna, renderer, světla, podlaha, render smyčka
// a propojení stavu aplikace s bočním panelem (ui.js), dialogem vlastního
// modulu (custom-dialog.js) a 3D scénou (block.js/arms.js). SPEC v4.

import * as THREE from 'three';
import { setupEnvironment, createFloorMaterial, createBackgroundTexture } from './materials.js';
import { buildBlock } from './block.js';
import { buildMonoScene } from './mono-block.js';
import {
  NEUTRAL_TYPE,
  CUSTOM_TYPE,
  DRAWERS_TYPE,
  DRAWERS_WIDTH_MM,
  DEFAULT_DRAWER_COUNT,
  DRAWER_COUNT_OPTIONS,
  NEUTRAL_WIDTH_MIN,
  NEUTRAL_WIDTH_MAX,
  NEUTRAL_WIDTH_STEP,
  LENGTH_MIN,
  LENGTH_MAX,
  LENGTH_STEP,
  HEIGHT_MIN,
  HEIGHT_MAX,
  HEIGHT_STEP,
  DEPTH_MIN,
  DEPTH_MAX,
  DEPTH_STEP,
  CATALOG_WIDTH_MAX,
  SINK_VAT_WIDTH_MIN,
  SINK_VAT_WIDTH_MAX,
  SINK_VAT_WIDTH_DEFAULT,
  SINK_VAT_DEPTH_MIN,
  SINK_VAT_DEPTH_MAX,
  SINK_VAT_DEPTH_DEFAULT,
  SINK_WIDTH_MARGIN_MM,
  PLINTH_TYPES,
  DEFAULT_PLINTH,
  FINISH_TYPES,
  DEFAULT_FINISH,
} from './modules.js';
import {
  ARM_ANGLE_MIN,
  ARM_ANGLE_MAX,
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
  ARM_CENTER_OFFSET_DEFAULT,
} from './arms.js';
import { getById as getCatalogEntry, getCatalog, importCatalog } from './catalog.js';
// §ÚKOL MONO §1/§10 (balík A5) — konstanty pro výchozí hodnoty/meze nových
// polí state.mono. Zdroj pravdy zůstává mono-geometry.js, main.js si čísla
// NEDUPLIKUJE (na rozdíl od řetězců END_TYPES o pár řádků níž, kde je
// duplikace záměrná kvůli formátu souboru — viz sanitizeMonoEndType).
import {
  PODESTAVBA_WIDTH_DEFAULT_MM,
  COLLAR_HEIGHT_MIN_MM,
  COLLAR_HEIGHT_MAX_MM,
  COLLAR_HEIGHT_DEFAULT_MM,
} from './mono-geometry.js';
// §ÚKOL MONO §2/§4 — computeMonoLayout je JEDINÁ funkce, která smí počítat
// rozvržení pásů MONO (viz ZADANI-MONO-UI.md) — onMonoFillPodestavby a
// onMonoAdd('panel', …) z ní čtou missingMM/usableFromMM/usableToMM, samy si
// polohy nedopočítávají (soubor píše souběžně jiný člověk, viz zadání).
// §ÚKOL MONO OSTROV — computeMonoLayout(state, side = 'A') teď bere i stranu
// (druhý parametr, výchozí 'A' pro zpětnou slučitelnost) — main.js ji volá
// se stranou příslušného handleru (viz onMonoAdd/onMonoFillPodestavby níže).
import { computeMonoLayout } from './mono-layout.js';
import {
  createCamera,
  createControls,
  computeViews,
  applyView,
  animateView,
  createRaycaster,
  pickModuleAt,
  toNDC,
} from './viewer.js';
import { setupUI } from './ui.js';
import { setupCustomDialog } from './custom-dialog.js';
import { setupDeviceManager } from './device-manager.js';
import { buildFloorplanSVG, setupFloorplan } from './floorplan.js';
import { buildReport } from './report.js';
import { t, applyTranslations, onLangChange } from './i18n.js';

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

// §11.2 SPEC v4 — validace INSTANCE polí plinth/finish (tolerantní vůči
// starším/cizím konfiguracím — chybějící/neplatná hodnota → výchozí).
function sanitizePlinth(value) {
  return PLINTH_TYPES.includes(value) ? value : DEFAULT_PLINTH;
}
function sanitizeFinish(value) {
  return FINISH_TYPES.includes(value) ? value : DEFAULT_FINISH;
}
// §10.2 SPEC v4 — validace INSTANCE pole bodyStyle katalogového segmentu
// proti povoleným stylům přístroje (def.allowedBodyStyles).
function sanitizeBodyStyle(def, value) {
  const allowed = def && Array.isArray(def.allowedBodyStyles) && def.allowedBodyStyles.length
    ? def.allowedBodyStyles
    : ['closed'];
  return allowed.includes(value) ? value : allowed[0];
}
// §ÚKOL MONO — typ zakončení (levý/pravý konec bloku ALBA MONO), tolerantní
// validace stejná jako u ostatních polí výše: neplatná/chybějící hodnota
// spadne na výchozí 'svislaDeska', soubor se kvůli tomu NIKDY neodmítá.
// Povolené hodnoty jsou VÝHRADNĚ 'svislaDeska' a 'svislaDeskaZkos' (řetězce
// se ukládají do souboru projektu — musí se přesně shodovat s
// mono-geometry.js END_TYPES; literály se drží přímo tady, mono-block.js/
// main.js na mono-geometry.js záměrně nezávisí přes společnou konstantu).
function sanitizeMonoEndType(value) {
  return value === 'svislaDeskaZkos' ? 'svislaDeskaZkos' : 'svislaDeska';
}

// §ÚKOL MONO OSTROV — verze formátu uloženého souboru. v4→v5 (balík A5)
// přidala herdblok/podestavby/panelItems/limec; v5→v6 (ostrovní varianta)
// štěpí herdblok/podestavby/panelItems na nezávislé strany A/B (viz
// state.mono níže) — SPEC v4 měla natvrdo 4 a applyConfig() při jiné
// hodnotě soubor tvrdě odmítala (viz dřívější kontrola níže), ale
// ZADANI-MONO-UI.md §0 tohle RUŠÍ: aplikace je interní/nenasazená, soubor
// se kvůli verzi už NIKDY neodmítá. Konstanta tu zůstává (jediné místo, kde
// se číslo objevuje natvrdo), ale slouží už jen k zápisu při ukládání
// a k informativnímu hlášení při načtení starší verze.
const CONFIG_VERSION = 6;

// §ÚKOL MONO §1/§10 (balík A5) — sanitizace nových seznamů state.mono
// (herdblok*/podestavby*/panelItems*/limec). Stejné pravidlo jako
// sanitizeMonoEndType výše a sanitizeSegment níže: špatná/chybějící hodnota
// se OŘEŽE nebo nahradí výchozí, soubor se kvůli ní NIKDY neodmítá. id se
// bere ze SDÍLENÉHO čítače nextId (stejně jako segmenty/ramena) — dnešní kód
// si id z uloženého souboru vůbec nepamatuje (sanitizeSegment i sanitizace
// ramen níže přidělují nové id bez ohledu na raw.id), takže žádné ruční
// „posunutí nextId za nejvyšší načtené id" není potřeba: kolize nemůže
// nastat, dokud VŠECHNY seznamy (staré i nové, strana A i strana B) čerpají
// id výhradně odsud. §ÚKOL MONO OSTROV — POZOR: applyConfig() teď musí projít
// OBĚ strany (herdblok*A*/*B* atd.) sanitizací, jinak by seznam strany B
// zůstal nesanitizovaný (tichá ztráta dat) A nextId by se za jeho položky
// neposunul (viz applyConfig níže).

const MONO_SURFACE_WIDTH_DEFAULT_MM = 400;      // §4 zadání — „rozumná výchozí šířka"
const MONO_ITEM_FRONT_OFFSET_DEFAULT_MM = 100;  // HODNOTY-MONO.md — pristrojOdPredniHranyStandard
const MONO_ITEM_GUARD_DEFAULT_MM = 50;          // HODNOTY-MONO.md — pristrojOchrannePoleMin
const MONO_PANEL_ITEM_HEIGHT_DEFAULT_MM = 100;  // §1 zadání — MonoPanelItem.heightMM výchozí
// Bez zadané horní meze pro bodyStyle skříňky — volím 'closed' jako výchozí
// (první v povoleném výčtu, stejná konvence jako sanitizeBodyStyle výše,
// kde neznámá hodnota taky spadne na allowed[0]).
const MONO_CABINET_BODY_STYLES = ['closed', 'doors', 'open'];
// Zadání nedává horní mez pro šířky/odsazení/polohy MONO položek — tohle číslo
// je jen POJISTKA proti nesmyslné hodnotě z cizího/poškozeného souboru (aby
// pravítko pásu v mono-ui.js nedostalo miliardy mm), ne požadavek specifikace.
const MONO_SAFETY_MAX_MM = 20000;

function sanitizeMonoCabinetBodyStyle(value) {
  return MONO_CABINET_BODY_STYLES.includes(value) ? value : 'closed';
}

/** Kladné konečné číslo v [0, max], jinak `fallback` — společný vzorec pro
 *  šířky/odsazení nových polí MONO (widthMM/frontOffsetMM/guardMM/heightMM). */
function sanitizeMonoPositiveNumber(value, fallback, max = MONO_SAFETY_MAX_MM) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? clamp(n, 0, max) : fallback;
}

// MonoDevice (§1 zadání) — type je klíč katalogu NEBO 'surface'. Katalog se
// čte JEN kvůli výchozí šířce chybějícího pole — přístroje samotné se ve 3D
// nekreslí (§0 zadání), takže na rozdíl od sanitizeSegment se tu neznámý
// katalogový klíč nezavrhuje, jen mu chybí zdroj výchozí šířky a spadne na
// MONO_SURFACE_WIDTH_DEFAULT_MM.
function sanitizeMonoDevice(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = nextId++;
  const type = typeof raw.type === 'string' && raw.type.trim() ? raw.type : 'surface';
  const def = type !== 'surface' ? getCatalogEntry(type) : null;
  const widthMM = sanitizeMonoPositiveNumber(raw.widthMM, def ? def.widthMM : MONO_SURFACE_WIDTH_DEFAULT_MM);
  const frontOffsetMM = sanitizeMonoPositiveNumber(raw.frontOffsetMM, MONO_ITEM_FRONT_OFFSET_DEFAULT_MM);
  const guardMM = sanitizeMonoPositiveNumber(raw.guardMM, MONO_ITEM_GUARD_DEFAULT_MM);
  return { id, type, widthMM, frontOffsetMM, guardMM };
}

// MonoCabinet (§1 zadání) — kind:'gap' nemá bodyStyle/plinth/finish (jen
// widthMM): jde o úmyslně vynechaný most v řadě podestaveb, ne o skříňku.
function sanitizeMonoCabinet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = nextId++;
  const widthMM = sanitizeMonoPositiveNumber(raw.widthMM, PODESTAVBA_WIDTH_DEFAULT_MM);
  if (raw.kind === 'gap') {
    return { id, kind: 'gap', widthMM };
  }
  return {
    id,
    kind: 'cabinet',
    widthMM,
    bodyStyle: sanitizeMonoCabinetBodyStyle(raw.bodyStyle),
    plinth: sanitizePlinth(raw.plinth),
    finish: sanitizeFinish(raw.finish),
  };
}

// MonoPanelItem (§1 zadání) — xMM je ABSOLUTNÍ poloha po délce bloku, NENÍ
// tu oříznutá do použitelného rozsahu panelu — to dělá až computeMonoLayout()
// při vykreslení (§1/§2 zadání), protože rozsah závisí na AKTUÁLNÍM
// leftEndType/rightEndType, který se může po uložení souboru změnit.
function sanitizeMonoPanelItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = nextId++;
  const kind = raw.kind === 'socketCEE' ? 'socketCEE' : 'socket230';
  const xMM = clamp(Number(raw.xMM) || 0, 0, MONO_SAFETY_MAX_MM);
  const heightMM = sanitizeMonoPositiveNumber(raw.heightMM, MONO_PANEL_ITEM_HEIGHT_DEFAULT_MM);
  return { id, kind, xMM, heightMM };
}

// MonoCollar (§1 zadání) — jediný objekt, ne seznam položek; chybí-li
// config.mono.limec celé (starší soubor verze 4), vrátí se rovnou výchozí
// objekt (žádné id — límec není položka seznamu, nepotřebuje ho).
function sanitizeMonoCollar(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    back: !!r.back,
    left: !!r.left,
    right: !!r.right,
    heightMM: clamp(Number(r.heightMM) || COLLAR_HEIGHT_DEFAULT_MM, COLLAR_HEIGHT_MIN_MM, COLLAR_HEIGHT_MAX_MM),
    // výchozí true (§1 zadání) — na rozdíl od back/left/right (výchozí false)
    // se chybějící pole NESMÍ zaměnit s explicitně uloženým false.
    alignSide: r.alignSide === undefined ? true : !!r.alignSide,
  };
}

function defaultMonoCollar() {
  return { back: false, left: false, right: false, heightMM: COLLAR_HEIGHT_DEFAULT_MM, alignSide: true };
}

// --- stav aplikace -----------------------------------------------------------

let nextId = 1;
const state = {
  // Název projektu (přestavba horní části panelu) — ukládá se do konfigurace
  // a předvyplňuje název souboru při ukládání (viz projectFileName/saveConfig).
  projectName: '',
  // Typ bloku zvolený při založení projektu (úvodní obrazovka) — VÝHRADNĚ
  // neutrální kód 'segment' | 'mono', nikdy obchodní jméno řady (přejmenování
  // řady tak neznamená změnu formátu uloženého souboru). 'segment' = dnešní
  // typ, výchozí i pro starší/cizí soubory bez tohoto pole (viz applyConfig).
  productType: 'segment', // 'segment' | 'mono'
  // §ÚKOL MONO — celý datový model produktu ALBA MONO (§1 zadání). U produktu
  // SEGMENT se NEPOUŽÍVÁ (SEGMENT tahle pole nikdy nečte ani nezobrazuje),
  // ale drží se vždy (přírůstková pole, viz serializeConfig/applyConfig
  // níže) — jednodušší než mít `state.mono` jen podmíněně přítomné.
  // leftEndType/rightEndType: SDÍLENÉ pro obě strany bloku, beze změny.
  // jediné povolené hodnoty jsou 'svislaDeska' a 'svislaDeskaZkos' (viz
  // mono-geometry.js END_TYPES).
  // §ÚKOL MONO OSTROV — herdblok/podestavby/panelItems mají teď KAŽDÉ
  // NEZÁVISLÝ obsah pro stranu A a stranu B (přípona A/B), stejně jako
  // segmentsA/segmentsB u SEGMENTu — žádné zrcadlení, žádné sdílení. U
  // varianty 'single' se strana B nikdy nepoužije a zůstává prázdná.
  // Uspořádané seznamy, výchozí prázdné — POLOHY se z nich odvozují až
  // computeMonoLayout(state, side) (mono-layout.js), tady se neukládají
  // (§1 zadání, „Rozvržení se NEUKLÁDÁ").
  // limec: SDÍLENÝ pro obě strany, beze změny — viz defaultMonoCollar() výše.
  mono: {
    leftEndType: 'svislaDeska',
    rightEndType: 'svislaDeska',
    herdblokA: [],
    herdblokB: [],
    podestavbyA: [],
    podestavbyB: [],
    panelItemsA: [],
    panelItemsB: [],
    limec: defaultMonoCollar(),
  },
  dimensions: { lengthMM: 3200, depthAMM: 850, depthBMM: 850, heightMM: 900 },
  variant: 'single', // 'single' | 'island'
  segmentsA: [],
  segmentsB: [], // jen 'island' — nezávislý seznam, žádné zrcadlení strany A
  arms: [],
  selectedId: null,
  environment: 'light', // 'light' | 'dark' — barva podlahy
  currentViewName: 'perspective',
  // Strana bloku, na kterou se aktuálně dívá KAMERA (jen 'island' — přepínač
  // A/B v horní liště). Řídí VÝHRADNĚ pohled — nemá vliv na to, kam se
  // přidávají nové prvky ani na aktivní záložku v pásu (to řídí editSide
  // níže). Čistě dočasný stav pohledu, NEUKLÁDÁ se do konfigurace ani do
  // localStorage (viz serializeConfig/applyConfig — nesahají na toto pole).
  currentSide: 'A', // 'A' | 'B'
  // Strana bloku, která se EDITUJE (jen 'island' — záložka A/B ve spodním
  // pásu, klik na segment/kartu, paleta). Nezávislá na pohledu kamery
  // (currentSide výše) — vazba je jednosměrná: přepnutí editSide (záložkou)
  // otočí i kameru, ale otočení kamery editSide nepřepne. Čistě dočasný
  // stav, stejně jako currentSide — NEUKLÁDÁ se do konfigurace.
  editSide: 'A', // 'A' | 'B'
  // §1A — je-li tiskový dokument (report.js) otevřený nad 3D viewportem;
  // #floorplan-btn se v liště chová jako čtvrtý "pohled" (viz ui.js render).
  // Čistě dočasný stav, stejně jako currentSide — NEUKLÁDÁ se do konfigurace.
  floorplanOpen: false,
  builtDimensions: { lengthMM: 0, depthMM: 0, depthAMM: 0, depthBMM: 0, heightMM: 900 },
  capacityA: { usedMM: 0, capacityMM: 0, results: [] },
  capacityB: { usedMM: 0, capacityMM: 0, results: [] },
};

// §ÚKOL C — příznak „od posledního uložení do souboru (nebo načtení souboru)
// došlo ke změně". NEUKLÁDÁ se do konfigurace, řídí jen dotaz při zavírání
// okna (beforeunload níže). Nastavuje se v rebuildScene() (pokrývá naprostou
// většinu stavových změn — rozměry, segmenty, ramena, varianta) a explicitně
// v handlerech, které stav mění BEZ přestavby scény (název projektu,
// prostředí/barva podlahy). Shazuje se po úspěšném uložení do souboru,
// po úspěšném načtení souboru a při založení nového projektu.
let hasUnsavedChanges = false;
function markUnsavedChanges() {
  hasUnsavedChanges = true;
}

// výchozí sestava strany A: neutrální + sporák plynový + fritéza + neutrální
function createDefaultSegmentsA() {
  return [
    {
      id: nextId++, type: NEUTRAL_TYPE, widthMM: 400, podestavba: 'doors',
      hasPanel: false, hasShelf: false, plinth: DEFAULT_PLINTH, finish: DEFAULT_FINISH,
    },
    createCatalogSegment('gas_stove'),
    createCatalogSegment('fryer'),
    {
      id: nextId++, type: NEUTRAL_TYPE, widthMM: 400, podestavba: 'open',
      hasPanel: false, hasShelf: true, plinth: DEFAULT_PLINTH, finish: DEFAULT_FINISH,
    },
  ];
}
state.segmentsA = createDefaultSegmentsA();

// §ÚKOL MONO — PŘÁNÍ zadavatele: nový projekt MONO nezačíná s prázdnou řadou
// podestaveb (viz PREDANI-2026-08-05-VECER.md „Co zbývá" bod 3 — prázdná
// řada rovnou hlásí „chybí 2400 mm" a působí to jako chyba), ale s
// předvyplněnou trojicí Skříňka 600 / volný prostor 600 / Skříňka 600.
// Zbytek řady zůstává NEDOPLNĚNÝ ZÁMĚRNĚ — computeMonoLayout dopočítá
// missingMM na konci použitelného rozsahu a UI to nahlásí jako „chybí N mm"
// (mono.missing), přesně jako u ručně sestavované řady; tlačítko „Doplnit"
// (onMonoFillPodestavby) zbytek dorovná stejně, jako by ho uživatel nechal
// prázdný od začátku.
//
// Stejná konvence jako createDefaultSegmentsA()/defaultMonoCollar() výše —
// JEDNO místo pro výchozí hodnoty, ať se při případné budoucí změně
// nerozejdou. Položky se skládají přes sanitizeMonoCabinet(), NE ručním
// literálem — bodyStyle/plinth/finish tak dostanou stejnou výchozí hodnotu
// jako všude jinde v souboru (closed / DEFAULT_PLINTH / DEFAULT_FINISH) a
// id se přiděluje ze sdíleného čítače nextId, stejně jako zbytek souboru
// (sanitizeMonoCabinet uvnitř dělá `nextId++`).
function createDefaultMonoPodestavby() {
  return [
    sanitizeMonoCabinet({ kind: 'cabinet', widthMM: 600 }),
    sanitizeMonoCabinet({ kind: 'gap', widthMM: 600 }),
    sanitizeMonoCabinet({ kind: 'cabinet', widthMM: 600 }),
  ];
}

// --- helpery pro práci se dvěma nezávislými stranami -------------------------

function getSideList(side) {
  return side === 'B' ? state.segmentsB : state.segmentsA;
}

/** Najde segment podle id napříč oběma stranami (id jsou globálně unikátní). */
function findSegment(id) {
  let seg = state.segmentsA.find((s) => s.id === id);
  if (seg) return { seg, side: 'A' };
  seg = state.segmentsB.find((s) => s.id === id);
  if (seg) return { seg, side: 'B' };
  return null;
}

// §ÚKOL MONO OSTROV — vrátí PŘÍMO odkaz na pole dané MONO vrstvy (herdblok/
// podestavby/panel — `layer`, ne jméno pole; `layer` 'panel' čte
// panelItems*, stejná nesrovnalost jako dřív, je i v i18n klíčích
// mono.tab.panel/mono.panelNote, viz zadání) NA DANÉ STRANĚ (A/B).
// Neznámá/chybějící `side` spadne na 'A' — stejné pravidlo jako
// u computeMonoLayout/computeMonoChecks (mono-layout.js) a u getSideList()
// pro segmenty výše. Vrací odkaz, ne kopii — volající do něj smí zapisovat
// (push/splice), stejně jako getSideList().
function getMonoList(layer, side) {
  const s = side === 'B' ? 'B' : 'A';
  if (layer === 'herdblok') return s === 'B' ? state.mono.herdblokB : state.mono.herdblokA;
  if (layer === 'podestavby') return s === 'B' ? state.mono.podestavbyB : state.mono.podestavbyA;
  if (layer === 'panel') return s === 'B' ? state.mono.panelItemsB : state.mono.panelItemsA;
  return null;
}

// §ÚKOL MONO §4 (balík A5) — najde položku MONO podle vrstvy, strany a id.
// §ÚKOL MONO OSTROV — přibyl parametr `side` (výchozí 'A', stejné pravidlo
// jako u getMonoList výše).
function findMonoItem(layer, id, side = 'A') {
  const list = getMonoList(layer, side);
  return list ? list.find((item) => item.id === id) || null : null;
}

/** Vytvoří novou instanci katalogového segmentu (§3.1–3.3, §7.1 SPEC v3;
 *  §10.2/§11.2 SPEC v4 — bodyStyle/plinth/finish). Šířka je vlastností
 *  INSTANCE — výchozí hodnota = výchozí šířka přístroje v katalogu. Hloubka
 *  podestavby už NENÍ instance-level pole (§11.1) — odvozuje se jednotně
 *  z hloubky strany bloku (viz block.js computeSideDepth). */
function createCatalogSegment(type) {
  const def = getCatalogEntry(type);
  const seg = { id: nextId++, type, plinth: DEFAULT_PLINTH, finish: DEFAULT_FINISH };
  if (def) {
    seg.widthMM = def.widthMM;
    const allowed = Array.isArray(def.allowedBodyStyles) && def.allowedBodyStyles.length
      ? def.allowedBodyStyles
      : ['closed'];
    seg.bodyStyle = allowed[0];
  }
  if (def && def.topFeature && def.topFeature.type === 'sink') {
    seg.vatWidthMM = SINK_VAT_WIDTH_DEFAULT;
    seg.vatDepthMM = SINK_VAT_DEPTH_DEFAULT;
    seg.widthMM = Math.max(seg.widthMM || def.widthMM, SINK_VAT_WIDTH_DEFAULT + SINK_WIDTH_MARGIN_MM);
  }
  return seg;
}

// --- základ scény -------------------------------------------------------------

const viewportEl = document.getElementById('viewport');
const canvas = document.getElementById('three-canvas');
const badgeEl = document.getElementById('selection-badge');
// §ROZHRANÍ proti ui.js — úvodní obrazovka spouští otevření souboru přes
// onRequestOpenFile() (viz setupUI options níže); skutečný <input type=file>
// zůstává ten stávající, jen ho main.js sám odklikne.
const loadFileInputEl = document.getElementById('load-file-input');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true, // nutné pro spolehlivý export PNG přes toDataURL
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = createBackgroundTexture();
setupEnvironment(renderer, scene);

// --- světla ---------------------------------------------------------------------

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3a3d42, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(3.5, 5, -2.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -5;
dirLight.shadow.camera.right = 5;
dirLight.shadow.camera.top = 5;
dirLight.shadow.camera.bottom = -5;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 18;
dirLight.shadow.bias = -0.0015;
scene.add(dirLight);
scene.add(dirLight.target);

// slabé protisvětlo — vyplní stíny z opačné strany
const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.35);
fillLight.position.set(-3.5, 2.5, 2.0);
scene.add(fillLight);

// --- podlaha ---------------------------------------------------------------------

const floorGeometry = new THREE.CircleGeometry(12, 64);
const floorMesh = new THREE.Mesh(floorGeometry, createFloorMaterial(state.environment === 'dark'));
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// --- kamera a ovládání ----------------------------------------------------------

const camera = createCamera(viewportEl.clientWidth / Math.max(viewportEl.clientHeight, 1));
const controls = createControls(camera, renderer.domElement);
const raycaster = createRaycaster();

// --- blok segmentů (přestavuje se při každé změně konfigurace) --------------------

let blockGroup = null;
let selectable = [];
let selectionHelper = null;
let firstBuild = true;

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material && obj.material.userData && obj.material.userData.disposable) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });
}

function updateSelectionHighlight() {
  if (selectionHelper) {
    scene.remove(selectionHelper);
    selectionHelper.geometry.dispose();
    selectionHelper = null;
  }

  if (state.selectedId == null) {
    badgeEl.hidden = true;
    return;
  }

  const entry = selectable.find((s) => s.id === state.selectedId);
  if (!entry) {
    state.selectedId = null;
    badgeEl.hidden = true;
    return;
  }

  selectionHelper = new THREE.BoxHelper(entry.mesh, 0xff8c3a);
  scene.add(selectionHelper);

  badgeEl.hidden = false;
  badgeEl.textContent = t('selection.badge', { label: entry.label });
}

// rebuildScene() přestaví jen 3D geometrii (bez zásahu do DOM bočního panelu) —
// používá se pro spojité ovládací prvky (posuvníky ramen), kde by kompletní
// překreslení seznamu (ui.render) přerušilo právě probíhající tažení myší.
//
// §9 SPEC v4 — DŮLEŽITÁ ZMĚNA: rebuildScene() už NEVOLÁ reframeCamera().
// Jakákoli úprava sestavy (rozměry, segmenty, ramena, katalog) nesmí měnit
// aktuální pohled kamery. Přerámování se volá explicitně jen na dvou
// místech: 1) po prvním sestavení scény při startu aplikace, 2) po kliknutí
// na tlačítko přednastaveného pohledu / přepínače strany (onViewChange,
// onSideChange), 3) po načtení konfigurace ze souboru/prohlížeče
// (applyConfig). Každé kliknutí na tlačítko pohledu (i na už aktivní) tak
// kameru znovu vycentruje — samostatné tlačítko „Vycentrovat pohled" bylo
// zrušeno (ZMĚNA 1), tuto roli teď plní přímo tlačítka pohledů.
function rebuildScene() {
  markUnsavedChanges(); // §ÚKOL C — jakákoli přestavba geometrie = stavová změna

  if (blockGroup) {
    scene.remove(blockGroup);
    disposeGroup(blockGroup);
  }

  // §ÚKOL MONO — volba typu bloku (úvodní obrazovka) teď skutečně přepíná,
  // co se staví ve 3D (dřív šlo jen o evidenci v state.productType).
  let result;
  if (state.productType === 'mono') {
    // TODO: varianta 'island' se u MONO zatím neřeší — chová se jako
    // 'single' (buildMonoScene čte jen state.dimensions/state.mono, variantu
    // vůbec nebere v potaz). Až MONO jednou dostane ostrovní variantu,
    // přibude větev i tady.
    result = buildMonoScene(state);
  } else {
    const dims = { ...state.dimensions, variant: state.variant };
    result = buildBlock(state.segmentsA, state.segmentsB, state.arms, dims);
  }
  blockGroup = result.group;
  selectable = result.selectable;
  state.builtDimensions = result.dimensions;
  state.capacityA = result.capacityA;
  state.capacityB = result.capacityB;

  scene.add(blockGroup);
  updateSelectionHighlight();

  // směřuje světlo doprostřed bloku, ať je stín vždy na scéně správně
  dirLight.target.position.set(0, 0, state.builtDimensions.depthMM / 2000);
}

// rebuildBlock() = rebuildScene() + překreslení bočního panelu — použije se
// pro strukturální změny (přidání/odebrání, rozměry, výběr typu apod.).
// Pohled kamery se NEMĚNÍ (§9 SPEC v4) — viz poznámka u rebuildScene().
function rebuildBlock() {
  rebuildScene();
  ui.render(state);
  floorplan.refreshIfOpen(); // je-li půdorys otevřený, drží se v sync se stavem
}

// --- přechod kamery mezi přednastavenými pohledy (plynulý oblet) ----------------
// §9 SPEC v4 — reframeCamera() se volá jen řízeně (viz komentář u
// rebuildScene()), NE po každé změně sestavy.
// §ZMĚNA 5 — přechod mezi pohledy dělá animateView() (viewer.js): kamera
// opíše oblouk po kouli kolem cíle místo skoku. Výjimka je první sestavení
// scény při startu (firstBuild) — tam je skok žádoucí (není z čeho obletět).

// Vybere definici pohledu podle zvoleného typu (perspective/front/top) A
// aktuální strany bloku (A/B — přepínač v liště, jen u varianty 'island').
// Strana B má zrcadlené varianty pro všechny tři pohledy — pohled shora
// (top/topB) se stranou otáčí o 180° (viz computeViews).
function selectViewDef(views) {
  const name = state.currentViewName;
  if (state.currentSide === 'B') {
    if (name === 'perspective') return views.perspectiveB || views.perspective;
    if (name === 'front') return views.backB || views.front;
    if (name === 'top') return views.topB || views.top;
  }
  return views[name] || views.perspective;
}

function reframeCamera() {
  const lengthM = state.builtDimensions.lengthMM / 1000;
  const depthM = state.builtDimensions.depthMM / 1000;
  const views = computeViews(Math.max(lengthM, 0.4), Math.max(depthM, 0.7));
  const viewDef = selectViewDef(views);
  if (firstBuild) {
    applyView(camera, controls, viewDef);
    firstBuild = false;
  } else {
    animateView(camera, controls, viewDef);
  }
}

// --- náhledy 3D pro tiskový dokument (§ČÁST 2 bod 2) -----------------------------
// Vykresluje se VLASTNÍM offscreen rendererem a VLASTNÍ kamerou (aspect 1.6,
// rozlišení 1600×1000 — dvojnásobek běžné šířky náhledu v dokumentu), ale
// STEJNOU scénou `scene` (materiály/světla zůstávají). Kamera/stav hlavního
// viewportu (`camera`, `controls`) se tím nesmí a ani nemůže změnit — jde
// o zcela nezávislé objekty (viz TEST 3 zadání).
function renderReportPreviews() {
  const lengthM = state.builtDimensions.lengthMM / 1000;
  const depthM = state.builtDimensions.depthMM / 1000;
  const views = computeViews(Math.max(lengthM, 0.4), Math.max(depthM, 0.7));

  const offCanvas = document.createElement('canvas');
  const offRenderer = new THREE.WebGLRenderer({ canvas: offCanvas, antialias: true, preserveDrawingBuffer: true });
  offRenderer.setPixelRatio(1);
  offRenderer.setSize(1600, 1000, false);
  offRenderer.shadowMap.enabled = true;
  offRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  offRenderer.outputColorSpace = THREE.SRGBColorSpace;
  offRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  offRenderer.toneMappingExposure = 1.15;

  const previewCamera = new THREE.PerspectiveCamera(45, 1.6, 0.05, 60);

  // `scene.environment` (PMREM z RoomEnvironment, viz materials.js
  // setupEnvironment) je textura vázaná na WebGL kontext RENDERERU, který ji
  // vytvořil — nerezové materiály jsou hodně závislé na environment mapě
  // (vysoká metalness), takže vykreslení STEJNÉ scény jiným (offscreen)
  // rendererem se stejnou texturou z hlavního kontextu vychází černé/vadné.
  // Řešení: dočasně vygenerovat environment mapu ZNOVU, ale kompatibilní
  // s `offRenderer`, a po vyrenderování náhledů vrátit scéně původní texturu
  // (aby se nezměnil vzhled hlavního 3D viewportu — viz TEST 3).
  const previousEnv = scene.environment;
  setupEnvironment(offRenderer, scene);
  const tempEnv = scene.environment;

  function renderView(viewDef) {
    previewCamera.position.set(...viewDef.position);
    previewCamera.lookAt(...viewDef.target);
    previewCamera.updateProjectionMatrix();
    offRenderer.render(scene, previewCamera);
    return offCanvas.toDataURL('image/png');
  }

  const result = state.variant === 'island'
    ? { perspective: renderView(views.perspective), perspectiveB: renderView(views.perspectiveB) }
    : { perspective: renderView(views.perspective) };

  scene.environment = previousEnv;
  if (tempEnv && tempEnv !== previousEnv) tempEnv.dispose();
  offRenderer.dispose();
  return result;
}

// --- export PNG ----------------------------------------------------------------

function exportPNG() {
  renderer.render(scene, camera); // vykreslit aktuální snímek těsně před čtením bufferu
  const dataURL = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `${t('export.pngFilenamePrefix')}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- export / import JSON konfigurace -------------------------------------------

/** Sada `type` hodnot použitých v aktuální sestavě, na obou stranách bloku
 *  (§ÚKOL 1) — čte přímo ze state.segmentsA/segmentsB, tedy včetně segmentů,
 *  které se do bloku aktuálně nevejdou a přetékají (buildBlock je z vstupu
 *  nijak neodstraňuje, jsou pořád součástí pole). Slouží k omezení ukládaného
 *  katalogu jen na skutečně použité přístroje (viz serializeConfig níže) —
 *  segmenty typu 'neutral'/'custom'/'drawers' (NEUTRAL_TYPE/CUSTOM_TYPE/
 *  DRAWERS_TYPE) nejsou katalogové položky a žádnému id v katalogu
 *  neodpovídají, takže tímhle filtrem přirozeně vypadnou samy, bez zvláštní
 *  výjimky (vlastní modul si svoji definici nese přímo v segmentu).
 */
function usedCatalogTypes() {
  const types = new Set();
  state.segmentsA.forEach((s) => types.add(s.type));
  state.segmentsB.forEach((s) => types.add(s.type));
  return types;
}

function serializeConfig() {
  const usedTypes = usedCatalogTypes();
  return {
    version: CONFIG_VERSION,
    projectName: state.projectName,
    productType: state.productType,
    // §ÚKOL MONO §10 — přírůstkové pole vedle productType (viz applyConfig
    // níže: čte se tolerantně, chybějící/neplatná hodnota nikdy soubor
    // neodmítne). v4→v5: přibyly herdblok/podestavby/panelItems/limec.
    // v5→v6 (§ÚKOL MONO OSTROV): herdblok/podestavby/panelItems se štěpí na
    // nezávislé strany A/B (přípona v názvu pole) — leftEndType/rightEndType
    // a limec zůstávají SDÍLENÉ, beze změny. Seznamy se kopírují položku po
    // položce (stejný vzorec jako segmentsA/segmentsB/arms níže), limec je
    // jediný objekt.
    mono: {
      leftEndType: state.mono.leftEndType,
      rightEndType: state.mono.rightEndType,
      herdblokA: state.mono.herdblokA.map((item) => ({ ...item })),
      herdblokB: state.mono.herdblokB.map((item) => ({ ...item })),
      podestavbyA: state.mono.podestavbyA.map((item) => ({ ...item })),
      podestavbyB: state.mono.podestavbyB.map((item) => ({ ...item })),
      panelItemsA: state.mono.panelItemsA.map((item) => ({ ...item })),
      panelItemsB: state.mono.panelItemsB.map((item) => ({ ...item })),
      limec: { ...state.mono.limec },
    },
    variant: state.variant,
    environment: state.environment,
    dimensions: { ...state.dimensions },
    segmentsA: state.segmentsA.map((s) => ({ ...s })),
    segmentsB: state.segmentsB.map((s) => ({ ...s })),
    arms: state.arms.map((a) => ({ ...a })),
    // Ukládáme jen POUŽITÉ přístroje (§ÚKOL 1), ne celý katalog — katalog čeká
    // zásadní přestavbu a vestavěné přístroje z něj mohou zmizet nebo se
    // nahradit; uložený projekt si proto musí nést definice použitých
    // přístrojů s sebou, jinak by po přestavbě katalogu ztratil rozměry
    // i vzhled a segmenty by se vykreslily jako prázdná výplň (viz
    // sanitizeSegment/getCatalogEntry). Rozhoduje POUŽITÍ, ne příznak
    // builtin — použitý vestavěný přístroj se uloží stejně jako použitý
    // vlastní.
    catalog: getCatalog().filter((entry) => usedTypes.has(entry.id)),
  };
}

function downloadJson(json, filename) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Odvodí bezpečný název souboru z názvu projektu (přestavba horní části
// panelu, §4.3 zadání) — zakázané znaky nahradí pomlčkou, ořízne na 60
// znaků. Prázdný název → dnešní prefix z export.jsonFilenamePrefix.
// Pozn.: literální regex ze zadání ([\\/:*?"<>| -]) obsahuje uvnitř třídy
// i mezeru, takže by nahrazoval i mezery pomlčkou — na vstupu z kritéria 9
// („Kuchyně / Novák: 1") by tak vyšlo „Kuchyně---Novák--1.json", ne zadáním
// požadované „Kuchyně - Novák- 1.json". Mezera je zde záměrně vyňata z třídy
// zakázaných znaků, ať výstup odpovídá kritériu 9 doslova.
function projectFileName(name) {
  const base = String(name || '')
    .replace(/[\\/:*?"<>|-]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60)
    .trim();
  return (base || t('export.jsonFilenamePrefix')) + '.json';
}

async function saveConfig() {
  const json = JSON.stringify(serializeConfig(), null, 2);

  // §ÚKOL B — ukládání do prohlížeče (localStorage) zrušeno, ikonka „poslední
  // uložené" se ruší jako nebezpečná a autosave se nezavádí. Zůstává jen
  // ukládání do SOUBORU, beze změny.
  const suggested = projectFileName(state.projectName);
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      hasUnsavedChanges = false; // §ÚKOL C — úspěšně uloženo do souboru
    } catch (err) {
      // zrušení dialogu NENÍ chyba a nesmí nic hlásit
      if (err && err.name === 'AbortError') { ui.render(state); return; }
      downloadJson(json, suggested); // jiná chyba → náhradní cesta
      hasUnsavedChanges = false; // §ÚKOL C — náhradní cesta je taky úspěšné uložení
    }
  } else {
    const entered = window.prompt(t('project.filenamePrompt'), suggested);
    if (entered === null) { ui.render(state); return; } // zrušeno
    const name = entered.trim().toLowerCase().endsWith('.json')
      ? entered.trim() : entered.trim() + '.json';
    downloadJson(json, projectFileName(name.replace(/\.json$/i, '')));
    hasUnsavedChanges = false; // §ÚKOL C — úspěšně uloženo do souboru
  }

  ui.render(state);
}

function sanitizeSegment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = nextId++;
  // §11.2 SPEC v4 — plinth/finish jsou INSTANCE pole u KAŽDÉHO segmentu;
  // chybějící/neplatná hodnota → výchozí.
  const plinth = sanitizePlinth(raw.plinth);
  const finish = sanitizeFinish(raw.finish);
  if (raw.type === NEUTRAL_TYPE) {
    return {
      id,
      type: NEUTRAL_TYPE,
      widthMM: clamp(Number(raw.widthMM) || 400, NEUTRAL_WIDTH_MIN, NEUTRAL_WIDTH_MAX),
      podestavba: raw.podestavba === 'open' ? 'open' : 'doors',
      hasPanel: !!raw.hasPanel,
      hasShelf: !!raw.hasShelf,
      plinth,
      finish,
    };
  }
  if (raw.type === DRAWERS_TYPE) {
    // §Zásuvky GN 1/1 — šířka je vždy pevná (400 mm), s panelem je počet
    // zásuvek vynuceně 2; chybějící/neplatné pole drawerCount → výchozí 2.
    const hasPanel = !!raw.hasPanel;
    const drawerCount = hasPanel
      ? 2
      : (DRAWER_COUNT_OPTIONS.includes(Number(raw.drawerCount)) ? Number(raw.drawerCount) : DEFAULT_DRAWER_COUNT);
    return {
      id,
      type: DRAWERS_TYPE,
      widthMM: DRAWERS_WIDTH_MM,
      hasPanel,
      drawerCount,
      plinth,
      finish,
    };
  }
  if (raw.type === CUSTOM_TYPE) {
    return {
      id,
      type: CUSTOM_TYPE,
      name: typeof raw.name === 'string' ? raw.name : t('module.customDefaultName'),
      minWidthMM: Number(raw.minWidthMM) || 300,
      widthMM: Number(raw.widthMM) || Number(raw.minWidthMM) || 300,
      controlsType: raw.controlsType || 'knob',
      controlsCount: clamp(Number(raw.controlsCount) || 0, 0, 8),
      imageDataURL: typeof raw.imageDataURL === 'string' ? raw.imageDataURL : null,
      plinth,
      finish,
    };
  }
  // katalogový přístroj — typ ověří modules.js/catalog.js při stavbě (neznámý = prázdná výplň)
  const def = getCatalogEntry(raw.type);
  const seg = { id, type: raw.type, plinth, finish };
  if (def) {
    // šířka je vlastnost INSTANCE (§7.1); chybějící/neplatné widthMM se
    // doplní na výchozí hodnotu katalogu. Hloubka podestavby už NENÍ
    // instance-level pole (§11.1 SPEC v4 — zrušeno, odvozuje se z hloubky
    // strany bloku).
    seg.widthMM = clamp(Number(raw.widthMM) || def.widthMM, def.minWidthMM, CATALOG_WIDTH_MAX);
    seg.bodyStyle = sanitizeBodyStyle(def, raw.bodyStyle);
  }
  if (def && def.topFeature && def.topFeature.type === 'sink') {
    seg.vatWidthMM = clamp(Number(raw.vatWidthMM) || SINK_VAT_WIDTH_DEFAULT, SINK_VAT_WIDTH_MIN, SINK_VAT_WIDTH_MAX);
    seg.vatDepthMM = clamp(Number(raw.vatDepthMM) || SINK_VAT_DEPTH_DEFAULT, SINK_VAT_DEPTH_MIN, SINK_VAT_DEPTH_MAX);
    const minWidth = seg.vatWidthMM + SINK_WIDTH_MARGIN_MM;
    seg.widthMM = clamp(seg.widthMM || minWidth, minWidth, CATALOG_WIDTH_MAX);
  }
  return seg;
}

function applyConfig(config) {
  if (!config || typeof config !== 'object') {
    alert(t('alert.invalidConfig'));
    return;
  }

  // §ÚKOL MONO §0/§10 (balík A5) — SPEC v4 tu měla tvrdé odmítnutí při jiné
  // verzi (config.version !== 4). ZADANI-MONO-UI.md §0 tohle RUŠÍ: „soubor
  // se NIKDY neodmítne" platí teď i pro verzi samotnou, ne jen pro
  // jednotlivé hodnoty — starý soubor verze 4 (bez herdblok/podestavby/
  // panelItems/limec) se musí načíst BEZE CHYBY, jen s novými poli na
  // výchozích hodnotách (viz sanitizace state.mono níže). Verze se dál čte
  // jen informativně, nic tu už nevede k `return`.
  if (config.version !== CONFIG_VERSION) {
    console.warn(`Soubor má verzi formátu ${config.version}, aktuální je ${CONFIG_VERSION} — načítá se tolerantně.`);
  }

  const rawSegmentsA = config.segmentsA;
  const rawSegmentsB = config.segmentsB;
  // §ÚKOL MONO §10 — čte se už TADY (dřív, než dřívější umístění o pár řádků
  // níž u productType), aby ho šlo použít i v kontrole prázdné konfigurace
  // hned pod tímto blokem — viz rawMonoHerdblokCount/rawMonoPodestavbyCount.
  const rawMono = config.mono && typeof config.mono === 'object' ? config.mono : {};

  // §ÚKOL MONO OSTROV — v6 čte herdblok/podestavby/panelItems ze stran A/B
  // (přípona v názvu pole, viz serializeConfig výše). Starší soubor verze 5
  // (a dřívější balík A5) má pole BEZ přípony — to je dnešní obsah, který
  // patřil VÝHRADNĚ straně A (varianta 'island' u MONO tehdy neexistovala) —
  // proto padá jako záloha na stranu A, když přípona chybí. Strana B u
  // takového staršího souboru logicky neexistuje, zůstává prázdná (viz níže
  // rawHerdblokB/rawPodestavbyB/rawPanelItemsB — bez zálohy na neexistující
  // pole).
  const rawHerdblokA = Array.isArray(rawMono.herdblokA) ? rawMono.herdblokA
    : Array.isArray(rawMono.herdblok) ? rawMono.herdblok : [];
  const rawHerdblokB = Array.isArray(rawMono.herdblokB) ? rawMono.herdblokB : [];
  const rawPodestavbyA = Array.isArray(rawMono.podestavbyA) ? rawMono.podestavbyA
    : Array.isArray(rawMono.podestavby) ? rawMono.podestavby : [];
  const rawPodestavbyB = Array.isArray(rawMono.podestavbyB) ? rawMono.podestavbyB : [];
  const rawPanelItemsA = Array.isArray(rawMono.panelItemsA) ? rawMono.panelItemsA
    : Array.isArray(rawMono.panelItems) ? rawMono.panelItems : [];
  const rawPanelItemsB = Array.isArray(rawMono.panelItemsB) ? rawMono.panelItemsB : [];

  if (!Array.isArray(rawSegmentsA) && !Array.isArray(rawSegmentsB) && !Array.isArray(config.arms)) {
    alert(t('alert.invalidConfig'));
    return;
  }

  // Kontrola prázdné konfigurace (žádný segment, rameno ani MONO obsah) musí
  // proběhnout NAD SUROVÝMI poli konfigurace (config.segmentsA/B, config.arms,
  // config.mono.herdblok*/podestavby*), ne nad už sanitizovanými — sanitizace
  // segmentů níže (sanitizeSegment → getCatalogEntry) totiž potřebuje mít
  // katalog z importu už sloučený (viz importCatalog níže), a to sloučení
  // smí proběhnout až PO týhle kontrole: odmítnutý soubor (return) tak
  // nezanechá žádnou stopu v katalogu uživatele ani v localStorage. Pole,
  // která nejsou pole (chybí/jsou cizího typu), se počítají jako 0 prvků.
  // Pozn.: soubor s neprázdnými poli, ale se všemi prvky nepoužitelnými (po
  // sanitizaci níže samé null), touhle kontrolou projde a katalog se sloučí,
  // i když nakonec nevznikne žádný segment — neškodné, řešit to netřeba.
  const rawSegmentsACount = Array.isArray(rawSegmentsA) ? rawSegmentsA.length : 0;
  const rawSegmentsBCount = Array.isArray(rawSegmentsB) ? rawSegmentsB.length : 0;
  const rawArmsCount = Array.isArray(config.arms) ? config.arms.length : 0;
  // §ÚKOL MONO §10 — MONO projekt typicky nemá žádný segment/rameno (ty patří
  // SEGMENTu), ale klidně obsazený herdblok/řadu podestaveb. Bez týhle
  // podmínky by takový validní MONO soubor spadl do „prázdná konfigurace" a
  // dostal alert.emptyConfig, přestože §0 zadání říká, že se soubor kvůli
  // obsahu nikdy neodmítá. §ÚKOL MONO OSTROV — počítá se napříč OBĚMA
  // stranami (A+B), jinak by soubor s obsahem jen na straně B (ostrov, kde
  // uživatel začal editovat od strany B) omylem spadl do „prázdná
  // konfigurace".
  const rawMonoHerdblokCount = rawHerdblokA.length + rawHerdblokB.length;
  const rawMonoPodestavbyCount = rawPodestavbyA.length + rawPodestavbyB.length;
  if (rawSegmentsACount === 0 && rawSegmentsBCount === 0 && rawArmsCount === 0
      && rawMonoHerdblokCount === 0 && rawMonoPodestavbyCount === 0) {
    alert(t('alert.emptyConfig'));
    return;
  }

  // §ÚKOL A — typ bloku (§ROZHRANÍ): tolerantní validace, žádné odmítnutí
  // souboru (na rozdíl od kontrol výše) — neplatná/chybějící hodnota prostě
  // spadne na výchozí 'segment'. Musí se ale spočítat TADY, ve stejné fázi
  // jako kontroly výše a PŘED sloučením katalogu z importu níže — pořadí
  // kontrol/sloučení je opravená chyba (odmítnutý soubor nesmí zanechat
  // stopu v katalogu) a nesmí se rozbít vsunutím dalšího kroku doprostřed.
  const productType = config.productType === 'mono' ? 'mono' : 'segment';

  // §ÚKOL MONO — stejné pravidlo/stejná fáze jako productType výše: tolerantní
  // validace, žádné odmítnutí souboru. Chybějící/neplatná hodnota (nebo
  // úplně chybějící config.mono u starších/cizích souborů) spadne na výchozí
  // 'svislaDeska' na obou koncích (SDÍLENÉ pro obě strany, §ÚKOL MONO OSTROV
  // se jich netýká). herdblok*/podestavby*/panelItems*/limec se doplní NÍŽ,
  // až po sloučení katalogu z importu (viz komentář tam).
  const monoConfig = {
    leftEndType: sanitizeMonoEndType(rawMono.leftEndType),
    rightEndType: sanitizeMonoEndType(rawMono.rightEndType),
  };

  // katalog z importu (pokud existuje) sloučit až TEĎ — po všech kontrolách
  // výše, které mohly vést k odmítnutí souboru (return), ale PŘED sanitizací
  // segmentů hned pod tímto blokem. sanitizeSegment() hledá definici
  // přístroje přes getCatalogEntry(raw.type) — bez sloučeného katalogu by
  // u přístroje, který uživatel v katalogu nemá, vyšla `def` undefined a
  // segmentu by se vůbec nenastavilo widthMM/bodyStyle ani rozměry vany
  // u dřezu (uložená šířka by se ztratila, segment by se po sestavení
  // vykreslil v katalogové výchozí šířce).
  if (Array.isArray(config.catalog)) {
    importCatalog(config.catalog);
  }

  const segmentsA = (Array.isArray(rawSegmentsA) ? rawSegmentsA : []).map(sanitizeSegment).filter(Boolean);
  const segmentsB = (Array.isArray(rawSegmentsB) ? rawSegmentsB : []).map(sanitizeSegment).filter(Boolean);

  // §ÚKOL MONO §10 — herdblok může odkazovat na katalogové přístroje
  // (MonoDevice.type = klíč katalogu, viz sanitizeMonoDevice), proto se
  // sanitizuje AŽ TEĎ, po sloučení katalogu z importu výše — stejný důvod
  // jako u segmentsA/B. Chybějící seznam = prázdné pole, chybějící limec =
  // výchozí objekt (defaultMonoCollar) — starý soubor verze 4/5 nemá žádné
  // z těchto polí (nebo je má bez přípony A/B, viz rawHerdblokA/
  // rawPodestavbyA/rawPanelItemsA výše) a musí se přesto načíst beze chyby.
  // §ÚKOL MONO OSTROV — OBĚ strany (A i B) se musí projít sanitizací, i když
  // je strana B typicky prázdná (u staršího souboru vždy) — jinak by
  // položky strany B tiše zmizely A nextId by se za ně neposunul (viz
  // komentář u CONFIG_VERSION/sanitizeMonoDevice výše).
  monoConfig.herdblokA = rawHerdblokA.map(sanitizeMonoDevice).filter(Boolean);
  monoConfig.herdblokB = rawHerdblokB.map(sanitizeMonoDevice).filter(Boolean);
  monoConfig.podestavbyA = rawPodestavbyA.map(sanitizeMonoCabinet).filter(Boolean);
  monoConfig.podestavbyB = rawPodestavbyB.map(sanitizeMonoCabinet).filter(Boolean);
  monoConfig.panelItemsA = rawPanelItemsA.map(sanitizeMonoPanelItem).filter(Boolean);
  monoConfig.panelItemsB = rawPanelItemsB.map(sanitizeMonoPanelItem).filter(Boolean);
  monoConfig.limec = sanitizeMonoCollar(rawMono.limec);

  const arms = Array.isArray(config.arms)
    ? config.arms.filter((a) => a && typeof a === 'object').map((a) => {
        // offsetMM smí platně být 0 (viz ARM_BACK_OFFSET_MIN) — proto `!= null`,
        // ne `||`, ať výchozí hodnota nahradí jen chybějící pole, ne legitimně
        // uloženou nulu.
        const rawOffset = a.offsetMM != null ? Number(a.offsetMM) : ARM_BACK_OFFSET_DEFAULT;
        return {
          id: nextId++,
          positionXMM: Number(a.positionXMM) || 0,
          // přesně dle varianty doklampuje až block.js při stavbě; zde jen hrubé meze
          offsetMM: clamp(Math.round(rawOffset), ARM_CENTER_OFFSET_MIN, ARM_BACK_OFFSET_MAX),
          angleDeg: clamp(Number(a.angleDeg) || 0, ARM_ANGLE_MIN, ARM_ANGLE_MAX),
        };
      })
    : [];

  const d = config.dimensions || {};
  const lengthMM = clamp(Number(d.lengthMM) || 3200, LENGTH_MIN, LENGTH_MAX);
  const depthAMM = clamp(Number(d.depthAMM) || 850, DEPTH_MIN, DEPTH_MAX);
  const depthBMM = clamp(Number(d.depthBMM) || 850, DEPTH_MIN, DEPTH_MAX);
  const heightMM = clamp(Number(d.heightMM) || 900, HEIGHT_MIN, HEIGHT_MAX);

  state.dimensions = { lengthMM, depthAMM, depthBMM, heightMM };
  state.segmentsA = segmentsA;
  state.segmentsB = segmentsB;
  state.arms = arms;
  state.variant = config.variant === 'island' ? 'island' : 'single';
  state.environment = config.environment === 'dark' ? 'dark' : 'light';
  // starší uložené soubory pole projectName nemají — musí se otevřít bez chyby (§4.4 zadání)
  state.projectName = typeof config.projectName === 'string' ? config.projectName.slice(0, 60) : '';
  state.productType = productType; // §ÚKOL A — spočítáno výše, PŘED sloučením katalogu
  state.mono = monoConfig; // §ÚKOL MONO — spočítáno výše, stejná fáze jako productType
  state.selectedId = null;

  floorMesh.material = createFloorMaterial(state.environment === 'dark');
  // §ÚKOL MONO — OPRAVA POŘADÍ (nalezeno při ověřování v prohlížeči):
  // ui.setProductType() musí proběhnout PŘED rebuildBlock(). ui.js si typ
  // bloku drží jako VLASTNÍ kopii (`currentProductType`, viz ui.js) a
  // renderStrip() — volané uvnitř rebuildBlock() přes ui.render(state) —
  // se podle NÍ větví, ne podle state.productType. Při opačném pořadí by po
  // načtení MONO souboru odznak typu bloku sice hlásil ALBA MONO, ale spodní
  // pás by ještě jedno překreslení zůstal segmentový (#mono-strip-body
  // skrytý, třída .strip-mono neaktivní) — srovnalo by se to samo až při
  // dalším rebuildBlock(), takže šlo čistě o chybu pořadí volání.
  ui.setProductType(state.productType); // §ROZHRANÍ proti ui.js — po načtení souboru
  rebuildBlock();
  // §9 SPEC v4 — načtení konfigurace ze souboru/prohlížeče je jedno
  // z povolených míst pro přerámování kamery.
  reframeCamera();
  hasUnsavedChanges = false; // §ÚKOL C — čerstvě načtený soubor = žádné neuložené změny
}

function loadConfigFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    // §Parsování uvnitř try/catch — hláška se týká pouze neplatného JSONu.
    // applyConfig() se volá až za blokem, takže neplatná konfigurace
    // (vyhozená z applyConfig) neuteče a zůstane viditelná v konzoli.
    let config;
    try {
      config = JSON.parse(String(reader.result));
    } catch (err) {
      alert(t('alert.invalidJSONFile'));
      console.error(err);
      return;
    }
    applyConfig(config);
  };
  reader.readAsText(file);
}

// §ÚKOL B/C — ukládání konfigurace do prohlížeče je zrušené, takže dnes není
// nikdy co při startu obnovit. Schválně jako FUNKCE (ne natvrdo `null`) — až
// se jednou doplní autosave (jiné úložiště než zrušený localStorage klíč
// konfigurace), stačí upravit tělo této funkce a chování na startu (viz
// inicializace na konci souboru) se změní samo.
function getStoredConfig() {
  return null;
}

// --- dialog vlastního modulu ------------------------------------------------------

const customDialog = setupCustomDialog();

// --- správce přístrojů (SPEC v3 §3.4) — po každé změně katalogu (viditelnost,
// uložení, duplikace, smazání) překreslí boční panel, ať se sekce „Přidat
// segment" ihned zohlední aktuální katalog. ------------------------------------
const deviceManager = setupDeviceManager(() => ui.render(state));

// --- tiskový dokument (report.js) nad 3D viewportem (§ČÁST 2) — čerpá aktuální
// stav přímo ze `state`; `buildContent` spojuje report.js s kresbou půdorysu
// (floorplan.js) a s náhledy 3D scény (renderReportPreviews výše — main.js má
// přístup ke `scene`, floorplan.js/report.js ne). `onOpenChange` drží stav
// otevřenosti v `state.floorplanOpen` v sync (§1A — aktivní vzhled
// #floorplan-btn v liště), ať k zavření došlo tlačítkem, klávesou Escape,
// nebo kliknutím mimo dokument.
const floorplan = setupFloorplan({
  getState: () => state,
  buildContent: (s) => buildReport({
    state: s,
    floorplanSvg: buildFloorplanSVG(s),
    previews: renderReportPreviews(),
  }),
  onOpenChange: (isOpen) => {
    state.floorplanOpen = isOpen;
    ui.render(state);
  },
});

// --- napojení bočního panelu -----------------------------------------------------

const ui = setupUI({
  onProjectNameChange(name) {
    state.projectName = String(name || '').slice(0, 60);
    markUnsavedChanges(); // §ÚKOL C — mění se ukládané pole, ale rebuildBlock() se nevolá (viz níže)
    ui.render(state);
    // pozn.: rebuildBlock() se NEVOLÁ — název projektu nemá vliv na geometrii.
  },
  onDimensionsChange(partial) {
    if (partial.lengthMM !== undefined) {
      state.dimensions.lengthMM = clamp(Math.round(partial.lengthMM / LENGTH_STEP) * LENGTH_STEP, LENGTH_MIN, LENGTH_MAX);
    }
    if (partial.depthAMM !== undefined) {
      state.dimensions.depthAMM = clamp(Math.round(partial.depthAMM / DEPTH_STEP) * DEPTH_STEP, DEPTH_MIN, DEPTH_MAX);
    }
    if (partial.depthBMM !== undefined) {
      state.dimensions.depthBMM = clamp(Math.round(partial.depthBMM / DEPTH_STEP) * DEPTH_STEP, DEPTH_MIN, DEPTH_MAX);
    }
    if (partial.heightMM !== undefined) {
      state.dimensions.heightMM = clamp(Math.round(partial.heightMM / HEIGHT_STEP) * HEIGHT_STEP, HEIGHT_MIN, HEIGHT_MAX);
    }
    rebuildBlock();
  },
  onVariantChange(variant) {
    state.variant = variant;
    // přepínač strany A/B je jen u ostrova — u jednostranného je strana
    // vždy A (viz spodní panel v liště, side-switch se u single skryje)
    if (variant !== 'island') {
      state.currentSide = 'A';
      state.editSide = 'A';
    }
    rebuildBlock();
  },

  onAddInstrument(side, type) {
    getSideList(side).push(createCatalogSegment(type));
    rebuildBlock();
  },
  onAddNeutral(side) {
    getSideList(side).push({
      id: nextId++,
      type: NEUTRAL_TYPE,
      widthMM: 400,
      podestavba: 'doors',
      hasPanel: false,
      hasShelf: false,
      plinth: DEFAULT_PLINTH,
      finish: DEFAULT_FINISH,
    });
    rebuildBlock();
  },
  onAddDrawers(side) {
    getSideList(side).push({
      id: nextId++,
      type: DRAWERS_TYPE,
      widthMM: DRAWERS_WIDTH_MM,
      hasPanel: false,
      drawerCount: DEFAULT_DRAWER_COUNT,
      plinth: DEFAULT_PLINTH,
      finish: DEFAULT_FINISH,
    });
    rebuildBlock();
  },
  onOpenCustomNew(side) {
    customDialog.open(null, (result) => {
      getSideList(side).push({
        id: nextId++, type: CUSTOM_TYPE, plinth: DEFAULT_PLINTH, finish: DEFAULT_FINISH, ...result,
      });
      rebuildBlock();
    });
  },
  onEditCustom(id) {
    const found = findSegment(id);
    if (!found) return;
    customDialog.open(found.seg, (result) => {
      Object.assign(found.seg, result);
      rebuildBlock();
    });
  },
  onRemoveSegment(id) {
    state.segmentsA = state.segmentsA.filter((s) => s.id !== id);
    state.segmentsB = state.segmentsB.filter((s) => s.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    rebuildBlock();
  },
  onMoveSegment(id, dir) {
    const found = findSegment(id);
    if (!found) return;
    const list = getSideList(found.side);
    const idx = list.findIndex((s) => s.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(newIdx, 0, item);
    rebuildBlock();
  },
  onSelectSegment(id) {
    state.selectedId = state.selectedId === id ? null : id;
    updateSelectionHighlight();
    ui.render(state);
  },
  onNeutralWidthChange(id, widthMM) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.widthMM = clamp(Math.round(widthMM / NEUTRAL_WIDTH_STEP) * NEUTRAL_WIDTH_STEP, NEUTRAL_WIDTH_MIN, NEUTRAL_WIDTH_MAX);
    rebuildBlock();
  },
  onNeutralPodestavbaChange(id, style) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.podestavba = style === 'open' ? 'open' : 'doors';
    rebuildBlock();
  },
  onNeutralPanelChange(id, hasPanel) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.hasPanel = !!hasPanel;
    rebuildBlock();
  },
  onNeutralShelfChange(id, hasShelf) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.hasShelf = !!hasShelf;
    rebuildBlock();
  },
  onDrawersPanelChange(id, hasPanel) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.hasPanel = !!hasPanel;
    // s panelem je počet zásuvek vždy pevně 2 (viz getSegmentDrawerCount)
    if (found.seg.hasPanel) found.seg.drawerCount = 2;
    rebuildBlock();
  },
  onDrawersCountChange(id, drawerCount) {
    const found = findSegment(id);
    if (!found) return;
    if (found.seg.hasPanel) return; // s panelem se počet nenabízí (vždy 2)
    found.seg.drawerCount = DRAWER_COUNT_OPTIONS.includes(Number(drawerCount)) ? Number(drawerCount) : DEFAULT_DRAWER_COUNT;
    rebuildBlock();
  },
  onCatalogWidthChange(id, widthMM) {
    const found = findSegment(id);
    if (!found) return;
    const def = getCatalogEntry(found.seg.type);
    if (!def) return;
    const minWidth = found.seg.vatWidthMM ? found.seg.vatWidthMM + SINK_WIDTH_MARGIN_MM : def.minWidthMM;
    found.seg.widthMM = clamp(Math.round(widthMM), minWidth, CATALOG_WIDTH_MAX);
    rebuildBlock();
  },
  onCatalogBodyStyleChange(id, bodyStyle) {
    // §10.2 SPEC v4 — styl podestavby instance, omezený na povolené typy
    // katalogového přístroje (def.allowedBodyStyles)
    const found = findSegment(id);
    if (!found) return;
    const def = getCatalogEntry(found.seg.type);
    if (!def) return;
    found.seg.bodyStyle = sanitizeBodyStyle(def, bodyStyle);
    rebuildBlock();
  },
  onSegmentPlinthChange(id, plinth) {
    // §11.2 SPEC v4 — provedení soklu (nožičky / stavební / konstrukční)
    const found = findSegment(id);
    if (!found) return;
    found.seg.plinth = sanitizePlinth(plinth);
    rebuildBlock();
  },
  onSegmentFinishChange(id, finish) {
    // §11.2 SPEC v4 — povrchové provedení (HS+ / H1 / H2 / H3)
    const found = findSegment(id);
    if (!found) return;
    found.seg.finish = sanitizeFinish(finish);
    rebuildBlock();
  },
  onSinkVatWidthChange(id, vatWidthMM) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.vatWidthMM = clamp(Math.round(vatWidthMM), SINK_VAT_WIDTH_MIN, SINK_VAT_WIDTH_MAX);
    const minWidth = found.seg.vatWidthMM + SINK_WIDTH_MARGIN_MM;
    if (!found.seg.widthMM || found.seg.widthMM < minWidth) {
      found.seg.widthMM = Math.min(minWidth, CATALOG_WIDTH_MAX);
    }
    rebuildBlock();
  },
  onSinkVatDepthChange(id, vatDepthMM) {
    const found = findSegment(id);
    if (!found) return;
    found.seg.vatDepthMM = clamp(Math.round(vatDepthMM), SINK_VAT_DEPTH_MIN, SINK_VAT_DEPTH_MAX);
    rebuildBlock();
  },

  onAddArm() {
    const isIsland = state.variant === 'island';
    state.arms.push({
      id: nextId++,
      positionXMM: Math.round(state.builtDimensions.lengthMM / 2 / 10) * 10,
      offsetMM: isIsland ? ARM_CENTER_OFFSET_DEFAULT : ARM_BACK_OFFSET_DEFAULT,
      angleDeg: 0,
    });
    rebuildBlock();
  },
  onRemoveArm(id) {
    state.arms = state.arms.filter((a) => a.id !== id);
    rebuildBlock();
  },
  onArmPositionChange(id, positionXMM) {
    // volá se průběžně z posuvníku/inputu — přestavuje jen 3D scénu, aby
    // se neposunulo focus/tažení posuvníku v bočním panelu.
    const arm = state.arms.find((a) => a.id === id);
    if (!arm) return;
    arm.positionXMM = clamp(positionXMM, 0, state.dimensions.lengthMM);
    rebuildScene();
  },
  onArmOffsetChange(id, offsetMM) {
    const arm = state.arms.find((a) => a.id === id);
    if (!arm) return;
    const isIsland = state.variant === 'island';
    const min = isIsland ? ARM_CENTER_OFFSET_MIN : ARM_BACK_OFFSET_MIN;
    const max = isIsland ? ARM_CENTER_OFFSET_MAX : ARM_BACK_OFFSET_MAX;
    arm.offsetMM = clamp(Math.round(offsetMM), min, max);
    rebuildScene();
  },
  onArmAngleChange(id, angleDeg) {
    // volá se průběžně z posuvníku úhlu — jen 3D scéna (viz výše).
    const arm = state.arms.find((a) => a.id === id);
    if (!arm) return;
    arm.angleDeg = clamp(angleDeg, ARM_ANGLE_MIN, ARM_ANGLE_MAX);
    rebuildScene();
  },

  // §ÚKOL MONO §4 (balík A5) — callbacky spodního pásu ALBA MONO, jména a
  // počet přesně podle ZADANI-MONO-UI.md §4 (9 callbacků). CHYBĚLY ÚPLNĚ —
  // ui.js/mono-ui.js na ně volá přes `callbacks.onMonoXxx?.(...)` (viz
  // ui.js getMonoStrip/renderMonoPaletteList), takže bez nich by KAŽDÁ
  // akce v pásu MONO byla tiché no-op (optional chaining nespadne, ale nic
  // se nestane). Záložka 'arms' NEMÁ vlastní callbacky — používá existující
  // onAddArm/onRemoveArm/onArmPositionChange/onArmOffsetChange/
  // onArmAngleChange výše (§4 zadání: „nezakládat pro ně nové").
  //
  // Polohy si žádný z nich nepočítá sám — kde je potřebují (onMonoFillPodestavby,
  // onMonoAdd('panel', …)), čtou je z computeMonoLayout(state, side) (viz
  // komentář u importu computeMonoLayout na začátku souboru a §2 zadání).
  // Nové položky se sanitizují přes STEJNÉ funkce jako při načtení souboru
  // (sanitizeMonoDevice/sanitizeMonoCabinet/sanitizeMonoPanelItem/
  // sanitizeMonoCollar) — jediná definice pravidel, žádná duplikace.
  //
  // §ÚKOL MONO OSTROV — onMonoAdd/onMonoRemove/onMonoUpdate/onMonoMove/
  // onMonoSelect/onMonoFillPodestavby teď umí i STRANU (A/B), viz
  // state.mono.herdblokA/B apod. výše. `side` je u KAŽDÉHO z nich POSLEDNÍ
  // parametr s výchozí hodnotou 'A' — vždy AŽ ZA layer/id/kind/patch/dir, ne
  // před ně ani mezi ně. Důvod: výchozí hodnota parametru v JS se použije,
  // jen když volající argument NEPŘEDÁ VŮBEC (chybí na konci seznamu
  // argumentů) — kdyby `side` stálo dřív, dnešní volání z mono-ui.js
  // (onMonoAdd('herdblok', kind), onMonoUpdate('podestavby', id, patch)…,
  // vždy BEZ strany) by se posunula o jednu pozici a poslední skutečně
  // předaný argument (kind/patch/dir) by omylem přistál v `side` — funkce by
  // dostala nesmyslnou hodnotu tam, kde ji dnes vůbec nečeká. Trailing
  // pozice je jediná, která nechá VŠECHNA dnešní volání bez třetího/čtvrtého
  // argumentu fungovat úplně beze změny, a zároveň dá agentovi od pásu
  // jednotné místo, kam stranu doplnit ve všech šesti handlerech stejně.
  onMonoEndTypeChange(side, endType) {
    // POZOR: tohle `side` je 'left'|'right' (strana ZAKONČENÍ bloku), NE
    // strana ostrova (A/B) — leftEndType/rightEndType jsou SDÍLENÉ pole
    // (viz state.mono výše), tenhle handler proto novou stranu ostrova
    // nedostává a nepotřebuje.
    const value = sanitizeMonoEndType(endType);
    if (side === 'right') state.mono.rightEndType = value;
    else state.mono.leftEndType = value;
    rebuildBlock();
  },
  onMonoAdd(layer, kind, side = 'A') {
    // VADA (nahlásil zadavatel) — „Skříňky se přidávají zprava místo zleva.
    // Je to nepřirozené." computeMonoLayout (mono-layout.js, layoutSequential)
    // klade herdblok/podestavby KUMULATIVNĚ v POŘADÍ POLE od x=0, resp. od
    // sideInsetMM(leftEndType), doprava — první prvek pole = nejlevější
    // pozice na dráze, poslední prvek pole = pozice těsně před volnou/
    // chybějící plochou vpravo. `push()` (dřívější kód) řadí novou položku
    // na KONEC pole, takže skončí úplně vpravo, za všemi už přidanými —
    // OPRAVA OPRAVY (zadavatel, 5. 8. večer): předchozí pokus tuhle vadu
    // „opravil" změnou na `unshift()`, tedy přidáváním na ZAČÁTEK pole. To
    // bylo špatně a zadavatel to odmítl: „nové položky by se neměly přidávat
    // na začátek, ale na konec řady. Takto je to neintuitivní." Při unshift
    // totiž platí, že když uživatel přidá postupně A, B, C, uvidí je v pásu
    // jako C, B, A — v obráceném pořadí, než je zadával.
    //
    // Skutečná příčina původního hlášení „přidávají se zprava" NEBYLA v
    // pořadí pole, ale v tom, že 3D scéna má oproti pásu PŘEVRÁCENOU osu X
    // (viz PREDANI-2026-08-05-VECER.md §10) — v pásu položka přibývala
    // vpravo správně, ale ve 3D se objevila na opačné straně bloku.
    // Přidávání na konec (`push`) je tedy správné a zůstává.
    //
    // POZOR — tohle NEPLATÍ pro onMonoFillPodestavby() níže: „Doplnit" cíleně
    // zaplňuje missingMM na KONCI použitelného rozsahu (zbytek řady vpravo od
    // poslední položky), takže tam zůstává push (přidání na konec pole =
    // přesně tam, kde chybějící úsek je).
    const list = getMonoList(layer, side);
    if (!list) return; // neznámá vrstva — tiché no-op, žádný pád (stejné pravidlo jako jinde v MONO)
    if (layer === 'herdblok') {
      list.push(sanitizeMonoDevice({ type: kind }));
    } else if (layer === 'podestavby') {
      list.push(sanitizeMonoCabinet({ kind }));
    } else if (layer === 'panel') {
      // §2 zadání — panelItems jsou POLOHY, ne pořadí („polohy, ne pořadí"
      // v §1 zadání) — computeMonoLayout je nekumuluje podle indexu v poli,
      // takže push/unshift tu na výsledné vykreslení nemá žádný vliv; push
      // necháván jako neutrální/výchozí volba. Nová poloha se ČTE z
      // computeMonoLayout PRO STEJNOU STRANU (usableFromMM je vždy uvnitř
      // použitelného rozsahu panelu té strany), nedopočítává se ručně.
      const layout = computeMonoLayout(state, side === 'B' ? 'B' : 'A');
      list.push(sanitizeMonoPanelItem({ kind, xMM: layout.usableFromMM }));
    }
    rebuildBlock();
  },
  onMonoRemove(layer, id, side = 'A') {
    const list = getMonoList(layer, side);
    if (!list) return;
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return;
    list.splice(idx, 1);
    rebuildBlock();
  },
  onMonoUpdate(layer, id, patch, side = 'A') {
    // patch = „dílčí objekt polí" (§4 zadání) — stejný vzorec jako
    // onEditCustom výše (Object.assign nad nalezenou položkou); jednotlivé
    // hodnoty validuje vstupní prvek v mono-ui.js (rozsahy posuvníků/
    // číselníků), stejně jako custom-dialog.js validuje výsledek pro
    // onEditCustom, než ho sem main.js dostane.
    const item = findMonoItem(layer, id, side);
    if (!item || !patch || typeof patch !== 'object') return;
    Object.assign(item, patch);
    rebuildBlock();
  },
  onMonoMove(layer, id, dir, side = 'A') {
    // dir: -1 | +1, jen 'herdblok'/'podestavby' (§4 zadání) — stejný vzorec
    // jako onMoveSegment výše.
    const list = layer === 'herdblok' || layer === 'podestavby' ? getMonoList(layer, side) : null;
    if (!list) return;
    const idx = list.findIndex((item) => item.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(newIdx, 0, item);
    rebuildBlock();
  },
  onMonoFillPodestavby(side = 'A') {
    // tlačítko „Doplnit" — dorovná řadu jednou skříňkou o šířce missingMM
    // (§4 zadání); missingMM se ČTE z computeMonoLayout PRO STEJNOU STRANU,
    // nedopočítává se tu.
    const s = side === 'B' ? 'B' : 'A';
    const layout = computeMonoLayout(state, s);
    if (layout.missingMM <= 0) return;
    getMonoList('podestavby', s).push(sanitizeMonoCabinet({ kind: 'cabinet', widthMM: layout.missingMM }));
    rebuildBlock();
  },
  onMonoCollarChange(patch) {
    // limec je SDÍLENÝ pro obě strany (§ÚKOL MONO OSTROV zadání), beze
    // změny — nedostává parametr `side`.
    state.mono.limec = sanitizeMonoCollar({ ...state.mono.limec, ...patch });
    rebuildBlock();
  },
  onMonoSelect(layer, id, side = 'A') {
    // §3 zadání — výběr (zvýraznění dlaždice) je VNITŘNÍ stav mono-ui.js
    // (`selected`), NENÍ součástí `state`; MONO navíc nemá ve 3D scéně žádné
    // vybíratelné prvky (mono-block.js: `selectable` je vždy prázdné pole,
    // přístroje se ve 3D nekreslí, §0 zadání). Handler tu je jen proto, aby
    // main.js odpovídal §4 zadání jménem i počtem callbacků — dnes žádná
    // stavová změna, žádný rebuildBlock(). `side` (výchozí 'A') je tu jen
    // pro konzistenci podpisu s ostatními handlery výše — dnešní prázdné
    // tělo ho nepoužívá.
  },
  onMonoTabChange(tab) {
    // §4/§8 zadání — aktivní záložka pásu je vlastní stav ui.js
    // (`monoActiveTab`, viz getMonoStrip/renderMonoPaletteList v ui.js),
    // NENÍ pole ve `state`. ui.js si callback nejdřív ukusuje pro sebe
    // (filtr palety) a teprve pak ho propouští sem — main.js na něj dnes
    // nemá co reagovat (viz PREDANI-2026-08-05-VECER.md §4).
  },

  onOpenDeviceManager() {
    deviceManager.open();
  },
  onToggleFloorplan() {
    // §1A — #floorplan-btn se chová jako přepínač (čtvrtý "pohled" ve
    // skupině): otevřený dokument opakovaným kliknutím zavře. Aktivní vzhled
    // tlačítka i sync `state.floorplanOpen` řeší onOpenChange výše.
    if (floorplan.isOpen()) {
      floorplan.close();
    } else {
      floorplan.open();
    }
  },

  onViewChange(name) {
    // §9 SPEC v4 — kliknutí na přednastavený pohled je jedno z povolených
    // míst pro přerámování kamery.
    state.currentViewName = name;
    // §1A — klik na kterýkoli pohled, je-li tiskový dokument otevřený, ho
    // zavře a přepne na daný pohled (dokument se chová jako čtvrtý pohled).
    if (floorplan.isOpen()) {
      floorplan.close();
    }
    reframeCamera();
    ui.render(state); // zvýraznění aktivního tlačítka pohledu (§1A)
  },
  onSideChange(side) {
    // Přepínač strany A/B (jen ostrovní blok) — je-li zrovna zobrazený pohled
    // perspektivy nebo čela, přesune kameru rovnou na odpovídající pohled
    // druhé strany (reframeCamera() vybere správnou definici přes
    // selectViewDef); u pohledu shora přepnutí strany kamerou OTOČÍ (mapuje
    // se na topB — viz selectViewDef a computeViews v viewer.js), takže se
    // i tam kamera přesune na odpovídající definici pohledu.
    state.currentSide = side === 'B' ? 'B' : 'A';
    reframeCamera();
    ui.render(state);
  },
  // Přepínač EDITOVANÉ strany (záložka A/B ve spodním pásu, výběr segmentu
  // v paletě/pásu apod.) — odděleně od pohledu kamery (viz onSideChange
  // výše). `opts.turnCamera` řídí, jestli se má kamera otočit na editovanou
  // stranu (klik na záložku ANO, následování výběru segmentu NE — kamera se
  // nesmí hnout jen kvůli tomu, že uživatel vybral segment na druhé straně).
  onEditSideChange(side, opts) {
    const next = side === 'B' ? 'B' : 'A';
    state.editSide = state.variant === 'island' ? next : 'A';
    if (opts && opts.turnCamera && state.variant === 'island') {
      // otočení kamery voláme přes onSideChange (téhož objektu) — zajišťuje
      // to i state.currentSide a překreslení, žádné kopírování těla.
      this.onSideChange(state.editSide);
    } else {
      ui.render(state);
    }
  },
  onEnvChange(mode) {
    state.environment = mode;
    markUnsavedChanges(); // §ÚKOL C — mění se ukládané pole, ale rebuildBlock() se nevolá
    floorMesh.material = createFloorMaterial(mode === 'dark');
    ui.render(state);
  },
  onExportPng() {
    exportPNG();
  },
  onSaveConfig() {
    saveConfig().catch((err) => console.error(err));
  },
  onLoadFile(file) {
    loadConfigFromFile(file);
  },
  // §ÚKOL B — tlačítko #load-storage-btn (načtení z prohlížeče) i jeho
  // obsluha odsud mizí spolu se zrušeným ukládáním do localStorage; DOM
  // stranu (samotné tlačítko v index.html) ruší druhý agent.

  // §ROZHRANÍ proti ui.js — úvodní obrazovka.
  onNewProject(type) {
    // vyprázdnění sestavy do výchozího stavu (stejné hodnoty jako při startu
    // aplikace — viz state výše a createDefaultSegmentsA)
    state.projectName = '';
    state.dimensions = { lengthMM: 3200, depthAMM: 850, depthBMM: 850, heightMM: 900 };
    state.segmentsA = createDefaultSegmentsA();
    state.segmentsB = [];
    state.arms = [];
    state.selectedId = null;
    state.productType = type === 'mono' ? 'mono' : 'segment';
    // §ÚKOL MONO — OPRAVA: reset na výchozí, stejně jako ostatní pole výše.
    // Dřívější verze tu zapomínala herdblok/podestavby/panelItems/limec —
    // po založení nového MONO projektu tak zůstávaly `undefined` a
    // serializeConfig() (state.mono.panelItems.map(...) apod.) na tom padala
    // TypeError hned při prvním pokusu o uložení. Stejné výchozí hodnoty jako
    // v `state.mono` na začátku souboru — proto tu použit defaultMonoCollar(),
    // ne ruční kopie objektu.
    //
    // PŘÁNÍ zadavatele (aktualizace §10 zadání — „Nový projekt MONO začíná
    // s prázdnými poli" platí dál pro herdblok/panelItems, ale UŽ NE pro
    // podestavby): řada podestaveb se předvyplní trojicí Skříňka 600 / volný
    // prostor 600 / Skříňka 600 (createDefaultMonoPodestavby výše), zbytek
    // řady zůstává záměrně nedoplněný a UI ho nahlásí jako „chybí N mm" —
    // stejně jako u ručně sestavené řady. Předvyplňuje se JEN pro
    // `type === 'mono'` — u nově založeného SEGMENT projektu by šlo o
    // zbytečné čerpání z nextId pro pole, které se u SEGMENTu nikdy
    // nezobrazí ani neuloží k ničemu užitečnému.
    //
    // §ÚKOL MONO OSTROV — rozhodnutí zadavatele: předvyplnění platí VÝHRADNĚ
    // pro stranu A (přesně dnešní chování, jen přejmenované pole). Strana B
    // začíná vždy prázdná, i u nově založeného ostrovního MONO projektu —
    // uživatel si ji naplní sám stejně jako prázdný SEGMENT ostrov
    // (segmentsB výše je taky []).
    state.mono = {
      leftEndType: 'svislaDeska',
      rightEndType: 'svislaDeska',
      herdblokA: [],
      herdblokB: [],
      podestavbyA: state.productType === 'mono' ? createDefaultMonoPodestavby() : [],
      podestavbyB: [],
      panelItemsA: [],
      panelItemsB: [],
      limec: defaultMonoCollar(),
    };

    // §ÚKOL MONO — OPRAVA POŘADÍ (stejná past jako v applyConfig výše):
    // ui.setProductType() musí proběhnout PŘED rebuildBlock(), jinak
    // renderStrip() uvnitř rebuildBlock() → ui.render(state) větví podle
    // STARÉHO currentProductType, který si ui.js drží ve vlastní closure, a
    // spodní pás by po založení MONO projektu zůstal segmentový, dokud by
    // nepřišlo další překreslení.
    ui.setProductType(state.productType);
    rebuildBlock();
    reframeCamera();
    hasUnsavedChanges = false; // §ÚKOL C — čerstvě založený projekt = žádné neuložené změny

    ui.hideStartScreen();
    // potvrzovací dotaz (rozpracovaná sestava se zahodí) řeší ui.js, tady se
    // už neptáme (viz zadání §ÚKOL A/rozhraní).
  },
  onRequestOpenFile() {
    loadFileInputEl.click();
  },
});

// --- výběr segmentu kliknutím ve 3D (raycaster) -------------------------------------

canvas.addEventListener('click', (event) => {
  const ndc = toNDC(event.clientX, event.clientY, canvas);
  raycaster.setFromCamera(ndc, camera);
  const picked = pickModuleAt(raycaster, blockGroup);
  state.selectedId = picked ? picked.userData.id : null;
  updateSelectionHighlight();
  ui.render(state);
});

// --- reakce na změnu velikosti viewportu -------------------------------------------

function handleResize() {
  const width = viewportEl.clientWidth;
  const height = viewportEl.clientHeight;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

const resizeObserver = new ResizeObserver(handleResize);
resizeObserver.observe(viewportEl);
handleResize();

// --- render smyčka ------------------------------------------------------------------

function animate() {
  requestAnimationFrame(animate);

  // pozn.: přechod mezi pohledy (animateView) řídí kameru/cíl ve VLASTNÍ
  // requestAnimationFrame smyčce ve viewer.js — tady se jen dál renderuje.
  controls.update();
  renderer.render(scene, camera);
}

// --- vícejazyčnost (§13 SPEC v4) -------------------------------------------------
// Přepnutí jazyka (vlaječkou v ui.js) musí ihned překreslit CELÉ UI beze
// zásahu do pohledu kamery: statické popisky v index.html (applyTranslations),
// boční panel + 3D popisky segmentů/vybraného segmentu (rebuildBlock — bez
// reframeCamera, viz §9) a otevřený půdorys (už součástí rebuildBlock).
onLangChange(() => {
  applyTranslations();
  // §ÚKOL C — přepnutí jazyka není stavová změna (jazyk se neukládá do
  // konfigurace), ale rebuildBlock() vevnitř rebuildScene() nastavuje
  // hasUnsavedChanges natvrdo (§9 SPEC v4 — reframeCamera se tu ani nevolá).
  // Příznak proto kolem přestavby zachováme, ať jen kvůli překreslení popisků
  // v jiném jazyce nevznikne falešný dotaz při zavírání okna.
  const wasDirty = hasUnsavedChanges;
  rebuildBlock();
  hasUnsavedChanges = wasDirty;
});

// --- inicializace ---------------------------------------------------------------

applyTranslations();
rebuildBlock();
// §9 SPEC v4 — první sestavení scény po načtení stránky je jedno z povolených
// míst pro přerámování kamery (firstBuild=true uvnitř reframeCamera zajistí
// okamžité nastavení bez animace).
reframeCamera();
hasUnsavedChanges = false; // §ÚKOL C — výchozí sestava při startu není „neuložená změna"
animate();

// §ÚKOL A/ROZHRANÍ proti ui.js — start screen. getStoredConfig() dnes vrací
// vždy null (ukládání do prohlížeče je zrušené, viz §ÚKOL B), takže se úvodní
// obrazovka zobrazí při každém startu. Schválně jako podmínka nad funkcí, ne
// natvrdo — až se jednou doplní autosave, zapne se přeskočení start screen
// samo, beze změny na tomto řádku.
if (!getStoredConfig()) {
  ui.showStartScreen();
}

// §ÚKOL C — dotaz při zavření/reloadu okna, jen když existují neuložené
// změny A sestava není prázdná (žádný segment na žádné straně, žádné
// rameno) — prázdnou sestavu nemá smysl „zachraňovat".
window.addEventListener('beforeunload', (event) => {
  const isEmpty = state.segmentsA.length === 0 && state.segmentsB.length === 0 && state.arms.length === 0;
  if (!hasUnsavedChanges || isEmpty) return;
  event.preventDefault();
  // moderní prohlížeče vlastní text stejně nezobrazí (ukazují svůj vlastní),
  // ale returnValue musí být nastaven, ať se dialog vůbec objeví; i18n klíč
  // držíme napojený pro případ prohlížečů, které text respektují.
  event.returnValue = t('alert.unsavedChanges');
});
