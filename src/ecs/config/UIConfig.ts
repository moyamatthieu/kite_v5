/**
 * UIConfig.ts - Métadonnées pour l'interface utilisateur
 *
 * Ce fichier contient UNIQUEMENT les métadonnées UI (min, max, step, labels).
 * Toutes les valeurs par défaut proviennent de Config.ts (source unique de vérité).
 */

import { CONFIG } from './Config';

/**
 * Métadonnées UI pour les contrôles (sliders, inputs, etc.)
 * N'utiliser que pour définir les limites et le comportement des contrôles.
 */
export const UI_METADATA = {
  wind: {
    speed: {
      min: 0,
      max: 30,
      step: 0.5,
      unit: 'm/s',
      label: 'Vitesse du vent'
    },
    direction: {
      min: 0,
      max: 359,
      step: 1,
      unit: '°',
      label: 'Direction du vent'
    },
    turbulence: {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      label: 'Turbulence'
    }
  },

  lines: {
    length: {
      min: 5,
      max: 300,
      step: 5,
      unit: 'm',
      label: 'Longueur des lignes'
    },
    bridles: {
      nez: {
        min: 0.5,
        max: 5,
        step: 0.1,
        unit: 'm',
        label: 'Bride nez'
      },
      inter: {
        min: 0.5,
        max: 5,
        step: 0.1,
        unit: 'm',
        label: 'Bride inter'
      },
      centre: {
        min: 0.5,
        max: 5,
        step: 0.1,
        unit: 'm',
        label: 'Bride centre'
      }
    }
  },

  physics: {
    linearDamping: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Amortissement linéaire'
    },
    angularDamping: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Amortissement angulaire'
    }
  },

  aerodynamics: {
    liftScale: {
      min: 0,
      max: 2,
      step: 0.1,
      unit: '',
      label: 'Échelle de portance'
    },
    dragScale: {
      min: 0,
      max: 2,
      step: 0.1,
      unit: '',
      label: 'Échelle de traînée'
    },
    forceSmoothing: {
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      label: 'Lissage des forces'
    }
  },

  render: {
    meshSubdivision: {
      min: 0,
      max: 4,
      step: 1,
      unit: '',
      label: 'Subdivision du mesh'
    }
  }
};

/**
 * Valeurs par défaut pour l'UI - TOUJOURS importées depuis Config.ts
 * Ces getters garantissent que l'UI affiche les valeurs actuelles de la simulation.
 */
export const UI_DEFAULTS = {
  wind: {
    get speed() { return CONFIG.wind.speed; },
    get direction() { return CONFIG.wind.direction; },
    get turbulence() { return CONFIG.wind.turbulence; }
  },

  lines: {
    get length() { return CONFIG.lines.length; },
    bridles: {
      get nez() { return CONFIG.bridles.nez; },
      get inter() { return CONFIG.bridles.inter; },
      get centre() { return CONFIG.bridles.centre; }
    }
  },

  physics: {
    get linearDamping() { return CONFIG.physics.linearDamping; },
    get angularDamping() { return CONFIG.physics.angularDamping; }
  },

  aerodynamics: {
    get liftScale() { return CONFIG.aero.liftScale; },
    get dragScale() { return CONFIG.aero.dragScale; },
    get forceSmoothing() { return CONFIG.aero.forceSmoothing; }
  },

  render: {
    get meshSubdivision() { return CONFIG.render.meshSubdivision; }
  }
};

/**
 * Helper pour récupérer une valeur de configuration avec métadonnées
 */
export function getUIControl(category: string, field: string) {
  const metadata = (UI_METADATA as any)[category]?.[field];
  const defaultValue = (UI_DEFAULTS as any)[category]?.[field];

  return {
    value: defaultValue,
    ...metadata
  };
}
