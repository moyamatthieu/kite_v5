/**
 * MathUtils.ts - Fonctions mathématiques utilitaires
 */

import * as THREE from 'three';

export class MathUtils {
  /**
   * Crée un quaternion depuis des angles d'Euler (degrés)
   */
  static quaternionFromEuler(pitch: number, yaw: number, roll: number): THREE.Quaternion {
    const euler = new THREE.Euler(
      pitch * Math.PI / 180,
      yaw * Math.PI / 180,
      roll * Math.PI / 180,
      'XYZ'
    );
    return new THREE.Quaternion().setFromEuler(euler);
  }
  
  /**
   * Clamp une valeur entre min et max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Lerp linéaire
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  /**
   * Calcule la distance 3D entre deux points
   */
  static distance(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceTo(b);
  }
  
  /**
   * Projette un vecteur sur un plan défini par sa normale
   */
  static projectOnPlane(vector: THREE.Vector3, planeNormal: THREE.Vector3): THREE.Vector3 {
    const normal = planeNormal.clone().normalize();
    const dot = vector.dot(normal);
    return vector.clone().sub(normal.multiplyScalar(dot));
  }
}
