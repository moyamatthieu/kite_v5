import { SimulationApp } from "@/ecs/SimulationApp";

// Initialisation de la simulation
async function startSimulation() {
  try {
    const app = new SimulationApp();
    await app.initialize();

    // Démarrer la simulation
    app.start();

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener("beforeunload", () => {
      app.dispose();
    });
  } catch {
    // Gestion d'erreur silencieuse - les erreurs sont déjà loggées par la simulation
  }
}

// Lancer la simulation au chargement
startSimulation();
