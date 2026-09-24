import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Tegria talks to GTIH only via gtih-sdk.js.
 * Flip DEPLOY_TARGET in src/deployTarget.ts (and server.js) for prod.
 * COOP/COEP remain so browser Hanuman (SharedArrayBuffer) can run on this origin.
 */
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: { ...isolationHeaders },
  },
  preview: {
    headers: { ...isolationHeaders },
  },
});
