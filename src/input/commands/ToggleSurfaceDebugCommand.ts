/**
 * ToggleSurfaceDebugCommand.ts - Commande pour activer/d�sactiver les fl�ches de debug par triangle
 */

import { Command } from '../Command';
import type { SimulationApp } from '../../app/SimulationApp';

export class ToggleSurfaceDebugCommand extends Command {
  constructor(app: SimulationApp) {
    super(app, 'T', 'Toggle Surface Debug', 'Affiche/masque les fl�ches de force par triangle');
  }

  execute(): void {
    this.app.toggleDebugVisuals();
    console.log('=: Fl�ches par triangle:', this.app.debugVisualsEnabled ? 'ON' : 'OFF');
  }
}