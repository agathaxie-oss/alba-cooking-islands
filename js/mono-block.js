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

/**
 * Sestaví pole `collar` pro buildHerdblokUsek ze state.mono.limec (MonoCollar,
 * viz zadání §1/§9): `back`/`left`/`right` → `{edge, heightMM}`. `front`
 * límec se NEPOUŽÍVÁ NIKDY — MonoCollar pro něj ani nemá pole.
 *
 * Podmínku "left/right se vykreslí jen na konci typu VERTICAL_PLATE" tady
 * NEDUPLIKUJEME — tu už hlídá buildHerdblokUsek sám (mono-geometry.js), stačí
 * mu edge poslat a on si rozhodne, jestli něco postaví.
 *
 * @param {object} [limec] MonoCollar ze state.mono — může chybět (starší/cizí stav)
 * @returns {Array<{edge:'back'|'left'|'right', heightMM:number}>}
 */
function buildCollarSpec(limec) {
  const l = limec || {};
  const heightMM = l.heightMM ?? COLLAR_HEIGHT_DEFAULT_MM;
  const collar = [];
  if (l.back) collar.push({ edge: 'back', heightMM });
  if (l.left) collar.push({ edge: 'left', heightMM });
  if (l.right) collar.push({ edge: 'right', heightMM });
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
  const podestavby = layout.podestavby
    .filter(({ item }) => item.kind === 'cabinet')
    .map(({ xMM, widthMM }) => ({ xMM, widthMM }));

  // Prvky panelu: computeMonoLayout() je vrací už oříznuté do použitelného
  // rozsahu (zadání §2); tady se jen převedou na tvar, který čeká
  // buildMonoBlock/buildPanelItem (kind/xMM/heightMM, xMM ABSOLUTNÍ po délce
  // bloku — na lokální souřadnici úseku je převádí až mono-geometry.js).
  const panelItems = layout.panelItems.map(({ item, xMM }) => ({
    kind: item.kind,
    xMM,
    heightMM: item.heightMM,
  }));

  // §krok 4 zadání — jediný úsek herdbloku přes celou délku bloku (fyzicky
  // existuje jen jedna deska/korpus/panel/lišta — přístroje se do něj jen
  // OSAZUJÍ, nekreslí se ve 3D samostatně, viz "Co se teď NEDĚLÁ").
  const herdblok = [{
    xMM: 0,
    widthMM: lengthMM,
    depthMM: depthAMM,
    leftEndType,
    rightEndType,
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
