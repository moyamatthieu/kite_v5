/**
 * SimulationApp.ts - Application principale de simulation (Architecture ECS-inspired)
 *
 * Nouvelle architecture modulaire avec systèmes de simulation séparés.
 * Chaque système (Physics, Wind, Input, Render) fonctionne indépendamment
 * et communique via un contexte partagé.
 */

import * as THREE from 'three';
import { Logger } from '../utils/Logging';
import { UidGenerator } from '../utils/UidGenerator';

// Import des systèmes modulaires
import {
  PhysicsSystem,
  WindSystem,
  InputSystem,
  RenderSystem,
  KitePhysicsSystem,
  type PhysicsState,
  type PhysicsConfig,
  type WindConfig,
  type InputConfig,
  type RenderConfig
} from './systems';

// Import des composants existants (temporairement pour compatibilité)
import { Kite } from '../objects/organic/Kite';
import { UIManager } from './ui/UIManager';
import { CONFIG } from './config/SimulationConfig';
import { KiteGeometry } from './config/KiteGeometry';

export interface SimulationConfig {
  targetFPS: number;
  maxFrameTime: number;
  enableDebug: boolean;
  enableRenderSystem: boolean;
  enableLegacyComponents: boolean; // Nouveau flag pour contrôler les composants legacy
  enableCompletePhysics: boolean; // Flag pour activer KitePhysicsSystem complet
  physics: Partial<PhysicsConfig>;
  wind: Partial<WindConfig>;
  input: Partial<InputConfig>;
  render: Partial<RenderConfig>;
}

export class SimulationApp {
  private logger: Logger;
  private config: SimulationConfig;

  // Systèmes ECS-inspired
  private physicsSystem!: PhysicsSystem;
  private windSystem!: WindSystem;
  private inputSystem!: InputSystem;
  private renderSystem!: RenderSystem;
  private kitePhysicsSystem?: KitePhysicsSystem; // Système physique complet (optionnel)

  // Composants existants (pour compatibilité)
  private kite!: Kite;
  private uiManager!: UIManager;
  private controlBar!: THREE.Group;
  private pilot!: THREE.Mesh;
  private leftLine!: THREE.Line;
  private rightLine!: THREE.Line;

  // Flag indiquant si la physique complète est prête
  private isCompletePhysicsReady: boolean = false;

  // État de simulation
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private clock: THREE.Clock;
  private frameCount: number = 0;
  private totalTime: number = 0;
  private lastFrameTime: number = 0;

  // Gestion des objets physiques
  private physicsObjects = new Map<string, PhysicsState>();
  // Nombre de segments utilisés pour la caténaire (réutilisable)
  private catenarySegments: number = 15;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.logger = Logger.getInstance();
    this.clock = new THREE.Clock();

    // Configuration par défaut
    this.config = {
      targetFPS: 60,
      maxFrameTime: 1/30, // 30 FPS minimum
      enableDebug: true,
      enableRenderSystem: true,
      enableLegacyComponents: true, // Activer pour voir le kite 3D
      enableCompletePhysics: true, // ⭐ Activer physique complète par défaut
      physics: {},
      wind: {},
      input: {},
      render: {},
      ...config
    };

    this.logger.info('SimulationApp initializing with ECS architecture', 'SimulationApp');

    // Initialiser les systèmes
    this.initializeSystems();

