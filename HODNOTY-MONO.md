# ALBA MONO — odsouhlasené hodnoty

**Zdroj:** uživatel je namodeloval v `prototyp/` a odeslal 1. 8. 2026.
**Platnost:** tohle jsou ZÁVAZNÉ hodnoty, ne odhady. Nepřepisuj je bez pokynu.

---

## 1. Terminologie — ZMĚNA

Dřívější tři typy zakončení (**vlna**, **zkosená vlna**, **zaoblená deska**
ve smyslu půdorysného tvaru rohu) se **ruší**. Nepochopili jsme se a nevadí to.

Nové názvosloví:


| Nový název       | Dřívější klíč v prototypu | Stav                              |
| ---------------- | ------------------------- | --------------------------------- |
| **zkosená vlna** | `svislaDeskaZkos`         | hodnoty níže, hotovo              |
| **vlna**         | `svislaDeska`             | uživatel domodeluje, hodnoty dodá |


Ve všech dokumentech i v kódu se pod „zkosenou vlnou" nově rozumí varianta,
kde pracovní deska pokračuje svisle po boku a má rovné i zkosené čelo.

---



## 2. Boční kryt — NOVÁ PRAVIDLA

Tohle je jediná věc, která v namodelovaném stavu **nesedí** a musí se předělat:

- Boční kryt **vždy kryje celou boční stranu podestaveb**.
- U **ostrovního** bloku jde **přes celou šířku obou stran bloku**.
- U zkosené vlny je **standardně 50 mm silný**.
- U vlny je **standardně 50 mm silný**.
- Je **„nalepený" na podestavbách, ne na konci herdbloku.**



## 3. Pozice konců — NOVÁ PRAVIDLA

- Maximální pozice konců skříněk a herdbloku je taková, jak ji uživatel
namodeloval.
- **Konec skříněk je zarovnaný s panelem herdbloku v ose X.**
- Blíž ke konci už skříňky být nemohou.
- Co jde vložit, je **prázdný prostor pro převis**.

---



## 4. Hodnoty — doslovně, jak je uživatel odeslal

**pro zkosenou vlnu**

