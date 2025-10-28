# 📚 Modèle Physique Complet NASA pour Cerfs-Volants

**Source:** NASA Glenn Research Center - Beginner's Guide to Aeronautics  
**Index principal:** https://www.grc.nasa.gov/www/k-12/airplane/shortk.html  
**Date de compilation:** 28 octobre 2025  
**Projet:** kite_v5 - Simulateur de cerf-volant  
**Pages référencées:** 15+ pages couvrant tous les aspects de la physique des cerfs-volants

---

## 🎯 Vue d'ensemble

Ce document compile toutes les équations et principes NASA pour la simulation complète d'un cerf-volant. Il sert de référence technique pour l'implémentation dans `src/ecs/systems/`.

---

## 1. 📐 GÉOMÉTRIE DU CERF-VOLANT

### Définitions de base
```
Surface projetée (A) : Aire frontale vue de face (utilisée pour CL et CD)
Envergure (s) : Distance d'un bout d'aile à l'autre
Hauteur (H) : Dimension verticale du kite
Aspect Ratio (AR) : AR = s² / A
```

### Aspect Ratio
- **Kites typiques:** AR faible (1-3)
- **Avions:** AR élevé (7+)
- **Impact:** Faible AR = plus de traînée induite (effet downwash important)

### Aire projetée vs géométrique
```
Si panneau incliné à 45°:
A_projected = A_geometric × cos(45°) = 0.707 × A_geometric
```

---

## 2. 🌪️ COEFFICIENTS AÉRODYNAMIQUES

### Portance (Lift Coefficient)
```typescript
// Théorie plaque plane (petits angles)
CL₀ = 2π × α  (α en radians)

// Correction pour faible aspect ratio (effet downwash)
CL = CL₀ / (1 + CL₀ / (π × AR))
```

**Limites de validité:**
- Angles d'attaque < 30° (0.52 rad)
- CL typique : -2.0 à +2.0
- Au-delà : décrochage (stall)

### Traînée (Drag Coefficient)
```typescript
// Traînée de forme (plaque plane)
CD₀ = 1.28 × sin(α)

// Traînée induite (due à la portance)
CD_induced = CL² / (0.7 × π × AR)

// Traînée totale
CD = CD₀ + CD_induced
```

**Note:** 0.7 est le facteur d'efficacité pour aile rectangulaire (Oswald efficiency)

### Forces aérodynamiques
```typescript
// Pression dynamique
q = 0.5 × ρ × V²

// Forces
Lift = CL × q × A
Drag = CD × q × A
```

**Densité air standard (niveau mer, 15°C):**
- ρ = 1.225 kg/m³ (ou 0.00237 slug/ft³)

### Pression dynamique (q)
La pression dynamique est la **composante cinétique** de la pression fluide :

```typescript
q = 0.5 × ρ × V²

Unités:
  ρ en kg/m³ ou slug/ft³
  V en m/s ou ft/s
  q en Pa (N/m²) ou lbf/ft²
```

**Propriétés importantes :**
- Proportionnelle au **carré de la vitesse** → doubler vitesse = 4× les forces !
- Varie avec **altitude** (densité air diminue avec altitude)
- Varie avec **température** (air chaud moins dense)

**Exemples :**
```
Vent 5 m/s  : q = 0.5 × 1.225 × 5²  = 15.3 Pa
Vent 10 m/s : q = 0.5 × 1.225 × 10² = 61.3 Pa (4× plus)
Vent 20 m/s : q = 0.5 × 1.225 × 20² = 245 Pa  (16× plus)
```

### Dépendance altitude
La densité de l'air décroît avec l'altitude selon le **modèle atmosphérique standard** :

```
Niveau mer (0 m)     : ρ = 1.225 kg/m³
Montagne (1000 m)    : ρ ≈ 1.112 kg/m³ (-9%)
Haute altitude (3000m): ρ ≈ 0.909 kg/m³ (-26%)
```

**Conséquence :** Un kite vole moins bien en altitude car lift/drag ∝ ρ.

---

## 2B. 📐 DÉTAILS ANGLE D'ATTAQUE ET COEFFICIENTS

### Angle d'attaque (α) - Définition précise

**Pour plaque plane (kite) :**
```
α = angle entre la surface du kite et la direction du vent

Conventions:
  α = 0° → surface parallèle au vent (pas de lift)
  α > 0° → surface "attaque" le vent (crée lift)
  α typique vol stable: 5-20°
  α > 30° → risque décrochage (stall)
```

**Effet sur forces :**
```typescript
Petit α (< 15°):
  CL ≈ linéaire avec α
  CD ≈ faible (principalement forme)

Moyen α (15-30°):
  CL augmente mais saturation
  CD augmente (forme + induite)

Grand α (> 30°):
  CL plafonne puis diminue (stall)
  CD explose (séparation flux)
```

### Dérivation complète CL

**Étape 1 - Plaque plane infinie (théorie potentielle) :**
```
CL₀ = 2π × α  (α en radians)
```

**Étape 2 - Correction aspect ratio fini (downwash) :**

Le downwash aux extrémités réduit l'angle d'attaque effectif :
```
α_eff = α - α_induced
α_induced ≈ CL / (π × AR)

Donc:
CL = 2π × (α - CL/(π×AR))
CL × (1 + 2π/(π×AR)) = 2π × α
CL = 2π × α / (1 + 2/(AR))

Forme équivalente:
CL = CL₀ / (1 + CL₀/(π×AR))
```

**Graphique CL vs α pour différents AR :**
```
CL
 |
2|              AR = 7 (avion)
 |            /
1|          /  AR = 3 (kite)
 |        /  /
0|______/__/__________ α (degrés)
 0      15  30
```

