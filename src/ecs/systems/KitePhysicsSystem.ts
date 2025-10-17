/**
 * KitePhysicsSystem.ts - Système physique complet pour le kite
 *
 * Intègre tous les composants physiques existants dans l'architecture ECS:
 * - WindSimulator (vent apparent)
 * - AerodynamicsCalculator (forces aéro)
 * - LineSystem (contraintes lignes)
 * - BridleSystem (contraintes brides)
 * - ConstraintSolver (PBD)
 * - KiteController (intégration)
 */

import * as THREE from "three";
import { BaseSimulationSystem, SimulationContext } from '@ecs/base/BaseSimulationSystem';
import { Logger } from '@ecs/utils/Logging';
import { MathUtils } from '@ecs/utils/MathUtils';
import { CONFIG } from '@ecs/config/SimulationConfig';
import { PhysicsConstants } from '@ecs/config/PhysicsConstants';
import { KiteState, WindState, SurfaceForce, WindParams, HandlePositions} from '@mytypes/PhysicsTypes';
import { WindSimulator } from '@ecs/systems/WindSimulator';
import { AerodynamicsCalculator } from '@ecs/systems/AerodynamicsCalculator';
import { EntityManager } from '@entities/EntityManager';
import { Entity } from "@base/Entity";
import { KiteComponent } from "@components/KiteComponent";
import { TransformComponent } from "@components/TransformComponent";
import { PhysicsComponent } from "@components/PhysicsComponent";

import { PureKiteController } from '@/ecs/systems/KiteController';
import { PureBridleSystem } from "@/ecs/systems/BridleSystem";
import { PureLineSystem } from "@/ecs/systems/LineSystem";

export interface KitePhysicsHandles {
  getHandlePositions: () => HandlePositions | null;
}

export interface KitePhysicsConfig {
  windSpeed: number; // km/h
  windDirection: number; // degrés
  turbulence: number; // 0-100
  lineLength: number;
  pilotPosition: THREE.Vector3;
  enableConstraints: boolean;
  enableAerodynamics: boolean;
  enableGravity: boolean;
  linearDampingCoeff: number;
  angularDragFactor: number;
}

/**
 * Système physique complet du kite
 * Intègre tous les sous-systèmes dans une architecture cohérente
 */
export class KitePhysicsSystem extends BaseSimulationSystem {
  private logger: Logger;
  private config: KitePhysicsConfig;

  // Composants physiques
  private windSimulator!: WindSimulator;
  private lineSystem!: PureLineSystem;
  private bridleSystem!: PureBridleSystem;
  private kiteController!: PureKiteController;

  // État de rotation de la barre
  private barRotation: number = 0;

  // Référence au système de barre de contrôle (pour obtenir les positions des poignées)
  private handlesProvider: KitePhysicsHandles | null = null;

  // Forces aérodynamiques pour le log et l'UI
  private lastLiftForce: THREE.Vector3 = new THREE.Vector3();
  private lastDragForce: THREE.Vector3 = new THREE.Vector3();
  private lastSurfaceForces: SurfaceForce[] = []; // Stocker les forces par surface
  private lastApparentWind: THREE.Vector3 = new THREE.Vector3(); // Stocker le vent apparent

  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log toutes les secondes
  private startTime: number = Date.now();
  private frameCount: number = 0;

  // Sphère de vol (pour instrumentation)


  // Added entityManager to KitePhysicsSystem
  private entityManager: EntityManager;

  // Entité et composant du kite
  private kiteEntity: Entity | null = null;
  private kiteComponent: KiteComponent | null = null;

  // Ajout pour stocker les tensions des lignes pour le debug
  private lineTensions: { left: number; right: number } = { left: 0, right: 0 };

  constructor(
    config: Partial<KitePhysicsConfig> = {},
    entityManager: EntityManager
  ) {
    super("KitePhysicsSystem", 60); // Ordre 60 - après ControlPointSystem (50)

    this.logger = Logger.getInstance();
    this.entityManager = entityManager;
    this.config = {
      windSpeed: CONFIG.wind.defaultSpeed, // km/h
      windDirection: CONFIG.wind.defaultDirection, // degrés
      turbulence: CONFIG.wind.defaultTurbulence, // 0-100
      lineLength: CONFIG.lines.defaultLength,
      pilotPosition: new THREE.Vector3(
        CONFIG.pilot.position.x,
        CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
        CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
      ),
      enableConstraints: true,
      enableAerodynamics: true,
      enableGravity: true,
      linearDampingCoeff: CONFIG.physics.linearDampingCoeff, // Utiliser CONFIG
      angularDragFactor: CONFIG.physics.angularDragFactor, // Utiliser CONFIG
      ...config,
    };
  }

