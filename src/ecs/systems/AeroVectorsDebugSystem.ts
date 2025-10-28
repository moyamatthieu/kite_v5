/**
 * AeroVectorsDebugSystem.ts - Système de visualisation des vecteurs aérodynamiques
 *
 * Affiche les vecteurs de forces aérodynamiques pour chaque face du kite :
 *   - Portance (lift) - vert
 *   - Traînée (drag) - rouge
 *   - Vent apparent - cyan
 *
 * Architecture ECS :
 *   - Lit les données depuis KitePhysicsSystem.getSurfaceForces()
 *   - Crée des ArrowHelper Three.js pour chaque vecteur
 *   - Toggle ON/OFF via l'UI
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { SurfaceForce } from '@mytypes/PhysicsTypes';

import { KitePhysicsSystem } from './KitePhysicsSystem';

/**
 * Configuration des vecteurs de debug
 */
interface VectorConfig {
  enabled: boolean;
  color: number;
  scale: number; // Échelle de longueur du vecteur
}

/**
 * Système de visualisation des vecteurs aérodynamiques par face
 */
export class AeroVectorsDebugSystem extends BaseSimulationSystem {
  private kitePhysicsSystem: KitePhysicsSystem | null = null;
  
  // Groupes de flèches Three.js
  private liftArrows: THREE.ArrowHelper[] = [];
  private dragArrows: THREE.ArrowHelper[] = [];
  private windArrows: THREE.ArrowHelper[] = [];
  
  // Configuration des vecteurs
  private vectorConfigs = {
    lift: { enabled: true, color: 0x00ff00, scale: 0.2 } as VectorConfig,
    drag: { enabled: true, color: 0xff0000, scale: 0.2 } as VectorConfig,
    apparentWind: { enabled: true, color: 0x00ffff, scale: 0.05 } as VectorConfig,
  };
  
  // Toggle global
  private debugEnabled = false;
  
  // Référence à la scène Three.js
  private scene: THREE.Scene | null = null;

  constructor() {
    super('AeroVectorsDebugSystem', 150); // Priorité 150 (après physique, après rendu)
  }

  /**
   * Initialise le système
   */
  initialize(): void {
    // Le système est prêt, mais les flèches seront créées à la demande
  }

  /**
   * Configure la référence au KitePhysicsSystem
   */
  setKitePhysicsSystem(system: KitePhysicsSystem): void {
    this.kitePhysicsSystem = system;
  }

  /**
   * Configure la scène Three.js
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Active/désactive l'affichage des vecteurs
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    
    if (!enabled) {
      this.clearAllArrows();
    }
  }

  /**
   * Active/désactive un type de vecteur spécifique
   */
  setVectorEnabled(type: 'lift' | 'drag' | 'apparentWind', enabled: boolean): void {
    this.vectorConfigs[type].enabled = enabled;
  }

  /**
   * Change l'échelle d'affichage d'un type de vecteur
   */
  setVectorScale(type: 'lift' | 'drag' | 'apparentWind', scale: number): void {
    this.vectorConfigs[type].scale = scale;
  }

  /**
   * Mise à jour du système (appelée chaque frame)
   */
  update(_context: SimulationContext): void {
    if (!this.enabled || !this.debugEnabled || !this.scene || !this.kitePhysicsSystem) {
      return;
    }

    // Récupérer les forces par surface depuis KitePhysicsSystem
    const surfaceForces = this.kitePhysicsSystem.getSurfaceForces();
    
    if (!surfaceForces || surfaceForces.length === 0) {
      return;
    }

    // Nettoyer les anciennes flèches
    this.clearAllArrows();

    // Créer les nouvelles flèches pour chaque surface
    surfaceForces.forEach((force) => {
      this.createVectorsForSurface(force);
    });
  }

  /**
   * Crée les vecteurs de debug pour une surface
   */
  private createVectorsForSurface(force: SurfaceForce): void {
    if (!this.scene) return;

    const origin = force.center;

    // Vecteur de portance (lift) - vert
    if (this.vectorConfigs.lift.enabled && force.lift.length() > 0.01) {
      const liftDir = force.lift.clone().normalize();
      const liftLength = force.lift.length() * this.vectorConfigs.lift.scale;
      
      const arrow = new THREE.ArrowHelper(
        liftDir,
        origin,
        liftLength,
        this.vectorConfigs.lift.color,
        liftLength * 0.2,
        liftLength * 0.1
      );
      
      this.liftArrows.push(arrow);
      this.scene.add(arrow);
    }

    // Vecteur de traînée (drag) - rouge
    if (this.vectorConfigs.drag.enabled && force.drag.length() > 0.01) {
      const dragDir = force.drag.clone().normalize();
      const dragLength = force.drag.length() * this.vectorConfigs.drag.scale;
      
      const arrow = new THREE.ArrowHelper(
        dragDir,
        origin,
        dragLength,
        this.vectorConfigs.drag.color,
        dragLength * 0.2,
        dragLength * 0.1
      );
      
      this.dragArrows.push(arrow);
      this.scene.add(arrow);
    }

    // Vecteur de vent apparent - cyan
    if (this.vectorConfigs.apparentWind.enabled && force.apparentWind) {
      const windLength = force.apparentWind.length();
      
      if (windLength > 0.1) {
        const windDir = force.apparentWind.clone().normalize();
        const displayLength = windLength * this.vectorConfigs.apparentWind.scale;
        
        const arrow = new THREE.ArrowHelper(
          windDir,
          origin,
          displayLength,
          this.vectorConfigs.apparentWind.color,
          displayLength * 0.2,
          displayLength * 0.1
        );
        
        this.windArrows.push(arrow);
        this.scene.add(arrow);
      }
    }
  }

  /**
   * Nettoie toutes les flèches de la scène
   */
  private clearAllArrows(): void {
    if (!this.scene) return;

    // Retirer et disposer les flèches de portance
    this.liftArrows.forEach((arrow) => {
      this.scene!.remove(arrow);
      arrow.dispose();
    });
    this.liftArrows = [];

    // Retirer et disposer les flèches de traînée
    this.dragArrows.forEach((arrow) => {
      this.scene!.remove(arrow);
      arrow.dispose();
    });
    this.dragArrows = [];

    // Retirer et disposer les flèches de vent
    this.windArrows.forEach((arrow) => {
      this.scene!.remove(arrow);
      arrow.dispose();
    });
    this.windArrows = [];
  }

  /**
   * Réinitialise le système
   */
  reset(): void {
    this.clearAllArrows();
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.clearAllArrows();
    this.kitePhysicsSystem = null;
    this.scene = null;
  }
}
