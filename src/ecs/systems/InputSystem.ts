/**
 * InputSystem.ts - Gestion des entrées clavier
 *
 * Lit le clavier et met à jour InputComponent avec les entrées utilisateur.
 * Priorité 10 (exécuté en premier).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { InputComponent } from '../components/InputComponent';

export class InputSystem extends System {
  private keys: Set<string> = new Set();

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

    // Mettre à jour l'input de rotation depuis le clavier
    // Flèche gauche ou Q = -1 (rotation gauche)
    // Flèche droite ou D = +1 (rotation droite)
    // Aucune touche = 0 (neutre)
    if (this.keys.has('arrowleft') || this.keys.has('q')) {
      inputComp.barRotationInput = -1;
    } else if (this.keys.has('arrowright') || this.keys.has('d')) {
      inputComp.barRotationInput = 1;
    } else {
      inputComp.barRotationInput = 0;
    }
  }


  dispose(): void {
    this.keys.clear();
  }
}
