# PŘEDÁNÍ — ALBA konfigurátor

Jediný platný předávací dokument. Nahrazuje všechna dřívější předání, která
jsou v `archiv/` a **nemá se do nich chodit** — co z nich bylo živé, je tady.

Referenční soubory, které platí dál: `HODNOTY-MONO.md` (čísla),
`SPEC.md` + `SPEC-HERDBLOK.md` (specifikace), `ZADANI-MONO-UI.md` (smlouva
rozhraní MONO, má známé chyby — viz úkol 8), `ZADANI-KATALOG.md` (samostatný
neřešený úkol), `ZADANI-SOKL.md` (smlouva rozhraní k úkolu 13),
`ZADANI-PODESTAVBY-MONO.md` (smlouva rozhraní k úkolům 14–16),
`mockup-mono.html` (vizuální předloha), `README.md`, `DEPLOY.md`.

Pořadí závaznosti při rozporu: `HODNOTY-MONO.md` → tenhle soubor →
`ZADANI-MONO-UI.md` → `SPEC-HERDBLOK.md` → `SPEC.md` → kód.

---

# ČÁST A — JAK PRACOVAT

## A1. Dělba práce

- **Kód nepiš sám.** Napiš podrobné zadání a předej ho Sonnetu (větší úkoly)
  nebo Haiku (drobnosti). Hlavní agent zadává a kontroluje.
- **Výsledek si vždy ověř sám v prohlížeči.** Agenti opakovaně hlásili úspěch
  tam, kde byla vada. Měření přes `javascript_tool` je autoritativní, ne
  jejich zpráva.
- **Dva agenti nesmí psát do stejného souboru naráz.** Rozděluj práci podle
  souborů, ne podle témat. Když se souborově oddělit nedá, pouštěj po sobě.
- **Napiš agentům závaznou smlouvu rozhraní do souboru** (jako
  `ZADANI-MONO-UI.md`) — bez ní si paralelní práce nesedne. Definuj přesná
  jména funkcí, polí, i18n klíčů a CSS tříd.
- **Vizuální změny nech schválit PŘED implementací.** Kreslit varianty jako
  mockup a nechat vybrat konverguje mnohem rychleji než popis slovy.
- Vše viditelné musí být v **5 jazycích** (en, de, pl, cs, sk).
- Rozhodnutí o rozložení a barvách si nech u sebe, nedelegovat.
- **Mění-li se pravidlo, hledej VŠECHNA místa, kde je zapsané.** Úkol 4
  změnil pravidlo o bočním krytu; agent opravil text v `HODNOTY-MONO.md`,
  ale tabulku o pár řádků níž nechal, takže dokument sám sobě odporoval. Do
  zadání patří „najdi všechna místa v dokumentaci, kde to pravidlo je", ne
  jen „zapiš to".

## A2. Pasti, které opakovaně stály čas

### Keš prohlížeče — NEJČASTĚJŠÍ PŘÍČINA „to nefunguje"

`python -m http.server` neposílá hlavičky proti kešování a **prohlížeč drží
staré ES moduly i po běžném načtení znovu**. Aplikace kreslí starou verzi,
i když server servíruje novou. Před KAŽDÝM ověřením:

```js
(async () => {
  for (const f of ['js/arms.js','js/block.js','js/catalog.js',
                   'js/catalog-browser.js',
                   'js/custom-dialog.js','js/device-manager.js',
                   'js/floorplan.js','js/i18n.js','js/main.js',
                   'js/materials.js','js/modules.js','js/mono-block.js',
                   'js/mono-geometry.js','js/mono-layout.js',
                   'js/mono-prototype.js','js/mono-ui.js','js/report.js',
                   'js/ui.js','js/viewer.js','css/style.css','index.html'])
    await fetch('/'+f, {cache:'reload'}).catch(()=>{});
  location.reload();
})()
```

**Pozor:** Tento seznam je RUČNĚ VEDENÝ. Kdykoli přibude nový soubor v `js/`,
musí se doplnit i sem — jinak se past vrátí. Příznakem neúplného proplchu je
hlášení o chybějícím exportu (např. `SyntaxError: The requested module
'./modules.js' does not provide an export named 'applyTopFeature'`) u modulu,
který ten export prokazatelně má — v takovém případě je první podezřelý
neúplný proplach keše, ne kód.

### Keš, DRUHÁ podoba: `?v=` nebustí VNOŘENÉ importy (1. 9. 2026)

`await import('./js/mono-block.js?v='+Date.now())` načte nově **jen ten
jeden modul**. Jeho vlastní `import './mono-geometry.js'` (bez parametru) se
vezme z **registru modulů stránky**, kde už ta stará verze leží z dřívějšího
importu — takže měříš NOVÝ adaptér nad STAROU geometrií. Ani
`fetch(..., {cache:'reload'})` to nespraví: ten čistí HTTP keš, ne registr
modulů.

Stálo to jedno falešné hlášení „oprava se neprojevila" při přejímce soklu.
**Před měřením přes přímý import vždycky napřed `location.reload()`** (po
proplachu výše), teprve pak importuj. Reload registr modulů vyprázdní.

### Server

`.claude/launch.json` má dvě konfigurace: `alba-server` spustí
`python -m http.server 8000`, `alba-konfigurator` se jen připojí. Spouštěj
přes `preview_start`, nikdy vlastní proces přes Bash. Drží-li port 8000
uživatelův Python, **nezabíjet** — použít `alba-konfigurator`.

### Ověřování geometrie

- **`Box3.setFromObject` na potomka nepřepočítá matice rodičů.** Zavolej
  nejdřív `updateMatrixWorld(true)` na KOŘENOVÉ skupině. Na tohle už jeden
  agent naletěl a nahlásil vadu, která nebyla.
- **Živý graf scény z konzole přečíst nejde.** Geometrii ověřuj přímým
  importem modulu s parametrem proti keši:
  `await import('./js/mono-geometry.js?v='+Date.now())`.
- V Node bez balíčku `three` se `mono-geometry.js` nedá naimportovat — je
  potřeba resolve-hook přes `node --loader` se stubem pro `three`
  a `three/addons/...`.

### Browser pane

- Akce `key` doručí PRÁZDNOU klávesovou událost — Enter/Escape testuj
  vysláním `KeyboardEvent` přes JS. Akce `type` funguje.
- Syntetické `MouseEvent` na `#three-canvas` výběr NEVYVOLAJÍ. Vybírej
  klikem na kartu/dlaždici v pásu.
- Screenshoty fungují, ale **jen když je panel prohlížeče zobrazený**, vracejí
  se zmenšené a ořez (`zoom` s `region`) nefunguje. Na čísla používej měření.
- **Z ořezaného screenshotu neusuzuj na ořez v rozhraní.** Tuhle chybu jsem
  udělal a poslal práci špatným směrem.

### Ostatní

- **Kontrast se musí počítat se skládáním alfy.** Naivní porovnání `color`
  proti `backgroundColor` u poloprůhledného pozadí dvakrát vedlo k falešnému
  hlášení vady.
- **`overflow-x: auto` povýší i svislou osu** na `auto`. Ořez probíhá až na
  hraně padding-boxu.
- **`localStorage.clear()` shodí jazyk na `en`** a české kontrolní řetězce pak
  nic nenajdou. Jazyk přepínej přes
  `const i = await import('./js/i18n.js'); i.setLang('cs');`
  Klíče: `alba-katalog-v1`, `nerez-blok-config-v3`, `alba-jazyk`.
- **Hledání prvku podle textu v DOM je nespolehlivé** — filtruj podle třídy.
- **`window.print()` nespouštěj.** **Na „Uložit konfiguraci" neklikej naslepo** —
  otevře systémový dialog a stáhne uživateli soubor.
- **Jména těles po zrcadlení klamou.** `mono-block.js` zrcadlí osu X, takže
  těleso pojmenované `vodopad-levy` je na obrazovce VPRAVO a límec zadaný
  jako levý se ve scéně jmenuje `limec-right`. Polohy jsou správně, ale kdo
  ladí podle jmen, splete se.
- **Souběžní agenti si přepisují měřicí harness.** Dva agenti si v
  dočasném adresáři založili stejně pojmenované soubory se stubem pro `three`
  a jeden druhému je přepsal. Do zadání patří věta, ať si každý píše harness
  do VLASTNÍ podsložky a nic cizího nepřepisuje.

---

# ČÁST B — KDE TO STOJÍ

Větev `mono-geometrie-a-osa-x` byla smazaná ze serveru i lokálně.
Veškerá práce ze session je na **lokální větvi `main`** — seznam
commitů viz `git log`. Na `origin` **není odesláno nic**. Server
má jedinou větev `main` na `c2efae0`, tedy na stavu před session.
**Pull request nevznikl.**

**Práce probíhá výhradně lokálně: na `origin` ani na
nasazenou aplikaci se nesmí sahat, dokud zadavatel výslovně
neřekne jinak.**

Aplikace je interní a nenasazená, žádná uživatelská data → zpětná
kompatibilita souborů se neřeší. Formát projektu je **verze 6**.

**KATALOG JE SLOUČENÝ DO MAIN (31. 8. 2026).** Fork
`C:\Users\jaroslav.cerny\Documents\Cursor\3d_nerez` (kopie main na
`c77bed6` + etapy katalogu A–E, 10 položek) je vmergovaný přes větev
`katalog` (commit `7df988f` + merge `2088436`); jediný konflikt byl
komentář v `main.js`. Ověřeno po merge: SEGMENT, MONO ostrov,
katalogový prohlížeč (dialog, detail, SVG půdorys, fotky), čistá
konzole. **Složka forku je od teď MRTVÁ — nic v ní neupravovat.**
Stav katalogu popisuje `DOCS-KATALOG.md`; předání forku je v
`archiv/PREDANI-KATALOG-FORK.md` (jeho pravidla o modelech Cursor
u nás neplatí).

## B1. Co je hotové a ověřené

**SEGMENT je plně funkční a nedotčený.** Odznak, obě záložky pásu, karty,
paleta, kapacita, čistá konzole. Ověřeno po všech zásazích.

**MONO má hotové rozhraní:** spodní pás s pěti záložkami (Herdblok,
Podestavby, Čelní panel, Límce, Napouštěcí ramena) nad společným pravítkem,
dráhy úměrné milimetrům, koncovky zakončení jako grafický profil bez textu,
hlášení chybějícího úseku s tlačítkem Doplnit, formulář límců.

Ověřeno měřením: měřítko sedí na setinu (zóna 70 mm → 2,8 %, skříňka
2380 mm → 95,2 %, zóna 50 mm → 2 % při délce 2500), klik na koncovku
přepne typ a přepočítá celý blok, Doplnit dorovná řadu.

**Geometrie MONO** staví herdblok, podestavby, boční kryty, prvky
ovládacího panelu (zásuvky) a límce. Límce leží celé uvnitř půdorysu desky
(ověřeno: přední z 0–20, zadní 830–850, boční x 0–20 a 2470–2490).

