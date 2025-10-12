/**
 * PointFactory.ts - Encapsule la logique de calcul des points anatomiques
 *
 * Responsabilité : Calculer les positions des points d'un cerf-volant delta
 */

import * as THREE from 'three';

import { CONFIG } from '@/simulation/config/SimulationConfig';
import { Point } from '@/objects/Point';

/**
 * Longueurs physiques des brides (en mètres)
 */
export interface BridleLengths {
  nez: number;      // Longueur bride NEZ -> CTRL (avant)
  inter: number;    // Longueur bride INTER -> CTRL (latéral)
  centre: number;   // Longueur bride CENTRE -> CTRL (arrière)
}

export interface KiteParams {
  width: number;   // Envergure
  height: number;  // Hauteur
  depth: number;   // Profondeur whiskers
  bridleLengths?: BridleLengths;  // Longueurs physiques des brides
}

/**
 * Factory simple qui encapsule la logique de calcul des points
 */
export class PointFactory {
  /**
   * Crée un point à partir de coordonnées.
   * @param x - Coordonnée X.
   * @param y - Coordonnée Y.
   * @param z - Coordonnée Z.
   * @returns Instance de Point.
   */
  static createPoint(x: number, y: number, z: number): Point {
    return new Point(x, y, z);
  }

  /**
   * Crée le repère local pour la trilatération 3D
   */
  private static createLocalCoordinateSystem(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3
  ): { ex: THREE.Vector3; ey: THREE.Vector3; ez: THREE.Vector3; i: number; j: number; d: number } {
    // Axe X : direction p1->p2
    const ex = new THREE.Vector3().subVectors(p2, p1).normalize();
    const d = p2.distanceTo(p1);

    // Composante Y du repère
    const p3_p1 = new THREE.Vector3().subVectors(p3, p1);
    const i = ex.dot(p3_p1);
    const ey_temp = new THREE.Vector3().copy(p3_p1).addScaledVector(ex, -i);
    const ey = ey_temp.normalize();

    // Axe Z (perpendiculaire au plan p1-p2-p3)
    const ez = new THREE.Vector3().crossVectors(ex, ey);

    // Garantir la symétrie - ez doit pointer vers l'arrière (+Z global)
    if (ez.z < 0) {
      ez.negate();
    }

    // Coordonnées de p3 dans le repère local
    const j = ey.dot(p3_p1);

    return { ex, ey, ez, i, j, d };
  }

  /**
   * Résout le système de trilatération dans le repère local
   */
  private static solveTrilaterationSystem(
    coordSystem: { i: number; j: number; d: number },
    radii: { r1: number; r2: number; r3: number }
  ): { x: number; y: number; z: number } {
    const { i, j, d } = coordSystem;
    const { r1, r2, r3 } = radii;

    // Résolution du système dans le repère local
    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    // Calcul de z
    const zSquared = r1 * r1 - x * x - y * y;
    let z: number;
    if (zSquared < 0) {
      console.warn(`⚠️ Configuration de brides impossible (z²=${zSquared.toFixed(3)}), approximation`);
      z = 0; // Solution dégénérée
    } else {
      z = Math.sqrt(zSquared); // z > 0 vers l'arrière du kite
    }

    return { x, y, z };
  }

  /**
   * Convertit les coordonnées locales en coordonnées globales
   */
  private static convertToGlobalCoordinates(
    p1: THREE.Vector3,
    coordSystem: { ex: THREE.Vector3; ey: THREE.Vector3; ez: THREE.Vector3 },
    localCoords: { x: number; y: number; z: number }
  ): THREE.Vector3 {
    const result = new THREE.Vector3();
    result.copy(p1);
    result.addScaledVector(coordSystem.ex, localCoords.x);
    result.addScaledVector(coordSystem.ey, localCoords.y);
    result.addScaledVector(coordSystem.ez, localCoords.z);
    return result;
  }

  /**
   * Calcule la position du point de contrôle (CTRL) par trilatération 3D analytique
   * Résout l'intersection de 3 sphères centrées en NEZ, INTER, CENTRE
   * avec rayons = longueurs de brides respectives
   */
  private static calculateControlPoint(
    nez: [number, number, number],
    inter: [number, number, number],
    centre: [number, number, number],
    bridleLengths: BridleLengths,
    _side: 'left' | 'right'
  ): [number, number, number] {
    // Convertir en Vector3
    const p1 = new THREE.Vector3(...nez);      // Point 1 : NEZ
    const p2 = new THREE.Vector3(...inter);    // Point 2 : INTER
    const p3 = new THREE.Vector3(...centre);   // Point 3 : CENTRE

    const radii = {
      r1: bridleLengths.nez,
      r2: bridleLengths.inter,
      r3: bridleLengths.centre
    };

    // Créer le repère local
    const coordSystem = this.createLocalCoordinateSystem(p1, p2, p3);

    // Résoudre le système
    const localCoords = this.solveTrilaterationSystem(coordSystem, radii);

    // Convertir en coordonnées globales
    const result = this.convertToGlobalCoordinates(p1, coordSystem, localCoords);

    return [result.x, result.y, result.z];
  }

  /**
   * Calcule les points d'ancrage fixes des brides
   */
  private static calculateAnchorPoints(width: number, height: number): {
    nezPos: [number, number, number];
    centrePos: [number, number, number];
    interGauchePos: [number, number, number];
    interDroitPos: [number, number, number];
  } {
    const centreY = height * CONFIG.geometry.quarter;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);

