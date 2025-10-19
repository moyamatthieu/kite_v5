/**
 * SystemConfigurator.ts - Configuration centralisée des systèmes ECS
 *
 * Encapsule la configuration inter-systèmes et dépendances
 */

import { Logger } from "@utils/Logging";
import { EntityManager } from "@entities";
import {
  ControlPointSystem,
  KitePhysicsSystem,
  LinesRenderSystem,
  ControlBarSystem,
  AeroVectorsDebugSystem,
  ControlPointDebugRenderer,
  RenderSystem,
  InputSystem,
} from "@systems";
import { Entity } from "@base/Entity";

/**
 * Interface pour les dépendances de configuration
 * 
 * ✅ NOUVEAU: controlPointSystem et controlPointDebugRenderer optionnels
 * Les CTRL sont maintenant des points locaux du kite (plus d'entités séparées)
 */
export interface SystemConfiguratorDependencies {
  entityManager: EntityManager;
  controlPointSystem?: ControlPointSystem | null;
  kitePhysicsSystem: KitePhysicsSystem | null;
  linesRenderSystem: LinesRenderSystem | null; // Maintenant optionnel
  controlBarSystem: ControlBarSystem;
  aeroVectorsDebugSystem: AeroVectorsDebugSystem | null;
  controlPointDebugRenderer?: ControlPointDebugRenderer | null;
  renderSystem: RenderSystem | null;
  inputSystem: InputSystem;
  logger: Logger;
}

/**
 * Configurateur centralisé pour tous les systèmes ECS
 */
export class SystemConfigurator {
  /**
   * Configure tous les systèmes avec leurs dépendances croisées
   *
   * @param deps - Dépendances (systèmes et manager)
   */
  static configure(deps: SystemConfiguratorDependencies): void {
    const {
      entityManager,
      controlPointSystem,
      kitePhysicsSystem,
      linesRenderSystem,
      controlBarSystem,
      aeroVectorsDebugSystem,
      controlPointDebugRenderer,
      renderSystem,
      inputSystem,
      logger,
    } = deps;

    // Récupérer les entités
    const kiteEntity = entityManager.getEntity("kite");
    const controlBarEntity = entityManager.getEntity("controlBar");
    const leftLineEntity = entityManager.getEntity("leftLine");
    const rightLineEntity = entityManager.getEntity("rightLine");
    const ctrlLeftEntity = entityManager.getEntity("ctrl-left");
    const ctrlRightEntity = entityManager.getEntity("ctrl-right");

    if (!kiteEntity || !controlBarEntity) {
      logger.error("❌ Entities not found for system configuration", "SystemConfigurator");
      return;
    }

    // Configurer les systèmes
    // ✅ CTRL points systems désactivés (CTRL sont maintenant des points locaux du kite)
    if (controlPointSystem) {
      SystemConfigurator.configureControlPointSystem(
        controlPointSystem,
        kiteEntity,
        ctrlLeftEntity,
        ctrlRightEntity,
        leftLineEntity,
        rightLineEntity,
        controlBarSystem,
        logger
      );
    }

    SystemConfigurator.configureKitePhysicsSystem(kitePhysicsSystem, kiteEntity, controlBarSystem);

    if (linesRenderSystem) {
      SystemConfigurator.configureLinesRenderSystem(
        linesRenderSystem,
        renderSystem,
        kiteEntity,
        leftLineEntity,
        rightLineEntity,
        ctrlLeftEntity,
        ctrlRightEntity,
        controlBarSystem,
        kitePhysicsSystem,
        logger
      );
    }

    SystemConfigurator.configureControlBarSystem(controlBarSystem, controlBarEntity, inputSystem);

    SystemConfigurator.configureAeroVectorsDebugSystem(
      aeroVectorsDebugSystem,
      kitePhysicsSystem,
      renderSystem
    );

    if (controlPointDebugRenderer) {
      SystemConfigurator.configureControlPointDebugRenderer(
        controlPointDebugRenderer,
        renderSystem,
        ctrlLeftEntity,
        ctrlRightEntity,
        kiteEntity,
        controlBarSystem,
        logger
      );
    }
  }

  // ============================================================================
  // Individual System Configuration Methods
  // ============================================================================

