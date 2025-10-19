/**
 * MeshComponent.ts - Référence à l'objet Three.js pour le rendu
 * 
 * Contient l'Object3D Three.js créé par GeometryRenderSystem.
 * Séparation claire : GeometryComponent = données, MeshComponent = rendu.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class MeshComponent extends Component {
  readonly type = 'mesh';
  
  /** Objet Three.js (Mesh, Line, Group, etc.) */
  object3D: THREE.Object3D;
  
  constructor(object3D: THREE.Object3D) {
    super();
    this.object3D = object3D;
  }
  
  /**
   * Dispose les ressources Three.js
   */
  dispose(): void {
    this.object3D.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
