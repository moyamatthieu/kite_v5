/**
 * ConstraintSolverPBD.ts - Solveur de contraintes Position-Based Dynamics COMPLET
 *
 * ARCHITECTURE COUPLÉE (inspirée branche main + Makani) :
 *   - CTRL_GAUCHE/CTRL_DROIT sont des POINTS LOCAUX du kite (pas des entités séparées)
 *   - Contraintes lignes → correction POSITION + ROTATION du kite entier
 *   - PBD complet : position, rotation, vélocité, vélocité angulaire
 *   - Convergence itérative (2 passes minimum)
 *
 * DIFFÉRENCE AVEC ANCIEN SYSTÈME :
 *   Ancien : CTRL = entités séparées, figées sur sphère ligne → kite découplé
 *   Nouveau : CTRL = points du kite, contraintes couplées → vol réaliste
 *
 * RÉFÉRENCE : ANALYSIS_CTRL_POINTS.md §  "Solution : Revenir au Modèle Couplé"
 */
import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { GeometryComponent } from '@components/GeometryComponent';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { HandlePositions } from '@mytypes/PhysicsTypes';
import { Logger } from '@utils/Logging';
import { BridleLengths } from '../types/BridleTypes';
import { PhysicsConstants } from '../config/PhysicsConstants';
import { CONFIG } from '../config/SimulationConfig';

export class ConstraintSolverPBD {
  private static readonly PBD_ITERATIONS = 2; // Convergence
  private static readonly LINE_DAMPING = 0.5; // Amortissement radial

  /**
   * Résout toutes les contraintes (lignes + brides + sol)
   *
   * Ordre d'application (inspiré Makani) :
   * 1. Lignes (contrainte RIGIDE sur CTRL)
   * 2. Brides (contrainte SOUPLE sur points d'attache)
   * 3. Sol (collision)
   */
  static solveConstraintsGlobal(
    kiteEntity: Entity,
    handles: HandlePositions,
    bridleLengths: BridleLengths,
    newKitePosition: THREE.Vector3,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    lineLength: number = CONFIG.lines.defaultLength
  ): void {
    // 1. Contraintes lignes avec PBD complet (position + rotation)
    this.solveLineConstraintsPBD(
      kiteEntity,
      handles,
      newKitePosition,
      kiteState,
      lineLength
    );

    // 2. Contraintes brides (après lignes)
    this.applyBridleCorrections(
      kiteEntity,
      handles,
      newKitePosition,
      bridleLengths
    );

    // 3. Sol en dernier
    this.handleGroundCollision(kiteEntity, newKitePosition, kiteState.velocity);
  }

  /**
   * Résout les contraintes de lignes avec PBD complet
   *
   * Pour chaque ligne (CTRL → Handle) :
   *   - Calcule violation C = |CTRL_world - Handle| - lineLength
   *   - Calcule correction Δp (position) et Δq (rotation)
   *   - Applique correction au kite (pas aux CTRL qui sont des points locaux)
   *   - Amortit vélocité radiale
   *
   * FORMULES PBD :
   *   C = |CTRL_world - Handle| - lineLength
   *   λ = C / (m^(-1) + (r × n)^2 * I^(-1))
   *   Δp = -m^(-1) * λ * n
   *   Δθ = -I^(-1) * λ * (r × n)
   */
  private static solveLineConstraintsPBD(
    kiteEntity: Entity,
    handles: HandlePositions,
    newKitePosition: THREE.Vector3,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    lineLength: number
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const physics = kiteEntity.getComponent<PhysicsComponent>('physics');

    if (!geometry || !transform || !physics) return;

    const ctrlLeftLocal = geometry.getPoint('CTRL_GAUCHE');
    const ctrlRightLocal = geometry.getPoint('CTRL_DROIT');

    if (!ctrlLeftLocal || !ctrlRightLocal) {
      Logger.getInstance().error(
        'Points CTRL_GAUCHE/CTRL_DROIT non trouvés dans géométrie',
        'ConstraintSolverPBD'
      );
      return;
    }

    // Masse et inertie
    const invMass = physics.mass > 0 ? 1 / physics.mass : 0;
    const invInertia = physics.inertia > 0 ? 1 / physics.inertia : 0;

    // Résolution itérative (convergence)
    for (let iter = 0; iter < this.PBD_ITERATIONS; iter++) {
      // Contrainte ligne gauche
      this.solveSingleLineConstraint(
        ctrlLeftLocal,
        handles.left,
        newKitePosition,
        transform,
        kiteState,
        invMass,
        invInertia,
        lineLength,
        'GAUCHE'
      );

      // Contrainte ligne droite
      this.solveSingleLineConstraint(
        ctrlRightLocal,
        handles.right,
        newKitePosition,
        transform,
        kiteState,
        invMass,
        invInertia,
        lineLength,
        'DROITE'
      );
    }
  }