Kites (AR faible) → moins de lift que prédit par théorie infinie.

### Dérivation complète CD

**Composante 1 - Traînée de forme (pressure drag) :**
```
CD₀ = 1.28 × sin(α)

Origine: Mesures expérimentales plaques planes perpendiculaires
```

**Composante 2 - Traînée induite (induced drag) :**

La création de lift génère des tourbillons d'extrémité → traînée induite :
```
CD_induced = CL² / (e × π × AR)

où e = facteur efficacité Oswald
  e = 1.0 pour aile elliptique idéale
  e = 0.7 pour aile rectangulaire (kites)
```

**Traînée totale :**
```typescript
CD = CD₀ + CD_induced
CD = 1.28 × sin(α) + CL² / (0.7 × π × AR)
```

**Exemple numérique :**
```
Kite: AR = 2, α = 15° = 0.262 rad

CL₀ = 2π × 0.262 = 1.646
CL = 1.646 / (1 + 1.646/(π×2)) = 1.095

CD₀ = 1.28 × sin(15°) = 1.28 × 0.259 = 0.331
CD_i = 1.095² / (0.7 × π × 2) = 0.273
CD = 0.331 + 0.273 = 0.604

Lift/Drag ratio = CL/CD = 1.095/0.604 = 1.81
```

---

## 3. 🎯 CENTRE DE PRESSION (CP)

### Définition
Le centre de pression est le point d'application moyen des forces aérodynamiques.

### Centre aérodynamique vs Centre de pression

**Distinction importante :**
```
CENTRE AÉRODYNAMIQUE (AC):
- Point où le moment aéro est CONSTANT avec α
- Pour plaque plane symétrique: AC = 0.25 × chord
- Position fixe (ne bouge pas avec α)

CENTRE DE PRESSION (CP):
- Point où moment aéro = 0
- Position VARIE avec angle d'attaque
- CP utilisé pour calculs équilibre/stabilité
```

**Pour kites (plaques planes) :**
```
CP ≈ AC = 0.25 × chord depuis bord d'attaque
(simplification valide pour petits α)
```

### Calcul pour plaque plane
```
Pour chaque surface i:
  CP_i = 0.25 × chord_i (à 1/4 de la corde depuis le bord d'attaque)

CP global = Σ(A_i × CP_i) / Σ(A_i)
```

**Moyenne pondérée par aire :**
Surfaces plus grandes contribuent plus au CP global.

**Pour cerf-volant composite:**
```
A_total × CP = Σ(A_i × d_i)
où d_i = distance du CP_i depuis référence (base du kite)
```

### Exemple Box Kite
```
Composants:
  - Upper surface (U): A_U = 0.2 m², d_U = 0.8 m
  - Lower surface (L): A_L = 0.2 m², d_L = 0.4 m  
  - Wings (W):         A_W = 0.1 m², d_W = 0.6 m

CP_global = (0.2×0.8 + 0.2×0.4 + 0.1×0.6) / (0.2+0.2+0.1)
          = (0.16 + 0.08 + 0.06) / 0.5
          = 0.30 / 0.5 = 0.6 m depuis base
```

---

## 3B. 🎚️ TRIMMING (Réglage équilibre)

### Principe fondamental

**Le kite pivote autour du BRIDLE POINT, pas du CG !**

En vol stable (trim), le couple net autour du bridle point = 0.

### Système de coordonnées
```
Référence: Base du kite (bottom)
Axe Y: Le long de la hauteur du kite
Axe X: Perpendiculaire (horizontal si kite vertical)
```

### Équation couple complète (rappel)
```typescript
T = - L × cos(α) × (Yb - CP)  // Moment portance (perpendiculaire)
    - L × sin(α) × Xb          // Moment portance (parallèle)
    - D × sin(α) × (Yb - CP)  // Moment traînée (perpendiculaire)
    + D × cos(α) × Xb          // Moment traînée (parallèle)
    + W × cos(α) × (Yb - CG)  // Moment poids (perpendiculaire)
    + W × sin(α) × Xb          // Moment poids (parallèle)

Où:
  Xb, Yb = coordonnées bridle point
  CP = position centre de pression
  CG = position centre de gravité
  α = angle d'inclinaison du kite
```

### Condition de trim
```
T(α_trim) = 0

Le kite trouve naturellement α_trim où couples s'équilibrent.
```

### Importance position bridle point

**Effet sur performance :**
```
Bridle point HAUT (vers haut du kite):
  → α_trim plus grand
  → Plus de lift mais plus de drag
  → Kite tire fort, vole à angle abrupt

Bridle point BAS:
  → α_trim plus petit
  → Moins de lift
  → Kite vole plus "plat"

Bridle point MAL PLACÉ:
  → Pas d'équilibre possible
  → Kite instable (tourne sans arrêt)
```

**Réglage pratique (knot position K) :**

Déplacer le nœud le long de la bride change Xb et Yb :
```
K plus grand → bridle point plus haut → α_trim augmente
K plus petit → bridle point plus bas → α_trim diminue
```

### Stabilité du trim

**Stable :**
```
dT/dα < 0 au point d'équilibre

Si α augmente légèrement:
  → T devient négatif (contre-horaire)
  → Ramène kite vers α_trim
```

**Instable :**
```
dT/dα > 0 au point d'équilibre

Si α augmente légèrement:
  → T devient positif (horaire)
  → Éloigne encore plus de α_trim
  → Kite diverge !
```

**Vérification KiteModeler :**
- Programme calcule T pour différents α
- Affiche "UNSTABLE" si pas de point d'équilibre stable
- Utilisateur doit ajuster B, K, ou T (tail) jusqu'à stable

---

