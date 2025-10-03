# Amélioration du Modèle Physique des Brides

**Date** : 3 octobre 2025  
**Branche** : `feature/tension-forces-physics`  
**Objectif** : Clarifier et améliorer le modèle physique des **brides** comm### 3. Équilibre Statique : Plaquage et Forces

Au point d'**Exemple concret** :
- Portance (lift) = 50 N vers le haut
- Gravité = 5 N vers le bas
- Traînée (drag) = 30 N vers l'arrière
- **Lignes principales** : Contraintes géométriques (maintiennent distance fixe = lineLength)
  - Tension ~40N chacune (réaction : le kite "tire" sur les lignes car il est poussé par le vent)
- **Brides** : Cage géométrique interne (maintiennent géométrie du kite)
  - Longueur bride NEZ = 0.68m → Impose distance max NEZ-CTRL
  - Longueur bride INTER = 0.50m → Impose distance max INTER-CTRL
  - Longueur bride CENTRE = 0.50m → Impose distance max CENTRE-CTRL
  - **Géométrie résultante** = angle d'attaque ~25° (exemple)
  - **Tensions brides** : variables selon où le kite est plaqué (réactions)
    - Si bride NEZ très tendue → kite plaqué fort contre cette contrainte
    - Si bride CENTRE molle → cette contrainte n'est pas active (pas saturée)(kite immobile dans le vent) :

```
Équilibre dynamique:
ΣF = 0  →  F_aero + F_gravity = 0
ΣT = 0  →  T_aero = 0

Équilibre géométrique:
Toutes les contraintes PBD sont saturées (kite plaqué contre les limites)
```

**IMPORTANT** : Les lignes et brides n'apparaissent PAS dans l'équation de forces car elles sont des **contraintes géométriques**, pas des générateurs de forces.

**Mécanisme complet du plaquage** :

1. **Réglage initial** : Longueurs des brides définissent une CAGE GÉOMÉTRIQUE
   ```
   Bride NEZ = 0.68m  → Sphère de rayon 0.68m centrée sur NEZ
   Bride INTER = 0.50m → Sphère de rayon 0.50m centrée sur INTER  
   Bride CENTRE = 0.50m → Sphère de rayon 0.50m centrée sur CENTRE
   → Intersection des 3 sphères = position UNIQUE du CTRL
   → Cette géométrie impose l'ANGLE D'ATTAQUE du kite
   ```

2. **Action du vent** : Le vent POUSSE le kite
   ```
   F_aero (dépend de l'angle d'attaque imposé par la cage géométrique)
   F_gravity (constante : ~5N pour un kite de 0.5kg)
   → Résultante pousse le kite dans une direction
   ```

3. **Plaquage** : Le kite vient SE PLAQUER contre les limites géométriques
   ```
   Si F_aero + F_gravity pousse le kite au-delà des limites de brides:
   → ConstraintSolver.enforceBridleConstraints() RAMÈNE le kite à la limite
   → Le kite reste PLAQUÉ à cette position
   → Les brides "saturées" ont une tension élevée (réaction)
   ```

4. **Équilibre final** : Position où le vent ne peut plus pousser le kite
   ```
   Dynamiquement: F_aero + F_gravity = 0 (forces s'annulent)
   Géométriquement: Kite à la limite des contraintes (plaqué)
   → Les tensions mesurées indiquent CONTRE QUOI le kite est plaqué
   ```

**Exemple concret** : géométriques strictes (incassables, inextensibles)

---

## 📋 Contexte

### État Actuel (AS-IS)

Dans la version actuelle, les tensions sont **calculées mais pas appliquées** :

```typescript
// PhysicsEngine.ts (ligne ~115)
// CALCUL DES TENSIONS (pour affichage/debug uniquement)
// Les lignes ne TIRENT PAS le kite - elles le RETIENNENT à distance max
this.lineSystem.calculateLineTensions(kite, newRotation, pilotPosition);

// CALCUL DES TENSIONS DES BRIDES (pour affichage/debug uniquement)
const bridleTensions = this.bridleSystem.calculateBridleTensions(kite);
```

**Modèle actuel :**
- Forces = Aérodynamique + Gravité
- Lignes/Brides = Contraintes PBD (distance maximale)
- Tensions = Affichage uniquement

