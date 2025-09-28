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

  // ✅ Cache pour éviter TOUTES les allocations
  private _leftAttachCache = new THREE.Vector3();
  private _rightAttachCache = new THREE.Vector3();
  private _leftWorldCache = new THREE.Vector3();
  private _rightWorldCache = new THREE.Vector3();
  private _leftHandlePosCache = new THREE.Vector3();
  private _rightHandlePosCache = new THREE.Vector3();
  private _leftToHandleCache = new THREE.Vector3();
  private _rightToHandleCache = new THREE.Vector3();
  private _centerAttachCache = new THREE.Vector3();
  private _leftForceCache = new THREE.Vector3();
  private _rightForceCache = new THREE.Vector3();
  private _torqueCache = new THREE.Vector3();
  private _zeroForces = {
    leftForce: new THREE.Vector3(),
    rightForce: new THREE.Vector3(),
    torque: new THREE.Vector3(),
  };
  private _yAxis = new THREE.Vector3(0, 1, 0); // Statique pour applyAxisAngle

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
      return this._zeroForces;
    }

    // ✅ Réutiliser cache au lieu de clone()
    this._leftAttachCache.copy(ctrlLeft);
    this._rightAttachCache.copy(ctrlRight);

    // Transformer en coordonnées monde (ZÉRO allocation)
    this._leftWorldCache
      .copy(this._leftAttachCache)
      .applyQuaternion(kite.quaternion)
      .add(kite.position);
    this._rightWorldCache
      .copy(this._rightAttachCache)
      .applyQuaternion(kite.quaternion)
      .add(kite.position);

    // On calcule où sont exactement les mains du pilote (ZÉRO allocation)
    const barHalfWidth = CONFIG.controlBar.width * 0.5; // 30cm de chaque côté

    // Réutiliser leftToHandleCache et rightToHandleCache pour les offsets (ZÉRO allocation)
    this._leftToHandleCache
      .set(-barHalfWidth, 0, 0)
      .applyAxisAngle(this._yAxis, controlRotation);
    this._rightToHandleCache
      .set(barHalfWidth, 0, 0)
      .applyAxisAngle(this._yAxis, controlRotation);

    this._leftHandlePosCache.copy(pilotPosition).add(this._leftToHandleCache);
    this._rightHandlePosCache.copy(pilotPosition).add(this._rightToHandleCache);

    // Vecteurs ligne : du kite vers le pilote (utilise cache)
    const leftDistance = this._leftWorldCache.distanceTo(this._leftHandlePosCache);
    const rightDistance = this._rightWorldCache.distanceTo(this._rightHandlePosCache);

    // Réutiliser leftToHandleCache et rightToHandleCache pour directions
    this._leftToHandleCache.copy(this._leftHandlePosCache).sub(this._leftWorldCache).normalize();
    this._rightToHandleCache.copy(this._rightHandlePosCache).sub(this._rightWorldCache).normalize();

    // PRINCIPE CLÉ : Les lignes sont des CORDES, pas des ressorts!
    // Réutiliser les caches de forces
    this._leftForceCache.set(0, 0, 0);
    this._rightForceCache.set(0, 0, 0);

    // Ligne gauche : F = k × extension (Hooke pour corde rigide)
    if (leftDistance > this.lineLength) {
      const extension = leftDistance - this.lineLength; // Étirement en mètres
      const tension = Math.min(
        CONFIG.lines.stiffness * extension,
        CONFIG.lines.maxTension
      );
      this._leftForceCache.copy(this._leftToHandleCache).multiplyScalar(tension);
    }

    // Ligne droite : même physique
    if (rightDistance > this.lineLength) {
      const extension = rightDistance - this.lineLength;
      const tension = Math.min(
        CONFIG.lines.stiffness * extension,
        CONFIG.lines.maxTension
      );
      this._rightForceCache.copy(this._rightToHandleCache).multiplyScalar(tension);
    }

    // COUPLE ÉMERGENT : Résulte de l'asymétrie des tensions (ZÉRO allocation)
    this._torqueCache.set(0, 0, 0);

    // Couple ligne gauche (si tendue)
    if (this._leftForceCache.length() > 0) {
      // Réutiliser centerAttachCache pour bras de levier
      this._centerAttachCache.copy(this._leftAttachCache).applyQuaternion(kite.quaternion);
      // Réutiliser leftHandlePosCache temporairement pour crossVector
      this._leftHandlePosCache.crossVectors(this._centerAttachCache, this._leftForceCache);
      this._torqueCache.add(this._leftHandlePosCache);
    }

    // Couple ligne droite (si tendue)
    if (this._rightForceCache.length() > 0) {
      this._centerAttachCache.copy(this._rightAttachCache).applyQuaternion(kite.quaternion);
      this._rightHandlePosCache.crossVectors(this._centerAttachCache, this._rightForceCache);
      this._torqueCache.add(this._rightHandlePosCache);
    }

    return {
      leftForce: this._leftForceCache,
      rightForce: this._rightForceCache,
      torque: this._torqueCache,
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