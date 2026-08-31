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
// segmentsB u SEGMENTu), ale SDÍLENÝ leftEndType/rightEndType/limec.
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
 * (`side`: 'A' nebo 'B') — herdblok od x = 0, podestavby od
 * sideInsetMM(leftEndType), panelItems ořezané do stejného použitelného
 * rozsahu (viz zadání §1 a §2). `leftEndType`/`rightEndType` jsou SDÍLENÉ
 * mezi stranami (viz main.js state.mono), takže `usableFromMM`/
 * `usableToMM` vycházejí stejně pro obě strany — liší se jen obsah
 * herdblok/podestavby/panelItems, který se čte z `herdblok${side}` /
 * `podestavby${side}` / `panelItems${side}`. Odolné vůči chybějícímu
 * state.mono/state.dimensions, prázdným polím i nesmyslným šířkám — nikdy
 * nespadne ani nevrátí NaN. Neznámá `side` (§ÚKOL MONO OSTROV zadání) spadne
 * na 'A', ne na pád — viz readSide().
 *
 * @param {object} state
 * @param {'A'|'B'} side — OPRAVA O2: POVINNÝ parametr, žádný tichý default
 *   (ZADANI-MONO-OSTROV.md §3 — „volající to nemá spoléhat"). Ověřeno grepem
 *   přes celý js/, že všechna dnešní volání (main.js, mono-block.js,
 *   mono-ui.js) stranu posílají explicitně — viz readSide() níž, chybějící
 *   argument teď spadne hlasitě (Error), neplatná hodnota (např. 'C') dál
 *   tolerantně na 'A'.
 * @returns {object} přesně tvar popsaný v ZADANI-MONO-UI.md §2
 */
export function computeMonoLayout(state, side) {
  const monoState = (state && state.mono) || {};
  const dims = (state && state.dimensions) || {};
  const s = readSide(side);

  const lengthMM = toPositiveMM(dims.lengthMM);
  const leftEndType = readEndType(monoState.leftEndType);
  const rightEndType = readEndType(monoState.rightEndType);
  const leftInsetMM = sideInsetMM(leftEndType);
  const rightInsetMM = sideInsetMM(rightEndType);

  const usableFromMM = leftInsetMM;
  const usableToMM = lengthMM - rightInsetMM;

  const herdblokItems = Array.isArray(monoState[`herdblok${s}`]) ? monoState[`herdblok${s}`] : [];
  const podestavbyItems = Array.isArray(monoState[`podestavby${s}`]) ? monoState[`podestavby${s}`] : [];
  const panelItemsRaw = Array.isArray(monoState[`panelItems${s}`]) ? monoState[`panelItems${s}`] : [];

  // --- herdblok: klade se od x = 0, limit je celá délka bloku ---------------
  const herdblokLayout = layoutSequential(herdblokItems, 0, lengthMM);
  const herdblokFreeMM = Math.max(0, lengthMM - herdblokLayout.endMM);

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
 * @param {object} state
 * @param {'A'|'B'} side — OPRAVA O2: POVINNÝ parametr, stejné pravidlo jako
 *   u computeMonoLayout výše (žádný tichý default) — chybějící argument
 *   spadne hlasitě přes computeMonoLayout()→readSide().
 * @returns {{ overhangLeftMM:number, overhangRightMM:number, maxBridgeMM:number, ok:boolean }}
 */
export function computeMonoChecks(state, side) {
  const monoState = (state && state.mono) || {};
  const leftEndType = readEndType(monoState.leftEndType);
  const rightEndType = readEndType(monoState.rightEndType);

  const layout = computeMonoLayout(state, side);

  const podestavby = layout.podestavby
    .filter((p) => !p.item || p.item.kind !== 'gap')
    .map((p) => ({ xMM: p.xMM, widthMM: p.widthMM }));

  const herdblokUsek = {
    xMM: 0,
    widthMM: layout.lengthMM,
    leftEndType,
    rightEndType,
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
