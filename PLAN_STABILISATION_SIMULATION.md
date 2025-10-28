# 🪁 Plan Détaillé v2.0 – Stabilisation et Finalisation du Simulateur Kite

**Objectif** : Rendre le simulateur de kite stable, réaliste et bidirectionnel, avec comportement émergent crédible et cohérence physique mesurable.

**Date de mise à jour** : 2025-10-16  
**Auteur** : AI & God of Prompt  
**Version** : 2.0  
**Statut** : Plan cohérent et exécutable

---

## 📋 Vue d'Ensemble

### État actuel

✅ **Acquis :**

* Architecture **ECS** propre, complète et typée
* Système physique **PBD (Position-Based Dynamics)** opérationnel
* Contraintes géométriques (8) correctement définies
* Aérodynamique distribuée par surface fonctionnelle
* Code **TypeScript sans erreur**, modulaire, documenté

❌ **Problèmes restants :**

* Le kite **s'échappe de sa sphère de vol** (~>1000 m)
* **Convergence PBD partielle** (5 itérations trop faibles)
* **Masses incohérentes** (CTRL : 0 vs 0.1)
* **Tensions non rétro-propagées** vers le pilote
* Absence de **cohérence vectorielle** des tensions brides ↔ lignes

---

## 🎯 Objectifs Physiques et Numériques

| Domaine             | Objectif                         | Tolérance     |
| ------------------- | -------------------------------- | ------------- |
| **Géométrie**       | Kite maintenu à ≤ 16 m du pilote | ±0.5 m        |
| **Contraintes**     | Erreur géométrique relative      | <0.1%         |
| **Convergence PBD** | Résiduelle <0.01 m               | ≤8 itérations |
| **Tensions**        | ΣF_brides ≈ F_lignes (vect.)     | ±10%          |
| **Zénith stable**   | Oscillation <0.5 m               | —             |
| **Performance**     | FPS ≥ 30                         | —             |

---

## ⚙️ Architecture Physique Corrigée

### 🔹 Modèle conceptuel

* La **barre de contrôle** est un pivot fixe au pilote.
* Les **poignées** aux extrémités contrôlent deux **lignes principales**.
* Chaque ligne est reliée à un ensemble de **brides formant une pyramide** (fixe par longueur).
* Les **brides** se connectent à des points de contrôle sur le kite.
* Le système kite + brides + lignes forme une **chaîne de contraintes PBD couplées** :
  * 8 contraintes de distance (brides + lignes)
  * 1 contrainte sphérique globale (limite 15.5 m)
* Les **forces aérodynamiques** sont appliquées par surface, recalculées à chaque frame selon :
  ```
  F = ½ρ S C_L V²
  ```

---

## 🧠 PHASE 1 – Stabilisation PBD et Cohérence Géométrique

**Durée estimée** : 2 à 3 heures  
**Objectif** : Convergence stable du solveur et kite dans sa sphère de vol

---

### 1.1 Diagnostic et logging avancé

**Actions :**

* Ajouter un module de **diagnostic PBD** :

```typescript
ConstraintSolver.logDiagnostics(iter, constraintErrors);
Logger.debug(`iter=${iter}, max=${maxErr.toFixed(4)}m, avg=${avgErr.toFixed(4)}m`, 'PBD');
```

**Données loggées :**

* Erreurs moyennes et max par contrainte
* Convergence globale sur N itérations
* Position kite-pilote (m)

**Critères :**

* Erreur < 0.01 m à l'itération finale
* Pas de dérive progressive (distance stable)

---

### 1.2 Unification des masses et inverse masses

**Actions :**

* Centraliser la gestion de masse :

```typescript
mass: 0.01,
invMass: 1 / 0.01
```

* Lecture unique via `PhysicsComponent`.

**Raisonnement :**

* `mass = 0.01 kg` → légère, réactive
* `invMass` cohérent pour pondération PBD
* Évite divergence entre solver et factory

