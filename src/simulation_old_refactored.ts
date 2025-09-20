/**
 * Simulation.ts - Simulation de cerf-volant avec physique réaliste
 *
 * 🌬️ CE QUE FAIT CE CODE :
 * Ce fichier simule un vrai cerf-volant dans le vent. Imaginez que vous tenez
 * une barre de contrôle avec deux lignes attachées au cerf-volant.
 * Quand vous tirez sur une ligne, le cerf-volant tourne de ce côté.
 * 
 * 🎮 COMMENT ÇA MARCHE :
 * - Vous tournez la barre avec les flèches du clavier
 * - La rotation tire une ligne et relâche l'autre
 * - Le côté tiré se rapproche, changeant l'angle du cerf-volant
 * - Le vent pousse différemment sur chaque côté
 * - Cette différence fait tourner le cerf-volant naturellement
 * 
 * 🎯 POURQUOI C'EST SPÉCIAL :
 * Au lieu de "tricher" avec des formules magiques, on simule vraiment
 * la physique : le vent, les lignes, le poids, tout comme dans la vraie vie!
 * 
 * Architecture modulaire avec séparation des responsabilités :
 * - PhysicsEngine : Orchestration de la simulation
 * - KiteController : Gestion du cerf-volant  
 * - WindSimulator : Simulation du vent
 * - LineSystem : Système de lignes et contraintes (MODIFIÉ)
 * - ControlBarManager : Gestion centralisée de la barre
 * - RenderManager : Gestion du rendu 3D
 * - InputHandler : Gestion des entrées utilisateur
 * 
 * 
 *   J'ai transformé les commentaires techniques en explications simples avec :

  🎯 Explications claires

  - Ce que fait le code : "Simule un vrai cerf-volant dans le vent"
  - Comment ça marche : "Vous tournez la barre → tire une ligne → kite tourne"
  - Pourquoi c'est fait : "Pour simuler la vraie physique, pas tricher"

  🌍 Analogies du monde réel

  - Vent apparent = "Main par la fenêtre de la voiture"
  - Angle d'incidence = "Main à plat vs de profil face au vent"
  - Couple = "Pousser une porte près ou loin des gonds"
  - Turbulences = "Les tourbillons qu'on sent dehors"
  - Lignes = "Comme des cordes, peuvent tirer mais pas pousser"
  - Rotation barre = "Comme un guidon de vélo"

  📊 Valeurs expliquées

  - MAX_VELOCITY = "30 m/s = 108 km/h"
  - MAX_FORCE = "Comme soulever 100kg"
  - Amortissement = "Le kite perd 2% de sa vitesse"

  🔄 Flux simplifié

  Chaque fonction importante explique :
  1. CE QU'ELLE FAIT - en une phrase simple
  2. COMMENT - les étapes en langage courant
  3. POURQUOI - l'effet sur le cerf-volant

 
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Kite } from "./objects/organic/Kite";

// Imports des modules refactorisés
import { PhysicsConstants } from "./physics/PhysicsConstants";
import { KiteGeometry } from "./geometry/KiteGeometry";
import { WindSimulator } from "./simulation/WindSimulator";
import { AerodynamicsCalculator } from "./physics/AerodynamicsCalculator";
import { ControlBarManager } from "./controls/ControlBarManager";
import { LineSystem } from "./physics/LineSystem";
import { InputHandler } from "./input/InputHandler";
import { RenderManager } from "./rendering/RenderManager";
import { KiteController } from "./controllers/KiteController";
import { PhysicsEngine } from "./physics/PhysicsEngine";
import { CONFIG as GLOBAL_CONFIG } from "./config/GlobalConfig";
import type { WindParams as WindConfiguration } from "./types/wind";
import type { HandlePositions } from "./types/controls";
import type { KiteState as KitePhysicsState } from "./types/kite";

// ==============================================================================
// CONSTANTES PHYSIQUES GLOBALES - Maintenant importées
// ==============================================================================

// ==============================================================================
// GÉOMÉTRIE DU CERF-VOLANT - Maintenant importée
// ==============================================================================

// Configuration maintenant centralisée dans GlobalConfig.ts

// ==============================================================================
// TYPES ET INTERFACES
// ==============================================================================

// Types maintenant importés depuis les modules spécialisés
// WindConfiguration et KitePhysicsState

// ==============================================================================
// CONTROL BAR MANAGER - Maintenant importé
// ==============================================================================

// ==============================================================================
// WIND SIMULATOR - Maintenant importé
// ==============================================================================

// ==============================================================================
// AERODYNAMICS CALCULATOR - Maintenant importé
// ==============================================================================
// ==============================================================================
// LINE SYSTEM - Maintenant importé
// ==============================================================================

// ==============================================================================
// KITE CONTROLLER - Gestion du cerf-volant et de son orientation
// ==============================================================================
// KITE CONTROLLER - Maintenant importé
// ==============================================================================

// ==============================================================================
// INPUT HANDLER - Maintenant importé
// ==============================================================================

// ==============================================================================
// RENDER MANAGER - Gestion du rendu 3D
// ==============================================================================
// ==============================================================================
// RENDER MANAGER - Maintenant importé
// ==============================================================================

// ==============================================================================
// PHYSICS ENGINE - Moteur physique principal
// ==============================================================================
// ==============================================================================
// PHYSICS ENGINE - Maintenant importé
// ==============================================================================

// ==============================================================================
// SIMULATION APP - Application principale
// ==============================================================================

export class Simulation {
  private renderManager: RenderManager;
  private physicsEngine!: PhysicsEngine;
  private inputHandler: InputHandler;
  private kite!: Kite;
  private controlBar!: THREE.Group;
  private clock: THREE.Clock;
  private isPlaying: boolean = true;
  private leftLine: THREE.Line | null = null;
  private rightLine: THREE.Line | null = null;
  private debugMode: boolean = true; // Activé par défaut
  private debugArrows: THREE.ArrowHelper[] = [];
  private frameCount: number = 0;

  constructor() {
    console.log("🚀 Démarrage de la Simulation V7 - Version refactorisée");

    try {
      const container = document.getElementById("app");
      if (!container) {
        throw new Error("Container #app non trouvé");
      }

      this.renderManager = new RenderManager(container);
      this.inputHandler = new InputHandler();
      this.clock = new THREE.Clock();

      this.setupControlBar();
      this.setupKite();
      this.physicsEngine = new PhysicsEngine(
        this.kite,
        this.controlBar.position
      );
      this.setupUIControls();
      this.createControlLines();
      this.animate();
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'initialisation de SimulationV7:",
        error
      );
      throw error;
    }
  }

  private setupKite(): void {
    this.kite = new Kite();
    const pilot = this.controlBar.position.clone();
    const initialDistance = CONFIG.lines.defaultLength * 0.95;

    const kiteY = 7;
    const dy = kiteY - pilot.y;
    const horizontal = Math.max(
      0.1,
      Math.sqrt(Math.max(0, initialDistance * initialDistance - dy * dy))
    );

    this.kite.position.set(pilot.x, kiteY, pilot.z - horizontal);
    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();

    console.log(
      `📍 Position initiale du kite: ${this.kite.position.toArray()}`
    );
    this.renderManager.addObject(this.kite);
  }

  private setupControlBar(): void {
    this.controlBar = new THREE.Group();
    this.controlBar.position.copy(CONFIG.controlBar.position);

    const barGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      CONFIG.controlBar.width
    );
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.rotation.z = Math.PI / 2;
    this.controlBar.add(bar);

    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
    });

    const halfWidth = CONFIG.controlBar.width / 2;
    const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    leftHandle.position.set(-halfWidth, 0, 0);
    this.controlBar.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(halfWidth, 0, 0);
    this.controlBar.add(rightHandle);

    const pilotGeometry = new THREE.BoxGeometry(0.4, 1.6, 0.3);
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8,
    });
    const pilot = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilot.position.set(0, 0.8, 8.5);
    pilot.castShadow = true;

    this.renderManager.addObject(this.controlBar);
    this.renderManager.addObject(pilot);
  }

  private createControlLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: 2,
    });

    const leftGeometry = new THREE.BufferGeometry();
    const rightGeometry = new THREE.BufferGeometry();

    this.leftLine = new THREE.Line(leftGeometry, lineMaterial);
    this.rightLine = new THREE.Line(rightGeometry, lineMaterial);

    this.renderManager.addObject(this.leftLine);
    this.renderManager.addObject(this.rightLine);
  }

  private updateControlLines(): void {
    if (!this.leftLine || !this.rightLine) return;

    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) return;

    const kiteLeftWorld = ctrlLeft.clone();
    const kiteRightWorld = ctrlRight.clone();
    this.kite.localToWorld(kiteLeftWorld);
    this.kite.localToWorld(kiteRightWorld);

    // Utiliser le ControlBarManager pour obtenir les positions
    const handles = this.physicsEngine
      .getControlBarManager()
      .getHandlePositions(this.kite.position);

    const leftPoints = this.physicsEngine
      .getLineSystem()
      .calculateCatenary(handles.left, kiteLeftWorld);
    const rightPoints = this.physicsEngine
      .getLineSystem()
      .calculateCatenary(handles.right, kiteRightWorld);

    this.leftLine.geometry.setFromPoints(leftPoints);
    this.rightLine.geometry.setFromPoints(rightPoints);

    // Mettre à jour la barre visuelle
    this.physicsEngine
      .getControlBarManager()
      .updateVisual(this.controlBar, this.kite);
  }

  private setupUIControls(): void {
    const resetBtn = document.getElementById("reset-sim");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetSimulation();
      });
    }

    const playBtn = document.getElementById("play-pause");
    if (playBtn) {
      playBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.togglePlayPause();
      });
    }

    const debugBtn = document.getElementById("debug-physics");
    if (debugBtn) {
      // Initialiser l'état du bouton
      debugBtn.textContent = this.debugMode ? "🔍 Debug ON" : "🔍 Debug OFF";
      debugBtn.classList.toggle("active", this.debugMode);

      debugBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleDebugMode();
      });
    }

    // Activer la classe debug-mode sur le body si debugMode est true
    if (this.debugMode) {
      document.body.classList.add("debug-mode");
      // Afficher le panneau de debug si le mode debug est activé
      const debugPanel = document.getElementById("debug-panel");
      if (debugPanel) {
        debugPanel.style.display = "block";
      }
    }

    this.setupWindControls();
  }

  private setupWindControls(): void {
    // Configuration des contrôles de vent (identique à V6)
    const speedSlider = document.getElementById(
      "wind-speed"
    ) as HTMLInputElement;
    const speedValue = document.getElementById("wind-speed-value");
    if (speedSlider && speedValue) {
      speedSlider.value = CONFIG.wind.defaultSpeed.toString();
      speedValue.textContent = `${CONFIG.wind.defaultSpeed} km/h`;

      speedSlider.oninput = () => {
        const speed = parseFloat(speedSlider.value);
        this.physicsEngine.setWindParams({ speed });
        speedValue.textContent = `${speed} km/h`;
      };
    }

    const dirSlider = document.getElementById(
      "wind-direction"
    ) as HTMLInputElement;
    const dirValue = document.getElementById("wind-direction-value");
    if (dirSlider && dirValue) {
      dirSlider.value = CONFIG.wind.defaultDirection.toString();
      dirValue.textContent = `${CONFIG.wind.defaultDirection}°`;

      dirSlider.oninput = () => {
        const direction = parseFloat(dirSlider.value);
        this.physicsEngine.setWindParams({ direction });
        dirValue.textContent = `${direction}°`;
      };
    }

    const turbSlider = document.getElementById(
      "wind-turbulence"
    ) as HTMLInputElement;
    const turbValue = document.getElementById("wind-turbulence-value");
    if (turbSlider && turbValue) {
      turbSlider.value = CONFIG.wind.defaultTurbulence.toString();
      turbValue.textContent = `${CONFIG.wind.defaultTurbulence}%`;

      turbSlider.oninput = () => {
        const turbulence = parseFloat(turbSlider.value);
        this.physicsEngine.setWindParams({ turbulence });
        turbValue.textContent = `${turbulence}%`;
      };
    }

    const lengthSlider = document.getElementById(
      "line-length"
    ) as HTMLInputElement;
    const lengthValue = document.getElementById("line-length-value");
    if (lengthSlider && lengthValue) {
      lengthSlider.value = CONFIG.lines.defaultLength.toString();
      lengthValue.textContent = `${CONFIG.lines.defaultLength}m`;

      lengthSlider.oninput = () => {
        const length = parseFloat(lengthSlider.value);
        this.physicsEngine.setLineLength(length);
        lengthValue.textContent = `${length}m`;

        const kitePosition = this.kite.position;
        const pilotPosition = this.controlBar.position;
        const distance = kitePosition.distanceTo(pilotPosition);

        if (distance > length) {
          const direction = kitePosition.clone().sub(pilotPosition).normalize();
          kitePosition.copy(
            pilotPosition.clone().add(direction.multiplyScalar(length * 0.95))
          );
        }
      };
    }

    const bridleSlider = document.getElementById(
      "bridle-length"
    ) as HTMLInputElement;
    const bridleValue = document.getElementById("bridle-length-value");
    if (bridleSlider && bridleValue) {
      bridleSlider.value = "100";
      bridleValue.textContent = "100%";

      bridleSlider.oninput = () => {
        const percent = parseFloat(bridleSlider.value);
        const bridleFactor = percent / 100;
        this.physicsEngine.setBridleFactor(bridleFactor);
        bridleValue.textContent = `${percent}%`;
      };
    }
  }

  private resetSimulation(): void {
    const currentLineLength =
      this.physicsEngine.getLineSystem().lineLength ||
      CONFIG.lines.defaultLength;
    const initialDistance = currentLineLength * 0.95;

    const pilot = this.controlBar.position.clone();
    const kiteY = 7;
    const dy = kiteY - pilot.y;
    const horizontal = Math.max(
      0.1,
      Math.sqrt(Math.max(0, initialDistance * initialDistance - dy * dy))
    );
    this.kite.position.set(pilot.x, kiteY, pilot.z - horizontal);

    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();
    this.controlBar.quaternion.identity();

    this.physicsEngine = new PhysicsEngine(this.kite, this.controlBar.position);
    this.physicsEngine.setLineLength(currentLineLength);

    const speedSlider = document.getElementById(
      "wind-speed"
    ) as HTMLInputElement;
    const dirSlider = document.getElementById(
      "wind-direction"
    ) as HTMLInputElement;
    const turbSlider = document.getElementById(
      "wind-turbulence"
    ) as HTMLInputElement;
    const bridleSlider = document.getElementById(
      "bridle-length"
    ) as HTMLInputElement;

    if (speedSlider && dirSlider && turbSlider) {
      this.physicsEngine.setWindParams({
        speed: parseFloat(speedSlider.value),
        direction: parseFloat(dirSlider.value),
        turbulence: parseFloat(turbSlider.value),
      });
    }
    if (bridleSlider) {
      this.physicsEngine.setBridleFactor(parseFloat(bridleSlider.value) / 100);
    }

    this.updateControlLines();
    console.log(`🔄 Simulation réinitialisée`);
  }

  private togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    const playBtn = document.getElementById("play-pause");
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? "⏸️ Pause" : "▶️ Lancer";
    }
  }

  private toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    const debugBtn = document.getElementById("debug-physics");
    const debugPanel = document.getElementById("debug-panel");

    if (debugBtn) {
      debugBtn.textContent = this.debugMode ? "🔍 Debug ON" : "🔍 Debug OFF";
      debugBtn.classList.toggle("active", this.debugMode);
    }

    // Afficher/masquer le panneau de debug
    if (debugPanel) {
      debugPanel.style.display = this.debugMode ? "block" : "none";
    }

    document.body.classList.toggle("debug-mode", this.debugMode);

    if (!this.debugMode) {
      this.clearDebugArrows();
    }
  }

  private clearDebugArrows(): void {
    this.debugArrows.forEach((arrow) => {
      this.renderManager.removeObject(arrow);
    });
    this.debugArrows = [];
  }

  private updateDebugArrows(): void {
    if (!this.debugMode) return;

    this.clearDebugArrows();

    const kiteState = this.physicsEngine.getKiteController().getState();
    const kitePosition = this.kite.position.clone();

    // Calculer le centre géométrique entre NEZ et SPINE_BAS
    // NEZ est à [0, 0.65, 0] et SPINE_BAS à [0, 0, 0] en coordonnées locales
    // Le centre est donc à [0, 0.325, 0] en local
    const centerLocal = new THREE.Vector3(0, 0.325, 0);
    const centerWorld = this.kite.localToWorld(centerLocal.clone());

    if (kiteState.velocity.length() > 0.1) {
      const velocityArrow = new THREE.ArrowHelper(
        kiteState.velocity.clone().normalize(),
        centerWorld,
        kiteState.velocity.length() * 0.5,
        0x00ff00,
        undefined,
        0.3
      );
      this.renderManager.addObject(velocityArrow);

      this.debugArrows.push(velocityArrow);
    }

    const windSim = this.physicsEngine.getWindSimulator();
    const wind = windSim.getWindAt(kitePosition);
    const relativeWind = wind.clone().sub(kiteState.velocity);

    let cachedForces: { lift: THREE.Vector3; drag: THREE.Vector3 } | undefined;

    if (relativeWind.length() > 0.1) {
      const { lift, drag } = AerodynamicsCalculator.calculateForces(
        relativeWind,
        this.kite.quaternion
      );

      cachedForces = { lift, drag };

      if (lift.length() > 0.01) {
        const liftArrow = new THREE.ArrowHelper(
          lift.clone().normalize(),
          centerWorld,
          Math.sqrt(lift.length()) * 0.3,
          0x0088ff,
          undefined,
          0.3
        );
        this.renderManager.addObject(liftArrow);
        this.debugArrows.push(liftArrow);
      }

      if (drag.length() > 0.01) {
        const dragArrow = new THREE.ArrowHelper(
          drag.clone().normalize(),
          centerWorld,
          Math.sqrt(drag.length()) * 0.3,
          0xff0000,
          undefined,
          0.3
        );
        this.renderManager.addObject(dragArrow);
        this.debugArrows.push(dragArrow);
      }
    }

    this.updateDebugDisplay(kiteState, kitePosition, cachedForces);
  }

  private updateDebugDisplay(
    kiteState: KitePhysicsState,
    kitePosition: THREE.Vector3,
    cachedForces?: { lift: THREE.Vector3; drag: THREE.Vector3 }
  ): void {
    const debugInfo = document.getElementById("debug-info");
    if (!debugInfo || !this.debugMode) return;

    // Utiliser les forces cachées si disponibles, sinon recalculer
    let lift: THREE.Vector3, drag: THREE.Vector3;
    if (cachedForces) {
      lift = cachedForces.lift;
      drag = cachedForces.drag;
    } else {
      const windSim = this.physicsEngine.getWindSimulator();
      const wind = windSim.getWindAt(kitePosition);
      const relativeWind = wind.clone().sub(kiteState.velocity);
      const forces = AerodynamicsCalculator.calculateForces(
        relativeWind,
        this.kite.quaternion
      );
      lift = forces.lift;
      drag = forces.drag;
    }

    // Calcul des tensions des lignes
    const lineLength = this.physicsEngine.getLineSystem().lineLength;
    const handles = this.physicsEngine
      .getControlBarManager()
      .getHandlePositions(kitePosition);

    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");

    let tensionInfo = "N/A";
    if (ctrlLeft && ctrlRight) {
      const kiteLeftWorld = ctrlLeft.clone();
      const kiteRightWorld = ctrlRight.clone();
      this.kite.localToWorld(kiteLeftWorld);
      this.kite.localToWorld(kiteRightWorld);

      const distL = kiteLeftWorld.distanceTo(handles.left);
      const distR = kiteRightWorld.distanceTo(handles.right);
      const tautL = distL >= lineLength - PhysicsConstants.CONTROL_DEADZONE;
      const tautR = distR >= lineLength - PhysicsConstants.CONTROL_DEADZONE;

      tensionInfo = `L:${tautL ? "TENDU" : "RELÂCHÉ"}(${distL.toFixed(2)}m) R:${
        tautR ? "TENDU" : "RELÂCHÉ"
      }(${distR.toFixed(2)}m)`;
    }

    // Informations du vent
    const windParams = this.physicsEngine.getWindSimulator().getParams();

    // Assemblage des informations de debug
    const totalForce = Math.sqrt(lift.lengthSq() + drag.lengthSq());
    const fps = this.clock ? Math.round(1 / this.clock.getDelta()) : 60;

    debugInfo.innerHTML = `
            <strong>🪁 Position Cerf-volant:</strong><br>
            X: ${kitePosition.x.toFixed(2)}m, Y: ${kitePosition.y.toFixed(
      2
    )}m, Z: ${kitePosition.z.toFixed(2)}m<br><br>
            
            <strong>💨 Vent:</strong><br>
            Vitesse: ${windParams.speed.toFixed(1)} km/h<br>
            Direction: ${windParams.direction.toFixed(0)}°<br>
            Turbulence: ${windParams.turbulence.toFixed(1)}%<br><br>
            
            <strong>⚡ Forces Aérodynamiques:</strong><br>
            Portance: ${lift.length().toFixed(3)} N<br>
            Traînée: ${drag.length().toFixed(3)} N<br>
            Force Totale: ${totalForce.toFixed(3)} N<br><br>
            
            <strong>🔗 Tensions Lignes:</strong><br>
            ${tensionInfo}<br><br>
            
            <strong>🏃 Vitesse Cerf-volant:</strong><br>
            ${kiteState.velocity.length().toFixed(2)} m/s<br><br>
            
            <strong>⚙️ Performance:</strong><br>
            FPS: ${fps}<br>
            Statut: <span style="color: #00ff88;">STABLE</span>
        `;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    this.frameCount++;

    // Mise à jour des logs à 60Hz (chaque frame)
    {
      const kitePos = this.kite.position.clone();
      const pilotPos = this.controlBar.position.clone();
      const distance = kitePos.distanceTo(pilotPos);
      const state = this.physicsEngine.getKiteController().getState();

      const currentLineLength = this.physicsEngine.getLineSystem().lineLength;
      const windSim = this.physicsEngine.getWindSimulator();
      const wind = windSim.getWindAt(kitePos);
      const apparent = wind.clone().sub(state.velocity);

      const forces = AerodynamicsCalculator.calculateForces(
        apparent,
        this.kite.quaternion
      );
      const isTaut =
        distance >= currentLineLength * PhysicsConstants.LINE_TENSION_FACTOR;

      // Indicateur de décrochage basé sur la position dans la sphère de contrainte
      const distanceRatio = distance / currentLineLength;
      const isNearStall = distanceRatio > 0.97; // > 97% = proche du décrochage
      const isStalled = distanceRatio > 0.995; // > 99.5% = décroche
      const stallWarning = isStalled
        ? "🚨 DÉCROCHAGE!"
        : isNearStall
        ? "⚠️ Proche décrochage"
        : "";

      // Calcul des métriques aéronautiques
      const metrics = AerodynamicsCalculator.computeMetrics(
        apparent,
        this.kite.quaternion
      );
      const windSpeed = wind.length();
      const apparentSpeed = apparent.length();

      // Afficher l'asym\u00e9trie des forces gauche/droite
      const leftMag = forces.leftForce?.length() || 0;
      const rightMag = forces.rightForce?.length() || 0;
      const asymmetry =
        ((leftMag - rightMag) / Math.max(leftMag + rightMag, 1)) * 100;

      // Forces aérodynamiques totales
      const aeroForceMag = forces.lift.length(); // Force aéro totale

      // Calculer la position dans la fenêtre de vol
      const deltaX = kitePos.x - pilotPos.x;
      const deltaY = kitePos.y - pilotPos.y;
      const deltaZ = kitePos.z - pilotPos.z;

      // Angle X (horizontal) : positif = droite, négatif = gauche
      const angleX = (Math.atan2(deltaX, -deltaZ) * 180) / Math.PI;

      // Angle Y (vertical) : positif = haut, négatif = bas
      const horizontalDist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      const angleY = (Math.atan2(deltaY, horizontalDist) * 180) / Math.PI;

      // Distance Z (profondeur)
      const distZ = Math.abs(deltaZ);

      // Récupérer les infos de contrôle de la barre
      const barRotation = this.physicsEngine
        .getControlBarManager()
        .getRotation();
      const barRotationDeg = Math.round((barRotation * 180) / Math.PI);
      const barDirection =
        barRotation > 0.01 ? "←" : barRotation < -0.01 ? "→" : "─";

      // Calculer les longueurs réelles des lignes
      const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
      const ctrlRight = this.kite.getPoint("CTRL_DROIT");
      const handles = this.physicsEngine
        .getControlBarManager()
        .getHandlePositions(kitePos);

      let leftLineLength = 0;
      let rightLineLength = 0;
      if (ctrlLeft && ctrlRight) {
        const kiteLeftWorld = ctrlLeft.clone();
        const kiteRightWorld = ctrlRight.clone();
        this.kite.localToWorld(kiteLeftWorld);
        this.kite.localToWorld(kiteRightWorld);

        leftLineLength = kiteLeftWorld.distanceTo(handles.left);
        rightLineLength = kiteRightWorld.distanceTo(handles.right);
      }

      // Récupérer les warnings
      const warnings = this.physicsEngine.getKiteController().getWarnings();

      // Construire les indicateurs de warning
      let warningIndicators = "";
      if (warnings.accel) {
        warningIndicators += ` ⚠️A:${warnings.accelValue.toFixed(0)}`;
      }
      if (warnings.velocity) {
        warningIndicators += ` ⚠️V:${warnings.velocityValue.toFixed(0)}`;
      }
      if (warnings.angular) {
        warningIndicators += " ⚠️Ω";
      }

      const logMessage =
        `[Frame ${this.frameCount}] ` +
        `Window: X:${angleX.toFixed(0)}° Y:${angleY.toFixed(
          0
        )}° Z:${distZ.toFixed(1)}m ` +
        `| Pos: [${kitePos.x.toFixed(1)}, ${kitePos.y.toFixed(
          1
        )}, ${kitePos.z.toFixed(1)}] ` +
        `| Vel: ${state.velocity.length().toFixed(1)}m/s ` +
        `| Wind: ${windSpeed.toFixed(1)}m/s App: ${apparentSpeed.toFixed(
          1
        )}m/s ` +
        `| Aero: ${aeroForceMag.toFixed(0)}N AoA: ${metrics.aoaDeg.toFixed(
          0
        )}° ` +
        `| Bar: ${barDirection}${Math.abs(barRotationDeg)}° ` +
        `| Lines L:${leftLineLength.toFixed(1)}m R:${rightLineLength.toFixed(
          1
        )}m ${isTaut ? "✓" : "○"} ` +
        `| F(G/D): ${leftMag.toFixed(0)}/${rightMag.toFixed(0)}N (${
          asymmetry > 0 ? "+" : ""
        }${asymmetry.toFixed(0)}%)` +
        warningIndicators;

      // Afficher dans la console seulement toutes les secondes
      if (this.frameCount % 60 === 0) {
        console.log(`📊 ${logMessage}`);
      }

      // Mettre à jour l'interface à 60Hz
      const logElement = document.getElementById("periodic-log");
      if (logElement) {
        // Formater sur plusieurs lignes pour l'interface
        let htmlMessage = `
                    <div style="line-height: 1.6;">
                        <strong>[Frame ${this.frameCount}]</strong><br>
                        🎯 Fenêtre: X:${angleX.toFixed(0)}° Y:${angleY.toFixed(
          0
        )}° | Profondeur Z:${distZ.toFixed(1)}m<br>
                        📍 Position: [${kitePos.x.toFixed(
                          1
                        )}, ${kitePos.y.toFixed(1)}, ${kitePos.z.toFixed(
          1
        )}] | Altitude: ${kitePos.y.toFixed(1)}m | Vel: ${state.velocity
          .length()
          .toFixed(1)}m/s<br>
                        🌬️ Vent: ${windSpeed.toFixed(1)}m/s (${(
          windSpeed * 3.6
        ).toFixed(0)}km/h) | Apparent: ${apparentSpeed.toFixed(1)}m/s<br>
                        ✈️ Aéro: Force totale ${aeroForceMag.toFixed(
                          0
                        )}N | AoA: ${metrics.aoaDeg.toFixed(0)}°<br>
                        🎮 Barre: ${barDirection} ${Math.abs(
          barRotationDeg
        )}° | Forces G/D: ${leftMag.toFixed(0)}/${rightMag.toFixed(0)}N (${
          asymmetry > 0 ? "+" : ""
        }${asymmetry.toFixed(0)}%)<br>
                        📏 Lignes: G:${leftLineLength.toFixed(
                          1
                        )}m D:${rightLineLength.toFixed(
          1
        )}m | Dist: ${distance.toFixed(1)}/${currentLineLength}m (${(
          distanceRatio * 100
        ).toFixed(0)}%) ${isTaut ? "✅" : "⚠️"}
                        ${
                          stallWarning
                            ? '<br><strong style="color: #ff6b6b;">' +
                              stallWarning +
                              "</strong>"
                            : ""
                        }
                        ${
                          warningIndicators
                            ? '<br><span class="warning">' +
                              warningIndicators +
                              "</span>"
                            : ""
                        }
                    </div>
                `;
        logElement.innerHTML = htmlMessage;
      }
    }

    if (this.isPlaying) {
      try {
        const deltaTime = this.clock.getDelta();
        this.inputHandler.update(deltaTime);
        const targetRotation = this.inputHandler.getTargetBarRotation();

        this.physicsEngine.update(deltaTime, targetRotation, false);
        this.updateControlLines();
        this.updateDebugArrows();
      } catch (error) {
        console.error("❌ Erreur dans la boucle d'animation:", error);
        this.isPlaying = false;
      }
    }

    this.renderManager.render();
  };

  public cleanup(): void {
    console.log("🧹 Nettoyage de SimulationV7...");
    this.isPlaying = false;

    this.debugArrows.forEach((arrow) => {
      this.renderManager.removeObject(arrow);
    });
    this.debugArrows = [];

    if (this.leftLine) {
      this.renderManager.removeObject(this.leftLine);
      this.leftLine = null;
    }
    if (this.rightLine) {
      this.renderManager.removeObject(this.rightLine);
      this.rightLine = null;
    }

    if (this.kite) {
      this.renderManager.removeObject(this.kite);
    }

    if (this.controlBar) {
      this.renderManager.removeObject(this.controlBar);
    }

    console.log("✅ SimulationV7 nettoyée");
  }
}
