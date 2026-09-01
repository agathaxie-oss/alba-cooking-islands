# ZADÁNÍ — půdorys a specifikace pro ALBA MONO (úkol 21)

Závazná smlouva rozhraní. Implementace schváleného mockupu
`mockup-pudorys-mono.html` do aplikace.

**Rozsah: VÝHRADNĚ produkt MONO.** SEGMENT se nesmí změnit ani o pixel —
výslovné rozhodnutí zadavatele 1. 9. 2026. Každá větev MONO se přidává
VEDLE stávající větve SEGMENTU, nic se nepřepisuje.

## Etapy a rozdělení souborů

| etapa | agent | soubory |
|---|---|---|
| 1 | **G — kresba** | `js/floorplan.js` |
| 1 | **T — texty a styl** | `js/i18n.js`, `css/style.css` |
| 2 | **D — dokument** | `js/report.js` |

Etapa 2 začíná AŽ po přejímce etapy 1 — `report.js` čte model, který vzniká
v `floorplan.js`. Dva agenti nikdy nepíšou do téhož souboru.

---

# §1 Datový model — `computeMonoDocModel(state)`

**Vlastní Agent G.** Nová exportovaná funkce v `js/floorplan.js`. Je to
JEDINÝ zdroj pozic a číslování pro kresbu i pro dokument — `report.js` si nic
nedopočítává.

Polohy se NEPOČÍTAJÍ znovu: berou se z `computeMonoLayout(state, side)`
(`js/mono-layout.js`), který už dnes zná zatažení konců i zrcadlení stran.
`floorplan.js` ho zatím neimportuje — import se doplní.

```
computeMonoDocModel(state) → {
  lengthMM, depthAMM, depthBMM, totalDepthMM,   // totalDepth = A+B u island, jinak A
  isIsland,                                     // state.variant === 'island'
  workHeightMM, plinth: { type, heightMM },
  leftEndType, rightEndType,                    // FYZICKÉ konce bloku, nezaměněné
  sides: { A: SideModel, B: SideModel },        // B je prázdný u `single`
  common: [CommonItem, ...],                    // S1, S2, …
}

SideModel = { devices: [Device], cabinets: [Cabinet], sockets: [Socket] }

Device  = { code:'A1.1', type, name, xMM, widthMM, depthMM, frontOffsetMM,
            isSurface, def }        // def = položka katalogu nebo null
Cabinet = { code:'A2.1', kind, name, xMM, widthMM, depthMM,
            bodyStyle, hasShelf, finish, drawerCount, runnerPairs }
Socket  = { code:'A3.1', kind, name, xMM }
CommonItem = { code:'S1', kind, name, params:[string] }
```

**KLÍČOVÉ — `xMM` je VŽDY v souřadnicích KRESBY**, ne v pásových. Strana A se
bere z layoutu beze změny; **strana B se ZRCADLÍ** (`lengthMM − xMM − widthMM`
u ploch, `lengthMM − xMM` u bodových prvků), protože se měří od svého
vlastního levého kraje. Kdo tohle vynechá, dostane stranu B obráceně — viz
úkol 18. `depthMM` u přístroje je hloubka z katalogu, jinak
`PODESTAVBA_DEPTH_MM`.

**Číslování** (rozhodl zadavatel 1. 9. 2026):
- `A1.x` přístroje, `A2.x` podestavby, `A3.x` zásuvky a prvky panelu; totéž
  `B1.x`/`B2.x`/`B3.x`. **Písmeno H se NEPOUŽÍVÁ.**
- Číslo `x` běží od 1 v pořadí položek v řadě (pásovém, ne zrcadleném).
- `kind:'gap'` se **přeskakuje** — nedostává číslo ani se nekreslí.
- Společné prvky: `S1` levý zakončovací plech, `S2` pravý, `S3` sokl,
  `S4…` napouštěcí ramena (v pořadí pole). Sokl je v soupisu VŽDY, i když se
  pro `building` nic nekreslí.

