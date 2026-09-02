# ZADÁNÍ — sloučení podestaveb (SEGMENT)

Závazná smlouva rozhraní. Zadavatel 2. 9. 2026: „těch více přístrojů by se
dalo udělat tak, že bychom tam dali možnost *sloučit přístroje* a v rámci
projektu by se to počítalo pořád stejně, jen by se sloučily podestavby —
opticky ve 3D a ve finálním výpisu."

**Rozsah: VÝHRADNĚ produkt SEGMENT.** MONO se nesmí změnit ani o pixel.

**Zásada, na které to celé stojí:** každý přístroj zůstává SVÝM segmentem.
Kapacita řady, pořadí, výběr, číslování ani uložený soubor se nemění v tom,
co počítají. Sloučení je vlastnost ZOBRAZENÍ a propisování parametrů — ne
nová jednotka modelu.

## Etapy

| etapa | agent | soubory |
|---|---|---|
| 1 | **A — model** | `js/main.js` |
| 1 | **G — 3D** | `js/modules.js`, `js/block.js` |
| 1 | **U — rozhraní a texty** | `js/ui.js`, `js/i18n.js` |
| 2 | (později) | `js/floorplan.js`, `js/report.js` |

Etapa 2 (půdorys a soupis dílů) se teď NEDĚLÁ.

---

# §1 Datový model (Agent A, `js/main.js`)

Nové INSTANCE pole na segmentu, u VŠECH typů (neutral, drawers, custom
i katalogový):

```
mergeWithPrev: boolean      // výchozí false
```

Význam: **„podestavba tohoto segmentu je sloučená s předchozím segmentem
v řadě"** (předchozí = nižší index v poli `segmentsA`/`segmentsB`).

Skupina je tedy **souvislý běh** segmentů, kde druhý a další mají
`mergeWithPrev: true`. Souvislost je tím zaručená konstrukcí — nejde
zapsat skupinu z nesousedních segmentů.

**Normalizace `normalizeMergeFlags(list)`** — volá se po KAŽDÉ změně pole
(načtení souboru, přidání, přesun, smazání):
- segment na indexu 0 má vždy `mergeWithPrev = false` (nemá s čím splynout);
- hodnota jiná než `true` → `false`.

## §2 Rozdělení skupiny při přesunu a smazání

Rozhodnutí zadavatele: **skupina se rozdělí.** Při přesunu nebo smazání
segmentu se `mergeWithPrev` vynuluje na DVOU místech:
1. na přesouvaném segmentu (odchází ze skupiny),
2. na segmentu, který po zásahu stojí na jeho původní pozici (jinak by se
   omylem slepil s tím, co bylo před dírou — to by bylo pohlcení, ne
   rozdělení).

Pak se zavolá `normalizeMergeFlags()`.

## §3 Propisování parametrů (Agent A)

Rozhodnutí zadavatele: **propisuje se vzhled i panel.** Při změně některého
z těchto polí u KTERÉHOKOLI člena skupiny se táž hodnota zapíše VŠEM členům:

| pole | u kterých typů existuje |
|---|---|
| `finish` | všechny |
| `bodyStyle` | katalogový segment |
| `podestavba` (`'doors'` / `'open'`) | neutrální modul |
| `hasPanel` | neutrální modul, zásuvky |
| `hasShelf` | neutrální modul |

**Propisuje se po jednotlivých polích a jen tam, kde je cíl má.** Když cílový
segment dané pole nemá, přeskočí se — nic se nedomýšlí a nic se nezakládá.
`bodyStyle` a `podestavba` jsou tentýž pojem ve dvou typech: hodnoty
`'doors'`/`'open'` se mezi nimi mapují 1:1, `'closed'` neutrální modul nezná,
takže se k němu nepropíše. Hodnota musí projít stávající validací
(`sanitizeBodyStyle` proti `allowedBodyStyles`) — co neprojde, se přeskočí.

**NIKDY se nepropisuje** `widthMM` (každý přístroj si drží svou šířku, jinak
se rozbije kapacita řady), `type`, `deviceAlign`, `drawerCount`, rozměry vany
dřezu ani cokoli dalšího vázaného na konkrétní přístroj.

