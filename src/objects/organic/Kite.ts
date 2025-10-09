
/**
 * Kite.ts - Modèle 3D du cerf-volant delta pour la simulation Kite
 *
 * Rôle :
 *   - Définit la structure, les points anatomiques et les surfaces du cerf-volant
 *   - Utilise les factories pour générer la géométrie, la structure et la toile
 *   - Sert de base à tous les calculs physiques et au rendu
 *
 * Dépendances principales :
 *   - StructuredObject.ts : Classe de base pour tous les objets 3D structurés
 *   - FrameFactory.ts, SurfaceFactory.ts, PointFactory.ts : Factories pour la création des éléments du kite
 *   - Primitive.ts : Utilitaires pour les formes de base
 *   - Types : ICreatable pour l'interface de création
 *   - Three.js : Pour la géométrie et le rendu
 *
 * Relation avec les fichiers adjacents :
 *   - Les factories (FrameFactory, SurfaceFactory, PointFactory) sont utilisées pour générer la structure et la toile
 *   - StructuredObject.ts (dossier core) est la classe mère
 *
 * Utilisation typique :
 *   - Instancié par le moteur physique et le rendu pour manipuler le kite
 *   - Sert de source unique pour les points et la géométrie du kite
 *
 * Voir aussi :
 *   - src/core/StructuredObject.ts
 *   - src/factories/FrameFactory.ts
 *   - src/factories/SurfaceFactory.ts
 *   - src/factories/PointFactory.ts
 */

import * as THREE from "three";

import { StructuredObject } from "../../core/StructuredObject";
import { ICreatable } from "../../types/index";
import { Primitive } from "../../core/Primitive";
import { FrameFactory } from "../../factories/FrameFactory";
import { SurfaceFactory } from "../../factories/SurfaceFactory";
import { PointFactory, BridleLengths } from "../../factories/PointFactory";
import { FactoryRegistry } from "../../factories/FactoryRegistry";
import { CONFIG } from "../../simulation/config/SimulationConfig";

export class Kite extends StructuredObject implements ICreatable {
  private frameFactory: FrameFactory;
  private surfaceFactory: SurfaceFactory;
  // Map centrale des points - Single Source of Truth
  private pointsMap: Map<string, [number, number, number]> = new Map();
  private bridleLines: THREE.Group | null = null;
  private bridleLengthFactor: number = 1.0; // Facteur de longueur virtuelle des brides principales

  // Longueurs physiques des brides (en mètres)
  // LONGUEURS IDENTIQUES : L'équilibre vient de la géométrie, pas des brides
  // Principe: Kite suspendu par CTRL_GAUCHE et CTRL_DROIT sera horizontal
  // si le centre de masse se trouve entre ces deux points (axe X)
  private bridleLengths: BridleLengths = {
    nez: 0.65,     // 65cm - longueur standard
    inter: 0.65,   // 65cm - longueur standard
    centre: 0.65,  // 65cm - longueur standard
  };

  // Paramètres du cerf-volant
  private params = {
    width: 1.65, // Envergure
    height: 0.65, // Hauteur
    depth: 0.20, // Profondeur whiskers
    frameDiameter: 0.01,
    frameColor: "#2a2a2a",
    sailColor: "#ff3333",
    sailOpacity: 0.9,
  };

  constructor(customParams = {}) {
    super("Cerf-volant Delta", false);
    this.params = { ...this.params, ...customParams };
    this.frameFactory = new FrameFactory();
    this.surfaceFactory = new SurfaceFactory();
    this.init();
  }

  /**
   * Définit tous les points anatomiques du cerf-volant
   * Utilise PointFactory pour encapsuler la logique de calcul
   */
  protected definePoints(): void {
    const { width, height, depth } = this.params;

    // Utiliser PointFactory pour calculer les positions avec bridleLengths physiques
    this.pointsMap = PointFactory.calculateDeltaKitePoints({
      width,
      height,
      depth,
      bridleLengths: this.bridleLengths
    });

    // Enregistrer dans StructuredObject pour compatibilité avec le système existant
    this.pointsMap.forEach((position, name) => {
      this.setPoint(name, position);
    });
  }

