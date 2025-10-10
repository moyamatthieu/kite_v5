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
import { CONFIG } from "../config/SimulationConfig";

/**
 * Gestionnaire des entrées utilisateur
 *
 * Gère les contrôles clavier pour piloter le cerf-volant
 */
export class InputHandler {
  private currentRotation: number = 0;
  private targetRotation: number = 0;  // Rotation cible (instantanée)
  private smoothingFactor: number = 0.15;  // Facteur de lissage (0=pas de smooth, 1=instantané)
  private keysPressed = new Set<string>();
  private rotationSpeed: number = CONFIG.input.rotationSpeed;
  private returnSpeed: number = CONFIG.input.returnSpeed;
  private maxRotation: number = CONFIG.input.maxRotation;

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

    // Mettre à jour la rotation cible (instantanée)
    if (dir !== 0) {
      this.targetRotation += dir * this.rotationSpeed * deltaTime;
    } else {
      // Retour au centre progressif
      if (Math.abs(this.targetRotation) > PhysicsConstants.EPSILON) {
        const sign = Math.sign(this.targetRotation);
        this.targetRotation -= sign * this.returnSpeed * deltaTime;
        if (Math.sign(this.targetRotation) !== sign) {
          this.targetRotation = 0;
        }
      } else {
        this.targetRotation = 0;
      }
    }

    // Limiter la rotation cible
    this.targetRotation = Math.max(
      -this.maxRotation,
      Math.min(this.maxRotation, this.targetRotation)
    );

    // Appliquer le smoothing (lerp) : rotation actuelle → rotation cible
    // Plus le smoothingFactor est grand, plus le mouvement est réactif
    // smoothingFactor=1 → instantané, smoothingFactor=0.1 → très smooth
    this.currentRotation = this.lerp(
      this.currentRotation,
      this.targetRotation,
      this.smoothingFactor
    );

    // Si proche de zéro, snap à zéro pour éviter les oscillations
    if (Math.abs(this.currentRotation) < PhysicsConstants.EPSILON) {
      this.currentRotation = 0;
    }
  }

  /**
   * Interpolation linéaire (lerp) pour smoothing
   * @param current - Valeur actuelle
   * @param target - Valeur cible
   * @param factor - Facteur d'interpolation (0-1)
   * @returns Valeur interpolée
   */
  private lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor;
  }

  getTargetBarRotation(): number {
    return this.currentRotation;
  }
}