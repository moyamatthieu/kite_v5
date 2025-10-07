/**
 * LinePhysics.ts - Service de calculs physiques pour les lignes de cerf-volant
 *
 * Rôle :
 *   - Calculer les forces de tension dans une ligne (modèle Dyneema réaliste)
 *   - Appliquer pré-tension, élasticité linéaire et damping
 *   - Calculer l'affaissement caténaire pour le rendu
 *
 * Responsabilité :
 *   - Physique pure : F = F₀ + k×Δx - c×v_radial
 *   - Pas de gestion d'état (stateless)
 *   - Pas de dépendance Three.js (calculs vectoriels purs)
 *
 * Modèle Physique :
 *   - Lignes haute performance (Dyneema/Spectra)
 *   - Élasticité ~2-3%, rigidité EA/L ≈ 2200 N/m pour 15m
 *   - Toujours pré-tendues (50-100N minimum)
 *   - Damping interne (dissipation d'énergie)
 *
 * Relation avec les autres modules :
 *   - Opère sur des objets Line
 *   - Appelé par LineSystem pour calculer forces
 *   - Pas de dépendance sur la scène 3D
 *
 * Philosophie :
 *   - Pure function : Entrées → Sorties, pas d'effet de bord
 *   - Testable unitairement (pas de mock Three.js requis)
 *   - Single Responsibility : Calculs physiques uniquement
 *
 * Voir aussi :
 *   - src/objects/mechanical/Line.ts (entité métier)
 *   - docs/LINE_PHYSICS_AUDIT_2025-10-01.md (références physiques)
 */

import { Vector3 } from 'three';
import { Line } from '@objects/mechanical/Line';
import { PhysicsConstants } from '../config/PhysicsConstants';

/**
 * Résultat d'un calcul de force de tension
 */
export interface TensionResult {
  /** Force vectorielle à appliquer (N) */
  force: Vector3;

  /** Magnitude de la tension (N) */
  tension: number;

  /** Extension actuelle (m) */
  extension: number;

  /** Longueur actuelle (m) */
  currentLength: number;

  /** Ligne tendue ou molle */
  isTaut: boolean;
}

/**
 * Service de calculs physiques pour lignes de cerf-volant
 *
 * @example
 * ```typescript
 * const physics = new LinePhysics();
 * const result = physics.calculateTensionForce(
 *   line,
 *   new Vector3(0, 10, 0),  // Position kite
 *   new Vector3(0, 0, 0),   // Position poignée
 *   new Vector3(0, -1, 0)   // Vitesse relative
 * );
 * console.log(`Tension: ${result.tension}N`);
 * ```
 */
export class LinePhysics {
  /** Constante gravitationnelle (m/s²) */
  private static readonly GRAVITY = 9.81;

  /** Epsilon fin pour calculs de précision (réutilise PhysicsConstants) */
  private static readonly EPSILON = PhysicsConstants.EPSILON_FINE;

  /**
   * Calcule la force de tension dans une ligne
   *
   * Modèle : F = F₀ + k×Δx - c×v_radial
   * - F₀ : Pré-tension minimale (toujours présente)
   * - k×Δx : Composante élastique (si ligne tendue)
   * - c×v_radial : Damping (dissipation d'énergie)
   *
   * @param line - Ligne à analyser
   * @param startPos - Position point d'attache départ (kite ou barre)
   * @param endPos - Position point d'attache arrivée (barre ou kite)
   * @param relativeVelocity - Vitesse relative entre les deux points (pour damping)
   * @returns Résultat du calcul (force, tension, extension)
   */
  calculateTensionForce(
    line: Line,
    startPos: Vector3,
    endPos: Vector3,
    relativeVelocity: Vector3 = new Vector3()
  ): TensionResult {
    // Vecteur ligne et direction
    const lineVector = new Vector3().subVectors(endPos, startPos);
    const currentLength = lineVector.length();

    // Éviter division par zéro
    if (currentLength < LinePhysics.EPSILON) {
      return {
        force: new Vector3(),
        tension: 0,
        extension: 0,
        currentLength: 0,
        isTaut: false
      };
    }

    const lineDir = lineVector.clone().normalize();
    const restLength = line.config.length;

    // 1. Composante élastique : F_elastic = F₀ + k×Δx
    let elasticTension: number;
    let extension: number;
    let isTaut: boolean;

    if (currentLength > restLength) {
      // Ligne tendue : ajouter force élastique à la pré-tension
      extension = currentLength - restLength;
      elasticTension = line.config.preTension + line.config.stiffness * extension;
      isTaut = true;
    } else {
      // Ligne molle : maintenir pré-tension minimale
      extension = 0;
      elasticTension = line.config.preTension;
      isTaut = false;
    }

    // 2. Composante de damping : F_damp = -c × v_along_line
    const velocityAlongLine = relativeVelocity.dot(lineDir);
    const dampingTension = -line.config.dampingCoeff * velocityAlongLine;

    // 3. Tension totale (limitée par maxTension)
    const totalTension = Math.min(
      Math.max(elasticTension + dampingTension, 0), // Jamais négative
      line.config.maxTension
    );

    // 4. Force vectorielle
    const force = lineDir.clone().multiplyScalar(totalTension);

    return {
      force,
      tension: totalTension,
      extension,
      currentLength,
      isTaut
    };
  }

