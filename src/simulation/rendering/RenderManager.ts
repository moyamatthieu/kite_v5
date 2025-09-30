/**
 * RenderManager.ts - Gestionnaire du rendu 3D pour la simulation Kite
 *
 * Rôle :
 *   - Gère la scène Three.js, la caméra, le rendu et l'environnement visuel (ciel, sol, nuages, lumières)
 *   - Ajoute et retire dynamiquement des objets 3D (cerf-volant, flèches de debug, etc.)
 *   - Fournit l'API pour le rendu et la gestion de la scène
 *
 * Dépendances principales :
 *   - Three.js : Moteur de rendu 3D
 *   - SimulationConfig.ts : Paramètres de configuration du rendu (fog, ombres, etc.)
 *
 * Relation avec les fichiers adjacents :
 *   - DebugRenderer.ts : Fichier adjacent direct, utilise RenderManager pour afficher les vecteurs de debug (flèches de forces, vitesse, etc.)
 *   - Les autres fichiers du dossier 'rendering' sont absents, la relation est donc principalement avec DebugRenderer.
 *
 * Utilisation typique :
 *   - Instancié au démarrage de la simulation pour initialiser la scène et le rendu
 *   - Utilisé par DebugRenderer pour ajouter/retirer des objets de debug
 *
 * Voir aussi :
 *   - src/simulation/rendering/DebugRenderer.ts
 *   - src/simulation/config/SimulationConfig.ts
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Gestionnaire du rendu 3D
 *
 * Gère la scène 3D, la caméra, le rendu et l'environnement visuel
 */
export class RenderManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      0x87ceeb,
      CONFIG.rendering.fogStart,
      CONFIG.rendering.fogEnd
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
      antialias: CONFIG.rendering.antialias,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
    sunLight.shadow.mapSize.width = CONFIG.rendering.shadowMapSize;
    sunLight.shadow.mapSize.height = CONFIG.rendering.shadowMapSize;
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
}