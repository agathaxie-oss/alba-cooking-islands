# ZADÁNÍ — rozhraní ALBA MONO (implementace mockupu)

Závazná smlouva rozhraní pro souběžnou práci. **Kdo cokoli mění, drží se
tohohle souboru doslova** — jména polí, klíčů, tříd a funkcí jsou dohodnutá
mezi několika souběžně pracujícími lidmi a nesmí se „vylepšovat".

Předloha vzhledu: `mockup-mono.html` (1440×900, proklikatelné záložky pásu).
Rozhodnutí, ze kterých mockup vznikl: `PREDANI-2026-08-05.md` §7.
Čísla geometrie: `HODNOTY-MONO.md`.

---

## 0. Co se v tomhle kole NEDĚLÁ

- **Přístroje se ve 3D nekreslí.** `mono-geometry.js` je nemá v rozsahu
  (viz hlavička souboru). V pásu jsou, ovlivňují rozvržení, kontroly
  i uložený soubor — ale ve scéně je zatím není vidět. Nezavádět je.
- **Nos (monolitický bok) se neřeší** — chybí tvar pro `svislaDeskaZkos`,
  viz `PREDANI-2026-08-05.md` §1 a §4.
- **Ostrovní varianta MONO se neřeší** — chová se jako `single`.
- Zpětná kompatibilita souborů se neřeší: aplikace je interní a nenasazená.
  Verze formátu se zvedá na **5**, čtení zůstává tolerantní (chybějící pole
  = výchozí hodnota, soubor se NIKDY neodmítne).

---

## 1. Datový model — `state.mono` (js/main.js)

```js
state.mono = {
  leftEndType:  'svislaDeska' | 'svislaDeskaZkos',   // UŽ EXISTUJE
  rightEndType: 'svislaDeska' | 'svislaDeskaZkos',   // UŽ EXISTUJE

  herdblok:   [ MonoDevice ],     // NOVÉ — uspořádaný seznam
  podestavby: [ MonoCabinet ],    // NOVÉ — uspořádaný seznam
  panelItems: [ MonoPanelItem ],  // NOVÉ — polohy, ne pořadí
  limec:      MonoCollar,         // NOVÉ
};
```

```js
MonoDevice = {
  id: number,              // globálně unikátní, ze stejného čítače jako segmenty
  type: string,            // klíč katalogu (catalog.js), NEBO 'surface'
  widthMM: number,         // šířka instance
  frontOffsetMM: number,   // odstup od přední hrany, výchozí 100
  guardMM: number,         // ochranné pole, výchozí 50
}

MonoCabinet = {
  id: number,
  kind: 'cabinet' | 'gap', // 'gap' = úmyslně vynechané místo (most)
  widthMM: number,
  bodyStyle: 'closed' | 'doors' | 'open',   // jen kind:'cabinet'
  plinth: string,                            // jen kind:'cabinet'
  finish: string,                            // jen kind:'cabinet'
}

MonoPanelItem = {
  id: number,
  kind: 'socket230' | 'socketCEE',
  xMM: number,             // absolutní poloha středu po délce bloku
  heightMM: number,        // výška středu nad spodní hranou panelu, výchozí 100
}

MonoCollar = {
  back: boolean,           // výchozí false
  left: boolean,
  right: boolean,
  heightMM: number,        // výchozí 100, meze 40–300
  alignSide: boolean,      // výchozí true — zarovnat boční límec do líce boku
}
```

### Pravidla rozvržení — ODVOZUJÍ SE, NEUKLÁDAJÍ

Jediná funkce, která je počítá, je `computeMonoLayout(state)` v
**`js/mono-layout.js`** (nový soubor, viz §2). Nikdo jiný si polohy
nepočítá — ani ui, ani geometrie.

- **Herdblok**: prvky se kladou po sobě od `x = 0` doprava, kumulativně.
  Zbytek do `lengthMM` je volná plocha (nekreslí se jako položka seznamu,
  jen jako zbytkový proužek). Součet > `lengthMM` = přeplněno.
