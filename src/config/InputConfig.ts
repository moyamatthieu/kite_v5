/**
 * InputConfig.ts - Configuration centralisée des contrôles utilisateur
 *
 * Définit tous les mappings clavier pour éviter les conflits et permettre
 * une personnalisation facile des contrôles
 */

export interface KeyMapping {
  primary: string;
  alternatives?: string[];
}

export interface InputConfigType {
  // Contrôles de la barre du cerf-volant
  kite: {
    rotateLeft: KeyMapping;
    rotateRight: KeyMapping;
  };

  // Contrôles de caméra
  camera: {
    moveForward: KeyMapping;
    moveBackward: KeyMapping;
    moveLeft: KeyMapping;
    moveRight: KeyMapping;
    moveUp: KeyMapping;
    moveDown: KeyMapping;
  };

  // Contrôles généraux
  general: {
    pause: KeyMapping;
    reset: KeyMapping;
    debug: KeyMapping;
    debugVisuals: KeyMapping;
    focusMode: KeyMapping; // Nouveau
  };

  // Paramètres de sensibilité
  sensitivity: {
    kiteRotationSpeed: number;
    kiteReturnSpeed: number;
    kiteMaxRotation: number;
    cameraSpeed: number;
    cameraDamping: number;
  };
}

/**
 * Configuration par défaut des contrôles
 * Compatible avec clavier français (AZERTY)
 */
export const INPUT_CONFIG: InputConfigType = {
  // Contrôles de la barre du cerf-volant
  kite: {
    rotateLeft: {
      primary: "ArrowLeft",
      alternatives: ["a"], // A comme alternative pour clavier QWERTY
    },
    rotateRight: {
      primary: "ArrowRight",
      // Pas d'alternative pour éviter conflit avec caméra
    },
  },

  // Contrôles de caméra (ZQSD pour clavier français)
  camera: {
    moveForward: {
      primary: "z",
      alternatives: ["w"], // W pour clavier QWERTY
    },
    moveBackward: {
      primary: "s",
    },
    moveLeft: {
      primary: "q",
    },
    moveRight: {
      primary: "d",
    },
    moveUp: {
      primary: "ArrowUp",
    },
    moveDown: {
      primary: "ArrowDown",
    },
  },

  // Contrôles généraux
  general: {
    pause: {
      primary: " ",
    },
    reset: {
      primary: "r",
    },
    debug: {
      primary: "F1", // Changé de "d" à "F1" pour éviter conflit avec caméra
    },
    debugVisuals: {
      primary: "F2", // Changé de "v" à "F2" pour cohérence
    },
    focusMode: {
      // Nouveau
      primary: "Tab",
    },
  },

  // Paramètres de sensibilité
  sensitivity: {
    kiteRotationSpeed: 2.5, // radians/seconde
    kiteReturnSpeed: 3.0, // radians/seconde
    kiteMaxRotation: Math.PI / 6, // 30 degrés max
    cameraSpeed: 10, // unités/seconde
    cameraDamping: 0.85, // facteur d'amortissement (0-1)
  },
};

/**
 * Utilitaires pour vérifier les conflits de touches
 */
export class InputValidator {
  /**
   * Vérifie s'il y a des conflits dans la configuration
   */
  static validateConfig(config: InputConfigType): string[] {
    const errors: string[] = [];
    const usedKeys = new Set<string>();

    // Fonction helper pour collecter les touches
    const collectKeys = (mapping: KeyMapping, context: string) => {
      if (usedKeys.has(mapping.primary)) {
        errors.push(`Conflit: ${mapping.primary} utilisé dans ${context}`);
      }
      usedKeys.add(mapping.primary);

      mapping.alternatives?.forEach((alt) => {
        if (usedKeys.has(alt)) {
          errors.push(`Conflit: ${alt} (alternative) utilisé dans ${context}`);
        }
        usedKeys.add(alt);
      });
    };

    // Vérifier tous les mappings
    collectKeys(config.kite.rotateLeft, "kite.rotateLeft");
    collectKeys(config.kite.rotateRight, "kite.rotateRight");
    collectKeys(config.camera.moveForward, "camera.moveForward");
    collectKeys(config.camera.moveBackward, "camera.moveBackward");
    collectKeys(config.camera.moveLeft, "camera.moveLeft");
    collectKeys(config.camera.moveRight, "camera.moveRight");
    collectKeys(config.camera.moveUp, "camera.moveUp");
    collectKeys(config.camera.moveDown, "camera.moveDown");
    collectKeys(config.general.pause, "general.pause");
    collectKeys(config.general.reset, "general.reset");
    collectKeys(config.general.debug, "general.debug");
    collectKeys(config.general.debugVisuals, "general.debugVisuals");
    collectKeys(config.general.focusMode, "general.focusMode"); // Vérification ajoutée

    return errors;
  }

  /**
   * Retourne toutes les touches utilisées par une catégorie
   */
  static getKeysForCategory(
    config: InputConfigType,
    category: keyof InputConfigType
  ): string[] {
    const keys: string[] = [];
    const categoryConfig = config[category] as any;

    if (typeof categoryConfig === "object" && categoryConfig !== null) {
      Object.values(categoryConfig).forEach((mapping: any) => {
        if (mapping && typeof mapping === "object" && "primary" in mapping) {
          keys.push(mapping.primary);
          if (mapping.alternatives) {
            keys.push(...mapping.alternatives);
          }
        }
      });
    }

    return keys;
  }
}
