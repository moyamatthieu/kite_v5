/**
 * SimulationApp.ts - Orchestrateur principal de la simulation
 * 
 * Responsabilités :
 * - Initialisation : EntityManager, SystemManager, création des entités
 * - Update loop : mise à jour des systèmes à chaque frame
 * - Gestion du cycle de vie : pause/resume/reset/dispose
 */

import * as THREE from 'three';

import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/SystemManager';
import { TransformComponent } from './components/TransformComponent';
import { KiteFactory, LineFactory, ControlBarFactory, PilotFactory, UIFactory } from './entities';
import { DebugFactory } from './entities/DebugFactory';
import {
  InputSystem,
  WindSystem,
  AeroSystem,
  ConstraintSystem,
  PhysicsSystem,
  PilotSystem,
  GeometryRenderSystem,
  LineRenderSystem,
  RenderSystem,
  LoggingSystem,
  EnvironmentSystem,
  CameraControlsSystem,
  UISystem,
  DebugSystem
} from './systems';
import { CONFIG } from './config/Config';
import type { SimulationContext } from './core/System';
import type { RenderSystem as RenderSystemType } from './systems/RenderSystem';

// Constantes de simulation
const MAX_DELTA_TIME = 0.05; // 50ms cap pour stabilité
const MS_TO_SECONDS = 1000;

export class SimulationApp {
  private entityManager: EntityManager;
  private systemManager: SystemManager;
  private lastTime = 0;
  private paused = !CONFIG.simulation.autoStart; // Lecture depuis la config (autoStart: true => paused: false)
  private animationFrameId: number | null = null;
  
  constructor(private canvas: HTMLCanvasElement) {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager();
  }
  
  /**
   * Initialise la simulation
   */
  async initialize(): Promise<void> {
    this.createEntities();
    this.createSystems();
    
    // Attacher le canvas du RenderSystem au DOM
    const renderSystem = this.systemManager.getSystem('RenderSystem') as RenderSystemType | undefined;
    if (renderSystem?.getCanvas) {
      const rendererCanvas = renderSystem.getCanvas();
      // Remplacer le canvas existant
      if (this.canvas.parentElement) {
        this.canvas.parentElement.replaceChild(rendererCanvas, this.canvas);
      }
      rendererCanvas.id = 'simulation-canvas';
    }
    
    await this.systemManager.initializeAll(this.entityManager);
    
    this.lastTime = performance.now();
  }
  
  /**
   * Crée les entités de la simulation
   */
  private createEntities(): void {
    const controlBarPos = CONFIG.initialization.controlBarPosition.clone();
    
    // Position du kite calculée depuis controlBar
    // Système de coordonnées: X=droite, Y=haut, Z=devant (négatif)
    const kitePos = new THREE.Vector3(
      controlBarPos.x,
      controlBarPos.y + CONFIG.initialization.kiteAltitude, // Plus haut
      controlBarPos.z - CONFIG.initialization.kiteDistance  // Plus devant (Z négatif)
    );
    
    // Positions initiales calculées (désactivé en production)
    // console.log('=== POSITIONS INITIALES ===');
    // console.log('Pilote:', new THREE.Vector3(0, 0, 0));
    // console.log('Barre:', controlBarPos);
    // console.log('Kite:', kitePos);
    
    // === PILOTE (origine) ===
    const pilot = PilotFactory.create();
    this.entityManager.register(pilot);
    
    // Barre de contrôle
    const controlBar = ControlBarFactory.create(controlBarPos);
    this.entityManager.register(controlBar);
    
    // Lignes
    const leftLine = LineFactory.create('left');
    const rightLine = LineFactory.create('right');
    this.entityManager.register(leftLine);
    this.entityManager.register(rightLine);
    
    // Kite
    const kite = KiteFactory.create(kitePos);
    this.entityManager.register(kite);

    // UI Entity
    const ui = UIFactory.create();
    this.entityManager.register(ui);
    
    // Debug Entity (pour la visualisation des vecteurs)
    const debug = DebugFactory.create();
    this.entityManager.register(debug);
  }
  
