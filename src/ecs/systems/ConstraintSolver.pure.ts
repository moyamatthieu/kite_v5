/**
 * ConstraintSolver.pure.ts - Solveur de contraintes ECS pur
 *
 * Version ECS pure sans dépendances OO :
 *   - Utilise Entity au lieu de class Kite
 *   - Travaille avec GeometryComponent, TransformComponent, BridleComponent
 *   - Implémente Position-Based Dynamics (PBD) pour contraintes géométriques
 *
 * Rôle :
 *   - Applique les contraintes de distance sur les lignes
 *   - Garantit la stabilité géométrique et respect des longueurs
 *   - Gère la sphère de vol et le point d'équilibre zénith
 */
import * as THREE from "three";
import { Entity } from "@base/Entity";
import { GeometryComponent } from "@components/GeometryComponent";
import { TransformComponent } from "@components/TransformComponent";
import { BridleComponent } from "@components/BridleComponent";
import { LineComponent } from "@components/LineComponent";
import { PhysicsComponent } from "@components/PhysicsComponent";
import { HandlePositions } from "@mytypes/PhysicsTypes";

import { BridleLengths } from "../types/BridleTypes";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Interface décrivant la sphère de vol du kite
 *
 * PRINCIPE FONDAMENTAL :
 * Le kite évolue sur une sphère de rayon R = L_lignes + L_brides
 * Cette sphère définit la "fenêtre de vol" (wind window)
 */
export interface FlightSphere {
  center: THREE.Vector3;
  radius: number;
  kitePosition: THREE.Vector3;
  currentDistance: number;
  tensionFactor: number;
  zenithPosition: THREE.Vector3;
  distanceToZenith: number;
  powerFactor: number;
  windDirection: THREE.Vector3;
  windAngleDeg: number;
  currentZone: 'zenith' | 'power' | 'edge' | 'transition';
}

/**
 * Solveur de contraintes ECS pur
 */
export class PureConstraintSolver {
  /**
   * Calcule la sphère de vol du kite selon le principe fondamental
   * R = longueur_lignes + longueur_bridles
   *
   * Version ECS pure : travaille avec Entity + Components
   * 
   * @param leftLineEntity - Entité de la ligne gauche (pour lire la longueur réelle)
   */
  static calculateFlightSphere(
    kiteEntity: Entity,
    pilotPosition: THREE.Vector3,
    windDirection?: THREE.Vector3,
    leftLineEntity?: Entity | null
  ): FlightSphere {
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const bridle = kiteEntity.getComponent<BridleComponent>('bridle');

    if (!transform || !bridle) {
      throw new Error('Kite entity missing required components (transform, bridle)');
    }

    // Lire la longueur depuis LineComponent si disponible, sinon fallback sur CONFIG
    let lineLength = CONFIG.lines.defaultLength;
    
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>('line');
      if (lineComponent) {
        lineLength = lineComponent.config.length;
      }
    }

    // Calculer la longueur moyenne des brides
    const avgBridleLength = (
      bridle.lengths.nez +
      bridle.lengths.inter +
      bridle.lengths.centre
    ) / 3;

    // SPHÈRE DE VOL : R = longueur_lignes + longueur_bridles
    const sphereRadius = lineLength + avgBridleLength;

    // Position actuelle du kite
    const kitePosition = transform.position.clone();
    const currentDistance = kitePosition.distanceTo(pilotPosition);

    // Facteur de tension (0 = relâché, 1 = tendu contre la sphère)
    const tensionFactor = Math.min(currentDistance / sphereRadius, 1.0);

    // Position du zénith (sommet de la sphère)
    const zenithPosition = pilotPosition.clone().add(new THREE.Vector3(0, sphereRadius, 0));

    // Distance au zénith
    const distanceToZenith = kitePosition.distanceTo(zenithPosition);

    // Facteur de puissance basé sur la hauteur relative
    const relativeHeight = (kitePosition.y - pilotPosition.y) / sphereRadius;
    const powerFactor = Math.max(0, Math.min(1.0, 1.0 - relativeHeight));

    // Direction du vent (par défaut : vent arrière selon +Z)
    const windDir = windDirection
      ? windDirection.clone().normalize()
      : new THREE.Vector3(0, 0, 1);

    // Vecteur du pilote vers le kite
    const pilotToKite = kitePosition.clone().sub(pilotPosition).normalize();

    // Angle entre kite et vent
    const windDot = pilotToKite.dot(windDir);
    const windAngleDeg = Math.acos(Math.max(-1.0, Math.min(1.0, windDot))) * PhysicsConstants.RAD_TO_DEG;

