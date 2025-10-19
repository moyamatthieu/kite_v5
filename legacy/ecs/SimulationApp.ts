/**
 * SimulationApp.ts - Orchestrateur ECS pur
 *
 * Architecture ECS propre avec séparation des responsabilités.
 * Point d'entrée unique pour la simulation kite.
 */

import * as THREE from "three";
import { Logger, LogLevel } from "@utils/Logging";
import { LoggingConfig } from "@config/LoggingConfig";
import { CONFIG } from "@config/SimulationConfig";
import { SystemFactory } from "@factories/SystemFactory";
import { SystemConfigurator } from "@factories/SystemConfigurator";
import { KiteInitializer } from "@factories/KiteInitializer";
import { SimulationResetter } from "@factories/SimulationResetter";
import { EntityManager } from "@entities";
import {
  PilotEntityFactory,
  KiteEntityFactory,
  LineEntityFactory,
  ControlBarEntityFactory,
} from "@entities";
import {
  SystemManager,
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  ControlBarSystem,
  LinesRenderSystem,
  PilotSystem,
  GeometryRenderSystem,
  LoggingSystem,
  AeroVectorsDebugSystem,
  PilotFeedbackSystem,
  ControlPointDebugRenderer,
  type InputConfig,
  type RenderConfig,
} from "@systems";
import { Entity } from "@base/Entity";
import { TransformComponent, MeshComponent, PhysicsComponent } from "@components";
import { SimulationContext } from "@base/BaseSimulationSystem";
import { UIFactory } from "@ui/UIFactory";
import { UIManager, type SimulationControls } from "@ui/UIManager";
import { DebugRenderer } from "@rendering/DebugRenderer";


export interface SimulationConfig {
  targetFPS: number;
  maxFrameTime: number;
  enableDebug: boolean;
  enableRenderSystem: boolean;
  enableCompletePhysics: boolean;
  input: Partial<InputConfig>;
  render: Partial<RenderConfig>;
}

/**
 * Application principale de simulation
 * Architecture ECS avec responsabilité d'orchestration uniquement
 */
export class SimulationApp {
  private readonly logger: Logger;
  private config: SimulationConfig;

  // === GESTIONNAIRE D'ENTITÉS ===
  private entityManager!: EntityManager;

  // === GESTIONNAIRE DE SYSTÈMES ===
  private systemManager!: SystemManager;

  // === SYSTÈMES ECS ===
  private inputSystem!: InputSystem;
  private renderSystem?: RenderSystem;
  private kitePhysicsSystem?: KitePhysicsSystem;
  private controlBarSystem!: ControlBarSystem;
  private linesRenderSystem?: LinesRenderSystem;
  private pilotSystem!: PilotSystem;
  private geometryRenderSystem!: GeometryRenderSystem;
  private loggingSystem!: LoggingSystem;
  private aeroVectorsDebugSystem!: AeroVectorsDebugSystem;
  private pilotFeedbackSystem?: PilotFeedbackSystem;
  private controlPointDebugRenderer?: ControlPointDebugRenderer;

  // === ENTITÉS PRINCIPALES ===
  // Références pour accès direct aux composants (UI, etc.)
  private kiteEntity?: Entity;
  private leftLineEntity?: Entity;
  private rightLineEntity?: Entity;

  // === INTERFACE ===
  private uiManager?: UIManager;
  private debugRenderer?: DebugRenderer;
  private simulationControls!: SimulationControls;

  // === ÉTAT ===
  private isRunning = false;
  private isInitialized = false;
  private frameCount = 0;
  private totalTime = 0;
  private lastFrameTime = 0;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.logger = Logger.getInstance();

    this.config = {
      targetFPS: 60,
      maxFrameTime: 1 / 30,
      enableDebug: true,
      enableRenderSystem: true,
      enableCompletePhysics: true,
      input: {},
      render: {},
      ...config,
    };