## 4. ⚖️ CENTRE DE GRAVITÉ (CG)
où d_i = distance du CP de chaque surface depuis référence
```

---

## 4. ⚖️ CENTRE DE GRAVITÉ (CG)

### Définition
Point d'application moyen du poids. Calculé en pondérant par la masse.

```
CG = Σ(m_i × position_i) / Σ(m_i)
```

### Importance
- Avion : rotation autour du CG
- **Cerf-volant : rotation autour du BRIDLE POINT (pas du CG !)**

---

## 4B. 🌀 DOWNWASH (Effet aspect ratio faible)

### Phénomène physique

Aux **extrémités d'une aile** (ou kite), l'air s'écoule de la zone haute pression (dessous) vers la zone basse pression (dessus), créant des **tourbillons marginaux (wingtip vortices)**.

```
Vue de dessus du kite:
                    ↓↓↓ Downwash
    ╔═══════════════════════════╗
    ║    Zone basse pression    ║ (dessus)
    ║                           ║
    ╚═══════════════════════════╝
    ↗                           ↖ Tourbillons
    Zone haute pression (dessous)
```

Ces tourbillons créent un **flux descendant (downwash)** qui modifie localement l'angle d'attaque effectif.

### Impact sur angle d'attaque

```typescript
α_effective = α_geometric - α_induced

où:
  α_induced ≈ CL / (π × AR)  // Angle induit par downwash
```

**Plus AR est faible → plus downwash est important !**

```
High AR (avion, AR=7):
  Extrémités petites vs surface totale
  → Downwash limité aux bouts
  → ~70% surface non affectée

Low AR (kite, AR=2):
  Extrémités grandes vs surface totale
  → Downwash affecte TOUTE la surface
  → Perte significative de lift
```

### Effet sur CL (correction downwash)

**Sans correction (théorie 2D infinie) :**
```
CL₀ = 2π × α
```

**Avec correction aspect ratio fini (théorie 3D) :**
```typescript
// Méthode 1 (itérative)
α_eff = α - CL/(π×AR)
CL = 2π × α_eff = 2π × (α - CL/(π×AR))
→ CL × (1 + 2π/(π×AR)) = 2π × α
→ CL = 2π × α / (1 + 2/AR)

// Méthode 2 (directe avec CL₀)
CL = CL₀ / (1 + CL₀/(π×AR))
```

**Courbes comparatives :**
```
CL
 │
2.5│                    AR = ∞ (théorie 2D)
   │                  /
2.0│                /  AR = 7 (avion)
   │              /  /
1.5│            /  /   AR = 3 (bon kite)
   │          /  /  /
1.0│        /  /  /    AR = 1 (box kite)
   │      /  /  /  /
0.5│    /  /  /  /
   │  /  /  /  /
0.0└──────────────────── α (degrés)
   0   5  10  15  20
```

**Perte de lift typique :**
```
AR = 1  : CL ≈ 0.5 × CL₀  (50% perte !)
AR = 2  : CL ≈ 0.67 × CL₀ (33% perte)
AR = 4  : CL ≈ 0.80 × CL₀ (20% perte)
AR = 7  : CL ≈ 0.88 × CL₀ (12% perte)
```

### Effet sur CD (traînée induite)

Le downwash crée aussi une **traînée supplémentaire** appelée **traînée induite** :

```typescript
CD_induced = CL² / (e × π × AR)

où e = efficacité Oswald:
  e = 1.0  pour aile elliptique parfaite
  e = 0.7  pour aile rectangulaire (kites)
  e = 0.6-0.8 pour formes intermédiaires
```

**Pourquoi CL² ?**
- Plus de lift → tourbillons plus forts
- Tourbillons plus forts → downwash plus important
- Downwash plus important → plus de traînée induite
- Relation quadratique !

**Ratio traînée induite vs totale :**
```
Exemple: AR=2, α=15°, CL=1.1, CD₀=0.33

CD_i = 1.1² / (0.7×π×2) = 0.27
CD_total = 0.33 + 0.27 = 0.60

CD_i représente 45% de la traînée totale !
```

### Visualisation impact downwash

```
Graphique CD vs CL pour différents AR:

CD
 │
2.0│              AR = 1 (forte traînée induite)
   │            /
1.5│          /   AR = 2
   │        /   /
1.0│      /   /    AR = 4
   │    /   /   /
0.5│  /   /   /     AR = 7 (faible traînée induite)
   │/   /   /   /
0.0└─────────────── CL
   0  0.5  1.0  1.5  2.0

"Polar drag curve" - Plus plat = plus efficace
```

### Implications design kites

**Kites traditionnels (diamond, delta) :**
- AR faible (1-3)
- Forte traînée induite
- Mais **stable** et **robuste**
- Bon pour débutants

**Kites performance (sparless, foil) :**
- AR moyen-élevé (3-6)
- Traînée réduite
- Plus **rapide**, vole plus **haut**
- Plus délicat à piloter

**Trade-off fondamental :**
```
↑ AR → ↑ Lift/Drag → ↑ Performance
     → ↑ Structure longue → ↑ Fragilité
     → ↓ Stabilité naturelle
```

---

## 5. 🎪 GÉOMÉTRIE DE LA BRIDE (Bridle)

### Définitions
```
B = longueur totale de la bride (du bas au haut du kite)
K = distance du bas au nœud (knot) le long de la bride
H = hauteur du kite
A = angle du nœud par rapport à la verticale
```

### Position du Bridle Point
```typescript
// Coordonnées du bridle point
Yb = K × cos(A)
Xb = K × sin(A)

