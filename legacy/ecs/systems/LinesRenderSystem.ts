/**
 * LinesRenderSystem.ts - Système ECS pour le rendu des lignes de contrôle
 *
 * Responsabilités :
 *   - Gère les entités de lignes de contrôle (gauche et droite)
 *   - Met à jour la géométrie des lignes en fonction des positions du kite et de la barre
 *   - Applique une courbure réaliste aux lignes (caténaire)
 *
 * Architecture ECS :
 *   - Opère sur des LineEntity avec TransformComponent et MeshComponent
 *   - Lit les positions depuis ControlBarSystem et Kite
 *   - Met à jour les BufferGeometry THREE.js pour le rendu
 */

// External libraries
import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Logger } from '@utils/Logging';
import { CONFIG } from '@config/SimulationConfig';
import { MeshComponent } from '@components/MeshComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { TransformComponent } from '@components/TransformComponent';
import { LineComponent } from '@components/LineComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { Entity } from '@base/Entity';

import { KitePhysicsSystem } from './KitePhysicsSystem';

import { ControlBarSystem } from '@/ecs/systems/ControlBarSystem';

/**
 * Composant spécifique aux lignes pour stocker leurs paramètres
 */
export interface LineComponentData {
  segments: number;
  color: number;
  linewidth: number;
  side: 'left' | 'right';
  maxLength?: number;
}

type LineRenderData = Omit<LineComponentData, 'maxLength'> & { maxLength: number };

interface LineGeometryData {
  geometry: THREE.TubeGeometry;
  points: THREE.Vector3[];
  clamped: boolean;
  effectiveLength: number;
  slack: number;
}

export class LinesRenderSystem extends BaseSimulationSystem {
  private logger: Logger;
  private scene: THREE.Scene | null = null;
  private lineEntities: Map<string, Entity> = new Map();
  private lineRenderData: Map<string, LineRenderData> = new Map();
  private clampedLines: Set<string> = new Set();
  private kiteEntity: Entity | null = null;
  private controlBarSystem: ControlBarSystem | null = null;
  private kitePhysicsSystem: KitePhysicsSystem | null = null;
  // ✅ SUPPRIMÉ: ctrlLeftEntity et ctrlRightEntity (maintenant points locaux du kite)
  private hasLoggedWarning: boolean = false;

  constructor() {
    super('LinesRenderSystem', 95); // Après ControlPointSystem (50), avant RenderSystem (100)
    this.logger = Logger.getInstance();
  }

  /**
   * ✅ SUPPRIMÉ: setControlPointEntities()
   * Les CTRL sont maintenant des points locaux accessibles via geometry.getPointWorld()
   */

  reset(): void {
    this.lineEntities.forEach((entity, id) => {
      const meshComp = entity.getComponent<MeshComponent>('mesh');
      if (meshComp && meshComp.object3D.parent) {
        meshComp.object3D.parent.remove(meshComp.object3D);
      }
    });
    this.lineEntities.clear();
    this.lineRenderData.clear();
    this.clampedLines.clear();
    this.hasLoggedWarning = false;
  }

  dispose(): void {
    this.reset();
    this.logger.info('LinesRenderSystem disposed', 'LinesRenderSystem');
  }

  /**
   * Définit la scène Three.js
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  private logInitialization(): void {
    this.logger.info('LinesRenderSystem initialized with the following configuration:', 'LinesRenderSystem', {
      lineEntitiesCount: this.lineEntities.size,
      clampedLinesCount: this.clampedLines.size,
      kiteEntityAssigned: !!this.kiteEntity,
      controlBarSystemAssigned: !!this.controlBarSystem
    });
  }

  private logWarnings(): void {
    if (!this.kiteEntity) {
      this.logger.warn('Kite entity is not assigned to LinesRenderSystem.', 'LinesRenderSystem');
    }
    if (!this.controlBarSystem) {
      this.logger.warn('ControlBarSystem is not assigned to LinesRenderSystem.', 'LinesRenderSystem');
    }
  }

  async initialize(): Promise<void> {
    this.logInitialization();
    this.logWarnings();
  }

  /**
   * Enregistre une entité de ligne
   */
  registerLineEntity(id: string, entity: Entity, data: LineComponentData): void {
    const lineComponent = entity.getComponent<LineComponent>('line');
    const baseLength = lineComponent?.getCurrentLength() ?? lineComponent?.config.length ?? CONFIG.lines.defaultLength;
    const sanitizedSegments = Math.max(4, Math.min(data.segments, CONFIG.thresholds.maxLineSegments));

    const renderData: LineRenderData = {
      ...data,
      segments: sanitizedSegments,
      maxLength: data.maxLength ?? baseLength
    };

    this.lineEntities.set(id, entity);
    this.lineRenderData.set(id, renderData);
  }

