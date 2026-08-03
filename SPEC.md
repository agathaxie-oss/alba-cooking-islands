# SPEC v3 — Konfigurátor nerezových varných bloků ALBA

Statická webová aplikace (Three.js 0.165 přes CDN import mapu, ES moduly, bez
build kroku, UI česky) pro 3D konfiguraci a vizualizaci nerezových varných
bloků. Verze 3 — rozšíření podle připomínek zákazníka.

Stávající soubory: `index.html`, `css/style.css`, `js/{main,materials,modules,
block,arms,ui,viewer,custom-dialog}.js`, `Logo ALBA.jpg`.

---

## 1. Geometrie bloku — NOVÁ PRAVIDLA

### 1.1 Rozměry = podestavby, deska přesahuje
- **Zadaná délka a hloubka bloku = půdorys PODESTAVEB** (ne desky).
- **Pracovní deska přesahuje podestavby o 15 mm** po celém obvodu.
  (Dosud byl přesah 20 mm a délka se počítala včetně desky — změnit.)
- Segmenty se nikdy nesmí vysunout mimo půdorys podestaveb.

### 1.2 Boční krycí plechy (NOVĚ)
- Každý blok (jednostranný i ostrovní) je na obou koncích zakončen
  **krycím plechem tloušťky 20 mm** přes celou hloubku a výšku podestavby
  (od soklu po spodek desky). Sjednocuje podnože a tvoří pohledovou stranu.
- Krycí plechy jsou součástí zadané délky bloku:
  **využitelná šířka pro segmenty = délka bloku − 2 × 20 mm**.
- U ostrovního bloku je krycí plech společný pro obě řady (přes celou hloubku).
- Na krycím plechu je **logo ALBA** (viz §6).

### 1.3 Hloubka — volně zadatelná
- Hloubka NENÍ z přednastavených hodnot, ale číselný vstup.
- **Minimum jedné strany 500 mm**, maximum 1200 mm, krok 10 mm.
- Jednostranný blok: jedna hodnota hloubky.
- Ostrovní blok: **dvě nezávislé hloubky** — strana A a strana B
  (každá 500–1200 mm). Celková hloubka bloku = hloubka A + hloubka B.

