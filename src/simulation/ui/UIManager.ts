import { PhysicsEngine } from "../physics/PhysicsEngine";
import { CONFIG } from "../config/SimulationConfig";
import { DebugRenderer } from "../rendering/DebugRenderer";

/**
 * Gestionnaire de l'interface utilisateur
 *
 * Gère les contrôles et interactions utilisateur
 */
export class UIManager {
  private physicsEngine: PhysicsEngine;
  private debugRenderer: DebugRenderer;
  private resetCallback: () => void;
  private togglePlayCallback: () => void;

  constructor(
    physicsEngine: PhysicsEngine,
    debugRenderer: DebugRenderer,
    resetCallback: () => void,
    togglePlayCallback: () => void
  ) {
    this.physicsEngine = physicsEngine;
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
      // Initialiser l'état du bouton
      debugBtn.textContent = this.debugRenderer.isDebugMode() ? "🔍 Debug ON" : "🔍 Debug OFF";
      debugBtn.classList.toggle("active", this.debugRenderer.isDebugMode());

      debugBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.debugRenderer.toggleDebugMode();
      });
    }

    // Activer la classe debug-mode sur le body si debugMode est true
    if (this.debugRenderer.isDebugMode()) {
      document.body.classList.add("debug-mode");
      // Afficher le panneau de debug si le mode debug est activé
      const debugPanel = document.getElementById("debug-panel");
      if (debugPanel) {
        debugPanel.style.display = "block";
      }
    }

    this.setupWindControls();
  }

  private setupWindControls(): void {
    // Configuration des contrôles de vent
    const speedSlider = document.getElementById(
      "wind-speed"
    ) as HTMLInputElement;
    const speedValue = document.getElementById("wind-speed-value");
    if (speedSlider && speedValue) {
      speedSlider.value = CONFIG.wind.defaultSpeed.toString();
      speedValue.textContent = `${CONFIG.wind.defaultSpeed} km/h`;

      speedSlider.oninput = () => {
        const speed = parseFloat(speedSlider.value);
        this.physicsEngine.setWindParams({ speed });
        speedValue.textContent = `${speed} km/h`;
      };
    }

    const dirSlider = document.getElementById(
      "wind-direction"
    ) as HTMLInputElement;
    const dirValue = document.getElementById("wind-direction-value");
    if (dirSlider && dirValue) {
      dirSlider.value = CONFIG.wind.defaultDirection.toString();
      dirValue.textContent = `${CONFIG.wind.defaultDirection}°`;

      dirSlider.oninput = () => {
        const direction = parseFloat(dirSlider.value);
        this.physicsEngine.setWindParams({ direction });
        dirValue.textContent = `${direction}°`;
      };
    }

    const turbSlider = document.getElementById(
      "wind-turbulence"
    ) as HTMLInputElement;
    const turbValue = document.getElementById("wind-turbulence-value");
    if (turbSlider && turbValue) {
      turbSlider.value = CONFIG.wind.defaultTurbulence.toString();
      turbValue.textContent = `${CONFIG.wind.defaultTurbulence}%`;

      turbSlider.oninput = () => {
        const turbulence = parseFloat(turbSlider.value);
        this.physicsEngine.setWindParams({ turbulence });
        turbValue.textContent = `${turbulence}%`;
      };
    }

    const lengthSlider = document.getElementById(
      "line-length"
    ) as HTMLInputElement;
    const lengthValue = document.getElementById("line-length-value");
    if (lengthSlider && lengthValue) {
      lengthSlider.value = CONFIG.lines.defaultLength.toString();
      lengthValue.textContent = `${CONFIG.lines.defaultLength}m`;

      lengthSlider.oninput = () => {
        const length = parseFloat(lengthSlider.value);
        this.physicsEngine.setLineLength(length);
        lengthValue.textContent = `${length}m`;
      };
    }

    const bridleSlider = document.getElementById(
      "bridle-length"
    ) as HTMLInputElement;
    const bridleValue = document.getElementById("bridle-length-value");
    if (bridleSlider && bridleValue) {
      bridleSlider.value = "100";
      bridleValue.textContent = "100%";

      bridleSlider.oninput = () => {
        const percent = parseFloat(bridleSlider.value);
        const bridleFactor = percent / 100;
        this.physicsEngine.setBridleFactor(bridleFactor);
        bridleValue.textContent = `${percent}%`;
      };
    }
  }

  updatePlayButton(isPlaying: boolean): void {
    const playBtn = document.getElementById("play-pause");
    if (playBtn) {
      playBtn.textContent = isPlaying ? "⏸️ Pause" : "▶️ Lancer";
    }
  }
}