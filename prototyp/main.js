// main.js — scéna, světla, kamera a přestavba prototypu při změně parametru.
//
// Ladění (tone mapping, environment mapa, světla, podlaha) je záměrně stejné
// jako ve stávající aplikaci — viz js/main.js a js/materials.js v kořeni
// projektu — aby se prototyp dal poctivě porovnat s fotografií i s produktem.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { defaultValues, defaultChoices } from './params.js';
import { buildBlock, disposeGroup, MM_TO_M } from './geometry.js';
import { buildControls } from './controls.js';

const canvas = document.getElementById('three-canvas');
const panelEl = document.getElementById('panel');

// --- renderer ---------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = createBackgroundTexture();

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

// --- světla -----------------------------------------------------------------

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3d42, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(3.5, 5, -2.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);
scene.add(dirLight.target);

const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.35);
fillLight.position.set(-3.5, 2.5, 2.0);
scene.add(fillLight);

// --- podlaha ----------------------------------------------------------------

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ map: createFloorTexture(), roughness: 0.92, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- kamera -----------------------------------------------------------------

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 80);
camera.position.set(2.2, 1.9, -3.1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.6;
controls.maxDistance = 25;
controls.target.set(0, 0.6, 0.4);
controls.update();

// --- stav -------------------------------------------------------------------

const values = defaultValues();
const choices = defaultChoices();

let blockGroup = null;
let rebuildCount = 0;

function rebuild() {
  if (blockGroup) {
    disposeGroup(blockGroup);
    blockGroup = null;
  }
  blockGroup = buildBlock(values, choices);
  blockGroup.scale.setScalar(MM_TO_M); // JEDINÝ převod mm → metry
  scene.add(blockGroup);
  rebuildCount += 1;

  window.PROTO.checks = blockGroup.userData.checks;
  ui.refreshDerived(blockGroup.userData.checks);
  updateInfo();
}

const ui = buildControls(panelEl, values, choices, () => rebuild());

// --- pomocná měření (autoritativní pro ověřování) ---------------------------

/** Rozměry celé skupiny bloku v MILIMETRECH. */
function measure() {
  if (!blockGroup) return null;
  const bb = new THREE.Box3().setFromObject(blockGroup);
  const k = 1 / MM_TO_M;
  return {
    minX: bb.min.x * k, maxX: bb.max.x * k, sizeX: (bb.max.x - bb.min.x) * k,
    minY: bb.min.y * k, maxY: bb.max.y * k, sizeY: (bb.max.y - bb.min.y) * k,
    minZ: bb.min.z * k, maxZ: bb.max.z * k, sizeZ: (bb.max.z - bb.min.z) * k,
  };
}

/**
 * Rozměry SAMOTNÉ pracovní desky v mm — bez navařených lemů kolem výřezů,
 * které mohou podle parametru vystupovat nad její rovinu.
 * maxY téhle krabice je „horní líc pracovní desky", tedy pracovní výška.
 */
function measurePlate() {
  return measureByName(['deska-plech', 'deska-hrana']);
}

/**
 * Rozměry vybraných těles podle jejich jména v mm — autoritativní měřítko
 * pro ověřování (panel vs. deska, svislá deska po boku, boční kryt …).
 * @param {string[]} names
 */
function measureByName(names) {
  if (!blockGroup) return null;
  const want = new Set(names);
  const bb = new THREE.Box3();
  let n = 0;
  blockGroup.traverse((o) => {
    if (o.isMesh && want.has(o.name)) { bb.expandByObject(o); n += 1; }
  });
  if (bb.isEmpty()) return null;
  const k = 1 / MM_TO_M;
  return {
    count: n,
    minX: bb.min.x * k, maxX: bb.max.x * k, sizeX: (bb.max.x - bb.min.x) * k,
    minY: bb.min.y * k, maxY: bb.max.y * k, sizeY: (bb.max.y - bb.min.y) * k,
    minZ: bb.min.z * k, maxZ: bb.max.z * k, sizeZ: (bb.max.z - bb.min.z) * k,
  };
}

function meshStats() {
  let meshes = 0;
  let vertices = 0;
  if (blockGroup) {
    blockGroup.traverse((o) => {
      if (o.isMesh) {
        meshes += 1;
        const pos = o.geometry && o.geometry.getAttribute('position');
        if (pos) vertices += pos.count;
      }
    });
  }
  return { meshes, vertices };
}

const infoEl = document.getElementById('info');
function updateInfo() {
  const m = measure();
  const p = measurePlate();
  const s = meshStats();
  if (!m) return;
  infoEl.textContent =
    `deska ${Math.round(p.sizeX)} × ${Math.round(p.sizeZ)} mm, horní líc ${Math.round(p.maxY)} mm` +
    `  ·  celý blok ${Math.round(m.sizeX)} × ${Math.round(m.sizeZ)} × ${Math.round(m.maxY)} mm` +
    `  ·  ${s.meshes} těles / ${s.vertices} vrcholů  ·  přestaveb: ${rebuildCount}`;
}

// veřejné rozhraní pro ověřování z konzole
window.PROTO = {
  THREE, scene, camera, controls, renderer, values, choices,
  measure, measurePlate, measureByName, meshStats, rebuild,
  get group() { return blockGroup; },
  get rebuildCount() { return rebuildCount; },
  checks: {},
  fitCamera,
};

// --- kamera na míru bloku ---------------------------------------------------

function fitCamera() {
  const m = measure();
  if (!m) return;
  const lengthM = m.sizeX * MM_TO_M;
  const depthM = m.sizeZ * MM_TO_M;
  const cz = (m.minZ + m.maxZ) / 2 * MM_TO_M;
  const fit = Math.max(lengthM, depthM * 1.3) + 1.6;
  // pohled zhruba jako na fotografii: mírně shora zepředu (čelo je na −z)
  camera.position.set(fit * 0.42, fit * 0.40, cz - fit * 0.68);
  controls.target.set(0, m.maxY * MM_TO_M * 0.55, cz);
  controls.update();
}

document.getElementById('fit-btn').addEventListener('click', fitCamera);

// --- smyčka -----------------------------------------------------------------

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

function tick() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

rebuild();
fitCamera();
resize();
tick();

// --- textury pozadí a podlahy (stejné ladění jako js/materials.js) ----------

function createBackgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#eef1f4');
  grad.addColorStop(0.55, '#dfe3e7');
  grad.addColorStop(1, '#c7ccd1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, '#f2efe9');
  grad.addColorStop(1, '#d8d4cb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
