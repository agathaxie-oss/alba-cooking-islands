// mono-prototype.js — obsluha zkušební stránky mono-prototype.html.
// Vývojářský nástroj (NE součást produktu) pro odsouhlasení geometrie
// ALBA MONO před tím, než se na ni naváže půdorys, tiskový dokument a pás.
// Žádné UI navíc — jen přednastavené ukázky a kamera převzatá ze stávající
// aplikace (viewer.js). Pětijazyčnost se sem nevztahuje, čeština stačí.
//
// Scéna/světla/podlaha zrcadlí bootstrap v main.js (stejný vzhled jako
// zbytek appky), kamera a ovládání jsou 1:1 z viewer.js.

import * as THREE from 'three';
import { setupEnvironment, createFloorMaterial, createBackgroundTexture } from './materials.js';
import { createCamera, createControls, computeViews, applyView, animateView } from './viewer.js';
import * as Mono from './mono-geometry.js';

const {
  buildMonoBlock,
  buildHerdblokOutline,
  checkSupport,
  buildSideCover,
  sideInsetMM,
  END_TYPES,
  HERDBLOK_DEPTH_DEFAULT_MM,
  OVERHANG_LIMIT_MM,
  BRIDGE_LIMIT_MM,
} = Mono;

const mm = (v) => v / 1000;

// --- základ scény (viz main.js) ----------------------------------------------

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = createBackgroundTexture();
setupEnvironment(renderer, scene);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3a3d42, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(3.5, 5, -2.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
dirLight.shadow.bias = -0.0015;
scene.add(dirLight);
scene.add(dirLight.target);

const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.35);
fillLight.position.set(-3.5, 2.5, 2.0);
scene.add(fillLight);

const floorGeometry = new THREE.CircleGeometry(30, 64);
const floorMesh = new THREE.Mesh(floorGeometry, createFloorMaterial(false));
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// --- kamera a ovládání — 1:1 převzato z viewer.js -----------------------------

const camera = createCamera(window.innerWidth / window.innerHeight);
const controls = createControls(camera, renderer.domElement);

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', handleResize);
handleResize();

// ============================================================================
// UKÁZKOVÉ SESTAVY a) až f) — viz zadání úkolu
// ============================================================================
// Sestavy se rozmisťují vedle sebe podél X (vlastní offset baseXMM na
// každou), aby šly srovnávat pohledem i objíždět kamerou. Souřadný systém
// uvnitř každé sestavy je ten z mono-geometry.js (x od 0, z=0 líc desky).
//
// Podestavby v ukázkách a)-c), f) mají OBA konce END_TYPES.VERTICAL_PLATE,
// proto sedí symetricky na x sideInsetMM(VERTICAL_PLATE) …
// width−sideInsetMM(VERTICAL_PLATE) (= INSET, viz HODNOTY-MONO.md §3 —
// konec skříněk zarovnaný s panelem). Ukázky d) a e) mají na některém konci
// jiný typ — tam se inset počítá zvlášť pro každou stranu (viz níže).
// Boční kryty už negenerujeme ručně — buildMonoBlock() je vytváří sám
// z řady podestaveb (viz zadání, bod 5).

const demos = [];
let cursorXMM = 0;
const DEMO_GAP_MM = 1200;
const INSET = sideInsetMM(END_TYPES.VERTICAL_PLATE); // 50

function addDemo(key, label, totalWidthMM, totalDepthMM, build) {
  const baseXMM = cursorXMM;
  const root = new THREE.Group();
  root.name = `demo-${key}`;
  root.position.x = mm(baseXMM);
  const result = build();
  root.add(result.group);
  scene.add(root);
  const demo = { key, label, baseXMM, totalWidthMM, totalDepthMM, root, result };
  demos.push(demo);
  cursorXMM += totalWidthMM + DEMO_GAP_MM;
  return demo;
}

