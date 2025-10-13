/**
 * KiteController.ts - Contrôleur physique du cerf-volant
 *
 * Gère l'état physique du kite, l'intégration des forces et l'application
 * des contraintes géométriques (lignes et brides).
 */

import * as THREE from 'three';

import { Kite } from '../../objects/Kite';
import { CONFIG } from '../config/SimulationConfig';
import { PhysicsConstants } from '../config/PhysicsConstants';
import { KiteState } from '../types';
import { HandlePositions } from '../types';
import { ConstraintSolver } from '../physics/ConstraintSolver';

export class KiteController {
  private kite: Kite;
  private state: KiteState;
  private previousPosition: THREE.Vector3;

  // États pour les warnings
  private hasExcessiveAccel: boolean = false;
  private hasExcessiveVelocity: boolean = false;
  private hasExcessiveAngular: boolean = false;
  private lastAccelMagnitude: number = 0;
  private lastVelocityMagnitude: number = 0;

  // Lissage temporel des forces
  private smoothedForce: THREE.Vector3;
  private smoothedTorque: THREE.Vector3;
  private forceSmoothingRate: number = KiteController.DEFAULT_FORCE_SMOOTHING_RATE;

  // Constantes pour éviter les facteurs magiques
  private static readonly DEFAULT_FORCE_SMOOTHING_RATE = 0.1;
  private static readonly MIN_FORCE_SMOOTHING_RATE = 0.1;
  private static readonly MAX_FORCE_SMOOTHING_RATE = 20.0;

  constructor(kite: Kite) {
    this.kite = kite;
    this.state = {
      position: kite.position.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      orientation: kite.quaternion.clone(),
    };
    this.previousPosition = kite.position.clone();
    this.kite.userData.lineLength = CONFIG.lines.defaultLength;

    // Initialiser les forces lissées avec gravité initiale (évite chute au démarrage)
    const initialGravity = new THREE.Vector3(0, -CONFIG.kite.mass * CONFIG.physics.gravity, 0);
    this.smoothedForce = initialGravity.clone();
    this.smoothedTorque = new THREE.Vector3();
  }

  /**
   * Met à jour la position et l'orientation du cerf-volant
   */
  update(
    forces: THREE.Vector3,
    torque: THREE.Vector3,
    handles: HandlePositions,
    deltaTime: number
  ): void {
    // Valider les forces brutes
    const validForces = this.validateForces(forces);
    const validTorque = this.validateTorque(torque);

    // Lissage exponentiel des forces (indépendant du framerate)
    const smoothingFactor = 1 - Math.exp(-this.forceSmoothingRate * deltaTime);
    this.smoothedForce.lerp(validForces, smoothingFactor);
    this.smoothedTorque.lerp(validTorque, smoothingFactor);

    // Utiliser les forces lissées pour la physique
    const newPosition = this.integratePhysics(this.smoothedForce, deltaTime);

    // Résolution itérative des contraintes PBD pour convergence stable
    for (let iter = 0; iter < PhysicsConstants.CONSTRAINT_ITERATIONS; iter++) {
      // Appliquer les contraintes de lignes (Position-Based Dynamics)
      try {
        ConstraintSolver.enforceLineConstraints(
          this.kite,
          newPosition,
          { velocity: this.state.velocity, angularVelocity: this.state.angularVelocity },
          handles
        );
      } catch (err) {
        console.error(`⚠️ Erreur dans ConstraintSolver.enforceLineConstraints (iter ${iter}):`, err);
      }

      // 🚫 SUPPRIMÉ - Les brides ne sont PLUS des contraintes dynamiques !
      //
      // NOUVELLE ARCHITECTURE :
      // Les brides définissent la géométrie RIGIDE interne du kite.
      // Positions CTRL calculées UNE FOIS par PointFactory.calculateControlPoint()
      // et restent fixes dans le référentiel local du kite.
      //
      // Le kite entier bouge comme un corps rigide 6 DOF sous l'action
      // des forces aérodynamiques. Seules les LIGNES sont des contraintes
      // dynamiques (pivot sphérique 360°).
      //
      // Plus besoin d'enforceBridleConstraints() !
    }

    // Gérer la collision avec le sol
    try {
      ConstraintSolver.handleGroundCollision(this.kite, newPosition, this.state.velocity);
    } catch (err) {
      console.error("⚠️ Erreur dans ConstraintSolver.handleGroundCollision:", err);
    }

    // Valider la position finale
    this.validatePosition(newPosition);

    // Appliquer la position et l'orientation
    this.kite.position.copy(newPosition);
    this.updateOrientation(this.smoothedTorque, deltaTime);
    this.previousPosition.copy(newPosition);
  }

