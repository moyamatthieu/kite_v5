/**
 * EnvironmentSystem.ts - Gère l'environnement 3D (sol, ciel, éclairage)
 * 
 * Crée :
 * - Un sol vert
 * - Un ciel bleu
 * - L'éclairage ambiant et directionnel
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';

export class EnvironmentSystem extends System {
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene) {
    super('EnvironmentSystem', 1); // Très haute priorité (avant caméra)
    this.scene = scene;
    this.setupEnvironment();
  }
  
  private setupEnvironment(): void {
    // === SOL VERT ===
    // Le sol est dans le plan XZ avec Y = 0 (horizontal)
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d8a2d, // Vert
      roughness: 0.8,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    // Rotation pour que le plan XY devienne XZ (rotation autour de X-axis)
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Grid helper pour visualiser (optionnel mais utile)
    // GridHelper est dans le plan XZ par défaut, pas besoin de rotation
    const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x888888);
    gridHelper.position.y = 0.01; // Juste au-dessus du sol
    this.scene.add(gridHelper);
    
    // === CIEL BLEU ===
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB, // Bleu ciel
      side: THREE.BackSide // Visible de l'intérieur
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
    
    // === ÉCLAIRAGE ===
    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // Lumière directionnelle (soleil)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.far = 500;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
  }
  
  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }
  
  update(_context: SimulationContext): void {
    // Rien à faire (environnement statique)
  }
  
  dispose(): void {
    // Nettoyage si nécessaire
  }
}
