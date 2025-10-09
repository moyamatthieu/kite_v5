/**
 * PhysicsSystem.ts - Système de simulation physique
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';
import { MathUtils } from '../../utils/MathUtils';
import { PHYSICAL_CONSTANTS } from '../../factories/presets/PhysicalPresets';

export interface PhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  angularAcceleration: THREE.Vector3;
  mass: number;
  momentOfInertia: THREE.Matrix3;
}

export interface PhysicsConfig {
  gravityEnabled: boolean;
  airResistanceEnabled: boolean;
  groundCollisionEnabled: boolean;
  maxVelocity: number;
  maxAngularVelocity: number;
  timeStep: number;
  airDensity: number;
  gravity: number;
  minVelocity: number;
}

export class PhysicsSystem extends BaseSimulationSystem {
  private logger: Logger = Logger.getInstance();
  private physicsObjects = new Map<string, PhysicsState>();
  private config: PhysicsConfig;

  constructor(config: Partial<PhysicsConfig> = {}) {
    super('PhysicsSystem', 10); // Priorité 10 (après les systèmes d'entrée)

    this.config = {
      gravityEnabled: true,
      airResistanceEnabled: true,
      groundCollisionEnabled: true,
      maxVelocity: 100,
      maxAngularVelocity: 50,
      airDensity: PHYSICAL_CONSTANTS.airDensity,
      gravity: PHYSICAL_CONSTANTS.gravity,
      minVelocity: 0.01,
      timeStep: 1/60,
      ...config
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('PhysicsSystem initialized', 'PhysicsSystem');
  }

  update(context: SimulationContext): void {
    const deltaTime = Math.min(context.deltaTime, this.config.timeStep);

    // Mise à jour de tous les objets physiques
    for (const [id, state] of this.physicsObjects.entries()) {
      this.updatePhysicsObject(id, state, deltaTime);
    }
  }

  reset(): void {
    this.physicsObjects.clear();
    this.logger.info('PhysicsSystem reset', 'PhysicsSystem');
  }

  dispose(): void {
    this.physicsObjects.clear();
    this.logger.info('PhysicsSystem disposed', 'PhysicsSystem');
  }

  /**
   * Enregistre un objet physique dans le système
   */
  registerPhysicsObject(id: string, initialState: Partial<PhysicsState>): void {
    const state: PhysicsState = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      angularAcceleration: new THREE.Vector3(),
      mass: 1.0,
      momentOfInertia: new THREE.Matrix3().identity(),
      ...initialState
    };

    this.physicsObjects.set(id, state);
    this.logger.debug(`Physics object registered: ${id}`, 'PhysicsSystem');
  }

  /**
   * Désenregistre un objet physique
   */
  unregisterPhysicsObject(id: string): boolean {
    const removed = this.physicsObjects.delete(id);
    if (removed) {
      this.logger.debug(`Physics object unregistered: ${id}`, 'PhysicsSystem');
    }
    return removed;
  }

  /**
   * Obtient l'état physique d'un objet
   */
  getPhysicsState(id: string): PhysicsState | undefined {
    return this.physicsObjects.get(id);
  }

  /**
   * Applique une force à un objet
   */
  applyForce(id: string, force: THREE.Vector3, point?: THREE.Vector3): void {
    const state = this.physicsObjects.get(id);
    if (!state) return;

    // F = ma => a = F/m
    const acceleration = force.clone().divideScalar(state.mass);
    state.acceleration.add(acceleration);

    // Si un point d'application est spécifié, calculer le couple
    if (point) {
      const r = point.clone().sub(state.position);
      const torque = r.clone().cross(force);
      this.applyTorque(id, torque);
    }
  }

  /**
   * Applique un couple (torque) à un objet
   */
  applyTorque(id: string, torque: THREE.Vector3): void {
    const state = this.physicsObjects.get(id);
    if (!state) return;

    // τ = Iα => α = I⁻¹τ
    const angularAcceleration = torque.clone();
    angularAcceleration.applyMatrix3(state.momentOfInertia.clone().invert());
    state.angularAcceleration.add(angularAcceleration);
  }

  /**
   * Met à jour la physique d'un objet
   */
  private updatePhysicsObject(id: string, state: PhysicsState, deltaTime: number): void {
    // Appliquer la gravité
    if (this.config.gravityEnabled) {
      const gravity = new THREE.Vector3(0, -PHYSICAL_CONSTANTS.gravity, 0);
      state.acceleration.add(gravity);
    }

    // Appliquer la résistance de l'air
    if (this.config.airResistanceEnabled) {
      this.applyAirResistance(state);
    }

    // Intégration des accélérations (méthode d'Euler)
    state.velocity.add(state.acceleration.clone().multiplyScalar(deltaTime));
    state.position.add(state.velocity.clone().multiplyScalar(deltaTime));

    // Intégration angulaire
    state.angularVelocity.add(state.angularAcceleration.clone().multiplyScalar(deltaTime));

    // Limiter les vitesses
    this.clampVelocities(state);

    // Collision avec le sol
    if (this.config.groundCollisionEnabled) {
      this.handleGroundCollision(state);
    }

    // Réinitialiser les accélérations pour le prochain frame
    state.acceleration.set(0, 0, 0);
    state.angularAcceleration.set(0, 0, 0);
  }

  /**
   * Applique la résistance de l'air
   */
  private applyAirResistance(state: PhysicsState): void {
    if (state.velocity.lengthSq() < this.config.minVelocity * this.config.minVelocity) {
      return;
    }

    // Force de traînée : F_d = 0.5 * ρ * v² * C_d * A
    // Approximation simplifiée : F_d = -k * v (linéaire)
    const dragCoefficient = 0.1; // Coefficient simplifié
    const dragForce = state.velocity.clone()
      .normalize()
      .multiplyScalar(-dragCoefficient * state.velocity.lengthSq());

    state.acceleration.add(dragForce.divideScalar(state.mass));
  }

  /**
   * Limite les vitesses maximales
   */
  private clampVelocities(state: PhysicsState): void {
    if (state.velocity.length() > this.config.maxVelocity) {
      state.velocity.normalize().multiplyScalar(this.config.maxVelocity);
    }

    if (state.angularVelocity.length() > this.config.maxAngularVelocity) {
      state.angularVelocity.normalize().multiplyScalar(this.config.maxAngularVelocity);
    }
  }

  /**
   * Gère les collisions avec le sol
   */
  private handleGroundCollision(state: PhysicsState): void {
    const groundY = 0;

    if (state.position.y <= groundY && state.velocity.y < 0) {
      // Collision avec le sol
      state.position.y = groundY;
      state.velocity.y *= -0.3; // Coefficient de restitution (rebond)

      // Friction
      const friction = 0.8;
      state.velocity.x *= friction;
      state.velocity.z *= friction;

      // Arrêter si la vitesse est très faible
      if (Math.abs(state.velocity.y) < 0.01) {
        state.velocity.y = 0;
      }
    }
  }

  /**
   * Calcule les forces aérodynamiques (pour usage par d'autres systèmes)
   */
  calculateAerodynamicForces(
    velocity: THREE.Vector3,
    area: number,
    liftCoeff: number,
    dragCoeff: number,
    normal: THREE.Vector3
  ): { lift: THREE.Vector3, drag: THREE.Vector3 } {
    const speed = velocity.length();
    if (speed < this.config.minVelocity) {
      return { lift: new THREE.Vector3(), drag: new THREE.Vector3() };
    }

    const velocityDir = velocity.clone().normalize();

    // Force de portance (perpendiculaire à la vitesse)
    const liftDir = normal.clone().cross(velocityDir).cross(velocityDir).normalize();
    const lift = liftDir.multiplyScalar(0.5 * PHYSICAL_CONSTANTS.airDensity * speed * speed * area * liftCoeff);

    // Force de traînée (opposée à la vitesse)
    const drag = velocityDir.clone().multiplyScalar(-0.5 * PHYSICAL_CONSTANTS.airDensity * speed * speed * area * dragCoeff);

    return { lift, drag };
  }

  /**
   * Obtient tous les IDs des objets physiques
   */
  getPhysicsObjectIds(): string[] {
    return Array.from(this.physicsObjects.keys());
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(newConfig: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('PhysicsSystem config updated', 'PhysicsSystem');
  }

  /**
   * Obtient les statistiques du système
   */
  getStats(): any {
    return {
      objectCount: this.physicsObjects.size,
      config: this.config
    };
  }
}
