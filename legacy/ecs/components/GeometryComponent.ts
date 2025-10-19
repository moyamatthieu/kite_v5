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
   * Récupère un point par son nom (coordonnées locales)
   */
  getPoint(name: string): THREE.Vector3 | undefined {
    return this.points.get(name)?.clone();
  }

  /**
   * Récupère un point transformé en coordonnées monde
   * Nécessite que l'entité ait un TransformComponent
   * 
   * @param name Nom du point à récupérer
   * @param entity Entité contenant ce GeometryComponent (pour accéder à TransformComponent)
   * @returns Position du point en coordonnées monde, ou undefined si point inexistant
   */
  getPointWorld(name: string, entity: any): THREE.Vector3 | undefined {
    const localPoint = this.points.get(name);
    if (!localPoint) {
      Logger.getInstance().warn(
        `[getPointWorld] Point '${name}' non trouvé dans GeometryComponent (entity: ${entity?.id || entity?.name || 'unknown'})`,
        'GeometryComponent'
      );
      return undefined;
    }

    // Récupérer le TransformComponent de l'entité
    const transform = entity.getComponent('transform');
    if (!transform) {
      Logger.getInstance().warn(
        `Entity ${entity.name} n'a pas de TransformComponent pour transformer le point ${name}`,
        'GeometryComponent'
      );
      return localPoint.clone(); // Fallback: retourne point local non transformé
    }

    // Transformer le point local en monde : rotation puis translation
    const worldPoint = localPoint.clone();
    worldPoint.applyQuaternion(transform.quaternion);
    worldPoint.add(transform.position);
    
    return worldPoint;
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
