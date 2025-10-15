/**
 * SimulationApp.ts - Orchestrateur ECS pur
 *
 * Architecture ECS propre avec séparation des responsabilités.
 * Point d'entrée unique pour la simulation kite.
 */

import * as THREE from 'three';

import { Logger, LogLevel } from "@utils/Logging";
import { MathUtils } from "@utils/MathUtils";

import {
  InputSystem,
  RenderSystem,
  PureKitePhysicsSystem,
  type InputConfig,
  type RenderConfig
} from '@/ecs/systems';
import { ControlBarSystem } from '@/ecs/systems/ControlBarSystem';
import { LinesRenderSystem } from '@/ecs/systems/LinesRenderSystem';
import { PilotSystem } from '@/ecs/systems/PilotSystem';
import { GeometryRenderSystem } from '@/ecs/systems/GeometryRenderSystem';
import { LoggingSystem } from '@/ecs/systems/LoggingSystem';
import { UIManager, type SimulationControls} from './ui/UIManager';
import { DebugRenderer } from './rendering/DebugRenderer';
import { CONFIG } from './config/SimulationConfig';
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
  LineComponent
} from '@/ecs/components';
import { PilotEntityFactory } from './entities/factories/PilotEntityFactory';
import { KiteEntityFactory } from './entities/factories/KiteEntityFactory';
import { LineEntityFactory } from './entities/factories/LineEntityFactory';
import { ControlBarEntityFactory } from './entities/factories/ControlBarEntityFactory';
import { BaseSimulationSystem, SimulationContext } from '@/ecs/base/BaseSimulationSystem';
import { EntityManager } from './entities/EntityManager';
import { SystemManager } from './systems/SystemManager';

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
  private kitePhysicsSystem?: PureKitePhysicsSystem;
  private controlBarSystem!: ControlBarSystem;
  private linesRenderSystem!: LinesRenderSystem;
  private pilotSystem!: PilotSystem;
  private geometryRenderSystem!: GeometryRenderSystem;
  private loggingSystem!: LoggingSystem;

  // === ENTITÉS PRINCIPALES ===
  // Supprimées - utilisation exclusive d'EntityManager

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
      ...config
    };

    this.logger.info('SimulationApp created', 'SimulationApp');
  }

  /**
   * Initialise la simulation
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing simulation...', 'SimulationApp');

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

      // Créer l'interface
      this.createInterface();

      // Configurer le rendu
      this.setupRendering();

      // Configurer le niveau de log pour afficher les messages
      this.logger.setLogLevel(LogLevel.DEBUG);

      this.isInitialized = true;
      this.logger.info('✅ Simulation initialized', 'SimulationApp');

    } catch (error) {
      this.logger.error(`❌ Initialization failed: ${error}`, 'SimulationApp');
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
      logInterval: 2000, // Log toutes les 2 secondes
      detailLevel: 'standard',
      categories: {
        entities: true,
        physics: true,
        performance: true,
        errors: true
      }
    });

    // Ajouter les systèmes de base au gestionnaire
    this.systemManager.addSystem(this.inputSystem);
    this.systemManager.addSystem(this.controlBarSystem);
    this.systemManager.addSystem(this.linesRenderSystem);
    this.systemManager.addSystem(this.pilotSystem);
    this.systemManager.addSystem(this.loggingSystem);

    // Système ECS pur pour la dynamique des lignes
    const lineDynamicsSystem = new (await import('./systems/LineDynamicsSystem')).LineDynamicsSystem(this.entityManager);
    this.systemManager.addSystem(lineDynamicsSystem);

    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
      this.systemManager.addSystem(this.renderSystem);
    }

    if (this.config.enableCompletePhysics) {
      // Position de la barre de contrôle calculée à partir du pilote
      const controlBarPosition = new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
        CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
      );

      this.kitePhysicsSystem = new PureKitePhysicsSystem({
        windSpeed: CONFIG.wind.defaultSpeed,
        windDirection: CONFIG.wind.defaultDirection,
        turbulence: CONFIG.wind.defaultTurbulence,
        lineLength: CONFIG.lines.defaultLength,
        pilotPosition: controlBarPosition,
        enableConstraints: true,
        enableAerodynamics: true,
        enableGravity: true
      }, this.entityManager);
      this.systemManager.addSystem(this.kitePhysicsSystem);
    }

    // Note: GeometryRenderSystem sera initialisé après RenderSystem dans initializeRendering()
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

    // Créer l'entité barre de contrôle via la factory
    const controlBarEntity = ControlBarEntityFactory.create();
    this.entityManager.registerEntity(controlBarEntity);

    // Créer les entités de lignes via la factory
    const leftLineEntity = LineEntityFactory.create('leftLine', { kitePoint: 'CTRL_GAUCHE', pilotPoint: 'LEFT_HANDLE' });
    const rightLineEntity = LineEntityFactory.create('rightLine', { kitePoint: 'CTRL_DROIT', pilotPoint: 'RIGHT_HANDLE' });
    this.entityManager.registerEntity(leftLineEntity);
    this.entityManager.registerEntity(rightLineEntity);

    // Appeler setKiteEntity APRES l'enregistrement des lignes
    if (this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setKiteEntity(kiteEntity);
      this.kitePhysicsSystem.setHandlesProvider({
        getHandlePositions: () => this.controlBarSystem.getHandlePositions()
      });
    }

    // Logging
    this.logger.debug('Entity positions after initialization:', 'SimulationApp');
    const pilotTransform = pilotEntity.getComponent<TransformComponent>('transform');
    this.logger.debug(`Pilot position: ${pilotTransform?.position}`, 'SimulationApp');
    const barTransform = controlBarEntity.getComponent<TransformComponent>('transform');
    this.logger.debug(`Control bar position: ${barTransform?.position}`, 'SimulationApp');
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
    this.logger.debug(`Kite position: ${kiteTransform?.position}`, 'SimulationApp');
  }

  /**
   * Crée l'interface utilisateur
   */

  /**
   * Crée l'entité ECS de la barre de contrôle directement (sans factory)
   */
  private createControlBarEntity(): void {
    // Récupérer le pilote pour attachement
    const pilotEntity = this.entityManager.getEntity('pilot');
    const pilotMesh = pilotEntity?.getComponent<MeshComponent>('mesh');

    // Créer l'entité controlBar directement
    const controlBarEntity = new Entity('controlBar');

    // Calculer la position relative au pilote
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    // Ajouter le composant transform
    EntityBuilder.addTransform(controlBarEntity, controlBarPosition);

    // Créer la géométrie de la barre de contrôle (simple cylindre)
    const geometry = new GeometryComponent();

    // Points de la barre (gauche, centre, droite)
    const barLength = CONFIG.controlBar.handleLength * 2; // Longueur totale
    const barRadius = CONFIG.controlBar.barRadius;

    geometry.setPoint('LEFT_HANDLE', new THREE.Vector3(-barLength / 2, 0, 0));
    geometry.setPoint('CENTER', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('RIGHT_HANDLE', new THREE.Vector3(barLength / 2, 0, 0));

    // Connexions pour la barre
    geometry.addConnection('LEFT_HANDLE', 'CENTER');
    geometry.addConnection('CENTER', 'RIGHT_HANDLE');

    controlBarEntity.addComponent(geometry);

    // Créer le composant visuel
    const visual = new VisualComponent();
    visual.frameMaterial = {
      color: '#8B4513', // Marron pour la barre
      diameter: barRadius * 2
    };
    controlBarEntity.addComponent(visual);

    // Attacher au pilote si disponible
    if (pilotMesh?.object3D) {
      pilotMesh.object3D.add(new THREE.Group()); // Placeholder pour attachement
    }

    // Enregistrer dans EntityManager
    this.entityManager.registerEntity(controlBarEntity);

    // Configurer les systèmes
    this.controlBarSystem.setControlBarEntity(controlBarEntity);
    this.controlBarSystem.setInputSystem(this.inputSystem);

    // Initialiser la position de référence dans le système pilote
    const worldPosition = new THREE.Vector3();
    // Pour l'instant, utiliser la position calculée
    worldPosition.copy(controlBarPosition);
    this.pilotSystem.setControlBarPosition(worldPosition);
    this.logger.info('ControlBar created and attached', 'SimulationApp');
  }

  // ❌ SUPPRIMÉ : createLineEntities() - code legacy remplacé par LineEntityFactory dans initializeEntities()

  /**
   * Crée l'entité ECS du pilote directement (sans factory)
   */
  private createPilotEntity(): void {
    // Créer l'entité pilote directement
    const pilotEntity = new Entity('pilot');

    // Créer la géométrie du pilote
    const pilotGeometry = new THREE.BoxGeometry(
      CONFIG.pilot.width,
      CONFIG.pilot.height,
      CONFIG.pilot.depth
    );
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8
    });

    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;

    // Ajouter le composant Transform
    const transform = new TransformComponent({
      position: new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y,
        CONFIG.pilot.position.z
      ),
      rotation: 0,
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    });
    pilotEntity.addComponent(transform);

    // Ajouter le composant Mesh
    const mesh = new MeshComponent(pilotMesh, {
      visible: true,
      castShadow: true,
      receiveShadow: false
    });
    pilotEntity.addComponent(mesh);

    // Enregistrer dans EntityManager
    this.entityManager.registerEntity(pilotEntity);

    // Configurer le système pilote
    this.pilotSystem.setPilotEntity(pilotEntity);

    // Configurer le système de logging
    this.loggingSystem.setEntityManager(this.entityManager);

    // Ajouter le système de journalisation à la boucle de simulation
    this.loggingSystem.initialize();

    // Inclure le système dans la mise à jour
    this.loggingSystem.update({
      deltaTime: this.lastFrameTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug,
      frameCount: this.frameCount
    });
  }



  /**
   * Initialise tous les systèmes
   */
  private async initializeSystems(): Promise<void> {
    const initPromises: Promise<void>[] = [
      this.inputSystem.initialize(),
      this.controlBarSystem.initialize(),
      this.linesRenderSystem.initialize(),
      this.pilotSystem.initialize(),
      this.loggingSystem.initialize()
    ];

    if (this.renderSystem) {
      initPromises.push(this.renderSystem.initialize());
    }

    if (this.kitePhysicsSystem) {
      initPromises.push(this.kitePhysicsSystem.initialize());
    }

    await Promise.all(initPromises);
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
      removeObject: (obj: THREE.Object3D) => this.renderSystem!.removeFromScene(obj),
      getScene: () => this.renderSystem!.getScene()
    });

    // Créer l'UI manager
    this.uiManager = new UIManager(
      this.simulationControls,
      this.debugRenderer,
      () => this.reset(),
      () => { this.isRunning ? this.stop() : this.start(); }
    );
  }

  /**
   * Configure le rendu
   */
  private setupRendering(): void {
    this.initializeRendering();
  }

  /**
   * Initialise le rendu
   */
  private initializeRendering(): void {
    if (!this.renderSystem) {
      this.logger.error('❌ RenderSystem is null', 'SimulationApp');
      return;
    }

    const scene = this.renderSystem.getScene();
    if (!scene) {
      this.logger.error('❌ Scene is null', 'SimulationApp');
      return;
    }

    this.logger.info('Setting up rendering...', 'SimulationApp');

    // Initialiser le système de rendu géométrique avec la scène Three.js
    this.geometryRenderSystem = new GeometryRenderSystem(scene);
    this.logger.info(`✅ GeometryRenderSystem created with scene`, 'SimulationApp');

    // Initialiser la géométrie du kite
    const kiteEntity = this.entityManager.getEntity('kite');
    if (kiteEntity) {
      this.logger.info('Initializing kite geometry...', 'SimulationApp');
      this.geometryRenderSystem.initializeEntity(kiteEntity);
      this.logger.info('✅ Kite geometry initialized and added to scene', 'SimulationApp');
      
      // Vérifier que le mesh a été créé
      const kiteMesh = kiteEntity.getComponent<MeshComponent>('mesh');
      if (kiteMesh) {
        this.logger.info(`✅ Kite mesh component found, object3D: ${kiteMesh.object3D.type}`, 'SimulationApp');
        this.logger.info(`✅ Kite has ${kiteMesh.object3D.children.length} children`, 'SimulationApp');
      } else {
        this.logger.error('❌ Kite mesh component not found after geometry initialization', 'SimulationApp');
      }
    } else {
      this.logger.error('❌ Kite entity not found', 'SimulationApp');
    }

    // Initialiser la géométrie de la barre de contrôle
    const controlBarEntity = this.entityManager.getEntity('controlBar');
    if (controlBarEntity) {
      this.logger.info('Initializing control bar geometry...', 'SimulationApp');
      this.geometryRenderSystem.initializeEntity(controlBarEntity);
      this.logger.info('✅ Control bar geometry initialized and added to scene', 'SimulationApp');
    } else {
      this.logger.error('❌ Control bar entity not found', 'SimulationApp');
    }

    // Initialiser la géométrie des lignes
    const leftLineEntity = this.entityManager.getEntity('leftLine');
    if (leftLineEntity) {
      this.logger.info('Initializing left line geometry...', 'SimulationApp');
      this.geometryRenderSystem.initializeEntity(leftLineEntity);
      this.logger.info('✅ Left line geometry initialized and added to scene', 'SimulationApp');
    }
    
    const rightLineEntity = this.entityManager.getEntity('rightLine');
    if (rightLineEntity) {
      this.logger.info('Initializing right line geometry...', 'SimulationApp');
      this.geometryRenderSystem.initializeEntity(rightLineEntity);
      this.logger.info('✅ Right line geometry initialized and added to scene', 'SimulationApp');
    }

    // Ajouter les entités ECS à la scène via leurs composants Mesh
    const pilotEntity = this.entityManager.getEntity('pilot');
    if (pilotEntity) {
      const pilotMesh = pilotEntity.getComponent<MeshComponent>('mesh');
      if (pilotMesh) {
        scene.add(pilotMesh.object3D);
        this.logger.info('✅ Pilot added to scene', 'SimulationApp');
      } else {
        this.logger.error('❌ Pilot mesh component not found', 'SimulationApp');
      }
    } else {
      this.logger.error('❌ Pilot entity not found', 'SimulationApp');
    }

    // Afficher les stats de la scène
    this.logger.info(`✅ Scene has ${scene.children.length} children total`, 'SimulationApp');
    scene.children.forEach((child, index) => {
      this.logger.debug(`  Child ${index}: ${child.type} (${child.name || 'unnamed'})`, 'SimulationApp');
    });

    // Démarrer le rendu
    this.renderSystem.startRendering();
    this.logger.info('✅ Rendering started', 'SimulationApp');
  }

  /**
   * Crée les contrôles de simulation
   */
  private createSimulationControls(): SimulationControls {
    return {
      getBridleLengths: () => this.kitePhysicsSystem?.getBridleLengths() || { nez: 0.65, inter: 0.65, centre: 0.65 },
      setBridleLength: (type: "nez" | "inter" | "centre", length: number) => {
        if (this.kitePhysicsSystem) {
          const currentLengths = this.kitePhysicsSystem.getBridleLengths();
          this.kitePhysicsSystem.setBridleLengths({
            ...currentLengths,
            [type]: length
          });
        }
      },
      setLineLength: (length: number) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setLineLength(length);
        }
      },
      setWindParams: (params: { speed?: number; direction?: number; turbulence?: number }) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setWindParams(params);
        }
      },
      getForceSmoothing: () => this.kitePhysicsSystem?.getForceSmoothing() || 0.1,
      setForceSmoothing: (value: number) => {
        if (this.kitePhysicsSystem) {
          this.kitePhysicsSystem.setForceSmoothing(value);
        }
      },
      getKiteState: () => this.kitePhysicsSystem?.getKiteState() || {
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        orientation: new THREE.Quaternion()
      },
      getWindState: () => {
        const windState = this.kitePhysicsSystem?.getWindState();
        return windState ? {
          baseSpeed: windState.baseSpeed,
          baseDirection: windState.baseDirection,
          turbulence: windState.turbulence
        } : {
          baseSpeed: 0,
          baseDirection: new THREE.Vector3(),
          turbulence: 0
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
    this.logger.info('▶️ Simulation started', 'SimulationApp');

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
    const kiteEntity = this.entityManager.getEntity('kite');
    if (kiteEntity) {
      const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
      const kiteMesh = kiteEntity.getComponent<MeshComponent>('mesh');
      if (kiteTransform && kiteMesh) {
        kiteTransform.position.copy(initialPos);
        kiteTransform.rotation = 0;
        kiteTransform.quaternion.identity();
        kiteMesh.syncToObject3D({
          position: kiteTransform.position,
          quaternion: kiteTransform.quaternion,
          scale: kiteTransform.scale
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

    this.logger.info('✅ Simulation reset', 'SimulationApp');
  }

  /**
   * Boucle de mise à jour ECS
   */
  private updateLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, this.config.maxFrameTime);
    this.lastFrameTime = currentTime;

    this.totalTime += deltaTime;
    this.frameCount++;

    const context: SimulationContext = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug,
      frameCount: this.frameCount
    };

    try {
      // Mise à jour des systèmes via le gestionnaire
      // Note: Certains systèmes ont des signatures spéciales et sont mis à jour individuellement

      // InputSystem a une signature spéciale
      this.inputSystem.update(this.entityManager.getActiveEntities(), context.deltaTime);

      // KitePhysicsSystem a besoin de configuration spéciale
      if (this.kitePhysicsSystem) {
        const inputState = this.inputSystem.getInputState();
        this.kitePhysicsSystem.setBarRotation(inputState.barPosition);
        this.kitePhysicsSystem.update(context);
      }

      // ControlBarSystem a une signature spéciale
      this.controlBarSystem.update(this.entityManager.getActiveEntities(), context.deltaTime);

      // Mise à jour des autres systèmes via le gestionnaire
      // Note: Les systèmes suivants utilisent la signature standard SimulationContext
      this.systemManager.updateAll(context);

      // Mise à jour UI
      this.uiManager?.updateDebugInfo();

      // Mise à jour des informations de debug avec les données ECS
      if (this.debugRenderer && this.kitePhysicsSystem) {
        this.debugRenderer.updateDebugDisplay(this.kitePhysicsSystem);
      }

      // Debug visualization avec ECS
      if (this.debugRenderer && this.kitePhysicsSystem && this.debugRenderer.isDebugMode()) {
        const kiteEntity = this.entityManager.getEntity('kite');
        if (kiteEntity) {
          const kiteMesh = kiteEntity.getComponent<MeshComponent>('mesh');
          if (kiteMesh && kiteMesh.object3D) {
            // TODO: Update debugRenderer to work with ECS entities
            // Récupérer l'objet Kite depuis le MeshComponent
        }
      }

      }

    } catch (error) {
      this.logger.error(`Update error: ${error}`, 'SimulationApp');
    }

    requestAnimationFrame(this.updateLoop);
  };







  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.logger.info('Disposing SimulationApp...', 'SimulationApp');

    this.stop();

    // Dispose tous les systèmes via le gestionnaire
    this.systemManager.disposeAll();

    this.logger.info('✅ SimulationApp disposed', 'SimulationApp');
  }

  // === ACCESSEURS ===

  getSystems() {
    return {
      input: this.inputSystem,
      controlBar: this.controlBarSystem,
      render: this.renderSystem,
      kitePhysics: this.kitePhysicsSystem
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
      fps: this.frameCount / Math.max(this.totalTime, 0.001)
    };
  }

  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  isSimulationInitialized(): boolean {
    return this.isInitialized;
  }
}