// a) běžný blok — dvě podestavby, herdblok přes obě (žádný most, žádný převis)
addDemo('normal', 'a) běžný blok', 1600, HERDBLOK_DEPTH_DEFAULT_MM, () => buildMonoBlock({
  workHeightMM: 900,
  podestavby: [
    { xMM: INSET, widthMM: 750 },
    { xMM: 800, widthMM: 750 },
  ],
  herdblok: [
    { xMM: 0, widthMM: 1600, depthMM: HERDBLOK_DEPTH_DEFAULT_MM, leftEndType: END_TYPES.VERTICAL_PLATE, rightEndType: END_TYPES.VERTICAL_PLATE },
  ],
}));

// b) MOST — mezera 900 mm mezi podestavbami (pod mezí 1200 mm, měřeno mezi
// konci podestaveb OŘÍZNUTÝMI na rozsah panelu), herdblok ji překlenuje
addDemo('bridge', 'b) most (900 mm, limit 1200 mm)', 2300, HERDBLOK_DEPTH_DEFAULT_MM, () => buildMonoBlock({
  workHeightMM: 900,
  podestavby: [
    { xMM: INSET, widthMM: 650 },
    { xMM: 1600, widthMM: 650 },
  ],
  herdblok: [
    { xMM: 0, widthMM: 2300, depthMM: HERDBLOK_DEPTH_DEFAULT_MM, leftEndType: END_TYPES.VERTICAL_PLATE, rightEndType: END_TYPES.VERTICAL_PLATE },
  ],
}));

// c) PŘEVIS — herdblok přesahuje za panel podestavby o 420 mm (pod mezí 500 mm)
// Převis se měří od konce OVLÁDACÍHO PANELU (xMM+sideInsetMM(leftEndType) /
// xMM+width-sideInsetMM(rightEndType)), ne od konce herdbloku samotného —
// viz checkSupport().
addDemo('overhang', 'c) převis (420 mm, limit 500 mm)', 1600, HERDBLOK_DEPTH_DEFAULT_MM, () => buildMonoBlock({
  workHeightMM: 900,
  podestavby: [
    { xMM: INSET, widthMM: 1080 },
  ],
  herdblok: [
    { xMM: 0, widthMM: 1600, depthMM: HERDBLOK_DEPTH_DEFAULT_MM, leftEndType: END_TYPES.VERTICAL_PLATE, rightEndType: END_TYPES.VERTICAL_PLATE },
  ],
}));

// d) DVĚ ZAKONČENÍ vedle sebe — svislaDeska / svislaDeskaZkos. Oba typy
// vychází v tomhle kole jako ostrý roh (půdorysné zkosení je TODO, viz
// zadání), ukázka slouží hlavně k porovnání do budoucna.
const END_DEMO_WIDTH_MM = 900;
const endTypesForDemo = [END_TYPES.VERTICAL_PLATE, END_TYPES.VERTICAL_PLATE_CHAMFER];
addDemo('ends', 'd) dvě zakončení (svislaDeska / svislaDeskaZkos)',
  END_DEMO_WIDTH_MM * endTypesForDemo.length + DEMO_GAP_MM * (endTypesForDemo.length - 1),
  HERDBLOK_DEPTH_DEFAULT_MM, () => {
    const podestavby = [];
    const herdblok = [];
    endTypesForDemo.forEach((type, i) => {
      const xMM = i * (END_DEMO_WIDTH_MM + DEMO_GAP_MM);
      const inset = sideInsetMM(type); // stejný typ na obou koncích téhle dílčí ukázky
      podestavby.push({ xMM: xMM + inset, widthMM: END_DEMO_WIDTH_MM - 2 * inset });
      herdblok.push({
        xMM, widthMM: END_DEMO_WIDTH_MM, depthMM: HERDBLOK_DEPTH_DEFAULT_MM,
        leftEndType: type, rightEndType: type,
      });
    });
    return buildMonoBlock({ workHeightMM: 900, podestavby, herdblok });
  });