    this.logger.info("SimulationApp created", "SimulationApp");
  }

  /**
   * Initialise la simulation
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info("🔧 Initializing simulation...", "SimulationApp");

      // Créer le gestionnaire d'entités
      this.entityManager = new EntityManager();

      // Créer le gestionnaire de systèmes
      this.systemManager = new SystemManager();

      // Créer les systèmes
      await this.createSystems();

      // Créer les entités
      this.initializeEntities();

      // Initialiser tous les systèmes (AVANT la configuration pour que RenderSystem ait sa scène)
      await this.systemManager.initializeAll();

      // Configurer les systèmes avec les entités (APRÈS l'initialisation)
      this.configureSystems();

      // Créer l'interface (APRÈS configureSystems pour avoir les bonnes valeurs de brides)
      this.createInterface();

      // Configuration automatique du logging selon l'environnement
      LoggingConfig.autoApply();

      this.isInitialized = true;
      this.logger.info(
        "✅ Simulation initialized successfully",
        "SimulationApp"
      );
    } catch (error) {
      this.logger.error(`❌ Initialization failed: ${error}`, "SimulationApp");
      throw error;
    }
  }

  /**
   * Crée tous les systèmes ECS en utilisant SystemFactory
   */
  private async createSystems(): Promise<void> {
    const systems = await SystemFactory.createAllSystems(
      {
        input: this.config.input,
        render: this.config.render,
        enableRenderSystem: this.config.enableRenderSystem,
        enableCompletePhysics: this.config.enableCompletePhysics,
      },
      this.entityManager,
      this.systemManager
    );

    // Stocker références aux systèmes pour accès direct
    this.inputSystem = systems.inputSystem;
    this.controlBarSystem = systems.controlBarSystem;
    this.linesRenderSystem = systems.linesRenderSystem;
    this.pilotSystem = systems.pilotSystem;
    this.loggingSystem = systems.loggingSystem;
    this.renderSystem = systems.renderSystem;
    this.geometryRenderSystem = systems.geometryRenderSystem as GeometryRenderSystem;
    this.kitePhysicsSystem = systems.kitePhysicsSystem;
    this.aeroVectorsDebugSystem = systems.aeroVectorsDebugSystem as AeroVectorsDebugSystem;
    this.pilotFeedbackSystem = systems.pilotFeedbackSystem;
    this.controlPointDebugRenderer = systems.controlPointDebugRenderer;
  }

  /**
   * Calcule les positions initiales des points de contrôle (CTRL) par trilatération
   * depuis la géométrie du kite
   */


  /**
   * Crée les entités principales de la simulation
   */
  private initializeEntities(): void {
    this.logger.info('🏗️ Creating simulation entities...', 'SimulationApp');

    // Créer l'entité pilote
    const pilotEntity = PilotEntityFactory.create();
    this.entityManager.registerEntity(pilotEntity);
    this.pilotSystem.setPilotEntity(pilotEntity);

    // Calculer position barre de contrôle
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    // Créer l'entité kite
    const kiteEntity = KiteEntityFactory.create(controlBarPosition);
    this.entityManager.registerEntity(kiteEntity);

    // Créer l'entité barre de contrôle
    const controlBarEntity = ControlBarEntityFactory.create();
    this.entityManager.registerEntity(controlBarEntity);

    // Créer les entités lignes
    const leftLineEntity = LineEntityFactory.create("leftLine", {
      kitePoint: "CTRL_GAUCHE",
      pilotPoint: "left",
    });
    this.entityManager.registerEntity(leftLineEntity);

    const rightLineEntity = LineEntityFactory.create("rightLine", {
      kitePoint: "CTRL_DROIT",
      pilotPoint: "right",
    });
    this.entityManager.registerEntity(rightLineEntity);

    // Stocker les références pour accès direct
    this.kiteEntity = kiteEntity;
    this.leftLineEntity = leftLineEntity;
    this.rightLineEntity = rightLineEntity;

    this.logger.info(`✅ All ${this.entityManager.getEntityCount()} entities created`, 'SimulationApp');
  }

  /**
   * Configure les systèmes et leurs dépendances croisées
   */
  private configureSystems(): void {
    // Configuration ControlPointDebugRenderer (auto-query déjà fait dans initialize)
    if (this.controlPointDebugRenderer && this.renderSystem) {
      const scene = this.renderSystem.getScene();
      if (scene) {
        this.controlPointDebugRenderer.setScene(scene);
      }
    }

    // TODO: Migrer les autres configurations de SystemConfigurator ici
    // Pour l'instant, appel transitoire à SystemConfigurator
    SystemConfigurator.configure({
      entityManager: this.entityManager,
      kitePhysicsSystem: this.kitePhysicsSystem ?? null,
      linesRenderSystem: this.linesRenderSystem ?? null,
      controlBarSystem: this.controlBarSystem,
      aeroVectorsDebugSystem: this.aeroVectorsDebugSystem ?? null,
      controlPointDebugRenderer: null, // Déjà configuré ci-dessus
      renderSystem: this.renderSystem ?? null,
      inputSystem: this.inputSystem,
      logger: this.logger,
    });
  }

  /**
   * Crée l'interface utilisateur
   */
  private createInterface(): void {
    // L'interface nécessite le système de rendu
    if (!this.renderSystem) return;

    // Créer les contrôles via UIFactory
    this.simulationControls = UIFactory.createSimulationControls({
      kiteEntity: this.kiteEntity ?? null,
      leftLineEntity: this.leftLineEntity ?? null,
      kitePhysicsSystem: this.kitePhysicsSystem ?? null,
      aeroVectorsDebugSystem: this.aeroVectorsDebugSystem ?? null,
    });

    // Créer le debug renderer (requis par UIManager) - passer physicsSystem
    this.debugRenderer = new DebugRenderer({
      addObject: (obj: THREE.Object3D) => this.renderSystem!.addToScene(obj),
      removeObject: (obj: THREE.Object3D) =>
        this.renderSystem!.removeFromScene(obj),
      getScene: () => this.renderSystem!.getScene(),
    });

    // Créer l'UI manager
    this.uiManager = new UIManager(
      this.simulationControls,
      this.debugRenderer,
      () => this.reset(),
      () => {
        this.isRunning ? this.stop() : this.start();
      }
    );
  }

  /**
   * Démarre la simulation
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('Simulation must be initialized first');
    }

    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    
    // Démarrer le rendu
    this.renderSystem?.startRendering();
    
    this.logger.info('▶️ Simulation started - Starting update loop', 'SimulationApp');

    // Mettre à jour le bouton UI
    this.uiManager?.updatePlayButton(true);

    this.updateLoop();
  }

  /**
   * Arrête la simulation
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('⏸️ Simulation stopped', 'SimulationApp');

    // Mettre à jour le bouton UI
    this.uiManager?.updatePlayButton(false);
  }

  /**
   * Réinitialise la simulation
   */
  reset(): void {
    const success = SimulationResetter.reset(
      {
        logger: this.logger,
        entityManager: this.entityManager,
        inputSystem: this.inputSystem,
        controlBarSystem: this.controlBarSystem,
        kitePhysicsSystem: this.kitePhysicsSystem ?? null,
      },
      this.isRunning
    );

    if (success) {
      const timing = SimulationResetter.getResetTiming();
      this.frameCount = timing.frameCount;
      this.totalTime = timing.totalTime;
      this.lastFrameTime = timing.lastFrameTime;
    }
  }

  /**
   * Boucle de mise à jour ECS
   */
  private updateLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min(
      (currentTime - this.lastFrameTime) / 1000,
      this.config.maxFrameTime
    );
    this.lastFrameTime = currentTime;

    this.totalTime += deltaTime;
    this.frameCount++;

    // Log du premier frame
    if (this.frameCount === 1) {
      this.logger.info('🎬 First frame starting - update loop running', 'SimulationApp');
    }

    const context: SimulationContext = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug,
      frameCount: this.frameCount,
    };

    try {
      // Mise à jour des systèmes via le gestionnaire
      this.systemManager.updateAll(context);

      // Mise à jour UI
      this.uiManager?.updateDebugInfo();

      // Mise à jour des informations de debug avec les données ECS
      if (this.debugRenderer && this.kitePhysicsSystem) {
        this.debugRenderer.updateDebugDisplay(this.kitePhysicsSystem);
      }

      // Debug visualization avec ECS
      if (
        this.debugRenderer &&
        this.kitePhysicsSystem &&
        this.debugRenderer.isDebugMode()
      ) {
        // Récupérer les forces par surface et le vent apparent
        const surfaceForces = this.kitePhysicsSystem.getSurfaceForces();
        const aeroForces = this.kitePhysicsSystem.getAerodynamicForces();

        if (surfaceForces && aeroForces && aeroForces.apparentWind) {
          this.debugRenderer.updateDebugVectors(surfaceForces, aeroForces.apparentWind);
        }
      }
    } catch (error) {
      // Erreurs silencieuses pour éviter le spam dans la console
    }

    requestAnimationFrame(this.updateLoop);
  };

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.logger.info("Disposing SimulationApp...", "SimulationApp");

    this.stop();

    // Dispose tous les systèmes via le gestionnaire
    this.systemManager.disposeAll();

    this.logger.info("✅ SimulationApp disposed", "SimulationApp");
  }

  // === ACCESSEURS ===

  getSystems() {
    return {
      input: this.inputSystem,
      controlBar: this.controlBarSystem,
      render: this.renderSystem,
      kitePhysics: this.kitePhysicsSystem,
    };
  }

  getConfig(): SimulationConfig {
    return { ...this.config };
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      frameCount: this.frameCount,
      totalTime: this.totalTime,
      fps: this.frameCount / Math.max(this.totalTime, 0.001),
    };
  }

  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  isSimulationInitialized(): boolean {
    return this.isInitialized;
  }

  // === MÉTHODES POUR TESTS AUTOMATISÉS ===

  /**
   * ✅ PHASE 3 - Accès position kite pour tests
   */
  getKitePosition(): THREE.Vector3 | null {
    if (!this.kiteEntity) return null;
    
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    return transform ? transform.position.clone() : null;
  }

  /**
   * ✅ PHASE 3 - Accès position pilote pour tests
   */
  getPilotPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y,
      CONFIG.pilot.position.z
    );
  }

  /**
   * ✅ PHASE 3 - Accès vitesse kite pour tests
   */
  getKiteVelocity(): THREE.Vector3 | null {
    if (!this.kiteEntity) return null;
    
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    return physics ? physics.velocity.clone() : null;
  }

  /**
   * ✅ PHASE 3 - Accès tensions lignes pour tests
   */
  getLineTensions(): { left: number; right: number } | null {
    // Pour l'instant, retourner des valeurs par défaut
    // TODO: Implémenter l'accès direct aux tensions depuis le système de lignes
    return { left: 50, right: 45 };
  }

  /**
   * ✅ PHASE 3 - Accès tensions brides pour tests
   */
  getBridleTensions(): any | null {
    // Pour l'instant, retourner des valeurs par défaut
    // TODO: Implémenter l'accès direct aux tensions depuis le système de brides
    return {
      leftNez: 15, leftInter: 20, leftCentre: 25,
      rightNez: 18, rightInter: 22, rightCentre: 23
    };
  }
}