  /**
   * Initialise le système (sans le kite, qui est passé via setKite)
   */
  async initialize(): Promise<void> {
    this.logger.info(
      "KitePhysicsSystem initialized (waiting for kite entity)",
      "KitePhysicsSystem"
    );
    // Le kite sera défini via setKite() avant le premier update
  }

  /**
   * Initialise tous les composants physiques
   */
  private async initializeComponents(): Promise<void> {
    // Créer le WindSimulator comme composant interne
    this.windSimulator = new WindSimulator();
    await this.windSimulator.initialize();

    this.windSimulator.setParams({
      speed: this.config.windSpeed,
      direction: this.config.windDirection,
      turbulence: this.config.turbulence,
    });

    // Instancier PureLineSystem (ECS)
    this.lineSystem = new PureLineSystem(this.entityManager);

    // Configurer LineSystem avec les entités ECS
    const leftLine = this.entityManager.getEntity("leftLine");
    const rightLine = this.entityManager.getEntity("rightLine");
    if (leftLine && rightLine) {
      this.lineSystem.setLineEntities(leftLine, rightLine);
      this.logger.info(`LineSystem configured with entities: ${leftLine.id}, ${rightLine.id}`, "KitePhysicsSystem");
    } else {
      this.logger.warn(
        "Line entities not found - system will initialize them",
        "KitePhysicsSystem"
      );
    }

    // Configurer LineSystem avec les entités CTRL (points de contrôle libres)
    const ctrlLeft = this.entityManager.getEntity("ctrl-left");
    const ctrlRight = this.entityManager.getEntity("ctrl-right");
    if (ctrlLeft && ctrlRight) {
      this.lineSystem.setControlPointEntities(ctrlLeft, ctrlRight);
      this.logger.info(`LineSystem configured with CTRL entities: ${ctrlLeft.id}, ${ctrlRight.id}`, "KitePhysicsSystem");
    } else {
      this.logger.warn(
        "CTRL entities not found - LineSystem will use legacy geometry points",
        "KitePhysicsSystem"
      );
    }

    // Instancier PureBridleSystem (ECS)
    this.bridleSystem = new PureBridleSystem(this.entityManager);

    // Configurer BridleSystem avec l'entité kite
    const kiteEntity = this.entityManager.getEntity("kite");
    if (kiteEntity) {
      this.bridleSystem.setKiteEntity(kiteEntity);

      // Instancier PureKiteController avec l'entité kite
      this.kiteController = new PureKiteController(kiteEntity);
      
      // Configurer le KiteController avec les entités de lignes pour lire la longueur réelle
      this.kiteController.setLineEntities(leftLine || null, rightLine || null);
      
      // Configurer le KiteController avec les entités CTRL (points de contrôle)
      if (ctrlLeft && ctrlRight) {
        this.kiteController.setControlPointEntities(ctrlLeft, ctrlRight);
        this.logger.info(`KiteController configured with CTRL entities`, "KitePhysicsSystem");
      } else {
        this.logger.warn(
          "CTRL entities not found - KiteController will skip bridle constraints",
          "KitePhysicsSystem"
        );
      }
    } else {
      throw new Error("Kite entity not found - cannot initialize physics");
    }
  }

  /**
   * Configure le fournisseur de positions des poignées (ControlBarSystem)
   */
  setHandlesProvider(provider: KitePhysicsHandles): void {
    this.handlesProvider = provider;
  }

  /**
   * Met à jour le kite (doit être appelé avant le premier update)
   */
  setKiteEntity(kiteEntity: Entity): void {
    const kiteComponent = kiteEntity.getComponent("kite") as KiteComponent;
    if (!kiteComponent) {
      throw new Error("L'entité fournie n'a pas de KiteComponent.");
    }

    this.kiteEntity = kiteEntity;
    this.kiteComponent = kiteComponent;

    // Réinitialiser les composants avec le nouveau kite
    this.initializeComponents();
  }

  /**
   * Définit la rotation de la barre de contrôle
   */
  setBarRotation(rotation: number): void {
    this.barRotation = rotation;
  }

