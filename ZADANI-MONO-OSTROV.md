# ZADÁNÍ — ostrovní varianta ALBA MONO (úkol 6, PREDANI.md)

Závazná smlouva rozhraní pro TŘI SOUBĚŽNÉ agenty. **Kdo cokoli mění, drží
se tohohle souboru doslova** — jména polí, funkcí a parametrů jsou
dohodnutá mezi třemi souběžně pracujícími lidmi a nesmí se „vylepšovat".

Vzor formy: `ZADANI-MONO-UI.md` (přečti si ho taky — pole/funkce/klíče,
které tenhle dokument nemění, platí z něj dál beze změny).

Číslování paragrafů je v tomhle dokumentu vlastní, nenavazuje na
`ZADANI-MONO-UI.md`.

---

## 0. Co se v tomhle kole NEDĚLÁ

- **Nástavby nad blokem** (roštová nástavba, police na salamandr).
- **Přestavba katalogu** — samostatný úkol, `ZADANI-KATALOG.md`.
- **Logo ALBA ve 3D** — nevykresluje se, diagnóza hotová, oprava odložena.
- **Výřez v desce pod přístroji** — přístroje sedí na celé, neděravé
  desce (`THREE.Shape.holes` se nepoužívá). Platí pro obě strany ostrova
  stejně jako dnes pro `single`.
- **Radius u SEGMENTu** — SEGMENT nestaví hygienický radius vůbec, u
  žádné úpravy. Není to regrese, produkty se v tomhle rozešly vědomě.
- **Úkol 12** (přeplněná položka se ve 3D kreslí za koncem bloku) — nechat
  být, zadavatel to viděl a rozhodl nechat tak. Netýká se ostrova nijak
  zvlášť, ale kdyby to někdo cestou uviděl, NEOPRAVOVAT bez pokynu.
- **`report.js` (tiskový dokument) pro MONO** — dnes nevolá
  `computeMonoLayout`/`computeMonoChecks` vůbec (ověřeno, žádný zásah).
  Zůstává tak, tenhle úkol ho nezapojuje.
- **Zdvojování ramen.** Ostrov má JEDNU sadu ramen na spáře mezi stranami
  — ne dvě sady po jedné na stranu.

---

## 1. Datový model — `state.mono` (js/main.js)

```js
state.mono = {
  leftEndType:  'svislaDeska' | 'svislaDeskaZkos',   // SDÍLENÉ, beze změny
  rightEndType: 'svislaDeska' | 'svislaDeskaZkos',   // SDÍLENÉ, beze změny

  herdblokA:   [ MonoDevice ],
  herdblokB:   [ MonoDevice ],    // 'single' → vždy []
  podestavbyA: [ MonoCabinet ],
  podestavbyB: [ MonoCabinet ],   // 'single' → vždy []
  panelItemsA: [ MonoPanelItem ],
  panelItemsB: [ MonoPanelItem ], // 'single' → vždy []

  limec: MonoCollar,              // SDÍLENÝ — jeden objekt pro celý blok
};
```

`MonoDevice`/`MonoCabinet`/`MonoPanelItem`/`MonoCollar` — tvar polí beze
změny oproti `ZADANI-MONO-UI.md` §1. Sanitizační funkce
(`sanitizeMonoDevice`/`sanitizeMonoCabinet`/`sanitizeMonoPanelItem`/
`sanitizeMonoCollar`) se NEMĚNÍ, jen se volají na dvou seznamech místo
jednoho.

**`limec.back` se u varianty `island` IGNORUJE geometrií bez ohledu na
uloženou hodnotu** — viz §9. Neřeší se sanitizací (hodnota se dál ukládá
beze změny, kdyby uživatel přepnul zpátky na `single`), řeší se až v
`mono-block.js` při stavbě scény.

### `CONFIG_VERSION`: 5 → **6**

`serializeConfig()` ukládá `mono.herdblokA/herdblokB/podestavbyA/
podestavbyB/panelItemsA/panelItemsB/limec` (`leftEndType`/`rightEndType`
beze změny). Staré pole názvy (`herdblok`/`podestavby`/`panelItems` bez
přípony) se **od verze 6 už nezapisují** — jen se čtou (níž).

`applyConfig()` čte tolerantně, **soubor se NIKDY neodmítá**:

- Je-li `config.mono.herdblokA` pole, použije se ono. **Jinak**, je-li
  `config.mono.herdblok` (starší formát, verze ≤5) pole, jeho obsah se
  sanitizuje do `herdblokA` a `herdblokB` zůstává `[]`. Jinak `[]`.
  Stejné pravidlo pro `podestavby(A)`/`panelItems(A)`.
- `herdblokB`/`podestavbyB`/`panelItemsB` čtou se ANALOGICKY z
  `config.mono.herdblokB`/… — u starších souborů vždy chybí, spadají
  na `[]` (starý formát ostrov neznal).
- Kontrola „prázdná konfigurace" (main.js, `applyConfig`, kolem ř. 889)
  dnes čte jen `rawMono.herdblok`/`rawMono.podestavby`. Musí se rozšířít
  na **součet přes VŠECHNY čtyři nové seznamy** (`herdblokA.length +
  herdblokB.length`, `podestavbyA.length + podestavbyB.length`) **A**
  tolerantní fallback na staré `herdblok`/`podestavby`, aby starý
  neprázdný soubor verze ≤5 dál procházel touhle kontrolou.
- `id` dál ze sdíleného čítače `nextId` — beze změny (žádné posunutí
  `nextId`, stejné zdůvodnění jako dnes: sanitizace vždy přidělí nové id
  bez ohledu na uložené).

`onNewProject(type)` (main.js) — `state.mono` literál se rozšíří o
`herdblokB: []`, `podestavbyB: []`, `panelItemsB: []`. **Předvyplněná
trojice `createDefaultMonoPodestavby()` platí JEN pro `podestavbyA`** —
`podestavbyB` začíná prázdné i pro nově založený MONO projekt. Důvod:
žádný odsouhlasený požadavek nežádá prefill strany B a nový projekt
navíc startuje ve `variant: 'single'`, kde se strana B stejně nepoužívá.

