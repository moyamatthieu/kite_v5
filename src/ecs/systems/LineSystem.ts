/**
 * LineSystem.ts - Gestion des lignes de cerf-volant (force-based stable)
 *
 * MODÈLE PHYSIQUE : RESSORT-AMORTISSEUR DOUX (Makani-inspired)
 *
 * Les lignes sont modélisées comme des ressorts élastiques DOUX avec amortissement.
 * Elles ne génèrent PAS de forces aérodynamiques - seulement une contrainte mécanique.
 *
 * ÉTATS :
 * 1. SLACK (distance < restLength) : aucune force (F = 0)
 * 2. TAUT (distance >= restLength) : force ressort + damping
 *
 * RÈGLES CRITIQUES :
 * - NE JAMAIS déplacer position directement (pas de PBD/projection)
 * - Stiffness FAIBLE (k = 10-50 N/m)
 * - Damping FORT (c = 5-20 N·s/m)
 *
 * PRIORITÉ: 40 (après aéro, avant physique)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { PhysicsConstants, ConstraintConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';

const PRIORITY = 40;

export class LineSystem extends System {
  constructor() {
    super('LineSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry || kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    const ctrlLeft = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlRight = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    const poignetGauche = barGeometry.getPointWorld('poignet_gauche', controlBar);
    const poignetDroit = barGeometry.getPointWorld('poignet_droit', controlBar);

    if (!ctrlLeft || !ctrlRight || !poignetGauche || !poignetDroit) {
      return;
    }

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) {
      return;
    }

    this.applyLineConstraint({
      pointA: poignetGauche,
      pointB: ctrlLeft,
      restLength: leftLineComp.restLength,
      stiffness: ConstraintConfig.LINE_STIFFNESS,
      damping: ConstraintConfig.ABSOLUTE_DAMPING,
      kiteTransform,
      kitePhysics,
      lineComponent: leftLineComp
    });

    this.applyLineConstraint({
      pointA: poignetDroit,
      pointB: ctrlRight,
      restLength: rightLineComp.restLength,
      stiffness: ConstraintConfig.LINE_STIFFNESS,
      damping: ConstraintConfig.ABSOLUTE_DAMPING,
      kiteTransform,
      kitePhysics,
      lineComponent: rightLineComp
    });

    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  private applyLineConstraint(params: {
    pointA: THREE.Vector3;
    pointB: THREE.Vector3;
    restLength: number;
    stiffness: number;
    damping: number;
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    lineComponent: LineComponent;
  }): void {
    const { pointA, pointB, restLength, stiffness, damping, kiteTransform, kitePhysics, lineComponent } = params;

    const diff = new THREE.Vector3().subVectors(pointB, pointA);
    const distance = diff.length();

    if (distance < PhysicsConstants.EPSILON) {
      lineComponent.currentLength = 0;
      lineComponent.currentTension = 0;
      lineComponent.state.isTaut = false;
      return;
    }

    const direction = diff.clone().normalize();
    lineComponent.currentLength = distance;

    if (distance < restLength) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return;
    }

    lineComponent.state.isTaut = true;
    const excess = distance - restLength;
    lineComponent.state.elongation = excess;
    lineComponent.state.strainRatio = excess / restLength;

    const r = new THREE.Vector3().subVectors(pointB, kiteTransform.position);
    const angularContribution = new THREE.Vector3().crossVectors(kitePhysics.angularVelocity, r);
    const pointVelocity = new THREE.Vector3().addVectors(kitePhysics.velocity, angularContribution);
    const v_radial = pointVelocity.dot(direction);

    const F_spring = stiffness * excess;
    const F_damp = -damping * v_radial;
    let F_total = F_spring + F_damp;

    if (F_total < 0) {
      F_total = 0;
    }

    if (F_total > ConstraintConfig.MAX_CONSTRAINT_FORCE) {
      console.warn(`⚠️ [LineSystem] Force excessive: ${F_total.toFixed(1)}N → cap à ${ConstraintConfig.MAX_CONSTRAINT_FORCE}N`);
      F_total = ConstraintConfig.MAX_CONSTRAINT_FORCE;
    }

    lineComponent.currentTension = F_total;

    if (F_total <= PhysicsConstants.EPSILON) {
      return;
    }

    const forceVector = direction.multiplyScalar(-F_total);
    kitePhysics.forces.add(forceVector);

    const torque = MathUtils.computeTorque(pointB, kiteTransform.position, forceVector);
    kitePhysics.torques.add(torque);
  }

  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;

      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.1;
      }

      physics.angularVelocity.multiplyScalar(0.9);
    }
  }
}
