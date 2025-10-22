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

// Exposer l'app globalement pour debug dans la console
interface WindowWithSimulation extends Window {
  simulation?: SimulationApp;
  app?: SimulationApp;
}

const windowWithSim = window as WindowWithSimulation;
windowWithSim.simulation = app;
windowWithSim.app = app; // Alias plus court

// Log instructions de debug
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🔍 DEBUG CONSOLE - Commandes disponibles                     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  🎯 Debug Aérodynamique Détaillé:                            ║
║  ─────────────────────────────────────────                   ║
║  window.app.setAeroDebug(true)       // Toutes surfaces      ║
║  window.app.setAeroDebug(true, 0)    // Surface 0 uniquement ║
║  window.app.setAeroDebug(false)      // Désactiver           ║
║                                                               ║
║  📊 Affiche pour chaque surface:                             ║
║     • Positions (CP, bras de levier)                         ║
║     • Orientations (normales, directions de forces)          ║
║     • Calculs intermédiaires (Cl, Cd, α, q)                  ║
║     • Forces finales (portance, traînée, gravité)            ║
║                                                               ║
║  ⚠️  PROBLÈME ACTUEL:                                        ║
║     Les lignes sont SLACK (tension=0N) car le kite est       ║
║     trop proche (14.7m < 15m). Activer le debug pour voir    ║
║     si les forces aéro poussent le kite correctement.        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
