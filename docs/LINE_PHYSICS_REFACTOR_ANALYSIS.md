# Analyse Détaillée : Refactoring Physique des Lignes

**Date** : 1 octobre 2025  
**Branche** : `feature/line-physics-refactor`  
**Basé sur** : [LINE_PHYSICS_AUDIT_2025-10-01.md](LINE_PHYSICS_AUDIT_2025-10-01.md)

---

## 📊 État des Lieux : Architecture Actuelle

### Cartographie des Responsabilités (AS-IS)

```
LineSystem.ts (205 lignes)
├── calculateLineTensions()      → Calcul forces + torque
│   ├── Positions poignées       ⚠️ DUPLIQUÉ (aussi dans ControlBarManager)
│   ├── Modèle physique (Hooke)  ⚠️ HARDCODÉ (stiffness, pas de pré-tension)
│   └── Calcul couple            ✅ OK
└── calculateCatenary()           ⚠️ RENDU (devrait être séparé)
    └── Parabole arbitraire       ❌ NON PHYSIQUE (maxSag, catenarySagFactor)

ConstraintSolver.ts (179 lignes)
├── enforceLineConstraints()     ✅ Algorithme PBD (bon)
│   ├── Tolérance                ❌ HARDCODÉ (0.0005 = 0.5mm, trop strict)
│   ├── 2 passes fixes           ⚠️ PAS ADAPTATIF
│   └── Pas de gestion d'échec   ⚠️ FORCE TOUJOURS
└── handleGroundCollision()      ✅ OK

ControlBarManager.ts (124 lignes)
├── getHandlePositions()         ✅ OK (méthode centralisée)
├── setRotation()                ✅ OK
└── updateVisual()               ✅ OK

SimulationConfig.ts
└── lines:
    ├── stiffness: 25000         ❌ 11× TROP RIGIDE (devrait être 2200)
    ├── maxSag: 0.008            ❌ ARBITRAIRE (pas de base physique)
    └── catenarySagFactor: 3     ❌ ARBITRAIRE (pas de base physique)

PhysicsConstants.ts
└── LINE_CONSTRAINT_TOLERANCE    ❌ 0.0005 (0.5mm, trop strict pour temps réel)
```

---

## 🔍 Analyse Détaillée par Fichier

### 1. LineSystem.ts

#### Forces ✅
- Architecture claire avec commentaires pédagogiques
- Séparation logique calcul gauche/droite
- Calcul du couple émergent bien expliqué

#### Faiblesses ❌

**1.1 Calcul Position Poignées Dupliqué** (lignes 90-110)
```typescript
// DUPLIQUÉ : Cette logique existe déjà dans ControlBarManager.getHandlePositions()
const barHalfWidth = CONFIG.controlBar.width * 0.5;
const barRight = new THREE.Vector3(1, 0, 0);
const leftHandleOffset = barRight
  .clone()
  .multiplyScalar(-barHalfWidth)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), controlRotation);
// ...
```

**Recommandation** : Supprimer cette duplication, utiliser `ControlBarManager.getHandlePositions()` directement.

---

**1.2 Modèle Physique Hardcodé** (lignes 125-148)
```typescript
// ❌ PROBLÈME : Loi de Hooke inappropriée pour lignes Dyneema
if (leftDistance > this.lineLength) {
  const extension = leftDistance - this.lineLength;
  const tension = Math.min(
    CONFIG.lines.stiffness * extension,  // stiffness = 25000 (11× trop rigide)
    CONFIG.lines.maxTension
  );
  leftForce = leftLineDir.multiplyScalar(tension);
}
// Si distance < lineLength → AUCUNE force (discontinuité)
```

