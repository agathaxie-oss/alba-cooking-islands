# Zadání pro další session — redesign UI, kroky 2 a 3

**Stav:** krok 1 HOTOV a ověřen, kroky 2 a 3 NEIMPLEMENTOVÁNY.
**Rozsah:** dokončit redesign rozhraní konfigurátoru — paleta prvků (krok 2)
a spodní pás se sestavou (krok 3). Vše ostatní z redesignu je hotové.

---

## 0. Jak s tímto dokumentem pracovat

Přečti ho celý, než začneš. Body označené **ROZHODNUTO** už uživatel schválil —
neotvírej je znovu. Body v §8 jsou otevřené a je nutné je probrat PŘED zahájením.

---

## 1. Jak uživatel pracuje

**Hlavní agent zadává a kontroluje, implementaci píší levnější modely.**
Uživatel na to během session dvakrát upozornil. Prakticky to znamená:

- Kód nepiš sám. Napiš podrobné zadání a předej ho Sonnetu (větší úkoly)
  nebo Haiku (drobnosti). Uživatel to formuloval jako „vytvoř podrobné zadání
  pro blbečka a zadej to blbečkovi".
- **Výsledek si vždy ověř sám v prohlížeči.** Agenti v této session opakovaně
  hlásili úspěch tam, kde byla vada — viz §5, kde jsou konkrétní případy
  i měřicí recepty, které ty vady odhalily.
- U sebe si nech rozhodnutí o rozložení a barvách. Zadání pro agenta by u nich
  bylo delší než výsledek.
- Vše viditelné musí být v **5 jazycích** (en, de, pl, cs, sk) v `js/i18n.js`.
  Žádný jazyk nevynechávat.
- **Dva agenti nesmí psát do stejného souboru naráz.** V této session hrozilo,
  že si přepíšou `css/style.css` a `js/i18n.js`. Úlohy, které na ně sahají,
  pouštěj po sobě, nebo je slouč do jedné.

---

## 2. Co je hotové a ověřené (netřeba znovu zjišťovat)

### Vizuální identita
- Značková barva **#0083C6** (Pantone 7461 C, RAL 5015, CMYK 92/35/1/0),
  potvrzena uživatelem. Neutrály z logomanuálu: `#2B2A29`, `#5B5B5B`,
  `#EBECEC`, `#FEFEFE`.
- **Kontrastní pravidlo — DŮLEŽITÉ.** Bílý text na `#0083C6` má poměr jen
  **4,15:1**, tedy pod hranicí WCAG AA 4,5:1 (výjimka pro velký text platí
  až od 24 px, tlačítka mají 13 px). Proto:
  - plocha pod bílým textem = `--accent-dark` **#00639A** (6,46:1)
  - hover = `--accent-darker` **#004E78**
  - `--accent` #0083C6 zůstává na rámečky, zvýraznění, focus a podbarvení,
    kde platí mírnější požadavek 3:1
- Světlý motiv je zaveden v `css/style.css`, proměnné v `:root` si drží
  původní názvy, změnily se hodnoty.
- Logo je vektorové, vytažené z `Alba_logomanual.pdf`:
  `img/logo-alba.svg` (`fill="currentColor"`) a `img/logo-alba-white.svg`.
  Tvar ověřen překryvem přes `Logo-ALBA.jpg` — sedí. **`fill-rule` musí
  zůstat `evenodd`**, s `nonzero` se zalijí díry v písmenech.

### Horní lišta
Ovládání aplikace je nahoře: logo, tři pohledy jako ikony domečku, přepínač
strany A/B, půdorys, podlaha jako barevná políčka, export PNG jako foťák,
správce přístrojů jako ozubené kolo, přepínač jazyka jako jedna vlaječka
s rozbalovací nabídkou.

- Pohled shora se stranou **otáčí o 180°** (`top` / `topB` v `computeViews`).
- Přechod mezi pohledy je **oblet** — `animateView()` v `js/viewer.js`
  interpoluje sférické souřadnice a azimut po kratší cestě.
- Půdorys se chová jako **čtvrtý pohled**: kliknutí na jiný pohled ho zavře,
  opakovaný klik ho přepne, Escape ho zavře. Křížek byl odstraněn.
- Přepínač A/B je skrytý u jednostranného bloku a je vizuálně uvnitř
  skupiny pohledů (`.view-group`).
- Tlačítka projektu (uložit, načíst ze souboru, načíst uloženou sestavu)
  se přesunula do bočního panelu jako první sekce „Projekt".
