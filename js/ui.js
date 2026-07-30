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

export function setupUI(callbacks) {
  const els = {
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
    dimLength: document.getElementById('dim-length'),
    dimDepth: document.getElementById('dim-depth'),
    dimDepthBreakdown: document.getElementById('dim-depth-breakdown'),
    dimHeight: document.getElementById('dim-height'),

    sideBSection: document.getElementById('side-b-section'),
    sideATitle: document.getElementById('side-a-title'),

    armList: document.getElementById('arm-list'),
    armEmptyHint: document.getElementById('arm-empty-hint'),
    addArmBtn: document.getElementById('add-arm-btn'),

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

  const sides = {
    A: {
      capacityHint: document.getElementById('capacity-hint-a'),
      segmentList: document.getElementById('segment-list-a'),
      emptyHint: document.getElementById('empty-hint-a'),
      addButtons: document.getElementById('add-buttons-a'),
      addNeutralBtn: document.getElementById('add-neutral-btn-a'),
      addDrawersBtn: document.getElementById('add-drawers-btn-a'),
      addCustomBtn: document.getElementById('add-custom-btn-a'),
      catalogButtons: [],
    },
    B: {
      capacityHint: document.getElementById('capacity-hint-b'),
      segmentList: document.getElementById('segment-list-b'),
      emptyHint: document.getElementById('empty-hint-b'),
      addButtons: document.getElementById('add-buttons-b'),
      addNeutralBtn: document.getElementById('add-neutral-btn-b'),
      addDrawersBtn: document.getElementById('add-drawers-btn-b'),
      addCustomBtn: document.getElementById('add-custom-btn-b'),
      catalogButtons: [],
    },
  };

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

  // --- katalog přístrojů (jen visible=true) — tlačítka pro obě strany zvlášť ----
  // Znovu se vykreslují při každém render() (ne jen jednou při startu), aby se
  // katalog projevil hned i po importu JSON konfigurace s vlastními přístroji.
  function rebuildCatalogButtons(side) {
    const s = sides[side];
    s.addButtons.innerHTML = '';
    s.catalogButtons = [];
    getCatalogVisible().forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'add-btn';
      const widthText = def.widthAdjustable
        ? t('catalog.widthFrom', { mm: def.minWidthMM })
        : t('catalog.widthExact', { mm: def.widthMM });
      btn.textContent = t('catalog.addButtonLabel', { name: getEntryDisplayName(def), width: widthText });
      btn.addEventListener('click', () => callbacks.onAddInstrument(side, def.id));
      s.addButtons.appendChild(btn);
      s.catalogButtons.push(btn);
    });
  }

  sides.A.addNeutralBtn.addEventListener('click', () => callbacks.onAddNeutral('A'));
  sides.A.addDrawersBtn.addEventListener('click', () => callbacks.onAddDrawers('A'));
  sides.A.addCustomBtn.addEventListener('click', () => callbacks.onOpenCustomNew('A'));
  sides.B.addNeutralBtn.addEventListener('click', () => callbacks.onAddNeutral('B'));
  sides.B.addDrawersBtn.addEventListener('click', () => callbacks.onAddDrawers('B'));
  sides.B.addCustomBtn.addEventListener('click', () => callbacks.onOpenCustomNew('B'));

  // --- katalog přístrojů — Správce přístrojů (SPEC v3 §3.4) ---------------------
  els.deviceManagerBtn.addEventListener('click', () => callbacks.onOpenDeviceManager());

  // --- napouštěcí ramena ---------------------------------------------------------
  els.addArmBtn.addEventListener('click', () => callbacks.onAddArm());

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

  // --- vykreslení jedné položky segmentu -------------------------------------------
  function renderSegmentItem(seg, index, total, state, fitInfo) {
    const li = document.createElement('li');
    li.className = 'module-item';
    if (seg.id === state.selectedId) li.classList.add('selected');
    if (!fitInfo.fits) li.classList.add('overflow');
    li.dataset.id = String(seg.id);

    const row = document.createElement('div');
    row.className = 'module-row';

    const info = document.createElement('div');
    info.className = 'module-info';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'module-name';
    nameSpan.textContent = getSegmentLabel(seg);
    const widthSpan = document.createElement('span');
    widthSpan.className = 'module-width';
    widthSpan.textContent = t('segment.width', { mm: getSegmentWidthMM(seg) }) + (fitInfo.fits ? '' : t('segment.overflowSuffix'));
    info.appendChild(nameSpan);
    info.appendChild(widthSpan);

    const controls = document.createElement('div');
    controls.className = 'module-controls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.title = t('segment.moveLeft');
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onMoveSegment(seg.id, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.title = t('segment.moveRight');
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', (ev) => {
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

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(controls);
    row.addEventListener('click', () => callbacks.onSelectSegment(seg.id));
    li.appendChild(row);

    // --- inline nastavení dle typu ------------------------------------------------
    if (seg.type === NEUTRAL_TYPE) {
      const extra = document.createElement('div');
      extra.className = 'module-extra';

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

      li.appendChild(extra);
    } else if (seg.type === DRAWERS_TYPE) {
      // §Zásuvky GN 1/1 — šířka je vždy pevná (400 mm, žádné pole pro
      // šířku); s panelem je počet zásuvek vynuceně 2, jinak volba 2/3.
      const extra = document.createElement('div');
      extra.className = 'module-extra';

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

      li.appendChild(extra);
    } else if (seg.type === CUSTOM_TYPE) {
      const extra = document.createElement('div');
      extra.className = 'module-extra';
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

      li.appendChild(extra);
    } else {
      // katalogový přístroj — šířka podestavby je vlastní instance (§7.4
      // SPEC v3); hloubka podestavby je od §11.1 SPEC v4 jednotná pro celou
      // stranu (odvozená z hloubky bloku), takže se tu už nenastavuje.
      const def = getCatalogEntry(seg.type);
      if (def) {
        const extra = document.createElement('div');
        extra.className = 'module-extra';

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

        li.appendChild(extra);
      }
    }

    return li;
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

  /** Vykreslí seznam segmentů + kapacitu jedné strany. */
  function renderSide(side, segments, capacity, state) {
    const s = sides[side];
    rebuildCatalogButtons(side);
    const { usedMM, capacityMM } = capacity;
    s.capacityHint.textContent = t('capacity.hint', { used: usedMM, total: capacityMM });
    s.capacityHint.classList.toggle('over', usedMM > capacityMM);

    const hasRoom = usedMM < capacityMM;
    s.catalogButtons.forEach((btn) => { btn.disabled = !hasRoom; });
    s.addNeutralBtn.disabled = !hasRoom;
    s.addDrawersBtn.disabled = !hasRoom;
    s.addCustomBtn.disabled = !hasRoom;

    s.segmentList.innerHTML = '';
    s.emptyHint.style.display = segments.length === 0 ? 'block' : 'none';
    const fitMap = new Map(capacity.results.map((r) => [r.id, r]));
    segments.forEach((seg, index) => {
      const fitInfo = fitMap.get(seg.id) || { fits: true };
      s.segmentList.appendChild(renderSegmentItem(seg, index, segments.length, state, fitInfo));
    });
  }

  /** Znovu vykreslí dynamické části panelu podle aktuálního stavu aplikace. */
  function render(state) {
    const isIsland = state.variant === 'island';

    // rozměry — vstupy (jen pokud uživatel zrovna nepíše, jinak by skákala hodnota)
    if (document.activeElement !== els.inputLength) els.inputLength.value = String(state.dimensions.lengthMM);
    if (document.activeElement !== els.inputHeight) els.inputHeight.value = String(state.dimensions.heightMM);
    if (document.activeElement !== els.inputDepthA) els.inputDepthA.value = String(state.dimensions.depthAMM);
    if (document.activeElement !== els.inputDepthB) els.inputDepthB.value = String(state.dimensions.depthBMM);
    els.variantSingle.checked = state.variant === 'single';
    els.variantIsland.checked = state.variant === 'island';

    els.depthALabel.textContent = isIsland ? t('field.depthA') : t('field.depth');
    els.depthBRow.hidden = !isIsland;
    els.sideBSection.hidden = !isIsland;
    els.sideATitle.textContent = isIsland ? t('side.sideA') : t('side.segments');

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

    els.dimLength.textContent = state.builtDimensions.lengthMM;
    els.dimDepth.textContent = state.builtDimensions.depthMM;
    els.dimHeight.textContent = state.builtDimensions.heightMM;
    if (isIsland) {
      els.dimDepthBreakdown.hidden = false;
      els.dimDepthBreakdown.textContent = t('dims.depthBreakdown', { a: state.builtDimensions.depthAMM, b: state.builtDimensions.depthBMM });
    } else {
      els.dimDepthBreakdown.hidden = true;
    }

    // strana A vždy, strana B jen u ostrova
    renderSide('A', state.segmentsA, state.capacityA, state);
    if (isIsland) {
      renderSide('B', state.segmentsB, state.capacityB, state);
    }

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
