import { Point } from './Point';

/**
 * Classe représentant une structure rigide composée de points connectés.
 */
export class Frame {
  points: Map<string, Point>;
  connections: [string, string][];

  constructor() {
    this.points = new Map();
    this.connections = [];
  }

  /**
   * Ajoute un point à la structure.
   * @param name - Nom unique du point.
   * @param point - Instance du point.
   */
  addPoint(name: string, point: Point): void {
    this.points.set(name, point);
  }

  /**
   * Ajoute une connexion entre deux points.
   * @param point1 - Nom du premier point.
   * @param point2 - Nom du second point.
   */
  addConnection(point1: string, point2: string): void {
    this.connections.push([point1, point2]);
  }

  /**
   * Retourne toutes les connexions de la structure.
   * @returns Liste des connexions.
   */
  getConnections(): [string, string][] {
    return this.connections;
  }

  /**
   * Calcule la longueur totale des connexions dans la structure.
   * @returns La longueur totale.
   */
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
