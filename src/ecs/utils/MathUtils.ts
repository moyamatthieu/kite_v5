/**
 * MathUtils.ts - Fonctions mathématiques utilitaires
 * 
 * Collection de fonctions réutilisables pour calculs vectoriels,
 * transformations, géométrie et sécurité numérique.
 */

import * as THREE from 'three';
import type { TransformComponent } from '../components/TransformComponent';

export class MathUtils {
  /** Epsilon par défaut pour comparaisons flottantes */
  private static readonly EPSILON = 1e-6;

  // ========================================================================
  // QUATERNIONS ET ROTATIONS
  // ========================================================================

  /**
   * Crée un quaternion depuis des angles d'Euler (degrés)
   */
  static quaternionFromEuler(pitch: number, yaw: number, roll: number): THREE.Quaternion {
    const euler = new THREE.Euler(
      pitch * Math.PI / 180,
      yaw * Math.PI / 180,
      roll * Math.PI / 180,
      'XYZ'
    );
    return new THREE.Quaternion().setFromEuler(euler);
  }

  /**
   * Crée un quaternion depuis un axe et un angle
   * @param axis Axe de rotation (normalisé)
   * @param angle Angle en radians
   */
  static quaternionFromAxisAngle(axis: THREE.Vector3, angle: number): THREE.Quaternion {
    return new THREE.Quaternion().setFromAxisAngle(axis, angle);
  }

  // ========================================================================
  // TRANSFORMATIONS DE COORDONNÉES
  // ========================================================================

  /**
   * Transforme un point local en coordonnées monde
   * @param localPoint Point dans l'espace local
   * @param transform Composant de transformation (position + rotation)
   * @returns Point dans l'espace monde
   */
  static transformPointToWorld(localPoint: THREE.Vector3, transform: TransformComponent): THREE.Vector3 {
    const matrix = new THREE.Matrix4();
    matrix.compose(transform.position, transform.quaternion, new THREE.Vector3(1, 1, 1));
    return localPoint.clone().applyMatrix4(matrix);
  }

  /**
   * Calcule l'orientation et la position pour aligner un cylindre entre deux points
   * @param start Point de départ
   * @param end Point d'arrivée
   * @returns Centre et quaternion d'orientation
   */
  static calculateCylinderOrientation(start: THREE.Vector3, end: THREE.Vector3): { 
    center: THREE.Vector3, 
    quaternion: THREE.Quaternion 
  } {
    const direction = new THREE.Vector3().subVectors(end, start);
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Cylindre par défaut aligné sur Y, on doit le réorienter
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      up, 
      direction.clone().normalize()
    );
    
