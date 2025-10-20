import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // === Core ECS ===
      '@': resolve(__dirname, 'src'),
      '@ecs': resolve(__dirname, 'src/ecs'),
      '@base': resolve(__dirname, 'src/ecs/base'),

      // === Components & Entities ===
      '@components': resolve(__dirname, 'src/ecs/components'),
      '@entities': resolve(__dirname, 'src/ecs/entities'),

      // === Systems & Physics ===
      '@systems': resolve(__dirname, 'src/ecs/systems'),

      // === Configuration & Types ===
      '@config': resolve(__dirname, 'src/ecs/config'),
      '@mytypes': resolve(__dirname, 'src/ecs/types'),
      '@utils': resolve(__dirname, 'src/ecs/utils'),

      // === UI & Rendering ===
      '@ui': resolve(__dirname, 'src/ecs/ui'),
      '@rendering': resolve(__dirname, 'src/ecs/rendering'),

      // === Legacy (to be deprecated) ===
      '@core': resolve(__dirname, 'src/ecs/core'),
      '@objects': resolve(__dirname, 'src/ecs/objects'),
      '@factories': resolve(__dirname, 'src/ecs/factories'),
      '@types': resolve(__dirname, 'src/ecs/types'), // Alias for @mytypes for backward compat

      // === Deduplicate Three.js ===
      three: resolve(__dirname, 'node_modules/three'),
    }
  },
  server: {
    port: 3001,
    open: true
  },
  build: {
    outDir: 'dist'
  }
})