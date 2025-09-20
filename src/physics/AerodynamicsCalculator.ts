/**
 * AerodynamicsCalculator.ts - Calcul des forces aérodynamiques
 *
 * Responsabilité : Calculer les forces et couples aérodynamiques sur le cerf-volant
 */

import * as THREE from 'three';
import { KiteGeometry } from '../geometry/KiteGeometry';
import { PhysicsConstants } from './PhysicsConstants';
import { PHYSICS_CONFIG } from '../config/PhysicsConfig';

export class AerodynamicsCalculator {
  /**
   * Calcule comment le vent pousse sur le cerf-volant
   *
   * COMMENT ÇA MARCHE :
   * 1. On regarde chaque triangle du cerf-volant
   * 2. On calcule sous quel angle le vent frappe ce triangle
   * 3. Plus le vent frappe de face, plus la force est grande
   * 4. On additionne toutes les forces pour avoir la force totale
   *
   * POURQUOI C'EST IMPORTANT :
   * Si un côté du kite reçoit plus de vent, il sera poussé plus fort
   * Cette différence fait tourner le kite naturellement !
   */
  static calculateForces(
    apparentWind: THREE.Vector3,
    kiteOrientation: THREE.Quaternion
  ): {
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    torque: THREE.Vector3;
    leftForce?: THREE.Vector3;
    rightForce?: THREE.Vector3;
  } {
    const windSpeed = apparentWind.length();
    if (windSpeed < 0.1) {
      return {
        lift: new THREE.Vector3(),
        drag: new THREE.Vector3(),
        torque: new THREE.Vector3(),
      };
    }

    const windDir = apparentWind.clone().normalize();
    const dynamicPressure =
      0.5 * PHYSICS_CONFIG.physics.airDensity * windSpeed * windSpeed;

    // Forces séparées pour gauche et droite
    let leftForce = new THREE.Vector3();
    let rightForce = new THREE.Vector3();
    let totalForce = new THREE.Vector3();
    let totalTorque = new THREE.Vector3();

    // On examine chaque triangle du cerf-volant un par un
    // C'est comme vérifier comment le vent frappe chaque panneau d'un parasol
    KiteGeometry.SURFACES.forEach((surface) => {
      // Pour comprendre comment le vent frappe ce triangle,
      // on doit savoir dans quelle direction il "regarde"
      // (comme l'orientation d'un panneau solaire)
      const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
      const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
      const normaleLocale = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();

      // 2. Rotation de la normale selon l'orientation du kite
      const normaleMonde = normaleLocale
        .clone()
        .applyQuaternion(kiteOrientation);

      // Maintenant on vérifie sous quel angle le vent frappe ce triangle
      // C'est comme mettre votre main par la fenêtre de la voiture :
      // - Main à plat face au vent = beaucoup de force
      // - Main de profil = peu de force
      const facing = windDir.dot(normaleMonde);
      const cosIncidence = Math.max(0, Math.abs(facing));

      // Si le vent glisse sur le côté (angle = 0), pas de force
      if (cosIncidence <= PhysicsConstants.EPSILON) {
        return;
      }

      // 4. Force perpendiculaire à la surface (pression aérodynamique)
      const normalDir =
        facing >= 0 ? normaleMonde.clone() : normaleMonde.clone().negate();

      // 5. Intensité = pression dynamique × surface × cos(angle)
      const forceMagnitude = dynamicPressure * surface.area * cosIncidence;
      const force = normalDir.multiplyScalar(forceMagnitude);

      // 6. Centre de pression = centre géométrique du triangle
      const centre = surface.vertices[0]
        .clone()
        .add(surface.vertices[1])
        .add(surface.vertices[2])
        .divideScalar(3);

      // On note si cette force est sur le côté gauche ou droit
      // C'est important car si un côté a plus de force,
      // le kite va tourner (comme un bateau avec une seule rame)
      const isLeft = centre.x < 0; // Négatif = gauche, Positif = droite

      if (isLeft) {
        leftForce.add(force); // On additionne à la force totale gauche
      } else {
        rightForce.add(force); // On additionne à la force totale droite
      }

      totalForce.add(force);

      // Le couple, c'est ce qui fait tourner le kite
      // Imaginez une porte : si vous poussez près des gonds, elle tourne peu
      // Si vous poussez loin des gonds, elle tourne beaucoup
      // Ici, plus la force est loin du centre, plus elle fait tourner
      const centreWorld = centre.clone().applyQuaternion(kiteOrientation);
      const torque = new THREE.Vector3().crossVectors(centreWorld, force);
      totalTorque.add(torque);
    });

    // PHYSIQUE ÉMERGENTE : Le couple vient de la différence G/D
    // Si leftForce > rightForce → rotation vers la droite
    // Si rightForce > leftForce → rotation vers la gauche
    // AUCUN facteur artificiel nécessaire!

    // 9. Pour un cerf-volant, on retourne directement les forces totales
    // La décomposition lift/drag classique n'est pas adaptée car le kite
    // peut voler dans toutes les orientations (looping, vrilles, etc.)
    // Les forces émergent naturellement de la pression sur chaque surface

    const lift = totalForce.clone().multiplyScalar(PHYSICS_CONFIG.aero.liftScale);
    const drag = new THREE.Vector3(); // Traînée intégrée dans les forces totales

    // Mise à l'échelle du couple
    const baseTotalMag = Math.max(
      PhysicsConstants.EPSILON,
      totalForce.length()
    );
    const scaledTotalMag = lift.clone().add(drag).length();
    const torqueScale = Math.max(
      0.1,
      Math.min(3, scaledTotalMag / baseTotalMag)
    );

    return {
      lift,
      drag,
      torque: totalTorque.multiplyScalar(torqueScale),
      leftForce, // Exposer les forces pour analyse
      rightForce, // Permet de voir l'asymétrie émergente
    };
  }

