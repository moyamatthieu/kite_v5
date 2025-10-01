# Audit Approfondi : Physique des Lignes de Vol

**Date** : 1 octobre 2025  
**Branche** : `feature/line-physics-audit`  
**Portée** : Système complet de lignes (LineSystem, ConstraintSolver, ControlBarManager)

---

## 📋 Résumé Exécutif

Cet audit analyse en profondeur la physique des lignes de vol du simulateur Kite, depuis le calcul des tensions jusqu'aux contraintes géométriques. L'objectif est d'identifier les incohérences physiques, les comportements non réalistes et de proposer des améliorations fondées sur les principes physiques réels.

### Verdict Global : ⚠️ AMÉLIORATIONS NÉCESSAIRES

Le système actuel fonctionne mais présente plusieurs **incohérences physiques majeures** et **simplifications excessives** qui nuisent au réalisme de la simulation.

---

## 🔍 Architecture Actuelle

### Modules Analysés

1. **LineSystem.ts** (250 lignes)
   - Calcul des tensions dans les lignes
   - Modèle de contrôle (rotation barre)
   - Calcul caténaire pour affichage

2. **ConstraintSolver.ts** (200 lignes)
   - Solveur PBD (Position-Based Dynamics)
   - Contraintes de distance
   - Collision sol

3. **ControlBarManager.ts** (120 lignes)
   - Position et orientation barre
   - Calcul positions poignées
   - Synchronisation visuelle

4. **SimulationConfig.ts** (paramètres lignes)
   ```typescript
   lines: {
     defaultLength: 15,        // m - Longueur par défaut
     stiffness: 25000,         // N/m - Rigidité
     maxTension: 1000,         // N - Tension max
     maxSag: 0.008,            // Affaissement
     catenarySagFactor: 3,     // Facteur caténaire
   }
   ```

---

## ⚠️ Problèmes Identifiés

### 🔴 CRITIQUE #1 : Modèle de Ressort Inadéquat

**Localisation** : `LineSystem.ts`, lignes 130-148

```typescript
// Ligne gauche : F = k × extension (Hooke pour corde rigide)
if (leftDistance > this.lineLength) {
  const extension = leftDistance - this.lineLength;
  const tension = Math.min(
    CONFIG.lines.stiffness * extension,
    CONFIG.lines.maxTension
  );
  leftForce = leftLineDir.multiplyScalar(tension);
}
```

#### Problèmes

1. **Loi de Hooke inappropriée** : Les lignes de cerf-volant (Dyneema, Spectra) ont une élasticité de **~2-3%**, pas un comportement de ressort linéaire classique
2. **Rigidité irréaliste** : `k = 25000 N/m` est **beaucoup trop élevée** pour une ligne de 15m
3. **Pas de pré-tension** : Les lignes réelles sont toujours pré-tendues (50-100N minimum)
4. **Transition binaire** : Passage brutal entre "ligne molle" (F=0) et "ligne tendue" (F=k×Δx)

#### Calcul Physique Réel

Pour une ligne Dyneema typique :
- **Module de Young** : E ≈ 100-120 GPa
- **Section** : A ≈ 0.3 mm² (ligne 200 kg)
- **Longueur** : L = 15 m
- **Rigidité axiale** : k = EA/L = (110×10⁹ × 0.3×10⁻⁶) / 15 = **2200 N/m**

**Écart actuel : 25000 / 2200 = 11.4× trop rigide !**

#### Impact

- Kite trop "raide" et peu réactif
- Transitions brusques lors du contrôle
- Oscillations artificielles
- Comportement de "ressort" visible au lieu de "corde"

---

### 🔴 CRITIQUE #2 : Absence de Pré-Tension

**Problème** : Les lignes passent instantanément de F=0 (molle) à F=k×Δx (tendue), sans état intermédiaire.

#### Conséquences

1. **Perte de contrôle intermittente** : Si `distance < lineLength`, la ligne ne transmet AUCUNE force
2. **Comportement "on/off"** : Pas de transition douce
3. **Instabilité numérique** : Discontinuité de force à la frontière

#### Physique Réelle

Dans un vrai kite :
- Les lignes sont **toujours tendues** (pré-tension ≈ 50-100N)
- La tension minimale est maintenue par le poids du kite + composante du vent
- La force varie de manière **continue** selon l'angle et le vent

#### Solution Recommandée

