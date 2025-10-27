# Code Source Consolidé - Kite Simulator V8

**Date de génération**: $(date +"%Y-%m-%d %H:%M:%S")  
**Architecture**: ECS Pure (Entity-Component-System)  
**Stack**: TypeScript + Three.js + Vite

---

## Fichier: `ecs/SimulationApp.ts`

```typescript
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
 *    - TetherSystem : Contraintes lignes (SLACK/TAUT) → accumule forces + torques
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
 *                             → TetherSystem → PhysicsComponent.forces + torques
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
 * - Calcul torque : TetherSystem, AeroSystemNASA (τ = r × F, identique)
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
  TetherSystem,
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
  private tetherSystem!: TetherSystem;
  
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
    this.initializeTetherSystem();

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
   * Initialise le système de lignes (tethers)
   */
  private initializeTetherSystem(): void {
    this.tetherSystem = new TetherSystem();
    this.tetherSystem.setEnabled(true);

    // TetherSystem : lignes inextensibles simplifiées
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

    // Système de lignes (tethers inextensibles)
    this.systemManager.add(this.tetherSystem); // Priority 40
    
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

```

---

## Fichier: `ecs/components/AerodynamicsComponent.ts`

```typescript
/**
 * AerodynamicsComponent.ts - Coefficients aérodynamiques
 * 
 * Contient les coefficients pour calculer les forces aéro (lift, drag).
 * Architecture ECS pure : données uniquement, calculs dans AeroSystem.
 */

import { Component } from '../core/Component';

/**
 * Coefficients aérodynamiques en fonction de l'angle d'attaque
 */
export interface AeroCoefficients {
  /** Coefficient de portance (Lift) */
  CL: number;

  /** Coefficient de traînée (Drag) */
  CD: number;

  /** Coefficient de traînée parasite (Drag at zero lift) */
  CD0: number;

  /** Coefficient de moment de tangage (Pitching Moment) */
  CM: number;

  /** Pente dCL/dα (par degré) */
  CLAlpha: number;

  /** Angle d'attaque de portance nulle (degrés) */
  alpha0: number;

  /** Angle d'attaque optimal (degrés) */
  alphaOptimal: number;
}

/**
 * Définition d'un panneau aérodynamique (triangle sur la toile)
 */
export interface AeroSurfaceDescriptor {
  name: string;
  points: [string, string, string];
}

export class AerodynamicsComponent extends Component {
  readonly type = 'aerodynamics';
  
  /** Coefficients aérodynamiques */
  coefficients: AeroCoefficients;
  
  /** Masse volumique de l'air (kg/m³) - 1.225 au niveau de la mer */
  airDensity: number;

  /** Surfaces triangulaires contribuant aux forces */
  surfaces: AeroSurfaceDescriptor[];
  
  constructor(options: {
    coefficients: AeroCoefficients;
    airDensity?: number;
    surfaces?: AeroSurfaceDescriptor[];
  }) {
    super();
    
    const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m³ à 15°C niveau mer
    
    this.coefficients = { ...options.coefficients };
    this.airDensity = options.airDensity ?? AIR_DENSITY_SEA_LEVEL;
    this.surfaces = options.surfaces ? [...options.surfaces] : [];
  }
}

```

---

## Fichier: `ecs/components/BridleComponent.ts`

```typescript
/**
 * BridleComponent.ts - Système de bridage du cerf-volant
 * 
 * Le kite a 6 brides au total :
 * - 3 brides gauches : NEZ → CTRL_GAUCHE, INTER_GAUCHE → CTRL_GAUCHE, CENTRE → CTRL_GAUCHE
 * - 3 brides droites : NEZ → CTRL_DROIT, INTER_DROIT → CTRL_DROIT, CENTRE → CTRL_DROIT
 * 
 * Les brides sont des segments droits rigides (contraintes géométriques).
 */

import { Component } from '../core/Component';

/**
 * Longueurs des brides (mètres)
 */
export interface BridleLengths {
  nez: number;      // Bride avant (~0.75m)
  inter: number;    // Bride intermédiaire (~0.65m)
  centre: number;   // Bride centrale (~0.55m)
}

/**
 * Tensions dans les brides (Newtons)
 * Calculées par BridleSystem pour affichage/debug
 */
export interface BridleTensions {
  leftNez: number;
  leftInter: number;
  leftCentre: number;
  rightNez: number;
  rightInter: number;
  rightCentre: number;
}

export class BridleComponent extends Component {
  readonly type = 'bridle';
  
  /** Longueurs des brides */
  lengths: BridleLengths;
  
  /** Tensions actuelles (calculées) */
  tensions: BridleTensions;
  
  constructor(lengths: BridleLengths) {
    super();
    this.lengths = { ...lengths };
    this.tensions = {
      leftNez: 0,
      leftInter: 0,
      leftCentre: 0,
      rightNez: 0,
      rightInter: 0,
      rightCentre: 0
    };
  }
  
  /**
   * Longueur moyenne des brides (pour calculs)
   */
  getAverageLength(): number {
    return (this.lengths.nez + this.lengths.inter + this.lengths.centre) / 3;
  }
}

```

---

## Fichier: `ecs/components/DebugComponent.ts`

```typescript
/**
 * DebugComponent.ts - Données de visualisation du debug
 *
 * Stocke les vecteurs et flèches pour l'affichage du debug.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';
import { DebugConfig } from '../config/Config';

export class DebugComponent extends Component {
  readonly type = 'debug';
  
  /** Flèches de visualisation des forces */
  forceArrows: THREE.ArrowHelper[] = [];
  
  /** Labels textuels pour identifier les faces (sprites) */
  faceLabels: THREE.Sprite[] = [];
  
  /** Labels meshes persistants pour les faces (créés une seule fois) */
  faceLabelMeshes: THREE.Mesh[] = [];
  
  /** Flag pour savoir si les labels de faces ont été créés */
  labelsCreated = false;
  
  /** Groupe contenant tous les éléments de debug */
  debugGroup: THREE.Group;
  
  constructor() {
    super();
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'debug-group';
  }
  
  /**
   * Nettoie les flèches précédentes
   */
  clearArrows(): void {
    this.forceArrows.forEach(arrow => {
      // Nettoyer les géométries et matériaux
      if (arrow.line && (arrow.line as any).geometry) {
        (arrow.line as any).geometry.dispose();
      }
      if (arrow.line && (arrow.line as any).material) {
        const mat = (arrow.line as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => m.dispose?.());
        } else {
          mat.dispose?.();
        }
      }
      if (arrow.cone && (arrow.cone as any).geometry) {
        (arrow.cone as any).geometry.dispose();
      }
      if (arrow.cone && (arrow.cone as any).material) {
        const mat = (arrow.cone as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => m.dispose?.());
        } else {
          mat.dispose?.();
        }
      }
      // Retirer du groupe
      this.debugGroup.remove(arrow);
    });
    this.forceArrows = [];
    
    // Nettoyer aussi les labels sprites (temporaires)
    this.faceLabels.forEach(label => {
      if (label.material) {
        if (label.material.map) {
          label.material.map.dispose();
        }
        label.material.dispose();
      }
      this.debugGroup.remove(label);
    });
    this.faceLabels = [];
    
    // ⚠️ NE PAS détruire les faceLabelMeshes ici!
    // Ils sont persistants et gérés séparément
  }
  
  /**
   * Nettoie TOUT y compris les labels persistants (appelé quand debug se désactive)
   */
  clearAll(): void {
    this.clearArrows();
    
    // Nettoyer les meshes de labels persistants
    this.faceLabelMeshes.forEach(mesh => {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat.map) {
          mat.map.dispose();
        }
        mat.dispose();
      }
      this.debugGroup.remove(mesh);
    });
    this.faceLabelMeshes = [];
    this.labelsCreated = false;
  }
  
  /**
   * Ajoute une flèche de force
   */
  addForceArrow(origin: THREE.Vector3, direction: THREE.Vector3, color: number, name: string): void {
    // Créer une flèche (helper Three.js)
    const length = direction.length();
    if (length < DebugConfig.MIN_FORCE_ARROW_DISPLAY) return; // Ignorer les forces très petites
    
    const arrow = new THREE.ArrowHelper(
      direction.clone().normalize(),
      origin.clone(),
      Math.min(length, DebugConfig.MAX_FORCE_ARROW_LENGTH), // Limiter la longueur pour la visibilité
      color
    );
    
    arrow.name = name;
    this.forceArrows.push(arrow);
    this.debugGroup.add(arrow);
  }
  
  /**
   * Ajoute un label textuel à une position donnée
   */
  addTextLabel(text: string, position: THREE.Vector3, color = '#ffffff', size = 0.5): void {
    // Créer un canvas pour dessiner le texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Taille du canvas
    canvas.width = DebugConfig.CANVAS_SMALL_SIZE;
    canvas.height = DebugConfig.CANVAS_SMALL_SIZE;
    
    // Style du texte
    context.fillStyle = color;
    context.font = 'Bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Dessiner le texte
    context.fillText(text, DebugConfig.CANVAS_SMALL_CENTER, DebugConfig.CANVAS_SMALL_CENTER);
    
    // Créer une texture depuis le canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Créer un matériau sprite
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Toujours visible au-dessus
      depthWrite: false
    });
    
    // Créer le sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    
    this.faceLabels.push(sprite);
    this.debugGroup.add(sprite);
  }
  
  /**
   * Ajoute un label "collé" à une surface (mesh plat aligné avec la face)
   * Version optimisée: crée le mesh une seule fois, puis réutilise
   * @param text Texte à afficher
   * @param position Position du centre du label (centroïde de la face)
   * @param normal Normale de la surface pour alignement
   * @param color Couleur du texte
   * @param size Taille du label (en mètres)
   */
  addSurfaceLabel(text: string, position: THREE.Vector3, normal: THREE.Vector3, color = '#FFFF00', size = 0.5): void {
    // Créer un canvas pour dessiner le texte
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Taille du canvas (haute résolution pour meilleure qualité)
    canvas.width = DebugConfig.CANVAS_LARGE_SIZE;
    canvas.height = DebugConfig.CANVAS_LARGE_SIZE;
    
    // Pas de fond - transparent uniquement
    context.clearRect(0, 0, DebugConfig.CANVAS_LARGE_SIZE, DebugConfig.CANVAS_LARGE_SIZE);
    
    // Style du texte
    context.fillStyle = color;
    context.font = 'Bold 320px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Dessiner le texte
    context.fillText(text, DebugConfig.CANVAS_LARGE_CENTER, DebugConfig.CANVAS_LARGE_CENTER);
    
    // Créer une texture depuis le canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Créer un matériau avec la texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide, // Visible des deux côtés
      depthTest: true,
      depthWrite: false
    });
    
    // Créer une géométrie plane
    const geometry = new THREE.PlaneGeometry(size, size);
    
    // Créer le mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Positionner le mesh au centre exact de la face
    mesh.position.copy(position);
    
    // Orienter le mesh parallèle à la face (aligné avec la normale)
    // Créer un quaternion qui aligne le vecteur Z local avec la normale
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal.clone().normalize());
    mesh.quaternion.copy(quaternion);
    
    // Légèrement décalé le long de la normale pour éviter z-fighting avec la face
    mesh.position.add(normal.clone().normalize().multiplyScalar(DebugConfig.MIN_FORCE_ARROW_DISPLAY));
    
    // Stocker dans le tableau des meshes persistants
    this.faceLabelMeshes.push(mesh);
    this.debugGroup.add(mesh);
  }
  
  /**
   * Met à jour la position d'un label existant (sans le recréer)
   * @param index Index du label dans faceLabelMeshes
   * @param position Nouvelle position
   * @param normal Nouvelle normale
   */
  updateSurfaceLabel(index: number, position: THREE.Vector3, normal: THREE.Vector3): void {
    if (index >= this.faceLabelMeshes.length) return;
    
    const mesh = this.faceLabelMeshes[index];
    
    // Mettre à jour la position
    mesh.position.copy(position);
    
    // Mettre à jour l'orientation
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal.clone().normalize());
    mesh.quaternion.copy(quaternion);
    
    // Décalage pour éviter z-fighting
    mesh.position.add(normal.clone().normalize().multiplyScalar(DebugConfig.MIN_FORCE_ARROW_DISPLAY));
  }
}


```

---

## Fichier: `ecs/components/GeometryComponent.ts`

```typescript
/**
 * GeometryComponent.ts - Géométrie (points locaux, connexions, surfaces)
 * 
 * Stocke la structure géométrique d'un objet en coordonnées locales.
 * Les CTRL_GAUCHE et CTRL_DROIT sont stockés ici comme points locaux du kite.
 * 
 * Architecture ECS pure : données uniquement, pas de logique de transformation.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';
import { Entity } from '../core/Entity';

import { TransformComponent } from './TransformComponent';

/**
 * Définition d'une connexion entre deux points
 */
export interface GeometryConnection {
  from: string;
  to: string;
}

/**
 * Définition d'une surface (triangle ou quad)
 */
export interface GeometrySurface {
  points: string[];
  normal?: THREE.Vector3;
}

export class GeometryComponent extends Component {
  readonly type = 'geometry';
  
  /** Points en coordonnées locales */
  private points: Map<string, THREE.Vector3>;
  
  /** Connexions (lignes) entre points */
  connections: GeometryConnection[];
  
  /** Surfaces (pour rendu) */
  surfaces: GeometrySurface[];
  
  constructor() {
    super();
    this.points = new Map();
    this.connections = [];
    this.surfaces = [];
  }
  
  /**
   * Définit un point en coordonnées locales
   */
  setPoint(name: string, localPosition: THREE.Vector3): void {
    this.points.set(name, localPosition.clone());
  }
  
  /**
   * Récupère un point en coordonnées locales
   */
  getPoint(name: string): THREE.Vector3 | undefined {
    return this.points.get(name)?.clone();
  }
  
  /**
   * Transforme un point local en coordonnées monde
   * 
   * @param name - Nom du point
   * @param entity - Entité contenant TransformComponent
   * @returns Position monde ou undefined si point inexistant
   */
  getPointWorld(name: string, entity: Entity): THREE.Vector3 | undefined {
    const localPoint = this.points.get(name);
    if (!localPoint) return undefined;
    
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) return undefined;
    
    // Transforme local → monde : rotation puis translation
    return localPoint.clone()
      .applyQuaternion(transform.quaternion)
      .add(transform.position);
  }
  
  /**
   * Liste tous les noms de points
   */
  getPointNames(): string[] {
    return Array.from(this.points.keys());
  }
  
  /**
   * Compte le nombre de points
   */
  getPointCount(): number {
    return this.points.size;
  }
  
  /**
   * Ajoute une connexion entre deux points
   */
  addConnection(from: string, to: string): void {
    this.connections.push({ from, to });
  }
  
  /**
   * Ajoute une surface
   */
  addSurface(points: string[], normal?: THREE.Vector3): void {
    this.surfaces.push({ points, normal: normal?.clone() });
  }
  
  /**
   * Vérifie si un point existe
   */
  hasPoint(name: string): boolean {
    return this.points.has(name);
  }
}

```

---

## Fichier: `ecs/components/InputComponent.ts`

```typescript
import { Component } from '../core/Component';
import { Logger } from '../utils/Logging';
import { CONFIG, InputDefaults } from '../config/Config';

/**
 * Snapshot complet de l'état InputComponent pour sérialisation/sauvegarde
 * @export InputState
 */
export interface InputState {
  // === Vent ===
  windSpeed: number;
  windDirection: number;
  windTurbulence: number;

  // === Lignes ===
  constraintMode: 'pbd' | 'spring-force';
  aeroMode: 'perso' | 'nasa';
  lineLength: number;
  bridleNez: number;
  bridleInter: number;
  bridleCentre: number;

  // === Physique ===
  linearDamping: number;
  angularDamping: number;
  meshSubdivisionLevel: number;

  // === Aérodynamique ===
  liftScale: number;
  dragScale: number;
  forceSmoothing: number;

  // === Actions ===
  resetSimulation: boolean;
  isPaused: boolean;
  debugMode: boolean;
  showNormals: boolean;

  // === Contrôle ===
  barRotationInput: number;
}

/**
 * Contient l'état des entrées utilisateur provenant de l'interface.
 * Les systèmes liront ce composant pour ajuster la simulation.
 */
export class InputComponent extends Component {
  public static readonly type = 'Input';
  public readonly type = 'Input';

  private logger = Logger.getInstance();
  
  // === Vent ===
  windSpeed: number; // m/s
  windDirection: number; // degrés
  windTurbulence: number; // %

  // === Lignes (avec backing fields pour détection de changements) ===
  private _constraintMode: 'pbd' | 'spring-force' = CONFIG.modes.constraint;
  private _aeroMode: 'perso' | 'nasa' = CONFIG.modes.aero;

  get constraintMode(): 'pbd' | 'spring-force' {
    return this._constraintMode;
  }

  set constraintMode(value: 'pbd' | 'spring-force') {
    if (this._constraintMode !== value) {
      const oldMode = this._constraintMode;
      this._constraintMode = value;
      this.logger.info(`📋 Constraint mode changed: ${oldMode} → ${value}`, 'InputComponent');
    }
  }

  get aeroMode(): 'perso' | 'nasa' {
    return this._aeroMode;
  }

  set aeroMode(value: 'perso' | 'nasa') {
    if (this._aeroMode !== value) {
      const oldMode = this._aeroMode;
      this._aeroMode = value;
      this.logger.info(`🌪️  Aero mode changed: ${oldMode} → ${value}`, 'InputComponent');
    }
  }
  lineLength: number; // m
  bridleNez: number; // m
  bridleInter: number; // m
  bridleCentre: number; // m

  // === Physique ===
  linearDamping: number;
  angularDamping: number;
  meshSubdivisionLevel: number;

  // === Aérodynamique ===
  liftScale: number;
  dragScale: number;
  forceSmoothing: number;

  // === Actions (déclencheurs) ===
  resetSimulation: boolean = false;
  isPaused: boolean = false; // true = en pause, false = en cours d'exécution
  debugMode: boolean = false;
  showNormals: boolean = false; // Afficher les vecteurs normaux des faces

  // === Contrôle barre (clavier) ===
  barRotationInput: number = 0; // -1 = gauche, 0 = neutre, 1 = droite

  constructor(initialValues: Partial<InputComponent> = {}) {
    super();
    // Vent
    this.windSpeed = initialValues.windSpeed ?? CONFIG.wind.speed;
    this.windDirection = initialValues.windDirection ?? CONFIG.wind.direction;
    this.windTurbulence = initialValues.windTurbulence ?? CONFIG.wind.turbulence;

    // Lignes - Modes
    this.constraintMode = initialValues.constraintMode ?? CONFIG.modes.constraint;
    this.aeroMode = initialValues.aeroMode ?? CONFIG.modes.aero;
    
    // Lignes - Dimensions
    this.lineLength = initialValues.lineLength ?? InputDefaults.LINE_LENGTH_M;
    this.bridleNez = initialValues.bridleNez ?? InputDefaults.BRIDLE_NEZ_M;
    this.bridleInter = initialValues.bridleInter ?? InputDefaults.BRIDLE_INTER_M;
    this.bridleCentre = initialValues.bridleCentre ?? InputDefaults.BRIDLE_CENTRE_M;

    // Physique
    this.linearDamping = initialValues.linearDamping ?? CONFIG.physics.linearDamping;
    this.angularDamping = initialValues.angularDamping ?? CONFIG.physics.angularDamping;
    this.meshSubdivisionLevel = initialValues.meshSubdivisionLevel ?? InputDefaults.MESH_SUBDIVISION_LEVEL;

    // Aérodynamique
    this.liftScale = initialValues.liftScale ?? CONFIG.aero.liftScale;
    this.dragScale = initialValues.dragScale ?? CONFIG.aero.dragScale;
    this.forceSmoothing = initialValues.forceSmoothing ?? CONFIG.aero.forceSmoothing;

    // Actions
    this.resetSimulation = initialValues.resetSimulation ?? false;
    this.isPaused = initialValues.isPaused ?? !CONFIG.simulation.autoStart;
    this.debugMode = initialValues.debugMode ?? CONFIG.debug.enabled;

    // Contrôle barre
    this.barRotationInput = initialValues.barRotationInput ?? 0;
  }
}

```

---

## Fichier: `ecs/components/KiteComponent.ts`

```typescript
/**
 * KiteComponent.ts - Propriétés spécifiques au cerf-volant delta
 * 
 * Données géométriques et aérodynamiques du kite.
 */

import { Component } from '../core/Component';

export class KiteComponent extends Component {
  readonly type = 'kite';
  
  /** Envergure (largeur) en mètres */
  wingspan: number;
  
  /** Corde (profondeur) en mètres */
  chord: number;
  
  /** Surface alaire en m² */
  surfaceArea: number;
  
  /** Allongement (aspect ratio) = wingspan² / surfaceArea */
  aspectRatio: number;
  
  constructor(options: {
    wingspan: number;
    chord: number;
    surfaceArea?: number;
  }) {
    super();
    this.wingspan = options.wingspan;
    this.chord = options.chord;
    
    // Calcul automatique de la surface si non fournie
    this.surfaceArea = options.surfaceArea ?? (this.wingspan * this.chord * 0.5);
    
    // Calcul allongement
    this.aspectRatio = (this.wingspan * this.wingspan) / this.surfaceArea;
  }
}

```

---

## Fichier: `ecs/components/LineComponent.ts`

```typescript
/**
 * LineComponent.ts - Propriétés d'une ligne de cerf-volant
 * 
 * Ligne = segment droit rigide avec élasticité simple (loi de Hooke).
 * Pas de caténaire, pas de masse linéaire, pas de damping complexe.
 */

import { Component } from '../core/Component';

export class LineComponent extends Component {
  readonly type = 'line';
  
  /** Longueur maximale (et de repos) de la ligne (mètres) */
  restLength: number;

  /** Longueur instantanée mesurée (mètres) */
  currentLength: number;
  
  /** Rigidité (N/m) - loi de Hooke : F = k × Δx */
  stiffness: number;

  /** Amortissement visqueux (N·s/m) */
  damping: number;
  
  /** Tension maximale admissible (N) */
  maxTension: number;
  
  /** Tension actuelle (N) - calculée par LineSystem */
  currentTension: number;
  
  /** État de la ligne */
  state: {
    isTaut: boolean;      // Ligne tendue ou molle ?
    elongation: number;   // Élongation actuelle (m)
    strainRatio: number;  // Ratio élongation/longueur
    currentLength: number; // Longueur instantanée (m)
  };
  
  constructor(options: {
    length: number;
    stiffness?: number;
    damping?: number;
    maxTension?: number;
  }) {
    super();
    this.restLength = options.length;
    this.currentLength = options.length;
    this.stiffness = options.stiffness ?? 500; // 500 N/m par défaut
    this.damping = options.damping ?? 25; // Amortissement standard
    this.maxTension = options.maxTension ?? 200; // 200 N max
    this.currentTension = 0;
    
    this.state = {
      isTaut: false,
      elongation: 0,
      strainRatio: 0,
      currentLength: options.length
    };
  }
}

```

---

## Fichier: `ecs/components/MeshComponent.ts`

```typescript
/**
 * MeshComponent.ts - Référence à l'objet Three.js pour le rendu
 * 
 * Contient l'Object3D Three.js créé par GeometryRenderSystem.
 * Séparation claire : GeometryComponent = données, MeshComponent = rendu.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class MeshComponent extends Component {
  readonly type = 'mesh';
  
  /** Objet Three.js (Mesh, Line, Group, etc.) */
  object3D: THREE.Object3D;
  
  constructor(object3D: THREE.Object3D) {
    super();
    this.object3D = object3D;
  }
  
  /**
   * Dispose les ressources Three.js
   */
  dispose(): void {
    this.object3D.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}

```

---

## Fichier: `ecs/components/PhysicsComponent.ts`

```typescript
/**
 * PhysicsComponent.ts - Dynamique (vélocité, forces, masse, inertie)
 * 
 * Contient toutes les données physiques d'un corps rigide.
 * Architecture ECS pure : données uniquement, pas de méthodes de manipulation.
 * Les opérations sur les forces sont dans PhysicsSystem.
 */

import * as THREE from 'three';
import { EnvironmentConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

import { Component } from '../core/Component';

export class PhysicsComponent extends Component {
  readonly type = 'physics';
  
  // Dynamique linéaire
  velocity: THREE.Vector3;
  mass: number;
  invMass: number; // 1 / mass (optimisation calculs)
  
  // Dynamique angulaire
  angularVelocity: THREE.Vector3;
  inertia: THREE.Matrix3;
  invInertia: THREE.Matrix3; // Inverse (optimisation calculs)
  
  // Accumulateurs de forces (réinitialisés chaque frame)
  forces: THREE.Vector3;
  torques: THREE.Vector3;
  
  // Forces par face (pour debug et application distribuée)
  faceForces: Array<{
    name: string;           // Nom de la face (ex: "leftUpper", "rightLower")
    centroid: THREE.Vector3;
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    gravity: THREE.Vector3;
    apparentWind: THREE.Vector3;
    normal: THREE.Vector3;  // Normale de la face (pour debug visuel)
  }>;
  
  // Damping (friction)
  linearDamping: number;
  angularDamping: number;
  
  // Kinematic flag (si true, la physique ne s'applique pas)
  isKinematic: boolean;
  
  constructor(options: {
    mass?: number;
    velocity?: THREE.Vector3;
    angularVelocity?: THREE.Vector3;
    inertia?: THREE.Matrix3;
    linearDamping?: number;
    angularDamping?: number;
    isKinematic?: boolean;
  } = {}) {
    super();
    
    const DEFAULT_MASS = 1.0;
    const DEFAULT_INERTIA_SPHERE = 0.4;

    this.mass = MathUtils.initializeProperty(options, 'mass', DEFAULT_MASS);
    this.invMass = this.mass > 0 ? 1 / this.mass : 0;
    
    this.velocity = options.velocity?.clone() || new THREE.Vector3(0, 0, 0);
    this.angularVelocity = options.angularVelocity?.clone() || new THREE.Vector3(0, 0, 0);
    
    // Inertie par défaut (sphère de masse 1 et rayon 1)
    this.inertia = options.inertia?.clone() || new THREE.Matrix3().identity().multiplyScalar(DEFAULT_INERTIA_SPHERE);
    
    // Calculer l'inverse de l'inertie avec validation
    try {
      this.invInertia = this.inertia.clone().invert();
      // Vérifier si l'inversion a produit des NaN
      const e = this.invInertia.elements;
      if (e.some(v => !Number.isFinite(v))) {
        console.warn('[PhysicsComponent] Invalid invInertia, using identity');
        this.invInertia = new THREE.Matrix3().identity();
      }
    } catch (error) {
      console.warn('[PhysicsComponent] Failed to invert inertia matrix, using identity', error);
      this.invInertia = new THREE.Matrix3().identity();
    }
    
    this.forces = new THREE.Vector3(0, 0, 0);
    this.torques = new THREE.Vector3(0, 0, 0);
    
    // Initialiser les forces par face (pour le debug et application distribuée)
    this.faceForces = [];
    
    this.linearDamping = MathUtils.initializeProperty(options, 'linearDamping', EnvironmentConfig.LINEAR_DAMPING);
    this.angularDamping = MathUtils.initializeProperty(options, 'angularDamping', EnvironmentConfig.ANGULAR_DAMPING);

    // Objet cinématique (fixe) par défaut à false
    this.isKinematic = MathUtils.initializeProperty(options, 'isKinematic', false);
  }
}

```

---

## Fichier: `ecs/components/PilotComponent.ts`

```typescript
/**
 * PilotComponent.ts - Composant de données pour le retour haptique du pilote
 * 
 * Stocke les informations de retour haptique que le pilote ressent via les lignes.
 * Ce composant contient uniquement des données, pas de logique.
 * 
 * Architecture ECS :
 * - Données pures uniquement (POJO)
 * - Mis à jour par le PilotSystem
 * - Utilisé pour le retour visuel/UI et éventuellement des dispositifs haptiques
 */

/**
 * Composant de feedback haptique du pilote
 */
export class PilotComponent {
  readonly type = 'pilot';
  
  /**
   * Tensions brutes actuelles des lignes (N)
   * Valeurs instantanées sans filtrage
   */
  leftHandRawTension: number = 0;
  rightHandRawTension: number = 0;
  
  /**
   * Tensions filtrées pour un retour haptique lisse (N)
   * Simulent l'élasticité du système + retard de perception
   */
  leftHandFilteredTension: number = 0;
  rightHandFilteredTension: number = 0;
  
  /**
   * Asymétrie de tension entre gauche et droite (%)
   * 0% = équilibré, 100% = totalement asymétrique
   */
  asymmetry: number = 0;
  
  /**
   * Côté dominant détecté
   * Utile pour déterminer la direction du virage
   */
  dominantSide: 'left' | 'right' | 'neutral' = 'neutral';
  
  /**
   * Magnitude totale du feedback (moyenne des tensions) (N)
   */
  totalFeedbackMagnitude: number = 0;
  
  /**
   * Taux de changement des tensions (N/s)
   * Détecte les accélérations/décélérations brusques
   */
  leftHandTensionDelta: number = 0;
  rightHandTensionDelta: number = 0;
  
  /**
   * État détecté du vol
   */
  state: 'idle' | 'powered' | 'turning_left' | 'turning_right' | 'stall' = 'idle';
  
  /**
   * Facteur de filtrage (0-1)
   * 0 = pas de filtrage, 1 = filtrage maximal
   * Valeur recommandée : 0.15 (environ 15ms de lag à 60fps)
   */
  filteringFactor: number = 0.15;
  
  /**
   * Timestamp de la dernière mise à jour (ms)
   */
  lastUpdateTime: number = 0;
}

```

---

## Fichier: `ecs/components/TransformComponent.ts`

```typescript
/**
 * TransformComponent.ts - Position, rotation, échelle
 * 
 * Composant fondamental pour tout objet dans l'espace 3D.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class TransformComponent extends Component {
  readonly type = 'transform';
  
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  
  constructor(options: {
    position?: THREE.Vector3;
    quaternion?: THREE.Quaternion;
    scale?: THREE.Vector3;
  } = {}) {
    super();
    this.position = options.position?.clone() || new THREE.Vector3(0, 0, 0);
    this.quaternion = options.quaternion?.clone() || new THREE.Quaternion();
    this.scale = options.scale?.clone() || new THREE.Vector3(1, 1, 1);
  }
  
  /**
   * Clone le composant
   */
  clone(): TransformComponent {
    return new TransformComponent({
      position: this.position.clone(),
      quaternion: this.quaternion.clone(),
      scale: this.scale.clone()
    });
  }
}

```

---

## Fichier: `ecs/components/VisualComponent.ts`

```typescript
/**
 * VisualComponent.ts - Propriétés visuelles pour le rendu
 * 
 * Contrôle l'apparence visuelle (couleur, opacité, wireframe, etc.)
 */

import { Component } from '../core/Component';

export class VisualComponent extends Component {
  readonly type = 'visual';
  
  color: number; // Couleur hex (ex: 0x00ff00 pour vert)
  opacity: number; // 0-1
  wireframe: boolean;
  visible: boolean;
  emissive?: number; // Couleur émissive (optionnel)
  
  constructor(options: {
    color?: number;
    opacity?: number;
    wireframe?: boolean;
    visible?: boolean;
    emissive?: number;
  } = {}) {
    super();
    this.color = options.color ?? 0x00ff00;
    this.opacity = options.opacity ?? 1.0;
    this.wireframe = options.wireframe ?? false;
    this.visible = options.visible ?? true;
    this.emissive = options.emissive;
  }
}

```

---

## Fichier: `ecs/components/index.ts`

```typescript
/**
 * index.ts - Exports de tous les composants
 */

export { TransformComponent } from './TransformComponent';
export { PhysicsComponent } from './PhysicsComponent';
export { GeometryComponent } from './GeometryComponent';
export type { GeometryConnection, GeometrySurface } from './GeometryComponent';
export { VisualComponent } from './VisualComponent';
export { MeshComponent } from './MeshComponent';
export { KiteComponent } from './KiteComponent';
export { LineComponent } from './LineComponent';
export { BridleComponent } from './BridleComponent';
export type { BridleLengths, BridleTensions } from './BridleComponent';
export { AerodynamicsComponent } from './AerodynamicsComponent';
export type { AeroCoefficients, AeroSurfaceDescriptor } from './AerodynamicsComponent';
export { InputComponent } from './InputComponent';
export { PilotComponent } from './PilotComponent';
export { DebugComponent } from './DebugComponent';

```

---

## Fichier: `ecs/config/Config.ts`

