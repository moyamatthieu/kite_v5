/**
 * KiteInitializer.ts - Utilitaire pour initialisation géométrique du kite
 *
 * Encapsule les calculs de trilatération et positionnement initial
 */

import * as THREE from "three";
import { Entity } from "@base/Entity";
import { TransformComponent } from "@components/TransformComponent";
import { GeometryComponent } from "@components/GeometryComponent";
import { BridleComponent } from "@components/BridleComponent";
import { Logger } from "@utils/Logging";

import { PureConstraintSolver } from "@/ecs/systems/ConstraintSolver";

/**
 * Utilitaire pour les calculs d'initialisation géométrique du kite
 */
export class KiteInitializer {
  private static logger = Logger.getInstance();

  /**
   * Calcule les positions initiales des points de contrôle (CTRL) par trilatération
   * depuis la géométrie du kite et les longueurs de brides
   *
   * @param kiteEntity - Entité du kite avec composants transform, geometry, bridle
   * @returns Positions initiales pour CTRL_LEFT et CTRL_RIGHT
   */
  static calculateInitialCtrlPositions(kiteEntity: Entity): {
    leftPosition: THREE.Vector3;
    rightPosition: THREE.Vector3;
  } {
    const transform = kiteEntity.getComponent<TransformComponent>("transform");
    const geometry = kiteEntity.getComponent<GeometryComponent>("geometry");
    const bridle = kiteEntity.getComponent<BridleComponent>("bridle");

    // Validation des composants
    if (!transform || !geometry || !bridle) {
      this.logger.error("Missing components for CTRL position calculation", "KiteInitializer");
      const fallbackY = transform?.position.y ?? 0;
      const fallbackZ = transform?.position.z ?? 0;
      return {
        leftPosition: new THREE.Vector3(-0.3, fallbackY - 1, fallbackZ),
        rightPosition: new THREE.Vector3(0.3, fallbackY - 1, fallbackZ),
      };
    }

    // Extraire les points d'attache de bridle depuis la géométrie (coordonnées locales)
    const nezPos = geometry.points.get("NEZ");
    const interLeftPos = geometry.points.get("INTER_GAUCHE");
    const interRightPos = geometry.points.get("INTER_DROIT");
    const centrePos = geometry.points.get("CENTRE");

    // Validation des points
    if (!nezPos || !interLeftPos || !interRightPos || !centrePos) {
      this.logger.error("Bridle attachment points not found in geometry", "KiteInitializer");
      return {
        leftPosition: new THREE.Vector3(-0.3, transform.position.y - 1, transform.position.z),
        rightPosition: new THREE.Vector3(0.3, transform.position.y - 1, transform.position.z),
      };
    }

    // Transformer en coordonnées monde (appliquer quaternion + position du kite)
    const nezWorld = this.transformToWorld(nezPos, transform);
    const interLeftWorld = this.transformToWorld(interLeftPos, transform);
    const interRightWorld = this.transformToWorld(interRightPos, transform);
    const centreWorld = this.transformToWorld(centrePos, transform);

    // Résoudre trilatération pour CTRL gauche
    const leftPosition = PureConstraintSolver.trilaterate3D(
      nezWorld,
      bridle.lengths.nez,
      interLeftWorld,
      bridle.lengths.inter,
      centreWorld,
      bridle.lengths.centre
    );

    // Résoudre trilatération pour CTRL droit
    const rightPosition = PureConstraintSolver.trilaterate3D(
      nezWorld,
      bridle.lengths.nez,
      interRightWorld,
      bridle.lengths.inter,
      centreWorld,
      bridle.lengths.centre
    );

    // Valider que positions sont valides (pas NaN)
    if (!this.isValidPosition(leftPosition) || !this.isValidPosition(rightPosition)) {
      this.logger.error(
        "Invalid CTRL positions from trilateration",
        "KiteInitializer"
      );
      return {
        leftPosition: new THREE.Vector3(-0.3, transform.position.y - 1, transform.position.z),
        rightPosition: new THREE.Vector3(0.3, transform.position.y - 1, transform.position.z),
      };
    }

    return { leftPosition, rightPosition };
  }

  /**
   * Transforme un point de coordonnées locales en coordonnées monde
   *
   * @param localPoint - Point en coordonnées locales
   * @param transform - Composant transform du kite
   * @returns Point en coordonnées monde
   */
  private static transformToWorld(localPoint: THREE.Vector3, transform: TransformComponent): THREE.Vector3 {
    return localPoint.clone().applyQuaternion(transform.quaternion).add(transform.position);
  }

  /**
   * Vérifie qu'une position est valide (pas NaN, pas infini)
   *
   * @param position - Position à valider
   * @returns true si la position est valide
   */
  private static isValidPosition(position: THREE.Vector3): boolean {
    return Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z);
  }
}
