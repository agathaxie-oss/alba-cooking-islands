# ZADÁNÍ — sloučení podestaveb, ETAPA 2 (půdorys a soupis dílů)

Závazná smlouva rozhraní. Navazuje na `ZADANI-SLOUCENI-PODESTAVEB.md`, jehož
etapa 1 (model, 3D, rozhraní) je HOTOVÁ — pole `mergeWithPrev` na segmentu
existuje, je normalizované (index 0 vždy `false`) a 3D podle něj staví.
Tahle etapa dodělává druhou půlku zadavatelova požadavku: „a ve finálním
výpisu".

**Rozsah: VÝHRADNĚ produkt SEGMENT.** MONO se nesmí změnit ani o pixel —
`computeMonoDocModel`, `buildMonoFloorplanSVG` a celá větev `buildMono*`
v `report.js` zůstávají nedotčené.

## Rozhodnutí zadavatele 2. 9. 2026 (mockup `mockup-slouceni-vypis.html`)

1. **Půdorys — varianta B.** Sloučená skupina má JEDEN obrys (dělicí čáry
   uvnitř zmizí) a řetězcová kóta měří PODESTAVBY, ne pozice. Zadavatel
   vědomě přijal, že šířky jednotlivých pozic z kresby zmizí.
2. **Soupis — buňky se NESLUČUJÍ.** Počet řádků se nemění a žádný `rowspan`
   se nezavádí. U PRVNÍHO přístroje skupiny se ve sloupci „Podestavba"
   uvede skutečný rozměr celé sestavy, u dalších členů jen odkaz
   „Podestavba společná s pozicí A1".
3. **Sloupec „Rozměr (š × h × v)" zůstává beze změny** — dál je to zábor
   segmentu v bloku (400 / 800 / 400), ne katalogový rozměr přístroje.

## Rozdělení souborů — dva agenti, žádný sdílený soubor

| agent | soubory |
|---|---|
| **P — půdorys** | `js/floorplan.js` |
| **R — soupis a texty** | `js/report.js`, `js/i18n.js` |

`js/main.js`, `js/modules.js`, `js/block.js` a `js/ui.js` se v této etapě
NEOTEVÍRAJÍ — etapa 1 je v nich hotová a uzavřená.

---

# §1 Skupiny počítá VÝHRADNĚ `floorplan.js` (agent P)

Agent R skupiny **nepočítá a `mergeWithPrev` vůbec nečte** — dostane je
hotové z `computeLayout()`, kterou už dnes importuje. Je to stejný princip
jako u MONO (`computeMonoDocModel` je jediný zdroj pozic a číslování pro
kresbu i dokument): kresba a soupis se nesmějí rozejít, protože každý počítá
po svém.

## Tvar dat — ZÁVAZNÝ, na tomhle stojí paralelní práce obou agentů

`layoutRow()` (`js/floorplan.js` ~ř. 92) doplní KAŽDÉ položce pole `group`.
Dostane ho i nesloučená položka — `size: 1`. Díky tomu nemá agent R žádnou
větev navíc: jediný test je `item.group.size > 1`.

```
item.group = {
  size,        // počet členů skupiny (1 = nesloučeno)
  index,       // pořadí TÉTO položky ve skupině, 0-based
  first,       // boolean, index === 0
  firstLabel,  // label prvního člena, např. 'A1'
  lastLabel,   // label posledního člena, např. 'A3'
  widthMM,     // SOUČET šířek všech členů skupiny
  xCenter,     // střed skupiny v TÉŽE soustavě jako item.xCenter
}
```

- Skupina je souvislý běh položek, kde druhá a další mají
  `seg.mergeWithPrev === true`. `layoutRow` dostává pole už seřazené a
  normalizované, takže stačí jeden průchod polem — nic se nedohledává
  napříč stranami.
- **`layoutRow` dostává jen VEJDOUCÍ segmenty** (`fittingA`/`fittingB`, viz
  `computeLayout`). Skupina se tedy počítá nad tím, co se do řady vešlo —
  přesně jako ve 3D (`buildSideSegments`). Přeplněný segment do skupiny
  nepatří, protože se nekreslí.
- `firstLabel`/`lastLabel` jsou labely, které `layoutRow` sám přiděluje
  (`${prefix}${idx + 1}`) — ne indexy.
- **`xCenter` skupiny NEODVOZUJ ze součtu šířek zleva**, spočítej ho z
  krajních hran členů:
  `xCenter = (min(člen.xCenter − člen.widthMM/2) + max(člen.xCenter + člen.widthMM/2)) / 2`.
  U strany B je totiž `xCenter` zrcadlený (`mirrorX`), takže „první v poli"
  leží v kresbě vpravo. Tenhle vzorec platí pro obě strany bez větvení.

`attachRowGeometry()` položky kopíruje spreadem, takže `group` projde dál
samo; nic tam neupravuj.

# §2 Kresba půdorysu (agent P, `js/floorplan.js`)

## §2.1 Obrys podestavby — jeden na skupinu

Ve `drawRow()` (~ř. 1234) se dnes pro každou položku kreslí obrys:

```
// vrstva 1 — obrys podestavby (plná čára)
parts.push(`<rect x=... width=${w} ... />`);
```

Nově se tenhle obrys kreslí **jen pro prvního člena skupiny**
(`item.group.first`) a to v rozměrech SKUPINY — `item.group.xCenter` a
`item.group.widthMM` místo `item.xCenter`/`item.widthMM`. `y` a `height`
zůstávají beze změny (`item.zTop`, `item.plinthDepthMM` jsou v celé řadě
stejné).