    // Déterminer la zone actuelle
    let currentZone: 'zenith' | 'power' | 'edge' | 'transition';

    if (relativeHeight > 0.8 && distanceToZenith < sphereRadius * 0.3) {
      currentZone = 'zenith';
    } else if (relativeHeight < 0.6 && relativeHeight > 0.2) {
      currentZone = 'power';
    } else if (windAngleDeg > 60 && windAngleDeg < 120) {
      currentZone = 'edge';
    } else {
      currentZone = 'transition';
    }

    return {
      center: pilotPosition.clone(),
      radius: sphereRadius,
      kitePosition,
      currentDistance,
      tensionFactor,
      zenithPosition,
      distanceToZenith,
      powerFactor,
      windDirection: windDir,
      windAngleDeg,
      currentZone
    };
  }

  /**
   * Applique le comportement de point d'équilibre zénith
   * Version ECS pure
   */
  static applyZenithEquilibrium(
    kiteEntity: Entity,
    predictedPosition: THREE.Vector3,
    barRotation: number,
    flightSphere: FlightSphere
  ): THREE.Vector3 {
    // Si la barre est quasi-neutre (±10%), appliquer la tendance zénith
    if (Math.abs(barRotation) < 0.1) {
      const zenithDirection = new THREE.Vector3(0, 1, 0);
      const kiteToCenter = flightSphere.center.clone().sub(predictedPosition);

      // Projeter sur plan horizontal
      const horizontalComponent = kiteToCenter.clone();
      horizontalComponent.y = 0;
      horizontalComponent.normalize();

      // Facteur d'influence zénith
      const zenithFactor = 1.0 - Math.abs(predictedPosition.y - flightSphere.center.y) / flightSphere.radius;
      const zenithInfluence = Math.max(0, zenithFactor * 0.3);

      const finalDirection = zenithDirection.clone()
        .multiplyScalar(zenithInfluence)
        .add(horizontalComponent.multiplyScalar(1.0 - zenithInfluence))
        .normalize();

      // Ajuster vers le zénith
      const adjustment = finalDirection.multiplyScalar(flightSphere.radius * 0.02);
      predictedPosition.add(adjustment);
    }

    return predictedPosition;
  }

  /**
   * Applique les contraintes des lignes - Solver PBD
   * Version ECS pure : travaille avec Entity + Components
   *
   * Convertit points locaux (GeometryComponent) en coordonnées monde
   * en utilisant TransformComponent (position + quaternion)
   * 
   * @param leftLineEntity - Entité de la ligne gauche (pour lire la longueur réelle)
   * @param rightLineEntity - Entité de la ligne droite (pour lire la longueur réelle)
   */
  static enforceLineConstraints(
    kiteEntity: Entity,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    handles: HandlePositions,
    leftLineEntity?: Entity | null,
    rightLineEntity?: Entity | null
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      console.warn('⚠️ Kite entity missing geometry or transform component');
      return;
    }

    // Lire la longueur depuis LineComponent si disponible, sinon fallback sur CONFIG
    let lineLength = CONFIG.lines.defaultLength;
    
    // Essayer de lire depuis leftLineEntity (les deux lignes ont la même longueur)
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>('line');
      if (lineComponent) {
        lineLength = lineComponent.config.length;
      }
    }

    const ctrlLeft = geometry.getPoint("CTRL_GAUCHE");
    const ctrlRight = geometry.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) {
      console.warn('⚠️ Kite missing control points');
      return;
    }

    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3, position: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Résolution PBD pour chaque ligne
    const solveLine = (ctrlLocal: THREE.Vector3, handle: THREE.Vector3) => {
      // Convertir point de contrôle en coordonnées monde (avec position prédite)
      const cpWorld = toWorldCoordinates(ctrlLocal, predictedPosition, transform.quaternion);
      const diff = cpWorld.clone().sub(handle);
      const dist = diff.length();

      // Si ligne molle, pas de contrainte
      if (dist <= lineLength) return;

      const n = diff.clone().normalize();
      const C = dist - lineLength;

      const r = cpWorld.clone().sub(predictedPosition);
      const alpha = new THREE.Vector3().crossVectors(r, n);
      const invMass = 1 / mass;
      const invInertia = 1 / Math.max(inertia, PhysicsConstants.EPSILON);
      const denom = invMass + alpha.lengthSq() * invInertia;
      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // Corrections de position
      const dPos = n.clone().multiplyScalar(-invMass * lambda);
      predictedPosition.add(dPos);

      // Correction de rotation
      const dTheta = alpha.clone().multiplyScalar(-invInertia * lambda);
      const angle = dTheta.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dTheta.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        transform.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse
      const cpWorld2 = toWorldCoordinates(ctrlLocal, predictedPosition, transform.quaternion);
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
   * Applique les contraintes des brides - Solver PBD
   * Version ECS pure
   */
  static enforceBridleConstraints(
    kiteEntity: Entity,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    bridleLengths: BridleLengths
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      console.warn('⚠️ Kite entity missing geometry or transform component');
      return;
    }

    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3, position: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Définition des 6 brides
    const bridles = [
      { start: "NEZ", end: "CTRL_GAUCHE", length: bridleLengths.nez },
      { start: "INTER_GAUCHE", end: "CTRL_GAUCHE", length: bridleLengths.inter },
      { start: "CENTRE", end: "CTRL_GAUCHE", length: bridleLengths.centre },
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
      const startLocal = geometry.getPoint(startName);
      const endLocal = geometry.getPoint(endName);

      if (!startLocal || !endLocal) {
        console.warn(`⚠️ Points bride introuvables: ${startName} ou ${endName}`);
        return;
      }

      // Convertir points locaux en coordonnées monde
      const startWorld = toWorldCoordinates(startLocal, predictedPosition, transform.quaternion);
      const endWorld = toWorldCoordinates(endLocal, predictedPosition, transform.quaternion);

      // Calculer distance actuelle
      const diff = endWorld.clone().sub(startWorld);
      const dist = diff.length();

      // Si bride molle, pas de contrainte
      if (dist <= bridleLength) return;

      // Direction de contrainte
      const n = diff.clone().normalize();

      // Violation de contrainte
      const C = dist - bridleLength;

      // Calcul des bras de levier
      const rStart = startWorld.clone().sub(predictedPosition);
      const rEnd = endWorld.clone().sub(predictedPosition);

      // Moments angulaires
      const alphaStart = new THREE.Vector3().crossVectors(rStart, n);
      const alphaEnd = new THREE.Vector3().crossVectors(rEnd, n.clone().negate());

      // Inverse masses
      const invMass = 1 / mass;
      const invInertia = 1 / Math.max(inertia, PhysicsConstants.EPSILON);

      // Dénominateur pour lambda
      const denom =
        2 * invMass +
        alphaStart.lengthSq() * invInertia +
        alphaEnd.lengthSq() * invInertia;

      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // Corrections de position
      const dPosStart = n.clone().multiplyScalar(-invMass * lambda);
      const dPosEnd = n.clone().multiplyScalar(invMass * lambda);
      const dPos = dPosStart.clone().add(dPosEnd).multiplyScalar(0.5);
      predictedPosition.add(dPos);

      // Correction de rotation
      const dThetaStart = alphaStart.clone().multiplyScalar(-invInertia * lambda);
      const dThetaEnd = alphaEnd.clone().multiplyScalar(-invInertia * lambda);
      const dTheta = dThetaStart.clone().add(dThetaEnd).multiplyScalar(0.5);

      const angle = dTheta.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dTheta.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        transform.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse
      const startWorld2 = toWorldCoordinates(startLocal, predictedPosition, transform.quaternion);
      const endWorld2 = toWorldCoordinates(endLocal, predictedPosition, transform.quaternion);

      const n2 = endWorld2.clone().sub(startWorld2).normalize();
      const rStart2 = startWorld2.clone().sub(predictedPosition);
      const rEnd2 = endWorld2.clone().sub(predictedPosition);

      const velStart = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, rStart2));
      const velEnd = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, rEnd2));

      const relVel = velEnd.clone().sub(velStart);
      const radialSpeed = relVel.dot(n2);

      if (radialSpeed > 0) {
        const rxnStart = new THREE.Vector3().crossVectors(rStart2, n2);
        const rxnEnd = new THREE.Vector3().crossVectors(rEnd2, n2.clone().negate());
        const eff =
          2 * invMass + rxnStart.lengthSq() * invInertia + rxnEnd.lengthSq() * invInertia;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        state.velocity.add(n2.clone().multiplyScalar(J * invMass));

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

    // Résoudre toutes les brides
    bridles.forEach(({ start, end, length }) => {
      solveBridle(start, end, length);
    });
  }

  /**
   * Gère la collision avec le sol
   * Version ECS pure
   */
  /**
   * Gère la collision avec le sol - Applique une contrainte de position
   * Version ECS pure avec détection multi-points et marge de sécurité
   */
  static handleGroundCollision(
    kiteEntity: Entity,
    newPosition: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      console.warn('⚠️ Kite entity missing geometry or transform component');
      return;
    }

    const groundY = CONFIG.kite.minHeight;

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (localPoint: THREE.Vector3, position: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Trouver le point le plus bas du kite
    let minY = Infinity;
    
    geometry.points.forEach((point) => {
      const world = toWorldCoordinates(point, newPosition, transform.quaternion);
      if (world.y < minY) {
        minY = world.y;
      }
    });

    // Si collision avec le sol (avec marge de sécurité)
    if (minY < groundY) {
      const penetrationDepth = groundY - minY;
      
      // Correction de position : remonter le kite pour que le point le plus bas soit au niveau du sol
      newPosition.y += penetrationDepth;

      // Correction de vitesse : annuler la composante verticale descendante
      if (velocity.y < 0) {
        velocity.y = 0;
      }

      // Application de friction horizontale (réaliste pour sol)
      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;

      // Si vitesse horizontale devient trop faible, l'annuler complètement (éviter micro-glissements)
      if (velocity.lengthSq() < PhysicsConstants.EPSILON) {
        velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Résout la position d'un point de contrôle par quadrilatération (intersection de 4 sphères)
   * 
   * Le point CTRL est contraint par :
   * - 3 brides depuis le kite (NEZ, INTER, CENTRE)
   * - 1 ligne vers la poignée
   * 
   * C'est une trilatération 3D étendue à 4 contraintes pour sur-détermination.
   * 
   * @param kiteEntity - Entité du kite (pour récupérer points d'attache)
   * @param handlePosition - Position de la poignée
   * @param bridleLengths - Longueurs des 3 brides
   * @param lineLength - Longueur de la ligne de contrôle
   * @param attachments - Noms des points d'attache (NEZ, INTER, CENTRE)
   * @returns Position résolue du point CTRL
   */
  static solveControlPointPosition(
    kiteEntity: Entity,
    handlePosition: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number },
    lineLength: number,
    attachments: { nez: string; inter: string; centre: string }
  ): THREE.Vector3 {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');

    if (!geometry || !transform) {
      console.warn('⚠️ Kite entity missing geometry or transform');
      return handlePosition.clone();
    }

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (
      localPoint: THREE.Vector3,
      position: THREE.Vector3,
      quaternion: THREE.Quaternion
    ): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Récupérer les 3 points d'attache sur le kite (coordonnées monde)
    const nezLocal = geometry.getPoint(attachments.nez);
    const interLocal = geometry.getPoint(attachments.inter);
    const centreLocal = geometry.getPoint(attachments.centre);

    if (!nezLocal || !interLocal || !centreLocal) {
      console.warn('⚠️ Attachment points not found:', attachments);
      return handlePosition.clone();
    }

    const nezWorld = toWorldCoordinates(nezLocal, transform.position, transform.quaternion);
    const interWorld = toWorldCoordinates(interLocal, transform.position, transform.quaternion);
    const centreWorld = toWorldCoordinates(centreLocal, transform.position, transform.quaternion);

    // Trilatération 3D pour résoudre position CTRL
    // Basé sur les 3 brides (on ignore la ligne pour l'instant, elle sera appliquée après comme contrainte)
    const ctrlPosition = this.trilaterate3D(
      nezWorld,
      bridleLengths.nez,
      interWorld,
      bridleLengths.inter,
      centreWorld,
      bridleLengths.centre
    );

    // Appliquer contrainte de la ligne (projection EXACTE sur sphère centrée sur poignée)
    // Le point CTRL doit TOUJOURS être à exactement lineLength du handle
    const toHandle = ctrlPosition.clone().sub(handlePosition);
    const distToHandle = toHandle.length();

    if (distToHandle > 0.001) { // Éviter division par zéro
      // Projeter sur la sphère de rayon lineLength (toujours, pas seulement si trop loin)
      const direction = toHandle.normalize();
      ctrlPosition.copy(handlePosition).add(direction.multiplyScalar(lineLength));
    } else {
      // Cas dégénéré : CTRL et handle au même endroit (ne devrait pas arriver)
      // Placer le CTRL directement en dessous du handle
      ctrlPosition.copy(handlePosition).add(new THREE.Vector3(0, -lineLength, 0));
    }

    return ctrlPosition;
  }

  /**
   * Trilatération 3D : trouve le point d'intersection de 3 sphères
   * 
   * Méthode analytique basée sur géométrie vectorielle
   * Référence : https://en.wikipedia.org/wiki/Trilateration
   * 
   * @param p1 - Centre sphère 1
   * @param r1 - Rayon sphère 1
   * @param p2 - Centre sphère 2
   * @param r2 - Rayon sphère 2
   * @param p3 - Centre sphère 3
   * @param r3 - Rayon sphère 3
   * @returns Point d'intersection (ou approximation si pas de solution exacte)
   */
  public static trilaterate3D(
    p1: THREE.Vector3,
    r1: number,
    p2: THREE.Vector3,
    r2: number,
    p3: THREE.Vector3,
    r3: number
  ): THREE.Vector3 {
    // Créer repère local avec p1 comme origine
    const ex = p2.clone().sub(p1).normalize();
    const d = p2.distanceTo(p1);

    // Vecteur p1->p3 dans le repère local
    const p3ToP1 = p3.clone().sub(p1);
    const i = ex.dot(p3ToP1);

    // Deuxième axe (perpendiculaire à ex, dans le plan p1-p2-p3)
    const eyTemp = p3ToP1.clone().addScaledVector(ex, -i);
    const ey = eyTemp.normalize();

    // Troisième axe (perpendiculaire aux deux premiers)
    const ez = new THREE.Vector3().crossVectors(ex, ey);

    const j = ey.dot(p3ToP1);

    // Résolution du système d'équations
    // x² + y² + z² = r1²
    // (x-d)² + y² + z² = r2²
    // (x-i)² + (y-j)² + z² = r3²

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    // Calcul de z (deux solutions possibles, on prend celle vers l'arrière du kite)
    const zSquared = r1 * r1 - x * x - y * y;
    const z = zSquared > 0 ? -Math.sqrt(zSquared) : 0; // Solution négative (vers l'arrière)

    // Retour dans le repère monde
    const result = p1.clone();
    result.add(ex.clone().multiplyScalar(x));
    result.add(ey.clone().multiplyScalar(y));
    result.add(ez.clone().multiplyScalar(z));

    return result;
  }

  /**
   * Applique les forces de bride sur le kite depuis un point de contrôle
   * 
   * Les 3 brides tirent sur leurs points d'attache respectifs avec une force
   * proportionnelle à leur tension (calculée depuis la différence de longueur).
   * 
   * @param kiteEntity - Entité du kite
   * @param ctrlPosition - Position actuelle du point CTRL
   * @param bridleLengths - Longueurs au repos des brides
   * @param attachments - Points d'attache sur le kite
   * @param bridleStiffness - Raideur des brides (N/m)
   */
  static applyBridleForces(
    kiteEntity: Entity,
    ctrlPosition: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number },
    attachments: { nez: string; inter: string; centre: string },
    bridleStiffness: number = 5000 // N/m - raideur typique pour brides Dyneema
  ): void {
    const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
    const transform = kiteEntity.getComponent<TransformComponent>('transform');
    const physics = kiteEntity.getComponent<PhysicsComponent>('physics');

    if (!geometry || !transform || !physics) {
      return;
    }

    // Helper : convertir point local en coordonnées monde
    const toWorldCoordinates = (
      localPoint: THREE.Vector3,
      position: THREE.Vector3,
      quaternion: THREE.Quaternion
    ): THREE.Vector3 => {
      return localPoint.clone().applyQuaternion(quaternion).add(position);
    };

    // Pour chaque bride, calculer et appliquer la force
    const applyBridleForce = (pointName: string, restLength: number) => {
      const pointLocal = geometry.getPoint(pointName);
      if (!pointLocal) return;

      const pointWorld = toWorldCoordinates(pointLocal, transform.position, transform.quaternion);
      
      // Vecteur du point d'attache vers CTRL
      const direction = ctrlPosition.clone().sub(pointWorld);
      const currentLength = direction.length();
      
      // Extension de la bride
      const extension = currentLength - restLength;
      
      // Force de tension (loi de Hooke: F = k·Δx)
      // Seulement si bride tendue (extension > 0)
      if (extension > 0) {
        const forceMagnitude = bridleStiffness * extension;
        const force = direction.normalize().multiplyScalar(forceMagnitude);
        
        // Appliquer la force au point d'attache
        // Le bras de levier crée un couple
        const lever = pointWorld.clone().sub(transform.position);
        const torque = new THREE.Vector3().crossVectors(lever, force);
        
        physics.addForce(force);
        physics.addTorque(torque);
      }
    };

    applyBridleForce(attachments.nez, bridleLengths.nez);
    applyBridleForce(attachments.inter, bridleLengths.inter);
    applyBridleForce(attachments.centre, bridleLengths.centre);
  }
}