```typescript
/**
 * Config.ts - Configuration centralisée de la simulation
 * 
 * Ce fichier centralise TOUTES les constantes physiques et paramètres de configuration.
 * Aucun nombre "magique" ne doit se trouver dans le code métier.
 * 
 * Structure :
 * 1. Constantes physiques universelles
 * 2. Géométrie et masse du kite
 * 3. Systèmes de contrainte (bridles et lignes)
 * 4. Aérodynamique
 * 5. Conditions environnementales
 * 6. Initialisation et simulation
 * 7. Rendu et interface
 * 8. Debug et logging
 */

import * as THREE from 'three';

// ============================================================================
// 🌍 CONSTANTES PHYSIQUES UNIVERSELLES
// ============================================================================

namespace PhysicsConstants {
  /** Accélération due à la gravité (m/s²) - Niveau mer, 45° latitude */
  export const GRAVITY = 9.81;

  /** Densité de l'air standard (kg/m³) - Niveau mer, 15°C */
  export const AIR_DENSITY = 1.225;

  // ============================================================================
  // PBD (Position-Based Dynamics) - Paramètres optimisés
  // ============================================================================

  /** Nombre d'itérations PBD pour convergence (10-20 recommandé) */
  export const PBD_ITERATIONS = 10;

  /** Compliance PBD (inverse de rigidité): α = 1/k
   * α = 0     → infiniment rigide (hard constraint)
   * α = 0.001 → très rigide (k ≈ 1000)
   * α = 0.01  → rigide (k ≈ 100)
   * α = 0.1   → souple (k ≈ 10)
   *
   * Pour lignes de kite: quasi-rigide (hard constraint)
   */
  export const PBD_COMPLIANCE = 0.001;

  /** Correction max PBD par frame (m) - Sécurité anti-divergence */
  export const PBD_MAX_CORRECTION = 0.5;

  /** Facteur d'amortissement angulaire PBD (0-1)
   * 0.95 = 5% damp par frame
   * 0.98 = 2% damp par frame (plus stable)
   * 0.99 = 1% damp par frame (minimal)
   */
  export const PBD_ANGULAR_DAMPING = 0.98;

  /** Lambda max pour PBD : limite stricte pour éviter divergence */
  export const PBD_MAX_LAMBDA = 1000;

  /** Epsilon pour calculs numériques (évite division par zéro) */
  export const EPSILON = 1e-6;

  /** Position du sol (m) - Y = 0 dans Three.js */
  export const GROUND_Y = 0;

  /** Vitesse angulaire minimale au carré pour intégration rotation */
  export const MIN_ANGULAR_VELOCITY_SQ = 0.0001;

  /** Facteur pour intégration Euler semi-implicite */
  export const SEMI_IMPLICIT_SCALE = 0.5;
}

// ============================================================================
// 🔗 CONTRAINTES (LIGNES ET BRIDLES)
// ============================================================================

namespace ConstraintConfig {
  /** Tether line tensile stiffness (N/m)
   * 
   * Makani reference: tether_params.tensile_stiffness (EA in N)
   *   EA = Young's modulus × cross-sectional area
   *   For Dyneema rope: EA ≈ 1-5 MN (1,000,000 - 5,000,000 N)
   * 
   * Our implementation uses stiffness per meter:
   *   LINE_STIFFNESS = EA / restLength (N/m)
   *   For EA = 120,000 N and L = 15m: k = 8000 N/m
   * 
   * Physical interpretation:
   *   • 1cm elongation → 80N force (≈8kg tension)
   *   • 10cm elongation → 800N force (≈80kg tension)
   * 
   * Tuning guidelines:
   *   • Higher values (10000-20000) = stiffer lines, less stretch
   *   • Lower values (20-100) = soft elastic behavior, progressive forces
   *   • Higher values (1000-5000) = stiff cables, can cause oscillations
   *   • Too high (>50000) = numerical instability
   * 
   * ⚠️ Current value: 50 N/m (très souple pour forces progressives douces)
   *    À 1m excès → 50N, à 5m excès → 250N (gérable pour kite 0.12kg)
   */
  export const LINE_STIFFNESS = 50; // Rigidité douce pour comportement stable et progressif

  /** Position-based projection factor (0.0-1.0)
   * 
   * @deprecated Not used in current force-based implementation
   * 
   * This was used in PBD mode for direct position correction.
   * Current implementation uses explicit forces instead.
   */
  export const PBD_PROJECTION_FACTOR = 0.3;

  /** Longitudinal damping coefficient (N·s/m - absolute damping)
   * 
   * Changed from proportional (0.04 × v × k) to absolute (DAMPING_COEF × v)
   * to avoid explosive damping forces when stiffness or velocity is high.
   * 
   * Physical interpretation:
   *   • At v_radial = 1 m/s → damping force = 2 N
   *   • At v_radial = 10 m/s → damping force = 20 N (not 960N!)
   * 
   * ⚠️ MODIFIÉ: Damping absolu pour éviter explosions
   */
  export const ABSOLUTE_DAMPING = 2.0; // N·s/m - damping absolu indépendant de la rigidité
  
  /** @deprecated Use ABSOLUTE_DAMPING instead */
  export const PBD_DAMPING = 0.04;

  /** Nombre d'itérations de résolution PBD par frame 
   * Plus d'itérations = meilleure convergence mais plus coûteux
   * 3-5 itérations suffisent généralement pour des contraintes rigides
   */
  export const PBD_ITERATIONS = 5;

  /** Coefficient de stabilisation Baumgarte (0.05-0.2) 
   * @deprecated Non utilisé en mode inextensible pur
   */
  export const BAUMGARTE_COEF = 0.1;

  /** Limite de sécurité pour les forces de contrainte (N)
   * 
   * Prevents numerical explosions when lines are severely overstretched.
   * 
   * With LINE_STIFFNESS=50 N/m:
   *   • At 5m excess → spring force = 250 N
   *   • At 10m/s velocity → damping = 20 N
   *   • Total max ≈ 270 N (well below limit)
   * 
   * ⚠️ Current value: 300 N (cohérent avec nouvelle rigidité douce)
   */
  export const MAX_CONSTRAINT_FORCE = 300; // Limite adaptée à LINE_STIFFNESS=50

  /** Limite d'élongation maximale (% de longueur au repos)
   * 
   * Beyond this limit, the line is considered broken or unstable.
   * Prevents infinite force accumulation in numerical simulations.
   * 
   * Physical interpretation:
   *   • Typical Dyneema kite lines: elastic ~3-5% under normal load
   *   • Safety limit: 2% (30cm sur 15m) allows realistic stretch
   *   • Beyond 5%: risk of line damage or simulation instability
   * 
   * ⚠️ CRITIQUE: 20% était ABSURDE (3m d'élongation → 6000N de force)
   * Maintenant: 2% max = 30cm élongation → tension réaliste 200-600N
   */
  export const MAX_ELONGATION_RATIO = 0.002; // CORRIGÉ: 2% au lieu de 20% !

  /** Force minimale pour considérer une ligne tendue (N)
   * 
   * Below this threshold, the line is considered slack.
   * Prevents micro-oscillations around the slack/taut boundary.
   */
  export const MIN_TAUT_FORCE = 0.1; // Réduit de 1.0 à 0.1 N pour moins de force au repos
}

// ============================================================================
// 🎨 CONSTANTES VISUELLES ET RENDU
// ============================================================================

namespace VisualConstants {
  /** Seuil de recréation géométrie ligne (m) */
  export const LINE_GEOMETRY_UPDATE_THRESHOLD = 0.01;

  /** Rayon des tubes de ligne (m) */
  export const LINE_TUBE_RADIUS = 0.003;

  /** Segments radiaux des tubes */
  export const LINE_TUBE_SEGMENTS = 8;

  /** Couleur verte (poignée droite) */
  export const COLOR_GREEN = 0x00ff00;

  /** Couleur rouge (poignée gauche) */
  export const COLOR_RED = 0xff0000;

  /** Diamètre cylindre barre (m) */
  export const BAR_CYLINDER_DIAMETER = 0.015;

  /** Diamètre sphère poignée (m) */
  export const HANDLE_SPHERE_DIAMETER = 0.035;

  /** Segments sphère poignée */
  export const HANDLE_SPHERE_SEGMENTS = 16;

  /** Diamètre tube bridle (m) */
  export const BRIDLE_TUBE_DIAMETER = 0.003;
}

// ============================================================================
// ⏱️ CONSTANTES DE SIMULATION
// ============================================================================

namespace SimulationConstants {
  /** Delta time maximal (s) - Cap à 50ms pour stabilité */
  export const MAX_DELTA_TIME = 0.05;

  /** Facteur de conversion millisecondes → secondes */
  export const MS_TO_SECONDS = 1000;
}

// ============================================================================
// 🪁 GÉOMÉTRIE ET MASSE DU KITE
// ============================================================================

namespace KiteSpecs {
  // === Masses ===
  /** Masse du kite (kg) - 120g pour ratio réaliste */
  export const MASS_KG = 0.12;

  // === Dimensions ===
  /** Envergure (m) */
  export const WINGSPAN_M = 1.65;

  /** Corde (m) - Profondeur moyenne */
  export const CHORD_M = 0.65;

  /** Surface ailée (m²) - Calculée : wingspan × chord × 0.5 (delta triangulaire) */
  export const SURFACE_AREA_M2 = 0.8; // Augmentée pour plus de portance réaliste

  // === Moments d'inertie (kg⋅m²) ===
  // Calcul précis pour plaque triangulaire delta (120g, 1.65m x 0.65m)
  // Formule: I = m * (a² + b²) / 24 pour axes principaux
  /** Pitch (rotation avant/arrière autour de X) */
  export const INERTIA_XX = 0.0158; // m * (wingspan² + chord²) / 24

  /** Yaw (rotation gauche/droite autour de Y) */
  export const INERTIA_YY = 0.0136; // m * wingspan² / 24

  /** Roll (rotation latérale autour de Z) */
  export const INERTIA_ZZ = 0.0158; // m * (wingspan² + chord²) / 24

  // === Couleur ===
  /** Couleur du kite en RGB hex */
  export const COLOR = 0xff3333; // Rouge

  // === Facteurs géométriques internes ===
  /** Position Y du centre relatif (25% de la hauteur du nez) */
  export const CENTER_HEIGHT_RATIO = 0.25;

  /** Position relative des points intermédiaires (75% vers le bas) */
  export const INTERPOLATION_RATIO = 0.75; // = 1.0 - CENTER_HEIGHT_RATIO

  /** Ratio des points de fixation (2/3 vers l'intérieur) */
  export const FIX_POINT_RATIO = 2 / 3;

  /** Hauteur relative des whiskers (60% du centre) */
  export const WHISKER_HEIGHT_RATIO = 0.6;

  /** Profondeur des whiskers (arrière du kite, m) */
  export const WHISKER_DEPTH_M = 0.20;
}

// ============================================================================
// 🛝 BRIDLES (Système de contrôle)
// ============================================================================

namespace BridleConfig {
  // === Longueurs ===
  /** Longueur bride nez (m) */
  export const LENGTH_NEZ_M = 0.65;

  /** Longueur bride inter (m) */
  export const LENGTH_INTER_M = 0.65;

  /** Longueur bride centre (m) */
  export const LENGTH_CENTRE_M = 0.65;

  // === Couleur ===
  /** Couleur des bridles en RGB hex */
  export const COLOR = 0xff0000; // Rouge
}

// ============================================================================
// 🧵 LIGNES DE VOL
// ============================================================================

namespace LineSpecs {
  // === Géométrie ===
  /** Longueur des lignes (m) */
  export const LENGTH_M = 15;

  /** Tension maximale (N) - ~8× poids du kite */
  export const MAX_TENSION_N = 200;

  // === Couleur ===
  /** Couleur des lignes en RGB hex */
  export const COLOR = 0x0000ff; // Bleu

  // === Mode de contrainte ===
  /** Mode : 'pbd' (Position-Based Dynamics) ou 'spring-force' (ressort physique) */
  export const CONSTRAINT_MODE = 'pbd' as const;

  // === Paramètres Spring-Force ===
  /** Rigidité du ressort (N/m) - Réduit de 500 à 50 pour stabilité */
  export const STIFFNESS_N_PER_M = 500;

  /** Fréquence propre : ω = sqrt(k/m) = sqrt(50/0.12) ≈ 20 rad/s (~3 Hz) */
  export const EXPECTED_FREQUENCY_HZ = 30;

  /** Amortissement visqueux (N·s/m) */
  export const DAMPING_N_S_PER_M = 50;

  /** Amortissement critique théorique ≈ 4.9 (légèrement sur-amorti) */
  export const DAMPING_RATIO = 0.7; // Légèrement sur-amorti pour stabilité

  /** Force maximale appliquée (N) - ~83× poids du kite */
  export const MAX_FORCE_N = 10;
}

// ============================================================================
// 🌬️ AÉRODYNAMIQUE
// ============================================================================

namespace AeroConfig {
  // === Coefficients physiques de calcul ===
  /** Coefficient de pression dynamique = 0.5 ρ V² */
  export const DYNAMIC_PRESSURE_COEFF = 0.5;

  /** Efficacité d'Oswald (e) pour profil delta - typiquement 0.8 */
  export const OSWALD_EFFICIENCY = 0.8;

  // === Coefficients de portance (lift) ===
  /** CL à angle d'attaque zéro */
  export const CL0 = 0.0;

  /** dCL/dα (par degré) - Valeur réaliste pour cerf-volant */
  export const CL_ALPHA_PER_DEG = 0.105;

  /** Angle d'attaque pour portance nulle (deg) - Légèrement négatif pour profil cambré */
  export const ALPHA_ZERO_DEG = -2;

  /** Angle d'attaque optimal (deg) - Réduit pour éviter décrochage */
  export const ALPHA_OPTIMAL_DEG = 12;

  // === Coefficient de traînée (drag) ===
  /** CD à angle d'attaque zéro (traînée parasite) - Augmentée pour kite */
  export const CD0 = 0.08;

  // === Coefficient de moment ===
  /** CM (moment de tangage) - Réduit pour moins d'instabilité */
  export const CM = -0.05;

  // === Multiplicateurs de tuning (UI) ===
  /** Multiplicateur de portance par défaut - Range: [0.0, 2.0] */
  export const LIFT_SCALE_DEFAULT = 1.0;

  /** Multiplicateur de traînée par défaut - Range: [0.0, 2.0] */
  export const DRAG_SCALE_DEFAULT = 1.0;

  /** Lissage temporel des forces - Range: [0.0, 1.0] */
  export const FORCE_SMOOTHING = 0.05;
}

// ============================================================================
// 🌊 CONDITIONS ENVIRONNEMENTALES
// ============================================================================

namespace EnvironmentConfig {
  // === Vent ===
  /** Vitesse du vent par défaut (m/s) - 0 = pas de vent pour tests gravité pure */
  export const WIND_SPEED_M_S = 5.0; // Changé de 8.0 à 0.0

  /** Direction du vent par défaut (degrés) - 270 = -Z = Nord */
  export const WIND_DIRECTION_DEG = 270;

  /** Turbulence par défaut (%) - Range: [0, 100] */
  export const WIND_TURBULENCE_PERCENT = 0;

  // === Système de coordonnées du vent ===
  // X = droite/gauche, Y = haut/bas, Z = devant/derrière
  // Direction 0° = +X (Est)
  // Direction 90° = +Z (Sud)
  // Direction 180° = -X (Ouest)
  // Direction 270° = -Z (Nord)

  // === Physique générale ===
  /** Damping linéaire (réduction de vélocité) - Plus fort pour stabilité */
  export const LINEAR_DAMPING = 0.5;

  /** Damping angulaire (réduction de rotation) - Plus fort pour stabilité */
  export const ANGULAR_DAMPING = 0.5;
}

// ============================================================================
// 👤 PILOTE
// ============================================================================

namespace PilotSpecs {
  /** Masse du pilote (kg) - Adulte standard */
  export const MASS_KG = 75;

  /** Hauteur du pilote (m) */
  export const HEIGHT_M = 1.6;

  /** Largeur aux épaules (m) */
  export const WIDTH_M = 0.5;

  /** Profondeur (m) */
  export const DEPTH_M = 0.3;

  /** Position Y du centre du pilote (m) */
  export const CENTER_Y_M = 0.8;
}

// ============================================================================
// 🚀 INITIALISATION - POSITIONS ET ORIENTATION
// ============================================================================

namespace InitConfig {
  // === Positions initiales ===
  // Système de coordonnées Three.js :
  // X = droite/gauche, Y = haut/bas, Z = devant/derrière (vent vient de -Z)

  /** Position Y du pivot de la barre (m) */
  export const CONTROL_BAR_POSITION_Y_M = 1;

  /** Distance avant du pivot (m) - 60cm devant le pilote */
  export const CONTROL_BAR_POSITION_Z_M = -0.6;

  /** Altitude du kite au-dessus de la barre (m) 
   * ✅ CORRIGÉ : Kite démarre 1m À L'INTÉRIEUR de la sphère de vol (14m)
   * Le vent va pousser le kite vers l'arrière jusqu'à tendre les lignes à 15m
   */
  export const KITE_ALTITUDE_M = 10;

  /** Distance du kite devant la barre (m)
   * Distance 3D = √(10² + 10²) = √200 ≈ 14.14m < 15m ✅ LIGNES SLACK AU DÉPART
   * Élongation initiale = 0m (impossible d'avoir élongation au repos !)
   * Le vent pousse → lignes se tendent progressivement → kite se stabilise à 15m
   */
  export const KITE_DISTANCE_M = 10;

  // === Orientation initiale ===
  /** Pitch initial (deg) - Face au vent avec angle d'attaque favorable
   * ✅ AJUSTÉ à 15° pour générer portance immédiate au démarrage
   */
  export const ORIENTATION_PITCH_DEG = 15;

  /** Yaw initial (deg) */
  export const ORIENTATION_YAW_DEG = 0;

  /** Roll initial (deg) */
  export const ORIENTATION_ROLL_DEG = 0;
}

// ============================================================================
// ⚙️ SIMULATION
// ============================================================================

namespace SimulationConfig {
  /** FPS cible */
  export const TARGET_FPS = 60;

  /** Frame time maximal (s) - 1/30 = 33.3ms pour éviter instabilités */
  export const MAX_FRAME_TIME_S = 1 / 30;

  /** Échelle de temps (1.0 = vitesse normale, <1 ralenti, >1 accéléré) */
  export const TIME_SCALE = 1.0;

  /** Démarrer automatiquement au chargement */
  export const AUTO_START = true;
}

// ============================================================================
// 🎨 RENDU
// ============================================================================

namespace RenderConfig {
  // === Caméra - Position et orientation ===
  /** Position X de la caméra relative au pilote (m) - Permet de voir le kite */
  export const CAMERA_POSITION_X = 13.37;

  /** Position Y de la caméra (hauteur, m) - Permet de voir l'altitude du kite */
  export const CAMERA_POSITION_Y = 11.96;

  /** Position Z de la caméra (profondeur, m) - Éloignement du plan XY */
  export const CAMERA_POSITION_Z = 0.45;

  /** Point visé X par la caméra (m) */
  export const CAMERA_LOOKAT_X = -3.92;

  /** Point visé Y par la caméra (m) */
  export const CAMERA_LOOKAT_Y = 0;

  /** Point visé Z par la caméra (m) */
  export const CAMERA_LOOKAT_Z = -12.33;

  /** Niveau de subdivision du mesh du kite - Range: [0, 4] */
  export const MESH_SUBDIVISION_LEVEL = 0;
}

// ============================================================================
// 🔍 DEBUG ET LOGGING
// ============================================================================

namespace DebugConfig {
  /** Mode debug activé */
  export const ENABLED = true;

  /** Afficher les vecteurs de force */
  export const SHOW_FORCE_VECTORS = true;

  /** Afficher les infos physiques détaillées */
  export const SHOW_PHYSICS_INFO = false;

  /** Niveau de log: 'debug' | 'info' | 'warn' | 'error' */
  export const LOG_LEVEL = 'info' as const;

  // === Paramètres de visualisation debug ===
  /** Intervalle de frame pour logging périodique (60 @ 60FPS = 1/sec) */
  export const FRAME_LOG_INTERVAL = 60;

  /** Facteur d'échelle pour vecteurs de force */
  export const FORCE_VECTOR_SCALE = 1;

  /** Seuil minimum de force pour afficher (N) */
  export const FORCE_THRESHOLD = 0.001;

  /** Seuil minimum de lift pour afficher (N) */
  export const LIFT_THRESHOLD = 0.0001;

  /** Facteur d'échelle du vecteur vent apparent (5%) */
  export const WIND_VECTOR_SCALE = 0.05;

  /** Longueur fixe pour affichage des normales (m) */
  export const NORMAL_DISPLAY_LENGTH = 2.0;

  /** Taille des labels texte (m) */
  export const TEXT_LABEL_SIZE = 0.2;

  // === Force arrow visualization ===
  /** Seuil minimal force pour affichage flèche (N) */
  export const MIN_FORCE_ARROW_DISPLAY = 0.01;

  /** Longueur maximale flèche force pour visibilité (m) */
  export const MAX_FORCE_ARROW_LENGTH = 30;

  // === Canvas de texture pour labels ===
  /** Dimension petit canvas pour labels simples (pixels) */
  export const CANVAS_SMALL_SIZE = 128;

  /** Dimension grand canvas pour labels complexes (pixels) */
  export const CANVAS_LARGE_SIZE = 512;

  /** Position centre petit canvas (= CANVAS_SMALL_SIZE / 2) */
  export const CANVAS_SMALL_CENTER = CANVAS_SMALL_SIZE / 2;

  /** Position centre grand canvas (= CANVAS_LARGE_SIZE / 2) */
  export const CANVAS_LARGE_CENTER = CANVAS_LARGE_SIZE / 2;
}

// ============================================================================
// 🖥️ INTERFACE UTILISATEUR (UI)
// ============================================================================

namespace UIConfig {
  /** Priorité du système UI dans le pipeline ECS */
  export const PRIORITY = 90;

  /** Précision décimale pour affichage vitesse (km/h) */
  export const DECIMAL_PRECISION_VELOCITY = 2;

  /** Précision décimale pour affichage position (m) */
  export const DECIMAL_PRECISION_POSITION = 2;

  /** Précision décimale pour affichage angles (°) */
  export const DECIMAL_PRECISION_ANGLE = 2;

  /** Facteur de conversion m/s → km/h (correction: était 3.6, mais nous utilisons m/s) */
  export const MS_TO_KMH = 3.6;

  /** Seuil minimum de vitesse vent pour affichage AOA (m/s) */
  export const MIN_WIND_SPEED = 0.01;

  /** Base pour calcul fractale triangles (Level N = TRIANGLES_BASE ^ (N+1)) */
  export const TRIANGLES_BASE = 4;
}

// ============================================================================
// 💨 SYSTÈME DE VENT
// ============================================================================

namespace WindConfig {
  /** Priorité du système Vent dans le pipeline ECS (avant Aéro qui a priorité 30) */
  export const PRIORITY = 20;

  /** Intervalle mise à jour du vent depuis InputComponent (ms) */
  export const UPDATE_INTERVAL = 100;

  /** Seuil de changement détecté en vitesse vent (m/s) */
  export const SPEED_CHANGE_THRESHOLD = 0.01;

  /** Seuil de changement détecté en direction vent (°) */
  export const DIRECTION_CHANGE_THRESHOLD = 0.5;

  /** Seuil de changement détecté en turbulence (%) */
  export const TURBULENCE_CHANGE_THRESHOLD = 0.1;

  /** Facteur d'amortissement turbulence verticale (0.3 = 30% de l'horizontale) */
  export const VERTICAL_TURBULENCE_FACTOR = 0.3;

  /** Vitesse minimale du vent pour calcul direction normalisée (m/s) */
  export const MINIMUM_WIND_SPEED = 0.01;

  /** Vitesse vent par défaut au démarrage (m/s) - 0 = pas de vent */
  export const DEFAULT_WIND_SPEED_MS = 0.0;

  /** Direction vent par défaut au démarrage (°) - 0 = +X (Est) */
  export const DEFAULT_WIND_DIRECTION = 0;

  /** Turbulence par défaut au démarrage (%) */
  export const DEFAULT_TURBULENCE = 10;
}

// ============================================================================
// ✈️ MODES PAR DÉFAUT DE LA SIMULATION
// ============================================================================

namespace SimulationModes {
  /** 
   * Mode aérodynamique par défaut : 'nasa' ou 'perso' 
   * - 'nasa' : Formules officielles NASA (plaques planes)
   * - 'perso' : Modèle personnalisé (Rayleigh)
   */
  export const AERO_MODE = 'nasa' as const;
}

// ============================================================================
// 🎯 VALEURS PAR DÉFAUT POUR INPUTCOMPONENT
// ============================================================================

namespace InputDefaults {
  /** Valeur par défaut pour lineLength (m)
   * ⚠️  Cette valeur doit correspondre à LineSpecs.LENGTH_M pour cohérence
   */
  export const LINE_LENGTH_M = 15;
  
  /** Valeur par défaut pour bridleNez (m) */
  export const BRIDLE_NEZ_M = 1.5;
  
  /** Valeur par défaut pour bridleInter (m) */
  export const BRIDLE_INTER_M = 2.0;
  
  /** Valeur par défaut pour bridleCentre (m) */
  export const BRIDLE_CENTRE_M = 2.5;
  
  /** Valeur par défaut pour meshSubdivisionLevel */
  export const MESH_SUBDIVISION_LEVEL = 2;
}

// ============================================================================
// ✨ EXPORT DE LA CONFIGURATION PRINCIPALE
// ============================================================================

export const CONFIG = {
  // === KITE ===
  kite: {
    mass: KiteSpecs.MASS_KG,
    wingspan: KiteSpecs.WINGSPAN_M,
    chord: KiteSpecs.CHORD_M,
    surfaceArea: KiteSpecs.SURFACE_AREA_M2,
    inertia: {
      Ixx: KiteSpecs.INERTIA_XX,
      Iyy: KiteSpecs.INERTIA_YY,
      Izz: KiteSpecs.INERTIA_ZZ
    },
    color: KiteSpecs.COLOR
  },

  // === LIGNES ===
  lines: {
    length: LineSpecs.LENGTH_M,
    maxTension: LineSpecs.MAX_TENSION_N,
    color: LineSpecs.COLOR,
    constraintMode: LineSpecs.CONSTRAINT_MODE,
    pbd: {
      iterations: PhysicsConstants.PBD_ITERATIONS,
      compliance: PhysicsConstants.PBD_COMPLIANCE,
      maxCorrection: PhysicsConstants.PBD_MAX_CORRECTION,
      maxLambda: PhysicsConstants.PBD_MAX_LAMBDA,
      angularDamping: PhysicsConstants.PBD_ANGULAR_DAMPING
    },
    springForce: {
      stiffness: LineSpecs.STIFFNESS_N_PER_M,
      damping: LineSpecs.DAMPING_N_S_PER_M,
      maxForce: LineSpecs.MAX_FORCE_N
    }
  },

  // === BRIDES ===
  bridles: {
    nez: BridleConfig.LENGTH_NEZ_M,    // 0.65m = 65cm (correct pour les brides)
    inter: BridleConfig.LENGTH_INTER_M, // 0.65m = 65cm (correct pour les brides)
    centre: BridleConfig.LENGTH_CENTRE_M, // 0.65m = 65cm (correct pour les brides)
    color: BridleConfig.COLOR
  },

  // === AÉRODYNAMIQUE ===
  aero: {
    airDensity: PhysicsConstants.AIR_DENSITY,
    CL0: AeroConfig.CL0,
    CLAlpha: AeroConfig.CL_ALPHA_PER_DEG,
    alpha0: AeroConfig.ALPHA_ZERO_DEG,
    alphaOptimal: AeroConfig.ALPHA_OPTIMAL_DEG,
    CD0: AeroConfig.CD0,
    CM: AeroConfig.CM,
    liftScale: AeroConfig.LIFT_SCALE_DEFAULT,
    dragScale: AeroConfig.DRAG_SCALE_DEFAULT,
    forceSmoothing: AeroConfig.FORCE_SMOOTHING
  },

  // === VENT ===
  wind: {
    speed: EnvironmentConfig.WIND_SPEED_M_S,
    direction: EnvironmentConfig.WIND_DIRECTION_DEG,
    turbulence: EnvironmentConfig.WIND_TURBULENCE_PERCENT
  },

  // === PHYSIQUE ===
  physics: {
    gravity: PhysicsConstants.GRAVITY,
    linearDamping: EnvironmentConfig.LINEAR_DAMPING,
    angularDamping: EnvironmentConfig.ANGULAR_DAMPING
  },

  // === PILOTE ===
  pilot: {
    mass: PilotSpecs.MASS_KG,
    height: PilotSpecs.HEIGHT_M,
    width: PilotSpecs.WIDTH_M,
    depth: PilotSpecs.DEPTH_M
  },

  // === INITIALISATION ===
  initialization: {
    controlBarPosition: new THREE.Vector3(0, InitConfig.CONTROL_BAR_POSITION_Y_M, InitConfig.CONTROL_BAR_POSITION_Z_M),
    kiteAltitude: InitConfig.KITE_ALTITUDE_M,
    kiteDistance: InitConfig.KITE_DISTANCE_M,
    kiteOrientation: {
      pitch: InitConfig.ORIENTATION_PITCH_DEG,
      yaw: InitConfig.ORIENTATION_YAW_DEG,
      roll: InitConfig.ORIENTATION_ROLL_DEG
    }
  },

  // === SIMULATION ===
  simulation: {
    targetFPS: SimulationConfig.TARGET_FPS,
    maxFrameTime: SimulationConfig.MAX_FRAME_TIME_S,
    timeScale: SimulationConfig.TIME_SCALE,
    autoStart: SimulationConfig.AUTO_START
  },

  // === RENDU ===
  render: {
    cameraPosition: new THREE.Vector3(RenderConfig.CAMERA_POSITION_X, RenderConfig.CAMERA_POSITION_Y, RenderConfig.CAMERA_POSITION_Z),
    cameraLookAt: new THREE.Vector3(RenderConfig.CAMERA_LOOKAT_X, RenderConfig.CAMERA_LOOKAT_Y, RenderConfig.CAMERA_LOOKAT_Z),
    meshSubdivision: RenderConfig.MESH_SUBDIVISION_LEVEL
  },

  // === DEBUG ===
  debug: {
    enabled: DebugConfig.ENABLED,
    showForceVectors: DebugConfig.SHOW_FORCE_VECTORS,
    showPhysicsInfo: DebugConfig.SHOW_PHYSICS_INFO,
    logLevel: DebugConfig.LOG_LEVEL
  },

  // === MODES ===
  modes: {
    aero: SimulationModes.AERO_MODE,
    constraint: LineSpecs.CONSTRAINT_MODE
  }
} as const;

// ============================================================================
// 📦 EXPORTS PUBLICS - Pour utilisation dans les systèmes
// ============================================================================

// Exports des namespaces pour accès direct aux constantes spécialisées
export {
  PhysicsConstants,
  ConstraintConfig,
  VisualConstants,
  SimulationConstants,
  KiteSpecs,
  BridleConfig,
  LineSpecs,
  AeroConfig,
  EnvironmentConfig,
  PilotSpecs,
  InitConfig,
  SimulationConfig,
  RenderConfig,
  DebugConfig,
  UIConfig,
  WindConfig,
  SimulationModes,
  InputDefaults
};

```

---

## Fichier: `ecs/config/KiteGeometry.ts`

```typescript
/**
 * KiteGeometry.ts - Géométrie du cerf-volant delta
 * 
 * Définit tous les points structurels du kite en coordonnées locales.
 * Origine = centre géométrique (approximatif).
 */

import * as THREE from 'three';
import { KiteSpecs } from './Config';

export class KiteGeometry {
  /**
   * Retourne les points du delta en coordonnées locales
   * 
   * Système de coordonnées Three.js standard :
   * - X : droite/gauche
   * - Y : haut/bas  
   * - Z : avant/arrière (positif = vers l'avant, négatif = vers l'arrière)
   * - Origine : SPINE_BAS (base du kite)
   */
  static getDeltaPoints(): Map<string, THREE.Vector3> {
    const points = new Map<string, THREE.Vector3>();
    
    // Dimensions
    const width = KiteSpecs.WINGSPAN_M;  // Envergure
    const height = KiteSpecs.CHORD_M;    // Hauteur (nez)
    const depth = KiteSpecs.WHISKER_DEPTH_M;  // Profondeur whiskers (vers l'arrière)
    
    // Points principaux (dans le plan Z=0)
    points.set('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    points.set('NEZ', new THREE.Vector3(0, height, 0));
    points.set('BORD_GAUCHE', new THREE.Vector3(-width / 2, 0, 0));
    points.set('BORD_DROIT', new THREE.Vector3(width / 2, 0, 0));
    
    // CENTRE (25% de la hauteur depuis la base)
    const centreY = height * KiteSpecs.CENTER_HEIGHT_RATIO;
    points.set('CENTRE', new THREE.Vector3(0, centreY, 0));
    
    // INTER points (intersection barre transversale / bords d'attaque)
    // À hauteur CENTRE, sur les leading edges
    const t = KiteSpecs.INTERPOLATION_RATIO; // = 0.75
    const interX = (width / 2) * t;
    points.set('INTER_GAUCHE', new THREE.Vector3(-interX, centreY, 0));
    points.set('INTER_DROIT', new THREE.Vector3(interX, centreY, 0));
    
    // FIX points (whiskers attachments sur le frame)
    const fixRatio = KiteSpecs.FIX_POINT_RATIO; // = 2/3
    points.set('FIX_GAUCHE', new THREE.Vector3(-interX * fixRatio, centreY, 0));
    points.set('FIX_DROIT', new THREE.Vector3(interX * fixRatio, centreY, 0));
    
    // WHISKER points (EN ARRIÈRE - Z négatif)
    // Stabilisateurs qui donnent de la profondeur au kite
    points.set('WHISKER_GAUCHE', new THREE.Vector3(-interX * fixRatio, centreY * KiteSpecs.WHISKER_HEIGHT_RATIO, -depth));
    points.set('WHISKER_DROIT', new THREE.Vector3(interX * fixRatio, centreY * KiteSpecs.WHISKER_HEIGHT_RATIO, -depth));
    
    // === POINTS DE CONTRÔLE (CTRL) - CALCULÉS DYNAMIQUEMENT ===
    // Points où les lignes s'attachent au kite via les brides
    // 
    // IMPORTANT: Les positions CTRL ne sont PAS définies ici statiquement.
    // Elles sont calculées dynamiquement par BridleConstraintSystem via trilatération 3D
    // pour satisfaire les contraintes de longueur des bridles (nez, inter, centre).
    //
    // Les positions initiales placeholders sont fournies par BridleConstraintSystem.update()
    // lors de la première initialisation du kite.
    //
    // Pour modifier les longueurs des brides, utilisez InputComponent dans l'UI,
    // et BridleConstraintSystem recalculera automatiquement les positions CTRL.
    
    // Placeholder: positions seront recalculées par BridleConstraintSystem
    points.set('CTRL_GAUCHE', new THREE.Vector3(0, 0, 0));
    points.set('CTRL_DROIT', new THREE.Vector3(0, 0, 0));
    
    return points;
  }
  
  /**
   * Retourne les connexions (arêtes) du delta
   */
  static getDeltaConnections(): Array<{ from: string; to: string }> {
    return [
      // Bords d'attaque
      { from: 'NEZ', to: 'BORD_GAUCHE' },
      { from: 'NEZ', to: 'BORD_DROIT' },
      
      // Bords de fuite
      { from: 'BORD_GAUCHE', to: 'CENTRE' },
      { from: 'BORD_DROIT', to: 'CENTRE' },
      
      // Spine
      { from: 'NEZ', to: 'SPINE_BAS' },
      { from: 'CENTRE', to: 'SPINE_BAS' },
      
      // Barre transversale
      { from: 'INTER_GAUCHE', to: 'INTER_DROIT' },
      
      // Whiskers
      { from: 'FIX_GAUCHE', to: 'WHISKER_GAUCHE' },
      { from: 'FIX_DROIT', to: 'WHISKER_DROIT' }
    ];
  }
}

```

---

## Fichier: `ecs/config/KiteSurfaceDefinition.ts`

```typescript
/**
 * KiteSurfaceDefinition.ts - Définition centralisée des surfaces du kite delta
 *
 * Source unique de vérité pour les 4 surfaces triangulaires du cerf-volant.
 * Centralise la définition pour éviter les duplications et incohérences.
 *
 * ORDRE DES VERTICES CRITIQUE:
 * - Détermine l'orientation des normales (règle de la main droite)
 * - Utilisé par GeometryComponent (rendu 3D) et AeroSystemNASA (calculs aéro)
 * - Doit être identique dans tous les systèmes
 *
 * COORDONNÉES:
 * - X: gauche (+) / droite (-)
 * - Y: haut (+) / bas (-)
 * - Z: avant (+) / arrière (-)
 * - Normales: pointent vers l'EXTÉRIEUR (côté convexe, Z+) pour portance vers le haut
 */

export interface KiteSurfaceDefinition {
  /** Identificateur unique de la surface */
  id: string;
  
  /** Nom lisible de la surface */
  name: string;
  
  /** Points du triangle (ordre critique pour la normale) */
  points: [string, string, string];
  
  /** Description pour documentation */
  description: string;
}

export class KiteSurfaceDefinitions {
  /**
   * Les 4 surfaces du cerf-volant delta
   * 
   * ⚠️ L'ordre des points DOIT rester cohérent partout:
   * - GeometryComponent (rendu 3D)
   * - AerodynamicsComponent (calculs aéro)
   * - Tout autre système utilisant les surfaces
   */
  static readonly SURFACES: KiteSurfaceDefinition[] = [
    {
      id: 'leftUpper',
      name: 'Left Upper Surface',
      points: ['WHISKER_GAUCHE', 'BORD_GAUCHE', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face supérieure du côté gauche - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'leftLower',
      name: 'Left Lower Surface',
      points: ['SPINE_BAS', 'WHISKER_GAUCHE', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face inférieure du côté gauche - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'rightUpper',
      name: 'Right Upper Surface',
      points: ['BORD_DROIT', 'WHISKER_DROIT', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face supérieure du côté droit - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'rightLower',
      name: 'Right Lower Surface',
      points: ['WHISKER_DROIT', 'SPINE_BAS', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face inférieure du côté droit - Normale pointe vers l\'extérieur et vers le haut'
    }
  ];

  /**
   * Récupère toutes les surfaces du kite
   */
  static getAll(): KiteSurfaceDefinition[] {
    return [...this.SURFACES];
  }

  /**
   * Récupère une surface par son ID
   */
  static getById(id: string): KiteSurfaceDefinition | undefined {
    return this.SURFACES.find(s => s.id === id);
  }

  /**
   * Récupère les surfaces du côté gauche
   */
  static getLeftSurfaces(): KiteSurfaceDefinition[] {
    return this.SURFACES.filter(s => s.id.startsWith('left'));
  }

  /**
   * Récupère les surfaces du côté droit
   */
  static getRightSurfaces(): KiteSurfaceDefinition[] {
    return this.SURFACES.filter(s => s.id.startsWith('right'));
  }

  /**
   * Valide que toutes les surfaces sont cohérentes
   * (utile pour les tests et le debug)
   */
  static validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Vérifier que tous les IDs sont uniques
    const ids = this.SURFACES.map(s => s.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      errors.push('❌ Des IDs de surface ne sont pas uniques');
    }

    // Vérifier que tous les noms sont uniques
    const names = this.SURFACES.map(s => s.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      errors.push('❌ Des noms de surface ne sont pas uniques');
    }

    // Vérifier que chaque surface a exactement 3 points
    this.SURFACES.forEach(surface => {
      if (!surface.points || surface.points.length !== 3) {
        errors.push(`❌ Surface ${surface.id}: doit avoir exactement 3 points, en a ${surface.points?.length ?? 0}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

```

---

## Fichier: `ecs/config/UIConfig.ts`

```typescript
/**
 * UIConfig.ts - Métadonnées pour l'interface utilisateur
 *
 * Ce fichier contient UNIQUEMENT les métadonnées UI (min, max, step, labels).
 * Toutes les valeurs par défaut proviennent de Config.ts (source unique de vérité).
 */

import { CONFIG } from './Config';

/**
 * Métadonnées UI pour les contrôles (sliders, inputs, etc.)
 * N'utiliser que pour définir les limites et le comportement des contrôles.
 */
export const UI_METADATA = {
  wind: {
    speed: {
      min: 0,
      max: 30,
      step: 0.5,
      unit: 'm/s',
      label: 'Vitesse du vent'
    },
    direction: {
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      label: 'Direction du vent'
    },
    turbulence: {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      label: 'Turbulence'
    }
  },

  lines: {
    constraintMode: {
      options: ['pbd', 'spring-force'] as const,
      labels: {
        pbd: 'PBD (Rigide)',
        'spring-force': 'Forces Ressort'
      },
      label: 'Mode de contrainte'
    },
    aeroMode: {
      options: ['perso', 'nasa'] as const,
      labels: {
        perso: 'Perso (Rayleigh)',
        nasa: 'NASA (Officiel)'
      },
      label: 'Mode aérodynamique'
    },
    length: {
      min: 5,
      max: 300,
      step: 5,
      unit: 'm',
      label: 'Longueur des lignes'
    },
    bridles: {
      nez: {
        min: 0.5,
        max: 5,
        step: 0.01,
        unit: 'm',
        label: 'Bride nez'
      },
      inter: {
        min: 0.5,
        max: 5,
        step: 0.01,
        unit: 'm',
        label: 'Bride inter'
      },
      centre: {
        min: 0.5,
        max: 5,
        step: 0.01,
        unit: 'm',
        label: 'Bride centre'
      }
    }
  },

  physics: {
    linearDamping: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Amortissement linéaire'
    },
    angularDamping: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Amortissement angulaire'
    }
  },

  aerodynamics: {
    liftScale: {
      min: 0,
      max: 2,
      step: 0.1,
      unit: '',
      label: 'Échelle de portance'
    },
    dragScale: {
      min: 0,
      max: 2,
      step: 0.1,
      unit: '',
      label: 'Échelle de traînée'
    },
    forceSmoothing: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Lissage des forces'
    }
  },

  render: {
    meshSubdivision: {
      min: 0,
      max: 4,
      step: 1,
      unit: '',
      label: 'Subdivision du mesh'
    }
  }
};

