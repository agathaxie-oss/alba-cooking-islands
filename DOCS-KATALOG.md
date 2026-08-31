# Dokumentace katalogu (session A–E)

Stav kódu po katalogové session (etapy A–E z `ZADANI-KATALOG.md`).  
Účel: jiný agent / session nemusí číst chat — stačí tento soubor + odkazované zadání.

**Související:** `ZADANI-KATALOG.md` (normativní zadání), `ZADANI-GEOMETRIE-RM.md` (RM layouty), `PREDANI.md` §B0 (stav / zítra), `mockup-katalog.html`.

---

## A) Struktura katalogu (data)

### Strom souborů

```
katalog/
  manifest.json                 # index (factoryVersion + items[]) — načte se vždy
  kategorie.json                # taxonomie typů + i18n názvy (volitelné)
  polozky/
    <id>.json                   # plná definice položky (lazy / po bootu přednačtené)
img/pristroje/
  <id>-card.webp|.svg           # náhled karty (libovolný úhel)
  <id>-top.webp|.svg|.jpg…      # top view — reálná fotka NEBO SVG placeholder
```

Aktuálně **10 položek** v `katalog/polozky/` (shodná id v `manifest.json`):

| id | type | topFeature | minCutoutDepthMM |
|---|---|---|---|
| `al-pg22-800-g` | gas_range | burners4 | 700 |
| `al-pg13-400-g` | gas_range | burners2 | 700 |
| `al-pg11-400-g` | gas_range | burners2 | 900 |
| `al-pg28-800-g` | gas_range | burners4 | 900 |
| `al-cer14-800-e` | ceramic | ceramic4 (+ glass/zone Ø) | 900 |
| `al-gr15-800-e` | griddle | grill (+ cookArea*) | 900 |
| `al-fr10-400-e` | fryer | fryer1 (zatím bez absolutních mm) | 700 |
| `al-fr88-400-e` | fryer | fryer2 (+ vat*/basket*) | 700 |
| `al-fr1010-600-e` | fryer | fryer2 (+ vat*/basket*) | 700 |
| `al-ind5-500-e` | induction | induction | 700 |

### `manifest.json` — pole

| Pole | Typ | Účel |
|---|---|---|
| `factoryVersion` | number | verze továrny; do projektu + cache-bust assetů |
| `schema` | number | verze schématu |
| `items[]` | array | index pro mřížku / filtry **bez** plných JSON |
| `items[].id` | string | kebab-case, = název souboru |
| `items[].type` | string | filtr (viz `kategorie.json`) |
| `items[].minCutoutDepthMM` | number | filtr + varování vs hloubka bloku |
| `items[].publicCode` | string | UI kód (`AL-…`) |
| `items[].name` | `{en,de,pl,cs,sk}` | i18n název |
| `items[].origin` | string | vlaječka (`IT`, `DE`…) |
| `items[].cardImage` | path | cesta k card assetu |
| `items[].tags` | string[] | hledání |

### Plná položka `polozky/<id>.json`

Navíc oproti manifestu (a často i duplikát polí pro samostatný soubor):

| Pole | Poznámka |
|---|---|
| `supplier`, `supplierCode` | **ne v UI** — nákup / dodavatel |
| `description`, `construction` | i18n objekty (5 jazyků) |
| `widthMM`, `minWidthMM`, `widthAdjustable` | šířka / meze |
| `depthMM`, `minDepthMM` | hloubka řady / min |
| `minCutoutDepthMM` | vestavná hloubka v desce |
| `topFeature` | viz níže |
| `topFixed` | jmenovitá šířka kresby na desce |
| `controls` | `{ type: knob\|button\|switch, count: 0–8 }` |
| `allowedBodyStyles` | `closed` / `doors` / `open` |
| `powerKW`, `voltage`, `gasKW` | energie |
| `zones` | hořáky / zóny — viz níže |
| `cardImage`, `topImage` | cesty (nikdy base64) |
| `geometryNotes` | poznámky pro schválení RM |

Po normalizaci v `catalog.js` přibývají runtime pole: `builtin: true`, `visible` (= je v paletě), `catalogCode` (= `publicCode`), `descriptionText` / `constructionText` (vyřešený jazyk).

#### `zones[]`

```json
{ "powerKW": 7.5, "fuel": "gas"|"electric", "position": "front-left"|"front-right"|"back-left"|"back-right"|"front"|"back" }
```

