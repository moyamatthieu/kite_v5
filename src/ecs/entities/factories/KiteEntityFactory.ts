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
    
    // Géométrie du delta - basée sur la branche main (PointFactory)
    // Paramètres de base
    const width = 1.65;      // Envergure (distance BORD_GAUCHE ↔ BORD_DROIT)
    const height = 0.65;     // Hauteur (NEZ)
    const depth = 0.15;      // Profondeur des whiskers (vers l'arrière)
    
    // Points structurels principaux
    geometry.setPoint('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('NEZ', new THREE.Vector3(0, height, 0));
    geometry.setPoint('BORD_GAUCHE', new THREE.Vector3(-width / 2, 0, 0));
    geometry.setPoint('BORD_DROIT', new THREE.Vector3(width / 2, 0, 0));
    
    // CENTRE - point central sur la spine (pour bride centrale)
    const centreY = height / 4; // 25% de la hauteur
    geometry.setPoint('CENTRE', new THREE.Vector3(0, centreY, 0));
    
    // INTER points - position de la barre transversale sur les bords d'attaque
    // Calculés proportionnellement : ratio = (height - centreY) / height = 0.75
    const ratio = (height - centreY) / height;
    const interGaucheX = ratio * (-width / 2);  // -0.619
    const interDroitX = ratio * (width / 2);    // +0.619
    geometry.setPoint('INTER_GAUCHE', new THREE.Vector3(interGaucheX, centreY, 0));
    geometry.setPoint('INTER_DROIT', new THREE.Vector3(interDroitX, centreY, 0));
    
    // FIX points - points de fixation des whiskers sur les bords d'attaque
    // Positionnés à 2/3 de la distance entre CENTRE et INTER (sur l'axe X)
    const fixRatio = 2 / 3;
    geometry.setPoint('FIX_GAUCHE', new THREE.Vector3(fixRatio * interGaucheX, centreY, 0));
    geometry.setPoint('FIX_DROIT', new THREE.Vector3(fixRatio * interDroitX, centreY, 0));
    
    // WHISKER points - longerons arrière partant des FIX vers l'arrière
    // Positionnés à 1/4 de l'envergure depuis le centre, légèrement bas, en arrière
    geometry.setPoint('WHISKER_GAUCHE', new THREE.Vector3(-width / 4, 0.1, -depth));
    geometry.setPoint('WHISKER_DROIT', new THREE.Vector3(width / 4, 0.1, -depth));
    
    // Calculer les points de contrôle par trilatération 3D
    // Les brides convergent vers ces points pour former une pyramide
    const nezPos = new THREE.Vector3(0, height, 0);
    const centrePos = new THREE.Vector3(0, centreY, 0);
    const interDroitPos = new THREE.Vector3(interDroitX, centreY, 0);
    const bridleLengths = { ...CONFIG.bridle.defaultLengths };
    
    const ctrlDroit = this.calculateControlPoint(nezPos, interDroitPos, centrePos, bridleLengths);
    const ctrlGauche = new THREE.Vector3(-ctrlDroit.x, ctrlDroit.y, ctrlDroit.z);
    
    // Log pour debug : voir où sont positionnés les points de contrôle
    console.log('🎯 Points de contrôle calculés par trilatération:');
    console.log('  CTRL_GAUCHE:', ctrlGauche.toArray().map(v => v.toFixed(3)).join(', '));
    console.log('  CTRL_DROIT:', ctrlDroit.toArray().map(v => v.toFixed(3)).join(', '));
    console.log('  Longueurs brides:', bridleLengths);
    
    geometry.setPoint('CTRL_GAUCHE', ctrlGauche);
    geometry.setPoint('CTRL_DROIT', ctrlDroit);
    
    // Connexions pour la structure (basée sur la branche main)
    // Spine centrale
    geometry.addConnection('NEZ', 'SPINE_BAS');
    
    // Bords d'attaque (Leading Edge)
    geometry.addConnection('NEZ', 'BORD_GAUCHE');
    geometry.addConnection('NEZ', 'BORD_DROIT');
    
    // Barre transversale (Crossbar/Spreader)
    geometry.addConnection('INTER_GAUCHE', 'INTER_DROIT');
    
    // Whiskers - longerons arrière connectés aux FIX (pas aux INTER)
    geometry.addConnection('WHISKER_GAUCHE', 'FIX_GAUCHE');
    geometry.addConnection('WHISKER_DROIT', 'FIX_DROIT');
    
    // Surfaces de la voile (basées sur KiteGeometry.ts de la branche main)
    // 4 triangles formant le delta
    geometry.addSurface(['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE']);  // Surface haute gauche
    geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS']);     // Surface basse gauche
    geometry.addSurface(['NEZ', 'BORD_DROIT', 'WHISKER_DROIT']);    // Surface haute droite
    geometry.addSurface(['NEZ', 'WHISKER_DROIT', 'SPINE_BAS']);     // Surface basse droite
    kiteEntity.addComponent(geometry);

    // Composant Visual
    const visual = new VisualComponent();
    visual.frameMaterial = { color: '#333333', diameter: 0.005 };
    visual.surfaceMaterial = { color: '#ffffff', opacity: 0.9, transparent: true, doubleSided: true };
    visual.bridleMaterial = { color: '#00ff00', opacity: 0.8, linewidth: 2 }; // Brides vertes visibles
    visual.showDebugMarkers = true; // Activer les marqueurs pour voir les points de contrôle
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

  /**
   * Calcule le point de contrôle par trilatération 3D
   * Les 3 brides (nez, inter, centre) convergent vers ce point pour former une pyramide
   * PUBLIQUE pour permettre le recalcul dynamique depuis BridleSystem
   */
  static calculateControlPoint(
    nez: THREE.Vector3,
    inter: THREE.Vector3,
    centre: THREE.Vector3,
    bridleLengths: { nez: number; inter: number; centre: number }
  ): THREE.Vector3 {
    // Trilatération 3D : trouver le point P tel que :
    // - distance(P, nez) = bridleLengths.nez
    // - distance(P, inter) = bridleLengths.inter
    // - distance(P, centre) = bridleLengths.centre

    // Créer repère local avec nez comme origine
    const ex = inter.clone().sub(nez).normalize();
    const d = inter.distanceTo(nez);

    const centreToNez = centre.clone().sub(nez);
    const i = ex.dot(centreToNez);
    const eyTemp = centreToNez.clone().addScaledVector(ex, -i);
    const ey = eyTemp.normalize();

    const ez = new THREE.Vector3().crossVectors(ex, ey);
    // S'assurer que ez pointe vers l'arrière (Z positif dans notre système)
    // Le point de contrôle sera DEVANT le kite (coordonnée z négative du résultat)
    if (ez.z < 0) ez.negate();

    const j = ey.dot(centreToNez);

    // Résoudre système pour trouver coordonnées (x, y, z) du point de contrôle
    const r1 = bridleLengths.nez;
    const r2 = bridleLengths.inter;
    const r3 = bridleLengths.centre;

    const x = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const y = (r1 * r1 - r3 * r3 + i * i + j * j) / (2 * j) - (i / j) * x;

    const zSquared = r1 * r1 - x * x - y * y;
    const z = zSquared < 0 ? 0 : Math.sqrt(zSquared);

    // Convertir en coordonnées globales
    const result = new THREE.Vector3();
    result.copy(nez);
    result.addScaledVector(ex, x);
    result.addScaledVector(ey, y);
    result.addScaledVector(ez, z);

    return result;
  }
}
