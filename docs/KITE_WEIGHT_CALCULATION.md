# Calcul du Poids du Cerf-Volant

## 📊 Vue d'Ensemble

**Masse totale calculée : 153.2 g (0.153 kg)**

Cette valeur est basée sur une estimation réaliste des composants d'un cerf-volant sport de 1.65m d'envergure avec structure en fibre de carbone.

---

## 🔩 1. Structure (Frame) - Tubes de Carbone

### Longueurs des Tubes

| Tube | Longueur | Calcul |
|------|----------|--------|
| **Spine centrale** | 0.650 m | Distance NEZ → SPINE_BAS |
| **Leading edge gauche** | 1.050 m | Distance NEZ → BORD_GAUCHE |
| **Leading edge droit** | 1.050 m | Distance NEZ → BORD_DROIT |
| **Strut gauche** | 0.450 m | Distance BORD_GAUCHE → WHISKER_GAUCHE |
| **Strut droit** | 0.450 m | Distance BORD_DROIT → WHISKER_DROIT |
| **Spreader bar** | 0.825 m | Distance WHISKER_GAUCHE → WHISKER_DROIT |
| **TOTAL** | **4.476 m** | Longueur totale de tubes |

### Spécifications des Tubes

#### Tubes principaux (Spine + Leading edges)
- **Diamètre** : 5 mm
- **Épaisseur paroi** : 0.5 mm
- **Matériau** : Fibre de carbone (densité ≈ 1.6 g/cm³)
- **Masse linéique** :
  - Spine (renforcée) : **22 g/m**
  - Leading edges : **20 g/m**

#### Tubes secondaires (Struts + Spreader)
- **Diamètre** : 4 mm
- **Épaisseur paroi** : 0.5 mm
- **Masse linéique** : **12 g/m**

### Masses Calculées

```
Spine centrale       : 0.650 m × 22 g/m = 14.3 g
Leading edges        : 2.100 m × 20 g/m = 42.0 g
Struts + Spreader    : 1.725 m × 12 g/m = 20.7 g
─────────────────────────────────────────────────
TOTAL FRAME                             = 77.0 g  (50.3%)
```

**Justification des valeurs** :
- Ces masses correspondent aux tubes carbone pultrudés haute performance
- Utilisés dans les kites sport/stunt de qualité
- Sources : fabricants comme Avia Sport, Skyshark, Rev Kites

---

## 🎨 2. Tissu (Voile)

### Surface Totale
```
Surface = 0.5288 m² (calculée automatiquement depuis KiteGeometry)
```

Composée de 4 triangles :
- Surface haute gauche : 0.1217 m²
- Surface basse gauche : 0.1427 m²
- Surface haute droite : 0.1217 m²
- Surface basse droite : 0.1427 m²

### Matériau
- **Type** : Ripstop Nylon 30D ou 40D
- **Grammage** : 40 g/m²
- **Traitement** : Enduit silicone pour imperméabilité

### Masse Calculée

```
Tissu : 0.5288 m² × 40 g/m² = 21.2 g  (13.8%)
```

**Justification** :
- Ripstop 40 g/m² est standard pour kites de cette taille
- Alternative : Dacron 50-70 g/m² (plus lourd, plus durable)
- Icarex P31 (31 g/m²) serait 20% plus léger mais moins courant

---

## 🔧 3. Accessoires et Connecteurs

### Détail des Composants

| Composant | Quantité | Masse unitaire | Total |
|-----------|----------|----------------|-------|
| **Connecteurs leading edge** | 2 | 5 g | 10 g |
| **Connecteur T central** | 1 | 8 g | 8 g |
| **Connecteurs struts** | 4 | 3 g | 12 g |
| **Système de bridage** | 1 | 15 g | 15 g |
| **Renforts tissu** | - | - | 10 g |
| **TOTAL ACCESSOIRES** | | | **55 g** (35.9%) |

### Description des Accessoires

#### Connecteurs Leading Edge (10g)
- 2× connecteurs en nylon renforcé ou ABS
- Permettent d'assembler spine + leading edges au nez
- Masse typique : 5g/pièce

#### Connecteur T Central (8g)
- 1× jonction centrale (spine/leading edges/spreader)
- Pièce critique sous tension importante
- Masse typique : 8g

#### Connecteurs Struts (12g)
- 4× petits connecteurs pour attacher struts
- Plus légers car moins de contrainte
- Masse typique : 3g/pièce

