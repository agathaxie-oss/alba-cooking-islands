# Zadání geometrie RM / Lotus (vlna 1)

Cíl: procedurální `topFeature` na desce přesně dle jmenovitých rozměrů a vzhledu nových RM/Lotus položek. Karty/fotky katalogu řeší jiná větev — zde jen 3D geometrie.

Zdroje: `katalog/polozky/al-*.json`, RM B2B / produktové texty v JSON, card fotky v `img/pristroje/*-card.webp`, stávající `js/modules.js` (`applyTopFeature` ← `createSegmentMesh`).

---

## Stávající stavba (shrnutí)

| `topFeature.type` | Builder | Co kreslí |
|---|---|---|
| `burners4` | `buildGasStoveTop` | 4 litinové hořáky 2×2, absolutní mřížky 390×360 (středy ±W/4 × pitchZ) |
| `ceramic4` | `buildCeramicTop` | sklo 750×770 + 4 duální zóny Ø220 (absolutní) |
| `induction` | `buildInductionTop` | 1 zóna ~400×400 |
| `fryer2` | `buildFryerTop` | 2 vany absolutní mm z `topFeature` (148×350 / 220×350) + koš/víko |
| `fryer1` | `buildFryer1Top` | 1 vana proporční (absolutní až později — F10D-64ET) |
| `grill` | `buildGrillTop` | plocha absolutní mm (`cookArea*` 680×760) + ½ rýhovaná/½ hladká + sběr tuku |
| … | bainmarie / multipan / sink | — |

`createSegmentMesh` → u `topFixed` kreslí prvek ve **jmenovité** `widthMM`, hloubka = hloubka řady (SEGMENT). Dispatcher: `applyTopFeature`. Registry: `TOP_FEATURE_TYPES` (`device-manager.js`), i18n `topFeature.*`, floorplan 2D, paleta ikon (`ui.js`).

**Katalogová data (mimo 3D):** u sporáků/plotýnek je v `katalog/polozky/*.json` pole **`zones`**
(`{ powerKW, fuel }[]`) — výkony jednotlivých hořáků/zón v pořadí RM zón 1…N
(`burners2` / `burners4` / `ceramic4` / `induction`). UI katalogu je vypisuje v detailu;
geometrii `modules.js` **nemění**. Viz `ZADANI-KATALOG.md` §3.3.

---

## 8 produktů — návrh geometrie

### 1) `al-pg13-400-g` — PCD-64G (řada 700)

| | |
|---|---|
| Jmenovité (web/JSON) | 400 × 600 × 110 mm; 2 litinové hořáky 7.5 / 5.5 kW; cutout hloubka 700 |
| Na desce musí být vidět | 2 hořáky **za sebou** (přední/zadní), vystředěné v šířce 400 mm; litinová mřížka; 2 knoflíky na panelu (už `controls`) |
| Navržený typ | **`burners2`** (nový) |
| Parametry / půdorys | mřížka: v JSON u PCD-84G je 390×360 mm; u PCD-64G **není v datech** → viz K OVĚŘENÍ níže. Rozteč středů hořáků ≈ hloubka jedné mřížky (cíl ~360 mm), clamp podle `depthM` |
| Znovupoužití | materiály + mesh recept hořáku z `buildGasStoveTop` |
| Nové | layout 1×2, absolutní měřítko mřížky 390×360 (ne ±0.25·W) |

**K OVĚŘENÍ:** přesný rozměr mřížky PCD-64G (řada 700 může mít drátěný/kulatý rošt — viz fotka/web). Do doby ověření použito 390×360 jako u řady 900 (odhad ze sesterského PCD-84G / RM).

### 2) `al-pg11-400-g` — PCD-84G (řada 900)

| | |
|---|---|
| Jmenovité | 400 × 800 × 110 mm; 2 hořáky 7 / 4 kW; **mřížka 390 × 360 mm** (RM + JSON); cutout 900 |
| Na desce | stejné jako #1, větší hloubka řady → větší mezera okolo |
| Typ | **`burners2`** (stejný builder) |
| Znovupoužití / nové | jako #1 |

### 3) `al-pg22-800-g` — PCD-68G (řada 700)

