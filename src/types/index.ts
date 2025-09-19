/**
 * Types centralisés pour le système de visualisation 3D
 * Interface unique et cohérente pour tous les objets
 */

import * as THREE from 'three';

/**
 * Position 3D simple [x, y, z]
 */
export type Position3D = [number, number, number];

/**
 * Interface principale que TOUS les objets doivent implémenter
 * 🎮 v3.0: Compatible avec l'architecture StructuredObject + Node3D
 */
export interface ICreatable {
  /**
   * Retourne l'objet lui-même (StructuredObject hérite de Node3D)
   * Pattern fluent pour la nouvelle architecture
   */
  create(): this;

  /**
   * Nom affiché dans l'interface utilisateur
   */
  getName(): string;

  /**
   * Description courte de l'objet
   */
  getDescription(): string;

  /**
   * Nombre de primitives utilisées (pour statistiques)
   */
  getPrimitiveCount(): number;
}

/**
 * Options pour créer des surfaces
 */
export interface SurfaceOptions {
  color?: string;
  transparent?: boolean;
  opacity?: number;
  doubleSide?: boolean;
  wireframe?: boolean;
}

/**
 * Configuration pour les matériaux
 */
export interface MaterialConfig {
  color: string;
  transparent?: boolean;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  side?: THREE.Side;
}

/**
 * Interface pour un point nommé dans l'espace 3D
 */
export interface NamedPoint {
  name: string;
  position: THREE.Vector3;
  visible?: boolean;
}

/**
 * Métadonnées optionnelles pour les objets
 */
export interface ObjectMetadata {
  category?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  tags?: string[];
  author?: string;
  version?: string;
}