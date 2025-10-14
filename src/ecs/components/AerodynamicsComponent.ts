/**
 * AerodynamicsComponent.ts - Composant de données aérodynamiques
 *
 * Contient les surfaces du cerf-volant avec leurs propriétés aérodynamiques :
 * - Vertices (coordonnées locales)
 * - Aires, centroids, normales
 * - Données pour calcul de portance/traînée
 *
 * Architecture ECS pure : données séparées du calcul aérodynamique.
 * Le système AerodynamicsCalculator utilisera ces données.
 */

import * as THREE from 'three';
import { Component } from '../Component';

/**
 * Surface aérodynamique (triangle)
 */
export interface AeroSurface {
  /** Vertices en coordonnées locales */
  vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];

  /** Aire de la surface en m² */
  area: number;

  /** Centroid (centre géométrique) en coordonnées locales */
  centroid: THREE.Vector3;

  /** Normale en coordonnées locales */
  normal: THREE.Vector3;

  /** Index de la surface (pour référence) */
  index: number;
}

/**
 * Forces aérodynamiques totales sur le kite (résultat de calcul)
 */
export interface AerodynamicForces {
  /** Force de portance totale */
  lift: THREE.Vector3;

  /** Force de traînée totale */
  drag: THREE.Vector3;

  /** Force résultante */
  total: THREE.Vector3;

  /** Couple (moment) total */
  torque: THREE.Vector3;

  /** Forces par surface (pour debug) */
  surfaceForces?: Array<{
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    center: THREE.Vector3;
  }>;
}

/**
 * Composant aérodynamique
 */
export class AerodynamicsComponent implements Component {
  readonly type = 'aerodynamics';

  /**
   * Surfaces aérodynamiques
   */
  public surfaces: AeroSurface[];

  /**
   * Forces aérodynamiques actuelles (calculées par système)
   */
  public forces: AerodynamicForces;

  /**
   * Coefficients aérodynamiques
   */
  public coefficients: {
    lift: number;    // CL
    drag: number;    // CD
    friction: number; // Friction coefficient
  };

  /**
   * Surface totale en m²
   */
  public totalArea: number;

  constructor(data: {
    surfaces?: AeroSurface[];
    coefficients?: Partial<{ lift: number; drag: number; friction: number }>;
  } = {}) {
    this.surfaces = data.surfaces || [];

    // Coefficients par défaut
    this.coefficients = {
      lift: data.coefficients?.lift ?? 0.8,
      drag: data.coefficients?.drag ?? 0.05,
      friction: data.coefficients?.friction ?? 0.01
    };

    // Calculer surface totale
    this.totalArea = this.surfaces.reduce((sum, s) => sum + s.area, 0);

    // Forces initiales nulles
    this.forces = {
      lift: new THREE.Vector3(),
      drag: new THREE.Vector3(),
      total: new THREE.Vector3(),
      torque: new THREE.Vector3(),
      surfaceForces: []
    };
  }

  /**
   * Ajoute une surface aérodynamique
   */
  addSurface(vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3]): void {
    const v0 = vertices[0];
    const v1 = vertices[1];
    const v2 = vertices[2];

    // Calculer aire
    const edge1 = v1.clone().sub(v0);
    const edge2 = v2.clone().sub(v0);
    const cross = edge1.clone().cross(edge2);
    const area = cross.length() / 2;

    // Calculer centroid
    const centroid = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .divideScalar(3);

    // Calculer normale
    const normal = cross.normalize();

    const surface: AeroSurface = {
      vertices: [v0.clone(), v1.clone(), v2.clone()],
      area,
      centroid,
      normal,
      index: this.surfaces.length
    };

    this.surfaces.push(surface);
    this.totalArea += area;
  }

  /**
   * Met à jour les forces aérodynamiques (appelé par système)
   */
  setForces(forces: AerodynamicForces): void {
    this.forces = forces;
  }

  /**
   * Clone le composant
   */
  clone(): AerodynamicsComponent {
    const comp = new AerodynamicsComponent({
      surfaces: this.surfaces.map(s => ({
        vertices: [s.vertices[0].clone(), s.vertices[1].clone(), s.vertices[2].clone()],
        area: s.area,
        centroid: s.centroid.clone(),
        normal: s.normal.clone(),
        index: s.index
      })),
      coefficients: { ...this.coefficients }
    });
    return comp;
  }
}