---

### 1.3 Itérations et sous-étapes PBD

**Actions :**

* Passer à 8 itérations par frame :

```typescript
CONSTRAINT_ITERATIONS = 8;
```

* Si non-convergent, activer substeps :

```typescript
SUBSTEPS = 2;
```

**Critère de succès :**

* Erreur relative contraintes < 0.1%
* Distance kite-pilote stable à ±0.3 m

---

### 1.4 Clamping adaptatif pondéré par masse

**Correction :**

```typescript
const totalInvMass = invMassKite + invMassCtrl;
const wK = invMassKite / totalInvMass;
const wC = invMassCtrl / totalInvMass;

const errorRatio = Math.abs(C) / targetLength;
let clamp = 0.3;
if (errorRatio > 0.1) clamp = 0.6;
else if (errorRatio > 0.05) clamp = 0.45;

dPosKite = dPosKiteRaw.multiplyScalar(clamp * wK);
dPosCtrl = dPosCtrlRaw.multiplyScalar(clamp * wC);
```

**Effet :**

* Convergence plus rapide et symétrique
* Pas d'oscillations parasites

---

### 1.5 Contrainte de sphère globale (nouvelle)

**Action :**
Ajouter une contrainte `ConstraintSphere` :

```typescript
distance = kitePos.distanceTo(pilotPos);
if (distance > 15.5) {
  const dir = kitePos.clone().sub(pilotPos).normalize();
  kitePos.copy(pilotPos.clone().add(dir.multiplyScalar(15.5)));
}
```

**But :**
Empêche tout "échappement" de la zone de vol, sans rigidifier localement les brides.

---

### ✅ **Livrable Phase 1**

* Kite reste dans une sphère de 15.5 m
* Erreur contraintes <0.01 m
* Simulation stable >5 min
* Logs convergents
* FPS ≥ 30

---

## 🪢 PHASE 2 – Calcul et Cohérence des Tensions

**Durée estimée** : 3–4 heures  
**Objectif** : Calculer des tensions cohérentes et restituer un feedback réaliste

---

### 2.1 Tensions lignes (Hooke calibré)

**Actions :**

* Ajouter méthode `calculateLineTension()` dans `PureConstraintSolver` :

```typescript
static calculateLineTension(
  ctrlPosition: THREE.Vector3,
  handlePosition: THREE.Vector3,
  lineLength: number,
  lineStiffness: number = CONFIG.lines.stiffness
): number {
  const currentLength = ctrlPosition.distanceTo(handlePosition);
  const delta = currentLength - lineLength;
  
  // Tension proportionnelle à l'étirement (loi de Hooke simplifiée)
  // F = k × Δx
  const tension = Math.max(0, delta * lineStiffness);
  
  return Math.min(tension, CONFIG.lines.maxTension); // Limite sécurité
}
```

**Calibration :**

* Lignes : L = 15 m, Δx max = 0.3 m
* Tension max ≈ 150 N (réaliste)
* `k_line = CONFIG.lines.stiffness` (e.g. 500 N/m)

**Intégration dans `LineSystem.pure.ts` :**

```typescript
update(context: SimulationContext): void {
  const tensions = this.calculateLineTensions(context.handlePositions);
  
  // Mettre à jour LineComponent.state
  if (this.leftLineEntity) {
    const lineComp = this.leftLineEntity.getComponent<LineComponent>('line');
    if (lineComp) {
      lineComp.state.tension = tensions.left;
    }
  }
  
  // Logger tensions chaque seconde
  if (Math.floor(context.time) !== this.lastLogTime) {
    this.logger.info(
      `Line tensions: L=${tensions.left.toFixed(1)}N, R=${tensions.right.toFixed(1)}N, asym=${tensions.asymmetry.toFixed(1)}%`,
      'LineSystem'
    );
    this.lastLogTime = Math.floor(context.time);
  }
}
```

**Tests** :

