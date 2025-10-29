/**
 * BridleConstraintSystem.ts - Applique les contraintes de bride
 *
 * Les brides forment une pyramide:
 * - Base: 3 points anatomiques du kite (NEZ, INTER, CENTRE)
 * - Sommet: point de contrôle (CTRL_GAUCHE ou CTRL_DROIT)
 * - Arêtes: les 3 brides (nez, inter, centre) avec leurs longueurs
 *
 * En modifiant les longueurs des brides, on déplace le sommet de la pyramide.
 * Cela affecte l'angle d'attaque et la portance du kite.
 *
 * Priorité 10 (très haute, pour synchroniser les positions avant les autres systèmes)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { GeometryComponent } from '../components/GeometryComponent';
import { BridleComponent, type BridleLengths } from '../components/BridleComponent';
import { Logger } from '../utils/Logging';

const PRIORITY = 10; // Très haute priorité, avant ConstraintSystem (40)
const MAX_ITERATIONS = 20; // Nombre max d'itérations pour la trilatération
const CONVERGENCE_EPSILON = 0.0001; // 0.1mm - seuil de convergence
const logger = Logger.getInstance();

/**
 * Positionne les points de contrôle en fonction des longueurs des brides.
 * 
 * Utilise une trilatération 3D pour résoudre la pyramide formée par:
 * - 3 points de base (NEZ, INTER, CENTRE)
 * - 3 distances (longueurs des brides)
 * - 1 point sommet (CTRL) à calculer
 * 
 * IMPORTANT: Ce système ne s'exécute QUE quand les longueurs des brides changent
 * (via les sliders UI). Entre les changements, la physique des lignes contrôle
 * les positions CTRL normalement.
 */
export class BridleConstraintSystem extends System {
  private lastLengths: BridleLengths = { nez: 0, inter: 0, centre: 0 };
  private initialized = false;

  constructor() {
    super('BridleConstraintSystem', PRIORITY);
  }

  /**
   * Réinitialise le système lors d'un reset de simulation
   */
  initialize(_entityManager: EntityManager): void {
    this.initialized = false;
    this.lastLengths = { nez: 0, inter: 0, centre: 0 };
    logger.debug('🔧 BridleConstraintSystem reset - initialized flag cleared', 'BridleConstraintSystem');
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    if (!kite) return;

    const geometry = kite.getComponent<GeometryComponent>('geometry');
    const bridle = kite.getComponent<BridleComponent>('bridle');

    if (!geometry || !bridle) return;

    // ✨ INITIALISATION: Au premier appel, forcer le calcul des positions CTRL
    if (!this.initialized) {
      this.initialized = true;
      this.lastLengths = {
        nez: bridle.lengths.nez,
        inter: bridle.lengths.inter,
        centre: bridle.lengths.centre
      };
      logger.debug(`🔧 Initialisation des positions CTRL via trilatération`, 'BridleConstraintSystem');
      this.updateControlPointPositions(geometry, bridle);
      return;
    }

    // Vérifier si les longueurs ont changé
    const lengthsChanged = 
      bridle.lengths.nez !== this.lastLengths.nez ||
      bridle.lengths.inter !== this.lastLengths.inter ||
      bridle.lengths.centre !== this.lastLengths.centre;

    if (!lengthsChanged) {
      return; // Pas de changement, laisser la physique gérer les positions
    }

    // Sauvegarder les nouvelles longueurs
    this.lastLengths = {
      nez: bridle.lengths.nez,
      inter: bridle.lengths.inter,
      centre: bridle.lengths.centre
    };

    logger.debug(`🔧 Longueurs changées: nez=${bridle.lengths.nez}m, inter=${bridle.lengths.inter}m, centre=${bridle.lengths.centre}m`, 'BridleConstraintSystem');

    // Recalculer les positions des CTRL basées sur les nouvelles longueurs
    this.updateControlPointPositions(geometry, bridle);
  }

  /**
   * Met à jour les positions des points de contrôle basées sur les longueurs des brides
   */
  private updateControlPointPositions(
    geometry: GeometryComponent,
    bridle: BridleComponent
  ): void {
    // Points anatomiques (fixes)
    const nez = geometry.getPoint('NEZ');
    const interGauche = geometry.getPoint('INTER_GAUCHE');
    const interDroit = geometry.getPoint('INTER_DROIT');
    const centre = geometry.getPoint('CENTRE');

    if (!nez || !interGauche || !interDroit || !centre) {
      return;
    }

    // Longueurs des brides (mètres)
    const lengths = bridle.lengths;

    // === Recalculer CTRL_GAUCHE ===
    // Pyramide: NEZ-INTER_GAUCHE-CENTRE-CTRL_GAUCHE
    // Distances: nez, inter, centre
    const ctrlGauche = this.calculateControlPointPosition(
      nez,
      interGauche,
      centre,
      lengths.nez,
      lengths.inter,
      lengths.centre
    );

    if (ctrlGauche) {
      geometry.setPoint('CTRL_GAUCHE', ctrlGauche);
    }

    // === Recalculer CTRL_DROIT ===
    // Pyramide: NEZ-INTER_DROIT-CENTRE-CTRL_DROIT
    // Distances: nez, inter, centre
    const ctrlDroit = this.calculateControlPointPosition(
      nez,
      interDroit,
      centre,
      lengths.nez,
      lengths.inter,
      lengths.centre
    );

    if (ctrlDroit) {
      geometry.setPoint('CTRL_DROIT', ctrlDroit);
    }
  }