// Calcul de l'angle A
cos(A) = [K² + H² - (B - K)²] / (2 × K × H)
```

**Dérivation complète disponible:** https://www.grc.nasa.gov/www/k-12/airplane/kitebrid.html

---

## 6. 🔄 ÉQUATION DE COUPLE (Torque)

### Principe fondamental
**Un cerf-volant tourne autour du bridle point, pas du CG !**

### Équation complète du couple
```typescript
T = - L × cos(α) × (Yb - CP) 
    - L × sin(α) × Xb
    - D × sin(α) × (Yb - CP) 
    + D × cos(α) × Xb
    + W × cos(α) × (Yb - CG) 
    + W × sin(α) × Xb
```

Où:
- `T` : Couple net (+ = sens horaire)
- `L` : Portance (Lift)
- `D` : Traînée (Drag)
- `W` : Poids (Weight)
- `α` : Angle d'attaque
- `Yb, Xb` : Position bridle point
- `CP` : Position centre de pression
- `CG` : Position centre de gravité

### Simplification en équilibre
```
En vol stable (trim):
T = 0  (pas de rotation)

Approximation si α petit:
W × (Yb - CG) ≈ F_aero × (Yb - CP)
```

---

## 7. 🎚️ STABILITÉ

### Conditions de stabilité

**1. Balance (Equilibrium):**
```
T(α_trim) = 0
Le couple est nul à un certain angle d'attaque
```

**2. Stabilité:**
```
dT/dα < 0  au point d'équilibre

Si α augmente légèrement → T devient négatif → ramène vers équilibre
Si α diminue légèrement → T devient positif → ramène vers équilibre
```

### Graphique Couple vs Angle d'attaque

```
      T (torque)
        |
    +   |     Unstable
        |    /
        |   /
        |  /
    ────┼─────────── α
       /|  α_trim
      / |
     /  |
  Stable|
        | -
```

**Design stable:** La courbe doit:
1. Croiser l'axe α (balance)
2. Avoir une pente négative au croisement (stabilité)

---

## 8. 📏 LIGNE DE CONTRÔLE

### Équation de la caténaire
La ligne forme une courbe sous son propre poids (pas une ligne droite).

```
Poids de la ligne: g = s × p
où:
  s = longueur de ligne
  p = poids par unité de longueur (oz/ft ou g/m)
```

### Tension dans la ligne
```
Tension = √(L² + D² + W²)
(combinaison vectorielle des forces sur le kite)
```

### Affaissement (Sag)
Équations complexes résolues numériquement par KiteModeler.
- Plus la ligne est longue → plus l'affaissement est important
- Le kite ne vole PAS à l'altitude = longueur de ligne

---

## 9. 🎯 ANGLE D'ATTAQUE EFFECTIF

### Définition
```
α = angle entre la normale de la surface et le vent apparent
```

### Vent apparent
```typescript
V_apparent = V_wind - V_kite

Où:
  V_wind = vent ambiant
  V_kite = vitesse du kite (translation + rotation)
```

### Effet de la rotation
```typescript
Pour un point P sur le kite:
V_P = V_translation + ω × r

Où:
  ω = vitesse angulaire
  r = bras de levier depuis CG (ou bridle point)
```

---

## 10. 🔢 IMPLÉMENTATION - RÉSUMÉ

### Architecture ECS actuelle

✅ **Déjà implémenté:**
1. Coefficients CL et CD NASA avec correction AR
2. Pression dynamique q = 0.5 × ρ × V²
3. Forces distribuées par face triangulaire
4. Couples générés automatiquement (leverArm × force)
5. Gravité distribuée proportionnellement à l'aire
6. Contraintes PBD pour les lignes (géométriques strictes)

⚠️ **Manquant (mais pas critique):**
1. Calcul explicite du CP global
2. Calcul du couple net autour du bridle point
3. Vérification automatique de stabilité (dT/dα)
4. Équation de caténaire pour la ligne

### Ordre d'exécution des systèmes
```
1. WindSystem (calcul vent apparent)
2. AeroSystem (forces aéro avec NASA model)
3. PhysicsSystem (intégration Euler)
4. ConstraintSystem (PBD pour lignes)
```

---

## 11. 🛡️ GARDES DE SÉCURITÉ NUMÉRIQUES

### Limites implémentées
```typescript
// Angle d'attaque
α_max = 30° (0.52 rad)  // NASA assume petits angles

// Coefficients
CL ∈ [-2.0, +2.0]
CD ∈ [0.1, 3.0]
AR ≥ 0.5

// Vitesses
V_wind_apparent ≤ 100 m/s (360 km/h)
V_kite > 1000 m/s → reset automatique (divergence détectée)

// Forces
isFinite(force) = true (pas NaN/Infinity)
```

### Raison
Le modèle linéaire CL = 2π×α diverge à grands angles. Les clamps maintiennent la stabilité numérique tout en restant physiquement réalistes.

---

## 12. 📚 RÉFÉRENCES NASA

### Pages principales
1. **Aérodynamique:** https://www.grc.nasa.gov/www/k-12/airplane/kiteaero.html
2. **Portance:** https://www.grc.nasa.gov/www/k-12/airplane/kitelift.html
3. **Traînée:** https://www.grc.nasa.gov/www/k-12/airplane/kitedrag.html
4. **Downwash:** https://www.grc.nasa.gov/www/k-12/airplane/kitedown.html
5. **Inclinaison:** https://www.grc.nasa.gov/www/k-12/airplane/kiteincl.html
6. **Centre de Pression:** https://www.grc.nasa.gov/www/k-12/airplane/kitecp.html
7. **Couple:** https://www.grc.nasa.gov/www/k-12/airplane/kitetor.html
8. **Stabilité:** https://www.grc.nasa.gov/www/k-12/airplane/kitestab.html
9. **Bridle:** https://www.grc.nasa.gov/www/k-12/airplane/kitebrid.html
10. **Géométrie:** https://www.grc.nasa.gov/www/k-12/airplane/kitegeom.html

### Simulateur interactif
**KiteModeler:** https://www.grc.nasa.gov/www/k-12/airplane/kiteprog.html

---

## 13. 💡 NOTES D'IMPLÉMENTATION

### Différence clé : Avion vs Cerf-volant
```
AVION:
- Libre dans l'espace
- Rotation autour du CG
- Contrôle actif (gouvernes)

