# Graphe de la Boucle de Simulation - Kite V5

## Vue d'Ensemble - 60 FPS (16.67ms par frame)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BOUCLE PRINCIPALE (60 Hz)                        │
│                  SimulationApp.animate()                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. ACQUISITION DES ENTRÉES                                          │
├─────────────────────────────────────────────────────────────────────┤
│  InputHandler.update(deltaTime)                                     │
│    └─> Récupère les commandes clavier (↑↓ pour rotation barre)     │
│  InputHandler.getTargetBarRotation()                                │
│    └─> Retourne l'angle cible de rotation de la barre              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MISE À JOUR PHYSIQUE PRINCIPALE                                  │
│    PhysicsEngine.update(deltaTime, targetBarRotation)               │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────────────┐                 ┌──────────────────────┐
│ 2.1 Lissage Barre    │                 │ 2.2 Calcul Poignées  │
├──────────────────────┤                 ├──────────────────────┤
│ ControlBarManager    │                 │ ControlBarManager    │
│  .setRotation()      │                 │  .getHandlePositions │
│                      │                 │  ()                  │
│ Interpolation douce  │                 │                      │
│ vers angle cible     │                 │ Position spatiale    │
│                      │                 │ des poignées G/D     │
└──────────────────────┘                 └──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.3 CALCUL DU VENT APPARENT                                         │
├─────────────────────────────────────────────────────────────────────┤
│  WindSimulator.getApparentWind(kiteVelocity, deltaTime)             │
│    ├─> Vent monde (direction + vitesse de base)                    │
│    ├─> Turbulence (bruit de Perlin temporel)                       │
│    └─> Vent apparent = (Vent monde + Turbulence) - Vitesse kite    │
│                                                                     │
│  Principe de relativité : le kite ressent le vent relatif à        │
│  son propre mouvement, pas le vent absolu                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.4 CALCUL DES FORCES AÉRODYNAMIQUES                                │
│     AerodynamicsCalculator.calculateForces(apparentWind, orientation)│
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌────────────────┐
│ Pour chaque  │    │ Pour chaque  │      │ Pour chaque    │
│ surface (4×) │    │ surface (4×) │      │ surface (4×)   │
├──────────────┤    ├──────────────┤      ├────────────────┤
│ 1. Normale   │    │ 3. Angle     │      │ 5. Gravité     │
│    locale    │    │    incidence │      │    distribuée  │
│              │    │    α         │      │                │
│ Produit      │    │ windDot      │      │ F_g = m_i × g  │
│ vectoriel    │    │ Normal       │      │                │
│ edge1×edge2  │    │              │      │ (masse de la   │
│              │    │ sin(α)=      │      │  surface i)    │
│              │    │ cos(θ)       │      │                │
└──────────────┘    └──────────────┘      └────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌────────────────┐
│ 2. Rotation  │    │ 4. Force     │      │ 6. Force       │
│    normale   │    │    normale   │      │    totale      │
│              │    │              │      │                │
│ normale ×    │    │ F_n = q×A×   │      │ F_total =      │
│ quaternion   │    │ sin²(α)      │      │ F_aero + F_g   │
│              │    │              │      │                │
│ Orientation  │    │ q = 0.5×ρ×V² │      │                │
│ monde        │    │              │      │                │
└──────────────┘    └──────────────┘      └────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. DÉCOMPOSITION ET COUPLE                                          │
├─────────────────────────────────────────────────────────────────────┤
│  Pour chaque surface :                                              │
│    ├─> Drag = projection de F_n sur direction vent                 │
│    ├─> Lift = F_n - Drag (perpendiculaire au vent)                 │
│    ├─> Centre de pression = barycentre du triangle                 │
│    └─> Couple = r × F_total (r = centre → origine)                 │
│                                                                     │
│  Agrégation :                                                       │
│    ├─> Total Lift = Σ lift_i                                       │
│    ├─> Total Drag = Σ drag_i                                       │
│    ├─> Total Torque = Σ (r_i × F_total_i)                          │
│    ├─> Left Force = Σ F_total_i (pour x < 0)                       │
│    └─> Right Force = Σ F_total_i (pour x > 0)                      │
│                                                                     │
│  ⚠️ IMPORTANT : Le couple INCLUT déjà la gravité distribuée !       │
│     Couple gravitationnel = émergent de r × F_gravity              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.5 CALCUL DES TENSIONS (AFFICHAGE UNIQUEMENT)                      │
├─────────────────────────────────────────────────────────────────────┤
│  LineSystem.calculateLineTensions(kite, rotation, pilotPosition)    │
│    ├─> Longueur ligne gauche actuelle                              │
│    ├─> Longueur ligne droite actuelle                              │
│    ├─> Tension gauche = f(longueur, vitesse)                       │
│    └─> Tension droite = f(longueur, vitesse)                       │
│                                                                     │
│  BridleSystem.calculateBridleTensions(kite)                         │
│    ├─> Pour chaque bride (6 au total) :                            │
│    │     ├─> Longueur actuelle                                     │
│    │     ├─> Longueur repos (configuration)                        │
│    │     └─> Tension = k × (L - L₀)  (si L > L₀)                   │
│    └─> Retourne { nez: [L,R], inter: [L,R], centre: [L,R] }        │
│                                                                     │
│  ⚠️ CRITIQUE : Ces tensions sont pour VISUALISATION uniquement !    │
│     Les lignes/brides ne génèrent PAS de forces !                  │
│     Ce sont des CONTRAINTES géométriques (PBD) appliquées plus tard│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.6 SOMME DES FORCES                                                │
├─────────────────────────────────────────────────────────────────────┤
│  totalForce = lift + drag                                           │
│  totalTorque = torque (calculé par AerodynamicsCalculator)          │
│                                                                     │
│  ⚠️ PAS de forces de lignes/brides → ce sont des contraintes !     │
│  ⚠️ PAS de gravité globale → déjà distribuée par surface !         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.7 INTÉGRATION PHYSIQUE                                            │
│     KiteController.update(totalForce, totalTorque, handles, dt)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ 2.7.1 LISSAGE TEMPOREL       │      │ 2.7.2 INTÉGRATION NEWTON     │
├──────────────────────────────┤      ├──────────────────────────────┤
│ Lissage exponentiel :        │      │ integratePhysics(force, dt)  │
│                              │      │                              │
│ smoothingFactor = 1 - e^(-k×dt)│    │ a = F / m  (2ème loi Newton) │
│                              │      │                              │
│ smoothedForce.lerp(          │      │ v(t+dt) = v(t) + a×dt        │
│   validForces,               │      │   (intégration Euler)        │
│   smoothingFactor)           │      │                              │
│                              │      │ Damping : v *= e^(-c×dt)     │
│ smoothedTorque.lerp(...)     │      │                              │
│                              │      │ Limites : v_max, a_max       │
│ Évite les à-coups brusques   │      │                              │
│ dus aux variations de forces │      │ newPos = pos + v×dt          │
└──────────────────────────────┘      └──────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.7.3 CONTRAINTES PBD (Position-Based Dynamics)                     │
│       ⚠️ C'EST ICI QUE LES LIGNES/BRIDES AGISSENT !                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌────────────────┐
│ Contraintes  │    │ Contraintes  │      │ Contrainte     │
│ de lignes    │    │ de brides    │      │ sol            │
├──────────────┤    ├──────────────┤      ├────────────────┤
│ Constraint   │    │ Constraint   │      │ Constraint     │
│ Solver.      │    │ Solver.      │      │ Solver.        │
│ enforceLine  │    │ enforceBridle│      │ handleGround   │
│ Constraints()│    │ Constraints()│      │ Collision()    │
│              │    │              │      │                │
│ Distance     │    │ 6 brides :   │      │ Si y < 0 :     │
│ EXACTE :     │    │ NEZ (L+R)    │      │   y = 0        │
│ |CTRL-Poignée│    │ INTER (L+R)  │      │   v.y = -v.y × │
│  | = lineLen │    │ CENTRE (L+R) │      │   restitution  │
│              │    │              │      │                │
│ Correction   │    │ Distance MAX :│      │ Rebond avec    │
│ géométrique  │    │ |CTRL-Point| │      │ amortissement  │
│ de position  │    │ ≤ bridleLen  │      │                │
│              │    │              │      │                │
│ Feedback sur │    │ Correction   │      │                │
│ vitesse      │    │ géométrique  │      │                │
│ (PBD)        │    │ si saturé    │      │                │
└──────────────┘    └──────────────┘      └────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2.7.4 ORIENTATION (ROTATION)                                        │
├─────────────────────────────────────────────────────────────────────┤
│  updateOrientation(smoothedTorque, dt)                              │
│    ├─> Couple d'amortissement : τ_drag = -I × k_drag × ω           │
│    ├─> Couple effectif : τ_eff = τ + τ_drag                        │
│    ├─> Accélération angulaire : α = τ_eff / I                      │
│    ├─> Vitesse angulaire : ω(t+dt) = ω(t) + α×dt                   │
│    ├─> Limite : ω_max                                              │
│    └─> Quaternion : q(t+dt) = q(t) × Δq(ω×dt)                      │
│                                                                     │
│  Application : kite.quaternion = newQuaternion                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MISE À JOUR VISUELLE                                             │
│    SimulationApp.updateControlLines()                               │
├─────────────────────────────────────────────────────────────────────┤
│  ├─> Récupère CTRL_GAUCHE et CTRL_DROIT du kite                    │
│  ├─> Transformation local → world (kite.localToWorld)              │
│  ├─> Calcul caténaire (courbe physique de la ligne)                │
│  │     LineSystem.calculateCatenary(start, end)                    │
│  │       └─> 20 points simulant la gravité de la ligne             │
│  ├─> Mise à jour géométrie Three.js (leftLine, rightLine)          │
│  └─> Mise à jour visuelle barre de contrôle                        │
│        ControlBarManager.updateVisual(controlBar, kite)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. RENDU DEBUG (si activé)                                          │
│    DebugRenderer.updateDebugArrows(kite, physicsEngine)             │
├─────────────────────────────────────────────────────────────────────┤
│  ├─> Flèches de forces (lift, drag, vent)                          │
│  ├─> Visualisation des normales de surfaces                        │
│  └─> Affichage des tensions de lignes/brides                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RENDU 3D                                                         │
│    RenderManager.render()                                           │
├─────────────────────────────────────────────────────────────────────┤
│  └─> renderer.render(scene, camera)                                │
│        └─> Affichage WebGL final à l'écran                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. MISE À JOUR UI                                                   │
│    UIManager.update() (implicite via événements)                    │
├─────────────────────────────────────────────────────────────────────┤
│  ├─> Affichage position (x, y, z)                                  │
│  ├─> Affichage vitesse                                             │
│  ├─> Affichage tensions lignes/brides                              │
│  └─> Sliders de contrôle (brides, vent, etc.)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
                  ┌─────────────────────┐
                  │  Retour au début    │
                  │  (requestAnimation  │
                  │   Frame → 60 Hz)    │
                  └─────────────────────┘