/**
 * Valeurs par défaut pour l'UI - TOUJOURS importées depuis Config.ts
 * Ces getters garantissent que l'UI affiche les valeurs actuelles de la simulation.
 */
export const UI_DEFAULTS = {
  wind: {
    get speed() { return CONFIG.wind.speed; },
    get direction() { return CONFIG.wind.direction; },
    get turbulence() { return CONFIG.wind.turbulence; }
  },

  lines: {
    get length() { return CONFIG.lines.length; },
    bridles: {
      get nez() { return CONFIG.bridles.nez; },
      get inter() { return CONFIG.bridles.inter; },
      get centre() { return CONFIG.bridles.centre; }
    }
  },

  physics: {
    get linearDamping() { return CONFIG.physics.linearDamping; },
    get angularDamping() { return CONFIG.physics.angularDamping; }
  },

  aerodynamics: {
    get liftScale() { return CONFIG.aero.liftScale; },
    get dragScale() { return CONFIG.aero.dragScale; },
    get forceSmoothing() { return CONFIG.aero.forceSmoothing; }
  },

  render: {
    get meshSubdivision() { return CONFIG.render.meshSubdivision; }
  }
};

/**
 * Helper pour récupérer une valeur de configuration avec métadonnées
 */
export function getUIControl(category: string, field: string) {
  const metadata = (UI_METADATA as any)[category]?.[field];
  const defaultValue = (UI_DEFAULTS as any)[category]?.[field];

  return {
    value: defaultValue,
    ...metadata
  };
}

```

---

## Fichier: `ecs/config/index.ts`

```typescript
/**
 * index.ts - Exports de configuration
 */

export { CONFIG } from './Config';
export { KiteGeometry } from './KiteGeometry';

```

---

## Fichier: `ecs/core/Component.ts`

```typescript
/**
 * Component.ts - Interface de base pour tous les composants ECS
 * 
 * Un composant est un conteneur de données pures sans logique métier.
 * La logique est dans les systèmes qui manipulent ces composants.
 */

export abstract class Component {
  /** Type du composant (utilisé pour les queries) */
  abstract readonly type: string;
}

/**
 * Type helper pour extraire le type d'un composant
 */
export type ComponentType<T extends Component> = T['type'];

```

---

## Fichier: `ecs/core/Entity.ts`

```typescript
/**
 * Entity.ts - Entité ECS (conteneur de composants)
 * 
 * Une entité est simplement :
 * - Un identifiant unique
 * - Une collection de composants
 * 
 * Pas de logique métier ici, seulement de la gestion de composants.
 */

import { Component } from './Component';

export class Entity {
  /** Identifiant unique de l'entité */
  readonly id: string;
  
  /** Map des composants (type → composant) */
  private components: Map<string, Component>;
  
  constructor(id: string) {
    this.id = id;
    this.components = new Map();
  }
  
  /**
   * Ajoute un composant à l'entité
   */
  addComponent(component: Component): this {
    this.components.set(component.type, component);
    return this;
  }
  
  /**
   * Récupère un composant par son type
   */
  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }
  
  /**
   * Vérifie si l'entité possède un composant
   */
  hasComponent(type: string): boolean {
    return this.components.has(type);
  }
  
  /**
   * Vérifie si l'entité possède tous les composants spécifiés
   */
  hasAllComponents(types: string[]): boolean {
    return types.every(type => this.hasComponent(type));
  }
  
  /**
   * Supprime un composant
   */
  removeComponent(type: string): boolean {
    return this.components.delete(type);
  }
  
  /**
   * Récupère tous les types de composants
   */
  getComponentTypes(): string[] {
    return Array.from(this.components.keys());
  }
  
  /**
   * Récupère tous les composants
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }
}

```

---

## Fichier: `ecs/core/EntityManager.ts`

```typescript
/**
 * EntityManager.ts - Gestionnaire d'entités ECS
 * 
 * Responsabilités :
 * - Enregistrer/supprimer des entités
 * - Query des entités par archétypes (composants requis)
 * - Accès rapide par ID
 */

import { Logger } from '../utils/Logging';

import { Entity } from './Entity';

export class EntityManager {
  /** Map des entités (id → entité) */
  private entities: Map<string, Entity>;
  private logger = Logger.getInstance();
  
  constructor() {
    this.entities = new Map();
  }
  
  /**
   * Enregistre une entité
   */
  register(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      this.logger.warn(`Entity ${entity.id} already registered`, 'EntityManager');
      return;
    }
    this.entities.set(entity.id, entity);
  }
  
  /**
   * Récupère une entité par son ID
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }
  
  /**
   * Vérifie si une entité existe
   */
  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }
  
  /**
   * Supprime une entité
   */
  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }
  
  /**
   * Query : récupère toutes les entités avec les composants spécifiés
   * 
   * @param componentTypes - Types de composants requis
   * @returns Array d'entités matching
   */
  query(componentTypes: string[]): Entity[] {
    return Array.from(this.entities.values()).filter(entity =>
      entity.hasAllComponents(componentTypes)
    );
  }
  
  /**
   * Récupère toutes les entités
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
  
  /**
   * Compte le nombre d'entités
   */
  getEntityCount(): number {
    return this.entities.size;
  }
  
  /**
   * Vide toutes les entités
   */
  clear(): void {
    this.entities.clear();
  }
}

```

---

## Fichier: `ecs/core/System.ts`

```typescript
/**
 * System.ts - Classe de base pour tous les systèmes ECS
 * 
 * Un système contient la logique métier qui opère sur les entités
 * possédant certains composants.
 * 
 * Cycle de vie : initialize() → update() → dispose()
 */

import { EntityManager } from './EntityManager';

/**
 * Contexte de simulation passé à chaque update
 * Peut contenir des caches temporaires partagés entre systèmes
 */
export interface SimulationContext {
  deltaTime: number;
  totalTime: number;
  entityManager: EntityManager;
  
  // Caches optionnels pour partage de données inter-systèmes
  windCache?: Map<string, unknown>; // Cache du vent apparent (WindSystem → AeroSystem)
  [key: string]: unknown; // Permettre d'autres caches personnalisés
}

/**
 * Classe de base abstraite pour tous les systèmes
 */
export abstract class System {
  /** Nom du système (pour debug) */
  readonly name: string;
  
  /** Priorité d'exécution (plus bas = plus tôt) */
  readonly priority: number;
  
  /** Le système est-il actif ? */
  private enabled: boolean = true;
  
  constructor(name: string, priority: number = 50) {
    this.name = name;
    this.priority = priority;
  }
  
  /**
   * Initialisation du système (appelé une fois au démarrage)
   * Utile pour créer des ressources, s'abonner à des événements, etc.
   */
  initialize(_entityManager: EntityManager): void {
    // Override si nécessaire
  }
  
  /**
   * Update du système (appelé chaque frame)
   * C'est ici que la logique métier s'exécute
   */
  abstract update(context: SimulationContext): void;
  
  /**
   * Nettoyage du système (appelé à la fin)
   * Libère les ressources, se désabonne des événements, etc.
   */
  dispose(): void {
    // Override si nécessaire
  }
  
  /**
   * Active/désactive le système
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Vérifie si le système est actif
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

```

---

## Fichier: `ecs/core/SystemManager.ts`

```typescript
/**
 * SystemManager.ts - Gestionnaire de systèmes ECS
 * 
 * Responsabilités :
 * - Enregistrer des systèmes
 * - Les exécuter dans l'ordre de priorité
 * - Gérer leur cycle de vie (init/update/dispose)
 */

import { System, SimulationContext } from './System';
import { EntityManager } from './EntityManager';

export class SystemManager {
  /** Liste des systèmes (triée par priorité) */
  private systems: System[];
  
  constructor() {
    this.systems = [];
  }
  
  /**
   * Ajoute un système (et trie par priorité)
   */
  add(system: System): void {
    this.systems.push(system);
    // Tri par priorité croissante
    this.systems.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Initialise tous les systèmes
   */
  async initializeAll(entityManager: EntityManager): Promise<void> {
    for (const system of this.systems) {
      system.initialize(entityManager);
    }
  }
  
  /**
   * Update tous les systèmes actifs
   */
  updateAll(context: SimulationContext): void {
    for (const system of this.systems) {
      if (system.isEnabled()) {
        system.update(context);
      }
    }
  }
  
  /**
   * Dispose tous les systèmes
   */
  disposeAll(): void {
    for (const system of this.systems) {
      system.dispose();
    }
    this.systems = [];
  }
  
  /**
   * Récupère un système par son nom
   */
  getSystem(name: string): System | undefined {
    return this.systems.find(s => s.name === name);
  }
  
  /**
   * Active/désactive un système
   */
  setSystemEnabled(name: string, enabled: boolean): void {
    const system = this.getSystem(name);
    if (system) {
      system.setEnabled(enabled);
    }
  }
  
  /**
   * Liste tous les systèmes
   */
  getAllSystems(): System[] {
    return [...this.systems];
  }
}

```

---

## Fichier: `ecs/core/index.ts`

```typescript
/**
 * index.ts - Exports du module core
 */

export { Component } from './Component';
export type { ComponentType } from './Component';
export { Entity } from './Entity';
export { EntityManager } from './EntityManager';
export { System } from './System';
export type { SimulationContext } from './System';
export { SystemManager } from './SystemManager';

```

---

## Fichier: `ecs/entities/BridleFactory.ts`

```typescript
/**
 * BridleFactory.ts - Factory pour créer les entités brides
 *
 * Les brides sont créées comme des entités similaires aux lignes,
 * mais avec une géométrie qui représente les cordes reliant le kite au barre.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { GeometryComponent, TransformComponent, VisualComponent } from '../components';

/**
 * Crée les 6 entités brides (cordes dynamiques du kite)
 *
 * Les brides relient:
 * - CTRL_GAUCHE: NEZ, INTER_GAUCHE, CENTRE
 * - CTRL_DROIT: NEZ, INTER_DROIT, CENTRE
 *
 * Positions mises à jour par BridleRenderSystem en coordonnées MONDE.
 */
export class BridleFactory {
  // Constante pour la couleur des brides
  private static readonly BRIDLE_COLOR = 0x333333; // Gris foncé
  private static readonly BRIDLE_OPACITY = 0.8;

  // Liste des IDs des bridles à créer
  private static readonly BRIDLE_IDS = [
    'bridle-ctrl-gauche-nez',
    'bridle-ctrl-gauche-inter',
    'bridle-ctrl-gauche-centre',
    'bridle-ctrl-droit-nez',
    'bridle-ctrl-droit-inter',
    'bridle-ctrl-droit-centre'
  ];

  /**
   * Crée toutes les 6 entités brides
   * 
   * @returns Tableau des 6 entités bridles
   */
  static createAll(): Entity[] {
    return this.BRIDLE_IDS.map(id => this.createBridle(id));
  }

  /**
   * Crée une entité bridle individuelle
   *
   * @param id ID unique de la bridle
   * @returns Entité bridle avec tous les composants nécessaires
   */
  private static createBridle(id: string): Entity {
    const entity = new Entity(id);

    // === TRANSFORM (requis pour RenderSystem) ===
    // Position neutre car les positions sont mises à jour en coordonnées MONDE
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, 0, 0)
    }));

    // === GEOMETRY ===
    // Points seront mis à jour dynamiquement par BridleRenderSystem
    const geometry = new GeometryComponent();
    geometry.setPoint('start', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('end', new THREE.Vector3(0, 1, 0));
    geometry.addConnection('start', 'end');
    entity.addComponent(geometry);

    // === VISUAL ===
    // Les brides sont affichées en gris foncé avec légère transparence
    entity.addComponent(new VisualComponent({
      color: this.BRIDLE_COLOR,
      opacity: this.BRIDLE_OPACITY
    }));

    return entity;
  }
}

```

---

## Fichier: `ecs/entities/ControlBarFactory.ts`

```typescript
/**
 * ControlBarFactory.ts - Factory pour créer la barre de contrôle
 * 
 * La barre contient les deux poignets (points d'attache des lignes).
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { TransformComponent, GeometryComponent, VisualComponent, PhysicsComponent } from '../components';
import { EnvironmentConfig } from '../config/Config';

export class ControlBarFactory {
  /**
   * Crée l'entité barre de contrôle
   */
  static create(position: THREE.Vector3): Entity {
    const entity = new Entity('controlBar');
    
    // === TRANSFORM ===
    entity.addComponent(new TransformComponent({
      position: position.clone()
    }));
    
    // === GEOMETRY ===
    const geometry = new GeometryComponent();

    // Poignets espacés de 65cm
    // ⚠️ INVERSÉ : Pour correspondre à la vue caméra (depuis la droite regardant vers gauche)
    // La caméra crée un effet miroir, donc on inverse les X pour que les noms correspondent à l'écran
    const poignetSpacing = 0.65;
    geometry.setPoint('poignet_gauche', new THREE.Vector3(poignetSpacing / 2, 0, 0));   // X = +0.325 (apparaît à GAUCHE à l'écran)
    geometry.setPoint('poignet_droit', new THREE.Vector3(-poignetSpacing / 2, 0, 0)); // X = -0.325 (apparaît à DROITE à l'écran)

    // Point pivot au centre de la barre (pour rotation et référence)
    geometry.setPoint('pivot', new THREE.Vector3(0, 0, 0));

    // Connexion entre les poignets (la barre elle-même)
    geometry.addConnection('poignet_gauche', 'poignet_droit');

    entity.addComponent(geometry);

    // === PHYSICS ===
    // La barre est maintenue par le pilote mais peut bouger légèrement
    // Masse réaliste d'une barre de contrôle : ~0.5kg
    // TEMPORAIRE: Cinématique pour tester les contraintes
    entity.addComponent(new PhysicsComponent({
      mass: 0.5,
      isKinematic: true, // ← FIXE pour tester (pilote tient fermement)
      linearDamping: EnvironmentConfig.LINEAR_DAMPING,
      angularDamping: EnvironmentConfig.ANGULAR_DAMPING
    }));

    // === VISUAL ===
    entity.addComponent(new VisualComponent({
      color: 0x8B4513, // Marron (SaddleBrown)
      opacity: 1.0
    }));

    return entity;
  }
}

```

---

## Fichier: `ecs/entities/DebugFactory.ts`

```typescript
import { Entity } from '../core/Entity';
import { DebugComponent } from '../components/DebugComponent';

/**
 * Crée l'entité debug pour la visualisation des vecteurs de force.
 */
export class DebugFactory {
  public static create(): Entity {
    const debugEntity = new Entity('debug-helper');
    debugEntity.addComponent(new DebugComponent());
    return debugEntity;
  }
}

```

---

## Fichier: `ecs/entities/KiteFactory.ts`

```typescript
/**
 * KiteFactory.ts - Factory pour créer l'entité kite
 * 
 * Crée un kite delta complet avec tous ses composants.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import {
  TransformComponent,
  PhysicsComponent,
  GeometryComponent,
  VisualComponent,
  KiteComponent,
  BridleComponent,
  AerodynamicsComponent
} from '../components';
import { CONFIG } from '../config/Config';
import { KiteGeometry } from '../config/KiteGeometry';
import { KiteSurfaceDefinitions } from '../config/KiteSurfaceDefinition';
import { MathUtils } from '../utils/MathUtils';

export class KiteFactory {
  /**
   * Crée l'entité kite
   */
  static create(initialPosition: THREE.Vector3): Entity {
    const entity = new Entity('kite');
    
    this.addTransformComponent(entity, initialPosition);
    this.addPhysicsComponent(entity);
    this.addGeometryComponent(entity);
    this.addVisualComponent(entity);
    this.addKiteComponent(entity);
    this.addBridleComponent(entity);
    this.addAerodynamicsComponent(entity);
    
    return entity;
  }

  /**
   * Ajoute le composant Transform avec position et orientation initiales
   */
  private static addTransformComponent(entity: Entity, position: THREE.Vector3): void {
    const orientation = MathUtils.quaternionFromEuler(
      CONFIG.initialization.kiteOrientation.pitch,
      CONFIG.initialization.kiteOrientation.yaw,
      CONFIG.initialization.kiteOrientation.roll
    );

    const clonedPosition = position.clone();

    entity.addComponent(new TransformComponent({
      position: clonedPosition,
      quaternion: orientation
    }));
  }

  /**
   * Ajoute le composant Physics avec masse, inertie et damping
   */
  private static addPhysicsComponent(entity: Entity): void {
    // SIMPLIFICATION TEMPORAIRE : Inertie sphérique simple pour éviter les NaN
    // Formule inertie sphère : I = (2/5) * m * r²
    const mass = CONFIG.kite.mass;
    const radius = 1.0; // Rayon fictif de 1m
    const I = (2/5) * mass * radius * radius;
    
    const inertia = new THREE.Matrix3();
    inertia.set(
      I, 0, 0,
      0, I, 0,
      0, 0, I
    );

    entity.addComponent(new PhysicsComponent({
      mass: mass,
      inertia,
      linearDamping: CONFIG.physics.linearDamping,  // Utilise la config (peut être modifié via UI)
      angularDamping: CONFIG.physics.angularDamping,
      isKinematic: false    // ✅ DYNAMIQUE : Le kite est libre de bouger
    }));
  }

  /**
   * Ajoute le composant Geometry avec points et connexions
   */
  private static addGeometryComponent(entity: Entity): void {
    const geometry = new GeometryComponent();
    
    // Ajouter tous les points
    const points = KiteGeometry.getDeltaPoints();
    points.forEach((point, name) => {
      geometry.setPoint(name, point);
    });
    
    // Ajouter connexions
    KiteGeometry.getDeltaConnections().forEach(conn => {
      geometry.addConnection(conn.from, conn.to);
    });

    // === SURFACES DU KITE ===
    // ✨ ARCHITECTURE: Utiliser KiteSurfaceDefinitions pour éviter la duplication
    // La source unique de vérité pour l'ordre des vertices est centralisée là-bas
    KiteSurfaceDefinitions.getAll().forEach(surfaceDefinition => {
      geometry.addSurface(surfaceDefinition.points);
    });
    
    entity.addComponent(geometry);
  }

  /**
   * Ajoute le composant Visual pour le rendu
   */
  private static addVisualComponent(entity: Entity): void {
    entity.addComponent(new VisualComponent({
      color: CONFIG.kite.color,
      opacity: 0.8,
      wireframe: false
    }));
  }

  /**
   * Ajoute le composant Kite avec dimensions
   */
  private static addKiteComponent(entity: Entity): void {
    entity.addComponent(new KiteComponent({
      wingspan: CONFIG.kite.wingspan,
      chord: CONFIG.kite.chord,
      surfaceArea: CONFIG.kite.surfaceArea
    }));
  }

  /**
   * Ajoute le composant Bridle avec configuration des brides
   */
  private static addBridleComponent(entity: Entity): void {
    entity.addComponent(new BridleComponent({
      nez: CONFIG.bridles.nez,
      inter: CONFIG.bridles.inter,
      centre: CONFIG.bridles.centre
    }));
  }

  /**
   * Ajoute le composant Aerodynamics avec coefficients aérodynamiques
   */
  private static addAerodynamicsComponent(entity: Entity): void {
    // ✨ ARCHITECTURE: Utiliser KiteSurfaceDefinitions pour éviter la duplication
    // La source unique de vérité pour l'ordre des vertices est centralisée là-bas
    const aeroSurfaces = KiteSurfaceDefinitions.getAll().map(surfaceDefinition => ({
      name: surfaceDefinition.id,
      points: surfaceDefinition.points
    }));

    entity.addComponent(new AerodynamicsComponent({
      coefficients: {
        CL: CONFIG.aero.CL0,
        CD: CONFIG.aero.CD0,
        CD0: CONFIG.aero.CD0,
        CM: CONFIG.aero.CM,
        CLAlpha: CONFIG.aero.CLAlpha,
        alpha0: CONFIG.aero.alpha0,
        alphaOptimal: CONFIG.aero.alphaOptimal
      },
      airDensity: CONFIG.aero.airDensity,
      surfaces: aeroSurfaces
    }));
  }
}

```

---

## Fichier: `ecs/entities/LineFactory.ts`

```typescript
/**
 * LineFactory.ts - Factory pour créer les entités lignes
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { LineComponent, GeometryComponent, VisualComponent, TransformComponent } from '../components';
import { CONFIG } from '../config/Config';

export class LineFactory {
  /**
   * Crée une entité ligne (gauche ou droite)
   */
  static create(side: 'left' | 'right'): Entity {
    const entity = new Entity(`${side}Line`);
    
    // === TRANSFORM (requis pour RenderSystem) ===
    // Position neutre car les lignes suivent leurs points start/end
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, 0, 0)
    }));
    
    // === LINE COMPONENT ===
    entity.addComponent(new LineComponent({
      length: CONFIG.lines.length,
      stiffness: CONFIG.lines.springForce.stiffness,
      damping: CONFIG.lines.springForce.damping,
      maxTension: CONFIG.lines.maxTension
    }));
    
    // === GEOMETRY ===
    // Points seront mis à jour dynamiquement par un système
    const geometry = new GeometryComponent();
    geometry.setPoint('start', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('end', new THREE.Vector3(0, 0, 0));
    geometry.addConnection('start', 'end');
    entity.addComponent(geometry);
    
    // === VISUAL ===
    entity.addComponent(new VisualComponent({
      color: side === 'left' ? 0xff0000 : 0x00ff00, // Rouge gauche, vert droite
      opacity: 1.0
    }));
    
    return entity;
  }
}


```

---

## Fichier: `ecs/entities/PilotFactory.ts`

```typescript
/**
 * PilotFactory.ts - Factory pour créer le pilote
 * 
 * Crée un cube solide à l'origine (0, 0, 0) représentant le pilote.
 * Utilise un mesh Three.js pour un rendu simple et visible.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { TransformComponent, MeshComponent, PilotComponent } from '../components';
import { CONFIG } from '../config/Config';

export class PilotFactory {
  /**
   * Crée l'entité pilote (cube solide à l'origine)
   */
  static create(): Entity {
    const entity = new Entity('pilot');
    
    // === DIMENSIONS ===
    // Utilise les dimensions de la configuration
    const width = CONFIG.pilot.width;   // 0.5m - Largeur (épaules)
    const height = CONFIG.pilot.height; // 1.6m - Hauteur (taille humaine)
    const depth = CONFIG.pilot.depth;   // 0.3m - Profondeur
    
    // === TRANSFORM ===
    // Positionné à l'origine avec les pieds au sol
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, height / 2, 0), // Centre du cube à 0.8m du sol
      scale: new THREE.Vector3(1, 1, 1)
    }));
    
    // === MESH ===
    // Cube solide gris foncé représentant le pilote (1.6m de haut)
    const pilotGeometry = new THREE.BoxGeometry(width, height, depth);
    const pilotMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a4a4a, // Gris foncé
      roughness: 0.8,
      metalness: 0.2
    });
    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;
    pilotMesh.receiveShadow = false;
    
    entity.addComponent(new MeshComponent(pilotMesh));
    
    // === PILOT ===
    // Composant pour le retour haptique
    // Note: La masse du pilote (CONFIG.pilot.mass = 75 kg) est disponible
    // pour référence mais n'est pas utilisée ici car le pilote est fixe au sol
    entity.addComponent(new PilotComponent());
    
    return entity;
  }
}

```

---

## Fichier: `ecs/entities/UIFactory.ts`

```typescript
import { Entity } from '../core/Entity';
import { InputComponent, type InputState } from '../components/InputComponent';
import { CONFIG } from '../config/Config';

/**
 * Crée l'entité UI qui contient les composants liés à l'interface.
 */
export class UIFactory {
  /**
   * Crée l'entité UI avec support des valeurs sauvegardées lors du reset
   * 
   * @param savedInputValues - Valeurs optionnelles à restaurer après un reset
   */
  public static create(savedInputValues?: InputState): Entity {
    const uiEntity = new Entity('ui');

    uiEntity.addComponent(
      new InputComponent({
        // === Vent ===
        windSpeed: savedInputValues?.windSpeed ?? CONFIG.wind.speed,
        windDirection: savedInputValues?.windDirection ?? CONFIG.wind.direction,
        windTurbulence: savedInputValues?.windTurbulence ?? CONFIG.wind.turbulence,

        // === Lignes ===
        lineLength: savedInputValues?.lineLength ?? CONFIG.lines.length,
        bridleNez: savedInputValues?.bridleNez ?? CONFIG.bridles.nez,
        bridleInter: savedInputValues?.bridleInter ?? CONFIG.bridles.inter,
        bridleCentre: savedInputValues?.bridleCentre ?? CONFIG.bridles.centre,
        
        // === Mode de contrainte ===
        constraintMode: savedInputValues?.constraintMode ?? CONFIG.modes.constraint,

        // === Mode aérodynamique ===
        aeroMode: savedInputValues?.aeroMode ?? CONFIG.modes.aero,

        // === Physique ===
        linearDamping: savedInputValues?.linearDamping ?? CONFIG.physics.linearDamping,
        angularDamping: savedInputValues?.angularDamping ?? CONFIG.physics.angularDamping,
        meshSubdivisionLevel: savedInputValues?.meshSubdivisionLevel ?? CONFIG.render.meshSubdivision,

        // === Aérodynamique ===
        liftScale: savedInputValues?.liftScale ?? CONFIG.aero.liftScale,
        dragScale: savedInputValues?.dragScale ?? CONFIG.aero.dragScale,
        forceSmoothing: savedInputValues?.forceSmoothing ?? CONFIG.aero.forceSmoothing,

        // === État ===
        isPaused: savedInputValues?.isPaused ?? !CONFIG.simulation.autoStart,
        debugMode: savedInputValues?.debugMode ?? CONFIG.debug.enabled,
      })
    );

    return uiEntity;
  }
}

```

---

## Fichier: `ecs/entities/index.ts`

```typescript
/**
 * index.ts - Exports des factories
 */

export { KiteFactory } from './KiteFactory';
export { LineFactory } from './LineFactory';
export { ControlBarFactory } from './ControlBarFactory';
export { PilotFactory } from './PilotFactory';
export { UIFactory } from './UIFactory';
export { BridleFactory } from './BridleFactory';

```

---

## Fichier: `ecs/main.ts`

```typescript
/**
 * main.ts - Point d'entrée de la simulation ECS pure
 */

import { SimulationApp } from './SimulationApp';
import { Logger } from './utils/Logging';

// Créer le canvas
const canvas = document.createElement('canvas');
canvas.id = 'simulation-canvas';
document.body.appendChild(canvas);

// Initialiser le logger
const logger = Logger.getInstance();

// Initialiser et démarrer la simulation
const app = new SimulationApp(canvas);

app.initialize()
  .then(() => {
    logger.info('✅ Simulation initialized', 'Main');
    app.start();
    logger.info('▶️  Simulation started', 'Main');
  })
  .catch((error: Error) => {
    logger.error('❌ Failed to initialize simulation', 'Main', error);
  });

// Exposer l'app globalement pour debug dans la console
interface WindowWithSimulation extends Window {
  simulation?: SimulationApp;
  app?: SimulationApp;
}

const windowWithSim = window as WindowWithSimulation;
windowWithSim.simulation = app;
windowWithSim.app = app; // Alias plus court

// Log instructions de debug
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🔍 DEBUG CONSOLE - Commandes disponibles                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  🎯 Debug Aérodynamique Détaillé:                            ║
║  ─────────────────────────────────────────                   ║
║  window.app.setAeroDebug(true)       // Toutes surfaces      ║
║  window.app.setAeroDebug(true, 0)    // Surface 0 uniquement ║
║  window.app.setAeroDebug(false)      // Désactiver           ║
║                                                               ║
║  📊 Affiche pour chaque surface:                             ║
║     • Positions (CP, bras de levier)                         ║
║     • Orientations (normales, directions de forces)          ║
║     • Calculs intermédiaires (Cl, Cd, α, q)                  ║
║     • Forces finales (portance, traînée, gravité)            ║
║                                                               ║
║  ⚠️  PROBLÈME ACTUEL:                                        ║
║     Les lignes sont SLACK (tension=0N) car le kite est       ║
║     trop proche (14.7m < 15m). Activer le debug pour voir    ║
║     si les forces aéro poussent le kite correctement.        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

```

---

## Fichier: `ecs/systems/AeroSystemNASA.ts`

```typescript
/**
 * AeroSystemNASA.ts - Calcul des forces aérodynamiques selon les formules NASA
 *
 * Implémentation basée sur le "Beginner's Guide to Kites" de la NASA Glenn Research Center
 * https://www.grc.nasa.gov/www/k-12/airplane/kitelift.html
 * https://www.grc.nasa.gov/www/k-12/airplane/kitedrag.html
 *
 * FORMULES NASA POUR PLAQUES PLANES :
 * - Portance: L = Cl × A × ρ × 0.5 × V²
 * - Cl pour plaque plane: Clo = 2 × π × α (α en radians)
 * - Correction aspect ratio: Cl = Clo / (1 + Clo / (π × AR))
 * - Traînée: D = Cd × A × ρ × 0.5 × V²
 * - Cd pour plaque plane: Cdo = 1.28 × sin(α)
 * - Traînée totale: Cd = Cdo + Cl² / (0.7 × π × AR)
 *
 * Priorité 30 (après vent, avant contraintes).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import type { Entity } from '../core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { KiteComponent } from '../components/KiteComponent';
import { AerodynamicsComponent, AeroSurfaceDescriptor } from '../components/AerodynamicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { InputComponent } from '../components/InputComponent';

import { WindState } from './WindSystem';
import { PhysicsConstants, DebugConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  centerOfPressure: THREE.Vector3;  // Centre de pression (point d'application des forces aéro)
  normal: THREE.Vector3;  // Normale de la surface triangulaire
}

/**
 * Constantes NASA pour calculs aérodynamiques
 */
namespace NASAAeroConfig {
  /** Densité de l'air standard au niveau de la mer (kg/m³) */
  export const AIR_DENSITY_SEA_LEVEL = 1.229;

  /** Coefficient de pression dynamique = 0.5 */
  export const DYNAMIC_PRESSURE_COEFF = 0.5;

  /** Facteur d'efficacité pour ailes rectangulaires (NASA: 0.7) */
  export const RECTANGULAR_WING_EFFICIENCY = 0.7;

  /** Coefficient pour plaque plane perpendiculaire (NASA: 1.28) */
  export const FLAT_PLATE_DRAG_COEFF = 1.28;

  /** Constante π */
  export const PI = Math.PI;

  // === STALL MODELING ===
  /** Angle de décrochage (stall) en radians - ~15° pour plaque plane */
  export const STALL_ANGLE_RAD = (15 * Math.PI) / 180;

  /** Post-stall CL max (coefficient de portance au stall) */
  export const CL_MAX = 1.2;

  /** Post-stall CD (traînée augmentée après stall) */
  export const CD_STALL = 1.8;

  // === CENTER OF PRESSURE ===
  /** Position du centre de pression par rapport au centre géométrique (% chord) */
  export const CP_POSITION_RATIO = 0.25;

  // === SAFETY LIMITS ===
  /** Force maximale par surface (N) - Limite de sécurité pour éviter instabilité */
  export const MAX_FORCE_PER_SURFACE = 500;

  /** Couple maximal par surface (N·m) - Limite de sécurité */
  export const MAX_TORQUE_PER_SURFACE = 200;

  /** Vitesse apparente maximale considérée (m/s) - Cap réaliste pour kite */
  export const MAX_APPARENT_WIND_SPEED = 30;
}

