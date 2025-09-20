/**
 * InputHandler.ts - Gestion des entrées utilisateur avec Pattern Command
 *
 * Architecture moderne utilisant le pattern Command pour découpler
 * complètement les inputs des actions exécutées
 */

import { PhysicsConstants } from "../physics/PhysicsConstants";
import { INPUT_CONFIG, InputValidator } from "../config/InputConfig";
import {
  ICommand,
  CommandContext,
  CommandExecutor,
  MoveCameraForwardCommand,
  MoveCameraBackwardCommand,
  MoveCameraLeftCommand,
  MoveCameraRightCommand,
  MoveCameraUpCommand,
  MoveCameraDownCommand,
  RotateBarLeftCommand,
  RotateBarRightCommand,
  TogglePauseCommand,
  ResetSimulationCommand,
  ToggleDebugCommand,
  ToggleDebugVisualsCommand,
} from "./commands";
import * as THREE from "three";

export class InputHandler {
  private keysPressed = new Set<string>();
  private focusMode = false; // Nouveau état

  // Système de commandes
  private commandContext: CommandContext;
  private commandExecutor: CommandExecutor;

  // Référence aux contrôles OrbitControls pour les gérer pendant le mouvement clavier
  private orbitControls: any = null;

  private hasRotationInput = false;

  constructor() {
    // Créer le contexte de commandes
    this.commandContext = {
      camera: new THREE.Camera(), // Sera mis à jour plus tard
      physicsEngine: null, // Sera injecté
      renderManager: null, // Sera injecté
      simulationState: {
        isPlaying: true,
        isPaused: false,
        debugMode: false,
      },
      controlState: {
        barRotation: 0, // Rotation initiale de la barre
      },
    };

    // Initialiser le système de commandes
    this.commandExecutor = new CommandExecutor(this.commandContext);

    // Valider la configuration au démarrage
    const conflicts = InputValidator.validateConfig(INPUT_CONFIG);
    if (conflicts.length > 0) {
      console.warn(
        "⚠️ Conflits détectés dans la configuration des contrôles:",
        conflicts
      );
    }

    // Initialiser les bindings de commandes
    this.setupKeyboardControls();
    this.setupKeyListeners();
  }

