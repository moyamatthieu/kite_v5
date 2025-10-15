/**
 * Kite.ts - Classe pour le cerf-volant delta
 *
 * Implémente un cerf-volant delta basé sur StructuredObject.
 */

import * as THREE from 'three';
import { StructuredObject } from '../core/StructuredObject';
import { Point } from './Point';
import { Position3D } from '../types/index';

export class Kite extends StructuredObject {
  constructor() {
    super('Kite');
    this.init();
  }

  protected definePoints(): void {
    // Points anatomiques du cerf-volant delta
    // Ces points sont calculés par PointFactory et utilisés par les factories
    // Pour l'instant, on définit des points de base
    this.setPoint('SPINE_BAS', [0, 0, 0]);
    this.setPoint('BORD_GAUCHE', [-1, 0, 0]);
    this.setPoint('BORD_DROIT', [1, 0, 0]);
    // ... autres points seraient définis par les factories
  }

  protected buildStructure(): void {
    // Construction du frame rigide
    // Utilise FrameFactory pour créer la structure
  }

  protected buildSurfaces(): void {
    // Construction des surfaces
    // Utilise SurfaceFactory pour créer les surfaces
  }
}