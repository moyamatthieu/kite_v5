/**
 * BridleFactory.ts - Factory pour créer les entités brides
 *
 * Les brides sont créées comme des entités similaires aux lignes,
 * mais avec une géométrie qui représente les cordes reliant le kite au barre.
 */

import * as THREE from 'three';

import { Entity } from '../core/Entity';
import { GeometryComponent, TransformComponent, VisualComponent } from '../components';

/**
 * Crée les 6 entités brides (cordes dynamiques du kite)
 *
 * Les brides relient:
 * - CTRL_GAUCHE: NEZ, INTER_GAUCHE, CENTRE
 * - CTRL_DROIT: NEZ, INTER_DROIT, CENTRE
 *
 * Positions mises à jour par BridleRenderSystem en coordonnées MONDE.
 */
export class BridleFactory {
  // Constante pour la couleur des brides
  private static readonly BRIDLE_COLOR = 0x333333; // Gris foncé
  private static readonly BRIDLE_OPACITY = 0.8;

  // Liste des IDs des bridles à créer
  private static readonly BRIDLE_IDS = [
    'bridle-ctrl-gauche-nez',
    'bridle-ctrl-gauche-inter',
    'bridle-ctrl-gauche-centre',
    'bridle-ctrl-droit-nez',
    'bridle-ctrl-droit-inter',
    'bridle-ctrl-droit-centre'
  ];

  /**
   * Crée toutes les 6 entités brides
   * 
   * @returns Tableau des 6 entités bridles
   */
  static createAll(): Entity[] {
    return this.BRIDLE_IDS.map(id => this.createBridle(id));
  }

  /**
   * Crée une entité bridle individuelle
   *
   * @param id ID unique de la bridle
   * @returns Entité bridle avec tous les composants nécessaires
   */
  private static createBridle(id: string): Entity {
    const entity = new Entity(id);

    // === TRANSFORM (requis pour RenderSystem) ===
    // Position neutre car les positions sont mises à jour en coordonnées MONDE
    entity.addComponent(new TransformComponent({
      position: new THREE.Vector3(0, 0, 0)
    }));

    // === GEOMETRY ===
    // Points seront mis à jour dynamiquement par BridleRenderSystem
    const geometry = new GeometryComponent();
    geometry.setPoint('start', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('end', new THREE.Vector3(0, 1, 0));
    geometry.addConnection('start', 'end');
    entity.addComponent(geometry);

    // === VISUAL ===
    // Les brides sont affichées en gris foncé avec légère transparence
    entity.addComponent(new VisualComponent({
      color: this.BRIDLE_COLOR,
      opacity: this.BRIDLE_OPACITY
    }));

    return entity;
  }
}
