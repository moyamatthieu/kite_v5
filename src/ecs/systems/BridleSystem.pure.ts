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
   * Modifie les longueurs des brides et recalcule les points de contrôle
   */
  setBridleLengths(lengths: { nez?: number; inter?: number; centre?: number }): void {
    if (!this.kiteEntity) return;

    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');
    const geometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
    if (!bridle || !geometry) return;

    // Mettre à jour les longueurs
    if (lengths.nez !== undefined) bridle.lengths.nez = lengths.nez;
    if (lengths.inter !== undefined) bridle.lengths.inter = lengths.inter;
    if (lengths.centre !== undefined) bridle.lengths.centre = lengths.centre;

    // Recalculer les points de contrôle par trilatération
    const nezPos = geometry.getPoint('NEZ');
    const centrePos = geometry.getPoint('CENTRE');
    const interDroitPos = geometry.getPoint('INTER_DROIT');
    
    if (nezPos && centrePos && interDroitPos) {
      // Importer dynamiquement KiteEntityFactory pour accéder à calculateControlPoint
      // Pour éviter les dépendances circulaires, on recalcule directement ici
      const ctrlDroit = this.calculateControlPointTrilateration(
        nezPos, 
        interDroitPos, 
        centrePos, 
        bridle.lengths
      );
      const ctrlGauche = new THREE.Vector3(-ctrlDroit.x, ctrlDroit.y, ctrlDroit.z);
      
      geometry.setPoint('CTRL_GAUCHE', ctrlGauche);
      geometry.setPoint('CTRL_DROIT', ctrlDroit);
      
      console.log('🎯 Points de contrôle recalculés après modification brides:', {
        longueurs: bridle.lengths,
        ctrlGauche: ctrlGauche.toArray(),
        ctrlDroit: ctrlDroit.toArray()
      });
    }
  }

  /**
   * Calcule le point de contrôle par trilatération 3D (copie de KiteEntityFactory)
   */
  private calculateControlPointTrilateration(
    nez: THREE.Vector3,
    inter: THREE.Vector3,
    centre: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number }
  ): THREE.Vector3 {
    const ex = inter.clone().sub(nez).normalize();
    const d = inter.distanceTo(nez);

    const centreToNez = centre.clone().sub(nez);
    const i = ex.dot(centreToNez);
    const eyTemp = centreToNez.clone().addScaledVector(ex, -i);
    const ey = eyTemp.normalize();

    const ez = new THREE.Vector3().crossVectors(ex, ey);
    if (ez.z < 0) ez.negate();

    const j = ey.dot(centreToNez);

    const r1 = bridleLengths.nez;
    const r2 = bridleLengths.inter;
    const r3 = bridleLengths.centre;

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    const zSquared = r1 * r1 - x * x - y * y;
    const z = zSquared < 0 ? 0 : Math.sqrt(zSquared);

    const result = new THREE.Vector3();
    result.copy(nez);
    result.addScaledVector(ex, x);
    result.addScaledVector(ey, y);
    result.addScaledVector(ez, z);

    return result;
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
