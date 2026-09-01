# ZADÁNÍ — dvě opravy: zrcadlení strany B a sokl jen pod skříňkami

Závazná smlouva rozhraní. Dvě NEZÁVISLÉ vady nahlášené zadavatelem
1. 9. 2026. Pracují dva agenti souběžně, **rozdělení po souborech**
(disjunktní, nikdy nesmí psát do téhož souboru):

- **Agent M (vada 1, zrcadlení):** `js/mono-layout.js`, `js/mono-block.js`,
  `js/mono-ui.js`
- **Agent S (vada 2, sokl):** `js/mono-geometry.js`, `js/block.js`

**Nikdo nesahá na:** `js/main.js`, `js/modules.js`, `js/i18n.js`,
`js/report.js`, `js/floorplan.js`, `js/ui.js`, `css/style.css`,
`index.html`. Žádné nové soubory v `js/`.

---

# VADA 1 — strana B ostrova se ve 3D staví zrcadleně (Agent M)

## Co hlásí zadavatel

> „Strana B Herdbloku se staví zleva ve schématu spodní lišty, ale zprava
> ve vizualizaci. Chci to stavět zleva i ve vizualizaci."

## Příčina — ZMĚŘENO, nehledej ji znovu

Adaptér `mono-block.js` na stranu B **záměrně neaplikuje `mirrorX`** a
spoléhá na to, že se celá podskupina otočí o 180° kolem Y. Jenže s otočením
bloku se otáčí i **kamera** (`views.perspectiveB`/`backB`/`topB`), takže se
zrcadlení projeví na obrazovce.

Naměřeno promítnutím bodů přes kameru z `computeViews()` (blok 3200,
vystředěný, world X −1600..+1600):

| | world X −1600 | world X +1600 |
|---|---|---|
| pohled na stranu A | NDC **+0,557** (vpravo) | NDC **−0,395** (vlevo) |
| pohled na stranu B | NDC **−0,395** (vlevo) | NDC **+0,557** (vpravo) |

Přístroje strany B zadané v pásu na x 0–1200 vyšly na world X **439..1561**
(kladná část) → při pohledu na stranu B se objeví **vpravo**. Přesně to
hlásí zadavatel.

## Rozhodnutí — jak to má být

**Souřadnice strany B se měří OD JEJÍHO VLASTNÍHO LEVÉHO KRAJE**, tedy tak,
jak blok vidí člověk stojící u strany B. Z toho plyne obojí:

1. **Obsah strany B se zrcadlí stejně jako strana A** (položky ve 3D pak
   jdou zleva doprava ve stejném pořadí jako v pásu).
2. **Strana B má PROHOZENÉ koncové typy.** Strip x = 0 strany B leží na
   FYZICKY OPAČNÉM konci bloku než strip x = 0 strany A. Ten konec je řízený
   `rightEndType`. Bez prohození by skříňky strany B seděly u konce se
   zatažením toho druhého konce (50 vs 70) — to by byla NOVÁ vada zavlečená
   touhle opravou.

`leftEndType`/`rightEndType` **zůstávají SDÍLENÉ jedno úložiště** ve
`state.mono` (nic se nepřejmenovává, formát souboru se nemění). Prohození je
jen ČTECÍ pravidlo pro stranu B.

## §1.1 `js/mono-layout.js`

`computeMonoLayout(state, side)`: pro `side === 'B'` se prohodí, který
uložený typ konce řídí LEVÝ a PRAVÝ kraj pásu:

```
strana A: levý kraj ← leftEndType,  pravý kraj ← rightEndType
strana B: levý kraj ← rightEndType, pravý kraj ← leftEndType
```

Tedy `leftInsetMM = sideInsetMM(<typ levého kraje pro tuhle stranu>)`,
obdobně `rightInsetMM`. Vše ostatní (`usableFromMM`, `usableToMM`,
`layoutSequential`, `missingMM`, ořez `panelItems`) se počítá **beze změny**
z těchto už prohozených hodnot — žádné další úpravy nejsou potřeba.

Do návratového objektu **PŘIBUDOU dvě pole** (aby si je UI nemuselo
odvozovat samo a pravidlo žilo na jednom místě):

