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
import { Logger } from '../utils/Logging';

const logger = Logger.getInstance();

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
      logger.debug(`🔗 Line length changed: ${this.lastLineLength} → ${input.lineLength} m`, 'InputSyncSystem');
      this.updateLineLength(entityManager, input.lineLength);
      this.lastLineLength = input.lineLength;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE BRIDES
    // ========================================================================
    if (input.bridleNez !== this.lastBridleNez) {
      logger.debug(`🌉 Bridle Nez changed: ${this.lastBridleNez} → ${input.bridleNez} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'nez', input.bridleNez);
      this.lastBridleNez = input.bridleNez;
    }

    if (input.bridleInter !== this.lastBridleInter) {
      logger.debug(`🌉 Bridle Inter changed: ${this.lastBridleInter} → ${input.bridleInter} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'inter', input.bridleInter);
      this.lastBridleInter = input.bridleInter;
    }

    if (input.bridleCentre !== this.lastBridleCentre) {
      logger.debug(`🌉 Bridle Centre changed: ${this.lastBridleCentre} → ${input.bridleCentre} m`, 'InputSyncSystem');
      this.updateBridleLength(entityManager, 'centre', input.bridleCentre);
      this.lastBridleCentre = input.bridleCentre;
    }

    // ========================================================================
    // SYNCHRONISER LES CHANGEMENTS DE DAMPING
    // ========================================================================
    if (input.linearDamping !== this.lastLinearDamping) {
      logger.debug(`📉 Linear damping changed: ${this.lastLinearDamping} → ${input.linearDamping}`, 'InputSyncSystem');
      this.updateLinearDamping(entityManager, input.linearDamping);
      this.lastLinearDamping = input.linearDamping;
    }

    if (input.angularDamping !== this.lastAngularDamping) {
      logger.debug(`📉 Angular damping changed: ${this.lastAngularDamping} → ${input.angularDamping}`, 'InputSyncSystem');
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
   * Met à jour une longueur de bride (nez, inter ou centre)
   * Méthode interne partagée pour éviter la duplication
   * 
   * @param entityManager Manager des entités
   * @param bridleType Type de bride: 'nez' | 'inter' | 'centre'
   * @param newLength Nouvelle longueur en mètres
   */
  private updateBridleLength(
    entityManager: EntityManager,
    bridleType: 'nez' | 'inter' | 'centre',
    newLength: number
  ): void {
    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const bridle = kite.getComponent('bridle') as any;
    if (bridle && bridle.lengths) {
      bridle.lengths[bridleType] = newLength;
    }
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
