// modules.js — tovární funkce pro stavbu jednotlivých SEGMENTŮ varného bloku
// (SPEC v3). Katalogové přístroje (§3.1–3.3) se čtou z catalog.js — zde je
// jen vykreslovací logika (podestavba + panel + ovládací prvky + typové
// detaily na desce), nikoli data katalogu samotná.
//
// PRŮBĚŽNÁ pracovní deska (jedna, přes celý blok) se staví v block.js. Zde se
// staví jen podestavby jednotlivých segmentů.
//
// Souřadný systém jednoho segmentu (lokální prostor skupiny):
//   x .. podél šířky segmentu, střed v x = 0
//   y .. nahoru, y = 0 je podlaha
//   z .. hloubka, z = 0 je čelo (přední strana směrem k obsluze/kameře)

import * as THREE from 'three';
import {
  createStainlessMaterial,
  createPanelMaterial,
  createPlinthMaterial,
  createKnobMaterial,
  createButtonMaterial,
  createSwitchMaterial,
  createCastIronMaterial,
  createGlassCeramicMaterial,
  createGlassMaterial,
  createRecessMaterial,
  createCavityMaterial,
  createSinkCavityMaterial,
  createChromeMaterial,
  createEdgeMaterial,
  createBitmapMaterial,
  createLogoMaterial,
  loadBitmapTexture,
} from './materials.js';
import { getById as getCatalogEntry, getEntryDisplayName } from './catalog.js';
import { t } from './i18n.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// --- Standardní rozměry (v metrech) -----------------------------------------
export const TOP_THICKNESS = 0.05; // tloušťka pracovní desky (50 mm)
export const PANEL_HEIGHT = 0.2; // výška čelního ovládacího panelu (200 mm)
// PLINTH_HEIGHT (dřív pevná 0,15 m / 150 mm) SE RUŠÍ. Výška soklu je od
// 31. 8. 2026 vlastnost CELÉHO BLOKU (ZADANI-SOKL.md), proměnná v rozsahu
// PLINTH_HEIGHT_MIN_MM..PLINTH_HEIGHT_MAX_MM (viz níž) — chodí jako
// parametr (v metrech) do buildPlinth()/createSegmentMesh()/createFillerMesh().

// --- Meze zadatelných rozměrů (mm) ------------------------------------------
export const LENGTH_MIN = 1200;
export const LENGTH_MAX = 6000;
export const LENGTH_STEP = 50;

export const DEPTH_MIN = 500;
export const DEPTH_MAX = 1200;
export const DEPTH_STEP = 10;

export const HEIGHT_MIN = 850;
export const HEIGHT_MAX = 950;
export const HEIGHT_STEP = 10;

export const NEUTRAL_WIDTH_MIN = 200;
export const NEUTRAL_WIDTH_MAX = 1200;
export const NEUTRAL_WIDTH_STEP = 50;

export const CUSTOM_WIDTH_MAX = 1200;
export const CUSTOM_CONTROLS_MAX = 8;

// katalogové přístroje s nastavitelnou šířkou podestavby (indukce, dřez)
export const CATALOG_WIDTH_MAX = 1200;
export const CATALOG_WIDTH_STEP = 50;

// dřez — rozměry vany jsou vlastností INSTANCE segmentu (ne katalogu)
export const SINK_VAT_WIDTH_MIN = 300;
export const SINK_VAT_WIDTH_MAX = 900;
export const SINK_VAT_WIDTH_STEP = 50;
export const SINK_VAT_WIDTH_DEFAULT = 500;
export const SINK_VAT_DEPTH_MIN = 300;
export const SINK_VAT_DEPTH_MAX = 700;
export const SINK_VAT_DEPTH_STEP = 50;
export const SINK_VAT_DEPTH_DEFAULT = 400;
// hloubka (výška) vany — zapuštěná dutina; není pole instance, vzhled dřezu
// je vždy stejný, jen šířka/hloubka vany jsou nastavitelné (viz výše).
export const SINK_VAT_HEIGHT_MM = 300;
// šířka podestavby dřezu musí být >= šířka vany + tato rezerva
export const SINK_WIDTH_MARGIN_MM = 100;

// §13 SPEC v4 — jen hodnoty (bez natvrdo psaného textu); popisek se získává
// přes t(`controlType.${value}`) / t(`bodyStyle.${value}`) / t(`plinth.${value}`)
// v místě použití (ui.js, device-manager.js, custom-dialog.js, floorplan.js),
// aby se select/label přeložily znovu při každém překreslení po přepnutí jazyka.
export const CONTROL_TYPES = ['knob', 'button', 'switch'];

// styly podestavby (§10.2 SPEC v4) — nabídka omezená katalogovým polem
// allowedBodyStyles daného přístroje
export const BODY_STYLE_OPTIONS = ['closed', 'doors', 'open'];

// provedení soklu / podestavby (§11.2 SPEC v4) — od 31. 8. 2026 (ZADANI-SOKL.md)
// je to VLASTNOST CELÉHO BLOKU, ne jednotlivé skříňky/segmentu (viz
// buildBlockPlinth() v block.js). INSTANCE pole `plinth` u skříňky/segmentu
// SE PRO KRESLENÍ PŘESTÁVÁ ČÍST — jen se tolerantně načte ze starých
// souborů projektu, nic nového se do něj neukládá.
// `legs_plinth` (NOVÁ, 4. hodnota) je nožičky + soklová zástěna, která je
// kryje — VYLUČOVACÍ volba, ne samostatný příznak (nejde mít zástěnu bez
// nožiček). Žádná stávající hodnota se nepřejmenovává.
export const PLINTH_TYPES = ['legs', 'building', 'construction', 'legs_plinth'];
export const DEFAULT_PLINTH = 'construction';

// výška soklové zóny (mm) — vlastnost CELÉHO BLOKU (state.plinth.heightMM);
// rozsah i výchozí hodnota platí pro OBA produkty (SEGMENT i MONO).
export const PLINTH_HEIGHT_MIN_MM = 50;
export const PLINTH_HEIGHT_MAX_MM = 150;
export const PLINTH_HEIGHT_DEFAULT_MM = 150;
// pracovní výška = BODY_STACK_MM + výška soklu (OBA produkty, ZADANI-SOKL.md
// bod 3) — dopočítává main.js, geometrie BODY_STACK_MM nepoužívá napřímo.
export const BODY_STACK_MM = 750;
// uskočení nerezového rámu/zástěny od líce bloku, ZE VŠECH STRAN
// (buildBlockPlinth v block.js).
export const PLINTH_INSET_MM = 50;

// povrchové provedení (§11.2 SPEC v4) — INSTANCE pole `finish`; jde o kódy
// (ne jazykový text), stejné ve všech jazycích — nepřekládá se.
// H3 se od úkolu 9a (PREDANI.md) nenabízí — zadavatel rozhodl škrtnout.
// Tento seznam je zdroj pravdy; duplicitní kopie je v mono-ui.js (ř. ~40),
// obě místa se MUSÍ měnit SPOLU. Staré projekty s uloženým finish:'H3'
// projdou beze změny — getSegmentFinish()/sanitizeFinish() (main.js) spadnou
// na DEFAULT_FINISH, soubor se neodmítá.
export const FINISH_TYPES = ['HS+', 'H1', 'H2'];
export const DEFAULT_FINISH = 'H1';

export const NEUTRAL_TYPE = 'neutral';
export const CUSTOM_TYPE = 'custom';

// --- Zásuvky GN 1/1 (samostatný typ segmentu, obdoba neutrálního modulu) ----
// Šířka je VŽDY pevná (400 mm, neměnná — bez pole pro šířku v UI). Volba
// s panelem/bez panelu je stejná jako u neutrálního modulu; s panelem je
// počet zásuvek pevně 2, bez panelu lze zvolit 2 nebo 3 (INSTANCE pole
// `drawerCount`). Zásuvky jsou dimenzované na gastronádoby GN 1/1 (530×325 mm).
export const DRAWERS_TYPE = 'drawers';
export const DRAWERS_WIDTH_MM = 400;
export const DRAWER_COUNT_OPTIONS = [2, 3];
export const DEFAULT_DRAWER_COUNT = 2;

/** Validovaný počet zásuvek (2 nebo 3), s panelem je vždy vynuceně 2. */
export function getSegmentDrawerCount(segment) {
  if (segment && segment.hasPanel) return 2;
  const v = Number(segment && segment.drawerCount);
  return DRAWER_COUNT_OPTIONS.includes(v) ? v : DEFAULT_DRAWER_COUNT;
}

