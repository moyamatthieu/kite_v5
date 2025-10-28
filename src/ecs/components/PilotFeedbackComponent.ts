import { Component } from '@base/Component';

export class PilotFeedbackComponent implements Component {
  readonly type = 'pilotFeedback';

  /**
   * Tensions BRUTES des lignes (pas filtrées) - reçues chaque frame
   */
  leftHandRawTension: number = 0; // N
  rightHandRawTension: number = 0; // N

  /**
   * ✅ PHASE 2.3 : Tensions FILTRÉES (filtrage inertiel)
   * Simulent l'élasticité du système entier + retard haptique
   * Utilisées pour retour haptique lisses (sans "sec à sec")
   */
  leftHandFilteredTension: number = 0; // N
  rightHandFilteredTension: number = 0; // N

  /**
   * Asymétrie de tension entre gauche et droite (%)
   * 0% = équilibré, 100% = complètement asymétrique
   */
  asymmetry: number = 0; // %

  /**
   * Côté dominant détecté par le pilote
   * Utile pour déterminer direction du virage
   */
  dominantSide: 'left' | 'right' | 'neutral' = 'neutral';

  /**
   * Magnitude totale du feedback (moyenne des deux tensions)
   * Utile pour "puissance" globale du retour haptique
   */
  totalFeedbackMagnitude: number = 0; // N

  /**
   * Taux de changement des tensions (peut détecter accélération aérodynamique)
   */
  leftHandTensionDelta: number = 0; // N/s
  rightHandTensionDelta: number = 0; // N/s

  /**
   * État détecté
   */
  state: 'idle' | 'powered' | 'turning_left' | 'turning_right' | 'stall' = 'idle';

  /**
   * Timestamp du dernier update pour calcul Delta
   */
  lastUpdateTime: number = Date.now();

  /**
   * Constante de filtrage (0-1)
   * 0 = pas de filtrage (direct)
   * 1 = filtrage maximal (très lisse)
   * Valeur recommandée : 0.15 (15ms de lag à 60fps)
   */
  filteringFactor: number = 0.15;

  constructor() {
  }

  /**
   * Réinitialise le composant
   */
  reset(): void {
    this.leftHandRawTension = 0;
    this.rightHandRawTension = 0;
    this.leftHandFilteredTension = 0;
    this.rightHandFilteredTension = 0;
    this.asymmetry = 0;
    this.dominantSide = 'neutral';
    this.totalFeedbackMagnitude = 0;
    this.leftHandTensionDelta = 0;
    this.rightHandTensionDelta = 0;
    this.state = 'idle';
    this.lastUpdateTime = Date.now();
  }
}
