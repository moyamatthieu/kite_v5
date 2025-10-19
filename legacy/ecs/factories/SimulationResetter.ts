/**
 * SimulationResetter.ts - Utilitaire pour reset de simulation
 *
 * Encapsule logique de reset complet de la simulation
 */

import * as THREE from "three";
import { Logger } from "@utils/Logging";
import { MathUtils } from "@utils/MathUtils";
import { EntityManager } from "@entities";
import { TransformComponent } from "@components/TransformComponent";
import { MeshComponent } from "@components/MeshComponent";
import { InputSystem, ControlBarSystem, KitePhysicsSystem } from "@systems";
import { CONFIG } from "@config/SimulationConfig";

/**
 * Dépendances pour le resetter
 */
export interface ResetterDependencies {
  logger: Logger;
  entityManager: EntityManager;
  inputSystem: InputSystem;
  controlBarSystem: ControlBarSystem;
  kitePhysicsSystem: KitePhysicsSystem | null;
}

/**
 * Utilitaire pour reset complet de la simulation
 */
export class SimulationResetter {
  /**
   * Réinitialise complètement la simulation
   *
   * @param deps - Dépendances
   * @param isRunning - État d'exécution avant reset
   * @returns true si reset a réussi
   */
  static reset(deps: ResetterDependencies, isRunning: boolean): boolean {
    const { logger, entityManager, inputSystem, controlBarSystem, kitePhysicsSystem } = deps;

    logger.info("🔄 Resetting simulation...", "SimulationResetter");

    // Arrêter temporairement pour éviter les mises à jour pendant le reset
    let running = isRunning;
    if (running) {
      running = false;
    }

    // Reset systems
    inputSystem.reset();
    controlBarSystem.reset();
    kitePhysicsSystem?.reset();

    // Reset kite position
    const success = SimulationResetter.resetKitePosition(entityManager);

    if (!success) {
      logger.error("Failed to reset kite position", "SimulationResetter");
      return false;
    }

    logger.info("✅ Simulation reset", "SimulationResetter");
    return true;
  }

  /**
   * Réinitialise la position du kite
   *
   * @param entityManager - Manager d'entités
   * @returns true si succès
   */
  private static resetKitePosition(entityManager: EntityManager): boolean {
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    const initialPos = MathUtils.calculateInitialKitePosition(
      controlBarPosition,
      CONFIG.initialization.initialKiteY,
      CONFIG.lines.defaultLength,
      CONFIG.initialization.initialDistanceFactor,
      CONFIG.initialization.initialKiteZ
    );

    const kiteEntity = entityManager.getEntity("kite");
    if (!kiteEntity) {
      return false;
    }

    const kiteTransform = kiteEntity.getComponent<TransformComponent>("transform");
    const kiteMesh = kiteEntity.getComponent<MeshComponent>("mesh");

    if (!kiteTransform || !kiteMesh) {
      return false;
    }

    // Réinitialiser position et rotation
    kiteTransform.position.copy(initialPos);
    kiteTransform.rotation = 0;
    kiteTransform.quaternion.identity();

    // Sync vers Three.js
    kiteMesh.syncToObject3D({
      position: kiteTransform.position,
      quaternion: kiteTransform.quaternion,
      scale: kiteTransform.scale,
    });

    return true;
  }

  /**
   * Obtient un objet avec timestamps pour gestion d'état
   *
   * @param frameCount - Nombre de frames
   * @param totalTime - Temps total écoulé
   * @returns Objet timing réinitialisé
   */
  static getResetTiming() {
    return {
      frameCount: 0,
      totalTime: 0,
      lastFrameTime: performance.now(),
    };
  }
}
