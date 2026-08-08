// ui.js — boční panel: rozměry bloku, DVĚ nezávislé strany segmentů (A/B u
// ostrova), katalog pro přidání, napouštěcí ramena, přednastavené pohledy,
// prostředí a export (SPEC v3).

import {
  NEUTRAL_TYPE,
  CUSTOM_TYPE,
  DRAWERS_TYPE,
  DRAWER_COUNT_OPTIONS,
  getSegmentLabel,
  getSegmentWidthMM,
  getSegmentBodyStyle,
  getSegmentPlinth,
  getSegmentFinish,
  getSegmentDrawerCount,
  BODY_STYLE_OPTIONS,
  PLINTH_TYPES,
  FINISH_TYPES,
  NEUTRAL_WIDTH_MIN,
  NEUTRAL_WIDTH_MAX,
  NEUTRAL_WIDTH_STEP,
  DRAWERS_WIDTH_MM,
  CATALOG_WIDTH_MAX,
  CATALOG_WIDTH_STEP,
  SINK_VAT_WIDTH_MIN,
  SINK_VAT_WIDTH_MAX,
  SINK_VAT_WIDTH_STEP,
  SINK_VAT_DEPTH_MIN,
  SINK_VAT_DEPTH_MAX,
  SINK_VAT_DEPTH_STEP,
  SINK_WIDTH_MARGIN_MM,
} from './modules.js';
import { getVisible as getCatalogVisible, getById as getCatalogEntry, getEntryDisplayName } from './catalog.js';
import {
  ARM_ANGLE_MIN,
  ARM_ANGLE_MAX,
  ARM_OFFSET_STEP,
  ARM_BACK_OFFSET_MIN,
  ARM_BACK_OFFSET_MAX,
  ARM_BACK_OFFSET_DEFAULT,
  ARM_CENTER_OFFSET_MIN,
  ARM_CENTER_OFFSET_MAX,
  ARM_CENTER_OFFSET_DEFAULT,
} from './arms.js';
import {
  t, getLang, setLang, onLangChange, LANGS, PRODUCT_NAMES,
} from './i18n.js';
// --- pás MONO (balík A7, §8 zadání ZADANI-MONO-UI.md) — CELÝ spodní pás pro
// MONO kreslí mono-ui.js, ui.js se na něj jen přepíná (viz getMonoStrip níže
// a větev na začátku renderStrip). Modul píše souběžně jiný člověk podle
// smlouvy v §3 zadání — tady se proti ní jen importuje.
import { createMonoStrip } from './mono-ui.js';

export const STORAGE_KEY = 'nerez-blok-config-v3';