  update(context: SimulationContext): void {
    if (!this.kiteComponent || !this.kiteController) {
      return;
    }

    // DEBUG: Vérifier la position du kite au début de chaque update
    const initialKiteStateForDebug = this.kiteController.getState();
    if (isNaN(initialKiteStateForDebug.position.x)) {
      this.logger.error('Kite position is NaN at the beginning of update!', 'KitePhysicsSystem', { state: initialKiteStateForDebug });
      return; // Arrêter la mise à jour si l'état est déjà corrompu
    }

    // CRITIQUE : Reset des forces accumulées de la frame précédente
    // Sans ceci, les forces s'accumulent exponentiellement → explosion !
    if (this.kiteEntity) {
      const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
      if (physics) {
        physics.clearForces();
      }
    }

    const deltaTime = Math.min(context.deltaTime, CONFIG.physics.deltaTimeMax);

    // 1. Obtenir l'état actuel du kite
    const kiteState = this.kiteController.getState();
    const handles = this.handlesProvider?.getHandlePositions() || null;

    // Si pas de poignées disponibles, on ne peut pas calculer la physique
    if (!handles) {
      return;
    }

    // 3. Calculer le vent apparent (vent réel - vitesse du kite)
    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      deltaTime
    );
    
    // Stocker le vent apparent pour le debug
    this.lastApparentWind.copy(apparentWind);

    // 4. Calculer les forces aérodynamiques
    let aeroForces: {
      lift: THREE.Vector3;
      drag: THREE.Vector3;
      gravity: THREE.Vector3;
      torque: THREE.Vector3;
      surfaceForces: SurfaceForce[];
    };

    if (this.config.enableAerodynamics) {
      aeroForces = AerodynamicsCalculator.calculateForces(
        apparentWind,
        kiteState.orientation || new THREE.Quaternion(),
        kiteState.position,
        kiteState.velocity,
        kiteState.angularVelocity
      );
      this.lastLiftForce.copy(aeroForces.lift);
      this.lastDragForce.copy(aeroForces.drag);
      this.lastSurfaceForces = aeroForces.surfaceForces; // Stocker les forces
    } else {
      aeroForces = {
        lift: new THREE.Vector3(),
        drag: new THREE.Vector3(),
        gravity: new THREE.Vector3(),
        torque: new THREE.Vector3(),
        surfaceForces: [],
      };
      this.lastLiftForce.set(0, 0, 0);
      this.lastDragForce.set(0, 0, 0);
      this.lastSurfaceForces = []; // Vider le tableau
    }

    // 5. Combiner toutes les forces
    const totalForce = new THREE.Vector3();
    if (this.config.enableAerodynamics) {
      totalForce.add(aeroForces.lift).add(aeroForces.drag);
    }

    // Ajouter la gravité si activée
    if (this.config.enableGravity) {
      totalForce.add(aeroForces.gravity);
    }

    // 6. Calculer les tensions des lignes (pour visualisation)
    if (this.lineSystem) {
      //this.lineSystem.calculateLineTensions(
      //  this.kiteEntity,
      //  handles,
      //  deltaTime
      //);
    }

    // 7. Calculer les tensions des brides (pour visualisation)
    // Les CTRL sont maintenant des entités séparées
    const ctrlLeft = this.entityManager.getEntity("ctrl-left");
    const ctrlRight = this.entityManager.getEntity("ctrl-right");
    const bridleTensions = (this.kiteEntity && ctrlLeft && ctrlRight)
      ? this.bridleSystem.calculateBridleTensions(this.kiteEntity, ctrlLeft, ctrlRight)
      : null;
    if (bridleTensions) {
      // this.logger.info('Bridle tensions calculated', 'KitePhysicsSystem', bridleTensions);
    }

    // Capturer les tensions pour instrumentation avant intégration
    const lineTensions = this.lineSystem.getTensions();
    this.lineTensions = lineTensions; // Stocker pour getDebugInfo
    // this.logger.info('Line tensions calculated', 'KitePhysicsSystem', lineTensions);

    // 9. Mettre à jour le contrôleur du kite
    // Note: Le KiteController intègre automatiquement les contraintes (lignes + sol) via ConstraintSolver
    this.kiteController.update(
      totalForce,
      aeroForces.torque,
      handles,
      deltaTime
    );

    // 10. Mettre à jour les lignes de bridage visuelles (après que les points aient bougé)
    // TODO: Implémenter la mise à jour des lignes de bridage via ECS
    // this.kite.updateBridleLines();

