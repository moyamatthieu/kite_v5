/**
 * SimulationApp.ts - Orchestrateur ECS pur
 *
 * Architecture ECS propre avec séparation des responsabilités.
 * Point d'entrée unique pour la simulation kite.
 */

import * as THREE from "three";
import { Logger, LogLevel } from "@utils/Logging";
import { MathUtils } from "@utils/MathUtils";

import { UIManager, type SimulationControls } from "./ui/UIManager";
import { DebugRenderer } from "./rendering/DebugRenderer";
import { CONFIG } from "./config/SimulationConfig";
import { PilotEntityFactory } from "./entities/factories/PilotEntityFactory";
import { KiteEntityFactory } from "./entities/factories/KiteEntityFactory";
import { LineEntityFactory } from "./entities/factories/LineEntityFactory";
import { ControlBarEntityFactory } from "./entities/factories/ControlBarEntityFactory";
import { EntityManager } from "./entities/EntityManager";
import { SystemManager } from "./systems/SystemManager";

import {
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  type InputConfig,
  type RenderConfig,
} from "@/ecs/systems";
import { ControlBarSystem } from '@/ecs/systems/ControlBarSystem';
import { LinesRenderSystem } from '@/ecs/systems/LinesRenderSystem';
import { PilotSystem } from '@/ecs/systems/PilotSystem';
import { GeometryRenderSystem } from '@/ecs/systems/GeometryRenderSystem';
import { LoggingSystem } from "@/ecs/systems/LoggingSystem";
import { Entity } from '@/ecs/base/Entity';
import { EntityBuilder } from '@/ecs/entities/EntityBuilder';
import {
  TransformComponent,
  MeshComponent,
  GeometryComponent,
  VisualComponent,
  BridleComponent,
  AerodynamicsComponent,
  PhysicsComponent,
  LineComponent,
} from "@/ecs/components";
import { BaseSimulationSystem, SimulationContext } from '@/ecs/base/BaseSimulationSystem';


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
  private linesRenderSystem!: LinesRenderSystem;
  private pilotSystem!: PilotSystem;
  private geometryRenderSystem!: GeometryRenderSystem;
  private loggingSystem!: LoggingSystem;

  // === ENTITÉS PRINCIPALES ===
  // Référence au kite pour accès direct aux composants (UI, etc.)
  private kiteEntity?: Entity;

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

      // Initialiser tous les systèmes
      await this.systemManager.initializeAll();

      // Configurer le rendu (crée les meshes)
      this.setupRendering();

      // Ajouter les meshes des entités à la scène (APRÈS l'initialisation du renderSystem)
      this.addEntitiesToScene();

      // Configurer les systèmes avec les entités complètes (après création des meshes)
      this.configureSystems();

      // Créer l'interface (APRÈS configureSystems pour avoir les bonnes valeurs de brides)
      this.createInterface();

      // Configurer le niveau de log pour afficher les messages
      this.logger.setLogLevel(LogLevel.DEBUG);

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
   * Crée tous les systèmes ECS
   */
  private async createSystems(): Promise<void> {
    // Créer les systèmes de base
    this.inputSystem = new InputSystem(this.config.input);
    this.controlBarSystem = new ControlBarSystem();
    this.linesRenderSystem = new LinesRenderSystem();
    this.pilotSystem = new PilotSystem();
    this.loggingSystem = new LoggingSystem({
      logInterval: 2000,
      detailLevel: "standard",
      categories: {
        entities: true,
        physics: true,
        performance: true,
        errors: true,
      },
    });

    // Ajouter les systèmes de base au gestionnaire
    this.systemManager.addSystem(this.inputSystem);
    this.systemManager.addSystem(this.controlBarSystem);
    this.systemManager.addSystem(this.linesRenderSystem);
    this.systemManager.addSystem(this.pilotSystem);
    this.systemManager.addSystem(this.loggingSystem);

    // Configurer le LoggingSystem avec l'EntityManager
    this.loggingSystem.setEntityManager(this.entityManager);

    // Système ECS pur pour la dynamique des lignes
    const lineDynamicsSystem = new (
      await import("./systems/LineDynamicsSystem")
    ).LineDynamicsSystem(this.entityManager);
    this.systemManager.addSystem(lineDynamicsSystem);

    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
      this.systemManager.addSystem(this.renderSystem);

      // Le système de rendu de géométrie dépend du système de rendu
      this.geometryRenderSystem = new GeometryRenderSystem(
        this.entityManager,
        this.renderSystem
      );
      this.systemManager.addSystem(this.geometryRenderSystem);
    }

    if (this.config.enableCompletePhysics) {
      // Position de la barre de contrôle calculée à partir du pilote
      const controlBarPosition = new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
        CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
      );

      this.kitePhysicsSystem = new KitePhysicsSystem(
        {
          pilotPosition: controlBarPosition,
          lineLength: CONFIG.lines.defaultLength,
          windSpeed: CONFIG.wind.defaultSpeed,
        },
        this.entityManager
      );
      this.systemManager.addSystem(this.kitePhysicsSystem);
    }

    // Le système de rendu de géométrie est créé avec le système de rendu
    if (!this.geometryRenderSystem && this.config.enableRenderSystem) {
      this.logger.warn(
        "GeometryRenderSystem not created, but rendering is enabled. This might be an issue.",
        "SimulationApp"
      );
    }
  }

  /**
   * Crée les entités principales
   */
  private initializeEntities(): void {
    // Créer l'entité pilote via la factory
    const pilotEntity = PilotEntityFactory.create();
    this.entityManager.registerEntity(pilotEntity);
    this.pilotSystem.setPilotEntity(pilotEntity);

    // Créer l'entité kite via la factory
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );
    const kiteEntity = KiteEntityFactory.create(controlBarPosition);
    this.entityManager.registerEntity(kiteEntity);
    
    // Stocker la référence pour accès direct aux composants
    this.kiteEntity = kiteEntity;

    // Créer l'entité barre de contrôle via la factory
    const controlBarEntity = ControlBarEntityFactory.create();
    this.entityManager.registerEntity(controlBarEntity);

    // Créer les entités de lignes via la factory
    const leftLineEntity = LineEntityFactory.create("leftLine", {
      kitePoint: "CTRL_GAUCHE",
      pilotPoint: "LEFT_HANDLE",
    });
    const rightLineEntity = LineEntityFactory.create("rightLine", {
      kitePoint: "CTRL_DROIT",
      pilotPoint: "RIGHT_HANDLE",
    });
    this.entityManager.registerEntity(leftLineEntity);
    this.entityManager.registerEntity(rightLineEntity);
  }

  /**
   * Ajoute le mesh d'une entité à la scène Three.js
   */
  private addEntityMeshToScene(entity: Entity): void {
    const meshComponent = entity.getComponent<MeshComponent>('mesh');
    if (meshComponent && meshComponent.object3D && this.renderSystem) {
      this.renderSystem.addToScene(meshComponent.object3D);
    }
  }

  /**
   * Ajoute les meshes de toutes les entités à la scène
   * Appelé APRÈS l'initialisation du renderSystem
   */
  private addEntitiesToScene(): void {
    if (!this.renderSystem) {
      this.logger.warn('RenderSystem not initialized, cannot add entities to scene', 'SimulationApp');
      return;
    }

    this.logger.info('🎨 Adding entities to scene...', 'SimulationApp');

    // Ajouter le pilote à la scène
    const pilotEntity = this.entityManager.getEntity('pilot');
    if (pilotEntity) {
      this.addEntityMeshToScene(pilotEntity);
      const transform = pilotEntity.getComponent<TransformComponent>('transform');
      this.logger.info(`  ✅ Added pilot (feet on ground) at position: (${transform?.position.x}, ${transform?.position.y}, ${transform?.position.z})`, 'SimulationApp');
    } else {
      this.logger.warn('  ⚠️ Pilot entity not found', 'SimulationApp');
    }

    // Ajouter la barre de contrôle à la scène
    const controlBarEntity = this.entityManager.getEntity('controlBar');
    if (controlBarEntity) {
      this.addEntityMeshToScene(controlBarEntity);
      const transform = controlBarEntity.getComponent<TransformComponent>('transform');
      this.logger.info(`  ✅ Added controlBar at position: (${transform?.position.x}, ${transform?.position.y}, ${transform?.position.z})`, 'SimulationApp');
    } else {
      this.logger.warn('  ⚠️ ControlBar entity not found', 'SimulationApp');
    }

    // Le kite sera ajouté par GeometryRenderSystem
    // Les lignes seront ajoutées par LinesRenderSystem
  }

  /**
   * Configure les systèmes avec les entités (appelé après création des meshes)
   */
  private configureSystems(): void {
    const kiteEntity = this.entityManager.getEntity("kite");
    const controlBarEntity = this.entityManager.getEntity("controlBar");
    const leftLineEntity = this.entityManager.getEntity("leftLine");
    const rightLineEntity = this.entityManager.getEntity("rightLine");

    if (!kiteEntity || !controlBarEntity) {
      this.logger.error(
        "❌ Entities not found for system configuration",
        "SimulationApp"
      );
      return;
    }

    // Configurer KitePhysicsSystem
    if (this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setKiteEntity(kiteEntity);
      this.kitePhysicsSystem.setHandlesProvider({
        getHandlePositions: () => this.controlBarSystem.getHandlePositions(),
      });
    }

    // Configurer LinesRenderSystem
    this.linesRenderSystem.setKite(kiteEntity);
    this.linesRenderSystem.setControlBarSystem(this.controlBarSystem);
    if (this.kitePhysicsSystem) {
      this.linesRenderSystem.setKitePhysicsSystem(this.kitePhysicsSystem);
    }
    // Définir la scène pour LinesRenderSystem
    if (this.renderSystem) {
      const scene = this.renderSystem.getScene();
      if (scene) {
        this.linesRenderSystem.setScene(scene);
      }
    }

    // Enregistrer les entités de ligne dans LinesRenderSystem
    if (leftLineEntity) {
      this.linesRenderSystem.registerLineEntity("leftLine", leftLineEntity, {
        segments: 10,
        color: 0xff0000,
        linewidth: 2,
        side: "left",
      });
    }
    if (rightLineEntity) {
      this.linesRenderSystem.registerLineEntity("rightLine", rightLineEntity, {
        segments: 10,
        color: 0xff0000,
        linewidth: 2,
        side: "right",
      });
    }

    // Configurer ControlBarSystem
    this.controlBarSystem.setControlBarEntity(controlBarEntity);
    this.controlBarSystem.setInputSystem(this.inputSystem);
  }

  /**
   * Crée l'interface utilisateur
   */
  private createInterface(): void {
    // L'interface nécessite le système de rendu
    if (!this.renderSystem) return;

    // Créer les contrôles
    this.simulationControls = this.createSimulationControls();

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
   * Configure le rendu
   */
  private setupRendering(): void {
    if (!this.renderSystem) return;
    
    this.renderSystem.startRendering();
  }

  /**
   * Crée les contrôles de simulation
   */
  private createSimulationControls(): SimulationControls {
    return {
      getBridleLengths: () => {
        // Lire directement depuis le BridleComponent du kite (plus fiable que via les systèmes)
        if (this.kiteEntity) {
          const bridleComponent = this.kiteEntity.getComponent<BridleComponent>('bridle');
          if (bridleComponent) {
            return { ...bridleComponent.lengths };
          }
        }
        
        // Fallback : valeurs par défaut
        return {
          nez: 0.65,
          inter: 0.65,
          centre: 0.65,
        };
      },
      setBridleLength: (type: "nez" | "inter" | "centre", length: number) => {
        if (this.kitePhysicsSystem) {
          const currentLengths = this.kitePhysicsSystem.getBridleLengths();
          this.kitePhysicsSystem.setBridleLengths({
            ...currentLengths,
            [type]: length,
          });
        }
      },
      setLineLength: (length: number) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setLineLength(length);
        }
      },
      setWindParams: (params: {
        speed?: number;
        direction?: number;
        turbulence?: number;
      }) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setWindParams(params);
        }
      },
      getForceSmoothing: () =>
        this.kitePhysicsSystem?.getForceSmoothing() || 0.1,
      setForceSmoothing: (value: number) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setForceSmoothing(value);
        }
      },
      getKiteState: () =>
        this.kitePhysicsSystem?.getKiteState() || {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          angularVelocity: new THREE.Vector3(),
          orientation: new THREE.Quaternion(),
        },
      getWindState: () => {
        const windState = this.kitePhysicsSystem?.getWindState();
        return windState
          ? {
              baseSpeed: windState.baseSpeed,
              baseDirection: windState.baseDirection,
              turbulence: windState.turbulence,
            }
          : {
              baseSpeed: 0,
              baseDirection: new THREE.Vector3(),
              turbulence: 0,
            };
      },
      getLineLength: () => CONFIG.lines.defaultLength,
      getControlLineDiagnostics: () => {
        // TODO: Implement in PureKitePhysicsSystem
        return null; // this.kitePhysicsSystem?.getControlLineDiagnostics() || null;
      },
      getAerodynamicForces: () => {
        return this.kitePhysicsSystem?.getAerodynamicForces() || null;
      }
    };
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
    this.logger.info('🔄 Resetting simulation...', 'SimulationApp');

    const wasRunning = this.isRunning;

    // Arrêter temporairement pour éviter les mises à jour pendant le reset
    if (this.isRunning) {
      this.isRunning = false;
    }

    // Reset systems
    this.inputSystem.reset();
    this.controlBarSystem.reset();
    this.kitePhysicsSystem?.reset();

    // Reset kite position avec calcul automatique de la position initiale
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
    const kiteEntity = this.entityManager.getEntity("kite");
    if (kiteEntity) {
      const kiteTransform =
        kiteEntity.getComponent<TransformComponent>("transform");
      const kiteMesh = kiteEntity.getComponent<MeshComponent>("mesh");
      if (kiteTransform && kiteMesh) {
        kiteTransform.position.copy(initialPos);
        kiteTransform.rotation = 0;
        kiteTransform.quaternion.identity();
        kiteMesh.syncToObject3D({
          position: kiteTransform.position,
          quaternion: kiteTransform.quaternion,
          scale: kiteTransform.scale,
        });
      }
    }

    // Reset state
    this.frameCount = 0;
    this.totalTime = 0;
    this.lastFrameTime = performance.now();

    // Redémarrer si c'était en cours d'exécution
    if (wasRunning) {
      this.isRunning = true;
    }

    this.logger.info("✅ Simulation reset", "SimulationApp");
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
        const kiteEntity = this.entityManager.getEntity("kite");
        if (kiteEntity) {
          const kiteMesh = kiteEntity.getComponent<MeshComponent>("mesh");
          if (kiteMesh && kiteMesh.object3D) {
            // TODO: Update debugRenderer to work with ECS entities
            // Récupérer l'objet Kite depuis le MeshComponent
          }
        }
      }
    } catch (error) {
      this.logger.error(`Update error: ${error}`, "SimulationApp");
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
}