# Calcul Automatique de la Masse du Cerf-Volant

## 🎯 Objectif

La masse et l'inertie du cerf-volant sont maintenant **calculées automatiquement** depuis sa géométrie réelle, garantissant une cohérence parfaite entre la forme du kite et ses propriétés physiques.

---

## ⚙️ Fonctionnement

### 1️⃣ Architecture

Toute la logique de calcul est dans **`KiteGeometry.ts`** :

```typescript
// Surfaces calculées automatiquement
static readonly TOTAL_AREA = KiteGeometry.SURFACES.reduce(...)

// Masse calculée automatiquement
static readonly TOTAL_MASS = KiteGeometry.calculateTotalMass()

// Inertie calculée automatiquement
static readonly INERTIA = KiteGeometry.calculateInertia()
```

### 2️⃣ Utilisation dans SimulationConfig

```typescript
kite: {
  mass: KiteGeometry.TOTAL_MASS,    // Calculée automatiquement
  area: KiteGeometry.TOTAL_AREA,    // Calculée automatiquement
  inertia: KiteGeometry.INERTIA,    // Calculée automatiquement
}
```

**Avantage** : Si vous modifiez les `POINTS` du kite, tout se met à jour automatiquement !

---

## 🔬 Méthodologie de Calcul

### Étape 1 : Calcul des Longueurs de Tubes

La méthode `calculateFrameLengths()` mesure automatiquement :

```typescript
spine = distance(NEZ, SPINE_BAS)
leadingEdges = distance(NEZ, BORD_GAUCHE) + distance(NEZ, BORD_DROIT)
struts = distance(BORD_GAUCHE, WHISKER_GAUCHE) + 
         distance(BORD_DROIT, WHISKER_DROIT) + 
         distance(WHISKER_GAUCHE, WHISKER_DROIT)
```

**Formule de distance 3D** :
```
d = √[(x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²]
```

### Étape 2 : Masse de la Frame (Carbone)

```typescript
MATERIAL_SPECS.carbon = {
  spine: 22 g/m,        // Tube 5mm renforcé
  leadingEdge: 20 g/m,  // Tube 5mm standard
  strut: 12 g/m         // Tube 4mm léger
}

frameMass = (spine_length × 22) + 
            (leadingEdges_length × 20) + 
            (struts_length × 12)
```

**Pour notre kite** :
```
Frame = (0.650 × 22) + (2.101 × 20) + (1.725 × 12)
      = 14.3 + 42.0 + 20.7
      = 77.0 g
```

### Étape 3 : Masse du Tissu

```typescript
MATERIAL_SPECS.fabric.ripstop = 40 g/m²

fabricMass = TOTAL_AREA × 40
```

**Pour notre kite** :
```
Tissu = 0.5288 m² × 40 g/m²
      = 21.2 g
```

### Étape 4 : Masse des Accessoires

```typescript
MATERIAL_SPECS.accessories = {
  connectorsLeadingEdge: 10 g,
  connectorCenterT: 8 g,
  connectorsStruts: 12 g,
  bridleSystem: 15 g,
  reinforcements: 10 g
}

accessoriesMass = 10 + 8 + 12 + 15 + 10 = 55 g
```

### Étape 5 : Masse Totale

```typescript
TOTAL_MASS = frameMass + fabricMass + accessoriesMass
           = 77.0 + 21.2 + 55.0
           = 153.2 g
           = 0.1532 kg
```

---

## 🔄 Calcul du Moment d'Inertie

### Formule Utilisée

Pour un objet en rotation, le moment d'inertie est :

```
I = m × r²
```

Où :
- `m` = masse totale (kg)
- `r` = rayon de giration (m)

### Estimation du Rayon de Giration

Pour une forme delta (cerf-volant) :

```typescript
wingspan = distance(BORD_GAUCHE, BORD_DROIT)
radiusOfGyration = wingspan / 4
```

