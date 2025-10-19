/**
 * Entity.ts - Entité ECS (conteneur de composants)
 * 
 * Une entité est simplement :
 * - Un identifiant unique
 * - Une collection de composants
 * 
 * Pas de logique métier ici, seulement de la gestion de composants.
 */

import { Component } from './Component';

export class Entity {
  /** Identifiant unique de l'entité */
  readonly id: string;
  
  /** Map des composants (type → composant) */
  private components: Map<string, Component>;
  
  constructor(id: string) {
    this.id = id;
    this.components = new Map();
  }
  
  /**
   * Ajoute un composant à l'entité
   */
  addComponent(component: Component): this {
    this.components.set(component.type, component);
    return this;
  }
  
  /**
   * Récupère un composant par son type
   */
  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }
  
  /**
   * Vérifie si l'entité possède un composant
   */
  hasComponent(type: string): boolean {
    return this.components.has(type);
  }
  
  /**
   * Vérifie si l'entité possède tous les composants spécifiés
   */
  hasAllComponents(types: string[]): boolean {
    return types.every(type => this.hasComponent(type));
  }
  
  /**
   * Supprime un composant
   */
  removeComponent(type: string): boolean {
    return this.components.delete(type);
  }
  
  /**
   * Récupère tous les types de composants
   */
  getComponentTypes(): string[] {
    return Array.from(this.components.keys());
  }
  
  /**
   * Récupère tous les composants
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }
}