// --- vlaječky pro přepínač jazyka (§13 SPEC v4, horní lišta) --------------------
// Kresleny inline v SVG (žádné externí soubory, žádné emoji — na Windows se
// emoji vlaječky nevykreslují barevně spolehlivě). Velikost dle viewBoxu
// (poměr stran ~3:2, konkrétní rozměr dává CSS .lang-btn).
const FLAG_SVGS = {
  en: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="20" fill="#012169"/>
    <path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="4"/>
    <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.6"/>
    <path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="7"/>
    <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="4"/>
  </svg>`,
  de: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="6.67" fill="#111111"/>
    <rect y="6.67" width="30" height="6.67" fill="#DD0000"/>
    <rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>
  </svg>`,
  pl: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="10" fill="#ffffff"/>
    <rect y="10" width="30" height="10" fill="#DC143C"/>
  </svg>`,
  cs: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="10" fill="#ffffff"/>
    <rect y="10" width="30" height="10" fill="#D7141A"/>
    <path d="M0,0 L15,10 L0,20 Z" fill="#11457E"/>
  </svg>`,
  sk: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="30" height="6.67" fill="#ffffff"/>
    <rect y="6.67" width="30" height="6.67" fill="#0B4EA2"/>
    <rect y="13.33" width="30" height="6.67" fill="#EE1C25"/>
    <g transform="translate(6,4)">
      <rect width="8" height="12" rx="1" fill="#ffffff" stroke="#0B4EA2" stroke-width="0.6"/>
      <rect x="3" y="2.5" width="2" height="7" fill="#EE1C25"/>
      <rect x="1" y="5" width="6" height="2" fill="#EE1C25"/>
    </g>
  </svg>`,
};

// --- ikony palety prvků (krok 2 redesignu) — klíč = topFeature.type ------------
// Společný styl kreseb: viewBox 0 0 24 24, obrysové tahy stroke-width 1.6,
// kresba uvnitř plochy 3–21. Výjimky (plné tvary) mají vlastní fill/stroke.
const PALETTE_ICON_ATTRS = 'viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" '
  + 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

const PALETTE_ICONS = {
  burners4: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <circle cx="9" cy="9" r="1.8" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="9" r="1.8" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="15" r="1.8" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="15" r="1.8" fill="currentColor" stroke="none"/>
  </svg>`,
  induction: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <circle cx="9" cy="9" r="2.4"/>
    <circle cx="15" cy="9" r="2.4"/>
    <circle cx="9" cy="15" r="2.4"/>
    <circle cx="15" cy="15" r="2.4"/>
  </svg>`,
  ceramic4: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <circle cx="9" cy="9" r="2.4"/>
    <circle cx="15" cy="9" r="2.4"/>
    <circle cx="9" cy="15" r="2.4"/>
    <circle cx="15" cy="15" r="2.4"/>
    <path d="M4,12 H20"/>
  </svg>`,
  fryer1: `<svg ${PALETTE_ICON_ATTRS}>
    <path d="M6,7 H18 L16,18 H8 Z"/>
    <path d="M7,10 q2.5,-2 5,0 t5,0"/>
  </svg>`,
  fryer2: `<svg ${PALETTE_ICON_ATTRS}>
    <path d="M5,7 H11 L10,18 H6 Z"/>
    <path d="M13,7 H19 L18,18 H14 Z"/>
  </svg>`,
  grill: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="5" width="16" height="14" rx="2"/>
    <path d="M9,7 V17 M12,7 V17 M15,7 V17"/>
  </svg>`,
  bainmarie: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="6" width="16" height="12" rx="2"/>
    <path d="M4,10 H20 M12,10 V18"/>
  </svg>`,
  multipan: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="5" y="8" width="14" height="9" rx="2"/>
    <path d="M5,10 H2"/>
  </svg>`,
  sink: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="8" width="16" height="11" rx="2"/>
    <path d="M12,8 V4"/>
    <path d="M12,4 q4,0 4,3"/>
  </svg>`,
  none: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>`,
  bitmap: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="5" width="16" height="14" rx="2"/>
    <circle cx="9" cy="10" r="1.4" fill="currentColor" stroke="none"/>
    <path d="M5,17 L11,12 L15,15 L19,11"/>
  </svg>`,
  neutral: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M4,9 H20"/>
  </svg>`,
  drawers: `<svg ${PALETTE_ICON_ATTRS}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M4,10 H20 M4,15 H20"/>
    <path d="M10,7 H14 M10,12.5 H14 M10,17.5 H14"/>
  </svg>`,
  custom: `<svg ${PALETTE_ICON_ATTRS.replace('stroke-width="1.6"', 'stroke-width="1.6" stroke-dasharray="3 2.5"')}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M12,9 V15 M9,12 H15" stroke-dasharray="none"/>
  </svg>`,
};

/**
 * Vrátí HTML markup ikony pro klíč `key` (typicky `def.topFeature.type`,
 * nebo `neutral`/`drawers`/`custom` pro tři zvláštní položky palety).
 * Když klíč v mapě není, spadne na ikonu `none` — nikdy nepadá.
 * Pro klíč `bitmap` s `def.imageDataURL` vrátí místo SVG <img> element
 * (hodnota `src` se nastavuje přes DOM, ne skládáním řetězce).
 */
function paletteIconHTML(key, def) {
  if (key === 'bitmap' && def && def.imageDataURL) {
    const img = document.createElement('img');
    img.src = def.imageDataURL;
    img.alt = '';
    return img.outerHTML;
  }
  return PALETTE_ICONS[key] || PALETTE_ICONS.none;
}

// --- ikony pásu sestavy (krok 3B redesignu) — koš v záhlaví pruhu parametrů
// a plus na kartě pro přidání ramene, ve stejném stylu jako ostatní ikony
// aplikace (viewBox 0 0 24 24, fill="none", stroke-width 1.8) ------------------
const TRASH_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M4 7h16"/><path d="M10 4h4"/><path d="M10 11v6"/><path d="M14 11v6"/>'
  + '<path d="M6 7l1 13h10l1-13"/></svg>';

const PLUS_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M12 5v14"/><path d="M5 12h14"/></svg>';

// Ovládání prohození dvou sousedních dlaždic (úkol 5, varianta A3 —
// PREDANI.md). Cesta je DOSLOVA stejná jako u MONO (mono-ui.js, ICON_INNER.swap)
// — dvě šipky proti sobě — protože jde o jednu sdílenou komponentu (třída
// .strip-swap, css/style.css), ne dvě podobné, ale rozdílné.
const SWAP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
  + 'stroke-linecap="round" aria-hidden="true">'
  + '<path d="M8 7l-4 5 4 5"/><path d="M16 7l4 5-4 5"/></svg>';

/** Ovládání prohození dvou sousedních dlaždic — sedí PŘÍMO NA HRANICI mezi
 *  dvěma dlaždicemi jako kruhový překryv (position:absolute v CSS), takže
 *  nezabírá místo v toku a funguje i mezi dvěma libovolně úzkými dlaždicemi.
 *  Volající ho připojuje jako DÍTĚ levé dlaždice páru (ta musí mít
 *  position:relative — .strip-card i .mono-tile ji mají) s `left:100%`,
 *  aby seděl přesně v mezeře. Stejná komponenta jako .strip-swap
 *  v mono-ui.js (JEDNA sdílená CSS třída, ne dvě podobné). */
function renderSwapControl(titleText, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'strip-swap';
  btn.style.left = '100%';
  btn.title = titleText;
  btn.setAttribute('aria-label', titleText);
  btn.innerHTML = SWAP_ICON_SVG;
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onClick();
  });
  return btn;
}

export function setupUI(callbacks) {
  const els = {
    projectName: document.getElementById('project-name'),
    inputLength: document.getElementById('input-length'),
    inputDepthA: document.getElementById('input-depth-a'),
    inputDepthB: document.getElementById('input-depth-b'),
    depthALabel: document.getElementById('depth-a-label'),
    depthBRow: document.getElementById('depth-b-row'),
    depthAGrowNote: document.getElementById('depth-a-grow-note'),
    depthBGrowNote: document.getElementById('depth-b-grow-note'),
    inputHeight: document.getElementById('input-height'),
    variantSingle: document.getElementById('variant-single'),
    variantIsland: document.getElementById('variant-island'),
    dimsTotalDepth: document.getElementById('dims-total-depth'),

    // --- pás sestavy (krok 3A redesignu) --------------------------------------
    assemblyStrip: document.getElementById('assembly-strip'),
    stripTabs: document.getElementById('strip-tabs'),
    stripCapacity: document.getElementById('strip-capacity'),
    stripCollapse: document.getElementById('strip-collapse'),
    stripCards: document.getElementById('strip-cards'),
    stripEmpty: document.getElementById('strip-empty'),
    stripDetail: document.getElementById('strip-detail'),
    // .strip-body nemá vlastní id (jen třídu) — dohledává se přes #assembly-strip,
    // aby balík A7 nemusel sahat do index.html kvůli přidání id (§8 zadání).
    stripBody: document.querySelector('#assembly-strip .strip-body'),
    // #mono-strip-body zakládá souběžně jiný člověk do index.html (§7 zadání) —
    // v okamžiku běhu tohohle kódu ještě nemusí existovat, proto se čte
    // tolerantně (getElementById vrátí null, nikdy nespadne) a všude, kde se
    // dál používá, se ošetřuje (viz renderStrip a getMonoStrip).
    monoStripBody: document.getElementById('mono-strip-body'),

    viewButtons: Array.from(document.querySelectorAll('[data-view]')),
    sideSwitch: document.getElementById('side-switch'),
    sideButtons: Array.from(document.querySelectorAll('[data-side]')),
    envButtons: Array.from(document.querySelectorAll('[data-env]')),
    deviceManagerBtn: document.getElementById('device-manager-btn'),
    floorplanBtn: document.getElementById('floorplan-btn'),
    exportPngBtn: document.getElementById('export-png'),
    saveConfigBtn: document.getElementById('save-config'),
    loadFileInput: document.getElementById('load-file-input'),
    loadFileBtn: document.getElementById('load-file-btn'),
    newProjectBtn: document.getElementById('new-project-btn'),
    projectTypeChip: document.getElementById('project-type-chip'),

    // --- úvodní obrazovka (výběr řady bloku, viz níže) ------------------------
    startScreenOverlay: document.getElementById('start-screen-overlay'),
    startCardNameSegment: document.getElementById('start-card-name-segment'),
    startCardNameMono: document.getElementById('start-card-name-mono'),
    startCardBtnSegment: document.getElementById('start-card-btn-segment'),
    startCardBtnMono: document.getElementById('start-card-btn-mono'),
    startScreenOpenFile: document.getElementById('start-screen-open-file'),
  };

  // --- typ řady bloku (segment/mono) — ui.js si ho drží jen jako kopii pro
  // vykreslení odznaku v panelu Projekt a pro tlačítko „Nový projekt" (to
  // typ nenabízí k výběru, jen zopakuje ten aktuální). Zdroj pravdy je
  // main.js, který po každé změně zavolá setProductType() (viz return níže).
  let currentProductType = null;

  function renderProductTypeChip() {
    if (!els.projectTypeChip) return;
    els.projectTypeChip.textContent = PRODUCT_NAMES[currentProductType] || '';
  }

  // --- pás MONO (balík A7, §8 zadání) — líná instance: modul mono-ui.js se
  // vytvoří až při první potřebě, aby se u projektů SEGMENT vůbec nezaložil.
  // `monoActiveTab` je lokální kopie aktivní záložky pásu MONO (NE state!) —
  // hlásí ji callback onMonoTabChange (§4 zadání) a čte ji renderMonoPaletteList
  // (§8 bod 5). Výchozí hodnota 'herdblok' kopíruje výchozí stav mono-ui.js (§3).
  let monoStrip = null;
  let monoActiveTab = 'herdblok';

  function getMonoStrip() {
    if (!monoStrip) {
      monoStrip = createMonoStrip({
        els: { tabs: els.stripTabs, body: els.monoStripBody },
        t,
        // Callbacky MONO jsou obsahem main.js (§4 zadání) — ui.js je jen
        // PROPOUŠTÍ (proto spread), kromě onMonoTabChange: tu si ui.js
        // ukusuje pro sebe (filtr palety, §8 bod 5) a teprve pak posílá dál.
        callbacks: {
          ...callbacks,
          onMonoTabChange: (tab) => {
            monoActiveTab = tab;
            renderPaletteList();
            callbacks.onMonoTabChange?.(tab);
          },
        },
        // Vrací čitelné jméno přístroje z katalogu podle strojového klíče.
        // Když přístroj není v katalogu (byl smazán), vrací klíč nezměněný.
        deviceName: (typeKey) => {
          const entry = getCatalogEntry(typeKey);
          return entry ? getEntryDisplayName(entry) : typeKey;
        },
      });
    }
    return monoStrip;
  }

  // --- pás sestavy (krok 3A redesignu) — stav záložky/srolování žije jen
  // v této closure, nikam se neukládá; activeTab (mimo 'arms') se odvozuje
  // přímo od state.editSide při každém překreslení (viz renderStrip);
  // `prevSelectedId` slouží k rozpoznání SKUTEČNÉ změny výběru (§3.3 a §3.4
  // zadání) tak, aby se pás uživateli neodroloval při každém překreslení. ----
  let activeTab = 'A'; // 'A' | 'B' | 'arms'
  let collapsed = false;
  let prevSelectedId; // sentinel (undefined) — první render se nepočítá za "změnu"
  let lastStripState = null;

  // --- výběr ramene v pásu (§5.4 zadání) — lokální, ramena se ve 3D scéně
  // nevybírají, takže main.js o tom nemusí vědět. `prevArmIds` slouží k
  // rozpoznání NOVĚ přidaného ramene (§5.4 odst. 2), aby se po přidání
  // vybralo právě ono, ne to, co bylo vybrané předtím. ------------------------
  let selectedArmId = null;
  let prevArmIds = null; // sentinel (null) — první render se nepočítá za "přidání"

  // --- paleta prvků (krok 2 redesignu) — jedna sekce, cílová strana se bere
  // ze stavu aplikace (viz renderPalette níže) --------------------------------
  const paletteEls = {
    section: document.getElementById('palette-section'),
    badge: document.getElementById('palette-target-badge'),
    search: document.getElementById('palette-search'),
    list: document.getElementById('palette-list'),
    empty: document.getElementById('palette-empty'),
    editCatalogBtn: document.getElementById('palette-edit-catalog'),
  };
  let lastPaletteState = null; // naplní render(state)

  const norm = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  function paletteRow(key, def, name, widthText, onClick, disabled) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-item';
    btn.disabled = !!disabled;
    btn.title = t('palette.addTitle', { name, width: widthText });

    const iconSpan = document.createElement('span');
    iconSpan.className = 'palette-icon';
    iconSpan.innerHTML = paletteIconHTML(key, def);
    btn.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'palette-name';
    nameSpan.textContent = name;
    btn.appendChild(nameSpan);

    const widthSpan = document.createElement('span');
    widthSpan.className = 'palette-width';
    widthSpan.textContent = widthText;
    btn.appendChild(widthSpan);

    btn.addEventListener('click', onClick);
    li.appendChild(btn);
    return li;
  }

  // --- paleta MONO (balík A7, §8 bod 5 zadání) — obsah řídí aktivní záložka
  // pásu (monoActiveTab), NE cílová strana/kapacita jako u SEGMENTu. Klíč
  // objektu = záložka, `kind` je druhý parametr onMonoAdd(layer, kind) přesně
  // podle §4 zadání. 'limec' a 'arms' tu záměrně chybí — ty paletu skrývají.
  const MONO_TAB_SPECIALS = {
    herdblok: [{ key: 'surface', i18nKey: 'mono.item.surface', kind: 'surface' }],
    podestavby: [
      { key: 'cabinet', i18nKey: 'mono.item.cabinet', kind: 'cabinet' },
      { key: 'gap', i18nKey: 'mono.item.gap', kind: 'gap' },
    ],
    panel: [
      { key: 'socket230', i18nKey: 'mono.panel.socket230', kind: 'socket230' },
      { key: 'socketCEE', i18nKey: 'mono.panel.socketCEE', kind: 'socketCEE' },
    ],
  };

  /** Paleta pro MONO — samostatná větev volaná z renderPaletteList (viz níže),
   *  aby SEGMENT větev pod ní zůstala nedotčená (§8 bod 5 zadání). Záložky
   *  'limec' a 'arms' paletu skrývají celou (ramena se přidávají z pruhu
   *  parametrů pásu, límce nemají žádnou přidatelnou položku). */
  function renderMonoPaletteList() {
    paletteEls.badge.hidden = true; // MONO nemá cílovou stranu jako ostrovní SEGMENT

    const paletteHidden = monoActiveTab === 'limec' || monoActiveTab === 'arms';
    paletteEls.section.hidden = paletteHidden;
    if (paletteHidden) return;

    const query = norm(paletteEls.search ? paletteEls.search.value : '');
    const layer = (monoActiveTab === 'podestavby' || monoActiveTab === 'panel') ? monoActiveTab : 'herdblok';

    paletteEls.list.innerHTML = '';
    let hasCatalogRows = false;

    if (layer === 'herdblok') {
      getCatalogVisible().filter((def) => !query
        || norm(getEntryDisplayName(def)).includes(query)
        || norm(def.catalogCode).includes(query)).forEach((def) => {
        const name = getEntryDisplayName(def);
        const widthText = def.widthAdjustable
          ? t('catalog.widthFrom', { mm: def.minWidthMM })
          : t('catalog.widthExact', { mm: def.widthMM });
        const iconKey = (def.topFeature && def.topFeature.type) || 'none';
        paletteEls.list.appendChild(paletteRow(
          iconKey, def, name, widthText,
          () => callbacks.onMonoAdd?.('herdblok', def.id),
          false,
        ));
        hasCatalogRows = true;
      });
    }

    const specials = (MONO_TAB_SPECIALS[layer] || [])
      .map((sp) => ({ ...sp, name: t(sp.i18nKey) }))
      .filter((sp) => !query || norm(sp.name).includes(query));

    if (hasCatalogRows && specials.length > 0) {
      const sep = document.createElement('li');
      sep.className = 'palette-sep';
      sep.setAttribute('aria-hidden', 'true');
      paletteEls.list.appendChild(sep);
    }
    specials.forEach((sp) => {
      paletteEls.list.appendChild(paletteRow(
        sp.key, null, sp.name, '—', () => callbacks.onMonoAdd?.(layer, sp.kind), false,
      ));
    });

    const nothingMatched = paletteEls.list.children.length === 0 && !!query;
    paletteEls.empty.hidden = !nothingMatched;
    if (nothingMatched) paletteEls.empty.textContent = t('palette.noResults');
  }

  /** Překreslí jen obsah <ul id="palette-list"> podle aktuálního stavu
   *  aplikace a hodnoty vyhledávacího pole. Vyhledávací pole samo se
   *  nikdy nepřekresluje (uživatel by ztratil kurzor). */
  function renderPaletteList() {
    const state = lastPaletteState;
    if (!state || !paletteEls.list) return;

    // MONO má úplně jinou logiku palety (podle záložky pásu, ne strany a
    // kapacity) — samostatná větev, SEGMENT pod ní zůstává beze změny
    // (§8 bod 5 zadání, stejný princip jako přepnutí v renderStrip výše).
    if (currentProductType === 'mono') {
      renderMonoPaletteList();
      return;
    }

    const isIsland = state.variant === 'island';
    const targetSide = isIsland ? state.editSide : 'A';

    paletteEls.badge.hidden = !isIsland;
    if (isIsland) {
      paletteEls.badge.textContent = t('palette.targetSide', { side: targetSide });
      paletteEls.badge.title = t('palette.targetSideTitle', { side: targetSide });
    }

    const capacity = targetSide === 'B' ? state.capacityB : state.capacityA;
    const hasRoom = capacity ? capacity.usedMM < capacity.capacityMM : false;

    const query = norm(paletteEls.search ? paletteEls.search.value : '');
    const catalogDefs = getCatalogVisible();
    const matchedCatalog = catalogDefs.filter((def) => {
      if (!query) return true;
      const name = norm(getEntryDisplayName(def));
      const code = norm(def.catalogCode);
      return name.includes(query) || code.includes(query);
    });

    const specials = [
      {
        key: 'neutral',
        name: t('palette.neutral'),
        widthText: t('catalog.widthFrom', { mm: NEUTRAL_WIDTH_MIN }),
        onClick: () => callbacks.onAddNeutral(targetSide),
      },
      {
        key: 'drawers',
        name: t('palette.drawers'),
        widthText: t('catalog.widthExact', { mm: DRAWERS_WIDTH_MM }),
        onClick: () => callbacks.onAddDrawers(targetSide),
      },
      {
        key: 'custom',
        name: t('palette.custom'),
        widthText: '—',
        onClick: () => callbacks.onOpenCustomNew(targetSide),
      },
    ];
    const matchedSpecials = specials.filter((sp) => {
      if (!query) return true;
      return norm(sp.name).includes(query);
    });

    paletteEls.list.innerHTML = '';
    matchedCatalog.forEach((def) => {
      const name = getEntryDisplayName(def);
      const widthText = def.widthAdjustable
        ? t('catalog.widthFrom', { mm: def.minWidthMM })
        : t('catalog.widthExact', { mm: def.widthMM });
      const iconKey = (def.topFeature && def.topFeature.type) || 'none';
      paletteEls.list.appendChild(paletteRow(
        iconKey, def, name, widthText,
        () => callbacks.onAddInstrument(targetSide, def.id),
        !hasRoom,
      ));
    });

    if (matchedCatalog.length > 0 && matchedSpecials.length > 0) {
      const sep = document.createElement('li');
      sep.className = 'palette-sep';
      sep.setAttribute('aria-hidden', 'true');
      paletteEls.list.appendChild(sep);
    }

    matchedSpecials.forEach((sp) => {
      paletteEls.list.appendChild(paletteRow(
        sp.key, null, sp.name, sp.widthText, () => sp.onClick(), !hasRoom,
      ));
    });

    const nothingMatched = matchedCatalog.length === 0 && matchedSpecials.length === 0 && !!query;
    const emptyCatalogCase = catalogDefs.length === 0 && !query;
    if (nothingMatched) {
      paletteEls.empty.hidden = false;
      paletteEls.empty.textContent = t('palette.noResults');
    } else if (emptyCatalogCase) {
      paletteEls.empty.hidden = false;
      paletteEls.empty.textContent = t('palette.emptyCatalog');
    } else {
      paletteEls.empty.hidden = true;
    }
  }

  function renderPalette(state) {
    lastPaletteState = state;
    renderPaletteList();
  }

  // --- přepínač jazyka: jedno tlačítko (vlaječka aktuálního jazyka + šipka)
  // a rozbalovací nabídka se všemi jazyky (ZMĚNA 11, §13 SPEC v4) — pořadí
  // jazyků se bere z i18n.js (LANGS), kresby vlaječek jsou v FLAG_SVGS nahoře
  // v tomto souboru (emoji vlaječky se na Windows nevykreslují barevně).
  // Přidání dalšího jazyka je tedy úprava na dvou místech: LANGS v i18n.js
  // a FLAG_SVGS zde. Přepnutí ihned překreslí celý panel přes onLangChange
  // posluchač zaregistrovaný v main.js. ----------------------------------------
  const langSwitcherEl = document.getElementById('lang-switcher');
  const CARET_DOWN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  let langMenuOpen = false;
  let langMenuElement = null;

  function closeLangMenu() {
    if (!langMenuOpen) return;
    langMenuOpen = false;
    // Odstraň nabídku z body (pokud existuje)
    if (langMenuElement && langMenuElement.parentElement === document.body) {
      document.body.removeChild(langMenuElement);
    }
    langMenuElement = null;
    renderLangSwitcher();
  }

  function renderLangSwitcher() {
    if (!langSwitcherEl) return;
    const active = getLang();
    langSwitcherEl.innerHTML = '';

    // Odstraň předchozí nabídku z body (pro případ, že se překresluje při přepnutí jazyka)
    if (langMenuElement && langMenuElement.parentElement === document.body) {
      document.body.removeChild(langMenuElement);
    }
    langMenuElement = null;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'lang-switcher-btn';
    toggleBtn.setAttribute('aria-haspopup', 'listbox');
    toggleBtn.setAttribute('aria-expanded', String(langMenuOpen));
    toggleBtn.title = t('lang.menu');
    toggleBtn.setAttribute('aria-label', t('lang.menu'));

    const flagSpan = document.createElement('span');
    flagSpan.className = 'lang-switcher-flag';
    flagSpan.innerHTML = FLAG_SVGS[active] || '';
    toggleBtn.appendChild(flagSpan);

    const caretSpan = document.createElement('span');
    caretSpan.className = 'lang-switcher-caret';
    caretSpan.innerHTML = CARET_DOWN_SVG;
    toggleBtn.appendChild(caretSpan);

    toggleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      langMenuOpen = !langMenuOpen;
      renderLangSwitcher();
    });
    langSwitcherEl.appendChild(toggleBtn);

    if (langMenuOpen) {
      const menu = document.createElement('ul');
      menu.className = 'lang-menu';
      menu.setAttribute('role', 'listbox');
      LANGS.forEach((code) => {
        const li = document.createElement('li');
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'lang-menu-item';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(code === active));

        const flag = document.createElement('span');
        flag.className = 'lang-menu-flag';
        flag.innerHTML = FLAG_SVGS[code] || '';
        item.appendChild(flag);

        const label = document.createElement('span');
        label.textContent = t(`lang.${code}`);
        item.appendChild(label);

        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          langMenuOpen = false;
          setLang(code);
        });
        li.appendChild(item);
        menu.appendChild(li);
      });

      // Připoj menu do body (ne do langSwitcherEl)
      document.body.appendChild(menu);
      langMenuElement = menu;

      // Spočítej pozici z rámečku tlačítka
      const btnRect = toggleBtn.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      menu.style.position = 'fixed';
      menu.style.top = (btnRect.bottom + 6) + 'px';
      menu.style.left = Math.max(8, btnRect.right - menuWidth) + 'px';
      menu.style.zIndex = '200';
    }
  }

  // zavření nabídky kliknutím mimo ni a klávesou Escape
  document.addEventListener('click', (ev) => {
    if (langMenuOpen && langSwitcherEl) {
      const isClickInButton = langSwitcherEl.contains(ev.target);
      const isClickInMenu = langMenuElement && langMenuElement.contains(ev.target);
      if (!isClickInButton && !isClickInMenu) {
        closeLangMenu();
      }
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && langMenuOpen) {
      closeLangMenu();
    }
  });

  // Zavření nabídky při resize okna
  window.addEventListener('resize', () => {
    if (langMenuOpen) {
      closeLangMenu();
    }
  });

  renderLangSwitcher();
  onLangChange(renderLangSwitcher);

  // --- název projektu (přestavba horní části panelu) --------------------------
  // Pole je vždy <input>, jen vypadá jako prostý text — viz §4.2 zadání.
  // valueBeforeEdit drží hodnotu z okamžiku zaostření, aby Escape mohl vrátit
  // přesně tu, co tam byla PŘED úpravou (ne poslední uloženou hodnotu ve stavu).
  if (els.projectName) {
    let valueBeforeEdit = '';
    els.projectName.addEventListener('focus', () => {
      valueBeforeEdit = els.projectName.value;
    });
    els.projectName.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        els.projectName.blur();
      } else if (ev.key === 'Escape') {
        els.projectName.value = valueBeforeEdit;
        els.projectName.blur();
      }
    });
    const commitProjectName = () => {
      callbacks.onProjectNameChange(els.projectName.value.trim());
    };
    els.projectName.addEventListener('change', commitProjectName);
    els.projectName.addEventListener('blur', commitProjectName);
  }

  // --- rozměry bloku -----------------------------------------------------------
  els.inputLength.addEventListener('change', () => {
    callbacks.onDimensionsChange({ lengthMM: Number(els.inputLength.value) });
  });
  els.inputDepthA.addEventListener('change', () => {
    callbacks.onDimensionsChange({ depthAMM: Number(els.inputDepthA.value) });
  });
  els.inputDepthB.addEventListener('change', () => {
    callbacks.onDimensionsChange({ depthBMM: Number(els.inputDepthB.value) });
  });
  els.inputHeight.addEventListener('change', () => {
    callbacks.onDimensionsChange({ heightMM: Number(els.inputHeight.value) });
  });
  els.variantSingle.addEventListener('change', () => {
    if (els.variantSingle.checked) callbacks.onVariantChange('single');
  });
  els.variantIsland.addEventListener('change', () => {
    if (els.variantIsland.checked) callbacks.onVariantChange('island');
  });

  // --- paleta prvků (krok 2 redesignu) — posluchače se registrují jednou zde,
  // ne při každém vykreslení; překreslení seznamu viz renderPaletteList výše ----
  if (paletteEls.search) {
    paletteEls.search.addEventListener('input', () => renderPaletteList());
  }
  if (paletteEls.editCatalogBtn) {
    paletteEls.editCatalogBtn.addEventListener('click', () => callbacks.onOpenDeviceManager());
  }

  // --- katalog přístrojů — Správce přístrojů (SPEC v3 §3.4) ---------------------
  els.deviceManagerBtn.addEventListener('click', () => callbacks.onOpenDeviceManager());

  // --- srolování pásu sestavy (krok 3A) — posluchač jen jednou, popisek/ikona
  // a aria-expanded se dopočítávají v renderStripCollapseButton() při každém
  // překreslení (viz §3.7 zadání) --------------------------------------------------
  if (els.stripCollapse) {
    els.stripCollapse.addEventListener('click', () => {
      collapsed = !collapsed;
      renderStripCollapseButton();
    });
  }

  // --- přednastavené pohledy -----------------------------------------------------
  els.viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onViewChange(btn.dataset.view));
  });
  const frontViewBtn = els.viewButtons.find((btn) => btn.dataset.view === 'front');

  // --- přepínač strany bloku A/B (jen ostrovní blok) ------------------------------
  els.sideButtons.forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onSideChange(btn.dataset.side));
  });

  // --- prostředí (podlaha) --------------------------------------------------------
  els.envButtons.forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onEnvChange(btn.dataset.env));
  });

  // --- tiskový dokument / půdorys (§ČÁST 2) — tlačítko v liště je čtvrtý "pohled":
  // otevírá/zavírá překryv (přepínač), viz aktivní stav v render() níže -----------
  els.floorplanBtn.addEventListener('click', () => callbacks.onToggleFloorplan());

  // --- export / import -------------------------------------------------------------
  els.exportPngBtn.addEventListener('click', () => callbacks.onExportPng());
  els.saveConfigBtn.addEventListener('click', () => callbacks.onSaveConfig());
  els.loadFileBtn.addEventListener('click', () => els.loadFileInput.click());
  els.loadFileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) callbacks.onLoadFile(file);
    event.target.value = '';
  });
  // --- úvodní obrazovka (výběr řady bloku) ------------------------------------
  // Otevírá se jak při startu aplikace (main.js, když není co obnovit — viz
  // showStartScreen() v return níže), tak z tlačítka „Nový projekt". V obou
  // případech se na ní typ VOLÍ (klik na kartu), tlačítko samo typ nenabízí.
  //
  // Zavíratelnost overlaye je stavová (startScreenCloseable), NE napevno:
  // při startu aplikace není kam se vrátit (žádný projekt ještě nevznikl),
  // takže křížek i Escape musí být vypnuté — jinak by uživatel mohl uváznout
  // v aplikaci bez zvoleného typu bloku. Z tlačítka „Nový projekt" naproti
  // tomu rozpracovaná sestava mezitím žije dál za overlayem (zahodí ji až
  // main.js v onNewProject() PO výběru karty), takže návrat zpět dává smysl
  // a musí být možný. Proto dvě cesty dovnitř (openStartScreen(false/true))
  // a jedna cesta ven přes zavření (closeStartScreen, jen když closeable).
  let startScreenCloseable = false;

  // Křížek v rohu overlaye — dohledá existující prvek z index.html,
  // obslouží kliknutí a přepíná viditelnost podle startScreenCloseable.
  const startScreenCloseBtn = document.getElementById('start-screen-close-btn');
  if (startScreenCloseBtn) {
    startScreenCloseBtn.addEventListener('click', () => closeStartScreen());
  }

  /** Aktualizuj přístupové atributy křížku — existující klíč common.close
   *  zajišťuje applyTranslations přes data-i18n-title a data-i18n-aria-label. */
  function updateStartScreenCloseLabel() {
    // applyTranslations už popisek obnovuje přes data-i18n atributy, takže tady
    // není nutné nic dělat — už to funguje bez dalšího kódu.
  }
  onLangChange(updateStartScreenCloseLabel);

  function setStartScreenCloseable(closeable) {
    startScreenCloseable = closeable;
    if (startScreenCloseBtn) startScreenCloseBtn.hidden = !closeable;
  }

  function openStartScreen(closeable) {
    setStartScreenCloseable(closeable);
    if (els.startScreenOverlay) els.startScreenOverlay.hidden = false;
  }

  function closeStartScreen() {
    if (!startScreenCloseable) return;
    if (!els.startScreenOverlay || els.startScreenOverlay.hidden) return;
    els.startScreenOverlay.hidden = true;
  }

  // zavření křížkem řeší posluchač výše, zavření klávesou Escape je globální
  // (no-op, když overlay není zavíratelný nebo není vidět — viz closeStartScreen)
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeStartScreen();
  });

  // Názvy karet jsou obchodní jména z PRODUCT_NAMES (i18n.js) — nepřekládají
  // se, proto se nastavují jednou tady, ne přes data-i18n. Klik na kartu jen
  // ohlásí volbu (main.js pak sám zavolá ui.hideStartScreen()), nezavírá se sám.
  if (els.startCardNameSegment) els.startCardNameSegment.textContent = PRODUCT_NAMES.segment;
  if (els.startCardNameMono) els.startCardNameMono.textContent = PRODUCT_NAMES.mono;
  if (els.startCardBtnSegment) {
    els.startCardBtnSegment.addEventListener('click', () => callbacks.onNewProject('segment'));
  }
  if (els.startCardBtnMono) {
    els.startCardBtnMono.addEventListener('click', () => callbacks.onNewProject('mono'));
  }
  if (els.startScreenOpenFile) {
    els.startScreenOpenFile.addEventListener('click', (ev) => {
      ev.preventDefault();
      callbacks.onRequestOpenFile();
    });
  }

  // --- tlačítko „Nový projekt" (panel Projekt) — typ se tady NENABÍZÍ. Dřív
  // tohle tlačítko rovnou zavolalo callbacks.onNewProject(currentProductType),
  // čímž založilo nový projekt ve STÁVAJÍCÍM typu bez ptaní — špatně, typ se
  // smí volit VÝHRADNĚ na úvodní obrazovce (viz výše). Správně tedy tlačítko
  // jen otevře úvodní obrazovku (zavíratelnou, protože rozdělaná sestava
  // mezitím žije dál za overlayem) a čeká, až uživatel klikne na kartu.
  // Potvrzovací dotaz (window.confirm) se přeskočí, když je sestava prázdná.
  if (els.newProjectBtn) {
    els.newProjectBtn.addEventListener('click', () => {
      const state = lastStripState;
      const isEmpty = !state || (
        (state.segmentsA || []).length === 0
        && (state.variant !== 'island' || (state.segmentsB || []).length === 0)
        && (state.arms || []).length === 0
      );
      if (!isEmpty && !window.confirm(t('confirm.newProject'))) return;
      openStartScreen(true);
    });
  }

  // --- provedení soklu + povrchová úprava (§11.2 SPEC v4) — u KAŽDÉHO segmentu ----
  function appendPlinthFinishFields(extra, seg) {
    const plinthLabel = document.createElement('label');
    plinthLabel.className = 'extra-field';
    plinthLabel.textContent = t('field.plinth');
    const plinthSelect = document.createElement('select');
    PLINTH_TYPES.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = t(`plinth.${value}`);
      if (getSegmentPlinth(seg) === value) opt.selected = true;
      plinthSelect.appendChild(opt);
    });
    plinthSelect.addEventListener('click', (ev) => ev.stopPropagation());
    plinthSelect.addEventListener('change', () => {
      callbacks.onSegmentPlinthChange(seg.id, plinthSelect.value);
    });
    plinthLabel.appendChild(plinthSelect);
    extra.appendChild(plinthLabel);

    const finishLabel = document.createElement('label');
    finishLabel.className = 'extra-field';
    finishLabel.textContent = t('field.finish');
    const finishSelect = document.createElement('select');
    // FINISH_TYPES jsou kódy (HS+/H1/H2/H3), stejné ve všech jazycích — nepřekládají se.
    FINISH_TYPES.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      if (getSegmentFinish(seg) === value) opt.selected = true;
      finishSelect.appendChild(opt);
    });
    finishSelect.addEventListener('click', (ev) => ev.stopPropagation());
    finishSelect.addEventListener('change', () => {
      callbacks.onSegmentFinishChange(seg.id, finishSelect.value);
    });
    finishLabel.appendChild(finishSelect);
    extra.appendChild(finishLabel);
  }

  // --- vykreslení jedné karty segmentu v pásu (krok 3A) -----------------------------
  // Šířka karty se odvozuje od šířky segmentu, aby řada karet četla jako půdorys
  // (§3.4 zadání). Přetahování se v této části NEDĚLÁ.
  // Šipky ◀ ▶ na okrajích karty (dřív tady) přeuspořádání ovládaly — zadavatel
  // je z karty odstranil (úkol 5, PREDANI.md): totéž ovládání jinde podle
  // produktu bylo nekonzistentní. Nahradilo je sdílené ovládání .strip-swap
  // v MEZEŘE mezi kartami, viz renderSwapControl a renderStripCards níže —
  // karta samotná teď staví jen své tělo.
  function renderSegmentCard(seg, state, fitInfo) {
    const li = document.createElement('li');
    li.className = 'strip-card';
    if (seg.id === state.selectedId) li.classList.add('selected');
    if (!fitInfo.fits) li.classList.add('overflow');
    li.dataset.id = String(seg.id);

    const px = Math.round(Math.min(270, 150 + Math.max(0, getSegmentWidthMM(seg) - 400) / 8));
    li.style.width = px + 'px';

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'strip-card-body';
    body.addEventListener('click', () => callbacks.onSelectSegment(seg.id));

    const nameSpan = document.createElement('span');
    nameSpan.className = 'strip-card-name';
    nameSpan.textContent = getSegmentLabel(seg);
    body.appendChild(nameSpan);

    const widthSpan = document.createElement('span');
    widthSpan.className = 'strip-card-width';
    widthSpan.textContent = t('segment.width', { mm: getSegmentWidthMM(seg) }) + (fitInfo.fits ? '' : t('segment.overflowSuffix'));
    body.appendChild(widthSpan);

    li.appendChild(body);

    return li;
  }

  /** Společné záhlaví pruhu parametrů (§4 zadání) — název vybrané položky +
   *  červená ikona koše, která ji smaže. Používá se jak pro segment, tak
   *  pro rameno. */
  function renderDetailHead(title, onRemoveClick, removeLabel) {
    const head = document.createElement('div');
    head.className = 'strip-detail-head';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'strip-detail-title';
    titleSpan.textContent = title;
    head.appendChild(titleSpan);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'strip-detail-del';
    delBtn.title = removeLabel;
    delBtn.setAttribute('aria-label', removeLabel);
    delBtn.innerHTML = TRASH_ICON_SVG;
    delBtn.addEventListener('click', onRemoveClick);
    head.appendChild(delBtn);

    return head;
  }

  // --- vykreslení pruhu s detailem vybraného segmentu (krok 3A) ---------------------
  // Beze změny logiky oproti dřívějšímu `renderSegmentItem` — jen kontejner má
  // třídu `strip-detail-grid` místo `module-extra` (přeliv řeší CSS pásu, §3.6
  // zadání) a border-top odpadá (řeší ho `.strip-detail` v CSS).
  function renderSegmentDetail(seg) {
    let extra = null;

    if (seg.type === NEUTRAL_TYPE) {
      extra = document.createElement('div');
      extra.className = 'strip-detail-grid';

      const widthLabel = document.createElement('label');
      widthLabel.className = 'extra-field';
      widthLabel.textContent = t('field.width');
      const widthInput = document.createElement('input');
      widthInput.type = 'number';
      widthInput.min = String(NEUTRAL_WIDTH_MIN);
      widthInput.max = String(NEUTRAL_WIDTH_MAX);
      widthInput.step = String(NEUTRAL_WIDTH_STEP);
      widthInput.value = String(seg.widthMM);
      widthInput.addEventListener('click', (ev) => ev.stopPropagation());
      widthInput.addEventListener('change', () => {
        callbacks.onNeutralWidthChange(seg.id, Number(widthInput.value));
      });
      widthLabel.appendChild(widthInput);
      extra.appendChild(widthLabel);

      const podLabel = document.createElement('label');
      podLabel.className = 'extra-field';
      podLabel.textContent = t('field.baseType');
      const podSelect = document.createElement('select');
      ['doors', 'open'].forEach((val) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = t(`bodyStyle.${val}`);
        if (seg.podestavba === val) opt.selected = true;
        podSelect.appendChild(opt);
      });
      podSelect.addEventListener('click', (ev) => ev.stopPropagation());
      podSelect.addEventListener('change', () => {
        callbacks.onNeutralPodestavbaChange(seg.id, podSelect.value);
      });
      podLabel.appendChild(podSelect);
      extra.appendChild(podLabel);

      const shelfLabel = document.createElement('label');
      shelfLabel.className = 'extra-field extra-checkbox';
      const shelfCheckbox = document.createElement('input');
      shelfCheckbox.type = 'checkbox';
      shelfCheckbox.checked = !!seg.hasShelf;
      shelfCheckbox.addEventListener('click', (ev) => ev.stopPropagation());
      shelfCheckbox.addEventListener('change', () => {
        callbacks.onNeutralShelfChange(seg.id, shelfCheckbox.checked);
      });
      shelfLabel.appendChild(shelfCheckbox);
      shelfLabel.appendChild(document.createTextNode(` ${t('field.hasShelf')}`));
      extra.appendChild(shelfLabel);

      const panelLabel = document.createElement('label');
      panelLabel.className = 'extra-field extra-checkbox';
      const panelCheckbox = document.createElement('input');
      panelCheckbox.type = 'checkbox';
      panelCheckbox.checked = !!seg.hasPanel;
      panelCheckbox.addEventListener('click', (ev) => ev.stopPropagation());
      panelCheckbox.addEventListener('change', () => {
        callbacks.onNeutralPanelChange(seg.id, panelCheckbox.checked);
      });
      panelLabel.appendChild(panelCheckbox);
      panelLabel.appendChild(document.createTextNode(` ${t('field.hasPanel')}`));
      extra.appendChild(panelLabel);

      appendPlinthFinishFields(extra, seg);
    } else if (seg.type === DRAWERS_TYPE) {
      // §Zásuvky GN 1/1 — šířka je vždy pevná (400 mm, žádné pole pro
      // šířku); s panelem je počet zásuvek vynuceně 2, jinak volba 2/3.
      extra = document.createElement('div');
      extra.className = 'strip-detail-grid';

      const panelLabel = document.createElement('label');
      panelLabel.className = 'extra-field extra-checkbox';
      const panelCheckbox = document.createElement('input');
      panelCheckbox.type = 'checkbox';
      panelCheckbox.checked = !!seg.hasPanel;
      panelCheckbox.addEventListener('click', (ev) => ev.stopPropagation());
      panelCheckbox.addEventListener('change', () => {
        callbacks.onDrawersPanelChange(seg.id, panelCheckbox.checked);
      });
      panelLabel.appendChild(panelCheckbox);
      panelLabel.appendChild(document.createTextNode(` ${t('field.hasPanel')}`));
      extra.appendChild(panelLabel);

      const countLabel = document.createElement('label');
      countLabel.className = 'extra-field';
      countLabel.textContent = t('field.drawerCount');
      if (seg.hasPanel) {
        // s panelem je počet vždy pevně 2 — jen zobrazit, ne nabízet volbu
        const countText = document.createElement('span');
        countText.className = 'extra-static';
        countText.textContent = '2';
        countLabel.appendChild(countText);
      } else {
        const countSelect = document.createElement('select');
        DRAWER_COUNT_OPTIONS.forEach((value) => {
          const opt = document.createElement('option');
          opt.value = String(value);
          opt.textContent = String(value);
          if (getSegmentDrawerCount(seg) === value) opt.selected = true;
          countSelect.appendChild(opt);
        });
        countSelect.addEventListener('click', (ev) => ev.stopPropagation());
        countSelect.addEventListener('change', () => {
          callbacks.onDrawersCountChange(seg.id, Number(countSelect.value));
        });
        countLabel.appendChild(countSelect);
      }
      extra.appendChild(countLabel);

      appendPlinthFinishFields(extra, seg);
    } else if (seg.type === CUSTOM_TYPE) {
      extra = document.createElement('div');
      extra.className = 'strip-detail-grid';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'action-btn';
      editBtn.textContent = t('common.editEllipsis');
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        callbacks.onEditCustom(seg.id);
      });
      extra.appendChild(editBtn);

      appendPlinthFinishFields(extra, seg);
    } else {
      // katalogový přístroj — šířka podestavby je vlastní instance (§7.4
      // SPEC v3); hloubka podestavby je od §11.1 SPEC v4 jednotná pro celou
      // stranu (odvozená z hloubky bloku), takže se tu už nenastavuje.
      const def = getCatalogEntry(seg.type);
      if (def) {
        extra = document.createElement('div');
        extra.className = 'strip-detail-grid';

        const isSink = def.topFeature && def.topFeature.type === 'sink';
        const minWidth = isSink && seg.vatWidthMM ? seg.vatWidthMM + SINK_WIDTH_MARGIN_MM : def.minWidthMM;

        const widthLabel = document.createElement('label');
        widthLabel.className = 'extra-field';
        widthLabel.textContent = t('field.width');
        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.min = String(minWidth);
        widthInput.max = String(CATALOG_WIDTH_MAX);
        widthInput.step = String(CATALOG_WIDTH_STEP);
        widthInput.value = String(getSegmentWidthMM(seg));
        widthInput.addEventListener('click', (ev) => ev.stopPropagation());
        widthInput.addEventListener('change', () => {
          callbacks.onCatalogWidthChange(seg.id, Number(widthInput.value));
        });
        widthLabel.appendChild(widthInput);
        extra.appendChild(widthLabel);

        // §10.2 SPEC v4 — styl podestavby omezený na povolené typy přístroje;
        // je-li povolený jen jeden, zobrazí se prostý text místo selectu.
        const allowedStyles = Array.isArray(def.allowedBodyStyles) && def.allowedBodyStyles.length
          ? def.allowedBodyStyles
          : ['closed'];
        const styleLabel = document.createElement('label');
        styleLabel.className = 'extra-field';
        styleLabel.textContent = t('field.baseType');
        if (allowedStyles.length > 1) {
          const styleSelect = document.createElement('select');
          allowedStyles.forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = BODY_STYLE_OPTIONS.includes(val) ? t(`bodyStyle.${val}`) : val;
            if (getSegmentBodyStyle(seg) === val) opt.selected = true;
            styleSelect.appendChild(opt);
          });
          styleSelect.addEventListener('click', (ev) => ev.stopPropagation());
          styleSelect.addEventListener('change', () => {
            callbacks.onCatalogBodyStyleChange(seg.id, styleSelect.value);
          });
          styleLabel.appendChild(styleSelect);
        } else {
          const styleText = document.createElement('span');
          styleText.className = 'extra-static';
          styleText.textContent = BODY_STYLE_OPTIONS.includes(allowedStyles[0]) ? t(`bodyStyle.${allowedStyles[0]}`) : allowedStyles[0];
          styleLabel.appendChild(styleText);
        }
        extra.appendChild(styleLabel);

        if (isSink) {
          const vatWidthLabel = document.createElement('label');
          vatWidthLabel.className = 'extra-field';
          vatWidthLabel.textContent = t('field.vatWidth');
          const vatWidthInput = document.createElement('input');
          vatWidthInput.type = 'number';
          vatWidthInput.min = String(SINK_VAT_WIDTH_MIN);
          vatWidthInput.max = String(SINK_VAT_WIDTH_MAX);
          vatWidthInput.step = String(SINK_VAT_WIDTH_STEP);
          vatWidthInput.value = String(seg.vatWidthMM);
          vatWidthInput.addEventListener('click', (ev) => ev.stopPropagation());
          vatWidthInput.addEventListener('change', () => {
            callbacks.onSinkVatWidthChange(seg.id, Number(vatWidthInput.value));
          });
          vatWidthLabel.appendChild(vatWidthInput);
          extra.appendChild(vatWidthLabel);

          const vatDepthLabel = document.createElement('label');
          vatDepthLabel.className = 'extra-field';
          vatDepthLabel.textContent = t('field.vatDepth');
          const vatDepthInput = document.createElement('input');
          vatDepthInput.type = 'number';
          vatDepthInput.min = String(SINK_VAT_DEPTH_MIN);
          vatDepthInput.max = String(SINK_VAT_DEPTH_MAX);
          vatDepthInput.step = String(SINK_VAT_DEPTH_STEP);
          vatDepthInput.value = String(seg.vatDepthMM);
          vatDepthInput.addEventListener('click', (ev) => ev.stopPropagation());
          vatDepthInput.addEventListener('change', () => {
            callbacks.onSinkVatDepthChange(seg.id, Number(vatDepthInput.value));
          });
          vatDepthLabel.appendChild(vatDepthInput);
          extra.appendChild(vatDepthLabel);
        }

        appendPlinthFinishFields(extra, seg);
      }
    }

    return extra;
  }

  // --- ramena jako karty v pásu (krok 3B redesignu) ----------------------------------
  // Ramena teď žijí ve stejném <ol id="strip-cards"> jako segmenty (§5.2 zadání) —
  // vlastní výběr (selectedArmId) drží tato closure, main.js o něm neví (ramena
  // se ve 3D scéně nevybírají).

  /** Jedno pole s číslem + posuvníkem, které se navzájem sladí při `input`
   *  a volají totéž zpětné volání (stejný vzor jako dřívější renderArmItem,
   *  jen v novém rozložení — §5.3 zadání). Jednotka jde za dvojici. */
  function renderArmRangeField(labelText, min, max, step, value, unit, onChange) {
    const label = document.createElement('label');
    label.className = 'extra-field';
    label.textContent = labelText;

    const row = document.createElement('div');
    row.className = 'range-row';

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = String(min);
    numInput.max = String(max);
    numInput.step = String(step);
    numInput.value = String(value);
    numInput.addEventListener('click', (ev) => ev.stopPropagation());

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.addEventListener('click', (ev) => ev.stopPropagation());

    numInput.addEventListener('input', () => {
      slider.value = numInput.value;
      onChange(Number(numInput.value));
    });
    slider.addEventListener('input', () => {
      numInput.value = slider.value;
      onChange(Number(slider.value));
    });

    row.appendChild(numInput);
    row.appendChild(slider);

    const unitSpan = document.createElement('span');
    unitSpan.className = 'dim-unit';
    unitSpan.textContent = unit;
    row.appendChild(unitSpan);

    label.appendChild(row);
    return label;
  }

  /** Mřížka tří parametrů ramene (§5.3 zadání) — meze a výchozí hodnoty se
   *  berou ze konstant importovaných z ./arms.js, žádná čísla natvrdo.
   *  onArm*Change v main.js volají jen rebuildScene(), ne ui.render(state)
   *  (aby tažení posuvníku nepřišlo o focus) — souhrn na kartě ramene by tak
   *  zůstal zastaralý až do příštího plného překreslení. Proto po každém
   *  zpětném volání ještě ručně dotáhneme text karty přes refreshArmCardSummary
   *  — volá se AŽ PO zpětném volání, protože to teprve ořízne hodnotu do mezí
   *  a zapíše ji do stejného objektu `arm`, na který tu držíme odkaz. */
  function renderArmDetailGrid(arm, lengthMM, variant) {
    const grid = document.createElement('div');
    grid.className = 'strip-detail-grid arm-grid';

    grid.appendChild(renderArmRangeField(
      t('arms.posLabel'), 0, lengthMM, 10, arm.positionXMM, 'mm',
      (v) => { callbacks.onArmPositionChange(arm.id, v); refreshArmCardSummary(arm); },
    ));

    const isIsland = variant === 'island';
    const offsetMin = isIsland ? ARM_CENTER_OFFSET_MIN : ARM_BACK_OFFSET_MIN;
    const offsetMax = isIsland ? ARM_CENTER_OFFSET_MAX : ARM_BACK_OFFSET_MAX;
    const offsetDefault = isIsland ? ARM_CENTER_OFFSET_DEFAULT : ARM_BACK_OFFSET_DEFAULT;
    const offsetLabelText = isIsland ? t('arms.offsetCenterLabel') : t('arms.offsetBackLabel');
    const offsetValue = arm.offsetMM != null ? arm.offsetMM : offsetDefault;
    grid.appendChild(renderArmRangeField(
      offsetLabelText, offsetMin, offsetMax, ARM_OFFSET_STEP, offsetValue, 'mm',
      (v) => { callbacks.onArmOffsetChange(arm.id, v); refreshArmCardSummary(arm); },
    ));

    grid.appendChild(renderArmRangeField(
      t('arms.angleLabel'), ARM_ANGLE_MIN, ARM_ANGLE_MAX, 1, arm.angleDeg, '°',
      (v) => { callbacks.onArmAngleChange(arm.id, v); refreshArmCardSummary(arm); },
    ));

    return grid;
  }

  /** Aktualizuje jen text souhrnu na kartě daného ramene v pásu, bez
   *  překreslení zbytku pásu (viz komentář u renderArmDetailGrid výše). */
  function refreshArmCardSummary(arm) {
    if (!els.stripCards) return;
    const el = els.stripCards.querySelector(
      `.strip-card-arm[data-arm-id="${arm.id}"] .strip-card-width`);
    if (el) el.textContent = t('arms.cardSummary', { mm: arm.positionXMM, deg: arm.angleDeg });
  }

  /** Karta jednoho ramene v pásu (§5.2 zadání) — bez šipek přesunu (pořadí
   *  ramen nemá význam), pevná šířka 132 px. */
  function renderArmCard(arm) {
    const li = document.createElement('li');
    li.className = 'strip-card strip-card-arm';
    if (arm.id === selectedArmId) li.classList.add('selected');
    li.dataset.armId = String(arm.id);
    li.style.width = '132px';

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'strip-card-body';
    body.addEventListener('click', () => {
      selectedArmId = arm.id;
      if (lastStripState) renderStrip(lastStripState);
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'strip-card-name';
    nameSpan.textContent = t('arms.itemTitle', { id: arm.id });
    body.appendChild(nameSpan);

    const widthSpan = document.createElement('span');
    widthSpan.className = 'strip-card-width';
    widthSpan.textContent = t('arms.cardSummary', { mm: arm.positionXMM, deg: arm.angleDeg });
    body.appendChild(widthSpan);

    li.appendChild(body);
    return li;
  }

  /** Karta „+ rameno" na konci řady (§5.2 zadání). */
  function renderAddArmCard() {
    const li = document.createElement('li');
    li.className = 'strip-card strip-card-add';

    const body = document.createElement('button');
    body.type = 'button';
    body.className = 'strip-card-body';
    body.title = t('arms.addBtn');
    body.setAttribute('aria-label', t('arms.addBtn'));
    body.addEventListener('click', () => callbacks.onAddArm());
    body.innerHTML = PLUS_ICON_SVG;

    const label = document.createElement('span');
    label.textContent = t('arms.addShort');
    body.appendChild(label);

    li.appendChild(body);
    return li;
  }

  /** Sladí selectedArmId se skutečným seznamem ramen (§5.4 zadání): po přidání
   *  vybere nově přidané (nejvyšší id mezi nově objevenými), po smazání nebo
   *  při otevření záložky s neplatným výběrem vybere první, nebo null, když
   *  ramena nejsou žádná. Volá se při KAŽDÉM překreslení pásu, ne jen na
   *  záložce ramen, aby prevArmIds zůstal spolehlivě v kroku. */
  function reconcileArmSelection(arms) {
    const currentIds = arms.map((a) => a.id);
    if (prevArmIds) {
      const addedIds = currentIds.filter((id) => !prevArmIds.has(id));
      if (addedIds.length) {
        selectedArmId = Math.max(...addedIds);
      }
    }
    prevArmIds = new Set(currentIds);
    if (!arms.some((a) => a.id === selectedArmId)) {
      selectedArmId = arms.length ? arms[0].id : null;
    }
  }

  // --- pás sestavy (krok 3A redesignu) ----------------------------------------------
  // renderStrip(state) nahrazuje dřívější dvojí renderSide('A'/'B', …) — viz §3.8
  // zadání. Rozdělené na dílčí funkce (záložky / kapacita / karty / detail), ale
  // volané vždy dohromady z jednoho místa, aby zůstal jasný pořadí kroků popsaný
  // v §3.3 (nejdřív sladit activeTab se stavem, pak teprve kreslit).

  /** Popisek + aria-expanded tlačítka srolování pásu (§3.7). Volá se jak po
   *  kliknutí na tlačítko, tak při každém render(state) (např. kvůli jazyku). */
  function renderStripCollapseButton() {
    if (!els.stripCollapse || !els.assemblyStrip) return;
    els.assemblyStrip.classList.toggle('collapsed', collapsed);
    const label = t(collapsed ? 'strip.expand' : 'strip.collapse');
    els.stripCollapse.title = label;
    els.stripCollapse.setAttribute('aria-label', label);
    els.stripCollapse.setAttribute('aria-expanded', String(!collapsed));
    els.stripCollapse.textContent = collapsed ? '▴' : '▾';
  }

  /** Záložky pásu — sada podle varianty bloku (§3.3). Klik na 'A'/'B' mění
   *  EDITOVANOU stranu (callbacks.onEditSideChange) a zároveň otočí kameru;
   *  klik na 'arms' mění jen activeTab, kameru nechává na pokoji. */
  function renderStripTabs(isIsland) {
    if (!els.stripTabs) return;
    const tabs = isIsland
      ? [
        { key: 'A', label: t('side.sideA') },
        { key: 'B', label: t('side.sideB') },
        { key: 'arms', label: t('arms.sectionTitle') },
      ]
      : [
        { key: 'A', label: t('side.segments') },
        { key: 'arms', label: t('arms.sectionTitle') },
      ];

    els.stripTabs.innerHTML = '';
    tabs.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'strip-tab';
      btn.setAttribute('role', 'tab');
      const isActive = activeTab === key;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.textContent = label;
      if (key === 'A' || key === 'B') {
        btn.title = t('strip.editSideTitle', { side: key });
      }
      btn.addEventListener('click', () => {
        if (key === 'A' || key === 'B') {
          activeTab = key;
          // záložka mění EDITOVANOU stranu a zároveň otočí kameru (na rozdíl
          // od A/B v horní liště, které mění jen pohled) — viz zadání §2.
          callbacks.onEditSideChange(key, { turnCamera: true });
        } else {
          activeTab = 'arms';
          if (lastStripState) renderStrip(lastStripState);
        }
      });
      els.stripTabs.appendChild(btn);
    });
  }

  /** Kapacitní hláška v hlavičce pásu — pro aktivní stranu, prázdná u záložky ramen. */
  function renderStripCapacity(state) {
    if (!els.stripCapacity) return;
    if (activeTab === 'arms') {
      els.stripCapacity.textContent = '';
      els.stripCapacity.classList.remove('over');
      return;
    }
    const capacity = activeTab === 'B' ? state.capacityB : state.capacityA;
    const { usedMM, capacityMM } = capacity;
    els.stripCapacity.textContent = t('capacity.hint', { used: usedMM, total: capacityMM });
    els.stripCapacity.classList.toggle('over', usedMM > capacityMM);
  }

  /** Řada karet aktivní strany (§3.4), nebo karty ramen + karta pro přidání na
   *  záložce ramen (§5.2). Odrolování vybrané karty do záběru se dělá jen při
   *  SKUTEČNÉ změně selectedId (§6 bod 6), ne při každém překreslení — o to se
   *  stará volající renderStrip() přes `selectionChanged`. */
  function renderStripCards(state, selectionChanged) {
    if (!els.stripCards || !els.stripEmpty) return;

    if (activeTab === 'arms') {
      els.stripCards.hidden = false;
      els.stripEmpty.hidden = true;
      els.stripCards.innerHTML = '';
      state.arms.forEach((arm) => {
        els.stripCards.appendChild(renderArmCard(arm));
      });
      els.stripCards.appendChild(renderAddArmCard());
      return;
    }

    els.stripCards.hidden = false;
    const segments = activeTab === 'B' ? state.segmentsB : state.segmentsA;
    const capacity = activeTab === 'B' ? state.capacityB : state.capacityA;
    const fitMap = new Map(capacity.results.map((r) => [r.id, r]));

    els.stripCards.innerHTML = '';
    els.stripEmpty.hidden = segments.length !== 0;
    if (segments.length === 0) {
      els.stripEmpty.textContent = t('side.emptyHint');
    }
    segments.forEach((seg, index) => {
      const fitInfo = fitMap.get(seg.id) || { fits: true };
      const card = renderSegmentCard(seg, state, fitInfo);
      // Ovládání prohození (úkol 5, varianta A3) sedí v mezeře mezi kartami —
      // je DÍTĚTEM levé karty páru (ta má position:relative), `left:100%`
      // v CSS ho posadí přesně na hranici. Před první ani za poslední kartou
      // žádné není (proto index < length - 1). Stejná komponenta jako
      // .strip-swap v mono-ui.js, viz renderSwapControl výše.
      if (index < segments.length - 1) {
        card.appendChild(renderSwapControl(t('strip.swapNeighbors'), () => callbacks.onMoveSegment(seg.id, 1)));
      }
      els.stripCards.appendChild(card);
    });

    if (selectionChanged && state.selectedId != null) {
      const card = Array.from(els.stripCards.children)
        .find((li) => li.dataset.id === String(state.selectedId));
      if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /** Pruh s detailem — společné záhlaví (§4) nad mřížkou parametrů, jak pro
   *  vybraný segment (§3.6), tak pro vybrané rameno (§5.3). #strip-detail je
   *  nově vidět vždy (žádné přepínání hidden mezi segmenty a rameny). */
  function renderStripDetail(state) {
    if (!els.stripDetail) return;

    els.stripDetail.innerHTML = '';

    if (activeTab === 'arms') {
      const arm = state.arms.find((a) => a.id === selectedArmId);
      if (!arm) {
        const hint = document.createElement('p');
        hint.className = 'strip-detail-hint';
        hint.textContent = t('arms.emptyHint');
        els.stripDetail.appendChild(hint);
        return;
      }

      els.stripDetail.appendChild(renderDetailHead(
        t('arms.itemTitle', { id: arm.id }),
        () => callbacks.onRemoveArm(arm.id),
        t('arms.remove'),
      ));
      els.stripDetail.appendChild(renderArmDetailGrid(arm, state.dimensions.lengthMM, state.variant));
      return;
    }

    const segments = activeTab === 'B' ? state.segmentsB : state.segmentsA;
    const seg = segments.find((s) => s.id === state.selectedId);
    if (!seg) {
      const hint = document.createElement('p');
      hint.className = 'strip-detail-hint';
      hint.textContent = t('strip.detailHint');
      els.stripDetail.appendChild(hint);
      return;
    }

    els.stripDetail.appendChild(renderDetailHead(
      getSegmentLabel(seg),
      () => callbacks.onRemoveSegment(seg.id),
      t('segment.remove'),
    ));
    const grid = renderSegmentDetail(seg);
    if (grid) els.stripDetail.appendChild(grid);
  }

  /** Vykreslí celý pás sestavy — záložky, kapacitu, karty a detail (§3.3–§3.8).
   *  U MONO se hned na začátku přepne na mono-ui.js (§8 bod 3 zadání) a funkce
   *  skončí — zbytek dole je výhradně SEGMENT a MONO se ho nesmí dotknout. */
  function renderStrip(state) {
    // lastStripState se nastavuje bez ohledu na typ produktu — čte ho i
    // handler tlačítka „Nový projekt" (viz newProjectBtn výše), ať MONO
    // nezůstane s hodnotou null jen kvůli dřívějšímu návratu níže.
    lastStripState = state;

    const isMono = currentProductType === 'mono';
    els.assemblyStrip.classList.toggle('strip-mono', isMono);
    if (els.stripBody) els.stripBody.hidden = isMono;
    if (els.monoStripBody) els.monoStripBody.hidden = !isMono;
    if (els.stripCapacity) els.stripCapacity.hidden = isMono;
    if (isMono) { getMonoStrip().render(state); return; }

    const isIsland = state.variant === 'island';

    // activeTab (mimo 'arms') se vždy řídí EDITOVANOU stranou — pohled
    // kamery (state.currentSide) na aktivní záložku nemá vliv (viz zadání §2).
    if (activeTab !== 'arms') activeTab = state.editSide;

    if (!isIsland && activeTab === 'B') activeTab = 'A';

    // rule §3.3 odst. 3 — kliknutí do 3D scény (změna selectedId) otevře
    // záložku strany, na které vybraný segment leží, a přepne i editovanou
    // stranu — ale NEOTOČÍ kameru (§6 bod 2). Podmínka `target !== state.editSide`
    // zároveň brání zacyklení: onEditSideChange níže volá ui.render(state), který
    // zavolá renderStrip znovu — při tom druhém průchodu už target === state.editSide,
    // takže se podruhé nic nevolá.
    const selectionChanged = state.selectedId !== prevSelectedId;
    if (selectionChanged && state.selectedId != null) {
      const inA = state.segmentsA.some((s) => s.id === state.selectedId);
      const inB = isIsland && state.segmentsB.some((s) => s.id === state.selectedId);
      const target = inA ? 'A' : (inB ? 'B' : null);
      if (target && target !== state.editSide) {
        activeTab = target;
        callbacks.onEditSideChange(target, { turnCamera: false });
      } else if (target) {
        activeTab = target;
      }
    }
    prevSelectedId = state.selectedId;

    if (!isIsland && activeTab === 'B') activeTab = 'A'; // §3.3 poslední odstavec

    // výběr ramene (§5.4) — udržuje se při KAŽDÉM překreslení, ne jen na
    // záložce ramen, ať prevArmIds zůstane spolehlivě v kroku.
    reconcileArmSelection(state.arms);

    renderStripTabs(isIsland);
    renderStripCapacity(state);
    renderStripCards(state, selectionChanged);
    renderStripDetail(state);
    renderStripCollapseButton();
  }

  /** Znovu vykreslí dynamické části panelu podle aktuálního stavu aplikace. */
  function render(state) {
    const isIsland = state.variant === 'island';

    // název projektu — přepiš jen když uživatel zrovna nepíše (stejná pojistka
    // jako u polí rozměrů níže), viz §4.2 zadání.
    if (els.projectName && document.activeElement !== els.projectName) {
      els.projectName.value = state.projectName || '';
    }

    // rozměry — vstupy (jen pokud uživatel zrovna nepíše, jinak by skákala hodnota)
    if (document.activeElement !== els.inputLength) els.inputLength.value = String(state.dimensions.lengthMM);
    if (document.activeElement !== els.inputHeight) els.inputHeight.value = String(state.dimensions.heightMM);
    if (document.activeElement !== els.inputDepthA) els.inputDepthA.value = String(state.dimensions.depthAMM);
    if (document.activeElement !== els.inputDepthB) els.inputDepthB.value = String(state.dimensions.depthBMM);
    els.variantSingle.checked = state.variant === 'single';
    els.variantIsland.checked = state.variant === 'island';

    els.depthALabel.textContent = isIsland ? t('field.depthAShort') : t('field.depthShort');
    els.depthBRow.hidden = !isIsland;

    // aktivní tlačítko pohledu (§1A) — je-li otevřený tiskový dokument, žádný
    // pohled se nezvýrazňuje a aktivní vzhled má místo toho #floorplan-btn
    // (chová se jako čtvrtý pohled ve skupině); stejný mechanismus (.active),
    // jaký už používají tlačítka strany bloku a prostředí níže.
    els.viewButtons.forEach((btn) => {
      btn.classList.toggle('active', !state.floorplanOpen && btn.dataset.view === state.currentViewName);
    });
    if (els.floorplanBtn) {
      els.floorplanBtn.classList.toggle('active', !!state.floorplanOpen);
    }

    // přepínač strany bloku A/B v liště — jen u ostrova; popisek tlačítka
    // čelního pohledu se podle varianty mění na „Strana" (viz zadání §STŘED)
    els.sideSwitch.hidden = !isIsland;
    els.sideButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.side === state.currentSide);
    });
    if (frontViewBtn) {
      // popisek tlačítka čelního pohledu (ikona zůstává stejná — jen se
      // mění title/aria-label, viz ZMĚNA 2): jednostranný blok = „Front",
      // ostrovní blok = „Side" (dívá se buď na stranu A, nebo B)
      const frontLabel = t(isIsland ? 'view.side' : 'view.front');
      frontViewBtn.title = frontLabel;
      frontViewBtn.setAttribute('aria-label', frontLabel);
    }

    // poznámka o automatickém zvětšení hloubky strany kvůli hlubšímu segmentu (§7.3)
    const grownA = !!state.builtDimensions.depthGrownA;
    els.depthAGrowNote.hidden = !grownA;
    if (grownA) {
      const reasons = (state.builtDimensions.depthReasonsA || []).join(', ');
      els.depthAGrowNote.textContent = t('notice.depthGrown', { mm: state.builtDimensions.depthAMM, reasons });
    }
    const grownB = isIsland && !!state.builtDimensions.depthGrownB;
    els.depthBGrowNote.hidden = !grownB;
    if (grownB) {
      const reasons = (state.builtDimensions.depthReasonsB || []).join(', ');
      els.depthBGrowNote.textContent = t('notice.depthGrown', { mm: state.builtDimensions.depthBMM, reasons });
    }

    // tichá řádka s celkovou hloubkou (A + B) — jen u ostrova, jediná odvozená
    // hodnota rozměrů bloku, kterou nelze prostě opsat ze vstupu (§2.3 zadání)
    els.dimsTotalDepth.hidden = !isIsland;
    if (isIsland) {
      els.dimsTotalDepth.textContent = t('dims.totalDepthLine', { mm: state.builtDimensions.depthMM });
    }

    // pás sestavy (krok 3A redesignu) — nahrazuje dřívější dvojí renderSide('A'/'B')
    renderStrip(state);

    // paleta prvků (krok 2 redesignu) — čte kapacitu cílové strany ze state,
    // proto se volá až po renderStrip výše
    renderPalette(state);

    // aktivní tlačítko prostředí
    els.envButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.env === state.environment);
    });
  }

  return {
    render,
    // --- úvodní obrazovka a odznak typu bloku (rozhraní proti main.js) -------
    // main.js volá showStartScreen() bez argumentů jen při úplném startu
    // aplikace (není co obnovit) — proto NEzavíratelně (§komentář výše).
    showStartScreen() {
      openStartScreen(false);
    },
    hideStartScreen() {
      setStartScreenCloseable(false);
      if (els.startScreenOverlay) els.startScreenOverlay.hidden = true;
    },
    setProductType(type) {
      // reset() shazuje lokální stav pásu MONO (aktivní záložka, výběr) —
      // smí se zavolat jen při SKUTEČNÉ změně typu (§8 bod 4 zadání), jinak
      // by každé volání se stejným typem uživateli zahodilo rozpracovaný
      // výběr v pásu (setProductType volá main.js po každém rebuildBlock()).
      const changed = type !== currentProductType;
      currentProductType = type;
      renderProductTypeChip();
      if (changed) monoStrip?.reset();
    },
  };
}
