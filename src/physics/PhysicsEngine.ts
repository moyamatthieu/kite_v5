/**
 * PhysicsEngine.ts - Moteur physique principal
 *
 * Responsabilité : Orchestrer toute la simulation physique du cerf-volant,
 * intégrer les forces et gérer les interactions entre les composants
 */
import * as THREE from "three";
import { WindSimulator } from "../simulation/WindSimulator";
import { LineSystem } from "../physics/LineSystem";
import { KiteController } from "../controllers/KiteController";
import { ControlBarManager } from "../controls/ControlBarManager";
import { AerodynamicsCalculator } from "../physics/AerodynamicsCalculator";
import { CONFIG } from "../config/GlobalConfig";
import type { WindParams } from "../types/wind";
import type { Kite } from "../objects/organic/Kite";
import { logger } from "../utils/Logger";

export class PhysicsEngine {
  private windSimulator: WindSimulator;
  private lineSystem: LineSystem;
  private kiteControllers: KiteController[] = [];
  private controlBarManager: ControlBarManager;

  private _lastKitePos: THREE.Vector3 | null = null;
  private readonly MOVEMENT_THRESHOLD: number = 0.01; // m - Augmenté pour performance (1cm)
  private _aeroStart: number = 0;
  private _linesStart: number = 0;

  // Optimisation fréquence : calculs lourds à 30 FPS au lieu de 60
  private _frameCount: number = 0;
  private _lastHeavyCalc: {
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    aeroTorque: THREE.Vector3;
  } = {
    lift: new THREE.Vector3(),
    drag: new THREE.Vector3(),
    aeroTorque: new THREE.Vector3(),
  };

  // Pool d'objets Vector3 pour éviter les allocations
  private _vectorPool: THREE.Vector3[] = [];
  private _poolIndex: number = 0;
  private readonly VECTOR_POOL_SIZE: number = 50; // Pool de 50 Vector3 pré-alloués

  constructor(kites: Kite[], controlBarPosition: THREE.Vector3) {
    this.windSimulator = new WindSimulator();
    this.lineSystem = new LineSystem();
    kites.forEach((kite) => {
      this.kiteControllers.push(new KiteController(kite));
    });
    this.controlBarManager = new ControlBarManager(controlBarPosition);

    // Initialiser le pool de Vector3
    this.initializeVectorPool();
  }

  /**
   * Initialise un pool de Vector3 pré-alloués pour éviter le GC
   */
  private initializeVectorPool(): void {
    for (let i = 0; i < this.VECTOR_POOL_SIZE; i++) {
      this._vectorPool.push(new THREE.Vector3());
    }
  }

  /**
   * Récupère un Vector3 du pool au lieu d'en créer un nouveau
   */
  private getPooledVector(): THREE.Vector3 {
    const vector = this._vectorPool[this._poolIndex];
    this._poolIndex = (this._poolIndex + 1) % this.VECTOR_POOL_SIZE;
    return vector.set(0, 0, 0); // Reset du vector
  }

  /**
   * LE CŒUR DE LA SIMULATION - Appelée 60 fois par seconde
   *
   * C'est ici que tout se passe ! Cette fonction orchestre toute la physique.
   *
   * VOICI CE QUI SE PASSE À CHAQUE INSTANT :
   * 1. On regarde comment la barre est tournée
   * 2. On calcule où sont les mains du pilote
   * 3. On calcule le vent que ressent le kite
   * 4. On calcule toutes les forces :
   *    - Le vent qui pousse
   *    - Les lignes qui tirent
   *    - La gravité qui attire vers le bas
   * 5. On fait bouger le kite selon ces forces
   *
   * C'est comme une boucle infinie qui simule la réalité !
   */
  public update(
    deltaTime: number,
    targetBarRotation: number,
    isPaused: boolean = false
  ): void {
    const startTime = performance.now();

    // Si en pause, ne rien faire
    if (isPaused) return;

    // Limiter le pas de temps pour éviter l'instabilité numérique
    const cappedDelta = Math.min(deltaTime, CONFIG.physics.deltaTimeMax);

    // Calcul damping adaptatif basé sur vitesse kite avec facteur d'effet
    const kiteState = this.kiteControllers[0].getState();
    const velocityMag = kiteState.velocity.length();
    const dampingMultiplier =
      CONFIG.physics.dampingEffectFactor *
      (1 +
        CONFIG.physics.adaptiveDampingFactor *
          (velocityMag / CONFIG.physics.maxVelocityForDamping));
    const adaptiveLinearDamping =
      CONFIG.physics.linearDamping * dampingMultiplier;
    const adaptiveAngularDamping =
      CONFIG.physics.angularDamping * dampingMultiplier;

    // Appliquer damping adaptatif dans kiteController.update en passant comme paramètres

    // Interpoler la rotation de la barre (lissage des commandes)
    const currentRotation = this.controlBarManager.getRotation();
    const newRotation =
      currentRotation +
      (targetBarRotation - currentRotation) *
        CONFIG.controlBar.interpolationSpeed;
    this.controlBarManager.setRotation(newRotation);

    // Appliquer la physique du retour automatique à l'équilibre
    this.controlBarManager.update(deltaTime);

    // Récupérer l'état actuel du système
    const handles = this.controlBarManager.getHandlePositions(
      this.kiteControllers[0].getKite().position
    );

    // Vent apparent = vent réel - vitesse du kite (principe de relativité)
    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      cappedDelta
    );

