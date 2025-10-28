/**
 * GeometryComponent.ts - Composant de géométrie pour objets structurés
 *
 * Contient la définition géométrique pure d'un objet (points, connexions, surfaces)
 * en coordonnées locales. Pas de Three.js - juste des données.
 *
 * Architecture ECS pure : ce composant contient uniquement des données,
 * le RenderSystem créera la géométrie Three.js depuis ces données.
 */

import * as THREE from 'three';
import { Component } from '@base/Component';
import { Logger } from '@utils/Logging';

/**
 * Connexion entre deux points (pour frames/structures)
 */
export interface GeometryConnection {
  from: string;  // Nom du point de départ
  to: string;    // Nom du point d'arrivée
}

/**
 * Surface définie par des noms de points
 */
export interface GeometrySurface {
  points: string[];  // 3 ou 4 noms de points formant la surface
}

/**
 * Composant de géométrie structurée
 * Remplace la classe StructuredObject dans une architecture ECS pure
 */
export class GeometryComponent implements Component {
  readonly type = 'geometry';

  /**
   * Points nommés en coordonnées locales
   * Map: nom du point -> position Vector3
   */
  public points: Map<string, THREE.Vector3>;

  /**
   * Connexions entre points (pour créer des frames/lignes)
   */
  public connections: GeometryConnection[];

  /**
   * Surfaces définies par noms de points
   */
  public surfaces: GeometrySurface[];

  constructor(data: {
    points?: Map<string, THREE.Vector3>;
    connections?: GeometryConnection[];
    surfaces?: GeometrySurface[];
  } = {}) {
    this.points = data.points || new Map();
    this.connections = data.connections || [];
    this.surfaces = data.surfaces || [];
  }

  /**
   * Ajoute ou met à jour un point
   */
  setPoint(name: string, position: THREE.Vector3): void {
    this.points.set(name, position.clone());
  }

  /**
   * Récupère un point par son nom
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

  /**
   * Ajoute une connexion
   */
  addConnection(from: string, to: string): void {
    this.connections.push({ from, to });
  }

  /**
   * Ajoute une surface
   */
  addSurface(pointNames: string[]): void {
    if (pointNames.length < 3) {
      Logger.getInstance().warn('Une surface nécessite au moins 3 points', 'GeometryComponent');
      return;
    }
    this.surfaces.push({ points: pointNames });
  }

  /**
   * Clone le composant
   */
  clone(): GeometryComponent {
    return new GeometryComponent({
      points: new Map(this.points),
      connections: [...this.connections],
      surfaces: this.surfaces.map(s => ({ points: [...s.points] }))
    });
  }
}
