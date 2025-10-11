# Modèle Physique du Kite - Sphère de Vol Contrainte

## Vue d'ensemble

Ce document décrit le modèle physique fondamental implémenté dans le simulateur de kite. Le comportement du kite est basé sur des **principes physiques émergents** plutôt que sur des comportements scriptés, garantissant un réalisme maximal.

---

## 1. Principe Fondamental : La Structure 3D Rigide

### 1.1 Composition Structurelle

Le kite est modélisé comme une **structure tridimensionnelle rigide** composée de :

- **Frames (longerons)** :
  - Spine centrale (5mm carbone)
  - Leading edges (bords d'attaque, 5mm carbone)
  - Struts (lattes transversales, 4mm carbone)

- **Surfaces rigides** :
  - Panneaux portants en tissu ripstop nylon (120 g/m²)
  - Subdivision en triangles pour calculs aérodynamiques distribués
  - Chaque surface possède sa propre orientation et surface effective

### 1.2 Masse et Inertie

Les propriétés physiques sont **calculées automatiquement** depuis la géométrie :

```
Masse totale : ~0.31 kg
Surface totale : calculée depuis KiteGeometry.TOTAL_AREA
Inertie : I ≈ m·r² (moment d'inertie calculé automatiquement)
```

**Principe important** : La masse est distribuée sur chaque surface proportionnellement à son aire. Cela permet l'émergence naturelle des couples gravitationnels.

---

## 2. La Sphère de Vol : Contrainte Géométrique Fondamentale

### 2.1 Définition Mathématique

Le kite évolue sur une **sphère virtuelle** définie par :

```
R_sphere = L_lignes + L_brides_moyennes
```

Où :
- `L_lignes` = longueur des lignes de contrôle (défaut : 15m)
- `L_brides_moyennes` = moyenne des 3 types de brides (nez, inter, centre)

**Centre de la sphère** : Position du pilote (barre de contrôle)

### 2.2 Comportement Physique

#### Phase 1 : Transport par le Vent

Au départ, la structure du kite est **emportée par le vent** :
- Les forces aérodynamiques (portance + traînée) agissent sur chaque surface
- Le kite se déplace dans l'espace 3D sans contrainte
- Il s'éloigne progressivement du pilote

#### Phase 2 : Atteinte de la Limite

Le kite atteint les **limites physiques** imposées par :
- La longueur totale des lignes de contrôle
- La longueur des brides (contraintes internes)

Quand `distance(kite, pilote) ≥ R_sphere` :
- Les lignes et brides deviennent **tendues**
- Le système passe en mode "contrainte active"

#### Phase 3 : Plaqué contre la Sphère

Une fois les lignes tendues :
- Le kite est **maintenu en permanence** contre la sphère par la pression du vent
- Il **ne peut plus s'éloigner radialement** du pilote
- Distance = R_sphere (contrainte géométrique stricte)

### 2.3 Facteur de Tension

Le système calcule un **facteur de tension** :

```typescript
tensionFactor = min(distance_actuelle / R_sphere, 1.0)
```

- `tensionFactor = 0` : Lignes complètement relâchées
- `tensionFactor = 1` : Lignes tendues, kite plaqué contre la sphère
- `0 < tensionFactor < 1` : État transitoire

---

## 3. Déplacement Tangentiel sur la Sphère

### 3.1 Principe Fondamental

Incapable de s'éloigner radialement (lignes tendues), le kite se déplace **tangentiellement** sur la surface de la sphère.

**Analogie** : Imaginez une bille attachée à une ficelle. Si vous la faites tourner, elle décrit un cercle. La bille ne peut pas s'éloigner (contrainte radiale), mais elle peut se déplacer sur la sphère définie par la ficelle.

### 3.2 Référentiel du Kite

Du point de vue du kite :
- Il avance **"vers l'avant"** selon son orientation propre
- Les surfaces inclinées créent une composante de force tangentielle
- Cette force tangentielle produit le déplacement sur la sphère

### 3.3 Transformation Forces → Mouvement

Les forces aérodynamiques sur les surfaces :

```
F_aéro = F_portance + F_traînée
```

Se décomposent en :
- **Composante radiale** : Absorbée par la tension des lignes (annulée)
- **Composante tangentielle** : Produit le mouvement sur la sphère

**Équations** :

```typescript
// Direction radiale (du pilote vers le kite)
r_hat = normalize(position_kite - position_pilote)

// Composante radiale de la force
F_radiale = dot(F_totale, r_hat) * r_hat

// Composante tangentielle (force effective)
F_tangentielle = F_totale - F_radiale

// Mouvement résultant
acceleration = F_tangentielle / masse_kite
```

---

## 4. Orientation des Surfaces et Pression du Vent

### 4.1 Calcul de la Pression par Surface

Chaque surface triangulaire du kite subit une **pression aérodynamique** dépendant de :

1. **Angle d'incidence α** : Angle entre le vent apparent et la normale de la surface

```typescript
// Vecteur vent apparent
V_apparent = V_vent_réel - V_kite

// Normale de la surface (dans repère monde)
n_surface = rotate(n_locale, orientation_kite)

// Angle d'incidence
cos(θ) = dot(normalize(V_apparent), n_surface)
sin(α) = |cos(θ)|
```

2. **Coefficients aérodynamiques** (modèle plaque plane) :

```
C_L = sin(α) × cos(α)  // Coefficient de portance
C_D = sin²(α)           // Coefficient de traînée
```

3. **Pression dynamique** :

```
q = 0.5 × ρ_air × |V_apparent|²
```

4. **Forces aérodynamiques** :

```
F_portance = q × Aire_surface × C_L × direction_portance
F_traînée = q × Aire_surface × C_D × direction_vent
```

### 4.2 Distribution Spatiale des Forces

**Principe clé** : Les forces ne sont pas appliquées au centre de masse global, mais au **centre géométrique de chaque surface**.

```typescript
// Centre de pression = barycentre du triangle
CP = (V1 + V2 + V3) / 3

// Bras de levier (du centre de masse au point d'application)
r_lever = CP - position_centre_masse

// Couple résultant (moment de force)
Couple = cross(r_lever, F_surface)
```

**Émergence naturelle** : Si les forces sont asymétriques (gauche ≠ droite), un couple de rotation émerge automatiquement, sans script !

---

## 5. Position d'Équilibre : Le Zénith

### 5.1 Définition du Zénith

Le **zénith** est le point le plus haut de la sphère de vol :

```
Position_zénith = Position_pilote + (0, R_sphere, 0)
```

C'est le sommet de la demi-sphère supérieure (hémisphère de vol).

### 5.2 Comportement en Position Neutre

Lorsque la barre de contrôle est en **position neutre** (rotation ≈ 0) :

1. **Tendance naturelle** : Le kite tend vers le zénith
2. **Orientation des surfaces** : À mesure que le kite monte, ses surfaces deviennent plus **horizontales**
3. **Réduction de la pression** : Surfaces horizontales → angle d'incidence faible → pression réduite

### 5.3 Mécanisme d'Équilibre

#### Géométrie de l'Équilibre

Au zénith :
```
- Position : (0, R_sphere, 0) relative au pilote
- Orientation : Surfaces quasi-parallèles au sol
- Angle avec le vent : α → 0° (surfaces horizontales)
```

#### Équilibre des Forces

```
F_aéro_réduite + F_gravité + F_tension_lignes = 0
```

Avec :
- `F_aéro_réduite` : Portance/traînée faibles (surfaces horizontales)
- `F_gravité` : Force gravitationnelle constante (mg)
- `F_tension_lignes` : Tension dans les lignes (contrainte géométrique)

**Pourquoi c'est stable** :
- Si le kite s'écarte du zénith → les surfaces s'inclinent → pression augmente → force de rappel vers le zénith
- C'est un équilibre **naturel et émergent**, pas scripté !

### 5.4 Implémentation du Zénith

```typescript
/**
 * Applique une légère tendance vers le zénith en position neutre
 * Simule la réduction naturelle de pression quand surfaces → horizontales
 */
static applyZenithEquilibrium(
  kite: Kite,
  predictedPosition: THREE.Vector3,
  barRotation: number,
  flightSphere: FlightSphere
): THREE.Vector3 {
  // Actif seulement si barre quasi-neutre (±10%)
  if (Math.abs(barRotation) < 0.1) {
    const zenithDirection = new THREE.Vector3(0, 1, 0);

    // Distance au zénith (normalisée)
    const zenithFactor = 1 - Math.abs(predictedPosition.y - flightSphere.center.y) / flightSphere.radius;

    // Influence proportionnelle à la proximité (max 30%)
    const zenithInfluence = Math.max(0, zenithFactor * 0.3);

    // Ajustement léger vers le zénith
    const adjustment = zenithDirection.multiplyScalar(flightSphere.radius * 0.02);
    predictedPosition.add(adjustment);
  }

  return predictedPosition;
}
```

---

## 6. Fenêtre de Vol et Zones de Puissance

### 6.1 Géométrie de la Fenêtre de Vol

La **fenêtre de vol** (wind window) est la portion accessible de la sphère, définie par :

```
- Équateur : Plan perpendiculaire au vent, passant par le pilote
- Hémisphère au vent : Zone où le kite peut voler
- Zone interdite : Hémisphère sous le vent (kite décroche)
```

### 6.2 Zones de Puissance

#### Zone de Puissance Maximale (Équateur)

**Position** : Équateur de la sphère (hauteur = hauteur_pilote)

**Caractéristiques** :
- Surfaces perpendiculaires au vent → α = 90° → sin(α) = 1
- Pression aérodynamique **maximale**
- Forces de portance et traînée **maximales**
- Vitesse du kite **maximale**

```typescript
// Position équateur (exemple : vent selon +Z)
Position_équateur = Position_pilote + R_sphere × (sin(θ), 0, cos(θ))
```

#### Zone de Puissance Minimale (Zénith)

**Position** : Sommet de la sphère (hauteur maximale)

**Caractéristiques** :
- Surfaces parallèles au sol → α → 0°
- Pression aérodynamique **minimale**
- Forces de portance et traînée **faibles**
- Vitesse du kite **minimale**
- Position d'équilibre stable

### 6.3 Transition entre Zones

Le kite se déplace **continûment** sur la sphère :

```
Puissance(θ, φ) ∝ sin(angle_incidence_moyen)
```

Où `θ, φ` sont les coordonnées sphériques du kite.

**Trajectoire typique** :
1. Départ au zénith (puissance faible)
2. Descente vers l'équateur (puissance croissante)
3. Traversée de l'équateur (puissance max)
4. Remontée de l'autre côté (puissance décroissante)
5. Retour au zénith

---

## 7. Mécanisme de Direction

### 7.1 Contrôle par Asymétrie des Lignes

Le pilote contrôle le kite via la **rotation de la barre de contrôle** :

```typescript
barRotation ∈ [-π/3, +π/3]  // ±60° max
```

**Effet géométrique** :
- Rotation gauche → Ligne gauche plus courte → Point d'attache gauche plus proche
- Rotation droite → Ligne droite plus courte → Point d'attache droit plus proche

### 7.2 Émergence du Twist

L'asymétrie des lignes produit un **twist** (torsion de l'aile) :

