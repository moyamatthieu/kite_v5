/**
 * RenderManager.ts - Gestion du rendu 3D
 *
 * Responsabilité : Gérer la scène 3D, l'éclairage, l'environnement et le rendu
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RENDER_CONFIG } from "../config/RenderConfig";

export class RenderManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      0x87ceeb,
      RENDER_CONFIG.fogStart,
      RENDER_CONFIG.fogEnd
    );

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(3, 5, 12);
    this.camera.lookAt(0, 3, -5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: RENDER_CONFIG.antialias,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Doux
    this.renderer.shadowMapSize = 4096; // Haute résolution

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 50;
    this.controls.minDistance = 2;

    this.setupEnvironment();
    window.addEventListener("resize", () => this.onResize());
  }

  private setupEnvironment(): void {
    // Création d'un beau ciel dégradé
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) }, // Bleu ciel profond
        bottomColor: { value: new THREE.Color(0x87ceeb) }, // Bleu ciel plus clair
        offset: { value: 400 },
        exponent: { value: 0.6 },
      },
      side: THREE.BackSide,
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);

    // Ajout de quelques nuages pour plus de réalisme
    this.addClouds();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 50, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.mapSize.width = RENDER_CONFIG.shadowMapSize;
    sunLight.shadow.mapSize.height = RENDER_CONFIG.shadowMapSize;
    this.scene.add(sunLight);

    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x7cfc00 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    this.scene.add(gridHelper);
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    // Création de quelques nuages simples et réalistes
    const cloudGroup = new THREE.Group();

    // Matériau pour les nuages - blanc semi-transparent
    const cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });

    // Création de plusieurs nuages à différentes positions
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();

      // Chaque nuage est composé de plusieurs sphères pour un aspect naturel
      for (let j = 0; j < 5; j++) {
        const cloudPart = new THREE.Mesh(
          new THREE.SphereGeometry(Math.random() * 4 + 2, 6, 4),
          cloudMaterial
        );

        cloudPart.position.x = Math.random() * 10 - 5;
        cloudPart.position.y = Math.random() * 2 - 1;
        cloudPart.position.z = Math.random() * 10 - 5;
        cloudPart.scale.setScalar(Math.random() * 0.5 + 0.5);

        cloud.add(cloudPart);
      }

      // Position des nuages dans le ciel
      cloud.position.set(
        (Math.random() - 0.5) * 200, // X: -100 à 100
        Math.random() * 30 + 20, // Y: 20 à 50 (hauteur dans le ciel)
        (Math.random() - 0.5) * 200 // Z: -100 à 100
      );

      cloudGroup.add(cloud);
    }

    this.scene.add(cloudGroup);
  }
}
