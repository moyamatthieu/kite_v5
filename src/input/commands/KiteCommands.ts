/**
 * KiteCommands.ts - Commandes pour le contrôle du cerf-volant
 *
 * Implémentation des commandes de contrôle de la barre du cerf-volant
 */

import { ICommand, CommandContext } from "./CommandSystem";

/**
 * Commande de base pour les contrôles du cerf-volant
 */
abstract class KiteCommand implements ICommand {
  protected context: CommandContext;
  protected rotationSpeed: number = 2.5;
  protected maxRotation: number = Math.PI / 6;

  constructor(context: CommandContext) {
    this.context = context;
  }

  canExecute(): boolean {
    return (
      this.context.physicsEngine !== undefined &&
      this.context.simulationState.isPlaying
    );
  }

  abstract execute(deltaTime: number, intensity?: number): void;

  getDescription(): string {
    return "Kite control command";
  }

  protected applyRotation(deltaTime: number, direction: number): void {
    // Calculer la nouvelle rotation basée sur l'état partagé
    const currentRotation = this.context.controlState.barRotation;
    let newRotation =
      currentRotation + direction * this.rotationSpeed * deltaTime;

    // Limiter la rotation
    newRotation = Math.max(
      -this.maxRotation,
      Math.min(this.maxRotation, newRotation)
    );

    // Mettre à jour l'état partagé
    this.context.controlState.barRotation = newRotation;

    // Appliquer aussi au physics engine si disponible (pour compatibilité)
    if (
      this.context.physicsEngine &&
      this.context.physicsEngine.getControlBarManager
    ) {
      const controlBarManager =
        this.context.physicsEngine.getControlBarManager();
      if (
        controlBarManager &&
        typeof controlBarManager.setRotation === "function"
      ) {
        controlBarManager.setRotation(newRotation);
      }
    }

    console.log(`Rotation barre: ${newRotation.toFixed(3)} rad`);
  }
}

/**
 * Commande pour tourner la barre vers la gauche
 */
export class RotateBarLeftCommand extends KiteCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.applyRotation(deltaTime, 1 * intensity); // 1 = gauche
  }

  getDescription(): string {
    return "Rotate control bar left";
  }
}

/**
 * Commande pour tourner la barre vers la droite
 */
export class RotateBarRightCommand extends KiteCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.applyRotation(deltaTime, -1 * intensity); // -1 = droite
  }

  getDescription(): string {
    return "Rotate control bar right";
  }
}

/**
 * Commande pour centrer la barre automatiquement
 */
export class CenterBarCommand extends KiteCommand {
  private returnSpeed: number = 3.0;

  execute(deltaTime: number, intensity: number = 1): void {
    const currentRotation = this.context.controlState.barRotation;

    if (Math.abs(currentRotation) > 0.001) {
      const direction = -Math.sign(currentRotation);
      const deltaRotation =
        direction * this.returnSpeed * deltaTime * intensity;

      // Vérifier si on dépasse le centre
      const newRotation = currentRotation + deltaRotation;
      if (Math.sign(newRotation) !== Math.sign(currentRotation)) {
        // On a dépassé le centre, s'arrêter à 0
        this.context.controlState.barRotation = 0;
        console.log("Barre centrée");
      } else {
        // Continuer vers le centre
        this.context.controlState.barRotation = newRotation;
        console.log(`Centrage barre: ${newRotation.toFixed(3)} rad`);
      }

      // Appliquer aussi au physics engine si disponible
      if (
        this.context.physicsEngine &&
        this.context.physicsEngine.getControlBarManager
      ) {
        const controlBarManager =
          this.context.physicsEngine.getControlBarManager();
        if (
          controlBarManager &&
          typeof controlBarManager.setRotation === "function"
        ) {
          controlBarManager.setRotation(this.context.controlState.barRotation);
        }
      }
    }
  }

  getDescription(): string {
    return "Center control bar";
  }
}
