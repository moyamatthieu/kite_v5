/**
 * AerodynamicsComponent.ts - Coefficients aérodynamiques
 * 
 * Contient les coefficients pour calculer les forces aéro (lift, drag).
 * Architecture ECS pure : données uniquement, calculs dans AeroSystem.
 */

import { Component } from '../core/Component';

/**
 * Coefficients aérodynamiques en fonction de l'angle d'attaque
 */
export interface AeroCoefficients {
  /** Coefficient de portance (Lift) */
  CL: number;

  /** Coefficient de traînée (Drag) */
  CD: number;

  /** Coefficient de traînée parasite (Drag at zero lift) */
  CD0: number;

  /** Coefficient de moment de tangage (Pitching Moment) */
  CM: number;

  /** Pente dCL/dα (par degré) */
  CLAlpha: number;

  /** Angle d'attaque de portance nulle (degrés) */
  alpha0: number;

  /** Angle d'attaque optimal (degrés) */
  alphaOptimal: number;
}

/**
 * Définition d'un panneau aérodynamique (triangle sur la toile)
 */
export interface AeroSurfaceDescriptor {
  name: string;
  points: [string, string, string];
}

export class AerodynamicsComponent extends Component {
  readonly type = 'aerodynamics';
  
  /** Coefficients aérodynamiques */
  coefficients: AeroCoefficients;
  
  /** Masse volumique de l'air (kg/m³) - 1.225 au niveau de la mer */
  airDensity: number;

  /** Surfaces triangulaires contribuant aux forces */
  surfaces: AeroSurfaceDescriptor[];
  
  constructor(options: {
    coefficients: AeroCoefficients;
    airDensity?: number;
    surfaces?: AeroSurfaceDescriptor[];
  }) {
    super();
    
    const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m³ à 15°C niveau mer
    
    this.coefficients = { ...options.coefficients };
    this.airDensity = options.airDensity ?? AIR_DENSITY_SEA_LEVEL;
    this.surfaces = options.surfaces ? [...options.surfaces] : [];
  }
}
