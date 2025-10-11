# TODO : Refactor SimulationApp.ts
**Date de création :** 11 Janvier 2025  
**Objectif :** Réduire SimulationApp.ts de 781 → ~450 lignes via Entity Factories

---

## 📋 Checklist Complète

### Phase 1 : ControlBarEntityFactory ⭐ PRIORITÉ HAUTE
**Temps estimé :** 30 minutes  
**Impact :** -120 lignes dans SimulationApp.ts

- [ ] **1.1** Créer dossier `src/simulation/factories/`
- [ ] **1.2** Créer fichier `src/simulation/factories/ControlBarEntityFactory.ts`
- [ ] **1.3** Implémenter interface `ControlBarFactoryParams`
  ```typescript
  export interface ControlBarFactoryParams {
    position?: THREE.Vector3;
    parentObject?: THREE.Object3D;
    name?: string;
  }
  ```
- [ ] **1.4** Implémenter méthode `create(params)`
- [ ] **1.5** Implémenter méthode `createGeometry()` (privée)
- [ ] **1.6** Implémenter méthode `createBar()` (privée)
- [ ] **1.7** Implémenter méthode `createHandles()` (privée)
- [ ] **1.8** Copier code géométrie depuis `SimulationApp.createControlBarEntity()`
- [ ] **1.9** Refactoriser `SimulationApp.createControlBarEntity()` (130 → 15 lignes)
- [ ] **1.10** Test manuel : control bar visible
- [ ] **1.11** Test manuel : rotations avec A/D fonctionnent
- [ ] **1.12** `npm run type-check` → 0 erreurs
- [ ] **1.13** `npm run lint` → pas de nouvelles erreurs
- [ ] **1.14** Git commit : `git commit -m "refactor: extract ControlBar creation to factory"`

**Validation :**
- [ ] ControlBar visible dans la scène
- [ ] Rotations inputs fonctionnelles
- [ ] Pas de warnings console
- [ ] SimulationApp.ts réduit à ~660 lignes

---

### Phase 2 : PilotEntityFactory
**Temps estimé :** 20 minutes  
**Impact :** -30 lignes dans SimulationApp.ts

- [ ] **2.1** Créer fichier `src/simulation/factories/PilotEntityFactory.ts`
- [ ] **2.2** Implémenter interface `PilotFactoryParams`
- [ ] **2.3** Implémenter méthode `create(params)` (réutiliser PilotEntity)
- [ ] **2.4** Implémenter méthode `createGeometry()` si nécessaire
- [ ] **2.5** Refactoriser `SimulationApp.createPilotEntity()`
- [ ] **2.6** Test manuel : pilote visible
- [ ] **2.7** Test manuel : control bar attachée correctement
- [ ] **2.8** `npm run type-check` → 0 erreurs
- [ ] **2.9** Git commit : `git commit -m "refactor: extract Pilot creation to factory"`

**Validation :**
- [ ] Pilote visible
- [ ] ControlBar reste attachée au pilote
- [ ] SimulationApp.ts réduit à ~640 lignes

---

### Phase 3 : KiteEntityFactory
**Temps estimé :** 25 minutes  
**Impact :** -40 lignes dans SimulationApp.ts

- [ ] **3.1** Créer fichier `src/simulation/factories/KiteEntityFactory.ts`
- [ ] **3.2** Implémenter interface `KiteFactoryParams`
  ```typescript
  export interface KiteFactoryParams {
    position?: THREE.Vector3;
    preset?: string; // Pour presets futurs
    name?: string;
  }
  ```
- [ ] **3.3** Implémenter méthode `create(params)`
- [ ] **3.4** Wrapper autour de `new Kite()` (legacy StructuredObject)
- [ ] **3.5** Refactoriser `SimulationApp.createKiteEntity()`
- [ ] **3.6** Test manuel : kite visible
- [ ] **3.7** Test manuel : physique fonctionne
- [ ] **3.8** Test manuel : bridles visibles
- [ ] **3.9** `npm run type-check` → 0 erreurs
- [ ] **3.10** Git commit : `git commit -m "refactor: extract Kite creation to factory"`

**Validation :**
- [ ] Kite visible et animé
- [ ] Physique fonctionnelle
- [ ] Lignes attachées correctement
- [ ] SimulationApp.ts réduit à ~600 lignes

---

### Phase 4 : EntityBuilder Utilities
**Temps estimé :** 20 minutes  
**Impact :** Simplification logique commune

