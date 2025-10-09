# Fonctionnalités Manquantes - Analyse Post-Refactorisation

**Date**: 2025-10-09
**Branche**: `refactor/code-cleanup`
**Statut**: KitePhysicsSystem intégré ✅, mais composants visuels/UI incomplets

---

## ✅ Ce qui est FONCTIONNEL

### Physique Complète (KitePhysicsSystem)
- ✅ WindSimulator - Vent apparent, turbulence, rafales
- ✅ AerodynamicsCalculator - Forces par surface
- ✅ LineSystem - Calcul tensions lignes
- ✅ BridleSystem - 6 contraintes de brides (PBD)
- ✅ ConstraintSolver - Algorithme PBD complet
- ✅ KiteController - Intégration F=ma, T=Iα
- ✅ ControlBarManager - Gestion différentiel

### Architecture ECS
- ✅ SimulationApp - Orchestrateur principal
- ✅ RenderSystem - Scène Three.js, lumières, sol
- ✅ WindSystem - Vent de base avec turbulence
- ✅ InputSystem - Gestion clavier/souris avec lissage
- ✅ PhysicsSystem - Base (gravité, collision sol)

### Modèle 3D
- ✅ Kite - Structure complète (frame, toile, brides visuelles)
- ✅ Points anatomiques calculés (PointFactory)
- ✅ Visualisation tensions brides (couleurs)

---

## ❌ Ce qui MANQUE

### 1. **Visualisation Complète** (Priorité: HAUTE)

#### A. Lignes de Contrôle avec Caténaire
**Ancien code**: `SimulationApp.ts:283-419` (consolidated_sources.txt)

Fonctionnalités manquantes:
- ❌ Lignes de contrôle visuelles (leftLine, rightLine)
- ❌ Calcul caténaire réaliste (affaissement sous gravité)
- ❌ Mise à jour dynamique selon position kite
- ❌ BufferGeometry optimisé (15 segments)

**Code à réintégrer**:
```typescript
// src/simulation/SimulationApp.ts (lignes 283-419)
private createControlLines(): void {
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x333333,
    linewidth: CONFIG.visualization.lineWidth,
  });
  // ... (voir consolidated_sources.txt:2886-3100)
}

private calculateCatenary(startPos, endPos): THREE.Vector3[] {
  // Formule: sag = (ρ × g × L²) / (8 × T)
  // ... (voir consolidated_sources.txt:378-419)
}
```

#### B. Pilote Visuel
**Ancien code**: `SimulationApp.ts:262-280`

Fonctionnalités manquantes:
- ❌ Mesh du pilote (BoxGeometry) visible
- ❌ Position cohérente avec barre de contrôle
- ❌ Ombres portées

**Code à réintégrer**:
```typescript
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
  return pilot;
}
```

#### C. Debug Arrows
**Manquant**: Visualisation des forces aérodynamiques

Fonctionnalités manquantes:
- ❌ Flèches pour portance (vert)
- ❌ Flèches pour traînée (rouge)
- ❌ Flèches pour couple (bleu)
- ❌ Toggle on/off depuis UI

**À implémenter**: `DebugRenderer` dans `KitePhysicsSystem`

---

### 2. **Interface Utilisateur** (Priorité: MOYENNE)

#### A. Sliders Fonctionnels
**Ancien code**: `UIManager.ts`

Sliders manquants:
- ❌ Longueur ligne (15-50m)
- ❌ Vitesse vent (0-50 km/h)
- ❌ Direction vent (0-360°)
- ❌ Turbulence (0-100%)
- ❌ Longueurs brides (NEZ, INTER, CENTRE: 0.3-0.8m)
- ❌ Force smoothing (0-1)

**État actuel**:
- UIManager existe mais avec mocks
- Pas de connexion réelle avec KitePhysicsSystem

**À faire**:
```typescript
// Dans SimulationApp.ts
const physicsEngineWrapper = {
  getBridleLengths: () => this.kitePhysicsSystem?.getBridleLengths(),
  setBridleLength: (type, length) => this.kitePhysicsSystem?.setBridleLengths({[type]: length}),
  setWindParams: (params) => this.kitePhysicsSystem?.setWindParams(params),
  // ... etc
};

this.uiManager = new UIManager(
  physicsEngineWrapper, // ✅ Connexion réelle
  debugRendererMock,    // ❌ À remplacer
  () => this.reset(),
  () => this.togglePlay()
);
```

#### B. Affichage Statistiques Temps Réel
**Manquant**: HUD avec métriques détaillées

