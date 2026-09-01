// mono-block.js — adaptér mezi stavem aplikace (main.js) a čistou geometrií
// produktu ALBA MONO (mono-geometry.js). Je to JEDINÉ místo v appce, které
// zná OBOJÍ — stav i geometrii; mono-geometry.js zůstává bez vazby na stav
// aplikace a main.js/ui.js nemají žádnou vazbu na mono-geometry.js přímo.
//
// buildMonoScene(state) vrací objekt VE STEJNÉM TVARU jako buildBlock()
// (block.js) — main.js (rebuildScene) i ui.js (render) s ním pak pracují
// beze změny bez ohledu na to, který produkt (SEGMENT/MONO) je zvolený.
//
// Řady herdbloku/podestaveb/prvků panelu se UKLÁDAJÍ do state.mono (viz
// zadání §1) a POLOHY se z nich odvozují VÝHRADNĚ přes computeMonoLayout()
// z mono-layout.js — ten modul je jediné místo, které polohy počítá (viz
// zadání §2, "Nikdo jiný si polohy nepočítá — ani ui, ani geometrie"). Tenhle
// adaptér si tedy žádnou řadu sám nedopočítává, jen layout výstup převádí do
// tvaru, který čeká buildMonoBlock().
//
// Tělo herdbloku se i tak staví jen jako JEDEN úsek přes celou délku bloku —
// přístroje (state.mono.herdblok, resp. layout.herdblok) do korpusu žádný
// výřez nedělají (deska zůstává celá, viz TODO u devicesGroup níže), jen se
// na ni navrch OSADÍ přes tentýž dispatcher vrchních detailů jako SEGMENT
// (modules.js applyTopFeature) — layout.herdblok se pro tohle níž čte.

import * as THREE from 'three';
import {
  buildMonoBlock,
  END_TYPES,
  COLLAR_HEIGHT_DEFAULT_MM,
  WORK_HEIGHT_MIN_MM,
  WORK_HEIGHT_MAX_MM,
  DESK_FACE_HEIGHT_MM,
  PANEL_SETBACK_MM,
  PANEL_HEIGHT_MM,
  LISTA_HEIGHT_MM,
} from './mono-geometry.js';
import { computeMonoLayout } from './mono-layout.js';
import {
  createArmMesh,
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
  ARM_CENTER_OFFSET_DEFAULT,
} from './arms.js';
import {
  applyTopFeature,
  renderControls,
  FINISH_TYPES,
  DEFAULT_FINISH,
  PLINTH_TYPES,
  PLINTH_HEIGHT_MIN_MM,
  PLINTH_HEIGHT_MAX_MM,
  PLINTH_HEIGHT_DEFAULT_MM,
} from './modules.js';
import { getById as getCatalogEntry } from './catalog.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Tolerantní čtení typu zakončení — neplatná/chybějící hodnota spadne na
 *  END_TYPES.VERTICAL_PLATE (stejné pravidlo jako sanitizace v main.js). */
function readEndType(value) {
  return value === END_TYPES.VERTICAL_PLATE_CHAMFER
    ? END_TYPES.VERTICAL_PLATE_CHAMFER
    : END_TYPES.VERTICAL_PLATE;
}

/** Tolerantní čtení MonoCabinet.finish (ZADANI-MONO-UI.md §1, PREDANI.md
 *  úkol 9b) — neplatná/chybějící hodnota spadne na DEFAULT_FINISH, stejné
 *  pravidlo jako sanitizeFinish v main.js / getSegmentFinish v modules.js.
 *  state.mono.podestavby už chodí sanitizované z main.js, ale tenhle adaptér
 *  si to ověřuje samostatně, stejně jako readEndType výš — žádný pád, žádné
 *  tiché "bez radiusu" jen proto, že hodnota chybí. */
function readFinish(value) {
  return FINISH_TYPES.includes(value) ? value : DEFAULT_FINISH;
}

/** Tolerantní čtení soklu (ZADANI-SOKL.md) — neznámý/chybějící type spadne
 *  na výchozí 'construction', heightMM se zaclampe do rozsahu 50–150 a
 *  zaokrouhlí na celé číslo (chybějící → 150, výchozí PLINTH_HEIGHT_DEFAULT_MM).
 *  Adaptér si to ověřuje samostatně (state.plinth chází nebo je neznámý). */
function sanitizePlinth(plinthObj) {
  const p = plinthObj || {};
  const type = PLINTH_TYPES.includes(p.type) ? p.type : 'construction';
  const heightMM = clamp(
    Math.floor(Number(p.heightMM) || PLINTH_HEIGHT_DEFAULT_MM),
    PLINTH_HEIGHT_MIN_MM,
    PLINTH_HEIGHT_MAX_MM
  );
  return { type, heightMM };
}