```

## Notes Critiques sur la Physique

### 1. Ordre des Opérations (CRITIQUE !)

L'ordre est **essentiel** pour la stabilité :

1. **Forces** calculées en premier (aéro + gravité)
2. **Intégration** de Newton (F=ma → nouvelle position)
3. **Contraintes** appliquées APRÈS (PBD corrige la position)
4. **Feedback** des contraintes sur la vitesse

Si on inverse 2 et 3, la simulation explose ! Les contraintes doivent corriger APRÈS l'intégration.

### 2. Deux Types de Physique

**Forces (Force-Based)** :
- Aérodynamique (lift, drag)
- Gravité distribuée
- Génèrent mouvement via F=ma

**Contraintes (Position-Based)** :
- Lignes (distance exacte)
- Brides (distance max)
- Sol (y ≥ 0)
- Corrigent géométriquement la position

### 3. Tensions vs Forces

⚠️ **TENSIONS ≠ FORCES** !

- **Tensions** = valeurs calculées pour affichage/debug
- **Contraintes** = corrections géométriques de position
- Les lignes/brides ne "tirent" pas, elles "retiennent"

### 4. Physique Émergente

Le comportement complexe émerge de règles simples :

- **Rotation** → différence de force gauche/droite
- **Stabilité** → équilibre aéro + contraintes
- **Courbes** → intégration continue sur 60 FPS

**Aucun comportement scripté** ! Tout vient des lois physiques.

## Mesures de Performance

| Étape | Temps Typique | % Frame |
|-------|---------------|---------|
| Entrées | < 0.1 ms | < 1% |
| Vent apparent | 0.1 ms | < 1% |
| Forces aéro (4 surfaces) | 0.5-1 ms | 3-6% |
| Tensions (affichage) | 0.2 ms | 1-2% |
| Intégration Newton | 0.1 ms | < 1% |
| Contraintes PBD | 1-2 ms | 6-12% |
| Mise à jour visuelle | 0.5 ms | 3% |
| Rendu Three.js | 8-12 ms | 50-70% |
| **TOTAL** | **~15 ms** | **~90%** |

Budget : 16.67 ms par frame pour 60 FPS → marge de 1-2 ms OK ✅

## Fichiers Impliqués

| Fichier | Rôle dans la Boucle |
|---------|---------------------|
| `SimulationApp.ts` | Orchestration principale (animate) |
| `PhysicsEngine.ts` | Coordination physique |
| `InputHandler.ts` | Capture commandes utilisateur |
| `ControlBarManager.ts` | Gestion barre et poignées |
| `WindSimulator.ts` | Calcul vent apparent |
| `AerodynamicsCalculator.ts` | Forces aéro + gravité |
| `LineSystem.ts` | Tensions lignes (affichage) |
| `BridleSystem.ts` | Tensions brides (affichage) |
| `KiteController.ts` | Intégration + contraintes |
| `ConstraintSolver.ts` | PBD (lignes, brides, sol) |
| `RenderManager.ts` | Rendu WebGL |
| `DebugRenderer.ts` | Visualisation debug |
| `UIManager.ts` | Interface utilisateur |

---

**Dernière mise à jour** : 6 octobre 2025
**Version simulateur** : Kite V5 (fix/physics-critical-corrections)