export class AeroSystemNASA extends System {
  private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);

  // Debug: activer pour logger les informations sur chaque face
  private debugFaces = false;
  private debugFrameCounter = 0;
  private debugSurfaceIndex = 0; // Surface à déboguer (-1 = toutes)

  // Lissage temporel des forces (stabilité numérique)
  private previousForces: Map<string, THREE.Vector3> = new Map();
  private previousTorques: Map<string, THREE.Vector3> = new Map();
  private readonly FORCE_SMOOTHING_FACTOR = 0.3; // 30% de lissage (0 = pas de lissage, 1 = lissage max)

  constructor() {
    const PRIORITY = 30;
    super('AeroSystemNASA', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    const windCache = context.windCache as Map<string, WindState> | undefined;

    if (!windCache) return;

    // Récupérer les paramètres UI (liftScale, dragScale)
    const inputEntities = entityManager.query(['Input']);
    const inputComp = inputEntities.length > 0
      ? inputEntities[0].getComponent<InputComponent>('Input')
      : null;

    const liftScale = inputComp?.liftScale ?? 1.0;
    const dragScale = inputComp?.dragScale ?? 1.0;

    // Pour chaque kite
    const kites = entityManager.query(['kite', 'transform', 'physics', 'aerodynamics', 'geometry']);

    kites.forEach(kite => {
      const transform = kite.getComponent<TransformComponent>('transform')!;
      const physics = kite.getComponent<PhysicsComponent>('physics')!;
      const kiteComp = kite.getComponent<KiteComponent>('kite')!;
      const aero = kite.getComponent<AerodynamicsComponent>('aerodynamics')!;
      const geometry = kite.getComponent<GeometryComponent>('geometry')!;

      // Réinitialiser les forces
      physics.faceForces = [];

      const wind = windCache.get(kite.id);
      if (!wind) {
        console.warn('⚠️ [AeroSystemNASA] Pas de vent dans le cache');
        return;
      }

      const surfaceSamples = this.getSurfaceSamples(aero, geometry, kite);
      if (surfaceSamples.length === 0) {
        console.warn('⚠️ [AeroSystemNASA] Aucune surface détectée');
        return;
      }
      
      // 🔍 DEBUG: Log le vent ambiant
      if (this.debugFaces && this.debugFrameCounter % 60 === 0) {
        console.log(`💨 [AeroSystemNASA] Vent ambiant: (${wind.ambient.x.toFixed(2)}, ${wind.ambient.y.toFixed(2)}, ${wind.ambient.z.toFixed(2)}) | vitesse=${wind.ambient.length().toFixed(2)} m/s`);
      }

      // ========================================================================
      // CALCULS NASA - Application des formules officielles pour cerfs-volants
      // ========================================================================
      // Référence: NASA Glenn Research Center - Beginner's Guide to Kites
      // Les cerfs-volants sont traités comme des "thin flat plates" avec
      // des formules spécifiques validées expérimentalement.
      surfaceSamples.forEach((sample, index) => {
        // === GRAVITÉ - TOUJOURS APPLIQUÉE (indépendante du vent) ===
        const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);
        this.addForce(physics, gravityPerFace);

        // Calcul du vent apparent local
        const centerOfMass = transform.position; // CoM ≈ centre géométrique pour kite delta
        const leverArm = sample.centerOfPressure.clone().sub(centerOfMass);
        
        // Vitesse au point d'application (CP) due à la rotation du kite
        // v_rotation = ω × r
        const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);

        // Vitesse totale du point d'application dans l'espace monde
        // v_total = v_CoM + v_rotation
        const pointVelocity = physics.velocity.clone().add(rotationVelocity);

        // Vent apparent = vent ambiant - vitesse du point
        const localApparentWind = wind.ambient.clone().sub(pointVelocity);
        const localWindSpeed = localApparentWind.length();

        // Si pas de vent apparent, seules les forces gravitationnelles s'appliquent
        if (localWindSpeed < 0.01) {
          // Stocker pour debug même sans vent
          physics.faceForces.push({
            name: sample.descriptor.name,
            centroid: sample.centerOfPressure.clone(),
            lift: new THREE.Vector3(),
            drag: new THREE.Vector3(),
            gravity: gravityPerFace.clone(),
            apparentWind: localApparentWind.clone(),
            normal: sample.normal.clone()
          });
          return; // Pas de forces aérodynamiques
        }

        const localWindDir = localApparentWind.clone().normalize();

        // 3. Calcul de l'angle d'attaque selon NASA
        //
        // ✅ DÉFINITION NASA DE L'ANGLE D'ATTAQUE (pour plaques planes) ✅
        // Source: NASA Glenn Research Center - "Beginner's Guide to Aerodynamics"
        // https://www.grc.nasa.gov/www/k-12/airplane/incline.html
        //
        // Pour une plaque plane inclinée:
        // - α = angle entre la NORMALE et la direction du vent
        // - α = 0° : normale alignée avec le vent (plaque perpendiculaire, traînée max)
        // - α = 90° : normale perpendiculaire au vent (plaque parallèle, portance nulle)
        //
        // Les formules NASA CL = 2π×α utilisent cet angle directement
        let surfaceNormal = sample.normal.clone();
        let dotNW = surfaceNormal.dot(localWindDir);

        // ✅ AUTO-CORRECTION DE L'ORIENTATION DE LA NORMALE ✅
        // Si dotNW < 0, la normale pointe "à l'envers" par rapport au vent
        // (ordre des vertices défini dans la géométrie)
        // Solution: inverser la normale pour qu'elle pointe toujours vers le vent
        // Ainsi la portance sera calculée du bon côté automatiquement
        let normalFlipped = false;
        if (dotNW < 0) {
          surfaceNormal.negate();
          dotNW = -dotNW; // Recalculer avec normale inversée
          normalFlipped = true;
          
          if (this.debugFaces && (this.debugSurfaceIndex === -1 || this.debugSurfaceIndex === index)) {
            console.log(`[AeroSystemNASA] ${sample.descriptor.name}: Normale inversée (vent de l'autre côté)`);
          }
        }

        // Angle d'attaque (toujours positif maintenant car dotNW >= 0)
        const alphaRad = Math.acos(Math.max(0.0, Math.min(1.0, dotNW)));
        const alphaDeg = alphaRad * 180 / Math.PI;

        const aspectRatio = Math.max(kiteComp.aspectRatio, 0.1);

        // === FORMULES NASA POUR PLAQUES PLANES ===
        const Clo = 2.0 * NASAAeroConfig.PI * alphaRad;
        const CL = Clo / (1.0 + Clo / (NASAAeroConfig.PI * aspectRatio));
        const Cdo = NASAAeroConfig.FLAT_PLATE_DRAG_COEFF * Math.sin(alphaRad);
        const inducedDrag = (CL * CL) / (NASAAeroConfig.RECTANGULAR_WING_EFFICIENCY * NASAAeroConfig.PI * aspectRatio);
        const CD = Cdo + inducedDrag;

        // 5. Pression dynamique selon NASA
        const airDensity = aero.airDensity || NASAAeroConfig.AIR_DENSITY_SEA_LEVEL;
        const q = NASAAeroConfig.DYNAMIC_PRESSURE_COEFF * airDensity * localWindSpeed * localWindSpeed;

        // 6. Directions des forces NASA
        const liftDir = this.calculateNASALiftDirection(surfaceNormal, localWindDir);
        const dragDir = localWindDir.clone();

        // 7. Forces selon équations NASA
        let panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
        let panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area * dragScale);

        // 🛡️ SAFETY CAP: Limiter les forces par surface pour éviter instabilité
        const liftMag = panelLift.length();
        const dragMag = panelDrag.length();

        if (liftMag > NASAAeroConfig.MAX_FORCE_PER_SURFACE) {
          console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Portance excessive ${liftMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`);
          panelLift.normalize().multiplyScalar(NASAAeroConfig.MAX_FORCE_PER_SURFACE);
        }

        if (dragMag > NASAAeroConfig.MAX_FORCE_PER_SURFACE) {
          console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Traînée excessive ${dragMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`);
          panelDrag.normalize().multiplyScalar(NASAAeroConfig.MAX_FORCE_PER_SURFACE);
        }

        // 🔍 DEBUG DÉTAILLÉ - Afficher tous les calculs intermédiaires
        if (this.debugFaces && (this.debugSurfaceIndex === -1 || this.debugSurfaceIndex === index) && this.debugFrameCounter % 60 === 0) {
          this.logDetailedAeroCalculations(
            index, sample, alphaDeg, localWindSpeed, leverArm, 
            Clo, CL, Cdo, CD, q, liftDir, dragDir,
            panelLift, panelDrag, gravityPerFace
          );
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 9. APPLICATION DES FORCES AU CENTRE DE PRESSION (CP)
        // ═══════════════════════════════════════════════════════════════════════
        //
        // PHYSIQUE DES CORPS RIGIDES:
        // ──────────────────────────────
        // Une force F appliquée à un point P (CP) est équivalente à:
        //   1. Force au CoM: F_CoM = F
        //   2. Torque: τ = r × F, où r = vecteur (CoM → CP)
        //
        // ARCHITECTURE ECS:
        // ─────────────────
        // • Forces stockées dans physics.forces (accumulateur)
        // • PhysicsSystem les intègre en vélocité puis position
        // • Torques stockés dans physics.torques (accumulateur)
        // • PhysicsSystem les intègre en vélocité angulaire puis quaternion
        //
        // CE QUI EST FAIT ICI:
        // ────────────────────
        // ✅ leverArm = CP - CoM (calculé ligne 157)
        // ✅ Forces ajoutées à l'accumulateur (translation)
        // ✅ Torque généré et ajouté (rotation)
        // ✅ RÉSULTAT: Force appliquée AU CENTRE DE PRESSION ✅
        //
        const panelForce = panelLift.clone().add(panelDrag).add(gravityPerFace);

        // ═══════════════════════════════════════════════════════════════════════
        // LISSAGE TEMPOREL DES FORCES (Temporal Smoothing)
        // ═══════════════════════════════════════════════════════════════════════
        // Pour éviter les explosions numériques, on lisse les forces entre frames :
        // F_smooth = (1 - α) × F_previous + α × F_current
        // où α = FORCE_SMOOTHING_FACTOR (0.3 = 30% nouveau, 70% ancien)
        //
        const surfaceKey = `${kite.id}_${sample.descriptor.name}`;
        const smoothedForce = this.smoothForce(surfaceKey, panelForce);

        // Décomposer en lift/drag/gravity pour application
        const forceRatio = smoothedForce.length() / (panelForce.length() || 1);
        const smoothedLift = panelLift.clone().multiplyScalar(forceRatio);
        const smoothedDrag = panelDrag.clone().multiplyScalar(forceRatio);
        const smoothedGravity = gravityPerFace.clone(); // Gravité ne change pas

        // Ajouter forces lissées (translation du CoM)
        this.addForce(physics, smoothedLift);
        this.addForce(physics, smoothedDrag);
        this.addForce(physics, smoothedGravity);

        // Générer torque: τ = (CP - CoM) × Force
        // C'est ce qui fait que la force appliquée au CP crée une rotation
        let panelTorque = leverArm.clone().cross(smoothedForce);

        // Lisser le torque également
        panelTorque = this.smoothTorque(surfaceKey, panelTorque);

        // 🛡️ SAFETY CAP: Limiter le couple par surface
        const torqueMag = panelTorque.length();
        if (torqueMag > NASAAeroConfig.MAX_TORQUE_PER_SURFACE) {
          console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Couple excessif ${torqueMag.toFixed(1)}N·m → plafonné à ${NASAAeroConfig.MAX_TORQUE_PER_SURFACE}N·m`);
          panelTorque.normalize().multiplyScalar(NASAAeroConfig.MAX_TORQUE_PER_SURFACE);
        }

        this.addTorque(physics, panelTorque);

        // 10. Stockage pour visualisation debug
        // Note: 'centroid' stocke en réalité le centre de pression (CP), pas le centroïde géométrique
        // C'est le point d'application des forces aérodynamiques (portance + traînée)
        physics.faceForces.push({
          name: sample.descriptor.name,
          centroid: sample.centerOfPressure.clone(), // ⚠️ Nom hérité: contient CP, pas centroïde
          lift: panelLift.clone(),
          drag: panelDrag.clone(),
          gravity: gravityPerFace.clone(),
          apparentWind: localApparentWind.clone(),
          normal: surfaceNormal.clone() // ✅ Normale de surface (auto-corrigée si nécessaire)
        });
      });
    });

    // Incrémenter le compteur debug
    if (this.debugFaces) {
      this.debugFrameCounter++;
    }
  }

  private getSurfaceSamples(aero: AerodynamicsComponent, geometry: GeometryComponent, entity: Entity): SurfaceSample[] {
    const descriptors = this.getSurfaceDescriptors(aero, geometry);
    const samples: SurfaceSample[] = [];

    descriptors.forEach(descriptor => {
      const worldPoints = descriptor.points.map(name => geometry.getPointWorld(name, entity));
      if (worldPoints.some(point => !point)) {
        return;
      }

      const [p1, p2, p3] = worldPoints as THREE.Vector3[];
      const area = this.computeTriangleArea(p1, p2, p3);
      if (area <= 0) {
        return;
      }

      const centroid = this.computeTriangleCentroid(p1, p2, p3);
      const normal = this.computeTriangleNormal(p1, p2, p3);
      
      // === Calcul du centre de pression (CP) - Version simplifiée ===
      // Pour une plaque plane triangulaire, nous utilisons le CENTROÏDE comme point d'application.
      //
      // Raisons:
      // 1. Le CP réel varie avec l'angle d'attaque (25%-50% selon α)
      // 2. Pour un delta, le centroïde est une excellente approximation moyenne
      // 3. Simplifie le calcul sans perte significative de précision physique
      // 4. Évite les instabilités numériques du CP mobile
      //
      // Source: Pour plaques planes à angles modérés, CP ≈ centroïde géométrique
      const centerOfPressure = centroid.clone();
      
      samples.push({ descriptor, area, centroid, centerOfPressure, normal });
    });

    return samples;
  }

  private getSurfaceDescriptors(aero: AerodynamicsComponent, geometry: GeometryComponent): AeroSurfaceDescriptor[] {
    if (aero.surfaces.length > 0) {
      return aero.surfaces;
    }

    return geometry.surfaces
      .filter(surface => surface.points.length >= 3)
      .map((surface, index) => ({
        name: surface.points.join('-') || `surface_${index}`,
        points: [surface.points[0], surface.points[1], surface.points[2]] as [string, string, string]
      }));
  }

  private computeTriangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
    return MathUtils.computeTriangleArea(a, b, c);
  }

  private computeTriangleCentroid(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return MathUtils.computeTriangleCentroid(a, b, c);
  }
  
  /**
   * Calcule la normale d'un triangle selon la règle de la main droite
   * IMPORTANT: L'ordre des vertices détermine l'orientation de la normale
   */
  private computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return MathUtils.computeTriangleNormal(a, b, c);
  }
  
  /**
   * Calcule la direction de la portance selon NASA
   *
   * ✅ CORRECTION NASA (Source: kitelift.html lignes 106-107)
   * NASA: "lift direction is perpendicular to the wind"
   *
   * La force aérodynamique sur une plaque plane est décomposée en:
   * - Portance (lift) : composante PERPENDICULAIRE au vent
   * - Traînée (drag) : composante PARALLÈLE au vent
   *
   * Méthode: Double produit vectoriel AVEC correction de signe
   * liftDir = (normale × vent) × vent
   * Si liftDir · normale < 0, inverser liftDir (doit pointer du même côté que normale)
   *
   * @param surfaceNormal - Normale de la surface (unitaire, après auto-correction)
   * @param windDir - Direction du vent apparent (unitaire)
   * @returns Direction de la portance (unitaire, perpendiculaire au vent, même côté que normale)
   */
  private calculateNASALiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // ✅ CORRECTION CRITIQUE : Double produit vectoriel
    // liftDir = (normale × vent) × vent
    // Cela garantit que la portance est perpendiculaire au vent
    const crossProduct = new THREE.Vector3().crossVectors(surfaceNormal, windDir);
    let liftDir = new THREE.Vector3().crossVectors(crossProduct, windDir);

    // Protection contre les vecteurs nuls (si normale parallèle au vent)
    if (liftDir.lengthSq() < 0.0001) {
      // Si la normale est parallèle au vent, pas de portance
      // Retourner direction arbitraire vers le haut (Cl sera ~0 de toute façon)
      return new THREE.Vector3(0, 1, 0);
    }

    liftDir.normalize();

    // ✅ CORRECTION DE SIGNE : La portance doit pointer du MÊME CÔTÉ que la normale
    // Si liftDir pointe du côté opposé (dot < 0), l'inverser
    const dotProduct = liftDir.dot(surfaceNormal);
    if (dotProduct < 0) {
      liftDir.negate();
    }

    return liftDir;
  }
  
  /**
   * Ajoute une force au PhysicsComponent avec protection NaN
   */
  private addForce(physics: PhysicsComponent, force: THREE.Vector3): void {
    if (isNaN(force.x) || isNaN(force.y) || isNaN(force.z)) {
      console.error('[AeroSystemNASA] Attempted to add NaN force:', force);
      return;
    }
    physics.forces.add(force);
  }
  
  /**
   * Ajoute un couple au PhysicsComponent avec protection NaN
   */
  private addTorque(physics: PhysicsComponent, torque: THREE.Vector3): void {
    if (isNaN(torque.x) || isNaN(torque.y) || isNaN(torque.z)) {
      console.error('[AeroSystemNASA] Attempted to add NaN torque:', torque);
      return;
    }
    physics.torques.add(torque);
  }

  /**
   * Log détaillé de tous les calculs aérodynamiques pour une surface
   * Utilisé pour déboguer les positions et orientations des vecteurs de force
   */
  private logDetailedAeroCalculations(
    index: number,
    sample: SurfaceSample,
    alphaDeg: number,
    windSpeed: number,
    leverArm: THREE.Vector3,
    Clo: number,
    CL: number,
    Cdo: number,
    CD: number,
    q: number,
    liftDir: THREE.Vector3,
    dragDir: THREE.Vector3,
    panelLift: THREE.Vector3,
    panelDrag: THREE.Vector3,
    gravityPerFace: THREE.Vector3
  ): void {
    console.group(`🎯 [AeroSystemNASA] Surface ${index}: ${sample.descriptor.name}`);

    // 1. Géométrie
    console.log(`📐 GÉOMÉTRIE:`);
    console.log(`   - Surface: ${sample.descriptor.name}`);
    console.log(`   - Centre de pression (CP): (${sample.centerOfPressure.x.toFixed(3)}, ${sample.centerOfPressure.y.toFixed(3)}, ${sample.centerOfPressure.z.toFixed(3)})`);
    console.log(`   - Centroïde géométrique: (${sample.centroid.x.toFixed(3)}, ${sample.centroid.y.toFixed(3)}, ${sample.centroid.z.toFixed(3)})`);
    console.log(`   - Bras de levier (CP - CoM): (${leverArm.x.toFixed(3)}, ${leverArm.y.toFixed(3)}, ${leverArm.z.toFixed(3)}) [mag=${leverArm.length().toFixed(3)} m]`);
    console.log(`   - Aire: ${sample.area.toFixed(4)} m²`);

    // 2. Vent et angle d'attaque
    console.log(`💨 VENT:`);
    console.log(`   - Vitesse apparente: ${windSpeed.toFixed(2)} m/s`);
    console.log(`   - Direction vent: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)})`);
    console.log(`   - Normale surface: (${sample.normal.x.toFixed(3)}, ${sample.normal.y.toFixed(3)}, ${sample.normal.z.toFixed(3)})`);
    console.log(`   - Angle d'attaque (α): ${alphaDeg.toFixed(1)}°`);

    // 3. Coefficients aérodynamiques
    console.log(`📊 COEFFICIENTS AÉRO:`);
    console.log(`   - CL théorique: ${Clo.toFixed(4)} → CL corrigé: ${CL.toFixed(4)}`);
    console.log(`   - CD parasite: ${Cdo.toFixed(4)}`);
    console.log(`   - CD induit: ${(CD - Cdo).toFixed(4)}`);
    console.log(`   - CD total: ${CD.toFixed(4)}`);
    console.log(`   - Pression dynamique (q): ${q.toFixed(2)} Pa`);

    // 4. Directions des forces
    console.log(`🎲 DIRECTIONS:`);
    console.log(`   - Direction portance: (${liftDir.x.toFixed(3)}, ${liftDir.y.toFixed(3)}, ${liftDir.z.toFixed(3)}) [perpendiculaire au vent]`);
    console.log(`   - Direction traînée: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)}) [parallèle au vent]`);

    // 5. Forces finales
    console.log(`💪 FORCES FINALES:`);
    console.log(`   - Portance: (${panelLift.x.toFixed(3)}, ${panelLift.y.toFixed(3)}, ${panelLift.z.toFixed(3)}) [mag=${panelLift.length().toFixed(3)} N]`);
    console.log(`   - Traînée: (${panelDrag.x.toFixed(3)}, ${panelDrag.y.toFixed(3)}, ${panelDrag.z.toFixed(3)}) [mag=${panelDrag.length().toFixed(3)} N]`);
    console.log(`   - Gravité: (${gravityPerFace.x.toFixed(3)}, ${gravityPerFace.y.toFixed(3)}, ${gravityPerFace.z.toFixed(3)}) [mag=${gravityPerFace.length().toFixed(3)} N]`);

    const totalForce = panelLift.clone().add(panelDrag).add(gravityPerFace);
    console.log(`   - ∑ Force totale: (${totalForce.x.toFixed(3)}, ${totalForce.y.toFixed(3)}, ${totalForce.z.toFixed(3)}) [mag=${totalForce.length().toFixed(3)} N]`);

    // 6. Couple généré
    const torque = leverArm.clone().cross(totalForce);
    console.log(`🔄 COUPLE (TORQUE):`);
    console.log(`   - τ = r × F: (${torque.x.toFixed(3)}, ${torque.y.toFixed(3)}, ${torque.z.toFixed(3)}) [mag=${torque.length().toFixed(3)} N·m]`);
    console.log(`   - Bras de levier utilisé: ${leverArm.length().toFixed(3)} m`);

    console.groupEnd();
  }

  /**
   * Active/désactive le debug des faces avec possibilité de cibler une surface
   * @param enabled Activer le debug
   * @param surfaceIndex Index de la surface à déboguer (-1 pour toutes)
   */
  public setDebugFaces(enabled: boolean, surfaceIndex: number = -1): void {
    this.debugFaces = enabled;
    this.debugSurfaceIndex = surfaceIndex;
    if (enabled) {
      console.log(`🔍 [AeroSystemNASA] Debug activé${surfaceIndex >= 0 ? ` pour surface ${surfaceIndex}` : ` pour TOUTES les surfaces`}`);
    }
  }

  /**
   * Lisse une force entre le frame précédent et le frame actuel
   * Utilise un filtre passe-bas exponentiel (EMA - Exponential Moving Average)
   * @deprecated Utiliser MathUtils.exponentialSmoothing() à la place
   *
   * @param key Identifiant unique de la surface
   * @param currentForce Force calculée ce frame
   * @returns Force lissée
   */
  private smoothForce(key: string, currentForce: THREE.Vector3): THREE.Vector3 {
    const previousForce = this.previousForces.get(key);

    // Utiliser fonction centralisée
    const smoothed = MathUtils.exponentialSmoothing(
      currentForce,
      previousForce || null,
      this.FORCE_SMOOTHING_FACTOR
    );

    // Sauvegarder pour le prochain frame
    this.previousForces.set(key, smoothed.clone());
    return smoothed;
  }

  /**
   * Lisse un torque entre le frame précédent et le frame actuel
   * Même algorithme que smoothForce
   * @deprecated Utiliser MathUtils.exponentialSmoothing() à la place
   *
   * @param key Identifiant unique de la surface
   * @param currentTorque Torque calculé ce frame
   * @returns Torque lissé
   */
  private smoothTorque(key: string, currentTorque: THREE.Vector3): THREE.Vector3 {
    const previousTorque = this.previousTorques.get(key);

    // Utiliser fonction centralisée
    const smoothed = MathUtils.exponentialSmoothing(
      currentTorque,
      previousTorque || null,
      this.FORCE_SMOOTHING_FACTOR
    );

    // Sauvegarder pour le prochain frame
    this.previousTorques.set(key, smoothed.clone());
    return smoothed;
  }
}


```

---

## Fichier: `ecs/systems/BridleConstraintSystem.ts`

```typescript
/**
 * BridleConstraintSystem.ts - Applique les contraintes de bride
 *
 * Les brides forment une pyramide:
 * - Base: 3 points anatomiques du kite (NEZ, INTER, CENTRE)
 * - Sommet: point de contrôle (CTRL_GAUCHE ou CTRL_DROIT)
 * - Arêtes: les 3 brides (nez, inter, centre) avec leurs longueurs
 *
 * En modifiant les longueurs des brides, on déplace le sommet de la pyramide.
 * Cela affecte l'angle d'attaque et la portance du kite.
 *
 * Priorité 10 (très haute, pour synchroniser les positions avant les autres systèmes)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { GeometryComponent } from '../components/GeometryComponent';
import { BridleComponent, type BridleLengths } from '../components/BridleComponent';
import { Logger } from '../utils/Logging';

const PRIORITY = 10; // Très haute priorité, avant ConstraintSystem (40)
const MAX_ITERATIONS = 20; // Nombre max d'itérations pour la trilatération
const CONVERGENCE_EPSILON = 0.0001; // 0.1mm - seuil de convergence
const logger = Logger.getInstance();

/**
 * Positionne les points de contrôle en fonction des longueurs des brides.
 * 
 * Utilise une trilatération 3D pour résoudre la pyramide formée par:
 * - 3 points de base (NEZ, INTER, CENTRE)
 * - 3 distances (longueurs des brides)
 * - 1 point sommet (CTRL) à calculer
 * 
 * IMPORTANT: Ce système ne s'exécute QUE quand les longueurs des brides changent
 * (via les sliders UI). Entre les changements, la physique des lignes contrôle
 * les positions CTRL normalement.
 */
export class BridleConstraintSystem extends System {
  private lastLengths: BridleLengths = { nez: 0, inter: 0, centre: 0 };
  private initialized = false;

  constructor() {
    super('BridleConstraintSystem', PRIORITY);
  }

  /**
   * Réinitialise le système lors d'un reset de simulation
   */
  initialize(_entityManager: EntityManager): void {
    this.initialized = false;
    this.lastLengths = { nez: 0, inter: 0, centre: 0 };
    logger.debug('🔧 BridleConstraintSystem reset - initialized flag cleared', 'BridleConstraintSystem');
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');

    if (!geometry || !bridle) return;

    // ✨ INITIALISATION: Au premier appel, forcer le calcul des positions CTRL
    if (!this.initialized) {
      this.initialized = true;
      this.lastLengths = {
        nez: bridle.lengths.nez,
        inter: bridle.lengths.inter,
        centre: bridle.lengths.centre
      };
      logger.debug(`🔧 Initialisation des positions CTRL via trilatération`, 'BridleConstraintSystem');
      this.updateControlPointPositions(geometry, bridle);
      return;
    }

    // Vérifier si les longueurs ont changé
    const lengthsChanged = 
      bridle.lengths.nez !== this.lastLengths.nez ||
      bridle.lengths.inter !== this.lastLengths.inter ||
      bridle.lengths.centre !== this.lastLengths.centre;

    if (!lengthsChanged) {
      return; // Pas de changement, laisser la physique gérer les positions
    }

    // Sauvegarder les nouvelles longueurs
    this.lastLengths = {
      nez: bridle.lengths.nez,
      inter: bridle.lengths.inter,
      centre: bridle.lengths.centre
    };

    logger.debug(`🔧 Longueurs changées: nez=${bridle.lengths.nez}m, inter=${bridle.lengths.inter}m, centre=${bridle.lengths.centre}m`, 'BridleConstraintSystem');

    // Recalculer les positions des CTRL basées sur les nouvelles longueurs
    this.updateControlPointPositions(geometry, bridle);
  }

  /**
   * Met à jour les positions des points de contrôle basées sur les longueurs des brides
   */
  private updateControlPointPositions(
    geometry: GeometryComponent,
    bridle: BridleComponent
  ): void {
    // Points anatomiques (fixes)
    const nez = geometry.getPoint('NEZ');
    const interGauche = geometry.getPoint('INTER_GAUCHE');
    const interDroit = geometry.getPoint('INTER_DROIT');
    const centre = geometry.getPoint('CENTRE');

    if (!nez || !interGauche || !interDroit || !centre) {
      return;
    }

    // Longueurs des brides (mètres)
    const lengths = bridle.lengths;

    // === Recalculer CTRL_GAUCHE ===
    // Pyramide: NEZ-INTER_GAUCHE-CENTRE-CTRL_GAUCHE
    // Distances: nez, inter, centre
    const ctrlGauche = this.solveTrilateration(
      nez,
      interGauche,
      centre,
      lengths.nez,
      lengths.inter,
      lengths.centre
    );

    if (ctrlGauche) {
      geometry.setPoint('CTRL_GAUCHE', ctrlGauche);
    }

    // === Recalculer CTRL_DROIT ===
    // Pyramide: NEZ-INTER_DROIT-CENTRE-CTRL_DROIT
    // Distances: nez, inter, centre
    const ctrlDroit = this.solveTrilateration(
      nez,
      interDroit,
      centre,
      lengths.nez,
      lengths.inter,
      lengths.centre
    );

    if (ctrlDroit) {
      geometry.setPoint('CTRL_DROIT', ctrlDroit);
    }
  }

  /**
   * Résout la trilatération 3D pour trouver le sommet d'une pyramide
   * 
   * Étant donné 3 points de base et 3 distances, trouve le point qui est:
   * - À distance d1 de p1
   * - À distance d2 de p2
   * - À distance d3 de p3
   * 
   * @param p1 Premier point (NEZ)
   * @param p2 Deuxième point (INTER)
   * @param p3 Troisième point (CENTRE)
   * @param d1 Distance désirée à p1
   * @param d2 Distance désirée à p2
   * @param d3 Distance désirée à p3
   * @returns Position calculée du point de contrôle
   */
  private solveTrilateration(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    d1: number,
    d2: number,
    d3: number
  ): THREE.Vector3 | null {
    // Approche simplifiée mais correcte : 
    // Utiliser la méthode analytique standard de trilatération 3D
    
    // 1. Placer p1 à l'origine du repère local
    const origin = p1.clone();
    const v12 = new THREE.Vector3().subVectors(p2, p1);
    const v13 = new THREE.Vector3().subVectors(p3, p1);

    // 2. Créer une base orthonormée
    // ex : direction vers p2
    const ex = v12.clone().normalize();
    
    // ey : perpendiculaire à ex, dans le plan contenant p3
    const ey = new THREE.Vector3().subVectors(v13, ex.clone().multiplyScalar(v13.dot(ex)));
    ey.normalize();
    
    // ez : complète la base orthonormée
    const ez = new THREE.Vector3().crossVectors(ex, ey);
    
    // S'assurer que ez pointe vers Z+ (avant)
    if (ez.z < 0) {
      ez.multiplyScalar(-1);
      ey.multiplyScalar(-1); // Aussi inverser ey pour garder une base cohérente
    }

    // 3. Exprimer p2 et p3 dans le repère local
    const p2_local_x = v12.dot(ex);
    const p2_local_y = v12.dot(ey);
    const p2_local_z = v12.dot(ez);
    
    const p3_local_x = v13.dot(ex);
    const p3_local_y = v13.dot(ey);
    const p3_local_z = v13.dot(ez);

    // 4. Trilatération analytique 3D
    // Point P cherché vérifie:
    // P.x² + P.y² + P.z² = d1²  ... (1)
    // (P.x - p2x)² + (P.y - p2y)² + (P.z - p2z)² = d2²  ... (2)
    // (P.x - p3x)² + (P.y - p3y)² + (P.z - p3z)² = d3²  ... (3)
    
    // Développer (2) - (1) pour éliminer les termes au carré:
    // -2*p2x*P.x - 2*p2y*P.y - 2*p2z*P.z + (p2x² + p2y² + p2z²) = d2² - d1²
    // P.x = [d1² - d2² + (p2x² + p2y² + p2z²)] / (2 * p2x)
    
    const a = d1 * d1 - d2 * d2 + p2_local_x * p2_local_x + p2_local_y * p2_local_y + p2_local_z * p2_local_z;
    const px = a / (2 * p2_local_x);
    
    // De même pour y avec (3) - (1):
    const b = d1 * d1 - d3 * d3 + p3_local_x * p3_local_x + p3_local_y * p3_local_y + p3_local_z * p3_local_z;
    const py_numerator = b - px * (2 * p3_local_x);
    const py = p3_local_y !== 0 ? py_numerator / (2 * p3_local_y) : 0;
    
    // Pour z, utiliser (1):
    // px² + py² + pz² = d1²
    const pz_squared = d1 * d1 - px * px - py * py;
    
    if (pz_squared < 0) {
      // Pas de solution - retourner la moyenne
      return new THREE.Vector3()
        .addScaledVector(p1, 1)
        .addScaledVector(p2, 1)
        .addScaledVector(p3, 1)
        .multiplyScalar(1 / 3);
    }
    
    // Prendre z positif pour aller vers l'avant (Z+)
    const pz = Math.sqrt(pz_squared);

    const solution_local = new THREE.Vector3(px, py, pz);

    // === Raffinement itératif (Gauss-Newton) pour améliorer la précision ===
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // Distances actuelles
      const dist1 = solution_local.length();
      const v2 = new THREE.Vector3(p2_local_x - solution_local.x, p2_local_y - solution_local.y, p2_local_z - solution_local.z);
      const dist2 = v2.length();
      const v3 = new THREE.Vector3(p3_local_x - solution_local.x, p3_local_y - solution_local.y, p3_local_z - solution_local.z);
      const dist3 = v3.length();

      // Erreurs
      const err1 = dist1 - d1;
      const err2 = dist2 - d2;
      const err3 = dist3 - d3;

      // Vérifier convergence
      const maxErr = Math.max(Math.abs(err1), Math.abs(err2), Math.abs(err3));
      if (maxErr < CONVERGENCE_EPSILON) {
        break;
      }

      // Directions de correction (gradients)
      const dir1 = dist1 > 0.001 ? solution_local.clone().normalize() : new THREE.Vector3(1, 0, 0);
      const dir2 = dist2 > 0.001 ? v2.clone().normalize() : new THREE.Vector3(1, 0, 0);
      const dir3 = dist3 > 0.001 ? v3.clone().normalize() : new THREE.Vector3(1, 0, 0);

      // Correction
      const alpha = 0.2; // Facteur de convergence
      const correction = new THREE.Vector3();
      correction.addScaledVector(dir1, -err1 * alpha);
      correction.addScaledVector(dir2, -err2 * alpha);
      correction.addScaledVector(dir3, -err3 * alpha);

      solution_local.add(correction);
      
      // Assurer que Z reste positif (en avant)
      if (solution_local.z < 0) {
        solution_local.z = Math.abs(solution_local.z);
      }
    }

    // Convertir du repère local au repère global
    const solution_global = new THREE.Vector3()
      .addScaledVector(ex, solution_local.x)
      .addScaledVector(ey, solution_local.y)
      .addScaledVector(ez, solution_local.z)
      .add(origin);

    return solution_global;
  }
}

```

---

## Fichier: `ecs/systems/BridleRenderSystem.ts`

```typescript
/**
 * BridleRenderSystem.ts - Rend les brides de manière dynamique
 *
 * Crée et met à jour dynamiquement les lignes visuelles des brides
 * basées sur les longueurs des brides et les positions actuelles du kite.
 *
 * Les brides sont des entités distinctes avec GeometryComponent.
 * Leurs positions sont mises à jour à chaque frame en coordonnées MONDE.
 *
 * Priorité 56 (APRÈS LineRenderSystem 55, AVANT GeometryRenderSystem 60)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { GeometryComponent } from '../components/GeometryComponent';
import { BridleComponent } from '../components/BridleComponent';
import { TransformComponent } from '../components/TransformComponent';

const PRIORITY = 56; // APRÈS LineRenderSystem, AVANT GeometryRenderSystem

/**
 * Gère l'affichage dynamique des brides
 * 
 * Les brides relient les points anatomiques du kite aux points de contrôle.
 * Longueurs configurées en bridles.nez, bridles.inter, bridles.centre.
 * 
 * Les positions sont converties de LOCAL en MONDE pour être indépendantes
 * des transformations du kite.
 */
export class BridleRenderSystem extends System {
  constructor() {
    super('BridleRenderSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');
    const transform = kite.getComponent<TransformComponent>('transform');

    if (!geometry || !bridle || !transform) {
      return;
    }

    // Mettre à jour les brides
    this.updateBridles(entityManager, geometry, bridle, transform);
  }

  /**
   * Met à jour les lignes visuelles des brides
   */
  private updateBridles(
    entityManager: EntityManager,
    geometry: GeometryComponent,
    bridle: BridleComponent,
    transform: TransformComponent
  ): void {
    // Définition des 6 brides avec leurs points
    const bridleConnections = [
      { id: 'bridle-ctrl-gauche-nez', from: 'CTRL_GAUCHE', to: 'NEZ' },
      { id: 'bridle-ctrl-gauche-inter', from: 'CTRL_GAUCHE', to: 'INTER_GAUCHE' },
      { id: 'bridle-ctrl-gauche-centre', from: 'CTRL_GAUCHE', to: 'CENTRE' },
      { id: 'bridle-ctrl-droit-nez', from: 'CTRL_DROIT', to: 'NEZ' },
      { id: 'bridle-ctrl-droit-inter', from: 'CTRL_DROIT', to: 'INTER_DROIT' },
      { id: 'bridle-ctrl-droit-centre', from: 'CTRL_DROIT', to: 'CENTRE' }
    ];

    // Matrice de transformation LOCAL → MONDE
    const transformMatrix = new THREE.Matrix4();
    transformMatrix.compose(transform.position, transform.quaternion, transform.scale);

    bridleConnections.forEach(conn => {
      const bridleEntity = entityManager.getEntity(conn.id);
      if (!bridleEntity) return;

      const bridleGeometry = bridleEntity.getComponent<GeometryComponent>('geometry');
      if (!bridleGeometry) return;

      const p1Local = geometry.getPoint(conn.from);
      const p2Local = geometry.getPoint(conn.to);

      if (p1Local && p2Local) {
        // Convertir les positions locales en positions MONDE
        const p1World = p1Local.clone().applyMatrix4(transformMatrix);
        const p2World = p2Local.clone().applyMatrix4(transformMatrix);

        // Mettre à jour les points de la bridle
        bridleGeometry.setPoint('start', p1World);
        bridleGeometry.setPoint('end', p2World);
      }
    });
  }
}

```

---

## Fichier: `ecs/systems/CameraControlsSystem.ts`

```typescript
/**
 * CameraControlsSystem.ts - Contrôles caméra professionnels (OrbitControls)
 * 
 * Inspiration : Three.js OrbitControls
 * - Clic droit/molette + mouvement : orbiter autour d'une cible
 * - WASD : déplacement de la cible
 * - Q/E : hauteur
 * - Molette : zoom
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';

export class CameraControlsSystem extends System {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  // Variables de logging (désactivées en production)
  // private lastLoggedPosition = new THREE.Vector3();
  // private lastLoggedTarget = new THREE.Vector3();
  // private logInterval = 1000;
  // private lastLogTime = 0;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    super('CameraControlsSystem', 1); // Très haute priorité
    this.camera = camera;
    this.canvas = canvas;

    this.controls = new OrbitControls(camera, canvas);
    this.setupControls();
    this.setupCanvasEvents();
    
    // Log position initiale (désactivé en production)
    // console.log('📷 Camera position initiale:', this.camera.position);
    // console.log('🎯 Camera target initial:', this.controls.target);
    // this.lastLoggedPosition.copy(this.camera.position);
    // this.lastLoggedTarget.copy(this.controls.target);
  }

  private setupControls(): void {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Empêche la caméra de passer sous le sol
    this.controls.target.set(0, 6, -10); // Vue derrière le pilote vers le kite
    
    // Note : L'avertissement "non-passive event listener" vient de Three.js OrbitControls
    // et ne peut être corrigé sans modifier la bibliothèque elle-même.
    // Cet avertissement n'affecte pas les performances dans notre cas d'usage.
    
    this.controls.update();
  }

  /**
   * Configure les événements du canvas pour permettre les contrôles de la souris
   */
  private setupCanvasEvents(): void {
    // Désactiver le menu contextuel par défaut pour permettre le clic droit
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Rendre le canvas focusable pour capturer les événements clavier
    this.canvas.setAttribute('tabindex', '0');
    
    // Focus automatique pour capturer immédiatement les événements
    this.canvas.focus();
  }

  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }

  update(_context: SimulationContext): void {
    this.controls.update();
    
    // Logger les changements de position (désactivé en production)
    /* 
    const now = performance.now();
    if (now - this.lastLogTime > this.logInterval) {
      const posChanged = !this.camera.position.equals(this.lastLoggedPosition);
      const targetChanged = !this.controls.target.equals(this.lastLoggedTarget);
      
      if (posChanged || targetChanged) {
        console.log('📷 Camera moved:');
        if (posChanged) {
          console.log('  Position:', this.camera.position.toArray().map(v => v.toFixed(2)));
        }
        if (targetChanged) {
          console.log('  Target:', this.controls.target.toArray().map(v => v.toFixed(2)));
        }
        
        this.lastLoggedPosition.copy(this.camera.position);
        this.lastLoggedTarget.copy(this.controls.target);
      }
      
      this.lastLogTime = now;
    }
    */
  }

  dispose(): void {
    this.controls.dispose();
  }
}