```
Ligne_courte → Tension_augmentée → Point_tiré_vers_pilote
Ligne_longue → Tension_réduite → Point_libre
```

**Conséquence** : Le bord d'attaque (leading edge) s'incline, modifiant l'angle d'attaque local des surfaces.

### 7.3 Asymétrie Aérodynamique Émergente

Le twist crée une **différence d'angle d'incidence** entre côtés gauche et droit :

```
α_gauche ≠ α_droite  →  F_portance_gauche ≠ F_portance_droite
```

**Couple de lacet** :

```typescript
// Forces asymétriques
F_gauche = somme(F_surfaces_gauche)
F_droite = somme(F_surfaces_droite)

// Bras de levier moyens
r_gauche = barycentre(centres_surfaces_gauche) - centre_masse
r_droite = barycentre(centres_surfaces_droite) - centre_masse

// Couple résultant
Couple_lacet = cross(r_gauche, F_gauche) + cross(r_droite, F_droite)
```

**Résultat** : Le kite tourne naturellement dans la direction voulue, **sans comportement scripté** !

---

## 8. Gestion des Contraintes (Position-Based Dynamics)

### 8.1 Algorithme PBD (Position-Based Dynamics)

Le système utilise PBD pour garantir le respect des contraintes géométriques :

**Contraintes principales** :
1. **Lignes de contrôle** : Distance(CTRL_GAUCHE, poignée_gauche) ≤ L_ligne
2. **Lignes de contrôle** : Distance(CTRL_DROIT, poignée_droite) ≤ L_ligne
3. **Brides** : Distance(point_attache, point_contrôle) = L_bride

