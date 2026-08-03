// params.js — JEDINÉ místo, kde jsou definované rozměry prototypu ALBA MONO.
//
// Ovládací panel (controls.js) se generuje z tohoto seznamu, geometry.js si
// hodnoty jen čte. Přidání nového posuvníku = přidání jedné položky do PARAMS.
//
// Všechny hodnoty jsou v MILIMETRECH (kromě `drsnostPovrchuNerezu`, což je
// bezrozměrný parametr materiálu). Převod na metry dělá jediná konstanta
// MM_TO_M v geometry.js, a to až měřítkem kořenové skupiny.
//
// `certainty` říká, odkud číslo je:
//   'spec'      — je ve SPEC-HERDBLOK.md / PREDANI-NOVA-SESSION.md
//   'derived'   — dopočet ze specifikace, označený tam jako (odvozeno)
//   'uncertain' — ve specifikaci NENÍ, je to odhad k doladění tahem posuvníku
//   'proto'     — pomocný rozměr scény prototypu (kolik přístrojů, kolik
//                 skříněk apod.), do produktu nepatří
//
// Ovládací panel odlišuje 'uncertain' barevně — to jsou čísla, která se mají
// v prototypu doladit a odečíst.

export const CERTAINTY = {
  spec: { label: 'ze specifikace', css: 'c-spec' },
  derived: { label: 'odvozeno (potvrdit)', css: 'c-derived' },
  uncertain: { label: 'NEJISTÉ — doladit', css: 'c-uncertain' },
  proto: { label: 'scéna prototypu', css: 'c-proto' },
};

export const GROUPS = [
  { id: 'vysky', label: 'Výšky a pásma' },
  { id: 'deska', label: 'Pracovní deska a přesahy' },
  { id: 'panel', label: 'Ovládací panel a spodní lišta' },
  { id: 'ovladace', label: 'Ovládací prvky v panelu' },
  { id: 'vyrezy', label: 'Výřezy pro přístroje a lemy' },
  { id: 'zakonceni', label: 'Zakončení bloku' },
  { id: 'bok', label: 'Zakončení svislou deskou' },
  { id: 'limec', label: 'Límec' },
  { id: 'podestavba', label: 'Podestavby (skříňky)' },
  { id: 'sokl', label: 'Sokl a nožičky' },
  { id: 'kryt', label: 'Boční kryt' },
  { id: 'kontroly', label: 'Kontrolní meze (jen hlášení)' },
  { id: 'render', label: 'Materiál a dělení oblouků' },
];

/**
 * Definice parametrů. Pořadí v poli = pořadí v ovládacím panelu.
 * @typedef {{key:string,label:string,unit:string,value:number,min:number,max:number,
 *            step:number,group:string,certainty:string,note:string}} ParamDef
 */
