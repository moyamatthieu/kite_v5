/**
 * ConstraintSystem.ts - Contraintes de lignes via Position-Based Dynamics
 *
 * MODÈLE PHYSIQUE UNIQUE : Position-Based Dynamics (PBD)
 * ========================================================
 * Les lignes RETIENNENT le kite avec une contrainte géométrique stricte.
 * Elles ne TIRENT PAS (pas de force de ressort).
 * 
 * La longueur de ligne est maintenue exactement à restLength via corrections
 * de position et rotation itératives. Ce modèle assure stabilité et réalisme.
 *
 * Algorithme inspiré des papiers académiques sur PBD (Müller et al.)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { CONFIG } from '../config/Config';

const GROUND_Y = 0;
const EPSILON = 0.001;
const PRIORITY = 40;
const PBD_ITERATIONS = 2;
const LINE_CONSTRAINT_TOLERANCE = 0.01;

export class ConstraintSystem extends System {
  constructor() {
    super('ConstraintSystem', PRIORITY);
  }

  update(context: SimulationContext): void {
    this.enforceLineConstraints(context);
  }

  private enforceLineConstraints(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) return;

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry) return;
    if (kitePhysics.isKinematic) return;

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    if (!leftLineComp || !rightLineComp) return;

    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!leftHandle || !rightHandle) return;

    const mass = kitePhysics.mass;
    const inertia = CONFIG.kite.inertia.Iyy;

    for (let i = 0; i < PBD_ITERATIONS; i++) {
      this.solveLineConstraint({
        kiteTransform, kitePhysics, kiteGeometry,
        ctrlPointName: 'CTRL_GAUCHE',
        handleWorld: leftHandle,
        lineComponent: leftLineComp,
        mass, inertia, kiteEntity: kite, deltaTime
      });

      this.solveLineConstraint({
        kiteTransform, kitePhysics, kiteGeometry,
        ctrlPointName: 'CTRL_DROIT',
        handleWorld: rightHandle,
        lineComponent: rightLineComp,
        mass, inertia, kiteEntity: kite, deltaTime
      });
    }

    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  private solveLineConstraint(params: {
    kiteTransform: TransformComponent;
    kitePhysics: PhysicsComponent;
    kiteGeometry: GeometryComponent;
    ctrlPointName: string;
    handleWorld: THREE.Vector3;
    lineComponent: LineComponent;
    mass: number;
    inertia: number;
    kiteEntity: any;
    deltaTime: number;
  }): void {
    const {
      kiteTransform, kitePhysics, kiteGeometry,
      ctrlPointName, handleWorld, lineComponent,
      mass, inertia, kiteEntity, deltaTime
    } = params;

    const ctrlWorld = kiteGeometry.getPointWorld(ctrlPointName, kiteEntity);
    if (!ctrlWorld) return;

    const diff = ctrlWorld.clone().sub(handleWorld);
    const distance = diff.length();

    lineComponent.currentLength = distance;
    lineComponent.state.currentLength = distance;

    if (distance <= lineComponent.restLength - LINE_CONSTRAINT_TOLERANCE) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentTension = 0;
      return;
    }

    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = distance - lineComponent.restLength;
    lineComponent.state.strainRatio = lineComponent.state.elongation / lineComponent.restLength;

    if (distance < EPSILON) return;

    const n = diff.clone().normalize();
    const C = distance - lineComponent.restLength;
    const r = ctrlWorld.clone().sub(kiteTransform.position);
    const alpha = new THREE.Vector3().crossVectors(r, n);

    const invMass = 1 / mass;
    const invInertia = 1 / Math.max(inertia, EPSILON);
    const denom = invMass + alpha.lengthSq() * invInertia;
    const lambda = C / Math.max(denom, EPSILON);

    // Correction position
    const dPos = n.clone().multiplyScalar(-invMass * lambda);
    kiteTransform.position.add(dPos);

    // Correction rotation
    const dTheta = alpha.clone().multiplyScalar(-invInertia * lambda);
    const angle = dTheta.length();

    if (angle > EPSILON) {
      const axis = dTheta.normalize();
      const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      kiteTransform.quaternion.premultiply(dq).normalize();
    }

    // Correction vitesse
    const ctrlWorld2 = kiteGeometry.getPointWorld(ctrlPointName, kiteEntity);
    if (!ctrlWorld2) return;

    const n2 = ctrlWorld2.clone().sub(handleWorld).normalize();
    const r2 = ctrlWorld2.clone().sub(kiteTransform.position);

    const pointVel = kitePhysics.velocity.clone()
      .add(new THREE.Vector3().crossVectors(kitePhysics.angularVelocity, r2));

    const radialSpeed = pointVel.dot(n2);

    if (radialSpeed > 0) {
      const rxn = new THREE.Vector3().crossVectors(r2, n2);
      const effMass = invMass + rxn.lengthSq() * invInertia;
      const impulse = -radialSpeed / Math.max(effMass, EPSILON);

      kitePhysics.velocity.add(n2.clone().multiplyScalar(impulse * invMass));

      const angImpulse = new THREE.Vector3().crossVectors(r2, n2.clone().multiplyScalar(impulse));
      kitePhysics.angularVelocity.add(angImpulse.multiplyScalar(invInertia));
    }

    if (deltaTime > EPSILON) {
      lineComponent.currentTension = Math.abs(lambda) / deltaTime;
    }
  }

  private handleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;
      if (physics.velocity.y < 0) {
        physics.velocity.y = 0;
      }
    }
  }
}
