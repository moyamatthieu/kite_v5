# Changelog - .github/copilot-instructions.md

## 2025-10-03 - Mise à jour complète avec état actuel du code

### 🎯 Objectif
Mettre à jour la documentation AI agent avec l'avancement réel du code et clarifier les concepts clés de physique PBD.

### ✨ Changements Majeurs

#### 1. Data Flow Détaillé (Section Architecture)
**Avant:** Diagramme simplifié avec noms de méthodes génériques
**Après:** Diagramme complet montrant :
- Le flux exact d'exécution dans `PhysicsEngine.update()`
- Les appels spécifiques : `getApparentWind()`, `calculateForces()`, `calculateLineTensions()`, `calculateBridleTensions()`
- La hiérarchie dans `KiteController.update()` : `integratePhysics()` → `ConstraintSolver` (3 méthodes)
- Le feedback des contraintes PBD sur `state.velocity`

**Impact:** Les agents comprennent maintenant le pipeline physique exact à 60 FPS.

#### 2. Clarification Critique : PBD vs Forces
**Ajout d'une section explicative:**
```
Understanding PBD (Position-Based Dynamics):
- Lines and bridles are **constraints**, not force generators
- They enforce maximum distance between attachment points
- ConstraintSolver applies geometric corrections AFTER force integration
- Tension values are calculated for display/debug only
- Actual forces come from: aerodynamics (lift/drag) + gravity only
```

**Pourquoi:** Cette distinction est CRITIQUE pour éviter que les agents ajoutent des forces de lignes/brides, ce qui casserait le modèle physique.

#### 3. Factories Complètes
**Avant:** Seulement FrameFactory, SurfaceFactory, LineFactory
**Après:** Ajout de :
- `BridleFactory` : Crée les 6 brides physiques (3 gauche + 3 droite)
- `PointFactory` : Calcule tous les points anatomiques incluant attachements de brides

**Impact:** Les agents savent maintenant quels outils utiliser pour créer/modifier les brides.

#### 4. Section "Recent Work" Enrichie
**Ajouts:**
- Détails sur l'implémentation des brides : BridleFactory, ConstraintSolver.enforceBridleConstraints()
- Visualisation par tension (coloration)
- Correction des surfaces (22% de réduction, 47% d'erreur corrigée)
- Référence au `CHANGELOG_surfaces.md`

**Impact:** Les agents comprennent le contexte récent et les corrections critiques de physique.

#### 5. Insights Critiques dans Data Flow
**Ajout de 4 points clés:**
1. `PhysicsEngine.update()` orchestrateur principal à 60 FPS
2. Tensions pour affichage uniquement
3. Forces = aérodynamique + gravité (pas de forces de lignes/brides)
4. ConstraintSolver s'exécute APRÈS intégration des forces

**Impact:** Évite les confusions sur l'ordre d'exécution et la nature des contraintes.

### 📊 Métriques

- **Lignes totales:** 219 (vs ~170 avant)
- **Sections ajoutées:** 1 (PBD explanation)
- **Diagrammes améliorés:** 1 (Data Flow)
- **Références de documentation:** +1 (CHANGELOG_surfaces.md)

### 🔍 Validation

- ✅ Lecture complète de `PhysicsEngine.ts` pour vérifier le flux exact
- ✅ Lecture de `BridleSystem.ts` pour comprendre l'implémentation
- ✅ Lecture de `ConstraintSolver.ts` pour confirmer les 3 méthodes enforce*
- ✅ Lecture de `KiteController.ts` pour confirmer la hiérarchie d'appels
- ✅ Lecture de `CHANGELOG_surfaces.md` pour les détails de correction

### 🎓 Apprentissages Clés pour les AI Agents

1. **Les tensions sont pour l'affichage, pas pour les forces**
   - `LineSystem.calculateLineTensions()` : display only
   - `BridleSystem.calculateBridleTensions()` : display only
   - Les vraies contraintes viennent de `ConstraintSolver.enforce*Constraints()`

2. **L'ordre d'exécution est critique**
   - D'abord : intégrer les forces (F=ma, T=Iα)
   - Ensuite : appliquer les contraintes géométriques (PBD)
   - Enfin : les contraintes modifient velocity/angularVelocity par feedback

3. **Les brides sont des contraintes internes au kite**
   - 6 brides = 6 instances de `Line`
   - Créées par `BridleFactory`
   - Contraintes appliquées par `ConstraintSolver.enforceBridleConstraints()`
   - Visualisées par couleur selon tension

4. **Les surfaces sont calculées, pas codées en dur**
   - `KiteGeometry.calculateTriangleArea()` depuis coordonnées 3D
   - Total: 0.5288 m² (correction de 22% depuis valeurs hardcodées)
   - Impact direct sur forces aérodynamiques

### 📝 Fichiers Sources Analysés

- `src/simulation/SimulationApp.ts` (orchestration principale)
- `src/simulation/physics/PhysicsEngine.ts` (cœur du moteur)
- `src/simulation/physics/BridleSystem.ts` (système de brides)
- `src/simulation/physics/ConstraintSolver.ts` (contraintes PBD)
- `src/simulation/controllers/KiteController.ts` (contrôle du kite)
- `src/objects/organic/Kite.ts` (modèle 3D)
- `CHANGELOG_surfaces.md` (corrections récentes)

### 🚀 Prochaines Améliorations Possibles

1. Ajouter section "Common Pitfalls" avec erreurs fréquentes
2. Documenter les limites physiques (max velocity, max acceleration)
3. Expliquer le système de lissage des forces (FORCE_SMOOTHING = 0.8)
4. Ajouter diagramme des dépendances entre modules
5. Documenter les tests manuels existants dans `tests/manual/`

---

**Auteur:** Assistant AI (analyse automatisée du codebase)  
**Date:** 3 octobre 2025  
**Impact:** Documentation critique pour onboarding des AI coding agents