```typescript
// Modèle avec pré-tension et élasticité réaliste
const PRE_TENSION = 50; // N - Tension minimale
const REALISTIC_STIFFNESS = 2200; // N/m - Dyneema 15m

if (leftDistance > this.lineLength) {
  const extension = leftDistance - this.lineLength;
  const tension = PRE_TENSION + REALISTIC_STIFFNESS * extension;
  leftForce = leftLineDir.multiplyScalar(Math.min(tension, maxTension));
} else {
  // Même ligne molle, maintenir tension minimale
  leftForce = leftLineDir.multiplyScalar(PRE_TENSION);
}
```

---

### 🟡 MAJEUR #3 : Système de Bridage Simplifié

**Localisation** : `LineSystem.ts` + `Kite.ts`

#### Problèmes

1. **Bridage à 2 lignes** : Le système actuel utilise seulement 2 points d'attache (CTRL_GAUCHE, CTRL_DROIT)
2. **Géométrie 3D ignorée** : Les 6 brides physiques (3 par côté) sont représentées par 1 seul point
3. **Distribution de charge incorrecte** : La répartition NEZ/INTER/CENTRE n'est pas modélisée physiquement

#### Architecture Réelle d'un Bridage Delta

```
Ligne pilote (15m)
    |
CTRL_GAUCHE/DROIT (point calculé)
    |
    +--- Bride NEZ (0.68m) → Point NEZ
    +--- Bride INTER (0.50m) → Point INTER
    +--- Bride CENTRE (0.50m) → Point CENTRE
```

#### Conséquences

- **Moment de force simplifié** : Le couple calculé ne reflète pas la distribution réelle
- **Comportement de rotation approximatif** : Les effets différentiels des 3 brides ne sont pas capturés
- **Impossibilité de simuler** : Décrochage asymétrique, back-stall, etc.

#### Recommandation

**Option 1** : Garder le système simplifié mais **documenter clairement** que c'est une approximation

**Option 2** : Modéliser les 6 brides comme contraintes indépendantes :
```typescript
// 6 lignes physiques au lieu de 2
leftBridles = [
  { from: 'NEZ', to: 'CTRL_GAUCHE', length: 0.68, stiffness: 50000 },
  { from: 'INTER_GAUCHE', to: 'CTRL_GAUCHE', length: 0.50, stiffness: 50000 },
  { from: 'CENTRE', to: 'CTRL_GAUCHE', length: 0.50, stiffness: 50000 }
];
```

---

### 🟡 MAJEUR #4 : Calcul de Caténaire Non Physique

**Localisation** : `LineSystem.ts`, lignes 195-214

```typescript
calculateCatenary(start, end, segments) {
  const slack = this.lineLength - directDistance;
  const sag = slack * CONFIG.lines.maxSag;  // ⚠️ Simplification
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    point.y -= CONFIG.lines.catenarySagFactor * sag * t * (1 - t);  // ⚠️ Parabole
  }
}
```

#### Problèmes

1. **Forme parabolique** : `t * (1-t)` génère une **parabole**, pas une vraie caténaire
2. **Paramètres arbitraires** : `maxSag = 0.008` et `catenarySagFactor = 3` n'ont aucune base physique
3. **Poids de la ligne ignoré** : Une vraie caténaire dépend de la masse linéique et de la tension

#### Équation Physique Réelle

La caténaire est définie par :

```
y(x) = a × cosh(x/a) + c
```

où `a = T/(ρg)` (T = tension, ρ = masse linéique, g = gravité)

Pour une ligne Dyneema 15m :
- **Masse linéique** : ρ ≈ 0.5 g/m
- **Tension typique** : T ≈ 100 N
- **Paramètre** : a = 100/(0.0005×9.81) ≈ 20400 m

**Observation** : Pour une ligne de 15m avec T=100N, l'affaissement réel est de **~1mm** (négligeable)

#### Recommandation

**Pour le réalisme** :
1. Utiliser la vraie équation caténaire si ligne molle (T < 50N)
2. Si ligne tendue (T > 50N), approximation linéaire suffisante
3. Supprimer les paramètres `maxSag` et `catenarySagFactor` arbitraires

**Pour la performance** :
- Garder la parabole mais la **calibrer** sur des valeurs physiques réelles
- Affaissement maximum = `(ρgL²)/(8T)` pour une ligne horizontale

---

### 🟡 MAJEUR #5 : Solver PBD avec Paramètres Douteux

**Localisation** : `ConstraintSolver.ts`, lignes 45-130

#### Points Positifs

- ✅ Utilisation de **Position-Based Dynamics** (méthode robuste)
- ✅ Prise en compte du **moment d'inertie** dans la correction
- ✅ Correction de vitesse pour éviter les oscillations

#### Problèmes