* Vérifier tensions cohérentes avec forces aéro (kite en power zone → tensions élevées)
* Vérifier asymétrie tensions lors de virage (barre tournée)
* Vérifier tensions ~0 N au zénith (équilibre)

**Métriques de succès** :

* Tensions power zone : 50-200 N
* Tensions zénith : <10 N
* Asymétrie virage : >20% différence L/R

---

### 2.2 Tensions brides couplées à l'aérodynamique

**Actions :**

* Ajouter méthode `calculateBridleTensions()` dans `PureBridleSystem` :

```typescript
calculateBridleTensions(
  kiteEntity: Entity,
  ctrlLeftEntity: Entity,
  ctrlRightEntity: Entity
): BridleTensions {
  const geometry = kiteEntity.getComponent<GeometryComponent>('geometry');
  const transform = kiteEntity.getComponent<TransformComponent>('transform');
  const bridle = kiteEntity.getComponent<BridleComponent>('bridle');
  
  // Positions monde des points d'attache
  const nezWorld = ConstraintUtilities.getWorldPosition(geometry, transform, 'NEZ');
  const interLWorld = ConstraintUtilities.getWorldPosition(geometry, transform, 'INTER_GAUCHE');
  // ... etc
  
  const ctrlLeftPos = ctrlLeftEntity.getComponent<TransformComponent>('transform')!.position;
  
  // Calculer tensions individuelles (similaire aux lignes)
  const tensions: BridleTensions = {
    left_nez: this.calculateBridleTension(nezWorld, ctrlLeftPos, bridle.lengths.nez),
    left_inter: this.calculateBridleTension(interLWorld, ctrlLeftPos, bridle.lengths.inter),
    // ... etc
  };
  
  return tensions;
}
```

**Forces aérodynamiques globales :**

```typescript
F_aero = 0.5 * rho * S * C_L * V²;
```

**Répartition vectorielle :**

* Chaque bride absorbe une fraction du vecteur F_aero selon son orientation :

```typescript
F_bride_i = F_aero.projectOnVector(dir_i) * weight_i;
```

**Conservation vectorielle :**

```typescript
|ΣF_brides - (F_line_L + F_line_R)| / |F_line_total| < 0.1
```

**Tests** :

* Vérifier tensions brides cohérentes avec tensions lignes
* Vérifier conservation de la tension : T_ligne ≈ Σ(T_brides)

**Métriques de succès** :

* Tensions brides : 10-80 N chacune
* Somme tensions brides ≈ tension ligne (±10%)

---

### 2.3 Transmission au pilote (feedback haptique filtré)

**Actions :**

* Créer composant `PilotFeedbackComponent` :

```typescript
export class PilotFeedbackComponent extends Component {
  leftHandTension: number = 0;  // N
  rightHandTension: number = 0; // N
  filteredTensionL: number = 0; // N (filtré)
  filteredTensionR: number = 0; // N (filtré)
  asymmetry: number = 0;        // %
  dominantSide: 'left' | 'right' | 'neutral' = 'neutral';
}
```

* Créer système `PilotFeedbackSystem` :

```typescript
export class PilotFeedbackSystem extends BaseSimulationSystem {
  update(context: SimulationContext): void {
    // Lire tensions lignes depuis LineSystem
    const tensions = this.lineSystem.getLineTensions();
    
    // Mettre à jour PilotFeedbackComponent
    this.pilotFeedback.leftHandTension = tensions.left;
    this.pilotFeedback.rightHandTension = tensions.right;
    
    // Filtrage inertiel pour feedback fluide
    const dt = context.deltaTime;
    this.pilotFeedback.filteredTensionL = lerp(
      this.pilotFeedback.filteredTensionL, 
      tensions.left, 
      dt * 5.0
    );
    this.pilotFeedback.filteredTensionR = lerp(
      this.pilotFeedback.filteredTensionR, 
      tensions.right, 
      dt * 5.0
    );
    
    this.pilotFeedback.asymmetry = tensions.asymmetry;
    
    // Déterminer dominant side
    if (Math.abs(tensions.asymmetry) > 10) {
      this.pilotFeedback.dominantSide = tensions.left > tensions.right ? 'left' : 'right';
    } else {
      this.pilotFeedback.dominantSide = 'neutral';
    }
  }
}
```

