/**
 * BridleSystem.ts - Orchestrateur du système de bridage du cerf-volant
 *
 * Architecture ECS pure : travaille avec des entités ayant LineComponent
 * au lieu d'objets Line OO.
 *
 * Rôle :
 *   - Coordonne les 6 brides (3 gauches + 3 droites)
 *   - Calcule les tensions pour affichage/debug (pas de forces appliquées)
 *   - Les contraintes de distance sont gérées par ConstraintSolver
 *
 * IMPORTANT : Les brides sont des CONTRAINTES, pas des ressorts !
 *   - Elles RETIENNENT les points d'attache (distance max)
 *   - Elles ne TIRENT PAS les points les uns vers les autres
 *   - Le ConstraintSolver.enforceBridleConstraints() gère la contrainte géométrique
 */

import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { LineComponent, LineConfig, LineAttachments, LineState } from '@components/LineComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { TransformComponent } from '@components/TransformComponent';
import { BridleComponent } from '@components/BridleComponent';
import { PhysicsConstants } from '../config/PhysicsConstants';
import { BridleLengths, BridleTensions } from '../types/BridleTypes';
import { LinePhysics } from './LinePhysics';
import { VelocityCalculator } from './VelocityCalculator';

/**
 * Système de gestion des brides
 *
 * Version ECS pure : travaille directement avec BridleComponent
 * au lieu d'entités de brides séparées.
 */
export class BridleSystem {
  // Entité kite (contient BridleComponent)
  private kiteEntity: Entity | null = null;

  // Services de calcul physique (réutilisés)
  private physics: LinePhysics;
  private velocityCalculator: VelocityCalculator;

  constructor(bridleLengths: BridleLengths) {
    // Services de calcul physique
    this.physics = new LinePhysics();
    this.velocityCalculator = new VelocityCalculator();

    // L'entité kite sera configurée via setKiteEntity()
  }

  /**
   * Configure l'entité kite (qui contient BridleComponent)
   */
  setKiteEntity(kiteEntity: Entity): void {
    const bridleComponent = kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridleComponent) {
      throw new Error('KiteEntity must have BridleComponent');
    }
    this.kiteEntity = kiteEntity;
  }

  /**
   * @deprecated Méthode legacy - utiliser setKiteEntity() à la place
   */
  setBridleEntities(_entities: {
    left: { nez: Entity; inter: Entity; centre: Entity };
    right: { nez: Entity; inter: Entity; centre: Entity };
  }): void {
    // Méthode dépréciée - ne fait rien
    console.warn('BridleSystem.setBridleEntities() is deprecated - use setKiteEntity() instead');
  }

  /**
   * Calcule les tensions de toutes les brides
   *
   * Version ECS pure simplifiée : retourne des valeurs symboliques
   * TODO: Implémenter le calcul physique réel avec GeometryComponent
   *
   * @param kiteEntity - Entité du cerf-volant
   * @returns Tensions des 6 brides (Newtons)
   */
  calculateBridleTensions(_kiteEntity: Entity): BridleTensions {
    // TODO: Calculer les tensions réelles basées sur la géométrie et la physique
    // Pour l'instant, retourner des valeurs symboliques
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
   * @deprecated Calcule la tension d'une bride individuelle - version legacy
   */
  private calculateSingleBridleTension(
    kiteEntity: Entity,
    bridleEntity: Entity,
    startPointName: string,
    endPointName: string,
    deltaTime: number
  ): number {
    // Récupérer le composant géométrie du kite
    const kiteGeometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    if (!kiteGeometry) {
      return 0;
    }

    // Récupérer positions locales depuis GeometryComponent
    const startLocal = kiteGeometry.points.get(startPointName);
    const endLocal = kiteGeometry.points.get(endPointName);

    if (!startLocal || !endLocal) {
      // Points bride introuvables - gestion silencieuse
      return 0;
    }

    // Convertir en coordonnées monde (simplifié pour l'instant)
    const startWorld = startLocal.clone();
    const endWorld = endLocal.clone();

    // Calculer vélocité relative avec VelocityCalculator
    const key = `${startPointName}_${endPointName}`;
    const velocity = this.velocityCalculator.calculateRelative(
      `${key}_start`,
      `${key}_end`,
      startWorld,
      endWorld,
      deltaTime
    );

    // Récupérer le composant LineComponent de la bride
    const lineComponent = bridleEntity.getComponent<LineComponent>('line');
    if (!lineComponent) {
      return 0;
    }

    // Calculer tension via LinePhysics (adapter pour utiliser les composants)
    // Pour l'instant, approximation simplifiée
    const distance = startWorld.distanceTo(endWorld);
    const strain = Math.max(0, (distance - lineComponent.config.length) / lineComponent.config.length);
    const tension = Math.max(lineComponent.config.preTension, strain * lineComponent.config.stiffness);

    // Mettre à jour l'état de la bride
    lineComponent.updateState(
      tension,
      strain,
      new THREE.Vector3(0, 0, 0), // Force appliquée (simplifiée)
      0 // strainRate (simplifiée)
    );

    return tension;
  }

  /**
   * Met à jour les longueurs des brides
   *
   * @param newLengths - Nouvelles longueurs (partial update)
   * @deprecated Utilisez PhysicsEngine.setBridleLength() à la place
   */
  setBridleLengths(_newLengths: Partial<BridleLengths>): void {
    // Note: Les instances Line sont immuables. Pour changer les longueurs,
    // il faut recréer BridleSystem avec les nouvelles longueurs.
    // Cette méthode est dépréciée - utilisez PhysicsEngine.setBridleLength()
    // Gestion silencieuse - méthode dépréciée
  }

  /**
   * Obtient les longueurs actuelles des brides depuis BridleComponent
   */
  getBridleLengths(): BridleLengths {
    if (!this.kiteEntity) {
      throw new Error("Kite entity not configured");
    }

    const bridleComponent = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridleComponent) {
      throw new Error("BridleComponent not found on kite entity");
    }

    return { ...bridleComponent.lengths };
  }

  /**
   * Obtient toutes les entités des brides
   * (utile pour ConstraintSolver)
   *
   * @deprecated Retourne toutes les brides - version legacy non utilisée
   */
  getAllBridles(): {
    left: { nez: Entity; inter: Entity; centre: Entity };
    right: { nez: Entity; inter: Entity; centre: Entity };
  } {
    throw new Error("getAllBridles() is deprecated - use BridleComponent instead");
  }

  /**
   * @deprecated Vérifie si une bride est tendue - version legacy non utilisée
   */
  isBridleTaut(_side: 'left' | 'right', _position: 'nez' | 'inter' | 'centre'): boolean {
    // TODO: Implémenter avec BridleComponent
    return false;
  }

  /**
   * Obtient des statistiques sur l'état des brides
   * (utile pour debug/monitoring)
   */
  /**
   * Retourne les statistiques des brides
   * Version ECS pure simplifiée - retourne des valeurs symboliques
   */
  getStats(): {
    tautCount: number;
    avgTension: number;
    maxTension: number;
    minTension: number;
  } {
    // TODO: Implémenter avec calculs réels
    return { tautCount: 0, avgTension: 0, maxTension: 0, minTension: 0 };
  }
}