export const PARAMS = [
  // --- výšky a pásma --------------------------------------------------------
  {
    key: 'pracovniVyska', label: 'Pracovní výška', unit: 'mm',
    value: 900, min: 850, max: 900, step: 5, group: 'vysky', certainty: 'spec',
    note: 'Horní líc desky nad podlahou. SPEC §2: 850–900, výchozí 900.',
  },
  {
    key: 'vyskaHerdbloku', label: 'Výška herdbloku', unit: 'mm',
    value: 290, min: 200, max: 400, step: 5, group: 'vysky', certainty: 'spec',
    note: 'SPEC §2: 290 mm, konstrukčně pevný. Výška bloku se mění podestavbou.',
  },
  {
    key: 'vyskaCelaDesky', label: 'Viditelné čelo desky', unit: 'mm',
    value: 40, min: 10, max: 80, step: 1, group: 'vysky', certainty: 'spec',
    note: 'SPEC §5: 40 mm. Panel pak vychází 290 − 40 = 250 (viz dopočty).',
  },
  {
    key: 'vyskaSpodniListy', label: 'Výška spodní lišty', unit: 'mm',
    value: 30, min: 10, max: 60, step: 1, group: 'vysky', certainty: 'spec',
    note: 'SPEC §5: 30 mm, je SOUČÁSTÍ panelu, ne samostatné pásmo.',
  },
  {
    key: 'vyskaNozicek', label: 'Výška nožiček', unit: 'mm',
    value: 150, min: 80, max: 250, step: 5, group: 'vysky', certainty: 'spec',
    note: 'SPEC §7.2: konstanta. Při změně pracovní výšky se mění tělo skříňky.',
  },

  // --- deska ----------------------------------------------------------------
  {
    key: 'delkaHerdbloku', label: 'Délka herdbloku', unit: 'mm',
    value: 2600, min: 600, max: 6000, step: 50, group: 'deska', certainty: 'uncertain',
    note: 'SPEC: „volná — vyrábí se na míru". Výchozí hodnota chybí.',
  },
  {
    key: 'hloubkaHerdbloku', label: 'Hloubka herdbloku', unit: 'mm',
    value: 850, min: 600, max: 1400, step: 10, group: 'deska', certainty: 'uncertain',
    note: 'SPEC: „volná". V příkladu §7.0 sama počítá s 850. Měřeno od LÍCE DESKY.',
  },
  {
    key: 'presahDeskyVpredu', label: 'Přesah desky vpředu (přes podestavbu)', unit: 'mm',
    value: 25, min: 0, max: 80, step: 1, group: 'deska', certainty: 'uncertain',
    note: 'Fotografie: deska se „přelévá přes kraje". Spec zná jen 15 mm.',
  },
  {
    key: 'presahDeskyBocne', label: 'Přesah desky po stranách', unit: 'mm',
    value: 25, min: 0, max: 80, step: 1, group: 'deska', certainty: 'uncertain',
    note: 'Ve specifikaci NENÍ vůbec. Dřívější nákresy s deskou v líci boku byly špatně.',
  },
  {
    key: 'presahDeskyVzadu', label: 'Přesah desky vzadu', unit: 'mm',
    value: 25, min: 0, max: 80, step: 1, group: 'deska', certainty: 'uncertain',
    note: 'Ve specifikaci NENÍ. Dopočet mezery od zdi řeší jen variantu u stěny.',
  },
  {
    key: 'silaPlechuDesky', label: 'Síla plechu desky', unit: 'mm',
    value: 3, min: 1, max: 5, step: 0.5, group: 'deska', certainty: 'uncertain',
    note: 'V SPEC-HERDBLOK.md číslo není. Určuje tloušťku ohnuté hrany a lemů.',
  },
  {
    key: 'zahnutiHranyDeskyDovnitr', label: 'Zahnutí hrany desky dovnitř (výztužný lem)', unit: 'mm',
    value: 20, min: 0, max: 40, step: 1, group: 'deska', certainty: 'uncertain',
    note: 'Co je pod ohnutou hranou. Bez toho vypadá deska zespodu (pod přesahem) falešně.',
  },
  {
    key: 'polomerHorniHranyDesky', label: 'Sražení horní hrany desky', unit: 'mm',
    value: 2, min: 0, max: 5, step: 0.5, group: 'deska', certainty: 'uncertain',
    note: 'Spec ho ignoruje (poloměry do 5 mm), ale právě tady vzniká odlesk nerezu.',
  },

  // --- panel ----------------------------------------------------------------
  {
    key: 'ustoupeniPanelu', label: 'Ustoupení panelu za líc desky', unit: 'mm',
    value: 15, min: 0, max: 60, step: 1, group: 'panel', certainty: 'spec',
    note: 'SPEC §5: 15 mm. Je-li shodné s přesahem desky vpředu, je čelo podestavby v líci panelu (§7.0).',
  },
  {
    key: 'sparaMeziDeskouAPanelem', label: 'Spára mezi deskou a panelem', unit: 'mm',
    value: 3, min: 0, max: 12, step: 0.5, group: 'panel', certainty: 'uncertain',
    note: 'Spec žádá „patrnou spáru nahoře", číslo neuvádí.',
  },
  {
    key: 'sparaKolemPanelu', label: 'Obvodová spára kolem panelu', unit: 'mm',
    value: 3, min: 0, max: 12, step: 0.5, group: 'panel', certainty: 'uncertain',
    note: 'Spára na koncích výklopného dílu. Ve specifikaci není.',
  },
  {
    key: 'predsazeniSpodniListyPanelu', label: 'Spodní lišta — kolik NEDOSÁHNE do líce desky', unit: 'mm',
    value: 3, min: 0, max: 15, step: 0.5, group: 'panel', certainty: 'uncertain',
    note: 'Spec říká jen „skoro zarovnaná s lícem desky". 0 = přesně v líci.',
  },
  {
    key: 'tvarPrechoduPanelDoListy', label: 'Náběh z panelu do lišty (0 = svislý schod)', unit: 'mm',
    value: 0, min: 0, max: 30, step: 1, group: 'panel', certainty: 'uncertain',
    note: 'Není ve specifikaci; na tvaru stínu pod panelem hodně záleží.',
  },
  {
    key: 'odsazeniSpodniHranyListyOdSpodkuHerdbloku', label: 'Spodní hrana lišty nad spodkem herdbloku', unit: 'mm',
    value: 0, min: 0, max: 20, step: 1, group: 'panel', certainty: 'uncertain',
    note: '0 = lišta končí přesně na spodku herdbloku.',
  },
  {
    key: 'hloubkaVyklopeniPanelu', label: 'Vyklopení panelu (ukázka otevření)', unit: 'mm',
    value: 0, min: 0, max: 250, step: 5, group: 'panel', certainty: 'uncertain',
    note: 'O kolik se horní hrana panelu vykloní dopředu. Spec uvádí jen, že panel JE výklopný.',
  },
  {
    key: 'sparaMeziHerdblokemAPodestavbou', label: 'Spára herdblok / podestavba', unit: 'mm',
    value: 2, min: 0, max: 12, step: 0.5, group: 'panel', certainty: 'uncertain',
    note: 'Vodorovná linie přes celou délku bloku — vzhledově zásadní. Spec mlčí.',
  },
  {
    key: 'zapusteniHerdblokuDoPodestavby', label: 'Zapuštění herdbloku do podestavby', unit: 'mm',
    value: 0, min: 0, max: 25, step: 1, group: 'panel', certainty: 'uncertain',
    note: 'Leží herdblok na podestavbě, nebo do ní zapadá?',
  },
  {
    key: 'tloustkaSpodnihoPlechuHerdbloku', label: 'Spodní plech herdbloku', unit: 'mm',
    value: 20, min: 0, max: 40, step: 1, group: 'panel', certainty: 'uncertain',
    note: 'Vidět všude, kde herdblok není podepřený — pod mostem a pod převisem.',
  },

  // --- ovládací prvky -------------------------------------------------------
  {
    key: 'prumerOtocnehoOvladace', label: 'Průměr otočného ovladače', unit: 'mm',
    value: 55, min: 30, max: 90, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Ve specifikaci není žádný rozměr ovládacích prvků.',
  },
  {
    key: 'vylozeniOtocnehoOvladace', label: 'Vyložení ovladače před líc panelu', unit: 'mm',
    value: 40, min: 10, max: 80, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Rozhoduje, jestli knoflík vyčnívá před líc desky, nebo zůstává v jejím stínu.',
  },
  {
    key: 'roztecOvladacuVeSkupine', label: 'Rozteč ovladačů ve skupině', unit: 'mm',
    value: 90, min: 50, max: 160, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Na fotografii tři knoflíky pod každou indukcí.',
  },
  {
    key: 'pocetOvladacuVeSkupine', label: 'Počet ovladačů ve skupině', unit: 'ks',
    value: 3, min: 0, max: 6, step: 1, group: 'ovladace', certainty: 'proto',
    note: 'Prototyp: kolik knoflíků kreslit pod jeden přístroj.',
  },
  {
    key: 'vyskaOsyOvladacuOdHornihoOkrajePanelu', label: 'Osa ovladačů pod horním okrajem panelu', unit: 'mm',
    value: 110, min: 40, max: 210, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Panel má 250 mm včetně lišty 30 mm, takže je kam knoflík posunout.',
  },
  {
    key: 'prumerTlacitka', label: 'Průměr tlačítka', unit: 'mm',
    value: 25, min: 12, max: 50, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Druhý z pevných druhů ovládacích prvků, rozměr nikde.',
  },
  {
    key: 'rozmerCelaZasuvky230V', label: 'Šířka čela zásuvky 230 V', unit: 'mm',
    value: 80, min: 50, max: 150, step: 1, group: 'ovladace', certainty: 'uncertain',
    note: 'Příslušenství panelu s volnou polohou; rozměr ve specifikaci není.',
  },

  // --- výřezy a lemy --------------------------------------------------------
  {
    key: 'pocetPristroju', label: 'Počet přístrojů', unit: 'ks',
    value: 3, min: 0, max: 6, step: 1, group: 'vyrezy', certainty: 'proto',
    note: 'Prototyp: kolik obdélníkových výřezů do desky vyříznout.',
  },
  {
    key: 'sirkaVyrezuPristroje', label: 'Šířka výřezu pro přístroj', unit: 'mm',
    value: 520, min: 200, max: 1200, step: 10, group: 'vyrezy', certainty: 'proto',
    note: 'Prototyp: reálný rozměr přijde z katalogu přístroje.',
  },
  {
    key: 'hloubkaVyrezuPristroje', label: 'Hloubka výřezu pro přístroj', unit: 'mm',
    value: 480, min: 200, max: 900, step: 10, group: 'vyrezy', certainty: 'proto',
    note: 'Prototyp: reálný rozměr přijde z katalogu přístroje.',
  },
  {
    key: 'sirkaLemuKolemOtvoruProPristroj', label: 'Šířka navařeného lemu kolem výřezu', unit: 'mm',
    value: 15, min: 0, max: 50, step: 1, group: 'vyrezy', certainty: 'uncertain',
    note: 'SPEC §12/5 — nepotvrzeno, jestli lem patří herdbloku nebo přístroji. Rozměr nikde.',
  },
  {
    key: 'vyskaLemuNadDeskou', label: 'Výška lemu nad rovinou desky', unit: 'mm',
    value: 3, min: 0, max: 20, step: 0.5, group: 'vyrezy', certainty: 'uncertain',
    note: 'Kolik lem vystupuje nad desku.',
  },
  {
    key: 'pristrojOdPredniHranyStandard', label: 'Standardní odstup přístroje od přední hrany', unit: 'mm',
    value: 100, min: 50, max: 400, step: 5, group: 'vyrezy', certainty: 'spec',
    note: 'SPEC §8.2: standardní vzdálenost od přední hrany 100 mm.',
  },
  {
    key: 'pristrojOdPredniHranyMin', label: 'Minimální odstup od přední hrany', unit: 'mm',
    value: 50, min: 0, max: 200, step: 5, group: 'vyrezy', certainty: 'spec',
    note: 'SPEC §8.2. V prototypu se jím odstup ořezává zdola.',
  },
  {
    key: 'pristrojOdZadniHranyMin', label: 'Minimální odstup od zadní hrany', unit: 'mm',
    value: 50, min: 0, max: 200, step: 5, group: 'vyrezy', certainty: 'spec',
    note: 'SPEC §8.2. V prototypu se jím výřez posouvá dopředu, když je moc hluboký.',
  },
  {
    key: 'pristrojOchrannePoleMin', label: 'Minimální ochranné pole mezi přístroji', unit: 'mm',
    value: 50, min: 0, max: 300, step: 5, group: 'vyrezy', certainty: 'spec',
    note: 'SPEC §8.2: pole se nesčítají, platí max(A,B), nejméně 50.',
  },

  // --- zakončení ------------------------------------------------------------
  {
    key: 'zakonceniVlnaR3', label: 'Vlna — poloměr rohu v půdorysu', unit: 'mm',
    value: 3, min: 0, max: 30, step: 1, group: 'zakonceni', certainty: 'spec',
    note: 'SPEC §4.3: R3. Podle §12.1 se poloměry do ~5 mm kreslí jako ostrá hrana — model tak dělá.',
  },
  {
    key: 'zakonceniZkoseniOdvesna', label: 'Zkosená vlna — odvěsna rohu', unit: 'mm',
    value: 50, min: 10, max: 200, step: 5, group: 'zakonceni', certainty: 'spec',
    note: 'SPEC §4.3: roh useknutý pod 45°, odvěsny 50 × 50 mm.',
  },
  {
    key: 'zuzeneCeloZkoseneVlny', label: 'Zkosená vlna — zúžené svislé čelo desky', unit: 'mm',
    value: 20, min: 0, max: 40, step: 1, group: 'zakonceni', certainty: 'derived',
    note: 'SPEC §4.3: 20 mm místo 40, zbytek nahradí facetka 45°. §12/10 nepotvrzeno, zda po celém obvodu.',
  },
  {
    key: 'zakonceniZaobleniR50', label: 'Zaoblená hrana — poloměr rohu', unit: 'mm',
    value: 50, min: 5, max: 200, step: 5, group: 'zakonceni', certainty: 'spec',
    note: 'SPEC §4.3: R50, na rozdíl od R3 se MODELUJE.',
  },
  {
    key: 'zakonceniRovnaCast', label: 'Zakončení — rovná část', unit: 'mm',
    value: 20, min: 0, max: 60, step: 1, group: 'zakonceni', certainty: 'spec',
    note: 'SPEC §4.3: 20 mm bez zkosení.',
  },
  {
    key: 'zakonceniZkosenaCast', label: 'Zakončení — zkosená část', unit: 'mm',
    value: 50, min: 10, max: 150, step: 1, group: 'zakonceni', certainty: 'spec',
    note: 'SPEC §4.3 / §12 Vyřízeno: 50 mm.',
  },
  {
    key: 'delkaZakonceniBlokuPotvrzeni', label: 'Celková délka zakončení (zóna bez přístroje)', unit: 'mm',
    value: 70, min: 40, max: 150, step: 5, group: 'zakonceni', certainty: 'derived',
    note: 'SPEC §12: 20 + 50 = 70 mm je označeno jako (odvozeno) a čeká na potvrzení.',
  },

  // --- zakončení svislou deskou (bok) ---------------------------------------
  // Varianta „svislá deska po boku": pracovní deska se na konci neláme po 40 mm,
  // ale pokračuje svisle dolů přes celou výšku herdbloku a bok uzavře.
  // Všechny rozměry jsou SPOLEČNÉ pro oba konce; typ konce se volí zvlášť.
  {
    key: 'bokRovnaCast', label: 'Rovné čelo (rovnoběžné s čelem bloku)', unit: 'mm',
    value: 20, min: 0, max: 120, step: 1, group: 'bok', certainty: 'spec',
    note: 'Šířka svislé stužky v líci desky, vysoké přes celý herdblok. 0 = zkosení začíná rovnou v líci.',
  },
  {
    key: 'bokZkoseniDelka', label: 'Zkosené čelo — délka (viz přepínač kótování)', unit: 'mm',
    value: 50, min: 0, max: 200, step: 1, group: 'bok', certainty: 'spec',
    note: 'Druhé čelo. Podle přepínače níž je to buď délka po ploše, nebo odvěsna v ose X. 0 = ostrý roh.',
  },
  {
    key: 'bokZkoseniUhel', label: 'Zkosené čelo — úhel od líce desky', unit: '°',
    value: 45, min: 5, max: 85, step: 1, group: 'bok', certainty: 'spec',
    note: '45 = klasické sražení. Malý úhel = plochý nos zabírající do šířky, velký = krátký strmý zub.',
  },
  {
    key: 'bokZkoseniKotaOdvesnou', label: 'Kótovat zkosení odvěsnou v X (0 = délkou plochy)', unit: '0/1',
    value: 1, min: 0, max: 1, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Zadání „50" je dvojznačné. 1 = odvěsna (SPEC §4.3 „odvěsny 50 × 50", 20 + 50 = 70). 0 = délka rozvinuté plochy (při 45° pak odvěsna 35,4).',
  },
  {
    key: 'bokPolomerSvislychHran', label: 'Poloměr svislých ohybů mezi čely', unit: 'mm',
    value: 0, min: 0, max: 30, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: 'Oba svislé zlomy (rovné čelo → zkosené, zkosené → bok). 0 = ostrá hrana podle SPEC §12.1.',
  },
  {
    key: 'bokTloustka', label: 'Konstrukční tloušťka svislé desky', unit: 'mm',
    value: 20, min: 1.5, max: 60, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: 'Určuje polohu vnitřního líce, ke kterému se zatáhne korpus herdbloku. 3 = holý ohnutý plech, 20 = jako stěna skříňky.',
  },
  {
    key: 'bokPolomerPrehybuNahore', label: 'Poloměr přehybu desky do boku', unit: 'mm',
    value: 3, min: 0, max: 40, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: '0–2 = deska působí jako nasazená čepice, 12–40 = jako přelitá přes bok. Platí jen když je přesah = 0.',
  },
  {
    key: 'bokPresahDeskyNadBokem', label: 'Přesah desky ven za líc boku (okapnice)', unit: 'mm',
    value: 0, min: 0, max: 40, step: 1, group: 'bok', certainty: 'uncertain',
    note: '0 = jeden plynule ohnutý kus. Nad 0 vznikne po celé délce boku vodorovný stín a bok čte jako přivařený díl.',
  },
  {
    key: 'bokPredsazeniCela', label: 'Předsazení (+) / ustoupení (−) čela proti líci desky', unit: 'mm',
    value: 0, min: -60, max: 40, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: '0 = čelo boku je v líci desky. −15 = v líci ovládacího panelu. Kladné = konec vystoupí a orámuje blok.',
  },
  {
    key: 'bokNabehKPaneli', label: 'Náběh z plné výšky konce do 40mm čela', unit: 'mm',
    value: 0, min: 0, max: 200, step: 5, group: 'bok', certainty: 'uncertain',
    note: '0 = svislý schod. Kladné = šikmý náběh, deska se do boku „vytáhne". Jediný parametr měnící siluetu zepředu.',
  },
  {
    key: 'bokPresahPodHerdblok', label: 'Přesah svislé desky pod spodek herdbloku', unit: 'mm',
    value: 0, min: -250, max: 620, step: 5, group: 'bok', certainty: 'uncertain',
    note: '0 = deska uzavře přesně herdblok. Kladné přeplátuje spáru k podestavbě, záporné udělá z konce jen čepici.',
  },
  {
    key: 'bokZahnutiSpodniHrany', label: 'Zahnutí spodní hrany boku dovnitř', unit: 'mm',
    value: 20, min: 0, max: 60, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Výztužný lem. 0 = zespodu je vidět holá hrana plechu a bok vypadá papírově.',
  },
  {
    key: 'bokZahnutiZadniHrany', label: 'Zahnutí zadní hrany boku dovnitř', unit: 'mm',
    value: 20, min: 0, max: 60, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Totéž na zadní svislé hraně. 0 = holá hrana, tam pak přijde zavařený díl.',
  },
  {
    key: 'bokZatazeniOdZadniHrany', label: 'Zatažení boku od zadní hrany desky', unit: 'mm',
    value: 0, min: 0, max: 300, step: 5, group: 'bok', certainty: 'uncertain',
    note: '0 = bok uzavírá stranu po celé hloubce. Nad 0 se hodí, když vzadu přebírá bok límec nebo stěna.',
  },
  {
    key: 'bokZadniRohZkoseni', label: 'Zkosení zadního rohu (odvěsna)', unit: 'mm',
    value: 0, min: 0, max: 120, step: 1, group: 'bok', certainty: 'uncertain',
    note: '0 = vzadu ostrý roh (u stěny se nepozná). Kladné udělá konec symetrický, pro volně stojící blok.',
  },
  {
    key: 'bokZatazeniPanelu', label: 'Ovládací panel — zatažení od vnějšího líce boku', unit: 'mm',
    value: 70, min: 0, max: 300, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Kde skončí výklopná plocha panelu. 70 = rovná část 20 + odvěsna 50, panel začne přesně tam, kde končí nos.',
  },
  {
    key: 'bokSparaPanelKBoku', label: 'Spára mezi koncem panelu a svislou deskou', unit: 'mm',
    value: 3, min: 0, max: 15, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: 'Svislá spára přes celých 250 mm. 0 = konec vypadá monoliticky, 8–15 = panel jasně vložený mezi dva pevné konce.',
  },
  {
    key: 'bokZatazeniSpodniListy', label: 'Spodní lišta — zatažení od vnějšího líce boku', unit: 'mm',
    value: 70, min: 0, max: 300, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Zvlášť pro 30mm lištu — ta se vrací dopředu skoro do líce desky, takže naráží přímo na nos.',
  },
  {
    key: 'bokZatazeniKorpusu', label: 'Korpus herdbloku — zatažení od vnitřního líce boku', unit: 'mm',
    value: 0, min: 0, max: 80, step: 1, group: 'bok', certainty: 'uncertain',
    note: '0 = korpus dosedne na vnitřní líc boku a přivaří se k němu. Nad 0 zůstane mezi nimi neuzavřená dutina.',
  },
  {
    key: 'bokKrytZarovnatSBocnici', label: 'Boční kryt — zarovnat do roviny boku (0 = na bok skříňky)', unit: '0/1',
    value: 1, min: 0, max: 1, step: 1, group: 'bok', certainty: 'uncertain',
    note: 'Skříňky jsou zatažené od konce herdbloku, takže na hraně skříňky kryt s bokem NIKDY nelícuje. 1 = postaví se do líce boku.',
  },
  {
    key: 'bokZarovnaniKrytuSkrinky', label: 'Boční kryt — odskok jeho líce od líce boku', unit: 'mm',
    value: 0, min: -20, max: 40, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: '0 = přesné navázání, jedna rovina od desky k nožičkám. Kladné = kryt zapuštěný a na spoji je přiznaný stín.',
  },
  {
    key: 'bokKrytKopirujeCelo', label: 'Boční kryt — zopakovat nos (rovné + zkosené čelo)', unit: '0/1',
    value: 1, min: 0, max: 1, step: 1, group: 'bok', certainty: 'uncertain',
    note: '1 = kryt dojede dopředu do líce bloku se stejným zkosením, svislá linka běží nepřerušeně až k soklu.',
  },
  {
    key: 'bokSparaKrytuPodDeskou', label: 'Vodorovná spára mezi bokem a bočním krytem', unit: 'mm',
    value: 2, min: 0, max: 12, step: 0.5, group: 'bok', certainty: 'uncertain',
    note: 'Jediná vodorovná linka na celém boku. 0 = herdblok a podestavba splynou v jeden vysoký kus.',
  },
  {
    key: 'limecZarovnatSBocnici', label: 'Límec — zarovnat boční límec do líce boku', unit: '0/1',
    value: 1, min: 0, max: 1, step: 1, group: 'bok', certainty: 'uncertain',
    note: '1 = bok bloku je jedna svislá rovina od horní hrany límce dolů. Týká se jen variant s bočním límcem.',
  },

  // --- límec ----------------------------------------------------------------
  {
    key: 'limecVyska', label: 'Výška límce', unit: 'mm',
    value: 100, min: 40, max: 300, step: 5, group: 'limec', certainty: 'spec',
    note: 'SPEC §4.4: volitelná 40–300, nejčastěji 100.',
  },
  {
    key: 'tloustkaPlechuLimce', label: 'Tloušťka límce', unit: 'mm',
    value: 3, min: 1.5, max: 25, step: 0.5, group: 'limec', certainty: 'uncertain',
    note: 'Spec dala jen poloměr ohybu 0, tloušťku ne.',
  },
  {
    key: 'zahnutiHorniHranyLimce', label: 'Zahnutí horní hrany límce dozadu', unit: 'mm',
    value: 0, min: 0, max: 30, step: 1, group: 'limec', certainty: 'uncertain',
    note: '0 = holá hrana. Ve specifikaci není.',
  },
  {
    key: 'odsazeniLimceOdHranyDesky', label: 'Odsazení límce od hrany desky', unit: 'mm',
    value: 0, min: 0, max: 50, step: 1, group: 'limec', certainty: 'uncertain',
    note: 'Stojí límec na hraně obrysu, nebo před ním zůstává odkládací ploška?',
  },

  // --- podestavby -----------------------------------------------------------
  {
    key: 'pocetPodestaveb', label: 'Počet podestaveb', unit: 'ks',
    value: 3, min: 1, max: 8, step: 1, group: 'podestavba', certainty: 'proto',
    note: 'Prototyp: prostřední je uzavřená s dvířky, ostatní otevřené s policí.',
  },
  {
    key: 'sirkaPodestavby', label: 'Šířka jedné podestavby', unit: 'mm',
    value: 800, min: 300, max: 1500, step: 10, group: 'podestavba', certainty: 'uncertain',
    note: 'Spec určuje jen hloubku (670); šířka je volný parametr každého prvku.',
  },
  {
    key: 'hloubkaPodestavby', label: 'Hloubka podestavby', unit: 'mm',
    value: 670, min: 400, max: 1000, step: 10, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §2: 670 mm standardně.',
  },
  {
    key: 'tloustkaSteny', label: 'Konstrukční tloušťka stěny', unit: 'mm',
    value: 20, min: 5, max: 40, step: 1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.2: 20 mm. NENÍ to síla plechu. Stěny sousedů se sčítají → mezi vnitřky 40.',
  },
  {
    key: 'tloustkaPodlazky', label: 'Konstrukční tloušťka podlážky', unit: 'mm',
    value: 40, min: 10, max: 80, step: 1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.2: 40 mm, úplně dole, v modelu plný dílec.',
  },
  {
    key: 'pricnaListaVyska', label: 'Příčná lišta nahoře — výška', unit: 'mm',
    value: 20, min: 5, max: 60, step: 1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.2: profil 20 × 20, JEN VPŘEDU.',
  },
  {
    key: 'pricnaListaHloubka', label: 'Příčná lišta nahoře — hloubka', unit: 'mm',
    value: 20, min: 5, max: 60, step: 1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.2: profil 20 × 20, JEN VPŘEDU.',
  },
  {
    key: 'radiusH2', label: 'Vnitřní radius koutů H2 / H3', unit: 'mm',
    value: 16, min: 0, max: 40, step: 1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.1: R16 mezi podlážkou a stěnami (H2), u H3 všechny kouty.',
  },
  {
    key: 'silaPlechuKorpusu', label: 'Skutečná síla plechu korpusu', unit: 'mm',
    value: 1.5, min: 0.5, max: 5, step: 0.1, group: 'podestavba', certainty: 'spec',
    note: 'SPEC §7.2: korpus je z plechu 1,5 mm. Použito na tenké lemy a odsazení dutiny.',
  },
  {
    key: 'tloustkaZadniStenySkrinky', label: 'Tloušťka zadní stěny skříňky', unit: 'mm',
    value: 20, min: 1.5, max: 40, step: 0.5, group: 'podestavba', certainty: 'uncertain',
    note: 'Spec uvádí 20 mm jen pro „stěnu skříňky", o zádech mlčí.',
  },
  {
    key: 'zapusteniPodestavbyOdKonce', label: 'Zatažení podestavby od konce herdbloku', unit: 'mm',
    value: 20, min: 0, max: 150, step: 5, group: 'podestavba', certainty: 'uncertain',
    note: 'Spec zná jen převis jako volnou polohu s mezí 500 mm, ne standardní hodnotu. V prototypu je to mez, za kterou řada skříněk nesmí — nevejde-li se, šířky se ořežou. Skutečné zatažení je vidět jako Převis v dopočtech.',
  },
  {
    key: 'mezeraMeziSousednimiPodestavbami', label: 'Mezera mezi sousedními podestavbami', unit: 'mm',
    value: 0, min: 0, max: 30, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'SPEC §3 to vede jako otevřenou otázku, §7.2 mlčky předpokládá dotyk.',
  },
  {
    key: 'sirkaViditelneSparyMeziKorpusy', label: 'Kreslená dělicí spára mezi korpusy', unit: 'mm',
    value: 2, min: 0, max: 10, step: 0.5, group: 'podestavba', certainty: 'uncertain',
    note: 'Když se korpusy dotýkají, je mezi nimi vidět zářez (dvě stěny 20 + 20).',
  },
  {
    key: 'zaobleniSvislychRohuKorpusu', label: 'Zaoblení svislých rohů korpusu', unit: 'mm',
    value: 3, min: 0, max: 16, step: 0.5, group: 'podestavba', certainty: 'uncertain',
    note: 'Spec řeší radiusy jen uvnitř skříňky (H2/H3), zvenku mlčí.',
  },
  {
    key: 'vyskaPoliceNadPodlazkou', label: 'Výška police nad podlážkou', unit: 'mm',
    value: 200, min: 60, max: 380, step: 5, group: 'podestavba', certainty: 'uncertain',
    note: 'Ve specifikaci není vůbec. Světlost skříňky vychází cca 400 mm.',
  },
  {
    key: 'pocetPolic', label: 'Počet polic v otevřené skříňce', unit: 'ks',
    value: 1, min: 0, max: 3, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Dnešní produkt zná jen „má/nemá polici".',
  },
  {
    key: 'tloustkaPolice', label: 'Konstrukční tloušťka police', unit: 'mm',
    value: 20, min: 8, max: 40, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Není ve specifikaci; SEGMENT používá 20 mm.',
  },
  {
    key: 'zapusteniPoliceOdCela', label: 'Zapuštění police za líc korpusu', unit: 'mm',
    value: 25, min: 0, max: 60, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Není ve specifikaci; SEGMENT používá 25 mm.',
  },
  {
    key: 'sirkaLemuKolemOtvoruSkrinky', label: 'Lem kolem otvoru otevřené skříňky', unit: 'mm',
    value: 20, min: 0, max: 50, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Není ve specifikaci; SEGMENT používá 20 mm.',
  },
  {
    key: 'tloustkaDvirek', label: 'Konstrukční tloušťka dvířek', unit: 'mm',
    value: 20, min: 8, max: 40, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Vytvarovaný dutý díl jako stěny.',
  },
  {
    key: 'mezeraMeziDvirky', label: 'Spára mezi křídly dvířek', unit: 'mm',
    value: 3, min: 0, max: 12, step: 0.5, group: 'podestavba', certainty: 'uncertain',
    note: 'Ve specifikaci není.',
  },
  {
    key: 'vylozeniUchytkyDvirek', label: 'Vyložení úchytky dvířek', unit: 'mm',
    value: 30, min: 10, max: 70, step: 1, group: 'podestavba', certainty: 'uncertain',
    note: 'Z čelního pohledu nejvýraznější detail podestavby.',
  },
  {
    key: 'prurezUchytkyDvirek', label: 'Průřez úchytky dvířek', unit: 'mm',
    value: 20, min: 8, max: 50, step: 1, group: 'podestavba', certainty: 'proto',
    note: 'Prototyp: kreslený profil madla, ve specifikaci není.',
  },

  // --- sokl -----------------------------------------------------------------
  {
    key: 'odsazeniSoklu', label: 'Odsazení soklu za líc korpusu', unit: 'mm',
    value: 50, min: 10, max: 120, step: 5, group: 'sokl', certainty: 'uncertain',
    note: 'Spec říká jen, že se dělá kolem dokola včetně boků; číslo chybí.',
  },
  {
    key: 'vyskaSoklu', label: 'Viditelná výška soklové zástěny', unit: 'mm',
    value: 150, min: 60, max: 150, step: 5, group: 'sokl', certainty: 'uncertain',
    note: 'Nožičky mají 150 mm, ale není řečeno, jestli sokl vyplní celých 150.',
  },
  {
    key: 'mezeraSokluNadPodlahou', label: 'Světlá spára pod soklem', unit: 'mm',
    value: 0, min: 0, max: 25, step: 1, group: 'sokl', certainty: 'uncertain',
    note: 'Dosedá sokl na podlahu, nebo je nad ní spára?',
  },
  {
    key: 'tloustkaSoklovehoPanelu', label: 'Tloušťka soklové zástěny', unit: 'mm',
    value: 20, min: 1.5, max: 40, step: 0.5, group: 'sokl', certainty: 'uncertain',
    note: 'Vytvarovaný díl, ne holý plech 1,5 mm.',
  },
  {
    key: 'prurezRamuKonstrukcnihoSoklu', label: 'Průřez rámu konstrukčního soklu', unit: 'mm',
    value: 40, min: 20, max: 80, step: 5, group: 'sokl', certainty: 'uncertain',
    note: 'Konstrukční sokl je „nerezový rám pod celým blokem"; profil není uveden.',
  },
  {
    key: 'rozmerNozicky', label: 'Půdorysný rozměr nožičky', unit: 'mm',
    value: 50, min: 30, max: 80, step: 1, group: 'sokl', certainty: 'uncertain',
    note: 'Není ve specifikaci; SEGMENT používá 50 mm.',
  },
  {
    key: 'odsazeniNozickyOdRohu', label: 'Vsazení nožičky od rohu korpusu', unit: 'mm',
    value: 45, min: 20, max: 150, step: 5, group: 'sokl', certainty: 'uncertain',
    note: 'Není ve specifikaci; SEGMENT používá 45 mm.',
  },

  // --- boční kryt -----------------------------------------------------------
  {
    key: 'vyskaBocnihoKrytu', label: 'Výška bočního krytu', unit: 'mm',
    value: 750, min: 290, max: 760, step: 10, group: 'kryt', certainty: 'uncertain',
    note: '290 = jen herdblok (kryt se nekreslí), 750 = pokračuje po boku skříněk až k nožičkám. Ve variantě se svislou deskou nemá kryt při 290 na co navazovat.',
  },
  {
    key: 'tloustkaBocnihoKrytu', label: 'Tloušťka bočního krytu', unit: 'mm',
    value: 20, min: 1.5, max: 40, step: 0.5, group: 'kryt', certainty: 'uncertain',
    note: 'Spec ho jmenuje („zakončovací plech zboku"), ale nekótuje.',
  },
  {
    key: 'presahBocnihoKrytuPresLicPodestavby', label: 'Předsazení bočního krytu před líc podestavby', unit: 'mm',
    value: 0, min: 0, max: 30, step: 1, group: 'kryt', certainty: 'uncertain',
    note: 'Určuje, jestli je na rohu vidět hrana.',
  },

  // --- kontrolní meze -------------------------------------------------------
  {
    key: 'prevysMax', label: 'Mez převisu', unit: 'mm',
    value: 500, min: 100, max: 1500, step: 10, group: 'kontroly', certainty: 'spec',
    note: 'SPEC §3. Prototyp jen hlásí překročení v dopočtech.',
  },
  {
    key: 'mostMax', label: 'Mez mostu', unit: 'mm',
    value: 1200, min: 200, max: 3000, step: 10, group: 'kontroly', certainty: 'spec',
    note: 'SPEC §3. Prototyp jen hlásí překročení v dopočtech.',
  },

  // --- render ---------------------------------------------------------------
  {
    key: 'drsnostPovrchuNerezu', label: 'Drsnost povrchu nerezu (Brus K 320)', unit: '—',
    value: 0.35, min: 0.1, max: 0.7, step: 0.01, group: 'render', certainty: 'uncertain',
    note: '0 = zrcadlo, 1 = matné. Na realistický dojem má větší vliv než většina milimetrů.',
  },
  {
    key: 'segmentyOblouku', label: 'Dělení zaobleného rohu', unit: 'ks',
    value: 12, min: 3, max: 32, step: 1, group: 'render', certainty: 'proto',
    note: 'Prototyp: jemnost tesselace R50 rohu, není to konstrukční rozměr.',
  },
];

