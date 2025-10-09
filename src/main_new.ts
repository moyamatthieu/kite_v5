import { SimulationApp } from "./simulation/SimulationApp_new";

// Initialisation de la nouvelle simulation ECS-inspired
console.log("🚀 Démarrage de la simulation V9 - Architecture ECS ...");

async function initSimulation() {
  try {
    const app = new SimulationApp({
      targetFPS: 60,
      enableDebug: true,
      physics: {
        gravityEnabled: true,
        airResistanceEnabled: true
      },
      wind: {
        baseSpeed: 5.0,
        turbulenceEnabled: true,
        gustsEnabled: true
      },
      input: {
        keyboardEnabled: true,
        barSmoothingEnabled: true
      },
      render: {
        antialias: true,
        shadowMapEnabled: true,
        clearColor: 0x87CEEB // Bleu ciel
      }
    });

    console.log("📦 Initialisation de la SimulationApp...");
    await app.initialize();
    console.log("✅ SimulationApp initialisée avec succès");

    console.log("▶️ Démarrage de la simulation...");
    app.start();
    console.log("🎯 Simulation démarrée - Utilisez les flèches pour contrôler la barre");

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener("beforeunload", () => {
      console.log("🧹 Nettoyage de la simulation...");
      app.dispose();
    });

    // Exposition globale pour debug (optionnel)
    (window as any).simulationApp = app;

  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la simulation:", error);
    throw error;
  }
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSimulation);
} else {
  initSimulation();
}