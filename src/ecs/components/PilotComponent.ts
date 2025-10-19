/**
 * PilotComponent.ts - Composant de données pour le retour haptique du pilote
 * 
 * Stocke les informations de retour haptique que le pilote ressent via les lignes.
 * Ce composant contient uniquement des données, pas de logique.
 * 
 * Architecture ECS :
 * - Données pures uniquement (POJO)
 * - Mis à jour par le PilotSystem
 * - Utilisé pour le retour visuel/UI et éventuellement des dispositifs haptiques
 */

/**
 * Composant de feedback haptique du pilote
 */
export class PilotComponent {
  readonly type = 'pilot';
  
  /**
   * Tensions brutes actuelles des lignes (N)
   * Valeurs instantanées sans filtrage
   */
  leftHandRawTension: number = 0;
  rightHandRawTension: number = 0;
  
  /**
   * Tensions filtrées pour un retour haptique lisse (N)
   * Simulent l'élasticité du système + retard de perception
   */
  leftHandFilteredTension: number = 0;
  rightHandFilteredTension: number = 0;
  
  /**
   * Asymétrie de tension entre gauche et droite (%)
   * 0% = équilibré, 100% = totalement asymétrique
   */
  asymmetry: number = 0;
  
  /**
   * Côté dominant détecté
   * Utile pour déterminer la direction du virage
   */
  dominantSide: 'left' | 'right' | 'neutral' = 'neutral';
  
  /**
   * Magnitude totale du feedback (moyenne des tensions) (N)
   */
  totalFeedbackMagnitude: number = 0;
  
  /**
   * Taux de changement des tensions (N/s)
   * Détecte les accélérations/décélérations brusques
   */
  leftHandTensionDelta: number = 0;
  rightHandTensionDelta: number = 0;
  
  /**
   * État détecté du vol
   */
  state: 'idle' | 'powered' | 'turning_left' | 'turning_right' | 'stall' = 'idle';
  
  /**
   * Facteur de filtrage (0-1)
   * 0 = pas de filtrage, 1 = filtrage maximal
   * Valeur recommandée : 0.15 (environ 15ms de lag à 60fps)
   */
  filteringFactor: number = 0.15;
  
  /**
   * Timestamp de la dernière mise à jour (ms)
   */
  lastUpdateTime: number = 0;
}