- [ ] **4.1** Créer fichier `src/simulation/utils/EntityBuilder.ts`
- [ ] **4.2** Implémenter méthode `registerAndAddToScene(entity, manager, scene)`
- [ ] **4.3** Implémenter méthode `attachChild(child, parent)`
- [ ] **4.4** Implémenter méthode `getWorldPosition(entity)` (helper)
- [ ] **4.5** Refactoriser points d'appel dans `SimulationApp`
- [ ] **4.6** Test manuel complet
- [ ] **4.7** `npm run type-check` → 0 erreurs
- [ ] **4.8** Git commit : `git commit -m "refactor: add EntityBuilder utility class"`

**Validation :**
- [ ] Toutes entités créées correctement
- [ ] Scene graph correct
- [ ] SimulationApp.ts réduit à ~550 lignes

---

### Phase 5 : System Configuration Builder (OPTIONNEL)
**Temps estimé :** 1 heure  
**Impact :** Amélioration lisibilité

- [ ] **5.1** Créer fichier `src/simulation/builders/SystemConfigBuilder.ts`
- [ ] **5.2** Modifier systèmes pour fluent interface (retourner `this`)
  - [ ] ControlBarSystem
  - [ ] KitePhysicsSystem
  - [ ] LinesRenderSystem
- [ ] **5.3** Implémenter `configureControlBar(system, entity, inputSystem)`
- [ ] **5.4** Implémenter `configureKitePhysics(system, kite, controlBar)`
- [ ] **5.5** Implémenter `configureLines(system, kite, controlBar, physics)`
- [ ] **5.6** Refactoriser configuration dans `SimulationApp`
- [ ] **5.7** Test manuel complet
- [ ] **5.8** `npm run type-check` → 0 erreurs
- [ ] **5.9** Git commit : `git commit -m "refactor: add SystemConfigBuilder for fluent configuration"`

**Validation :**
- [ ] Configuration systèmes plus lisible
- [ ] SimulationApp.ts réduit à ~450 lignes

---

## 🎯 Objectifs de Validation Finale

### Métriques
- [ ] **SimulationApp.ts ≤ 500 lignes** (objectif : ~450)
- [ ] **0 erreurs TypeScript**
- [ ] **0 nouvelles erreurs ESLint**
- [ ] **Couverture tests** : Factories testables isolément

### Tests Fonctionnels
- [ ] Kite visible et animé
- [ ] Control bar visible et rotations A/D fonctionnelles
- [ ] Lignes visibles (rouge, 5mm diamètre)
- [ ] Pilote visible et statique
- [ ] Physique kite fonctionnelle (vent, aérodynamique)
- [ ] Bridles colorées selon tension (vert→jaune→rouge)
- [ ] UI affiche valeurs correctes (vitesse vent, position kite, etc.)
- [ ] Reset fonctionnel
- [ ] Pas de warnings console (sauf logs debug normaux)

### Documentation
- [ ] Mettre à jour `.github/copilot-instructions.md`
  - Ajouter section Entity Factories
  - Documenter pattern utilisé
- [ ] Créer `ENTITY_FACTORIES.md`
  - Expliquer pattern
  - Exemples d'utilisation
  - Comment ajouter nouvelle entité
- [ ] Mettre à jour `INDEX_DOCUMENTATION.md` si nécessaire

---

## 🔧 Améliorations Additionnelles

### A. Entity IDs Typés (10 min)
- [ ] Créer `src/simulation/entities/EntityIds.ts`
  ```typescript
  export const ENTITY_IDS = {
    KITE: 'kite',
    PILOT: 'pilot',
    CONTROL_BAR: 'controlBar',
    LEFT_LINE: 'leftLine',
    RIGHT_LINE: 'rightLine'
  } as const;
  export type EntityId = typeof ENTITY_IDS[keyof typeof ENTITY_IDS];
  ```
- [ ] Refactoriser tous les appels `getEntity('kite')` → `getEntity(ENTITY_IDS.KITE)`
- [ ] Test et commit

---

### B. Config Validation (15 min)
- [ ] Créer `src/simulation/config/ConfigValidator.ts`
- [ ] Implémenter validation physique cohérente
  - [ ] `maxTension > preTension`
  - [ ] Valeurs positives (masses, longueurs)
  - [ ] Ranges cohérents
- [ ] Appeler validation dans `SimulationApp.initialize()`
- [ ] Test et commit

---

### C. Logging Levels Configurables (15 min)
- [ ] Ajouter dans `CONFIG`
  ```typescript
  debug: {
    logLevel: 'info' | 'debug' | 'warn' | 'error',
    enablePhysicsLogs: boolean,
    enableSystemLogs: boolean,
    logInterval: number // ms entre logs physique
  }
  ```
- [ ] Modifier `Logger` pour respecter ces flags
- [ ] Test et commit

---

