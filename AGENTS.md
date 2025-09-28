# AGENTS.md - Coding Agent Guidelines

## Build/Lint/Test Commands
- `npm run dev` - Start development server (http://localhost:3001)
- `npm run build` - Production build
- `npm run preview` - Preview production build
- No dedicated lint/test commands - use `npm run build` for TypeScript checking

## Code Style Guidelines

### Language & Documentation
- **Language**: French for all comments, documentation, and explanatory text
- **JSDoc**: Extensive documentation with emojis (🎯, 🏗️, ⚡) explaining purpose and architecture
- **Comments**: Detailed explanations of what code does and why

### Naming Conventions
- **Classes**: PascalCase (SimulationApp, PhysicsEngine, Node3D)
- **Methods/Properties**: camelCase (renderManager, physicsEngine, updateLines)
- **Files**: PascalCase for components, camelCase for utilities
- **Anatomical Points**: Semantic French names ("NEZ", "BORD_GAUCHE", "CTRL_GAUCHE", "WHISKER_DROIT")

### TypeScript
- **Strict mode**: Enabled in tsconfig.json
- **Path aliases**: Use @/*, @core/*, @base/*, @objects/*, @factories/*, @types
- **Imports**: Group by type (THREE.js, then local imports, then types)
- **Interfaces**: Descriptive names with clear property documentation

### Architecture Patterns
- **Factory Pattern**: MANDATORY - Never create Three.js meshes directly
- **StructuredObject**: All 3D objects must extend StructuredObject and implement ICreatable
- **Node3D System**: Godot-compatible with _ready(), _process(), _physics_process() lifecycle
- **Named Points**: Use Map for anatomical points, single source of truth
- **Configuration**: All constants centralized in src/config/GlobalConfig.ts

### Error Handling
- TypeScript strict mode catches most issues at compile time
- Use try/catch for runtime errors in physics calculations
- Validate inputs in factory methods

### Performance
- Target 60 FPS with fixed timestep physics (16.67ms)
- Adaptive deltaTime handling for low FPS scenarios
- Optimize Three.js operations and physics calculations