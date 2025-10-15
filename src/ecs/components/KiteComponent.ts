/**
 * KiteComponent.ts - Composant de données pour l'entité cerf-volant.
 *
 * Contient les données spécifiques à un cerf-volant qui ne sont pas couvertes
 * par les composants génériques comme TransformComponent ou PhysicsComponent.
 *
 * Inclut des informations sur la géométrie, les points de bridle, et l'état.
 */

import * as THREE from 'three';

import { Component } from '@base/Component';

// Importation des dépendances

export class KiteComponent implements Component {
  readonly type = 'kite';

  // Map des points anatomiques du cerf-volant en coordonnées locales.
  public points: Map<string, THREE.Vector3> = new Map();

  // Données sur les surfaces pour les calculs aérodynamiques.
  public surfaces: Array<{
    vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    area: number;
    centroid: THREE.Vector3;
    normal?: THREE.Vector3;
  }> = [];

  // Constructeur pour initialiser les points et surfaces

  constructor(
    points: Map<string, THREE.Vector3>,
    surfaces: Array<{
      vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      area: number;
      centroid: THREE.Vector3;
      normal?: THREE.Vector3;
    }> = []
  ) {
    this.points = new Map(
      Array.from(points.entries()).map(([name, position]) => [name, position.clone()])
    );
    this.surfaces = surfaces.map(({ vertices, area, centroid, normal }) => ({
      vertices: [vertices[0].clone(), vertices[1].clone(), vertices[2].clone()],
      area,
      centroid: centroid.clone(),
      normal: normal?.clone()
    }));
  }
}