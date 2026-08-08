# Předání — stav k 5. 8. 2026 večer

> **AKTUALIZOVÁNO PO DOKONČENÍ.** Práce se přerušila, pak se v ní
> pokračovalo a **všech sedm balíků je hotových a ověřených v prohlížeči**.
> Oddíly 1 a 2 níže popisují nedokončený mezistav a jsou PŘEKONANÉ —
> platný je oddíl 8 na konci souboru. Nechávám je kvůli dohledatelnosti.

Pořadí závaznosti zdrojů:
`HODNOTY-MONO.md` → `ZADANI-MONO-UI.md` → tenhle soubor →
`PREDANI-2026-08-05.md` → `PREDANI-NOVA-SESSION.md` → `SPEC-HERDBLOK.md` → kód.

---

## 1. JEDINÁ VĚC, KTEROU JE TŘEBA UDĚLAT HNED

**`js/mono-ui.js` je ZÁTKA, ne hotová práce. Přepiš ji celou.**

Balík A4 (spodní pás MONO, `ZADANI-MONO-UI.md` §3) se nestihl — agent byl
zastaven dřív, než napsal jediný řádek. Soubor `js/mono-ui.js`, který dnes
v repozitáři je, napsal až po něm hlavní agent, a to z jediného důvodu:
`js/ui.js` ho importuje, a bez existujícího souboru by se **nenačetla celá
aplikace**, včetně produktu SEGMENT.

Zátka drží aplikaci spustitelnou a u projektů MONO vypíše do pásu poctivou
hlášku. Nic z jejího obsahu není použitelné jako základ.

Zadání pro pokračování je hotové a nezměněné: `ZADANI-MONO-UI.md` §3 (co
modul dělá), §4 (callbacky), §5 (překladové klíče), §6 (CSS třídy).
Vizuální předloha je `mockup-mono.html` — proklikatelná, s prefixem tříd
`mk-`, který se v aplikaci mění na `mono-`.

---

## 2. Stav balíků

Práce byla rozdělená na sedm balíků tak, aby si žádní dva nesáhli na týž
soubor. Zadání pro všechny je `ZADANI-MONO-UI.md`.

| balík | soubory | stav |
|---|---|---|
| A1 překladové klíče | `js/i18n.js` | **hotovo, ověřeno** |
| A2 CSS pásu | `css/style.css` | **hotovo, ověřeno** |
| A3 výpočet rozvržení | `js/mono-layout.js`, `index.html` | **hotovo, ověřeno** |
| A4 spodní pás | `js/mono-ui.js` | **NEUDĚLÁNO — jen zátka** |
| A5 stav a ukládání | `js/main.js` | **kód hotový, NEOVĚŘENO** |
| A6 geometrie panelu | `js/mono-geometry.js`, `js/mono-block.js` | **kód hotový, NEOVĚŘENO** |
| A7 výhybka | `js/ui.js` | **hotovo, ověřeno** |

„Ověřeno" = ověřil hlavní agent nezávisle, ne že to jen tvrdí autor balíku.

### Co je ověřené a jak

- **A1**: klíčů `mono.*` je 36, každý přesně 5×. Jazykové bloky jdou v pořadí
  en, de, pl, cs, sk a hodnoty v nich sedí — kontrolováno na
  `mono.tab.podestavby`, `mono.item.cabinet`, `mono.fillBtn`, `mono.missing`,
  `mono.collar.back`. Čeština a slovenština jsou skutečně rozlišené
  (`Skříňka`/`Skrinka`, `chybí`/`chýba`). Soubor 1717 → 1907 řádků.
- **A2**: 2276 → 2792 řádků, závorky sedí (381/381). Do `:root` přibyly
  `--warn` a `--warn-soft`.
- **A3**: modul je čistý (jediný import je `sideInsetMM`, `checkSupport`,
  `END_TYPES` z geometrie; žádný DOM, `window` ani `THREE`). Spočítané
  hodnoty sedí: podestavby 50 / 850 / 1250, chybějící úsek 370 mm od 2050,
  herdblok 0 / 185 / 705 / 805 / 1325 / 1425 / 1825 se zbytkem 0.
  `index.html` má nový uzel `#mono-strip-body` jako sourozence `.strip-body`.
- **A7**: zásah 142 řádků, SEGMENT prochází nezměněnou cestou.

### Co JE napsané, ale NIKDO to neověřil