**Popis položky se skládá automaticky** — `params` je pole řetězců, dokument
je spojí `' · '`. Skládá se z toho, co položka nese: rozměry, příkon
a připojení (katalog má `powerKW`, `voltage`, `gasKW`, u zón i po zónách),
počet zón/zásuvek/vsuvů, provedení, materiál. **Žádné nové pole katalogu se
nezavádí.**

# §2 Kresba — Agent G, `js/floorplan.js`

`buildFloorplanSVG(state)` dostane na začátku výhybku:
`if (state.productType === 'mono') return buildMonoFloorplanSVG(state);`
Stávající tělo (SEGMENT) zůstává NEDOTČENÉ.

**Kresba je schválená — PŘENES ji z `mockup-pudorys-mono.html`.** Ten soubor
obsahuje hotový a odsouhlasený kód (funkce `drawCab`, `drawDev`, `burners`,
`fryer`, `leader`, `tag`, `dim`, `vdim`, obrys se zkosením). Nevymýšlej to
znovu — přepiš to na data z §1 a na jednotky `floorplan.js`.

Závazné konvence (všechny už v mockupu):
1. **Přístroje v pravé poloze a velikosti**, včetně odsazení od čela, BEZ
   výplně (pod nimi leží čárkovaná podestavba a musí být čitelná).
   Neutrální plocha (`isSurface`) se **nekreslí vůbec**, jen dostane odkaz.
2. **Podestavby čárkovaně** (`stroke-dasharray`), leží pod deskou.
3. **Zásuvky zásuvkového bloku VÝHRADNĚ PŘED lícem desky**, tedy MIMO obrys
   bloku. Vztažná hrana je obrys bloku, ne líc skříňky. Jedno čelo = jeden
   pruh, počet pruhů = počet zásuvek (u MONO vždy 2).
4. **Podestavby číslované přímo u sebe**, u ZADNÍ hrany (vpředu jsou dvířka
   a vysunuté zásuvky).
5. **Přístroje, ramena a zásuvky na odkazové šipce**; u zásuvek menší značka
   (bodový prvek).
6. **Zkosené rohy** u konce typu `svislaDeskaZkos`: 50 × 50 mm pod 45°.
   `single` = jen přední roh, `island` = oba rohy toho konce. Zakončovací
   plech zkosení sleduje.
7. **ŽÁDNÉ čerchované čáry** (středová osa ani hranice neutrální plochy),
   **žádné popisky „ČELO"**, žádný popis orientace.
8. **Čelo strany A je DOLE** — obsluha u strany A vidí svou řadu zleva
   doprava jako v pásu.
9. **Kóty na OBOU stranách:** pod blokem řetězce strany A (podestavby,
   přístroje), nad blokem strany B; dále koncové zóny, celková délka
   a svislé hloubky A / B / celkem. U zkoseného konce kóta zkosení.
10. **Název prvku nesmí padnout do rámečku pozice** — odsazení se počítá
    z výšky rámečku, ne natvrdo.

Symboly přístrojů se kreslí VLASTNÍ podle `def.topFeature.type`
(hořáky / sklokeramické zóny / vany fritézy / indukční zóna / jinak prázdný
obdélník). **`img/pristroje/<id>-top.svg` se NEPOUŽÍVAJÍ — jsou to jen
zástupné šedé obdélníky s názvem souboru.**

# §3 Texty a styl — Agent T

## `js/i18n.js` — nové klíče, VŠECH 5 jazyků (en, de, pl, cs, sk)

