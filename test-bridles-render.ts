/**
 * test-bridles-render.ts
 * 
 * Test du rendu dynamique des bridles via BridleRenderSystem
 * Vérifie que les bridles s'affichent correctement quand les longueurs changent
 */

import * as THREE from 'three';
import { EntityManager } from './src/ecs/core/EntityManager';
import { KiteFactory } from './src/ecs/entities/KiteFactory';
import { BridleFactory } from './src/ecs/entities/BridleFactory';
import { ControlBarFactory } from './src/ecs/entities/ControlBarFactory';
import { BridleRenderSystem } from './src/ecs/systems/BridleRenderSystem';
import { BridleConstraintSystem } from './src/ecs/systems/BridleConstraintSystem';
import { GeometryComponent } from './src/ecs/components/GeometryComponent';
import { BridleComponent } from './src/ecs/components/BridleComponent';
import { TransformComponent } from './src/ecs/components/TransformComponent';
import type { SimulationContext } from './src/ecs/core/System';

/**
 * Calcule la distance entre deux points
 */
function distance(p1: THREE.Vector3, p2: THREE.Vector3): number {
  return p1.distanceTo(p2);
}

/**
 * Formate un nombre à 4 décimales
 */
function fmt(v: number): string {
  return v.toFixed(4);
}

/**
 * Main
 */
async function main() {
  console.log('🎨 Starting bridles render test...\n');

  try {
    // === SETUP ===
    const entityManager = new EntityManager();

    // Créer les entités
    const initialPosition = new THREE.Vector3(0, 10, -15);
    const kite = KiteFactory.create(initialPosition);
    const bridles = BridleFactory.createAll();
    const controlBar = ControlBarFactory.create();

    // Ajouter à l'entity manager
    entityManager.addEntity(kite);
    entityManager.addEntity(controlBar);
    bridles.forEach(b => entityManager.addEntity(b));

    console.log('✅ Entités créées:');
    console.log(`  - Kite`);
    console.log(`  - ${bridles.length} bridles`);
    console.log(`  - ControlBar\n`);

    // === TEST 1 : État initial ===
    console.log('📊 === TEST 1 : État initial ===\n');

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');
    const transform = kite.getComponent<TransformComponent>('transform');

    if (!geometry || !bridle || !transform) {
      throw new Error('Missing components');
    }

    console.log(`Configuration initiale des bridles:`);
    console.log(`  Nez: ${fmt(bridle.lengths.nez)}m`);
    console.log(`  Inter: ${fmt(bridle.lengths.inter)}m`);
    console.log(`  Centre: ${fmt(bridle.lengths.centre)}m\n`);

    // === TEST 2 : Exécuter BridleRenderSystem ===
    console.log('🔄 === TEST 2 : Exécution BridleRenderSystem ===\n');

    const renderSystem = new BridleRenderSystem();
    const context: SimulationContext = {
      entityManager,
      deltaTime: 0.016
    };

    renderSystem.update(context);

    console.log('✅ BridleRenderSystem exécuté\n');

    // === TEST 3 : Vérifier les géométries des bridles ===
    console.log('📋 === TEST 3 : Vérification des géométries ===\n');

    const bridleIds = [
      'bridle-ctrl-gauche-nez',
      'bridle-ctrl-gauche-inter',
      'bridle-ctrl-gauche-centre',
      'bridle-ctrl-droit-nez',
      'bridle-ctrl-droit-inter',
      'bridle-ctrl-droit-centre'
    ];

    bridleIds.forEach(id => {
      const bridleEntity = entityManager.getEntity(id);
      if (!bridleEntity) {
        console.log(`  ❌ ${id}: NOT FOUND`);
        return;
      }

      const bridleGeom = bridleEntity.getComponent<GeometryComponent>('geometry');
      if (!bridleGeom) {
        console.log(`  ⚠️  ${id}: No geometry`);
        return;
      }

      const start = bridleGeom.getPoint('start');
      const end = bridleGeom.getPoint('end');

      if (!start || !end) {
        console.log(`  ⚠️  ${id}: No points`);
        return;
      }

      const dist = distance(start, end);
      const isValid = dist > 0.01; // Au moins 1cm

      console.log(`  ${isValid ? '✅' : '❌'} ${id.padEnd(25)} : ${fmt(dist)}m`);
    });

    // === TEST 4 : Changer les longueurs et vérifier la mise à jour ===
    console.log('\n🔧 === TEST 4 : Changement des longueurs et mise à jour ===\n');

    const newLengths = {
      nez: 0.75,
      inter: 0.70,
      centre: 0.60
    };

    console.log(`Modification des longueurs:`);
    console.log(`  Nez: ${fmt(bridle.lengths.nez)}m → ${fmt(newLengths.nez)}m`);
    console.log(`  Inter: ${fmt(bridle.lengths.inter)}m → ${fmt(newLengths.inter)}m`);
    console.log(`  Centre: ${fmt(bridle.lengths.centre)}m → ${fmt(newLengths.centre)}m\n`);

    // Mettre à jour les longueurs
    bridle.lengths = newLengths;

    // Exécuter BridleConstraintSystem pour recalculer les positions CTRL
    const constraintSystem = new BridleConstraintSystem();
    constraintSystem.update(context);

    // Exécuter BridleRenderSystem pour mettre à jour les affichages
    renderSystem.update(context);

    console.log('✅ Systèmes exécutés pour mise à jour\n');

    // === TEST 5 : Vérifier les nouvelles géométries ===
    console.log('📋 === TEST 5 : Vérification après changement ===\n');

    bridleIds.forEach(id => {
      const bridleEntity = entityManager.getEntity(id);
      if (!bridleEntity) return;

      const bridleGeom = bridleEntity.getComponent<GeometryComponent>('geometry');
      if (!bridleGeom) return;

      const start = bridleGeom.getPoint('start');
      const end = bridleGeom.getPoint('end');

      if (!start || !end) return;

      const dist = distance(start, end);
      console.log(`  ${id.padEnd(25)} : ${fmt(dist)}m`);
    });

    console.log('\n✅ Test complet!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
