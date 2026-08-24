import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        "data-processing": resolve(import.meta.dirname, "data-processing/index.html"),
        main: resolve(import.meta.dirname, "index.html"),
        privacy: resolve(import.meta.dirname, "privacy/index.html"),
        security: resolve(import.meta.dirname, "security/index.html"),
        terms: resolve(import.meta.dirname, "terms/index.html"),
      },
    },
  },
  plugins: [react()],
});