/** Přepínače (nečíselné volby). Panel je vykreslí jako řadu tlačítek. */
export const CHOICES = [
  {
    key: 'konecVlevo', label: 'Zakončení vlevo', value: 'svislaDeskaZkos',
    options: [
      { value: 'vlna', label: 'Vlna' },
      { value: 'zkosena', label: 'Zkosená vlna' },
      { value: 'zaoblena', label: 'Zaoblená hrana' },
      { value: 'svislaDeska', label: 'Svislá deska po boku' },
      { value: 'svislaDeskaZkos', label: 'Svislá deska + zkosení' },
    ],
  },
  {
    key: 'konecVpravo', label: 'Zakončení vpravo', value: 'svislaDeskaZkos',
    options: [
      { value: 'vlna', label: 'Vlna' },
      { value: 'zkosena', label: 'Zkosená vlna' },
      { value: 'zaoblena', label: 'Zaoblená hrana' },
      { value: 'svislaDeska', label: 'Svislá deska po boku' },
      { value: 'svislaDeskaZkos', label: 'Svislá deska + zkosení' },
    ],
  },
  {
    key: 'limec', label: 'Límec', value: 'zadny',
    options: [
      { value: 'zadny', label: 'žádný' },
      { value: 'zadni', label: 'zadní' },
      { value: 'bocni', label: 'boční' },
      { value: 'oba', label: 'zadní + boční' },
    ],
  },
  {
    key: 'hygiena', label: 'Hygienický stupeň', value: 'H2',
    options: [
      { value: 'HSplus', label: 'HS+' },
      { value: 'H1', label: 'H1' },
      { value: 'H2', label: 'H2' },
      { value: 'H3', label: 'H3' },
    ],
  },
  {
    key: 'sokl', label: 'Provedení soklu', value: 'nozicky',
    options: [
      { value: 'zadny', label: 'jen nožičky' },
      { value: 'nozicky', label: 'nožičky + zástěna' },
      { value: 'konstrukcni', label: 'konstrukční rám' },
      { value: 'stavebni', label: 'stavební sokl' },
    ],
  },
];

