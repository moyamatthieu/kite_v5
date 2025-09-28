/**
 * SimulationUI.ts - Interface spécialisée pour la simulation de cerf-volant
 * Utilise le UIManager pour organiser intelligemment tous les panneaux
 */

import { UIManager, PanelConfig } from "./UIManager.js";
import nipplejs from "nipplejs";
import Chart from "chart.js/auto";
import { CONFIG } from "../config/GlobalConfig";

export class SimulationUI {
  private uiManager: UIManager;
  private updateCallbacks: Map<string, () => void> = new Map();
  private isInitialized = false;
  private speedChart: Chart | null = null;

  // Référence à SimulationApp pour setWindParams/setLineLength
  private appReference: any = null;

  constructor(container: HTMLElement) {
    this.uiManager = new UIManager(container);
    this.initializePanels();
    this.setupEventListeners();
    this.isInitialized = true;
  }

  /**
   * Connecte la référence à SimulationApp pour appeler setWindParams
   */
  setAppReference(app: any): void {
    this.appReference = app;
  }

  /**
   * Initialise tous les panneaux de la simulation (réorganisés par priorité)
   */
  private initializePanels(): void {
    // Panneaux principaux (haute priorité)
    this.createModeSelector();
    this.createSimulationControlsPanel();
    this.createWindControlsPanel();
    this.createInfoPanel();

    // Panneau debug (priorité moyenne)
    this.createDebugPanel();
  }


  /**
   * Panneau de contrôles du vent
   */
  private createWindControlsPanel(): void {
    const windControls = document.createElement("div");
    windControls.innerHTML = `
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Vitesse du vent</label>
                <input type="range" id="wind-speed" min="0" max="50" value="18" step="1" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-speed-value" style="color: #aaa; font-size: 11px;">18 km/h</span>
            </div>
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Direction</label>
                <input type="range" id="wind-direction" min="0" max="360" value="0" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-direction-value" style="color: #aaa; font-size: 11px;">0°</span>
            </div>
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Turbulence</label>
                <input type="range" id="wind-turbulence" min="0" max="100" value="3" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-turbulence-value" style="color: #aaa; font-size: 11px;">3%</span>
            </div>
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Longueur lignes</label>
                <input type="range" id="line-length" min="10" max="50" value="15" step="1" style="width: 100%; margin-bottom: 4px;">
                <span id="line-length-value" style="color: #aaa; font-size: 11px;">15m</span>
            </div>
            <div class="wind-control">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Longueur brides</label>
                <input type="range" id="bridle-length" min="50" max="150" value="100" step="5" style="width: 100%; margin-bottom: 4px;">
                <span id="bridle-length-value" style="color: #aaa; font-size: 11px;">100%</span>
            </div>
        `;

    const config: PanelConfig = {
      id: "wind-controls",
      title: "🌬️ Paramètres du vent",
      width: 280,
      height: 320,
      position: "top-left",
      priority: 8,
      content: windControls,
    };
    this.uiManager.createPanel(config);

    // AJOUTER LES EVENT LISTENERS MANQUANTS ICI
    this.setupWindControlsListeners();
  }

  /**
   * Configure les event listeners pour les contrôles de vent
   */
  private setupWindControlsListeners(): void {
    // Event listeners pour sliders vent
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
    const lineLengthSlider = document.getElementById(
      "line-length"
    ) as HTMLInputElement;
    const lineLengthValue = document.getElementById("line-length-value");

    if (windSpeedSlider && windSpeedValue) {
      windSpeedSlider.addEventListener("input", () => {
        const speed = parseInt(windSpeedSlider.value);
        windSpeedValue.textContent = `${speed} km/h`;
        // Supprimer le log de slider vent pour éviter le flood
        if (this.appReference) {
          this.appReference.setWindParams({ speed: speed });
        }
      });
    }

    if (windDirectionSlider && windDirectionValue) {
      windDirectionSlider.addEventListener("input", () => {
        const direction = parseInt(windDirectionSlider.value);
        windDirectionValue.textContent = `${direction}°`;
        // Supprimer le log de slider direction pour éviter le flood
        if (this.appReference) {
          this.appReference.setWindParams({ direction: direction });
        }
      });
    }

    if (windTurbulenceSlider && windTurbulenceValue) {
      windTurbulenceSlider.addEventListener("input", () => {
        const turbulence = parseInt(windTurbulenceSlider.value);
        windTurbulenceValue.textContent = `${turbulence}%`;
        console.log(`🌪️ Slider turbulence: ${turbulence}%`);
        if (this.appReference) {
          this.appReference.setWindParams({ turbulence: turbulence });
        }
      });
    }

    if (lineLengthSlider && lineLengthValue) {
      lineLengthSlider.addEventListener("input", () => {
        const length = parseInt(lineLengthSlider.value);
        lineLengthValue.textContent = `${length}m`;
        console.log(`🔗 Slider lignes: ${length}m`);
        if (this.appReference) {
          this.appReference.setLineLength(length);
        }
      });
    }
  }