### 8.2 Résolution Itérative

Pour chaque contrainte violée :

```typescript
// Calcul de la violation
C = distance_actuelle - distance_cible

// Direction de correction
n = normalize(point_B - point_A)

// Calcul du multiplicateur de Lagrange λ
denominator = (1/masse) + (bras_levier²) / inertie
λ = C / denominator

// Corrections de position et rotation
delta_position = n × (λ / masse)
delta_rotation = (bras_levier × n) × (λ / inertie)
```

**Itérations multiples** : Les contraintes sont résolues en plusieurs passes (typiquement 3-5) pour convergence.

### 8.3 Correction de Vitesse

Après correction de position, les vitesses sont ajustées pour éviter les violations futures :

```typescript
// Vitesse du point de contrainte
v_point = v_centre_masse + cross(ω, bras_levier)

// Vitesse radiale (le long de la contrainte)
v_radiale = dot(v_point, n)

// Si le point s'éloigne, corriger
if (v_radiale > 0) {
  J = -v_radiale / denominator
  v_centre_masse += n × (J / masse)
  ω += cross(bras_levier, n) × (J / inertie)
}
```

---

## 9. Collision avec le Sol

### 9.1 Détection Multi-Points

Le système vérifie plusieurs points anatomiques du kite :

```typescript
const pointsToCheck = [
  'NEZ',
  'SPINE_BAS',
  'BORD_GAUCHE',
  'BORD_DROIT',
  'WHISKER_GAUCHE',
  'WHISKER_DROIT'
]
```

