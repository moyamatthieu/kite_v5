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
import { Logger } from '@utils/Logging';
import { CONFIG } from '@config/SimulationConfig';
import { PhysicsConstants } from '@config/PhysicsConstants';
import { KiteState, HandlePositions } from '@mytypes/PhysicsTypes';

import { ConstraintSolverPBD } from '@/ecs/systems/ConstraintSolverPBD';

/**
 * Contrôleur physique ECS pur pour le cerf-volant
 */
export class PureKiteController {
  private kiteEntity: Entity;
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

  // ✅ Méthodes setLineEntities et setControlPointEntities supprimées
  // Les CTRL sont maintenant des points locaux du kite (GeometryComponent)
  // Plus besoin d'entités séparées pour les lignes ou les CTRL

  /**
   * Met à jour la position et l'orientation du cerf-volant
   */
  update(
    forces: THREE.Vector3,
    torque: THREE.Vector3,
    handles: HandlePositions,
    deltaTime: number
  ): void {
    Logger.getInstance().debugThrottled('KiteController.update() called', 'KiteController');
    
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    const mesh = this.kiteEntity.getComponent<MeshComponent>('mesh');

    if (!transform || !physics) {
      Logger.getInstance().error('KiteEntity missing required components (transform or physics)', 'KiteController');
      return;
    }

    // Le mesh peut ne pas encore exister à la première frame (GeometryRenderSystem le crée)
    // Ce n'est pas bloquant pour la physique

    // Valider les forces brutes
    const validForces = this.validateForces(forces);
    const validTorque = this.validateTorque(torque);

    // Lissage exponentiel des forces
    const smoothingFactor = 1 - Math.exp(-this.forceSmoothingRate * deltaTime);
    this.smoothedForce.lerp(validForces, smoothingFactor);
    this.smoothedTorque.lerp(validTorque, smoothingFactor);

    // Intégrer la physique
    const newPosition = this.integratePhysics(this.smoothedForce, physics, transform, deltaTime);

    // Résolution itérative des contraintes PBD (Gauss-Seidel)
    // PHYSICS_MODEL.md Section 8.2 : Itérations successives des 8 contraintes
    
    // Récupérer les longueurs des brides depuis le component kite
    const bridle = this.kiteEntity.getComponent<import('@components/BridleComponent').BridleComponent>('bridle');
    const bridleLengths = bridle ? bridle.lengths : CONFIG.bridle.defaultLengths;

    // ✅ NOUVEAU: PBD complet avec CTRL comme points locaux du kite
    // Architecture couplée inspirée de la branche main + Makani
    // Les CTRL suivent le kite (pas d'entités séparées)
    // Contraintes lignes → correction position + rotation du kite entier
    ConstraintSolverPBD.solveConstraintsGlobal(
      this.kiteEntity,
      handles,
      bridleLengths,
      newPosition,
      { velocity: physics.velocity, angularVelocity: physics.angularVelocity },
      CONFIG.lines.defaultLength
    );

    // Valider et appliquer la position
    this.validatePosition(newPosition);
    transform.position.copy(newPosition);
    this.previousPosition.copy(newPosition);

    // Mettre à jour l'orientation
    this.updateOrientation(this.smoothedTorque, physics, transform, deltaTime);

    // Synchroniser avec Three.js (si le mesh existe déjà)
    if (mesh) {
      mesh.syncToObject3D({
        position: transform.position,
        quaternion: transform.quaternion,
        scale: transform.scale
      });
    }
  }

  /**
   * ❌ SUPPRIMÉ - Décomposition radiale/tangentielle (DIAGNOSTIC_VOL.md Problème #3)
   * 
   * ANCIEN COMPORTEMENT (INCORRECT):
   * - Jetait 67% des forces verticales → empêchait le kite de monter
   * - Architecture fondamentalement incorrecte pour vol libre
   * 
   * ✅ MAKANI-INSPIRED: Appliquer TOUTES les forces
   * - Les contraintes PBD gèrent les limites géométriques
   * - Permet au kite de monter/descendre librement sous portance
   * 
   * Cette méthode est conservée uniquement pour le debug/logging si nécessaire.
   */
  private decomposeForces(
    totalForces: THREE.Vector3,
    pilotPosition: THREE.Vector3,
    kitePosition: THREE.Vector3
  ): { radial: THREE.Vector3; tangential: THREE.Vector3 } {
    // Direction radiale (du pilote vers le kite)
    const radialDirection = kitePosition.clone().sub(pilotPosition);
    const distance = radialDirection.length();

    if (distance < PhysicsConstants.EPSILON) {
      return {
        radial: new THREE.Vector3(),
        tangential: totalForces.clone()
      };
    }

    radialDirection.normalize();

    // Composante radiale
    const radialMagnitude = totalForces.dot(radialDirection);
    const radialForce = radialDirection.clone().multiplyScalar(radialMagnitude);

    // Composante tangentielle
    const tangentialForce = totalForces.clone().sub(radialForce);

    return {
      radial: radialForce,
      tangential: tangentialForce
    };
  }

  /**
   * Valide les forces appliquées
   */
  private validateForces(forces: THREE.Vector3): THREE.Vector3 {
    if (!forces || forces.length() > PhysicsConstants.MAX_FORCE || isNaN(forces.length())) {
      Logger.getInstance().error(`Forces invalides: ${forces ? forces.toArray() : "undefined"}`, 'KiteController');
      return new THREE.Vector3();
    }
    return forces;
  }

  /**
   * Valide le couple
   */
  private validateTorque(torque: THREE.Vector3): THREE.Vector3 {
    if (!torque || isNaN(torque.length())) {
      Logger.getInstance().error(`Couple invalide: ${torque ? torque.toArray() : "undefined"}`, 'KiteController');
      return new THREE.Vector3();
    }
    return torque;
  }

  /**
   * ✨ MAKANI-INSPIRED: Intègre les forces pour calculer la nouvelle position (Euler)
   *
   * CORRECTION CRITIQUE (DIAGNOSTIC_VOL.md Problème #3):
   * - Applique TOUTES les forces (pas seulement tangentielles)
   * - Laisse les contraintes PBD gérer les limites géométriques
   * - Permet au kite de monter sous portance verticale
   */
  private integratePhysics(
    forces: THREE.Vector3,
    physics: PhysicsComponent,
    transform: TransformComponent,
    deltaTime: number
  ): THREE.Vector3 {
    // ✅ MAKANI APPROACH: Appliquer TOUTES les forces
    // F = ma → a = F/m
    const acceleration = forces.clone().divideScalar(physics.mass);
    this.lastAccelMagnitude = acceleration.length();

    // Limiter l'accélération
    this.hasExcessiveAccel = acceleration.length() > PhysicsConstants.MAX_ACCELERATION;
    if (this.hasExcessiveAccel) {
      acceleration.normalize().multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
    }

    // Mise à jour de la vitesse : v(t+dt) = v(t) + a_tangential·dt
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
      Logger.getInstance().error('Position NaN détectée! Reset à la position précédente', 'KiteController');
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
