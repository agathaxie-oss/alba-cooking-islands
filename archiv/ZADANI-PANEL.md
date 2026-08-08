# Zadání: horní část levého panelu — projekt, varianta, rozměry

**Stav:** NEIMPLEMENTOVÁNO. Návrh schválen uživatelem 30. 7. 2026.
**Rozsah:** zpřehlednit a zmenšit tři horní části bočního panelu.
Nic jiného v aplikaci se nemění.

---

## 0. Jak s tímto dokumentem pracovat

Přečti ho celý, než začneš. Rozhodnutí v §2 uživatel schválil po třech
kolech návrhů — **neotvírej je znovu a nic k nim nepřidávej.** Zejména:
**žádné schéma, nákres ani SVG kresba bloku.** Uživatel dvě varianty
nákresu viděl a výslovně je zamítl ve prospěch samotných textových polí.

Doprovodné dokumenty: `ZADANI-UI.md` (redesign UI — pozor, §3 a §8 jsou
už neaktuální, viz §9 níže), `ZADANI-KATALOG.md`, `SPEC.md`.

---

## 1. Proč se to dělá — naměřený stav

Na 1280×900, panel široký 240 px a vysoký 848 px:

| Sekce | Výška |
|---|---|
| Projekt | 182 px |
| Rozměry bloku (jednostranný) | 387 px |
| Rozměry bloku (ostrovní) | 451 px |
| Přidat prvek (paleta) | 696 px |

Paleta tedy začíná **569 px** od horního okraje a je z ní vidět jen
**279 px**. Celý panel se roluje v poměru 1,6.

Uživatelovy tři výtky, doslova: horní část je „příliš ukecaná a zbytečně
odsouvá katalog"; přepínač varianty je potřeba „zpřehlednit a uskrovnit";
rozměry jsou „nenázorné, zmatené a zbytečně roztažené".

**Ověřený fakt, na kterém stojí největší škrt:** v `js/block.js`
prochází `lengthMM` i `heightMM` do modelu beze změny
(`lengthMM: Math.round(lengthMM)`), takže řádky „Celková délka"
a „Pracovní výška" v souhrnu **vždy** jen opakují hodnotu, kterou
uživatel právě napsal o kus výš. Jediná hodnota, která se od zadání může
lišit, je hloubka — roste kvůli hlubšímu přístroji (`depthGrownA/B`,
`js/block.js:282`) — a na to už existuje samostatné upozornění
`#depth-a-grow-note` / `#depth-b-grow-note`, které **zůstává**.

Cíl: Projekt ~85 px, Rozměry ~130 px (ostrov ~165 px), paleta začne
kolem 245 px a bude jí vidět ~600 px.

---

## 2. Co se mění — ROZHODNUTO

### 2.1 Sekce Projekt
- Tři plnošířková textová tlačítka nahradí **řada tří ikon**.
- Přibude **název projektu**, upravitelný kliknutím jako v Google
  dokumentech. Ukládá se do konfigurace a předvyplňuje název souboru.
- **Tlačítko „Uložit" dělá dál obojí naráz** — zapíše do prohlížeče
  i nabídne soubor. Tohle je výslovné přání uživatele, nerozděluj to.
- **„Uložit jako…" se NEDĚLÁ.** Uživatel ho zamítl s odůvodněním, že při
  ukládání do souboru je název stejně možné upravit.

### 2.2 Přepínač varianty
- Dvě naskládané karty s dlouhými popisky nahradí **segmentový přepínač**
  se dvěma poli: „u zdi" / „ostrov". Delší popis se přesune do `title`.

### 2.3 Rozměry bloku
- Souhrnná tabulka `<dl class="dims">` **se celá odstraní**.
- Vstupy se z dvouřádkových `.field-row` (popisek nad polem) změní na
  **jednořádkové** — popisek vlevo, pole vpravo, jednotka „mm" za polem.
- U ostrovního bloku přibude **jedna tichá řádka s celkovou hloubkou**
  (součet A + B) — je to jediná odvozená hodnota, kterou nelze napsat.