```json
{
  "parametry": {
    "pracovniVyska": 900,
    "vyskaHerdbloku": 290,
    "vyskaCelaDesky": 50,
    "vyskaSpodniListy": 40,
    "vyskaNozicek": 150,
    "delkaHerdbloku": 2490,
    "hloubkaHerdbloku": 850,
    "presahDeskyVpredu": 30,
    "presahDeskyBocne": 25,
    "presahDeskyVzadu": 25,
    "silaPlechuDesky": 2,
    "zahnutiHranyDeskyDovnitr": 20,
    "polomerHorniHranyDesky": 3,
    "ustoupeniPanelu": 25,
    "sparaMeziDeskouAPanelem": 0,
    "sparaKolemPanelu": 1,
    "predsazeniSpodniListyPanelu": 4,
    "tvarPrechoduPanelDoListy": 0,
    "odsazeniSpodniHranyListyOdSpodkuHerdbloku": 0,
    "hloubkaVyklopeniPanelu": 0,
    "sparaMeziHerdblokemAPodestavbou": 0,
    "zapusteniHerdblokuDoPodestavby": 0,
    "tloustkaSpodnihoPlechuHerdbloku": 0,
    "prumerOtocnehoOvladace": 70,
    "vylozeniOtocnehoOvladace": 25,
    "roztecOvladacuVeSkupine": 110,
    "pocetOvladacuVeSkupine": 2,
    "vyskaOsyOvladacuOdHornihoOkrajePanelu": 110,
    "prumerTlacitka": 22,
    "rozmerCelaZasuvky230V": 80,
    "pocetPristroju": 3,
    "sirkaVyrezuPristroje": 520,
    "hloubkaVyrezuPristroje": 480,
    "sirkaLemuKolemOtvoruProPristroj": 0,
    "vyskaLemuNadDeskou": 0,
    "pristrojOdPredniHranyStandard": 100,
    "pristrojOdPredniHranyMin": 50,
    "pristrojOdZadniHranyMin": 50,
    "pristrojOchrannePoleMin": 50,
    "zakonceniVlnaR3": 2,
    "zakonceniZkoseniOdvesna": 50,
    "zuzeneCeloZkoseneVlny": 20,
    "zakonceniZaobleniR50": 50,
    "zakonceniRovnaCast": 20,
    "zakonceniZkosenaCast": 50,
    "delkaZakonceniBlokuPotvrzeni": 70,
    "bokRovnaCast": 20,
    "bokZkoseniDelka": 50,
    "bokZkoseniUhel": 45,
    "bokZkoseniKotaOdvesnou": 1,
    "bokPolomerSvislychHran": 0,
    "bokTloustka": 20,
    "bokPolomerPrehybuNahore": 3,
    "bokPresahDeskyNadBokem": 0,
    "bokPredsazeniCela": 0,
    "bokNabehKPaneli": 0,
    "bokPresahPodHerdblok": 0,
    "bokZahnutiSpodniHrany": 20,
    "bokZahnutiZadniHrany": 20,
    "bokZatazeniOdZadniHrany": 0,
    "bokZadniRohZkoseni": 0,
    "bokZatazeniPanelu": 70,
    "bokSparaPanelKBoku": 0,
    "bokZatazeniSpodniListy": 70,
    "bokZatazeniKorpusu": 0,
    "bokKrytZarovnatSBocnici": 1,
    "bokZarovnaniKrytuSkrinky": 0,
    "bokKrytKopirujeCelo": 1,
    "bokSparaKrytuPodDeskou": 0,
    "limecZarovnatSBocnici": 1,
    "limecVyska": 100,
    "tloustkaPlechuLimce": 20,
    "zahnutiHorniHranyLimce": 0,
    "odsazeniLimceOdHranyDesky": 0,
    "pocetPodestaveb": 3,
    "sirkaPodestavby": 800,
    "hloubkaPodestavby": 670,
    "tloustkaSteny": 20,
    "tloustkaPodlazky": 40,
    "pricnaListaVyska": 20,
    "pricnaListaHloubka": 20,
    "radiusH2": 16,
    "silaPlechuKorpusu": 1.5,
    "tloustkaZadniStenySkrinky": 20,
    "zapusteniPodestavbyOdKonce": 20,
    "mezeraMeziSousednimiPodestavbami": 0,
    "sirkaViditelneSparyMeziKorpusy": 0,
    "zaobleniSvislychRohuKorpusu": 0,
    "vyskaPoliceNadPodlazkou": 200,
    "pocetPolic": 1,
    "tloustkaPolice": 20,
    "zapusteniPoliceOdCela": 20,
    "sirkaLemuKolemOtvoruSkrinky": 0,
    "tloustkaDvirek": 20,
    "mezeraMeziDvirky": 3,
    "vylozeniUchytkyDvirek": 10,
    "prurezUchytkyDvirek": 20,
    "odsazeniSoklu": 40,
    "vyskaSoklu": 150,
    "mezeraSokluNadPodlahou": 0,
    "tloustkaSoklovehoPanelu": 15,
    "prurezRamuKonstrukcnihoSoklu": 20,
    "rozmerNozicky": 40,
    "odsazeniNozickyOdRohu": 50,
    "vyskaBocnihoKrytu": 750,
    "tloustkaBocnihoKrytu": 40,
    "presahBocnihoKrytuPresLicPodestavby": 0,
    "prevysMax": 500,
    "mostMax": 1200,
    "drsnostPovrchuNerezu": 0.35,
    "segmentyOblouku": 12
  },
  "volby": {
    "konecVlevo": "svislaDeskaZkos",
    "konecVpravo": "svislaDeskaZkos",
    "limec": "zadni",
    "hygiena": "H2",
    "sokl": "nozicky"
  },
  "dopocty": {
    "Podestavba včetně nožiček (PV − 290)": 610,
    "Tělo skříňky (bez nožiček)": 460,
    "Výška ovládacího panelu (290 − 40)": 240,
    "Mezera od zdi (hloubka − ustoupení − 670)": 155,
    "Celková délka zakončení (20 + 50)": 70,
    "Šířka facetky zkosené vlny (20 × √2)": 28.3,
    "Nos — průmět zkosení v X (dx)": 50,
    "Nos — průmět zkosení v Z (dz)": 50,
    "Nos — délka zkosené plochy (rozvinutá)": 70.7,
    "Nos — celkový zábor v X (rovné + dx)": 70,
    "Konec panelu od konce bloku": 70,
    "Odkryté čelo korpusu mezi panelem a nosem": 0,
    "Zbývá na nos ze zóny bez přístroje": 0,
    "Boční kryt pod svislou deskou (výška)": 460,
    "Vnitřní líc boku ↔ konec korpusu": 0,
    "Převis vlevo": 45,
    "Převis vpravo": 45,
    "Největší most": 0
  }
}
```

