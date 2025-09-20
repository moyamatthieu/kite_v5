/**
 * CameraCommands.ts - Commandes pour le contrôle de la caméra
 *
 * Implémentation des commandes de mouvement de caméra avec le pattern Command
 */

import { ICommand, CommandContext } from "./CommandSystem";
import * as THREE from "three";

/**
 * Commande de base pour les mouvements de caméra
 */
abstract class CameraCommand implements ICommand {
  protected context: CommandContext;
  protected velocity: THREE.Vector3 = new THREE.Vector3();
  protected damping: number = 0.85;
  protected speed: number = 10;

  constructor(context: CommandContext) {
    this.context = context;
  }

  abstract execute(deltaTime: number, intensity?: number): void;

  canExecute(): boolean {
    return this.context.camera !== undefined;
  }

  getDescription(): string {
    return `Camera movement command`;
  }

  protected applyMovement(deltaTime: number): void {
    if (this.velocity.lengthSq() > 0.001) {
      // Utiliser les axes locaux de la caméra pour un mouvement naturel
      const right = new THREE.Vector3(1, 0, 0);
      const up = new THREE.Vector3(0, 1, 0);
      const forward = new THREE.Vector3(0, 0, -1);

      // Appliquer la rotation de la caméra aux vecteurs locaux
      right.applyQuaternion(this.context.camera.quaternion);
      up.applyQuaternion(this.context.camera.quaternion);
      forward.applyQuaternion(this.context.camera.quaternion);

      // Calculer le déplacement dans l'espace monde
      const displacement = new THREE.Vector3();
      displacement.addScaledVector(right, this.velocity.x * deltaTime);
      displacement.addScaledVector(up, this.velocity.y * deltaTime);
      displacement.addScaledVector(forward, this.velocity.z * deltaTime);

      // Appliquer le déplacement
      this.context.camera.position.add(displacement);

      // Appliquer l'amortissement
      this.velocity.multiplyScalar(this.damping);
    }
  }
}

/**
 * Commande pour déplacer la caméra vers l'avant
 */
export class MoveCameraForwardCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.z = -this.speed * intensity; // Z négatif = avancer
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera forward";
  }
}

/**
 * Commande pour déplacer la caméra vers l'arrière
 */
export class MoveCameraBackwardCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.z = this.speed * intensity; // Z positif = reculer
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera backward";
  }
}

/**
 * Commande pour déplacer la caméra vers la gauche
 */
export class MoveCameraLeftCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.x = -this.speed * intensity; // X négatif = gauche
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera left";
  }
}

/**
 * Commande pour déplacer la caméra vers la droite
 */
export class MoveCameraRightCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.x = this.speed * intensity; // X positif = droite
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera right";
  }
}

/**
 * Commande pour déplacer la caméra vers le haut
 */
export class MoveCameraUpCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.y = this.speed * intensity; // Y positif = haut
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera up";
  }
}

/**
 * Commande pour déplacer la caméra vers le bas
 */
export class MoveCameraDownCommand extends CameraCommand {
  execute(deltaTime: number, intensity: number = 1): void {
    this.velocity.y = -this.speed * intensity; // Y négatif = bas
    this.applyMovement(deltaTime);
  }

  getDescription(): string {
    return "Move camera down";
  }
}
