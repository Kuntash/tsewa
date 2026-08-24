import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const wranglerConfigPath = process.env.TSEWA_WRANGLER_CONFIG;

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({
      ...(wranglerConfigPath ? { configPath: wranglerConfigPath } : {}),
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
