// mono-ui.js — CELÝ spodní pás produktu ALBA MONO (balík A4, viz
// ZADANI-MONO-UI.md §3). Vlastní modul, ne rozšíření ui.js, protože ui.js
// (balík A7) má zakázáno nafukovat se o pět záložek s úplně jinou logikou
// (dráhy úměrné milimetrům místo řady karet) — obě sady žijí vedle sebe,
// ui.js si mezi nimi jen přepíná (viz getMonoStrip/renderStrip v ui.js).
//
// TVRDÉ PRAVIDLO ROZHRANÍ (zadání, „Tvrdá pravidla"): tenhle modul smí
// importovat VÝHRADNĚ computeMonoLayout/computeMonoChecks z mono-layout.js —
// ne main.js, ne ui.js, ne catalog.js, ne modules.js, ne mono-geometry.js,
// ne arms.js. Drží ho to jako list bez vazby na zbytek aplikace, ale má to
// viditelný důsledek, který NEJDE obejít importem (porušil by pravidlo):
//   1) Katalogové přístroje v Herdbloku nemají tu dostupné čitelné jméno
//      napřímo (getEntryDisplayName žije v catalog.js) — řeší se injekcí:
//      ui.js (ten catalog.js smí znát) předá tovární funkci volitelný
//      parametr `deviceName(typeKey)`. Když ho ui.js ještě nepředává (souběžná
//      práce) nebo pro daný klíč nic nevrátí, spadneme zpátky na syrový klíč
//      katalogu (item.type) — viz resolveDeviceName níže. Nikdy nespadnout,
//      nikdy neukázat prázdno.
//   2) Číselníky BODY_STYLE_OPTIONS/PLINTH_TYPES/FINISH_TYPES (modules.js)
//      a konstanty ramene (arms.js) jsou tu přepsané jako lokální literály —
//      duplicitně, ale schválně (jsou to jen pole řetězců/čísel, ne stav).
//
// Překreslení je vždy ÚPLNÉ (els.body.textContent = '' a stavba znovu) —
// jednodušší a bezpečnější než ruční diffing pěti různě tvarovaných záložek.
// Jediné riziko úplného překreslení je ztráta rozepsané hodnoty ve
// fokusovaném <input>/<select> (zadání to výslovně zakazuje) — řeší
// captureFocus/restoreFocus níže: hodnotu i pozici kurzoru zachytí PŘED
// zbouráním DOM a po stavbě je vrátí do nově vytvořeného uzlu se stejným
// data-mono-field klíčem.

import { computeMonoLayout } from './mono-layout.js';

// --- literály z jiných modulů, které si sem NESMÍME dovézt importem (viz
// hlavička) — hodnoty ověřené v mono-geometry.js/modules.js/arms.js. ----------
const END_TYPE_VERTICAL = 'svislaDeska';
const END_TYPE_CHAMFER = 'svislaDeskaZkos';

const BODY_STYLE_OPTIONS = ['closed', 'doors', 'open']; // modules.js
const PLINTH_TYPES = ['legs', 'building', 'construction']; // modules.js
// H3 se od úkolu 9a (PREDANI.md) nenabízí — zdroj pravdy je modules.js,
// tenhle literál se MUSÍ měnit SPOLU s ním, jinak se seznamy rozejdou.
const FINISH_TYPES = ['HS+', 'H1', 'H2']; // modules.js — kódy, nepřekládají se

const ARM_ANGLE_MIN = -180; // arms.js
const ARM_ANGLE_MAX = 180;
const ARM_OFFSET_STEP = 5;
const ARM_BACK_OFFSET_MIN = 0;
const ARM_BACK_OFFSET_MAX = 200;
const ARM_CENTER_OFFSET_MIN = -200;
const ARM_CENTER_OFFSET_MAX = 200;

const TABS = ['herdblok', 'podestavby', 'panel', 'limec', 'arms'];
// klíč štítku KAŽDÉ záložky pásu — 'arms' nemá vlastní mono.tab.* (zadání §5
// ho tam nezavádí), sdílí ho s kartou ramene v SEGMENTu (stejný text v mockupu).
const TAB_LABEL_KEYS = {
  herdblok: 'mono.tab.herdblok',
  podestavby: 'mono.tab.podestavby',
  panel: 'mono.tab.panel',
  limec: 'mono.tab.limec',
  arms: 'arms.sectionTitle',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// --- ikony (opsané doslova z mockup-mono.html, viz legenda i §3 zadání) ------
const ICON_INNER = {
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  socket230: '<rect x="3" y="4" width="18" height="16" rx="2"/>'
    + '<circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  socketCEE: '<circle cx="12" cy="12" r="8.5"/>'
    + '<circle cx="12" cy="8.5" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="15" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
  arm: '<path d="M7 21V8"/><path d="M7 8h9a3 3 0 0 1 3 3v2"/><path d="M19 13v3"/><path d="M4.5 21h5"/>',
  caret: '<path d="M6 9l6 6 6-6"/>',
  // Ovládání prohození sousedních dlaždic (úkol 5/A3, PREDANI.md) — sdílené
  // se SEGMENTem (ui.js), viz buildSwapControl níže a .strip-swap v CSS.
  // Dva šipkové hroty proti sobě, doslova opsané z mockup-pas-varianty.html
  // (varianta A3, .mk-gap-arrow).
  swap: '<path d="M8 7l-4 5 4 5"/><path d="M16 7l4 5-4 5"/>',
  // Šipka náznaku „dráha pokračuje" u vodorovného posouvání (úkol 11/B1) —
  // stejná ikona jako mockup varianty B1 (.mk-b1-fade svg).
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
};

/** Vytvoří <svg> se zadaným obsahem — innerHTML na SVG uzlu funguje ve všech
 *  prohlížečích, kterým appka běží (viz ui.js PLUS_ICON_SVG, stejná technika). */
function svg(viewBox, innerMarkup, attrs) {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
  el.innerHTML = innerMarkup;
  return el;
}

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/** Uzel, který se chová jako tlačítko, ale NENÍ <button> — mockup má na
 *  těchhle místech <span>/<div> (mk-endcap, mk-btn-warn, mk-tile, mk-point,
 *  mk-param-add/trash, mk-switch span) a modul má vygenerovat „DOM stejného
 *  tvaru" (zadání). Klik i klávesnice (Enter/mezerník) dělají totéž. */
function makeButtonLike(tag, className, onClick) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  node.addEventListener('click', onClick);
  node.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onClick(ev);
    }
  });
  return node;
}

