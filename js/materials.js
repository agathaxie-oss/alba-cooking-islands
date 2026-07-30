// materials.js — definice materiálů (nerez, plast, sklo...), prostředí (envmapy)
// a pomocné textury (gradientní pozadí, kruhová podlaha) pro jasnější,
// technicky čitelnou grafiku (SPEC v2).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Materiály se vytvářejí jen jednou (lazy singletony) a sdílí se mezi všemi
// segmenty — stejný povrch tak vypadá všude stejně a šetří se paměť/draw-cally.
let _stainless = null;
let _panel = null;
let _plinth = null;
let _knob = null;
let _button = null;
let _switch = null;
let _castIron = null;
let _glassCeramic = null;
let _glass = null;
let _recess = null;
let _cavity = null;
let _sinkCavity = null;
let _floorLight = null;
let _floorDark = null;
let _edge = null;
let _chrome = null;
let _logo = null;

export const ENV_MAP_INTENSITY = 1.2;

/**
 * Vytvoří environment mapu (PMREM z RoomEnvironment) a nastaví ji jako
 * scene.environment — nerezové materiály pak mají realistické odlesky
 * i bez složitého nasvícení scény.
 */
export function setupEnvironment(renderer, scene) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRenderTarget.texture;
  pmremGenerator.dispose();
}

/** Hlavní (světlejší) nerezový materiál korpusů a pracovní desky. */
export function createStainlessMaterial() {
  if (!_stainless) {
    _stainless = new THREE.MeshStandardMaterial({
      color: 0xd8dcdf,
      metalness: 0.9,
      roughness: 0.28,
      envMapIntensity: ENV_MAP_INTENSITY,
      name: 'nerez',
    });
  }
  return _stainless;
}

/** Nerez ovládacího panelu — o odstín tmavší než korpus, ať jsou plochy rozlišené. */
export function createPanelMaterial() {
  if (!_panel) {
    _panel = new THREE.MeshStandardMaterial({
      color: 0xb9bfc4,
      metalness: 0.85,
      roughness: 0.32,
      envMapIntensity: ENV_MAP_INTENSITY,
      name: 'panel',
    });
  }
  return _panel;
}

/** Grafitový sokl (podstavba) segmentů. */
export function createPlinthMaterial() {
  if (!_plinth) {
    _plinth = new THREE.MeshStandardMaterial({
      color: 0x33363b,
      metalness: 0.6,
      roughness: 0.55,
      envMapIntensity: 0.6,
      name: 'sokl',
    });
  }
  return _plinth;
}

/** Černý ovládací knoflík. */
export function createKnobMaterial() {
  if (!_knob) {
    _knob = new THREE.MeshStandardMaterial({
      color: 0x101010,
      metalness: 0.3,
      roughness: 0.55,
      name: 'knoflik',
    });
  }
  return _knob;
}

/** Malý barevný válec — tlačítko. */
export function createButtonMaterial() {
  if (!_button) {
    _button = new THREE.MeshStandardMaterial({
      color: 0xc1442b,
      metalness: 0.2,
      roughness: 0.4,
      name: 'tlacitko',
    });
  }
  return _button;
}

/** Páčkový přepínač. */
export function createSwitchMaterial() {
  if (!_switch) {
    _switch = new THREE.MeshStandardMaterial({
      color: 0xe4e6e8,
      metalness: 0.6,
      roughness: 0.3,
      name: 'prepinac',
    });
  }
  return _switch;
}

/** Chromový sloupek napouštěcího ramene. */
export function createChromeMaterial() {
  if (!_chrome) {
    _chrome = new THREE.MeshStandardMaterial({
      color: 0xe9ecef,
      metalness: 1.0,
      roughness: 0.12,
      envMapIntensity: ENV_MAP_INTENSITY,
      name: 'chrom',
    });
  }
  return _chrome;
}

/** Litina hořáků plynového sporáku. */
export function createCastIronMaterial() {
  if (!_castIron) {
    _castIron = new THREE.MeshStandardMaterial({
      color: 0x1c1c1c,
      metalness: 0.4,
      roughness: 0.8,
      name: 'litina',
    });
  }
  return _castIron;
}

/** Tmavá sklokeramická deska elektrického sporáku / gril. */
export function createGlassCeramicMaterial() {
  if (!_glassCeramic) {
    _glassCeramic = new THREE.MeshStandardMaterial({
      color: 0x111114,
      metalness: 0.2,
      roughness: 0.12,
      name: 'sklokeramika',
    });
  }
  return _glassCeramic;
}

/** Poloprůhledné sklo víka fritézy / multifunkční pánve. */
export function createGlassMaterial() {
  if (!_glass) {
    _glass = new THREE.MeshPhysicalMaterial({
      color: 0xcfe3ec,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.8,
      transparent: true,
      opacity: 0.55,
      ior: 1.45,
      name: 'sklo',
    });
  }
  return _glass;
}