CERF-VOLANT:
- Contraint par la ligne
- Rotation autour du BRIDLE POINT
- Contrôle passif (équilibre de couples)
```

### Pourquoi PBD pour les lignes ?
Les lignes de cerf-volant ne s'étirent pratiquement pas (Kevlar, Dyneema).  
→ Contrainte géométrique stricte (longueur fixe)  
→ PBD (Position-Based Dynamics) est le modèle approprié  
→ Pas de ressort (stiffness = 0)

### Application des forces par face
Pour un kite avec 4 faces triangulaires:
```
Pour chaque face:
  1. Calculer α local (normale · vent)
  2. Calculer CL, CD avec formules NASA
  3. Appliquer forces au centroïde de la face
  4. Le couple résulte automatiquement de leverArm × force
```

Cette approche distribue correctement les forces et génère les moments réalistes sans calcul explicite du CP global.

---

## 14. 🎓 FORMULES RAPIDES

### Résumé une page
```typescript
// AÉRODYNAMIQUE (NASA)
CL = (2π × α) / (1 + 2π × α / (π × AR))  // α < 30°, en radians
CD = 1.28 × sin(α) + CL² / (0.7 × π × AR)
Lift = CL × (0.5 × ρ × V² × A)
Drag = CD × (0.5 × ρ × V² × A)

// GÉOMÉTRIE
AR = span² / area
CP = Σ(A_i × d_i) / Σ(A_i)  // Moyenne pondérée par aire

// BRIDLE
cos(A) = [K² + H² - (B-K)²] / (2 × K × H)
Xb = K × sin(A)
Yb = K × cos(A)

// COUPLE (autour bridle point)
T = -L×cos(α)×(Yb-CP) - L×sin(α)×Xb - D×sin(α)×(Yb-CP) 
    + D×cos(α)×Xb + W×cos(α)×(Yb-CG) + W×sin(α)×Xb

// STABILITÉ
Stable si: T(α_trim) = 0  ET  dT/dα < 0
```

---

## 15. 📐 ÉQUATION COMPLÈTE DE LA CATÉNAIRE (Ligne avec affaissement)

### Équation différentielle de la ligne
La forme de la ligne sous son propre poids est une **caténaire** :

```typescript
Y = C2 + (D/p) × cosh[(p/D) × X + C1]

où:
  Y, X = coordonnées de la ligne
  D = traînée du kite
  p = poids par unité de longueur de ligne
  cosh = cosinus hyperbolique
  C1, C2 = constantes d'intégration
```

### Conditions aux limites
```typescript
// À l'origine (main du pilote)
X = 0, Y = 0
dY/dX = (L - g - W) / D

// Au kite
X = XK
dY/dX = (L - W) / D

// Longueur totale de ligne
s = longueur de ligne déployée
g = s × p (poids total ligne)
```

### Résolution des constantes
```typescript
C1 = sinh⁻¹[(L - g - W) / D]
C2 = -(D/p) × cosh(C1)

// Distance horizontale du kite
XK = (D/p) × [sinh⁻¹((L-W)/D) - sinh⁻¹((L-W-s×p)/D)]

// Altitude du kite
YK = C2 + (D/p) × cosh[(p/D) × XK + C1]
```

**Note importante :** La ligne n'est **pas droite** ! L'affaissement peut être significatif pour des lignes longues et lourdes.

---

## 16. 📊 MESURE D'ALTITUDE (Méthodes pratiques)

### Méthode trigonométrique (avec 2 observateurs)

#### Configuration
```
Pilote ←────── L (distance référence) ──────→ Observateur
   ↖ α (angle vertical)                   ↗ d (angle vertical)
     ↖ b (angle horizontal)          c ↗ (angle horizontal)
         ↖                       ↗
              ↖           ↗
                   KITE (altitude h)
```

#### Formule complète (4 angles mesurés)
```typescript
h = (L × tan(a) × tan(d)) / (cos(b) × tan(d) + cos(c) × tan(a))
```

#### Formule simplifiée (3 angles, éliminant a)
```typescript
h = (L × tan(b) × tan(d)) / (cos(c) × (tan(c) + tan(b)))

