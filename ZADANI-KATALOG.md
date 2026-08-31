# Zadání — tovární katalog přístrojů (e-shop + paleta)

**Stav:** ROZHODNUTO, připraveno k implementaci. Otevřené otázky jsou
uzavřené (session 8. 8. 2026).
**Rozsah:** přestavba katalogu na souborový tovární katalog pro desítky až
stovky položek, společný pro SEGMENT i MONO. Bez uživatelských sad.
**Pořadí závaznosti:** `PREDANI.md` → tento soubor → `SPEC.md` / kód.

---

## 0. Jak s tímto dokumentem pracovat

- **Kód nepiš sám** (hlavní agent). Napiš etapová zadání a předej
  **Grok 4.5** (`cursor-grok-4.5-high` / `inherit`); drobnosti
  **Composer 2.5 Fast**. Sonnet/Haiku/Opus nepoužívat, dokud zadavatel
  neřekne jinak. Výsledek ověř v prohlížeči (včetně proplachu keše — viz
  `PREDANI.md` A2).
- **Dva agenti nesmí psát do stejného souboru naráz.**
- Vše viditelné = **5 jazyků** (en, de, pl, cs, sk).
- Před každou etapou zkontroluj, že smlouva rozhraní (§14) sedí na aktuální
  kód (`main.js` formát projektu, pás MONO/SEGMENT, `report.js`).
- **Na „Uložit konfiguraci" neklikej naslepo** (stáhne soubor).
- `window.print()` nespouštěj.

---

## 1. Cíl

1. Tovární katalog žije **ve repozitáři jako data** (JSON + fotky), ne v
   `localStorage` a ne jako editovatelný seznam v prohlížeči.
2. Procházení vypadá jako **e-shop** (karty, foto, filtry); katalog
   spravuje obsah **palety** (které tovární výrobky jsou v paletě);
   **na blok** se přidává až z palety po zavření katalogu; v projektu
   tvoří **sestavu** na spodním pásu.
3. Katalog unese **stovky položek** (lazy load plných definic, virtualizace
   nebo stránkování seznamu karet).
4. Projekt nese **snapshot použitých** přístrojů — po změně továrny v gitu
   se starý projekt nerozbije a továrna příjemce se nepřepíše.
5. Skříňky a ostatní stavební díly **nejsou v katalogu** — speciální
   tlačítka (příprava na budoucí oddělení přístroj ↔ podestavba).

### 1.1 Vědomě se nedělá

- Uživatelské sady přístrojů a import/export sad.
- Úprava továrních položek ve Správci přístrojů (Správce jako editor mizí).
- Obecné / bezejmenné vestavěné typy („Indukce", „Fritéza" bez výrobku).
- Pole `sourceUrl` v datech.
- Oblíbené a vlastní pořadí karet (jen množina id **v paletě** — §9).
- Nástupci vyřazených přístrojů.

---

## 2. Současný stav (vady, které etapa odstraňuje)

Ověřeno dříve; netřeba znovu zjišťovat:

- `js/catalog.js` drží `BUILTIN_DEFAULTS` v kódu; po změně se celý katalog
  včetně továrních zapisuje do `localStorage` (`alba-katalog-v1`).
- Vestavěné jdou plně editovat; načtení cizího projektu katalog **slučuje**
  → přepisy a ztráty úprav.
- Projekt nese / slučuje katalog; instance se tiše clampují na meze.
- `device-manager.js` = editor. Fotky jako `imageDataURL` (base64) ničí
  kapacitu úložiště.
- Generické položky (`gas_stove`, `fryer`, …) i značkové v jedné hromadě.

---

## 3. Architektura dat

### 3.1 Strom souborů