**A5 (`js/main.js`)** — agent byl zastaven uprostřed přepisu `applyConfig`.
Soubor prochází `node --check` a při zběžné kontrole obsahuje všechno, co měl:
`CONFIG_VERSION = 5`, `defaultMonoCollar()`, `sanitizeMonoCollar()`,
serializaci všech čtyř nových polí, tolerantní čtení, handlery `onMono*`.
**Ale je to nedokončený zásah** — poslední, co agent hlásil, bylo, že se
chystá přepsat blok s kontrolou verze. Než se na `main.js` spolehneš:
1. Přečti si `applyConfig()` celý a ověř, že sanitizace nových seznamů běží
   AŽ PO sloučení katalogu (agent to zmiňoval jako záměr).
2. Ověř, že `nextId` se po načtení souboru posune za nejvyšší `id` napříč
   segmenty, rameny I novými seznamy MONO — jinak se začnou srážet id.
3. Ověř, že se starý soubor verze 4 načte bez chyby.

**A6 (`js/mono-geometry.js`, `js/mono-block.js`)** — agent byl zastaven při
psaní ověřovacího skriptu, tedy až ZA prací na zdrojácích. Oba soubory
procházejí `node --check`, `deriveRow` je pryč, `computeMonoLayout` je
zapojený, `PANEL_ITEM` i `buildPanelItem` existují. Chybí ale doložení
skutečnými souřadnicemi. Než se na geometrii spolehneš, spočítej přes
`THREE.Box3`:
- `buildPanelItem` pro `socket230` na x 400, výška 100 — `z` musí být celé
  > 0 a ≤ 25 (tvrdá podmínka: nic v panelu nesmí předsazovat před líc desky).
- blok 2490, vlevo `svislaDeska`, vpravo `svislaDeskaZkos`, zadní límec 100 —
  rozsah dílu `limec-back`.
- prvek panelu na x 10 (v koncové zóně) se NESMÍ vykreslit.

> **Past**: `Box3.setFromObject` na potomka nepřepočítá matice rodičů. Zavolej
> nejdřív `group.updateMatrixWorld(true)`, jinak dostaneš lokální souřadnice
> a budeš si myslet, že je to vada.

---

## 3. Dvě vady, které hlavní agent opravil sám

Obě ležely na švu mezi balíky, takže je nemohl opravit žádný z autorů.

1. **`.strip-body[hidden]` chybělo v `css/style.css`.** `.strip-body` má
   natvrdo `display: flex`, takže atribut `hidden`, kterým `ui.js` pás
   schovává, by se neuplatnil a **oba pásy by se kreslily přes sebe**.
   Doplněno u řádku 1340, s komentářem ve stylu, jaký soubor pro tuhle past
   už má u `.field-row` a `.dim-row`.
2. **`--accent-darker` chyběl v seznamu povolených proměnných v `ZADANI-MONO-UI.md` §6**,
   ačkoli v `:root` je a používají ho všechna ostatní plná tlačítka. Autor
   balíku A2 se držel zadání doslova a raději vynechal hover; doplněno na
   `.mono-param-add:hover`.

A do třetice vada v **samotném zadání**, kterou zachytil autor A7 a je
opravená v kódu, ale ne v `ZADANI-MONO-UI.md` §8: snippet tam staví výhybku
na MONO PŘED řádek `lastStripState = state;`. To je špatně — `lastStripState`
čte handler tlačítka „Nový projekt" a při `null` vyhodnotí sestavu jako
prázdnou, takže by se u MONO **vždycky přeskočil potvrzovací dotaz** a
rozdělaná práce by zmizela bez ptaní. V `js/ui.js` je to správně (přiřazení
je první), ale **§8 zadání je pořád vadné — opravit**.

---

## 4. Nedořešené drobnosti

- **Tři CSS třídy nejsou v `ZADANI-MONO-UI.md` §6**, ale v `css/style.css`
  existují, protože je autor A2 potřeboval: `.mono-ruler-row`,
  `.mono-point-selected`, `.mono-switch-on`. Až se bude psát `mono-ui.js`,
  **musí použít přesně tyhle názvy** — §6 zná jen obecné `.mono-tile-selected`.
  Když se sáhne jiným jménem, výběr bodového prvku a stav „zapnuto" u
  přepínače se vizuálně neprojeví. Doplnit je do §6.
