import { Simulation } from "./simulation";

// Initialisation de la simulation
console.log("🚀 Démarrage de la simulation ...");

async function startSimulation() {
  try {
    const app = new Simulation();
    await app.initialize();
    console.log("✅ Simulation initialisée avec succès");
    
    // Démarrer la simulation
    await app.start();
    console.log("▶️ Simulation démarrée");

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener("beforeunload", () => {
      if (app && typeof app.dispose === "function") {
        app.dispose();
      }
    });
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la simulation:", error);
  }
}

// Lancer la simulation au chargement
startSimulation();
