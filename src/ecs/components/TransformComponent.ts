/**
 * TransformComponent.ts - Composant de transformation spatiale
 *
 * Contient les données de position, rotation et échelle d'une entité.
 * Utilisé par tous les objets 3D de la simulation.
 */

import * as THREE from 'three';

import { Component } from '@base/Component';

export interface TransformComponentData {
  position?: THREE.Vector3;
  rotation?: number;  // Rotation autour de Y (en radians)
  quaternion?: THREE.Quaternion;
  scale?: THREE.Vector3;
}

/**
 * Composant contenant la transformation spatiale d'une entité
 */
export class TransformComponent implements Component {
  readonly type = 'transform';

  public position: THREE.Vector3;
  public rotation: number;
  public quaternion: THREE.Quaternion;
  public scale: THREE.Vector3;

  constructor(data: TransformComponentData = {}) {
    this.position = data.position?.clone() || new THREE.Vector3();
    this.rotation = data.rotation || 0;
    this.quaternion = data.quaternion?.clone() || new THREE.Quaternion();
    this.scale = data.scale?.clone() || new THREE.Vector3(1, 1, 1);
  }

  /**
   * Synchronise le quaternion avec la rotation
   */
  syncQuaternionFromRotation(): void {
    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
  }

  /**
   * Synchronise la rotation avec le quaternion
   */
  syncRotationFromQuaternion(): void {
    const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'XYZ');
    this.rotation = euler.y;
  }

  /**
   * Clone le composant
   */
  clone(): TransformComponent {
    return new TransformComponent({
      position: this.position,
      rotation: this.rotation,
      quaternion: this.quaternion,
      scale: this.scale
    });
  }
}