// mono-geometry.js — ČISTÁ geometrie produktu ALBA MONO.
// Žádná vazba na DOM ani na stav aplikace: vstupem je prostý objekt s
// parametry v milimetrech, výstupem THREE.Group. Materiály se přebírají
// sdílené z materials.js (stejné jako u produktu SEGMENT), jinak modul nic
// z aplikace nečte ani neimportuje.
//
// PROTOTYP — přístroje, ovládací prvky panelu, sokl/dvířka/police a
// nástavby se neřeší (mimo rozsah úkolu). Cílem je geometrie herdbloku,
// podestaveb, bočního krytu a límce k odsouhlasení. Viz "Co se teď NEDĚLÁ"
// v zadání — na místech, kde chybí dodané číslo, je TODO a nic se nedomýšlí.
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
// Roviny v ose Y (mm od podlahy, při pracovní výšce 900):
//   0   podlaha
//   150 horní hrana nožiček = spodek korpusu podestavby (LEG_HEIGHT_MM)
//   610 horní hrana podestavby = spodek herdbloku
//   650 horní hrana spodní lišty (610 + LISTA_HEIGHT_MM)
//   850 horní hrana ovládacího panelu (610 + PANEL_HEIGHT_MM)
//   900 horní plocha pracovní desky (workHeightMM)
//
// Výška bloku se mění VÝHRADNĚ tělem skříňky podestavby:
//   bodyHeightMM = workHeightMM − HERDBLOK_HEIGHT_MM − LEG_HEIGHT_MM
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
} from './materials.js';

const mm = (v) => v / 1000;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ============================================================================
// KONSTANTY — vše v mm, exportované
// ============================================================================

// --- výšky ----------------------------------------------------------------
export const HERDBLOK_HEIGHT_MM = 290;      // konstrukčně pevné
export const WORK_HEIGHT_MIN_MM = 850;
export const WORK_HEIGHT_MAX_MM = 900;
export const WORK_HEIGHT_DEFAULT_MM = 900;
export const LEG_HEIGHT_MM = 150;           // konstanta, nemění se

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
// Analogicky k END_SIDE_INSET_MM/sideInsetMM: rozměr je DODANÝ (HODNOTY-MONO.md
// §7.5) jen pro END_TYPES.VERTICAL_PLATE — 50 mm rovného čela. Pro
// VERTICAL_PLATE_CHAMFER je čelo 20 mm rovné + 50 mm zkosení pod 45°, což
// není jedno číslo, a mapa proto pro něj hodnotu nemá.
// ZÁKLADNÍ (rovný, nezkosený) tvar vodopádu/nosu už buildHerdblokUsek staví
// (viz 'vodopad-levy'/'vodopad-pravy' níž), ale s tloušťkou
// SIDE_PLATE_THICKNESS_MM (20) — TENHLE rozměr (délku rovného čela v
// půdorysu) zatím nepoužívá žádná funkce. Zůstává evidence pro BUDOUCÍ
// půdorysné zkosení (VERTICAL_PLATE_CHAMFER, hák cornerPoints), kdy vodopád
// přestane být prostý obdélník.
export const NOSE_FRONT_MM = {
  [END_TYPES.VERTICAL_PLATE]: 50,
};

/** Délka rovného čela nosu (mm) pro daný typ zakončení; neznámý typ spadne na svislaDeska. */
export function noseFrontMM(endType) {
  return NOSE_FRONT_MM[endType] ?? NOSE_FRONT_MM[END_TYPES.VERTICAL_PLATE];
}