- **`.mono-diagram-cap`** (popisek pod schématem límce, v mockupu
  `.mk-diagram-cap`) se do §6 nedostal a A2 ho proto nezavedl. Buď ho doplnit
  do CSS, nebo v `mono-ui.js` popisek nekreslit.
- **`onMonoTabChange`** je v zadání na dvou místech (§4 i §8) a nebylo jasné,
  kdo ho vlastní. `js/ui.js` to vyřešil tak, že ho zachytí pro filtr palety
  a zároveň propustí dál do `main.js`. Zapsat to do §4.

---

## 5. Co je mimo rozsah tohohle kola (nezměněno)

Platí `ZADANI-MONO-UI.md` §0:

- **Přístroje se ve 3D nekreslí.** `mono-geometry.js` je nikdy v rozsahu
  neměl. V pásu budou a ovlivní rozvržení, kontroly i uložený soubor, ale ve
  scéně vidět nejsou.
- **Nos (monolitický bok) se neřeší** — pořád chybí tvar zkoseného konce.
  Zůstává hlavní známou vadou vzhledu, viz `PREDANI-2026-08-05.md` §1.
- **Ostrovní MONO** se chová jako blok u stěny.

---

## 6. Stav repozitáře při zastavení

Nic není zacommitované — všechno leží v pracovním stromu.

```
 M css/style.css      A2 + dvě opravy hlavního agenta
 M index.html         A3 (jeden řádek)
 M js/i18n.js         A1
 M js/main.js         A5 — NEOVĚŘENO
 M js/ui.js           A7
?? js/mono-layout.js  A3 (nový)
?? js/mono-ui.js      ZÁTKA — přepsat
?? js/mono-block.js   A6 — NEOVĚŘENO (soubor byl nový už dřív)
?? js/mono-geometry.js A6 — NEOVĚŘENO (soubor byl nový už dřív)
?? ZADANI-MONO-UI.md  smlouva rozhraní
?? mockup-mono.html   vizuální předloha
```

**Všech 18 modulů v `js/` prochází `node --check`.** Aplikace by se měla
načíst; u projektu MONO se v pásu objeví hláška ze zátky. **Ověřeno nebylo
načtení v prohlížeči** — na to už nezbyly kredity.

---

## 7. Doporučené pořadí při pokračování

*(Splněno — viz oddíl 8.)*

---

## 8. STAV PO DOKONČENÍ — tohle je platné

Všech sedm balíků je hotových. Ověřeno v běžící aplikaci na
`http://localhost:8000`, měřením přes `javascript_tool`, ne ze screenshotů.

### Co funguje

- **SEGMENT je nedotčený.** Odznak, obě záložky, čtyři karty v pásu,
  16 položek palety, kapacita `Used 2000 / 3160 mm`, čistá konzole.
- **Pás MONO** má pět záložek (Herdblok, Podestavby, Čelní panel, Límce,
  Napouštěcí ramena), všechny se vykreslí bez výjimky.
- **Volba 1B** funguje celým řetězcem: klik na koncovku → přepnutí typu →
  koncová zóna 50 ↔ 70 mm → přepočet chybějícího úseku → přestavba 3D.
- **Volba 2A**: tlačítko Doplnit dorovná řadu jednou skříňkou, oranžové
  hlášení zmizí.
- **Měřítko je přesné**: při délce 2500 vyšla zóna 70 mm na 2,8 %,
  skříňka 2380 mm na 95,2 %, zóna 50 mm na 2 %.
- **Ztlumení** je správně po dlaždicích, ne po dráze.
- **Převis** má nově mez **1200 mm** (bylo 500), viz `HODNOTY-MONO.md` §7.6.

### Vady nalezené a opravené v tomhle kole

| kde | vada | dopad |
|---|---|---|
| `css/style.css` | `.strip-body` bez `[hidden]` přepisu | oba pásy se kreslily přes sebe |
| `js/main.js` | `ui.setProductType()` až PO `rebuildBlock()` | pás zůstal po založení MONO segmentový |
| `js/main.js` | `onNewProject` neresetoval nová pole `state.mono` | uložení nového MONO projektu padalo |
| `js/main.js` | chyběly VŠECHNY handlery `onMono*` | pás se vykreslil, ale nic v něm nefungovalo |
| `js/mono-geometry.js` | `buildCollarWall()` rotace `atan2(dx,dz)` | **límec byl o 90° otočený a trčel kolmo z desky** |

