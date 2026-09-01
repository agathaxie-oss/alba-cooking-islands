# ZADÁNÍ — Podestavby MONO: police a dvířka, zásuvkový blok, skříňka se zásuvy na GN

Závazná smlouva rozhraní pro úkoly 14, 15, 16 z `PREDANI.md`. Při rozporu
platí pořadí: `HODNOTY-MONO.md` → `PREDANI.md` → tento soubor → kód.

Pracují dva agenti souběžně, **rozdělení po souborech** (nikdy nesmí psát do
téhož souboru):

- **Agent G (geometrie):** `js/mono-geometry.js`, `js/mono-block.js`
- **Agent U (stav + UI):** `js/main.js`, `js/ui.js`, `js/mono-ui.js`, `js/i18n.js`

**Nikdo nesahá na:** `js/modules.js`, `js/block.js`, `js/report.js`,
`js/floorplan.js`, `css/style.css`, `index.html` ani na cokoli dalšího.
SEGMENT se nesmí změnit ani o pixel. Žádné nové soubory v `js/` (ruční
seznam proplachu keše v PREDANI.md se nesmí rozšiřovat).

---

## §1 Datový model — MonoCabinet (vlastní main.js, čtou všichni)

`state.mono.podestavbyA/B` obsahuje položky těchto tvarů (pole `id` přiděluje
`sanitizeMonoCabinet`, jako dosud):

```
{ id, kind:'gap',     widthMM }                                        // beze změny
{ id, kind:'cabinet', widthMM, bodyStyle, hasShelf, finish }           // NOVĚ hasShelf
{ id, kind:'drawers', widthMM, finish }                                // NOVÝ druh (úkol 15)
{ id, kind:'gnRack',  widthMM, bodyStyle, finish }                     // NOVÝ druh (úkol 16)
```

