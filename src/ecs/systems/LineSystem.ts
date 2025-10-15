/**
 * LineSystem.ts - Système ECS pour gérer les lignes de cerf-volant
 *
 * Architecture ECS pure : travaille avec des entités ayant LineComponent
 * au lieu d'objets Line OO.
 *
 * Rôle :
 *   - Calcule les tensions des lignes pour affichage/debug
 *   - Les contraintes de distance sont gérées par ConstraintSolver
 */

import * as THREE from "three";
import { Entity } from "@base/Entity";
import { LineComponent, LineConfig, LineAttachments, LineState } from "@components/LineComponent";
import { GeometryComponent } from "@components/GeometryComponent";
import { TransformComponent } from "@components/TransformComponent";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { HandlePositions } from "@mytypes/PhysicsTypes";
import { CONFIG } from "@config/SimulationConfig";

export class LineSystem {
  private leftLineEntity: Entity | null = null;
  private rightLineEntity: Entity | null = null;

  /**
   * Configure les entités de lignes gauche et droite
   */
  setLineEntities(leftLine: Entity, rightLine: Entity): void {
    this.leftLineEntity = leftLine;
    this.rightLineEntity = rightLine;
  }

  /**
   * Calcule les tensions des lignes
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
      throw new Error("Line entities not configured");
    }

    const kiteGeometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    if (!kiteGeometry) {
      throw new Error("Kite entity missing geometry component");
    }

    // Récupérer les points d'attache sur le kite
    const ctrlLeft = kiteGeometry.getPoint("CTRL_GAUCHE");
    const ctrlRight = kiteGeometry.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) {
      throw new Error("Kite missing control points");
    }

    // Calculer les forces pour chaque ligne
    const leftForce = this.calculateLineForce(
      ctrlLeft,
      handles.left,
      this.leftLineEntity,
      deltaTime
    );

    const rightForce = this.calculateLineForce(
      ctrlRight,
      handles.right,
      this.rightLineEntity,
      deltaTime
    );

    // Calculer le torque (moment)
    const kiteTransform = kiteEntity.getComponent<TransformComponent>('transform');
    const kitePosition = kiteTransform?.position || new THREE.Vector3();

    const torque = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(handles.left, kitePosition),
        leftForce
      )
      .add(
        new THREE.Vector3().crossVectors(
          new THREE.Vector3().subVectors(handles.right, kitePosition),
          rightForce
        )
      );

    return { leftForce, rightForce, torque };
  }

  /**
   * Calcule la force d'une ligne individuelle
   */
  private calculateLineForce(
    kitePoint: THREE.Vector3,
    handlePoint: THREE.Vector3,
    lineEntity: Entity,
    deltaTime: number
  ): THREE.Vector3 {
    const lineComponent = lineEntity.getComponent<LineComponent>('line');
    if (!lineComponent) {
      throw new Error("Line entity missing line component");
    }

    // Calculer la distance actuelle
    const currentLength = kitePoint.distanceTo(handlePoint);
    const restLength = lineComponent.config.length;

    // Calculer la déformation
    const strain = (currentLength - restLength) / restLength;
    const strainRate = (strain - lineComponent.state.strain) / deltaTime;

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
   * Obtient les tensions actuelles des lignes
   */
  getLineTensions(): { left: number; right: number } {
    const leftTension = this.leftLineEntity?.getComponent<LineComponent>('line')?.state.currentTension || 0;
    const rightTension = this.rightLineEntity?.getComponent<LineComponent>('line')?.state.currentTension || 0;

    return { left: leftTension, right: rightTension };
  }

  // Added missing methods to LineSystem
  getTensions(): { left: number; right: number } {
    // TODO: Implement logic to calculate line tensions
    return { left: 0, right: 0 };
  }

  setLineLength(length: number): void {
    // TODO: Implement logic to set line length
  }

  getDistances(): { left: number; right: number } {
    // TODO: Implement logic to calculate distances
    return { left: 0, right: 0 };
  }

  getLineStates(): { leftTaut: boolean; rightTaut: boolean } {
    // TODO: Implement logic to retrieve line states
    return { leftTaut: false, rightTaut: false };
  }
}