**Problèmes identifiés :**
1. ⚠️  Compréhension incorrecte : les brides sont des **contraintes géométriques strictes** (PBD), pas des ressorts
2. ⚠️  Les brides sont **incassables et quasi-inextensibles** (Dyneema/Spectra)
3. ✅ Les lignes principales retiennent correctement à distance fixe (PBD OK)
4. ✅ Le modèle actuel est physiquement correct
5. 📊 Amélioration : mieux documenter le rôle des brides dans l'équilibre du kite
---

## 1. Mécanisme Fondamental : Plaquage Contre les Contraintes

### Vision Mécanique

Le kite se comporte comme un **objet rigide plaqué contre une cage géométrique** :

```
1. Structure rigide (Kite.ts)
   └─> Géométrie FIXE définie par les points anatomiques (NEZ, BORD_GAUCHE/DROIT, etc.)

2. Vent applique forces aérodynamiques
   └─> POUSSE la structure rigide dans toutes les directions

3. Contraintes PBD définissent une CAGE GÉOMÉTRIQUE
   ├─> Lignes principales: distance EXACTE (= lineLength)
   └─> Brides: distance MAXIMALE (<= bridleLength)
        ├─> Bride NEZ: CTRL à max 0.68m du NEZ
        ├─> Bride INTER: CTRL à max 0.50m du INTER
        └─> Bride CENTRE: CTRL à max 0.50m du CENTRE
        → Intersection de 3 sphères = position UNIQUE du CTRL

4. Le kite se PLAQUE contre ces limites
   └─> Équilibre = position où le vent ne peut plus pousser le kite
       (toutes les contraintes géométriques sont saturées)
```

**Analogie** : Ballon gonflé dans une cage rigide
- Le ballon (vent) pousse dans toutes les directions
- La cage (brides + lignes) définit les limites géométriques
- Le ballon se plaque contre les barreaux
- Forme finale = intersection entre poussée et contraintes

### Rôle des Brides

Les brides ne "tirent" PAS et ne "retiennent" PAS → elles sont un **système de réglage d'angle** :

- **Fonction primaire** : ORIENTER le kite à un angle d'attaque spécifique
- **Mécanisme** : Définir la position géométrique des points de contrôle (CTRL_GAUCHE/DROIT) par rapport à la structure rigide
- **Résultat** : Imposer l'angle entre le kite et les lignes principales

**Changement de longueur des brides** :
```
Brides plus courtes → CTRL plus près du NEZ → Angle d'attaque plus faible → Moins de portance
Brides plus longues → CTRL plus loin du NEZ → Angle d'attaque plus élevé → Plus de portance
```

**Les brides sont des "réglages d'angle", pas des éléments porteurs !**

C'est comme les câbles qui règlent l'angle d'une voile de bateau : ils ne portent pas la charge, ils **orientent** la surface pour qu'elle reçoive le vent correctement.

---

## 🎯 Compréhension Correcte (TO-BE)

### Modèle Physique Réel

**Les brides sont des petites lignes incassables et quasi-inextensibles :**
- Matériau : Dyneema ou Spectra (même que les lignes principales)
- Comportement : **Contraintes géométriques strictes** (distance maximale)
- Rôle : Imposer la géométrie interne du kite
- Modèle : **PBD pur** (pas de forces actives, pas de ressorts)

**Architecture physique actuelle (CORRECTE) :**

```
PhysicsEngine.update():
  1. Calculer vent apparent
  2. Calculer forces aérodynamiques (lift, drag, torque)
  3. Calculer force de gravité
  4. Appliquer forces totales : F_total = F_aero + F_gravity
  5. Intégrer position/vélocité (F=ma, T=Iα)
  6. Appliquer contraintes PBD lignes principales (distance = lineLength)
  7. Appliquer contraintes PBD brides (distance <= bridleLength)
  8. Calculer tensions pour visualisation (optionnel)
```

**Principe clé :** 
- **Lignes principales** = Contraintes PBD (distance fixe, incassables, inextensibles)
- **Brides** = Contraintes PBD (distance max, incassables, inextensibles)
- **Les brides NE TIRENT PAS** - elles **RETIENNENT** à distance maximale
- L'équilibre du kite dépend de la **géométrie** imposée par les brides, pas de forces internes

---

## 🔬 Physique des Brides et Lignes

### 1. Lignes Principales (Pilote → Kite)

**Les lignes principales restent des contraintes PBD pures** (comportement actuel correct) :

