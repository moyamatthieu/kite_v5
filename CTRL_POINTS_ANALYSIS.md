# Analyse des Points de Contrôle (CTRL_GAUCHE / CTRL_DROIT)

## Problème Identifié

Les points de contrôle `CTRL_GAUCHE` et `CTRL_DROIT` sont actuellement **traités comme des points fixes** attachés rigidement à la géométrie du kite. C'est **physiquement incorrect**.

## Principe Physique Correct

### Points CTRL : Particules Libres

Les points CTRL ne sont **PAS** des points de la structure rigide du kite. Ce sont des **particules virtuelles libres** dont la position est déterminée UNIQUEMENT par :

1. **3 Brides** (contraintes de distance depuis le kite) :
   - `NEZ → CTRL_GAUCHE` (longueur: bridle.nez)
   - `INTER_GAUCHE → CTRL_GAUCHE` (longueur: bridle.inter)
   - `CENTRE → CTRL_GAUCHE` (longueur: bridle.centre)

2. **1 Ligne** (contrainte de distance vers la poignée) :
   - `CTRL_GAUCHE → HANDLE_LEFT` (longueur: line.length)

### Différence Fondamentale

#### ❌ Comportement Actuel (Incorrect)
```
CTRL est un point du kite
→ CTRL bouge avec le kite (rotation/translation)
→ Position CTRL = appliqué par quaternion du kite
→ Les brides et lignes sont des contraintes "secondaires"
```

#### ✅ Comportement Correct
```
CTRL est une particule libre dans l'espace
→ CTRL a sa propre position indépendante
→ Position CTRL = résolue par trilatération 3D depuis:
  * 3 points du kite (NEZ, INTER, CENTRE) via brides
  * 1 point fixe (HANDLE) via ligne
→ Le kite tire sur CTRL via les brides
→ La ligne tire sur CTRL depuis la poignée
→ CTRL trouve son équilibre naturel
```

## Implications Physiques

### 1. Orientation du Kite

Avec CTRL libre, l'orientation du kite émerge de l'équilibre des tensions :
- Si ligne gauche plus courte → CTRL_GAUCHE plus proche de la poignée
- Les 3 brides gauches retiennent le kite vers la gauche
- Le kite pivote naturellement vers la gauche

### 2. Angle d'Attaque