// --- pracovní deska ----------------------------------------------------------
export const DESK_OVERHANG_FRONT_MM = 30;   // přesah desky přes podestavbu vpředu
export const DESK_OVERHANG_SIDE_MM = 25;    // TODO: vodopád (buildHerdblokUsek,
// 'vodopad-levy'/'vodopad-pravy' níž) už boční tvar staví, ale s tloušťkou
// SIDE_PLATE_THICKNESS_MM (20), ne s touhle hodnotou — tuhle konstantu
// nepoužívá. Nejasné, jestli je DESK_OVERHANG_SIDE_MM stejná věc jako
// tloušťka vodopádu (a je to tedy stará/nahrazená hodnota), nebo jiný rozměr
// (např. přesah desky NAD vodopádem) — nedomýšlím, zůstává jen evidence,
// nahlášeno v přejímce.
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
export const CORPUS_SHEET_MM = 1.5; // síla plechu korpusu — zatím evidence
export const LEG_SIZE_MM = 40;   // konstanta, NE dopočet z šířky
export const LEG_INSET_MM = 50;  // odsazení nožičky od rohu (boční i čelní/zadní líc)

// --- boční kryt a boční deska ---------------------------------------------------
// Dvě tloušťky (viz zadání, bod 5): THICK jen na straně, kde podestavba leží
// přímo na kraji bloku (žádný volný prostor před ní) — jinak vždycky THIN.
// buildMonoBlock() si tloušťku i umístění krytů odvozuje SÁM z řady
// podestaveb (computeSideCovers níže), volající si je nevybírá.
export const SIDE_COVER_THICK_MM = 50;
export const SIDE_COVER_THIN_MM = 20;
export const SIDE_PLATE_THICKNESS_MM = 20; // tloušťka boku / svislé desky (budoucí "nos")

// --- zakončení herdbloku (půdorys) ---------------------------------------------
export const END_STRAIGHT_MM = 20;  // TODO: rovná část zakončení — zatím se nepoužívá,
// viz "Co se teď NEDĚLÁ" (půdorysné zkosení rohu není dodané).
export const END_CHAMFER_MM = 50;   // TODO: zkosená část — zatím se nepoužívá.
export const END_TOTAL_MM = END_STRAIGHT_MM + END_CHAMFER_MM; // 70, odvozeno
export const CHAMFER_ANGLE_DEG = 45; // TODO: zatím se nepoužívá.

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
 * V TÉHLE VERZI jsou OBĚ varianty ostrý 90° roh — půdorysný tvar zkosení
 * (bok/"nos" u svislaDeskaZkos) není dodaný, viz "Co se teď NEDĚLÁ". Funkce
 * si ale drží stejnou signaturu/strukturu jako dřív, aby šla větev pro
 * VERTICAL_PLATE_CHAMFER doplnit beze změny volajících (buildHerdblokOutline).
 *
 * @param {string} type END_TYPES.*
 * @param {number} cornerX,cornerZ  souřadnice rohu (mm)
 * @param {number} dxIn,dzIn  jednotkový směr "dovnitř" (zatím nevyužito, drženo
 *   pro budoucí zkosenou variantu)
 * @param {'fromX'|'fromZ'} from  ze které hrany se do rohu vchází (zatím
 *   nevyužito, drženo pro budoucí zkosenou variantu)
 */
function cornerPoints(type, cornerX, cornerZ, dxIn, dzIn, from) {
  const sharp = { x: cornerX, z: cornerZ };
  if (type === END_TYPES.VERTICAL_PLATE_CHAMFER) {
    // TODO: půdorysné zkosení rohu (bok/"nos") není dodané — viz "Co se teď
    // NEDĚLÁ". Až přijde tvar, doplní se tu větev vracející víc bodů
    // (analogicky k dřívější "zkosené vlně"), beze změny volajících.
    return [sharp];
  }
  // END_TYPES.VERTICAL_PLATE — ostrý 90° roh
  return [sharp];
}

/**
 * Sestaví horní obrys herdbloku jako pole bodů {x, z} v mm, v lokálním
 * prostoru herdbloku (x od 0 do widthMM, z = 0 je líc pracovní desky).
 * `frontZMM` posouvá jen PŘEDNÍ hranu dozadu/dopředu, zadní hrana a rohy
 * zůstávají beze změny.
 *
 * @param {{widthMM:number, depthMM:number, frontZMM?:number, leftEndType:string, rightEndType:string}} p
 * @returns {Array<{x:number, z:number}>} uzavřený mnohoúhelník (poslední bod ≠ první)
 */