/** mm → % šířky dráhy. Dráhy jsou úměrné milimetrům (zadání) — je to JEDINÉ
 *  místo v modulu, které počítá s reálnými rozměry (poloha/šířka dlaždic),
 *  proto i jediné oprávněné použití inline left/width/right (hard pravidlo). */
function pct(mm, totalMM) {
  if (!totalMM || totalMM <= 0) return 0;
  return (mm / totalMM) * 100;
}

/** Tolerantní čtení typu zakončení — stejná konvence jako
 *  mono-layout.js/main.js (neplatná/chybějící hodnota = svislá deska).
 *  Nejde importovat odsud (mono-layout.js tohle nevrací), musí se zopakovat. */
function readEndType(value) {
  return value === END_TYPE_CHAMFER ? END_TYPE_CHAMFER : END_TYPE_VERTICAL;
}

/**
 * @param {{els:{tabs:HTMLElement, body:HTMLElement}, callbacks:object,
 *   t:function, deviceName:function=}} deps
 * @returns {{render:function, reset:function}}
 */
export function createMonoStrip({
  els = {}, callbacks = {}, t, deviceName,
} = {}) {
  const tt = typeof t === 'function' ? t : (key) => key;

  /** Čitelné jméno katalogového přístroje — jediné místo, kde se volá
   *  injektovaná `deviceName` (viz hlavička modulu). Musí být odolné vůči
   *  tomu, že parametr chybí (souběžná práce v ui.js), že pro daný klíč
   *  nic nevrátí, i vůči tomu, že by sama spadla — v každém z těch případů
   *  se vrátí dnešní chování (syrový klíč katalogu), nikdy prázdný řetězec. */
  function resolveDeviceName(typeKey) {
    if (typeof deviceName === 'function') {
      try {
        const name = deviceName(typeKey);
        if (name) return name;
      } catch (err) {
        // deviceName je cizí kód (ui.js) — pád v něm nesmí strhnout pás dolů.
      }
    }
    return typeKey;
  }

  // --- lokální stav pásu (NEUKLÁDÁ se, viz §3 zadání) -------------------------
  let activeTab = 'herdblok';
  let selected = null; // { layer, id } | null
  let lastState = null; // pro re-render po kliku na záložku/položku (mimo render())

  // ---------------------------------------------------------------------------
  // Zachování rozepsané hodnoty přes úplné překreslení (zadání, viz hlavička).
  // Klíč `data-mono-field` je unikátní přes celý pás (layer:id:pole), takže
  // stačí jeden querySelector po přestavbě DOM.
  // ---------------------------------------------------------------------------
  function captureFocus() {
    const active = document.activeElement;
    if (!active || !els.body || !els.body.contains(active)) return null;
    const key = active.dataset ? active.dataset.monoField : null;
    if (!key) return null;
    return {
      key,
      value: active.value,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    };
  }

  function restoreFocus(info) {
    if (!info || !els.body) return;
    const found = els.body.querySelector(`[data-mono-field="${info.key}"]`);
    if (!found) return;
    found.value = info.value;
    found.focus();
    if (info.selectionStart !== null && typeof found.setSelectionRange === 'function') {
      try {
        found.setSelectionRange(info.selectionStart, info.selectionEnd);
      } catch (err) {
        // některé typy inputu (number) setSelectionRange odmítají — hodnota
        // i fokus už jsou obnovené, pozice kurzoru je jen kosmetický bonus.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Výběr — klik na položku, která je už vybraná, výběr zruší (stejná
  // konvence jako onSelectSegment v ui.js).
  // ---------------------------------------------------------------------------
  function handleSelect(layer, id) {
    if (selected && selected.layer === layer && selected.id === id) {
      selected = null;
      callbacks.onMonoSelect?.(layer, null);
    } else {
      selected = { layer, id };
      callbacks.onMonoSelect?.(layer, id);
    }
    if (lastState) renderAll(lastState);
  }

  function findLaidItem(list, id) {
    return list.find((entry) => entry.item && entry.item.id === id) || null;
  }

  // ---------------------------------------------------------------------------
  // Stavební kostky společné víc záložkám
  // ---------------------------------------------------------------------------

  function buildTile({
    className, name, sizeText, subText, leftPct, widthPct, selected: isSelected, dim, onClick,
  }) {
    const classes = ['mono-tile', className];
    if (isSelected) classes.push('mono-tile-selected');
    // mono-tile-missing se NESMÍ ztlumit ani na neaktivní záložce (zadání) —
    // dim se sem ale u missing tile nikdy nepředává (viz buildPodestavbyScale),
    // takže tahle podmínka nikdy nesloží obě třídy dohromady.
    if (dim) classes.push('mono-dimmed');
    const cls = classes.filter(Boolean).join(' ');
    const tile = onClick ? makeButtonLike('div', cls, onClick) : makeEl('div', cls);
    tile.style.left = `${leftPct}%`;
    tile.style.width = `${widthPct}%`;
    if (name) tile.appendChild(makeEl('span', 'mono-tile-name', name));
    if (sizeText) tile.appendChild(makeEl('span', 'mono-tile-size', sizeText));
    if (subText) tile.appendChild(makeEl('span', 'mono-tile-sub', subText));
    return tile;
  }

  function buildPoint({
    iconKey, xMM, lengthMM, selected: isSelected, title, onClick,
  }) {
    const cls = ['mono-point', isSelected ? 'mono-point-selected' : ''].filter(Boolean).join(' ');
    const point = makeButtonLike('div', cls, onClick);
    point.style.left = `${pct(xMM, lengthMM)}%`;
    if (title) point.title = title;
    point.appendChild(svg('0 0 24 24', ICON_INNER[iconKey], { 'stroke-width': '1.8' }));
    point.appendChild(makeEl('b', null, String(Math.round(xMM))));
    return point;
  }

  function buildTrashButton(onClick, titleText) {
    const btn = makeButtonLike('span', 'mono-param-trash', onClick);
    btn.title = titleText || tt('common.delete');
    btn.appendChild(svg('0 0 24 24', ICON_INNER.trash, {
      'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    return btn;
  }

  /** Ovládání prohození dvou sousedních dlaždic (úkol 5, varianta A3 —
   *  PREDANI.md, mockup-pas-varianty.html). Nahrazuje dřívější šipky
   *  ◀ ▶ v pruhu parametrů: sedí PŘÍMO NA HRANICI dvou dlaždic jako kruhový
   *  překryv (position:absolute, viz .strip-swap v CSS) — nezabírá místo
   *  v toku, takže funguje i mezi dvěma libovolně úzkými dlaždicemi a je
   *  vidět BEZ výběru. Třída `strip-swap` (ne `mono-`) je ZÁMĚRNĚ sdílená
   *  se SEGMENTem (ui.js) — jedna komponenta, jeden vzhled, viz zadání.
   *  `leftId` je id levé položky dvojice; klik zavolá onMonoMove(layer,
   *  leftId, +1), což prohodí levou položku s tou napravo od ní.
   *  `boundaryMM` je mm pozice hranice (= xMM pravé položky) pro pct(). */
  function buildSwapControl(layer, leftId, boundaryMM, lengthMM) {
    const btn = makeButtonLike('span', 'strip-swap', () => callbacks.onMonoMove?.(layer, leftId, 1));
    btn.style.left = `${pct(boundaryMM, lengthMM)}%`;
    btn.title = tt('strip.swapNeighbors');
    btn.appendChild(svg('0 0 24 24', ICON_INNER.swap, {
      'stroke-width': '2.2', 'stroke-linecap': 'round',
    }));
    return btn;
  }

  /** Vloží ovládání prohození mezi KAŽDOU dvojici sousedních položek
   *  uspořádaného seznamu (`laid` = pole { item, xMM, widthMM, ... } ve
   *  stejném pořadí, jako je vrací computeMonoLayout — §2 zadání). Před
   *  první ani za poslední položkou žádné ovládání není (smyčka jde jen
   *  po vnitřních hranicích). Statické dlaždice mimo seznam (koncová zóna,
   *  „chybí N mm", volná plocha) se záměrně NEPOČÍTAJÍ — nejsou to položky,
   *  se kterými by šlo cokoli prohodit. */
  function appendSwapControls(scale, layer, laid, lengthMM) {
    for (let i = 0; i < laid.length - 1; i += 1) {
      const left = laid[i];
      const right = laid[i + 1];
      if (!left.item || !right.item) continue;
      scale.appendChild(buildSwapControl(layer, left.item.id, right.xMM, lengthMM));
    }
  }

  function paramField(labelText, controlEl) {
    const wrap = makeEl('div', 'mono-param-field');
    wrap.appendChild(makeEl('label', null, labelText));
    wrap.appendChild(controlEl);
    return wrap;
  }

  function paramDisplay(text) {
    return makeEl('div', 'mono-param-display', text);
  }

  function paramNumberInput(value, {
    min, max, step, fieldKey, onCommit,
  }) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'mono-param-input';
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    if (step !== undefined) input.step = String(step);
    input.value = String(value);
    // klíč pro captureFocus/restoreFocus (viz hlavička) — beze změny hodnoty
    // po dobu, co v poli uživatel píše, i kdyby mezitím přišlo cizí render().
    input.dataset.monoField = fieldKey;
    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (Number.isFinite(n)) onCommit(n);
    });
    return input;
  }

  function paramSelect(options, currentValue, labelFn, fieldKey, onCommit) {
    const select = document.createElement('select');
    select.className = 'mono-param-input';
    select.dataset.monoField = fieldKey;
    options.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = labelFn(value);
      if (value === currentValue) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onCommit(select.value));
    return select;
  }

  // ---------------------------------------------------------------------------
  // Pravítko — značky po 500 mm + koncová na lengthMM (zadání §3). Popisky:
  // první translateX(0), poslední translateX(-100%), ostatní na střed —
  // JEDINÉ povolené použití transformu v inline stylu (hard pravidlo).
  // ---------------------------------------------------------------------------
  function buildRuler(lengthMM) {
    const row = makeEl('div', 'mono-scale-row mono-ruler-row');
    row.appendChild(makeEl('div', 'mono-scale-label'));

    const scale = makeEl('div', 'mono-scale');
    const marks = [];
    for (let mm = 0; mm < lengthMM; mm += 500) marks.push(mm);
    marks.push(lengthMM);
    // pokud lengthMM vyjde přesně na násobek 500, poslední dvě značky splynou
    if (marks.length > 1 && marks[marks.length - 2] === marks[marks.length - 1]) {
      marks.splice(marks.length - 2, 1);
    }

    marks.forEach((mm, idx) => {
      const tick = makeEl('div', 'mono-tick');
      tick.style.left = `${pct(mm, lengthMM)}%`;
      tick.appendChild(document.createElement('i'));
      const b = makeEl('b', null, String(Math.round(mm)));
      const isFirst = idx === 0;
      const isLast = idx === marks.length - 1;
      b.style.transform = `translateX(${isFirst ? '0' : (isLast ? '-100%' : '-50%')})`;
      tick.appendChild(b);
      scale.appendChild(tick);
    });

    row.appendChild(scale);
    return row;
  }

  function trackRow(labelText, scaleEl) {
    const row = makeEl('div', 'mono-scale-row mono-track-row');
    row.appendChild(makeEl('div', 'mono-scale-label', labelText));
    row.appendChild(scaleEl);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Koncovky Herdbloku (volba 1B) — cesty opsané doslova ze zadání §3.
  // ---------------------------------------------------------------------------
  function buildEndcap(side, monoState) {
    const isLeft = side === 'left';
    const isChamfer = readEndType(isLeft ? monoState.leftEndType : monoState.rightEndType) === END_TYPE_CHAMFER;

    const onActivate = () => {
      const next = isChamfer ? END_TYPE_VERTICAL : END_TYPE_CHAMFER;
      callbacks.onMonoEndTypeChange?.(side, next);
    };
    const cap = makeButtonLike('span', `mono-endcap mono-endcap-${side}`, onActivate);
    cap.title = tt(isLeft ? 'mono.endTypeLeft' : 'mono.endTypeRight');

    const glyphPath = isLeft
      ? (isChamfer ? 'M25 5H9l-6 6v7' : 'M25 5H3v13')
      : (isChamfer ? 'M1 5h16l6 6v7' : 'M1 5h22v13');
    const glyph = makeEl('span', 'mono-endcap-glyph');
    glyph.appendChild(svg('0 0 26 20', `<path d="${glyphPath}"/>`, {
      'stroke-width': '2.4', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
    const caret = makeEl('span', 'mono-endcap-caret');
    caret.appendChild(svg('0 0 24 24', ICON_INNER.caret, { 'stroke-width': '2.4', 'stroke-linecap': 'round' }));

    // levý konec: profil pak šipka; pravý: šipka pak profil (přesně dle mockupu)
    if (isLeft) {
      cap.appendChild(glyph);
      cap.appendChild(caret);
    } else {
      cap.appendChild(caret);
      cap.appendChild(glyph);
    }
    return cap;
  }

  // ---------------------------------------------------------------------------
  // Dráha Herdblok — používá ji jak vlastní záložka (aktivní, s koncovkami),
  // tak Panel/Ramena jako ztlumený kontext (bez koncovek, needitovatelná).
  // ---------------------------------------------------------------------------
  function buildHerdblokScale(monoState, layout, lengthMM, opts) {
    const { selectable, dim, showEndcaps } = opts;
    const scale = makeEl('div', 'mono-scale');

    layout.herdblok.forEach(({ item, xMM, widthMM, overflow }) => {
      const isSurface = item && item.type === 'surface';
      // 'surface' se jmenuje pořád z i18n (zadání), katalogové přístroje přes
      // injektovanou deviceName s pádem na syrový klíč (viz hlavička modulu).
      const name = isSurface ? tt('mono.item.surface') : resolveDeviceName(item && item.type);
      scale.appendChild(buildTile({
        className: isSurface ? 'mono-tile-surface' : 'mono-tile-device mono-tile-wide',
        name,
        sizeText: tt('catalog.widthExact', { mm: Math.round(widthMM) }),
        subText: overflow ? tt('mono.overflow') : '',
        leftPct: pct(xMM, lengthMM),
        widthPct: pct(widthMM, lengthMM),
        dim,
        selected: selectable && !!selected && selected.layer === 'herdblok' && item && selected.id === item.id,
        onClick: selectable ? () => handleSelect('herdblok', item.id) : null,
      }));
    });

    // Ovládání prohození jen na AKTIVNÍ (editovatelné) dráze — na ztlumeném
    // kontextovém řádku (Panel/Ramena) by prohazovalo položky, které tam
    // uživatel zrovna neupravuje (viz buildContextHerdblokRow, selectable:false).
    if (selectable) appendSwapControls(scale, 'herdblok', layout.herdblok, lengthMM);

    if (layout.herdblokFreeMM > 0) {
      const freeStartMM = lengthMM - layout.herdblokFreeMM;
      scale.appendChild(buildTile({
        className: 'mono-tile-surface',
        name: tt('mono.layer.free'),
        sizeText: tt('catalog.widthExact', { mm: Math.round(layout.herdblokFreeMM) }),
        leftPct: pct(freeStartMM, lengthMM),
        widthPct: pct(layout.herdblokFreeMM, lengthMM),
        dim,
      }));
    }

    if (showEndcaps) {
      scale.appendChild(buildEndcap('left', monoState));
      scale.appendChild(buildEndcap('right', monoState));
    }

    return scale;
  }

  function buildContextHerdblokRow(monoState, layout, lengthMM) {
    return trackRow(tt('mono.tab.herdblok'), buildHerdblokScale(monoState, layout, lengthMM, {
      selectable: false, dim: true, showEndcaps: false,
    }));
  }

  // ---------------------------------------------------------------------------
  // Dráha Podestavby — koncové zóny, řada skříněk/mezer, volba 2A („chybí").
  // ---------------------------------------------------------------------------
  function buildPodestavbyScale(layout, lengthMM, opts) {
    const { selectable, dim } = opts;
    const scale = makeEl('div', 'mono-scale');

    if (layout.leftInsetMM > 0) {
      // Bez textu (úkol 7.1, PREDANI.md) — koncová zóna je jen 50/70 mm,
      // tj. ~2 % šířky dráhy, na text tam není a nebude místo (oříznuté na
      // „0 m" místo „50 mm"). Hodnotu hlásí .mono-track-note (mono.endZoneNote)
      // pod dráhou, kde je pro ni místo.
      scale.appendChild(buildTile({
        className: 'mono-tile-endzone',
        leftPct: pct(0, lengthMM),
        widthPct: pct(layout.leftInsetMM, lengthMM),
        dim,
      }));
    }

    layout.podestavby.forEach(({ item, xMM, widthMM, overflow }) => {
      const isGap = item && item.kind === 'gap';
      scale.appendChild(buildTile({
        className: isGap ? 'mono-tile-gap mono-tile-wide' : 'mono-tile-cabinet mono-tile-wide',
        name: isGap ? tt('mono.item.gap') : tt('mono.item.cabinet'),
        sizeText: tt('catalog.widthExact', { mm: Math.round(widthMM) }),
        subText: overflow ? tt('mono.overflow') : '',
        leftPct: pct(xMM, lengthMM),
        widthPct: pct(widthMM, lengthMM),
        dim,
        selected: selectable && !!selected && selected.layer === 'podestavby' && item && selected.id === item.id,
        onClick: selectable ? () => handleSelect('podestavby', item.id) : null,
      }));
    });

    // Ovládání prohození jen na aktivní dráze (viz stejná poznámka výše
    // u buildHerdblokScale). Koncové zóny a hlášení „chybí" mezi laid
    // položky nepatří (appendSwapControls je čte jen z layout.podestavby).
    if (selectable) appendSwapControls(scale, 'podestavby', layout.podestavby, lengthMM);

    if (layout.missingMM > 0) {
      // VOLBA 2A — nikdy se neztlumuje (dim se sem záměrně nepředává, viz
      // buildTile a hlavička modulu).
      const missing = buildTile({
        className: 'mono-tile-missing mono-tile-wide',
        name: tt('mono.missing', { mm: Math.round(layout.missingMM) }),
        leftPct: pct(layout.missingFromMM, lengthMM),
        widthPct: pct(layout.missingMM, lengthMM),
      });
      const fillBtn = makeButtonLike('span', 'mono-btn-warn', (ev) => {
        ev.stopPropagation();
        callbacks.onMonoFillPodestavby?.();
      });
      fillBtn.textContent = tt('mono.fillBtn');
      missing.appendChild(fillBtn);
      scale.appendChild(missing);
    }

    if (layout.rightInsetMM > 0) {
      // Bez textu — viz poznámka u levé koncové zóny výše.
      scale.appendChild(buildTile({
        className: 'mono-tile-endzone',
        leftPct: pct(layout.usableToMM, lengthMM),
        widthPct: pct(layout.rightInsetMM, lengthMM),
        dim,
      }));
    }

    return scale;
  }

  // ---------------------------------------------------------------------------
  // Dráha Čelní panel — podklad (kam prvek smí) + body (zásuvky).
  // ---------------------------------------------------------------------------
  function buildPanelTrackScale(layout, lengthMM) {
    const scale = makeEl('div', 'mono-scale');

    const bed = makeEl('div', 'mono-track-bed');
    bed.style.left = `${pct(layout.usableFromMM, lengthMM)}%`;
    bed.style.right = `${pct(lengthMM - layout.usableToMM, lengthMM)}%`;
    bed.appendChild(makeEl('span', 'mono-track-bed-label', tt('mono.bedPanel', {
      from: Math.round(layout.usableFromMM), to: Math.round(layout.usableToMM),
    })));
    scale.appendChild(bed);

    layout.panelItems.forEach(({ item, xMM }) => {
      const isCEE = item.kind === 'socketCEE';
      scale.appendChild(buildPoint({
        iconKey: isCEE ? 'socketCEE' : 'socket230',
        xMM,
        lengthMM,
        selected: !!selected && selected.layer === 'panel' && selected.id === item.id,
        title: tt(isCEE ? 'mono.panel.socketCEE' : 'mono.panel.socket230'),
        onClick: () => handleSelect('panel', item.id),
      }));
    });

    return scale;
  }

  // ---------------------------------------------------------------------------
  // Dráha Ramena — podklad je celá deska (0…lengthMM), body jsou ramena.
  // ---------------------------------------------------------------------------
  function buildArmsTrackScale(state, lengthMM) {
    const scale = makeEl('div', 'mono-scale');

    const bed = makeEl('div', 'mono-track-bed');
    bed.style.left = '0%';
    bed.style.right = '0%';
    bed.appendChild(makeEl('span', 'mono-track-bed-label', tt('mono.bedDesk', {
      from: 0, to: Math.round(lengthMM),
    })));
    scale.appendChild(bed);

    (state.arms || []).forEach((arm) => {
      scale.appendChild(buildPoint({
        iconKey: 'arm',
        xMM: arm.positionXMM,
        lengthMM,
        selected: !!selected && selected.layer === 'arms' && selected.id === arm.id,
        title: tt('arms.itemTitle', { id: arm.id }),
        onClick: () => handleSelect('arms', arm.id),
      }));
    });

    return scale;
  }

  // ---------------------------------------------------------------------------
  // Pruhy parametrů vybrané položky
  // ---------------------------------------------------------------------------
  function buildHerdblokParamBar(layout) {
    if (!selected || selected.layer !== 'herdblok') return null;
    const index = layout.herdblok.findIndex((entry) => entry.item && entry.item.id === selected.id);
    if (index === -1) return null;
    const { item, widthMM } = layout.herdblok[index];
    const isSurface = item.type === 'surface';

    const bar = makeEl('div', 'mono-param-bar');
    bar.appendChild(makeEl('span', 'mono-param-title', isSurface ? tt('mono.item.surface') : resolveDeviceName(item.type)));

    const fields = makeEl('div', 'mono-param-fields');
    // Šířka je jen zobrazená, ne editovatelná — stejně jako v mockupu (šířku
    // katalogového přístroje odsud beztak nejde ověřit proti def.widthAdjustable,
    // viz hlavička modulu).
    fields.appendChild(paramField(tt('field.width'), paramDisplay(tt('catalog.widthExact', { mm: Math.round(widthMM) }))));
    fields.appendChild(paramField(tt('mono.field.frontOffset'), paramNumberInput(
      item.frontOffsetMM != null ? item.frontOffsetMM : 100,
      {
        min: 0,
        fieldKey: `herdblok:${item.id}:frontOffsetMM`,
        onCommit: (n) => callbacks.onMonoUpdate?.('herdblok', item.id, { frontOffsetMM: n }),
      },
    )));
    fields.appendChild(paramField(tt('mono.field.guard'), paramNumberInput(
      item.guardMM != null ? item.guardMM : 50,
      {
        min: 0,
        fieldKey: `herdblok:${item.id}:guardMM`,
        onCommit: (n) => callbacks.onMonoUpdate?.('herdblok', item.id, { guardMM: n }),
      },
    )));
    bar.appendChild(fields);
    // Šipky přeuspořádání odtud odešly na dlaždice (viz appendSwapControls
    // v buildHerdblokScale) — úkol 5, PREDANI.md: pruh parametrů existuje
    // až po výběru, ale přeuspořádání je operace nad ŘADOU a musí být
    // vidět bez výběru.
    bar.appendChild(buildTrashButton(() => callbacks.onMonoRemove?.('herdblok', item.id)));
    return bar;
  }

  // Zadavatel (bod 2): tlačítko pro založení prázdného prostoru přímo v pásu,
  // obdobné „+ Přidat prvek do panelu" u Čelního panelu — proto (na rozdíl od
  // Herdbloku) bar existuje i BEZ výběru položky, aby bylo tlačítko pořád
  // vidět (stejná konvence jako buildPanelParamBar).
  function buildPodestavbyParamBar(layout) {
    const bar = makeEl('div', 'mono-param-bar');
    const index = selected && selected.layer === 'podestavby'
      ? layout.podestavby.findIndex((entry) => entry.item && entry.item.id === selected.id)
      : -1;

    if (index !== -1) {
      const { item, widthMM } = layout.podestavby[index];
      const isGap = item.kind === 'gap';

      bar.appendChild(makeEl('span', 'mono-param-title', isGap ? tt('mono.item.gap') : tt('mono.item.cabinet')));

      const fields = makeEl('div', 'mono-param-fields');
      fields.appendChild(paramField(tt('field.width'), paramNumberInput(Math.round(widthMM), {
        min: 0,
        fieldKey: `podestavby:${item.id}:widthMM`,
        onCommit: (n) => callbacks.onMonoUpdate?.('podestavby', item.id, { widthMM: n }),
      })));

      if (!isGap) {
        fields.appendChild(paramField(tt('field.baseType'), paramSelect(
          BODY_STYLE_OPTIONS, item.bodyStyle, (v) => tt(`bodyStyle.${v}`),
          `podestavby:${item.id}:bodyStyle`,
          (v) => callbacks.onMonoUpdate?.('podestavby', item.id, { bodyStyle: v }),
        )));
        fields.appendChild(paramField(tt('field.plinth'), paramSelect(
          PLINTH_TYPES, item.plinth, (v) => tt(`plinth.${v}`),
          `podestavby:${item.id}:plinth`,
          (v) => callbacks.onMonoUpdate?.('podestavby', item.id, { plinth: v }),
        )));
        fields.appendChild(paramField(tt('field.finish'), paramSelect(
          FINISH_TYPES, item.finish, (v) => v,
          `podestavby:${item.id}:finish`,
          (v) => callbacks.onMonoUpdate?.('podestavby', item.id, { finish: v }),
        )));
      }

      bar.appendChild(fields);
      // Šipky přeuspořádání odtud odešly na dlaždice, viz stejná poznámka
      // v buildHerdblokParamBar výše.
      bar.appendChild(buildTrashButton(() => callbacks.onMonoRemove?.('podestavby', item.id)));
    }

    // Tlačítko „volný prostor" tu ZÁMĚRNĚ NENÍ. Krátce tu bylo, ale zadavatel
    // ho odmítl: „z uživatelského hlediska je to prostě další podestavba,
    // která je ale prázdná — ať je pro přidání jen na levém pásu, kde budou
    // varianty podestaveb." Prázdný prostor se tedy přidává VÝHRADNĚ z palety
    // v levém panelu, mezi ostatními druhy podestaveb (viz MONO_TAB_SPECIALS
    // v ui.js). Dvě různá místa pro tutéž věc uživatele jen mátla.
    return bar;
  }

  function buildPanelParamBar(layout) {
    const bar = makeEl('div', 'mono-param-bar');
    const laid = selected && selected.layer === 'panel' ? findLaidItem(layout.panelItems, selected.id) : null;

    if (laid) {
      const { item, xMM } = laid;
      const isCEE = item.kind === 'socketCEE';
      const kindLabel = tt(isCEE ? 'mono.panel.socketCEE' : 'mono.panel.socket230');

      bar.appendChild(makeEl('span', 'mono-param-title', kindLabel));

      const fields = makeEl('div', 'mono-param-fields');
      fields.appendChild(paramField(tt('mono.field.posX'), paramNumberInput(Math.round(xMM), {
        min: Math.round(layout.usableFromMM),
        max: Math.round(layout.usableToMM),
        fieldKey: `panel:${item.id}:xMM`,
        onCommit: (n) => callbacks.onMonoUpdate?.('panel', item.id, { xMM: n }),
      })));
      fields.appendChild(paramField(tt('mono.field.heightInPanel'), paramNumberInput(
        item.heightMM != null ? item.heightMM : 100,
        {
          min: 0,
          fieldKey: `panel:${item.id}:heightMM`,
          onCommit: (n) => callbacks.onMonoUpdate?.('panel', item.id, { heightMM: n }),
        },
      )));
      fields.appendChild(paramField(tt('mono.field.itemType'), paramDisplay(kindLabel)));
      bar.appendChild(fields);
    }

    // „+ Přidat prvek do panelu" je v mockupu vždy vidět (na rozdíl od
    // Herdbloku/Podestaveb se sem přidává i bez výběru v paletě) — druh
    // nového prvku přebírá od právě vybraného, jinak 230 V jako výchozí.
    const kindForAdd = laid ? laid.item.kind : 'socket230';
    const addBtn = makeButtonLike('span', 'mono-param-add', () => callbacks.onMonoAdd?.('panel', kindForAdd));
    addBtn.textContent = tt('mono.panel.addItem');
    bar.appendChild(addBtn);

    if (laid) {
      bar.appendChild(buildTrashButton(() => callbacks.onMonoRemove?.('panel', laid.item.id)));
    }
    return bar;
  }

  function buildArmsParamBar(state) {
    const bar = makeEl('div', 'mono-param-bar');
    const isIsland = state.variant === 'island';
    const arm = selected && selected.layer === 'arms'
      ? (state.arms || []).find((a) => a.id === selected.id)
      : null;

    if (arm) {
      bar.appendChild(makeEl('span', 'mono-param-title', tt('arms.itemTitle', { id: arm.id })));

      const fields = makeEl('div', 'mono-param-fields');
      fields.appendChild(paramField(tt('arms.posLabel'), paramNumberInput(arm.positionXMM, {
        min: 0,
        max: Math.round((state.dimensions && state.dimensions.lengthMM) || 0),
        step: 10,
        fieldKey: `arm:${arm.id}:positionXMM`,
        onCommit: (n) => callbacks.onArmPositionChange?.(arm.id, n),
      })));

      const offsetMin = isIsland ? ARM_CENTER_OFFSET_MIN : ARM_BACK_OFFSET_MIN;
      const offsetMax = isIsland ? ARM_CENTER_OFFSET_MAX : ARM_BACK_OFFSET_MAX;
      const offsetLabel = isIsland ? tt('arms.offsetCenterLabel') : tt('arms.offsetBackLabel');
      fields.appendChild(paramField(offsetLabel, paramNumberInput(arm.offsetMM, {
        min: offsetMin,
        max: offsetMax,
        step: ARM_OFFSET_STEP,
        fieldKey: `arm:${arm.id}:offsetMM`,
        onCommit: (n) => callbacks.onArmOffsetChange?.(arm.id, n),
      })));

      fields.appendChild(paramField(tt('arms.angleLabel'), paramNumberInput(arm.angleDeg, {
        min: ARM_ANGLE_MIN,
        max: ARM_ANGLE_MAX,
        step: 1,
        fieldKey: `arm:${arm.id}:angleDeg`,
        onCommit: (n) => callbacks.onArmAngleChange?.(arm.id, n),
      })));
      bar.appendChild(fields);
    }

    const addBtn = makeButtonLike('span', 'mono-param-add', () => callbacks.onAddArm?.());
    addBtn.textContent = tt('arms.addBtn');
    bar.appendChild(addBtn);

    if (arm) {
      bar.appendChild(buildTrashButton(() => callbacks.onRemoveArm?.(arm.id), tt('arms.remove')));
    }
    return bar;
  }

  // ---------------------------------------------------------------------------
  // Záložka Límce — formulář, žádná dráha (zadání §3).
  // ---------------------------------------------------------------------------
  function limecSwitchRow(labelText, isOn, onChange) {
    const row = makeEl('div', 'mono-limec-row');
    row.appendChild(makeEl('label', null, labelText));

    const switchEl = makeEl('div', 'mono-switch');
    const offSpan = makeButtonLike('span', isOn ? '' : 'mono-switch-on', () => onChange(false));
    offSpan.textContent = tt('mono.collar.off');
    const onSpan = makeButtonLike('span', isOn ? 'mono-switch-on' : '', () => onChange(true));
    onSpan.textContent = tt('mono.collar.on');
    switchEl.appendChild(offSpan);
    switchEl.appendChild(onSpan);
    row.appendChild(switchEl);
    return row;
  }

  /** Půdorysné schéma límců — jen grafika (žádný natvrdo psaný text uvnitř
   *  SVG, viz i18n pravidlo); solid+plná barva = zapnuto, přerušovaně = ne,
   *  stejná konvence jako mockup. <title> nese přístupný název (§ „Límce"). */
  function buildLimecDiagram(collar) {
    const rect = (x, y, w, h, on) => (on
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="3 3"/>`);

    const inner = '<rect x="20" y="24" width="200" height="72" rx="3" fill="var(--bg-input)" stroke="var(--border)" stroke-width="1.5"/>'
      + rect(20, 24, 200, 9, !!collar.back)
      + rect(20, 24, 9, 72, !!collar.left)
      + rect(211, 24, 9, 72, !!collar.right);

    const el = svg('0 0 240 118', inner, {});
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = tt('mono.collar.title');
    el.insertBefore(title, el.firstChild);
    return el;
  }

  function buildLimecPanel(monoState) {
    const panel = makeEl('div', 'mono-panel');
    panel.hidden = activeTab !== 'limec';

    const collar = monoState.limec || {};
    const leftAllowed = readEndType(monoState.leftEndType) === END_TYPE_VERTICAL;
    const rightAllowed = readEndType(monoState.rightEndType) === END_TYPE_VERTICAL;

    const body = makeEl('div', 'mono-limec-body');
    const opts = makeEl('div', 'mono-limec-opts');

    opts.appendChild(limecSwitchRow(tt('mono.collar.back'), !!collar.back,
      (v) => callbacks.onMonoCollarChange?.({ back: v })));

    const leftRow = limecSwitchRow(tt('mono.collar.left'), !!collar.left,
      (v) => callbacks.onMonoCollarChange?.({ left: v }));
    if (!leftAllowed) leftRow.appendChild(makeEl('span', null, ` ${tt('mono.collar.chamferNote')}`));
    opts.appendChild(leftRow);

    const rightRow = limecSwitchRow(tt('mono.collar.right'), !!collar.right,
      (v) => callbacks.onMonoCollarChange?.({ right: v }));
    if (!rightAllowed) rightRow.appendChild(makeEl('span', null, ` ${tt('mono.collar.chamferNote')}`));
    opts.appendChild(rightRow);

    const heightRow = makeEl('div', 'mono-limec-row');
    heightRow.appendChild(makeEl('label', null, tt('mono.collar.height')));
    heightRow.appendChild(paramNumberInput(collar.heightMM != null ? collar.heightMM : 100, {
      min: 40,
      max: 300,
      fieldKey: 'limec:heightMM',
      onCommit: (n) => callbacks.onMonoCollarChange?.({ heightMM: n }),
    }));
    heightRow.appendChild(makeEl('span', null, 'mm')); // fyzikální jednotka, stejně jako .dim-unit v bočním panelu
    heightRow.appendChild(makeEl('span', null, ` ${tt('mono.collar.range')}`));
    opts.appendChild(heightRow);

    opts.appendChild(limecSwitchRow(tt('mono.collar.alignSide'), collar.alignSide !== false,
      (v) => callbacks.onMonoCollarChange?.({ alignSide: v })));

    body.appendChild(opts);

    const diagram = makeEl('div', 'mono-limec-diagram');
    diagram.appendChild(buildLimecDiagram(collar));
    body.appendChild(diagram);

    panel.appendChild(body);
    // Pozn.: mockup má pod diagramem ještě .mk-param-bar s délkou/tloušťkou/
    // odsazením zadního límce — MonoCollar (zadání §1) žádné takové pole
    // nemá (jen back/left/right/heightMM/alignSide, všechno už výš), takže
    // bych ta čísla musel vymyslet. Radši žádný pruh než vymyšlená data.
    return panel;
  }

  // ---------------------------------------------------------------------------
  // Vodorovné posouvání dráhy (úkol 11, varianta B1 — PREDANI.md,
  // mockup-pas-varianty.html). Pravítko i obě dráhy leží v JEDNOM scroll
  // kontejneru (.mono-track-scroll), takže se posouvají SPOLEČNĚ — kdyby se
  // posouvala jen dráha a pravítko zůstalo, měřítko by přestalo sedět
  // (tvrdá podmínka zadání). `.mono-track-viewport` je vnější obal, na
  // kterém sedí zeslabující přechod + šipka (.mono-track-fade) jako
  // NEPOSOUVANÝ překryv — kdyby byl uvnitř scroll kontejneru, odscrolloval
  // by pryč spolu s obsahem, a to je proti smyslu náznaku „ještě něco je".
  // overflow-y je EXPLICITNĚ hidden (past z PREDANI.md ČÁST A2: overflow-x:
  // auto by jinak povýšilo i svislou osu na auto). Padding uvnitř scroll
  // kontejneru (ne na .mono-panel) rezervuje místo pro koncovky Herdbloku,
  // které přesahují za hranu dráhy (transform ∓52 %, -50 %) — kdyby ho
  // neměl, levá koncovka by se při scrollLeft=0 utrhla do záporných
  // souřadnic a nikdy by se k ní nedalo doscrollovat zpátky.
  // ---------------------------------------------------------------------------
  function buildTrackViewport(rows) {
    const viewport = makeEl('div', 'mono-track-viewport');
    const scroll = makeEl('div', 'mono-track-scroll');
    rows.forEach((row) => scroll.appendChild(row));
    viewport.appendChild(scroll);

    const fade = makeEl('div', 'mono-track-fade');
    fade.setAttribute('aria-hidden', 'true'); // čistě vizuální náznak, žádný text (viz mockup .mk-b1-fade)
    fade.appendChild(svg('0 0 24 24', ICON_INNER.chevronRight, {
      'stroke-width': '2.4', 'stroke-linecap': 'round',
    }));
    viewport.appendChild(fade);

    return viewport;
  }

  /** Po vložení do živého DOM (viz renderAll) změří, jestli dráha skutečně
   *  přetéká, a podle toho zapne/vypne třídu s náznakem (.mono-track-fade
   *  se BEZ ní v CSS nezobrazuje — zbytečný náznak scrollování tam, kde
   *  není co scrollovat, by jen matl). Musí běžet AŽ PO připojení k
   *  els.body, jinak scrollWidth/clientWidth vrátí 0 (neplacovaný uzel). */
  function updateTrackOverflowHints(root) {
    root.querySelectorAll('.mono-track-viewport').forEach((viewport) => {
      const scroll = viewport.querySelector('.mono-track-scroll');
      if (!scroll) return;
      const overflowing = scroll.scrollWidth > scroll.clientWidth + 1;
      viewport.classList.toggle('mono-track-viewport-overflow', overflowing);
    });
  }

  // ---------------------------------------------------------------------------
  // Sestavení čtyř panelů (Herdblok+Podestavby sdílejí jeden, přesně jako
  // v mockupu) a záložek.
  // ---------------------------------------------------------------------------
  function buildHerdPodePanel(monoState, layout, lengthMM) {
    const panel = makeEl('div', 'mono-panel');
    panel.hidden = !(activeTab === 'herdblok' || activeTab === 'podestavby');

    panel.appendChild(buildTrackViewport([
      buildRuler(lengthMM),
      trackRow(tt('mono.tab.herdblok'), buildHerdblokScale(monoState, layout, lengthMM, {
        selectable: activeTab === 'herdblok',
        dim: activeTab !== 'herdblok',
        showEndcaps: true,
      })),
      trackRow(tt('mono.tab.podestavby'), buildPodestavbyScale(layout, lengthMM, {
        selectable: activeTab === 'podestavby',
        dim: activeTab !== 'podestavby',
      })),
    ]));

    panel.appendChild(makeEl('p', 'mono-track-note', tt('mono.endZoneNote', {
      left: Math.round(layout.leftInsetMM), right: Math.round(layout.rightInsetMM),
    })));

    const bar = activeTab === 'herdblok' ? buildHerdblokParamBar(layout) : buildPodestavbyParamBar(layout);
    if (bar) panel.appendChild(bar);

    return panel;
  }

  function buildPanelPanel(state, monoState, layout, lengthMM) {
    const panel = makeEl('div', 'mono-panel');
    panel.hidden = activeTab !== 'panel';

    panel.appendChild(buildTrackViewport([
      buildRuler(lengthMM),
      buildContextHerdblokRow(monoState, layout, lengthMM),
      trackRow(tt('mono.tab.panel'), buildPanelTrackScale(layout, lengthMM)),
    ]));
    panel.appendChild(makeEl('p', 'mono-track-note', tt('mono.panelNote')));
    panel.appendChild(buildPanelParamBar(layout));

    return panel;
  }

  function buildArmsPanel(state, monoState, layout, lengthMM) {
    const panel = makeEl('div', 'mono-panel');
    panel.hidden = activeTab !== 'arms';

    panel.appendChild(buildTrackViewport([
      buildRuler(lengthMM),
      buildContextHerdblokRow(monoState, layout, lengthMM),
      trackRow(tt('arms.sectionTitle'), buildArmsTrackScale(state, lengthMM)),
    ]));
    panel.appendChild(makeEl('p', 'mono-track-note', tt('mono.armsNote')));
    panel.appendChild(buildArmsParamBar(state));

    return panel;
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.textContent = '';
    TABS.forEach((key) => {
      const isActive = activeTab === key;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = isActive ? 'strip-tab active' : 'strip-tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(isActive));
      btn.textContent = tt(TAB_LABEL_KEYS[key]);
      btn.addEventListener('click', () => {
        if (activeTab === key) return;
        activeTab = key;
        callbacks.onMonoTabChange?.(activeTab);
        if (lastState) renderAll(lastState);
      });
      els.tabs.appendChild(btn);
    });
  }

  /** Skutečné (pře)vykreslení — oddělené od veřejného render(), aby ho mohly
   *  volat i vnitřní handlery (klik na záložku/položku) bez závislosti na
   *  tom, kdy příště zavolá ui.js. */
  function renderAll(state) {
    if (!els.body) return;
    const monoState = (state && state.mono) || {};
    const layout = computeMonoLayout(state);
    const lengthMM = layout.lengthMM;

    const focusInfo = captureFocus();

    renderTabs();

    els.body.textContent = '';
    els.body.appendChild(buildHerdPodePanel(monoState, layout, lengthMM));
    els.body.appendChild(buildPanelPanel(state, monoState, layout, lengthMM));
    els.body.appendChild(buildLimecPanel(monoState));
    els.body.appendChild(buildArmsPanel(state, monoState, layout, lengthMM));

    // Musí běžet AŽ PO připojení výše — viz komentář u updateTrackOverflowHints.
    updateTrackOverflowHints(els.body);

    restoreFocus(focusInfo);
  }

  function render(state) {
    lastState = state;
    renderAll(state);
  }

  function reset() {
    activeTab = 'herdblok';
    selected = null;
    lastState = null;
    if (els.body) els.body.textContent = '';
    if (els.tabs) els.tabs.textContent = '';
  }

  return { render, reset };
}
