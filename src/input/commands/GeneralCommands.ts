/**
 * GeneralCommands.ts - Commandes générales de l'application
 *
 * Implémentation des commandes pour les contrôles généraux (pause, reset, debug)
 */

import { ICommand, CommandContext } from "./CommandSystem";

/**
 * Commande pour mettre en pause/reprendre la simulation
 */
export class TogglePauseCommand implements ICommand {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  execute(deltaTime: number, intensity?: number): void {
    this.context.simulationState.isPlaying =
      !this.context.simulationState.isPlaying;
    this.context.simulationState.isPaused =
      !this.context.simulationState.isPaused;

    console.log(
      `Simulation ${
        this.context.simulationState.isPlaying ? "reprise" : "mise en pause"
      }`
    );
  }

  canExecute(): boolean {
    return true; // Toujours possible
  }

  getDescription(): string {
    return "Toggle simulation pause";
  }
}

/**
 * Commande pour réinitialiser la simulation
 */
export class ResetSimulationCommand implements ICommand {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  execute(deltaTime: number, intensity?: number): void {
    // Remettre la caméra à sa position initiale
    if (this.context.camera) {
      this.context.camera.position.set(3, 5, 12);
      this.context.camera.lookAt(0, 3, -5);
    }

    // Remettre la barre de contrôle à zéro
    if (
      this.context.physicsEngine &&
      this.context.physicsEngine.getControlBarManager
    ) {
      // this.context.physicsEngine.getControlBarManager().setRotation(0);
    }

    // Autres resets selon les besoins
    console.log("Simulation réinitialisée");
  }

  canExecute(): boolean {
    return true; // Toujours possible
  }

  getDescription(): string {
    return "Reset simulation";
  }
}

/**
 * Commande pour basculer le mode debug
 */
export class ToggleDebugCommand implements ICommand {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  execute(deltaTime: number, intensity?: number): void {
    this.context.simulationState.debugMode =
      !this.context.simulationState.debugMode;
    console.log(
      `Mode debug ${
        this.context.simulationState.debugMode ? "activé" : "désactivé"
      }`
    );
  }

  canExecute(): boolean {
    return true; // Toujours possible
  }

  getDescription(): string {
    return "Toggle debug mode";
  }
}

/**
 * Commande pour basculer l'affichage des éléments de debug visuels
 */
export class ToggleDebugVisualsCommand implements ICommand {
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  execute(deltaTime: number, intensity?: number): void {
    // Cette commande pourrait contrôler l'affichage des flèches de forces,
    // des trajectoires, etc. selon l'implémentation actuelle
    console.log("Debug visuals toggled");
  }

  canExecute(): boolean {
    return this.context.simulationState.debugMode; // Seulement en mode debug
  }

  getDescription(): string {
    return "Toggle debug visuals";
  }
}

/**
 * Commande composite pour gérer les contrôles OrbitControls
 */
export class ToggleOrbitControlsCommand implements ICommand {
  private context: CommandContext;
  private orbitControls: any;

  constructor(context: CommandContext, orbitControls: any) {
    this.context = context;
    this.orbitControls = orbitControls;
  }

  execute(deltaTime: number, intensity?: number): void {
    if (this.orbitControls) {
      this.orbitControls.enabled = !this.orbitControls.enabled;
      console.log(
        `OrbitControls ${this.orbitControls.enabled ? "activés" : "désactivés"}`
      );
    }
  }

  canExecute(): boolean {
    return this.orbitControls !== undefined;
  }

  getDescription(): string {
    return "Toggle OrbitControls";
  }
}
