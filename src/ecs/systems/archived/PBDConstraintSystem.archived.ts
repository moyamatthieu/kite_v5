/**
 * PBDConstraintSystem.ts - Pure Position-Based Dynamics Constraint Solver
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║              PURE PBD - POSITION-BASED DYNAMICS                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║                                                                         ║
 * ║  Implémentation d'un solveur PBD pur selon les principes de:          ║
 * ║  - Müller et al. (2007) "Position Based Dynamics"                     ║
 * ║  - Macklin et al. (2016) "XPBD: Position-Based Simulation"            ║
 * ║                                                                         ║
 * ║  PRINCIPES PBD:                                                        ║
 * ║  ──────────────                                                        ║
 * ║  1. Pas de forces explicites (contrairement à spring-mass)            ║
 * ║  2. Projection directe des positions pour satisfaire contraintes       ║
 * ║  3. Convergence itérative (Gauss-Seidel)                              ║
 * ║  4. Stabilité inconditionnelle (pas de blow-up)                       ║
 * ║  5. Contrôle précis de la rigidité via compliance                     ║
 * ║                                                                         ║
 * ║  ALGORITHME:                                                           ║
 * ║  ──────────                                                            ║
 * ║  Pour chaque itération:                                               ║
 * ║    Pour chaque contrainte (ligne gauche, ligne droite):               ║
 * ║      1. Calculer C(x) = ||x1 - x2|| - restLength                      ║
 * ║      2. Si C(x) > 0 (ligne tendue):                                   ║
 * ║         - Calculer gradient ∇C                                        ║
 * ║         - Calculer lambda (multiplicateur Lagrange)                   ║
 * ║         - Corriger positions: Δp = -λ × w × ∇C                        ║
 * ║      3. Sinon: contrainte inactive (slack)                            ║
 * ║                                                                         ║
 * ║  UNILATERAL CONSTRAINT:                                               ║
 * ║  ─────────────────────                                                ║
 * ║  Les lignes ne peuvent que tirer, jamais pousser.                     ║
 * ║  λ ≥ 0 (inequality constraint)                                        ║
 * ║                                                                         ║
 * ║  COMPLIANCE:                                                           ║
 * ║  ──────────                                                            ║
 * ║  α = compliance (inverse de la rigidité)                              ║
 * ║  α = 0     → infiniment rigide (hard constraint)                      ║
 * ║  α > 0     → souple (soft constraint)                                 ║
 * ║  α = 1/k   → équivalent à un ressort de raideur k                     ║
 * ║                                                                         ║
 * ║  ANGULAR CONSTRAINTS:                                                  ║
 * ║  ───────────────────                                                  ║
 * ║  Les corrections de position génèrent automatiquement des rotations   ║
 * ║  via les forces de contrainte appliquées hors du centre de masse.    ║
 * ║                                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Priority: 40 (après AeroSystem 30, avant PhysicsSystem 50)
 *
 * REFERENCES:
 * - Müller et al. "Position Based Dynamics" (2007)
 * - Macklin et al. "XPBD: Position-Based Simulation of Compliant Constraints" (2016)
 * - Bender et al. "A Survey on Position-Based Simulation Methods" (2014)
 *
 * @class PBDConstraintSystem
 * @extends System
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../../core/System';
import { TransformComponent } from '../../components/TransformComponent';
import { PhysicsComponent } from '../../components/PhysicsComponent';
import { LineComponent } from '../../components/LineComponent';
import { GeometryComponent } from '../../components/GeometryComponent';
import { CONFIG } from '../../config/Config';

const GROUND_Y = 0;
const EPSILON = 1e-6;
const PRIORITY = 52; // APRÈS PhysicsSystem (50) pour corriger positions

/**
 * Structure pour stocker l'état d'une contrainte PBD
 */
interface PBDConstraintState {
  /** Point de contrôle du kite (world space) */
  kitePoint: THREE.Vector3;

  /** Point du poignet (world space) */
  poignetPoint: THREE.Vector3;

  /** Longueur au repos */
  restLength: number;

  /** Composant LineComponent associé */
  lineComponent: LineComponent;

  /** Nom de la contrainte (pour debug) */
  name: string;
}

export class PBDConstraintSystem extends System {
  // ========== PARAMETRES PBD ==========
  /** Nombre d'itérations de résolution par frame */
  private readonly iterations: number;

  /** Compliance (inverse de rigidité): α = 1/k */
  private readonly compliance: number;

