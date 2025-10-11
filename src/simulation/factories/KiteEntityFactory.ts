/**
 * KiteEntityFactory.ts - Factory pour créer l'entité ECS Kite
 *
 * Responsabilité unique : Construction de l'entité Kite avec objet StructuredObject complet
 * Réutilise les factories géométriques existantes (PointFactory, FrameFactory, etc.)
 *
 * Pattern : Factory Method + Composition
 * Utilisation : Appelée depuis SimulationApp.createKiteEntity()
 */

import * as THREE from 'three';

import { Entity } from '../entities/Entity';
import { CONFIG } from '../config/SimulationConfig';

import { EntityBuilder } from './EntityBuilder';

import { Kite } from '@/objects/Kite';
import { MathUtils } from '@/utils/MathUtils';


/**
 * Paramètres pour créer une entité Kite
 */
export interface KiteFactoryParams {
  /** Position initiale du kite (par défaut : calculée automatiquement) */
  position?: THREE.Vector3;
  
  /** Preset de configuration (par défaut : default config) */
  preset?: string; // Extension future pour différents types de kites
  
  /** Nom de l'entité (par défaut : 'kite') */
  name?: string;
}

/**
 * Factory pour créer l'entité ECS Kite avec objet StructuredObject complet
 *
 * Le kite est un objet complexe utilisant plusieurs factories géométriques :
 * - PointFactory : Points anatomiques (NEZ, CTRL_GAUCHE, CTRL_DROIT, etc.)
 * - FrameFactory : Structure en carbone
 * - SurfaceFactory : Panneaux de voile
 * - BridleFactory : Système de bridage (6 lignes)
 *
 * Cette factory ECS **compose** avec ces factories existantes via `new Kite()`.
 *
 * @example
 * ```typescript
 * // Création simple (position auto-calculée)
 * const kite = KiteEntityFactory.create();
 *
 * // Avec position personnalisée
 * const kite = KiteEntityFactory.create({
 *   position: new THREE.Vector3(0, 50, -100)
 * });
 * ```
 */
export class KiteEntityFactory {
  /**
   * Crée une entité Kite complète avec objet StructuredObject Three.js
   *
   * @param params - Paramètres de configuration
   * @returns Entité ECS Kite prête à l'emploi (avec objet Kite accessible via MeshComponent)
   */
  static create(params: KiteFactoryParams = {}): Entity {
    // 1. Créer l'objet Kite (StructuredObject)
    // Cet objet utilise automatiquement PointFactory, FrameFactory, SurfaceFactory, BridleFactory
    const kite = new Kite();
    
    // 2. Position initiale (auto-calculée ou fournie)
    const position = params.position || this.calculateInitialPosition();
    kite.position.copy(position);
    
    // 3. Créer l'entité ECS avec Transform + Mesh (via EntityBuilder)
    return EntityBuilder.createWithMesh(
      params.name || 'kite',
      kite,
      position
    );
  }
  
  /**
   * Calcule la position initiale du kite selon la configuration
   * 
   * Logique métier : Position basée sur la barre de contrôle + longueur des lignes
   * 
   * Accessible publiquement pour réutilisation (ex: reset du kite)
   * 
   * @returns Position Vector3 calculée
   */
  static calculateInitialPosition(): THREE.Vector3 {
    // Position de la barre de contrôle calculée à partir du pilote
    // Note: Cette position est la même que dans ControlBarEntityFactory
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    // Calculer position kite selon longueur des lignes et facteur de distance
    return MathUtils.calculateInitialKitePosition(
      controlBarPosition, // Référence = barre de contrôle
      CONFIG.initialization.initialKiteY,
      CONFIG.lines.defaultLength,
      CONFIG.initialization.initialDistanceFactor,
      CONFIG.initialization.initialKiteZ
    );
  }
  
  /**
   * Extrait l'objet Kite d'une entité (helper utilitaire)
   * 
   * Wrapper typé autour de EntityBuilder.getMeshObject<Kite>()
   * pour commodité et clarté du code.
   * 
   * @param entity - Entité contenant un MeshComponent avec objet Kite
   * @returns Objet Kite ou null si non trouvé
   */
  static getKiteObject(entity: Entity): Kite | null {
    return EntityBuilder.getMeshObject<Kite>(entity);
  }
}
