// main.js — bootstrap aplikace: scéna, renderer, světla, podlaha, render smyčka
// a propojení stavu aplikace s bočním panelem (ui.js), dialogem vlastního
// modulu (custom-dialog.js) a 3D scénou (block.js/arms.js). SPEC v3.

import * as THREE from 'three';
import { setupEnvironment, createFloorMaterial, createBackgroundTexture } from './materials.js';
import { buildBlock } from './block.js';
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
import { setupUI, STORAGE_KEY } from './ui.js';
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

// --- stav aplikace -----------------------------------------------------------

let nextId = 1;
const state = {
  dimensions: { lengthMM: 3200, depthAMM: 850, depthBMM: 850, heightMM: 900 },
  variant: 'single', // 'single' | 'island'
  segmentsA: [],
  segmentsB: [], // jen 'island' — nezávislý seznam, žádné zrcadlení strany A
  arms: [],
  selectedId: null,
  environment: 'light', // 'light' | 'dark' — barva podlahy
  currentViewName: 'perspective',
  // Strana bloku, na kterou se aktuálně dívá kamera (jen 'island' — přepínač
  // A/B v liště). Čistě dočasný stav pohledu, NEUKLÁDÁ se do konfigurace ani
  // do localStorage (viz serializeConfig/applyConfig — nesahají na toto pole).
  currentSide: 'A', // 'A' | 'B'
  // §1A — je-li tiskový dokument (report.js) otevřený nad 3D viewportem;
  // #floorplan-btn se v liště chová jako čtvrtý "pohled" (viz ui.js render).
  // Čistě dočasný stav, stejně jako currentSide — NEUKLÁDÁ se do konfigurace.
  floorplanOpen: false,
  builtDimensions: { lengthMM: 0, depthMM: 0, depthAMM: 0, depthBMM: 0, heightMM: 900 },
  capacityA: { usedMM: 0, capacityMM: 0, results: [] },
  capacityB: { usedMM: 0, capacityMM: 0, results: [] },
};

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
  if (blockGroup) {
    scene.remove(blockGroup);
    disposeGroup(blockGroup);
  }

  const dims = { ...state.dimensions, variant: state.variant };
  const result = buildBlock(state.segmentsA, state.segmentsB, state.arms, dims);
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

function serializeConfig() {
  return {
    version: 3,
    variant: state.variant,
    environment: state.environment,
    dimensions: { ...state.dimensions },
    segmentsA: state.segmentsA.map((s) => ({ ...s })),
    segmentsB: state.segmentsB.map((s) => ({ ...s })),
    arms: state.arms.map((a) => ({ ...a })),
    catalog: getCatalog(), // vlastní přístroje + viditelnost — jde přenést s konfigurací
  };
}

function saveConfig() {
  const json = JSON.stringify(serializeConfig(), null, 2);

  // 1) uložení do localStorage
  localStorage.setItem(STORAGE_KEY, json);

  // 2) stažení jako soubor
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t('export.jsonFilenamePrefix')}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  ui.render(state);
}

