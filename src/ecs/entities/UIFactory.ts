import { Entity } from '../core/Entity';
import { InputComponent, type InputState } from '../components/InputComponent';
import { CONFIG } from '../config/Config';

/**
 * Crée l'entité UI qui contient les composants liés à l'interface.
 */
export class UIFactory {
  /**
   * Crée l'entité UI avec support des valeurs sauvegardées lors du reset
   * 
   * @param savedInputValues - Valeurs optionnelles à restaurer après un reset
   */
  public static create(savedInputValues?: InputState): Entity {
    const uiEntity = new Entity('ui');

    uiEntity.addComponent(
      new InputComponent({
        // === Vent ===
        windSpeed: savedInputValues?.windSpeed ?? CONFIG.wind.speed,
        windDirection: savedInputValues?.windDirection ?? CONFIG.wind.direction,
        windTurbulence: savedInputValues?.windTurbulence ?? CONFIG.wind.turbulence,

        // === Lignes ===
        lineLength: savedInputValues?.lineLength ?? CONFIG.lines.length,
        bridleNez: savedInputValues?.bridleNez ?? CONFIG.bridles.nez,
        bridleInter: savedInputValues?.bridleInter ?? CONFIG.bridles.inter,
        bridleCentre: savedInputValues?.bridleCentre ?? CONFIG.bridles.centre,
        
        // === Mode de contrainte ===
        constraintMode: savedInputValues?.constraintMode ?? CONFIG.modes.constraint,

        // === Mode aérodynamique ===
        aeroMode: savedInputValues?.aeroMode ?? CONFIG.modes.aero,

        // === Physique ===
        linearDamping: savedInputValues?.linearDamping ?? CONFIG.physics.linearDamping,
        angularDamping: savedInputValues?.angularDamping ?? CONFIG.physics.angularDamping,
        meshSubdivisionLevel: savedInputValues?.meshSubdivisionLevel ?? CONFIG.render.meshSubdivision,

        // === Aérodynamique ===
        liftScale: savedInputValues?.liftScale ?? CONFIG.aero.liftScale,
        dragScale: savedInputValues?.dragScale ?? CONFIG.aero.dragScale,
        forceSmoothing: savedInputValues?.forceSmoothing ?? CONFIG.aero.forceSmoothing,

        // === État ===
        isPaused: savedInputValues?.isPaused ?? !CONFIG.simulation.autoStart,
        debugMode: savedInputValues?.debugMode ?? CONFIG.debug.enabled,
      })
    );

    return uiEntity;
  }
}
