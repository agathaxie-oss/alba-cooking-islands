# Předání pro novou session

**Datum:** 31. 7. 2026
**Účel:** zkrátit kontext. Tenhle dokument je soběstačný — obsahuje
kompletní geometrii nového typu bloku, stav repozitáře a pasti při
ověřování. Čti ho celý, než začneš.

---

## 0. Jak uživatel pracuje — DŮLEŽITÉ

**Hlavní agent zadává a kontroluje, implementaci píší levnější modely.**

- **Kód nepiš sám.** Napiš podrobné zadání a předej ho Sonnetu (větší
  úkoly) nebo Haiku (drobnosti).
- **Výsledek si vždy ověř sám v prohlížeči.** Agenti opakovaně hlásili
  úspěch tam, kde byla vada. Měření přes JS je autoritativní.
- **Dva agenti nesmí psát do stejného souboru naráz.** Většina změn
  sahá do `js/ui.js` a `css/style.css`, takže se paralelizovat skoro
  nedá — pouštěj je po sobě. Souběžně jde jen to, co je souborově
  oddělené (např. `js/i18n.js` zvlášť dopředu).
- **Vizuální změny nech uživateli schválit před implementací.** Osvědčilo
  se kreslit varianty jako obrázek a nechat vybrat — konvergovalo to
  mnohem rychleji než popis slovy.
- Vše viditelné musí být v **5 jazycích** (en, de, pl, cs, sk).
- U sebe si nech rozhodnutí o rozložení a barvách.

---

## 1. Stav repozitáře

Pracovní strom je **čistý**. Poslední commity (odshora nejnovější):

| Commit | Co |
|---|---|
| `e5d7ab6` | dokument: povrchová úprava a síla korpusu |
| `b3e66ac` | dokument: kontakty firmy a jakost materiálu |
| `82053b6` | čitelnější karty v pásu a nová podoba ramen |
| `799cb6e` | oddělení pohledu na blok od editované strany |
| `8077e6d` | i18n: 7 klíčů pro spodní pás a ramena |
| `374a784` | zpřehlednění horní části levého panelu |
| `7777c6f` | krok 3A: spodní pás se sestavou (desktop) |
| `9e7f084` | krok 2: paleta prvků jako řádky s filtrem |

`SPEC-HERDBLOK.md` je **nesledovaný** — zacommituj ho.

### Co je ve stávající aplikaci hotové

Světlá firemní paleta, horní lišta s ovládáním aplikace, vektorové logo,
tiskový dokument s kompletní technickou specifikací i kontakty, půdorys
s hierarchií kót, paleta prvků s filtrem, spodní pás se sestavou
(karty + sdílený pruh parametrů), ramena jako karty, oddělené přepínání
pohledu a editované strany, název projektu, ukládání s volbou názvu.

### Co ve stávající aplikaci zbývá

1. **Krok 3, část B — mobilní plachta.** Na 375 px teď panel a pás jedou
   vedle sebe v prozatímním rozvržení a 3D pohled má jen **205 px**
   (před krokem 3A měl 418). Cílem je jedna spodní plachta se dvěma
   záložkami — popsáno v `ZADANI-UI.md` §4, oddíl „MOBIL".
   **Nerozhodnutá otázka:** má se plachta ovládat tažením prstu, nebo
   stačí klepnutí na úchyt cyklující tři stavy?
2. **Prázdná hláška u ramen** zní „Žádná ramena — přidejte níže.", ale
   karta pro přidání je nově v řadě **nad** pruhem. Přeformulovat v pěti
   jazycích — uživatel se k tomu zatím nevyjádřil.
3. **Desetinný oddělovač u příkonu.** V češtině se tiskne „0.0 kW"
   s tečkou místo čárky. Stará vada, zákaznický dokument.
4. `ZADANI-UI.md` §3 a §8 jsou neaktuální (popisují už hotové věci).

---

## 2. Nový produkt — varný blok s herdblokem

Uživatel chce **druhý, konstrukčně odlišný produkt**, který poběží
**souběžně** se stávajícím typem. Stávající typ se neruší.

Plná specifikace je v **`SPEC-HERDBLOK.md`**. Geometrie je níže v §3
zopakovaná úplně, aby tenhle dokument stačil sám o sobě.

**Doporučení k architektuře** (uživatel zatím nerozhodl): jedno úložiště
se sdíleným jádrem a dvěma produktovými moduly, typ se volí při založení
projektu. Důvod: katalog, pět jazyků, paleta, horní lišta, kamera
a dokument jsou u obou stejné a dvě oddělené základny by se rozešly.

