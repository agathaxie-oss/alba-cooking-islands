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
import { t, getLang, setLang, onLangChange, LANGS } from './i18n.js';

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

    armList: document.getElementById('arm-list'),
    armEmptyHint: document.getElementById('arm-empty-hint'),
    addArmBtn: document.getElementById('add-arm-btn'),

    // --- pás sestavy (krok 3A redesignu) --------------------------------------
    assemblyStrip: document.getElementById('assembly-strip'),
    stripTabs: document.getElementById('strip-tabs'),
    stripCapacity: document.getElementById('strip-capacity'),
    stripCollapse: document.getElementById('strip-collapse'),
    stripCards: document.getElementById('strip-cards'),
    stripEmpty: document.getElementById('strip-empty'),
    stripDetail: document.getElementById('strip-detail'),
    stripArms: document.getElementById('strip-arms'),

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
    loadStorageBtn: document.getElementById('load-storage-btn'),
  };

  // --- pás sestavy (krok 3A redesignu) — stav záložky/srolování žije jen
  // v této closure, nikam se neukládá; `prevCurrentSide`/`prevSelectedId`
  // slouží k rozpoznání SKUTEČNÉ změny (viz §3.3 a §3.4 zadání) tak, aby se
  // pás uživateli neposouval/nepřepínal při každém překreslení. ----------------
  let activeTab = 'A'; // 'A' | 'B' | 'arms'
  let collapsed = false;
  let prevCurrentSide = null;
  let prevSelectedId; // sentinel (undefined) — první render se nepočítá za "změnu"
  let lastStripState = null;

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

  /** Překreslí jen obsah <ul id="palette-list"> podle aktuálního stavu
   *  aplikace a hodnoty vyhledávacího pole. Vyhledávací pole samo se
   *  nikdy nepřekresluje (uživatel by ztratil kurzor). */
  function renderPaletteList() {
    const state = lastPaletteState;
    if (!state || !paletteEls.list) return;

    const isIsland = state.variant === 'island';
    const targetSide = isIsland ? state.currentSide : 'A';

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
  // a vlaječky se berou přímo z i18n.js (LANGS/LANG_FLAGS), takže přidání
  // dalšího jazyka stačí udělat na jednom místě. Přepnutí ihned překreslí
  // celý panel přes onLangChange posluchač zaregistrovaný v main.js. -----------
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

  // --- napouštěcí ramena ---------------------------------------------------------
  els.addArmBtn.addEventListener('click', () => callbacks.onAddArm());

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
  els.loadStorageBtn.addEventListener('click', () => callbacks.onLoadStorage());

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
  // (§3.4 zadání). Přetahování se v této části NEDĚLÁ — pořadí mění jen ◀ ▶.
  function renderSegmentCard(seg, index, total, state, fitInfo) {
    const li = document.createElement('li');
    li.className = 'strip-card';
    if (seg.id === state.selectedId) li.classList.add('selected');
    if (!fitInfo.fits) li.classList.add('overflow');
    li.dataset.id = String(seg.id);

    const px = Math.round(Math.min(220, Math.max(88, getSegmentWidthMM(seg) / 6)));
    li.style.width = px + 'px';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'strip-card-name';
    nameSpan.textContent = getSegmentLabel(seg);
    li.appendChild(nameSpan);

    const widthSpan = document.createElement('span');
    widthSpan.className = 'strip-card-width';
    widthSpan.textContent = t('segment.width', { mm: getSegmentWidthMM(seg) }) + (fitInfo.fits ? '' : t('segment.overflowSuffix'));
    li.appendChild(widthSpan);

    const controls = document.createElement('div');
    controls.className = 'strip-card-controls';

    const leftBtn = document.createElement('button');
    leftBtn.type = 'button';
    leftBtn.textContent = '◀';
    leftBtn.title = t('segment.moveLeft');
    leftBtn.disabled = index === 0;
    leftBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onMoveSegment(seg.id, -1);
    });

    const rightBtn = document.createElement('button');
    rightBtn.type = 'button';
    rightBtn.textContent = '▶';
    rightBtn.title = t('segment.moveRight');
    rightBtn.disabled = index === total - 1;
    rightBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onMoveSegment(seg.id, 1);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.title = t('segment.remove');
    delBtn.className = 'del-btn';
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onRemoveSegment(seg.id);
    });

    controls.appendChild(leftBtn);
    controls.appendChild(rightBtn);
    controls.appendChild(delBtn);
    li.appendChild(controls);

    li.addEventListener('click', () => callbacks.onSelectSegment(seg.id));

    return li;
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

  // --- vykreslení jednoho ramene ----------------------------------------------------
  function renderArmItem(arm, lengthMM, variant) {
    const li = document.createElement('li');
    li.className = 'arm-item';

    const header = document.createElement('div');
    header.className = 'arm-header';
    const title = document.createElement('span');
    title.textContent = t('arms.itemTitle', { id: arm.id });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.title = t('arms.remove');
    delBtn.addEventListener('click', () => callbacks.onRemoveArm(arm.id));
    header.appendChild(title);
    header.appendChild(delBtn);
    li.appendChild(header);

    const posLabel = document.createElement('label');
    posLabel.className = 'extra-field';
    posLabel.textContent = t('field.positionX');
    const posRow = document.createElement('div');
    posRow.className = 'range-row';
    const posInput = document.createElement('input');
    posInput.type = 'number';
    posInput.min = '0';
    posInput.max = String(lengthMM);
    posInput.step = '10';
    posInput.value = String(arm.positionXMM);
    const posSlider = document.createElement('input');
    posSlider.type = 'range';
    posSlider.min = '0';
    posSlider.max = String(lengthMM);
    posSlider.step = '10';
    posSlider.value = String(arm.positionXMM);
    posInput.addEventListener('input', () => {
      posSlider.value = posInput.value;
      callbacks.onArmPositionChange(arm.id, Number(posInput.value));
    });
    posSlider.addEventListener('input', () => {
      posInput.value = posSlider.value;
      callbacks.onArmPositionChange(arm.id, Number(posSlider.value));
    });
    posRow.appendChild(posInput);
    posRow.appendChild(posSlider);
    posLabel.appendChild(posRow);
    li.appendChild(posLabel);

    // odsazení — u jednostranného bloku od zadní hrany, u ostrova od středu
    const isIsland = variant === 'island';
    const offsetMin = isIsland ? ARM_CENTER_OFFSET_MIN : ARM_BACK_OFFSET_MIN;
    const offsetMax = isIsland ? ARM_CENTER_OFFSET_MAX : ARM_BACK_OFFSET_MAX;
    const offsetDefault = isIsland ? ARM_CENTER_OFFSET_DEFAULT : ARM_BACK_OFFSET_DEFAULT;
    const offsetText = isIsland ? t('arms.offsetCenter') : t('arms.offsetBack');
    const offsetValue = arm.offsetMM != null ? arm.offsetMM : offsetDefault;

    const offsetLabel = document.createElement('label');
    offsetLabel.className = 'extra-field';
    offsetLabel.textContent = offsetText;
    const offsetRow = document.createElement('div');
    offsetRow.className = 'range-row';
    const offsetInput = document.createElement('input');
    offsetInput.type = 'number';
    offsetInput.min = String(offsetMin);
    offsetInput.max = String(offsetMax);
    offsetInput.step = String(ARM_OFFSET_STEP);
    offsetInput.value = String(offsetValue);
    const offsetSlider = document.createElement('input');
    offsetSlider.type = 'range';
    offsetSlider.min = String(offsetMin);
    offsetSlider.max = String(offsetMax);
    offsetSlider.step = String(ARM_OFFSET_STEP);
    offsetSlider.value = String(offsetValue);
    offsetInput.addEventListener('input', () => {
      offsetSlider.value = offsetInput.value;
      callbacks.onArmOffsetChange(arm.id, Number(offsetInput.value));
    });
    offsetSlider.addEventListener('input', () => {
      offsetInput.value = offsetSlider.value;
      callbacks.onArmOffsetChange(arm.id, Number(offsetSlider.value));
    });
    offsetRow.appendChild(offsetInput);
    offsetRow.appendChild(offsetSlider);
    offsetLabel.appendChild(offsetRow);
    li.appendChild(offsetLabel);

    const angleLabel = document.createElement('label');
    angleLabel.className = 'extra-field';
    angleLabel.textContent = t('arms.angle', { deg: arm.angleDeg });
    const angleSlider = document.createElement('input');
    angleSlider.type = 'range';
    angleSlider.min = String(ARM_ANGLE_MIN);
    angleSlider.max = String(ARM_ANGLE_MAX);
    angleSlider.step = '5';
    angleSlider.value = String(arm.angleDeg);
    angleSlider.addEventListener('input', () => {
      angleLabel.firstChild.textContent = t('arms.angle', { deg: angleSlider.value });
      callbacks.onArmAngleChange(arm.id, Number(angleSlider.value));
    });
    angleLabel.appendChild(angleSlider);
    li.appendChild(angleLabel);

    return li;
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

  /** Záložky pásu — sada podle varianty bloku (§3.3). Klik na 'A'/'B' je
   *  tentýž přepínač strany jako v horní liště (callbacks.onSideChange);
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
      btn.addEventListener('click', () => {
        if (key === 'A' || key === 'B') {
          activeTab = key;
          callbacks.onSideChange(key); // jeden zdroj pravdy se stranou v horní liště
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

  /** Řada karet aktivní strany (§3.4). U záložky ramen je celá schovaná. Odrolování
   *  vybrané karty do záběru se dělá jen při SKUTEČNÉ změně selectedId (§6 bod 6),
   *  ne při každém překreslení — o to se stará volající renderStrip() přes `selectionChanged`. */
  function renderStripCards(state, selectionChanged) {
    if (!els.stripCards || !els.stripEmpty) return;

    if (activeTab === 'arms') {
      els.stripCards.hidden = true;
      els.stripCards.innerHTML = '';
      els.stripEmpty.hidden = true;
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
      els.stripCards.appendChild(renderSegmentCard(seg, index, segments.length, state, fitInfo));
    });

    if (selectionChanged && state.selectedId != null) {
      const card = Array.from(els.stripCards.children)
        .find((li) => li.dataset.id === String(state.selectedId));
      if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /** Pruh s detailem (§3.5 pro záložku ramen, §3.6 pro vybraný segment).
   *  Prvky ramen (#arm-list, #arm-empty-hint, #add-arm-btn) žijí trvale uvnitř
   *  #strip-arms — NIKDY se nepřesouvají ani neodpojují z DOM (přesun by je na
   *  chvíli vyřadil z `document`, takže by je `applyTranslations()` v main.js
   *  po přepnutí jazyka nenašla, a `getElementById` by mezitím vracelo null).
   *  Mezi záložkami se přepíná jen `hidden` na #strip-detail / #strip-arms. */
  function renderStripDetail(state) {
    if (!els.stripDetail || !els.stripArms) return;

    if (activeTab === 'arms') {
      els.stripArms.hidden = false;
      els.stripDetail.hidden = true;
      return;
    }

    els.stripArms.hidden = true;
    els.stripDetail.hidden = false;

    const segments = activeTab === 'B' ? state.segmentsB : state.segmentsA;
    const seg = segments.find((s) => s.id === state.selectedId);
    const grid = seg ? renderSegmentDetail(seg) : null;

    els.stripDetail.innerHTML = '';
    if (grid) {
      els.stripDetail.appendChild(grid);
    } else {
      const hint = document.createElement('p');
      hint.className = 'strip-detail-hint';
      hint.textContent = t('strip.detailHint');
      els.stripDetail.appendChild(hint);
    }
  }

  /** Vykreslí celý pás sestavy — záložky, kapacitu, karty a detail (§3.3–§3.8). */
  function renderStrip(state) {
    lastStripState = state;
    const isIsland = state.variant === 'island';

    // rule §3.3 odst. 2 — přepínač strany v horní liště přepne i activeTab,
    // a to i když byla zrovna otevřená záložka ramen.
    if (prevCurrentSide !== null && state.currentSide !== prevCurrentSide) {
      activeTab = state.currentSide;
    }
    prevCurrentSide = state.currentSide;

    if (!isIsland && activeTab === 'B') activeTab = 'A';

    // rule §3.3 odst. 3 — kliknutí do 3D scény (změna selectedId) otevře
    // záložku strany, na které vybraný segment leží. NEVOLÁ onSideChange —
    // kamera se nesmí hnout jen kvůli výběru (§6 bod 2).
    const selectionChanged = state.selectedId !== prevSelectedId;
    if (selectionChanged && state.selectedId != null) {
      const inA = state.segmentsA.some((s) => s.id === state.selectedId);
      const inB = isIsland && state.segmentsB.some((s) => s.id === state.selectedId);
      if (inA) activeTab = 'A';
      else if (inB) activeTab = 'B';
    }
    prevSelectedId = state.selectedId;

    if (!isIsland && activeTab === 'B') activeTab = 'A'; // §3.3 poslední odstavec

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

    // seznam ramen
    els.armList.innerHTML = '';
    els.armEmptyHint.style.display = state.arms.length === 0 ? 'block' : 'none';
    state.arms.forEach((arm) => {
      els.armList.appendChild(renderArmItem(arm, state.dimensions.lengthMM, state.variant));
    });

    // aktivní tlačítko prostředí
    els.envButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.env === state.environment);
    });

    // tlačítko načtení uložené sestavy je aktivní jen pokud něco je uloženo
    els.loadStorageBtn.disabled = !localStorage.getItem(STORAGE_KEY);
  }

  return { render };
}
