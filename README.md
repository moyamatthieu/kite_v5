# Simulation Cerf-Volant V8 - Autonome

Version autonome de la simulation de cerf-volant extraite de Kite-simulator-v3.

## Installation

```bash
cd kite_v5
npm install
```

## Utilisation

```bash
npm run dev
```

Ouvrir http://localhost:3001 dans votre navigateur.

## Contrôles

- **↑↓ Flèches**: Tourner la barre de contrôle
- **Souris**: Orbiter autour de la scène
- **R**: Réinitialiser la simulation

## Architecture

Cette version autonome contient:
- `src/simulation.ts`: Simulation physique principale
- `src/objects/organic/Kite.ts`: Modèle 3D du cerf-volant
- Classes core: `Node3D`, `StructuredObject`, `Primitive`
- Factories: `FrameFactory`, `SurfaceFactory`, `BaseFactory`
- Types TypeScript nécessaires dans `src/types`
- Interface utilisateur dans `src/ui`

## Dépendances

- Three.js pour le rendu 3D
- TypeScript pour le développement
- Vite pour le bundling et le serveur de développement

Utilisez `npm run dev` (Vite) pour le développement.