- **Lišta je responzivní až na 375 px** — ověřeno měřením na 375, 720, 1100,
  1280 a 1920 px: všude jedna řada (rozptyl svislých středů 0), výška 52 px,
  logo se nemáčkne. Na `max-width: 720px` se skrývá přepínač podlahy
  (zůstává v DOM, jen `display: none`), takže na mobilu je v liště
  7 tlačítek místo 9 a vejdou se bez rolování.
  `flex-wrap: nowrap` musí zůstat na VŠECH vnořených flex kontejnerech
  uvnitř lišty (`#topbar .btn-row`, `.view-group`, `.side-switch`,
  `.topbar-export`, `.lang-switcher`) — stačí ho vynechat na jednom
  a lišta se na mobilu rozpadne a tlačítka se oříznou.

### Tiskový dokument
`js/report.js` staví nabídkový list, který se tiskne přes `window.print()`.
**Žádná knihovna na PDF** — jsPDF neumí českou a polskou diakritiku bez
vloženého fontu a html2canvas by z textu udělal bitmapu.

Pořadí sekcí (**ROZHODNUTO**, ověřeno): hlavička → náhled 3D → specifikace
bloku → technická specifikace → **půdorys** → soupis dílů → ramena a baterie
→ patička. Půdorys schválně sousedí se soupisem.

- Náhledy se renderují **offscreen ve dvojnásobném rozlišení** (1600×1000).
  Pozor: `scene.environment` je vázaná na renderer, který ji vytvořil —
  při použití v jiném rendereru vyjde blok černý. Řeší se dočasným
  přegenerováním odrazové mapy a vrácením původní.
- **Kamera scény se generováním dokumentu nesmí pohnout** — ověřeno.
- Soupis dílů je **HTML tabulka**, ne SVG. Původní SVG verze měla vadu:
  hlavičky sloupců se překrývaly, protože SVG má pevné souřadnice a delší
  překlady se nevešly. HTML to řeší samo.

### Půdorys
Kóty mají hierarchii (**ROZHODNUTO**, formuloval uživatel jako konstruktér):
celková kóta je **vždy vně**, dílčí vnořené. Celková má silné provedení
(`strokeThick`, `fontDim`, `#000`), dílčí potlačené (`strokeThin`,
`fontChain`, `#333`). U ostrovního bloku jsou tři sloupce svislých kót:
podestavby (nejblíž) → strany A/B → celková hloubka (nejdál).

### Katalog
- Přístroje přejmenovány na tvar `<typ> <značka> <parametr>` — modelové kódy
  zmizely z názvů a zůstaly v poli `catalogCode`. Např. „Fritéza Lotus 10 l",
  kód `F10D-64ET`. V pěti jazycích, slovo pro typ se bere z obecného
  přístroje, aby katalog mluvil sám se sebou.
- V `js/catalog.js` je `LEGACY_BUILTIN_NAMES` — migrace, aby se přejmenování
  projevilo i u uživatelů, kteří mají katalog uložený v prohlížeči.
- Obecná „Vodní lázeň" je `visible: false` (neurčuje velikost vany).
  **Nebyla smazána** schválně — smazání by v uložených sestavách
  degradovalo segment na bezejmenný kvádr bez vrchního prvku.

### Baterie u dřezu
Klarco 1E.2904.82.76 v `buildSinkTop` (`js/modules.js`): výška 330 mm nad
deskou, dosah 245 mm, tělo Ø55, příruba Ø47, trubka Ø25. Loketní páka míří
**stejným směrem jako výtok**, nad ramínkem — podle bočního výkresu, ne
do strany. Rozměry jsou ověřené měřením, neměň je.

---

## 3. Krok 2 — paleta prvků

### Cíl
Levý panel má dnes 320 px a obsahuje rozměry bloku, sekci projektu, seznamy
segmentů obou stran a paletu jako sloupec plnošířkových tlačítek.
Panel má **2181 px** na výšku, takže se pořád roluje.

### ROZHODNUTO
- Panel má **200 px**, ne 150. Kratší by nestačilo na jména z katalogu.
- Paleta jsou **řádky s ikonou, názvem a jmenovitou šířkou**, ne dlaždice.
  Dlaždice se rozbíjejí o dlouhá jména.
- **Žádné kategorie.** Paleta je prostě seznam přístrojů, které mají
  v katalogu zaškrtnuté „zobrazovat". Mechanismus UŽ EXISTUJE a je hotový:
  `getVisibleDevices()` v `js/catalog.js:452`, zaškrtávátko ve správci
  přístrojů, `js/ui.js:151` paletu podle toho staví. Nic nového se
  nevymýšlí — jen se to jinak vykreslí.
