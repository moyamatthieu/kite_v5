/**
 * debug-transformation.ts - Tester la transformation des normales avec l'orientation du kite
 * 
 * Teste si l'orientation du kite inverse les normales des faces gauches.
 */

import * as THREE from 'three';
import { KiteGeometry } from './src/ecs/config/KiteGeometry';
import { MathUtils } from './src/ecs/utils/MathUtils';
import { CONFIG } from './src/ecs/config/Config';

// ============================================================================
// UTILITAIRES DE CALCUL
// ============================================================================

function computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

// ============================================================================
// DÉFINITIONS DES SURFACES
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
  console.log('DEBUG: Transformation des normales avec orientation du kite');
  console.log('='.repeat(80));

  const points = KiteGeometry.getDeltaPoints();

  // Orientation par défaut du kite (depuis CONFIG)
  const orientation = MathUtils.quaternionFromEuler(
    CONFIG.initialization.kiteOrientation.pitch,
    CONFIG.initialization.kiteOrientation.yaw,
    CONFIG.initialization.kiteOrientation.roll
  );

  console.log('\n🎯 Orientation du kite (de CONFIG):');
  const euler = new THREE.Euler().setFromQuaternion(orientation, 'XYZ');
  console.log(`  Pitch: ${(euler.x * 180/Math.PI).toFixed(1)}°`);
  console.log(`  Yaw: ${(euler.y * 180/Math.PI).toFixed(1)}°`);
  console.log(`  Roll: ${(euler.z * 180/Math.PI).toFixed(1)}°`);
  console.log(`  Quaternion: (${orientation.x.toFixed(4)}, ${orientation.y.toFixed(4)}, ${orientation.z.toFixed(4)}, ${orientation.w.toFixed(4)})`);

  console.log('\n' + '='.repeat(80));
  console.log('TRANSFORMATION DES NORMALES');
  console.log('='.repeat(80));

  surfaces.forEach((surface, index) => {
    console.log(`\n${index + 1}. ${surface.name}`);

    // Récupérer les points locaux
    const p1Local = points.get(surface.points[0]);
    const p2Local = points.get(surface.points[1]);
    const p3Local = points.get(surface.points[2]);

    if (!p1Local || !p2Local || !p3Local) {
      console.log('   ❌ ERREUR: Un ou plusieurs points manquants');
      return;
    }

    // Calculer la normale locale
    const normalLocal = computeTriangleNormal(p1Local, p2Local, p3Local);
    console.log(`   Normale locale: (${normalLocal.x.toFixed(4)}, ${normalLocal.y.toFixed(4)}, ${normalLocal.z.toFixed(4)})`);

    // Transformer les points en coordonnées monde
    const p1World = p1Local.clone().applyQuaternion(orientation);
    const p2World = p2Local.clone().applyQuaternion(orientation);
    const p3World = p3Local.clone().applyQuaternion(orientation);

    // Calculer la normale monde (depuis les points transformés)
    const normalWorldFromPoints = computeTriangleNormal(p1World, p2World, p3World);
    console.log(`   Normale monde (depuis points transformés): (${normalWorldFromPoints.x.toFixed(4)}, ${normalWorldFromPoints.y.toFixed(4)}, ${normalWorldFromPoints.z.toFixed(4)})`);

    // Transformer la normale directement
    const normalWorldDirect = normalLocal.clone().applyQuaternion(orientation);
    console.log(`   Normale monde (transformée directement): (${normalWorldDirect.x.toFixed(4)}, ${normalWorldDirect.y.toFixed(4)}, ${normalWorldDirect.z.toFixed(4)})`);

    // Vérifier si les deux méthodes donnent le même résultat
    const diff = normalWorldFromPoints.clone().sub(normalWorldDirect).length();
    console.log(`   Différence entre les deux méthodes: ${diff.toFixed(6)}`);

    // Analyser Z
    console.log(`   Z local: ${normalLocal.z > 0 ? '✅ Z+' : '❌ Z-'}`);
    console.log(`   Z monde (from points): ${normalWorldFromPoints.z > 0 ? '✅ Z+' : '❌ Z-'}`);
    console.log(`   Z monde (direct): ${normalWorldDirect.z > 0 ? '✅ Z+' : '❌ Z-'}`);

    // Vérifier si le problème est spécifique aux faces gauches
    if (index < 2) {
      console.log(`   👈 FACE GAUCHE`);
    } else {
      console.log(`   👉 FACE DROITE`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSE DE LA SYMÉTRIE');
  console.log('='.repeat(80));

  // Comparer les normales monde des faces gauche et droite
  console.log('\nFace 1 (leftUpper) vs Face 3 (rightUpper):');
  const p1_1 = points.get(surfaces[0].points[0])!.clone().applyQuaternion(orientation);
  const p1_2 = points.get(surfaces[0].points[1])!.clone().applyQuaternion(orientation);
  const p1_3 = points.get(surfaces[0].points[2])!.clone().applyQuaternion(orientation);
  const n1_world = computeTriangleNormal(p1_1, p1_2, p1_3);

  const p3_1 = points.get(surfaces[2].points[0])!.clone().applyQuaternion(orientation);
  const p3_2 = points.get(surfaces[2].points[1])!.clone().applyQuaternion(orientation);
  const p3_3 = points.get(surfaces[2].points[2])!.clone().applyQuaternion(orientation);
  const n3_world = computeTriangleNormal(p3_1, p3_2, p3_3);

  console.log(`  Face 1 mondiale: (${n1_world.x.toFixed(4)}, ${n1_world.y.toFixed(4)}, ${n1_world.z.toFixed(4)})`);
  console.log(`  Face 3 mondiale: (${n3_world.x.toFixed(4)}, ${n3_world.y.toFixed(4)}, ${n3_world.z.toFixed(4)})`);
  console.log(`  Symétrie X: ${Math.abs(n1_world.x + n3_world.x) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Y: ${Math.abs(n1_world.y - n3_world.y) < 0.0001 ? '✅' : '❌'}`);
  console.log(`  Symétrie Z: ${Math.abs(n1_world.z - n3_world.z) < 0.0001 ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(80));
  console.log('INFORMATIONS SUPPLÉMENTAIRES');
  console.log('='.repeat(80));

  console.log('\nFormule de transformation utilisée: p_world = rotation(p_local) + translation');
  console.log('Normale: normale_monde = rotation(normale_local) (sans translation)');
  console.log('\nLes deux méthodes doivent donner le même résultat:');
  console.log('  1. Calculer depuis les points transformés');
  console.log('  2. Transformer directement la normale');
}

main();