// --- zrcadlení osy X: pás čte polohy ZLEVA (mm od levé hrany bloku), ale
// mono-geometry.js staví lokální x od 0 doprava beze změny a předává je
// dál. Změřeno přes skutečnou kameru computeViews() (js/viewer.js): kamera
// čelního i perspektivního pohledu se dívá ve směru +Z a KLADNÉ world X se
// promítá VLEVO na obrazovce (ndcX < 0), ZÁPORNÉ world X VPRAVO — a tahle
// kamera je sdílená se SEGMENTem, který ji čte správně (block.js dává
// prvnímu segmentu — vlevo v pásu — nejvyšší +X), takže se měnit nesmí.
// mono-geometry.js staví lokální x od 0 (vlevo v pásu) doprava; po
// vystředění (group.position.x = -lengthMM/2, viz níž) by tak první
// položka z pásu dostala NEJZÁPORNĚJŠÍ world X → vpravo na obrazovce misto
// vlevo. Proto se PŘED voláním buildMonoBlock() zrcadlí každá souřadnice,
// která nese polohu podél X, kolem středu bloku (lengthMM).
//
// Pro položku se ZAČÁTKEM (xMM = levá hrana v pásu) a šířkou widthMM vyjde
// zrcadlený začátek jako lengthMM − (xMM + widthMM) — to je stejný vzorec
// jako mirrorX(xMM, lengthMM, widthMM). Pro BODOVOU polohu (střed, žádná
// šířka — panelItems) stačí vynechat widthMM (výchozí 0): lengthMM − xMM.
function mirrorX(xMM, lengthMM, widthMM = 0) {
  return lengthMM - xMM - widthMM;
}

/**
 * ÚKOL 17 (PREDANI.md) — souřadnice čelního ovládacího panelu MONO pro
 * renderControls(), v prostoru DEVICE GROUP (deviceGroup/`group` parametr
 * volání níž), ne v absolutním prostoru bloku. POZOR: nesmí se přebírat ze
 * SEGMENTu (modules.js#buildPanelBand) — MONO má panel jinde, viz
 * mono-geometry.js hlavička ("Souřadný systém").
 *
 * Y (panelCenterY, ABSOLUTNÍ — beze změny na deviceGroup se nepřevádí):
 * herdblokGroup/herdblokBGroup v mono-geometry.js#buildMonoBlock dostávají
 * jen posun v Y (workHeight − HERDBLOK_HEIGHT_MM), Z posun žádný — a
 * devicesGroup/devicesBGroup (tento soubor) mají position.y vždy 0 (viz
 * deviceGroup.position.set(centerXM, 0, …) na obou voláních níž). `topY`,
 * který dostává applyTopFeature, je tedy ABSOLUTNÍ Y stejného prostoru jako
 * `group` vrácená z buildMonoBlock — přesně ten prostor, ve kterém
 * mono-geometry.js hlavička počítá "Roviny v ose Y": panel (bez lišty) leží
 * na workHeightMM − DESK_FACE_HEIGHT_MM (horní hrana) až o
 * (PANEL_HEIGHT_MM − LISTA_HEIGHT_MM) níž (dolní hrana) — při workHeightMM
 * 900 vychází 850..650, přesně jak PREDANI.md úkol 17 uvádí. Střed obou
 * hran je panelCenterY. Vzorec je STEJNÝ pro stranu A i B — buildHerdblokUsek
 * počítá obě strany se stejnými konstantami a rotace strany B (rotation.y =
 * Math.PI) na ose Y nic neotáčí.
 *
 * Z (panelFrontZ, LOKÁLNÍ vůči deviceGroup): panel začíná (svou nejpřednější
 * plochou) na PANEL_SETBACK_MM (25 mm) od líce desky — to je stejná
 * "nejpřednější plocha panelu", odkud SEGMENT odvozuje frontZ v
 * buildPanelBand (modules.js), jen v jiném číselném systému. Ve stejném
 * prostoru jako výš (Z se u herdblokGroup/herdblokBGroup taky neposouvá,
 * jen Y) je tedy PANEL_SETBACK_MM přímo Z souřadnice čela panelu v prostoru
 * `group`/devicesGroup. deviceGroup ale dostává vlastní position.z =
 * frontOffsetMM (odstup PŘÍSTROJE od líce desky, viz volání níž) — proto se
 * do LOKÁLNÍHO prostoru deviceGroup panelFrontZ převádí odečtením
 * frontOffsetMM. Stejný vzorec platí i pro stranu B: devicesBGroup sice celá
 * nese rotation.y=Math.PI a position (mm(lengthMM), 0, mm(totalDepthMM)),
 * ale deviceGroup uvnitř ní dostává STEJNOU raw (nezrcadlenou) konvenci jako
 * strana A (viz komentář u panelItemsB/podestavbyB výš) — rotace pak sama
 * převede klesající lokální Z (směrem k ovladačům, viz renderControls) na
 * rostoucí Z v absolutním prostoru, tedy za depthAMM, na VNĚJŠÍ líc panelu
 * B, přesně jak žádá PREDANI.md úkol 17.
 *
 * @param {number} workHeightMM pracovní výška bloku (stejná hodnota, jakou
 *   dostává buildMonoBlock a mm(workHeightMM) jako topY do applyTopFeature)
 * @param {number} frontOffsetMM item.frontOffsetMM přístroje (Z posun
 *   deviceGroup vůči líci desky, viz volání applyTopFeature níž)
 * @returns {{panelCenterY:number, panelFrontZ:number}} v metrech, lokální
 *   souřadnice pro renderControls(deviceGroup, …)
 */
