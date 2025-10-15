/**
 * Tests unitaires pour EntityManager avec archetype queries
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityManager } from '@entities/EntityManager.optimized';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { MeshComponent } from '@components/MeshComponent';

describe('EntityManager - Archetype Queries', () => {
  let entityManager: EntityManager;

  beforeEach(() => {
    entityManager = new EntityManager();
  });

  describe('Création et enregistrement d\'entités', () => {
    test('Doit créer une entité avec un ID unique', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();

      expect(entity1.id).toBeDefined();
      expect(entity2.id).toBeDefined();
      expect(entity1.id).not.toBe(entity2.id);
    });

    test('Doit créer une entité avec un ID personnalisé', () => {
      const entity = entityManager.createEntity('custom-id');
      expect(entity.id).toBe('custom-id');
    });

    test('Doit enregistrer une entité existante', () => {
      const entity = new Entity('test-entity');
      entityManager.registerEntity(entity);

      expect(entityManager.getEntity('test-entity')).toBe(entity);
    });

    test('Doit compter correctement les entités', () => {
      entityManager.createEntity();
      entityManager.createEntity();
      entityManager.createEntity();

      expect(entityManager.getEntityCount()).toBe(3);
    });
  });

  describe('Query par composant unique', () => {
    test('Doit trouver les entités avec un composant donné', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();
      const entity3 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity2.addComponent(new TransformComponent());
      entity3.addComponent(new PhysicsComponent({ mass: 1 }));

      const results = entityManager.getEntitiesWithComponent('transform');

      expect(results.length).toBe(2);
      expect(results).toContain(entity1);
      expect(results).toContain(entity2);
      expect(results).not.toContain(entity3);
    });

    test('Doit retourner un tableau vide si aucune entité n\'a le composant', () => {
      entityManager.createEntity();
      entityManager.createEntity();

      const results = entityManager.getEntitiesWithComponent('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('Query par archetype (plusieurs composants)', () => {
    test('Doit trouver les entités avec tous les composants spécifiés', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();
      const entity3 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity1.addComponent(new PhysicsComponent({ mass: 1 }));

      entity2.addComponent(new TransformComponent());
      entity2.addComponent(new PhysicsComponent({ mass: 2 }));

      entity3.addComponent(new TransformComponent());

      const results = entityManager.getEntitiesByArchetype(['transform', 'physics']);

      expect(results.length).toBe(2);
      expect(results).toContain(entity1);
      expect(results).toContain(entity2);
      expect(results).not.toContain(entity3);
    });

    test('Doit retourner toutes les entités si aucun composant n\'est spécifié', () => {
      entityManager.createEntity();
      entityManager.createEntity();
      entityManager.createEntity();

      const results = entityManager.getEntitiesByArchetype([]);

      expect(results.length).toBe(3);
    });

    test('Doit retourner un tableau vide si aucune entité ne matche l\'archetype', () => {
      const entity = entityManager.createEntity();
      entity.addComponent(new TransformComponent());

      const results = entityManager.getEntitiesByArchetype(['transform', 'physics', 'mesh']);

      expect(results).toEqual([]);
    });
  });

  describe('Cache des queries', () => {
    test('Les queries répétées doivent utiliser le cache', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity1.addComponent(new PhysicsComponent({ mass: 1 }));

      entity2.addComponent(new TransformComponent());
      entity2.addComponent(new PhysicsComponent({ mass: 2 }));

      // Première query (calcul)
      const results1 = entityManager.getEntitiesByArchetype(['transform', 'physics']);
      entityManager.revalidateCache();

      // Deuxième query (depuis cache)
      const results2 = entityManager.getEntitiesByArchetype(['transform', 'physics']);

      // Les résultats doivent être les mêmes
      expect(results1).toEqual(results2);
    });

    test('Le cache doit être invalidé après ajout d\'entité', () => {
      const entity1 = entityManager.createEntity();
      entity1.addComponent(new TransformComponent());
      entity1.addComponent(new PhysicsComponent({ mass: 1 }));

      const results1 = entityManager.getEntitiesByArchetype(['transform', 'physics']);
      expect(results1.length).toBe(1);

      // Ajouter une nouvelle entité avec le même archetype
      const entity2 = entityManager.createEntity();
      entity2.addComponent(new TransformComponent());
      entity2.addComponent(new PhysicsComponent({ mass: 2 }));

      const results2 = entityManager.getEntitiesByArchetype(['transform', 'physics']);
      expect(results2.length).toBe(2);
    });

    test('Le cache peut être vidé manuellement', () => {
      const entity = entityManager.createEntity();
      entity.addComponent(new TransformComponent());

      entityManager.getEntitiesByArchetype(['transform']);
      
      const statsBefore = entityManager.getStats();
      expect(statsBefore.cachedQueries).toBeGreaterThan(0);

      entityManager.clearQueryCache();

      const statsAfter = entityManager.getStats();
      expect(statsAfter.cachedQueries).toBe(0);
    });
  });

  describe('Suppression d\'entités', () => {
    test('Doit supprimer une entité correctement', () => {
      const entity = entityManager.createEntity('to-delete');
      entityManager.destroyEntity('to-delete');

      expect(entityManager.getEntity('to-delete')).toBeUndefined();
      expect(entityManager.getEntityCount()).toBe(0);
    });

    test('Les queries ne doivent plus inclure les entités supprimées', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity('to-delete');

      entity1.addComponent(new TransformComponent());
      entity2.addComponent(new TransformComponent());

      let results = entityManager.getEntitiesWithComponent('transform');
      expect(results.length).toBe(2);

      entityManager.destroyEntity('to-delete');

      results = entityManager.getEntitiesWithComponent('transform');
      expect(results.length).toBe(1);
      expect(results).toContain(entity1);
    });
  });

  describe('Entités actives/inactives', () => {
    test('Les queries ne doivent retourner que les entités actives', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity2.addComponent(new TransformComponent());

      entity2.setActive(false);

      const results = entityManager.getEntitiesWithComponent('transform');

      expect(results.length).toBe(1);
      expect(results).toContain(entity1);
      expect(results).not.toContain(entity2);
    });
  });

  describe('Itérations', () => {
    test('forEach doit itérer sur toutes les entités actives', () => {
      entityManager.createEntity();
      entityManager.createEntity();
      const inactiveEntity = entityManager.createEntity();
      inactiveEntity.setActive(false);

      let count = 0;
      entityManager.forEach(() => count++);

      expect(count).toBe(2);
    });

    test('forEachWithComponent doit itérer sur les entités avec un composant', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();
      const entity3 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity2.addComponent(new TransformComponent());
      entity3.addComponent(new PhysicsComponent({ mass: 1 }));

      const visited: Entity[] = [];
      entityManager.forEachWithComponent('transform', (entity) => {
        visited.push(entity);
      });

      expect(visited.length).toBe(2);
      expect(visited).toContain(entity1);
      expect(visited).toContain(entity2);
    });

    test('forEachWithComponents doit itérer sur les entités avec plusieurs composants', () => {
      const entity1 = entityManager.createEntity();
      const entity2 = entityManager.createEntity();

      entity1.addComponent(new TransformComponent());
      entity1.addComponent(new PhysicsComponent({ mass: 1 }));

      entity2.addComponent(new TransformComponent());

      const visited: Entity[] = [];
      entityManager.forEachWithComponents(['transform', 'physics'], (entity) => {
        visited.push(entity);
      });

      expect(visited.length).toBe(1);
      expect(visited).toContain(entity1);
    });
  });

  describe('Statistiques', () => {
    test('getStats doit retourner des statistiques correctes', () => {
      entityManager.createEntity();
      entityManager.createEntity();
      const entity3 = entityManager.createEntity();
      entity3.setActive(false);

      entity3.addComponent(new TransformComponent());
      entityManager.getEntitiesWithComponent('transform');

      const stats = entityManager.getStats();

      expect(stats.totalEntities).toBe(3);
      expect(stats.activeEntities).toBe(2);
      expect(stats.componentsIndexed).toBeGreaterThan(0);
    });
  });

  describe('Clear', () => {
    test('clear doit supprimer toutes les entités et vider le cache', () => {
      entityManager.createEntity();
      entityManager.createEntity();
      entityManager.getEntitiesByArchetype(['transform']);

      entityManager.clear();

      expect(entityManager.getEntityCount()).toBe(0);
      expect(entityManager.getStats().cachedQueries).toBe(0);
      expect(entityManager.getStats().componentsIndexed).toBe(0);
    });
  });

  describe('Performance', () => {
    test('Les queries sur grands ensembles doivent être rapides', () => {
      // Créer 1000 entités avec différents archétypes
      for (let i = 0; i < 1000; i++) {
        const entity = entityManager.createEntity();
        
        if (i % 2 === 0) {
          entity.addComponent(new TransformComponent());
        }
        
        if (i % 3 === 0) {
          entity.addComponent(new PhysicsComponent({ mass: i }));
        }
        
        if (i % 5 === 0) {
          entity.addComponent(new MeshComponent(new THREE.Group()));
        }
      }

      const start = performance.now();
      const results = entityManager.getEntitiesByArchetype(['transform', 'physics']);
      const duration = performance.now() - start;

      // La query doit être très rapide (<10ms pour 1000 entités)
      expect(duration).toBeLessThan(10);
      expect(results.length).toBeGreaterThan(0);
    });

    test('Les queries cachées doivent être quasi-instantanées', () => {
      for (let i = 0; i < 100; i++) {
        const entity = entityManager.createEntity();
        entity.addComponent(new TransformComponent());
        entity.addComponent(new PhysicsComponent({ mass: i }));
      }

      // Première query (calcul)
      entityManager.getEntitiesByArchetype(['transform', 'physics']);
      entityManager.revalidateCache();

      // Deuxième query (depuis cache)
      const start = performance.now();
      entityManager.getEntitiesByArchetype(['transform', 'physics']);
      const duration = performance.now() - start;

      // La query cachée doit être très rapide (<1ms)
      expect(duration).toBeLessThan(1);
    });
  });
});
