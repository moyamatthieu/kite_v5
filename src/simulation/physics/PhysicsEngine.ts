/**
 * PhysicsEngine.ts - Moteur physique principal de la simulation Kite
 *
 * Rôle :
 *   - Orchestration de tou    // C      gravity,  // Gravité distribuée par surfacelcul des forces aérodynamiques et gravitationnelles distribuées calculs physiques du cerf-volant (vent, lignes, forces, contrôles)
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

import { Kite } from "../../objects/Kite";
import { KiteController } from "../controllers/KiteController";
import { ControlBarManager } from "../controllers/ControlBarManager";
import { WindParams } from "../types";
import { CONFIG } from "../config/SimulationConfig";

import { WindSimulator } from "./WindSimulator";
import { LineSystem } from "./LineSystem";
import { BridleSystem } from "./BridleSystem";
import { AerodynamicsCalculator } from "./AerodynamicsCalculator";

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
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log toutes les 1000ms (1 seconde)
  private startTime: number = Date.now(); // Temps de démarrage pour elapsed time
  private frameCount: number = 0; // Compteur de frames

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

    // Appliquer directement la rotation de la barre (pas de lissage, déjà géré par InputHandler)
    this.controlBarManager.setRotation(targetBarRotation);

    // Récupérer l'état actuel du système
    const kite = this.kiteController.getKite();
    const handles = this.controlBarManager.getHandlePositions(kite.position);

    // Vent apparent = vent réel - vitesse du kite (principe de relativité)
    const kiteState = this.kiteController.getState();

    // 🔍 DEBUG: Vérifier la vitesse du kite pour comprendre le vent apparent faible - DISABLED for performance


    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      deltaTime
    );


    // � PHYSIQUE ÉMERGENTE : Forces aéro + gravité distribuée calculées par surface
    // - Chaque surface porte une fraction de la masse (fabric + frame + accessoires)
    // - Gravité appliquée au centre géométrique de chaque surface
    // - Le couple gravitationnel émerge naturellement de r × F_gravity
    // - Le couple total émerge de la différence gauche/droite naturelle
    const {
      lift,
      drag,
      gravity,  // � RESTAURÉ : Gravité distribuée (plus réaliste physiquement)
      torque: totalTorque,  // Inclut déjà couple aéro + couple gravitationnel !
    } = AerodynamicsCalculator.calculateForces(
      apparentWind, 
      kite.quaternion,
      kite.position,
      kiteState.velocity,
      kiteState.angularVelocity
    );

    this.kiteController.setAerodynamicSnapshot(lift, drag);

    // CALCUL DES TENSIONS (pour affichage/debug uniquement)
    // Les lignes ne TIRENT PAS le kite - elles le RETIENNENT à distance max
    // La contrainte géométrique est appliquée par ConstraintSolver dans KiteController
  this.lineSystem.calculateLineTensions(kite, handles, deltaTime);

    // CALCUL DES TENSIONS DES BRIDES (pour affichage/debug uniquement)
    // Les brides sont des contraintes INTERNES au kite
    // Les contraintes géométriques sont appliquées par ConstraintSolver.enforceBridleConstraints()
    const bridleTensions = this.bridleSystem.calculateBridleTensions(kite);

    // Incrémenter le compteur de frames
    this.frameCount++;

    // 📊 LOG COMPLET toutes les secondes
    const currentTime = Date.now();
    if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
      this.lastLogTime = currentTime;
      this.logPhysicsState(kite, kiteState, apparentWind, lift, drag, gravity, totalTorque, bridleTensions, deltaTime, currentTime);
    }

    // Mettre à jour la visualisation des brides selon leurs tensions
    kite.updateBridleVisualization(bridleTensions);

    // Somme vectorielle des forces (2ème loi de Newton : F = ma)
    const totalForce = new THREE.Vector3()
      .add(lift)     // Portance aérodynamique (perpendiculaire au vent)
      .add(drag)     // Traînée aérodynamique (parallèle au vent)
      .add(gravity); // Gravité distribuée (déjà calculée par surface)
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

  /**
   * Affiche l'état physique complet du kite (appelé toutes les secondes)
   */
  private logPhysicsState(
    kite: Kite,
    kiteState: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    apparentWind: THREE.Vector3,
    lift: THREE.Vector3,
    drag: THREE.Vector3,
    gravity: THREE.Vector3,
    totalTorque: THREE.Vector3,
    bridleTensions: { leftNez: number; rightNez: number; leftInter: number; rightInter: number; leftCentre: number; rightCentre: number },
    deltaTime: number,
    currentTime: number
  ): void {
    // Calculs supplémentaires pour le log
    const elapsedTime = (currentTime - this.startTime) / 1000; // en secondes
    const euler = new THREE.Euler().setFromQuaternion(kite.quaternion, 'XYZ');
    const pitch = euler.x * (180 / Math.PI); // Convertir en degrés
    const roll = euler.z * (180 / Math.PI);
    const yaw = euler.y * (180 / Math.PI);

    // Tensions des lignes
    const lineTensions = this.lineSystem.getTensions();

    // Accélération (approximation : F/m)
    const totalForceCalc = new THREE.Vector3().add(lift).add(drag).add(gravity);
    const acceleration = totalForceCalc.clone().divideScalar(CONFIG.kite.mass);

    // Ratio portance/traînée
    const liftMag = lift.length();
    const dragMag = drag.length();
    const ldRatio = dragMag > 0.01 ? liftMag / dragMag : 0;

    console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log(`║ 📊 ÉTAT COMPLET DU KITE - Frame #${this.frameCount.toString().padStart(6, '0')}                              ║`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ ⏱️  Temps: ${elapsedTime.toFixed(3)}s | Δt: ${(deltaTime * 1000).toFixed(2)}ms | FPS: ${(1/deltaTime).toFixed(1)}    ║`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ 📍 POSITION & ORIENTATION                                                 ║`);
    console.log(`║    Position: (${kite.position.x.toFixed(2)}, ${kite.position.y.toFixed(2)}, ${kite.position.z.toFixed(2)}) m`);
    console.log(`║    Distance pilote: ${kite.position.length().toFixed(2)} m`);
    console.log(`║    Angles: Pitch ${pitch.toFixed(1)}° | Roll ${roll.toFixed(1)}° | Yaw ${yaw.toFixed(1)}°`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ 🚀 CINÉMATIQUE                                                            ║`);
    console.log(`║    Vitesse: (${kiteState.velocity.x.toFixed(2)}, ${kiteState.velocity.y.toFixed(2)}, ${kiteState.velocity.z.toFixed(2)}) m/s | Mag: ${kiteState.velocity.length().toFixed(2)} m/s`);
    console.log(`║    Accélération: (${acceleration.x.toFixed(2)}, ${acceleration.y.toFixed(2)}, ${acceleration.z.toFixed(2)}) m/s² | Mag: ${acceleration.length().toFixed(2)} m/s²`);
    console.log(`║    Vit. angulaire: (${kiteState.angularVelocity.x.toFixed(2)}, ${kiteState.angularVelocity.y.toFixed(2)}, ${kiteState.angularVelocity.z.toFixed(2)}) rad/s | Mag: ${kiteState.angularVelocity.length().toFixed(2)} rad/s`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ 💨 AÉRODYNAMIQUE                                                          ║`);
    console.log(`║    Vent apparent: (${apparentWind.x.toFixed(2)}, ${apparentWind.y.toFixed(2)}, ${apparentWind.z.toFixed(2)}) m/s | Mag: ${apparentWind.length().toFixed(2)} m/s`);
    console.log(`║    Portance: (${lift.x.toFixed(2)}, ${lift.y.toFixed(2)}, ${lift.z.toFixed(2)}) N | Mag: ${liftMag.toFixed(2)} N`);
    console.log(`║    Traînée: (${drag.x.toFixed(2)}, ${drag.y.toFixed(2)}, ${drag.z.toFixed(2)}) N | Mag: ${dragMag.toFixed(2)} N`);
    console.log(`║    Ratio L/D: ${ldRatio.toFixed(2)}`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ ⚖️  FORCES & COUPLES                                                       ║`);
    console.log(`║    Gravité: (${gravity.x.toFixed(2)}, ${gravity.y.toFixed(2)}, ${gravity.z.toFixed(2)}) N | Mag: ${gravity.length().toFixed(2)} N`);
    console.log(`║    Force totale: (${totalForceCalc.x.toFixed(2)}, ${totalForceCalc.y.toFixed(2)}, ${totalForceCalc.z.toFixed(2)}) N | Mag: ${totalForceCalc.length().toFixed(2)} N`);
    console.log(`║    Couple total: (${totalTorque.x.toFixed(2)}, ${totalTorque.y.toFixed(2)}, ${totalTorque.z.toFixed(2)}) N⋅m | Mag: ${totalTorque.length().toFixed(2)} N⋅m`);
    console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ 🪢 TENSIONS                                                                ║`);
    console.log(`║    Ligne gauche: ${lineTensions.left.toFixed(2)} N | Ligne droite: ${lineTensions.right.toFixed(2)} N`);
    console.log(`║    Asymétrie: ${(lineTensions.left - lineTensions.right).toFixed(2)} N (${((lineTensions.left - lineTensions.right) / Math.max(lineTensions.left, lineTensions.right) * 100).toFixed(1)}%)`);
    console.log(`║    Brides: NEZ L/R: ${bridleTensions.leftNez.toFixed(1)}/${bridleTensions.rightNez.toFixed(1)} N`);
    console.log(`║            INTER L/R: ${bridleTensions.leftInter.toFixed(1)}/${bridleTensions.rightInter.toFixed(1)} N`);
    console.log(`║            CENTRE L/R: ${bridleTensions.leftCentre.toFixed(1)}/${bridleTensions.rightCentre.toFixed(1)} N`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  }
}