/**
 * KiteSurfaceDefinition.ts - Définition centralisée des surfaces du kite delta
 *
 * Source unique de vérité pour les 4 surfaces triangulaires du cerf-volant.
 * Centralise la définition pour éviter les duplications et incohérences.
 *
 * ORDRE DES VERTICES CRITIQUE:
 * - Détermine l'orientation des normales (règle de la main droite)
 * - Utilisé par GeometryComponent (rendu 3D) et AeroSystemNASA (calculs aéro)
 * - Doit être identique dans tous les systèmes
 *
 * COORDONNÉES:
 * - X: gauche (+) / droite (-)
 * - Y: haut (+) / bas (-)
 * - Z: avant (+) / arrière (-)
 * - Normales: pointent vers l'EXTÉRIEUR (côté convexe, Z+) pour portance vers le haut
 */

export interface KiteSurfaceDefinition {
  /** Identificateur unique de la surface */
  id: string;
  
  /** Nom lisible de la surface */
  name: string;
  
  /** Points du triangle (ordre critique pour la normale) */
  points: [string, string, string];
  
  /** Description pour documentation */
  description: string;
}

export class KiteSurfaceDefinitions {
  /**
   * Les 4 surfaces du cerf-volant delta
   * 
   * ⚠️ L'ordre des points DOIT rester cohérent partout:
   * - GeometryComponent (rendu 3D)
   * - AerodynamicsComponent (calculs aéro)
   * - Tout autre système utilisant les surfaces
   */
  static readonly SURFACES: KiteSurfaceDefinition[] = [
    {
      id: 'leftUpper',
      name: 'Left Upper Surface',
      points: ['WHISKER_GAUCHE', 'BORD_GAUCHE', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face supérieure du côté gauche - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'leftLower',
      name: 'Left Lower Surface',
      points: ['SPINE_BAS', 'WHISKER_GAUCHE', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face inférieure du côté gauche - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'rightUpper',
      name: 'Right Upper Surface',
      points: ['BORD_DROIT', 'WHISKER_DROIT', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face supérieure du côté droit - Normale pointe vers l\'extérieur et vers le haut'
    },
    {
      id: 'rightLower',
      name: 'Right Lower Surface',
      points: ['WHISKER_DROIT', 'SPINE_BAS', 'NEZ'], // ✅ Ordre corrigé pour normale vers +Y (haut)
      description: 'Face inférieure du côté droit - Normale pointe vers l\'extérieur et vers le haut'
    }
  ];

  /**
   * Récupère toutes les surfaces du kite
   */
  static getAll(): KiteSurfaceDefinition[] {
    return [...this.SURFACES];
  }

  /**
   * Récupère une surface par son ID
   */
  static getById(id: string): KiteSurfaceDefinition | undefined {
    return this.SURFACES.find(s => s.id === id);
  }

  /**
   * Récupère les surfaces du côté gauche
   */
  static getLeftSurfaces(): KiteSurfaceDefinition[] {
    return this.SURFACES.filter(s => s.id.startsWith('left'));
  }

  /**
   * Récupère les surfaces du côté droit
   */
  static getRightSurfaces(): KiteSurfaceDefinition[] {
    return this.SURFACES.filter(s => s.id.startsWith('right'));
  }

  /**
   * Valide que toutes les surfaces sont cohérentes
   * (utile pour les tests et le debug)
   */
  static validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Vérifier que tous les IDs sont uniques
    const ids = this.SURFACES.map(s => s.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      errors.push('❌ Des IDs de surface ne sont pas uniques');
    }

    // Vérifier que tous les noms sont uniques
    const names = this.SURFACES.map(s => s.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      errors.push('❌ Des noms de surface ne sont pas uniques');
    }

    // Vérifier que chaque surface a exactement 3 points
    this.SURFACES.forEach(surface => {
      if (!surface.points || surface.points.length !== 3) {
        errors.push(`❌ Surface ${surface.id}: doit avoir exactement 3 points, en a ${surface.points?.length ?? 0}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
