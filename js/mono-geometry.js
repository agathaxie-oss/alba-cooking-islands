// mono-geometry.js — ČISTÁ geometrie produktu ALBA MONO.
// Žádná vazba na DOM ani na stav aplikace: vstupem je prostý objekt s
// parametry v milimetrech, výstupem THREE.Group. Materiály se přebírají
// sdílené z materials.js (stejné jako u produktu SEGMENT), jinak modul nic
// z aplikace nečte ani neimportuje.
//
// PROTOTYP — přístroje, ovládací prvky panelu, sokl a nástavby se neřeší
// (mimo rozsah úkolu). Cílem je geometrie herdbloku, podestaveb (VČETNĚ
// dvířek, police, zásuvkových čel a GN vsuvů — ZADANI-PODESTAVBY-MONO.md
// §3, viz buildPodestavba níž), bočního krytu a límce k odsouhlasení. Viz
// "Co se teď NEDĚLÁ" v zadání — na místech, kde chybí dodané číslo, je TODO
// a nic se nedomýšlí.
//
// --- Souřadný systém -------------------------------------------------------
//   x .. podél délky bloku. NENÍ centrováno — je to PŘÍMO souřadnice xMM
//        z parametrů (poloha je souřadnice, ne pořadí). x = 0 je LEVÝ konec
//        bloku, dopočítává ho volající (tento modul nic nesčítá/necentruje).
//   y .. nahoru, y = 0 je podlaha.
//   z .. dozadu, z = 0 je LÍC PRACOVNÍ DESKY (nejpřednější bod bloku).
//        Všechno ostatní leží v z > 0. ŽÁDNÉ záporné z.
//
// Roviny v ose Z (mm od líce desky dozadu), platné při HERDBLOK_DEPTH_DEFAULT_MM:
//   0   líc pracovní desky
//   3   líc spodní lišty panelu (LISTA_FRONT_Z_MM)
//   25  líc ovládacího panelu (PANEL_SETBACK_MM)
//   26  líc korpusu herdbloku (PANEL_SETBACK_MM + PANEL_GAP_MM)
//   30  líc podestavby (DESK_OVERHANG_FRONT_MM) i líc bočního krytu
//   700 zadní líc podestavby (30 + PODESTAVBA_DEPTH_MM)
//   825 zadní líc korpusu herdbloku (850 − DESK_OVERHANG_BACK_MM)
//   850 zadní hrana desky = rovina stěny (HERDBLOK_DEPTH_DEFAULT_MM) i zadní líc bočního krytu
//
// Roviny v ose Y (mm od podlahy, při pracovní výšce 900, sokl 150 — ZADANI-SOKL.md
// 31. 8. 2026 změnilo soklovou zónu z pevných 150 na PROMĚNNOU plinth.heightMM,
// čísla níž platí pro výchozí sokl 150; u jiné výšky soklu se posune vše od
// řádku "horní hrana soklové zóny" výš, tělo podestavby (460) zůstává PEVNÉ):
//   0   podlaha
//   150 horní hrana soklové zóny = spodek korpusu podestavby (plinth.heightMM)
//   610 horní hrana podestavby = spodek herdbloku
//   650 horní hrana spodní lišty (610 + LISTA_HEIGHT_MM)
//   850 horní hrana ovládacího panelu (610 + PANEL_HEIGHT_MM)
//   900 horní plocha pracovní desky (workHeightMM)
//
// Tělo podestavby je od 31. 8. 2026 PEVNÉ (ZADANI-SOKL.md), nezávislé na
// soklu i na workHeightMM: bodyHeightMM = BODY_STACK_MM − HERDBLOK_HEIGHT_MM
// = 750 − 290 = 460. Nižší sokl ⇒ CELÝ BLOK klesne o stejný rozdíl (tělo se
// nezvětšuje) — workHeightMM = HERDBLOK_HEIGHT_MM + bodyHeightMM + plinth.heightMM.
//
// --- Dvě nezávislé vrstvy ----------------------------------------------------
// `podestavby` a `herdblok` (segmenty herdbloku) jsou POLE PRVKŮ s vlastní
// xMM (začátek) a widthMM — poloha je souřadnice, ne pořadí. Vrstvy se
// nemusí krýt → z toho plyne MOST i PŘEVIS, viz checkSupport() níže.

import * as THREE from 'three';
import {
  createStainlessMaterial,
  createPanelMaterial,
  createPlinthMaterial,
  createEdgeMaterial,
  createKnobMaterial,
} from './materials.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ============================================================================
// KONSTANTY — vše v mm, exportované
// ============================================================================

// --- výšky ----------------------------------------------------------------
export const HERDBLOK_HEIGHT_MM = 290;      // konstrukčně pevné
export const WORK_HEIGHT_MIN_MM = 800;      // ZADANI-SOKL.md 31. 8. 2026: 850 → 800 (sokl 50)
export const WORK_HEIGHT_MAX_MM = 900;
export const WORK_HEIGHT_DEFAULT_MM = 900;
// LEG_HEIGHT_MM (dřív pevných 150) SE RUŠÍ — výška soklové zóny je od
// 31. 8. 2026 vlastnost CELÉHO BLOKU (state.plinth.heightMM, ZADANI-SOKL.md),
// chodí jako parametr `plinth` do buildMonoBlock()/buildPodestavba().
// Řetězcové hodnoty i rozsah MUSÍ sedět s modules.js PLINTH_TYPES/
// PLINTH_HEIGHT_MIN_MM/MAX_MM/DEFAULT_MM — mono-geometry.js zůstává BEZ
// importu z modules.js (viz hlavička souboru), proto je tu jen OPAKOVANÁ
// holá hodnota jako lokální evidence (stejná technika jako FINISH_H2 níž).
export const PLINTH_HEIGHT_MIN_MM = 50;
export const PLINTH_HEIGHT_MAX_MM = 150;
export const PLINTH_HEIGHT_DEFAULT_MM = 150;
const DEFAULT_PLINTH_TYPE = 'construction'; // musí sedět s modules.js DEFAULT_PLINTH
// tělo podestavby je PEVNÉ: bodyHeightMM = BODY_STACK_MM − HERDBLOK_HEIGHT_MM
// (750 − 290 = 460) — musí sedět s modules.js BODY_STACK_MM.
const BODY_STACK_MM = 750;
// uskočení rámu/zástěny od líce bloku, ZE VŠECH STRAN — musí sedět
// s modules.js PLINTH_INSET_MM.
export const PLINTH_INSET_MM = 50;

// --- typy zakončení ---------------------------------------------------------------
// Řetězcové hodnoty MUSÍ zůstat přesně tyhle — ukládají se do souboru projektu.
// Přesunuto SEM (před ostatní konstanty), protože zatažení od boku
// (END_SIDE_INSET_MM níž) je závislé na typu, a END_TYPES tak musí být
// definované dřív.
export const END_TYPES = {
  VERTICAL_PLATE: 'svislaDeska',
  VERTICAL_PLATE_CHAMFER: 'svislaDeskaZkos',
};

// --- čelní skladba herdbloku ------------------------------------------------
export const DESK_FACE_HEIGHT_MM = 50;      // viditelné svislé čelo desky
export const PANEL_SETBACK_MM = 25;         // ustoupení panelu za líc desky
export const PANEL_HEIGHT_MM = HERDBLOK_HEIGHT_MM - DESK_FACE_HEIGHT_MM; // 240, odvozeno
export const PANEL_GAP_MM = 1;              // spára kolem panelu (proti z-fightingu s korpusem)
export const LISTA_HEIGHT_MM = 40;          // spodní lišta, SOUČÁST panelu
export const LISTA_FRONT_Z_MM = 3;          // líc spodní lišty: 3 mm za lícem desky
export const LISTA_PROUD_MM = PANEL_SETBACK_MM - LISTA_FRONT_Z_MM; // 22, odvozeno — jen dopočet/evidence

// --- prvky v ovládacím panelu (zásuvky apod.) --------------------------------
// Rozměry ZE ZADÁNÍ (§9 ZADANI-MONO-UI.md), ne odhad. depthMM je hloubka
// prvku PŘED lícem panelu (viz buildPanelItem níž) — u obou typů menší než
// PANEL_SETBACK_MM (25), takže se nikdy nedostane na záporné z. buildPanelItem
// to i tak hlídá výpočtem, ne jen touhle poznámkou (kdyby v budoucnu přibyl
// hlubší typ prvku).
export const PANEL_ITEM = {
  socket230: { widthMM: 90, heightMM: 90, depthMM: 6 },
  socketCEE: { widthMM: 105, heightMM: 105, depthMM: 8 },
};
export const PANEL_ITEM_HEIGHT_DEFAULT_MM = 100; // MonoPanelItem.heightMM, výchozí (zadání §1)

// --- zatažení panelu, lišty a podestavby od boku bloku — PODLE TYPU KONCE ---
// Zatažení NENÍ jedno číslo pro oba konce — je to hodnota NA TYP zakončení
// (viz zadání, body 2 a 3). Levý a pravý konec mohou mít různý typ, proto se
// panel/lišta/podestavba/boční kryt vždy počítají nesymetricky, samostatně
// přes sideInsetMM(leftEndType) a sideInsetMM(rightEndType).
export const END_SIDE_INSET_MM = {
  [END_TYPES.VERTICAL_PLATE]: 50,
  [END_TYPES.VERTICAL_PLATE_CHAMFER]: 70,
};

/** Zatažení od boku (mm) pro daný typ zakončení; neznámý typ spadne na svislaDeska. */
export function sideInsetMM(endType) {
  return END_SIDE_INSET_MM[endType] ?? END_SIDE_INSET_MM[END_TYPES.VERTICAL_PLATE];
}

// --- svislá boční deska ("nos"/vodopád) — délka rovného čela, PODLE TYPU KONCE
// PŮVODNÍ evidence rozměru (HODNOTY-MONO.md §7.5): 50 mm rovného čela u
// END_TYPES.VERTICAL_PLATE. OPRAVA (ÚKOL A tohohle kola): nos musí vyplnit
// CELÉ zatažení sideInsetMM(endType) — 50 u VERTICAL_PLATE, 70 u
// VERTICAL_PLATE_CHAMFER — ne jen "rovné čelo". buildHerdblokUsek (přes
// noseOutline níž) proto šířku nosu čte přímo ze sideInsetMM(), NE odsud.
// Tahle mapa/funkce se dál NEPOUŽÍVÁ nikde v modulu — ponecháno jen jako
// evidence dodaného čísla (50 mm rovného čela je navíc obsažené i v
// END_STRAIGHT_MM/END_CHAMFER_MM níž), ke zvážení smazání při příštím
// úklidu (nahlášeno v přejímce).
export const NOSE_FRONT_MM = {
  [END_TYPES.VERTICAL_PLATE]: 50,
};

/** Délka rovného čela nosu (mm) pro daný typ zakončení; neznámý typ spadne na svislaDeska. */
export function noseFrontMM(endType) {
  return NOSE_FRONT_MM[endType] ?? NOSE_FRONT_MM[END_TYPES.VERTICAL_PLATE];
}

// --- pracovní deska ----------------------------------------------------------
export const DESK_OVERHANG_FRONT_MM = 30;   // přesah desky přes podestavbu vpředu
export const DESK_OVERHANG_SIDE_MM = 25;    // TODO: dál nepoužito. Nos (vodopád,
// buildHerdblokUsek) po opravě ÚKOLU A vyplňuje CELÉ zatažení sideInsetMM
// (50/70), žádná samostatná "tloušťka nosu" už v modelu není — takže
// DESK_OVERHANG_SIDE_MM (25) není tloušťka vodopádu ani nic jiného v modulu
// nepočítá. Nejasné, co přesně popisuje (možná přesah desky NAD nosem,
// jinam neumístěný) — nedomýšlím, zůstává jen evidence, nahlášeno v přejímce.
export const DESK_OVERHANG_BACK_MM = 25;    // přesah desky přes korpus vzadu
export const DESK_SHEET_MM = 2;             // síla plechu desky — zatím jen evidence
export const DESK_EDGE_RETURN_MM = 20;      // zahnutí hrany desky dovnitř — zatím evidence
export const DESK_TOP_RADIUS_MM = 3;        // poloměr horní hrany desky — zatím evidence

// --- hloubky ------------------------------------------------------------------
export const HERDBLOK_DEPTH_DEFAULT_MM = 850;
export const PODESTAVBA_DEPTH_MM = 670;
export const PODESTAVBA_WIDTH_DEFAULT_MM = 800;

// --- konstrukce skříňky podestavby --------------------------------------------
export const WALL_MM = 20;       // boční stěna skříňky
export const BACK_WALL_MM = 20;  // zadní stěna
export const FLOOR_MM = 40;      // podlážka
export const TOP_RAIL_MM = 20;   // příčná lišta 20×20, JEN VPŘEDU
export const H2_RADIUS_MM = 16;  // vnitřní radius hygienického stupně H2

// --- povrchová úprava — ovlivňuje TVAR spodních koutů podestavby (PREDANI.md
// úkol 9b): H2 dostává radius H2_RADIUS_MM, H1 a HS+ mají ostrý roh, žádný
// radius (viz buildPodestavba níž). Řetězcový kód MUSÍ sedět s modules.js
// FINISH_TYPES/DEFAULT_FINISH a MonoCabinet.finish (ZADANI-MONO-UI.md §1) —
// mono-geometry.js zůstává BEZ importu z modules.js (viz hlavička souboru,
// žádná vazba na stav aplikace), proto se tu jen OPAKUJE holý kód 'H2' jako
// lokální evidence, ne přebíraná konstanta.
// Chybějící/neznámá `finish` NENÍ natvrdo "žádný radius" jako libovolná
// volba implementace — spadá na modules.js DEFAULT_FINISH ('H1', ověřeno
// 8. 8. 2026), který má PRÁVĚ TAKY ostrý roh bez radiusu, takže test
// `finish !== FINISH_H2` dává zadáním požadovaný výsledek pro H1, HS+
// i pro chybějící/neznámou hodnotu zároveň — bez nutnosti sem tahat
// DEFAULT_FINISH samotné.
export const FINISH_H2 = 'H2';
export const CORPUS_SHEET_MM = 1.5; // síla plechu korpusu — zatím evidence
export const LEG_SIZE_MM = 40;   // konstanta, NE dopočet z šířky
export const LEG_INSET_MM = 50;  // odsazení nožičky od rohu (boční i čelní/zadní líc)

// --- tělo skříňky podle druhu/stylu — ZADANI-PODESTAVBY-MONO.md §3 ------------
// Čísla jsou DODANÁ zadáním (§3a–§3e), ne odhad. Sdílené mezi cabinet+doors
// a gnRack+doors (dvířka i úchytka mají u obou STEJNÝ vzhledový jazyk).
export const DOOR_WIDTH_GAP_MM = 20;   // spára po šířce křídla (§3b)
export const DOOR_HEIGHT_GAP_MM = 20;  // odsazení výšky křídla — SHODOU ČÍSEL
// stejné jako TOP_RAIL_MM (obojí 20), ale je to jiný fyzický důvod (viz
// buildCabinetDoors níž: křídlo je zarovnané na yBodyBottom stejně jako
// celni-stena, aby zůstala horní lišta vidět, ne libovolně vystředěné).
export const DOOR_THICKNESS_MM = 8;
export const DOOR_FRONT_Z_MM = 16;     // líc křídla, předsazený před líc korpusu (30)
export const DOOR_HANDLE_RADIUS_MM = 5;
export const DOOR_HANDLE_LENGTH_MM = 130;
export const DOOR_HANDLE_Z_MM = 10;    // osa úchytky (poloměr 5 dá z 5..15)
export const DOOR_HANDLE_OFFSET_DOUBLE_RATIO = 0.36; // dvoukřídlé — blíž ke středové spáře
export const DOOR_HANDLE_OFFSET_SINGLE_RATIO = 0.32; // jednokřídlé — u vzdálenější (pravé) hrany

export const SHELF_THICKNESS_MM = 20;      // police (§3c)
export const SHELF_WIDTH_INSET_MM = 10;    // šířka = widthMM − 2·WALL_MM − 10
export const SHELF_FRONT_RECESS_MM = 25;   // zapuštění od líce korpusu (z od zFront+25)
export const SHELF_BACK_GAP_MM = 10;       // odstup hloubky od zadní stěny