    return { center, quaternion };
  }

  // ========================================================================
  // OPÉRATIONS VECTORIELLES
  // ========================================================================

  /**
   * Calcule la direction normalisée de 'from' vers 'to'
   * @returns Vector3 normalisé, ou (0,0,0) si distance nulle
   */
  static computeNormalizedDirection(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    
    if (length < this.EPSILON) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    return direction.divideScalar(length);
  }

  /**
   * Projette un vecteur sur un axe
   * @param vector Vecteur à projeter
   * @param axis Axe de projection (doit être normalisé)
   * @returns Magnitude de la projection
   */
  static projectVectorOnAxis(vector: THREE.Vector3, axis: THREE.Vector3): number {
    return vector.dot(axis);
  }

  /**
   * Calcule la composante radiale de la vitesse (pour amortissement)
   * @param velocity Vecteur vitesse
   * @param direction Direction de la contrainte (normalisée)
   * @returns Vitesse radiale (scalaire)
   */
  static computeRadialVelocity(velocity: THREE.Vector3, direction: THREE.Vector3): number {
    return velocity.dot(direction);
  }

  /**
   * Projette un vecteur sur un plan défini par sa normale
   */
  static projectOnPlane(vector: THREE.Vector3, planeNormal: THREE.Vector3): THREE.Vector3 {
    const normal = planeNormal.clone().normalize();
    const dot = vector.dot(normal);
    return vector.clone().sub(normal.multiplyScalar(dot));
  }

  // ========================================================================
  // MATRICES
  // ========================================================================

  /**
   * Applique une matrice 3x3 à un vecteur
   * @param matrix Matrice 3x3
   * @param vector Vecteur 3D
   * @returns Vecteur transformé
   */
  static applyMatrix3ToVector(matrix: THREE.Matrix3, vector: THREE.Vector3): THREE.Vector3 {
    const e = matrix.elements;
    return new THREE.Vector3(
      e[0] * vector.x + e[3] * vector.y + e[6] * vector.z,
      e[1] * vector.x + e[4] * vector.y + e[7] * vector.z,
      e[2] * vector.x + e[5] * vector.y + e[8] * vector.z
    );
  }

  /**
   * Calcule la matrice d'inertie inverse pour une boîte
   * (Utilisé pour la physique des corps rigides)
   */
  static computeInverseInertia(mass: number, dimensions: THREE.Vector3): THREE.Matrix3 {
    const Ixx = (1 / 12) * mass * (dimensions.y * dimensions.y + dimensions.z * dimensions.z);
    const Iyy = (1 / 12) * mass * (dimensions.x * dimensions.x + dimensions.z * dimensions.z);
    const Izz = (1 / 12) * mass * (dimensions.x * dimensions.x + dimensions.y * dimensions.y);
    
    const invIxx = Ixx > 0 ? 1 / Ixx : 0;
    const invIyy = Iyy > 0 ? 1 / Iyy : 0;
    const invIzz = Izz > 0 ? 1 / Izz : 0;
    
    return new THREE.Matrix3().set(
      invIxx, 0, 0,
      0, invIyy, 0,
      0, 0, invIzz
    );
  }

  // ========================================================================
  // GÉOMÉTRIE
  // ========================================================================

  /**
   * Calcule l'aire d'un triangle
   * @param v1 Premier sommet
   * @param v2 Deuxième sommet
   * @param v3 Troisième sommet
   * @returns Aire en m²
   */
  static computeTriangleArea(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);
    return cross.length() * 0.5;
  }

  /**
   * Calcule la normale d'un triangle (sens anti-horaire)
   * @param v1 Premier sommet
   * @param v2 Deuxième sommet
   * @param v3 Troisième sommet
   * @returns Normale normalisée
   */
  static computeTriangleNormal(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 {
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2);
    return normal.normalize();
  }

  /**
   * Calcule le centroïde (centre géométrique) d'un ensemble de points
   * @param vertices Liste de sommets
   * @returns Position du centroïde
   */
  static computeCentroid(vertices: THREE.Vector3[]): THREE.Vector3 {
    if (vertices.length === 0) {
      return new THREE.Vector3();
    }
    
    const centroid = new THREE.Vector3();
    for (const vertex of vertices) {
      centroid.add(vertex);
    }
    centroid.divideScalar(vertices.length);
    
    return centroid;
  }

  // ========================================================================
  // SÉCURITÉ NUMÉRIQUE
  // ========================================================================

  /**
   * Clamp une valeur entre min et max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Limite la magnitude d'une valeur
   * @param value Valeur à limiter
   * @param maxMagnitude Magnitude maximale (valeur absolue)
   * @returns Valeur limitée
   */
  static clampMagnitude(value: number, maxMagnitude: number): number {
    if (Math.abs(value) > maxMagnitude) {
      return Math.sign(value) * maxMagnitude;
    }
    return value;
  }

  /**
   * Division sécurisée (évite division par zéro)
   * @param numerator Numérateur
   * @param denominator Dénominateur
   * @param fallback Valeur par défaut si dénominateur nul
   * @returns Résultat de la division ou fallback
   */
  static safeDivide(numerator: number, denominator: number, fallback = 0): number {
    if (Math.abs(denominator) < this.EPSILON) {
      return fallback;
    }
    return numerator / denominator;
  }

  /**
   * Vérifie qu'une valeur est finie (pas NaN, pas Infinity)
   * @param value Valeur à vérifier (number ou Vector3)
   * @param context Contexte pour logging (optionnel)
   * @returns true si valide, false sinon
   */
  static ensureFinite(value: number | THREE.Vector3, context?: string): boolean {
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        if (context) {
          console.error(`❌ [MathUtils] Non-finite value in ${context}:`, value);
        }
        return false;
      }
      return true;
    }
    
    // Vector3
    const isValid = isFinite(value.x) && isFinite(value.y) && isFinite(value.z);
    if (!isValid && context) {
      console.error(`❌ [MathUtils] Non-finite Vector3 in ${context}:`, value);
    }
    return isValid;
  }

  // ========================================================================
  // INTERPOLATION
  // ========================================================================

  /**
   * Lerp linéaire
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Lerp vectoriel
   */
  static lerpVector(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.lerp(a.x, b.x, t),
      this.lerp(a.y, b.y, t),
      this.lerp(a.z, b.z, t)
    );
  }

  // ========================================================================
  // DISTANCE ET MESURES
  // ========================================================================

  /**
   * Calcule la distance 3D entre deux points
   */
  static distance(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceTo(b);
  }

  /**
   * Calcule la distance au carré (plus rapide, évite sqrt)
   */
  static distanceSquared(a: THREE.Vector3, b: THREE.Vector3): number {
    return a.distanceToSquared(b);
  }

  // ========================================================================
  // UTILITAIRES GÉNÉRIQUES
  // ========================================================================

  /**
   * Initialise une propriété avec une valeur par défaut si non définie
   * @param options Objet contenant les options
   * @param propertyName Nom de la propriété
   * @param defaultValue Valeur par défaut
   * @returns Valeur de la propriété ou valeur par défaut
   */
  static initializeProperty<T>(options: any, propertyName: string, defaultValue: T): T {
    return options?.[propertyName] ?? defaultValue;
  }

  /**
   * Alias pour distance (compatibilité)
   * @deprecated Utiliser distance() à la place
   */
  static distanceBetweenPoints(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return p1.distanceTo(p2);
  }
}
