/**
 * BridleSystem.ts - Orchestrateur du système de bridage du cerf-volant
 *
 * Rôle :
 *   - Coordonne les 6 brides (3 gauches + 3 droites)
 *   - Calcule les tensions pour affichage/debug (pas de forces appliquées)
 *   - Les contraintes de distance sont gérées par ConstraintSolver
 *
 * IMPORTANT : Les brides sont des CONTRAINTES, pas des ressorts !
 *   - Elles RETIENNENT les points d'attache (distance max)
 *   - Elles ne TIRENT PAS les points les uns vers les autres
 *   - Le ConstraintSolver.enforceBridleConstraints() gère la contrainte géométrique
 *
 * Architecture :
 *   - Similar à LineSystem mais pour les brides internes au kite
 *   - Réutilise LinePhysics pour les calculs de tension
 *   - Les 6 brides sont des instances Line indépendantes
 *
 * Relation avec les autres modules :
 *   - Utilise BridleFactory pour créer les brides
 *   - Utilise LinePhysics pour calculer tensions
 *   - Utilisé par PhysicsEngine
 *   - Les contraintes sont appliquées dans ConstraintSolver
 *
 * Voir aussi :
 *   - src/simulation/physics/LineSystem.ts (pattern similaire)
 *   - src/factories/BridleFactory.ts
 *   - src/simulation/physics/ConstraintSolver.ts
 */

import * as THREE from "three";
import { Kite } from "@objects/organic/Kite";
import { Line } from "@objects/mechanical/Line";
import { LinePhysics } from "./LinePhysics";
import { BridleFactory } from "@factories/BridleFactory";
import { BridleLengths, BridleTensions } from "../types/BridleTypes";

/**
 * Système de gestion des brides
 *
 * Gère les 6 brides qui relient les points anatomiques du kite
 * aux points de contrôle (CTRL_GAUCHE, CTRL_DROIT).
 */
export class BridleSystem {
  // Brides gauches (3)
  private leftNez: Line;
  private leftInter: Line;
  private leftCentre: Line;

  // Brides droites (3)
  private rightNez: Line;
  private rightInter: Line;
  private rightCentre: Line;

  // Service de calcul physique (réutilisé)
  private physics: LinePhysics;

  // Positions précédentes pour calcul vélocité
  private previousPositions: Map<string, THREE.Vector3> = new Map();

  constructor(bridleLengths: BridleLengths) {
    // Valider les longueurs
    BridleFactory.validateBridleLengths(bridleLengths);

    // Créer les 6 brides via factory
    const { left, right } = BridleFactory.createAllBridles(bridleLengths);

    // Assigner brides gauches
    [this.leftNez, this.leftInter, this.leftCentre] = left;

    // Assigner brides droites
    [this.rightNez, this.rightInter, this.rightCentre] = right;

    // Service de calcul physique
    this.physics = new LinePhysics();
  }

  /**
   * Calcule les tensions de toutes les brides
   *
   * Note : Ces tensions sont calculées pour affichage/debug uniquement.
   * Les brides sont des contraintes géométriques gérées par ConstraintSolver,
   * elles n'appliquent PAS de forces au kite.
   *
   * @param kite - Instance du cerf-volant
   * @returns Tensions des 6 brides (Newtons)
   */
  calculateBridleTensions(kite: Kite): BridleTensions {
    const deltaTime = 1 / 60; // Approximation pour calcul vélocité

    // Calculer tension bride gauche NEZ
    const leftNezTension = this.calculateSingleBridleTension(
      kite,
      this.leftNez,
      "NEZ",
      "CTRL_GAUCHE",
      deltaTime
    );

    // Calculer tension bride gauche INTER
    const leftInterTension = this.calculateSingleBridleTension(
      kite,
      this.leftInter,
      "INTER_GAUCHE",
      "CTRL_GAUCHE",
      deltaTime
    );

    // Calculer tension bride gauche CENTRE
    const leftCentreTension = this.calculateSingleBridleTension(
      kite,
      this.leftCentre,
      "CENTRE",
      "CTRL_GAUCHE",
      deltaTime
    );

    // Calculer tension bride droite NEZ
    const rightNezTension = this.calculateSingleBridleTension(
      kite,
      this.rightNez,
      "NEZ",
      "CTRL_DROIT",
      deltaTime
    );

    // Calculer tension bride droite INTER
    const rightInterTension = this.calculateSingleBridleTension(
      kite,
      this.rightInter,
      "INTER_DROIT",
      "CTRL_DROIT",
      deltaTime
    );

    // Calculer tension bride droite CENTRE
    const rightCentreTension = this.calculateSingleBridleTension(
      kite,
      this.rightCentre,
      "CENTRE",
      "CTRL_DROIT",
      deltaTime
    );

    return {
      leftNez: leftNezTension,
      leftInter: leftInterTension,
      leftCentre: leftCentreTension,
      rightNez: rightNezTension,
      rightInter: rightInterTension,
      rightCentre: rightCentreTension,
    };
  }

