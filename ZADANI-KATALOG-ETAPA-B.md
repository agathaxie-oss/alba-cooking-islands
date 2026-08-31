# Etapa B — loader `catalog.js` + minimální boot v `main.js`

**Model:** Grok 4.5 (`cursor-grok-4.5-high`)
**Soubory, kam SMÍŠ sahat:** `js/catalog.js`, `js/main.js` (jen body
uvedené níže).
**NESAHAT:** `js/ui.js`, `js/device-manager.js`, `js/modules.js`,
`js/mono-*.js`, `index.html`, `css/`, `katalog/**` (data už jsou z etapy A).

Závazné: `ZADANI-KATALOG.md` §3, §9–§10, §12, §14.1, §15 etapa B.

---

## Cíl

1. Tovární katalog se bere z `katalog/manifest.json` + lazy
   `katalog/polozky/<id>.json`.
2. Do `localStorage` se **nezapisuje** továrna (`alba-katalog-v1` ignorovat /
   nepoužívat jako zdroj pravdy; při startu můžeš klíč smazat).
3. SEGMENT i MONO **naběhnou** bez chyby v konzoli.
4. Generické builtin id (`gas_stove`, …) **nejsou** v továrně; výchozí
   sestava SEGMENT používá nové id z etapy A.
5. Staré id značkových kusů (`lotus_pcd_68g`, …) fungují přes **alias**
   → nová id (kvůli otevření starších projektů).

---

## Nové / povinné API (`js/catalog.js`)

Implementuj přesně:

```js
export function getFactoryVersion() // number z manifestu
export async function loadManifest() // fetch katalog/manifest.json (+ kategorie volitelně)
export function getManifestItems() // po load; [] před load
export async function getItem(id) // lazy polozky/<id>.json + cache; respektuj alias
export function getItemSync(id) // jen z cache / snapshot vrstvy
export function resolveName(item, lang) // z item.name[lang] | item.name.en | ''
export function getHiddenIds()
export function setItemHidden(id, hidden) // localStorage klíč alba-katalog-skryte-v1
export async function buildSnapshot(usedIds)
export function lookupForRender(id, snapshot) // snapshot nejdřív, pak cache/factory
```

Navíc **kompatibilní most** (dokud žije device-manager / starý kód):

| Export | Chování |
|---|---|
| `getById(id)` | sync: cache + snapshot vrstva + alias; po `loadManifest`+přednačtení OK |
| `getCatalog()` | sync seznam **normalizovaných** továrních položek (po load) |
| `getVisible()` | jako getCatalog, bez skrytých id |
| `getEntryDisplayName(entry)` | `resolveName(entry, getLang())` pokud `name` je objekt; jinak string |
| `getEntryDescription` / `getEntryConstruction` | z `description`/`construction` objektu podle jazyka, fallback na `descriptionText` |
| `importCatalog(rawArray)` | **NESLUČUJ do továrny.** Ulož do paměťové vrstvy `projectSnapshot` (Map), aby `getById` našel položky z načteného projektu. Nic do localStorage katalogu. |
| `upsert` / `remove` / `duplicate` / `resetBuiltin` / `setVisible` | dočasné stuby: `setVisible` → `setItemHidden`; ostatní `console.warn` + no-op / vrátit null/false — ať device-manager nespadne. **Nepersistuj továrnu.** |
| `CATALOG_STORAGE_KEY` | může zůstat exportovaný, ale nepoužívat k zápisu továrny |

### Normalizace položky do tvaru, který čeká zbytek app

Po načtení JSON z `polozky/` vytvoř interní objekt, který má mimo jiné:

- všechna pole z JSON (včetně `name` jako objekt 5 jazyků),
- `builtin: true`,
- `visible: !hidden`,
- `catalogCode` = `publicCode` (report/floorplan můžou číst staré jméno pole),
- `descriptionText` / `constructionText` = aktuální jazyk (nebo nech prázdné a řeš jen přes getEntry*),
- `topFeature`, `controls`, `widthMM`, `minWidthMM`, `depthMM`, `minDepthMM`,
  `widthAdjustable`, `topFixed`, `allowedBodyStyles`, `powerKW`, `voltage`, `gasKW`.