**Nejbližší krok:** prototyp samotné geometrie ve 3D, **bez rozhraní**.
Na něj se pak váže půdorys, dokument i pás, takže má být hotový
a odsouhlasený dřív, než se kolem staví cokoli dalšího.

---

## 3. GEOMETRIE — úplně a přesně

Všechny rozměry v milimetrech. Hodnoty označené *(odvozeno)* jsou
dopočty čekající na potvrzení.

### 3.1 Dvě nezávislé vrstvy

Blok se skládá ze dvou vrstev nad **společnou osou X**:

- **podestavby** — samostatné skříňky, každá s vlastním `xMM` a `widthMM`
- **herdblok** — deska s přístroji a ovládacím panelem, položená na
  podestavbách, s vlastním `xMM` a `widthMM`

Vrstvy se nemusí krýt. Proto **poloha není pořadí, ale souřadnice**.
Z toho plyne most i převis.

### 3.2 Výšky

| Veličina | Hodnota |
|---|---|
| Pracovní výška | **850–900**, výchozí 900 |
| Herdblok včetně desky | **290**, konstrukčně pevný |
| Podestavba včetně nožiček | **560–610** = pracovní výška − 290 |
| Nožičky | **150**, konstanta |
| Tělo skříňky | pracovní výška − 290 − 150, tedy **410–460** *(odvozeno)* |

**Výška bloku se mění tělem skříňky, ne nožičkami ani herdblokem.**

### 3.3 Čelní skladba herdbloku

Shora dolů v rámci 290 mm:

| Pásmo | Výška | Poznámka |
|---|---|---|
| pracovní deska | **40** | viditelné svislé čelo |
| výklopný ovládací panel | **250** | ustoupený **15** za líc desky |

40 + 250 = 290.

**Spodní lišta je součástí panelu, ne samostatné pásmo** — je vysoká
**30**, je ve spodní části panelu a vrací se dopředu skoro do líce desky.

### 3.4 Hrany a rohy

- Deska se ohýbá dolů do čela; poloměr ohybu je technologický
  (**2–3 mm**) a **v modelu se kreslí jako ostrá hrana 90°**.
- Poloměry **do ~5 mm se ignorují**. R50 u zaobleného rohu je jiná věc
  a modeluje se.
- **Tři typy zakončení se liší PŮDORYSNÝM tvarem rohu:**

| Typ | Půdorys rohu |
|---|---|
| **Vlna** | v podstatě ostrý roh, **R 3** |
| **Zkosená vlna** | roh useknutý pod **45°**, odvěsny **50 × 50** (vnitřní úhly **135°**) |
| **Zaoblená hrana** | roh zaoblený **R 50** |

- **Zkosení prochází celou výškou bloku** — deska, panel i boční kryt
  kopírují tutéž zkosenou rovinu.
- **Zkosená vlna má navíc sraženou hranu desky v řezu:** viditelné
  svislé čelo je u ní **20** místo 40, zbytek nahradí facetka pod 45°
  o šířce **28,3** *(odvozeno = 20 × √2)*.
  *Nepotvrzeno:* zda zúžené čelo platí po celém obvodu té varianty,
  nebo jen na zkosené rovině rohu. Zatím vedeno jako po celém obvodu.
