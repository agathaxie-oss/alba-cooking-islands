# Zadání pro novou session — baterie u dřezu (Klarco 1E.2904.82.76)

**Stav:** připraveno k zahájení, NEIMPLEMENTOVÁNO.
**Rozsah:** jeden ohraničený úkol — předělat 3D model baterie u dřezu podle
výkresu skutečného výrobku. Ostatní části aplikace jsou hotové a ověřené.

---

## 1. Jak pracovat

Uživatel pracuje stylem **„hlavní agent jen zadává a kontroluje"** —
implementaci deleguj na levnější modely (Sonnet na kód, Haiku na drobnosti)
a výsledek sám ověř v prohlížeči. Vše viditelné musí být v 5 jazycích.

---

## 2. Úkol

Baterie u dřezu se dnes staví ve funkci **`buildSinkTop`** v `js/modules.js`
(kolem ř. 760–800). Má být překreslena podle výkresu **Klarco 1E.2904.82.76**.

### Rozměry z výkresu (mm)
| Rozměr | Hodnota |
|---|---|
| Celková výška nad pracovní deskou | **330** |
| Délka ramene **L** (vodorovný dosah od osy těla k ose výtoku) | **245** |
| Průměr trubky ramene | **Ø25** |
| Průměr těla baterie | **Ø55** |
| Montážní příruba | **Ø47**, výška 50 |
| Závit pod přírubou | G¾ (Ø27) |
| Připojovací hadičky pod deskou | 350, G½" — **nemodelovat**, nejsou vidět |

### Tvar
Labutí krk: svislé válcové tělo, nahoře **oblouk** přecházející do vodorovného
ramene, které vede nad vanu a končí **krátkým svislým výtokem dolů
s perlátorem**. Rameno musí být nad vanou, ne vedle ní.

### Co zachovat beze změny
- **Loketní páka** (dlouhá ovládací páka do strany) nasazená na těle baterie.
- Umístění **na ose za vanou** — vodorovně vystředěná vůči vaně, posunutá
  dozadu za ni. Dnes: `faucetX = 0`, `faucetZ = min(vatBackZ + 0.06, depthM - 0.05)`.
- Zapuštěná vana dřezu **500 × 400 × 300 mm** (`buildSinkBasin`) — nesahat.
- Chromový materiál `createChromeMaterial()`.

### Co NESMÍŠ měnit
- **`js/arms.js`** — tam je *napouštěcí rameno* Klarco **1E.2959**, což je
  JINÝ výrobek (výška 510 mm, dosah 450 mm od osy, otočné ±180°). Je hotové
  a ověřené. Nezaměňovat s baterií u dřezu.

### Dnešní stav (co se mění)
`riserH = 0.24`, celková výška ~270 mm, páka ~170 mm. Cíl: **330 mm** celkem
a **245 mm** dosah ramene.

---

## 3. Kritéria přijetí

1. Bounding box baterie: výška nad deskou **≈ 330 mm**, vodorovný dosah
   od osy těla **≈ 245 mm** (±10 mm na průměry trubek).
2. Tvar je labutí krk s obloukem, ne rovný sloupek s kolenem.
3. Loketní páka zůstala, baterie je na ose za vanou, vana beze změny.
4. Půdorysné schéma (`js/floorplan.js` kreslí dřez shora včetně značky
   baterie) není rozbité; pokud se změní konstanty, které odtud čte, upravit i tam.
5. Bez chyb v konzoli; export PNG/JSON/SVG funguje.
6. Nový viditelný text (pokud vůbec vznikne) je v 5 jazycích v `js/i18n.js`.

---

## 4. Jak ověřovat — POZOR NA PAST

### Cache prohlížeče
Projekt obsluhuje `python -m http.server` na **portu 8000**, který **neposílá
hlavičky proti kešování**. Prohlížeč proto drží staré moduly.
- Při ruční kontrole je nutné **Ctrl+F5**.
- **Zásadní past:** dynamický import s cache-bustem (`import('./js/block.js?cb=...')`)
  **nebustne vnořené importy** — `block.js` si natáhne `arms.js` z cache
  a naměříš staré hodnoty. V této session to dvakrát vedlo k chybnému závěru
  (jednou jsem hlásil vadné rameno, které vadné nebylo). **Modul, který měříš,
  importuj vždy přímo s cache-bustem.**