- Nad paletou **filtr** (pole „Hledat…").
- **Odznak cílové strany** („do A") — u ostrovního bloku musí být vidět,
  kam se prvek přidá. Řídí se aktivní záložkou ve spodním pásu.
- Dole odkaz **„Upravit katalog…"**, aby prázdná paleta nebyla slepá ulička.
- Neutrální modul, zásuvky GN 1/1 a vlastní modul nejsou katalogové přístroje
  (jsou to samostatná tlačítka). V paletě jsou **za tenkou linkou, bez
  nadpisu**, aby zůstal dojem jednoho seznamu.
- **Nový prvek se přidává na KONEC strany.** Přesouvání je snadné.

### Vazba na katalogové zadání — POZOR
`ZADANI-KATALOG.md` §5 požaduje, aby paleta byla použitelná při **stovkách
přístrojů** — tedy vyhledávání, ne dlouhý sloupec. To je stejná věc jako
krok 2. **Rozhodni s uživatelem, jestli:**
 a) udělat krok 2 teď jednoduše (filtr + plochý seznam) a při katalogovém
    úkolu ho případně rozšířit, nebo
 b) krok 2 odložit a udělat ho rovnou jako součást katalogového zadání.
Varianta (a) dá dřív užitečný výsledek; (b) ušetří jednu přestavbu.
Neřeš to sám, je to rozhodnutí o pořadí práce.

---

## 4. Krok 3 — spodní pás se sestavou

Nejhlubší zásah celého redesignu. Sahá do `js/ui.js` a do vazby výběru
na 3D scénu.

### ROZHODNUTO
- Seznam segmentů se z bočního panelu přesune do **vodorovného pásu pod
  3D scénu**. Důvod: blok je dlouhý a nízký, takže mu širší a nižší viewport
  sedí líp — a segmenty položené vodorovně stojí ve stejném pořadí jako
  v modelu, takže se pás čte jako půdorys.
- Pravý panel se **nedělá**. Uživatel na něj přišel s námitkou, že bere
  šířku, a měl pravdu: levý 168 + pravý 180 by bylo víc chromu než dnešních 320.
- **Rozbalený je jen vybraný segment**, ostatní jsou sbalené karty ~70 px
  s úchytem pro přetažení.
- Výběr je **společný s 3D scénou** — kliknutí do modelu otevře detail
  a naopak.
- Strany A/B a ramena jsou **záložky**, ne sekce pod sebou. U ostrovního
  bloku zvaž dva pásy nad sebou (A nahoře, B dole), jak leží ve skutečnosti.
- Pás jde **srolovat na proužek** pro čistý náhled.
- **Duplikování segmentu se NEDĚLÁ** — uživatel to výslovně zamítl.

### Očekávané rozměry
Na 1920×1080: viewport získá ~170 px šířky a ztratí ~156 px výšky proti
dnešku. Pro ležatý blok je to výhodný obchod.

### MOBIL — čti dřív, než začneš krok 3

Aplikace dnes na mobilu funguje a **musí fungovat i po redesignu**.
Změřeno na 375×812: lišta 52 px, boční panel 342 px (45 %), 3D 418 px (55 %),
dohromady přesně 812, nic nepřetéká. Jediná media query je
`@media (max-width: 720px)` na řádku 1364 v `css/style.css` — přepne `#app`
na sloupec a rozdělí výšku 45/55.

**Spodní pás se na mobil NEPŘENÁŠÍ doslova.** Levý panel 200 px plus spodní
pás plus horní lišta jsou tři pásma chromu na 375px obrazovce — to nevyjde.
Informační architektura ale zůstává stejná, mění se jen uspořádání:

| | Desktop (≥ 900 px) | Mobil (< 720 px) |
|---|---|---|
| ovládání aplikace | horní lišta | horní lišta (beze změny) |
| co můžu přidat | levý panel 200 px | spodní plachta, záložka „Přidat" |
| co je v bloku | spodní pás | spodní plachta, záložka „Sestava" |

Na mobilu tedy **jedna spodní plachta se dvěma záložkami** místo dvou
oddělených pásem. Plachta je tažením přepínatelná mezi třemi stavy: sbalená
na úchyt (3D přes celou obrazovku), poloviční, celá. Proti dnešku je to
zlepšení — dnes zabírá panel natvrdo 45 % a **roluje se v poměru 6,6**
(2260 px obsahu na 341 px viditelných), což je horší než na desktopu.

