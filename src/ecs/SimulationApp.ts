/**
 * SimulationApp.ts - Orchestrateur principal de la simulation
 * 
 * Responsabilités :
 * - Initialisation : EntityManager, SystemManager, création des entités
 * - Update loop : mise à jour des systèmes à chaque frame
 * - Gestion du cycle de vie : pause/resume/reset/dispose
 * 
 * =============================================================================
 * ARCHITECTURE ECS - RESPONSABILITÉS DES SYSTEMS
 * =============================================================================
 * 
 * ORDRE D'EXÉCUTION (critique) :
 * 1. INPUT & SYNC (Priority 1-10)
 *    - EnvironmentSystem : Setup scène 3D (lumières, sol, axes)
 *    - CameraControlsSystem : Gestion caméra (OrbitControls)
 *    - InputSyncSystem : Sync InputComponent ↔ WindSystem
 *    - BridleConstraintSystem : Calcul points CTRL_L/R par trilatération
 *    - InputSystem : Capture clavier/souris
 * 
 * 2. SIMULATION (Priority 20-40)
 *    - WindSystem : Calcul vent apparent (ambiant - vitesse_kite + turbulence)
 *    - AeroSystemNASA : Forces aérodynamiques (portance/traînée NASA) → accumule forces
 *    - LineSystem : Gestion des lignes de vol (SLACK/TAUT) → accumule forces + torques
 *    - PilotSystem : Input pilote → déplacement barre (TODO: actuellement cinématique)
 *    - PhysicsSystem : Intégration Euler (forces → velocity → position)
 * 
 * 3. RENDERING (Priority 50-100)
 *    - GeometryRenderSystem : Crée meshes Three.js (barre, kite, spheres)
 *    - LineRenderSystem : Visualise lignes (couleur selon tension)
 *    - BridleRenderSystem : Visualise brides (système de 6 lignes)
 *    - DebugSystem : Affiche vecteurs forces/velocity (F5 pour toggle)
 *    - RenderSystem : Rendu final Three.js
 *    - UISystem : Interface utilisateur (dat.GUI)
 *    - SimulationLogger : Logs périodiques (tous les N frames)
 * 
 * FLUX DE DONNÉES :
 * InputComponent → WindSystem → AeroSystemNASA → PhysicsComponent.forces
 *                             → LineSystem → PhysicsComponent.forces + torques
 *                                           → PhysicsSystem → TransformComponent
 * 
 * PRINCIPES ECS STRICTS :
 * - Components = DONNÉES PURES (pas de logique, sérialisables POJO)
 * - Systems = LOGIQUE PURE (opèrent sur entités avec certains composants)
 * - Entities = ID + Collection de composants
 * - Pas de logique dans Components, pas de données dans Systems
 * 
 * DUPLICATIONS IDENTIFIÉES À REFACTORISER :
 * - Intégration Euler : PhysicsSystem (peut être extrait dans PhysicsIntegrator)
 * - Calcul torque : LineSystem, AeroSystemNASA (τ = r × F, identique)
 * - Smoothing forces : AeroSystemNASA (lissage exponentiel générique)
 */

import * as THREE from 'three';

import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/SystemManager';
import { KiteFactory, LineFactory, ControlBarFactory, PilotFactory, UIFactory, BridleFactory } from './entities';
import { DebugFactory } from './entities/DebugFactory';
import {
  InputSyncSystem,
  InputSystem,
  WindSystem,
  BridleConstraintSystem,
  BridleRenderSystem,
  PhysicsSystem,
  PilotSystem,
  GeometryRenderSystem,
  LineRenderSystem,
  RenderSystem,
  EnvironmentSystem,
  CameraControlsSystem,
  UISystem,
  DebugSystem,
  SimulationLogger,
  LineSystem,
} from './systems';
import { AeroSystemNASA } from './systems/AeroSystemNASA';
import { CONFIG, SimulationConstants } from './config/Config';
import { Logger } from './utils/Logging';
import type { SimulationContext } from './core/System';
import type { RenderSystem as RenderSystemType } from './systems/RenderSystem';
import type { DebugSystem as DebugSystemType } from './systems/DebugSystem';
import { InputComponent, type InputState } from './components/InputComponent';

