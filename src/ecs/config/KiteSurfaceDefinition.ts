/**
 * KiteSurfaceDefinition.ts - Définition unique et centralisée des surfaces du kite
 * 
 * ✨ ARCHITECTURE: Source unique de vérité pour les surfaces du kite delta
 * 
 * Cette classe centralise la définition des 4 surfaces du kite pour éviter
 * la duplication de données et les incohérences d'ordre de vertices.
 * 
 * L'ordre des vertices est CRITIQUE:
 * - Détermine la direction de la normale (règle de la main droite)
 * - Utilisé par GeometryComponent (rendu) ET AerodynamicsComponent (calculs aéro)
 * - DOIT être identique partout où les surfaces sont utilisées
 * 
 * Système de coordonnées:
 * - X: gauche/droite
 * - Y: haut/bas (vertical)
 * - Z: avant/arrière (positif = avant, négatif = arrière)
 * - Normales: doivent pointer en Z- (vers l'arrière du kite)
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
      points: ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE'],
      description: 'Face supérieure du côté gauche - Forme un triangle avec le nez, whisker gauche et bord d\'attaque gauche'
    },
    {
      id: 'leftLower',
      name: 'Left Lower Surface',
      points: ['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE'],
      description: 'Face inférieure du côté gauche - Forme un triangle avec le nez, épine basse et whisker gauche'
    },
    {
      id: 'rightUpper',
      name: 'Right Upper Surface',
      points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'],
      description: 'Face supérieure du côté droit - Forme un triangle avec le nez, bord d\'attaque droit et whisker droit'
    },
    {
      id: 'rightLower',
      name: 'Right Lower Surface',
      points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'],
      description: 'Face inférieure du côté droit - Forme un triangle avec le nez, whisker droit et épine basse'
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
