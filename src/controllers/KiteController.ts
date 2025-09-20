/**
 * KiteController.ts - Contrôleur du cerf-volant
 *
 * Responsabilité : Gestion de la physique du cerf-volant, intégration des forces,
 * contraintes des lignes et validation de la position
 */
import * as THREE from "three";
import { PhysicsConstants } from "../physics/PhysicsConstants";
import { CONFIG } from "../config/GlobalConfig";
import type { KiteState, HandlePositions } from "../types/kite";
import type { Kite } from "../kite/Kite";

export class KiteController {
  private kite: Kite;
  private state: KiteState;
  private previousPosition: THREE.Vector3;
  // États pour les warnings
  private hasExcessiveAccel: boolean = false;
  private hasExcessiveVelocity: boolean = false;
  private hasExcessiveAngular: boolean = false;
  private lastAccelMagnitude: number = 0;
  private lastVelocityMagnitude: number = 0;
  private lastAngularMagnitude: number = 0;

  // Lissage temporel des forces
  private smoothedForce: THREE.Vector3;
  private smoothedTorque: THREE.Vector3;
  private readonly FORCE_SMOOTHING = 0.15; // Lissage léger (85% de la nouvelle force appliquée)

  constructor(kite: Kite) {
    this.kite = kite;
    this.state = {
      position: kite.position.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      orientation: kite.quaternion.clone(),
    };
    this.previousPosition = kite.position.clone();
    this.kite.userData.lineLength = CONFIG.lines.defaultLength;

    // Initialiser les forces lissées
    this.smoothedForce = new THREE.Vector3();
    this.smoothedTorque = new THREE.Vector3();
  }

  /**
   * Met à jour la position et l'orientation du cerf-volant
   *
   * CE QUE FAIT CETTE FONCTION :
   * 1. Vérifie que les forces ne sont pas folles (sécurité)
   * 2. Calcule comment le kite accélère (Force = Masse × Accélération)
   * 3. Met à jour la vitesse et la position
   * 4. S'assure que les lignes ne s'étirent pas
   * 5. Empêche le kite de passer sous terre
   * 6. Fait tourner le kite selon les couples appliqués
   */
  update(
    forces: THREE.Vector3,
    torque: THREE.Vector3,
    handles: HandlePositions,
    deltaTime: number,
    linearDamping?: number,
    angularDamping?: number
  ): void {
    // Valider les entrées
    forces = this.validateForces(forces);
    torque = this.validateTorque(torque);

    // Appliquer le lissage temporel (filtre passe-bas)
    // Cela simule l'inertie du tissu et la viscosité de l'air
    this.smoothedForce.lerp(forces, 1 - this.FORCE_SMOOTHING);
    this.smoothedTorque.lerp(torque, 1 - this.FORCE_SMOOTHING);

    // Intégration physique avec les forces lissées
    const newPosition = this.integratePhysics(this.smoothedForce, deltaTime);

    // Appliquer les contraintes
    this.enforceLineConstraints(newPosition, handles);
    this.handleGroundCollision(newPosition);
    this.validatePosition(newPosition);

    // Appliquer la position finale
    this.kite.position.copy(newPosition);
    this.previousPosition.copy(newPosition);

    // Mise à jour de l'orientation avec le couple lissé
    this.updateOrientation(this.smoothedTorque, deltaTime, angularDamping);

    // Appliquer damping
    this.state.velocity.multiplyScalar(
      linearDamping || CONFIG.physics.linearDamping
    );
    this.state.angularVelocity.multiplyScalar(
      angularDamping || CONFIG.physics.angularDamping
    );

    // Vérifier warnings angulaires après damping
    this.checkAngularWarnings();
  }

  /**
   * Vérifie les warnings pour vitesse angulaire excessive
   */
  private checkAngularWarnings(): void {
    this.lastAngularMagnitude = this.state.angularVelocity.length();
    if (this.lastAngularMagnitude > PhysicsConstants.MAX_ANGULAR_VELOCITY) {
      this.hasExcessiveAngular = true;
    } else {
      this.hasExcessiveAngular = false;
    }
  }