export const DRAWER_COUNT = 2;             // zásuvková čela (§3d) — KONSTANTA, ne parametr
export const DRAWER_WIDTH_INSET_MM = 20;   // šířka čela = widthMM − 20
export const DRAWER_THICKNESS_MM = 10;
export const DRAWER_FRONT_Z_MM = 14;       // líc čela, předsazený před líc korpusu (30)
export const DRAWER_SLOT_GAP_MM = 6;       // spára slotu (čelo = výška slotu − 6)
export const DRAWER_HANDLE_RADIUS_MM = 5;
export const DRAWER_HANDLE_LENGTH_RATIO = 0.5; // délka úchytky = 0,5 šířky čela
export const DRAWER_HANDLE_Z_MM = 8;           // osa úchytky (poloměr 5 dá z 3..13)
export const DRAWER_HANDLE_Y_RATIO = 0.32;     // ~0,32 výšky čela nad středem slotu

export const GN_RUNNER_COUNT_PER_SIDE = 6; // vsuvy na GN (§3e) — 6+6 = 12 těles
export const GN_RUNNER_PITCH_MM = 70;      // rozteč (rozhodnutí zadavatele 9. 8. 2026)
export const GN_RUNNER_SECTION_MM = 15;    // profil 15×15 mm
export const GN_RUNNER_FIRST_OFFSET_MM = 40; // střed nejnižšího vsuvu nad horní hranou podlážky
export const GN_RUNNER_FRONT_RECESS_MM = 25; // zapuštění od líce korpusu — SHODOU ČÍSEL
// stejné jako SHELF_FRONT_RECESS_MM (obojí 25), ale nezávislá konstanta —
// zadání je definuje ve dvou samostatných bodech (§3c/§3e).
export const GN_RUNNER_BACK_GAP_MM = 5;    // odstup hloubky od zadní stěny

// --- boční kryt a boční deska ---------------------------------------------------
// Dvě tloušťky (viz zadání, bod 5): THICK jen na straně, kde podestavba leží
// přímo na kraji bloku (žádný volný prostor před ní) — jinak vždycky THIN.
// buildMonoBlock() si tloušťku i umístění krytů odvozuje SÁM z řady
// podestaveb (computeSideCovers níže), volající si je nevybírá.
export const SIDE_COVER_THICK_MM = 50;
export const SIDE_COVER_THIN_MM = 20;
export const SIDE_PLATE_THICKNESS_MM = 20; // OPRAVA: PŘESTALO SE POUŽÍVAT pro nos —
// dřívější verze stavěla vodopád jako kvádr téhle tloušťky, což byla chyba
// zadání (souosá stěna s korpusem/deskou na x=0/x=widthMM, viz ÚKOL A níž).
// Nos teď vyplňuje celé sideInsetMM(endType) (buildHerdblokUsek, noseOutline
// níž), tahle konstanta se v modulu dál nepoužívá — ponecháno jen jako
// evidence, ke zvážení smazání (nahlášeno v přejímce).

// --- zakončení herdbloku (půdorys) ---------------------------------------------
// Půdorysné zkosení PŘEDNÍHO rohu u VERTICAL_PLATE_CHAMFER (viz cornerPoints
// níž): od boční hrany rovně END_CHAMFER_MM (50) dozadu→dopředu, zkosení pod
// CHAMFER_ANGLE_DEG (45°) do bodu na přední hraně, pak přední hrana rovně
// END_STRAIGHT_MM (20) dál, než začne ovládací panel. Používá je
// cornerPoints() a přes ni buildHerdblokOutline i noseOutline() (nos musí
// mít TENTÝŽ půdorys jako obrys desky — je to týž monolit).
export const END_STRAIGHT_MM = 20;  // rovná část zakončení u předního rohu, za zkosením
export const END_CHAMFER_MM = 50;   // zkosená část (délka nohy zkosení v X i v Z)
export const END_TOTAL_MM = END_STRAIGHT_MM + END_CHAMFER_MM; // 70, odvozeno
// Kontrola, která END_STRAIGHT_MM/END_CHAMFER_MM zamyká k zatažení bloku:
// součet MUSÍ dát přesně sideInsetMM(VERTICAL_PLATE_CHAMFER) (70) — jinak by
// nos (ÚKOL A) a zkosený roh obrysu (ÚKOL B) popisovaly každý jiný tvar.
console.assert(
  END_TOTAL_MM === END_SIDE_INSET_MM[END_TYPES.VERTICAL_PLATE_CHAMFER],
  'END_STRAIGHT_MM + END_CHAMFER_MM musí sedět se sideInsetMM(VERTICAL_PLATE_CHAMFER)'
);
export const CHAMFER_ANGLE_DEG = 45; // potvrzeno zadavatelem; stejná délka nohy
// (END_CHAMFER_MM) v X i v Z v cornerPoints() dává 45° automaticky — tahle
// konstanta se přímo v aritmetice zkosení nepoužívá, jen dokládá/zamyká ten
// předpoklad rovných nohou zkosení.

// Převis — měřeno od konce OVLÁDACÍHO PANELU, ne od konce bloku (viz
// checkSupport). Zvýšeno z 500 na 1200 na pokyn zadavatele 5. 8. 2026; je to
// teď stejná mez jako u mostu níž, ale drží se zvlášť — most je nepodepřená
// světlost MEZI podestavbami, převis je konzola na konci řady. Kdyby se někdy
// lišily, musí jít změnit nezávisle.
export const OVERHANG_LIMIT_MM = 1200;
export const BRIDGE_LIMIT_MM = 1200;  // most — nepodepřená světlost mezi podestavbami

// --- límec ----------------------------------------------------------------------
export const COLLAR_HEIGHT_MIN_MM = 40;
export const COLLAR_HEIGHT_MAX_MM = 300;
export const COLLAR_HEIGHT_DEFAULT_MM = 100;
export const COLLAR_THICKNESS_MM = 20;
export const COLLAR_BEND_RADIUS_MM = 0; // OSTRÝ pravý úhel

// ============================================================================
// POMOCNÉ FUNKCE
// ============================================================================

/** Box s viditelnými obrysovými hranami (stejný vzhled jako zbytek appky). */
function box(widthM, heightM, depthM, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(widthM, heightM, depthM), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), createEdgeMaterial());
  mesh.add(edges);
  return mesh;
}

// ============================================================================
// OBRYS HERDBLOKU jako samostatně čitelná datová struktura
// ============================================================================
// Herdblok se definuje HORNÍM OBRYSEM (2D mnohoúhelník s ošetřením rohů) a
// teprve z něj vzniká 3D těleso — buildHerdblokOutline() proto vrací obyčejné
// pole bodů {x, z} (mm), NENÍ to Three.js objekt. Používá se pro desku a
// (později) pro půdorys/kóty/límec.

/**
 * Vrátí body JEDNOHO rohu obrysu podle typu zakončení.
 *
 * END_TYPES.VERTICAL_PLATE zůstává ostrý 90° roh. END_TYPES.VERTICAL_PLATE_CHAMFER
 * má zkosený roh VÝHRADNĚ V PŮDORYSU (žádná facetka ve svislém řezu — viz
 * ÚKOL B zadání, čelo desky zůstává svislých DESK_FACE_HEIGHT_MM po celé
 * délce) — a JEN na PŘEDNÍCH rozích.
 *
 * PRAVIDLO (potvrzeno 8. 8. 2026, HODNOTY-MONO.md § 7.5): u varianty u stěny
 * (`single`) se zkosí JEN PŘEDNÍ rohy; zadní roh (u stěny) zůstává ostrý
 * i u VERTICAL_PLATE_CHAMFER. U varianty ostrov (`island`) mohou být zkosené
 * VŠECHNY rohy — avšak ostrovní varianta se dnes u MONO nestaví (chová se
 * jako `single`, viz TODO v js/main.js kolem ř. 519); až se bude dělat
 * úkol 6 v PREDANI.md, musí se sem doplnit větev pro ostrovní variantu.
 * Detekce: přední roh se pozná podle dzIn > 0 — je to volba implementace,
 * ne dodané číslo.
 *
 * Tvar zkoseného předního rohu (zadavatelem potvrzeno): od bodu na boční
 * hraně END_CHAMFER_MM (50) od rohu (směrem dovnitř, tj. dozadu), přes
 * zkosení pod CHAMFER_ANGLE_DEG (45°), do bodu na přední hraně END_CHAMFER_MM
 * od rohu (směrem dovnitř, do strany). Přední hrana pak pokračuje rovně dál
 * po END_STRAIGHT_MM (20), než začne ovládací panel — kontrolu
 * END_CHAMFER_MM + END_STRAIGHT_MM === sideInsetMM(VERTICAL_PLATE_CHAMFER)
 * (50+20=70) zamyká console.assert u END_TOTAL_MM výš.
 *
 * @param {string} type END_TYPES.*
 * @param {number} cornerX,cornerZ  souřadnice rohu (mm)
 * @param {number} dxIn,dzIn  jednotkový směr "dovnitř" od rohu; dzIn > 0
 *   určuje přední roh (viz pravidlo výš)
 * @param {'fromX'|'fromZ'} from  ze které hrany se do rohu vchází při
 *   obchůzce obrysu (buildHerdblokOutline / noseOutline) — řídí pořadí dvou
 *   vrácených bodů, aby navazovaly na sousední hrany beze křížení: 'fromZ'
 *   (vchází se po boční hraně) vrátí nejdřív bod na boční hraně, 'fromX'
 *   (vchází se po přední hraně) nejdřív bod na přední hraně.
 * @param {boolean} [chamferAllCorners=false]  ÚKOL 6 (ostrov): u varianty
 *   `island` mohou být zkosené VŠECHNY čtyři rohy, ne jen přední (potvrzeno
 *   8. 8. 2026, HODNOTY-MONO.md §7.5) — `dzIn > 0` samo už nestačí rozlišit
 *   přední/zadní, proto `chamferAllCorners` podmínku obchází.
 * @returns {Array<{x:number, z:number}>} jeden bod (ostrý roh), nebo dva
 *   (zkosený roh u VERTICAL_PLATE_CHAMFER)
 */
function cornerPoints(type, cornerX, cornerZ, dxIn, dzIn, from, chamferAllCorners = false) {
  const sharp = { x: cornerX, z: cornerZ };
  if (type === END_TYPES.VERTICAL_PLATE_CHAMFER && (chamferAllCorners || dzIn > 0)) {
    const sideEdgePoint = { x: cornerX, z: cornerZ + END_CHAMFER_MM * dzIn };
    const frontEdgePoint = { x: cornerX + END_CHAMFER_MM * dxIn, z: cornerZ };
    return from === 'fromZ' ? [sideEdgePoint, frontEdgePoint] : [frontEdgePoint, sideEdgePoint];
  }
  // ostrý 90° roh: END_TYPES.VERTICAL_PLATE vždy, VERTICAL_PLATE_CHAMFER na
  // zadních rozích u `single` (dzIn <= 0, chamferAllCorners=false)
  return [sharp];
}

/**
 * Sestaví horní obrys herdbloku jako pole bodů {x, z} v mm, v lokálním
 * prostoru herdbloku (x od 0 do widthMM, z = 0 je líc pracovní desky).
 * `frontZMM` posouvá jen PŘEDNÍ hranu dozadu/dopředu, zadní hrana a rohy
 * zůstávají beze změny.
 *
 * @param {{widthMM:number, depthMM:number, frontZMM?:number, leftEndType:string, rightEndType:string,
 *   chamferAllCorners?:boolean}} p  `chamferAllCorners` — ÚKOL 6 (ostrov): viz cornerPoints výš.
 * @returns {Array<{x:number, z:number}>} uzavřený mnohoúhelník (poslední bod ≠ první)
 */
export function buildHerdblokOutline({ widthMM, depthMM, frontZMM = 0, leftEndType, rightEndType, chamferAllCorners = false }) {
  const backZ = depthMM;

  // čtyři rohy, obchůzka ve směru: čelo (0→width) → pravý konec (front→back)
  // → záda (width→0) → levý konec (back→front)
  const frontRight = cornerPoints(rightEndType, widthMM, frontZMM, -1, +1, 'fromX', chamferAllCorners);
  const backRight = cornerPoints(rightEndType, widthMM, backZ, -1, -1, 'fromZ', chamferAllCorners);
  const backLeft = cornerPoints(leftEndType, 0, backZ, +1, -1, 'fromX', chamferAllCorners);
  const frontLeft = cornerPoints(leftEndType, 0, frontZMM, +1, +1, 'fromZ', chamferAllCorners);

  return [...frontLeft, ...frontRight, ...backRight, ...backLeft];
}

/**
 * Půdorys JEDNOHO nosu (vodopádu) v LOKÁLNÍCH souřadnicích úseku — stejná
 * datová struktura jako buildHerdblokOutline (pole {x,z} v mm). Nos je TÝŽ
 * MONOLIT jako obrys desky na daném konci (viz ÚKOL A zadání k tomuhle
 * kolu), proto se přední roh počítá přes STEJNOU cornerPoints() se stejnou
 * konvencí dxIn/dzIn/from jako frontLeft/frontRight v buildHerdblokOutline —
 * u svislaDeskaZkos tak vyjde useknutý přední roh, u svislaDeska ostrý.
 *
 * Nos zabírá CELÉ zatažení sideInsetMM(endType) od daného boku (50 u
 * svislaDeska, 70 u svislaDeskaZkos) a celou hloubku (z 0..depthMM) — výšku
 * (Y) si řeší až volající (buildHerdblokUsek), tahle funkce vrací jen
 * půdorys.
 *
 * @param {string} endType END_TYPES.*
 * @param {'left'|'right'} side
 * @param {number} widthMM  šířka CELÉHO úseku (na 'right' se od ní odečítá)
 * @param {number} depthMM
 * @param {boolean} [chamferAllCorners=false]  ÚKOL 6 (ostrov): když true, i
 *   VZDÁLENÝ (dřív vždy ostrý) roh na konci depthMM se zkosí stejným
 *   pravidlem jako blízký — nos u ostrova jde přes CELOU kombinovanou
 *   hloubku a "od čela k čelu" jsou zkosené oba konce (viz zadání úkolu 6).
 *   Volá se STEJNÁ cornerPoints() jako pro blízký roh — u `chamferAllCorners
 *   = false` vrátí cornerPoints() pro dzIn=-1 vždy ostrý bod, tedy PŘESNĚ
 *   dřívější natvrdo zapsaný bod {x,z:depthMM} — žádná regrese pro `single`.
 * @returns {Array<{x:number, z:number}>}
 */
function noseOutline(endType, side, widthMM, depthMM, chamferAllCorners = false) {
  const insetMM = sideInsetMM(endType);
  if (side === 'left') {
    // roh (0,0) — stejná souřadnice/orientace jako frontLeft v buildHerdblokOutline
    const corner = cornerPoints(endType, 0, 0, +1, +1, 'fromZ', chamferAllCorners);
    // vzdálený roh (0,depthMM) — 'fromX', stejná konvence jako backLeft v
    // buildHerdblokOutline (odvozeno a ověřeno na testovacím bloku, viz přejímka)
    const farCorner = cornerPoints(endType, 0, depthMM, +1, -1, 'fromX', chamferAllCorners);
    return [...corner, { x: insetMM, z: 0 }, { x: insetMM, z: depthMM }, ...farCorner];
  }
  // roh (widthMM,0) — stejná souřadnice/orientace jako frontRight v
  // buildHerdblokOutline, ale s 'fromZ' (ne 'fromX' jako tam): polygon nosu
  // se obchází od boční hrany k přední, aby vyšel nekřížený (ověřeno na
  // testovacím bloku v přejímce).
  const corner = cornerPoints(endType, widthMM, 0, -1, +1, 'fromZ', chamferAllCorners);
  const farCorner = cornerPoints(endType, widthMM, depthMM, -1, -1, 'fromX', chamferAllCorners);
  return [...corner, { x: widthMM - insetMM, z: 0 }, { x: widthMM - insetMM, z: depthMM }, ...farCorner];
}

/** Postaví THREE.Shape (v rovině X/Z, viz rotace při extruzi) z obrysu. */
function outlineToShape(outline) {
  // rotateX(-90°) použitá níže mapuje shape-lokální (u,v) → svět (x, ?, -v),
  // proto tu bereme z se záporným znaménkem, aby po rotaci vyšlo +z správně.
  const pts = outline.map((p) => new THREE.Vector2(mm(p.x), mm(-p.z)));
  return new THREE.Shape(pts);
}

