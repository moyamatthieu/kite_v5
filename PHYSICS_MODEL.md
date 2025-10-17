# Modèle Physique du Kite - Sphère de Vol Contrainte

## Vue d'ensemble

Ce document décrit le modèle physique fondamental implémenté dans le simulateur de kite. Le comportement du kite est basé sur des **principes physiques émergents** plutôt que sur des comportements scriptés, garantissant un réalisme maximal.

---

Attention, réfléchis et analyse bien le système.
La barre de contrôle possède un pivot fixe, et les poignées (handles) sont situées à ses extrémités.
De chacune de ces extrémités part une ligne qui se relie au sommet d’une pyramide de bridage.
Cette pyramide permet de maintenir le kite dans une position stable par rapport au vent.

Les deux lignes sont interdépendantes et de longueur fixe ; elles se déplacent en suivant les mouvements des poignées.
Ces déplacements entraînent une action simultanée sur l’autre extrémité des lignes, connectée aux points de contrôle du bridage.

┌─────────────────────────────────────┐
│  KITE                               │
│  F_aero = Lift + Drag              │ ← Vent apparent
└──────────┬──────────────────────────┘
           │ Forces réparties sur 6 points (NEZ, INTER_L, INTER_R, CENTRE × 2)
           ▼
    ┌──────┴──────┐
    │   BRIDES    │ (6 brides tendues)
    │ Tension = ? │
    └──────┬──────┘
           │ Tensions convergent vers CTRL
           ▼
    ┌─────────────┐
    │    CTRL     │ (équilibre de forces)
    │ F_in = F_out│
    └──────┬──────┘
           │ Tension ligne
           ▼
    ┌─────────────┐
    │   LIGNE     │ (15m tendue)
    │ Tension = ? │
    └──────┬──────┘
           │ Traction transmise au handle
           ▼
    ┌─────────────┐
    │   HANDLE    │
    │ Le pilote   │
    │ SENT la     │
    │ traction !  │
    └─────────────┘
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

## 2. Géométrie du Système : Contraintes Multiples vs Approximation Sphérique

### 2.1 Modèle Exact : Système de Contraintes Géométriques

Le kite **N'ÉVOLUE PAS sur une sphère simple**. La vraie géométrie est un **système de 8 contraintes de distance rigides** qui doivent être satisfaites simultanément :

**Architecture du système de contraintes** :

```
        BARRE DE CONTRÔLE (pivot central fixe)
         /                           \
    Poignée_G                    Poignée_D
        |                               |
     (ligne L)                       (ligne L)
     15m tendue                      15m tendue
        |                               |
        ↕ Bidirectionnel                ↕ Bidirectionnel
        |                               |
    CTRL_Gauche ─────────────────── CTRL_Droit
        │                               │
        │ (bride_nez)                   │ (bride_nez)
        ├──────→ NEZ ←─────────────────┤
        │                               │
        │ (bride_inter)                 │ (bride_inter)
        ├──────→ INTER_GAUCHE           ├──────→ INTER_DROIT
        │                               │
        │ (bride_centre)                │ (bride_centre)
        └──────→ CENTRE ←───────────────┘
                    │
              KITE (structure rigide)
              Forces aérodynamiques
```

**Principe de bidirectionnalité** :
- Les **lignes** transmettent les forces dans les **deux sens** :
  - Pilote → Kite : déplacement des poignées → déplacement des CTRL → modification orientation kite
  - Kite → Pilote : forces aéro → tension brides → tension lignes → traction ressentie aux poignées
- Les **points CTRL** ont une **petite masse** (~0.01 kg) pour permettre cette transmission bidirectionnelle
- Le **pilote ressent physiquement** la traction du kite via les tensions dans les lignes

**Contraintes de distance (inextensibles)** :
1. `|CTRL_gauche - poignée_gauche| = L_ligne` (ligne gauche, ~15m)
2. `|CTRL_droit - poignée_droite| = L_ligne` (ligne droite, ~15m)
3. `|NEZ - CTRL_gauche| = L_bride_nez` (bride gauche nez, ~0.6m)
4. `|INTER_GAUCHE - CTRL_gauche| = L_bride_inter` (bride gauche inter, ~0.7m)
5. `|CENTRE - CTRL_gauche| = L_bride_centre` (bride gauche centre, ~0.8m)
6. `|NEZ - CTRL_droit| = L_bride_nez` (bride droite nez, ~0.6m)
7. `|INTER_DROIT - CTRL_droit| = L_bride_inter` (bride droite inter, ~0.7m)
8. `|CENTRE - CTRL_droit| = L_bride_centre` (bride droite centre, ~0.8m)

