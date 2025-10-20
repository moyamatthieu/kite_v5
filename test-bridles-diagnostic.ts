/**
 * test-bridles-diagnostic.ts
 * 
 * Script de diagnostic pour analyser:
 * 1. L'écart de +0.18m dans les longueurs de lignes
 * 2. La validité du rendu des bridles
 * 3. La convergence de l'algorithme de trilatération
 */

import * as THREE from 'three';
import { EntityManager } from './src/ecs/core/EntityManager';
import { SystemManager } from './src/ecs/core/SystemManager';
import { TransformComponent } from './src/ecs/components/TransformComponent';
import { GeometryComponent } from './src/ecs/components/GeometryComponent';
import { BridleComponent } from './src/ecs/components/BridleComponent';
import { LineComponent } from './src/ecs/components/LineComponent';

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
 * Valide que les bridles ont les bonnes longueurs
 */
function validateBridleLengths(entityManager: EntityManager): void {
  console.log('\n📏 === VALIDATION DES LONGUEURS DE BRIDLES ===\n');

  const kite = entityManager.getEntity('kite');
  const kite = entityManager.getEntity('kite');

  if (!kite) {
    console.error('❌ Kite entity not found');
    return;
  }

  const geometry = kite.getComponent<GeometryComponent>('geometry');
  const bridle = kite.getComponent<BridleComponent>('bridle');
  const transform = kite.getComponent<TransformComponent>('transform');

  if (!geometry || !bridle || !transform) {
    console.error('❌ Missing components');
    return;
  }

  // Matrice de transformation LOCAL → MONDE
  const transformMatrix = new THREE.Matrix4();
  transformMatrix.compose(transform.position, transform.quaternion, transform.scale);

  // Points clés du kite (locaux)
  const nez = geometry.getPoint('NEZ');
  const interGauche = geometry.getPoint('INTER_GAUCHE');
  const interDroit = geometry.getPoint('INTER_DROIT');
  const centre = geometry.getPoint('CENTRE');
  const ctrlGauche = geometry.getPoint('CTRL_GAUCHE');
  const ctrlDroit = geometry.getPoint('CTRL_DROIT');

  if (!nez || !interGauche || !interDroit || !centre || !ctrlGauche || !ctrlDroit) {
    console.error('❌ Missing kite points');
    return;
  }

  // Convertir en coordonnées monde
  const nez_w = nez.clone().applyMatrix4(transformMatrix);
  const ig_w = interGauche.clone().applyMatrix4(transformMatrix);
  const id_w = interDroit.clone().applyMatrix4(transformMatrix);
  const centre_w = centre.clone().applyMatrix4(transformMatrix);
  const cg_w = ctrlGauche.clone().applyMatrix4(transformMatrix);
  const cd_w = ctrlDroit.clone().applyMatrix4(transformMatrix);

  console.log('🎯 Points du kite (monde):');
  console.log(`  NEZ: ${nez_w.toArray().map(v => v.toFixed(3)).join(', ')}`);
  console.log(`  INTER_GAUCHE: ${ig_w.toArray().map(v => v.toFixed(3)).join(', ')}`);
  console.log(`  INTER_DROIT: ${id_w.toArray().map(v => v.toFixed(3)).join(', ')}`);
  console.log(`  CENTRE: ${centre_w.toArray().map(v => v.toFixed(3)).join(', ')}`);
  console.log(`  CTRL_GAUCHE: ${cg_w.toArray().map(v => v.toFixed(3)).join(', ')}`);
  console.log(`  CTRL_DROIT: ${cd_w.toArray().map(v => v.toFixed(3)).join(', ')}`);

  // Calculer les distances actuelles pour chaque bride
  const bridles = [
    { name: 'Gauche-Nez', from: cg_w, to: nez_w, configured: bridle.lengths.nez },
    { name: 'Gauche-Inter', from: cg_w, to: ig_w, configured: bridle.lengths.inter },
    { name: 'Gauche-Centre', from: cg_w, to: centre_w, configured: bridle.lengths.centre },
    { name: 'Droit-Nez', from: cd_w, to: nez_w, configured: bridle.lengths.nez },
    { name: 'Droit-Inter', from: cd_w, to: id_w, configured: bridle.lengths.inter },
    { name: 'Droit-Centre', from: cd_w, to: centre_w, configured: bridle.lengths.centre }
  ];

  console.log('\n📊 Longueurs des bridles:');
  const errors: number[] = [];
  bridles.forEach(b => {
    const actual = distance(b.from, b.to);
    const error = actual - b.configured;
    const errorPercent = (error / b.configured) * 100;
    errors.push(error);

    console.log(
      `  ${b.name.padEnd(16)} | Config: ${b.configured.toFixed(4)}m | Actual: ${actual.toFixed(4)}m | Error: ${error > 0 ? '+' : ''}${error.toFixed(4)}m (${errorPercent.toFixed(2)}%)`
    );
  });

  // Statistiques d'erreur
  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const maxError = Math.max(...errors.map(Math.abs));
  const minError = Math.min(...errors.map(Math.abs));

  console.log(`\n📈 Statistiques d'erreur:`);
  console.log(`  Moyenne: ${avgError.toFixed(4)}m`);
  console.log(`  Max: ${maxError.toFixed(4)}m`);
  console.log(`  Min: ${minError.toFixed(4)}m`);
}

