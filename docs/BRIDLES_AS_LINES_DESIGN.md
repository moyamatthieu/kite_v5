# Implémentation des 6 brides comme lignes physiques

**Date** : 2025-10-01  
**Branche** : feature/bridles-as-lines  
**Objectif** : Modéliser les 6 brides du cerf-volant comme des instances de la classe `Line` avec contraintes PBD

---

## Contexte

### État actuel (AS-IS)

Les brides sont actuellement **visuelles uniquement** :
- 6 lignes THREE.js créées dans `Kite.createBridleLines()`
- Positions calculées géométriquement par `PointFactory`
- **Aucune physique** : pas de contraintes, pas de forces
- Les points de contrôle (CTRL_GAUCHE, CTRL_DROIT) sont positionnés par calcul trigonométrique

```typescript
// Kite.ts (ligne 152-163)
const bridleConnections = [
  // Gauche
  ["CTRL_GAUCHE", "NEZ"],
  ["CTRL_GAUCHE", "INTER_GAUCHE"],
  ["CTRL_GAUCHE", "CENTRE"],
  // Droit
  ["CTRL_DROIT", "NEZ"],
  ["CTRL_DROIT", "INTER_DROIT"],
  ["CTRL_DROIT", "CENTRE"],
];
```

### Problèmes identifiés

1. **Pas de contraintes physiques** : Les brides ne retiennent pas les points d'attache
2. **Géométrie fixe** : Les points CTRL ne peuvent pas bouger dynamiquement
3. **Pas de tensions** : Impossible de savoir quelles brides sont tendues
4. **Pas d'élasticité réaliste** : Les brides Dyneema ont une élasticité négligeable

---

## Objectif (TO-BE)

### Architecture cible

```
Kite
  ├─ leftBridles: Line[3]
  │   ├─ Line { nez → ctrl_gauche, length: 0.68m }
  │   ├─ Line { inter_gauche → ctrl_gauche, length: 0.50m }
  │   └─ Line { centre → ctrl_gauche, length: 0.50m }
  │
  └─ rightBridles: Line[3]
      ├─ Line { nez → ctrl_droit, length: 0.68m }
      ├─ Line { inter_droit → ctrl_droit, length: 0.50m }
      └─ Line { centre → ctrl_droit, length: 0.50m }
```

### Fonctionnalités

1. **Contraintes géométriques** : `ConstraintSolver.enforceBridleConstraints()`
2. **Tensions calculées** : Comme les lignes principales
3. **Visualisation** : Couleur selon tension (vert=molle, rouge=tendue)
4. **Flexibilité** : Possibilité d'ajuster individuellement chaque bride

---

## Plan d'implémentation

### Phase 1 : Créer BridleSystem

Créer `src/simulation/physics/BridleSystem.ts` similaire à `LineSystem.ts` :

```typescript
export class BridleSystem {
  private leftBridles: Line[];   // 3 brides gauches
  private rightBridles: Line[];  // 3 brides droites
  private physics: LinePhysics;  // Réutiliser LinePhysics
  
  constructor(bridleLengths: BridleLengths) {
    // Créer 6 instances Line via BridleFactory
    this.leftBridles = BridleFactory.createLeftBridles(bridleLengths);
    this.rightBridles = BridleFactory.createRightBridles(bridleLengths);
    this.physics = new LinePhysics();
  }
  
  calculateBridleTensions(kite: Kite): BridleTensions {
    // Calculer tensions pour chaque bride (debug/affichage)
    // PAS de forces appliquées (contraintes géométriques)
  }
}
```

### Phase 2 : Créer BridleFactory

Créer `src/factories/BridleFactory.ts` :

```typescript
export class BridleFactory {
  static readonly BRIDLE_CONFIG: LineConfig = {
    stiffness: 5000,      // Plus rigides que lignes principales
    preTension: 10,        // Pré-tension faible
    maxTension: 300,       // Résistance bride Dyneema
    dampingCoeff: 0.02,    // Peu d'amortissement
    linearMassDensity: 0.0003, // Légères
  };
  
  static createLeftBridles(lengths: BridleLengths): Line[] {
    return [
      new Line(
        { ...BRIDLE_CONFIG, length: lengths.nez },
        { kitePoint: "NEZ", barPoint: "CTRL_GAUCHE", id: "bridle_left_nez" }
      ),
      new Line(
        { ...BRIDLE_CONFIG, length: lengths.inter },
        { kitePoint: "INTER_GAUCHE", barPoint: "CTRL_GAUCHE", id: "bridle_left_inter" }
      ),
      new Line(
        { ...BRIDLE_CONFIG, length: lengths.centre },
        { kitePoint: "CENTRE", barPoint: "CTRL_GAUCHE", id: "bridle_left_centre" }
      ),
    ];
  }
  
  static createRightBridles(lengths: BridleLengths): Line[] {
    // Symétrique
  }
}
```

