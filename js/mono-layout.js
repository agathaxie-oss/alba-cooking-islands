// mono-layout.js — ČISTÝ výpočet rozvržení pásu ALBA MONO.
//
// Vstupem je state.mono (viz ZADANI-MONO-UI.md §1), výstupem jsou ABSOLUTNÍ
// polohy prvků po délce bloku. Poloha se NIKDY neukládá do state — počítá se
// odsud pokaždé znovu. Je to JEDINÉ místo, které tohle počítá; mono-ui.js,
// mono-block.js ani main.js si polohy nepočítají samy (viz zadání §1).
//
// §ÚKOL MONO OSTROV — computeMonoLayout/computeMonoChecks berou druhý
// parametr `side` ('A'|'B'): strany A a B mají NEZÁVISLÝ obsah
// (state.mono.herdblokA/B, podestavbyA/B, panelItemsA/B — jako segmentsA/
// segmentsB u SEGMENTu), ale SDÍLENÝ leftEndType/rightEndType/limec — jedno
// úložiště pro obě strany. OPRAVA VADA 1 (ZADANI-OPRAVY-B-A-SOKL.md §1.1):
// který z nich řídí LEVÝ a který PRAVÝ kraj PÁSU se pro stranu B PROHAZUJE
// (čtecí pravidlo, úložiště samo se nepřejmenovává ani nerozdvojuje) — viz
// computeMonoLayout níž.
// OPRAVA O2: `side` je POVINNÝ parametr, žádný tichý default (viz
// ZADANI-MONO-OSTROV.md §3) — chybějící argument spadne hlasitě (Error),
// neplatná hodnota (např. 'C') dál tolerantně na 'A' (viz readSide níž).
//
// Modul je ČISTÝ: žádný DOM, žádné 'three', žádný import z main.js/ui.js.
// Smí importovat jen z mono-geometry.js — odtud bere sideInsetMM() a
// checkSupport(), zatažení od boku (50/70) se tu NEDUPLIKUJE natvrdo.
//
// Sem nepatří: kreslení pásu (mono-ui.js), stavba 3D geometrie
// (mono-geometry.js/mono-block.js), ořezávání při načtení souboru (main.js).
// Tenhle modul jen POČÍTÁ, nikam nezapisuje a nikoho nevolá zpátky.

import { sideInsetMM, checkSupport, END_TYPES } from './mono-geometry.js';

// Tolerance pro porovnání „konec položky přesahuje limit" — chrání jen proti
// zaokrouhlovacím chybám z dělení/násobení, ne proti záměrným milimetrům.
const EPS = 1e-6;

/** Tolerantní čtení typu zakončení — stejné pravidlo jako main.js/mono-block.js:
 *  neplatná nebo chybějící hodnota spadne na END_TYPES.VERTICAL_PLATE. */
function readEndType(value) {
  return value === END_TYPES.VERTICAL_PLATE_CHAMFER
    ? END_TYPES.VERTICAL_PLATE_CHAMFER
    : END_TYPES.VERTICAL_PLATE;
}

/** Kladné konečné číslo, jinak 0. Brání tomu, aby NaN/Infinity/záporná
 *  šířka prolomily kumulativní součet v layoutSequential (viz zadání:
 *  „nesmí spadnout ani vrátit NaN"). */
