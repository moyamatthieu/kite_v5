import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { GeometryComponent } from '@components/GeometryComponent';
import { VisualComponent } from '@components/VisualComponent';
import { BridleComponent } from '@components/BridleComponent';
import { AerodynamicsComponent } from '@components/AerodynamicsComponent';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { KiteComponent } from '@components/KiteComponent';
import { CONFIG } from '@config/SimulationConfig';
import { MathUtils } from '@utils/MathUtils';

export class KiteEntityFactory {
  static create(controlBarPosition: THREE.Vector3): Entity {
    const kiteEntity = new Entity('kite');
    const kitePosition = MathUtils.calculateInitialKitePosition(
      controlBarPosition,
      CONFIG.initialization.initialKiteY,
      CONFIG.lines.defaultLength,
      CONFIG.initialization.initialDistanceFactor,
      CONFIG.initialization.initialKiteZ
    );

    // Composant Transform
    kiteEntity.addComponent(new TransformComponent({ position: kitePosition }));

    // Composant Geometry
    const geometry = new GeometryComponent();
    geometry.setPoint('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('CENTRE', new THREE.Vector3(0, 0.325, 0));
    geometry.setPoint('NEZ', new THREE.Vector3(0, 0.65, 0));
    geometry.setPoint('BORD_GAUCHE', new THREE.Vector3(-0.825, 0, 0));
    geometry.setPoint('BORD_DROIT', new THREE.Vector3(0.825, 0, 0));
    geometry.setPoint('INTER_GAUCHE', new THREE.Vector3(-0.4125, 0.325, 0));
    geometry.setPoint('INTER_DROIT', new THREE.Vector3(0.4125, 0.325, 0));
    geometry.setPoint('FIX_GAUCHE', new THREE.Vector3(-0.275, 0.325, 0));
    geometry.setPoint('FIX_DROIT', new THREE.Vector3(0.275, 0.325, 0));
    geometry.setPoint('WHISKER_GAUCHE', new THREE.Vector3(-0.20625, 0.1, -0.1));
    geometry.setPoint('WHISKER_DROIT', new THREE.Vector3(0.20625, 0.1, -0.1));
    geometry.setPoint('CTRL_GAUCHE', new THREE.Vector3(-0.2, 0.4, 0));
    geometry.setPoint('CTRL_DROIT', new THREE.Vector3(0.2, 0.4, 0));
    geometry.addConnection('NEZ', 'SPINE_BAS');
    geometry.addConnection('NEZ', 'BORD_GAUCHE');
    geometry.addConnection('NEZ', 'BORD_DROIT');
    geometry.addConnection('INTER_GAUCHE', 'INTER_DROIT');
    geometry.addConnection('WHISKER_GAUCHE', 'FIX_GAUCHE');
    geometry.addConnection('WHISKER_DROIT', 'FIX_DROIT');
    geometry.addSurface(['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE']);
    geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS']);
    geometry.addSurface(['NEZ', 'BORD_DROIT', 'WHISKER_DROIT']);
    geometry.addSurface(['NEZ', 'WHISKER_DROIT', 'SPINE_BAS']);
    kiteEntity.addComponent(geometry);

    // Composant Visual
    const visual = new VisualComponent();
    visual.frameMaterial = { color: '#333333', diameter: 0.005 };
    visual.surfaceMaterial = { color: '#ffffff', opacity: 0.9, transparent: true, doubleSided: true };
    kiteEntity.addComponent(visual);

    // Composant Bridle
    const bridle = new BridleComponent();
    bridle.lengths = { ...CONFIG.bridle.defaultLengths };
    kiteEntity.addComponent(bridle);

    // Composant Aerodynamics
    kiteEntity.addComponent(new AerodynamicsComponent());

    // Composant Physics
    kiteEntity.addComponent(new PhysicsComponent({
      mass: CONFIG.kite.mass,
      inertia: CONFIG.kite.inertia,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3()
    }));

    // Composant KiteComponent - requis par KitePhysicsSystem
    const kitePoints = new Map<string, THREE.Vector3>();
    geometry.points.forEach((point, name) => {
      kitePoints.set(name, point.clone());
    });
    
    const kiteSurfaces = geometry.surfaces.map(surface => {
      const vertices = surface.points.map((name: string) => geometry.getPoint(name)!);
      // Calcul simple de l'aire du triangle
      const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
      const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
      const area = v1.cross(v2).length() / 2;
      // Calcul du centroïde
      const centroid = new THREE.Vector3()
        .add(vertices[0])
        .add(vertices[1])
        .add(vertices[2])
        .divideScalar(3);
      return {
        vertices: [vertices[0], vertices[1], vertices[2]] as [THREE.Vector3, THREE.Vector3, THREE.Vector3],
        area,
        centroid
      };
    });
    kiteEntity.addComponent(new KiteComponent(kitePoints, kiteSurfaces));

    return kiteEntity;
  }
}