/**
 * Vytvoří "deskovou" (horizontální) vrstvu herdbloku extruzí obrysu dolů.
 * topYMM je Y souřadnice HORNÍ hrany vrstvy (roste dolů o heightMM).
 */
function slabFromOutline(outline, topYMM, heightMM, material) {
  const shape = outlineToShape(outline);
  const heightM = mm(heightMM);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: heightM, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, mm(topYMM) - heightM, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), createEdgeMaterial());
  mesh.add(edges);
  return mesh;
}

// ============================================================================
// DESKA HERDBLOKU — extrahováno z buildHerdblokUsek (ÚKOL 6, ostrov)
// ============================================================================
// U ostrova je deska JEDNA průběžná přes obě strany (depthAMM + depthBMM),
// ne dvě desky proti sobě se spárou uprostřed (PREDANI.md, úkol 6) — proto
// musí jít postavit SAMOSTATNĚ na kombinovaném obrysu, mimo buildHerdblokUsek
// (ten pro `island` desku vynechává přes `includeDesk:false`, viz níž).

/**
 * Postaví desku herdbloku jako samostatný THREE.Mesh — stejná geometrie,
 * jakou dřív stavěl buildHerdblokUsek přímo (obrys → extruze dolů o
 * DESK_FACE_HEIGHT_MM). Používá ji buildHerdblokUsek (`single`, přes
 * widthMM/depthMM JEDNOHO úseku) i buildMonoBlock (`island`, přes
 * widthMM=lengthMM/depthMM=totalDepthMM kombinovaného obrysu, §6 krok 1).
 *
 * @param {{widthMM:number, depthMM:number, leftEndType:string, rightEndType:string,
 *   frontZMM?:number, chamferAllCorners?:boolean}} p
 * @returns {THREE.Mesh}
 */
export function buildHerdblokDesk({ widthMM, depthMM, leftEndType, rightEndType, frontZMM = 0, chamferAllCorners = false }) {
  const stainless = createStainlessMaterial();
  const outline = buildHerdblokOutline({ widthMM, depthMM, frontZMM, leftEndType, rightEndType, chamferAllCorners });
  return slabFromOutline(outline, HERDBLOK_HEIGHT_MM, DESK_FACE_HEIGHT_MM, stainless);
}

/**
 * Postaví JEDEN nos (vodopád) na daném konci (`side`) jako samostatný
 * THREE.Mesh — stejná geometrie, jakou dřív stavěl buildHerdblokUsek přímo
 * (noseOutline → extruze). Používá ji buildHerdblokUsek (`single`/per-strana
 * `island`, přes depthMM JEDNÉ strany) i buildMonoBlock (`island`, kombinovaný
 * nos přes depthMM=totalDepthMM, "od čela k čelu" — viz zadání úkolu 6, ne po
 * stranách zvlášť).
 *
 * @param {{endType:string, side:'left'|'right', widthMM:number, depthMM:number,
 *   chamferAllCorners?:boolean}} p
 * @returns {THREE.Mesh}
 */
export function buildHerdblokNose({ endType, side, widthMM, depthMM, chamferAllCorners = false }) {
  const stainless = createStainlessMaterial();
  const outline = noseOutline(endType, side, widthMM, depthMM, chamferAllCorners);
  const NOSE_TOP_Y_MM = HERDBLOK_HEIGHT_MM - DESK_FACE_HEIGHT_MM; // 240 — spodní líc desky
  return slabFromOutline(outline, NOSE_TOP_Y_MM, NOSE_TOP_Y_MM, stainless);
}

// ============================================================================
// HYGIENICKÝ STUPEŇ H2 — vnitřní radius R16 v koutě podlážka/boční stěna
// ============================================================================

/**
 * Vytvoří jednoduchý čtvrtválcový výplňový dílec (radius R16), který
 * zaobluje VNITŘNÍ roh mezi vodorovnou podlážkou (rovina y = cornerYMM) a
 * svislou boční stěnou (rovina x = cornerXMM). Extruze jde přímo podél Z
 * (žádná rotace není potřeba — průřez je už v rovině X/Y).
 *
 * @param {number} cornerXMM  x souřadnice svislé stěny (vnitřní líc)
 * @param {number} cornerYMM  y souřadnice horní plochy podlážky
 * @param {number} dirX  +1 když je interiér (vzduch) ve směru +x (levá stěna),
 *   -1 když je interiér ve směru -x (pravá stěna)
 * @param {number} zFromMM,zToMM  rozsah hloubky (mm)
 */
function buildH2Fillet(cornerXMM, cornerYMM, dirX, zFromMM, zToMM, material) {
  const R = H2_RADIUS_MM;
  const ARC_SEGMENTS = 12; // "segmentyOblouku" ze zadání — lokální, bez exportu

  const centerX = cornerXMM + dirX * R;
  const centerY = cornerYMM + R;
  // Krátká (90°) cesta od tečného bodu na podlážce k tečnému bodu na stěně,
  // procházející blízko skutečného rohu (konkávní výplň, ne konvexní oblouk).
  const startAngle = -Math.PI / 2;
  const endAngle = -Math.PI / 2 - dirX * (Math.PI / 2);

  const pts = [new THREE.Vector2(mm(cornerXMM), mm(cornerYMM))];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = startAngle + ((endAngle - startAngle) * i) / ARC_SEGMENTS;
    pts.push(new THREE.Vector2(mm(centerX + R * Math.cos(t)), mm(centerY + R * Math.sin(t))));
  }

  const shape = new THREE.Shape(pts);
  const depthM = mm(zToMM - zFromMM);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: depthM, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, mm(zFromMM));

  // Winding se liší podle dirX (mirror) — DoubleSide je jistota, ať je vidět
  // z obou stran i kdyby vyšlo navíjení obráceně (stejný trik jako jinde v appce).
  const mat = material.clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), createEdgeMaterial());
  mesh.add(edges);
  return mesh;
}

// ============================================================================
// LÍMEC — zvednutí VYBRANÝCH HRAN obrysu desky, jen na rovných/90° místech
// ============================================================================

/**
 * Vytvoří stěnu límce podél ROVNÉHO úseku obrysu mezi dvěma body (mm),
 * výšky heightMM, tloušťky COLLAR_THICKNESS_MM, s ostrým (R=0) horním
 * ohybem — límec je jen na rovných zakončeních nebo na hranách napojených
 * pod 90°, proto tahle funkce bere jen dva rovné body, nikoli celý obrys
 * (volající strana musí sama vybrat rovný segment).
 */
function buildCollarWall(x1MM, z1MM, x2MM, z2MM, baseYMM, heightMM, material) {
  const dx = x2MM - x1MM;
  const dz = z2MM - z1MM;
  const lengthMM = Math.hypot(dx, dz);
  if (lengthMM < 1) return null;
  const mesh = box(mm(lengthMM), mm(heightMM), mm(COLLAR_THICKNESS_MM), material);
  // OPRAVA (ověřeno přes THREE.Box3 na skutečné scéně, viz přejímka balíku
  // A6): box(lengthMM, heightMM, COLLAR_THICKNESS_MM) staví THREE.BoxGeometry,
  // kde `lengthMM` leží na LOKÁLNÍ ose X (šířka boxu), ne na Z — tloušťka
  // (COLLAR_THICKNESS_MM) leží na lokální Z. Rotace kolem Y o úhel θ mapuje
  // lokální X-osu (1,0,0) na svět (cosθ, 0, −sinθ); aby se tahle osa srovnala
  // se směrem (dx,dz) od bodu 1 k bodu 2 (cosθ=dx/L, sinθ=−dz/L), musí být
  // θ = atan2(−dz, dx), NE atan2(dx, dz) — původní vzorec byl o 90° vedle:
  // límec na hranách front/back (dz=0) vycházel dlouhý ve směru Z (~2000 mm)
  // a tenký ve směru X, u left/right (dx=0) naopak — u obou stěna trčela
  // kolmo na skutečnou hranu desky místo podél ní. Ověřeno na blocích se
  // všemi čtyřmi hranami límce najednou (front/back běžely podél X, tenké
  // v Z; left/right podél Z, tenké v X) — přesně obráceně, než mělo být.
  const angle = Math.atan2(-dz, dx); // rotace kolem Y; 0 = podél X (lokální délková osa boxu)
  mesh.rotation.y = angle;

  // OPRAVA (vada od zadavatele: "lemy nesmí přesahovat půdorys pracovní
  // desky"): límec byl vystředěný NA hraně desky (pozice = přesně střed
  // úsečky p1-p2), takže polovina tloušťky (COLLAR_THICKNESS_MM/2 = 10 mm)
  // trčela ven z obrysu desky — u hrany 'front' (z=0) to dokonce znamenalo
  // záporné z, což hlavička souboru výslovně zakazuje. Límec musí ležet
  // CELÝ uvnitř obrysu desky, proto se střed musí posunout o polovinu
  // tloušťky (insetMM) DOVNITŘ, kolmo na směr hrany p1→p2.
  //
  // Kolmý směr: lokální osa Z boxu (tloušťka) se stejnou rotací mapuje na
  // světový směr (−dz, dx)/L — viz odvození rotace ve OPRAVA komentáři výš
  // (lokální X (1,0,0) → (cosθ,0,−sinθ) = (dx,0,dz)/L; lokální Z (0,0,1) →
  // (sinθ,0,cosθ) = (−dz,0,dx)/L). Aby tenhle jeden vzorec fungoval pro
  // všechny čtyři hrany BEZ zvláštních větví/znamének, volající
  // (buildHerdblokUsek) musí předávat body hran v pořadí, které obchází
  // obrys desky jedním smyslem (front zleva doprava, right dopředu dozadu,
  // back zprava doleva, left dozadu dopředu) — při takovém pořadí míří
  // (−dz,dx)/L vždy DOVNITŘ obrysu.
  const nx = -dz / lengthMM;
  const nz = dx / lengthMM;
  const insetMM = COLLAR_THICKNESS_MM / 2;
  mesh.position.set(
    mm((x1MM + x2MM) / 2 + nx * insetMM),
    mm(baseYMM) + mm(heightMM) / 2,
    mm((z1MM + z2MM) / 2 + nz * insetMM)
  );
  return mesh;
}

/**
 * Postaví JEDNU stěnu límce nad danou hranou obrysu (front/back/left/right)
 * o rozměru widthMM×depthMM — sdílená implementace stejné geometrie, jakou
 * dřív počítal jen inline `collar.forEach` uvnitř buildHerdblokUsek. U
 * `island` (ÚKOL 6, §9) se límec staví JEDNOU nad KOMBINOVANÝM obrysem
 * (widthMM=lengthMM, depthMM=totalDepthMM), ne uvnitř buildHerdblokUsek pro
 * stranu A/B zvlášť — buildMonoBlock ji proto volá přímo. Podmínku "left/
 * right jen na konci VERTICAL_PLATE" a "back se u ostrova nikdy nestaví" si
 * hlídá VOLAJÍCÍ (stejně jako u single dřívější inline kód) — tahle funkce
 * jen postaví geometrii dané hrany bez podmínek.
 */
function buildCollarEdgeWall(edge, widthMM, depthMM, heightMM, material) {
  const h = clamp(heightMM, COLLAR_HEIGHT_MIN_MM, COLLAR_HEIGHT_MAX_MM);
  const baseY = HERDBLOK_HEIGHT_MM; // horní hrana desky
  // Pořadí bodů (p1→p2) obchází obrys desky jedním smyslem — viz OPRAVA
  // komentář u buildCollarWall výš (jinak by dopočítaná kolmice mířila ven).
  if (edge === 'front') return buildCollarWall(0, 0, widthMM, 0, baseY, h, material);
  if (edge === 'back') return buildCollarWall(widthMM, depthMM, 0, depthMM, baseY, h, material);
  if (edge === 'left') return buildCollarWall(0, depthMM, 0, 0, baseY, h, material);
  if (edge === 'right') return buildCollarWall(widthMM, 0, widthMM, depthMM, baseY, h, material);
  return null;
}

/**
 * Veřejná obálka buildCollarEdgeWall — používá ji buildMonoBlock() pro
 * kombinovaný límec ostrova (§9). Jméno meshe `limec-${edge}` nastavuje
 * rovnou, stejně jako dřívější inline kód v buildHerdblokUsek.
 */
export function buildCollarSide({ edge, widthMM, depthMM, heightMM = COLLAR_HEIGHT_DEFAULT_MM }) {
  const stainless = createStainlessMaterial();
  const wall = buildCollarEdgeWall(edge, widthMM, depthMM, heightMM, stainless);
  if (wall) wall.name = `limec-${edge}`;
  return wall;
}

// ============================================================================
// PRVKY V OVLÁDACÍM PANELU — zásuvky apod. (viz PANEL_ITEM výš)
// ============================================================================

/**
 * Vytvoří JEDEN prvek osazený do ovládacího panelu (zásuvka apod.) jako
 * THREE.Group v LOKÁLNÍM prostoru úseku herdbloku — stejný souřadný systém
 * jako buildHerdblokUsek (x od 0, z = 0 líc pracovní desky, viz hlavička
 * souboru).
 *
 * Z: prvek sedí lícem na PANEL_SETBACK_MM a vystupuje dopředu o depthMM,
 * tedy od (PANEL_SETBACK_MM − depthMM) do PANEL_SETBACK_MM. TVRDÁ PODMÍNKA
 * zadavatele (PREDANI-2026-08-05.md §4): ovládací panel ani nic v něm nesmí
 * NIKDY předsazovat před spodní hranu desky (z = 0 je líc desky a záporné z
 * je v celém modulu zakázané, viz hlavička souboru). `clamp()` tu proto
 * NENÍ jen dopočet — je to kontrola, která tu podmínku drží i kdyby v
 * budoucnu přibyl prvek s depthMM > PANEL_SETBACK_MM: takový prvek by se
 * zploštil na z = 0 (zarovnal na líc desky), nikdy by ho nepřekročil.
 *
 * Y: heightMM je střed prvku nad SPODNÍ hranou panelu (LISTA_HEIGHT_MM) —
 * stejná konvence, jakou uvnitř úseku používá panel i lišta.
 *
 * Šířku prvku vůči šířce PANELU (ne úseku) tahle funkce NEKONTROLUJE — nezná
 * ji (viz signatura). O to se stará volající (buildHerdblokUsek), který
 * leftInsetMM/rightInsetMM daného úseku už má spočítané.
 *
 * @param {object} p
 * @param {'socket230'|'socketCEE'} p.kind
 * @param {number} p.xMM  poloha STŘEDU prvku, LOKÁLNÍ x úseku herdbloku
 * @param {number} [p.heightMM=PANEL_ITEM_HEIGHT_DEFAULT_MM]  výška STŘEDU
 *   nad spodní hranou panelu
 * @returns {THREE.Group|null}  null pro neznámý `kind` (tiché no-op, žádný pád)
 */
export function buildPanelItem({ kind, xMM, heightMM = PANEL_ITEM_HEIGHT_DEFAULT_MM }) {
  const spec = PANEL_ITEM[kind];
  if (!spec) return null; // neznámý typ prvku — tiché no-op, stejné pravidlo jako u šířky panelu

  const frontZMM = clamp(PANEL_SETBACK_MM - spec.depthMM, 0, PANEL_SETBACK_MM); // viz JSDoc — drží z >= 0
  const depthMM = PANEL_SETBACK_MM - frontZMM;

  const group = new THREE.Group();
  group.name = 'panel-item';

  const mesh = box(mm(spec.widthMM), mm(spec.heightMM), mm(depthMM), createPanelMaterial());
  mesh.position.set(
    mm(xMM),
    mm(LISTA_HEIGHT_MM + heightMM),
    mm(frontZMM + depthMM / 2)
  );
  group.add(mesh);

  group.userData.kind = kind;
  group.userData.widthMM = spec.widthMM;
  return group;
}

// ============================================================================
// HERDBLOK — sestavení z obrysu (deska) + kvádrů (korpus, panel, lišta)
// ============================================================================

