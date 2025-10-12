/**
 * SimulationApp.ts - Orchestrateur ECS pur
 *
 * Architecture ECS propre avec séparation des responsabilités.
 * Point d'entrée unique pour la simulation kite.
 */

import * as THREE from 'three';

import { Logger } from '../utils/Logging';

import {
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  type InputConfig,
  type RenderConfig
} from './systems';
import { ControlBarSystem } from './systems/ControlBarSystem';
import { LinesRenderSystem } from './systems/LinesRenderSystem';
import { PilotSystem } from './systems/PilotSystem';
import {
  UIManager,
  type SimulationControls
} from './ui/UIManager';
import { DebugRenderer } from './rendering/DebugRenderer';
import { CONFIG } from './config/SimulationConfig';
import { EntityManager } from './entities/EntityManager';
import { TransformComponent, MeshComponent } from './components';
import { ControlBarEntityFactory, PilotEntityFactory, KiteEntityFactory } from './factories';

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

  // === SYSTÈMES ECS ===
  private inputSystem!: InputSystem;
  private renderSystem?: RenderSystem;
  private kitePhysicsSystem?: KitePhysicsSystem;
  private controlBarSystem!: ControlBarSystem;
  private linesRenderSystem!: LinesRenderSystem;
  private pilotSystem!: PilotSystem;

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

      // Créer les systèmes
      await this.createSystems();

      // Créer les entités
      this.createEntities();

      // Initialiser les systèmes
      await this.initializeSystems();

      // Créer l'interface
      this.createInterface();

      // Configurer le rendu
      this.setupRendering();

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
    this.inputSystem = new InputSystem(this.config.input);
    this.controlBarSystem = new ControlBarSystem();
    this.linesRenderSystem = new LinesRenderSystem();
    this.pilotSystem = new PilotSystem();

    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
    }

    if (this.config.enableCompletePhysics) {
      // Position de la barre de contrôle calculée à partir du pilote
      const controlBarPosition = new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
        CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
      );

      this.kitePhysicsSystem = new KitePhysicsSystem({
        windSpeed: CONFIG.wind.defaultSpeed,
        windDirection: CONFIG.wind.defaultDirection,
        turbulence: CONFIG.wind.defaultTurbulence,
        lineLength: CONFIG.lines.defaultLength,
        pilotPosition: controlBarPosition,
        enableConstraints: true,
        enableAerodynamics: true,
        enableGravity: true
      });
    }
  }

  /**
   * Crée les entités principales
   */
  private createEntities(): void {
    // Créer l'entité pilote EN PREMIER (pour que la barre puisse s'y attacher)
    this.createPilotEntity();

    // Créer l'entité kite
    this.createKiteEntity();

    // Créer les entités ECS
    this.createControlBarEntity();
    
    // Note: createLineEntities() est appelée dans setupRendering()
    // car elle nécessite que renderSystem.getScene() retourne une scène valide
    
    this.logger.debug('Entity positions after initialization:', 'SimulationApp');
    const pilotEntity = this.entityManager.getEntity('pilot');
    if (pilotEntity) {
      const pilotTransform = pilotEntity.getComponent<TransformComponent>('transform');
      this.logger.debug(`Pilot position: ${pilotTransform?.position}`, 'SimulationApp');
    }

    const controlBarEntity = this.entityManager.getEntity('controlBar');
    if (controlBarEntity) {
      const barTransform = controlBarEntity.getComponent<TransformComponent>('transform');
      this.logger.debug(`Control bar position: ${barTransform?.position}`, 'SimulationApp');
    }

    const kiteEntity = this.entityManager.getEntity('kite');
    if (kiteEntity) {
      const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
      this.logger.debug(`Kite position: ${kiteTransform?.position}`, 'SimulationApp');
    }
  }

  /**
   * Crée l'entité ECS du kite
   */
  private createKiteEntity(): void {
    // Créer l'entité via factory (objet Kite + composants ECS)
    const kiteEntity = KiteEntityFactory.create();
    
    // Enregistrer dans EntityManager
    this.entityManager.registerEntity(kiteEntity);

    // Note: Le kite sera ajouté à la scène dans setupRendering()
    // Ne pas ajouter ici pour éviter la duplication

    // Configurer le système de physique du kite
    if (this.kitePhysicsSystem) {
      // Extraire l'objet Kite du MeshComponent
      const kite = KiteEntityFactory.getKiteObject(kiteEntity);
      if (kite) {
        this.kitePhysicsSystem.setKite(kite);

        // Connecter le ControlBarSystem pour fournir les positions des poignées
        this.kitePhysicsSystem.setHandlesProvider({
          getHandlePositions: () => this.controlBarSystem.getHandlePositions()
        });
      }
    }
  }

  /**
   * Crée l'entité ECS de la barre de contrôle
   */
  private createControlBarEntity(): void {
    // Récupérer le pilote pour attachement
    const pilotEntity = this.entityManager.getEntity('pilot');
    const pilotMesh = pilotEntity?.getComponent<MeshComponent>('mesh');
    
    // Créer l'entité via factory (géométrie + composants ECS)
    const controlBarEntity = ControlBarEntityFactory.create({
      parentObject: pilotMesh?.object3D
    });
    
    // Enregistrer dans EntityManager
    this.entityManager.registerEntity(controlBarEntity);
    
    // Configurer les systèmes
    this.controlBarSystem.setControlBarEntity(controlBarEntity);
    this.controlBarSystem.setInputSystem(this.inputSystem);
    
    // Initialiser la position de référence dans le système pilote
    const worldPosition = new THREE.Vector3();
    const controlBarMesh = controlBarEntity.getComponent<MeshComponent>('mesh');
    if (controlBarMesh) {
      controlBarMesh.object3D.getWorldPosition(worldPosition);
      this.pilotSystem.setControlBarPosition(worldPosition);
      this.logger.info('ControlBar attached as child of Pilot', 'SimulationApp');
    }
  }

  /**
   * Crée les entités ECS des lignes de contrôle
   */
  private createLineEntities(): void {
    if (!this.renderSystem) return;

    const scene = this.renderSystem.getScene();
    if (!scene) return;

    // Récupérer le kite depuis EntityManager
    const kiteEntity = this.entityManager.getEntity('kite');
    if (kiteEntity) {
      const kite = KiteEntityFactory.getKiteObject(kiteEntity);
      if (kite) {
        this.linesRenderSystem.setKite(kite);
      }
    }

    // Configurer le système
    this.linesRenderSystem.setControlBarSystem(this.controlBarSystem);

    // Connecter le système de physique pour la visualisation des tensions
    if (this.kitePhysicsSystem) {
      this.linesRenderSystem.setKitePhysicsSystem(this.kitePhysicsSystem);
    }

    // Créer les entités de lignes (elles sont gérées par LinesRenderSystem)
    this.linesRenderSystem.createLineEntity('leftLine', 'left', scene);
    this.linesRenderSystem.createLineEntity('rightLine', 'right', scene);
  }

  /**
   * Crée l'entité ECS du pilote
   */
  private createPilotEntity(): void {
    // Créer l'entité via factory
    const pilotEntity = PilotEntityFactory.create();

    // Enregistrer dans EntityManager
    this.entityManager.registerEntity(pilotEntity);

    // Configurer le système pilote
    this.pilotSystem.setPilotEntity(pilotEntity);

    // Note: La position de la barre de contrôle sera initialisée dans createControlBarEntity()
    // après que la barre soit créée et attachée au pilote
  }



  /**
   * Initialise tous les systèmes
   */
  private async initializeSystems(): Promise<void> {
    const initPromises: Promise<void>[] = [
      this.inputSystem.initialize(),
      this.controlBarSystem.initialize(),
      this.linesRenderSystem.initialize(),
      this.pilotSystem.initialize()
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
    }, this.kitePhysicsSystem);

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
    if (!this.renderSystem) {
      console.error('❌ RenderSystem is null');
      return;
    }

    const scene = this.renderSystem.getScene();
    if (!scene) {
      console.error('❌ Scene is null');
      return;
    }

    this.logger.info('Setting up rendering...', 'SimulationApp');

    // Créer les entités de lignes (nécessite que la scène soit initialisée)
    this.createLineEntities();

    // Ajouter le kite à la scène
    const kiteEntity = this.entityManager.getEntity('kite');
    if (kiteEntity) {
      const kiteMesh = kiteEntity.getComponent<MeshComponent>('mesh');
      if (kiteMesh) {
        scene.add(kiteMesh.object3D);
        this.logger.info('Kite added to scene', 'SimulationApp');
      } else {
        this.logger.error('Kite mesh component not found', 'SimulationApp');
      }
    } else {
      this.logger.error('Kite entity not found', 'SimulationApp');
    }

    // Ajouter les entités ECS à la scène via leurs composants Mesh
    // Note: ControlBar n'est plus ajoutée directement car elle est enfant du Pilot
    const pilotEntity = this.entityManager.getEntity('pilot');
    if (pilotEntity) {
      const pilotMesh = pilotEntity.getComponent<MeshComponent>('mesh');
      if (pilotMesh) {
        scene.add(pilotMesh.object3D); // Ajoute le pilote ET sa barre de contrôle enfant
      }
    }

    // Démarrer le rendu
    this.renderSystem.startRendering();
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
      getLineLength: () => this.kitePhysicsSystem?.getLineSystem()?.lineLength || CONFIG.lines.defaultLength,
      getControlLineDiagnostics: () => {
        return this.kitePhysicsSystem?.getControlLineDiagnostics() || null;
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
    const initialPos = KiteEntityFactory.calculateInitialPosition();
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

    const context = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug
    };

    try {
      // Mise à jour des systèmes dans l'ordre des priorités
      this.inputSystem.update(context);

      if (this.kitePhysicsSystem) {
        const inputState = this.inputSystem.getInputState();
        this.kitePhysicsSystem.setBarRotation(inputState.barPosition);
        this.kitePhysicsSystem.update(context);
      }

      // Mise à jour du système de barre de contrôle ECS
      // (La rotation est maintenant obtenue directement depuis InputSystem)
      this.controlBarSystem.update(context);

      // Mise à jour du système pilote
      this.pilotSystem.update(context);

      // Note: Synchronisation kite ECS effectuée directement via les systèmes
      // Plus besoin de référence temporaire au système legacy

      // Mise à jour du système de rendu des lignes
      this.linesRenderSystem.update(context);

      if (this.renderSystem) {
        this.renderSystem.update(context);
      }

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
            // Récupérer l'objet Kite depuis le MeshComponent
            const kite = KiteEntityFactory.getKiteObject(kiteEntity);
            if (kite) {
              this.debugRenderer.updateDebugVectors(kite, this.kitePhysicsSystem);
            }
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

    // Dispose systems
    this.inputSystem.dispose();
    this.controlBarSystem.dispose();
    this.renderSystem?.dispose();
    this.kitePhysicsSystem?.dispose();

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