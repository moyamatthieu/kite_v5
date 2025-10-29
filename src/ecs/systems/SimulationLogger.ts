/**
 * SimulationLogger.ts - Système de logging structuré pour la simulation
 *
 * Traçabilité complète de l'évolution de la simulation:
 * - Positions (barre, handles, lignes, CTRL, spine)
 * - Forces et orientation des faces
 * - Tensions des lignes
 * - Rotation du kite
 *
 * Priorité 45 (APRÈS ConstraintSystem, AVANT PhysicsSystem)
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { LineComponent } from '../components/LineComponent';
import { BridleComponent } from '../components/BridleComponent';

const PRIORITY = 45;

interface LogEntry {
  frameNumber: number;
  timestamp: number;
  barRotation: number;
  barHandles: {
    left: THREE.Vector3;
    right: THREE.Vector3;
  };
  lineDistances: {
    left: number;
    right: number;
  };
  lineTensions: {
    left: number;
    right: number;
  };
  ctrlPoints: {
    gauche: THREE.Vector3;
    droit: THREE.Vector3;
  };
  kitePosition: THREE.Vector3;
  kiteRotation: {
    quaternion: THREE.Quaternion;
    euler: { pitch: number; roll: number; yaw: number };
  };
  spineDirection: THREE.Vector3;
  kiteVelocity: THREE.Vector3;
  kiteAngularVelocity: THREE.Vector3;
  forces: {
    total: THREE.Vector3;
    left: THREE.Vector3;
    right: THREE.Vector3;
    gravity: THREE.Vector3;
    aero: THREE.Vector3;
  };
  torques: {
    total: THREE.Vector3;
    constraint: THREE.Vector3;
    aero: THREE.Vector3;
  };
  faces: Array<{
    id: string;
    centroid: THREE.Vector3;
    normal: THREE.Vector3;
    liftVector: THREE.Vector3;
    dragVector: THREE.Vector3;
    apparentWind: THREE.Vector3;
    liftMagnitude: number;
    dragMagnitude: number;
    angleOfAttack: number;
  }>;
  windState?: {
    ambient: THREE.Vector3;
    speed: number;
    direction: THREE.Vector3;
  };
  bridles: {
    nez: number;
    inter: number;
    centre: number;
  };
}

export class SimulationLogger extends System {
  private frameNumber = 0;
  private logHistory: LogEntry[] = [];
  private lastLogTime = 0;
  private logInterval = 1000; // Log tous les 1000ms (1 seconde) - état système
  private isLogging = false;
  private logBuffer: string[] = [];

  constructor() {
    super('SimulationLogger', PRIORITY);
  }

  initialize(_entityManager: EntityManager): void {
    console.log('📊 [SimulationLogger] Initialized - ready to log simulation');
    this.isLogging = true;
  }

  update(context: SimulationContext): void {
    if (!this.isLogging) return;

    const now = performance.now();
    if (now - this.lastLogTime < this.logInterval) return;

    this.lastLogTime = now;
    this.frameNumber++;

    const { entityManager } = context;

    const kite = entityManager.getEntity('kite');
    const controlBar = entityManager.getEntity('controlBar');
    const ui = entityManager.query(['Input'])[0]; // Récupérer l'entité UI pour les modes

    if (!kite || !controlBar || !ui) return;
    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');

    if (!kite || !controlBar || !leftLine || !rightLine) return;

    const kiteTransform = kite.getComponent<TransformComponent>('transform');
    const kitePhysics = kite.getComponent<PhysicsComponent>('physics');
    const kiteGeometry = kite.getComponent<GeometryComponent>('geometry');

    const barTransform = controlBar.getComponent<TransformComponent>('transform');
    const barGeometry = controlBar.getComponent<GeometryComponent>('geometry');

    const leftLineComp = leftLine.getComponent<LineComponent>('line');
    const rightLineComp = rightLine.getComponent<LineComponent>('line');

    const kiteBridle = kite.getComponent<BridleComponent>('bridle');

    if (
      !kiteTransform ||
      !kitePhysics ||
      !kiteGeometry ||
      !barTransform ||
      !barGeometry ||
      !leftLineComp ||
      !rightLineComp
    ) {
      return;
    }

    // Récupérer les modes depuis le composant Input
    // const inputComp = ui.getComponent('Input') as any;

    // Collecter toutes les données
    const entry = this.collectLogEntry(
      kite,
      controlBar,
      kiteTransform,
      kitePhysics,
      kiteGeometry,
      barTransform,
      barGeometry,
      leftLineComp,
      rightLineComp,
      kiteBridle
    );

    this.logHistory.push(entry);
    this.formatAndPrint(entry);
  }

  private collectLogEntry(
    kite: any,
    controlBar: any,
    kiteTransform: TransformComponent,
    kitePhysics: PhysicsComponent,
    kiteGeometry: GeometryComponent,
    barTransform: TransformComponent,
    barGeometry: GeometryComponent,
    leftLineComp: LineComponent,
    rightLineComp: LineComponent,
    kiteBridle: BridleComponent | null | undefined
  ): LogEntry {
    // Bar rotation
    const barEuler = new THREE.Euler().setFromQuaternion(barTransform.quaternion);
    const barRotationDeg = (barEuler.y * 180) / Math.PI;

    // Bar handles
    const barLeft = barGeometry.getPointWorld('leftHandle', controlBar) || new THREE.Vector3();
    const barRight = barGeometry.getPointWorld('rightHandle', controlBar) || new THREE.Vector3();

    // CTRL points
    const ctrlGauche = kiteGeometry.getPointWorld('CTRL_GAUCHE', kite) || new THREE.Vector3();
    const ctrlDroit = kiteGeometry.getPointWorld('CTRL_DROIT', kite) || new THREE.Vector3();

    // Line distances
    const lineDistLeft = barLeft.distanceTo(ctrlGauche);
    const lineDistRight = barRight.distanceTo(ctrlDroit);

    // Spine direction
    const spineBase = kiteGeometry.getPointWorld('SPINE_BAS', kite) || new THREE.Vector3();
    const spineTop = kiteGeometry.getPointWorld('NEZ', kite) || new THREE.Vector3();
    const spineDir = new THREE.Vector3().subVectors(spineTop, spineBase);
    if (spineDir.length() > 0.001) {
      spineDir.normalize();
    }

    // Kite euler angles
    const kiteEuler = new THREE.Euler().setFromQuaternion(kiteTransform.quaternion);

    // Extract forces
    const totalForce = kitePhysics.forces.clone();
    const leftLineForce = leftLineComp.currentTension > 0 ? 1 : 0; // Simplifié
    const rightLineForce = rightLineComp.currentTension > 0 ? 1 : 0;

    const entry: LogEntry = {
      frameNumber: this.frameNumber,
      timestamp: performance.now(),
      barRotation: barRotationDeg,
      barHandles: {
        left: barLeft.clone(),
        right: barRight.clone(),
      },
      lineDistances: {
        left: lineDistLeft,
        right: lineDistRight,
      },
      lineTensions: {
        left: leftLineComp.currentTension,
        right: rightLineComp.currentTension,
      },
      ctrlPoints: {
        gauche: ctrlGauche.clone(),
        droit: ctrlDroit.clone(),
      },
      kitePosition: kiteTransform.position.clone(),
      kiteRotation: {
        quaternion: kiteTransform.quaternion.clone(),
        euler: {
          pitch: (kiteEuler.x * 180) / Math.PI,
          roll: (kiteEuler.z * 180) / Math.PI,
          yaw: (kiteEuler.y * 180) / Math.PI,
        },
      },
      spineDirection: spineDir.clone(),
      kiteVelocity: kitePhysics.velocity.clone(),
      kiteAngularVelocity: kitePhysics.angularVelocity.clone(),
      forces: {
        total: totalForce,
        left: new THREE.Vector3(leftLineForce, 0, 0),
        right: new THREE.Vector3(rightLineForce, 0, 0),
        gravity: new THREE.Vector3(0, -9.81 * kitePhysics.mass, 0),
        aero: new THREE.Vector3(0, 0, 0), // À récupérer depuis AeroSystem
      },
      torques: {
        total: kitePhysics.torques.clone(),
        constraint: new THREE.Vector3(0, 0, 0), // À calculer
        aero: new THREE.Vector3(0, 0, 0), // À récupérer
      },
      faces: this.collectFaceData(kitePhysics),
      windState: this.collectWindState(kitePhysics),
      bridles: kiteBridle
        ? {
            nez: kiteBridle.lengths.nez,
            inter: kiteBridle.lengths.inter,
            centre: kiteBridle.lengths.centre,
          }
        : { nez: 0, inter: 0, centre: 0 },
    };

    return entry;
  }

  /**
   * Collecte les données aérodynamiques depuis kitePhysics.faceForces
   */
  private collectFaceData(kitePhysics: PhysicsComponent): Array<{
    id: string;
    centroid: THREE.Vector3;
    normal: THREE.Vector3;
    liftVector: THREE.Vector3;
    dragVector: THREE.Vector3;
    apparentWind: THREE.Vector3;
    liftMagnitude: number;
    dragMagnitude: number;
    angleOfAttack: number;
  }> {
    if (!kitePhysics.faceForces || kitePhysics.faceForces.length === 0) {
      return [];
    }

    return kitePhysics.faceForces.map((face) => {
      const liftMag = face.lift.length();
      const dragMag = face.drag.length();
      
      // Calculer l'angle d'attaque depuis les vecteurs
      const windDir = face.apparentWind.clone().normalize();
      const dotNW = Math.abs(face.normal.dot(windDir));
      const alphaRad = Math.acos(Math.max(0.0, Math.min(1.0, dotNW)));
      const alphaDeg = alphaRad * 180 / Math.PI;

      return {
        id: face.name,
        centroid: face.centroid.clone(),
        normal: face.normal.clone(),
        liftVector: face.lift.clone(),
        dragVector: face.drag.clone(),
        apparentWind: face.apparentWind.clone(),
        liftMagnitude: liftMag,
        dragMagnitude: dragMag,
        angleOfAttack: alphaDeg,
      };
    });
  }

  /**
   * Collecte l'état du vent global (si disponible)
   */
  private collectWindState(_kitePhysics: PhysicsComponent): {
    ambient: THREE.Vector3;
    speed: number;
    direction: THREE.Vector3;
  } | undefined {
    // Récupérer le vent ambiant depuis le premier faceForce (tous partagent le même vent ambiant)
    // Note: Le vent apparent varie selon la position, mais le vent ambiant est global
    // Pour l'instant, on utilise une approximation
    return undefined; // À améliorer si nécessaire
  }

  private formatAndPrint(entry: LogEntry): void {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(120)}`);
    lines.push(
      `📊 FRAME ${entry.frameNumber} | ${new Date(entry.timestamp).toLocaleTimeString()}`
    );
    lines.push(`${'='.repeat(120)}`);

    // Bar state
    lines.push(`\n🎮 BAR STATE:`);
    lines.push(`  Rotation: ${entry.barRotation.toFixed(2)}°`);
    lines.push(
      `  Handle Left: (${entry.barHandles.left.x.toFixed(3)}, ${entry.barHandles.left.y.toFixed(3)}, ${entry.barHandles.left.z.toFixed(3)})`
    );
    lines.push(
      `  Handle Right: (${entry.barHandles.right.x.toFixed(3)}, ${entry.barHandles.right.y.toFixed(3)}, ${entry.barHandles.right.z.toFixed(3)})`
    );

    // Lines
    lines.push(`\n🔗 LINES:`);
    lines.push(
      `  Left: distance=${entry.lineDistances.left.toFixed(3)}m, tension=${entry.lineTensions.left.toFixed(2)}N`
    );
    lines.push(
      `  Right: distance=${entry.lineDistances.right.toFixed(3)}m, tension=${entry.lineTensions.right.toFixed(2)}N`
    );
    const asymmetry = Math.abs(entry.lineTensions.left - entry.lineTensions.right);
    lines.push(`  Asymmetry: ΔT = ${asymmetry.toFixed(2)}N`);

    // CTRL points
    lines.push(`\n🎯 CTRL POINTS:`);
    lines.push(
      `  Left: (${entry.ctrlPoints.gauche.x.toFixed(3)}, ${entry.ctrlPoints.gauche.y.toFixed(3)}, ${entry.ctrlPoints.gauche.z.toFixed(3)})`
    );
    lines.push(
      `  Right: (${entry.ctrlPoints.droit.x.toFixed(3)}, ${entry.ctrlPoints.droit.y.toFixed(3)}, ${entry.ctrlPoints.droit.z.toFixed(3)})`
    );

    // Kite position and rotation
    lines.push(`\n🪁 KITE STATE:`);
    lines.push(
      `  Position: (${entry.kitePosition.x.toFixed(3)}, ${entry.kitePosition.y.toFixed(3)}, ${entry.kitePosition.z.toFixed(3)})`
    );
    lines.push(
      `  Velocity: (${entry.kiteVelocity.x.toFixed(3)}, ${entry.kiteVelocity.y.toFixed(3)}, ${entry.kiteVelocity.z.toFixed(3)}) m/s`
    );
    lines.push(
      `  Rotation (Euler): pitch=${entry.kiteRotation.euler.pitch.toFixed(2)}°, roll=${entry.kiteRotation.euler.roll.toFixed(2)}°, yaw=${entry.kiteRotation.euler.yaw.toFixed(2)}°`
    );
    lines.push(
      `  Spine Direction: (${entry.spineDirection.x.toFixed(3)}, ${entry.spineDirection.y.toFixed(3)}, ${entry.spineDirection.z.toFixed(3)})`
    );

    // Angular velocity
    lines.push(`\n⚙️ ANGULAR DYNAMICS:`);
    lines.push(
      `  ω: (${entry.kiteAngularVelocity.x.toFixed(4)}, ${entry.kiteAngularVelocity.y.toFixed(4)}, ${entry.kiteAngularVelocity.z.toFixed(4)}) rad/s`
    );
    lines.push(
      `  τ_total: (${entry.torques.total.x.toFixed(3)}, ${entry.torques.total.y.toFixed(3)}, ${entry.torques.total.z.toFixed(3)}) N⋅m`
    );
    lines.push(`  |τ_total|: ${entry.torques.total.length().toFixed(3)} N⋅m`);

    // Forces
    lines.push(`\n⚡ FORCES:`);
    lines.push(
      `  Total: (${entry.forces.total.x.toFixed(3)}, ${entry.forces.total.y.toFixed(3)}, ${entry.forces.total.z.toFixed(3)}) N`
    );
    lines.push(
      `  Gravity: (${entry.forces.gravity.x.toFixed(3)}, ${entry.forces.gravity.y.toFixed(3)}, ${entry.forces.gravity.z.toFixed(3)}) N`
    );

    // Aero forces par surface (détaillé)
    if (entry.faces && entry.faces.length > 0) {
      lines.push(`\n🌬️  AERODYNAMICS (${entry.faces.length} surfaces):`);
      
      entry.faces.forEach((face, idx) => {
        lines.push(`\n  ━━━ Surface ${idx + 1}: ${face.id} ━━━`);
        lines.push(`    📍 CP: (${face.centroid.x.toFixed(2)}, ${face.centroid.y.toFixed(2)}, ${face.centroid.z.toFixed(2)})`);
        lines.push(`    📐 α = ${face.angleOfAttack.toFixed(1)}°`);
        
        // Normale (direction perpendiculaire à la surface)
        lines.push(`    🔶 Normal: (${face.normal.x.toFixed(3)}, ${face.normal.y.toFixed(3)}, ${face.normal.z.toFixed(3)})`);
        
        // Vent apparent local
        const windSpeed = face.apparentWind.length();
        const windDir = face.apparentWind.clone().normalize();
        lines.push(`    💨 Wind apparent: ${windSpeed.toFixed(2)} m/s`);
        lines.push(`       Direction: (${windDir.x.toFixed(3)}, ${windDir.y.toFixed(3)}, ${windDir.z.toFixed(3)})`);
        
        // Portance (perpendiculaire au vent)
        const liftDir = face.liftVector.clone().normalize();
        lines.push(`    ⬆️  Lift: ${face.liftMagnitude.toFixed(2)} N`);
        lines.push(`       Direction: (${liftDir.x.toFixed(3)}, ${liftDir.y.toFixed(3)}, ${liftDir.z.toFixed(3)})`);
        
        // Traînée (parallèle au vent)
        const dragDir = face.dragVector.clone().normalize();
        lines.push(`    ⬅️  Drag: ${face.dragMagnitude.toFixed(2)} N`);
        lines.push(`       Direction: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)})`);
        
        // Vérification orthogonalité (lift ⊥ wind)
        const liftWindDot = liftDir.dot(windDir);
        const orthogonality = Math.abs(liftWindDot);
        lines.push(`    ✓ Lift⊥Wind: ${orthogonality < 0.01 ? '✅' : '⚠️'} (dot=${liftWindDot.toFixed(4)})`);
      });
    }

    // Bridles
    lines.push(`\n🌉 BRIDLES:`);
    lines.push(
      `  Nez: ${entry.bridles.nez.toFixed(3)}m, Inter: ${entry.bridles.inter.toFixed(3)}m, Centre: ${entry.bridles.centre.toFixed(3)}m`
    );

    lines.push(`${'='.repeat(120)}\n`);

    // Afficher et stocker
    const fullLog = lines.join('\n');
    console.log(fullLog);
    this.logBuffer.push(fullLog);
  }

  /**
   * Exporte l'historique de la simulation en JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Exporte l'historique en CSV pour analyse dans Excel/R
   */
  exportAsCSV(): string {
    if (this.logHistory.length === 0) return '';

    const headers = [
      'frame',
      'timestamp',
      'barRotation',
      'barHandleLeftX',
      'barHandleLeftY',
      'barHandleLeftZ',
      'barHandleRightX',
      'barHandleRightY',
      'barHandleRightZ',
      'lineDistLeft',
      'lineDistRight',
      'lineTensionLeft',
      'lineTensionRight',
      'ctrlLeftX',
      'ctrlLeftY',
      'ctrlLeftZ',
      'ctrlRightX',
      'ctrlRightY',
      'ctrlRightZ',
      'kitePositionX',
      'kitePositionY',
      'kitePositionZ',
      'kiteVelocityX',
      'kiteVelocityY',
      'kiteVelocityZ',
      'kiteRotationPitch',
      'kiteRotationRoll',
      'kiteRotationYaw',
      'spineDirectionX',
      'spineDirectionY',
      'spineDirectionZ',
      'angularVelocityX',
      'angularVelocityY',
      'angularVelocityZ',
      'torqueTotalX',
      'torqueTotalY',
      'torqueTotalZ',
      'bridleNez',
      'bridleInter',
      'bridleCentre',
    ];

    const rows = this.logHistory.map((entry) => [
      entry.frameNumber,
      entry.timestamp,
      entry.barRotation,
      entry.barHandles.left.x,
      entry.barHandles.left.y,
      entry.barHandles.left.z,
      entry.barHandles.right.x,
      entry.barHandles.right.y,
      entry.barHandles.right.z,
      entry.lineDistances.left,
      entry.lineDistances.right,
      entry.lineTensions.left,
      entry.lineTensions.right,
      entry.ctrlPoints.gauche.x,
      entry.ctrlPoints.gauche.y,
      entry.ctrlPoints.gauche.z,
      entry.ctrlPoints.droit.x,
      entry.ctrlPoints.droit.y,
      entry.ctrlPoints.droit.z,
      entry.kitePosition.x,
      entry.kitePosition.y,
      entry.kitePosition.z,
      entry.kiteVelocity.x,
      entry.kiteVelocity.y,
      entry.kiteVelocity.z,
      entry.kiteRotation.euler.pitch,
      entry.kiteRotation.euler.roll,
      entry.kiteRotation.euler.yaw,
      entry.spineDirection.x,
      entry.spineDirection.y,
      entry.spineDirection.z,
      entry.kiteAngularVelocity.x,
      entry.kiteAngularVelocity.y,
      entry.kiteAngularVelocity.z,
      entry.torques.total.x,
      entry.torques.total.y,
      entry.torques.total.z,
      entry.bridles.nez,
      entry.bridles.inter,
      entry.bridles.centre,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((v) => (typeof v === 'number' ? v.toFixed(6) : v)).join(','))].join('\n');

    return csv;
  }

  /**
   * Arrête le logging et exporte les données
   */
  stopAndExport(): { json: string; csv: string } {
    this.isLogging = false;
    return {
      json: this.exportAsJSON(),
      csv: this.exportAsCSV(),
    };
  }

  /**
   * Retourne l'historique complet
   */
  getHistory(): LogEntry[] {
    return this.logHistory;
  }

  /**
   * Retourne le buffer de logs formatés
   */
  getFormattedLogs(): string {
    return this.logBuffer.join('\n');
  }
}