- `leftEndType` — typ konce, který řídí LEVÝ kraj pásu TÉHLE strany
- `rightEndType` — totéž pro pravý kraj

Nic ze stávajících polí se neodebírá ani nepřejmenovává.

`computeMonoChecks(state, side)` musí `herdblokUsek.leftEndType/rightEndType`
brát **ze stejného prohozeného pravidla** (nejjednodušeji z layoutu, který si
už stejně počítá), aby převis vlevo/vpravo hlásil pro stranu B tu stranu,
kterou uživatel v pásu vidí.

## §1.2 `js/mono-block.js`

- Na `podestavbyB` se nově **aplikuje `mirrorX(xMM, lengthMM, widthMM)`**,
  stejně jako na `podestavbyA`.
- Na `panelItemsB` se nově aplikuje **bodové** `mirrorX(xMM, lengthMM)`
  (bez šířky), stejně jako na `panelItemsA`.
- Přístroje osazované na desku strany B (druhé volání `applyTopFeature()` +
  `renderControls()`) se zrcadlí **stejným způsobem jako u strany A** — najdi
  si, jak to dělá větev strany A, a použij totéž.
- **Úsek herdbloku strany B se NEMĚNÍ.** Jeho `leftEndType`/`rightEndType`
  zůstávají přesně jak jsou dnes (nezaměněné): určují FYZICKÝ tvar konců
  bloku, ten se nikam neposunul a zadavatel si na tvar konců nestěžoval.
  **Tohle je nejsnazší místo, kde tenhle úkol pokazit — nesahej na to.**
