/**
 * DebugComponent.ts - Données de visualisation du debug
 *
 * Stocke les vecteurs et flèches pour l'affichage du debug.
 */

import * as THREE from 'three';

import { Component } from '../core/Component';

export class DebugComponent extends Component {
  readonly type = 'debug';
  
  /** Flèches de visualisation des forces */
  forceArrows: THREE.ArrowHelper[] = [];
  
  /** Groupe contenant tous les éléments de debug */
  debugGroup: THREE.Group;
  
  constructor() {
    super();
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'debug-group';
  }
  
  /**
   * Nettoie les flèches précédentes
   */
  clearArrows(): void {
    this.forceArrows.forEach(arrow => {
      // Nettoyer les géométries et matériaux
      if (arrow.line && (arrow.line as any).geometry) {
        (arrow.line as any).geometry.dispose();
      }
      if (arrow.line && (arrow.line as any).material) {
        const mat = (arrow.line as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => m.dispose?.());
        } else {
          mat.dispose?.();
        }
      }
      if (arrow.cone && (arrow.cone as any).geometry) {
        (arrow.cone as any).geometry.dispose();
      }
      if (arrow.cone && (arrow.cone as any).material) {
        const mat = (arrow.cone as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m: any) => m.dispose?.());
        } else {
          mat.dispose?.();
        }
      }
      // Retirer du groupe
      this.debugGroup.remove(arrow);
    });
    this.forceArrows = [];
  }
  
  /**
   * Ajoute une flèche de force
   */
  addForceArrow(origin: THREE.Vector3, direction: THREE.Vector3, color: number, name: string): void {
    // Créer une flèche (helper Three.js)
    const length = direction.length();
    if (length < 0.01) return; // Ignorer les forces très petites
    
    const arrow = new THREE.ArrowHelper(
      direction.clone().normalize(),
      origin.clone(),
      Math.min(length, 30), // Limiter la longueur pour la visibilité (max 30m)
      color
    );
    
    arrow.name = name;
    this.forceArrows.push(arrow);
    this.debugGroup.add(arrow);
  }
}
