/**
 * SimulationApp.ts - Orchestrateur ECS pur
 *
 * Architecture ECS propre avec séparation des responsabilités.
 * Point d'entrée unique pour la simulation kite.
 */

import * as THREE from 'three';

import { Logger } from '../utils/Logging';
import { MathUtils } from '../utils/MathUtils';

import {
  PhysicsSystem,
  WindSystem,
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  type PhysicsConfig,
  type WindConfig,
  type InputConfig,
  type RenderConfig
} from './systems';
import { ControlBarSystem } from './systems/ControlBarSystem';
import { LinesRenderSystem } from './systems/LinesRenderSystem';

import {
  UIManager,
  type SimulationControls
} from './ui/UIManager';

import { DebugRenderer } from './rendering/DebugRenderer';
import { CONFIG } from './config/SimulationConfig';
import { Kite } from '../objects/Kite';
import { ControlBarManager } from './controllers/ControlBarManager';
import { EntityManager } from './entities/EntityManager';
import { Entity } from './entities/Entity';
import { TransformComponent, MeshComponent } from './components';

export interface SimulationConfig {
  targetFPS: number;
  maxFrameTime: number;
  enableDebug: boolean;
  enableRenderSystem: boolean;
  enableCompletePhysics: boolean;
  enableLegacyComponents: boolean;
  physics: Partial<PhysicsConfig>;
  wind: Partial<WindConfig>;
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
  private physicsSystem!: PhysicsSystem;
  private windSystem!: WindSystem;
  private inputSystem!: InputSystem;
  private renderSystem?: RenderSystem;
  private kitePhysicsSystem?: KitePhysicsSystem;
  private controlBarSystem!: ControlBarSystem;
  private linesRenderSystem!: LinesRenderSystem;