| klíč | cs |
|---|---|
| `mono.doc.blockTitle` | Popis varného bloku |
| `mono.doc.commonTitle` | Soupis společných prvků |
| `mono.doc.partsTitle` | Soupis prvků podle stran |
| `mono.doc.devices` | Přístroje |
| `mono.doc.cabinets` | Podestavby |
| `mono.doc.sockets` | Zásuvky a prvky panelu |
| `mono.doc.series` | Produktová řada |
| `mono.doc.dims` | Rozměry (d × š × v) |
| `mono.doc.sideDepths` | Hloubka stran |
| `mono.doc.workHeight` | Pracovní výška |
| `mono.doc.herdblokHeight` | Výška herdbloku |
| `mono.doc.design` | Provedení |
| `mono.doc.materials` | Materiály |
| `mono.doc.finish` | Povrchová úprava |
| `mono.doc.endLeft` | Zakončení levé |
| `mono.doc.endRight` | Zakončení pravé |
| `mono.doc.worktop` | Pracovní deska herdbloku |
| `mono.doc.panel` | Ovládací panel |
| `mono.doc.electrical` | Elektroinstalace |
| `mono.doc.endPanel` | Zakončovací plech |
| `mono.doc.plinthItem` | Sokl |
| `mono.doc.arm` | Napouštěcí rameno |

Věty pro pravou stranu tabulky popisu ber jako **další klíče s parametry**
(např. `mono.doc.dimsValue` s `{l}`, `{d}`, `{h}`) — čísla se do textu
dosazují, nesmí být natvrdo v jazyce. Přesné znění vět opiš z mockupu
(oddíl `POPIS`), překlady do de/pl/sk věcně.

## `css/style.css` — karta soupisu

Soupis NENÍ tabulka se sloupci. Nové třídy (žádné jiné neměň):
`.report-item` (rámeček karty), `.report-item-head` (záhlaví: pozice +
název), `.report-item-pos` (pozice, tučně, firemní modrá **#0083C6**),
`.report-item-name`, `.report-item-body` (flex: fotka + popis),
`.report-item-photo` (obrázek ~170 × 128, `object-fit:cover`),
`.report-item-desc`. Na úzkém okně se fotka a popis srovnají pod sebe.
**Musí to fungovat i v tisku** (`@media print`) — karta se nesmí lámat přes
stránku (`break-inside: avoid`).

# §4 Dokument — Agent D, `js/report.js` (ETAPA 2)

`buildReport(ctx)` dostane výhybku na MONO. Pořadí oddílů u MONO:

1. hlavička (společná, beze změny)
2. náhledy 3D (společné, beze změny)
3. **Popis varného bloku** — tabulka klíč/hodnota podle §3
4. **Soupis společných prvků** (S1…) — karty
5. **Půdorys** — beze změny, jen vloží SVG
6. **Soupis prvků podle stran** — karty, oddíly A1/A2/A3 a B1/B2/B3
7. ramena a baterie (stávající oddíl) — **u MONO se VYNECHÁ**, ramena už
   jsou mezi společnými prvky jako `S4…`
8. patička (společná)

**Karta položky:** záhlaví = `code` + `name`; tělo = fotka vedle popisu.
Fotka: `img/pristroje/<id>-card.webp` z katalogu (`def.image` nebo odvozené
z id — použij, co katalog nabízí). Podestavby, zásuvky a společné prvky
fotku nemají → schematická ikona (inline SVG, stejné tvary jako v mockupu).
Popis = `params.join(' · ')`.

**Sloupce „Rozměry", „Příkon" ani „Poloha" NEEXISTUJÍ** — všechno je
v automaticky složeném popisu.

# §5 Co se NEDĚLÁ

- SEGMENT (větev v `floorplan.js` i `report.js`) se nemění.
- Nezavádí se nové pole katalogu ani nový soubor v `js/`.
- Formát uloženého projektu se nemění.
- `MonoCabinet` se nerozšiřuje — zásuvkový blok má i nadále PRÁVĚ 2 zásuvky
  (potvrdil zadavatel 1. 9. 2026).

# §6 Přejímka

Agenti pouštějí `node --check` a hlásí, co změnili. **Neměří v prohlížeči** —
měření dělá koordinátor: strana B zrcadlená, zásuvky mimo obrys desky,
zkosené rohy, kóty na obou stranách, číslování bez písmene H, žádné
čerchované čáry, fotky se načítají, SEGMENT beze změny, čistá konzole.
