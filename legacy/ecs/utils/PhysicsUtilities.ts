/**
 * PhysicsUtilities.ts - Utilitaires partagés pour calculs physiques
 *
 * Centralise les calculs réutilisés entre:
 * - AerodynamicsCalculator
 * - VelocityCalculator
 * - LinePhysics
 * - WindSimulator
 *
 * Élimine duplications et crée une source unique de vérité pour:
 * - Calculs d'angles d'incidence
 * - Calculs de pression dynamique
 * - Normalisations de vecteurs
 * - Validations de seuils
 */

import * as THREE from "three";
import { PhysicsConstants } from "@config/PhysicsConstants";
import { CONFIG } from "@config/SimulationConfig";
import { Logger } from "@utils/Logging";

/**
 * Résultat du calcul d'angle d'incidence
 */
export interface IncidenceAngleResult {
  /** Sinus de l'angle (0 = glissement, 1 = face au vent) */
  sin: number;
  /** Cosinus de l'angle */
  cos: number;
  /** Angle en radians */
  rad: number;
  /** Angle en degrés (pour debug) */
  deg: number;
  /** Normal façe au vent */
  windFacingNormal: THREE.Vector3;
  /** Direction du lift (perpendiculaire au vent) */
  liftDirection: THREE.Vector3;
  /** Direction du drag (direction du vent) */
  dragDirection: THREE.Vector3;
}

/**
 * Utilitaires partagés pour calculs physiques
 */
export class PhysicsUtilities {
  private static logger = Logger.getInstance();

  // ============================================================================
  // Wind & Apparent Wind Calculations
  // ============================================================================

  /**
   * Calcule le vent apparent (vent réel - vélocité de l'objet)
   *
   * Physique : Le vent que ressent un objet en mouvement est la superposition
   * du vent réel et du vent créé par son propre mouvement
   *
   * @param realWind - Vecteur du vent réel (m/s)
   * @param objectVelocity - Vélocité de l'objet (m/s)
   * @returns Vecteur du vent apparent
   *
   * @example
   * ```typescript
   * const realWind = new Vector3(5, 0, -5);  // Vent du NE
   * const kiteVel = new Vector3(2, 0, 0);    // Kite moving east
   * const apparent = PhysicsUtilities.calculateApparentWind(realWind, kiteVel);
   * // apparent = realWind - kiteVel = (3, 0, -5)
   * ```
   */
  static calculateApparentWind(
    realWind: THREE.Vector3,
    objectVelocity: THREE.Vector3
  ): THREE.Vector3 {
    return realWind.clone().sub(objectVelocity);
  }

  /**
   * Valide qu'un vecteur vent a une vitesse minimale pour les calculs
   *
   * @param apparentWind - Vecteur vent à valider
   * @param minSpeed - Vitesse minimale (défaut: MIN_WIND_SPEED)
   * @returns true si vent valide (vitesse >= minSpeed)
   */
  static isValidWind(apparentWind: THREE.Vector3, minSpeed = 0.1): boolean {
    return apparentWind.length() >= minSpeed;
  }

  // ============================================================================
  // Incidence Angle & Aerodynamic Directions
  // ============================================================================

  /**
   * Calcule l'angle d'incidence et les directions aérodynamiques
   *
   * Physique : L'angle d'incidence (α) est l'angle entre le vent et la surface.
   * - α = 0° : vent glisse sur la surface (pas de force)
   * - α = 90° : vent frappe perpendiculairement (force maximale)
   *
   * Les forces aérodynamiques se décomposent en:
   * - Lift : perpendiculaire au vent, dans le plan (vent, normale)
   * - Drag : direction du vent
   *
   * @param windDirection - Direction normalisée du vent
   * @param surfaceNormal - Normale de la surface (en coordonnées monde)
   * @returns Objet avec angle et directions calculées
   */
  static calculateIncidenceAngle(
    windDirection: THREE.Vector3, // should be normalized
    surfaceNormal: THREE.Vector3  // should be normalized
  ): IncidenceAngleResult {
    // Validation
    if (!this.isVectorValid(windDirection) || !this.isVectorValid(surfaceNormal)) {
      return this.getZeroIncidenceResult();
    }

    // Dot product : comment le vent frappe la normale
    const windDotNormal = windDirection.dot(surfaceNormal);

    // Orienter la normale pour qu'elle "regarde" le vent
    const windFacingNormal =
      windDotNormal >= 0
        ? surfaceNormal.clone()
        : surfaceNormal.clone().negate();

    // Angle d'incidence = angle entre vent et normale
    const cos = Math.abs(windDotNormal);
    const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
    const rad = Math.asin(Math.min(1, sin));
    const deg = rad * (180 / Math.PI);

    // Directions des forces
    // Lift : perpendiculaire au vent, dans le plan (vent, normale)
    const liftDirection = windFacingNormal.clone()
      .sub(windDirection.clone().multiplyScalar(windFacingNormal.dot(windDirection)))
      .normalize();

    // Valider lift direction (peut être invalide si vent proche de la normale)
    if (liftDirection.lengthSq() < PhysicsConstants.EPSILON) {
      liftDirection.copy(windFacingNormal);
    }

    // Drag : direction du vent
    const dragDirection = windDirection.clone();

    return {
      sin,
      cos,
      rad,
      deg,
      windFacingNormal,
      liftDirection,
      dragDirection,
    };
  }