Métriques manquantes:
- ❌ FPS temps réel
- ❌ Position kite (X, Y, Z)
- ❌ Vitesse kite (m/s)
- ❌ Vent apparent (magnitude, direction)
- ❌ Tensions lignes (N)
- ❌ Angle d'attaque (°)
- ❌ Force portance/traînée (N)

**À implémenter**: Overlay HTML avec `updateUIOverlay()`

---

### 3. **Fonctionnalités Physiques Avancées** (Priorité: BASSE)

#### A. Intégrateur Plus Précis
**Actuel**: Euler simple
**Manquant**: Verlet ou RK4

Avantages:
- Meilleure conservation énergie
- Stabilité accrue pour grandes vitesses
- Moins de dérive numérique

#### B. Déformation de la Toile
**Manquant**: Mesh déformable selon forces

Fonctionnalités:
- ❌ Subdivision dynamique surfaces
- ❌ Vertex shader pour déformation
- ❌ Calcul par vertex des forces aéro

#### C. Historique et Replay
**Manquant**: Enregistrement trajectoire

Fonctionnalités:
- ❌ Record position/rotation/forces
- ❌ Playback timeline
- ❌ Export JSON
- ❌ Import JSON

---

## 📋 Plan d'Action Recommandé

### Phase 1: Visualisation Critique (1-2h)
**Objectif**: Avoir une simulation visuellement complète

1. ✅ **Déjà fait**: KitePhysicsSystem intégré
2. ⏳ **Maintenant**: Ajouter lignes de contrôle avec caténaire
3. ⏳ Ajouter pilote visuel
4. ⏳ Vérifier synchronisation visuelle

### Phase 2: Interface Utilisateur (1-2h)
**Objectif**: Contrôle complet de la simulation

1. ⏳ Connecter UIManager à KitePhysicsSystem (vrais callbacks)
2. ⏳ Implémenter tous les sliders fonctionnels
3. ⏳ Afficher statistiques temps réel (HUD)
4. ⏳ Boutons play/pause/reset fonctionnels

### Phase 3: Debug et Amélioration (30min-1h)
**Objectif**: Outils de debug et optimisation

1. ⏳ Debug arrows pour forces (DebugRenderer)
2. ⏳ Mode wireframe toggle
3. ⏳ Profiling performance
4. ⏳ Console de debug avec logs

### Phase 4: Fonctionnalités Avancées (Optionnel, 2-4h)
**Objectif**: Physique et interaction avancées

1. ⏳ Intégrateur Verlet/RK4
2. ⏳ Déformation toile
3. ⏳ Record/replay
4. ⏳ Export/import configurations

---

## 🔧 Fichiers à Modifier

### Haute Priorité
1. **src/simulation/SimulationApp.ts**
   - Ajouter `createControlLines()`
   - Ajouter `calculateCatenary()`
   - Ajouter `updateControlLines()`
   - Ajouter `setupPilot()`
   - Connecter UIManager à KitePhysicsSystem

2. **src/simulation/ui/UIManager.ts**
   - Remplacer mocks par vraies callbacks
   - Implémenter tous les sliders
   - Ajouter HUD temps réel

3. **src/simulation/rendering/DebugRenderer.ts** (NOUVEAU)
   - Créer système de debug arrows
   - Intégrer à KitePhysicsSystem

### Moyenne Priorité
4. **src/simulation/physics/Integrator.ts** (NOUVEAU)
   - Implémenter Verlet
   - Implémenter RK4
   - Interface commune

5. **index.html**
   - Ajouter overlay HUD
   - Styliser UI existante

---

## 📊 Estimation Temps Total

| Phase | Tâches | Temps Estimé | Priorité |
|-------|--------|--------------|----------|
| Phase 1 | Lignes + Pilote + Sync | 1-2h | 🔴 HAUTE |
| Phase 2 | UI complète + HUD | 1-2h | 🟡 MOYENNE |
| Phase 3 | Debug tools | 30min-1h | 🟢 BASSE |
| Phase 4 | Avancé (optionnel) | 2-4h | ⚪ OPTIONNEL |
| **TOTAL** | **Minimal (Phases 1-2)** | **2-4h** | |
| **TOTAL** | **Complet (Phases 1-4)** | **4.5-9h** | |

---

## 🎯 Prochaine Action Immédiate

**Pour avoir une simulation visuellement complète et fonctionnelle :**

1. Réintégrer `createControlLines()` + `calculateCatenary()` dans SimulationApp
2. Ajouter pilote visuel (`setupPilot()`)
3. Connecter UIManager avec vrais callbacks à KitePhysicsSystem
4. Tester que tout fonctionne ensemble

**Veux-tu que je commence par la Phase 1 (lignes + pilote) ?**
