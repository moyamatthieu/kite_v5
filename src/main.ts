import { Simulation } from "./simulation";

// Initialisation de la simulation
async function startSimulation() {
  try {
    const app = new Simulation();
    await app.initialize();

    // Démarrer la simulation
    await app.start();

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener("beforeunload", () => {
      if (app && typeof app.dispose === "function") {
        app.dispose();
      }
    });
  } catch {
    // Gestion d'erreur silencieuse - les erreurs sont déjà loggées par la simulation
  }
}

// Lancer la simulation au chargement
startSimulation();
