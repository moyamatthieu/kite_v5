/**
 * EntityManager avec Archetype Queries - Version optimisée
 * 
 * Amélioration des performances par :
 * - Cache des queries fréquentes
 * - Index par archetype (combinaison de composants)
 * - Invalidation sélective du cache
 */

import { Entity, ComponentType } from '@base/Entity';

/**
 * Représente un archetype (combinaison de types de composants)
 */
type Archetype = string; // e.g., "transform|physics|mesh"

/**
 * Crée une clé d'archetype à partir de types de composants
 */
function createArchetypeKey(componentTypes: ComponentType[]): Archetype {
  return [...componentTypes].sort().join('|');
}

/**
 * Gestionnaire central des entités avec archetype queries optimisé
 */
export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  
  // Cache des queries par archetype
  private queryCache: Map<Archetype, Entity[]> = new Map();
  
  // Index inversé : composant -> entités qui le possèdent
  private componentIndex: Map<ComponentType, Set<string>> = new Map();
  
  // Flag pour invalider le cache
  private cacheNeedsUpdate: boolean = true;

  /**
   * Crée une nouvelle entité et l'enregistre
   */
  createEntity(id?: string): Entity {
    const entity = new Entity(id);
    this.registerEntity(entity);
    return entity;
  }

  /**
   * Enregistre une entité existante
   */
  registerEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    this.invalidateCache();
    this.updateComponentIndex(entity);
  }

  /**
   * Supprime une entité
   */
  destroyEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      this.removeFromComponentIndex(entity);
      this.entities.delete(entityId);
      this.invalidateCache();
    }
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
   * Version optimisée avec index
   */
  getEntitiesWithComponent(componentType: ComponentType): Entity[] {
    const entityIds = this.componentIndex.get(componentType);
    if (!entityIds) return [];

    const result: Entity[] = [];
    for (const id of entityIds) {
      const entity = this.entities.get(id);
      if (entity && entity.isActive()) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Récupère toutes les entités possédant tous les composants donnés
   * Version optimisée avec cache d'archetype
   */
  getEntitiesWithComponents(...componentTypes: ComponentType[]): Entity[] {
    if (componentTypes.length === 0) {
      return this.getActiveEntities();
    }

    const archetypeKey = createArchetypeKey(componentTypes);

    // Vérifier le cache
    if (!this.cacheNeedsUpdate && this.queryCache.has(archetypeKey)) {
      return this.queryCache.get(archetypeKey)!;
    }

    // Calculer la query
    const result = this.computeArchetypeQuery(componentTypes);

    // Mettre en cache
    this.queryCache.set(archetypeKey, result);

    return result;
  }

  /**
   * Query par archetype (alias pour getEntitiesWithComponents)
   * Plus explicite pour indiquer qu'on utilise le système d'archetype
   */
  getEntitiesByArchetype(componentTypes: ComponentType[]): Entity[] {
    return this.getEntitiesWithComponents(...componentTypes);
  }

  /**
   * Calcule les entités matchant un archetype donné
   */
  private computeArchetypeQuery(componentTypes: ComponentType[]): Entity[] {
    // Optimisation : commencer par le composant le moins fréquent
    let candidateIds: Set<string> | null = null;
    let minSize = Infinity;

    // Trouver le composant le moins fréquent
    for (const type of componentTypes) {
      const entityIds = this.componentIndex.get(type);
      if (!entityIds) return []; // Aucune entité avec ce composant
      
      if (entityIds.size < minSize) {
        minSize = entityIds.size;
        candidateIds = entityIds;
      }
    }

    if (!candidateIds) return [];

    // Filtrer les candidats pour vérifier qu'ils ont tous les composants
    const result: Entity[] = [];
    for (const id of candidateIds) {
      const entity = this.entities.get(id);
      if (!entity || !entity.isActive()) continue;

      const hasAllComponents = componentTypes.every(type =>
        entity.getComponent(type) !== undefined
      );

      if (hasAllComponents) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Met à jour l'index des composants pour une entité
   */
  private updateComponentIndex(entity: Entity): void {
    const components = entity.getAllComponents();
    
    for (const component of components) {
      if (!this.componentIndex.has(component.type)) {
        this.componentIndex.set(component.type, new Set());
      }
      this.componentIndex.get(component.type)!.add(entity.id);
    }
  }

  /**
   * Retire une entité de l'index des composants
   */
  private removeFromComponentIndex(entity: Entity): void {
    const components = entity.getAllComponents();
    
    for (const component of components) {
      const entitySet = this.componentIndex.get(component.type);
      if (entitySet) {
        entitySet.delete(entity.id);
        if (entitySet.size === 0) {
          this.componentIndex.delete(component.type);
        }
      }
    }
  }

  /**
   * Invalide le cache des queries
   * Appelé automatiquement lors de modifications structurelles
   */
  private invalidateCache(): void {
    this.cacheNeedsUpdate = true;
  }

  /**
   * Vide le cache des queries
   * Permet de forcer une mise à jour complète
   */
  clearQueryCache(): void {
    this.queryCache.clear();
    this.cacheNeedsUpdate = true;
  }

  /**
   * Revalide le cache après un batch de modifications
   */
  revalidateCache(): void {
    this.cacheNeedsUpdate = false;
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
    this.componentIndex.clear();
    this.queryCache.clear();
    this.cacheNeedsUpdate = true;
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
   * Version optimisée avec index
   */
  forEachWithComponent(
    componentType: ComponentType,
    callback: (entity: Entity) => void
  ): void {
    const entities = this.getEntitiesWithComponent(componentType);
    entities.forEach(callback);
  }

  /**
   * Itère sur toutes les entités actives avec plusieurs composants
   * Version optimisée avec archetype query
   */
  forEachWithComponents(
    componentTypes: ComponentType[],
    callback: (entity: Entity) => void
  ): void {
    const entities = this.getEntitiesWithComponents(...componentTypes);
    entities.forEach(callback);
  }

  /**
   * Retourne des statistiques sur l'EntityManager
   * Utile pour debug et optimisation
   */
  getStats(): {
    totalEntities: number;
    activeEntities: number;
    cachedQueries: number;
    componentsIndexed: number;
  } {
    return {
      totalEntities: this.entities.size,
      activeEntities: this.getActiveEntities().length,
      cachedQueries: this.queryCache.size,
      componentsIndexed: this.componentIndex.size
    };
  }
}
