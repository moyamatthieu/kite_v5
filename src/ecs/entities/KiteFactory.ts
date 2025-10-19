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
    console.log('📍 [KiteFactory] addTransformComponent called with position:', position);
    
    const orientation = MathUtils.quaternionFromEuler(
      CONFIG.initialization.kiteOrientation.pitch,
      CONFIG.initialization.kiteOrientation.yaw,
      CONFIG.initialization.kiteOrientation.roll
    );
    
    const clonedPosition = position.clone();
    console.log('📍 [KiteFactory] Cloned position:', clonedPosition);
    
    entity.addComponent(new TransformComponent({
      position: clonedPosition,
      quaternion: orientation
    }));
    
    const transform = entity.getComponent<TransformComponent>('transform');
    console.log('📍 [KiteFactory] TransformComponent created with position:', transform?.position);
  }

  /**
   * Ajoute le composant Physics avec masse, inertie et damping
   */
  private static addPhysicsComponent(entity: Entity): void {
    // SIMPLIFICATION TEMPORAIRE : Inertie sphérique simple pour éviter les NaN
    // Formule inertie sphère : I = (2/5) * m * r²
    const mass = CONFIG.kite.mass;
    const radius = 1.0; // Rayon fictif de 1m
    const I = (2/5) * mass * radius * radius;
    
    const inertia = new THREE.Matrix3();
    inertia.set(
      I, 0, 0,
      0, I, 0,
      0, 0, I
    );
    
    console.log('[KiteFactory] Creating physics with:');
    console.log('  mass:', mass);
    console.log('  inertia (simple sphere):', I);
    console.log('  invMass:', 1/mass);
    
    entity.addComponent(new PhysicsComponent({
      mass: mass,
      inertia,
      linearDamping: 0.98,  // Réduit pour permettre le mouvement
      angularDamping: 0.95, // Réduit pour rotation fluide
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

    // Déclarer les surfaces triangulaires de la toile
    geometry.addSurface(['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE']);
    geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS']);
    geometry.addSurface(['NEZ', 'BORD_DROIT', 'WHISKER_DROIT']);
    geometry.addSurface(['NEZ', 'WHISKER_DROIT', 'SPINE_BAS']);
    
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
    const aeroSurfaces = [
      { name: 'leftUpper', points: ['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE'] as [string, string, string] },
      { name: 'leftLower', points: ['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS'] as [string, string, string] },
      { name: 'rightUpper', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] as [string, string, string] },
      { name: 'rightLower', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] as [string, string, string] }
    ];

    entity.addComponent(new AerodynamicsComponent({
      coefficients: {
        CL: CONFIG.aero.CL0,
        CD: CONFIG.aero.CD0,
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
