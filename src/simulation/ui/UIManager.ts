import { PhysicsEngine } from "../physics/PhysicsEngine";
import { CONFIG } from "../config/SimulationConfig";
import { DebugRenderer } from "../rendering/DebugRenderer";
import { KiteGeometry } from "../config/KiteGeometry";

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

    // Contrôles des brides (3 sliders indépendants)
    // Récupérer les valeurs actuelles depuis le Kite
    const currentBridleLengths = this.physicsEngine.getBridleLengths();
    
    const bridleNezSlider = document.getElementById("bridle-nez") as HTMLInputElement;
    const bridleNezValue = document.getElementById("bridle-nez-value");
    if (bridleNezSlider && bridleNezValue) {
      bridleNezSlider.value = currentBridleLengths.nez.toString();
      bridleNezValue.textContent = `${currentBridleLengths.nez.toFixed(2)}m`;

      bridleNezSlider.oninput = () => {
        const length = parseFloat(bridleNezSlider.value);
        this.physicsEngine.setBridleLength('nez', length);
        bridleNezValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    const bridleInterSlider = document.getElementById("bridle-inter") as HTMLInputElement;
    const bridleInterValue = document.getElementById("bridle-inter-value");
    if (bridleInterSlider && bridleInterValue) {
      bridleInterSlider.value = currentBridleLengths.inter.toString();
      bridleInterValue.textContent = `${currentBridleLengths.inter.toFixed(2)}m`;

      bridleInterSlider.oninput = () => {
        const length = parseFloat(bridleInterSlider.value);
        this.physicsEngine.setBridleLength('inter', length);
        bridleInterValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    const bridleCentreSlider = document.getElementById("bridle-centre") as HTMLInputElement;
    const bridleCentreValue = document.getElementById("bridle-centre-value");
    if (bridleCentreSlider && bridleCentreValue) {
      bridleCentreSlider.value = currentBridleLengths.centre.toString();
      bridleCentreValue.textContent = `${currentBridleLengths.centre.toFixed(2)}m`;

      bridleCentreSlider.oninput = () => {
        const length = parseFloat(bridleCentreSlider.value);
        this.physicsEngine.setBridleLength('centre', length);
        bridleCentreValue.textContent = `${length.toFixed(2)}m`;
      };
    }

    // Contrôles de damping physique
    const linearDampingSlider = document.getElementById(
      "linear-damping"
    ) as HTMLInputElement;
    const linearDampingValue = document.getElementById("linear-damping-value");
    if (linearDampingSlider && linearDampingValue) {
      linearDampingSlider.value = CONFIG.physics.linearDampingCoeff.toString();
      linearDampingValue.textContent = CONFIG.physics.linearDampingCoeff.toFixed(2);

      linearDampingSlider.oninput = () => {
        const damping = parseFloat(linearDampingSlider.value);
        CONFIG.physics.linearDampingCoeff = damping;
        linearDampingValue.textContent = damping.toFixed(2);
      };
    }

    const angularDampingSlider = document.getElementById(
      "angular-damping"
    ) as HTMLInputElement;
    const angularDampingValue = document.getElementById("angular-damping-value");
    if (angularDampingSlider && angularDampingValue) {
      angularDampingSlider.value = CONFIG.physics.angularDragFactor.toString();
      angularDampingValue.textContent = CONFIG.physics.angularDragFactor.toFixed(2);

      angularDampingSlider.oninput = () => {
        const dragFactor = parseFloat(angularDampingSlider.value);
        CONFIG.physics.angularDragFactor = dragFactor;
        angularDampingValue.textContent = dragFactor.toFixed(2);
      };
    }

    // 🔧 Contrôle du niveau de subdivision du maillage
    const meshLevelSlider = document.getElementById(
      "mesh-subdivision-level"
    ) as HTMLInputElement;
    const meshLevelValue = document.getElementById("mesh-subdivision-level-value");
    if (meshLevelSlider && meshLevelValue) {
      meshLevelSlider.value = CONFIG.kite.defaultMeshSubdivisionLevel.toString();
      meshLevelValue.textContent = `${CONFIG.kite.defaultMeshSubdivisionLevel} (${Math.pow(4, CONFIG.kite.defaultMeshSubdivisionLevel + 1)} triangles)`;

      meshLevelSlider.oninput = () => {
        const level = parseInt(meshLevelSlider.value);
        CONFIG.kite.defaultMeshSubdivisionLevel = level;
        KiteGeometry.setMeshSubdivisionLevel(level);
        const triangleCount = Math.pow(4, level + 1);
        meshLevelValue.textContent = `${level} (${triangleCount} triangles)`;
        console.log(`🔧 Maillage changé : niveau ${level} = ${triangleCount} triangles`);
      };
    }

    // Contrôles aérodynamiques
    const liftScaleSlider = document.getElementById(
      "lift-scale"
    ) as HTMLInputElement;
    const liftScaleValue = document.getElementById("lift-scale-value");
    if (liftScaleSlider && liftScaleValue) {
      liftScaleSlider.value = CONFIG.aero.liftScale.toString();
      liftScaleValue.textContent = CONFIG.aero.liftScale.toFixed(2);

      liftScaleSlider.oninput = () => {
        const scale = parseFloat(liftScaleSlider.value);
        CONFIG.aero.liftScale = scale;
        liftScaleValue.textContent = scale.toFixed(2);
      };
    }

    const dragScaleSlider = document.getElementById(
      "drag-scale"
    ) as HTMLInputElement;
    const dragScaleValue = document.getElementById("drag-scale-value");
    if (dragScaleSlider && dragScaleValue) {
      dragScaleSlider.value = CONFIG.aero.dragScale.toString();
      dragScaleValue.textContent = CONFIG.aero.dragScale.toFixed(2);

      dragScaleSlider.oninput = () => {
        const scale = parseFloat(dragScaleSlider.value);
        CONFIG.aero.dragScale = scale;
        dragScaleValue.textContent = scale.toFixed(2);
      };
    }

    // Contrôle du lissage des forces physiques
    const forceSmoothingSlider = document.getElementById(
      "force-smoothing"
    ) as HTMLInputElement;
    const forceSmoothingValue = document.getElementById("force-smoothing-value");
    if (forceSmoothingSlider && forceSmoothingValue) {
      forceSmoothingSlider.value = this.physicsEngine.getForceSmoothing().toString();
      forceSmoothingValue.textContent = this.physicsEngine.getForceSmoothing().toFixed(2);

      forceSmoothingSlider.oninput = () => {
        const smoothing = parseFloat(forceSmoothingSlider.value);
        this.physicsEngine.setForceSmoothing(smoothing);
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
}