  private static configureControlPointSystem(
    system: ControlPointSystem | null,
    kiteEntity: Entity,
    ctrlLeftEntity: Entity | undefined,
    ctrlRightEntity: Entity | undefined,
    leftLineEntity: Entity | undefined,
    rightLineEntity: Entity | undefined,
    controlBarSystem: ControlBarSystem,
    logger: Logger
  ) {
    if (system && ctrlLeftEntity && ctrlRightEntity && leftLineEntity && rightLineEntity) {
      system.setEntities(kiteEntity, ctrlLeftEntity, ctrlRightEntity, leftLineEntity, rightLineEntity);
      system.setHandlesProvider({
        getHandlePositions: () => controlBarSystem.getHandlePositions(),
      });
      logger.info("✅ ControlPointSystem configured with CTRL entities", "SystemConfigurator");
    } else {
      logger.warn("⚠️ ControlPointSystem or CTRL entities not found", "SystemConfigurator");
    }
  }

  private static configureKitePhysicsSystem(
    system: KitePhysicsSystem | null,
    kiteEntity: Entity,
    controlBarSystem: ControlBarSystem
  ) {
    if (system) {
      system.setKiteEntity(kiteEntity);
      system.setHandlesProvider({
        getHandlePositions: () => controlBarSystem.getHandlePositions(),
      });
    }
  }

  private static configureLinesRenderSystem(
    system: LinesRenderSystem,
    renderSystem: RenderSystem | null,
    kiteEntity: Entity,
    leftLineEntity: Entity | undefined,
    rightLineEntity: Entity | undefined,
    ctrlLeftEntity: Entity | undefined,
    ctrlRightEntity: Entity | undefined,
    controlBarSystem: ControlBarSystem,
    kitePhysicsSystem: KitePhysicsSystem | null,
    logger: Logger
  ) {
    system.setKite(kiteEntity);
    system.setControlBarSystem(controlBarSystem);

    if (kitePhysicsSystem) {
      system.setKitePhysicsSystem(kitePhysicsSystem);
    }

    // ✅ SUPPRIMÉ: setControlPointEntities() - CTRL maintenant points locaux du kite
    // LinesRenderSystem accède aux CTRL via geometry.getPointWorld()
    logger.info("✅ LinesRenderSystem configured (CTRL via geometry)", "SystemConfigurator");

    if (renderSystem) {
      const scene = renderSystem.getScene();
      if (scene) {
        system.setScene(scene);
      }
    }

    if (leftLineEntity) {
      system.registerLineEntity("leftLine", leftLineEntity, {
        segments: 10,
        color: 0xff0000,
        linewidth: 2,
        side: "left",
      });
    }

    if (rightLineEntity) {
      system.registerLineEntity("rightLine", rightLineEntity, {
        segments: 10,
        color: 0xff0000,
        linewidth: 2,
        side: "right",
      });
    }
  }

  private static configureControlBarSystem(
    system: ControlBarSystem,
    controlBarEntity: Entity,
    inputSystem: InputSystem
  ) {
    system.setControlBarEntity(controlBarEntity);
    system.setInputSystem(inputSystem);
  }

  private static configureAeroVectorsDebugSystem(
    system: AeroVectorsDebugSystem | null,
    kitePhysicsSystem: KitePhysicsSystem | null,
    renderSystem: RenderSystem | null
  ) {
    if (system && kitePhysicsSystem) {
      system.setKitePhysicsSystem(kitePhysicsSystem);

      if (renderSystem) {
        const scene = renderSystem.getScene();
        if (scene) {
          system.setScene(scene);
        }
      }
    }
  }

  private static configureControlPointDebugRenderer(
    system: ControlPointDebugRenderer | null,
    renderSystem: RenderSystem | null,
    ctrlLeftEntity: Entity | undefined,
    ctrlRightEntity: Entity | undefined,
    kiteEntity: Entity,
    controlBarSystem: ControlBarSystem,
    logger: Logger
  ) {
    if (!system) return;

    if (renderSystem) {
      const scene = renderSystem.getScene();
      if (scene) {
        system.setScene(scene);
      }
    }

    // ✅ SUPPRIMÉ: setControlPointEntities() - CTRL maintenant points locaux du kite
    // ControlPointDebugRenderer accède aux CTRL via geometry.getPointWorld()

    system.setKiteEntity(kiteEntity);
    system.setHandlePositionsProvider(() => controlBarSystem.getHandlePositions());

    logger.info("✅ ControlPointDebugRenderer configured", "SystemConfigurator");
  }
}