// Équivalent avec formule double-angle
h = (L × tan(d) × sin(b)) / sin(b + c)
```

#### Formule simplifiée (3 angles, éliminant d)
```typescript
h = (L × tan(a) × sin(c)) / sin(b + c)
```

**Avantage :** Mesurer les 4 angles permet 3 calculs indépendants → moyenne pour réduire erreurs.

### Méthode graphique (sans trigonométrie)

1. **Sur papier millimétré :** Tracer ligne référence L à l'échelle (ex: 1 inch = 10 feet)
2. Tracer lignes aux angles b et c → intersection = position au sol sous le kite
3. Mesurer distance w (du pilote) ou x (de l'observateur) sur le dessin
4. **Sur nouveau papier :** Tracer ligne w, ligne verticale, ligne à l'angle a → intersection
5. Mesurer hauteur h verticale, convertir avec échelle

**Accessible pour lycée/collège !**

---

## 17. 🧱 COMPOSANTS D'UN CERF-VOLANT

### Structure (Frame)
- **Matériaux :** Bois léger (balsa, bambou) ou tubes plastique
- **Rôle :** Transmettre forces aérodynamiques vers la bride
- **Compromis :** Assez rigide pour résister au vent, assez léger pour voler
- **Exemple Box Kite :** 4 "legs" verticaux + 2-4 "cross" horizontaux

### Surface (Covering)
- **Matériaux :** Papier, plastique, tissu
- **Rôle :** Dévier le vent → créer portance et traînée
- **Propriétés :** Légère, résistante au déchirement, imperméable

### Bride (Bridle)
- **Rôle :** Connecter structure au point d'attache de la ligne de contrôle
- **Réglage :** Position du nœud (bridle point) change angle d'attaque et stabilité
- **Critique :** Le kite pivote autour du bridle point, pas du CG !

### Queue (Tail)
- **Rôle :** Ajouter traînée + déplacer CG vers l'arrière
- **Effet :** Améliore stabilité (empêche rotations rapides)
- **Longueur :** Paramètre ajustable selon conditions de vent

### Ligne de contrôle (Control Line)
- **Fonction :** Transmettre tension du kite au pilote
- **Propriétés :** Résistance traction, poids, flexibilité
- **Comportement :** Forme caténaire sous son propre poids

---

## 18. 🚁 LANCEMENT ET VOL (Dynamique)

### Phase de lancement
```typescript
// Condition de décollage
Lift > Weight

// Créer vitesse relative air-kite:
Méthode 1: Vent naturel + petite traction ligne
Méthode 2: Reculer ou courir face au vent
Méthode 3: Faire courir un assistant avec le kite
```

**Couche limite atmosphérique :**
- Au sol : Vent faible et turbulent
- En altitude : Vent plus fort et régulier
- Conséquence : Kite monte naturellement après lancement

### Phase de croisière (stable)
```typescript
// Équilibre des forces
Pv + W = L  (vertical)
Ph = D       (horizontal)

// Équilibre des couples
T = 0  (autour bridle point)
```

Le kite trouve automatiquement son altitude et angle d'équilibre.

### Réponse aux changements

**Rafale de vent (augmentation V) :**
1. L et D augmentent (proportionnel à V²)
2. Kite monte (L > W + Pv temporairement)
3. Tension ligne augmente
4. Nouvel équilibre à altitude supérieure

**Tirer sur la ligne :**
- Augmente légèrement vitesse relative → augmente lift
- Kite monte
- Efficace si vent plus fort en altitude

**Lâcher de la ligne :**
- Diminue tension → léger affaissement
- Poids ligne additionnel → kite descend légèrement
- Nouvel équilibre à altitude inférieure

---

## 19. ⚖️ LOIS DE NEWTON APPLIQUÉES AU KITE

### Première loi (Inertie)
```
Si forces nettes = 0 → vitesse constante (y compris vitesse = 0)
```

**En vol stable :**
- Forces balancées → kite immobile (dans référentiel du vent)
- Si vent augmente → forces déséquilibrées → kite accélère verticalement
- Kite monte jusqu'à nouvel équilibre

### Deuxième loi (Accélération)
```typescript
F = m × a
a = F / m

Si lift soudainement > weight :
  a_vertical = (L - W - Pv) / m_kite
