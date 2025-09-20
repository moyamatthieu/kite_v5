import { Simulation } from "./simulation";

// Initialisation de la simulation
console.log("🚀 Démarrage de la simulation ...");

try {
  // Récupération du conteneur DOM correct
  const container = document.getElementById('app');
  if (!container) {
    throw new Error("Conteneur #app non trouvé dans le DOM");
  }

  const app = new Simulation(container);
  console.log("✅ Simulation initialisée avec succès");

  // Gestion du nettoyage lors de la fermeture de la page
  window.addEventListener("beforeunload", () => {
    if (app && typeof app.cleanup === "function") {
      app.cleanup();
    }
  });
} catch (error) {
  console.error("❌ Erreur lors de l'initialisation de la simulation:", error);
}