### Recept na proměření geometrie
```js
{ const b='?cb='+Date.now();
Promise.all([import('three'), import('./js/modules.js'+b)]).then(([T,M])=>{
  const seg={ id:1, type:'sink', widthMM:800, bodyStyle:'doors', plinth:'construction',
              finish:'H1', hasPanel:true, hasShelf:false, vatWidthMM:500, vatDepthMM:400 };
  const mesh=M.createSegmentMesh(seg, 0.8, 0.9);   // (segment, hloubkaPodestavbyM, vyskaM)
  const box=new T.Box3().setFromObject(mesh); const s=new T.Vector3(); box.getSize(s);
  window.__m={ vyskaCelkem:+(box.max.y*1000).toFixed(0), x:+(s.x*1000).toFixed(0), z:+(s.z*1000).toFixed(0) };
}); 'go' }
```
Pracovní deska je v `y = 0.9`; výšku baterie nad deskou počítej jako
`box.max.y − 0.9`. Pro izolované vykreslení do PNG lze vytvořit vlastní
`WebGLRenderer` na offscreen canvas a stáhnout přes `<a download>`; v takové
scéně chybí odrazová mapa, takže nerez vypadá tmavě — je to artefakt testu,
ne vada.

### Náhled
`.claude/launch.json` je nastavený tak, že se **navěsí na běžící server**
(`{"name":"alba-konfigurator","url":"http://localhost:8000"}`) a nespouští
vlastní proces. Port 8000 drží uživatelův Python — nezabíjet.

### Úložiště v prohlížeči
Klíče: `alba-katalog-v1` (katalog), `nerez-blok-config-v3` (rozpracovaný
projekt), `alba-jazyk` (jazyk). Při testech je dobré je vyčistit
(`localStorage.clear()`), jinak se načte starý stav.

---

## 5. Kontext projektu — co je hotovo

Aplikace je statický 3D konfigurátor varných bloků ALBA (Three.js z CDN,
ES moduly, bez build kroku). Popis stavu: `SPEC.md` (v1–v4), `README.md`,
nasazení `DEPLOY.md`.

Hotovo a ověřeno v poslední etapě:
- **Katalog rozšířen o 5 spotřebičů** — Lotus PCD-68G (plyn 22 kW),
  FTLD-66ET (6 kW), F10D-64ET (7,15 kW, jednovanová), Berner BI1EG5 (5 kW),
  ALBA EBM 1/1 (1,2 kW). Vše s katalogovými údaji a názvy v 5 jazycích.
- **Popisy funkcí a konstrukce** přeloženy do 5 jazyků (mechanismus:
  tovární přístroj bere překlad, po ruční úpravě uživatelem doslovný text).
- **Nový typ varné plochy `fryer1`** (jedna vana) a jeho použití u F10D-64ET.
- **Půdorys respektuje `topFixed`** — kresba přístroje se už neroztahuje
  se šířkou skříňky, kreslí se v jmenovité šířce a vycentrovaná.
- **Nový modul „Zásuvky GN 1/1"** — pevná šířka 400 mm, s panelem 2 zásuvky,
  bez panelu volba 2 nebo 3.
- **Napouštěcí rameno** Klarco 1E.2959 — výška 510 mm, dosah 450 mm, ±180°.
- **Dřez** — vana 500 × 400 × 300 mm zapuštěná, baterie na ose za vanou
  s loketní pákou (rozměry k předělání dle tohoto zadání).

## 6. Co je rozpracované jinde

- **`ZADANI-KATALOG.md`** — samostatné, větší zadání na robustní katalogový
  systém (tovární katalog, uživatelské sady, snapshot v projektu, oddělení
  typu a instance). Není součástí tohoto úkolu, ale souvisí — až se bude
  dělat, přečti ho.
- **Známá odložená vada:** logo ALBA se ve 3D scéně nevykresluje
  (na konci bloku ho překrývá bílá plocha jiného tělesa). Uživatel řekl
  „logo už neřeš" — neoživovat bez jeho pokynu. Diagnóza je v paměti projektu.