/**
 * Valide les longueurs de lignes
 */
function validateLineLengths(app: SimulationApp): void {
  console.log('\n🔗 === VALIDATION DES LONGUEURS DE LIGNES ===\n');

  const { entityManager } = app.context;
  const kite = entityManager.getEntity('kite');
  const controlBar = entityManager.getEntity('controlBar');
  const leftLine = entityManager.getEntity('leftLine');
  const rightLine = entityManager.getEntity('rightLine');

  if (!kite || !controlBar || !leftLine || !rightLine) {
    console.error('❌ Missing entities');
    return;
  }

  const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');
  const kiteTransform = kite.getComponent<TransformComponent>('transform');
  const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
  const barTransform = controlBar.getComponent<TransformComponent>('transform');
  const leftLineComp = leftLine.getComponent<LineComponent>('line');
  const rightLineComp = rightLine.getComponent<LineComponent>('line');
  const leftLineGeom = leftLine.getComponent<GeometryComponent>('geometry');
  const rightLineGeom = rightLine.getComponent<GeometryComponent>('geometry');

  if (!kiteGeometry || !barGeometry || !leftLineComp || !rightLineComp) {
    console.error('❌ Missing components');
    return;
  }

  // Matrice de transformation
  const kiteMatrix = new THREE.Matrix4();
  kiteMatrix.compose(kiteTransform.position, kiteTransform.quaternion, kiteTransform.scale);

  const barMatrix = new THREE.Matrix4();
  barMatrix.compose(barTransform.position, barTransform.quaternion, barTransform.scale);

  // Positions
  const leftHandle = barGeometry.getPoint('leftHandle')?.clone().applyMatrix4(barMatrix);
  const rightHandle = barGeometry.getPoint('rightHandle')?.clone().applyMatrix4(barMatrix);
  const ctrlGauche = kiteGeometry.getPoint('CTRL_GAUCHE')?.clone().applyMatrix4(kiteMatrix);
  const ctrlDroit = kiteGeometry.getPoint('CTRL_DROIT')?.clone().applyMatrix4(kiteMatrix);

  if (!leftHandle || !rightHandle || !ctrlGauche || !ctrlDroit) {
    console.error('❌ Missing positions');
    return;
  }

  const leftLineDist = distance(leftHandle, ctrlGauche);
  const rightLineDist = distance(rightHandle, ctrlDroit);

  console.log(`Ligne gauche:`);
  console.log(`  Config: ${leftLineComp.length.toFixed(4)}m`);
  console.log(`  Actual: ${leftLineDist.toFixed(4)}m`);
  console.log(`  Error: ${(leftLineDist - leftLineComp.length).toFixed(4)}m`);

  console.log(`\nLigne droite:`);
  console.log(`  Config: ${rightLineComp.length.toFixed(4)}m`);
  console.log(`  Actual: ${rightLineDist.toFixed(4)}m`);
  console.log(`  Error: ${(rightLineDist - rightLineComp.length).toFixed(4)}m`);
}

