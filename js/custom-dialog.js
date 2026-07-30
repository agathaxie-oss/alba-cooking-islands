// custom-dialog.js — overlay dialog pro vytvoření/úpravu vlastního modulu:
// název, minimální šířka (vynucená), šířka, bitmapa (FileReader → dataURL)
// a ovládací prvky (počet 0–8 + druh).

import { CONTROL_TYPES, CUSTOM_WIDTH_MAX, CUSTOM_CONTROLS_MAX } from './modules.js';
import { t, onLangChange } from './i18n.js';

const MIN_WIDTH_FLOOR = 100;
const MIN_WIDTH_CEIL = 1200;

export function setupCustomDialog() {
  const els = {
    overlay: document.getElementById('custom-dialog-overlay'),
    title: document.getElementById('custom-dialog-title'),
    name: document.getElementById('custom-name'),
    minWidth: document.getElementById('custom-min-width'),
    width: document.getElementById('custom-width'),
    widthSlider: document.getElementById('custom-width-slider'),
    bitmapInput: document.getElementById('custom-bitmap'),
    preview: document.getElementById('custom-bitmap-preview'),
    controlsCount: document.getElementById('custom-controls-count'),
    controlsCountSlider: document.getElementById('custom-controls-count-slider'),
    controlsType: document.getElementById('custom-controls-type'),
    error: document.getElementById('custom-dialog-error'),
    cancelBtn: document.getElementById('custom-dialog-cancel'),
    saveBtn: document.getElementById('custom-dialog-save'),
  };

  // naplnění selectu druhů ovládacích prvků — přeloží se znovu i při změně
  // jazyka (viz onLangChange níže), aby volby zůstaly v aktuálním jazyce.
  function refreshControlsTypeOptions() {
    const prevValue = els.controlsType.value;
    els.controlsType.innerHTML = '';
    CONTROL_TYPES.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = t(`controlType.${value}`);
      els.controlsType.appendChild(opt);
    });
    if (prevValue) els.controlsType.value = prevValue;
  }
  refreshControlsTypeOptions();

  let currentDataURL = null;
  let saveCallback = null;
  let isEditing = false; // pro překlad titulku při přepnutí jazyka (viz onLangChange níže)

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  function clampWidthToMin() {
    const minW = Number(els.minWidth.value) || MIN_WIDTH_FLOOR;
    els.width.min = String(minW);
    els.widthSlider.min = String(minW);
    if (Number(els.width.value) < minW) {
      els.width.value = String(minW);
      els.widthSlider.value = String(minW);
    }
  }

  els.minWidth.addEventListener('input', clampWidthToMin);
  els.width.addEventListener('input', () => {
    els.widthSlider.value = els.width.value;
  });
  els.widthSlider.addEventListener('input', () => {
    els.width.value = els.widthSlider.value;
  });
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
    };
    reader.readAsDataURL(file);
  });

  function close() {
    els.overlay.hidden = true;
    saveCallback = null;
  }

  els.cancelBtn.addEventListener('click', close);
  els.overlay.addEventListener('click', (ev) => {
    if (ev.target === els.overlay) close();
  });

  els.saveBtn.addEventListener('click', () => {
    const name = els.name.value.trim() || t('module.customDefaultName');
    let minWidthMM = Math.round(Number(els.minWidth.value));
    let widthMM = Math.round(Number(els.width.value));
    let controlsCount = Math.round(Number(els.controlsCount.value));
    const controlsType = els.controlsType.value;

    if (!Number.isFinite(minWidthMM)) minWidthMM = MIN_WIDTH_FLOOR;
    minWidthMM = Math.min(Math.max(minWidthMM, MIN_WIDTH_FLOOR), MIN_WIDTH_CEIL);

    if (!Number.isFinite(widthMM)) widthMM = minWidthMM;
    widthMM = Math.min(Math.max(widthMM, minWidthMM), CUSTOM_WIDTH_MAX);

    if (!Number.isFinite(controlsCount)) controlsCount = 0;
    controlsCount = Math.min(Math.max(controlsCount, 0), CUSTOM_CONTROLS_MAX);

    if (widthMM < minWidthMM) {
      showError(t('customDialog.errWidthTooSmall', { mm: minWidthMM }));
      return;
    }

    showError('');
    const result = {
      name,
      minWidthMM,
      widthMM,
      controlsType,
      controlsCount,
      imageDataURL: currentDataURL,
    };
    const cb = saveCallback;
    close();
    if (cb) cb(result);
  });

  /**
   * Otevře dialog. `initial` (volitelně) předvyplní pole při úpravě
   * existujícího vlastního modulu. `onSave(result)` se zavolá po uložení.
   */
  function open(initial, onSave) {
    saveCallback = onSave;
    isEditing = !!initial;
    showError('');
    currentDataURL = (initial && initial.imageDataURL) || null;

    els.title.textContent = initial ? t('customDialog.editTitle') : t('customDialog.newTitle');
    els.name.value = (initial && initial.name) || '';
    els.minWidth.value = String((initial && initial.minWidthMM) || 300);
    els.width.value = String((initial && initial.widthMM) || (initial && initial.minWidthMM) || 300);
    els.controlsCount.value = String(initial && initial.controlsCount != null ? initial.controlsCount : 2);
    els.controlsCountSlider.value = els.controlsCount.value;
    els.controlsType.value = (initial && initial.controlsType) || 'knob';

    clampWidthToMin();
    els.widthSlider.value = els.width.value;

    els.bitmapInput.value = '';
    if (currentDataURL) {
      els.preview.src = currentDataURL;
      els.preview.hidden = false;
    } else {
      els.preview.hidden = true;
      els.preview.removeAttribute('src');
    }

    els.overlay.hidden = false;
  }

  // §13 SPEC v4 — přepnutí jazyka ihned přeloží select i titulek, pokud je
  // dialog zrovna otevřený; ostatní statické popisky řeší applyTranslations().
  onLangChange(() => {
    refreshControlsTypeOptions();
    if (!els.overlay.hidden) {
      els.title.textContent = isEditing ? t('customDialog.editTitle') : t('customDialog.newTitle');
    }
  });

  return { open };
}
