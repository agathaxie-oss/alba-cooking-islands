// arms.js — napouštěcí ramena: chromová baterie typu "pot filler" (deck-mount)
// s otočným výtokovým ramenem, vzhledem/rozměry odpovídající Klarco 1E.2959.
// Nezávislý seznam prvků umístěných NA BLOK, nezávisle na segmentech (SPEC v3).
//
// SPEC v3 §2: jednostranný blok má rameno jen u zadní hrany (nastavitelné
// odsazení dopředu od zadní hrany), ostrovní blok má rameno jen ve středu
// (na spáře mezi stranami A/B, nastavitelný posun k jedné či druhé straně).
// Výpočet konkrétní lokální z-pozice a směru dělá block.js (zná hloubky obou
// stran) — zde se jen vykresluje geometrie ramene na zadané (x,z) souřadnici.
//
// Předloha: Klarco, řada 1E.2959 — jednootvorová páková deck-mount baterie
// (pot filler): stoupačka 120 mm, výška výtokového ramene nad deskou 150 mm,
// délka výtokového ramene 450 mm, montážní otvor Ø 50 mm.

import * as THREE from 'three';
import { createChromeMaterial } from './materials.js';

const mm = (v) => v / 1000;

// Rozsah otočení výtokového ramene kolem svislé osy baterie — celých 360°
// (−180°…+180°) na obě strany od výchozí polohy dané baseDir.
export const ARM_ANGLE_MIN = -180;
export const ARM_ANGLE_MAX = 180;

export const ARM_OFFSET_STEP = 5;

// jednostranný blok — odsazení dopředu od zadní hrany (mm)
export const ARM_BACK_OFFSET_MIN = 0;
export const ARM_BACK_OFFSET_MAX = 200;
export const ARM_BACK_OFFSET_DEFAULT = 60;

// ostrovní blok — posun od středu (spáry mezi stranami) k jedné či druhé straně (mm)
export const ARM_CENTER_OFFSET_MIN = -200;
export const ARM_CENTER_OFFSET_MAX = 200;
export const ARM_CENTER_OFFSET_DEFAULT = 0;

// --- rozměry baterie (dle Klarco 1E.2959) -----------------------------------
export const ARM_RISER_HEIGHT = 0.12; // stoupačka: 120 mm nad deskou
export const ARM_SPOUT_HEIGHT = 0.51; // výška výtokového ramene nad deskou: 510 mm
export const ARM_REACH = 0.45; // délka vodorovného výtokového ramene: 450 mm
export const ARM_DROP = 0.05; // svislé zaústění výtoku (dolů, kvůli odstupu od nádoby)

const ARM_BASE_RADIUS = 0.028; // montážní růžice na desce (Ø ~56 mm)
const ARM_BODY_RADIUS = 0.017; // stoupačka/tělo baterie — o něco silnější než rameno
const ARM_PIPE_RADIUS = 0.011; // trubka výtokového ramene (Ø ~22 mm)
const ARM_ELBOW_RADIUS = 0.015;

/**
 * Vytvoří 3D skupinu jednoho napouštěcího ramene.
 *
 * @param {{id:number, positionXMM:number, angleDeg:number}} arm
 * @param {{lengthMM:number, zLocalMM:number, baseDir:1|-1, workHeightM:number}} blockInfo
 *   zLocalMM — lokální z-pozice ramene v souřadném systému bloku (spočítá
 *   block.js dle varianty a odsazení); baseDir — směr vodorovného ramene
 *   při úhlu 0° (+1/-1 podél z).
 */