  // === ENTITÉS PRINCIPALES ===
  private kite!: Kite;
  private controlBarEntity!: Entity;
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
      enableLegacyComponents: true,
      physics: {},
      wind: {},
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
    this.physicsSystem = new PhysicsSystem(this.config.physics);
    this.windSystem = new WindSystem(this.config.wind);
    this.inputSystem = new InputSystem(this.config.input);
    this.controlBarSystem = new ControlBarSystem();
    this.linesRenderSystem = new LinesRenderSystem();

    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
    }

    if (this.config.enableCompletePhysics) {
      this.kitePhysicsSystem = new KitePhysicsSystem({
        windSpeed: CONFIG.wind.defaultSpeed,
        windDirection: CONFIG.wind.defaultDirection,
        turbulence: CONFIG.wind.defaultTurbulence,
        lineLength: CONFIG.lines.defaultLength,
        pilotPosition: CONFIG.controlBar.position.clone(),
        enableConstraints: true,
        enableAerodynamics: true,
        enableGravity: true
      });
    }
  }

  /**
   * Calcule la position initiale du kite pour que les lignes soient tendues
   */
  private calculateInitialKitePosition(): THREE.Vector3 {
    return MathUtils.calculateInitialKitePosition(
      CONFIG.controlBar.position,
      CONFIG.initialization.initialKiteY,
      CONFIG.lines.defaultLength,
      CONFIG.initialization.initialDistanceFactor,
      CONFIG.initialization.initialKiteZ
    );
  }

  /**
   * Crée les entités principales
   */
  private createEntities(): void {
    // Créer le kite
    this.kite = new Kite();
    const initialPos = this.calculateInitialKitePosition();
    this.kite.position.copy(initialPos);

    // Configurer le système de physique du kite
    if (this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setKite(this.kite);
    }

    // Créer les entités ECS
    this.createControlBarEntity();
    this.createLineEntities();
  }

  /**
   * Crée l'entité ECS de la barre de contrôle
   */
  private createControlBarEntity(): void {
    // Créer l'entité
    this.controlBarEntity = this.entityManager.createEntity('controlBar');

    // Créer le THREE.Group pour la barre
    const controlBarGroup = new THREE.Group();
    controlBarGroup.name = 'ControlBar';

    const barGeometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.width
    );
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3
    });

    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.rotation.z = CONFIG.controlBar.barRotation;
    bar.castShadow = true;
    controlBarGroup.add(bar);

    // Poignées
    const handleGeometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleLength
    );
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6
    });

    const halfWidth = CONFIG.controlBar.width / 2;
    const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    leftHandle.position.set(-halfWidth, 0, 0);
    leftHandle.castShadow = true;
    controlBarGroup.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(halfWidth, 0, 0);
    rightHandle.castShadow = true;
    controlBarGroup.add(rightHandle);

    controlBarGroup.position.copy(CONFIG.controlBar.position);

    // Ajouter le composant Transform
    const transform = new TransformComponent({
      position: CONFIG.controlBar.position.clone(),
      rotation: 0,
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    });
    this.controlBarEntity.addComponent(transform);

    // Ajouter le composant Mesh
    const mesh = new MeshComponent(controlBarGroup, {
      visible: true,
      castShadow: true,
      receiveShadow: false
    });
    this.controlBarEntity.addComponent(mesh);

    // Configurer le système
    this.controlBarSystem.setControlBarEntity(this.controlBarEntity);
    this.controlBarSystem.setKite(this.kite);
  }

  /**
   * Crée les entités ECS des lignes de contrôle
   */
  private createLineEntities(): void {
    if (!this.renderSystem) return;

    const scene = this.renderSystem.getScene();
    if (!scene) return;

    // Configurer le système
    this.linesRenderSystem.setKite(this.kite);
    this.linesRenderSystem.setControlBarSystem(this.controlBarSystem);

    // Créer les entités de lignes
    this.leftLineEntity = this.linesRenderSystem.createLineEntity('leftLine', 'left', scene);
    this.rightLineEntity = this.linesRenderSystem.createLineEntity('rightLine', 'right', scene);
  }



  /**
   * Initialise tous les systèmes
   */
  private async initializeSystems(): Promise<void> {
    const initPromises: Promise<void>[] = [
      this.physicsSystem.initialize(),
      this.windSystem.initialize(),
      this.inputSystem.initialize(),
      this.controlBarSystem.initialize(),
      this.linesRenderSystem.initialize()
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

    // Créer le debug renderer (requis par UIManager)
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
    if (!this.renderSystem) return;

    const scene = this.renderSystem.getScene();
    if (scene) {
      // Ajouter le kite à la scène
      scene.add(this.kite);

      // Ajouter les entités ECS à la scène via leurs composants Mesh
      const controlBarMesh = this.controlBarEntity.getComponent<MeshComponent>('mesh');
      if (controlBarMesh) {
        scene.add(controlBarMesh.object3D);
      }

      // Les lignes sont gérées par LinesRenderSystem
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
        if (params.speed !== undefined) {
          this.windSystem.setWindSpeed(params.speed);
          if (this.kitePhysicsSystem) {
            this.kitePhysicsSystem.setWindParams({ speed: params.speed });
          }
        }
        if (params.direction !== undefined) {
          this.windSystem.setWindDirection(new THREE.Vector3(
            Math.cos(params.direction * Math.PI / 180),
            0,
            Math.sin(params.direction * Math.PI / 180)
          ));
          if (this.kitePhysicsSystem) {
            this.kitePhysicsSystem.setWindParams({ direction: params.direction });
          }
        }
        if (params.turbulence !== undefined) {
          if (this.windSystem) {
            this.windSystem.setTurbulenceIntensity(params.turbulence / 100);
          }
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

    this.updateLoop();
  }

  /**
   * Arrête la simulation
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('⏸️ Simulation stopped', 'SimulationApp');
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
    this.physicsSystem.reset();
    this.windSystem.reset();
    this.inputSystem.reset();
    this.controlBarSystem.reset();
    this.kitePhysicsSystem?.reset();

    // Reset kite position avec calcul automatique de la position initiale
    const initialPos = this.calculateInitialKitePosition();
    this.kite.position.copy(initialPos);
    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();

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
      this.windSystem.update(context);
      this.physicsSystem.update(context);

      if (this.kitePhysicsSystem) {
        const inputState = this.inputSystem.getInputState();
        this.kitePhysicsSystem.setBarRotation(inputState.barPosition);
        this.kitePhysicsSystem.update(context);
      }

      // Mise à jour du système de barre de contrôle ECS
      const inputState = this.inputSystem.getInputState();
      this.controlBarSystem.setRotation(inputState.barPosition);
      this.controlBarSystem.update(context);

      // Mise à jour du système de rendu des lignes
      this.linesRenderSystem.update(context);

      if (this.renderSystem) {
        this.renderSystem.update(context);
      }

      // Mise à jour UI
      this.uiManager?.updateDebugInfo();

      // Debug visualization
      if (this.debugRenderer && this.kitePhysicsSystem && this.debugRenderer.isDebugMode()) {
        this.debugRenderer.updateDebugArrows(this.kite, this.kitePhysicsSystem);
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
    this.physicsSystem.dispose();
    this.windSystem.dispose();
    this.inputSystem.dispose();
    this.controlBarSystem.dispose();
    this.renderSystem?.dispose();
    this.kitePhysicsSystem?.dispose();

    this.logger.info('✅ SimulationApp disposed', 'SimulationApp');
  }

  // === ACCESSEURS ===

  getSystems() {
    return {
      physics: this.physicsSystem,
      wind: this.windSystem,
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