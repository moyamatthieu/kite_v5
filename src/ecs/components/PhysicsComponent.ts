/**
 * PhysicsComponent.ts - Composant d'état physique
 *
 * Contient les données physiques d'une entité (vélocité, masse, forces, etc.)
 * Utilisé par les systèmes de physique pour calculer le mouvement.
 */

import * as THREE from 'three';

import { Component } from '@base/Component';

export interface PhysicsComponentData {
  velocity?: THREE.Vector3;
  angularVelocity?: THREE.Vector3;
  mass?: number;
  inertia?: number;
  damping?: number;
}

/**
 * Composant contenant l'état physique d'une entité
 */
export class PhysicsComponent implements Component {
  readonly type = 'physics';

  public velocity: THREE.Vector3;
  public angularVelocity: THREE.Vector3;
  public mass: number;
  public inertia: number;
  public damping: number;

  // Forces accumulées (reset à chaque frame)
  public forces: THREE.Vector3;
  public torques: THREE.Vector3;

  constructor(data: PhysicsComponentData = {}) {
    this.velocity = data.velocity?.clone() || new THREE.Vector3();
    this.angularVelocity = data.angularVelocity?.clone() || new THREE.Vector3();
    this.mass = data.mass || 1.0;
    this.inertia = data.inertia || 1.0;
    this.damping = data.damping || 0.0;

    this.forces = new THREE.Vector3();
    this.torques = new THREE.Vector3();
  }

  /**
   * Ajoute une force
   */
  addForce(force: THREE.Vector3): void {
    this.forces.add(force);
  }

  /**
   * Ajoute un couple (torque)
   */
  addTorque(torque: THREE.Vector3): void {
    this.torques.add(torque);
  }

  /**
   * Reset les forces accumulées
   */
  clearForces(): void {
    this.forces.set(0, 0, 0);
    this.torques.set(0, 0, 0);
  }

  /**
   * Clone le composant
   */
  clone(): PhysicsComponent {
    return new PhysicsComponent({
      velocity: this.velocity,
      angularVelocity: this.angularVelocity,
      mass: this.mass,
      inertia: this.inertia,
      damping: this.damping
    });
  }
}