- Na zkosenou rovinu navazuje **zakončovací plech zboku na podestavby**
  („boční kryt").

### 3.5 Límec

- výška **volitelná 40–300**, nejčastěji **100**
- na **vybraných hranách** obrysu
- **jen na rovných zakončeních nebo hranách napojených pod 90°** —
  na zkosených a zaoblených místech límec není
- *chybí:* poloměr ohybu plechu u límce

### 3.6 Podepření

| Pravidlo | Mez |
|---|---|
| **Převis** — volný konec za poslední podestavbou | **500** |
| **Most** — nepodepřená světlost mezi podestavbami | **1200** |

Kontrolují se každé zvlášť. Překročení se hlásí.

### 3.7 Hloubky a poloha podestavby

- **Čelo podestavby je zarovnané s panelem herdbloku**, ne s lícem desky
  → **deska přes podestavbu přečnívá o 15**.
- Standardní hloubka podestavby **670**, pokud uživatel neurčí jinak.
- Hloubka herdbloku volná.
- Mezera od zdi = `hloubka herdbloku − 15 − 670` *(odvozeno)*.
  Pro 850 vyjde 165, pro 700 vyjde 15 — u mělkých bloků mezera zmizí.

### 3.8 Konstrukce skříňky

**Nejde o sílu plechu.** Korpus je z plechu **1,5 mm**, ale dílce jsou
vytvarované a duté, takže mají konstrukční tloušťku:

| Dílec | Tloušťka | Poznámka |
|---|---|---|
| stěna | **20** | |
| podlážka | **40** | úplně dole, součást konstrukce; uvnitř výztuhy a dutina — **v modelu se neřeší**, bere se jako plný dílec |
| příčná lišta nahoře | **20 × 20** | **jen vpředu**, ne vzadu |
| nožičky | **150** | |

**Stěny sousedních skříněk se sčítají** — mezi vnitřky dvou skříněk
vedle sebe je **40** (20 + 20), ne 20. Vnitřní světlost samostatné
skříňky je vnější šířka − 2 × 20.

### 3.9 Hygienické stupně (jen podestavby)

Jde o **konstrukci**, ne o tloušťku plechu.

| Stupeň | Konstrukce |
|---|---|
| **HS+** | základní korpus s viditelnými spárami |
| **H1** | žádné spáry na čele ani uvnitř, vše svařeno a vyčištěno |
| **H2** | jako H1 + kouty **mezi podlážkou a stěnami** s **R 16**; zepředu vidět vlevo a vpravo dole |
| **H3** | jako H2, ale skříňka má navíc **horní plech** a **R 16 mají všechny kouty** |

### 3.10 Provedení soklu

| Provedení | Popis |
|---|---|
| **Stavební sokl** | sokl postavený na stavbě, blok se na něj posadí |
| **Nožičky a soklová nerezová zástěna** | 4 nožičky pod každým korpusem, sokl nasazený zepředu |
| **Konstrukční sokl** | nerezový rám pod celým blokem — blok na něm leží a zároveň slouží jako sokl |

Poslední dvě se **vzhledově neliší**, konstrukčně ano → musí být
rozlišené v soupisu dílů a v dokumentu.

**Odsazený sokl se dělá kolem dokola včetně boků**, ne jen z čela.

### 3.11 Přístroje

Osazují se **do herdbloku**, ne do podestavby.

| Rozměr | Význam |
|---|---|
| **pod deskou** | kolik místa přístroj zabírá pod deskou — povinný |
| **na desce** | kolik zabírá na desce; **není to nutně výřez** — nepovinný, při chybějící hodnotě se rovná prvnímu |

*Nepotvrzeno:* čtu oba rozměry jako **šířku × hloubku**, protože bez
hloubky nejdou spočítat odstupy od hran.

**Odstupy:**

| Pravidlo | Hodnota |
|---|---|
| Minimální ochranné pole mezi přístroji | **50** |
| Minimální vzdálenost od přední hrany | **50** |
| Minimální vzdálenost od zadní hrany | **50** |
| Standardní vzdálenost od přední hrany | **100** |

**Ochranná pole se nesčítají** — platí `mezera = max(pole_A, pole_B)`,
nejméně 50.

Na fotografii jsou kolem otvorů **navařené lemy**, do kterých přístroj
zapadá. *Nepotvrzeno,* jestli patří herdbloku nebo přístroji.

### 3.12 Ovládací panel

- **Je součástí herdbloku, ne přístroje.** Přístroj do něj jen propisuje
  své ovládací prvky.
- Běží **po celém čele** kromě zkosených zakončení.
- **Ovládání přístroje sedí v ose X pod svým přístrojem** — ověřeno na
  fotografii (tři knoflíky pod každou indukcí). Posun vůči přístroji je
  teoreticky možný, ale nedělá se, protože se ztratí vazba, který
  knoflík patří k čemu. V rozhraní tedy pevná vazba.
- Do panelu se umisťuje **příslušenství s volnou polohou** — např.
  zásuvka 230 V.

**Druhy ovládacích prvků:**

| Druh | Provedení |
|---|---|
| tlačítka | pevné, jediné provedení |
| displeje | pevné, jediné provedení |
| kruhové otočné ovladače | **standardní nebo příplatkové** (masivní nerezové) |

**Upselovat jde jen kruhové ovladače.** *Nepotvrzeno,* jestli se volí
pro celý blok, nebo u každého přístroje zvlášť.

### 3.13 Nástavby nad blokem — ODLOŽENO

Roštová nástavba, police na salamandr apod. **Patří do stejné kategorie
jako napouštěcí ramena** — příslušenství s vlastní polohou nad blokem.
**Zatím se neřeší**, je to mimo rozsah první etapy.

---

## 4. Co z rozhraní přebrat a co změnit

**Beze změny:** horní lišta, světlá paleta a kontrastní pravidla, kamera
s obletem, pruh parametrů s přelévající se mřížkou, mazání ikonou koše
v záhlaví pruhu, paleta prvků s filtrem a odznakem cílové vrstvy,
oddělení pohledu od editace.

**Mění se:**

- **Pás dostane víc drah nad společnou osou X** — herdblok, ovládací
  panel, podestavby (a ramena jako dnes). Karty se umisťují podle
  skutečné souřadnice, takže most i převis jsou v pásu vidět jako mezera.
- **Šipky ◀ ▶ ztrácejí smysl** — s volnou polohou se neposouvá pořadí,
  ale souřadnice. Nahradí je číslo a posuvník, tedy přesně to, co už je
  postavené u ramen.
- **Cílová vrstva** se řeší stejným mechanismem jako dnešní odznak
  „do A / do B", jen místo strany ukazuje vrstvu.
- **Nově je potřeba přichytávání** na hranu souseda a na rozumný krok.
  Dnes v aplikaci není vůbec.
- **Kapacita „využito X / Y mm" ztrácí smysl** — délka není pevná
  schránka. Nahradí ji kontroly z §3.6 a §3.11.

---

## 5. Pasti při ověřování — STÁLY NEJVÍC ČASU

### Cache prohlížeče
`python -m http.server` neposílá hlavičky proti kešování. Před **každým**
ověřením:

```js
(async()=>{ const l=document.querySelector('link[rel=stylesheet]');
  await fetch(l.getAttribute('href').split('?')[0],{cache:'reload'});
  for (const f of ['js/main.js','js/ui.js','js/viewer.js','js/i18n.js',
                   'js/floorplan.js','js/report.js','js/catalog.js'])
    await fetch(f,{cache:'reload'}).catch(()=>{});
  location.reload(true); })()
```

### Browser pane má tři konkrétní omezení
1. **Akce `key` doručí prázdnou klávesovou událost** (`key:""`, `which:0`).
   Enter ani Escape se přes ni testovat nedají — vysílej `KeyboardEvent`
   přes JS. Akce `type` naopak funguje spolehlivě.
2. **Syntetické `MouseEvent` na `#three-canvas` výběr nevyvolají.**
   Když potřebuješ vybrat segment, klikni na kartu v pásu.
3. **Screenshoty jsou zkreslené** a ořez (`zoom` s `region`) není
   podporovaný. Měření přes `javascript_tool` je autoritativní.

### Kontrast se musí počítat se skládáním alfy
Naivní porovnání `color` proti `backgroundColor` u poloprůhledného
pozadí dává nesmysly — dvakrát to vedlo k falešnému hlášení vady.
Recept je v `ZADANI-UI.md` §5.

### `overflow-x: auto` zabíjí i svislou osu
Prohlížeč druhou osu povýší taky na `auto`. Kvůli tomu se ořízla špička
pod vybranou kartou a dřív i rozbalovací nabídka jazyka. Ořez probíhá
až na hraně padding-boxu, takže co je uvnitř odsazení, přežije.

### Ostatní
- Klíče v úložišti: `alba-katalog-v1`, `nerez-blok-config-v3`, `alba-jazyk`.
  **`localStorage.clear()` shodí jazyk na `en`**, takže české kontrolní
  řetězce pak nic nenajdou. Jazyk přepínej přes
  `const i = await import('./js/i18n.js'); i.setLang('cs');`
- **`window.print()` nespouštěj** a na „Uložit konfiguraci" neklikej
  naslepo — otevřel by systémový dialog a stáhl uživateli soubor.
- Port 8000 drží uživatelův Python. **Nezabíjet, nespouštět vlastní.**

---

## 6. Co uživatel ještě nedodal

1. **Poloměr ohybu plechu u límce** — číslo, ve fotografii se nezměří.
2. **Fotka rohu, kde se potkává zadní a boční límec.**
3. **Zúžené čelo 20 mm u zkosené vlny** — po celém obvodu, nebo jen
   na zkosené rovině?
4. **Vlastní ochranné pole přístroje** — smí být větší než 50?
5. **Rozměry přístroje** — šířka × hloubka, potvrdit.
6. **Příplatkové kruhové ovladače** — volba pro blok, nebo pro přístroj?
7. **Lemy kolem otvorů** — herdblok, nebo přístroj?
8. **Architektura** — jedno úložiště se sdíleným jádrem, nebo dvě
   oddělené aplikace?

Žádná z nich neblokuje prototyp geometrie kromě bodu 1 (límec).
Prototyp se dá postavit bez límce a doplnit ho, až číslo dorazí.
