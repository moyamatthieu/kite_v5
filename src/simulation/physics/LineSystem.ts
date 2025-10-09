/**
 * LineSystem.ts - Orchestrateur du système de lignes du cerf-volant
 *
 * Rôle :
 *   - Coordonne les lignes gauche/droite du système de pilotage
 *   - Calcule les tensions pour affichage/debug (pas de forces appliquées)
 *   - Les contraintes de distance sont gérées par ConstraintSolver
 *
 * IMPORTANT : Les lignes sont des CONTRAINTES, pas des ressorts !
 *   - Elles RETIENNENT le kite (distance max)
 *   - Elles ne TIRENT PAS le kite vers le pilote
 *   - Le ConstraintSolver.enforceLineConstraints() gère la contrainte géométrique
 */
import * as THREE from "three";
import { Kite } from "@objects/organic/Kite";
import { Line } from "@objects/mechanical/Line";
import { LineFactory } from "@factories/LineFactory";

import { ControlBarManager } from "../controllers/ControlBarManager";
import { PhysicsConstants } from "../config/PhysicsConstants";

import { LinePhysics } from "./LinePhysics";
import { VelocityCalculator } from "./VelocityCalculator";

export class LineSystem {
  private leftLine: Line;
  private rightLine: Line;
  private physics: LinePhysics;
  private velocityCalculator: VelocityCalculator;

  constructor(lineLength?: number) {
    const [left, right] = LineFactory.createLinePair(lineLength);
    this.leftLine = left;
    this.rightLine = right;
    this.physics = new LinePhysics();
    this.velocityCalculator = new VelocityCalculator();
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

    const leftWorld = kite.localToWorld(ctrlLeft);
    const rightWorld = kite.localToWorld(ctrlRight);

    const tempControlBar = new ControlBarManager(pilotPosition);
    tempControlBar.setRotation(controlRotation);
    const handles = tempControlBar.getHandlePositions(kite.position);

    // Calculer vélocités relatives avec VelocityCalculator
    const leftVelocity = this.velocityCalculator.calculateRelative(
      "leftKite", "leftBar",
      leftWorld, handles.left,
      1 / 60
    );
    const rightVelocity = this.velocityCalculator.calculateRelative(
      "rightKite", "rightBar",
      rightWorld, handles.right,
      1 / 60
    );

    // Calculer tensions pour info/debug uniquement (pas de force appliquée)
    const leftResult = this.physics.calculateTensionForce(this.leftLine, leftWorld, handles.left, leftVelocity);
    const rightResult = this.physics.calculateTensionForce(this.rightLine, rightWorld, handles.right, rightVelocity);

    // Mettre à jour l'état des lignes (pour affichage)
    this.leftLine.updateState(leftResult.currentLength, leftResult.tension, performance.now());
    this.rightLine.updateState(rightResult.currentLength, rightResult.tension, performance.now());

    // ⚠️ IMPORTANT : PAS DE FORCES NI DE COUPLE APPLIQUÉS
    // Les lignes sont des contraintes géométriques (ConstraintSolver)
    // Le kite est retenu à distance max, pas tiré vers le pilote
    return {
      leftForce: new THREE.Vector3(), // Force nulle
      rightForce: new THREE.Vector3(), // Force nulle
      torque: new THREE.Vector3(), // Couple nul
    };
  }

  calculateCatenary(start: THREE.Vector3, end: THREE.Vector3, segments: number = PhysicsConstants.CATENARY_SEGMENTS): THREE.Vector3[] {
    const tension = this.leftLine.getCurrentTension();
    return this.physics.calculateCatenaryPoints(this.leftLine, start, end, tension, segments);
  }

  setLineLength(length: number): void {
    const [left, right] = LineFactory.createLinePair(length);
    this.leftLine = left;
    this.rightLine = right;
    // Réinitialiser l'historique des vélocités
    this.velocityCalculator.resetAll();
  }

  get lineLength(): number {
    return this.leftLine.config.length;
  }

  set lineLength(length: number) {
    this.setLineLength(length);
  }

  /**
   * Retourne les tensions actuelles des lignes gauche et droite
   * @returns Objet contenant les tensions en Newtons
   */
  getTensions(): { left: number; right: number } {
    return {
      left: this.leftLine.getCurrentTension(),
      right: this.rightLine.getCurrentTension()
    };
  }
}
