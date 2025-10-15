import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { LineComponent } from '@components/LineComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { VisualComponent } from '@components/VisualComponent';
import { TransformComponent } from '@components/TransformComponent';
import { CONFIG } from '@config/SimulationConfig';

export class LineEntityFactory {
  static create(name: 'leftLine' | 'rightLine', attachments: { kitePoint: string; pilotPoint: string }): Entity {
    console.log(`🔧 LineEntityFactory: Creating ${name}`);
    const lineEntity = new Entity(name);
    
    // Composant LineComponent (physique)
    const lineConfig = {
      length: CONFIG.lines.defaultLength,
      stiffness: CONFIG.lines.stiffness,
      preTension: CONFIG.lines.preTension,
      maxTension: CONFIG.lines.maxTension,
      dampingCoeff: CONFIG.lines.dampingCoeff,
      linearMass: CONFIG.lines.linearMassDensity
    };
    lineEntity.addComponent(new LineComponent(lineConfig, attachments));
    
    // Composant Transform
    lineEntity.addComponent(new TransformComponent({ position: new THREE.Vector3() }));
    
    // Composant Geometry (ligne entre 2 points)
    const geometry = new GeometryComponent();
    geometry.setPoint('start', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('end', new THREE.Vector3(0, 0, -CONFIG.lines.defaultLength));
    geometry.addConnection('start', 'end');
    lineEntity.addComponent(geometry);
    console.log(`  ✅ GeometryComponent added with ${geometry.points.size} points`);
    
    // Composant Visual
    const visual = new VisualComponent();
    visual.frameMaterial = {
      color: '#FF0000', // Rouge pour les lignes
      diameter: 0.002 // 2mm de diamètre
    };
    lineEntity.addComponent(visual);
    console.log(`  ✅ VisualComponent added`);
    
    return lineEntity;
  }
}