### Aliasy (pevná mapa)

```
lotus_pcd_68g  → al-pg22-800-g
lotus_f10d_64et → al-fr10-400-e
berner_bi1eg5  → al-ind5-500-e
lotus_ftld_66et → (zatím žádný soubor — getById vrátí null; nepadat)
alba_ebm_11 → null stejně
```

Při `getById('lotus_pcd_68g')` vrať položku s **novým** `id` (`al-pg22-800-g`),
nebo položku s oběma — důležité je, že `widthMM`/`topFeature` sedí. Preferuj
vracet objekt s `id` = kanonické nové id.

### Fetch

- Cesty relativní k rootu app: `katalog/manifest.json`,
  `katalog/polozky/${id}.json`.
- `loadManifest` musí failnout čitelně (throw / console.error), ne tichým
  prázdným katalogem bez logu.
- Po `loadManifest` **přednačti** všechny `items[].id` přes `getItem` (jsou
  jen 3) — ať sync `getById`/`getCatalog` hned po bootu fungují bez await
  na každém místě. U stovek později lazy; teď 3 položky = preload OK.

### Skrývání

Klíč: `alba-katalog-skryte-v1` = JSON pole string[] id.
`setItemHidden` / `getHiddenIds` / `getVisible` respektují.

---

## Změny v `js/main.js` (MINIMÁLNÍ)

1. Import: přidej `loadManifest` (a případně `buildSnapshot` ještě nepoužívej
   v této etapě — snapshot je etapa C).
2. **Před** prvním `rebuildBlock` / `ui.setup` / použitím katalogu:
   `await loadManifest();` — boot musí být v async IIFE nebo top-level await
   (modul už je ES module → top-level await je OK, pokud to nerozbije pořadí).
3. `createDefaultSegmentsA()`: místo `gas_stove` použij **`al-pg22-800-g`**
   (a případně další výchozí kusy ať sedí šířkově — zachovej stávající počet
   / skladbu logiky, jen vyměň katalogová id která už neexistují).
   Přečti aktuální `createDefaultSegmentsA` a nahraď všechna generická /
   chybějící id za dostupná z továrny (máme jen 3).
4. Volání `importCatalog(config.catalog)` **nech** — teď znamená snapshot
   vrstvu, ne merge do localStorage.
5. `serializeConfig` zatím může dál posílat `catalog: getCatalog().filter(...)`
   — etapa C to přejmenuje na `catalogSnapshot`; v B ať export nepadá.

**Nic jiného v main.js neměň** (MONO, UI callbacky, …).

---

## Ověření (povinné)

1. `node --check js/catalog.js` a `node --check js/main.js`
2. Spusť / připoj se na `http://localhost:8000` (pokud běží server; jinak
   `python -m http.server 8000` — **nezabíjej** cizí proces na 8000).
3. Propláchni keš dle PREDANI A2 (doplň `katalog/manifest.json` do seznamu
   fetch reload, pokud testuješ).
4. V konzoli stránky ověř (nebo přes dočasný import):

```js
const c = await import('./js/catalog.js?v='+Date.now());
await c.loadManifest();
console.log(c.getFactoryVersion(), c.getManifestItems().length, c.getById('al-fr10-400-e')?.widthMM, c.getById('lotus_pcd_68g')?.id);
```

Očekávej: version 1, length 3, widthMM 400, alias id `al-pg22-800-g`.

5. Otevři app, zvol SEGMENT — musí se vykreslit blok, konzole bez
   `TypeError` / failed import.

---

## Hotovo když

- [ ] Továrna z JSON, žádný zápis `alba-katalog-v1` s entries
- [ ] API §14.1 + kompatibilní most
- [ ] Default SEGMENT nepoužívá `gas_stove`
- [ ] Alias lotus→al funguje
- [ ] App naběhne
- [ ] Ve zprávě: co jsi změnil v main.js (diff slovně), výsledek ověření

## Nesmíš

- Přepisovat UI na e-shop (to je D/E)
- Mazat device-manager.js
- Commit
- Sahat na `katalog/polozky` obsah (kromě čtení)
