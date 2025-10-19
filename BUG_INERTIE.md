# 🐛 BUG REPORT: Inertie du kite incorrecte

## Configuration actuelle

Config.ts:
```typescript
inertia: {
  Ixx: 0.015,  // kg⋅m²
  Iyy: 0.020,  // kg⋅m²
  Izz: 0.005   // kg⋅m²
},
mass: 0.12 kg
wingspan: 1.65 m
chord: 0.65 m
surfaceArea: 0.54 m²
```

## Calcul correct de l'inertie

Pour un kite delta (approximation comme plaque rectangulaire):

### Inertie autour de X (pitch - rotation avant/arrière)
$$I_{xx} = \frac{1}{12} \times m \times (chord^2 + height^2)$$

Où `height ≈ wingspan` pour un delta:
$$I_{xx} = \frac{1}{12} \times 0.12 \times (0.65^2 + 1.65^2)$$
$$I_{xx} = \frac{1}{12} \times 0.12 \times (0.4225 + 2.7225)$$
$$I_{xx} = \frac{1}{12} \times 0.12 \times 3.145$$
$$I_{xx} ≈ 0.0315 \text{ kg⋅m}^2$$

**ACTUELLEMENT: 0.015 (2.1× trop petit !)**

### Inertie autour de Y (yaw - rotation gauche/droite)
$$I_{yy} = \frac{1}{12} \times m \times chord^2$$
$$I_{yy} = \frac{1}{12} \times 0.12 \times 0.65^2$$
$$I_{yy} = \frac{1}{12} \times 0.12 \times 0.4225$$
$$I_{yy} ≈ 0.00423 \text{ kg⋅m}^2$$

**ACTUELLEMENT: 0.020 (4.7× trop grand !)**

### Inertie autour de Z (roll - rotation latérale)
$$I_{zz} = \frac{1}{12} \times m \times (chord^2 + (wingspan/2)^2)$$
$$I_{zz} = \frac{1}{12} \times 0.12 \times (0.4225 + (1.65/2)^2)$$
$$I_{zz} = \frac{1}{12} \times 0.12 \times (0.4225 + 0.6806)$$
$$I_{zz} = \frac{1}{12} \times 0.12 \times 1.1031$$
$$I_{zz} ≈ 0.0110 \text{ kg⋅m}^2$$

**ACTUELLEMENT: 0.005 (2.2× trop petit !)**

## Tableau comparatif

| Axe | Actuellement | Correct | Ratio |
|-----|-------------|---------|-------|
| Ixx (pitch) | 0.015 | 0.0315 | 0.48× (trop petit) |
| Iyy (yaw)   | 0.020 | 0.0042 | 4.76× (trop grand) |
| Izz (roll)  | 0.005 | 0.0110 | 0.45× (trop petit) |

## Conséquences du bug

1. **Pitch trop facile** (Ixx trop petit)
   - Le kite pivote trop facilement avant/arrière
   - Instabilité de tangage

2. **Yaw beaucoup trop difficile** (Iyy trop grand)
   - Le kite ne tourne pas assez à gauche/droite
   - Les contrôles de direction inefficaces

3. **Roll trop facile** (Izz trop petit)
   - Le kite bascule trop facilement
   - Instabilité latérale

## Correction proposée

```typescript
inertia: {
  Ixx: 0.0315,  // kg⋅m² (pitch)
  Iyy: 0.0042,  // kg⋅m² (yaw)
  Izz: 0.0110   // kg⋅m² (roll)
}
```

## Impact de la correction

- **Dynamique de rotation complètement changée**
- **Le kite sera probablement plus stable** (avec bonnes valeurs d'inertie)
- **Réponse aux contrôles affectée** (tuning UI devra être réajusté)
- **Comportement plus réaliste** pour un kite delta

## Recommandation

**Corriger immédiatement**. C'est un paramètre fondamental qui affecte toute la dynamique rotationnelle du kite.

