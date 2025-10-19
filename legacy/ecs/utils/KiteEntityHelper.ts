/**
 * KiteEntityHelper.ts - Utilitaires d'accès aux composants du kite
 *
 * Fournit des méthodes helper pour accéder facilement aux données du kite
 * via ses composants. Simplifie la migration et le code des systèmes.
 *
 * Architecture ECS pure : wrapper autour de l'accès aux composants
 */

import * as THREE from 'three';
import { Entity } from '@base/Entity';
import {
  GeometryComponent,
  TransformComponent,
  PhysicsComponent,
  BridleComponent,
  AerodynamicsComponent
} from '@components/index';

/**
 * Helper pour accéder aux données du kite de manière simplifiée
 */
export class KiteEntityHelper {
  /**
   * Récupère un point en coordonnées monde
   */
  static getWorldPoint(entity: Entity, pointName: string): THREE.Vector3 | undefined {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const transform = entity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) return undefined;

    const localPoint = geometry.getPoint(pointName);
    if (!localPoint) return undefined;

    // Transformer en coordonnées monde
    return localPoint
      .clone()
      .applyQuaternion(transform.quaternion)
      .add(transform.position);
  }

  /**
   * Récupère tous les points en coordonnées monde
   */
  static getWorldPoints(entity: Entity): Map<string, THREE.Vector3> {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    const transform = entity.getComponent<TransformComponent>('transform');

    const worldPoints = new Map<string, THREE.Vector3>();

    if (!geometry || !transform) return worldPoints;

    geometry.points.forEach((localPoint, name) => {
      const worldPoint = localPoint
        .clone()
        .applyQuaternion(transform.quaternion)
        .add(transform.position);
      worldPoints.set(name, worldPoint);
    });

    return worldPoints;
  }

  /**
   * Récupère un point en coordonnées locales
   */
  static getLocalPoint(entity: Entity, pointName: string): THREE.Vector3 | undefined {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    return geometry?.getPoint(pointName);
  }

  /**
   * Récupère tous les points en coordonnées locales
   */
  static getLocalPoints(entity: Entity): Map<string, THREE.Vector3> {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    return geometry ? new Map(geometry.points) : new Map();
  }

  /**
   * Convertit un point local en coordonnées monde
   */
  static localToWorld(entity: Entity, localPoint: THREE.Vector3): THREE.Vector3 {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) return localPoint.clone();

    return localPoint
      .clone()
      .applyQuaternion(transform.quaternion)
      .add(transform.position);
  }

  /**
   * Convertit un point monde en coordonnées locales
   */
  static worldToLocal(entity: Entity, worldPoint: THREE.Vector3): THREE.Vector3 {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (!transform) return worldPoint.clone();

    const inverseQuat = transform.quaternion.clone().invert();
    return worldPoint
      .clone()
      .sub(transform.position)
      .applyQuaternion(inverseQuat);
  }

  /**
   * Récupère les longueurs de brides
   */
  static getBridleLengths(entity: Entity): { nez: number; inter: number; centre: number } | undefined {
    const bridle = entity.getComponent<BridleComponent>('bridle');
    return bridle?.lengths;
  }

  /**
   * Défin les longueurs de brides
   */
  static setBridleLengths(
    entity: Entity,
    lengths: Partial<{ nez: number; inter: number; centre: number }>
  ): void {
    const bridle = entity.getComponent<BridleComponent>('bridle');
    if (bridle) {
      bridle.setBridleLengths(lengths);
    }
  }

  /**
   * Récupère les tensions de brides
   */
  static getBridleTensions(entity: Entity) {
    const bridle = entity.getComponent<BridleComponent>('bridle');
    return bridle?.tensions;
  }

  /**
   * Définit les tensions de brides
   */
  static setBridleTensions(
    entity: Entity,
    tensions: Partial<{
      leftNez: number;
      leftInter: number;
      leftCentre: number;
      rightNez: number;
      rightInter: number;
      rightCentre: number;
    }>
  ): void {
    const bridle = entity.getComponent<BridleComponent>('bridle');
    if (bridle) {
      bridle.setTensions(tensions);
    }
  }

  /**
   * Récupère les surfaces aérodynamiques en coordonnées monde
   */
  static getWorldSurfaces(entity: Entity) {
    const aero = entity.getComponent<AerodynamicsComponent>('aerodynamics');
    const transform = entity.getComponent<TransformComponent>('transform');

    if (!aero || !transform) return [];

    return aero.surfaces.map(surface => ({
      vertices: surface.vertices.map(v =>
        v.clone().applyQuaternion(transform.quaternion).add(transform.position)
      ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3],
      area: surface.area,
      centroid: surface.centroid
        .clone()
        .applyQuaternion(transform.quaternion)
        .add(transform.position),
      normal: surface.normal.clone().applyQuaternion(transform.quaternion),
      index: surface.index
    }));
  }

  /**
   * Vérifie si l'entité possède tous les composants kite
   */
  static isKiteEntity(entity: Entity): boolean {
    return !!(
      entity.getComponent('geometry') &&
      entity.getComponent('transform') &&
      entity.getComponent('physics') &&
      entity.getComponent('bridle') &&
      entity.getComponent('aerodynamics')
    );
  }

  /**
   * Récupère la position
   */
  static getPosition(entity: Entity): THREE.Vector3 {
    const transform = entity.getComponent<TransformComponent>('transform');
    return transform?.position.clone() || new THREE.Vector3();
  }

  /**
   * Définit la position
   */
  static setPosition(entity: Entity, position: THREE.Vector3): void {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (transform) {
      transform.position.copy(position);
    }
  }

  /**
   * Récupère la rotation (quaternion)
   */
  static getQuaternion(entity: Entity): THREE.Quaternion {
    const transform = entity.getComponent<TransformComponent>('transform');
    return transform?.quaternion.clone() || new THREE.Quaternion();
  }

  /**
   * Définit la rotation (quaternion)
   */
  static setQuaternion(entity: Entity, quaternion: THREE.Quaternion): void {
    const transform = entity.getComponent<TransformComponent>('transform');
    if (transform) {
      transform.quaternion.copy(quaternion);
    }
  }

  /**
   * Récupère la vélocité
   */
  static getVelocity(entity: Entity): THREE.Vector3 {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    return physics?.velocity.clone() || new THREE.Vector3();
  }

  /**
   * Définit la vélocité
   */
  static setVelocity(entity: Entity, velocity: THREE.Vector3): void {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    if (physics) {
      physics.velocity.copy(velocity);
    }
  }

  /**
   * Récupère la vélocité angulaire
   */
  static getAngularVelocity(entity: Entity): THREE.Vector3 {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    return physics?.angularVelocity.clone() || new THREE.Vector3();
  }

  /**
   * Définit la vélocité angulaire
   */
  static setAngularVelocity(entity: Entity, angularVelocity: THREE.Vector3): void {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    if (physics) {
      physics.angularVelocity.copy(angularVelocity);
    }
  }

  /**
   * Récupère la masse
   */
  static getMass(entity: Entity): number {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    return physics?.mass || 1.0;
  }

  /**
   * Récupère l'inertie
   */
  static getInertia(entity: Entity): number {
    const physics = entity.getComponent<PhysicsComponent>('physics');
    return physics?.inertia || 1.0;
  }
}