export class SimulationApp {
  private entityManager: EntityManager;
  private systemManager: SystemManager;
  private lastTime = 0;
  private paused = !CONFIG.simulation.autoStart; // Lecture depuis la config (autoStart: true => paused: false)
  private logger = Logger.getInstance();
  
  // Système aérodynamique NASA (seul mode disponible)
  private aeroSystemNASA!: AeroSystemNASA;

  // Système de lignes simplifié (inextensible)
  private lineSystem!: LineSystem;
  
  private animationFrameId: number | null = null;
  
  constructor(private canvas: HTMLCanvasElement) {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager();
  }
  
  /**
   * Initialise la simulation
   */
  async initialize(): Promise<void> {
    this.createEntities();
    this.createSystems();
    
    // Le canvas est déjà attaché au DOM dans createSystems()
    // avant la création des OrbitControls
    
    await this.systemManager.initializeAll(this.entityManager);
    
    this.lastTime = performance.now();
  }
  
  /**
   * Crée les entités de la simulation
   */
  private createEntities(savedInputValues?: InputState): void {
    const controlBarPos = CONFIG.initialization.controlBarPosition.clone();
    
    // Position du kite calculée depuis controlBar
    // Système de coordonnées: X=droite, Y=haut, Z=devant (négatif)
    const kitePos = new THREE.Vector3(
      controlBarPos.x,
      controlBarPos.y + CONFIG.initialization.kiteAltitude, // Plus haut
      controlBarPos.z - CONFIG.initialization.kiteDistance  // Plus devant (Z négatif)
    );

    // ✅ VALIDATION GÉOMÉTRIQUE
    // Distance 3D entre barre et kite doit être < longueur de ligne pour démarrage en slack
    // Distance 3D = √((0-0)² + (8)² + (11)²) = √(64 + 121) = 13.6m
    // Longueur ligne = 15m
    // 13.6m < 15m ✅ Les lignes démarrent SLACK comme prévu

    // Positions initiales calculées (désactivé en production)
    // console.log('=== POSITIONS INITIALES ===');
    // console.log('Pilote:', new THREE.Vector3(0, 0, 0));
    // console.log('Barre:', controlBarPos);
    // console.log('Kite:', kitePos);
    
    // === PILOTE (origine) ===
    const pilot = PilotFactory.create();
    this.entityManager.register(pilot);
    
    // Barre de contrôle
    const controlBar = ControlBarFactory.create(controlBarPos);
    this.entityManager.register(controlBar);
    
    // Lignes
    const leftLine = LineFactory.create('left');
    const rightLine = LineFactory.create('right');
    this.entityManager.register(leftLine);
    this.entityManager.register(rightLine);
    
    // Brides (6 entités)
    const bridles = BridleFactory.createAll();
    bridles.forEach(bridle => this.entityManager.register(bridle));
    
    // Kite
    const kite = KiteFactory.create(kitePos);
    this.entityManager.register(kite);

    // UI Entity
    const ui = UIFactory.create(savedInputValues);
    this.entityManager.register(ui);
    
    // Debug Entity (pour la visualisation des vecteurs)
    const debug = DebugFactory.create();
    this.entityManager.register(debug);
  }
  
  /**
   * Crée et enregistre les systèmes
   */
  private createSystems(): void {
    // === Créer RenderSystem avec le canvas fourni au constructeur ===
    const renderSystem = new RenderSystem(this.canvas);
    const scene = renderSystem.scene;
    const camera = renderSystem.camera;

    // Le canvas est déjà attaché au DOM (fourni par main.ts)
    // Pas besoin de l'attacher à nouveau

    // Créer DebugSystem
    const debugSystem = new DebugSystem();

    // Initialiser les systèmes aérodynamiques et de lignes
    this.initializeAeroSystems();
    this.initializeLineSystem();

    // Configurer le pipeline de systèmes
    this.setupSystemPipeline(scene, this.canvas, camera, debugSystem, renderSystem);

    // Stocker le renderSystem dans le debugSystem
    (debugSystem as DebugSystemType).renderSystem = renderSystem;
  }

  /**
   * Initialise les systèmes aérodynamiques selon la configuration
   */
  private initializeAeroSystems(): void {
    this.aeroSystemNASA = new AeroSystemNASA();
    this.aeroSystemNASA.setEnabled(true); // NASA est le seul mode disponible
  }

