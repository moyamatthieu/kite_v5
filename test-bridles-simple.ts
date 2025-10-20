/**
 * test-bridles-simple.ts
 * 
 * Script simple pour vérifier les bridles sans dépendre de SimulationApp
 */

import * as THREE from 'three';
import { KiteFactory } from './src/ecs/entities/KiteFactory';
import { CONFIG } from './src/ecs/config/Config';
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
  console.log('🚀 Starting bridles analysis...\n');

  try {
    // Créer le kite avec une position initiale
    const initialPosition = new THREE.Vector3(0, 10, -15);
    const kite = KiteFactory.create(initialPosition);

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');
    const transform = kite.getComponent('transform');

    if (!geometry || !bridle || !transform) {
      console.error('❌ Missing components');
      process.exit(1);
    }

    console.log('📏 === ANALYSE DES BRIDLES ===\n');

    // Points clés du kite (locaux)
    const nez = geometry.getPoint('NEZ');
    const interGauche = geometry.getPoint('INTER_GAUCHE');
    const interDroit = geometry.getPoint('INTER_DROIT');
    const centre = geometry.getPoint('CENTRE');
    const ctrlGauche = geometry.getPoint('CTRL_GAUCHE');
    const ctrlDroit = geometry.getPoint('CTRL_DROIT');

    if (!nez || !interGauche || !interDroit || !centre || !ctrlGauche || !ctrlDroit) {
      console.error('❌ Missing kite points');
      process.exit(1);
    }

    console.log('🎯 Points du kite (locaux):');
    console.log(`  NEZ: [${nez.x.toFixed(3)}, ${nez.y.toFixed(3)}, ${nez.z.toFixed(3)}]`);
    console.log(`  INTER_GAUCHE: [${interGauche.x.toFixed(3)}, ${interGauche.y.toFixed(3)}, ${interGauche.z.toFixed(3)}]`);
    console.log(`  INTER_DROIT: [${interDroit.x.toFixed(3)}, ${interDroit.y.toFixed(3)}, ${interDroit.z.toFixed(3)}]`);
    console.log(`  CENTRE: [${centre.x.toFixed(3)}, ${centre.y.toFixed(3)}, ${centre.z.toFixed(3)}]`);
    console.log(`  CTRL_GAUCHE: [${ctrlGauche.x.toFixed(3)}, ${ctrlGauche.y.toFixed(3)}, ${ctrlGauche.z.toFixed(3)}]`);
    console.log(`  CTRL_DROIT: [${ctrlDroit.x.toFixed(3)}, ${ctrlDroit.y.toFixed(3)}, ${ctrlDroit.z.toFixed(3)}]`);

    // Calculer les distances actuelles pour chaque bride
    const bridles = [
      { name: 'Gauche-Nez', from: ctrlGauche, to: nez, configured: bridle.lengths.nez },
      { name: 'Gauche-Inter', from: ctrlGauche, to: interGauche, configured: bridle.lengths.inter },
      { name: 'Gauche-Centre', from: ctrlGauche, to: centre, configured: bridle.lengths.centre },
      { name: 'Droit-Nez', from: ctrlDroit, to: nez, configured: bridle.lengths.nez },
      { name: 'Droit-Inter', from: ctrlDroit, to: interDroit, configured: bridle.lengths.inter },
      { name: 'Droit-Centre', from: ctrlDroit, to: centre, configured: bridle.lengths.centre }
    ];

    console.log('\n📊 Longueurs des bridles (coordonnées locales):');
    const errors: number[] = [];
    bridles.forEach((b) => {
      const actual = distance(b.from, b.to);
      const error = actual - b.configured;
      const errorPercent = (error / b.configured) * 100;
      errors.push(error);

      console.log(
        `  ${b.name.padEnd(16)} | Config: ${fmt(b.configured)}m | Actual: ${fmt(actual)}m | Error: ${error > 0 ? '+' : ''}${fmt(error)}m (${errorPercent.toFixed(2)}%)`
      );
    });

    // Statistiques d'erreur
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxError = Math.max(...errors.map(Math.abs));
    const minError = Math.min(...errors.map(Math.abs));

    console.log(`\n📈 Statistiques d'erreur:`);
    console.log(`  Moyenne: ${fmt(avgError)}m`);
    console.log(`  Max: ${fmt(maxError)}m`);
    console.log(`  Min: ${fmt(minError)}m`);

    // Configuration des bridles
    console.log('\n⚙️  Configuration des bridles (UI):');
    console.log(`  Nez: ${fmt(bridle.lengths.nez)}m`);
    console.log(`  Inter: ${fmt(bridle.lengths.inter)}m`);
    console.log(`  Centre: ${fmt(bridle.lengths.centre)}m`);

    // Vérifier si les bridles sont cohérentes avec la config
    console.log('\n🔍 Analyse des lignes (longueurs):');
    console.log(`  Longueur config: ${fmt(CONFIG.lines.length)}m`);

    console.log('\n✅ Analyse complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
