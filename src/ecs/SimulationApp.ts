/**
 * SimulationApp.ts - Orchestrateur principal de la simulation
 * 
 * Responsabilités :
 * - Initialisation : EntityManager, SystemManager, création des entités
 * - Update loop : mise à jour des systèmes à chaque frame
 * - Gestion du cycle de vie : pause/resume/reset/dispose
 */

import * as THREE from 'three';

import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/SystemManager';
import { InputComponent } from './components/InputComponent';
import { KiteFactory, LineFactory, ControlBarFactory, PilotFactory, UIFactory, BridleFactory } from './entities';
import { DebugFactory } from './entities/DebugFactory';
import {
  InputSyncSystem,
  InputSystem,
  WindSystem,
  AeroSystem,
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
} from './systems';
import { AeroSystemNASA } from './systems/AeroSystemNASA';
import { ConstraintSystem } from './systems/ConstraintSystem';
import { CONFIG, SimulationConstants } from './config/Config';
import { Logger } from './utils/Logging';
import type { SimulationContext } from './core/System';
import type { RenderSystem as RenderSystemType } from './systems/RenderSystem';
import type { DebugSystem as DebugSystemType } from './systems/DebugSystem';

export class SimulationApp {
  private entityManager: EntityManager;
  private systemManager: SystemManager;
  private lastTime = 0;
  private paused = !CONFIG.simulation.autoStart; // Lecture depuis la config (autoStart: true => paused: false)
  private logger = Logger.getInstance();
  
  // Systèmes aérodynamiques (bascule NASA/Perso)
  private aeroSystemPerso!: AeroSystem;
  private aeroSystemNASA!: AeroSystemNASA;
  private currentAeroMode: 'perso' | 'nasa' = CONFIG.modes.aero;
  
  // Système de contraintes (dual-mode: PBD et Spring-Force)
  private constraintSystem!: ConstraintSystem;
  private currentConstraintMode: 'pbd' | 'spring-force' = CONFIG.modes.constraint;
  
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
  private createEntities(savedInputValues?: any): void {
    const controlBarPos = CONFIG.initialization.controlBarPosition.clone();
    
    // Position du kite calculée depuis controlBar
    // Système de coordonnées: X=droite, Y=haut, Z=devant (négatif)
    const kitePos = new THREE.Vector3(
      controlBarPos.x,
      controlBarPos.y + CONFIG.initialization.kiteAltitude, // Plus haut
      controlBarPos.z - CONFIG.initialization.kiteDistance  // Plus devant (Z négatif)
    );
    
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

    // Initialiser les systèmes aérodynamiques et de contraintes
    this.initializeAeroSystems();
    this.initializeConstraintSystems();

    // Configurer le pipeline de systèmes
    this.setupSystemPipeline(scene, this.canvas, camera, debugSystem, renderSystem);

    // Stocker le renderSystem dans le debugSystem
    (debugSystem as DebugSystemType).renderSystem = renderSystem;
  }

  /**
   * Initialise les systèmes aérodynamiques selon la configuration
   */
  private initializeAeroSystems(): void {
    this.aeroSystemPerso = new AeroSystem();
    this.aeroSystemNASA = new AeroSystemNASA();

    // Activer le système selon la config
    const isNasaMode = CONFIG.modes.aero === 'nasa';
    this.aeroSystemPerso.setEnabled(!isNasaMode);
    this.aeroSystemNASA.setEnabled(isNasaMode);
  }

