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

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';
import { MathUtils } from '../../utils/MathUtils';

// Import des composants physiques existants
import { Kite } from '../../objects/Kite';
import { WindSimulator } from '../physics/WindSimulator';
import { LineSystem } from '../physics/LineSystem';
import { BridleSystem } from '../physics/BridleSystem';
import { AerodynamicsCalculator } from '../physics/AerodynamicsCalculator';
import { KiteController } from '../controllers/KiteController';
import { ControlBarManager } from '../controllers/ControlBarManager';
import { CONFIG } from '../config/SimulationConfig';
import { PhysicsConstants } from '../config/PhysicsConstants';
import { KiteState, WindState, SurfaceForce, WindParams } from '../types'; // Ajouté WindParams

export interface KitePhysicsConfig {
  windSpeed: number; // km/h
  windDirection: number; // degrés
  turbulence: number; // 0-100
  lineLength: number;
  pilotPosition: THREE.Vector3;
  enableConstraints: boolean;
  enableAerodynamics: boolean;
  enableGravity: boolean;
  linearDampingCoeff: number; // Ajouté
  angularDragFactor: number; // Ajouté
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
  private lineSystem!: LineSystem;
  private bridleSystem!: BridleSystem;
  private kiteController!: KiteController;
  private controlBarManager!: ControlBarManager;

  // Référence au kite
  private kite!: Kite;

  // État de rotation de la barre
  private barRotation: number = 0;

  // Forces aérodynamiques pour le log et l'UI
  private lastLiftForce: THREE.Vector3 = new THREE.Vector3();
  private lastDragForce: THREE.Vector3 = new THREE.Vector3();

  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log toutes les 1000ms (1 seconde)
  private startTime: number = Date.now(); // Temps de démarrage pour elapsed time
  private frameCount: number = 0; // Compteur de frames

  constructor(config: Partial<KitePhysicsConfig> = {}) {
    super('KitePhysicsSystem', 10);

    this.logger = Logger.getInstance();
    this.config = {
      windSpeed: CONFIG.wind.defaultSpeed, // km/h
      windDirection: CONFIG.wind.defaultDirection, // degrés
      turbulence: CONFIG.wind.defaultTurbulence, // 0-100
      lineLength: CONFIG.lines.defaultLength,
      pilotPosition: CONFIG.controlBar.position.clone(),
      enableConstraints: true,
      enableAerodynamics: true,
      enableGravity: true,
      linearDampingCoeff: CONFIG.physics.linearDampingCoeff, // Utiliser CONFIG
      angularDragFactor: CONFIG.physics.angularDragFactor, // Utiliser CONFIG
      ...config
    };
  }

  /**
   * Initialise le système (sans le kite, qui est passé via setKite)
   */
  async initialize(): Promise<void> {
    this.logger.info('KitePhysicsSystem initialized', 'KitePhysicsSystem');
    // Le kite sera défini via setKite() avant le premier update
  }

  /**
   * Initialise tous les composants physiques
   */
  private async initializeComponents(): Promise<void> {
    // Créer WindSimulator
    this.windSimulator = new WindSimulator();
    this.windSimulator.setParams({
      speed: this.config.windSpeed,
      direction: this.config.windDirection,
      turbulence: this.config.turbulence
    });

    // Créer LineSystem
    this.lineSystem = new LineSystem(this.config.lineLength);

    // Créer BridleSystem
    this.bridleSystem = new BridleSystem(this.kite.getBridleLengths());

    // Créer KiteController
    this.kiteController = new KiteController(this.kite);
    this.kiteController.setForceSmoothing(this.config.linearDampingCoeff); // Appliquer le damping linéaire

    // Créer ControlBarManager
    this.controlBarManager = new ControlBarManager(this.config.pilotPosition);

    this.logger.info('All physics components initialized', 'KitePhysicsSystem');
  }

  /**
   * Met à jour le kite (doit être appelé avant le premier update)
   */
  setKite(kite: Kite): void {
    this.kite = kite;

    // Réinitialiser les composants avec le nouveau kite
    if (kite) {
      this.initializeComponents();
    }
  }

  /**
   * Définit la rotation de la barre de contrôle
   */
  setBarRotation(rotation: number): void {
    this.barRotation = rotation;
  }

