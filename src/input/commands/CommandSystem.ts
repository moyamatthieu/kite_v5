/**
 * CommandSystem.ts - Système de commandes pour découpler inputs et actions
 *
 * Pattern Command moderne pour une architecture maintenable et testable
 */

import * as THREE from "three";

/**
 * Interface de base pour toutes les commandes
 * Définit le contrat pour exécuter et annuler des actions
 */
export interface ICommand {
  /**
   * Exécute la commande
   * @param deltaTime - Temps écoulé depuis la dernière exécution
   * @param intensity - Intensité de l'action (0-1, pour les inputs analogiques)
   */
  execute(deltaTime: number, intensity?: number): void;

  /**
   * Annule l'effet de la commande (optionnel, pour undo/redo)
   */
  undo?(): void;

  /**
   * Retourne une description de la commande pour le debug
   */
  getDescription(): string;

  /**
   * Indique si la commande peut être exécutée dans le contexte actuel
   */
  canExecute(): boolean;
}

/**
 * État d'une commande pour gérer les transitions
 */
export enum CommandState {
  IDLE = "idle",
  EXECUTING = "executing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Contexte d'exécution pour les commandes
 * Permet de partager l'état entre commandes
 */
export interface CommandContext {
  camera: THREE.Camera;
  physicsEngine: any; // Type à affiner selon l'interface réelle
  renderManager: any; // Type à affiner selon l'interface réelle
  simulationState: {
    isPlaying: boolean;
    isPaused: boolean;
    debugMode: boolean;
  };
  // État partagé pour les contrôles
  controlState: {
    barRotation: number; // Rotation actuelle de la barre de contrôle
  };
}

/**
 * Exécuteur de commandes avec gestion des priorités et conflits
 */
export class CommandExecutor {
  private context: CommandContext;
  private activeCommands: Map<string, ICommand> = new Map();
  private commandQueue: Array<{
    command: ICommand;
    priority: number;
    id: string;
  }> = [];
  private maxConcurrentCommands = 10;

  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * Exécute une commande avec gestion des priorités
   */
  executeCommand(command: ICommand, priority: number = 0, id?: string): void {
    const commandId = id || this.generateCommandId(command);

    // Vérifier si la commande peut être exécutée
    if (!command.canExecute()) {
      console.warn(
        `Commande ${command.getDescription()} ne peut pas être exécutée`
      );
      return;
    }

    // Gérer la file d'attente si on atteint la limite
    if (this.activeCommands.size >= this.maxConcurrentCommands) {
      this.commandQueue.push({ command, priority, id: commandId });
      this.commandQueue.sort((a, b) => b.priority - a.priority); // Priorité décroissante
      return;
    }

    // Exécuter la commande
    this.activeCommands.set(commandId, command);
    command.execute(0, 1); // Exécution initiale
  }

  /**
   * Met à jour toutes les commandes actives
   */
  update(deltaTime: number): void {
    // Traiter les commandes en attente si de la place se libère
    while (
      this.commandQueue.length > 0 &&
      this.activeCommands.size < this.maxConcurrentCommands
    ) {
      const queued = this.commandQueue.shift();
      if (queued) {
        this.executeCommand(queued.command, queued.priority, queued.id);
      }
    }

    // Mettre à jour les commandes actives (si elles supportent les updates continus)
    for (const [id, command] of this.activeCommands) {
      if (typeof (command as any).update === "function") {
        (command as any).update(deltaTime);
      }
    }
  }

  /**
   * Arrête une commande spécifique
   */
  stopCommand(commandId: string): void {
    const command = this.activeCommands.get(commandId);
    if (command && command.undo) {
      command.undo();
    }
    this.activeCommands.delete(commandId);
  }

  /**
   * Arrête toutes les commandes
   */
  stopAllCommands(): void {
    for (const [id, command] of this.activeCommands) {
      if (command.undo) {
        command.undo();
      }
    }
    this.activeCommands.clear();
    this.commandQueue.length = 0;
  }

  /**
   * Met à jour le contexte partagé
   */
  updateContext(newContext: Partial<CommandContext>): void {
    Object.assign(this.context, newContext);
  }

  private generateCommandId(command: ICommand): string {
    return `${command.getDescription()}_${Date.now()}_${Math.random()}`;
  }

  /**
   * Retourne les statistiques des commandes pour le debug
   */
  getStats(): { active: number; queued: number; total: number } {
    return {
      active: this.activeCommands.size,
      queued: this.commandQueue.length,
      total: this.activeCommands.size + this.commandQueue.length,
    };
  }
}

/**
 * Mappeur pour lier les inputs aux commandes
 * Gère les conflits et les combinaisons d'inputs
 */
export class InputCommandMapper {
  private keyBindings: Map<string, ICommand> = new Map();
  private axisBindings: Map<string, ICommand> = new Map();
  private context: CommandContext;
  private executor: CommandExecutor;

  constructor(context: CommandContext, executor: CommandExecutor) {
    this.context = context;
    this.executor = executor;
  }

  /**
   * Lie une touche à une commande
   */
  bindKey(key: string, command: ICommand, priority: number = 0): void {
    this.keyBindings.set(key.toLowerCase(), command);
  }

  /**
   * Lie un axe (gamepad) à une commande
   */
  bindAxis(axis: string, command: ICommand): void {
    this.axisBindings.set(axis, command);
  }

  /**
   * Traite un événement clavier
   */
  handleKeyEvent(
    key: string,
    isPressed: boolean,
    modifiers: { ctrl: boolean; shift: boolean; alt: boolean } = {
      ctrl: false,
      shift: false,
      alt: false,
    }
  ): void {
    const command = this.keyBindings.get(key.toLowerCase());
    if (command) {
      if (isPressed) {
        this.executor.executeCommand(command, 0, `key_${key}`);
      } else {
        // Pour les commandes continues, on pourrait gérer le relâchement ici
        this.executor.stopCommand(`key_${key}`);
      }
    }
  }

  /**
   * Traite un événement d'axe (gamepad)
   */
  handleAxisEvent(axis: string, value: number): void {
    const command = this.axisBindings.get(axis);
    if (command && Math.abs(value) > 0.1) {
      // Seuil pour éviter les vibrations
      this.executor.executeCommand(command, 0, `axis_${axis}`);
    }
  }

  /**
   * Recharge les bindings (utile pour la reconfiguration)
   */
  reloadBindings(bindings: {
    keys: Record<string, ICommand>;
    axes?: Record<string, ICommand>;
  }): void {
    this.keyBindings.clear();
    this.axisBindings.clear();

    // Recharger les bindings clavier
    Object.entries(bindings.keys).forEach(([key, command]) => {
      this.bindKey(key, command);
    });

    // Recharger les bindings d'axes
    if (bindings.axes) {
      Object.entries(bindings.axes).forEach(([axis, command]) => {
        this.bindAxis(axis, command);
      });
    }
  }

  /**
   * Vérifie les conflits dans les bindings
   */
  validateBindings(): { conflicts: string[]; warnings: string[] } {
    const conflicts: string[] = [];
    const warnings: string[] = [];
    const usedKeys = new Set<string>();

    for (const [key, command] of this.keyBindings) {
      if (usedKeys.has(key)) {
        conflicts.push(`Conflit sur la touche '${key}'`);
      }
      usedKeys.add(key);
    }

    return { conflicts, warnings };
  }
}