```
katalog/
  manifest.json                 # index pro browsování (malý, načte se vždy)
  polozky/
    <id>.json                   # plná definice jedné položky
  kategorie.json                # definice typů + popisky i18n (volitelně
                                # sloučitelné do manifestu — viz §3.3)
img/pristroje/
  <id>-card.webp|.svg           # náhled karty (libovolný úhel)
  <id>-top.webp|.svg|.jpg…      # top view: reálná fotka NEBO SVG placeholder
```

`js/catalog.js` je **loader + API** (načtení manifestu, lazy
`polozky/<id>.json`, resolve jména, snapshot helper), ne úložištěm obsahu.
Implementační stav (kdo co volá, aliasy, paleta): **`DOCS-KATALOG.md`**.

**Poznámka k bootu (aktuální kód):** po `loadManifest()` se zatím přednačtou
**všechny** položky z manifestu do paměťové cache (ok při ~10 kusech; při
stovkách vrátit čistě lazy dle §3.4).

### 3.2 `manifest.json`

```json
{
  "factoryVersion": 1,
  "schema": 1,
  "items": [
    {
      "id": "al-fr10-400-e",
      "type": "fryer",
      "minCutoutDepthMM": 700,
      "publicCode": "AL-FR10-400-E",
      "name": {
        "en": "Fryer 10 l · 400",
        "de": "…",
        "pl": "…",
        "cs": "Fritéza 10 l · 400",
        "sk": "…"
      },
      "origin": "IT",
      "cardImage": "img/pristroje/al-fr10-400-e-card.webp",
      "tags": ["electric", "10l"]
    }
  ]
}
```

Manifest musí stačit na vykreslení mřížky karet a filtrů **bez** stahování
všech `polozky/*.json`.

### 3.3 Plná položka `polozky/<id>.json`

```json
{
  "id": "al-fr10-400-e",
  "publicCode": "AL-FR10-400-E",
  "supplier": "lotus",
  "supplierCode": "F10D-64ET",
  "origin": "IT",
  "type": "fryer",
  "minCutoutDepthMM": 700,
  "name": { "en": "…", "de": "…", "pl": "…", "cs": "…", "sk": "…" },
  "description": { "en": "…", "de": "…", "pl": "…", "cs": "…", "sk": "…" },
  "construction": { "en": "…", "de": "…", "pl": "…", "cs": "…", "sk": "…" },
  "widthMM": 400,
  "minWidthMM": 400,
  "widthAdjustable": false,
  "depthMM": 700,
  "minDepthMM": 700,
  "topFeature": { "type": "fryer1" },
  "topFixed": true,
  "controls": { "type": "knob", "count": 1 },
  "allowedBodyStyles": ["doors"],
  "powerKW": 7.15,
  "voltage": "400 V~3N / 230 V~3, 50/60 Hz",
  "gasKW": null,
  "zones": null,
  "cardImage": "img/pristroje/al-fr10-400-e-card.webp",
  "topImage": "img/pristroje/al-fr10-400-e-top.webp",
  "geometryNotes": "Schváleno screenshotem …"
}
```

**Pravidla polí**

| Pole | Viditelnost | Poznámka |
|---|---|---|
| `id` | interní | stabilní, kebab-case, shodný s názvem souboru |
| `publicCode` | UI, soupis, tisk | unikátní; prefix `AL-`; doladění individuálně |
| `supplier`, `supplierCode` | **ne v UI** | nákup / identifikace dodavatele |
| `origin` | vlaječka na kartě | kód země (`CZ`, `DE`, `IT`…); význam = „výrobce/dodavatel“ dle dohody ALBA |
| `type` | filtr | viz §4 |
| `minCutoutDepthMM` | filtr + varování | vestavná hloubka přístroje v desce |
| `name` / `description` / `construction` | 5 jazyků v JSON | ne klíče v `i18n.js` |
| `topFeature` | 3D | procedurální typ ze schválené sady; volitelně absolutní mm (`vat*`, `basket*`, `cookArea*`, `glass*`, `zoneDiameter*`) — viz `DOCS-KATALOG.md` |
| `zones` | detail katalogu (+ krátký souhrn na kartě) | volitelné pole pro sporáky/plotýnky — viz níže |
| fotky | cesty k souborům | **nikdy** base64 v JSON |