**Transmission des forces** :
- Chaque contrainte transmet les **tensions** dans les deux sens
- Forces aérodynamiques (kite) → tensions brides → tensions lignes → traction poignées (pilote)
- Déplacement poignées (pilote) → déplacement CTRL → modification orientation kite → nouvelles forces aéro

**Position du kite** = Solution du système non-linéaire de 8 équations, résolue itérativement par **Position-Based Dynamics (PBD)**.

**IMPORTANT** : Il n'y a PAS de formule analytique simple `R = L_lignes + L_brides` ! La position émerge de l'équilibre géométrique de toutes les contraintes.

### 2.2 Approximation : "Sphère de Vol" (Visualisation Simplifiée)

Pour la **visualisation et l'intuition**, on peut approximer la zone accessible par une sphère :

```
R_approx ≈ L_lignes + L_brides_moyennes
```

**Où** :
- `L_lignes` = longueur des lignes de contrôle (défaut : 15m)
- `L_brides_moyennes` = moyenne des longueurs des 3 brides (~0.6-0.8m)

**Centre de la sphère** : Position du pilote (barre de contrôle)

⚠️ **Cette formule est une APPROXIMATION grossière** ! La vraie position du kite dépend de :
- L'orientation du kite (angle avec le vent)
- L'équilibre des tensions dans les 8 contraintes
- La géométrie interne du delta (structure rigide)
- Les forces aérodynamiques appliquées

**Analogie physique** : Imaginez un mobile suspendu par plusieurs fils de longueur fixe attachés à différents points. Sa position ne se calcule PAS par simple addition des longueurs, mais par l'**équilibre géométrique tridimensionnel** de tous les fils tendus simultanément. C'est un système de **trilatération multiple** en 3D.


**Ne PAS utiliser pour** :
- Calculs de contraintes physiques (utiliser PBD)
- Positionnement exact du kite
- Calcul des tensions des lignes/brides

### 2.3 Comportement Physique : Phases de Vol

#### Phase 1 : Transport Initial par le Vent (Lignes Relâchées)

Au départ, avant que les lignes ne soient tendues :
- Les forces aérodynamiques (portance + traînée) agissent sur chaque surface du kite
- Le kite se déplace librement dans l'espace 3D
- Il s'éloigne progressivement du pilote selon la direction du vent
- Les lignes sont partiellement relâchées (facteur de tension < 1)

**État du système** : Contraintes inactives, mouvement libre sous forces aéro + gravité

#### Phase 2 : Atteinte de la Limite Géométrique

Le kite atteint les **limites physiques** imposées par le système de contraintes :

**Quand les lignes atteignent leur longueur maximale** :
- Les lignes deviennent **tendues** (distance = L_ligne exactement)
- Les 2 points CTRL sont contraints sur des sphères centrées sur les poignées
- Le kite ne peut plus s'éloigner radialement des poignées

**Simultanément, les brides imposent leurs contraintes** :
- Les 6 brides maintiennent les distances fixes entre CTRL et points d'attache du kite
- La structure du kite (rigide) maintient sa géométrie interne
- Les points CTRL et la structure du kite forment un système géométrique contraint

**État du système** : **8 contraintes actives simultanément** → mode "contrainte active"

#### Phase 3 : Vol Contraint (Régime Permanent)

Une fois toutes les contraintes actives :
- Le kite est **maintenu en permanence** dans la zone contrainte par la pression du vent
- Il **ne peut plus s'éloigner radialement** du pilote (ligne tendue)
- Il **ne peut plus changer sa forme interne** (structure rigide + brides tendues)
- Distance au pilote ≈ R_approx (avec variations selon orientation)

**Mouvement autorisé** : Déplacement **tangentiel** uniquement (glissement sur la surface contrainte)

**Analogie mécanique** : Le système se comporte comme un **pantographe 3D** ou un **bras robotique à longueurs fixes**, où chaque segment (ligne, bride) impose une contrainte de distance rigide. La position finale est l'unique solution géométrique satisfaisant toutes les contraintes simultanément.

