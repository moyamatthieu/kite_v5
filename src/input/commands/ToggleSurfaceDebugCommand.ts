/**
 * ToggleSurfaceDebugCommand.ts - Commande pour activer/désactiver les flèches de debug par triangle
 */

import { Command } from '../Command';
import type { SimulationApp } from '../../app/SimulationApp';

export class ToggleSurfaceDebugCommand extends Command {
  constructor(app: SimulationApp) {
    super(app, 'T', 'Toggle Surface Debug', 'Affiche/masque les flèches de force par triangle');
  }

  execute(): void {
    this.app.toggleDebugVisuals();
    console.log('=: Flèches par triangle:', this.app.debugVisualsEnabled ? 'ON' : 'OFF');
  }
}