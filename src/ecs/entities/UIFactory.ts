import { Entity } from '../core/Entity';
import { InputComponent } from '../components/InputComponent';
import { CONFIG } from '../config/Config';

/**
 * Crée l'entité UI qui contient les composants liés à l'interface.
 */
export class UIFactory {
  public static create(): Entity {
    const uiEntity = new Entity('ui');

    uiEntity.addComponent(
      new InputComponent({
        // === Vent ===
        windSpeed: CONFIG.wind.speed,
        windDirection: CONFIG.wind.direction,
        windTurbulence: CONFIG.wind.turbulence,

        // === Lignes ===
        lineLength: CONFIG.lines.length,
        bridleNez: CONFIG.bridles.nez,
        bridleInter: CONFIG.bridles.inter,
        bridleCentre: CONFIG.bridles.centre,

        // === Physique ===
        linearDamping: CONFIG.physics.linearDamping,
        angularDamping: CONFIG.physics.angularDamping,
        meshSubdivisionLevel: CONFIG.render.meshSubdivision,

        // === Aérodynamique ===
        liftScale: CONFIG.aero.liftScale,
        dragScale: CONFIG.aero.dragScale,
        forceSmoothing: CONFIG.aero.forceSmoothing,

        // === État ===
        isPaused: !CONFIG.simulation.autoStart,
        debugMode: CONFIG.debug.enabled,
      })
    );

    return uiEntity;
  }
}
