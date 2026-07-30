# Konfigurátor nerezových varných bloků ALBA (v3)

Statická webová aplikace pro 3D konfiguraci a vizualizaci nerezových varných bloků ALBA určených pro profesionální kuchyně. Používá Three.js načtený z CDN, bez build kroku, bez závislostí na Node.js.

## Spuštění

Aplikace je čistě statická a nevyžaduje build process. Spusťte ji na libovolném statickém serveru:

```bash
python -m http.server 8000
```

Poté otevřete `http://localhost:8000` v prohlížeči.

**Poznámky:**
- Aplikace nefunguje přes `file://` (ES moduly vyžadují HTTP).
- Vyžaduje připojení k internetu pro načtení Three.js z CDN.
- Návod na nasazení viz [DEPLOY.md](DEPLOY.md).

## Funkce verze 3

### Rozměry a geometrie
- **Délka bloku**: 1200–6000 mm (zadaná délka = půdorys podestaveb).
- **Hloubka**: volně zadatelná 500–1200 mm; u ostrovního bloku dvě nezávislé hloubky (strana A a B).
- **Pracovní výška**: 850–950 mm.
- **Pracovní deska** přesahuje podestavby o **15 mm** po celém obvodu.
- **Boční krycí plechy** (20 mm) na obou koncích s logem ALBA.

### Typy bloků
- **Jednostranný blok**: jeden řad segmentů s rameny u zadní hrany.
- **Ostrovní blok**: dva nezávislé řady (strany A a B), každá se konfiguruje zvlášť.

### Katalog přístrojů
Sporák plynový, sklokeramika, fritéza, gril, vodní lázeň, multifunkční pánev, dřez (s volitelnými rozměry vany), indukce (zóna 400×400 mm, min. šířka podestavby 500 mm).

### Moduly
- **Neutrální modul**: volitelná šířka podestavby, výběr mezi otevřenou či s dvířky, volitelná police.
- **Vlastní modul**: uživatelská bitmapa na desce, volitelný počet ovládacích prvků (0–8).
- **Správce přístrojů**: vytváření, úprava, duplikování, mazání a skrývání přístrojů; katalog se ukládá do `localStorage`.

### Napouštěcí ramena
- **Jednostranný blok**: ramena u zadní hrany s nastavitelným odsazením od okraje (0–200 mm).
- **Ostrovní blok**: ramena ve středu (mezi řadami) s nastavitelným posunem (−200 až +200 mm).

### Vizualizace a export
- **Půdorysné schéma s popisky**: očíslované pozice, názvy segmentů, rozměry, kóty, legenda; export do SVG.
- **Pohledy**: perspektiva, čelní pohled, pohled shora, světlá/tmavá podlaha.
- **Výběr segmentu**: kliknutím ve 3D scéně.
- **Export**: PNG snímek, uložení/načtení konfigurace do JSON a do `localStorage`.

### Vícejazyčnost
Přepínání jazyka vlaječkami v záhlaví bočního panelu: 🇬🇧 angličtina (výchozí),
🇩🇪 němčina, 🇵🇱 polština, 🇨🇿 čeština, 🇸🇰 slovenština. Bez uloženého nastavení
se použije angličtina; zvolený jazyk se ukládá do `localStorage`
(`alba-jazyk`) a přepnutí okamžitě překreslí celé UI — boční panel, dialogy
(Správce přístrojů, vlastní modul), hlášky i půdorysné schéma — bez nutnosti
reloadu stránky. Vestavěné přístroje se zobrazují pod názvem podle aktuálního
jazyka, pokud je uživatel nepřejmenoval; přejmenované a vlastní přístroje se
nepřekládají. Uložená konfigurace a katalog ukládají identifikátory, ne
přeložené texty, takže překlad je nemůže rozbít. Slovníky a logika překladu
jsou v `js/i18n.js`; přidání dalšího jazyka je otázka doplnění jednoho
záznamu.

## Ovládání myší

- **Levé tlačítko**: Výběr segmentu.
- **Střední tlačítko**: Rotace pohledu.
- **Pravé tlačítko**: Posun scény.
- **Kolečko**: Zoom.

## Struktura souborů

| Soubor | Popis |
|--------|-------|
| `index.html` | Hlavní stránka. |
| `css/style.css` | Styly UI. |
| `js/main.js` | Bootstrap, globální stav a scéna. |
| `js/materials.js` | Materiály, prostředí a textury. |
| `js/modules.js` | Definice přístrojových segmentů. |
| `js/catalog.js` | Katalog přístrojů a správa. |
| `js/block.js` | Geometrie podestaveb a desky. |
| `js/arms.js` | Napouštěcí ramena. |
| `js/ui.js` | Boční panel a ovládání. |
| `js/viewer.js` | Kamera, ovládání a pohledy. |
| `js/custom-dialog.js` | Dialog pro vlastní modul. |
| `js/device-manager.js` | Správce přístrojů. |
| `js/floorplan.js` | Půdorysné schéma s popisky. |
| `js/i18n.js` | Vícejazyčnost — slovníky (en/de/pl/cs/sk), `t()`, přepínání jazyka. |
| `Logo-ALBA.jpg` | Logo ALBA na bočních krytích plechech. |