**Z toho plyne jedno závazné rozhodnutí o detailu segmentu:**
detail NESMÍ být napevno šestisloupcová řada. Musí to být mřížka, která
se sama přelévá:
```css
grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
```
Na desktopu z toho vyjde jedna řada, na mobilu sloupec. Tímhle jediným
rozhodnutím funguje detail na obou koncích a odpadá potřeba dvou návrhů.

**Ověřuj krok 3 na 375 px stejně pečlivě jako na 1280.** Recepty v §5 platí
pro obě šířky.

### Známá omezení, která návrh nezakrývá
- Detail vybraného segmentu má **čtyři až šest polí v řádku**. Dřez se šesti
  poli je strop; vlastní modul se do řádku nevejde vůbec — pro něj a pro
  správce přístrojů zůstává dialog.
- Při deseti segmentech je vidět vybraný plus zhruba čtyři sousedi, zbytek
  se doroluje. Vybraná karta se má do záběru odrolovat sama.

---

## 5. Jak ověřovat — PASTI, KTERÉ V TÉTO SESSION ZABRALY ČAS

### Cache prohlížeče
`python -m http.server` na portu 8000 **neposílá hlavičky proti kešování**.
Prohlížeč drží staré moduly i přes tvrdý reload. Před KAŽDÝM ověřením:

```js
(async()=>{ const l=document.querySelector('link[rel=stylesheet]');
  await fetch(l.getAttribute('href').split('?')[0],{cache:'reload'});
  for (const f of ['js/main.js','js/ui.js','js/viewer.js','js/i18n.js',
                   'js/floorplan.js','js/report.js'])
    await fetch(f,{cache:'reload'}).catch(()=>{});
  localStorage.clear(); location.reload(true); })()
```

Dynamický import s cache-bustem **nebustne vnořené importy** — modul,
který měříš, importuj vždy přímo.

### Kontrast se musí počítat se skládáním alfy
Naivní porovnání `color` proti `backgroundColor` u prvku s poloprůhledným
pozadím dává nesmysly. V této session to **dvakrát** vedlo k falešnému
hlášení vady (3,45:1 a 1,56:1 u tlačítek, která byla v pořádku).

```js
const parse=c=>{const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1};};
const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
const lum=c=>{const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)};
  return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
const cr=(a,b)=>{const L1=lum(a),L2=lum(b),[h,lo]=L1>L2?[L1,L2]:[L2,L1];return +((h+.05)/(lo+.05)).toFixed(2);};
const bgOf=el=>{const st=[];let n=el;
  while(n&&n!==document.documentElement){const c=parse(getComputedStyle(n).backgroundColor);
    if(c.a>0)st.push(c); if(c.a===1)break; n=n.parentElement;}
  st.push({r:255,g:255,b:255,a:1}); return st.reduceRight((a,c)=>over(c,a));};
```
Limit: 4,5:1; u textu ≥24 px (nebo ≥18,7 px tučně) stačí 3:1.

### Zalomení lišty se měří SVISLÝMI STŘEDY, ne horními hranami
`scrollWidth === clientWidth` **není platný test** — zalomení se projeví
svisle. A počítat různé `top` je taky špatně: prvky mají různou výšku
a jsou svisle vystředěné, takže různé `top` je normální.

```js
const b=[...document.querySelectorAll('#topbar button')]
  .filter(x=>x.getBoundingClientRect().height>0);
const c=b.map(x=>{const r=x.getBoundingClientRect();return Math.round(r.top+r.height/2);});
// jeden řádek  <=>  Math.max(...c)-Math.min(...c) <= 4
```
Testuj šířky 1920, 1440, 1280 a **1100 px**.

### `overflow-x: auto` zabíjí `overflow-y: visible`
Prohlížeč druhou osu povýší taky na `auto`. Kvůli tomu byla rozbalovací
nabídka jazyka neviditelná — vykreslovala se, ale lišta ji ořízla. Řešení:
nabídku vykreslit do `document.body` s `position: fixed`. Kontrola, že prvek
opravdu JDE VIDĚT:

```js
const stred=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
// musí platit: menu.contains(stred)   — když vrátí CANVAS, je oříznutý
```

### Ostatní
- Klíče v úložišti: `alba-katalog-v1`, `nerez-blok-config-v3`, `alba-jazyk`.
  Před testem čistit. **Pozor:** `localStorage.clear()` shodí jazyk na
  výchozí (en) — české kontrolní řetězce pak nic nenajdou.
