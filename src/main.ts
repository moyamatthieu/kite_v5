import { SimulationAppV8 } from './simulationV8';

// Initialisation de la simulation autonome V8
console.log('🚀 Démarrage de la simulation V8 autonome...');

try {
    const app = new SimulationAppV8();
    console.log('✅ Simulation V8 initialisée avec succès');

    // Gestion du nettoyage lors de la fermeture de la page
    window.addEventListener('beforeunload', () => {
        if (app && typeof app.cleanup === 'function') {
            app.cleanup();
        }
    });
} catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la simulation V8:', error);
}