  /**
   * Mise à jour de la physique complète
   */
  update(context: SimulationContext): void {
    if (!this.kite || !this.kiteController) {
      return;
    }

    const deltaTime = Math.min(context.deltaTime, CONFIG.physics.deltaTimeMax);

    // 1. Mettre à jour la rotation de la barre
  this.controlBarManager.setRotation(this.barRotation);

    // 2. Obtenir l'état actuel du kite
    const kiteState = this.kiteController.getState();
    const handles = this.controlBarManager.getHandlePositions(this.kite);

    // 3. Calculer le vent apparent (vent réel - vitesse du kite)
    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      deltaTime
    );

    // 4. Calculer les forces aérodynamiques
    let aeroForces: { lift: THREE.Vector3; drag: THREE.Vector3; gravity: THREE.Vector3; torque: THREE.Vector3; surfaceForces: SurfaceForce[] };

    if (this.config.enableAerodynamics) {
      aeroForces = AerodynamicsCalculator.calculateForces(
        apparentWind,
        this.kite.quaternion,
        this.kite.position,
        kiteState.velocity,
        kiteState.angularVelocity
      );
      this.lastLiftForce.copy(aeroForces.lift);
      this.lastDragForce.copy(aeroForces.drag);
    } else {
      aeroForces = {
        lift: new THREE.Vector3(),
        drag: new THREE.Vector3(),
        gravity: new THREE.Vector3(),
        torque: new THREE.Vector3(),
        surfaceForces: []
      };
      this.lastLiftForce.set(0, 0, 0);
      this.lastDragForce.set(0, 0, 0);
    }

    // 5. Combiner toutes les forces
    const totalForce = new THREE.Vector3()
      .add(aeroForces.lift)
      .add(aeroForces.drag);

    // Ajouter la gravité si activée
    if (this.config.enableGravity && aeroForces.gravity) {
      totalForce.add(aeroForces.gravity);
    }

    // 6. Calculer les tensions des lignes (pour visualisation)
    this.lineSystem.calculateLineTensions(
      this.kite,
      handles,
      deltaTime
    );

    // 7. Calculer les tensions des brides (pour visualisation)
    const bridleTensions = this.bridleSystem.calculateBridleTensions(this.kite);

    // 8. Mettre à jour la visualisation des brides
    this.kite.updateBridleVisualization(bridleTensions);

    // Capturer les tensions pour instrumentation avant intégration
    const lineTensions = this.lineSystem.getTensions();

    // 9. Mettre à jour le contrôleur du kite
    // Note: Le KiteController intègre automatiquement les contraintes via ConstraintSolver
    this.kiteController.update(
      totalForce,
      aeroForces.torque,
      handles,
      deltaTime
    );

    // 10. Mettre à jour les lignes de bridage visuelles (après que les points aient bougé)
    this.kite.updateBridleLines();

    // 11. Gérer la collision au sol (spécifique au kite)
    this.handleGroundCollision(deltaTime);

