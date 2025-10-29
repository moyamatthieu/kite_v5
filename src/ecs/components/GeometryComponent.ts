/**
 * GeometryComponent.ts - Géométrie (points locaux, connexions, surfaces)
 * 
 * Stocke la structure géométrique d'un objet en coordonnées locales.
 * Les CTRL_GAUCHE et CTRL_DROIT sont stockés ici comme points locaux du kite.
 * 
 * Architecture ECS pure : données uniquement, pas de logique de transformation.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';
import { Entity } from '../core/Entity';
import { MathUtils } from '../utils/MathUtils';

import { TransformComponent } from './TransformComponent';

/**
 * Définition d'une connexion entre deux points
 */
export interface GeometryConnection {
  from: string;
  to: string;
}

/**
 * Définition d'une surface (triangle ou quad)
 */
export interface GeometrySurface {
  points: string[];
  normal?: THREE.Vector3;
}

export class GeometryComponent extends Component {
  readonly type = 'geometry';
  
  /** Points en coordonnées locales */
  private points: Map<string, THREE.Vector3>;
  
  /** Connexions (lignes) entre points */
  connections: GeometryConnection[];
  
  /** Surfaces (pour rendu) */
  surfaces: GeometrySurface[];
  
  constructor() {
    super();
    this.points = new Map();
    this.connections = [];
    this.surfaces = [];
  }
  
  /**
   * Définit un point en coordonnées locales
   */
  setPoint(name: string, localPosition: THREE.Vector3): void {
    this.points.set(name, localPosition.clone());
  }
  
  /**
   * Récupère un point en coordonnées locales
   */
  getPoint(name: string): THREE.Vector3 | undefined {
    return this.points.get(name)?.clone();
  }
  
  /**
   * Transforme un point local en coordonnées monde
   * 
   * @param name - Nom du point
   * @param entity - Entité contenant TransformComponent
   * @returns Position monde ou undefined si point inexistant
   */
  getPointWorld(name: string, entity: Entity): THREE.Vector3 | undefined {
    const localPoint = this.points.get(name);
    if (!localPoint) return undefined;
    
    return MathUtils.getPointWorld(localPoint, entity, name);
  }
  
  /**
   * Liste tous les noms de points
   */
  getPointNames(): string[] {
    return Array.from(this.points.keys());
  }
  
  /**
   * Compte le nombre de points
   */
  getPointCount(): number {
    return this.points.size;
  }
  
  /**
   * Ajoute une connexion entre deux points
   */
  addConnection(from: string, to: string): void {
    this.connections.push({ from, to });
  }
  
  /**
   * Ajoute une surface
   */
  addSurface(points: string[], normal?: THREE.Vector3): void {
    this.surfaces.push({ points, normal: normal?.clone() });
  }
  
  /**
   * Vérifie si un point existe
   */
  hasPoint(name: string): boolean {
    return this.points.has(name);
  }
}
