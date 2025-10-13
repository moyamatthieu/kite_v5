import { Simulation } from "./simulation";

// Ajout de logs pour le débogage
console.log('Chargement du fichier main.ts');

// Initialisation de la simulation
async function startSimulation() {
  try {
    const app = new Simulation();

    // Ajout de logs pour vérifier l'initialisation
    console.log('Initialisation de l\'application');
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

// Ajout de logs pour vérifier le rendu
console.log('Rendu en cours...');
