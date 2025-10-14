/**
 * VelocityCalculator.ts - Service de calcul de vélocité relative
 *
 * Rôle :
 *   - Calcule la vélocité relative entre deux points à partir de leur historique de positions
 *   - Stocke les positions précédentes pour permettre la dérivation temporelle
 *   - Service réutilisable par LineSystem et BridleSystem
 *
 * Principe :
 *   v = Δpos / Δt
 *   où Δpos = position_actuelle - position_précédente
 *
 * Responsabilité :
 *   - Gestion de l'historique des positions (Map clé → position)
 *   - Calcul de vélocité par différence finie
 *   - Service stateless réutilisable
 *
 * Relation avec les autres modules :
 *   - Utilisé par LineSystem pour calculer vélocité relative lignes
 *   - Utilisé par BridleSystem pour calculer vélocité relative brides
 *
 * Philosophie :
 *   - DRY (Don't Repeat Yourself) : élimine duplication LineSystem/BridleSystem
 *   - Single Responsibility : calcul vélocité uniquement
 *   - Testable unitairement
 *
 * Voir aussi :
 *   - src/simulation/physics/LineSystem.ts
 *   - src/simulation/physics/BridleSystem.ts
 */

import * as THREE from "three";

/**
 * Service de calcul de vélocité relative par différence finie
 *
 * Maintient un historique des positions précédentes pour calculer
 * la dérivée temporelle (vélocité) par différence finie d'ordre 1.
 *
 * @example
 * ```typescript
 * const velCalc = new VelocityCalculator();
 *
 * // Frame 1
 * const vel1 = velCalc.calculate("kite", pos1, deltaTime);
 * // vel1 = (0, 0, 0) car pas d'historique
 *
 * // Frame 2
 * const vel2 = velCalc.calculate("kite", pos2, deltaTime);
 * // vel2 = (pos2 - pos1) / deltaTime
 * ```
 */
export class VelocityCalculator {
  /**
   * Historique des positions précédentes
   * Clé : identifiant unique (ex: "leftKite", "NEZ_CTRL_GAUCHE")
   * Valeur : dernière position connue
   */
  private previousPositions: Map<string, THREE.Vector3> = new Map();

  /**
   * Calcule la vélocité relative d'un point entre deux frames
   *
   * Utilise la différence finie d'ordre 1 :
   * v = (pos_actuelle - pos_précédente) / Δt
   *
   * Au premier appel pour une clé, retourne (0, 0, 0) car pas d'historique.
   *
   * @param key - Identifiant unique du point (ex: "leftKite", "NEZ_CTRL_GAUCHE")
   * @param currentPos - Position actuelle du point
   * @param deltaTime - Pas de temps entre les frames (en secondes)
   * @returns Vecteur vélocité en m/s
   *
   * @example
   * ```typescript
   * const vel = calculator.calculate(
   *   "line_left_kite",
   *   new THREE.Vector3(0, 10, 0),
   *   1/60 // 60 FPS
   * );
   * ```
   */
  calculate(
    key: string,
    currentPos: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    // Récupérer position précédente
    const prevPos = this.previousPositions.get(key);

    // Si pas d'historique ou deltaTime invalide, retourner vélocité nulle
    if (!prevPos || deltaTime <= 0) {
      // Mémoriser position actuelle pour prochain frame
      this.previousPositions.set(key, currentPos.clone());
      return new THREE.Vector3();
    }

    // Calculer vélocité par différence finie
    const velocity = currentPos.clone().sub(prevPos).divideScalar(deltaTime);

    // Mémoriser position actuelle pour prochain frame
    this.previousPositions.set(key, currentPos.clone());

    return velocity;
  }

  /**
   * Calcule la vélocité relative entre deux points (utilisé par LineSystem)
   *
   * Cette version calcule la différence de vélocité entre deux points,
   * utile pour calculer la vitesse relative d'une ligne qui relie deux objets.
   *
   * v_relative = v_point1 - v_point2
   *
   * @param keyPoint1 - Identifiant unique du premier point
   * @param keyPoint2 - Identifiant unique du second point
   * @param currentPos1 - Position actuelle du premier point
   * @param currentPos2 - Position actuelle du second point
   * @param deltaTime - Pas de temps entre les frames (en secondes)
   * @returns Vélocité relative entre les deux points
   *
   * @example
   * ```typescript
   * const velRelative = calculator.calculateRelative(
   *   "kite", "bar",
   *   kitePos, barPos,
   *   1/60
   * );
   * ```
   */
  calculateRelative(
    keyPoint1: string,
    keyPoint2: string,
    currentPos1: THREE.Vector3,
    currentPos2: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    const vel1 = this.calculate(keyPoint1, currentPos1, deltaTime);
    const vel2 = this.calculate(keyPoint2, currentPos2, deltaTime);

    // Vélocité relative = différence des vélocités
    return new THREE.Vector3().subVectors(vel1, vel2);
  }

  /**
   * Réinitialise l'historique pour une clé donnée
   *
   * Utile quand on change drastiquement la position d'un objet
   * (ex: reset de simulation)
   *
   * @param key - Identifiant du point à réinitialiser
   */
  reset(key: string): void {
    this.previousPositions.delete(key);
  }

  /**
   * Réinitialise tout l'historique
   *
   * Utile pour reset complet de la simulation
   */
  resetAll(): void {
    this.previousPositions.clear();
  }

  /**
   * Retourne le nombre de points suivis
   *
   * Utile pour debug/monitoring
   */
  getTrackedCount(): number {
    return this.previousPositions.size;
  }
}