  /**
   * Construit la structure rigide avec FrameFactory
   */
  protected buildStructure(): void {
    const { frameDiameter, frameColor } = this.params;

    // Créer le frame principal avec la Map de points partagée
    const mainFrameParams = {
      diameter: frameDiameter,
      material: frameColor,
      points: Array.from(this.pointsMap.entries()), // Passer LA Map de référence
      connections: [
        // Épine centrale
        ["NEZ", "SPINE_BAS"] as [string, string],
        // Bords d'attaque
        ["NEZ", "BORD_GAUCHE"] as [string, string],
        ["NEZ", "BORD_DROIT"] as [string, string],
        // Spreader
        ["INTER_GAUCHE", "INTER_DROIT"] as [string, string],
      ],
    };

    const mainFrame = this.frameFactory.createObject(mainFrameParams);
    this.add(mainFrame);

    // Créer les whiskers avec un frame séparé (plus fin)
    const whiskerFrameParams = {
      diameter: frameDiameter / 2,
      material: "#444444",
      points: Array.from(this.pointsMap.entries()), // Même Map de référence
      connections: [
        ["WHISKER_GAUCHE", "FIX_GAUCHE"] as [string, string],
        ["WHISKER_DROIT", "FIX_DROIT"] as [string, string],
      ],
    };

    const whiskerFrame = this.frameFactory.createObject(whiskerFrameParams);
    this.add(whiskerFrame);

    // Créer le système de bridage avec des lignes souples
    this.createBridleLines();
  }

