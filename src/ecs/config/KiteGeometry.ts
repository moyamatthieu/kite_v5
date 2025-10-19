/**
 * KiteGeometry.ts - Géométrie du cerf-volant delta
 * 
 * Définit tous les points structurels du kite en coordonnées locales.
 * Origine = centre géométrique (approximatif).
 */

import * as THREE from 'three';

export class KiteGeometry {
  /**
   * Retourne les points du delta en coordonnées locales
   * 
   * Système de coordonnées Three.js standard :
   * - X : droite/gauche
   * - Y : haut/bas  
   * - Z : avant/arrière (positif = vers l'avant, négatif = vers l'arrière)
   * - Origine : SPINE_BAS (base du kite)
   */
  static getDeltaPoints(): Map<string, THREE.Vector3> {
    const points = new Map<string, THREE.Vector3>();
    
    // Dimensions
    const width = 1.65;  // Envergure
    const height = 0.65; // Hauteur (nez)
    const depth = 0.15;  // Profondeur whiskers (vers l'arrière)
    
    // Points principaux (dans le plan Z=0)
    points.set('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    points.set('NEZ', new THREE.Vector3(0, height, 0));
    points.set('BORD_GAUCHE', new THREE.Vector3(-width / 2, 0, 0));
    points.set('BORD_DROIT', new THREE.Vector3(width / 2, 0, 0));
    
    // CENTRE (25% de la hauteur depuis la base)
    const centreY = height * 0.25;
    points.set('CENTRE', new THREE.Vector3(0, centreY, 0));
    
    // INTER points (intersection barre transversale / bords d'attaque)
    // À hauteur CENTRE, sur les leading edges
    const t = (height - centreY) / height; // = 0.75
    const interX = (width / 2) * t;
    points.set('INTER_GAUCHE', new THREE.Vector3(-interX, centreY, 0));
    points.set('INTER_DROIT', new THREE.Vector3(interX, centreY, 0));
    
    // FIX points (whiskers attachments sur le frame)
    const fixRatio = 2 / 3;
    points.set('FIX_GAUCHE', new THREE.Vector3(-interX * fixRatio, centreY, 0));
    points.set('FIX_DROIT', new THREE.Vector3(interX * fixRatio, centreY, 0));
    
    // WHISKER points (EN ARRIÈRE - Z négatif)
    // Stabilisateurs qui donnent de la profondeur au kite
    points.set('WHISKER_GAUCHE', new THREE.Vector3(-interX * fixRatio, centreY * 0.6, -depth));
    points.set('WHISKER_DROIT', new THREE.Vector3(interX * fixRatio, centreY * 0.6, -depth));
    
    // === POINTS DE CONTRÔLE (CTRL) - EN AVANT ===
    // Points où les lignes s'attachent au kite via les brides
    // Position : devant le kite (Z positif), centrés horizontalement
    const ctrlHeight = 0.3; // 30cm de haut
    const ctrlForward = 0.4; // 40cm en avant (Z positif)
    const ctrlSpacing = 0.3; // 30cm d'espacement
    
    points.set('CTRL_GAUCHE', new THREE.Vector3(-ctrlSpacing / 2, ctrlHeight, ctrlForward));
    points.set('CTRL_DROIT', new THREE.Vector3(ctrlSpacing / 2, ctrlHeight, ctrlForward));
    
    return points;
  }
  
  /**
   * Retourne les connexions (arêtes) du delta
   */
  static getDeltaConnections(): Array<{ from: string; to: string }> {
    return [
      // Bords d'attaque
      { from: 'NEZ', to: 'BORD_GAUCHE' },
      { from: 'NEZ', to: 'BORD_DROIT' },
      
      // Bords de fuite
      { from: 'BORD_GAUCHE', to: 'CENTRE' },
      { from: 'BORD_DROIT', to: 'CENTRE' },
      
      // Spine
      { from: 'NEZ', to: 'SPINE_BAS' },
      { from: 'CENTRE', to: 'SPINE_BAS' },
      
      // Barre transversale
      { from: 'INTER_GAUCHE', to: 'INTER_DROIT' },
      
      // Whiskers
      { from: 'FIX_GAUCHE', to: 'WHISKER_GAUCHE' },
      { from: 'FIX_DROIT', to: 'WHISKER_DROIT' }
    ];
  }
}
