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
    
    // Points anatomiques du kite
    geometry.setPoint('SPINE_BAS', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('CENTRE', new THREE.Vector3(0, 0.325, 0));
    geometry.setPoint('NEZ', new THREE.Vector3(0, 0.65, 0));
    geometry.setPoint('BORD_GAUCHE', new THREE.Vector3(-0.825, 0, 0));
    geometry.setPoint('BORD_DROIT', new THREE.Vector3(0.825, 0, 0));
    
    // Géométrie du delta - toutes les positions calculées proportionnellement
    const nezY = 0.65;      // Hauteur du nez
    const bordX = 0.825;    // Demi-envergure
    const spineY = 0;       // Bas de la spine
    
    // INTER points - position de la barre transversale sur les bords d'attaque
    const interRatio = 0.69; // À 69% du nez vers les pointes
    geometry.setPoint('INTER_GAUCHE', new THREE.Vector3(
      -bordX * interRatio,           // X: -0.569
      nezY * (1 - interRatio),        // Y: 0.201
      0
    ));
    geometry.setPoint('INTER_DROIT', new THREE.Vector3(
      bordX * interRatio,             // X: 0.569
      nezY * (1 - interRatio),        // Y: 0.201
      0
    ));
    
    // CENTRE - point central sur la spine à mi-hauteur (pour bride centrale)
    const centreRatio = 0.5; // 50% entre NEZ et SPINE_BAS
    geometry.setPoint('CENTRE', new THREE.Vector3(0, nezY * centreRatio, 0));
    
    // FIX points - points de fixation des brides sur les bords d'attaque
    // Positionnés à mi-chemin entre NEZ et INTER (environ 35% du bord d'attaque)
    const fixRatio = 0.35;
    geometry.setPoint('FIX_GAUCHE', new THREE.Vector3(
      -bordX * fixRatio,              // X: -0.289
      nezY * (1 - fixRatio),          // Y: 0.423
      0
    ));
    geometry.setPoint('FIX_DROIT', new THREE.Vector3(
      bordX * fixRatio,               // X: 0.289
      nezY * (1 - fixRatio),          // Y: 0.423
      0
    ));
    
    // WHISKER points - longerons arrière partant de la barre transversale
    // Position : 1/3 de la distance INTER → CENTRE (spine) en X, même Y que INTER, Z négatif
    const whiskerRatio = 1/3; // 1/3 de la distance INTER → CENTRE
    const interX = bordX * interRatio;  // Distance X de INTER depuis le centre
    const whiskerX = interX * (1 - whiskerRatio); // 2/3 de la distance (se rapproche du centre)
    const whiskerZ = -0.15;     // Profondeur en arrière du kite (longueur du whisker)
    
    geometry.setPoint('WHISKER_GAUCHE', new THREE.Vector3(
      -whiskerX,                // X: entre INTER_GAUCHE et CENTRE (à 1/3 du chemin)
      nezY * (1 - interRatio),  // Même Y que INTER_GAUCHE  
      whiskerZ                  // En arrière
    ));
    geometry.setPoint('WHISKER_DROIT', new THREE.Vector3(
      whiskerX,                 // X: entre INTER_DROIT et CENTRE (à 1/3 du chemin)
      nezY * (1 - interRatio),  // Même Y que INTER_DROIT
      whiskerZ                  // En arrière
    ));
    
    // Calculer les points de contrôle par trilatération 3D
    // Les brides convergent vers ces points pour former une pyramide
    const nezPos = new THREE.Vector3(0, nezY, 0);
    const centrePos = new THREE.Vector3(0, nezY * centreRatio, 0);
    const interDroitPos = new THREE.Vector3(
      bordX * interRatio,
      nezY * (1 - interRatio),
      0
    );
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
    
    // Connexions pour la structure
    // Spine centrale
    geometry.addConnection('NEZ', 'CENTRE');        // Haut de spine
    geometry.addConnection('CENTRE', 'SPINE_BAS');  // Bas de spine
    
    // Bords d'attaque (Leading Edge) - segmentés par les points de fixation
    // Gauche: NEZ → FIX_GAUCHE → INTER_GAUCHE → BORD_GAUCHE
    geometry.addConnection('NEZ', 'FIX_GAUCHE');
    geometry.addConnection('FIX_GAUCHE', 'INTER_GAUCHE');
    geometry.addConnection('INTER_GAUCHE', 'BORD_GAUCHE');
    
    // Droit: NEZ → FIX_DROIT → INTER_DROIT → BORD_DROIT
    geometry.addConnection('NEZ', 'FIX_DROIT');
    geometry.addConnection('FIX_DROIT', 'INTER_DROIT');
    geometry.addConnection('INTER_DROIT', 'BORD_DROIT');
    
    // Barre transversale (Crossbar)
    geometry.addConnection('INTER_GAUCHE', 'INTER_DROIT');
    
    // Whiskers (longerons arrière) - partent de la barre transversale vers l'arrière
    // pour tendre la toile et donner du profil au kite
    geometry.addConnection('INTER_GAUCHE', 'WHISKER_GAUCHE');
    geometry.addConnection('INTER_DROIT', 'WHISKER_DROIT');
    
    // Saumons (trailing edge) - connectent les pointes aux whiskers et au centre
    geometry.addConnection('BORD_GAUCHE', 'WHISKER_GAUCHE');
    geometry.addConnection('WHISKER_GAUCHE', 'SPINE_BAS');
    geometry.addConnection('BORD_DROIT', 'WHISKER_DROIT');
    geometry.addConnection('WHISKER_DROIT', 'SPINE_BAS');
    
    // Surfaces de la voile - découpage cohérent avec la structure
    // Partie avant gauche (nez → bord d'attaque → whisker)
    geometry.addSurface(['NEZ', 'INTER_GAUCHE', 'WHISKER_GAUCHE']);
    geometry.addSurface(['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS']);
    
    // Partie arrière gauche (whisker → saumon → centre)
    geometry.addSurface(['INTER_GAUCHE', 'BORD_GAUCHE', 'WHISKER_GAUCHE']);
    geometry.addSurface(['WHISKER_GAUCHE', 'BORD_GAUCHE', 'SPINE_BAS']);
    
    // Partie avant droite (nez → bord d'attaque → whisker)
    geometry.addSurface(['NEZ', 'WHISKER_DROIT', 'INTER_DROIT']);
    geometry.addSurface(['NEZ', 'SPINE_BAS', 'WHISKER_DROIT']);
    
    // Partie arrière droite (whisker → saumon → centre)
    geometry.addSurface(['INTER_DROIT', 'WHISKER_DROIT', 'BORD_DROIT']);
    geometry.addSurface(['WHISKER_DROIT', 'SPINE_BAS', 'BORD_DROIT']);
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
   */
  private static calculateControlPoint(
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
