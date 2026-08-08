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
// Do 3D se i tak staví jen JEDEN úsek herdbloku přes celou délku bloku —
// přístroje (state.mono.herdblok, resp. layout.herdblok) se ve 3D nekreslí
// (viz "Co se teď NEDĚLÁ" v zadání), proto se layout.herdblok tady vůbec
// nečte; z výstupu layoutu se bere jen lengthMM, podestavby a panelItems.

import {
  buildMonoBlock,
  END_TYPES,
  COLLAR_HEIGHT_DEFAULT_MM,
  WORK_HEIGHT_MIN_MM,
  WORK_HEIGHT_MAX_MM,
} from './mono-geometry.js';
import { computeMonoLayout } from './mono-layout.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Tolerantní čtení typu zakončení — neplatná/chybějící hodnota spadne na
 *  END_TYPES.VERTICAL_PLATE (stejné pravidlo jako sanitizace v main.js). */
function readEndType(value) {
  return value === END_TYPES.VERTICAL_PLATE_CHAMFER
    ? END_TYPES.VERTICAL_PLATE_CHAMFER
    : END_TYPES.VERTICAL_PLATE;
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
 * @param {object} [limec] MonoCollar ze state.mono — může chybět (starší/cizí stav)
 * @returns {Array<{edge:'back'|'left'|'right', heightMM:number}>}
 */
function buildCollarSpec(limec) {
  const l = limec || {};
  const heightMM = l.heightMM ?? COLLAR_HEIGHT_DEFAULT_MM;
  const collar = [];
  if (l.back) collar.push({ edge: 'back', heightMM });
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
  const { depthAMM, heightMM } = state.dimensions;

  // §krok 1 zadání — pracovní výška MONO je 850–900, na rozdíl od SEGMENTu
  // (850–950, viz modules.js HEIGHT_MIN/MAX) — ořízne se tu, ne až uvnitř
  // buildMonoBlock (i když si to i ono ořízne samo, hodnota se čte i níž
  // pro `dimensions.heightMM`).
  const workHeightMM = clamp(heightMM, WORK_HEIGHT_MIN_MM, WORK_HEIGHT_MAX_MM);

  // §krok 2 zadání — typy konců; chybějící state.mono (starší/cizí stav)
  // nespadne, jen se použije výchozí typ na obou koncích.
  const monoState = state.mono || {};
  const leftEndType = readEndType(monoState.leftEndType);
  const rightEndType = readEndType(monoState.rightEndType);

  // §krok 3 zadání — JEDINÝ zdroj poloh podél X (délka, podestavby, prvky
  // panelu) je computeMonoLayout(state) — mono-layout.js. Tenhle adaptér
  // si nic z toho sám nedopočítává (viz hlavička souboru).
  const layout = computeMonoLayout(state);
  const lengthMM = layout.lengthMM;

  // Podestavby: geometrii zajímají jen SKUTEČNÉ skříňky (kind:'cabinet') —
  // 'gap' je úmyslně vynechané místo (most), layout ho vrací kvůli UI
  // (kreslí se šedě jako volný prostor), ale žádné těleso pro něj nevzniká.
  // xMM se ZRCADLÍ (viz mirrorX výš) — layout dává xMM jako levou hranu v
  // pásu, mirrorX ji převede na odpovídající levou hranu v prohozené
  // geometrii.
  const podestavby = layout.podestavby
    .filter(({ item }) => item.kind === 'cabinet')
    .map(({ xMM, widthMM }) => ({ xMM: mirrorX(xMM, lengthMM, widthMM), widthMM }));

  // Prvky panelu: computeMonoLayout() je vrací už oříznuté do použitelného
  // rozsahu (zadání §2); tady se jen převedou na tvar, který čeká
  // buildMonoBlock/buildPanelItem (kind/xMM/heightMM, xMM ABSOLUTNÍ po délce
  // bloku — na lokální souřadnici úseku je převádí až mono-geometry.js).
  // xMM je poloha STŘEDU prvku (ZADANI-MONO-UI.md §1, MonoPanelItem.xMM), ne
  // levá hrana — mirrorX se proto volá BEZ widthMM (bodové zrcadlení).
  const panelItems = layout.panelItems.map(({ item, xMM }) => ({
    kind: item.kind,
    xMM: mirrorX(xMM, lengthMM),
    heightMM: item.heightMM,
  }));

  // §krok 4 zadání — jediný úsek herdbloku přes celou délku bloku (fyzicky
  // existuje jen jedna deska/korpus/panel/lišta — přístroje se do něj jen
  // OSAZUJÍ, nekreslí se ve 3D samostatně, viz "Co se teď NEDĚLÁ").
  //
  // xMM se zrcadlí stejně jako u podestaveb (tady vyjde beze změny, protože
  // úsek pokrývá celou délku 0..lengthMM, ale vzorec se používá pořád stejný
  // — viz mirrorX výš). leftEndType/rightEndType se PROHAZUJÍ: pásové levé
  // zakončení (leftEndType) skončí po zrcadlení na geometrické straně
  // x = widthMM (kladné world X po vystředění = vlevo na obrazovce), tu ale
  // buildHerdblokUsek staví jako svůj rightEndType — proto se sem posílá
  // prohozeně (stejná záměna jako v buildCollarSpec výš).
  const herdblok = [{
    xMM: mirrorX(0, lengthMM, lengthMM),
    widthMM: lengthMM,
    depthMM: depthAMM,
    leftEndType: rightEndType,
    rightEndType: leftEndType,
    collar: buildCollarSpec(monoState.limec),
  }];

  const { group } = buildMonoBlock({ workHeightMM, podestavby, herdblok, panelItems });

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
  const dimensions = {
    lengthMM: Math.round(lengthMM),
    depthMM: Math.round(depthAMM),
    depthAMM: Math.round(depthAMM),
    depthBMM: 0,
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
