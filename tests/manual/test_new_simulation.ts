/**
 * test_new_simulation.ts - Test de la nouvelle architecture ECS-inspired
 */

import { SimulationApp } from '../../src/simulation/SimulationApp';

async function testNewSimulationApp(): Promise<void> {
  console.log('🧪 Testing new SimulationApp with ECS architecture...');

  try {
    // Créer l'application de simulation
    const app = new SimulationApp({
      targetFPS: 60,
      enableDebug: true,
      physics: {
        gravityEnabled: true,
        airResistanceEnabled: true
      },
      wind: {
        baseSpeed: 5.0
      },
      input: {
        keyboardEnabled: true
      },
      render: {
        antialias: true,
        shadowMapEnabled: true
      }
    });

    // Initialiser
    await app.initialize();
    console.log('✅ SimulationApp initialized successfully');

    // Vérifier les statistiques
    const stats = app.getStats();
    console.log('📊 Initial stats:', stats);

    // Démarrer brièvement
    app.start();
    console.log('▶️ Simulation started');

    // Attendre un peu
    await new Promise(resolve => setTimeout(resolve, 100));

    // Vérifier les stats après démarrage
    const updatedStats = app.getStats();
    console.log('📊 Updated stats:', updatedStats);

    // Arrêter
    app.stop();
    console.log('⏹️ Simulation stopped');

    // Nettoyer
    app.dispose();
    console.log('🧹 Simulation disposed');

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Exécuter le test si ce fichier est exécuté directement
if (typeof window !== 'undefined') {
  // Dans le navigateur, attendre que le DOM soit prêt
  document.addEventListener('DOMContentLoaded', () => {
    testNewSimulationApp().catch(console.error);
  });
} else {
  // Dans Node.js ou autre environnement
  testNewSimulationApp().catch(console.error);
}