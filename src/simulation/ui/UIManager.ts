import * as THREE from "three";

import { CONFIG } from "../config/SimulationConfig";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { KiteGeometry } from "../config/KiteGeometry";
import { PhysicsConstants } from "../config/PhysicsConstants";
import type { KiteState } from "../types";

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
}

/**
 * Gestionnaire de l'interface utilisateur
 *
 * Gère les contrôles et interactions utilisateur
 */
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

      debugBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.debugRenderer.toggleDebugMode();
      });
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

  private setupWindControls(): void {
    const currentWind = this.simulation.getWindState();

    const speedSlider = document.getElementById("wind-speed") as HTMLInputElement | null;
    const speedValue = document.getElementById("wind-speed-value");
    if (speedSlider && speedValue) {
      const initialSpeedKmh = (currentWind?.baseSpeed ?? CONFIG.wind.defaultSpeed / 3.6) * 3.6;
      speedSlider.value = initialSpeedKmh.toFixed(1);
      speedValue.textContent = `${initialSpeedKmh.toFixed(1)} km/h`;

      speedSlider.oninput = () => {
        const speed = parseFloat(speedSlider.value);
        this.simulation.setWindParams({ speed });
        speedValue.textContent = `${speed.toFixed(1)} km/h`;
      };
    }

    const directionSlider = document.getElementById("wind-direction") as HTMLInputElement | null;
    const directionValue = document.getElementById("wind-direction-value");
    if (directionSlider && directionValue) {
      const currentDirectionDeg = this.computeDirectionDegrees(currentWind?.baseDirection);
      directionSlider.value = currentDirectionDeg.toFixed(0);
      directionValue.textContent = `${currentDirectionDeg.toFixed(0)}°`;

      directionSlider.oninput = () => {
        const direction = parseFloat(directionSlider.value);
        this.simulation.setWindParams({ direction });
        directionValue.textContent = `${direction.toFixed(0)}°`;
      };
    }

    const turbulenceSlider = document.getElementById("wind-turbulence") as HTMLInputElement | null;
    const turbulenceValue = document.getElementById("wind-turbulence-value");
    if (turbulenceSlider && turbulenceValue) {
      const initialTurbulence = currentWind?.turbulence ?? CONFIG.wind.defaultTurbulence;
      turbulenceSlider.value = initialTurbulence.toFixed(1);
      turbulenceValue.textContent = `${initialTurbulence.toFixed(1)}%`;

      turbulenceSlider.oninput = () => {
        const turbulence = parseFloat(turbulenceSlider.value);
        this.simulation.setWindParams({ turbulence });
        turbulenceValue.textContent = `${turbulence.toFixed(1)}%`;
      };
    }

    const lineSlider = document.getElementById("line-length") as HTMLInputElement | null;
    const lineValue = document.getElementById("line-length-value");
    if (lineSlider && lineValue) {
      const initialLineLength = this.simulation.getLineLength();
      lineSlider.value = initialLineLength.toFixed(0);
      lineValue.textContent = `${initialLineLength.toFixed(0)}m`;

      lineSlider.oninput = () => {
        const length = parseFloat(lineSlider.value);
        this.simulation.setLineLength(length);
        lineValue.textContent = `${length.toFixed(0)}m`;
      };
    }

    const currentBridle = this.simulation.getBridleLengths();

    const bridleNezSlider = document.getElementById("bridle-nez") as HTMLInputElement | null;
    const bridleNezValue = document.getElementById("bridle-nez-value");
    if (bridleNezSlider && bridleNezValue) {
      bridleNezSlider.value = currentBridle.nez.toFixed(2);
      bridleNezValue.textContent = `${currentBridle.nez.toFixed(2)}m`;

      bridleNezSlider.oninput = () => {
        const length = parseFloat(bridleNezSlider.value);
        this.simulation.setBridleLength("nez", length);
        bridleNezValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    const bridleInterSlider = document.getElementById("bridle-inter") as HTMLInputElement | null;
    const bridleInterValue = document.getElementById("bridle-inter-value");
    if (bridleInterSlider && bridleInterValue) {
      bridleInterSlider.value = currentBridle.inter.toFixed(2);
      bridleInterValue.textContent = `${currentBridle.inter.toFixed(2)}m`;

      bridleInterSlider.oninput = () => {
        const length = parseFloat(bridleInterSlider.value);
        this.simulation.setBridleLength("inter", length);
        bridleInterValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    const bridleCentreSlider = document.getElementById("bridle-centre") as HTMLInputElement | null;
    const bridleCentreValue = document.getElementById("bridle-centre-value");
    if (bridleCentreSlider && bridleCentreValue) {
      bridleCentreSlider.value = currentBridle.centre.toFixed(2);
      bridleCentreValue.textContent = `${currentBridle.centre.toFixed(2)}m`;

      bridleCentreSlider.oninput = () => {
        const length = parseFloat(bridleCentreSlider.value);
        this.simulation.setBridleLength("centre", length);
        bridleCentreValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    const linearDampingSlider = document.getElementById("linear-damping") as HTMLInputElement | null;
    const linearDampingValue = document.getElementById("linear-damping-value");
    if (linearDampingSlider && linearDampingValue) {
      linearDampingSlider.value = CONFIG.physics.linearDampingCoeff.toFixed(2);
      linearDampingValue.textContent = CONFIG.physics.linearDampingCoeff.toFixed(2);

      linearDampingSlider.oninput = () => {
        const damping = parseFloat(linearDampingSlider.value);
        CONFIG.physics.linearDampingCoeff = damping;
        linearDampingValue.textContent = damping.toFixed(2);
      };
    }

    const angularDampingSlider = document.getElementById("angular-damping") as HTMLInputElement | null;
    const angularDampingValue = document.getElementById("angular-damping-value");
    if (angularDampingSlider && angularDampingValue) {
      angularDampingSlider.value = CONFIG.physics.angularDragFactor.toFixed(2);
      angularDampingValue.textContent = CONFIG.physics.angularDragFactor.toFixed(2);

      angularDampingSlider.oninput = () => {
        const dragFactor = parseFloat(angularDampingSlider.value);
        CONFIG.physics.angularDragFactor = dragFactor;
        angularDampingValue.textContent = dragFactor.toFixed(2);
      };
    }

    const meshLevelSlider = document.getElementById("mesh-subdivision-level") as HTMLInputElement | null;
    const meshLevelValue = document.getElementById("mesh-subdivision-level-value");
    if (meshLevelSlider && meshLevelValue) {
      meshLevelSlider.value = CONFIG.kite.defaultMeshSubdivisionLevel.toString();
      meshLevelValue.textContent = `${CONFIG.kite.defaultMeshSubdivisionLevel} (${Math.pow(4, CONFIG.kite.defaultMeshSubdivisionLevel + 1)} triangles)`;

      meshLevelSlider.oninput = () => {
        const level = parseInt(meshLevelSlider.value, 10);
        CONFIG.kite.defaultMeshSubdivisionLevel = level;
        KiteGeometry.setMeshSubdivisionLevel(level);
        const triangleCount = Math.pow(4, level + 1);
        meshLevelValue.textContent = `${level} (${triangleCount} triangles)`;
        console.log(`🔧 Maillage changé : niveau ${level} = ${triangleCount} triangles`);
      };
    }

    const liftScaleSlider = document.getElementById("lift-scale") as HTMLInputElement | null;
    const liftScaleValue = document.getElementById("lift-scale-value");
    if (liftScaleSlider && liftScaleValue) {
      liftScaleSlider.value = CONFIG.aero.liftScale.toFixed(2);
      liftScaleValue.textContent = CONFIG.aero.liftScale.toFixed(2);

      liftScaleSlider.oninput = () => {
        const scale = parseFloat(liftScaleSlider.value);
        CONFIG.aero.liftScale = scale;
        liftScaleValue.textContent = scale.toFixed(2);
      };
    }

    const dragScaleSlider = document.getElementById("drag-scale") as HTMLInputElement | null;
    const dragScaleValue = document.getElementById("drag-scale-value");
    if (dragScaleSlider && dragScaleValue) {
      dragScaleSlider.value = CONFIG.aero.dragScale.toFixed(2);
      dragScaleValue.textContent = CONFIG.aero.dragScale.toFixed(2);

      dragScaleSlider.oninput = () => {
        const scale = parseFloat(dragScaleSlider.value);
        CONFIG.aero.dragScale = scale;
        dragScaleValue.textContent = scale.toFixed(2);
      };
    }

    const forceSmoothingSlider = document.getElementById("force-smoothing") as HTMLInputElement | null;
    const forceSmoothingValue = document.getElementById("force-smoothing-value");
    if (forceSmoothingSlider && forceSmoothingValue) {
      const currentSmoothing = this.simulation.getForceSmoothing();
      forceSmoothingSlider.value = currentSmoothing.toFixed(2);
      forceSmoothingValue.textContent = currentSmoothing.toFixed(2);

      forceSmoothingSlider.oninput = () => {
        const smoothing = parseFloat(forceSmoothingSlider.value);
        this.simulation.setForceSmoothing(smoothing);
        forceSmoothingValue.textContent = smoothing.toFixed(2);
      };
    }
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