Ta poslední je nejzávažnější a byla by na první pohled neviditelná
v číslech, ale okamžitě zjevná v 3D. Správně je `atan2(-dz, dx)`: rotace
kolem osy Y mapuje lokální +X na `(cos θ, 0, −sin θ)`, takže srovnání se
směrem `(dx, dz)` vyžaduje `cos θ = dx/L` a `sin θ = −dz/L`.

### Vady v ZADANI-MONO-UI.md, které se ukázaly až při psaní

Zadání **je pořád vadné**, kód je správně. Opravit:

1. **§8** staví výhybku na MONO před `lastStripState = state;`. Musí být za
   ním, jinak se u MONO vždycky přeskočí potvrzovací dotaz u „Nový projekt".
2. **§4** pojmenovává callbacky ramen `onArmAdd/onArmChange/onArmRemove`.
   Takové neexistují. Skutečné jsou `onAddArm`, `onRemoveArm`,
   `onArmPositionChange`, `onArmOffsetChange`, `onArmAngleChange`.
3. **§6** nezná `.mono-ruler-row`, `.mono-point-selected`, `.mono-switch-on`
   (v CSS jsou a používají se) a naopak slibuje `.mono-diagram-cap`, která
   neexistuje.
4. **§5** je psané „česky napřed", ale hlavička říká pořadí en, de, pl, cs, sk.
5. **§4** neříká, kdo vlastní `onMonoTabChange` — `ui.js` ho zachytí pro
   filtr palety a zároveň propustí do `main.js`.

### Co zbývá — otevřené, vyžaduje rozhodnutí zadavatele

