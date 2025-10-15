/**
 * geometry.ts - Utilitaires géométriques pour remplacer les anciens objets
 *
 * Fournit des fonctions utilitaires pour travailler avec la géométrie 3D
 * dans l'architecture ECS pure.
 */

import * as THREE from 'three';

/**
 * Point 3D utilitaire (remplace l'ancien objet Point)
 */
export class Point3D extends THREE.Vector3 {
  constructor(x: number = 0, y: number = 0, z: number = 0) {
    super(x, y, z);
  }

  /**
   * Calcule la distance à un autre point
   */
  distanceTo(other: THREE.Vector3): number {
    return super.distanceTo(other);
  }

  /**
   * Applique une transformation
   */
  applyTransformation(matrix: THREE.Matrix4): Point3D {
    this.applyMatrix4(matrix);
    return this;
  }

  /**
   * Retourne les coordonnées dans l'espace monde
   */
  toWorldCoordinates(matrix: THREE.Matrix4): Point3D {
    return new Point3D().copy(this).applyMatrix4(matrix);
  }
}

/**
 * Frame utilitaire (remplace l'ancien objet Frame)
 */
export class FrameGeometry {
  points: Map<string, Point3D>;
  connections: [string, string][];

  constructor() {
    this.points = new Map();
    this.connections = [];
  }

  addPoint(name: string, point: Point3D): void {
    this.points.set(name, point.clone());
  }

  addConnection(point1: string, point2: string): void {
    this.connections.push([point1, point2]);
  }

  getConnections(): [string, string][] {
    return [...this.connections];
  }

  calculateTotalConnectionLength(): number {
    return this.connections.reduce((total, [point1, point2]) => {
      const p1 = this.points.get(point1);
      const p2 = this.points.get(point2);
      if (p1 && p2) {
        total += p1.distanceTo(p2);
      }
      return total;
    }, 0);
  }
}

/**
 * Surface utilitaire (remplace l'ancien objet Surface)
 */
export class SurfaceGeometry {
  points: Point3D[];

  constructor() {
    this.points = [];
  }

  addPoint(point: Point3D): void {
    this.points.push(point.clone());
  }

  getPoints(): Point3D[] {
    return this.points.map(p => p.clone());
  }

  calculateCentroid(): Point3D {
    if (this.points.length === 0) {
      return new Point3D();
    }

    const total = this.points.reduce((acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z;
      return acc;
    }, new Point3D());

    return total.divideScalar(this.points.length) as Point3D;
  }
}