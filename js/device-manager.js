// device-manager.js — dialog "Správce přístrojů" (SPEC v3 §3.4, §7.2;
// SPEC v4 §10 — topFixed, allowedBodyStyles, katalogové technické údaje).
// Zobrazí VŠECHNY přístroje z katalogu (vestavěné i vlastní), umožní přepínat
// viditelnost, duplikovat, mazat (jen vlastní) a UPRAVOVAT — od §7.2 lze
// plně upravit i vestavěné přístroje (název, min./výchozí šířku i hloubku,
// ovládací prvky…), jen je nelze smazat; „Obnovit výchozí" vrátí tovární
// hodnoty. Formulář nového/upraveného přístroje běží ve stejném overlay
// (přepnutí seznam <-> formulář), stejně jako to dělá custom-dialog.js pro
// vlastní modul.

import { CONTROL_TYPES, CATALOG_WIDTH_MAX, CUSTOM_CONTROLS_MAX } from './modules.js';
import {
  getCatalog, getEntryDisplayName, getEntryDescription, getEntryConstruction,
  upsert, remove, duplicate, setVisible, resetBuiltin,
} from './catalog.js';
import { t, onLangChange } from './i18n.js';

const MIN_WIDTH_FLOOR = 100;
const MIN_WIDTH_CEIL = 1200;
const MIN_DEPTH_FLOOR = 400;
const MIN_DEPTH_CEIL = 1200;

// typy prvku na desce (topFeature.type) — viz SPEC §3.1; popisek přes i18n klíč topFeature.<value>
const TOP_FEATURE_TYPES = ['none', 'burners4', 'ceramic4', 'induction', 'fryer1', 'fryer2', 'grill', 'bainmarie', 'multipan', 'sink', 'bitmap'];

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function generateId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Nastaví dialog Správce přístrojů. `onCatalogChanged` se zavolá po každé
 * změně katalogu (viditelnost, uložení, duplikace, smazání) — main.js na to
 * naváže překreslením bočního panelu (`ui.render(state)`), aby se sekce
 * „Přidat segment" ihned aktualizovala.
 */