### Phase 3 : Intégrer dans PhysicsEngine

Modifier `PhysicsEngine.ts` :

```typescript
export class PhysicsEngine {
  private lineSystem: LineSystem;      // Lignes principales (2)
  private bridleSystem: BridleSystem;  // Brides (6)
  
  constructor(kite: Kite, controlBarPosition: THREE.Vector3) {
    this.lineSystem = new LineSystem();
    this.bridleSystem = new BridleSystem(kite.getBridleLengths());
  }
  
  update(deltaTime: number, ...) {
    // 1. Calculer forces (vent + gravité)
    // 2. Calculer tensions lignes principales (debug)
    this.lineSystem.calculateLineTensions(...);
    // 3. Calculer tensions brides (debug)
    this.bridleSystem.calculateBridleTensions(kite);
    // 4. Intégration physique
    this.kiteController.update(forces, torque, handles, deltaTime);
  }
}
```

### Phase 4 : Ajouter contraintes dans ConstraintSolver

Modifier `ConstraintSolver.ts` :

```typescript
export class ConstraintSolver {
  static enforceLineConstraints(...) {
    // Contraintes lignes principales (existant)
  }
  
  static enforceBridleConstraints(
    kite: Kite,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    bridleLengths: BridleLengths
  ): void {
    // Pour chaque bride (6 total)
    const bridles = [
      { start: "NEZ", end: "CTRL_GAUCHE", length: bridleLengths.nez },
      { start: "INTER_GAUCHE", end: "CTRL_GAUCHE", length: bridleLengths.inter },
      { start: "CENTRE", end: "CTRL_GAUCHE", length: bridleLengths.centre },
      { start: "NEZ", end: "CTRL_DROIT", length: bridleLengths.nez },
      { start: "INTER_DROIT", end: "CTRL_DROIT", length: bridleLengths.inter },
      { start: "CENTRE", end: "CTRL_DROIT", length: bridleLengths.centre },
    ];
    
    // Résoudre chaque contrainte (PBD)
    bridles.forEach(bridle => {
      const startWorld = kite.getPoint(bridle.start)
        .applyQuaternion(kite.quaternion)
        .add(predictedPosition);
      const endWorld = kite.getPoint(bridle.end)
        .applyQuaternion(kite.quaternion)
        .add(predictedPosition);
      
      const dist = startWorld.distanceTo(endWorld);
      if (dist > bridle.length) {
        // Correction PBD (comme enforceLineConstraints)
      }
    });
  }
}
```

### Phase 5 : Visualisation dynamique

Modifier `Kite.createBridleLines()` :

```typescript
private updateBridleVisualization(tensions: BridleTensions): void {
  // Mettre à jour couleurs selon tensions
  const bridleLines = [
    { line: this.bridleLines.children[0], tension: tensions.leftNez },
    { line: this.bridleLines.children[1], tension: tensions.leftInter },
    // ...
  ];
  
  bridleLines.forEach(({ line, tension }) => {
    const material = line.material as THREE.LineBasicMaterial;
    if (tension > 100) {
      material.color.setHex(0xff0000); // Rouge = tendue
    } else if (tension > 20) {
      material.color.setHex(0xffff00); // Jaune = moyenne
    } else {
      material.color.setHex(0x00ff00); // Vert = molle
    }
  });
}
```

---

## Contraintes techniques

### 1. Points d'attache

