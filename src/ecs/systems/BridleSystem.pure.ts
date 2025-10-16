/**
 * BridleSystem.pure.ts - Système ECS pur pour le bridage du cerf-volant
 *
 * Architecture ECS 100% pure :
 *   - Hérite de BaseSimulationSystem
 *   - Travaille avec BridleComponent dans KiteEntity
 *   - Calcule les tensions pour affichage/debug
 *   - Les contraintes géométriques sont gérées par PureConstraintSolver
 *
 * Rôle :
 *   - Coordonne les 6 brides (3 gauches + 3 droites)
 *   - Calcule les tensions pour affichage/debug
 *   - Les brides sont des CONTRAINTES, pas des ressorts
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { EntityManager } from '@entities/EntityManager';
import { GeometryComponent } from '@components/GeometryComponent';
import { TransformComponent } from '@components/TransformComponent';
import { BridleComponent } from '@components/BridleComponent';
import { Logger } from '@utils/Logging';

import { BridleTensions } from 'src/ecs/types/BridleTypes';

/**
 * Système ECS pur de gestion des brides
 */
export class PureBridleSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;
  private kiteEntity: Entity | null = null;
  private logger = Logger.getInstance();

  constructor(entityManager: EntityManager) {
    super('PureBridleSystem', 55); // Priorité 55 (après lignes, avant rendu)
    this.entityManager = entityManager;
  }

  /**
   * Initialise le système
   */
  initialize(): void {
    // Trouver l'entité kite via EntityManager
    const allEntities = this.entityManager.getAllEntities();
    this.kiteEntity = allEntities.find(e => e.id === 'kite') || null;

    if (!this.kiteEntity) {
      this.logger.warn('Kite entity not found in EntityManager', 'PureBridleSystem');
      return;
    }

    const bridleComponent = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridleComponent) {
      this.logger.warn('Kite entity missing bridle component', 'PureBridleSystem');
    }
  }

  /**
   * Met à jour le système (appelé chaque frame)
   */
  update(_context: SimulationContext): void {
    if (!this.enabled) return;

    // Pour l'instant, le système est passif
    // Les tensions sont calculées à la demande via calculateBridleTensions()
    // TODO: Implémenter update actif si nécessaire
  }

  /**
   * Réinitialise le système
   */
  reset(): void {
    // Réinitialiser les états des brides si nécessaire
    if (!this.kiteEntity) return;

    const bridleComponent = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (bridleComponent) {
      // Les tensions seront recalculées à la prochaine frame
      this.logger.info('Reset bridle state', 'PureBridleSystem');
    }
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.kiteEntity = null;
  }

  /**
   * Configure l'entité kite manuellement
   */
  setKiteEntity(kiteEntity: Entity): void {
    const bridleComponent = kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridleComponent) {
      this.logger.warn('KiteEntity must have BridleComponent', 'PureBridleSystem');
      return;
    }
    this.kiteEntity = kiteEntity;
  }

  /**
   * Calcule les tensions de toutes les brides
   *
   * Version ECS pure simplifiée : calcul basé sur la géométrie
   * Les brides sont des contraintes qui relient des points du kite
   *
   * @param kiteEntity - Entité du cerf-volant
   * @returns Tensions des 6 brides (Newtons)
   */
  calculateBridleTensions(kiteEntity: Entity): BridleTensions {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const bridle = kiteEntity.getComponent<BridleComponent>('bridle');

    if (!geometry || !transform || !bridle) {
      this.logger.warn(
        'Kite entity missing required components for bridle tension calculation',
        'PureBridleSystem'
      );
      return this.getZeroTensions();
    }

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone()
        .applyQuaternion(transform.quaternion)
        .add(transform.position);
    };

    // Calculer tension pour chaque bride
    const calculateBridleTension = (
      startName: string,
      endName: string,
      targetLength: number
    ): number => {
      const startLocal = geometry.getPoint(startName);
      const endLocal = geometry.getPoint(endName);

      if (!startLocal || !endLocal) {
        this.logger.warn(
          `Bridle points not found: ${startName} or ${endName}`,
          'PureBridleSystem'
        );
        return 0;
      }

      // Convertir en coordonnées monde
      const startWorld = toWorldCoordinates(startLocal);
      const endWorld = toWorldCoordinates(endLocal);

      // Calculer distance actuelle
      const currentLength = startWorld.distanceTo(endWorld);

      // Tension proportionnelle à la déformation
      // (bride tendue = currentLength > targetLength)
      const strain = (currentLength - targetLength) / targetLength;
      const tension = Math.max(0, strain * 100); // Facteur arbitraire pour affichage

      return tension;
    };

    // Calculer tensions des 6 brides
    return {
      leftNez: calculateBridleTension('NEZ', 'CTRL_GAUCHE', bridle.lengths.nez),
      leftInter: calculateBridleTension('INTER_GAUCHE', 'CTRL_GAUCHE', bridle.lengths.inter),
      leftCentre: calculateBridleTension('CENTRE', 'CTRL_GAUCHE', bridle.lengths.centre),
      rightNez: calculateBridleTension('NEZ', 'CTRL_DROIT', bridle.lengths.nez),
      rightInter: calculateBridleTension('INTER_DROIT', 'CTRL_DROIT', bridle.lengths.inter),
      rightCentre: calculateBridleTension('CENTRE', 'CTRL_DROIT', bridle.lengths.centre)
    };
  }

  /**
   * Retourne des tensions nulles par défaut
   */
  private getZeroTensions(): BridleTensions {
    return {
      leftNez: 0,
      leftInter: 0,
      leftCentre: 0,
      rightNez: 0,
      rightInter: 0,
      rightCentre: 0
    };
  }

  /**
   * Obtient les tensions actuelles des brides
   */
  getBridleTensions(): BridleTensions {
    if (!this.kiteEntity) {
      return this.getZeroTensions();
    }

    return this.calculateBridleTensions(this.kiteEntity);
  }

  /**
   * Alias pour compatibilité avec legacy code
   */
  getStats(): BridleTensions {
    return this.getBridleTensions();
  }

  /**
   * Obtient les longueurs configurées des brides
   */
  getBridleLengths(): { nez: number; inter: number; centre: number } {
    if (!this.kiteEntity) {
      return { nez: 0, inter: 0, centre: 0 };
    }

    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridle) {
      return { nez: 0, inter: 0, centre: 0 };
    }

    return { ...bridle.lengths };
  }

  /**
   * Modifie les longueurs des brides dans le BridleComponent
   * 
   * Note : Avec l'architecture de CTRL libres, les positions CTRL sont calculées
   * automatiquement par le ControlPointSystem via quadrilatération.
   * On met seulement à jour les longueurs dans le BridleComponent.
   */
  setBridleLengths(lengths: { nez?: number; inter?: number; centre?: number }): void {
    if (!this.kiteEntity) return;

    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridle) return;

    // Mettre à jour les longueurs dans le BridleComponent
    if (lengths.nez !== undefined) bridle.lengths.nez = lengths.nez;
    if (lengths.inter !== undefined) bridle.lengths.inter = lengths.inter;
    if (lengths.centre !== undefined) bridle.lengths.centre = lengths.centre;

    // Log pour debug
    this.logger.info(
      `Bridle lengths updated: nez=${bridle.lengths.nez.toFixed(2)}m, ` +
      `inter=${bridle.lengths.inter.toFixed(2)}m, centre=${bridle.lengths.centre.toFixed(2)}m`,
      'PureBridleSystem'
    );

    // Les positions CTRL seront automatiquement recalculées par ControlPointSystem
    // lors de la prochaine frame via quadrilatération avec les nouvelles longueurs
  }

  /**
   * @deprecated Méthode legacy - utiliser setKiteEntity() à la place
   */
  setBridleEntities(_entities: {
    left: { nez: Entity; inter: Entity; centre: Entity };
    right: { nez: Entity; inter: Entity; centre: Entity };
  }): void {
    console.warn('PureBridleSystem.setBridleEntities() is deprecated - use setKiteEntity() instead');
  }
}
