import * as THREE from 'three';

interface DebugRendererOptions {
  addObject: (obj: THREE.Object3D) => void;
  removeObject: (obj: THREE.Object3D) => void;
  getScene: () => THREE.Scene | null;
}

export class DebugRenderer {
  private options: DebugRendererOptions;
  private debugMode: boolean;

  constructor(options: DebugRendererOptions) {
    this.options = options;
    this.debugMode = false;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    console.log(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
  }

  updateDebugDisplay(data: any): void {
    if (!this.debugMode) return;
    console.log('Updating debug display with data:', data);
    // Ajoutez ici la logique pour mettre à jour les éléments de débogage
  }

  updateDebugVectors(kite: any, physicsSystem: any): void {
    if (!this.debugMode) return;
    console.log('Updating debug vectors for kite and physics system');
    // Ajoutez ici la logique pour mettre à jour les vecteurs de débogage
  }
}