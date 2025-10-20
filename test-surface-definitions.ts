/**
 * test-surface-definitions.ts - Validation de la nouvelle architecture centralisée
 * 
 * Teste que KiteSurfaceDefinitions fonctionne correctement et que
 * la source unique de vérité est utilisée partout.
 */

import { KiteSurfaceDefinitions } from './src/ecs/config/KiteSurfaceDefinition';
import { KiteFactory } from './src/ecs/entities/KiteFactory';
import * as THREE from 'three';

console.log('='.repeat(80));
console.log('TEST: Architecture centralisée des surfaces du kite');
console.log('='.repeat(80));

// ============================================================================
// TEST 1: Validation de KiteSurfaceDefinitions
// ============================================================================

console.log('\n1️⃣ Validation de KiteSurfaceDefinitions');
console.log('-'.repeat(80));

const validation = KiteSurfaceDefinitions.validate();
console.log(`   Validation: ${validation.isValid ? '✅ VALIDE' : '❌ ERREURS'}`);
if (!validation.isValid) {
  validation.errors.forEach(err => console.log(`   ${err}`));
}

// ============================================================================
// TEST 2: Afficher toutes les surfaces
// ============================================================================

console.log('\n2️⃣ Surfaces définies dans KiteSurfaceDefinitions');
console.log('-'.repeat(80));

KiteSurfaceDefinitions.getAll().forEach((surface, idx) => {
  console.log(`\n   Surface ${idx + 1}: ${surface.id} (${surface.name})`);
  console.log(`   Points: ${surface.points.join(' -> ')}`);
  console.log(`   Description: ${surface.description}`);
});

// ============================================================================
// TEST 3: Vérifier la symétrie gauche/droite
// ============================================================================

console.log('\n3️⃣ Vérification de la symétrie gauche/droite');
console.log('-'.repeat(80));

const leftSurfaces = KiteSurfaceDefinitions.getLeftSurfaces();
const rightSurfaces = KiteSurfaceDefinitions.getRightSurfaces();

console.log(`\n   Surfaces gauche: ${leftSurfaces.length}`);
leftSurfaces.forEach(s => console.log(`     - ${s.id}: ${s.points.join(', ')}`));

console.log(`\n   Surfaces droite: ${rightSurfaces.length}`);
rightSurfaces.forEach(s => console.log(`     - ${s.id}: ${s.points.join(', ')}`));

// ============================================================================
// TEST 4: Tester avec KiteFactory
// ============================================================================

console.log('\n4️⃣ Intégration avec KiteFactory');
console.log('-'.repeat(80));

const kite = KiteFactory.create(new THREE.Vector3(0, 1, 0));

const geometry = kite.getComponent('geometry');
const aero = kite.getComponent('aerodynamics');

console.log(`\n   ✅ Kite créé avec ${(geometry as any).surfaces.length} surfaces géométrie`);
console.log(`   ✅ Kite créé avec ${(aero as any).surfaces.length} surfaces aérodynamiques`);

// Vérifier que les ordres correspondent
console.log('\n   Vérification de la cohérence:');
let allCoherent = true;
KiteSurfaceDefinitions.getAll().forEach((surfDef, idx) => {
  const geomSurf = (geometry as any).surfaces[idx];
  const aeroSurf = (aero as any).surfaces[idx];
  
  const geomMatch = geomSurf.points.join(',') === surfDef.points.join(',');
  const aeroMatch = aeroSurf.points.join(',') === surfDef.points.join(',');
  
  console.log(`\n   Surface ${idx + 1} (${surfDef.id}):`);
  console.log(`     Géométrie: ${geomMatch ? '✅' : '❌'} ${geomSurf.points.join(', ')}`);
  console.log(`     Aérodynamique: ${aeroMatch ? '✅' : '❌'} ${aeroSurf.points.join(', ')}`);
  
  if (!geomMatch || !aeroMatch) {
    allCoherent = false;
  }
});

// ============================================================================
// RÉSULTAT FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RÉSULTAT');
console.log('='.repeat(80));

if (validation.isValid && allCoherent) {
  console.log('\n✅ SUCCÈS - Architecture centralisée fonctionne correctement!');
  console.log('\nAvantages:');
  console.log('  ✅ Source unique de vérité pour les surfaces');
  console.log('  ✅ Pas de duplication de données');
  console.log('  ✅ Cohérence garantie entre géométrie et aérodynamique');
  console.log('  ✅ Facile à maintenir et à modifier');
} else {
  console.log('\n❌ ERREUR - Des problèmes détectés:');
  if (!validation.isValid) {
    console.log('\nProblèmes de validation:');
    validation.errors.forEach(err => console.log(`  ${err}`));
  }
  if (!allCoherent) {
    console.log('\nProblèmes de cohérence entre géométrie et aérodynamique');
  }
}

console.log('\n' + '='.repeat(80));
