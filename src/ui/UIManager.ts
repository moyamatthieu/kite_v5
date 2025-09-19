/**
 * UIManager.ts - Système d'interface orienté objet
 * Gestion intelligente des panneaux avec positionnement automatique
 */

export interface PanelConfig {
    id: string;
    title: string;
    width: number;
    height: number;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    priority: number; // Plus élevé = plus proche du coin
    resizable?: boolean;
    collapsible?: boolean;
    content?: string | HTMLElement;
    className?: string;
}

export interface PanelInstance {
    config: PanelConfig;
    element: HTMLElement;
    isCollapsed: boolean;
    actualPosition: { x: number; y: number };
    userPositioned?: boolean;
}

/**
 * Gestionnaire principal de l'interface utilisateur
 * Évite automatiquement les superpositions et organise les panneaux
 */
export class UIManager {
    private panels: Map<string, PanelInstance> = new Map();
    private container: HTMLElement;
    private readonly PANEL_MARGIN = 15;
    private readonly HEADER_HEIGHT = 30;
    private readonly STORAGE_KEY = 'ui_layout_global';

    constructor(container: HTMLElement) {
        this.container = container;
        this.initializeBaseStyles();
    }

    /**
     * Initialise les styles de base pour les panneaux
     */
    private initializeBaseStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .ui-panel {
                position: absolute;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 20, 40, 0.9));
                backdrop-filter: blur(12px);
                border-radius: 12px;
                border: 1px solid rgba(102, 126, 234, 0.3);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(102, 126, 234, 0.1);
                color: white;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                z-index: 1000;
            }

            .ui-panel:hover {
                border-color: rgba(102, 126, 234, 0.6);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(102, 126, 234, 0.2);
                transform: translateY(-2px);
            }

            .ui-panel-header {
                background: linear-gradient(90deg, rgba(102, 126, 234, 0.8), rgba(118, 75, 162, 0.8));
                padding: 8px 12px;
                font-weight: 600;
                font-size: 13px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                user-select: none;
            }

            .ui-panel-title {
                color: white;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            }

            .ui-panel-controls {
                display: flex;
                gap: 5px;
            }

            .ui-panel-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .ui-panel-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .ui-panel-content {
                padding: 12px;
                font-size: 12px;
                line-height: 1.5;
                max-height: calc(100% - 30px);
                overflow-y: auto;
            }

            .ui-panel-content::-webkit-scrollbar {
                width: 6px;
            }

            .ui-panel-content::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }

            .ui-panel-content::-webkit-scrollbar-thumb {
                background: rgba(102, 126, 234, 0.6);
                border-radius: 3px;
            }

            .ui-panel.collapsed .ui-panel-content {
                display: none;
            }

            .ui-panel.collapsed {
                height: 30px !important;
            }

            /* Animations */
            @keyframes slideInFromCorner {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateX(0);
                }
            }

            .ui-panel {
                animation: slideInFromCorner 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Crée et ajoute un nouveau panneau
     */
    createPanel(config: PanelConfig): PanelInstance {
        const panel = this.buildPanelElement(config);
        const instance: PanelInstance = {
            config,
            element: panel,
            isCollapsed: false,
            actualPosition: { x: 0, y: 0 }
        };

        this.panels.set(config.id, instance);
        this.container.appendChild(panel);
        
        // Calculer et appliquer la position
        this.repositionAllPanels();

        // Restaurer un layout sauvegardé
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const layout = raw ? JSON.parse(raw) : {};
            const saved = layout[config.id as string];
            if (saved) {
                instance.userPositioned = true;
                instance.actualPosition = { x: saved.x, y: saved.y };
                panel.style.left = `${saved.x}px`;
                panel.style.top = `${saved.y}px`;
                if (saved.collapsed !== undefined) {
                    instance.isCollapsed = !!saved.collapsed;
                    panel.classList.toggle('collapsed', instance.isCollapsed);
                }
            }
        } catch {}
        this.repositionAllPanels();
        
        return instance;
    }

    /**
     * Construit l'élément DOM du panneau
     */
    private buildPanelElement(config: PanelConfig): HTMLElement {
        const panel = document.createElement('div');
        panel.className = `ui-panel ${config.className || ''}`;
        panel.id = config.id;
        
        // En-tête
        const header = document.createElement('div');
        header.className = 'ui-panel-header';
        
        const title = document.createElement('span');
        title.className = 'ui-panel-title';
        title.textContent = config.title;
        
        const controls = document.createElement('div');
        controls.className = 'ui-panel-controls';
        
        // Bouton de réduction/expansion
        if (config.collapsible !== false) {
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'ui-panel-btn';
            collapseBtn.innerHTML = '−';
            collapseBtn.onclick = () => this.togglePanel(config.id);
            controls.appendChild(collapseBtn);
        }
        
        header.appendChild(title);
        header.appendChild(controls);
        
        // Contenu
        const content = document.createElement('div');
        content.className = 'ui-panel-content';
        
        if (typeof config.content === 'string') {
            content.innerHTML = config.content;
        } else if (config.content instanceof HTMLElement) {
            content.appendChild(config.content);
        }
        
        panel.appendChild(header);
        panel.appendChild(content);
        
        // Définir les dimensions
        panel.style.width = `${config.width}px`;
        panel.style.height = `${config.height}px`;
        
        // Rendre déplaçable
        this.makeDraggable(panel, header);
        
        return panel;
    }

    /**
     * Repositionne tous les panneaux pour éviter les superpositions
     */
    private repositionAllPanels(): void {
        const positions = {
            'top-left': [] as PanelInstance[],
            'top-right': [] as PanelInstance[],
            'bottom-left': [] as PanelInstance[],
            'bottom-right': [] as PanelInstance[],
            'center': [] as PanelInstance[]
        };

        // Grouper par position et trier par priorité
        this.panels.forEach(panel => {
            positions[panel.config.position].push(panel);
        });

        Object.keys(positions).forEach(pos => {
            positions[pos as keyof typeof positions].sort((a, b) => b.config.priority - a.config.priority);
        });

        // Calculer les positions
        this.calculatePositions(positions['top-left'], 'top-left');
        this.calculatePositions(positions['top-right'], 'top-right');
        this.calculatePositions(positions['bottom-left'], 'bottom-left');
        this.calculatePositions(positions['bottom-right'], 'bottom-right');
        this.calculatePositions(positions['center'], 'center');
    }

    /**
     * Calcule les positions pour un groupe de panneaux
     */
    private calculatePositions(panels: PanelInstance[], position: string): void {
        const containerRect = this.container.getBoundingClientRect();
        let currentX = this.PANEL_MARGIN;
        let currentY = this.PANEL_MARGIN;

        panels.forEach((panel, index) => {
            const width = panel.config.width;
            const height = panel.isCollapsed ? this.HEADER_HEIGHT : panel.config.height;

            switch (position) {
                case 'top-left':
                    panel.actualPosition = { x: currentX, y: currentY };
                    currentY += height + this.PANEL_MARGIN;
                    break;
                    
                case 'top-right':
                    panel.actualPosition = { 
                        x: containerRect.width - width - currentX, 
                        y: currentY 
                    };
                    currentY += height + this.PANEL_MARGIN;
                    break;
                    
                case 'bottom-left':
                    panel.actualPosition = { 
                        x: currentX, 
                        y: containerRect.height - height - currentY 
                    };
                    currentY += height + this.PANEL_MARGIN;
                    break;
                    
                case 'bottom-right':
                    panel.actualPosition = { 
                        x: containerRect.width - width - currentX, 
                        y: containerRect.height - height - currentY 
                    };
                    currentY += height + this.PANEL_MARGIN;
                    break;
                    
                case 'center':
                    panel.actualPosition = { 
                        x: (containerRect.width - width) / 2, 
                        y: (containerRect.height - height) / 2 + (index * 50)
                    };
                    break;
            }

            // Appliquer la position
            panel.element.style.left = `${panel.actualPosition.x}px`;
            panel.element.style.top = `${panel.actualPosition.y}px`;
        });
    }

    /**
     * Rend un panneau déplaçable
     */
    private makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(panel.style.left) || 0;
            startTop = parseInt(panel.style.top) || 0;
            
            panel.style.zIndex = '2000';
            document.body.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            panel.style.left = `${startLeft + deltaX}px`;
            panel.style.top = `${startTop + deltaY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.style.zIndex = '1000';
                document.body.style.cursor = '';
                const inst = this.panels.get(panel.id);
                if (inst) {
                    inst.userPositioned = true;
                    inst.actualPosition = { x: parseInt(panel.style.left) || 0, y: parseInt(panel.style.top) || 0 };
                    try {
                        const raw = localStorage.getItem(this.STORAGE_KEY);
                        const layout = raw ? JSON.parse(raw) : {};
                        layout[panel.id] = { x: inst.actualPosition.x, y: inst.actualPosition.y, collapsed: inst.isCollapsed };
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layout));
                    } catch {}
                }
            }
        });
    }

    /**
     * Réduit/développe un panneau
     */
    togglePanel(panelId: string): void {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        panel.isCollapsed = !panel.isCollapsed;
        panel.element.classList.toggle('collapsed', panel.isCollapsed);
        
        const btn = panel.element.querySelector('.ui-panel-btn') as HTMLElement;
        if (btn) {
            btn.innerHTML = panel.isCollapsed ? '+' : '−';
        }

        // Repositionner tous les panneaux
        this.repositionAllPanels();
    }

    /**
     * Met à jour le contenu d'un panneau
     */
    updatePanelContent(panelId: string, content: string | HTMLElement): void {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        const contentElement = panel.element.querySelector('.ui-panel-content') as HTMLElement;
        if (typeof content === 'string') {
            contentElement.innerHTML = content;
        } else {
            contentElement.innerHTML = '';
            contentElement.appendChild(content);
        }
    }

    /**
     * Supprime un panneau
     */
    removePanel(panelId: string): void {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        panel.element.remove();
        this.panels.delete(panelId);
        this.repositionAllPanels();
    }

    /**
     * Redimensionne l'interface (à appeler lors du resize de la fenêtre)
     */
    resize(): void {
        this.repositionAllPanels();
    }

    /**
     * Obtient une instance de panneau
     */
    getPanel(panelId: string): PanelInstance | undefined {
        return this.panels.get(panelId);
    }

    /**
     * Obtient tous les panneaux
     */
    getAllPanels(): Map<string, PanelInstance> {
        return new Map(this.panels);
    }
}
