# 🔍 DÉCOUVERTE : Différence Critique de Modèle Physique

**Branche MAIN vs Branche ECS-PURE-REWRITE**

## Problème Identifié

Notre branche (physics-bug-fixes, basée sur ecs-pure-rewrite) a des **paramètres de lignes complètement différents** de main !

### Modèle MAIN (ancien, OOP)
```typescript
lines: {
  stiffness: 2200,        // N/m - TRÈS raide (Dyneema réaliste)
  preTension: 75,         // N - Toujours pré-tendu
  dampingCoeff: 0.05,     // Très faible amortissement
  maxTension: 800,        // N - Limite réaliste
  linearMassDensity: 0.0005 // kg/m - Inclus la masse du câble
}
```

**Physique**: 
- Lignes très raides (2200 N/m) mais avec très peu d'amortissement (0.05)
- La preTension de 75N = 62.5× le poids du kite !
- Lignes maintiennent toujours une certaine tension minimale

### Modèle NOTRE BRANCHE (ECS Pure)
```typescript
lines: {
  stiffness: 1-2,         // N/m - TRÈS souple
  preTension: (pas implémenté)
  damping: 2-4.5,         // Amortissement ÉNORME
  maxTension: 10,         // N - Très bas
}
```

**Physique**: 
- Lignes extrêmement souples (1-2 N/m)
- Pas de preTension
- Damping énorme pour compenser

## Pourquoi ça explose

Le calcul de damping dans notre ConstraintSystem utilise la **vitesse radiale** :

```typescript
dampingForce = damping * radialVelocity;
```

Avec damping = 4.5 N·s/m, si radialVelocity = 10 m/s, alors:
- dampingForce = 45 N !

Et je tentais d'ajouter du drag v² qui faisait encore exploser les valeurs.

## La Vraie Physique des Lignes

D'après le modèle MAIN (basé sur Dyneema réel) :

### Propriétés Dyneema Real
- **EA (raideur × longueur)**: ~2200 N pour 15m
- **Masse linéique**: 0.0005 kg/m (5 mg/cm = très léger)
- **Tension de rupture**: ~1000N (nous limitons à 800)
- **Pré-tension typique**: 50-100N

### Modèle Utilisé dans MAIN
$$T = T_0 + k \cdot \Delta L - c \cdot v_{radial}$$

Où:
- $T_0 = 75$ N (preTension)
- $k = 2200$ N/m (raideur)
- $c = 0.05$ (petit amortissement)
- $\Delta L$ = extension

### Notre Modèle (ECS) - Actuellement Faux
$$T = k \cdot \Delta L + c \cdot v_{radial}$$

Problèmes:
1. Pas de preTension → lignes peuvent être molles
2. Raideur 100× trop faible → kite descend trop
3. Damping 100× trop fort → oscillations étranges

## Solution

**Adopter le modèle MAIN** :
1. Implémenter preTension dans ConstraintSystem
2. Augmenter stiffness à 2200
3. Réduire damping à 0.05
4. Augmenter maxTension à 800

Cela utilisera la **physique réelle du Dyneema** et évite les oscillations.

