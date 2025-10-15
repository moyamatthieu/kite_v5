import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/ecs/core'),
      '@base': resolve(__dirname, 'src/ecs/base'),
      '@factories': resolve(__dirname, 'src/ecs/factories'),
      '@types': resolve(__dirname, 'src/ecs/types'),
      '@utils': resolve(__dirname, 'src/ecs/utils'),
      '@config': resolve(__dirname, 'src/ecs/config'),
      '@systems': resolve(__dirname, 'src/ecs/systems'),
      '@entities': resolve(__dirname, 'src/ecs/entities'),
      '@components': resolve(__dirname, 'src/ecs/components'),
      '@objects': resolve(__dirname, 'src/ecs/objects'),
      '@rendering': resolve(__dirname, 'src/ecs/rendering'),
      '@ecs': resolve(__dirname, 'src/ecs')
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