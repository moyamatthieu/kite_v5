# Guide de Configuration des Brides

**Date** : 3 octobre 2025  
**Version** : 1.0  
**Objectif** : Comprendre et configurer les longueurs de brides pour optimiser le comportement du kite

---

## 📐 Principe Fondamental

Les brides définissent une **cage géométrique** qui détermine :
1. La position des points de contrôle (CTRL_GAUCHE, CTRL_DROIT) par rapport à la structure rigide du kite
2. L'angle d'attaque du kite dans le vent
3. Le profil aérodynamique de la voile

**Analogie** : Les brides sont comme les réglages d'angle d'une voile de bateau - elles **orientent** la surface, elles ne la portent pas.

---

## 🎯 Les 3 Brides et Leur Rôle

### 1. Bride NEZ (Longueur par défaut : 0.68m)

**Rôle** : Détermine la distance entre le nez du kite et les points de contrôle

**Effet sur le vol** :
- **Bride COURTE (0.60-0.65m)** :
  - ✅ Angle d'attaque plus faible
  - ✅ Vol plus rapide, moins de portance
  - ✅ Kite plus nerveux et réactif
  - ⚠️ Risque de décrochage par vent faible
  
- **Bride NORMALE (0.66-0.70m)** :
  - ✅ Équilibre entre portance et vitesse
  - ✅ Vol stable et prévisible
  - ✅ Bon compromis pour la plupart des conditions
  
- **Bride LONGUE (0.71-0.75m)** :
  - ✅ Angle d'attaque plus élevé
  - ✅ Plus de portance, vol plus lent
  - ✅ Meilleure tenue dans les vents légers
  - ⚠️ Risque de sur-incidence par vent fort

**Visualisation** :
```
NEZ courte (0.60m):  NEZ ──┐ 
                            │ angle faible (~15°)
                     CTRL ──┘

NEZ normale (0.68m): NEZ ──┐ 
                            │ angle moyen (~25°)
                     CTRL ──┘

NEZ longue (0.75m):  NEZ ──┐ 
                            │ angle élevé (~35°)
                     CTRL ──┘
```

### 2. Bride INTER (Longueur par défaut : 0.50m)