- Přepiš komentáře a JSDoc, které dnes tvrdí, že se na stranu B `mirrorX`
  NEAPLIKUJE a proč („dvojí zrcadlení by se vyrušilo špatným směrem") — po
  téhle opravě to neplatí. Zdůvodnění nového stavu: rotace o 180° otáčí
  i kameru, takže bez zrcadlení nesouhlasí pořadí na obrazovce s pásem.

## §1.3 `js/mono-ui.js`

`buildEndcap(side, monoState)` čte dnes napevno
`monoState.leftEndType`/`rightEndType`. Nově musí kreslit profil podle
**typu platného pro AKTUÁLNÍ STRANU** (nová pole z layoutu, §1.1) — u strany
B tedy levá koncovka ukáže profil `rightEndType` a naopak.

Kliknutí musí přepnout **ten uložený typ, který daná koncovka ukazuje**:
u strany B levá koncovka mění `rightEndType`, pravá `leftEndType`. Callback
`onMonoEndTypeChange(side, next)` se **NEMĚNÍ** (main.js na něj nesmíš
sahat) — posílá se do něj `'left'`/`'right'` podle toho, které ULOŽENÉ pole
se má změnit, ne podle toho, na které straně obrazovky koncovka leží.

Poznámka `mono.endZoneNote` a popisky koncových zón musí hlásit hodnoty
platné pro aktuální stranu — vyjde samo, když se čtou z layoutu.

## §1.4 Co se NEDĚLÁ

- Ramena a límce jsou SDÍLENÉ (v pásu nemají přepínač stran) — jejich
  chování ani zrcadlení **se nemění**.
- Formát uloženého souboru se nemění, klíče se nepřejmenovávají.
- Varianta `single` se nesmí změnit ANI O PIXEL — u ní je strana vždy 'A'
  a všechna nová pravidla musí vyjít na dnešní chování.

---

# VADA 2 — sokl má být jen pod skříňkami (Agent S)

## Co hlásí zadavatel

> „Sokl má být jen pod skříňkami."

## Dnešní (vadný) stav

`buildBlockPlinth()` staví soklový rám / zástěnu **po obvodu CELÉHO
půdorysu bloku** — `js/mono-geometry.js` ř. 1339 (MONO) a `js/block.js`
ř. 173 (SEGMENT). Sokl tak běží i tam, kde žádná skříňka není (volný
prostor, nedoplněný zbytek řady), a u ostrova i přes celou kombinovanou
hloubku.

## Rozhodnutí — jak to má být

Sokl (typy `construction` a `legs_plinth`) se staví **jen pod souvislými
úseky skříněk**, ne po obvodu bloku:

- Sousedící skříňky (dotýkají se, tolerance 0,5 mm) tvoří **jeden souvislý
  úsek** a dostanou jeden společný sokl.
- **Mezera (`gap`) úsek ROZDĚLÍ** — pod mezerou žádný sokl není.
- Kde nejsou žádné skříňky, sokl se nekreslí vůbec.
- **Uskočení `PLINTH_INSET_MM` (50) platí ze všech stran** — nově se ale
  měří **od líců SKŘÍŇEK toho úseku**, ne od obrysu bloku.
- **Výška, materiál, tloušťka plechu i jména těles zůstávají** jak jsou
  (`sokl-ram` / `sokl-zastena`, `sokl-predni`/`sokl-zadni`/`sokl-levy`/
  `sokl-pravy`). Jmen se drž — přejímka je hledá podle nich.
- **Pravidlo zadní stěny zůstává beze změny:** `construction` má zadní
  stranu vždy, `legs_plinth` ji u varianty `single` vynechává a u `island`
  má. Nově se ale aplikuje **na každý úsek zvlášť**.
- Typy `building` (nic) a `legs` (jen nožičky per skříňka) se **nemění**.

## §2.1 `js/mono-geometry.js`

- `buildBlockPlinth()` přepiš tak, aby místo `lengthMM`/`depthMM` dostalo
  **seznam skříněk jedné řady** (položky mají `xMM`, `widthMM` a nepovinné
  `depthMM`) a postavilo sokl pro každý souvislý úsek. Hloubka úseku se bere
  ze skříněk (`depthMM`, jinak `PODESTAVBA_DEPTH_MM`); z-rozsah skříňky je
  `DESK_OVERHANG_FRONT_MM` až `DESK_OVERHANG_FRONT_MM + depthMM`. Vrací
  jednu skupinu se všemi úseky, nebo `null`, když není co stavět.
- V `buildMonoBlock()`:
  - **strana A** dostane sokl ze svého pole podestaveb, ve své (hlavní)
    skupině — přesně tam, kde se dnes volá `buildBlockPlinth`;
  - **strana B** (jen `island`) dostane **vlastní sokl ze svého pole
    podestaveb, postavený UVNITŘ otočené podskupiny strany B**, aby se
    zrcadlil spolu s ní. Nestav ho v hlavní skupině.
- Řady A a B mají nezávislé skříňky, takže se sokly **nespojují** — každá
  řada má svůj.

## §2.2 `js/block.js` (SEGMENT)

Totéž pravidlo, minimální zásah: sokl už nesmí běžet přes celou délku
bloku, ale **jen pod souvislým úsekem segmentů**. Hloubkové chování
SEGMENTu **neměň** (segmenty jdou přes celou hloubku bloku, sokl tedy
zůstává na dnešním z-rozsahu) — mění se **jen rozsah v ose X**, aby sokl
končil tam, kde končí řada segmentů. Runs odvoď z rozvržení segmentů, které
`block.js` už má; nic si nedopočítávej odjinud.

## §2.3 Co se NEDĚLÁ

- Nožičky (`legs`) se nemění — ty jsou per skříňka a řeší je jinde.
- Výška soklu, jeho uskočení (50) ani materiál se nemění.
- Nesahej na `modules.js` (`PLINTH_TYPES`, `buildPlinth`).

---

# §3 Společná pravidla pro oba agenty

- Komentáře česky, ve stylu a hustotě okolního kódu. U každého nového
  pravidla napiš i PROČ, ne jen co.
- **Žádné těleso se zápornou souřadnicí z**, žádné dva dílce ve stejné
  rovině (z-fighting).
- Po dokončení `node --check` na každý editovaný soubor.
- Scratch soubory jen do vlastní podsložky ve scratchpadu, nic cizího
  nepřepisovat.
- **Neměř v prohlížeči, nespouštěj server** — přejímku dělá koordinátor.
- Do výstupu napiš seznam změn po souborech a **výslovně každé místo, kde
  ses od zadání odchýlil, a proč** (ideálně žádné). Když ti něco v zadání
  nesedí s kódem, **NEOPRAVUJ to podle svého — ohlas to** (jako se to
  osvědčilo u konstanty `FLOOR_MM`).