/**
 * Sestaví JEDEN úsek herdbloku (deska + korpus + panel + lišta) jako
 * THREE.Group v LOKÁLNÍM prostoru (x od 0 do widthMM, z = 0 líc desky,
 * viz hlavička souboru).
 *
 * @param {object} usek
 * @param {number} usek.widthMM
 * @param {number} usek.depthMM  hloubka herdbloku (výchozí HERDBLOK_DEPTH_DEFAULT_MM)
 * @param {string} usek.leftEndType  END_TYPES.*
 * @param {string} usek.rightEndType END_TYPES.*
 * @param {Array<{edge:'front'|'back'|'left'|'right', heightMM:number}>} [usek.collar]
 *   límec na vybraných hranách — 'left'/'right' jen když je dotyčný konec
 *   END_TYPES.VERTICAL_PLATE (u VERTICAL_PLATE_CHAMFER se na tom konci
 *   límec NEVYKRESLÍ, i když je v poli požadovaný).
 * @param {Array<{kind:string, xMM:number, heightMM:number}>} [usek.panelItems]
 *   prvky ovládacího panelu (viz buildPanelItem) — xMM je LOKÁLNÍ souřadnice
 *   ÚSEKU (ne bloku, tu už převádí volající). Prvek, který by svou šířkou
 *   přesáhl mimo šířku PANELU (leftInsetMM..width-rightInsetMM, užší než
 *   úsek — viz sideInsetMM), se TIŠE nevykreslí, žádný pád, nic se nedomýšlí.
 * @param {boolean} [usek.includeDesk=true]  ÚKOL 6 (ostrov): `false` u OBOU
 *   stran ostrova — deska je tam JEDNA průběžná, staví ji buildMonoBlock
 *   samostatně přes buildHerdblokDesk() (viz zadání, "ne dvě desky proti
 *   sobě se spárou uprostřed"). U `single` beze změny (`true`, jako dosud).
 * @param {boolean} [usek.includeNose=true]  ÚKOL 6 (ostrov): `false` u OBOU
 *   stran ostrova — nos (vodopád) jde na X-koncích "od čela k čelu" přes
 *   CELOU kombinovanou hloubku, ne po stranách zvlášť; staví ho buildMonoBlock
 *   samostatně přes buildHerdblokNose(). U `single` beze změny (`true`).
 * @param {boolean} [usek.chamferAllCorners=false]  ÚKOL 6 (ostrov): protéká
 *   do buildHerdblokDesk (jen když includeDesk) — u `single` se sem nedostane
 *   nic (deska se staví mimo), ale parametr se nechává i tady kvůli
 *   jednotnému rozhraní usek objektu.
 */
export function buildHerdblokUsek(usek) {
  const {
    widthMM,
    depthMM = HERDBLOK_DEPTH_DEFAULT_MM,
    leftEndType = END_TYPES.VERTICAL_PLATE,
    rightEndType = END_TYPES.VERTICAL_PLATE,
    collar = [],
    panelItems = [],
    includeDesk = true,
    includeNose = true,
    chamferAllCorners = false,
  } = usek;

  const group = new THREE.Group();
  group.name = 'herdblok-usek';

  const stainless = createStainlessMaterial();
  const panelMat = createPanelMaterial();

  // --- deska: obrysová deska, y (HERDBLOK_HEIGHT_MM − DESK_FACE_HEIGHT_MM)..HERDBLOK_HEIGHT_MM,
  // z 0..depthMM (plný půdorys), x 0..width. Čelo (svislý řez) zůstává
  // ROVNÉ po celé délce, BEZ FACETKY — zkosení u svislaDeskaZkos je
  // VÝHRADNĚ PŮDORYSNÉ (useknutý PŘEDNÍ roh shora, viz ÚKOL B zadání a
  // cornerPoints výš); buildHerdblokOutline ho automaticky promítne i sem,
  // žádná další úprava tady není potřeba.
  // ÚKOL 6 (ostrov): includeDesk=false u OBOU stran ostrova — deska je JEDNA
  // průběžná, staví ji buildMonoBlock samostatně (buildHerdblokDesk, viz JSDoc
  // parametru výš). U `single` beze změny — desk se staví tady, přesně jako dřív.
  if (includeDesk) {
    const desk = buildHerdblokDesk({ widthMM, depthMM, leftEndType, rightEndType, frontZMM: 0, chamferAllCorners });
    desk.name = 'deska';
    group.add(desk);
  }

  // --- zatažení od boku pro korpus/panel/lištu/nos — NENÍ symetrické, závisí
  // na typu KAŽDÉHO konce zvlášť (viz zadání bod 2, ÚKOL A). Spočteno JEDNOU
  // tady, používá ho korpus (níž), panel, lišta i nos.
  const leftInsetMM = sideInsetMM(leftEndType);
  const rightInsetMM = sideInsetMM(rightEndType);

  // --- korpus herdbloku: kvádr pod deskou, y 0..PANEL_HEIGHT_MM,
  // z (PANEL_SETBACK_MM+PANEL_GAP_MM)..(depthMM-DESK_OVERHANG_BACK_MM),
  // x leftInsetMM..(width-rightInsetMM). OPRAVA (ÚKOL A): dřív šel korpus
  // 0..width, souosý s deskou i nosem na x=0/x=width (z-fighting vada).
  // Korpus se teď zatahuje STEJNĚ jako panel a lišta, takže ho nos podle
  // zadání "zakryje celý".
  const corpusFrontZ = PANEL_SETBACK_MM + PANEL_GAP_MM; // 26
  const corpusBackZ = depthMM - DESK_OVERHANG_BACK_MM;  // 825 při depthMM 850
  const corpusDepthMM = corpusBackZ - corpusFrontZ;
  const corpusWidthMM = widthMM - leftInsetMM - rightInsetMM;
  // TODO: pro widthMM < leftInsetMM+rightInsetMM vyjde corpusWidthMM záporné
  // — stejná mez jako u panelWidthMM níž, tak úzký úsek zadání nepředpokládá.
  const corpus = box(mm(corpusWidthMM), mm(PANEL_HEIGHT_MM), mm(corpusDepthMM), stainless);
  corpus.position.set(
    mm(leftInsetMM + corpusWidthMM / 2),
    mm(PANEL_HEIGHT_MM) / 2,
    mm(corpusFrontZ + corpusDepthMM / 2)
  );
  corpus.name = 'korpus';
  group.add(corpus);

  // --- ovládací panel: x leftInsetMM..(width-rightInsetMM) (spočteno výš u
  // korpusu, používá ho i lišta a nos), y LISTA_HEIGHT_MM..PANEL_HEIGHT_MM,
  // z PANEL_SETBACK_MM..(PANEL_SETBACK_MM+20).
  // Hloubka panelu (20 mm) nemá vlastní pojmenovanou konstantu v zadání —
  // je to literální rozměr odvozený z rozsahu z 25–45 (bod 4 zadání).
  const PANEL_DEPTH_MM = 20;
  const panelWidthMM = widthMM - leftInsetMM - rightInsetMM;
  // TODO: pro widthMM < leftInsetMM+rightInsetMM vyjde panelWidthMM záporné —
  // takhle úzký úsek herdbloku zadání nepředpokládá, neošetřuje se (prototyp).
  const panelHeightMM = PANEL_HEIGHT_MM - LISTA_HEIGHT_MM; // 200
  const panel = box(mm(panelWidthMM), mm(panelHeightMM), mm(PANEL_DEPTH_MM), panelMat);
  panel.position.set(
    mm(leftInsetMM + panelWidthMM / 2),
    mm(LISTA_HEIGHT_MM + panelHeightMM / 2),
    mm(PANEL_SETBACK_MM + PANEL_DEPTH_MM / 2)
  );
  panel.name = 'panel';
  group.add(panel);

  // --- spodní lišta: součást panelu, STEJNÁ šířka i (nesymetrické) zatažení
  // od boku jako panel, x leftInsetMM..(width-rightInsetMM), y 0..LISTA_HEIGHT_MM,
  // z LISTA_FRONT_Z_MM..(stejná zadní rovina jako panel).
  const listaFrontZ = LISTA_FRONT_Z_MM; // 3
  const listaBackZ = PANEL_SETBACK_MM + PANEL_DEPTH_MM;  // 45 — stejná zadní rovina jako panel
  const listaDepthMM = listaBackZ - listaFrontZ;
  const lista = box(mm(panelWidthMM), mm(LISTA_HEIGHT_MM), mm(listaDepthMM), panelMat);
  lista.position.set(
    mm(leftInsetMM + panelWidthMM / 2),
    mm(LISTA_HEIGHT_MM) / 2,
    mm(listaFrontZ + listaDepthMM / 2)
  );
  lista.name = 'lista';
  group.add(lista);

  // Panel ani lišta NEJSOU po celé délce — na obou koncích chybí
  // leftInsetMM / rightInsetMM, tam by zůstal vidět holý korpus a schod
  // vůči přesahující desce (deska jde 0..depthMM, korpus teď JEN
  // leftInsetMM..width-rightInsetMM, viz výš). Přesně tenhle schod zakrývá
  // VODOPÁD ("nos").
  //
  // --- vodopád/nos: OPRAVA (ÚKOL A) — dřív kvádr tloušťky
  // SIDE_PLATE_THICKNESS_MM, to byla chyba zadání (souosá stěna s
  // deskou/korpusem na x=0/x=width → z-fighting, a nos byl navíc příliš
  // úzký). Nos teď vyplňuje CELÉ zatažení sideInsetMM(endType) v X (50 u
  // svislaDeska, 70 u svislaDeskaZkos — NE SIDE_PLATE_THICKNESS_MM), CELOU
  // hloubku (z 0..depthMM) a Y JEN PO SPODNÍ LÍC DESKY
  // (0..HERDBLOK_HEIGHT_MM − DESK_FACE_HEIGHT_MM) — nezasahuje do desky nad
  // tím, se kterou spolu tvoří jednu průběžnou plochu bez souosé stěny.
  //
  // Půdorys nosu je TENTÝŽ monolit jako obrys desky na daném konci (ÚKOL B):
  // u svislaDeska prostý obdélník, u svislaDeskaZkos useknutý PŘEDNÍ roh —
  // noseOutline() proto počítá roh přes STEJNOU cornerPoints() jako
  // buildHerdblokOutline.
  // ÚKOL 6 (ostrov): includeNose=false u OBOU stran ostrova — nos jde na
  // X-koncích "od čela k čelu" přes CELOU kombinovanou hloubku, staví ho
  // buildMonoBlock samostatně (buildHerdblokNose, viz JSDoc parametru výš).
  // U `single` beze změny — nos se staví tady, přesně jako dřív.
  if (includeNose) {
    [
      { name: 'vodopad-levy', endType: leftEndType, side: 'left' },
      { name: 'vodopad-pravy', endType: rightEndType, side: 'right' },
    ].forEach(({ name, endType, side }) => {
      const nose = buildHerdblokNose({ endType, side, widthMM, depthMM, chamferAllCorners });
      nose.name = name;
      group.add(nose);
    });
  }

  // --- prvky panelu (zásuvky apod.): xMM je LOKÁLNÍ souřadnice ÚSEKU (viz
  // JSDoc výš). Kontrola je proti ŠÍŘCE PANELU, ne proti šířce úseku —
  // panel je užší (viz leftInsetMM/rightInsetMM/panelWidthMM výš) a prvek,
  // který by svou šířkou přesáhl mimo něj, se TIŠE nevykreslí (žádný pád).
  panelItems.forEach(({ kind, xMM: itemXMM, heightMM: itemHeightMM }) => {
    const spec = PANEL_ITEM[kind];
    if (!spec) return; // neznámý typ prvku — tiché no-op, stejné pravidlo
    const halfWidthMM = spec.widthMM / 2;
    if (itemXMM - halfWidthMM < leftInsetMM || itemXMM + halfWidthMM > widthMM - rightInsetMM) return;
    const item = buildPanelItem({ kind, xMM: itemXMM, heightMM: itemHeightMM });
    if (item) group.add(item);
  });

  // --- límec: jen front/back vždy, left/right jen když je dotyčný konec
  // END_TYPES.VERTICAL_PLATE (u VERTICAL_PLATE_CHAMFER se na tom konci
  // límec nevykreslí, i když je požadovaný v poli `collar`). Límec vyrůstá
  // z horní hrany DESKY (obrys desky, z 0..depthMM, ne z obrysu korpusu).
  collar.forEach(({ edge, heightMM = COLLAR_HEIGHT_DEFAULT_MM }) => {
    const h = clamp(heightMM, COLLAR_HEIGHT_MIN_MM, COLLAR_HEIGHT_MAX_MM);
    const baseY = HERDBLOK_HEIGHT_MM; // horní hrana desky
    let wall = null;
    // Pořadí bodů (p1→p2) u KAŽDÉ hrany obchází obrys desky jedním smyslem
    // (front zleva doprava, right dopředu dozadu, back zprava doleva, left
    // dozadu dopředu) — na tomhle pořadí závisí, kterým směrem v
    // buildCollarWall() míří dopočítaná kolmice (viz OPRAVA komentář tam):
    // jen při tomhle obcházení vyjde offset dovnitř obrysu pro všechny
    // čtyři hrany se stejným vzorcem, bez ručních znamének po hranách.
    if (edge === 'front') {
      wall = buildCollarWall(0, 0, widthMM, 0, baseY, h, stainless);
    } else if (edge === 'back') {
      wall = buildCollarWall(widthMM, depthMM, 0, depthMM, baseY, h, stainless);
    } else if (edge === 'left' && leftEndType === END_TYPES.VERTICAL_PLATE) {
      wall = buildCollarWall(0, depthMM, 0, 0, baseY, h, stainless);
    } else if (edge === 'right' && rightEndType === END_TYPES.VERTICAL_PLATE) {
      wall = buildCollarWall(widthMM, 0, widthMM, depthMM, baseY, h, stainless);
    }
    if (wall) {
      wall.name = `limec-${edge}`;
      group.add(wall);
    }
  });

  group.userData.widthMM = widthMM;
  group.userData.depthMM = depthMM;
  return group;
}

// ============================================================================
// PODESTAVBA — skříňka sestavená z dílců: stěny, podlážka, lišta, nožičky,
// H2 náběhy a TĚLO podle druhu/stylu (§3 ZADANI-PODESTAVBY-MONO.md) — čelní
// stěna (cabinet+closed), dvířka s úchytkami (cabinet/gnRack+doors), police
// (cabinet+open+hasShelf), zásuvková čela (drawers) nebo GN vsuvy (gnRack).
// Podestavba je na nožičkách v konstrukční výšce, aby šlo posoudit
// most/převis vůči herdbloku.
// ============================================================================

// --- tělo skříňky podle druhu/stylu (§3a–§3e) — pomocné funkce, volá je
// buildPodestavba níž. Kvádry přes stejný box() jako zbytek souboru;
// úchytky přímo přes THREE.CylinderGeometry (bez EdgesGeometry — obrysové
// hrany na válci nejsou potřeba, stejný vzhled jako u SEGMENTu). Vzhledový
// jazyk dvířek/úchytek je STEJNÝ jako SEGMENT (buildDoorBody/buildDrawersBody
// v modules.js jsou PŘEDLOHA ke čtení), ale nic se odtud neimportuje —
// mono-geometry.js zůstává bez importu z modules.js (viz hlavička souboru).

/**
 * Čelní stěna zavřené skříňky (kind 'cabinet', bodyStyle 'closed', §3a) —
 * jedno těleso mezi bočními stěnami, od yBodyBottom po SPODNÍ HRANU horní
 * lišty (lišta zůstává viditelná, žádný překryv), z zFront..zFront+WALL_MM
 * (za lícem korpusu, tloušťka WALL_MM).
 */
function buildCabinetFrontWall({ group, widthMM, bodyHeightMM, yBodyBottom, zFront, material }) {
  const heightMM = bodyHeightMM - TOP_RAIL_MM;
  const wall = box(mm(widthMM - 2 * WALL_MM), mm(heightMM), mm(WALL_MM), material);
  wall.position.set(
    mm(widthMM) / 2,
    mm(yBodyBottom + heightMM / 2),
    mm(zFront + WALL_MM / 2)
  );
  wall.name = 'celni-stena';
  group.add(wall);
}

/**
 * Křídlová dvířka s úchytkami (bodyStyle 'doors', §3b) — sdílená pro
 * `kind:'cabinet'` i `kind:'gnRack'` (vsuvy gnRack se stavějí VŽDY, dvířka
 * je jen zakryjí, §3e). Počet křídel: widthMM > 600 → 2, jinak 1 (stejné
 * pravidlo jako SEGMENT). Výškově zarovnaná stejně jako celni-stena (od
 * yBodyBottom, výška bodyHeightMM − DOOR_HEIGHT_GAP_MM) — nepřekrývá se
 * s horní lištou, i když je (na rozdíl od celni-stena) předsazená před líc
 * korpusu, takže by se stejně nepotkaly ve stejné rovině Z.
 */
