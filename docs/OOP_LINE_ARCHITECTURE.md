# Architecture OOP : Système de Lignes

**Date** : 1 octobre 2025  
**Branche** : `feature/line-physics-refactor`  
**Commit** : `eaef563`

---

## 🎯 Motivation

Suite à l'audit ([LINE_PHYSICS_AUDIT_2025-10-01.md](LINE_PHYSICS_AUDIT_2025-10-01.md)), le système de lignes présentait plusieurs problèmes architecturaux :

- ❌ Logique physique mélangée avec orchestration dans `LineSystem.ts`
- ❌ Pas d'objet métier pour représenter une ligne
- ❌ Paramètres hardcodés et non validés
- ❌ Difficile à tester unitairement

**Solution** : Architecture orientée objet complète avec séparation claire des responsabilités.

---

## 📐 Architecture Créée

```
src/
├── objects/mechanical/
│   └── Line.ts                    ← Entité métier (data)
│
├── simulation/physics/
│   └── LinePhysics.ts             ← Service de calculs (logic)
│
└── factories/
    └── LineFactory.ts             ← Factory pattern (creation)
```

---

## 🧩 Composants

### 1. `Line.ts` - Entité Métier

**Rôle** : Représenter une ligne de cerf-volant avec ses propriétés physiques

**Responsabilité** :
- ✅ Stocker configuration (length, stiffness, preTension, damping, etc.)
- ✅ Gérer points d'attache (kitePoint, barPoint)
- ✅ Exposer état actuel (currentLength, currentTension)
- ❌ **NE FAIT PAS** : Calculs physiques (délégué à LinePhysics)

**Interface Clé** :
```typescript
interface LineConfig {
  length: number;             // Longueur au repos (m)
  stiffness: number;          // Rigidité EA/L (N/m)
  preTension: number;         // Tension minimale (N)
  maxTension: number;         // Tension max (N)
  dampingCoeff: number;       // Amortissement (0-1)
  linearMassDensity: number;  // Masse linéique (kg/m)
}

interface LineAttachments {
  kitePoint: string;          // Ex: "CTRL_GAUCHE"
  barPoint: string;           // Ex: "HANDLE_LEFT"
}

class Line {
  readonly config: Readonly<LineConfig>;
  readonly attachments: Readonly<LineAttachments>;
  
  updateState(length, tension, timestamp): void;
  getCurrentLength(): number;
  getCurrentTension(): number;
  getExtension(): number;
  isTaut(): boolean;
  isNearBreaking(): boolean;
}
```

**Principes** :
- **Immutabilité** : `config` et `attachments` sont `readonly`
- **Tell, don't ask** : Expose état, ne calcule pas
- **Pure TypeScript** : Pas de dépendance Three.js

**Exemple d'utilisation** :
```typescript
const leftLine = new Line({
  length: 15,
  stiffness: 2200,
  preTension: 75,
  maxTension: 800,
  dampingCoeff: 0.05,
  linearMassDensity: 0.0005
}, {
  kitePoint: "CTRL_GAUCHE",
  barPoint: "HANDLE_LEFT"
});

console.log(leftLine.isTaut());        // false (état initial)
console.log(leftLine.getExtension());  // 0m
```

---

### 2. `LinePhysics.ts` - Service de Calculs

**Rôle** : Calculer forces, tensions et caténaire (pure physique)

**Responsabilité** :
- ✅ Calcul force de tension : `F = F₀ + k×Δx - c×v_radial`
- ✅ Calcul affaissement caténaire : `sag = (ρgL²)/(8T)`
- ✅ Points caténaire pour rendu
- ✅ Méthodes utilitaires (énergie élastique, fréquence propre)
- ❌ **NE FAIT PAS** : Gestion d'état (stateless)

