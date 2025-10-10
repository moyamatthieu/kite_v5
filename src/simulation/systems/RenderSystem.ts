/**
 * RenderSystem.ts - Système de rendu Three.js
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';

export interface RenderState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
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
      pixelRatio: 1, // Valeur par défaut, sera mise à jour dans initialize()
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

    // Mettre à jour pixelRatio maintenant que window est disponible
    if (typeof window !== 'undefined') {
      this.config.pixelRatio = Math.min(window.devicePixelRatio, 2);
    }

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

    // Ajouter des lumières
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = this.config.shadowMapEnabled;
    if (this.config.shadowMapEnabled) {
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
    }
    scene.add(directionalLight);

    this.logger.info('Scene lights created', 'RenderSystem');

    // Ajouter un sol (ground plane)
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a7d44, // Vert herbe
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotation pour être horizontal
    ground.position.y = 0;
    ground.receiveShadow = this.config.shadowMapEnabled;
    scene.add(ground);

    // Ajouter une grille pour référence visuelle
    const gridHelper = new THREE.GridHelper(100, 50, 0x888888, 0x444444);
    gridHelper.position.y = 0.01; // Légèrement au-dessus du sol pour éviter le z-fighting
    scene.add(gridHelper);

    this.logger.info('Ground plane and grid created', 'RenderSystem');

    // Créer la caméra (sera configurée par le système de caméra séparé)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 15); // Position de la caméra derrière et légèrement au-dessus
    camera.lookAt(0, 5, 0); // Regarder vers le centre où se trouve le kite

    // Créer les contrôles OrbitControls pour la navigation de caméra
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; // Lissage du mouvement
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2; // Empêcher de passer sous le sol
    controls.target.set(0, 5, 0); // Regarder le kite
    controls.update();

    this.logger.info('OrbitControls created', 'RenderSystem');

    // Initialiser l'état de rendu
    this.renderState = {
      scene,
      camera,
      renderer,
      canvas,
      controls,
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
    
    this.logger.info(`Canvas created and added to container: ${container.id || 'body'}`, 'RenderSystem');
    this.logger.info(`Canvas dimensions: ${canvas.width}x${canvas.height}`, 'RenderSystem');

    // Écouteur de redimensionnement
    window.addEventListener('resize', this.onResize.bind(this));
  }

  update(context: SimulationContext): void {
    if (!this.renderState || !this.renderState.isRendering) {
      if (!this.renderState) {
        console.warn('RenderSystem: renderState is null');
      } else if (!this.renderState.isRendering) {
        console.warn('RenderSystem: isRendering is false');
      }
      return;
    }

    // Mettre à jour les contrôles de caméra
    this.renderState.controls.update();

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
      console.log('🎬 RenderSystem: Rendering started');
      console.log(`📺 Canvas element: ${this.renderState.canvas.id}`);
      console.log(`🎭 Scene children count: ${this.renderState.scene.children.length}`);
      console.log(`📐 Canvas size: ${this.renderState.canvas.width}x${this.renderState.canvas.height}`);
      console.log(`📷 Camera position:`, this.renderState.camera.position);
      this.logger.info('Rendering started', 'RenderSystem');
      this.logger.info(`Canvas element: ${this.renderState.canvas.id}`, 'RenderSystem');
      this.logger.info(`Scene children count: ${this.renderState.scene.children.length}`, 'RenderSystem');
    } else {
      console.error('❌ RenderSystem: Cannot start rendering - renderState is null');
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

  addToScene(object: THREE.Object3D): void {
    if (this.renderState?.scene) {
      this.renderState.scene.add(object);
    }
  }

  removeFromScene(object: THREE.Object3D): void {
    if (this.renderState?.scene) {
      this.renderState.scene.remove(object);
    }
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