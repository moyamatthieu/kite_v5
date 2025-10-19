import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { LineComponent } from '@components/LineComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { VisualComponent } from '@components/VisualComponent';
import { TransformComponent } from '@components/TransformComponent';
import { CONFIG } from '@config/SimulationConfig';

export class LineEntityFactory {
  static create(
    name: 'leftLine' | 'rightLine',
    attachments: { kitePoint: string; pilotPoint: string }
  ): Entity {
    const lineEntity = new Entity(name);

    // Composant LineComponent (physique simplifiée)
    const lineConfig = {
      length: CONFIG.lines.defaultLength,
      stiffness: CONFIG.lines.stiffness,
      maxTension: CONFIG.lines.maxTension
    };
    lineEntity.addComponent(new LineComponent(lineConfig, attachments));

    // Composant Transform
    lineEntity.addComponent(new TransformComponent({ position: new THREE.Vector3() }));

    // Composant Geometry (vide pour les lignes dynamiques - géré par LinesRenderSystem)
    const geometry = new GeometryComponent();
    lineEntity.addComponent(geometry);

    // Composant Visual
    const visual = new VisualComponent();
    visual.frameMaterial = {
      color: '#FF0000', // Rouge pour les lignes
      diameter: 0.002 // 2mm de diamètre
    };
    lineEntity.addComponent(visual);

    return lineEntity;
  }
}