/** Vrátí definici katalogového přístroje (nebo undefined) — viz catalog.js. */
export function getInstrumentDef(type) {
  return getCatalogEntry(type);
}

/** Validovaná hodnota INSTANCE pole `plinth` (§11.2), s výchozí hodnotou. */
export function getSegmentPlinth(segment) {
  const v = segment && segment.plinth;
  return PLINTH_TYPES.includes(v) ? v : DEFAULT_PLINTH;
}

/** Validovaná hodnota INSTANCE pole `finish` (§11.2), s výchozí hodnotou. */
export function getSegmentFinish(segment) {
  const v = segment && segment.finish;
  return FINISH_TYPES.includes(v) ? v : DEFAULT_FINISH;
}

/**
 * Efektivní styl podestavby segmentu (§10.2 SPEC v4) — JEDNA sdílená pravda
 * pro 3D náhled (createSegmentMesh níže) i pro výkres/tiskovou rozpisku
 * (floorplan.js/report.js), které dřív měly vlastní, ne úplně shodnou kopii
 * této logiky. Podle typu segmentu:
 *   - NEUTRAL_TYPE  — řídí INSTANCE pole `podestavba` (starší název ze
 *                     SPEC v3, zachováno kvůli zpětné kompatibilitě):
 *                     'open', jinak 'doors' (i pro chybějící hodnotu).
 *   - CUSTOM_TYPE   — vždy 'closed' (vlastní modul se ve 3D kreslí jako
 *                     uzavřený korpus, viz buildClosedBody v createSegmentMesh).
 *   - DRAWERS_TYPE  — vždy 'closed' (zásuvky mají vlastní kresbu i vlastní
 *                     větev v report.js, tato hodnota se tak fakticky nikde
 *                     nepoužije — jen ať funkce nevrací nesmysl).
 *   - katalogový přístroj — validuje instance.bodyStyle proti povoleným
 *                     stylům přístroje (def.allowedBodyStyles), jinak použije
 *                     první povolený.
 *   - neznámý typ (def v katalogu chybí) — 'closed'.
 *
 * VĚDOMÁ ZMĚNA CHOVÁNÍ: dřívější floorplan.js/getBodyStyle u katalogových
 * přístrojů instance.bodyStyle NEVALIDOVAL proti allowedBodyStyles — pokud
 * uživatel ve Správci přístrojů dodatečně zúžil povolené styly (např. dřezu
 * odebral „otevřená"), 3D náhled a tištěná rozpiska mohly u existujících
 * segmentů ukazovat RŮZNÝ styl podestavby. Teď je vždy platný ten, co ukazuje
 * 3D (tato funkce), shodně v obou dokumentech.
 */
export function getSegmentBodyStyle(segment) {
  if (!segment) return 'closed';
  if (segment.type === NEUTRAL_TYPE) return segment.podestavba === 'open' ? 'open' : 'doors';
  if (segment.type === CUSTOM_TYPE) return 'closed';
  if (segment.type === DRAWERS_TYPE) return 'closed';
  const def = getCatalogEntry(segment.type);
  if (!def) return 'closed';
  const allowed = Array.isArray(def.allowedBodyStyles) && def.allowedBodyStyles.length
    ? def.allowedBodyStyles
    : ['closed'];
  return allowed.includes(segment.bodyStyle) ? segment.bodyStyle : allowed[0];
}

/** Panel je u katalogových/vlastních přístrojů vždy přítomný (mají ovládací
 *  panel z podstaty věci); u neutrálního modulu je volitelný (INSTANCE pole
 *  `hasPanel`). Přesunuto z floorplan.js — čte i report.js (soupis dílů). */
export function hasPanelFlag(segment) {
  if (typeof segment.hasPanel === 'boolean') return segment.hasPanel;
  return segment.type !== NEUTRAL_TYPE && segment.type !== DRAWERS_TYPE;
}

/** Volitelná police v otevřené podestavbě (§4 SPEC v3) — INSTANCE pole
 *  `hasShelf`. Přesunuto z floorplan.js — čte i report.js (soupis dílů). */
export function hasShelfFlag(segment) {
  return typeof segment.hasShelf === 'boolean' ? segment.hasShelf : false;
}

/** Lidsky čitelný název segmentu (pro seznam v UI). §13 SPEC v4 — název
 *  katalogového přístroje se bere z aktuálního jazyka (pokud nebyl
 *  přejmenován, viz catalog.js getEntryDisplayName); vlastní modul se
 *  NEPŘEKLÁDÁ (zobrazuje se přesně tak, jak jej pojmenoval uživatel). */
export function getSegmentLabel(segment) {
  if (segment.type === NEUTRAL_TYPE) return t('module.neutral');
  if (segment.type === DRAWERS_TYPE) return t('module.drawers');
  if (segment.type === CUSTOM_TYPE) {
    return segment.name ? t('module.customPrefix', { name: segment.name }) : t('module.customDefaultName');
  }
  const def = getCatalogEntry(segment.type);
  return def ? getEntryDisplayName(def) : segment.type;
}

/** Vrátí šířku segmentu v mm (instance-aware — neutrál/custom i nastavitelné
 *  katalogové přístroje mají vlastní šířku uloženou na instanci). */
export function getSegmentWidthMM(segment) {
  if (segment.type === DRAWERS_TYPE) return DRAWERS_WIDTH_MM;
  if (segment.type === NEUTRAL_TYPE || segment.type === CUSTOM_TYPE) {
    return Math.round(segment.widthMM) || 0;
  }
  const def = getCatalogEntry(segment.type);
  const instanceWidth = Number(segment.widthMM);
  if (Number.isFinite(instanceWidth) && instanceWidth > 0) return Math.round(instanceWidth);
  return def ? def.widthMM : 400; // neznámý typ (např. z cizí konfigurace) — bezpečný odhad
}

/** Minimální hloubka podestavby katalogového přístroje (mm), 700 mm jako
 *  bezpečný odhad u neznámého typu. */
export function getSegmentMinDepthMM(segment) {
  const def = getCatalogEntry(segment.type);
  return def && def.minDepthMM ? def.minDepthMM : 700;
}

// --- Obrysové hrany ----------------------------------------------------------

/** Přidá k mesh objektu obrysové hrany (EdgesGeometry) jako dítě — sdílí transformaci. */
function addEdges(mesh) {
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), createEdgeMaterial());
  mesh.add(edges);
  return mesh;
}

function box(width, height, depth, material, withEdges = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (withEdges) addEdges(mesh);
  return mesh;
}

// --- Základní stavební bloky sdílené všemi segmenty ---------------------------

// odsazení nožičky od okraje podestavby a její půdorysný rozměr (§11.2)
const LEG_SIZE = 0.05;
const LEG_INSET = 0.045;

/**
 * Sokl PER SKŘÍŇKA/segment (§11.2 SPEC v4, ZADANI-SOKL.md 31. 8. 2026) —
 * od téhle revize kreslí JEN nožičky (`legs`, `legs_plinth`).
 * `building` nekreslí NIC (ani nožičky). `construction` taky nekreslí nic
 * TADY — nerezový rám (`construction`) i soklová zástěna kryjící nožičky
 * (`legs_plinth`) jsou GEOMETRIE NA ÚROVNI CELÉHO BLOKU (obvod půdorysu
 * bloku, uskočení PLINTH_INSET_MM ze všech stran) — ty staví
 * buildBlockPlinth() v block.js PŘI SESTAVOVÁNÍ BLOKU, ne tahle funkce.
 * `heightM` je výška CELÉ soklové zóny bloku (metry) — nahrazuje dřívější
 * pevnou konstantu PLINTH_HEIGHT (0,15), viz ZADANI-SOKL.md.
 */
export function buildPlinth(group, widthM, depthM, plinthType = DEFAULT_PLINTH, heightM = mm(PLINTH_HEIGHT_DEFAULT_MM)) {
  if (plinthType !== 'legs' && plinthType !== 'legs_plinth') return;

  const plinthMat = createPlinthMaterial();
  const insetX = Math.min(LEG_INSET, Math.max(widthM / 2 - LEG_SIZE / 2, 0.01));
  const insetZ = Math.min(LEG_INSET, Math.max(depthM / 2 - LEG_SIZE / 2, 0.01));
  const xs = [-(widthM / 2 - insetX), widthM / 2 - insetX];
  const zs = [insetZ, depthM - insetZ];
  xs.forEach((x) => {
    zs.forEach((z) => {
      const leg = box(LEG_SIZE, heightM, LEG_SIZE, plinthMat);
      leg.position.set(x, heightM / 2, z);
      group.add(leg);
    });
  });
}

