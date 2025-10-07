/**
 * PhysicsEngine.ts - Moteur physique principal de la simulation Kite
 *
 * Rôle :
 *   - Orchestration de tous les calculs physiques du cerf-volant (vent, lignes, forces, contrôles)
 *   - Point d'entrée pour la boucle de simulation physique (appelé à chaque frame)
 *   - Centralise l'accès aux sous-modules physiques
 *
 * Dépendances principales :
 *   - WindSimulator.ts : Simulation du vent et turbulences
 *   - LineSystem.ts : Calcul des tensions et contraintes des lignes
 *   - AerodynamicsCalculator.ts : Calcul des forces aérodynamiques
 *   - KiteController.ts : Gestion de l'état physique du cerf-volant
 *   - ControlBarManager.ts : Gestion de la barre de contrôle du pilote
 *   - SimulationConfig.ts : Paramètres globaux de la simulation
 *   - Kite.ts : Modèle 3D et points anatomiques du cerf-volant
 *
 * Relation avec les fichiers adjacents :
 *   - Tous les fichiers du dossier 'physics' sont des sous-modules utilisés par PhysicsEngine
 *   - Les modules 'controllers' et 'objects' sont utilisés pour manipuler le kite et la barre
 *
 * Utilisation typique :
 *   - Instancié au démarrage, appelé à chaque frame pour mettre à jour la physique
 *   - Sert d'API centrale pour accéder à l'état physique du kite
 *
 * Voir aussi :
 *   - src/simulation/physics/WindSimulator.ts
 *   - src/simulation/physics/LineSystem.ts
 *   - src/simulation/physics/AerodynamicsCalculator.ts
 *   - src/simulation/controllers/KiteController.ts
 *   - src/objects/organic/Kite.ts
 */
import * as THREE from "three";
import { Kite } from "../../objects/organic/Kite";
import { WindSimulator } from "./WindSimulator";
import { LineSystem } from "./LineSystem";
import { BridleSystem } from "./BridleSystem";
import { AerodynamicsCalculator } from "./AerodynamicsCalculator";
import { KiteController } from "../controllers/KiteController";
import { ControlBarManager } from "../controllers/ControlBarManager";
import { WindParams } from "../types";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Moteur physique principal
 *
 * Orchestre toutes les simulations physiques du cerf-volant
 */
export class PhysicsEngine {
  private windSimulator: WindSimulator;
  private lineSystem: LineSystem;
  private bridleSystem: BridleSystem;
  private kiteController: KiteController;
  private controlBarManager: ControlBarManager;

  constructor(kite: Kite, controlBarPosition: THREE.Vector3) {
    this.windSimulator = new WindSimulator();
    this.lineSystem = new LineSystem();
    this.bridleSystem = new BridleSystem(kite.getBridleLengths());
    this.kiteController = new KiteController(kite);
    this.controlBarManager = new ControlBarManager(controlBarPosition);
  }

  /**
   * LE CŒUR DE LA SIMULATION - Appelée 60 fois par seconde
   *
   * C'est ici que tout se passe ! Cette fonction orchestre toute la physique.
   *
   * VOICI CE QUI SE PASSE À CHAQUE INSTANT :
   * 1. On regarde comment la barre est tournée
   * 2. On calcule où sont les mains du pilote
   * 3. On calcule le vent que ressent le kite
   * 4. On calcule toutes les forces :
   *    - Le vent qui pousse
   *    - Les lignes qui tirent
   *    - La gravité qui attire vers le bas
   * 5. On fait bouger le kite selon ces forces
   *
   * C'est comme une boucle infinie qui simule la réalité !
   */
  update(
    deltaTime: number,
    targetBarRotation: number,
    isPaused: boolean = false
  ): void {
    // Si en pause, ne rien faire
    if (isPaused) return;

    // Limiter le pas de temps pour éviter l'instabilité numérique
    deltaTime = Math.min(deltaTime, CONFIG.physics.deltaTimeMax);

    // Interpoler la rotation de la barre (lissage des commandes)
    const currentRotation = this.controlBarManager.getRotation();
    const newRotation = currentRotation + (targetBarRotation - currentRotation);
    this.controlBarManager.setRotation(newRotation);

    // Récupérer l'état actuel du système
    const kite = this.kiteController.getKite();
    const handles = this.controlBarManager.getHandlePositions(kite.position);

    // Vent apparent = vent réel - vitesse du kite (principe de relativité)
    const kiteState = this.kiteController.getState();
    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      deltaTime
    );

