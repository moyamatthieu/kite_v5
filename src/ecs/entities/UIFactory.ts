import { Entity } from '../core/Entity';
import { InputComponent } from '../components/InputComponent';
import { CONFIG } from '../config/Config';

/**
 * Crée l'entité UI qui contient les composants liés à l'interface.
 */
export class UIFactory {
  public static create(): Entity {
    const uiEntity = new Entity('ui');
    
    // Convertir km/h en m/s pour InputComponent (l'UI affiche en m/s)
    const KMH_TO_MS = 3.6;
    const windSpeedMs = CONFIG.wind.speed / KMH_TO_MS;

    uiEntity.addComponent(
      new InputComponent({
        lineLength: 150,
        windSpeed: windSpeedMs, // Lecture depuis CONFIG.wind.speed (converti en m/s)
        windDirection: CONFIG.wind.direction, // Lecture depuis CONFIG.wind.direction
        windTurbulence: 0, // 0% de turbulence pour stabilité initiale
        isPaused: !CONFIG.simulation.autoStart, // Lecture depuis la config (autoStart: true => isPaused: false)
        debugMode: CONFIG.debug.enabled, // Lecture depuis la config
      })
    );

    return uiEntity;
  }
}
