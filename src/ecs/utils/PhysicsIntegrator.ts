/**
 * PhysicsIntegrator.ts - Logique d'intégration physique
 * 
 * Contient les méthodes pour intégrer les forces et couples afin de mettre à jour
 * la position et la vitesse des entités.
 */

import * as THREE from 'three';

import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { PhysicsConstants } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

export class PhysicsIntegrator {

  /**
   * Intègre les forces et couples pour mettre à jour la physique d'une entité.
   * Utilise un intégrateur Euler semi-implicite.
   *
   * @param transform Le composant de transformation de l'entité.
   * @param physics Le composant physique de l'entité.
   * @param deltaTime Le temps écoulé depuis la dernière mise à jour (en secondes).
   */
  public static integrate(entityId: string, transform: TransformComponent, physics: PhysicsComponent, deltaTime: number): void {
    // --- Dynamique linéaire ---
    // Protection contre les NaN dans les forces
    if (isNaN(physics.forces.x) || isNaN(physics.forces.y) || isNaN(physics.forces.z)) {
      console.error(`❌ [PhysicsIntegrator] NaN in forces for entity ${entityId}:`, physics.forces);
      physics.forces.set(0, 0, 0);
    }

    // Limite de sécurité pour les forces (évite les explosions numériques)
    const maxForce = 5000; // N - limite réaliste pour un cerf-volant
    if (physics.forces.lengthSq() > maxForce * maxForce) {
      physics.forces.normalize().multiplyScalar(maxForce);
    }

    // Calcul de l'accélération : a = F / m
    const acceleration = physics.forces.clone().multiplyScalar(physics.invMass);

    // Limite de sécurité pour l'accélération
    const maxAcceleration = 500; // m/s²
    if (acceleration.lengthSq() > maxAcceleration * maxAcceleration) {
      acceleration.normalize().multiplyScalar(maxAcceleration);
    }

    // Mise à jour de la vitesse : v_new = v_old + a * dt
    physics.velocity.add(acceleration.multiplyScalar(deltaTime));

    // Limite de sécurité pour la vitesse
    const maxVelocity = 200; // m/s
    if (physics.velocity.lengthSq() > maxVelocity * maxVelocity) {
      physics.velocity.normalize().multiplyScalar(maxVelocity);
    }

    // Amortissement continu (exponentiel) : v *= exp(-linearDamping * dt)
    const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
    physics.velocity.multiplyScalar(dampingFactor);

    // Mise à jour de la position : p_new = p_old + v_new * dt (semi-implicite)
    const deltaPos = physics.velocity.clone().multiplyScalar(deltaTime);
    transform.position.add(deltaPos);

    // --- Dynamique angulaire ---
    // Protection contre les NaN dans les couples
    if (isNaN(physics.torques.x) || isNaN(physics.torques.y) || isNaN(physics.torques.z)) {
      console.error(`❌ [PhysicsIntegrator] NaN in torques for entity ${entityId}:`, physics.torques);
      physics.torques.set(0, 0, 0);
    }

    // Calcul de l'accélération angulaire : ω_dot = I⁻¹ * τ (utilise vrai tenseur d'inertie)
    // Applique la matrice inverse d'inertie aux torques pour accélération angulaire précise
    const angularAcceleration = MathUtils.applyMatrix3ToVector(physics.invInertia, physics.torques.clone());

    // Mise à jour de la vitesse angulaire : ω_new = ω_old + ω_dot * dt
    physics.angularVelocity.add(angularAcceleration.multiplyScalar(deltaTime));

    // Amortissement angulaire
    const angularDampingFactor = Math.exp(-physics.angularDamping * deltaTime);
    physics.angularVelocity.multiplyScalar(angularDampingFactor);

    // Mise à jour de l'orientation (quaternion)
    // dq/dt = 0.5 * ω * q
    // Utiliser setFromAxisAngle pour créer un quaternion de rotation basé sur la vitesse angulaire
    const rotationAngle = physics.angularVelocity.length() * deltaTime;
    if (rotationAngle > 0.0001) { // Éviter la création de quaternion pour des rotations négligeables
      const rotationAxis = physics.angularVelocity.clone().normalize();
      const deltaRotation = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
      transform.quaternion.multiplyQuaternions(deltaRotation, transform.quaternion);
      transform.quaternion.normalize(); // Assurer que le quaternion reste normalisé
    }

    // Réinitialiser les forces et couples accumulés pour le prochain frame
    physics.forces.set(0, 0, 0);
    physics.torques.set(0, 0, 0);
  }
}
