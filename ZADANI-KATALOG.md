# Zadání pro další session — robustní katalogový systém

**Stav:** připraveno k zahájení, NEIMPLEMENTOVÁNO.
**Hlavní úkol:** přepracovat správu přístrojů na robustní katalogový systém,
který unese **desítky až stovky položek** a bezpečné sdílení projektů.

---

## 0. Jak s tímto dokumentem pracovat

> **Než začneš cokoli implementovat, seznam uživatele s tímto zadáním
> a doptej se na body v kapitole 7 (Otevřené otázky).** Teprve po jeho
> odpovědích navrhni etapy a začni pracovat.

Uživatel pracuje stylem „hlavní agent jen zadává a kontroluje" — implementaci
deleguj na levnější modely (Sonnet na kód, Haiku na dokumentaci a drobnosti)
a výsledek sám ověřuj v prohlížeči.

---

## 1. Kontext

Aplikace je statický 3D konfigurátor nerezových varných bloků ALBA
(Three.js z CDN, ES moduly, bez build kroku, UI v 5 jazycích).
Aktuální funkční stav popisuje `SPEC.md` (verze v1–v4) a `README.md`.
Nasazení na Cloudflare Pages popisuje `DEPLOY.md`.

Katalog přístrojů dnes řeší `js/catalog.js`, jeho UI `js/device-manager.js`.

---

## 2. Ověřený současný stav (změřeno v prohlížeči, netřeba znovu zjišťovat)

- Katalog se ukládá do **localStorage** pod klíčem `alba-katalog-v1`
  ve tvaru `{ schema: 1, entries: [...] }`. Zapíše se až při první změně;
  do té doby aplikace jede z hodnot zapsaných natvrdo v `BUILTIN_DEFAULTS`
  v `js/catalog.js`.
- Uložený projekt (`nerez-blok-config-v3`, i exportovaný JSON) obsahuje
  **kopii celého katalogu** v poli `catalog`.
- localStorage je vázaný na **origin** — `localhost:8000` a `localhost:8741`
  měly každý vlastní nezávislý katalog. Po nasazení bude mít každý návštěvník
  svůj vlastní.
- Import projektu katalog **slučuje**, nepřepisuje celý: vlastní přístroje
  příjemce zůstanou zachovány.
- Instance segmentu už dnes drží vlastní `widthMM` odděleně od katalogu
  (ověřeno: gril nastavený v projektu na 1000 mm nezměnil katalogových 800 mm
  a další přidaný kus přišel s 800 mm).

## 3. Zjištěné vady, které má úkol odstranit

1. **Úpravy vestavěných přístrojů se ztrácejí.** Uživatel si nastavil gril
   na 1000 mm; po načtení cizího projektu, který gril vůbec neobsahoval,
   se gril vrátil na tovární 800 mm.