  /**
   * Définit la référence au kite (version ECS)
   */
  setKite(kiteEntity: Entity): void {
    this.kiteEntity = kiteEntity;
  }

  /**
   * Définit la référence au kite (compatibilité legacy)
   * @deprecated Utiliser setKite(kiteEntity: Entity) à la place
   */
  setKiteLegacy(_kite: unknown): void {
    this.logger.warn('LinesRenderSystem.setKiteLegacy() is deprecated');
  }

  /**
   * Définit la référence au système de barre de contrôle
   */
  setControlBarSystem(system: ControlBarSystem): void {
    this.controlBarSystem = system;
  }

  /**
   * Définit la référence au système de physique du kite (pour accéder aux tensions)
   */
  setKitePhysicsSystem(system: KitePhysicsSystem): void {
    this.kitePhysicsSystem = system;
  }

  private logKiteState(): void {
    if (!this.kiteEntity) {
      this.logger.warn('Cannot log kite state: kiteEntity is not assigned.', 'LinesRenderSystem');
      return;
    }

    const transform = this.kiteEntity.getComponent<TransformComponent>('transform');
    const physics = this.kiteEntity.getComponent<PhysicsComponent>('physics');

    if (!transform || !physics) {
      this.logger.warn('Cannot log kite state: Missing transform or physics component.', 'LinesRenderSystem');
      return;
    }

    this.logger.info('Kite State:', 'LinesRenderSystem', {
      position: transform.position,
      velocity: physics.velocity,
      mass: physics.mass
    });
  }

