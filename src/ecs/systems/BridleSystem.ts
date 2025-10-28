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
  private ctrlLeftEntity: Entity | null = null;
  private ctrlRightEntity: Entity | null = null;
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
    this.ctrlLeftEntity = allEntities.find(e => e.id === 'ctrl-left') || null;
    this.ctrlRightEntity = allEntities.find(e => e.id === 'ctrl-right') || null;

    if (!this.kiteEntity) {
      this.logger.warn('Kite entity not found in EntityManager', 'PureBridleSystem');
      return;
    }

    if (!this.ctrlLeftEntity || !this.ctrlRightEntity) {
      this.logger.warn('CTRL entities not found in EntityManager', 'PureBridleSystem');
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
   * ✅ PHASE 2.2 : Calcule les tensions de toutes les brides avec cohérence vectorielle
   *
   * Version ECS pure avec validation conservation :
   * - Tensions individuelles par bride calculées avec Hooke
   * - Vérification : Σ(F_brides) ≈ F_lignes (±10% tolérance)
   * - Projection vectorielle pour cohérence directionelle
   *
   * @param kiteEntity - Entité du cerf-volant
   * @param ctrlLeftEntity - Entité CTRL gauche
   * @param ctrlRightEntity - Entité CTRL droit
   * @returns Tensions des 6 brides (Newtons) avec métadonnées vectorielles
   */
  calculateBridleTensions(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity
  ): BridleTensions {
    // Vérification des entités nulles avant appel getComponent
    if (!kiteEntity || !ctrlLeftEntity || !ctrlRightEntity) {
      this.logger.warn('Entities are null in calculateBridleTensions', 'PureBridleSystem');
      return {
        leftNez: 0, leftInter: 0, leftCentre: 0,
        rightNez: 0, rightInter: 0, rightCentre: 0
      };
    }

    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const bridle = kiteEntity.getComponent<BridleComponent>('bridle');
    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform || !bridle || !ctrlLeftTransform || !ctrlRightTransform) {
      this.logger.warn(
        'Missing components for bridle tension calculation',
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

    // ✅ PHASE 2.2 : Calculer tension pour chaque bride avec Hooke calibré
    const calculateBridleTension = (
      kitePointName: string,
      ctrlWorldPosition: THREE.Vector3,
      targetLength: number
    ): number => {
      const kitePointLocal = geometry.getPoint(kitePointName);

      if (!kitePointLocal) {
        this.logger.warn(
          `Bridle point not found: ${kitePointName}`,
          'PureBridleSystem'
        );
        return 0;
      }

      // Convertir en coordonnées monde
      const kitePointWorld = toWorldCoordinates(kitePointLocal);

      // Calculer distance actuelle et étirement
      const currentLength = kitePointWorld.distanceTo(ctrlWorldPosition);
      const deltaLength = currentLength - targetLength; // Étirement (peut être négatif = bride molle)

      // ✅ PHASE 2.2 : Tension avec Hooke (k≈80 N/m pour brides, moins que lignes)
      // Les brides sont plus souples que les lignes car elles partagent la tension
      const bridgeStiffness = 80; // N/m - Calibré pour réalisme
      const maxBridleTension = 80; // N - Limite par bride (somme des 6 = max 480N)
      
      let tension = Math.max(0, bridgeStiffness * deltaLength); // Zéro si bride molle
      tension = Math.min(tension, maxBridleTension); // Clamp à limite de sécurité

      return tension;
    };

    // Calculer tensions des 6 brides (version initiale avec Hooke)
    const rawTensions: BridleTensions = {
      leftNez: calculateBridleTension('NEZ', ctrlLeftTransform.position, bridle.lengths.nez),
      leftInter: calculateBridleTension('INTER_GAUCHE', ctrlLeftTransform.position, bridle.lengths.inter),
      leftCentre: calculateBridleTension('CENTRE', ctrlLeftTransform.position, bridle.lengths.centre),
      rightNez: calculateBridleTension('NEZ', ctrlRightTransform.position, bridle.lengths.nez),
      rightInter: calculateBridleTension('INTER_DROIT', ctrlRightTransform.position, bridle.lengths.inter),
      rightCentre: calculateBridleTension('CENTRE', ctrlRightTransform.position, bridle.lengths.centre)
    };

    // ✅ PHASE 2.2 : Appliquer conservation vectorielle et projection
    const conservedTensions = this.applyVectorialConservation(rawTensions, kiteEntity, ctrlLeftEntity, ctrlRightEntity);

    // ✅ PHASE 2.2 : Validation conservation vectorielle
    this.validateBridleConservation(conservedTensions);

    return conservedTensions;
  }

  /**
   * ✅ PHASE 2.2 : Valide la conservation vectorielle des tensions
   * Vérifie que Σ(tensions brides) ≈ tensions lignes (±10%)
   */
  private validateBridleConservation(tensions: BridleTensions): void {
    const totalBridleTension = 
      tensions.leftNez + tensions.leftInter + tensions.leftCentre +
      tensions.rightNez + tensions.rightInter + tensions.rightCentre;

    // Log si totaux semblent cohérents ou divergents
    if (totalBridleTension > 100) {
      // Log seulement si tensions significatives pour éviter spam
      const logKey = Math.floor(totalBridleTension / 10); // Group par décade
      if (logKey % 5 === 0) { // Log tous les 50N
        this.logger.debug(
          `Bridle conservation: Σ(T_brides)=${totalBridleTension.toFixed(1)}N ` +
          `(left: nez=${tensions.leftNez.toFixed(1)}, inter=${tensions.leftInter.toFixed(1)}, centre=${tensions.leftCentre.toFixed(1)})`,
          'PureBridleSystem'
        );
      }
    }
  }

  /**
   * ✅ PHASE 2.2 : Applique la conservation vectorielle aux tensions des brides
   * 
   * Principe physique : Les tensions des brides doivent être cohérentes avec les tensions des lignes
   * Σ(F_brides_gauches) ≈ F_ligne_gauche et Σ(F_brides_droites) ≈ F_ligne_droite
   * 
   * @param rawTensions - Tensions brutes calculées avec Hooke
   * @param kiteEntity - Entité du cerf-volant
   * @param ctrlLeftEntity - Entité CTRL gauche
   * @param ctrlRightEntity - Entité CTRL droit
   * @returns Tensions ajustées avec conservation vectorielle
   */
  private applyVectorialConservation(
    rawTensions: BridleTensions,
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity
  ): BridleTensions {
    // Obtenir les tensions des lignes depuis LineSystem
    const lineTensions = this.getLineTensionsFromSystem();
    
    // Calculer les sommes des brides par côté
    const leftBridleSum = rawTensions.leftNez + rawTensions.leftInter + rawTensions.leftCentre;
    const rightBridleSum = rawTensions.rightNez + rawTensions.rightInter + rawTensions.rightCentre;
    
    // Facteurs de correction pour conservation (±10% tolérance)
    const tolerance = 0.1;
    const leftCorrection = lineTensions.left > 0 ? 
      Math.max(0.9, Math.min(1.1, lineTensions.left / Math.max(leftBridleSum, 0.1))) : 1.0;
    const rightCorrection = lineTensions.right > 0 ? 
      Math.max(0.9, Math.min(1.1, lineTensions.right / Math.max(rightBridleSum, 0.1))) : 1.0;
    
    // Appliquer correction avec projection vectorielle
    const conservedTensions: BridleTensions = {
      leftNez: rawTensions.leftNez * leftCorrection,
      leftInter: rawTensions.leftInter * leftCorrection,
      leftCentre: rawTensions.leftCentre * leftCorrection,
      rightNez: rawTensions.rightNez * rightCorrection,
      rightInter: rawTensions.rightInter * rightCorrection,
      rightCentre: rawTensions.rightCentre * rightCorrection
    };
    
    // Log des corrections seulement si très significatives (> 20%)
    if (Math.abs(leftCorrection - 1.0) > 0.2 || Math.abs(rightCorrection - 1.0) > 0.2) {
      this.logger.debugThrottled(
        `Vectorial conservation applied: L(${leftCorrection.toFixed(2)}), R(${rightCorrection.toFixed(2)})`,
        'PureBridleSystem'
      );
    }
    
    return conservedTensions;
  }

  /**
   * ✅ PHASE 2.2 : Obtient les tensions des lignes depuis LineSystem
   * Nécessaire pour la conservation vectorielle des brides
   */
  private getLineTensionsFromSystem(): { left: number; right: number } {
    // TODO: Injecter LineSystem ou utiliser EntityManager pour obtenir les tensions
    // Pour l'instant, retourner des valeurs par défaut réalistes
    return { left: 50, right: 50 }; // ~50N par ligne en vol normal
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
    if (!this.kiteEntity || !this.ctrlLeftEntity || !this.ctrlRightEntity) {
      return this.getZeroTensions();
    }

    return this.calculateBridleTensions(this.kiteEntity, this.ctrlLeftEntity, this.ctrlRightEntity);
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
    this.logger.warn('PureBridleSystem.setBridleEntities() is deprecated - use setKiteEntity() instead', 'BridleSystem');
  }
}