```typescript
// Contrainte géométrique uniquement - PAS de forces
ConstraintSolver.enforceLineConstraints(kite, newPosition, state, handles);

// Résultat : distance(CTRL_GAUCHE, HANDLE_LEFT) = lineLength (exactement)
//           distance(CTRL_DROIT, HANDLE_RIGHT) = lineLength (exactement)
```

**Pourquoi ce modèle est correct :**
- Les lignes Dyneema sont **quasi-inextensibles** (élasticité < 1%)
- Elles se comportent comme des **tiges rigides** en tension
- Le modèle PBD est **physiquement correct** pour ce cas
- Les tensions calculées sont des **réactions** aux contraintes, pas des causes

**Tension calculée** (pour affichage/debug uniquement) :
```typescript
// La tension est réelle (réaction), mais n'applique pas de force
// C'est la réaction du système aux contraintes géométriques
const tension = LinePhysics.calculateTension(line, distance, velocity);
```

### 2. Brides (Structure Interne du Kite)

**Les brides sont également des contraintes PBD pures :**

```typescript
// Contrainte géométrique - PAS de forces actives
ConstraintSolver.enforceBridleConstraints(kite, newPosition, state);

// Résultat : distance(NEZ, CTRL_GAUCHE) <= bridleLength_nez
//           distance(INTER_GAUCHE, CTRL_GAUCHE) <= bridleLength_inter
//           distance(CENTRE, CTRL_GAUCHE) <= bridleLength_centre
//           (idem pour côté droit)
```

**Propriétés des brides :**
- Matériau : Dyneema/Spectra (comme les lignes principales)
- **Incassables** (dans le cadre de la simulation)
- **Quasi-inextensibles** (élasticité négligeable)
- Imposent une **géométrie interne fixe** au kite
- Ne génèrent **aucune force active**

**Rôle des brides dans l'équilibre :**
- La configuration des brides (longueurs nez/inter/centre) détermine :
  - L'angle d'attaque du kite (angle entre la voile et le vent)
  - La position des points de contrôle (CTRL_GAUCHE, CTRL_DROIT)
  - La répartition des forces aérodynamiques sur la voile
- Modifier une longueur de bride change la **géométrie interne**, donc l'équilibre
- **Les brides ne tirent pas et ne retiennent pas** - elles **définissent une cage géométrique**
- Le kite se **plaque contre cette cage** sous l'effet du vent

**Mécanisme de plaquage :**
1. Les brides définissent 3 sphères de contrainte par côté :
   - Sphère NEZ : rayon 0.68m centrée sur le nez
   - Sphère INTER : rayon 0.50m centrée sur le point intermédiaire
   - Sphère CENTRE : rayon 0.50m centrée sur le centre
   - **Intersection des 3 sphères** = position UNIQUE du point de contrôle (CTRL)

2. Le vent pousse le kite avec `F_aero` (dépend de l'angle d'attaque)

3. Si le vent pousse le CTRL au-delà de cette intersection :
   - `ConstraintSolver.enforceBridleConstraints()` **ramène** le CTRL dans la zone autorisée
   - Le kite se retrouve **plaqué** à la limite de ses contraintes géométriques
   
4. Position d'équilibre = où le vent ne peut plus pousser le kite au-delà des limites

**Analogie** : Un ballon gonflé dans une cage rigide
- Le ballon (forces du vent) pousse dans toutes les directions
- La cage (brides) définit les limites géométriques
- Le ballon se plaque contre les barreaux
- La forme finale = intersection entre poussée et contraintes

### 3. Équilibre Statique (Hovering)

Au point d'équilibre (kite immobile dans le vent) :

```
ΣF = 0  →  F_aero + F_gravity = 0
ΣT = 0  →  T_aero = 0

(Les lignes et brides n'apparaissent pas car ce sont des contraintes, pas des forces)
```

**Exemple typique :**
- Portance (lift) = 50 N vers le haut
- Gravité = 5 N vers le bas
- Traînée (drag) = 30 N vers l'arrière
- **Lignes principales** : Contraintes géométriques (maintiennent distance fixe)
- **Brides** : Contraintes géométriques internes (maintiennent géométrie du kite)
  - Longueur bride NEZ → détermine position du nez par rapport aux CTRL
  - Longueur bride INTER → détermine courbure du profil
  - Longueur bride CENTRE → détermine position du centre par rapport aux CTRL
  - **La géométrie résultante détermine l'angle d'attaque** optimal

