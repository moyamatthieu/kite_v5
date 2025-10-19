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
  /**
   * Crée toutes les 6 entités brides
   */
  static createAll(): Entity[] {
    return [
      this.createBridle('bridle-ctrl-gauche-nez', 0x333333),
      this.createBridle('bridle-ctrl-gauche-inter', 0x333333),
      this.createBridle('bridle-ctrl-gauche-centre', 0x333333),
      this.createBridle('bridle-ctrl-droit-nez', 0x333333),
      this.createBridle('bridle-ctrl-droit-inter', 0x333333),
      this.createBridle('bridle-ctrl-droit-centre', 0x333333)
    ];
  }

  /**
   * Crée une entité bridle individuelle
   *
   * @param id ID unique de la bridle
   * @param color Couleur de la bridle (hex)
   * @returns Entité bridle
   */
  private static createBridle(id: string, color: number): Entity {
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
    // Les brides sont affichées en gris foncé
    entity.addComponent(new VisualComponent({
      color,
      opacity: 0.8
    }));

    return entity;
  }
}