function toPositiveMM(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Konečné číslo, nebo `fallback`, když vstup není číslo (chybějící/NaN xMM
 *  u panelItems dostane rozumnou výchozí polohu místo pádu). */
function toFiniteMM(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Ořízne hodnotu do rozsahu mezi `from` a `to` bez ohledu na to, který je
 *  větší — u nesmyslně krátkého bloku může vyjít usableToMM < usableFromMM
 *  (součet zatažení obou konců > lengthMM) a i tak nesmí nic spadnout. */
function clampToRange(value, from, to) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return Math.min(Math.max(value, lo), hi);
}

/**
 * Klade `items` (cokoli s `widthMM`) kumulativně za sebe od `startMM`.
 * `overflow` je true u položky, jejíž konec přesáhne `limitMM` — takhle to
 * čte i zadání u podestaveb („dotčené položky mají overflow: true").
 * Vrací i `endMM` — polohu konce poslední položky (= startMM, když je pole
 * prázdné), aby si volající mohl dopočítat volnou/chybějící plochu.
 *
 * @param {Array<{widthMM:number}>} items
 * @param {number} startMM
 * @param {number} limitMM
 * @returns {{ laid: Array<{item:object, xMM:number, widthMM:number, overflow:boolean}>, endMM:number }}
 */
function layoutSequential(items, startMM, limitMM) {
  let cursor = startMM;
  const laid = items.map((item) => {
    const widthMM = toPositiveMM(item && item.widthMM);
    const xMM = cursor;
    cursor += widthMM;
    const overflow = cursor > limitMM + EPS;
    return { item, xMM, widthMM, overflow };
  });
  return { laid, endMM: cursor };
}

/** Tolerantní čtení strany — jediné povolené hodnoty jsou 'A' a 'B'; NEPLATNÁ
 *  hodnota (překlep, cizí hodnota, např. 'C') tiše spadne na 'A' — to je
 *  záměrně tolerantní (viz readEndType výše). CHYBĚJÍCÍ argument je ale jiný
 *  případ (OPRAVA O2, ZADANI-MONO-OSTROV.md §3: „side je POVINNÝ parametr,
 *  žádný tichý default") — ten musí selhat hlasitě, aby nové volání bez
 *  `side` neprošlo tiše jako 'A'. `undefined` se sem dostane JEN chybějícím
 *  argumentem, nikdy platnou hodnotou 'A'/'B', takže rozlišení je bezpečné. */
function readSide(side) {
  if (side === undefined) {
    throw new Error('readSide: chybí povinný parametr side (\'A\' nebo \'B\') — volající musí stranu poslat explicitně, viz ZADANI-MONO-OSTROV.md §3.');
  }
  return side === 'B' ? 'B' : 'A';
}

/**
 * Spočítá rozvržení celého pásu MONO ze state.mono PRO JEDNU STRANU
 * (`side`: 'A' nebo 'B') — herdblok i podestavby od usableFromMM
 * (= sideInsetMM(leftEndType)) s limitem usableToMM, panelItems ořezané do
 * stejného použitelného rozsahu (viz zadání §1 a §2). OPRAVA KOLIZE S
 * BOČNICÍ (nahlášeno 1. 9. 2026): herdblok se dřív kladl od x = 0 přes celou
 * délku bloku, takže krajní přístroje zasahovaly do koncových zón, kde stojí
 * bočnice — sideInsetMM() vrací dvě různá zatažení (50 mm vodopád / 70 mm
 * zkosený vodopád) podle typu bočnice a herdblok je ignoroval.
 * `leftEndType`/`rightEndType` jsou pořád JEDNO
 * SDÍLENÉ úložiště ve state.mono (viz main.js) — ale OPRAVA VADA 1
 * (ZADANI-OPRAVY-B-A-SOKL.md §1.1) pro stranu B PROHAZUJE, který z nich řídí
 * LEVÝ a který PRAVÝ kraj PÁSU: souřadnice strany B se měří od JEJÍHO
 * VLASTNÍHO levého kraje (tak, jak blok vidí člověk stojící u strany B), ne
 * od sdíleného leftEndType natvrdo jako dřív. Proto `usableFromMM`/
 * `usableToMM` u obou stran vycházejí STEJNĚ jen tehdy, když má blok na obou
 * koncích stejný typ zakončení — jinak (50 vs 70 mm) se liší. Prohozené
 * hodnoty se vrací i navenek jako `leftEndType`/`rightEndType` (viz
 * @returns), aby si je volající (koncovky v mono-ui.js, computeMonoChecks
 * níž) nemusel odvozovat podruhé a pravidlo žilo na jednom místě. Obsah
 * herdblok/podestavby/panelItems je u obou stran NEZÁVISLÝ odjakživa — čte
 * se z `herdblok${side}` / `podestavby${side}` / `panelItems${side}`.
 * Odolné vůči chybějícímu state.mono/state.dimensions, prázdným polím i
 * nesmyslným šířkám — nikdy nespadne ani nevrátí NaN. Neznámá `side` (§ÚKOL
 * MONO OSTROV zadání) spadne na 'A', ne na pád — viz readSide().
 *
 * @param {object} state
 * @param {'A'|'B'} side — OPRAVA O2: POVINNÝ parametr, žádný tichý default
 *   (ZADANI-MONO-OSTROV.md §3 — „volající to nemá spoléhat"). Ověřeno grepem
 *   přes celý js/, že všechna dnešní volání (main.js, mono-block.js,
 *   mono-ui.js) stranu posílají explicitně — viz readSide() níž, chybějící
 *   argument teď spadne hlasitě (Error), neplatná hodnota (např. 'C') dál
 *   tolerantně na 'A'.
 * @returns {object} přesně tvar popsaný v ZADANI-MONO-UI.md §2, rozšířený o
 *   `leftEndType`/`rightEndType` (OPRAVA VADA 1, ZADANI-OPRAVY-B-A-SOKL.md
 *   §1.1) — typ konce platný pro LEVÝ/PRAVÝ kraj PÁSU TÉHLE strany, u strany
 *   B už prohozený.
 */
export function computeMonoLayout(state, side) {
  const monoState = (state && state.mono) || {};
  const dims = (state && state.dimensions) || {};
  const s = readSide(side);

  const lengthMM = toPositiveMM(dims.lengthMM);

  // OPRAVA VADA 1 (ZADANI-OPRAVY-B-A-SOKL.md §1.1) — pro stranu B se
  // PROHODÍ, který uložený typ konce řídí levý a který pravý kraj pásu:
  // strip x=0 strany B leží na FYZICKY OPAČNÉM konci bloku než strip x=0
  // strany A (zrcadlení obsahu, viz mono-block.js), takže i zatažení od kraje
  // (sideInsetMM) musí patřit tomu fyzickému konci, u kterého strana B
  // skutečně x=0 má. Bez tohohle prohození by skříňky strany B seděly u
  // konce se zatažením toho DRUHÉHO konce (50 vs 70 mm) — nová vada
  // zavlečená touhle opravou. Úložiště (monoState.leftEndType/rightEndType)
  // zůstává SDÍLENÉ a nepřejmenované — tohle je jen čtecí pravidlo pro B.
  const storedLeftEndType = readEndType(monoState.leftEndType);
  const storedRightEndType = readEndType(monoState.rightEndType);
  const leftEndType = s === 'B' ? storedRightEndType : storedLeftEndType;
  const rightEndType = s === 'B' ? storedLeftEndType : storedRightEndType;
  const leftInsetMM = sideInsetMM(leftEndType);
  const rightInsetMM = sideInsetMM(rightEndType);

  const usableFromMM = leftInsetMM;
  const usableToMM = lengthMM - rightInsetMM;

  const herdblokItems = Array.isArray(monoState[`herdblok${s}`]) ? monoState[`herdblok${s}`] : [];
  const podestavbyItems = Array.isArray(monoState[`podestavby${s}`]) ? monoState[`podestavby${s}`] : [];
  const panelItemsRaw = Array.isArray(monoState[`panelItems${s}`]) ? monoState[`panelItems${s}`] : [];

  // --- herdblok: OPRAVA KOLIZE S BOČNICÍ (nahlášeno 1. 9. 2026) — dřív se
  // řada herdbloku kladla od x = 0 s limitem celé délky bloku, takže krajní
  // přístroje zasahovaly do koncových zón, kde stojí bočnice (nos/vodopád).
  // Naměřeno na bloku 3200 mm s přístrojem 400 mm na začátku řady: přístroj
  // sahal do world X 1571, bočnice začínala na 1550 (vodopád, zatažení
  // 50 mm) resp. 1530 (zkosený vodopád, zatažení 70 mm) — sideInsetMM()
  // vrací tahle dvě zatažení podle typu bočnice a herdblok je ignoroval.
  // Teď se řada herdbloku klade do STEJNÉHO použitelného rozsahu jako
  // podestavby níž (usableFromMM..usableToMM) ----------------------------
  const herdblokLayout = layoutSequential(herdblokItems, usableFromMM, usableToMM);
  // Volná plocha musí vycházet ze stejného použitelného rozsahu (usableToMM),
  // jinak by po opravě výš hlásila víc místa v řadě, než ve skutečnosti zbývá.
  const herdblokFreeMM = Math.max(0, usableToMM - herdblokLayout.endMM);

  // --- podestavby: klade se od usableFromMM, limit je usableToMM ------------
  const podestavbyLayout = layoutSequential(podestavbyItems, usableFromMM, usableToMM);
  const missingMM = Math.max(0, usableToMM - podestavbyLayout.endMM);
  const missingFromMM = missingMM > 0 ? podestavbyLayout.endMM : null;

  // --- panelItems: jen ořezání polohy do použitelného rozsahu, pořadí se
  // nemění (poloha, ne pořadí — viz zadání §1) --------------------------------
  const panelItems = panelItemsRaw.map((item) => {
    const rawXMM = toFiniteMM(item && item.xMM, usableFromMM);
    const xMM = clampToRange(rawXMM, usableFromMM, usableToMM);
    return { item, xMM };
  });

  return {
    lengthMM,
    leftInsetMM,
    rightInsetMM,
    usableFromMM,
    usableToMM,

    // Typ konce platný pro LEVÝ/PRAVÝ kraj PÁSU TÉHLE strany (u strany B už
    // prohozený, viz výš) — mono-ui.js podle nich kreslí/přepíná koncovky a
    // mapuje klik zpátky na uložené pole, computeMonoChecks níž je bere pro
    // herdblokUsek (§1.1/§1.3 ZADANI-OPRAVY-B-A-SOKL.md).
    leftEndType,
    rightEndType,

    herdblok: herdblokLayout.laid,
    herdblokFreeMM,

    podestavby: podestavbyLayout.laid,
    missingMM,
    missingFromMM,

    panelItems,
  };
}

/**
 * Přebalí checkSupport() z mono-geometry.js do tvaru pro UI (§2 zadání).
 * Podestavby bere z computeMonoLayout — nikdo si polohy nepočítá podruhé —
 * ale z podpory VYŘAZUJE 'gap': gap je úmyslně nepodepřený most (zadání §1),
 * takže v rozvržení řady místo zabírá, ale herdblok na něm nestojí.
 * Herdblok se pro kontrolu bere jako JEDEN úsek přes celou délku bloku
 * (stejně jako ho staví mono-block.js) — checkSupport řeší podepření
 * fyzického těla herdbloku, ne jednotlivé přístroje uvnitř.
 *
 * OPRAVA VADA 1 (ZADANI-OPRAVY-B-A-SOKL.md §1.1) — herdblokUsek.leftEndType/
 * rightEndType se berou ZE STEJNÉHO PROHOZENÉHO PRAVIDLA jako layout
 * (layout.leftEndType/rightEndType — nejjednodušeji z layoutu, který si je
 * už stejně počítá), ne znovu přímo z monoState — aby převis vlevo/vpravo
 * hlásil pro stranu B tu stranu, kterou uživatel v PÁSU skutečně vidí.
 *
 * @param {object} state
 * @param {'A'|'B'} side — OPRAVA O2: POVINNÝ parametr, stejné pravidlo jako
 *   u computeMonoLayout výše (žádný tichý default) — chybějící argument
 *   spadne hlasitě přes computeMonoLayout()→readSide().
 * @returns {{ overhangLeftMM:number, overhangRightMM:number, maxBridgeMM:number, ok:boolean }}
 */
export function computeMonoChecks(state, side) {
  const layout = computeMonoLayout(state, side);

  const podestavby = layout.podestavby
    .filter((p) => !p.item || p.item.kind !== 'gap')
    .map((p) => ({ xMM: p.xMM, widthMM: p.widthMM }));

  const herdblokUsek = {
    xMM: 0,
    widthMM: layout.lengthMM,
    leftEndType: layout.leftEndType,
    rightEndType: layout.rightEndType,
  };

  const result = checkSupport(podestavby, herdblokUsek);
  const maxBridgeMM = result.bridges.reduce((max, b) => Math.max(max, b.gapMM), 0);

  return {
    overhangLeftMM: result.leftOverhangMM,
    overhangRightMM: result.rightOverhangMM,
    maxBridgeMM,
    ok: result.ok,
  };
}