---

## 2. Hloubka — `state.dimensions` (beze změny, jen ověření)

`depthAMM`/`depthBMM` už existují ve `state.dimensions` a pole „Hloubka
B" v UI (`#input-depth-b`/`#depth-b-row`) **už existuje a přepíná se
GENERICKY** podle `state.variant === 'island'` v `ui.js` funkci
`render(state)` (ř. 1631–1632), bez ohledu na `productType`. **Pro tenhle
úkol se `ui.js` v týhle části NEMĚNÍ** — ověřeno čtením kódu, přepínání
funguje pro MONO stejně jako pro SEGMENT už dnes.

**Deska ostrova je `depthAMM + depthBMM`** (dál `totalDepthMM`).
Podestavba má FIXNÍ hloubku `PODESTAVBA_DEPTH_MM` (670) nezávisle na
`depthAMM`/`depthBMM` — to platí už dnes pro `single` (podestavba
nesleduje `depthAMM`) a pro `island` se nemění, obě strany mají stejnou
konstantní hloubku podestavby.

---

## 3. `computeMonoLayout(state, side)` a `computeMonoChecks(state, side)`
### — `js/mono-layout.js`

### Dnešní podpis
```js
export function computeMonoLayout(state)
export function computeMonoChecks(state)
```

### Nový podpis
```js
export function computeMonoLayout(state, side)   // side: 'A' | 'B'
export function computeMonoChecks(state, side)   // side: 'A' | 'B'
```