  /**
   * Panneau de contrôles de simulation
   */
  private createSimulationControlsPanel(): void {
    const controls = document.createElement("div");
    controls.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="reset-sim" style="
                    padding: 12px 20px; 
                    background: linear-gradient(135deg, #ff6b6b, #ee5a52); 
                    border: none; 
                    color: white; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-weight: 600;
                    transition: all 0.3s;
                    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
                ">🔄 Reset Simulation</button>
                
                <button id="play-pause" style="
                    padding: 12px 20px; 
                    background: linear-gradient(135deg, #51cf66, #47b35b); 
                    border: none; 
                    color: white; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-weight: 600;
                    transition: all 0.3s;
                    box-shadow: 0 4px 12px rgba(81, 207, 102, 0.3);
                ">▶️ Lancer</button>
                
                <button id="debug-physics" style="
                    padding: 12px 20px; 
                    background: linear-gradient(135deg, #667eea, #764ba2); 
                    border: none; 
                    color: white; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-weight: 600;
                    transition: all 0.3s;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                ">🔍 Debug OFF</button>
            </div>
        `;

    const config: PanelConfig = {
      id: "sim-controls",
      title: "🎮 Contrôles",
      width: 220,
      height: 200,
      position: "bottom-right",
      priority: 9,
      content: controls,
    };
    this.uiManager.createPanel(config);
  }

  /**
   * Panneau d'informations générales
   */
  private createInfoPanel(): void {
    const config: PanelConfig = {
      id: "sim-info",
      title: "📈 Informations de simulation",
      width: 280,
      height: 160,
      position: "bottom-left",
      priority: 10,
      content: `
                <div style="line-height: 1.8; color: #fff;">
                    <div><strong>Cerf-volant:</strong> <span id="kite-model">Delta V10</span></div>
                    <div><strong>Vent:</strong> <span id="wind-speed-display">12</span> km/h</div>
                    <div><strong>FPS:</strong> <span id="fps">60</span></div>
                    <div><strong>Physique:</strong> <span id="physics-status" style="color: #51cf66;">Active</span></div>
                    <div><strong>Mode:</strong> <span style="color: #667eea;">Simulation Avancée</span></div>
                </div>
            `,
    };
    this.uiManager.createPanel(config);
  }

  /**
   * Panneau de debug physique avec graphique temps réel
   */
  private createDebugPanel(): void {
    const debugContent = `
            <div id="debug-info" style="color: white; line-height: 1.4;">
                <div class="debug-section">
                    <h4>🔄 Chargement des données de debug...</h4>
                </div>
            </div>
        `;

    const config: PanelConfig = {
      id: "debug-panel",
      title: "🔬 Debug Physique",
      width: 320,
      height: 280, // Plus grand pour le graphique
      position: "top-right",
      priority: 8,
      content: debugContent,
    };
    this.uiManager.createPanel(config);

    // Masquer par défaut, sera rendu visible par toggleDebug
    const panel = this.uiManager.getPanel("debug-panel");
    if (panel) {
      panel.element.style.display = "none";
    }

    // Initialiser chart
    const ctx = document.getElementById("debug-chart") as HTMLCanvasElement;
    if (!ctx) return;

    this.speedChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [], // Temps
        datasets: [
          {
            label: "Vitesse Kite (m/s)",
            data: [],
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1,
          },
        ],
      },
      options: { responsive: true, scales: { y: { min: 0, max: 30 } } },
    });

    // Callback pour update (lier à SimulationApp.animate)
    this.updateCallbacks.set("debugChart", () => {
      if (!this.speedChart) return;

      // Récupérer vitesse de physicsEngine (assumer accès)
      const velocity = 5; // Placeholder, lier vraiment
      this.speedChart.data.labels?.push(new Date().toLocaleTimeString());
      this.speedChart.data.datasets[0].data.push(velocity);
      if ((this.speedChart.data.labels?.length ?? 0) > 50) {
        this.speedChart.data.labels?.shift();
        this.speedChart.data.datasets[0].data.shift();
      }
      this.speedChart.update("none");
    });
  }

  /**
   * Contrôle la visibilité du panel de debug
   */
  public toggleDebugPanel(visible: boolean): void {
    const panel = this.uiManager.getPanel("debug-panel");
    if (panel) {
      panel.element.style.display = visible ? "block" : "none";
      console.log(`🔬 Panel debug: ${visible ? 'visible' : 'masqué'}`);
    }
  }

  /**
   * Sélecteur de mode en haut
   */
  private createModeSelector(): void {
    const selector = document.createElement("div");
    selector.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center;">
                <label style="color: #aaa; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">MODE:</label>
                <button id="mode-cao" style="
                    padding: 10px 18px; 
                    background: #444; 
                    border: 2px solid transparent; 
                    color: white; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-size: 13px; 
                    transition: all 0.3s;
                    min-width: 80px;
                ">CAO</button>
                <button id="mode-simulation" style="
                    padding: 10px 18px; 
                    background: #667eea; 
                    border: 2px solid #764ba2; 
                    color: white; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-size: 13px; 
                    transition: all 0.3s;
                    min-width: 80px;
                    box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
                ">Simulation</button>
            </div>
        `;

    const config: PanelConfig = {
      id: "mode-selector",
      title: "",
      width: 300,
      height: 50,
      position: "top-left",
      priority: 10,
      content: selector,
      className: "no-header",
    };

    const panel = this.uiManager.createPanel(config);

    // Masquer l'en-tête pour ce panneau
    const header = panel.element.querySelector(
      ".ui-panel-header"
    ) as HTMLElement;
    if (header) {
      header.style.display = "none";
    }

    // Ajuster la hauteur du contenu
    const content = panel.element.querySelector(
      ".ui-panel-content"
    ) as HTMLElement;
    if (content) {
      content.style.height = "100%";
      content.style.display = "flex";
      content.style.alignItems = "center";
      content.style.justifyContent = "center";
    }
  }


  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    // Redimensionnement de fenêtre
    window.addEventListener("resize", () => {
      this.uiManager.resize();
    });

    // Délégation d'événements pour tous les boutons
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      switch (target.id) {
        case "mode-cao":
          this.handleModeSwitch();
          break;
        case "reset-sim":
          this.handleResetSimulation();
          break;
        case "play-pause":
          this.handlePlayPause();
          break;
        case "debug-physics":
          this.handleDebugToggle();
          break;
      }
    });

    // Joystick pour mobile
    window.addEventListener("joystickRotate", (e: any) => {
      if (this.appReference && this.appReference.inputHandler) {
        // Transmettre la rotation au gestionnaire d'entrées
        this.appReference.inputHandler.setTargetBarRotation(e.detail.rotation);
      }
    });

    // Écouter les événements de clavier pour synchroniser l'interface
    window.addEventListener("keydown", (e) => {
      this.handleKeyboardEvents(e);
    });
  }

