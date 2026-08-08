# PŘEDÁNÍ — ALBA konfigurátor

Jediný platný předávací dokument. Nahrazuje všechna dřívější předání, která
jsou v `archiv/` a **nemá se do nich chodit** — co z nich bylo živé, je tady.

Referenční soubory, které platí dál: `HODNOTY-MONO.md` (čísla),
`SPEC.md` + `SPEC-HERDBLOK.md` (specifikace), `ZADANI-MONO-UI.md` (smlouva
rozhraní MONO, má známé chyby — viz úkol 8), `ZADANI-KATALOG.md` (samostatný
neřešený úkol), `mockup-mono.html` (vizuální předloha), `README.md`,
`DEPLOY.md`.

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
kompatibilita souborů se neřeší. Formát projektu je **verze 5**.

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

- **Přístroje se ve 3D nekreslí.** `mono-geometry.js` je nikdy v rozsahu
  neměl. V pásu jsou, ovlivňují rozvržení, kontroly i uložený soubor, ale ve
  scéně vidět nejsou. Není to vada, je to nedodělek.
- **Nástavby nad blokem** (roštová nástavba, police na salamandr) — odloženo.
- **Přestavba katalogu** — samostatný úkol, viz `ZADANI-KATALOG.md`.
- **Logo ALBA ve 3D** se nevykresluje. Diagnóza hotová, oprava odložena na
  pokyn zadavatele.

## B4. Rozdělaná práce — NEOVĚŘENO

V pracovním stromu jsou **nezakomitované změny ve dvou souborech**:
`js/modules.js` (přidáno jediné slovo `export` u dispatcheru
`applyTopFeature`) a `js/mono-block.js` (osazení přístrojů na desku, ~65
řádků).

Jde o **vykreslování přístrojů ve 3D**. Zadavatel je chtěl vidět; rozhodl,
že se v tomhle kole dělá **BEZ výřezu v desce** — přístroj sedí na rovině
desky, deska zůstane celá. Výřez je odložený, deska se staví z obrysu přes
`THREE.Shape`, který díry umí.

**Oba soubory procházejí `node --check`, ale NIKDY neproběhlo měření.**
Agent byl zastaven těsně před přejímkou. Nevěřit tomu, dokud se to nezměří.

Co se musí ověřit, než se to přijme: (a) úzký přístroj, v pásu první zleva,
musí vyjít na KLADNÉM world X; (b) položka `type: 'surface'` se nesmí
vykreslit vůbec; (c) spodek přístroje musí ležet na rovině desky; (d)
žádné záporné `z`; (e) **SEGMENT se nesmí rozbít** — `applyTopFeature`
používá i on, a je to jediné místo, kde šlo poškodit něco, co dosud
fungovalo.

- Dvě poloprůhledné svislé plochy nad rovinou desky jsou **víka fritéz**,
  která staví funkce `buildFryerTop` v `js/modules.js`. Je to správně —
  potvrdil zadavatel 8. 8. 2026. Poznámka je tu jen proto, aby to příště
  nikdo znovu nehlásil jako vadu; **není to nic k řešení.**

---

# ČÁST C — ÚKOLY

Seřazeno podle závažnosti. Jde o jediný závazný seznam.

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

---

# ČÁST D — OTEVŘENÉ OTÁZKY NA ZADAVATELE

Nic z toho se nesmí domýšlet.

## Blokuje geometrii

**Nic. Poslední dvě blokující otázky zadavatel zodpověděl — viz ČÁST E,
poslední odrážka. Geometrie je odblokovaná celá.**

## Nezablokuje, ale je potřeba

**Nezbývá nic. Všechny otevřené otázky jsou zodpovězené** — viz ČÁST E.

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

Pořadí schválil zadavatel 8. 8. 2026. Rozdělení do vln je dáno tím, KDO
SAHÁ DO KTERÉHO SOUBORU — dva agenti nesmí psát do téhož souboru naráz.

## Krok 0 — BLOKUJE VŠECHNO OSTATNÍ

Ověřit rozdělanou práci na přístrojích, viz ČÁST B4. Dokud to visí, jsou
`js/mono-block.js` a `js/modules.js` zamčené a vlna 1 nesmí začít. Výsledek
je binární: buď se to změří a zakomituje, nebo zahodí. Nepřijímat bez
měření.

## Vlna 1 — dva agenti paralelně, soubory se nepřekrývají

**Agent A — úkol 9b, tvar podestavby podle povrchové úpravy.**

Soubory: `js/mono-geometry.js`, `js/mono-block.js`.

`buildPodestavba()` dnes staví dva náběhy `buildH2Fillet` VŽDY. Musí dostat
parametr `finish` a náběhy stavět jen pro `H2`; `H1` a `HS+` mají ostrý roh.
`js/mono-block.js` musí `finish` z KAŽDÉ SKŘÍŇKY ZVLÁŠŤ do geometrie
předat — v jedné řadě můžou stát skříňky s různou úpravou. Ověřit přes
`Box3`, ne okem: u `H2` musí díly náběhu ve scéně být, u `H1`/`HS+` nesmí
existovat vůbec. Navíc ověřit, jestli tutéž vadu nemá SEGMENT
(`js/block.js`, `js/modules.js`) — `finish` má i on.

**Agent B — úkol 9a, vyřadit H3.**

Soubory: `js/modules.js`, `js/mono-ui.js`.

Seznam je na dvou místech a obě se musí změnit, jinak se rozejdou:
`FINISH_TYPES` v `modules.js` (zdroj pravdy) a tentýž seznam přepsaný jako
lokální literál v `mono-ui.js` (modul nesmí importovat `modules.js`). U
literálu doplnit poznámku, že se obě místa musí měnit spolu. Ověřit, že
starý soubor projektu s uloženým `H3` se načte bez chyby a spadne na
výchozí úpravu — soubor se NIKDY neodmítá.

## Vlna 2 — až po vlně 1, drží `js/mono-ui.js`

**Nejdřív mockup, teprve potom aplikace.** Úkol 5 (šipky na dlaždice) má
háček: úzká dlaždice dvě šipky neuveze — prázdný prostor 100 mm je široký
asi 40 px. Zadavatel rozhodl 8. 8. 2026, že se **nakreslí tři varianty
jako mockup do samostatného souboru** a teprve po jeho výběru se sáhne do
aplikace. Do `js/mono-ui.js` ani do `css/style.css` se v téhle fázi
nesahá.

Do **téhož mockupu** patří i varianty řešení pro úkol 11 (přetékající
dráha s dlaždicemi). Diagnóza je potvrzená screenshotem z 8. 8. 2026.
Obojí se nachází ve spodním pásu a má se o tom rozhodnout jedním výběrem,
ne dvakrát.

Potom úkol 7 — drobnosti v pásu.

## Vlna 3 — úkol 6, ostrov

Sám, nedělitelný. Sahá do `mono-geometry.js`, `mono-block.js`, `main.js`,
`mono-ui.js` i `ui.js` naráz. Vstupy, které už jsou rozhodnuté: jedna
průběžná deska přes obě strany, boční panel od čela k čelu, ostrov má JEN
boční límce, a u zkoseného zakončení mohou být zkosené všechny rohy (viz
ČÁST E).
