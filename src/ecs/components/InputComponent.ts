import { Component } from '../core/Component';

/**
 * Contient l'état des entrées utilisateur provenant de l'interface.
 * Les systèmes liront ce composant pour ajuster la simulation.
 */
export class InputComponent extends Component {
  public static readonly type = 'Input';
  public readonly type = 'Input';

  // === Vent ===
  windSpeed: number; // m/s
  windDirection: number; // degrés
  windTurbulence: number; // %

  // === Lignes ===
  constraintMode: 'pbd' | 'spring-force';
  aeroMode: 'perso' | 'nasa'; // Mode aérodynamique
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
    this.windSpeed = initialValues.windSpeed ?? 10; // m/s
    this.windDirection = initialValues.windDirection ?? 0; // degrés
    this.windTurbulence = initialValues.windTurbulence ?? 10; // %

    // Lignes
    this.constraintMode = initialValues.constraintMode ?? 'spring-force';
    this.aeroMode = initialValues.aeroMode ?? 'perso'; // Défaut : mode Perso
    this.lineLength = initialValues.lineLength ?? 150; // m
    this.bridleNez = initialValues.bridleNez ?? 1.5; // m
    this.bridleInter = initialValues.bridleInter ?? 2.0; // m
    this.bridleCentre = initialValues.bridleCentre ?? 2.5; // m

    // Physique
    this.linearDamping = initialValues.linearDamping ?? 0.99;
    this.angularDamping = initialValues.angularDamping ?? 0.98;
    this.meshSubdivisionLevel = initialValues.meshSubdivisionLevel ?? 2;

    // Aérodynamique
    this.liftScale = initialValues.liftScale ?? 1.0;
    this.dragScale = initialValues.dragScale ?? 1.0;
    this.forceSmoothing = initialValues.forceSmoothing ?? 0.5;

    // Actions
    this.resetSimulation = initialValues.resetSimulation ?? false;
    this.isPaused = initialValues.isPaused ?? false;
    this.debugMode = initialValues.debugMode ?? false;

    // Contrôle barre
    this.barRotationInput = initialValues.barRotationInput ?? 0;
  }
}
