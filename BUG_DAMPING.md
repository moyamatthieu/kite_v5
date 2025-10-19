# 🐛 BUG REPORT: Damping multiplicatif au lieu de continu

## Problème

Dans `PhysicsSystem.ts` ligne 61:
```typescript
physics.velocity.multiplyScalar(physics.linearDamping);
```

Avec `linearDamping = 0.8`, cela signifie:
$$v_{n+1} = 0.8 \times v_n$$

## Pourquoi c'est faux

**Physiquement**, l'amortissement visqueux est décrit par:
$$\frac{dv}{dt} = -c \times v$$

**Solution analytique**:
$$v(t) = v_0 \times e^{-c \times t}$$

**Approximation numérique discrète correcte** (avec deltaTime):
$$v_{n+1} = v_n \times e^{-c \times \Delta t}$$

**CE QUE ON FAIT** (FAUX):
$$v_{n+1} = 0.8 \times v_n$$

Cela revient à:
$$v_{n+1} = 0.8^n \times v_0$$

## Problème concret

À 60 FPS: $\Delta t = 1/60 ≈ 0.0167$ s

Avec $c = 0.8$ (linearDamping):
- Après 1 frame (0.0167 s): $v = 0.8 \times v_0$ (20% de perte)
- Après 6 frames (0.1 s): $v = 0.8^6 \times v_0 ≈ 0.262 \times v_0$ (74% de perte!)
- Après 30 frames (0.5 s): $v = 0.8^{30} \times v_0 ≈ 0.00000038 \times v_0$ (presque immobile!)

## Comparaison avec formule physique

Formule correcte: $v(t) = e^{-0.8 \times t}$
- À t = 0.5 s: $v = e^{-0.4} ≈ 0.67 \times v_0$ (33% de perte)

**DIFFÉRENCE**: 
- Multiplicatif: 74% de perte en 0.5 s
- Physique: 33% de perte en 0.5 s

Le damping MULTIPLICATIF est **2.2× trop fort**!

## Correction proposée

**Option 1** (le plus correct):
```typescript
const dampingFactor = Math.exp(-physics.linearDamping * deltaTime);
physics.velocity.multiplyScalar(dampingFactor);
```

**Option 2** (approximation rapide):
```typescript
physics.velocity.multiplyScalar(1 / (1 + physics.linearDamping * deltaTime));
```

**Option 3** (si on veut garder "0.8" comme multiplicateur par défaut):
- Reconfigurez `linearDamping` pour représenter le décay rate constant
- Utilisez formule Option 1

## Impact de la correction

- **Le kite volera plus longtemps** sans figer
- **Vitesses plus réalistes**
- **Peut affecter la stabilité** (le tuning devra être réajusté)

## Recommandation

**Corriger immédiatement** car c'est un bug fondamental de physique. Après correction, le kite aura un comportement complètement différent (probablement meilleur).