function monoPanelGeometry(workHeightMM, frontOffsetMM) {
  const panelTopMM = workHeightMM - DESK_FACE_HEIGHT_MM; // horní hrana panelu (850 při 900)
  const panelBottomMM = panelTopMM - (PANEL_HEIGHT_MM - LISTA_HEIGHT_MM); // dolní hrana bez lišty (650 při 900)
  return {
    panelCenterY: mm((panelTopMM + panelBottomMM) / 2),
    panelFrontZ: mm(PANEL_SETBACK_MM - frontOffsetMM),
  };
}

/**
 * Sestaví pole `collar` pro buildHerdblokUsek ze state.mono.limec (MonoCollar,
 * viz zadání §1/§9): `back`/`left`/`right` → `{edge, heightMM}`. `front`
 * límec se NEPOUŽÍVÁ NIKDY — MonoCollar pro něj ani nemá pole.
 *
 * Podmínku "left/right se vykreslí jen na konci typu VERTICAL_PLATE" tady
 * NEDUPLIKUJEME — tu už hlídá buildHerdblokUsek sám (mono-geometry.js), stačí
 * mu edge poslat a on si rozhodne, jestli něco postaví.
 *
 * ZRCADLENÍ (viz mirrorX výš): `left`/`right` se tu PROHAZUJÍ. Pásové
 * "vlevo" musí ve 3D vyjít na geometrické straně x = widthMM (ta po
 * vystředění dostane kladné world X = vlevo na obrazovce, viz mirrorX) —
 * to je strana, kterou buildHerdblokUsek staví pod edge:'right'. Stejná
 * záměna, jakou níž dostává herdblok.leftEndType/rightEndType, takže
 * podmínka "left/right jen na konci VERTICAL_PLATE" uvnitř buildHerdblokUsek
 * i po záměně sedí na SPRÁVNÝ (odpovídající) konec.
 *
 * ÚKOL 6 (ostrov): `back` se u `variant === 'island'` NIKDY nezapíše do
 * výsledného pole, bez ohledu na uloženou hodnotu `limec.back` — ostrov
 * nemá záda (zadání, §9). `left`/`right` zrcadlení (viz níž) je STEJNÉ pro
 * obě varianty — je to o tom, jak se v UI čte "vlevo"/"vpravo" na obrazovce,
 * nezávisí na single/island.
 *
 * @param {object} [limec] MonoCollar ze state.mono — může chybět (starší/cizí stav)
 * @param {string} [variant] state.variant — 'single'|'island'
 * @returns {Array<{edge:'back'|'left'|'right', heightMM:number}>}
 */
function buildCollarSpec(limec, variant) {
  const l = limec || {};
  const heightMM = l.heightMM ?? COLLAR_HEIGHT_DEFAULT_MM;
  const collar = [];
  if (l.back && variant !== 'island') collar.push({ edge: 'back', heightMM });
  if (l.left) collar.push({ edge: 'right', heightMM }); // zrcadleno, viz JSDoc výš
  if (l.right) collar.push({ edge: 'left', heightMM });  // zrcadleno, viz JSDoc výš
  return collar;
}

/**
 * Sestaví 3D scénu bloku ALBA MONO ze stavu aplikace.
 *
 * @param {object} state stav aplikace (viz main.js) — čte se
 *   state.dimensions.{depthAMM,heightMM} a state.mono (leftEndType/
 *   rightEndType/limec přímo, zbytek přes computeMonoLayout).
 * @returns {{group:THREE.Group, selectable:Array, dimensions:object,
 *   capacityA:object, capacityB:object}} přesně tvar, jaký vrací buildBlock()
 *   z block.js.
 */