**Tensions calculées** (pour visualisation/debug) :
```typescript
// Tensions lignes : ~40N chacune (réaction aux contraintes)
// Tensions brides : variables selon la charge (réaction aux contraintes internes)
// Ces tensions sont des CONSÉQUENCES de la géométrie, pas des CAUSES
```

---

## 🏗️ Améliorations Possibles

### Option 1 : Documentation et Visualisation (Recommandé)

**Objectif** : Mieux documenter et visualiser le rôle des brides

**Actions** :
1. Ajouter documentation sur le calcul des longueurs de brides optimales
2. Améliorer la visualisation des tensions (code couleur par tension)
3. Ajouter UI pour ajuster les longueurs de brides en temps réel
4. Documenter l'influence de chaque bride sur l'angle d'attaque

**Fichiers à modifier** :
- `docs/BRIDLES_CONFIGURATION.md` (nouveau) - Guide de configuration
- `src/simulation/ui/UIManager.ts` - Sliders pour longueurs brides
- `src/objects/organic/Kite.ts` - Méthode `setBridleLengths()` (existe déjà)

**Avantages** :
- ✅ Aucun risque de casser la physique
- ✅ Améliore la compréhension du système
- ✅ Permet l'expérimentation utilisateur
- ✅ Temps de dev court (2-3 jours)

### Option 2 : Amélioration du Solver PBD (Avancé)

**Objectif** : Améliorer la précision et la stabilité du ConstraintSolver

**Actions** :
1. Implémenter itérations multiples pour les contraintes de brides
2. Ajouter damping spécifique pour les oscillations de brides
3. Optimiser l'ordre de résolution des contraintes (lignes → brides)
4. Ajouter contrainte de "limite au carré" pour éviter over-extension

**Fichiers à modifier** :
- `src/simulation/physics/ConstraintSolver.ts`
  - Améliorer `enforceBridleConstraints()` avec multi-iterations
  - Ajouter damping paramétrable
  - Implémenter solver Gauss-Seidel au lieu de Jacobi
- `src/simulation/config/SimulationConfig.ts`
  - Paramètres PBD : iterations, damping, tolerance

**Pseudo-code** :
```typescript
static enforceBridleConstraints(
  kite: Kite,
  newPosition: THREE.Vector3,
  state: { velocity, angularVelocity },
  bridleLengths: BridleLengths,
  iterations: number = 3  // NOUVEAU
): void {
  // Résoudre les 6 contraintes de brides avec multi-iterations
  for (let iter = 0; iter < iterations; iter++) {
    for (const bridle of allBridles) {
      const currentDistance = distance(bridle.start, bridle.end);
      
      if (currentDistance > bridle.maxLength) {
        // Correction PBD stricte (incassable)
        const correction = (currentDistance - bridle.maxLength) / 2;
        
        // Appliquer correction avec damping
        const dampedCorrection = correction * (1 - CONFIG.pbd.dampingFactor);
        
        // Déplacer les deux extrémités (action-réaction)
        bridle.start += direction * dampedCorrection;
        bridle.end -= direction * dampedCorrection;
        
        // Mettre à jour vélocités (feedback PBD → vitesses)
        state.velocity -= direction * (dampedCorrection / deltaTime);
      }
    }
  }
}
```

**Avantages** :
- ✅ Meilleure stabilité numérique
- ✅ Convergence plus rapide
- ✅ Moins d'oscillations parasites
- ⚠️  Temps de dev moyen (5-7 jours)
- ⚠️  Requiert validation extensive

### Option 3 : Réglage Dynamique des Brides (Futur)

**Objectif** : Permettre de changer les longueurs de brides pendant le vol

**Use case** : Simulation de trimming, ajustement angle d'attaque optimal

**Actions** :
1. Ajouter méthode `Kite.adjustBridleLength(side, position, newLength)`
2. Recalculer points anatomiques en temps réel
3. Animer la transition entre configurations
4. UI pour contrôles utilisateur

**Exemple** :
```typescript
// Raccourcir bride NEZ gauche de 2cm → augmente angle d'attaque
kite.adjustBridleLength('left', 'nez', 0.66); // était 0.68m

// Allonger bride CENTRE droite de 1cm → modifie symétrie
kite.adjustBridleLength('right', 'centre', 0.51); // était 0.50m
```