/**
 * Uzavřený korpus (plný box) — používá se u přístrojů, vlastního modulu,
 * výplně a u neutrálního modulu s dvířky (jako podklad pod dvířky).
 */
function buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY) {
  const height = bodyTopY - bodyBottomY;
  const body = box(widthM - 0.003, height, depthM - 0.003, createStainlessMaterial());
  body.position.set(0, bodyBottomY + height / 2, depthM / 2);
  group.add(body);
  return body;
}

// --- Otevřená podestavba (§4 SPEC v3 — oprava dutiny a police) ---------------

const OPEN_WALL_T = 0.018; // tloušťka boků/dna/zad
const OPEN_LIP_DEPTH = 0.02; // hloubka rámového lemu kolem otvoru
const OPEN_SHELF_RECESS_M = 0.025; // police zapuštěná 25 mm od čela (rozsah 20–30 mm)
const OPEN_SHELF_THICKNESS = 0.02;

/**
 * Otevřená podestavba — rám (boky/dno/záda/lem) + čitelná světlejší dutina +
 * volitelná police vystředěná v dutině a zapuštěná od čela.
 * `cavityTopY` je horní hranice DUTINY (pokud segment má panel, dutina pod
 * ním končí — panel do dutiny nepatří), zatímco `bodyTopY` je plná
 * konstrukční výška korpusu (boky jdou až k desce i za panelem).
 */
function buildOpenBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, hasShelf) {
  const stainless = createStainlessMaterial();
  const cavity = createCavityMaterial();
  const height = bodyTopY - bodyBottomY;
  const wallT = OPEN_WALL_T;
  const lipDepth = OPEN_LIP_DEPTH;

  // boční stěny (celá výška korpusu, i za panelem — žádná díra vzadu)
  [-1, 1].forEach((side) => {
    const wall = box(wallT, height, depthM, stainless);
    wall.position.set((side * (widthM - wallT)) / 2, bodyBottomY + height / 2, depthM / 2);
    group.add(wall);
  });

  // zadní stěna
  const back = box(widthM - wallT * 2, height, wallT, stainless);
  back.position.set(0, bodyBottomY + height / 2, depthM - wallT / 2);
  group.add(back);

  // dno
  const bottom = box(widthM - wallT * 2, wallT, depthM - wallT, stainless);
  bottom.position.set(0, bodyBottomY + wallT / 2, depthM / 2 + wallT / 2);
  group.add(bottom);

  // rámový lem kolem otvoru (nahoře i dole) — dá dojem hloubky a lemuje otvor nerezem
  const lipTop = box(widthM - wallT * 2, wallT, lipDepth, stainless);
  lipTop.position.set(0, bodyBottomY + height - wallT / 2, lipDepth / 2);
  group.add(lipTop);
  const lipBottom = box(widthM - wallT * 2, wallT, lipDepth, stainless);
  lipBottom.position.set(0, bodyBottomY + wallT / 2, lipDepth / 2);
  group.add(lipBottom);

  // viditelná světlejší dutina — od dna po cavityTopY (pod panelem, pokud existuje)
  const cavityBottomY = bodyBottomY + wallT;
  const cavityHeight = Math.max(cavityTopY - cavityBottomY, 0.02);
  const innerWidth = Math.max(widthM - wallT * 2 - 0.01, 0.02);
  const cavityDepth = Math.max(depthM - wallT - lipDepth - 0.005, 0.05);
  const innerCavity = new THREE.Mesh(new THREE.BoxGeometry(innerWidth, cavityHeight, cavityDepth), cavity);
  innerCavity.position.set(0, cavityBottomY + cavityHeight / 2, lipDepth + cavityDepth / 2);
  innerCavity.receiveShadow = true;
  innerCavity.castShadow = false;
  group.add(innerCavity);

  if (hasShelf) {
    // police vystředěná ve VÝŠCE dutiny, zapuštěná od čela (nevyčnívá přes lem)
    const shelfDepth = Math.max(depthM - wallT - OPEN_SHELF_RECESS_M - 0.01, 0.05);
    const shelf = box(innerWidth - 0.01, OPEN_SHELF_THICKNESS, shelfDepth, stainless);
    const shelfCenterY = cavityBottomY + cavityHeight / 2;
    shelf.position.set(0, shelfCenterY, OPEN_SHELF_RECESS_M + shelfDepth / 2);
    group.add(shelf);
  }
}

/** Podestavba s dvířky — uzavřený korpus + křídlová dvířka s úchytkami. */
function buildDoorBody(group, widthM, depthM, bodyBottomY, bodyTopY) {
  buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
  const stainless = createStainlessMaterial();
  const knobMat = createKnobMaterial();
  const height = bodyTopY - bodyBottomY;
  const centerY = bodyBottomY + height / 2;

  const doorCount = widthM > mm(600) ? 2 : 1;
  const doorWidth = widthM / doorCount;
  for (let i = 0; i < doorCount; i++) {
    const xCenter = -widthM / 2 + doorWidth * (i + 0.5);
    const door = box(doorWidth - 0.02, height - 0.02, 0.008, stainless);
    door.position.set(xCenter, centerY, -0.006);
    group.add(door);

    // úchytka blíž ke středové spáře (u dvoukřídlých) nebo k okraji (u jednokřídlých)
    const handleX = doorCount === 2
      ? xCenter + (i === 0 ? doorWidth * 0.36 : -doorWidth * 0.36)
      : xCenter + doorWidth * 0.32;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, height * 0.28, 12), knobMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(handleX, centerY, -0.014);
    handle.castShadow = true;
    group.add(handle);
  }
}

// --- Zásuvky GN 1/1 (§ „Zásuvky GN 1/1" zadání) -------------------------------

const DRAWER_GAP = 0.006; // jemná spára mezi zásuvkovými čely, ať jsou rozeznatelná
const DRAWER_FRONT_INSET = 0.01; // odsazení čela zásuvky od boku korpusu
const DRAWER_FRONT_Z = -0.006; // předsazení čela před líc korpusu (stejně jako u dvířek)
const DRAWER_FRONT_THICKNESS = 0.01;

/**
 * Korpus se zásuvkovými čely — plný uzavřený korpus (jako closed) s 2 nebo 3
 * vodorovně dělenými čely s úchytkami. `cavityTopY` je horní hranice prostoru
 * pro čela (pokud segment má panel, čela končí pod panelem — stejné pravidlo
 * jako u polic v buildOpenBody), zatímco `bodyTopY` je plná konstrukční výška
 * korpusu (jde až k desce i za panelem).
 */
function buildDrawersBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, drawerCount) {
  buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);

  const stainless = createStainlessMaterial();
  const handleMat = createKnobMaterial();
  const totalHeight = Math.max(cavityTopY - bodyBottomY, 0.05);
  const slotHeight = totalHeight / drawerCount;
  const frontWidth = Math.max(widthM - DRAWER_FRONT_INSET * 2, 0.05);
  const frontHeight = Math.max(slotHeight - DRAWER_GAP, 0.03);

  for (let i = 0; i < drawerCount; i++) {
    const slotCenterY = bodyBottomY + slotHeight * (i + 0.5);

    const front = box(frontWidth, frontHeight, DRAWER_FRONT_THICKNESS, stainless);
    front.position.set(0, slotCenterY, DRAWER_FRONT_Z);
    group.add(front);

    // vodorovná úchytka blízko horního okraje čela
    const handleWidth = frontWidth * 0.5;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, handleWidth, 12), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, slotCenterY + frontHeight * 0.32, DRAWER_FRONT_Z - DRAWER_FRONT_THICKNESS / 2 - 0.012);
    handle.castShadow = true;
    group.add(handle);
  }
}

/**
 * Postaví "tělo" podestavby dle stylu — dispatcher pro closed / open / doors.
 * `cavityTopY`/`hasShelf` se využijí jen u stylu 'open' (viz buildOpenBody).
 */
function buildBodyByStyle(group, style, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, hasShelf) {
  if (style === 'open') {
    return buildOpenBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY ?? bodyTopY, !!hasShelf);
  }
  if (style === 'doors') return buildDoorBody(group, widthM, depthM, bodyBottomY, bodyTopY);
  return buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
}