### 2.4 Facteur de Tension

Le système calcule un **facteur de tension** pour diagnostiquer l'état des lignes :

```typescript
distance_actuelle = |position_kite - position_pilote|
R_approx = L_lignes + L_brides_moyennes
tensionFactor = min(distance_actuelle / R_approx, 1.0)
```

**Interprétation** :
- `tensionFactor ≈ 0` : Lignes complètement relâchées (phase 1)
- `0 < tensionFactor < 0.9` : État transitoire, lignes partiellement tendues
- `tensionFactor ≈ 1` : Lignes tendues, système contraint actif (phases 2-3)
- `tensionFactor > 1` : **ERREUR** - Violation de contrainte (bug numérique)

⚠️ **Note** : Ce facteur est une **approximation** basée sur la distance euclidienne. Les contraintes réelles (8 équations) sont vérifiées individuellement par le solveur PBD.

---

## 3. Déplacement Tangentiel dans l'Espace Contraint

### 3.1 Principe Fondamental

Incapable de s'éloigner radialement (lignes tendues), le kite se déplace **tangentiellement** dans l'espace contraint par les 8 contraintes géométriques.

**Ce n'est PAS un simple mouvement sur une sphère** ! C'est un mouvement dans un **espace contraint à 6 dimensions** :
- 3 dimensions pour la position du kite (x, y, z)
- 3 dimensions pour l'orientation du kite (pitch, roll, yaw)
- Moins 8 contraintes = espace à 6-8 = **système sous-contraint** avec degrés de liberté limités

**Analogie mécanique** : Imaginez un bras robotique à 3 articulations, chaque articulation ayant une longueur fixe. Le bout du bras peut se déplacer dans un espace limité (pas une sphère !), mais ne peut pas atteindre n'importe quelle position. C'est une **surface de contrainte complexe** en 3D.

**Simplification visuelle** : Pour l'intuition, on peut approximer ce mouvement comme un déplacement "tangentiel sur une pseudo-sphère", mais la vraie géométrie est plus complexe.

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

Le pilote contrôle le kite via la **rotation de la barre de contrôle** autour de son pivot central :

```typescript
barRotation ∈ [-π/3, +π/3]  // ±60° max
```

**Effet géométrique** :
- Rotation gauche (pilote tire poignée gauche) → Ligne gauche plus courte → CTRL_gauche se rapproche → côté gauche du kite tiré
- Rotation droite (pilote tire poignée droite) → Ligne droite plus courte → CTRL_droit se rapproche → côté droit du kite tiré

**Action bidirectionnelle** :
- **Pilote → Kite** : Déplacement des poignées → modification des positions CTRL → changement d'orientation du kite
- **Kite → Pilote** : Forces aéro asymétriques → tensions différentielles dans les brides → tensions différentielles dans les lignes → le pilote ressent la réaction du kite aux poignées

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

Le système utilise **Position-Based Dynamics (PBD)** pour garantir le respect des 8 contraintes géométriques simultanément.

**Pourquoi PBD et pas des forces ?**
- Les lignes et brides sont **inextensibles** (Dyneema : module de Young ~100 GPa)
- Traiter comme des ressorts (F = k·Δx) est **physiquement faux** et numériquement instable
- PBD résout directement les contraintes géométriques → stable, rapide, réaliste

**Bidirectionnalité des contraintes** :
- Chaque contrainte peut corriger **les deux extrémités** simultanément
- Les corrections sont réparties selon les **masses inverses** (1/m)
- Points CTRL : petite masse (~0.01 kg) → peuvent bouger sous l'effet des forces du kite
- Structure kite : masse plus grande (~0.31 kg) → bouge moins, mais transmet les forces
- Poignées : masse infinie (fixes) → ne bougent que si le pilote les déplace