  /**
   * Calcule la position du point de contrôle en utilisant la trilatération 3D.
   * @param p1 Premier point de base.
   * @param p2 Deuxième point de base.
   * @param p3 Troisième point de base.
   * @param d1 Distance désirée au point p1.
   * @param d2 Distance désirée au point p2.
   * @param d3 Distance désirée au point p3.
   * @returns La position calculée du point de contrôle, ou null si une erreur survient.
   */
  private calculateControlPointPosition(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    d1: number,
    d2: number,
    d3: number
  ): THREE.Vector3 | null {
    // Approche simplifiée mais correcte : 
    // Utiliser la méthode analytique standard de trilatération 3D
    
    // 1. Placer p1 à l'origine du repère local
    const origin = p1.clone();
    const v12 = new THREE.Vector3().subVectors(p2, p1);
    const v13 = new THREE.Vector3().subVectors(p3, p1);

    // 2. Créer une base orthonormée
    // ex : direction vers p2
    const ex = v12.clone().normalize();
    
    // ey : perpendiculaire à ex, dans le plan contenant p3
    const ey = new THREE.Vector3().subVectors(v13, ex.clone().multiplyScalar(v13.dot(ex)));
    ey.normalize();
    
    // ez : complète la base orthonormée
    const ez = new THREE.Vector3().crossVectors(ex, ey);
    
    // S'assurer que ez pointe vers Z+ (avant)
    if (ez.z < 0) {
      ez.multiplyScalar(-1);
      ey.multiplyScalar(-1); // Aussi inverser ey pour garder une base cohérente
    }

    // 3. Exprimer p2 et p3 dans le repère local
    const p2_local_x = v12.dot(ex);
    const p2_local_y = v12.dot(ey);
    const p2_local_z = v12.dot(ez);
    
    const p3_local_x = v13.dot(ex);
    const p3_local_y = v13.dot(ey);
    const p3_local_z = v13.dot(ez);

    // 4. Trilatération analytique 3D
    // Point P cherché vérifie:
    // P.x² + P.y² + P.z² = d1²  ... (1)
    // (P.x - p2x)² + (P.y - p2y)² + (P.z - p2z)² = d2²  ... (2)
    // (P.x - p3x)² + (P.y - p3y)² + (P.z - p3z)² = d3²  ... (3)
    
    // Développer (2) - (1) pour éliminer les termes au carré:
    // -2*p2x*P.x - 2*p2y*P.y - 2*p2z*P.z + (p2x² + p2y² + p2z²) = d2² - d1²
    // P.x = [d1² - d2² + (p2x² + p2y² + p2z²)] / (2 * p2x)
    
    const a = d1 * d1 - d2 * d2 + p2_local_x * p2_local_x + p2_local_y * p2_local_y + p2_local_z * p2_local_z;
    const px = a / (2 * p2_local_x);
    
    // De même pour y avec (3) - (1):
    const b = d1 * d1 - d3 * d3 + p3_local_x * p3_local_x + p3_local_y * p3_local_y + p3_local_z * p3_local_z;
    const py_numerator = b - px * (2 * p3_local_x);
    const py = p3_local_y !== 0 ? py_numerator / (2 * p3_local_y) : 0;
    
    // Pour z, utiliser (1):
    // px² + py² + pz² = d1²
    const pz_squared = d1 * d1 - px * px - py * py;
    
    if (pz_squared < 0) {
      // Pas de solution - retourner la moyenne
      return new THREE.Vector3()
        .addScaledVector(p1, 1)
        .addScaledVector(p2, 1)
        .addScaledVector(p3, 1)
        .multiplyScalar(1 / 3);
    }
    
    // Prendre z positif pour aller vers l'avant (Z+)
    const pz = Math.sqrt(pz_squared);

    const solution_local = new THREE.Vector3(px, py, pz);

    // === Raffinement itératif (Gauss-Newton) pour améliorer la précision ===
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      // Distances actuelles
      const dist1 = solution_local.length();
      const v2 = new THREE.Vector3(p2_local_x - solution_local.x, p2_local_y - solution_local.y, p2_local_z - solution_local.z);
      const dist2 = v2.length();
      const v3 = new THREE.Vector3(p3_local_x - solution_local.x, p3_local_y - solution_local.y, p3_local_z - solution_local.z);
      const dist3 = v3.length();

      // Erreurs
      const err1 = dist1 - d1;
      const err2 = dist2 - d2;
      const err3 = dist3 - d3;

      // Vérifier convergence
      const maxErr = Math.max(Math.abs(err1), Math.abs(err2), Math.abs(err3));
      if (maxErr < CONVERGENCE_EPSILON) {
        break;
      }

      // Directions de correction (gradients)
      const dir1 = dist1 > 0.001 ? solution_local.clone().normalize() : new THREE.Vector3(1, 0, 0);
      const dir2 = dist2 > 0.001 ? v2.clone().normalize() : new THREE.Vector3(1, 0, 0);
      const dir3 = dist3 > 0.001 ? v3.clone().normalize() : new THREE.Vector3(1, 0, 0);

      // Correction
      const alpha = 0.2; // Facteur de convergence
      const correction = new THREE.Vector3();
      correction.addScaledVector(dir1, -err1 * alpha);
      correction.addScaledVector(dir2, -err2 * alpha);
      correction.addScaledVector(dir3, -err3 * alpha);

      solution_local.add(correction);
      
      // Assurer que Z reste positif (en avant)
      if (solution_local.z < 0) {
        solution_local.z = Math.abs(solution_local.z);
      }
    }

    // Convertir du repère local au repère global
    const solution_global = new THREE.Vector3()
      .addScaledVector(ex, solution_local.x)
      .addScaledVector(ey, solution_local.y)
      .addScaledVector(ez, solution_local.z)
      .add(origin);

    return solution_global;
  }
}