/** Tmavý nerez pro zapuštěné vany (dřez, vodní lázeň, fritéza). */
export function createRecessMaterial() {
  if (!_recess) {
    _recess = new THREE.MeshStandardMaterial({
      color: 0x2b2d30,
      metalness: 0.75,
      roughness: 0.4,
      name: 'vana',
    });
  }
  return _recess;
}

/** Tmavý vnitřek otevřené podestavby (dutina za policí). */
export function createCavityMaterial() {
  if (!_cavity) {
    _cavity = new THREE.MeshStandardMaterial({
      color: 0x565b60,
      metalness: 0.1,
      roughness: 0.95,
      emissive: 0x1c1e20,
      side: THREE.BackSide,
      name: 'dutina',
    });
  }
  return _cavity;
}

/**
 * Vnitřek zapuštěné vany dřezu — stejný princip jako `createCavityMaterial`
 * (side: THREE.BackSide zobrazí jen "vzdálenější" stěny, takže vana
 * vypadá jako skutečná dutina, ne jako plochá deska), ale v tmavším
 * nerezovém odstínu odpovídajícím lisované nerezové vaně.
 */
export function createSinkCavityMaterial() {
  if (!_sinkCavity) {
    _sinkCavity = new THREE.MeshStandardMaterial({
      color: 0x3a3d40,
      metalness: 0.8,
      roughness: 0.35,
      side: THREE.BackSide,
      name: 'vana-dutina',
    });
  }
  return _sinkCavity;
}

/** Materiál obrysových hran (EdgesGeometry) — technický, čitelný vzhled. */
export function createEdgeMaterial() {
  if (!_edge) {
    _edge = new THREE.LineBasicMaterial({
      color: 0x2a2e33,
      transparent: true,
      opacity: 0.35,
    });
  }
  return _edge;
}

/**
 * Materiál s logem ALBA — singleton sdílený všemi výskyty (velké logo na
 * bočních plechách i malé "samolepky" na panelech), textura se načte jednou
 * a po dohrání se doplní do sdíleného materiálu (§6 SPEC).
 */
export function createLogoMaterial() {
  if (!_logo) {
    _logo = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.05,
      roughness: 0.5,
      name: 'logo-alba',
    });
    const loader = new THREE.TextureLoader();
    loader.load('Logo-ALBA.jpg', (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      _logo.map = texture;
      _logo.needsUpdate = true;
    });
  }
  return _logo;
}

/**
 * Vytvoří jednorázový (ne singleton) materiál pro bitmapu vlastního modulu —
 * je unikátní na segment, proto je označen jako `disposable`, aby ho šlo při
 * přestavbě scény bezpečně uvolnit z paměti (spolu s texturou).
 */
export function createBitmapMaterial(texture) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    metalness: 0.05,
    roughness: 0.6,
    name: 'bitmapa',
  });
  material.userData.disposable = true;
  return material;
}

/**
 * Načte obrázek z dataURL jako THREE.Texture se správným colorSpace a
 * zavolá callback po dokončení (texture.needsUpdate se nastaví automaticky
 * přes TextureLoader, ale nastavujeme i material.needsUpdate v callbacku).
 */
export function loadBitmapTexture(dataURL, onLoad) {
  const loader = new THREE.TextureLoader();
  loader.load(dataURL, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    if (onLoad) onLoad(texture);
  });
}

/** Vytvoří vertikální gradientní texturu pro pozadí scény. */
export function createBackgroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#eef1f4');
  gradient.addColorStop(0.55, '#dfe3e7');
  gradient.addColorStop(1, '#c7ccd1');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Vytvoří kruhovou texturu s jemným radiálním přechodem pro podlahu. */
function createRadialFloorCanvas(centerHex, edgeHex) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.05,
    size / 2, size / 2, size * 0.5
  );
  gradient.addColorStop(0, centerHex);
  gradient.addColorStop(1, edgeHex);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Materiál podlahy — přepínatelná světlá / tmavá varianta, jemný kruhový přechod. */
export function createFloorMaterial(dark = false) {
  if (dark) {
    if (!_floorDark) {
      _floorDark = new THREE.MeshStandardMaterial({
        map: createRadialFloorCanvas('#34373c', '#1a1c1f'),
        roughness: 0.9,
        metalness: 0.0,
        name: 'podlaha-tmava',
      });
    }
    return _floorDark;
  }
  if (!_floorLight) {
    _floorLight = new THREE.MeshStandardMaterial({
      map: createRadialFloorCanvas('#f2efe9', '#d8d4cb'),
      roughness: 0.92,
      metalness: 0.0,
      name: 'podlaha-svetla',
    });
  }
  return _floorLight;
}
