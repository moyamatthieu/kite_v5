import { Entity } from '../core/Entity';
import { DebugComponent } from '../components/DebugComponent';

/**
 * Crée l'entité debug pour la visualisation des vecteurs de force.
 */
export class DebugFactory {
  public static create(): Entity {
    const debugEntity = new Entity('debug-helper');
    debugEntity.addComponent(new DebugComponent());
    return debugEntity;
  }
}