- **Podestavby**: kladou se po sobě od `sideInsetMM(leftEndType)` doprava.
  Použitelný konec je `lengthMM − sideInsetMM(rightEndType)`. Zbytek do
  tohoto konce je **chybějící úsek** (volba 2A, oranžově). `kind:'gap'`
  uvnitř řady je legitimní most a kreslí se šedě.
- **panelItems**: `xMM` se ořezává do
  `[sideInsetMM(left), lengthMM − sideInsetMM(right)]`.

`sideInsetMM()` se importuje z `mono-geometry.js`. Hodnoty: 50 pro
`svislaDeska`, 70 pro `svislaDeskaZkos`.

---

## 2. Nový modul `js/mono-layout.js`

Čistý výpočet, bez DOM a bez THREE. Importuje jen z `mono-geometry.js`.

```js
export function computeMonoLayout(state) → {
  lengthMM,          // number
  leftInsetMM,       // number  — sideInsetMM(leftEndType)
  rightInsetMM,      // number
  usableFromMM,      // leftInsetMM
  usableToMM,        // lengthMM - rightInsetMM

  herdblok: [ { item, xMM, widthMM, overflow:boolean } ],
  herdblokFreeMM,    // zbytek do lengthMM, >= 0

  podestavby: [ { item, xMM, widthMM, overflow:boolean } ],
  missingMM,         // chybějící úsek na konci řady, >= 0
  missingFromMM,     // kde začíná (jen když missingMM > 0)

  panelItems: [ { item, xMM } ],   // už oříznuté do použitelného rozsahu
}
```

Dále (přebalení `checkSupport` z `mono-geometry.js` do tvaru pro UI):

```js
export function computeMonoChecks(state) → {
  overhangLeftMM, overhangRightMM, maxBridgeMM, ok:boolean
}
```

> Kontroly se **v pásu nezobrazují** (odznaky uživatel zrušil), ale počítají
> se dál — používá je tiskový dokument (`report.js`) a hlášení „Doplnit".

---

## 3. Nový modul `js/mono-ui.js`

Vykresluje CELÝ spodní pás pro MONO. `ui.js` se na něj jen přepne.

```js
export function createMonoStrip({ els, callbacks, t }) → { render(state), reset() }
```

- `els` = `{ tabs, body }` — DOM uzly `#strip-tabs` a `#mono-strip-body`.
- `t` = překladová funkce z `i18n.js` (`t(key, params)`).
- `callbacks` — viz §4.
- `reset()` shodí lokální stav (aktivní záložka, výběr) — volá se při
  založení/načtení projektu.

Vnitřní stav modulu (NEUKLÁDÁ se, nepatří do `state`):
`activeTab` ∈ `'herdblok' | 'podestavby' | 'panel' | 'limec' | 'arms'`
(výchozí `'herdblok'`) a `selected` = `{ layer, id } | null`.

### Co která záložka kreslí

Všechny dráhy leží nad **jedním pravítkem** a jsou **úměrné milimetrům**.
Pravítko: značky po 500 mm + koncová značka na `lengthMM`.

| záložka | obsah |
|---|---|
| `herdblok` | pravítko · dráha Herdblok (aktivní, s koncovkami) · dráha Podestavby (ztlumená) · pruh parametrů |
| `podestavby` | totéž, ztlumení opačně |
| `panel` | pravítko · dráha Herdblok (ztlumená) · dráha Čelní panel · pruh parametrů |
| `limec` | formulář (žádná dráha) · pruh parametrů |
| `arms` | pravítko · dráha Herdblok (ztlumená) · dráha Ramena · pruh parametrů |

**Ztlumují se jednotlivé dlaždice, ne celá dráha** — hlášení „chybí" musí
zůstat plné i při editaci druhé vrstvy. Viz `mockup-mono.html`.

### Koncovky zakončení (volba 1B)

Sedí na koncích dráhy Herdblok, `transform: translate(∓52%, -50%)`.
**Nesou jen profil, žádný text.** Název typu je v `title`.

