/**
 * ControlBarManager.ts - Gestion centralisée de la barre de contrôle
 *
 * Responsabilité : Gérer la position, rotation et interactions de la barre de contrôle
 */

import * as THREE from "three";
import { PhysicsConstants } from "../physics/PhysicsConstants";
import { CONFIG } from "../config/GlobalConfig";
import type { HandlePositions } from "../types/controls";
import type { Kite } from "../objects/organic/Kite";
import { vector3Pool } from "../utils/Vector3Pool";

export class ControlBarManager {
  private position: THREE.Vector3;
  private rotation: number = 0;
  private angularVelocity: number = 0; // Vitesse angulaire de la barre

  // ✅ Cache pour éviter TOUTES les allocations
  private _tempToKite = new THREE.Vector3();
  private _tempBarDirection = new THREE.Vector3();
  private _tempRotationAxis = new THREE.Vector3();
  private _tempQuaternion = new THREE.Quaternion();
  private _tempHandleLeft = new THREE.Vector3();
  private _tempHandleRight = new THREE.Vector3();
  private _tempCenter = new THREE.Vector3();

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.position = position.clone();
  }

  /**
   * Calcule le quaternion de rotation de la barre (ZÉRO allocation)
   */
  private computeRotationQuaternion(
    toKiteVector: THREE.Vector3
  ): THREE.Quaternion {
    this._tempBarDirection.set(1, 0, 0);
    this._tempRotationAxis
      .crossVectors(this._tempBarDirection, toKiteVector)
      .normalize();

    if (this._tempRotationAxis.length() < PhysicsConstants.CONTROL_DEADZONE) {
      this._tempRotationAxis.set(0, 1, 0);
    }

    return this._tempQuaternion.setFromAxisAngle(this._tempRotationAxis, this.rotation);
  }

  /**
   * Obtient les positions des poignées (ZÉRO allocation)
   */
  getHandlePositions(kitePosition: THREE.Vector3): HandlePositions {
    // Réutiliser _tempToKite pour le calcul de direction
    this._tempToKite.copy(kitePosition).sub(this.position).normalize();
    const rotationQuaternion = this.computeRotationQuaternion(this._tempToKite);

    const halfWidth = CONFIG.controlBar.width / 2;
    this._tempHandleLeft.set(-halfWidth, 0, 0);
    this._tempHandleRight.set(halfWidth, 0, 0);

    this._tempHandleLeft.applyQuaternion(rotationQuaternion);
    this._tempHandleRight.applyQuaternion(rotationQuaternion);

    // Retourner de nouveaux Vector3 seulement ici (unavoidable pour l'API)
    return {
      left: this._tempHandleLeft.clone().add(this.position),
      right: this._tempHandleRight.clone().add(this.position),
    };
  }

  /**
   * Met à jour la rotation de la barre
   */
  setRotation(rotation: number): void {
    this.rotation = rotation;
  }

  /**
   * Met à jour la physique de la barre (retour automatique à l'équilibre)
   */
  update(deltaTime: number): void {
    // Force de rappel vers l'équilibre (ressort)
    const springForce = -this.rotation * CONFIG.controlBar.springConstant;

    // Amortissement pour éviter les oscillations
    const dampingForce = -this.angularVelocity * CONFIG.controlBar.damping;

    // Force totale
    const totalForce = springForce + dampingForce;

    // Intégration physique (F = m*a, donc a = F/m)
    const angularAcceleration = totalForce / CONFIG.controlBar.mass;

    // Mise à jour de la vitesse angulaire
    this.angularVelocity += angularAcceleration * deltaTime;

    // Mise à jour de la rotation
    this.rotation += this.angularVelocity * deltaTime;

    // Petite zone morte pour éviter les micro-mouvements
    if (Math.abs(this.rotation) < CONFIG.controlBar.deadzone) {
      this.rotation = 0;
      this.angularVelocity = 0;
    }
  }

  getRotation(): number {
    return this.rotation;
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  /**
   * Met à jour l'objet 3D visuel de la barre (ZÉRO allocation)
   */
  updateVisual(bar: THREE.Group, kite: Kite): void {
    if (!bar) return;

    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");

    if (ctrlLeft && ctrlRight) {
      // Réutiliser les vecteurs cache
      this._tempHandleLeft.copy(ctrlLeft);
      this._tempHandleRight.copy(ctrlRight);
      kite.localToWorld(this._tempHandleLeft);
      kite.localToWorld(this._tempHandleRight);

      this._tempCenter
        .copy(this._tempHandleLeft)
        .add(this._tempHandleRight)
        .multiplyScalar(0.5);

      this._tempToKite.copy(this._tempCenter).sub(this.position).normalize();

      bar.quaternion.copy(this.computeRotationQuaternion(this._tempToKite));
    }
  }
}
