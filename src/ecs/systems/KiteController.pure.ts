/**
 * KiteController.pure.ts - Contrôleur physique ECS pur du cerf-volant
 *
 * Version ECS pure sans dépendance aux classes legacy (Kite).
 * Gère l'état physique du kite via les composants ECS :
 * - TransformComponent (position, orientation)
 * - PhysicsComponent (velocity, angularVelocity, mass, inertia)
 * - MeshComponent (synchronisation avec Three.js)
 */

import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { MeshComponent } from '@components/MeshComponent';
import { CONFIG } from '@config/SimulationConfig';
import { PhysicsConstants } from '@config/PhysicsConstants';
import { KiteState, HandlePositions } from '@mytypes/PhysicsTypes';
import { PureConstraintSolver } from '@systems/ConstraintSolver.pure';

/**
 * Contrôleur physique ECS pur pour le cerf-volant
 */
export class PureKiteController {
  private kiteEntity: Entity;
  private previousPosition: THREE.Vector3;
  
  // Références aux entités de lignes pour lire la longueur réelle
  private leftLineEntity: Entity | null = null;
  private rightLineEntity: Entity | null = null;

  // États pour les warnings
  private hasExcessiveAccel: boolean = false;
  private hasExcessiveVelocity: boolean = false;
  private hasExcessiveAngular: boolean = false;
  private lastAccelMagnitude: number = 0;
  private lastVelocityMagnitude: number = 0;

  // Lissage temporel des forces
  private smoothedForce: THREE.Vector3;
  private smoothedTorque: THREE.Vector3;
  private forceSmoothingRate: number = PureKiteController.DEFAULT_FORCE_SMOOTHING_RATE;

  // Constantes
  private static readonly DEFAULT_FORCE_SMOOTHING_RATE = 0.1;
  private static readonly MIN_FORCE_SMOOTHING_RATE = 0.1;
  private static readonly MAX_FORCE_SMOOTHING_RATE = 20.0;

  constructor(kiteEntity: Entity) {
    this.kiteEntity = kiteEntity;
    
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    if (!transform) {
      throw new Error('KiteEntity must have TransformComponent');
    }

    this.previousPosition = transform.position.clone();

    // Initialiser les forces lissées avec gravité initiale
    const initialGravity = new THREE.Vector3(0, -CONFIG.kite.mass * CONFIG.physics.gravity, 0);
    this.smoothedForce = initialGravity.clone();
    this.smoothedTorque = new THREE.Vector3();
  }

  /**
   * Configure les entités de lignes pour lecture de la longueur réelle
   */
  setLineEntities(leftLine: Entity | null, rightLine: Entity | null): void {
    this.leftLineEntity = leftLine;
    this.rightLineEntity = rightLine;
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
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    const mesh = this.kiteEntity.getComponent<MeshComponent>('mesh');

    if (!transform || !physics || !mesh) {
      console.error('⚠️ KiteEntity missing required components');
      return;
    }

    // Valider les forces brutes
    const validForces = this.validateForces(forces);
    const validTorque = this.validateTorque(torque);

    // Lissage exponentiel des forces
    const smoothingFactor = 1 - Math.exp(-this.forceSmoothingRate * deltaTime);
    this.smoothedForce.lerp(validForces, smoothingFactor);
    this.smoothedTorque.lerp(validTorque, smoothingFactor);

    // Intégrer la physique
    const newPosition = this.integratePhysics(this.smoothedForce, physics, transform, deltaTime);

    // Résolution itérative des contraintes PBD
    for (let iter = 0; iter < PhysicsConstants.CONSTRAINT_ITERATIONS; iter++) {
      // Appliquer les contraintes de lignes (PBD) - passe les entités pour lire la longueur réelle
      PureConstraintSolver.enforceLineConstraints(
        this.kiteEntity,
        newPosition,
        {
          velocity: physics.velocity,
          angularVelocity: physics.angularVelocity
        },
        handles,
        this.leftLineEntity,
        this.rightLineEntity
      );

      // Appliquer la collision au sol DANS la boucle PBD pour éviter que le kite passe en dessous
      PureConstraintSolver.handleGroundCollision(
        this.kiteEntity,
        newPosition,
        physics.velocity
      );
    }

    // Valider et appliquer la position
    this.validatePosition(newPosition);
    transform.position.copy(newPosition);
    this.previousPosition.copy(newPosition);

    // Mettre à jour l'orientation
    this.updateOrientation(this.smoothedTorque, physics, transform, deltaTime);

    // Synchroniser avec Three.js
    mesh.syncToObject3D({
      position: transform.position,
      quaternion: transform.quaternion,
      scale: transform.scale
    });
  }