export function buildMonoScene(state) {
  const { depthAMM, depthBMM, heightMM } = state.dimensions;
  const isIsland = state.variant === 'island';

  // §krok 1 zadání — pracovní výška MONO je 850–900, na rozdíl od SEGMENTu
  // (850–950, viz modules.js HEIGHT_MIN/MAX) — ořízne se tu, ne až uvnitř
  // buildMonoBlock (i když si to i ono ořízne samo, hodnota se čte i níž
  // pro `dimensions.heightMM`).
  const workHeightMM = clamp(heightMM, WORK_HEIGHT_MIN_MM, WORK_HEIGHT_MAX_MM);

  // §krok 2 zadání — typy konců; chybějící state.mono (starší/cizí stav)
  // nespadne, jen se použije výchozí typ na obou koncích. SDÍLENÉ pro obě
  // strany A/B (viz ZADANI-MONO-OSTROV.md §3) — je to pořád tentýž blok.
  const monoState = state.mono || {};
  const leftEndType = readEndType(monoState.leftEndType);
  const rightEndType = readEndType(monoState.rightEndType);

  // §krok 3 zadání — JEDINÝ zdroj poloh podél X (délka, podestavby, prvky
  // panelu) je computeMonoLayout(state, side) — mono-layout.js. Tenhle
  // adaptér si nic z toho sám nedopočítává (viz hlavička souboru). Strana A
  // je vždy počítaná; strana B jen u `island` (u `single` je vždy prázdná,
  // viz smlouva ZADANI-MONO-OSTROV.md §3 — nepovinný 2. parametr spadá na 'A').
  const layoutA = computeMonoLayout(state, 'A');
  const layoutB = isIsland ? computeMonoLayout(state, 'B') : null;
  const lengthMM = layoutA.lengthMM;

  // Podestavby strany A: geometrii zajímají všechny SKUTEČNÉ podestavby
  // (kind !== 'gap') — 'gap' je úmyslně vynechané místo (most), layout ho
  // vrací kvůli UI (kreslí se šedě jako volný prostor), ale žádné těleso pro
  // něj nevzniká. xMM se ZRCADLÍ (viz mirrorX výš) — layout dává xMM jako
  // levou hranu v pásu, mirrorX ji převede na odpovídající levou hranu v
  // prohozené geometrii.
  //
  // `finish` (PREDANI.md úkol 9b) je vlastnost KAŽDÉ SKŘÍŇKY ZVLÁŠŤ, ne
  // celého bloku — čte se z item.finish (MonoCabinet.finish) TADY, uvnitř
  // stejného .map(), který zpracovává skříňky jednu po druhé, takže dvě
  // sousední skříňky v jedné řadě mohou mít každá jinou úpravu a tím pádem
  // i jiný tvar spodních koutů (viz buildPodestavba/FINISH_H2 v
  // mono-geometry.js). readFinish() ošetřuje chybějící/neznámou hodnotu.
  // kind/bodyStyle/hasShelf (§2 ZADANI-PODESTAVBY-MONO.md) — předány
  // GEOMETRII BEZE ZMĚNY přímo z item, stejně jako finish; buildPodestavba()
  // (mono-geometry.js) si sama ošetří chybějící/neznámou hodnotu (viz jeho
  // JSDoc — neznámý kind → 'cabinet', neznámý bodyStyle → 'closed'/'open').
  const podestavbyA = layoutA.podestavby
    .filter(({ item }) => item.kind !== 'gap')
    .map(({ item, xMM, widthMM }) => ({
      xMM: mirrorX(xMM, lengthMM, widthMM),
      widthMM,
      finish: readFinish(item.finish),
      kind: item.kind,
      bodyStyle: item.bodyStyle,
      hasShelf: item.hasShelf,
    }));

  // Podestavby strany B (jen `island`) — ÚKOL 6: BEZ mirrorX. Strana B se
  // staví v LOKÁLNÍCH souřadnicích a celá podskupina se ve mono-geometry.js
  // otočí rotation.y=Math.PI — druhé zrcadlení (mirrorX i teď) by se s tou
  // rotací vyrušilo špatným směrem (viz JSDoc buildMonoBlock v
  // mono-geometry.js pro odvození). ŽÁDNÉ záporné měřítko se nepoužívá.
  const podestavbyB = isIsland ? layoutB.podestavby
    .filter(({ item }) => item.kind !== 'gap')
    .map(({ item, xMM, widthMM }) => ({
      xMM,
      widthMM,
      finish: readFinish(item.finish),
      kind: item.kind,
      bodyStyle: item.bodyStyle,
      hasShelf: item.hasShelf,
    })) : [];

  // Prvky panelu strany A: computeMonoLayout() je vrací už oříznuté do
  // použitelného rozsahu (zadání §2); tady se jen převedou na tvar, který
  // čeká buildMonoBlock/buildPanelItem (kind/xMM/heightMM, xMM ABSOLUTNÍ po
  // délce bloku — na lokální souřadnici úseku je převádí až mono-geometry.js).
  // xMM je poloha STŘEDU prvku (ZADANI-MONO-UI.md §1, MonoPanelItem.xMM), ne
  // levá hrana — mirrorX se proto volá BEZ widthMM (bodové zrcadlení).
  const panelItemsA = layoutA.panelItems.map(({ item, xMM }) => ({
    kind: item.kind,
    xMM: mirrorX(xMM, lengthMM),
    heightMM: item.heightMM,
  }));

  // Prvky panelu strany B (jen `island`) — BEZ mirrorX, stejný důvod jako
  // u podestavbyB výš.
  const panelItemsB = isIsland ? layoutB.panelItems.map(({ item, xMM }) => ({
    kind: item.kind,
    xMM,
    heightMM: item.heightMM,
  })) : [];

  // §krok 4 zadání — jediný úsek herdbloku strany A přes celou délku bloku
  // (fyzicky existuje jen jedna deska/korpus/panel/lišta na stranu —
  // přístroje se do něj jen OSAZUJÍ, nekreslí se ve 3D samostatně, viz
  // "Co se teď NEDĚLÁ").
  //
  // xMM se zrcadlí stejně jako u podestaveb (tady vyjde beze změny, protože
  // úsek pokrývá celou délku 0..lengthMM, ale vzorec se používá pořád stejný
  // — viz mirrorX výš). leftEndType/rightEndType se PROHAZUJÍ: pásové levé
  // zakončení (leftEndType) skončí po zrcadlení na geometrické straně
  // x = widthMM (kladné world X po vystředění = vlevo na obrazovce), tu ale
  // buildHerdblokUsek staví jako svůj rightEndType — proto se sem posílá
  // prohozeně (stejná záměna jako v buildCollarSpec výš).
  //
  // ÚKOL 6: `collar` se posílá jen u `single` — u `island` se limec staví
  // JEDNOU nad kombinovaným obrysem (viz buildMonoBlock v mono-geometry.js,
  // top-level parametr `collar` níž), ne uvnitř tohohle úseku.
  const herdblokA = [{
    xMM: mirrorX(0, lengthMM, lengthMM),
    widthMM: lengthMM,
    depthMM: depthAMM,
    leftEndType: rightEndType,
    rightEndType: leftEndType,
    collar: isIsland ? [] : buildCollarSpec(monoState.limec, state.variant),
  }];

  // Úsek herdbloku strany B (jen `island`) — ÚKOL 6: leftEndType/rightEndType
  // SDÍLENÉ a NEPROHOZENÉ (na rozdíl od herdblokA výš) — rotation.y=Math.PI
  // fyzicky otočí celý tvar, takže žádná záměna typů není potřeba (ověřeno
  // odvozením v mono-geometry.js#buildMonoBlock JSDoc i měřením v přejímce).
  const depthBMMNum = isIsland ? (Number(depthBMM) || 0) : 0;
  const herdblokB = isIsland ? [{
    xMM: 0,
    widthMM: lengthMM,
    depthMM: depthBMMNum,
    leftEndType,
    rightEndType,
    collar: [],
  }] : [];

  // §krok sokl — ZADANI-SOKL.md: sanitizovaný sokl se předá do buildMonoBlock.
  // Ověří se type proti PLINTH_TYPES (výchozí 'construction') a heightMM se
  // zaclampuje na 50–150 (chybějící/neznámý → 150).
  const plinth = sanitizePlinth(state.plinth);

  const { group } = buildMonoBlock({
    workHeightMM,
    variant: state.variant,
    depthAMM,
    depthBMM: depthBMMNum,
    podestavbyA,
    herdblokA,
    panelItemsA,
    podestavbyB,
    herdblokB,
    panelItemsB,
    // ÚKOL 6, §9 — límec left/right nad kombinovaným obrysem, jen `island`.
    // `back` se sem NIKDY nepošle (buildCollarSpec ho pro island vynechá) —
    // a i kdyby, buildMonoBlock ho defenzivně ignoruje taky.
    collar: isIsland ? buildCollarSpec(monoState.limec, state.variant) : [],
    plinth,
  });

  // §doplněno (vada "přístroje se ve 3D nekreslí") — přístroje řady herdbloku
  // strany A se osadí NA rovinu pracovní desky přes tentýž dispatcher
  // vrchních detailů, jaký používá SEGMENT (modules.js applyTopFeature, viz
  // zadání ÚKOL A/B). Poloha je VÝHRADNĚ z computeMonoLayout(state,'A').herdblok
  // — adaptér si žádnou polohu sám nedopočítává, jen výstup layoutu převádí
  // do prostoru, ve kterém staví build*Top.
  //
  // TODO: výřez v desce pro vestavěný přístroj se v tomto kole VĚDOMĚ
  // NEDĚLÁ (rozhodnutí zadavatele) — přístroj jen sedí na celé, neděravé
  // desce; THREE.Shape.holes se nepoužívá. Až bude výřez zadaný, patří sem.
  const devicesGroup = new THREE.Group();
  devicesGroup.name = 'pristroje';
  layoutA.herdblok.forEach(({ item, xMM, widthMM }) => {
    if (item.type === 'surface') return; // pracovní plocha, ne přístroj — přeskočit

    const def = getCatalogEntry(item.type);
    if (!def) return; // neznámý katalogový klíč (přístroj vypadl z katalogu) — tiché přeskočení, žádný pád

    // Rozměr přístroje je šířka × hloubka: šířka je INSTANCE (item/layout
    // widthMM — uživatel si ji může nastavit), hloubka je KATALOGOVÁ
    // (def.depthMM) — zadání ÚKOL B.
    const widthM = mm(widthMM);
    const depthM = mm(def.depthMM);

    // Zrcadlení osy X (viz mirrorX výš) — xMM z layoutu je LEVÁ hrana
    // přístroje v pásu, stejně jako u podestaveb, proto se volá STEJNÝ
    // vzorec s widthMM. build*Top (modules.js) staví lokálně VYSTŘEDĚNĚ
    // kolem x=0 (změřeno na buildElectricStoveTop/buildGasStoveTop — deska/
    // hořáky jsou v rozsahu přibližně −widthM/2..+widthM/2), proto se k
    // zrcadlené levé hraně připočítává ještě polovina šířky, aby vyšel
    // střed, který build*Top očekává.
    const mirroredLeftMM = mirrorX(xMM, lengthMM, widthMM);
    const centerXM = mm(mirroredLeftMM + widthMM / 2);

    // Z: build*Top staví lokálně od z=0 (PŘEDNÍ hrana přístroje) do
    // z=depthM (zadní hrana) — změřeno stejně (např. buildElectricStoveTop
    // dává desku na z=depthM/2, tj. střed intervalu 0..depthM). Odstup od
    // přední hrany DESKY (item.frontOffsetMM, výchozí 100 mm) se proto
    // promítne přímo do posunu celé podskupiny v ose Z — zrcadlením osy X
    // se Z nemění (viz POZOR v zadání).
    const frontOffsetMM = item.frontOffsetMM ?? 100;

    const deviceGroup = new THREE.Group();
    deviceGroup.name = `pristroj-${item.type}`;
    // Y: sedí na rovině desky — stejná workHeightM, jakou dostává výš
    // buildMonoBlock (workHeightMM), nedopočítává se z jiného zdroje.
    deviceGroup.position.set(centerXM, 0, mm(frontOffsetMM));

    // `segment` parametr dispatcheru = item (MonoDevice) — používá se jen
    // pro rozměry vany dřezu (vatWidthMM/vatDepthMM), které MonoDevice nemá,
    // takže se uplatní výchozí hodnoty z modules.js (to je v pořádku, viz
    // zadání ÚKOL B).
    applyTopFeature(deviceGroup, def, item, widthM, depthM, mm(workHeightMM));

    // §doplněno (ÚKOL 17 PREDANI.md — "přístrojům se nekreslí ovládací
    // prvky") — knoflíky/tlačítka/vypínače na čelním panelu, stejný
    // dispatcher jako SEGMENT (modules.js renderControls), jen se
    // souřadnicemi panelu MONO (viz monoPanelGeometry výš, NE ze SEGMENTu).
    // def.controls.{type,count} je vždy definované (katalog ho sanitizuje,
    // viz js/catalog.js) — count 0 (přístroj bez ovladačů, např. dřez/deska)
    // renderControls sama tiše přeskočí, žádný pád.
    const { panelCenterY, panelFrontZ } = monoPanelGeometry(workHeightMM, frontOffsetMM);
    renderControls(deviceGroup, widthM, panelCenterY, panelFrontZ, def.controls.type, def.controls.count);
    devicesGroup.add(deviceGroup);
  });
  group.add(devicesGroup);

  // Přístroje strany B (jen `island`) — STEJNÝ princip jako zbytek strany B
  // v mono-geometry.js#buildMonoBlock: RAW (nezrcadlené) lokální souřadnice
  // uvnitř skupiny otočené o 180° kolem Y a umístěné stejně jako sideBGroup
  // tam (position.x=lengthMM, position.z=totalDepthMM — ŽÁDNÉ záporné
  // měřítko). totalDepthMM se tu počítá stejně jako uvnitř buildMonoBlock.
  const totalDepthMM = depthAMM + depthBMMNum;
  const devicesBGroup = new THREE.Group();
  devicesBGroup.name = 'pristroje-strana-b';
  if (isIsland) {
    devicesBGroup.rotation.y = Math.PI;
    devicesBGroup.position.set(mm(lengthMM), 0, mm(totalDepthMM));
    layoutB.herdblok.forEach(({ item, xMM, widthMM }) => {
      if (item.type === 'surface') return;
      const def = getCatalogEntry(item.type);
      if (!def) return;
      const widthM = mm(widthMM);
      const depthM = mm(def.depthMM);
      // RAW xMM (bez mirrorX) — rotace zajistí správnou stranu, stejně jako
      // u podestavbyB/panelItemsB výš.
      const centerXM = mm(xMM + widthMM / 2);
      const frontOffsetMM = item.frontOffsetMM ?? 100;
      const deviceGroup = new THREE.Group();
      deviceGroup.name = `pristroj-${item.type}`;
      deviceGroup.position.set(centerXM, 0, mm(frontOffsetMM));
      applyTopFeature(deviceGroup, def, item, widthM, depthM, mm(workHeightMM));

      // ÚKOL 17 — stejné volání jako strana A výš; monoPanelGeometry je
      // beze změny pro obě strany (viz JSDoc), rotation.y=Math.PI
      // devicesBGroup samo převede klesající lokální Z na vnější líc panelu
      // B (z > depthAMM v absolutním prostoru), přesně jak žádá PREDANI.md.
      const { panelCenterY, panelFrontZ } = monoPanelGeometry(workHeightMM, frontOffsetMM);
      renderControls(deviceGroup, widthM, panelCenterY, panelFrontZ, def.controls.type, def.controls.count);
      devicesBGroup.add(deviceGroup);
    });
  }
  group.add(devicesBGroup);

  // §doplněno (vada "ramena se ve 3D nevykreslí") — napouštěcí ramena.
  // state.arms je SDÍLENÉ pole se SEGMENTem (main.js/ui.js
  // onAddArm/onArmPositionChange/onArmOffsetChange/onArmAngleChange), sem se
  // čte přímo ze `state`, protože buildMonoScene(state) dostává celý stav.
  //
  // ÚKOL 6 (ostrov): JEDNA sada ramen na spáře mezi stranami A/B (ne dvě) —
  // u `island` se odsazení měří od STŘEDU (spáry), u `single` od ZADNÍ
  // HRANY desky, přesně jako block.js#computeArmPlacement pro SEGMENT.
  // Poloha X (mirrorX) a negace úhlu se NEMĚNÍ mezi variantami — zrcadlením
  // osy X se mění smysl otáčení kolem Y bez ohledu na to, jak se počítá Z.
  const armsGroup = new THREE.Group();
  armsGroup.name = 'ramena';
  (state.arms || []).forEach((arm) => {
    // Poloha po délce je poloha BODU (ne levá hrana) → zrcadlí se přes
    // mirrorX(positionXMM, lengthMM) BEZ widthMM (viz JSDoc mirrorX výš,
    // stejné pravidlo jako u panelItems). Nejdřív se ořízne do platného
    // rozsahu 0..lengthMM — stejně jako block.js dělá pro SEGMENT.
    const clampedXMM = clamp(Number(arm.positionXMM) || 0, 0, lengthMM);
    const mirroredXMM = mirrorX(clampedXMM, lengthMM);

    let zLocalMM;
    let baseDir;
    if (isIsland) {
      // odsazení od STŘEDU (spáry mezi stranami A/B) — kopíruje
      // block.js#computeArmPlacement, větev island (viz zadání §8).
      const offsetMM = clamp(
        arm.offsetMM != null ? Number(arm.offsetMM) : ARM_CENTER_OFFSET_DEFAULT,
        ARM_CENTER_OFFSET_MIN,
        ARM_CENTER_OFFSET_MAX
      );
      zLocalMM = depthAMM + offsetMM;
      baseDir = 1;
    } else {
      // odsazení od ZADNÍ HRANY desky — beze změny oproti dřívějšímu chování.
      const offsetMM = clamp(
        arm.offsetMM != null ? Number(arm.offsetMM) : ARM_BACK_OFFSET_DEFAULT,
        ARM_BACK_OFFSET_MIN,
        ARM_BACK_OFFSET_MAX
      );
      zLocalMM = depthAMM - offsetMM;
      baseDir = -1;
    }

    const armMesh = createArmMesh(
      {
        ...arm,
        positionXMM: clampedXMM,
        // Úhel: zrcadlením osy X se mění i smysl otáčení kolem svislé osy Y
        // (arms.js ~ř. 118: pivot.rotation.y = degToRad(arm.angleDeg)) —
        // rameno natočené v pásu o +30° musí ve zrcadlené geometrii dostat
        // −30°, jinak by mířilo na opačnou stranu, než uživatel zadal.
        // Beze změny mezi variantami (§8 zadání — "úhel se dál neguje").
        angleDeg: -(Number(arm.angleDeg) || 0),
      },
      { lengthMM, zLocalMM, baseDir, workHeightM: mm(workHeightMM) }
    );
    // arms.js interně počítá group.position.x = lengthMM/2 − positionXMM —
    // vzorec ušitý na CENTROVANÝ prostor block.js (SEGMENT), kde se `group`
    // po přidání ramen dál neposouvá. mono-geometry.js ale staví v
    // NEcentrovaném prostoru (x 0..lengthMM, viz hlavička mono-geometry.js)
    // a celá `group` se navíc posune o -lengthMM/2 až NÍŽE (§krok 5) — kdyby
    // se ponechala x spočtená uvnitř arms.js, posun by se ramenu započetl
    // DVAKRÁT. Proto se x po vytvoření meshe PŘEPÍŠE přímo na souřadnici ve
    // stejném (necentrovaném) prostoru, jaký používají podestavby/herdblok
    // (mirroredXMM výš) — po společném posunu níž tak vyjde stejně jako u
    // ostatních prvků.
    armMesh.position.x = mm(mirroredXMM);
    armsGroup.add(armMesh);
  });
  group.add(armsGroup);

  // §krok 5 zadání — mono-geometry.js staví od x=0 doprava (x=0 je LEVÝ konec
  // bloku, viz hlavička mono-geometry.js), zatímco SEGMENT (block.js) má blok
  // vystředěný kolem x=0 (side panely na ±lengthMM/2, deska/segmenty
  // vystředěné stejně, viz buildSideSegments a boční krycí plechy v
  // block.js). Posun o polovinu délky srovná střed obou typů v ose X.
  group.position.x = -mm(lengthMM) / 2;

  // §krok 7 zadání — stejný tvar, jaký main.js ukládá do state.builtDimensions
  // (rebuildScene() z něj čte depthMM pro cíl světla, reframeCamera()
  // lengthMM/depthMM pro kameru). MONO zatím nemá automatické zvětšování
  // hloubky (to je vlastnost katalogových přístrojů SEGMENTu, viz
  // computeSideDepth v block.js) — ui.js čte depthGrownA/B a depthReasonsA/B
  // u obou produktů bezpodmínečně, proto tu musí být i pro MONO.
  //
  // ÚKOL 6: depthBMM se u `island` už NESTAVÍ natvrdo na 0 — čte se ze
  // state.dimensions.depthBMM stejně, jako to dělá block.js pro SEGMENT.
  const dimensions = {
    lengthMM: Math.round(lengthMM),
    // OPRAVA O2: u `island` je celková hloubka bloku součet obou stran
    // (depthAMM + depthBMM) — stejné pravidlo jako block.js#totalDepthMM pro
    // SEGMENT (ř. 199/261 tamtéž). U `single` zůstává beze změny (depthBMMNum
    // je tam vždy 0, viz definice depthBMMNum výš).
    depthMM: Math.round(isIsland ? depthAMM + depthBMMNum : depthAMM),
    depthAMM: Math.round(depthAMM),
    depthBMM: isIsland ? Math.round(depthBMMNum) : 0,
    heightMM: Math.round(workHeightMM),
    depthGrownA: false,
    depthGrownB: false,
    depthReasonsA: [],
    depthReasonsB: [],
  };

  // §krok 6 zadání — MONO zatím nemá vybíratelné prvky; prázdné pole je
  // bezpečné pro updateSelectionHighlight() v main.js (entry = undefined →
  // state.selectedId se vynuluje, badge se schová, nic nespadne).
  const selectable = [];

  // §krok 8 zadání — MONO nemá pevnou "schránku" segmentů/kapacitu jako
  // SEGMENT; nulová kapacita je neutrální hodnota, se kterou si ui.js
  // (renderStripCapacity/renderPaletteList) poradí beze změny a bez pádu.
  const capacity = { usedMM: 0, capacityMM: 0, results: [] };

  return {
    group,
    selectable,
    dimensions,
    capacityA: capacity,
    capacityB: capacity,
  };
}