  /** Correction maximale par frame (m) - Sécurité anti-divergence */
  private readonly maxCorrection: number;

  /** Lambda max (sécurité) */
  private readonly maxLambda: number;

  /** Facteur d'amortissement angulaire */
  private readonly angularDamping: number;

  constructor() {
    super('PBDConstraintSystem', PRIORITY);

    // Charger les paramètres depuis Config
    this.iterations = CONFIG.lines.pbd.iterations;
    this.compliance = CONFIG.lines.pbd.compliance;
    this.maxCorrection = CONFIG.lines.pbd.maxCorrection;
    this.maxLambda = CONFIG.lines.pbd.maxLambda;
    this.angularDamping = CONFIG.lines.pbd.angularDamping;
  }

  update(context: SimulationContext): void {
    const { entityManager, deltaTime } = context;

    // Récupérer les entités nécessaires
    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) {
      return;
    }

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    if (!kiteTransform || !kitePhysics || !kiteGeometry) {
      return;
    }

    // Pas de contraintes sur les objets kinematiques
    if (kitePhysics.isKinematic) {
      return;
    }

    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');
    if (!barGeometry) return;

    // Récupérer les composants de ligne
    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');
    if (!leftLineComp || !rightLineComp) return;

    // ========================================================================
    // PHASE 1: Préparer les contraintes
    // ========================================================================
    const constraints = this.prepareConstraints(
      kite, kiteGeometry,
      controlBar, barGeometry,
      leftLineComp, rightLineComp
    );

    if (constraints.length === 0) {
      return;
    }

    // ========================================================================
    // PHASE 2: Sauvegarder la position initiale (pour calcul de vélocité)
    // ========================================================================
    const oldPosition = kiteTransform.position.clone();
    const oldQuaternion = kiteTransform.quaternion.clone();

    // ========================================================================
    // PHASE 3: Résolution itérative PBD (Gauss-Seidel)
    // ========================================================================
    for (let iter = 0; iter < this.iterations; iter++) {
      for (const constraint of constraints) {
        this.solveConstraint(constraint, kiteTransform, kitePhysics, deltaTime);
      }
    }

    // ========================================================================
    // PHASE 4: Mise à jour des vélocités (PBD)
    // ========================================================================
    // En PBD, après avoir corrigé les positions, il faut mettre à jour les vélocités
    // pour qu'elles soient cohérentes avec les nouvelles positions
    // v_new = (p_new - p_old) / dt
    if (deltaTime > EPSILON) {
      const deltaPos = kiteTransform.position.clone().sub(oldPosition);
      kitePhysics.velocity.copy(deltaPos.divideScalar(deltaTime));

      // Pour la rotation, c'est plus complexe. On va juste amortir l'angular velocity
      // car les corrections de position vont indirectement affecter la rotation
    }

    // ========================================================================
    // PHASE 5: Amortissement angulaire (stabilisation)
    // ========================================================================
    kitePhysics.angularVelocity.multiplyScalar(this.angularDamping);

