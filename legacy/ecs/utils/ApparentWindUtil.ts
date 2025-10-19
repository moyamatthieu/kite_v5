/**
 * ApparentWindUtil.ts - Conversion coordonnées vent apparent (Makani-inspired)
 * 
 * ✨ MAKANI-INSPIRED: Basé sur external/makani-master/analysis/aero/apparent_wind_util.py
 * 
 * Convertit entre représentations cartésienne et sphérique du vent apparent:
 * - Cartésien: Vecteur 3D (x, y, z) en m/s
 * - Sphérique: (airspeed, alpha, beta) - vitesse, angle d'attaque, angle de dérapage
 * 
 * Système de coordonnées (body frame):
 * - X: vers la droite du kite
 * - Y: vers le haut
 * - Z: vers l'arrière (vent vient de -Z)
 * 
 * Angles:
 * - alpha (angle d'attaque): rotation dans plan XZ (nez vers haut/bas)
 * - beta (sideslip): angle latéral dans plan XY
 * 
 * @see external/makani-master/analysis/aero/apparent_wind_util.py
 * @see PHYSICS_MODEL.md - Système de coordonnées
 */

import * as THREE from 'three';

/**
 * Représentation sphérique du vent apparent
 */
export interface ApparentWindSpherical {
  airspeed: number;  // m/s - Vitesse du vent relatif (norme du vecteur)
  alpha: number;     // rad - Angle d'attaque (pitch dans plan vertical)
  beta: number;      // rad - Angle de dérapage/sideslip (yaw latéral)
}

/**
 * Utilitaires pour conversion vent apparent (Makani-inspired)
 * 
 * Permet de calculer les angles d'attaque et de dérapage depuis le vent apparent,
 * essentiels pour les calculs aérodynamiques précis.
 */
export class ApparentWindUtil {
  /**
   * ✨ MAKANI: Convertit un vecteur de vent apparent (cartésien) en coordonnées sphériques
   * 
   * Formules issues de Makani (apparent_wind_util.py):
   * - airspeed = ||v||
   * - alpha = atan2(-v.z, -v.x)  // Angle dans plan XZ
   * - beta = atan2(-v.y, sqrt(v.x² + v.z²))  // Angle latéral
   * 
   * Convention de signes:
   * - Vent venant de -Z → alpha = 0°
   * - Nez vers le bas → alpha > 0 (positif)
   * - Vent venant de droite (-X) → beta > 0 (positif)
   * 
   * @param apparentWind - Vecteur de vent apparent en coordonnées body frame (m/s)
   * @returns Coordonnées sphériques { airspeed, alpha, beta }
   */
  static apparentWindCartToSph(apparentWind: THREE.Vector3): ApparentWindSpherical {
    const airspeed = apparentWind.length();
    
    // Cas limite: pas de vent
    if (airspeed < 0.1) {
      return { airspeed: 0, alpha: 0, beta: 0 };
    }
    
    // Angle d'attaque (dans plan vertical XZ)
    // atan2(-z, -x) car le vent "vient de" la direction opposée
    const alpha = Math.atan2(-apparentWind.z, -apparentWind.x);
    
    // Angle de dérapage (composante latérale Y)
    // Projection dans plan XZ pour calculer l'angle latéral
    const xzProjection = Math.sqrt(
      apparentWind.x ** 2 + apparentWind.z ** 2
    );
    const beta = Math.atan2(-apparentWind.y, xzProjection);
    
    return { airspeed, alpha, beta };
  }
  
  /**
   * ✨ MAKANI: Convertit coordonnées sphériques vers vecteur cartésien
   * 
   * Inverse de apparentWindCartToSph - utile pour tester et reconstruire le vent.
   * 
   * Formules Makani:
   * - x = -airspeed * cos(alpha) * cos(beta)
   * - y = -airspeed * sin(beta)
   * - z = -airspeed * sin(alpha) * cos(beta)
   * 
   * @param airspeed - Vitesse du vent en m/s
   * @param alpha - Angle d'attaque en radians
   * @param beta - Angle de dérapage en radians
   * @returns Vecteur de vent apparent en coordonnées body frame
   */
  static apparentWindSphToCart(
    airspeed: number, 
    alpha: number, 
    beta: number
  ): THREE.Vector3 {
    // Reconstruction du vecteur avec convention de signes Makani
    const x = -airspeed * Math.cos(alpha) * Math.cos(beta);
    const y = -airspeed * Math.sin(beta);
    const z = -airspeed * Math.sin(alpha) * Math.cos(beta);
    
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Calcule la DCM (Direction Cosine Matrix) wind-to-body depuis alpha et beta
   * 
   * ✨ MAKANI: Correspond à CalcDcmWToB dans sim/physics/aero_frame.cc
   * 
   * Transforme les forces du référentiel vent (wind frame) vers le référentiel kite (body frame).
   * Ordre des rotations: ZYX (yaw=-beta, pitch=alpha, roll=0)
   * 
   * @param alpha - Angle d'attaque (rad)
   * @param beta - Angle de dérapage (rad)
   * @returns Quaternion représentant la rotation wind→body
   */
  static calcDcmWToB(alpha: number, beta: number): THREE.Quaternion {
    // Ordre Euler ZYX: yaw (-beta), pitch (alpha), roll (0)
    const euler = new THREE.Euler(alpha, -beta, 0, 'ZYX');
    return new THREE.Quaternion().setFromEuler(euler);
  }

  /**
   * Affiche les valeurs d'angle d'attaque et sideslip en degrés pour debug
   * 
   * @param apparentWind - Vecteur de vent apparent
   * @returns String formatée pour logging
   */
  static formatDebug(apparentWind: THREE.Vector3): string {
    const { airspeed, alpha, beta } = ApparentWindUtil.apparentWindCartToSph(apparentWind);
    const alphaDeg = (alpha * 180 / Math.PI).toFixed(1);
    const betaDeg = (beta * 180 / Math.PI).toFixed(1);
    
    return `Airspeed=${airspeed.toFixed(2)}m/s | α=${alphaDeg}° | β=${betaDeg}°`;
  }
}
