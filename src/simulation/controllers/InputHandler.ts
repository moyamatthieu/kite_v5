/**
 * InputHandler.ts - Gestionnaire des entrées utilisateur pour la simulation Kite
 *
 * Rôle :
 *   - Gère les contrôles clavier pour piloter le cerf-volant
 *   - Traduit les actions utilisateur en rotation de la barre de contrôle
 *   - Sert d'interface entre l'utilisateur et le système de contrôle
 *
 * Dépendances principales :
 *   - PhysicsConstants.ts : Paramètres et limites pour la gestion des entrées
 *
 * Relation avec les fichiers adjacents :
 *   - Utilisé par ControlBarManager et PhysicsEngine pour appliquer les commandes utilisateur
 *
 * Utilisation typique :
 *   - Instancié au démarrage, écoute les événements clavier pour piloter le kite
 *   - Sert à la visualisation et au contrôle du kite
 *
 * Voir aussi :
 *   - src/simulation/controllers/ControlBarManager.ts
 *   - src/simulation/physics/PhysicsEngine.ts
 */
import { PhysicsConstants } from "../config/PhysicsConstants";

/**
 * Gestionnaire des entrées utilisateur
 *
 * Gère les contrôles clavier pour piloter le cerf-volant
 */
export class InputHandler {
  private currentRotation: number = 0;
  private keysPressed = new Set<string>();
  private rotationSpeed: number = 2.5;
  private returnSpeed: number = 3.0;
  private maxRotation: number = Math.PI / 6;

  constructor() {
    this.setupKeyboardControls();
  }

  private setupKeyboardControls(): void {
    window.addEventListener("keydown", (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.keysPressed.add(key);

      if (
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "q" ||
        key === "a" ||
        key === "d"
      ) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      this.keysPressed.delete(key);

      if (
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "q" ||
        key === "a" ||
        key === "d"
      ) {
        event.preventDefault();
      }
    });
  }

  update(deltaTime: number): void {
    const left =
      this.keysPressed.has("ArrowLeft") ||
      this.keysPressed.has("q") ||
      this.keysPressed.has("a");
    const right =
      this.keysPressed.has("ArrowRight") || this.keysPressed.has("d");
    const dir = (left ? 1 : 0) + (right ? -1 : 0);

    if (dir !== 0) {
      this.currentRotation += dir * this.rotationSpeed * deltaTime;
    } else {
      if (Math.abs(this.currentRotation) > PhysicsConstants.EPSILON) {
        const sign = Math.sign(this.currentRotation);
        this.currentRotation -= sign * this.returnSpeed * deltaTime;
        if (Math.sign(this.currentRotation) !== sign) {
          this.currentRotation = 0;
        }
      } else {
        this.currentRotation = 0;
      }
    }

    this.currentRotation = Math.max(
      -this.maxRotation,
      Math.min(this.maxRotation, this.currentRotation)
    );
  }

  getTargetBarRotation(): number {
    return this.currentRotation;
  }
}