/**
 * InputSyncSystem.ts - Synchronisation des changements UI vers les systèmes physiques
 *
 * Ce système écoute les changements dans InputComponent et met à jour
 * les composants correspondants (LineComponent, etc.)
 *
 * Priorité 5 (TRÈS haute, AVANT tous les autres systèmes)
 */

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { InputComponent } from '../components/InputComponent';
import { LineComponent } from '../components/LineComponent';

export class InputSyncSystem extends System {
  private lastLineLength: number = 0;
  private lastBridleNez: number = 0;
  private lastBridleInter: number = 0;
  private lastBridleCentre: number = 0;
  private lastLinearDamping: number = 0;
  private lastAngularDamping: number = 0;

  constructor() {
    super('InputSyncSystem', 5); // Très haute priorité
  }

  initialize(entityManager: EntityManager): void {
    // Initialiser les valeurs de cache
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const input = inputEntities[0].getComponent<InputComponent>('Input');
      if (input) {
        this.lastLineLength = input.lineLength;
        this.lastBridleNez = input.bridleNez;
        this.lastBridleInter = input.bridleInter;
        this.lastBridleCentre = input.bridleCentre;
        this.lastLinearDamping = input.linearDamping;
        this.lastAngularDamping = input.angularDamping;
      }
    }
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer InputComponent
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length === 0) return;

    const input = inputEntities[0].getComponent<InputComponent>('Input');
    if (!input) return;

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE LINE LENGTH
    // ========================================================================
    if (input.lineLength !== this.lastLineLength) {
      console.log(`🔗 [InputSyncSystem] Line length changed: ${this.lastLineLength} → ${input.lineLength} m`);
      this.updateLineLength(entityManager, input.lineLength);
      this.lastLineLength = input.lineLength;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE BRIDES
    // ========================================================================
    if (input.bridleNez !== this.lastBridleNez) {
      console.log(`🌉 [InputSyncSystem] Bridle Nez changed: ${this.lastBridleNez} → ${input.bridleNez} m`);
      this.updateBridleNez(entityManager, input.bridleNez);
      this.lastBridleNez = input.bridleNez;
    }

    if (input.bridleInter !== this.lastBridleInter) {
      console.log(`🌉 [InputSyncSystem] Bridle Inter changed: ${this.lastBridleInter} → ${input.bridleInter} m`);
      this.updateBridleInter(entityManager, input.bridleInter);
      this.lastBridleInter = input.bridleInter;
    }

    if (input.bridleCentre !== this.lastBridleCentre) {
      console.log(`🌉 [InputSyncSystem] Bridle Centre changed: ${this.lastBridleCentre} → ${input.bridleCentre} m`);
      this.updateBridleCentre(entityManager, input.bridleCentre);
      this.lastBridleCentre = input.bridleCentre;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE DAMPING
    // ========================================================================
    if (input.linearDamping !== this.lastLinearDamping) {
      console.log(`📉 [InputSyncSystem] Linear damping changed: ${this.lastLinearDamping} → ${input.linearDamping}`);
      this.updateLinearDamping(entityManager, input.linearDamping);
      this.lastLinearDamping = input.linearDamping;
    }

    if (input.angularDamping !== this.lastAngularDamping) {
      console.log(`📉 [InputSyncSystem] Angular damping changed: ${this.lastAngularDamping} → ${input.angularDamping}`);
      this.updateAngularDamping(entityManager, input.angularDamping);
      this.lastAngularDamping = input.angularDamping;
    }
  }

  /**
   * Met à jour la longueur de toutes les lignes
   */
  private updateLineLength(entityManager: EntityManager, newLength: number): void {
    const lines = entityManager.query(['line']);
    lines.forEach(line => {
      const lineComp = line.getComponent<LineComponent>('line');
      if (lineComp) {
        lineComp.restLength = newLength;
        lineComp.currentLength = Math.min(lineComp.currentLength, newLength); // Limiter si trop long
        lineComp.state.currentLength = lineComp.currentLength;
      }
    });
  }

  /**
   * Met à jour les brides (TODO: implémentation complète)
   */
  private updateBridleNez(entityManager: EntityManager, newLength: number): void {
    // TODO: mettre à jour les composants des brides du kite
    console.log(`[InputSyncSystem] TODO: Update bridle nez to ${newLength}`);
  }

  private updateBridleInter(entityManager: EntityManager, newLength: number): void {
    // TODO: mettre à jour les composants des brides du kite
    console.log(`[InputSyncSystem] TODO: Update bridle inter to ${newLength}`);
  }

  private updateBridleCentre(entityManager: EntityManager, newLength: number): void {
    // TODO: mettre à jour les composants des brides du kite
    console.log(`[InputSyncSystem] TODO: Update bridle centre to ${newLength}`);
  }

  /**
   * Met à jour le damping linéaire de toutes les entités physiques
   */
  private updateLinearDamping(entityManager: EntityManager, newDamping: number): void {
    const entities = entityManager.query(['physics']);
    entities.forEach(entity => {
      const physics = entity.getComponent('physics') as any;
      if (physics) {
        physics.linearDamping = newDamping;
      }
    });
  }

  /**
   * Met à jour le damping angulaire de toutes les entités physiques
   */
  private updateAngularDamping(entityManager: EntityManager, newDamping: number): void {
    const entities = entityManager.query(['physics']);
    entities.forEach(entity => {
      const physics = entity.getComponent('physics') as any;
      if (physics) {
        physics.angularDamping = newDamping;
      }
    });
  }
}
