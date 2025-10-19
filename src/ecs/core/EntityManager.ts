/**
 * EntityManager.ts - Gestionnaire d'entités ECS
 * 
 * Responsabilités :
 * - Enregistrer/supprimer des entités
 * - Query des entités par archétypes (composants requis)
 * - Accès rapide par ID
 */

import { Logger } from '../utils/Logging';

import { Entity } from './Entity';

export class EntityManager {
  /** Map des entités (id → entité) */
  private entities: Map<string, Entity>;
  private logger = Logger.getInstance();
  
  constructor() {
    this.entities = new Map();
  }
  
  /**
   * Enregistre une entité
   */
  register(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      this.logger.warn(`Entity ${entity.id} already registered`, 'EntityManager');
      return;
    }
    this.entities.set(entity.id, entity);
  }
  
  /**
   * Récupère une entité par son ID
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }
  
  /**
   * Vérifie si une entité existe
   */
  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }
  
  /**
   * Supprime une entité
   */
  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }
  
  /**
   * Query : récupère toutes les entités avec les composants spécifiés
   * 
   * @param componentTypes - Types de composants requis
   * @returns Array d'entités matching
   */
  query(componentTypes: string[]): Entity[] {
    return Array.from(this.entities.values()).filter(entity =>
      entity.hasAllComponents(componentTypes)
    );
  }
  
  /**
   * Récupère toutes les entités
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
  
  /**
   * Compte le nombre d'entités
   */
  getEntityCount(): number {
    return this.entities.size;
  }
  
  /**
   * Vide toutes les entités
   */
  clear(): void {
    this.entities.clear();
  }
}
