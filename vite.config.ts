import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath, URL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@base": resolve(__dirname, "src/base"),
      "@objects": resolve(__dirname, "src/objects"),
      "@factories": resolve(__dirname, "src/factories"),
      "@utils": resolve(__dirname, "src/utils"),
      "@types": resolve(__dirname, "src/types/index"),
    },
  },
  server: {
    port: 3001,
    open: true,
  },
  build: {
    outDir: "dist",
  },
});
