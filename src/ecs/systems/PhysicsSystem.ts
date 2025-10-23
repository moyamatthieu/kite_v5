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