**Interface Clé** :
```typescript
interface TensionResult {
  force: Vector3;           // Force vectorielle (N)
  tension: number;          // Magnitude tension (N)
  extension: number;        // Extension actuelle (m)
  currentLength: number;    // Longueur actuelle (m)
  isTaut: boolean;          // Ligne tendue ?
}

class LinePhysics {
  calculateTensionForce(
    line: Line,
    startPos: Vector3,
    endPos: Vector3,
    relativeVelocity: Vector3
  ): TensionResult;
  
  calculateCatenarySag(line: Line, tension: number): number;
  calculateCatenaryPoints(line, start, end, tension, segments): Vector3[];
  calculateElasticEnergy(line: Line): number;
  calculateNaturalFrequency(line: Line, attachedMass: number): number;
}
```

**Modèle Physique** :
```
Tension totale = Élastique + Damping
                = (F₀ + k×Δx) - c×v_radial
                
où :
- F₀ : pré-tension (toujours présente, même ligne molle)
- k×Δx : force élastique (si ligne tendue, Δx > 0)
- c×v_radial : damping (dissipation d'énergie)
```

**Principes** :
- **Pure functions** : Entrées → Sorties, pas d'effet de bord
- **Stateless** : Pas de gestion d'état interne
- **Testable** : Pas de mock Three.js requis

**Exemple d'utilisation** :
```typescript
const physics = new LinePhysics();

const result = physics.calculateTensionForce(
  leftLine,
  new Vector3(0, 10, 0),   // Position kite
  new Vector3(0, 0, 0),    // Position poignée
  new Vector3(0, -1, 0)    // Vitesse relative
);

console.log(`Tension: ${result.tension}N`);
console.log(`Extension: ${result.extension}m`);
console.log(`Ligne tendue: ${result.isTaut}`);

// Appliquer la force au kite
kite.applyForce(result.force);
```

---

### 3. `LineFactory.ts` - Factory Pattern

**Rôle** : Créer des objets Line de manière cohérente

**Responsabilité** :
- ✅ Validation stricte des paramètres
- ✅ Application valeurs par défaut (depuis SimulationConfig)
- ✅ Presets pour configurations typiques
- ✅ Désérialisation JSON

**Interface Clé** :
```typescript
interface LineFactoryParams {
  kitePoint: string;         // Obligatoire
  barPoint: string;          // Obligatoire
  length?: number;           // Optionnel (défaut: CONFIG)
  stiffness?: number;
  preTension?: number;
  maxTension?: number;
  dampingCoeff?: number;
  linearMassDensity?: number;
  id?: string;
}

class LineFactory {
  static createLine(params: LineFactoryParams): Line;
  static createLinePair(length?: number): [Line, Line];
  static createBeginnerLine(kitePoint, barPoint): Line;
  static createExpertLine(kitePoint, barPoint): Line;
  static createSafetyLine(kitePoint, barPoint): Line;
  static fromJSON(json: any): Line;
}
```

**Validation** :
- Points d'attache non vides
- Longueur > 0
- Rigidité > 0
- Pré-tension ≥ 0
- maxTension > preTension
- dampingCoeff dans [0, 1]
- linearMassDensity > 0

**Presets Disponibles** :

| Preset        | Longueur | Rigidité | Pré-Tension | Max Tension | Damping | Usage             |
|---------------|----------|----------|-------------|-------------|---------|-------------------|
| `standard`    | 15m      | 2200 N/m | 75 N        | 800 N       | 0.05    | Configuration par défaut |
| `beginner`    | 12m      | 1800 N/m | 50 N        | 600 N       | 0.08    | Plus stable, moins réactif |
| `expert`      | 20m      | 2200 N/m | 100 N       | 1000 N      | 0.03    | Plus réactif, plus technique |
| `safety`      | 15m      | 3000 N/m | 150 N       | 1500 N      | 0.05    | Ultra-résistante |

**Exemple d'utilisation** :
```typescript
// Ligne standard (depuis config)
const leftLine = LineFactory.createLine({
  kitePoint: "CTRL_GAUCHE",
  barPoint: "HANDLE_LEFT"
});

// Paire gauche/droite
const [left, right] = LineFactory.createLinePair(15);

// Preset débutant
const beginnerLine = LineFactory.createBeginnerLine("CTRL_GAUCHE", "HANDLE_LEFT");

// Ligne personnalisée
const customLine = LineFactory.createLine({
  length: 18,
  stiffness: 2000,
  preTension: 80,
  kitePoint: "CTRL_GAUCHE",
  barPoint: "HANDLE_LEFT"
});
```

