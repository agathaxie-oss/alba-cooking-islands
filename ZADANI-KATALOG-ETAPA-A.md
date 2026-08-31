# Etapa A — tovární data katalogu (bez změny běhu aplikace)

**Model:** Grok 4.5 (`cursor-grok-4.5-high`)
**Rozsah:** jen nové soubory pod `katalog/` a `img/pristroje/`.
**NESAHAT na:** `js/**`, `index.html`, `css/**`, `PREDANI.md` (kromě když
výslovně požádám). Aplikace po této etapě musí běžet stejně jako teď —
`BUILTIN_DEFAULTS` zatím zůstávají.

Závazný dokument: `ZADANI-KATALOG.md` §3–§5, §15 etapa A.

---

## Cíl

Vznikne strom:

```
katalog/
  manifest.json
  kategorie.json
  polozky/
    al-pg22-800-g.json
    al-fr10-400-e.json
    al-ind5-500-e.json
img/pristroje/
  <id>-card.webp   (nebo .png/.svg placeholder — viz níže)
  <id>-top.webp
```

Tři vzorové položky z dnešních značkových builtinů (ne generické
`gas_stove` / `fryer` / `induction`).

---

## Mapování staré → nové

| Staré id | Nové id | publicCode | type | origin | supplier | supplierCode |
|---|---|---|---|---|---|---|
| `lotus_pcd_68g` | `al-pg22-800-g` | `AL-PG22-800-G` | `gas_range` | `IT` | `lotus` | `PCD-68G` |
| `lotus_f10d_64et` | `al-fr10-400-e` | `AL-FR10-400-E` | `fryer` | `IT` | `lotus` | `F10D-64ET` |
| `berner_bi1eg5` | `al-ind5-500-e` | `AL-IND5-500-E` | `induction` | `DE` | `berner` | `BI1EG5` |

(Gril Lotus a ALBA EBM **nezařazuj** — stačí tři položky.)

`minCutoutDepthMM`: **700** u všech tří.

---

## Názvy (5 jazyků, bez značky výrobce)

### `al-pg22-800-g`
- cs: Sporák plynový 22 kW · 800
- en: Gas range 22 kW · 800
- de: Gasherd 22 kW · 800
- pl: Kuchenka gazowa 22 kW · 800
- sk: Sporák plynový 22 kW · 800

### `al-fr10-400-e`
- cs: Fritéza 10 l · 400
- en: Fryer 10 l · 400
- de: Fritteuse 10 l · 400
- pl: Frytownica 10 l · 400
- sk: Fritéza 10 l · 400

### `al-ind5-500-e`
- cs: Indukce 1 zóna 5 kW · 500
- en: Induction 1 zone 5 kW · 500
- de: Induktion 1 Zone 5 kW · 500
- pl: Indukcja 1 strefa 5 kW · 500
- sk: Indukcia 1 zóna 5 kW · 500

**description** a **construction**: přelož do všech 5 jazyků z textů
v `js/catalog.js` u příslušných builtinů (cs zdroj). Technické údaje
(`powerKW`, `voltage`, `gasKW`, rozměry, `topFeature`, `controls`,
`allowedBodyStyles`, `topFixed`, `widthMM`, …) zkopíruj z builtinů 1:1.

`geometryNotes`: krátká poznámka `"Migrace z builtin <staré id>; topFeature
zatím bez nového screenshotu (etapa A)."`.

**Žádné** `sourceUrl`. **Žádné** `imageDataURL` — jen cesty `cardImage` /
`topImage`.

---

## `kategorie.json`

Podle `ZADANI-KATALOG.md` §4 — všechny typy z tabulky + `name` v 5 jazycích
pro každý `type`. I typy bez položky v této etapě uveď (pasta, multipan…).

---

## `manifest.json`

```json
{
  "factoryVersion": 1,
  "schema": 1,
  "items": [ /* tři položky — jen pole z §3.2 */ ]
}
```

Každý záznam manifestu: `id`, `type`, `minCutoutDepthMM`, `publicCode`,
`name` (5 jazyků), `origin`, `cardImage`, `tags` (pole stringů, např.
`["gas","22kw"]` / `["electric","10l"]` / `["electric","5kw"]`).

---

## Fotky — placeholdery

Pokud neumíš vyrobit skutečné WebP: vytvoř **jednoduché SVG** (šedé
pozadí + text id) a ulož jako:

- `img/pristroje/<id>-card.svg`
- `img/pristroje/<id>-top.svg`

a v JSON cestách použij `.svg`. Až budou pravé fotky, nahradí se za webp.

Šest souborů (3× card + 3× top).

---

## Ověření (povinné na konci)

V kořeni projektu spusť (PowerShell):

```powershell
Get-Content katalog/manifest.json -Raw | ConvertFrom-Json | Select-Object factoryVersion, schema, @{n='count';e={$_.items.Count}}
Get-ChildItem katalog/polozky
Get-ChildItem img/pristroje
```

Zkontroluj, že každý `id` v manifestu má soubor `katalog/polozky/<id>.json`
a že cesty `cardImage`/`topImage` ukazují na existující soubory.

---

## Hotovo když

1. Strom výše existuje.
2. Tři plné JSON + manifest + kategorie.json validní JSON.
3. Placeholdery existují a cesty sedí.
4. **Žádná změna** v `js/`, `index.html`, `css/`.
5. Ve zprávě napiš přesný seznam vytvořených souborů a `factoryVersion: 1`.

## Nesmíš

- Měnit běžící katalogovou logiku.
- Přidávat generické položky.
- Commitovat (git tu nemusí být; commit nedělej).