- Upozornění na automaticky zvětšenou hloubku **zůstává beze změny**.
- **Žádný nákres.** Viz §0.

---

## 3. Dotčené soubory

| Soubor | Co v něm uděláš |
|---|---|
| `index.html` | přestavba sekcí Projekt a Rozměry bloku |
| `css/style.css` | styly názvu projektu, ikonové řady, segmentového přepínače, řádků rozměrů |
| `js/ui.js` | obsluha názvu projektu, zrušení odkazů na smazané prvky |
| `js/main.js` | `state.projectName`, ukládání, název souboru, nové zpětné volání |
| `js/i18n.js` | 11 nových klíčů × 5 jazyků |

**Pozor: `js/main.js` je tentokrát ve hře.** V předchozích krocích byl
mimo hru, takže se nenech zmást komentáři jinde. Do ostatních souborů
(`modules.js`, `block.js`, `viewer.js`, `arms.js`, `catalog.js`,
`floorplan.js`, `report.js`, `device-manager.js`, `custom-dialog.js`)
**nesahej**.

---

## 4. Sekce Projekt — podrobně

### 4.1 HTML

Nahraď dnešní obsah první `panel-section` v `#sidebar`:

```html
<section class="panel-section">
  <h2 data-i18n="project.sectionTitle">Project</h2>

  <div class="project-name-row">
    <input type="text" id="project-name" class="project-name" maxlength="60"
           data-i18n-placeholder="project.untitled"
           data-i18n-aria-label="project.nameLabel"
           data-i18n-title="project.nameTitle"
           placeholder="Untitled" autocomplete="off" spellcheck="false" />
    <span class="project-name-pencil" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>
    </span>
  </div>

  <div class="project-actions">
    <button type="button" id="save-config" class="icon-btn-sm"
            data-i18n-title="export.saveConfig" data-i18n-aria-label="export.saveConfig">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M5 3h10l4 4v14H5z"/><path d="M8 3v6h7V3"/><path d="M8 21v-7h8v7"/>
      </svg>
    </button>
    <button type="button" id="load-file-btn" class="icon-btn-sm"
            data-i18n-title="export.loadFile" data-i18n-aria-label="export.loadFile">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h6l2 2h10v11H3z"/><path d="M3 11h18"/>
      </svg>
    </button>
    <button type="button" id="load-storage-btn" class="icon-btn-sm"
            data-i18n-title="export.loadStorage" data-i18n-aria-label="export.loadStorage">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3.5 9A9 9 0 1 1 3 12"/><path d="M3 4v5h5"/><path d="M12 7.5V12l3.5 2"/>
      </svg>
    </button>
    <input type="file" id="load-file-input" accept="application/json" hidden />
  </div>
</section>
```

Id `save-config`, `load-file-btn`, `load-storage-btn`, `load-file-input`
**zůstávají stejná** — posluchače v `js/ui.js` na ně už existují a nemají
se přepisovat. Mění se jen jejich vzhled a titulek.

