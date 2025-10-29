import { Component } from '../core/Component';
import { Logger } from '../utils/Logging';
import { CONFIG, InputDefaults, WindConfig, EnvironmentConfig } from '../config/Config';

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
  private _windSpeed: number = CONFIG.wind.speed; // m/s
  private _windDirection: number = WindConfig.DEFAULT_WIND_DIRECTION; // degrés
  private _windTurbulence: number = WindConfig.DEFAULT_TURBULENCE; // %

  // === Lignes ===

  // ...existing code...
      // ...existing code...
  private _lineLength: number = InputDefaults.LINE_LENGTH_M;

  get lineLength(): number {
    return this._lineLength;
  }

  set lineLength(value: number) {
    if (this._lineLength !== value) {
      this._lineLength = value;
      this.logger.info(`📏 Line length changed: ${value}m`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
  private _bridleNez: number = 0.65; // Aligné avec BridleComponent
 
  get bridleNez(): number {
    return this._bridleNez;
  }

  set bridleNez(value: number) {
    if (this._bridleNez !== value) {
      this._bridleNez = value;
      this.logger.info(`🔗 Bridle Nez changed: ${value}m`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
  private _bridleInter: number = 0.65; // Aligné avec BridleComponent
 
  get bridleInter(): number {
    return this._bridleInter;
  }

  set bridleInter(value: number) {
    if (this._bridleInter !== value) {
      this._bridleInter = value;
      this.logger.info(`🔗 Bridle Inter changed: ${value}m`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
  private _bridleCentre: number = 0.65; // Aligné avec BridleComponent
 
  get bridleCentre(): number {
    return this._bridleCentre;
  }

  set bridleCentre(value: number) {
    if (this._bridleCentre !== value) {
      this._bridleCentre = value;
      this.logger.info(`🔗 Bridle Centre changed: ${value}m`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }

  // === Physique ===
  private _linearDamping: number = EnvironmentConfig.LINEAR_DAMPING;

  get linearDamping(): number {
    return this._linearDamping;
  }

  set linearDamping(value: number) {
    if (this._linearDamping !== value) {
      this._linearDamping = value;
      this.logger.info(`💨 Linear damping changed: ${value}`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
  private _angularDamping: number = EnvironmentConfig.ANGULAR_DAMPING;

  get angularDamping(): number {
    return this._angularDamping;
  }

  set angularDamping(value: number) {
    if (this._angularDamping !== value) {
      this._angularDamping = value;
      this.logger.info(`🔄 Angular damping changed: ${value}`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
  private _meshSubdivisionLevel: number = InputDefaults.MESH_SUBDIVISION_LEVEL;

  get meshSubdivisionLevel(): number {
    return this._meshSubdivisionLevel;
  }

  set meshSubdivisionLevel(value: number) {
    if (this._meshSubdivisionLevel !== value) {
      this._meshSubdivisionLevel = value;
      this.logger.info(`🔼 Mesh subdivision level changed: ${value}`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }

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

  // ...existing code...
    
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

  get windSpeed(): number {
    return this._windSpeed;
  }

  set windSpeed(value: number) {
    if (this._windSpeed !== value) {
      this._windSpeed = value;
      this.logger.info(`💨 Wind speed changed: ${value} m/s`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }

  get windDirection(): number {
    return this._windDirection;
  }

  set windDirection(value: number) {
    if (this._windDirection !== value) {
      this._windDirection = value;
      this.logger.info(`🧭 Wind direction changed: ${value} degrees`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }

  get windTurbulence(): number {
    return this._windTurbulence;
  }

  set windTurbulence(value: number) {
    if (this._windTurbulence !== value) {
      this._windTurbulence = value;
      this.logger.info(`💨 Wind turbulence changed: ${value}%`, 'InputComponent');
      // Potentiellement déclencher un événement ou une mise à jour ici
    }
  }
}
