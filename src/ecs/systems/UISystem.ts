import * as THREE from 'three';

import { System, type SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { InputComponent } from '../components/InputComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { TransformComponent } from '../components/TransformComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { LineComponent } from '../components/LineComponent';
import { Entity } from '../core/Entity';
import { Logger } from '../utils/Logging';
import { UI_METADATA } from '../config/UIConfig';
import { UIConfig } from '../config/Config';

// Constantes UI
const DECIMAL_PRECISION_VELOCITY = UIConfig.DECIMAL_PRECISION_VELOCITY;
const DECIMAL_PRECISION_POSITION = UIConfig.DECIMAL_PRECISION_POSITION;
const DECIMAL_PRECISION_ANGLE = UIConfig.DECIMAL_PRECISION_ANGLE;
const MS_TO_KMH = UIConfig.MS_TO_KMH;

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
    super('Input', UIConfig.PRIORITY);
  }

  async initialize(entityManager: EntityManager): Promise<void> {
    const uiEntity = entityManager.query(['Input'])[0];
    if (uiEntity) {
      const component = uiEntity.getComponent<InputComponent>(InputComponent.type);
      if (component) {
        this.inputComponent = component;
        this.logger.info('InputComponent found', 'UISystem');
      }
    }

    // Chercher l'entité du cerf-volant (kite)
    this.kiteEntity = entityManager.getEntity('kite') ?? null;

    if (this.kiteEntity) {
      this.logger.info('Kite entity found in initialize: ' + this.kiteEntity.id, 'UISystem');
      const kiteGeom = this.kiteEntity.getComponent<GeometryComponent>('geometry');
      if (kiteGeom) {
        this.logger.debug(`✅ Kite geometry points: ${kiteGeom.getPointNames().join(', ')}`, 'UISystem');
      }
    } else {
      this.logger.warn('Kite entity not found in initialize', 'UISystem');
    }

    // Chercher la barre de contrôle
    const controlBar = entityManager.getEntity('controlBar');
    if (controlBar) {
      const barGeom = controlBar.getComponent<GeometryComponent>('geometry');
      if (barGeom) {
        this.logger.debug(`✅ Control bar geometry points: ${barGeom.getPointNames().join(', ')}`, 'UISystem');
      }
    }

    // Initialiser les boutons une seule fois (ils se réfèrent à l'InputComponent qui peut changer)
    if (!this.buttonsInitialized) {
      this.setupButtons();
      this.buttonsInitialized = true;
    }

    this.initUI();
  }

  // eslint-disable-next-line max-lines-per-function
  private initUI(): void {
    const sliders = this.getSliderConfigs();
    // Initialiser tous les sliders
    sliders.forEach(config => this.setupSlider(config));
  }

  private getSliderConfigs(): SliderConfig[] {
    const meta = UI_METADATA;

    return [
      // === Vent ===
      {
        id: 'wind-speed-slider',
        min: meta.wind.speed.min,
        max: meta.wind.speed.max,
        step: meta.wind.speed.step,
        formatter: (v) => `${v.toFixed(1)} ${meta.wind.speed.unit}`,
        property: 'windSpeed'
      },
      {
        id: 'wind-direction-slider',
        min: meta.wind.direction.min,
        max: meta.wind.direction.max,
        step: meta.wind.direction.step,
        formatter: (v) => `${v.toFixed(0)}${meta.wind.direction.unit}`,
        property: 'windDirection'
      },
      {
        id: 'wind-turbulence-slider',
        min: meta.wind.turbulence.min,
        max: meta.wind.turbulence.max,
        step: meta.wind.turbulence.step,
        formatter: (v) => `${v.toFixed(0)}${meta.wind.turbulence.unit}`,
        property: 'windTurbulence'
      },

      // === Lignes ===
      {
        id: 'line-length-slider',
        min: meta.lines.length.min,
        max: meta.lines.length.max,
        step: meta.lines.length.step,
        formatter: (v) => `${v.toFixed(0)}${meta.lines.length.unit}`,
        property: 'lineLength'
      },
      {
        id: 'bridle-nez-slider',
        min: meta.lines.bridles.nez.min,
        max: meta.lines.bridles.nez.max,
        step: meta.lines.bridles.nez.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.nez.unit}`,
        property: 'bridleNez'
      },
      {
        id: 'bridle-inter-slider',
        min: meta.lines.bridles.inter.min,
        max: meta.lines.bridles.inter.max,
        step: meta.lines.bridles.inter.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.inter.unit}`,
        property: 'bridleInter'
      },
      {
        id: 'bridle-centre-slider',
        min: meta.lines.bridles.centre.min,
        max: meta.lines.bridles.centre.max,
        step: meta.lines.bridles.centre.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_POSITION)}${meta.lines.bridles.centre.unit}`,
        property: 'bridleCentre'
      },

      // === Physique ===
      {
        id: 'linear-damping-slider',
        min: meta.physics.linearDamping.min,
        max: meta.physics.linearDamping.max,
        step: meta.physics.linearDamping.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'linearDamping'
      },
      {
        id: 'angular-damping-slider',
        min: meta.physics.angularDamping.min,
        max: meta.physics.angularDamping.max,
        step: meta.physics.angularDamping.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'angularDamping'
      },
      {
        id: 'mesh-subdivision-slider',
        min: meta.render.meshSubdivision.min,
        max: meta.render.meshSubdivision.max,
        step: meta.render.meshSubdivision.step,
        formatter: (v) => {
          const level = Math.floor(v);
          const triangles = Math.pow(UIConfig.TRIANGLES_BASE, level + 1);
          return `${level} (${triangles} tris)`;
        },
        property: 'meshSubdivisionLevel'
      },

      // === Aérodynamique ===
      {
        id: 'lift-scale-slider',
        min: meta.aerodynamics.liftScale.min,
        max: meta.aerodynamics.liftScale.max,
        step: meta.aerodynamics.liftScale.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'liftScale'
      },
      {
        id: 'drag-scale-slider',
        min: meta.aerodynamics.dragScale.min,
        max: meta.aerodynamics.dragScale.max,
        step: meta.aerodynamics.dragScale.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'dragScale'
      },
      {
        id: 'force-smoothing-slider',
        min: meta.aerodynamics.forceSmoothing.min,
        max: meta.aerodynamics.forceSmoothing.max,
        step: meta.aerodynamics.forceSmoothing.step,
        formatter: (v) => `${v.toFixed(DECIMAL_PRECISION_ANGLE)}`,
        property: 'forceSmoothing'
      }
    ];
  }

  private setupSlider(config: SliderConfig): void {
    const slider = document.getElementById(config.id) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${config.id.replace('-slider', '-value')}`);

    if (!slider || !valueDisplay || !this.inputComponent) {
      this.logger.warn(`Slider ${config.id} not found in DOM`, 'UISystem');
      return;
    }

    // Définir la valeur initiale
    const initialValue = this.inputComponent[config.property] as number | undefined;
    if (initialValue === undefined) {
      this.logger.warn(`Property ${config.property} not found in InputComponent for slider ${config.id}`, 'UISystem');
      return;
    }

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

    // Toggle Mode de Contrainte
    const constraintModeToggle = document.getElementById('constraint-mode-toggle') as HTMLInputElement;
    if (constraintModeToggle) {
      // Initialiser l'état du toggle selon inputComponent.constraintMode
      // Unchecked = 'pbd', Checked = 'spring-force'
      constraintModeToggle.checked = this.inputComponent.constraintMode === 'spring-force';
      
      this.logger.info(`Constraint mode initialized to: ${this.inputComponent.constraintMode}, toggle checked: ${constraintModeToggle.checked}`, 'UISystem');

      // Event listener pour mettre à jour le mode de contrainte
      constraintModeToggle.addEventListener('change', () => {
        this.inputComponent.constraintMode = constraintModeToggle.checked ? 'spring-force' : 'pbd';
        this.logger.info(`Constraint mode changed to: ${this.inputComponent.constraintMode}`, 'UISystem');
        
        // Reset la simulation lors du changement de mode
        this.inputComponent.resetSimulation = true;
        this.logger.info('Reset simulation requested after constraint mode change', 'UISystem');
      });
    }

    // Toggle Mode Aérodynamique  
    const aeroModeToggle = document.getElementById('aero-mode-toggle') as HTMLInputElement;
    if (aeroModeToggle) {
      // Initialiser l'état du toggle selon inputComponent.aeroMode
      // Unchecked = 'perso', Checked = 'nasa'
      aeroModeToggle.checked = this.inputComponent.aeroMode === 'nasa';
      
      this.logger.info(`Aero mode initialized to: ${this.inputComponent.aeroMode}, toggle checked: ${aeroModeToggle.checked}`, 'UISystem');

      // Event listener pour mettre à jour le mode aérodynamique
      aeroModeToggle.addEventListener('change', () => {
        this.inputComponent.aeroMode = aeroModeToggle.checked ? 'nasa' : 'perso';
        this.logger.info(`Aero mode changed to: ${this.inputComponent.aeroMode}`, 'UISystem');
        
        // Pas besoin de reset pour le changement de mode aéro (bascule à chaud)
      });
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
      const potentialKites = context.entityManager.query(['physics', 'kite']);
      this.kiteEntity = potentialKites.find(e => e.id === 'kite') ?? null;

      if (!this.kiteEntity) {
        // Essayer une requête plus large
        this.kiteEntity = context.entityManager.getEntity('kite') ?? null;
      }

      if (!this.kiteEntity) {
        this.logger.warn('Kite entity not found', 'UISystem');
        return;
      }

      this.logger.info('Kite entity found: ' + this.kiteEntity.id, 'UISystem');
    }

    // Mettre à jour les affichages d'informations
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');
    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');

    if (physics && transform) {
      // === Vitesse ===
      const speedValue = document.getElementById('kite-speed-value');
      if (speedValue) {
        const speedKmh = physics.velocity.length() * MS_TO_KMH;
        speedValue.textContent = `${speedKmh.toFixed(DECIMAL_PRECISION_VELOCITY)} km/h`;
      }

      // === Altitude ===
      const altitudeValue = document.getElementById('kite-altitude-value');
      if (altitudeValue) {
        altitudeValue.textContent = `${transform.position.y.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Position X ===
      const posXValue = document.getElementById('kite-position-x-value');
      if (posXValue) {
        posXValue.textContent = `${transform.position.x.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Position Z ===
      const posZValue = document.getElementById('kite-position-z-value');
      if (posZValue) {
        posZValue.textContent = `${transform.position.z.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      }

      // === Angle d'attaque ===
      this.updateAngleOfAttack(context, transform);

      // === Forces (portance et traînée) ===
      this.updateForces(physics);

      // === Tensions des lignes ===
      this.updateLineTensions(context);

      // === Distances des lignes (handles -> points de contrôle) ===
      this.updateLineDistances(context);
    }

    // === Vent ambiant et apparent ===
    this.updateWindInfo(context);
  }

  /**
   * Calcule et affiche l'angle d'attaque du kite
   */
  private updateAngleOfAttack(context: SimulationContext, transform: TransformComponent): void {
    const aoaValue = document.getElementById('kite-aoa-value');
    if (!aoaValue) return;

    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) return;

    const windState = windCache.get('kite');
    if (!windState || !windState.apparent) {
      aoaValue.textContent = '-- °';
      return;
    }

    const apparentWind = windState.apparent;
    const windSpeed = apparentWind.length();

    if (windSpeed < UIConfig.MIN_WIND_SPEED) {
      aoaValue.textContent = '0.0 °';
      return;
    }

    // Calculer l'angle d'attaque : angle entre la corde du kite et la direction du vent
    const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
    const windDir = apparentWind.clone().normalize();
    const dotProduct = chord.dot(windDir);
    const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;

    aoaValue.textContent = `${alpha.toFixed(DECIMAL_PRECISION_ANGLE)} °`;
  }

  /**
   * Calcule et affiche les forces totales de portance et traînée
   */
  private updateForces(physics: PhysicsComponent): void {
    const liftValue = document.getElementById('kite-lift-value');
    const dragValue = document.getElementById('kite-drag-value');

    if (!liftValue || !dragValue) return;

    // Calculer la somme des forces de portance et traînée depuis faceForces
    let totalLift = 0;
    let totalDrag = 0;

    physics.faceForces.forEach(faceForce => {
      totalLift += faceForce.lift.length();
      totalDrag += faceForce.drag.length();
    });

    liftValue.textContent = `${totalLift.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
    dragValue.textContent = `${totalDrag.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
  }

  /**
   * Affiche les tensions des lignes gauche et droite
   */
  private updateLineTensions(context: SimulationContext): void {
    const tensionLeftValue = document.getElementById('tension-left-value');
    const tensionRightValue = document.getElementById('tension-right-value');

    if (!tensionLeftValue || !tensionRightValue) return;

    const { entityManager } = context;
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    // Tension ligne gauche
    if (leftLine) {
      const lineComp = leftLine.getComponent<LineComponent>('line');
      if (lineComp && 'currentTension' in lineComp && lineComp.currentTension !== undefined) {
        const tension = (lineComp as LineComponent & { currentTension: number }).currentTension;
        tensionLeftValue.textContent = `${tension.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
      } else {
        tensionLeftValue.textContent = '0.0 N';
      }
    } else {
      tensionLeftValue.textContent = '-- N';
    }

    // Tension ligne droite
    if (rightLine) {
      const lineComp = rightLine.getComponent<LineComponent>('line');
      if (lineComp && 'currentTension' in lineComp && lineComp.currentTension !== undefined) {
        const tension = (lineComp as LineComponent & { currentTension: number }).currentTension;
        tensionRightValue.textContent = `${tension.toFixed(DECIMAL_PRECISION_VELOCITY)} N`;
      } else {
        tensionRightValue.textContent = '0.0 N';
      }
    } else {
      tensionRightValue.textContent = '-- N';
    }
  }

  /**
   * Affiche les informations sur le vent (ambiant, apparent, direction)
   */
  private updateWindInfo(context: SimulationContext): void {
    if (!this.inputComponent) return;

    // Vent ambiant
    const windInfo = document.getElementById('wind-info-value');
    if (windInfo && this.inputComponent.windSpeed !== undefined) {
      windInfo.textContent = `${this.inputComponent.windSpeed.toFixed(DECIMAL_PRECISION_POSITION)} m/s`;
    }

    // Direction du vent
    const windDirValue = document.getElementById('wind-direction-info-value');
    if (windDirValue && this.inputComponent.windDirection !== undefined) {
      windDirValue.textContent = `${this.inputComponent.windDirection.toFixed(0)} °`;
    }

    // Vent apparent
    const windApparentValue = document.getElementById('wind-apparent-value');
    if (!windApparentValue) return;

    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) {
      windApparentValue.textContent = '-- m/s';
      return;
    }

    const windState = windCache.get('kite');
    if (!windState || !windState.apparent) {
      windApparentValue.textContent = '-- m/s';
      return;
    }

    const apparentSpeed = windState.apparent.length();
    windApparentValue.textContent = `${apparentSpeed.toFixed(DECIMAL_PRECISION_POSITION)} m/s`;
  }

  /**
   * Calcule et affiche les distances des lignes (handles -> points de contrôle du kite)
   * Compare avec la distance attendue depuis Config
   */
  private updateLineDistances(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer les entités
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');

    if (!kite || !controlBar) {
      this.logger.warn('🔴 Kite ou controlBar non trouvés', 'UISystem');
      return;
    }

    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');

    if (!kiteGeometry || !barGeometry) {
      this.logger.warn('🔴 Géométries du kite ou controlBar non trouvées', 'UISystem');
      return;
    }

    // === Ligne gauche ===
    const leftHandleWorld = barGeometry.getPointWorld('poignet_gauche', controlBar);
    const leftCtrlWorld = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);

    if (leftHandleWorld && leftCtrlWorld) {
      // Distance actuelle
      const actualLeftDistance = leftHandleWorld.distanceTo(leftCtrlWorld);

      // Distance attendue depuis Config
      const expectedDistance = this.inputComponent?.lineLength ?? 150;

      // Écart
      const leftDiff = actualLeftDistance - expectedDistance;

      // Afficher
      const leftActual = document.getElementById('line-left-actual-value');
      const leftExpected = document.getElementById('line-left-expected-value');
      const leftDiffElem = document.getElementById('line-left-diff-value');

      if (leftActual) leftActual.textContent = `${actualLeftDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (leftExpected) leftExpected.textContent = `${expectedDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (leftDiffElem) {
        const sign = leftDiff >= 0 ? '+' : '';
        leftDiffElem.textContent = `${sign}${leftDiff.toFixed(DECIMAL_PRECISION_POSITION)} m`;
        // Colorer en rouge si l'écart est > 1m
        if (Math.abs(leftDiff) > 1) {
          leftDiffElem.style.color = '#ff4444';
        } else {
          leftDiffElem.style.color = '#4da6ff';
        }
      }
    } else {
      // Debug: points non trouvés
      if (!leftHandleWorld) this.logger.warn('🔴 poignet_gauche non trouvé sur controlBar', 'UISystem');
      if (!leftCtrlWorld) this.logger.warn('🔴 CTRL_GAUCHE non trouvé sur kite', 'UISystem');
    }

    // === Ligne droite ===
    const rightHandleWorld = barGeometry.getPointWorld('poignet_droit', controlBar);
    const rightCtrlWorld = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    if (rightHandleWorld && rightCtrlWorld) {
      // Distance actuelle
      const actualRightDistance = rightHandleWorld.distanceTo(rightCtrlWorld);

      // Distance attendue depuis Config
      const expectedDistance = this.inputComponent?.lineLength ?? 150;

      // Écart
      const rightDiff = actualRightDistance - expectedDistance;

      // Afficher
      const rightActual = document.getElementById('line-right-actual-value');
      const rightExpected = document.getElementById('line-right-expected-value');
      const rightDiffElem = document.getElementById('line-right-diff-value');

      if (rightActual) rightActual.textContent = `${actualRightDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (rightExpected) rightExpected.textContent = `${expectedDistance.toFixed(DECIMAL_PRECISION_POSITION)} m`;
      if (rightDiffElem) {
        const sign = rightDiff >= 0 ? '+' : '';
        rightDiffElem.textContent = `${sign}${rightDiff.toFixed(DECIMAL_PRECISION_POSITION)} m`;
        // Colorer en rouge si l'écart est > 1m
        if (Math.abs(rightDiff) > 1) {
          rightDiffElem.style.color = '#ff4444';
        } else {
          rightDiffElem.style.color = '#4da6ff';
        }
      }
    } else {
      // Debug: points non trouvés
      if (!rightHandleWorld) this.logger.warn('🔴 poignet_droit non trouvé sur controlBar', 'UISystem');
      if (!rightCtrlWorld) this.logger.warn('🔴 CTRL_DROIT non trouvé sur kite', 'UISystem');
    }
  }
}
