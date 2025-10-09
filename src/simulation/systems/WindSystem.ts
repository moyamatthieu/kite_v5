/**
 * WindSystem.ts - Système de simulation du vent
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';
import { MathUtils } from '../../utils/MathUtils';
import { PHYSICAL_CONSTANTS } from '../../factories/presets/PhysicalPresets';

export interface WindState {
  baseDirection: THREE.Vector3; // Direction principale du vent
  baseSpeed: number; // Vitesse de base du vent (m/s)
  turbulence: number; // Intensité de la turbulence (0-1)
  gustFrequency: number; // Fréquence des rafales (Hz)
  gustAmplitude: number; // Amplitude des rafales
  time: number; // Temps écoulé pour l'animation
}

export interface WindConfig {
  baseSpeed: number;
  baseDirection: THREE.Vector3;
  turbulenceEnabled: boolean;
  turbulenceIntensity: number;
  gustsEnabled: boolean;
  gustFrequency: number;
  gustAmplitude: number;
  windShearEnabled: boolean; // Variation de vitesse avec l'altitude
  updateFrequency: number; // Fréquence de mise à jour (Hz)
}

export class WindSystem extends BaseSimulationSystem {
  private logger: Logger;
  private windState: WindState;
  private config: WindConfig;
  private lastUpdateTime: number = 0;

  constructor(config: Partial<WindConfig> = {}) {
    super('WindSystem', 5); // Priorité 5 (avant la physique)

    this.logger = Logger.getInstance();
    this.config = {
      baseSpeed: 5.0, // 5 m/s vent léger
      baseDirection: new THREE.Vector3(1, 0, 0), // Vent venant de l'est
      turbulenceEnabled: true,
      turbulenceIntensity: 0.3,
      gustsEnabled: true,
      gustFrequency: 0.1, // Une rafale toutes les 10 secondes
      gustAmplitude: 2.0,
      windShearEnabled: true,
      updateFrequency: 10, // 10 Hz
      ...config
    };

    // Normaliser la direction
    this.config.baseDirection.normalize();

    this.windState = {
      baseDirection: this.config.baseDirection.clone(),
      baseSpeed: this.config.baseSpeed,
      turbulence: this.config.turbulenceIntensity,
      gustFrequency: this.config.gustFrequency,
      gustAmplitude: this.config.gustAmplitude,
      time: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('WindSystem initialized', 'WindSystem');
  }

  update(context: SimulationContext): void {
    // Mise à jour périodique pour éviter les calculs trop fréquents
    if (context.totalTime - this.lastUpdateTime < 1.0 / this.config.updateFrequency) {
      return;
    }

    this.lastUpdateTime = context.totalTime;
    this.windState.time = context.totalTime;

    // Calculer le vent apparent avec turbulence et rafales
    this.updateWindState(context.deltaTime);
  }

  /**
   * Met à jour l'état du vent avec turbulence et rafales
   */
  private updateWindState(deltaTime: number): void {
    // Direction de base (peut être modifiée par des facteurs externes)
    this.windState.baseDirection.copy(this.config.baseDirection);

    // Ajouter turbulence si activée
    if (this.config.turbulenceEnabled) {
      this.addTurbulence(deltaTime);
    }

    // Ajouter rafales si activées
    if (this.config.gustsEnabled) {
      this.addGustEffect(deltaTime);
    }

    // Normaliser la direction après modifications
    this.windState.baseDirection.normalize();
  }

  /**
   * Ajoute de la turbulence au vent
   */
  private addTurbulence(deltaTime: number): void {
    // Générer du bruit pseudo-aléatoire basé sur le temps
    const noiseX = Math.sin(this.windState.time * 2.1) * Math.cos(this.windState.time * 1.3);
    const noiseY = Math.sin(this.windState.time * 1.7) * Math.cos(this.windState.time * 2.4);
    const noiseZ = Math.sin(this.windState.time * 1.9) * Math.cos(this.windState.time * 1.8);

    // Appliquer l'intensité de la turbulence
    const turbulenceVector = new THREE.Vector3(noiseX, noiseY, noiseZ);
    turbulenceVector.multiplyScalar(this.config.turbulenceIntensity * 0.1);

    // Ajouter à la direction
    this.windState.baseDirection.add(turbulenceVector);
  }

  /**
   * Ajoute l'effet des rafales
   */
  private addGustEffect(deltaTime: number): void {
    // Calculer l'amplitude de la rafale actuelle
    const gustPhase = Math.sin(this.windState.time * this.config.gustFrequency * Math.PI * 2);
    const gustStrength = Math.max(0, gustPhase) * this.config.gustAmplitude;

    // Rafales principalement dans la direction du vent
    const gustVector = this.config.baseDirection.clone();
    gustVector.multiplyScalar(gustStrength * 0.1);

    this.windState.baseDirection.add(gustVector);
  }

  /**
   * Calcule le vent apparent à une position donnée
   * @param position Position dans l'espace 3D
   * @param objectVelocity Vitesse de l'objet (pour vent relatif)
   * @returns Vecteur vent apparent
   */
  getApparentWind(position: THREE.Vector3, objectVelocity: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    // Vent de base
    let wind = this.windState.baseDirection.clone();
    wind.multiplyScalar(this.windState.baseSpeed);

    // Ajouter cisaillement du vent (variation avec l'altitude)
    if (this.config.windShearEnabled) {
      wind = this.applyWindShear(wind, position.y);
    }

    // Vent apparent = vent absolu - vitesse de l'objet
    const apparentWind = wind.clone();
    apparentWind.sub(objectVelocity);

    return apparentWind;
  }

  /**
   * Applique le cisaillement du vent (variation avec l'altitude)
   */
  private applyWindShear(wind: THREE.Vector3, altitude: number): THREE.Vector3 {
    // Le vent augmente avec l'altitude selon une loi logarithmique simplifiée
    // En réalité, c'est plus complexe, mais cette approximation suffit
    const shearFactor = Math.max(0.5, Math.log(Math.max(1, altitude + 1)) * 0.3 + 0.7);

    const shearedWind = wind.clone();
    shearedWind.multiplyScalar(shearFactor);

    return shearedWind;
  }

  /**
   * Obtient l'état actuel du vent
   */
  getWindState(): Readonly<WindState> {
    return this.windState;
  }

  /**
   * Modifie la direction du vent
   */
  setWindDirection(direction: THREE.Vector3): void {
    this.config.baseDirection.copy(direction);
    this.config.baseDirection.normalize();
    this.windState.baseDirection.copy(this.config.baseDirection);
  }

  /**
   * Modifie la vitesse du vent
   */
  setWindSpeed(speed: number): void {
    this.config.baseSpeed = Math.max(0, speed);
    this.windState.baseSpeed = this.config.baseSpeed;
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): Readonly<WindConfig> {
    return this.config;
  }

  reset(): void {
    this.windState.time = 0;
    this.windState.baseDirection.copy(this.config.baseDirection);
    this.windState.baseSpeed = this.config.baseSpeed;
    this.lastUpdateTime = 0;
    this.logger.info('WindSystem reset', 'WindSystem');
  }

  dispose(): void {
    // Pas de ressources spécifiques à nettoyer
    this.logger.info('WindSystem disposed', 'WindSystem');
  }
}