**Avantages** :
- ✅ Permet tuning fin du kite
- ✅ Simulation réaliste du trimming
- ⚠️  Complexité accrue
- ⚠️  Temps de dev important (7-10 jours)

---

## 🧪 Tests et Validation (Système Actuel)

### Scénarios de Test pour Comprendre le Système

#### Test 1 : Hovering Stable
**Setup :**
- Vent constant 8 m/s
- Kite au zénith (90°)
- Lignes égales
- Brides configuration par défaut

**Observations attendues :**
- ✅ Kite reste stable (oscillations < 10 cm)
- ✅ Angle d'attaque déterminé par configuration des brides
- ✅ Tensions lignes équilibrées (~40N chacune)
- ✅ Tensions brides variables selon charge aéro

#### Test 2 : Influence de la Longueur de Bride NEZ
**Setup :**
- Modifier longueur bride NEZ : 0.68m → 0.70m (+2cm)
- Observer changement d'équilibre

**Observations attendues :**
- ✅ Angle d'attaque diminue (nez plus loin des CTRL)
- ✅ Position du kite dans fenêtre de vol change
- ✅ Forces aérodynamiques redistribuées
- ✅ Nouvel équilibre stable atteint

#### Test 3 : Influence de la Longueur de Bride CENTRE
**Setup :**
- Modifier longueur bride CENTRE : 0.50m → 0.48m (-2cm)
- Observer changement de géométrie

**Observations attendues :**
- ✅ Centre du kite plus proche des CTRL
- ✅ Profil du kite modifié (plus cambré)
- ✅ Angle d'attaque augmenté
- ✅ Performance modifiée (plus/moins de portance)

#### Test 4 : Asymétrie Gauche/Droite
**Setup :**
- Bride NEZ gauche : 0.68m
- Bride NEZ droite : 0.70m (+2cm)
- Observer comportement asymétrique

**Observations attendues :**
- ✅ Kite tourne naturellement vers la gauche
- ✅ Tensions asymétriques dans les lignes
- ✅ Couple permanent appliqué
- ✅ Démonstration du rôle géométrique des brides

---

## 📊 Compréhension du Système Actuel

### Modèle Physique (CORRECT)

**Forces appliquées :**
- ✅ Forces aérodynamiques (lift, drag, torque) - calculées par surface
- ✅ Force de gravité (F = mg)
- ❌ PAS de forces de lignes (contraintes géométriques)
- ❌ PAS de forces de brides (contraintes géométriques)

**Contraintes géométriques :**
- ✅ Lignes principales : distance fixe (PBD strict)
- ✅ Brides : distance maximale (PBD strict, incassables)
- ✅ Sol : collision (ne pas traverser y=0)

**Tensions calculées (debug/viz) :**
- ✅ Tensions lignes : réactions aux contraintes
- ✅ Tensions brides : réactions aux contraintes internes
- ℹ️  Ces tensions sont des **conséquences**, pas des **causes**

### Rôle des Brides

**Ce que les brides FONT :**
1. Imposent la géométrie interne du kite (positions relatives des points)
2. Déterminent l'angle d'attaque via les positions des CTRL
3. Définissent le profil aérodynamique de la voile
4. Créent la structure mécanique du kite

**Ce que les brides NE FONT PAS :**
1. ❌ Tirer ou pousser (pas de forces actives)
2. ❌ Stabiliser dynamiquement (pas de ressort)
3. ❌ Casser ou s'étirer (incassables, inextensibles)
4. ❌ Changer pendant le vol (longueurs fixes)

### Performance du Système

**Points forts :**
- ✅ Physiquement correct pour matériaux quasi-inextensibles
- ✅ Stable numériquement (PBD robuste)
- ✅ Performance excellente (60 FPS)
- ✅ Prévisible et déterministe

**Limitations :**
- ⚠️  Brides fixes (pas de trimming dynamique)
- ⚠️  Tensions affichées mais pas exploitées
- ⚠️  Documentation manquante sur configuration optimale

---

## 🚧 Clarifications et Mythes

### ❌ Mythe 1 : "Les brides stabilisent le kite"

**Réalité :** Les brides **imposent une géométrie** qui détermine un angle d'attaque. La stabilisation vient des forces aérodynamiques qui dépendent de cette géométrie.