1. **Katalogové přístroje v dráze Herdblok ukazují syrový klíč katalogu**
   místo jména („Indukční deska"). Důsledek pravidla, že `mono-ui.js` nesmí
   importovat `catalog.js`. Přeložit jméno umí jedině `ui.js` — chce to malé
   rozšíření rozhraní mezi nimi.
2. **Položky nejdou přeuspořádat.** Callback `onMonoMove` existuje, ale nic
   ho nevolá — mockup žádné tlačítko pro přesun neukazoval. U seznamu, který
   se klade po sobě zleva doprava, je přitom pořadí to hlavní, čím se
   sestava tvoří.
3. **Prázdný nový projekt MONO hlásí rovnou „chybí 2400 mm".** Podle zadání
   správně, ale vypadá to jako chyba. Buď hlášení potlačit, dokud je řada
   úplně prázdná, nebo nový projekt předvyplnit skříňkami jako u SEGMENTu.
4. Pruh parametrů u záložky Límce v mockupu měl pole (délka, tloušťka
   plechu, odsazení od hrany), pro která v `MonoCollar` nejsou data. Autor
   je vynechal místo vymýšlení čísel — doplnit do modelu, nebo z mockupu
   škrtnout.

---

## 9. DRUHÁ VLNA — zadání z 5. 8. večer, po prvním předání

Zadavatel po vyzkoušení aplikace nahlásil další vady a přání. Čtyři balíky
(B1–B4) jsou hotové, **ale žádný z nich není ověřený v prohlížeči** — práce
se přerušila kvůli kreditům dřív, než se k tomu došlo. Všechny soubory
procházejí `node --check`, CSS má vyrovnané závorky.

### Hotové (kód napsán, NEOVĚŘENO za běhu)

| balík | co | soubory |
|---|---|---|
| B1 | přeuspořádání položek šipkami, přidání prázdného prostoru z pásu, spotřeba `deviceName` | `js/mono-ui.js` |
| B2 | pořadí přidávání, předvyplnění nového MONO projektu | `js/main.js` |
| B3 | čitelná jména přístrojů, prázdný prostor v paletě | `js/ui.js` |
| B4 | límce už nepřesahují půdorys desky | `js/mono-geometry.js` |

Plus dvě opravy hlavního agenta: mez převisu 500 → **1200 mm**
(`OVERHANG_LIMIT_MM`, zapsáno i v `HODNOTY-MONO.md` §7.6) a nová neutrální
třída `.mono-param-icon-btn`, protože šipky posunu recyklovaly třídu koše
a dědily z ní červenou `--danger`.

B4 doložil límce měřením: front z 0–20, back z 830–850, left x 0–20,
right x 2470–2490, všechny y 900–1000, nikde záporné z.

### !!! NEDOŘEŠENÉ — pravděpodobně ŠPATNÁ oprava v B2 !!!

Zadavatel nahlásil: „Skříňky se přidávají zprava místo zleva."
Autor B2 to opravil změnou `push` → **`unshift`** v `onMonoAdd`, tedy nová
položka jde vždy na ZAČÁTEK seznamu.

**Tomu nevěřím a nestihl jsem to ověřit.** Jeho zdůvodnění bylo, že
s `push` „každá další položka padá dál doprava" — jenže přesně tak se řada
staví zleva doprava a je to normální. S `unshift` platí, že když přidáš
postupně A, B, C, v pásu je uvidíš jako **C, B, A** — tedy v obráceném
pořadí, než jsi je zadal. To je pravděpodobně horší než původní stav.

Co udělat jako první při pokračování:
1. Spustit aplikaci, založit MONO projekt a přidat do Herdbloku dva různě
   široké přístroje za sebou. Zjistit, v jakém pořadí skutečně leží.
2. Pokud vyjde obráceně, vrátit `unshift` zpět na `push` a zjistit, co
   zadavatel doopravdy viděl — původní hlášení „zprava" možná mířilo na
   jiné chování (například na tlačítko Doplnit, které záměrně přidává na
   konec, nebo na paletu, která tehdy prázdný prostor vůbec nenabízela).
3. `onMonoFillPodestavby` zůstal na `push` záměrně — dorovnává chybějící
   úsek na konci řady, tam je připojení na konec správně.

### Nedodělek: OSTROV

Zadavatel nahlásil, že tlačítko Ostrov nepřidá druhou řadu přístrojů ani
druhý panel a že chybí přepínač A/B ve spodním pásu. **Není to regrese** —
ostrovní varianta byla vědomě mimo rozsah (§0 `ZADANI-MONO-UI.md`). Ale
tlačítko v rozhraní je a nic nedělá, což je horší, než kdyby tam nebylo.

Je to největší zbývající kus: sahá do `mono-geometry.js`, `mono-block.js`,
`main.js`, `mono-ui.js` i `ui.js` naráz, takže se nedá rozdělit mezi
souběžné agenty.

**Blokující otázky na zadavatele — položené, NEZODPOVĚZENÉ:**
1. Sdílejí obě strany jednu průběžnou pracovní desku hloubky A+B, nebo má
   každá strana vlastní desku se spárou uprostřed?
2. Jak vypadá bok ostrova, když je viditelný z obou stran? Zakončení
   vodopád/zkosený vodopád je popsané pro blok u stěny a zadní límec
   u ostrova nedává smysl.

Bez odpovědí by se tvar musel domýšlet, což tenhle projekt dělat nemá.

---

## 10. TŘETÍ VLNA — zpětná vazba zadavatele po vyzkoušení B1–B4

### Hotovo a zapsáno

- **Límce jsou v pořádku** — zadavatel potvrdil. Balík B4 uzavřen.
- **`unshift` vrácen zpět na `push`** (`js/main.js`, `onMonoAdd`). Zadavatel:
  „nové položky by se neměly přidávat na začátek, ale na konec řady. Takto
  je to neintuitivní." Moje pochybnost z §9 se potvrdila — přidávání na
  konec je správné. Komentář u kódu je přepsaný, ať další čtenář ten obrat
  pochopí a nevrátil ho.
- **Tlačítko „volný prostor" z pruhu parametrů odstraněno** (`js/mono-ui.js`,
  `buildPodestavbyParamBar`). Zadavatel: „z uživatelského hlediska je to
  prostě další podestavba, která je ale prázdná — ať je pro přidání jen na
  levém pásu, kde budou varianty podestaveb." Prázdný prostor se tedy přidává
  VÝHRADNĚ z palety. V paletě už je (`MONO_TAB_SPECIALS` v `ui.js`).

### !!! HLAVNÍ NEDOŘEŠENÁ VADA: 3D scéna má převrácenou osu X !!!

Zadavatel: „strany má agent pořád popletené. A netýká se to jen skříněk
a přístrojů, ale třeba i límců. Když se dívám na blok zepředu — pohled na
panel. Schéma dole vypadá dobře, ale na 3D grafice se vše ukazuje obráceně —
vlevo je vpravo a vice versa."