    // 📊 LOG COMPLET toutes les secondes
    this.frameCount++;
    const currentTime = Date.now();
    if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
      this.lastLogTime = currentTime;
      this.logPhysicsState(
        this.kite,
        this.kiteController.getState(),
        apparentWind,
        {
          lift: aeroForces.lift,
          drag: aeroForces.drag,
          gravity: aeroForces.gravity,
          total: totalForce,
          torque: aeroForces.torque
        },
        lineTensions,
        bridleTensions,
        deltaTime,
        currentTime
      );
    }
  }

  private logPhysicsState(
    kite: Kite,
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
    bridleTensions: ReturnType<BridleSystem['calculateBridleTensions']>,
    deltaTime: number,
    currentTime: number
  ): void {
    if (!this.config.enableAerodynamics) {
      return;
    }

    const elapsedTime = (currentTime - this.startTime) / 1000;
    const safeDelta = Math.max(deltaTime, 1e-6);
    const fps = 1 / safeDelta;

    const euler = new THREE.Euler().setFromQuaternion(kite.quaternion, 'XYZ');
    const pitch = euler.x * (180 / Math.PI);
    const roll = euler.z * (180 / Math.PI);
    const yaw = euler.y * (180 / Math.PI);

    const liftMag = forces.lift.length();
    const dragMag = forces.drag.length();
    const gravityMag = forces.gravity.length();
    const totalForceMag = forces.total.length();
    const torqueMag = forces.torque.length();

    const acceleration = forces.total.clone().divideScalar(CONFIG.kite.mass);
    const ldRatio = dragMag > PhysicsConstants.EPSILON ? liftMag / dragMag : 0;

    const leftTension = lineTensions.left;
    const rightTension = lineTensions.right;
    const tensionDelta = leftTension - rightTension;
    const dominantTension = Math.max(Math.abs(leftTension), Math.abs(rightTension), PhysicsConstants.EPSILON);
    const tensionAsym = (tensionDelta / dominantTension) * 100;

    console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log(`║ 📊 ÉTAT COMPLET DU KITE - Frame #${this.frameCount.toString().padStart(6, '0')}                              ║`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ ⏱️  Temps: ${elapsedTime.toFixed(3)}s | Δt: ${(safeDelta * 1000).toFixed(2)}ms | FPS: ${fps.toFixed(1)}    ║`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 📍 POSITION & ORIENTATION                                                 ║');
    console.log(`║    Position: (${kite.position.x.toFixed(2)}, ${kite.position.y.toFixed(2)}, ${kite.position.z.toFixed(2)}) m`);
    console.log(`║    Distance pilote: ${kite.position.length().toFixed(2)} m`);
    console.log(`║    Angles: Pitch ${pitch.toFixed(1)}° | Roll ${roll.toFixed(1)}° | Yaw ${yaw.toFixed(1)}°`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 🚀 CINÉMATIQUE                                                            ║');
    console.log(`║    Vitesse: (${kiteState.velocity.x.toFixed(2)}, ${kiteState.velocity.y.toFixed(2)}, ${kiteState.velocity.z.toFixed(2)}) m/s | Mag: ${kiteState.velocity.length().toFixed(2)} m/s`);
    console.log(`║    Accélération: (${acceleration.x.toFixed(2)}, ${acceleration.y.toFixed(2)}, ${acceleration.z.toFixed(2)}) m/s² | Mag: ${acceleration.length().toFixed(2)} m/s²`);
    console.log(`║    Vit. angulaire: (${kiteState.angularVelocity.x.toFixed(2)}, ${kiteState.angularVelocity.y.toFixed(2)}, ${kiteState.angularVelocity.z.toFixed(2)}) rad/s | Mag: ${kiteState.angularVelocity.length().toFixed(2)} rad/s`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 💨 AÉRODYNAMIQUE                                                          ║');
    console.log(`║    Vent apparent: (${apparentWind.x.toFixed(2)}, ${apparentWind.y.toFixed(2)}, ${apparentWind.z.toFixed(2)}) m/s | Mag: ${apparentWind.length().toFixed(2)} m/s`);
    console.log(`║    Portance: (${forces.lift.x.toFixed(2)}, ${forces.lift.y.toFixed(2)}, ${forces.lift.z.toFixed(2)}) N | Mag: ${liftMag.toFixed(2)} N`);
    console.log(`║    Traînée: (${forces.drag.x.toFixed(2)}, ${forces.drag.y.toFixed(2)}, ${forces.drag.z.toFixed(2)}) N | Mag: ${dragMag.toFixed(2)} N`);
    console.log(`║    Ratio L/D: ${ldRatio.toFixed(2)}`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log('║ ⚖️  FORCES & COUPLES                                                       ║');
    console.log(`║    Gravité: (${forces.gravity.x.toFixed(2)}, ${forces.gravity.y.toFixed(2)}, ${forces.gravity.z.toFixed(2)}) N | Mag: ${gravityMag.toFixed(2)} N`);
    console.log(`║    Force totale: (${forces.total.x.toFixed(2)}, ${forces.total.y.toFixed(2)}, ${forces.total.z.toFixed(2)}) N | Mag: ${totalForceMag.toFixed(2)} N`);
    console.log(`║    Couple total: (${forces.torque.x.toFixed(2)}, ${forces.torque.y.toFixed(2)}, ${forces.torque.z.toFixed(2)}) N⋅m | Mag: ${torqueMag.toFixed(2)} N⋅m`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 🪢 TENSIONS                                                                ║');
    console.log(`║    Ligne gauche: ${leftTension.toFixed(2)} N | Ligne droite: ${rightTension.toFixed(2)} N`);
    console.log(`║    Asymétrie: ${tensionDelta.toFixed(2)} N (${tensionAsym.toFixed(1)}%)`);
    console.log(`║    Brides: NEZ L/R: ${bridleTensions.leftNez.toFixed(1)}/${bridleTensions.rightNez.toFixed(1)} N`);
    console.log(`║            INTER L/R: ${bridleTensions.leftInter.toFixed(1)}/${bridleTensions.rightInter.toFixed(1)} N`);
    console.log(`║            CENTRE L/R: ${bridleTensions.leftCentre.toFixed(1)}/${bridleTensions.rightCentre.toFixed(1)} N`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * Gère la collision du kite avec le sol
   * Utilise les points anatomiques du kite pour une détection plus précise
   */
  private handleGroundCollision(deltaTime: number): void {
    const groundY = CONFIG.kite.minHeight; // Utiliser la hauteur minimale du kite de la CONFIG
    const restitution = 0.3; // Coefficient de restitution (rebond)
    const frictionCoeff = PhysicsConstants.GROUND_FRICTION; // Coefficient de friction

    const kiteState = this.kiteController.getState();
    const kitePosition = kiteState.position.clone();
    const kiteVelocity = kiteState.velocity.clone();
    const kiteAngularVelocity = kiteState.angularVelocity.clone();

    let hasCollision = false;
    const contactPoints: THREE.Vector3[] = [];

    // Vérifier les points anatomiques clés du kite pour la collision
    // On peut choisir des points comme les extrémités des lattes, le nez, la queue, etc.
    const pointsToCheck = [
      this.kite.getPoint('NEZ'),
      this.kite.getPoint('SPINE_BAS'),
      this.kite.getPoint('BORD_GAUCHE'), // Utiliser BORD_GAUCHE et BORD_DROIT
      this.kite.getPoint('BORD_DROIT'),
      this.kite.getPoint('WHISKER_GAUCHE'),
      this.kite.getPoint('WHISKER_DROIT'),
    ].filter(p => p !== undefined) as THREE.Vector3[];

    for (const localPoint of pointsToCheck) {
      const worldPoint = localPoint.clone().applyQuaternion(this.kite.quaternion).add(kitePosition);

      if (worldPoint.y <= groundY) {
        hasCollision = true;
        contactPoints.push(worldPoint);

        // Ajuster la position pour qu'elle soit sur le sol
        const penetrationDepth = groundY - worldPoint.y;
        kitePosition.y += penetrationDepth; // Pousse le kite hors du sol

        // Calculer la vitesse du point de contact
        const r = worldPoint.clone().sub(kitePosition); // Vecteur du centre de masse au point de contact
        const pointVelocity = kiteVelocity.clone().add(kiteAngularVelocity.clone().cross(r));

        // Appliquer la force de réaction normale (rebond)
        if (pointVelocity.y < 0) {
          const normalImpulse = -pointVelocity.y * (1 + restitution);
          kiteVelocity.y += normalImpulse; // Applique l'impulsion au centre de masse
        }

        // Appliquer la force de friction
        const horizontalVelocity = new THREE.Vector3(pointVelocity.x, 0, pointVelocity.z);
        if (horizontalVelocity.lengthSq() > PhysicsConstants.EPSILON) {
          const frictionForce = horizontalVelocity.clone().normalize().multiplyScalar(-frictionCoeff * horizontalVelocity.length());
          kiteVelocity.add(frictionForce.multiplyScalar(deltaTime)); // Applique la friction au centre de masse
        }
      }
    }

    if (hasCollision) {
      // Mettre à jour l'état du kite avec les nouvelles vitesses et position
      this.kiteController.getState().position.copy(kitePosition);
      this.kiteController.getState().velocity.copy(kiteVelocity);
      this.kiteController.getState().angularVelocity.copy(kiteAngularVelocity);

      // Si la vitesse verticale est très faible, l'annuler pour éviter les micro-rebonds
      if (Math.abs(kiteVelocity.y) < PhysicsConstants.EPSILON) {
        this.kiteController.getState().velocity.y = 0;
      }
    }
  }

  /**
   * Obtient l'état du vent
   */
  getWindState(): WindState {
    if (!this.windSimulator) {
      return { baseSpeed: 0, baseDirection: new THREE.Vector3(), turbulence: 0, gustFrequency: 0, gustAmplitude: 0, time: 0 };
    }

    const windParams = this.windSimulator.getParams();
    return {
      baseSpeed: windParams.speed / 3.6, // Convertir km/h en m/s pour affichage
      baseDirection: new THREE.Vector3(Math.sin((windParams.direction * Math.PI) / 180), 0, -Math.cos((windParams.direction * Math.PI) / 180)),
      turbulence: windParams.turbulence,
      gustFrequency: 0, // Non exposé par WindSimulator.getParams()
      gustAmplitude: 0, // Non exposé par WindSimulator.getParams()
      time: 0 // Non exposé par WindSimulator.getParams()
    };
  }

  /**
   * Obtient l'état du kite
   */
  getKiteState(): KiteState {
    return this.kiteController ? this.kiteController.getState() : {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      orientation: new THREE.Quaternion() // Ajouté orientation
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
    this.config.lineLength = length;
    if (this.kite) {
      this.kite.userData.lineLength = length;
    }
    if (this.lineSystem) {
      this.lineSystem.setLineLength(length);
    }
  }

  /**
   * Met à jour les longueurs des brides
   */
  setBridleLengths(lengths: { nez: number; inter: number; centre: number }): void {
    if (this.kite) {
      this.kite.setBridleLengths(lengths);
      // Recréer le BridleSystem avec les nouvelles longueurs
      this.bridleSystem = new BridleSystem(lengths);
    }
  }

  /**
   * Obtient les longueurs actuelles des brides
   */
  getBridleLengths(): { nez: number; inter: number; centre: number } {
    return this.bridleSystem ? this.bridleSystem.getBridleLengths() : { nez: 0, inter: 0, centre: 0 };
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
    return this.kiteController ? this.kiteController.getForceSmoothing() : this.config.linearDampingCoeff;
  }

  /**
   * Obtient les statistiques du système
   */
  getStats(): any {
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
      lastDragForce: this.lastDragForce.clone()
    };
  }

  /**
   * Accesseurs pour les composants (nécessaires pour DebugRenderer)
   */
  getKiteController(): KiteController {
    return this.kiteController;
  }

  getLineSystem(): LineSystem {
    return this.lineSystem;
  }

  getBridleSystem(): BridleSystem {
    return this.bridleSystem;
  }

  getControlBarManager(): ControlBarManager {
    return this.controlBarManager;
  }

  /**
   * Retourne les forces aérodynamiques actuelles (lift et drag)
   * @returns Objet contenant les vecteurs de force de portance et de traînée
   */
  getAerodynamicForces(): { lift: THREE.Vector3; drag: THREE.Vector3 } {
    return {
      lift: this.lastLiftForce.clone(),
      drag: this.lastDragForce.clone()
    };
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
    if (!this.lineSystem) return null;

    const distances = this.lineSystem.getDistances();
    const tensions = this.lineSystem.getTensions();
    const states = this.lineSystem.getLineStates();

    return {
      lineLength: this.lineSystem.lineLength,
      leftDistance: distances.left,
      rightDistance: distances.right,
      leftTaut: states.leftTaut,
      rightTaut: states.rightTaut,
      leftTension: tensions.left,
      rightTension: tensions.right
    };
  }

  getKite(): Kite | null {
    return this.kite || null;
  }

  getWindSimulator(): WindSimulator {
    return this.windSimulator;
  }

  reset(): void {
    // Réinitialiser le kiteController
    if (this.kite) {
      this.kiteController = new KiteController(this.kite);
      this.kiteController.setForceSmoothing(this.config.linearDampingCoeff);
      
      // Calculer la position initiale avec lignes tendues
      const initialPos = MathUtils.calculateInitialKitePosition(
        this.config.pilotPosition,
        CONFIG.initialization.initialKiteY,
        CONFIG.lines.defaultLength,
        CONFIG.initialization.initialDistanceFactor,
        CONFIG.initialization.initialKiteZ
      );
      
      // Réinitialiser la position et l'orientation du kite
      this.kite.position.copy(initialPos);
      this.kite.rotation.set(0, 0, 0);
      this.kite.quaternion.identity();
    }

    // Réinitialiser la rotation de la barre
    this.barRotation = 0;
    if (this.controlBarManager) {
      this.controlBarManager.setRotation(0);
    }

    // Réinitialiser les sous-systèmes
    if (this.windSimulator) {
      const simulator = this.windSimulator as unknown as { reset?: () => void };
      if (typeof simulator.reset === 'function') {
        simulator.reset();
      }
      this.windSimulator.setParams({
        speed: this.config.windSpeed,
        direction: this.config.windDirection,
        turbulence: this.config.turbulence
      });
    }
    if (this.lineSystem) {
      this.lineSystem.setLineLength(this.config.lineLength);
      // this.lineSystem.resetAll(); // Supprimé car LineSystem n'a pas de resetAll
    }
    if (this.bridleSystem && this.kite) {
      this.bridleSystem = new BridleSystem(this.kite.getBridleLengths());
    }

    // Réinitialiser les compteurs
    this.frameCount = 0;
    this.startTime = Date.now();
    this.lastLogTime = 0;

    this.logger.info('KitePhysicsSystem reset', 'KitePhysicsSystem');
  }

  dispose(): void {
    // Pas de ressources spécifiques à disposer pour l'instant
    this.logger.info('KitePhysicsSystem disposed', 'KitePhysicsSystem');
  }
}
