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
  private canvas: HTMLCanvasElement;
  // Variables de logging (désactivées en production)
  // private lastLoggedPosition = new THREE.Vector3();
  // private lastLoggedTarget = new THREE.Vector3();
  // private logInterval = 1000;
  // private lastLogTime = 0;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    super('CameraControlsSystem', 1); // Très haute priorité
    this.camera = camera;
    this.canvas = canvas;

    this.controls = new OrbitControls(camera, canvas);
    this.setupControls();
    this.setupCanvasEvents();
    
    // Log position initiale (désactivé en production)
    // console.log('📷 Camera position initiale:', this.camera.position);
    // console.log('🎯 Camera target initial:', this.controls.target);
    // this.lastLoggedPosition.copy(this.camera.position);
    // this.lastLoggedTarget.copy(this.controls.target);
  }

  private setupControls(): void {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Empêche la caméra de passer sous le sol
    this.controls.target.set(0, 6, -10); // Vue derrière le pilote vers le kite
    
    // Note : L'avertissement "non-passive event listener" vient de Three.js OrbitControls
    // et ne peut être corrigé sans modifier la bibliothèque elle-même.
    // Cet avertissement n'affecte pas les performances dans notre cas d'usage.
    
    this.controls.update();
  }

  /**
   * Configure les événements du canvas pour permettre les contrôles de la souris
   */
  private setupCanvasEvents(): void {
    // Désactiver le menu contextuel par défaut pour permettre le clic droit
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Rendre le canvas focusable pour capturer les événements clavier
    this.canvas.setAttribute('tabindex', '0');
    
    // Focus automatique pour capturer immédiatement les événements
    this.canvas.focus();
  }

  initialize(_entityManager: EntityManager): void {
    // Rien à faire
  }

  update(_context: SimulationContext): void {
    this.controls.update();
    
    // Logger les changements de position (désactivé en production)
    /* 
    const now = performance.now();
    if (now - this.lastLogTime > this.logInterval) {
      const posChanged = !this.camera.position.equals(this.lastLoggedPosition);
      const targetChanged = !this.controls.target.equals(this.lastLoggedTarget);
      
      if (posChanged || targetChanged) {
        console.log('📷 Camera moved:');
        if (posChanged) {
          console.log('  Position:', this.camera.position.toArray().map(v => v.toFixed(2)));
        }
        if (targetChanged) {
          console.log('  Target:', this.controls.target.toArray().map(v => v.toFixed(2)));
        }
        
        this.lastLoggedPosition.copy(this.camera.position);
        this.lastLoggedTarget.copy(this.controls.target);
      }
      
      this.lastLogTime = now;
    }
    */
  }

  dispose(): void {
    this.controls.dispose();
  }
}