export function buildHerdblokOutline({ widthMM, depthMM, frontZMM = 0, leftEndType, rightEndType }) {
  const backZ = depthMM;

  // čtyři rohy, obchůzka ve směru: čelo (0→width) → pravý konec (front→back)
  // → záda (width→0) → levý konec (back→front)
  const frontRight = cornerPoints(rightEndType, widthMM, frontZMM, -1, +1, 'fromX');
  const backRight = cornerPoints(rightEndType, widthMM, backZ, -1, -1, 'fromZ');
  const backLeft = cornerPoints(leftEndType, 0, backZ, +1, -1, 'fromX');
  const frontLeft = cornerPoints(leftEndType, 0, frontZMM, +1, +1, 'fromZ');

  return [...frontLeft, ...frontRight, ...backRight, ...backLeft];
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

/** Stejné jako slabFromOutline, ale samo spočítá obrys z parametrů. */
function buildOutlineSlab(outlineArgs, topYMM, heightMM, material) {
  return slabFromOutline(buildHerdblokOutline(outlineArgs), topYMM, heightMM, material);
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
 */
export function buildHerdblokUsek(usek) {
  const {
    widthMM,
    depthMM = HERDBLOK_DEPTH_DEFAULT_MM,
    leftEndType = END_TYPES.VERTICAL_PLATE,
    rightEndType = END_TYPES.VERTICAL_PLATE,
    collar = [],
    panelItems = [],
  } = usek;

  const group = new THREE.Group();
  group.name = 'herdblok-usek';

  const stainless = createStainlessMaterial();
  const panelMat = createPanelMaterial();

  // --- deska: obrysová deska, y (HERDBLOK_HEIGHT_MM − DESK_FACE_HEIGHT_MM)..HERDBLOK_HEIGHT_MM,
  // z 0..depthMM (plný půdorys), x 0..width. Čelo svislé, BEZ FACETKY —
  // TODO: sražení čela desky u svislaDeskaZkos není dodané, viz "Co se teď NEDĚLÁ".
  const deskOutlineArgs = { widthMM, depthMM, frontZMM: 0, leftEndType, rightEndType };
  const desk = buildOutlineSlab(deskOutlineArgs, HERDBLOK_HEIGHT_MM, DESK_FACE_HEIGHT_MM, stainless);
  desk.name = 'deska';
  group.add(desk);

  // --- korpus herdbloku: kvádr pod deskou, y 0..PANEL_HEIGHT_MM,
  // z (PANEL_SETBACK_MM+PANEL_GAP_MM)..(depthMM-DESK_OVERHANG_BACK_MM), x 0..width.
  const corpusFrontZ = PANEL_SETBACK_MM + PANEL_GAP_MM; // 26
  const corpusBackZ = depthMM - DESK_OVERHANG_BACK_MM;  // 825 při depthMM 850
  const corpusDepthMM = corpusBackZ - corpusFrontZ;
  const corpus = box(mm(widthMM), mm(PANEL_HEIGHT_MM), mm(corpusDepthMM), stainless);
  corpus.position.set(
    mm(widthMM) / 2,
    mm(PANEL_HEIGHT_MM) / 2,
    mm(corpusFrontZ + corpusDepthMM / 2)
  );
  corpus.name = 'korpus';
  group.add(corpus);

  // --- ovládací panel: x sideInsetMM(leftEndType)..(width-sideInsetMM(rightEndType)),
  // y LISTA_HEIGHT_MM..PANEL_HEIGHT_MM, z PANEL_SETBACK_MM..(PANEL_SETBACK_MM+20).
  // Zatažení od boku NENÍ symetrické — levý a pravý konec mohou mít různý typ
  // zakončení, proto se počítá zvlášť pro každou stranu (viz zadání, bod 2).
  // Hloubka panelu (20 mm) nemá vlastní pojmenovanou konstantu v zadání —
  // je to literální rozměr odvozený z rozsahu z 25–45 (bod 4 zadání).
  const PANEL_DEPTH_MM = 20;
  const leftInsetMM = sideInsetMM(leftEndType);
  const rightInsetMM = sideInsetMM(rightEndType);
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
  // sideInsetMM(leftEndType) / sideInsetMM(rightEndType), tam by zůstal
  // vidět holý korpus a schod vůči přesahující desce (deska jde 0..depthMM,
  // korpus jen corpusFrontZ..corpusBackZ, viz výš). Přesně tenhle schod
  // zakrývá VODOPÁD.
  //
  // --- vodopád: svislá boční deska/deska "přetéká" přes bok herdbloku a
  // zakrývá ho CELÝ — přes CELOU výšku herdbloku (HERDBLOK_HEIGHT_MM, tedy
  // od spodní hrany herdbloku po horní rovinu desky) a CELOU hloubku
  // (z 0..depthMM), NE zúžený pruh, NE jen čelo (zadání, vodopád). Tloušťka
  // SIDE_PLATE_THICKNESS_MM (20) na obou koncích.
  //
  // V TÉTO VERZI je bok ROVNÝ (obdélníkový půdorys) na OBOU typech
  // zakončení — půdorysné zkosení pro VERTICAL_PLATE_CHAMFER (viz
  // cornerPoints, NOSE_FRONT_MM/noseFrontMM) přijde v samostatném kroku,
  // proto se tu leftEndType/rightEndType k rozlišení tvaru nepoužívá.
  //
  // TODO: pro widthMM < 2×SIDE_PLATE_THICKNESS_MM by se levý a pravý
  // vodopád překrývaly — tak úzký úsek herdbloku zadání nepředpokládá,
  // neošetřuje se (prototyp, stejně jako panelWidthMM výš).
  [
    { name: 'vodopad-levy', xFromMM: 0 },
    { name: 'vodopad-pravy', xFromMM: widthMM - SIDE_PLATE_THICKNESS_MM },
  ].forEach(({ name, xFromMM }) => {
    const vodopad = box(mm(SIDE_PLATE_THICKNESS_MM), mm(HERDBLOK_HEIGHT_MM), mm(depthMM), stainless);
    vodopad.position.set(
      mm(xFromMM + SIDE_PLATE_THICKNESS_MM / 2),
      mm(HERDBLOK_HEIGHT_MM) / 2,
      mm(depthMM) / 2
    );
    vodopad.name = name;
    group.add(vodopad);
  });

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
// PODESTAVBA — skříňka sestavená z dílců: stěny, podlážka, lišta, nožičky, H2
// ============================================================================
// PROTOTYP: typy soklu, dvířka a police se v tomto prototypu NEŘEŠÍ — mimo
// rozsah úkolu (viz "Co se teď NEDĚLÁ"). Podestavba je na nožičkách v
// konstrukční výšce, aby šlo posoudit most/převis vůči herdbloku.

/**
 * @param {object} p
 * @param {number} p.widthMM
 * @param {number} p.depthMM  výchozí PODESTAVBA_DEPTH_MM
 * @param {number} p.bodyHeightMM  výška TĚLA skříňky (pracovní výška − 290 − 150)
 */
export function buildPodestavba({ widthMM, depthMM = PODESTAVBA_DEPTH_MM, bodyHeightMM }) {
  const group = new THREE.Group();
  group.name = 'podestavba';

  const stainless = createStainlessMaterial();
  const plinth = createPlinthMaterial();

  const zFront = DESK_OVERHANG_FRONT_MM;   // 30 — líc podestavby
  const zBack = zFront + depthMM;          // 700 při depthMM 670 — zadní líc podestavby
  const yBodyBottom = LEG_HEIGHT_MM;       // 150 — horní hrana nožiček
  const yBodyTop = LEG_HEIGHT_MM + bodyHeightMM; // horní hrana podestavby

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
  // Vnější líc nožičky je LEG_INSET_MM od bočního i čelního/zadního líce.
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
      const leg = box(mm(LEG_SIZE_MM), mm(LEG_HEIGHT_MM), mm(LEG_SIZE_MM), plinth);
      leg.position.set(mm(lx), mm(LEG_HEIGHT_MM) / 2, mm(lz));
      leg.name = 'nozicka';
      group.add(leg);
    });
  });

  // --- hygienický stupeň H2: R16 v koutech MEZI PODLÁŽKOU A BOČNÍMI STĚNAMI
  // (dva kouty, zepředu vidět vlevo a vpravo dole). Ostatní kouty ne — H3 se
  // teď nedělá (viz "Co se teď NEDĚLÁ"). ------------------------------------
  const h2Left = buildH2Fillet(WALL_MM, yBodyBottom + FLOOR_MM, +1, floorFrontZ, floorBackZ, stainless);
  h2Left.name = 'h2-levy';
  group.add(h2Left);
  const h2Right = buildH2Fillet(widthMM - WALL_MM, yBodyBottom + FLOOR_MM, -1, floorFrontZ, floorBackZ, stainless);
  h2Right.name = 'h2-pravy';
  group.add(h2Right);

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
 * @returns {THREE.Group}
 */
