// ui.js — boční panel: rozměry bloku, DVĚ nezávislé strany segmentů (A/B u
// ostrova), katalog pro přidání, napouštěcí ramena, přednastavené pohledy,
// prostředí a export (SPEC v3).

import {
  NEUTRAL_TYPE,
  CUSTOM_TYPE,
  getSegmentLabel,
  getSegmentWidthMM,
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
import { getVisible as getCatalogVisible, getById as getCatalogEntry } from './catalog.js';
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

export const STORAGE_KEY = 'nerez-blok-config-v3';

export function setupUI(callbacks) {
  const els = {
    inputLength: document.getElementById('input-length'),
    inputDepthA: document.getElementById('input-depth-a'),
    inputDepthB: document.getElementById('input-depth-b'),
    depthALabel: document.getElementById('depth-a-label'),
    depthBRow: document.getElementById('depth-b-row'),
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
    envButtons: Array.from(document.querySelectorAll('[data-env]')),
    exportPngBtn: document.getElementById('export-png'),
    saveConfigBtn: document.getElementById('save-config'),
    loadFileInput: document.getElementById('load-file-input'),
    loadFileBtn: document.getElementById('load-file-btn'),
    loadStorageBtn: document.getElementById('load-storage-btn'),
  };

  const sides = {
    A: {
      capacityHint: document.getElementById('capacity-hint-a'),
      capacityUsed: document.getElementById('capacity-used-a'),
      capacityTotal: document.getElementById('capacity-total-a'),
      segmentList: document.getElementById('segment-list-a'),
      emptyHint: document.getElementById('empty-hint-a'),
      addButtons: document.getElementById('add-buttons-a'),
      addNeutralBtn: document.getElementById('add-neutral-btn-a'),
      addCustomBtn: document.getElementById('add-custom-btn-a'),
      catalogButtons: [],
    },
    B: {
      capacityHint: document.getElementById('capacity-hint-b'),
      capacityUsed: document.getElementById('capacity-used-b'),
      capacityTotal: document.getElementById('capacity-total-b'),
      segmentList: document.getElementById('segment-list-b'),
      emptyHint: document.getElementById('empty-hint-b'),
      addButtons: document.getElementById('add-buttons-b'),
      addNeutralBtn: document.getElementById('add-neutral-btn-b'),
      addCustomBtn: document.getElementById('add-custom-btn-b'),
      catalogButtons: [],
    },
  };

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
  function buildCatalogButtons(side) {
    const s = sides[side];
    getCatalogVisible().forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'add-btn';
      const widthText = def.widthAdjustable ? `od ${def.minWidthMM} mm` : `${def.widthMM} mm`;
      btn.textContent = `+ ${def.name} (${widthText})`;
      btn.addEventListener('click', () => callbacks.onAddInstrument(side, def.id));
      s.addButtons.appendChild(btn);
      s.catalogButtons.push(btn);
    });
  }
  buildCatalogButtons('A');
  buildCatalogButtons('B');

  sides.A.addNeutralBtn.addEventListener('click', () => callbacks.onAddNeutral('A'));
  sides.A.addCustomBtn.addEventListener('click', () => callbacks.onOpenCustomNew('A'));
  sides.B.addNeutralBtn.addEventListener('click', () => callbacks.onAddNeutral('B'));
  sides.B.addCustomBtn.addEventListener('click', () => callbacks.onOpenCustomNew('B'));

  // --- napouštěcí ramena ---------------------------------------------------------
  els.addArmBtn.addEventListener('click', () => callbacks.onAddArm());

  // --- přednastavené pohledy -----------------------------------------------------
  els.viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onViewChange(btn.dataset.view));
  });

  // --- prostředí (podlaha) --------------------------------------------------------
  els.envButtons.forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onEnvChange(btn.dataset.env));
  });

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
    widthSpan.textContent = `${getSegmentWidthMM(seg)} mm${fitInfo.fits ? '' : ' — nevejde se'}`;
    info.appendChild(nameSpan);
    info.appendChild(widthSpan);

    const controls = document.createElement('div');
    controls.className = 'module-controls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.title = 'Posunout doleva';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onMoveSegment(seg.id, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.title = 'Posunout doprava';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      callbacks.onMoveSegment(seg.id, 1);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.title = 'Odebrat segment';
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
      widthLabel.textContent = 'Šířka (mm)';
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
      podLabel.textContent = 'Podestavba';
      const podSelect = document.createElement('select');
      [['doors', 's dvířky'], ['open', 'otevřená']].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
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
      shelfLabel.appendChild(document.createTextNode(' s policí'));
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
      panelLabel.appendChild(document.createTextNode(' s panelem'));
      extra.appendChild(panelLabel);

      li.appendChild(extra);
    } else if (seg.type === CUSTOM_TYPE) {
      const extra = document.createElement('div');
      extra.className = 'module-extra';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'action-btn';
      editBtn.textContent = 'Upravit…';
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        callbacks.onEditCustom(seg.id);
      });
      extra.appendChild(editBtn);
      li.appendChild(extra);
    } else {
      // katalogový přístroj s nastavitelnou šířkou podestavby (indukce, dřez…)
      const def = getCatalogEntry(seg.type);
      if (def && def.widthAdjustable) {
        const extra = document.createElement('div');
        extra.className = 'module-extra';

        const isSink = def.topFeature && def.topFeature.type === 'sink';
        const minWidth = isSink && seg.vatWidthMM ? seg.vatWidthMM + SINK_WIDTH_MARGIN_MM : def.minWidthMM;

        const widthLabel = document.createElement('label');
        widthLabel.className = 'extra-field';
        widthLabel.textContent = 'Šířka podestavby (mm)';
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

        if (isSink) {
          const vatWidthLabel = document.createElement('label');
          vatWidthLabel.className = 'extra-field';
          vatWidthLabel.textContent = 'Šířka vany (mm)';
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
          vatDepthLabel.textContent = 'Hloubka vany (mm)';
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
    title.textContent = `Rameno #${arm.id}`;
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Odebrat rameno';
    delBtn.addEventListener('click', () => callbacks.onRemoveArm(arm.id));
    header.appendChild(title);
    header.appendChild(delBtn);
    li.appendChild(header);

    const posLabel = document.createElement('label');
    posLabel.className = 'extra-field';
    posLabel.textContent = 'Pozice X (mm)';
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
    const offsetText = isIsland ? 'Vzdálenost od středu (mm)' : 'Vzdálenost od zadní hrany (mm)';
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
    angleLabel.textContent = `Úhel natočení (${arm.angleDeg}°)`;
    const angleSlider = document.createElement('input');
    angleSlider.type = 'range';
    angleSlider.min = String(ARM_ANGLE_MIN);
    angleSlider.max = String(ARM_ANGLE_MAX);
    angleSlider.step = '1';
    angleSlider.value = String(arm.angleDeg);
    angleSlider.addEventListener('input', () => {
      angleLabel.firstChild.textContent = `Úhel natočení (${angleSlider.value}°)`;
      callbacks.onArmAngleChange(arm.id, Number(angleSlider.value));
    });
    angleLabel.appendChild(angleSlider);
    li.appendChild(angleLabel);

    return li;
  }

  /** Vykreslí seznam segmentů + kapacitu jedné strany. */
  function renderSide(side, segments, capacity, state) {
    const s = sides[side];
    const { usedMM, capacityMM } = capacity;
    s.capacityUsed.textContent = usedMM;
    s.capacityTotal.textContent = capacityMM;
    s.capacityHint.classList.toggle('over', usedMM > capacityMM);

    const hasRoom = usedMM < capacityMM;
    s.catalogButtons.forEach((btn) => { btn.disabled = !hasRoom; });
    s.addNeutralBtn.disabled = !hasRoom;
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

    els.depthALabel.textContent = isIsland ? 'Hloubka strany A (mm)' : 'Hloubka (mm)';
    els.depthBRow.hidden = !isIsland;
    els.sideBSection.hidden = !isIsland;
    els.sideATitle.textContent = isIsland ? 'Strana A' : 'Segmenty';

    els.dimLength.textContent = state.builtDimensions.lengthMM;
    els.dimDepth.textContent = state.builtDimensions.depthMM;
    els.dimHeight.textContent = state.builtDimensions.heightMM;
    if (isIsland) {
      els.dimDepthBreakdown.hidden = false;
      els.dimDepthBreakdown.textContent = `(A ${state.builtDimensions.depthAMM} + B ${state.builtDimensions.depthBMM} mm)`;
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