```

---

## Fichier: `ecs/systems/DebugSystem.ts`

```typescript
/**
 * DebugSystem.ts - Visualisation du debug (vecteurs de force)
 *
 * Affiche les vecteurs de force appliqués au kite quand debugMode est activé.
 * Priorité 88 (très basse, après le rendu normal).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { Entity } from '../core/Entity';
import { InputComponent } from '../components/InputComponent';
import { DebugComponent } from '../components/DebugComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { TransformComponent } from '../components/TransformComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { DebugFactory } from '../entities/DebugFactory';
import { DebugConfig } from '../config/Config';

import { RenderSystem } from './RenderSystem';

export class DebugSystem extends System {
  private inputComponent: InputComponent | null = null;
  renderSystem: RenderSystem | null = null; // Public pour SimulationApp
  private debugEntity: Entity | null = null;
  private prevDebugMode = false;
  private lastLogTime = 0;

  constructor() {
    super('DebugSystem', 48); // Priority 48 : APRÈS ConstraintSystem (40) mais AVANT PhysicsSystem (50)
  }

  initialize(entityManager: EntityManager): void {
    // Chercher l'InputComponent
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const comp = inputEntities[0].getComponent('Input');
      if (comp) {
        this.inputComponent = comp as InputComponent;
      }
    }

    // Récupérer l'entité debug
    const debugEntities = entityManager.query(['debug']);
    
    let debugEntity = debugEntities.find(e => e.id === 'debug-helper');
    
    if (!debugEntity) {
      // Créer une nouvelle entité debug si elle n'existe pas
      debugEntity = DebugFactory.create();
      entityManager.register(debugEntity);
    }
    
    this.debugEntity = debugEntity ?? null;
  }

  update(context: SimulationContext): void {
    const currentTime = performance.now();
    const shouldLog = currentTime - this.lastLogTime > 5000; // Log max une fois toutes les 5 secondes
    
    if (!this.inputComponent || !this.debugEntity || !this.renderSystem) {
      if (!this.renderSystem && shouldLog) {
        console.warn('🐛 [DebugSystem] renderSystem not set');
        this.lastLogTime = currentTime;
      }
      return;
    }

    const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
    if (!debugComp) {
      console.warn('🐛 [DebugSystem] DebugComponent not found');
      return;
    }

    // Si le mode debug vient d'être activé, ajouter le groupe à la scène
    if (this.inputComponent.debugMode && !this.prevDebugMode) {
      this.renderSystem.scene.add(debugComp.debugGroup);
      this.lastLogTime = currentTime;
    }
    // Si le mode debug vient d'être désactivé, enlever le groupe
    else if (!this.inputComponent.debugMode && this.prevDebugMode) {
      this.renderSystem.scene.remove(debugComp.debugGroup);
      debugComp.clearAll(); // Nettoyer TOUT, y compris les labels persistants
      this.lastLogTime = currentTime;
    }

    this.prevDebugMode = this.inputComponent.debugMode;

    if (!this.inputComponent.debugMode) {
      return; // Ne rien faire si debug désactivé
    }

    // Nettoyer les flèches précédentes
    debugComp.clearArrows();

    // Chercher le kite et afficher les forces
    const kiteEntity = context.entityManager.query(['physics', 'transform']).find(e => e.id === 'kite');
    if (!kiteEntity) {
      return;
    }

    const physics = kiteEntity.getComponent('physics') as PhysicsComponent | null;
    const transform = kiteEntity.getComponent('transform') as TransformComponent | null;

    if (!physics || !transform) {
      return;
    }

    // Log uniquement si demandé (toutes les 5 secondes)
    // Désactivé pour réduire le bruit de logs
    
    // === Afficher les forces par face (aux positions exactes de calcul) ===
    // Afficher les forces de portance, traînée et gravité pour chaque face
    physics.faceForces.forEach((faceForce, index) => {
      // Portance (bleu ciel) - TOUJOURS afficher même si petite
      if (faceForce.lift.length() > DebugConfig.LIFT_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.lift.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0x87CEEB, // Bleu ciel
          `lift-face-${index}`
        );
      }
      
      // Traînée (rouge)
      if (faceForce.drag.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.drag.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0xff0000, // Rouge
          `drag-face-${index}`
        );
      }

      // Gravité par face (jaune)
      if (faceForce.gravity.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.gravity.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0xffff00, // Jaune
          `gravity-face-${index}`
        );
      }

      // Vent apparent par face (vert)
      if (faceForce.apparentWind.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.apparentWind.clone().multiplyScalar(DebugConfig.WIND_VECTOR_SCALE),
          0x00ff00, // Vert
          `apparent-wind-face-${index}`
        );
      }

      // 🎯 NORMALE de la face (bleu foncé)
      if (faceForce.normal && faceForce.normal.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.normal.clone().multiplyScalar(DebugConfig.NORMAL_DISPLAY_LENGTH),
          0x00008B, // Bleu foncé (dark blue)
          `normal-face-${index}`
        );
      }
      
      // 🏷️ LABEL numérique de la face (parallèle à la surface)
      // Créer les labels UNE SEULE FOIS, puis juste mettre à jour leur position
      const faceNumber = index + 1;
      
      if (faceForce.normal && faceForce.normal.length() > DebugConfig.MIN_FORCE_ARROW_DISPLAY) {
        if (!debugComp.labelsCreated) {
          // Première fois: créer le label
          debugComp.addSurfaceLabel(
            `${faceNumber}`, // Juste le numéro (1-4)
            faceForce.centroid.clone(), // Position au centre exact de la face
            faceForce.normal.clone(), // Normale pour alignement parallèle
            '#FFFF00', // Jaune pour visibilité
            DebugConfig.TEXT_LABEL_SIZE
          );
        } else {
          // Ensuite: juste mettre à jour la position (pas de recréation!)
          debugComp.updateSurfaceLabel(
            index,
            faceForce.centroid.clone(),
            faceForce.normal.clone()
          );
        }
      }
    });
    
    // Marquer les labels comme créés après la première passe
    if (!debugComp.labelsCreated && physics.faceForces.length > 0) {
      debugComp.labelsCreated = true;
    }

    // === Afficher les tensions des lignes (magenta) ===
    this.displayLineTensions(debugComp, context, kiteEntity);

    // === Afficher les forces aux poignets de la barre (cyan) ===
    this.displayGripForces(debugComp, context);

    // === Afficher le vecteur du vent au point NEZ (blanc) ===
    this.displayWindVector(debugComp, context, kiteEntity);

    // Log count seulement lors du throttle
    // (Le log de forces ci-dessus a déjà mis à jour lastLogTime)
  }

  /**
   * Affiche les vecteurs de tension des lignes aux points d'attache
   */
  private displayLineTensions(debugComp: DebugComponent, context: SimulationContext, kiteEntity: any): void {
    const { entityManager } = context;
    const scale = DebugConfig.FORCE_VECTOR_SCALE;

    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    const controlBar = entityManager.getEntity('controlBar');

    if (!controlBar) return;

    const kiteGeometry = kiteEntity.getComponent('geometry') as GeometryComponent | null;
    const barGeometry = controlBar.getComponent('geometry') as GeometryComponent | null;

    if (!kiteGeometry || !barGeometry) return;

    // Fonction utilitaire pour afficher la tension d'une ligne
    const displayLineTension = (line: Entity, ctrlPointName: string, handleName: string, arrowId: string): void => {
      const lineComp = line.getComponent('line') as LineComponent | null;
      if (!lineComp || !lineComp.state.isTaut || lineComp.currentTension <= DebugConfig.FORCE_THRESHOLD) return;

      const kitePoint = kiteGeometry.getPointWorld(ctrlPointName, kiteEntity);
      const barPoint = barGeometry.getPointWorld(handleName, controlBar);
      if (!kitePoint || !barPoint) return;

      // ✅ DIRECTION CORRIGÉE : Du point CTRL vers le handle (tire le kite vers la barre)
      // Cohérent avec TetherSystem.ts ligne 207 : force = direction × (-tension)
      // où direction = de handle vers CTRL, donc force tire vers handle
      const direction = barPoint.clone().sub(kitePoint).normalize(); // Vers la barre
      const tensionVector = direction.multiplyScalar(lineComp.currentTension);

      debugComp.addForceArrow(
        kitePoint.clone(),
        tensionVector.clone().multiplyScalar(scale),
        0xff00ff, // Magenta
        arrowId
      );
    };

    // Tension ligne gauche
    if (leftLine) {
      displayLineTension(leftLine, 'CTRL_GAUCHE', 'leftHandle', 'tension-left');
    }

    // Tension ligne droite
    if (rightLine) {
      displayLineTension(rightLine, 'CTRL_DROIT', 'rightHandle', 'tension-right');
    }
  }

  /**
   * Affiche les forces de tension au niveau des poignets de la barre de contrôle
   * Visualise la force que les lignes exercent sur les mains du pilote
   */
  private displayGripForces(debugComp: DebugComponent, context: SimulationContext): void {
    const { entityManager } = context;
    const scale = DebugConfig.FORCE_VECTOR_SCALE;

    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    const controlBar = entityManager.getEntity('controlBar');
    const kiteEntity = entityManager.getEntity('kite');

    if (!controlBar || !kiteEntity) return;

    const barGeometry = controlBar.getComponent('geometry') as GeometryComponent | null;
    const barTransform = controlBar.getComponent('transform') as TransformComponent | null;
    const kiteTransform = kiteEntity.getComponent('transform') as TransformComponent | null;

    if (!barGeometry || !barTransform || !kiteTransform) return;

    // Fonction utilitaire pour afficher la force de grip d'une ligne
    const displayGripForce = (line: Entity, handleName: string, ctrlPointName: string, arrowId: string): void => {
      const lineComp = line.getComponent('line') as LineComponent | null;
      if (!lineComp || !lineComp.state.isTaut || lineComp.currentTension <= DebugConfig.FORCE_THRESHOLD) return;

      const barPoint = barGeometry.getPointWorld(handleName, controlBar);
      const kiteGeometry = kiteEntity.getComponent('geometry') as GeometryComponent | null;
      const kitePoint = kiteGeometry?.getPointWorld(ctrlPointName, kiteEntity);
      if (!barPoint || !kitePoint) return;

      // ✅ DIRECTION CORRIGÉE : Newton 3 - Force opposée à celle sur le kite
      // La ligne tire le handle VERS le CTRL (direction du kite vers la barre inversée)
      // = Réaction à la force appliquée au kite
      const direction = kitePoint.clone().sub(barPoint).normalize(); // Vers le kite
      const gripForce = direction.multiplyScalar(lineComp.currentTension);

      debugComp.addForceArrow(
        barPoint.clone(),
        gripForce.clone().multiplyScalar(scale),
        0x00ffff, // Cyan
        arrowId
      );
    };

    // Force sur le poignet gauche
    if (leftLine) {
      displayGripForce(leftLine, 'leftHandle', 'CTRL_GAUCHE', 'grip-force-left');
    }

    // Force sur le poignet droit
    if (rightLine) {
      displayGripForce(rightLine, 'rightHandle', 'CTRL_DROIT', 'grip-force-right');
    }
  }

  /**
   * Affiche le vecteur du vent ambiant au point NEZ (nez) du kite
   * Couleur : blanc pour une bonne visibilité
   */
  private displayWindVector(debugComp: DebugComponent, context: SimulationContext, kiteEntity: Entity): void {
    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) return;

    const wind = windCache.get(kiteEntity.id);
    if (!wind || !wind.ambient) return;

    // Récupérer la géométrie du kite pour accéder au point NEZ
    const geometry = kiteEntity.getComponent('geometry') as GeometryComponent | null;
    if (!geometry) return;

    // Obtenir la position du point NEZ en coordonnées du monde
    const nezWorldPosition = geometry.getPointWorld('NEZ', kiteEntity);
    if (!nezWorldPosition) return;

    // Afficher le vecteur du vent ambiant avec l'échelle de Config
    if (wind.ambient.length() > DebugConfig.FORCE_THRESHOLD) {
      debugComp.addForceArrow(
        nezWorldPosition.clone(),
        wind.ambient.clone().multiplyScalar(DebugConfig.WIND_VECTOR_SCALE),
        0xffffff, // Blanc
        'wind-vector-nez'
      );
    }
  }

  /**
   * Réinitialise l'état du debug (appelé lors d'un reset de simulation)
   * Nettoie tous les vecteurs de debug et retire le groupe de la scène
   */
  resetDebugState(): void {
    if (!this.debugEntity || !this.renderSystem) return;

    const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
    if (debugComp) {
      // Nettoyer toutes les flèches
      debugComp.clearArrows();

      // Retirer le groupe de la scène
      if (debugComp.debugGroup.parent) {
        this.renderSystem.scene.remove(debugComp.debugGroup);
      }

      // Réinitialiser le flag prevDebugMode pour forcer la ré-ajout si debug activé
      this.prevDebugMode = false;
    }
  }

  dispose(): void {
    if (this.debugEntity) {
      const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
      if (debugComp) {
        debugComp.clearArrows();
      }
    }
  }
}

```

---

## Fichier: `ecs/systems/EnvironmentSystem.ts`

```typescript
/**
 * EnvironmentSystem.ts - Gère l'environnement 3D (sol, ciel, éclairage)
 * 
 * Crée :
 * - Un sol vert
 * - Un ciel bleu
 * - L'éclairage ambiant et directionnel
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';

export class EnvironmentSystem extends System {
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene) {
    super('EnvironmentSystem', 1); // Très haute priorité (avant caméra)
    this.scene = scene;
    this.setupEnvironment();
  }
  
  private setupEnvironment(): void {
    // === SOL VERT ===
    // Le sol est dans le plan XZ avec Y = 0 (horizontal)
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d8a2d, // Vert
      roughness: 0.8,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    // Rotation pour que le plan XY devienne XZ (rotation autour de X-axis)
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Grid helper pour visualiser (optionnel mais utile)
    // GridHelper est dans le plan XZ par défaut, pas besoin de rotation
    const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x888888);
    gridHelper.position.y = 0.01; // Juste au-dessus du sol
    this.scene.add(gridHelper);
    
    // === CIEL BLEU ===
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB, // Bleu ciel
      side: THREE.BackSide // Visible de l'intérieur
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
    
    // === ÉCLAIRAGE ===
    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Lumière directionnelle (soleil)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.far = 500;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
  }
  
  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }
  
  update(_context: SimulationContext): void {
    // Rien à faire (environnement statique)
  }
  
  dispose(): void {
    // Nettoyage si nécessaire
  }
}

```

---

## Fichier: `ecs/systems/GeometryRenderSystem.ts`

```typescript
/**
 * GeometryRenderSystem.ts - Crée les meshes Three.js depuis GeometryComponent
 * 
 * Convertit les données géométriques pures en objets Three.js pour le rendu.
 * Priorité 60 (avant RenderSystem).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { GeometryComponent } from '../components/GeometryComponent';
import { VisualComponent } from '../components/VisualComponent';
import { MeshComponent } from '../components/MeshComponent';
import { KiteComponent } from '../components/KiteComponent';
import { MathUtils } from '../utils/MathUtils';

import { VisualConstants } from '../config/Config';

export class GeometryRenderSystem extends System {
  constructor() {
    super('GeometryRenderSystem', 60);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
    // Pour toutes les entités avec géométrie
    const entities = entityManager.query(['geometry', 'visual']);
    
    entities.forEach(entity => {
      const meshComp = entity.getComponent<MeshComponent>('mesh');
      const geometry = entity.getComponent('geometry') as GeometryComponent | undefined;
      
      if (!meshComp) {
        // Créer le mesh initial
        const mesh = this.createMesh(entity);
        if (mesh) {
          entity.addComponent(new MeshComponent(mesh));
        }
      } else if (geometry) {
        // Mettre à jour les lignes dynamiques (start/end)
        this.updateLineMesh(meshComp.object3D, geometry);
      }
    });
  }
  
  /**
   * Met à jour les positions d'une ligne dynamique (tube cylindrique)
   * Optimisé: modifie la transformation au lieu de recréer la géométrie
   */
  private updateLineMesh(mesh: THREE.Object3D, geometry: GeometryComponent): void {
    // Vérifier si c'est une ligne simple (start -> end)
    const start = geometry.getPoint('start');
    const end = geometry.getPoint('end');

    if (!start || !end) return;

    // Vérifier que les points sont valides (pas NaN)
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z) ||
        !Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z)) {
      console.warn(`⚠️ [GeometryRenderSystem] Invalid start/end points: start=${start}, end=${end}`);
      return;
    }

    // Parcourir les enfants pour trouver le tube cylindrique
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CylinderGeometry) {
        // Recalculer direction et longueur
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();

        // Protection contre longueurs invalides (NaN ou trop petites)
        if (!Number.isFinite(length) || length < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid length: ${length}, skipping update`);
          // Masquer ou désactiver le mesh au lieu de le laisser avec des valeurs NaN
          child.visible = false;
          return;
        }

        // Remettre le mesh visible si la longueur est valide
        child.visible = true;

        // Si la longueur a changé significativement, recréer la géométrie
        const cylinderGeometry = child.geometry as THREE.CylinderGeometry;
        const currentHeight = cylinderGeometry.parameters.height;
        if (Math.abs(length - currentHeight) > VisualConstants.LINE_GEOMETRY_UPDATE_THRESHOLD) {
          child.geometry.dispose();
          child.geometry = new THREE.CylinderGeometry(
            VisualConstants.LINE_TUBE_RADIUS,
            VisualConstants.LINE_TUBE_RADIUS,
            length,
            VisualConstants.LINE_TUBE_SEGMENTS
          );
        }

        // Repositionner au centre (toujours nécessaire)
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        child.position.copy(center);

        // Réorienter vers la nouvelle direction (toujours nécessaire)
        child.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.normalize()
        );
      }
    });
  }
  
  /**
   * Crée un mesh Three.js depuis GeometryComponent
   */
  private createMesh(entity: Entity): THREE.Object3D | null {
    const geometry = entity.getComponent('geometry') as GeometryComponent | undefined;
    const visual = entity.getComponent('visual') as VisualComponent | undefined;
    const kite = entity.getComponent('kite') as KiteComponent | undefined;
    
    if (!geometry || !visual) return null;
    
    // Si c'est un kite, créer géométrie delta
    if (kite) {
      return this.createKiteMesh(geometry, visual);
    }
    
    // Si c'est la barre de contrôle (identifiée par ses handles)
    if (geometry.hasPoint('leftHandle') && geometry.hasPoint('rightHandle')) {
      return this.createControlBarMesh(geometry, visual);
    }
    
    // Sinon, mesh simple avec wireframe
    return this.createWireframeMesh(geometry, visual);
  }
  
  /**
   * Crée le mesh du kite delta (style main branch)
   */
  private createKiteMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'KiteGroup';
    
    // === 1. TOILE (4 panneaux triangulaires) ===
    this.createKiteSail(group, geometry, visual);
    
    // === 2. FRAME (armature noire) ===
    this.createKiteFrame(group, geometry);
    
    // === 3. BRIDES ===
    // DÉSACTIVÉ: Les brides sont maintenant gérées par BridleRenderSystem
    // qui les affiche dynamiquement en coordonnées MONDE
    // this.createKiteBridles(group, geometry);
    
    // === 4. MARQUEURS DES POINTS DE CONTRÔLE ===
    // DÉSACTIVÉ: Les points CTRL sont visualisés via les brides dynamiques
    // Pour debug, vous pouvez réactiver cette ligne
    // this.createControlPointMarkers(group, geometry);
    
    return group;
  }
  
  /**
   * Crée le mesh de la barre de contrôle
   * - Tube cylindrique marron entre les deux handles
   * - Poignée gauche rouge
   * - Poignée droite verte
   */
  private createControlBarMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'ControlBarGroup';

    const leftHandle = geometry.getPoint('poignet_gauche');
    const rightHandle = geometry.getPoint('poignet_droit');

    if (!leftHandle || !rightHandle) return group;

    // Vérifier que les points sont valides (pas NaN)
    if (!Number.isFinite(leftHandle.x) || !Number.isFinite(leftHandle.y) || !Number.isFinite(leftHandle.z) ||
        !Number.isFinite(rightHandle.x) || !Number.isFinite(rightHandle.y) || !Number.isFinite(rightHandle.z)) {
      console.warn(`⚠️ [GeometryRenderSystem] Invalid handle points for control bar`);
      return group;
    }

    // === 1. BARRE (tube cylindrique marron) ===
    const barLength = leftHandle.distanceTo(rightHandle);

    // Protection contre longueurs invalides
    if (!Number.isFinite(barLength) || barLength < 0.001) {
      console.warn(`⚠️ [GeometryRenderSystem] Invalid control bar length: ${barLength}, skipping`);
      return group;
    }

    const barRadius = VisualConstants.BAR_CYLINDER_DIAMETER / 2;
    const barGeometry = new THREE.CylinderGeometry(barRadius, barRadius, barLength, 16);
    const barMaterial = new THREE.MeshStandardMaterial({
      color: visual.color, // Marron défini dans ControlBarFactory
      roughness: 0.6,
      metalness: 0.1
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);

    // Positionner et orienter le tube horizontalement
    const center = new THREE.Vector3().addVectors(leftHandle, rightHandle).multiplyScalar(0.5);
    bar.position.copy(center);
    bar.rotation.z = Math.PI / 2; // Tourner de 90° pour être horizontal

    group.add(bar);

    // === 2. POIGNÉE GAUCHE (rouge) ===
    const handleRadius = VisualConstants.HANDLE_SPHERE_DIAMETER / 2;
    const leftHandleGeometry = new THREE.SphereGeometry(handleRadius, VisualConstants.HANDLE_SPHERE_SEGMENTS, VisualConstants.HANDLE_SPHERE_SEGMENTS);
    const leftHandleMaterial = new THREE.MeshStandardMaterial({
      color: VisualConstants.COLOR_RED,
      roughness: 0.4,
      metalness: 0.2
    });
    const leftHandleMesh = new THREE.Mesh(leftHandleGeometry, leftHandleMaterial);
    leftHandleMesh.position.copy(leftHandle);
    leftHandleMesh.name = 'LeftHandle';
    group.add(leftHandleMesh);

    // === 3. POIGNÉE DROITE (verte) ===
    const rightHandleGeometry = new THREE.SphereGeometry(handleRadius, VisualConstants.HANDLE_SPHERE_SEGMENTS, VisualConstants.HANDLE_SPHERE_SEGMENTS);
    const rightHandleMaterial = new THREE.MeshStandardMaterial({
      color: VisualConstants.COLOR_GREEN,
      roughness: 0.4,
      metalness: 0.2
    });
    const rightHandleMesh = new THREE.Mesh(rightHandleGeometry, rightHandleMaterial);
    rightHandleMesh.position.copy(rightHandle);
    rightHandleMesh.name = 'RightHandle';
    group.add(rightHandleMesh);

    return group;
  }
  
  /**
   * Crée la toile du kite (4 panneaux triangulaires)
   */
  private createKiteSail(group: THREE.Group, geometry: GeometryComponent, visual: VisualComponent): void {
    // Récupérer les points nécessaires
    const nez = geometry.getPoint('NEZ');
    const bordLeft = geometry.getPoint('BORD_GAUCHE');
    const bordRight = geometry.getPoint('BORD_DROIT');
    const spineBas = geometry.getPoint('SPINE_BAS');
    const whiskerLeft = geometry.getPoint('WHISKER_GAUCHE');
    const whiskerRight = geometry.getPoint('WHISKER_DROIT');

    if (!nez || !bordLeft || !bordRight || !spineBas || !whiskerLeft || !whiskerRight) return;

    // Vérifier que tous les points sont valides (pas NaN)
    const allPoints = [nez, bordLeft, bordRight, spineBas, whiskerLeft, whiskerRight];
    for (const point of allPoints) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
        console.warn(`⚠️ [GeometryRenderSystem] Invalid sail point detected, skipping sail creation`);
        return;
      }
    }

    // 4 panneaux triangulaires (comme dans main)
    const panels = [
      // Toile gauche haut
      [nez, bordLeft, whiskerLeft],
      // Toile gauche bas
      [nez, whiskerLeft, spineBas],
      // Toile droite haut
      [nez, bordRight, whiskerRight],
      // Toile droite bas
      [nez, whiskerRight, spineBas]
    ];

    panels.forEach((panel, index) => {
      const [v1, v2, v3] = panel;

      // Vérifier que les points du panneau ne sont pas colinéaires (surface nulle)
      const area = MathUtils.computeTriangleArea(v1, v2, v3);
      if (area < 0.001) {
        console.warn(`⚠️ [GeometryRenderSystem] Zero area sail panel ${index}, skipping`);
        return;
      }

      const vertices = new Float32Array([
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z,
        v3.x, v3.y, v3.z
      ]);

      const bufferGeometry = new THREE.BufferGeometry();
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      bufferGeometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: visual.color,
        opacity: visual.opacity,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1
      });

      const mesh = new THREE.Mesh(bufferGeometry, material);
      mesh.name = `Sail_Panel_${index}`;
      group.add(mesh);
    });
  }
  
  /**
   * Crée l'armature du kite (frame noir)
   */
  private createKiteFrame(group: THREE.Group, geometry: GeometryComponent): void {
    // Connexions du frame principal
    const frameConnections = [
      ['NEZ', 'SPINE_BAS'],           // Épine centrale
      ['NEZ', 'BORD_GAUCHE'],         // Bord d'attaque gauche
      ['NEZ', 'BORD_DROIT'],          // Bord d'attaque droit
      ['INTER_GAUCHE', 'INTER_DROIT'] // Spreader (barre transversale)
    ];

    const frameMaterial = new THREE.LineBasicMaterial({
      color: 0x2a2a2a,
      linewidth: 2
    });

    frameConnections.forEach(([from, to]) => {
      const p1 = geometry.getPoint(from);
      const p2 = geometry.getPoint(to);
      if (p1 && p2) {
        // Vérifier que les points sont valides (pas NaN)
        if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p1.z) ||
            !Number.isFinite(p2.x) || !Number.isFinite(p2.y) || !Number.isFinite(p2.z)) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid frame points: ${from} -> ${to}`);
          return;
        }

        // Vérifier que les points ne sont pas identiques (distance nulle)
        const distance = p1.distanceTo(p2);
        if (distance < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Zero distance frame points: ${from} -> ${to}`);
          return;
        }

        const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(lineGeom, frameMaterial);
        line.name = `Frame_${from}_${to}`;
        group.add(line);
      }
    });

    // Whiskers (plus fins, gris foncé)
    const whiskerConnections = [
      ['WHISKER_GAUCHE', 'FIX_GAUCHE'],
      ['WHISKER_DROIT', 'FIX_DROIT']
    ];

    const whiskerMaterial = new THREE.LineBasicMaterial({
      color: 0x444444,
      linewidth: 1
    });

    whiskerConnections.forEach(([from, to]) => {
      const p1 = geometry.getPoint(from);
      const p2 = geometry.getPoint(to);
      if (p1 && p2) {
        // Vérifier que les points sont valides (pas NaN)
        if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p1.z) ||
            !Number.isFinite(p2.x) || !Number.isFinite(p2.y) || !Number.isFinite(p2.z)) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid whisker points: ${from} -> ${to}`);
          return;
        }

        // Vérifier que les points ne sont pas identiques (distance nulle)
        const distance = p1.distanceTo(p2);
        if (distance < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Zero distance whisker points: ${from} -> ${to}`);
          return;
        }

        const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(lineGeom, whiskerMaterial);
        line.name = `Whisker_${from}_${to}`;
        group.add(line);
      }
    });
  }
  

  
  /**
   * Crée un mesh wireframe simple (utilisé pour les lignes de vol)
   */
  private createWireframeMesh(geometry: GeometryComponent, visual: VisualComponent): THREE.Object3D {
    const group = new THREE.Group();

    // Ajouter les connexions comme tubes cylindriques (plus visibles que LineBasicMaterial)
    geometry.connections.forEach(conn => {
      const p1 = geometry.getPoint(conn.from);
      const p2 = geometry.getPoint(conn.to);

      if (p1 && p2) {
        // Vérifier que les points sont valides (pas NaN)
        if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p1.z) ||
            !Number.isFinite(p2.x) || !Number.isFinite(p2.y) || !Number.isFinite(p2.z)) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid connection points: ${conn.from} -> ${conn.to}`);
          return;
        }

        // Créer un tube cylindrique entre les deux points
        const direction = new THREE.Vector3().subVectors(p2, p1);
        const length = direction.length();

        // Protection contre longueurs invalides
        if (!Number.isFinite(length) || length < 0.001) {
          console.warn(`⚠️ [GeometryRenderSystem] Invalid line length: ${length}, skipping`);
          return;
        }

        // Géométrie cylindrique
        const tubeGeometry = new THREE.CylinderGeometry(VisualConstants.LINE_TUBE_RADIUS, VisualConstants.LINE_TUBE_RADIUS, length, VisualConstants.LINE_TUBE_SEGMENTS);
        const tubeMaterial = new THREE.MeshStandardMaterial({
          color: visual.color,
          roughness: 0.8,
          metalness: 0.1
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);

        // Positionner au centre
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        tube.position.copy(center);

        // Orienter le cylindre vers p2
        tube.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), // Axe Y (direction par défaut du cylindre)
          direction.normalize()
        );

        tube.name = `Line_${conn.from}_${conn.to}`;
        group.add(tube);
      }
    });

    return group;
  }
}

```

---

## Fichier: `ecs/systems/InputSyncSystem.ts`

```typescript
/**
 * InputSyncSystem.ts - Synchronisation des changements UI vers les systèmes physiques
 *
 * Ce système écoute les changements dans InputComponent et met à jour
 * les composants correspondants (LineComponent, etc.)
 *
 * Priorité 5 (TRÈS haute, AVANT tous les autres systèmes)
 */

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { InputComponent } from '../components/InputComponent';
import { LineComponent } from '../components/LineComponent';
import { BridleComponent } from '../components/BridleComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { Logger } from '../utils/Logging';

const logger = Logger.getInstance();

export class InputSyncSystem extends System {
  private lastLineLength: number = 0;
  private lastBridleNez: number = 0;
  private lastBridleInter: number = 0;
  private lastBridleCentre: number = 0;
  private lastLinearDamping: number = 0;
  private lastAngularDamping: number = 0;

  constructor() {
    super('InputSyncSystem', 5); // Très haute priorité
  }

