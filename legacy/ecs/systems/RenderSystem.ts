/**
 * RenderSystem.ts - Système de rendu Three.js
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Logger } from '@utils/Logging';

export interface RenderState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  kiteCamera: THREE.PerspectiveCamera; // Caméra isométrique centrée sur le kite (mini-vue)
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  isRendering: boolean;
  frameCount: number;
  fps: number;
  lastFrameTime: number;
  showMiniView: boolean; // Active/désactive la mini-vue du kite
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
    // Mettre à jour pixelRatio maintenant que window est disponible
    if (typeof window !== 'undefined') {
      this.config.pixelRatio = Math.min(window.devicePixelRatio, 2);
    }

    try {
      await this.initializeRenderer();
      this.logger.info('RenderSystem initialized', 'RenderSystem');
    } catch (error) {
      this.logger.error(`RenderSystem initialization failed: ${error}`, 'RenderSystem');
      throw error;
    }
  }

  /**
   * Vérifie si l'environnement DOM est disponible
   */
  private checkDOMEnvironment(): void {
    if (typeof document === 'undefined') {
      throw new Error('RenderSystem requires a DOM environment');
    }
  }

  /**
   * Crée et configure le canvas
   */
  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.id = 'kite-simulator-canvas';
    return canvas;
  }

  /**
   * Crée et configure le renderer WebGL
   */
  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.antialias,
      alpha: false,
      powerPreference: this.config.powerPreference
    });

    // Configuration de base
    renderer.setPixelRatio(this.config.pixelRatio);
    renderer.setClearColor(this.config.clearColor, this.config.clearAlpha);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Configuration des ombres
    if (this.config.shadowMapEnabled) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = this.config.shadowMapType;
    }

    return renderer;
  }

  /**
   * Crée et configure la scène avec brouillard
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(this.config.clearColor, 50, 200);
    return scene;
  }

  /**
   * Configure l'éclairage de la scène
   */
  private setupLighting(scene: THREE.Scene): void {
    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Lumière directionnelle
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
  }

  /**
   * Ajoute le sol et la grille à la scène
   */
  private setupGroundAndGrid(scene: THREE.Scene): void {
    // Sol
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7d44,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = this.config.shadowMapEnabled;
    scene.add(ground);

    // Grille
    const gridHelper = new THREE.GridHelper(100, 50, 0x888888, 0x444444);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
  }

  /**
   * Crée et configure la caméra principale
   */
  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Position caméra : vue élargie pour voir pilot(0,0,0) → kite(~0,10,-12)
    camera.position.set(10, 8, 8);
    camera.lookAt(0, 6, -10);
    return camera;
  }

  /**
   * Crée et configure la caméra isométrique centrée sur le kite
   */
  private createKiteCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    // Position isométrique : vue à 45° de côté et légèrement au-dessus
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  /**
   * Crée et configure les contrôles de caméra
   */
  private createCameraControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): OrbitControls {
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2;
    // Target au milieu de la scène (entre pilote et kite)
    controls.target.set(0, 5, -8);
    controls.update();

    // Debug : logs de test des contrôles
    this.logger.info('✅ OrbitControls created', 'RenderSystem');
    this.logger.info(`  - enableDamping: ${controls.enableDamping}`, 'RenderSystem');
    this.logger.info(`  - dampingFactor: ${controls.dampingFactor}`, 'RenderSystem');
    this.logger.info(`  - minDistance: ${controls.minDistance}`, 'RenderSystem');
    this.logger.info(`  - maxDistance: ${controls.maxDistance}`, 'RenderSystem');
    this.logger.info(`  - target: (${controls.target.x}, ${controls.target.y}, ${controls.target.z})`, 'RenderSystem');
    this.logger.info(`  - enabled: ${controls.enabled}`, 'RenderSystem');

    // Test événements souris (niveau INFO pour être visible)
    let clickCount = 0;
    canvas.addEventListener('pointerdown', (e) => {
      clickCount++;
      console.log(`🖱️ Canvas click #${clickCount} - button: ${e.button}, x: ${e.clientX}, y: ${e.clientY}`);
    });

    // Test aussi les événements OrbitControls
    controls.addEventListener('change', () => {
      console.log('🔄 OrbitControls change event fired');
    });

    return controls;
  }

  /**
   * Ajoute le canvas au DOM et configure les écouteurs
   */
  private setupCanvasInDOM(canvas: HTMLCanvasElement): void {
    const container = document.getElementById('app') || document.body;
    container.appendChild(canvas);

    this.logger.info('✅ Canvas added to DOM', 'RenderSystem');
    this.logger.info(`  - Container: ${container.id || 'body'}`, 'RenderSystem');
    this.logger.info(`  - Canvas parent: ${canvas.parentElement?.id || 'none'}`, 'RenderSystem');
    this.logger.info(`  - Canvas size: ${canvas.width}x${canvas.height}`, 'RenderSystem');

    // Écouteur de redimensionnement
    window.addEventListener('resize', this.onResize.bind(this));
  }

  /**
   * Initialise le renderer Three.js
   */
  private async initializeRenderer(): Promise<void> {
    this.checkDOMEnvironment();

    // Création des composants
    const canvas = this.createCanvas();
    const renderer = this.createRenderer(canvas);
    const scene = this.createScene();

    // Configuration de la scène
    this.setupLighting(scene);
    this.setupGroundAndGrid(scene);

    // Création des caméras
    const camera = this.createCamera();
    const kiteCamera = this.createKiteCamera();

    // CRITIQUE : Ajouter le canvas au DOM AVANT de créer les OrbitControls
    // Les OrbitControls attachent leurs event listeners au moment de la construction
    this.setupCanvasInDOM(canvas);

    // Maintenant créer les contrôles (canvas est dans le DOM)
    const controls = this.createCameraControls(camera, canvas);

    // Initialisation de l'état
    this.renderState = {
      scene,
      camera,
      kiteCamera,
      renderer,
      canvas,
      controls,
      isRendering: false,
      frameCount: 0,
      fps: 0,
      lastFrameTime: performance.now(),
      showMiniView: true // Activer la mini-vue par défaut
    };

    // Configuration finale
    this.onResize();
  }

  update(_context: SimulationContext): void {
    if (!this.renderState || !this.renderState.isRendering) {
      return;
    }

    // Mettre à jour les contrôles de caméra
    this.renderState.controls.update();

    // Mettre à jour la position de la caméra kite pour suivre le kite
    this.updateKiteCameraPosition();

    // Calculer le FPS
    this.updateFPS();

    // Rendre la scène principale (plein écran)
    const renderer = this.renderState.renderer;
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(this.renderState.scene, this.renderState.camera);

    // Rendre la mini-vue du kite (en bas à droite)
    if (this.renderState.showMiniView) {
      this.renderMiniView();
    }

    this.renderState.frameCount++;
  }

  /**
   * Met à jour la position de la caméra kite pour qu'elle suive le kite
   */
  private updateKiteCameraPosition(): void {
    if (!this.renderState) return;

    // Chercher l'entité kite dans la scène
    const kiteObject = this.renderState.scene.getObjectByName('kite');
    if (kiteObject) {
      // Positionner la caméra en vue isométrique autour du kite
      const offset = new THREE.Vector3(2, 2, 2);
      this.renderState.kiteCamera.position.copy(kiteObject.position).add(offset);
      this.renderState.kiteCamera.lookAt(kiteObject.position);
    }
  }

  /**
   * Rend la mini-vue du kite en bas à droite
   */
  private renderMiniView(): void {
    if (!this.renderState) return;

    const renderer = this.renderState.renderer;
    const miniViewWidth = 300;  // pixels
    const miniViewHeight = 300; // pixels
    const margin = 10;          // pixels de marge

    // Position en bas à droite
    const miniViewX = window.innerWidth - miniViewWidth - margin;
    const miniViewY = margin; // En bas (coordonnées WebGL)

    // Configurer le viewport et le scissor pour la mini-vue
    renderer.setViewport(miniViewX, miniViewY, miniViewWidth, miniViewHeight);
    renderer.setScissor(miniViewX, miniViewY, miniViewWidth, miniViewHeight);
    renderer.setScissorTest(true);

    // Rendre la scène avec la caméra kite
    renderer.render(this.renderState.scene, this.renderState.kiteCamera);

    // Désactiver le scissor test
    renderer.setScissorTest(false);
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
      this.renderState.renderer.render(this.renderState.scene, this.renderState.camera);
    } else {
      this.logger.error('❌ Cannot start rendering - renderState is null', 'RenderSystem');
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