**Exemple :**
- Bride NEZ courte → angle d'attaque élevé → plus de portance → kite monte
- Bride NEZ longue → angle d'attaque faible → moins de portance → kite descend
- C'est l'aérodynamique qui stabilise, pas les brides directement

### ❌ Mythe 2 : "Les tensions de brides appliquent des forces"

**Réalité :** Les tensions calculées sont des **réactions** aux contraintes, pas des forces actives.

**Analogie :**
- Une table supporte un livre → tension dans les pieds de la table
- Mais les pieds ne "poussent" pas le livre vers le haut
- C'est une réaction à la contrainte "le livre ne traverse pas la table"

### ❌ Mythe 3 : "Il faut ajouter des forces de brides pour plus de réalisme"

**Réalité :** Pour des matériaux **quasi-inextensibles** (Dyneema, Spectra), le modèle PBD est **plus correct** que des ressorts.

**Pourquoi :**
- Rigidité d'un ressort Dyneema ≈ 50 000 N/m
- Avec deltaTime = 0.016s, oscillations haute fréquence garanties
- PBD évite ce problème en imposant directement la géométrie

### ✅ Vérité : "Les brides déterminent la configuration du kite"

**Réalité :** C'est exactement leur rôle !

**Comment :**
1. Longueurs de brides → positions relatives des points → géométrie 3D
2. Géométrie 3D → angle d'attaque → répartition des forces aéro
3. Forces aéro → mouvement du kite → nouvel équilibre
4. Boucle fermée : géométrie (brides) ↔ aérodynamique ↔ mouvement

---

## 📅 Recommandation de Planning

### ✅ Recommandé : Option 1 (Documentation & Visualisation)

**Durée** : 2-3 jours

**Sprint unique :**
- [ ] Jour 1 : Documentation configuration brides optimales
- [ ] Jour 2 : UI sliders pour ajuster longueurs
- [ ] Jour 3 : Tests et validation

**Livrables :**
- `docs/BRIDLES_CONFIGURATION.md` - Guide de configuration
- UI interactive pour expérimenter
- Visualisation améliorée des tensions

### 🔶 Optionnel : Option 2 (Amélioration PBD)

**Durée** : 5-7 jours

**Sprint 1 (3 jours) :**
- [ ] Implémenter multi-iterations PBD
- [ ] Ajouter damping paramétrable
- [ ] Tests de stabilité

**Sprint 2 (2-4 jours) :**
- [ ] Optimiser ordre de résolution
- [ ] Tuning des paramètres
- [ ] Validation performance

### 🔷 Futur : Option 3 (Réglage Dynamique)

**Durée** : 7-10 jours (à planifier ultérieurement)

**Prérequis :**
- Option 1 complétée (documentation)
- Option 2 complétée (PBD robuste)
- Use cases validés par utilisateurs

---

## 📚 Références

### Documents Existants
- `docs/LINE_PHYSICS_AUDIT_2025-10-01.md` — Audit des tensions actuelles
- `docs/BRIDLES_AS_LINES_DESIGN.md` — Architecture des brides (PBD)
- `docs/OOP_LINE_ARCHITECTURE.md` — Architecture lignes
- `.github/copilot-instructions.md` — Instructions AI agents (mis à jour)

### Littérature Physique
- **Position-Based Dynamics** (Müller et al. 2007) - Fondation théorique PBD
- **Kite Modeling and Control** (Loyd 2012) - Physique des cerfs-volants
- **Dyneema Material Properties** - Élasticité négligeable (<1%)

### Code Critique
- `src/simulation/physics/ConstraintSolver.ts` — PBD actuel (correct)
- `src/simulation/physics/LinePhysics.ts` — Calcul tensions (debug/viz)
- `src/simulation/physics/BridleSystem.ts` — Système de brides (PBD)
- `src/factories/PointFactory.ts` — Calcul positions anatomiques avec brides
- `src/objects/organic/Kite.ts` — Méthode `setBridleLengths()`

---

**Auteur:** Matthieu (avec assistance AI)  
**Statut:** � Document de Compréhension - Système actuel clarifié  
**Conclusion:** Le modèle physique actuel est **correct**. Les brides sont des contraintes géométriques (PBD), pas des forces actives.  
**Recommandation:** Option 1 (Documentation & Visualisation) pour améliorer l'expérience utilisateur sans toucher à la physique.
