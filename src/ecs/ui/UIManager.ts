import * as THREE from "three";
import type { KiteState } from "@mytypes/PhysicsTypes";

import { CONFIG } from "../config/SimulationConfig";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { KiteGeometry } from "../config/KiteGeometry";

export interface BridleLengths {
  nez: number;
  inter: number;
  centre: number;
}

export interface WindSnapshot {
  baseSpeed: number; // m/s
  baseDirection: THREE.Vector3;
  turbulence: number; // %
}

export interface ControlLineDiagnostics {
  lineLength: number;
  leftDistance: number;
  rightDistance: number;
  leftTaut: boolean;
  rightTaut: boolean;
  leftTension?: number;
  rightTension?: number;
}

export interface AerodynamicForcesSnapshot {
  lift: THREE.Vector3;
  drag: THREE.Vector3;
}

export interface SimulationControls {
  getBridleLengths(): BridleLengths;
  setBridleLength(type: "nez" | "inter" | "centre", length: number): void;
  setLineLength(length: number): void;
  setWindParams(params: { speed?: number; direction?: number; turbulence?: number }): void;
  getForceSmoothing(): number;
  setForceSmoothing(value: number): void;
  getKiteState(): KiteState;
  getWindState(): WindSnapshot;
  getLineLength(): number;
  getControlLineDiagnostics(): ControlLineDiagnostics | null;
  getAerodynamicForces(): AerodynamicForcesSnapshot | null;
  // Contrôles pour visualisation des vecteurs aérodynamiques
  setAeroVectorsEnabled(enabled: boolean): void;
  setVectorTypeEnabled(type: 'lift' | 'drag' | 'apparentWind', enabled: boolean): void;
  setVectorScale(type: 'lift' | 'drag' | 'apparentWind', scale: number): void;
}

/**
 * Gestionnaire de l'interface utilisateur
 *
 * Gère les contrôles et interactions utilisateur
 */
export interface SliderConfig {
  id: string;
  initialValue: number;
  onInput: (value: number) => void;
  formatter?: (value: number) => string;
  step?: number;
}

export class UIManager {
  private simulation: SimulationControls;
  private debugRenderer: DebugRenderer;
  private resetCallback: () => void;
  private togglePlayCallback: () => void;

  constructor(
    simulation: SimulationControls,
    debugRenderer: DebugRenderer,
    resetCallback: () => void,
    togglePlayCallback: () => void,
  ) {
    this.simulation = simulation;
    this.debugRenderer = debugRenderer;
    this.resetCallback = resetCallback;
    this.togglePlayCallback = togglePlayCallback;
    this.setupControls();
  }