**Soubory:** `js/mono-geometry.js` (čistá geometrie), `js/mono-layout.js`
(čistý výpočet rozvržení), `js/mono-block.js` (adaptér stav↔geometrie),
`js/mono-ui.js` (spodní pás), plus větve v `js/main.js`, `js/ui.js`,
`js/i18n.js`, `css/style.css`, `index.html`.

Kreslí se i **napouštěcí ramena** — dřív se nekreslila vůbec, pás měl
plnohodnotnou záložku, ale `main.js` ramena do MONO scény nepředával. Nebylo
to nikde zapsané ani mezi nedodělky. Ramena jdou přes `arms.js` do téže
skupiny jako zbytek bloku. Poloha se zrcadlí přes `mirrorX` a ÚHEL se neguje
— zrcadlením osy X se mění i smysl otáčení kolem Y. Ověřeno: rameno na
`positionXMM 300` vyjde na `x 921..1195`, pata na `y 900` = rovina desky.

## B2. Co je napsané, ale nikdo to neviděl běžet

Poslední vlna oprav (pořadí přidávání, předvyplnění nového projektu, jména
přístrojů, šipky přeuspořádání, odstranění tlačítka „volný prostor" z pásu)
**není ověřená v prohlížeči**. Všechno prochází `node --check`, CSS má
vyrovnané závorky. Práce se přerušila kvůli kreditům.

## B3. Co se vědomě nedělá

- **Přístroje se ve 3D kreslí BEZ VÝŘEZU v desce.** (Opraveno 31. 8. 2026 —
  tenhle bod tu do té doby stál jako „přístroje se ve 3D nekreslí", což už
  od 8. 8. 2026 neplatilo a odporovalo to ČÁSTI B4 i F.) Přístroj sedí na
  rovině desky, deska zůstává celá; osazuje je `mono-block.js` přes
  `applyTopFeature()` + `renderControls()` na OBOU stranách ostrova.
  Výřez je odložený — až se bude dělat, deska se staví z obrysu přes
  `THREE.Shape`, který díry umí.
- **Nástavby nad blokem** (roštová nástavba, police na salamandr) — odloženo.
- **Přestavba katalogu** — samostatný úkol, viz `ZADANI-KATALOG.md`.
- **Logo ALBA ve 3D** se nevykresluje. Diagnóza hotová, oprava odložena na
  pokyn zadavatele.

## B4. Pracovní strom

**Pracovní strom je čistý** (stav k 31. 8. 2026). Do 31. 8. tu stál popis
nezakomitovaných změn v `js/modules.js` a `js/mono-block.js` (osazení
přístrojů na desku) jako NEOVĚŘENÉ — to už dávno neplatí: práce je
zakomitovaná (`77c86b7`), ověřená a popsaná v ČÁSTI B3 a F. Odstraněno,
aby dokument neodporoval sám sobě.

- Dvě poloprůhledné svislé plochy nad rovinou desky jsou **víka fritéz**,
  která staví funkce `buildFryerTop` v `js/modules.js`. Je to správně —
  potvrdil zadavatel 8. 8. 2026. Poznámka je tu jen proto, aby to příště
  nikdo znovu nehlásil jako vadu; **není to nic k řešení.**

---

# ČÁST C — ÚKOLY

Seřazeno podle závažnosti. Jde o jediný závazný seznam.

## 26. Kombinovaný kryt ostrova visel v prázdnu — VADA

**HOTOVO 2. 9. 2026.** Zadavatel po opravě úkolu 25: „U ostrova v MONO tam
mám ten panel v prázdnu pořád." Doložil screenshotem.

**Byla to NEÚPLNÁ oprava úkolu 25.** Ten spravil kryty odvozené od skříněk
(`computeSideCovers`), jenže ostrov staví na X-koncích ještě JEDEN kryt
druhou cestou — v `buildMonoBlock()`, větev `if (isIsland)`, blok „boční
kryty na X-koncích". Ten se stavěl na OBOU koncích přes CELOU hloubku
(`z 0..totalDepthMM`) pod jedinou podmínkou `allWorldPod.length > 0`, tedy
kdykoli existovala aspoň jedna skříňka kdekoli v bloku. Vůbec se neptal,
jestli k danému konci nějaká řada dosahuje.

**Ponaučení pro příště: opravu měřit v OBOU variantách.** Úkol 25 jsem
ověřoval jen na `single` a vada v `island` proto prošla.

Naměřeno před opravou (blok 3200 × 1700, řada A world 50–1650, řada B world
2350–3150): kryty `x 0–50 z 0–1700` a `x 3150–3200 z 0–1700` — vlevo dosahuje
jen A, vpravo jen B, takže druhá polovina obou visela v prázdnu.

Opraveno: každý konec se posuzuje NEZÁVISLE a zvlášť pro každou řadu —
dosahují obě → kryt přes celou hloubku (dnešní chování), jen A → `z 0..depthA`,
jen B → `z depthA..total`, ani jedna → kryt se nepostaví. Tloušťka (THICK/THIN
vč. výjimky u zkoseného konce) se dál odvozuje ze sjednocení obou řad, ta se
nemění.

Ověřeno měřením ve třech sestavách: případ zadavatele → `x 0–50 z 0–850`
a `x 3150–3200 z 850–1700`; obě řady od kraje ke kraji → obojí `z 0–1700`;
obě řady uprostřed → žádný kryt. Varianta u zdi s převisem dál dává jen
`x 0–50` a kontrolní čísla MONO sedí.

## 24. Zarovnání přístroje v segmentu (SEGMENT) — POŽADAVEK

**HOTOVO 2. 9. 2026.** Zadavatel: „pokud je tam jeden přístroj, mít možnost
jej umístit v rámci segmentu vlevo, vpravo nebo doprostřed." Implementováno
podle `ZADANI-ZAROVNANI-PRISTROJE.md` (závazná smlouva, zůstává jako reference).

Nové INSTANCE pole `deviceAlign` ('left'|'center'|'right', výchozí `'center'`)
jen u KATALOGOVÝCH segmentů. `'center'` je dnešní chování, takže starší soubor
se načte beze změny vzhledu. Verze formátu se NEMĚNÍ.

**Platí jen u `def.topFixed === true`** — ty se kreslí v jmenovité katalogové
šířce a dosud se vždy vystředily. U roztažitelných přístrojů se plocha natáhne
na celou šířku, takže není čím pohnout; volba se pro ně nenabízí. Druhá
podmínka: `widthMM > def.widthMM`.

**ZNAMÉNKO (změřeno, neodvozuj znovu):** kladné world X je na obrazovce VLEVO
— první segment v poli má world X 580 a promítá se na NDC −0,218. Proto
`'left'` → `+rozdil/2`. Naměřeno na segmentu 1200 s přístrojem 800: střed
hořáků `center` 80, `left` 280, `right` −120, tedy přesně ±200.

**Posouvají se VŠECHNY TŘI věci, které sdílejí `topWidthM`** — varná plocha,
ovladače i doplňky panelu. Ověřeno porovnáním všech těles: posunuly se
o 200 mm hořáky i všechny 4 knoflíky, zatímco panel, deska a logo ALBA na
panelu zůstaly stát (patří segmentu, ne přístroji).

**Půdorys má vlastní znaménko** — pracuje v souřadnicích kresby, ne ve world X.
Naměřeno: u zdi `center` 1055 → `left` 855 (na stránce doleva, shoda se 3D).
U OSTROVA se strana B chová ZRCADLOVĚ (1458 → 1658, tedy na stránce doprava)
a je to SPRÁVNĚ: její řada je v kresbě otočená, takže „vlevo" z pohledu
obsluhy u strany B je na stránce vpravo. Kdo to „opraví", rozbije to.

**Pozor na past v katalogu:** všechny položky mají `widthAdjustable: false`,
ale to ovlivňuje jen popisek v paletě — šířku segmentu jde v pruhu parametrů
zvětšit až po `CATALOG_WIDTH_MAX`, takže je volba dosažitelná.

## 25. Boční kryt se kreslil do převisu — VADA

**HOTOVO 2. 9. 2026.** Zadavatel: „Když máme převis, tak se tam na konci
kreslí opláštění podestavby. To nedává smysl." Doložil screenshotem.

**Příčina (změřená):** `computeSideCovers()` přidávala kryt na KAŽDÝ odkrytý
boční líc skříňky. U krajní skříňky, která nedosahuje na kraj bloku, tím
vznikl kryt čelem do převisu — panel, za kterým už nic není. Naměřeno na
bloku 3200 s řadou 50–1650: kryty na `0–50` (kraj bloku, správně) a
`1650–1670` (konec řady pod převisem, VADA). Kryt navíc sahá v ose Z 30–850,
zatímco skříňka jen 30–700, takže vyčníval 150 mm za její záda — proto ve 3D
působil jako plachta ve vzduchu.

Opraveno: kryt se nepřidá, když jde o VNĚJŠÍ stranu krajní skříňky, která
není na kraji bloku (`i === 0 && !atEdge`, zrcadlově vpravo). Skříňka zůstává
uzavřená vlastní `bocni-stena`.

**Hloubka krytů 30–850 se NEMĚNILA** — je to vědomé rozhodnutí zadavatele
(ČÁST E, „Vnitřní kryty 20 mm jdou až ke stěně"), ne vada.

Ověřeno měřením ve třech sestavách: převis vpravo → zůstal jen kryt `0–50`;
mezery uprostřed řady → všechny čtyři kryty mezer zůstaly (`850–870`,
`1180–1200`, `2000–2020`, `2330–2350`) i oba krajní; plná řada od kraje ke
kraji → oba krajní kryty beze změny.

## 23. Přepínač stran patří NAD záložky, ne pod ně — POŽADAVEK

**HOTOVO 2. 9. 2026.** Zadavatel: „přepínač stran dole v pruhu nedává moc
logiku, strukturálně by měl být nad řádkem Herdblok – Podestavby… záložkami,
které zasahují do prostoru 3D modelu a neposouvají spodní pruh. Strany jsou
nadřazené svému obsahu."

Vybraná varianta z `mockup-prepinac-stran.html`: **varianta 3** — připojené
záložky se zaoblenými horními rohy, aktivní plnou firemní modrou.

**Tím se RUŠÍ oprava z úkolu 22.** Přepínač už nezabírá výšku pásu, takže se
pás u ostrova vrátil na 268 px a **3D pohled dostal 40 px zpět**. Pravidlo
`#assembly-strip.strip-mono:has(.mono-side-switch)` je smazané, třída
`.mono-side-switch` zanikla.

**Dvě věci, na kterých to stálo — obojí `overflow: hidden`:**
1. `#mono-strip-body` — proto se záložky musely přesunout z panelu do nového
   `#mono-side-tabs`, který leží v `#assembly-strip` mimo něj (index.html).
2. `.assembly-strip` — tohle je past: záložky byly na správných souřadnicích
   a `getBoundingClientRect()` je hlásil nad pásem, ale **nevykreslily se**,
   protože je strop ořízl. Geometrické měření na to NESTAČÍ; odhalil to až
   `document.elementFromPoint()`, který na jejich místě vracel plátno 3D.
   Řeší `overflow: visible` scopnutý na `.strip-mono` — obsah pásu se dál
   ořezává sám, protože `.mono-strip-body` má vlastní `overflow: hidden`,
   a SEGMENT si sdílené pravidlo nechává (ověřeno: má dál `hidden`).

Záložky se ukazují jen u `island` a jen na záložkách s PER-STRANA obsahem
(Herdblok, Podestavby, Čelní panel) — u Límců a Ramen ne, ty jsou sdílené
pro celý blok. Při přepnutí na SEGMENT je schová `ui.js`, protože `mono-ui.js`
už nekreslí a zůstaly by viset nad pásem.

Ověřeno: `elementFromPoint` vrací `mono-side-tab`, přepnutí strany funguje
(odznak palety „do B"), u zdi i SEGMENT schované, SEGMENT má pás i overflow
beze změny, čistá konzole.

## 22. U ostrova odjel pruh parametrů pod okraj obrazovky — VADA

**HOTOVO 2. 9. 2026.** Zadavatel: „když zvolím ostrovní variantu, specifikace
a mazání prvků odjede dole mimo obrazovku."

**Příčina (změřená, nehledej ji znovu):** u ostrova přibývá nad dráhami řádek
`.mono-side-switch` (přepínač Strana A / Strana B, **35 px** i s odsazením),
ale výška pásu byla pevná pro obě varianty (`#assembly-strip.strip-mono`,
268 px). `.mono-strip-body` má `overflow: hidden`, takže se přebytek nedal
ani vyrolovat — pruh parametrů i s košem se prostě uřízl. Naměřeno před
opravou: pruh sahal na **712–731 px** při spodní hraně pásu 720 px, obsah
přetékal o 11 px, koš nebyl vidět a pruh byl navíc smrštěný na 19 px místo
přirozených 47.

**Druhá, skrytá část příčiny:** `.assembly-strip` má `max-height: 45 %`.
Samotné zvýšení `height`/`flex-basis` na 308 px se proto na okně 720 px
ořezalo zpět na 301 px a pole pruhu přetékalo dál — už jen o 1 px, což je
přesně ten druh zbytku, který se okem nenajde. Strop se musel zvednout taky.

Opraveno v `css/style.css` jediným pravidlem
`#assembly-strip.strip-mono:has(.mono-side-switch)` (308 px + `max-height:
48 %`). **Používá `:has()`, takže se pás zvedne jen tehdy, když přepínač
stran opravdu existuje** — žádný příznak v JS, žádná další magická konstanta
a varianta u zdi ani SEGMENT se nemění vůbec. Skutečná výška je
`min(308 px, 48 %)`, takže na malém okně se pás chová jako dřív.

Ověřeno měřením po opravě: ostrov Herdblok i Podestavby → strip 308 px,
ořez 0, pruh v přirozené výšce 47 px, koš i všechna pole uvnitř okna
(710 a 719 ≤ 720). Varianta u zdi → strip zpět na 268 px, ořez 0.

## 21. Půdorys s popisky neumí MONO — VADA + PŘESTAVBA

**HOTOVO 1. 9. 2026.** Implementováno podle `ZADANI-PUDORYS-MONO.md`
(závazná smlouva, zůstává jako reference) ve dvou etapách:

- **etapa 1** — `computeMonoDocModel()` + `buildMonoFloorplanSVG()` ve
  `floorplan.js`, 78 klíčů `mono.doc.*`/`mono.param.*` v 5 jazycích,
  styly karty v `css/style.css`;
- **etapa 2** — větev MONO v `report.js` (popis bloku, společné prvky,
  půdorys, karty po stranách; oddíl ramen se u MONO vynechá, ramena jsou
  mezi společnými prvky).

**`computeMonoDocModel()` je JEDINÝ zdroj pozic a číslování** pro kresbu
i dokument — `report.js` si nic nedopočítává. Polohy bere z
`computeMonoLayout()`, **strana B se v modelu ZRCADLÍ** (`lengthMM − xMM −
widthMM` u ploch, `lengthMM − xMM` u bodových prvků), zatímco fyzické konce
bloku se nezrcadlí nikdy.

Ověřeno měřením: číslování s přeskočením `gap`, zrcadlení strany B
(B1.1 @2730, B2.1 @2330), popisky kót, fotky z katalogu vracejí HTTP 200,
dokument ve všech 5 jazycích, prázdné kategorie se nevypisují, dokument se
otevře v aplikaci, čistá konzole. **SEGMENT beze změny** — jeho dokument má
dál „Základní údaje bloku / Technická specifikace / Soupis dílů / Ramena
a baterie", půdorys vlastní nadpis a popisky ČELO/ZEĎ.

**Dvě vady zachycené až přejímkou** (ne agenty):
- `{n} zón` sedí jen na 5 a víc — čtyřzónová deska hlásila „4 zón".
  Počitatelné údaje s PROMĚNNÝM počtem musí mít tvar bez skloňování
  („počet zón {n}"). U pevných počtů (2 zásuvky, 6 párů vsuvů) to nevadí.
- Desetinná čísla z katalogu (`powerKW: 13.6`) se vkládala syrově, takže
  v češtině vycházelo „13.6 kW". Formátují se podle jazyka: en tečka,
  cs/sk/de/pl čárka; celá čísla bez desetinné části.

Zbytek oddílu popisuje, CO se stavělo a proč — zůstává jako reference.

Původní stav vady:

Zadavatel nahlásil tři věci, které mají JEDNU společnou příčinu:
neukazují se přístroje strany B, neukazuje se konkrétní skříňka, a půdorys
vůbec nerozlišuje podestavbu / přístroj / neutrální plochu.

**Příčina:** `js/floorplan.js` čte `state.segmentsA`/`segmentsB`, tedy datový
model SEGMENTU. O `state.mono.herdblokA/B` ani `podestavbyA/B` neví NIC. To,
co u strany A vypadá správně, je **výchozí řada SEGMENTU**, kterou
`onNewProject()` zakládá i pro MONO — ne uživatelova sestava. Půdorys tedy
pro MONO nekreslí nic z jeho dat; u strany A to jen náhodou vypadá věrohodně.

**Zadavatel dodal vzor ze skutečného projektu** (CAD půdorys varného bloku)
a rozhodl PŘEVZÍT tyhle konvence — jsou závazné:

1. **Přístroje v pravé poloze a velikosti** na desce, včetně odsazení od čela
   — ne schematický pás.
2. **Podestavby čárkovanou čarou** (leží pod deskou, zakrytá hrana).
3. **Zásuvkové bloky s POVYSUNUTÝMI šuplíky** — počet zásuvek musí jít
   spočítat přímo z kresby. **Upřesněno 1. 9. 2026:** zásuvky se kreslí
   VÝHRADNĚ PŘED lícem pracovní desky, tedy MIMO obrys bloku — zásuvkový blok
   nesmí desku překrývat, vidět má být jen to, co je vysunuté. Vztažná hrana
   je obrys bloku, ne líc skříňky. Jedno čelo = jeden pruh.
4. **Podestavby číslované přímo u sebe**, bez odkazové čáry.
5. **Přístroje a napouštěcí ramena na odkazové šipce** vyvedené mimo blok.

**Značení pozic** (rozhodl zadavatel 1. 9. 2026): `A1.x` přístroje, `A2.x`
podestavby, `A3.x` zásuvky a prvky panelu; strana B stejně (`B1.x`…).
**Písmeno H se NEPOUŽÍVÁ** — pletlo by se s typem podestavby. Výpisy jsou
zvlášť pro každou kategorii.

**Orientace kresby:** čelo strany A je DOLE (tak blok vidí obsluha u strany
A), takže řada A běží zleva doprava jako v pásu a **řada B zprava doleva** —
strana B se měří od svého vlastního levého kraje (viz úkol 18).

Mockup: **`mockup-pudorys-mono.html`** (běží bez build kroku, otevřít přes
lokální server). Kreslí ostrov 3200×1700 se všemi pěti konvencemi.

**Struktura dokumentu** (rozhodl zadavatel 1. 9. 2026):

1. **Popis varného bloku** — rozměry, provedení, materiály, popisy zakončení
   a pracovní desky herdbloku.
2. **Soupis společných prvků** značených **S1, S2 …** — tím je zodpovězená
   dřívější otázka: zakončovací plechy, sokl a ramena NEJSOU `A4.x`, mají
   vlastní řadu S. V půdorysu nesou totéž označení.
3. Půdorys.
4. Soupisy prvků podle stran (`A1.x`, `A2.x`, `A3.x`, `B…`).

**Podoba soupisů** (upřesněno 1. 9. 2026 — nahrazuje dřívější tabulku se
sloupci): soupis NENÍ tabulka s hlavičkou sloupců, ale **karta na položku** —
v záhlaví pozice a název, pod tím **fotka vedle popisu**. Fotka tak může být
větší a popis obsáhlejší.

**Podrobný popis se skládá AUTOMATICKY z parametrů položky** (spojené ' · ',
včetně rozměrů a příkonu s připojením). Proto **samostatné sloupce „Rozměry"
a „Příkon" ZANIKLY** — stejně jako dřívější „poloha".

**Fotka:** z katalogu, `img/pristroje/<id>-card.webp` — ověřeno, že jde
o skutečné fotografie 1500 × 1500 px. Podestavby, zásuvky a společné prvky
fotku nemají, dostávají schematickou ikonu.

**POZOR — `<id>-top.svg` v katalogu jsou jen ZÁSTUPNÉ obrázky** (šedý
obdélník s názvem souboru). Pro půdorys se použít NEDAJÍ; symboly přístrojů
v kresbě se musí kreslit vlastní.

**Počet zásuvek — VYJASNĚNO 1. 9. 2026: zůstávají PRÁVĚ 2.** Mockup
dočasně kreslil tři (na ukázku podle projektu zadavatele), ten ale potvrdil,
že dvě stačí. **Úkol 15 tedy platí beze změny**, `MonoCabinet` se nerozšiřuje
a formát projektu se nemění.

**Kóty musí být na OBOU stranách.** V mockupu nejdřív chyběly u strany B
(kótoval se jen řetězec pod blokem) — strana B má vlastní řetězce nad blokem,
v týchž zrcadlených polohách, ve kterých je nakreslená.

**Název prvku nesmí padnout do rámečku pozice.** U odkazů mířících nahoru
se text tiskl dovnitř značky. Odsazení názvu se musí počítat z výšky rámečku,
ne zadat natvrdo.

**Elektrické zásuvky v panelu musí být označené i v kresbě.** Nejdřív měly
jen symbol bez popisu, takže nešlo poznat, která je která — dostávají značku
(`A3.x` / `B3.x`) na krátké odkazové čáře, menší než u přístrojů, protože jde
o bodový prvek. Soupisy A3/B3 byly v dokumentu už předtím. V popisu bloku
je navíc řádek **Elektroinstalace** odkazující na tyto soupisy.

**Další pokyny ke kresbě** (1. 9. 2026):
- Do půdorysu se **kreslí zkosené rohy** bloku (50 × 50 mm pod 45°, u ostrova
  oba rohy zkoseného konce). Zakončovací plech zkosení sleduje.
- **Žádné čerchované čáry** — středová osa ani hranice neutrální pracovní
  plochy se nekreslí, fyzicky nic takového neexistuje.
- **Nepsat „Čelo A / Čelo B"** ani popis orientace.
- Označení pozic **výrazné** (rámeček, tučně).

**Zdroj dat pro příkon:** katalog už má `powerKW`, `voltage` a `gasKW`
(i po zónách u sporáků) — sloupec se z nich naplní. **Podrobný popis katalog
NEMÁ** — buď se doplní jako nové pole položky, nebo se poskládá z toho, co
položka nese. **Zadavatel zatím nerozhodl.**

**Rozsah: jen MONO.** SEGMENT se nechává být (výslovné rozhodnutí zadavatele
1. 9. 2026) — jeho větev ve `floorplan.js` se nesmí změnit.

## 20. Přístroje kolidovaly s bočnicí — VADA

**HOTOVO 1. 9. 2026.** Zadavatel: „Přístroje kolidují s bočnicí (máme dva
typy bočnic)." Týká se JEN produktu MONO — SEGMENT se nechává být
(rozhodnutí zadavatele 1. 9. 2026).

**Příčina (změřená):** `computeMonoLayout()` kladlo řadu herdbloku
`layoutSequential(herdblokItems, 0, lengthMM)`, tedy od nuly přes celou
délku, zatímco podestavby od `usableFromMM` do `usableToMM`. Přístroje tak
zasahovaly do koncových zón, kde je bočnice (nos/vodopád) — přesně proti
poznámce, kterou pás sám pod dráhou zobrazuje. „Dva typy bočnic" jsou dvě
zatažení, která vrací `sideInsetMM()`: 50 mm u vodopádu, 70 mm u zkoseného.

Naměřeno před opravou (blok 3200, přístroj 400 na začátku řady): přístroj
sahal do world X 1571, bočnice začíná na 1550 resp. 1530 → překryv **21 resp.
41 mm**.

Opraveno: herdblok se klade do STEJNÉHO použitelného rozsahu jako
podestavby; `herdblokFreeMM` se počítá z `usableToMM`, ne z `lengthMM`.
Ověřeno měřením: přístroje začínají na 50 resp. 70 a končí 29 mm PŘED
bočnicí, u obou typů zakončení.

## 18. Strana B ostrova se stavěla zrcadleně — VADA

**HOTOVO 1. 9. 2026.** Zadavatel: „Strana B Herdbloku se staví zleva ve
schématu spodní lišty, ale zprava ve vizualizaci. Chci to stavět zleva i ve
vizualizaci."

**Příčina (změřená, nehledej ji znovu):** adaptér na stranu B záměrně
neaplikoval `mirrorX` a spoléhal na otočení podskupiny o 180°. Jenže
s blokem se otáčí i KAMERA (`views.perspectiveB`/`backB`/`topB`), takže se
„vyrušení" projevilo na obrazovce jako obrácené pořadí. Naměřeno
promítnutím: při pohledu na stranu B je kladné world X **vpravo** (NDC
+0,557), zatímco při pohledu na stranu A **vlevo** (NDC −0,395).

Opraveno podle `ZADANI-OPRAVY-B-A-SOKL.md`: **souřadnice strany B se měří od
jejího vlastního levého kraje.** Na `podestavbyB`, `panelItemsB` i přístroje
strany B se nově `mirrorX` aplikuje stejně jako u strany A.

**Důsledek, který je potřeba znát:** strip x = 0 strany B leží na FYZICKY
OPAČNÉM konci bloku než strip x = 0 strany A. Proto `computeMonoLayout` pro
stranu B **prohazuje, který uložený typ konce řídí levý a pravý kraj pásu**
(bez toho by skříňky strany B seděly u konce se zatažením toho druhého konce,
50 vs 70 mm). V rozhraní to znamená, že **u strany B levá koncovka přepíná
`rightEndType`** a naopak — odpovídá to tomu, že uživatel vidí blok z opačné
strany. Úložiště zůstává SDÍLENÉ a nepřejmenované, formát souboru se nemění.

**Fyzický tvar konců korpusu se NEZMĚNIL** — úsek herdbloku strany B si drží
své nezaměněné `leftEndType`/`rightEndType`. Je to nejsnazší místo, kde tenhle
úkol pokazit; v kódu je u něj výstražný komentář.

Ověřeno měřením: přístroje strany B zadané v pásu na 0–1200 vyšly na world X
−1561..−439 a promítají se od levého okraje (NDC −0,375). Koncovky: co je na
straně A vpravo, je na straně B vlevo, a klik na pravou koncovku strany B
skutečně změní `leftEndType`.

## 19. Sokl se stavěl po obvodu bloku — VADA

**HOTOVO 1. 9. 2026.** Zadavatel: „Sokl má být jen pod skříňkami."

`buildBlockPlinth()` stavěl rám/zástěnu po obvodu CELÉHO půdorysu, takže sokl
běžel i pod volným prostorem a nedoplněným zbytkem řady. Nově se staví jen
pod **souvislými úseky skříněk**: sousedící skříňky (tolerance 0,5 mm) mají
jeden společný sokl, `gap` úsek rozdělí, mimo skříňky se nekreslí nic. Platí
pro MONO (obě řady ostrova zvlášť; sokl strany B je uvnitř otočené podskupiny,
takže se zrcadlí s ní) i pro SEGMENT (tam se mění jen rozsah v ose X).

**ZMĚNA HODNOTY:** uskočení 50 mm se nově měří **od líců SKŘÍNĚK**, ne od
líce bloku — obrys bloku přestal být pro sokl vztažnou hranou. Čelo soklu
u MONO tím kleslo z z = 50 na **z = 80** (líc skříňky 30 + 50). U SEGMENTu se
hranice posunula o 20 mm (`SIDE_PANEL_MM`) blíž ke středu. Je to viditelné
i tam, kde žádná skříňka nechybí. Zapsáno i v `HODNOTY-MONO.md` §9.

Ověřeno měřením: řada skříňka 600 / mezera 600 / skříňka 600 dala DVA úseky
(8 těles), pod mezerou nic, uskočení přesně 50 od líců skříněk; ostrov má
každou řadu zvlášť; SEGMENT s krátkou řadou končí soklem tam, kde končí
segmenty.

**Známé omezení (vědomé, ne vada k opravě):** u SEGMENTU zůstává sokl JEDNA
skupina přes celou hloubku bloku (hloubkové chování se neměnilo). Když má
ostrovní SEGMENT jednu řadu úplně prázdnou a druhou obsazenou, sokl se
částečně natáhne i pod prázdnou řadu. U MONO tenhle případ nenastává.

## 1. Převrácená osa X ve 3D — NEJZÁVAŽNĚJŠÍ

**HOTOVO 8. 8. 2026.** Příčina byla rozdíl směru stavby. Změřeno promítnutím
bodů přes kameru z `computeViews()`: kladné world X je na obrazovce VLEVO.
SEGMENT staví první segment na nejvyšší +X, MONO opačně. Opraveno zrcadlením
v adaptéru `mono-block.js` přes funkci `mirrorX` — zrcadlí se polohy, typy
konců i strany límce. Ověřeno: nejužší skříňka, v pásu první zleva, vyjde
na `x 800..1200`.

Zadavatel: „Když se dívám na blok zepředu — pohled na panel. Schéma dole
vypadá dobře, ale na 3D grafice se vše ukazuje obráceně — vlevo je vpravo
a vice versa."

Zasahuje **všechno, co má levou a pravou stranu**: přístroje, podestavby,
límce, boční kryty, koncové zóny i typy zakončení.

Je to zároveň pravá příčina staršího hlášení „skříňky se přidávají zprava".
V pásu položka přibývala vpravo správně, ve 3D se objevila na opačné straně.
Jeden agent to tehdy špatně diagnostikoval jako vadu pořadí pole a „opravil"
na `unshift` — to je vráceno zpět na `push`, ale skutečná vada trvá.

**Postup: nejdřív změřit, pak opravovat.** Postavit MONO blok s jednou
skříňkou u levého konce, zjistit její světovou souřadnici x přes `Box3`,
a porovnat se stranou, na které se jeví v čelním pohledu. Teprve pak
rozhodnout, jestli se má zrcadlit geometrie, nebo kamera.

Kde hledat: `js/mono-block.js` (~ř. 131, `group.position.x = -mm(lengthMM)/2`
— jediné místo, kde adaptér do osy X sahá); hlavička `js/mono-geometry.js`
(„x = 0 je LEVÝ konec bloku" — otázka je, jestli to odpovídá tomu, co
uživatel vidí vlevo); `js/viewer.js` / `computeViews()`. Nejrychlejší stopa
je rozdíl proti SEGMENTu (`block.js`), u kterého zrcadlení hlášené není.

Nezrcadlit „až v UI" — pás i geometrie musí mluvit o téže straně.

## 2. Vodopád / monolitický bok se nestaví

**HOTOVO 8. 8. 2026.** Nos vyplňuje celé zatažení (50 u vodopádu, 70 u
zkoseného), ne kvádr 20 mm, a jde jen po spodní líc desky. Korpus je
zatažený o stejnou hodnotu, takže s nosem nemá souosou stěnu — to bylo
blikání.

Zadavatel doložil screenshotem: pracovní deska je nahoře jen tenký
přesahující plát a bok herdbloku pod ním ustupuje, takže je z boku vidět
schod. Má to být **jeden monolit** přes celou výšku.

**Skladba boku je nově dodaná** (dřív blokovala) — zadavatel doslova:
„bavíme se o vodopádu, přetéká v celé své šířce na bok herdbloku a celý ho
zakrývá. Potom pokračuje boční panel, který zcela a přesně zakrývá
podestavbu. Boční panel u ostrova zakrývá obě podestavby od čela k čelu
a zakrývá tak i mezeru mezi jejich zády."

Bok jsou tedy **dva díly nad sebou, oba přes celou hloubku**:
1. **Vodopád** — deska přetéká přes bok herdbloku v CELÉ šířce a zakrývá ho
   celý. Ne zúžený pruh, ne jen čelo.
2. **Boční panel** — navazuje pod ním a zakrývá podestavbu zcela a přesně.

V `mono-geometry.js` na to čekají nepoužité konstanty `NOSE_FRONT_MM`,
funkce `noseFrontMM()` a `DESK_OVERHANG_SIDE_MM` s poznámkou „není dodaný
tvar" — ty poznámky přepsat.

## 3. Zkosený vodopád se ve 3D nekreslí

**HOTOVO 8. 8. 2026.** Půdorysný obrys bloku 2500×850 se zkoseným pravým
koncem vyjde `(0,0) (2450,0) (2500,50) (2500,850) (0,850)`. Ve svislém řezu
se nemění nic.

Zadavatel: „správně se rozšíří boční svislá deska na 70 mm, ale není tam
žádné zkosení."

Zatažení podle typu konce funguje (`sideInsetMM` vrací 50/70), ale TVAR
zkosení se nestaví. Konstanty `END_STRAIGHT_MM` (20), `END_CHAMFER_MM` (50)
a `CHAMFER_ANGLE_DEG` (45) mají u sebe „TODO: zatím se nepoužívá".

**Zkosení je POUZE v půdorysu — useknutý roh při pohledu shora.** Ve svislém
řezu se proti obyčejnému vodopádu nemění nic, čelo desky zůstává 50 mm
svislých po celé délce. Podrobně a se zdůvodněním v ČÁSTI E, poslední odrážka.
**Nedělej žádnou facetku ve svislém řezu** — na tomhle už jednou vzniklo
nedorozumění.

Rovná část rohu je 20 mm, zkosená 50 mm, dohromady 70 — což je přesně
zatažení panelu u tohohle typu konce.

**Řešit společně s úkolem 2 — je to týž díl, jen druhý typ konce.**

## 4. Boční kryt 20 mm u zkoseného konce

**HOTOVO 8. 8. 2026.** Pravidlo je per-konec, `atEdge` samo nestačí. Ověřeno
přes všechny čtyři kombinace typů konců.

Zadavatel: „pokud tady bude blok ukončen zkoseným vodopádem s podestavbou,
použijme spodní krycí panel jen 20 mm. Myslím, že to bude vypadat lépe."

Dosavadní pravidlo: kryt 50 tam, kde podestavba sedí co nejvíc na kraji
bloku, jinak 20. **Nová výjimka:** je-li na daném konci `svislaDeskaZkos`
a je tam podestavba, použije se **20**, ne 50.

Zapsat i do `HODNOTY-MONO.md`, ať pravidlo nežije jen v kódu.

## 5. Šipky přeuspořádání patří na dlaždice

Šipky fungují, ale jsou v pruhu parametrů. Zadavatel je hledal tam, kde je
má SEGMENT — na kartě prvku — a nenašel.

**Chyba je v mém zadání, ne v provedení.** Tři důvody k přesunu, podle
závažnosti:
1. **Nekonzistence uvnitř jedné aplikace.** Tentýž úkon se nesmí ovládat na
   dvou místech podle toho, jaký produkt je zvolený.
2. Pruh parametrů se plní až po kliknutí na dlaždici, takže dokud uživatel
   nic nevybere, šipky neexistují.
3. Přeuspořádání je operace nad ŘADOU, ne nad jednou vybranou věcí.

Nový požadavek: šipky na levém a pravém boku každé dlaždice v dráze Herdblok
i Podestavby, viditelné bez předchozího výběru. Z pruhu parametrů odstranit.
Krajní dlaždice nemá šipku na příslušné straně.

**Háček:** dlaždice jsou úměrné milimetrům, takže prázdný prostor 100 mm je
široký ~40 px a dvě šipky neuveze. Zadavatel rozhodl 8. 8. 2026:
nakreslit napřed tři varianty jako mockup a vybrat z nich, teprve potom
implementovat.

## 6. Ostrovní varianta MONO

Tlačítko Ostrov v rozhraní je a **nic nedělá** — nepřidá druhou řadu
přístrojů ani druhý panel, a chybí přepínač A/B ve spodním pásu. Není to
regrese (bylo vědomě mimo rozsah), ale tlačítko, které nic nedělá, je horší,
než kdyby tam nebylo.

**Zadavatel rozhodl: jedna průběžná deska** přes obě strany, hloubky A+B.
Ne dvě desky proti sobě se spárou uprostřed. Boční panel jde od čela k čelu
a zakrývá i mezeru mezi zády obou podestaveb (viz úkol 2). U ostrova s typem
zakončení `svislaDeskaZkos` (zkosený vodopád) mohou být zkosené **všechny rohy**
(nikoliv jen přední jako u varianty u stěny), protože ostrov obchází po obou
stranách a všechny čtyři rohy jsou viditelné.

Největší zbývající kus — sahá do `mono-geometry.js`, `mono-block.js`,
`main.js`, `mono-ui.js` i `ui.js` naráz, takže se nedá rozdělit mezi
souběžné agenty.

## 7. Drobnosti v pásu MONO

- Popisek levé koncové zóny je oříznutý — vidět je „0 m" místo „50 mm".
- Text „chybí N mm" se překrývá se šrafou a je špatně čitelný.
- Poznámka hlásí „Koncové zóny 50 / 50 mm", i když pravý konec vypadá na
  zkosený — ověřit, jestli čte skutečné typy konců, nebo výchozí hodnoty.
- Prázdný nový projekt MONO hlásí rovnou oranžové „chybí N mm". Podle zadání
  správně, ale vypadá to jako chyba. (Částečně řeší předvyplnění třemi
  položkami — ověřit, jak to teď působí.)
- Pruh parametrů u záložky Límce měl v mockupu pole (délka, tloušťka
  plechu, odsazení od hrany), pro která v modelu nejsou data. Zadavatel
  rozhodl 8. 8. 2026: ŠKRTNOUT Z MOCKUPU. Pole se mají odstranit z
  `mockup-mono.html` i z aplikace.

## 8. Opravit `ZADANI-MONO-UI.md`

**HOTOVO 8. 8. 2026.** Všech šest bodů opraveno a ověřeno proti skutečnému
kódu.

Kód je správně, **zadání je vadné** — a odkazují se na něj komentáře v kódu:

1. **§8** staví výhybku na MONO před `lastStripState = state;`. Musí být za
   ním, jinak se u MONO vždycky přeskočí potvrzovací dotaz u „Nový projekt".
2. **§4** pojmenovává callbacky ramen `onArmAdd/onArmChange/onArmRemove`.
   Skutečné jsou `onAddArm`, `onRemoveArm`, `onArmPositionChange`,
   `onArmOffsetChange`, `onArmAngleChange`.
3. **§6** nezná `.mono-ruler-row`, `.mono-point-selected`, `.mono-switch-on`
   (v CSS jsou) a slibuje `.mono-diagram-cap`, která neexistuje. Chybí i
   `.mono-param-icon-btn`.
4. **§5** je psané „česky napřed", ale hlavička říká pořadí en, de, pl, cs, sk.
5. **§4** neříká, kdo vlastní `onMonoTabChange` — `ui.js` ho zachytí pro filtr
   palety a zároveň propustí do `main.js`.
6. **§1** má popsat i to, že se položky přidávají na KONEC řady (`push`).

## 9. Povrchové úpravy — vyřadit H3 a rozlišit tvar H2 vs. H1/HS+

Dvě věci, obě od zadavatele.

### 9a. H3 se nenabízí

Zbývají `HS+`, `H1`, `H2`. Seznam je na dvou místech a **obě se musí změnit**,
jinak se rozejdou:
- `js/modules.js` — `FINISH_TYPES` (zdroj pravdy)
- `js/mono-ui.js` — tentýž seznam je tam přepsaný jako lokální literál,
  protože modul nesmí importovat `modules.js`. U literálu je komentář, proč
  je duplicitní — doplnit poznámku, že se musí měnit spolu.

Ověřit, co se stane se starým souborem projektu, který má uloženo `H3` —
musí se načíst bez chyby a spadnout na výchozí úpravu, ne odmítnout soubor.

### 9b. Tvar se podle úpravy MĚNÍ — dnes se nemění

Zadavatel: „H2 má na spodních koutech podestaveb radius 16 mm — to tak je
teď v geometrii u všech variant. H1 a HS tam naopak nemají radius žádný —
to se teď v geometrii nezobrazuje a rád bych, aby se to zobrazovalo."

| úprava | spodní kouty podestavby |
|---|---|
| `H2` | radius **16 mm** (`H2_RADIUS_MM`) |
| `H1` | **ostrý roh**, žádný radius |
| `HS+` | **ostrý roh**, žádný radius |

Dnešní stav: `buildPodestavba()` v `js/mono-geometry.js` staví dva náběhy
`buildH2Fillet` **vždy**, bez ohledu na úpravu. Musí být podmíněné.

Co to obnáší:
- `buildPodestavba()` dostane parametr `finish` a náběhy postaví jen pro `H2`.
- `js/mono-block.js` musí `finish` z jednotlivé skříňky (`MonoCabinet.finish`,
  viz `ZADANI-MONO-UI.md` §1) do geometrie předat — dnes ho tam neposílá.
- Úprava je vlastnost KAŽDÉ SKŘÍŇKY zvlášť, ne celého bloku. V jedné řadě
  můžou stát skříňky s různou úpravou a každá musí mít svůj tvar.
- Ověřit měřením přes `Box3`, ne okem: u `H2` musí díly náběhu ve scéně být,
  u `H1`/`HS+` nesmí existovat vůbec.

**Neruš `POZOR` na to, že se to týká i SEGMENTu** — `finish` má i on
(`DEFAULT_FINISH` v `main.js`). Ověřit, jestli jeho geometrie (`block.js`,
`modules.js`) radius řeší, nebo má tutéž vadu. Zadavatel mluvil o
podestavbách obecně.

## 10. Katalogové jméno přístroje — ověřit

`ui.js` předává pásu funkci `deviceName`, která přeloží strojový klíč
(`induction_hob`) na jméno („Indukční deska"). Napsané, neověřené za běhu.

## 11. Dráha s dlaždicemi přetéká a k přetečeným prvkům se nedá dostat

- Zadavatel 8. 8. 2026 doslova: „Když je dole příliš polí a ta
  přetékají mimo obrazovku, tak se nedostanu k těm, která nejsou
  vidět. Nebo tam aspoň není vidět na první pohled způsob, jak to
  udělat."
- **Příčina je diagnózou potvrzená screenshotem (8. 8. 2026):**
  Přetéká DRÁHA S DLAŽDICEMI ve spodním pásu, ne pruh parametrů.
  Nastane to, když součet položek přesáhne použitelnou délku bloku.
  Na screenshotu: blok 3200 mm, koncové zóny 70 a 50, tedy použitelných
  3080 mm, ale podestavby jsou 600 + 600 + 600 + 400 + 480 + 800 =
  3480 mm — řada je o 400 mm delší a poslední dlaždice utíká za
  pravý okraj okna. Uříznutá je i pravá koncovka zakončení u dráhy
  Herdblok — ta sedí na konci dráhy s posunem `transform:
  translate(∓52%, -50%)`, takže přesahuje ještě o kus dál. Dráha nemá
  vodorovné posouvání, proto se k tomu, co je za okrajem, nedá dostat.
- **Naivní oprava nefunguje.** `overflow-x: auto` povýší i svislou
  osu na `auto` (viz past v ČÁSTI A2), takže přidá svislý posuvník
  nebo začne řezat shora dolů. Pás MONO má navíc pevnou výšku
  268 px, takže ani zalomení polí do druhé řady není zadarmo — může
  přetéct svisle.
- Přicházejí v úvahu tři cesty: posouvání s viditelným náznakem,
  zalomení do druhé řady, nebo zúžení polí. **Která z nich, je
  rozhodnutí o vzhledu a patří zadavateli** — a protože jde o TÝCŽ
  pruh parametrů, do kterého sahá i úkol 5, má se to nakreslit do
  TÉHOŽ mockupu jako varianty šipek a rozhodnout naráz.
- **Ověřit, jestli tutéž vadu nemá i SEGMENT.** Třída má prefix
  `mono-`, takže se týká jen MONO, ale stejné useknutí může být i v
  pásu SEGMENTu.

## 12. Přeplněná položka se ve 3D kreslí za koncem bloku

**NEŘEŠIT BEZ POKYNU — zadavatel to viděl a nechal tak.**

- Když součet položek přesáhne délku bloku, poslední položka se
  **ve 3D vykreslí dál za koncem bloku** a v pásu se označí jako
  „nevejde se" (u SEGMENTu červeně, u MONO šrafovaně). Zadavatel to
  8. 8. 2026 viděl na screenshotu a rozhodl: **nechat, jak to je.**
  Uživatel si to vyřeší sám — buď zvětší rozměr bloku, nebo skříňku
  smaže.
- Vede se to tu jen jako **evidence pro případnou budoucí opravu**, ne
  jako vada k řešení. Nikdo se do toho nemá pouštět, dokud zadavatel
  neřekne.
- Kdyby se to jednou řešit mělo, jsou dvě cesty a každá má cenu:
  **nekreslit ji vůbec** — model pak vždy odpovídá tomu, co je
  vyrobitelné, ale uživatel ve 3D nevidí, že něco přebývá; nebo
  **kreslit ji odlišeně** (jinou barvou nebo průhledně) — přebytek je
  vidět, ale model neodpovídá vyrobitelnému stavu a v tiskovém
  dokumentu by to mohlo mást.
- Týká se OBOU produktů. U SEGMENTu se přeplnění navíc hlásí i číslem
  v hlavičce pásu („Využito 3600 / 3160 mm" červeně).

## 13. Sokly se u MONO ve 3D nekreslí — VADA

**HOTOVO 31. 8. 2026.** Implementováno podle `ZADANI-SOKL.md` (závazná
smlouva, zůstává jako reference) + tři nová rozhodnutí zadavatele:
**typ soklu je vlastnost CELÉHO BLOKU** (volba v levém panelu, per-item
volba zrušena z pásu MONO i z parametrů segmentů), **pravidla kreslení
platí i pro SEGMENT**, **pracovní výška = BODY_STACK_MM 750 + výška
soklu** pro oba produkty (sokl 50–150 → výška 800–900, pole v levém
panelu je jen zobrazený výsledek). Stav: `state.plinth = {type, heightMM}`,
4. hodnota `legs_plinth` v `PLINTH_TYPES`. Rám/zástěna se staví po obvodu
bloku (`sokl-predni/zadni/levy/pravy`), zástěna u `single` bez zadní
strany. Tiskový dokument uvádí sokl jednou v parametrech bloku
(`report.js`). Ověřeno měřením: MONO i SEGMENT, všechny 4 typy, posun
bloku při nižším soklu, serializace + tolerantní načtení starého souboru.

Zadavatel 9. 8. 2026 doslova:

> „V 3D se neukazují správně sokly — teď a neukazují se vůbec. Stavební sokl
> tam nemá vůbec být (ani nožičky). Konstrukční ukazuje nožičky, nožičky
> samostatně tam vůbec nejsou a soklová zástěna se taky neukazuje."

**Příčina je nalezená, nehledej ji znovu:** `buildPodestavba()`
v `js/mono-geometry.js` (kolem ř. 932, blok „--- 4 nožičky ---") staví čtyři
nožičky **natvrdo, bez ohledu na zvolený typ soklu**. Typ soklu nečte vůbec
a `buildPlinth()` z `js/modules.js` (ř. 263) se u MONO **nikdy nevolá**.
Volba soklu se tedy ukládá i nabízí v pásu, ale ve 3D nemá žádný účinek.

Hodnoty: `PLINTH_TYPES = ['legs', 'building', 'construction']`
(`js/modules.js` ř. 95), výchozí `DEFAULT_PLINTH = 'construction'` (ř. 96).
Tentýž seznam je jako lokální literál v `js/mono-ui.js` (ř. 39) — **obě místa
se musí měnit spolu.**

Rozhodnutí zadavatele (9. 8. 2026):

| typ soklu | co se má kreslit |
|---|---|
| stavební (`building`) | **VŮBEC NIC**, ani nožičky |
| konstrukční (`construction`) | **nerezový rám, na kterém celý blok sedí. ŽÁDNÉ nožičky.** |
| nožičky (`legs`) | nožičky |
| nožičky + soklová zástěna (NOVÁ hodnota) | nožičky + nerezový sokl, který je kryje |

Zadavatel 9. 8. 2026 doslova: „Konstrukční sokl je nerezový rám, na kterém
celý varný blok sedí. Nožičky tam vůbec nemají být, takže si stěžuji. Je to
nesprávný stav." **Dnešní čtyři nožičky u konstrukčního soklu jsou VADA, ne
popis správného stavu.**

Zadavatel 9. 8. 2026 doslova: „Soklová zástěna je nerezový sokl, který kryje
nožičky — jde použít jen s nimi. Prakticky se k tomu dá přistoupit jako k 4.
volbě: nožičky + zástěna."

- **Soklová zástěna je tedy ČTVRTÁ HODNOTA `PLINTH_TYPES`, ne samostatný
  příznak.** Vylučovací volba je záměr — nesmí vzniknout stav se zástěnou
  bez nožiček.
- **Zástěna kryje VŠECHNY STRANY bloku.** Jediná výjimka: u jednostranného
  bloku (`single`) se strana u zdi nekryje. U ostrova (`island`) se kryjí
  všechny čtyři strany.
- Nový klíč se do `PLINTH_TYPES` jen PŘIDÁVÁ. **Žádný stávající klíč se
  nepřejmenovává** a starý soubor projektu se třemi hodnotami se musí
  načíst bez chyby.
- `PLINTH_TYPES` je na dvou místech — `js/modules.js` ř. 95 a lokální
  literál v `js/mono-ui.js` ř. 39. **Obě se musí měnit spolu.**
**Rozměry soklu** (9. 8. 2026):
- Základní (výchozí) výška soklu je **150 mm** — platí pro VŠECHNY varianty soklu.
- Sokl je **uskočený 50 mm od líce bloku**.
- Výška je nastavitelná, rozsah **50 až 150 mm** (dolní mez 50, výchozí a zároveň horní 150).

Zadavatel 9. 8. 2026 zodpověděl zbývající tři otázky:
- **Výška soklu je vlastnost CELÉHO BLOKU**, ne jednotlivé skříňky.
- **Snížení soklu spustí celý blok níž** — korpus se o rozdíl nezvyšuje.
- **Uskočení 50 mm platí ZE VŠECH STRAN** (čelo, boky i záda).

## 14. Podestavby potřebují police a dvířka jako SEGMENT — POŽADAVEK

**HOTOVO 31. 8. 2026.** Implementováno podle `ZADANI-PODESTAVBY-MONO.md`
(závazná smlouva, zůstává jako reference) společně s úkoly 15 a 16.
`bodyStyle` je zprovozněný: `closed` staví čelní stěnu, `doors` křídlová
dvířka s úchytkami (2 křídla nad 600 mm), `open` nechá korpus otevřený a
při `hasShelf` přidá polici. **Pozor, výchozí skříňka (`closed`) teď má
čelní stěnu** — dřívější „otevřený" vzhled byl důsledek toho, že
`bodyStyle` neměl ve 3D žádný účinek; je to záměr, ne regrese.
Ověřeno měřením (viz úkol 16 níž).

Původní popis vady zůstává jako evidence:

**Pozor, je to větší, než vypadá:** `MonoCabinet.bodyStyle` má podle
`ZADANI-MONO-UI.md` §1 hodnoty `'closed' | 'doors' | 'open'`, jenže
**geometrie MONO `bodyStyle` neřeší VŮBEC** — grep na `bodyStyle`
v `js/mono-geometry.js` nevrátí nic. Volba se ukládá i nabízí v pásu, ale
ve 3D nemá žádný účinek a všechny skříňky vypadají stejně. Nejde tedy jen
o doplnění polic, ale o zprovoznění celého `bodyStyle`.

Police je příznak **KAŽDÉ SKŘÍŇKY ZVLÁŠŤ**, stejně jako to má SEGMENT
(`hasShelfFlag`). Potvrzeno 9. 8. 2026.

Co má SEGMENT hotové v `js/modules.js` a odkud se to dá převzít:
- `buildBodyByStyle()` (ř. 441) — rozcestník podle stylu
- `buildOpenBody(..., hasShelf)` (ř. 315) — otevřené tělo, umí i polici
- `buildDoorBody()` (ř. 369) — dvířka
- `hasShelfFlag()` (ř. 193) — čte příznak police ze segmentu

Do `MonoCabinet` bude potřeba doplnit příznak police (SEGMENT ho čte přes
`hasShelfFlag`) a `buildPodestavba()` musí `bodyStyle` i ten příznak dostat
a použít.

## 15. Zásuvkový blok — POŽADAVEK

**HOTOVO 31. 8. 2026.** Nový druh podestavby `kind:'drawers'` se dvěma
zásuvkovými čely a úchytkami, šířky pevné 400/600. V paletě jako dva
řádky („Zásuvkový blok GN 1/1" a „GN 2/1"), šířka se v pruhu parametrů
jen zobrazuje, needituje. Ověřeno měřením (viz úkol 16 níž).

Zadavatel: „chci tu mít zásuvkový blok se 2 zásuvkami o šířce 400 (GN 1/1)
a 600 (GN 2/1)."

Nový typ podestavby: blok se **dvěma zásuvkami**, ve dvou šířkách —
**400 mm pro GN 1/1** a **600 mm pro GN 2/1**. Šířky jsou **pevné** (400 a 600),
uživatel je nevolí. Rozhodnuto 9. 8. 2026.

SEGMENT má základ hotový: `buildDrawersBody(..., drawerCount)`
(`js/modules.js` ř. 410) a `getSegmentDrawerCount()` (ř. 122). Počet zásuvek
je tedy parametr, ne pevné číslo — dá se převzít.

## 16. Skříňka se zásuvy na GN — POŽADAVEK

**HOTOVO 31. 8. 2026.** Nový druh `kind:'gnRack'` — 12 těles `gn-vsuv`
(6 párů) na vnitřních lících bočních stěn, provedení jen otevřené nebo
s dvířky (`closed` se u něj nenabízí ani neuloží).

**Společná přejímka úkolů 14–16** (měřeno po plném proplachu keše, přímým
importem `mono-geometry.js` i celé scény přes `buildMonoScene`, sokl 150,
tělo 460): počty těles sedí ve všech kombinacích — `closed` 1× `celni-stena`,
`doors` 1 křídlo do 600 mm a 2 nad, `open`+police 1× `police` (bez police
se těleso vůbec nevytvoří), `drawers` 2× čelo + 2× úchytka, `gnRack` 12×
`gn-vsuv`. Rozteč vsuvů přesně **70,0 mm** (středy 230–580), police
vystředěná v dutině (y 380–400). Vše před lícem korpusu a **žádné záporné
z**: dvířka z 16–24, jejich úchytka 5–15, zásuvková čela 14–24, úchytky
3–13. Neznámý `kind`/`bodyStyle` spadne na `cabinet`/`closed`. H2 náběhy
dál řídí jen `finish`, nezávisle na druhu. Ostrov: strana B staví vsuvy
zrcadleně (z 1025–1645 při hloubce 1700). Uložení + načtení projektu
s novými druhy včetně sanitizace pokažených hodnot (gnRack `closed` → `open`,
šířka 500 → 400, chybějící `hasShelf` → false). SEGMENT nedotčený —
`modules.js`, `block.js`, `report.js` ani CSS nikdo neotevřel. Čistá konzole.

**Pozn. k `FLOOR_MM`:** podlážka je **40 mm**, ne 20. Výšky police i vsuvů
se počítají z `yBodyBottom + FLOOR_MM` (= horní hrana podlážky), tedy ze
stejné základny jako H2 náběhy. Při přejímce jsem si to spletl a poslal
agentovi opravu na základnu 20; agent ji správně odmítl s odkazem na
konstantu. Kdo bude ta čísla příště přepočítávat, ať vychází z 40.

Zadavatel: „chci tu mít skříňku se zásuvy na GN. 400 mm širokou na GN 1/1
a 600 mm šířkou na GN 2/1. (otevřenou nebo s dvířky)."

Rozhodnutí zadavatele (9. 8. 2026): **6 vsuvů, rozteč 70 mm.** Šířky pevné:
**400 mm pro GN 1/1, 600 mm pro GN 2/1**. Provedení **otevřené nebo s dvířky**.

## 17. Přístrojům se nekreslí ovládací prvky — VADA

**HOTOVO 31. 8. 2026.** `renderControls()` se volá po obou
`applyTopFeature()` (strana A i B). Ověřeno měřením: 4 knoflíky ø34 se
středem na y 750, strana A na z 7–25 (před lícem panelu), strana B na
vnějším líci panelu B (z 1675–1693 při hloubce 1700). Pozn.: po merge
katalogu už neexistují staré klíče přístrojů (`induction_hob` apod.) —
platí id z `katalog/` (např. `al-pg22-800-g`).

Zadavatel: „přístrojům se nevykreslují ovládací prvky."

**Příčina je známá a není to vada v provedení, ale chybějící kus v zadání.**
Když se 8. 8. 2026 osazovaly přístroje u MONO, vyexportovala se a volala
**jen** `applyTopFeature()`, tedy varná plocha. Na ovládací prvky se
v zadání zapomnělo a `renderControls()` se u MONO nevolá vůbec.

Kde to je:
- `renderControls(group, widthM, panelCenterY, panelFrontZ, controlType, count)`
  — `js/modules.js` ř. 479. SEGMENT ji volá z `createSegmentMesh()`.
- `js/mono-block.js` volá `applyTopFeature()` na **dvou místech** (ř. 321
  pro stranu A a ř. 350 pro stranu B, po zavedení ostrova). Volání
  `renderControls()` musí přibýt na obou, jinak bude jedna strana ostrova
  bez knoflíků.
- `controlType` a `count` jsou v katalogu u každého přístroje jako
  `controls: { type, count }` — viz `js/catalog.js` (např. ř. 75:
  `controls: { type: 'knob', count: 4 }`).

**Souřadnice se ze SEGMENTu NESMÍ převzít naslepo** — MONO má panel jinde.
U MONO platí: `PANEL_SETBACK_MM = 25` (ustoupení za líc desky),
`PANEL_HEIGHT_MM = 240`, `LISTA_HEIGHT_MM = 40`, tloušťka panelu 20 mm
(`PANEL_DEPTH_MM`, lokální v `buildHerdblokUsek`) — vše v
`js/mono-geometry.js`. Ověřeno měřením: panel MONO leží v ose Z na 25–45 mm
a ve výšce 650–850 mm nad podlahou při pracovní výšce 900.

---

# ČÁST D — OTEVŘENÉ OTÁZKY NA ZADAVATELE

Nic z toho se nesmí domýšlet.

## Blokuje geometrii

**Nic. Poslední dvě blokující otázky zadavatel zodpověděl — viz ČÁST E,
poslední odrážka. Geometrie je odblokovaná celá.**

## Nezablokuje, ale je potřeba

**Výška soklu a pracovní výška (ÚKOL 13): ZODPOVĚZENO 31. 8. 2026 —
platí i pro SEGMENT.** Obě řady nastavují výšku soklu (50–150 mm),
pracovní výška se dopočítává. SEGMENT tedy při úkolu 13 přechází z
pracovní výšky jako vstupu na dopočítaný údaj stejně jako MONO.

## Odloženo — neřešit bez pokynu

- Nástavby nad blokem (roštová nástavba, police na salamandr).
- Druhý rozměr přístroje „na desce" vs. „pod deskou".
- Smí si přístroj v katalogu určit ochranné pole větší než 50?
- Volí se příplatkové kruhové ovladače pro celý blok, nebo po přístrojích?

---

# ČÁST E — ZMĚNY HODNOT, KTERÉ UŽ PLATÍ

- **Mez převisu je 1200 mm** (bylo 500). Konstanta `OVERHANG_LIMIT_MM`.
  Držena zvlášť od meze mostu (taky 1200), protože most je nepodepřená
  světlost MEZI podestavbami a převis je konzola na KONCI řady — kdyby se
  rozešly, musí jít měnit nezávisle. Zapsáno i v `HODNOTY-MONO.md` §7.6.
- **Převis se měří od konce PANELU**, ne od konce bloku. Plně obsazený blok
  hlásí 0.
- **Existují právě dva typy zakončení:** `svislaDeska` a `svislaDeskaZkos`.
  Obchodně **vodopád** a **zkosený vodopád**. „Vlna" i „rovné zakončení" jsou
  zrušené názvy — v kódu ani v UI se nesmí objevit. Klíče v souboru projektu
  se NIKDY nepřejmenovávají, obchodní jméno žije jen v `js/i18n.js`.
- **Zatažení panelu a lišty od boku:** 50 u vodopádu, 70 u zkoseného. Levý
  a pravý konec můžou mít různý typ, takže rozvržení nemusí být symetrické.
- **Zkosení u zkoseného vodopádu — které rohy** (potvrzeno 8. 8. 2026):
  U varianty u stěny (`single`) jsou zkosené **JEN přední rohy**; zadní roh
  (u stěny) zůstává ostrý. U varianty ostrov (`island`) mohou být zkosené
  **všechny rohy**, protože ostrov obchází po obou stranách a všechny čtyři
  rohy jsou stejně viditelné.
- **Nové položky se přidávají na KONEC řady** (`push`), ne na začátek.
- **Prázdný prostor** v podestavbách se přidává **výhradně z palety** vlevo,
  ne z pruhu parametrů — z uživatelského hlediska je to prostě další
  podestavba, která je prázdná.
- **Nový projekt MONO** začíná s podestavbami: skříňka 600, prázdný prostor
  600, skříňka 600; zbytek řady se hlásí jako chybějící.
- **Výška skříněk (podestaveb) je nově PEVNÁ** (9. 8. 2026). Odpovídá kombinaci
  pracovní výšky 900 mm + sokl 150 mm. Uživatel ji nenastavuje.
- **Uživatel nově nastavuje VÝŠKU SOKLU**, rozsah 50–150 mm, výchozí 150. Je to
  vlastnost celého bloku.
- **Pracovní výška se stává DOPOČÍTANÝM údajem**, ne vstupem: pevná výška
  skříňky + výška soklu. Vychází v rozsahu **800–900 mm**.
- **Důsledek pro rozhraní:** v levém panelu se pole „Pracovní výška" mění ze
  vstupního pole na zobrazený výsledek a přibývá vstup „Výška soklu". Nový
  popisek musí být v **5 jazycích** (en, de, pl, cs, sk) — pořadí podle
  hlavičky `ZADANI-MONO-UI.md`.
- Zpětná kompatibilita uložených souborů se **neřeší** — aplikace je interní
  a nenasazená (platí dosavadní pravidlo projektu).
- **ZODPOVĚZENO 31. 8. 2026: změna platí I PRO SEGMENT** — obě řady
  nastavují sokl, pracovní výška je dopočítaná.

## Odpovědi zadavatele — už neptat, tohle je rozhodnuté

- **Ostrov má JEN boční límce.** Zadní u ostrova smysl nemá — ostrov nemá
  záda. V UI se u varianty `island` zadní límec vůbec nenabízí.
- **Rozměr přístroje je šířka × hloubka.** Tedy 520 × 480 = široký 520,
  hluboký 480. Potvrzeno.
- **Lemy kolem otvorů pro přístroje se NEDĚLAJÍ VŮBEC.** Navařené rámečky
  kolem výřezů, které jsou na fotografiích, se do modelu nepřenášejí. Otázka
  „patří herdbloku, nebo přístroji" je bezpředmětná.
- **Vnitřní kryty 20 mm jdou až ke stěně** (z 30–850), ne jen po zadní líc
  podestavby. Potvrzuje to dnešní stav kódu — poznámku `// PŘEDPOKLAD:`
  u nich lze smazat.
- **Límec je v rohu SVAŘENÝ — vypadá jako z jednoho kusu, na horní straně
  není vidět žádné dělení.** Zadavatel doslova. To mění způsob stavby: dnešní
  `buildCollarWall()` staví každou hranu jako samostatný kvádr, takže by
  v rohu byla vidět spára shora a stěny by se navíc prolínaly (blikání).
  Límec se musí stavět **z jednoho průběžného obrysu** přes všechny zapnuté
  hrany, ne jako sada nezávislých kvádrů — stejnou technikou, jakou už modul
  používá na desku (`buildHerdblokOutline` → `slabFromOutline`).
  Sousední hrany se v rohu napojí bez spáry.
- **Povrchové úpravy: H3 se nenabízí vůbec.** Zbývají `HS+`, `H1`, `H2`.
  **Ve 3D se OD SEBE LIŠÍ a lišit se musí** — viz úkol 9. Fotografie vnitřku
  skříňky potřeba není, tvar je popsaný slovy.

## ZKOSENÍ JE POUZE V PŮDORYSU — vyjasněno, odblokovává geometrii

Zadavatel doslova: „O zkosení se bavíme jen v půdorysu, tady žádné zkosení
nebude. Evidentně tam někde došlo k nedorozumění a záměně zkosení."

**Zkosený vodopád = useknutý roh při pohledu SHORA.** Ve svislém řezu
(pohled zepředu i z boku) se proti obyčejnému vodopádu **nemění vůbec nic** —
čelo desky zůstává po celé délce svislých 50 mm.

Sedí to s čísly, která už v kódu jsou: `END_STRAIGHT_MM` 20 + `END_CHAMFER_MM`
50 = 70, a přesně o 70 mm je u zkoseného konce zatažený panel
(`sideInsetMM`). Ta sedmdesátka tam je právě kvůli useknutému rohu.

**Tím padají jako bezpředmětné:**
- „Rozklad výšky čela desky 50 mm na svislou a šikmou část" — žádná šikmá
  část neexistuje, celých 50 mm je svislých.
- „Zúžené čelo 20 mm u zkoseného vodopádu" — zúžené čelo neexistuje. Číslo
  20 je délka ROVNÉ části rohu v půdorysu, ne výška čela.
- Obava, že by ovládací panel předsazoval před spodní hranu desky. Spodní
  hrana nikam necouvá, takže hrozit nemůže. Tvrdá podmínka „panel nesmí
  NIKDY předsazovat" platí dál, jen ji nic neohrožuje.

**Pozor na pozůstatky nedorozumění v kódu:** `prototyp/params.js` má parametr
`zuzeneCeloZkoseneVlny` („Zkosená vlna — zúžené svislé čelo desky") a
`prototyp/geometry.js` kolem ř. 602 počítá `facet = H − zuzeneCeloZkoseneVlny`.
To je ta záměna. Složka `prototyp/` je stará a do aplikace nevede, ale kdyby
z ní někdo čerpal, tohle je špatně.

---

# ČÁST F — PLÁN PŘÍŠTÍ SESSION

## Úvod

Plán z 8. 8. 2026 (Krok 0, vlna 1, vlna 2) je **celý hotový**. Ověřené a
zakomitované: přístroje ve 3D, zrcadlení osy X, monolitický vodopád,
zkosený vodopád s půdorysným obrysem, boční kryt 20 mm u zkoseného konce,
šipky přeuspořádání na dlaždice, povrchové úpravy (vyřazení H3 i jejich
diferenciace u podestaveb), drobnosti v pásu, oprava `ZADANI-MONO-UI.md`.
Spodní pás MONO je dodělaný.

**Ostrovní varianta (úkol 6) se 9. 8. 2026 postavila** třemi souběžnými
agenty podle smlouvy `ZADANI-MONO-OSTROV.md` — datový model a ukládání
(`de22438`), rozhraní a přepínač stran (`5edafaa`), geometrie (`373ee11`).
Oddíl níž o ní zůstává jako popis toho, co se stavělo a proč.

**OSTROV JE OVĚŘENÝ JAKO CELEK (31. 8. 2026)** — včetně opravy O2
(deska na pracovní výšce, celková hloubka A+B), commit `62cd845`.
Prošly všechny čtyři body níže + kontrolní čísla varianty u zdi,
čistá konzole. Seznam se tu nechává jako popis, CO se ověřovalo:

1. **Varianta u zdi se nesměla změnit.** Sáhli do ní tři agenti naráz.
   Kontrolní čísla (před vystředěním): deska x 0–2500 y 850–900 z 0–850,
   korpus x 50–2430 y 610–850 z 26–825, panel x 50–2430 y 650–850 z 25–45,
   lišta x 50–2430 y 610–650 z 3–45, nos vlevo x 0–50, nos vpravo
   x 2430–2500, oba y 610–850 z 0–850. **Poznámka (9. 8. 2026):** Tato
   čísla platí pro sokl 150 mm (výchozí stav). U jiné výšky soklu se souřadnice
   Y posunou o pevný rozdíl — skříňka zůstane stejně vysoká, jen sedí níž.
   Např. sokl 50 mm místo 150 mm znamená, že celý blok klesne o 100 mm.
2. **Strany A a B jsou opravdu nezávislé** — ne že by B jen zrcadlila A.
3. **Uložení a načtení neztratí stranu B.** Nejhorší možná vada, uživatel
   by přišel o data.
4. **Rozhraní zapisuje do správné strany** — přidání prvku při zvolené
   straně B musí skončit v `podestavbyB`, ne v `podestavbyA`. Vypadalo by
   to, že aplikace funguje, a přitom by tiše zapisovala jinam.

**Nová hlášená vada ostrova** (9. 8. 2026): Na screenshotu ostrova (délka 3200,
hloubka A 850, hloubka B 850, pracovní výška 900) hlásí zadavatel:
„**Pracovní deska je moc nízko — začíná na podlaze.**" Zároveň panel rozměrů
hlásí „celková hloubka 850 mm", ačkoli A + B = 1700. Obojí se právě měří,
příčina zatím není potvrzená — je to hlášení, ne diagnóza.

**Zadavatel 9. 8. 2026 rozhodl o pořadí: nejdřív ověřit ostrov, teprve pak
úkoly 13–17.**

**Úkoly 13, 14, 15, 16 a 17 jsou HOTOVÉ a ověřené (31. 8. 2026)** — viz
ČÁST C. Rozšíření nabídky podestaveb (police a dvířka se zprovozněným
`bodyStyle`, zásuvkový blok, skříňka se zásuvy na GN) je hotové podle
smlouvy `ZADANI-PODESTAVBY-MONO.md`.

**Ze seznamu úkolů tím nezbývá nic k řešení.** Otevřené položky v ČÁSTI C
jsou už jen ty, které zadavatel vědomě odložil (úkol 12) nebo které čekají
na jeho pokyn (viz „Menší věci zbývající" níž). Další práce potřebuje nové
zadání — nejblíž jsou nedodělky z ČÁSTI B3: přístroje se ve 3D u MONO
kreslí jen jako varná plocha na desce (bez výřezu), nástavby nad blokem
se nedělají vůbec a logo ALBA se nevykresluje.

**Pozor na latentní vady z merge katalogu:** funkce psané ve forku před
ostrovem mohou sahat na stará pole bez přípony A/B — jedna taková
(`usedCatalogTypes` četla `state.mono.herdblok`, čímž PADALO UKLÁDÁNÍ)
byla nalezena a opravena 31. 8. 2026. Při další práci na `main.js` mít
oči otevřené.

**U výšky soklu a pracovní výšky ROZHODNUTO (31. 8. 2026): nová logika
platí i pro SEGMENT.** Viz ÚKOL 13 v ČÁSTI C a ČÁST E.

## Zbývá — úkol 6, ostrovní varianta

Tlačítko Ostrov v rozhraní existuje, ale **nic nedělá**. Toto je poslední
velký kus a **nedá se rozdělit mezi souběžné agenty**, protože sahá do
`js/mono-geometry.js`, `js/mono-block.js`, `js/main.js`, `js/mono-ui.js`
i `js/ui.js` naráz. Je to **práce na celou session**. Nezačínat ji na
konci dne — pokud zůstane rozdělaná, zůstanou rozpracované změny v
několika souborech najednou.

## Vstupy rozhodnuté — neměnit

Zadavatel schválil následující. Jsou to součásti specifikace. Ověřit v
ČÁSTI C úkol 6 a ČÁSTI E:

- **Deska je jediná** a průběžná přes obě strany, v hloubkách A+B. Ne dvě
  desky proti sobě se spárou uprostřed.
- **Boční panel u ostrova** jde od čela k čelu (přední i zadní konec,
  obě strany) a zakrývá i mezeru mezi zády obou podestaveb.
- **Ostrov má JEN boční límce** (na levé i pravé straně). Zadní límec se u
  varianty `island` vůbec nenabízí v UI.
- **U zkoseného vodopádu u ostrova** (`svislaDeskaZkos`) mohou být zkosené
  **všechny rohy** (všechny čtyři rohy jsou viditelné, protože ostrov
  obchází po obou stranách). Oproti variantě u stěny, kde jsou zkosené jen
  přední rohy.
- **Dnes se `island` chová jako `single`** — v kódu zbývá doplnit logiku.
  Místa: TODO v `js/main.js` kolem řádku 519 a v `cornerPoints()` v
  `js/mono-geometry.js`.

## Zbývá — zrcadlení ramen a přístrojů

U ostrova se musí doplnit i **zrcadlování ramen a přístrojů** stejným
způsobem, jako je řeší `mirrorX` v `js/mono-block.js` u ostatních prvků.
Rameno sedí na spáře mezi stranami A a B (ve středu bloku). U varianty
ostrova se odsazuje od tohoto středu k jedné nebo druhé straně
(konstanty `ARM_CENTER_OFFSET_MIN`, `ARM_CENTER_OFFSET_MAX`,
`ARM_CENTER_OFFSET_DEFAULT` v `js/arms.js`, na rozdíl od varianty u
stěny, která používá `ARM_BACK_OFFSET_*` a odsazuje se od zadní hrany).
Poloha po délce se zrcadlí přes `mirrorX` a **úhel se neguje** —
zrcadlením osy X se mění i smysl otáčení kolem Y, stejně jako u
varianty u stěny.

Zároveň ověřit chování **přepínače strany A/B** ve spodním pásu Herdblok
— v UI se objeví jen pro variantu `island` a musí správně přepínat mezi
stranami při měření a vykreslování.

## Menší věci zbývající — bez pokynu neřešit

Každá z těchto položek se **nemá dělat bez explicitního pokynu
zadavatele**, i když je zapsaná tady:

- **Úkol 12** — Přeplněná položka se ve 3D kreslí za koncem bloku.
  Zadavatel to 8. 8. 2026 viděl a nechal tak. Uživatel si to sám vyřeší.

- **Radius u SEGMENTu** — SEGMENT nestaví hygienický radius v koutech
  podestavby vůbec (pro žádnou úpravu H1, H2, HS+). U MONO se od
  8. 8. 2026 rozlišuje. Produkty se v tomhle rozešly, není to regrese.

- **Vana fritézy** — Sahá asi 130 mm pod rovinu pracovní desky a protíná
  ji. Není to regrese, stejně se to chová u SEGMENTu. Je to vlastnost
  `buildFryerTop()` v `js/modules.js` — kreslit přístroje bez výřezu v
  desce.

- **Přestavba katalogu** — Samostatný, zcela neřešený úkol. Viz
  `ZADANI-KATALOG.md`. Přístroje mohou v katalogu zmizet, proto se do
  projektu ukládají jejich definice.

- **Logo ALBA ve 3D** — Nevykresluje se. Diagnóza je hotová, oprava je
  odložená na pokyn zadavatele.

## Na co nezapomenout

Dvě věci, které právě stály čas:

- **Plný proplach keše PŘED KAŽDÝM MĚŘENÍM V PROHLÍŽEČI.** Podle ČÁSTI A2
  — seznam nyní pokrývá všech 18 modulů. Starší verze obnovovala jen 7 a
  dvakrát proto vznikla falešná hlášení vady. Bez něj si agent domyslí, že
  něco nefunguje, ale jeho měření je na staré verzi.

- **Každý agent si píše měřicí harness do VLASTNÍ PODSLOŽKY** v dočasném
  adresáři (`scratchpad/agent-N/` apod.) a nepřepisuje nic, co by patřilo
  jinému agentovi. Dva agenti si jednou přepsali stejně pojmenovaný stub
  pro `three` a způsobili si navzájem problémy.