  /**
   * Met à jour le contenu d'un panneau
   */
  updatePanel(panelId: string, content: string | HTMLElement): void {
    this.uiManager.updatePanelContent(panelId, content);
  }


  /**
   * Met à jour les valeurs en temps réel avec indicateurs visuels
   */
  updateRealTimeValues(data: {
    fps?: number;
    windSpeed?: number;
    force?: number;
    tension?: number;
    altitude?: number;
    physicsStatus?: string;
    kitePosition?: { x: number; y: number; z: number };
    velocity?: number;
  }): void {
    if (data.fps !== undefined) {
      const fpsEl = document.getElementById("fps");
      if (fpsEl) {
        fpsEl.textContent = data.fps.toString();
        // Colorier selon les performances
        fpsEl.style.color = data.fps > 45 ? "#51cf66" : data.fps > 30 ? "#ffa726" : "#ff6b6b";
      }
    }

    if (data.windSpeed !== undefined) {
      const windEl = document.getElementById("wind-speed-display");
      if (windEl) windEl.textContent = data.windSpeed.toString();
    }

    if (data.force !== undefined) {
      const forceEl = document.getElementById("force-display");
      if (forceEl) forceEl.textContent = Math.round(data.force).toString();
    }

    if (data.tension !== undefined) {
      const tensionEl = document.getElementById("tension-display");
      if (tensionEl)
        tensionEl.textContent = Math.round(data.tension).toString();
    }

    if (data.altitude !== undefined) {
      const altEl = document.getElementById("altitude-display");
      if (altEl) altEl.textContent = data.altitude.toFixed(1);
    }

    if (data.physicsStatus !== undefined) {
      const statusEl = document.getElementById("physics-status");
      if (statusEl) {
        statusEl.textContent = data.physicsStatus;
        statusEl.style.color =
          data.physicsStatus === "Active" ? "#51cf66" : "#ff6b6b";
      }
    }

    // Mettre à jour le graphique de debug si visible
    if (this.speedChart && data.velocity !== undefined) {
      this.updateDebugChart(data.velocity);
    }
  }