```

Plus le kite est léger, plus il réagit vite aux changements de vent.

### Troisième loi (Action-Réaction)
```
Kite pousse air vers le bas → Air pousse kite vers le haut (lift)
Ligne tire kite → Kite tire ligne (tension que le pilote ressent)
```

---

## 20. 🎮 KITEMODELER (Simulateur NASA)

### Fonctionnalités principales

**Mode Design :**
- Choisir type de kite (Diamond, Box, Delta, Twin-Trap, Tumbleweed)
- Ajuster géométrie : hauteur (H1, H2), largeur (W1, W2)
- Sélectionner matériaux : surfaces, frame, tail, ligne
- Calcul automatique : Weight, CG, surface area, frame length

**Mode Trim :**
- Vue latérale avec bridle visible
- Réglages : longueur bridle (B), position knot (K), longueur tail (T)
- Calcul automatique : Lift, Drag, Tension, CP, angle of attack
- Calcul torque → indique si stable ou non

**Mode Fly :**
- Vue terrain avec ligne affaissée
- Paramètres : altitude lieu, vitesse vent, longueur ligne, payload
- Simulation Terre ou Mars !
- Calcul prédiction : Height-Y, Range-X

**Output variables :**
- Forces : Weight, Lift, Drag, Tension
- Positions : CG (center of gravity), CP (center of pressure)
- Géométrie : Surface area, Frame length
- Angle : Angle of attack (calculé ou imposé)
- Stabilité : Torque (devrait être ≈ 0 en vol stable)
- Altitude : Height-Y, Range-X

### Architecture du programme
```
1. Entrées utilisateur (sliders, input boxes)
2. Calcul géométrie (aire, AR, CP, CG)
3. Calcul poids (densités matériaux × volumes)
4. Calcul forces aéro (CL, CD, lift, drag)
5. Calcul équilibre (torque, trim angle)
6. Calcul ligne (caténaire, sag, altitude)
7. Affichage (vues Front/Side/Field + outputs)
```

**Validation :** Comparer prédictions KiteModeler avec vol réel de votre kite !

---

## 21. 🛡️ SÉCURITÉ (Règles NASA)

### Dangers principaux

1. **Lignes haute tension :**
   - **JAMAIS voler près des câbles électriques**
   - Contact ligne → électrocution → MORT
   - "Your parents can't get a new you"

2. **Routes/Autoroutes :**
   - Risque de courir sur la route pour rattraper le kite
   - Distraction pour les conducteurs
   - Kite peut être écrasé → besoin nouveau kite

3. **Arbres :**
   - "Trees like to eat kites" (Charlie Brown)
   - Kite coincé → perdu
   - Grimper pour récupérer → danger chute

4. **Maisons/Bâtiments :**
   - Dommages fenêtres, toiture, bardage
   - Kite sur toit → perdu

### Conditions sûres

✅ **Voler dans :**
- Champs ouverts
- Plages (près du rivage)
- Parcs sans obstacles
- Zones dégagées

✅ **Être conscient de :**
- Personnes autour (risque collision)
- Conditions météo (orages → DANGER)
- Limites espace aérien
- Autres kites dans la zone

---

## 22. 📋 RÉSUMÉ COMPLET DES PAGES NASA

### Pages consultées et intégrées

1. **kiteprog.html** : Programme KiteModeler, layout, inputs, outputs
2. **kite1.html** : Introduction, types de kites, histoire (Wright Brothers)
3. **kitepart.html** : Composants (frame, surface, bridle, tail, ligne)
4. **kitegeom.html** : Géométrie, dimensions, aspect ratio
5. **kitebrid.html** : Calcul position bridle point, angle A
6. **newton1k.html** : Lois de Newton appliquées aux kites
7. **kitefor.html** : Forces (lift, drag, weight, tension), équilibre
8. **kitetor.html** : Équation couple, rotation autour bridle point
9. **kitestab.html** : Stabilité, courbe couple vs angle d'attaque
10. **kitefly.html** : Lancement, vol en croisière, réponse aux changements
11. **kitesag.html** : Équation caténaire, affaissement ligne, altitude
12. **kitehigh.html** : Calcul altitude trigonométrique (formules complètes)
13. **kitedrv.html** : Dérivation mathématique altitude (4 triangles)
14. **kitehighg.html** : Méthode graphique altitude (papier millimétré)
15. **kitesafe.html** : Règles de sécurité essentielles

**Pages aérodynamiques détaillées (v2.0 - ajoutées) :**
16. **kiteaero.html** : Vue d'ensemble forces aérodynamiques, équations générales
17. **kitelift.html** : Équation portance, dépendance vitesse/densité, CL pour plaque
18. **kitedrag.html** : Équation traînée, CD de forme et induite
19. **kiteincl.html** : Effet angle d'attaque sur CL et CD
20. **kitedown.html** : Downwash, tourbillons marginaux, correction AR
21. **kitecp.html** : Centre de pression, calcul pondéré par aire, AC vs CP
22. **kitetrim.html** : Trimming, équation couple, stabilité, réglage bridle
23. **dynpress.html** : Pression dynamique q = 0.5×ρ×V² (référence)

**Total : 23 pages NASA intégrées**

---

## 23. 🔬 COMPARAISON : Notre Implémentation vs NASA Complet

### ✅ Implémenté dans kite_v5

| Aspect | État | Fichier |
|--------|------|---------|
| Coefficients CL, CD | ✅ Complet | `AeroSystem.ts` |
| Correction aspect ratio | ✅ Complet | `AeroSystem.ts` |
| Forces distribuées par face | ✅ Complet | `AeroSystem.ts` |
| Pression dynamique q | ✅ Complet | `AeroSystem.ts` |
| Vent apparent | ✅ Complet | `WindSystem.ts` |
| Gravité distribuée | ✅ Complet | `PhysicsSystem.ts` |
| Couples implicites (r × F) | ✅ Complet | `PhysicsSystem.ts` |
| Contraintes PBD lignes | ✅ Complet | `ConstraintSystem.ts` |
| Longueur ligne fixe | ✅ Complet | `LineComponent.ts` |
| Gardes numériques | ✅ Complet | `AeroSystem.ts` |

### ⚠️ Partiellement implémenté

| Aspect | État | Notes |
|--------|------|-------|
| Centre de pression (CP) | ⚠️ Local | CP calculé par face, pas CP global du kite |
| Bridle point | ⚠️ Implicite | Attachement ligne existe, pas géométrie B/K/H |
| Rotation autour bridle | ⚠️ Implicite | Physique correcte mais pas explicitement bridle point |

### ❌ Non implémenté (non critique pour simulation)

| Aspect | Priorité | Raison omission |
|--------|----------|-----------------|
| Équation caténaire ligne | Basse | Ligne PBD = segments rigides articulés |
| Calcul altitude affaissement | Basse | Pas d'affaissement avec PBD |
| Couple explicite autour bridle | Moyenne | Couples générés correctement via r×F |
| Vérification stabilité dT/dα | Moyenne | Physique permet naturellement stabilité/instabilité |
| Queue (tail) | Basse | Non modélisé actuellement |
| Types kites (Diamond, Box...) | Basse | Géométrie personnalisée libre |

---

## 24. 💡 INSIGHTS TECHNIQUES

### Différence fondamentale : Avion vs Kite

```
AVION:
- Libre dans l'espace 3D
- 6 degrés de liberté
- Rotation autour du CG (center of gravity)
- Contrôle actif (gouvernes, moteur)
- Forces principales: Thrust, Lift, Drag, Weight

KITE:
- Contraint par ligne (ancre au sol)
- 3-5 degrés de liberté (selon ligne)
- Rotation autour du BRIDLE POINT
- Contrôle passif (équilibre des couples)
- Forces principales: Lift, Drag, Weight, Tension
- Substitution conceptuelle: Tension ≈ Thrust
```

**Similitude :** Wright Brothers ont testé leurs théories de vol en utilisant des kites/gliders **avant** le premier avion motorisé (1900-1902 → 1903).

### Pourquoi PBD pour les lignes ?

```
Lignes modernes (Kevlar, Dyneema):
- Charge rupture: 50-200 kg
- Élongation sous charge: < 2%
- Comportement: Quasi-rigide en tension

