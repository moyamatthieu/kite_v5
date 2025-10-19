/**
 * InputSystem.ts - Gestion des entrées clavier
 * 
 * Lit le clavier et modifie les positions des handles de la barre de contrôle.
 * Priorité 10 (exécuté en premier).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';

export class InputSystem extends System {
  private keys: Set<string> = new Set();
  private barRotation: number = 0; // Rotation actuelle de la barre (-1 à +1)
  
  // Configuration
  private rotationSpeed: number = 2.0; // degrés/seconde
  private maxRotation: number = 45; // degrés max
  private handleSpacing: number = 0.45; // Distance entre handles (m)
  
  constructor() {
    super('InputSystem', 10);
  }
  
  initialize(): void {
    // Écoute clavier
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }
  
  update(context: SimulationContext): void {
    const { deltaTime, entityManager } = context;
    
    // Récupérer la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (!controlBar) return;
    
    const transform = controlBar.getComponent<TransformComponent>('transform');
    if (!transform) return;
    
    // Gérer rotation avec flèches ou Q/D
    if (this.keys.has('arrowleft') || this.keys.has('q')) {
      this.barRotation = Math.max(-this.maxRotation, this.barRotation - this.rotationSpeed * deltaTime);
    }
    if (this.keys.has('arrowright') || this.keys.has('d')) {
      this.barRotation = Math.min(this.maxRotation, this.barRotation + this.rotationSpeed * deltaTime);
    }
    
    // Retour au centre (touche S ou espace)
    if (this.keys.has('s') || this.keys.has(' ')) {
      const returnSpeed = this.rotationSpeed * 2;
      if (Math.abs(this.barRotation) < returnSpeed * deltaTime) {
        this.barRotation = 0;
      } else {
        this.barRotation -= Math.sign(this.barRotation) * returnSpeed * deltaTime;
      }
    }
    
    // Appliquer rotation à la barre (autour de Z)
    const rotationRad = this.barRotation * Math.PI / 180;
    const zAxis = new THREE.Vector3(0, 0, 1);
    transform.quaternion.setFromAxisAngle(zAxis, rotationRad);
    
    // Mettre à jour positions des handles (gauche/droite de la barre)
    // Les handles sont stockés dans la géométrie de la barre
    // (L'application de la rotation est automatique via le TransformComponent)
  }
  
  dispose(): void {
    this.keys.clear();
  }
  
  /**
   * Récupère la rotation actuelle de la barre (pour debug/UI)
   */
  getBarRotation(): number {
    return this.barRotation;
  }
}