  /**
   * Calcule la tension d'une bride individuelle
   *
   * @param kite - Instance du cerf-volant
   * @param bridle - Instance Line de la bride
   * @param startPointName - Nom du point de départ (ex: "NEZ")
   * @param endPointName - Nom du point d'arrivée (ex: "CTRL_GAUCHE")
   * @param deltaTime - Pas de temps pour calcul vélocité
   * @returns Tension en Newtons
   */
  private calculateSingleBridleTension(
    kite: Kite,
    bridle: Line,
    startPointName: string,
    endPointName: string,
    deltaTime: number
  ): number {
    // Récupérer positions locales
    const startLocal = kite.getPoint(startPointName);
    const endLocal = kite.getPoint(endPointName);

    if (!startLocal || !endLocal) {
      console.warn(`⚠️ Points bride introuvables: ${startPointName} ou ${endPointName}`);
      return 0;
    }

    // Convertir en coordonnées monde
    const startWorld = startLocal
      .clone()
      .applyQuaternion(kite.quaternion)
      .add(kite.position);

    const endWorld = endLocal
      .clone()
      .applyQuaternion(kite.quaternion)
      .add(kite.position);

    // Calculer vélocité relative
    const velocity = this.calculateVelocity(
      startWorld,
      endWorld,
      startPointName,
      endPointName,
      deltaTime
    );

    // Calculer tension via LinePhysics
    const result = this.physics.calculateTensionForce(
      bridle,
      startWorld,
      endWorld,
      velocity
    );

    // Mettre à jour l'état de la bride
    bridle.updateState(result.currentLength, result.tension, performance.now());

    return result.tension;
  }

  /**
   * Calcule la vélocité relative entre deux points
   *
   * @param currentStart - Position actuelle point départ (monde)
   * @param currentEnd - Position actuelle point arrivée (monde)
   * @param startKey - Clé unique point départ
   * @param endKey - Clé unique point arrivée
   * @param deltaTime - Pas de temps
   * @returns Vecteur vélocité relative
   */
  private calculateVelocity(
    currentStart: THREE.Vector3,
    currentEnd: THREE.Vector3,
    startKey: string,
    endKey: string,
    deltaTime: number
  ): THREE.Vector3 {
    const key = `${startKey}_${endKey}`;
    const prevStart = this.previousPositions.get(`${key}_start`);
    const prevEnd = this.previousPositions.get(`${key}_end`);

    let velocity = new THREE.Vector3();

    if (prevStart && prevEnd) {
      // Vélocité point départ
      const velStart = currentStart.clone().sub(prevStart).divideScalar(deltaTime);
      // Vélocité point arrivée
      const velEnd = currentEnd.clone().sub(prevEnd).divideScalar(deltaTime);
      // Vélocité relative
      velocity = velStart.sub(velEnd);
    }

    // Mémoriser positions actuelles
    this.previousPositions.set(`${key}_start`, currentStart.clone());
    this.previousPositions.set(`${key}_end`, currentEnd.clone());

    return velocity;
  }

  /**
   * Met à jour les longueurs des brides
   *
   * @param newLengths - Nouvelles longueurs (partial update)
   */
  setBridleLengths(newLengths: Partial<BridleLengths>): void {
    // Note: Pour l'instant, les brides sont immutables après création.
    // Pour changer les longueurs, il faudrait recréer les instances Line.
    // Cette méthode est un placeholder pour future implémentation.
    console.warn("⚠️ BridleSystem.setBridleLengths() not yet implemented");
    console.log("   Nouvelles longueurs demandées:", newLengths);
  }

  /**
   * Obtient les longueurs actuelles des brides
   *
   * @returns BridleLengths actuelles
   */
  getBridleLengths(): BridleLengths {
    return {
      nez: this.leftNez.config.length,
      inter: this.leftInter.config.length,
      centre: this.leftCentre.config.length,
    };
  }

  /**
   * Obtient toutes les instances Line des brides
   * (utile pour ConstraintSolver)
   *
   * @returns Objet contenant les 6 brides
   */
  getAllBridles(): {
    left: { nez: Line; inter: Line; centre: Line };
    right: { nez: Line; inter: Line; centre: Line };
  } {
    return {
      left: {
        nez: this.leftNez,
        inter: this.leftInter,
        centre: this.leftCentre,
      },
      right: {
        nez: this.rightNez,
        inter: this.rightInter,
        centre: this.rightCentre,
      },
    };
  }

  /**
   * Vérifie si une bride est tendue
   *
   * @param side - Côté (left/right)
   * @param position - Position (nez/inter/centre)
   * @returns true si tendue
   */
  isBridleTaut(side: 'left' | 'right', position: 'nez' | 'inter' | 'centre'): boolean {
    const bridleMap = {
      left: { nez: this.leftNez, inter: this.leftInter, centre: this.leftCentre },
      right: { nez: this.rightNez, inter: this.rightInter, centre: this.rightCentre },
    };

    return bridleMap[side][position].isTaut();
  }

  /**
   * Obtient des statistiques sur l'état des brides
   * (utile pour debug/monitoring)
   */
  getStats(): {
    tautCount: number;
    avgTension: number;
    maxTension: number;
    minTension: number;
  } {
    const bridles = [
      this.leftNez,
      this.leftInter,
      this.leftCentre,
      this.rightNez,
      this.rightInter,
      this.rightCentre,
    ];

    const tautCount = bridles.filter(b => b.isTaut()).length;
    const tensions = bridles.map(b => b.getCurrentTension());
    const avgTension = tensions.reduce((sum, t) => sum + t, 0) / tensions.length;
    const maxTension = Math.max(...tensions);
    const minTension = Math.min(...tensions);

    return { tautCount, avgTension, maxTension, minTension };
  }
}