export function createArmMesh(arm, blockInfo) {
  const { lengthMM, zLocalMM, baseDir, workHeightM } = blockInfo;
  const chrome = createChromeMaterial();

  const group = new THREE.Group();
  group.userData.armId = arm.id;

  const xLocal = mm(lengthMM) / 2 - mm(arm.positionXMM);
  const zLocal = mm(zLocalMM);
  group.position.set(xLocal, 0, zLocal);

  // montážní růžice na desce (deck-mount, otvor Ø 50 mm)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_BASE_RADIUS, ARM_BASE_RADIUS * 1.05, 0.012, 32),
    chrome
  );
  base.position.set(0, workHeightM + 0.006, 0);
  base.castShadow = true;
  group.add(base);

  // stoupačka (riser, 120 mm) — pevná, nerotuje s ramenem
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_BODY_RADIUS, ARM_BODY_RADIUS, ARM_RISER_HEIGHT, 24),
    chrome
  );
  riser.position.set(0, workHeightM + ARM_RISER_HEIGHT / 2, 0);
  riser.castShadow = true;
  group.add(riser);

  // jednopáková ovládací páka — nasazená na těle baterie, vyhnutá nahoru
  const handleGroup = new THREE.Group();
  handleGroup.position.set(0, workHeightM + ARM_RISER_HEIGHT * 0.62, 0);
  group.add(handleGroup);

  const handleStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.045, 16),
    chrome
  );
  handleStub.rotation.z = Math.PI / 2;
  handleStub.position.set(0.0225, 0, 0);
  handleStub.castShadow = true;
  handleGroup.add(handleStub);

  const handleLever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075, 0.0075, 0.06, 16),
    chrome
  );
  handleLever.rotation.z = THREE.MathUtils.degToRad(-35); // mírně vyhnutá nahoru
  handleLever.position.set(0.045 + 0.014, 0.017, 0);
  handleLever.castShadow = true;
  handleGroup.add(handleLever);

  const handleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 16), chrome);
  handleKnob.position.set(0.045 + 0.028, 0.034, 0);
  handleKnob.castShadow = true;
  handleGroup.add(handleKnob);

  // otočné výtokové rameno — samostatná skupina, aby šlo natáčet o 360°
  // kolem svislé osy baterie (viz ARM_ANGLE_MIN/MAX)
  const pivot = new THREE.Group();
  pivot.position.set(0, workHeightM + ARM_RISER_HEIGHT, 0);
  pivot.rotation.y = THREE.MathUtils.degToRad(arm.angleDeg || 0);
  group.add(pivot);

  // krátký svislý krček ze stoupačky do výšky výtokového ramene (150 mm)
  const neckHeight = ARM_SPOUT_HEIGHT - ARM_RISER_HEIGHT;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_BODY_RADIUS * 0.85, ARM_BODY_RADIUS, neckHeight, 24),
    chrome
  );
  neck.position.set(0, neckHeight / 2, 0);
  neck.castShadow = true;
  pivot.add(neck);

  // koleno u paty ramene
  const rootElbow = new THREE.Mesh(new THREE.SphereGeometry(ARM_ELBOW_RADIUS, 16, 16), chrome);
  rootElbow.position.set(0, neckHeight, 0);
  rootElbow.castShadow = true;
  pivot.add(rootElbow);

  // vodorovný výtokový segment (450 mm)
  const seg1 = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_PIPE_RADIUS, ARM_PIPE_RADIUS, ARM_REACH, 16),
    chrome
  );
  seg1.rotation.x = Math.PI / 2;
  seg1.position.set(0, neckHeight, (baseDir * ARM_REACH) / 2);
  seg1.castShadow = true;
  pivot.add(seg1);

  // koleno na konci ramene
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(ARM_ELBOW_RADIUS, 16, 16), chrome);
  elbow.position.set(0, neckHeight, baseDir * ARM_REACH);
  elbow.castShadow = true;
  pivot.add(elbow);

  // svislé vyústění (dolů, ke konci ramene)
  const seg2 = new THREE.Mesh(
    new THREE.CylinderGeometry(ARM_PIPE_RADIUS * 0.85, ARM_PIPE_RADIUS * 0.85, ARM_DROP, 16),
    chrome
  );
  seg2.position.set(0, neckHeight - ARM_DROP / 2, baseDir * ARM_REACH);
  seg2.castShadow = true;
  pivot.add(seg2);

  // hubice (výtok) na konci
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.009, 0.03, 16),
    chrome
  );
  nozzle.position.set(0, neckHeight - ARM_DROP - 0.012, baseDir * ARM_REACH);
  nozzle.castShadow = true;
  pivot.add(nozzle);

  return group;
}