  private setupControls(): void {
    const resetBtn = document.getElementById("reset-sim");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetCallback();
      });
    }

    const playBtn = document.getElementById("play-pause");
    if (playBtn) {
      playBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.togglePlayCallback();
      });
    }

    const debugBtn = document.getElementById("debug-physics");
    if (debugBtn) {
      debugBtn.textContent = this.debugRenderer.isDebugMode() ? "🔍 Debug ON" : "🔍 Debug OFF";
      debugBtn.classList.toggle("active", this.debugRenderer.isDebugMode());

      // Guard : éviter d'ajouter plusieurs fois l'écouteur
      if (!debugBtn.dataset.listenerAdded) {
        debugBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.debugRenderer.toggleDebugMode();
          // Mettre à jour l'affichage du bouton après le toggle
          debugBtn.textContent = this.debugRenderer.isDebugMode() ? "🔍 Debug ON" : "🔍 Debug OFF";
          debugBtn.classList.toggle("active", this.debugRenderer.isDebugMode());
          // Afficher/cacher le panneau de debug
          const debugPanel = document.getElementById("debug-panel");
          if (debugPanel) {
            debugPanel.style.display = this.debugRenderer.isDebugMode() ? "block" : "none";
          }
          if (this.debugRenderer.isDebugMode()) {
            document.body.classList.add("debug-mode");
          } else {
            document.body.classList.remove("debug-mode");
          }
        });
        debugBtn.dataset.listenerAdded = "true";
      }
    }

    if (this.debugRenderer.isDebugMode()) {
      document.body.classList.add("debug-mode");
      const debugPanel = document.getElementById("debug-panel");
      if (debugPanel) {
        debugPanel.style.display = "block";
      }
    }

    this.setupWindControls();
  }

  // Interface SliderConfig définie en dehors de la classe

  /**
   * Crée et configure un slider générique
   */
  private createSlider(config: SliderConfig): void {
    const slider = document.getElementById(config.id) as HTMLInputElement | null;
    const valueElement = document.getElementById(`${config.id}-value`);

    if (!slider || !valueElement) {
      console.warn(`⚠️ Slider not found: ${config.id}`);
      return;
    }

    // Définir la valeur initiale du slider
    console.log(`🎚️ Setting slider ${config.id} to:`, config.initialValue);
    slider.value = config.initialValue.toString();
    
    // Afficher la valeur initiale formatée
    valueElement.textContent = config.formatter
      ? config.formatter(config.initialValue)
      : config.initialValue.toFixed(2);

    slider.oninput = () => {
      const value = parseFloat(slider.value);
      config.onInput(value);

      valueElement.textContent = config.formatter
        ? config.formatter(value)
        : value.toFixed(2);
    };
  }

  /**
   * Configure les contrôles de vent
   */
  private setupWindControlsGroup(): void {
    const currentWind = this.simulation.getWindState();

    // Vitesse du vent
    this.createSlider({
      id: "wind-speed",
      initialValue: (currentWind?.baseSpeed ?? CONFIG.wind.defaultSpeed) * (1 / CONFIG.conversions.kmhToMs),
      onInput: (speed) => this.simulation.setWindParams({ speed }),
      formatter: (value) => `${value.toFixed(1)} km/h`
    });

    // Direction du vent
    this.createSlider({
      id: "wind-direction",
      initialValue: this.computeDirectionDegrees(currentWind?.baseDirection),
      onInput: (direction) => this.simulation.setWindParams({ direction }),
      formatter: (value) => `${value.toFixed(0)}°`,
      step: 1
    });

    // Turbulence du vent
    this.createSlider({
      id: "wind-turbulence",
      initialValue: currentWind?.turbulence ?? CONFIG.wind.defaultTurbulence,
      onInput: (turbulence) => this.simulation.setWindParams({ turbulence }),
      formatter: (value) => `${value.toFixed(1)}%`
    });
  }

  /**
   * Configure les contrôles des lignes
   */
  private setupLineControlsGroup(): void {
    // Longueur des lignes
    const lineLength = this.simulation.getLineLength();
    console.log('🔍 UIManager init - Line length:', lineLength);
    
    this.createSlider({
      id: "line-length",
      initialValue: lineLength,
      onInput: (length) => this.simulation.setLineLength(length),
      formatter: (value) => `${value.toFixed(0)}m`,
      step: 1
    });

    // Brides
    const currentBridle = this.simulation.getBridleLengths();
    console.log('🔍 UIManager init - Bridle lengths:', {
      nez: currentBridle.nez,
      inter: currentBridle.inter,
      centre: currentBridle.centre
    });

    this.createSlider({
      id: "bridle-nez",
      initialValue: currentBridle.nez,
      onInput: (length) => this.simulation.setBridleLength("nez", length),
      formatter: (value) => `${value.toFixed(2)}m`
    });

    this.createSlider({
      id: "bridle-inter",
      initialValue: currentBridle.inter,
      onInput: (length) => this.simulation.setBridleLength("inter", length),
      formatter: (value) => `${value.toFixed(2)}m`
    });

    this.createSlider({
      id: "bridle-centre",
      initialValue: currentBridle.centre,
      onInput: (length) => this.simulation.setBridleLength("centre", length),
      formatter: (value) => `${value.toFixed(2)}m`
    });
  }

  /**
   * Configure les contrôles de physique
   */
  private setupPhysicsControlsGroup(): void {
    // Amortissement linéaire
    this.createSlider({
      id: "linear-damping",
      initialValue: CONFIG.physics.linearDampingCoeff,
      onInput: (damping) => { CONFIG.physics.linearDampingCoeff = damping; }
    });

    // Facteur de traînée angulaire
    this.createSlider({
      id: "angular-damping",
      initialValue: CONFIG.physics.angularDragFactor,
      onInput: (dragFactor) => { CONFIG.physics.angularDragFactor = dragFactor; }
    });

    // Niveau de subdivision du maillage
    this.createSlider({
      id: "mesh-subdivision-level",
      initialValue: CONFIG.kite.defaultMeshSubdivisionLevel,
      onInput: (level) => {
        const intLevel = parseInt(level.toString(), 10);
        CONFIG.kite.defaultMeshSubdivisionLevel = intLevel;
        KiteGeometry.setMeshSubdivisionLevel(intLevel);
      },
      formatter: (value) => {
        const level = parseInt(value.toString(), 10);
        const triangleCount = Math.pow(4, level + 1);
        return `${level} (${triangleCount} triangles)`;
      },
      step: 1
    });
  }

  /**
   * Configure les contrôles aérodynamiques
   */
  private setupAerodynamicControlsGroup(): void {
    // Échelle de portance
    this.createSlider({
      id: "lift-scale",
      initialValue: CONFIG.aero.liftScale,
      onInput: (scale) => { CONFIG.aero.liftScale = scale; }
    });

    // Échelle de traînée
    this.createSlider({
      id: "drag-scale",
      initialValue: CONFIG.aero.dragScale,
      onInput: (scale) => { CONFIG.aero.dragScale = scale; }
    });

    // Lissage des forces
    this.createSlider({
      id: "force-smoothing",
      initialValue: this.simulation.getForceSmoothing(),
      onInput: (smoothing) => this.simulation.setForceSmoothing(smoothing)
    });
  }

  private setupWindControls(): void {
    this.setupWindControlsGroup();
    this.setupLineControlsGroup();
    this.setupPhysicsControlsGroup();
    this.setupAerodynamicControlsGroup();
  }

  updatePlayButton(isPlaying: boolean): void {
    const playBtn = document.getElementById("play-pause");
    if (playBtn) {
      playBtn.textContent = isPlaying ? "⏸️ Pause" : "▶️ Lancer";
    }
  }

  updateDebugInfo(): void {
    const debugInfo = document.getElementById("debug-info");
    if (!debugInfo || !this.debugRenderer.isDebugMode()) return;

    const kiteState = this.simulation.getKiteState();
    const windState = this.simulation.getWindState();
    const controlDiagnostics = this.simulation.getControlLineDiagnostics();
    const aeroForces = this.simulation.getAerodynamicForces();

    const kitePosition = kiteState?.position ?? new THREE.Vector3();
    const kiteVelocity = kiteState?.velocity ?? new THREE.Vector3();

    let tensionInfo = "N/A";
    if (controlDiagnostics) {
      const leftState = controlDiagnostics.leftTaut ? "TENDU" : "RELÂCHÉ";
      const rightState = controlDiagnostics.rightTaut ? "TENDU" : "RELÂCHÉ";
      const leftDistance = controlDiagnostics.leftDistance.toFixed(2);
      const rightDistance = controlDiagnostics.rightDistance.toFixed(2);
      const leftTension = controlDiagnostics.leftTension ?? 0;
      const rightTension = controlDiagnostics.rightTension ?? 0;
      tensionInfo = `L:${leftState}(${leftDistance}m, ${leftTension.toFixed(1)}N) R:${rightState}(${rightDistance}m, ${rightTension.toFixed(1)}N)`;
    }

    const liftMagnitude = aeroForces ? aeroForces.lift.length() : 0;
    const dragMagnitude = aeroForces ? aeroForces.drag.length() : 0;
    const totalForce = Math.sqrt(liftMagnitude * liftMagnitude + dragMagnitude * dragMagnitude);

    debugInfo.innerHTML = `
      <strong>🪁 Position Cerf-volant:</strong><br>
      X: ${kitePosition.x.toFixed(2)}m, Y: ${kitePosition.y.toFixed(2)}m, Z: ${kitePosition.z.toFixed(2)}m<br><br>

      <strong>💨 Vent:</strong><br>
      Vitesse: ${windState.baseSpeed.toFixed(1)} m/s (${(windState.baseSpeed * 3.6).toFixed(1)} km/h)<br>
      Direction: (${windState.baseDirection.x.toFixed(0)}, ${windState.baseDirection.y.toFixed(0)}, ${windState.baseDirection.z.toFixed(0)})<br>
      Turbulence: ${windState.turbulence.toFixed(1)}%<br><br>

      <strong>⚡ Forces Aérodynamiques:</strong><br>
      Portance: ${liftMagnitude.toFixed(3)} N<br>
      Traînée: ${dragMagnitude.toFixed(3)} N<br>
      Force Totale: ${totalForce.toFixed(3)} N<br><br>

      <strong>🔗 Tensions Lignes:</strong><br>
      ${tensionInfo}<br><br>

      <strong>🏃 Vitesse Cerf-volant:</strong><br>
      ${kiteVelocity.length().toFixed(2)} m/s<br><br>

      <strong>⚙️ Performance:</strong><br>
      Statut: <span style="color: #00ff88;">STABLE</span>
    `;
  }

  private computeDirectionDegrees(direction?: THREE.Vector3): number {
    if (!direction || direction.lengthSq() === 0) {
      return CONFIG.wind.defaultDirection;
    }

    const normalized = direction.clone().normalize();
    const radians = Math.atan2(normalized.x, -normalized.z);
    const degrees = THREE.MathUtils.radToDeg(radians);

    return (degrees + 360) % 360;
  }
}