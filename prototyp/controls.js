// controls.js — ovládací panel vygenerovaný z params.js.
//
// Panel se NEPÍŠE ručně: projde PARAMS/CHOICES a pro každou položku vyrobí
// řádek. Přidání nového posuvníku je tedy přidání jedné položky do params.js.
//
// Nejisté parametry (certainty: 'uncertain') jsou barevně odlišené — to jsou
// čísla, která se mají v prototypu doladit tahem a odečíst.

import { PARAMS, CHOICES, GROUPS, CERTAINTY, derivedReadout } from './params.js';

/**
 * Postaví panel do zadaného kontejneru.
 * @param {HTMLElement} root kontejner panelu
 * @param {Record<string,number>} values číselné hodnoty (mění se na místě)
 * @param {Record<string,string>} choices volby (mění se na místě)
 * @param {(key:string)=>void} onChange volá se po každé změně
 * @returns {{refreshDerived:(extra:object)=>void}}
 */
export function buildControls(root, values, choices, onChange) {
  root.innerHTML = '';

  // --- záhlaví --------------------------------------------------------------
  const head = el('div', 'panel-head');
  head.appendChild(el('h1', null, 'ALBA MONO — prototyp geometrie'));
  const legend = el('div', 'legend');
  for (const key of ['spec', 'derived', 'uncertain', 'proto']) {
    const item = el('span', `legend-item ${CERTAINTY[key].css}`);
    item.appendChild(el('span', 'dot'));
    item.appendChild(document.createTextNode(CERTAINTY[key].label));
    legend.appendChild(item);
  }
  head.appendChild(legend);
  root.appendChild(head);

  // --- přepínače ------------------------------------------------------------
  const sw = el('div', 'switches');
  for (const c of CHOICES) {
    const row = el('div', 'switch-row');
    row.appendChild(el('div', 'switch-label', c.label));
    const group = el('div', 'switch-group');
    for (const opt of c.options) {
      const b = el('button', 'switch-btn', opt.label);
      b.type = 'button';
      b.dataset.key = c.key;
      b.dataset.value = opt.value;
      if (choices[c.key] === opt.value) b.classList.add('active');
      b.addEventListener('click', () => {
        choices[c.key] = opt.value;
        group.querySelectorAll('.switch-btn').forEach((x) => x.classList.toggle('active', x.dataset.value === opt.value));
        onChange(c.key);
      });
      group.appendChild(b);
    }
    row.appendChild(group);
    sw.appendChild(row);
  }
  root.appendChild(sw);

  // --- akce -----------------------------------------------------------------
  const actions = el('div', 'actions');
  const dumpBtn = el('button', 'action-btn primary', 'Vypsat hodnoty');
  dumpBtn.type = 'button';
  dumpBtn.id = 'dump-btn';
  const resetBtn = el('button', 'action-btn', 'Zpět na výchozí');
  resetBtn.type = 'button';
  actions.appendChild(dumpBtn);
  actions.appendChild(resetBtn);
  root.appendChild(actions);

  const dump = el('pre', 'dump');
  dump.id = 'dump-output';
  dump.hidden = true;
  root.appendChild(dump);

  dumpBtn.addEventListener('click', () => {
    const payload = {
      parametry: { ...values },
      volby: { ...choices },
      dopocty: Object.fromEntries(
        derivedReadout(values, choices, window.PROTO ? window.PROTO.checks : {})
          .map((r) => [r.label, r.value])
      ),
    };
    const text = JSON.stringify(payload, null, 2);
    console.log('ALBA MONO — parametry prototypu', payload);
    console.log(text);
    dump.hidden = false;
    dump.textContent = text;
    dump.scrollIntoView({ block: 'nearest' });
  });

  resetBtn.addEventListener('click', () => {
    for (const p of PARAMS) setValue(p.key, p.value);
    for (const c of CHOICES) {
      choices[c.key] = c.value;
      root.querySelectorAll(`.switch-btn[data-key="${c.key}"]`)
        .forEach((b) => b.classList.toggle('active', b.dataset.value === c.value));
    }
    onChange('*');
  });

  // --- dopočty --------------------------------------------------------------
  const derivedBox = el('div', 'derived');
  derivedBox.appendChild(el('h2', null, 'Dopočtené hodnoty'));
  const derivedList = el('div', 'derived-list');
  derivedBox.appendChild(derivedList);
  root.appendChild(derivedBox);

  // --- skupiny parametrů ----------------------------------------------------
  const inputs = new Map();
  for (const grp of GROUPS) {
    const list = PARAMS.filter((p) => p.group === grp.id);
    if (list.length === 0) continue;
    const box = el('details', 'group');
    box.open = grp.id === 'deska' || grp.id === 'panel' || grp.id === 'vysky';
    const sum = el('summary', null, grp.label);
    const nUncertain = list.filter((p) => p.certainty === 'uncertain').length;
    if (nUncertain > 0) sum.appendChild(el('span', 'badge', `${nUncertain} nejistých`));
    box.appendChild(sum);
    for (const p of list) box.appendChild(paramRow(p));
    root.appendChild(box);
  }

  function paramRow(p) {
    const row = el('div', `param ${CERTAINTY[p.certainty].css}`);
    const label = el('label', 'param-label', p.label);
    label.htmlFor = `num-${p.key}`;
    label.title = p.note;
    row.appendChild(label);

    const line = el('div', 'param-line');
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(p.min);
    range.max = String(p.max);
    range.step = String(p.step);
    range.value = String(values[p.key]);
    range.id = `range-${p.key}`;
    range.dataset.key = p.key;

    const num = document.createElement('input');
    num.type = 'number';
    num.min = String(p.min);
    num.max = String(p.max);
    num.step = String(p.step);
    num.value = String(values[p.key]);
    num.id = `num-${p.key}`;
    num.dataset.key = p.key;

    const unit = el('span', 'param-unit', p.unit);

    const apply = (raw, from) => {
      let v = Number(raw);
      if (!Number.isFinite(v)) return;
      v = Math.min(p.max, Math.max(p.min, v));
      values[p.key] = v;
      if (from !== 'range') range.value = String(v);
      if (from !== 'num') num.value = String(v);
      onChange(p.key);
    };
    range.addEventListener('input', () => apply(range.value, 'range'));
    num.addEventListener('input', () => apply(num.value, 'num'));
    num.addEventListener('change', () => apply(num.value, 'num'));

    line.appendChild(range);
    line.appendChild(num);
    line.appendChild(unit);
    row.appendChild(line);
    row.appendChild(el('div', 'param-note', p.note));

    inputs.set(p.key, { range, num, def: p });
    return row;
  }

  function setValue(key, v) {
    const e = inputs.get(key);
    values[key] = v;
    if (e) { e.range.value = String(v); e.num.value = String(v); }
  }

  function refreshDerived(extra) {
    derivedList.innerHTML = '';
    for (const r of derivedReadout(values, choices, extra || {})) {
      const line = el('div', `derived-row${r.warn ? ' warn' : ''}`);
      line.appendChild(el('span', 'derived-label', r.label));
      line.appendChild(el('span', 'derived-value', `${r.value} ${r.unit}`));
      derivedList.appendChild(line);
    }
  }

  return { refreshDerived, setValue };
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
