/**
 * EntityBuilder.ts - Utilitaires pour construire des entités ECS
 *
 * Responsabilité : Factoriser les patterns répétitifs de création d'entités
 * Principe DRY : Une seule source de vérité pour les composants standards
 *
 * Pattern : Builder + Factory Helpers
 * Utilisation : Appelé depuis les Entity Factories (ControlBar, Kite, Pilot, etc.)
 */

import * as THREE from 'three';
import { Entity } from '@base/Entity';

import { TransformComponent } from '@components/TransformComponent';
import { MeshComponent } from '@components/MeshComponent';

/**
 * Options pour créer un TransformComponent
 */
export interface TransformOptions {
  /** Rotation autour de l'axe Y (par défaut : 0) */
  rotation?: number;
  
  /** Quaternion (par défaut : identité) */
  quaternion?: THREE.Quaternion;
  
  /** Échelle (par défaut : (1, 1, 1)) */
  scale?: THREE.Vector3;
}

/**
 * Options pour créer un MeshComponent
 */
export interface MeshOptions {
  /** Visible dans la scène (par défaut : true) */
  visible?: boolean;
  
  /** Projette des ombres (par défaut : true) */
  castShadow?: boolean;
  
  /** Reçoit des ombres (par défaut : false) */
  receiveShadow?: boolean;
}

/**
 * Options pour créer une entité complète avec Transform + Mesh
 */
export interface EntityWithMeshOptions extends TransformOptions, MeshOptions {
  // Combine TransformOptions et MeshOptions
}

/**
 * EntityBuilder - Helpers utilitaires pour construire des entités ECS
 *
 * Factorisation des patterns répétitifs observés dans toutes les Entity Factories :
 * - Création de TransformComponent avec valeurs par défaut
 * - Création de MeshComponent avec options standard
 * - Extraction d'objets 3D typés depuis MeshComponent
 * - Création rapide d'entités simples (Transform + Mesh)
 *
 * @example
 * ```typescript
 * // Ajouter Transform + Mesh séparément
 * const entity = new Entity('myEntity');
 * EntityBuilder.addTransform(entity, position);
 * EntityBuilder.addMesh(entity, object3D);
 *
 * // Créer entité complète en une ligne
 * const entity = EntityBuilder.createWithMesh('myEntity', object3D, position);
 *
 * // Extraire objet 3D typé
 * const kite = EntityBuilder.getMeshObject<Kite>(kiteEntity);
 * ```
 */
export class EntityBuilder {
  /**
   * Ajoute un TransformComponent standard à une entité
   * 
   * Factorisation du pattern répété dans toutes les factories.
   * Valeurs par défaut :
   * - rotation : 0
   * - quaternion : identité
   * - scale : (1, 1, 1)
   *
   * @param entity - Entité à laquelle ajouter le composant
   * @param position - Position 3D (sera clonée)
   * @param options - Options de transformation (optionnelles)
   * @returns Le TransformComponent créé
   */
  static addTransform(
    entity: Entity,
    position: THREE.Vector3,
    options: TransformOptions = {}
  ): TransformComponent {
    const transform = new TransformComponent({
      position: position.clone(),
      rotation: options.rotation ?? 0,
      quaternion: options.quaternion ?? new THREE.Quaternion(),
      scale: options.scale ?? new THREE.Vector3(1, 1, 1)
    });
    entity.addComponent(transform);
    return transform;
  }

  /**
   * Ajoute un MeshComponent standard à une entité
   * 
   * Factorisation du pattern répété dans toutes les factories.
   * Valeurs par défaut :
   * - visible : true
   * - castShadow : true
   * - receiveShadow : false
   *
   * @param entity - Entité à laquelle ajouter le composant
   * @param object3D - Objet Three.js (mesh, group, etc.)
   * @param options - Options de rendu (optionnelles)
   * @returns Le MeshComponent créé
   */
  static addMesh(
    entity: Entity,
    object3D: THREE.Object3D,
    options: MeshOptions = {}
  ): MeshComponent {
    const mesh = new MeshComponent(object3D, {
      visible: options.visible ?? true,
      castShadow: options.castShadow ?? true,
      receiveShadow: options.receiveShadow ?? false
    });
    entity.addComponent(mesh);
    return mesh;
  }

  /**
   * Extrait un objet 3D typé depuis le MeshComponent d'une entité
   * 
   * Helper générique pour éviter répétition de getComponent + cast.
   * Utilisable partout (Factories, Systems, SimulationApp).
   *
   * @typeParam T - Type de l'objet 3D attendu (ex: Kite, THREE.Group)
   * @param entity - Entité contenant un MeshComponent
   * @returns Objet 3D typé ou null si composant absent
   *
   * @example
   * ```typescript
   * const kite = EntityBuilder.getMeshObject<Kite>(kiteEntity);
   * if (kite) {
   *   kite.setBridleLengths([...]);
   * }
   * ```
   */
  static getMeshObject<T extends THREE.Object3D>(entity: Entity): T | null {
    const meshComponent = entity.getComponent<MeshComponent>('mesh');
    if (!meshComponent) return null;
    return meshComponent.object3D as T;
  }

  /**
   * Crée une entité complète avec Transform + Mesh en une seule ligne
   * 
   * Cas d'usage le plus courant : entité avec position + objet 3D.
   * Équivalent à :
   * ```typescript
   * const entity = new Entity(name);
   * EntityBuilder.addTransform(entity, position, options);
   * EntityBuilder.addMesh(entity, object3D, options);
   * ```
   *
   * @param name - Nom de l'entité
   * @param object3D - Objet Three.js
   * @param position - Position 3D
   * @param options - Options combinées (Transform + Mesh)
   * @returns Entité complète avec Transform et Mesh
   *
   * @example
   * ```typescript
   * const entity = EntityBuilder.createWithMesh(
   *   'kite',
   *   kiteObject,
   *   new THREE.Vector3(0, 50, -100)
   * );
   * ```
   */
  static createWithMesh(
    name: string,
    object3D: THREE.Object3D,
    position: THREE.Vector3,
    options: EntityWithMeshOptions = {}
  ): Entity {
    const entity = new Entity(name);

    // Ajouter Transform
    this.addTransform(entity, position, {
      rotation: options.rotation,
      quaternion: options.quaternion,
      scale: options.scale
    });

    // Ajouter Mesh
    this.addMesh(entity, object3D, {
      visible: options.visible,
      castShadow: options.castShadow,
      receiveShadow: options.receiveShadow
    });

    return entity;
  }
}
