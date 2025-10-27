import { Component } from '../core/Component';
import { Logger } from '../utils/Logging';
import { CONFIG, InputDefaults } from '../config/Config';

/**
 * Snapshot complet de l'état InputComponent pour sérialisation/sauvegarde
 * @export InputState
 */
export interface InputState {
  // === Vent ===
  windSpeed: number;
  windDirection: number;
  windTurbulence: number;

  // === Lignes ===
  constraintMode: 'pbd' | 'spring-force';
  aeroMode: 'perso' | 'nasa';
  lineLength: number;
  bridleNez: number;
  bridleInter: number;
  bridleCentre: number;

  // === Physique ===
  linearDamping: number;
  angularDamping: number;
  meshSubdivisionLevel: number;

  // === Aérodynamique ===
  liftScale: number;
  dragScale: number;
  forceSmoothing: number;

  // === Actions ===
  resetSimulation: boolean;
  isPaused: boolean;
  debugMode: boolean;
  showNormals: boolean;

  // === Contrôle ===
  barRotationInput: number;
}

/**
 * Contient l'état des entrées utilisateur provenant de l'interface.
 * Les systèmes liront ce composant pour ajuster la simulation.
 */
export class InputComponent extends Component {
  public static readonly type = 'Input';
  public readonly type = 'Input';

  private logger = Logger.getInstance();
  
  // === Vent ===
  windSpeed: number; // m/s
  windDirection: number; // degrés
  windTurbulence: number; // %

  // === Lignes (avec backing fields pour détection de changements) ===
  private _constraintMode: 'pbd' | 'spring-force' = CONFIG.modes.constraint;
  private _aeroMode: 'perso' | 'nasa' = CONFIG.modes.aero;

  get constraintMode(): 'pbd' | 'spring-force' {
    return this._constraintMode;
  }

  set constraintMode(value: 'pbd' | 'spring-force') {
    if (this._constraintMode !== value) {
      const oldMode = this._constraintMode;
      this._constraintMode = value;
      this.logger.info(`📋 Constraint mode changed: ${oldMode} → ${value}`, 'InputComponent');
    }
  }

  get aeroMode(): 'perso' | 'nasa' {
    return this._aeroMode;
  }

  set aeroMode(value: 'perso' | 'nasa') {
    if (this._aeroMode !== value) {
      const oldMode = this._aeroMode;
      this._aeroMode = value;
      this.logger.info(`🌪️  Aero mode changed: ${oldMode} → ${value}`, 'InputComponent');
    }
  }
  lineLength: number; // m
  bridleNez: number; // m
  bridleInter: number; // m
  bridleCentre: number; // m

  // === Physique ===
  linearDamping: number;
  angularDamping: number;
  meshSubdivisionLevel: number;

  // === Aérodynamique ===
  liftScale: number;
  dragScale: number;
  forceSmoothing: number;

  // === Actions (déclencheurs) ===
  resetSimulation: boolean = false;
  isPaused: boolean = false; // true = en pause, false = en cours d'exécution
  debugMode: boolean = false;
  showNormals: boolean = false; // Afficher les vecteurs normaux des faces

  // === Contrôle barre (clavier) ===
  barRotationInput: number = 0; // -1 = gauche, 0 = neutre, 1 = droite

  constructor(initialValues: Partial<InputComponent> = {}) {
    super();
    // Vent
    this.windSpeed = initialValues.windSpeed ?? CONFIG.wind.speed;
    this.windDirection = initialValues.windDirection ?? CONFIG.wind.direction;
    this.windTurbulence = initialValues.windTurbulence ?? CONFIG.wind.turbulence;

    // Lignes - Modes
    this.constraintMode = initialValues.constraintMode ?? CONFIG.modes.constraint;
    this.aeroMode = initialValues.aeroMode ?? CONFIG.modes.aero;
    
    // Lignes - Dimensions
    this.lineLength = initialValues.lineLength ?? InputDefaults.LINE_LENGTH_M;
    this.bridleNez = initialValues.bridleNez ?? InputDefaults.BRIDLE_NEZ_M;
    this.bridleInter = initialValues.bridleInter ?? InputDefaults.BRIDLE_INTER_M;
    this.bridleCentre = initialValues.bridleCentre ?? InputDefaults.BRIDLE_CENTRE_M;

    // Physique
    this.linearDamping = initialValues.linearDamping ?? CONFIG.physics.linearDamping;
    this.angularDamping = initialValues.angularDamping ?? CONFIG.physics.angularDamping;
    this.meshSubdivisionLevel = initialValues.meshSubdivisionLevel ?? InputDefaults.MESH_SUBDIVISION_LEVEL;

    // Aérodynamique
    this.liftScale = initialValues.liftScale ?? CONFIG.aero.liftScale;
    this.dragScale = initialValues.dragScale ?? CONFIG.aero.dragScale;
    this.forceSmoothing = initialValues.forceSmoothing ?? CONFIG.aero.forceSmoothing;

    // Actions
    this.resetSimulation = initialValues.resetSimulation ?? false;
    this.isPaused = initialValues.isPaused ?? !CONFIG.simulation.autoStart;
    this.debugMode = initialValues.debugMode ?? CONFIG.debug.enabled;

    // Contrôle barre
    this.barRotationInput = initialValues.barRotationInput ?? 0;
  }
}
