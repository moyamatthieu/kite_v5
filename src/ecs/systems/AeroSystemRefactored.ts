/**
 * AeroSystem.ts - Calcul des forces aérodynamiques (modèle personnalisé)
 *
 * Implémentation basée sur la formule de Rayleigh pour plaques planes:
 * - CN = 2 × sin(α) × cos(α) = sin(2α)
 * - CL = CN × CLAlpha (facteur d'échelle pour tuning)
 * - CD calculé selon polar drag
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
import { AeroConfig } from '../config/Config';

export class AeroSystem extends BaseAeroSystem {
  constructor() {
    const PRIORITY = 30;
    super('AeroSystem', PRIORITY);
  }

  /**
   * Calcule les coefficients aérodynamiques selon le modèle de Rayleigh
   *
   * Pour une plaque plane (cerf-volant):
   * - Coefficient normal: CN = 2 × sin(α) × cos(α)
   * - CL = CN × CLAlpha (facteur de tuning)
   * - CD basé sur polar drag: CD0 + k × CL²
   *
   * @param dotNW - Produit scalaire normale · direction vent
   * @param sample - Surface échantillonnée
   * @param aero - Composant aérodynamique
   * @param kiteComp - Composant kite
   * @param localWind - Vent local calculé
   * @returns Coefficients CL et CD
   */
  protected calculateCoefficients(
    dotNW: number,
    sample: SurfaceSample,
    aero: AerodynamicsComponent,
    kiteComp: KiteComponent,
    localWind: LocalWindResult
  ): AeroCoefficients {
    // Angle d'attaque: α = arccos(dotNW)
    // dotNW = cos(α), donc sin(α) = sqrt(1 - cos²(α))
    const cosAlpha = dotNW;
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

    // Coefficient normal pour plaque plane (Rayleigh)
    // CN = 2 × sin(α) × cos(α) = sin(2α)
    const CN = 2.0 * sinAlpha * cosAlpha;

    // Coefficient de portance avec facteur d'échelle
    const CL = CN * aero.coefficients.CLAlpha;

    // Coefficient de traînée basé sur polar drag
    // CD = CD0 + k × CL²
    const CD = this.calculateCD(aero, CL, kiteComp.aspectRatio);

    return { CL, CD };
  }

  /**
   * Calcule le coefficient de traînée (CD) selon la polar drag
   *
   * Modèle: CD = CD0 + k × CL²
   * où k = 1 / (π × AR × e)
   *
   * @param aero - Composant aérodynamique
   * @param CL - Coefficient de portance
   * @param aspectRatio - Allongement du kite
   * @returns Coefficient de traînée
   */
  private calculateCD(
    aero: AerodynamicsComponent,
    CL: number,
    aspectRatio: number
  ): number {
    const CD0 = aero.coefficients.CD0;
    const e = AeroConfig.OSWALD_EFFICIENCY; // Efficacité (typiquement 0.7-0.9)

    // Traînée induite: k = 1 / (π × AR × e)
    const k = 1.0 / (Math.PI * aspectRatio * e);

    // Traînée totale
    const CD = CD0 + k * CL * CL;

    return CD;
  }
}
