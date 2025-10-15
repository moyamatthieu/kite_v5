/**
 * KiteEntityFactory.pure.ts - Factory ECS pur pour le cerf-volant
 *
 * Architecture ECS pure : pas d'objet Kite, juste des composants.
 * Remplace l'ancien KiteEntityFactory qui encapsulait un StructuredObject.
 *
 * Responsabilité : Créer une entité kite avec tous ses composants :
 * - GeometryComponent (points anatomiques)
 * - VisualComponent (apparence)
 * - BridleComponent (bridage)
 * - AerodynamicsComponent (surfaces aéro)
 * - TransformComponent (position, rotation)
 * - PhysicsComponent (vélocité, masse, inertie)
 */

import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { MathUtils } from '@utils/MathUtils';
import {
  GeometryComponent,
  VisualComponent,
  BridleComponent,
  AerodynamicsComponent,
  TransformComponent,
  PhysicsComponent
} from '@components/index';

import { CONFIG } from '@config/SimulationConfig';

export interface KiteFactoryParams {
  position?: THREE.Vector3;
  width?: number;
  height?: number;
  depth?: number;
  bridleLengths?: { nez: number; inter: number; centre: number };
  name?: string;
}

/**
 * Factory pour créer une entité Kite pure (ECS)
 */
export class PureKiteEntityFactory {
  /**
   * Crée une entité kite complète avec tous ses composants
   */
  static create(params: KiteFactoryParams = {}): Entity {
    const width = params.width ?? 1.65;
    const height = params.height ?? 0.65;
    const depth = params.depth ?? 0.20;
    const bridleLengths = params.bridleLengths ?? { ...CONFIG.bridle.defaultLengths };

    // 1. Créer l'entité
    const entity = new Entity(params.name || 'kite');

    // 2. Calculer les points géométriques
    const geometry = this.createGeometry(width, height, depth, bridleLengths);

    // 3. Créer les composants
    const visual = this.createVisual();
    const bridle = this.createBridle(bridleLengths);
    const aero = this.createAerodynamics(geometry.points);

    const position = params.position || this.calculateInitialPosition();
    const transform = new TransformComponent({ position });

    const physics = new PhysicsComponent({
      mass: CONFIG.kite.mass,
      inertia: CONFIG.kite.inertia,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3()
    });

    // 4. Ajouter tous les composants à l'entité
    entity.addComponent(geometry);
    entity.addComponent(visual);
    entity.addComponent(bridle);
    entity.addComponent(aero);
    entity.addComponent(transform);
    entity.addComponent(physics);

    return entity;
  }

  /**
   * Crée le GeometryComponent avec tous les points anatomiques
   */
  private static createGeometry(
    width: number,
    height: number,
    depth: number,
    bridleLengths: { nez: number; inter: number; centre: number }
  ): GeometryComponent {
    const geometry = new GeometryComponent();

    // Calcul des points d'ancrage
    const centreY = height * CONFIG.geometry.quarter;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);

    // Points structurels principaux
    geometry.setPoint('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('CENTRE', new THREE.Vector3(0, centreY, 0));
    geometry.setPoint('NEZ', new THREE.Vector3(0, height, 0));

    // Points des bords d'attaque
    geometry.setPoint('BORD_GAUCHE', new THREE.Vector3(-width / 2, 0, 0));
    geometry.setPoint('BORD_DROIT', new THREE.Vector3(width / 2, 0, 0));

    // Points d'intersection pour le spreader
    geometry.setPoint(
      'INTER_GAUCHE',
      new THREE.Vector3(interGaucheX, centreY, 0)
    );
    geometry.setPoint(
      'INTER_DROIT',
      new THREE.Vector3(interDroitX, centreY, 0)
    );

    // Points de fixation whiskers
    const fixRatio = CONFIG.geometry.twoThirds;
    geometry.setPoint(
      'FIX_GAUCHE',
      new THREE.Vector3(fixRatio * interGaucheX, centreY, 0)
    );
    geometry.setPoint(
      'FIX_DROIT',
      new THREE.Vector3(fixRatio * interDroitX, centreY, 0)
    );

    // Points des whiskers
    geometry.setPoint(
      'WHISKER_GAUCHE',
      new THREE.Vector3(-width / 4, 0.1, -depth)
    );
    geometry.setPoint(
      'WHISKER_DROIT',
      new THREE.Vector3(width / 4, 0.1, -depth)
    );

    // Points de contrôle (bridage) - calculés par trilatération
    const nezPos = new THREE.Vector3(0, height, 0);
    const centrePos = new THREE.Vector3(0, centreY, 0);
    const interDroitPos = new THREE.Vector3(interDroitX, centreY, 0);

    const ctrlDroit = this.calculateControlPoint(nezPos, interDroitPos, centrePos, bridleLengths);
    const ctrlGauche = new THREE.Vector3(-ctrlDroit.x, ctrlDroit.y, ctrlDroit.z);

    geometry.setPoint('CTRL_GAUCHE', ctrlGauche);
    geometry.setPoint('CTRL_DROIT', ctrlDroit);

    // Connexions pour frames
    geometry.addConnection('NEZ', 'SPINE_BAS');
    geometry.addConnection('NEZ', 'BORD_GAUCHE');
    geometry.addConnection('NEZ', 'BORD_DROIT');
    geometry.addConnection('INTER_GAUCHE', 'INTER_DROIT');
    geometry.addConnection('WHISKER_GAUCHE', 'FIX_GAUCHE');
    geometry.addConnection('WHISKER_DROIT', 'FIX_DROIT');

    // Surfaces pour voile
    geometry.addSurface(['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE']);
    geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS']);
    geometry.addSurface(['NEZ', 'BORD_DROIT', 'WHISKER_DROIT']);
    geometry.addSurface(['NEZ', 'WHISKER_DROIT', 'SPINE_BAS']);

    return geometry;
  }