export function buildSideCover({ thicknessMM = SIDE_COVER_THICK_MM, heightMM, fromZMM, toZMM, xMM = 0 }) {
  const group = new THREE.Group();
  group.name = 'bocni-kryt';

  const stainless = createStainlessMaterial();
  const depthMM = toZMM - fromZMM;
  const cover = box(mm(thicknessMM), mm(heightMM), mm(depthMM), stainless);
  cover.position.set(
    mm(xMM + thicknessMM / 2),
    mm(LEG_HEIGHT_MM + heightMM / 2),
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
 * @param {Array<{xMM:number, widthMM:number}>} podestavby
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number, leftEndType?:string, rightEndType?:string}>} herdblok
 * @returns {Array<{xMM:number, thicknessMM:number, depthMM:number}>} xMM = menší x kraj krytu
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
      covers.push({ xMM: p.xMM - thicknessMM, thicknessMM, depthMM: herdblokDepthAtX(p.xMM, herdblok) });
    }
    if (!hasRightNeighbor) {
      const atEdge = i === sorted.length - 1 && rightEdgeX !== null
        && Math.abs((p.xMM + p.widthMM) - rightEdgeX) <= SIDE_ADJACENCY_TOL_MM;
      // VÝJIMKA — stejné pravidlo jako výš, pro pravý konec.
      const thicknessMM = atEdge && rightEndType !== END_TYPES.VERTICAL_PLATE_CHAMFER
        ? SIDE_COVER_THICK_MM : SIDE_COVER_THIN_MM;
      covers.push({ xMM: p.xMM + p.widthMM, thicknessMM, depthMM: herdblokDepthAtX(p.xMM, herdblok) });
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
 * Sestaví THREE.Group reprezentující celý blok ALBA MONO ze DVOU nezávislých
 * vrstev: `podestavby` a `herdblok` (pole úseků — typicky jeden úsek, ale
 * API to nevyžaduje). Boční kryty jsou TŘETÍ, ODVOZENOU vrstvou —
 * computeSideCovers() je vygeneruje sama z řady podestaveb (viz zadání,
 * bod 5); volající je nezadává.
 *
 * @param {object} params
 * @param {number} [params.workHeightMM=900]  pracovní výška, 850–900
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number}>} params.podestavby
 * @param {Array<{xMM:number, widthMM:number, depthMM?:number, leftEndType?:string,
 *   rightEndType?:string, collar?:Array}>} params.herdblok  úseky herdbloku
 * @param {Array<{kind:string, xMM:number, heightMM:number}>} [params.panelItems]
 *   prvky ovládacího panelu (zásuvky apod.), ABSOLUTNÍ xMM po délce CELÉHO
 *   bloku — každý se osadí do úseku herdbloku, do jehož rozsahu xMM spadá
 *   (viz smyčka níž); šířku panelu daného úseku hlídá až buildHerdblokUsek.
 * @returns {{group:THREE.Group, support: Array, bodyHeightMM:number, workHeightMM:number}}
 */