  /**
   * Crée et enregistre les systèmes
   */
  private createSystems(): void {
    // === Créer RenderSystem en premier pour accéder au canvas et camera ===
    const renderSystem = new RenderSystem();
    const scene = renderSystem.scene;
    const camera = renderSystem.camera;

    // Créer DebugSystem (on passera le renderSystem après)
    const debugSystem = new DebugSystem();

    // Ajouter les systèmes dans l'ordre de priorité
    this.systemManager.add(new EnvironmentSystem(scene)); // Priority 1
    this.systemManager.add(
      new CameraControlsSystem(renderSystem.getCanvas(), camera)
    ); // Priority 1 (bis)
    this.systemManager.add(new InputSystem()); // Priority 10
    this.systemManager.add(new WindSystem()); // Priority 20
    this.systemManager.add(new AeroSystem()); // Priority 30
    this.systemManager.add(new ConstraintSystem()); // Priority 40 - AVANT PhysicsSystem
    this.systemManager.add(new PhysicsSystem()); // Priority 50 - LIT forces accumulées
    this.systemManager.add(new PilotSystem()); // Priority 55
    this.systemManager.add(new LineRenderSystem()); // Priority 55 (bis)
    this.systemManager.add(new GeometryRenderSystem()); // Priority 60

    this.systemManager.add(renderSystem); // Priority 70
    this.systemManager.add(new LoggingSystem()); // Priority 80
    this.systemManager.add(debugSystem); // Priority 88
    this.systemManager.add(new UISystem()); // Priority 90

    // Stocker le renderSystem dans le debugSystem (via propriété publique)
    (debugSystem as DebugSystemType).renderSystem = renderSystem;
  }
  
  /**
   * Vérifie les commandes UI (pause, reset)
   */
  private checkUICommands(): void {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (!uiEntity) return;
    
    const inputComp = uiEntity.getComponent('Input') as any;
    if (!inputComp) return;
    
    // Synchroniser l'état de pause avec InputComponent
    if (inputComp.isPaused !== this.paused) {
      this.paused = inputComp.isPaused;
    }
    
    // Gérer le reset
    if (inputComp.resetSimulation) {
      inputComp.resetSimulation = false; // Reset le flag
      void this.reset();
    }
  }
  
  /**
   * Démarre la boucle de simulation
   */
  start(): void {
    // L'état de pause est défini par CONFIG.simulation.autoStart
    // et synchronisé avec InputComponent.isPaused
    this.lastTime = performance.now();
    this.update();
  }
  
  /**
   * Boucle de mise à jour principale
   */
  private update = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / MS_TO_SECONDS, MAX_DELTA_TIME);
    this.lastTime = currentTime;
    
    // Vérifier les commandes UI (pause/reset)
    this.checkUICommands();
    
    const context: SimulationContext = {
      deltaTime: this.paused ? 0 : deltaTime, // Pas de deltaTime en pause
      totalTime: currentTime / MS_TO_SECONDS,
      entityManager: this.entityManager
    };
    
    if (this.paused) {
      // En pause : exécuter les systèmes physiques ET de rendu
      // Cela permet d'afficher les forces même en pause (gravité, etc)
      const systemsToRun = ['AeroSystem', 'GeometryRenderSystem', 'LineRenderSystem', 'RenderSystem', 'DebugSystem', 'UISystem'];
      systemsToRun.forEach(name => {
        const system = this.systemManager.getSystem(name);
        if (system && system.isEnabled()) {
          system.update(context);
        }
      });
    } else {
      // En cours : exécuter TOUS les systèmes
      this.systemManager.updateAll(context);
    }
    
    this.animationFrameId = requestAnimationFrame(this.update);
  };
  
  /**
   * Pause la simulation
   */
  pause(): void {
    this.paused = true;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Reprend la simulation
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.update();
  }
  
  /**
   * Réinitialise la simulation
   */
  async reset(): Promise<void> {
    // Sauvegarder l'état pause AVANT de reset
    const wasPaused = this.paused;
    
    // Nettoyer l'état du rendu AVANT de supprimer les entités
    const renderSystem = this.systemManager.getSystem('RenderSystem') as any;
    if (renderSystem && renderSystem.resetRenderState) {
      renderSystem.resetRenderState();
    }
    
    // Supprimer uniquement les entités (pas les systèmes pour conserver les event listeners)
    const entities = this.entityManager.getAllEntities();
    entities.forEach(entity => this.entityManager.removeEntity(entity.id));
    
    // Recréer les entités
    this.createEntities();
    
    // Ré-initialiser les systèmes avec les nouvelles entités
    await this.systemManager.initializeAll(this.entityManager);
    
    // Restaurer l'état pause/play APRÈS recréation des entités
    this.paused = wasPaused;
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (uiEntity) {
      const inputComp = uiEntity.getComponent('Input') as any;
      if (inputComp) {
        inputComp.isPaused = wasPaused;
      }
    }
    
    console.log(`🔄 Reset complet - Simulation ${wasPaused ? 'en pause' : 'en cours'}`);
  }
  
  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.pause();
    this.systemManager.disposeAll();
    
    const entities = this.entityManager.getAllEntities();
    entities.forEach(entity => this.entityManager.removeEntity(entity.id));
  }
}