  /**
   * Calcule le point de contrôle par trilatération 3D
   */
  private static calculateControlPoint(
    nez: THREE.Vector3,
    inter: THREE.Vector3,
    centre: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number }
  ): THREE.Vector3 {
    // Trilatération 3D simplifiée
    // Créer repère local
    const ex = inter.clone().sub(nez).normalize();
    const d = inter.distanceTo(nez);

    const centreToNez = centre.clone().sub(nez);
    const i = ex.dot(centreToNez);
    const eyTemp = centreToNez.clone().addScaledVector(ex, -i);
    const ey = eyTemp.normalize();

    const ez = new THREE.Vector3().crossVectors(ex, ey);
    if (ez.z < 0) ez.negate();

    const j = ey.dot(centreToNez);

    // Résoudre système
    const r1 = bridleLengths.nez;
    const r2 = bridleLengths.inter;
    const r3 = bridleLengths.centre;

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    const zSquared = r1 * r1 - x * x - y * y;
    const z = zSquared < 0 ? 0 : Math.sqrt(zSquared);

    // Convertir en coordonnées globales
    const result = new THREE.Vector3();
    result.copy(nez);
    result.addScaledVector(ex, x);
    result.addScaledVector(ey, y);
    result.addScaledVector(ez, z);

    return result;
  }

  /**
   * Crée le VisualComponent
   */
  private static createVisual(): VisualComponent {
    return new VisualComponent({
      frameMaterial: {
        color: '#2a2a2a',
        diameter: 0.01
      },
      surfaceMaterial: {
        color: '#ff3333',
        opacity: 0.9,
        transparent: true,
        doubleSided: true
      },
      whiskerMaterial: {
        color: '#444444',
        diameter: 0.005
      },
      bridleMaterial: {
        color: '#333333',
        opacity: 0.8,
        linewidth: 1
      },
      showDebugMarkers: false
    });
  }

  /**
   * Crée le BridleComponent
   */
  private static createBridle(lengths: { nez: number; inter: number; centre: number }): BridleComponent {
    return new BridleComponent({ lengths });
  }

  /**
   * Crée l'AerodynamicsComponent avec surfaces
   */
  private static createAerodynamics(points: Map<string, THREE.Vector3>): AerodynamicsComponent {
    const aero = new AerodynamicsComponent();

    // Définir les 4 surfaces triangulaires du kite
    const surfaces = [
      ['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE'],
      ['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS'],
      ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'],
      ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS']
    ];

    surfaces.forEach(([p1, p2, p3]) => {
      const v1 = points.get(p1);
      const v2 = points.get(p2);
      const v3 = points.get(p3);

      if (v1 && v2 && v3) {
        aero.addSurface([v1.clone(), v2.clone(), v3.clone()]);
      }
    });

    return aero;
  }

  /**
   * Calcule la position initiale du kite
   */
  static calculateInitialPosition(): THREE.Vector3 {
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    return MathUtils.calculateInitialKitePosition(
      controlBarPosition,
      CONFIG.initialization.initialKiteY,
      CONFIG.lines.defaultLength,
      CONFIG.initialization.initialDistanceFactor,
      CONFIG.initialization.initialKiteZ
    );
  }
}