  initialize(entityManager: EntityManager): void {
    // Initialiser les valeurs de cache
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const input = inputEntities[0].getComponent<InputComponent>('Input');
      if (input) {
        this.lastLineLength = input.lineLength;
        this.lastBridleNez = input.bridleNez;
        this.lastBridleInter = input.bridleInter;
        this.lastBridleCentre = input.bridleCentre;
        this.lastLinearDamping = input.linearDamping;
        this.lastAngularDamping = input.angularDamping;
      }
    }
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer InputComponent
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length === 0) return;

    const input = inputEntities[0].getComponent<InputComponent>('Input');
    if (!input) return;

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE LINE LENGTH
    // ========================================================================
    if (input.lineLength !== this.lastLineLength) {
      logger.debug(`🔗 Line length changed: ${this.lastLineLength} → ${input.lineLength} m`, 'InputSyncSystem');
      this.updateLineLength(entityManager, input.lineLength);
      this.lastLineLength = input.lineLength;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE BRIDES
    // ========================================================================
    if (input.bridleNez !== this.lastBridleNez) {
      logger.debug(`🌉 Bridle Nez changed: ${this.lastBridleNez} → ${input.bridleNez} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'nez', input.bridleNez);
      this.lastBridleNez = input.bridleNez;
    }

    if (input.bridleInter !== this.lastBridleInter) {
      logger.debug(`🌉 Bridle Inter changed: ${this.lastBridleInter} → ${input.bridleInter} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'inter', input.bridleInter);
      this.lastBridleInter = input.bridleInter;
    }

    if (input.bridleCentre !== this.lastBridleCentre) {
      logger.debug(`🌉 Bridle Centre changed: ${this.lastBridleCentre} → ${input.bridleCentre} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'centre', input.bridleCentre);
      this.lastBridleCentre = input.bridleCentre;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE DAMPING
    // ========================================================================
    if (input.linearDamping !== this.lastLinearDamping) {
      logger.debug(`📉 Linear damping changed: ${this.lastLinearDamping} → ${input.linearDamping}`, 'InputSyncSystem');
      this.updateLinearDamping(entityManager, input.linearDamping);
      this.lastLinearDamping = input.linearDamping;
    }

    if (input.angularDamping !== this.lastAngularDamping) {
      logger.debug(`📉 Angular damping changed: ${this.lastAngularDamping} → ${input.angularDamping}`, 'InputSyncSystem');
      this.updateAngularDamping(entityManager, input.angularDamping);
      this.lastAngularDamping = input.angularDamping;
    }
  }

  /**
   * Met à jour la longueur de toutes les lignes
   */
  private updateLineLength(entityManager: EntityManager, newLength: number): void {
    const lines = entityManager.query(['line']);
    lines.forEach(line => {
      const lineComp = line.getComponent<LineComponent>('line');
      if (lineComp) {
        lineComp.restLength = newLength;
        lineComp.currentLength = Math.min(lineComp.currentLength, newLength); // Limiter si trop long
        lineComp.state.currentLength = lineComp.currentLength;
      }
    });
  }



  /**
   * Met à jour une longueur de bride (nez, inter ou centre)
   * Méthode interne partagée pour éviter la duplication
   * 
   * @param entityManager Manager des entités
   * @param bridleType Type de bride: 'nez' | 'inter' | 'centre'
   * @param newLength Nouvelle longueur en mètres
   */
  private updateBridleLength(
    entityManager: EntityManager,
    bridleType: string,
    newLength: number
  ): void {
    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const bridle = kite.getComponent<BridleComponent>('bridle');
    if (bridle && bridle.lengths) {
      bridle.lengths[bridleType as keyof typeof bridle.lengths] = newLength;
    }
  }

  /**
   * Met à jour le damping linéaire de toutes les entités physiques
   */
  private updateLinearDamping(entityManager: EntityManager, newDamping: number): void {
    const entities = entityManager.query(['physics']);
    entities.forEach(entity => {
      const physics = entity.getComponent('physics') as any;
      if (physics) {
        physics.linearDamping = newDamping;
      }
    });
  }

  /**
   * Met à jour le damping angulaire de toutes les entités physiques
   */
  private updateAngularDamping(entityManager: EntityManager, newDamping: number): void {
    const entities = entityManager.query(['physics']);
    entities.forEach(entity => {
      const physics = entity.getComponent('physics') as any;
      if (physics) {
        physics.angularDamping = newDamping;
      }
    });
  }
}

```

---

## Fichier: `ecs/systems/InputSystem.ts`

```typescript
/**
 * InputSystem.ts - Gestion des entrées clavier
 *
 * Lit le clavier et met à jour InputComponent avec les entrées utilisateur.
 * Priorité 10 (exécuté en premier).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { InputComponent } from '../components/InputComponent';

export class InputSystem extends System {
  private keys: Set<string> = new Set();

  constructor() {
    super('InputSystem', 10);
  }

  initialize(): void {
    // Écoute clavier
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer InputComponent
    const uiEntity = entityManager.query(['Input'])[0];
    if (!uiEntity) return;

    const inputComp = uiEntity.getComponent<InputComponent>('Input');
    if (!inputComp) return;

    // Mettre à jour l'input de rotation depuis le clavier
    // INVERSÉ pour correspondre à l'intuition du pilote :
    // Flèche gauche ou Q = +1 (rotation droite de la barre = cerf-volant va à gauche)
    // Flèche droite ou D = -1 (rotation gauche de la barre = cerf-volant va à droite)
    // Aucune touche = 0 (neutre)
    if (this.keys.has('arrowleft') || this.keys.has('q')) {
      inputComp.barRotationInput = 1;
    } else if (this.keys.has('arrowright') || this.keys.has('d')) {
      inputComp.barRotationInput = -1;
    } else {
      inputComp.barRotationInput = 0;
    }
  }


  dispose(): void {
    this.keys.clear();
  }
}

```

---

## Fichier: `ecs/systems/LineRenderSystem.ts`

```typescript
/**
 * LineRenderSystem.ts - Met à jour les positions des lignes de vol
 * 
 * Ce système connecte visuellement :
 * - leftLine : poignet_gauche de la barre -> CTRL_GAUCHE du kite
 * - rightLine : poignet_droit de la barre -> CTRL_DROIT du kite
 * 
 * Priorité 55 (AVANT GeometryRenderSystem 60 pour que les positions soient correctes)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { GeometryComponent } from '../components/GeometryComponent';
import { TransformComponent } from '../components/TransformComponent';

/**
 * Paramètres pour la mise à jour d'une ligne
 */
interface LineUpdateParams {
  lineEntity: Entity;
  startGeometry: GeometryComponent;
  startTransform: TransformComponent;
  startPointName: string;
  endGeometry: GeometryComponent;
  endTransform: TransformComponent;
  endPointName: string;
}

export class LineRenderSystem extends System {
  constructor() {
    super('LineRenderSystem', 55); // AVANT GeometryRenderSystem (60)
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
   
    
    // Récupérer la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;
    
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    if (!barGeometry || !barTransform) return;
    
    // Récupérer le kite
    const kite = entityManager.getEntity('kite');
    if (!kite) return;
    
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    if (!kiteGeometry || !kiteTransform) return;
    
    // === LIGNE GAUCHE ===
    const leftLine = entityManager.getEntity('leftLine');
    if (leftLine) {
      this.updateLine({
        lineEntity: leftLine,
        startGeometry: barGeometry,
        startTransform: barTransform,
        startPointName: 'poignet_gauche',
        endGeometry: kiteGeometry,
        endTransform: kiteTransform,
        endPointName: 'CTRL_GAUCHE'
      });
    }
    
    // === LIGNE DROITE ===
    const rightLine = entityManager.getEntity('rightLine');
    if (rightLine) {
      this.updateLine({
        lineEntity: rightLine,
        startGeometry: barGeometry,
        startTransform: barTransform,
        startPointName: 'poignet_droit',
        endGeometry: kiteGeometry,
        endTransform: kiteTransform,
        endPointName: 'CTRL_DROIT'
      });
    }
    
  
  }
  
  /**
   * Met à jour une ligne entre deux points
   * Les points sont stockés en coordonnées monde absolues
   * (le TransformComponent de la ligne reste à 0,0,0)
   */
  private updateLine(params: LineUpdateParams): void {
    const {
      lineEntity,
      startGeometry,
      startTransform,
      startPointName,
      endGeometry,
      endTransform,
      endPointName
    } = params;

    const lineGeometry = lineEntity.getComponent('geometry') as GeometryComponent | undefined;
    if (!lineGeometry) return;
    
    // Point de départ (poignet de la barre) en coordonnées locales
    const startLocal = startGeometry.getPoint(startPointName);
    if (!startLocal) return;
    
    // Point d'arrivée (CTRL du kite) en coordonnées locales
    const endLocal = endGeometry.getPoint(endPointName);
    if (!endLocal) return;
    
    // Convertir en coordonnées monde avec transformation complète
    const startMatrix = new THREE.Matrix4();
    startMatrix.compose(startTransform.position, startTransform.quaternion, startTransform.scale);
    const startWorld = startLocal.clone().applyMatrix4(startMatrix);
    
    const endMatrix = new THREE.Matrix4();
    endMatrix.compose(endTransform.position, endTransform.quaternion, endTransform.scale);
    const endWorld = endLocal.clone().applyMatrix4(endMatrix);
    
    // Debug NaN
    if (isNaN(startWorld.x) || isNaN(endWorld.x)) {
      console.error('NaN detected in LineRenderSystem:');
      console.error('  startLocal:', startLocal);
      console.error('  endLocal:', endLocal);
      console.error('  startTransform:', startTransform.position, startTransform.quaternion);
      console.error('  endTransform:', endTransform.position, endTransform.quaternion);
      console.error('  startWorld:', startWorld);
      console.error('  endWorld:', endWorld);
      return; // Ne pas mettre à jour avec des NaN
    }
    
    // Les points sont stockés en coordonnées monde
    // car le TransformComponent de la ligne est à (0,0,0)
    lineGeometry.setPoint('start', startWorld);
    lineGeometry.setPoint('end', endWorld);
    
    // Les propriétés physiques (longueur, tension) sont mises à jour par ConstraintSystem
  }
}

```

---

## Fichier: `ecs/systems/PhysicsSystem.ts`

```typescript
/**
 * PhysicsSystem.ts - Intégration numérique (Euler semi-implicite)
 * 
 * Intègre les forces/couples en velocité/position.
 * Priorité 50 (après contraintes, avant rendu).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { PhysicsConstants } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

export class PhysicsSystem extends System {
  constructor() {
    const PRIORITY = 50;
    super('PhysicsSystem', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { deltaTime, entityManager } = context;

    // Pour toutes les entités avec physics
    const entities = entityManager.query(['transform', 'physics']);

    entities.forEach(entity => {
      const transform = entity.getComponent<TransformComponent>('transform')!;
      const physics = entity.getComponent<PhysicsComponent>('physics')!;

      // Vérifier NaN avant calcul
      const posNaN = isNaN(transform.position.x) || isNaN(transform.position.y) || isNaN(transform.position.z);
      if (posNaN) {
        console.error(`❌ [PhysicsSystem] ${entity.id} position is NaN!`, transform.position);
        return;
      }

      // Ignorer les objets cinématiques (fixes)
      if (physics.isKinematic) {
        return;
      }

      // --- Dynamique linéaire ---
      // Protection contre les NaN dans les forces
      if (isNaN(physics.forces.x) || isNaN(physics.forces.y) || isNaN(physics.forces.z)) {
        console.error(`❌ [PhysicsSystem] NaN in forces for ${entity.id}:`, physics.forces);
        physics.forces.set(0, 0, 0);
      }

      // Limite de sécurité pour les forces (évite les explosions numériques)
      const maxForce = 5000; // N - limite réaliste pour un cerf-volant
      if (physics.forces.lengthSq() > maxForce * maxForce) {
        physics.forces.normalize().multiplyScalar(maxForce);
      }

      // v_new = v_old + (F / m) × dt
      const acceleration = physics.forces.clone().multiplyScalar(physics.invMass);

      // Limite de sécurité pour l'accélération (évite les explosions numériques)
      const maxAcceleration = 500; // m/s² - valeur réaliste pour un cerf-volant
      if (acceleration.lengthSq() > maxAcceleration * maxAcceleration) {
        acceleration.normalize().multiplyScalar(maxAcceleration);
      }

      physics.velocity.add(acceleration.multiplyScalar(deltaTime));

      // Limite de sécurité pour la vitesse (évite les valeurs extrêmes)
      const maxVelocity = 200; // m/s - vitesse supersonique comme limite
      if (physics.velocity.lengthSq() > maxVelocity * maxVelocity) {
        physics.velocity.normalize().multiplyScalar(maxVelocity);
      }

      // Damping continu (exponentiel) : v *= exp(-linearDamping × dt)
      // Au lieu de v *= 0.8 (multiplicatif qui dépend de dt)
      const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
      physics.velocity.multiplyScalar(dampingFactor);

      // p_new = p_old + v_new × dt (semi-implicite : utilise nouvelle vélocité)
      const deltaPos = physics.velocity.clone().multiplyScalar(deltaTime);
      transform.position.add(deltaPos);

      // === COLLISION AVEC LE SOL ===
      // Vérifier que tous les points du kite restent au-dessus du sol
      this.handleGroundCollision(entity, transform, physics);

      // Vérification finale NaN (seulement si erreur détectée)
      if (isNaN(transform.position.x) || isNaN(transform.position.y) || isNaN(transform.position.z)) {
        console.error(`❌ [PhysicsSystem] NaN in position after update for ${entity.id}:`, transform.position);
        console.error('  deltaTime:', deltaTime, 'velocity:', physics.velocity);
        console.error('  forces:', physics.forces, 'mass:', physics.mass);
        // Reset position to prevent further corruption
        transform.position.set(0, 0, 0);
      }

      // Vérifier NaN dans la vitesse
      if (isNaN(physics.velocity.x) || isNaN(physics.velocity.y) || isNaN(physics.velocity.z)) {
        console.error(`❌ [PhysicsSystem] NaN in velocity for ${entity.id}:`, physics.velocity);
        physics.velocity.set(0, 0, 0);
      }

      // Vérifier NaN dans la vitesse angulaire
      if (isNaN(physics.angularVelocity.x) || isNaN(physics.angularVelocity.y) || isNaN(physics.angularVelocity.z)) {
        console.error(`❌ [PhysicsSystem] NaN in angular velocity for ${entity.id}:`, physics.angularVelocity);
        physics.angularVelocity.set(0, 0, 0);
      }

      // Vérifier quaternion normalisé (tolérance de 1e-6)
      const quatLength = Math.sqrt(
        transform.quaternion.x * transform.quaternion.x +
        transform.quaternion.y * transform.quaternion.y +
        transform.quaternion.z * transform.quaternion.z +
        transform.quaternion.w * transform.quaternion.w
      );
      if (Math.abs(quatLength - 1.0) > 1e-6) {
        console.warn(`⚠️ [PhysicsSystem] Quaternion not normalized for ${entity.id} (length: ${quatLength}), renormalizing`);
        transform.quaternion.normalize();
      }
      
      // --- Angular dynamics ---
      // Protection contre les NaN dans les torques
      if (isNaN(physics.torques.x) || isNaN(physics.torques.y) || isNaN(physics.torques.z)) {
        console.error(`❌ [PhysicsSystem] NaN in torques for ${entity.id}:`, physics.torques);
        physics.torques.set(0, 0, 0);
      }

      // Limite de sécurité pour les torques (évite les explosions numériques)
      const maxTorque = 1000; // N·m - limite réaliste pour un cerf-volant
      if (physics.torques.lengthSq() > maxTorque * maxTorque) {
        physics.torques.normalize().multiplyScalar(maxTorque);
      }

      // Vérifier que la matrice d'inertie inverse est valide
      if (!this.isValidMatrix3(physics.invInertia)) {
        console.error(`❌ [PhysicsSystem] Invalid invInertia matrix for ${entity.id}, using identity`);
        physics.invInertia = new THREE.Matrix3().identity();
      }

      // w_new = w_old + (I^-1 * t) * dt
      const angularAcceleration = this.multiplyMatrix3Vector(physics.invInertia, physics.torques);

      // Limite de sécurité pour l'accélération angulaire
      const maxAngularAcceleration = 500; // rad/s² - valeur réaliste
      if (angularAcceleration.lengthSq() > maxAngularAcceleration * maxAngularAcceleration) {
        angularAcceleration.normalize().multiplyScalar(maxAngularAcceleration);
      }

      physics.angularVelocity.add(angularAcceleration.multiplyScalar(deltaTime));

      // Limite de sécurité pour la vitesse angulaire
      const maxAngularVelocity = 500; // rad/s - ~28,000 RPM comme limite
      if (physics.angularVelocity.lengthSq() > maxAngularVelocity * maxAngularVelocity) {
        physics.angularVelocity.normalize().multiplyScalar(maxAngularVelocity);
      }

      // Damping angulaire exponentiel (comme pour le damping linéaire)
      const angularDampingFactor = Math.exp(-physics.angularDamping * deltaTime);
      physics.angularVelocity.multiplyScalar(angularDampingFactor);
      
      // Intégration rotation (quaternion)
      // q_new = q_old + 0.5 × (ω × q_old) × dt
      if (physics.angularVelocity.lengthSq() > PhysicsConstants.MIN_ANGULAR_VELOCITY_SQ) {
        const omegaQuat = new THREE.Quaternion(
          physics.angularVelocity.x,
          physics.angularVelocity.y,
          physics.angularVelocity.z,
          0
        );
        const qDot = omegaQuat.multiply(transform.quaternion.clone());
        const scale = PhysicsConstants.SEMI_IMPLICIT_SCALE * deltaTime;
        transform.quaternion.x += qDot.x * scale;
        transform.quaternion.y += qDot.y * scale;
        transform.quaternion.z += qDot.z * scale;
        transform.quaternion.w += qDot.w * scale;
        transform.quaternion.normalize();
      }
      
      // ✅ IMPORTANT : Nettoyer les forces À LA FIN, après intégration
      // Les systèmes de calcul (AeroSystem, ConstraintSystem) s'exécutent AVANT (priorités 30, 40)
      // et accumulent dans physics.forces/torques. On les intègre ici, puis on nettoie.
      this.clearForces(physics);
    });
  }

  /**
   * Multiplie une matrice 3x3 par un vecteur
   */
  private multiplyMatrix3Vector(matrix: THREE.Matrix3, vector: THREE.Vector3): THREE.Vector3 {
    return MathUtils.applyMatrix3ToVector(matrix, vector);
  }

  /**
   * Réinitialise les accumulateurs de forces après intégration
   */
  private clearForces(physics: PhysicsComponent): void {
    physics.forces.set(0, 0, 0);
    physics.torques.set(0, 0, 0);
  }

  /**
   * Gère la collision avec le sol pour une entité
   * Vérifie que tous les points de l'entité restent au-dessus du sol
   */
  private handleGroundCollision(entity: Entity, transform: TransformComponent, physics: PhysicsComponent): void {
    // Pour le kite, vérifier tous les points structurels
    if (entity.id === 'kite') {
      this.handleKiteGroundCollision(entity, transform, physics);
    } else {
      // Pour les autres entités, vérification simple du centre de masse
      this.handleSimpleGroundCollision(transform, physics);
    }
  }

  /**
   * Collision simple pour entités génériques (vérification du centre de masse uniquement)
   */
  private handleSimpleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.3; // Rebond amorti
      }
    }
  }

  /**
   * Collision spécialisée pour le kite - vérifie tous les points structurels
   */
  private handleKiteGroundCollision(entity: Entity, transform: TransformComponent, physics: PhysicsComponent): void {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    if (!geometry) {
      // Fallback vers vérification du centre de masse uniquement
      this.handleSimpleGroundCollision(transform, physics);
      return;
    }

    const groundY = PhysicsConstants.GROUND_Y;
    let needsCorrection = false;
    let maxPenetration = 0;
    let correctionVector = new THREE.Vector3();

    // Points critiques à vérifier pour un kite delta
    const criticalPoints = [
      'NEZ',           // Pointe avant
      'CTRL_GAUCHE',  // Point d'attache gauche
      'CTRL_DROIT',   // Point d'attache droit
      'SPINE_BAS',    // Base de l'épine
      'QUEUE'         // Queue (si présente)
    ];

    // Vérifier chaque point critique
    for (const pointName of criticalPoints) {
      const worldPoint = geometry.getPointWorld(pointName, entity);
      if (worldPoint && worldPoint.y < groundY) {
        needsCorrection = true;
        const penetration = groundY - worldPoint.y;
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          // Calculer le vecteur de correction basé sur le point le plus bas
          correctionVector.set(0, penetration, 0);
        }
      }
    }

    // Si collision détectée, corriger
    if (needsCorrection) {
      // Remonter le kite au-dessus du sol
      transform.position.add(correctionVector);

      // Annuler la composante verticale de la vitesse (rebond amorti)
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.1; // Rebond très amorti pour stabilité
      }

      // Amortir les rotations pour stabiliser
      physics.angularVelocity.multiplyScalar(0.8);

      
    }
  }

  /**
   * Vérifie si une matrice 3x3 est valide (pas de NaN ou Infinity)
   */
  private isValidMatrix3(matrix: THREE.Matrix3): boolean {
    const elements = matrix.elements;
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(elements[i])) {
        return false;
      }
    }
    return true;
  }
}

```

---

## Fichier: `ecs/systems/PilotSystem.ts`

```typescript
/**
 * PilotSystem.ts - Système de calcul du retour haptique pour le pilote
 * 
 * Responsabilités :
 * - Lit les tensions des lignes depuis les LineComponent
 * - Calcule les tensions filtrées pour un feedback lisse
 * - Détecte l'asymétrie et le côté dominant
 * - Calcule les deltas de tension
 * - Détermine l'état du vol
 * 
 * Architecture ECS :
 * - Opère sur l'entité pilote avec PilotComponent
 * - Lit les données des lignes (LineComponent)
 * - S'exécute après ConstraintSystem (qui calcule les tensions)
 * 
 * Référence Makani :
 * - Les tensions sont calculées par ConstraintSystem
 * - Ce système se concentre sur le traitement du feedback
 */

import * as THREE from 'three';

import { System } from '../core/System';
import type { EntityManager } from '../core/EntityManager';
import type { SimulationContext } from '../core/System';
import { PilotComponent } from '../components/PilotComponent';
import { LineComponent } from '../components/LineComponent';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { InputComponent } from '../components/InputComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { CONFIG } from '../config/Config';

export class PilotSystem extends System {
  private barRotationAngle: number = 0; // Angle de rotation actuel (degrés)

  // Configuration de la rotation de la barre
  private readonly MAX_ROTATION_ANGLE = 30; // degrés max de chaque côté
  private readonly ROTATION_SPEED = 60; // degrés/seconde

  constructor() {
    // S'exécute après ConstraintSystem (priorité 50)
    super('PilotSystem', 55);
  }
  
  async initialize(_entityManager: EntityManager): Promise<void> {
    // Pas d'initialisation spécifique nécessaire
  }
  
  update(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    const pilotComp = this.getPilotComponent(entityManager);
    if (!pilotComp) return;

    const lineComponents = this.getLineComponents(entityManager);
    if (!lineComponents) return;

    this.updateRawTensions(pilotComp, lineComponents);
    this.applyTensionFiltering(pilotComp);
    this.calculateAsymmetry(pilotComp);
    this.detectDominantSide(pilotComp);
    this.calculateTensionDeltas(pilotComp, deltaTime);
    this.updateFlightState(pilotComp);

    // Gérer la rotation de la barre depuis les inputs clavier
    this.updateBarRotation(entityManager, deltaTime);

    // Le pilote maintient la barre de contrôle
    this.applyPilotGrip(entityManager);

    pilotComp.lastUpdateTime = performance.now();
  }

  /**
   * Récupère le composant pilote
   */
  private getPilotComponent(entityManager: EntityManager): PilotComponent | null {
    const pilot = entityManager.getEntity('pilot');
    return pilot?.getComponent<PilotComponent>('pilot') ?? null;
  }

  /**
   * Récupère les composants de ligne
   */
  private getLineComponents(entityManager: EntityManager): { left: LineComponent; right: LineComponent } | null {
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    
    if (!leftLine || !rightLine) return null;
    
    const left = leftLine.getComponent<LineComponent>('line');
    const right = rightLine.getComponent<LineComponent>('line');
    
    if (!left || !right) return null;
    
    return { left, right };
  }

  /**
   * Met à jour les tensions brutes depuis les lignes
   */
  private updateRawTensions(
    pilotComp: PilotComponent, 
    lines: { left: LineComponent; right: LineComponent }
  ): void {
    pilotComp.leftHandRawTension = lines.left.currentTension;
    pilotComp.rightHandRawTension = lines.right.currentTension;
  }

  /**
   * Applique un filtre passe-bas exponentiel aux tensions
   */
  private applyTensionFiltering(pilotComp: PilotComponent): void {
    const alpha = pilotComp.filteringFactor;
    
    pilotComp.leftHandFilteredTension += alpha * (
      pilotComp.leftHandRawTension - pilotComp.leftHandFilteredTension
    );
    pilotComp.rightHandFilteredTension += alpha * (
      pilotComp.rightHandRawTension - pilotComp.rightHandFilteredTension
    );
  }

  /**
   * Calcule l'asymétrie de tension entre les deux mains
   */
  private calculateAsymmetry(pilotComp: PilotComponent): void {
    const totalTension = pilotComp.leftHandFilteredTension + pilotComp.rightHandFilteredTension;
    const MIN_TENSION_THRESHOLD = 0.1;
    
    if (totalTension > MIN_TENSION_THRESHOLD) {
      const diff = Math.abs(pilotComp.leftHandFilteredTension - pilotComp.rightHandFilteredTension);
      pilotComp.asymmetry = (diff / totalTension) * 100;
    } else {
      pilotComp.asymmetry = 0;
    }
    
    pilotComp.totalFeedbackMagnitude = totalTension / 2;
  }

  /**
   * Détecte le côté dominant basé sur la différence de tension
   */
  private detectDominantSide(pilotComp: PilotComponent): void {
    const tensionDiff = pilotComp.leftHandFilteredTension - pilotComp.rightHandFilteredTension;
    const DOMINANCE_THRESHOLD = 5; // 5N
    
    if (Math.abs(tensionDiff) < DOMINANCE_THRESHOLD) {
      pilotComp.dominantSide = 'neutral';
    } else if (tensionDiff > 0) {
      pilotComp.dominantSide = 'left';
    } else {
      pilotComp.dominantSide = 'right';
    }
  }

  /**
   * Calcule les variations de tension (dérivée)
   */
  private calculateTensionDeltas(pilotComp: PilotComponent, deltaTime: number): void {
    if (deltaTime <= 0) return;

    const prevLeftRaw = pilotComp.leftHandRawTension;
    const prevRightRaw = pilotComp.rightHandRawTension;

    pilotComp.leftHandTensionDelta = (pilotComp.leftHandRawTension - prevLeftRaw) / deltaTime;
    pilotComp.rightHandTensionDelta = (pilotComp.rightHandRawTension - prevRightRaw) / deltaTime;
  }

  /**
   * Met à jour la rotation de la barre de contrôle depuis les inputs clavier
   * Rotation autour d'un axe perpendiculaire au vecteur (pivot → milieu_CTRL)
   */
  private updateBarRotation(entityManager: EntityManager, deltaTime: number): void {
    // Récupérer l'input de rotation depuis InputComponent
    const uiEntity = entityManager.query(['Input'])[0];
    if (!uiEntity) {
      console.error('❌ PilotSystem: No entity with Input component found!');
      return;
    }

    const inputComp = uiEntity.getComponent<InputComponent>('Input');
    if (!inputComp) {
      console.error('❌ PilotSystem: InputComponent not found on entity!');
      return;
    }

    // Récupérer la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) {
      console.error('❌ PilotSystem: controlBar entity not found!');
      return;
    }

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    if (!barTransform) return;

    // Récupérer le kite et sa géométrie
    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const kiteGeom = kite.getComponent<GeometryComponent>('geometry');
    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    if (!kiteGeom || !kiteTransform) return;

    // Mettre à jour l'angle de rotation selon l'input (-1, 0, ou 1)
    const rotationInput = inputComp.barRotationInput;
    
    if (rotationInput !== 0) {
      // Appliquer la rotation progressive
      const rotationDelta = rotationInput * this.ROTATION_SPEED * deltaTime;
      this.barRotationAngle = Math.max(
        -this.MAX_ROTATION_ANGLE,
        Math.min(this.MAX_ROTATION_ANGLE, this.barRotationAngle + rotationDelta)
      );
    } else {
      // Retour progressif au centre quand aucun input
      const RETURN_SPEED_FACTOR = 2.0;
      const returnSpeed = this.ROTATION_SPEED * RETURN_SPEED_FACTOR * deltaTime;
      if (Math.abs(this.barRotationAngle) < returnSpeed) {
        this.barRotationAngle = 0;
      } else {
        this.barRotationAngle -= Math.sign(this.barRotationAngle) * returnSpeed;
      }
    }

    // Calculer les positions mondiales des points CTRL
    const ctrlLeftLocal = kiteGeom.getPoint('CTRL_GAUCHE');
    const ctrlRightLocal = kiteGeom.getPoint('CTRL_DROIT');
    
    if (!ctrlLeftLocal || !ctrlRightLocal) {
      // Fallback : rotation autour de l'axe Y si CTRL non trouvés
      const rotationRad = this.barRotationAngle * Math.PI / 180;
      const yAxis = new THREE.Vector3(0, 1, 0);
      barTransform.quaternion.setFromAxisAngle(yAxis, rotationRad);
      return;
    }

    // Convertir les points CTRL en coordonnées monde
    const ctrlLeftWorld = ctrlLeftLocal.clone()
      .applyQuaternion(kiteTransform.quaternion)
      .add(kiteTransform.position);
    const ctrlRightWorld = ctrlRightLocal.clone()
      .applyQuaternion(kiteTransform.quaternion)
      .add(kiteTransform.position);

    // Calculer le milieu des points CTRL
    const ctrlMidpoint = ctrlLeftWorld.clone()
      .add(ctrlRightWorld)
      .multiplyScalar(0.5);

    // Vecteur du pivot de la barre vers le milieu des CTRL
    const toKite = ctrlMidpoint.clone().sub(barTransform.position);
    
    // Si le vecteur est trop court, utiliser l'axe Y par défaut
    if (toKite.lengthSq() < 1e-6) {
      const rotationRad = this.barRotationAngle * Math.PI / 180;
      const yAxis = new THREE.Vector3(0, 1, 0);
      barTransform.quaternion.setFromAxisAngle(yAxis, rotationRad);
      return;
    }
    
    toKite.normalize();

    // Construire une base orthonormale orientée vers le kite
    // forward = direction vers le kite
    // right = axe de rotation (perpendiculaire à toKite et à la verticale)
    // up = perpendiculaire aux deux autres
    const forward = toKite.clone();
    const worldUp = new THREE.Vector3(0, 1, 0);
    
    // Calculer l'axe "right" (gauche-droite de la barre)
    let right = worldUp.clone().cross(forward);
    
    // Cas limite : si toKite est vertical, choisir un axe right par défaut
    if (right.lengthSq() < 1e-6) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    
    // Calculer l'axe "up" local de la barre
    const up = forward.clone().cross(right).normalize();

    // Créer la matrice de rotation de base (barre orientée vers le kite)
    const baseMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
    const baseQuaternion = new THREE.Quaternion().setFromRotationMatrix(baseMatrix);

    // Créer la rotation de contrôle autour de l'axe "right"
    const rotationRad = this.barRotationAngle * Math.PI / 180;
    const controlRotation = new THREE.Quaternion().setFromAxisAngle(right, rotationRad);

    // Composer les deux rotations : orientation de base × rotation de contrôle
    barTransform.quaternion.copy(baseQuaternion).multiply(controlRotation);
  }

  /**
   * Applique la force du pilote qui maintient la barre de contrôle
   * Le pilote agit comme un ressort-amortisseur pour garder la barre en position
   */
  private applyPilotGrip(entityManager: EntityManager): void {
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    const barPhysics = controlBar.getComponent<PhysicsComponent>('physics');

    if (!barTransform || !barPhysics || barPhysics.isKinematic) return;

    // Position cible de la barre (depuis CONFIG)
    const targetPosition = CONFIG.initialization.controlBarPosition.clone();

    // Force de rappel : F = -k × (x - x0) - c × v
    // Le pilote résiste au déplacement de la barre
    const displacement = barTransform.position.clone().sub(targetPosition);
    const PILOT_STIFFNESS = 300; // N/m - Résistance du bras du pilote
    const PILOT_DAMPING = 40; // Ns/m - Amortissement du mouvement

    const springForce = displacement.multiplyScalar(-PILOT_STIFFNESS);
    const dampingForce = barPhysics.velocity.clone().multiplyScalar(-PILOT_DAMPING);

    barPhysics.forces.add(springForce);
    barPhysics.forces.add(dampingForce);
  }

  /**
   * Détermine l'état du vol basé sur les tensions et l'asymétrie
   */
  private updateFlightState(pilotComp: PilotComponent): void {
    const avgTension = pilotComp.totalFeedbackMagnitude;
    const asymmetry = pilotComp.asymmetry;
    
    // Seuils (à calibrer selon le modèle physique)
    const idleThreshold = 10; // N
    const poweredThreshold = 30; // N
    const turningAsymmetryThreshold = 20; // %
    const stallThreshold = 5; // N
    
    if (avgTension < stallThreshold) {
      pilotComp.state = 'stall';
    } else if (avgTension < idleThreshold) {
      pilotComp.state = 'idle';
    } else if (asymmetry > turningAsymmetryThreshold) {
      // En virage
      pilotComp.state = pilotComp.dominantSide === 'left' ? 'turning_left' : 'turning_right';
    } else if (avgTension > poweredThreshold) {
      pilotComp.state = 'powered';
    } else {
      pilotComp.state = 'idle';
    }
  }
  
  reset(): void {
    // Rien à réinitialiser au niveau du système
  }
  
  dispose(): void {
    // Rien à disposer
  }
}

```

---

## Fichier: `ecs/systems/RenderSystem.ts`

```typescript
/**
 * RenderSystem.ts - Affichage Three.js (scene + camera + renderer)
 * 
 * Synchronise la scène Three.js avec les MeshComponent et rend la frame.
 * Priorité 70 (dernier système visuel).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { TransformComponent } from '../components/TransformComponent';
import { MeshComponent } from '../components/MeshComponent';
import { RenderConfig } from '../config/Config';

export class RenderSystem extends System {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  private readonly addedMeshes = new Set<string>();
  
  constructor(canvas?: HTMLCanvasElement) {
    super('RenderSystem', 70);
    
    // Créer scène
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Bleu ciel
    
    // Créer caméra
    // Position pour voir : pilote(0,0,0), barre(0,1,-0.6), kite(0,11,-15.6)
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Position trouvée manuellement pour voir pilote ET kite ensemble
    this.camera.position.set(RenderConfig.CAMERA_POSITION_X, RenderConfig.CAMERA_POSITION_Y, RenderConfig.CAMERA_POSITION_Z);
    this.camera.lookAt(RenderConfig.CAMERA_LOOKAT_X, RenderConfig.CAMERA_LOOKAT_Y, RenderConfig.CAMERA_LOOKAT_Z);
    
    // Créer renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Lumière
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
    
    // Resize handler
    window.addEventListener('resize', () => this.onResize());
  }
  
  initialize(_entityManager: EntityManager): void {
    // Rien à faire, la scène est déjà créée
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
    // Pour toutes les entités avec mesh + transform
    const entities = entityManager.query(['transform', 'mesh']);
    
    entities.forEach(entity => {
      const transform = entity.getComponent<TransformComponent>('transform')!;
      const mesh = entity.getComponent<MeshComponent>('mesh')!;
      
      // Ajouter à la scène si pas encore fait (tracker par UUID du mesh)
      if (!this.addedMeshes.has(mesh.object3D.uuid)) {
        this.scene.add(mesh.object3D);
        this.addedMeshes.add(mesh.object3D.uuid);
      }

      // Synchroniser transform
      mesh.object3D.position.copy(transform.position);
      mesh.object3D.quaternion.copy(transform.quaternion);
      mesh.object3D.scale.copy(transform.scale);
    });
    
    // Rendre la frame
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose(): void {
    this.renderer.dispose();
    this.addedMeshes.clear();
  }

  /**
   * Réinitialise l'état du rendu (appelé lors d'un reset)
   * Nettoie UNIQUEMENT les meshes des entités (kite, lignes, etc)
   * Garde l'environnement (sol, ciel, éclairage)
   */
  resetRenderState(): void {
    // On ne supprime que les meshes correspondant aux IDs des entités ECS
    // Les objets de l'environnement ne sont pas dans addedMeshes
    const meshesToRemove: THREE.Object3D[] = [];
    
    // Parcourir la scène et supprimer UNIQUEMENT les meshes qui correspondent aux IDs des entités
    this.scene.traverse(obj => {
      // Vérifier si cet objet correspond à une entité connue
      if (this.addedMeshes.has(obj.uuid)) {
        meshesToRemove.push(obj);
      }
    });
    
    meshesToRemove.forEach(mesh => {
      // Disposer les géométries et matériaux
      if (mesh instanceof THREE.Mesh) {
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
      this.scene.remove(mesh);
    });
    
    // Nettoyer le Set de tracking
    this.addedMeshes.clear();
  }
  
  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /**
   * Accès au canvas (pour l'attacher au DOM)
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}

```

---

## Fichier: `ecs/systems/SimulationLogger.ts`

```typescript
/**
 * SimulationLogger.ts - Système de logging structuré pour la simulation
 *
 * Traçabilité complète de l'évolution de la simulation:
 * - Positions (barre, handles, lignes, CTRL, spine)
 * - Forces et orientation des faces
 * - Tensions des lignes
 * - Rotation du kite
 *
 * Priorité 45 (APRÈS ConstraintSystem, AVANT PhysicsSystem)
 */

import * as THREE from 'three';
import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { LineComponent } from '../components/LineComponent';
import { BridleComponent } from '../components/BridleComponent';

const PRIORITY = 45;

interface LogEntry {
  frameNumber: number;
  timestamp: number;
  constraintMode: 'pbd' | 'spring-force';
  aeroMode: 'perso' | 'nasa';
  barRotation: number;
  barHandles: {
    left: THREE.Vector3;
    right: THREE.Vector3;
  };
  lineDistances: {
    left: number;
    right: number;
  };
  lineTensions: {
    left: number;
    right: number;
  };
  ctrlPoints: {
    gauche: THREE.Vector3;
    droit: THREE.Vector3;
  };
  kitePosition: THREE.Vector3;
  kiteRotation: {
    quaternion: THREE.Quaternion;
    euler: { pitch: number; roll: number; yaw: number };
  };
  spineDirection: THREE.Vector3;
  kiteVelocity: THREE.Vector3;
  kiteAngularVelocity: THREE.Vector3;
  forces: {
    total: THREE.Vector3;
    left: THREE.Vector3;
    right: THREE.Vector3;
    gravity: THREE.Vector3;
    aero: THREE.Vector3;
  };
  torques: {
    total: THREE.Vector3;
    constraint: THREE.Vector3;
    aero: THREE.Vector3;
  };
  faces: Array<{
    id: string;
    centroid: THREE.Vector3;
    normal: THREE.Vector3;
    liftVector: THREE.Vector3;
    dragVector: THREE.Vector3;
    apparentWind: THREE.Vector3;
    liftMagnitude: number;
    dragMagnitude: number;
    angleOfAttack: number;
  }>;
  windState?: {
    ambient: THREE.Vector3;
    speed: number;
    direction: THREE.Vector3;
  };
  bridles: {
    nez: number;
    inter: number;
    centre: number;
  };
}

export class SimulationLogger extends System {
  private frameNumber = 0;
  private logHistory: LogEntry[] = [];
  private lastLogTime = 0;
  private logInterval = 1000; // Log tous les 1000ms (1 seconde) - état système
  private isLogging = false;
  private logBuffer: string[] = [];

  constructor() {
    super('SimulationLogger', PRIORITY);
  }

  initialize(entityManager: EntityManager): void {
    console.log('📊 [SimulationLogger] Initialized - ready to log simulation');
    this.isLogging = true;
  }

  update(context: SimulationContext): void {
    if (!this.isLogging) return;

    const now = performance.now();
    if (now - this.lastLogTime < this.logInterval) return;

    this.lastLogTime = now;
    this.frameNumber++;

    const { entityManager, deltaTime } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const ui = entityManager.query(['Input'])[0]; // Récupérer l'entité UI pour les modes

    if (!kite || !controlBar || !ui) return;
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) return;

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    const kiteBridle = kite.getComponent<BridleComponent>('bridle');

    if (
      !kiteTransform ||
      !kitePhysics ||
      !kiteGeometry ||
      !barTransform ||
      !barGeometry ||
      !leftLineComp ||
      !rightLineComp
    ) {
      return;
    }

    // Récupérer les modes depuis le composant Input
    const inputComp = ui.getComponent('Input') as any;
    const constraintMode = inputComp?.constraintMode ?? 'spring-force';
    const aeroMode = inputComp?.aeroMode ?? 'perso';

    // Collecter toutes les données
    const entry = this.collectLogEntry(
      kite,
      controlBar,
      kiteTransform,
      kitePhysics,
      kiteGeometry,
      barTransform,
      barGeometry,
      leftLineComp,
      rightLineComp,
      kiteBridle,
      constraintMode,
      aeroMode
    );

    this.logHistory.push(entry);
    this.formatAndPrint(entry);
  }

  private collectLogEntry(
    kite: any,
    controlBar: any,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    kiteGeometry: GeometryComponent,
    barTransform: TransformComponent,
    barGeometry: GeometryComponent,
    leftLineComp: LineComponent,
    rightLineComp: LineComponent,
    kiteBridle: BridleComponent | null | undefined,
    constraintMode: 'pbd' | 'spring-force',
    aeroMode: 'perso' | 'nasa'
  ): LogEntry {
    // Bar rotation
    const barEuler = new THREE.Euler().setFromQuaternion(barTransform.quaternion);
    const barRotationDeg = (barEuler.y * 180) / Math.PI;

    // Bar handles
    const barLeft = barGeometry.getPointWorld('leftHandle', controlBar) || new THREE.Vector3();
    const barRight = barGeometry.getPointWorld('rightHandle', controlBar) || new THREE.Vector3();

    // CTRL points
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite) || new THREE.Vector3();
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite) || new THREE.Vector3();

    // Line distances
    const lineDistLeft = barLeft.distanceTo(ctrlGauche);
    const lineDistRight = barRight.distanceTo(ctrlDroit);

    // Spine direction
    const spineBase = kiteGeometry.getPointWorld('SPINE_BAS', kite) || new THREE.Vector3();
    const spineTop = kiteGeometry.getPointWorld('NEZ', kite) || new THREE.Vector3();
    const spineDir = new THREE.Vector3().subVectors(spineTop, spineBase);
    if (spineDir.length() > 0.001) {
      spineDir.normalize();
    }

    // Kite euler angles
    const kiteEuler = new THREE.Euler().setFromQuaternion(kiteTransform.quaternion);

    // Extract forces
    const totalForce = kitePhysics.forces.clone();
    const leftLineForce = leftLineComp.currentTension > 0 ? 1 : 0; // Simplifié
    const rightLineForce = rightLineComp.currentTension > 0 ? 1 : 0;

    const entry: LogEntry = {
      frameNumber: this.frameNumber,
      timestamp: performance.now(),
      constraintMode: constraintMode,
      aeroMode: aeroMode,
      barRotation: barRotationDeg,
      barHandles: {
        left: barLeft.clone(),
        right: barRight.clone(),
      },
      lineDistances: {
        left: lineDistLeft,
        right: lineDistRight,
      },
      lineTensions: {
        left: leftLineComp.currentTension,
        right: rightLineComp.currentTension,
      },
      ctrlPoints: {
        gauche: ctrlGauche.clone(),
        droit: ctrlDroit.clone(),
      },
      kitePosition: kiteTransform.position.clone(),
      kiteRotation: {
        quaternion: kiteTransform.quaternion.clone(),
        euler: {
          pitch: (kiteEuler.x * 180) / Math.PI,
          roll: (kiteEuler.z * 180) / Math.PI,
          yaw: (kiteEuler.y * 180) / Math.PI,
        },
      },
      spineDirection: spineDir.clone(),
      kiteVelocity: kitePhysics.velocity.clone(),
      kiteAngularVelocity: kitePhysics.angularVelocity.clone(),
      forces: {
        total: totalForce,
        left: new THREE.Vector3(leftLineForce, 0, 0),
        right: new THREE.Vector3(rightLineForce, 0, 0),
        gravity: new THREE.Vector3(0, -9.81 * kitePhysics.mass, 0),
        aero: new THREE.Vector3(0, 0, 0), // À récupérer depuis AeroSystem
      },
      torques: {
        total: kitePhysics.torques.clone(),
        constraint: new THREE.Vector3(0, 0, 0), // À calculer
        aero: new THREE.Vector3(0, 0, 0), // À récupérer
      },
      faces: this.collectFaceData(kitePhysics),
      windState: this.collectWindState(kitePhysics),
      bridles: kiteBridle
        ? {
            nez: kiteBridle.lengths.nez,
            inter: kiteBridle.lengths.inter,
            centre: kiteBridle.lengths.centre,
          }
        : { nez: 0, inter: 0, centre: 0 },
    };

    return entry;
  }

  /**
   * Collecte les données aérodynamiques depuis kitePhysics.faceForces
   */
  private collectFaceData(kitePhysics: PhysicsComponent): Array<{
    id: string;
    centroid: THREE.Vector3;
    normal: THREE.Vector3;
    liftVector: THREE.Vector3;
    dragVector: THREE.Vector3;
    apparentWind: THREE.Vector3;
    liftMagnitude: number;
    dragMagnitude: number;
    angleOfAttack: number;
  }> {
    if (!kitePhysics.faceForces || kitePhysics.faceForces.length === 0) {
      return [];
    }

    return kitePhysics.faceForces.map((face) => {
      const liftMag = face.lift.length();
      const dragMag = face.drag.length();
      
      // Calculer l'angle d'attaque depuis les vecteurs
      const windDir = face.apparentWind.clone().normalize();
      const dotNW = Math.abs(face.normal.dot(windDir));
      const alphaRad = Math.acos(Math.max(0.0, Math.min(1.0, dotNW)));
      const alphaDeg = alphaRad * 180 / Math.PI;

      return {
        id: face.name,
        centroid: face.centroid.clone(),
        normal: face.normal.clone(),
        liftVector: face.lift.clone(),
        dragVector: face.drag.clone(),
        apparentWind: face.apparentWind.clone(),
        liftMagnitude: liftMag,
        dragMagnitude: dragMag,
        angleOfAttack: alphaDeg,
      };
    });
  }

  /**
   * Collecte l'état du vent global (si disponible)
   */
  private collectWindState(kitePhysics: PhysicsComponent): {
    ambient: THREE.Vector3;
    speed: number;
    direction: THREE.Vector3;
  } | undefined {
    // Récupérer le vent ambiant depuis le premier faceForce (tous partagent le même vent ambiant)
    // Note: Le vent apparent varie selon la position, mais le vent ambiant est global
    // Pour l'instant, on utilise une approximation
    return undefined; // À améliorer si nécessaire
  }

  private formatAndPrint(entry: LogEntry): void {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(120)}`);
    lines.push(
      `📊 FRAME ${entry.frameNumber} | ${new Date(entry.timestamp).toLocaleTimeString()}`
    );
    lines.push(`${'='.repeat(120)}`);

    // Modes
    lines.push(`\n⚙️  MODES:`);
    lines.push(`  Constraint: ${entry.constraintMode} | Aero: ${entry.aeroMode}`);

    // Bar state
    lines.push(`\n🎮 BAR STATE:`);
    lines.push(`  Rotation: ${entry.barRotation.toFixed(2)}°`);
    lines.push(
      `  Handle Left: (${entry.barHandles.left.x.toFixed(3)}, ${entry.barHandles.left.y.toFixed(3)}, ${entry.barHandles.left.z.toFixed(3)})`
    );
    lines.push(
      `  Handle Right: (${entry.barHandles.right.x.toFixed(3)}, ${entry.barHandles.right.y.toFixed(3)}, ${entry.barHandles.right.z.toFixed(3)})`
    );

    // Lines
    lines.push(`\n🔗 LINES:`);
    lines.push(
      `  Left: distance=${entry.lineDistances.left.toFixed(3)}m, tension=${entry.lineTensions.left.toFixed(2)}N`
    );
    lines.push(
      `  Right: distance=${entry.lineDistances.right.toFixed(3)}m, tension=${entry.lineTensions.right.toFixed(2)}N`
    );
    const asymmetry = Math.abs(entry.lineTensions.left - entry.lineTensions.right);
    lines.push(`  Asymmetry: ΔT = ${asymmetry.toFixed(2)}N`);

    // CTRL points
    lines.push(`\n🎯 CTRL POINTS:`);
    lines.push(
      `  Left: (${entry.ctrlPoints.gauche.x.toFixed(3)}, ${entry.ctrlPoints.gauche.y.toFixed(3)}, ${entry.ctrlPoints.gauche.z.toFixed(3)})`
    );
    lines.push(
      `  Right: (${entry.ctrlPoints.droit.x.toFixed(3)}, ${entry.ctrlPoints.droit.y.toFixed(3)}, ${entry.ctrlPoints.droit.z.toFixed(3)})`
    );

    // Kite position and rotation
    lines.push(`\n🪁 KITE STATE:`);
    lines.push(
      `  Position: (${entry.kitePosition.x.toFixed(3)}, ${entry.kitePosition.y.toFixed(3)}, ${entry.kitePosition.z.toFixed(3)})`
    );
    lines.push(
      `  Velocity: (${entry.kiteVelocity.x.toFixed(3)}, ${entry.kiteVelocity.y.toFixed(3)}, ${entry.kiteVelocity.z.toFixed(3)}) m/s`
    );
    lines.push(
      `  Rotation (Euler): pitch=${entry.kiteRotation.euler.pitch.toFixed(2)}°, roll=${entry.kiteRotation.euler.roll.toFixed(2)}°, yaw=${entry.kiteRotation.euler.yaw.toFixed(2)}°`
    );
    lines.push(
      `  Spine Direction: (${entry.spineDirection.x.toFixed(3)}, ${entry.spineDirection.y.toFixed(3)}, ${entry.spineDirection.z.toFixed(3)})`
    );

    // Angular velocity
    lines.push(`\n⚙️ ANGULAR DYNAMICS:`);
    lines.push(
      `  ω: (${entry.kiteAngularVelocity.x.toFixed(4)}, ${entry.kiteAngularVelocity.y.toFixed(4)}, ${entry.kiteAngularVelocity.z.toFixed(4)}) rad/s`
    );
    lines.push(
      `  τ_total: (${entry.torques.total.x.toFixed(3)}, ${entry.torques.total.y.toFixed(3)}, ${entry.torques.total.z.toFixed(3)}) N⋅m`
    );
    lines.push(`  |τ_total|: ${entry.torques.total.length().toFixed(3)} N⋅m`);

    // Forces
    lines.push(`\n⚡ FORCES:`);
    lines.push(
      `  Total: (${entry.forces.total.x.toFixed(3)}, ${entry.forces.total.y.toFixed(3)}, ${entry.forces.total.z.toFixed(3)}) N`
    );
    lines.push(
      `  Gravity: (${entry.forces.gravity.x.toFixed(3)}, ${entry.forces.gravity.y.toFixed(3)}, ${entry.forces.gravity.z.toFixed(3)}) N`
    );

    // Aero forces par surface (détaillé)
    if (entry.faces && entry.faces.length > 0) {
      lines.push(`\n🌬️  AERODYNAMICS (${entry.faces.length} surfaces):`);
      
      entry.faces.forEach((face, idx) => {
        lines.push(`\n  ━━━ Surface ${idx + 1}: ${face.id} ━━━`);
        lines.push(`    📍 CP: (${face.centroid.x.toFixed(2)}, ${face.centroid.y.toFixed(2)}, ${face.centroid.z.toFixed(2)})`);
        lines.push(`    📐 α = ${face.angleOfAttack.toFixed(1)}°`);
        
        // Normale (direction perpendiculaire à la surface)
        lines.push(`    🔶 Normal: (${face.normal.x.toFixed(3)}, ${face.normal.y.toFixed(3)}, ${face.normal.z.toFixed(3)})`);
        
        // Vent apparent local
        const windSpeed = face.apparentWind.length();
        const windDir = face.apparentWind.clone().normalize();
        lines.push(`    💨 Wind apparent: ${windSpeed.toFixed(2)} m/s`);
        lines.push(`       Direction: (${windDir.x.toFixed(3)}, ${windDir.y.toFixed(3)}, ${windDir.z.toFixed(3)})`);
        
        // Portance (perpendiculaire au vent)
        const liftDir = face.liftVector.clone().normalize();
        lines.push(`    ⬆️  Lift: ${face.liftMagnitude.toFixed(2)} N`);
        lines.push(`       Direction: (${liftDir.x.toFixed(3)}, ${liftDir.y.toFixed(3)}, ${liftDir.z.toFixed(3)})`);
        
        // Traînée (parallèle au vent)
        const dragDir = face.dragVector.clone().normalize();
        lines.push(`    ⬅️  Drag: ${face.dragMagnitude.toFixed(2)} N`);
        lines.push(`       Direction: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)})`);
        
        // Vérification orthogonalité (lift ⊥ wind)
        const liftWindDot = liftDir.dot(windDir);
        const orthogonality = Math.abs(liftWindDot);
        lines.push(`    ✓ Lift⊥Wind: ${orthogonality < 0.01 ? '✅' : '⚠️'} (dot=${liftWindDot.toFixed(4)})`);
      });
    }

    // Bridles
    lines.push(`\n🌉 BRIDLES:`);
    lines.push(
      `  Nez: ${entry.bridles.nez.toFixed(3)}m, Inter: ${entry.bridles.inter.toFixed(3)}m, Centre: ${entry.bridles.centre.toFixed(3)}m`
    );

    lines.push(`${'='.repeat(120)}\n`);

    // Afficher et stocker
    const fullLog = lines.join('\n');
    console.log(fullLog);
    this.logBuffer.push(fullLog);
  }

  /**
   * Exporte l'historique de la simulation en JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Exporte l'historique en CSV pour analyse dans Excel/R
   */
  exportAsCSV(): string {
    if (this.logHistory.length === 0) return '';

    const headers = [
      'frame',
      'timestamp',
      'barRotation',
      'barHandleLeftX',
      'barHandleLeftY',
      'barHandleLeftZ',
      'barHandleRightX',
      'barHandleRightY',
      'barHandleRightZ',
      'lineDistLeft',
      'lineDistRight',
      'lineTensionLeft',
      'lineTensionRight',
      'ctrlLeftX',
      'ctrlLeftY',
      'ctrlLeftZ',
      'ctrlRightX',
      'ctrlRightY',
      'ctrlRightZ',
      'kitePositionX',
      'kitePositionY',
      'kitePositionZ',
      'kiteVelocityX',
      'kiteVelocityY',
      'kiteVelocityZ',
      'kiteRotationPitch',
      'kiteRotationRoll',
      'kiteRotationYaw',
      'spineDirectionX',
      'spineDirectionY',
      'spineDirectionZ',
      'angularVelocityX',
      'angularVelocityY',
      'angularVelocityZ',
      'torqueTotalX',
      'torqueTotalY',
      'torqueTotalZ',
      'bridleNez',
      'bridleInter',
      'bridleCentre',
    ];

    const rows = this.logHistory.map((entry) => [
      entry.frameNumber,
      entry.timestamp,
      entry.barRotation,
      entry.barHandles.left.x,
      entry.barHandles.left.y,
      entry.barHandles.left.z,
      entry.barHandles.right.x,
      entry.barHandles.right.y,
      entry.barHandles.right.z,
      entry.lineDistances.left,
      entry.lineDistances.right,
      entry.lineTensions.left,
      entry.lineTensions.right,
      entry.ctrlPoints.gauche.x,
      entry.ctrlPoints.gauche.y,
      entry.ctrlPoints.gauche.z,
      entry.ctrlPoints.droit.x,
      entry.ctrlPoints.droit.y,
      entry.ctrlPoints.droit.z,
      entry.kitePosition.x,
      entry.kitePosition.y,
      entry.kitePosition.z,
      entry.kiteVelocity.x,
      entry.kiteVelocity.y,
      entry.kiteVelocity.z,
      entry.kiteRotation.euler.pitch,
      entry.kiteRotation.euler.roll,
      entry.kiteRotation.euler.yaw,
      entry.spineDirection.x,
      entry.spineDirection.y,
      entry.spineDirection.z,
      entry.kiteAngularVelocity.x,
      entry.kiteAngularVelocity.y,
      entry.kiteAngularVelocity.z,
      entry.torques.total.x,
      entry.torques.total.y,
      entry.torques.total.z,
      entry.bridles.nez,
      entry.bridles.inter,
      entry.bridles.centre,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((v) => (typeof v === 'number' ? v.toFixed(6) : v)).join(','))].join('\n');

    return csv;
  }

  /**
   * Arrête le logging et exporte les données
   */
  stopAndExport(): { json: string; csv: string } {
    this.isLogging = false;
    return {
      json: this.exportAsJSON(),
      csv: this.exportAsCSV(),
    };
  }

  /**
   * Retourne l'historique complet
   */
  getHistory(): LogEntry[] {
    return this.logHistory;
  }

  /**
   * Retourne le buffer de logs formatés
   */
  getFormattedLogs(): string {
    return this.logBuffer.join('\n');
  }
}