L'angle d'attaque du kite n'est plus "scripté" mais émerge de :
- Tension des brides (retiennent le kite vers l'avant z+)
- Poussée du vent (pousse le kite vers l'ariere z-)
- Gravité (tire vers le bas)
- Équilibre dynamique résultant

### 3. Stabilité

Un kite bien bridé trouve naturellement son équilibre car :
- Les CTRL se positionnent automatiquement au point d'équilibre des forces
- Les brides répartissent la charge sur la structure
- Pas besoin de "forcer" l'orientation

## Implémentation Correcte

### Architecture Requise

```typescript
class ControlPoint {
  position: THREE.Vector3;  // Position libre dans l'espace
  velocity: THREE.Vector3;  // Vitesse propre
  mass: number;             // Masse négligeable (~0.001 kg)
}
```

### Solver PBD pour CTRL

Au lieu de traiter CTRL comme partie du kite, il faut :

1. **Initialisation** : Calculer position initiale par trilatération
2. **Update Loop** :
   ```
   Pour chaque CTRL:
     a) Appliquer contraintes brides (3 contraintes de distance)
     b) Appliquer contrainte ligne (1 contrainte de distance)
     c) Résoudre position CTRL par solver itératif (PBD)
   ```

3. **Forces sur le Kite** :
   ```
   Pour chaque bride:
     force = tension_bride * direction_bride
     appliquer au point d'attache sur le kite
   ```

### Équations de Contrainte

#### Contrainte Bride
```
C_bride = ||P_kite_point - P_ctrl|| - L_bride = 0
```

#### Contrainte Ligne
```
C_ligne = ||P_ctrl - P_handle|| - L_ligne = 0
```

#### Résolution Trilatération 4-Sphères

Position CTRL = intersection de 4 sphères :
- Sphère 1 : centre=NEZ, rayon=L_nez
- Sphère 2 : centre=INTER, rayon=L_inter
- Sphère 3 : centre=CENTRE, rayon=L_centre
- Sphère 4 : centre=HANDLE, rayon=L_ligne

## Code à Modifier

### 1. GeometryComponent

```typescript
// ❌ Actuellement : CTRL stocké comme point du kite
geometry.setPoint('CTRL_GAUCHE', ctrlGauche);

// ✅ Devrait être : CTRL comme entité séparée
// Option A : Component séparé
class ControlPointComponent {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

// Option B : Entité dédiée
const ctrlLeftEntity = new Entity('ctrl-left');
ctrlLeftEntity.addComponent(new TransformComponent());
ctrlLeftEntity.addComponent(new PhysicsComponent({ mass: 0.001 }));
```

### 2. ConstraintSolver

```typescript
// ✅ Nouvelle méthode
static resolveControlPoint(
  kiteEntity: Entity,
  ctrlEntity: Entity,
  handlePosition: THREE.Vector3,
  bridleLengths: BridleLengths,
  lineLength: number
): void {
  // 1. Récupérer positions des 3 points d'attache sur le kite
  const nezWorld = getWorldPoint(kiteEntity, 'NEZ');
  const interWorld = getWorldPoint(kiteEntity, 'INTER_GAUCHE');
  const centreWorld = getWorldPoint(kiteEntity, 'CENTRE');
  
  // 2. Résoudre position CTRL par trilatération 4-sphères
  const ctrlPosition = solveQuadrilateration(
    nezWorld, bridleLengths.nez,
    interWorld, bridleLengths.inter,
    centreWorld, bridleLengths.centre,
    handlePosition, lineLength
  );
  
  // 3. Mettre à jour position CTRL
  const ctrlTransform = ctrlEntity.getComponent<TransformComponent>('transform');
  ctrlTransform.position.copy(ctrlPosition);
  
  // 4. Calculer forces sur le kite depuis les brides tendues
  applyBridleForces(kiteEntity, ctrlEntity, bridleLengths);
}
```

### 3. BridleSystem

```typescript
// ✅ Rôle modifié : Calculer tensions et forces, pas positions
class PureBridleSystem {
  update(context: SimulationContext): void {
    // 1. Résoudre positions CTRL (via ConstraintSolver)
    // 2. Calculer tensions dans chaque bride
    // 3. Appliquer forces sur le kite
  }
}
```

## Migration Progressive

### Étape 1 : Vérifier Comportement Actuel
- Logger positions CTRL pendant simulation
- Vérifier si CTRL suit rigidement le kite ou s'il a un mouvement propre

### Étape 2 : Créer Entités CTRL Séparées
- Créer `ControlPointEntity` avec TransformComponent + PhysicsComponent
- Masse négligeable (0.001 kg)

### Étape 3 : Modifier Solver
- Résoudre positions CTRL par quadrilatération
- Appliquer forces sur le kite via les brides

### Étape 4 : Tester
- Vérifier que le kite réagit correctement aux mouvements de la barre
- Vérifier l'angle d'attaque émergent
- Vérifier la stabilité

## Bénéfices Attendus

1. **Réalisme Physique** : Comportement émergent naturel
2. **Stabilité** : Équilibre automatique sans "tuning" artificiel
3. **Contrôle** : Réponse directe et intuitive aux inputs
4. **Code Propre** : Séparation claire kite / bridage / lignes

## Conclusion

Les points CTRL doivent être traités comme des **particules libres** contraintes par les brides et lignes, et NON comme des points fixes de la géométrie du kite. Cette correction est fondamentale pour un comportement physique correct.