  /**
   * Valide les forces appliquées au cerf-volant
   */
  private validateForces(forces: THREE.Vector3): THREE.Vector3 {
    if (
      !forces ||
      forces.length() > PhysicsConstants.MAX_FORCE ||
      isNaN(forces.length())
    ) {
      console.error(
        `⚠️ Forces invalides: ${forces ? forces.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return forces;
  }

  /**
   * Valide le couple
   */
  private validateTorque(torque: THREE.Vector3): THREE.Vector3 {
    if (!torque || isNaN(torque.length())) {
      console.error(
        `⚠️ Couple invalide: ${torque ? torque.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return torque;
  }

  /**
   * Intègre les forces pour calculer la nouvelle position (méthode d'Euler)
   */
  private integratePhysics(
    forces: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    // Newton : accélération = Force / masse
    const acceleration = forces.clone().divideScalar(CONFIG.kite.mass);
    this.lastAccelMagnitude = acceleration.length();

    // Sécurité : limiter pour éviter l'explosion numérique
    this.hasExcessiveAccel = acceleration.length() > PhysicsConstants.MAX_ACCELERATION;
    if (this.hasExcessiveAccel) {
      acceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
    }

    // Intégration d'Euler : v(t+dt) = v(t) + a·dt
    this.state.velocity.add(acceleration.clone().multiplyScalar(deltaTime));

    // Amortissement exponentiel
    const linearDampingFactor = Math.exp(-CONFIG.physics.linearDampingCoeff * deltaTime);
    this.state.velocity.multiplyScalar(linearDampingFactor);
    this.lastVelocityMagnitude = this.state.velocity.length();

    // Garde-fou vitesse max
    this.hasExcessiveVelocity = this.state.velocity.length() > PhysicsConstants.MAX_VELOCITY;
    if (this.hasExcessiveVelocity) {
      this.state.velocity
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_VELOCITY);
    }

    // Position : x(t+dt) = x(t) + v·dt
    return this.kite.position
      .clone()
      .add(this.state.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Valide la position finale
   */
  private validatePosition(newPosition: THREE.Vector3): void {
    if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
      console.error(`⚠️ Position NaN détectée! Reset à la position précédente`);
      newPosition.copy(this.previousPosition);
      this.state.velocity.set(0, 0, 0);
    }
  }

  /**
   * Met à jour l'orientation du cerf-volant - Dynamique du corps rigide
   */
  private updateOrientation(torque: THREE.Vector3, deltaTime: number): void {
    // Couple d'amortissement
    const dampTorque = this.state.angularVelocity
      .clone()
      .multiplyScalar(-CONFIG.kite.inertia * CONFIG.physics.angularDragFactor);
    const effectiveTorque = torque.clone().add(dampTorque);

    // Dynamique rotationnelle : α = T / I
    const angularAcceleration = effectiveTorque.clone().divideScalar(
      CONFIG.kite.inertia
    );

    // Limiter l'accélération angulaire
    if (
      angularAcceleration.length() > PhysicsConstants.MAX_ANGULAR_ACCELERATION
    ) {
      angularAcceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ANGULAR_ACCELERATION);
    }

    // Mise à jour de la vitesse angulaire
    this.state.angularVelocity.add(
      angularAcceleration.clone().multiplyScalar(deltaTime)
    );

    this.hasExcessiveAngular = false; // Toujours faux pour l'instant

    // Appliquer la rotation
    if (this.state.angularVelocity.length() > PhysicsConstants.EPSILON) {
      const deltaRotation = new THREE.Quaternion();
      const axis = this.state.angularVelocity.clone().normalize();
      const angle = this.state.angularVelocity.length() * deltaTime;
      deltaRotation.setFromAxisAngle(axis, angle);

      this.kite.quaternion.multiply(deltaRotation);
      this.kite.quaternion.normalize();
    }
  }

  getState(): KiteState {
    return { ...this.state };
  }

  getKite(): Kite {
    return this.kite;
  }

  setLineLength(length: number): void {
    this.kite.userData.lineLength = length;
  }

  /**
   * Retourne les états de warning pour l'affichage
   */
  getWarnings(): {
    accel: boolean;
    velocity: boolean;
    angular: boolean;
    accelValue: number;
    velocityValue: number;
  } {
    return {
      accel: this.hasExcessiveAccel,
      velocity: this.hasExcessiveVelocity,
      angular: this.hasExcessiveAngular,
      accelValue: this.lastAccelMagnitude,
      velocityValue: this.lastVelocityMagnitude,
    };
  }

  /**
   * Définit le taux de lissage des forces physiques
   */
  setForceSmoothing(rate: number): void {
    this.forceSmoothingRate = Math.max(
      KiteController.MIN_FORCE_SMOOTHING_RATE,
      Math.min(KiteController.MAX_FORCE_SMOOTHING_RATE, rate)
    );
  }

  /**
   * Retourne le taux de lissage actuel des forces (en 1/s)
   */
  getForceSmoothing(): number {
    return this.forceSmoothingRate;
  }
}