  /**
   * Crée les lignes de bridage souples (visuelles uniquement)
   * Ces lignes représentent des cordes sans élasticité ni effet ressort
   */
  private createBridleLines(): void {
    // Supprimer les anciennes lignes si elles existent
    if (this.bridleLines) {
      this.remove(this.bridleLines);
    }

    this.bridleLines = new THREE.Group();
    this.bridleLines.name = "BridleLines";

    // Configuration des brides
    const bridleConnections = [
      // Bridage gauche (3 lignes partant de CTRL_GAUCHE)
      ["CTRL_GAUCHE", "NEZ"],
      ["CTRL_GAUCHE", "INTER_GAUCHE"],
      ["CTRL_GAUCHE", "CENTRE"],
      // Bridage droit (3 lignes partant de CTRL_DROIT)
      ["CTRL_DROIT", "NEZ"],
      ["CTRL_DROIT", "INTER_DROIT"],
      ["CTRL_DROIT", "CENTRE"],
    ];

    // Matériau pour les lignes de bridage
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: 1,
      opacity: 0.8,
      transparent: true,
    });

    // Créer chaque ligne de bridage
    bridleConnections.forEach(([startName, endName]) => {
      const startPos = this.pointsMap.get(startName);
      const endPos = this.pointsMap.get(endName);

      if (startPos && endPos) {
        // Créer une ligne droite simple (sans effet caténaire pour les brides internes)
        const geometry = new THREE.BufferGeometry();
        const points = [
          new THREE.Vector3(...startPos),
          new THREE.Vector3(...endPos),
        ];
        geometry.setFromPoints(points);

        const line = new THREE.Line(geometry, lineMaterial);
        line.name = `Bridle_${startName}_${endName}`;

        // Stocker la longueur de repos de la bride
        const restLength = new THREE.Vector3(...startPos).distanceTo(
          new THREE.Vector3(...endPos)
        );
        line.userData.restLength = restLength;
        line.userData.startPoint = startName;
        line.userData.endPoint = endName;

        this.bridleLines!.add(line);
      }
    });

    this.add(this.bridleLines!);
  }

  /**
   * Met à jour les lignes de bridage pour suivre les points
   * À appeler si les points bougent dynamiquement
   */
  public updateBridleLines(): void {
    if (!this.bridleLines) return;

    this.bridleLines.children.forEach((line) => {
      if (line instanceof THREE.Line) {
        const startName = line.userData.startPoint;
        const endName = line.userData.endPoint;
        const startPos = this.pointsMap.get(startName);
        const endPos = this.pointsMap.get(endName);

        if (startPos && endPos) {
          const geometry = line.geometry as THREE.BufferGeometry;
          const points = [
            new THREE.Vector3(...startPos),
            new THREE.Vector3(...endPos),
          ];
          geometry.setFromPoints(points);
          geometry.attributes.position.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Met à jour la visualisation des brides selon leurs tensions
   * Couleurs : vert (molle) → jaune (moyenne) → rouge (tendue)
   *
   * @param tensions - Tensions des 6 brides en Newtons
   */
  public updateBridleVisualization(tensions: {
    leftNez: number;
    leftInter: number;
    leftCentre: number;
    rightNez: number;
    rightInter: number;
    rightCentre: number;
  }): void {
    if (!this.bridleLines) return;

    // Mapping nom ligne → tension
    const tensionMap = new Map<string, number>([
      ["Bridle_CTRL_GAUCHE_NEZ", tensions.leftNez],
      ["Bridle_CTRL_GAUCHE_INTER_GAUCHE", tensions.leftInter],
      ["Bridle_CTRL_GAUCHE_CENTRE", tensions.leftCentre],
      ["Bridle_CTRL_DROIT_NEZ", tensions.rightNez],
      ["Bridle_CTRL_DROIT_INTER_DROIT", tensions.rightInter],
      ["Bridle_CTRL_DROIT_CENTRE", tensions.rightCentre],
    ]);

    // Mettre à jour couleur de chaque bride
    this.bridleLines.children.forEach((line) => {
      if (line instanceof THREE.Line) {
        const tension = tensionMap.get(line.name) ?? 0;
        const material = line.material as THREE.LineBasicMaterial;

        // Seuils de tension (N) - centralisés dans CONFIG
        const lowThreshold = CONFIG.debug.bridleTensionLow;
        const highThreshold = CONFIG.debug.bridleTensionHigh;

        if (tension < lowThreshold) {
          // Vert : bride molle
          material.color.setHex(0x00ff00);
          material.opacity = 0.5;
        } else if (tension < highThreshold) {
          // Jaune : tension moyenne
          // Interpolation vert → jaune
          const t = (tension - lowThreshold) / (highThreshold - lowThreshold);
          const r = Math.floor(t * 255);
          const g = 255;
          const b = 0;
          material.color.setRGB(r / 255, g / 255, b / 255);
          material.opacity = 0.6 + t * 0.2; // 0.6 → 0.8
        } else {
          // Rouge : bride tendue
          // Interpolation jaune → rouge
          const t = Math.min((tension - highThreshold) / 100, 1);
          const r = 255;
          const g = Math.floor((1 - t) * 255);
          const b = 0;
          material.color.setRGB(r / 255, g / 255, b / 255);
          material.opacity = 0.8 + t * 0.2; // 0.8 → 1.0
        }
      }
    });
  }

  /**
   * Construit les surfaces avec SurfaceFactory
   */
  protected buildSurfaces(): void {
    const { sailColor, sailOpacity } = this.params;

    // Créer la toile avec 4 panneaux triangulaires
    const sailParams = {
      points: Array.from(this.pointsMap.entries()), // Même Map de référence
      panels: [
        // Toile gauche
        ["NEZ", "BORD_GAUCHE", "WHISKER_GAUCHE"],
        ["NEZ", "WHISKER_GAUCHE", "SPINE_BAS"],
        // Toile droite
        ["NEZ", "BORD_DROIT", "WHISKER_DROIT"],
        ["NEZ", "WHISKER_DROIT", "SPINE_BAS"],
      ],
      material: {
        color: sailColor,
        transparent: true,
        opacity: sailOpacity,
        doubleSided: true, // Visible des deux côtés
      },
    };

    const sail = this.surfaceFactory.createObject(sailParams);
    this.add(sail);

    // Ajouter des marqueurs visuels aux points clés
    this.addVisualMarkers();
  }

  /**
   * Méthode helper pour obtenir la Map de points
   * Peut être utilisée si d'autres objets ont besoin des points
   */
  public getPointsMap(): Map<string, [number, number, number]> {
    return new Map(this.pointsMap); // Retourner une copie pour éviter les modifications externes
  }

  /**
   * Ajuste le facteur de longueur virtuelle des brides principales (NEZ vers CTRL_*)
   * @param factor - Facteur de longueur (0.5 = 50% plus court, 1.0 = normal, 1.5 = 50% plus long)
   */
  public adjustBridleLength(factor: number): void {
    // Limiter la valeur entre 0.5 et 1.5
    this.bridleLengthFactor = Math.max(0.5, Math.min(1.5, factor));
    console.log(
      `📏 Facteur de longueur des brides principales: ${this.bridleLengthFactor}`
    );
  }

  /**
   * Retourne la longueur de repos virtuelle pour les brides principales
   * Utilisé par la physique pour calculer les tensions
   * @param bridleName - 'left' ou 'right'
   * @returns La longueur de repos modifiée ou undefined si pas une bride principale
   */
  public getBridleRestLength(bridleName: "left" | "right"): number | undefined {
    const nez = this.getPoint("NEZ");
    const ctrl = this.getPoint(
      bridleName === "left" ? "CTRL_GAUCHE" : "CTRL_DROIT"
    );

    if (!nez || !ctrl) return undefined;

    // Calculer la distance géométrique réelle
    const realDistance = nez.distanceTo(ctrl);

    // Appliquer le facteur de longueur virtuelle
    // factor < 1 = bride plus courte = plus de tension
    // factor > 1 = bride plus longue = moins de tension
    return realDistance * this.bridleLengthFactor;
  }

  /**
   * Retourne le facteur de longueur actuel des brides
   */
  public getBridleLengthFactor(): number {
    return this.bridleLengthFactor;
  }

  /**
   * Ajuste les longueurs physiques des brides (en mètres)
   * @param lengths - Longueurs des 3 brides { nez, inter, centre }
   */
  public setBridleLengths(lengths: Partial<BridleLengths>): void {
    // Mettre à jour les longueurs (merge avec les valeurs existantes)
    this.bridleLengths = {
      ...this.bridleLengths,
      ...lengths
    };

    console.log(`🪁 Longueurs brides: NEZ=${this.bridleLengths.nez.toFixed(2)}m, INTER=${this.bridleLengths.inter.toFixed(2)}m, CENTRE=${this.bridleLengths.centre.toFixed(2)}m`);

    // Supprimer tous les enfants pour nettoyer l'ancienne géométrie
    this.clearChildren();

    // Recalculer les points avec les nouvelles longueurs
    this.definePoints();

    // Reconstruire le kite avec les nouveaux points
    this.buildStructure();
    this.buildSurfaces();
    this.createBridleLines();

    // Recréer les marqueurs visuels aux nouvelles positions
    this.addVisualMarkers();
  }

  /**
   * Supprime tous les enfants du kite (géométrie, marqueurs, etc.)
   */
  private clearChildren(): void {
    // Supprimer tous les enfants Three.js
    while (this.children.length > 0) {
      this.remove(this.children[0]);
    }
  }

  /**
   * Retourne les longueurs actuelles des brides
   */
  public getBridleLengths(): BridleLengths {
    return { ...this.bridleLengths };
  }

  /**
   * Transforme un point local en coordonnées monde
   *
   * Cette méthode utilitaire évite la duplication du pattern:
   * `localPos.clone().applyQuaternion(kite.quaternion).add(kite.position)`
   *
   * @param localPos - Position dans le repère local du kite
   * @returns Position dans le repère monde
   *
   * @example
   * ```typescript
   * const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
   * const worldPos = kite.localToWorld(ctrlLeft);
   * ```
   */
  public localToWorld(localPos: THREE.Vector3): THREE.Vector3 {
    return localPos
      .clone()
      .applyQuaternion(this.quaternion)
      .add(this.position);
  }

  /**
   * Ajoute des marqueurs visuels aux points importants
   */
  private addVisualMarkers(): void {
    // Nez (point rouge)
    const nez = this.getPoint("NEZ");
    if (nez) {
      const marker = Primitive.sphere(0.025, "#ff0000");
      this.addPrimitiveAt(marker, [nez.x, nez.y, nez.z]);
    }

    // Points de contrôle
    const ctrlG = this.getPoint("CTRL_GAUCHE");
    if (ctrlG) {
      const marker = Primitive.sphere(0.025, "#dc143c");
      this.addPrimitiveAt(marker, [ctrlG.x, ctrlG.y, ctrlG.z]);
    }

    const ctrlD = this.getPoint("CTRL_DROIT");
    if (ctrlD) {
      const marker = Primitive.sphere(0.025, "#b22222");
      this.addPrimitiveAt(marker, [ctrlD.x, ctrlD.y, ctrlD.z]);
    }
  }

  // Implémentation de l'interface ICreatable
  create(): this {
    return this;
  }

  getName(): string {
    return "Cerf-volant Delta v2";
  }

  getDescription(): string {
    return "Cerf-volant delta construit avec les factories CAO";
  }

  getPrimitiveCount(): number {
    return 25; // Frame + surfaces + marqueurs
  }
}

/**
 * AVANTAGES de cette approche avec factories:
 *
 * 1. **Modularité** : Points, frames et surfaces sont gérés par des factories dédiées
 * 2. **Réutilisabilité** : Les factories peuvent être utilisées pour d'autres objets
 * 3. **Paramétrage** : Facile de modifier les paramètres de chaque composant
 * 4. **Composition** : On peut combiner différentes factories
 * 5. **Évolutivité** : Facile d'ajouter de nouvelles fonctionnalités aux factories
 *
 * UTILISATION DE POINTFACTORY:
 * - Tous les points sont définis dans une Map centralisée
 * - PointFactory crée un objet points réutilisable
 * - Pas de symétrie automatique : chaque point est défini explicitement
 * - Permet une gestion cohérente et validée des points anatomiques
 *
 * WORKFLOW CAO:
 * 1. PointFactory → Définir tous les points anatomiques
 * 2. FrameFactory → Construire la structure rigide
 * 3. SurfaceFactory → Ajouter les surfaces/toiles
 * 4. Assembly → Combiner le tout (futur)
 */