`side` je **POVINNÝ parametr** (žádný tichý default) — každé volající
místo se musí vědomě rozhodnout, kterou stranu počítá. Neplatná hodnota
(cokoli mimo `'A'`/`'B'`) se tolerantně čte jako `'A'` (stejná filozofie
jako zbytek modulu — „nikdy nespadne"), ale volající to nemá spoléhat.

**Co se mění uvnitř:** `monoState.herdblok`/`podestavby`/`panelItems` se
čtou z `state.mono.herdblokA`/`herdblokB` atd. podle `side` (`side==='B'
→ herdblokB`, jinak `herdblokA`). `leftEndType`/`rightEndType`/
`lengthMM` jsou i nadále SDÍLENÉ (nezávisí na `side`) — je to POŘÁD
tentýž blok, tatáž délka, tytéž koncové zóny na obou stranách.

Vrácená struktura (tvar podle `ZADANI-MONO-UI.md` §2) se **nemění** —
pořád popisuje JEDNU stranu. Volající si `computeMonoLayout` zavolá
dvakrát, pokud potřebuje obě strany najednou.

`computeMonoChecks(state, side)` — stejné pravidlo, `checkSupport`
se počítá pro `podestavby[side]` vůči `herdblok[side]` jako dosud.

### Kdo dnes volá `computeMonoLayout`/`computeMonoChecks` — a jak se mění

| soubor | dnešní volání | nové volání |
|---|---|---|
| `js/main.js` (`onMonoAdd` panel) | `computeMonoLayout(state)` | `computeMonoLayout(state, side)` — `side` je parametr, co dostal `onMonoAdd` (§5) |
| `js/main.js` (`onMonoFillPodestavby`) | `computeMonoLayout(state)` | `computeMonoLayout(state, side)` — `side` je nový parametr callbacku (§5) |
| `js/mono-block.js` (`buildMonoScene`) | `computeMonoLayout(state)` (jednou) | `computeMonoLayout(state, 'A')` a navíc `computeMonoLayout(state, 'B')` u `island` (§6) |
| `js/mono-ui.js` (`renderAll`) | `computeMonoLayout(state)` | `computeMonoLayout(state, currentSide)` — `currentSide` odvozený z `state.editSide` (§4) |

`computeMonoChecks` dnes nevolá nikdo (`report.js` ho nepoužívá — ověřeno
grepem). Zůstává tak, žádné nové volající místo v tomhle úkolu.

---

## 4. Přepínač strany A/B v pásu MONO

**Znovupoužívá se `state.editSide` a callback `onEditSideChange(side,
opts)` — STEJNÝ mechanismus, jaký dnes používá SEGMENT.** Žádné nové
pole ve `state`, žádný nový callback pro přepnutí strany.

Jak dnes funguje (ověřeno čtením `js/ui.js`/`js/main.js`):

- `state.editSide` (`'A'`|`'B'`) je „editovaná" strana — nezávislá na
  `state.currentSide` (na kterou stranu se dívá KAMERA).
- `main.js` `onEditSideChange(side, opts)`: `state.editSide =
  state.variant === 'island' ? next : 'A'` — u `single` je VŽDY `'A'`,
  bez ohledu na to, co přišlo. `opts.turnCamera` navíc otočí kameru
  (přes `onSideChange`).
- SEGMENT ho čte v `ui.js` `renderStrip()` (ř. 1576: `activeTab =
  state.editSide`) a nastavuje kliknutím na záložku A/B v `#strip-tabs`
  (ř. 1432–1437: `callbacks.onEditSideChange(key, {turnCamera:true})`).

**Pro MONO:** `#strip-tabs` u MONO NEPATŘÍ `ui.js` — vykresluje ho celý
`mono-ui.js` (`renderTabs()`, pět záložek herdblok/podestavby/panel/
limec/arms, `ZADANI-MONO-UI.md` §3). SEGMENTOVÝ přepínač A/B v
`ui.js#renderStripTabs` se u MONO nikdy nevolá (větev `isMono` se vrací
dřív, `ui.js` ř. 1570). **MONO proto potřebuje VLASTNÍ ovládací prvek
A/B, vykreslený uvnitř `mono-ui.js`, ale ovládající TOTÉŽ
`state.editSide` a TENTÝŽ `onEditSideChange` callback.**

`callbacks.onEditSideChange` je `mono-ui.js` dostupný BEZE ZMĚNY dnešní
instanciace — `ui.js#getMonoStrip()` už dnes předává
`callbacks: { ...callbacks, onMonoTabChange: … }`, tedy **celý** horní
objekt callbacků (spread), `onEditSideChange` je jeho součástí. Žádný
nový drát v `ui.js#getMonoStrip()` není potřeba.

**Kde se přepínač zobrazuje:** jen u `variant === 'island'`, a jen pro
záložky `herdblok`/`podestavby`/`panel` (obsah těchto tří je PER-STRANA).
Záložky `limec`/`arms` mají sdílený obsah (limec sdílený, jedna sada
ramen) — u nich se přepínač A/B NEZOBRAZUJE (nebo se zobrazuje
neaktivní/šedý — vizuální detail nechat na implementaci, viz §13 otázka
o vzhledu).

**Doporučený způsob zapojení** (technický detail, uvnitř jednoho
souboru, žádná kolize): `mono-ui.js` si při `renderAll(state)` spočítá
```js
const isIsland = state.variant === 'island';
const currentSide = isIsland && state.editSide === 'B' ? 'B' : 'A';
```
a `currentSide` použije jak pro `computeMonoLayout(state, currentSide)`,
tak pro vykreslení přepínače (tlačítka „Strana A" / „Strana B", klik →
`callbacks.onEditSideChange(otherSide, { turnCamera: true })` — stejná
signatura jako SEGMENT). **Textace tlačítek: znovu použít `t('side.sideA')`
/ `t('side.sideB')` a `t('strip.editSideTitle', {side})`** — tyhle tři
i18n klíče UŽ EXISTUJÍ (viz `js/i18n.js`), žádný nový klíč pro tohle
není potřeba.

Doporučené CSS: znovu použít třídu `.strip-tab` (+ `.active`) — stejná
třída, jakou pro A/B/arms záložky používá SEGMENT i pro pět záložek
MONO dnes. Žádná nová CSS třída pro samotné tlačítko není nutná; nová
třída smí vzniknout jen na OBAL přepínače (viz §11).

### Paleta (`js/ui.js`, `renderMonoPaletteList`)

`renderMonoPaletteList()` (ř. 410) dnes natvrdo skrývá odznak cílové
strany: `paletteEls.badge.hidden = true;` s komentářem „MONO nemá
cílovou stranu jako ostrovní SEGMENT". **To se u `island` mění** — musí
se chovat STEJNĚ jako SEGMENTOVÁ větev o pár řádků níž (ř. 477–483):

```js
const isIsland = state.variant === 'island';
const targetSide = isIsland ? state.editSide : 'A';
paletteEls.badge.hidden = !isIsland;
if (isIsland) {
  paletteEls.badge.textContent = t('palette.targetSide', { side: targetSide });
  paletteEls.badge.title = t('palette.targetSideTitle', { side: targetSide });
}
```
(`palette.targetSide`/`palette.targetSideTitle` — existující klíče,
žádné nové.) `targetSide` se pak posílá jako nový 3. parametr
`onMonoAdd` (viz §5) na OBOU voláních uvnitř `renderMonoPaletteList`
(katalogová položka ř. 434 i „specials" ř. 453).

---

## 5. Callbacky (`js/main.js`) — jak dostanou stranu

Rozhodnutí: **`side` jako DALŠÍ parametr, jen tam, kde je skutečně
potřeba** — ne rozšíření `layer`. Zdůvodnění a přesná pravidla níže;
platí v celém dokumentu.

**Existující precedens ze SEGMENTu** (`js/main.js`): `onAddNeutral(side)`
a `onAddDrawers(side)` BEROU `side`, protože přidávají NOVOU položku bez
`id` — potřebují vědět, do kterého seznamu ji vložit. `onRemoveSegment(id)`,
`onMoveSegment(id, dir)`, `onSelectSegment(id)` **`side` NEBEROU** —
`id` je globálně unikátní (sdílený čítač `nextId`), takže `findSegment(id)`
prohledá `segmentsA` i `segmentsB` a stranu najde sama. **MONO se řídí
stejným pravidlem 1:1.**

```js
onMonoEndTypeChange(side, endType)   // BEZE ZMĚNY. POZOR: `side` tady
                                     // znamená 'left'|'right' (konec
                                     // bloku podél X), NE 'A'|'B'. Je to
                                     // jiný „side" než všude jinde v
                                     // tomhle dokumentu — leftEndType/
                                     // rightEndType jsou sdílené pro obě
                                     // strany A/B, takže tenhle callback
                                     // žádný A/B parametr nepotřebuje a
                                     // NEDOSTÁVÁ ho.

onMonoAdd(layer, kind, side)        // NOVÝ 3. parametr, side: 'A'|'B'.
                                     // 'A' vždy u 'single'. Volající
                                     // (ui.js palette, mono-ui.js "+"
                                     // tlačítko panelu) ho POSÍLÁ VŽDY
                                     // explicitně — main.js zapisuje do
                                     // state.mono.herdblok+side apod.
                                     // (helper getMonoSideList, viz níž).

onMonoRemove(layer, id)             // BEZE ZMĚNY. Hledá se přes OBĚ
                                     // strany (viz findMonoItem níž).
onMonoUpdate(layer, id, patch)      // BEZE ZMĚNY, stejný důvod.
onMonoMove(layer, id, dir)          // BEZE ZMĚNY, stejný důvod. Šipka
                                     // přeuspořádá POZICI v poli té
                                     // strany, kde `id` leží — nikdy
                                     // nepřesouvá položku MEZI stranami.

onMonoFillPodestavby(side)          // NOVÝ 1. parametr, side: 'A'|'B'.
                                     // 'A' vždy u 'single'. Dorovná
                                     // podestavbyA nebo podestavbyB
                                     // podle `side` — čte missingMM z
                                     // computeMonoLayout(state, side).

onMonoCollarChange(patch)           // BEZE ZMĚNY — limec je sdílený.
onMonoSelect(layer, id)             // BEZE ZMĚNY — výběr je lokální
                                     // stav mono-ui.js (`selected`),
                                     // nesahá do state.mono vůbec (viz
                                     // ZADANI-MONO-UI.md §3), side tu
                                     // nemá co ovlivnit.
onMonoTabChange(tab)                // BEZE ZMĚNY — výčet tabů se
                                     // NEMĚNÍ ('herdblok'|'podestavby'|
                                     // 'panel'|'limec'|'arms'). Přepnutí
                                     // A/B jde VÝHRADNĚ přes
                                     // onEditSideChange (§4), ne přes
                                     // tenhle callback.
```

### Kdo `onMonoAdd`/`onMonoFillPodestavby` dnes volá — a co musí poslat

| soubor | místo | dnešní volání | nové volání |
|---|---|---|---|
| `js/ui.js` | `renderMonoPaletteList`, katalogová položka (ř. 434) | `onMonoAdd?.('herdblok', def.id)` | `onMonoAdd?.('herdblok', def.id, targetSide)` |
| `js/ui.js` | `renderMonoPaletteList`, „specials" (ř. 453) | `onMonoAdd?.(layer, sp.kind)` | `onMonoAdd?.(layer, sp.kind, targetSide)` |
| `js/mono-ui.js` | pruh parametrů záložky Panel, tlačítko „+" (ř. 745) | `onMonoAdd?.('panel', kindForAdd)` | `onMonoAdd?.('panel', kindForAdd, currentSide)` |
| `js/mono-ui.js` | tlačítko „Doplnit" (ř. 535) | `onMonoFillPodestavby?.()` | `onMonoFillPodestavby?.(currentSide)` |

`targetSide` v `ui.js` a `currentSide` v `mono-ui.js` jsou POJMOVĚ
STEJNÁ hodnota (`state.variant==='island' ? state.editSide : 'A'`) —
jen se jinak jmenují v každém souboru podle jeho vlastní konvence (§4).

### `js/main.js` — nový interní helper (nekříží se s ničím výš)

```js
// side: 'A' | 'B', layer: 'herdblok' | 'podestavby' | 'panel'
function getMonoSideList(side, layer) {
  const key = layer === 'herdblok' ? 'herdblok'
    : layer === 'podestavby' ? 'podestavby'
    : layer === 'panel' ? 'panelItems'
    : null;
  if (!key) return null;
  return state.mono[key + (side === 'B' ? 'B' : 'A')];
}
```

`findMonoItem(layer, id)` (dnešní, main.js ř. 356) se rozšíří, aby
hledala PŘES OBĚ strany, stejně jako `findSegment(id)`:

```js
function findMonoItem(layer, id) {
  const listA = getMonoSideList('A', layer);
  const listB = getMonoSideList('B', layer);
  const item = (listA && listA.find((i) => i.id === id))
    || (listB && listB.find((i) => i.id === id));
  return item || null;
}
```

`onMonoAdd`/`onMonoFillPodestavby` uvnitř `main.js` používají
`getMonoSideList(side, layer).push(...)` místo dnešního přímého
`state.mono.herdblok.push(...)`. `onMonoRemove`/`onMonoUpdate`/
`onMonoMove` používají `findMonoItem` (výš) beze změny volání zvenčí.

---

## 6. Geometrie — `js/mono-geometry.js` a `js/mono-block.js`

### `buildMonoScene(state)` — `js/mono-block.js`

**Podpis se NEMĚNÍ** — `main.js#rebuildScene()` volá `buildMonoScene(state)`
bezpodmínečně, stejně jako dnes (přesně jako `buildBlock(...)` čte
`dims.variant` interně). Uvnitř funkce nově:

```js
const isIsland = state.variant === 'island';
const layoutA = computeMonoLayout(state, 'A');
const layoutB = isIsland ? computeMonoLayout(state, 'B') : null;
```

a analogicky dvě sady `podestavby`/`panelItems`/`devicesGroup` (dnešní
kód pro stranu A zůstává, stranu B se stejnou logikou přidá jen když
`isIsland`). `depthBMM` z `state.dimensions` se použije místo dnešního
natvrdo `depthBMM: 0` ve výstupním `dimensions` objektu — přesně jako
`block.js` dělá pro SEGMENT (`depthBMM: isIsland ? Math.round(depthBMM) : 0`).

### `buildMonoBlock({...})` — `js/mono-geometry.js`

Dnešní podpis:
```js
export function buildMonoBlock({ workHeightMM, podestavby, herdblok, panelItems })
```

Nový podpis (návrh, drží se dnešního stylu pojmenování):
```js
export function buildMonoBlock({
  workHeightMM,
  variant = 'single',          // NOVÉ — 'single' | 'island'
  depthAMM, depthBMM,          // NOVÉ — depthBMM se ignoruje u 'single'
  podestavbyA, herdblokA, panelItemsA,   // dřívější podestavby/herdblok/panelItems
  podestavbyB = [], herdblokB = [], panelItemsB = [],  // jen 'island'
})
```

Uvnitř `herdblokA`/`herdblokB` je stále pole „úseků" ve tvaru, jaký
dnešní `herdblok` má (typicky jeden úsek přes celou délku), se svým
`depthMM` = `depthAMM`/`depthBMM`.

### Nutná dekompozice uvnitř `buildHerdblokUsek` — DŮVOD

Dnešní `buildHerdblokUsek()` staví DESKU (viz proměnná `desk`, ř. 598)
jako součást JEDNOHO monolitu s korpusem/panelem/lištou/nosem. Pro
ostrov to nejde použít 2× (jednou pro A, jednou pro B) — vzniknou DVĚ
desky proti sobě, což zadání výslovně zakazuje („jedna průběžná deska,
NE dvě desky proti sobě se spárou uprostřed", PREDANI.md úkol 6).

**Požadovaná dekompozice** (návrh signatur, uprav dle potřeby — je to
uvnitř JEDNOHO souboru, žádná kolize s jinou částí týmu):

```js
// NOVÉ — extrahováno z dnešního buildHerdblokUsek (dřívější `desk`)
export function buildHerdblokDesk({
  widthMM, depthMM, leftEndType, rightEndType, frontZMM = 0,
  chamferAllCorners = false,   // NOVÉ, viz §7
}) → THREE.Mesh

// ZMĚNA: dva nové nepovinné parametry, jinak beze změny chování
export function buildHerdblokUsek({
  widthMM, depthMM, leftEndType, rightEndType, collar, panelItems,
  includeDesk = true,          // NOVÉ — false u OBOU stran ostrova
  chamferAllCorners = false,   // NOVÉ, protéká i do nosu — viz §7
})
```

`buildMonoBlock` pro `island`:
1. Postaví JEDNU desku: `buildHerdblokDesk({ widthMM: lengthMM, depthMM:
   totalDepthMM, leftEndType, rightEndType, chamferAllCorners: … })`
   (`chamferAllCorners` podle §7).
2. Postaví `herdblokA`/`herdblokB` úseky přes `buildHerdblokUsek(...,
   { includeDesk: false, chamferAllCorners: … })` — korpus/panel/lišta/
   nos pro KAŽDOU stranu zvlášť, žádná vlastní deska.
3. Umístí/otočí podskupinu strany B — viz §8.
4. Boční kryty (`computeSideCovers`/`buildSideCover`) u ostrova NESMÍ
   vzniknout dvakrát (jednou na kraj A, jednou na kraj A hraničící se
   „zadní" stranou) — **jeden kryt na X-konci musí jít od čela A ke
   čelu B a zakrýt i mezeru mezi zády podestaveb** (PREDANI.md, přesná
   citace zadavatele v §2 tamtéž). To znamená přepočítat rozsah
   `fromZMM`/`toZMM` krytu na `DESK_OVERHANG_FRONT_MM` (blízko čela A)
   až `totalDepthMM − DESK_OVERHANG_FRONT_MM` (blízko čela B), NE
   odvozovat ho jen z hloubky jednoho úseku herdbloku
   (`herdblokDepthAtX`, dnešní pomocná funkce, počítá jen s jednou
   stranou — pro ostrov potřebuje ostrovní variantu nebo náhradu).
5. Límec (left/right) — viz §9, staví se JEDNOU nad kombinovaným
   obrysem desky, ne uvnitř každého `buildHerdblokUsek` zvlášť.

Přesné funkční dělení kroku 4 (nová/upravená pomocná funkce v
`mono-geometry.js`) je čistě uvnitř tohoto souboru — žádná jiná část
týmu na to nesahá, pojmenování nechávám na implementaci, jen požadavek
na výsledek platí závazně.

---

## 7. `cornerPoints()` — větev pro ostrov (`js/mono-geometry.js`)

Dnešní kód (ř. 286–296):
```js
function cornerPoints(type, cornerX, cornerZ, dxIn, dzIn, from) {
  const sharp = { x: cornerX, z: cornerZ };
  if (type === END_TYPES.VERTICAL_PLATE_CHAMFER && dzIn > 0) {
    // ... zkosený roh
  }
  return [sharp];
}
```

`dzIn > 0` dnes rozlišuje PŘEDNÍ roh (zkosí se) od zadního (zůstane
ostrý) — to je pravidlo pro `single`. U `island` mají být zkosené
**VŠECHNY čtyři rohy** (HODNOTY-MONO.md §7.5, potvrzeno 8. 8. 2026).

**Požadovaná úprava:** `cornerPoints` dostane nový parametr
`chamferAllCorners = false`, podmínka se změní na:
```js
if (type === END_TYPES.VERTICAL_PLATE_CHAMFER && (chamferAllCorners || dzIn > 0)) {
```
Parametr se musí protéct skrz `buildHerdblokOutline()` (nová
`chamferAllCorners` v jejím parametrovém objektu) a `noseOutline()`
stejně (viz §13 — jestli nos u ostrova vůbec potřebuje týž parametr, je
otevřená otázka) i skrz nově navrhovaný `buildHerdblokDesk()` (§6), aby
volající (`buildMonoBlock`) měl JEDNO místo, odkud `chamferAllCorners:
variant === 'island'` nastaví.

**Netýká se to `cornerPoints` volání pro zadní roh limce/krytu** —
u ostrova žádný „zadní" limec/roh v tomhle smyslu není, viz §9.

---

## 8. Zrcadlení — obě strany, `js/mono-block.js`

### X (délka bloku) — STEJNÉ pro obě strany, beze změny vzorce

`mirrorX(xMM, lengthMM, widthMM=0)` (dnešní, mono-block.js ř. 79-81) se
**používá STEJNĚ pro stranu A i stranu B** — žádná další úprava vzorce.

**Zdůvodnění (odvozeno z už rozhodnutého pravidla o ramenech, viz
PREDANI.md ČÁST F): rameno má JEDNU polohu `positionXMM` sdílenou pro
celý blok (ne dvě, po jedné na stranu), zrcadlenou přes tentýž
`mirrorX`.** To dává smysl JEN pokud `mirrorX`-přepočtená souřadnice X
znamená TOTÉŽ místo podél délky bloku bez ohledu na to, jestli se
díváme na stranu A nebo B — jinak by „rameno na spáře, se stejnou X
souřadnicí jako obě podestavby pod ním" nedávalo geometrický smysl.
**Důsledek:** položka na `xMM` v `herdblokA`/`podestavbyA` a položka na
STEJNÉM `xMM` v `herdblokB`/`podestavbyB` musí po zrcadlení vyjít na
STEJNÉM world X — jsou „naproti sobě" přes spáru. Tohle je odvozený
požadavek, ne doslovné zadání — potvrď ho zadavateli, viz §13.

### Z (hloubka) — MIRRORUJE SE JEN U STRANY B, ne rotací

Strana A se staví jako dosud (lokální z 0 = její čelo/panel, roste
dozadu k spáře). Strana B se MUSÍ objevit na druhém konci kombinované
desky, čelem ven — ale (na rozdíl od `block.js`/SEGMENTu) **NE přes
`group.rotation.y = Math.PI`**, protože ta rotace by zrcadlila i X, a
tím porušila požadavek výš (položka na stejném `xMM` by na straně B
vyšla na OPAČNÉM world X než na straně A — to je přesně to, co
`block.js` dělá pro SEGMENT, a je to tam SPRÁVNĚ, protože SEGMENT nemá
sdílenou X osu mezi A/B; MONO ji mít MÁ, viz odstavec výš).

**Doporučený mechanismus:** čistý zrcadlový převrat jen v ose Z —
`THREE.js` nemá rotaci, která by otočila jen jednu osu (každá rotace o
180° kolem jedné osy otočí NUTNĚ obě zbylé), takže jde o reflexi, ne
rotaci:
```js
sideBGroup.scale.z = -1;
sideBGroup.position.z = mm(totalDepthMM);
```
Lokální z=0 strany B (její vlastní čelo/panel) tak vyjde na world
z=`totalDepthMM` (vzdálený konec, čelem ven) a lokální z=`depthBMM`
(její vlastní „zadní" hrana/spára) na world z=`depthAMM` (spára se
stranou A) — přesně požadovaný sendvič.

**POZOR na normály/winding:** záporné měřítko je zrcadlová reflexe a
otáčí orientaci trojúhelníků (stejný jev, jaký uvnitř `mono-geometry.js`
už řeší `buildH2Fillet` přes `mat.side = THREE.DoubleSide`, viz komentář
tamtéž „Winding se liší podle dirX (mirror)"). Materiály použité pro
`sideBGroup` (nebo jejich klony) pravděpodobně potřebují stejnou
pojistku `DoubleSide`, jinak může strana B zvenčí vypadat neprůhledně
špatně/černě nebo naopak průsvitně. Ověřit vizuálně i přes `Box3` (že
geometrie sedí na správných souřadnicích bez ohledu na to, jak to
vypadá).

**Tohle je DOPORUČENÍ pro geometrickou implementaci (uvnitř jednoho
souboru, žádná kolize) — koncept „X sdílené, jen Z se zrcadlí" je ale
POŽADAVEK odvozený z pravidla o ramenech výš a patří potvrdit, viz §13.**

### Ramena — mono-block.js, TODO u ř. 262–272 (dnešní kód)

Dnešní `buildMonoScene` staví ramena VŽDY jako „u stěny" (`baseDir: -1,
zLocalMM: depthAMM − offsetMM`, konstanty `ARM_BACK_OFFSET_*`). Nová
větev pro `island` — **kopíruje přesně `block.js#computeArmPlacement`,
větev `island`**:

```js
if (isIsland) {
  const offsetMM = clamp(
    arm.offsetMM != null ? Number(arm.offsetMM) : ARM_CENTER_OFFSET_DEFAULT,
    ARM_CENTER_OFFSET_MIN, ARM_CENTER_OFFSET_MAX,
  );
  zLocalMM = depthAMM + offsetMM;
  baseDir = 1;
} else {
  // dnešní větev beze změny (ARM_BACK_OFFSET_*, baseDir: -1)
}
```

`ARM_CENTER_OFFSET_MIN/MAX/DEFAULT` **už existují** v `js/arms.js`
(ověřeno čtením — `js/arms.js` se pro tenhle úkol VŮBEC NEMĚNÍ, jen se
doimportují do `mono-block.js`, stejně jako `ARM_BACK_OFFSET_*` už
jsou). Poloha X (`mirrorX`) a negace úhlu (`angleDeg: -(...)`) se
NEMĚNÍ — ramena nejsou zdvojená, je to pořád JEDNA sada, jen se mění
vzorec pro `zLocalMM`/`baseDir` podle varianty.

**`ui.js` už umí totéž přepínání pro SEGMENT** (ř. 1286–1290,
`renderArmDetailGrid`, `isIsland ? ARM_CENTER_OFFSET_* : ARM_BACK_OFFSET_*`)
— slouží zobrazení posuvníku v kartě ramene, je SDÍLENÉ pro oba
produkty (karta ramene je stejná komponenta), **žádný zásah v `ui.js`
tady není potřeba**, jen v `mono-block.js` (geometrie).

---

## 9. Límec u ostrova (`js/mono-block.js` + `js/mono-geometry.js`)

- **`back` se u `island` NIKDY nepoužije**, bez ohledu na uloženou
  hodnotu `state.mono.limec.back`. `buildCollarSpec()`
  (mono-block.js, dnešní ř. 103–111) dostane `variant` a
  vynechá `back` z pole úplně, když `variant === 'island'`.
- `left`/`right` se staví JEDNOU nad kombinovaným obrysem desky (celá
  `totalDepthMM`), NE dvakrát (jednou na obrys strany A, jednou na
  obrys strany B) — jinak by u spáry vznikly dvě kratší stěny místo
  jedné dlouhé, nebo by se `left`/`right` limec nakreslil jen podél
  hloubky JEDNÉ strany. Praktický důsledek pro §6 krok 5: limec se
  staví nad stejným obrysem, jaký použil `buildHerdblokDesk()`
  (`widthMM: lengthMM, depthMM: totalDepthMM`), ne uvnitř
  `buildHerdblokUsek()` pro A nebo B zvlášť.
- Podmínka „left/right se kreslí jen když je dotyčný konec
  `svislaDeska`" (dnešní `buildHerdblokUsek`) platí beze změny — je to
  podmínka na `leftEndType`/`rightEndType`, které jsou sdílené.

---

## 10. i18n klíče (`js/i18n.js`) — pět jazyků: en, de, pl, cs, sk

**Přepínač A/B nepotřebuje žádný nový klíč** — `side.sideA`,
`side.sideB`, `strip.editSideTitle`, `palette.targetSide`,
`palette.targetSideTitle` už existují a použijí se beze změny (§4).

`mono.armsNote` **už dnes popisuje obě varianty** („Rameno sedí na
desce; u bloku u stěny se odsazuje od zadní hrany, u ostrova od
středu.") — nemění se, jen se konečně stane pravdivým.

Jediný nový klíč, který se váže k VĚCNÉMU rozdílu (limec `back` u
ostrova nedává smysl), vkládat za `mono.collar.chamferNote` ve stejném
pořadí jazyků (cs / en / de / pl / sk) jako `ZADANI-MONO-UI.md`:

```
mono.collar.islandNote   U ostrova se zadní límec nenabízí, ostrov nemá záda. /
                          Island units have no back edge, so the back collar isn't offered. /
                          Der Insel fehlt eine Rückseite, daher gibt es keine hintere Aufkantung. /
                          Wyspa nie ma tyłu, dlatego tylny rant nie jest oferowany. /
                          Ostrov nemá zadnú stranu, preto sa zadný límec neponúka.
```

Použití je nepovinné — je na implementaci, jestli formulář límce u
`island` zobrazí vysvětlující poznámku, nebo checkbox „zadní límec"
prostě úplně vynechá beze slova (obojí splňuje „v UI se nenabízí").
Pokud se poznámka nepoužije, klíč se prostě nezaloží — **nezakládat
nevyužitý i18n klíč jen proto, že je tady navržený.**

---

## 11. CSS třídy (`css/style.css`)

Žádné nové třídy nejsou zadáním vyžadované — §4 doporučuje ZNOVUPOUŽÍT
`.strip-tab`/`.strip-tab.active` pro tlačítka A/B uvnitř `mono-ui.js`.

Jediná nová třída, kterou implementace pravděpodobně bude potřebovat, je
OBAL přepínače (aby šlo řídit jeho rozestup/zarovnání nad záložkami
herdblok/podestavby/panel) — pokud vznikne, jmenuje se s prefixem
`mono-`, např. `.mono-side-switch` (obal) — vnitřní tlačítka zůstávají
`.strip-tab`. **Přesné rozvržení a barvy nechat rozhodnout UI agentovi
v rámci existujícího vzhledu pásu MONO, žádný nový mockup pro tohle
zadání není připravený** (viz §13 — pokud si implementace není jistá,
je to na zvážení, ne na vymýšlení nového vzhledu od nuly).

---

## 12. Kdo co vlastní — tři souborově oddělené kusy

### Kus 1 — data, ukládání, rozvržení
**Soubory:** `js/main.js`, `js/mono-layout.js`

- `state.mono` nový tvar (§1), `CONFIG_VERSION` 6, `serializeConfig`/
  `applyConfig` tolerantní čtení starého i nového formátu (§1).
- `onNewProject` rozšíření (§1).
- `getMonoSideList`/`findMonoItem` (§5).
- `onMonoAdd`/`onMonoRemove`/`onMonoUpdate`/`onMonoMove`/
  `onMonoFillPodestavby`/`onMonoCollarChange`/`onMonoSelect`/
  `onMonoTabChange`/`onMonoEndTypeChange` (§5) — signatury přesně podle
  §5, `onEditSideChange` se NEMĚNÍ (už funguje, viz §4).
- `computeMonoLayout(state, side)`/`computeMonoChecks(state, side)`
  (§3) — signatura a chování.

### Kus 2 — geometrie
**Soubory:** `js/mono-geometry.js`, `js/mono-block.js`

- `buildHerdblokDesk` (nová), `buildHerdblokUsek` (`includeDesk`,
  `chamferAllCorners`), `cornerPoints`/`buildHerdblokOutline`/
  `noseOutline` (§6, §7).
- Boční kryty pro ostrov — jeden kryt na X-konec od čela A po čelo B
  (§6 krok 4).
- Límec left/right nad kombinovaným obrysem, `back` nikdy u ostrova
  (§9).
- `buildMonoBlock` nový podpis (§6).
- `buildMonoScene` — volání `computeMonoLayout` pro obě strany,
  zrcadlení strany B (§8), ramena podle varianty (§8), `dimensions`
  výstup s reálným `depthBMM` (§6).
- **`js/arms.js` se NEMĚNÍ** — `ARM_CENTER_OFFSET_*` už existují, jen
  se doimportují do `mono-block.js` (§8).

### Kus 3 — rozhraní
**Soubory:** `js/mono-ui.js`, `js/ui.js`, `css/style.css`, `js/i18n.js`

- Přepínač strany A/B uvnitř `mono-ui.js` (§4) — nový vykreslovací kód,
  `currentSide` výpočet, volání `computeMonoLayout(state, currentSide)`.
- `onMonoAdd`/`onMonoFillPodestavby` volání s novým parametrem `side`/
  `currentSide` na VŠECH čtyřech místech z tabulky v §5 (dvě v
  `ui.js`, dvě v `mono-ui.js`).
- `ui.js#renderMonoPaletteList` — odznak cílové strany u `island` (§4).
- Nový i18n klíč `mono.collar.islandNote`, pokud se použije (§10).
- Nová CSS třída na obal přepínače, pokud implementace potřebuje (§11).
- **`index.html` se pro tenhle úkol NEMĚNÍ** — `mono-ui.js` staví celý
  obsah `#mono-strip-body` i `#strip-tabs` dynamicky, žádný nový pevný
  DOM prvek není potřeba (ověřeno — dnešní `renderAll` maže a znovu
  staví `els.body`/`els.tabs` kompletně při každém překreslení).

### Kontrola kolizí mezi kusy

- **`js/mono-block.js`** čte `computeMonoLayout` (kus 1) a staví přes
  `mono-geometry.js` (kus 2, TENTÝŽ soubor tedy sahá do jednoho balíku
  — kus 2 vlastní OBA soubory, žádná kolize).
- **`js/mono-ui.js`** čte `computeMonoLayout` (kus 1) a nic z
  `mono-geometry.js`/`mono-block.js` (kus 2) — dodržuje dnešní tvrdé
  pravidlo rozhraní (mono-ui.js smí importovat VÝHRADNĚ z
  `mono-layout.js`, viz hlavička souboru). **Žádná kolize, ale POŘADÍ
  ZÁVISLOSTI: kus 3 (UI) potřebuje mít hotový kus 1 (nová signatura
  `computeMonoLayout(state, side)`), než ho může zavolat se dvěma
  parametry.** Doporučeno pustit kus 1 jako první, nebo kus 3 dočasně
  pracovat proti dohodnuté signatuře i před jejím dopsáním (contract
  je v tomhle dokumentu pevně daný, není potřeba čekat na hotový kód).
- **`state.mono` nová pole** (`herdblokA` apod.) čte/píše `main.js`
  (kus 1) a `mono-block.js` (kus 2) přímo (`.mono.herdblok`/
  `podestavby`/`panelItems` — ověřeno grepem, žádný jiný soubor tahle
  pole přímo nečte). `mono-ui.js`/`ui.js` (kus 3) na `state.mono` sahají
  jen pro `leftEndType`/`rightEndType`/`limec` (SDÍLENÉ, beze změny
  tvaru) — **žádná kolize v poli, které by dva kusy zapisovaly
  současně.**
- **Nenalezeno žádné místo, kde by museli DVA agenti editovat TENTÝŽ
  soubor.** Rozdělení sedí.

---

## 13. OTEVŘENÉ OTÁZKY NA ZADAVATELE

Nic z tohohle se nesmí domýšlet bez odpovědi — kde je v dokumentu výš
použité „doporučení"/„návrh", je to nejlepší dostupný odhad, ne
potvrzené zadání.

1. **Sdílená osa X mezi stranou A a B.** V §8 dovozuji ze zadání o
   ramenech (jedna sdílená `positionXMM`, zrcadlená stejným `mirrorX`
   pro celý blok), že položka na stejném `xMM` v `herdblokA` a
   `herdblokB` má vyjít na STEJNÉM world X (řady „naproti sobě" přes
   spáru), NE zrcadleně jako u SEGMENTu (`block.js` mirroruje X i Z
   dohromady přes `rotation.y = Math.PI` pro stranu B). Je tahle
   dedukce správně, nebo mají být řady A/B nezávislé (jako u SEGMENTu),
   a rameno má dostat vlastní přepočet X specificky pro ostrov?
2. **Nos (vodopád) na X-koncích u ostrova.** Má na každém konci
   (levém/pravém) vzniknout JEDEN nos přes CELOU kombinovanou hloubku
   (`totalDepthMM`, stejný princip jako u jedné desky — text „přetéká
   v celé své šířce na bok herdbloku a celý ho zakrývá" z PREDANI.md
   úkolu 2 by tomu nasvědčoval), nebo dva nosy, každý přes hloubku jen
   jedné strany (jako korpus/panel/lišta)? HODNOTY-MONO.md ani
   PREDANI.md to pro variantu ostrov výslovně neříkají — jen pro desku
   a boční panel.
3. **Vzhled přepínače strany A/B v pásu MONO.** §4/§11 navrhují
   znovupoužít `.strip-tab` a umístit přepínač nad záložky herdblok/
   podestavby/panel. Zadavatel u dřívějších podobných rozhodnutí
   (úkol 5, úkol 11 v PREDANI.md) trval na tom, že se vizuální varianty
   napřed NAKRESLÍ jako mockup a vybere se z nich — chce to samé i
   tady, nebo stačí implementaci nechat na uvážení UI agenta v rámci
   existujícího vzhledu (bez nového mockupu)?
4. **`state.variant` u nového MONO projektu.** `onNewProject` dnes
   vůbec nenastavuje `state.variant` (zůstává, co bylo předtím) — je to
   existující mezera nesouvisející jen s ostrovem, ale ostrov ji dělá
   viditelnější (nový MONO projekt by mohl „zdědit" `island` ze
   SEGMENTu a rovnou ukázat prázdnou stranu B). Řešit v tomhle úkolu,
   nebo nahlásit zvlášť jako drobnost mimo rozsah?

---

## 14. Přejímka

Každý ze tří kusů (§12) končí:

1. **`node --check`** na KAŽDÝ změněný `.js` soubor — musí projít.
2. **Každý nový i18n klíč přesně 5×** (en, de, pl, cs, sk) — dnes
   je to jen `mono.collar.islandNote`, pokud se vůbec použije (§10).
3. **Geometrie (kus 2) doložená spočítanými souřadnicemi**, ne
   screenshotem: `Box3.setFromObject` na KOŘENOVOU skupinu AŽ PO
   `updateMatrixWorld(true)` (past z `PREDANI.md` ČÁST A2 — na
   potomkovi se matice rodičů nepřepočítá). Konkrétně doložit:
   - Deska ostrova jde od `z ≈ 0` do `z ≈ totalDepthMM` (jeden kus, ne
     dva se spárou).
   - Boční kryt na X-konci jde od `z ≈ DESK_OVERHANG_FRONT_MM` do
     `z ≈ totalDepthMM − DESK_OVERHANG_FRONT_MM` (jeden kus).
   - Položka na stejném `xMM` v `podestavbyA`/`podestavbyB` (nebo
     potvrzený opak — viz otázka 1 v §13) vychází na world X podle
     toho, co zadavatel potvrdí.
   - **Žádné záporné `z`** nikde ve scéně (tvrdá podmínka modulu,
     platí i pro stranu B po zrcadlení).
   - Zkosený konec u ostrova (`svislaDeskaZkos`) — všechny čtyři rohy
     zkosené, ne jen dva.
4. **Plný proplach keše PŘED KAŽDÝM ověřením v prohlížeči** — podle
   `PREDANI.md` ČÁST A2, seznam pokrývající všech 18 modulů. Starší
   sedmisouborová verze dvakrát způsobila falešné hlášení vady.
5. **Každý agent si píše měřicí harness do VLASTNÍ podsložky**
   dočasného adresáře (např. `scratchpad/kus-1/`, `scratchpad/kus-2/`,
   `scratchpad/kus-3/`), nikdy nepřepisuje soubor, který by mohl patřit
   jinému kusu — dva agenti si dřív navzájem přepsali stejně
   pojmenovaný stub pro `three` (PREDANI.md ČÁST A2).
6. **SEGMENT se nesmí rozbít.** Žádná změna v tomhle úkolu nemá sahat
   do `js/block.js` ani měnit chování SEGMENTu — `js/arms.js` se
   nemění vůbec (§8), `js/ui.js` se mění jen v MONO-specifických
   větvích (renderMonoPaletteList), SEGMENTOVÁ větev renderStripTabs/
   renderPaletteList zůstává nedotčená. Ověřit po zásahu: SEGMENT
   (`single` i `island`) se staví a ovládá stejně jako před úkolem.
