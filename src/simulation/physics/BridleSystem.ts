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
import { BridleFactory } from "@factories/BridleFactory";

import { BridleLengths, BridleTensions } from "../types/BridleTypes";

import { LinePhysics } from "./LinePhysics";
import { VelocityCalculator } from "./VelocityCalculator";

import { Line } from "@/objects/Line";
import { Kite } from "@/objects/Kite";

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

  // Services de calcul physique (réutilisés)
  private physics: LinePhysics;
  private velocityCalculator: VelocityCalculator;

  constructor(bridleLengths: BridleLengths) {
    // Valider les longueurs
    BridleFactory.validateBridleLengths(bridleLengths);

    // Créer les 6 brides via factory
    const { left, right } = BridleFactory.createAllBridles(bridleLengths);

    // Assigner brides gauches
    [this.leftNez, this.leftInter, this.leftCentre] = left;

    // Assigner brides droites
    [this.rightNez, this.rightInter, this.rightCentre] = right;

    // Services de calcul physique
    this.physics = new LinePhysics();
    this.velocityCalculator = new VelocityCalculator();
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

    // Configuration des 6 brides avec leur métadonnées
    const bridleConfigs = [
      { line: this.leftNez, start: "NEZ", end: "CTRL_GAUCHE", key: "leftNez" },
      { line: this.leftInter, start: "INTER_GAUCHE", end: "CTRL_GAUCHE", key: "leftInter" },
      { line: this.leftCentre, start: "CENTRE", end: "CTRL_GAUCHE", key: "leftCentre" },
      { line: this.rightNez, start: "NEZ", end: "CTRL_DROIT", key: "rightNez" },
      { line: this.rightInter, start: "INTER_DROIT", end: "CTRL_DROIT", key: "rightInter" },
      { line: this.rightCentre, start: "CENTRE", end: "CTRL_DROIT", key: "rightCentre" },
    ] as const;

    // Calculer toutes les tensions en une passe
    const tensionsMap = new Map<string, number>();
    for (const config of bridleConfigs) {
      const tension = this.calculateSingleBridleTension(
        kite,
        config.line,
        config.start,
        config.end,
        deltaTime
      );
      tensionsMap.set(config.key, tension);
    }

    // Construire le résultat
    return {
      leftNez: tensionsMap.get("leftNez")!,
      leftInter: tensionsMap.get("leftInter")!,
      leftCentre: tensionsMap.get("leftCentre")!,
      rightNez: tensionsMap.get("rightNez")!,
      rightInter: tensionsMap.get("rightInter")!,
      rightCentre: tensionsMap.get("rightCentre")!,
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
    const startWorld = kite.toWorldCoordinates(startLocal);
    const endWorld = kite.toWorldCoordinates(endLocal);

    // Calculer vélocité relative avec VelocityCalculator
    const key = `${startPointName}_${endPointName}`;
    const velocity = this.velocityCalculator.calculateRelative(
      `${key}_start`,
      `${key}_end`,
      startWorld,
      endWorld,
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
   * Met à jour les longueurs des brides
   *
   * @param newLengths - Nouvelles longueurs (partial update)
   * @deprecated Utilisez PhysicsEngine.setBridleLength() à la place
   */
  setBridleLengths(newLengths: Partial<BridleLengths>): void {
    // Note: Les instances Line sont immuables. Pour changer les longueurs,
    // il faut recréer BridleSystem avec les nouvelles longueurs.
    // Cette méthode est dépréciée - utilisez PhysicsEngine.setBridleLength()
    console.warn("⚠️ BridleSystem.setBridleLengths() est déprécié. Utilisez PhysicsEngine.setBridleLength() à la place");
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
