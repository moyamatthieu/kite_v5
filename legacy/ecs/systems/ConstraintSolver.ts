/**
 * ConstraintSolver.ts - Solveur de contraintes géométriques SIMPLIFIÉ
 *
 * APPROCHE SIMPLIFIÉE (segments droits rigides) :
 *   - Lignes = segments droits de 15m (contrainte rigide)
 *   - Brides = segments droits de ~0.65m (longueurs fixes)
 *   - CTRL positionnés sur sphère ligne, direction vers kite
 *   - Pas d'itérations PBD/XPBD/trilatération complexe
 */
import * as THREE from "three";
import { Entity } from "@base/Entity";
import { GeometryComponent } from "@components/GeometryComponent";
import { TransformComponent } from "@components/TransformComponent";
import { LineComponent } from "@components/LineComponent";
import { PhysicsComponent } from "@components/PhysicsComponent";
import { HandlePositions } from "@mytypes/PhysicsTypes";
import { Logger } from "@utils/Logging";
import { BridleLengths } from "../types/BridleTypes";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";

export class PureConstraintSolver {
  private static lastLogTime = 0;

  static solveConstraintsGlobal(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    bridleLengths: BridleLengths,
    newKitePosition: THREE.Vector3,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    leftLineEntity?: Entity | null,
    rightLineEntity?: Entity | null
  ): void {
    let lineLength = CONFIG.lines.defaultLength;
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>('line');
      if (lineComponent) lineLength = lineComponent.config.length;
    }
    
    // Ordre inspiré du projet Makani (Google X) :
    // 1. Lignes = contrainte RIGIDE absolue (CTRL exactement sur sphère 15m)
    this.projectCtrlOnLineSphere(ctrlLeftEntity, handles.left, lineLength);
    this.projectCtrlOnLineSphere(ctrlRightEntity, handles.right, lineLength);
    
    // 2. Brides = contrainte SOUPLE (correction kite uniquement, 0% CTRL)
    //    Les CTRL ne bougent PLUS après projection ligne
    this.applyBridleCorrections(kiteEntity, ctrlLeftEntity, ctrlRightEntity, newKitePosition, bridleLengths);
    
