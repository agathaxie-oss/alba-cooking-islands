// viewer.js — kamera, OrbitControls, přednastavené pohledy a výběr modulu
// kliknutím (raycaster).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Vytvoří perspektivní kameru s výchozí pozicí. */
export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 60);
  // Segmenty mají čelo (panely/dvířka/otevřené podestavby) na straně −z
  // (viz modules.js), proto výchozí kamera musí být na záporné straně z,
  // jinak se dívá na zadní (hladkou) stranu bloku.
  camera.position.set(2.6, 2.0, -3.0);
  return camera;
}

/**
 * Vytvoří OrbitControls s ovládáním myší uzpůsobeným tak, aby levé tlačítko
 * zůstalo volné pro výběr modulu kliknutím (raycaster):
 *   levé tlačítko  — výběr modulu (žádná akce kamery)
 *   střední tlačítko / kolečko — rotace pohledu
 *   pravé tlačítko — posun (pan)
 *   scroll kolečka — zoom
 */
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, 0.5, 0.4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495; // nedovolí kameru pod podlahu
  controls.minDistance = 0.8;
  controls.maxDistance = 15;

  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  controls.update();
  return controls;
}

/**
 * Vypočítá tři přednastavené pohledy (perspektiva, čelní, shora) tak, aby
 * se do záběru vešel celý blok bez ohledu na jeho aktuální délku a hloubku.
 *
 * @param {number} lengthM celková délka bloku v metrech
 * @param {number} depthM celková hloubka bloku v metrech
 */
export function computeViews(lengthM, depthM) {
  const cz = depthM / 2;
  const fit = Math.max(lengthM, depthM * 1.3) + 1.6;

  // Segmenty mají čelo (ovládací panely, dvířka, otevřené podestavby) na
  // straně −z (viz modules.js — korpus jde od z=0 do z=+hloubka, čelní
  // prvky trčí do z<0). Pohledy „perspektiva" a „čelní" proto musí být na
  // záporné straně z, jinak je vidět jen hladká zadní stěna bloku. Cíl
  // (target) zůstává ve středu bloku (cz), jen kamera se dívá odjinud.
  return {
    perspective: {
      position: [fit * 0.5, fit * 0.42, cz - fit * 0.62],
      target: [0, 0.5, cz],
    },
    front: {
      position: [0, 1.0, cz - fit],
      target: [0, 0.9, cz],
    },
    top: {
      position: [0, fit * 1.35, cz + 0.001],
      target: [0, 0, cz],
    },
  };
}

/** Okamžitě nastaví kameru a cíl OrbitControls dle definice pohledu. */
export function applyView(camera, controls, viewDef) {
  camera.position.set(...viewDef.position);
  controls.target.set(...viewDef.target);
  controls.update();
}

/**
 * Vrátí kořenovou skupinu modulu (obsahující userData.id), na který ukazuje
 * raycaster, nebo null, pokud nic netrefil.
 */
export function pickModuleAt(raycaster, blockGroup) {
  if (!blockGroup) return null;
  const intersects = raycaster.intersectObject(blockGroup, true);
  if (intersects.length === 0) return null;

  let obj = intersects[0].object;
  while (obj && obj.userData.id === undefined) {
    obj = obj.parent;
  }
  return obj || null;
}

/** Vytvoří raycaster a pomocnou funkci pro přepočet kliknutí na NDC souřadnice. */
export function createRaycaster() {
  return new THREE.Raycaster();
}

/** Přepočte pozici myši/dotyku v pixelech na normalizované souřadnice zařízení (-1..1). */
export function toNDC(clientX, clientY, domElement) {
  const rect = domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
}