function buildCabinetDoors({ group, widthMM, bodyHeightMM, yBodyBottom, stainless, knobMat }) {
  const doorCount = widthMM > 600 ? 2 : 1;
  const doorWidthMM = widthMM / doorCount;
  const doorHeightMM = bodyHeightMM - DOOR_HEIGHT_GAP_MM;
  const centerYMM = yBodyBottom + doorHeightMM / 2;

  for (let i = 0; i < doorCount; i++) {
    const xCenterMM = doorWidthMM * (i + 0.5);

    const door = box(mm(doorWidthMM - DOOR_WIDTH_GAP_MM), mm(doorHeightMM), mm(DOOR_THICKNESS_MM), stainless);
    door.position.set(mm(xCenterMM), mm(centerYMM), mm(DOOR_FRONT_Z_MM + DOOR_THICKNESS_MM / 2));
    door.name = 'dvirka';
    group.add(door);

    // úchytka blíž ke středové spáře (dvoukřídlé) / u vzdálenější hrany
    // (jednokřídlé) — stejná konvence jako SEGMENT (buildDoorBody).
    const handleOffsetMM = doorCount === 2
      ? doorWidthMM * (i === 0 ? DOOR_HANDLE_OFFSET_DOUBLE_RATIO : -DOOR_HANDLE_OFFSET_DOUBLE_RATIO)
      : doorWidthMM * DOOR_HANDLE_OFFSET_SINGLE_RATIO;
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(mm(DOOR_HANDLE_RADIUS_MM), mm(DOOR_HANDLE_RADIUS_MM), mm(DOOR_HANDLE_LENGTH_MM), 12),
      knobMat
    );
    // svislý válec — výchozí osa CylinderGeometry (Y) sedí beze změny,
    // žádná rotace potřeba (na rozdíl od vodorovné úchytky zásuvky níž).
    handle.position.set(mm(xCenterMM + handleOffsetMM), mm(centerYMM), mm(DOOR_HANDLE_Z_MM));
    handle.castShadow = true;
    handle.name = 'dvirka-uchytka';
    group.add(handle);
  }
}

/**
 * Police (kind 'cabinet', bodyStyle 'open', hasShelf:true, §3c) — jedno
 * těleso zapuštěné od líce korpusu, výškově vystředěné v dutině mezi
 * podlážkou a horní lištou. Volající (buildPodestavba) tuhle funkci zavolá
 * JEN při hasShelf:true — při false se těleso vůbec nepostaví (stejná
 * konvence jako H2 náběhy, ne schovat).
 */
function buildCabinetShelf({ group, widthMM, depthMM, yBodyBottom, yBodyTop, zFront, material }) {
  const widthShelfMM = widthMM - 2 * WALL_MM - SHELF_WIDTH_INSET_MM;
  const depthShelfMM = depthMM - SHELF_FRONT_RECESS_MM - BACK_WALL_MM - SHELF_BACK_GAP_MM;
  const zFrontShelfMM = zFront + SHELF_FRONT_RECESS_MM;

  const cavityBottomMM = yBodyBottom + FLOOR_MM;       // horní hrana podlážky
  const cavityTopMM = yBodyTop - TOP_RAIL_MM;          // spodní hrana horní lišty
  const centerYMM = (cavityBottomMM + cavityTopMM) / 2;

  const shelf = box(mm(widthShelfMM), mm(SHELF_THICKNESS_MM), mm(depthShelfMM), material);
  shelf.position.set(mm(widthMM) / 2, mm(centerYMM), mm(zFrontShelfMM + depthShelfMM / 2));
  shelf.name = 'police';
  group.add(shelf);
}

/**
 * Zásuvkový blok — PRÁVĚ 2 zásuvková čela s úchytkami (kind 'drawers', §3d;
 * počet je KONSTANTA DRAWER_COUNT, žádný parametr). Prostor od yBodyBottom
 * po spodní hranu horní lišty (stejný rozsah jako celni-stena/dvirka) se
 * dělí na DRAWER_COUNT stejných slotů.
 */
function buildDrawerFronts({ group, widthMM, bodyHeightMM, yBodyBottom, stainless, knobMat }) {
  const totalHeightMM = bodyHeightMM - TOP_RAIL_MM;
  const slotHeightMM = totalHeightMM / DRAWER_COUNT;
  const frontWidthMM = widthMM - DRAWER_WIDTH_INSET_MM;
  const frontHeightMM = slotHeightMM - DRAWER_SLOT_GAP_MM;

  for (let i = 0; i < DRAWER_COUNT; i++) {
    const slotCenterYMM = yBodyBottom + slotHeightMM * (i + 0.5);

    const front = box(mm(frontWidthMM), mm(frontHeightMM), mm(DRAWER_THICKNESS_MM), stainless);
    front.position.set(mm(widthMM) / 2, mm(slotCenterYMM), mm(DRAWER_FRONT_Z_MM + DRAWER_THICKNESS_MM / 2));
    front.name = 'zasuvka-celo';
    group.add(front);

    // vodorovná úchytka (osa podél X) u horního okraje čela — CylinderGeometry
    // má výchozí osu Y, rotace o 90° kolem Z ji položí podél X (stejný trik
    // jako SEGMENT buildDrawersBody).
    const handleLengthMM = frontWidthMM * DRAWER_HANDLE_LENGTH_RATIO;
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(mm(DRAWER_HANDLE_RADIUS_MM), mm(DRAWER_HANDLE_RADIUS_MM), mm(handleLengthMM), 12),
      knobMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(
      mm(widthMM) / 2,
      mm(slotCenterYMM + frontHeightMM * DRAWER_HANDLE_Y_RATIO),
      mm(DRAWER_HANDLE_Z_MM)
    );
    handle.castShadow = true;
    handle.name = 'zasuvka-uchytka';
    group.add(handle);
  }
}

/**
 * Skříňka se zásuvy na GN — 6 párů vodorovných profilů 15×15 mm na VNITŘNÍ
 * ploše obou bočních stěn (kind 'gnRack', §3e), rozteč GN_RUNNER_PITCH_MM
 * (70 mm), STAVÍ SE VŽDY (i při bodyStyle:'doors' — dvířka je pak jen
 * zakryjí, viz buildCabinetDoors). Celkem GN_RUNNER_COUNT_PER_SIDE*2 = 12
 * těles `gn-vsuv`.
 */
function buildGnRunners({ group, widthMM, depthMM, yBodyBottom, zFront, material }) {
  const zFromMM = zFront + GN_RUNNER_FRONT_RECESS_MM;
  const zToMM = zFront + depthMM - BACK_WALL_MM - GN_RUNNER_BACK_GAP_MM;
  const runnerDepthMM = zToMM - zFromMM;
  const floorTopMM = yBodyBottom + FLOOR_MM;

  // levá strana: x od WALL_MM do WALL_MM+15; pravá strana zrcadlově od
  // widthMM-WALL_MM-15 do widthMM-WALL_MM — vnitřní plocha bočních stěn.
  [WALL_MM, widthMM - WALL_MM - GN_RUNNER_SECTION_MM].forEach((xFromMM) => {
    for (let i = 0; i < GN_RUNNER_COUNT_PER_SIDE; i++) {
      const centerYMM = floorTopMM + GN_RUNNER_FIRST_OFFSET_MM + i * GN_RUNNER_PITCH_MM;
      const runner = box(mm(GN_RUNNER_SECTION_MM), mm(GN_RUNNER_SECTION_MM), mm(runnerDepthMM), material);
      runner.position.set(
        mm(xFromMM + GN_RUNNER_SECTION_MM / 2),
        mm(centerYMM),
        mm(zFromMM + runnerDepthMM / 2)
      );
      runner.name = 'gn-vsuv';
      group.add(runner);
    }
  });
}

/**
 * @param {object} p
 * @param {number} p.widthMM
 * @param {number} p.depthMM  výchozí PODESTAVBA_DEPTH_MM
 * @param {number} p.bodyHeightMM  výška TĚLA skříňky (PEVNÁ, BODY_STACK_MM −
 *   HERDBLOK_HEIGHT_MM = 460 — nezávisí na soklu, viz buildMonoBlock)
 * @param {string} [p.finish]  MonoCabinet.finish (ZADANI-MONO-UI.md §1) —
 *   VLASTNOST TÉTHLE JEDNÉ SKŘÍŇKY, ne bloku (PREDANI.md úkol 9b): náběhy
 *   H2 (buildH2Fillet) se STAVÍ pouze pro FINISH_H2 ('H2'); pro cokoli
 *   jiného — 'H1', 'HS+', chybějící nebo neznámou hodnotu — se dílce náběhu
 *   VŮBEC NEVYTVOŘÍ (ne jen schovají/zmenší na nulu). Viz FINISH_H2 výš,
 *   proč tenhle test sám o sobě správně pokrývá i chybějící/neznámou
 *   hodnotu (spadá na DEFAULT_FINISH='H1', který je taky bez radiusu).
 * @param {string} [p.plinthType]  sokl JE VLASTNOST CELÉHO BLOKU
 *   (ZADANI-SOKL.md), sem chodí jen PROTAŽENÝ z buildMonoBlock() — řídí,
 *   jestli se pro tuhle skříňku staví nožičky (`legs`/`legs_plinth`), nebo
 *   nic (`building`/`construction` — rám/zástěna jsou NA ÚROVNI BLOKU,
 *   staví je buildBlockPlinth(), ne tahle funkce).
 * @param {number} [p.plinthHeightMM]  výška soklové zóny (plinth.heightMM,
 *   50–150) — nahrazuje dřívější pevnou LEG_HEIGHT_MM (150).
 * @param {string} [p.kind='cabinet']  MonoCabinet.kind (§1
 *   ZADANI-PODESTAVBY-MONO.md) — 'cabinet' | 'drawers' | 'gnRack'. Chybějící
 *   nebo neznámá hodnota se chová jako 'cabinet' (§2 zadání). Řídí TĚLO
 *   skříňky (§3): 'cabinet' → celni-stena/dvirka/police podle bodyStyle;
 *   'drawers' → PRÁVĚ 2 zasuvka-celo (bodyStyle se ignoruje — 'drawers' v
 *   datovém modelu §1 vlastní bodyStyle ani nemá); 'gnRack' → 12 gn-vsuv
 *   (6+6, rozteč 70 mm), navíc dvirka podle bodyStyle.
 * @param {string} [p.bodyStyle='closed']  u 'cabinet': 'closed' | 'doors' |
 *   'open' (chybějící/neznámá hodnota → 'closed'); u 'gnRack': jen 'open' |
 *   'doors' (chybějící/neznámá hodnota → 'open', NE 'closed' — §2 zadání);
 *   u 'drawers' se nepoužívá vůbec.
 * @param {boolean} [p.hasShelf=false]  jen u 'cabinet'+'open': při true se
 *   navíc postaví těleso 'police'; při false (nebo u jiného kind/bodyStyle)
 *   se těleso police VŮBEC NEPOSTAVÍ (§3c, stejná konvence jako H2 náběhy).
 */
export function buildPodestavba({
  widthMM, depthMM = PODESTAVBA_DEPTH_MM, bodyHeightMM, finish,
  plinthType = DEFAULT_PLINTH_TYPE, plinthHeightMM = PLINTH_HEIGHT_DEFAULT_MM,
  kind = 'cabinet', bodyStyle = 'closed', hasShelf = false,
}) {
  const group = new THREE.Group();
  group.name = 'podestavba';

  const stainless = createStainlessMaterial();
  const plinth = createPlinthMaterial();

  const zFront = DESK_OVERHANG_FRONT_MM;   // 30 — líc podestavby
  const zBack = zFront + depthMM;          // 700 při depthMM 670 — zadní líc podestavby
  const yBodyBottom = plinthHeightMM;       // horní hrana soklové zóny
  const yBodyTop = plinthHeightMM + bodyHeightMM; // horní hrana podestavby

  // --- 2 boční stěny (tloušťka WALL_MM, plná hloubka, plná výška těla) -----
  [0, widthMM - WALL_MM].forEach((xWall) => {
    const wall = box(mm(WALL_MM), mm(bodyHeightMM), mm(depthMM), stainless);
    wall.position.set(
      mm(xWall + WALL_MM / 2),
      mm(yBodyBottom + bodyHeightMM / 2),
      mm(zFront + depthMM / 2)
    );
    wall.name = 'bocni-stena';
    group.add(wall);
  });

  // --- zadní stěna (tloušťka BACK_WALL_MM, MEZI bočními stěnami) -----------
  const backWall = box(mm(widthMM - 2 * WALL_MM), mm(bodyHeightMM), mm(BACK_WALL_MM), stainless);
  backWall.position.set(
    mm(widthMM) / 2,
    mm(yBodyBottom + bodyHeightMM / 2),
    mm(zBack - BACK_WALL_MM / 2)
  );
  backWall.name = 'zadni-stena';
  group.add(backWall);

  // --- podlážka (tloušťka FLOOR_MM, u spodní hrany těla, MEZI bočními
  // stěnami; hloubkově KONČÍ před zadní stěnou, aby se s ní neprotínala
  // stejnou rovinou — viz kontrola z-fightingu v zadání) ---------------------
  const floorFrontZ = zFront;
  const floorBackZ = zBack - BACK_WALL_MM;
  const floorDepthMM = floorBackZ - floorFrontZ;
  const floor = box(mm(widthMM - 2 * WALL_MM), mm(FLOOR_MM), mm(floorDepthMM), stainless);
  floor.position.set(
    mm(widthMM) / 2,
    mm(yBodyBottom + FLOOR_MM / 2),
    mm(floorFrontZ + floorDepthMM / 2)
  );
  floor.name = 'podlazka';
  group.add(floor);

  // --- příčná lišta nahoře 20×20, JEN VPŘEDU --------------------------------
  const rail = box(mm(widthMM - 2 * WALL_MM), mm(TOP_RAIL_MM), mm(TOP_RAIL_MM), plinth);
  rail.position.set(
    mm(widthMM) / 2,
    mm(yBodyTop - TOP_RAIL_MM / 2),
    mm(zFront + TOP_RAIL_MM / 2)
  );
  rail.name = 'lista-horni';
  group.add(rail);

  // --- 4 nožičky (LEG_SIZE_MM konstanta, NE dopočet ze šířky) ---------------
  // OPRAVA (PREDANI.md úkol 13, VADA): dřív se stavěly NATVRDO bez ohledu na
  // typ soklu — teď JEN pro `legs`/`legs_plinth` (ZADANI-SOKL.md), pro
  // `building`/`construction` se tady nekreslí nic (viz JSDoc výš).
  // Vnější líc nožičky je LEG_INSET_MM od bočního i čelního/zadního líce.
  if (plinthType === 'legs' || plinthType === 'legs_plinth') {
    const legXs = [
      LEG_INSET_MM + LEG_SIZE_MM / 2,
      widthMM - LEG_INSET_MM - LEG_SIZE_MM / 2,
    ];
    const legZs = [
      zFront + LEG_INSET_MM + LEG_SIZE_MM / 2,
      zBack - LEG_INSET_MM - LEG_SIZE_MM / 2,
    ];
    legXs.forEach((lx) => {
      legZs.forEach((lz) => {
        const leg = box(mm(LEG_SIZE_MM), mm(plinthHeightMM), mm(LEG_SIZE_MM), plinth);
        leg.position.set(mm(lx), mm(plinthHeightMM) / 2, mm(lz));
        leg.name = 'nozicka';
        group.add(leg);
      });
    });
  }

  // --- hygienický stupeň H2: R16 v koutech MEZI PODLÁŽKOU A BOČNÍMI STĚNAMI
  // (dva kouty, zepředu vidět vlevo a vpravo dole) — STAVÍ SE JEN pro
  // finish === FINISH_H2 (PREDANI.md úkol 9b). 'H1' a 'HS+' mají ostrý roh:
  // dílce náběhu se pro ně vůbec NEVYTVOŘÍ (žádné buildH2Fillet volání), ne
  // jen schovají/zmenší na nulu — proto je celý blok podmíněný, ne jednotlivé
  // meshe. Ostatní kouty ne — H3 se teď nedělá (viz "Co se teď NEDĚLÁ"). ----
  if (finish === FINISH_H2) {
    const h2Left = buildH2Fillet(WALL_MM, yBodyBottom + FLOOR_MM, +1, floorFrontZ, floorBackZ, stainless);
    h2Left.name = 'h2-levy';
    group.add(h2Left);
    const h2Right = buildH2Fillet(widthMM - WALL_MM, yBodyBottom + FLOOR_MM, -1, floorFrontZ, floorBackZ, stainless);
    h2Right.name = 'h2-pravy';
    group.add(h2Right);
  }

  // --- TĚLO podle druhu/stylu (§3a–§3e ZADANI-PODESTAVBY-MONO.md) ----------
  // Neznámý `kind` se chová jako 'cabinet' (§2 zadání) — 'drawers'/'gnRack'
  // jsou jediné jiné platné hodnoty, cokoli jiného (vč. chybějící) spadá sem.
  const knobMat = createKnobMaterial(); // úchytky dvířek i zásuvek
  const effectiveKind = kind === 'drawers' || kind === 'gnRack' ? kind : 'cabinet';

  if (effectiveKind === 'cabinet') {
    // neznámý bodyStyle → 'closed' (§2 zadání)
    const style = bodyStyle === 'doors' || bodyStyle === 'open' ? bodyStyle : 'closed';
    if (style === 'closed') {
      buildCabinetFrontWall({ group, widthMM, bodyHeightMM, yBodyBottom, zFront, material: stainless });
    } else if (style === 'doors') {
      // za dvířky se čelní stěna NESTAVÍ (§3b) — dvířka kryjí otvor sama
      buildCabinetDoors({ group, widthMM, bodyHeightMM, yBodyBottom, stainless, knobMat });
    } else if (hasShelf) {
      // style === 'open': bez čelní stěny i dvířek; police JEN při hasShelf
      // (§3c) — při false se těleso vůbec nepostaví, ne jen schová.
      buildCabinetShelf({ group, widthMM, depthMM, yBodyBottom, yBodyTop, zFront, material: stainless });
    }
  } else if (effectiveKind === 'drawers') {
    // bodyStyle se u drawers nepoužívá (§1 — datový model ho ani nemá)
    buildDrawerFronts({ group, widthMM, bodyHeightMM, yBodyBottom, stainless, knobMat });
  } else if (effectiveKind === 'gnRack') {
    // vsuvy se stavějí VŽDY, i za zavřenými dvířky (§3e)
    buildGnRunners({ group, widthMM, depthMM, yBodyBottom, zFront, material: stainless });
    if (bodyStyle === 'doors') {
      // u gnRack neznámý bodyStyle → 'open' (NE 'closed', §2 zadání) — jen
      // 'doors' přidává dvířka, cokoli jiného (vč. chybějící) je bez nich.
      buildCabinetDoors({ group, widthMM, bodyHeightMM, yBodyBottom, stainless, knobMat });
    }
  }

  group.userData.widthMM = widthMM;
  group.userData.depthMM = depthMM;
  group.userData.bodyHeightMM = bodyHeightMM;
  return group;
}