/** Výchozí hodnoty číselných parametrů jako prostý objekt {klíč: číslo}. */
export function defaultValues() {
  const out = {};
  for (const p of PARAMS) out[p.key] = p.value;
  return out;
}

/** Výchozí hodnoty přepínačů jako prostý objekt {klíč: řetězec}. */
export function defaultChoices() {
  const out = {};
  for (const c of CHOICES) out[c.key] = c.value;
  return out;
}

/** Vyhledá definici parametru podle klíče (kvůli hlášením a mezím). */
export function paramDef(key) {
  return PARAMS.find((p) => p.key === key) || null;
}

/** Je zadaný typ konce varianta se svislou deskou po boku? */
export function isBok(type) {
  return type === 'svislaDeska' || type === 'svislaDeskaZkos';
}

/**
 * Půdorysné rozměry „nosu" zakončení svislou deskou.
 * Vrací null, když konec není tohoto typu.
 *   dx, dz  … průměty zkoseného čela do os X a Z
 *   delka   … skutečná délka zkosené plochy (rozvinutá, na výkres pro ohyb)
 *   noseX   … celkový zábor nosu v ose X = rovné čelo + dx
 * Přepínač bokZkoseniKotaOdvesnou říká, kterou z hodnot zadal uživatel jako 50.
 */