  /**
   * Met à jour le graphique de debug
   */
  private updateDebugChart(velocity: number): void {
    if (!this.speedChart) return;

    this.speedChart.data.labels?.push(new Date().toLocaleTimeString());
    this.speedChart.data.datasets[0].data.push(velocity);

    // Garder seulement les 30 derniers points
    if ((this.speedChart.data.labels?.length ?? 0) > 30) {
      this.speedChart.data.labels?.shift();
      this.speedChart.data.datasets[0].data.shift();
    }

    this.speedChart.update("none");
  }

  /**
   * Affiche une notification temporaire
   */
  showNotification(message: string, type: "info" | "success" | "warning" | "error" = "info"): void {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      animation: slideInFromTop 0.3s ease-out;
      backdrop-filter: blur(10px);
    `;

    const colors = {
      info: "rgba(102, 126, 234, 0.9)",
      success: "rgba(81, 207, 102, 0.9)",
      warning: "rgba(255, 167, 38, 0.9)",
      error: "rgba(255, 107, 107, 0.9)"
    };

    notification.style.background = colors[type];
    notification.textContent = message;

    document.body.appendChild(notification);

    // Retirer après 3 secondes
    setTimeout(() => {
      notification.style.animation = "slideOutToTop 0.3s ease-in";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Enregistre un callback de mise à jour
   */
  onUpdate(panelId: string, callback: () => void): void {
    this.updateCallbacks.set(panelId, callback);
  }

  /**
   * Gestionnaires d'événements pour les boutons
   */
  private handleModeSwitch(): void {
    console.log("🔄 Changement de mode vers CAO");
    document.body.style.transition = "opacity 0.3s";
    document.body.style.opacity = "0";
    setTimeout(() => {
      window.location.href = "/";
    }, 300);
  }

  private handleResetSimulation(): void {
    console.log("🔄 Reset de la simulation");
    if (this.appReference && this.appReference.reset) {
      this.appReference.reset();
      this.showNotification("🔄 Simulation réinitialisée", "success");
    }
    this.updateButtonState("reset-sim", "🔄 Reset effectué", 1000);
  }

  private handlePlayPause(): void {
    console.log("⏯️ Toggle Play/Pause");
    if (this.appReference) {
      const isPlaying = this.appReference.isPlaying;
      this.appReference.isPlaying = !isPlaying;

      const button = document.getElementById("play-pause");
      if (button) {
        button.textContent = this.appReference.isPlaying ? "⏸️ Pause" : "▶️ Lancer";
        button.style.background = this.appReference.isPlaying
          ? "linear-gradient(135deg, #ffa726, #ff7043)"
          : "linear-gradient(135deg, #51cf66, #47b35b)";
      }
    }
  }

  private handleDebugToggle(): void {
    console.log("🔍 Toggle Debug");
    if (this.appReference) {
      this.appReference.debugMode = !this.appReference.debugMode;

      const button = document.getElementById("debug-physics");
      if (button) {
        button.textContent = this.appReference.debugMode ? "🔍 Debug ON" : "🔍 Debug OFF";
        button.style.background = this.appReference.debugMode
          ? "linear-gradient(135deg, #4caf50, #2e7d32)"
          : "linear-gradient(135deg, #667eea, #764ba2)";
      }

      // Afficher/masquer le panneau de debug
      this.toggleDebugPanel(this.appReference.debugMode);
    }
  }

  private handleKeyboardEvents(e: KeyboardEvent): void {
    // Synchroniser l'interface avec les raccourcis clavier
    switch (e.key.toLowerCase()) {
      case " ": // Espace
        this.handlePlayPause();
        break;
      case "r":
        this.handleResetSimulation();
        break;
      case "f1":
        e.preventDefault();
        this.handleDebugToggle();
        break;
    }
  }

  private updateButtonState(buttonId: string, tempText: string, duration: number): void {
    const button = document.getElementById(buttonId);
    if (button) {
      const originalText = button.textContent;
      button.textContent = tempText;
      button.style.opacity = "0.7";
      setTimeout(() => {
        button.textContent = originalText;
        button.style.opacity = "1";
      }, duration);
    }
  }

  /**
   * Nettoie l'interface
   */
  cleanup(): void {
    this.updateCallbacks.clear();
    if (this.speedChart) {
      this.speedChart.destroy();
    }
    // Le UIManager se charge du nettoyage des panneaux
  }

  /**
   * Obtient le gestionnaire UI sous-jacent
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }

  /**
   * Méthode pour définir la rotation de la barre (pour compatibilité)
   */
  setTargetBarRotation(rotation: number): void {
    if (this.appReference && this.appReference.inputHandler) {
      // Transmettre la rotation au gestionnaire d'entrées
      this.appReference.inputHandler.commandContext.controlState.barRotation = rotation;
    }
  }
}