  /**
   * Calcule des métriques pour le debug
   */
  static computeMetrics(
    apparentWind: THREE.Vector3,
    kiteOrientation: THREE.Quaternion
  ): {
    apparentSpeed: number;
    liftMag: number;
    dragMag: number;
    lOverD: number;
    aoaDeg: number;
  } {
    const windSpeed = apparentWind.length();
    if (windSpeed < PhysicsConstants.EPSILON) {
      return { apparentSpeed: 0, liftMag: 0, dragMag: 0, lOverD: 0, aoaDeg: 0 };
    }

    const { lift } = this.calculateForces(apparentWind, kiteOrientation);
    const liftMag = lift.length();
    const dragMag = 0; // Traînée intégrée dans les forces totales
    const lOverD = 0; // Ratio non applicable pour un cerf-volant

    // Calcul approximatif de l'angle d'attaque
    const windDir = apparentWind.clone().normalize();
    let weightedNormal = new THREE.Vector3();

    KiteGeometry.SURFACES.forEach((surface) => {
      const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
      const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
      const normaleMonde = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize()
        .applyQuaternion(kiteOrientation);

      const facing = windDir.dot(normaleMonde);
      const cosIncidence = Math.max(0, Math.abs(facing));

      const normalDir =
        facing >= 0 ? normaleMonde : normaleMonde.clone().negate();
      weightedNormal.add(normalDir.multiplyScalar(surface.area * cosIncidence));
    });

    let aoaDeg = 0;
    if (
      weightedNormal.lengthSq() >
      PhysicsConstants.EPSILON * PhysicsConstants.EPSILON
    ) {
      const eff = weightedNormal.normalize();
      const dot = Math.max(-1, Math.min(1, eff.dot(windDir)));
      const phiDeg = (Math.acos(dot) * 180) / Math.PI;
      aoaDeg = Math.max(0, 90 - phiDeg);
    }

    return { apparentSpeed: windSpeed, liftMag, dragMag, lOverD, aoaDeg };
  }
}