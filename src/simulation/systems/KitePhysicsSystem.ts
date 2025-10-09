/**
 * KitePhysicsSystem.ts - Système physique complet pour le kite
 *
 * Intègre tous les composants physiques existants dans l'architecture ECS:
 * - WindSimulator (vent apparent)
 * - AerodynamicsCalculator (forces aéro)
 * - LineSystem (contraintes lignes)
 * - BridleSystem (contraintes brides)
 * - ConstraintSolver (PBD)
 * - KiteController (intégration)
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';

// Import des composants physiques existants
import { Kite } from '../../objects/organic/Kite';
import { WindSimulator } from '../physics/WindSimulator';
import { LineSystem } from '../physics/LineSystem';
import { BridleSystem } from '../physics/BridleSystem';
import { AerodynamicsCalculator } from '../physics/AerodynamicsCalculator';
import { KiteController } from '../controllers/KiteController';
import { ControlBarManager } from '../controllers/ControlBarManager';
import { CONFIG } from '../config/SimulationConfig';

export interface KitePhysicsConfig {
  windSpeed: number; // km/h
  windDirection: number; // degrés
  turbulence: number; // 0-100
  lineLength: number;
  pilotPosition: THREE.Vector3;
  enableConstraints: boolean;
  enableAerodynamics: boolean;
  enableGravity: boolean;
}

/**
 * Système physique complet du kite
 * Intègre tous les sous-systèmes dans une architecture cohérente
 */
export class KitePhysicsSystem extends BaseSimulationSystem {
  private logger: Logger;
  private config: KitePhysicsConfig;

  // Composants physiques
  private windSimulator!: WindSimulator;
  private lineSystem!: LineSystem;
  private bridleSystem!: BridleSystem;
  private kiteController!: KiteController;
  private controlBarManager!: ControlBarManager;

  // Référence au kite
  private kite!: Kite;

  // État de rotation de la barre
  private barRotation: number = 0;

  constructor(config: Partial<KitePhysicsConfig> = {}) {
    super('KitePhysicsSystem', 10);

    this.logger = Logger.getInstance();
    this.config = {
      windSpeed: CONFIG.wind.defaultSpeed, // km/h
      windDirection: CONFIG.wind.defaultDirection, // degrés
      turbulence: CONFIG.wind.defaultTurbulence, // 0-100
      lineLength: CONFIG.lines.defaultLength,
      pilotPosition: CONFIG.controlBar.position.clone(),
      enableConstraints: true,
      enableAerodynamics: true,
      enableGravity: true,
      ...config
    };
  }

  /**
   * Initialise le système avec un kite
   */
  async initialize(kite?: Kite): Promise<void> {
    if (kite) {
      this.kite = kite;
      await this.initializeComponents();
    }

    this.logger.info('KitePhysicsSystem initialized', 'KitePhysicsSystem');
  }

  /**
   * Initialise tous les composants physiques
   */
  private async initializeComponents(): Promise<void> {
    // Créer WindSimulator
    this.windSimulator = new WindSimulator();
    this.windSimulator.setParams({
      speed: this.config.windSpeed,
      direction: this.config.windDirection,
      turbulence: this.config.turbulence
    });

    // Créer LineSystem
    this.lineSystem = new LineSystem(this.config.lineLength);

    // Créer BridleSystem
    this.bridleSystem = new BridleSystem(this.kite.getBridleLengths());

    // Créer KiteController
    this.kiteController = new KiteController(this.kite);

    // Créer ControlBarManager
    this.controlBarManager = new ControlBarManager(this.config.pilotPosition);

    this.logger.info('All physics components initialized', 'KitePhysicsSystem');
  }

  /**
   * Met à jour le kite (doit être appelé avant le premier update)
   */
  setKite(kite: Kite): void {
    this.kite = kite;

    // Réinitialiser les composants avec le nouveau kite
    if (kite) {
      this.initializeComponents();
    }
  }

  /**
   * Définit la rotation de la barre de contrôle
   */
  setBarRotation(rotation: number): void {
    this.barRotation = rotation;
  }