/**
 * Vérifie la géométrie des bridles en rendu
 */
function validateBridleGeometry(app: SimulationApp): void {
  console.log('\n🎨 === VALIDATION DE LA GÉOMÉTRIE DES BRIDLES ===\n');

  const { entityManager } = app.context;

  const bridleIds = [
    'bridle-ctrl-gauche-nez',
    'bridle-ctrl-gauche-inter',
    'bridle-ctrl-gauche-centre',
    'bridle-ctrl-droit-nez',
    'bridle-ctrl-droit-inter',
    'bridle-ctrl-droit-centre'
  ];

  console.log('Vérifiant les bridles:');
  bridleIds.forEach(id => {
    const bridle = entityManager.getEntity(id);
    if (!bridle) {
      console.log(`  ❌ ${id}: NOT FOUND`);
      return;
    }

    const geometry = bridle.getComponent<GeometryComponent>('geometry');
    if (!geometry) {
      console.log(`  ⚠️  ${id}: No GeometryComponent`);
      return;
    }

    const start = geometry.getPoint('start');
    const end = geometry.getPoint('end');

    if (!start || !end) {
      console.log(`  ⚠️  ${id}: Missing points`);
      return;
    }

    const dist = distance(start, end);
    console.log(`  ✅ ${id}: ${dist.toFixed(4)}m`);
  });
}

/**
 * Affiche les positions des points de contrôle
 */
function debugControlPoints(app: SimulationApp): void {
  console.log('\n🎯 === POSITIONS DES POINTS DE CONTRÔLE ===\n');

  const { entityManager } = app.context;
  const kite = entityManager.getEntity('kite');

  if (!kite) return;

  const geometry = kite.getComponent<GeometryComponent>('geometry');
  const transform = kite.getComponent<TransformComponent>('transform');

  if (!geometry || !transform) return;

  const transformMatrix = new THREE.Matrix4();
  transformMatrix.compose(transform.position, transform.quaternion, transform.scale);

  console.log('Position du kite: ', transform.position.toArray().map(v => v.toFixed(3)).join(', '));
  console.log(
    'Quaternion du kite:',
    transform.quaternion.toArray().map(v => v.toFixed(3)).join(', ')
  );

  const pointNames = ['NEZ', 'INTER_GAUCHE', 'INTER_DROIT', 'CENTRE', 'CTRL_GAUCHE', 'CTRL_DROIT'];
  pointNames.forEach(name => {
    const local = geometry.getPoint(name);
    if (local) {
      const world = local.clone().applyMatrix4(transformMatrix);
      console.log(`  ${name.padEnd(16)}: L${local.toArray().map(v => v.toFixed(3)).join(', ')} → W${world.toArray().map(v => v.toFixed(3)).join(', ')}`);
    }
  });
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Starting bridles diagnostic...\n');

  try {
    // Créer la simulation
    const app = new SimulationApp();
    await app.initialize();

    // Laisser tourner quelques frames pour la stabilisation
    for (let i = 0; i < 5; i++) {
      app.update(0.016); // 16ms = 60fps
    }

    // Exécuter les diagnostics
    validateBridleLengths(app);
    validateLineLengths(app);
    validateBridleGeometry(app);
    debugControlPoints(app);

    console.log('\n✅ Diagnostic complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
