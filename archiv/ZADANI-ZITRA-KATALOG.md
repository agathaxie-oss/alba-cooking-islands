# Zadání zítra — 9. 8. 2026

Stručný start. **Jediný platný předávací dokument je `PREDANI.md`**
(zejména **B0** + **ČÁST C — ZÍTRA**). Toto je jen rozcestník.

## Nejdřív přečíst

1. `PREDANI.md` — ČÁST A (pasti, keš), **B0**, **ČÁST C — ZÍTRA**
2. `ZADANI-KATALOG.md` — UX, etapy, workflow položek
3. `ZADANI-GEOMETRIE-RM.md` — geometrie RM / schválené vlny

## Priorita (v tomto pořadí)

1. **Topview v detailu katalogu** — kód hotový; ověř po **proplachu keše**
   (PREDANI A2). Fallback = SVG půdorys z `topFeature`+`zones`, když není
   fotka zhora (`js/catalog-browser.js`).
2. **Další produkty** — jen z **konkrétních URL od Jaroslava** + geometrie
   po vlnách se schválením.
3. Volitelně **`fryer1` absolutní** (F10D / `al-fr10-400-e`).
4. Etapy **F/G/H/I** z `ZADANI-KATALOG.md` — **až řekne Jaroslav**.
5. MONO nedodělky z `PREDANI.md` — **jen po přepnutí priority**.

## Závazné UX katalogu

Katalog = Přidat / Odebrat z palety. Na blok až klikem v paletě po zavření
overlay. **Žádné šedění.**

## Klíčové soubory

`katalog/`, `js/catalog.js`, `js/catalog-browser.js`, `js/modules.js`,
`mockup-katalog.html`, `css/style.css`, `js/i18n.js`

## Modely a pravidla

- **Grok 4.5** / **Composer Fast**; Sonnet ne bez pokynu.
- Ne paralelní zápis do stejného souboru.
- Jeden `http.server` na 8000; před ověřením proplach keše.
- Commit jen na výslovný pokyn.

## Stav večer 8. 8. 2026

Etapy katalogu A–E hotové · 10 položek · topview OK (SVG schematic) ·
geometrie #1–#5 schválené (`verify-burners2/4`, `fryer2`, `grill`, `ceramic`).
