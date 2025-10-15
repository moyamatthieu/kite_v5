/**
 * PhysicsTypes.ts - Types et interfaces pour la physique de la simulation Kite
 *
 * Rôle :
 *   - Définit les structures de données pour l'état du cerf-volant, les forces, les poignées, etc.
 *   - Sert à typer les échanges entre les modules physiques et de rendu
 *
 * Dépendances principales :
 *   - Three.js : Pour les vecteurs et quaternions
 *
 * Relation avec les fichiers adjacents :
 *   - WindTypes.ts : Définit les types pour le vent
 *   - Tous les modules physiques et de rendu importent PhysicsTypes pour typer les données
 *
 * Utilisation typique :
 *   - Utilisé dans PhysicsEngine, AerodynamicsCalculator, DebugRenderer, etc.
 *   - Sert à garantir la cohérence des échanges de données physiques
 *
 * Voir aussi :
 *   - src/simulation/types/WindTypes.ts
 */
import * as THREE from "three";

import { WindParams } from './WindTypes';

// Ré-exporter WindParams pour que d'autres modules puissent l'importer depuis PhysicsTypes
export type { WindParams };

/**
 * Types et interfaces pour la physique de la simulation
 */

export interface KiteState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  orientation?: THREE.Quaternion;
  acceleration?: THREE.Vector3;
  angularAcceleration?: THREE.Vector3;
  mass?: number;
  totalLiftForce?: THREE.Vector3; // Ajouté pour le debug UI
  totalDragForce?: THREE.Vector3; // Ajouté pour le debug UI
}

/**
 * État du vent
 */
export interface WindState {
  baseSpeed: number; // m/s
  baseDirection: THREE.Vector3;
  turbulence: number; // %
  gustFrequency?: number;
  gustAmplitude?: number;
  time?: number;
}

export interface HandlePositions {
  left: THREE.Vector3;
  right: THREE.Vector3;
}

/**
 * Force appliquée sur une surface spécifique du kite
 */
export interface SurfaceForce {
  /** Indice de la surface dans KiteGeometry.SURFACES */
  surfaceIndex: number;
  /** Portance sur cette surface (en Newton) */
  lift: THREE.Vector3;
  /** Traînée sur cette surface (en Newton) */
  drag: THREE.Vector3;
  /** Friction sur cette surface (optionnel, en Newton) */
  friction?: THREE.Vector3;
  /** Force totale (résultante) sur cette surface (en Newton) */
  resultant: THREE.Vector3;
  /** Centre géométrique de la surface (en coordonnées monde) */
  center: THREE.Vector3;
  /** Normale de la surface (en coordonnées monde) */
  normal: THREE.Vector3;
  /** Surface en m² */
  area: number;
}