  // ============================================================================
  // Aerodynamic Pressure & Force Calculations
  // ============================================================================

  /**
   * Calcule la pression dynamique
   *
   * Formule : q = 0.5 * ρ * V²
   * où :
   * - ρ : densité de l'air (kg/m³)
   * - V : vitesse du vent apparent (m/s)
   *
   * @param windSpeed - Vitesse du vent (m/s)
   * @param airDensity - Densité de l'air (kg/m³, défaut: CONFIG.physics.airDensity)
   * @returns Pression dynamique (Pa)
   */
  static calculateDynamicPressure(
    windSpeed: number,
    airDensity = CONFIG.physics.airDensity
  ): number {
    return 0.5 * airDensity * windSpeed * windSpeed;
  }

  /**
   * Calcule les magnitudes de lift et drag
   *
   * Formule :
   * - Lift = q * A * CL = 0.5 * ρ * V² * A * CL
   * - Drag = q * A * CD = 0.5 * ρ * V² * A * CD
   *
   * @param dynamicPressure - Pression dynamique (Pa)
   * @param area - Surface (m²)
   * @param CL - Coefficient de portance
   * @param CD - Coefficient de traînée
   * @returns Objet { lift, drag }
   */
  static calculateForceMagnitudes(
    dynamicPressure: number,
    area: number,
    CL: number,
    CD: number
  ): { lift: number; drag: number } {
    return {
      lift: dynamicPressure * area * CL,
      drag: dynamicPressure * area * CD,
    };
  }

  // ============================================================================
  // Vector & Validation Utilities
  // ============================================================================

  /**
   * Valide qu'un vecteur est numériquement valide (pas NaN, pas infini)
   *
   * @param vector - Vecteur à valider
   * @returns true si valide
   */
  static isVectorValid(vector: THREE.Vector3): boolean {
    return (
      Number.isFinite(vector.x) &&
      Number.isFinite(vector.y) &&
      Number.isFinite(vector.z) &&
      vector.lengthSq() > 0
    );
  }

  /**
   * Clamp un vecteur à une longueur maximale
   *
   * Utile pour éviter les débordements numériques
   *
   * @param vector - Vecteur à limiter
   * @param maxLength - Longueur maximale
   * @returns Vecteur clampé
   */
  static clampVectorLength(vector: THREE.Vector3, maxLength: number): THREE.Vector3 {
    const length = vector.length();
    if (length > maxLength) {
      return vector.multiplyScalar(maxLength / length);
    }
    return vector;
  }

  /**
   * Normalise sécurisé d'un vecteur (retourne zéro si invalide)
   *
   * @param vector - Vecteur à normaliser
   * @param fallback - Vecteur par défaut si normalisation échoue (défaut: Vector3(0,0,0))
   * @returns Vecteur normalisé
   */
  static safeNormalize(
    vector: THREE.Vector3,
    fallback = new THREE.Vector3()
  ): THREE.Vector3 {
    const length = vector.length();
    if (length < PhysicsConstants.EPSILON) {
      return fallback.clone();
    }
    return vector.clone().multiplyScalar(1 / length);
  }

  // ============================================================================
  // Gravity Calculations
  // ============================================================================

  /**
   * Calcule la force de gravité distribuée sur une surface
   *
   * @param mass - Masse totale (kg)
   * @param area - Surface considérée (m²)
   * @param totalArea - Aire totale (m²)
   * @param g - Accélération gravité (m/s², défaut: 9.81)
   * @returns Force de gravité pour cette surface
   */
  static calculateGravityForce(
    mass: number,
    area: number,
    totalArea: number,
    g = 9.81
  ): number {
    return (mass * area * g) / totalArea;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private static getZeroIncidenceResult(): IncidenceAngleResult {
    return {
      sin: 0,
      cos: 0,
      rad: 0,
      deg: 0,
      windFacingNormal: new THREE.Vector3(0, 1, 0),
      liftDirection: new THREE.Vector3(),
      dragDirection: new THREE.Vector3(),
    };
  }
}