// e) límec — levý konec svislaDeska (límec se vykreslí), pravý konec
// svislaDeskaZkos (límec se NEVYKRESLÍ, i když je v poli `collar` požadovaný).
// Podestavba je zatažená ASYMETRICKY — vlevo o sideInsetMM(VERTICAL_PLATE)
// (50), vpravo o sideInsetMM(VERTICAL_PLATE_CHAMFER) (70).
addDemo('collar', 'e) límec (zadní + levá boční hrana; pravá NENÍ, konec je zkosený)', 1200, HERDBLOK_DEPTH_DEFAULT_MM, () => {
  const leftInset = sideInsetMM(END_TYPES.VERTICAL_PLATE);
  const rightInset = sideInsetMM(END_TYPES.VERTICAL_PLATE_CHAMFER);
  return buildMonoBlock({
    workHeightMM: 900,
    podestavby: [
      { xMM: leftInset, widthMM: 1200 - leftInset - rightInset },
    ],
    herdblok: [
      {
        xMM: 0, widthMM: 1200, depthMM: HERDBLOK_DEPTH_DEFAULT_MM,
        leftEndType: END_TYPES.VERTICAL_PLATE, rightEndType: END_TYPES.VERTICAL_PLATE_CHAMFER,
        collar: [
          { edge: 'back', heightMM: 100 },
          { edge: 'left', heightMM: 100 },
          { edge: 'right', heightMM: 100 }, // NEMĚLO by se vykreslit (pravý konec je zkosený)
        ],
      },
    ],
  });
});

// f) BOČNÍ KRYT — jeden blok 2490 mm, dvě podestavby posazené k oběma
// krajům (bez mezery). Boční kryty na obou koncích generuje buildMonoBlock()
// SÁM (viz zadání, bod 5) — stránka je už ručně nevytváří.
addDemo('cover', 'f) boční kryt', 2490, HERDBLOK_DEPTH_DEFAULT_MM, () => buildMonoBlock({
  workHeightMM: 900,
  podestavby: [
    { xMM: INSET, widthMM: 1195 },
    { xMM: 1245, widthMM: 1195 },
  ],
  herdblok: [
    { xMM: 0, widthMM: 2490, depthMM: HERDBLOK_DEPTH_DEFAULT_MM, leftEndType: END_TYPES.VERTICAL_PLATE, rightEndType: END_TYPES.VERTICAL_PLATE },
  ],
}));

// ============================================================================
// KAMERA — přednastavené pohledy na jednotlivé ukázky (viewer.js computeViews)
// ============================================================================

function focusDemo(demo, animate = true) {
  const views = computeViews(mm(demo.totalWidthMM), mm(demo.totalDepthMM));
  const centerXM = mm(demo.baseXMM + demo.totalWidthMM / 2);
  const viewDef = {
    position: [views.perspective.position[0] + centerXM, views.perspective.position[1], views.perspective.position[2]],
    target: [views.perspective.target[0] + centerXM, views.perspective.target[1], views.perspective.target[2]],
  };
  if (animate) animateView(camera, controls, viewDef);
  else applyView(camera, controls, viewDef);
}

function focusAll(animate = true) {
  const first = demos[0];
  const last = demos[demos.length - 1];
  const totalWidthMM = (last.baseXMM + last.totalWidthMM) - first.baseXMM;
  const maxDepthMM = Math.max(...demos.map((d) => d.totalDepthMM));
  const views = computeViews(mm(totalWidthMM), mm(maxDepthMM));
  const centerXM = mm(first.baseXMM + totalWidthMM / 2);
  const viewDef = {
    position: [views.perspective.position[0] + centerXM, views.perspective.position[1] * 1.3, views.perspective.position[2] * 1.3],
    target: [views.perspective.target[0] + centerXM, views.perspective.target[1], views.perspective.target[2]],
  };
  if (animate) animateView(camera, controls, viewDef);
  else applyView(camera, controls, viewDef);
}

// --- info panel: text s parametry + výsledky checkSupport pro danou ukázku ---

const infoEl = document.getElementById('info');
function renderInfo(demo) {
  if (demo === 'all') {
    infoEl.textContent = demos.map((d) => `${d.label}`).join('\n');
    return;
  }
  const lines = [demo.label];
  demo.result.support.forEach((s) => {
    lines.push(
      `  převis vlevo: ${s.leftOverhangMM} mm (${s.leftOverhangOK ? 'OK' : 'PŘEKROČENO'}, limit ${OVERHANG_LIMIT_MM})`
    );
    lines.push(
      `  převis vpravo: ${s.rightOverhangMM} mm (${s.rightOverhangOK ? 'OK' : 'PŘEKROČENO'}, limit ${OVERHANG_LIMIT_MM})`
    );
    if (s.bridges.length === 0) lines.push('  most: žádná mezera pod herdblokem');
    s.bridges.forEach((b) => {
      lines.push(`  most ${b.startMM}–${b.endMM} mm: ${b.gapMM} mm (${b.ok ? 'OK' : 'PŘEKROČENO'}, limit ${BRIDGE_LIMIT_MM})`);
    });
  });
  lines.push(`  pracovní výška: ${demo.result.workHeightMM} mm, tělo skříňky: ${Math.round(demo.result.bodyHeightMM)} mm`);
  infoEl.textContent = lines.join('\n');
}