| | |
|---|---|
| Jmenovité | 800 × 600 × 110 mm; 4 litinové hořáky 7.5 / 5.5 / 5.5 / 3.5 kW; cutout 700 |
| Na desce | 4 hořáky 2×2; vizuálně = dva bloky `burners2` vedle sebe (fotka `_test-pg22.jpg` / card) |
| Typ | stávající **`burners4`** + absolutní mřížky 390×360 (2×2) |
| Znovupoužití | materiály + `addCastIronBurner` / `resolveCastIronBurnerLayout` (sdílené s burners2) |
| Nové (vlna 2) | absolutní rozteč dle mřížek; layout = 2 sloupce × 2 řádky |

### 4) `al-pg28-800-g` — PCD-88G (řada 900)

| | |
|---|---|
| Jmenovité | 800 × 800 × 110 mm; 4 hořáky 10 / 7 / 7 / 4 kW; mřížka **390 × 360 mm**; cutout 900 |
| Typ | **`burners4`** + absolutní mřížky (stejný builder jako pg22) |
| Pozn. | stejný builder jako pg22, jiné rozměry řady |

### 5) `al-cer14-800-e` — PCCD-88ET

| | |
|---|---|
| Jmenovité | 800 × 800 × 50 mm; sklo **750 × 770** mm; 4 zóny 4×3.4 kW |
| Na desce | sklokeramická plocha + 4 duální kruhové zóny (fotka) |
| Typ | stávající **`ceramic4`** — absolutní layout |
| Nové (vlna 5) | sklo 750×770; Ø zón **220 / 140** (odhad z fotky — RM neuvádí Ø); středy FL/FR/BL/BR |

### 6) `al-gr15-800-e` — FTLRD-88ET

| | |
|---|---|
| Jmenovité | 800 × 800 × 220 mm; deska 800×800 / tl. 14 mm; **grilovací plocha 680 × 760 mm**; kombinace hladká/rýhovaná |
| Na desce | kombinovaná plocha (½ hladká / ½ rýhovaná), sběr tuku |
| Typ | stávající **`grill`**, parametry `cookAreaWidthMM: 680`, `cookAreaDepthMM: 760`, split vlevo rýhovaná / vpravo hladká |
| Znovupoužití | základ `buildGrillTop` |
| Nové | jmenovitá plocha 680×760 + kombinovaný povrch (fotka card) |

### 7) `al-fr88-400-e` — F2/8D-64ET

| | |
|---|---|
| Jmenovité | 400 × 600 × 460 mm; 2 vany **8+8 l**; vana **148 × 350 × 327 mm**; koše 120 × 300 × 150 mm |
| Na desce | 2 úzké vany vedle sebe + koše/víka |
| Typ | **`fryer2`** s parametry jmenovitých van (ne `widthM * 0.42`) |
| Znovupoužití | struktura `buildFryerTop` |
| Nové | absolutní `vatWidthMM/vatDepthMM` (148×350) |

### 8) `al-fr1010-600-e` — F2/10D-66ET

| | |
|---|---|
| Jmenovité | 600 × 600 × 390 mm; 2 vany **10+10 l**; vana **220 × 350 × 230 mm**; koše 200 × 300 × 100 mm |
| Typ | stejný **`fryer2`** s jinými parametry van (220×350) |
| Pozn. | jeden builder, data z JSON / `topFeature` |

---

## Znovupoužití vs nové (souhrn)

| Potřeba | Rozhodnutí |
|---|---|
| 2hořák 400 mm | **NOVÉ** `burners2` |
| 4hořák 800 mm | znovu `burners4` + absolutní mřížky 390×360 (vlna 2) |
| Sklokeramika 4 | znovu `ceramic4` + absolutní sklo 750×770 / Ø220 (vlna 5) |
| Gril kombinovaný | znovu `grill` + parametry plochy |
| Fritézy 8+8 / 10+10 | znovu `fryer2` + absolutní vany |
| Litinový hořák mesh | sdílený helper z `burners4` |

---

## Pořadí implementace