// ============================================================================
// BOČNÍ KRYT — dva druhy (THICK/THIN), ODVOZENÉ z řady podestaveb
// ============================================================================
// Hloubka je PARAMETR, ne konstanta (dva případy): blok u stěny
// (fromZMM=DESK_OVERHANG_FRONT_MM, toZMM=HERDBLOK_DEPTH_DEFAULT_MM), nebo
// ostrovní blok (jeden průběžný kus přes obě řady podestaveb i mezeru mezi
// nimi — tenhle druhý případ zatím nikdo nevolá, jen ho signatura
// nevylučuje). buildSideCover() zůstává exportovaná pro samostatné použití,
// ale hlavní cestou je computeSideCovers() + buildMonoBlock(), který kryty
// vygeneruje SÁM z řady podestaveb — není to volba volajícího (viz zadání,
// bod 5): každá odkrytá boční strana podestavby musí kryt dostat, tloušťka
// (THICK 50 / THIN 20) se odvodí z toho, jestli je podestavba na kraji bloku.

/**
 * @param {object} p
 * @param {number} [p.thicknessMM=SIDE_COVER_THICK_MM]  SIDE_COVER_THICK_MM
 *   nebo SIDE_COVER_THIN_MM, podle toho kde kryt leží (viz computeSideCovers)
 * @param {number} p.heightMM  výška = bodyHeightMM (výška těla podestavby)
 * @param {number} p.fromZMM
 * @param {number} p.toZMM
 * @param {number} [p.xMM=0]  MENŠÍ x kraj krytu — kryt zabírá x od xMM do
 *   xMM+thicknessMM. Umožňuje umístit kryt přímo, bez dodatečného posunu
 *   group.position.x volajícím.
 * @param {number} [p.plinthHeightMM]  výška soklové zóny (plinth.heightMM) —
 *   kryt sedí NAD ní, stejně jako podestavba (nahrazuje dřívější pevnou
 *   LEG_HEIGHT_MM).
 * @returns {THREE.Group}
 */
export function buildSideCover({
  thicknessMM = SIDE_COVER_THICK_MM, heightMM, fromZMM, toZMM, xMM = 0,
  plinthHeightMM = PLINTH_HEIGHT_DEFAULT_MM,
}) {
  const group = new THREE.Group();
  group.name = 'bocni-kryt';

  const stainless = createStainlessMaterial();
  const depthMM = toZMM - fromZMM;
  const cover = box(mm(thicknessMM), mm(heightMM), mm(depthMM), stainless);
  cover.position.set(
    mm(xMM + thicknessMM / 2),
    mm(plinthHeightMM + heightMM / 2),
    mm(fromZMM + depthMM / 2)
  );
  // Pozn.: vnitřní mesh se NEPOJMENOVÁVÁ stejně jako group ('bocni-kryt') —
  // measure() v mono-prototype.js hledá podle `name` a stejné jméno na
  // group i na jejím jediném potomkovi by dalo duplicitní nález.
  cover.name = 'bocni-kryt-deska';
  group.add(cover);

  group.userData.thicknessMM = thicknessMM;
  group.userData.heightMM = heightMM;
  group.userData.xMM = xMM;
  return group;
}

// ============================================================================
// SOKL NA ÚROVNI BLOKU — rám (construction) / zástěna (legs_plinth)
// ============================================================================
// Nožičky se staví PER SKŘÍŇKA (buildPodestavba výš). Nerezový rám
// (`construction`) a soklová zástěna kryjící nožičky (`legs_plinth`) jsou
// ale VLASTNOSTÍ CELÉHO BLOKU (ZADANI-SOKL.md, 31. 8. 2026) — NE ale po
// celém půdorysném obvodu bloku (to byla VADA, nahlášená 1. 9. 2026: sokl
// běžel i tam, kde žádná skříňka není). Oprava: sokl se staví JEN pod
// SOUVISLÝMI ÚSEKY skříněk jedné řady — sousedící skříňky (tolerance
// SIDE_ADJACENCY_TOL_MM, stejná konstanta jako u bočních krytů výš) tvoří
// jeden úsek se společným soklem, mezera úsek rozdělí. U ostrova se tím
// sokl NEKRESLÍ pod mezerou mezi zády obou řad (na rozdíl od dřívějšího
// stavu) — každá řada má svůj vlastní sokl, viz volání v buildMonoBlock.
const PLINTH_WALL_THICKNESS_MM = 20; // v zadání není dané číslo tloušťky
// plechu — 20 mm konzistentně s ostatními plechovými díly (WALL_MM výš).

/**
 * @param {object} p
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number}>} p.cabinets
 *   skříňky JEDNÉ ŘADY (podestavby), pro které se sokl staví — funkce si z
 *   nich sama odvodí souvislé úseky (viz komentář sekce výš). Souřadnice
 *   stejné jako u podestavby/buildPodestavba: `xMM` je levý kraj skříňky po
 *   délce bloku, z-rozsah skříňky je DESK_OVERHANG_FRONT_MM až
 *   DESK_OVERHANG_FRONT_MM + depthMM (líc podestavby, viz hlavička souboru).
 *   Chybějící `depthMM` u skříňky spadne na PODESTAVBA_DEPTH_MM.
 * @param {number} p.heightMM  výška soklové zóny (plinth.heightMM)
 * @param {string} p.plinthType  jedna ze 4 hodnot PLINTH_TYPES (modules.js)
 * @param {boolean} [p.hasBack=true]  false u varianty `single` PRO
 *   `legs_plinth` (zadní strana u zdi se nekryje) — `construction` má VŽDY
 *   všechny 4 strany bez ohledu na variantu (viz volání v buildMonoBlock).
 *   Aplikuje se STEJNĚ na KAŽDÝ úsek zvlášť (jedna řada může mít víc úseků).
 * @returns {THREE.Group|null}  JEDNA skupina se všemi úseky dané řady, nebo
 *   null pro `building`/`legs`, nebo když `cabinets` je prázdné (řada bez
 *   jediné skříňky — nic se nekreslí, viz zadání).
 */
export function buildBlockPlinth({ cabinets, heightMM, plinthType, hasBack = true }) {
  if (plinthType !== 'construction' && plinthType !== 'legs_plinth') return null;
  if (!cabinets || cabinets.length === 0) return null; // řada bez skříňky — nic k podepření

  const mat = createPlinthMaterial();
  const heightM = mm(heightMM);
  const t = PLINTH_WALL_THICKNESS_MM;

  // --- souvislé úseky: sousedící skříňky (tolerance SIDE_ADJACENCY_TOL_MM,
  // ne přesná rovnost floatů) se spojí do jednoho úseku, mezera (gap, resp.
  // libovolná díra mezi xMM/xMM+widthMM sousedů) úsek rozdělí. Hloubka úseku
  // je MAX z depthMM skříněk, které do něj patří (jinak PODESTAVBA_DEPTH_MM)
  // — sokl tak podepře i tu nejhlubší skříňku úseku.
  const sorted = [...cabinets].sort((a, b) => a.xMM - b.xMM);
  const runs = [];
  sorted.forEach((c) => {
    const cDepthMM = c.depthMM || PODESTAVBA_DEPTH_MM;
    const last = runs[runs.length - 1];
    if (last && Math.abs(c.xMM - last.endXMM) <= SIDE_ADJACENCY_TOL_MM) {
      last.endXMM = Math.max(last.endXMM, c.xMM + c.widthMM);
      last.depthMM = Math.max(last.depthMM, cDepthMM);
    } else {
      runs.push({ startXMM: c.xMM, endXMM: c.xMM + c.widthMM, depthMM: cDepthMM });
    }
  });

  const group = new THREE.Group();
  group.name = plinthType === 'construction' ? 'sokl-ram' : 'sokl-zastena';

  runs.forEach((run) => {
    // uskočení PLINTH_INSET_MM ze všech stran, měřené od LÍCŮ SKŘÍNĚK
    // tohoto úseku (ne od obrysu bloku) — v ose Z jsou líce skříňky
    // DESK_OVERHANG_FRONT_MM (přední) a DESK_OVERHANG_FRONT_MM + depthMM
    // (zadní), viz JSDoc výš.
    const xMin = run.startXMM + PLINTH_INSET_MM;
    const xMax = run.endXMM - PLINTH_INSET_MM;
    const zMin = DESK_OVERHANG_FRONT_MM + PLINTH_INSET_MM;
    const zMax = DESK_OVERHANG_FRONT_MM + run.depthMM - PLINTH_INSET_MM;
    const innerLengthMM = Math.max(xMax - xMin, 1);
    const innerDepthMM = Math.max(zMax - zMin, 1);

    const front = box(mm(innerLengthMM), heightM, mm(t), mat);
    front.position.set(mm(xMin + innerLengthMM / 2), heightM / 2, mm(zMin + t / 2));
    front.name = 'sokl-predni';
    group.add(front);

    if (hasBack) {
      const back = box(mm(innerLengthMM), heightM, mm(t), mat);
      back.position.set(mm(xMin + innerLengthMM / 2), heightM / 2, mm(zMax - t / 2));
      back.name = 'sokl-zadni';
      group.add(back);
    }

    // boční stěny přes CELOU hloubku úseku (zMin..zMax), aby v rozích
    // nevznikla mezera
    [xMin, xMax - t].forEach((xWall, i) => {
      const side = box(mm(t), heightM, mm(innerDepthMM), mat);
      side.position.set(mm(xWall + t / 2), heightM / 2, mm(zMin + innerDepthMM / 2));
      side.name = i === 0 ? 'sokl-levy' : 'sokl-pravy';
      group.add(side);
    });
  });

  return group;
}

const SIDE_ADJACENCY_TOL_MM = 0.5; // tolerance sousednosti — ne přesná rovnost floatů

/**
 * Najde hloubku (depthMM) úseku herdbloku, který X-ově leží NAD danou
 * souřadnicí `xMM` (úseky herdbloku se v X nepřekrývají, takže odpovídá
 * nejvýš jeden). Nenajde-li se žádný, nebo dotyčný úsek depthMM nemá,
 * spadne na HERDBLOK_DEPTH_DEFAULT_MM — boční kryt tak nikdy nezůstane bez
 * hloubky (viz zadání, oprava hloubky bočních krytů).
 *
 * @param {number} xMM
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number}>} herdblok
 * @returns {number}
 */
function herdblokDepthAtX(xMM, herdblok) {
  const usek = herdblok.find((u) => xMM >= u.xMM && xMM <= u.xMM + u.widthMM);
  return (usek && usek.depthMM) || HERDBLOK_DEPTH_DEFAULT_MM;
}

/**
 * Odvodí boční kryty z řady podestaveb — NENÍ to volba volajícího (viz
 * zadání, bod 5): každá strana podestavby, na kterou zboku přímo nenavazuje
 * jiná podestavba (tolerance SIDE_ADJACENCY_TOL_MM mm, ne přesná rovnost
 * floatů), musí dostat boční kryt.
 *
 * Tloušťka SIDE_COVER_THICK_MM (50) se použije JEN na straně, která leží
 * přesně na "kraji" bloku — levá strana NEJLEVĚJŠÍ podestavby na
 * sideInsetMM(leftEndType), pravá strana NEJPRAVĚJŠÍ podestavby na
 * (pravý konec bloku) − sideInsetMM(rightEndType) — tedy tam, kde před
 * podestavbou není žádný volný prostor. Typ konce (a tím poloha "kraje") se
 * bere z KRAJNÍCH prvků pole `herdblok` (nejlevější xMM / nejpravější konec
 * xMM+widthMM); když je `herdblok` prázdné, kraj se nedá určit a i krajní
 * strany dostanou tenký kryt.
 *
 * VÝJIMKA (zadání, boční kryt 20 mm u zkoseného konce): samotné "na kraji"
 * (atEdge) už nestačí — je-li typ konce na daném konci
 * END_TYPES.VERTICAL_PLATE_CHAMFER (zkosený vodopád) A podestavba na tom
 * konci sedí přesně na kraji, použije se tenký kryt SIDE_COVER_THIN_MM (20)
 * místo SIDE_COVER_THICK_MM (50). Vyhodnocuje se pro každý konec zvlášť
 * (leftEndType/rightEndType), blok tak může mít na jednom konci 50 a na
 * druhém 20.
 *
 * Všechny ostatní odkryté strany (obě strany mostu/mezery mezi
 * podestavbami, nebo krajní strana odsazená volným prostorem — převis)
 * dostanou SIDE_COVER_THIN_MM (20). Kryt leží VEDLE podestavby ve volném
 * prostoru, ne uvnitř ní.
 *
 * Hloubka (zadní hrana) každého krytu se odvozuje z depthMM úseku herdbloku,
 * který leží nad danou podestavbou (viz herdblokDepthAtX výše) — hloubka
 * herdbloku je volná, ne natvrdo HERDBLOK_DEPTH_DEFAULT_MM.
 *
 * `atEdge` v návratu (ÚKOL 6, ostrov): true, když je daný kryt na SAMÉM
 * X-konci bloku (levý kraj nejlevější podestavby / pravý kraj nejpravější).
 * buildMonoBlock() u varianty `island` tyhle kryty VYNECHÁVÁ (nahradí je
 * JEDNÍM krytem přes celou kombinovanou hloubku, "od čela k čelu" — viz
 * zadání úkolu 6) — u `single` se `atEdge` jen ignoruje, žádná změna chování.
 *
 * @param {Array<{xMM:number, widthMM:number}>} podestavby
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number, leftEndType?:string, rightEndType?:string}>} herdblok
 * @returns {Array<{xMM:number, thicknessMM:number, depthMM:number, atEdge:boolean}>} xMM = menší x kraj krytu
 */
