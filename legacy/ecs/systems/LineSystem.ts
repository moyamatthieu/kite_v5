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
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { HandlePositions } from '@mytypes/PhysicsTypes';
import { CONFIG } from '@config/SimulationConfig';
import { Logger } from '@utils/Logging';

import { PureConstraintSolver } from './ConstraintSolver';
import { ConstraintSolverPBD } from './ConstraintSolverPBD';

/**
 * Interface pour les forces calculées par le système de lignes
 */
interface LineForces {
  leftForce: THREE.Vector3;
  rightForce: THREE.Vector3;
  torque: THREE.Vector3;
}

/**
 * Système ECS pur pour les lignes de contrôle
 */
export class PureLineSystem extends BaseSimulationSystem {
  private entityManager: EntityManager;
  private leftLineEntity: Entity | null = null;
  private rightLineEntity: Entity | null = null;
  // ✅ SUPPRIMÉ: ctrlLeftEntity et ctrlRightEntity (maintenant points locaux du kite)
  private logger = Logger.getInstance();

  // ✅ PHASE 2.1 : Tracking des tensions pour logging
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL_MS: number = 1000; // Log toutes les 1s
  private lastLeftTension: number = 0;
  private lastRightTension: number = 0;

  // Constantes calibration Hooke
  private readonly LINE_STIFFNESS_DEFAULT: number = 500; // N/m - Calibré pour réalisme
  private readonly LINE_MAX_TENSION: number = 200; // N - Limite sécurité

  constructor(entityManager: EntityManager) {
    super('PureLineSystem', 50); // Priorité 50 (après physique, avant rendu)
    this.entityManager = entityManager;
  }

  /**
   * ✅ SUPPRIMÉ: setControlPointEntities()
   * Les CTRL sont maintenant des points locaux du kite (geometry.getPointWorld())
   */

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
   * ✅ PHASE 2.1 : Met à jour le système avec logging des tensions
   */
  update(context: SimulationContext): void {
    if (!this.enabled) return;

    // Log toutes les 1s
    const now = Date.now();
    if (now - this.lastLogTime >= this.LOG_INTERVAL_MS) {
      this.logTensionMetrics();
      this.lastLogTime = now;
    }
  }

  /**
   * ✅ PHASE 2.1 : Log les métriques de tension et asymétrie
   */
  private logTensionMetrics(): void {
    const tensions = this.getLineTensions();
    const asymmetry = this.calculateAsymmetry(tensions.left, tensions.right);

    this.logger.info(
      `Line tensions: L=${tensions.left.toFixed(1)}N, R=${tensions.right.toFixed(1)}N, asymmetry=${asymmetry.toFixed(1)}%`,
      'PureLineSystem'
    );

    this.lastLeftTension = tensions.left;
    this.lastRightTension = tensions.right;
  }