  /**
   * Initialise le système de lignes (LineSystem)
   */
  private initializeLineSystem(): void {
    this.lineSystem = new LineSystem();
    this.lineSystem.setEnabled(true);

    // LineSystem : lignes inextensibles simplifiées
    // - Contrainte unilatérale (distance ≤ maxLength)
    // - SLACK : aucune force
    // - TAUT : force de tension (pas de compression)
    // - Transfert bidirectionnel de traction
  }

  /**
   * Configure le pipeline de systèmes dans l'ordre de priorité
   */
  private setupSystemPipeline(
    scene: THREE.Scene, 
    canvas: HTMLCanvasElement, 
    camera: THREE.PerspectiveCamera,
    debugSystem: DebugSystem,
    renderSystem: RenderSystemType
  ): void {
    // Ordre critique : respecte le flux ECS (Input → Physics → Render)
    this.systemManager.add(new EnvironmentSystem(scene)); // Priority 1
    this.systemManager.add(new CameraControlsSystem(canvas, camera)); // Priority 1
    this.systemManager.add(new InputSyncSystem()); // Priority 5
    this.systemManager.add(new BridleConstraintSystem()); // Priority 10
    this.systemManager.add(new InputSystem()); // Priority 10
    this.systemManager.add(new WindSystem()); // Priority 20
    
    // Système aérodynamique NASA (seul mode disponible)
    this.systemManager.add(this.aeroSystemNASA); // Priority 30

    // Système de lignes (lignes inextensibles)
    this.systemManager.add(this.lineSystem); // Priority 40
    
    this.systemManager.add(new SimulationLogger()); // Priority 45
    this.systemManager.add(new PhysicsSystem()); // Priority 50
    this.systemManager.add(new PilotSystem()); // Priority 55
    this.systemManager.add(new LineRenderSystem()); // Priority 55
    this.systemManager.add(new BridleRenderSystem()); // Priority 56
    this.systemManager.add(new GeometryRenderSystem()); // Priority 60
    this.systemManager.add(renderSystem); // Priority 70 - Utiliser l'instance déjà créée
    this.systemManager.add(debugSystem); // Priority 88
    this.systemManager.add(new UISystem()); // Priority 90
  }
  
  /**
   * Vérifie les commandes UI (pause, reset)
   */
  private checkUICommands(): void {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (!uiEntity) return;
    
    const inputComp = uiEntity.getComponent<InputComponent>('Input');
    if (!inputComp) return;
    
    // Synchroniser l'état de pause avec InputComponent
    if (inputComp.isPaused !== this.paused) {
      this.paused = inputComp.isPaused;
    }
    
    // Gérer le reset
    if (inputComp.resetSimulation) {
      inputComp.resetSimulation = false; // Reset le flag
      void this.reset();
    }
  }
  
  /**
   * Démarre la boucle de simulation
   */
  start(): void {
    // L'état de pause est défini par CONFIG.simulation.autoStart
    // et synchronisé avec InputComponent.isPaused
    this.lastTime = performance.now();
    this.update();
  }



  /**
   * Boucle de mise à jour principale
   */
  private update = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min(
      (currentTime - this.lastTime) / SimulationConstants.MS_TO_SECONDS, 
      SimulationConstants.MAX_DELTA_TIME
    );
    this.lastTime = currentTime;
    
    // Vérifier les commandes UI (pause/reset)
    this.checkUICommands();

    const context: SimulationContext = {
      deltaTime: this.paused ? 0 : deltaTime, // Pas de deltaTime en pause
      totalTime: currentTime / SimulationConstants.MS_TO_SECONDS,
      entityManager: this.entityManager
    };
    
    if (this.paused) {
      // En pause : exécuter les systèmes physiques ET de rendu
      // Cela permet d'afficher les forces même en pause (gravité, etc)
      const systemsToRun = ['AeroSystemNASA', 'GeometryRenderSystem', 'LineRenderSystem', 'BridleRenderSystem', 'RenderSystem', 'DebugSystem', 'UISystem'];
      systemsToRun.forEach(name => {
        const system = this.systemManager.getSystem(name);
        if (system && system.isEnabled()) {
          system.update(context);
        }
      });
    } else {
      // En cours : exécuter TOUS les systèmes
      this.systemManager.updateAll(context);
    }
    
