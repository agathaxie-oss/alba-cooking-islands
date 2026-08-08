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
} from './mono-geometry.js';
import { computeMonoLayout } from './mono-layout.js';
import {
  createArmMesh,
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
} from './arms.js';
import { applyTopFeature, FINISH_TYPES, DEFAULT_FINISH } from './modules.js';
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
  //
  // `finish` (PREDANI.md úkol 9b) je vlastnost KAŽDÉ SKŘÍŇKY ZVLÁŠŤ, ne
  // celého bloku — čte se z item.finish (MonoCabinet.finish) TADY, uvnitř
  // stejného .map(), který zpracovává skříňky jednu po druhé, takže dvě
  // sousední skříňky v jedné řadě mohou mít každá jinou úpravu a tím pádem
  // i jiný tvar spodních koutů (viz buildPodestavba/FINISH_H2 v
  // mono-geometry.js). readFinish() ošetřuje chybějící/neznámou hodnotu.
  const podestavby = layout.podestavby
    .filter(({ item }) => item.kind === 'cabinet')
    .map(({ item, xMM, widthMM }) => ({
      xMM: mirrorX(xMM, lengthMM, widthMM),
      widthMM,
      finish: readFinish(item.finish),
    }));

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

  // §doplněno (vada "přístroje se ve 3D nekreslí") — přístroje řady herdbloku
  // se osadí NA rovinu pracovní desky přes tentýž dispatcher vrchních detailů,
  // jaký používá SEGMENT (modules.js applyTopFeature, viz zadání ÚKOL A/B).
  // Poloha je VÝHRADNĚ z computeMonoLayout(state).herdblok — layout.herdblok
  // se tu (na rozdíl od komentáře v hlavičce souboru, který popisoval STAV
  // PŘED touto opravou) už čte, adaptér si ale žádnou polohu sám nedopočítává,
  // jen výstup layoutu převádí do prostoru, ve kterém staví build*Top.
  //
  // TODO: výřez v desce pro vestavěný přístroj se v tomto kole VĚDOMĚ
  // NEDĚLÁ (rozhodnutí zadavatele) — přístroj jen sedí na celé, neděravé
  // desce; THREE.Shape.holes se nepoužívá. Až bude výřez zadaný, patří sem.
  const devicesGroup = new THREE.Group();
  devicesGroup.name = 'pristroje';
  layout.herdblok.forEach(({ item, xMM, widthMM }) => {
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
    devicesGroup.add(deviceGroup);
  });
  group.add(devicesGroup);

  // §doplněno (vada "ramena se ve 3D nevykreslí") — napouštěcí ramena.
  // state.arms je SDÍLENÉ pole se SEGMENTem (main.js/ui.js
  // onAddArm/onArmPositionChange/onArmOffsetChange/onArmAngleChange), sem se
  // čte přímo ze `state`, protože buildMonoScene(state) dostává celý stav.
  //
  // MONO zatím nemá ostrovní variantu (viz TODO v main.js rebuildScene()
  // ~ř. 519 — MONO se chová jako 'single') — postaveno je tu proto jen
  // umístění "u stěny": odsazení arm.offsetMM se měří OD ZADNÍ HRANY DESKY
  // dopředu, stejný vzorec jako block.js computeArmPlacement (jednostranná
  // větev, viz i18n klíč mono.armsNote). Rameno sedí NA DESCE (workHeightMM,
  // stejná hodnota, jakou buildMonoScene výš předává do buildMonoBlock —
  // nedopočítává se znovu z jiného zdroje), z-hloubka vychází z depthAMM
  // (stejná hodnota, jaká jde výš do herdblok[0].depthMM).
  // TODO(PREDANI.md úkol 6): až MONO dostane ostrovní variantu, přibude
  // sem i druhá větev (odsazení od středu/spáry mezi stranami A/B) —
  // ARM_CENTER_OFFSET_MIN/MAX/DEFAULT z arms.js, stejně jako u SEGMENTu.
  const armsGroup = new THREE.Group();
  armsGroup.name = 'ramena';
  (state.arms || []).forEach((arm) => {
    // Poloha po délce je poloha BODU (ne levá hrana) → zrcadlí se přes
    // mirrorX(positionXMM, lengthMM) BEZ widthMM (viz JSDoc mirrorX výš,
    // stejné pravidlo jako u panelItems). Nejdřív se ořízne do platného
    // rozsahu 0..lengthMM — stejně jako block.js dělá pro SEGMENT.
    const clampedXMM = clamp(Number(arm.positionXMM) || 0, 0, lengthMM);
    const mirroredXMM = mirrorX(clampedXMM, lengthMM);

    // Odsazení od zadní hrany — Z se zrcadlením OSY X NEMĚNÍ (viz zadání,
    // bod 3), proto tu žádné zrcadlo není. Stejný vzorec jako block.js
    // computeArmPlacement, jednostranná (wall) větev.
    const offsetMM = clamp(
      arm.offsetMM != null ? Number(arm.offsetMM) : ARM_BACK_OFFSET_DEFAULT,
      ARM_BACK_OFFSET_MIN,
      ARM_BACK_OFFSET_MAX
    );
    const zLocalMM = depthAMM - offsetMM;

    const armMesh = createArmMesh(
      {
        ...arm,
        positionXMM: clampedXMM,
        // Úhel: zrcadlením osy X se mění i smysl otáčení kolem svislé osy Y
        // (arms.js ~ř. 118: pivot.rotation.y = degToRad(arm.angleDeg)) —
        // rameno natočené v pásu o +30° musí ve zrcadlené geometrii dostat
        // −30°, jinak by mířilo na opačnou stranu, než uživatel zadal.
        angleDeg: -(Number(arm.angleDeg) || 0),
      },
      { lengthMM, zLocalMM, baseDir: -1, workHeightM: mm(workHeightMM) }
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