Ikony kresli **ve stylu horní lišty** (`index.html:30-63`):
`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
`stroke-width="1.8"`. Nevymýšlej jiný styl.

### 4.2 Název projektu — chování

Pole je **vždy `<input>`**, jen vypadá jako text: průhledný rámeček,
který se objeví při najetí myší a při zaostření. Nedělej přepínání
mezi `<span>` a `<input>` — je to zbytečně křehké.

- prázdná hodnota → ukáže se `placeholder` (`project.untitled`),
  do stavu se ukládá prázdný řetězec
- **Enter** → potvrdí (`blur()`)
- **Escape** → vrátí hodnotu, jaká byla před začátkem úprav, a `blur()`
  (drž si ji v proměnné při `focus`)
- `change` nebo `blur` → `callbacks.onProjectNameChange(input.value.trim())`
- tužka `.project-name-pencil` je jen ozdoba: `pointer-events: none`
  a při zaostření pole se skryje

**Kritické:** v `render(state)` se hodnota smí přepsat jen tehdy, když
uživatel zrovna nepíše — stejná pojistka, jakou už používají pole
rozměrů (`js/ui.js`, funkce `render`):

```js
if (document.activeElement !== els.projectName) {
  els.projectName.value = state.projectName || '';
}
```

### 4.3 Ukládání — `js/main.js`

Dnešní `saveConfig()` zapisuje do `localStorage` **a** rovnou stahuje
soubor s názvem `<prefix>-<timestamp>.json`. Nové chování zachovává
obojí, jen dá uživateli možnost název upravit:

```js
function projectFileName(name) {
  const base = String(name || '')
    .replace(/[\\/:*?"<>| -]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60)
    .trim();
  return (base || t('export.jsonFilenamePrefix')) + '.json';
}

async function saveConfig() {
  const json = JSON.stringify(serializeConfig(), null, 2);

  // 1) do prohlížeče — VŽDY, i když uživatel dialog na soubor zruší
  localStorage.setItem(STORAGE_KEY, json);

  // 2) do souboru, s možností upravit název
  const suggested = projectFileName(state.projectName);
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch (err) {
      // zrušení dialogu NENÍ chyba a nesmí nic hlásit
      if (err && err.name === 'AbortError') { ui.render(state); return; }
      downloadJson(json, suggested); // jiná chyba → náhradní cesta
    }
  } else {
    const entered = window.prompt(t('project.filenamePrompt'), suggested);
    if (entered === null) { ui.render(state); return; } // zrušeno
    const name = entered.trim().toLowerCase().endsWith('.json')
      ? entered.trim() : entered.trim() + '.json';
    downloadJson(json, projectFileName(name.replace(/\.json$/i, '')));
  }

  ui.render(state);
}
```

`downloadJson(json, filename)` je dnešní stahovací část `saveConfig()`
vytažená do vlastní funkce (Blob → odkaz → klik → `revokeObjectURL`).

Poznámky, které nepřehlédni:
- `showSaveFilePicker` je jen v Chromiu (Chrome, Edge) a **jen v zabezpečeném
  kontextu** — `localhost` se za zabezpečený považuje, takže při vývoji
  funguje. Ve Firefoxu a Safari se použije `prompt` + stažení.
- Musí se volat **z obsluhy kliknutí** (uživatelské gesto). `saveConfig`
  je nově `async`; posluchač ji zavolá a případné odmítnutí spolkne:
  `saveConfig().catch((e) => console.error(e))`.
- **Zrušení dialogu nesmí nic hlásit ani zapisovat do konzole jako chybu.**
- Zápis do `localStorage` se dělá **před** dialogem, takže i po zrušení
  je práce uložená v prohlížeči — to je smysl „jedno tlačítko dělá obojí".

### 4.4 Název projektu ve stavu — `js/main.js`

- do stavu přidej `projectName: ''` (vedle `selectedId` apod.)
- `serializeConfig()` doplní `projectName: state.projectName`
- `applyConfig(cfg)` doplní
  `state.projectName = typeof cfg.projectName === 'string' ? cfg.projectName.slice(0, 60) : '';`
  — starší uložené soubory pole nemají a **musí se otevřít bez chyby**
- nové zpětné volání v objektu předávaném do `setupUI`:
  ```js
  onProjectNameChange(name) {
    state.projectName = String(name || '').slice(0, 60);
    ui.render(state);
  },
  ```
  `rebuildBlock()` se **nevolá** — název nemá na geometrii vliv.

---

## 5. Přepínač varianty — podrobně

**Radio vstupy `#variant-single` a `#variant-island` musí zůstat**
i s dnešními posluchači v `js/ui.js` — mění se jen vzhled a délka textu.
Tím se nedotkneš logiky přepínání varianty vůbec.

```html
<div class="variant-segmented" role="group"
     data-i18n-aria-label="dims.sectionTitle">
  <label class="variant-seg" data-i18n-title="variant.single">
    <input type="radio" name="variant" id="variant-single" value="single" checked />
    <span data-i18n="variant.singleShort">against wall</span>
  </label>
  <label class="variant-seg" data-i18n-title="variant.island">
    <input type="radio" name="variant" id="variant-island" value="island" />
    <span data-i18n="variant.islandShort">island</span>
  </label>
</div>
```

Aktivní pole se pozná přes `:has(input:checked)` — stejný mechanismus,
jaký dnes používá `.radio-label`. Samotné `<input type="radio">` se
vizuálně skryje (ne `display: none` — to by ho vyřadilo z obsluhy
klávesnicí; použij `position: absolute; opacity: 0`).

Dlouhé popisky (`variant.single` = „Jednostranný blok (u zdi)") zůstávají
v `i18n.js` a používají se jako `title`.

---

## 6. Rozměry bloku — podrobně

### 6.1 HTML

Nahraď dnešní `.field-row` bloky a **smaž celý `<dl class="dims">`**:

```html
<div class="dim-row">
  <label for="input-length" data-i18n="field.lengthShort">Length</label>
  <input type="number" id="input-length" min="1200" max="6000" step="50" value="3200" />
  <span class="dim-unit">mm</span>
</div>
<div class="dim-row">
  <label for="input-depth-a" id="depth-a-label" data-i18n="field.depthShort">Depth</label>
  <input type="number" id="input-depth-a" min="500" max="1200" step="10" value="850" />
  <span class="dim-unit">mm</span>
</div>
<p id="depth-a-grow-note" class="field-note" hidden></p>
<div class="dim-row" id="depth-b-row" hidden>
  <label for="input-depth-b" data-i18n="field.depthBShort">Depth B</label>
  <input type="number" id="input-depth-b" min="500" max="1200" step="10" value="850" />
  <span class="dim-unit">mm</span>
</div>
<p id="depth-b-grow-note" class="field-note" hidden></p>
<div class="dim-row">
  <label for="input-height" data-i18n="field.heightShort">Work height</label>
  <input type="number" id="input-height" min="850" max="950" step="10" value="900" />
  <span class="dim-unit">mm</span>
</div>
<p id="dims-total-depth" class="dims-total" hidden></p>
```

Všechna id vstupů i pomocných prvků zůstávají, aby se nemusely měnit
posluchače. Meze `min`/`max`/`step` **nesahej**, jsou to hodnoty ze SPEC.

### 6.2 `js/ui.js` — co v `render(state)` upravit

- **Smaž** odkazy `dimLength`, `dimDepth`, `dimHeight`, `dimDepthBreakdown`
  z objektu `els` i řádky v `render()`, které je plnily. Prvky už neexistují.
- Popisek hloubky A přepínej mezi `field.depthShort` a `field.depthAShort`
  (dnes se přepíná mezi `field.depth` a `field.depthA`):
  ```js
  els.depthALabel.textContent = isIsland ? t('field.depthAShort') : t('field.depthShort');
  ```
- Nová řádka s celkovou hloubkou:
  ```js
  els.dimsTotalDepth.hidden = !isIsland;
  if (isIsland) {
    els.dimsTotalDepth.textContent = t('dims.totalDepth', { mm: state.builtDimensions.depthMM });
  }
  ```
- Poznámky o zvětšené hloubce (`depthAGrowNote`, `depthBGrowNote`)
  nech přesně jak jsou.

**Nejdřív si ověř `grep`em, že `dim-length`, `dim-depth`, `dim-height`
a `dim-depth-breakdown` nepoužívá žádný jiný soubor** (`report.js`
i `floorplan.js` čtou stav, ne DOM — ale ověř to, ne předpokládej).

---

## 7. CSS

Používej **jen** existující proměnné z `:root`. Žádné nové barvy.
`.action-btn`, `.field-row`, `.dims`, `.radio-label` a `.variant-toggle`
v CSS **nech být** — používají je dialogy a jiné části panelu.

```css
/* --- název projektu ------------------------------------------------------ */

.project-name-row {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.project-name {
  width: 100%;
  padding: 5px 26px 5px 8px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-main);
  background: var(--bg-input);
  border: 1px solid transparent;
  border-radius: var(--radius);
  text-overflow: ellipsis;
}

.project-name:hover {
  border-color: var(--border);
}

.project-name:focus {
  outline: none;
  background: var(--bg-panel);
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.project-name::placeholder {
  color: var(--text-muted);
}

.project-name-pencil {
  position: absolute;
  right: 7px;
  display: flex;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.project-name-pencil svg {
  width: 14px;
  height: 14px;
}

.project-name:focus + .project-name-pencil {
  display: none;
}

/* --- řada ikon projektu -------------------------------------------------- */

.project-actions {
  display: flex;
  gap: 6px;
}

.icon-btn-sm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  color: var(--text-main);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}

.icon-btn-sm svg {
  width: 18px;
  height: 18px;
}

.icon-btn-sm:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-dark);
}

.icon-btn-sm:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.icon-btn-sm:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* --- segmentový přepínač varianty ---------------------------------------- */

.variant-segmented {
  display: flex;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.variant-seg {
  flex: 1;
  position: relative;
  padding: 5px 4px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-muted);
  cursor: pointer;
}

/* vstup zůstává dostupný klávesnici, jen není vidět */
.variant-seg input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.variant-seg:hover {
  color: var(--accent-dark);
}

.variant-seg:has(input:checked) {
  background: var(--accent-dark);
  color: #FFFFFF;
}

.variant-seg:has(input:focus-visible) {
  box-shadow: inset 0 0 0 2px var(--accent-soft);
}

/* --- řádky rozměrů ------------------------------------------------------- */

.dim-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}

.dim-row label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dim-row input[type="number"] {
  width: 66px;
  flex-shrink: 0;
  padding: 3px 6px;
  font-family: inherit;
  font-size: 12px;
  text-align: right;
  color: var(--text-main);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.dim-row input[type="number"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.dim-unit {
  flex-shrink: 0;
  width: 18px;
  font-size: 11px;
  color: var(--text-muted);
}

.dims-total {
  margin: 4px 0 0;
  text-align: right;
  font-size: 11px;
  color: var(--text-muted);
}

.dims-total[hidden] {
  display: none;
}
```

---

## 8. i18n — 11 nových klíčů × 5 jazyků

Do každého z pěti jazykových bloků. **Žádný jazyk nevynechávej.**

| Klíč | en | de | pl | cs | sk |
|---|---|---|---|---|---|
| `project.untitled` | Untitled | Ohne Titel | Bez nazwy | Bez názvu | Bez názvu |
| `project.nameLabel` | Project name | Projektname | Nazwa projektu | Název projektu | Názov projektu |
| `project.nameTitle` | Click to rename the project | Zum Umbenennen klicken | Kliknij, aby zmienić nazwę | Kliknutím projekt přejmenujete | Kliknutím projekt premenujete |
| `project.filenamePrompt` | File name | Dateiname | Nazwa pliku | Název souboru | Názov súboru |
| `variant.singleShort` | against wall | an der Wand | przy ścianie | u zdi | pri stene |
| `variant.islandShort` | island | Insel | wyspa | ostrov | ostrov |
| `field.lengthShort` | Length | Länge | Długość | Délka | Dĺžka |
| `field.depthShort` | Depth | Tiefe | Głębokość | Hloubka | Hĺbka |
| `field.depthAShort` | Depth A | Tiefe A | Głębokość A | Hloubka A | Hĺbka A |
| `field.depthBShort` | Depth B | Tiefe B | Głębokość B | Hloubka B | Hĺbka B |
| `field.heightShort` | Work height | Arbeitshöhe | Wysokość robocza | Pracovní výška | Pracovná výška |
| `dims.totalDepth` | total depth {mm} mm | Gesamttiefe {mm} mm | głębokość całkowita {mm} mm | celková hloubka {mm} mm | celková hĺbka {mm} mm |

Existující klíče **znovupoužij, nové pro ně nezakládej**:
`project.sectionTitle`, `export.saveConfig`, `export.loadFile`,
`export.loadStorage`, `export.jsonFilenamePrefix`, `variant.single`,
`variant.island`, `dims.sectionTitle`, `notice.depthGrown`.

Staré klíče `field.length`, `field.depth`, `field.depthA`, `field.depthB`,
`field.height`, `dims.totalLength`, `dims.totalDepth*`, `dims.totalHeight`,
`dims.depthBreakdown` **nech v `i18n.js` být**, i když je nikdo nepoužívá.
(Pozor na kolizi: pokud už klíč `dims.totalDepth` existuje, pojmenuj nový
`dims.totalDepthLine` a použij ten. **Ověř to `grep`em, než začneš psát.**)

---

## 9. Co v `ZADANI-UI.md` už neplatí

Neber ten dokument doslova, je staršího data:
- **§8 bod 4 (commit)** — neplatí. Historie má dnes čtyři commity,
  poslední `7777c6f`.
- **§3 (krok 2, paleta)** — hotovo, commit `9e7f084`.
- **§4 (krok 3, spodní pás)** — desktopová část hotová, commit `7777c6f`.
  **Mobilní část (plachta se dvěma záložkami) zbývá** a je popsaná
  v §4 oddílu „MOBIL". Boční panel je 240 px, ne 200 px.
- §5 (pasti při ověřování) **platí beze zbytku** — čti ho.

---

## 10. Ověřování — pasti, které stály čas

### Cache prohlížeče
Server neposílá hlavičky proti kešování. **Před KAŽDÝM ověřením:**

```js
(async()=>{ const l=document.querySelector('link[rel=stylesheet]');
  await fetch(l.getAttribute('href').split('?')[0],{cache:'reload'});
  for (const f of ['js/main.js','js/ui.js','js/i18n.js','js/catalog.js'])
    await fetch(f,{cache:'reload'}).catch(()=>{});
  location.reload(true); })()
```

### Screenshoty jsou v Browser pane nespolehlivé
Vycházejí zkreslené a ořez (`zoom` s `region`) není podporovaný.
**Měření přes `javascript_tool` je autoritativní.**

### Server běží
`python -m http.server` na portu 8000 je uživatelův. **Nezabíjej ho
a nespouštěj vlastní.**

### Jazyk po `localStorage.clear()`
Spadne na `en`. Klíče: `alba-katalog-v1`, `nerez-blok-config-v3`,
`alba-jazyk`. Jazyk přepínej přes
`const i = await import('./js/i18n.js'); i.setLang('cs');`

### Nespouštěj dialogy, které nejde zavřít měřením
`window.print()` **nespouštěj**. Ukládání souboru testuj tak, jak je
popsáno v kritériu 8 — **neklikej naslepo na „Uložit"**, otevřel by se
systémový dialog a stáhl soubor uživateli.

---

## 11. Kritéria přijetí — ověř každé zvlášť

Desktop měř na **1280×900**, mobil na **375×812**.

1. **Bez chyby v konzoli** — po startu, po přejmenování projektu, po
   změně rozměru, po přepnutí varianty, po přepnutí jazyka, po načtení
   uložené sestavy.
2. **Sekce Projekt měří ≤ 95 px**, sekce Rozměry bloku **≤ 145 px**
   u jednostranného a **≤ 180 px** u ostrovního. Změř
   `getBoundingClientRect().height`.
3. **Paleta začíná výš než 280 px** od horního okraje panelu
   (dnes 569). Změř `top` sekce `#palette-section` minus `top` panelu.
4. Smazané prvky neexistují:
   `['dim-length','dim-depth','dim-height','dim-depth-breakdown'].filter(id=>document.getElementById(id))`
   vrátí prázdné pole.
5. **Řádek rozměru je jednořádkový** — svislé středy popisku, pole
   a jednotky se liší nejvýš o 4 px. Změř u všech řádků.
6. **Název projektu**: napiš text, klikni jinam → text zůstane. Enter
   potvrdí. Escape vrátí předchozí hodnotu. Prázdné pole ukáže
   „Bez názvu" jako placeholder, ne jako hodnotu.
7. **Název přežije překreslení**: napiš do pole text a *bez opuštění pole*
   změň rozměr bloku (ten vyvolá `render`). Ověř, že
   `document.activeElement.id === 'project-name'` a text se nezměnil.
8. **Ukládání — testuj bez otevření systémového dialogu.** Ověř
   programově, že `saveConfig` zapsala do `localStorage`:
   ```js
   localStorage.removeItem('nerez-blok-config-v3');
   // dočasně zneškodni dialog i stahování, ať se nic neotevře:
   const realPicker = window.showSaveFilePicker;
   window.showSaveFilePicker = () => Promise.reject(
     Object.assign(new Error('x'), { name: 'AbortError' }));
   document.getElementById('save-config').click();
   // po chvíli:
   JSON.parse(localStorage.getItem('nerez-blok-config-v3')).projectName
   window.showSaveFilePicker = realPicker;
   ```
   Musí platit: v úložišti je konfigurace **včetně `projectName`**,
   zrušení dialogu **nevyvolalo chybu v konzoli** a nic se nestáhlo.
9. **Název souboru** — ověř samotnou funkci, ne stahování:
   pro název „Kuchyně / Novák: 1" musí vyjít `Kuchyně - Novák- 1.json`
   (zakázané znaky nahrazené), pro prázdný název název s dnešním
   prefixem z `export.jsonFilenamePrefix`.
10. **Starší uložený soubor bez `projectName`** se otevře bez chyby
    a název zůstane prázdný. Otestuj tak, že do `localStorage` vložíš
    konfiguraci s odstraněným polem `projectName` a načteš ji.
11. **Segmentový přepínač** přepíná variantu, aktivní pole je zvýrazněné,
    a **funguje klávesnicí** (Tab na něj, šipky mezi poli).
12. **Ostrovní blok**: objeví se řádek Hloubka B a tichá řádka
    s celkovou hloubkou se správným součtem. U jednostranného oboje zmizí.
13. **Upozornění na zvětšenou hloubku** se pořád objeví — vlož přístroj
    hlubší než zadaná hloubka a ověř, že `#depth-a-grow-note` není `hidden`.
14. **Všech 5 jazyků**: název sekce, placeholder názvu, titulky tří ikon,
    obě pole přepínače, čtyři popisky rozměrů i řádka celkové hloubky.
    `['project.untitled','project.nameLabel','project.nameTitle','project.filenamePrompt','variant.singleShort','variant.islandShort','field.lengthShort','field.depthShort','field.depthAShort','field.depthBShort','field.heightShort'].filter(k=>!t(k)||t(k)===k)`
    vrátí prázdné pole v každém jazyce.
15. **Kontrast** textu v nových prvcích ≥ 4,5:1. Počítej se skládáním
    alfy podle receptu v `ZADANI-UI.md` §5 — naivní porovnání
    `color` proti `backgroundColor` dává u poloprůhledných pozadí nesmysly
    a v minulé session dvakrát vedlo k falešnému hlášení vady.
16. **375 px**: `document.documentElement.scrollWidth === clientWidth`,
    řádky rozměrů se nezalomí, ikony se vejdou vedle sebe.
17. **Načtení uložené sestavy** (ikona historie) funguje a načte
    i název projektu. Ikona je zakázaná, když v úložišti nic není.

---

## 12. Co odevzdat

Krátká zpráva, ne převyprávění zadání:
- které soubory jsi změnil a kolik řádků
- **výsledek každého ze 17 kritérií** — u měřených uveď naměřené číslo
- co jsi udělal jinak než zadání a proč
- co nefunguje

**Nehlas hotovo, dokud jsi všech 17 bodů opravdu neproklikal a nezměřil.**
Popisuj jen to, co jsi opravdu udělal a ověřil. V dřívější úloze agent
tvrdil, že změny už v souborech byly z dřívějška — nebyla to pravda
a stálo to čas při kontrole.