**Pole `zones` (hořáky / varné zóny)**

Jednotný název pro gas i electric. Pořadí = layout na desce / číslování zón dodavatele
(RM zóna 1…N): `burners2` → 2 položky; `burners4` → 4 v pořadí 2×2; `ceramic4` → 4 zóny;
`induction` → 1 zóna.

```json
"zones": [
  { "powerKW": 7.5, "fuel": "gas", "position": "front-left" },
  { "powerKW": 5.5, "fuel": "gas", "position": "back-left" },
  { "powerKW": 5.5, "fuel": "gas", "position": "front-right" },
  { "powerKW": 3.5, "fuel": "gas", "position": "back-right" }
]
```

| Klíč | Typ | Poznámka |
|---|---|---|
| `powerKW` | number \| null | výkon zóny v kW; chybí-li v RM → `null` + poznámka v `geometryNotes` |
| `fuel` | `"gas"` \| `"electric"` | médium zóny |
| `position` | string | místo na desce (pohled shora, front = čelo/panel = menší Z): `front-left` \| `front-right` \| `back-left` \| `back-right` \| `front` \| `back`. U `burners2`/`burners4` mapováno na pořadí středů v `resolveCastIronBurnerLayout`; u `ceramic4` na `buildElectricStoveTop`. RM půdorys neuvádí → poznámka v `geometryNotes`. |

UI: detail sekce `catalog.detailZones` se seznamem `catalog.zonePowerAt` („Vzadu vlevo: 7,5 kW“)
+ mini schématkem 2×2; na kartě zkratky „VL 7,5 · VP 5,5 · …“ pokud se vejdou.

Oddělení katalog vs instance (beze změny smyslu):

- **Katalog:** meze, výchozí, technické údaje, `topFeature`, povolené styly.
- **Instance v projektu:** zvolená šířka/hloubka v mezích, sokl, finish,
  police, pozice — **nikdy nevrací změny do katalogu**.

### 3.4 Načítání při stovkách položek

1. Start: fetch `katalog/manifest.json` (jeden request).
2. Karta / filtr / hledání: jen manifest.
3. Přidání na blok z palety / otevření detailu / stavba 3D: fetch
   `katalog/polozky/<id>.json` (cache v paměti Map).
4. Snapshot v projektu už nese plnou definici → při otevření projektu
   **není nutný** fetch tovární položky pro vykreslení použitých kusů.
5. Seznam karet: stránkování **nebo** virtualizace (threshold ~50 viditelných
   najednou). Nevykreslovat 300 DOM karet najednou.

Bez build kroku — žádné slučování do jednoho bundle při vývoji. Až by
stovky malých fetchů bolely na produkci, dodělá se volitelný skript
(mimo rozsah první vlny).

---

## 4. Taxonomie a filtry

**Dvě osy (obě povinné v UI):**

1. **`minCutoutDepthMM`** — řady jako u drop-in sortimentu: 600, 700, 800,
   850, 900… (hodnota je na položce; filtr nabízí jen hloubky, které v
   manifestu existují).
2. **`type`** — typ přístroje (inspirace RM drop-in, **bez** značky
   výrobce v názvu kategorie).

Výchozí sada `type` (rozšiřitelná v `kategorie.json`):

| `type` | cs (výchozí popisek) |
|---|---|
| `gas_range` | Sporák plynový |
| `electric_range` | Sporák elektrický |
| `ceramic` | Sklokeramika |
| `induction` | Indukce |
| `griddle` | Grilovací deska |
| `fryer` | Fritéza |
| `bain_marie` | Vodní lázeň |
| `pasta` | Těstovinová mísa / vařič |
| `multipan` | Multifunkční pánev |
| `other` | Ostatní |

