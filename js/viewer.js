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
    // pohledy zrcadlené přes střed bloku — pro pohled na druhou stranu
    // ostrovního bloku (varianta 'island'), viz přepínač strany A/B v liště.
    perspectiveB: {
      position: [-fit * 0.5, fit * 0.42, cz + fit * 0.62],
      target: [0, 0.5, cz],
    },
    front: {
      position: [0, 1.0, cz - fit],
      target: [0, 0.9, cz],
    },
    backB: {
      position: [0, 1.0, cz + fit],
      target: [0, 0.9, cz],
    },
    top: {
      position: [0, fit * 1.35, cz + 0.001],
      target: [0, 0, cz],
    },
    // pohled shora otočený o 180° — pro stranu B ostrovního bloku (viz
    // přepínač strany v liště, selectViewDef v main.js). Liší se od `top`
    // jen znaménkem drobného posunu +/-0.001, který určuje, která strana
    // bloku bude na obrazovce nahoře.
    topB: {
      position: [0, fit * 1.35, cz - 0.001],
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

// --- plynulý přechod (oblet) mezi přednastavenými pohledy --------------------
// §ZMĚNA 5 — na rozdíl od applyView() kamera neskáče, ale opíše oblouk po
// kouli kolem cílového bodu (interpolace sférických souřadnic vůči targetu),
// takže přepnutí pohledu/strany působí jako plynulý oblet bloku, ne jako
// zoom pryč a zpátky.

let viewAnimFrame = null;

/** Normalizuje rozdíl úhlů do intervalu (−π, π], ať se azimut interpoluje
 *  po kratší cestě (kamera neobletí blok zbytečně dokola). */
function normalizeAngleDelta(delta) {
  let d = delta % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Plynule přesune kameru a cíl OrbitControls na novou definici pohledu.
 * Kamera opisuje oblouk po kouli kolem (lineárně interpolovaného) cíle —
 * viz theta/phi/r interpolace níže — místo přímočarého skoku/couvnutí.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
 * @param {{position:number[], target:number[]}} viewDef
 * @param {number} [ms=600] délka animace v milisekundách
 */
export function animateView(camera, controls, viewDef, ms = 600) {
  // běží-li už předchozí animace, zrušit ji, ať se nepere o kameru s novou
  if (viewAnimFrame !== null) {
    cancelAnimationFrame(viewAnimFrame);
    viewAnimFrame = null;
  }

  const fromTarget = controls.target.clone();
  const toTarget = new THREE.Vector3(...viewDef.target);
  const toPos = new THREE.Vector3(...viewDef.position);

  const fromSpherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(fromTarget));
  const toSpherical = new THREE.Spherical().setFromVector3(toPos.clone().sub(toTarget));
  const deltaTheta = normalizeAngleDelta(toSpherical.theta - fromSpherical.theta);
  const deltaPhi = toSpherical.phi - fromSpherical.phi;
  const deltaRadius = toSpherical.radius - fromSpherical.radius;

  controls.enabled = false;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / ms, 1);
    // ease-in-out (zrychlení na začátku, zpomalení na konci)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const spherical = new THREE.Spherical(
      fromSpherical.radius + deltaRadius * eased,
      fromSpherical.phi + deltaPhi * eased,
      fromSpherical.theta + deltaTheta * eased
    );
    const curTarget = new THREE.Vector3().lerpVectors(fromTarget, toTarget, eased);
    const curPos = new THREE.Vector3().setFromSpherical(spherical).add(curTarget);

    camera.position.copy(curPos);
    controls.target.copy(curTarget);
    controls.update();

    if (t < 1) {
      viewAnimFrame = requestAnimationFrame(step);
    } else {
      viewAnimFrame = null;
      controls.enabled = true;
    }
  }

  viewAnimFrame = requestAnimationFrame(step);
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