- vodopád: `<path d="M25 5H3v13"/>` (levý konec), `<path d="M1 5h22v13"/>` (pravý)
- zkosený: `<path d="M25 5H9l-6 6v7"/>` (levý), `<path d="M1 5h16l6 6v7"/>` (pravý)

viewBox `0 0 26 20`, `stroke-width="2.4"`, `fill="none"`, `stroke-linejoin/linecap="round"`.
Klik přepne typ na druhý (jsou právě dva) → `onMonoEndTypeChange`.

---

## 4. Callbacky (implementuje `main.js`, prochází přes `ui.js`)

```js
onMonoEndTypeChange(side, endType)   // side: 'left'|'right'
onMonoAdd(layer, kind)               // layer: 'herdblok'|'podestavby'|'panel'
                                     // kind: klíč katalogu / 'surface' / 'gap'
                                     //       / 'socket230' / 'socketCEE'
onMonoRemove(layer, id)
onMonoUpdate(layer, id, patch)       // patch = dílčí objekt polí
onMonoMove(layer, id, dir)           // dir: -1 | +1, jen 'herdblok'/'podestavby'
onMonoFillPodestavby()               // tlačítko „Doplnit" — dorovná řadu
                                     // jednou skříňkou o šířce missingMM
onMonoCollarChange(patch)            // patch nad MonoCollar
onMonoSelect(layer, id)              // layer taky 'arms'; id === null = zrušit
onMonoTabChange(tab)                 // 'herdblok'|'podestavby'|'panel'|'limec'|'arms'
                                     // hlásí ui.js, která záložka je aktivní,
                                     // aby podle ní odfiltroval paletu (§8)
```

Ramena používají **existující** callbacky SEGMENTu (`onArmAdd`,
`onArmChange`, `onArmRemove`) — nezakládat pro ně nové.

Každý callback, který mění `state`, končí v `main.js` voláním
`rebuildBlock()` (přestavba scény + `ui.render`), stejně jako dnešní
handlery segmentů.

---

## 5. Klíče i18n (js/i18n.js) — pět jazyků: en, de, pl, cs, sk

Vkládat do každého jazykového bloku **za skupinu `arms.*`**, ve stejném
pořadí jako níže. Obchodní jména řad se NEPŘEKLÁDAJÍ.
`endType.waterfall` a `endType.waterfallChamfered` **už existují** — znovu
je nezakládat.

```
mono.tab.herdblok       Herdblok / Cooking block / Herdblock / Blok grzewczy / Herdblok
mono.tab.podestavby     Podestavby / Base cabinets / Unterbauten / Podbudowy / Podstavby
mono.tab.panel          Čelní panel / Front panel / Frontblende / Panel czołowy / Čelný panel
mono.tab.limec          Límce / Collars / Aufkantungen / Ranty / Límce
mono.layer.free         volná plocha
mono.item.surface       pracovní plocha
mono.item.gap           volný prostor
mono.item.cabinet       Skříňka
mono.missing            chybí {mm} mm
mono.fillBtn            Doplnit
mono.endZoneNote        Koncové zóny {left} / {right} mm určuje typ zakončení — panel ani skříňky do nich nezasahují.
mono.panelNote          Prvky se osazují do ovládacího panelu (v ose Z 25–45 mm, výška 650–850 mm nad podlahou).
mono.armsNote           Rameno sedí na desce; u bloku u stěny se odsazuje od zadní hrany, u ostrova od středu.
mono.endTypeLeft        Levé zakončení
mono.endTypeRight       Pravé zakončení
mono.bedPanel           panel {from} – {to} mm
mono.bedDesk            deska {from} – {to} mm
mono.overflow           nevejde se
mono.panel.socket230    Zásuvka 230 V
mono.panel.socketCEE    Zásuvka CEE 400 V
mono.panel.addItem      + Přidat prvek do panelu
mono.field.posX         Poloha po délce
mono.field.heightInPanel  Výška v panelu
mono.field.itemType     Typ
mono.field.frontOffset  Odstup od přední hrany
mono.field.guard        Ochranné pole
mono.collar.title       Límce
mono.collar.back        Zadní límec
mono.collar.left        Boční límec vlevo
mono.collar.right       Boční límec vpravo
mono.collar.height      Výška límce
mono.collar.alignSide   Zarovnat do líce boku
mono.collar.range       SPEC §4.4: 40–300
mono.collar.on          ano
mono.collar.off         ne
mono.collar.chamferNote Na zkoseném konci se boční límec nekreslí.
```