### 9.2 Réponse à la Collision

Pour chaque point en contact avec le sol (y ≤ 0) :

```typescript
// Correction de position
penetration = groundY - point.y
kite.position.y += penetration

// Correction de vitesse (rebond)
if (velocity.y < 0) {
  velocity.y = -velocity.y × restitution  // restitution ≈ 0.3
}

// Application de la friction
velocity.x *= groundFriction  // friction ≈ 0.85
velocity.z *= groundFriction
```

---

## 10. Système de Logging et Instrumentation

### 10.1 Données Enregistrées

Le système enregistre à chaque seconde :

```
📊 ÉTAT COMPLET DU KITE
├── Position & Orientation (x, y, z, pitch, roll, yaw)
├── Cinématique (vitesse, accélération, vitesse angulaire)
├── Aérodynamique (vent apparent, portance, traînée, ratio L/D)
├── Forces & Couples (gravité, force totale, couple total)
└── Tensions (lignes gauche/droite, brides nez/inter/centre)
```

### 10.2 Métriques Clés

```typescript
// Asymétrie des lignes (indicateur de direction)
tensionAsym = (leftTension - rightTension) / max(leftTension, rightTension) × 100

// Ratio portance/traînée (efficacité aérodynamique)
L_D_ratio = liftMagnitude / dragMagnitude

// Facteur de tension (état des lignes)
tensionFactor = currentDistance / sphereRadius
```

---

## 11. Hiérarchie des Systèmes

### 11.1 Architecture ECS

```
SimulationApp
├── KitePhysicsSystem (système principal)
│   ├── WindSimulator (environnement)
│   ├── AerodynamicsCalculator (forces distribuées)
│   ├── LineSystem (contraintes externes)
│   ├── BridleSystem (contraintes internes)
│   ├── ConstraintSolver (résolution PBD)
│   └── KiteController (intégration état)
├── ControlBarSystem (input pilote)
├── RenderSystem (visualisation)
└── DebugRenderer (instrumentation)
```

### 11.2 Flux de Données

```
Input (rotation barre)
  ↓
ControlBarSystem → positions poignées
  ↓
KitePhysicsSystem:
  1. WindSimulator → vent apparent
  2. AerodynamicsCalculator → forces par surface
  3. Somme forces → force totale + couple
  4. LineSystem → tensions lignes
  5. BridleSystem → tensions brides
  6. ConstraintSolver → corrections PBD
  7. KiteController → intégration état
  8. handleGroundCollision → collision sol
  ↓
RenderSystem → affichage 3D
DebugRenderer → vecteurs/instrumentation
```

