/**
 * RenderSystem.ts - Système de rendu Three.js
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';

export interface RenderState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  isRendering: boolean;
  frameCount: number;
  fps: number;
  lastFrameTime: number;
}

export interface RenderConfig {
  antialias: boolean;
  shadowMapEnabled: boolean;
  shadowMapType: THREE.ShadowMapType;
  pixelRatio: number;
  clearColor: number;
  clearAlpha: number;
  targetFPS: number;
  vsync: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
}

export class RenderSystem extends BaseSimulationSystem {
  private logger: Logger;
  private renderState: RenderState | null = null;
  private config: RenderConfig;
  private fpsCounter = { frames: 0, lastTime: 0, fps: 0 };

  constructor(config: Partial<RenderConfig> = {}) {
    super('RenderSystem', 100); // Basse priorité (rendu en dernier)

    this.logger = Logger.getInstance();
    this.config = {
      antialias: true,
      shadowMapEnabled: true,
      shadowMapType: THREE.PCFSoftShadowMap,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      clearColor: 0x87CEEB, // Bleu ciel
      clearAlpha: 1.0,
      targetFPS: 60,
      vsync: true,
      powerPreference: 'high-performance',
      ...config
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('RenderSystem initializing...', 'RenderSystem');

    try {
      await this.initializeRenderer();
      this.logger.info('RenderSystem initialized successfully', 'RenderSystem');
    } catch (error) {
      this.logger.error(`RenderSystem initialization failed: ${error}`, 'RenderSystem');
      throw error;
    }
  }

  /**
   * Initialise le renderer Three.js
   */
  private async initializeRenderer(): Promise<void> {
    if (typeof document === 'undefined') {
      throw new Error('RenderSystem requires a DOM environment');
    }

    // Créer le canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'kite-simulator-canvas';

    // Créer le renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.antialias,
      alpha: false,
      powerPreference: this.config.powerPreference
    });

    // Configurer le renderer
    renderer.setPixelRatio(this.config.pixelRatio);
    renderer.setClearColor(this.config.clearColor, this.config.clearAlpha);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Configurer les ombres
    if (this.config.shadowMapEnabled) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = this.config.shadowMapType;
    }

    // Créer la scène
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(this.config.clearColor, 50, 200);

    // Créer la caméra (sera configurée par le système de caméra séparé)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Initialiser l'état de rendu
    this.renderState = {
      scene,
      camera,
      renderer,
      canvas,
      isRendering: false,
      frameCount: 0,
      fps: 0,
      lastFrameTime: performance.now()
    };

    // Configurer la taille initiale
    this.onResize();

    // Ajouter le canvas au DOM
    const container = document.getElementById('app') || document.body;
    container.appendChild(canvas);

    // Écouteur de redimensionnement
    window.addEventListener('resize', this.onResize.bind(this));
  }

  update(context: SimulationContext): void {
    if (!this.renderState || !this.renderState.isRendering) return;

    // Calculer le FPS
    this.updateFPS();

    // Rendre la scène
    this.renderState.renderer.render(this.renderState.scene, this.renderState.camera);

    this.renderState.frameCount++;
  }

  /**
   * Met à jour le compteur FPS
   */
  private updateFPS(): void {
    if (!this.renderState) return;

    const now = performance.now();
    this.fpsCounter.frames++;

    if (now - this.fpsCounter.lastTime >= 1000) {
      this.renderState.fps = Math.round((this.fpsCounter.frames * 1000) / (now - this.fpsCounter.lastTime));
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastTime = now;
    }
  }

  /**
   * Gestionnaire de redimensionnement de la fenêtre
   */
  private onResize(): void {
    if (!this.renderState) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Mettre à jour la caméra
    if (this.renderState.camera instanceof THREE.PerspectiveCamera) {
      this.renderState.camera.aspect = width / height;
      this.renderState.camera.updateProjectionMatrix();
    }

    // Mettre à jour le renderer
    this.renderState.renderer.setSize(width, height);
  }

  /**
   * Démarre le rendu
   */
  startRendering(): void {
    if (this.renderState) {
      this.renderState.isRendering = true;
      this.logger.info('Rendering started', 'RenderSystem');
    }
  }

  /**
   * Arrête le rendu
   */
  stopRendering(): void {
    if (this.renderState) {
      this.renderState.isRendering = false;
      this.logger.info('Rendering stopped', 'RenderSystem');
    }
  }

  /**
   * Obtient l'état de rendu actuel
   */
  getRenderState(): Readonly<RenderState> | null {
    return this.renderState;
  }

  /**
   * Obtient la scène Three.js
   */
  getScene(): THREE.Scene | null {
    return this.renderState?.scene || null;
  }

  /**
   * Obtient la caméra
   */
  getCamera(): THREE.Camera | null {
    return this.renderState?.camera || null;
  }

  /**
   * Obtient le renderer
   */
  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderState?.renderer || null;
  }

  /**
   * Obtient le canvas
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.renderState?.canvas || null;
  }

  /**
   * Obtient les statistiques de rendu
   */
  getRenderStats(): { fps: number; frameCount: number; isRendering: boolean } {
    if (!this.renderState) {
      return { fps: 0, frameCount: 0, isRendering: false };
    }

    return {
      fps: this.renderState.fps,
      frameCount: this.renderState.frameCount,
      isRendering: this.renderState.isRendering
    };
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): Readonly<RenderConfig> {
    return this.config;
  }

  reset(): void {
    if (this.renderState) {
      this.renderState.frameCount = 0;
      this.renderState.fps = 0;
      this.renderState.lastFrameTime = performance.now();
    }

    this.fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
    this.logger.info('RenderSystem reset', 'RenderSystem');
  }

  dispose(): void {
    if (this.renderState) {
      // Supprimer les écouteurs
      window.removeEventListener('resize', this.onResize.bind(this));

      // Disposer le renderer
      this.renderState.renderer.dispose();

      // Supprimer le canvas du DOM
      if (this.renderState.canvas.parentNode) {
        this.renderState.canvas.parentNode.removeChild(this.renderState.canvas);
      }

      this.renderState = null;
    }

    this.logger.info('RenderSystem disposed', 'RenderSystem');
  }
}