// --- tlačítka HUD --------------------------------------------------------------

const buttons = Array.from(document.querySelectorAll('.preset-btn'));
function setActive(key) {
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.preset === key));
}
buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.preset;
    setActive(key);
    if (key === 'all') {
      focusAll();
      renderInfo('all');
    } else {
      const demo = demos.find((d) => d.key === key);
      focusDemo(demo);
      renderInfo(demo);
    }
  });
});

// výchozí pohled — ukázka a)
setActive('normal');
focusDemo(demos[0], false);
renderInfo(demos[0]);

// --- render smyčka ---------------------------------------------------------------

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ============================================================================
// LADICÍ ROZHRANÍ pro ověření přes konzoli — NENÍ součást produktu.
// ============================================================================

// Všechny exportované konstanty z mono-geometry.js (ne funkce) — bod 6 zadání.
const constants = {};
Object.entries(Mono).forEach(([k, v]) => {
  if (typeof v !== 'function') constants[k] = v;
});

/**
 * Vrátí skutečné světové rozměry (Box3) hlavních dílů dané ukázky, v mm.
 * Pro každý pojmenovaný díl (deska, korpus, panel, lista, podestavba,
 * bocni-kryt) vrátí POLE nálezů (může jich být víc — např. dvě podestavby,
 * nebo teď i víc bočních krytů THICK/THIN vedle sebe), s velikostí
 * (widthMM/heightMM/depthMM) a min/max souřadnicemi, seřazené podle minMM.x
 * (zleva doprava). U bocni-kryt je navíc `thicknessMM` čtená přímo z
 * `userData` (ne dopočtená z bounding boxu) — jde o hodnotu THICK (50) nebo
 * THIN (20), takže jde napřímo rozlišit, který kryt je který, i když widthMM
 * z bbox vyjde stejně. X souřadnice jsou přepočtené zpátky do lokálního
 * rámce ukázky (odečtený baseXMM), aby šly přímo srovnat s tabulkami rovin
 * Y/Z v zadání.
 */
function measure(demoKey) {
  const demo = demos.find((d) => d.key === demoKey);
  if (!demo) return null;
  const names = ['deska', 'korpus', 'panel', 'lista', 'podestavba', 'bocni-kryt'];
  const round = (v) => Math.round(v * 1000) / 1000;
  const result = {};
  names.forEach((name) => {
    const found = [];
    demo.root.traverse((obj) => {
      if (obj.name === name) {
        const box3 = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box3.getSize(size);
        found.push({
          widthMM: round(size.x * 1000),
          heightMM: round(size.y * 1000),
          depthMM: round(size.z * 1000),
          ...(obj.userData && obj.userData.thicknessMM !== undefined
            ? { thicknessMM: obj.userData.thicknessMM }
            : {}),
          minMM: {
            x: round(box3.min.x * 1000 - demo.baseXMM),
            y: round(box3.min.y * 1000),
            z: round(box3.min.z * 1000),
          },
          maxMM: {
            x: round(box3.max.x * 1000 - demo.baseXMM),
            y: round(box3.max.y * 1000),
            z: round(box3.max.z * 1000),
          },
        });
      }
    });
    found.sort((a, b) => a.minMM.x - b.minMM.x);
    result[name] = found;
  });
  return result;
}

window.__mono = {
  THREE,
  scene,
  camera,
  controls,
  demos,
  buildMonoBlock,
  buildHerdblokOutline,
  checkSupport,
  buildSideCover,
  END_TYPES,
  constants,
  measure,
};