1. **Tolérance trop stricte** : `LINE_CONSTRAINT_TOLERANCE = 0.0005` (0.5mm) est **excessive** pour une simulation temps réel
2. **Deux passes fixes** : `for (let i = 0; i < 2; i++)` ne garantit pas la convergence
3. **Pas de gestion d'échec** : Si les contraintes ne peuvent pas être satisfaites, le solver force quand même
4. **Facteur LINE_TENSION_FACTOR mal utilisé** : Défini dans PhysicsConstants (0.99) mais non appliqué

#### Recommandations

```typescript
// Tolérance réaliste pour temps réel
const LINE_CONSTRAINT_TOLERANCE = 0.01; // 1cm, suffisant à 60 FPS

// Nombre d'itérations adaptatif
const MAX_ITERATIONS = 5;
let converged = false;

for (let i = 0; i < MAX_ITERATIONS && !converged; i++) {
  const error = solveLine(ctrlLeft, handles.left);
  converged = (error < tolerance);
}

if (!converged) {
  console.warn("Line constraint failed to converge");
  // Mode dégradé : appliquer forces de rappel douces
}
```

---

### 🟢 MINEUR #6 : Paramètres de Configuration Incohérents

**Localisation** : `SimulationConfig.ts`

```typescript
lines: {
  defaultLength: 15,        // ✅ Réaliste
  stiffness: 25000,         // ❌ 11× trop rigide
  maxTension: 1000,         // ⚠️ Élevé mais acceptable
  maxSag: 0.008,            // ❌ Arbitraire, pas de base physique
  catenarySagFactor: 3,     // ❌ Arbitraire, pas de base physique
}
```

#### Corrections Suggérées

```typescript
lines: {
  defaultLength: 15,           // m - Longueur typique
  stiffness: 2200,             // N/m - Dyneema réaliste (EA/L)
  preTension: 75,              // N - Tension au repos
  maxTension: 800,             // N - Limite avant rupture (~80% charge max)
  linearMassDensity: 0.0005,   // kg/m - Pour caténaire physique
  dampingCoeff: 0.05,          // Damping interne ligne (dissipation)
}
```

---

### 🟢 MINEUR #7 : Contrôle de la Barre Simplifié

**Localisation** : `ControlBarManager.ts`

#### Observation

Le système actuel utilise une rotation simple autour de l'axe Y pour simuler le contrôle :

```typescript
const rotationQuaternion = new THREE.Quaternion()
  .setFromAxisAngle(rotationAxis, this.rotation);
```

#### Limitations

1. **Pas de "sheet in/out"** : Impossible de raccourcir/allonger les lignes (contrôle puissance)
2. **Rotation pure** : Pas de translation de la barre
3. **Symétrie parfaite** : Pas de simulation de gestes asymétriques du pilote

#### Impact

Pour un simulateur éducatif ou de loisir, **c'est acceptable**. Pour un simulateur de training avancé, il faudrait ajouter :
- Contrôle de longueur (sheet in/out)
- Translation latérale de la barre
- Asymétrie de force entre les deux mains

---

## 📊 Analyse Quantitative

### Comparaison Physique Réelle vs Simulation

| Paramètre | Valeur Réelle | Valeur Actuelle | Écart | Impact |
|-----------|---------------|-----------------|-------|--------|
| Rigidité ligne (k) | 2200 N/m | 25000 N/m | **+1036%** | 🔴 Critique |
| Pré-tension | 50-100 N | 0 N | **-100%** | 🔴 Critique |
| Tolérance PBD | 1-5 cm | 0.5 mm | **-95%** | 🟡 Majeur |
| Affaissement ligne | ~1 mm | Arbitraire | N/A | 🟡 Majeur |
| Masse ligne | 7.5 g | Ignorée | **-100%** | 🟢 Mineur |
| Nombre brides | 6 (3×2) | 2 | **-67%** | 🟡 Majeur |

### Hiérarchie des Corrections

```
Priorité 1 (MUST FIX) :
  ✅ Rigidité ligne réaliste (2200 N/m)
  ✅ Pré-tension (50-100 N)
  ✅ Tolérance PBD raisonnable (1 cm)

Priorité 2 (SHOULD FIX) :
  ⚠️ Caténaire physiquement fondée
  ⚠️ Documentation explicite du bridage simplifié
  ⚠️ Gestion échec convergence PBD

Priorité 3 (NICE TO HAVE) :
  💡 Modélisation 6 brides physiques
  💡 Masse ligne dans caténaire
  💡 Contrôle sheet in/out
```

---

## 🧪 Tests Recommandés

### Test 1 : Réponse en Fréquence

**Objectif** : Vérifier que la rigidité des lignes ne crée pas d'oscillations parasites

