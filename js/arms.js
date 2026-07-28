// arms.js — napouštěcí ramena: chromový sloupek + otočné výtokové rameno.
// Nezávislý seznam prvků umístěných NA BLOK, nezávisle na segmentech (SPEC v3).
//
// SPEC v3 §2: jednostranný blok má rameno jen u zadní hrany (nastavitelné
// odsazení dopředu od zadní hrany), ostrovní blok má rameno jen ve středu
// (na spáře mezi stranami A/B, nastavitelný posun k jedné či druhé straně).
// Výpočet konkrétní lokální z-pozice a směru dělá block.js (zná hloubky obou
// stran) — zde se jen vykresluje geometrie ramene na zadané (x,z) souřadnici.

import * as THREE from 'three';
import { createChromeMaterial } from './materials.js';

const mm = (v) => v / 1000;

export const ARM_ANGLE_MIN = -90;
export const ARM_ANGLE_MAX = 90;

export const ARM_OFFSET_STEP = 5;

// jednostranný blok — odsazení dopředu od zadní hrany (mm)
export const ARM_BACK_OFFSET_MIN = 0;
export const ARM_BACK_OFFSET_MAX = 200;
export const ARM_BACK_OFFSET_DEFAULT = 60;

// ostrovní blok — posun od středu (spáry mezi stranami) k jedné či druhé straně (mm)
export const ARM_CENTER_OFFSET_MIN = -200;
export const ARM_CENTER_OFFSET_MAX = 200;
export const ARM_CENTER_OFFSET_DEFAULT = 0;

export const ARM_PILLAR_HEIGHT = 0.4; // 400 mm nad deskou
export const ARM_REACH = 0.32; // délka vodorovného ramene
export const ARM_DROP = 0.32; // délka svislého vyústění

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

  // patka na desce
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.01, 24), chrome);
  base.position.set(0, workHeightM + 0.005, 0);
  base.castShadow = true;
  group.add(base);

  // sloupek
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, ARM_PILLAR_HEIGHT, 24),
    chrome
  );
  pillar.position.set(0, workHeightM + ARM_PILLAR_HEIGHT / 2, 0);
  pillar.castShadow = true;
  group.add(pillar);

  // otočné rameno — samostatná skupina, aby šlo natáčet kolem svislé osy
  const pivot = new THREE.Group();
  pivot.position.set(0, workHeightM + ARM_PILLAR_HEIGHT, 0);
  pivot.rotation.y = THREE.MathUtils.degToRad(arm.angleDeg || 0);
  group.add(pivot);

  // vodorovný segment
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, ARM_REACH, 16), chrome);
  seg1.rotation.x = Math.PI / 2;
  seg1.position.set(0, 0, (baseDir * ARM_REACH) / 2);
  seg1.castShadow = true;
  pivot.add(seg1);

  // koleno
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), chrome);
  elbow.position.set(0, 0, baseDir * ARM_REACH);
  elbow.castShadow = true;
  pivot.add(elbow);

  // svislé vyústění (dolů)
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, ARM_DROP, 16), chrome);
  seg2.position.set(0, -ARM_DROP / 2, baseDir * ARM_REACH);
  seg2.castShadow = true;
  pivot.add(seg2);

  // hubice na konci
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.009, 0.03, 16), chrome);
  nozzle.position.set(0, -ARM_DROP - 0.012, baseDir * ARM_REACH);
  nozzle.castShadow = true;
  pivot.add(nozzle);

  return group;
}
