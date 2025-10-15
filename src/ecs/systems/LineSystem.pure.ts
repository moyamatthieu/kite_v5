/**
 * LineSystem.pure.ts - Système ECS pur pour gérer les lignes de cerf-volant
 *
 * Architecture ECS 100% pure :
 *   - Hérite de BaseSimulationSystem
 *   - Travaille avec EntityManager pour query les entités
 *   - Utilise uniquement Entity + Components (pas de classes OO)
 *
 * Rôle :
 *   - Calcule les tensions des lignes pour affichage/debug
 *   - Met à jour les LineComponent.state
 *   - Les contraintes de distance sont gérées par PureConstraintSolver
 */

import * as THREE from "three";
import { BaseSimulationSystem, SimulationContext } from "@base/BaseSimulationSystem";
import { Entity } from "@base/Entity";
import { EntityManager } from "@entities/EntityManager";
import { LineComponent } from "@components/LineComponent";
import { GeometryComponent } from "@components/GeometryComponent";
import { TransformComponent } from '@components/TransformComponent';
import { HandlePositions } from '@mytypes/PhysicsTypes';
import { CONFIG } from '@config/SimulationConfig';
import { Logger } from '@utils/Logging';

/**
 * Système ECS pur pour les lignes de contrôle
 */
export class PureLineSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;
  private leftLineEntity: Entity | null = null;
  private rightLineEntity: Entity | null = null;
  private ctrlLeftEntity: Entity | null = null;
  private ctrlRightEntity: Entity | null = null;
  private logger = Logger.getInstance();

  constructor(entityManager: EntityManager) {
    super('PureLineSystem', 50); // Priorité 50 (après physique, avant rendu)
    this.entityManager = entityManager;
  }

  /**
   * Configure les entités de points de contrôle
   */
  setControlPointEntities(ctrlLeft: Entity, ctrlRight: Entity): void {
    this.ctrlLeftEntity = ctrlLeft;
    this.ctrlRightEntity = ctrlRight;
    this.logger.info('Control point entities configured', 'PureLineSystem');
  }

  /**
   * Initialise le système
   */
  initialize(): void {
    // Trouver les entités de lignes via EntityManager
    const allEntities = this.entityManager.getAllEntities();

    this.leftLineEntity = allEntities.find(e => e.id === 'leftLine') || null;
    this.rightLineEntity = allEntities.find(e => e.id === 'rightLine') || null;

    if (!this.leftLineEntity || !this.rightLineEntity) {
      this.logger.warn('Line entities not found in EntityManager', 'PureLineSystem');
    } else {
      this.logger.info(`Line entities found: ${this.leftLineEntity.id}, ${this.rightLineEntity.id}`, 'PureLineSystem');
    }
  }

  /**
   * Met à jour le système (appelé chaque frame)
   */
  update(_context: SimulationContext): void {
    if (!this.enabled) return;

    // Pour l'instant, le système est passif
    // Les tensions sont calculées à la demande via calculateLineTensions()
    // TODO: Implémenter update actif si nécessaire
  }

  /**
   * Réinitialise le système
   */
  reset(): void {
    // Réinitialiser les états des lignes
    this.resetLineState(this.leftLineEntity);
    this.resetLineState(this.rightLineEntity);
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.leftLineEntity = null;
    this.rightLineEntity = null;
  }

  /**
   * Configure les entités de lignes manuellement
   */
  setLineEntities(leftLine: Entity, rightLine: Entity): void {
    this.leftLineEntity = leftLine;
    this.rightLineEntity = rightLine;
  }

  /**
   * Calcule les tensions des lignes
   * 
   * @param kiteEntity - Entité du cerf-volant
   * @param handles - Positions des poignées (barre de contrôle)
   * @param deltaTime - Temps écoulé depuis la dernière frame
   * @returns Forces appliquées et couple résultant
   */
  calculateLineTensions(
    kiteEntity: Entity,
    handles: HandlePositions,
    deltaTime: number
  ): {
    leftForce: THREE.Vector3;
    rightForce: THREE.Vector3;
    torque: THREE.Vector3;
  } {
    if (!this.leftLineEntity || !this.rightLineEntity) {
      this.logger.warn('Line entities not configured', 'PureLineSystem');
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3()
      };
    }

    if (!this.ctrlLeftEntity || !this.ctrlRightEntity) {
      this.logger.warn('Control point entities not configured', 'PureLineSystem');
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3()
      };
    }

    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!kiteTransform) {
      this.logger.warn(
        'Kite entity missing transform component',
        'PureLineSystem'
      );
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3()
      };
    }

    // Récupérer les positions des points CTRL depuis leurs entités
    const ctrlLeftTransform = this.ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = this.ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!ctrlLeftTransform || !ctrlRightTransform) {
      this.logger.warn('Control point transforms not found', 'PureLineSystem');
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3()
      };
    }

    // Positions monde des points CTRL (directement depuis leurs transforms)
    const ctrlLeftWorld = ctrlLeftTransform.position.clone();
    const ctrlRightWorld = ctrlRightTransform.position.clone();

    // Calculer les forces pour chaque ligne
    const leftForce = this.calculateLineForce(
      ctrlLeftWorld,
      handles.left,
      this.leftLineEntity,
      deltaTime
    );

    const rightForce = this.calculateLineForce(
      ctrlRightWorld,
      handles.right,
      this.rightLineEntity,
      deltaTime
    );

    // Calculer le torque (moment de force)
    const kitePosition = kiteTransform.position;
    const torque = new THREE.Vector3();

    // Torque gauche
    const rLeft = ctrlLeftWorld.clone().sub(kitePosition);
    const torqueLeft = new THREE.Vector3().crossVectors(rLeft, leftForce);

    // Torque droit
    const rRight = ctrlRightWorld.clone().sub(kitePosition);
    const torqueRight = new THREE.Vector3().crossVectors(rRight, rightForce);

    torque.add(torqueLeft).add(torqueRight);

    return { leftForce, rightForce, torque };
  }

  /**
   * Calcule la force d'une ligne individuelle
   * 
   * Modèle physique :
   * - Tension = k * strain + c * strainRate + preTension
   * - strain = (currentLength - restLength) / restLength
   * - strainRate = d(strain)/dt
   */
  private calculateLineForce(
    kitePoint: THREE.Vector3,
    handlePoint: THREE.Vector3,
    lineEntity: Entity,
    deltaTime: number
  ): THREE.Vector3 {
    const lineComponent = lineEntity.getComponent<LineComponent>('line');
    if (!lineComponent) {
      this.logger.warn(
        `Line entity ${lineEntity.id} missing line component`,
        'PureLineSystem'
      );
      return new THREE.Vector3();
    }

    // Calculer la distance actuelle
    const currentLength = kitePoint.distanceTo(handlePoint);
    const restLength = lineComponent.config.length;

    // Calculer la déformation (strain)
    const strain = (currentLength - restLength) / restLength;
    const strainRate =
      (strain - lineComponent.state.strain) / Math.max(deltaTime, 0.001);

    // Mettre à jour l'état de la ligne
    lineComponent.state.strain = strain;
    lineComponent.state.strainRate = strainRate;

    // Calculer la tension (loi de Hooke avec amortissement)
    const elasticForce = lineComponent.config.stiffness * strain;
    const dampingForce = lineComponent.config.dampingCoeff * strainRate;
    const tension = Math.max(0, elasticForce + dampingForce + lineComponent.config.preTension);

    lineComponent.state.currentTension = tension;

    // Calculer la force appliquée (direction du kite vers la poignée)
    const direction = new THREE.Vector3()
      .subVectors(handlePoint, kitePoint)
      .normalize();

    const force = direction.multiplyScalar(tension);
    lineComponent.state.appliedForce.copy(force);

    return force;
  }

  /**
   * Réinitialise l'état d'une ligne
   */
  private resetLineState(lineEntity: Entity | null): void {
    if (!lineEntity) return;

    const lineComponent = lineEntity.getComponent<LineComponent>('line');
    if (!lineComponent) return;

    lineComponent.state.strain = 0;
    lineComponent.state.strainRate = 0;
    lineComponent.state.currentTension = lineComponent.config.preTension;
    lineComponent.state.appliedForce.set(0, 0, 0);
  }

  /**
   * Obtient les tensions actuelles des lignes
   */
  getLineTensions(): { left: number; right: number } {
    const leftTension = this.leftLineEntity
      ?.getComponent<LineComponent>('line')
      ?.state.currentTension || 0;
    const rightTension = this.rightLineEntity
      ?.getComponent<LineComponent>('line')
      ?.state.currentTension || 0;

    return { left: leftTension, right: rightTension };
  }

  /**
   * Alias pour compatibilité avec legacy code
   */
  getTensions(): { left: number; right: number } {
    return this.getLineTensions();
  }

  /**
   * Obtient les distances actuelles des lignes
   */
  getLineDistances(kiteEntity: Entity, handles: HandlePositions): { left: number; right: number } {
    if (!this.ctrlLeftEntity || !this.ctrlRightEntity) {
      return { left: 0, right: 0 };
    }

    const ctrlLeftTransform = this.ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = this.ctrlRightEntity.getComponent<TransformComponent>('transform');

    if (!ctrlLeftTransform || !ctrlRightTransform) {
      return { left: 0, right: 0 };
    }

    // Positions monde des points CTRL (directement depuis leurs transforms)
    const ctrlLeftWorld = ctrlLeftTransform.position.clone();
    const ctrlRightWorld = ctrlRightTransform.position.clone();

    return {
      left: ctrlLeftWorld.distanceTo(handles.left),
      right: ctrlRightWorld.distanceTo(handles.right)
    };
  }

  /**
   * Alias pour compatibilité avec legacy code
   */
  getDistances(kiteEntity: Entity, handles: HandlePositions): { left: number; right: number } {
    return this.getLineDistances(kiteEntity, handles);
  }

  /**
   * Vérifie si les lignes sont tendues
   */
  getLineStates(kiteEntity: Entity, handles: HandlePositions): { leftTaut: boolean; rightTaut: boolean } {
    const distances = this.getLineDistances(kiteEntity, handles);
    const restLength = CONFIG.lines.defaultLength;

    return {
      leftTaut: distances.left >= restLength,
      rightTaut: distances.right >= restLength
    };
  }

  /**
   * Modifie la longueur des lignes
   */
  setLineLength(length: number): void {
    console.log('🔧 LineSystem.setLineLength called with:', length);
    
    if (this.leftLineEntity) {
      const leftLine = this.leftLineEntity.getComponent<LineComponent>('line');
      if (leftLine) {
        console.log('  📏 Old left line length:', leftLine.config.length);
        leftLine.config.length = length;
        console.log('  ✅ New left line length:', leftLine.config.length);
      } else {
        console.warn('  ⚠️ Left line component not found!');
      }
    } else {
      console.warn('  ⚠️ leftLineEntity not assigned!');
    }

    if (this.rightLineEntity) {
      const rightLine = this.rightLineEntity.getComponent<LineComponent>('line');
      if (rightLine) {
        console.log('  📏 Old right line length:', rightLine.config.length);
        rightLine.config.length = length;
        console.log('  ✅ New right line length:', rightLine.config.length);
      } else {
        console.warn('  ⚠️ Right line component not found!');
      }
    } else {
      console.warn('  ⚠️ rightLineEntity not assigned!');
    }
  }
}