  update(context: SimulationContext): void {
    if (!this.kiteEntity || !this.controlBarSystem) {
      if (!this.hasLoggedWarning) {
        this.logger.warn(
          '🔴 LinesRenderSystem: kiteEntity ou controlBarSystem manquant',
          'LinesRenderSystem'
        );
        this.hasLoggedWarning = true;
      }
      return;
    }

    // Log debug pour première exécution
    if (context.frameCount === 1) {
      this.logger.info('🔗 LinesRenderSystem.update() - première exécution', 'LinesRenderSystem');
    }

    // Récupérer les composants du kite
    const kiteGeometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
    const kiteTransform =
      this.kiteEntity.getComponent<TransformComponent>('transform');

    if (!kiteGeometry || !kiteTransform) {
      if (!this.hasLoggedWarning) {
        this.logger.warn(
          '🔴 LinesRenderSystem: kite manque geometry ou transform component',
          'LinesRenderSystem'
        );
        this.hasLoggedWarning = true;
      }
      return;
    }

    // Récupérer les positions des poignées
    const handles = this.controlBarSystem.getHandlePositions();
    if (!handles) {
      return;
    }

    // ✅ NOUVEAU: Récupérer les positions des points CTRL depuis la géométrie du kite
    // Les CTRL sont maintenant des points locaux (architecture couplée)
    const geometry = this.kiteEntity.getComponent<GeometryComponent>('geometry');
    if (!geometry) {
      if (!this.hasLoggedWarning) {
        this.logger.warn(
          '🔴 LinesRenderSystem: géométrie du kite manquante',
          'LinesRenderSystem'
        );
        this.hasLoggedWarning = true;
      }
      return;
    }

    // Utiliser getPointWorld() pour transformer les CTRL locaux en monde
    const ctrlLeftWorld = geometry.getPointWorld('CTRL_GAUCHE', this.kiteEntity);
    const ctrlRightWorld = geometry.getPointWorld('CTRL_DROIT', this.kiteEntity);

    if (!ctrlLeftWorld || !ctrlRightWorld) {
      if (!this.hasLoggedWarning) {
        this.logger.warn(
          '🔴 LinesRenderSystem: points CTRL_GAUCHE/CTRL_DROIT introuvables dans géométrie',
          'LinesRenderSystem'
        );
        this.hasLoggedWarning = true;
      }
      return;
    }

    this.lineEntities.forEach((entity, id) => {
      const baseRenderData = this.lineRenderData.get(id);
      if (!baseRenderData) {
        this.logger.warn(
          `🔴 LinesRenderSystem: aucune donnée de rendu pour ${id}`,
          'LinesRenderSystem'
        );
        return;
      }

      const lineComponent = entity.getComponent<LineComponent>('line');
      // IMPORTANT: Utiliser config.length (au repos) et non getCurrentLength() (avec strain)
      // Car ControlPointSystem positionne les CTRL à exactement config.length du handle
      const dynamicLength = lineComponent
        ? lineComponent.config.length  // Longueur au repos, pas avec strain
        : baseRenderData.maxLength;
      const renderData: LineRenderData = {
        ...baseRenderData,
        maxLength: dynamicLength
      };

      const start = renderData.side === 'left' ? handles.left : handles.right;
      const end = renderData.side === 'left' ? ctrlLeftWorld : ctrlRightWorld;

      // DEBUG: Log pour vérifier l'alignement (1% des frames)
      if (Math.random() < 0.01 && renderData.side === 'left') {
        const actualDist = start.distanceTo(end);
        this.logger.debug('LinesRenderSystem',
          `LEFT line: handle=${start.toArray().map((v: number) => v.toFixed(2))}, ` +
          `ctrl=${end.toArray().map((v: number) => v.toFixed(2))}, ` +
          `maxLength=${renderData.maxLength.toFixed(2)}, ` +
          `actualDist=${actualDist.toFixed(2)}, ` +
          `diff=${(actualDist - renderData.maxLength).toFixed(3)}`
        );
      }

      const geometryData = this.computeLineGeometry(start, end, renderData);

      let meshComp = entity.getComponent<MeshComponent>('mesh');
      if (!meshComp || !(meshComp.object3D instanceof THREE.Mesh)) {
        this.createLineMesh(entity, renderData, geometryData, id);
        meshComp = entity.getComponent<MeshComponent>('mesh');
      } else {
        this.applyLineGeometry(
          entity,
          meshComp.object3D as THREE.Mesh,
          geometryData,
          renderData,
          id
        );
      }

      const meshObject = meshComp?.object3D;
      if (meshObject instanceof THREE.Mesh) {
        this.updateLineColorFromTension(meshObject, renderData.side);
        meshObject.userData.effectiveLength = geometryData.effectiveLength;
        meshObject.userData.slack = geometryData.slack;
      }
    });

    // Periodic logging of kite state
    if (context.frameCount % CONFIG.logging.kiteStateInterval === 0) {
      this.logKiteState();
    }
  }

  private computeLineGeometry(
    start: THREE.Vector3,
    end: THREE.Vector3,
    data: LineRenderData
  ): LineGeometryData {
    const segments = Math.max(4, Math.min(data.segments, CONFIG.thresholds.maxLineSegments));
    const pointData = this.computeLinePoints(start, end, data.maxLength, segments);
    const geometry = this.createTubeGeometry(pointData.points, segments, data.linewidth);

    return {
      geometry,
      points: pointData.points,
      clamped: pointData.clamped,
      effectiveLength: pointData.effectiveLength,
      slack: pointData.slack
    };
  }