**Rôle** : Contrôle la position du point intermédiaire (milieu du bord d'attaque)

**Effet sur le vol** :
- **Bride COURTE (0.45-0.48m)** :
  - ✅ Profil plus plat au milieu
  - ✅ Meilleure pénétration dans le vent
  - ⚠️ Moins de portance globale
  
- **Bride NORMALE (0.48-0.52m)** :
  - ✅ Profil équilibré
  - ✅ Bon compromis portance/vitesse
  
- **Bride LONGUE (0.53-0.56m)** :
  - ✅ Profil plus cambré au milieu
  - ✅ Plus de portance
  - ⚠️ Plus de traînée

### 3. Bride CENTRE (Longueur par défaut : 0.50m)

**Rôle** : Contrôle la position du centre du kite par rapport aux points de contrôle

**Effet sur le vol** :
- **Bride COURTE (0.45-0.48m)** :
  - ✅ Centre du kite plus proche des CTRL
  - ✅ Profil plus cambré (courbure accentuée)
  - ✅ Plus de portance à basse vitesse
  - ⚠️ Peut créer des turbulences en vol rapide
  
- **Bride NORMALE (0.48-0.52m)** :
  - ✅ Profil équilibré
  - ✅ Vol polyvalent
  
- **Bride LONGUE (0.53-0.56m)** :
  - ✅ Profil plus plat
  - ✅ Vol plus rapide
  - ⚠️ Moins de portance

---

## 🔧 Configurations Recommandées

### Configuration Standard (Par Défaut)

**Conditions** : Vent moyen 15-25 km/h

```typescript
{
  nez: 0.68m,    // Angle d'attaque modéré
  inter: 0.50m,  // Profil équilibré
  centre: 0.50m  // Cambrure normale
}
```

**Caractéristiques** :
- ✅ Vol stable et prévisible
- ✅ Bon équilibre portance/vitesse
- ✅ Facile à contrôler

### Configuration "Vent Léger"

**Conditions** : Vent faible 8-15 km/h

```typescript
{
  nez: 0.72m,    // +6% → Angle d'attaque élevé
  inter: 0.52m,  // +4% → Profil cambré
  centre: 0.48m  // -4% → Centre rapproché
}
```

**Caractéristiques** :
- ✅ Plus de portance
- ✅ Meilleure tenue par vent faible
- ✅ Décollage plus facile
- ⚠️ Vol plus lent

### Configuration "Vent Fort"

**Conditions** : Vent fort 25-40 km/h

```typescript
{
  nez: 0.64m,    // -6% → Angle d'attaque réduit
  inter: 0.48m,  // -4% → Profil plat
  centre: 0.52m  // +4% → Centre éloigné
}
```

**Caractéristiques** :
- ✅ Moins de puissance
- ✅ Vol plus rapide et nerveux
- ✅ Meilleur contrôle par vent fort
- ⚠️ Moins de portance (kite plus bas dans la fenêtre)

### Configuration "Vitesse"

**Conditions** : Recherche de vitesse maximale

```typescript
{
  nez: 0.62m,    // -9% → Angle très faible
  inter: 0.47m,  // -6% → Profil très plat
  centre: 0.53m  // +6% → Profil aplati
}
```

**Caractéristiques** :
- ✅ Vitesse maximale
- ✅ Pénétration excellente
- ⚠️ Portance minimale
- ⚠️ Difficile à contrôler

### Configuration "Portance Maximum"

**Conditions** : Recherche de portance pour tricks aériens

```typescript
{
  nez: 0.75m,    // +10% → Angle très élevé
  inter: 0.53m,  // +6% → Profil cambré
  centre: 0.47m  // -6% → Cambrure maximale
}
```

**Caractéristiques** :
- ✅ Portance maximale
- ✅ Excellent pour sauts
- ⚠️ Vol très lent
- ⚠️ Risque de décrochage

---

## 🧪 Méthode de Réglage Expérimental

### 1. Réglage de Base (Bride NEZ)

**Objectif** : Trouver l'angle d'attaque optimal

1. Démarrer avec valeur par défaut (0.68m)
2. Lancer la simulation avec vent constant (20 km/h)
3. Observer la hauteur du kite dans la fenêtre de vol
4. Ajuster :
   - Si le kite monte trop → **réduire** bride NEZ (-0.02m)
   - Si le kite descend → **augmenter** bride NEZ (+0.02m)
5. Répéter jusqu'à stabilité

**Indicateur de succès** : Kite stable à ~60° dans la fenêtre de vol

### 2. Réglage du Profil (Brides INTER et CENTRE)

**Objectif** : Optimiser le profil aérodynamique

1. Partir du réglage NEZ optimal
2. Ajuster INTER :
   - Augmenter progressivement (+0.01m par pas)
   - Observer l'effet sur la portance
   - Trouver le point où le kite est stable sans osciller
   
3. Ajuster CENTRE :
   - Réduire légèrement (-0.01m) pour plus de cambrure
   - Observer la réactivité du kite
   - Trouver l'équilibre stabilité/réactivité

**Indicateur de succès** : Vol stable sans oscillations, réponse rapide aux commandes

### 3. Validation

**Tests à effectuer** :

✅ **Test de stabilité** :
- Kite immobile dans le vent pendant 10s
- Oscillations < 10cm
- Tensions lignes équilibrées (< 10% différence)

✅ **Test de réactivité** :
- Commande barre à gauche → kite tourne rapidement
- Retour au centre → kite se stabilise
- Pas de sur-contrôle ni oscillations

✅ **Test de portance** :
- Kite monte dans la fenêtre quand on tire les deux lignes
- Redescend quand on relâche
- Mouvement fluide et prévisible

---

## 📊 Comprendre les Tensions de Brides

### Visualisation des Tensions

Dans l'interface, les brides sont colorées selon leur tension :

- 🟢 **VERT** (< 20N) : Bride molle (contrainte non saturée)
  - La bride n'est pas à sa longueur maximale
  - Cette contrainte géométrique n'est pas active
  
- 🟡 **JAUNE** (20-100N) : Bride en tension moyenne
  - La bride approche de sa longueur maximale
  - Contrainte partiellement active
  
- 🔴 **ROUGE** (> 100N) : Bride très tendue
  - La bride est à sa longueur maximale (saturée)
  - Le kite est **plaqué** contre cette contrainte
  - Cette bride définit activement la géométrie du kite

### Interpréter les Tensions

**Configuration équilibrée** :
```
Bride NEZ gauche:    🟡 60N
Bride INTER gauche:  🟢 15N
Bride CENTRE gauche: 🟡 45N

Bride NEZ droite:    🟡 58N
Bride INTER droite:  🟢 12N
Bride CENTRE droite: 🟡 47N
```
→ Symétrie parfaite, vol stable

**Configuration déséquilibrée** :
```
Bride NEZ gauche:    🔴 120N  ← Très tendue !
Bride INTER gauche:  🟢 8N
Bride CENTRE gauche: 🟡 40N

Bride NEZ droite:    🟡 45N
Bride INTER droite:  🟢 10N
Bride CENTRE droite: 🟡 38N
```
→ Asymétrie : kite va tourner vers la gauche

**Tensions et Mécanisme de Plaquage** :

Les tensions indiquent **contre quoi** le kite est plaqué :
- Bride NEZ tendue → Le vent pousse le nez fort, kite plaqué contre cette limite
- Bride CENTRE tendue → Le vent pousse le centre, profil très cambré
- Toutes les brides molles → Configuration trop lâche, à resserrer

---

## ⚠️ Limites et Précautions

### Plages de Réglage Sécuritaires

**Bride NEZ** :
- ✅ Plage recommandée : 0.60m - 0.75m
- ⚠️ Éviter < 0.55m (décrochage garanti)
- ⚠️ Éviter > 0.80m (sur-incidence, kite instable)

**Bride INTER** :
- ✅ Plage recommandée : 0.45m - 0.56m
- ⚠️ Éviter < 0.40m (profil trop plat)
- ⚠️ Éviter > 0.60m (profil trop cambré)

**Bride CENTRE** :
- ✅ Plage recommandée : 0.45m - 0.56m
- ⚠️ Éviter < 0.40m (instabilité)
- ⚠️ Éviter > 0.60m (manque de portance)

### Règles d'Or

1. **Changer UNE bride à la fois** : Toujours isoler les effets
2. **Petits incréments** : Ajuster par pas de 0.01m-0.02m
3. **Symétrie gauche/droite** : Garder les mêmes longueurs des deux côtés (sauf pour tester asymétrie volontaire)
4. **Valider après chaque changement** : Tester stabilité avant ajustement suivant
5. **Noter les configurations** : Garder trace des réglages qui fonctionnent

---

## 🚀 Utilisation dans l'Interface

### Accès aux Contrôles

1. Ouvrir la simulation dans le navigateur
2. Section **"⚙️ Configuration Brides"** dans le panneau de contrôle
3. Trois sliders indépendants :
   - `Bride NEZ` : 0.30m - 0.80m
   - `Bride INTER` : 0.30m - 0.80m
   - `Bride CENTRE` : 0.30m - 0.80m

### Workflow de Réglage

1. **Lancer la simulation** (▶️ Lancer)
2. **Régler le vent** à une valeur stable (ex: 20 km/h)
3. **Ajuster les brides** en temps réel :
   - Déplacer le slider
   - Observer l'effet immédiat sur le kite
   - Les brides sont recalculées instantanément
4. **Observer les tensions** :
   - Couleur des lignes de brides change en temps réel
   - Panneau debug affiche les valeurs numériques
5. **Itérer** jusqu'à configuration optimale

### Raccourcis Clavier

- `R` : Reset simulation (revient à configuration par défaut)
- `D` : Toggle debug mode (affiche tensions numériques)
- `Space` : Pause/Resume

---

## 📚 Références Techniques

### Calcul des Positions

Les positions des points de contrôle (CTRL_GAUCHE, CTRL_DROIT) sont calculées par **intersection de 3 sphères** :

```typescript
// Dans PointFactory.ts
const ctrlPosition = calculateIntersectionOf3Spheres(
  { center: NEZ, radius: bridleLengths.nez },      // Sphère 1
  { center: INTER, radius: bridleLengths.inter },  // Sphère 2
  { center: CENTRE, radius: bridleLengths.centre } // Sphère 3
);
```

Cette géométrie garantit une **position unique** pour chaque configuration de brides.

### Contraintes PBD

Les brides sont appliquées comme contraintes **Position-Based Dynamics** :

```typescript
// Dans ConstraintSolver.ts
enforceBridleConstraints() {
  for (const bridle of bridles) {
    const currentLength = distance(bridle.start, bridle.end);
    const maxLength = bridle.restLength; // Longueur configurée
    
    if (currentLength > maxLength) {
      // Ramener le kite à la limite géométrique (plaquage)
      const correction = (currentLength - maxLength) / 2;
      bridle.start -= correction * direction;
      bridle.end += correction * direction;
    }
  }
}
```

Les brides **ne tirent pas** - elles définissent une **cage géométrique** contre laquelle le kite vient se plaquer sous l'effet du vent.

---

## 🎓 Concepts Avancés

### Plaquage Contre les Contraintes

Le kite se comporte comme un **ballon gonflé dans une cage rigide** :

1. Le vent (forces aérodynamiques) pousse le kite dans toutes les directions
2. Les brides définissent une cage géométrique (limites de distance)
3. Le kite vient **se plaquer** contre ces limites
4. L'équilibre est atteint quand le vent ne peut plus pousser le kite au-delà des limites

**Conséquence** : Modifier les longueurs de brides change la forme de la cage, donc la position d'équilibre, donc l'angle d'attaque, donc les forces aérodynamiques !

### Angle d'Attaque et Portance

La relation entre longueur de bride NEZ et angle d'attaque est **non-linéaire** :

```
Bride NEZ courte (0.60m) → Angle ~15° → Cl ~0.8  → Portance faible
Bride NEZ normale (0.68m) → Angle ~25° → Cl ~1.2 → Portance optimale
Bride NEZ longue (0.75m) → Angle ~35° → Cl ~1.4 → Portance élevée (risque décrochage)
```

Le **coefficient de portance (Cl)** augmente avec l'angle jusqu'à un maximum (~35°), puis chute brutalement (décrochage).

---

**Auteur** : Matthieu  
**Version** : 1.0  
**Dernière mise à jour** : 3 octobre 2025

---

**Note** : Ce guide est basé sur le modèle physique PBD actuel. Pour plus de détails sur la physique sous-jacente, voir `TENSION_FORCES_DESIGN.md`.
