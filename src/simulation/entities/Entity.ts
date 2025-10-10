/**
 * Entity.ts - Interface de base pour toutes les entités ECS
 *
 * Une entité dans l'architecture ECS est simplement :
 * - Un ID unique
 * - Un ensemble de composants (données pures)
 *
 * Les entités ne contiennent PAS de logique, seulement des données.
 * La logique est dans les Systems.
 */

export type ComponentType = string;

/**
 * Interface de base pour tous les composants
 */
export interface Component {
  readonly type: ComponentType;
}

/**
 * Entité ECS de base
 */
export class Entity {
  public readonly id: string;
  private components: Map<ComponentType, Component> = new Map();
  private active: boolean = true;

  constructor(id?: string) {
    this.id = id || `entity_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Ajoute un composant à l'entité
   */
  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  /**
   * Récupère un composant par son type
   */
  getComponent<T extends Component>(type: ComponentType): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  /**
   * Vérifie si l'entité possède un composant
   */
  hasComponent(type: ComponentType): boolean {
    return this.components.has(type);
  }

  /**
   * Supprime un composant
   */
  removeComponent(type: ComponentType): void {
    this.components.delete(type);
  }

  /**
   * Récupère tous les composants
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  /**
   * Active/désactive l'entité
   */
  setActive(active: boolean): void {
    this.active = active;
  }

  /**
   * Vérifie si l'entité est active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Clone l'entité (shallow copy)
   */
  clone(): Entity {
    const newEntity = new Entity();
    this.components.forEach((component, type) => {
      newEntity.components.set(type, component);
    });
    return newEntity;
  }
}