/**
 * Čelní ovládací panel — VŽDY předsazený před čelní stěnu korpusu (korpus má
 * čelo na z≈0, viz buildClosedBody/buildOpenBody/buildDoorBody), aby byl
 * zřetelně viditelný a neschovával se v rovině stěny korpusu. Obsahuje i
 * malou nálepku s logem ALBA u pravého okraje (§6 SPEC).
 */
function buildPanelBand(group, widthM, panelBottomY, panelTopY) {
  const height = panelTopY - panelBottomY;
  const thickness = 0.012;
  const centerZ = -0.012; // předsazeno před čelo korpusu (mezera ~6 mm od stěny)
  const panel = box(widthM - 0.01, height, thickness, createPanelMaterial());
  panel.position.set(0, panelBottomY + height / 2, centerZ);
  group.add(panel);
  const centerY = panelBottomY + height / 2;
  const frontZ = centerZ - thickness / 2; // nejpřednější plocha panelu — odsud se umisťují ovládací prvky ještě dál dopředu

  // malá "samolepka" ALBA (~45 mm) u pravého okraje panelu
  const stickerM = mm(45);
  if (widthM > stickerM * 3) {
    const sticker = box(stickerM, stickerM, 0.003, createLogoMaterial(), false);
    sticker.position.set(widthM / 2 - stickerM * 0.7, centerY, frontZ - 0.0016);
    group.add(sticker);
  }

  return { centerY, frontZ };
}

// --- Ovládací prvky na panelu --------------------------------------------------

/** Rovnoměrně rozmístí zadaný počet ovládacích prvků daného druhu na panel. */
export function renderControls(group, widthM, panelCenterY, panelFrontZ, controlType, count) {
  if (!count || count <= 0) return;
  const margin = Math.min(widthM * 0.14, 0.09);
  const usable = Math.max(widthM - margin * 2, 0.01);
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : -usable / 2 + (usable * i) / (count - 1);
    if (controlType === 'button') {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), createButtonMaterial());
      btn.rotation.x = Math.PI / 2;
      btn.position.set(x, panelCenterY, panelFrontZ - 0.006);
      btn.castShadow = true;
      group.add(btn);
    } else if (controlType === 'switch') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), createSwitchMaterial());
      base.rotation.x = Math.PI / 2;
      base.position.set(x, panelCenterY, panelFrontZ - 0.003);
      group.add(base);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.008), createSwitchMaterial());
      lever.rotation.x = -0.35;
      lever.position.set(x, panelCenterY + 0.012, panelFrontZ - 0.008);
      lever.castShadow = true;
      group.add(lever);
    } else {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 20), createKnobMaterial());
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, panelCenterY, panelFrontZ - 0.009);
      knob.castShadow = true;
      group.add(knob);
    }
  }
}

/** Doplňkové dekorace panelu podle typu vrchní funkce (indikátor, displej…). */
function decoratePanelExtras(group, topFeatureType, widthM, panelCenterY, panelFrontZ) {
  if (topFeatureType === 'fryer2' || topFeatureType === 'fryer1') {
    const indicator = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 12), createButtonMaterial());
    indicator.rotation.x = Math.PI / 2;
    indicator.position.set(widthM * 0.32, panelCenterY + 0.03, panelFrontZ - 0.006);
    group.add(indicator);
  } else if (topFeatureType === 'ceramic4') {
    const display = new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.28, 0.02, 0.008), createGlassCeramicMaterial());
    display.position.set(0, panelCenterY + 0.05, panelFrontZ - 0.004);
    group.add(display);
  } else if (topFeatureType === 'induction') {
    const display = new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.22, 0.018, 0.007), createGlassCeramicMaterial());
    display.position.set(0, panelCenterY + 0.045, panelFrontZ - 0.004);
    group.add(display);
  }
}

// --- Vrchní detaily jednotlivých přístrojů (kreslí se NA průběžnou desku) ------
// Tyto funkce přidávají detaily přímo do skupiny segmentu na absolutní y-úrovni
// `topY` (horní plocha průběžné desky), takže musí dostat `topY` jako parametr.

/** Jmenovitá mřížka RM Free-Block / Lotus PCD-x8G (katalog: 390 × 360 mm). */
const CAST_IRON_GRATE_W_MM = 390;
const CAST_IRON_GRATE_D_MM = 360;
const CAST_IRON_EDGE_MM = 20;

/** Jeden litinový hořák + křížová mřížka (sdílené burners4 / burners2).
 *  `grateWM` / `grateDM` = půdorys mřížky v metrech (katalog: 390×360 mm).
 *  Délka tyčí = menší strana mřížky, ať kříž zůstane uvnitř obdélníku. */
function addCastIronBurner(group, x, z, topY, grateWM, grateDM) {
  const castIron = createCastIronMaterial();
  const span = Math.min(grateWM, grateDM);
  const baseR = span * 0.26;
  const ringR = span * 0.20;
  const innerR = span * 0.09;
  const barLen = span * 0.95;
  const barW = Math.max(span * 0.03, 0.01);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.9, baseR, 0.015, 24), castIron);
  base.position.set(x, topY + 0.008, z);
  base.castShadow = true;
  group.add(base);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, Math.max(span * 0.03, 0.008), 8, 24), castIron);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, topY + 0.02, z);
  ring.castShadow = true;
  group.add(ring);

  const inner = new THREE.Mesh(new THREE.CylinderGeometry(innerR, innerR, 0.012, 16), castIron);
  inner.position.set(x, topY + 0.015, z);
  group.add(inner);

  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.008, barW), castIron);
    bar.rotation.y = (Math.PI / 4) * i;
    bar.position.set(x, topY + 0.026, z);
    bar.castShadow = true;
    group.add(bar);
  }
}

/**
 * Absolutní layout litinových mřížek 390×360 mm.
 * `columns` = 1 → burners2 (osa X=0), 2 → burners4 (dva sloupce ve středech polovin).
 * Na mělčí řadě (cutout 700) se hloubka mřížky + pitchZ zmenší stejně jako u burners2.
 */
function resolveCastIronBurnerLayout(widthM, depthM, columns = 1) {
  const cols = Math.max(1, Math.round(columns));
  const EDGE = mm(CAST_IRON_EDGE_MM);
  const halfW = widthM / cols;
  const grateWM = Math.min(
    mm(CAST_IRON_GRATE_W_MM),
    Math.max(halfW - mm(10), mm(200))
  );
  let grateDM = mm(CAST_IRON_GRATE_D_MM);

  // dva kříže za sebou: spanZ ≈ pitch + barLen, barLen = 0.95 · min(W,D)
  const usable = Math.max(depthM - 2 * EDGE, mm(200));
  const fitDepth = (d) => d + Math.min(grateWM, d) * 0.95;
  if (fitDepth(grateDM) > usable) {
    // solve d + 0.95·d = usable když d ≤ grateWM (typicky ano)
    grateDM = usable / 1.95;
  }
  const barLenZ = Math.min(grateWM, grateDM) * 0.95;
  const pitchZ = Math.min(grateDM, Math.max(usable - barLenZ, barLenZ));
  const midZ = depthM / 2;
  const zs = [midZ - pitchZ / 2, midZ + pitchZ / 2];

  const xs = [];
  for (let c = 0; c < cols; c++) {
    xs.push(-widthM / 2 + halfW * (c + 0.5));
  }

  const positions = [];
  for (const x of xs) {
    for (const z of zs) {
      positions.push([x, z]);
    }
  }
  return { grateWM, grateDM, pitchZ, positions };
}

/** Čtyřhořák (Lotus PCD-68G / PCD-88G) — 2×2 absolutní mřížky 390×360 mm
 *  (= dva bloky burners2 vedle sebe). Viz ZADANI-GEOMETRIE-RM.md vlna 2. */
function buildGasStoveTop(group, widthM, depthM, topY) {
  const { grateWM, grateDM, positions } = resolveCastIronBurnerLayout(widthM, depthM, 2);
  positions.forEach(([x, z]) => addCastIronBurner(group, x, z, topY, grateWM, grateDM));
}

/**
 * Dvouhořáková plynová deska (Lotus PCD-64G / PCD-84G) — 2 hořáky za sebou
 * na ose šířky. Cílová mřížka 390×360 mm dle RM PCD-84G; na mělčí řadě
 * (700 mm cutout) se hloubka mřížky + rozteč zmenší, ať kříž nepřeteče desku.
 * U PCD-64G je 390×360 K OVĚŘENÍ — viz ZADANI-GEOMETRIE-RM.md.
 */
