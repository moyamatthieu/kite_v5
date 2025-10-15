import { SimulationApp } from "@/ecs/SimulationApp";

// Initialisation de la simulation
async function startSimulation() {
  console.log('🚀 Starting simulation...');
  try {
    const app = new SimulationApp();
    console.log('✅ SimulationApp created');
    
    await app.initialize();
    console.log('✅ SimulationApp initialized');

    // Démarrer la simulation
    app.start();
    console.log('✅ Simulation started');

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener("beforeunload", () => {
      app.dispose();
    });
  } catch (error) {
    console.error('❌ Simulation error:', error);
  }
}

// Lancer la simulation au chargement
console.log('🎬 Main.ts loaded');
startSimulation();
