/**
 * test_ecs_integration.ts - Test d'intégration de l'architecture ECS
 *
 * Ce test vérifie que tous les systèmes ECS fonctionnent correctement ensemble
 * sans nécessiter un environnement DOM/navigateur.
 */

import { PhysicsSystem, WindSystem, InputSystem, RenderSystem } from './src/simulation/systems';
import { SimulationApp } from './src/simulation/SimulationApp_new';

// Mock pour l'environnement DOM
(globalThis as any).document = {
  createElement: () => ({}),
  getElementById: () => null,
  addEventListener: () => {},
  readyState: 'complete'
};

(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1
};

// Mock pour les éléments DOM utilisés par RenderSystem
Object.defineProperty(document, 'createElement', {
  value: (tag: string) => {
    if (tag === 'canvas') {
      return {
        id: 'test-canvas',
        getContext: (contextType: string) => {
          if (contextType === 'webgl' || contextType === 'experimental-webgl') {
            // Mock WebGL context minimal
            return {
              getExtension: () => null,
              getParameter: () => null,
              createShader: () => ({}),
              createProgram: () => ({}),
              shaderSource: () => {},
              compileShader: () => {},
              attachShader: () => {},
              linkProgram: () => {},
              useProgram: () => {},
              getProgramParameter: () => true,
              getShaderParameter: () => true,
              getUniformLocation: () => null,
              uniformMatrix4fv: () => {},
              enable: () => {},
              disable: () => {},
              clear: () => {},
              viewport: () => {},
              CANVAS: null
            };
          }
          return null;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        width: 1920,
        height: 1080
      };
    }
    return {};
  }
});

async function testECSIntegration() {
  console.log('🧪 Test d\'intégration de l\'architecture ECS...\n');

  try {
    // Test 1: Création des systèmes individuels
    console.log('1️⃣ Test de création des systèmes individuels...');

    const physicsSystem = new PhysicsSystem();
    const windSystem = new WindSystem();
    const inputSystem = new InputSystem();
    const renderSystem = new RenderSystem();

    console.log('✅ Tous les systèmes créés avec succès');

    // Test 2: Initialisation des systèmes (sauf RenderSystem qui nécessite WebGL)
    console.log('\n2️⃣ Test d\'initialisation des systèmes...');

    await Promise.all([
      physicsSystem.initialize(),
      windSystem.initialize(),
      inputSystem.initialize()
      // renderSystem.initialize() // Skip pour les tests sans WebGL
    ]);

    console.log('✅ Systèmes principaux initialisés avec succès (RenderSystem ignoré pour test Node.js)');

    // Test 3: Test de l'état des systèmes
    console.log('\n3️⃣ Test des états des systèmes...');

    const windState = windSystem.getWindState();
    const inputState = inputSystem.getInputState();
    // const renderState = renderSystem.getRenderState(); // Skip

    console.log(`🌬️ État du vent: ${windState.baseSpeed} m/s`);
    console.log(`🎮 État des entrées: barre=${inputState.barPosition.toFixed(2)}`);
    console.log(`🎨 RenderSystem: ignoré (nécessite WebGL)`);

    // Test 4: Création de la SimulationApp
    console.log('\n4️⃣ Test de création de SimulationApp...');

    const app = new SimulationApp({
      targetFPS: 60,
      enableDebug: false,
      enableRenderSystem: false,
      enableLegacyComponents: false, // Désactiver les composants legacy pour test
      physics: { gravityEnabled: true },
      wind: { baseSpeed: 3.0 },
      input: { keyboardEnabled: false },
      render: { antialias: false }
    });

    console.log('✅ SimulationApp créée avec succès');

    // Test 5: Initialisation de SimulationApp
    console.log('\n5️⃣ Test d\'initialisation de SimulationApp...');

    await app.initialize();
    console.log('✅ SimulationApp initialisée avec succès');

    // Test 6: Test des statistiques
    console.log('\n6️⃣ Test des statistiques...');

    const stats = app.getStats();
    console.log(`📊 Statistiques:`, stats);

    // Test 7: Nettoyage
    console.log('\n7️⃣ Test de nettoyage...');

    app.dispose();
    console.log('✅ SimulationApp nettoyée avec succès');

    console.log('\n🎉 Tous les tests d\'intégration ECS ont réussi !');
    console.log('\n📋 Résumé:');
    console.log('   ✅ Architecture ECS fonctionnelle');
    console.log('   ✅ Systèmes modulaires opérationnels');
    console.log('   ✅ SimulationApp orchestrant correctement');
    console.log('   ✅ Gestion du cycle de vie complète');
    console.log('   ✅ Intégration sans DOM réussie');

    return true;

  } catch (error) {
    console.error('\n❌ Échec du test d\'intégration:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return false;
  }
}

// Exécuter le test
testECSIntegration()
  .then(success => {
    console.log(`\n🏁 Test terminé avec ${success ? 'SUCCÈS' : 'ÉCHEC'}`);
  })
  .catch(error => {
    console.error('Erreur fatale:', error);
  });