function buildGasStove2Top(group, widthM, depthM, topY) {
  const { grateWM, grateDM, positions } = resolveCastIronBurnerLayout(widthM, depthM, 1);
  positions.forEach(([x, z]) => addCastIronBurner(group, x, z, topY, grateWM, grateDM));
}

/** Sklokeramika PCCD-88ET — sklo 750×770 mm, zóny Ø220 (odhad z fotky). */
const CERAMIC_EDGE_MM = 20;
const CERAMIC_GLASS_W_MM = 750;
const CERAMIC_GLASS_D_MM = 770;
const CERAMIC_ZONE_DIA_MM = 220;
const CERAMIC_ZONE_INNER_DIA_MM = 140;
const CERAMIC_GLASS_THICK_MM = 12;

/**
 * Absolutní layout 4 sklokeramických zón (Lotus PCCD-88ET).
 * Sklo z `glassWidthMM/DepthMM` (katalog 750×770), zóny 2×2 ve čtvrtinách skla,
 * průměr z `zoneDiameterMM` (odhad z fotky — v RM není Ø). Fit do šířky desky /
 * hloubky řady jako u burners4. Pořadí středů: FL, FR, BL, BR.
 * Viz ZADANI-GEOMETRIE-RM.md vlna 5.
 */
function resolveCeramic4Layout(widthM, depthM, feature = {}) {
  const EDGE = mm(CERAMIC_EDGE_MM);
  const hasGlass = Number(feature.glassWidthMM) > 0 && Number(feature.glassDepthMM) > 0;
  let glassWM = hasGlass ? mm(Number(feature.glassWidthMM)) : mm(CERAMIC_GLASS_W_MM);
  let glassDM = hasGlass ? mm(Number(feature.glassDepthMM)) : mm(CERAMIC_GLASS_D_MM);
  // proporční fallback (vlastní přístroj) — skoro celá deska
  if (!hasGlass && !(Number(feature.zoneDiameterMM) > 0)) {
    glassWM = Math.max(widthM - 0.02, mm(200));
    glassDM = Math.max(depthM - 0.02, mm(200));
  }
  glassWM = Math.min(glassWM, Math.max(widthM - 2 * EDGE, mm(200)));
  glassDM = Math.min(glassDM, Math.max(depthM - 2 * EDGE, mm(200)));

  let zoneDia = Number(feature.zoneDiameterMM) > 0
    ? mm(Number(feature.zoneDiameterMM))
    : mm(CERAMIC_ZONE_DIA_MM);
  // 2 zóny + mezera ve skle (max ~45 % kratší strany skla)
  const maxDia = Math.min(glassWM, glassDM) * 0.45;
  zoneDia = Math.min(Math.max(zoneDia, mm(60)), Math.max(maxDia, mm(60)));

  let innerDia = Number(feature.zoneInnerDiameterMM) > 0
    ? mm(Number(feature.zoneInnerDiameterMM))
    : mm(CERAMIC_ZONE_INNER_DIA_MM);
  innerDia = Math.min(innerDia, zoneDia * 0.75);

  const centerX = 0;
  const centerZ = depthM / 2;
  const pitchX = glassWM / 2;
  const pitchZ = glassDM / 2;
  const xs = [centerX - pitchX / 2, centerX + pitchX / 2];
  const zs = [centerZ - pitchZ / 2, centerZ + pitchZ / 2];
  // FL, FR, BL, BR — shodné s zones[].position v katalogu
  const positions = [
    [xs[0], zs[0]],
    [xs[1], zs[0]],
    [xs[0], zs[1]],
    [xs[1], zs[1]],
  ];
  return {
    glassWM,
    glassDM,
    zoneDia,
    innerDia,
    positions,
    centerX,
    centerZ,
    pitchX,
    pitchZ,
    hasGlass,
  };
}

/**
 * Sklokeramická deska 4 zóny (PCCD-88ET) — absolutní sklo + duální kruhy.
 * Alias historického názvu: buildElectricStoveTop.
 */
function buildCeramicTop(group, widthM, depthM, topY, feature = {}) {
  const {
    glassWM, glassDM, zoneDia, innerDia, positions, centerX, centerZ,
  } = resolveCeramic4Layout(widthM, depthM, feature);

  const glassCeramic = createGlassCeramicMaterial();
  const glassThick = mm(CERAMIC_GLASS_THICK_MM);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(glassWM, glassThick, glassDM), glassCeramic);
  plate.position.set(centerX, topY + glassThick / 2, centerZ);
  plate.castShadow = true;
  plate.receiveShadow = true;
  plate.userData.featurePart = 'ceramicGlass';
  group.add(plate);

  const zoneMat = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, metalness: 0.35, roughness: 0.45 });
  const ringY = topY + glassThick + 0.001;
  const tube = mm(3.5);
  positions.forEach(([x, z]) => {
    const outerR = Math.max(zoneDia / 2 - tube, mm(40));
    const outer = new THREE.Mesh(new THREE.TorusGeometry(outerR, tube, 8, 48), zoneMat);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(x, ringY, z);
    outer.userData.featurePart = 'ceramicZone';
    group.add(outer);

    const innerR = Math.max(innerDia / 2 - tube * 0.85, mm(25));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(innerR, tube * 0.85, 8, 40), zoneMat);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, ringY, z);
    inner.userData.featurePart = 'ceramicZoneInner';
    group.add(inner);
  });

  // indikátor zbytkového tepla vpředu uprostřed skla (fotka PCCD-88ET)
  const hint = mm(18);
  const residual = new THREE.Mesh(
    new THREE.BoxGeometry(hint, mm(1), hint),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d4, metalness: 0.2, roughness: 0.55 })
  );
  residual.position.set(centerX, ringY, centerZ - glassDM / 2 + mm(28));
  residual.userData.featurePart = 'ceramicResidual';
  group.add(residual);
}

/** @deprecated použij buildCeramicTop — ponecháno jako alias. */
function buildElectricStoveTop(group, widthM, depthM, topY, feature = {}) {
  buildCeramicTop(group, widthM, depthM, topY, feature);
}

/** Indukce — jedna varná zóna 400×400 mm (§3.3 SPEC v3). */
function buildInductionTop(group, widthM, depthM, topY) {
  const glassCeramic = createGlassCeramicMaterial();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.02, 0.012, depthM - 0.02), glassCeramic);
  plate.position.set(0, topY + 0.006, depthM / 2);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const zoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.3, roughness: 0.25 });
  const zoneRadius = Math.min(mm(190), widthM * 0.42, depthM * 0.42);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(zoneRadius, 0.005, 8, 32), zoneMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, topY + 0.013, depthM * 0.5);
  group.add(ring);

  // naznačený čtvercový obrys 400×400 mm zóny
  const squareSize = Math.min(mm(400), widthM * 0.9, depthM * 0.9);
  const squareOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(squareSize, squareSize)),
    new THREE.LineBasicMaterial({ color: 0x3a3a3e })
  );
  squareOutline.rotation.x = -Math.PI / 2;
  squareOutline.position.set(0, topY + 0.0135, depthM * 0.5);
  group.add(squareOutline);
}

/** Okraj desky kolem van fritézy (mm). */
const FRYER_EDGE_MM = 20;

/**
 * Absolutní layout 2 van fritézy (Lotus F2/8D / F2/10D).
 * Rozměry z `topFeature.vatWidthMM/vatDepthMM` (+ koše); bez nich fallback
 * proporční (vlastní přístroj v editoru). Vany vedle sebe, zbývající šířka
 * rozdělená na 2 okraje + mezeru (min. FRYER_EDGE_MM).
 * Viz ZADANI-GEOMETRIE-RM.md vlna 3.
 */
function resolveFryer2Layout(widthM, depthM, feature = {}) {
  const EDGE = mm(FRYER_EDGE_MM);
  const hasAbsolute = Number(feature.vatWidthMM) > 0 && Number(feature.vatDepthMM) > 0;
  let vatWM = hasAbsolute ? mm(Number(feature.vatWidthMM)) : widthM * 0.42;
  let vatDM = hasAbsolute ? mm(Number(feature.vatDepthMM)) : depthM * 0.6;
  vatDM = Math.min(vatDM, Math.max(depthM - 2 * EDGE, mm(200)));
  const maxVatW = Math.max((widthM - 3 * EDGE) / 2, mm(80));
  vatWM = Math.min(vatWM, maxVatW);

  const remaining = Math.max(widthM - 2 * vatWM, 2 * EDGE);
  const side = Math.max(EDGE, remaining / 3);
  const between = Math.max(remaining - 2 * side, EDGE);
  const halfPitch = vatWM / 2 + between / 2;
  const centersX = [-halfPitch, halfPitch];
  const centerZ = depthM / 2;

  let basketWM = Number(feature.basketWidthMM) > 0
    ? mm(Number(feature.basketWidthMM))
    : Math.max(vatWM - mm(28), vatWM * 0.75);
  let basketDM = Number(feature.basketDepthMM) > 0
    ? mm(Number(feature.basketDepthMM))
    : Math.max(vatDM - mm(50), vatDM * 0.82);
  basketWM = Math.min(basketWM, vatWM - mm(8));
  basketDM = Math.min(basketDM, vatDM - mm(8));

  return { vatWM, vatDM, centersX, centerZ, basketWM, basketDM, side, between, hasAbsolute };
}