  /**
   * Mise à jour de la physique complète
   */
  update(context: SimulationContext): void {
    if (!this.kite || !this.kiteController) {
      return;
    }

    const deltaTime = Math.min(context.deltaTime, CONFIG.physics.deltaTimeMax);

    // 1. Mettre à jour la rotation de la barre
    this.controlBarManager.setRotation(this.barRotation);

    // 2. Obtenir l'état actuel du kite
    const kiteState = this.kiteController.getState();
    const handles = this.controlBarManager.getHandlePositions(this.kite.position);

    // 3. Calculer le vent apparent (vent réel - vitesse du kite)
    const apparentWind = this.windSimulator.getApparentWind(
      kiteState.velocity,
      deltaTime
    );

    // 4. Calculer les forces aérodynamiques
    const forces = this.config.enableAerodynamics
      ? AerodynamicsCalculator.calculateForces(
          apparentWind,
          this.kite.quaternion,
          this.kite.position,
          kiteState.velocity,
          kiteState.angularVelocity
        )
      : {
          lift: new THREE.Vector3(),
          drag: new THREE.Vector3(),
          gravity: new THREE.Vector3(),
          torque: new THREE.Vector3(),
          surfaceForces: []
        };

    // 5. Calculer les tensions des lignes (pour visualisation)
    this.lineSystem.calculateLineTensions(
      this.kite,
      this.barRotation,
      this.controlBarManager.getPosition()
    );

    // 6. Calculer les tensions des brides (pour visualisation)
    const bridleTensions = this.bridleSystem.calculateBridleTensions(this.kite);

    // 7. Mettre à jour la visualisation des brides
    this.kite.updateBridleVisualization(bridleTensions);

    // 8. Combiner toutes les forces
    const totalForce = new THREE.Vector3()
      .add(forces.lift)
      .add(forces.drag);

    // Ajouter la gravité si activée
    if (this.config.enableGravity && forces.gravity) {
      totalForce.add(forces.gravity);
    }

    // 9. Mettre à jour le contrôleur du kite
    // Note: Le KiteController intègre automatiquement les contraintes via ConstraintSolver
    this.kiteController.update(
      totalForce,
      forces.torque,
      handles,
      deltaTime
    );
  }

  /**
   * Obtient l'état du vent
   */
  getWindState(): any {
    if (!this.windSimulator) return null;

    const params = this.windSimulator.getParams();
    return {
      speed: params.speed / 3.6, // Convertir km/h en m/s pour affichage
      direction: params.direction,
      turbulence: params.turbulence
    };
  }

  /**
   * Obtient l'état du kite
   */
  getKiteState(): any {
    return this.kiteController ? this.kiteController.getState() : null;
  }

  /**
   * Met à jour les paramètres du vent
   */
  setWindParams(params: { speed?: number; direction?: number; turbulence?: number }): void {
    if (!this.windSimulator) return;

    const windParams: any = {};

    if (params.speed !== undefined) {
      windParams.speed = params.speed; // km/h
      this.config.windSpeed = params.speed;
    }
    if (params.direction !== undefined) {
      windParams.direction = params.direction; // degrés
      this.config.windDirection = params.direction;
    }
    if (params.turbulence !== undefined) {
      windParams.turbulence = params.turbulence; // 0-100
      this.config.turbulence = params.turbulence;
    }

    this.windSimulator.setParams(windParams);
  }

  /**
   * Met à jour la longueur des lignes
   */
  setLineLength(length: number): void {
    this.config.lineLength = length;
    if (this.kite) {
      this.kite.userData.lineLength = length;
    }
  }

  /**
   * Met à jour les longueurs des brides
   */
  setBridleLengths(lengths: { nez: number; inter: number; centre: number }): void {
    if (this.kite) {
      this.kite.setBridleLengths(lengths);
      // Recréer le BridleSystem avec les nouvelles longueurs
      this.bridleSystem = new BridleSystem(lengths);
    }
  }

  /**
   * Obtient les statistiques du système
   */
  getStats(): any {
    const kiteState = this.getKiteState();
    const windState = this.getWindState();

    return {
      kite: kiteState,
      wind: windState,
      barRotation: this.barRotation,
      config: this.config
    };
  }

  reset(): void {
    // Reset du kite n'existe pas dans KiteController
    // On recrée simplement le controller
    if (this.kite) {
      this.kiteController = new KiteController(this.kite);
    }

    this.barRotation = 0;

    if (this.controlBarManager) {
      this.controlBarManager.setRotation(0);
    }

    this.logger.info('KitePhysicsSystem reset', 'KitePhysicsSystem');
  }

  dispose(): void {
    // Pas de ressources spécifiques à disposer
    this.logger.info('KitePhysicsSystem disposed', 'KitePhysicsSystem');
  }
}