Plus fulltext přes `name[lang]`, `publicCode`, `tags`.

**Hloubka bloku vs katalog**

- Katalog **filtruje** (a badge na kartě), pokud `minCutoutDepthMM` >
  aktuální hloubka relevantní strany / desky.
- Přidání **není zakázané** — zobrazí se varování.
- Stejné varování zůstane u už přidaného kusu v **pásu dole** (SEGMENT i
  MONO), když uživatel dodatečně zmenší hloubku bloku.

---

## 5. Názvy, kódy, vlaječka

### 5.1 Zobrazovaný název

Šablona: `{typ} {klíčový parametr}` + případně rozlišovač.

Příklady: `Fritéza 10 l · 400`, `Indukce 1 zóna 5 kW`, `Gril hladký 600`.

Značka výrobce **v názvu není**. Když by dva výrobky měly stejný typ +
parametr, doplní se jeden atribut (povrch, energie, počet zón, šířka) a
**veřejný kód musí být unikátní vždy**.

### 5.2 Kódy

- **`publicCode`:** prefix `AL-`, dále typ/parametr; konkrétní tvar se
  doladí u prvních položek individuálně. Do soupisu, tisku, exportu.
- **`supplier` + `supplierCode`:** skutečný dodavatel a jeho model — jen
  v JSON, ne v UI.
- Mapování „náš kód → nákupní kód“ musí jít z dat (interní pole), ne z
  dohadování podle názvu.

### 5.3 Vlaječka

Jedno pole `origin` (ISO země). Popisek v UI ve smyslu
**„výrobce/dodavatel“** — ALBA si u každé položky určí, co do pole patří.
Na kartě malá vlaječka / kód země.

---

## 6. Fotky a `topFeature` (workflow vzniku položky)

1. Zadavatel pošle odkaz na produkt (nebo podklady).
2. Agent stáhne / připraví **dvě** fotky: `*-card` (prohlížecí) a `*-top`
   (referenční, i když není přesný půdorys).
3. Agent **nenalepí** perspektivní foto na desku. Z fotky a parametrů
   navrhne **procedurální** `topFeature.type` ze stávající sady
   (`burners4`, `fryer1`, `grill`, `induction`, …) případně rozšířené o
   nový typ, pokud chybí.
4. Agent připraví **screenshot 3D** náhledu a nechá schválit.
5. Po schválení commit: `polozky/<id>.json` + fotky + řádek v manifestu +
   případně nový `topFeature` v geometrii.

Bez schváleného screenshotu se položka do `main` nedává jako hotová.

---

## 7. UI — e-shop katalog a paleta

### 7.1 Terminologie

| Pojem | Význam |
|---|---|
| **Katalog** | Správa obsahu palety — prohlížení továrních výrobků (e-shop mřížka / overlay); **ne** přidávání na blok |
| **Paleta** | Levý panel: jen položky **v paletě**; po zavření katalogu klik = přidat na blok |
| **Přidat do palety** | CTA karty v katalogu (`catalog.addToPalette`) — zařadí id do osobní palety |
| **Odebrat z palety** | CTA / stav karty (`catalog.removeFromPalette`); stavový label `catalog.inPalette` |
| **Sestava** | Přístroje už v projektu — spodní pás (`assembly-strip`) / seznam bloku; **ne** CTA katalogu |

**Závazný UX model (Jaroslav):**
1. Katalog upravuje **pouze paletu**. Z katalogu se **nedá** přidat výrobek
   rovnou na blok. Žádné „Přidat na blok“ / „Do sestavy“ v katalogu.
2. Na blok se přidává **až po zavření katalogu**, klikem na položku
   **v paletě**.
3. Výrobky se **vůbec nešedí** (žádné opacity / grey-out karet mimo
   paletu) — liší se jen textové CTA / stav.
4. Speciální tlačítka (skříňka, zásuvky, dřez, vlastní) zůstávají mimo
   katalog, v paletě / pod ní (§8).

