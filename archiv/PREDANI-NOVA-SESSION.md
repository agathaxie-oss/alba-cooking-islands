# Předání pro novou session

**Datum:** 3. 8. 2026
**Účel:** soběstačné předání kontextu. Kdo čte tenhle dokument, nepotřebuje
nic z historie konverzace. Čti ho celý, než začneš.

**Kořen projektu:** `C:\Users\jaroslav.cerny\Documents\Claude\Projects\260728 3D nerez`

---

## 1. Jak uživatel pracuje

**Hlavní agent zadává a kontroluje, implementaci píší levnější modely.**

- **Kód nepiš sám.** Napiš podrobné zadání a předej ho Sonnetu (větší úkoly)
  nebo Haiku (drobnosti).
- **Výsledek si vždy ověř sám v prohlížeči.** Agenti opakovaně hlásili úspěch
  tam, kde byla vada. Měření přes `javascript_tool` je autoritativní.
- **Dva agenti nesmí psát do stejného souboru naráz.** Většina změn sahá do
  `js/ui.js` a `css/style.css`, takže se paralelizovat skoro nedá — pouštěj je
  po sobě. Souběžně jde jen to, co je souborově oddělené (např. `js/i18n.js`
  zvlášť dopředu).
- **Vizuální změny nech uživateli schválit PŘED implementací.** Osvědčilo se
  kreslit varianty jako obrázek a nechat vybrat — konvergovalo to mnohem
  rychleji než popis slovy.
- Vše viditelné musí být v **5 jazycích** (en, de, pl, cs, sk).
- Rozhodnutí o rozložení a barvách si nech u sebe, nedelegovat.

---

## 2. Stav repozitáře

Větev `main`. **Hashe v tomhle dokumentu jsou ověřené `git log` 3. 8. 2026.**
Historie byla v minulosti přepsána přes `git-filter-repo`, takže hashe citované
kdekoli jinde (včetně `SPEC-HERDBLOK.md` §12) mohou být neplatné —
**nikdy je neopisuj z jiného dokumentu, vždy ověř přes `git log`.**

### Pracovní strom NENÍ čistý

```
 M .claude/settings.local.json
?? HODNOTY-MONO.md
?? js/mono-geometry.js
?? js/mono-prototype.js
?? mono-prototype.html
```

`HODNOTY-MONO.md` je závazný dokument a měl by být zacommitovaný. Zbylé tři
netrackované soubory jsou překonaná větev geometrie — viz §4, rozhodni o nich
dřív, než je zacommituješ.

### Commity odshora nejnovější

| Commit | Datum | Co |
|---|---|---|
| `8ac76ac` | 3. 8. | vrácení pracovních specifikací a zadání do repozitáře |
| `7ed213c` | 3. 8. | prototyp: parametrický 3D model bloku typu Vlna (`prototyp/`) |
| `f536e9b` | 1. 8. | volba typu bloku: úvodní obrazovka, odznak, typ v souboru |
| `c2efae0` | 1. 8. | `.gitignore` pro provozní a komunikační soubory |
| `0ce4c3e` | 1. 8. | stabilizace: formát souboru v4, oprava importu katalogu, úklid |
| `949b311` | 31. 7. | dokument: povrchová úprava a síla korpusu |
| `baa5c4a` | 31. 7. | dokument: kontakty firmy a jakost materiálu |
| `8af6a9a` | 31. 7. | ovládací panel vlevo, panel editace aktivního bloku dole |
| `009e757` | 31. 7. | UI: čitelnější karty v pásu a nová podoba ramen |
| `73ef1e1` | 31. 7. | UI: oddělení pohledu na blok od editované strany |
| `b2d3d7e` | 31. 7. | i18n: 7 klíčů pro spodní pás a ramena v 5 jazycích |
| `6ff4971` | 31. 7. | UI: zpřehlednění horní části levého panelu |
| `d9de5ac` | 30. 7. | UI krok 3A: spodní pás se sestavou (desktop) |
| `3270936` | 30. 7. | UI krok 2: paleta prvků jako řádky s filtrem |
| `b75a176` | 30. 7. | UI: responzivní horní lišta na mobilu |
| `960450e` | 30. 7. | initial commit: 3D Cooking Block |
| `9d2ba67` | 28. 7. | initial commit |