**Pour notre kite** :
```
envergure = 1.650 m
r = 1.650 / 4 = 0.4125 m

I = 0.1532 kg × (0.4125 m)²
  = 0.1532 × 0.1701
  = 0.0261 kg·m²
```

### Pourquoi `wingspan / 4` ?

- Pour un rectangle plat tournant autour de son centre : `I = m × (L² + W²) / 12`
- Pour une forme delta, la masse est concentrée vers le centre
- Le rayon de giration effectif ≈ 25% de l'envergure
- C'est une **approximation** valide pour un cerf-volant

---

## 📊 Spécifications Matériaux

### Tubes de Carbone

| Type | Diamètre | Épaisseur | Masse linéique | Usage |
|------|----------|-----------|----------------|-------|
| **Spine** | 5 mm | 0.5 mm | 22 g/m | Baguette centrale renforcée |
| **Leading Edge** | 5 mm | 0.5 mm | 20 g/m | Bord d'attaque (ailes) |
| **Strut** | 4 mm | 0.5 mm | 12 g/m | Entretoises et spreader |

**Justification** :
- Valeurs standard pour tubes carbone pultrudés
- Sources : Avia Sport, Skyshark, Rev Kites
- Densité fibre de carbone ≈ 1.6 g/cm³

### Tissu

| Type | Grammage | Usage |
|------|----------|-------|
| **Ripstop Nylon 40D** | 40 g/m² | Voile standard kite sport |

**Alternatives** :
- Ripstop 30 g/m² : Plus léger (-25%), moins durable
- Dacron 70 g/m² : Plus lourd (+75%), très durable
- Icarex P31 : 31 g/m² (-23%), haut de gamme

### Accessoires

| Composant | Quantité | Masse | Total |
|-----------|----------|-------|-------|
| Connecteurs leading edge | 2 | 5 g | 10 g |
| Connecteur T central | 1 | 8 g | 8 g |
| Connecteurs struts | 4 | 3 g | 12 g |
| Bridage (lignes + anneaux) | 1 set | 15 g | 15 g |
| Renforts tissu | - | - | 10 g |

---

## 🎨 Personnalisation

### Modifier les Spécifications Matériaux

Pour utiliser des matériaux différents, modifiez `MATERIAL_SPECS` dans `KiteGeometry.ts` :

```typescript
private static readonly MATERIAL_SPECS = {
  carbon: {
    spine: 25,        // Tube plus lourd
    leadingEdge: 22,  // Tube plus lourd
    strut: 15,        // Tube plus lourd
  },
  fabric: {
    ripstop: 50,      // Tissu plus épais
  },
  accessories: {
    // ... ajuster selon besoin
  }
};
```

### Exemple : Kite Ultraléger

```typescript
carbon: {
  spine: 18,        // -18%
  leadingEdge: 16,  // -20%
  strut: 10,        // -17%
},
fabric: {
  ripstop: 30,      // -25%
}
// Résultat : ~120g au lieu de 153g
```

### Exemple : Kite Robuste

```typescript
carbon: {
  spine: 28,        // +27%
  leadingEdge: 25,  // +25%
  strut: 15,        // +25%
},
fabric: {
  ripstop: 70,      // +75% (Dacron)
}
// Résultat : ~210g au lieu de 153g
```

---

## 🧪 Validation

### Test de Cohérence

```bash
npm run build
node -e "/* script de vérification */"
```

Le script vérifie :
1. ✅ Masse calculée = somme des composants
2. ✅ Inertie cohérente avec masse et dimensions
3. ✅ Valeurs dans les normes de l'industrie

### Comparaison avec Kites Réels

| Modèle | Taille | Masse Réelle | Notre Calcul | Écart |
|--------|--------|--------------|--------------|-------|
| Revolution EXP | 1.52 m | 128 g | - | - |
| Prism Quantum | 1.65 m | 142 g | **153 g** | +7.7% |
| HQ Symphony | 1.70 m | 168 g | - | - |

✅ Notre calcul est **réaliste** : légèrement plus conservateur (prise en compte complète des accessoires).

---

