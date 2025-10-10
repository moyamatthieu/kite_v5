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
   * Calcule le quaternion de rotation de la barre basé sur l'axe des lignes
   * La barre s'oriente naturellement selon l'axe entre les deux points de contrôle du kite
   */
  private computeRotationQuaternion(
    kiteLeftWorld: THREE.Vector3,
    kiteRightWorld: THREE.Vector3
  ): THREE.Quaternion {
    // Axe naturel de la barre = axe entre les deux points de contrôle du kite
    const kiteAxis = new THREE.Vector3()
      .subVectors(kiteRightWorld, kiteLeftWorld)
      .normalize();

    // Direction initiale de la barre (axe X local)
    const barDirection = new THREE.Vector3(1, 0, 0);

    // Calculer la rotation nécessaire pour aligner la barre avec l'axe du kite
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      barDirection,
      kiteAxis
    );

    // Appliquer la rotation de l'input utilisateur autour de l'axe vertical (Y)
    const userRotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.rotation
    );

    // Combiner : rotation naturelle + rotation utilisateur
    return quaternion.multiply(userRotation);
  }

  /**
   * Obtient les positions des poignées (méthode unique centralisée)
   */
  getHandlePositions(kite: Kite): HandlePositions {
    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) {
      // Fallback : orientation par défaut si points indisponibles
      const halfWidth = CONFIG.controlBar.width / 2;
      return {
        left: this.position.clone().add(new THREE.Vector3(-halfWidth, 0, 0)),
        right: this.position.clone().add(new THREE.Vector3(halfWidth, 0, 0)),
      };
    }

    const kiteLeftWorld = kite.toWorldCoordinates(ctrlLeft);
    const kiteRightWorld = kite.toWorldCoordinates(ctrlRight);
    const rotationQuaternion = this.computeRotationQuaternion(kiteLeftWorld, kiteRightWorld);

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

      bar.quaternion.copy(this.computeRotationQuaternion(kiteLeftWorld, kiteRightWorld));
    }
  }
}