**Při sloučení** (zapnutí `mergeWithPrev`) se hodnoty vezmou z **PRVNÍHO
člena skupiny v pořadí pole** (nejlevější v pásu) a zapíšou všem ostatním —
tak to zadavatel určil.

# §4 Geometrie (Agent G)

`createSegmentMesh()` v `js/modules.js` přibírá poslední parametr:

```
createSegmentMesh(segment, depthM, workHeightM, plinth, merge = { prev: false, next: false })
```

- `merge.prev` = tento segment je sloučený s PŘEDCHOZÍM v poli
- `merge.next` = NÁSLEDUJÍCÍ segment je sloučený s tímto

`buildSideSegments()` v `js/block.js` si příznaky spočítá z pole
(`seg.mergeWithPrev` u sebe a u následníka) a předá je.

**POZOR NA ORIENTACI — nehádej ji.** `buildSideSegments` klade první segment
pole na NEJVYŠŠÍ +X (`xCenterM = usableWidth/2 − (cursor + width/2)`), takže
PŘEDCHOZÍ segment leží na straně **kladného lokálního x** a NÁSLEDUJÍCÍ na
straně záporného. `merge.prev` se tedy týká **+x** líce, `merge.next` líce
**−x**. (Kladné world X je zároveň na obrazovce vlevo — změřeno.)

Co se na sloučeném líci má stát:
1. **Boční stěna se nepostaví** (`buildOpenBody` staví stěny na `±(widthM −
   wallT)/2` — na sloučené straně se vynechá).
2. **Zacelit spáru:** tělesa jsou dnes vědomě o pár mm užší, aby se
   neprolínala (`buildClosedBody` `widthM − 0.003`, `buildPanelBand`
   `widthM − 0.01`). Na sloučeném líci se ta rezerva NEODEČÍTÁ, aby mezi
   sousedy nezůstala viditelná spára. Na nesloučeném líci zůstává beze změny.
3. **Dvířka, zásuvková čela, police a ovládací panel zůstávají PER SEGMENT.**
   Široká skříňka s několika páry dvířek je běžná; sloučení ruší dělicí
   stěny a spáry korpusu, ne výbavu.
4. Nožičky (`buildPlinth`) se nemění — sokl na úrovni bloku řeší `block.js`.

# §5 Rozhraní a texty (Agent U)

## `js/ui.js`

V pruhu parametrů vybraného segmentu přibude přepínač sloučení:

- Zobrazí se **jen tehdy, když segment NENÍ první v řadě** (má s čím splynout).
  U prvního segmentu se nevykreslí vůbec, ne zašedle.
- Provedení: zaškrtávátko se štítkem `field.mergeWithPrev`.
- Změna volá **`callbacks.onSegmentMergeChange(seg.id, merged)`** — přesně
  tímhle jménem, `merged` je boolean. Agent A doplní handler pod stejným
  jménem.
- Umísti ho na KONEC pruhu parametrů, za ostatní pole — je to vlastnost
  vztahu k sousedovi, ne parametr samotného segmentu.

## `js/i18n.js` — 2 klíče, všech 5 jazyků (en, de, pl, cs, sk)

| klíč | cs |
|---|---|
| `field.mergeWithPrev` | Sloučit podestavbu s předchozí |
| `field.mergeWithPrevHint` | Sloučené podestavby sdílejí provedení, typ těla a panel |

Druhý klíč použij jako `title` zaškrtávátka.

# §6 Co se NEDĚLÁ

- MONO se nemění.
- Půdorys a soupis dílů se v této etapě nemění (etapa 2).
- Nezavádí se nová jednotka modelu ani nové pole katalogu.
- Kapacita řady, pořadí, výběr a číslování zůstávají beze změny.
- Verze formátu projektu se NEMĚNÍ; starší soubor bez `mergeWithPrev` se
  načte jako nesloučený, tedy s dnešním vzhledem.

# §7 Přejímka

Agenti pouštějí `node --check` a hlásí změny. **Neměří v prohlížeči** —
měření dělá koordinátor: sloučené sousedy nedělí stěna ani spára, nesloučené
ano; propisování zasáhne všechny členy a NEZMĚNÍ šířky; přesun a smazání
skupinu rozdělí; první segment volbu nenabízí; kapacita řady beze změny;
uložení a načtení; MONO beze změny; čistá konzole.
