# Konfigurátor nerezových varných bloků (v2)

Webová aplikace pro 3D modelování a vizualizaci modulárních nerezových varných bloků určených pro profesionální kuchyně. Verze 2 — přepracováno podle SPEC.md (viz sekce ZMĚNY) po reklamaci verze 1.

## Spuštění aplikace

Aplikace je čistě statická a nevyžaduje žádný build proces. Otevřete ji pomocí libovolného statického serveru:

### Python
```bash
python -m http.server
```
Poté otevřete `http://localhost:8000` v prohlížeči.

### VS Code Live Server
Instalujte rozšíření "Live Server" a klikněte na "Go Live" v dolní liště.

**Poznámka**: Aplikace vyžaduje připojení k internetu pro načtení Three.js z CDN (https://cdn.jsdelivr.net).

## Co je nové ve v2

- **Zadatelné rozměry bloku** — délka (1200–6000 mm), hloubka (700/850/1000 mm), pracovní výška (850–950 mm). Hlídá se kapacita: „Využito X / Y mm“, segmenty nad rámec délky se zobrazí červeně a nerenderují.
- **Nová stavba** — jedna průběžná pracovní deska přes celou délku bloku + podestavby pod ní (otevřená s policí / s dvířky / uzavřená u přístrojů).
- **Přístrojové moduly** mají vždy čelní ovládací panel s prvky (knoflíky, kontrolka, displej dle typu).
- **Neutrální modul** — zadatelná šířka 200–1200 mm, volba podestavby (otevřená/dvířka) a panelu (s/bez).
- **Vlastní modul** — dialog s názvem, vynucenou minimální šířkou, nahráním bitmapy na horní plochu desky segmentu a ovládacími prvky (počet 0–8, druh knoflík/tlačítko/přepínač).
- **Napouštěcí ramena** — nezávislý seznam prvků (chromový sloupek + otočné rameno), umístitelných kamkoliv na desku (pozice X, hrana přední/zadní, úhel natočení).
- **Jasnější grafika** — ACES tone mapping, PCF soft stíny, obrysové hrany na hlavních tělesech, světlejší nerez, gradientní pozadí, automatické přerámování kamery po každé změně sestavy.

## Struktura souborů

`index.html`, `css/style.css`, `js/main.js` (bootstrap, stav, scéna), `js/materials.js` (materiály, prostředí, textury), `js/modules.js` (katalog přístrojů + geometrie segmentů + vlastní modul), `js/block.js` (průběžná deska + podestavby + kapacita + skládání), `js/arms.js` (napouštěcí ramena), `js/ui.js` (boční panel), `js/viewer.js` (kamera/ovládání/pohledy), `js/custom-dialog.js` (dialog vlastního modulu).

## Katalog přístrojových modulů

Pevná šířka, vždy s čelním ovládacím panelem.

| Modul | Šířka | Ovládací panel |
|-------|-------|----------------|
| Sporák plynový | 800 mm | 4 knoflíky |
| Sklokeramika | 800 mm | 4 knoflíky + displej |
| Fritéza | 400 mm | 2 knoflíky + kontrolka |
| Gril / grilovací deska | 800 mm | 2 knoflíky |
| Vodní lázeň | 400 mm | 1 knoflík |
| Multifunkční pánev | 800 mm | 1 knoflík |
| Dřez | 800 mm | 1 knoflík (ventil) |

## Ovládání

### Myš a pohled
- **Střední tlačítko / kolečko** — Rotace pohledu
- **Scroll kolečka** — Zoom
- **Pravé tlačítko + pohyb** — Posun scény
- **Levé tlačítko** — Výběr segmentu ve 3D

### Export
- **Stáhnout PNG** — snímek aktuálního pohledu
- **Uložit/načíst konfiguraci** — JSON (localStorage i soubor), včetně vlastních modulů (vč. bitmapy jako dataURL) a napouštěcích ramen
