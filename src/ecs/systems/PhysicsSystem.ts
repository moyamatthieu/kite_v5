/**
 * PhysicsSystem.ts - Intégration numérique (Euler semi-implicite)
 * 
 * Intègre les forces/couples en velocité/position.
 * Priorité 50 (après contraintes, avant rendu).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';

// Constantes physiques
const SEMI_IMPLICIT_SCALE = 0.5; // Facteur pour intégration Euler semi-implicite
const MIN_ANGULAR_VELOCITY_SQ = 0.0001; // Seuil minimum pour rotation

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

      // v_new = v_old + (F / m) × dt
      const acceleration = physics.forces.clone().multiplyScalar(physics.invMass);
      physics.velocity.add(acceleration.multiplyScalar(deltaTime));

      // Damping continu (exponentiel) : v *= exp(-linearDamping × dt)
      // Au lieu de v *= 0.8 (multiplicatif qui dépend de dt)
      const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
      physics.velocity.multiplyScalar(dampingFactor);

      // p_new = p_old + v_new × dt (semi-implicite : utilise nouvelle vélocité)
      const deltaPos = physics.velocity.clone().multiplyScalar(deltaTime);
      transform.position.add(deltaPos);

      // Vérification finale NaN (seulement si erreur détectée)
      if (isNaN(transform.position.x)) {
        console.error(`❌ [PhysicsSystem] NaN after update for ${entity.id}:`);
        console.error('  deltaTime:', deltaTime, 'velocity:', physics.velocity);
        console.error('  forces:', physics.forces, 'mass:', physics.mass);
      }
      
      // --- Dynamique angulaire ---
      // ω_new = ω_old + (I^-1 × τ) × dt
      const angularAcceleration = this.multiplyMatrix3Vector(physics.invInertia, physics.torques);
      physics.angularVelocity.add(angularAcceleration.multiplyScalar(deltaTime));
      
      // Damping angulaire
      physics.angularVelocity.multiplyScalar(physics.angularDamping);
      
      // Intégration rotation (quaternion)
      // q_new = q_old + 0.5 × (ω × q_old) × dt
      if (physics.angularVelocity.lengthSq() > MIN_ANGULAR_VELOCITY_SQ) {
        const omegaQuat = new THREE.Quaternion(
          physics.angularVelocity.x,
          physics.angularVelocity.y,
          physics.angularVelocity.z,
          0
        );
        const qDot = omegaQuat.multiply(transform.quaternion.clone());
        const scale = SEMI_IMPLICIT_SCALE * deltaTime;
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
    const e = matrix.elements;
    return new THREE.Vector3(
      e[0] * vector.x + e[3] * vector.y + e[6] * vector.z,
      e[1] * vector.x + e[4] * vector.y + e[7] * vector.z,
      e[2] * vector.x + e[5] * vector.y + e[8] * vector.z
    );
  }

  /**
   * Réinitialise les accumulateurs de forces après intégration
   */
  private clearForces(physics: PhysicsComponent): void {
    physics.forces.set(0, 0, 0);
    physics.torques.set(0, 0, 0);
  }
}
