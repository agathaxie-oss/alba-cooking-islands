# Specifikace — varný blok s herdblokem

**Stav:** Část implementace se rozběhla. VOLBA TYPU (úvodní obrazovka se dvěma kartami, odznak typu v panelu Projekt, tlačítko Nový projekt, typ v uloženém souboru) je hotová. Produkt MONO sám — geometrie, vrstvy, půdorys, dokument — zatím neexistuje; rozpracovává se prototyp geometrie.
**Vznik:** 31. 7. 2026, ze zadání uživatele.

Tento dokument popisuje **druhý, konstrukčně odlišný produkt**, který má
běžet souběžně s dnešním typem (viz `SPEC.md`). Dnešní typ se neruší.

Hodnoty označené **(odvozeno)** jsem dopočítal ze zadaných čísel a čekají
na potvrzení. Hodnoty označené **(chybí)** zadány nebyly a jsou v §12.

---

## 1. Čím se liší od dnešního typu

Dnešní model má **jeden seznam segmentů**, kde je podestavba a přístroj
slepený do jedné věci a poloha je daná pořadím v řadě.

Nový typ má **dvě nezávislé vrstvy nad společnou osou X**:

- **podestavby** — nižší než dnes, samostatné, s vlastní polohou a šířkou
- **herdblok** — deska s přístroji a ovládacím panelem, položená na
  podestavbách, s vlastní polohou a délkou

Protože se ty dvě vrstvy nemusí krýt, jde postavit **most** (herdblok
překlenuje mezeru mezi podestavbami) i **převis** (herdblok přesahuje za
poslední podestavbu). Tím pádem **poloha přestává být pořadí a stává se
souřadnicí**: každý prvek má `xMM` (začátek) a `widthMM`.

To je zdrojová změna, ze které plyne skoro všechno ostatní.

---

## 2. Rozměry a výšky — ZADÁNO

| Veličina | Hodnota |
|---|---|
| Podestavba včetně nožiček | **610 mm** (při pracovní výšce 900) |
| Herdblok včetně pracovní desky | **290 mm**, konstrukčně pevný |
| Pracovní výška | **850–900 mm**, výchozí 900 |
| Délka bloku | volná — vyrábí se na míru |
| Hloubka herdbloku | volná — vyrábí se na míru |
| Hloubka podestavby | **670 mm** standardně, pokud uživatel neurčí jinak |

**Výška bloku se mění podestavbou, ne herdblokem.** Herdblok je vždy
290 mm. Nožičky se nemění — mění se tělo podestavby.

Z toho plyne pravidlo pro rozhraní: uživatel zadává **pracovní výšku**,
aplikace dopočítá výšku podestavby jako `pracovní výška − 290`, tedy
**560–610 mm**. Do dokumentu patří obojí, protože se vyrábí podestavba.

**Délka herdbloku není omezená výrobou** — může to být jeden kus.
Spáry mezi sekcemi se v modelu neřeší.

---

## 3. Podepření — ZADÁNO

| Pravidlo | Mez |
|---|---|
| **Převis** — volný konec herdbloku za poslední podestavbou | **500 mm** |
| **Most** — nepodepřená světlost mezi dvěma podestavbami | **1200 mm** |

Jsou to dvě různá pravidla a kontrolují se každé zvlášť. Aplikace je
hlídá a překročení hlásí — podobně, jako dnes hlásí segment, který se
do bloku nevejde.

Otevřené: co s převisem na **obou** koncích zároveň (platí 500 na každý
zvlášť, předpokládám ano) a jestli se sousedící podestavby smí dotýkat
nebo mezi nimi musí být spára.

---

## 4. Herdblok — tvar

### 4.1 Obrys jako jediný zdroj pravdy

**Návrh, na kterém stojí zbytek:** herdblok se definuje svým **horním
obrysem** — 2D mnohoúhelníkem s ošetřením jednotlivých rohů. Z něj se
odvozuje:

- 3D těleso (protažení obrysu dolů o 290 mm)
- kresba půdorysu (tentýž obrys)
- límec (zvednutí **vybraných hran** obrysu)
- kóty v dokumentu (body téhož obrysu)