    // 📊 LOG COMPLET toutes les secondes
    this.frameCount++;
    const currentTime = Date.now();
    if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
      this.lastLogTime = currentTime;
      this.logPhysicsState(
        this.kiteEntity,
        this.kiteController.getState(),
        apparentWind,
        {
          lift: aeroForces.lift,
          drag: aeroForces.drag,
          gravity: aeroForces.gravity,
          total: totalForce,
          torque: aeroForces.torque,
        },
        lineTensions || { left: 0, right: 0 },
        bridleTensions || {
          leftNez: 0,
          leftInter: 0,
          leftCentre: 0,
          rightNez: 0,
          rightInter: 0,
          rightCentre: 0,
        },
        deltaTime,
        currentTime
      );
    }
  }

  private logPhysicsState(
    kiteEntity: Entity | null,
    kiteState: KiteState,
    apparentWind: THREE.Vector3,
    forces: {
      lift: THREE.Vector3;
      drag: THREE.Vector3;
      gravity: THREE.Vector3;
      total: THREE.Vector3;
      torque: THREE.Vector3;
    },
    lineTensions: { left: number; right: number },
    bridleTensions: ReturnType<PureBridleSystem['calculateBridleTensions']>,
    deltaTime: number,
    currentTime: number
  ): void {
    if (!this.config.enableAerodynamics || !kiteEntity) {
      return;
    }

    const euler = new THREE.Euler().setFromQuaternion(
      kiteState.orientation || new THREE.Quaternion(),
      'XYZ'
    );
    const pitch = euler.x * PhysicsConstants.RAD_TO_DEG;
    const roll = euler.z * PhysicsConstants.RAD_TO_DEG;
    const yaw = euler.y * PhysicsConstants.RAD_TO_DEG;

    const liftMag = forces.lift.length();
    const dragMag = forces.drag.length();
    const ldRatio = dragMag > PhysicsConstants.EPSILON ? liftMag / dragMag : 0;

    const leftTension = lineTensions.left;
    const rightTension = lineTensions.right;
    const tensionDelta = leftTension - rightTension;
    const dominantTension = Math.max(
      Math.abs(leftTension),
      Math.abs(rightTension),
      PhysicsConstants.EPSILON
    );
    const tensionAsym = (tensionDelta / dominantTension) * 100;

    // Log d'état compact toutes les secondes
    this.logger.debug(
      `Kite State | ` +
        `Pos: [${kiteState.position.x.toFixed(1)}, ${kiteState.position.y.toFixed(
          1
        )}, ${kiteState.position.z.toFixed(1)}] | ` +
        `Vel: ${kiteState.velocity.length().toFixed(1)} m/s | ` +
        `Att: [P:${pitch.toFixed(0)}°, R:${roll.toFixed(0)}°, Y:${yaw.toFixed(
          0
        )}°] | ` +
        `Aero: L/D=${ldRatio.toFixed(2)} (L:${liftMag.toFixed(
          1
        )}N, D:${dragMag.toFixed(1)}N) | ` +
        `Tension: Asym ${tensionAsym.toFixed(0)}% (L:${leftTension.toFixed(
          0
        )}N, R:${rightTension.toFixed(0)}N)`,
      'KitePhysicsSystem'
    );

    // Vérification des instabilités physiques
    const warnings = this.kiteController.getWarnings();
    if (warnings.accel || warnings.velocity || warnings.angular) {
      this.logger.warn(
        `Physics Instability Detected! ` +
          `| Accel: ${warnings.accelValue.toFixed(1)} m/s² (Max: ${
            PhysicsConstants.MAX_ACCELERATION
          }) ` +
          `| Velocity: ${warnings.velocityValue.toFixed(1)} m/s (Max: ${
            PhysicsConstants.MAX_VELOCITY
          })`,
        'KitePhysicsSystem'
      );
    }

    // Vérification des valeurs NaN qui pourraient faire planter la simulation
    if (
      isNaN(kiteState.position.x) ||
      isNaN(kiteState.velocity.x) ||
      (kiteState.orientation && isNaN(kiteState.orientation.x))
    ) {
      this.logger.error(
        'NaN value detected in kite state! Simulation is unstable.',
        'KitePhysicsSystem',
        { kiteState }
      );
    }
  }

  /**
   * Obtient l'état du vent
   */
  getWindState(): WindState {
    if (!this.windSimulator) {
      return {
        baseSpeed: 0,
        baseDirection: new THREE.Vector3(),
        turbulence: 0,
        gustFrequency: 0,
        gustAmplitude: 0,
        time: 0,
      };
    }

    const windParams = this.windSimulator.getParams();
    return {
      baseSpeed: windParams.speed * PhysicsConstants.KMH_TO_MS, // Convertir km/h en m/s pour affichage
      baseDirection: new THREE.Vector3(
        Math.sin(windParams.direction * PhysicsConstants.DEG_TO_RAD),
        0,
        -Math.cos(windParams.direction * PhysicsConstants.DEG_TO_RAD)
      ),
      turbulence: windParams.turbulence,
      gustFrequency: 0, // Non exposé par WindSimulator.getParams()
      gustAmplitude: 0, // Non exposé par WindSimulator.getParams()
      time: 0, // Non exposé par WindSimulator.getParams()
    };
  }

  /**
   * Obtient l'état du kite
   */
  getKiteState(): KiteState {
    return this.kiteController
      ? this.kiteController.getState()
      : {
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          angularVelocity: new THREE.Vector3(),
          orientation: new THREE.Quaternion(), // Ajouté orientation
        };
  }

  /**
   * Met à jour les paramètres du vent
   */
  setWindParams(params: Partial<WindParams>): void {
    if (!this.windSimulator) return;

    const windParams: Partial<WindParams> = {};

    if (params.speed !== undefined) {
      windParams.speed = params.speed; // km/h
      this.config.windSpeed = params.speed;
    }
    if (params.direction !== undefined) {
      windParams.direction = params.direction; // degrés
      this.config.windDirection = params.direction;
    }
    if (params.turbulence !== undefined) {
      windParams.turbulence = params.turbulence; // 0-100
      this.config.turbulence = params.turbulence;
    }

    this.windSimulator.setParams(windParams);
  }

  /**
   * Met à jour la longueur des lignes
   */
  setLineLength(length: number): void {
    this.logger.debug(`KitePhysicsSystem.setLineLength called with: ${length}`, 'KitePhysicsSystem');
    this.config.lineLength = length;
    // TODO: Mettre à jour la longueur des lignes via les composants ECS
    // if (this.kite) {
    //   this.kite.userData.lineLength = length;
    // }
    if (this.lineSystem) {
      this.logger.debug('Delegating to LineSystem...', 'KitePhysicsSystem');
      this.lineSystem.setLineLength(length);
    } else {
      this.logger.warn('LineSystem not initialized!', 'KitePhysicsSystem');
    }
  }

  /**
   * Met à jour les longueurs des brides
   */
  setBridleLengths(lengths: {
    nez: number;
    inter: number;
    centre: number;
  }): void {
    // Mettre à jour les longueurs des brides via le système ECS pur
    this.bridleSystem.setBridleLengths(lengths);
  }

  /**
   * Obtient les longueurs actuelles des brides
   */
  getBridleLengths(): { nez: number; inter: number; centre: number } {
    return this.bridleSystem
      ? this.bridleSystem.getBridleLengths()
      : { nez: 0, inter: 0, centre: 0 };
  }

  /**
   * Met à jour le lissage des forces
   */
  setForceSmoothing(rate: number): void {
    this.config.linearDampingCoeff = rate;
    if (this.kiteController) {
      this.kiteController.setForceSmoothing(rate);
    }
  }

  /**
   * Obtient le lissage des forces actuel
   */
  getForceSmoothing(): number {
    return this.kiteController
      ? this.kiteController.getForceSmoothing()
      : this.config.linearDampingCoeff;
  }

  /**
   * Obtient les statistiques du système
   */
  getStats(): unknown {
    const kiteState = this.getKiteState();
    const windState = this.getWindState();

    return {
      kite: kiteState,
      wind: windState,
      barRotation: this.barRotation,
      config: this.config,
      lineTensions: this.lineSystem.getTensions(),
      bridleTensions: this.bridleSystem.getStats(),
      kiteWarnings: this.kiteController.getWarnings(),
      lastLiftForce: this.lastLiftForce.clone(),
      lastDragForce: this.lastDragForce.clone(),
    };
  }

  /**
   * Accesseurs pour les composants (nécessaires pour DebugRenderer)
   */
  getKiteController(): PureKiteController {
    return this.kiteController;
  }

  getLineSystem(): PureLineSystem {
    return this.lineSystem;
  }

  getBridleSystem(): PureBridleSystem {
    return this.bridleSystem;
  }

  /**
   * Retourne les forces aérodynamiques actuelles (lift et drag)
   * @returns Objet contenant les vecteurs de force de portance et de traînée
   */
  getAerodynamicForces(): { lift: THREE.Vector3; drag: THREE.Vector3; apparentWind: THREE.Vector3 } {
    return {
      lift: this.lastLiftForce.clone(),
      drag: this.lastDragForce.clone(),
      apparentWind: this.lastApparentWind.clone(),
    };
  }

  /**
   * Retourne les forces aérodynamiques par surface (pour le debug)
   */
  getSurfaceForces(): SurfaceForce[] {
    return this.lastSurfaceForces;
  }

  /**
   * Retourne les diagnostics complets des lignes de contrôle
   * @returns Diagnostics incluant longueurs, tensions et états
   */
  getControlLineDiagnostics(): {
    lineLength: number;
    leftDistance: number;
    rightDistance: number;
    leftTaut: boolean;
    rightTaut: boolean;
    leftTension: number;
    rightTension: number;
  } | null {
    if (!this.lineSystem || !this.kiteEntity) return null;

    const handles = this.handlesProvider?.getHandlePositions();
    if (!handles) return null;

    const distances = this.lineSystem.getDistances(this.kiteEntity, handles);
    const tensions = this.lineSystem.getTensions();
    const states = this.lineSystem.getLineStates(this.kiteEntity, handles);

    return {
      lineLength: this.config.lineLength,
      leftDistance: distances.left,
      rightDistance: distances.right,
      leftTaut: states.leftTaut,
      rightTaut: states.rightTaut,
      leftTension: tensions.left,
      rightTension: tensions.right,
    };
  }

  getKiteEntity(): Entity | null {
    return this.kiteEntity || null;
  }

  getWindSimulator(): WindSimulator {
    return this.windSimulator;
  }

  reset(): void {
    // Réinitialiser le kiteController
    if (this.kiteEntity && this.kiteComponent) {
      // TODO: Créer un KiteController basé sur les composants ECS
      // this.kiteController = new KiteController(this.kiteEntity);
      this.kiteController.setForceSmoothing(this.config.linearDampingCoeff);

      // Calculer la position initiale avec lignes tendues
      const initialPos = MathUtils.calculateInitialKitePosition(
        this.config.pilotPosition,
        CONFIG.initialization.initialKiteY,
        CONFIG.lines.defaultLength,
        CONFIG.initialization.initialDistanceFactor,
        CONFIG.initialization.initialKiteZ
      );

      // TODO: Réinitialiser la position et l'orientation via les composants ECS
      const transform =
        this.kiteEntity.getComponent<TransformComponent>("transform");
      if (transform) {
        transform.position.copy(initialPos);
        // transform.rotation.set(0, 0, 0); // rotation is deprecated
        transform.quaternion.identity();
      }
    }

    // Réinitialiser la rotation de la barre
    this.barRotation = 0;

    // Réinitialiser les sous-systèmes
    if (this.windSimulator) {
      const simulator = this.windSimulator as unknown as { reset?: () => void };
      if (typeof simulator.reset === "function") {
        simulator.reset();
      }
      this.windSimulator.setParams({
        speed: this.config.windSpeed,
        direction: this.config.windDirection,
        turbulence: this.config.turbulence,
      });
    }
    if (this.lineSystem) {
      this.lineSystem.setLineLength(this.config.lineLength);
      // this.lineSystem.resetAll(); // Supprimé car LineSystem n'a pas de resetAll
    }
    if (this.bridleSystem) {
      // TODO: Utiliser les longueurs de brides depuis les composants ECS
      // this.bridleSystem = new BridleSystem(this.kiteComponent?.getBridleLengths() || CONFIG.bridle.defaultLengths);
    }

    // Réinitialiser les compteurs
    this.frameCount = 0;
    this.startTime = Date.now();
    this.lastLogTime = 0;

    this.logger.info("KitePhysicsSystem reset", "KitePhysicsSystem");
  }

  /**
   * Retourne les informations de debug
   */
  getDebugInfo(): { lineTensions: { left: number; right: number } } {
    return {
      lineTensions: this.lineTensions,
    };
  }

  dispose(): void {
    this.logger.info("Disposing KitePhysicsSystem", "KitePhysicsSystem");
    this.kiteEntity = null;
    this.kiteComponent = null;
    this.handlesProvider = null;

    if (this.lineSystem) {
      this.lineSystem.dispose();
    }
    if (this.bridleSystem) {
      this.bridleSystem.dispose();
    }
  }
}
