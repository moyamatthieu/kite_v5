/**
 * CameraControlsSystem.ts - Contrôles caméra professionnels (OrbitControls)
 * 
 * Inspiration : Three.js OrbitControls
 * - Clic droit/molette + mouvement : orbiter autour d'une cible
 * - WASD : déplacement de la cible
 * - Q/E : hauteur
 * - Molette : zoom
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';

export class CameraControlsSystem extends System {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private lastLoggedPosition = new THREE.Vector3();
  private lastLoggedTarget = new THREE.Vector3();
  private lastLoggedDistance = 0;
  private logInterval = 1000;
  private lastLogTime = 0;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    super('CameraControlsSystem', 1);
    this.camera = camera;

    this.controls = new OrbitControls(camera, canvas);
    this.setupControls();
    
    this.lastLoggedPosition.copy(this.camera.position);
    this.lastLoggedTarget.copy(this.controls.target);
    this.lastLoggedDistance = this.camera.position.distanceTo(this.controls.target);
  }

  private setupControls(): void {
    // === Damping pour des mouvements fluides ===
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08; // Plus élevé = plus fluide
    
    // === Rotation (orbite) - Clic gauche ===
    this.controls.enableRotate = true;
    this.controls.rotateSpeed = 0.8; // Sensibilité rotation (défaut: 1.0)
    
    // === Zoom - Molette ===
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 1.2; // Sensibilité zoom (défaut: 1.0)
    this.controls.minDistance = 8; // Distance minimale de la cible
    this.controls.maxDistance = 150; // Distance maximale de la cible
    
    // === Pan - Clic droit ou Clic du milieu ===
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.8; // Sensibilité pan (défaut: 1.0)
    this.controls.screenSpacePanning = true; // Pan en espace écran (plus intuitif)
    
    // === Limites angulaires ===
    this.controls.minPolarAngle = 0; // Peut aller jusqu'en haut
    this.controls.maxPolarAngle = Math.PI * 0.48; // Empêche de passer sous le sol
    // Pas de limite azimutale (rotation 360° libre)
    
    // === Mapping des boutons souris (par défaut) ===
    // MOUSE.LEFT = rotation/orbite
    // MOUSE.MIDDLE = zoom (optionnel)
    // MOUSE.RIGHT = pan
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    
    // === Position cible (centre d'orbite) ===
    this.controls.target.set(-3.92, 0, -12.33);
    
    this.controls.update();
    
    console.log('📷 Contrôles caméra configurés (orbite, pan, zoom)');
  }

  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }

  update(_context: SimulationContext): void {
    this.controls.update();
    
    // Log seulement les changements significatifs (toutes les secondes)
    const now = performance.now();
    if (now - this.lastLogTime > this.logInterval) {
      const posChanged = this.camera.position.distanceTo(this.lastLoggedPosition) > 0.1;
      const targetChanged = this.controls.target.distanceTo(this.lastLoggedTarget) > 0.1;
      const currentDistance = this.camera.position.distanceTo(this.controls.target);
      const distanceChanged = Math.abs(currentDistance - this.lastLoggedDistance) > 0.5;
      
      if (posChanged || targetChanged || distanceChanged) {
        this.lastLoggedPosition.copy(this.camera.position);
        this.lastLoggedTarget.copy(this.controls.target);
        this.lastLoggedDistance = currentDistance;
      }
      
      this.lastLogTime = now;
    }
  }

  dispose(): void {
    this.controls.dispose();
  }
}