Dnes se 3D a půdorys staví každý zvlášť a v souladu se drží tím, že se to
hlídá. Se zkosenými a zaoblenými rohy by to přestalo být udržitelné.

Vedlejší přínos: „límec na vybraných sekcích" se tím rozpustí do
přirozenějšího „límec na vybraných hranách".

### 4.2 Rohy — ZADÁNO

- **zkosení** vždy **45°**
- **zaoblení** vždy **R 50 mm**
- roh může být i **ostrý** (bez ošetření)

### 4.3 Zakončení bloku — ZADÁNO

Zkosení se **neprovádí jako uříznutý roh desky**, ale jako **samostatné
zakončení bloku**, do kterého **nelze umístit přístroj**.

Tvar zakončení: **20 mm bez zkosení** a dalších **50 mm se zkosením**,
tedy celková délka zakončení **70 mm (odvozeno)**. Pod zakončení přijde
odpovídající **krycí panel na bok skříněk**.

**Tři typy se liší PŮDORYSNÝM tvarem rohu** (ověřeno na ručním schématu
uživatele z 31. 7. 2026):

| Typ | Půdorys rohu |
|---|---|
| **Vlna** | v podstatě ostrý roh, **R 3 mm** |
| **Zkosená vlna** | roh useknutý pod **45°**, odvěsny **50 × 50 mm** (dva úhly 135°) |
| **Zaoblená hrana** | roh zaoblený **R 50 mm** |

**Zkosení sahá od spodní po horní hranu herdbloku**, tedy přes celých
290 mm. Není to jen sražení desky.

**Boční krycí panel na podestavbě zkosený být může, ale nemusí — je to
volba a obě varianty jsou záměrné:**

| Boční kryt | Jak to vypadá |
|---|---|
| **zkosený** | plynule navazuje na herdblok, přechod je spojitý |
| **nezkosený** | přizná odskok a **převis herdbloku** nad podestavbou |

**Známá vada v prototypu (31. 7. 2026, neopravena):** ve variantě se zkoseným
bočním krytem není zkosená plocha krytu v rovině se zkosením desky. Deska jede
po přímce `x = 1275 + z`, kryt po `x = 1305 + z` — kryt je odsazený o 30 mm
dozadu, takže místo plynulého přechodu vznikne schod. Naměřeno paprsky
v `prototyp/`. Varianta s nezkoseným krytem je v pořádku.

**Zkosená vlna má navíc sraženou hranu desky v řezu.** Viditelné svislé
čelo desky je u ní **20 mm** místo 40 mm; zbylých 20 mm nahradí facetka
pod 45°, tedy vnitřní úhly **135°**. Šířka facetky vychází 20 × √2 ≈
**28,3 mm (odvozeno)**.

Na ručním schématu byly u desky původně napsané úhly 45°; uživatel je
opravil na **135°** — jde o tentýž 45° úkos, jen popsaný vnitřním úhlem.

Předpoklad k potvrzení: zúžené čelo 20 mm platí **po celém obvodu** té
varianty, ne jen na zkosené rovině rohu.