---

**pro vlnu**  

{
  "parametry": {
    "pracovniVyska": 900,
    "vyskaHerdbloku": 290,
    "vyskaCelaDesky": 50,
    "vyskaSpodniListy": 40,
    "vyskaNozicek": 150,
    "delkaHerdbloku": 2490,
    "hloubkaHerdbloku": 850,
    "presahDeskyVpredu": 30,
    "presahDeskyBocne": 25,
    "presahDeskyVzadu": 25,
    "silaPlechuDesky": 2,
    "zahnutiHranyDeskyDovnitr": 20,
    "polomerHorniHranyDesky": 3,
    "ustoupeniPanelu": 25,
    "sparaMeziDeskouAPanelem": 0,
    "sparaKolemPanelu": 1,
    "predsazeniSpodniListyPanelu": 4,
    "tvarPrechoduPanelDoListy": 0,
    "odsazeniSpodniHranyListyOdSpodkuHerdbloku": 0,
    "hloubkaVyklopeniPanelu": 0,
    "sparaMeziHerdblokemAPodestavbou": 0,
    "zapusteniHerdblokuDoPodestavby": 0,
    "tloustkaSpodnihoPlechuHerdbloku": 0,
    "prumerOtocnehoOvladace": 70,
    "vylozeniOtocnehoOvladace": 25,
    "roztecOvladacuVeSkupine": 110,
    "pocetOvladacuVeSkupine": 2,
    "vyskaOsyOvladacuOdHornihoOkrajePanelu": 110,
    "prumerTlacitka": 22,
    "rozmerCelaZasuvky230V": 80,
    "pocetPristroju": 3,
    "sirkaVyrezuPristroje": 520,
    "hloubkaVyrezuPristroje": 480,
    "sirkaLemuKolemOtvoruProPristroj": 0,
    "vyskaLemuNadDeskou": 0,
    "pristrojOdPredniHranyStandard": 100,
    "pristrojOdPredniHranyMin": 50,
    "pristrojOdZadniHranyMin": 50,
    "pristrojOchrannePoleMin": 50,
    "zakonceniVlnaR3": 2,
    "zakonceniZkoseniOdvesna": 50,
    "zuzeneCeloZkoseneVlny": 20,
    "zakonceniZaobleniR50": 50,
    "zakonceniRovnaCast": 20,
    "zakonceniZkosenaCast": 50,
    "delkaZakonceniBlokuPotvrzeni": 70,
    "bokRovnaCast": 20,
    "bokZkoseniDelka": 50,
    "bokZkoseniUhel": 45,
    "bokZkoseniKotaOdvesnou": 1,
    "bokPolomerSvislychHran": 0,
    "bokTloustka": 20,
    "bokPolomerPrehybuNahore": 3,
    "bokPresahDeskyNadBokem": 0,
    "bokPredsazeniCela": 0,
    "bokNabehKPaneli": 0,
    "bokPresahPodHerdblok": 0,
    "bokZahnutiSpodniHrany": 20,
    "bokZahnutiZadniHrany": 20,
    "bokZatazeniOdZadniHrany": 0,
    "bokZadniRohZkoseni": 0,
    "bokZatazeniPanelu": 70,
    "bokSparaPanelKBoku": 0,
    "bokZatazeniSpodniListy": 70,
    "bokZatazeniKorpusu": 0,
    "bokKrytZarovnatSBocnici": 1,
    "bokZarovnaniKrytuSkrinky": 0,
    "bokKrytKopirujeCelo": 1,
    "bokSparaKrytuPodDeskou": 0,
    "limecZarovnatSBocnici": 1,
    "limecVyska": 100,
    "tloustkaPlechuLimce": 20,
    "zahnutiHorniHranyLimce": 0,
    "odsazeniLimceOdHranyDesky": 0,
    "pocetPodestaveb": 3,
    "sirkaPodestavby": 800,
    "hloubkaPodestavby": 670,
    "tloustkaSteny": 20,
    "tloustkaPodlazky": 40,
    "pricnaListaVyska": 20,
    "pricnaListaHloubka": 20,
    "radiusH2": 16,
    "silaPlechuKorpusu": 1.5,
    "tloustkaZadniStenySkrinky": 20,
    "zapusteniPodestavbyOdKonce": 20,
    "mezeraMeziSousednimiPodestavbami": 0,
    "sirkaViditelneSparyMeziKorpusy": 0,
    "zaobleniSvislychRohuKorpusu": 0,
    "vyskaPoliceNadPodlazkou": 200,
    "pocetPolic": 1,
    "tloustkaPolice": 20,
    "zapusteniPoliceOdCela": 20,
    "sirkaLemuKolemOtvoruSkrinky": 0,
    "tloustkaDvirek": 20,
    "mezeraMeziDvirky": 3,
    "vylozeniUchytkyDvirek": 10,
    "prurezUchytkyDvirek": 20,
    "odsazeniSoklu": 40,
    "vyskaSoklu": 150,
    "mezeraSokluNadPodlahou": 0,
    "tloustkaSoklovehoPanelu": 15,
    "prurezRamuKonstrukcnihoSoklu": 20,
    "rozmerNozicky": 40,
    "odsazeniNozickyOdRohu": 50,
    "vyskaBocnihoKrytu": 750,
    "tloustkaBocnihoKrytu": 40,
    "presahBocnihoKrytuPresLicPodestavby": 0,
    "prevysMax": 500,
    "mostMax": 1200,
    "drsnostPovrchuNerezu": 0.35,
    "segmentyOblouku": 12
  },
  "volby": {
    "konecVlevo": "svislaDeskaZkos",
    "konecVpravo": "svislaDeskaZkos",
    "limec": "zadni",
    "hygiena": "H2",
    "sokl": "nozicky"
  },
  "dopocty": {
    "Podestavba včetně nožiček (PV − 290)": 610,
    "Tělo skříňky (bez nožiček)": 460,
    "Výška ovládacího panelu (290 − 40)": 240,
    "Mezera od zdi (hloubka − ustoupení − 670)": 155,
    "Celková délka zakončení (20 + 50)": 70,
    "Šířka facetky zkosené vlny (20 × √2)": 28.3,
    "Nos — průmět zkosení v X (dx)": 50,
    "Nos — průmět zkosení v Z (dz)": 50,
    "Nos — délka zkosené plochy (rozvinutá)": 70.7,
    "Nos — celkový zábor v X (rovné + dx)": 70,
    "Konec panelu od konce bloku": 70,
    "Odkryté čelo korpusu mezi panelem a nosem": 0,
    "Zbývá na nos ze zóny bez přístroje": 0,
    "Boční kryt pod svislou deskou (výška)": 460,
    "Vnitřní líc boku ↔ konec korpusu": 0,
    "Převis vlevo": 45,
    "Převis vpravo": 45,
    "Největší most": 0
  }
}