  /**
   * Initialise le système de contraintes selon la configuration
   */
  private initializeConstraintSystems(): void {
    this.constraintSystem = new ConstraintSystem();
    this.constraintSystem.setEnabled(true);

    // Note: ConstraintSystem gère en interne les deux modes:
    // - 'pbd': Position-Based Dynamics avec amortissement et Baumgarte
    // - 'spring-force': Ressorts classiques avec amortissement
    // Le mode est sélectionné via InputComponent.constraintMode
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
    
    // Systèmes aérodynamiques (un seul actif à la fois)
    this.systemManager.add(this.aeroSystemPerso); // Priority 30
    this.systemManager.add(this.aeroSystemNASA); // Priority 30

    // Système de contraintes (dual-mode interne)
    this.systemManager.add(this.constraintSystem); // Priority 40
    
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
    
    const inputComp = uiEntity.getComponent('Input') as any;
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
   * Bascule entre les systèmes aérodynamiques selon le mode aeroMode
   * 'perso' = Système Perso (Rayleigh), 'nasa' = Système NASA (officiel)
   */
  private switchAeroSystem(aeroMode: 'perso' | 'nasa'): void {
    if (aeroMode === this.currentAeroMode) {
      return; // Pas de changement
    }

    // Désactiver/Activer les systèmes selon le mode
    if (aeroMode === 'perso') {
      // Mode Perso (Rayleigh)
      this.systemManager.setSystemEnabled('AeroSystem', true);
      this.systemManager.setSystemEnabled('AeroSystemNASA', false);
      this.logger.info('🔄 Basculé vers AeroSystem (Perso/Rayleigh)', 'SimulationApp');
    } else {
      // Mode NASA (Officiel)
      this.systemManager.setSystemEnabled('AeroSystem', false);
      this.systemManager.setSystemEnabled('AeroSystemNASA', true);
      this.logger.info('🔄 Basculé vers AeroSystemNASA (Officiel)', 'SimulationApp');
    }

    this.currentAeroMode = aeroMode;
  }

  /**
   * Bascule entre les systèmes de contraintes selon le mode constraintMode
   * Note: Pour l'instant, on utilise toujours ConstraintSystem (hybride)
   * qui gère en interne 'pbd' et 'spring-force'
   */
  private switchConstraintSystem(constraintMode: 'pbd' | 'spring-force'): void {
    if (constraintMode === this.currentConstraintMode) {
      return; // Pas de changement
    }

    // ConstraintSystem lit automatiquement InputComponent.constraintMode
    // et bascule entre updatePBD() et updateSpringForce() en interne
    this.logger.info(
      `🔗 Mode contrainte changé: ${this.currentConstraintMode} → ${constraintMode}`,
      'SimulationApp'
    );

    this.currentConstraintMode = constraintMode;
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
    
    // Vérifier le changement de modes (aérodynamique et contraintes)
    const inputEntities = this.entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const inputComp = inputEntities[0].getComponent<InputComponent>('Input');
      if (inputComp) {
        this.switchAeroSystem(inputComp.aeroMode);
        this.switchConstraintSystem(inputComp.constraintMode);
      }
    }
    
    const context: SimulationContext = {
      deltaTime: this.paused ? 0 : deltaTime, // Pas de deltaTime en pause
      totalTime: currentTime / SimulationConstants.MS_TO_SECONDS,
      entityManager: this.entityManager
    };
    
    if (this.paused) {
      // En pause : exécuter les systèmes physiques ET de rendu
      // Cela permet d'afficher les forces même en pause (gravité, etc)
      const systemsToRun = ['AeroSystem', 'GeometryRenderSystem', 'LineRenderSystem', 'BridleRenderSystem', 'RenderSystem', 'DebugSystem', 'UISystem'];
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
    const savedInputValues = this.saveInputState();
    
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
  private saveInputState(): any {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (!uiEntity) return null;

    const input = uiEntity.getComponent('Input') as any;
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
      debugMode: input.debugMode
    };
  }

  /**
   * Nettoie les états des systèmes avant le reset
   */
  private cleanupBeforeReset(): void {
    const renderSystem = this.systemManager.getSystem('RenderSystem') as any;
    if (renderSystem?.resetRenderState) {
      renderSystem.resetRenderState();
    }

    const debugSystem = this.systemManager.getSystem('DebugSystem') as any;
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
   * Restaure l'état de pause après le reset
   */
  private restorePauseState(wasPaused: boolean): void {
    this.paused = wasPaused;
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (uiEntity) {
      const inputComp = uiEntity.getComponent('Input') as any;
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
      const inputComp = uiEntity.getComponent('Input') as any;
      if (inputComp) {
        this.logger.info(
          `🔄 RESET COMPLETE | Constraint: ${inputComp.constraintMode} | Aero: ${inputComp.aeroMode}`, 
          'SimulationApp'
        );
      }
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