---

## 🔄 Workflow Typique

```typescript
// 1. CRÉATION (via Factory)
const [leftLine, rightLine] = LineFactory.createLinePair(15);

// 2. CALCUL PHYSIQUE (via LinePhysics)
const physics = new LinePhysics();

const leftResult = physics.calculateTensionForce(
  leftLine,
  kiteCtrlLeftPosition,
  barHandleLeftPosition,
  relativeVelocity
);

// 3. MISE À JOUR ÉTAT (Line)
leftLine.updateState(
  leftResult.currentLength,
  leftResult.tension,
  performance.now()
);

// 4. APPLICATION FORCE (au kite)
kite.applyForceAtPoint("CTRL_GAUCHE", leftResult.force);

// 5. RENDU CATÉNAIRE (optionnel)
const catenaryPoints = physics.calculateCatenaryPoints(
  leftLine,
  kiteCtrlLeftPosition,
  barHandleLeftPosition,
  leftResult.tension,
  10 // segments
);
// Utiliser catenaryPoints pour dessiner ligne dans Three.js
```

---

## 📊 Comparaison Avant/Après

### Avant (LineSystem direct)
```typescript
// ❌ Tout mélangé dans LineSystem.calculateLineTensions()
if (leftDistance > this.lineLength) {
  const extension = leftDistance - this.lineLength;
  const tension = Math.min(
    CONFIG.lines.stiffness * extension,  // Hardcodé
    CONFIG.lines.maxTension
  );
  leftForce = leftLineDir.multiplyScalar(tension);
}
// Pas de pré-tension, pas de damping, pas d'objet ligne
```

**Problèmes** :
- Logique hardcodée
- Pas d'abstraction
- Difficile à tester
- Pas de validation

### Après (Architecture OOP)
```typescript
// ✅ Séparation claire : Factory → Line → LinePhysics
const leftLine = LineFactory.createLine({
  kitePoint: "CTRL_GAUCHE",
  barPoint: "HANDLE_LEFT"
});

const physics = new LinePhysics();
const result = physics.calculateTensionForce(
  leftLine,
  kitePosition,
  barPosition,
  velocity
);
```

**Avantages** :
- ✅ Séparation responsabilités
- ✅ Validation stricte
- ✅ Testable unitairement
- ✅ Réutilisable
- ✅ Type-safe
- ✅ Immutabilité

---

## 🧪 Testabilité

### Test Unitaire Line
```typescript
describe('Line', () => {
  it('should maintain immutable config', () => {
    const line = LineFactory.createLine({
      kitePoint: "TEST",
      barPoint: "TEST"
    });
    
    expect(() => {
      (line.config as any).stiffness = 999;
    }).toThrow(); // config est readonly
  });
  
  it('should track extension correctly', () => {
    const line = LineFactory.createLine({
      length: 15,
      kitePoint: "TEST",
      barPoint: "TEST"
    });
    
    line.updateState(16, 150, 0);
    expect(line.getExtension()).toBe(1); // 16 - 15
    expect(line.isTaut()).toBe(true);
  });
});
```

### Test Unitaire LinePhysics
```typescript
describe('LinePhysics', () => {
  it('should apply pre-tension even when line is slack', () => {
    const line = LineFactory.createLine({
      length: 15,
      preTension: 75,
      kitePoint: "TEST",
      barPoint: "TEST"
    });
    
    const physics = new LinePhysics();
    const result = physics.calculateTensionForce(
      line,
      new Vector3(0, 10, 0),  // Distance = 10m < 15m
      new Vector3(0, 0, 0),
      new Vector3()
    );
    
    expect(result.tension).toBe(75); // Pré-tension maintenue
    expect(result.isTaut).toBe(false);
  });
  
  it('should add elastic force when line is taut', () => {
    const line = LineFactory.createLine({
      length: 15,
      stiffness: 2200,
      preTension: 75,
      kitePoint: "TEST",
      barPoint: "TEST"
    });
    
    const physics = new LinePhysics();
    const result = physics.calculateTensionForce(
      line,
      new Vector3(0, 16, 0),  // Distance = 16m > 15m
      new Vector3(0, 0, 0),
      new Vector3()
    );
    
    // Tension = preTension + stiffness × extension
    //         = 75 + 2200 × 1
    //         = 2275 N
    expect(result.tension).toBe(2275);
    expect(result.extension).toBe(1);
    expect(result.isTaut).toBe(true);
  });
});
```

