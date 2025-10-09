/**
 * GeometryUtils.ts - Utilitaires géométriques pour la simulation 3D
 */

import * as THREE from 'three';

export class GeometryUtils {
  /**
   * Calcule l'aire d'un triangle 3D
   */
  static triangleArea(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
    const edge1 = v2.clone().sub(v1);
    const edge2 = v3.clone().sub(v1);
    const cross = edge1.cross(edge2);
    return cross.length() * 0.5;
  }

  /**
   * Calcule la normale d'un triangle
   */
  static triangleNormal(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 {
    const edge1 = v2.clone().sub(v1);
    const edge2 = v3.clone().sub(v1);
    return edge1.cross(edge2).normalize();
  }

  /**
   * Calcule le centroïde d'un triangle
   */
  static triangleCentroid(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 {
    return v1.clone().add(v2).add(v3).divideScalar(3);
  }

  /**
   * Vérifie si un point est à l'intérieur d'un triangle (dans le plan)
   */
  static pointInTriangle2D(point: THREE.Vector2, v1: THREE.Vector2, v2: THREE.Vector2, v3: THREE.Vector2): boolean {
    const d1 = this.sign(point, v1, v2);
    const d2 = this.sign(point, v2, v3);
    const d3 = this.sign(point, v3, v1);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
  }

  /**
   * Calcule le barycentre d'un ensemble de points
   */
  static centroid(points: THREE.Vector3[]): THREE.Vector3 {
    if (points.length === 0) return new THREE.Vector3();

    const sum = points.reduce((acc, point) => acc.add(point), new THREE.Vector3());
    return sum.divideScalar(points.length);
  }

  /**
   * Calcule la bounding box d'un ensemble de points
   */
  static boundingBox(points: THREE.Vector3[]): { min: THREE.Vector3; max: THREE.Vector3 } {
    if (points.length === 0) {
      return { min: new THREE.Vector3(), max: new THREE.Vector3() };
    }

    const min = points[0].clone();
    const max = points[0].clone();

    for (let i = 1; i < points.length; i++) {
      min.min(points[i]);
      max.max(points[i]);
    }

    return { min, max };
  }

  /**
   * Projette un point sur un plan défini par un point et une normale
   */
  static projectPointOnPlane(point: THREE.Vector3, planePoint: THREE.Vector3, planeNormal: THREE.Vector3): THREE.Vector3 {
    const toPoint = point.clone().sub(planePoint);
    const distance = toPoint.dot(planeNormal);
    return point.clone().sub(planeNormal.clone().multiplyScalar(distance));
  }

  /**
   * Calcule la distance d'un point à un plan
   */
  static pointToPlaneDistance(point: THREE.Vector3, planePoint: THREE.Vector3, planeNormal: THREE.Vector3): number {
    const toPoint = point.clone().sub(planePoint);
    return toPoint.dot(planeNormal);
  }

  /**
   * Vérifie si deux segments se croisent (2D)
   */
  static segmentsIntersect2D(
    a1: THREE.Vector2, a2: THREE.Vector2,
    b1: THREE.Vector2, b2: THREE.Vector2
  ): boolean {
    const denom = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
    if (Math.abs(denom) < 1e-6) return false; // Parallèles

    const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / denom;
    const u = -((a1.x - a2.x) * (a1.y - b1.y) - (a1.y - a2.y) * (a1.x - b1.x)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /**
   * Calcule l'angle solide d'un triangle vu depuis un point
   */
  static solidAngle(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3, viewpoint: THREE.Vector3): number {
    const a = v1.clone().sub(viewpoint).normalize();
    const b = v2.clone().sub(viewpoint).normalize();
    const c = v3.clone().sub(viewpoint).normalize();

    const numerator = Math.abs(a.dot(b.cross(c)));
    const denominator = 1 + a.dot(b) + b.dot(c) + c.dot(a);
    return 2 * Math.atan2(numerator, denominator);
  }

  /**
   * Génère des points sur une sphère
   */
  static fibonacciSphere(samples: number, radius: number = 1): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Angle d'or

    for (let i = 0; i < samples; i++) {
      const y = 1 - (i / (samples - 1)) * 2; // y entre -1 et 1
      const radiusAtY = Math.sqrt(1 - y * y);

      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      points.push(new THREE.Vector3(x, y, z).multiplyScalar(radius));
    }

    return points;
  }

  /**
   * Fonction auxiliaire pour pointInTriangle2D
   */
  private static sign(p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2): number {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  }
}