export function noseMetrics(P, type) {
  if (!isBok(type)) return null;
  const rad = (P.bokZkoseniUhel * Math.PI) / 180;
  let dx = 0;
  let dz = 0;
  let delka = 0;
  if (type === 'svislaDeskaZkos' && P.bokZkoseniDelka > 0) {
    if (P.bokZkoseniKotaOdvesnou >= 0.5) {
      dx = P.bokZkoseniDelka;
      delka = dx / Math.max(1e-6, Math.cos(rad));
      dz = delka * Math.sin(rad);
    } else {
      delka = P.bokZkoseniDelka;
      dx = delka * Math.cos(rad);
      dz = delka * Math.sin(rad);
    }
  }
  return { dx, dz, delka, noseX: P.bokRovnaCast + dx, zkoseno: type === 'svislaDeskaZkos' };
}

/**
 * Rozměry, které se NEZADÁVAJÍ, ale dopočítávají — ať je vidět, že model
 * drží pravidla ze specifikace (40 + 250 = 290, podestavba = PV − 290 atd.).
 * Vrací pole {label, value, unit, warn}.
 */
export function derivedReadout(P, C, extra = {}) {
  const podestavba = P.pracovniVyska - P.vyskaHerdbloku;
  const telo = podestavba - P.vyskaNozicek;
  const panel = P.vyskaHerdbloku - P.vyskaCelaDesky;
  const mezeraOdZdi = P.hloubkaHerdbloku - P.ustoupeniPanelu - P.hloubkaPodestavby;
  const zakonceni = P.zakonceniRovnaCast + P.zakonceniZkosenaCast;
  const facetka = P.zuzeneCeloZkoseneVlny * Math.SQRT2;
  const rows = [
    { label: 'Podestavba včetně nožiček (PV − 290)', value: podestavba, unit: 'mm' },
    { label: 'Tělo skříňky (bez nožiček)', value: telo, unit: 'mm' },
    { label: 'Výška ovládacího panelu (290 − 40)', value: panel, unit: 'mm' },
    { label: 'Mezera od zdi (hloubka − ustoupení − 670)', value: mezeraOdZdi, unit: 'mm', warn: mezeraOdZdi < 0 },
    { label: 'Celková délka zakončení (20 + 50)', value: zakonceni, unit: 'mm' },
    { label: 'Šířka facetky zkosené vlny (20 × √2)', value: Math.round(facetka * 10) / 10, unit: 'mm' },
  ];
  // --- zakončení svislou deskou --------------------------------------------
  const noseL = noseMetrics(P, C.konecVlevo);
  const noseR = noseMetrics(P, C.konecVpravo);
  const nose = noseR || noseL;
  if (nose) {
    const r1 = (v) => Math.round(v * 10) / 10;
    rows.push({ label: 'Nos — průmět zkosení v X (dx)', value: r1(nose.dx), unit: 'mm' });
    rows.push({ label: 'Nos — průmět zkosení v Z (dz)', value: r1(nose.dz), unit: 'mm' });
    rows.push({ label: 'Nos — délka zkosené plochy (rozvinutá)', value: r1(nose.delka), unit: 'mm' });
    rows.push({ label: 'Nos — celkový zábor v X (rovné + dx)', value: r1(nose.noseX), unit: 'mm' });
    rows.push({
      label: 'Konec panelu od konce bloku',
      value: r1(P.bokZatazeniPanelu + P.bokSparaPanelKBoku),
      unit: 'mm',
      warn: P.bokZatazeniPanelu + P.bokSparaPanelKBoku < nose.noseX,
    });
    rows.push({
      // panel se zastaví 70 mm od konce; když je nos kratší, zůstane mezi nimi
      // odkryté čelo korpusu — je to jen otázka nastavení, ale je vidět
      label: 'Odkryté čelo korpusu mezi panelem a nosem',
      value: r1(Math.max(0, P.bokZatazeniPanelu - nose.noseX)),
      unit: 'mm',
      warn: P.bokZatazeniPanelu - nose.noseX > 0,
    });
    rows.push({
      label: 'Zbývá na nos ze zóny bez přístroje',
      value: r1(P.delkaZakonceniBlokuPotvrzeni - nose.noseX),
      unit: 'mm',
      warn: nose.noseX > P.delkaZakonceniBlokuPotvrzeni,
    });
    rows.push({
      label: 'Boční kryt pod svislou deskou (výška)',
      value: Math.round(P.vyskaBocnihoKrytu - P.vyskaHerdbloku - P.bokSparaKrytuPodDeskou + P.bokPresahPodHerdblok),
      unit: 'mm',
      warn: P.vyskaBocnihoKrytu - P.vyskaHerdbloku - P.bokSparaKrytuPodDeskou + P.bokPresahPodHerdblok <= 0,
    });
    rows.push({
      label: 'Vnitřní líc boku ↔ konec korpusu',
      value: r1(P.bokZatazeniKorpusu),
      unit: 'mm',
      warn: P.bokZatazeniKorpusu > 0,
    });
  }
  if (extra.prevysVlevo !== undefined) {
    rows.push({ label: 'Převis vlevo', value: Math.round(extra.prevysVlevo), unit: 'mm', warn: extra.prevysVlevo > P.prevysMax });
    rows.push({ label: 'Převis vpravo', value: Math.round(extra.prevysVpravo), unit: 'mm', warn: extra.prevysVpravo > P.prevysMax });
    rows.push({ label: 'Největší most', value: Math.round(extra.most), unit: 'mm', warn: extra.most > P.mostMax });
  }
  return rows;
}
