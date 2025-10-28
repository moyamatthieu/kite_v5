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

import { Component } from './Component';

export type ComponentType = string;

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
   * Récupère tous les composants de l'entité
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  /**
   * Récupère tous les types de composants de l'entité
   */
  getComponentTypes(): ComponentType[] {
    return Array.from(this.components.keys());
  }

  /**
   * Vérifie si l'entité possède un composant donné
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
   * Initialise l'entité (appelé lors de la création)
   */
  initialize(): void {
    this.components.forEach(component => {
      if (typeof component.update === 'function') {
        component.update(0); // Initial update
      }
    });
  }

  /**
   * Nettoie l'entité (appelé avant destruction)
   */
  cleanup(): void {
    this.components.clear();
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