- `bodyStyle` u `cabinet`: `'closed' | 'doors' | 'open'` (beze změny, výchozí
  `'closed'`). U `gnRack`: **jen** `'open' | 'doors'`, výchozí `'open'`
  (rozhodnutí zadavatele 9. 8. 2026: „otevřená nebo s dvířky").
- `hasShelf`: boolean, výchozí `false`. Jen u `kind:'cabinet'`. Police má
  význam jen při `bodyStyle:'open'` — hodnota se ale drží i při přepnutí
  stylu (uživatel o zaškrtnutí nepřijde), geometrie ji použije jen u `open`.
- `widthMM` u `drawers` a `gnRack` je **PEVNÁ**: povolené hodnoty **400**
  (GN 1/1) a **600** (GN 2/1). Sanitizace: `raw.widthMM === 600 ? 600 : 400`.
  Uživatel šířku needituje (viz §4).
- `finish` u všech druhů kromě `gap` — stejná sanitizace jako dosud
  (`sanitizeFinish`).
- Starší soubor bez nových polí se musí načíst bez chyby (výchozí hodnoty).
  Neznámý `kind` spadne na `cabinet` (dnešní chování větve „else").

### Mapování palety → položka (vlastní main.js, `onMonoAdd('podestavby', kind)`)

Paletové druhy (2. parametr `onMonoAdd`) se PŘEKLÁDAJÍ na uložený tvar:

| paletový `kind` | uložená položka |
|---|---|
| `cabinet`   | `{ kind:'cabinet' }` (jako dnes) |
| `gap`       | `{ kind:'gap' }` (jako dnes) |
| `drawers11` | `{ kind:'drawers', widthMM:400 }` |
| `drawers21` | `{ kind:'drawers', widthMM:600 }` |
| `gnRack11`  | `{ kind:'gnRack',  widthMM:400 }` |
| `gnRack21`  | `{ kind:'gnRack',  widthMM:600 }` |

V souboru projektu jsou VŽDY jen uložené druhy (`cabinet|gap|drawers|gnRack`),
paletové `*11`/`*21` se NIKDY neukládají.

## §2 Rozhraní adaptér → geometrie (Agent G)

`js/mono-block.js` v `.map()` podestaveb (strana A ř. ~255, strana B ř. ~268)
předává geometrii NOVĚ i druh a styl — výsledný tvar položky:

```
{ xMM, widthMM, finish, kind, bodyStyle, hasShelf }
```

`buildPodestavba()` v `js/mono-geometry.js` přibírá parametry
`kind = 'cabinet'`, `bodyStyle = 'closed'`, `hasShelf = false`. Chybějící/
neznámá hodnota `kind` → chová se jako `cabinet`; neznámý `bodyStyle` →
`closed` (u `gnRack` → `open`).

**POZOR na výchozí `bodyStyle = 'closed'`:** dnešní vzhled skříňky je fakticky
„otevřený korpus". Po tomto úkolu dostane výchozí skříňka (`closed`) čelní
stěnu — to je ZÁMĚR (úkol 14 zprovozňuje `bodyStyle`, který dosud neměl ve
3D žádný účinek), ne regrese.

## §3 Geometrie (Agent G) — co se staví, jména těles, čísla

Souřadnice lokální v podestavbě: přední líc korpusu `zFront = 30`
(`DESK_OVERHANG_FRONT_MM`), tělo od `yBodyBottom = plinthHeightMM` do
`yBodyTop = plinthHeightMM + bodyHeightMM` (460). Dnešní dílce (boční stěny,
zadní stěna, podlážka, lišta-horni, nožičky dle soklu, H2 náběhy dle finish)
zůstávají u VŠECH druhů beze změny. H2 náběhy zůstávají řízené JEN přes
`finish`, bez ohledu na `bodyStyle`/`kind`.

**Tvrdá pravidla pro všechno nové:** žádné těleso nesmí mít zápornou
souřadnici z; nic nesmí předsadit před rovinu z = 0 (líc desky); žádné dva
dílce nesmí sdílet stěnu ve stejné rovině (z-fighting).

### 3a. `cabinet` + `bodyStyle:'closed'` — čelní stěna

- Jedno těleso `name:'celni-stena'`: šířka `widthMM − 2*WALL_MM`, výška
  `bodyHeightMM − TOP_RAIL_MM` (od `yBodyBottom` po spodní hranu horní
  lišty — lišta zůstává viditelná, žádný překryv s ní), tloušťka `WALL_MM`,
  z od 30 do 50 (za lícem korpusu, mezi bočními stěnami).

### 3b. `cabinet` + `bodyStyle:'doors'` — dvířka

- Stejný vzhledový jazyk jako SEGMENT (`buildDoorBody` v modules.js je
  PŘEDLOHA, ale nic se odtud neimportuje — mono-geometry.js zůstává bez
  importu z modules.js, viz hlavička souboru).
- Počet křídel: `widthMM > 600` → 2, jinak 1 (stejné pravidlo jako SEGMENT).
- Křídlo `name:'dvirka'`: na šířku křídla minus 20 mm spára, výška
  `bodyHeightMM − 20`, tloušťka 8 mm, **předsazená před líc korpusu**:
  z od 16 do 24.
- Úchytka `name:'dvirka-uchytka'`: svislý válec r 5 mm, délka ~130 mm,
  osa v z = 10 (tedy z od 5 do 15 — nikdy pod 0). Poloha u svislé hrany
  křídla: u dvoukřídlých ke středové spáře, u jednokřídlé vpravo
  (0,32–0,36 šířky křídla od středu, jako SEGMENT).
- Za dvířky se čelní stěna NESTAVÍ (dvířka kryjí otvor sama; korpus za nimi
  je dnešní otevřený rám — u zavřených dvířek dovnitř není vidět).

### 3c. `cabinet` + `bodyStyle:'open'` — police

- Bez čelní stěny i dvířek — dnešní vzhled.
- Při `hasShelf:true` navíc `name:'police'`: tloušťka 20 mm, šířka
  `widthMM − 2*WALL_MM − 10`, hloubka `depthMM − 25 − BACK_WALL_MM − 10`,
  zapuštěná 25 mm od líce korpusu (z od 55), výškově VYSTŘEDĚNÁ v dutině
  (mezi horní hranou podlážky a spodní hranou horní lišty).
- Při `hasShelf:false` se těleso police VŮBEC NEVYTVOŘÍ (stejná konvence
  jako H2 náběhy — ne schovat, nevytvořit).

### 3d. `drawers` — zásuvkový blok (úkol 15)

- Korpus jako dnes + **PRÁVĚ 2** zásuvková čela (počet je KONSTANTA, žádný
  parametr drawerCount).
- Čelo `name:'zasuvka-celo'`: šířka `widthMM − 20`, tloušťka 10 mm,
  z od 14 do 24 (předsazené před líc korpusu). Výškově: prostor od
  `yBodyBottom` po spodní hranu horní lišty se dělí na 2 sloty, čelo = výška
  slotu minus 6 mm spára.
- Úchytka `name:'zasuvka-uchytka'`: vodorovný válec (osa podél X) r 5 mm,
  délka 0,5 šířky čela, osa v z = 8 (z od 3 do 13), u horního okraje čela
  (~0,32 výšky čela nad středem slotu).

### 3e. `gnRack` — skříňka se zásuvy na GN (úkol 16)

- Korpus jako dnes + **6 párů vsuvů, rozteč 70 mm** (rozhodnutí zadavatele
  9. 8. 2026).
- Vsuv `name:'gn-vsuv'`: vodorovný profil 15×15 mm na VNITŘNÍ ploše každé
  boční stěny (vlevo x od `WALL_MM` do `WALL_MM+15`, vpravo zrcadlově),
  délka po hloubce: z od 55 (zapuštění 25 od líce korpusu) po
  `zBack − BACK_WALL_MM − 5`.
- Svisle: STŘED nejnižšího vsuvu 40 mm nad horní hranou podlážky
  (`yBodyBottom + FLOOR_MM + 40`), dalších 5 po **70 mm** výš — středy
  +40, +110, +180, +250, +320, +390. Celkem **12 těles** `gn-vsuv`
  (6 vlevo + 6 vpravo).
- `bodyStyle:'open'`: jen vsuvy. `bodyStyle:'doors'`: vsuvy + dvířka podle
  §3b (vsuvy se stavějí VŽDY, dvířka je jen zakryjí).

## §4 UI (Agent U)

### Paleta — `MONO_TAB_SPECIALS.podestavby` v `js/ui.js`

Pořadí řádků: `cabinet`, `gap`, `drawers11`, `drawers21`, `gnRack11`,
`gnRack21`. Nové záznamy nesou i `widthMM` (400/600) a paletový řádek u nich
místo dnešního `'—'` ukáže `t('catalog.widthExact', { mm })`. Záznamy bez
`widthMM` (cabinet, gap) zůstávají s `'—'`.

### Dlaždice pásu — `js/mono-ui.js` (ř. ~520 a ~686, obě místa!)

Popisek dlaždice i titulek pruhu parametrů podle druhu a šířky:

| druh | i18n klíč |
|---|---|
| `gap` | `mono.item.gap` (beze změny) |
| `cabinet` | `mono.item.cabinet` (beze změny) |
| `drawers` + 400 | `mono.item.drawers11` |
| `drawers` + 600 | `mono.item.drawers21` |
| `gnRack` + 400 | `mono.item.gnRack11` |
| `gnRack` + 600 | `mono.item.gnRack21` |

CSS třída dlaždice: všechny druhy kromě `gap` používají dosavadní
`mono-tile-cabinet mono-tile-wide` — ŽÁDNÁ nová CSS třída.

### Pruh parametrů — `buildPodestavbyParamBar` v `js/mono-ui.js`

| druh | pole |
|---|---|
| `gap` | šířka editovatelná (beze změny) |
| `cabinet` | šířka editovatelná, select `bodyStyle` (3 hodnoty), **NOVĚ** checkbox `field.hasShelf` viditelný JEN při `bodyStyle === 'open'`, select `finish` |
| `drawers` | šířka **jen zobrazená** (`paramDisplay` + `catalog.widthExact`, stejně jako u herdbloku), select `finish` |
| `gnRack` | šířka **jen zobrazená**, select `bodyStyle` OMEZENÝ na `['open','doors']`, select `finish` |

Checkbox police: patch `{ hasShelf: bool }` přes stávající
`onMonoUpdate('podestavby', id, patch, currentSide)`. Žádný nový callback
se NEZAKLÁDÁ. Vzhledově použít stávající prvky pruhu (paramField); pokud
pruh checkbox zatím nemá, postavit ho jako `<label><input type=checkbox>`
uvnitř `paramField` bez nové CSS třídy.

### `js/main.js`

- `sanitizeMonoCabinet` rozšířit podle §1 (druhy `drawers`, `gnRack`,
  pole `hasShelf`; neznámý kind → `cabinet`).
- `onMonoAdd('podestavby', kind)` překládá paletové druhy podle tabulky §1.
- Ověřit, že serializace ukládá položky podestaveb celé (vč. nových polí) —
  pokud ukládá objekty tak, jak jsou, nic neměnit.
- POZOR na past z merge katalogu (PREDANI.md ČÁST F): při práci v main.js
  nesahat na nic mimo popsaná místa.

### `js/i18n.js` — 4 nové klíče × 5 jazyků (en, de, pl, cs, sk — v tomto pořadí)

| klíč | cs (závazné) | en (návrh) |
|---|---|---|
| `mono.item.drawers11` | Zásuvkový blok GN 1/1 | Drawer unit GN 1/1 |
| `mono.item.drawers21` | Zásuvkový blok GN 2/1 | Drawer unit GN 2/1 |
| `mono.item.gnRack11` | Skříňka se zásuvy GN 1/1 | Cabinet with GN runners 1/1 |
| `mono.item.gnRack21` | Skříňka se zásuvy GN 2/1 | Cabinet with GN runners 2/1 |

de/pl/sk přeložit věcně (de: Schubladenblock…, Schrank mit GN-Auflagen…;
pl: Blok szuflad…, Szafka z prowadnicami GN…; sk: Zásuvkový blok…,
Skrinka so zásuvmi GN…). „GN 1/1"/„GN 2/1" se nepřekládá.
`field.hasShelf` a `bodyStyle.*` už ve všech 5 jazycích existují — nepřidávat.

## §5 Co se NEDĚLÁ

- Žádný výřez v desce, žádné přístroje, žádné nástavby.
- `drawers` NEMÁ volbu počtu zásuvek (pevně 2), `gnRack` NEMÁ volbu počtu
  vsuvů (pevně 6) ani rozteče (pevně 70).
- Tiskový dokument (`report.js`) MONO podestavby dnes neuvádí — nerozšiřovat.
- SEGMENT (`modules.js`, `block.js`, `ui.js` mimo `MONO_TAB_SPECIALS`) beze změny.

## §6 Přejímka (dělá koordinátor, ne agenti)

Agenti po sobě pustí `node --check` na každý editovaný soubor a NAPÍŠOU, co
změnili. Nic neměří v prohlížeči — měření dělá koordinátor: počty a polohy
těles přes přímý import `mono-geometry.js` s parametrem proti keši, rozteč
vsuvů 70±0,5 mm, dvířka/čela v z ∈ (0, 30), SEGMENT beze změny, čistá
konzole, uložení+načtení projektu s novými druhy.