export function setupDeviceManager(onCatalogChanged) {
  const els = {
    overlay: document.getElementById('device-manager-overlay'),
    listView: document.getElementById('device-manager-list-view'),
    list: document.getElementById('device-manager-list'),
    newBtn: document.getElementById('device-manager-new-btn'),
    closeBtn: document.getElementById('device-manager-close-btn'),

    formView: document.getElementById('device-manager-form-view'),
    formTitle: document.getElementById('device-manager-form-title'),
    builtinHint: document.getElementById('device-manager-builtin-hint'),
    resetRow: document.getElementById('device-manager-reset-row'),
    resetBtn: document.getElementById('device-manager-reset-btn'),
    name: document.getElementById('device-name'),
    minWidth: document.getElementById('device-min-width'),
    width: document.getElementById('device-width'),
    minDepth: document.getElementById('device-min-depth'),
    depth: document.getElementById('device-depth'),
    widthAdjustable: document.getElementById('device-width-adjustable'),
    topFeature: document.getElementById('device-top-feature'),
    bitmapInput: document.getElementById('device-bitmap'),
    preview: document.getElementById('device-bitmap-preview'),
    controlsCount: document.getElementById('device-controls-count'),
    controlsCountSlider: document.getElementById('device-controls-count-slider'),
    controlsType: document.getElementById('device-controls-type'),
    topFixed: document.getElementById('device-top-fixed'),
    styleClosed: document.getElementById('device-style-closed'),
    styleDoors: document.getElementById('device-style-doors'),
    styleOpen: document.getElementById('device-style-open'),
    catalogCode: document.getElementById('device-catalog-code'),
    powerKW: document.getElementById('device-power-kw'),
    voltage: document.getElementById('device-voltage'),
    gasKW: document.getElementById('device-gas-kw'),
    descriptionText: document.getElementById('device-description-text'),
    constructionText: document.getElementById('device-construction-text'),
    error: document.getElementById('device-manager-error'),
    formCancel: document.getElementById('device-manager-form-cancel'),
    formSave: document.getElementById('device-manager-form-save'),
  };

  // naplnění selectů — přeloží se znovu i při každé změně jazyka (viz
  // refreshTranslatedOptions níže), aby zůstaly volby vždy v aktuálním jazyce.
  function fillSelectOptions(selectEl, values, keyPrefix) {
    const prevValue = selectEl.value;
    selectEl.innerHTML = '';
    values.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = t(`${keyPrefix}.${value}`);
      selectEl.appendChild(opt);
    });
    if (prevValue) selectEl.value = prevValue;
  }
  function refreshTranslatedOptions() {
    fillSelectOptions(els.topFeature, TOP_FEATURE_TYPES, 'topFeature');
    fillSelectOptions(els.controlsType, CONTROL_TYPES, 'controlType');
  }
  refreshTranslatedOptions();

  // §10.2 SPEC v4 — checkboxy povolených stylů podestavby; alespoň jeden musí
  // zůstat zapnutý (revertuje se pokus o odškrtnutí posledního zapnutého).
  const styleCheckboxes = [
    { value: 'closed', el: els.styleClosed },
    { value: 'doors', el: els.styleDoors },
    { value: 'open', el: els.styleOpen },
  ];
  styleCheckboxes.forEach(({ el }) => {
    el.addEventListener('change', () => {
      const anyChecked = styleCheckboxes.some((s) => s.el.checked);
      if (!anyChecked) {
        el.checked = true; // alespoň jeden musí zůstat zapnutý
      }
    });
  });

  let editingEntry = null; // null = nový přístroj; jinak upravovaný záznam
  let currentDataURL = null;
  // §13 SPEC v4 — název pole se u nepřejmenovaného vestavěného přístroje
  // předvyplní aktuálním překladem; pokud jej uživatel při uložení nezmění,
  // zůstává nameCustom=false (přístroj se dál překládá). Viz formSave níže.
  let prefilledDefaultName = null;
  // ZADANI-KATALOG.md — stejný mechanismus pro popis funkcí a konstrukce:
  // pole se u neupraveného vestavěného přístroje předvyplní aktuálním
  // překladem; pokud je uživatel při uložení nezmění, zůstávají
  // descriptionCustom/constructionCustom = false (text se dál překládá).
  let prefilledDefaultDescription = null;
  let prefilledDefaultConstruction = null;

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function notifyChanged() {
    if (typeof onCatalogChanged === 'function') onCatalogChanged();
  }

  // --- seznam přístrojů ---------------------------------------------------------
  function renderList() {
    els.list.innerHTML = '';
    getCatalog().forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'device-item';

      const info = document.createElement('div');
      info.className = 'device-info';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'device-name';
      nameSpan.textContent = getEntryDisplayName(entry);
      const widthSpan = document.createElement('span');
      widthSpan.className = 'device-width';
      const widthText = entry.widthAdjustable
        ? t('deviceManager.widthFrom', { mm: entry.minWidthMM })
        : t('deviceManager.widthExact', { mm: entry.widthMM });
      const depthText = t('deviceManager.depthFrom', { mm: entry.minDepthMM });
      widthSpan.textContent = `${widthText}, ${depthText}`;
      const kindSpan = document.createElement('span');
      kindSpan.className = 'device-kind';
      kindSpan.textContent = entry.builtin ? t('deviceManager.kindBuiltin') : t('deviceManager.kindCustom');
      info.appendChild(nameSpan);
      info.appendChild(widthSpan);
      info.appendChild(kindSpan);

      const visLabel = document.createElement('label');
      visLabel.className = 'device-visible';
      const visCheckbox = document.createElement('input');
      visCheckbox.type = 'checkbox';
      visCheckbox.checked = !!entry.visible;
      visCheckbox.addEventListener('change', () => {
        setVisible(entry.id, visCheckbox.checked);
        notifyChanged();
      });
      visLabel.appendChild(visCheckbox);
      visLabel.appendChild(document.createTextNode(` ${t('deviceManager.visibleLabel')}`));

      const actions = document.createElement('div');
      actions.className = 'device-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'action-btn action-btn-small';
      editBtn.textContent = t('common.edit');
      editBtn.addEventListener('click', () => openForm(entry));

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'action-btn action-btn-small';
      dupBtn.textContent = t('common.duplicate');
      dupBtn.addEventListener('click', () => {
        duplicate(entry.id);
        renderList();
        notifyChanged();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'action-btn action-btn-small del-btn';
      delBtn.textContent = t('common.delete');
      if (entry.builtin) {
        delBtn.disabled = true;
        delBtn.title = t('deviceManager.cannotDeleteBuiltin');
      } else {
        delBtn.addEventListener('click', () => {
          if (window.confirm(t('deviceManager.confirmDelete', { name: getEntryDisplayName(entry) }))) {
            remove(entry.id);
            renderList();
            notifyChanged();
          }
        });
      }

      actions.appendChild(editBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);

      li.appendChild(info);
      li.appendChild(visLabel);
      li.appendChild(actions);
      els.list.appendChild(li);
    });
  }

  // --- formulář nového / upravovaného přístroje ------------------------------------
  // Poznámka §7.2: formulář je nyní vždy plně editovatelný — i pro vestavěné
  // přístroje (jen builtin flag a id se nemění a nejde je smazat).
  function clampWidthToMin() {
    const minW = clamp(Math.round(Number(els.minWidth.value)) || MIN_WIDTH_FLOOR, MIN_WIDTH_FLOOR, MIN_WIDTH_CEIL);
    els.width.min = String(minW);
    if (Number(els.width.value) < minW) els.width.value = String(minW);
  }

  function clampDepthToMin() {
    const minD = clamp(Math.round(Number(els.minDepth.value)) || MIN_DEPTH_FLOOR, MIN_DEPTH_FLOOR, MIN_DEPTH_CEIL);
    els.depth.min = String(minD);
    if (Number(els.depth.value) < minD) els.depth.value = String(minD);
  }

  els.minWidth.addEventListener('input', clampWidthToMin);
  els.minDepth.addEventListener('input', clampDepthToMin);
  els.controlsCount.addEventListener('input', () => {
    els.controlsCountSlider.value = els.controlsCount.value;
  });
  els.controlsCountSlider.addEventListener('input', () => {
    els.controlsCount.value = els.controlsCountSlider.value;
  });

  els.bitmapInput.addEventListener('change', () => {
    const file = els.bitmapInput.files && els.bitmapInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentDataURL = String(reader.result);
      els.preview.src = currentDataURL;
      els.preview.hidden = false;
      showError('');
    };
    reader.readAsDataURL(file);
  });

  els.resetBtn.addEventListener('click', () => {
    if (!editingEntry || !editingEntry.builtin) return;
    const reset = resetBuiltin(editingEntry.id);
    if (!reset) return;
    renderList();
    notifyChanged();
    openForm(reset); // formulář se znovu naplní tovární hodnotou
  });

  function openForm(entry) {
    editingEntry = entry || null;
    showError('');
    currentDataURL = (entry && entry.imageDataURL) || null;

    els.formTitle.textContent = entry ? t('deviceManager.editTitle', { name: getEntryDisplayName(entry) }) : t('deviceManager.newTitle');
    els.builtinHint.hidden = !(entry && entry.builtin);
    els.resetRow.hidden = !(entry && entry.builtin);

    // §13 — u nepřejmenovaného vestavěného přístroje se pole předvyplní
    // aktuálním překladem (viz formSave — nezměněná hodnota se neuloží jako
    // přejmenování); jinak (přejmenovaný/vlastní) doslovným uloženým názvem.
    prefilledDefaultName = (entry && entry.builtin && !entry.nameCustom) ? getEntryDisplayName(entry) : null;
    els.name.value = entry ? getEntryDisplayName(entry) : '';
    els.minWidth.value = String((entry && entry.minWidthMM) || 400);
    els.width.value = String((entry && entry.widthMM) || (entry && entry.minWidthMM) || 400);
    els.minDepth.value = String((entry && entry.minDepthMM) || 700);
    els.depth.value = String((entry && entry.depthMM) || (entry && entry.minDepthMM) || 700);
    els.widthAdjustable.checked = !!(entry && entry.widthAdjustable);
    els.topFeature.value = (entry && entry.topFeature && entry.topFeature.type) || 'none';
    els.controlsCount.value = String(entry && entry.controls ? entry.controls.count : 0);
    els.controlsCountSlider.value = els.controlsCount.value;
    els.controlsType.value = (entry && entry.controls && entry.controls.type) || 'knob';

    // §10.1/§10.2 SPEC v4
    els.topFixed.checked = !!(entry && entry.topFixed);
    const allowedStyles = (entry && Array.isArray(entry.allowedBodyStyles) && entry.allowedBodyStyles.length)
      ? entry.allowedBodyStyles
      : ['closed', 'doors', 'open'];
    els.styleClosed.checked = allowedStyles.includes('closed');
    els.styleDoors.checked = allowedStyles.includes('doors');
    els.styleOpen.checked = allowedStyles.includes('open');

    // §10.3 SPEC v4 — nepovinné technické údaje, u vestavěných prázdné
    els.catalogCode.value = (entry && entry.catalogCode) || '';
    els.powerKW.value = entry && entry.powerKW != null ? String(entry.powerKW) : '';
    els.voltage.value = (entry && entry.voltage) || '';
    els.gasKW.value = entry && entry.gasKW != null ? String(entry.gasKW) : '';
    // ZADANI-KATALOG.md — zobrazit aktuální (přeložený) text, ne interní
    // doslovnou hodnotu; viz prefilledDefaultDescription/-Construction níže.
    prefilledDefaultDescription = (entry && entry.builtin && !entry.descriptionCustom)
      ? getEntryDescription(entry) : null;
    prefilledDefaultConstruction = (entry && entry.builtin && !entry.constructionCustom)
      ? getEntryConstruction(entry) : null;
    els.descriptionText.value = entry ? getEntryDescription(entry) : '';
    els.constructionText.value = entry ? getEntryConstruction(entry) : '';

    clampWidthToMin();
    clampDepthToMin();

    els.bitmapInput.value = '';
    if (currentDataURL) {
      els.preview.src = currentDataURL;
      els.preview.hidden = false;
    } else {
      els.preview.hidden = true;
      els.preview.removeAttribute('src');
    }

    els.listView.hidden = true;
    els.formView.hidden = false;
  }

  function closeForm() {
    editingEntry = null;
    els.formView.hidden = true;
    els.listView.hidden = false;
  }

  els.formCancel.addEventListener('click', closeForm);

  els.formSave.addEventListener('click', () => {
    const topFeatureType = els.topFeature.value;
    if (topFeatureType === 'bitmap' && !currentDataURL) {
      showError(t('deviceManager.errBitmapRequired'));
      return;
    }

    let minWidthMM = Math.round(Number(els.minWidth.value));
    if (!Number.isFinite(minWidthMM)) minWidthMM = MIN_WIDTH_FLOOR;
    minWidthMM = clamp(minWidthMM, MIN_WIDTH_FLOOR, MIN_WIDTH_CEIL);

    let widthMM = Math.round(Number(els.width.value));
    if (!Number.isFinite(widthMM)) widthMM = minWidthMM;
    widthMM = clamp(widthMM, minWidthMM, CATALOG_WIDTH_MAX);

    let minDepthMM = Math.round(Number(els.minDepth.value));
    if (!Number.isFinite(minDepthMM)) minDepthMM = MIN_DEPTH_FLOOR;
    minDepthMM = clamp(minDepthMM, MIN_DEPTH_FLOOR, MIN_DEPTH_CEIL);

    let depthMM = Math.round(Number(els.depth.value));
    if (!Number.isFinite(depthMM)) depthMM = minDepthMM;
    depthMM = clamp(depthMM, minDepthMM, MIN_DEPTH_CEIL);

    let controlsCount = Math.round(Number(els.controlsCount.value));
    if (!Number.isFinite(controlsCount)) controlsCount = 0;
    controlsCount = clamp(controlsCount, 0, CUSTOM_CONTROLS_MAX);

    // §10.2 SPEC v4 — alespoň jeden povolený styl podestavby (checkboxy už
    // brání odškrtnutí posledního, tohle je jen pojistka)
    const allowedBodyStyles = styleCheckboxes.filter((s) => s.el.checked).map((s) => s.value);
    if (allowedBodyStyles.length === 0) {
      showError(t('deviceManager.errNeedOneStyle'));
      return;
    }

    // §10.3 SPEC v4 — volitelné technické údaje (prázdné → null/'', nikdy se
    // nic nedomýšlí)
    const powerKW = els.powerKW.value.trim() === '' ? null : Math.round(Number(els.powerKW.value) * 10) / 10;
    const gasKW = els.gasKW.value.trim() === '' ? null : Math.round(Number(els.gasKW.value) * 10) / 10;

    showError('');
    // §13 SPEC v4 — u nepřejmenovaného vestavěného přístroje zůstává pole
    // nameCustom=false, pokud uživatel nezměnil předvyplněný přeložený název
    // (viz prefilledDefaultName v openForm); jinak (jakákoli změna, nebo
    // vlastní/nový přístroj) se název uloží doslovně a dál se nepřekládá.
    const typedName = els.name.value.trim();
    const isBuiltin = editingEntry ? !!editingEntry.builtin : false;
    const keepsDefaultName = isBuiltin && !editingEntry.nameCustom && typedName === prefilledDefaultName;
    const nameCustom = !keepsDefaultName;
    const name = keepsDefaultName ? '' : (typedName || t('catalog.deviceFallbackName'));

    // ZADANI-KATALOG.md — stejná logika pro popis funkcí a popis konstrukce:
    // pokud uživatel nepřejmenovaný vestavěný přístroj a nezměnil předvyplněný
    // přeložený text, zůstává descriptionCustom/constructionCustom = false
    // (text se dál překládá); jinak se uloží doslovně a přestává se překládat.
    const typedDescription = els.descriptionText.value.trim();
    const keepsDefaultDescription = isBuiltin && !editingEntry.descriptionCustom
      && typedDescription === prefilledDefaultDescription;
    const descriptionCustom = !keepsDefaultDescription;
    const descriptionText = keepsDefaultDescription ? '' : typedDescription;

    const typedConstruction = els.constructionText.value.trim();
    const keepsDefaultConstruction = isBuiltin && !editingEntry.constructionCustom
      && typedConstruction === prefilledDefaultConstruction;
    const constructionCustom = !keepsDefaultConstruction;
    const constructionText = keepsDefaultConstruction ? '' : typedConstruction;

    // builtin flag se přebírá z upravovaného záznamu (§7.2) — nový přístroj
    // je vždy vlastní (builtin:false); catalog.js navíc při upsert() sám
    // vynutí, že builtin/id existující položky nelze přepsat.
    const entry = {
      id: (editingEntry && editingEntry.id) || generateId(),
      name,
      nameCustom,
      builtin: editingEntry ? !!editingEntry.builtin : false,
      visible: editingEntry ? !!editingEntry.visible : true,
      widthMM,
      minWidthMM,
      depthMM,
      minDepthMM,
      widthAdjustable: !!els.widthAdjustable.checked,
      topFeature: { type: topFeatureType },
      controls: { type: els.controlsType.value, count: controlsCount },
      imageDataURL: currentDataURL,
      topFixed: !!els.topFixed.checked,
      allowedBodyStyles,
      catalogCode: els.catalogCode.value.trim(),
      powerKW: Number.isFinite(powerKW) && powerKW > 0 ? powerKW : null,
      voltage: els.voltage.value.trim(),
      gasKW: Number.isFinite(gasKW) && gasKW > 0 ? gasKW : null,
      descriptionText,
      descriptionCustom,
      constructionText,
      constructionCustom,
    };

    upsert(entry);
    closeForm();
    renderList();
    notifyChanged();
  });

  // --- otevření / zavření celého dialogu -------------------------------------------
  els.newBtn.addEventListener('click', () => openForm(null));
  els.closeBtn.addEventListener('click', () => {
    els.overlay.hidden = true;
  });
  els.overlay.addEventListener('click', (ev) => {
    if (ev.target === els.overlay) els.overlay.hidden = true;
  });

  function open() {
    closeForm();
    renderList();
    els.overlay.hidden = false;
  }

  // §13 SPEC v4 — přepnutí jazyka musí ihned překreslit i tento dialog, pokud
  // je zrovna otevřený (select options, seznam přístrojů, titulek formuláře).
  // Statické popisky/placeholdery ve formuláři řeší main.js přes
  // applyTranslations(); zde dořešíme jen JS-generovaný obsah.
  onLangChange(() => {
    refreshTranslatedOptions(); // přeloží select options (topFeature/controlsType), zachová vybranou hodnotu
    if (els.overlay.hidden) return;
    if (!els.listView.hidden) {
      renderList();
    } else if (!els.formView.hidden) {
      // formulář je otevřený — přeložit titulek (options už obnovil refreshTranslatedOptions výše)
      els.formTitle.textContent = editingEntry
        ? t('deviceManager.editTitle', { name: getEntryDisplayName(editingEntry) })
        : t('deviceManager.newTitle');
    }
  });

  return { open };
}
