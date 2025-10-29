/**
 * InputSystem.ts - Gestion des entrées clavier
 *
 * Lit le clavier et met à jour InputComponent avec les entrées utilisateur.
 * Priorité 10 (exécuté en premier).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { InputComponent } from '../components/InputComponent';
import { Logger } from '../utils/Logging';

export class InputSystem extends System {
  private keys: Set<string> = new Set();
  private logger = Logger.getInstance();

  constructor() {
    super('InputSystem', 10);
  }

  initialize(): void {
    // Écoute clavier
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  update(context: SimulationContext): void {
    const { entityManager } = context;

    // Récupérer InputComponent
    const uiEntity = entityManager.query(['Input'])[0];
    if (!uiEntity) return;

    const inputComp = uiEntity.getComponent<InputComponent>('Input');
    if (!inputComp) return;

    // Initialiser l'input à 0 (neutre)
    inputComp.barRotationInput = 0;

    // Mettre à jour l'input de rotation depuis le clavier
    // INVERSÉ pour correspondre à l'intuition du pilote :
    // Flèche gauche ou Q = +1 (rotation droite de la barre = cerf-volant va à gauche)
    // Flèche droite ou D = -1 (rotation gauche de la barre = cerf-volant va à droite)
    if (this.keys.has('arrowleft') || this.keys.has('q')) {
      inputComp.barRotationInput = 1;
      this.logger.debug(`⬅️  Arrow Left/Q detected - barRotationInput = ${inputComp.barRotationInput}`, 'InputSystem');
    } else if (this.keys.has('arrowright') || this.keys.has('d')) {
      inputComp.barRotationInput = -1;
      this.logger.debug(`➡️  Arrow Right/D detected - barRotationInput = ${inputComp.barRotationInput}`, 'InputSystem');
    } else {
      // Si aucune touche n'est pressée, l'input reste à 0 (géré par l'initialisation)
      if (inputComp.barRotationInput !== 0) {
        this.logger.debug(`🔲 No input - barRotationInput reset to 0`, 'InputSystem');
      }
    }
  }


  dispose(): void {
    this.keys.clear();
  }
}