function computeSideCovers(podestavby, herdblok) {
  if (podestavby.length === 0) return [];
  const sorted = [...podestavby].sort((a, b) => a.xMM - b.xMM);

  // Kraj bloku (poloha, typ konce) bereme z krajních úseků herdbloku —
  // nejlevější xMM určuje levý typ/hranici, nejpravější konec pravý.
  let leftEdgeX = null;
  let rightEdgeX = null;
  let leftEndType = END_TYPES.VERTICAL_PLATE;
  let rightEndType = END_TYPES.VERTICAL_PLATE;
  if (herdblok.length > 0) {
    const leftUsek = herdblok.reduce((a, b) => (b.xMM < a.xMM ? b : a));
    const rightUsek = herdblok.reduce((a, b) => (b.xMM + b.widthMM > a.xMM + a.widthMM ? b : a));
    leftEndType = leftUsek.leftEndType || END_TYPES.VERTICAL_PLATE;
    rightEndType = rightUsek.rightEndType || END_TYPES.VERTICAL_PLATE;
    leftEdgeX = leftUsek.xMM + sideInsetMM(leftEndType);
    rightEdgeX = rightUsek.xMM + rightUsek.widthMM - sideInsetMM(rightEndType);
  }

  const covers = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const hasLeftNeighbor = !!prev && Math.abs((prev.xMM + prev.widthMM) - p.xMM) <= SIDE_ADJACENCY_TOL_MM;
    const hasRightNeighbor = !!next && Math.abs((p.xMM + p.widthMM) - next.xMM) <= SIDE_ADJACENCY_TOL_MM;

    if (!hasLeftNeighbor) {
      const atEdge = i === 0 && leftEdgeX !== null && Math.abs(p.xMM - leftEdgeX) <= SIDE_ADJACENCY_TOL_MM;
      // VÝJIMKA: zkosený vodopád (VERTICAL_PLATE_CHAMFER) s podestavbou na
      // kraji dostává tenký kryt, ne silný — atEdge samo o sobě nestačí.
      const thicknessMM = atEdge && leftEndType !== END_TYPES.VERTICAL_PLATE_CHAMFER
        ? SIDE_COVER_THICK_MM : SIDE_COVER_THIN_MM;
      covers.push({ xMM: p.xMM - thicknessMM, thicknessMM, depthMM: herdblokDepthAtX(p.xMM, herdblok), atEdge });
    }
    if (!hasRightNeighbor) {
      const atEdge = i === sorted.length - 1 && rightEdgeX !== null
        && Math.abs((p.xMM + p.widthMM) - rightEdgeX) <= SIDE_ADJACENCY_TOL_MM;
      // VÝJIMKA — stejné pravidlo jako výš, pro pravý konec.
      const thicknessMM = atEdge && rightEndType !== END_TYPES.VERTICAL_PLATE_CHAMFER
        ? SIDE_COVER_THICK_MM : SIDE_COVER_THIN_MM;
      covers.push({ xMM: p.xMM + p.widthMM, thicknessMM, depthMM: herdblokDepthAtX(p.xMM, herdblok), atEdge });
    }
  });

  return covers;
}

// ============================================================================
// PODEPŘENÍ — kontrola PŘEVISU a MOSTU, patří ke geometrii
// ============================================================================

/**
 * Spočítá podepření JEDNOHO úseku herdbloku danou sadou podestaveb. Vrací
 * převis na obou koncích a mosty ve všech mezerách MEZI podestavbami, které
 * leží pod herdblokem — každé pravidlo se hlásí SAMOSTATNĚ.
 *
 * PŘEVIS se měří od konce OVLÁDACÍHO PANELU (xMM + sideInsetMM(leftEndType) a
 * xMM + widthMM − sideInsetMM(rightEndType)), NE od konce herdbloku —
 * zatažení je konstrukční a je tam vždycky (hodnota podle TYPU KONCE, viz
 * zadání bod 2), takže plně obsazený blok musí hlásit převis 0, ne zatažení
 * samotné. Chybějící leftEndType/rightEndType spadne na
 * END_TYPES.VERTICAL_PLATE. MOST se počítá stejně jako dřív (nepodepřená
 * světlost MEZI podestavbami).
 *
 * @param {Array<{xMM:number, widthMM:number}>} podestavby
 * @param {{xMM:number, widthMM:number, leftEndType?:string, rightEndType?:string}} herdblokUsek
 * @returns {{
 *   leftOverhangMM:number, leftOverhangOK:boolean,
 *   rightOverhangMM:number, rightOverhangOK:boolean,
 *   bridges: Array<{startMM:number, endMM:number, gapMM:number, ok:boolean}>,
 *   ok: boolean
 * }}
 */
export function checkSupport(podestavby, herdblokUsek) {
  const {
    xMM,
    widthMM,
    leftEndType = END_TYPES.VERTICAL_PLATE,
    rightEndType = END_TYPES.VERTICAL_PLATE,
  } = herdblokUsek;
  const hStart = xMM + sideInsetMM(leftEndType);
  const hEnd = xMM + widthMM - sideInsetMM(rightEndType);

  // podestavby, které se s panelem alespoň dotýkají, seřazené a OŘÍZNUTÉ na
  // rozsah PANELU (ne herdbloku) — co přečnívá mimo, se pro podepření neřeší
  const supports = podestavby
    .map((p) => ({ startMM: Math.max(p.xMM, hStart), endMM: Math.min(p.xMM + p.widthMM, hEnd) }))
    .filter((p) => p.endMM > p.startMM)
    .sort((a, b) => a.startMM - b.startMM);

  if (supports.length === 0) {
    // není čím podepřít — celá délka panelu je "převis" na obou koncích i "most"
    const gapMM = hEnd - hStart;
    return {
      leftOverhangMM: gapMM, leftOverhangOK: gapMM <= OVERHANG_LIMIT_MM,
      rightOverhangMM: gapMM, rightOverhangOK: gapMM <= OVERHANG_LIMIT_MM,
      bridges: [], ok: gapMM <= OVERHANG_LIMIT_MM,
    };
  }

  const leftOverhangMM = Math.max(0, supports[0].startMM - hStart);
  const rightOverhangMM = Math.max(0, hEnd - supports[supports.length - 1].endMM);

  const bridges = [];
  for (let i = 1; i < supports.length; i++) {
    const gapMM = supports[i].startMM - supports[i - 1].endMM;
    if (gapMM > 0) {
      bridges.push({
        startMM: supports[i - 1].endMM,
        endMM: supports[i].startMM,
        gapMM,
        ok: gapMM <= BRIDGE_LIMIT_MM,
      });
    }
  }

  const leftOverhangOK = leftOverhangMM <= OVERHANG_LIMIT_MM;
  const rightOverhangOK = rightOverhangMM <= OVERHANG_LIMIT_MM;
  const ok = leftOverhangOK && rightOverhangOK && bridges.every((b) => b.ok);

  return { leftOverhangMM, leftOverhangOK, rightOverhangMM, rightOverhangOK, bridges, ok };
}

// ============================================================================
// SESTAVENÍ CELÉHO BLOKU
// ============================================================================

/**
 * Sestaví THREE.Group reprezentující celý blok ALBA MONO. U `variant:'single'`
 * (výchozí, BEZE ZMĚNY oproti dřívějšímu chování) ze DVOU nezávislých vrstev
 * strany A: `podestavbyA` a `herdblokA` (pole úseků — typicky jeden úsek, ale
 * API to nevyžaduje). Boční kryty jsou TŘETÍ, ODVOZENOU vrstvou —
 * computeSideCovers() je vygeneruje sama z řady podestaveb (viz zadání,
 * bod 5); volající je nezadává.
 *
 * U `variant:'island'` (ÚKOL 6, PREDANI.md) přibývá STEJNÁ trojice vrstev
 * pro stranu B (`podestavbyB`/`herdblokB`/`panelItemsB`) — strana B se
 * staví v LOKÁLNÍCH (nezrcadlených) souřadnicích STEJNĚ jako strana A, a
 * celá její podskupina se pak otočí `rotation.y = Math.PI` (ŽÁDNÉ záporné
 * měřítko — viz zákaz v zadání) a posune tak, aby vyšla na druhém konci
 * kombinované hloubky, čelem ven. Odvození pozice (position.x = lengthMM,
 * position.z = totalDepthMM): rotace o 180° kolem Y mapuje lokální (x,y,z)
 * na world (position.x − x, y, position.z − z); dosazením lokálního z=0
 * (čelo strany B) chceme world z = totalDepthMM a lokálního z=depthBMM
 * (záda strany B, spára) world z = depthAMM (což sedí, depthAMM+depthBMM
 * = totalDepthMM) — a dosazením libovolného lokálního (xMM, xMM+widthMM)
 * chceme world rozsah roven mirrorX(xMM,lengthMM,widthMM)..+widthMM (STEJNÝ
 * world X jako stejné xMM na straně A — sdílená osa X mezi A/B, odvozeno z
 * pravidla o ramenech, viz zadání §8) — což dá position.x = lengthMM.
 * Díky tomu se na stranu B NEAPLIKUJE mirrorX (na rozdíl od strany A) — dvojí
 * zrcadlení (mirrorX + rotace) by se vyrušilo špatným směrem.
 *
 * Kombinovaná deska/nosy/límec/boční kryty na X-koncích (§6/§9 zadání) se u
 * `island` staví JEDNOU navíc, přímo v hlavní (nerotované) skupině — ne
 * uvnitř strany A ani strany B.
 *
 * @param {object} params
 * @param {number} [params.workHeightMM=900]  pracovní výška, 850–900
 * @param {'single'|'island'} [params.variant='single']
 * @param {number} [params.depthAMM]  hloubka strany A — u `island` se z ní
 *   (spolu s depthBMM) počítá totalDepthMM pro kombinovanou desku/nosy/límec.
 * @param {number} [params.depthBMM]  hloubka strany B — jen `island`.
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number, finish?:string,
 *   kind?:string, bodyStyle?:string, hasShelf?:boolean}>} params.podestavbyA
 *   `finish`/`kind`/`bodyStyle`/`hasShelf` (§2 ZADANI-PODESTAVBY-MONO.md) jsou
 *   vlastnost KAŽDÉ SKŘÍŇKY ZVLÁŠŤ (viz buildPodestavba) — jedna řada může
 *   mít skříňky s různým druhem/stylem/úpravou vedle sebe.
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number, leftEndType?:string,
 *   rightEndType?:string, collar?:Array}>} params.herdblokA  úseky herdbloku strany A
 * @param {Array<{kind:string, xMM:number, heightMM:number}>} [params.panelItemsA]
 *   prvky ovládacího panelu strany A (zásuvky apod.), ABSOLUTNÍ xMM po délce
 *   CELÉHO bloku — každý se osadí do úseku herdbloku, do jehož rozsahu xMM
 *   spadá (viz smyčka níž); šířku panelu daného úseku hlídá až buildHerdblokUsek.
 * @param {Array<object>} [params.podestavbyB]  jen `island`, stejný tvar jako podestavbyA,
 *   v LOKÁLNÍCH (nezrcadlených) souřadnicích strany B.
 * @param {Array<object>} [params.herdblokB]  jen `island`, stejný tvar jako herdblokA,
 *   leftEndType/rightEndType SDÍLENÉ a NEPROHOZENÉ (na rozdíl od herdblokA) —
 *   rotace fyzicky otočí tvar, žádná záměna typů není potřeba.
 * @param {Array<object>} [params.panelItemsB]  jen `island`, stejný tvar jako panelItemsA,
 *   v LOKÁLNÍCH (nezrcadlených) souřadnicích strany B.
 * @param {Array<{edge:'left'|'right', heightMM:number}>} [params.collar]  jen `island` —
 *   límec nad KOMBINOVANÝM obrysem desky (§9); u `single` se limec bere
 *   z herdblokA[].collar (beze změny). `back` se tady i tak defenzivně
 *   ignoruje (ostrov nemá záda, viz zadání) bez ohledu na to, co pole obsahuje.
 * @param {Array<object>} [params.podestavby]  ZPĚTNÁ KOMPATIBILITA se
 *   starším podpisem (dřívější `podestavby`, dnes `podestavbyA`) — použije
 *   se, jen když `podestavbyA` chybí. Stejně `herdblok`→`herdblokA`,
 *   `panelItems`→`panelItemsA`. Drží v provozu mono-prototype.js, dokud
 *   nedostane vlastní aktualizaci volání (mimo rozsah tohoto souboru).
 * @param {{type:string, heightMM:number}} [params.plinth]  sokl JE VLASTNOST
 *   CELÉHO BLOKU (ZADANI-SOKL.md, 31. 8. 2026), ne skříňky — nahrazuje
 *   dřívější pevnou LEG_HEIGHT_MM (150). Výchozí
 *   `{type:'construction', heightMM:150}` zachovává dosavadní chování
 *   (kontrolní čísla PREDANI ČÁST F bod 1), když volající parametr nedodá —
 *   `state.plinth` protáhne až adaptér mono-block.js (fáze 2, mimo rozsah
 *   tohoto souboru).
 * @returns {{group:THREE.Group, support: Array, bodyHeightMM:number, workHeightMM:number}}
 */
