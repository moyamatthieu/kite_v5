/**
 * main.ts - Point d'entrée de la simulation ECS pure
 */

import { SimulationApp } from './SimulationApp';
import { Logger } from './utils/Logging';

// Créer le canvas
const canvas = document.createElement('canvas');
canvas.id = 'simulation-canvas';
document.body.appendChild(canvas);

// Initialiser le logger
const logger = Logger.getInstance();

// Initialiser et démarrer la simulation
const app = new SimulationApp(canvas);

app.initialize()
  .then(() => {
    logger.info('✅ Simulation initialized', 'Main');
    app.start();
    logger.info('▶️  Simulation started', 'Main');
  })
  .catch((error: Error) => {
    logger.error('❌ Failed to initialize simulation', 'Main', error);
  });

// Exposer l'app globalement pour debug
interface WindowWithSimulation extends Window {
  simulation?: SimulationApp;
}

(window as WindowWithSimulation).simulation = app;
