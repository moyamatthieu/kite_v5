/**
 * StructureComponent.ts - Composant ECS pour les structures rigides
 *
 * Contient les données de points et connexions pour les structures comme les frames.
 * Remplace l'objet Frame dans l'architecture ECS pure.
 */

import * as THREE from 'three';
import { Component } from '@base/Component';

/**
 * Connexion entre deux points
 */
export interface PointConnection {
  point1: string;
  point2: string;
}

/**
 * Composant contenant les données d'une structure rigide
 */
export class StructureComponent implements Component {
  readonly type = 'structure';

  // Points de la structure (nom -> position)
  public points: Map<string, THREE.Vector3> = new Map();

  // Connexions entre les points
  public connections: PointConnection[] = [];

  /**
   * Ajoute un point à la structure
   */
  addPoint(name: string, position: THREE.Vector3): void {
    this.points.set(name, position.clone());
  }

  /**
   * Ajoute une connexion entre deux points
   */
  addConnection(point1: string, point2: string): void {
    this.connections.push({ point1, point2 });
  }

  /**
   * Calcule la longueur totale des connexions
   */
  calculateTotalConnectionLength(): number {
    return this.connections.reduce((total, connection) => {
      const p1 = this.points.get(connection.point1);
      const p2 = this.points.get(connection.point2);
      if (p1 && p2) {
        total += p1.distanceTo(p2);
      }
      return total;
    }, 0);
  }

  /**
   * Obtient la position d'un point
   */
  getPoint(name: string): THREE.Vector3 | undefined {
    return this.points.get(name)?.clone();
  }

  /**
   * Vérifie si un point existe
   */
  hasPoint(name: string): boolean {
    return this.points.has(name);
  }
}