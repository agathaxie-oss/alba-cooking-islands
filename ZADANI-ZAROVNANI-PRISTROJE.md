# ZADÁNÍ — zarovnání přístroje v segmentu (SEGMENT)

Závazná smlouva rozhraní. Zadavatel 2. 9. 2026: „pokud je tam jeden přístroj,
mít možnost jej umístit v rámci segmentu vlevo, vpravo nebo doprostřed."

**Rozsah: VÝHRADNĚ produkt SEGMENT.** MONO se nesmí změnit ani o pixel.
Sloučení podestaveb (druhý požadavek téhož dne) je SAMOSTATNÁ etapa, tady se
neřeší — nezavádět pro něj žádná pole ani přípravu.

## Rozdělení souborů — tři agenti, žádný sdílený soubor

| agent | soubory |
|---|---|
| **M — model a 3D** | `js/main.js`, `js/modules.js` |
| **U — rozhraní a texty** | `js/ui.js`, `js/i18n.js` |
| **P — půdorys** | `js/floorplan.js` |

---

## §1 Datový model (Agent M, `js/main.js`)

`sanitizeSegment()` doplní katalogovému segmentu pole:

```
deviceAlign: 'left' | 'center' | 'right'     // výchozí 'center'
```

- Přidává se **jen v katalogové větvi** (ne u `neutral`, `drawers`, `custom`).
- Neznámá/chybějící hodnota → `'center'`, což je **dnešní chování** (přístroj
  se vystředí), takže starší soubor se načte beze změny vzhledu.
- Ukládá se se segmentem. Verze formátu se NEMĚNÍ.

## §2 Kde to vůbec má smysl

Jen u přístrojů s `def.topFixed === true`. Ty se kreslí v **jmenovité
katalogové šířce** a dnes se vystřeďují bez ohledu na zvětšenou šířku
podestavby (`js/modules.js`, `const topWidthM = def.topFixed ? mm(def.widthMM)
: widthM;`). U ostatních se plocha roztáhne na celou šířku, takže není čím
pohybovat — volba se pro ně **nenabízí a ignoruje**.

Druhá podmínka: `segment.widthMM > def.widthMM`. Když je podestavba přesně
tak široká jako přístroj, není kam uhnout.

## §3 Geometrie (Agent M, `js/modules.js`)

V `createSegmentMesh()` se posun aplikuje na **VŠECHNY TŘI** volání, která
dnes sdílejí `topWidthM` — plocha, ovladače i doplňky panelu:

```
renderControls(...)          // knoflíky MUSÍ zůstat pod svým přístrojem
decoratePanelExtras(...)
applyTopFeature(...)
```

Posun v metrech:

```
rozdilM = widthM - topWidthM;        // 0, když se přístroj vejde přesně
offsetM = align === 'left'  ? +rozdilM / 2
        : align === 'right' ? -rozdilM / 2
        : 0;
```

**ZNAMÉNKO JE ZMĚŘENÉ, NEHÁDEJ HO:** kladné world X je na obrazovce VLEVO
(ověřeno promítnutím přes kameru čelního pohledu: první segment v poli má
world X 580 a promítá se na NDC −0,218). Kladný lokální posun tedy jde
DOLEVA. Kdo to otočí, dostane přesně tu vadu, která v tomhle projektu už
jednou stála dva dny (viz PREDANI úkol 1).

Doporučený způsob: obalit ty tři volání do `THREE.Group` s `position.x =
offsetM`, ne posouvat každý dílec zvlášť. Korpus, panel a sokl se
NEPOSOUVAJÍ — hýbe se jen to, co leží na desce a jeho ovladače.

**Bitmapa vlastního modulu (`addBitmapOverlay`) se neposouvá** — týká se
`custom`, kde volba neexistuje.

## §4 Rozhraní (Agent U, `js/ui.js`)

V pruhu parametrů vybraného segmentu přibude výběr zarovnání. Zobrazí se
**jen** při splnění obou podmínek z §2 (`def.topFixed` a `widthMM >
def.widthMM`) — jinak se nevykreslí vůbec, ne zašedle.

- Popisek `field.deviceAlign`, hodnoty přes `deviceAlign.${v}`.
- Změna jde stávající cestou, jakou používají ostatní pole segmentu (stejný
  vzorec jako `onCatalogBodyStyleChange` apod.) — **žádný nový mechanismus**,
  jen další handler ve stejném stylu.
- Pořadí ve formuláři: hned za šířkou, protože s ní přímo souvisí.

## §5 Texty (Agent U, `js/i18n.js`) — všech 5 jazyků (en, de, pl, cs, sk)

| klíč | cs |
|---|---|
| `field.deviceAlign` | Umístění přístroje |
| `deviceAlign.left` | Vlevo |
| `deviceAlign.center` | Na střed |
| `deviceAlign.right` | Vpravo |

## §6 Půdorys (Agent P, `js/floorplan.js`)

`drawDeviceTopView()` už dnes u `topFixed` kreslí přístroj v jmenovité šířce
vystředěný (`const w = def && def.topFixed ? nominalWidthMM : item.widthMM;`).
Doplnit týž posun jako ve 3D, aby kresba odpovídala modelu.

**POZOR na směr:** v půdorysu se pracuje v souřadnicích KRESBY, ne world X.
Ověř si, kterým směrem roste `drawX`, a odvoď znaménko z toho — neopisuj
znaménko z §3 naslepo. U ostrovní varianty má strana B vlastní orientaci
(`mirrorX` v `layoutRow`), takže „vlevo" v pásu musí být „vlevo" i v kresbě
pro OBĚ strany.

Větev MONO ve `floorplan.js` (`computeMonoDocModel`, `buildMonoFloorplanSVG`)
se NESMÍ dotknout.

## §7 Co se NEDĚLÁ

- MONO se nemění.
- Nezavádí se nové pole katalogu ani nový soubor v `js/`.
- Neřeší se sloučení podestaveb — samostatná etapa.
- Verze formátu projektu se nemění.
- Tisková rozpiska (`report.js`) se v této etapě nerozšiřuje.

## §8 Přejímka

Agenti pouštějí `node --check` a hlásí změny. **Neměří v prohlížeči** —
měření dělá koordinátor: posun doleva/doprava změřený přes `Box3` proti
world X, knoflíky se hýbou s přístrojem, `center` dává dnešní čísla,
volba se nenabízí u roztažitelných ani u přesně padnoucích přístrojů,
půdorys souhlasí se 3D na obou stranách ostrova, MONO beze změny,
uložení a načtení projektu, čistá konzole.
