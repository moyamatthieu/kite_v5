/**
 * KiteEntityFactory.ts - Factory pour créer l'entité ECS Kite
 *
 * Responsabilité unique : Construction de l'entité Kite avec données géométriques pures
 * Utilise les factories géométriques existantes pour calculer les données ECS
 *
 * Pattern : Factory Method + Composition
 * Utilisation : Appelée depuis SimulationApp.createKiteEntity()
 */

import * as THREE from 'three';

import { Entity } from '@base/Entity';
import { CONFIG } from '../config/SimulationConfig';
import { EntityBuilder } from './EntityBuilder';
import { GeometryComponent, VisualComponent } from '../components';
import { PointFactory } from '../factories/PointFactory';
import { MathUtils } from '@utils/MathUtils';
import { KiteGeometry } from '../config/KiteGeometry';


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
 * Factory pour créer l'entité ECS Kite avec données géométriques pures
 *
 * Le kite est défini par des données ECS pures :
 * - GeometryComponent : Points, connexions, surfaces
 * - VisualComponent : Couleurs, matériaux
 *
 * Les données géométriques viennent de KiteGeometry et PointFactory.
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
   * Crée une entité Kite complète avec données géométriques ECS pures
   *
   * @param params - Paramètres de configuration
   * @returns Entité ECS Kite prête à l'emploi (avec GeometryComponent et VisualComponent)
   */
  static create(params: KiteFactoryParams = {}): Entity {
    // Calculer la position initiale
    const position = params.position || this.calculateInitialPosition();
    
    // Créer l'entité ECS
    const entity = new Entity(params.name || 'kite');
    
    // Ajouter le composant de transformation
    EntityBuilder.addTransform(entity, position);
    
    // Créer et ajouter les composants géométriques
    this.addGeometryComponents(entity);
    
    return entity;
  }
  
  /**
   * Ajoute les composants géométriques et visuels à l'entité kite
   */
  private static addGeometryComponents(entity: Entity): void {
    // Créer le composant géométrie
    const geometry = new GeometryComponent();
    
    // Ajouter les points de base depuis KiteGeometry
    Object.entries(KiteGeometry.POINTS).forEach(([name, point]) => {
      geometry.points.set(name, point.clone());
    });
    
    // Calculer et ajouter les points de contrôle (bridle)
    const kiteParams = {
      width: 1.65, // Envergure calculée depuis KiteGeometry.POINTS
      height: 0.65, // Hauteur depuis NEZ à SPINE_BAS
      depth: 0.15, // Profondeur des whiskers
      bridleLengths: CONFIG.bridle.defaultLengths
    };
    
    const controlPoints = PointFactory.calculateDeltaKitePoints(kiteParams);
    controlPoints.forEach((point, name) => {
      geometry.points.set(name, point.clone());
    });
    
    // Ajouter les connexions (frames)
    // TODO: Définir les connexions pour la structure
    
    // Ajouter les surfaces
    KiteGeometry.SURFACES.forEach((surface, index) => {
      // Convertir les vertices en noms de points
      const pointNames: string[] = [];
      surface.vertices.forEach(vertex => {
        // Trouver le nom du point correspondant
        for (const [name, point] of Object.entries(KiteGeometry.POINTS)) {
          if (point.equals(vertex)) {
            pointNames.push(name);
            break;
          }
        }
      });
      
      if (pointNames.length === 3) {
        geometry.surfaces.push({
          points: pointNames
        });
      }
    });
    
    entity.addComponent(geometry);
    
    // Créer le composant visuel
    const visual = new VisualComponent();
    visual.frameMaterial = {
      color: '#333333', // CONFIG.colors.kiteFrame
      diameter: 0.005 // Diamètre réaliste pour tubes
    };
    visual.surfaceMaterial = {
      color: '#ffffff', // CONFIG.colors.kiteSail
      opacity: 0.9,
      transparent: true,
      doubleSided: true
    };
    
    entity.addComponent(visual);
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
}