### Test Factory
```typescript
describe('LineFactory', () => {
  it('should throw on invalid parameters', () => {
    expect(() => {
      LineFactory.createLine({
        kitePoint: "",  // Vide = invalide
        barPoint: "TEST"
      });
    }).toThrow(LineValidationError);
  });
  
  it('should create line pair with correct attachments', () => {
    const [left, right] = LineFactory.createLinePair(15);
    
    expect(left.attachments.kitePoint).toBe("CTRL_GAUCHE");
    expect(left.attachments.barPoint).toBe("HANDLE_LEFT");
    expect(right.attachments.kitePoint).toBe("CTRL_DROIT");
    expect(right.attachments.barPoint).toBe("HANDLE_RIGHT");
  });
});
```

---

## 🔗 Intégration avec Système Existant

### Prochaine Étape : Refactoriser `LineSystem.ts`

**Objectif** : Transformer LineSystem en orchestrateur léger qui utilise les nouvelles classes

**Changements à faire** :
```typescript
// AVANT
export class LineSystem {
  public lineLength: number;
  
  calculateLineTensions(kite, controlRotation, pilotPosition) {
    // 200 lignes de logique mélangée
  }
}

// APRÈS
export class LineSystem {
  private leftLine: Line;
  private rightLine: Line;
  private physics: LinePhysics;
  
  constructor(lineLength: number) {
    const [left, right] = LineFactory.createLinePair(lineLength);
    this.leftLine = left;
    this.rightLine = right;
    this.physics = new LinePhysics();
  }
  
  update(kite: Kite, controlBar: ControlBarManager, dt: number): void {
    // Délégation pure
    const leftResult = this.physics.calculateTensionForce(...);
    const rightResult = this.physics.calculateTensionForce(...);
    
    // Mise à jour état
    this.leftLine.updateState(leftResult.currentLength, leftResult.tension, Date.now());
    this.rightLine.updateState(rightResult.currentLength, rightResult.tension, Date.now());
    
    // Application forces
    kite.applyForceAtPoint(this.leftLine.attachments.kitePoint, leftResult.force);
    kite.applyForceAtPoint(this.rightLine.attachments.kitePoint, rightResult.force);
  }
}
```

---

## 📚 Références

- **Audit** : [LINE_PHYSICS_AUDIT_2025-10-01.md](LINE_PHYSICS_AUDIT_2025-10-01.md)
- **Analyse** : [LINE_PHYSICS_REFACTOR_ANALYSIS.md](LINE_PHYSICS_REFACTOR_ANALYSIS.md)
- **Pattern** : Factory Method, Tell Don't Ask, Immutability
- **Physique** : Propriétés Dyneema (E = 110 GPa, ρ = 970 kg/m³)

---

## ✅ Checklist Commit

- [x] `Line.ts` créé (entité métier immutable)
- [x] `LinePhysics.ts` créé (service de calculs stateless)
- [x] `LineFactory.ts` créé (factory avec presets)
- [x] `SimulationConfig.ts` corrigé (stiffness, preTension, damping)
- [x] `npm run build` OK (pas d'erreurs TypeScript)
- [x] Documentation créée (ce fichier)
- [ ] Tests unitaires (à créer)
- [ ] Refactoriser `LineSystem.ts` (prochaine étape)
- [ ] Intégration complète (Phase 3)

---

**Prochaine étape** : Phase 3 - Refactoriser `LineSystem.ts` pour utiliser cette architecture OOP.