## 5. Co se proti dřívější specifikaci ZMĚNILO

Tyhle hodnoty přepisují, co bylo v `SPEC-HERDBLOK.md` odhadnuté nebo zadané
dřív. Kde se liší, platí tenhle dokument.


| Veličina                | Dřív | Nově               |
| ----------------------- | ---- | ------------------ |
| Viditelné čelo desky    | 40   | **50**             |
| Spodní lišta            | 30   | **40**             |
| Ustoupení panelu        | 15   | **25**             |
| Výška ovládacího panelu | 250  | **240** (290 − 50) |


Beze změny zůstává: pracovní výška 900, herdblok 290, nožičky 150,
hloubka podestavby 670, stěna 20, podlážka 40, příčná lišta 20,
radius H2 16, síla plechu korpusu 1,5, most 1200.
(Převis byl 500, od 5. 8. 2026 je 1200 — viz 7.6.)

---



## 6. Rozpory v odeslaných hodnotách — ČEKAJÍ NA UŽIVATELE

Tyhle čtyři věci si v odeslaném souboru odporují. Neopravuji je sám,
protože nevím, která strana je ta správná.

1. **Tloušťka bočního krytu.** V hodnotách `tloustkaBocnihoKrytu: 40`,
  ale v textu „u zkosené vlny standardně **20 mm** silný". Platí 20?
