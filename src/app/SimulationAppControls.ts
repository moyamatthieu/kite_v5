/**
 * SimulationAppControls.ts - Gestionnaire des contrôles et entrées
 *
 * Gère la configuration des contrôles clavier, UI et sliders pour la simulation.
 */

import { SimulationApp } from "./SimulationApp";
import { INPUT_CONFIG } from "../config/InputConfig";
import { CONFIG } from "../config/GlobalConfig";

export class SimulationAppControls {
  private app: SimulationApp;

  constructor(app: SimulationApp) {
    this.app = app;
  }

  setupControls(): void {
    // Les contrôles sont gérés automatiquement par InputHandler

    // Contrôles avancés
    window.addEventListener("keydown", (event) => {
      // Utiliser les touches de la configuration centralisée
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (key === INPUT_CONFIG.general.pause.primary) {
        event.preventDefault();
        this.app.togglePause();
      } else if (key === INPUT_CONFIG.general.reset.primary) {
        this.app.resetSimulation();
      } else if (key === INPUT_CONFIG.general.debug.primary) {
        this.app.toggleDebugMode();
      } else if (key === INPUT_CONFIG.general.debugVisuals.primary) {
        this.app.toggleDebugVisuals();
      }
    });
  }

  setupUIControls(): void {
    // Boutons de contrôle
    const playPauseBtn = document.getElementById("play-pause");
    const resetBtn = document.getElementById("reset-sim");
    const debugBtn = document.getElementById("debug-physics");

    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", () => {
        this.app.togglePause();
        playPauseBtn.textContent = this.app.isPlaying ? "⏸️ Pause" : "▶️ Play";
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.app.resetSimulation();
      });
    }

    if (debugBtn) {
      debugBtn.addEventListener("click", () => {
        this.app.toggleFullDebug();
        debugBtn.textContent = this.app.debugMode
          ? "🔍 Debug ON"
          : "🔍 Debug OFF";
        debugBtn.classList.toggle("active", this.app.debugMode);
      });
    }

    // Contrôles du vent
    this.setupWindControls();

    // Contrôles des lignes
    this.setupLineControls();
  }

  private setupWindControls(): void {
    const windSpeedSlider = document.getElementById(
      "wind-speed"
    ) as HTMLInputElement;
    const windSpeedValue = document.getElementById("wind-speed-value");
    const windDirectionSlider = document.getElementById(
      "wind-direction"
    ) as HTMLInputElement;
    const windDirectionValue = document.getElementById("wind-direction-value");
    const windTurbulenceSlider = document.getElementById(
      "wind-turbulence"
    ) as HTMLInputElement;
    const windTurbulenceValue = document.getElementById(
      "wind-turbulence-value"
    );

    if (windSpeedSlider && windSpeedValue) {
      windSpeedSlider.addEventListener("input", () => {
        const speed = parseInt(windSpeedSlider.value);
        windSpeedValue.textContent = `${speed} km/h`;
        // Supprimer le log pour éviter le flood
        this.app.setWindParams({ speed: speed }); // Utiliser app.setWindParams (public)
      });
    }

    if (windDirectionSlider && windDirectionValue) {
      windDirectionSlider.addEventListener("input", () => {
        const direction = parseInt(windDirectionSlider.value);
        windDirectionValue.textContent = `${direction}°`;
        // Supprimer le log pour éviter le flood
        this.app.setWindParams({ direction: direction });
      });
    }

    if (windTurbulenceSlider && windTurbulenceValue) {
      windTurbulenceSlider.addEventListener("input", () => {
        const turbulence = parseInt(windTurbulenceSlider.value);
        windTurbulenceValue.textContent = `${turbulence}%`;
        console.log(`Slider turbulence: ${turbulence}% → setWindParams appelé`);
        this.app.setWindParams({ turbulence: turbulence });
      });
    }
  }

  private setupLineControls(): void {
    const lineLengthSlider = document.getElementById(
      "line-length"
    ) as HTMLInputElement;
    const lineLengthValue = document.getElementById("line-length-value");
    const bridleLengthSlider = document.getElementById(
      "bridle-length"
    ) as HTMLInputElement;
    const bridleLengthValue = document.getElementById("bridle-length-value");

    if (lineLengthSlider && lineLengthValue) {
      lineLengthSlider.addEventListener("input", () => {
        const length = parseInt(lineLengthSlider.value);
        lineLengthValue.textContent = `${length}m`;
        console.log(`Slider lignes: ${length}m → setLineLength appelé`);
        this.app.setLineLength(length);
      });
    }

    if (bridleLengthSlider && bridleLengthValue) {
      bridleLengthSlider.addEventListener("input", () => {
        const length = parseFloat(bridleLengthSlider.value);
        bridleLengthValue.textContent = `${length}m`;
        // TODO: Implémenter setBridleLength si nécessaire
        console.log(`Longueur bride: ${length}m`);
      });
    }
  }
}