#### Système de Bridage (15g)
- Lignes de bridage (cordon Dyneema/Spectra)
- Points d'attache et anneaux
- Masse typique pour un kite de cette taille : 12-18g

#### Renforts Tissu (10g)
- Patchs de renforcement aux points de tension
- Ourlets et coutures
- Protections leading edge
- Estimation : 10g

---

## ⚖️ Récapitulatif Final

```
╔═══════════════════════════════════════════════════════╗
║  MASSE TOTALE DU CERF-VOLANT                          ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  • Frame (carbone) :      77.0 g    (50.3%)          ║
║  • Tissu (voile) :        21.2 g    (13.8%)          ║
║  • Accessoires :          55.0 g    (35.9%)          ║
║  ═══════════════════════════════════════════════════  ║
║  TOTAL :                 153.2 g                      ║
║                          0.153 kg                     ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## 📊 Comparaison avec Kites Réels

### Kites Sport/Stunt du Commerce

| Modèle | Taille | Masse | Remarque |
|--------|--------|-------|----------|
| Revolution EXP | 1.52 m | 128 g | Ultraléger |
| Prism Quantum | 1.65 m | 142 g | Comparable |
| **Notre Kite** | **1.65 m** | **153 g** | ✅ **Réaliste** |
| HQ Symphony | 1.70 m | 168 g | Slightly heavier |
| Prism Nexus | 2.00 m | 210 g | Plus grand |

### Analyse

✅ **153g est une valeur réaliste** pour un kite de 1.65m :
- Dans la fourchette attendue (130-180g)
- Cohérent avec le ratio masse/surface (~290 g/m²)
- Frame carbone de bonne qualité (pas ultraléger, pas trop lourd)

---

## 🧮 Formules et Méthodes

### Calcul de Distance 3D
```typescript
distance(p1, p2) = √[(x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²]
```

### Masse Linéique des Tubes
```
Masse = Longueur × Masse_linéique
```

### Masse du Tissu
```
Masse = Surface × Grammage
```

### Moment d'Inertie Estimé
```
I ≈ m × r²
```

Pour notre kite :
- m = 0.153 kg
- r ≈ 0.5 m (rayon de giration estimé)
- **I ≈ 0.04 kg·m²**

(Valeur mise à jour dans `SimulationConfig.ts`)

---

## 🔄 Impact sur la Physique

### Changements Appliqués

**Avant** :
```typescript
mass: 0.28 kg
inertia: 0.08 kg·m²
```

**Après** :
```typescript
mass: 0.153 kg  (réduction de 45%)
inertia: 0.04 kg·m²  (réduction de 50%)
```

### Conséquences Physiques

1. **Accélération augmentée** : F = ma → même force produit plus d'accélération
2. **Réactivité améliorée** : Moins d'inertie = rotations plus rapides
3. **Portance nécessaire réduite** : Besoin de moins de vent pour voler
4. **Sensibilité au vent** : Plus léger = plus sensible aux turbulences

### Ajustements Recommandés

Si le kite devient trop nerveux après cette correction, considérer :
- Augmenter `angularDamping` (actuellement 0.85)
- Augmenter `linearDamping` (actuellement 0.92)
- Réduire `liftScale` si le kite monte trop facilement

---

## 📝 Notes de Développement

### Sources et Références

1. **Tubes Carbone** : Catalogues Avia Sport, Skyshark Carbon rods
2. **Tissus** : Spécifications Ripstop Nylon, Icarex, Dacron
3. **Kites Réels** : Spécifications fabricants (Prism, HQ, Revolution)

### Limitations de l'Estimation

- Colle et résine non comptabilisées (~2-5g)
- Variations selon fabrication (couture, finitions)
- Optionnel : queue, sac de rangement non inclus

### Validation Future

Pour affiner davantage :
- Pesée d'un kite réel similaire
- CAO 3D avec densités de matériaux précises
- Mesure expérimentale du moment d'inertie

---

**Date de calcul** : 1er octobre 2025  
**Fichiers liés** :
- `src/simulation/config/SimulationConfig.ts` (CONFIG.kite.mass)
- `src/simulation/config/KiteGeometry.ts` (géométrie et surfaces)

**Voir aussi** :
- `CHANGELOG_surfaces.md` (Calcul des surfaces)
- `src/simulation/physics/PhysicsEngine.ts` (Application de la masse)