Les brides relient des **points sur le kite** (pas pilote ↔ kite) :
- Point NEZ (sur le nez du kite)
- Point INTER_GAUCHE/DROIT (milieu du bord d'attaque)
- Point CENTRE (centre du kite)
- Point CTRL_GAUCHE/DROIT (point de contrôle, calculé dynamiquement)

### 2. Coordonnées locales vs monde

```typescript
// Point local (kite référence)
const localPoint = kite.getPoint("NEZ"); // Vector3(-0.5, 0, 0)

// Point monde (absolu)
const worldPoint = localPoint.clone()
  .applyQuaternion(kite.quaternion)
  .add(kite.position);
```

### 3. Contraintes internes au kite

Les brides créent des **contraintes internes** :
- Elles lient des points du **même objet** (le kite)
- Elles influencent la forme/rigidité du kite
- Différent des lignes principales (kite ↔ pilote)

---

## Types à créer

```typescript
// src/simulation/types/BridleTypes.ts
export interface BridleLengths {
  nez: number;     // Longueur bride nez → ctrl (m)
  inter: number;   // Longueur bride inter → ctrl (m)
  centre: number;  // Longueur bride centre → ctrl (m)
}

export interface BridleTensions {
  leftNez: number;
  leftInter: number;
  leftCentre: number;
  rightNez: number;
  rightInter: number;
  rightCentre: number;
}

export interface BridleAttachment {
  startPoint: string;  // Point anatomique départ (ex: "NEZ")
  endPoint: string;    // Point anatomique arrivée (ex: "CTRL_GAUCHE")
  length: number;      // Longueur au repos (m)
}
```

---

## Avantages attendus

### 1. Physique réaliste
- Contraintes géométriques PBD (comme lignes principales)
- Tensions calculées pour chaque bride
- Comportement émergent (pas de scripts)

### 2. Flexibilité
- Ajuster longueur de chaque bride individuellement
- Tester différentes configurations de bridage
- Détecter brides cassées/molles

### 3. Visualisation
- Couleur selon tension (rouge=tendue)
- Aide au debugging
- Compréhension du comportement

### 4. Cohérence architecturale
- Réutilise `Line`, `LinePhysics`, `LineFactory`
- Même modèle que lignes principales
- Code unifié

---

## Risques et considérations

### 1. Performance
- 6 contraintes supplémentaires à résoudre chaque frame
- Peut ralentir si nombreuses itérations PBD
- **Mitigation** : Limiter itérations, optimiser solver

### 2. Stabilité numérique
- Contraintes internes au kite (peuvent être plus rigides)
- Risque de sur-contrainte si trop de brides
- **Mitigation** : Tolérance adaptée, damping

### 3. Complexité
- Plus de code à maintenir
- Debugging plus difficile (6 brides + 2 lignes = 8 contraintes)
- **Mitigation** : Documentation, visualisation

---

## Validation

### Tests à effectuer

1. **Geometric constraint** : Vérifier que distances respectées
2. **Tension calculation** : Tensions cohérentes (positives, réalistes)
3. **Visual feedback** : Couleurs changent selon tension
4. **Performance** : FPS acceptable (>30 FPS)
5. **Stability** : Pas d'oscillations, pas de NaN

### Cas limites

- Toutes brides tendues simultanément
- Une bride cassée (longueur infinie)
- Rotation extrême du kite
- Collision avec le sol

---

## Roadmap

### Phase 1 (Foundation) - 2-3h
- [ ] Créer `BridleFactory.ts`
- [ ] Créer `BridleSystem.ts`
- [ ] Créer types `BridleTypes.ts`
- [ ] Tests unitaires factories

### Phase 2 (Physics) - 3-4h
- [ ] Implémenter `enforceBridleConstraints()` dans ConstraintSolver
- [ ] Intégrer dans `KiteController.update()`
- [ ] Calculer tensions dans `BridleSystem`
- [ ] Tests contraintes

### Phase 3 (Integration) - 2h
- [ ] Intégrer `BridleSystem` dans `PhysicsEngine`
- [ ] Connecter avec `Kite.getBridleLengths()`
- [ ] Tests d'intégration

### Phase 4 (Visualization) - 2h
- [ ] Modifier `Kite.updateBridleVisualization()`
- [ ] Couleurs selon tensions
- [ ] UI : affichage tensions

### Phase 5 (Polish) - 1-2h
- [ ] Documentation complète
- [ ] Validation manuelle
- [ ] Optimisations performance

**Total estimé** : 10-13 heures

---

## Références

- `src/objects/mechanical/Line.ts` - Entité ligne réutilisable
- `src/simulation/physics/LinePhysics.ts` - Calculs physiques
- `src/factories/LineFactory.ts` - Pattern factory
- `src/simulation/physics/ConstraintSolver.ts` - Solver PBD
- `docs/LINE_CONSTRAINT_FIX.md` - Modèle contraintes géométriques
- `docs/OOP_LINE_ARCHITECTURE.md` - Architecture OOP lignes

---

**Next step** : Commencer Phase 1 avec création de `BridleFactory.ts`