**Contraintes du système** :
1. **Ligne gauche** : `|CTRL_GAUCHE - poignée_gauche| = L_ligne` (bidirectionnelle, poignée fixe)
2. **Ligne droite** : `|CTRL_DROIT - poignée_droite| = L_ligne` (bidirectionnelle, poignée fixe)
3. **Bride NEZ gauche** : `|NEZ - CTRL_GAUCHE| = L_bride_nez` (bidirectionnelle)
4. **Bride INTER gauche** : `|INTER_GAUCHE - CTRL_GAUCHE| = L_bride_inter` (bidirectionnelle)
5. **Bride CENTRE gauche** : `|CENTRE - CTRL_GAUCHE| = L_bride_centre` (bidirectionnelle)
6. **Bride NEZ droite** : `|NEZ - CTRL_DROIT| = L_bride_nez` (bidirectionnelle)
7. **Bride INTER droite** : `|INTER_DROIT - CTRL_DROIT| = L_bride_inter` (bidirectionnelle)
8. **Bride CENTRE droite** : `|CENTRE - CTRL_DROIT| = L_bride_centre` (bidirectionnelle)

**Transmission des tensions** :
- Forces aéro (kite) → tensions dans brides 3-8 → forces sur CTRL
- Forces sur CTRL → tensions dans lignes 1-2 → traction aux poignées (ressentie par le pilote)
- Le système est en **équilibre dynamique** : somme des forces = 0 à chaque nœud (CTRL, NEZ, INTER, CENTRE)

### 8.2 Résolution Itérative (Gauss-Seidel)

Le solveur PBD résout les contraintes par **itérations successives** (méthode Gauss-Seidel) :

```typescript
// Pour chaque frame physique :
for (let iteration = 0; iteration < N_iterations; iteration++) {
  
  // 1. Résoudre les contraintes de lignes
  enforceLineConstraint(CTRL_GAUCHE, poignée_gauche, L_ligne);
  enforceLineConstraint(CTRL_DROIT, poignée_droite, L_ligne);
  
  // 2. Résoudre les contraintes de brides (gauche)
  enforceBridleConstraint(NEZ, CTRL_GAUCHE, L_bride_nez);
  enforceBridleConstraint(INTER_GAUCHE, CTRL_GAUCHE, L_bride_inter);
  enforceBridleConstraint(CENTRE, CTRL_GAUCHE, L_bride_centre);
  
  // 3. Résoudre les contraintes de brides (droite)
  enforceBridleConstraint(NEZ, CTRL_DROIT, L_bride_nez);
  enforceBridleConstraint(INTER_DROIT, CTRL_DROIT, L_bride_inter);
  enforceBridleConstraint(CENTRE, CTRL_DROIT, L_bride_centre);
}
```

**Pour chaque contrainte individuelle** :

```typescript
function enforceConstraint(point_A, point_B, distance_cible) {
  // Calcul de la violation
  diff = point_B - point_A;
  distance_actuelle = |diff|;
  C = distance_actuelle - distance_cible;  // Erreur
  
  // Direction de correction
  n = normalize(diff);
  
  // Calcul du multiplicateur de Lagrange λ (pondération des corrections)
  // Prend en compte masses et moments d'inertie pour répartir les corrections
  denominator = (1/masse_A) + (1/masse_B) + (bras_levier²/inertie);
  λ = C / denominator;
  
  // Corrections de position (répartie selon masses inverses)
  // BIDIRECTIONNEL : les deux points peuvent bouger !
  delta_position_A = -n × (λ / masse_A);  // Point A corrigé selon sa masse
  delta_position_B = +n × (λ / masse_B);  // Point B corrigé selon sa masse
  
  // Si masse_A >> masse_B : Point B bouge beaucoup, Point A peu
  // Si masse_A ≈ masse_B : Les deux bougent de façon équilibrée
  // Si masse_A → ∞ (fixe) : Seul Point B bouge
  
  // Corrections d'orientation (si corps rigide)
  delta_rotation = (bras_levier × n) × (λ / inertie);
}
```

**Exemple concret : Contrainte ligne gauche**
- Point A = poignée_gauche (masse → ∞, fixe)
- Point B = CTRL_gauche (masse = 0.01 kg)
- Si kite tire → CTRL veut s'éloigner → contrainte violée → correction appliquée uniquement sur CTRL (car poignée fixe)
- Si pilote tire poignée → poignée se rapproche → CTRL doit suivre → correction appliquée sur CTRL

**Convergence** : 
- Nombre d'itérations typique : **3-10** par frame (défaut : 3)
- Tolérance : **< 1mm** d'erreur résiduelle
- Plus d'itérations → plus précis, mais plus coûteux en calcul

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
✅ **Déplacement contraint** : Le kite se déplace dans l'espace défini par les 8 contraintes géométriques
✅ **Twist géométrique** : Asymétrie lignes → inclinaison bord d'attaque
✅ **Contraintes rigides** : Toutes les distances (lignes + brides) respectées à ±1mm près

