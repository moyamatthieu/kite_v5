/**
 * RenderManager.ts - Gestion du rendu 3D optimisé
 *
 * 🎯 Responsabilités :
 * - Gérer la scène 3D avec performance optimale
 * - Système d'éclairage et environnement efficace
 * - Rendu avec logging intelligent et throttling
 * - Réduction des triangles et optimisation géométrique
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RENDER_CONFIG } from "../config/RenderConfig";
import { CONFIG } from "../config/GlobalConfig";
import { logger } from "@utils/Logger";
import { simplePerformanceMonitor } from "@utils/SimplePerformanceMonitor";

export class RenderManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  // 🚀 Optimisations de performance
  private sceneStatsCache: {
    objects: number;
    triangles: number;
    textures: number;
  } | null = null;
  private lastStatsCacheTime = 0;
  private readonly STATS_CACHE_DURATION = 1000; // 1 seconde de cache

  // 📊 Monitoring simple et sécurisé
  private lastMonitoringTime = 0;
  private initialTriangleCount: number | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      0x87ceeb,
      RENDER_CONFIG.fogStart,
      RENDER_CONFIG.fogEnd
    );

    this.camera = new THREE.PerspectiveCamera(
      65, // Slightly reduced FOV for less distortion and sharper details
      window.innerWidth / window.innerHeight,
      0.1,
      2000 // Increased far plane for better distance rendering
    );
    this.camera.position.set(3, 5, 12);
    this.camera.lookAt(0, 3, -5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, // Force high-quality antialiasing
      alpha: true,
      powerPreference: "high-performance", // Use dedicated GPU if available
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap à 1.5x pour performance optimale

    // 🌟 OPTIMISATION OMBRES : Désactivées temporairement pour diagnostic
    this.renderer.shadowMap.enabled = false; // Désactivé pour tester performance
    // this.renderer.shadowMap.type = THREE.BasicShadowMap;

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 50;
    this.controls.minDistance = 2;

    this.setupEnvironment();

    // 📊 Log initial optimisé des stats de scène
    const initialStats = this.getSceneStats();
    logger.info(
      `Scène initialisée: ${initialStats.objects} objets, ${initialStats.triangles} triangles, ${initialStats.textures} textures`
    );

    window.addEventListener("resize", () => this.onResize());
  }

  private setupEnvironment(): void {
    // 🚀 CIEL ULTRA-OPTIMISÉ: Matériau simple au lieu du shader complexe
    const skyGeometry = new THREE.SphereGeometry(500, 8, 6); // 8x6 = 48 triangles au lieu de 1024 !
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87ceeb, // Bleu ciel uniforme
      side: THREE.BackSide,
      fog: false, // Pas affecté par le brouillard
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);

    // 🚀 NUAGES DÉSACTIVÉS temporairement pour tester performance
    // this.addClouds();

    // 🚀 ÉCLAIRAGE ULTRA-OPTIMISÉ: Juste la lumière ambiante
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Plus intense car seule source
    this.scene.add(ambientLight);

    // Suppression temporaire de la lumière directionnelle pour tester performance
    // const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);

    this.createImprovedGround();

    // 🚀 GRID DÉSACTIVÉ temporairement pour tester performance
    // const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
    // this.scene.add(gridHelper);
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  render(): void {
    // 🚀 Mise à jour des contrôles (léger)
    this.controls.update();

    // 🎨 Appel de rendu principal
    this.renderer.render(this.scene, this.camera);

    // 📊 Monitoring minimal (très rare pour préserver performance)
    if (Math.random() < 0.0002) {
      simplePerformanceMonitor.checkPerformance(this.scene);
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Maintenir performance optimale
  }

  private getSceneStats(): {
    objects: number;
    triangles: number;
    textures: number;
  } {
    const now = performance.now();

    // 🚀 Utilisation du cache si encore valide (évite calculs répétitifs)
    if (
      this.sceneStatsCache &&
      now - this.lastStatsCacheTime < this.STATS_CACHE_DURATION
    ) {
      return this.sceneStatsCache;
    }

    // 📊 Calcul des stats (coûteux, donc mis en cache)
    let objects = 0;
    let triangles = 0;
    let textures = 0;

    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        objects++;
        if (child.geometry) {
          const geom = child.geometry;
          if (geom.index) {
            triangles += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangles += geom.attributes.position.count / 3;
          }
        }
        if (child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((mat) => {
            if (mat.map) textures++;
            if (mat.normalMap) textures++;
            if (mat.roughnessMap) textures++;
            if (mat.metalnessMap) textures++;
          });
        }
      }
    });

    // 💾 Mise en cache du résultat
    this.sceneStatsCache = {
      objects,
      triangles: Math.floor(triangles),
      textures,
    };
    this.lastStatsCacheTime = now;

    return this.sceneStatsCache;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Retourne la caméra pour permettre les contrôles externes
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Retourne les contrôles OrbitControls pour configuration externe
   */
  getControls(): OrbitControls {
    return this.controls;
  }

  private addClouds(): void {
    // 🌟 OPTIMISATION MAJEURE : Nuages ultra-légers pour performance
    const cloudGroup = new THREE.Group();

    // 🎨 Matériau ultra-optimisé pour les nuages
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      fog: false, // Pas affecté par le brouillard pour performance
    });

    // 🚀 Géométrie partagée pour économiser la mémoire
    const cloudGeometry = new THREE.SphereGeometry(3, 4, 3); // 4x3 = 12 triangles au lieu de 32x32 = 1024 !

    // ☁️ Création de nuages très optimisés (5 au lieu de 8, 3 parties au lieu de 5)
    for (let i = 0; i < 5; i++) {
      const cloud = new THREE.Group();

      // Chaque nuage = 3 sphères légères au lieu de 5 lourdes
      for (let j = 0; j < 3; j++) {
        const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);

        cloudPart.position.x = Math.random() * 8 - 4;
        cloudPart.position.y = Math.random() * 1.5 - 0.75;
        cloudPart.position.z = Math.random() * 8 - 4;
        cloudPart.scale.setScalar(Math.random() * 0.4 + 0.6);

        cloud.add(cloudPart);
      }

      // Position des nuages dans le ciel
      cloud.position.set(
        (Math.random() - 0.5) * 150, // Réduit la zone de répartition
        Math.random() * 25 + 25, // Y: 25 à 50 (plus haut)
        (Math.random() - 0.5) * 150
      );

      cloudGroup.add(cloud);
    }

    this.scene.add(cloudGroup);

    // 📊 Log de l'optimisation
    logger.info(
      `Nuages optimisés ajoutés: ${5 * 3 * 12} triangles (au lieu de ${
        8 * 5 * 1024
      })`
    );
  }

  /**
   * 🌍 Création d'un sol amélioré avec grille - Sol plat avec grille visible
   */
  private createImprovedGround(): void {
    const config = CONFIG.environment.ground;

    // 🟫 Sol plat principal - Taille augmentée avec couleur améliorée
    const groundGeometry = new THREE.PlaneGeometry(config.size, config.size, 1, 1);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: config.baseColor, // Vert naturel au lieu du vert criard
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // 📐 Grille principale - Visible et bien contrastée
    const gridSize = config.size;
    const gridDivisions = 20; // 20 divisions = 1 ligne tous les 15m pour un terrain de 300m
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      0x444444, // Lignes principales (gris foncé)
      0x666666  // Lignes secondaires (gris moyen)
    );
    this.scene.add(gridHelper);

    // 📐 Grille fine additionnelle pour plus de détails
    const fineGridHelper = new THREE.GridHelper(
      gridSize / 2, // Grille plus petite au centre
      gridDivisions * 2, // Plus de divisions
      0x333333, // Encore plus sombre
      0x555555  // Lignes très fines
    );
    fineGridHelper.material.opacity = 0.5;
    fineGridHelper.material.transparent = true;
    this.scene.add(fineGridHelper);

    logger.info(`Sol amélioré créé: ${config.size}x${config.size}m avec grilles`);
  }
}