**Tohle je pravá příčina i původního hlášení „skříňky se přidávají zprava".**
V pásu položka přibývala vpravo správně; ve 3D se objevila na opačné straně.
Předchozí agent to špatně diagnostikoval jako vadu pořadí pole a „opravil"
to na `unshift` — proto to teď vypadalo, že se přidávají zleva, ale zároveň
se rozbilo pořadí. Obojí je vráceno; **skutečná vada je v ose X a je pořád
tam.**

Zasahuje VŠECHNO, co má levou a pravou stranu: přístroje, podestavby, límce,
boční kryty, koncové zóny i typy zakončení (vodopád vs. zkosený).

Kde hledat:
- `js/mono-block.js` řádek ~131: `group.position.x = -mm(lengthMM) / 2;`
  Tenhle posun jen vystředí blok, nezrcadlí ho — sám o sobě to není on, ale
  je to jediné místo, kde `mono-block.js` do osy X sahá.
- `js/mono-geometry.js` staví od x=0 doprava (viz hlavička, „x = 0 je LEVÝ
  konec bloku"). Otázka je, jestli „levý" v jeho smyslu odpovídá tomu, co
  uživatel vidí vlevo v čelním pohledu.
- `js/viewer.js` / `computeViews()` — definice čelního pohledu. Pokud kamera
  stojí na záporném z a dívá se na +z, pak se světové +x promítne na obrazovku
  DOLEVA, a všechno se zrcadlí. Porovnej s tím, jak je na tom SEGMENT
  (`block.js`) — ten je vystředěný kolem nuly a zadavatel u něj zrcadlení
  nehlásil, takže rozdíl mezi oběma produkty je nejrychlejší stopa.

**Postup, který doporučuju:** nejdřív změřit, ne opravovat. Postavit MONO
blok s jednou skříňkou u levého konce, zjistit její světovou souřadnici x
přes `Box3`, a porovnat se stranou, na které se jeví v čelním pohledu.
Teprve pak rozhodnout, jestli se má zrcadlit geometrie, nebo kamera.

Nezrcadlit „až v UI" — pás i geometrie musí mluvit o téže straně.

### ~~Šipky přeuspořádání — zadavatel je nevidí~~ PŘEKONÁNO §12

> **Neplatí.** Šipky fungují, zadavatel je jen hledal na místě, kde je má
> SEGMENT. Obě domněnky níž (keš, výběr položky) jsou vedle. Platné zadání
> je v §12 — šipky se přesouvají na dlaždice.

Zadavatel: „ty šipky pořád nevidím ani v pásu přístrojů, ani v pásu
podestaveb."

V kódu JSOU (`js/mono-ui.js`, `buildHerdblokParamBar` a
`buildPodestavbyParamBar`). Dvě pravděpodobné příčiny, v tomhle pořadí:

1. **Prohlížeč drží starý modul v keši.** Narazili jsme na to opakovaně —
   aplikace kreslí starou verzi, i když server servíruje novou. Než cokoli
   jiného: protlačit keš (viz „Past, která stála čas" níž) a zkusit znovu.
2. **Šipky se kreslí jen u VYBRANÉ položky**, protože celý pruh parametrů
   se plní až po kliknutí na dlaždici. Dokud není nic vybráno, pruh je
   prázdný. To je funkčně správně, ale zadavatel to takhle nemusí objevit.
   Zvážit, jestli u položek nemají být šipky přímo na dlaždici (jako je má
   SEGMENT na kartách), místo schované v pruhu parametrů.

Ověřit obojí, než se začne cokoli přepisovat.

---

## 11. ODPOVĚDI ZADAVATELE — odblokovávají nos i ostrov

Zapsáno 5. 8. večer, **nic z toho ještě není v kódu.** Tohle je zadání
pro příští kolo.

### Skladba boku — konečně dodaná

Zadavatel (doslova): „bavíme se o vodopádu, přetéká v celé své šířce na bok
herdbloku a celý ho zakrývá. Potom pokračuje boční panel, který zcela
a přesně zakrývá podestavbu. Boční panel u ostrova zakrývá obě podestavby
od čela k čelu a zakrývá tak i mezeru mezi jejich zády."

Bok bloku jsou tedy **dva díly nad sebou, oba přes celou hloubku**:

1. **Vodopád** — pracovní deska přetéká přes bok herdbloku v CELÉ své šířce
   a zakrývá ho celý. Ne zúžený pruh, ne jen čelo.
2. **Boční panel** — navazuje pod ním a zakrývá podestavbu **zcela a přesně**
   (tedy přesně na její rozměr, žádný přesah ani mezera).

U ostrova jde boční panel **od čela k čelu** a zakrývá i mezeru mezi zády
obou podestaveb — je to jeden průběžný kus, ne dva.

> Tím padá otevřená otázka č. 1 z `PREDANI-2026-08-05.md` §4 i poznámka
> „tvar zkosení není dodaný" — pro vodopád je skladba jednoznačná. Pro
> `svislaDeskaZkos` zbývá potvrdit jen tvar samotného zkosení.

### VADA: vodopád pořád nefunguje, deska je zúžená

Zadavatel doložil screenshotem pohledu z boku. Vidět je, že pracovní deska
je nahoře jen tenký přesahující plát a bok herdbloku pod ním ustupuje —
je tam schod a nahoře vpravo viditelné zúžení/zkosení. Má to být JEDEN
monolit přes celou výšku herdbloku.

Je to táž vada, kterou popisuje `PREDANI-2026-08-05.md` §1 („Bok herdbloku
musí být MONOLIT") a která byla dosud odložená kvůli chybějícím rozměrům.
**Rozměry teď dodané jsou** (viz výše), takže je to odblokované.

Souvislost: v `mono-geometry.js` na to čekají nepoužité konstanty
`NOSE_FRONT_MM` a funkce `noseFrontMM()`, a taky `DESK_OVERHANG_SIDE_MM`
s poznámkou „bok desky (nos) není dodaný tvar". Ty poznámky bude potřeba
přepsat.

### OSTROV: jedna průběžná deska

Zadavatel: „chci jednu průběžnou desku."

Tedy **ne** dvě desky proti sobě se spárou uprostřed. Jedna deska přes obě
strany, hloubky A+B. Boční panel u ostrova viz výše — jeden kus od čela
k čelu.

Zbývá dořešit (nepoloženo zadavateli): má u ostrova smysl zadní límec?
Ostrov nemá záda. Pravděpodobně se má nabízet jen boční, ale potvrdit.

### ~~Keš~~ VYŘEŠENO

Keš to nebyla. Šipky fungují, viz §12.

### POŘADÍ PRO PŘÍŠTÍ KOLO — platný seznam

Tohle je jediný závazný seznam úkolů. Starší seznamy výš jsou překonané.

1. **Převrácená osa X ve 3D** (§10) — nejzávažnější, zasahuje všechno, co má
   levou a pravou stranu (přístroje, podestavby, límce, kryty, typy konců).
   **Nejdřív změřit, pak opravovat** — jeden agent ji už jednou špatně
   diagnostikoval a „opravil" úplně jinde.
2. **Vodopád / monolitický bok** (§11) — odblokovaný, skladba boku dodaná.
3. **Zkosený vodopád** (§12) — tvar zkosení se vůbec nekreslí. Řešit
   společně s bodem 2, je to týž díl.
4. **Boční kryt 20 mm** u zkoseného konce s podestavbou (§12) — zapsat i do
   `HODNOTY-MONO.md`.
5. **Šipky přeuspořádání na dlaždice** (§12) — vyřešit i chování u úzkých
   dlaždic.
6. **Ostrov** (§11) — jedna průběžná deska, boční panel od čela k čelu.
7. Drobnosti ze screenshotu (§12) a opravy `ZADANI-MONO-UI.md` (§8).

---

## 12. ÚKOLY Z POSLEDNÍ ZPĚTNÉ VAZBY — nic z toho není v kódu

### VADA: zkosený vodopád se ve 3D nekreslí

Zadavatel: „ve 3D se neukazuje zkosený vodopád. Správně se rozšíří boční
svislá deska na 70 mm, ale není tam žádné zkosení."

Zatažení podle typu konce tedy funguje (`sideInsetMM` vrací 50/70 správně),
ale samotný TVAR zkosení se nestaví. Sedí to s tím, co modul o sobě říká:
`END_STRAIGHT_MM` (20), `END_CHAMFER_MM` (50) a `CHAMFER_ANGLE_DEG` (45)
v `mono-geometry.js` mají u sebe poznámku „TODO: zatím se nepoužívá".

Souvisí s §11 (monolitický bok / vodopád) — je to týž díl, jen druhý typ
konce. Řešit spolu, ne zvlášť.

### NOVÉ ROZHODNUTÍ: boční kryt 20 mm u zkoseného konce

Zadavatel: „pokud tady bude blok ukončen zkoseným vodopádem s podestavbou,
použijme spodní krycí panel jen 20 mm. Myslím, že to bude vypadat lépe."

Dosavadní pravidlo (`HODNOTY-MONO.md`, boční kryt má dvě tloušťky 50 a 20):
50 tam, kde podestavba sedí co nejvíc na kraji bloku, jinak 20. **Nově
přibývá výjimka:** je-li na daném konci `svislaDeskaZkos` a je tam
podestavba, použije se kryt **20**, ne 50.

Zapsat i do `HODNOTY-MONO.md`, ať pravidlo nežije jen v kódu.

### PŘEDĚLAT: šipky přeuspořádání patří NA DLAŽDICE, ne do pruhu parametrů

Zadavatel: „ty by stejně měly být na bocích těch přístrojů a podestaveb,
ne? Ne ve spodním pruhu?"

**Šipky FUNGUJÍ** — nejsou rozbité. Zadavatel je nakonec našel: „tak ty
šipky tam jsou, jen jsem to nepochopil, hledal jsem je na stejném místě
jako v SEGMENTU."

**Tohle je ten nejsilnější důvod k přesunu.** Nejde o vadu provedení, ale
o vadu zadání — do pruhu parametrů je poslalo moje zadání balíku B1 („Kam
s ním: do pruhu parametrů vybrané položky, vedle koše"). Agent to udělal
přesně tak, jak jsem řekl. Špatně to bylo ze tří důvodů, seřazených podle
závažnosti:

1. **Nekonzistence uvnitř jedné aplikace.** SEGMENT má šipky na kartě
   prvku. Uživatel je v MONO hledal na témž místě a nenašel. Tentýž úkon
   se nesmí ovládat na dvou místech podle toho, jaký produkt je zvolený.
2. Pruh parametrů se plní až po kliknutí na dlaždici, takže dokud uživatel
   nic nevybere, šipky neexistují — a on je nemá jak objevit.
3. Přeuspořádání je operace nad ŘADOU, ne nad jednou vybranou věcí. Patří
   tam, kde je řada vidět.

Nový požadavek: **šipky na levém a pravém boku každé dlaždice** v dráze
Herdblok i Podestavby, viditelné bez předchozího výběru. Z pruhu parametrů
je odstranit. Krajní dlaždice nemá šipku na příslušné straně.

Pozor na jednu věc: dlaždice jsou úměrné milimetrům, takže úzká položka
(prázdný prostor 100 mm ≈ 40 px) šipky na obou bocích neuveze. Vymyslet
chování pro úzké dlaždice — např. šipky až od nějaké minimální šířky,
u užších jen na hover, nebo je nechat přetékat přes okraj.

### Poznámka k mé chybné úvaze (ať ji nikdo neopakuje)

Původně jsem z toho screenshotu usoudil, že se pruh parametrů OŘEZÁVÁ,
protože obrázek končil hned pod poznámkou o koncových zónách. **Byl to
jen výřez obrazovky, ne celá obrazovka** — z ořezu obrázku se nedá usuzovat
na ořez v rozhraní. Ta hypotéza je neplatná a nemá se po ní pátrat.

### Drobnosti ze screenshotu (nehlášené, ale viditelné)

- Popisek levé koncové zóny je oříznutý — vidět je jen „0 m" místo „50 mm".
- Text „chybí 1300 mm" se překrývá se šrafou a je špatně čitelný.
- Poznámka hlásí „Koncové zóny 50 / 50 mm", ale pravý konec vypadá na
  zkosený vodopád — ověřit, jestli poznámka čte skutečné typy konců, nebo
  jen výchozí hodnoty.

### Past, která stála čas

**Prohlížeč drží staré ES moduly v keši i po běžném načtení znovu.**
Aplikace tvrdošíjně kreslila starou verzi, i když server servíroval novou.
Protlačit se to dá `fetch('/js/…', {cache:'reload'})` na změněné soubory
a teprve pak `location.reload()`.

Poznámka v `PREDANI-2026-08-05.md` §6, že **screenshoty nejsou k dispozici,
už neplatí obecně** — fungují, ale jen když je panel prohlížeče zobrazený,
a vracejí se zmenšené. Na geometrii je pořád spolehlivější měření.