**But :**

* Empêche retour haptique "sec"
* Simule élasticité du matériel
* Feedback fluide et précis

* Afficher tensions dans UI (optionnel mais recommandé)

**Tests** :

* Tourner barre gauche → tension main gauche augmente
* Observer feedback en temps réel dans l'UI

**Métriques de succès** :

* Latence < 100ms entre action pilote et feedback tension
* Corrélation directe action barre ↔ asymétrie tension

---

### ✅ **Livrable Phase 2**

* Tensions lignes calculées et loggées
* Tensions brides calculées et cohérentes (vectorielles)
* Pilote "ressent" la traction (feedback UI fluide et filtré)
* Conservation tension : T_ligne ≈ Σ(T_brides) ±10%
* Asymétrie tensions reflète actions pilote

---

## 🧩 PHASE 3 – Validation Physique et Calibration

**Durée estimée** : 2–3 heures  
**Objectif** : Valider tous les comportements émergents et affiner les paramètres

---

### 3.1 Tests Comportement Zénith (30 min)

**Scénario** : Barre neutre, laisser kite se stabiliser.

**Attendu** :

* Kite monte vers zénith (y ≈ 15 m)
* Surfaces deviennent horizontales (angle d'attaque → 0°)
* Forces aéro diminuent
* Position stable (oscillations < 0.5 m)

**Tests** :

* Démarrer simulation, barre neutre
* Observer position kite après 30s
* Mesurer altitude finale (doit être ≈ 15-16m)
* Vérifier forces aéro faibles (<5N)

**Métriques de succès** :

* Position finale : y > 14m
* Force aéro finale < 10N
* Oscillations < 0.5m amplitude

---

### 3.2 Tests Virages (45 min)

**Scénario** : Tourner barre à ±30°, observer réaction kite.

**Attendu** :

* Rotation gauche → asymétrie tensions → twist → couple de lacet → virage gauche
* Trajectoire courbe émergente
* Retour neutre → kite revient vers zénith

**Tests** :

* Tourner barre gauche 30°, maintenir 5s
* Mesurer asymétrie tensions (doit être >20%)
* Observer trajectoire kite (doit courber à gauche)
* Retour neutre → vérifier retour zénith

**Métriques de succès** :

* Asymétrie tensions : >20%
* Trajectoire courbe visible (rayon <20m)
* Temps retour zénith : <10s

---

### 3.3 Tests Power Zone (30 min)

**Scénario** : Amener kite à l'équateur (hauteur = pilote).

**Attendu** :

* Forces aéro maximales
* Vitesse kite maximale
* Tensions lignes maximales

**Tests** :

* Piloter kite vers équateur (y ≈ 0)
* Mesurer forces aéro (doit être >50N)
* Mesurer vitesse kite (doit être >5 m/s)
* Mesurer tensions lignes (doit être >100N)

**Métriques de succès** :

* Forces aéro : >50N
* Vitesse kite : >5 m/s
* Tensions lignes : >100N

---

### 3.4 Tests Collision Sol (15 min)

**Scénario** : Crash kite au sol.

**Attendu** :

* Détection multi-points (NEZ, BORD, etc.)
* Rebond avec coefficient restitution ~0.3
* Friction sol ~0.85

**Tests** :

* Faire crasher kite
* Vérifier rebond (hauteur_rebond ≈ 30% hauteur_chute)
* Vérifier friction (vitesse horizontale réduite)

**Métriques de succès** :

* Rebond cohérent
* Pas de traversée du sol (y ≥ 0)

---

### 3.5 Ajustement final des paramètres (1h)

**Actions :**

* Ajuster coefficients aérodynamiques selon comportement réel :
  * `C_L ≈ 1.2` (coefficient de portance)
  * `C_D ≈ 0.2` (coefficient de traînée)
* Réviser damping linéaire :
  * `linearDampingCoeff = 0.05`
* Ajuster `CONFIG.aero.liftScale` et `dragScale` si nécessaire
* Ajuster `CONFIG.physics.linearDampingCoeff` pour réalisme
* Ajuster `CONFIG.lines.stiffness` si tensions trop fortes/faibles (recommandation : ~500 N/m)
* Documenter valeurs finales dans `SimulationConfig.ts`

**Tests** :

* Vérifier tous comportements restent cohérents après ajustements
* Valider métriques finales (voir section 3.6)

---

### 3.6 Validation Finale Complète (30 min)

**Checklist finale** :

#### Géométrie

* Distance kite-pilote : 15-16m ±0.5m
* Contraintes lignes respectées : ±1mm (erreur <0.1%)
* Contraintes brides respectées : ±1mm (erreur <0.1%)

#### Physique

* Zénith stable : y > 14m, oscillations < 0.5m
* Power zone : forces > 50N, vitesse > 5 m/s
* Virages fonctionnels : asymétrie > 20%, trajectoire courbe

#### Tensions

* Tensions lignes cohérentes : 10-200N selon zone
* Tensions brides cohérentes : 5-80N chacune
* Conservation vectorielle : T_ligne ≈ Σ(T_brides) ±10%

#### Performance

* FPS ≥ 30 en continu
* Pas de NaN/Infinity
* Simulation stable > 10 minutes

---

### ✅ **Livrable Phase 3**

* Tous les comportements émergents fonctionnels
* Tous les tests passent (zénith, virages, power zone, collision)
* Paramètres documentés et justifiés
* Checklist finale 100% validée

---

## � Métriques de Succès Globales

### Critères de Validation Finale

| Catégorie | Métrique | Cible | Critique |
|-----------|----------|-------|----------|
| **Géométrie** | Distance kite-pilote | 15-16m ±0.5m | ✅ OUI |
| | Erreur contraintes lignes | <0.1% | ✅ OUI |
| | Erreur contraintes brides | <0.1% | ✅ OUI |
| **Physique** | Zénith altitude | >14m | ✅ OUI |
| | Oscillations zénith | <0.5m | ⚠️ NON |
| | Power zone forces | >50N | ⚠️ NON |
| | Vitesse max kite | >5 m/s | ⚠️ NON |
| **Tensions** | Range tensions lignes | 10-200N | ⚠️ NON |
| | Asymétrie virage | >20% | ⚠️ NON |
| | Conservation tension (vectorielle) | ±10% | ✅ OUI |
| **Performance** | FPS | ≥30 | ✅ OUI |
| | Stabilité | >10min sans crash | ✅ OUI |
| | Pas de NaN | 0 occurrence | ✅ OUI |

**Légende** :
- ✅ OUI : Critère CRITIQUE, échec = blocage
- ⚠️ NON : Critère IMPORTANT, échec = tuning supplémentaire

---

## 🛠️ Outils et Méthodes

### Logging Strategy

**Niveaux de log** :
- `ERROR` : NaN, contraintes violées >10%, crash simulation
- `WARN` : Contraintes violées >0.1%, tensions anormales
- `INFO` : État simulation chaque seconde (position, tensions, forces)
- `DEBUG` : Détails PBD (itérations, convergence, corrections)

**Fréquence** :
- Logs `INFO` : 1/s
- Logs `DEBUG` : Désactivés par défaut (activer manuellement si besoin)

### Tests Automatisés

**Tests d'intégration** (à créer dans `test/`) :

```typescript
describe('Kite Flight Sphere', () => {
  it('should stay within 16m of pilot', async () => {
    const sim = new SimulationApp(/* ... */);
    sim.start();
    await sleep(5000); // 5s simulation
    const distance = sim.getKiteDistance();
    expect(distance).toBeLessThan(16);
    expect(distance).toBeGreaterThan(14.5);
  });
  
  it('should maintain distance variance <0.5m', async () => {
    const sim = new SimulationApp(/* ... */);
    const distances = await sim.recordDistanceOverTime(5000);
    const std = standardDeviation(distances);
    expect(std).toBeLessThan(0.5);
  });
  
  it('should converge constraints to <0.1% error', async () => {
    const sim = new SimulationApp(/* ... */);
    await sim.runFrame();
    const errors = sim.getConstraintErrors();
    errors.forEach(err => {
      expect(err).toBeLessThan(0.001); // <0.1% pour 15m
    });
  });
});
```

---

## 📁 Fichiers à Modifier

### Phase 1 (Diagnostic & Tuning PBD)
- `src/ecs/config/PhysicsConstants.ts` : Augmenter `CONSTRAINT_ITERATIONS` à 8
- `src/ecs/systems/ConstraintSolver.pure.ts` : Logging détaillé, clamping adaptatif pondéré, validation, contrainte sphère globale
- `src/ecs/entities/factories/ControlPointEntityFactory.ts` : Fixer masse CTRL à 0.01 kg avec invMass cohérent
- `src/ecs/systems/KitePhysicsSystem.ts` : Appeler validation contraintes post-résolution

### Phase 2 (Tensions)
- `src/ecs/systems/LineSystem.pure.ts` : Calcul tensions lignes (Hooke calibré, k≈500 N/m)
- `src/ecs/systems/BridleSystem.pure.ts` : Calcul tensions brides vectorielles couplées à l'aérodynamique
- `src/ecs/systems/PilotFeedbackSystem.ts` : **NOUVEAU** système feedback avec filtrage inertiel
- `src/ecs/components/PilotFeedbackComponent.ts` : **NOUVEAU** composant avec tensions filtrées

### Phase 3 (Validation)
- `src/ecs/config/SimulationConfig.ts` : Tuning paramètres finaux (C_L≈1.2, C_D≈0.2, damping≈0.05, stiffness≈500)
- `test/flight-sphere.test.ts` : **NOUVEAU** tests automatisés (distance, variance, convergence)
- `PHYSICS_MODEL.md` : Mise à jour métriques validées et modèle calibré

---

## ⚠️ Risques et Mitigations

| Risque | Cause | Mitigation |
|--------|-------|------------|
| **Divergence PBD** | Masse trop déséquilibrée | Substeps (2x) + pondération masse cohérente |
| **Kite échappement** | Erreur cumulée contraintes | Contrainte sphère globale (15.5m) |
| **FPS < 30** | Logging excessif | Throttling logs (1/s INFO, DEBUG désactivé) |
| **Feedback instable** | Tension brute non filtrée | Filtrage inertiel (lerp dt*5.0) |
| **Conservation tensions** | Projection vectorielle incorrecte | Vérification ΣF_brides ≈ F_lignes (vectorielle ±10%) |

---

## 📈 Suivi de Progression

### Checklist Phases

**Phase 1 : Stabilisation PBD**
- [ ] 1.1 Diagnostic logging avancé
- [ ] 1.2 Unification masses et invMasses
- [ ] 1.3 Augmentation itérations (8) + substeps si nécessaire
- [ ] 1.4 Clamping adaptatif pondéré
- [ ] 1.5 Contrainte sphère globale
- [ ] ✅ Livrable Phase 1 validé

**Phase 2 : Tensions**
- [ ] 2.1 Calcul tensions lignes (Hooke calibré)
- [ ] 2.2 Calcul tensions brides vectorielles
- [ ] 2.3 Transmission pilote avec filtrage
- [ ] ✅ Livrable Phase 2 validé

**Phase 3 : Validation**
- [ ] 3.1 Tests zénith
- [ ] 3.2 Tests virages
- [ ] 3.3 Tests power zone
- [ ] 3.4 Tests collision sol
- [ ] 3.5 Ajustement final paramètres
- [ ] 3.6 Validation complète
- [ ] ✅ Livrable Phase 3 validé

---

## 🎓 Annexes

### Annexe A : Plan B - Substeps Physiques

Si convergence PBD insuffisante même avec 8 itérations :

```typescript
// Dans KitePhysicsSystem.update()
const SUBSTEPS = 2;
const subDt = context.deltaTime / SUBSTEPS;

for (let i = 0; i < SUBSTEPS; i++) {
  const subContext = { ...context, deltaTime: subDt };
  
  // 1. Appliquer forces (demi-pas)
  this.applyAerodynamics(subContext);
  
  // 2. Résoudre contraintes
  PureConstraintSolver.enforceBridleConstraints(
    this.kiteEntity!,
    this.ctrlLeftEntity!,
    this.ctrlRightEntity!,
    subContext.handlePositions
  );
  
  // 3. Intégrer vélocités
  this.integrateVelocity(subDt);
}
```

**Avantages** : Stabilité maximale, convergence garantie  
**Inconvénients** : Coût CPU x2 (acceptable si FPS reste ≥30)

---

### Annexe B : Plan C - Solveur LCP (Dernier Recours)

Si PBD échoue complètement, considérer solveur LCP (Linear Complementarity Problem).

**Bibliothèques** :
- `numeric.js` : Solveur LCP basique (JavaScript pur)
- `cannon.js` : Engine physique avec solveur Gauss-Seidel

**Complexité** : O(n³) pour n contraintes  
**Recommandation** : À éviter si PBD peut être stabilisé (généralement suffisant pour 8 contraintes)

---

## 📝 Notes de Développement

### Décisions Architecturales

1. **PBD vs Verlet** : PBD choisi pour sa robustesse et flexibilité (contraintes géométriques explicites)
2. **CTRL masse 0.01 kg** : Compromis bidirectionnalité vs stabilité (léger mais pas virtuel)
3. **8 itérations** : Minimum recommandé pour 8 contraintes (1 itération par contrainte)
4. **Clamping adaptatif pondéré** : Convergence rapide (60% si erreur >10%) + stabilité régime permanent (30%)
5. **Contrainte sphère globale** : Sécurité ultime contre échappement (15.5m = lignes 15m + brides 0.5m)
6. **Filtrage inertiel feedback** : Simule élasticité matériel, évite retour haptique "sec"

### Optimisations Futures (Post-Stabilisation)

- **Archetype caching** dans EntityManager (gain ~20% performance)
- **Parallel constraint solving** (WebWorkers, gain potentiel ~30%)
- **GPU constraint solver** (WebGPU, gain potentiel ~10x, complexité élevée)
- **Spatial hashing** pour collisions (si ajout d'obstacles)

---

## ✅ Résumé des Améliorations v2.0

| Section | Correction clé |
|---------|---------------|
| **Modèle PBD** | Contrainte sphérique globale (15.5m) ajoutée |
| **Masses** | Unification masse/invMass (0.01 kg cohérent) |
| **Clamping** | Pondéré par masse (wK, wC) + adaptatif (0.3→0.6) |
| **Tensions** | Vectorielles et cohérentes (ΣF_brides ≈ F_lignes ±10%) |
| **Feedback** | Filtrage inertiel ajouté (lerp dt*5.0) |
| **Aérodynamique** | Calibration réaliste (ρ=1.225, C_L≈1.2, C_D≈0.2) |
| **Tests** | Variance + stabilité temporelle ajoutés |
| **Tolérances** | Relative <0.1% au lieu d'absolue <1mm |

---

**Auteur** : AI & God of Prompt  
**Date mise à jour** : 2025-10-16  
**Version** : 2.0  
**Statut** : Plan cohérent, exécutable, et physiquement calibré ✅