Modèle PBD:
- Contrainte géométrique stricte (longueur fixe)
- Résolution itérative rapide (2-5 iterations)
- Stable numériquement
- Pas de raideur k → pas de fréquence propre → pas de dt très petit

Modèle ressort (abandonné):
- k énorme requis → dt minuscule
- Instabilité numérique
- Oscillations parasites
```

**Conclusion :** PBD = modèle physiquement et numériquement correct pour lignes peu élastiques.

### Échelles de temps

```
Phénomènes rapides (< 0.1s):
- Rafales turbulentes
- Corrections PBD (itérations)
- Oscillations hautes fréquences

Phénomènes moyens (0.1-1s):
- Réponse aérodynamique
- Changements angle d'attaque
- Montée/descente du kite

Phénomènes lents (> 1s):
- Dérive thermique
- Changement direction vent
- Fatigue matériaux
```

Notre timestep (16ms @ 60fps) capture bien phénomènes moyens/rapides.

---

## 25. 🎓 FORMULES RAPIDES (v2 - Complet)

### AÉRODYNAMIQUE
```typescript
CL₀ = 2π × α                              // Plaque plane (rad)
CL = CL₀ / (1 + CL₀/(π×AR))               // Correction downwash
CD = 1.28×sin(α) + CL²/(0.7×π×AR)         // Forme + induite
L = CL × (0.5×ρ×V²×A)                     // Portance
D = CD × (0.5×ρ×V²×A)                     // Traînée
```

### GÉOMÉTRIE
```typescript
AR = span² / area                         // Aspect ratio
CP = Σ(A_i × d_i) / Σ(A_i)                // Centre pression
CG = Σ(m_i × r_i) / Σ(m_i)                // Centre gravité
```

### BRIDLE
```typescript
cos(A) = [K²+H²-(B-K)²] / (2×K×H)         // Angle bridle
Xb = K × sin(A)                           // Position X
Yb = K × cos(A)                           // Position Y
```

### FORCES (Équilibre)
```typescript
Pv + W = L                                // Vertical
Ph = D                                     // Horizontal
tan(b) = Pv / Ph                          // Bridle angle
Tension = √(Ph² + Pv²) = √(D² + (L-W)²)  // Tension ligne
```

### COUPLE (autour bridle point)
```typescript
T = -L×cos(α)×(Yb-CP) - L×sin(α)×Xb 
    -D×sin(α)×(Yb-CP) + D×cos(α)×Xb 
    +W×cos(α)×(Yb-CG) + W×sin(α)×Xb
```

### STABILITÉ
```typescript
T(α_trim) = 0                             // Équilibre
dT/dα < 0                                 // Stable
```

### CATÉNAIRE (Ligne affaissée)
```typescript
Y = C2 + (D/p)×cosh[(p/D)×X + C1]
C1 = sinh⁻¹[(L-g-W)/D]
C2 = -(D/p)×cosh(C1)
g = s × p                                 // Poids ligne
```

### ALTITUDE (Mesure terrain)
```typescript
h = (L×tan(a)×tan(d)) / (cos(b)×tan(d) + cos(c)×tan(a))  // 4 angles
h = (L×tan(d)×sin(b)) / sin(b+c)                         // 3 angles
```

---

## 🎯 CONCLUSION

### Couverture NASA complète
Ce document intègre **23 pages NASA** couvrant l'intégralité du modèle physique :

**Fondamentaux (8 pages) :**
- Aérodynamique générale (kiteaero)
- Portance détaillée (kitelift)
- Traînée détaillée (kitedrag)  
- Angle d'attaque (kiteincl)
- Downwash et AR (kitedown)
- Centre de pression (kitecp)
- Trimming et équilibre (kitetrim)
- Pression dynamique (dynpress)

**Géométrie et structure (3 pages) :**
- Géométrie générale (kitegeom)
- Composants (kitepart)
- Bridle (kitebrid)

**Forces et dynamique (4 pages) :**
- Forces globales (kitefor)
- Couple/torque (kitetor)
- Stabilité (kitestab)
- Lois de Newton (newton1k)

**Ligne et altitude (4 pages) :**
- Caténaire (kitesag)
- Calcul altitude trigonométrique (kitehigh)
- Dérivation altitude (kitedrv)
- Méthode graphique (kitehighg)

**Pratique (4 pages) :**
- Simulateur KiteModeler (kiteprog)
- Types de kites (kite1)
- Dynamique de vol (kitefly)
- Sécurité (kitesafe)

### Notre implémentation
`AeroSystem.ts` est **conforme au modèle NASA** pour la physique essentielle :
- Forces aérodynamiques correctes (CL/CD NASA)
- Couples générés physiquement (bras de levier × force)
- Gardes de sécurité numériques appropriées

Les aspects "manquants" sont des **outils d'analyse avancés** (CP global explicite, équation caténaire, vérification dT/dα) qui peuvent être ajoutés pour visualisation/debug mais ne sont **pas requis** pour une simulation physiquement correcte.

### Prochaines étapes
1. ✅ **Documentation complète** → CE FICHIER
2. 🔄 **Tests stabilité** → Valider fixes numériques
3. ⏳ **Validation terrain** → Comparer avec vrais kites si possible
4. ⏳ **Enrichissements optionnels** → CP global, analyse stabilité, visualisation torque

---

**Version du document:** 3.0 (Exhaustif - 23 pages NASA intégrées)  
**Dernière mise à jour:** 28 octobre 2025  
**Auteur:** Compilation pour projet kite_v5  
**Sources:** NASA Glenn Research Center - Beginner's Guide to Aeronautics  
**Lignes totales:** 1400+
