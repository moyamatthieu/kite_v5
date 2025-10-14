import * as THREE from 'three';

/**
 * Classe représentant un point dans l'espace 3D.
 */
export class Point {
  position: THREE.Vector3;

  constructor(x: number, y: number, z: number) {
    this.position = new THREE.Vector3(x, y, z);
  }

  /**
   * Applique une transformation à ce point.
   * @param matrix - Matrice de transformation.
   */
  applyTransformation(matrix: THREE.Matrix4): void {
    this.position.applyMatrix4(matrix);
  }

  /**
   * Retourne les coordonnées du point dans l'espace monde.
   * @param matrix - Matrice de transformation locale → monde.
   * @returns Coordonnées transformées.
   */
  toWorldCoordinates(matrix: THREE.Matrix4): THREE.Vector3 {
    return this.position.clone().applyMatrix4(matrix);
  }

  /**
   * Sérialise le point en JSON.
   * @returns Représentation JSON du point.
   */
  toJSON(): Record<string, any> {
    return {
      position: this.position.toArray(),
    };
  }

  /**
   * Converts the Point instance to a THREE.Vector3.
   * @returns A THREE.Vector3 representation of the Point.
   */
  toVector3(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y, this.position.z);
  }

  /**
   * Calculates the distance to another Point.
   * @param other - The other Point instance.
   * @returns The distance between the two points.
   */
  distanceTo(other: Point): number {
    return this.toVector3().distanceTo(other.toVector3());
  }
}
