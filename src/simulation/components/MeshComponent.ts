/**
 * MeshComponent.ts - Composant de géométrie Three.js
 *
 * Contient la référence à un objet 3D Three.js (Mesh, Group, Line, etc.)
 * Utilisé pour le rendu visuel des entités.
 */

import * as THREE from 'three';

import { Component } from '../entities/Entity';

/**
 * Composant contenant un objet 3D Three.js
 */
export class MeshComponent implements Component {
  readonly type = 'mesh';

  public object3D: THREE.Object3D;
  public visible: boolean;
  public castShadow: boolean;
  public receiveShadow: boolean;

  constructor(
    object3D: THREE.Object3D,
    options: {
      visible?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    } = {}
  ) {
    this.object3D = object3D;
    this.visible = options.visible !== undefined ? options.visible : true;
    this.castShadow = options.castShadow || false;
    this.receiveShadow = options.receiveShadow || false;

    // Appliquer les options
    this.object3D.visible = this.visible;
    this.object3D.castShadow = this.castShadow;
    this.object3D.receiveShadow = this.receiveShadow;
  }

  /**
   * Synchronise le composant avec l'objet 3D
   */
  syncToObject3D(transform: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }): void {
    this.object3D.position.copy(transform.position);
    this.object3D.quaternion.copy(transform.quaternion);
    this.object3D.scale.copy(transform.scale);
  }

  /**
   * Met à jour la visibilité
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.object3D.visible = visible;
  }

  /**
   * Dispose l'objet 3D (libère les ressources)
   */
  dispose(): void {
    this.object3D.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        }
      }
    });
  }
}