    return {
      nezPos: [0, height, 0],
      centrePos: [0, centreY, 0],
      interGauchePos: [interGaucheX, centreY, 0],
      interDroitPos: [interDroitX, centreY, 0]
    };
  }

  /**
   * Calcule les points de contrôle gauche et droit par trilatération
   */
  private static calculateControlPoints(
    anchorPoints: { nezPos: [number, number, number]; centrePos: [number, number, number]; interGauchePos: [number, number, number]; interDroitPos: [number, number, number] },
    bridleLengths: BridleLengths
  ): { ctrlGauche: [number, number, number]; ctrlDroit: [number, number, number] } {
    const { nezPos, centrePos, interDroitPos } = anchorPoints;

    // Calculer le point de contrôle droit par trilatération
    const ctrlDroit = PointFactory.calculateControlPoint(
      nezPos,
      interDroitPos,
      centrePos,
      bridleLengths,
      'right'
    );

    // Le point de contrôle gauche est le miroir du point droit
    const ctrlGauche: [number, number, number] = [-ctrlDroit[0], ctrlDroit[1], ctrlDroit[2]];

    return { ctrlGauche, ctrlDroit };
  }

  /**
   * Crée la collection complète des points anatomiques
   */
  private static createPointCollection(
    width: number,
    height: number,
    depth: number,
    anchorPoints: { nezPos: Point; centrePos: Point; interGauchePos: Point; interDroitPos: Point },
    controlPoints: { ctrlGauche: Point; ctrlDroit: Point }
  ): Map<string, Point> {
    const { nezPos, centrePos, interGauchePos, interDroitPos } = anchorPoints;
    const { ctrlGauche, ctrlDroit } = controlPoints;

    const fixRatio = CONFIG.geometry.twoThirds;

    return new Map<string, Point>([
      // Points structurels principaux
      ["SPINE_BAS", new Point(0, 0, 0)],
      ["CENTRE", centrePos],
      ["NEZ", nezPos],

      // Points des bords d'attaque
      ["BORD_GAUCHE", new Point(-width / 2, 0, 0)],
      ["BORD_DROIT", new Point(width / 2, 0, 0)],

      // Points d'intersection pour le spreader
      ["INTER_GAUCHE", interGauchePos],
      ["INTER_DROIT", interDroitPos],

      // Points de fixation whiskers
      ["FIX_GAUCHE", new Point(fixRatio * interGauchePos.position.x, centrePos.position.y, 0)],
      ["FIX_DROIT", new Point(fixRatio * interDroitPos.position.x, centrePos.position.y, 0)],

      // Points des whiskers
      ["WHISKER_GAUCHE", new Point(-width / 4, 0.1, -depth)],
      ["WHISKER_DROIT", new Point(width / 4, 0.1, -depth)],

      // Points de contrôle (bridage) - calculés depuis longueurs physiques
      ["CTRL_GAUCHE", ctrlGauche],
      ["CTRL_DROIT", ctrlDroit],

      // Points d'ancrage des brides
      ["BRIDE_GAUCHE_A", nezPos],
      ["BRIDE_GAUCHE_B", interGauchePos],
      ["BRIDE_GAUCHE_C", centrePos],
      ["BRIDE_DROITE_A", nezPos],
      ["BRIDE_DROITE_B", interDroitPos],
      ["BRIDE_DROITE_C", centrePos],
    ]);
  }

  /**
   * Calcule toutes les positions des points anatomiques d'un cerf-volant delta
   */
  static calculateDeltaKitePoints(params: KiteParams): Map<string, Point> {
    const { width, height, depth, bridleLengths } = params;
    const effectiveBridleLengths: BridleLengths = bridleLengths ?? { ...CONFIG.bridle.defaultLengths };

    // Calculer les points d'ancrage
    const anchorPoints = this.calculateAnchorPoints(width, height);
    const anchorPointsAsPoints = {
      nezPos: new Point(...anchorPoints.nezPos),
      centrePos: new Point(...anchorPoints.centrePos),
      interGauchePos: new Point(...anchorPoints.interGauchePos),
      interDroitPos: new Point(...anchorPoints.interDroitPos),
    };

    // Calculer les points de contrôle
    const controlPoints = this.calculateControlPoints(anchorPoints, effectiveBridleLengths);
    const controlPointsAsPoints = {
      ctrlGauche: new Point(...controlPoints.ctrlGauche),
      ctrlDroit: new Point(...controlPoints.ctrlDroit),
    };

    // Créer la collection complète
    return this.createPointCollection(width, height, depth, anchorPointsAsPoints, controlPointsAsPoints);
  }

  /**
   * Converts a tuple to a Point instance.
   * @param tuple - A tuple representing [x, y, z] coordinates.
   * @returns A Point instance.
   */
  private static tupleToPoint(tuple: [number, number, number]): Point {
    return new Point(tuple[0], tuple[1], tuple[2]);
  }

  /**
   * Converts a Point instance to a tuple.
   * @param point - A Point instance.
   * @returns A tuple representing [x, y, z] coordinates.
   */
  private static pointToTuple(point: Point): [number, number, number] {
    return [point.position.x, point.position.y, point.position.z];
  }
}