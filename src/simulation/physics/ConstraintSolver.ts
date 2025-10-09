/**
 * ConstraintSolver.ts - Solveur de contraintes pour les lignes du cerf-volant
 *
 * Rôle :
 *   - Applique les contraintes de distance sur les lignes via l'algorithme Position-Based Dynamics (PBD)
 *   - Garantit la stabilité géométrique du kite et le respect des longueurs de ligne
 *   - Permet la rotation naturelle et le décrochage du kite
 *
 * Dépendances principales :
 *   - Kite.ts : Accès à la géométrie et points du cerf-volant
 *   - PhysicsConstants.ts : Constantes physiques pour la tolérance et la gestion des contraintes
 *   - SimulationConfig.ts : Paramètres de configuration
 *   - Types : Utilise HandlePositions pour typer les poignées
 *
 * Relation avec les fichiers adjacents :
 *   - LineSystem.ts : Utilise ConstraintSolver pour appliquer les contraintes sur les lignes
 *   - PhysicsEngine.ts : Orchestration de l'appel au solveur
 *
 * Utilisation typique :
 *   - Appelé par LineSystem ou PhysicsEngine pour maintenir la contrainte de distance
 *
 * Voir aussi :
 *   - src/simulation/physics/LineSystem.ts
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/objects/organic/Kite.ts
 */
import * as THREE from "three";

import { Kite } from "../../objects/Kite";
import { HandlePositions } from "../types";
import { BridleLengths } from "../types/BridleTypes";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Solveur de contraintes pour les lignes
 *
 * Implémente l'algorithme Position-Based Dynamics (PBD) pour maintenir
 * les contraintes de distance des lignes
 */