  /**
   * Calcule l'affaissement caténaire réel pour une ligne horizontale
   *
   * Formule simplifiée : sag = (ρ × g × L²) / (8 × T)
   * où :
   * - ρ : masse linéique (kg/m)
   * - g : gravité (9.81 m/s²)
   * - L : longueur ligne (m)
   * - T : tension (N)
   *
   * @param line - Ligne à analyser
   * @param tension - Tension actuelle (N)
   * @returns Affaissement vertical au centre (m)
   *
   * @example
   * ```typescript
   * const sag = physics.calculateCatenarySag(line, 100);
   * console.log(`Sag: ${sag * 1000}mm`); // ~1.4mm pour Dyneema 15m @ 100N
   * ```
   */
  calculateCatenarySag(line: Line, tension: number): number {
    if (tension < LinePhysics.EPSILON) {
      return 0; // Pas de tension = pas d'affaissement défini
    }

    const rho = line.config.linearMassDensity;
    const L = line.config.length;

    // Formule caténaire simplifiée (ligne horizontale)
    const sag = (rho * LinePhysics.GRAVITY * L * L) / (8 * tension);

    return Math.max(0, sag); // Toujours positif
  }

  /**
   * Calcule les points d'une vraie caténaire pour le rendu
   *
   * Équation complète : y(x) = a × cosh(x/a) - a
   * où a = T / (ρ × g)
   *
   * @param line - Ligne à analyser
   * @param startPos - Position départ
   * @param endPos - Position arrivée
   * @param tension - Tension actuelle (N)
   * @param segments - Nombre de segments pour la courbe
   * @returns Tableau de points 3D formant la caténaire
   *
   * @remarks
   * Pour lignes très tendues (T > 100N), la caténaire est quasi-linéaire
   * Pour lignes molles (T < 50N), l'affaissement devient visible
   */
  calculateCatenaryPoints(
    line: Line,
    startPos: Vector3,
    endPos: Vector3,
    tension: number,
    segments: number = 10
  ): Vector3[] {
    const directDistance = startPos.distanceTo(endPos);

    // Si ligne tendue ou très courte, approximation linéaire suffit
    if (directDistance >= line.config.length * 0.98 || tension > 100) {
      return [startPos.clone(), endPos.clone()];
    }

    // Paramètre de la caténaire : a = T / (ρ × g)
    const rho = line.config.linearMassDensity;
    const a = tension / (rho * LinePhysics.GRAVITY);

    // Calcul sag maximal
    const sag = this.calculateCatenarySag(line, tension);

    const points: Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Position linéaire interpolée
      const point = new Vector3().lerpVectors(startPos, endPos, t);

      // Ajout de l'affaissement en Y (forme parabolique simplifiée)
      // Pour un vrai cosh, il faudrait transformer en coordonnées locales
      point.y -= sag * 4 * t * (1 - t); // Maximum au centre (t=0.5)

      points.push(point);
    }

    return points;
  }

  /**
   * Calcule l'énergie élastique stockée dans une ligne
   *
   * E = ½ × k × Δx²
   *
   * @param line - Ligne à analyser
   * @returns Énergie en Joules
   */
  calculateElasticEnergy(line: Line): number {
    const extension = line.getExtension();
    return 0.5 * line.config.stiffness * extension * extension;
  }

  /**
   * Estime la fréquence propre d'oscillation de la ligne
   *
   * f ≈ (1/2π) × √(k/m_effective)
   *
   * @param line - Ligne à analyser
   * @param attachedMass - Masse attachée au bout (kg)
   * @returns Fréquence en Hz
   */
  calculateNaturalFrequency(line: Line, attachedMass: number): number {
    if (attachedMass < LinePhysics.EPSILON) {
      return 0;
    }

    // Masse effective de la ligne (1/3 de la masse totale)
    const lineMass = line.config.linearMassDensity * line.config.length;
    const effectiveMass = attachedMass + lineMass / 3;

    const omega = Math.sqrt(line.config.stiffness / effectiveMass);
    const frequency = omega / (2 * Math.PI);

    return frequency;
  }

  /**
   * Vérifie si la ligne est dans un état physique valide
   *
   * @param line - Ligne à valider
   * @returns true si valide, false sinon
   */
  validateLine(line: Line): boolean {
    const config = line.config;

    return (
      config.length > 0 &&
      config.stiffness > 0 &&
      config.preTension >= 0 &&
      config.maxTension > config.preTension &&
      config.dampingCoeff >= 0 &&
      config.dampingCoeff <= 1 &&
      config.linearMassDensity > 0
    );
  }
}