1. **`burners2`** — PCD-64G / PCD-84G (**schváleno #1**)
2. Doladění **`burners4`** na absolutní mřížky 390×360 (pg22, pg28) (**schváleno #2**)
3. **`fryer2`** absolutní vany (F2/8D, F2/10D) (**schváleno #3**)
4. **`grill`** 680×760 + kombinovaný povrch (**schváleno #4**)
5. **`ceramic4`** průměry/pozice zón dle fotky (PCCD-88ET) — **tato vlna, ke schválení #5** (poslední z 8)
6. Volitelně **`fryer1`** absolutní vana F10D-64ET (220×350) — mimo 8, stejný helper

---

## Ke schválení #1 — `burners2`

### Implementace (hotovo v kódu)

- `js/modules.js`: `buildGasStove2Top` + `case 'burners2'` v `applyTopFeature`
  - 2 hořáky na ose X=0, přední/zadní
  - cílová mřížka **390 × 360 mm** (katalog PCD-84G / RM)
  - rozteč středů = `min(360 mm, dostupná hloubka − okraje)`; okraje min. 20 mm od čela/zadu
  - měřítko hořáku odvozeno od mřížky (ne od ±0.25·šířky)
- `js/device-manager.js`: `TOP_FEATURE_TYPES` + `burners2`
- `js/i18n.js`: `topFeature.burners2` (en/de/pl/cs/sk)
- `js/ui.js`: ikona palety 2 hořáky
- `js/floorplan.js`: 2D kresba 2 kruhů
- JSON: `al-pg11-400-g`, `al-pg13-400-g` → `"topFeature": { "type": "burners2" }`

### Ověření 3D (SEGMENT)

Měření `THREE.Box3` nad meshi `buildGasStove2Top` (stejná logika jako v `modules.js`), jmenovitá šířka 400 mm, hloubka = cutout řady. Pomocná stránka: `verify-burners2.html` (localhost).

| Položka | Očekávání | Naměřeno |
|---|---|---|
| `al-pg11-400-g` (PCD-84G, D=900) | mřížka 390×360; 2 hořáky za sebou; bbox ≤ 400×900 | mřížka **390×360**, pitch **360**, středy Z **270 / 630** mm; Box3 X×Z **342 × 702** mm; Z rozsah **99–801** (vejde se); `fitsWidth/Depth` OK |
| `al-pg13-400-g` (PCD-64G, D=700) | 2 hořáky; clamp ať nepřeteče 700 | mřížka **390 × 338.5** (hloubka zmenšena fit algoritmem), pitch **338.5**, středy **181 / 519**; Box3 **322 × 660** mm; Z **20–680**; OK |

Pozn.: vizuální šířka kříže (tyče = 0.95·min stran) je ~342 mm uvnitř jmenovité mřížky 390 mm — záměr, ať kříž nepřesahuje obdélník mřížky. Plný rámeček 390×360 lze doplnit později.

**Schváleno** Jaroslavem (burners2 OK) → vlna 2.

**K OVĚŘENÍ (neblokuje):** typ mřížky PCD-64G (drát vs litina); zda 390×360 platí i pro řadu 700.

---

## Ke schválení #2 — `burners4` absolutní mřížky

### Implementace (hotovo v kódu)

- `js/modules.js`:
  - společný `resolveCastIronBurnerLayout(widthM, depthM, columns)` — jmenovitá mřížka **390 × 360 mm**, okraj 20 mm, fit hloubky jako u burners2
  - `buildGasStoveTop` (burners4) = `columns=2` (středy X ±200 mm na šířce 800)
  - `buildGasStove2Top` refaktor na stejný helper (`columns=1`)
  - vizuál beze změny: litinový kříž přes `addCastIronBurner`
- JSON: `al-pg22-800-g`, `al-pg28-800-g` — `geometryNotes` aktualizovány
- Pomocná stránka: `verify-burners4.html` (localhost)

### Ověření 3D (SEGMENT)

Měření `THREE.Box3` nad meshi 4× `addCastIronBurner` (stejná geometrie jako `buildGasStoveTop`), jmenovitá šířka 800 mm, hloubka = cutout řady.

| Položka | Očekávání | Naměřeno |
|---|---|---|
| `al-pg28-800-g` (PCD-88G, D=900) | 4× mřížka 390×360; 2×2; bbox ≤ 800×900 | mřížka **390×360**, pitchZ **360**, středy X **−200 / +200**, Z **270 / 630**; Box3 X×Z **742 × 702** mm; X **−371…371**, Z **99–801**; `fitsWidth/Depth` OK |
| `al-pg22-800-g` (PCD-68G, D=700) | 2×2; clamp ať nepřeteče 700 | mřížka **390 × 338.5**, pitchZ **338.5**, středy X **±200**, Z **180.8 / 519.2**; Box3 **721.5 × 660** mm; X **−360.8…360.8**, Z **20–680**; OK |

Pozn.: Z layout je shodný s burners2 na stejné hloubce řady (dva bloky vedle sebe). Vizuální kříž je menší než jmenovitý obdélník mřížky (0.95·min stran) — stejný jazyk jako burners2. Fotka `_test-pg22.jpg` ukazuje drátěné podélné rošty po sloupcích; 3D záměrně zůstává u litinového kříže (schválený jazyk vlny 1).

**Schváleno** Jaroslavem (burners4 2×2 absolutní OK) → vlna 3.

---

## Ke schválení #3 — `fryer2` absolutní vany

### `al-fr10-400-e` (fryer1) — mimo tuto vlnu

Jednovaná F10D-64ET má v JSON vanu **220 × 350** (stejná jako jedna vana F2/10D), ale typ je `fryer1` a není v seznamu 8 produktů vlny 1–3. **Nechat na později** (po schválení #3 / mezi vlnou 4 a ceramic): sdílet `resolveFryer*Layout` + absolutní mm, střed X=0.

### Implementace (hotovo v kódu)

- `js/modules.js`: `resolveFryer2Layout` + `buildFryerTop(…, feature)`
  - vany z `topFeature.vatWidthMM/vatDepthMM` (fallback proporční pro vlastní přístroj)
  - koše z `basketWidthMM/basketDepthMM` (clamp uvnitř vany)
  - 2 vany vedle sebe; zbývající šířka ÷ 3 → 2 okraje + mezera (min. 20 mm)
  - `userData.featurePart = fryerVat|fryerBasket|fryerLid`
- `js/catalog.js`: `normalizeTopFeature` propouští `vatWidthMM`, `vatDepthMM`, `basketWidthMM`, `basketDepthMM` (+ `cookArea*` pro vlnu 4)
- JSON:
  - `al-fr88-400-e` → vany **148 × 350**, koše **120 × 300**
  - `al-fr1010-600-e` → vany **220 × 350**, koše **200 × 300**
- Pomocná stránka: `verify-fryer2.html` (localhost); screenshot `_test-fryer2.jpg`

### Ověření 3D (SEGMENT)

Měření `THREE.Box3` nad meshi `featurePart=fryerVat` (2 vany), jmenovitá šířka z katalogu, cutout D=700.

| Položka | Očekávání | Naměřeno |
|---|---|---|
| `al-fr88-400-e` (F2/8D-64ET, W=400, D=700) | 2× vana 148×350; bbox ≤ 400×700 | vana **148×350**, koš **120×300**; side/between **34.7 / 34.7**; středy X **±91.3**, Z **350**; Box3 X×Z **330.7 × 350** mm; X **−165.3…165.3**, Z **175–525**; `fitsWidth/Depth` OK |
| `al-fr1010-600-e` (F2/10D-66ET, W=600, D=700) | 2× vana 220×350 | vana **220×350**, koš **200×300**; side/between **53.3 / 53.3**; středy X **±136.7**, Z **350**; Box3 **493.3 × 350** mm; X **−246.7…246.7**, Z **175–525**; OK |

**Co schválit:** absolutní vany 148×350 (400 mm) a 220×350 (600 mm), koše dle katalogu, rovnoměrné okraje/mezera. Až OK → **vlna 4 = `grill` 680×760 + kombinovaný povrch** (FTLRD-88ET).

**Schváleno** Jaroslavem (fryer2 absolutní vany OK) → vlna 4.

---

## Ke schválení #4 — `grill` 680×760 + kombinovaný povrch

### Implementace (hotovo v kódu)

- `js/modules.js`: `resolveGrillLayout` + `buildGrillTop(…, feature)`
  - plocha z `topFeature.cookAreaWidthMM/cookAreaDepthMM` (fallback proporční)
  - vystředěná v šířce i hloubce; okraj min. 20 mm; clamp do desky
  - **vlevo rýhovaná** (7 žeber předozadně), **vpravo hladká** — dle fotky `al-gr15-800-e-card.webp`
  - tl. desky 14 mm; sběr tuku vpředu uprostřed
  - `userData.featurePart = grillCookArea|grillRib|grillTray`
- `js/floorplan.js`: 2D půdorys absolutní plochy + žebra jen vlevo
- JSON: `al-gr15-800-e` → `cookAreaWidthMM: 680`, `cookAreaDepthMM: 760`
- Pomocná stránka: `verify-grill.html` (localhost); screenshot `_test-grill.jpg`

### Ověření 3D (SEGMENT)

Měření `THREE.Box3` nad meshi `featurePart=grillCookArea` (2 poloviny), jmenovitá šířka 800 mm, cutout D=900.

| Položka | Očekávání | Naměřeno |
|---|---|---|
| `al-gr15-800-e` (FTLRD-88ET, W=800, D=900) | plocha 680×760; ½/½; bbox ≤ 800×900 | plocha **680×760**, tl. **14**; X **−340…340**, Z **70–830**; Box3 X×Z **680 × 760** mm; žebra **7** (jen vlevo); `fitsWidth/Depth` OK |

**Co schválit:** absolutní grilovací plocha 680×760, split vlevo rýhovaná / vpravo hladká (fotka), sběr tuku vpředu. Až OK → **vlna 5 = `ceramic4` doladění zón PCCD-88ET** (poslední z 8); volitelně pak `fryer1` absolutní.

**Schváleno** Jaroslavem (grill 680×760 + kombinovaný povrch OK) → vlna 5.

---

## Ke schválení #5 — `ceramic4` absolutní sklo + zóny (PCCD-88ET)

### Implementace (hotovo v kódu)

- `js/modules.js`: `resolveCeramic4Layout` + `buildCeramicTop` (`ceramic4`; alias `buildElectricStoveTop`)
  - sklo z `topFeature.glassWidthMM/glassDepthMM` (katalog **750 × 770** mm dle RM)
  - 4 stejné duální zóny (vnější + vnitřní kruh) — fotka card
  - Ø zóny z `zoneDiameterMM` / `zoneInnerDiameterMM` (**220 / 140** — odhad z fotky; RM neuvádí Ø)
  - středy ve čtvrtinách skla, pořadí **FL, FR, BL, BR**; okraj min. 20 mm; clamp do desky
  - `userData.featurePart = ceramicGlass|ceramicZone|ceramicZoneInner|ceramicResidual`
- `js/catalog.js`: `normalizeTopFeature` propouští `glass*` / `zone*DiameterMM`
- JSON: `al-cer14-800-e` → sklo 750×770, zóny 220/140
- Pomocná stránka: `verify-ceramic.html` (localhost); screenshot `_test-ceramic.jpg`

### Ověření 3D (SEGMENT)

Měření `THREE.Box3` nad meshi `featurePart=ceramicZone` (4 vnější kruhy), jmenovitá šířka 800 mm, cutout D=900.

| Položka | Očekávání | Naměřeno |
|---|---|---|
| `al-cer14-800-e` (PCCD-88ET, W=800, D=900) | sklo 750×770; 4× Ø220; bbox ≤ 800×900 | sklo **750×770**; zóny **Ø220** (inner 140); středy X **±187.5**, Z **257.5 / 642.5**; zone Box3 X×Z **595 × 605** mm; X **−297.5…297.5**, Z **147.5–752.5**; glass Z **65–835**; `fitsWidth/Depth` OK |

**Co schválit:** absolutní sklo 750×770, 4 stejné duální zóny Ø220/Ø140 (odhad z fotky — K OVĚŘENÍ přesného Ø), středy ve čtvrtinách skla FL/FR/BL/BR. Po #5 jsou všechny **8 produktů** vlny 1 hotové ke schválení geometrie (fryer1 mimo 8 volitelně později).

### Stav 8 produktů (po vlně 5)

| # | Produkt | Typ | Stav |
|---|---|---|---|
| 1 | `al-pg13-400-g` PCD-64G | `burners2` | **schváleno #1** |
| 2 | `al-pg11-400-g` PCD-84G | `burners2` | **schváleno #1** |
| 3 | `al-pg22-800-g` PCD-68G | `burners4` | **schváleno #2** |
| 4 | `al-pg28-800-g` PCD-88G | `burners4` | **schváleno #2** |
| 5 | `al-cer14-800-e` PCCD-88ET | `ceramic4` | **ke schválení #5** |
| 6 | `al-gr15-800-e` FTLRD-88ET | `grill` | **schváleno #4** |
| 7 | `al-fr88-400-e` F2/8D-64ET | `fryer2` | **schváleno #3** |
| 8 | `al-fr1010-600-e` F2/10D-66ET | `fryer2` | **schváleno #3** |

---
