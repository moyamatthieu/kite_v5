import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@base': resolve(__dirname, 'src/base'),
      '@factories': resolve(__dirname, 'src/ecs/factories'),
      '@types': resolve(__dirname, 'src/ecs/types'),
      '@utils': resolve(__dirname, 'src/ecs/utils'),
      '@config': resolve(__dirname, 'src/ecs/config'),
      '@systems': resolve(__dirname, 'src/ecs/systems'),
      '@entities': resolve(__dirname, 'src/ecs/entities'),
      '@components': resolve(__dirname, 'src/ecs/components'),
      '@ecs': resolve(__dirname, 'src/ecs'),
      '@ui': resolve(__dirname, 'src/ecs/ui')
    }
  }
});