/**
 * VisualComponent.ts - Composant de données visuelles
 *
 * Contient toutes les spécifications visuelles d'un objet (couleurs, opacités, etc.)
 * sans référence à Three.js. Le RenderSystem utilisera ces données pour créer
 * les matériaux et la géométrie Three.js.
 *
 * Architecture ECS pure : données séparées de la logique de rendu.
 */

import { Component } from '@base/Component';

/**
 * Configuration matériau pour les frames/structures
 */
export interface FrameMaterialConfig {
  color: string;
  diameter: number;
}

/**
 * Configuration matériau pour les surfaces/toiles
 */
export interface SurfaceMaterialConfig {
  color: string;
  opacity: number;
  transparent: boolean;
  doubleSided: boolean;
}

/**
 * Composant contenant les spécifications visuelles
 */
export class VisualComponent implements Component {
  readonly type = 'visual';

  /**
   * Configuration visuelle des frames/structures
   */
  public frameMaterial: FrameMaterialConfig;

  /**
   * Configuration visuelle des surfaces/toiles
   */
  public surfaceMaterial: SurfaceMaterialConfig;

  /**
   * Configuration visuelle des whiskers (optionnel)
   */
  public whiskerMaterial?: FrameMaterialConfig;

  /**
   * Configuration visuelle des brides (optionnel)
   */
  public bridleMaterial?: {
    color: string;
    opacity: number;
    linewidth: number;
  };

  /**
   * Afficher les marqueurs de debug aux points clés
   */
  public showDebugMarkers: boolean;

  /**
   * Couleurs des marqueurs de debug
   */
  public debugMarkerColors: Map<string, string>;  // Nom point -> couleur

  constructor(data: {
    frameMaterial?: Partial<FrameMaterialConfig>;
    surfaceMaterial?: Partial<SurfaceMaterialConfig>;
    whiskerMaterial?: Partial<FrameMaterialConfig>;
    bridleMaterial?: Partial<{ color: string; opacity: number; linewidth: number }>;
    showDebugMarkers?: boolean;
    debugMarkerColors?: Map<string, string>;
  } = {}) {
    // Frame par défaut
    this.frameMaterial = {
      color: data.frameMaterial?.color || '#2a2a2a',
      diameter: data.frameMaterial?.diameter || 0.01
    };

    // Surface par défaut
    this.surfaceMaterial = {
      color: data.surfaceMaterial?.color || '#ff3333',
      opacity: data.surfaceMaterial?.opacity ?? 0.9,
      transparent: data.surfaceMaterial?.transparent ?? true,
      doubleSided: data.surfaceMaterial?.doubleSided ?? true
    };

    // Whisker par défaut (plus fin que frame principal)
    this.whiskerMaterial = data.whiskerMaterial ? {
      color: data.whiskerMaterial.color || '#444444',
      diameter: data.whiskerMaterial.diameter || 0.005
    } : undefined;

    // Bridle par défaut
    this.bridleMaterial = data.bridleMaterial ? {
      color: data.bridleMaterial.color || '#333333',
      opacity: data.bridleMaterial.opacity ?? 0.8,
      linewidth: data.bridleMaterial.linewidth || 1
    } : undefined;

    this.showDebugMarkers = data.showDebugMarkers ?? false;
    this.debugMarkerColors = data.debugMarkerColors || new Map([
      ['NEZ', '#ff0000'],
      ['CTRL_GAUCHE', '#dc143c'],
      ['CTRL_DROIT', '#b22222']
    ]);
  }

  /**
   * Clone le composant
   */
  clone(): VisualComponent {
    return new VisualComponent({
      frameMaterial: { ...this.frameMaterial },
      surfaceMaterial: { ...this.surfaceMaterial },
      whiskerMaterial: this.whiskerMaterial ? { ...this.whiskerMaterial } : undefined,
      bridleMaterial: this.bridleMaterial ? { ...this.bridleMaterial } : undefined,
      showDebugMarkers: this.showDebugMarkers,
      debugMarkerColors: new Map(this.debugMarkerColors)
    });
  }
}