function sanitizeSegment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = nextId++;
  // §11.2 SPEC v4 — plinth/finish jsou INSTANCE pole u KAŽDÉHO segmentu;
  // chybějící/neplatná hodnota (starší export bez těchto polí) → výchozí.
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
    // zásuvek vynuceně 2; tolerantně přijme i starší/cizí konfiguraci bez
    // pole drawerCount (výchozí 2).
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
    // šířka je vlastnost INSTANCE (§7.1); starší konfigurace bez uloženého
    // widthMM (dřívější „nenastavitelné" přístroje) se tolerantně doplní na
    // výchozí hodnotu katalogu. Hloubka podestavby už NENÍ instance-level
    // pole (§11.1 SPEC v4 — zrušeno, odvozuje se z hloubky strany bloku).
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

  // starší v2 export měl jediné pole `segments` (jedna strana); v3 má
  // `segmentsA` / `segmentsB` — načítáme tolerantně podle toho, co je přítomné.
  const isV3 = Array.isArray(config.segmentsA) || Array.isArray(config.segmentsB);
  const rawSegmentsA = isV3 ? config.segmentsA : config.segments;
  const rawSegmentsB = isV3 ? config.segmentsB : null;

  if (!Array.isArray(rawSegmentsA) && !Array.isArray(rawSegmentsB) && !Array.isArray(config.arms)) {
    alert(t('alert.invalidConfig'));
    return;
  }

  // katalog z importu (pokud existuje) sloučit ještě PŘED sanitizací segmentů,
  // ať jsou dostupné definice vlastních přístrojů z importované sestavy
  if (Array.isArray(config.catalog)) {
    importCatalog(config.catalog);
  }

  const segmentsA = (Array.isArray(rawSegmentsA) ? rawSegmentsA : []).map(sanitizeSegment).filter(Boolean);
  const segmentsB = (Array.isArray(rawSegmentsB) ? rawSegmentsB : []).map(sanitizeSegment).filter(Boolean);

  const arms = Array.isArray(config.arms)
    ? config.arms.map((a) => {
        // v2 mělo `edge: 'front'|'back'` místo `offsetMM` — tolerantní výchozí hodnota
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

  if (segmentsA.length === 0 && segmentsB.length === 0 && arms.length === 0) {
    alert(t('alert.emptyConfig'));
    return;
  }

  const d = config.dimensions || {};
  const lengthMM = clamp(Number(d.lengthMM) || 3200, LENGTH_MIN, LENGTH_MAX);
  let depthAMM;
  let depthBMM;
  if (isV3) {
    depthAMM = clamp(Number(d.depthAMM) || 850, DEPTH_MIN, DEPTH_MAX);
    depthBMM = clamp(Number(d.depthBMM) || 850, DEPTH_MIN, DEPTH_MAX);
  } else {
    // v2: jediná hloubka (700/850/1000) — použije se pro obě strany
    const legacyDepth = Number(d.depthMM) || 850;
    depthAMM = clamp(legacyDepth, DEPTH_MIN, DEPTH_MAX);
    depthBMM = depthAMM;
  }
  const heightMM = clamp(Number(d.heightMM) || 900, HEIGHT_MIN, HEIGHT_MAX);

  state.dimensions = { lengthMM, depthAMM, depthBMM, heightMM };
  state.segmentsA = segmentsA;
  state.segmentsB = segmentsB;
  state.arms = arms;
  state.variant = config.variant === 'island' ? 'island' : 'single';
  state.environment = config.environment === 'dark' ? 'dark' : 'light';
  state.selectedId = null;

  floorMesh.material = createFloorMaterial(state.environment === 'dark');
  rebuildBlock();
  // §9 SPEC v4 — načtení konfigurace ze souboru/prohlížeče je jedno
  // z povolených míst pro přerámování kamery.
  reframeCamera();
}

function loadConfigFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyConfig(JSON.parse(String(reader.result)));
    } catch (err) {
      alert(t('alert.invalidJSONFile'));
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function loadConfigFromStorage() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return;
  try {
    applyConfig(JSON.parse(json));
  } catch (err) {
    alert(t('alert.loadStorageFailed'));
    console.error(err);
  }
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
    if (variant !== 'island') state.currentSide = 'A';
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
  onEnvChange(mode) {
    state.environment = mode;
    floorMesh.material = createFloorMaterial(mode === 'dark');
    ui.render(state);
  },
  onExportPng() {
    exportPNG();
  },
  onSaveConfig() {
    saveConfig();
  },
  onLoadFile(file) {
    loadConfigFromFile(file);
  },
  onLoadStorage() {
    loadConfigFromStorage();
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
  rebuildBlock();
});

// --- inicializace ---------------------------------------------------------------

applyTranslations();
rebuildBlock();
// §9 SPEC v4 — první sestavení scény po načtení stránky je jedno z povolených
// míst pro přerámování kamery (firstBuild=true uvnitř reframeCamera zajistí
// okamžité nastavení bez animace).
reframeCamera();
animate();