**Problèmes identifiés** :
- Pas de pré-tension → discontinuité à `distance = lineLength`
- Rigidité irréaliste (25000 au lieu de 2200 N/m)
- Pas de damping (dissipation d'énergie)
- Logique physique mélangée avec orchestration

**Recommandation** : Extraire dans `LinePhysics.ts` avec modèle réaliste.

---

**1.3 Caténaire Non Physique** (lignes 177-202)
```typescript
// ❌ PROBLÈME : Parabole t*(1-t) au lieu de vraie caténaire
const slack = this.lineLength - directDistance;
const sag = slack * CONFIG.lines.maxSag;  // maxSag = 0.008 (arbitraire)

for (let i = 0; i <= segments; i++) {
  const t = i / segments;
  point.y -= CONFIG.lines.catenarySagFactor * sag * t * (1 - t);  // Parabole
}
```

**Problèmes** :
- Forme mathématique incorrecte (parabole vs caténaire)
- Paramètres `maxSag` et `catenarySagFactor` sans base physique
- Logique de rendu dans un fichier de physique

**Recommandation** : Créer `LineCatenaryRenderer.ts` avec formule physique réelle ou supprimer (affichage linéaire suffit pour lignes tendues).

---

### 2. ConstraintSolver.ts

#### Forces ✅
- Implémentation PBD sophistiquée et correcte
- Prise en compte moment d'inertie
- Correction de vitesse pour éviter oscillations

#### Faiblesses ❌

**2.1 Tolérance Excessive** (ligne 52)
```typescript
const tol = PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;  // 0.0005 = 0.5mm
```

**Problème** : 0.5mm est **trop strict** pour simulation temps réel à 60 FPS.  
**Impact** : Coût CPU élevé, convergence difficile.  
**Recommandation** : Passer à 0.01m (1cm), acceptable visuellement.

---

**2.2 Itérations Fixes** (ligne 129)
```typescript
// Deux passes pour mieux satisfaire les contraintes
for (let i = 0; i < 2; i++) {
  solveLine(ctrlLeft, handles.left);
  solveLine(ctrlRight, handles.right);
}
```

**Problèmes** :
- Nombre d'itérations fixe (pas adaptatif)
- Pas de vérification de convergence
- Pas de mode dégradé si échec

**Recommandation** : Boucle adaptative avec condition de convergence.

```typescript
const MAX_ITERATIONS = 5;
let converged = false;

for (let i = 0; i < MAX_ITERATIONS && !converged; i++) {
  const errorLeft = solveLine(ctrlLeft, handles.left);
  const errorRight = solveLine(ctrlRight, handles.right);
  converged = (Math.max(errorLeft, errorRight) < tol);
}

if (!converged) {
  console.warn("Line constraints failed to converge");
  // Mode dégradé : appliquer forces de rappel douces
}
```

---

### 3. ControlBarManager.ts

#### Forces ✅
- Méthode `getHandlePositions()` bien centralisée
- Séparation claire logique/visuel
- Gestion rotation propre

#### Faiblesses ⚠️

**3.1 Limitations Fonctionnelles**
- Pas de contrôle "sheet in/out" (raccourcir/allonger lignes)
- Rotation pure (pas de translation barre)
- Symétrie parfaite (pas d'asymétrie pilote)

**Impact** : Acceptable pour simulateur éducatif, limitant pour training avancé.  
**Recommandation** : **Garder tel quel** pour l'instant (hors scope priorité 1).

---

### 4. SimulationConfig.ts

#### Problèmes Configuration ❌

```typescript
lines: {
  defaultLength: 15,        // ✅ OK
  stiffness: 25000,         // ❌ 11× trop rigide (devrait être 2200)
  maxTension: 1000,         // ⚠️ Élevé mais acceptable
  maxSag: 0.008,            // ❌ Arbitraire
  catenarySagFactor: 3,     // ❌ Arbitraire
}
```

**Paramètres Manquants** :
- `preTension` (50-100N)
- `linearMassDensity` (0.0005 kg/m)
- `dampingCoeff` (0.05)

---

## 🎯 Plan de Refactoring Validé

### Objectifs Prioritaires

1. **Séparer responsabilités** : Physique / Orchestration / Rendu
2. **Corriger paramètres physiques** : stiffness, pré-tension, tolérance
3. **Éliminer duplications** : Positions poignées
4. **Améliorer testabilité** : Modèle physique isolé

### Architecture Cible (TO-BE)

```
src/simulation/
  ├── physics/
  │   ├── LinePhysics.ts              ✨ NEW - Modèle physique pur
  │   │   ├── calculateTensionForce() → F = F₀ + k×Δx + damping
  │   │   └── calculateCatenarySag()  → sag = (ρgL²)/(8T)
  │   │
  │   ├── LineSystem.ts               🔄 REFACTOR - Orchestrateur léger
  │   │   ├── update()                → Délègue à LinePhysics
  │   │   └── SUPPRIME: calculs physiques, positions poignées
  │   │
  │   └── ConstraintSolver.ts         🔧 ADJUST - Améliorer convergence
  │       └── enforceLineConstraints() → Boucle adaptative
  │
  ├── rendering/
  │   └── LineCatenaryRenderer.ts     ✨ NEW (optionnel)
  │       └── renderCatenary()        → Calcul visuel séparé
  │
  └── config/
      ├── SimulationConfig.ts         🔧 CLEAN - Paramètres physiques
      │   └── lines: {
      │       stiffness: 2200,         ← CORRIGÉ
      │       preTension: 75,          ← AJOUTÉ
      │       dampingCoeff: 0.05,      ← AJOUTÉ
      │       linearMassDensity: 0.0005 ← AJOUTÉ
      │     }
      │
      └── PhysicsConstants.ts         🔧 ADJUST
          └── LINE_CONSTRAINT_TOLERANCE: 0.01  ← CORRIGÉ
```

---

## 📋 Étapes de Mise en Œuvre

### ✅ Phase 1 : Configuration (30 min, faible risque)

**Objectif** : Corriger paramètres sans toucher au code

**Fichiers modifiés** : `SimulationConfig.ts`, `PhysicsConstants.ts`

**Actions** :
1. Remplacer `stiffness: 25000` → `2200`
2. Ajouter `preTension: 75`
3. Ajouter `dampingCoeff: 0.05`
4. Ajouter `linearMassDensity: 0.0005`
5. Supprimer `maxSag`, `catenarySagFactor` (obsolètes)
6. Modifier `LINE_CONSTRAINT_TOLERANCE: 0.0005` → `0.01`

**Validation** :
```bash
npm run build  # TypeScript OK
npm run dev    # Comportement visuel (kite moins "raide")
```

---

### ✅ Phase 2 : Créer LinePhysics.ts (1h, risque moyen)

**Objectif** : Extraire modèle physique pur

**Nouveau fichier** : `src/simulation/physics/LinePhysics.ts`

**Responsabilité** : Calcul force de tension uniquement

**Interface** :
```typescript
class LinePhysics {
  constructor(length: number)
  
  calculateTensionForce(
    start: Vector3,
    end: Vector3,
    velocity: Vector3
  ): Vector3
  
  calculateCatenarySag(tension: number): number
  getLength(): number
}
```

**Modèle physique** :
- Pré-tension : F₀ = 75N (toujours présente)
- Élasticité : F = F₀ + k×Δx (si distance > longueur)
- Damping : F_damp = -c × v_along_line
- Limite : F_total ≤ maxTension

**Validation** :
```bash
npm run build
npm run dev
# Vérifier : transitions plus douces, pas de perte de contrôle
```

---

### ✅ Phase 3 : Refactoriser LineSystem.ts (1h, risque moyen)

**Objectif** : Transformer en orchestrateur léger

**Fichier modifié** : `src/simulation/physics/LineSystem.ts`

**Actions** :
1. Créer instances `leftLine` et `rightLine` (LinePhysics)
2. Supprimer calcul position poignées (utiliser ControlBarManager)
3. Remplacer logique physique par appels à `LinePhysics.calculateTensionForce()`
4. Supprimer `calculateCatenary()` (ou déplacer vers renderer)

**Nouvelle signature `update()`** :
```typescript
update(
  kiteState: IKiteState,
  controlBar: ControlBarManager,
  dt: number
): void
```

**Validation** :
```bash
npm run build
npm run dev
# Smoke test : contrôle gauche/droite, pas de régression
```

---

### ⚠️ Phase 4 : Améliorer ConstraintSolver (optionnel, 30 min)

**Objectif** : Convergence adaptative

**Fichier modifié** : `src/simulation/physics/ConstraintSolver.ts`

**Actions** :
1. Remplacer boucle fixe par boucle avec condition convergence
2. Ajouter logging si échec convergence
3. Ajouter mode dégradé (forces de rappel douces)

**Validation** :
```bash
npm run build
npm run dev
# Monitorer console : warnings convergence ?
```

---

## 🧪 Tests de Validation

### Test 1 : Transition Ligne Molle/Tendue
**Objectif** : Vérifier continuité des forces

**Protocole** :
1. Placer kite à distance = lineLength - 0.1m
2. Augmenter progressivement distance de 0.2m
3. Enregistrer force ligne à chaque pas

**Résultat attendu** :
- Avant refactor : Saut de 0N → ~55N (discontinuité)
- Après refactor : Transition douce 75N → 130N

---

### Test 2 : Rigidité Réaliste
**Objectif** : Vérifier que kite est moins "raide"

**Protocole** :
1. Vent constant 18 km/h
2. Impulsion latérale (steering pulse)
3. Mesurer fréquence oscillation

**Résultat attendu** :
- Avant refactor : f ≈ 1.5-2 Hz (trop rapide)
- Après refactor : f ≈ 0.5-1 Hz (réaliste)

---

### Test 3 : Performance ConstraintSolver
**Objectif** : Vérifier que tolérance 0.01 suffit

**Protocole** :
1. Monitorer erreur contrainte moyenne sur 100 frames
2. Comparer temps CPU solveur

**Résultat attendu** :
- Erreur < 1cm (acceptable visuellement)
- Temps CPU -20% (moins d'itérations)

---

## 🚨 Risques Identifiés

### Risque 1 : Régression Comportement
**Probabilité** : Moyenne  
**Impact** : Élevé  
**Mitigation** : Smoke tests après chaque phase, commit atomiques

### Risque 2 : Changement "Feel" Simulation
**Probabilité** : Élevée  
**Impact** : Moyen  
**Mitigation** : Paramètres `stiffness` et `preTension` ajustables, validation pilote

### Risque 3 : Dépendances Cachées
**Probabilité** : Faible  
**Impact** : Moyen  
**Mitigation** : Analyse statique (TypeScript), grep recherche usages

---

## 📝 Checklist Avant Commit

### Phase 1 (Config)
- [ ] `npm run build` sans erreurs
- [ ] Kite démarre et vole
- [ ] Contrôle gauche/droite fonctionne
- [ ] Pas de warning console

### Phase 2 (LinePhysics)
- [ ] Tests unitaires `LinePhysics.calculateTensionForce()`
- [ ] Pré-tension toujours présente (F ≥ 75N)
- [ ] Transition douce ligne molle/tendue
- [ ] `npm run build` OK

### Phase 3 (Refactor LineSystem)
- [ ] Pas de duplication code
- [ ] Utilise `ControlBarManager.getHandlePositions()`
- [ ] Délègue physique à `LinePhysics`
- [ ] Smoke test complet (5 min vol)

### Phase 4 (ConstraintSolver)
- [ ] Convergence < 5 itérations (95% du temps)
- [ ] Pas de warning convergence fréquents
- [ ] Performance ≥ 60 FPS

---

## 🎓 Apprentissages Clés

### Sur la Duplication
- `LineSystem` et `ControlBarManager` calculaient tous deux les positions poignées
- **Leçon** : Toujours chercher "single source of truth"

### Sur les Paramètres
- `maxSag` et `catenarySagFactor` étaient arbitraires sans documentation
- **Leçon** : Paramètres doivent avoir base physique ou être documentés comme "artistiques"

### Sur la Physique
- Loi de Hooke inappropriée pour lignes haute performance (Dyneema)
- **Leçon** : Valider modèles physiques avec littérature/expert domaine

### Sur l'Architecture
- Mélange physique/rendu dans `LineSystem.calculateCatenary()`
- **Leçon** : Séparer modèle (physique) de la vue (rendu)

---

## 📚 Références

- [LINE_PHYSICS_AUDIT_2025-10-01.md](LINE_PHYSICS_AUDIT_2025-10-01.md) - Audit complet
- [Position-Based Dynamics (Müller et al.)](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf)
- Propriétés Dyneema : Module Young E = 110 GPa, ρ = 970 kg/m³

---

**Document créé par** : Agent IA Copilot  
**Date** : 1 octobre 2025  
**Prochaine étape** : Phase 1 - Correction paramètres configuration
