/**
 * KiteFactory.ts - Factory pour créer l'entité kite
 * 
 * Crée un kite delta complet avec tous ses composants.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import {
  TransformComponent,
  PhysicsComponent,
  GeometryComponent,
  VisualComponent,
  KiteComponent,
  BridleComponent,
  AerodynamicsComponent
} from '../components';
import { CONFIG } from '../config/Config';
import { KiteGeometry } from '../config/KiteGeometry';
import { KiteSurfaceDefinitions } from '../config/KiteSurfaceDefinition';
import { MathUtils } from '../utils/MathUtils';

export class KiteFactory {
  /**
   * Crée l'entité kite
   */
  static create(initialPosition: THREE.Vector3): Entity {
    const entity = new Entity('kite');
    
    this.addTransformComponent(entity, initialPosition);
    this.addPhysicsComponent(entity);
    this.addGeometryComponent(entity);
    this.addVisualComponent(entity);
    this.addKiteComponent(entity);
    this.addBridleComponent(entity);
    this.addAerodynamicsComponent(entity);
    
    return entity;
  }

  /**
   * Ajoute le composant Transform avec position et orientation initiales
   */
  private static addTransformComponent(entity: Entity, position: THREE.Vector3): void {
    const orientation = MathUtils.quaternionFromEuler(
      CONFIG.initialization.kiteOrientation.pitch,
      CONFIG.initialization.kiteOrientation.yaw,
      CONFIG.initialization.kiteOrientation.roll
    );

    const clonedPosition = position.clone();

    entity.addComponent(new TransformComponent({
      position: clonedPosition,
      quaternion: orientation
    }));
  }

  /**
   * Ajoute le composant Physics avec masse, inertie et damping
   */
  private static addPhysicsComponent(entity: Entity): void {
    // Utilisation du tenseur d'inertie calculé à partir de la géométrie du kite
    const mass = CONFIG.kite.mass;
    const inertia = new THREE.Matrix3();
    inertia.set(
      CONFIG.kite.inertia.Ixx, 0, 0,
      0, CONFIG.kite.inertia.Iyy, 0,
      0, 0, CONFIG.kite.inertia.Izz
    );

    entity.addComponent(new PhysicsComponent({
      mass: mass,
      inertia,
      linearDamping: CONFIG.physics.linearDamping,  // Utilise la config (peut être modifié via UI)
      angularDamping: CONFIG.physics.angularDamping,
      isKinematic: false    // ✅ DYNAMIQUE : Le kite est libre de bouger
    }));
  }

  /**
   * Ajoute le composant Geometry avec points et connexions
   */
  private static addGeometryComponent(entity: Entity): void {
    const geometry = new GeometryComponent();
    
    // Ajouter tous les points
    const points = KiteGeometry.getDeltaPoints();
    points.forEach((point, name) => {
      geometry.setPoint(name, point);
    });
    
    // Ajouter connexions
    KiteGeometry.getDeltaConnections().forEach(conn => {
      geometry.addConnection(conn.from, conn.to);
    });

    // === SURFACES DU KITE ===
    // ✨ ARCHITECTURE: Utiliser KiteSurfaceDefinitions pour éviter la duplication
    // La source unique de vérité pour l'ordre des vertices est centralisée là-bas
    KiteSurfaceDefinitions.getAll().forEach(surfaceDefinition => {
      geometry.addSurface(surfaceDefinition.points);
    });
    
    entity.addComponent(geometry);
  }

  /**
   * Ajoute le composant Visual pour le rendu
   */
  private static addVisualComponent(entity: Entity): void {
    entity.addComponent(new VisualComponent({
      color: CONFIG.kite.color,
      opacity: 0.8,
      wireframe: false
    }));
  }

  /**
   * Ajoute le composant Kite avec dimensions
   */
  private static addKiteComponent(entity: Entity): void {
    entity.addComponent(new KiteComponent({
      wingspan: CONFIG.kite.wingspan,
      chord: CONFIG.kite.chord,
      surfaceArea: CONFIG.kite.surfaceArea
    }));
  }

  /**
   * Ajoute le composant Bridle avec configuration des brides
   */
  private static addBridleComponent(entity: Entity): void {
    entity.addComponent(new BridleComponent({
      nez: CONFIG.bridles.nez,
      inter: CONFIG.bridles.inter,
      centre: CONFIG.bridles.centre
    }));
  }

  /**
   * Ajoute le composant Aerodynamics avec coefficients aérodynamiques
   */
  private static addAerodynamicsComponent(entity: Entity): void {
    // ✨ ARCHITECTURE: Utiliser KiteSurfaceDefinitions pour éviter la duplication
    // La source unique de vérité pour l'ordre des vertices est centralisée là-bas
    const aeroSurfaces = KiteSurfaceDefinitions.getAll().map(surfaceDefinition => ({
      name: surfaceDefinition.id,
      points: surfaceDefinition.points
    }));

    entity.addComponent(new AerodynamicsComponent({
      coefficients: {
        CL: CONFIG.aero.CL0,
        CD: CONFIG.aero.CD0,
        CD0: CONFIG.aero.CD0,
        CM: CONFIG.aero.CM,
        CLAlpha: CONFIG.aero.CLAlpha,
        alpha0: CONFIG.aero.alpha0,
        alphaOptimal: CONFIG.aero.alphaOptimal
      },
      airDensity: CONFIG.aero.airDensity,
      surfaces: aeroSurfaces
    }));
  }
}