export function buildMonoBlock({
  workHeightMM = WORK_HEIGHT_DEFAULT_MM,
  variant = 'single',
  depthAMM,
  depthBMM,
  podestavbyA,
  herdblokA,
  panelItemsA,
  podestavbyB = [],
  herdblokB = [],
  panelItemsB = [],
  collar = [],
  plinth = { type: DEFAULT_PLINTH_TYPE, heightMM: PLINTH_HEIGHT_DEFAULT_MM },
  // zpětná kompatibilita — viz JSDoc výš
  podestavby: legacyPodestavby,
  herdblok: legacyHerdblok,
  panelItems: legacyPanelItems,
}) {
  const isIsland = variant === 'island';
  const podA = podestavbyA !== undefined ? podestavbyA : (legacyPodestavby || []);
  const herA = herdblokA !== undefined ? herdblokA : (legacyHerdblok || []);
  const panA = panelItemsA !== undefined ? panelItemsA : (legacyPanelItems || []);

  const plinthType = plinth && plinth.type ? plinth.type : DEFAULT_PLINTH_TYPE;
  const plinthHeightMM = clamp(
    Number(plinth && plinth.heightMM) || PLINTH_HEIGHT_DEFAULT_MM,
    PLINTH_HEIGHT_MIN_MM,
    PLINTH_HEIGHT_MAX_MM
  );
  // `construction` má zadní stěnu VŽDY (i u `single`); `legs_plinth` ji u
  // `single` vynechává (strana u zdi), u `island` má taky všechny čtyři.
  // Spočteno tady (dřív až u volání buildBlockPlinth níž), protože se teď
  // používá i pro sokl strany B uvnitř `if (isIsland)` blíž ke straně A.
  const plinthHasBack = plinthType === 'construction' ? true : isIsland;

  const workHeight = clamp(workHeightMM, WORK_HEIGHT_MIN_MM, WORK_HEIGHT_MAX_MM);
  // Tělo podestavby je od ZADANI-SOKL.md PEVNÉ — HARDCODED přes BODY_STACK_MM,
  // NE dopočtem z workHeight/plinthHeightMM, aby zůstalo neměnné i kdyby
  // volající (main.js) dodal workHeightMM nekonzistentní se soklem. Nižší
  // sokl ⇒ celý blok klesne (workHeight = HERDBLOK_HEIGHT_MM + bodyHeightMM
  // + plinthHeightMM), tělo skříňky se nezvětšuje.
  const bodyHeightMM = BODY_STACK_MM - HERDBLOK_HEIGHT_MM; // 750 − 290 = 460

  // --- půdorysný obrys CELÉHO BLOKU (délka × hloubka) — potřeba i pro
  // `single` od ZADANI-SOKL.md (sokl na úrovni bloku, buildBlockPlinth níž);
  // dřív se počítalo jen pro `island` (kombinovaná deska/nosy/límec).
  // lengthMM: buildMonoScene VŽDY staví herdblokA/herdblokB jako JEDEN úsek
  // přes celou délku bloku (existující konvence, i pro `single`) — widthMM
  // toho úseku je tedy lengthMM. Robustně bereme z A, jinak z B.
  const lengthMM = (herA[0] && herA[0].widthMM) || (herdblokB[0] && herdblokB[0].widthMM) || 0;
  const totalDepthMM = isIsland
    ? (Number(depthAMM) || (herA[0] && herA[0].depthMM) || 0)
      + (Number(depthBMM) || (herdblokB[0] && herdblokB[0].depthMM) || 0)
    : (Number(depthAMM) || (herA[0] && herA[0].depthMM) || HERDBLOK_DEPTH_DEFAULT_MM);

  const group = new THREE.Group();
  group.name = 'alba-mono-blok';

  // ============================================================================
  // STRANA A — beze změny oproti dřívějšímu chování (single i island)
  // ============================================================================
  const podestavbyGroup = new THREE.Group();
  podestavbyGroup.name = 'podestavby';
  podA.forEach((p) => {
    // kind/bodyStyle/hasShelf (§2 ZADANI-PODESTAVBY-MONO.md) — PROTAŽENÉ z
    // položky beze změny, stejně jako finish; buildPodestavba() si sama
    // ošetří chybějící/neznámou hodnotu (výchozí parametrů funkce).
    const mesh = buildPodestavba({
      widthMM: p.widthMM, depthMM: p.depthMM, bodyHeightMM, finish: p.finish, plinthType, plinthHeightMM,
      kind: p.kind, bodyStyle: p.bodyStyle, hasShelf: p.hasShelf,
    });
    mesh.position.x = mm(p.xMM);
    podestavbyGroup.add(mesh);
  });
  group.add(podestavbyGroup);

  const herdblokGroup = new THREE.Group();
  herdblokGroup.name = 'herdblok';
  herdblokGroup.position.y = mm(workHeight - HERDBLOK_HEIGHT_MM); // sedí na podestavbách
  herA.forEach((u) => {
    // panelItems mají ABSOLUTNÍ xMM po délce CELÉHO bloku (viz JSDoc výš) —
    // tady se jen rozdělí do úseku, do jehož rozsahu spadají, a xMM se
    // převede na LOKÁLNÍ souřadnici úseku (stejná konvence jako u xMM/
    // widthMM samotného úseku). Kontrolu vůči ŠÍŘCE PANELU (užší než úsek)
    // dělá až buildHerdblokUsek — ten zná leftInsetMM/rightInsetMM.
    const usekPanelItems = panA
      .filter((it) => it.xMM >= u.xMM && it.xMM <= u.xMM + u.widthMM)
      .map((it) => ({ ...it, xMM: it.xMM - u.xMM }));
    const mesh = buildHerdblokUsek({
      ...u,
      panelItems: usekPanelItems,
      // ÚKOL 6 (ostrov): deska i nos strany A se u `island` staví JEDNOU,
      // kombinovaně, níž — ne tady. U `single` beze změny (true/true).
      includeDesk: !isIsland,
      includeNose: !isIsland,
      chamferAllCorners: isIsland,
    });
    mesh.position.x = mm(u.xMM);
    herdblokGroup.add(mesh);
  });
  group.add(herdblokGroup);

  // --- boční kryty strany A: odvozené z řady podestaveb, NENÍ to volba
  // volajícího (viz zadání, bod 5). U `island` se kryty NA SAMÉM X-KONCI
  // BLOKU (atEdge) vynechávají — nahrazuje je JEDEN kombinovaný kryt přes
  // celou hloubku, "od čela k čelu" (viz níž, §6 krok 4 zadání úkolu 6).
  const sideCoversGroup = new THREE.Group();
  sideCoversGroup.name = 'bocni-kryty';
  computeSideCovers(podA, herA).forEach(({ xMM, thicknessMM, depthMM, atEdge }) => {
    if (isIsland && atEdge) return;
    const cover = buildSideCover({
      thicknessMM,
      heightMM: bodyHeightMM,
      fromZMM: DESK_OVERHANG_FRONT_MM,
      toZMM: depthMM,
      xMM,
      plinthHeightMM,
    });
    sideCoversGroup.add(cover);
  });
  group.add(sideCoversGroup);

  // ============================================================================
  // STRANA B + KOMBINOVANÉ DÍLY — jen `island` (ÚKOL 6, PREDANI.md)
  // ============================================================================
  // lengthMM/totalDepthMM se počítají výš (potřeba i pro `single`, viz JSDoc).
  if (isIsland) {
    // --- STRANA B: LOKÁLNÍ (nezrcadlené) souřadnice, celá podskupina se
    // otočí 180° kolem Y — viz JSDoc výš pro odvození position.x/position.z.
    const sideBGroup = new THREE.Group();
    sideBGroup.name = 'strana-b';
    sideBGroup.rotation.y = Math.PI;
    sideBGroup.position.set(mm(lengthMM), 0, mm(totalDepthMM));

    const podestavbyBGroup = new THREE.Group();
    podestavbyBGroup.name = 'podestavby';
    podestavbyB.forEach((p) => {
      // kind/bodyStyle/hasShelf — stejné protažení jako u strany A výš.
      const mesh = buildPodestavba({
        widthMM: p.widthMM, depthMM: p.depthMM, bodyHeightMM, finish: p.finish, plinthType, plinthHeightMM,
        kind: p.kind, bodyStyle: p.bodyStyle, hasShelf: p.hasShelf,
      });
      mesh.position.x = mm(p.xMM);
      podestavbyBGroup.add(mesh);
    });
    sideBGroup.add(podestavbyBGroup);

    const herdblokBGroup = new THREE.Group();
    herdblokBGroup.name = 'herdblok';
    herdblokBGroup.position.y = mm(workHeight - HERDBLOK_HEIGHT_MM);
    herdblokB.forEach((u) => {
      const usekPanelItems = panelItemsB
        .filter((it) => it.xMM >= u.xMM && it.xMM <= u.xMM + u.widthMM)
        .map((it) => ({ ...it, xMM: it.xMM - u.xMM }));
      const mesh = buildHerdblokUsek({
        ...u,
        panelItems: usekPanelItems,
        includeDesk: false, // kombinovaná deska se staví níž, jednou
        includeNose: false, // kombinovaný nos se staví níž, jednou
        chamferAllCorners: true,
      });
      mesh.position.x = mm(u.xMM);
      herdblokBGroup.add(mesh);
    });
    sideBGroup.add(herdblokBGroup);

    const sideCoversBGroup = new THREE.Group();
    sideCoversBGroup.name = 'bocni-kryty';
    computeSideCovers(podestavbyB, herdblokB).forEach(({ xMM, thicknessMM, depthMM, atEdge }) => {
      if (atEdge) return; // nahrazeno kombinovaným krytem na X-konci, viz níž
      const cover = buildSideCover({
        thicknessMM,
        heightMM: bodyHeightMM,
        fromZMM: DESK_OVERHANG_FRONT_MM,
        toZMM: depthMM,
        xMM,
        plinthHeightMM,
      });
      sideCoversBGroup.add(cover);
    });
    sideBGroup.add(sideCoversBGroup);

    // --- SOKL STRANY B — vlastní, ze svého pole podestaveb (podestavbyB),
    // postavený UVNITŘ TÉHLE (otočené) podskupiny — NE v hlavní skupině —
    // aby se zrcadlil/otočil SPOLU se stranou B (stejný důvod jako u
    // podestavbyBGroup/herdblokBGroup výš). Řady A a B mají nezávislé
    // skříňky, takže se sokly nespojují — souvislost mezi poslední skříňkou
    // A a první skříňkou B (přes spáru obou řad) se tu neřeší, každá řada má
    // svůj sokl samostatně.
    const blockPlinthB = buildBlockPlinth({
      cabinets: podestavbyB, heightMM: plinthHeightMM, plinthType, hasBack: plinthHasBack,
    });
    if (blockPlinthB) sideBGroup.add(blockPlinthB);

    group.add(sideBGroup);

    // --- KOMBINOVANÉ DÍLY: deska, oba nosy, límec left/right, boční kryty
    // na X-koncích — VŠECHNY přes CELOU kombinovanou hloubku (§6/§9 zadání,
    // "od čela k čelu", ne po stranách zvlášť). Staví se přímo v hlavní
    // (nerotované) skupině — herA[0].leftEndType/rightEndType JSOU už typy
    // PROHOZENÉ pro world x=0/x=lengthMM hranu (stejná konvence, jakou
    // mono-block.js používá pro herdblokA — viz jeho komentář u mirrorX).
    if (herA.length > 0) {
      const deskSpec = herA[0];
      const combinedLeftType = deskSpec.leftEndType;   // world x=0 hrana
      const combinedRightType = deskSpec.rightEndType; // world x=lengthMM hrana

      // OPRAVA (vada: "pracovní deska je moc nízko — začíná na podlaze"):
      // buildHerdblokDesk/buildHerdblokNose/buildCollarEdgeWall (viz jejich
      // definice výš) pracují v LOKÁLNÍM prostoru herdbloku — y=0 je SPODNÍ
      // hrana herdbloku, stejná konvence, jakou má i buildHerdblokUsek. U
      // `single` tenhle prostor zdědí ze svého rodiče, herdblokGroup, který
      // má position.y = workHeight − HERDBLOK_HEIGHT_MM (ř. 1313). Kombinované
      // díly ostrova ale žádného takového rodiče neměly a přidávaly se přímo
      // do kořenové `group` (bez posunu) — proto "seděly na podlaze" místo na
      // pracovní výšce. combinedGroup dostává STEJNÝ posun jako herdblokGroup/
      // herdblokBGroup, aby díly skončily ve stejném světovém Y.
      //
      // Boční kryty na X-koncích (coverLeft/coverRight, níž) sem NEPATŘÍ —
      // buildSideCover počítá Y ABSOLUTNĚ (plinthHeightMM + heightMM/2, viz
      // jeho definice), takže je už teď správně a další posun by ho rozbil.
      const combinedGroup = new THREE.Group();
      combinedGroup.name = 'kombinovane-dily';
      combinedGroup.position.y = mm(workHeight - HERDBLOK_HEIGHT_MM);
      group.add(combinedGroup);

      const desk = buildHerdblokDesk({
        widthMM: lengthMM,
        depthMM: totalDepthMM,
        leftEndType: combinedLeftType,
        rightEndType: combinedRightType,
        chamferAllCorners: true,
      });
      desk.name = 'deska';
      combinedGroup.add(desk);

      const noseLeft = buildHerdblokNose({
        endType: combinedLeftType, side: 'left', widthMM: lengthMM, depthMM: totalDepthMM, chamferAllCorners: true,
      });
      noseLeft.name = 'vodopad-levy';
      combinedGroup.add(noseLeft);
      const noseRight = buildHerdblokNose({
        endType: combinedRightType, side: 'right', widthMM: lengthMM, depthMM: totalDepthMM, chamferAllCorners: true,
      });
      noseRight.name = 'vodopad-pravy';
      combinedGroup.add(noseRight);

      // --- límec left/right JEDNOU nad kombinovaným obrysem (§9 zadání);
      // `back` se u ostrova NIKDY nestaví — filtr tady je pojistka navíc
      // k tomu, co už (podle smlouvy) dělá mono-block.js#buildCollarSpec.
      collar.forEach(({ edge, heightMM }) => {
        if (edge !== 'left' && edge !== 'right') return;
        const endTypeAtEdge = edge === 'left' ? combinedLeftType : combinedRightType;
        if (endTypeAtEdge !== END_TYPES.VERTICAL_PLATE) return; // stejná podmínka jako u single
        const wall = buildCollarSide({ edge, widthMM: lengthMM, depthMM: totalDepthMM, heightMM });
        if (wall) combinedGroup.add(wall);
      });

      // --- boční kryty na X-koncích, JEDNA deska přes CELOU kombinovanou
      // hloubku (z 0..totalDepthMM, "od čela k čelu") — TLOUŠŤKA (THICK/THIN)
      // se odvozuje ze STEJNÉHO pravidla jako u single (computeSideCovers),
      // jen aplikovaného na SJEDNOCENÍ obou řad podestaveb: je-li kterákoli
      // z nich (A nebo B) na daném konci zapřená přímo o hranu bloku, kryt
      // je THICK (pokud tam zrovna není zkosený konec, pak THIN — stejná
      // výjimka jako u single), jinak THIN.
      const worldPodA = podA.map((p) => ({ xMM: p.xMM, widthMM: p.widthMM }));
      // podestavbyB jsou v LOKÁLNÍCH (nezrcadlených) souřadnicích strany B —
      // pro zjištění, jestli leží na kraji bloku, se přepočtou na WORLD X
      // stejným vzorcem, jaký fakticky dá i rotace (mirrorX(xMM,lengthMM,
      // widthMM) = lengthMM−xMM−widthMM, odvozeno v JSDoc výš) — i když se
      // samotné meshe B staví BEZ mirrorX (o to se postará rotace).
      const worldPodB = podestavbyB.map((p) => ({ xMM: lengthMM - p.xMM - p.widthMM, widthMM: p.widthMM }));
      const allWorldPod = [...worldPodA, ...worldPodB];

      const leftEdgeX = sideInsetMM(combinedLeftType);
      const rightEdgeX = lengthMM - sideInsetMM(combinedRightType);
      const leftFlush = allWorldPod.some((p) => Math.abs(p.xMM - leftEdgeX) <= SIDE_ADJACENCY_TOL_MM);
      const rightFlush = allWorldPod.some((p) => Math.abs((p.xMM + p.widthMM) - rightEdgeX) <= SIDE_ADJACENCY_TOL_MM);
      const leftThickness = leftFlush && combinedLeftType !== END_TYPES.VERTICAL_PLATE_CHAMFER
        ? SIDE_COVER_THICK_MM : SIDE_COVER_THIN_MM;
      const rightThickness = rightFlush && combinedRightType !== END_TYPES.VERTICAL_PLATE_CHAMFER
        ? SIDE_COVER_THICK_MM : SIDE_COVER_THIN_MM;

      if (allWorldPod.length > 0) {
        const coverLeft = buildSideCover({
          thicknessMM: leftThickness, heightMM: bodyHeightMM, fromZMM: 0, toZMM: totalDepthMM, xMM: leftEdgeX - leftThickness, plinthHeightMM,
        });
        coverLeft.name = 'bocni-kryt-x-konec';
        group.add(coverLeft);
        const coverRight = buildSideCover({
          thicknessMM: rightThickness, heightMM: bodyHeightMM, fromZMM: 0, toZMM: totalDepthMM, xMM: rightEdgeX, plinthHeightMM,
        });
        coverRight.name = 'bocni-kryt-x-konec';
        group.add(coverRight);
      }
    }
  }

  // ============================================================================
  // SOKL STRANY A — rám (construction) / zástěna (legs_plinth)
  // ============================================================================
  // Nožičky se staví PER SKŘÍŇKA výš (buildPodestavba). Rám i zástěna jsou
  // vlastností CELÉHO BLOKU (ZADANI-SOKL.md), ale OPRAVA „sokl jen pod
  // skříňkami" (1. 9. 2026) je nekreslí po celém půdorysném obvodu — jen
  // pod souvislými úseky skříněk strany A (viz buildBlockPlinth výš). Sokl
  // strany B (jen `island`) se staví ZVLÁŠŤ, UVNITŘ otočené podskupiny
  // strany B (viz výš) — ne tady, aby se zrcadlil spolu s ní. `construction`
  // má VŠECHNY strany VŽDY (i u `single`); `legs_plinth` u `single`
  // vynechává zadní stranu (u zdi), u `island` má taky všechny čtyři —
  // `plinthHasBack` je spočtené výš, sdílené s soklem strany B.
  const blockPlinthA = buildBlockPlinth({
    cabinets: podA, heightMM: plinthHeightMM, plinthType, hasBack: plinthHasBack,
  });
  if (blockPlinthA) group.add(blockPlinthA);

  const support = [
    ...herA.map((u) => ({ usek: u, side: 'A', ...checkSupport(podA, u) })),
    ...(isIsland ? herdblokB.map((u) => ({ usek: u, side: 'B', ...checkSupport(podestavbyB, u) })) : []),
  ];

  group.userData.workHeightMM = workHeight;
  group.userData.bodyHeightMM = bodyHeightMM;
  group.userData.support = support;

  return { group, support, bodyHeightMM, workHeightMM: workHeight };
}