2. **Výška bočního krytu.** `vyskaBocnihoKrytu: 750`, ale dopočet říká
  „Boční kryt pod svislou deskou (výška): **460**". Nové pravidlo zní, že
   kryje celou boční stranu podestaveb — což je 460 (tělo skříňky) nebo 610
   (včetně nožiček)?
3. **Popisek dopočtu panelu** je zastaralý: „(290 − 40)" při čele desky 50.
  Hodnota 240 je správná, jen ten vzorec v závorce ne.
4. **Převis vs. zarovnání skříněk.** Dopočet hlásí převis 45 na každé straně,
  ale nové pravidlo říká, že konec skříněk je zarovnaný s panelem herdbloku
   — a panel končí 70 mm od konce bloku. Beru to tak, že **45 je stav starého
   vystředěného rozvržení a nahradí ho pravidlo se zarovnáním na panel**,
   tedy převis bude 70. Potvrdit.

---

## 7. Upřesnění z 5. 8. 2026

Tenhle oddíl vznikl při stavbě ostré geometrie. **Kde se liší od oddílů 4,
5 a 6, platí tenhle oddíl** — je novější.

### 7.1 Vodopád — dodané hodnoty

Varianta `svislaDeska` („vodopád") se od `svislaDeskaZkos` („zkosený vodopád")
liší jen v těchto hodnotách:


| Veličina | vodopád | zkosený vodopád |
| -------- | ---- | ------------ |
| Viditelné čelo desky | 50 | 50 |
| Rovné čelo nosu (`bokRovnaCast`) | **50** | 20 |
| Zkosení nosu | žádné | 50 pod 45° |


Panel, podestavby, kryty a všechny ostatní hodnoty jsou u obou variant
shodné.

**JSON blok označený „pro vodopád" v oddílu 4 je omylem druhý opis zkoseného
vodopádu.** Platí tabulka výše, ne ten blok.

### 7.2 Zatažení panelu a lišty od boku závisí na typu konce

Není to jedno číslo, jak uvádí oddíl 4.


| Typ konce | Zatažení panelu i spodní lišty od boku |
| --------- | ------------------------------------- |
| `svislaDeska` | **50** |
| `svislaDeskaZkos` | **70** |


Hodnoty `bokZatazeniPanelu: 70` a `bokZatazeniSpodniListy: 70` v oddílu 4
platí jen pro `svislaDeskaZkos`.

Protože konec skříněk je zarovnaný s panelem herdbloku (oddíl 3), začíná
krajní podestavba na téže hodnotě. Levý a pravý konec mohou mít různý typ,
takže rozvržení nemusí být symetrické.

### 7.3 Spodní lišta

Přední líc spodní lišty je **3 mm** za lícem pracovní desky. V ose Z tedy
lišta zabírá 3–45. Dřívější odvození 21 z předsazení 4 proti panelu
neplatí.