  private setupKeyListeners(): void {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      this.keysPressed.add(key);

      if (key === "tab") {
        event.preventDefault();
        this.toggleFocusMode();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keysPressed.delete(event.key.toLowerCase());
    });
  }

  private toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
    if (this.orbitControls) {
      this.orbitControls.enabled = !this.focusMode;
    }
    console.log(
      `Mode focus: ${
        this.focusMode
          ? "activé (clavier prioritaire)"
          : "désactivé (souris libre)"
      }`
    );
  }

  /**
   * Définit la référence aux contrôles OrbitControls pour les gérer pendant le mouvement clavier
   */
  setOrbitControls(controls: any): void {
    this.orbitControls = controls;
    controls.enabled = !this.focusMode;
  }

  /**
   * Retourne toutes les touches utilisées par les contrôles (pour preventDefault)
   */
  private getAllControlKeys(): string[] {
    const allKeys: string[] = [];

    // Collecter toutes les touches des contrôles kite
    allKeys.push(INPUT_CONFIG.kite.rotateLeft.primary);
    allKeys.push(...(INPUT_CONFIG.kite.rotateLeft.alternatives || []));
    allKeys.push(INPUT_CONFIG.kite.rotateRight.primary);
    allKeys.push(...(INPUT_CONFIG.kite.rotateRight.alternatives || []));

    // Collecter toutes les touches des contrôles caméra
    allKeys.push(INPUT_CONFIG.camera.moveForward.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveForward.alternatives || []));
    allKeys.push(INPUT_CONFIG.camera.moveBackward.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveBackward.alternatives || []));
    allKeys.push(INPUT_CONFIG.camera.moveLeft.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveLeft.alternatives || []));
    allKeys.push(INPUT_CONFIG.camera.moveRight.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveRight.alternatives || []));
    allKeys.push(INPUT_CONFIG.camera.moveUp.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveUp.alternatives || []));
    allKeys.push(INPUT_CONFIG.camera.moveDown.primary);
    allKeys.push(...(INPUT_CONFIG.camera.moveDown.alternatives || []));

    // Collecter les touches générales
    allKeys.push(INPUT_CONFIG.general.pause.primary);
    allKeys.push(...(INPUT_CONFIG.general.pause.alternatives || []));
    allKeys.push(INPUT_CONFIG.general.reset.primary);
    allKeys.push(...(INPUT_CONFIG.general.reset.alternatives || []));
    allKeys.push(INPUT_CONFIG.general.debug.primary);
    allKeys.push(...(INPUT_CONFIG.general.debug.alternatives || []));
    allKeys.push(INPUT_CONFIG.general.debugVisuals.primary);
    allKeys.push(...(INPUT_CONFIG.general.debugVisuals.alternatives || []));

    return [...new Set(allKeys)]; // Éliminer les doublons
  }

  private setupKeyboardControls(): void {
    const controlKeys = this.getAllControlKeys();

    window.addEventListener("keydown", (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.keysPressed.add(key);

      // Prévenir le comportement par défaut pour toutes les touches de contrôle
      if (controlKeys.includes(key)) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.keysPressed.delete(key);

      // Prévenir le comportement par défaut pour toutes les touches de contrôle
      if (controlKeys.includes(key)) {
        event.preventDefault();
      }
    });
  }

  update(deltaTime: number): void {
    // Exécuter les commandes pour les touches actuellement pressées
    this.executeActiveCommands(deltaTime);
  }

  /**
   * Exécute les commandes associées aux touches actuellement pressées
   * @param deltaTime Temps écoulé depuis la dernière mise à jour
   */
  private executeActiveCommands(deltaTime: number): void {
    this.hasRotationInput = false;

    // Pour chaque touche pressée, exécuter la commande associée
    this.keysPressed.forEach((keyCode) => {
      const command = this.getCommandForKey(keyCode);
      if (command) {
        command.execute(deltaTime, 1.0);

        // Vérifier si c'est une commande de rotation de barre
        if (
          keyCode === INPUT_CONFIG.kite.rotateLeft.primary ||
          keyCode === INPUT_CONFIG.kite.rotateRight.primary
        ) {
          this.hasRotationInput = true;
        }
      }
    });

    if (!this.hasRotationInput) {
      this.commandContext.controlState.barRotation = 0;
    }

    // Centrage automatique géré en resetant target à 0 quand pas d'input, puis ressort physique
  }

  /**
   * Retourne la commande associée à une touche
   * @param keyCode Code de la touche
   * @returns La commande associée ou null
   */
  private getCommandForKey(keyCode: string): ICommand | null {
    // Mapping simple pour l'instant - à améliorer avec un vrai mapper
    switch (keyCode) {
      case INPUT_CONFIG.camera.moveForward.primary:
        return new MoveCameraForwardCommand(this.commandContext);
      case INPUT_CONFIG.camera.moveBackward.primary:
        return new MoveCameraBackwardCommand(this.commandContext);
      case INPUT_CONFIG.camera.moveLeft.primary:
        return new MoveCameraLeftCommand(this.commandContext);
      case INPUT_CONFIG.camera.moveRight.primary:
        return new MoveCameraRightCommand(this.commandContext);
      case INPUT_CONFIG.camera.moveUp.primary:
        return new MoveCameraUpCommand(this.commandContext);
      case INPUT_CONFIG.camera.moveDown.primary:
        return new MoveCameraDownCommand(this.commandContext);
      case INPUT_CONFIG.kite.rotateLeft.primary:
        return new RotateBarLeftCommand(this.commandContext);
      case INPUT_CONFIG.kite.rotateRight.primary:
        return new RotateBarRightCommand(this.commandContext);
      case INPUT_CONFIG.general.pause.primary:
        return new TogglePauseCommand(this.commandContext);
      case INPUT_CONFIG.general.reset.primary:
        return new ResetSimulationCommand(this.commandContext);
      case INPUT_CONFIG.general.debug.primary:
        return new ToggleDebugCommand(this.commandContext);
      case INPUT_CONFIG.general.debugVisuals.primary:
        return new ToggleDebugVisualsCommand(this.commandContext);
      default:
        return null;
    }
  }

  /**
   * Met à jour la position de la caméra en fonction des contrôles
   * @param camera - La caméra Three.js à déplacer
   * @param deltaTime - Temps écoulé depuis la dernière frame
   *
   * Note: Le déplacement de la caméra est maintenant géré directement par les commandes
   * Cette méthode est conservée pour compatibilité mais ne fait plus rien.
   */
  updateCameraPosition(camera: THREE.Camera, deltaTime: number): void {
    // Le déplacement de la caméra est maintenant géré par les commandes CameraCommands
    // Cette méthode est vide pour maintenir la compatibilité de l'interface
  }

  /**
   * Retourne la rotation cible de la barre de contrôle
   * @returns La rotation actuelle de la barre en radians
   */
  getTargetBarRotation(): number {
    return this.commandContext.controlState.barRotation;
  }
}
