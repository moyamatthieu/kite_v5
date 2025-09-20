/**
 * LineSystem.ts - Gestion des lignes et contraintes
 *
 * Responsabilité : Calculer les tensions et forces des lignes de contrôle
 */

import * as THREE from 'three';
import { PhysicsConstants } from './PhysicsConstants';
import { CONFIG } from '../config/GlobalConfig';
import type { Kite } from '../objects/organic/Kite';

export class LineSystem {
  public lineLength: number;

  constructor(lineLength: number = CONFIG.lines.defaultLength) {
    this.lineLength = lineLength;
  }

  /**
   * Calcule comment les lignes tirent sur le cerf-volant
   *
   * PRINCIPE DE BASE :
   * Les lignes sont comme des cordes : elles peuvent tirer mais pas pousser
   * - Ligne tendue = elle tire sur le kite
   * - Ligne molle = aucune force
   *
   * COMMENT LA BARRE CONTRÔLE :
   * Quand vous tournez la barre :
   * - Rotation à gauche = main gauche recule, main droite avance
   * - La ligne gauche se raccourcit, la droite s'allonge
   * - Le côté gauche du kite est tiré, il se rapproche
   * - Cette asymétrie fait tourner le kite !
   */
  calculateLineTensions(
    kite: Kite,
    controlRotation: number,
    pilotPosition: THREE.Vector3
  ): {
    leftForce: THREE.Vector3;
    rightForce: THREE.Vector3;
    torque: THREE.Vector3;
  } {
    // Points d'attache des lignes sur le kite (depuis la géométrie réelle)
    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) {
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3(),
      };
    }
    const leftAttach = ctrlLeft.clone();
    const rightAttach = ctrlRight.clone();

    // Transformer en coordonnées monde
    const leftWorld = leftAttach
      .clone()
      .applyQuaternion(kite.quaternion)
      .add(kite.position);
    const rightWorld = rightAttach
      .clone()
      .applyQuaternion(kite.quaternion)
      .add(kite.position);

    // On calcule où sont exactement les mains du pilote
    // Imaginez que vous tenez une barre de 60cm de large
    const barHalfWidth = CONFIG.controlBar.width * 0.5; // 30cm de chaque côté
    const barRight = new THREE.Vector3(1, 0, 0);

    // Quand vous tournez la barre (comme un guidon de vélo) :
    // - Tourner à gauche = votre main gauche recule, la droite avance
    // - Tourner à droite = votre main droite recule, la gauche avance
    const leftHandleOffset = barRight
      .clone()
      .multiplyScalar(-barHalfWidth)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), controlRotation);
    const rightHandleOffset = barRight
      .clone()
      .multiplyScalar(barHalfWidth)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), controlRotation);

    const leftHandlePos = pilotPosition.clone().add(leftHandleOffset);
    const rightHandlePos = pilotPosition.clone().add(rightHandleOffset);

    // Vecteurs ligne : du kite vers le pilote
    const leftDistance = leftWorld.distanceTo(leftHandlePos);
    const rightDistance = rightWorld.distanceTo(rightHandlePos);

    const leftLineDir = leftHandlePos.clone().sub(leftWorld).normalize();
    const rightLineDir = rightHandlePos.clone().sub(rightWorld).normalize();

    // PRINCIPE CLÉ : Les lignes sont des CORDES, pas des ressorts!
    // - Ligne molle (distance < longueur) = AUCUNE force
    // - Ligne tendue (distance > longueur) = Force proportionnelle
    let leftForce = new THREE.Vector3();
    let rightForce = new THREE.Vector3();

    // Ligne gauche : F = k × extension (Hooke pour corde rigide)
    if (leftDistance > this.lineLength) {
      const extension = leftDistance - this.lineLength; // Étirement en mètres
      const tension = Math.min(
        CONFIG.lines.stiffness * extension,
        CONFIG.lines.maxTension
      );
      leftForce = leftLineDir.multiplyScalar(tension); // Force vers le pilote
    }

    // Ligne droite : même physique
    if (rightDistance > this.lineLength) {
      const extension = rightDistance - this.lineLength;
      const tension = Math.min(
        CONFIG.lines.stiffness * extension,
        CONFIG.lines.maxTension
      );
      rightForce = rightLineDir.multiplyScalar(tension);
    }

    // COUPLE ÉMERGENT : Résulte de l'asymétrie des tensions
    // Si ligne gauche tire plus fort → rotation horaire
    // Si ligne droite tire plus fort → rotation anti-horaire
    let totalTorque = new THREE.Vector3();

    // Couple ligne gauche (si tendue)
    if (leftForce.length() > 0) {
      const leftTorque = new THREE.Vector3().crossVectors(
        leftAttach.clone().applyQuaternion(kite.quaternion), // Bras de levier
        leftForce // Force appliquée
      );
      totalTorque.add(leftTorque);
    }

    // Couple ligne droite (si tendue)
    if (rightForce.length() > 0) {
      const rightTorque = new THREE.Vector3().crossVectors(
        rightAttach.clone().applyQuaternion(kite.quaternion),
        rightForce
      );
      totalTorque.add(rightTorque);
    }

    return {
      leftForce,
      rightForce,
      torque: totalTorque,
    };
  }

  /**
   * Calcule les points d'une caténaire pour l'affichage des lignes
   */
  calculateCatenary(
    start: THREE.Vector3,
    end: THREE.Vector3,
    segments: number = PhysicsConstants.CATENARY_SEGMENTS
  ): THREE.Vector3[] {
    const directDistance = start.distanceTo(end);

    if (directDistance >= this.lineLength) {
      return [start, end];
    }

    const points: THREE.Vector3[] = [];
    const slack = this.lineLength - directDistance;
    const sag = slack * CONFIG.lines.maxSag;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      point.y -= CONFIG.lines.catenarySagFactor * sag * t * (1 - t);
      points.push(point);
    }

    return points;
  }

  setLineLength(length: number): void {
    this.lineLength = length;
  }
}