Na zkosenou rovinu navazuje **zakončovací plech zboku na podestavby**
(„boční kryt").

**Důsledek pro model:** typ rohu je vlastnost **konce herdbloku**, ne
samostatný prvek na ose X. Zkosená a zaoblená varianta ubírají z desky
místo, kam se nedá osadit přístroj.

### 4.4 Límec — ZADÁNO

- výška **volitelná 40–300 mm**, nejčastěji **100 mm**
- umisťuje se na **vybrané hrany** obrysu
- nejčastěji, ale ne výhradně, u jednostranného bloku na zadní a/nebo
  boční hranu

**Límec je jen na rovných zakončeních nebo na hranách napojených pod 90°.**
Na zkosených a zaoblených místech límec není. Rozhraní tedy nesmí nabídnout
límec na hraně, která do téhle podmínky nespadá.

**Poloměr ohybu plechu u límce: 0 (ostrý pravý úhel).** Toto je konzistentní s pravidlem z §12, že poloměry do ~5 mm se ve vizualizaci ignorují a ohyb desky se kreslí jako ostrá hrana 90°.

---

## 5. Čelní skladba herdbloku — ZADÁNO

Při pohledu z čela, shora dolů v rámci 290 mm:

| Pásmo | Výška | Poznámka |
|---|---|---|
| pracovní deska | **40 mm** | tak vypadá z čela |
| výklopný ovládací panel | **250 mm** | ustoupený o **15 mm** za líc desky |

40 + 250 = 290.

**Spodní lišta (výstupek) je součástí panelu, ne samostatné pásmo.**
Je vysoká 30 mm, je ve spodní části panelu a je skoro zarovnaná s lícem
pracovní desky — panel je tedy nahoře ustoupený o 15 mm a dole se vrací
dopředu.

Panel je **výklopný**, tedy se otevírá pro přístup dovnitř. Z toho plyne,
že model má mít patrnou spáru nahoře a že ustoupení 15 mm je funkční,
ne jen vzhledové.

---

## 6. Ovládací panel — ZADÁNO

**Panel je součástí herdbloku, ne přístroje.** Přístroj do něj jen
propisuje své ovládací prvky. Vedle nich se do panelu dává **další
příslušenství**, například zásuvka 230 V.

Z toho plyne, že panel má **vlastní obsazení podél osy X** a v rozhraní
si zaslouží vlastní dráhu:

- **ovládání přístroje** — poloha je **daná polohou přístroje** v ose X.
  Teoreticky ji lze vůči přístroji posunout, ale v praxi se to nedělá,
  protože se tím ztratí zřejmá vazba, který knoflík patří k čemu.
  → V rozhraní tedy **výchozí stav je pevná vazba**; posun samostatně
  nenabízet, nanejvýš jako pokročilé nastavení.
- **příslušenství** (zásuvky apod.) — poloha **volná**, umisťuje se
  nezávisle.

Panel běží **po celém čele** kromě zkosených zakončení, pokud jsou.

**Ověřeno na fotografii hotového bloku (31. 7. 2026):** ovládání sedí
přímo pod svým přístrojem — tři knoflíky pod každou indukcí. Zásuvka je
v panelu mezi skupinami knoflíků. Panel je ustoupený a dole se vrací
dopředu lištou, tedy skladba 40 + 250 s lištou uvnitř panelu sedí.

### 6.1 Druhy ovládacích prvků — ZADÁNO

Přístroj může do panelu propisovat tyto druhy:

| Druh | Provedení |
|---|---|
| tlačítka | **pevné**, jediné provedení |
| displeje | **pevné**, jediné provedení |
| kruhové otočné ovladače | **standardní nebo příplatkové** (masivní nerezové) |

**Upselovat jde jen kruhové otočné ovladače.** Tlačítka a displeje jsou
dané a konstantní, žádnou volbu nemají.

Otevřené: jestli se příplatkové provedení volí **pro celý blok naráz**,
nebo u každého přístroje zvlášť. Na fotografii hotového bloku byly
všechny knoflíky stejné, což by odpovídalo volbě pro celý blok — ale
potvrzeno to není (viz §12).

---

## 7. Podestavby

Nižší než dnes (560–610 mm včetně nožiček podle pracovní výšky). Jinak
konstrukčně podobné dnešním: styl podestavby, dvířka, police, panely.

### 7.0a Provedení soklu — ZADÁNO

Tři možnosti, mezi kterými se volí:

| Provedení | Popis |
|---|---|
| **Stavební sokl** | sokl postavený na stavbě, blok se na něj posadí |
| **Nožičky a soklová nerezová zástěna** | 4 nožičky pod každým korpusem, sokl nasazený zepředu |
| **Konstrukční sokl** | nerezový rám pod celým blokem — blok na něm leží a zároveň slouží jako sokl |

Poslední dvě provedení se **vzhledově neliší**, ale konstrukčně ano,
takže v soupisu dílů a v dokumentu musí být rozlišené.

**Odsazený sokl se nově dělá kolem dokola včetně boků**, ne jen z čela.

### 7.0 Poloha vůči herdbloku — ZADÁNO

**Čelo podestavby je zarovnané s panelem herdbloku**, ne s lícem
pracovní desky. Deska tedy přes podestavbu **přečnívá o 15 mm**.

Standardní hloubka podestavby je **670 mm**. Mezera od zdi u
jednostranného bloku z toho vyplývá:

```
mezera = hloubka herdbloku − 15 − 670
```

**(odvozeno — potvrdit.)** Pro herdblok hluboký 850 mm vyjde 165 mm,
pro 700 mm vyjde 15 mm. Znamená to, že u mělkých bloků mezera zmizí,
což by aplikace měla hlídat.

### 7.1 Hygienické stupně — ZADÁNO

Týkají se **jen podestaveb** a jde o **konstrukci**, ne o tloušťku plechu.

| Stupeň | Konstrukce |
|---|---|
| **HS+** | základní korpus s **viditelnými spárami** |
| **H1** | první hygienický stupeň — z čela korpusu ani uvnitř nejsou žádné spáry, vše posvařováno a vyčištěno |
| **H2** | jako H1 + vnitřní kouty skříňky s **radiusem 16 mm** mezi **podlážkou a stěnami**; na vizualizaci vidět zepředu vlevo a vpravo dole |
| **H3** | jako H2, ale skříňka má navíc **horní plech** a radiusy R16 mají **všechny kouty** skříňky |

### 7.2 Konstrukce skříňky — ZADÁNO

**Pozor: nejde o sílu plechu.** Korpus je z plechu 1,5 mm, ale jednotlivé
dílce jsou vytvarované a duté, takže mají konstrukční tloušťku:

| Dílec | Tloušťka | Poznámka |
|---|---|---|
| stěna skříňky | **20 mm** | |
| podlážka | **40 mm** | úplně dole, součást konstrukce; uvnitř výztuhy a dutina — **v modelu se neřeší**, bere se jako plný dílec 40 mm |
| příčná lišta nahoře | **20 × 20 mm** | **jen vpředu**, ne vzadu |
| nožičky | **150 mm** | konstanta; při změně pracovní výšky se mění tělo skříňky, ne nožičky |

**Stěny sousedních skříněk se sčítají.** Mezi vnitřky dvou skříněk
vedle sebe je tedy **40 mm** (20 + 20), ne 20. Vnitřní světlost samostatné
skříňky je vnější šířka − 2 × 20 mm.

**Důsledek:** H2 a H3 jsou vidět ve 3D, nejsou to jen kódy. Model
podestavby musí umět vnitřní kouty s R16 a rozlišit, na kterých hranách
jsou. Zároveň je konečně možné napsat do dokumentu, co ty zkratky
znamenají — dnes je tam holý výčet.

---

## 8. Přístroje a katalog — ZADÁNO

Přístroj se osazuje **do herdbloku**, ne do podestavby.

### 8.1 Dva rozměry přístroje

| Rozměr | Význam |
|---|---|
| **pod deskou** | kolik místa přístroj celkově zabírá pod pracovní deskou — povinný |
| **na desce** | kolik místa zabírá na desce; **není to nutně výřez** — nepovinný |

**Když druhý rozměr chybí, považuje se za shodný s prvním.**

### 8.2 Odstupy — ZADÁNO

| Pravidlo | Hodnota |
|---|---|
| Minimální ochranné pole mezi přístroji | **50 mm** |
| Minimální vzdálenost od přední hrany | **50 mm** |
| Minimální vzdálenost od zadní hrany | **50 mm** |
| Standardní vzdálenost od přední hrany | **100 mm** |

**Ochranná pole se nesčítají — mezi dvěma přístroji platí to větší
z nich.** Tedy `mezera = max(pole_A, pole_B)`, nejméně však 50 mm.

Otevřené: jestli si přístroj může v katalogu určit **vlastní, větší**
ochranné pole, nebo je 50 mm pevných pro všechny (viz §12).

### 8.3 Zbytek katalogu

Sady, verzování, obrázky vedle kódu, hlášení při zaplnění úložiště —
platí beze změny, viz `ZADANI-KATALOG.md`. Nově k tomu přibývají dva
rozměry z §8.1, ochranné pole a **ovládací prvky**, které se propisují
do panelu (počet, druh, šířka).

---

## 8.4 Příslušenství nad blokem — ODLOŽENO

Nad varný blok se montují **nástavby** — roštová nástavba (viditelná na
fotografii z 31. 7. 2026), police na salamandr a podobně.

**Patří do stejné kategorie jako napouštěcí ramena**, tedy jako
příslušenství s vlastní polohou nad blokem, ne jako součást herdbloku.

**Zatím se neřeší** — mimo rozsah první etapy. Až na ně dojde, převezmou
mechaniku ramen: karty v pásu, parametry ve sdíleném pruhu.

---

## 9. Co se přebírá z dnešního rozhraní

Ovládání zůstává v podstatě stejné. Beze změny se přebírá horní lišta,
světlá paleta a kontrastní pravidla, kamera s obletem, pruh parametrů
s přelévající se mřížkou, mazání ikonou koše v záhlaví pruhu, paleta
prvků s filtrem a odznakem cílové vrstvy, a rozdělení pohledu od editace.

Mění se:

- **Pás dostane víc drah nad společnou osou X** — herdblok, ovládací
  panel, podestavby (a ramena jako dnes). Karty se umisťují podle
  skutečné souřadnice, ne podle pořadí, takže most i převis jsou v pásu
  vidět jako mezera pod kartou.
- **Šipky ◀ ▶ ztrácejí smysl** — s volnou polohou se neposouvá pořadí,
  ale souřadnice. Nahradí je číslo a posuvník, tedy přesně to, co už je
  postavené u napouštěcích ramen.
- **Cílová vrstva** se řeší stejným mechanismem jako dnešní odznak
  „do A / do B" — jen místo strany bloku ukazuje vrstvu.
- **Nově je potřeba přichytávání** — na hranu souseda a na rozumný krok.
  S volnými souřadnicemi je to nutnost, dnes to v aplikaci není vůbec.

---

## 10. Kapacita a kontroly

Dnešní pojem „využito X / Y mm" ztrácí smysl, protože délka není pevná
schránka. Nahradí ho kontroly:

- převis > 500 mm
- most > 1200 mm
- přístroj zasahuje do zakončení
- přístroje se překrývají
- příslušenství panelu se překrývá s ovládáním přístroje

Hlásit stejným způsobem jako dnešní „nevejde se" — u karty v pásu
a v dokumentu.

---

## 11. Souběh dvou produktů

Uživatel potvrdil, že oba typy poběží souběžně jako konstrukčně odlišné
produkty. Doporučení: **jedno úložiště se sdíleným jádrem a dvěma
produktovými moduly**, typ se volí při založení projektu.

Důvod: katalog přístrojů, pět jazyků, firemní paleta, horní lišta, kamera
a tiskový dokument jsou u obou stejné. Dvě oddělené kódové základny by se
rozešly — nejdřív překlady, pak katalog.

Navenek to může vypadat jako dvě aplikace, pokud se tak mají prodávat.

### 11.1 Názvy produktů — ALBA SEGMENT a ALBA MONO

Rozhodnuto 1. 8. 2026:

| Produkt | Název | Typ |
|---|---|---|
| dnešní typ | **ALBA SEGMENT** | segmenty v řadě, poloha = pořadí |
| nový typ | **ALBA MONO** | herdblok na podestavbách, souřadnice + vrstvy |

**Názvy jsou ZNAČKA** a ve všech pěti jazycích jsou ZNAK PO ZNAKU STEJNÉ, nepřekládají se. V kódu je drží konstanta `PRODUCT_NAMES` v `js/i18n.js`, mimo jazykové tabulky.

**V kódu a v uloženém souboru se používá NEUTRÁLNÍ KÓD** ("segment" / "mono"), ne obchodní jméno — přejmenování řady tak není změnou formátu souborů.

**Slovo „herdblok" je název DÍLU**, ne výrobku, a do zákaznických výstupů nepatří.

**Zavržené varianty:**
- **MODUL** — zavrženo, protože se s MONO plete ve výslovnosti i v písmu
- **MONOLITH** — zavrženo, protože vyzařuje studený nepřístupný objekt, kdežto bylo hledáno dojem přátelského, ale pevného a robustního prostředí

---

## 12. Co chybí — čeká na uživatele

### Nutné pro prototyp 3D

1. **Profil hrany — ZADÁNO a vyřešeno.** Deska se ohýbá dolů do čela.
   Poloměr ohybu je technologický (ohyb tlustého plechu), řádu 2–3 mm,
   a **ve vizualizaci se modeluje jako ostrá hrana 90°**. Poloměry do
   ~5 mm se ignorují; R50 u zaobleného rohu je jiná věc a modeluje se.
   **Standardní vlna = stav na fotografii z 31. 7. 2026.**
2. **Půdorys rohů — VYŘEŠENO** schématem z 31. 7. 2026, viz §4.3.
3. **Zbývá „zúžené svislé čelo na 20 mm".** Ve slovním zadání zaznělo,
   že zkosená vlna má svislé čelo zúžené ze 40 na 20 mm. Ze schématu
   půdorysu to nevyplývá — to řeší jen roh shora. Na prvním schématu
   jsou u pracovní desky **dva úhly 45°**, což by odpovídalo tomu, že
   se u zkosené varianty **sráží i horní hrana desky v řezu**.
   Potřebuji potvrdit: má zkosená vlna kromě půdorysného zkosení rohu
   navíc i **sražení hrany desky v řezu**, které zúží viditelné svislé
   čelo ze 40 na 20 mm? A platí to po celém obvodu, nebo jen na zkosené
   rovině?
4. **Fotografie rohu, kde se potkává zadní a boční límec.**
5. **Lemy kolem otvorů pro přístroje.** Na fotografii jsou navařené
   rámečky, do kterých indukce zapadá — vypadá to jako součást
   herdbloku, ne přístroje. Potvrdit, protože z toho plyne, jak se
   výřezy generují z katalogových rozměrů.

### Potvrdit dopočty

4. **Mezera od zdi** = hloubka herdbloku − 15 − 670. Sedí to?
5. **Celková délka zakončení 70 mm** (20 bez zkosení + 50 se zkosením).

### Ostatní

6. **Vlastní ochranné pole přístroje** — může si přístroj v katalogu
   určit větší než 50 mm, nebo je to pevná hodnota pro všechny?
7. **Rozměry přístroje z §8.1 čtu jako šířku × hloubku**, protože odstupy
   od přední a zadní hrany se bez hloubky spočítat nedají. Potvrdit.
8. **Příplatkové kruhové ovladače** — volba pro celý blok, nebo u každého
   přístroje zvlášť?
9. **Lemy kolem otvorů pro přístroje** — na fotografii jsou navařené
   rámečky, do kterých indukce zapadá. Součást herdbloku, nebo přístroje?
10. **Zúžené čelo 20 mm u zkosené vlny** — platí po celém obvodu té
    varianty, nebo jen na zkosené rovině rohu? Zatím vedeno jako
    „po celém obvodu".

### Vyřízeno v dokumentu

- Kontakty firmy, jakost oceli, síla desky, **síla korpusu 1,5 mm**
  a **povrchová úprava Brus K 320** — vše je v `js/report.js`, commit
  `b3e66ac` a `e5d7ab6`. Technická specifikace už nemá žádný řádek „—".
8. **Vnitřní radiusy H2/H3** — fotografie vnitřku skříňky, ať model
   sedí na skutečnost.

### Vyřízeno

- Poloměr ohybu plechu u límce — **0 (ostrý pravý úhel)**
- Největší délka sekce — **není omezení, může být jeden kus**
- Délka zkosené části — **50 mm**
- Výška ovládacího panelu — **250 mm**, spodní lišta je jeho součástí
- Chování límce u zkosení — **jen rovná zakončení a hrany pod 90°**
- Vztah hloubek — **podestavba zarovnaná s panelem**, standardně 670 mm
- Rozsah pracovní výšky — **850–900 mm**
- Rozměry přístrojů a odstupy — viz §8
- Povrchová úprava — **Brus K 320**
- Webová adresa — **potvrzena**