export class ConstraintSolver {
  /**
   * Applique les contraintes des lignes - Solver PBD (Position-Based Dynamics)
   * Algorithme sophistiqué qui respecte la contrainte de distance tout en
   * permettant la rotation naturelle du kite
   */
  static enforceLineConstraints(
    kite: Kite,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    handles: HandlePositions
  ): void {
    // PRINCIPE DE LA PYRAMIDE DE CONTRAINTE :
    // Le cerf-volant est constamment poussé par le vent contre la sphère de contrainte
    // Les lignes + brides forment une pyramide qui maintient une géométrie stable
    // Le kite "glisse" sur la surface de la sphère définie par la longueur des lignes
    // C'est quand il sort de cette sphère qu'il "décroche"

    const lineLength =
      kite.userData.lineLength || CONFIG.lines.defaultLength;
    const tol = PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;

    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) return;

    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Résolution PBD pour chaque ligne
    const solveLine = (ctrlLocal: THREE.Vector3, handle: THREE.Vector3) => {
      // Utiliser position prédite pour transformation locale→monde
      const originalPos = kite.position.clone();
      kite.position.copy(predictedPosition);
      const cpWorld = kite.toWorldCoordinates(ctrlLocal);
      kite.position.copy(originalPos);
      const diff = cpWorld.clone().sub(handle);
      const dist = diff.length();

      if (dist <= lineLength - tol) return; // Ligne molle

      const n = diff.clone().normalize();
      const C = dist - lineLength;

      const r = cpWorld.clone().sub(predictedPosition);
      const alpha = new THREE.Vector3().crossVectors(r, n);
      const invMass = 1 / mass;
      const invInertia = 1 / Math.max(inertia, PhysicsConstants.EPSILON);
      const denom = invMass + alpha.lengthSq() * invInertia;
      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // Corrections
      const dPos = n.clone().multiplyScalar(-invMass * lambda);
      predictedPosition.add(dPos);

      const dTheta = alpha.clone().multiplyScalar(-invInertia * lambda);
      const angle = dTheta.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dTheta.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        kite.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse
      kite.position.copy(predictedPosition);
      const cpWorld2 = kite.toWorldCoordinates(ctrlLocal);
      kite.position.copy(originalPos);
      const n2 = cpWorld2.clone().sub(handle).normalize();
      const r2 = cpWorld2.clone().sub(predictedPosition);
      const pointVel = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, r2));
      const radialSpeed = pointVel.dot(n2);

      if (radialSpeed > 0) {
        const rxn = new THREE.Vector3().crossVectors(r2, n2);
        const eff = invMass + rxn.lengthSq() * invInertia;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        state.velocity.add(n2.clone().multiplyScalar(J * invMass));
        const angImpulse = new THREE.Vector3().crossVectors(
          r2,
          n2.clone().multiplyScalar(J)
        );
        state.angularVelocity.add(angImpulse.multiplyScalar(invInertia));
      }
    };

    // Plusieurs passes pour mieux satisfaire les contraintes
    for (let i = 0; i < PhysicsConstants.CONSTRAINT_ITERATIONS; i++) {
      solveLine(ctrlLeft, handles.left);
      solveLine(ctrlRight, handles.right);
    }
  }

  /**
   * Applique les contraintes des brides - Solver PBD (Position-Based Dynamics)
   * 
   * Les brides sont des contraintes INTERNES au kite qui relient :
   * - NEZ → CTRL_GAUCHE / CTRL_DROIT
   * - INTER_GAUCHE → CTRL_GAUCHE
   * - INTER_DROIT → CTRL_DROIT
   * - CENTRE → CTRL_GAUCHE / CTRL_DROIT
   * 
   * Contrairement aux lignes principales (kite ↔ pilote), les brides lient
   * des points du MÊME objet (le kite). Elles définissent la forme et rigidité
   * interne du cerf-volant.
   */
  static enforceBridleConstraints(
    kite: Kite,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    bridleLengths: BridleLengths
  ): void {
    const tol = PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;
    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Définition des 6 brides (3 par côté)
    const bridles = [
      // Brides gauches
      { start: "NEZ", end: "CTRL_GAUCHE", length: bridleLengths.nez },
      { start: "INTER_GAUCHE", end: "CTRL_GAUCHE", length: bridleLengths.inter },
      { start: "CENTRE", end: "CTRL_GAUCHE", length: bridleLengths.centre },
      // Brides droites
      { start: "NEZ", end: "CTRL_DROIT", length: bridleLengths.nez },
      { start: "INTER_DROIT", end: "CTRL_DROIT", length: bridleLengths.inter },
      { start: "CENTRE", end: "CTRL_DROIT", length: bridleLengths.centre },
    ];

    // Résolution PBD pour chaque bride
    const solveBridle = (
      startName: string,
      endName: string,
      bridleLength: number
    ) => {
      const startLocal = kite.getPoint(startName);
      const endLocal = kite.getPoint(endName);

      if (!startLocal || !endLocal) {
        console.warn(`⚠️ Points bride introuvables: ${startName} ou ${endName}`);
        return;
      }

      // Convertir points locaux en coordonnées monde (avec position prédite)
      const originalPos = kite.position.clone();
      kite.position.copy(predictedPosition);
      const startWorld = kite.toWorldCoordinates(startLocal);
      const endWorld = kite.toWorldCoordinates(endLocal);
      kite.position.copy(originalPos);

      // Calculer distance actuelle
      const diff = endWorld.clone().sub(startWorld);
      const dist = diff.length();

      // Si bride molle, pas de contrainte
      if (dist <= bridleLength - tol) return;

      // Direction de contrainte (normalisée)
      const n = diff.clone().normalize();

      // Violation de contrainte C = distance - longueur_bride
      const C = dist - bridleLength;

      // Calcul des bras de levier pour rotation
      const rStart = startWorld.clone().sub(predictedPosition);
      const rEnd = endWorld.clone().sub(predictedPosition);

      // Moments angulaires
      const alphaStart = new THREE.Vector3().crossVectors(rStart, n);
      const alphaEnd = new THREE.Vector3().crossVectors(rEnd, n.clone().negate());

      // Inverse masses
      const invMass = 1 / mass;
      const invInertia = 1 / Math.max(inertia, PhysicsConstants.EPSILON);

      // Dénominateur pour lambda (inclut rotation)
      // Les deux points appartiennent au même corps rigide, donc contribution double
      const denom =
        2 * invMass +
        alphaStart.lengthSq() * invInertia +
        alphaEnd.lengthSq() * invInertia;

      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // Corrections de position
      // Point start : poussé dans direction -n
      const dPosStart = n.clone().multiplyScalar(-invMass * lambda);
      // Point end : poussé dans direction +n
      const dPosEnd = n.clone().multiplyScalar(invMass * lambda);

      // Correction nette de position (moyenne)
      const dPos = dPosStart.clone().add(dPosEnd).multiplyScalar(0.5);
      predictedPosition.add(dPos);

      // Correction de rotation (moyenne des deux contributions)
      const dThetaStart = alphaStart.clone().multiplyScalar(-invInertia * lambda);
      const dThetaEnd = alphaEnd.clone().multiplyScalar(-invInertia * lambda);
      const dTheta = dThetaStart.clone().add(dThetaEnd).multiplyScalar(0.5);

      const angle = dTheta.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dTheta.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        kite.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse (dampening)
      kite.position.copy(predictedPosition);
      const startWorld2 = kite.toWorldCoordinates(startLocal);
      const endWorld2 = kite.toWorldCoordinates(endLocal);
      kite.position.copy(originalPos);

      const n2 = endWorld2.clone().sub(startWorld2).normalize();
      const rStart2 = startWorld2.clone().sub(predictedPosition);
      const rEnd2 = endWorld2.clone().sub(predictedPosition);

      // Vitesses des points
      const velStart = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, rStart2));
      const velEnd = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, rEnd2));

      // Vitesse relative le long de la bride
      const relVel = velEnd.clone().sub(velStart);
      const radialSpeed = relVel.dot(n2);

      // Si les points s'éloignent, appliquer correction de vitesse
      if (radialSpeed > 0) {
        const rxnStart = new THREE.Vector3().crossVectors(rStart2, n2);
        const rxnEnd = new THREE.Vector3().crossVectors(rEnd2, n2.clone().negate());
        const eff =
          2 * invMass + rxnStart.lengthSq() * invInertia + rxnEnd.lengthSq() * invInertia;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        // Correction vitesse linéaire
        state.velocity.add(n2.clone().multiplyScalar(J * invMass));

        // Correction vitesse angulaire (moyenne des deux contributions)
        const angImpulseStart = new THREE.Vector3().crossVectors(
          rStart2,
          n2.clone().multiplyScalar(J)
        );
        const angImpulseEnd = new THREE.Vector3().crossVectors(
          rEnd2,
          n2.clone().multiplyScalar(-J)
        );
        const angImpulse = angImpulseStart.clone().add(angImpulseEnd).multiplyScalar(0.5);
        state.angularVelocity.add(angImpulse.multiplyScalar(invInertia));
      }
    };

    // Résoudre toutes les brides (1 passe suffit généralement)
    // Les brides sont courtes et rigides, convergence rapide
    bridles.forEach(({ start, end, length }) => {
      solveBridle(start, end, length);
    });
  }

  /**
   * Gère la collision avec le sol
   */
  static handleGroundCollision(
    kite: Kite,
    newPosition: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const groundY = CONFIG.kite.minHeight;
    const pointsMap = kite.getPointsMap?.() as
      | Map<string, [number, number, number]>
      | undefined;

    if (pointsMap && pointsMap.size > 0) {
      let minY = Infinity;
      const q = kite.quaternion;

      pointsMap.forEach(([px, py, pz]) => {
        const world = new THREE.Vector3(px, py, pz)
          .applyQuaternion(q)
          .add(newPosition);
        if (world.y < minY) minY = world.y;
      });

      if (minY < groundY) {
        const lift = groundY - minY;
        newPosition.y += lift;

        if (velocity.y < 0) velocity.y = 0;
        velocity.x *= PhysicsConstants.GROUND_FRICTION;
        velocity.z *= PhysicsConstants.GROUND_FRICTION;
      }
      return;
    }

    // Fallback simple
    if (newPosition.y < groundY) {
      newPosition.y = groundY;
      if (velocity.y < 0) velocity.y = 0;
      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;
    }
  }
}