  /**
   * Retourne les états de warning pour le debug
   */
  getWarnings(): { accel: boolean; velocity: boolean; angular: boolean } {
    return {
      accel: this.hasExcessiveAccel,
      velocity: this.hasExcessiveVelocity,
      angular: this.hasExcessiveAngular,
    };
  }

  /**
   * Valide et limite les forces
   */
  private validateForces(forces: THREE.Vector3): THREE.Vector3 {
    if (
      !forces ||
      forces.length() > PhysicsConstants.MAX_FORCE ||
      isNaN(forces.length())
    ) {
      console.error(
        `⚠️ Forces invalides: ${forces ? forces.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return forces;
  }

  /**
   * Valide le couple
   */
  private validateTorque(torque: THREE.Vector3): THREE.Vector3 {
    if (!torque || isNaN(torque.length())) {
      console.error(
        `⚠️ Couple invalide: ${torque ? torque.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return torque;
  }

  /**
   * Intègre les forces pour calculer la nouvelle position (méthode d'Euler)
   * Implémente la 2ème loi de Newton : F = ma → a = F/m
   */
  private integratePhysics(
    forces: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    // Newton : accélération = Force / masse
    const acceleration = forces.clone().divideScalar(CONFIG.kite.mass);
    this.lastAccelMagnitude = acceleration.length();

    // Sécurité : limiter pour éviter l'explosion numérique
    if (acceleration.length() > PhysicsConstants.MAX_ACCELERATION) {
      this.hasExcessiveAccel = true;
      acceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
    } else {
      this.hasExcessiveAccel = false;
    }

    // Intégration d'Euler : v(t+dt) = v(t) + a·dt
    this.state.velocity.add(acceleration.multiplyScalar(deltaTime));
    // Amortissement : simule la résistance de l'air
    this.state.velocity.multiplyScalar(CONFIG.physics.linearDamping);
    this.lastVelocityMagnitude = this.state.velocity.length();

    // Garde-fou vitesse max (réalisme physique)
    if (this.state.velocity.length() > PhysicsConstants.MAX_VELOCITY) {
      this.hasExcessiveVelocity = true;
      this.state.velocity
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_VELOCITY);
    } else {
      this.hasExcessiveVelocity = false;
    }

    // Position : x(t+dt) = x(t) + v·dt
    return this.kite.position
      .clone()
      .add(this.state.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Applique les contraintes des lignes - Solver PBD (Position-Based Dynamics)
   * Algorithme sophistiqué qui respecte la contrainte de distance tout en
   * permettant la rotation naturelle du kite
   */
  private enforceLineConstraints(
    predictedPosition: THREE.Vector3,
    handles: HandlePositions
  ): void {
    // PRINCIPE DE LA PYRAMIDE DE CONTRAINTE :
    // Le cerf-volant est constamment poussé par le vent contre la sphère de contrainte
    // Les lignes + brides forment une pyramide qui maintient une géométrie stable
    // Le kite "glisse" sur la surface de la sphère définie par la longueur des lignes
    // C'est quand il sort de cette sphère qu'il "décroche"

    const lineLength =
      this.kite.userData.lineLength || CONFIG.lines.defaultLength;
    const tol = PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;

    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) return;

    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Résolution PBD pour chaque ligne
    const solveLine = (ctrlLocal: THREE.Vector3, handle: THREE.Vector3) => {
      const q = this.kite.quaternion;
      const cpWorld = ctrlLocal
        .clone()
        .applyQuaternion(q)
        .add(predictedPosition);
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
        this.kite.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse
      const q2 = this.kite.quaternion;
      const cpWorld2 = ctrlLocal
        .clone()
        .applyQuaternion(q2)
        .add(predictedPosition);
      const n2 = cpWorld2.clone().sub(handle).normalize();
      const r2 = cpWorld2.clone().sub(predictedPosition);
      const pointVel = this.state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(this.state.angularVelocity, r2));
      const radialSpeed = pointVel.dot(n2);

      if (radialSpeed > 0) {
        const rxn = new THREE.Vector3().crossVectors(r2, n2);
        const eff = invMass + rxn.lengthSq() * invInertia;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        this.state.velocity.add(n2.clone().multiplyScalar(J * invMass));
        const angImpulse = new THREE.Vector3().crossVectors(
          r2,
          n2.clone().multiplyScalar(J)
        );
        this.state.angularVelocity.add(angImpulse.multiplyScalar(invInertia));
      }
    };

    // Deux passes pour mieux satisfaire les contraintes
    for (let i = 0; i < 2; i++) {
      solveLine(ctrlLeft, handles.left);
      solveLine(ctrlRight, handles.right);
    }
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(newPosition: THREE.Vector3): void {
    const groundY = CONFIG.kite.minHeight;
    const pointsMap = this.kite.getPointsMap?.() as
      | Map<string, [number, number, number]>
      | undefined;

    if (pointsMap && pointsMap.size > 0) {
      let minY = Infinity;
      const q = this.kite.quaternion;

      pointsMap.forEach(([px, py, pz]) => {
        const world = new THREE.Vector3(px, py, pz)
          .applyQuaternion(q)
          .add(newPosition);
        if (world.y < minY) minY = world.y;
      });

      if (minY < groundY) {
        const lift = groundY - minY;
        newPosition.y += lift;

        if (this.state.velocity.y < 0) this.state.velocity.y = 0;
        this.state.velocity.x *= PhysicsConstants.GROUND_FRICTION;
        this.state.velocity.z *= PhysicsConstants.GROUND_FRICTION;
      }
    } else {
      // Fallback simple
      if (newPosition.y < groundY) {
        newPosition.y = groundY;
        if (this.state.velocity.y < 0) this.state.velocity.y = 0;
        this.state.velocity.x *= PhysicsConstants.GROUND_FRICTION;
        this.state.velocity.z *= PhysicsConstants.GROUND_FRICTION;
      }
    }
  }

  /**
   * Valide la position finale
   */
  private validatePosition(newPosition: THREE.Vector3): void {
    if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
      console.error(`⚠️ Position NaN détectée! Reset à la position précédente`);
      newPosition.copy(this.previousPosition);
      this.state.velocity.set(0, 0, 0);
    }
  }

  /**
   * Met à jour l'orientation du cerf-volant - Dynamique du corps rigide
   * L'orientation émerge naturellement des contraintes des lignes et brides
   */
  private updateOrientation(
    torque: THREE.Vector3,
    deltaTime: number,
    angularDamping?: number
  ): void {
    // Couple d'amortissement (résistance à la rotation dans l'air)
    const dampTorque = this.state.angularVelocity
      .clone()
      .multiplyScalar(-CONFIG.physics.angularDragCoeff);
    const effectiveTorque = torque.clone().add(dampTorque);

    // Dynamique rotationnelle : α = T / I
    const angularAcceleration = effectiveTorque.divideScalar(
      CONFIG.kite.inertia
    );

    // Limiter l'accélération angulaire
    if (
      angularAcceleration.length() > PhysicsConstants.MAX_ANGULAR_ACCELERATION
    ) {
      angularAcceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ANGULAR_ACCELERATION);
    }

    // Mise à jour de la vitesse angulaire
    this.state.angularVelocity.add(
      angularAcceleration.multiplyScalar(deltaTime)
    );
    this.state.angularVelocity.multiplyScalar(CONFIG.physics.angularDamping);

    // Appliquer la rotation
    if (this.state.angularVelocity.length() > PhysicsConstants.EPSILON) {
      const deltaRotation = new THREE.Quaternion();
      const axis = this.state.angularVelocity.clone().normalize();
      const angle = this.state.angularVelocity.length() * deltaTime;
      deltaRotation.setFromAxisAngle(axis, angle);

      this.kite.quaternion.multiply(deltaRotation);
      this.kite.quaternion.normalize();
    }
  }

  getState(): KiteState {
    return { ...this.state };
  }

  getKite(): Kite {
    return this.kite;
  }

  setLineLength(length: number): void {
    this.kite.userData.lineLength = length;
  }
}