„Správce přístrojů“ jako editor **zrušit**. Tlačítko v topbaru nahradit
otevřením **katalogu** (správa palety).

### 7.2 Katalog (e-shop)

- Karty: foto `cardImage`, název, `publicCode`, vlaječka `origin`, šířka,
  badge hloubky při nesouladu.
- Filtry: hloubka řady, typ, fulltext.
- Akce na kartě (textové tlačítko se stavem, bez očička):
  - mimo paletu → **Přidat do palety** (`catalog.addToPalette`);
  - v paletě → stav **V paletě** (`catalog.inPalette`) + **Odebrat z
    palety** (`catalog.removeFromPalette`).
- Karty mimo paletu zůstávají **plně viditelné** (normální barvy).
- Katalog **nikdy** nepřidává instance na blok / do sestavy.
- Klik na kartu / „Detail“ otevře **detail položky** uvnitř téhož overlay
  (`#catalog-overlay`): lazy `getItem`, foto, lokalizovaný název a texty,
  technické parametry, CTA Přidat/Odebrat z palety; Zpět / Escape na mřížku.

### 7.3 Paleta

- Kompaktní seznam / dlaždice pro modelování (stávající levý panel,
  přepracovaný na data z manifestu).
- Stejné filtry v menším provedení + fulltext.
- Zobrazuje **jen** položky, jejichž `id` je v osobní množině **v paletě**
  (§9).
- Po zavření katalogu: klik na položku v paletě = **přidat na blok**
  (SEGMENT/MONO podle aktivního kontextu — strana / vrstva herdbloku).
- Speciální tlačítka **mimo** katalogový seznam (viz §8).

### 7.4 Mazání

Přístroj lze odebrat ze sestavy v pásu. Odebrání z palety (katalog CTA)
**neodstraňuje** položku z továrního katalogu ani ze sestavy projektu.
Mazání ze sestavy **neodstraňuje** položku z továrního katalogu.

---

## 8. Speciální tlačítka (mimo katalog)

Nejsou tovární výrobky; zůstávají UI akcemi:

- neutrální skříňka / otevřená / dvířka
- zásuvkový modul
- dřez
- vlastní modul (bitmapa)

**Důvod oddělení:** katalog je společný pro SEGMENT i MONO; do budoucna
má SEGMENT umět **více přístrojů nad jednou podestavbou**. Přístroj a
skříňka se proto modelují odděleně. Teď se dočasně **spojí jen přes
parametry a meze skříňky** (šířka instance, `allowedBodyStyles`,
`minWidthMM`…), ne sloučením do jedné katalogové entity.

Generické spotřebiče z `BUILTIN_DEFAULTS` **nepokračují** — jen konkrétní
výrobky v `katalog/`.

---

## 9. Osobní předvolby (localStorage)

Jediná individualizace v první vlně:

- **`alba-katalog-paleta-v1`:** seznam `id` továrních položek **v paletě**
  (osobní předvolba = množina id v paletě, ne „skryté" jako grey-out).

Nesmí obsahovat kopie definic. Tovární JSON se do localStorage **nezapisuje**.

Zrušit zápis celého katalogu pod `alba-katalog-v1` (migrační poznámka §12).

**Migrace záměru z etapy B:** kód `catalog.js` zatím ještě může používat
`alba-katalog-skryte-v1` (seznam skrytých id). Cílový model je pozitivní
seznam v paletě. Při přechodu: pokud existuje `alba-katalog-skryte-v1`,
invertovat vůči aktuálnímu manifestu → `alba-katalog-paleta-v1`, starý
klíč smazat. (Samotný kód `catalog.js` se v této UX úloze **nemění** —
přepojení API později.)

---

## 10. Projekt a snapshot

Formát projektu (verze dle aktuálního `main.js`, dnes cesta k v5 — při
změně zvednout a zapsat do `PREDANI.md` / SPEC):

- `factoryVersion` — verze továrny při uložení.
- `catalogSnapshot`: **jen použité** `id`, každá s **úplnou** kopií
  definice (všechny meze, texty, cesty k obrázkům, `topFeature`…).
- Snapshot je **výhradně ke čtení** — nikdy se nemerge do továrních
  souborů ani do localStorage jako katalog.
- Instance segmentů/herdbloku odkazují `type` / `id` přístroje; při
  vykreslení: nejdřív snapshot, jinak fetch továrny.

Při načtení projektu s jinou `factoryVersion` než aktuální manifest:

- výchozí: zobrazit podle snapshotu („stav při uložení“);
- nabídka aktualizace na aktuální továrnu + **souhrn rozdílů**
  (přidané / změněné / chybějící v továrně).
- Žádné tiché přepsání instančních rozměrů; při nesouladu s novými mezemi
  **označit** a nechat rozhodnutí uživateli.

Vyřazený výrobek (už není v manifestu): projekt se ze snapshotu vykreslí
správně; v UI označit jako nedostupný v aktuální továrně.

---

## 11. SEGMENT i MONO

Jeden tovární katalog, jedna paleta/katalog UI, větvení jen při **kam se
přidává z palety** (strana A/B u SEGMENT, vrstva herdbloku u MONO).

Report / soupis / půdorys čtou `publicCode`, přeložený `name`, technické
údaje ze snapshotu nebo katalogu. Interní `supplierCode` do zákaznického
dokumentu **nedávat**.

---

## 12. Migrace

1. Přestat číst/zapisovat `alba-katalog-v1` jako zdroj pravdy. Při startu
   lze klíč smazat nebo ignorovat (jednorázově).
2. Stávající `BUILTIN_DEFAULTS` převést do `katalog/polozky/` **jen u
   konkrétních značkových** položek (Lotus, Berner, ALBA EBM…). Generické
   (`gas_stove`, `fryer`, …) **neMigrovat** do továrny — nahradí je
   speciální tlačítka / budoucí konkrétní výrobky.
3. Staré projekty s polem `catalog`: při načtení sestavit
   `catalogSnapshot` z použitých id; neslučovat do localStorage.
4. Texty z `i18n.js` klíčů `device.*` u migrovaných položek přesunout do
   JSON `name`/`description`/`construction`; klíče v i18n pak smazat, aby
   nevznikly dvě pravdy.
5. `device-manager.js` — odstranit nebo zúžit; preferovaný stav: logika
   ve `js/catalog-browser.js` (nový) + paleta v `ui.js` / `mono-ui.js`
   (katalog = správa palety, ne editor viditelnosti/šedění).

Zpětná kompatibilita souborů se dle `PREDANI.md` neřeší tvrdě (aplikace
nenasazená), ale načtení starého JSON bez pádu je součást přijetí.

---

## 13. Kritéria přijetí

1. Tovární položky nelze v UI editovat ani smazat z disku aplikace; lze jen
   spravovat osobní paletu (přidat/odebrat id) a z palety přidávat na blok.
2. V localStorage nejsou definice továrny — jen seznam id **v paletě**
   (`alba-katalog-paleta-v1`; a stávající klíče projektu/jazyka).
3. 300 položek v manifestu: UI zůstane použitelné (filtry + ne všechny karty
   v DOM najednou); plné JSON se tahají lazy.
4. Načtení cizího projektu nezmění tovární soubory ani paletu příjemce
   nad rámec vlastní volby uživatele.
5. Dva kusy téhož `id` v projektu mohou mít různé instanční rozměry v mezích.
6. Změna instance nezmění katalogovou položku.
7. Nesoulad hloubky: badge na kartě + varování v pásu u přidaného kusu.
8. Snapshot pokryje vykreslení bez přítomnosti položky v aktuálním
   manifestu.
9. Přepnutí jazyka bere názvy z JSON položky; `publicCode` beze změny.
10. Speciální tlačítka skříněk/dřezu fungují a nejsou v e-shop mřížce.
11. SEGMENT i MONO čtou stejný katalog; konzole bez chyb; export PNG/JSON
    a tiskový soupis ukazují `publicCode` + lokalizovaný název.
12. Žádné tiché clampování bez UI označení.

---

## 14. Smlouva rozhraní (pro paralelní agenty)

### 14.1 `js/catalog.js` (API)

Povinné exporty (jména dodržet). Podrobný seznam callerů: **`DOCS-KATALOG.md` §B**.

**Načtení / čtení**

- `getFactoryVersion(): number`
- `loadManifest(): Promise<Manifest>` — maže legacy `alba-katalog-v1`; init palety
- `getManifestItems(): ManifestItem[]` (po load)
- `getCategories(): object | null` (po load, volitelné)
- `getItem(id): Promise<CatalogItem | null>` (lazy + cache; respektuje aliasy)
- `getItemSync(id): CatalogItem | null` (jen cache / `projectSnapshot`)
- `getById(id)` — alias `getItemSync` (kompatibilní most)
- `getCatalog(): CatalogItem[]` — všechny načtené tovární položky (+ `visible`)
- `resolveName(item, lang): string`
- `getEntryDisplayName` / `getEntryDescription` / `getEntryConstruction`

**Paleta** (`alba-katalog-paleta-v1`; default = všechna id z manifestu)

- `getPaletteIds(): string[]`
- `isInPalette(id): boolean`
- `addToPalette(id)` / `removeFromPalette(id)`
- `getVisible(): CatalogItem[]` — **položky v paletě** (levý panel), ne „ne-skryté“

**Deprecated (mapa na paletu; nepoužívat v novém kódu)**

- `getHiddenIds(): string[]` — id z manifestu mimo paletu
- `setItemHidden(id, hidden)` / `setVisible(id, visible)`

**Projekt**

- `buildSnapshot(usedIds: string[]): Promise<CatalogItem[]>`
- `lookupForRender(id, snapshot): CatalogItem | null`
- `importCatalog(rawArray)` — **jen** paměťová vrstva snapshotu; **neslučuje** do továrny

**Stubs (továrna read-only do etapy G)** — `upsert` / `remove` / `duplicate` /
`resetBuiltin` → no-op + `console.warn`.

Nepersistovat továrnu. Sync vs async: viz `DOCS-KATALOG.md`.

### 14.2 Projekt

- `state` / export JSON: `factoryVersion`, `catalogSnapshot`.
- Při `loadConfig` volat `importCatalog(catalogSnapshot)` (legacy pole `catalog`
  jako fallback) — **nikdy** sloučení do localStorage továrny.

### 14.3 UI — katalog browser + callbacky

- `setupCatalogBrowser({ getBlockDepthMM?, onPaletteChange? })` →
  `{ open, close, isOpen, refresh }` (`js/catalog-browser.js`).
  Overlay **jen** správa palety; **nepřidává** na blok.
- `onOpenCatalog()` — topbar / odkaz v paletě
- Přidání na blok: z palety (`ui.js` + `getVisible`), po zavření katalogu
- speciální: `onAddNeutral`, `onAddDrawers`, `onAddSink`, `onAddCustom`

### 14.4 i18n

Nové klíče jen pro UI (`catalog.*`, `catalog.zone*`, `topFeature.*` labely,
filtry, hlášky, varování hloubky, dialog aktualizace továrny). **Ne** názvy
výrobků (ty žijí v JSON položek).

### 14.5 CSS

Prefix tříd katalogu: `.cat-` (např. `.cat-grid`, `.cat-card`,
`.cat-badge-depth`, `.cat-flag`, `.cat-scroll`). Scroll lock:
`html.cat-overlay-open` / `body.cat-overlay-open`. Nesahat na nesouvisející
MONO třídy bez nutnosti.

---

## 15. Etapy implementace

Dělit podle souborů; po každé etapě ověření v prohlížeči.

| # | Etapa | Hlavní soubory | Hotovo když |
|---|---|---|---|
| A | Schéma + 2–3 vzorové položky (z dnešních Lotus/Berner/ALBA) + manifest + fotky-placeholdery | `katalog/**`, `img/pristroje/**` | manifest se načte v konzoli |
| B | Loader API v `catalog.js`, zrušit persist továrny | `js/catalog.js` | SEGMENT i MONO naběhne; generické builtin pryč nebo mapované |
| C | Snapshot v ukládání/načítání projektu | `js/main.js` | cizí projekt nepřepíše localStorage katalog |
| D | E-shop overlay katalogu = správa palety (bez šedění) | nový `js/catalog-browser.js`, `index.html`, `css/style.css`, `i18n.js` | karty, filtry; CTA `catalog.addToPalette` / `removeFromPalette` / `inPalette` |
| E | Paleta napojená na manifest; klik = na blok; speciální tlačítka oddělená | `js/ui.js`, případně `mono-ui.js` | paleta jen id v `alba-katalog-paleta-v1`; přidání na blok z palety |
| F | Badge + varování hloubky v pásu | `ui.js` / `mono-ui.js` | změna hloubky bloku ukáže varování u kusu |
| G | Odstranit editor `device-manager` / topbar akce | `device-manager.js`, `index.html`, `main.js` | žádná editace továrny v UI |
| H | Report/soupiska na `publicCode` + JSON jména | `report.js`, `floorplan.js` | tisk bez supplierCode |
| I | Dialog factoryVersion diff (může být hned po C) | `main.js`, i18n | souhrn rozdílů |

**Obsah katalogu (desítky položek z webů)** není automaticky součástí
implementačních etap A–I — probíhá jako samostatný výrobní proces §6
(odkaz → návrh → screenshot → schválení → commit) a může běžet paralelně
po etapě A.

---

## 16. Dotčené soubory (orientačně)

- nově: `katalog/manifest.json`, `katalog/polozky/*.json`,
  `katalog/kategorie.json`, `img/pristroje/*`, `js/catalog-browser.js`
- přepsat: `js/catalog.js`
- upravit: `js/main.js`, `js/ui.js`, `js/mono-ui.js`, `js/i18n.js`,
  `js/report.js`, `js/floorplan.js`, `index.html`, `css/style.css`
- zrušit / vyprázdnit: `js/device-manager.js` (editor)
- dokumentace po dokončení: `SPEC.md` (nová verze katalogu), krátká
  zmínka v `PREDANI.md` B3, seznam souborů v kešovém proplachu A2

---

## 17. Rozhodnutí — archiv Q&A (8. 8. 2026)

1. Údržba továrny jen zadavatel + git (agent z podkladů).
2. Filtry: hloubka vestavby **i** typ.
3. Neutrály / skříňky / dřez / vlastní = speciální tlačítka, ne katalog.
4. Jen konkrétní výrobky.
5. i18n textů výrobků v JSON (5 jazyků).
6. Bez `sourceUrl`.
7. Dvě fotky; `topFeature` procedurálně; schválení screenshotem.
8. `supplier` + `supplierCode` skryté; `publicCode` s `AL-`; vlaječka
   `origin` = výrobce/dodavatel.
9. UI: e-shop + **paleta** (ne editor Správce). Katalog = správa palety;
   na blok jen z palety po zavření; bez šedění karet.
10. Osobní: množina id **v paletě** (`alba-katalog-paleta-v1`).
11. Snapshot použitých — ano.
12. Hloubka: filtr + varování (karta i pás).
13. Společný katalog SEGMENT + MONO.
14. Budoucnost: více přístrojů na jedné podestavbě → už teď oddělit
    přístroj od skříňky.
