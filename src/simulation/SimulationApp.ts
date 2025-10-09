/**
 * SimulationApp.ts - Application principale de simulation (Architecture ECS-inspired)
 *
 * Nouvelle architecture modulaire avec systèmes de simulation séparés.
 * Chaque système (Physics, Wind, Input, Render) fonctionne indépendamment
 * et communique via un contexte partagé.
 */

import * as THREE from 'three';
import { Logger } from '../utils/Logging';
import { UidGenerator } from '../utils/UidGenerator';

// Import des systèmes modulaires
import {
  PhysicsSystem,
  WindSystem,
  InputSystem,
  RenderSystem,
  type PhysicsState,
  type PhysicsConfig,
  type WindConfig,
  type InputConfig,
  type RenderConfig
} from './systems';

// Import des composants existants (temporairement pour compatibilité)
import { Kite } from '../objects/organic/Kite';
import { UIManager } from './ui/UIManager';
import { CONFIG } from './config/SimulationConfig';
import { KiteGeometry } from './config/KiteGeometry';

export interface SimulationConfig {
  targetFPS: number;
  maxFrameTime: number;
  enableDebug: boolean;
  enableRenderSystem: boolean;
  enableLegacyComponents: boolean; // Nouveau flag pour contrôler les composants legacy
  physics: Partial<PhysicsConfig>;
  wind: Partial<WindConfig>;
  input: Partial<InputConfig>;
  render: Partial<RenderConfig>;
}

export class SimulationApp {
  private logger: Logger;
  private config: SimulationConfig;

  // Systèmes ECS-inspired
  private physicsSystem!: PhysicsSystem;
  private windSystem!: WindSystem;
  private inputSystem!: InputSystem;
  private renderSystem!: RenderSystem;

  // Composants existants (pour compatibilité)
  private kite!: Kite;
  private uiManager!: UIManager;
  private controlBar!: THREE.Group;

  // État de simulation
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private totalTime: number = 0;
  private lastFrameTime: number = 0;

  // Gestion des objets physiques
  private physicsObjects = new Map<string, PhysicsState>();

  constructor(config: Partial<SimulationConfig> = {}) {
    this.logger = Logger.getInstance();
    this.clock = new THREE.Clock();

    // Configuration par défaut
    this.config = {
      targetFPS: 60,
      maxFrameTime: 1/30, // 30 FPS minimum
      enableDebug: true,
      enableRenderSystem: true,
      enableLegacyComponents: false, // Désactiver par défaut pour éviter les erreurs de mocks
      physics: {},
      wind: {},
      input: {},
      render: {},
      ...config
    };

    this.logger.info('SimulationApp initializing with ECS architecture', 'SimulationApp');

    // Initialiser les systèmes
    this.initializeSystems();

    // Initialiser les composants existants (si activés)
    if (this.config.enableLegacyComponents) {
      this.initializeLegacyComponents();
    }
  }

  /**
   * Initialise tous les systèmes de simulation
   */
  private initializeSystems(): void {
    this.logger.info('Initializing simulation systems...', 'SimulationApp');

    // Créer les systèmes avec leurs configurations
    this.physicsSystem = new PhysicsSystem(this.config.physics);
    this.windSystem = new WindSystem(this.config.wind);
    this.inputSystem = new InputSystem(this.config.input);

    // Créer le système de rendu seulement si activé
    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
    }

