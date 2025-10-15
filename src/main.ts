import { SimulationApp } from '@/ecs/SimulationApp';
import { Logger, LogLevel } from '@utils/Logging';

// Initialisation de la simulation
async function startSimulation() {
  const logger = Logger.getInstance();
  logger.setLogLevel(LogLevel.DEBUG); // Afficher tous les logs au démarrage

  logger.info('🚀 Starting simulation...', 'Main');
  try {
    const app = new SimulationApp();
    logger.info('✅ SimulationApp created', 'Main');

    await app.initialize();
    logger.info('✅ SimulationApp initialized', 'Main');

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
