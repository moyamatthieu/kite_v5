/**
 * SystemFactory.ts - Factory pour la création et initialisation des systèmes ECS
 * 
 * Centralise la création de tous les systèmes pour simplifier SimulationApp
 */

import * as THREE from "three";
import { SystemManager } from "@systems/SystemManager";
import {
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  ControlBarSystem,
  LinesRenderSystem,
  PilotSystem,
  GeometryRenderSystem,
  LoggingSystem,
  AeroVectorsDebugSystem,
  ControlPointSystem,
  ControlPointDebugRenderer,
  PilotFeedbackSystem,
  type InputConfig,
  type RenderConfig,
} from "@systems";
import { EntityManager } from "@entities/EntityManager";
import { CONFIG } from "@config/SimulationConfig";
import { Logger } from "@utils/Logging";

export interface SystemsConfiguration {
  input: Partial<InputConfig>;
  render: Partial<RenderConfig>;
  enableRenderSystem: boolean;
  enableCompletePhysics: boolean;
}

export interface CreatedSystems {
  inputSystem: InputSystem;
  controlBarSystem: ControlBarSystem;
  linesRenderSystem?: LinesRenderSystem; // Maintenant optionnel
  pilotSystem: PilotSystem;
  loggingSystem: LoggingSystem;
  renderSystem?: RenderSystem;
  kitePhysicsSystem?: KitePhysicsSystem;
  geometryRenderSystem?: GeometryRenderSystem;
  controlPointSystem?: ControlPointSystem;
  aeroVectorsDebugSystem?: AeroVectorsDebugSystem;
  controlPointDebugRenderer?: ControlPointDebugRenderer;
  pilotFeedbackSystem?: PilotFeedbackSystem;
}

/**
 * Factory pour créer et initialiser tous les systèmes
 */
export class SystemFactory {
  private static logger = Logger.getInstance();

  /**
   * Crée et enregistre tous les systèmes dans le SystemManager
   * Retourne les références aux systèmes pour accès direct dans SimulationApp
   */
  static async createAllSystems(
    config: SystemsConfiguration,
    entityManager: EntityManager,
    systemManager: SystemManager
  ): Promise<CreatedSystems> {
    // === SYSTÈMES DE BASE ===
    const inputSystem = new InputSystem(config.input);
    const controlBarSystem = new ControlBarSystem();
    const pilotSystem = new PilotSystem();
    const loggingSystem = new LoggingSystem({
      logInterval: 2000,
      detailLevel: "standard",
      categories: {
        entities: true,
        physics: true,
        performance: true,
        errors: true,
      },
    });

    // Ajouter les systèmes de base (ordre d'exécution respecté)
    systemManager.addSystem(inputSystem);
    systemManager.addSystem(controlBarSystem);
    systemManager.addSystem(pilotSystem);

    // Configurer le LoggingSystem avec l'EntityManager et l'ajouter
    loggingSystem.setEntityManager(entityManager);
    systemManager.addSystem(loggingSystem);

    const result: CreatedSystems = {
      inputSystem,
      controlBarSystem,
      pilotSystem,
      loggingSystem,
    };

    // === SYSTÈMES DE RENDU (optionnel) ===
    if (config.enableRenderSystem) {
      const renderSystem = new RenderSystem(config.render);
      const geometryRenderSystem = new GeometryRenderSystem(entityManager, renderSystem);

      systemManager.addSystem(renderSystem);
      systemManager.addSystem(geometryRenderSystem);

      result.renderSystem = renderSystem;
      result.geometryRenderSystem = geometryRenderSystem;
    }

    // === SYSTÈMES DE PHYSIQUE (optionnel) ===
    if (config.enableCompletePhysics) {
      const controlBarPosition = new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
        CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
      );

      const kitePhysicsSystem = new KitePhysicsSystem(
        {
          pilotPosition: controlBarPosition,
          lineLength: CONFIG.lines.defaultLength,
          windSpeed: CONFIG.wind.defaultSpeed,
        },
        entityManager
      );

      const linesRenderSystem = new LinesRenderSystem();
      const controlPointSystem = new ControlPointSystem(entityManager);
      const aeroVectorsDebugSystem = new AeroVectorsDebugSystem();
      const controlPointDebugRenderer = new ControlPointDebugRenderer();
      
      // ✅ PHASE 2.3 : Système de feedback pilote avec filtrage inertiel
      const pilotFeedbackSystem = new PilotFeedbackSystem(entityManager);

      // IMPORTANT: ControlPointSystem doit s'exécuter AVANT LinesRenderSystem
      // car LinesRenderSystem lit les positions des points de contrôle
      systemManager.addSystem(kitePhysicsSystem);
      systemManager.addSystem(controlPointSystem);
      systemManager.addSystem(linesRenderSystem);  // Ajouté ici après ControlPointSystem
      systemManager.addSystem(pilotFeedbackSystem); // ✅ PHASE 2.3 : Après calcul des tensions
      systemManager.addSystem(aeroVectorsDebugSystem);
      systemManager.addSystem(controlPointDebugRenderer);

      result.kitePhysicsSystem = kitePhysicsSystem;
      result.linesRenderSystem = linesRenderSystem; // Maintenant créé ici
      result.controlPointSystem = controlPointSystem;
      result.aeroVectorsDebugSystem = aeroVectorsDebugSystem;
      result.controlPointDebugRenderer = controlPointDebugRenderer;
      result.pilotFeedbackSystem = pilotFeedbackSystem;
    }

    this.logger.info("✅ All systems created and registered", "SystemFactory");
    return result;
  }
}
