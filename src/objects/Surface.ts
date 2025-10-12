import { Point } from './Point';

/**
 * Classe représentant une surface composée de points connectés.
 */
export class Surface {
  points: Point[];

  constructor() {
    this.points = [];
  }

  /**
   * Ajoute un point à la surface.
   * @param point - Instance du point.
   */
  addPoint(point: Point): void {
    this.points.push(point);
  }

  /**
   * Retourne tous les points de la surface.
   * @returns Liste des points.
   */
  getPoints(): Point[] {
    return this.points;
  }

  /**
   * Calcule le centroïde de la surface.
   * @returns Le centroïde sous forme de Point.
   */
  calculateCentroid(): Point {
    const total = this.points.reduce((acc, point) => {
      acc.x += point.position.x;
      acc.y += point.position.y;
      acc.z += point.position.z;
      return acc;
    }, { x: 0, y: 0, z: 0 });

    const count = this.points.length;
    return new Point(total.x / count, total.y / count, total.z / count);
  }
}