    // ========================================================================
    // PHASE 6: Collision avec le sol
    // ========================================================================
    this.handleGroundCollision(kiteTransform, kitePhysics);
  }

  /**
   * Prépare les contraintes à partir des entités
   */
  private prepareConstraints(
    kite: any,
    kiteGeometry: GeometryComponent,
    controlBar: any,
    barGeometry: GeometryComponent,
    leftLineComp: LineComponent,
    rightLineComp: LineComponent
  ): PBDConstraintState[] {
    const constraints: PBDConstraintState[] = [];

    // Points de contrôle du kite
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite);
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite);

    // Handles de la barre
    const leftHandle = barGeometry.getPointWorld('leftHandle', controlBar);
    const rightHandle = barGeometry.getPointWorld('rightHandle', controlBar);

    if (!ctrlGauche || !ctrlDroit || !leftHandle || !rightHandle) {
      return constraints;
    }

    // Contrainte gauche
    constraints.push({
      kitePoint: ctrlGauche,
      poignetPoint: leftHandle,
      restLength: leftLineComp.restLength,
      lineComponent: leftLineComp,
      name: 'leftLine'
    });

    // Contrainte droite
    constraints.push({
      kitePoint: ctrlDroit,
      poignetPoint: rightHandle,
      restLength: rightLineComp.restLength,
      lineComponent: rightLineComp,
      name: 'rightLine'
    });

    return constraints;
  }

  /**
   * Résout une contrainte PBD individuelle (distance unilaterale)
   *
   * Algorithme XPBD (eXtended Position-Based Dynamics):
   *
   * 1. Fonction de contrainte: C(x) = ||p1 - p2|| - L0
   * 2. Gradient: ∇C = (p1 - p2) / ||p1 - p2||
   * 3. Lambda: λ = -C / (w1 + w2 + α/Δt²)  où w = 1/m (masse inverse)
   * 4. Correction: Δp = λ × w × ∇C
   *
   * Pour contrainte unilatérale (λ ≥ 0):
   * - Si C ≤ 0: contrainte inactive (slack), pas de correction
   * - Si C > 0: contrainte active, appliquer correction
   */
  private solveConstraint(
    constraint: PBDConstraintState,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    deltaTime: number
  ): void {
    const { kitePoint, poignetPoint, restLength, lineComponent, name } = constraint;

    // === 1. CALCUL DE LA CONTRAINTE ===
    // Direction: du poignet vers le kite point
    const delta = kitePoint.clone().sub(poignetPoint);
    const distance = delta.length();

    if (distance < EPSILON) {
      // Points confondus, pas de contrainte
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.currentLength = 0;
      lineComponent.currentTension = 0;
      return;
    }

    // Normaliser
    const direction = delta.clone().divideScalar(distance);

    // Fonction de contrainte: C = distance - restLength
    const C = distance - restLength;

    // === 2. CONTRAINTE UNILATERALE ===
    // Si C ≤ 0, la ligne est slack (pas de tension)
    if (C <= EPSILON) {
      lineComponent.state.isTaut = false;
      lineComponent.state.elongation = 0;
      lineComponent.state.strainRatio = 0;
      lineComponent.currentLength = distance;
      lineComponent.currentTension = 0;
      return;
    }

    // === 3. CONTRAINTE ACTIVE ===
    lineComponent.state.isTaut = true;
    lineComponent.state.elongation = C;
    lineComponent.state.strainRatio = C / restLength;
    lineComponent.currentLength = distance;

    // === 4. CALCUL DES MASSES INVERSES ===
    const w_kite = 1.0 / kitePhysics.mass; // Masse inverse du kite
    const w_handle = 0.0; // Handle fixe (masse infinie)
    const w_sum = w_kite + w_handle;

    if (w_sum < EPSILON) {
      // Pas de masse inverse, pas de correction possible
      return;
    }

    // === 5. CALCUL DU LAMBDA (multiplicateur de Lagrange) ===
    // XPBD: λ = -C / (Σw_i + α/Δt²)
    // α = compliance (0 = infiniment rigide, >0 = souple)
    // Pour une contrainte d'inégalité (unilatérale), λ doit être positif
    const alpha_tilde = this.compliance / (deltaTime * deltaTime + EPSILON); // XPBD compliance term

    // Calculate lambda for XPBD. It will be negative if C is positive (stretched).
    // λ = -C / (Σw_i + α/Δt²)
    let lambda = -C / (w_sum + alpha_tilde);

    // Clamp lambda magnitude for stability, but preserve sign
    const lambdaMagnitudeClamped = Math.min(Math.abs(lambda), this.maxLambda);
    lambda = Math.sign(lambda) * lambdaMagnitudeClamped;

    // Store approximate tension magnitude (tension is always positive)
    lineComponent.currentTension = Math.abs(lambda);

    // Calculate position correction for the kite
    // Δp_kite = λ × w_kite × ∇C (where ∇C is 'direction')
    const correction_kite = direction.clone().multiplyScalar(lambda * w_kite);

    // Limiter la correction maximale (sécurité)
    const correctionMagnitude = correction_kite.length();
    if (correctionMagnitude > this.maxCorrection) {
      correction_kite.multiplyScalar(this.maxCorrection / correctionMagnitude);
    }

    // === 7. APPLICATION DIRECTE DE LA CORRECTION (PBD PUR) ===
    // PBD modifie directement les positions
    kiteTransform.position.add(correction_kite);

    // Note: Les torques seront gérés automatiquement par les forces de contrainte
    // qui s'appliquent hors du centre de masse. On n'a pas besoin de les calculer ici.
  }

  /**
   * Gère la collision avec le sol
   */
  private handleGroundCollision(
    transform: TransformComponent,
    physics: PhysicsComponent
  ): void {
    if (transform.position.y < GROUND_Y) {
      transform.position.y = GROUND_Y;

      // Réflexion de la vélocité verticale (bounce)
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.5; // 50% de restitution
      }
    }
  }
}