**Protocole** :
1. Lancer le kite dans un vent constant (15 km/h)
2. Appliquer une impulsion latérale (steering pulse)
3. Mesurer la fréquence d'oscillation

**Résultat Attendu** :
- Fréquence typique : 0.5-1 Hz (période 1-2s)
- Amortissement : critique ou sous-critique
- Pas de résonance

### Test 2 : Contrôle Asymétrique

**Objectif** : Vérifier la symétrie du contrôle

**Protocole** :
1. Rotation barre +45° (droite)
2. Mesurer angle de virage et temps de réponse
3. Rotation barre -45° (gauche)
4. Comparer les deux mesures

**Résultat Attendu** :
- Symétrie parfaite (écart < 5%)
- Temps de réponse : 0.5-1.5s

### Test 3 : Transition Ligne Molle/Tendue

**Objectif** : Identifier les discontinuités de force

**Protocole** :
1. Placer kite à distance = lineLength - 0.1m
2. Augmenter progressivement la distance de 0.2m
3. Enregistrer la force de ligne à chaque pas

**Résultat Attendu** :
- Transition **douce** et **continue**
- Pas de saut de force (discontinuité)

### Test 4 : Limite de Tension

**Objectif** : Vérifier que maxTension est respectée

**Protocole** :
1. Vent fort (30 km/h)
2. Kite en position power (zénith)
3. Mesurer tension max dans les lignes

**Résultat Attendu** :
- Tension < 1000 N (maxTension)
- Pas de divergence ou explosion numérique

---

## 💡 Recommandations Finales

### Corrections Immédiates (Sprint 1)

1. **Remplacer la rigidité** : `stiffness: 2200` au lieu de `25000`
2. **Ajouter pré-tension** : Modifier LineSystem pour maintenir tension minimale
3. **Assouplir tolérance PBD** : `LINE_CONSTRAINT_TOLERANCE = 0.01` (1cm)
4. **Documenter limitations** : Ajouter commentaires explicites sur le bridage simplifié

### Améliorations Moyen Terme (Sprint 2-3)

1. **Caténaire physique** : Implémenter équation réelle avec masse ligne
2. **Damping ligne** : Ajouter dissipation interne (0.05-0.1)
3. **Gestion convergence PBD** : Itérations adaptatives + mode dégradé
4. **Tests automatisés** : Implémenter les 4 tests ci-dessus

### Évolutions Long Terme

1. **Bridage 6 lignes** : Modéliser les brides physiquement (3 par côté)
2. **Contrôle avancé** : Sheet in/out, translation barre
3. **Comportements avancés** : Back-stall, décrochage asymétrique, side-slide

---

## 📚 Références Physiques

### Propriétés Dyneema (ligne typique)

- **Module de Young** : E = 110 GPa
- **Densité** : ρ = 970 kg/m³
- **Élongation à rupture** : 3.5%
- **Charge de rupture** : 200-400 kg (selon diamètre)
- **Masse linéique** : ~0.5 g/m (ligne 200kg)

### Calculs Clés

**Rigidité axiale** :
```
k = EA/L
  = (110×10⁹ Pa) × (0.3×10⁻⁶ m²) / 15 m
  = 2200 N/m
```

**Affaissement caténaire** :
```
sag = (ρgL²)/(8T)
    = (0.0005 × 9.81 × 15²) / (8 × 100)
    = 0.0014 m ≈ 1.4 mm
```

**Fréquence propre** :
```
f = (1/2π) × √(k/m_effective)
  ≈ 0.5-1 Hz (ligne 15m, masse kite 150g)
```

---

## 🎯 Conclusion

Le système actuel de physique des lignes est **fonctionnel** mais souffre de **simplifications excessives** qui nuisent au réalisme :

### Forces
- ✅ Architecture claire et modulaire
- ✅ Utilisation de PBD (méthode robuste)
- ✅ Séparation ligne / bridage / contrôle

### Faiblesses
- ❌ Rigidité 11× trop élevée
- ❌ Pas de pré-tension
- ❌ Caténaire non physique
- ❌ Bridage trop simplifié

### Impact Utilisateur
- Kite "rigide" et peu naturel
- Transitions de contrôle brusques
- Oscillations parasites possibles

**Recommandation** : Implémenter les corrections Priorité 1 (rigidité, pré-tension, tolérance) dans un premier temps, puis itérer sur les améliorations moyen terme.

---

**Audit réalisé par** : Agent IA Copilot  
**Validation requise** : Lead développeur, expert physique  
**Prochaine étape** : Implémentation des corrections Priorité 1