/** Dvojvaná fritéza — absolutní vany z katalogu (148×350 / 220×350) nebo proporční fallback. */
function buildFryerTop(group, widthM, depthM, topY, feature = {}) {
  const glass = createGlassMaterial();
  const recessMat = createRecessMaterial();
  const { vatWM, vatDM, centersX, centerZ, basketWM, basketDM } = resolveFryer2Layout(widthM, depthM, feature);

  centersX.forEach((x) => {
    const vat = new THREE.Mesh(new THREE.BoxGeometry(vatWM, 0.14, vatDM), recessMat);
    vat.position.set(x, topY - 0.06, centerZ);
    vat.userData.featurePart = 'fryerVat';
    group.add(vat);

    const basket = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(basketWM, 0.11, basketDM)),
      new THREE.LineBasicMaterial({ color: 0x8c8c8c })
    );
    basket.position.set(x, topY - 0.03, centerZ);
    basket.userData.featurePart = 'fryerBasket';
    group.add(basket);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(vatWM, 0.01, vatDM), glass);
    lid.position.set(x, topY + 0.1, centerZ + vatDM * 0.35);
    lid.rotation.x = -Math.PI * 0.32;
    lid.userData.featurePart = 'fryerLid';
    group.add(lid);
  });
}

/** Fritéza s JEDNOU vanou — vizuálně shodná s buildFryerTop (2 vany), jen
 *  jedna vana s košem a víkem, vycentrovaná (např. Lotus F10D-64ET, 10 l). */
function buildFryer1Top(group, widthM, depthM, topY) {
  const glass = createGlassMaterial();
  const recessMat = createRecessMaterial();
  const vatWidth = widthM * 0.42;
  const x = 0;

  const vat = new THREE.Mesh(new THREE.BoxGeometry(vatWidth, 0.14, depthM * 0.6), recessMat);
  vat.position.set(x, topY - 0.06, depthM * 0.5);
  group.add(vat);

  const basketGeo = new THREE.BoxGeometry(vatWidth - 0.03, 0.11, depthM * 0.5);
  const basket = new THREE.LineSegments(
    new THREE.EdgesGeometry(basketGeo),
    new THREE.LineBasicMaterial({ color: 0x8c8c8c })
  );
  basket.position.set(x, topY - 0.03, depthM * 0.5);
  group.add(basket);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(vatWidth, 0.01, depthM * 0.6), glass);
  lid.position.set(x, topY + 0.1, depthM * 0.78);
  lid.rotation.x = -Math.PI * 0.32;
  group.add(lid);
}

const GRILL_EDGE_MM = 20;
const GRILL_PLATE_THICK_MM = 14;
const GRILL_RIB_COUNT = 7;
const GRILL_TRAY_DEPTH_MM = 40;

/**
 * Grilovací plocha — absolutní mm z `cookAreaWidthMM/DepthMM` (FTLRD-88ET
 * 680×760) nebo proporční fallback. Viz ZADANI-GEOMETRIE-RM.md vlna 4.
 */
function resolveGrillLayout(widthM, depthM, feature = {}) {
  const EDGE = mm(GRILL_EDGE_MM);
  const hasAbsolute = Number(feature.cookAreaWidthMM) > 0 && Number(feature.cookAreaDepthMM) > 0;
  let cookWM = hasAbsolute ? mm(Number(feature.cookAreaWidthMM)) : Math.max(widthM - 0.02, mm(200));
  let cookDM = hasAbsolute ? mm(Number(feature.cookAreaDepthMM)) : Math.max(depthM - 0.06, mm(200));
  cookWM = Math.min(cookWM, Math.max(widthM - 2 * EDGE, mm(200)));
  cookDM = Math.min(cookDM, Math.max(depthM - 2 * EDGE, mm(200)));
  const centerX = 0;
  const centerZ = depthM / 2;
  const trayDM = Math.min(mm(GRILL_TRAY_DEPTH_MM), cookDM * 0.12);
  const trayWM = cookWM * 0.28;
  return { cookWM, cookDM, centerX, centerZ, trayWM, trayDM, hasAbsolute };
}

/**
 * Kombinovaný fry-top (FTLRD-88ET): ½ vlevo rýhovaná (žebra předozadně),
 * ½ vpravo hladká; sběr tuku vpředu uprostřed. Plocha z katalogu nebo fallback.
 */
function buildGrillTop(group, widthM, depthM, topY, feature = {}) {
  const { cookWM, cookDM, centerX, centerZ, trayWM, trayDM } = resolveGrillLayout(widthM, depthM, feature);
  const plateThick = mm(GRILL_PLATE_THICK_MM);
  const halfW = cookWM / 2;
  const plateY = topY + plateThick / 2;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x7a7e82, metalness: 0.88, roughness: 0.34 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x55595d, metalness: 0.82, roughness: 0.42 });

  // pravá polovina — hladká (fotka FTLRD-88ET)
  const smooth = new THREE.Mesh(new THREE.BoxGeometry(halfW, plateThick, cookDM), steelMat);
  smooth.position.set(centerX + halfW / 2, plateY, centerZ);
  smooth.castShadow = true;
  smooth.receiveShadow = true;
  smooth.userData.featurePart = 'grillCookArea';
  group.add(smooth);

  // levá polovina — základ pod žebry
  const ribbedBase = new THREE.Mesh(new THREE.BoxGeometry(halfW, plateThick, cookDM), steelMat);
  ribbedBase.position.set(centerX - halfW / 2, plateY, centerZ);
  ribbedBase.castShadow = true;
  ribbedBase.receiveShadow = true;
  ribbedBase.userData.featurePart = 'grillCookArea';
  group.add(ribbedBase);

  // žebra předozadně (osa Z) jen na levé polovině
  const ribWM = mm(14);
  const ribHM = mm(5);
  const marginX = mm(18);
  const usable = Math.max(halfW - 2 * marginX, ribWM);
  for (let i = 0; i < GRILL_RIB_COUNT; i++) {
    const t = GRILL_RIB_COUNT === 1 ? 0.5 : i / (GRILL_RIB_COUNT - 1);
    const x = centerX - halfW + marginX + usable * t;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(ribWM, ribHM, cookDM - mm(12)), ribMat);
    rib.position.set(x, topY + plateThick + ribHM / 2, centerZ);
    rib.castShadow = true;
    rib.userData.featurePart = 'grillRib';
    group.add(rib);
  }

  // sběr tuku / odtok vpředu uprostřed plochy
  const tray = new THREE.Mesh(new THREE.BoxGeometry(trayWM, mm(10), trayDM), createRecessMaterial());
  tray.position.set(centerX, topY + mm(4), centerZ - cookDM / 2 + trayDM / 2 + mm(4));
  tray.userData.featurePart = 'grillTray';
  group.add(tray);
}

function addBasin(group, widthM, depthM, topY, options = {}) {
  const {
    basinWidth = widthM - 0.08,
    basinDepth = depthM - 0.15,
    basinDepthY = 0.16,
    zOffset = 0,
  } = options;
  const recessMat = createRecessMaterial();
  const stainless = createStainlessMaterial();

  const rim = new THREE.Mesh(new THREE.BoxGeometry(basinWidth + 0.03, 0.012, basinDepth + 0.03), stainless);
  rim.position.set(0, topY + 0.006, depthM / 2 + zOffset);
  rim.castShadow = true;
  group.add(rim);

  const basin = new THREE.Mesh(new THREE.BoxGeometry(basinWidth, basinDepthY, basinDepth), recessMat);
  basin.position.set(0, topY - basinDepthY / 2 + 0.01, depthM / 2 + zOffset);
  group.add(basin);
}

function buildBainMarieTop(group, widthM, depthM, topY) {
  addBasin(group, widthM, depthM, topY, { basinDepthY: 0.1, basinDepth: depthM - 0.2 });
}