export function buildMonoBlock({
  workHeightMM = WORK_HEIGHT_DEFAULT_MM,
  podestavby = [],
  herdblok = [],
  panelItems = [],
}) {
  const workHeight = clamp(workHeightMM, WORK_HEIGHT_MIN_MM, WORK_HEIGHT_MAX_MM);
  // výška bloku se mění VÝHRADNĚ tělem skříňky — herdblok i nožičky jsou pevné
  const bodyHeightMM = workHeight - HERDBLOK_HEIGHT_MM - LEG_HEIGHT_MM;

  const group = new THREE.Group();
  group.name = 'alba-mono-blok';

  const podestavbyGroup = new THREE.Group();
  podestavbyGroup.name = 'podestavby';
  podestavby.forEach((p) => {
    const mesh = buildPodestavba({ widthMM: p.widthMM, depthMM: p.depthMM, bodyHeightMM });
    mesh.position.x = mm(p.xMM);
    podestavbyGroup.add(mesh);
  });
  group.add(podestavbyGroup);

  const herdblokGroup = new THREE.Group();
  herdblokGroup.name = 'herdblok';
  herdblokGroup.position.y = mm(workHeight - HERDBLOK_HEIGHT_MM); // sedí na podestavbách
  herdblok.forEach((u) => {
    // panelItems mají ABSOLUTNÍ xMM po délce CELÉHO bloku (viz JSDoc výš) —
    // tady se jen rozdělí do úseku, do jehož rozsahu spadají, a xMM se
    // převede na LOKÁLNÍ souřadnici úseku (stejná konvence jako u xMM/
    // widthMM samotného úseku). Kontrolu vůči ŠÍŘCE PANELU (užší než úsek)
    // dělá až buildHerdblokUsek — ten zná leftInsetMM/rightInsetMM.
    const usekPanelItems = panelItems
      .filter((it) => it.xMM >= u.xMM && it.xMM <= u.xMM + u.widthMM)
      .map((it) => ({ ...it, xMM: it.xMM - u.xMM }));
    const mesh = buildHerdblokUsek({ ...u, panelItems: usekPanelItems });
    mesh.position.x = mm(u.xMM);
    herdblokGroup.add(mesh);
  });
  group.add(herdblokGroup);

  // --- boční kryty: odvozené z řady podestaveb, NENÍ to volba volajícího ---
  // Rozměry, které se nemění (viz zadání, bod 5): výška = tělo podestavby
  // (LEG_HEIGHT_MM..LEG_HEIGHT_MM+bodyHeightMM, řeší buildSideCover sám).
  // Hloubka (zadní hrana) je VOLNÁ — odvozuje se z depthMM úseku herdbloku,
  // ke kterému kryt patří (viz herdblokDepthAtX/computeSideCovers výše), ne
  // natvrdo z HERDBLOK_DEPTH_DEFAULT_MM; při jiné hloubce než 850 by kryt
  // jinak nedosáhl ke stěně, nebo ji přesáhl. Přední hrana zůstává vždy na
  // DESK_OVERHANG_FRONT_MM (30).
  // PŘEDPOKLAD: u vnitřních (THIN, mezi podestavbami) krytů není potvrzeno,
  // jestli mají jít taky až ke stěně, nebo jen po zadní líc podestavby —
  // zatím je děláme stejně jako krajní, tedy až ke stěně (depthMM úseku).
  const sideCoversGroup = new THREE.Group();
  sideCoversGroup.name = 'bocni-kryty';
  computeSideCovers(podestavby, herdblok).forEach(({ xMM, thicknessMM, depthMM }) => {
    const cover = buildSideCover({
      thicknessMM,
      heightMM: bodyHeightMM,
      fromZMM: DESK_OVERHANG_FRONT_MM,
      toZMM: depthMM,
      xMM,
    });
    sideCoversGroup.add(cover);
  });
  group.add(sideCoversGroup);

  const support = herdblok.map((u) => ({ usek: u, ...checkSupport(podestavby, u) }));

  group.userData.workHeightMM = workHeight;
  group.userData.bodyHeightMM = bodyHeightMM;
  group.userData.support = support;

  return { group, support, bodyHeightMM, workHeightMM: workHeight };
}