**Všechno ostatní zůstává PER POLOŽKU a beze změny:**
`drawDeviceTopView`, `drawDrawersTopView`, rámeček s kódem pozice (A1, A2…)
i název přístroje pod ním. Přístroje jsou pořád tři, jen skříňka pod nimi
je jedna.

## §2.2 Řetězcová kóta měří PODESTAVBY

`widthChainDimension(rowItems, yLineTopSide)` (~ř. 1312) dnes klade hranice
na okraje jednotlivých položek. Nově klade hranice na okraje SKUPIN.

Nejlevnější a nejbezpečnější úprava: hned na začátku funkce si z `rowItems`
sesbírej seznam skupin — jeden záznam na skupinu, `{ xCenter, widthMM }` z
`item.group` (ber je z členů s `group.first`) — a **zbytek funkce nech
pracovat nad tímhle seznamem beze změny**. Řazení podle `xCenter`, výpočet
`bounds`, značky i čísla jsou pak identické, jen nad hrubší jednotkou.

Popisky řad se NEZAVÁDĚJÍ (to byla varianta A, zadavatel zvolil B) a pásmo
kóty `chainBandH` se NEMĚNÍ — řada zůstává jedna, takže kresba nezvýší.

## §2.3 Čeho se v `floorplan.js` NEDOTÝKAT

- Větev MONO: `computeMonoDocModel`, `buildMonoFloorplanSVG`,
  `buildMono*Params`, `monoOutlinePolygon`, `monoEndZonePolygon`.
- Kóta celkové délky, kóty hloubek, boční krycí plechy, mezera u zdi/spáry,
  spára ostrova, napouštěcí ramena, popisky hran.
- `drawDeviceTopView` včetně posunu podle `deviceAlign`
  (ZADANI-ZAROVNANI-PRISTROJE.md §6) — ten je hotový a správný.

# §3 Soupis dílů (agent R, `js/report.js`)

Mění se **jediná buňka tabulky** — sloupec „Podestavba", který plní
`buildBaseCellText(item)` (~ř. 300). Hlavička, počet ani pořadí sloupců,
počet řádků, `rowspan` ani nic jiného se NEMĚNÍ.

`buildBaseCellText` potřebuje výšku bloku, aby složila rozměr sloučené
podestavby. `buildPartsTable(items, heightMM)` ji má — rozšiř podpis na
`buildBaseCellText(item, heightMM)` a předej ji z jediného volajícího.

Chování podle `item.group`:

| případ | obsah buňky |
|---|---|
| `group.size === 1` | **beze změny** — přesně dnešní text |
| `group.size > 1 && group.first` | `t('report.baseMerged', { range, w, d, h })`, za tím ` · ` a dnešní popisný text (styl / police / panel) |
| `group.size > 1 && !group.first` | `t('report.baseShared', { pos: group.firstLabel })` a NIC dalšího |

- `range` = `${group.firstLabel}–${group.lastLabel}` (spojovník je **en
  dash** U+2013, `–`, ne pomlčka).
- `w` = `Math.round(group.widthMM)`, `d` = `Math.round(item.plinthDepthMM)`,
  `h` = `Math.round(heightMM)` — stejné zaokrouhlení jako u sloupce
  „Rozměr" o dva sloupce vedle, ať čísla v jedné tabulce nevypadají různě.
- Dnešní popisný text u zásuvek (`DRAWERS_TYPE`) i u ostatních typů se
  přebírá BEZE ZMĚNY, jen se u prvního člena skupiny předřadí `baseMerged`.

## §3.1 Texty (agent R, `js/i18n.js`) — všech 5 jazyků (en, de, pl, cs, sk)

| klíč | cs |
|---|---|
| `report.baseMerged` | Sloučená podestavba {range}: {w} × {d} × {h} mm |
| `report.baseShared` | Podestavba společná s pozicí {pos} |

Znak `×` je U+00D7 (jako ve stávajícím sloupci „Rozměr"), ne písmeno x.
Klíče dej k ostatním `report.*` klíčům, ne mezi `floorplan.*`.

## §3.2 Čeho se v `report.js` NEDOTÝKAT

Celá větev MONO (`buildMonoDocModel` a všechny `buildMono*` funkce), hlavička,
patička, sekce bloku, materiálů, náhledů, půdorysu a armatur.

# §4 Co se NEDĚLÁ

- MONO se nemění.
- Nemění se model, 3D ani rozhraní — etapa 1 je uzavřená.
- Nezavádí se číslování podestaveb (P1, P2…) — to byla varianta 2 soupisu,
  kterou zadavatel nezvolil.
- Nemění se sloupec „Rozměr (š × h × v)".
- Verze formátu projektu se NEMĚNÍ.

# §5 Přejímka

Agenti pouštějí `node --check` a hlásí změny. **Neměří v prohlížeči** —
měření dělá koordinátor: sloučená skupina má v kresbě jeden obrys bez
vnitřních dělicích čar; kóta ukazuje součet (1600) místo dílčích šířek;
kódy pozic a schémata přístrojů zůstaly u svých přístrojů; v soupisu má
první člen skutečný rozměr sestavy a další jen odkaz; nesloučený segment
vypadá přesně jako dnes; ostrov souhlasí na OBOU stranách (strana B je
zrcadlená — `mirrorX`); MONO beze změny; čistá konzole.
