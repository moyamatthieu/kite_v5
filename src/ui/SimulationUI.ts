/**
 * SimulationUI.ts - Interface spécialisée pour la simulation de cerf-volant
 * Utilise le UIManager pour organiser intelligemment tous les panneaux
 */

import { UIManager, PanelConfig } from './UIManager.js';

export class SimulationUI {
    private uiManager: UIManager;
    private updateCallbacks: Map<string, () => void> = new Map();
    private isInitialized = false;

    constructor(container: HTMLElement) {
        this.uiManager = new UIManager(container);
        this.initializePanels();
        this.setupEventListeners();
        this.isInitialized = true;
    }

    /**
     * Initialise tous les panneaux de la simulation
     */
    private initializePanels(): void {
        this.createVersionPanel();
        this.createSystemStatusPanel();
        this.createWindControlsPanel();
        this.createSimulationControlsPanel();
        this.createInfoPanel();
        this.createDebugPanel();
        this.createModeSelector();
    }

    /**
     * Panneau de version
     */
    private createVersionPanel(): void {
        const config: PanelConfig = {
            id: 'version-panel',
            title: '🏷️ Version du simulateur',
            width: 400,
            height: 120,
            position: 'bottom-left',
            priority: 10,
            collapsible: true,
            content: `
                <div style="color: #667eea; line-height: 1.6;">
                    <div><strong>SimulationV10</strong> - Architecture modulaire (système, pilote, barre, lignes)</div>
                    <div><strong>Moteur:</strong> Three.js r160 + Vite</div>
                    <div><strong>UI:</strong> Panneaux auto‑organisés, sans superpositions</div>
                    <div><strong>Monde:</strong> Sol vert, ciel, lumières réalistes</div>
                </div>
            `
        };
        this.uiManager.createPanel(config);
    }

    /**
     * Panneau d'état du système
     */
    private createSystemStatusPanel(): void {
        const config: PanelConfig = {
            id: 'system-status',
            title: '📊 État du système',
            width: 400,
            height: 180,
            position: 'bottom-left',
            priority: 9,
            content: '<div id="periodic-log" style="color: #00ff88; font-family: monospace; font-size: 11px;">En attente...</div>'
        };
        this.uiManager.createPanel(config);
    }

