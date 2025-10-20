/**
 * debug-surfaces.ts - Script de debug pour analyser les surfaces du kite
 * 
 * Teste les normales des surfaces pour identifier le problème d'orientation.
 */

import * as THREE from 'three';
import { KiteGeometry } from './src/ecs/config/KiteGeometry';

// ============================================================================
// UTILITAIRES DE CALCUL
// ============================================================================

function computeTriangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const cross = new THREE.Vector3().crossVectors(ab, ac);
  return 0.5 * cross.length();
}

function computeTriangleCentroid(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  return a.clone().add(b).add(c).multiplyScalar(1 / 3);
}

function computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

// ============================================================================
// DÉFINITIONS DES SURFACES (comme dans KiteFactory)
// ============================================================================

const surfaces = [
  { name: 'Face 1 (leftUpper)', points: ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE'] },
  { name: 'Face 2 (leftLower)', points: ['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE'] },
  { name: 'Face 3 (rightUpper)', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] },
  { name: 'Face 4 (rightLower)', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] },
];

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('DEBUG: Analyse des surfaces du kite');
  console.log('='.repeat(80));

  const points = KiteGeometry.getDeltaPoints();

  console.log('\n📍 Points locaux du kite:');
  Array.from(points.entries()).forEach(([name, point]) => {
    console.log(`  ${name.padEnd(15)} = (${point.x.toFixed(4)}, ${point.y.toFixed(4)}, ${point.z.toFixed(4)})`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSE DES SURFACES');
  console.log('='.repeat(80));

  surfaces.forEach((surface, index) => {
    console.log(`\n${index + 1}. ${surface.name}`);
    console.log(`   Points: ${surface.points.join(' -> ')}`);

    // Récupérer les points
    const p1 = points.get(surface.points[0]);
    const p2 = points.get(surface.points[1]);
    const p3 = points.get(surface.points[2]);

    if (!p1 || !p2 || !p3) {
      console.log('   ❌ ERREUR: Un ou plusieurs points manquants');
      return;
    }

    console.log(`   P1 (${surface.points[0]}): (${p1.x.toFixed(4)}, ${p1.y.toFixed(4)}, ${p1.z.toFixed(4)})`);
    console.log(`   P2 (${surface.points[1]}): (${p2.x.toFixed(4)}, ${p2.y.toFixed(4)}, ${p2.z.toFixed(4)})`);
    console.log(`   P3 (${surface.points[2]}): (${p3.x.toFixed(4)}, ${p3.y.toFixed(4)}, ${p3.z.toFixed(4)})`);

    // Calculer les vecteurs
    const ab = new THREE.Vector3().subVectors(p2, p1);
    const ac = new THREE.Vector3().subVectors(p3, p1);
    console.log(`   (P2-P1): (${ab.x.toFixed(4)}, ${ab.y.toFixed(4)}, ${ab.z.toFixed(4)})`);
    console.log(`   (P3-P1): (${ac.x.toFixed(4)}, ${ac.y.toFixed(4)}, ${ac.z.toFixed(4)})`);

    // Calculer aire
    const area = computeTriangleArea(p1, p2, p3);
    console.log(`   Aire: ${area.toFixed(4)} m²`);

    // Calculer centroïde
    const centroid = computeTriangleCentroid(p1, p2, p3);
    console.log(`   Centroïde: (${centroid.x.toFixed(4)}, ${centroid.y.toFixed(4)}, ${centroid.z.toFixed(4)})`);

    // Calculer normale
    const normal = computeTriangleNormal(p1, p2, p3);
    console.log(`   Normale: (${normal.x.toFixed(4)}, ${normal.y.toFixed(4)}, ${normal.z.toFixed(4)})`);
    
    // Analyser la direction de la normale
    if (normal.z > 0) {
      console.log(`   ⚠️  Z+ (vers l'avant) - PROBLÈME POTENTIEL`);
    } else if (normal.z < 0) {
      console.log(`   ✅ Z- (vers l'arrière) - BON`);
    } else {
      console.log(`   ⚠️  Z = 0 (parallèle au plan XY)`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('COMPARAISON FACES GAUCHE VS DROITE');
  console.log('='.repeat(80));

  // Comparer la symétrie
  console.log('\nFace 1 (leftUpper) vs Face 3 (rightUpper):');
  const n1 = computeTriangleNormal(
    points.get(surfaces[0].points[0])!,
    points.get(surfaces[0].points[1])!,
    points.get(surfaces[0].points[2])!
  );
  const n3 = computeTriangleNormal(
    points.get(surfaces[2].points[0])!,
    points.get(surfaces[2].points[1])!,
    points.get(surfaces[2].points[2])!
  );

  console.log(`  Face 1 normale: (${n1.x.toFixed(4)}, ${n1.y.toFixed(4)}, ${n1.z.toFixed(4)})`);
  console.log(`  Face 3 normale: (${n3.x.toFixed(4)}, ${n3.y.toFixed(4)}, ${n3.z.toFixed(4)})`);
  console.log(`  Symétrie X: ${Math.abs(n1.x + n3.x) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Y: ${Math.abs(n1.y - n3.y) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Z: ${Math.abs(n1.z - n3.z) < 0.0001 ? '✅' : '❌'}`);

  console.log('\nFace 2 (leftLower) vs Face 4 (rightLower):');
  const n2 = computeTriangleNormal(
    points.get(surfaces[1].points[0])!,
    points.get(surfaces[1].points[1])!,
    points.get(surfaces[1].points[2])!
  );
  const n4 = computeTriangleNormal(
    points.get(surfaces[3].points[0])!,
    points.get(surfaces[3].points[1])!,
    points.get(surfaces[3].points[2])!
  );

  console.log(`  Face 2 normale: (${n2.x.toFixed(4)}, ${n2.y.toFixed(4)}, ${n2.z.toFixed(4)})`);
  console.log(`  Face 4 normale: (${n4.x.toFixed(4)}, ${n4.y.toFixed(4)}, ${n4.z.toFixed(4)})`);
  console.log(`  Symétrie X: ${Math.abs(n2.x + n4.x) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Y: ${Math.abs(n2.y - n4.y) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Z: ${Math.abs(n2.z - n4.z) < 0.0001 ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(80));
  console.log('SUGGESTION DE CORRECTIONS');
  console.log('='.repeat(80));

  console.log('\nPour que tous les Z pointent vers l\'arrière (Z-):');
  console.log('\nOrder actuel vs corrections:');
  
  surfaces.forEach((surface, index) => {
    const p1 = points.get(surface.points[0])!;
    const p2 = points.get(surface.points[1])!;
    const p3 = points.get(surface.points[2])!;
    const normal = computeTriangleNormal(p1, p2, p3);

    if (normal.z > 0) {
      console.log(`Face ${index + 1} (${surface.name}): INVERSER L'ORDRE`);
      console.log(`  Actuel:  ['${surface.points[0]}', '${surface.points[1]}', '${surface.points[2]}']`);
      console.log(`  Correct: ['${surface.points[0]}', '${surface.points[2]}', '${surface.points[1]}']`);
    }
  });
}

main();
