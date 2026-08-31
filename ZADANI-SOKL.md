# ZADÁNÍ — SOKLY (úkol 13) — smlouva rozhraní

Závazná smlouva pro souběžné agenty. Kontext: `PREDANI.md` ÚKOL 13 + ČÁST E.
Rozhodnutí zadavatele 31. 8. 2026 (nová, v PREDANI zatím nejsou):

1. **Typ soklu je vlastnost CELÉHO BLOKU** (ne skříňky). Volba se stěhuje
   z pásu do levého panelu, vedle výšky soklu. Platí pro OBA produkty.
2. **Pravidla kreslení platí i pro SEGMENT** (stejná tabulka jako MONO).
3. **Pracovní výška = 750 + výška soklu** pro OBA produkty
   (BODY_STACK_MM = 750; sokl 50–150 → pracovní výška 800–900).

## Datový model (formát projektu v6)

- NOVÉ `state.plinth = { type, heightMM }` — top-level, vedle `variant`.
  `type` ∈ `PLINTH_TYPES` (4 hodnoty, viz níž), výchozí `'construction'`.
  `heightMM` celé číslo 50–150, výchozí 150.
- `state.dimensions.heightMM` = DOPOČÍTANÁ pracovní výška
  `= BODY_STACK_MM (750) + state.plinth.heightMM`. Jediný zapisovatel je
  `main.js`; geometrie ji dál dostává jako dosud.
- Per-item `plinth` (`MonoCabinet.plinth`, `segment.plinth`) se PŘESTÁVÁ
  číst pro kreslení i zapisovat do nových souborů; při načtení se toleruje
  (ignoruje se, nesmí shodit soubor). Chybějící `state.plinth` → výchozí.

## Konstanty (vlastník: modules.js, pokud není řečeno jinak)

- `PLINTH_TYPES = ['legs', 'building', 'construction', 'legs_plinth']`
  — POUZE PŘIDÁNÍ `'legs_plinth'` (nožičky + soklová zástěna), nic se
  nepřejmenovává. Lokální literál v `mono-ui.js` ř. 39 se RUŠÍ (volba
  odchází z pásu, viz UI níž).
- NOVÉ exporty `modules.js`: `PLINTH_HEIGHT_MIN_MM = 50`,
  `PLINTH_HEIGHT_MAX_MM = 150`, `PLINTH_HEIGHT_DEFAULT_MM = 150`,
  `BODY_STACK_MM = 750`, `PLINTH_INSET_MM = 50`.
- `modules.js`: konstanta `PLINTH_HEIGHT` (0.15 pevně) se nahrazuje
  parametrem (metry) protaženým do všech míst, kde se používá.
- `mono-geometry.js`: `WORK_HEIGHT_MIN_MM` 850 → **800**;
  `LEG_HEIGHT_MM` přestává být pevných 150 — výška soklové zóny je
  parametr `plinth.heightMM`. Tělo podestavby je PEVNÉ:
  `bodyHeight = 750 − HERDBLOK_HEIGHT_MM (290) = 460`. Nižší sokl ⇒ celý
  blok klesne (kontrolní čísla PREDANI ČÁST F bod 1 platí pro sokl 150;
  u soklu 50 je vše o 100 níž).

## Pravidla kreslení (OBA produkty; soklová zóna 0..heightMM, uskočení 50 mm od líce bloku ZE VŠECH STRAN)

| typ | kreslí se |
|---|---|
| `building` | VŮBEC NIC (ani nožičky) |
| `construction` | nerezový RÁM po celém obvodu bloku, výška = heightMM, uskočený 50; ŽÁDNÉ nožičky; VŠECHNY strany vždy |
| `legs` | nožičky výšky heightMM (stávající rozmístění per skříňka/segment) |
| `legs_plinth` | nožičky + ZÁSTĚNA: plech po obvodu bloku, výška heightMM, uskočený 50; u `single` se ZADNÍ strana (u zdi) NEkreslí, u `island` všechny čtyři |

Rám i zástěna jsou geometrie NA ÚROVNI BLOKU (obvod půdorysu bloku — u
ostrova tím automaticky kryjí i mezeru mezi zády podestaveb), ne per
skříňka. Nožičky zůstávají per skříňka/segment.

## Rozdělení souborů (NIKDO nesahá mimo své)

- **AGENT-GEOMETRIE:** `js/mono-geometry.js`, `js/modules.js`, `js/block.js`
- **AGENT-UI:** `js/main.js`, `js/ui.js`, `js/mono-ui.js`, `index.html`,
  `js/i18n.js`, `css/style.css`
- `js/mono-block.js` NEPATŘÍ NIKOMU z nich (protahuje se ve fázi 2):
  AGENT-GEOMETRIE navrhne signaturu `buildMonoBlock({ ..., plinth })` a
  ověřuje přímým voláním `buildMonoBlock`, ne přes adaptér.

## UI (AGENT-UI)

- Levý panel, oba produkty: pole „Pracovní výška" se mění ze VSTUPU na
  zobrazený VÝSLEDEK; přibývá vstup „Výška soklu" (number, min 50, max 150,
  výchozí 150) a select „Typ soklu" (4 hodnoty z `PLINTH_TYPES`).
- Z pásu MONO i z parametrů SEGMENTU se volba soklu ODSTRAŇUJE.
- Všechny nové popisky v 5 jazycích, pořadí en, de, pl, cs, sk.
- Serializace: ukládat `plinth`, načítat tolerantně (viz datový model).
- Změna výšky/typu soklu překreslí scénu jako ostatní rozměry.