  /**
   * Résout une contrainte de ligne individuelle
   *
   * @param ctrlLocal Point de contrôle en coordonnées locales
   * @param handle Position du handle (fixe)
   * @param newPosition Position prédite du kite (à corriger)
   * @param transform Transform du kite (rotation à corriger)
   * @param state Vélocités du kite (à amortir)
   * @param invMass Inverse de la masse
   * @param invInertia Inverse de l'inertie
   * @param lineLength Longueur de ligne au repos
   * @param side Pour debug
   */
  private static solveSingleLineConstraint(
    ctrlLocal: THREE.Vector3,
    handle: THREE.Vector3,
    newPosition: THREE.Vector3,
    transform: TransformComponent,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    invMass: number,
    invInertia: number,
    lineLength: number,
    side: string
  ): void {
    // 1. Convertir CTRL local → monde
    const ctrlWorld = ctrlLocal
      .clone()
      .applyQuaternion(transform.quaternion)
      .add(newPosition);

    // 2. Calculer violation contrainte
    const diff = ctrlWorld.clone().sub(handle);
    const currentDist = diff.length();

    if (currentDist < PhysicsConstants.EPSILON) {
      // CTRL au handle → repousser verticalement
      const correction = new THREE.Vector3(0, lineLength, 0);
      newPosition.add(correction);
      return;
    }

    // Violation C = distance - lineLength
    const C = currentDist - lineLength;

    // Ligne molle → pas de contrainte
    if (C <= 0) return;

    // 3. Direction normale (CTRL → Handle)
    const n = diff.clone().normalize();

    // 4. Bras de levier r (centre kite → CTRL)
    const r = ctrlWorld.clone().sub(newPosition);

    // 5. Moment angulaire α = r × n
    const alpha = new THREE.Vector3().crossVectors(r, n);

    // 6. Calcul lambda (PBD)
    // Dénominateur : m^(-1) + (r × n)^2 * I^(-1)
    const denominator = invMass + alpha.lengthSq() * invInertia;

    if (denominator < PhysicsConstants.EPSILON) return;

    const lambda = C / denominator;

    // 7. ✅ CORRIGER POSITION KITE
    const deltaPosition = n.clone().multiplyScalar(-invMass * lambda);
    newPosition.add(deltaPosition);

    // 8. ✅ CORRIGER ROTATION KITE
    const deltaTheta = alpha.clone().multiplyScalar(-invInertia * lambda);
    const angle = deltaTheta.length();

    if (angle > PhysicsConstants.EPSILON) {
      const axis = deltaTheta.normalize();
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      transform.quaternion.premultiply(deltaQuat).normalize();
    }

    // 9. ✅ AMORTIR VÉLOCITÉ RADIALE (dampening)
    // Si CTRL s'éloigne du handle, freiner
    const radialVelocity = state.velocity.dot(n);

    if (radialVelocity > 0) {
      // Impulse linéaire
      const impulse = n.clone().multiplyScalar(-this.LINE_DAMPING * radialVelocity * invMass);
      state.velocity.add(impulse);

      // Impulse angulaire
      const angularImpulse = alpha.clone().multiplyScalar(-this.LINE_DAMPING * radialVelocity * invInertia);
      state.angularVelocity.add(angularImpulse);
    }
  }

  /**
   * Applique les corrections de brides
   *
   * Les brides connectent les points d'attache du kite (NEZ, INTER_GAUCHE, etc.)
   * aux points de contrôle CTRL. Comme les CTRL suivent maintenant le kite,
   * les brides sont presque automatiquement satisfaites.
   *
   * Cette fonction corrige les petites violations restantes.
   */
  private static applyBridleCorrections(
    kiteEntity: Entity,
    handles: HandlePositions,
    predictedKitePosition: THREE.Vector3,
    bridleLengths: BridleLengths
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) return;