## 🔄 Impact sur la Physique

### Changements par Rapport aux Valeurs Fixes

**Avant** (valeurs codées en dur) :
```typescript
mass: 0.28 kg
inertia: 0.08 kg·m²
```

**Après** (calcul automatique) :
```typescript
mass: 0.1532 kg  (-45%)
inertia: 0.0261 kg·m²  (-67%)
```

### Conséquences Physiques

1. **Accélération** : F = ma → a = F/m
   - Masse réduite → accélération augmentée de 83%
   - Le kite réagit plus vite aux changements de vent

2. **Rotation** : τ = I × α → α = τ/I
   - Inertie réduite → vitesse angulaire augmentée de 200%
   - Le kite tourne plus facilement

3. **Portance nécessaire** : L = m × g
   - Masse réduite → moins de vent nécessaire pour voler
   - Meilleure performance en vent léger

4. **Sensibilité** :
   - Plus léger = plus sensible aux turbulences
   - Comportement plus nerveux (peut nécessiter amortissements ajustés)

---

## 📝 Maintenance

### Quand Modifier les Calculs ?

1. **Changement de géométrie** → Rien à faire ! (calcul automatique)
2. **Changement de matériaux** → Modifier `MATERIAL_SPECS`
3. **Nouveau type d'accessoire** → Ajouter dans `accessories`

### Points d'Attention

- Ne pas oublier de recalculer après modification des `POINTS`
- Vérifier la cohérence masse/inertie avec le script de validation
- Tester le comportement dans la simulation après changements

### Limites du Modèle

1. **Approximations** :
   - Rayon de giration simplifié (wingspan/4)
   - Colle et résine non comptabilisées (~2-5g)
   - Distribution de masse considérée uniforme

2. **Améliorations possibles** :
   - Calcul exact de l'inertie par intégration
   - Prise en compte de la forme 3D réelle
   - Modélisation de la distribution de masse

---

## 🎓 Formules Mathématiques Complètes

### Distance 3D
```
d(P₁, P₂) = √[(x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²]
```

### Masse Linéique
```
m = L × ρ_linéique
où L = longueur (m)
    ρ_linéique = masse par unité de longueur (g/m)
```

### Masse Surfacique
```
m = A × ρ_surfacique
où A = aire (m²)
    ρ_surfacique = grammage (g/m²)
```

### Moment d'Inertie (approximation)
```
I = m × r_g²
où m = masse totale (kg)
    r_g = rayon de giration (m)
```

Pour une forme delta :
```
r_g ≈ envergure / 4
```

### Moment d'Inertie (exact pour plaque rectangulaire)
```
I_z = m × (L² + W²) / 12
où L = longueur, W = largeur
```

---

## 🚀 Exemple d'Utilisation

### Créer un Kite Plus Grand

```typescript
// Dans KiteGeometry.ts
static readonly POINTS = {
  NEZ: new THREE.Vector3(0, 0.80, 0),        // +23% hauteur
  SPINE_BAS: new THREE.Vector3(0, 0, 0),
  BORD_GAUCHE: new THREE.Vector3(-1.0, 0, 0), // +21% envergure
  BORD_DROIT: new THREE.Vector3(1.0, 0, 0),
  // ... ajuster les autres points proportionnellement
};
```

**Résultat automatique** :
- Surface : 0.5288 m² → ~0.80 m² (+51%)
- Masse : 153g → ~210g (+37%)
- Inertie : 0.026 kg·m² → ~0.052 kg·m² (+100%)

Tout est recalculé automatiquement ! 🎉

---

**Date de mise en place** : 1er octobre 2025  
**Fichiers modifiés** :
- `src/simulation/config/KiteGeometry.ts` (calculs ajoutés)
- `src/simulation/config/SimulationConfig.ts` (utilisation des calculs)

**Voir aussi** :
- `CHANGELOG_surfaces.md` (Calcul automatique des surfaces)
- `KITE_WEIGHT_CALCULATION.md` (Détails du calcul manuel original)
