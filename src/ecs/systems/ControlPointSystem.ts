/**
 * ControlPointSystem.ts - Système pour résoudre la position des points de contrôle
 *
 * Résout la position des points CTRL_GAUCHE et CTRL_DROIT par quadrilatération,
 * puis applique les forces de bride sur le kite.
 *
 * Principe physique :
 * 1. Les points CTRL sont des particules libres dans l'espace
 * 2. Leur position est déterminée par 3 brides + 1 ligne (4 contraintes)
 * 3. Les brides tendues appliquent des forces sur le kite
 * 4. C'est un système émergent : l'équilibre vient de la physique, pas du script
 */
import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { EntityManager } from '@entities/EntityManager';
import { ControlPointComponent } from '@components/ControlPointComponent';
import { TransformComponent } from '@components/TransformComponent';
import { BridleComponent } from '@components/BridleComponent';
import { LineComponent } from '@components/LineComponent';
import { PureConstraintSolver } from './ConstraintSolver.pure';
import { Logger } from '@utils/Logging';

export class ControlPointSystem extends BaseSimulationSystem {
  private kiteEntity: Entity | null = null;
  private ctrlLeftEntity: Entity | null = null;
  private ctrlRightEntity: Entity | null = null;
  private leftLineEntity: Entity | null = null;
  private rightLineEntity: Entity | null = null;
  private leftHandlePosition: THREE.Vector3 = new THREE.Vector3();
  private rightHandlePosition: THREE.Vector3 = new THREE.Vector3();
  private logger = Logger.getInstance();
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager, order: number = 50) {
    super('ControlPointSystem', order);
    this.entityManager = entityManager;
  }

  /**
   * Configure les entités à gérer
   */
  setEntities(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    leftLineEntity: Entity,
    rightLineEntity: Entity
  ): void {
    this.kiteEntity = kiteEntity;
    this.ctrlLeftEntity = ctrlLeftEntity;
    this.ctrlRightEntity = ctrlRightEntity;
    this.leftLineEntity = leftLineEntity;
    this.rightLineEntity = rightLineEntity;
  }

  /**
   * Met à jour les positions des poignées (appelé depuis SimulationApp)
   */
  setHandlePositions(left: THREE.Vector3, right: THREE.Vector3): void {
    this.leftHandlePosition.copy(left);
    this.rightHandlePosition.copy(right);
  }

  initialize(): void {
    this.logger.info('ControlPointSystem initialized', 'ControlPointSystem');
  }

  update(context: SimulationContext): void {
    if (!this.kiteEntity || !this.ctrlLeftEntity || !this.ctrlRightEntity) {
      return;
    }

    if (!this.leftLineEntity || !this.rightLineEntity) {
      return;
    }

    // Récupérer les composants nécessaires
    const bridle = this.kiteEntity.getComponent<BridleComponent>('bridle');
    if (!bridle) return;

    // Résoudre position CTRL_GAUCHE
    this.resolveControlPoint(
      this.ctrlLeftEntity,
      this.leftLineEntity,
      this.leftHandlePosition,
      bridle.lengths,
      {
        nez: 'NEZ',
        inter: 'INTER_GAUCHE',
        centre: 'CENTRE'
      }
    );

    // Résoudre position CTRL_DROIT
    this.resolveControlPoint(
      this.ctrlRightEntity,
      this.rightLineEntity,
      this.rightHandlePosition,
      bridle.lengths,
      {
        nez: 'NEZ',
        inter: 'INTER_DROIT',
        centre: 'CENTRE'
      }
    );
  }

  /**
   * Résout la position d'un point de contrôle et applique les forces de bride
   */
  private resolveControlPoint(
    ctrlEntity: Entity,
    lineEntity: Entity,
    handlePosition: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number },
    attachments: { nez: string; inter: string; centre: string }
  ): void {
    if (!this.kiteEntity) return;

    const ctrlComponent = ctrlEntity.getComponent<ControlPointComponent>('controlPoint');
    const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
    const lineComponent = lineEntity.getComponent<LineComponent>('line');

    if (!ctrlComponent || !ctrlTransform || !lineComponent) {
      return;
    }

    // Longueur de la ligne
    const lineLength = lineComponent.config.length;

    // Résoudre position CTRL par quadrilatération (3 brides + 1 ligne)
    const resolvedPosition = PureConstraintSolver.solveControlPointPosition(
      this.kiteEntity,
      handlePosition,
      bridleLengths,
      lineLength,
      attachments
    );

    // Mettre à jour la position du point CTRL
    ctrlComponent.updatePosition(resolvedPosition);
    ctrlTransform.position.copy(resolvedPosition);

    // Appliquer les forces de bride sur le kite
    PureConstraintSolver.applyBridleForces(
      this.kiteEntity,
      resolvedPosition,
      bridleLengths,
      attachments
    );
  }

  reset(): void {
    this.logger.info('ControlPointSystem reset', 'ControlPointSystem');
  }

  dispose(): void {
    this.kiteEntity = null;
    this.ctrlLeftEntity = null;
    this.ctrlRightEntity = null;
    this.leftLineEntity = null;
    this.rightLineEntity = null;
  }
}