    // 3. Sol en dernier
    this.handleGroundCollision(kiteEntity, newKitePosition, kiteState.velocity);
  }

  private static projectCtrlOnLineSphere(ctrlEntity: Entity, handle: THREE.Vector3, lineLength: number): void {
    const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
    if (!ctrlTransform) return;
    const direction = ctrlTransform.position.clone().sub(handle);
    const distance = direction.length();
    if (distance < PhysicsConstants.EPSILON) {
      ctrlTransform.position.copy(handle.clone().add(new THREE.Vector3(0, lineLength, 0)));
      return;
    }
    direction.normalize();
    ctrlTransform.position.copy(handle.clone().add(direction.multiplyScalar(lineLength)));
  }

  private static applyBridleCorrections(
    kiteEntity: Entity,
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    predictedKitePosition: THREE.Vector3,
    bridleLengths: BridleLengths
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');
    if (!geometry || !transform || !ctrlLeftTransform || !ctrlRightTransform) return;
    
    const toWorld = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(transform.quaternion).add(predictedKitePosition);
    };

    const bridlesLeft = [
      { kitePoint: "NEZ", ctrlTransform: ctrlLeftTransform, length: bridleLengths.nez },
      { kitePoint: "INTER_GAUCHE", ctrlTransform: ctrlLeftTransform, length: bridleLengths.inter },
      { kitePoint: "CENTRE", ctrlTransform: ctrlLeftTransform, length: bridleLengths.centre },
    ];
    const bridlesRight = [
      { kitePoint: "NEZ", ctrlTransform: ctrlRightTransform, length: bridleLengths.nez },
      { kitePoint: "INTER_DROIT", ctrlTransform: ctrlRightTransform, length: bridleLengths.inter },
      { kitePoint: "CENTRE", ctrlTransform: ctrlRightTransform, length: bridleLengths.centre },
    ];
    const allBridles = [...bridlesLeft, ...bridlesRight];

    // Contraintes de brides : |CTRL - AttachPoint| = longueur_bride
    // Approche Makani : Les CTRL sont sur sphère ligne (contrainte rigide absolue)
    // Correction UNIQUEMENT sur kite (100% kite, 0% CTRL)
    // Les brides peuvent avoir 1-2cm d'erreur (légère élasticité acceptable)
    allBridles.forEach(({ kitePoint, ctrlTransform, length }) => {
      const kitePointLocal = geometry.getPoint(kitePoint);
      if (!kitePointLocal) return;
      
      const kitePointWorld = toWorld(kitePointLocal);
      const diff = kitePointWorld.clone().sub(ctrlTransform.position);
      const distance = diff.length();
      
      if (distance < PhysicsConstants.EPSILON) return;
      
      const error = distance - length;
      const absError = Math.abs(error);
      
      // Tolérance 1cm : les brides réelles ont légère élasticité
      if (absError > 0.01) {
        const direction = diff.clone().normalize();
        // 50% correction sur kite UNIQUEMENT (convergence progressive)
        // 0% correction sur CTRL (déjà fixés sur sphère ligne)
        const correction = direction.multiplyScalar(error * 0.5);
        predictedKitePosition.sub(correction);
      }
    });
  }

  static handleGroundCollision(kiteEntity: Entity, newPosition: THREE.Vector3, velocity: THREE.Vector3): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    if (!geometry || !transform) return;
    const groundY = CONFIG.kite.minHeight;
    const toWorld = (localPoint: THREE.Vector3): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(transform.quaternion).add(newPosition);
    };
    let minY = Infinity;
    geometry.points.forEach((point) => {
      const world = toWorld(point);
      if (world.y < minY) minY = world.y;
    });
    if (minY < groundY) {
      newPosition.y += (groundY - minY);
      if (velocity.y < 0) velocity.y = 0;
      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;
      if (velocity.lengthSq() < PhysicsConstants.EPSILON) velocity.set(0, 0, 0);
    }
  }

  static calculateLineTensions(
    ctrlLeftEntity: Entity,
    ctrlRightEntity: Entity,
    handles: HandlePositions,
    aeroForce: THREE.Vector3,
    lineLength: number,
    logger?: Logger
  ): { left: number; right: number } {
    if (!ctrlLeftEntity || !ctrlRightEntity) return { left: 0, right: 0 };
    const ctrlLeftTransform = ctrlLeftEntity.getComponent<TransformComponent>('transform');
    const ctrlRightTransform = ctrlRightEntity.getComponent<TransformComponent>('transform');
    if (!ctrlLeftTransform || !ctrlRightTransform) return { left: 0, right: 0 };
    const distLeft = ctrlLeftTransform.position.distanceTo(handles.left);
    const distRight = ctrlRightTransform.position.distanceTo(handles.right);
    const isLeftTaut = distLeft >= lineLength * 0.99;
    const isRightTaut = distRight >= lineLength * 0.99;
    const dirLeft = ctrlLeftTransform.position.clone().sub(handles.left).normalize();
    const dirRight = ctrlRightTransform.position.clone().sub(handles.right).normalize();
    const halfAeroForce = aeroForce.clone().multiplyScalar(0.5);
    const tensionLeft = isLeftTaut ? Math.max(0, halfAeroForce.dot(dirLeft)) : 0;
    const tensionRight = isRightTaut ? Math.max(0, halfAeroForce.dot(dirRight)) : 0;
    return { left: tensionLeft, right: tensionRight };
  }

  static calculateLineTension(ctrlPosition: THREE.Vector3, handlePosition: THREE.Vector3, lineLength: number, lineStiffness: number = CONFIG.lines.stiffness): number {
    const currentLength = ctrlPosition.distanceTo(handlePosition);
    const delta = currentLength - lineLength;
    const tension = Math.max(0, delta * lineStiffness);
    return Math.min(tension, CONFIG.lines.maxTension);
  }

  static solveControlPointPosition(kiteEntity: Entity, handlePosition: THREE.Vector3, bridleLengths: { nez: number; inter: number; centre: number }, lineLength: number, attachments: { nez: string; inter: string; centre: string }): THREE.Vector3 {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    if (!geometry || !transform) return handlePosition.clone().add(new THREE.Vector3(0, lineLength, 0));
    const directionToKite = transform.position.clone().sub(handlePosition).normalize();
    return handlePosition.clone().add(directionToKite.multiplyScalar(lineLength));
  }

  static applyBridleForces(kiteEntity: Entity, ctrlPosition: THREE.Vector3, bridleLengths: { nez: number; inter: number; centre: number }, attachments: { nez: string; inter: string; centre: string }, bridleStiffness: number = 5000): void {}
  static solveFreePointConstraints(ctrlEntity: Entity, handle: THREE.Vector3, kiteEntity: Entity, bridleLengths: BridleLengths, attachments: { nez: string; inter: string; centre: string }, lineEntity?: Entity | null): void {}
  static enforceLineConstraints(ctrlLeftEntity: Entity, ctrlRightEntity: Entity, handles: HandlePositions, leftLineEntity?: Entity | null, rightLineEntity?: Entity | null): void {}
  
  static trilaterate3D(p1: THREE.Vector3, r1: number, p2: THREE.Vector3, r2: number, p3: THREE.Vector3, r3: number): THREE.Vector3 {
    return p1.clone().add(p2).add(p3).multiplyScalar(1/3);
  }
  
  static solveAllConstraints(kiteEntity: Entity, ctrlLeftEntity: Entity, ctrlRightEntity: Entity, handlePositions?: { left: THREE.Vector3; right: THREE.Vector3 }): void {}
}