  /**
   * Valide les forces appliquées
   */
  private validateForces(forces: THREE.Vector3): THREE.Vector3 {
    if (!forces || forces.length() > PhysicsConstants.MAX_FORCE || isNaN(forces.length())) {
      console.error(`⚠️ Forces invalides: ${forces ? forces.toArray() : "undefined"}`);
      return new THREE.Vector3();
    }
    return forces;
  }

  /**
   * Valide le couple
   */
  private validateTorque(torque: THREE.Vector3): THREE.Vector3 {
    if (!torque || isNaN(torque.length())) {
      console.error(`⚠️ Couple invalide: ${torque ? torque.toArray() : "undefined"}`);
      return new THREE.Vector3();
    }
    return torque;
  }

  /**
   * Intègre les forces pour calculer la nouvelle position (Euler)
   */
  private integratePhysics(
    forces: THREE.Vector3,
    physics: PhysicsComponent,
    transform: TransformComponent,
    deltaTime: number
  ): THREE.Vector3 {
    // Accélération = Force / masse
    const acceleration = forces.clone().divideScalar(physics.mass);
    this.lastAccelMagnitude = acceleration.length();

    // Limiter l'accélération
    this.hasExcessiveAccel = acceleration.length() > PhysicsConstants.MAX_ACCELERATION;
    if (this.hasExcessiveAccel) {
      acceleration.normalize().multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
    }

    // Mise à jour de la vitesse : v(t+dt) = v(t) + a·dt
    physics.velocity.add(acceleration.clone().multiplyScalar(deltaTime));

    // Amortissement linéaire
    const linearDampingFactor = Math.exp(-CONFIG.physics.linearDampingCoeff * deltaTime);
    physics.velocity.multiplyScalar(linearDampingFactor);
    this.lastVelocityMagnitude = physics.velocity.length();

    // Limiter la vitesse
    this.hasExcessiveVelocity = physics.velocity.length() > PhysicsConstants.MAX_VELOCITY;
    if (this.hasExcessiveVelocity) {
      physics.velocity.normalize().multiplyScalar(PhysicsConstants.MAX_VELOCITY);
    }

    // Nouvelle position : x(t+dt) = x(t) + v·dt
    return transform.position.clone().add(physics.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Valide la position finale
   */
  private validatePosition(newPosition: THREE.Vector3): void {
    if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
      console.error(`⚠️ Position NaN détectée! Reset à la position précédente`);
      newPosition.copy(this.previousPosition);
      const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
      if (physics) {
        physics.velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Met à jour l'orientation (dynamique du corps rigide)
   */
  private updateOrientation(
    torque: THREE.Vector3,
    physics: PhysicsComponent,
    transform: TransformComponent,
    deltaTime: number
  ): void {
    // Couple d'amortissement
    const dampTorque = physics.angularVelocity
      .clone()
      .multiplyScalar(-physics.inertia * CONFIG.physics.angularDragFactor);
    const effectiveTorque = torque.clone().add(dampTorque);

    // Accélération angulaire : α = T / I
    const angularAcceleration = effectiveTorque.clone().divideScalar(physics.inertia);

    // Limiter l'accélération angulaire
    if (angularAcceleration.length() > PhysicsConstants.MAX_ANGULAR_ACCELERATION) {
      angularAcceleration.normalize().multiplyScalar(PhysicsConstants.MAX_ANGULAR_ACCELERATION);
    }

    // Mise à jour de la vitesse angulaire
    physics.angularVelocity.add(angularAcceleration.clone().multiplyScalar(deltaTime));

    // Appliquer la rotation
    if (physics.angularVelocity.length() > PhysicsConstants.EPSILON) {
      const deltaRotation = new THREE.Quaternion();
      const axis = physics.angularVelocity.clone().normalize();
      const angle = physics.angularVelocity.length() * deltaTime;
      deltaRotation.setFromAxisAngle(axis, angle);

      transform.quaternion.multiply(deltaRotation);
      transform.quaternion.normalize();
    }
  }

  /**
   * Retourne l'état du kite
   */
  getState(): KiteState {
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');

    if (!transform || !physics) {
      throw new Error('KiteEntity missing required components');
    }

    return {
      position: transform.position.clone(),
      velocity: physics.velocity.clone(),
      angularVelocity: physics.angularVelocity.clone(),
      orientation: transform.quaternion.clone()
    };
  }

  /**
   * Retourne les warnings pour l'affichage
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
      velocityValue: this.lastVelocityMagnitude
    };
  }

  /**
   * Définit le taux de lissage des forces
   */
  setForceSmoothing(rate: number): void {
    this.forceSmoothingRate = Math.max(
      PureKiteController.MIN_FORCE_SMOOTHING_RATE,
      Math.min(PureKiteController.MAX_FORCE_SMOOTHING_RATE, rate)
    );
  }

  /**
   * Retourne le taux de lissage actuel
   */
  getForceSmoothing(): number {
    return this.forceSmoothingRate;
  }
}