- Pořadí = RM zóna 1…N.
- `position` = místo na desce (front = čelo / ovládací panel = menší Z ve 3D).
- UI: detail + mini schématko; na kartě zkratky FL/FR/…

#### `topFeature`

```json
{ "type": "<typ>", /* volitelné absolutní mm: */ }
```

Normalizované volitelné klíče v loaderu:  
`vatWidthMM`, `vatDepthMM`, `basketWidthMM`, `basketDepthMM`,  
`cookAreaWidthMM`, `cookAreaDepthMM`,  
`glassWidthMM`, `glassDepthMM`, `zoneDiameterMM`, `zoneInnerDiameterMM`.

| type | Absolutní mm (příklady) | 3D / floorplan |
|---|---|---|
| `burners2` / `burners4` | — (mřížky v layout helperu) | `resolveCastIronBurnerLayout` |
| `fryer2` | vat* + basket* | `resolveFryer2Layout` |
| `fryer1` | zatím typicky bez mm | proporční `buildFryer1Top` |
| `grill` | cookArea* | `resolveGrillLayout` |
| `ceramic4` | glass* + zoneDiameter* | `resolveCeramic4Layout` |
| `induction` | — | čtvercová zóna |
| `none` / další | — | bez / legacy |

### localStorage

| Klíč | Obsah |
|---|---|
| `alba-katalog-paleta-v1` | JSON pole **id v osobní paletě** |
| `alba-katalog-skryte-v1` | **legacy** — při absenci palety se invertuje vůči manifestu → zapíše se paleta a klíč se smaže |
| `alba-katalog-v1` | **starý persist továrny** — při `loadManifest` se maže; továrna se **nepersistuje** |

**Default palety:** pokud neexistuje ani paleta ani legacy skryté → **všechna id z manifestu**.

### Projekt (export / import JSON)

| Pole | Význam |
|---|---|
| `factoryVersion` | verze továrny při uložení |
| `catalogSnapshot` | plné definice **jen použitých** katalogových id (`buildSnapshot`) |
| legacy `catalog` | při loadu se bere, pokud chybí `catalogSnapshot` |

`importCatalog(snapshot)` → paměťová vrstva `projectSnapshot` (Map). **Neslučuje** do továrny, **nezapisuje** do localStorage katalogu.

---

## B) Rozhraní pro jiné soubory (API contract)

### `js/catalog.js` — exporty

Konstanty: `CATALOG_STORAGE_KEY`, `PALETTE_STORAGE_KEY`.

#### Sync vs async

| Async | Sync |
|---|---|
| `loadManifest()`, `getItem(id)`, `buildSnapshot(usedIds)` | vše ostatní |

Po úspěšném `loadManifest()` se **přednačtou všechny** `polozky/<id>.json` do cache → `getById` / `getCatalog` / `getVisible` fungují sync hned po bootu.  
`getItemSync` / `getById` bez cache vrací jen cache nebo `projectSnapshot` (jinak `null`).

#### Aliasy starých id

```js
lotus_pcd_68g   → al-pg22-800-g
lotus_f10d_64et → al-fr10-400-e
berner_bi1eg5   → al-ind5-500-e
lotus_ftld_66et → null   // záměrně bez položky
alba_ebm_11     → null
```

`resolveAlias`: mapovaný cíl / `null` (= žádná položka) / jinak vstupní id.

#### Tabulka API + kdo volá

