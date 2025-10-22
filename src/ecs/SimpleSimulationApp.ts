/**
 * SimpleSimulationApp.ts - Orchestrateur ultra-simplifié
 *
 * REFACTORING COMPLET : Un seul système de physique unifié
 * ═════════════════════════════════════════════════════════
 *
 * Élimine tous les conflits entre systèmes :
 * - ❌ AeroSystemNASA + TetherSystem + PhysicsSystem (conflits)
 * - ✅ SimplePhysicsSystem (tout en un, stable)
 */

import * as THREE from 'three';

import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/SystemManager';
import { KiteFactory, LineFactory, ControlBarFactory, PilotFactory, UIFactory } from './entities';
import { SimplePhysicsSystem } from './systems/SimplePhysicsSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { CameraControlsSystem } from './systems/CameraControlsSystem';
import { InputSyncSystem } from './systems/InputSyncSystem';
import { InputSystem } from './systems/InputSystem';
import { LineRenderSystem } from './systems/LineRenderSystem';
import { GeometryRenderSystem } from './systems/GeometryRenderSystem';
import { RenderSystem } from './systems/RenderSystem';
import { DebugSystem } from './systems/DebugSystem';
import { UISystem } from './systems/UISystem';
import { CONFIG } from './config/Config';
import { Logger } from './utils/Logging';
import type { SimulationContext } from './core/System';
import type { RenderSystem as RenderSystemType } from './systems/RenderSystem';
import type { DebugSystem as DebugSystemType } from './systems/DebugSystem';

export class SimpleSimulationApp {
  private entityManager: EntityManager;
  private systemManager: SystemManager;
  private lastTime = 0;
  private paused = !CONFIG.simulation.autoStart;
  private logger = Logger.getInstance();

  // Système de physique unifié ultra-simple
  private simplePhysicsSystem!: SimplePhysicsSystem;

  private animationFrameId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager();
  }

  /**
   * Initialise la simulation simplifiée
   */
  async initialize(): Promise<void> {
    this.createEntities();
    this.createSystems();

    // Le canvas est déjà attaché au DOM
    await this.systemManager.initializeAll(this.entityManager);

    this.lastTime = performance.now();
  }

  /**
   * Crée les entités simplifiées (pas de brides complexes)
   */
  private createEntities(): void {
    const controlBarPos = CONFIG.initialization.controlBarPosition.clone();

    // Position du kite calculée depuis controlBar
    const kitePos = new THREE.Vector3(
      controlBarPos.x,
      controlBarPos.y + CONFIG.initialization.kiteAltitude,
      controlBarPos.z - CONFIG.initialization.kiteDistance
    );

    // === PILOTE ===
    const pilot = PilotFactory.create();
    this.entityManager.register(pilot);

    // === BARRE DE CONTRÔLE ===
    const controlBar = ControlBarFactory.create(controlBarPos);
    this.entityManager.register(controlBar);

    // === LIGNES (simplifiées) ===
    const leftLine = LineFactory.create('left');
    const rightLine = LineFactory.create('right');
    this.entityManager.register(leftLine);
    this.entityManager.register(rightLine);

    // === KITE (simplifié) ===
    const kite = KiteFactory.create(kitePos);
    this.entityManager.register(kite);

    // === UI ===
    const ui = UIFactory.create();
    this.entityManager.register(ui);

    // === DEBUG (optionnel) ===
    if (CONFIG.debug.enabled) {
      const debug = UIFactory.create(); // TODO: créer SimpleDebugFactory
      this.entityManager.register(debug);
    }
  }

  /**
   * Crée le pipeline de systèmes ultra-simplifié
   */
  private createSystems(): void {
    // === RENDER SYSTEM ===
    const renderSystem = new RenderSystem(this.canvas);
    const scene = renderSystem.scene;
    const camera = renderSystem.camera;

    // === DEBUG SYSTEM ===
    const debugSystem = new DebugSystem();

    // === PHYSIQUE UNIFIÉE ULTRA-SIMPLE ===
    this.simplePhysicsSystem = new SimplePhysicsSystem();

    // Pipeline simplifié : pas de conflits entre systèmes
    this.systemManager.add(new EnvironmentSystem(scene)); // Priority 1
    this.systemManager.add(new CameraControlsSystem(this.canvas, camera)); // Priority 1
    this.systemManager.add(new InputSyncSystem()); // Priority 5
    this.systemManager.add(new InputSystem()); // Priority 10

    // UN SEUL SYSTÈME DE PHYSIQUE (remplace AeroSystem + TetherSystem + PhysicsSystem)
    this.systemManager.add(this.simplePhysicsSystem); // Priority 30

    this.systemManager.add(new LineRenderSystem()); // Priority 55
    this.systemManager.add(new GeometryRenderSystem()); // Priority 60
    this.systemManager.add(renderSystem); // Priority 70
    this.systemManager.add(debugSystem); // Priority 88
    this.systemManager.add(new UISystem()); // Priority 90

    // Liaison debug system
    (debugSystem as DebugSystemType).renderSystem = renderSystem;
  }

  /**
   * Vérifie les commandes UI
   */
  private checkUICommands(): void {
    const uiEntity = this.entityManager.query(['Input'])[0];
    if (!uiEntity) return;

    const inputComp = uiEntity.getComponent('Input') as any;
    if (!inputComp) return;

    if (inputComp.isPaused !== this.paused) {
      this.paused = inputComp.isPaused;
    }

    if (inputComp.resetSimulation) {
      inputComp.resetSimulation = false;
      void this.reset();
    }
  }

  /**
   * Démarre la boucle de simulation
   */
  start(): void {
    this.lastTime = performance.now();
    this.update();
  }

  /**
   * Boucle de simulation simplifiée
   */
  private update = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 1/30); // Max 30 FPS
    this.lastTime = currentTime;

    if (!this.paused) {
      const context: SimulationContext = {
        entityManager: this.entityManager,
        deltaTime,
        totalTime: currentTime / 1000
      };

      this.systemManager.updateAll(context);
    }

    this.checkUICommands();
    this.animationFrameId = requestAnimationFrame(this.update);
  };

  /**
   * Met en pause/reprend la simulation
   */
  pause(): void {
    this.paused = !this.paused;
  }

  /**
   * Réinitialise la simulation
   */
  async reset(): Promise<void> {
    this.logger.info('Resetting simulation...');

    // Arrêter la boucle
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Recréer les entités
    this.entityManager.clear();
    this.createEntities();

    // Réinitialiser les systèmes
    await this.systemManager.initializeAll(this.entityManager);

    // Redémarrer
    this.start();
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.systemManager.disposeAll();
    this.entityManager.clear();
  }
}