### 13.2 Métriques de Validation

```typescript
// 1. Respect des contraintes de lignes (CRITIQUE)
assert(||CTRL_gauche - poignée_gauche| - L_ligne| < 0.001m)
assert(||CTRL_droit - poignée_droite| - L_ligne| < 0.001m)

// 2. Respect des contraintes de brides (CRITIQUE)
assert(||NEZ - CTRL_gauche| - L_bride_nez| < 0.001m)
assert(||INTER_GAUCHE - CTRL_gauche| - L_bride_inter| < 0.001m)
assert(||CENTRE - CTRL_gauche| - L_bride_centre| < 0.001m)
// (idem pour brides droites)

// 3. Distance approximative au pilote (validation grossière)
assert(|position_kite - position_pilote| ≈ R_approx ± 0.5m)

// 4. Équilibre zénith (position neutre, après stabilisation)
assert(position_kite.y ≈ R_approx ± 1m)

// 5. Symétrie forces (barre neutre)
assert(|F_gauche - F_droite| < 5% × F_totale)

// 6. Asymétrie forces (barre tournée)
assert(|F_gauche - F_droite| > 10% × F_totale)

// 7. Pression réduite au zénith
assert(F_aéro_zénith < F_aéro_équateur / 2)
```

---

## 14. Références Théoriques

### 14.1 Mécanique des Fluides

- Hoerner, S.F. (1965). *Fluid-Dynamic Drag*. Coefficients plaque plane
- Anderson, J.D. (2017). *Fundamentals of Aerodynamics*. Calculs portance/traînée

### 14.2 Dynamique du Corps Rigide

- Witkin, A. & Baraff, D. (2001). *Physically Based Modeling*. Contraintes et PBD
- Müller, M. et al. (2007). *Position Based Dynamics*. Algorithme PBD itératif
- Goldstein, H. (2002). *Classical Mechanics*. Équations d'Euler pour corps rigide

### 14.3 Simulation de Kites

- Williams, P. et al. (2008). *Dynamics of Flexible Kites*. Modèles physiques
- Fagiano, L. & Milanese, M. (2012). *Airborne Wind Energy*. Aérodynamique kites
- Loyd, M.L. (1980). *Crosswind Kite Power*. Principe de génération d'énergie

---

## Résumé Exécutif

Le simulateur implémente un modèle physique **complet et émergent** basé sur :

1. **Système de 8 contraintes géométriques rigides** :
   - 2 lignes (poignées → CTRL)
   - 6 brides (CTRL → structure kite)
   - Position du kite = solution géométrique unique satisfaisant toutes les contraintes

2. **Forces aérodynamiques distribuées** : 
   - Calcul par surface avec coefficients réalistes
   - Portance et traînée fonction de l'angle d'attaque
   - Application au centre de chaque surface → couples émergents

3. **Position-Based Dynamics (PBD)** :
   - Résolution itérative des contraintes (pas de forces fictives)
   - Lignes et brides = contraintes rigides, pas ressorts
   - Convergence garantie en 3-10 itérations

4. **Mouvement dans l'espace contraint** :
   - Déplacement tangentiel dans l'espace à 6 DDL contraint
   - Approximation visuelle : "glissement sur pseudo-sphère"
   - Composante radiale annulée par les contraintes

5. **Équilibre zénith** : 
   - Position stable naturelle (surfaces horizontales → pression réduite)
   - Point d'équilibre émergent, pas scripté

6. **Direction émergente** : 
   - Asymétrie géométrique (lignes) → twist (inclinaison)
   - Asymétrie aérodynamique → couple de lacet
   - Comportement de pilotage naturel

**Aucun comportement n'est scripté** : Tout émerge des lois physiques fondamentales :
- Mécanique newtonienne (F=ma, τ=Iα)
- Aérodynamique (coefficients CL/CD fonction angle d'attaque)
- Contraintes géométriques (PBD, distances rigides)

**Architecture** : ECS pure, séparation données/logique, systèmes indépendants communiquant via composants.

---

**Auteur** : Système de simulation Kite v5  
**Date** : 2025-10-16  
**Version** : 2.0 (Architecture PBD avec 8 contraintes géométriques)