  private createLineMesh(
    entity: Entity,
    data: LineRenderData,
    geometryData: LineGeometryData,
    id: string
  ): void {
    this.logger.info(`🔗 Creating line mesh for: ${id}`, 'LinesRenderSystem');
    
    const material = this.createLineMaterial(data);
    const lineMesh = new THREE.Mesh(geometryData.geometry, material);
    lineMesh.name = `line_${id}`;
    lineMesh.castShadow = true;
    lineMesh.receiveShadow = false;
    lineMesh.userData.side = data.side;
    lineMesh.userData.maxLength = data.maxLength;
    lineMesh.userData.effectiveLength = geometryData.effectiveLength;
    lineMesh.userData.slack = geometryData.slack;

    const existingMeshComponent = entity.getComponent<MeshComponent>('mesh');
    if (existingMeshComponent) {
      const previousObject = existingMeshComponent.object3D;
      if (previousObject.parent) {
        previousObject.parent.remove(previousObject);
      }
      if (previousObject instanceof THREE.Mesh) {
        if (previousObject.geometry) {
          previousObject.geometry.dispose();
        }
        const material = previousObject.material;
        if (Array.isArray(material)) {
          material.forEach(mat => {
            if (typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
        } else if (material && typeof material.dispose === 'function') {
          material.dispose();
        }
      }
      existingMeshComponent.object3D = lineMesh;
    } else {
      entity.addComponent(new MeshComponent(lineMesh));
    }

    if (this.scene) {
      this.scene.add(lineMesh);
      this.logger.info(`  ✅ Line mesh ${id} added to scene`, 'LinesRenderSystem');
    } else {
      this.logger.warn(`  ⚠️ No scene available for line ${id}`, 'LinesRenderSystem');
    }

    this.updateLineComponentSegments(entity, geometryData.points);
    this.handleClampLogging(id, geometryData.clamped, data.maxLength, geometryData.effectiveLength);
  }

  private applyLineGeometry(
    entity: Entity,
    mesh: THREE.Mesh,
    geometryData: LineGeometryData,
    data: LineRenderData,
    id: string
  ): void {
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    mesh.geometry = geometryData.geometry;
    mesh.userData.maxLength = data.maxLength;
    mesh.userData.effectiveLength = geometryData.effectiveLength;
    mesh.userData.slack = geometryData.slack;
  mesh.userData.side = data.side;

    this.updateLineComponentSegments(entity, geometryData.points);
    this.handleClampLogging(id, geometryData.clamped, data.maxLength, geometryData.effectiveLength);
  }

  private createLineMaterial(data: LineRenderData): THREE.MeshStandardMaterial {
    const emissiveColor = new THREE.Color(data.color).multiplyScalar(0.35);
    return new THREE.MeshStandardMaterial({
      color: data.color,
      roughness: 0.65,
      metalness: 0.05,
      emissive: emissiveColor,
      emissiveIntensity: 0.6
    });
  }

  private computeLinePoints(
    start: THREE.Vector3,
    end: THREE.Vector3,
    maxLength: number,
    segments: number
  ): { points: THREE.Vector3[]; clamped: boolean; effectiveLength: number; slack: number } {
    const startPoint = start.clone();
    const endPoint = end.clone();
    const spanVector = new THREE.Vector3().subVectors(endPoint, startPoint);
    const spanLength = spanVector.length();
    const epsilon = CONFIG.thresholds.epsilon;

    if (spanLength <= epsilon) {
      return {
        points: [startPoint.clone(), startPoint.clone()],
        clamped: false,
        effectiveLength: 0,
        slack: Math.max(0, maxLength)
      };
    }

    let clamped = false;
    let actualEnd = endPoint.clone();
    let effectiveLength = spanLength;

    if (spanLength > maxLength) {
      // Ligne tendue au max - clamper l'extrémité
      actualEnd = startPoint.clone().add(spanVector.normalize().multiplyScalar(maxLength));
      effectiveLength = maxLength;
      clamped = true;
    }

    // Lignes droites simples : seulement 2 points (start → end)
    const points = [startPoint.clone(), actualEnd];
    const slack = Math.max(0, maxLength - effectiveLength);

    return {
      points,
      clamped,
      effectiveLength,
      slack
    };
  }

  // generatePointsWithSag et approximateCurveLength supprimés (lignes droites seulement)

  private createTubeGeometry(
    points: THREE.Vector3[],
    segments: number,
    linewidth: number
  ): THREE.TubeGeometry {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubularSegments = Math.min(
      CONFIG.thresholds.maxLineSegments,
      Math.max(segments * 4, CONFIG.defaults.meshSegments)
    );
    const radius = Math.max(CONFIG.defaults.tubeRadius, linewidth * 0.001);
    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      CONFIG.defaults.tubeRadialSegments,
      false
    );
  }

  private updateLineComponentSegments(entity: Entity, points: THREE.Vector3[]): void {
    const lineComponent = entity.getComponent<LineComponent>('line');
    if (!lineComponent) {
      return;
    }
    lineComponent.segments = points.map(point => point.clone());
  }

  private handleClampLogging(
    id: string,
    clamped: boolean,
    maxLength: number,
    effectiveLength: number
  ): void {
    if (effectiveLength > maxLength) {
      if (!this.clampedLines.has(id)) {
        this.logger.warn(
          `Line ${id} reached max length (${effectiveLength.toFixed(1)}m/${maxLength.toFixed(1)}m)`,
          'LinesRenderSystem'
        );
        this.clampedLines.add(id);
      }
    } else if (this.clampedLines.delete(id)) {
      // Ligne revenue dans les limites (log silencieux)
    }
  }

  /**
   * Met à jour la couleur de la ligne basée sur les tensions physiques émergentes
   * Respecte le principe : vert (molle) → jaune (moyenne) → rouge (tendue)
   */
  private updateLineColorFromTension(line: THREE.Mesh, side: 'left' | 'right'): void {
    if (!this.kitePhysicsSystem) return;

    // Récupérer les informations de debug du système physique
    const debugInfo = this.kitePhysicsSystem.getDebugInfo?.();
    if (!debugInfo || !debugInfo.lineTensions) return;

    // Calculer la tension pour ce côté (émergente des contraintes physiques)
    const tension = side === 'left' ? debugInfo.lineTensions.left : debugInfo.lineTensions.right;

    // Calculer la couleur basée sur les seuils physiques définis dans CONFIG
    const color = this.calculateTensionColor(tension);

    // Appliquer la couleur au matériau du tube
    const material = line.material as THREE.MeshStandardMaterial;
    if (material && material.color) {
      material.color.setHex(color);
      material.emissive.setHex(color).multiplyScalar(0.35);
    }
  }

  /**
   * Calcule la couleur basée sur la tension selon les principes physiques
   * Vert (faible tension) → Jaune (tension moyenne) → Rouge (forte tension)
   */
  private calculateTensionColor(tension: number): number {
    const { bridleTensionMedium, bridleTensionHigh } = CONFIG.debug;

    // Normaliser la tension entre 0 et 1
    const normalizedTension = Math.min(tension / bridleTensionHigh, 1);

    if (normalizedTension <= 0) {
      return 0x00ff00; // Vert - tension nulle/mollesse
    } else if (normalizedTension < bridleTensionMedium / bridleTensionHigh) {
      // Interpolation vert → jaune pour tensions faibles à moyennes
      const t = normalizedTension / (bridleTensionMedium / bridleTensionHigh);
      const r = Math.round(255 * t);     // 0 → 255 (vert → jaune)
      const g = 255;                    // 255 → 255 (vert → jaune)
      const b = 0;                      // 0 → 0 (vert → jaune)
      return (r << 16) | (g << 8) | b;
    } else {
      // Interpolation jaune → rouge pour tensions moyennes à élevées
      const t = (normalizedTension - bridleTensionMedium / bridleTensionHigh) /
                (1 - bridleTensionMedium / bridleTensionHigh);
      const r = 255;                    // 255 → 255 (jaune → rouge)
      const g = Math.round(255 * (1 - t)); // 255 → 0 (jaune → rouge)
      const b = 0;                      // 0 → 0 (jaune → rouge)
      return (r << 16) | (g << 8) | b;
    }
  }
}
