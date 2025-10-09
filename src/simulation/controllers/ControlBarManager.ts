/**
 * ControlBarManager.ts - Gestionnaire de la barre de contrôle pour la simulation Kite
 *
 * Rôle :
 *   - Gère la position et l'orientation de la barre de contrôle du cerf-volant
 *   - Calcule les positions des poignées et la rotation de la barre
 *   - Sert d'interface entre le pilote et le système de lignes
 *
 * Dépendances principales :
 *   - Kite.ts : Modèle 3D du cerf-volant
 *   - PhysicsConstants.ts, SimulationConfig.ts : Paramètres et limites physiques
 *   - Types : HandlePositions pour typer les poignées
 *   - Three.js : Pour la géométrie et le calcul
 *
 * Relation avec les fichiers adjacents :
 *   - Utilisé par KiteController et PhysicsEngine pour manipuler la barre et les lignes
 *   - Interagit avec LineSystem pour la gestion des tensions
 *
 * Utilisation typique :
 *   - Instancié au démarrage, appelé à chaque frame pour mettre à jour la position des poignées
 *   - Sert à la visualisation et au contrôle du kite
 *
 * Voir aussi :
 *   - src/objects/organic/Kite.ts
 *   - src/simulation/controllers/KiteController.ts
 *   - src/simulation/physics/LineSystem.ts
 */
import * as THREE from "three";

import { Kite } from "../../objects/Kite";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";
import { HandlePositions } from "../types";

/**
 * Gestionnaire de la barre de contrôle
 *
 * Gère la position et l'orientation de la barre de contrôle du cerf-volant
 */
export class ControlBarManager {
  private position: THREE.Vector3;
  private rotation: number = 0;

  constructor(position: THREE.Vector3 = CONFIG.controlBar.position) {
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
      const kiteLeftWorld = kite.toWorldCoordinates(ctrlLeft);
      const kiteRightWorld = kite.toWorldCoordinates(ctrlRight);

      const centerKite = kiteLeftWorld
        .clone()
        .add(kiteRightWorld)
        .multiplyScalar(0.5);
      const toKiteVector = centerKite.clone().sub(this.position).normalize();

      bar.quaternion.copy(this.computeRotationQuaternion(toKiteVector));
    }
  }
}