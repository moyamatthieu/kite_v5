import * as THREE from 'three';
import { Logger } from '@utils/Logging';

interface DebugRendererOptions {
  addObject: (obj: THREE.Object3D) => void;
  removeObject: (obj: THREE.Object3D) => void;
  getScene: () => THREE.Scene | null;
}

export class DebugRenderer {
  private options: DebugRendererOptions;
  private debugMode: boolean;
  private logger = Logger.getInstance();

  constructor(options: DebugRendererOptions) {
    this.options = options;
    this.debugMode = false;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    this.logger.info(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`, 'DebugRenderer');
  }

  updateDebugDisplay(data: unknown): void {
    if (!this.debugMode) return;
    this.logger.debug('Updating debug display with data:', 'DebugRenderer', data);
    // Ajoutez ici la logique pour mettre à jour les éléments de débogage
  }

  updateDebugVectors(_kite: unknown, _physicsSystem: unknown): void {
    if (!this.debugMode) return;
    this.logger.debug(
      'Updating debug vectors for kite and physics system',
      'DebugRenderer'
    );
    // Ajoutez ici la logique pour mettre à jour les vecteurs de débogage
  }
}