    this.animationFrameId = requestAnimationFrame(this.update);
  };
  
  /**
   * Pause la simulation
   */
  pause(): void {
    this.paused = true;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Reprend la simulation
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.update();
  }
  
  /**
   * Réinitialise la simulation
   */
  async reset(): Promise<void> {
    const wasPaused = this.paused;
    const savedInputValues = this.saveInputState() ?? undefined;
    
    this.cleanupBeforeReset();
    this.removeAllEntities();
    
    this.createEntities(savedInputValues);
    await this.systemManager.initializeAll(this.entityManager);
    
    this.restorePauseState(wasPaused);
    this.logResetComplete();
  }

  /**
   * Sauvegarde l'état actuel de l'InputComponent
   */
  private saveInputState(): InputState | null {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (!uiEntity) return null;

    const input = uiEntity.getComponent<InputComponent>('Input');
    if (!input) return null;

    return {
      windSpeed: input.windSpeed,
      windDirection: input.windDirection,
      windTurbulence: input.windTurbulence,
      lineLength: input.lineLength,
      bridleNez: input.bridleNez,
      bridleInter: input.bridleInter,
      bridleCentre: input.bridleCentre,
      constraintMode: input.constraintMode,
      aeroMode: input.aeroMode,
      linearDamping: input.linearDamping,
      angularDamping: input.angularDamping,
      meshSubdivisionLevel: input.meshSubdivisionLevel,
      liftScale: input.liftScale,
      dragScale: input.dragScale,
      forceSmoothing: input.forceSmoothing,
      debugMode: input.debugMode,
      resetSimulation: false,
      isPaused: input.isPaused,
      showNormals: input.showNormals,
      barRotationInput: input.barRotationInput
    };
  }

  /**
   * Nettoie les états des systèmes avant le reset
   */
  private cleanupBeforeReset(): void {
    const renderSystem = this.systemManager.getSystem('RenderSystem') as RenderSystemType;
    if (renderSystem?.resetRenderState) {
      renderSystem.resetRenderState();
    }

    const debugSystem = this.systemManager.getSystem('DebugSystem') as DebugSystemType;
    if (debugSystem?.resetDebugState) {
      debugSystem.resetDebugState();
    }
  }

  /**
   * Supprime toutes les entités
   */
  private removeAllEntities(): void {
    const entities = this.entityManager.getAllEntities();
    entities.forEach(entity => this.entityManager.removeEntity(entity.id));
  }

  /**
   * Restaure l'état de pause après un reset
   */
  private restorePauseState(wasPaused: boolean): void {
    this.paused = wasPaused;
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (uiEntity) {
      const inputComp = uiEntity.getComponent<InputComponent>('Input');
      if (inputComp) {
        inputComp.isPaused = wasPaused;
      }
    }
  }

  /**
   * Log la confirmation du reset
   */
  private logResetComplete(): void {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (uiEntity) {
      const inputComp = uiEntity.getComponent<InputComponent>('Input');
      if (inputComp) {
        this.logger.info(
          `🔄 RESET COMPLETE | Constraint: ${inputComp.constraintMode} | Aero: ${inputComp.aeroMode}`, 
          'SimulationApp'
        );
      }
    }
  }
  
  /**
   * Active/désactive le debug aérodynamique détaillé
   * Permet de voir tous les calculs intermédiaires (positions, orientations, forces)
   * 
   * @param enabled Activer le debug
   * @param surfaceIndex Index de la surface à déboguer (0-3) ou -1 pour toutes
   * 
   * Utilisation depuis la console du navigateur:
   * ```
   * window.app.setAeroDebug(true, 0)  // Debug surface 0 uniquement
   * window.app.setAeroDebug(true)     // Debug TOUTES les surfaces
   * window.app.setAeroDebug(false)    // Désactiver
   * ```
   */
  setAeroDebug(enabled: boolean, surfaceIndex: number = -1): void {
    if (this.aeroSystemNASA) {
      this.aeroSystemNASA.setDebugFaces(enabled, surfaceIndex);
      console.log(`🔍 [SimulationApp] Debug aéro ${enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}${surfaceIndex >= 0 ? ` pour surface ${surfaceIndex}` : ''}`);
    } else {
      console.warn('⚠️ [SimulationApp] AeroSystemNASA non disponible');
    }
  }


  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.pause();
    this.systemManager.disposeAll();
    
    const entities = this.entityManager.getAllEntities();
    entities.forEach(entity => this.entityManager.removeEntity(entity.id));
  }
}
