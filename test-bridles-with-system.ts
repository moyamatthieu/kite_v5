/**
 * test-bridles-with-system.ts
 * 
 * Test qui exécute réellement BridleConstraintSystem pour recalculer les positions CTRL
 */

import * as THREE from 'three';
import { KiteFactory } from './src/ecs/entities/KiteFactory';
import { BridleConstraintSystem } from './src/ecs/systems/BridleConstraintSystem';
import { GeometryComponent } from './src/ecs/components/GeometryComponent';
import { BridleComponent } from './src/ecs/components/BridleComponent';

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
  console.log('🚀 Testing bridles with BridleConstraintSystem...\n');

  try {
    // === SETUP ===
    const initialPosition = new THREE.Vector3(0, 10, -15);
    const kite = KiteFactory.create(initialPosition);

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');

    if (!geometry || !bridle) {
      throw new Error('Missing components');
    }

    console.log('📏 === AVANT trilatération ===\n');

    // Points anatomiques
    const nez = geometry.getPoint('NEZ');
    const interGauche = geometry.getPoint('INTER_GAUCHE');
    const interDroit = geometry.getPoint('INTER_DROIT');
    const centre = geometry.getPoint('CENTRE');
    let ctrlGauche = geometry.getPoint('CTRL_GAUCHE');
    let ctrlDroit = geometry.getPoint('CTRL_DROIT');

    if (!nez || !interGauche || !interDroit || !centre || !ctrlGauche || !ctrlDroit) {
      throw new Error('Missing points');
    }

    console.log('Configuration des bridles:');
    console.log(`  Nez: ${fmt(bridle.lengths.nez)}m`);
    console.log(`  Inter: ${fmt(bridle.lengths.inter)}m`);
    console.log(`  Centre: ${fmt(bridle.lengths.centre)}m\n`);

    console.log('Positions CTRL avant:');
    console.log(`  CTRL_GAUCHE: [${ctrlGauche.x.toFixed(3)}, ${ctrlGauche.y.toFixed(3)}, ${ctrlGauche.z.toFixed(3)}]`);
    console.log(`  CTRL_DROIT: [${ctrlDroit.x.toFixed(3)}, ${ctrlDroit.y.toFixed(3)}, ${ctrlDroit.z.toFixed(3)}]\n`);

    const bridles_before = [
      { name: 'Gauche-Nez', from: ctrlGauche, to: nez },
      { name: 'Gauche-Inter', from: ctrlGauche, to: interGauche },
      { name: 'Gauche-Centre', from: ctrlGauche, to: centre }
    ];

    console.log('Longueurs des bridles AVANT:');
    bridles_before.forEach(b => {
      const dist = distance(b.from, b.to);
      console.log(`  ${b.name.padEnd(16)} : ${fmt(dist)}m`);
    });

    // === EXÉCUTER LA TRILATÉRATION ===
    console.log('\n🔄 === EXÉCUTION de BridleConstraintSystem ===\n');

    const system = new BridleConstraintSystem();
    // Créer un context minimal
    const entityManager = {
      getEntity: (id: string) => id === 'kite' ? kite : null
    } as any;

    system.update({ entityManager, deltaTime: 0.016, totalTime: 0 });

    // === VÉRIFIER APRÈS ===
    console.log('\n📏 === APRÈS trilatération ===\n');

    ctrlGauche = geometry.getPoint('CTRL_GAUCHE')!;
    ctrlDroit = geometry.getPoint('CTRL_DROIT')!;

    console.log('Positions CTRL après:');
    console.log(`  CTRL_GAUCHE: [${ctrlGauche.x.toFixed(3)}, ${ctrlGauche.y.toFixed(3)}, ${ctrlGauche.z.toFixed(3)}]`);
    console.log(`  CTRL_DROIT: [${ctrlDroit.x.toFixed(3)}, ${ctrlDroit.y.toFixed(3)}, ${ctrlDroit.z.toFixed(3)}]\n`);

    const bridles_after = [
      { name: 'Gauche-Nez', from: ctrlGauche, to: nez, configured: bridle.lengths.nez },
      { name: 'Gauche-Inter', from: ctrlGauche, to: interGauche, configured: bridle.lengths.inter },
      { name: 'Gauche-Centre', from: ctrlGauche, to: centre, configured: bridle.lengths.centre },
      { name: 'Droit-Nez', from: ctrlDroit, to: nez, configured: bridle.lengths.nez },
      { name: 'Droit-Inter', from: ctrlDroit, to: interDroit, configured: bridle.lengths.inter },
      { name: 'Droit-Centre', from: ctrlDroit, to: centre, configured: bridle.lengths.centre }
    ];

    console.log('Longueurs des bridles APRÈS:');
    const errors: number[] = [];
    bridles_after.forEach(b => {
      const dist = distance(b.from, b.to);
      const error = dist - b.configured;
      const errorPercent = (error / b.configured) * 100;
      errors.push(error);
      
      const status = Math.abs(error) < 0.001 ? '✅' : '⚠️ ';
      console.log(`  ${status} ${b.name.padEnd(16)} : ${fmt(dist)}m (error: ${error > 0 ? '+' : ''}${fmt(error)}m, ${errorPercent.toFixed(2)}%)`);
    });

    // Statistiques
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxError = Math.max(...errors.map(Math.abs));
    const minError = Math.min(...errors.map(Math.abs));

    console.log(`\n📊 Résultats:`);
    console.log(`  Erreur moyenne: ${fmt(avgError)}m`);
    console.log(`  Erreur max: ${fmt(maxError)}m`);
    console.log(`  Erreur min: ${fmt(minError)}m`);

    if (maxError < 0.01) {
      console.log('\n✅ SUCCÈS: Les positions CTRL sont correctement calculées!');
    } else {
      console.log('\n⚠️  ATTENTION: Des erreurs subsistent');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