2. **Cizí projekt přepíše vestavěný přístroj.** Projekt s přejmenovaným
   sporákem („Sporák A", 1200 mm) tento název a rozměr trvale zapsal
   do katalogu příjemce, bez upozornění.
3. **Chybějící přístroj se tváří jako technický záznam.** Segment odkazující
   na neexistující přístroj se zobrazil jako syrové `zruseny_pristroj_xyz`
   a **šířka se tiše změnila z uložených 500 mm na 400 mm**.
4. **Tiché ořezávání hodnot.** Šířka 1100 mm zadaná v projektu byla bez
   upozornění přepsána na 1200 mm (minimum z katalogu).

---

## 4. Cílový model — ROZHODNUTO

### 4.1 Tovární katalog
- Jeden seznam „továrních přístrojů", **stejný pro všechny uživatele**,
  dodávaný s aplikací.
- Uživatel ho **nemůže měnit**. Neměnnost platí na úrovni **dat**.
- **Zobrazení je osobní předvolba** — viditelnost, pořadí a filtrování
  si uživatel nastavit může; není to změna katalogu.
- Tovární katalog je **verzovaný** (např. `factoryVersion`), protože se
  s každým nasazením může měnit.
- Chce-li uživatel tovární přístroj upravit, **duplikuje si ho do své sady**.

### 4.2 Uživatelské sady přístrojů
- Uživatel může vytvářet, ukládat a znovu načítat **vlastní sady** přístrojů.
- Ve správci jsou sady **jasně vizuálně oddělené** od továrního katalogu.
- Sady mají vlastní jmenný prostor, aby nedocházelo ke kolizím
  identifikátorů mezi sadami různých autorů.

### 4.3 Projekt a snapshot katalogu
- Každý uložený projekt nese **kompletní definice těch přístrojů, které
  jsou v projektu použité** — tovární i uživatelské, bez rozdílu. Nepoužité
  položky katalogu se do projektu neukládají.
- Definice použitého přístroje musí být úplná (meze, možnosti, základní
  a technické parametry), aby se projekt správně zobrazil i v budoucnu,
  kdy už daný přístroj v továrním katalogu být nemusí.
- Projekt nese také **verzi továrního katalogu**, se kterou vznikl.
- **Snapshot je výhradně ke čtení.** Nikdy se nesmí zapsat zpět do katalogu
  ani do uživatelských sad. (Dnešní chování je opačné a je to vada.)

### 4.4 Oddělení typu a instance — KLÍČOVÉ
Do **katalogu** patří **meze, všechny možnosti a základní parametry**.
Do **instance v projektu** patří **konkrétně zvolené hodnoty v rámci mezí**.
Změna hodnoty v projektu **nikdy** nemění katalogovou položku — ani pro další
použití téhož přístroje v témže projektu.

Parametry rozděl do tří kategorií:

| Kategorie | Kde žije | Příklady |
|---|---|---|
| Čistě katalogové | jen katalog, v projektu read-only | příkon, napájení, popis funkcí a konstrukce, katalogové označení, typ varné plochy, povolené typy podestaveb, minimální šířka a hloubka, jmenovité rozměry přístroje |
| Katalogem předvyplněné, instancí přepsatelné | katalog dává výchozí hodnotu a mez, instance drží zvolenou | šířka podestavby, hloubka (v rámci mezí) |
| Čistě instanční | jen projekt | typ soklu (nožičky / stavební / konstrukční), provedení HS+/H1/H2/H3, police, panel, pozice v bloku |

Musí platit: **dva kusy téhož přístroje v jednom projektu mohou mít různé
zvolené hodnoty.**

### 4.5 Načtení projektu a aktualizace
- Při načtení projektu, jehož `factoryVersion` se liší od aktuální, nabídni
  volbu: **zobrazit stav při uložení** (snapshot) nebo **aktualizovat
  na aktuální tovární katalog**.
- Při volbě „aktualizovat" zobraz **souhrn rozdílů**:
  - přístroje, které v továrním katalogu **přibyly**,
  - přístroje, které se **změnily**,
  - přístroje, které v továrním katalogu **už nejsou** a projekt je používá.
- **Žádné tiché úpravy hodnot.** Pokud se po aktualizaci dostane instance
  mimo nové meze (např. stoupne minimální šířka), **označ nesoulad**
  a nech rozhodnutí na uživateli. Nikdy hodnotu nepřepisuj bez upozornění.

### 4.6 Vyřazené přístroje
- Vyřazený přístroj se liší od chybějícího tím, že jeho definici projekt má —
  projekt se tedy vykreslí správně.
- Při aktualizaci **přesuň vyřazené přístroje do uživatelské sady**
  (např. pojmenované podle projektu), označ je jako **vyřazené z výroby**
  a nech je nadále použitelné.

### 4.7 Co se ukládá kam — ROZHODNUTO

- **Tovární katalog** se do prohlížeče **neukládá vůbec.** Je součástí
  aplikace (kód/datový soubor + obrázky jako soubory vedle kódu) a načítá se
  z ní. *(Dnešní chování je jiné — ověřeno: po vypnutí viditelnosti jediného
  přístroje se do localStorage zapsalo všech 9 položek včetně všech
  továrních. Je to vada k odstranění.)*
- **Do prohlížeče patří jen data uživatele** — tedy jeho vlastní sady
  přístrojů a rozpracovaný projekt. Protože tovární přístroje nelze měnit,
  kategorie „změněný tovární přístroj" v novém modelu neexistuje;
  úprava se vždy dělá duplikátem do vlastní sady.
- **Soubor je ta pravá verze, prohlížeč jen pracovní paměť.** Uživatel si
  může uložit do souboru a zase načíst jak **projekt**, tak **vlastní sadu
  přístrojů** (nezávisle na sobě). Tím je vyřešena záloha, přenos mezi
  počítači i sdílení s kolegou.
- Z toho plyne požadavek na UI: **zřetelně signalizovat neuložené změny**,
  aby uživatel nepřišel o sadu jen proto, že si vymazal data webu
  v domnění, že „je to uložené v prohlížeči".
- Nahraje-li uživatel k vlastním výrobkům fotky, do souboru sady patří
  v plné velikosti; do prohlížeče buď jen zmenšený náhled, nebo s výslovným
  varováním o limitu.

### 4.8 Co se VĚDOMĚ NEDĚLÁ
- **Nesledují se nástupci přístrojů.** Uživatel to zamítl jako příliš
  náročné na údržbu. Aplikace tedy nikdy nenavrhuje „novější variantu"
  vyřazeného přístroje; jen ohlásí, že v továrním katalogu už není.
- **Změněné přístroje z projektu se neukládají do katalogu.**

### 4.9 Jazyky
- U **továrního** přístroje se do snapshotu ukládá **identifikátor
  a parametry, ne zobrazovaný název** — název se vždy překládá podle jazyka.
  (Projekt uložený v češtině nesmí v německém rozhraní ukazovat český název.)
- U **uživatelských** přístrojů se název ukládá doslova a nepřekládá se.

---

## 5. Požadavky na velký katalog (desítky až stovky položek)

- **Vyhledávání a filtrování** ve správci (podle názvu, katalogového
  označení, kategorie, viditelnosti, sady).
- **Kategorie / skupiny** přístrojů (varné, chladicí, neutrální, mycí…),
  aby šel seznam procházet.
- **Řazení** a **hromadné akce** (zapnout/vypnout viditelnost výběru).
- Seznam musí zůstat **svižný při stovkách položek** — stránkování nebo
  virtualizovaný seznam, ne vykreslení všeho najednou.
- Nabídka „Přidat segment" v bočním panelu musí být při stovkách přístrojů
  použitelná — vyhledávání, nikoli dlouhý sloupec tlačítek.
- **Kapacita úložiště:** localStorage má limit řádově 5 MB na origin.
  Naměřeno: 9 přístrojů bez obrázků = 3,8 kB (tj. ~0,4 kB na přístroj),
  takže **300 přístrojů bez obrázků ≈ 120 kB — problém nejsou počty položek,
  ale bitmapy.** Testovací PNG 128×128 mělo v base64 2,4 kB; reálná fotka
  150 kB naroste na ~200 kB, takže ~25 přístrojů s fotkami úložiště zaplní.
  - Pro **tovární** katalog proto obrázky ukládej jako **soubory nasazené
    vedle kódu** (např. `img/pristroje/…`) a v katalogu drž jen cestu —
    úložiště pak nezabírají vůbec a verzují se spolu s nasazením.
  - Pro **uživatelem nahrané** obrázky zvaž **IndexedDB** (limity řádově
    stovky MB) místo localStorage.
- **Tiché selhání při zaplnění — POTVRZENÁ VADA.** Funkce `persist()`
  v `js/catalog.js` sice `setItem` obaluje `try/catch`, ale chybu jen zapíše
  do konzole (`console.error`). Uživatel není nijak upozorněn, práce se tváří
  jako uložená a po reloadu je pryč. Doplň viditelné hlášení a ošetření.
- **Import a export sad** jako samostatných souborů (nezávisle na projektu).

---

## 6. Kritéria přijetí

1. Tovární katalog nelze z UI změnit; jde jen skrýt/přeuspořádat a duplikovat.
2. Načtení cizího projektu nezmění příjemcův tovární katalog ani jeho sady.
2b. V prohlížeči jsou uložena **jen data uživatele** — tovární katalog se tam
   nezapisuje. Projekt i vlastní sadu lze uložit do souboru a zase načíst;
   aplikace zřetelně hlásí neuložené změny.
3. Úprava rozměru přístroje v projektu nezmění katalogovou položku ani
   nově přidávané kusy téhož přístroje.
4. Dva kusy téhož přístroje v jednom projektu mohou mít různé rozměry.
5. Projekt uložený ve starší verzi továrního katalogu se otevře správně;
   uživatel dostane volbu snapshot/aktualizace a u aktualizace souhrn rozdílů
   včetně vyřazených přístrojů.
6. Žádná hodnota se nikdy nezmění tiše; nesoulady se hlásí.
7. Správce zvládne 300 položek plynule (vyhledávání, filtrování, řazení).
8. Přepnutí jazyka nezmění uložená data; tovární názvy se překládají,
   uživatelské zůstávají.
9. Bez chyb v konzoli, funkční export/import PNG, JSON i SVG.

---

## 7. Otevřené otázky — PROBRAT S UŽIVATELEM PŘED ZAHÁJENÍM

1. **Aktivní sady.** Kolik uživatelských sad může být aktivních naráz?
   Může projekt používat přístroje ze dvou sad?
2. **Kolize při importu sady.** Když přijde přístroj se stejným
   identifikátorem nebo názvem: ponechat obojí a přejmenovat, nebo převzít?
3. **Zdroj továrního katalogu.** Zůstane zapsaný natvrdo v `js/catalog.js`,
   nebo se vytáhne do souboru `katalog.json` vedle kódu, aby šel měnit
   bez zásahu do zdrojového kódu? (Souvisí s tím, jak budete katalog
   udržovat při stovkách položek, a s uložením obrázků přístrojů.)
4. **Kategorie přístrojů.** Jaké skupiny mají být? Kdo je definuje —
   jsou součástí továrního katalogu?
5. **Migrace stávajících dat.** Uživatelé, kteří už mají v prohlížeči
   uložený katalog podle dnešního modelu — jejich úpravy vestavěných
   přístrojů převést do automaticky vytvořené uživatelské sady, nebo zahodit?
6. **Katalogové údaje.** Technické údaje (příkon, napájení, popisy) jsou
   dnes u vestavěných přístrojů prázdné — záměrně, aby se do výkresu
   nedostala vymyšlená čísla. Dodá je uživatel, nebo se mají zatím vynechat?

---

## 8. Dotčené soubory

- `js/catalog.js` — datový model, tovární katalog, sady, verzování, migrace
- `js/device-manager.js` — správce přístrojů a sad, vyhledávání, filtry
- `js/main.js` — načítání/ukládání projektu, dialog aktualizace, sanitizace
- `js/ui.js` — nabídka „Přidat segment", instanční pole segmentů
- `js/floorplan.js` — soupis prvků čte katalogové údaje
- `js/i18n.js` — nové texty (sady, dialog aktualizace, hlášení nesouladů)
- `index.html`, `css/style.css` — UI správce a dialogů
- `SPEC.md` — po dokončení doplnit jako novou verzi
