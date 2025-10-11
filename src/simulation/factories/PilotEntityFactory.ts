/**
 * PilotEntityFactory.ts - Factory pour créer l'entité ECS Pilot
 *
 * Responsabilité unique : Construction de l'entité Pilot
 * Encapsule l'instanciation pour cohérence avec ControlBarEntityFactory
 *
 * Pattern : Factory Method (simplifié - PilotEntity est autosuffisant)
 * Utilisation : Appelée depuis SimulationApp.createPilotEntity()
 */

import { PilotEntity } from '../entities/PilotEntity';

/**
 * Paramètres pour créer une entité Pilot
 * (Pour l'instant vide - PilotEntity ne supporte pas de customisation)
 */
export interface PilotFactoryParams {
  // Réservé pour extension future
}

/**
 * Factory pour créer l'entité ECS Pilot
 *
 * Note: PilotEntity construit toute sa géométrie dans son constructeur.
 * Cette factory sert principalement à maintenir la cohérence architecturale
 * avec les autres Entity Factories (ControlBar, future Kite).
 *
 * @example
 * ```typescript
 * const pilot = PilotEntityFactory.create();
 * ```
 */
export class PilotEntityFactory {
  /**
   * Crée une entité Pilot complète
   *
   * @param _params - Paramètres de configuration (réservé pour extension future)
   * @returns PilotEntity prête à l'emploi
   */
  static create(_params: PilotFactoryParams = {}): PilotEntity {
    // PilotEntity construit toute sa géométrie dans son constructeur
    // (BoxGeometry selon CONFIG.pilot.width/height/depth)
    return new PilotEntity();
  }
}