```

---

## Fichier: `ecs/systems/SimulationLoggerHelper.ts`

```typescript
/**
 * SimulationLoggerHelper.ts - Helpers pour accéder au logger depuis le console/UI
 *
 * Expose des fonctions globales pour contrôler le logging:
 * - window.startLogging()
 * - window.stopLogging()
 * - window.exportLogs()
 */

import { SimulationLogger } from './SimulationLogger';

export class SimulationLoggerHelper {
  private static instance: SimulationLogger | null = null;

  static setLogger(logger: SimulationLogger): void {
    this.instance = logger;
    
    // Exposer globalement
    (window as any).kiteLogger = {
      stop: () => {
        console.log('📊 Arrêt du logging et export des données...');
        if (!SimulationLoggerHelper.instance) return;
        
        const { json, csv } = SimulationLoggerHelper.instance.stopAndExport();
        
        // Télécharger JSON
        this.downloadFile(json, 'simulation-log.json', 'application/json');
        
        // Télécharger CSV
        this.downloadFile(csv, 'simulation-log.csv', 'text/csv');
        
        console.log('✅ Fichiers exportés !');
        console.log('  - simulation-log.json');
        console.log('  - simulation-log.csv');
      },
      
      getHistory: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return [];
        }
        return SimulationLoggerHelper.instance.getHistory();
      },
      
      getLogs: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return '';
        }
        return SimulationLoggerHelper.instance.getFormattedLogs();
      },
      
      printLogs: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        console.log(SimulationLoggerHelper.instance.getFormattedLogs());
      },
      
      exportJSON: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        const json = SimulationLoggerHelper.instance.exportAsJSON();
        this.downloadFile(json, 'simulation-log.json', 'application/json');
        console.log('✅ simulation-log.json téléchargé');
      },
      
      exportCSV: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        const csv = SimulationLoggerHelper.instance.exportAsCSV();
        this.downloadFile(csv, 'simulation-log.csv', 'text/csv');
        console.log('✅ simulation-log.csv téléchargé');
      },
    };
    
    console.log('📊 [SimulationLogger] Exposed as window.kiteLogger');
    console.log('  - kiteLogger.stop()    : Arrêter et exporter');
    console.log('  - kiteLogger.exportJSON()');
    console.log('  - kiteLogger.exportCSV()');
    console.log('  - kiteLogger.getHistory()');
  }

  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

```

---

## Fichier: `ecs/systems/TetherSystem.ts`

```typescript
/**
 * TetherSystem.ts - Système de lignes inextensibles ultra-simplifié
 *
 * PHYSIQUE ULTRA-SIMPLE D'UNE LIGNE DE KITE:
 * ═══════════════════════════════════════════
 *
 * 1. DEUX POINTS A et B avec longueur maximale L
 * 2. COMPLÈTEMENT FLEXIBLE quand distance < L (aucune force)
 * 3. DROITE/INEXTENSIBLE quand distance >= L
 * 4. TRANSFERT TRACTION BIDIRECTIONNEL (tire mais ne pousse pas)
 *
 * ALGORITHME ULTRA-SIMPLE:
 * ────────────────────────
 * Pour chaque ligne (A ↔ B):
 *
 *   if distance < maxLength:
 *       return; // Complètement flexible, aucune force
 *
 *   // distance >= maxLength → ligne tendue
 *   direction = normalize(B - A)
 *
 *   // Vérifier si le kite s'éloigne (pour éviter de pousser)
 *   v_radial = velocity_B · direction
 *   if v_radial < 0: // Kite s'éloigne
 *       force = K × (distance - maxLength) × direction
 *       appliquer force au point B (vers A)
 *
 * C'EST TOUT ! Pas de ressort, pas de damping complexe.
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { PhysicsConstants, ConstraintConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

const PRIORITY = 40;

export class TetherSystem extends System {
  constructor() {
    super('TetherSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer les entités
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry || kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Points d'attache du kite (CTRL_GAUCHE et CTRL_DROIT)
    const ctrlLeft = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlRight = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    // Points d'attache de la barre (poignets)
    const poignetGauche = barGeometry.getPointWorld('poignet_gauche', controlBar);
    const poignetDroit = barGeometry.getPointWorld('poignet_droit', controlBar);

    if (!ctrlLeft || !ctrlRight || !poignetGauche || !poignetDroit) {
      return;
    }

    // Composants des lignes
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    // === LIGNE GAUCHE ===
    this.solveSimpleTether({
      pointA: poignetGauche,      // Poignet gauche (X<0)
      pointB: ctrlLeft,        // CTRL gauche sur kite (X<0)
      maxLength: leftLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: leftLineComp
    });

    // === LIGNE DROITE ===
    this.solveSimpleTether({
      pointA: poignetDroit,     // Poignet droit (X>0)
      pointB: ctrlRight,       // CTRL droit sur kite (X>0)
      maxLength: rightLineComp.restLength,
      kiteTransform,
      kitePhysics,
      lineComponent: rightLineComp
    });

    // === COLLISION SOL ===
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Résout une contrainte de ligne ultra-simple
   *
   * ALGORITHME ULTRA-SIMPLE:
   * 1. Si distance < maxLength → aucune force (complètement flexible)
   * 2. Si distance >= maxLength ET kite s'éloigne → force de rappel douce
   */
  private solveSimpleTether(params: {
    pointA: THREE.Vector3;
    pointB: THREE.Vector3;
    maxLength: number;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    lineComponent: LineComponent;
  }): void {
    const { pointA, pointB, maxLength, kiteTransform, kitePhysics, lineComponent } = params;

    // Calculer distance et direction
    const diff = pointB.clone().sub(pointA); // De A vers B
    const distance = diff.length();

    if (distance < PhysicsConstants.EPSILON) {
      return;
    }

    // Mettre à jour la longueur actuelle
    lineComponent.currentLength = distance;

    // ═══════════════════════════════════════════════════════════════════════
    // LOGIQUE ULTRA-SIMPLE
    // ═══════════════════════════════════════════════════════════════════════

    // 1. COMPLÈTEMENT FLEXIBLE si distance < maxLength
    if (distance < maxLength) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return; // ✅ AUCUNE FORCE
    }

    // 2. DROITE/INEXTENSIBLE si distance >= maxLength
    lineComponent.state.isTaut = true;
    const excess = distance - maxLength;
    
    lineComponent.state.elongation = excess;
    lineComponent.state.strainRatio = excess / maxLength;

    // Direction normalisée de B vers A (pour tirer B vers A)
    const direction = diff.clone().normalize();

    // ═══════════════════════════════════════════════════════════════════════
    // MODÈLE PHYSIQUE: RESSORT-AMORTISSEUR DOUX
    // ═══════════════════════════════════════════════════════════════════════

    // Calculer la vitesse du point B (sur le kite)
    const r = pointB.clone().sub(kiteTransform.position); // Bras de levier
    const angularContribution = new THREE.Vector3()
      .crossVectors(kitePhysics.angularVelocity, r);
    const pointVelocity = kitePhysics.velocity.clone().add(angularContribution);

    // Vitesse radiale : composante le long de la ligne (positive si s'éloigne de A)
    const v_radial = pointVelocity.dot(direction);

    // === FORCE RESSORT (Loi de Hooke) - Utilise élongation RÉELLE ===
    // LINE_STIFFNESS = 50 N/m (très doux)
    // À 1m excès → 50N, à 5m excès → 250N (progressif et stable)
    const springForce = ConstraintConfig.LINE_STIFFNESS * excess;

    // === FORCE DAMPING (Amortissement ABSOLU) ===
    // ABSOLUTE_DAMPING = 2 N·s/m (indépendant de la rigidité)
    // À 1 m/s → 2N, à 10 m/s → 20N (pas d'explosion comme avant!)
    // Ne s'applique QUE si le kite s'éloigne (v_radial > 0)
    const dampingForce = v_radial > 0 
      ? ConstraintConfig.ABSOLUTE_DAMPING * v_radial
      : 0;

    // === FORCE TOTALE ===
    const totalForce = springForce + dampingForce;

    // Les lignes ne poussent pas, seulement tirent (contrainte unilatérale)
    if (totalForce > 0) {
      // Limiter la force pour éviter les explosions numériques
      const clampedTension = Math.min(totalForce, ConstraintConfig.MAX_CONSTRAINT_FORCE);

      // Appliquer force au point B (vers A, pour rapprocher)
      const force = direction.clone().multiplyScalar(-clampedTension);

      // Appliquer au kite (point B)
      kitePhysics.forces.add(force);

      // Générer torque (utilise fonction centralisée MathUtils)
      const torque = MathUtils.computeTorque(pointB, kiteTransform.position, force);
      kitePhysics.torques.add(torque);

      // Mettre à jour tension pour visualisation
      lineComponent.currentTension = clampedTension;
    } else {
      // Pas de force (ne devrait jamais arriver car springForce > 0 si excess > 0)
      lineComponent.currentTension = 0;
    }
  }

  /**
   * Gère la collision avec le sol (Y = 0)
   */
  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;

      // Annuler la vitesse verticale descendante
      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}

```

---

## Fichier: `ecs/systems/UISystem.ts`

```typescript
import * as THREE from 'three';