### 7.4 Boční kryt

- Výška **460**, tedy tělo skříňky — od 150 do 610 při pracovní výšce 900.
  Hodnota `vyskaBocnihoKrytu: 750` z oddílu 4 je celková boční kůže od
  nožiček po desku, ne kryt. Tím se uzavírá otevřená otázka z oddílu 6 bod 2.
- Hloubka: od líce podestavby (z 30) **až ke stěně** (z 850), tedy 820.
  U ostrovního bloku je to jeden průběžný kus přes obě řady podestaveb
  i mezeru mezi nimi.
- **Dvě tloušťky: 50 a 20.** Tím se vysvětluje spor z oddílu 6 bod 1 —
  neplatí jedna hodnota, existují obě, každá pro jiný případ.
- **Každá strana podestavby, na kterou zboku přímo nenavazuje jiná
  podestavba, musí být ukončena bočním krytem.** Není to volba, je to
  odvozené z rozvržení.
- Tloušťka **50** se použije jen tam, kde podestavba začíná co nejvíc na
  kraji varného bloku, tedy tam, kde před ní není žádný volný prostor.
  **Všude jinde 20** — typicky po obou stranách mezery mezi podestavbami.
- **VÝJIMKA (8. 8. 2026):** je-li typ zakončení na daném konci
  `svislaDeskaZkos` (zkosený vodopád) **a** je na tom konci podestavba
  (tedy by jinak platilo pravidlo výš a vyšla by tloušťka 50), použije se
  místo toho **20**. Samotné „na kraji" už nestačí — musí se navíc podívat
  na typ konce. Platí pro každý konec zvlášť (`leftEndType`/`rightEndType`
  se posuzují nezávisle), takže jeden konec bloku může mít kryt 50 a druhý
  20. Zadavatel: „pokud tady bude blok ukončen zkoseným vodopádem
  s podestavbou, použijme spodní krycí panel jen 20 mm. Myslím, že to bude
  vypadat lépe."
- Poloha v ose X na kraji bloku závisí na typu konce:


| Typ konce | Pořadí v ose X od kraje bloku |
| --------- | ----------------------------- |
| `svislaDeska` | 0–50 boční kryt, od 50 podestavby |
| `svislaDeskaZkos` | 0–50 nic, 50–70 boční kryt (20 mm), od 70 podestavby |

*Řádek pro `svislaDeskaZkos` platí za předpokladu, že na daném konci podestavba je.*


### 7.5 Nos — svislá boční deska a zkosení

Tvar je dodaný. Pro `svislaDeska` (vodopád) platí následující omezení:

- Přední líc nosu je v ose Z na **0**, shodně s lícem desky.
- Vnější líc nosu je v ose X na **0**, tedy v konci bloku.

*Pro `svislaDeskaZkos` (zkosený vodopád) je roh useknutý — viz popis níže.*

- Rovné čelo je dlouhé **50** u `svislaDeska` (vodopád), u `svislaDeskaZkos` (zkosený vodopád)
  **20 rovných + 50 zkosení pod 45°**.

**Tvar zkosení u `svislaDeskaZkos`** — potvrzeno 8. 8. 2026:

- Zkosení **je POUZE V PŮDORYSU** — useknutý roh při pohledu shora. Ve svislém řezu
  (pohled zepředu, pohled z boku) se nemění nic, čelo desky zůstává po celé délce
  svislých 50 mm. **Žádná facetka ve svislém řezu neexistuje.** Tohle se zdůrazňuje,
  protože na tom už dvakrát vzniklo nedorozumění.
- Geometrie v ose X (levý konec je X = 0): vnější líc v prvních 50 mm od přední hrany chybí
  (useknutý roh); začíná až od Z = 50 a pokračuje dozadu. Odtud zkosení pod 45° dopředu doprava do bodu X = 50, Z = 0,
  tedy `END_CHAMFER_MM = 50`. Poté přední hrana rovně dál, po dalších 20 mm (`END_STRAIGHT_MM = 20`),
  tedy na X = 70, kde začíná ovládací panel. Kontrola: 50 + 20 = 70, což je právě
  `sideInsetMM('svislaDeskaZkos')`.