### D. Debug Renderer Réactivation (45 min)
- [ ] Décommenter code debug dans `SimulationApp.updateLoop()`
- [ ] Vérifier accès ECS propre (via EntityManager)
- [ ] Implémenter debug arrows manquants
  - [ ] Vecteur vitesse kite
  - [ ] Forces aérodynamiques
  - [ ] Tensions lignes
- [ ] Tester en mode debug
- [ ] Commit

---

## 📅 Planning Suggéré

### Option A : Refactor Sprint (1 journée)
```
Matin (3h) :
  09:00-09:30 : Phase 1 (ControlBarEntityFactory)
  09:30-09:50 : Phase 2 (PilotEntityFactory)
  09:50-10:15 : Phase 3 (KiteEntityFactory)
  10:15-10:30 : Break
  10:30-10:50 : Phase 4 (EntityBuilder)
  10:50-11:30 : Tests complets
  11:30-12:00 : Amélioration A (Entity IDs)

Après-midi (3h) :
  14:00-15:00 : Phase 5 (SystemConfigBuilder) OPTIONNEL
  15:00-15:15 : Amélioration B (Config Validation)
  15:15-15:30 : Amélioration C (Logging Levels)
  15:30-15:45 : Break
  15:45-16:30 : Amélioration D (Debug Renderer)
  16:30-17:00 : Documentation & Review final
```

---

### Option B : Refactor Progressif (4 jours × 30 min)
```
Jour 1 (30 min) :
  - Phase 1 : ControlBarEntityFactory
  - Validation complète
  - Commit

Jour 2 (30 min) :
  - Phase 2 : PilotEntityFactory
  - Phase 3 : KiteEntityFactory
  - Validation
  - Commit

Jour 3 (30 min) :
  - Phase 4 : EntityBuilder
  - Amélioration A : Entity IDs
  - Validation
  - Commit

Jour 4 (30 min) :
  - Améliorations B & C
  - Documentation
  - Review final
  - Commit
```

---

### Option C : Proof of Concept (30 min)
```
Aujourd'hui (30 min) :
  - Phase 1 UNIQUEMENT : ControlBarEntityFactory
  - Tests complets
  - Commit

Décision : Continuer si satisfait du résultat
```

---

## 📝 Notes de Développement

### Commandes Utiles
```bash
# Vérifier TypeScript
npm run type-check

# Vérifier ESLint
npm run lint

# Fix auto ESLint
npm run lint:fix

# Compiler production
npm run build

# Preview build
npm run preview
```

### Branches Git
```bash
# Créer branche refactor
git checkout -b refactor/entity-factories

# Commits atomiques
git commit -m "refactor(phase1): extract ControlBar to factory"
git commit -m "refactor(phase2): extract Pilot to factory"
git commit -m "refactor(phase3): extract Kite to factory"
git commit -m "refactor(phase4): add EntityBuilder utilities"

# Merge dans main après validation
git checkout main
git merge refactor/entity-factories
```

---

## ✅ Critères de Succès

### Technique
- [x] 0 erreurs TypeScript (déjà OK)
- [ ] SimulationApp.ts < 500 lignes
- [ ] Factories testables indépendamment
- [ ] Pas de duplication code géométrique
- [ ] Patterns cohérents avec projet

### Fonctionnel
- [ ] Simulation identique (pas de régression)
- [ ] Performance identique (pas de ralentissement)
- [ ] Tous les tests manuels passent
- [ ] Pas de nouveaux warnings console

### Architecture
- [ ] SRP respecté (Single Responsibility Principle)
- [ ] OCP respecté (Open/Closed Principle)
- [ ] Réutilisabilité améliorée
- [ ] Testabilité améliorée
- [ ] Maintenabilité améliorée

---

## 🎓 Apprentissages & Retour d'Expérience

### Après Phase 1
- **Temps réel :** _____ minutes (estimé : 30)
- **Difficultés rencontrées :** _____
- **Améliorations identifiées :** _____
- **Satisfaction (1-5) :** _____

### Après Phase 2
- **Temps réel :** _____ minutes (estimé : 20)
- **Difficultés rencontrées :** _____
- **Satisfaction (1-5) :** _____

### Après Phase 3
- **Temps réel :** _____ minutes (estimé : 25)
- **Difficultés rencontrées :** _____
- **Satisfaction (1-5) :** _____

### Après Phase 4
- **Temps réel :** _____ minutes (estimé : 20)
- **Difficultés rencontrées :** _____
- **Satisfaction (1-5) :** _____

### Bilan Final
- **Temps total :** _____ heures
- **Lignes éliminées :** _____ (objectif : ~330)
- **Bugs introduits :** _____
- **Recommandation :** Continuer / Modifier approche / Autre

---

**Statut :** ⏸️ EN ATTENTE  
**Prochaine action :** Décider option A, B ou C  
**Date de début :** _____  
**Date de fin :** _____
