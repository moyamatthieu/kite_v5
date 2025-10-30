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
import { OrbitControls } from 'three-stdlib';

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
    super('CameraControlsSystem', 1); // Très haute priorité
    this.camera = camera;

    this.controls = new OrbitControls(camera, canvas);
    this.setupControls();
    
    // Log position initiale
    console.log('📷 Camera position initiale:', this.camera.position.toArray());
    console.log('🎯 Camera target initial:', this.controls.target.toArray());
    this.lastLoggedPosition.copy(this.camera.position);
    this.lastLoggedTarget.copy(this.controls.target);
    this.lastLoggedDistance = this.camera.position.distanceTo(this.controls.target);
  }

  private setupControls(): void {
    // Configuration des contrôles
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Activer tous les contrôles explicitement
    this.controls.enableRotate = true; // Clic gauche : rotation
    this.controls.enableZoom = true;   // Molette : zoom
    this.controls.enablePan = true;    // Clic droit : pan
    this.controls.screenSpacePanning = true; // Pan en espace écran (3D)
    
    // Limites
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Empêche la caméra de passer sous le sol
    
    // Position cible
    this.controls.target.set(-3.92, 0, -12.33); // Target optimale trouvée manuellement
    
    // Appliquer les changements
    this.controls.update();
    
    // Debug : vérifier que les contrôles sont bien configurés
    console.log('📷 Camera Controls configured:', {
      enableRotate: this.controls.enableRotate,
      enableZoom: this.controls.enableZoom,
      enablePan: this.controls.enablePan,
      screenSpacePanning: this.controls.screenSpacePanning
    });
  }

  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }

  update(_context: SimulationContext): void {
    this.controls.update();
    
    // Logger les changements de position/zoom/pan
    const now = performance.now();
    if (now - this.lastLogTime > this.logInterval) {
      const posChanged = !this.camera.position.equals(this.lastLoggedPosition);
      const targetChanged = !this.controls.target.equals(this.lastLoggedTarget);
      const currentDistance = this.camera.position.distanceTo(this.controls.target);
      const distanceChanged = Math.abs(currentDistance - this.lastLoggedDistance) > 0.01;
      
      if (posChanged || targetChanged || distanceChanged) {
        console.log('📷 Camera changed:');
        if (posChanged) {
          console.log('  Position:', this.camera.position.toArray().map(v => v.toFixed(2)));
        }
        if (targetChanged) {
          console.log('  Target:', this.controls.target.toArray().map(v => v.toFixed(2)));
        }
        if (distanceChanged) {
          console.log('  Distance (zoom):', currentDistance.toFixed(2));
        }
        
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