    // PHYSIQUE ÉMERGENTE : Forces aéro + gravité distribuée calculées par surface
    // - Chaque surface porte une fraction de la masse (fabric + frame + accessoires)
    // - Gravité appliquée au centre géométrique de chaque surface
    // - Le couple gravitationnel émerge naturellement de r × F_gravity
    // - Le couple total émerge de la différence gauche/droite naturelle
    const {
      lift,
      drag,
      gravity,  // 🔴 BUG FIX #1 : Gravité retournée séparément (purement verticale)
      torque: totalTorque,  // Inclut déjà couple aéro + couple gravitationnel !
    } = AerodynamicsCalculator.calculateForces(apparentWind, kite.quaternion);

    // CALCUL DES TENSIONS (pour affichage/debug uniquement)
    // Les lignes ne TIRENT PAS le kite - elles le RETIENNENT à distance max
    // La contrainte géométrique est appliquée par ConstraintSolver dans KiteController
    const pilotPosition = this.controlBarManager.getPosition();
    this.lineSystem.calculateLineTensions(kite, newRotation, pilotPosition);

    // CALCUL DES TENSIONS DES BRIDES (pour affichage/debug uniquement)
    // Les brides sont des contraintes INTERNES au kite
    // Les contraintes géométriques sont appliquées par ConstraintSolver.enforceBridleConstraints()
    const bridleTensions = this.bridleSystem.calculateBridleTensions(kite);

    // Mettre à jour la visualisation des brides selon leurs tensions
    kite.updateBridleVisualization(bridleTensions);

    // 🔴 BUG FIX #1 : Somme vectorielle CORRECTE des forces (2ème loi de Newton)
    // Maintenant lift et drag sont PUREMENT aérodynamiques
    // Gravité est ajoutée séparément (pas mélangée dans lift/drag)
    const totalForce = new THREE.Vector3()
      .add(lift)     // Portance aérodynamique (perpendiculaire au vent)
      .add(drag)     // Traînée aérodynamique (parallèle au vent)
      .add(gravity); // Gravité (purement verticale, non décomposée)
      // PAS de forces de lignes - elles sont des contraintes géométriques

    // Couple total = moment aérodynamique + moment gravitationnel (émergent)
    // Les lignes n'appliquent PAS de couple - elles contraignent la position
    // L'orientation émerge de l'équilibre des forces distribuées + contraintes

    // Intégration physique : F=ma et T=Iα pour calculer nouvelle position/orientation
    this.kiteController.update(totalForce, totalTorque, handles, deltaTime);
  }

  setBridleFactor(_factor: number): void {
    // Fonctionnalité désactivée dans V8 - physique émergente pure
  }

  /**
   * Ajuste une longueur de bride physique (en mètres)
   * @param bridleName - 'nez', 'inter' ou 'centre'
   * @param length - longueur en mètres
   */
  setBridleLength(bridleName: 'nez' | 'inter' | 'centre', length: number): void {
    this.kiteController.getKite().setBridleLengths({ [bridleName]: length });
  }

  setWindParams(params: Partial<WindParams>): void {
    this.windSimulator.setParams(params);
  }

  setLineLength(length: number): void {
    this.lineSystem.setLineLength(length);
    this.kiteController.setLineLength(length);
  }

  getKiteController(): KiteController {
    return this.kiteController;
  }

  getWindSimulator(): WindSimulator {
    return this.windSimulator;
  }

  getLineSystem(): LineSystem {
    return this.lineSystem;
  }

  getControlBarManager(): ControlBarManager {
    return this.controlBarManager;
  }

  /**
   * Retourne les longueurs actuelles des brides du kite
   */
  getBridleLengths() {
    return this.kiteController.getKite().getBridleLengths();
  }

  /**
   * Définit le taux de lissage des forces (en 1/s)
   */
  setForceSmoothing(rate: number): void {
    this.kiteController.setForceSmoothing(rate);
  }

  /**
   * Retourne le taux de lissage des forces actuel
   */
  getForceSmoothing(): number {
    return this.kiteController.getForceSmoothing();
  }
}