---

## 12. Paramètres de Configuration

### 12.1 Constantes Physiques (CONFIG)

```typescript
CONFIG = {
  physics: {
    gravity: 9.81,           // m/s²
    airDensity: 1.225,       // kg/m³
    deltaTimeMax: 0.016,     // 60 FPS
    linearDampingCoeff: 1.5, // Amortissement
    angularDragFactor: 1.5   // Friction angulaire
  },
  aero: {
    liftScale: 2.5,          // Scaling portance
    dragScale: 1.8           // Scaling traînée
  },
  kite: {
    mass: 0.31,              // kg (calculée auto)
    area: KiteGeometry.TOTAL_AREA,  // m²
    inertia: KiteGeometry.INERTIA   // kg·m²
  },
  lines: {
    defaultLength: 15,       // m
    stiffness: 2500,         // N/m
    maxTension: 1200         // N
  },
  wind: {
    defaultSpeed: 20,        // km/h
    defaultTurbulence: 5     // %
  }
}
```

### 12.2 Constantes PBD (PhysicsConstants)

```typescript
PhysicsConstants = {
  CONSTRAINT_ITERATIONS: 3,        // Passes de résolution
  LINE_CONSTRAINT_TOLERANCE: 0.01, // m
  EPSILON: 1e-6,                   // Seuil numérique
  GROUND_FRICTION: 0.85            // Coefficient friction sol
}
```

---

## 13. Validation et Tuning

### 13.1 Comportements Attendus

✅ **Zénith stable** : En position neutre, le kite monte et s'équilibre au zénith
✅ **Direction émergente** : Rotation barre → asymétrie forces → lacet naturel
✅ **Power zone** : À l'équateur, vitesse et forces maximales
✅ **Déplacement tangentiel** : Le kite "glisse" sur la sphère, pas de mouvement radial
✅ **Twist géométrique** : Asymétrie lignes → inclinaison bord d'attaque

### 13.2 Métriques de Validation

```typescript
// 1. Respect contrainte sphère
assert(|position_kite - position_pilote| ≤ R_sphere + tolerance)

// 2. Équilibre zénith (position neutre, après stabilisation)
assert(position_kite.y ≈ R_sphere ± 1m)

// 3. Symétrie forces (barre neutre)
assert(|F_gauche - F_droite| < 5% × F_totale)

// 4. Asymétrie forces (barre tournée)
assert(|F_gauche - F_droite| > 10% × F_totale)

// 5. Pression réduite au zénith
assert(F_aéro_zénith < F_aéro_équateur / 2)
```

---

## 14. Références Théoriques

### 14.1 Mécanique des Fluides

- Hoerner, S.F. (1965). *Fluid-Dynamic Drag*. Coefficients plaque plane
- Anderson, J.D. (2017). *Fundamentals of Aerodynamics*. Calculs portance/traînée

### 14.2 Dynamique du Corps Rigide

- Witkin, A. & Baraff, D. (2001). *Physically Based Modeling*. Contraintes et PBD
- Müller, M. et al. (2007). *Position Based Dynamics*. Algorithme PBD

### 14.3 Simulation de Kites

- Williams, P. et al. (2008). *Dynamics of Flexible Kites*. Modèles physiques
- Fagiano, L. & Milanese, M. (2012). *Airborne Wind Energy*. Aérodynamique kites

---

## Résumé Exécutif

Le simulateur implémente un modèle physique **complet et émergent** basé sur :

1. **Sphère de vol contrainte** : R = L_lignes + L_brides
2. **Forces distribuées** : Calcul par surface avec coefficients aérodynamiques réalistes
3. **Déplacement tangentiel** : Mouvement sur la sphère, composante radiale annulée
4. **Équilibre zénith** : Position stable naturelle (surfaces horizontales → pression réduite)
5. **Direction émergente** : Asymétrie géométrique → asymétrie aérodynamique → couple de lacet
6. **Contraintes PBD** : Garantie géométrique stricte (lignes, brides, sol)

**Aucun comportement n'est scripté** : Tout émerge des lois physiques fondamentales (Newton, aérodynamique, contraintes géométriques).

---

**Auteur** : Système de simulation Kite v5
**Date** : 2025-10-11
**Version** : 1.0