function buildMultiPanTop(group, widthM, depthM, topY) {
  const glass = createGlassMaterial();
  const knobMat = createKnobMaterial();

  addBasin(group, widthM, depthM, topY, { basinWidth: widthM - 0.1, basinDepth: depthM * 0.55, basinDepthY: 0.15 });

  const lid = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.12, 0.012, depthM * 0.56), glass);
  lid.position.set(0, topY + 0.32, depthM * 0.85);
  lid.rotation.x = -Math.PI * 0.42;
  group.add(lid);

  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 12), knobMat);
  lever.rotation.z = Math.PI / 2.6;
  lever.position.set(widthM / 2 - 0.05, topY + 0.05, depthM * 0.25);
  lever.castShadow = true;
  group.add(lever);
}

/** Půdorysný obdélník se zaoblenými rohy (bez CSG) — použito pro lem a
 *  dutinu vany dřezu, aby působila dojmem lisované nerezové vany. */
function roundedRectShape(width, depth, radius) {
  const r = Math.min(radius, width / 2, depth / 2);
  const x = -width / 2;
  const y = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x, y + r);
  shape.lineTo(x, y + depth - r);
  shape.quadraticCurveTo(x, y + depth, x + r, y + depth);
  shape.lineTo(x + width - r, y + depth);
  shape.quadraticCurveTo(x + width, y + depth, x + width, y + depth - r);
  shape.lineTo(x + width, y + r);
  shape.quadraticCurveTo(x + width, y, x + width - r, y);
  shape.lineTo(x + r, y);
  shape.quadraticCurveTo(x, y, x, y + r);
  return shape;
}

const SINK_RIM_WIDTH_M = 0.025; // šířka viditelného lemu kolem vany
const SINK_RIM_THICKNESS_M = 0.01; // o kolik lem vystupuje nad desku
const SINK_CORNER_RADIUS_M = 0.03; // poloměr zaoblení rohů vany

/**
 * Vana dřezu zapuštěná v desce — viditelný lem (nerez, se zaoblenými rohy)
 * kolem otvoru + skutečná dutina (extrudovaný zaoblený obdélník s
 * materiálem side: THREE.BackSide, stejný princip jako dutina otevřené
 * podestavby v `buildOpenBody` — dutina je tak čitelná, ne plochá deska).
 */
function buildSinkBasin(group, vatWidthM, vatDepthM, vatHeightM, topY, centerZ) {
  const stainless = createStainlessMaterial();
  const cavityMat = createSinkCavityMaterial();
  const cornerR = Math.min(SINK_CORNER_RADIUS_M, vatWidthM / 2 - 0.005, vatDepthM / 2 - 0.005);

  // lem — rámeček se zaoblenými rohy, vystupující nad desku a lemující otvor
  const outerShape = roundedRectShape(vatWidthM + SINK_RIM_WIDTH_M * 2, vatDepthM + SINK_RIM_WIDTH_M * 2, cornerR + SINK_RIM_WIDTH_M);
  outerShape.holes.push(roundedRectShape(vatWidthM, vatDepthM, cornerR));
  const rimGeometry = new THREE.ExtrudeGeometry(outerShape, { depth: SINK_RIM_THICKNESS_M, bevelEnabled: false, curveSegments: 12 });
  const rim = new THREE.Mesh(rimGeometry, stainless);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, topY + SINK_RIM_THICKNESS_M, centerZ);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  // dutina — skutečná hloubka (vatHeightM), viditelná díky BackSide materiálu
  const innerShape = roundedRectShape(vatWidthM, vatDepthM, cornerR);
  const cavityGeometry = new THREE.ExtrudeGeometry(innerShape, { depth: vatHeightM, bevelEnabled: false, curveSegments: 12 });
  const cavity = new THREE.Mesh(cavityGeometry, cavityMat);
  cavity.rotation.x = Math.PI / 2;
  cavity.position.set(0, topY, centerZ);
  cavity.receiveShadow = true;
  group.add(cavity);
}

/** Dřez s volitelnými rozměry vany (§3.3 SPEC v3) — vatWidthM/vatDepthM
 *  přichází z instance segmentu (main.js), ne z katalogu. Vana je zapuštěná
 *  v desce (viz buildSinkBasin) a baterie s loketní pákou stojí na ose ZA
 *  vanou (vystředěná vůči vaně, posunutá dozadu, ne vedle). Baterie odpovídá
 *  výkresu Klarco 1E.2904.82.76 — labutí krk, výška 330 mm nad deskou,
 *  dosah výtoku 245 mm. */
function buildSinkTop(group, widthM, depthM, topY, vatWidthM, vatDepthM) {
  const chrome = createChromeMaterial();
  const vatHeightM = mm(SINK_VAT_HEIGHT_MM);
  const centerZ = depthM / 2 - depthM * 0.06;

  buildSinkBasin(group, vatWidthM, vatDepthM, vatHeightM, topY, centerZ);

  // --- baterie s loketní pákou (Klarco 1E.2904.82.76), vystředěná nad vanou,
  // posunutá dozadu -----------------------------------------------------------
  const vatBackZ = centerZ + vatDepthM / 2;
  const faucetX = 0; // vana je vždy vystředěná na ose segmentu (x = 0)
  const faucetZ = Math.min(vatBackZ + 0.06, depthM - 0.05);

  // montážní příruba — Ø47 mm, výška 50 mm
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.05, 24), chrome);
  flange.position.set(faucetX, topY + 0.025, faucetZ);
  flange.castShadow = true;
  group.add(flange);

  // tělo baterie — Ø55 mm, od topY+0.05 do topY+0.17
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.12, 24), chrome);
  body.position.set(faucetX, topY + 0.11, faucetZ);
  body.castShadow = true;
  group.add(body);

  // výtokové ramínko Ø25 mm — vychází z těla nízko (85 mm), stoupá šikmo nad
  // vanu, nahoře těsný ohyb a krátký výtok dolů s perlátorem (dosah osy 245 mm)
  const spoutZ = faucetZ - 0.245;
  const armStart = new THREE.Vector3(faucetX, topY + 0.085, faucetZ);
  const armApex = new THREE.Vector3(faucetX, topY + 0.235, spoutZ + 0.045);
  const armBend = new THREE.Vector3(faucetX, topY + 0.205, spoutZ);
  const armEnd = new THREE.Vector3(faucetX, topY + 0.195, spoutZ);

  const riseDir = new THREE.Vector3().subVectors(armApex, armStart).normalize();
  const bendLen = armApex.distanceTo(armBend) * 0.55; // ramena Bézieru = hladký ohyb

  const neckPath = new THREE.CurvePath();
  neckPath.add(new THREE.LineCurve3(armStart, armApex));
  neckPath.add(new THREE.CubicBezierCurve3(
    armApex,
    armApex.clone().addScaledVector(riseDir, bendLen),
    armBend.clone().add(new THREE.Vector3(0, bendLen, 0)),
    armBend
  ));
  neckPath.add(new THREE.LineCurve3(armBend, armEnd));

  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckPath, 96, 0.0125, 16, false), chrome);
  neck.castShadow = true;
  group.add(neck);

  // perlátor na ústí výtoku
  const aerator = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.018, 20), chrome);
  aerator.position.set(faucetX, armEnd.y - 0.009, spoutZ);
  aerator.castShadow = true;
  group.add(aerator);

  // loketní páka — z vrcholu těla šikmo vzhůru NAD ramínko (stejný směr jako
  // výtok, viz boční výkres), vodorovný průmět 220 mm; její konec je nejvyšším
  // bodem baterie, tj. přesně 330 mm nad deskou
  const leverR = 0.009;
  const leverStart = new THREE.Vector3(faucetX, topY + 0.165, faucetZ);
  const leverEnd = new THREE.Vector3(faucetX, topY + 0.33 - leverR - 0.002, faucetZ - 0.22);
  const leverDir = new THREE.Vector3().subVectors(leverEnd, leverStart);

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(leverR, leverR, leverDir.length(), 14), chrome);
  lever.position.copy(leverStart).lerp(leverEnd, 0.5);
  lever.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), leverDir.clone().normalize());
  lever.castShadow = true;
  group.add(lever);

  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(leverR + 0.002, 16, 12), chrome);
  leverKnob.position.copy(leverEnd);
  leverKnob.castShadow = true;
  group.add(leverKnob);
}