import { System, type SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { InputComponent } from '../components/InputComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { TransformComponent } from '../components/TransformComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { LineComponent } from '../components/LineComponent';
import { Entity } from '../core/Entity';
import { Logger } from '../utils/Logging';
import { UI_METADATA } from '../config/UIConfig';
import { UIConfig } from '../config/Config';

// Constantes UI
const DECIMAL_PRECISION_VELOCITY = UIConfig.DECIMAL_PRECISION_VELOCITY;
const DECIMAL_PRECISION_POSITION = UIConfig.DECIMAL_PRECISION_POSITION;
const DECIMAL_PRECISION_ANGLE = UIConfig.DECIMAL_PRECISION_ANGLE;
const MS_TO_KMH = UIConfig.MS_TO_KMH;

interface SliderConfig {
  id: string;
  min: number;
  max: number;
  step: number;
  formatter: (value: number) => string;
  property: keyof InputComponent;
}

/**
 * Gère la création et la mise à jour de l'interface utilisateur (DOM).
 * Lit les composants de simulation pour afficher les données et
 * met à jour le InputComponent en réponse aux actions de l'utilisateur.
 */
export class UISystem extends System {
  private inputComponent!: InputComponent;
  private kiteEntity: Entity | null = null;
  private readonly logger = Logger.getInstance();
  private buttonsInitialized = false; // Flag pour éviter les doublons d'event listeners

  constructor() {
    super('Input', UIConfig.PRIORITY);
  }

  async initialize(entityManager: EntityManager): Promise<void> {
    const uiEntity = entityManager.query(['Input'])[0];
    if (uiEntity) {
      const component = uiEntity.getComponent<InputComponent>(InputComponent.type);
      if (component) {
        this.inputComponent = component;
        this.logger.info('InputComponent found', 'UISystem');
      }
    }

    // Chercher l'entité du cerf-volant (kite)
    this.kiteEntity = entityManager.getEntity('kite') ?? null;

    if (this.kiteEntity) {
      this.logger.info('Kite entity found in initialize: ' + this.kiteEntity.id, 'UISystem');
    } else {
      this.logger.warn('Kite entity not found in initialize', 'UISystem');
    }

    // Initialiser les boutons une seule fois (ils se réfèrent à l'InputComponent qui peut changer)
    if (!this.buttonsInitialized) {
      this.setupButtons();
      this.buttonsInitialized = true;
    }

    this.initUI();
  }

  // eslint-disable-next-line max-lines-per-function
  private initUI(): void {
    const sliders = this.getSliderConfigs();
    // Initialiser tous les sliders
    sliders.forEach(config => this.setupSlider(config));
  }

  private getSliderConfigs(): SliderConfig[] {
    const meta = UI_METADATA;

    return [
      // === Vent ===
      {
        id: 'wind-speed-slider',
        min: meta.wind.speed.min,
        max: meta.wind.speed.max,
        step: meta.wind.speed.step,
        formatter: (v) => `${v.toFixed(1)} ${meta.wind.speed.unit}`,
        property: 'windSpeed'
      },
      {
        id: 'wind-direction-slider',
        min: meta.wind.direction.min,
        max: meta.wind.direction.max,
        step: meta.wind.direction.step,
        formatter: (v) => `${v.toFixed(0)}${meta.wind.direction.unit}`,
        property: 'windDirection'
      },
      {
        id: 'wind-turbulence-slider',
        min: meta.wind.turbulence.min,
        max: meta.wind.turbulence.max,
        step: meta.wind.turbulence.step,
        formatter: (v) => `${v.toFixed(0)}${meta.wind.turbulence.unit}`,
        property: 'windTurbulence'
      },

      // === Lignes ===
      {
        id: 'line-length-slider',
        min: meta.lines.length.min,
        max: meta.lines.length.max,
        step: meta.lines.length.step,
        formatter: (v) => `${v.toFixed(0)}${meta.lines.length.unit}`,
        property: 'lineLength'
      },
      {
        id: 'bridle-nez-slider',
        min: meta.lines.bridles.nez.min,
        max: meta.lines.bridles.nez.max,
        step: meta.lines.bridles.nez.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.nez.unit}`,
        property: 'bridleNez'
      },
      {
        id: 'bridle-inter-slider',
        min: meta.lines.bridles.inter.min,
        max: meta.lines.bridles.inter.max,
        step: meta.lines.bridles.inter.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.inter.unit}`,
        property: 'bridleInter'
      },
      {
        id: 'bridle-centre-slider',
        min: meta.lines.bridles.centre.min,
        max: meta.lines.bridles.centre.max,
        step: meta.lines.bridles.centre.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.centre.unit}`,
        property: 'bridleCentre'
      },

      // === Physique ===
      {
        id: 'linear-damping-slider',
        min: meta.physics.linearDamping.min,
        max: meta.physics.linearDamping.max,
        step: meta.physics.linearDamping.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'linearDamping'
      },
      {
        id: 'angular-damping-slider',
        min: meta.physics.angularDamping.min,
        max: meta.physics.angularDamping.max,
        step: meta.physics.angularDamping.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'angularDamping'
      },
      {
        id: 'mesh-subdivision-slider',
        min: meta.render.meshSubdivision.min,
        max: meta.render.meshSubdivision.max,
        step: meta.render.meshSubdivision.step,
        formatter: (v) => {
          const level = Math.floor(v);
          const triangles = Math.pow(UIConfig.TRIANGLES_BASE, level + 1);
          return `${level} (${triangles} tris)`;
        },
        property: 'meshSubdivisionLevel'
      },

      // === Aérodynamique ===
      {
        id: 'lift-scale-slider',
        min: meta.aerodynamics.liftScale.min,
        max: meta.aerodynamics.liftScale.max,
        step: meta.aerodynamics.liftScale.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'liftScale'
      },
      {
        id: 'drag-scale-slider',
        min: meta.aerodynamics.dragScale.min,
        max: meta.aerodynamics.dragScale.max,
        step: meta.aerodynamics.dragScale.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'dragScale'
      },
      {
        id: 'force-smoothing-slider',
        min: meta.aerodynamics.forceSmoothing.min,
        max: meta.aerodynamics.forceSmoothing.max,
        step: meta.aerodynamics.forceSmoothing.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'forceSmoothing'
      }
    ];
  }

  private setupSlider(config: SliderConfig): void {
    const slider = document.getElementById(config.id) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${config.id.replace('-slider', '-value')}`);

    if (!slider || !valueDisplay || !this.inputComponent) {
      this.logger.warn(`Slider ${config.id} not found in DOM`, 'UISystem');
      return;
    }

    // Définir la valeur initiale
    const initialValue = this.inputComponent[config.property] as number;
    slider.value = initialValue.toString();
    slider.min = config.min.toString();
    slider.max = config.max.toString();
    slider.step = config.step.toString();
    valueDisplay.textContent = config.formatter(initialValue);

    // Ajouter l'écouteur d'événement
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      (this.inputComponent[config.property] as number) = value;
      valueDisplay.textContent = config.formatter(value);
    });
  }

  private setupButtons(): void {
    // Bouton Play/Pause
    const playPauseBtn = document.getElementById('play-pause');
    if (playPauseBtn) {
      playPauseBtn.onclick = () => {
        this.inputComponent.isPaused = !this.inputComponent.isPaused;
        this.updatePlayPauseButton(playPauseBtn, !this.inputComponent.isPaused);
        this.logger.info(`Simulation ${this.inputComponent.isPaused ? 'paused' : 'resumed'}`, 'UISystem');
      };

      // Initialiser l'état visuel du bouton selon isPaused
      this.updatePlayPauseButton(playPauseBtn, !this.inputComponent.isPaused);
    }

    // Bouton Reset
    const resetBtn = document.getElementById('reset-sim');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.inputComponent.resetSimulation = true;
        this.logger.info('Reset simulation requested', 'UISystem');
      };
    }

    // Bouton Debug
    const debugBtn = document.getElementById('debug-toggle');
    if (debugBtn) {
      debugBtn.onclick = () => {
        this.inputComponent.debugMode = !this.inputComponent.debugMode;
        debugBtn.textContent = this.inputComponent.debugMode ? '🔍 Debug ON' : '🔍 Debug OFF';
        debugBtn.classList.toggle('active', this.inputComponent.debugMode);
        this.logger.info(`Debug mode: ${this.inputComponent.debugMode}`, 'UISystem');
      };

      // Initialiser l'état du bouton
      debugBtn.textContent = this.inputComponent.debugMode ? '🔍 Debug ON' : '🔍 Debug OFF';
      debugBtn.classList.toggle('active', this.inputComponent.debugMode);
    }

    // Toggle Mode de Contrainte
    const constraintModeToggle = document.getElementById('constraint-mode-toggle') as HTMLInputElement;
    if (constraintModeToggle) {
      // Initialiser l'état du toggle selon inputComponent.constraintMode
      // Unchecked = 'pbd', Checked = 'spring-force'
      constraintModeToggle.checked = this.inputComponent.constraintMode === 'spring-force';
      
      this.logger.info(`Constraint mode initialized to: ${this.inputComponent.constraintMode}, toggle checked: ${constraintModeToggle.checked}`, 'UISystem');

      // Event listener pour mettre à jour le mode de contrainte
      constraintModeToggle.addEventListener('change', () => {
        this.inputComponent.constraintMode = constraintModeToggle.checked ? 'spring-force' : 'pbd';
        this.logger.info(`Constraint mode changed to: ${this.inputComponent.constraintMode}`, 'UISystem');
        
        // Reset la simulation lors du changement de mode
        this.inputComponent.resetSimulation = true;
        this.logger.info('Reset simulation requested after constraint mode change', 'UISystem');
      });
    }

    // Toggle Mode Aérodynamique  
    const aeroModeToggle = document.getElementById('aero-mode-toggle') as HTMLInputElement;
    if (aeroModeToggle) {
      // Initialiser l'état du toggle selon inputComponent.aeroMode
      // Unchecked = 'perso', Checked = 'nasa'
      aeroModeToggle.checked = this.inputComponent.aeroMode === 'nasa';
      
      this.logger.info(`Aero mode initialized to: ${this.inputComponent.aeroMode}, toggle checked: ${aeroModeToggle.checked}`, 'UISystem');

      // Event listener pour mettre à jour le mode aérodynamique
      aeroModeToggle.addEventListener('change', () => {
        this.inputComponent.aeroMode = aeroModeToggle.checked ? 'nasa' : 'perso';
        this.logger.info(`Aero mode changed to: ${this.inputComponent.aeroMode}`, 'UISystem');
        
        // Pas besoin de reset pour le changement de mode aéro (bascule à chaud)
      });
    }
  }

  /**
   * Met à jour l'apparence du bouton play/pause
   * @param button - L'élément bouton
   * @param isRunning - true si la simulation tourne, false si en pause
   */
  private updatePlayPauseButton(button: HTMLElement, isRunning: boolean): void {
    button.textContent = isRunning ? '⏸️ Pause' : '▶️ Démarrer';
    button.classList.toggle('active', isRunning);
  }

  update(context: SimulationContext): void {
    if (!this.kiteEntity) {
      // Essayer de retrouver l'entité kite si elle n'a pas été trouvée à l'initialisation
      const potentialKites = context.entityManager.query(['physics', 'kite']);
      this.kiteEntity = potentialKites.find(e => e.id === 'kite') ?? null;

      if (!this.kiteEntity) {
        // Essayer une requête plus large
        this.kiteEntity = context.entityManager.getEntity('kite') ?? null;
      }

      if (!this.kiteEntity) {
        this.logger.warn('Kite entity not found', 'UISystem');
        return;
      }

      this.logger.info('Kite entity found: ' + this.kiteEntity.id, 'UISystem');
    }

    // Mettre à jour les affichages d'informations
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');

    if (physics && transform) {
      // === Vitesse ===
      const speedValue = document.getElementById('kite-speed-value');
      if (speedValue) {
        const speedKmh = physics.velocity.length() * MS_TO_KMH;
        speedValue.textContent = `${speedKmh.toFixed(DECIMAL_PRECISION_VELOCITY)} km/h`;
      }

      // === Altitude ===
      const altitudeValue = document.getElementById('kite-altitude-value');
      if (altitudeValue) {
        altitudeValue.textContent = `${transform.position.y.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Position X ===
      const posXValue = document.getElementById('kite-position-x-value');
      if (posXValue) {
        posXValue.textContent = `${transform.position.x.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Position Z ===
      const posZValue = document.getElementById('kite-position-z-value');
      if (posZValue) {
        posZValue.textContent = `${transform.position.z.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Angle d'attaque ===
      this.updateAngleOfAttack(context, transform);

      // === Forces (portance et traînée) ===
      this.updateForces(physics);

      // === Tensions des lignes ===
      this.updateLineTensions(context);

      // === Distances des lignes (handles -> points de contrôle) ===
      this.updateLineDistances(context);
    }

    // === Vent ambiant et apparent ===
    this.updateWindInfo(context);
  }

  /**
   * Calcule et affiche l'angle d'attaque du kite
   */
  private updateAngleOfAttack(context: SimulationContext, transform: TransformComponent): void {
    const aoaValue = document.getElementById('kite-aoa-value');
    if (!aoaValue) return;

    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) return;

    const windState = windCache.get('kite');
    if (!windState || !windState.apparent) {
      aoaValue.textContent = '-- °';
      return;
    }

    const apparentWind = windState.apparent;
    const windSpeed = apparentWind.length();

    if (windSpeed < UIConfig.MIN_WIND_SPEED) {
      aoaValue.textContent = '0.0 °';
      return;
    }

    // Calculer l'angle d'attaque : angle entre la corde du kite et la direction du vent
    const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
    const windDir = apparentWind.clone().normalize();
    const dotProduct = chord.dot(windDir);
    const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;

    aoaValue.textContent = `${alpha.toFixed(DECIMAL_PRECISION_ANGLE)} °`;
  }

  /**
   * Calcule et affiche les forces totales de portance et traînée
   */
  private updateForces(physics: PhysicsComponent): void {
    const liftValue = document.getElementById('kite-lift-value');
    const dragValue = document.getElementById('kite-drag-value');

    if (!liftValue || !dragValue) return;

    // Calculer la somme des forces de portance et traînée depuis faceForces
    let totalLift = 0;
    let totalDrag = 0;

    physics.faceForces.forEach(faceForce => {
      totalLift += faceForce.lift.length();
      totalDrag += faceForce.drag.length();
    });

    liftValue.textContent = `${totalLift.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
    dragValue.textContent = `${totalDrag.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
  }

  /**
   * Affiche les tensions des lignes gauche et droite
   */
  private updateLineTensions(context: SimulationContext): void {
    const tensionLeftValue = document.getElementById('tension-left-value');
    const tensionRightValue = document.getElementById('tension-right-value');

    if (!tensionLeftValue || !tensionRightValue) return;

    const { entityManager } = context;
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    // Tension ligne gauche
    if (leftLine) {
      const lineComp = leftLine.getComponent<LineComponent>('line');
      if (lineComp && 'currentTension' in lineComp && lineComp.currentTension !== undefined) {
        const tension = (lineComp as LineComponent & { currentTension: number }).currentTension;
        tensionLeftValue.textContent = `${tension.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
      } else {
        tensionLeftValue.textContent = '0.0 N';
      }
    } else {
      tensionLeftValue.textContent = '-- N';
    }

    // Tension ligne droite
    if (rightLine) {
      const lineComp = rightLine.getComponent<LineComponent>('line');
      if (lineComp && 'currentTension' in lineComp && lineComp.currentTension !== undefined) {
        const tension = (lineComp as LineComponent & { currentTension: number }).currentTension;
        tensionRightValue.textContent = `${tension.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
      } else {
        tensionRightValue.textContent = '0.0 N';
      }
    } else {
      tensionRightValue.textContent = '-- N';
    }
  }

  /**
   * Affiche les informations sur le vent (ambiant, apparent, direction)
   */
  private updateWindInfo(context: SimulationContext): void {
    if (!this.inputComponent) return;

    // Vent ambiant
    const windInfo = document.getElementById('wind-info-value');
    if (windInfo) {
      windInfo.textContent = `${this.inputComponent.windSpeed.toFixed(DECIMAL_PRECISION_POSITION)} m/s`;
    }

    // Direction du vent
    const windDirValue = document.getElementById('wind-direction-info-value');
    if (windDirValue) {
      windDirValue.textContent = `${this.inputComponent.windDirection.toFixed(0)} °`;
    }

    // Vent apparent
    const windApparentValue = document.getElementById('wind-apparent-value');
    if (!windApparentValue) return;

    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) {
      windApparentValue.textContent = '-- m/s';
      return;
    }

    const windState = windCache.get('kite');
    if (!windState || !windState.apparent) {
      windApparentValue.textContent = '-- m/s';
      return;
    }

    const apparentSpeed = windState.apparent.length();
    windApparentValue.textContent = `${apparentSpeed.toFixed(DECIMAL_PRECISION_POSITION)} m/s`;
  }

  /**
   * Calcule et affiche les distances des lignes (handles -> points de contrôle du kite)
   * Compare avec la distance attendue depuis Config
   */
  private updateLineDistances(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer les entités
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');

    if (!kite || !controlBar) return;

    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');

    if (!kiteGeometry || !barGeometry) return;

    // === Ligne gauche ===
    const leftHandleWorld = barGeometry.getPointWorld('leftHandle', controlBar);
    const leftCtrlWorld = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);

    if (leftHandleWorld && leftCtrlWorld) {
      // Distance actuelle
      const actualLeftDistance = leftHandleWorld.distanceTo(leftCtrlWorld);

      // Distance attendue depuis Config
      const expectedDistance = this.inputComponent?.lineLength ?? 150;

      // Écart
      const leftDiff = actualLeftDistance - expectedDistance;

      // Afficher
      const leftActual = document.getElementById('line-left-actual-value');
      const leftExpected = document.getElementById('line-left-expected-value');
      const leftDiffElem = document.getElementById('line-left-diff-value');

      if (leftActual) leftActual.textContent = `${actualLeftDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (leftExpected) leftExpected.textContent = `${expectedDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (leftDiffElem) {
        const sign = leftDiff >= 0 ? '+' : '';
        leftDiffElem.textContent = `${sign}${leftDiff.toFixed(DECIMAL_PRECISION_POSITION)} m`;
        // Colorer en rouge si l'écart est > 1m
        if (Math.abs(leftDiff) > 1) {
          leftDiffElem.style.color = '#ff4444';
        } else {
          leftDiffElem.style.color = '#4da6ff';
        }
      }
    }

    // === Ligne droite ===
    const rightHandleWorld = barGeometry.getPointWorld('rightHandle', controlBar);
    const rightCtrlWorld = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    if (rightHandleWorld && rightCtrlWorld) {
      // Distance actuelle
      const actualRightDistance = rightHandleWorld.distanceTo(rightCtrlWorld);

      // Distance attendue depuis Config
      const expectedDistance = this.inputComponent?.lineLength ?? 150;

      // Écart
      const rightDiff = actualRightDistance - expectedDistance;

      // Afficher
      const rightActual = document.getElementById('line-right-actual-value');
      const rightExpected = document.getElementById('line-right-expected-value');
      const rightDiffElem = document.getElementById('line-right-diff-value');

      if (rightActual) rightActual.textContent = `${actualRightDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (rightExpected) rightExpected.textContent = `${expectedDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (rightDiffElem) {
        const sign = rightDiff >= 0 ? '+' : '';
        rightDiffElem.textContent = `${sign}${rightDiff.toFixed(DECIMAL_PRECISION_POSITION)} m`;
        // Colorer en rouge si l'écart est > 1m
        if (Math.abs(rightDiff) > 1) {
          rightDiffElem.style.color = '#ff4444';
        } else {
          rightDiffElem.style.color = '#4da6ff';
        }
      }
    }
  }
}

```

---

## Fichier: `ecs/systems/WindSystem.ts`

```typescript
/**
 * WindSystem.ts - Calcul du vent apparent
 * 
 * === DESCRIPTION ===
 * Ce système calcule le vent apparent ressenti par le cerf-volant en fonction :
 * - Du vent ambiant (vitesse et direction configurables)
 * - De la vitesse du cerf-volant (vent relatif)
 * - De la turbulence (variations aléatoires)
 * 
 * === FORMULE DU VENT APPARENT ===
 * Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence
 * 
 * Cette formule est fondamentale en aérodynamique : un objet en mouvement "ressent"
 * un vent d'autant plus fort qu'il se déplace dans la direction du vent.
 * 
 * === SYSTÈME DE COORDONNÉES ===
 * Le vent est défini dans le plan horizontal XZ (Y = vertical dans Three.js) :
 * - Direction 0° = axe +X (Est)
 * - Direction 90° = axe +Z (Sud)
 * - Direction 180° = axe -X (Ouest)
 * - Direction 270° = axe -Z (Nord)
 * 
 * === INTÉGRATION ECS ===
 * Priorité : 20 (exécuté avant AeroSystem qui a la priorité 30)
 * 
 * INPUT :
 * - InputComponent : windSpeed, windDirection, windTurbulence (depuis l'UI)
 * - PhysicsComponent : velocity (vitesse du cerf-volant)
 * 
 * OUTPUT :
 * - context.windCache : Map<entityId, WindState> contenant le vent apparent pour chaque kite
 * 
 * === SYNCHRONISATION AVEC L'UI ===
 * Le système lit automatiquement les paramètres de InputComponent toutes les 100ms
 * et met à jour le vent ambiant en conséquence. Cela permet un contrôle en temps réel
 * depuis l'interface utilisateur.
 * 
 * === TURBULENCE ===
 * La turbulence ajoute des variations aléatoires au vent apparent :
 * - Turbulence 0% = vent stable
 * - Turbulence 100% = variations jusqu'à ±100% de la vitesse du vent
 * - La turbulence verticale est réduite (x0.3) pour plus de réalisme
 * 
 * @see AeroSystem - Utilise les données de ce système pour calculer les forces aéro
 * @see InputComponent - Source des paramètres de vent
 * @see WindState - Interface décrivant l'état du vent stocké dans le cache
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { InputComponent } from '../components/InputComponent';
import { WindConfig } from '../config/Config';

/**
 * État du vent stocké dans le contexte
 */
export interface WindState {
  ambient: THREE.Vector3;        // Vent ambiant
  apparent: THREE.Vector3;       // Vent apparent (ambiant - velocityKite)
  speed: number;                 // Vitesse du vent apparent (m/s)
  direction: THREE.Vector3;      // Direction normalisée
}

export class WindSystem extends System {
  private ambientWind!: THREE.Vector3; // Initialisé dans updateAmbientWind()
  private windSpeed: number; // m/s
  private windDirection: number; // degrés (0 = +X, 90 = +Z)
  private turbulence: number; // %
  private lastWindUpdate = 0; // Timestamp de la dernière mise à jour depuis InputComponent
  
  constructor(options: {
    windSpeed?: number;      // m/s
    windDirection?: number;  // degrés
    turbulence?: number;     // %
  } = {}) {
    super('WindSystem', WindConfig.PRIORITY);
    
    // Paramètres initiaux
    this.windSpeed = options.windSpeed ?? WindConfig.DEFAULT_WIND_SPEED_MS;
    this.windDirection = options.windDirection ?? WindConfig.DEFAULT_WIND_DIRECTION;
    this.turbulence = options.turbulence ?? WindConfig.DEFAULT_TURBULENCE;
    
    // Calculer vecteur vent ambiant dans le plan horizontal XZ
    this.updateAmbientWind();
  }
  
  /**
   * Met à jour le vecteur de vent ambiant selon la vitesse et direction courantes
   * Le vent est dans le plan horizontal XZ (Y = 0)
   */
  private updateAmbientWind(): void {
    const DEG_TO_RAD = Math.PI / 180;
    const dirRad = this.windDirection * DEG_TO_RAD;
    
    // Plan horizontal XZ : X = cos(angle), Y = 0 (horizontal), Z = sin(angle)
    this.ambientWind = new THREE.Vector3(
      Math.cos(dirRad) * this.windSpeed,
      0, // Horizontal (Y est l'axe vertical dans Three.js)
      Math.sin(dirRad) * this.windSpeed
    );
  }
  
  update(context: SimulationContext): void {
    const currentTime = performance.now();
    const { entityManager } = context;
    
    // Synchroniser avec InputComponent si disponible
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0 && currentTime - this.lastWindUpdate > WindConfig.UPDATE_INTERVAL) {
      const inputComp = inputEntities[0].getComponent<InputComponent>('Input');
      if (inputComp) {
        const speedChanged = Math.abs(inputComp.windSpeed - this.windSpeed) > WindConfig.SPEED_CHANGE_THRESHOLD;
        const directionChanged = Math.abs(inputComp.windDirection - this.windDirection) > WindConfig.DIRECTION_CHANGE_THRESHOLD;
        const turbulenceChanged = Math.abs(inputComp.windTurbulence - this.turbulence) > WindConfig.TURBULENCE_CHANGE_THRESHOLD;
        
        if (speedChanged || directionChanged || turbulenceChanged) {
          this.windSpeed = inputComp.windSpeed;
          this.windDirection = inputComp.windDirection;
          this.turbulence = inputComp.windTurbulence;
          this.updateAmbientWind();
        }
        this.lastWindUpdate = currentTime;
      }
    }
    
    // Pour chaque kite
    const kites = entityManager.query(['kite', 'transform', 'physics']);
    
    kites.forEach(kite => {
      const physics = kite.getComponent<PhysicsComponent>('physics')!;
      
      // Protection contre les NaN dans velocity
      if (isNaN(physics.velocity.x) || isNaN(physics.velocity.y) || isNaN(physics.velocity.z)) {
        console.error('[WindSystem] NaN detected in velocity for kite:', kite.id);
        physics.velocity.set(0, 0, 0); // Reset à zéro
      }
      
      // Vent apparent = vent ambiant - vitesse kite
      // (Le vent "vu" par le kite dépend de sa propre vitesse)
      const apparentWindBase = this.ambientWind.clone().sub(physics.velocity);
      
      // Ajouter de la turbulence si configurée
      if (this.turbulence > 0) {
        const TURBULENCE_SCALE = this.turbulence / 100;
        const turbulenceVector = new THREE.Vector3(
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE,
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE * WindConfig.VERTICAL_TURBULENCE_FACTOR, // Moins de turbulence verticale
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE
        );
        apparentWindBase.add(turbulenceVector);
      }
      
      const apparentWind = apparentWindBase;
      const speed = apparentWind.length();
      const direction = speed > WindConfig.MINIMUM_WIND_SPEED ? apparentWind.clone().normalize() : new THREE.Vector3(1, 0, 0);
      
      // Stocker dans un cache temporaire du contexte
      // (AeroSystem le lira ensuite)
      if (!context.windCache) {
        context.windCache = new Map();
      }
      
      context.windCache.set(kite.id, {
        ambient: this.ambientWind.clone(),
        apparent: apparentWind,
        speed,
        direction
      } as WindState);
    });
  }
  
  /**
   * Change le vent ambiant manuellement
   * @param speedMs - Vitesse du vent en m/s
   * @param directionDeg - Direction en degrés (0 = +X, 90 = +Z)
   */
  setWind(speedMs: number, directionDeg: number): void {
    this.windSpeed = speedMs;
    this.windDirection = directionDeg;
    this.updateAmbientWind();
    
    console.log('💨 [WindSystem] Wind manually set to:', {
      speed: speedMs.toFixed(1) + ' m/s',
      direction: directionDeg.toFixed(0) + '°',
      vector: this.ambientWind
    });
  }
  
  /**
   * Récupère les paramètres actuels du vent
   */
  getWindParameters(): { speed: number; direction: number; turbulence: number } {
    return {
      speed: this.windSpeed,
      direction: this.windDirection,
      turbulence: this.turbulence
    };
  }
}

```

---

## Fichier: `ecs/systems/experimental/PBDConstraintSystem.ts`

```typescript
/**
 * PBDConstraintSystem.ts - Pure Position-Based Dynamics Constraint Solver
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║              PURE PBD - POSITION-BASED DYNAMICS                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║                                                                         ║
 * ║  Implémentation d'un solveur PBD pur selon les principes de:          ║
 * ║  - Müller et al. (2007) "Position Based Dynamics"                     ║
 * ║  - Macklin et al. (2016) "XPBD: Position-Based Simulation"            ║
 * ║                                                                         ║
 * ║  PRINCIPES PBD:                                                        ║
 * ║  ──────────────                                                        ║
 * ║  1. Pas de forces explicites (contrairement à spring-mass)            ║
 * ║  2. Projection directe des positions pour satisfaire contraintes       ║
 * ║  3. Convergence itérative (Gauss-Seidel)                              ║
 * ║  4. Stabilité inconditionnelle (pas de blow-up)                       ║
 * ║  5. Contrôle précis de la rigidité via compliance                     ║
 * ║                                                                         ║
 * ║  ALGORITHME:                                                           ║
 * ║  ──────────                                                            ║
 * ║  Pour chaque itération:                                               ║
 * ║    Pour chaque contrainte (ligne gauche, ligne droite):               ║
 * ║      1. Calculer C(x) = ||x1 - x2|| - restLength                      ║
 * ║      2. Si C(x) > 0 (ligne tendue):                                   ║
 * ║         - Calculer gradient ∇C                                        ║
 * ║         - Calculer lambda (multiplicateur Lagrange)                   ║
 * ║         - Corriger positions: Δp = -λ × w × ∇C                        ║
 * ║      3. Sinon: contrainte inactive (slack)                            ║
 * ║                                                                         ║
 * ║  UNILATERAL CONSTRAINT:                                               ║
 * ║  ─────────────────────                                                ║
 * ║  Les lignes ne peuvent que tirer, jamais pousser.                     ║
 * ║  λ ≥ 0 (inequality constraint)                                        ║
 * ║                                                                         ║
 * ║  COMPLIANCE:                                                           ║
 * ║  ──────────                                                            ║
 * ║  α = compliance (inverse de la rigidité)                              ║
 * ║  α = 0     → infiniment rigide (hard constraint)                      ║
 * ║  α > 0     → souple (soft constraint)                                 ║
 * ║  α = 1/k   → équivalent à un ressort de raideur k                     ║
 * ║                                                                         ║
 * ║  ANGULAR CONSTRAINTS:                                                  ║
 * ║  ───────────────────                                                  ║
 * ║  Les corrections de position génèrent automatiquement des rotations   ║
 * ║  via les forces de contrainte appliquées hors du centre de masse.    ║
 * ║                                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Priority: 40 (après AeroSystem 30, avant PhysicsSystem 50)
 *
 * REFERENCES:
 * - Müller et al. "Position Based Dynamics" (2007)
 * - Macklin et al. "XPBD: Position-Based Simulation of Compliant Constraints" (2016)
 * - Bender et al. "A Survey on Position-Based Simulation Methods" (2014)
 *
 * @class PBDConstraintSystem
 * @extends System
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../../core/System';
import { TransformComponent } from '../../components/TransformComponent';
import { PhysicsComponent } from '../../components/PhysicsComponent';
import { LineComponent } from '../../components/LineComponent';
import { GeometryComponent } from '../../components/GeometryComponent';
import { CONFIG } from '../../config/Config';

const GROUND_Y = 0;
const EPSILON = 1e-6;
const PRIORITY = 52; // APRÈS PhysicsSystem (50) pour corriger positions

/**
 * Structure pour stocker l'état d'une contrainte PBD
 */
interface PBDConstraintState {
  /** Point de contrôle du kite (world space) */
  kitePoint: THREE.Vector3;

  /** Point du poignet (world space) */
  poignetPoint: THREE.Vector3;

  /** Longueur au repos */
  restLength: number;

  /** Composant LineComponent associé */
  lineComponent: LineComponent;

  /** Nom de la contrainte (pour debug) */
  name: string;
}

export class PBDConstraintSystem extends System {
  // ========== PARAMETRES PBD ==========
  /** Nombre d'itérations de résolution par frame */
  private readonly iterations: number;

  /** Compliance (inverse de rigidité): α = 1/k */
  private readonly compliance: number;

  /** Correction maximale par frame (m) - Sécurité anti-divergence */
  private readonly maxCorrection: number;

  /** Lambda max (sécurité) */
  private readonly maxLambda: number;

  /** Facteur d'amortissement angulaire */
  private readonly angularDamping: number;

  constructor() {
    super('PBDConstraintSystem', PRIORITY);

    // Charger les paramètres depuis Config
    this.iterations = CONFIG.lines.pbd.iterations;
    this.compliance = CONFIG.lines.pbd.compliance;
    this.maxCorrection = CONFIG.lines.pbd.maxCorrection;
    this.maxLambda = CONFIG.lines.pbd.maxLambda;
    this.angularDamping = CONFIG.lines.pbd.angularDamping;
  }

  update(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    // Récupérer les entités nécessaires
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry) {
      return;
    }

    // Pas de contraintes sur les objets kinematiques
    if (kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Récupérer les composants de ligne
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');
    if (!leftLineComp || !rightLineComp) return;

    // ========================================================================
    // PHASE 1: Préparer les contraintes
    // ========================================================================
    const constraints = this.prepareConstraints(
      kite, kiteGeometry,
      controlBar, barGeometry,
      leftLineComp, rightLineComp
    );

    if (constraints.length === 0) {
      return;
    }

    // ========================================================================
    // PHASE 2: Sauvegarder la position initiale (pour calcul de vélocité)
    // ========================================================================
    const oldPosition = kiteTransform.position.clone();
    const oldQuaternion = kiteTransform.quaternion.clone();

    // ========================================================================
    // PHASE 3: Résolution itérative PBD (Gauss-Seidel)
    // ========================================================================
    for (let iter = 0; iter < this.iterations; iter++) {
      for (const constraint of constraints) {
        this.solveConstraint(constraint, kiteTransform, kitePhysics, deltaTime);
      }
    }

    // ========================================================================
    // PHASE 4: Mise à jour des vélocités (PBD)
    // ========================================================================
    // En PBD, après avoir corrigé les positions, il faut mettre à jour les vélocités
    // pour qu'elles soient cohérentes avec les nouvelles positions
    // v_new = (p_new - p_old) / dt
    if (deltaTime > EPSILON) {
      const deltaPos = kiteTransform.position.clone().sub(oldPosition);
      kitePhysics.velocity.copy(deltaPos.divideScalar(deltaTime));

      // Pour la rotation, c'est plus complexe. On va juste amortir l'angular velocity
      // car les corrections de position vont indirectement affecter la rotation
    }

    // ========================================================================
    // PHASE 5: Amortissement angulaire (stabilisation)
    // ========================================================================
    kitePhysics.angularVelocity.multiplyScalar(this.angularDamping);

    // ========================================================================
    // PHASE 6: Collision avec le sol
    // ========================================================================
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Prépare les contraintes à partir des entités
   */
  private prepareConstraints(
    kite: any,
    kiteGeometry: GeometryComponent,
    controlBar: any,
    barGeometry: GeometryComponent,
    leftLineComp: LineComponent,
    rightLineComp: LineComponent
  ): PBDConstraintState[] {
    const constraints: PBDConstraintState[] = [];

    // Points de contrôle du kite
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    // Handles de la barre
    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlGauche || !ctrlDroit || !leftHandle || !rightHandle) {
      return constraints;
    }

    // Contrainte gauche
    constraints.push({
      kitePoint: ctrlGauche,
      poignetPoint: leftHandle,
      restLength: leftLineComp.restLength,
      lineComponent: leftLineComp,
      name: 'leftLine'
    });

    // Contrainte droite
    constraints.push({
      kitePoint: ctrlDroit,
      poignetPoint: rightHandle,
      restLength: rightLineComp.restLength,
      lineComponent: rightLineComp,
      name: 'rightLine'
    });

    return constraints;
  }

  /**
   * Résout une contrainte PBD individuelle (distance unilaterale)
   *
   * Algorithme XPBD (eXtended Position-Based Dynamics):
   *
   * 1. Fonction de contrainte: C(x) = ||p1 - p2|| - L0
   * 2. Gradient: ∇C = (p1 - p2) / ||p1 - p2||
   * 3. Lambda: λ = -C / (w1 + w2 + α/Δt²)  où w = 1/m (masse inverse)
   * 4. Correction: Δp = λ × w × ∇C
   *
   * Pour contrainte unilatérale (λ ≥ 0):
   * - Si C ≤ 0: contrainte inactive (slack), pas de correction
   * - Si C > 0: contrainte active, appliquer correction
   */
  private solveConstraint(
    constraint: PBDConstraintState,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    deltaTime: number
  ): void {
    const { kitePoint, poignetPoint, restLength, lineComponent, name } = constraint;

    // === 1. CALCUL DE LA CONTRAINTE ===
    // Direction: du poignet vers le kite point
    const delta = kitePoint.clone().sub(poignetPoint);
    const distance = delta.length();

    if (distance < EPSILON) {
      // Points confondus, pas de contrainte
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.currentLength = 0;
      lineComponent.currentTension = 0;
      return;
    }

    // Normaliser
    const direction = delta.clone().divideScalar(distance);

    // Fonction de contrainte: C = distance - restLength
    const C = distance - restLength;

    // === 2. CONTRAINTE UNILATERALE ===
    // Si C ≤ 0, la ligne est slack (pas de tension)
    if (C <= EPSILON) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentLength = distance;
      lineComponent.currentTension = 0;
      return;
    }

    // === 3. CONTRAINTE ACTIVE ===
    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = C;
    lineComponent.state.strainRatio = C / restLength;
    lineComponent.currentLength = distance;

    // === 4. CALCUL DES MASSES INVERSES ===
    const w_kite = 1.0 / kitePhysics.mass; // Masse inverse du kite
    const w_handle = 0.0; // Handle fixe (masse infinie)
    const w_sum = w_kite + w_handle;

    if (w_sum < EPSILON) {
      // Pas de masse inverse, pas de correction possible
      return;
    }

    // === 5. CALCUL DU LAMBDA (multiplicateur de Lagrange) ===
    // XPBD: λ = -C / (Σw_i + α/Δt²)
    // α = compliance (0 = infiniment rigide, >0 = souple)
    // Pour une contrainte d'inégalité (unilatérale), λ doit être positif
    const alpha_tilde = this.compliance / (deltaTime * deltaTime + EPSILON); // XPBD compliance term

    // Calculate lambda for XPBD. It will be negative if C is positive (stretched).
    // λ = -C / (Σw_i + α/Δt²)
    let lambda = -C / (w_sum + alpha_tilde);

    // Clamp lambda magnitude for stability, but preserve sign
    const lambdaMagnitudeClamped = Math.min(Math.abs(lambda), this.maxLambda);
    lambda = Math.sign(lambda) * lambdaMagnitudeClamped;

    // Store approximate tension magnitude (tension is always positive)
    lineComponent.currentTension = Math.abs(lambda);

    // Calculate position correction for the kite
    // Δp_kite = λ × w_kite × ∇C (where ∇C is 'direction')
    const correction_kite = direction.clone().multiplyScalar(lambda * w_kite);

    // Limiter la correction maximale (sécurité)
    const correctionMagnitude = correction_kite.length();
    if (correctionMagnitude > this.maxCorrection) {
      correction_kite.multiplyScalar(this.maxCorrection / correctionMagnitude);
    }

    // === 7. APPLICATION DIRECTE DE LA CORRECTION (PBD PUR) ===
    // PBD modifie directement les positions
    kiteTransform.position.add(correction_kite);

    // Note: Les torques seront gérés automatiquement par les forces de contrainte
    // qui s'appliquent hors du centre de masse. On n'a pas besoin de les calculer ici.
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(
    transform: TransformComponent,
    physics: PhysicsComponent
  ): void {
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;

      // Réflexion de la vélocité verticale (bounce)
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.5; // 50% de restitution
      }
    }
  }
}

```

---

## Fichier: `ecs/systems/index.ts`

```typescript
/**
 * index.ts - Exports de tous les systèmes
 */

export { InputSyncSystem } from './InputSyncSystem';
export { InputSystem } from './InputSystem';
export { WindSystem } from './WindSystem';
export type { WindState } from './WindSystem';

export { BridleConstraintSystem } from './BridleConstraintSystem';
export { BridleRenderSystem } from './BridleRenderSystem';
export { TetherSystem } from './TetherSystem'; // Nouveau système simplifié
// export { ConstraintSystem } from './ConstraintSystem'; // Ancien système (backup)
// PBDConstraintSystem déplacé vers experimental/ (système expérimental non utilisé)
export { PhysicsSystem } from './PhysicsSystem';
export { GeometryRenderSystem } from './GeometryRenderSystem';
export { LineRenderSystem } from './LineRenderSystem';
export { RenderSystem } from './RenderSystem';
export { EnvironmentSystem } from './EnvironmentSystem';
export { CameraControlsSystem } from './CameraControlsSystem';
export { UISystem } from './UISystem';
export { PilotSystem } from './PilotSystem';
export { DebugSystem } from './DebugSystem';
export { SimulationLogger } from './SimulationLogger';
export { SimulationLoggerHelper } from './SimulationLoggerHelper';

```

---

## Fichier: `ecs/utils/Logging.ts`

```typescript
/**
 * Logging.ts - Système de logging configurable
 * 
 * Remplace les console.log par un système centralisé avec niveaux.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  
  private constructor() {}
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  debug(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, context, ...args);
    }
  }
  
  info(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, context, ...args);
    }
  }
  
  warn(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, context, ...args);
    }
  }
  
  error(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, context, ...args);
    }
  }
  
  private log(level: string, message: string, context?: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const fullMessage = `${timestamp} [${level}] ${contextStr} ${message}`;
    
    // eslint-disable-next-line no-console
    console.log(fullMessage, ...args);
  }
}

```

---

## Fichier: `ecs/utils/MathUtils.ts`

```typescript
/**
 * MathUtils.ts - Fonctions mathématiques utilitaires
 * 
 * Collection de fonctions réutilisables pour calculs vectoriels,
 * transformations, géométrie et sécurité numérique.
 */

import * as THREE from 'three';
import type { TransformComponent } from '../components/TransformComponent';

export class MathUtils {
  /** Epsilon par défaut pour comparaisons flottantes */
  private static readonly EPSILON = 1e-6;

  // ========================================================================
  // QUATERNIONS ET ROTATIONS
  // ========================================================================

  /**
   * Crée un quaternion depuis des angles d'Euler (degrés)
   */
  static quaternionFromEuler(pitch: number, yaw: number, roll: number): THREE.Quaternion {
    const euler = new THREE.Euler(
      pitch * Math.PI / 180,
      yaw * Math.PI / 180,
      roll * Math.PI / 180,
      'XYZ'
    );
    return new THREE.Quaternion().setFromEuler(euler);
  }

  /**
   * Crée un quaternion depuis un axe et un angle
   * @param axis Axe de rotation (normalisé)
   * @param angle Angle en radians
   */
  static quaternionFromAxisAngle(axis: THREE.Vector3, angle: number): THREE.Quaternion {
    return new THREE.Quaternion().setFromAxisAngle(axis, angle);
  }

  // ========================================================================
  // TRANSFORMATIONS DE COORDONNÉES
  // ========================================================================

  /**
   * Transforme un point local en coordonnées monde
   * @param localPoint Point dans l'espace local
   * @param transform Composant de transformation (position + rotation)
   * @returns Point dans l'espace monde
   */
  static transformPointToWorld(localPoint: THREE.Vector3, transform: TransformComponent): THREE.Vector3 {
    const matrix = new THREE.Matrix4();
    matrix.compose(transform.position, transform.quaternion, new THREE.Vector3(1, 1, 1));
    return localPoint.clone().applyMatrix4(matrix);
  }

  // ========================================================================
  // PHYSIQUE - FORCES ET TORQUES
  // ========================================================================

  /**
   * Calcule le torque généré par une force appliquée à un point d'un corps rigide
   * 
   * Formule : τ = r × F
   * où :
   * - r = vecteur bras de levier (centre de masse → point d'application)
   * - F = force appliquée
   * 
   * Utilisé par : TetherSystem, AeroSystemNASA, ConstraintSystem
   * 
   * @param applicationPoint Position monde où la force est appliquée
   * @param centerOfMass Centre de masse du corps rigide
   * @param force Force appliquée (N)
   * @returns Torque généré (N·m)
   */
  static computeTorque(
    applicationPoint: THREE.Vector3, 
    centerOfMass: THREE.Vector3, 
    force: THREE.Vector3
  ): THREE.Vector3 {
    const leverArm = new THREE.Vector3().subVectors(applicationPoint, centerOfMass);
    return new THREE.Vector3().crossVectors(leverArm, force);
  }

  /**
   * Calcule l'orientation et la position pour aligner un cylindre entre deux points
   * @param start Point de départ
   * @param end Point d'arrivée
   * @returns Centre et quaternion d'orientation
   */
  static calculateCylinderOrientation(start: THREE.Vector3, end: THREE.Vector3): { 
    center: THREE.Vector3, 
    quaternion: THREE.Quaternion 
  } {
    const direction = new THREE.Vector3().subVectors(end, start);
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Cylindre par défaut aligné sur Y, on doit le réorienter
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      up, 
      direction.clone().normalize()
    );
    
    return { center, quaternion };
  }

  // ========================================================================
  // OPÉRATIONS VECTORIELLES
  // ========================================================================

  /**
   * Calcule la direction normalisée de 'from' vers 'to'
   * @returns Vector3 normalisé, ou (0,0,0) si distance nulle
   */
  static computeNormalizedDirection(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    
    if (length < this.EPSILON) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    return direction.divideScalar(length);
  }

  /**
   * Projette un vecteur sur un axe
   * @param vector Vecteur à projeter
   * @param axis Axe de projection (doit être normalisé)
   * @returns Magnitude de la projection
   */
  static projectVectorOnAxis(vector: THREE.Vector3, axis: THREE.Vector3): number {
    return vector.dot(axis);
  }

  /**
   * Calcule la composante radiale de la vitesse (pour amortissement)
   * @param velocity Vecteur vitesse
   * @param direction Direction de la contrainte (normalisée)
   * @returns Vitesse radiale (scalaire)
   */
  static computeRadialVelocity(velocity: THREE.Vector3, direction: THREE.Vector3): number {
    return velocity.dot(direction);
  }

  /**
   * Projette un vecteur sur un plan défini par sa normale
   */
  static projectOnPlane(vector: THREE.Vector3, planeNormal: THREE.Vector3): THREE.Vector3 {
    const normal = planeNormal.clone().normalize();
    const dot = vector.dot(normal);
    return vector.clone().sub(normal.multiplyScalar(dot));
  }

  // ========================================================================
  // MATRICES
  // ========================================================================

  /**
   * Applique une matrice 3x3 à un vecteur
   * @param matrix Matrice 3x3
   * @param vector Vecteur 3D
   * @returns Vecteur transformé
   */
  static applyMatrix3ToVector(matrix: THREE.Matrix3, vector: THREE.Vector3): THREE.Vector3 {
    const e = matrix.elements;
    return new THREE.Vector3(
      e[0] * vector.x + e[3] * vector.y + e[6] * vector.z,
      e[1] * vector.x + e[4] * vector.y + e[7] * vector.z,
      e[2] * vector.x + e[5] * vector.y + e[8] * vector.z
    );
  }

  /**
   * Calcule la matrice d'inertie inverse pour une boîte
   * (Utilisé pour la physique des corps rigides)
   */
  static computeInverseInertia(mass: number, dimensions: THREE.Vector3): THREE.Matrix3 {
    const Ixx = (1 / 12) * mass * (dimensions.y * dimensions.y + dimensions.z * dimensions.z);
    const Iyy = (1 / 12) * mass * (dimensions.x * dimensions.x + dimensions.z * dimensions.z);
    const Izz = (1 / 12) * mass * (dimensions.x * dimensions.x + dimensions.y * dimensions.y);
    
    const invIxx = Ixx > 0 ? 1 / Ixx : 0;
    const invIyy = Iyy > 0 ? 1 / Iyy : 0;
    const invIzz = Izz > 0 ? 1 / Izz : 0;
    
    return new THREE.Matrix3().set(
      invIxx, 0, 0,
      0, invIyy, 0,
      0, 0, invIzz
    );
  }

  // ========================================================================
  // GÉOMÉTRIE
  // ========================================================================

  /**
   * Calcule l'aire d'un triangle
   * @param v1 Premier sommet
   * @param v2 Deuxième sommet
   * @param v3 Troisième sommet
   * @returns Aire en m²
   */
  static computeTriangleArea(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);
    return cross.length() * 0.5;
  }

  /**
   * Calcule la normale d'un triangle (sens anti-horaire)
   * @param v1 Premier sommet
   * @param v2 Deuxième sommet
   * @param v3 Troisième sommet
   * @returns Normale normalisée
   */
  static computeTriangleNormal(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2);
    return normal.normalize();
  }

  /**
   * Calcule le centroïde (centre géométrique) d'un ensemble de points
   * @param vertices Liste de sommets
   * @returns Position du centroïde
   */
  static computeCentroid(vertices: THREE.Vector3[]): THREE.Vector3 {
    if (vertices.length === 0) {
      return new THREE.Vector3();
    }

    const centroid = new THREE.Vector3();
    for (const vertex of vertices) {
      centroid.add(vertex);
    }
    centroid.divideScalar(vertices.length);

    return centroid;
  }

  /**
   * Calcule le centroïde d'un triangle (moyenne des trois sommets)
   * @param v1 Premier sommet
   * @param v2 Deuxième sommet
   * @param v3 Troisième sommet
   * @returns Centroïde du triangle
   */
  static computeTriangleCentroid(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 {
    return this.computeCentroid([v1, v2, v3]);
  }

  // ========================================================================
  // SÉCURITÉ NUMÉRIQUE
  // ========================================================================

  /**
   * Clamp une valeur entre min et max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Limite la magnitude d'une valeur
   * @param value Valeur à limiter
   * @param maxMagnitude Magnitude maximale (valeur absolue)
   * @returns Valeur limitée
   */
  static clampMagnitude(value: number, maxMagnitude: number): number {
    if (Math.abs(value) > maxMagnitude) {
      return Math.sign(value) * maxMagnitude;
    }
    return value;
  }

  /**
   * Division sécurisée (évite division par zéro)
   * @param numerator Numérateur
   * @param denominator Dénominateur
   * @param fallback Valeur par défaut si dénominateur nul
   * @returns Résultat de la division ou fallback
   */
  static safeDivide(numerator: number, denominator: number, fallback = 0): number {
    if (Math.abs(denominator) < this.EPSILON) {
      return fallback;
    }
    return numerator / denominator;
  }

  /**
   * Vérifie qu'une valeur est finie (pas NaN, pas Infinity)
   * @param value Valeur à vérifier (number ou Vector3)
   * @param context Contexte pour logging (optionnel)
   * @returns true si valide, false sinon
   */
  static ensureFinite(value: number | THREE.Vector3, context?: string): boolean {
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        if (context) {
          console.error(`❌ [MathUtils] Non-finite value in ${context}:`, value);
        }
        return false;
      }
      return true;
    }
    
    // Vector3
    const isValid = isFinite(value.x) && isFinite(value.y) && isFinite(value.z);
    if (!isValid && context) {
      console.error(`❌ [MathUtils] Non-finite Vector3 in ${context}:`, value);
    }
    return isValid;
  }

  // ========================================================================
  // INTERPOLATION
  // ========================================================================

  /**
   * Lerp linéaire
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Lerp vectoriel
   */
  static lerpVector(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.lerp(a.x, b.x, t),
      this.lerp(a.y, b.y, t),
      this.lerp(a.z, b.z, t)
    );
  }

  /**
   * Lissage exponentiel (Exponential Moving Average)
   * 
   * Formule : smooth = α × current + (1 - α) × previous
   * où α = smoothingFactor (0 à 1)
   * 
   * Utilisé pour : Lisser les forces/torques aérodynamiques entre frames
   * 
   * @param current Valeur actuelle (nouveau calcul)
   * @param previous Valeur précédente (lissée)
   * @param smoothingFactor Facteur de lissage (0 = tout ancien, 1 = tout nouveau)
   * @returns Valeur lissée
   */
  static exponentialSmoothing(
    current: THREE.Vector3, 
    previous: THREE.Vector3 | null, 
    smoothingFactor: number
  ): THREE.Vector3 {
    if (!previous) {
      // Premier frame : pas de lissage
      return current.clone();
    }

    const alpha = MathUtils.clamp(smoothingFactor, 0, 1);
    return new THREE.Vector3(
      alpha * current.x + (1 - alpha) * previous.x,
      alpha * current.y + (1 - alpha) * previous.y,
      alpha * current.z + (1 - alpha) * previous.z
    );
  }

  // ========================================================================
  // DISTANCE ET MESURES
  // ========================================================================

  /**
   * Calcule la distance 3D entre deux points
   */
  static distance(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceTo(b);
  }

  /**
   * Calcule la distance au carré (plus rapide, évite sqrt)
   */
  static distanceSquared(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceToSquared(b);
  }

  // ========================================================================
  // UTILITAIRES GÉNÉRIQUES
  // ========================================================================

  /**
   * Initialise une propriété avec une valeur par défaut si non définie
   * @param options Objet contenant les options
   * @param propertyName Nom de la propriété
   * @param defaultValue Valeur par défaut
   * @returns Valeur de la propriété ou valeur par défaut
   */
  static initializeProperty<T>(options: any, propertyName: string, defaultValue: T): T {
    return options?.[propertyName] ?? defaultValue;
  }

  /**
   * Alias pour distance (compatibilité)
   * @deprecated Utiliser distance() à la place
   */
  static distanceBetweenPoints(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return p1.distanceTo(p2);
  }
}

```

---

## Fichier: `ecs/utils/index.ts`

```typescript
/**
 * index.ts - Exports utils
 */

export { MathUtils } from './MathUtils';
export { Logger, LogLevel } from './Logging';

```

---


---

## Statistiques

- **Nombre de fichiers**: 57
- **Répertoire source**: ./src
- **Fichiers exclus**: .legacy/, node_modules/

