import { System, type SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { InputComponent } from '../components/InputComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { TransformComponent } from '../components/TransformComponent';
import { Entity } from '../core/Entity';
import { Logger } from '../utils/Logging';

// Constantes UI
const PRIORITY = 90;
const DECIMAL_PRECISION_VELOCITY = 2;
const DECIMAL_PRECISION_POSITION = 2;
const DECIMAL_PRECISION_ANGLE = 2;
const KMH_TO_MS = 3.6;

interface SliderConfig {
  id: string;
  min: number;
  max: number;
  step: number;
  formatter: (value: number) => string;
  property: keyof InputComponent;
}

/**
 * Gère la création et la mise à jour de l'interface utilisateur (DOM).
 * Lit les composants de simulation pour afficher les données et
 * met à jour le InputComponent en réponse aux actions de l'utilisateur.
 */
export class UISystem extends System {
  private inputComponent!: InputComponent;
  private kiteEntity: Entity | null = null;
  private readonly logger = Logger.getInstance();
  private buttonsInitialized = false; // Flag pour éviter les doublons d'event listeners

  constructor() {
    super('Input', PRIORITY);
  }

  async initialize(entityManager: EntityManager): Promise<void> {
    const uiEntity = entityManager.query(['Input'])[0];
    if (uiEntity) {
      const component = uiEntity.getComponent<InputComponent>(InputComponent.type);
      if (component) {
        this.inputComponent = component;
      }
    }

    // Chercher l'entité du cerf-volant (kite)
    const potentialKites = entityManager.query(['physics', 'Aerodynamics']);
    this.kiteEntity = potentialKites.find(e => e.id.includes('kite')) ?? null;
    
    // Initialiser les boutons une seule fois (ils se réfèrent à l'InputComponent qui peut changer)
    if (!this.buttonsInitialized) {
      this.setupButtons();
      this.buttonsInitialized = true;
    }
    
    this.initUI();
  }

  // eslint-disable-next-line max-lines-per-function
  private initUI(): void {
    // Configuration de tous les sliders (longue liste déclarative)
    const sliders: SliderConfig[] = [
      // === Vent ===
      {
        id: 'wind-speed-slider',
        min: 0,
        max: 30,
        step: 0.5,
        formatter: (v) => `${v.toFixed(1)} m/s`,
        property: 'windSpeed'
      },
      {
        id: 'wind-direction-slider',
        min: 0,
        max: 360,
        step: 1,
        formatter: (v) => `${v.toFixed(0)}°`,
        property: 'windDirection'
      },
      {
        id: 'wind-turbulence-slider',
        min: 0,
        max: 100,
        step: 1,
        formatter: (v) => `${v.toFixed(0)}%`,
        property: 'windTurbulence'
      },

      // === Lignes ===
      {
        id: 'line-length-slider',
        min: 20,
        max: 300,
        step: 1,
        formatter: (v) => `${v.toFixed(0)}m`,
        property: 'lineLength'
      },
      {
        id: 'bridle-nez-slider',
        min: 0.5,
        max: 5,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}m`,
        property: 'bridleNez'
      },
      {
        id: 'bridle-inter-slider',
        min: 0.5,
        max: 5,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}m`,
        property: 'bridleInter'
      },
      {
        id: 'bridle-centre-slider',
        min: 0.5,
        max: 5,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}m`,
        property: 'bridleCentre'
      },

      // === Physique ===
      {
        id: 'linear-damping-slider',
        min: 0,
        max: 1,
        step: 0.01,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'linearDamping'
      },
      {
        id: 'angular-damping-slider',
        min: 0,
        max: 1,
        step: 0.01,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'angularDamping'
      },
      {
        id: 'mesh-subdivision-slider',
        min: 0,
        max: 4,
        step: 1,
        formatter: (v) => {
          const TRIANGLES_BASE = 4;
          const level = Math.floor(v);
          const triangles = Math.pow(TRIANGLES_BASE, level + 1);
          return `${level} (${triangles} tris)`;
        },
        property: 'meshSubdivisionLevel'
      },

      // === Aérodynamique ===
      {
        id: 'lift-scale-slider',
        min: 0,
        max: 2,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'liftScale'
      },
      {
        id: 'drag-scale-slider',
        min: 0,
        max: 2,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'dragScale'
      },
      {
        id: 'force-smoothing-slider',
        min: 0,
        max: 1,
        step: 0.1,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'forceSmoothing'
      }
    ];

    // Initialiser tous les sliders
    sliders.forEach(config => this.setupSlider(config));
  }

  private setupSlider(config: SliderConfig): void {
    const slider = document.getElementById(config.id) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${config.id.replace('-slider', '-value')}`);

    if (!slider || !valueDisplay || !this.inputComponent) {
      this.logger.warn(`Slider ${config.id} not found in DOM`, 'UISystem');
      return;
    }

    // Définir la valeur initiale
    const initialValue = this.inputComponent[config.property] as number;
    slider.value = initialValue.toString();
    slider.min = config.min.toString();
    slider.max = config.max.toString();
    slider.step = config.step.toString();
    valueDisplay.textContent = config.formatter(initialValue);

    // Ajouter l'écouteur d'événement
    slider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      (this.inputComponent[config.property] as number) = value;
      valueDisplay.textContent = config.formatter(value);
    });
  }

  private setupButtons(): void {
    // Bouton Play/Pause
    const playPauseBtn = document.getElementById('play-pause');
    if (playPauseBtn) {
      playPauseBtn.onclick = () => {
        this.inputComponent.isPaused = !this.inputComponent.isPaused;
        this.updatePlayPauseButton(playPauseBtn, !this.inputComponent.isPaused);
        this.logger.info(`Simulation ${this.inputComponent.isPaused ? 'paused' : 'resumed'}`, 'UISystem');
      };
      
      // Initialiser l'état visuel du bouton selon isPaused
      this.updatePlayPauseButton(playPauseBtn, !this.inputComponent.isPaused);
    }

    // Bouton Reset
    const resetBtn = document.getElementById('reset-sim');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.inputComponent.resetSimulation = true;
        this.logger.info('Reset simulation requested', 'UISystem');
      };
    }

    // Bouton Debug
    const debugBtn = document.getElementById('debug-toggle');
    if (debugBtn) {
      debugBtn.onclick = () => {
        this.inputComponent.debugMode = !this.inputComponent.debugMode;
        debugBtn.textContent = this.inputComponent.debugMode ? '🔍 Debug ON' : '🔍 Debug OFF';
        debugBtn.classList.toggle('active', this.inputComponent.debugMode);
        this.logger.info(`Debug mode: ${this.inputComponent.debugMode}`, 'UISystem');
      };
      
      // Initialiser l'état du bouton
      debugBtn.textContent = this.inputComponent.debugMode ? '🔍 Debug ON' : '🔍 Debug OFF';
      debugBtn.classList.toggle('active', this.inputComponent.debugMode);
    }
  }

  /**
   * Met à jour l'apparence du bouton play/pause
   * @param button - L'élément bouton
   * @param isRunning - true si la simulation tourne, false si en pause
   */
  private updatePlayPauseButton(button: HTMLElement, isRunning: boolean): void {
    button.textContent = isRunning ? '⏸️ Pause' : '▶️ Démarrer';
    button.classList.toggle('active', isRunning);
  }

  update(context: SimulationContext): void {
    if (!this.kiteEntity) {
      // Essayer de retrouver l'entité kite si elle n'a pas été trouvée à l'initialisation
      const potentialKites = context.entityManager.query(['physics', 'Aerodynamics']);
      this.kiteEntity = potentialKites.find(e => e.id.includes('kite')) ?? null;
      if (!this.kiteEntity) return;
    }

    // Mettre à jour les affichages d'informations
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');

    if (physics) {
      const speedValue = document.getElementById('kite-speed-value');
      if (speedValue) {
        const speedKmh = physics.velocity.length() * KMH_TO_MS;
        speedValue.textContent = `${speedKmh.toFixed(DECIMAL_PRECISION_VELOCITY)} km/h`;
      }
    }

    if (transform) {
      const altitudeValue = document.getElementById('kite-altitude-value');
      if (altitudeValue) {
        altitudeValue.textContent = `${transform.position.y.toFixed(1)} m`;
      }
    }

    // Afficher les infos du vent (optionnel)
    const windInfo = document.getElementById('wind-info-value');
    if (windInfo && this.inputComponent) {
      windInfo.textContent = `${this.inputComponent.windSpeed.toFixed(1)} m/s`;
    }
  }
}