  /**
   * ✅ PHASE 2.1 : Calcule l'asymétrie des tensions (utile pour debug virage)
   * @returns Asymétrie en % (0 = équilibré, 100 = complètement asymétrique)
   */
  private calculateAsymmetry(left: number, right: number): number {
    const total = Math.max(left + right, 0.001);
    const diff = Math.abs(left - right);
    return (diff / total) * 100;
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
   * ✅ OBSOLÈTE: calculateForces() - N'est plus utilisée
   * Les contraintes sont gérées par ConstraintSolverPBD
   * Cette méthode est conservée pour référence historique
   * 
   * @deprecated Utiliser ConstraintSolverPBD.solveConstraintsGlobal() à la place
   */
  calculateForces(kiteEntity: Entity, handles: HandlePositions, deltaTime: number): LineForces {
    // ✅ Désactivé: Les CTRL ne sont plus des entités séparées
    // Cette méthode est obsolète, remplacée par ConstraintSolverPBD
    return {
      leftForce: new THREE.Vector3(),
      rightForce: new THREE.Vector3(),
      torque: new THREE.Vector3()
    };

    /*
    // CODE OBSOLÈTE - Conservé pour référence
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

    // Vérification finale : s'assurer que les entités sont toujours valides
    if (!this.ctrlLeftEntity || !this.ctrlRightEntity) {
      this.logger.warn('Control point entities became null during calculation', 'PureLineSystem');
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

    // Calculer les forces pour chaque ligne (avec vérifications null)
    const leftForce = this.leftLineEntity ? this.calculateLineForce(
      ctrlLeftWorld,
      handles.left,
      this.leftLineEntity,
      deltaTime
    ) : new THREE.Vector3();

    const rightForce = this.rightLineEntity ? this.calculateLineForce(
      ctrlRightWorld,
      handles.right,
      this.rightLineEntity,
      deltaTime
    ) : new THREE.Vector3();

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
    */
  }

  /**
   * ✅ PHASE 2.1 : Calcule la force d'une ligne individuelle avec Hooke calibré
   * 
   * Modèle physique :
   * - Tension = k * Δx + c * dΔx/dt (loi de Hooke avec amortissement)
   * - k ≈ 500 N/m (calibré pour réalisme)
   * - Δx = currentLength - restLength (étirement)
   * - Limité à LINE_MAX_TENSION (200N) pour sécurité
   * 
   * IMPORTANT : Les lignes RÉELLES sont inextensibles (Dyneema).
   * Ce modèle approche le comportement élastique du système entier.
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

    // Calculer la distance actuelle et l'étirement
    const currentLength = kitePoint.distanceTo(handlePoint);
    const restLength = lineComponent.config.length;
    const deltaLength = currentLength - restLength; // Étirement (peut être négatif = ligne molle)

    // ✅ PHASE 2.1 : Tension avec Hooke calibré (k ≈ 500 N/m)
    // T = k * Δx (si ligne tendue, sinon T = 0)
    const stiffness = this.LINE_STIFFNESS_DEFAULT; // 500 N/m
    const elasticForce = Math.max(0, stiffness * deltaLength); // Zéro si ligne molle

    // Tension totale = force élastique (pas d'amortissement ni prétension)
    let tension = elasticForce;
    tension = Math.max(0, Math.min(tension, this.LINE_MAX_TENSION)); // Clamp [0, MAX_TENSION]

    // Mettre à jour l'état pour frame suivante
    const strain = deltaLength / Math.max(restLength, 0.001);
    lineComponent.state.strain = strain;
    lineComponent.state.strainRate = 0; // Simplifié
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
    lineComponent.state.currentTension = 0; // Plus de prétension
    lineComponent.state.appliedForce.set(0, 0, 0);
  }

  /**
   * ✅ PHASE 2.1 : Obtient les tensions actuelles des lignes avec loi de Hooke
   * Utilise ConstraintSolver.calculateLineTensions() pour calcul physique réaliste
   */
  getLineTensions(): { left: number; right: number } {
    // ✅ NOUVEAU: Les CTRL sont maintenant des points locaux du kite
    // Utiliser ConstraintSolverPBD.calculateLineTensions() qui accède aux CTRL via geometry.getPoint()
    const kiteEntity = this.entityManager.getEntity('kite');
    if (!kiteEntity) {
      return { left: 0, right: 0 };
    }

    // Positions des poignées (barre de contrôle)
    const handlePositions: HandlePositions = {
      left: new THREE.Vector3(0, 0, 0), // TODO: Récupérer depuis ControlBarSystem
      right: new THREE.Vector3(0, 0, 0)
    };

    // Force aérodynamique (pour calcul réaliste des tensions)
    const physics = kiteEntity.getComponent<PhysicsComponent>('physics');
    const aeroForce = physics ? new THREE.Vector3(0, 0, 50) : new THREE.Vector3(); // Force exemple

    // Utiliser ConstraintSolverPBD qui gère les CTRL comme points locaux
    const tensions = ConstraintSolverPBD.calculateLineTensions(
      kiteEntity,
      handlePositions,
      aeroForce,
      CONFIG.lines.defaultLength
    );

    return { left: tensions.left, right: tensions.right };
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
    // Accès aux points CTRL via la géométrie du kite
    const geometry = kiteEntity.getComponent<any>('geometry');
    if (!geometry) {
      this.logger.warn('Kite entity missing geometry component', 'PureLineSystem');
      return { left: 0, right: 0 };
    }
    const ctrlLeftWorld = geometry.getPointWorld ? geometry.getPointWorld('CTRL_GAUCHE', kiteEntity) : undefined;
    const ctrlRightWorld = geometry.getPointWorld ? geometry.getPointWorld('CTRL_DROIT', kiteEntity) : undefined;
    if (!ctrlLeftWorld || !ctrlRightWorld || !handles.left || !handles.right) {
      this.logger.warn('CTRL points or handles undefined in getLineDistances', 'PureLineSystem');
      return { left: 0, right: 0 };
    }
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
    this.logger.debug(`LineSystem.setLineLength called with: ${length}`, 'LineSystem');
    
    if (this.leftLineEntity) {
      const leftLine = this.leftLineEntity.getComponent<LineComponent>('line');
      if (leftLine) {
        this.logger.debug(`Old left line length: ${leftLine.config.length}`, 'LineSystem');
        leftLine.config.length = length;
        this.logger.debug(`New left line length: ${leftLine.config.length}`, 'LineSystem');
      } else {
        this.logger.warn('Left line component not found!', 'LineSystem');
      }
    } else {
      this.logger.warn('leftLineEntity not assigned!', 'LineSystem');
    }

    if (this.rightLineEntity) {
      const rightLine = this.rightLineEntity.getComponent<LineComponent>('line');
      if (rightLine) {
        this.logger.debug(`Old right line length: ${rightLine.config.length}`, 'LineSystem');
        rightLine.config.length = length;
        this.logger.debug(`New right line length: ${rightLine.config.length}`, 'LineSystem');
      } else {
        this.logger.warn('Right line component not found!', 'LineSystem');
      }
    } else {
      this.logger.warn('rightLineEntity not assigned!', 'LineSystem');
    }
  }
}