    this.logger.info('All simulation systems created', 'SimulationApp');
  }

  /**
   * Initialise les composants existants pour compatibilité
   */
  private initializeLegacyComponents(): void {
    this.logger.info('Initializing legacy components...', 'SimulationApp');

    // Configurer la géométrie du kite
    KiteGeometry.setMeshSubdivisionLevel(CONFIG.kite.defaultMeshSubdivisionLevel);

    // Créer la barre de contrôle
    this.setupControlBar();

    // Créer le kite
    this.kite = new Kite();
    this.kite.position.set(0, 5, 0);

    // Ajouter le kite à la scène de rendu (si RenderSystem activé)
    if (this.config.enableRenderSystem && this.renderSystem) {
      const scene = this.renderSystem.getScene();
      if (scene) {
        scene.add(this.kite);
        scene.add(this.controlBar);
      }
    }

    // Créer l'UI Manager (avec mocks appropriés)
    const physicsEngineMock = {
      getBridleLengths: () => ({ nez: 0.5, center: 0.5, tip: 0.5 }),
      setBridleLength: () => {},
      getKiteState: () => ({}),
      getWindState: () => ({}),
      update: () => {}
    } as any;

    const debugRendererMock = {
      isDebugMode: () => false,
      toggleDebugMode: () => {},
      renderDebugInfo: () => {},
      clearDebugInfo: () => {},
      setDebugMode: () => {},
      renderManager: {} as any,
      debugArrows: [],
      debugMode: false,
      vectorVisibility: {}
    } as any;

    this.uiManager = new UIManager(
      physicsEngineMock,
      debugRendererMock,
      () => this.reset(), // resetCallback
      () => { /* toggle play */ } // togglePlayCallback
    );

    // Enregistrer le kite comme objet physique
    this.registerPhysicsObject('kite', {
      position: this.kite.position.clone(),
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      angularAcceleration: new THREE.Vector3(),
      mass: 0.5, // kg
      momentOfInertia: new THREE.Matrix3().identity()
    });

    this.logger.info('Legacy components initialized', 'SimulationApp');
  }

  /**
   * Configure la barre de contrôle
   */
  private setupControlBar(): void {
    this.controlBar = new THREE.Group();
    this.controlBar.name = 'ControlBar';

    // Créer une barre simple pour l'instant
    const barGeometry = new THREE.CylinderGeometry(0.02, 0.02, 2);
    const barMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const bar = new THREE.Mesh(barGeometry, barMaterial);

    this.controlBar.add(bar);
    this.controlBar.position.set(0, 1, 5);
  }

  /**
   * Initialise l'application de simulation
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Starting SimulationApp initialization...', 'SimulationApp');

      // Initialiser tous les systèmes
      const initPromises = [
        this.physicsSystem.initialize(),
        this.windSystem.initialize(),
        this.inputSystem.initialize()
      ];

      // Ajouter RenderSystem seulement si activé
      if (this.config.enableRenderSystem) {
        initPromises.push(this.renderSystem.initialize());
      }

      await Promise.all(initPromises);

      // Démarrer le rendu (si activé)
      if (this.config.enableRenderSystem) {
        this.renderSystem.startRendering();
      }

      this.isInitialized = true;
      this.logger.info('SimulationApp fully initialized', 'SimulationApp');

    } catch (error) {
      this.logger.error(`SimulationApp initialization failed: ${error}`, 'SimulationApp');
      throw error;
    }
  }

  /**
   * Boucle principale de simulation (ECS-inspired)
   */
  update = (): void => {
    if (!this.isInitialized || !this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, this.config.maxFrameTime);
    this.lastFrameTime = currentTime;

    this.totalTime += deltaTime;
    this.frameCount++;

    // Créer le contexte de simulation partagé
    const context = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug
    };

    try {
      // 1. Mise à jour des entrées (priorité haute)
      this.inputSystem.update(context);

      // 2. Mise à jour du vent
      this.windSystem.update(context);

      // 3. Mise à jour de la physique
      this.physicsSystem.update(context);

      // 4. Mise à jour du rendu (priorité basse)
      if (this.config.enableRenderSystem) {
        this.renderSystem.update(context);
      }

      // 5. Synchronisation avec les composants existants
      this.syncLegacyComponents(context);

      // 6. Mise à jour de l'UI
      this.updateUI(context);

    } catch (error) {
      this.logger.error(`Simulation update error: ${error}`, 'SimulationApp');
    }

    // Continuer la boucle
    if (this.isRunning) {
      requestAnimationFrame(this.update);
    }
  };

  /**
   * Synchronise les composants existants avec les systèmes
   */
  private syncLegacyComponents(context: any): void {
    if (!this.config.enableLegacyComponents) return;

    // Obtenir l'état des entrées
    const inputState = this.inputSystem.getInputState();

    // Appliquer la rotation de la barre
    this.controlBar.rotation.z = inputState.barPosition * Math.PI / 6; // Max ±30°

    // Obtenir l'état physique du kite
    const kitePhysics = this.physicsObjects.get('kite');
    if (kitePhysics) {
      // Synchroniser la position du kite
      this.kite.position.copy(kitePhysics.position);

      // Calculer le vent apparent pour le kite
      const apparentWind = this.windSystem.getApparentWind(
        kitePhysics.position,
        kitePhysics.velocity
      );

      // TODO: Appliquer les forces aérodynamiques basées sur le vent apparent
      // Pour l'instant, juste une force de gravité simple
      if (kitePhysics.position.y > 0) {
        kitePhysics.acceleration.set(0, -9.81, 0);
      } else {
        kitePhysics.acceleration.set(0, 0, 0);
        kitePhysics.velocity.set(0, 0, 0);
        kitePhysics.position.y = 0;
      }

      // Intégration simple d'Euler
      kitePhysics.velocity.add(kitePhysics.acceleration.clone().multiplyScalar(context.deltaTime));
      kitePhysics.position.add(kitePhysics.velocity.clone().multiplyScalar(context.deltaTime));
    }

    // Gestion du reset
    if (inputState.resetPressed) {
      this.reset();
    }
  }

  /**
   * Met à jour l'interface utilisateur
   */
  private updateUI(context: any): void {
    // Mettre à jour l'UI si elle existe
    this.updateUIOverlay();
  }

  /**
   * Met à jour l'overlay UI avec les données actuelles
   */
  private updateUIOverlay(): void {
    if (typeof document === 'undefined') return;

    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('kite-pos');
    const velElement = document.getElementById('kite-vel');
    const windElement = document.getElementById('wind-speed');
    const barElement = document.getElementById('bar-pos');

    if (fpsElement || posElement || velElement || windElement || barElement) {
      const renderStats = this.renderSystem ? this.renderSystem.getRenderStats() : { fps: 0 };
      const kitePhysics = this.physicsObjects.get('kite');
      const inputState = this.inputSystem.getInputState();
      const windState = this.windSystem.getWindState();

      if (fpsElement) {
        fpsElement.textContent = `FPS: ${renderStats.fps}`;
      }

      if (posElement && kitePhysics) {
        posElement.textContent = `Position: (${kitePhysics.position.x.toFixed(1)}, ${kitePhysics.position.y.toFixed(1)}, ${kitePhysics.position.z.toFixed(1)})`;
      }

      if (velElement && kitePhysics) {
        velElement.textContent = `Vitesse: (${kitePhysics.velocity.x.toFixed(1)}, ${kitePhysics.velocity.y.toFixed(1)}, ${kitePhysics.velocity.z.toFixed(1)})`;
      }

      if (windElement) {
        windElement.textContent = `Vent: ${windState.baseSpeed.toFixed(1)} m/s`;
      }

      if (barElement) {
        barElement.textContent = `Barre: ${(inputState.barPosition * 100).toFixed(0)}%`;
      }
    }
  }

  /**
   * Enregistre un objet physique dans le système
   */
  registerPhysicsObject(id: string, state: PhysicsState): void {
    this.physicsObjects.set(id, state);
    this.physicsSystem.registerPhysicsObject(id, state);
  }

  /**
   * Démarre la simulation
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('SimulationApp must be initialized before starting');
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.logger.info('SimulationApp started', 'SimulationApp');

    // Démarrer la boucle
    requestAnimationFrame(this.update);
  }

  /**
   * Arrête la simulation
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('SimulationApp stopped', 'SimulationApp');
  }

  /**
   * Réinitialise la simulation
   */
  reset(): void {
    this.logger.info('Resetting simulation...', 'SimulationApp');

    // Réinitialiser les systèmes
    this.physicsSystem.reset();
    this.windSystem.reset();
    this.inputSystem.reset();
    if (this.renderSystem) {
      this.renderSystem.reset();
    }

    // Réinitialiser l'état
    this.frameCount = 0;
    this.totalTime = 0;

    // Réinitialiser les objets physiques
    for (const [id, state] of this.physicsObjects) {
      // TODO: Implémenter une logique de reset par objet
    }

    // Réinitialiser les composants existants
    this.kite.position.set(0, 5, 0);
    this.controlBar.rotation.z = 0;

    this.logger.info('Simulation reset complete', 'SimulationApp');
  }

  /**
   * Obtient les statistiques de performance
   */
  getStats(): {
    fps: number;
    frameCount: number;
    totalTime: number;
    isRunning: boolean;
    physicsObjects: number;
  } {
    const renderStats = this.renderSystem ? this.renderSystem.getRenderStats() : { fps: 0 };

    return {
      fps: renderStats.fps,
      frameCount: this.frameCount,
      totalTime: this.totalTime,
      isRunning: this.isRunning,
      physicsObjects: this.physicsObjects.size
    };
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.logger.info('Disposing SimulationApp...', 'SimulationApp');

    this.stop();

    // Disposer les systèmes
    this.physicsSystem.dispose();
    this.windSystem.dispose();
    this.inputSystem.dispose();
    if (this.config.enableRenderSystem) {
      this.renderSystem.dispose();
    }

    // Disposer les composants existants
    if (this.config.enableLegacyComponents) {
      if (this.uiManager) {
        // Note: UIManager n'a pas de méthode dispose
      }
    }

    this.logger.info('SimulationApp disposed', 'SimulationApp');
  }
}