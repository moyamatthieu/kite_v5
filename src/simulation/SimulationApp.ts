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

import {
  UIManager,
  type SimulationControls
} from './ui/UIManager';

import { DebugRenderer } from './rendering/DebugRenderer';
import { CONFIG } from './config/SimulationConfig';
import { Kite } from '../objects/Kite';
import { ControlBarManager } from './controllers/ControlBarManager';

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

  // === SYSTÈMES ECS ===
  private physicsSystem!: PhysicsSystem;
  private windSystem!: WindSystem;
  private inputSystem!: InputSystem;
  private renderSystem?: RenderSystem;
  private kitePhysicsSystem?: KitePhysicsSystem;

  // === ENTITÉS ===
  private kite!: Kite;
  private controlBarManager!: ControlBarManager;

  // === COMPOSANTS LEGACY ===
  private controlBar!: THREE.Group;
  private pilot!: THREE.Mesh;
  private leftLine?: THREE.Line;
  private rightLine?: THREE.Line;

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

    // Créer le gestionnaire de barre de contrôle
    this.controlBarManager = new ControlBarManager(CONFIG.controlBar.position.clone());

    // Configurer le système de physique du kite
    if (this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setKite(this.kite);
    }

    // Créer les composants legacy
    if (this.config.enableLegacyComponents) {
      this.createLegacyComponents();
    }
  }

  /**
   * Crée les composants legacy pour compatibilité
   */
  private createLegacyComponents(): void {
    // Barre de contrôle
    this.controlBar = new THREE.Group();
    this.controlBar.name = 'ControlBar';

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
    this.controlBar.add(bar);

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
    this.controlBar.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(halfWidth, 0, 0);
    rightHandle.castShadow = true;
    this.controlBar.add(rightHandle);

    this.controlBar.position.copy(CONFIG.controlBar.position);

    // Pilote
    const pilotGeometry = new THREE.BoxGeometry(
      CONFIG.pilot.width,
      CONFIG.pilot.height,
      CONFIG.pilot.depth
    );
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8
    });

    this.pilot = new THREE.Mesh(pilotGeometry, pilotMaterial);
    this.pilot.position.set(0, CONFIG.pilot.offsetY, CONFIG.pilot.offsetZ);
    this.pilot.castShadow = true;
    this.pilot.name = 'Pilot';

    // Lignes de contrôle
    this.createControlLines();
  }

  /**
   * Crée les lignes de contrôle visuelles
   */
  private createControlLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: CONFIG.visualization.lineWidth
    });

    const segments = 20;
    const points = new Array(segments + 1).fill(0).map(() => new THREE.Vector3());

    const leftLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const rightLineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    this.leftLine = new THREE.Line(leftLineGeometry, lineMaterial);
    this.leftLine.name = 'LeftControlLine';

    this.rightLine = new THREE.Line(rightLineGeometry, lineMaterial);
    this.rightLine.name = 'RightControlLine';
  }

  /**
   * Initialise tous les systèmes
   */
  private async initializeSystems(): Promise<void> {
    const initPromises: Promise<void>[] = [
      this.physicsSystem.initialize(),
      this.windSystem.initialize(),
      this.inputSystem.initialize()
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
      // Ajouter les entités à la scène
      scene.add(this.kite);
      scene.add(this.controlBar);
      scene.add(this.pilot);
      if (this.leftLine) scene.add(this.leftLine);
      if (this.rightLine) scene.add(this.rightLine);
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

      if (this.renderSystem) {
        this.renderSystem.update(context);
      }

      // Synchronisation legacy
      if (this.config.enableLegacyComponents) {
        this.syncLegacyComponents(context);
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
   * Synchronise les composants legacy
   */
  private syncLegacyComponents(_context: any): void {
    if (!this.kitePhysicsSystem) return;

    // Mettre à jour la barre de contrôle
    const inputState = this.inputSystem.getInputState();
    this.controlBarManager.setRotation(inputState.barPosition);

    // Mettre à jour les lignes de contrôle
    this.updateControlLines();
  }

  /**
   * Met à jour les lignes de contrôle
   */
  private updateControlLines(): void {
    if (!this.leftLine || !this.rightLine || !this.kitePhysicsSystem) return;

    const handles = this.controlBarManager.getHandlePositions(this.kite.position);

    // Récupérer les points de contrôle du kite (où les lignes s'attachent)
    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) {
      console.warn("⚠️ Points de contrôle CTRL_GAUCHE ou CTRL_DROIT introuvables");
      return;
    }

    // Convertir les points locaux en coordonnées monde
    const ctrlLeftWorld = this.kite.toWorldCoordinates(ctrlLeft);
    const ctrlRightWorld = this.kite.toWorldCoordinates(ctrlRight);

    // Mettre à jour les lignes avec les vrais points de connexion
    this.updateLineGeometry(this.leftLine, ctrlLeftWorld, handles.left);
    this.updateLineGeometry(this.rightLine, ctrlRightWorld, handles.right);
  }

  /**
   * Met à jour la géométrie d'une ligne
   */
  private updateLineGeometry(line: THREE.Line, start: THREE.Vector3, end: THREE.Vector3): void {
    const geometry = line.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;

    if (!positions) return;

    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const z = start.z + (end.z - start.z) * t;

      positions.setXYZ(i, x, y, z);
    }

    positions.needsUpdate = true;
  }

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