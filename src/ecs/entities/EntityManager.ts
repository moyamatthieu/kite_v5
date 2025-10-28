/**
 * EntityManager.ts - Gestionnaire central des entités ECS
 *
 * Responsabilités :
 * - Créer et détruire des entités
 * - Maintenir un registre central de toutes les entités
 * - Fournir des méthodes de requête pour trouver des entités
 */

import { Entity, ComponentType } from '@base/Entity';

/**
 * Gestionnaire central des entités
 */
export class EntityManager {
  private entities: Map<string, Entity> = new Map();

  /**
   * Crée une nouvelle entité et l'enregistre
   */
  createEntity(id?: string): Entity {
    const entity = new Entity(id);
    this.entities.set(entity.id, entity);
    return entity;
  }

  /**
   * Enregistre une entité existante
   */
  registerEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  /**
   * Supprime une entité
   */
  destroyEntity(entityId: string): void {
    this.entities.delete(entityId);
  }

  /**
   * Récupère une entité par son ID
   */
  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Récupère toutes les entités
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Récupère toutes les entités actives
   */
  getActiveEntities(): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.isActive());
  }

  /**
   * Récupère toutes les entités possédant un composant donné
   */
  getEntitiesWithComponent(componentType: ComponentType): Entity[] {
    return Array.from(this.entities.values()).filter(e =>
      e.getComponent(componentType) !== undefined && e.isActive()
    );
  }

  /**
   * Récupère toutes les entités possédant tous les composants donnés
   */
  getEntitiesWithComponents(...componentTypes: ComponentType[]): Entity[] {
    return Array.from(this.entities.values()).filter(entity => {
      if (!entity.isActive()) return false;
      return componentTypes.every(type => entity.getComponent(type) !== undefined);
    });
  }

  /**
   * Compte le nombre d'entités
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Supprime toutes les entités
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Itère sur toutes les entités actives
   */
  forEach(callback: (entity: Entity) => void): void {
    this.entities.forEach(entity => {
      if (entity.isActive()) {
        callback(entity);
      }
    });
  }

  /**
   * Itère sur toutes les entités actives avec un composant donné
   */
  forEachWithComponent(
    componentType: ComponentType,
    callback: (entity: Entity) => void
  ): void {
    this.entities.forEach(entity => {
      if (entity.isActive() && entity.getComponent(componentType) !== undefined) {
        callback(entity);
      }
    });
  }

  /**
   * Itère sur toutes les entités actives avec plusieurs composants
   */
  forEachWithComponents(
    componentTypes: ComponentType[],
    callback: (entity: Entity) => void
  ): void {
    this.entities.forEach(entity => {
      if (!entity.isActive()) return;

      const hasAllComponents = componentTypes.every(type =>
        entity.getComponent(type) !== undefined
      );

      if (hasAllComponents) {
        callback(entity);
      }
    });
  }
}