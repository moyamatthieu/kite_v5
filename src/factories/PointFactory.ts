/**
 * PointFactory.ts - Encapsule la logique de calcul des points anatomiques
 *
 * Responsabilité : Calculer les positions des points d'un cerf-volant delta
 */

import * as THREE from 'three';

import { CONFIG } from '@/simulation/config/SimulationConfig';

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

    const r1 = bridleLengths.nez;     // Rayon sphère 1
    const r2 = bridleLengths.inter;   // Rayon sphère 2
    const r3 = bridleLengths.centre;  // Rayon sphère 3

    // Trilatération 3D analytique
    // Étape 1 : Créer un repère local avec p1 à l'origine
    const ex = new THREE.Vector3().subVectors(p2, p1).normalize(); // axe X : direction p1->p2
    const d = p2.distanceTo(p1); // distance entre p1 et p2

    // Étape 2 : Calculer composante Y du repère
    const p3_p1 = new THREE.Vector3().subVectors(p3, p1);
    const i = ex.dot(p3_p1); // projection de p3-p1 sur ex
    const ey_temp = new THREE.Vector3().copy(p3_p1).addScaledVector(ex, -i);
    const ey = ey_temp.normalize(); // axe Y : perpendiculaire à ex dans le plan

    // Étape 3 : Axe Z (perpendiculaire au plan p1-p2-p3)
    const ez = new THREE.Vector3().crossVectors(ex, ey);

    // IMPORTANT : Pour garantir la symétrie, ez doit toujours pointer vers l'arrière (+Z global)
    // Si ez.z < 0, on inverse la direction
    if (ez.z < 0) {
      ez.negate();
    }

    // Étape 4 : Coordonnées de p3 dans le repère local
    const j = ey.dot(p3_p1);

    // Étape 5 : Résolution du système dans le repère local
    // x = (r1² - r2² + d²) / (2d)
    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);

    // y = (r1² - r3² + i² + j²) / (2j) - (i/j) * x
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    // z² = r1² - x² - y²
    const zSquared = r1 * r1 - x * x - y * y;

    // Si z² < 0, les sphères ne se croisent pas (configuration impossible)
    let z: number;
    if (zSquared < 0) {
      console.warn(`⚠️ Configuration de brides impossible (z²=${zSquared.toFixed(3)}), approximation`);
      z = 0; // Solution dégénérée : CTRL dans le plan des 3 points
    } else {
      // Deux solutions possibles (devant/derrière le plan)
      // On prend z > 0 (vers l'arrière du kite, direction +Z)
      // Pour garantir la SYMÉTRIE, les deux côtés doivent avoir le même Z
      z = Math.sqrt(zSquared);
    }

    // Étape 6 : Convertir les coordonnées locales en coordonnées globales
    const result = new THREE.Vector3();
    result.copy(p1); // Partir de p1
    result.addScaledVector(ex, x); // Ajouter x * ex
    result.addScaledVector(ey, y); // Ajouter y * ey
    result.addScaledVector(ez, z); // Ajouter z * ez

    return [result.x, result.y, result.z];
  }

  /**
   * Calcule toutes les positions des points anatomiques d'un cerf-volant delta
   */
  static calculateDeltaKitePoints(params: KiteParams): Map<string, [number, number, number]> {
  const { width, height, depth, bridleLengths } = params;
  const effectiveBridleLengths: BridleLengths = bridleLengths ?? { ...CONFIG.bridle.defaultLengths };

    // Logique métier extraite de Kite.ts
    const centreY = height / 4;
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);
    const interDroitX = ratio * (width / 2);
    const fixRatio = 2 / 3;

    // Points d'ancrage fixes des brides
    const nezPos: [number, number, number] = [0, height, 0];
    const centrePos: [number, number, number] = [0, height / 4, 0];
    const interGauchePos: [number, number, number] = [interGaucheX, centreY, 0];
    const interDroitPos: [number, number, number] = [interDroitX, centreY, 0];

    // Calculer la position du point de contrôle DROIT par trilatération.
    // Le point GAUCHE sera déduit par symétrie pour garantir une géométrie parfaite.
    const ctrlDroit = PointFactory.calculateControlPoint(
      nezPos,
      interDroitPos, // Utilise le point d'ancrage droit
      centrePos,
      effectiveBridleLengths,
      'right'
    );

    // Le point de contrôle GAUCHE est le miroir du point droit par rapport à l'axe YZ.
    // On prend la position du point droit et on inverse simplement sa coordonnée X.
    const ctrlGauche: [number, number, number] = [-ctrlDroit[0], ctrlDroit[1], ctrlDroit[2]];

    // Retourner la Map exactement comme dans le code original
    return new Map<string, [number, number, number]>([
      // Points structurels principaux
      ["SPINE_BAS", [0, 0, 0]],
      ["CENTRE", centrePos],
      ["NEZ", nezPos],

      // Points des bords d'attaque
      ["BORD_GAUCHE", [-width / 2, 0, 0]],
      ["BORD_DROIT", [width / 2, 0, 0]],

      // Points d'intersection pour le spreader
      ["INTER_GAUCHE", interGauchePos],
      ["INTER_DROIT", interDroitPos],

      // Points de fixation whiskers
      ["FIX_GAUCHE", [fixRatio * interGaucheX, centreY, 0]],
      ["FIX_DROIT", [fixRatio * interDroitX, centreY, 0]],

      // Points des whiskers
      ["WHISKER_GAUCHE", [-width / 4, 0.1, -depth]],
      ["WHISKER_DROIT", [width / 4, 0.1, -depth]],

      // Points de contrôle (bridage) - CALCULÉS depuis longueurs physiques
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
}