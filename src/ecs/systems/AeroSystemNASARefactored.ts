/**
 * AeroSystemNASA.ts - Calcul des forces aérodynamiques selon NASA
 *
 * Implémentation basée sur le "Beginner's Guide to Kites" de la NASA Glenn Research Center
 * https://www.grc.nasa.gov/www/k-12/airplane/kitelift.html
 * https://www.grc.nasa.gov/www/k-12/airplane/kitedrag.html
 *
 * FORMULES NASA POUR CERFS-VOLANTS (surfaces planes):
 * - Portance: L = Cl × A × ρ × 0.5 × V²
 * - Cl pour plaque plane: Clo = 2 × π × α (α en radians)
 * - Correction aspect ratio: Cl = Clo / (1 + Clo / (π × AR))
 * - Traînée: D = Cd × A × ρ × 0.5 × V²
 * - Cd pour plaque plane: Cdo = 1.28 × sin(α)
 * - Traînée totale: Cd = Cdo + Cl² / (0.7 × π × AR)
 *
 * Hérite de BaseAeroSystem qui gère la logique commune.
 * Priority: 30 (après vent, avant contraintes)
 */

import * as THREE from 'three';

import {
  BaseAeroSystem,
  SurfaceSample,
  LocalWindResult,
  AeroCoefficients
} from './BaseAeroSystem';
import { AerodynamicsComponent } from '../components/AerodynamicsComponent';
import { KiteComponent } from '../components/KiteComponent';

/**
 * Constantes NASA pour calculs aérodynamiques
 */
const NASAAeroConfig = {
  /** Coefficient pour plaque plane perpendiculaire (NASA: 1.28) */
  FLAT_PLATE_DRAG_COEFF: 1.28,

  /** Facteur d'efficacité pour ailes rectangulaires (NASA: 0.7) */
  RECTANGULAR_WING_EFFICIENCY: 0.7,

  /** Constante π */
  PI: Math.PI,

  /** Angle de décrochage (stall) en radians - ~15° pour plaque plane */
  STALL_ANGLE_RAD: (15 * Math.PI) / 180,

  /** Post-stall CL max (coefficient de portance au stall) */
  CL_MAX: 1.2,

  /** Post-stall CD (traînée augmentée après stall) */
  CD_STALL: 1.8,
};

export class AeroSystemNASA extends BaseAeroSystem {
  constructor() {
    const PRIORITY = 30;
    super('AeroSystemNASA', PRIORITY);
  }

  /**
   * Calcule les coefficients aérodynamiques selon les formules NASA
   *
   * Référence: NASA Glenn Research Center - Beginner's Guide to Kites
   * Formules validées expérimentalement pour plaques planes (cerfs-volants)
   *
   * @param dotNW - Produit scalaire normale · direction vent
   * @param sample - Surface échantillonnée
   * @param aero - Composant aérodynamique
   * @param kiteComp - Composant kite
   * @param localWind - Vent local calculé
   * @returns Coefficients CL et CD selon NASA
   */
  protected calculateCoefficients(
    dotNW: number,
    sample: SurfaceSample,
    aero: AerodynamicsComponent,
    kiteComp: KiteComponent,
    localWind: LocalWindResult
  ): AeroCoefficients {
    // Calcul de l'angle d'attaque
    // dotNW = cos(α) où α est l'angle entre normale et vent
    const alpha = Math.acos(Math.max(-1, Math.min(1, dotNW)));

    // ===== PORTANCE (LIFT) - NASA =====
    // Formule de portance linéaire: Clo = 2 × π × α (pour petits angles)
    let Clo = 2.0 * NASAAeroConfig.PI * alpha;

    // Correction pour aspect ratio fini (NASA)
    // Cl = Clo / (1 + Clo / (π × AR))
    const AR = kiteComp.aspectRatio;
    const Cl = Clo / (1 + Clo / (NASAAeroConfig.PI * AR));

    // ===== GESTION DU STALL (DÉCROCHAGE) =====
    let CL: number;
    let CD: number;

    if (alpha > NASAAeroConfig.STALL_ANGLE_RAD) {
      // Post-stall: portance chute, traînée explose
      CL = NASAAeroConfig.CL_MAX * Math.cos(alpha - NASAAeroConfig.STALL_ANGLE_RAD);
      CD = NASAAeroConfig.CD_STALL;
    } else {
      // Régime linéaire (avant stall)
      CL = Cl;

      // ===== TRAÎNÉE (DRAG) - NASA =====
      // Traînée de profil (plaque plane): Cdo = 1.28 × sin(α)
      const Cdo = NASAAeroConfig.FLAT_PLATE_DRAG_COEFF * Math.sin(alpha);

      // Traînée induite (aspect ratio)
      // ΔCd = Cl² / (0.7 × π × AR)
      const e = NASAAeroConfig.RECTANGULAR_WING_EFFICIENCY;
      const inducedDrag = (Cl * Cl) / (e * NASAAeroConfig.PI * AR);

      // Traînée totale
      CD = Cdo + inducedDrag;
    }

    return { CL, CD };
  }
}