- `.claude/launch.json` se **navěšuje na běžící server**, nespouští vlastní.
  Port 8000 drží uživatelův Python — **nezabíjet**.
- Screenshoty v Browser pane byly při nestandardních šířkách okna občas
  zkreslené. Měření přes JS je autoritativní, screenshot je doplněk.

---

## 6. Co v dokumentu CHYBÍ — čeká na uživatele

Obojí je připravené jako konstanta na začátku `js/report.js`, doplnění je
jeden zásah bez dopadu na rozložení. **Nic si nevymýšlej** — jde o dokument
pro zákazníka.

```js
const MATERIAL_SPEC = { steelGrade: '', worktopThickness: '', bodyThickness: '', surface: '' };
const COMPANY = { name: 'ALBA Professional s.r.o.', street: '', city: '',
                  phone: '', email: '', web: '', regNo: '', vatNo: '' };
```

Potřeba získat:
1. **Kontakty** — adresa, telefon, e-mail, web, IČO, DIČ.
2. **Jakost nerezu a síly plechů** — např. AISI 304 / 1.4301, deska 1,5 mm,
   korpus 1,0 mm. Zjistit, jestli jsou stejné pro celý blok.
3. **Co znamenají HS+, H1, H2, H3.** V `SPEC.md:274` je jen výčet bez popisu.
   Bez toho jsou v dokumentu jen zkratky.

---

## 7. Známé vady a nedodělky

- **Segmenty, které se do bloku nevejdou** (označené „nevejde se"), nejsou
  v dokumentu vůbec — ani v soupisu dílů, ani v oddílu baterií. Je to
  obhajitelné, protože dokument popisuje blok tak, jak se postaví, ale kdo
  si vytiskne přeplněnou konfiguraci, dostane list, kde mu prvky tiše chybí.
  Návrh: doplnit do dokumentu upozornění.
- **Číslování stran** v tisku Chrome ignoruje (`@page { @bottom-right }`).
  Vědomě se neobchází přes JS — čísla stran umí přidat sám tiskový dialog.
- **Logo ALBA ve 3D scéně se nevykresluje** — starší známá vada, diagnóza
  hotová, oprava odložena na pokyn uživatele. Netýká se loga v UI ani
  v dokumentu, ta fungují.
- **Tiché selhání při zaplnění localStorage** — `persist()` v `js/catalog.js`
  chybu jen zapíše do konzole. Podrobně v `ZADANI-KATALOG.md` §5.

---

## 8. Otevřené otázky — PROBRAT PŘED ZAHÁJENÍM

1. **Pořadí kroku 2 a katalogového úkolu** — viz §3. Udělat paletu teď
   jednoduše, nebo rovnou jako součást katalogu?
2. **Upozornění na nevešlé segmenty** v dokumentu — doplnit, nebo nechat?
3. **Ostrovní blok ve spodním pásu** — dva pásy nad sebou (A/B jak leží),
   nebo záložky?
4. **Commit.** V repozitáři je **jediný commit** (`bdeae3f`) a **26 souborů
   je nezacommitovaných**, včetně celého redesignu. Není kam couvnout,
   kdyby krok 3 něco rozbil. Doporučuji stav zacommitovat PŘED zahájením
   kroku 3 a zeptat se uživatele, jestli to má agent udělat.

---

## 9. Dotčené soubory

| Soubor | Řádků | Role |
|---|---|---|
| `index.html` | 360 | horní lišta, boční panel, dialogy, překryv dokumentu |
| `css/style.css` | 1452 | světlá paleta, lišta, `@media print` |
| `js/ui.js` | 915 | vykreslení panelu, palety, přepínače jazyka |
| `js/main.js` | — | stav aplikace, obsluha, `selectViewDef`, náhledy dokumentu |
| `js/viewer.js` | — | `computeViews`, `applyView`, `animateView` |
| `js/floorplan.js` | 787 | SVG kresba půdorysu včetně kót |
| `js/report.js` | 439 | tiskový dokument |
| `js/catalog.js` | — | katalog, `visible`, `LEGACY_BUILTIN_NAMES` |
| `js/i18n.js` | — | 5 jazyků |
| `js/modules.js` | — | geometrie segmentů, dřez a baterie — **nesahat bez důvodu** |
| `js/arms.js` | — | napouštěcí rameno Klarco 1E.2959 — **hotové, nesahat** |

Související zadání: `ZADANI-KATALOG.md` (katalogový systém),
`ZADANI-BATERIE.md` (baterie u dřezu — SPLNĚNO), `SPEC.md`, `README.md`,
`DEPLOY.md`.