    // Helper : convertir point local → monde
    const toWorld = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint
        .clone()
        .applyQuaternion(transform.quaternion)
        .add(predictedKitePosition);
    };

    // Points de contrôle en monde
    const ctrlLeftWorld = toWorld(geometry.getPoint('CTRL_GAUCHE')!);
    const ctrlRightWorld = toWorld(geometry.getPoint('CTRL_DROIT')!);

    // Définir les brides
    const bridles = [
      {
        attachPoint: 'NEZ',
        ctrlWorld: ctrlLeftWorld,
        length: bridleLengths.nez,
      },
      {
        attachPoint: 'INTER_GAUCHE',
        ctrlWorld: ctrlLeftWorld,
        length: bridleLengths.inter,
      },
      {
        attachPoint: 'CENTRE',
        ctrlWorld: ctrlLeftWorld,
        length: bridleLengths.centre,
      },
      {
        attachPoint: 'NEZ',
        ctrlWorld: ctrlRightWorld,
        length: bridleLengths.nez,
      },
      {
        attachPoint: 'INTER_DROIT',
        ctrlWorld: ctrlRightWorld,
        length: bridleLengths.inter,
      },
      {
        attachPoint: 'CENTRE',
        ctrlWorld: ctrlRightWorld,
        length: bridleLengths.centre,
      },
    ];

    // Appliquer corrections
    bridles.forEach(({ attachPoint, ctrlWorld, length }) => {
      const kitePointLocal = geometry.getPoint(attachPoint);
      if (!kitePointLocal) return;

      const kitePointWorld = toWorld(kitePointLocal);
      const diff = kitePointWorld.clone().sub(ctrlWorld);
      const distance = diff.length();

      if (distance < PhysicsConstants.EPSILON) return;

      const error = distance - length;
      const absError = Math.abs(error);

      // Tolérance 1cm (élasticité légère des brides)
      if (absError > 0.01) {
        const direction = diff.clone().normalize();
        // 30% correction (convergence douce)
        const correction = direction.multiplyScalar(error * 0.3);
        predictedKitePosition.sub(correction);
      }
    });
  }

  /**
   * Gère la collision avec le sol
   */
  static handleGroundCollision(
    kiteEntity: Entity,
    newPosition: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) return;

    const groundY = CONFIG.kite.minHeight;

    // Trouver le point le plus bas du kite
    let minY = Infinity;

    geometry.points.forEach((point) => {
      const worldPoint = point
        .clone()
        .applyQuaternion(transform.quaternion)
        .add(newPosition);

      if (worldPoint.y < minY) minY = worldPoint.y;
    });

    // Collision sol
    if (minY < groundY) {
      // Correction position
      newPosition.y += groundY - minY;

      // Amortir vélocité
      if (velocity.y < 0) velocity.y = 0;

      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;

      if (velocity.lengthSq() < PhysicsConstants.EPSILON) {
        velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Calcule les tensions dans les lignes (pour affichage/debug)
   */
  static calculateLineTensions(
    kiteEntity: Entity,
    handles: HandlePositions,
    aeroForce: THREE.Vector3,
    lineLength: number
  ): { left: number; right: number } {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) return { left: 0, right: 0 };

    const ctrlLeftLocal = geometry.getPoint('CTRL_GAUCHE');
    const ctrlRightLocal = geometry.getPoint('CTRL_DROIT');

    if (!ctrlLeftLocal || !ctrlRightLocal) return { left: 0, right: 0 };

    // Convertir en monde
    const ctrlLeftWorld = ctrlLeftLocal
      .clone()
      .applyQuaternion(transform.quaternion)
      .add(transform.position);

    const ctrlRightWorld = ctrlRightLocal
      .clone()
      .applyQuaternion(transform.quaternion)
      .add(transform.position);

    // Distances
    const distLeft = ctrlLeftWorld.distanceTo(handles.left);
    const distRight = ctrlRightWorld.distanceTo(handles.right);

    // Lignes tendues ?
    const isLeftTaut = distLeft >= lineLength * 0.99;
    const isRightTaut = distRight >= lineLength * 0.99;

    // Directions
    const dirLeft = ctrlLeftWorld.clone().sub(handles.left).normalize();
    const dirRight = ctrlRightWorld.clone().sub(handles.right).normalize();

    // Projection force aéro
    const halfAeroForce = aeroForce.clone().multiplyScalar(0.5);

    const tensionLeft = isLeftTaut ? Math.max(0, halfAeroForce.dot(dirLeft)) : 0;
    const tensionRight = isRightTaut ? Math.max(0, halfAeroForce.dot(dirRight)) : 0;

    return { left: tensionLeft, right: tensionRight };
  }
}