**Pozor:** `SPEC-HERDBLOK.md` §12 („Vyřízeno v dokumentu") cituje hashe
`b3e66ac` a `e5d7ab6`, které po přepsání historie **neexistují**. Odpovídají
commitům `baa5c4a` a `949b311`. Opravu v `SPEC-HERDBLOK.md` nikdo neprovedl.

### Soubory v kořeni

`index.html`, `mono-prototype.html`, adresáře `js/`, `css/`, `img/`, `prototyp/`,
dokumenty `HODNOTY-MONO.md`, `SPEC-HERDBLOK.md`, `SPEC.md`, `ZADANI-UI.md`,
`ZADANI-PANEL.md`, `ZADANI-KATALOG.md`, `ZADANI-BATERIE.md`, `DEPLOY.md`,
`README.md`, `PREDANI-NOVA-SESSION.md` (tento).

`js/`: `arms.js`, `block.js`, `catalog.js`, `custom-dialog.js`,
`device-manager.js`, `floorplan.js`, `i18n.js`, `main.js`, `materials.js`,
`modules.js`, `mono-geometry.js`, `mono-prototype.js`, `report.js`, `ui.js`,
`viewer.js`.

---

## 3. Dva produkty — ALBA SEGMENT a ALBA MONO

ALBA má dvě řady varných bloků. **Obchodní názvy se nepřekládají**, ale
**v kódu se ukládá neutrální kód, ne obchodní jméno.**

| Produkt | Kód ve stavu | Stav |
|---|---|---|
| **ALBA SEGMENT** | `'segment'` | stávající funkční aplikace v kořeni projektu |
| **ALBA MONO** | `'mono'` | nový produkt, rozpracovaný |

### Architektura — ROZHODNUTO

**Jedna aplikace, sdílené jádro** (`materials`, `i18n`, `viewer`, `report`,
katalog), **produkt se volí při založení projektu.** Dvě oddělené základny by
se rozešly.

### Co už je implementované (commit `f536e9b`)

- `js/main.js` ř. 100 — `state.productType: 'segment'` s komentářem
  `// 'segment' | 'mono'`
- ř. 473 — serializuje se do souboru, `version: 4`
- ř. 675 — tolerantní validace při načtení:
  `config.productType === 'mono' ? 'mono' : 'segment'`; neplatná nebo chybějící
  hodnota spadne na `'segment'`, soubor se **neodmítá**
- ř. 722 + 730 — zápis do stavu a `ui.setProductType(...)`
- **úvodní obrazovka** s volbou typu (místo přepínače v liště), odznak v UI
- zrušená ikonka „poslední uložené"
- **katalog se podle typu nefiltruje**

**`state.productType` je zatím jen evidence, nikoli chování.** Geometrie MONO
není v aplikaci nikde importovaná.

### Co je hotové v SEGMENTu

Světlá firemní paleta, horní lišta s ovládáním aplikace, vektorové logo, tiskový
dokument s technickou specifikací a kontakty, půdorys s hierarchií kót, paleta
prvků s filtrem, spodní pás se sestavou (karty + sdílený pruh parametrů), ramena
jako karty, oddělené přepínání pohledu a editované strany, název projektu,
ukládání s volbou názvu.

### Nedodělky SEGMENTu — ověřené v kódu, stále platí

1. **`js/i18n.js`, klíč `arms.emptyHint`** — v češtině (ř. 1043) zní
   „Žádná ramena — přidejte níže.", ale karta pro přidání je nově **nad** pruhem.
   Přeformulovat v pěti jazycích (ř. 105 en, 416 de, 728 pl, 1043 cs, 1357 sk).
   Uživatel se k tomu zatím nevyjádřil.
2. **`js/report.js` ř. 258–259** — `totalKW.toFixed(1)` a `totalGasKW.toFixed(1)`
   bez lokalizace desetinného oddělovače, takže v češtině se v zákaznickém
   dokumentu tiskne „0.0 kW" s tečkou místo čárky.
3. **Krok 3, část B — mobilní plachta.** Na 375 px jedou panel a pás vedle sebe
   v prozatímním rozvržení a 3D pohled má jen 205 px (před krokem 3A měl 418).
   Cíl: jedna spodní plachta se dvěma záložkami, popsáno v `ZADANI-UI.md` §4,
   oddíl „MOBIL". Nerozhodnuto: tažení prstem, nebo klepnutí na úchyt cyklující
   tři stavy?
4. **`ZADANI-UI.md` §3 a §8 jsou neaktuální** — popisují už hotové věci.

---

## 4. Co pro MONO existuje a jakou to má roli

Čtyři věci. **Role každé z nich je jiná a nesmí se zaměnit.**

| Co | Cesta | Role |
|---|---|---|
| **Závazné hodnoty** | `HODNOTY-MONO.md` | **ZÁVAZNÝ ZDROJ ČÍSEL.** Má přednost před vším ostatním, včetně `SPEC-HERDBLOK.md` a kódu. |
| **Prozaická specifikace** | `SPEC-HERDBLOK.md` | slovní popis konstrukce. **Čísla v ní jsou zčásti zastaralá** — kde se liší od HODNOTY, platí HODNOTY. |
| **Ostrá geometrie** | `js/mono-geometry.js` | 603 ř., čistá geometrie bez vazby na DOM. **Zastaralá proti HODNOTY, k přepsání.** |
| **Ladicí prototyp** | `prototyp/` (5 souborů, 2544 ř.) | **NÁSTROJ NA LADĚNÍ VZHLEDU, ne produkt.** |

### `prototyp/` — přenášejí se z něj ČÍSLA, ne soubory

**Do nového kódu se z prototypu NIC nekopíruje.** Je to samostatný nástroj
se 111 posuvníky, na kterém si uživatel vymodeloval, jak má blok vypadat.
Hodnoty v `HODNOTY-MONO.md` pocházejí přímo z něj — klíče v JSONu odpovídají
1:1 klíčům v `prototyp/params.js`.

| Soubor | Řádků | Role |
|---|---|---|
| `prototyp/params.js` | 806 | 111 číselných parametrů + 5 výběrů (`konecVlevo`, `konecVpravo`, `limec`, `hygiena`, `sokl`), 13 skupin, čtyřstupňová značka jistoty (`spec`/`derived`/`uncertain`/`proto`), `derivedReadout()` |
| `prototyp/geometry.js` | 1132 | čistá geometrie v milimetrech, převod dělá volající měřítkem kořene (`MM_TO_M`). Exporty: `MM_TO_M`, `derive(P,C)`, `buildBlock(P,C)`, `supportChecks(P,D,cabs)`, `disposeGroup(group)` |
| `prototyp/main.js` | 264 | scéna, světla, kamera, přestavba při každé změně posuvníku, `window.PROTO` |
| `prototyp/controls.js` | 199 | panel se generuje z `params.js`, nepíše se ručně |
| `prototyp/index.html` | 143 | vlastní minimální styl, nesahá na `css/style.css` |

Prototyp umí navíc proti `js/mono-geometry.js`: **sokl** (`buildPlinth`),
**boční kryt** (`buildSideCovers`), **svislou boční desku / „nos"**
(`bokFront`, `bokBack`, `noseMetrics`, `isBok`), hygienické stupně, ovládací
prvky, výřezy přístrojů, dutiny. Nemá žádný rozměr natvrdo — vše bere z `P`.

### `js/mono-geometry.js` — překonaná větev

Vznikl 1. 8., **před** `HODNOTY-MONO.md`. Importuje jen `three` a
`./materials.js`. V aplikaci ho **nikdo neimportuje** — jediný importér je
`js/mono-prototype.js` (ř. 27), tedy samostatná zkušební stránka
`mono-prototype.html`, na kterou `index.html` nikde neodkazuje. Stránka tahá
`three@0.165.0` přes importmap z `cdn.jsdelivr.net`.

Co je v něm zastaralé (ověřeno v kódu):

```js
export const DESK_HEIGHT_MM = 40;    // ř. 48 — má být 50
export const PANEL_HEIGHT_MM = 250;  // ř. 49 — má být 240
export const PANEL_SETBACK_MM = 15;  // ř. 50 — má být 25
export const LISTA_HEIGHT_MM = 30;   // ř. 53 — má být 40
export const COLLAR_THICKNESS_MM = 3; // ř. 97 — autorský odhad, HODNOTY dávají 20
export const END_TYPES = { WAVE:'vlna', CHAMFERED_WAVE:'zkosena-vlna',
                            ROUNDED:'zaoblena-hrana' }; // ř. 69 — zrušené názvosloví
```

Táhne to za sebou dopočty uvnitř souboru: `panelTopY = 290 − 40 = 250`,
`panelUpperHeight = 250 − 30 = 220`, `facetTopY = 270` / `facetBotY = 250`.
Mrtvé konstanty (deklarované, nikde nepoužité): `FLOOR_MM` (ř. 61),
`END_ZONE_MM` (ř. 80), `DESK_FACET_DROP_MM` (ř. 85). Boční kryt v souboru
**neexistuje vůbec**.

Exportuje 5 funkcí: `buildHerdblokOutline()`, `buildHerdblokUsek()`,
`buildPodestavba()`, `checkSupport()`, `buildMonoBlock()`.

### Tři různé modely polohy ve třech souborech

| Soubor | Model |
|---|---|
| `js/mono-geometry.js` | **souřadnice** — `x` je přímo `xMM` z parametrů, necentrováno, `x = 0` vlevo (ř. 510–511, 581, 591) |
| `js/block.js` (SEGMENT) | **pořadí** — `cursorM += widthM` (ř. 116, 127) |
| `prototyp/geometry.js` | **počet a rozteč, vystředěně** — `cabinetLayout()` ř. 565–592, `const start = (avail0 + avail1) / 2 - total / 2;`, `x = 0` uprostřed herdbloku |

Nový kód musí sjednotit — viz §6.

---

## 5. Geometrie a hodnoty

**`HODNOTY-MONO.md` je závazný zdroj.** Všechny rozměry v milimetrech.
Hodnoty pocházejí z modelu, který uživatel odeslal 1. 8. 2026.

### 5.1 Terminologie — NOVÁ, přepisuje starší specifikaci

**Dřívější tři typy zakončení podle půdorysného tvaru rohu (vlna R3 / zkosená
vlna 45° / zaoblená hrana R50) se RUŠÍ.** Byl to omyl v komunikaci.

Nově existují **dva** typy:

| Název | Klíč | Popis |
|---|---|---|
| **vlna** | `svislaDeska` | pracovní deska pokračuje **svisle po boku** přes celou výšku herdbloku |
| **zkosená vlna** | `svislaDeskaZkos` | totéž + **rovné i zkosené čelo**: rovná část 20 mm, zkosená 50 mm, úhel 45° |

U **obou** typů pokračuje deska svisle po boku. `js/mono-geometry.js` variantu
se svislou boční deskou vůbec nezná. Typ „zaoblená hrana" v novém názvosloví
neexistuje (hodnota `zakonceniZaobleniR50: 50` v JSONu je pozůstatek).

### 5.2 Základní skladba

Blok se skládá ze **dvou nezávislých vrstev** nad společnou osou X:

- **podestavby** — samostatné skříňky
- **herdblok** — deska s přístroji a ovládacím panelem, položená na podestavbách

**Výška bloku se mění tělem skříňky, ne nožičkami ani herdblokem.**

| Veličina | Hodnota |
|---|---|
| Pracovní výška | **900** (rozsah 850–900) |
| Herdblok včetně desky | **290**, konstrukčně pevný |
| Podestavba včetně nožiček | **610** = pracovní výška − 290 |
| Nožičky | **150**, konstanta |
| Tělo skříňky | **460** = 900 − 290 − 150 |

### 5.3 Čelní skladba herdbloku — ZMĚNĚNO

Shora dolů v rámci 290 mm:

| Pásmo | Výška | Poznámka |
|---|---|---|
| pracovní deska — viditelné svislé čelo | **50** | dřív 40 |
| výklopný ovládací panel | **240** | ustoupený **25** za líc desky; dřív 250 / 15 |

**50 + 240 = 290.**

**Spodní lišta je součástí panelu, ne samostatné pásmo** — je vysoká **40**
(dřív 30), je ve spodní části panelu, předsazená o 4 mm proti panelu.

Deska: síla plechu **2**, zahnutí hrany dovnitř **20**, poloměr horní hrany **3**.

### 5.4 Přesahy a poloha podestavby — ZMĚNĚNO, DŮLEŽITÉ

Starší specifikace měla **jedno** číslo pro ustoupení panelu i přesah desky
přes podestavbu. **HODNOTY mají tři různá čísla:**

| Veličina | Hodnota |
|---|---|
| Ustoupení panelu za líc desky | **25** |
| Přesah desky vpředu | **30** |
| Přesah desky bočně | **25** |
| Přesah desky vzadu | **25** |
| Zapuštění podestavby od konce | **20** |
| Zatažení panelu od boku | **70** |
| Zatažení spodní lišty od boku | **70** |

Z toho plyne, že **čelo podestavby leží 5 mm ZA čelem panelu**, ne zarovnané
s ním, jak tvrdí `SPEC-HERDBLOK.md` §7.0. Je to strukturální rozpor, ne jen
konstanta — viz §9 bod 1.

Hloubka herdbloku volná, v modelu **850**. Hloubka podestavby **670**.
Mezera od zdi: dopočet v HODNOTY hlásí **155** (`850 − 25 − 670`), ale skříňka
je posazená podle `presahDeskyVpredu` 30, takže reálně vychází **150**.

### 5.5 Zakončení a boční deska

| Veličina | Hodnota |
|---|---|
| Rovná část zakončení | **20** |
| Zkosená část | **50**, úhel **45°** |
| Celková délka zakončení | **70** = 20 + 50 |
| Zúžené čelo zkosené vlny | **20** (facetka 28,3 = 20 × √2) |
| Tloušťka boku | **20** |
| Poloměr přehybu boku nahoře | **3** |
| Zahnutí spodní / zadní hrany boku | **20** / **20** |
| Poloměr svislých hran boku | **0** |
| `zakonceniVlnaR3` | **2** — poloměry do ~5 mm se ve vizualizaci ignorují, kreslí se ostrá hrana |

**Pozor:** nová výška čela 50 rozbíjí starší rozklad 20 (svisle) + 20 (facetka).
**HODNOTY-MONO rozklad 50 na svislou a šikmou část nikde neuvádějí — je to díra
v zadání.** Při čele 50 a vodorovném zapuštění 20 by facetka klesala o 30, což
není 45°.

### 5.6 Boční kryt — NOVÁ PRAVIDLA

- **vždy kryje CELOU boční stranu podestaveb**
- u **ostrovního** bloku jde **přes celou šířku OBOU stran bloku**
- **standardně 50 mm silný** u vlny i zkosené vlny (viz rozpor §9 bod 3)
- je **„nalepený" na PODESTAVBÁCH, ne na konci herdbloku**
- výška v hodnotách **750** (z toho 460 pod herdblokem)

### 5.7 Límec

| Veličina | Hodnota |
|---|---|
| Výška | **100** (volitelná 40–300) |
| Tloušťka plechu | **20** |
| Zahnutí horní hrany / poloměr ohybu | **0 — OSTRÝ PRAVÝ ÚHEL** |
| Odsazení od hrany desky | **0** |
| Zarovnat s bočnicí | ano |

**Poloměr ohybu límce už NENÍ otevřená otázka** — je dodaný, je to 0.
Viz `SPEC-HERDBLOK.md` §4.4 a §12 („Vyřízeno").

Límec je **jen na rovných zakončeních nebo na hranách napojených pod 90°**.
Na zkosených a zaoblených místech límec není a rozhraní ho tam nesmí nabídnout.

### 5.8 Podestavby — konstrukce

**Nejde o sílu plechu.** Korpus je z plechu **1,5 mm**, ale dílce jsou
vytvarované a duté, takže mají konstrukční tloušťku:

| Dílec | Hodnota |
|---|---|
| Stěna | **20** |
| Zadní stěna | **20** |
| Podlážka | **40** (uvnitř výztuhy a dutina, v modelu plný dílec) |
| Příčná lišta nahoře | **20 × 20**, **jen vpředu**, ne vzadu |
| Nožičky — výška | **150** |
| Nožičky — rozměr | **40** |
| Nožičky — odsazení od rohu | **50** |
| Šířka podestavby v modelu | **800** |

**Stěny sousedních skříněk se sčítají** — mezi vnitřky dvou skříněk vedle sebe
je 40 (20 + 20). Vnitřní světlost samostatné skříňky = vnější šířka − 2 × 20.

### 5.9 Podepření

| Pravidlo | Mez |
|---|---|
| **Převis** — volný konec za poslední podestavbou | **500** |
| **Most** — nepodepřená světlost mezi podestavbami | **1200** |

Kontrolují se každý zvlášť. Překročení se hlásí.

### 5.10 Hygienické stupně (jen podestavby)

Jde o **konstrukci**, ne o tloušťku plechu.

| Stupeň | Konstrukce |
|---|---|
| **HS+** | základní korpus s viditelnými spárami |
| **H1** | žádné spáry na čele ani uvnitř, vše svařeno a vyčištěno |
| **H2** | jako H1 + kouty **mezi podlážkou a stěnami** s **R 16**; zepředu vidět vlevo a vpravo dole |
| **H3** | jako H2 + horní plech a **R 16 ve všech koutech** |

V modelu je zvoleno **H2**, `radiusH2: 16`.

### 5.11 Provedení soklu

| Provedení | Popis |
|---|---|
| **Stavební sokl** | sokl postavený na stavbě, blok se na něj posadí |
| **Nožičky a soklová nerezová zástěna** | 4 nožičky pod každým korpusem, sokl nasazený zepředu |
| **Konstrukční sokl** | nerezový rám pod celým blokem |

Poslední dvě se **vzhledově neliší**, konstrukčně ano → musí být rozlišené
v soupisu dílů a v dokumentu. **Odsazený sokl se dělá kolem dokola včetně boků.**
V modelu zvoleno `sokl: "nozicky"`; odsazení soklu 40, výška 150, tloušťka
soklového panelu 15, průřez rámu konstrukčního soklu 20.

### 5.12 Přístroje a ovládací panel

Přístroje se osazují **do herdbloku**, ne do podestavby.

| Veličina | Hodnota |
|---|---|
| Šířka × hloubka výřezu v modelu | **520 × 480** |
| Od přední hrany — standardní | **100** |
| Od přední hrany — minimum | **50** |
| Od zadní hrany — minimum | **50** |
| Ochranné pole mezi přístroji — minimum | **50** |

**Ochranná pole se nesčítají** — `mezera = max(pole_A, pole_B)`, nejméně 50.

Ovládací panel **je součástí herdbloku, ne přístroje**; přístroj do něj jen
propisuje své ovládací prvky. Běží po celém čele kromě zakončení (od konce bloku
je zatažený o 70). **Ovládání přístroje sedí v ose X pod svým přístrojem** —
pevná vazba, posun se nedělá. Do panelu se umisťuje příslušenství s volnou
polohou, např. zásuvka 230 V.

| Prvek | Rozměr |
|---|---|
| Průměr otočného ovladače | **70** |
| Vyložení otočného ovladače | **25** |
| Rozteč ovladačů ve skupině | **110** |
| Výška osy ovladačů od horního okraje panelu | **110** |
| Průměr tlačítka | **22** |
| Čelo zásuvky 230 V | **80** |

Druhy prvků: tlačítka (jediné provedení), displeje (jediné provedení), kruhové
otočné ovladače (**standardní nebo příplatkové** masivní nerezové).
**Upselovat jde jen kruhové ovladače.**

### 5.13 Co se proti starší specifikaci ZMĚNILO — souhrn

| Veličina | Dřív (`SPEC-HERDBLOK.md`) | Nově (`HODNOTY-MONO.md`) |
|---|---|---|
| Viditelné čelo desky | 40 | **50** |
| Spodní lišta | 30 | **40** |
| Ustoupení panelu | 15 | **25** |
| Výška ovládacího panelu | 250 | **240** (290 − 50) |
| Součet čelní skladby | 40 + 250 = 290 | **50 + 240 = 290** |
| Přesah desky přes podestavbu | totéž číslo jako ustoupení (15) | **samostatná čísla: vpředu 30, bočně 25, vzadu 25** |
| Typy zakončení | tři (vlna / zkosená vlna / zaoblená hrana) podle půdorysu rohu | **dva** (`svislaDeska` / `svislaDeskaZkos`), u obou svislá deska po boku |
| Boční kryt | „krycí panel na bok", nekótován | **kryje celou boční stranu podestaveb, 50 mm, nalepený na podestavbách** |
| Poloměr ohybu límce | chyběl, blokující | **0, ostrý pravý úhel** |
| Mezera od zdi | `hloubka − 15 − 670` = 165 pro 850 | dopočet **155**, reálně **150** (viz §9 bod 2) |

**Beze změny zůstává:** pracovní výška 900, herdblok 290, nožičky 150, hloubka
podestavby 670, stěna 20, podlážka 40, příčná lišta 20 × 20, radius H2 16, síla
plechu korpusu 1,5, převis 500, most 1200, odvěsna zkosení 50, R50 zaoblení 50,
délka zakončení 70, límec 40/100/300.

---

## 6. Datový model a rozhraní — ROZHODNUTO

**V rozhraní NEJSOU volné souřadnice. Obchodník zadává POŘADÍ a ŠÍŘKY.**

### Dvě uspořádané řady

| Řada | Položky |
|---|---|
| **herdblok** | přístroje, **pracovní plocha**, volný prostor |
| **podestavby** | skříňky, volný prostor |

- **Volný prostor je běžná položka řady**, ne mezera odvozená ze souřadnic.
- Na herdbloku je „pracovní plocha" **PRODEJNÝ DÍL** a **patří do soupisu**.
- Mezi podestavbami je volný prostor **jen díra** a **do soupisu NEPATŘÍ**.
- **`xMM` se dopočítává načítáním šířek. Uživatel je nikdy nepíše.**

### Odvozené veličiny

| Veličina | Definice | Mez |
|---|---|---|
| **Převis** | volný prostor na začátku / konci řady podestaveb | 500 |
| **Most** | volný prostor mezi podestavbami | 1200 |

### Pozice konců

- **Konec skříněk je zarovnaný s panelem herdbloku v ose X.**
- **Blíž ke konci skříňky být nemohou.**
- Co jde vložit, je **prázdný prostor pro převis**.

### Délka a srovnání řad

- **Délku určuje herdblok.**
- Řada podestaveb se **srovnává zleva**, rozdíl se ukáže jako **výrazné
  upozornění s jednoklikovým doplněním**.
- **NEDOPLŇOVAT automaticky.**

### Ochranné pole

**Ochranné pole 50 mm mezi přístroji zůstává AUTOMATICKÉ.** Položka „pracovní
plocha" je od toho, když uživatel chce **víc než minimum**, ne náhrada za
automatiku.

### Co se z rozhraní SEGMENTu přebírá a co mění

**Beze změny:** horní lišta, světlá paleta a kontrastní pravidla, kamera
s obletem, pruh parametrů s přelévající se mřížkou, mazání ikonou koše v záhlaví
pruhu, paleta prvků s filtrem a odznakem cílové vrstvy, oddělení pohledu od
editace.

**Mění se:**

- **Pás dostane víc drah nad společnou osou X** — herdblok, ovládací panel,
  podestavby (a ramena jako dnes). Most i převis jsou v pásu vidět jako mezera,
  protože jsou to skutečné položky řady.
- **Cílová vrstva** se řeší stejným mechanismem jako dnešní odznak „do A / do B",
  jen místo strany ukazuje vrstvu.
- **Kapacita „využito X / Y mm" ztrácí smysl** — délka není pevná schránka.
  Nahradí ji kontroly převisu, mostu a odstupů přístrojů.
- Šipky ◀ ▶ v pořadové řadě smysl mají — pořadí zůstává. (Starší verze tohoto
  dokumentu tvrdila opak, protože počítala s volnými souřadnicemi.)

---

## 7. Další krok a v jakém pořadí

Prototyp geometrie **už existuje ve dvou podobách** a nemusí se stavět.
Zbývá z toho udělat produkt.

1. **Rozhodnout osud `js/mono-geometry.js`, `js/mono-prototype.js`
   a `mono-prototype.html`.** Jsou netrackované a překonané. Buď přepsat, nebo
   smazat a napsat geometrii znovu. Nechat je viset je nejhorší varianta.
2. **Napsat ostrou geometrii MONO** podle `HODNOTY-MONO.md` — čísla brát
   z prototypu, **kód z něj nekopírovat**. Sjednotit model polohy podle §6
   (uspořádané řady, `xMM` dopočítané načítáním šířek).
3. **Doplnit chybějící prvky, které v `js/mono-geometry.js` nejsou:**
   boční kryt (tloušťka i výška), svislá boční deska / „nos", radius H2 16,
   rozměr a odsazení nožičky jako konstanty, síla plechu desky 2, poloměr horní
   hrany desky 3, zahnutí hrany desky 20, přesahy desky bočně/vzadu 25,
   zapuštění podestavby od konce 20, zatažení panelu a lišty od boku 70.
4. **Napojit geometrii na `state.productType === 'mono'`**, aby volba typu
   přestala být jen evidencí.
5. **Datový model uspořádaných řad** — položky, šířky, volný prostor,
   dopočet `xMM`, kontroly převisu a mostu, srovnání řad s jednoklikovým
   doplněním.
6. **Rozhraní** — pás s více drahami, cílová vrstva, kontroly místo kapacity.
7. **Půdorys, dokument, soupis dílů** — až po geometrii, váží se na ni.

Vizuální podobu nech schválit **před** implementací, obrázkem s variantami.

---

## 8. Co chybí / čeká na uživatele

### Blokující

1. **HODNOTY PRO „VLNU" CHYBÍ.** Oba JSON bloky v `HODNOTY-MONO.md` (§4,
   „pro zkosenou vlnu" a „pro vlnu") jsou **bajt po bajtu totožné** a v obou je
   `konecVlevo` i `konecVpravo` nastaveno na **`svislaDeskaZkos`**. Blok
   označený „pro vlnu" je tedy druhý opis zkosené vlny.
   **Hodnoty pro vlnu NESMÍŠ odhadovat — uživatel je musí dodat znovu.**
   Sám v §1 avizuje „uživatel domodeluje, hodnoty dodá".
2. **Rozklad výšky čela desky 50 na svislou a šikmou část.** Starý rozklad
   20 + 20 platil pro čelo 40. Pro 50 není v HODNOTY nikde uveden.

### Nezablokuje geometrii, ale je potřeba

3. **Tloušťka bočního krytu** — 40 nebo 50? Viz §9 bod 3.
4. **Výška bočního krytu** — má sahat po nožičky (750), nebo jen po tělo
   skříňky (460)? Viz §9 bod 4.
5. **Převis po zarovnání skříněk** — dopočet hlásí 45 na každé straně, ale nové
   pravidlo říká zarovnání s panelem, který končí 70 od konce bloku. 45 je stav
   starého vystředěného rozvržení; nové pravidlo dá 70. **Potvrdit.**
6. **Zúžené čelo 20 mm u zkosené vlny** — po celém obvodu té varianty, nebo jen
   na zkosené rovině rohu? Zatím vedeno jako po celém obvodu.
7. **Fotka rohu, kde se potkává zadní a boční límec.**
8. **Vnitřní radiusy H2/H3** — fotografie vnitřku skříňky.
9. **Lemy kolem otvorů pro přístroje** — patří herdbloku, nebo přístroji?
   Na fotografii jsou navařené rámečky, do kterých indukce zapadá.
10. **Rozměry přístroje** čtu jako **šířka × hloubka** — potvrdit.

### ODLOŽENO — neřešit bez pokynu

- **Nástavby nad blokem** (roštová nástavba, police na salamandr apod.) —
  stejná kategorie jako napouštěcí ramena, příslušenství s vlastní polohou.
- **Druhý rozměr přístroje „na desce" vs. „pod deskou".**
- **Jestli si přístroj smí v katalogu určit ochranné pole větší než 50.**
- **Jestli se příplatkové kruhové ovladače volí pro celý blok, nebo po
  přístrojích.**

---

## 9. Rozpory v číslech nalezené auditem

Audit porovnal `HODNOTY-MONO.md`, `SPEC-HERDBLOK.md` a `js/mono-geometry.js`.
**Kde se liší, platí `HODNOTY-MONO.md`.**

1. **Ustoupení panelu ≠ přesah desky přes podestavbu — NEJZÁVAŽNĚJŠÍ NÁLEZ.**
   `SPEC-HERDBLOK.md` §5 a §7.0 to má za jedno číslo a `js/mono-geometry.js` to
   explicitně komentuje jako „tentýž rozměr". HODNOTY mají dvě různá čísla:
   `ustoupeniPanelu` 25 a `presahDeskyVpredu` 30. V `prototyp/geometry.js:452`
   je čelo skříňky `cabZ0 = plateZ0 + presahDeskyVpredu`, tedy čelo podestavby
   leží 5 mm **za** čelem panelu — což popírá `SPEC-HERDBLOK.md` §7.0
   („čelo podestavby je zarovnané s panelem herdbloku"). **Mění to datový model,
   ne jen konstantu.**
2. **Dopočet „Mezera od zdi" počítá s jiným číslem než 3D.**
   `prototyp/params.js:746` počítá `hloubkaHerdbloku − ustoupeniPanelu −
   hloubkaPodestavby` = 850 − 25 − 670 = **155**, ale skříňka je posazená podle
   `presahDeskyVpredu` 30, takže reálně vychází **150**. Popisek
   „(hloubka − ustoupení − 670)" je věcně vedle. `SPEC-HERDBLOK.md` §7.0 a §12
   navíc drží starý vzorec s 15, který dá 165.
3. **Tloušťka bočního krytu má v `HODNOTY-MONO.md` tři různé hodnoty:**
   JSON `tloustkaBocnihoKrytu: 40`, text §2 „standardně **50** mm silný"
   (u vlny i zkosené vlny), a §6 bod 1 tvrdí, že text říká **20**.
   **Bod §6/1 je zastaralý vůči §2 téhož dokumentu** — spor tedy není 40 vs. 20,
   ale **40 vs. 50**.
4. **§6 bod 2 (výška krytu 750 vs. 460) není skutečný rozpor.** 750 je celková
   výška krytu od nožiček nahoru (`prototyp/params.js:594–596`), 460 je jen jeho
   část pod herdblokem (750 − 290). Obojí platí zároveň. Otevřená zůstává jen
   otázka, jestli má kryt sahat po nožičky, nebo jen po tělo skříňky.
5. **`zakonceniVlnaR3` má hodnotu 2, ne 3.** Prototyp má v definici 3
   (`params.js:257`), uživatel odeslal 2. Na vzhled to nemá vliv (≤ 5 mm se
   ignoruje), ale číslo v závazném dokumentu neodpovídá svému názvu ani
   `SPEC-HERDBLOK.md` §4.3.
6. **Popisek dopočtu panelu je zastaralý:** „Výška ovládacího panelu (290 − 40)"
   při čele desky 50. Hodnota 240 je správná, vzorec v závorce ne.
7. **Rozměr nožičky v kódu není konstanta.** `js/mono-geometry.js` počítá
   `legSize = min(WALL_MM*2, w*0,08, d*0,08, 60)`; pro 800 × 670 vyjde náhodou
   40, u užší skříňky se zmenší. HODNOTY mají pevných 40.
8. **Odsazení nožičky od rohu.** HODNOTY 50; kód počítá `inset = legSize/2 + 10`
   = 30 (střed), tedy líc nožičky 10 od hrany.
9. **Podlážka 40 je v kódu mrtvá konstanta** — `FLOOR_MM` se nikde nepoužívá,
   podestavba je plný box.
10. **`END_TYPES` v kódu drží zrušené názvosloví** (`vlna` / `zkosena-vlna` /
    `zaoblena-hrana`) podle `SPEC-HERDBLOK.md` §4.3.
11. **Síla plechu korpusu 1,5 a síla plechu desky 2 v kódu chybí** — tělesa jsou
    plná. Autor to přiznává v hlavičce.
12. **`COLLAR_THICKNESS_MM = 3`** v kódu je autorský odhad označený
    „k odsouhlasení"; HODNOTY dávají `tloustkaPlechuLimce: 20`.

---

## 10. Pasti při ověřování — STÁLY NEJVÍC ČASU

### Server

V `.claude/launch.json` jsou dvě konfigurace:

| Název | Co dělá |
|---|---|
| `alba-server` | spustí `python -m http.server 8000` |
| `alba-konfigurator` | jen se připojí na `http://localhost:8000` (server už musí běžet) |

**Server spouštěj přes `preview_start` se jménem `alba-server`.** Nespouštěj
vlastní proces přes Bash. Pokud port 8000 už drží uživatelův Python,
**nezabíjet** — použij `alba-konfigurator`.

### Cache prohlížeče

`python -m http.server` neposílá hlavičky proti kešování. **Před KAŽDÝM ověřením
vynuť znovunačtení modulů:**

```js
(async()=>{ const l=document.querySelector('link[rel=stylesheet]');
  await fetch(l.getAttribute('href').split('?')[0],{cache:'reload'});
  for (const f of ['js/main.js','js/ui.js','js/viewer.js','js/i18n.js',
                   'js/floorplan.js','js/report.js','js/catalog.js',
                   'js/mono-geometry.js'])
    await fetch(f,{cache:'reload'}).catch(()=>{});
  location.reload(true); })()
```

### Browser pane má tři konkrétní omezení

1. **Akce `key` doručí PRÁZDNOU klávesovou událost** (`key:""`, `which:0`).
   Enter ani Escape se přes ni testovat nedají — vysílej `KeyboardEvent` přes
   JS. Akce `type` naopak funguje spolehlivě.
2. **Syntetické `MouseEvent` na `#three-canvas` výběr NEVYVOLAJÍ.** Když
   potřebuješ vybrat segment, klikni na kartu v pásu.
3. **Screenshoty jsou zkreslené** a ořez (`zoom` s `region`) nefunguje.
   **Měření přes `javascript_tool` je autoritativní.**

### Kontrast se musí počítat se skládáním alfy

Naivní porovnání `color` proti `backgroundColor` u poloprůhledného pozadí dává
nesmysly — dvakrát to vedlo k falešnému hlášení vady. Recept je v
`ZADANI-UI.md` §5.

### `overflow-x: auto` povýší i svislou osu

Prohlížeč druhou osu povýší taky na `auto`. Kvůli tomu se ořízla špička pod
vybranou kartou a dřív i rozbalovací nabídka jazyka. **Ořez probíhá až na hraně
padding-boxu**, takže co je uvnitř odsazení, přežije.

### localStorage

Klíče: `alba-katalog-v1`, `nerez-blok-config-v3`, `alba-jazyk`.
**`localStorage.clear()` shodí jazyk na `en`**, takže české kontrolní řetězce
pak nic nenajdou. Jazyk přepínej přes:

```js
const i = await import('./js/i18n.js'); i.setLang('cs');
```

### Nespouštět

- **`window.print()` nespouštěj.**
- **Na „Uložit konfiguraci" neklikej naslepo** — otevře systémový dialog
  a stáhne uživateli soubor.