    // Initialiser les composants existants (si activés)
    if (this.config.enableLegacyComponents) {
      this.initializeLegacyComponents();
    }
  }

  /**
   * Initialise tous les systèmes de simulation
   */
  private initializeSystems(): void {
    this.logger.info('Initializing simulation systems...', 'SimulationApp');

    // Créer les systèmes avec leurs configurations
    this.physicsSystem = new PhysicsSystem(this.config.physics);
    this.windSystem = new WindSystem(this.config.wind);
    this.inputSystem = new InputSystem(this.config.input);

    // Créer le système de rendu seulement si activé
    if (this.config.enableRenderSystem) {
      this.renderSystem = new RenderSystem(this.config.render);
    }

    this.logger.info('All simulation systems created', 'SimulationApp');
  }

  /**
   * Initialise les composants existants pour compatibilité
   */
  private initializeLegacyComponents(): void {
    this.logger.info('Initializing legacy components...', 'SimulationApp');

    // Configurer la géométrie du kite
    KiteGeometry.setMeshSubdivisionLevel(CONFIG.kite.defaultMeshSubdivisionLevel);

    // Créer la barre de contrôle
    this.setupControlBar();

    // Créer le pilote
    this.pilot = this.setupPilot();

    // Créer les lignes de contrôle
    this.createControlLines();

    // Créer le kite
    this.kite = new Kite();
    this.kite.position.set(0, 5, 0);

    // Note: Le kite sera ajouté à la scène dans initialize() après que RenderSystem soit prêt

    // Créer l'UI Manager (avec des wrappers vers les vraies méthodes)
    const physicsEngineWrapper = {
      getBridleLengths: () => this.getBridleLengths(),
      setBridleLength: (type: string, length: number) => {
        this.setBridleLength(type as 'nez' | 'inter' | 'centre', length);
      },
      setLineLength: (length: number) => this.setLineLength(length),
      setWindParams: (params: any) => this.setWindParams(params),
      getForceSmoothing: () => this.getForceSmoothing(),
      setForceSmoothing: (smoothing: number) => this.setForceSmoothing(smoothing),
      getKiteState: () => this.getKiteState(),
      getWindState: () => this.getWindState(),
      update: () => {},
      // Mocks pour les autres propriétés attendues
      windSimulator: {} as any,
      lineSystem: {} as any,
      bridleSystem: {} as any,
      kiteController: {} as any,
      controlBarManager: {} as any,
      aerodynamicsCalculator: {} as any,
      config: {} as any,
      kite: this.kite,
      controlBar: this.controlBar
    } as any;

    const debugRendererMock = {
      isDebugMode: () => false,
      toggleDebugMode: () => {},
      renderDebugInfo: () => {},
      clearDebugInfo: () => {},
      setDebugMode: () => {},
      renderManager: {} as any,
      debugArrows: [],
      debugMode: false,
      vectorVisibility: {}
    } as any;

    this.uiManager = new UIManager(
      physicsEngineWrapper,
      debugRendererMock,
      () => this.reset(), // resetCallback
      () => { this.isRunning ? this.stop() : this.start(); } // togglePlayCallback
    );

    // Enregistrer le kite comme objet physique
    this.registerPhysicsObject('kite', {
      position: this.kite.position.clone(),
      velocity: new THREE.Vector3(),
      acceleration: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      angularAcceleration: new THREE.Vector3(),
      mass: 0.5, // kg
      momentOfInertia: new THREE.Matrix3().identity()
    });

    // Initialiser KitePhysicsSystem si la physique complète est activée
    if (this.config.enableCompletePhysics) {
      this.logger.info('Initializing complete physics system (KitePhysicsSystem)...', 'SimulationApp');
      this.initializeKitePhysicsSystem();
    }

    this.logger.info('Legacy components initialized', 'SimulationApp');
  }

  /**
   * Initialise le système physique complet du kite
   */
  private async initializeKitePhysicsSystem(): Promise<void> {
    try {
      // Créer KitePhysicsSystem avec la configuration
      this.kitePhysicsSystem = new KitePhysicsSystem({
        windSpeed: CONFIG.wind.defaultSpeed, // km/h
        windDirection: CONFIG.wind.defaultDirection, // degrés
        turbulence: CONFIG.wind.defaultTurbulence, // 0-100
        lineLength: CONFIG.lines.defaultLength,
        pilotPosition: CONFIG.controlBar.position.clone(),
        enableConstraints: true,
        enableAerodynamics: true,
        enableGravity: true
      });

      // Initialiser avec le kite
      await this.kitePhysicsSystem.initialize(this.kite);

      this.isCompletePhysicsReady = true;
      this.logger.info('KitePhysicsSystem initialized successfully', 'SimulationApp');
    } catch (error) {
      this.logger.error(`Failed to initialize KitePhysicsSystem: ${error}`, 'SimulationApp');
      this.isCompletePhysicsReady = false;
    }
  }

  /**
   * Configure la barre de contrôle
   */
  private setupControlBar(): void {
    this.controlBar = new THREE.Group();
    this.controlBar.name = 'ControlBar';

    // Créer la barre de contrôle (code migré depuis legacy)
    const barGeometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.barRadius,
      CONFIG.controlBar.width
    );
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.rotation.z = CONFIG.controlBar.barRotation;
    bar.castShadow = true;
    this.controlBar.add(bar);

    // Créer les poignées
    const handleGeometry = new THREE.CylinderGeometry(
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleRadius,
      CONFIG.controlBar.handleLength
    );
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
    });

    const halfWidth = CONFIG.controlBar.width / 2;
    const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    leftHandle.position.set(-halfWidth, 0, 0);
    leftHandle.castShadow = true;
    this.controlBar.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(halfWidth, 0, 0);
    rightHandle.castShadow = true;
    this.controlBar.add(rightHandle);

    // Positionner la barre de contrôle
    this.controlBar.position.copy(CONFIG.controlBar.position);
    
    console.log('🎮 Control bar created with legacy code');
  }
  
  /**
   * Crée le pilote (migré depuis legacy)
   */
  private setupPilot(): THREE.Mesh {
    const pilotGeometry = new THREE.BoxGeometry(
      CONFIG.pilot.width,
      CONFIG.pilot.height,
      CONFIG.pilot.depth
    );
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8,
    });
    const pilot = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilot.position.set(0, CONFIG.pilot.offsetY, CONFIG.pilot.offsetZ);
    pilot.castShadow = true;
    pilot.name = 'Pilot';
    
    console.log('👤 Pilot created with legacy code');
    return pilot;
  }

  /**
   * Crée les lignes de contrôle (migré depuis legacy)
   */
  private createControlLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: CONFIG.visualization.lineWidth,
    });

    const pointsCount = this.catenarySegments + 1;
    // Préallouer un buffer pour éviter de recréer la géométrie à chaque frame
    const leftPositions = new Float32Array(pointsCount * 3);
    const rightPositions = new Float32Array(pointsCount * 3);

    const leftGeometry = new THREE.BufferGeometry();
    leftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leftPositions, 3));
    leftGeometry.setDrawRange(0, pointsCount);

    const rightGeometry = new THREE.BufferGeometry();
    rightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rightPositions, 3));
    rightGeometry.setDrawRange(0, pointsCount);

    this.leftLine = new THREE.Line(leftGeometry, lineMaterial);
    this.rightLine = new THREE.Line(rightGeometry, lineMaterial);

    console.log('🔗 Control lines created with legacy code');
  }

  /**
   * Met à jour les positions des lignes de contrôle
   */
  private updateControlLines(): void {
    if (!this.leftLine || !this.rightLine || !this.kite) return;

    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) return;

    // Convertir les points locaux du kite en coordonnées monde
    const kiteLeftWorld = ctrlLeft.clone();
    const kiteRightWorld = ctrlRight.clone();
    this.kite.localToWorld(kiteLeftWorld);
    this.kite.localToWorld(kiteRightWorld);

    // Calculer les positions des poignées de la barre
    const barWidth = CONFIG.controlBar.width;
    const halfWidth = barWidth / 2;
    
    const leftHandle = new THREE.Vector3(-halfWidth, 0, 0);
    const rightHandle = new THREE.Vector3(halfWidth, 0, 0);
    this.controlBar.localToWorld(leftHandle);
    this.controlBar.localToWorld(rightHandle);

    // Calculer les lignes avec caténaire réaliste
    const leftPoints = this.calculateCatenary(leftHandle, kiteLeftWorld);
    const rightPoints = this.calculateCatenary(rightHandle, kiteRightWorld);

    // Mettre à jour les positions dans le BufferGeometry existant pour éviter des allocations
    const updateGeometryFromPoints = (line: THREE.Line, points: THREE.Vector3[]) => {
      const geom = line.geometry as THREE.BufferGeometry;
      const attr = geom.getAttribute('position') as THREE.BufferAttribute | null;
      if (!attr) return;

      const array = attr.array as Float32Array;
      const count = Math.min(points.length, this.catenarySegments + 1);
      for (let i = 0; i < count; i++) {
        const p = points[i];
        const idx = i * 3;
        array[idx] = p.x;
        array[idx + 1] = p.y;
        array[idx + 2] = p.z;
      }

      // Si moins de points que prévu, remplir le reste avec la dernière valeur pour éviter artefacts
      if (count < this.catenarySegments + 1) {
        const last = points[points.length - 1];
        for (let i = count; i < this.catenarySegments + 1; i++) {
          const idx = i * 3;
          array[idx] = last.x;
          array[idx + 1] = last.y;
          array[idx + 2] = last.z;
        }
      }

      attr.needsUpdate = true;
    };

    updateGeometryFromPoints(this.leftLine, leftPoints);
    updateGeometryFromPoints(this.rightLine, rightPoints);
  }

  /**
   * Calcule les points d'une caténaire entre deux points
   * Implémente l'affaissement réaliste des lignes sous l'effet de la gravité
   */
  private calculateCatenary(startPos: THREE.Vector3, endPos: THREE.Vector3): THREE.Vector3[] {
    const segments = 15; // Nombre de segments pour une courbe lisse
    const points: THREE.Vector3[] = [];

    // Paramètres physiques
    const lineLength = CONFIG.lines.defaultLength;
    const linearMassDensity = CONFIG.lines.linearMassDensity;
    const gravity = 9.81;

    // Calculer la distance directe entre les points
    const directDistance = startPos.distanceTo(endPos);

    // Estimer la tension basée sur la position du kite (plus il est haut, plus la tension est forte)
    const kiteHeight = Math.max(startPos.y, endPos.y);
    const estimatedTension = 50 + kiteHeight * 8; // Tension de base 50N + 8N par mètre de hauteur

    // Calculer l'affaissement (sag) avec la formule caténaire simplifiée
    // sag = (ρ × g × L²) / (8 × T)
    const sag = (linearMassDensity * gravity * lineLength * lineLength) / (8 * estimatedTension);

    // Si la ligne est très tendue ou très courte, utiliser une ligne droite
    if (directDistance >= lineLength * 0.95 || sag < 0.01) {
      return [startPos.clone(), endPos.clone()];
    }

    // Générer les points de la caténaire
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Position linéaire interpolée entre les deux points
      const point = new THREE.Vector3().lerpVectors(startPos, endPos, t);

      // Ajouter l'affaissement vertical (forme parabolique simplifiée)
      // La formule 4*t*(1-t) donne un maximum au centre (t=0.5) et zéro aux extrémités
      const sagFactor = 4 * t * (1 - t);
      point.y -= sag * sagFactor;

      points.push(point);
    }

    return points;
  }

  /**
   * Initialise l'application de simulation
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Starting SimulationApp initialization...', 'SimulationApp');

      // Initialiser tous les systèmes
      const initPromises = [
        this.physicsSystem.initialize(),
        this.windSystem.initialize(),
        this.inputSystem.initialize()
      ];

      // Ajouter RenderSystem seulement si activé
      if (this.config.enableRenderSystem) {
        initPromises.push(this.renderSystem.initialize());
      }

      await Promise.all(initPromises);

      // Ajouter le kite à la scène maintenant que le RenderSystem est initialisé
      if (this.config.enableLegacyComponents && this.config.enableRenderSystem && this.renderSystem) {
        const scene = this.renderSystem.getScene();
        if (scene && this.kite) {
          scene.add(this.kite);
          scene.add(this.controlBar);
          scene.add(this.pilot);
          scene.add(this.leftLine);
          scene.add(this.rightLine);
          console.log('🪁 Kite, control bar, pilot and lines added to scene');
          console.log('🎭 Scene children count after adding objects:', scene.children.length);
        }
      }

      // Démarrer le rendu (si activé)
      if (this.config.enableRenderSystem) {
        this.renderSystem.startRendering();
      }

      this.isInitialized = true;
      this.logger.info('SimulationApp fully initialized', 'SimulationApp');

    } catch (error) {
      this.logger.error(`SimulationApp initialization failed: ${error}`, 'SimulationApp');
      throw error;
    }
  }

  /**
   * Boucle principale de simulation (ECS-inspired)
   */
  update = (): void => {
    if (!this.isInitialized || !this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, this.config.maxFrameTime);
    this.lastFrameTime = currentTime;

    this.totalTime += deltaTime;
    this.frameCount++;

    // Créer le contexte de simulation partagé
    const context = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: !this.isRunning,
      debugMode: this.config.enableDebug
    };

    try {
      // 1. Mise à jour des entrées (priorité haute)
      this.inputSystem.update(context);

      // 2. Mise à jour du vent
      this.windSystem.update(context);

      // 3. Mise à jour de la physique
      this.physicsSystem.update(context);

      // 4. Mise à jour du rendu (priorité basse)
      if (this.config.enableRenderSystem) {
        this.renderSystem.update(context);
      }

      // 5. Synchronisation avec les composants existants
      this.syncLegacyComponents(context);

      // 6. Mise à jour de l'UI
      this.updateUI(context);

    } catch (error) {
      this.logger.error(`Simulation update error: ${error}`, 'SimulationApp');
    }

    // Continuer la boucle
    if (this.isRunning) {
      requestAnimationFrame(this.update);
    }
  };

  /**
   * Synchronise les composants existants avec les systèmes
   */
  private syncLegacyComponents(context: any): void {
    if (!this.config.enableLegacyComponents) return;

    // Obtenir l'état des entrées
    const inputState = this.inputSystem.getInputState();

    // Appliquer la rotation de la barre
    this.controlBar.rotation.z = inputState.barPosition * Math.PI / 6; // Max ±30°

    // Mettre à jour les lignes de contrôle
    this.updateControlLines();

    // === PHYSIQUE COMPLÈTE avec KitePhysicsSystem ===
    if (this.config.enableCompletePhysics && this.isCompletePhysicsReady && this.kitePhysicsSystem) {
      // Synchroniser la rotation de la barre vers KitePhysicsSystem
      this.kitePhysicsSystem.setBarRotation(inputState.barPosition);

      // Mettre à jour la physique complète
      this.kitePhysicsSystem.update(context);

      // Synchroniser la position et rotation du kite depuis KitePhysicsSystem
      const kiteState = this.kitePhysicsSystem.getKiteState();
      if (kiteState) {
        this.kite.position.copy(kiteState.position);
        this.kite.quaternion.copy(kiteState.orientation);
      }

      // Mettre à jour l'objet physique pour compatibilité avec l'UI
      const kitePhysics = this.physicsObjects.get('kite');
      if (kitePhysics && kiteState) {
        kitePhysics.position.copy(kiteState.position);
        kitePhysics.velocity.copy(kiteState.velocity);
        kitePhysics.acceleration.set(0, 0, 0); // Reset acceleration
        kitePhysics.angularVelocity.copy(kiteState.angularVelocity);
      }
    }
    // === PHYSIQUE SIMPLIFIÉE (fallback) ===
    else {
      // Obtenir l'état physique du kite
      const kitePhysics = this.physicsObjects.get('kite');
      if (kitePhysics) {
        // Synchroniser la position du kite
        this.kite.position.copy(kitePhysics.position);

        // Calculer le vent apparent pour le kite
        const apparentWind = this.windSystem.getApparentWind(
          kitePhysics.position,
          kitePhysics.velocity
        );

        // Appliquer les forces aérodynamiques basées sur le vent apparent
        this.applyAerodynamicForces(kitePhysics, apparentWind, context.deltaTime);

        // Appliquer la gravité
        if (kitePhysics.position.y > 0) {
          const gravityForce = new THREE.Vector3(0, -9.81 * kitePhysics.mass, 0);
          kitePhysics.acceleration.add(gravityForce.divideScalar(kitePhysics.mass));
        } else {
          // Collision avec le sol
          kitePhysics.acceleration.set(0, 0, 0);
          kitePhysics.velocity.set(0, 0, 0);
          kitePhysics.position.y = 0;
        }

        // Intégration simple d'Euler
        kitePhysics.velocity.add(kitePhysics.acceleration.clone().multiplyScalar(context.deltaTime));
        kitePhysics.position.add(kitePhysics.velocity.clone().multiplyScalar(context.deltaTime));
      }
    }

    // Gestion du reset
    if (inputState.resetPressed) {
      this.reset();
    }
  }

  /**
   * Applique les forces aérodynamiques (portance et traînée) au kite
   */
  private applyAerodynamicForces(
    kiteState: any, 
    apparentWind: THREE.Vector3, 
    deltaTime: number
  ): void {
    const windSpeed = apparentWind.length();
    
    // Si le vent est trop faible, pas de forces aérodynamiques significatives
    if (windSpeed < 0.1) return;

    // Paramètres aérodynamiques depuis la configuration
    const liftScale = CONFIG.aero.liftScale;
    const dragScale = CONFIG.aero.dragScale;
    const kiteArea = CONFIG.kite.area;
    const airDensity = CONFIG.physics.airDensity;

    // Direction du vent (normalisée)
    const windDirection = apparentWind.clone().normalize();

    // Calcul de la pression dynamique : q = 0.5 * ρ * v²
    const dynamicPressure = 0.5 * airDensity * windSpeed * windSpeed;

    // Estimation de l'angle d'attaque basé sur la rotation de la barre
    // Plus la barre est tournée, plus l'angle d'attaque est élevé
    const barRotation = this.controlBar.rotation.z;
    const angleOfAttack = Math.abs(barRotation) + 0.2; // Angle de base + contribution barre

    // Coefficients aérodynamiques (simplifiés)
    // CL augmente avec l'angle d'attaque jusqu'à un point, puis diminue
    const cl = Math.sin(angleOfAttack * 2) * liftScale;
    const cd = 0.1 + angleOfAttack * angleOfAttack * dragScale; // CD augmente avec l'angle

    // Calcul des forces
    const liftMagnitude = cl * dynamicPressure * kiteArea;
    const dragMagnitude = cd * dynamicPressure * kiteArea;

    // Portance : perpendiculaire au vent
    // Pour un kite, la portance est principalement verticale
    const liftDirection = new THREE.Vector3(0, 1, 0);
    const liftForce = liftDirection.multiplyScalar(liftMagnitude);

    // Traînée : opposée au vent
    const dragForce = windDirection.clone().multiplyScalar(-dragMagnitude);

    // Appliquer les forces totales
    const totalForce = liftForce.add(dragForce);
    kiteState.acceleration.add(totalForce.divideScalar(kiteState.mass));

    // Debug : afficher les forces dans la console (optionnel)
    if (this.config.enableDebug && Math.random() < 0.01) { // 1% des frames pour éviter le spam
      console.log(`Aéro: Vent=${windSpeed.toFixed(1)}m/s, Portance=${liftMagnitude.toFixed(1)}N, Traînée=${dragMagnitude.toFixed(1)}N`);
    }
  }

  /**
   * Met à jour l'interface utilisateur
   */
  private updateUI(context: any): void {
    // Mettre à jour l'UI si elle existe
    this.updateUIOverlay();
  }

  /**
   * Met à jour l'overlay UI avec les données actuelles
   */
  private updateUIOverlay(): void {
    if (typeof document === 'undefined') return;

    const fpsElement = document.getElementById('fps');
    const posElement = document.getElementById('kite-pos');
    const velElement = document.getElementById('kite-vel');
    const windElement = document.getElementById('wind-speed');
    const barElement = document.getElementById('bar-pos');

    if (fpsElement || posElement || velElement || windElement || barElement) {
      const renderStats = this.renderSystem ? this.renderSystem.getRenderStats() : { fps: 0 };
      const kitePhysics = this.physicsObjects.get('kite');
      const inputState = this.inputSystem.getInputState();
      const windState = this.windSystem.getWindState();

      if (fpsElement) {
        fpsElement.textContent = `FPS: ${renderStats.fps}`;
      }

      if (posElement && kitePhysics) {
        posElement.textContent = `Position: (${kitePhysics.position.x.toFixed(1)}, ${kitePhysics.position.y.toFixed(1)}, ${kitePhysics.position.z.toFixed(1)})`;
      }

      if (velElement && kitePhysics) {
        velElement.textContent = `Vitesse: (${kitePhysics.velocity.x.toFixed(1)}, ${kitePhysics.velocity.y.toFixed(1)}, ${kitePhysics.velocity.z.toFixed(1)})`;
      }

      if (windElement) {
        windElement.textContent = `Vent: ${windState.baseSpeed.toFixed(1)} m/s`;
      }

      if (barElement) {
        barElement.textContent = `Barre: ${(inputState.barPosition * 100).toFixed(0)}%`;
      }
    }
  }

  /**
   * Enregistre un objet physique dans le système
   */
  registerPhysicsObject(id: string, state: PhysicsState): void {
    this.physicsObjects.set(id, state);
    this.physicsSystem.registerPhysicsObject(id, state);
  }

  /**
   * Obtient les statistiques de la simulation
   */
  getStats(): any {
    const fps = this.totalTime > 0 ? this.frameCount / this.totalTime : 0;
    return {
      frameCount: this.frameCount,
      totalTime: this.totalTime,
      fps: fps,
      physicsObjectsCount: this.physicsObjects.size,
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      physics: this.physicsSystem.getStats()
    };
  }

  /**
   * Démarre la simulation
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('SimulationApp must be initialized before starting');
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.logger.info('SimulationApp started', 'SimulationApp');

    // Mettre à jour l'UI
    if (this.uiManager && typeof this.uiManager.updatePlayButton === 'function') {
      this.uiManager.updatePlayButton(true);
    }

    // Démarrer la boucle
    requestAnimationFrame(this.update);
  }

  /**
   * Arrête la simulation
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('SimulationApp stopped', 'SimulationApp');

    // Mettre à jour l'UI
    if (this.uiManager && typeof this.uiManager.updatePlayButton === 'function') {
      this.uiManager.updatePlayButton(false);
    }
  }

  /**
   * Réinitialise la simulation
   */
  reset(): void {
    this.logger.info('Resetting simulation...', 'SimulationApp');

    // Réinitialiser les systèmes
    this.physicsSystem.reset();
    this.windSystem.reset();
    this.inputSystem.reset();
    if (this.renderSystem) {
      this.renderSystem.reset();
    }

    // Réinitialiser KitePhysicsSystem si activé
    if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
      this.kitePhysicsSystem.reset();
    }

    // Réinitialiser l'état
    this.frameCount = 0;
    this.totalTime = 0;

    // Réinitialiser tous les objets physiques enregistrés
    for (const [id, state] of this.physicsObjects) {
      // Réinitialiser les vecteurs physiques
      state.velocity.set(0, 0, 0);
      state.acceleration.set(0, 0, 0);
      state.angularVelocity.set(0, 0, 0);
      state.angularAcceleration.set(0, 0, 0);

      // Réinitialiser les positions selon le type d'objet
      if (id === 'kite') {
        // Position initiale du kite : 95% de la longueur de ligne
        const initialDistance = CONFIG.lines.defaultLength * CONFIG.initialization.initialDistanceFactor;
        const kiteY = CONFIG.initialization.initialKiteY;
        const pilot = this.controlBar.position.clone();
        const dy = kiteY - pilot.y;
        const horizontal = this.calculateHorizontalDistance(initialDistance, dy);
        
        state.position.set(pilot.x, kiteY, pilot.z - horizontal);
      } else {
        // Pour les autres objets, position par défaut
        state.position.set(0, 0, 0);
      }
    }

    // Réinitialiser les composants visuels legacy
    this.kite.position.copy(this.physicsObjects.get('kite')?.position || new THREE.Vector3(0, 5, 0));
    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();

    this.controlBar.rotation.z = 0;
    this.controlBar.quaternion.identity();

    // Mettre à jour les lignes de contrôle
    this.updateControlLines();

    this.logger.info('Simulation reset complete', 'SimulationApp');
  }

  /**
   * Nettoie les ressources de la simulation
   */
  dispose(): void {
    this.logger.info('Disposing SimulationApp', 'SimulationApp');

    // Arrêter la simulation si elle tourne
    if (this.isRunning) {
      this.stop();
    }

    // Disposer les systèmes
    this.physicsSystem.dispose();
    this.windSystem.dispose();
    this.inputSystem.dispose();
    if (this.renderSystem) {
      this.renderSystem.dispose();
    }

    // Nettoyer les objets physiques
    this.physicsObjects.clear();

    // Nettoyer les composants legacy si ils existent
    if (this.config.enableLegacyComponents) {
      // Note: Les composants Three.js sont gérés par le RenderSystem
    }

    this.logger.info('SimulationApp disposed', 'SimulationApp');
  }

  /**
   * Calcule la distance horizontale via Pythagore
   * Utilisé pour positionner le kite initialement
   */
  private calculateHorizontalDistance(hypotenuse: number, vertical: number): number {
    const minHorizontal = 0.1; // m - Distance horizontale minimale pour éviter kite au-dessus du pilote
    return Math.max(
      minHorizontal,
      Math.sqrt(Math.max(0, hypotenuse * hypotenuse - vertical * vertical))
    );
  }

  // === MÉTHODES PUBLIQUES POUR L'INTERFACE UTILISATEUR ===

  /**
   * Met à jour les paramètres du vent
   */
  setWindParams(params: { speed?: number; direction?: number; turbulence?: number }): void {
    // Mettre à jour WindSystem pour la version simplifiée
    if (params.speed !== undefined) {
      // Convertir km/h en m/s
      this.windSystem.updateConfig({ baseSpeed: params.speed / 3.6 });
    }
    if (params.direction !== undefined) {
      // Convertir degrés en radians, direction du vent
      const rad = (params.direction * Math.PI) / 180;
      const direction = new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad));
      this.windSystem.updateConfig({ baseDirection: direction });
    }
    if (params.turbulence !== undefined) {
      this.windSystem.updateConfig({ turbulenceIntensity: params.turbulence });
    }

    // Déléguer à KitePhysicsSystem si activé
    if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setWindParams(params);
    }
  }

  /**
   * Met à jour la longueur des lignes
   */
  setLineLength(length: number): void {
    // Met à jour la longueur des lignes dans la configuration et les systèmes
    if (CONFIG && CONFIG.lines) {
      CONFIG.lines.defaultLength = length;
    }
    if (this.physicsSystem && typeof this.physicsSystem.setLineLength === 'function') {
      this.physicsSystem.setLineLength(length);
    }
    // Mettre à jour la géométrie visuelle des lignes si legacy
    if (this.leftLine && this.rightLine) {
      this.updateControlLines();
    }

    // Déléguer à KitePhysicsSystem si activé
    if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
      this.kitePhysicsSystem.setLineLength(length);
    }

    this.logger.info(`Line length updated to ${length}m`, 'SimulationApp');
  }

  /**
   * Met à jour la longueur d'une bride spécifique
   */
  setBridleLength(type: 'nez' | 'inter' | 'centre', length: number): void {
    if (this.kite) {
      // Mettre à jour les longueurs dans le kite
      const currentLengths = this.kite.getBridleLengths();
      const newLengths = { ...currentLengths, [type]: length };
      this.kite.setBridleLengths(newLengths);

      // Recalculer la géométrie du kite
      this.kite.updateBridleLines();

      // Déléguer à KitePhysicsSystem si activé
      if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
        this.kitePhysicsSystem.setBridleLengths(newLengths);
      }
    }
  }

  /**
   * Obtient les longueurs actuelles des brides
   */
  getBridleLengths(): { nez: number; inter: number; centre: number } {
    return this.kite ? this.kite.getBridleLengths() : { nez: 0.65, inter: 0.65, centre: 0.65 };
  }

  /**
   * Met à jour le lissage des forces
   */
  setForceSmoothing(smoothing: number): void {
    // Met à jour le lissage des forces dans la configuration et le système physique
    if (this.physicsSystem && typeof this.physicsSystem.setForceSmoothing === 'function') {
      this.physicsSystem.setForceSmoothing(smoothing);
    }
    this.logger.info(`Force smoothing updated to ${smoothing}`, 'SimulationApp');
  }

  /**
   * Obtient l'état du lissage des forces
   */
  getForceSmoothing(): number {
    // Retourne la valeur actuelle du lissage des forces depuis le système physique
    if (this.physicsSystem && typeof this.physicsSystem.getForceSmoothing === 'function') {
      return this.physicsSystem.getForceSmoothing();
    }
    return 0.5; // Valeur par défaut
  }

  /**
   * Obtient l'état actuel du kite
   */
  getKiteState(): any {
    // Utiliser KitePhysicsSystem si disponible
    if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
      return this.kitePhysicsSystem.getKiteState();
    }

    // Fallback sur l'objet physique
    const kitePhysics = this.physicsObjects.get('kite');
    return kitePhysics ? {
      position: kitePhysics.position.clone(),
      velocity: kitePhysics.velocity.clone(),
      acceleration: kitePhysics.acceleration.clone()
    } : {};
  }

  /**
   * Obtient l'état actuel du vent
   */
  getWindState(): any {
    // Utiliser KitePhysicsSystem si disponible
    if (this.config.enableCompletePhysics && this.kitePhysicsSystem) {
      const windState = this.kitePhysicsSystem.getWindState();
      if (windState) {
        return {
          speed: windState.speed, // déjà en m/s
          baseSpeed: windState.speed,
          direction: windState.direction
        };
      }
    }

    // Fallback sur WindSystem
    return {
      speed: this.windSystem.getCurrentWindSpeed(),
      baseSpeed: this.windSystem.getCurrentWindSpeed(),
      direction: this.windSystem.getCurrentWindDirection()
    };
  }
}