| Export | Podpis | Volá |
|---|---|---|
| `getFactoryVersion` | `(): number` | `main.js`, `catalog-browser.js` |
| `loadManifest` | `(): Promise<Manifest>` | `main.js` (await před default segmenty / UI) |
| `getManifestItems` | `(): ManifestItem[]` | `catalog-browser.js` (mřížka, filtry) |
| `getCategories` | `(): object \| null` | `catalog-browser.js` |
| `getItem` | `(id) => Promise<Item\|null>` | `catalog-browser.js` (detail), vnitřně snapshot |
| `getItemSync` | `(id) => Item\|null` | `catalog-browser.js` (zones na kartě) |
| `getById` | alias `getItemSync` | `main.js`, `modules.js`, `ui.js`, `mono-block.js` |
| `getCatalog` | `(): Item[]` (cache + visible flag) | `device-manager.js` |
| `getVisible` | `(): Item[]` = **položky v paletě** | `ui.js` (levý panel palety) |
| `getPaletteIds` | `(): string[]` | (API; UI zatím přes getVisible) |
| `isInPalette` | `(id) => boolean` | `catalog-browser.js` |
| `addToPalette` / `removeFromPalette` | `(id) => void` | `catalog-browser.js` |
| `resolveName` | `(item, lang) => string` | `catalog-browser.js` |
| `getEntryDisplayName` | `(entry) => string` | `ui.js`, `modules.js`, `device-manager.js` |
| `getEntryDescription` / `getEntryConstruction` | `(entry) => string` | `catalog-browser.js`, `device-manager.js` |
| `buildSnapshot` | `(usedIds) => Promise<Item[]>` | `main.js` (save) |
| `lookupForRender` | `(id, snapshot) => Item\|null` | exportováno; **zatím bez přímého callera** v app (snapshot→`importCatalog` + `getById`) |
| `importCatalog` | `(rawArray) => void` | `main.js` (load projektu / new) |
| `getHiddenIds` | `(): string[]` | **deprecated** — id z manifestu **mimo** paletu |
| `setItemHidden` | `(id, hidden) => void` | **deprecated** → remove/addFromPalette |
| `setVisible` | `(id, visible) => void` | `device-manager.js` (mapa na setItemHidden) |
| `upsert` / `remove` / `duplicate` / `resetBuiltin` | stubs no-op + `console.warn` | `device-manager.js` (do etapy G) |

**Kontrakt palety**

- `getVisible()` = položky **v paletě** (ne „ne-skryté“ v starém smyslu).
- Default = všechna id z manifestu.
- Továrna je **read-only**; editor upsert v device-manager je no-op.

### `js/catalog-browser.js`

```js
setupCatalogBrowser({
  getBlockDepthMM?: () => number,   // pro depth badge / strip
  onPaletteChange?: () => void,     // po add/remove / close → ui.render
}): { open(), close(), isOpen(), refresh() }
```

- Overlay `#catalog-overlay` — e-shop mřížka + **detail ve stejném overlay**.
- CTA jen **Přidat / Odebrat z palety**. **Nepřidává segment na blok.**
- Na blok až klik z levého panelu palety (`ui.js` → `onAddCatalog` / ekvivalent) **po** zavření katalogu.
- Scroll lock: třídy `html.cat-overlay-open` + `body.cat-overlay-open`; scroluje `.cat-scroll`.

---

## C) Změny mimo `katalog/` (hlavní app soubory)

### `js/catalog.js` — přepis

**Proč:** továrna ze souborů místo localStorage; paleta jako pozitivní množina; kompatibilní most pro starý kód.

**Klíčové:** `loadManifest`, `itemCache`, `projectSnapshot`, `paletteIds`, `ALIASES`, `normalizeFactoryItem` / `normalizeZones` / `normalizeTopFeature`, deprecated hidden API, stubs upsert/remove.

### `js/catalog-browser.js` — nový

**Proč:** e-shop UI (§7) oddělený od device-manager editoru.

**Klíčové:** `setupCatalogBrowser`, `buildCard`, `buildDetail`, `buildTopViewSchematic` / `buildDetailTopView`, `buildZonesSchematic`, filtry depth/type/search.

### `js/main.js`

**Proč:** boot továrny před UI; snapshot v projektu; otevření katalogu místo editoru.

**Klíčové:**

- `await loadManifest()` před `createDefaultSegmentsA()`.
- Default segmenty: `al-pg22-800-g` + `al-fr10-400-e` (+ neutrální).
- Save: `factoryVersion`, `catalogSnapshot` přes `buildSnapshot`.
- Load: `importCatalog(catalogSnapshot || legacy catalog)`.
- `setupCatalogBrowser({ getBlockDepthMM, onPaletteChange })`.
- `onOpenCatalog` / `onOpenDeviceManager` → `catalogBrowser.open()` (topbar i odkaz v paletě).

### `js/ui.js`

**Proč:** paleta = tovární položky z `getVisible()`; speciální řádky mimo katalog.

**Klíčové:**

- `getCatalogVisible()` = `getVisible` — seznam v `#palette-list`.
- Speciální: neutrální, zásuvky GN, vlastní modul (`palette.special*`).
- `#palette-edit-catalog` + `#device-manager-btn` → `onOpenCatalog`.
- Hledání podle jména / `catalogCode`.

### `js/modules.js`

**Proč:** 3D layouty podle `topFeature` z JSON (absolutní mm kde je RM).

**Klíčové typy / helpery:**