### 1.4 Oboustranný blok — strany NEZRCADLIT (NOVĚ)
- Ostrovní blok má **dva nezávislé seznamy segmentů**: strana A a strana B.
- Každá strana se konfiguruje zvlášť (vlastní seznam, vlastní přidávání,
  vlastní hlídání kapacity „Využito X / Y mm").
- UI: přepínač / dvě sekce „Strana A" a „Strana B"; při jednostranném bloku
  je vidět jen strana A.
- Výběr segmentu kliknutím ve 3D musí fungovat pro obě strany (unikátní id).

---

## 2. Napouštěcí ramena — NOVÁ PRAVIDLA
- **Jednostranný blok**: rameno může být POUZE u zadní strany.
  Nastavitelné: pozice X po délce (0–délka) a **vzdálenost od zadní hrany**
  (0–200 mm, krok 5, výchozí 60) — odsazení dopředu od zadního okraje.
- **Ostrovní blok**: rameno může být POUZE ve středu (na spáře mezi řadami).
  Nastavitelné: pozice X po délce a **vzdálenost od středu** (−200 až +200 mm,
  krok 5, výchozí 0) — posun k jedné či druhé straně.
- Volba „přední / zadní hrana" se ruší; místo ní se podle varianty bloku
  zobrazí odpovídající ovládání (popis „Vzdálenost od zadní hrany (mm)"
  resp. „Vzdálenost od středu (mm)").
- Úhel natočení ramene zůstává.

---

## 3. Katalog přístrojů + Správce přístrojů (media manager) — NOVĚ

### 3.1 Datový model přístroje
Každý přístroj (vestavěný i uživatelský) je popsán objektem:
```
{
  id, name,                    // název v UI
  builtin: true|false,
  visible: true|false,         // zobrazovat v „Přidat segment"?
  widthMM,                     // výchozí šířka
  minWidthMM,                  // minimální šířka podestavby
  widthAdjustable: true|false, // lze měnit šířku instance
  topFeature: {...},           // co je na desce (viz níže)
  controls: { type:'knob'|'button'|'switch', count:0..8 },
  imageDataURL: null|string,   // volitelná bitmapa na desku
  bodyStyle: 'closed'|'doors'|'open'
}
```
`topFeature` typy: `burners4`, `ceramic4`, `fryer2`, `grill`, `bainmarie`,
`multipan`, `sink`, `induction`, `none`, `bitmap`.

### 3.2 Vestavěné přístroje (základ katalogu)
Sporák plynový 800, Sklokeramika 800, Fritéza 400, Gril 800, Vodní lázeň 400,
Multifunkční pánev 800, Dřez 800 (viz §3.3), Indukce (viz §3.3).
Vestavěné nelze smazat, ale **lze je skrýt** (visible=false) a **duplikovat**
do vlastního přístroje.

### 3.3 Nové přístroje
- **Indukce** — jedna varná zóna **400 × 400 mm** (tmavá sklokeramická deska
  s naznačenou kruhovou zónou), **volitelná šířka podestavby, minimum 500 mm**
  (výchozí 500, max 1200). Panel s 1 knoflíkem + displejem.
- **Dřez s volitelnými rozměry** — u instance segmentu lze nastavit
  **šířku vany** (300–900 mm) a **hloubku vany** (300–700 mm);
  šířka podestavby musí být ≥ šířka vany + 100 mm (vynucovat).
  Vana je zapuštěná v desce, doplněná stojánkovou baterií.

### 3.4 Správce přístrojů (dialog „Správce přístrojů…")
Samostatný modální dialog, otevíraný tlačítkem v bočním panelu:
- **Seznam všech přístrojů** (vestavěné + vlastní) s: názvem, šířkou,
  přepínačem viditelnosti (checkbox „zobrazovat"), tlačítky
  „Upravit" / „Duplikovat" / „Smazat" (smazat jen u vlastních).
- **Tlačítko „Nový přístroj"** → formulář: název, šířka, min. šířka,
  zda je šířka nastavitelná, typ prvku na desce (select z topFeature typů),
  počet (0–8) a druh ovládacích prvků, volitelná bitmapa na desku,
  styl podestavby (uzavřená / s dvířky / otevřená).
- Katalog se **ukládá do localStorage** (klíč `alba-katalog-v1`) a je
  součástí JSON exportu konfigurace (aby šel přenést i s vlastními přístroji).
- Sekce „Přidat segment" v bočním panelu zobrazuje **jen přístroje
  s visible=true**.

---

## 4. Neutrální a otevřené skříňky — OPRAVY
- Neutrální modul: volba **s policí / bez police** (nezávisle na tom, zda má
  dvířka nebo je otevřený).
- **Police je vždy vertikálně vystředěná v DUTINĚ** skříňky. Dutina =
  vnitřní prostor podestavby; pokud má segment ovládací panel, panel do
  dutiny NEPATŘÍ (dutina končí pod panelem).
- **Otevřená skříňka**: police musí být **zapuštěná 20–30 mm od čela**
  (nesmí vyčnívat před rám). Dutina musí být čitelná — světlejší vnitřek,
  jasně viditelné boky, dno, záda i police; žádná police „trčící" z čela.
  Otevřený otvor lemuje rám ze stejného nerezu.

---

## 5. Půdorysný pohled s popisky (NOVĚ)
- Nové tlačítko v sekci „Zobrazení": **„Půdorys s popisky"**.
- Zobrazí (jako SVG překryv nad 3D viewportem, ne 3D kamera) technické
  schéma bloku shora:
  - obrys desky a podestaveb (s kótou celkové délky, hloubky, u ostrova
    obou hloubek), boční krycí plechy,
  - jednotlivé segmenty jako obdélníky, uvnitř **číslo pozice (1, 2, 3…)**,
    **název** a **šířka v mm**,
  - u ostrovního bloku obě strany (A nahoře, B dole) se samostatným
    číslováním (A1, A2… / B1, B2…),
  - značky napouštěcích ramen s pozicí,
  - legenda: seznam pozic s názvem a rozměrem (číslo, název, šířka × hloubka).
- Schéma musí být čitelné a tisknutelné; tlačítko „Stáhnout půdorys (SVG)".

---

## 6. Logo ALBA
Soubor `Logo-ALBA.jpg` (modré logo na bílém pozadí) je v kořeni projektu.
- **Na bočních krycích plechech**: velké logo, vycentrované, vyplní cca 60 %
  výšky plechu, na obou koncích bloku a na vnější straně (pohledová strana).
- **Na ovládacích panelech přístrojů**: malá decentní „samolepka" — logo
  o výšce cca 25 mm umístěné u pravého okraje panelu.
- Načítat přes `THREE.TextureLoader` s `'Logo-ALBA.jpg'`,
  `texture.colorSpace = THREE.SRGBColorSpace`. Bílé pozadí loga zůstává
  (jde o samolepku/potisk) — plocha loga je samostatná tenká deska
  položená na povrch, ne textura celého plechu.

---

## 7. Minimální rozměry přístrojů (NOVĚ, v3.1)

### 7.1 Datový model
Každý přístroj v katalogu (i vestavěný) má nově **minimální rozměry podestavby**:
- `minWidthMM` — minimální šířka (už existuje),
- `minDepthMM` — **minimální hloubka** (nové), výchozí 700 mm u vestavěných.

Instance segmentu má vlastní `widthMM` a **`depthMM`**; obojí musí být
≥ příslušné minimum přístroje. Výchozí hodnoty instance = minima přístroje.

### 7.2 Editace vestavěných přístrojů
Ve Správci přístrojů jde **upravovat i vestavěné přístroje** (tlačítko
„Upravit" už nesmí být zakázané) — minimálně pole název, minimální šířka,
minimální hloubka, výchozí šířka/hloubka, počet a druh ovládacích prvků.
Vestavěné přístroje stále NELZE smazat. Změny se ukládají do localStorage.
Přidat tlačítko **„Obnovit výchozí"** u vestavěného přístroje, které vrátí
tovární hodnoty.

### 7.3 Chování ve 3D
- **Podestavba (skříňka) pod přístrojem se staví v rozměrech instance**
  (šířka × hloubka), ne v hloubce celého bloku.
- Mělčí podestavba je **zarovnaná k čelu** bloku; prostor za ní je vyplněn
  hladkým nerezovým dorovnáním, aby blok zůstal uzavřené těleso.
- **Hloubka strany bloku se automaticky zvětší** na hloubku nejhlubšího
  segmentu na dané straně, pokud by se do zadané hloubky nevešel; UI to
  oznámí poznámkou u pole hloubky (např. „Zvětšeno na 900 mm kvůli: Indukce").
  Uživatelem zadaná hodnota se nikdy nesnižuje.
- Pracovní deska zůstává průběžná přes celou hloubku bloku (+15 mm přesah).

### 7.4 UI instance segmentu
U každého přístrojového segmentu v seznamu jsou dvě číselná pole:
**„Šířka (mm)"** (min = minWidthMM) a **„Hloubka (mm)"** (min = minDepthMM).
Pokus o zadání menší hodnoty se ořízne na minimum. Půdorysné schéma i legenda
musí zobrazovat SKUTEČNOU hloubku každého segmentu.

## 8. Kritéria přijetí
1. Zadaná délka/hloubka = půdorys podestaveb; deska viditelně přesahuje 15 mm.
2. Na obou koncích bloku je krycí plech 20 mm s logem ALBA.
3. Hloubka je volně zadatelná od 500 mm; ostrov má dvě nezávislé hloubky.
4. Ostrov: strany A a B mají nezávislý obsah (jiné segmenty na každé straně).
5. Rameno u jednostranného bloku jen vzadu s nastavitelným odsazením;
   u ostrova jen ve středu s nastavitelným posunem.
6. Půdorysné schéma vypíše očíslované pozice s názvy a rozměry.
7. Neutrální modul jde přepnout s policí / bez police; police je vystředěná
   a u otevřené skříňky zapuštěná od čela.
8. Indukce (400×400 zóna, šířka od 500 mm) a dřez s volitelnými rozměry vany
   jsou v katalogu a fungují.
9. Správce přístrojů umožní vytvořit, upravit, duplikovat, smazat a skrýt
   přístroje; skryté se nenabízejí v „Přidat segment"; katalog přežije
   reload stránky.
10. Bez chyb v konzoli; PNG i JSON export/import funguje včetně katalogu.

---

# SPEC v4 — doplnění (kamera, přístroje, podestavby, půdorys, jazyky)

## 9. Chování kamery — OPRAVA
Jakákoli úprava sestavy (rozměry, přidání/odebrání/změna segmentu, ramena,
katalog) **NESMÍ měnit aktuální pohled kamery**. Uživatelem nastavené natočení
a zoom zůstávají zachovány.
- Automatické přerámování (`reframeCamera`) se smí provést POUZE:
  1) při prvním sestavení scény po načtení stránky,
  2) po kliknutí na tlačítko přednastaveného pohledu (Perspektiva / Čelní / Shora),
  3) po načtení konfigurace ze souboru nebo z prohlížeče.
- Přidat tlačítko **„Vycentrovat pohled"** do sekce Zobrazení pro ruční
  přerámování na aktuální blok.

## 10. Přístroje — pevná velikost a povolené podestavby

### 10.1 Pevná velikost přístroje na desce
Katalogový přístroj má nové pole **`topFixed: true|false`**.
- `topFixed: true` → prvek na desce (hořáky, sklokeramika, vany fritézy,
  indukční zóna…) se vykresluje ve své **jmenovité velikosti bez ohledu na
  šířku podestavby**, vodorovně vystředěný. Ovládací prvky na panelu se
  **neroztahují** — zůstávají v pevných rozestupech, seskupené pod přístrojem.
  Zvětšuje se pouze podestavba kolem něj.
- `topFixed: false` → dosavadní chování (prvek se roztahuje s šířkou).
- Vestavěné přístroje s `topFixed: true`: **sporák plynový, sklokeramika,
  fritéza, indukce**. Ostatní (gril, vodní lázeň, multifunkční pánev, dřez)
  zůstávají roztažitelné.
- Přepínač `topFixed` je editovatelný ve Správci přístrojů.

### 10.2 Povolené typy podestavby u přístroje
Katalogový přístroj má nové pole **`allowedBodyStyles`** — pole podmnožiny
`['closed','doors','open']` (uzavřená bez dvířek / s dvířky / otevřená).
- Ve Správci přístrojů se nastavuje třemi checkboxy; alespoň jeden musí
  zůstat zapnutý.
- U segmentu v bočním panelu se nabízí **jen povolené** typy podestavby;
  má-li přístroj povolený jediný typ, select se nezobrazuje (jen text).
- Výchozí u vestavěných: přístroje s vanami a hořáky (sporák, sklokeramika,
  fritéza, indukce, gril, vodní lázeň, multifunkční pánev) → `['closed','doors']`;
  dřez → `['closed','doors','open']`.

### 10.3 Katalogové údaje přístroje
Nová pole (všechna volitelná, editovatelná ve Správci přístrojů, prázdná se
nikde nevypisují): **`powerKW`** (příkon v kW), **`voltage`** (napájení,
text – např. „400 V / 50 Hz"), **`gasKW`** (plynový příkon v kW),
**`descriptionText`** (popis funkcí), **`constructionText`** (popis konstrukce),
**`catalogCode`** (katalogové označení). U vestavěných zůstávají prázdná —
vyplní si je uživatel; aplikace si žádné technické údaje nevymýšlí.

## 11. Podestavby — provedení a hloubka

### 11.1 Zarovnaná hloubka podestaveb (ZMĚNA proti §7)
Podestavby mají ve varném bloku **vždy stejnou, zarovnanou hloubku** —
per-segmentové pole „Hloubka (mm)" se ruší.
Hloubka podestavby se odvozuje z hloubky bloku:
- **Jednostranný blok**: hloubka podestavby = hloubka bloku − **50 mm**
  (mezera 50 mm od stěny za blokem).
- **Ostrovní blok**: mezi podestavbami obou řad je celková mezera **150 mm**,
  tj. hloubka podestavby jedné řady = hloubka té strany − **75 mm**.
Pracovní deska zůstává průběžná přes celou hloubku bloku (+15 mm přesah).
Minimální hloubka přístroje (`minDepthMM`) nadále platí — pokud se do
odvozené hloubky podestavby nevejde, **hloubka strany bloku se automaticky
zvětší** (jako dosud) a UI to oznámí.

### 11.2 Provedení podestavby (nová pole INSTANCE segmentu)
Každý segment (přístrojový i neutrální) má nově:
- **`plinth`**: `'legs'` (nožičky) | `'building'` (stavební sokl) |
  `'construction'` (konstrukční sokl) — výchozí `'construction'`.
- **`finish`**: `'HS+'` | `'H1'` | `'H2'` | `'H3'` — výchozí `'H1'`.
Obojí se nastavuje selectem v seznamu segmentů, ukládá se do JSON a vypisuje
se v soupisu půdorysu. Ve 3D se `plinth` projeví alespoň vizuálně:
`legs` = 4 viditelné nožičky místo plného soklu, `building`/`construction`
= plný sokl (konstrukční o něco vyšší/zapuštěnější než stavební).

## 12. Půdorys — přepracování

### 12.1 Obsah kresby
- Segmenty se kreslí ve **dvou vrstvách**: obrys **podestavby** (plná čára,
  zarovnaná hloubka dle §11.1) a nad ním **půdorys přístroje** na desce
  (hořáky, plotny, vany, dřez…) schematicky jako při pohledu shora.
- U každé pozice velký, zřetelný **kód pozice** (A1, A2…, B1…) v rámečku.

### 12.2 Kóty
- Všechny kóty ležící vedle sebe musí být **zarovnané na společnou osu**
  (stejná odsazovací vzdálenost), font kót **výrazně větší** než dosud.
- Kótovat: celkovou délku, hloubku bloku (u ostrova obě), hloubku podestaveb,
  a **řetězcovou kótu šířek jednotlivých pozic** pod blokem.

### 12.3 Soupis prvků (legenda)
Tabulka s výraznými kódy pozic a podrobnostmi. Sloupce:
`Poz. | Přístroj / prvek | Rozměr (š × h × v) | Podestavba | Údaje`
- **Podestavba**: typ (uzavřená / s dvířky / otevřená), police ano/ne,
  panel ano/ne, sokl (nožičky / stavební sokl / konstrukční sokl),
  provedení (HS+ / H1 / H2 / H3).
- **Údaje** u přístroje: katalogové označení, příkon (kW), napájení,
  plynový příkon, popis funkcí a konstrukce — vypisuje se jen to, co je
  v katalogu vyplněné.
- Řádky vizuálně oddělené, hlavička tučně, střídavé podbarvení.

## 13. Vícejazyčnost

- Jazyky v tomto pořadí: **angličtina (VÝCHOZÍ), němčina, polština, čeština,
  slovenština**. Struktura musí umožnit snadné přidání dalšího jazyka.
- Kódy a vlajky v pořadí: `en` 🇬🇧, `de` 🇩🇪, `pl` 🇵🇱, `cs` 🇨🇿, `sk` 🇸🇰.
- Přepínání **vlaječkami** v záhlaví bočního panelu; zvolený jazyk se ukládá
  do localStorage (`alba-jazyk`). Bez uloženého jazyka se použije angličtina.
- Přeložit **celé prostředí**: popisky, tlačítka, dialogy, hlášky, názvy
  pozic a typů podestaveb, názvy a popisy vestavěných přístrojů,
  a **celý půdorys včetně soupisu prvků** (nadpisy, kóty, hlavičky tabulky).
- Názvy a texty **vlastních** přístrojů se nepřekládají (zůstávají tak, jak je
  uživatel zadal).
- Implementace: nový soubor `js/i18n.js` se slovníky a funkcí `t(key, params)`;
  žádné natvrdo psané viditelné řetězce v ostatních souborech.