/** Dispatcher vrchních detailů podle topFeature.type katalogového přístroje. */
export function applyTopFeature(group, def, segment, widthM, depthM, topY) {
  const type = def.topFeature ? def.topFeature.type : 'none';
  switch (type) {
    case 'burners4':
      buildGasStoveTop(group, widthM, depthM, topY);
      break;
    case 'burners2':
      buildGasStove2Top(group, widthM, depthM, topY);
      break;
    case 'ceramic4':
      buildCeramicTop(group, widthM, depthM, topY, def.topFeature || {});
      break;
    case 'induction':
      buildInductionTop(group, widthM, depthM, topY);
      break;
    case 'fryer2':
      buildFryerTop(group, widthM, depthM, topY, def.topFeature || {});
      break;
    case 'fryer1':
      buildFryer1Top(group, widthM, depthM, topY);
      break;
    case 'grill':
      buildGrillTop(group, widthM, depthM, topY, def.topFeature || {});
      break;
    case 'bainmarie':
      buildBainMarieTop(group, widthM, depthM, topY);
      break;
    case 'multipan':
      buildMultiPanTop(group, widthM, depthM, topY);
      break;
    case 'sink': {
      const vatWidthM = mm(clamp(Number(segment.vatWidthMM) || SINK_VAT_WIDTH_DEFAULT, SINK_VAT_WIDTH_MIN, SINK_VAT_WIDTH_MAX));
      const vatDepthM = mm(clamp(Number(segment.vatDepthMM) || SINK_VAT_DEPTH_DEFAULT, SINK_VAT_DEPTH_MIN, SINK_VAT_DEPTH_MAX));
      buildSinkTop(group, widthM, depthM, topY, vatWidthM, vatDepthM);
      break;
    }
    default:
      break; // 'none' / 'bitmap' — bez typové kresby na desce
  }
}

// --- Bitmapový overlay (horní plocha desky segmentu) --------------------------

/** Přidá tenkou desku s texturou nahrané bitmapy na horní plochu segmentu. */
function addBitmapOverlay(group, widthM, depthM, topY, dataURL) {
  const overlayWidth = Math.max(widthM - 0.02, 0.02);
  const overlayDepth = Math.max(depthM - 0.02, 0.02);
  const geometry = new THREE.BoxGeometry(overlayWidth, 0.004, overlayDepth);
  const material = createBitmapMaterial(null);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, topY + 0.004, depthM / 2);
  mesh.receiveShadow = true;
  group.add(mesh);

  loadBitmapTexture(dataURL, (texture) => {
    material.map = texture;
    material.needsUpdate = true;
  });

  return mesh;
}

// --- Veřejné tovární funkce pro celé segmenty -----------------------------------

/**
 * Vytvoří kompletní segment (podestavba + panel + ovládací prvky + typové
 * detaily na desce). `topY` je absolutní výška horní plochy průběžné desky
 * (workHeightM), použitá pro umístění detailů, které "sedí" na desce.
 * `plinth` (`{type, heightMM}`) je vlastnost CELÉHO BLOKU (ZADANI-SOKL.md,
 * 31. 8. 2026) — dodává ji volající (block.js), segment.plinth se pro
 * kreslení nečte. Výchozí `{}` spadne na DEFAULT_PLINTH/PLINTH_HEIGHT_DEFAULT_MM.
 */
export function createSegmentMesh(segment, depthM, workHeightM, plinth = {}) {
  const widthMM = getSegmentWidthMM(segment);
  const widthM = mm(widthMM);
  const bodyTopY = workHeightM - TOP_THICKNESS; // podklad těsně pod průběžnou deskou
  const panelBottomY = bodyTopY - PANEL_HEIGHT;
  const plinthType = PLINTH_TYPES.includes(plinth.type) ? plinth.type : DEFAULT_PLINTH;
  const plinthHeightM = mm(clamp(Number(plinth.heightMM) || PLINTH_HEIGHT_DEFAULT_MM, PLINTH_HEIGHT_MIN_MM, PLINTH_HEIGHT_MAX_MM));
  const bodyBottomY = plinthHeightM; // nahrazuje dřívější pevnou PLINTH_HEIGHT

  const group = new THREE.Group();
  group.userData.id = segment.id;
  group.userData.type = segment.type;
  group.userData.widthMM = widthMM;
  group.userData.label = getSegmentLabel(segment);

  buildPlinth(group, widthM, depthM, plinthType, plinthHeightM);

  if (segment.type === NEUTRAL_TYPE) {
    // Dutina = vnitřní prostor podestavby; pokud má segment panel, dutina
    // pod ním končí (panel do dutiny nepatří) — §4 SPEC v3. Styl (open/doors)
    // se bere ze sdílené getSegmentBodyStyle, ne z vlastního inline výrazu.
    const style = getSegmentBodyStyle(segment);
    const cavityTopY = segment.hasPanel ? panelBottomY : bodyTopY;
    buildBodyByStyle(group, style, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, !!segment.hasShelf);
    if (segment.hasPanel) {
      // ovládací panel je jen předsazená dekorace navíc před horní pás čela,
      // korpus pod ním zůstává celý (žádná díra vzadu)
      buildPanelBand(group, widthM, panelBottomY, bodyTopY);
    }
    return group;
  }

  if (segment.type === DRAWERS_TYPE) {
    // stejné pravidlo jako u neutrálního modulu — má-li segment panel,
    // prostor pro čela pod ním končí (panel do zásuvek nepatří)
    const cavityTopY = segment.hasPanel ? panelBottomY : bodyTopY;
    buildDrawersBody(group, widthM, depthM, bodyBottomY, bodyTopY, cavityTopY, getSegmentDrawerCount(segment));
    if (segment.hasPanel) {
      buildPanelBand(group, widthM, panelBottomY, bodyTopY);
    }
    return group;
  }

  if (segment.type === CUSTOM_TYPE) {
    buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
    const { centerY, frontZ } = buildPanelBand(group, widthM, panelBottomY, bodyTopY);
    renderControls(group, widthM, centerY, frontZ, segment.controlsType || 'knob', segment.controlsCount || 0);
    if (segment.imageDataURL) {
      addBitmapOverlay(group, widthM, depthM, workHeightM, segment.imageDataURL);
    }
    return group;
  }

  // katalogový přístroj (built-in i vlastní z katalogu)
  const def = getCatalogEntry(segment.type);
  if (!def) {
    // neznámý typ — vykreslí se jako prázdná uzavřená výplň, ať aplikace nespadne
    buildClosedBody(group, widthM, depthM, bodyBottomY, bodyTopY);
    return group;
  }
  buildBodyByStyle(group, getSegmentBodyStyle(segment), widthM, depthM, bodyBottomY, bodyTopY);
  const { centerY, frontZ } = buildPanelBand(group, widthM, panelBottomY, bodyTopY);
  // §10.1 SPEC v4 — u topFixed přístrojů se prvek na desce i seskupení
  // ovládacích prvků kreslí ve JMENOVITÉ šířce (katalogové widthMM), vodorovně
  // vystředěné, bez ohledu na skutečnou (zvětšenou) šířku podestavby.
  const topWidthM = def.topFixed ? mm(def.widthMM) : widthM;
  renderControls(group, topWidthM, centerY, frontZ, def.controls.type, def.controls.count);
  decoratePanelExtras(group, def.topFeature ? def.topFeature.type : 'none', topWidthM, centerY, frontZ);
  applyTopFeature(group, def, segment, topWidthM, depthM, workHeightM);
  if (def.imageDataURL) {
    addBitmapOverlay(group, widthM, depthM, workHeightM, def.imageDataURL);
  }
  return group;
}

/**
 * Vytvoří jednoduchou "výplňovou" podestavbu bez panelu (prázdný úsek desky).
 * `plinth` viz createSegmentMesh() výš — vlastnost CELÉHO BLOKU, ne výplně.
 */
export function createFillerMesh(widthMM, depthM, workHeightM, plinth = {}) {
  const widthM = mm(widthMM);
  const plinthType = PLINTH_TYPES.includes(plinth.type) ? plinth.type : DEFAULT_PLINTH;
  const plinthHeightM = mm(clamp(Number(plinth.heightMM) || PLINTH_HEIGHT_DEFAULT_MM, PLINTH_HEIGHT_MIN_MM, PLINTH_HEIGHT_MAX_MM));
  const group = new THREE.Group();
  group.userData.filler = true;
  buildPlinth(group, widthM, depthM, plinthType, plinthHeightM);
  buildClosedBody(group, widthM, depthM, plinthHeightM, workHeightM - TOP_THICKNESS);
  return group;
}

export { addEdges, box };