    // Obtenir la référence au kite principal
    const kite = this.kiteControllers[0].getKite();
    const currentPos = kite.getWorldPosition(new THREE.Vector3());
    const hasMoved =
      !this._lastKitePos ||
      currentPos.distanceTo(this._lastKitePos) > this.MOVEMENT_THRESHOLD;

    // Calculs aéro : alternance 30 FPS pour performance
    this._aeroStart = performance.now();
    let lift = this._lastHeavyCalc.lift;
    let drag = this._lastHeavyCalc.drag;
    let aeroTorque = this._lastHeavyCalc.aeroTorque;

    // Recalcul tous les 2 frames (30 FPS) et seulement si movement
    if (hasMoved && this._frameCount % 2 === 0) {
      // DEBUG: Compteur d'allocations Vector3
      let allocCount = 0;
      const {
        lift: l,
        drag: d,
        torque: t,
      } = AerodynamicsCalculator.calculateForces(apparentWind, kite.quaternion);
      this._lastHeavyCalc.lift.copy(l);
      this._lastHeavyCalc.drag.copy(d);
      this._lastHeavyCalc.aeroTorque.copy(t);
      lift = l;
      drag = d;
      aeroTorque = t;
    }
    this._frameCount++;
    const aeroTime = performance.now() - this._aeroStart;

    // Gravité (force constante vers le bas)
    const gravity = new THREE.Vector3(
      0,
      -CONFIG.kite.mass * CONFIG.physics.gravity,
      0
    );

    // Lignes seulement si moved
    this._linesStart = performance.now();
    let leftForce = new THREE.Vector3();
    let rightForce = new THREE.Vector3();
    let lineTorque = new THREE.Vector3();
    if (hasMoved) {
      const pilotPosition = this.controlBarManager.getPosition();
      const {
        leftForce: lf,
        rightForce: rf,
        torque: lt,
      } = this.lineSystem.calculateLineTensions(
        kite,
        this.controlBarManager.getRotation(),
        pilotPosition
      );
      leftForce = lf;
      rightForce = rf;
      lineTorque = lt;
      // Si updateLines pour visuel, appeler ici si besoin
      // this.lineSystem.updateLines(currentPos, this.controlBarManager.getHandlePositions(kite.position).left); // Adapter
    }
    const linesTime = performance.now() - this._linesStart;

    // Somme vectorielle de toutes les forces (2ème loi de Newton)
    const totalForce = new THREE.Vector3()
      .add(lift)
      .add(drag)
      .add(gravity)
      .add(leftForce)
      .add(rightForce);

    // Couple total = somme des moments (rotation du corps rigide)
    let aeroAlloc = 0;
    // Le couple émerge NATURELLEMENT sans facteur artificiel!
    const totalTorque = aeroTorque.clone().add(lineTorque);

    // Intégration physique : F=ma et T=Iα pour calculer nouvelle position/orientation
    this.kiteControllers.forEach((controller) => {
      const currentKite = controller.getKite();
      const currentHandles = this.controlBarManager.getHandlePositions(
        currentKite.position
      );
      // DEBUG: Estimation grossière des allocations Vector3 dans aéro
      aeroAlloc += 16; // 4 triangles × 4 allocations typiques
      controller.update(
        totalForce,
        totalTorque,
        currentHandles,
        deltaTime,
        adaptiveLinearDamping,
        adaptiveAngularDamping
      );
    });

    this._lastKitePos = hasMoved ? currentPos.clone() : this._lastKitePos;

    // Profiling optimisé - utilise le logger pour éviter le flood
    const totalTime = performance.now() - startTime;
    if (totalTime > 16) {
      // Utilise le logger importé statiquement
      logger.warn(
        `Physique lente: ${totalTime.toFixed(1)}ms | Aéro: ${aeroTime.toFixed(1)}ms | Lignes: ${linesTime.toFixed(1)}ms`
      );
    }
  }

  private calculateAngleOfAttack(relativeVel: THREE.Vector3): number {
    // α = atan2(vy, vz) simplifié pour kite face vent -Z
    return Math.atan2(relativeVel.y, -relativeVel.z); // En radians
  }

  setBridleFactor(_factor: number): void {
    // Fonctionnalité désactivée dans V8 - physique émergente pure
  }

  setWindParams(params: Partial<WindParams>): void {
    this.windSimulator.setParams(params);
  }

  setLineLength(length: number): void {
    this.lineSystem.setLineLength(length);
    this.kiteControllers.forEach((controller) => {
      controller.setLineLength(length);
    });
  }

  getKiteControllers(): KiteController[] {
    return this.kiteControllers;
  }

  getWindSimulator(): WindSimulator {
    return this.windSimulator;
  }

  getLineSystem(): LineSystem {
    return this.lineSystem;
  }

  getControlBarManager(): ControlBarManager {
    return this.controlBarManager;
  }
}