- **Kterých rohů se zkosení týká:**
  - U **varianty u stěny** (`single`): zkosené jsou **JEN PŘEDNÍ rohy**. Zadní roh (u stěny)
    zůstává ostrý.
  - U **varianty ostrov** (`island`): zkosené mohou být **VŠECHNY rohy**. Ostrov nemá
    záda a obchází se po obou stranách, takže všechny čtyři rohy jsou stejně viditelné.


### 7.6 Převis se měří od konce panelu

Ne od konce bloku. Koncová zóna je konstrukční a je tam vždycky, takže
plně obsazený blok hlásí převis **0**, ne 50 nebo 70.
Tím se uzavírá otevřená otázka z oddílu 6 bod 4 — hodnota 45 z dopočtů
neplatí.

**Mez převisu je 1200 mm** (zvýšeno z 500 na pokyn zadavatele 5. 8. 2026,
večer). Je to stejné číslo jako mez mostu, ale drží se jako samostatná
konstanta `OVERHANG_LIMIT_MM` — most je nepodepřená světlost MEZI
podestavbami, převis je konzola na konci řady. Kdyby se meze někdy
rozešly, musí jít změnit nezávisle na sobě.

### 7.7 Zapuštění podestavby od konce

`zapusteniPodestavbyOdKonce: 20` z oddílu 4 přestává být samostatný vstup.
Polohu krajní podestavby určuje zatažení panelu podle 7.2.

### 7.8 Co zůstává otevřené

1. **Rozklad výšky čela desky 50** na svislou a šikmou část u zkosené vlny.
   Tvrdá podmínka na jakékoli řešení: ovládací panel nesmí nikdy předsazovat
   před spodní hranu desky.
2. **Jdou vnitřní kryty 20 mm taky až ke stěně**, nebo mají končit na zadním
   líci podestavby (z 700)?
3. **Půdorysný tvar nosu** mimo tři omezení v 7.5.

### 7.9 Názvosloví — vodopád místo vlny

**Tenhle pododdíl přepisuje tabulku názvů v oddílu 1.** Dřívější pracovní
název „vlna" se ruší, protože slibuje křivku, kterou tvar nemá — poloměr
svislých hran je 0 a `zakonceniVlnaR3` má hodnotu 2, tedy pod hranicí, kdy
se poloměr vůbec kreslí. „Vodopád" naopak nese konstrukční pravidlo:
pracovní deska padá po boku v jedné rovině přes celou hloubku.

Anglické `waterfall` navíc není překlad, ale zavedený oborový termín pro
pracovní desku, která pokračuje svisle po boku.


| Jazyk | svislaDeska | svislaDeskaZkos |
| ----- | ----------- | --------------- |
| cs | Vodopád | Zkosený vodopád |
| sk | Vodopád | Skosený vodopád |
| en | Waterfall | Chamfered waterfall |
| de | Wasserfall | Wasserfall mit Fase |
| pl | Wodospad | Wodospad ze ścięciem |


Jde o **popisné názvy tvaru, a proto se překládají** — na rozdíl od
obchodních jmen řad ALBA SEGMENT a ALBA MONO, která se nepřekládají.

**V kódu se nepřejmenovává nic.** Klíče `svislaDeska` a `svislaDeskaZkos`
se ukládají do souboru projektu a zůstávají beze změny; obchodní název
žije výhradně v `js/i18n.js`. Přejmenování tak nesahá na formát souboru
ani na geometrii.

---

## 8. Druhy podestaveb — hodnoty z 31. 8. 2026

Rozhodnutí zadavatele z 9. 8. 2026, implementovaná podle smlouvy
`ZADANI-PODESTAVBY-MONO.md` (úkoly 14–16 v `PREDANI.md`). Podrobný rozpis
geometrie je ve smlouvě; tady jsou jen závazná ČÍSLA.

