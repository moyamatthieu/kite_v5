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

export class ControlBarManager {
  private position: THREE.Vector3;
  private rotation: number = 0;
  private angularVelocity: number = 0; // Vitesse angulaire de la barre

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.position = position.clone();
  }

  /**
   * Calcule le quaternion de rotation de la barre
   */
  private computeRotationQuaternion(
    toKiteVector: THREE.Vector3
  ): THREE.Quaternion {
    const barDirection = new THREE.Vector3(1, 0, 0);
    const rotationAxis = new THREE.Vector3()
      .crossVectors(barDirection, toKiteVector)
      .normalize();

    if (rotationAxis.length() < PhysicsConstants.CONTROL_DEADZONE) {
      rotationAxis.set(0, 1, 0);
    }

    return new THREE.Quaternion().setFromAxisAngle(rotationAxis, this.rotation);
  }

  /**
   * Obtient les positions des poignées (méthode unique centralisée)
   */
  getHandlePositions(kitePosition: THREE.Vector3): HandlePositions {
    const toKiteVector = kitePosition.clone().sub(this.position).normalize();
    const rotationQuaternion = this.computeRotationQuaternion(toKiteVector);

    const halfWidth = CONFIG.controlBar.width / 2;
    const handleLeftLocal = new THREE.Vector3(-halfWidth, 0, 0);
    const handleRightLocal = new THREE.Vector3(halfWidth, 0, 0);

    handleLeftLocal.applyQuaternion(rotationQuaternion);
    handleRightLocal.applyQuaternion(rotationQuaternion);

    return {
      left: handleLeftLocal.clone().add(this.position),
      right: handleRightLocal.clone().add(this.position),
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
   * Met à jour l'objet 3D visuel de la barre
   */
  updateVisual(bar: THREE.Group, kite: Kite): void {
    if (!bar) return;

    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");

    if (ctrlLeft && ctrlRight) {
      const kiteLeftWorld = ctrlLeft.clone();
      const kiteRightWorld = ctrlRight.clone();
      kite.localToWorld(kiteLeftWorld);
      kite.localToWorld(kiteRightWorld);

      const centerKite = kiteLeftWorld
        .clone()
        .add(kiteRightWorld)
        .multiplyScalar(0.5);
      const toKiteVector = centerKite.clone().sub(this.position).normalize();

      bar.quaternion.copy(this.computeRotationQuaternion(toKiteVector));
    }
  }
}
