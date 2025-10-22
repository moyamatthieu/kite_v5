# Référence Aérodynamique de la NASA pour la Simulation de Cerf-volant

**✅ Mise à jour**: 2025-10-22 - Implémentation corrigée selon archive NASA complète

Ce document synthétise les principes aérodynamiques et géométriques fournis par le Glenn Research Center de la NASA, tels qu'appliqués à la simulation de cerf-volant.

**Source**: Archive NASA complète (186 fichiers) - `nasa_kite_archive/`
**Référence**: NASA Glenn Research Center - Beginner's Guide to Kites

---

## 1. Aérodynamique de Base

Les forces principales agissant sur un cerf-volant sont la portance (Lift) et la traînée (Drag).

**Diagrammes disponibles localement**:
- [kitefor.gif](../nasa_kite_archive/Images/kitefor.gif) - Forces complètes
- [kiteaero.gif](../nasa_kite_archive/Images/kiteaero.gif) - Vue d'ensemble aérodynamique

### Équations Fondamentales (Source: NASA)

-   **Portance (L)** : ✅ Force PERPENDICULAIRE au vent (Source: `kitelift.html` lignes 106-107)
    $$ L = C_l \cdot A \cdot \rho \cdot \frac{V^2}{2} $$

-   **Traînée (D)** : Force PARALLÈLE au vent (Source: `kitedrag.html` lignes 106-107)
    $$ D = C_d \cdot A \cdot \rho \cdot \frac{V^2}{2} $$

Où :
-   `Cl` : Coefficient de portance. Dépend de l'angle d'attaque et de l'aspect ratio.
-   `Cd` : Coefficient de traînée. Inclut la traînée de forme et la traînée induite.
-   `A` : Surface projetée du cerf-volant (m²).
-   `ρ` (rho) : Densité de l'air = **1.229 kg/m³** au niveau de la mer (NASA).
-   `V` : Vitesse du vent apparent (m/s).

**⚠️ IMPORTANT**: NASA spécifie que la portance est **perpendiculaire au vent**, pas à la surface !

---

## 2. Coefficients de Portance et de Traînée

Ces coefficients ne sont pas constants. Ils varient principalement avec l'**angle d'attaque** (`alpha` ou `a`), qui est l'angle entre la surface du cerf-volant et la direction du vent.

![Downwash Effects](https://i.imgur.com/3a3j3fS.png)

### Phénomène de Décrochage (Stall)

Le graphique `Lift vs Angle of Attack` montre que :
1.  La portance augmente de manière quasi-linéaire avec l'angle d'attaque jusqu'à un certain point.
2.  Passé cet angle critique (l'angle de décrochage), la portance chute brutalement.

C'est un phénomène crucial pour la stabilité. Un modèle qui ne simule pas le décrochage peut générer des forces de portance infinies et irréalistes, menant à une simulation instable.

### Formules des Coefficients (incluant l'effet de l'allongement)

-   **Coefficient de Traînée (`Cd`)** :
    $$ C_d = C_{do} + \frac{C_l^2}{0.7 \cdot \pi \cdot AR} $$
    -   `Cdo` est la traînée parasite (traînée à portance nulle).
    -   Le second terme représente la traînée induite par la portance.

-   **Coefficient de Portance (`Cl`)** :
    $$ C_l = \frac{C_{lo}}{1 + \frac{C_{lo}}{\pi \cdot AR}} $$
    -   `Clo` est le coefficient de portance de la section (profil 2D).
    -   `AR` est l'**Aspect Ratio** (allongement) : `AR = s^2 / A`, où `s` est l'envergure.

---

## 3. Géométrie du Point de Bride (Bridle Point)

La position du point de bride est essentielle pour déterminer l'angle d'attaque et donc la stabilité du vol.

![Bridle Point Geometry](https://i.imgur.com/Y8b4h1W.png)

### Système de Coordonnées
-   L'origine `[0, 0]` est à la base du cerf-volant.
-   Le point de bride `B` a les coordonnées `[Xb, Yb]`.

### Calcul de la Position du Point de Bride
Les coordonnées du point de bride sont déterminées par la longueur du nœud (`K`) et l'angle du nœud (`A`).

-   Coordonnée Y : $$ Y_b = K \cdot \cos(A) $$
-   Coordonnée X : $$ X_b = K \cdot \sin(A) $$

L'angle `A` est calculé en utilisant la loi des cosinus sur le triangle formé par la bride :
$$ \cos(A) = \frac{K^2 + H^2 - (B-K)^2}{2 \cdot K \cdot H} $$

Où :
-   `K` : Longueur du nœud (Knot Length).
-   `H` : Hauteur du cerf-volant.
-   `B` : Longueur totale de la bride (Bridle Length).

---

## 4. Centre de Gravité et Centre de Pression

Pour une stabilité parfaite, la position relative du Centre de Gravité (CG) et du Centre de Pression (CP) est critique.

-   **Centre de Gravité (CG)** : Le point d'application moyen du poids du cerf-volant.
-   **Centre de Pression (CP)** : Le point d'application moyen des forces aérodynamiques.

![Kite Center of Gravity](https://i.imgur.com/Z8b4h1W.png)
![Kite Center of Pressure](https://i.imgur.com/X8b4h1W.png)

En général, pour un vol stable, le **Centre de Gravité doit se trouver légèrement en avant (vers le vent) du Centre de Pression**. Cela crée un couple de rappel qui stabilise naturellement le cerf-volant face aux perturbations.