Poslední klíč je věcná podmínka z `mono-geometry.js` — límec `left`/`right`
se vykreslí jen tehdy, je-li dotyčný konec `svislaDeska`.

---

## 6. CSS (css/style.css) — nová sekce na konci souboru

Prefix **`mono-`**. Používat výhradně existující proměnné z `:root`.
Jediná nová proměnná: `--warn: #B26A00;` a `--warn-soft: rgba(178,106,0,.12);`
— přidat do `:root` k ostatním.

Třídy (význam a vzhled přesně podle `mockup-mono.html`, kde mají prefix `mk-`):

```
.mono-strip-body                    kontejner pásu MONO
.mono-panel                         obsah jedné záložky (display:none / flex)
.mono-scale-row .mono-scale-label .mono-scale
.mono-tick (i, b)                   pravítko
.mono-track-row
.mono-tile                          + .mono-tile-device .mono-tile-cabinet
                                      .mono-tile-surface .mono-tile-gap
                                      .mono-tile-endzone .mono-tile-missing
                                      .mono-tile-selected .mono-tile-wide
.mono-tile-name .mono-tile-size .mono-tile-sub
.mono-btn-warn                      tlačítko „Doplnit"
.mono-endcap .mono-endcap-left .mono-endcap-right
.mono-endcap-glyph .mono-endcap-caret
.mono-point                         bodový prvek (zásuvka, rameno)
.mono-track-bed .mono-track-bed-label
.mono-track-note
.mono-dimmed                        ztlumení dlaždice na opacity .42
.mono-limec-body .mono-limec-opts .mono-limec-row .mono-limec-diagram
.mono-switch                        dvoustavový přepínač ano/ne
.mono-param-bar .mono-param-title .mono-param-fields .mono-param-field
.mono-param-display .mono-param-input .mono-param-trash .mono-param-add
```

Pás MONO je **vyšší než dnešní SEGMENT pás** — `#assembly-strip` u MONO
potřebuje 268 px místo dnešní výšky. Řešit třídou na `#assembly-strip`
(`.strip-mono`), ne přepsáním výchozí výšky.

---

## 7. index.html

Do `#assembly-strip` přibude **sourozenec** dnešního `.strip-body`:

```html
<div id="mono-strip-body" class="mono-strip-body" hidden></div>
```

`.strip-body` i `#mono-strip-body` přepíná `ui.js` podle `productType`.
`#strip-tabs` a `#strip-collapse` zůstávají sdílené. `#strip-capacity`
se u MONO skrývá (odznaky zrušené).

---

## 8. Napojení v `js/ui.js`

Minimální zásah — ui.js má 1555 řádků a nemá se nafukovat.

1. `import { createMonoStrip } from './mono-ui.js';`
2. Líná instance: `let monoStrip = null;` + `function getMonoStrip()`.
3. V `renderStrip(state)` hned na začátku:
   ```js
   const isMono = currentProductType === 'mono';
   els.assemblyStrip.classList.toggle('strip-mono', isMono);
   els.stripBody.hidden = isMono;
   els.monoStripBody.hidden = !isMono;
   if (els.stripCapacity) els.stripCapacity.hidden = isMono;
   if (isMono) { getMonoStrip().render(state); return; }
   ```
   Zbytek funkce se NEMĚNÍ.
