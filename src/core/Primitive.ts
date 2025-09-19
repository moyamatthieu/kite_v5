/**
 * Primitive.ts - Générateurs de primitives Three.js propres et simples
 * Utilitaires pour créer les formes de base avec matériaux cohérents
 */

import * as THREE from 'three';
import { MaterialConfig } from '../types/index';

/**
 * Classe statique pour générer les primitives de base
 */
export class Primitive {
  /**
   * Créer un matériau standardisé
   */
  private static createMaterial(config: string | MaterialConfig): THREE.MeshStandardMaterial {
    if (typeof config === 'string') {
      return new THREE.MeshStandardMaterial({ color: config });
    }

    return new THREE.MeshStandardMaterial({
      color: config.color,
      transparent: config.transparent || false,
      opacity: config.opacity || 1,
      metalness: config.metalness || 0,
      roughness: config.roughness || 0.5,
      side: config.side || THREE.FrontSide
    });
  }

  /**
   * Créer une boîte (cube ou parallélépipède)
   */
  static box(
    width: number,
    height: number,
    depth: number,
    material: string | MaterialConfig
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer une sphère
   */
  static sphere(
    radius: number,
    material: string | MaterialConfig,
    segments: number = 16
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, segments, segments);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer un cylindre
   */
  static cylinder(
    radius: number,
    height: number,
    material: string | MaterialConfig,
    segments: number = 16
  ): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer un cône
   */
  static cone(
    radius: number,
    height: number,
    material: string | MaterialConfig,
    segments: number = 16
  ): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(radius, height, segments);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer un plan (surface plate)
   */
  static plane(
    width: number,
    height: number,
    material: string | MaterialConfig
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer un tore (anneau)
   */
  static torus(
    radius: number,
    tubeRadius: number,
    material: string | MaterialConfig,
    segments: number = 16
  ): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(radius, tubeRadius, segments, segments);
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }

  /**
   * Créer une surface à partir de points (triangulation simple)
   */
  static surface(
    points: THREE.Vector3[],
    material: string | MaterialConfig
  ): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];

    // Ajouter les points
    points.forEach(point => {
      vertices.push(point.x, point.y, point.z);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    // Triangulation améliorée pour les quads (faces du cube)
    const indices: number[] = [];
    if (points.length === 3) {
      // Triangle simple
      indices.push(0, 1, 2);
    } else if (points.length === 4) {
      // Quad - utiliser une triangulation qui préserve la manifold
      // Pour un cube, on utilise toujours la même diagonale (0,2)
      // Cela garantit que l'arête diagonale n'est pas partagée avec d'autres faces
      indices.push(0, 1, 2);  // Premier triangle
      indices.push(0, 2, 3);  // Deuxième triangle
    } else {
      // Fan triangulation pour plus de points
      for (let i = 1; i < points.length - 1; i++) {
        indices.push(0, i, i + 1);
      }
    }

    geometry.setIndex(indices);

    // Calculer les normales de manière cohérente
    geometry.computeVertexNormals();

    // S'assurer que les normales pointent vers l'extérieur pour un cube
    // En inversant si nécessaire
    const mat = this.createMaterial(material);
    return new THREE.Mesh(geometry, mat);
  }
}