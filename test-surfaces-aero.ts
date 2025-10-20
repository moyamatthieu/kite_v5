/**
 * test-surfaces-aero.ts - Test des surfaces dans AeroSystem
 * 
 * Script de test qui initialise le simulateur et capture les logs
 * pour vérifier les surfaces détectées et leurs normales.
 */

import * as THREE from 'three';
import { EntityManager } from './src/ecs/core/EntityManager';
import { KiteFactory } from './src/ecs/entities/KiteFactory';
import { WindSystem } from './src/ecs/systems/WindSystem';
import { AeroSystem } from './src/ecs/systems/AeroSystem';
import { PhysicsSystem } from './src/ecs/systems/PhysicsSystem';
import { SimulationContext } from './src/ecs/core/System';
import type { GeometryComponent } from './src/ecs/components/GeometryComponent';

// ============================================================================
// CAPTURE DES LOGS
// ============================================================================

const logs: string[] = [];
const originalLog = console.log;

console.log = function(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logs.push(message);
  originalLog.apply(console, args);
};

// ============================================================================
// INITIALISATION DU SIMULATEUR
// ============================================================================

console.log('='.repeat(80));
console.log('TEST: Initialisation du simulateur');
console.log('='.repeat(80));

const entityManager = new EntityManager();

// Créer le kite
const kite = KiteFactory.create(new THREE.Vector3(0, 1, 0));
entityManager.register(kite);

console.log('\n✅ Kite créé');
console.log(`   Entité: ${kite.id}`);

// Vérifier les surfaces
const geometry = kite.getComponent<GeometryComponent>('geometry');
if (geometry) {
  console.log(`   Surfaces géométrie: ${(geometry as any).surfaces.length}`);
  (geometry as any).surfaces.forEach((surf: any, idx: number) => {
    console.log(`     ${idx}: ${surf.points.join(' -> ')}`);
  });
}

// ============================================================================
// EXÉCUTION DES SYSTÈMES
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXÉCUTION: Premier frame du simulateur');
console.log('='.repeat(80));

// Créer les systèmes
const windSystem = new WindSystem();
const aeroSystem = new AeroSystem();
const physicsSystem = new PhysicsSystem();

// Créer le contexte de simulation
const context: SimulationContext = {
  entityManager,
  deltaTime: 0.016, // 60 FPS
  totalTime: 0,
  windCache: new Map(),
};

// Exécuter les systèmes
console.log('\n🔄 Exécution WindSystem...');
windSystem.update(context);

console.log('\n🔄 Exécution AeroSystem...');
aeroSystem.update(context);

console.log('\n🔄 Exécution PhysicsSystem...');
physicsSystem.update(context);

// ============================================================================
// RÉSUMÉ
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RÉSUMÉ DES LOGS CAPTURÉS');
console.log('='.repeat(80));
console.log(logs.join('\n'));

console.log('\n' + '='.repeat(80));
console.log('FIN DU TEST');
console.log('='.repeat(80));