4. `setProductType(type)` navíc volá `monoStrip?.reset()` při změně typu.
5. Paleta: u MONO se seznam bere podle aktivní záložky pásu — `mono-ui.js`
   ji o změně informuje callbackem `onMonoTabChange(tab)`, `ui.js` si tab
   zapamatuje a `renderPaletteList()` podle něj filtruje:
   - `herdblok` → katalogové přístroje + `surface`
   - `podestavby` → `cabinet` + `gap`
   - `panel` → `socket230`, `socketCEE`
   - `limec` → paleta se skryje
   - `arms` → paleta se skryje (ramena se přidávají z pruhu parametrů)

---

## 9. Geometrie — `js/mono-geometry.js` a `js/mono-block.js`

### mono-block.js

- **Zrušit `deriveRow()`.** Řady se berou ze `state.mono` přes
  `computeMonoLayout(state)` z `mono-layout.js`.
- `herdblok` úsek dostane `collar` pole sestavené z `state.mono.limec`:
  `back` → `{edge:'back'}`, `left` → `{edge:'left'}`, `right` → `{edge:'right'}`,
  vždy s `heightMM` z `limec.heightMM`. Front límec se NEPOUŽÍVÁ.
- `panelItems` se předají do `buildMonoBlock` jako nový parametr.

### mono-geometry.js — nové: prvky v ovládacím panelu

```js
export const PANEL_ITEM = {
  socket230: { widthMM: 90,  heightMM: 90,  depthMM: 6 },
  socketCEE: { widthMM: 105, heightMM: 105, depthMM: 8 },
};

export function buildPanelItem({ kind, xMM, heightMM })  → THREE.Group
```

- Sedí v ose Z na líci panelu: `z = PANEL_SETBACK_MM` (25), vystupuje
  dopředu o `depthMM` (tj. do `z = 25 − depthMM`)… **POZOR**: záporné z je
  zakázané (viz hlavička modulu). Prvek proto leží v `z` od
  `PANEL_SETBACK_MM − depthMM` do `PANEL_SETBACK_MM`, a protože
  `PANEL_SETBACK_MM = 25` a největší `depthMM = 8`, do záporných hodnot to
  nespadne. Tvrdá podmínka z `PREDANI-2026-08-05.md` §4: **prvek panelu
  nesmí NIKDY předsazovat před spodní hranu desky** (z = 0) — tohle ji drží.
- V ose Y: `heightMM` je střed prvku nad **spodní hranou panelu**, tedy
  ve světě `LISTA_HEIGHT_MM + heightMM` v lokálních souřadnicích úseku.
- `mesh.name = 'panel-item'`, materiál `createPanelMaterial()`.
- Prvek, který by přesahoval mimo šířku panelu, se **nevykreslí** (tiše).

`buildMonoBlock` dostane nový nepovinný parametr `panelItems` (pole
`{kind, xMM, heightMM}`, absolutní `xMM` po délce bloku) a osadí je do
úseku, do jehož rozsahu `xMM` spadá.

---

## 10. Ukládání (js/main.js)

- `CONFIG_VERSION` 4 → **5**.
- `serializeConfig()` ukládá celé `state.mono` včetně nových polí.
- `applyConfig()` čte tolerantně: chybějící `herdblok`/`podestavby`/
  `panelItems` = prázdné pole, chybějící `limec` = výchozí objekt,
  neplatné hodnoty se ořezávají do mezí. **Soubor se kvůli nim nikdy
  neodmítá** — stejné pravidlo jako u dnešního `sanitizeMonoEndType`.
- `id` se přiděluje ze stejného čítače `nextId` jako segmenty a ramena;
  po načtení souboru se `nextId` posune za nejvyšší načtené `id`.
- Nový projekt MONO začíná s prázdnými poli a výchozím `limec`.

---

## 11. Přejímka

Každý balík končí:

1. `node --check <každý změněný .js>` — musí projít.
2. Žádný nový výskyt slova „vlna" v uživatelsky viditelných řetězcích.
3. Kdo mění i18n: každý nový klíč přesně **5×** (en, de, pl, cs, sk).
4. Kdo mění geometrii: doložit spočítané souřadnice, ne screenshot.
