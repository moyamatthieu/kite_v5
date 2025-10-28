/**
 * SurfaceComponent.ts - Composant ECS pour les surfaces
 *
 * Contient les données des surfaces triangulaires ou polygonales.
 * Remplace l'objet Surface dans l'architecture ECS pure.
 */

import * as THREE from 'three';
import { Component } from '@base/Component';

/**
 * Composant contenant les données d'une surface
 */
export class SurfaceComponent implements Component {
  readonly type = 'surface';

  // Points formant la surface
  public points: THREE.Vector3[] = [];

  /**
   * Ajoute un point à la surface
   */
  addPoint(point: THREE.Vector3): void {
    this.points.push(point.clone());
  }

  /**
   * Calcule le centroïde de la surface
   */
  calculateCentroid(): THREE.Vector3 {
    if (this.points.length === 0) {
      return new THREE.Vector3();
    }

    const total = this.points.reduce((acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z;
      return acc;
    }, new THREE.Vector3());

    return total.divideScalar(this.points.length);
  }

  /**
   * Calcule l'aire de la surface (approximation pour polygones)
   */
  calculateArea(): number {
    if (this.points.length < 3) {
      return 0;
    }

    // Pour les triangles
    if (this.points.length === 3) {
      const v1 = this.points[1].clone().sub(this.points[0]);
      const v2 = this.points[2].clone().sub(this.points[0]);
      return v1.cross(v2).length() * 0.5;
    }

    // Pour les polygones plus complexes, triangulation simple
    let area = 0;
    const firstPoint = this.points[0];
    for (let i = 1; i < this.points.length - 1; i++) {
      const v1 = this.points[i].clone().sub(firstPoint);
      const v2 = this.points[i + 1].clone().sub(firstPoint);
      area += v1.cross(v2).length() * 0.5;
    }

    return area;
  }

  /**
   * Obtient les points de la surface
   */
  getPoints(): THREE.Vector3[] {
    return this.points.map(p => p.clone());
  }
}