| druh (`kind`) | šířka | provedení (`bodyStyle`) |
| --- | --- | --- |
| `cabinet` | volitelná | `closed` / `doors` / `open` (+ police) |
| `gap` | volitelná | — (úmyslně vynechané místo, těleso nevzniká) |
| `drawers` | **pevně 400 nebo 600** | — (vždy 2 zásuvky) |
| `gnRack` | **pevně 400 nebo 600** | jen `open` / `doors` |

- **400 mm = GN 1/1, 600 mm = GN 2/1.** Uživatel šířku u `drawers`
  a `gnRack` NEVOLÍ, jen se mu zobrazuje.
- **Zásuvkový blok má právě 2 zásuvky.** Počet je konstanta, ne parametr.
- **Skříňka se zásuvy na GN má 6 párů vsuvů, rozteč 70 mm.** Střed
  nejnižšího vsuvu je 40 mm nad horní hranou podlážky.
- **Police je příznak KAŽDÉ SKŘÍŇKY zvlášť** (`hasShelf`), má význam jen
  při `bodyStyle: 'open'`. Zapuštěná 25 mm od líce korpusu, výškově
  vystředěná v dutině mezi podlážkou a horní lištou.
- **Dvířka:** 2 křídla nad 600 mm šířky, jinak 1 (stejné pravidlo jako
  SEGMENT).

**Podlážka je 40 mm** (`FLOOR_MM`), ne 20 — výšky police i vsuvů se počítají
od její HORNÍ hrany, tedy ze stejné základny jako náběhy H2. Při přejímce
31. 8. 2026 jsem tuhle konstantu spletl a poslal agentovi chybnou opravu;
zapsáno sem, aby se to nemuselo dohledávat znovu.

---

## 9. Sokl a strana B ostrova — hodnoty z 1. 9. 2026

Dvě opravy nahlášené zadavatelem, provedené podle
`ZADANI-OPRAVY-B-A-SOKL.md`. Podrobnosti v `PREDANI.md` úkoly 18 a 19.

### 9.1 Sokl je jen pod skříňkami

**Přepisuje pravidlo z oddílu 8 i z `ZADANI-SOKL.md`, že se sokl uskakuje
50 mm „od líce bloku".**

- Sokl (`construction` i `legs_plinth`) se staví **jen pod souvislými úseky
  skříněk**, ne po obvodu bloku. Sousedící skříňky (tolerance 0,5 mm) =
  jeden úsek s jedním soklem; **mezera úsek rozdělí**; mimo skříňky nic.
- **Uskočení 50 mm se měří od LÍCŮ SKŘÍNĚK** toho úseku, ze všech stran.
  Obrys bloku pro sokl přestal být vztažnou hranou.
- Důsledek v číslech: čelo soklu u MONO je nově v **z = 80** (líc skříňky
  30 + 50), dřív 50. U SEGMENTu se hranice v ose X posunula o 20 mm
  (`SIDE_PANEL_MM`) blíž ke středu.
- U ostrova má **každá řada vlastní sokl** — nespojují se.
- Výška, materiál, tloušťka plechu a jména těles se nemění.

### 9.2 Strana B se měří od svého vlastního levého kraje

- Obsah strany B (skříňky, prvky panelu, přístroje) se ve 3D **zrcadlí**
  stejně jako strana A. Bez toho se pořadí na obrazovce neshodovalo s pásem,
  protože s blokem se otáčí i kamera.
- Strip x = 0 strany B proto leží na **fyzicky opačném konci bloku** než
  strip x = 0 strany A. Z toho plyne, že **strana B má prohozené koncové
  typy**: její levý kraj řídí `rightEndType` a naopak.
- V rozhraní: **u strany B levá koncovka přepíná pravé zakončení bloku.**
  Uložená pole se nepřejmenovávají, je to jen čtecí pravidlo.
- **Fyzický tvar konců korpusu se tím nemění** — ten je vlastností bloku,
  ne strany.

---
