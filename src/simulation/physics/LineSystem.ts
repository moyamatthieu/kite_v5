/**
 * LineSystem.ts - Orchestrateur du système de lignes du cerf-volant
 *
 * Rôle :
 *   - Coordonne les lignes gauche/droite du système de pilotage
 *   - Délègue les calculs physiques à LinePhysics
 *   - Applique les forces calculées sur le kite
 */
import * as THREE from "three";
import { Kite } from "@objects/organic/Kite";
import { Line } from "@objects/mechanical/Line";
import { LinePhysics } from "./LinePhysics";
import { LineFactory } from "@factories/LineFactory";
import { ControlBarManager } from "../controllers/ControlBarManager";
import { PhysicsConstants } from "../config/PhysicsConstants";

export class LineSystem {
  private leftLine: Line;
  private rightLine: Line;
  private physics: LinePhysics;
  private previousLeftKitePos: THREE.Vector3 | null = null;
  private previousRightKitePos: THREE.Vector3 | null = null;
  private previousLeftBarPos: THREE.Vector3 | null = null;
  private previousRightBarPos: THREE.Vector3 | null = null;

  constructor(lineLength?: number) {
    const [left, right] = LineFactory.createLinePair(lineLength);
    this.leftLine = left;
    this.rightLine = right;
    this.physics = new LinePhysics();
  }

  calculateLineTensions(
    kite: Kite,
    controlRotation: number,
    pilotPosition: THREE.Vector3
  ): {
    leftForce: THREE.Vector3;
    rightForce: THREE.Vector3;
    torque: THREE.Vector3;
  } {
    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) {
      return {
        leftForce: new THREE.Vector3(),
        rightForce: new THREE.Vector3(),
        torque: new THREE.Vector3(),
      };
    }

    const leftWorld = ctrlLeft.clone().applyQuaternion(kite.quaternion).add(kite.position);
    const rightWorld = ctrlRight.clone().applyQuaternion(kite.quaternion).add(kite.position);

    const tempControlBar = new ControlBarManager(pilotPosition);
    tempControlBar.setRotation(controlRotation);
    const handles = tempControlBar.getHandlePositions(kite.position);

    const leftVelocity = this.calculateVelocity(leftWorld, handles.left, this.previousLeftKitePos, this.previousLeftBarPos, 1 / 60);
    const rightVelocity = this.calculateVelocity(rightWorld, handles.right, this.previousRightKitePos, this.previousRightBarPos, 1 / 60);

    const leftResult = this.physics.calculateTensionForce(this.leftLine, leftWorld, handles.left, leftVelocity);
    const rightResult = this.physics.calculateTensionForce(this.rightLine, rightWorld, handles.right, rightVelocity);

    this.leftLine.updateState(leftResult.currentLength, leftResult.tension, performance.now());
    this.rightLine.updateState(rightResult.currentLength, rightResult.tension, performance.now());

    const totalTorque = this.calculateTorque(ctrlLeft, ctrlRight, kite.quaternion, leftResult.force, rightResult.force);

    this.previousLeftKitePos = leftWorld.clone();
    this.previousRightKitePos = rightWorld.clone();
    this.previousLeftBarPos = handles.left.clone();
    this.previousRightBarPos = handles.right.clone();

    return {
      leftForce: leftResult.force,
      rightForce: rightResult.force,
      torque: totalTorque,
    };
  }

  private calculateVelocity(
    currentKite: THREE.Vector3,
    currentBar: THREE.Vector3,
    previousKite: THREE.Vector3 | null,
    previousBar: THREE.Vector3 | null,
    deltaTime: number
  ): THREE.Vector3 {
    if (!previousKite || !previousBar || deltaTime <= 0) {
      return new THREE.Vector3();
    }
    const kiteVelocity = new THREE.Vector3().subVectors(currentKite, previousKite).divideScalar(deltaTime);
    const barVelocity = new THREE.Vector3().subVectors(currentBar, previousBar).divideScalar(deltaTime);
    return new THREE.Vector3().subVectors(kiteVelocity, barVelocity);
  }

  private calculateTorque(
    ctrlLeft: THREE.Vector3,
    ctrlRight: THREE.Vector3,
    kiteQuaternion: THREE.Quaternion,
    leftForce: THREE.Vector3,
    rightForce: THREE.Vector3
  ): THREE.Vector3 {
    const totalTorque = new THREE.Vector3();
    if (leftForce.length() > PhysicsConstants.EPSILON) {
      const leftLever = ctrlLeft.clone().applyQuaternion(kiteQuaternion);
      const leftTorque = new THREE.Vector3().crossVectors(leftLever, leftForce);
      totalTorque.add(leftTorque);
    }
    if (rightForce.length() > PhysicsConstants.EPSILON) {
      const rightLever = ctrlRight.clone().applyQuaternion(kiteQuaternion);
      const rightTorque = new THREE.Vector3().crossVectors(rightLever, rightForce);
      totalTorque.add(rightTorque);
    }
    return totalTorque;
  }

  calculateCatenary(start: THREE.Vector3, end: THREE.Vector3, segments: number = PhysicsConstants.CATENARY_SEGMENTS): THREE.Vector3[] {
    const tension = this.leftLine.getCurrentTension();
    return this.physics.calculateCatenaryPoints(this.leftLine, start, end, tension, segments);
  }

  setLineLength(length: number): void {
    const [left, right] = LineFactory.createLinePair(length);
    this.leftLine = left;
    this.rightLine = right;
    this.previousLeftKitePos = null;
    this.previousRightKitePos = null;
    this.previousLeftBarPos = null;
    this.previousRightBarPos = null;
  }

  get lineLength(): number {
    return this.leftLine.config.length;
  }

  set lineLength(length: number) {
    this.setLineLength(length);
  }
}