    /**
     * Panneau de contrôles du vent
     */
    private createWindControlsPanel(): void {
        const windControls = document.createElement('div');
        windControls.innerHTML = `
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Vitesse du vent</label>
                <input type="range" id="wind-speed" min="0" max="50" value="12" step="1" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-speed-value" style="color: #aaa; font-size: 11px;">12 km/h</span>
            </div>
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Direction</label>
                <input type="range" id="wind-direction" min="0" max="360" value="0" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-direction-value" style="color: #aaa; font-size: 11px;">0°</span>
            </div>
            <div class="wind-control" style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #667eea;">Turbulence</label>
                <input type="range" id="wind-turbulence" min="0" max="100" value="5" style="width: 100%; margin-bottom: 4px;">
                <span id="wind-turbulence-value" style="color: #aaa; font-size: 11px;">5%</span>
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
            id: 'wind-controls',
            title: '🌬️ Paramètres du vent',
            width: 280,
            height: 320,
            position: 'top-left',
            priority: 8,
            content: windControls
        };
        this.uiManager.createPanel(config);
    }

    /**
     * Panneau de contrôles de simulation
     */
    private createSimulationControlsPanel(): void {
        const controls = document.createElement('div');
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
            id: 'sim-controls',
            title: '🎮 Contrôles',
            width: 220,
            height: 200,
            position: 'top-right',
            priority: 10,
            content: controls
        };
        this.uiManager.createPanel(config);
    }

    /**
     * Panneau d'informations générales
     */
    private createInfoPanel(): void {
        const config: PanelConfig = {
            id: 'sim-info',
            title: '📈 Informations de simulation',
            width: 280,
            height: 160,
            position: 'top-right',
            priority: 9,
            content: `
                <div style="line-height: 1.8; color: #fff;">
                    <div><strong>Cerf-volant:</strong> <span id="kite-model">Delta V10</span></div>
                    <div><strong>Vent:</strong> <span id="wind-speed-display">12</span> km/h</div>
                    <div><strong>FPS:</strong> <span id="fps">60</span></div>
                    <div><strong>Physique:</strong> <span id="physics-status" style="color: #51cf66;">Active</span></div>
                    <div><strong>Mode:</strong> <span style="color: #667eea;">Simulation Avancée</span></div>
                </div>
            `
        };
        this.uiManager.createPanel(config);
    }

    /**
     * Panneau de debug physique
     */
    private createDebugPanel(): void {
        const config: PanelConfig = {
            id: 'debug-panel',
            title: '🔬 Debug Physique',
            width: 320,
            height: 140,
            position: 'top-right',
            priority: 8,
            content: `
                <div style="line-height: 1.6;">
                    <div style="margin-bottom: 8px;">
                        <span>Forces: <span id="force-display" style="color: #51cf66;">0</span>N</span> |
                        <span>Tension: <span id="tension-display" style="color: #ff9f43;">0</span>N</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span>Altitude: <span id="altitude-display" style="color: #667eea;">0</span>m</span>
                    </div>
                    <div style="font-size: 11px; opacity: 0.9;">
                        <span style="color: #51cf66;">● Vitesse</span> |
                        <span style="color: #667eea;">● Portance</span> |
                        <span style="color: #ff6b6b;">● Traînée</span>
                    </div>
                </div>
            `
        };
        this.uiManager.createPanel(config);
        
        // Masquer par défaut
        const panel = this.uiManager.getPanel('debug-panel');
        if (panel) {
            panel.element.style.display = 'none';
        }
    }

    /**
     * Sélecteur de mode en haut
     */
    private createModeSelector(): void {
        const selector = document.createElement('div');
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
            id: 'mode-selector',
            title: '',
            width: 300,
            height: 50,
            position: 'top-left',
            priority: 10,
            content: selector,
            className: 'no-header'
        };
        
        const panel = this.uiManager.createPanel(config);
        
        // Masquer l'en-tête pour ce panneau
        const header = panel.element.querySelector('.ui-panel-header') as HTMLElement;
        if (header) {
            header.style.display = 'none';
        }
        
        // Ajuster la hauteur du contenu
        const content = panel.element.querySelector('.ui-panel-content') as HTMLElement;
        if (content) {
            content.style.height = '100%';
            content.style.display = 'flex';
            content.style.alignItems = 'center';
            content.style.justifyContent = 'center';
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    private setupEventListeners(): void {
        // Redimensionnement de fenêtre
        window.addEventListener('resize', () => {
            this.uiManager.resize();
        });

        // Mode CAO
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.id === 'mode-cao') {
                document.body.style.transition = 'opacity 0.3s';
                document.body.style.opacity = '0';
                setTimeout(() => {
                    window.location.href = '/';
                }, 300);
            }
        });
    }

    /**
     * Met à jour le contenu d'un panneau
     */
    updatePanel(panelId: string, content: string | HTMLElement): void {
        this.uiManager.updatePanelContent(panelId, content);
    }

    /**
     * Affiche/masque le panneau de debug
     */
    toggleDebugPanel(show: boolean): void {
        const panel = this.uiManager.getPanel('debug-panel');
        if (panel) {
            panel.element.style.display = show ? 'block' : 'none';
            if (show) {
                this.uiManager.resize(); // Repositionner les panneaux
            }
        }
    }

    /**
     * Met à jour les valeurs en temps réel
     */
    updateRealTimeValues(data: {
        fps?: number;
        windSpeed?: number;
        force?: number;
        tension?: number;
        altitude?: number;
        physicsStatus?: string;
    }): void {
        if (data.fps !== undefined) {
            const fpsEl = document.getElementById('fps');
            if (fpsEl) fpsEl.textContent = data.fps.toString();
        }

        if (data.windSpeed !== undefined) {
            const windEl = document.getElementById('wind-speed-display');
            if (windEl) windEl.textContent = data.windSpeed.toString();
        }

        if (data.force !== undefined) {
            const forceEl = document.getElementById('force-display');
            if (forceEl) forceEl.textContent = Math.round(data.force).toString();
        }

        if (data.tension !== undefined) {
            const tensionEl = document.getElementById('tension-display');
            if (tensionEl) tensionEl.textContent = Math.round(data.tension).toString();
        }

        if (data.altitude !== undefined) {
            const altEl = document.getElementById('altitude-display');
            if (altEl) altEl.textContent = data.altitude.toFixed(1);
        }

        if (data.physicsStatus !== undefined) {
            const statusEl = document.getElementById('physics-status');
            if (statusEl) {
                statusEl.textContent = data.physicsStatus;
                statusEl.style.color = data.physicsStatus === 'Active' ? '#51cf66' : '#ff6b6b';
            }
        }
    }

    /**
     * Enregistre un callback de mise à jour
     */
    onUpdate(panelId: string, callback: () => void): void {
        this.updateCallbacks.set(panelId, callback);
    }

    /**
     * Nettoie l'interface
     */
    cleanup(): void {
        this.updateCallbacks.clear();
        // Le UIManager se charge du nettoyage des panneaux
    }

    /**
     * Obtient le gestionnaire UI sous-jacent
     */
    getUIManager(): UIManager {
        return this.uiManager;
    }
}