- `burners2` / `burners4` — `resolveCastIronBurnerLayout` (absolutní mřížky ~390×360, clamp na 700).
- `fryer2` — `resolveFryer2Layout` (`vat*` / `basket*`).
- `grill` — `resolveGrillLayout` (`cookArea*`).
- `ceramic4` — `resolveCeramic4Layout` (glass + Ø zón).
- `applyTopFeature` — dispatcher; `getById` / `getEntryDisplayName` pro definice segmentů.

### `js/i18n.js`

**Proč:** UI katalogu ve 5 jazycích (ne názvy výrobků — ty jsou v JSON).

**Skupiny klíčů (ne doslovný výpis všech jazyků):**

- `catalog.*` — title, open, add/remove/inPalette, filtry, depth warn, detail*, empty/noResults, widthFrom/Exact…
- `catalog.zone*` / `catalog.zoneAbbr.*` — pozice zón + schématko
- `topFeature.*` — labely typů desky
- `palette.emptyCatalog`, `palette.specialNeutral|Drawers|Custom|…`
- `controlType.*`, `bodyStyle.*` (detail specs)

### `js/floorplan.js`

**Proč:** 2D půdorys reportu odpovídá `topFeature` (včetně absolutních rozměrů fryer2/grill).

**Klíčové:** `drawDeviceTopView` — větve `burners2/4`, `ceramic4`, `fryer2/1`, `grill`, induction-like…

### `index.html`

**Proč:** markup overlay e-shopu + vstupy v topbaru / paletě.

**Klíčové:**

- `#catalog-overlay` / `.cat-dialog` / `#catalog-grid` / `#catalog-detail` / filtry / `#catalog-foot`.
- `#device-manager-btn` i18n `catalog.open` (otevírá katalog, ne editor).
- `#palette-edit-catalog`.
- Device-manager overlay zůstává v DOM (etapa G).

### `css/style.css`

**Proč:** e-shop vzhled + scroll lock overlay.

**Klíčové třídy:**

- `html.cat-overlay-open` / `body.cat-overlay-open` — `overflow: hidden`
- `.cat-overlay`, `.cat-dialog`, `.cat-scroll`, `.cat-grid`, `.cat-card*`, `.cat-chip`, `.cat-badge-depth`, `.cat-flag`
- detail: `.cat-detail*`, `.cat-zones-*`, `.cat-detail-top*`
- `.cat-is-detail` — skrytí toolbaru/mřížky při detailu

### `PREDANI.md` — A2 keš seznam

Doplněno / drženo: `js/catalog.js`, `js/catalog-browser.js`, `katalog/manifest.json`, `katalog/kategorie.json` (+ celý ruční seznam ES modulů). Při změně JSON položky propláchnout i `katalog/polozky/<id>.json` a assety v `img/pristroje/` (nejsou v jednom static listu — fetch s `cache:'reload'` dle potřeby).

---

## D) Vědomě neděláno / zbývá

Z `ZADANI-KATALOG.md` etapy a PREDANI §B0 / ZÍTRA:

| Etapa / téma | Stav |
|---|---|
| **F** | Další obsah katalogu jen z konkrétních URL od Jaroslava |
| **G** | Pryč / přestavba device-manager editoru (dnes stubs + staré UI v DOM) |
| **H** | Report / soupis `publicCode` doladění |
| **I** | Dialog diff `factoryVersion` při načtení staršího projektu |
| Reálné **top fotky** | Většina `*-top.svg` placeholderů → generovaný SVG půdorys v detailu |
| **`fryer1` absolutní mm** | `al-fr10-400-e` má typ `fryer1`, layout zatím proporční |
| Virtualizace mřížky @ 300 položek | zatím plný DOM (10 položek OK) |
| MONO ostrov / zbývající MONO | mimo prioritu katalogu, dokud Jaroslav nepřepne |

**UX závazné:** katalog = správa palety; na blok jen z palety; žádné šedění skrytých.

---

## Rychlý checklist pro agenta

1. Nová položka: `polozky/<id>.json` + řádek v `manifest.json` + `img/pristroje/<id>-card.*` (+ volitelně `-top.*`).
2. Neměnit továrnu přes `upsert` — editovat JSON soubory.
3. Sync čtení definic: `getById` až **po** `loadManifest` (nebo ze snapshotu po `importCatalog`).
4. UI palety: `getVisible()`; e-shop: `setupCatalogBrowser` — nepřidávat na blok z overlay.
5. Před ověřením v prohlížeči: proplach keše dle `PREDANI.md` A2.
