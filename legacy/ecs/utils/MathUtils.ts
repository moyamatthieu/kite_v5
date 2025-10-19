/**
 * MathUtils.ts - Utilitaires mathématiques pour la simulation 3D
 */

import * as THREE from 'three';

export class MathUtils {
  /**
   * Clamp une valeur entre min et max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Interpolation linéaire
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * MathUtils.clamp(t, 0, 1);
  }

  /**
   * Interpolation sphérique (pour les rotations)
   */
  static slerp(q1: THREE.Quaternion, q2: THREE.Quaternion, t: number): THREE.Quaternion {
    return new THREE.Quaternion().slerpQuaternions(q1, q2, MathUtils.clamp(t, 0, 1));
  }

  /**
   * Distance euclidienne entre deux points 3D
   */
  static distance(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return p1.distanceTo(p2);
  }

  /**
   * Distance au carré (plus rapide pour les comparaisons)
   */
  static distanceSquared(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return p1.distanceToSquared(p2);
  }

  /**
   * Angle entre deux vecteurs (en radians)
   */
  static angleBetween(v1: THREE.Vector3, v2: THREE.Vector3): number {
    return v1.angleTo(v2);
  }

  /**
   * Projection d'un vecteur sur un autre
   */
  static project(v: THREE.Vector3, onto: THREE.Vector3): THREE.Vector3 {
    const ontoNormalized = onto.clone().normalize();
    return ontoNormalized.multiplyScalar(v.dot(ontoNormalized));
  }

  /**
   * Composante perpendiculaire d'un vecteur par rapport à un autre
   */
  static perpendicular(v: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    return v.clone().sub(this.project(v, to));
  }

  /**
   * Vérifie si un nombre est proche de zéro
   */
  static isZero(value: number, epsilon: number = 1e-6): boolean {
    return Math.abs(value) < epsilon;
  }

  /**
   * Vérifie si deux nombres sont égaux avec une tolérance
   */
  static equals(a: number, b: number, epsilon: number = 1e-6): boolean {
    return Math.abs(a - b) < epsilon;
  }

  /**
   * Génère un nombre aléatoire entre min et max
   */
  static random(min: number = 0, max: number = 1): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Convertit degrés en radians
   */
  static degToRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  /**
   * Convertit radians en degrés
   */
  static radToDeg(radians: number): number {
    return radians * 180 / Math.PI;
  }

  /**
   * Normalise un angle en radians entre -PI et PI
   */
  static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Interpolation smoothstep (plus douce que lerp)
   */
  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Fonction de easing (ease-in-out)
   */
  static easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Calcule la position initiale du kite avec lignes tendues
   * Utilise le théorème de Pythagore pour placer le kite devant le pilote
   * 
   * @param pilotPosition - Position du pilote
   * @param kiteY - Hauteur Y du kite
   * @param lineLength - Longueur des lignes
   * @param distanceFactor - Facteur de distance initiale (0-1, typiquement 0.98 pour lignes presque tendues)
   * @param initialKiteZ - Position Z fixe (optionnelle, sinon calculée automatiquement)
   * @returns Position 3D calculée du kite
   */
  static calculateInitialKitePosition(
    pilotPosition: THREE.Vector3,
    kiteY: number,
    lineLength: number,
    distanceFactor: number,
    initialKiteZ?: number | null
  ): THREE.Vector3 {
    // Si une position Z fixe est fournie, l'utiliser directement
    if (initialKiteZ !== null && initialKiteZ !== undefined) {
      return new THREE.Vector3(pilotPosition.x, kiteY, initialKiteZ);
    }

    // Calculer la distance initiale (98% de la longueur des lignes par défaut)
    const initialDistance = lineLength * distanceFactor;

    // Différence de hauteur entre kite et pilote
    const dy = kiteY - pilotPosition.y;

    // Calculer la distance horizontale avec Pythagore: horizontal² = distance² - dy²
    const horizontal = Math.max(
      0.1, // Minimum pour éviter division par zéro
      Math.sqrt(Math.max(0, initialDistance * initialDistance - dy * dy))
    );

    // Position Z : devant le pilote (direction -Z)
    const kiteZ = pilotPosition.z - horizontal;

    return new THREE.Vector3(pilotPosition.x, kiteY, kiteZ);
  }

  /**
   * ✨ MAKANI-INSPIRED: Crée le quaternion d'orientation initiale du kite
   * Le kite doit démarrer face au vent avec un angle d'attaque optimal
   * 
   * Système de coordonnées:
   * - X: vers la droite
   * - Y: vers le haut
   * - Z: vers l'arrière (vent vient de -Z)
   * 
   * @param pitchDeg - Pitch en degrés (nez vers le bas = positif)
   * @param yawDeg - Yaw en degrés (rotation autour de Y)
   * @param rollDeg - Roll en degrés (rotation autour de Z)
   * @returns Quaternion d'orientation
   */
  static createInitialKiteOrientation(
    pitchDeg: number = 35,
    yawDeg: number = 0,
    rollDeg: number = 0
  ): THREE.Quaternion {
    // Convertir degrés → radians
    const pitch = MathUtils.degToRad(pitchDeg);
    const yaw = MathUtils.degToRad(yawDeg);
    const roll = MathUtils.degToRad(rollDeg);

    // Créer quaternion avec ordre Euler YXZ (yaw, pitch, roll)
    const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }
}