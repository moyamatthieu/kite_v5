import * as THREE from 'three';
import { Logger } from '@utils/Logging';
import { SurfaceForce } from '@mytypes/PhysicsTypes';

interface DebugRendererOptions {
  addObject: (obj: THREE.Object3D) => void;
  removeObject: (obj: THREE.Object3D) => void;
  getScene: () => THREE.Scene | null;
}

export class DebugRenderer {
  private options: DebugRendererOptions;
  private debugMode: boolean;
  private logger = Logger.getInstance();
  
  // Stockage des flèches de debug pour les mettre à jour
  private arrowHelpers: THREE.ArrowHelper[] = [];
  private arrowGroup: THREE.Group | null = null;

  // Facteurs d'échelle centralisés pour visualisation
  // Note: Les forces sont déjà multipliées par liftScale/dragScale dans AerodynamicsCalculator
  // Ici on ajuste juste la longueur visuelle des flèches (1N = Xm de flèche)
  private readonly LIFT_SCALE = 0.1;  // 1N = 10cm de flèche
  private readonly DRAG_SCALE = 0.1;  // 1N = 10cm de flèche
  private readonly WIND_SCALE = 0.05;  // 1 m/s = 5cm

  constructor(options: DebugRendererOptions) {
    this.options = options;
    this.debugMode = false;
    
    // Créer le groupe pour les flèches
    this.arrowGroup = new THREE.Group();
    this.arrowGroup.name = 'debug-arrows';
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    this.logger.info(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`, 'DebugRenderer');
    
    // Afficher ou cacher les flèches selon le mode debug
    if (this.debugMode && this.arrowGroup) {
      this.options.addObject(this.arrowGroup);
    } else if (!this.debugMode && this.arrowGroup) {
      this.options.removeObject(this.arrowGroup);
    }
  }

  /**
   * Met à jour les vecteurs de debug pour afficher les forces aérodynamiques
   * @param surfaceForces - Forces par surface calculées par AerodynamicsCalculator
   * @param apparentWind - Vent apparent global
   */
  updateDebugVectors(surfaceForces: SurfaceForce[], apparentWind: THREE.Vector3): void {
    if (!this.debugMode || !this.arrowGroup) return;

    // Nettoyer les anciennes flèches
    this.clearArrows();

    // Utilisation des facteurs d'échelle centralisés
    const liftScale = this.LIFT_SCALE;
    const dragScale = this.DRAG_SCALE;
    const windScale = this.WIND_SCALE;

    // Log de debug pour vérifier les forces (première surface seulement)
    if (surfaceForces.length > 0) {
      const firstSurface = surfaceForces[0];
      this.logger.debug(
        `Surface 0: Lift=${firstSurface.lift.length().toFixed(3)}N, Drag=${firstSurface.drag.length().toFixed(3)}N, Wind=${apparentWind.length().toFixed(2)}m/s`,
        'DebugRenderer'
      );
    }

    // Créer les flèches pour chaque surface
    surfaceForces.forEach((surface) => {
      if (!this.arrowGroup) return; // Guard pour TypeScript
      
      const center = surface.center;

      // Vecteur de portance (VERT FONCÉ)
      if (surface.lift.length() > 0.01) {
        const liftArrow = new THREE.ArrowHelper(
          surface.lift.clone().normalize(),
          center,
          surface.lift.length() * liftScale,
          0x008000, // Vert foncé
          0.10,     // Longueur tête
          0.06      // Largeur tête
        );
        liftArrow.name = 'lift-vector';
        this.arrowGroup.add(liftArrow);
        this.arrowHelpers.push(liftArrow);
      }

      // Vecteur de traînée (ROUGE FONCÉ)
      if (surface.drag.length() > 0.01) {
        const dragArrow = new THREE.ArrowHelper(
          surface.drag.clone().normalize(),
          center,
          surface.drag.length() * dragScale,
          0x800000, // Rouge foncé
          0.10,
          0.06
        );
        dragArrow.name = 'drag-vector';
        this.arrowGroup.add(dragArrow);
        this.arrowHelpers.push(dragArrow);
      }

      // Vecteur de vent apparent (CYAN) - un seul par surface
      if (apparentWind.length() > 0.1) {
        const windArrow = new THREE.ArrowHelper(
          apparentWind.clone().normalize(),
          center,
          apparentWind.length() * windScale,
          0x00ffff, // Cyan
          0.05,
          0.03
        );
        windArrow.name = 'wind-vector';
        this.arrowGroup.add(windArrow);
        this.arrowHelpers.push(windArrow);
      }
    });
  }

  /**
   * Nettoie toutes les flèches de debug
   */
  private clearArrows(): void {
    if (!this.arrowGroup) return;

    // Retirer toutes les flèches du groupe
    while (this.arrowGroup.children.length > 0) {
      this.arrowGroup.remove(this.arrowGroup.children[0]);
    }
    
    this.arrowHelpers = [];
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.clearArrows();
    
    if (this.arrowGroup) {
      this.options.removeObject(this.arrowGroup);
      this.arrowGroup = null;
    }
  }

  updateDebugDisplay(data: unknown): void {
    if (!this.debugMode) return;
    this.logger.debug('Updating debug display with data:', 'DebugRenderer', data);
    // Ajoutez ici la logique pour mettre à jour les éléments de débogage
  }
}