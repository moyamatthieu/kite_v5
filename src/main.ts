import { Logger, LogLevel } from './ecs/utils/Logging';
import { SimpleSimulationApp } from './ecs/SimpleSimulationApp';

// Initialisation de la simulation
async function startSimulation() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.DEBUG); // Afficher tous les logs au démarrage

  logger.info('🚀 Starting simulation...', 'Main');
  try {
    // Créer ou récupérer le canvas
    const canvas = document.getElementById('simulation-canvas') as HTMLCanvasElement 
      || document.createElement('canvas');
    
    if (!canvas.parentElement) {
      canvas.id = 'simulation-canvas';
      document.body.appendChild(canvas);
    }
    
    const app = new SimpleSimulationApp(canvas);
    logger.info('✅ SimpleSimulationApp created', 'Main');

    await app.initialize();
    logger.info('✅ SimpleSimulationApp initialized', 'Main');

    // Démarrer la simulation
    app.start();
    logger.info('✅ Simulation started', 'Main');

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener('beforeunload', () => {
      app.dispose();
    });
  } catch (error) {
    logger.error('❌ Simulation error:', 'Main', error);
  }
}

// Lancer la simulation au chargement
Logger.getInstance().info('🎬 Main.ts loaded', 'Main');
startSimulation();
