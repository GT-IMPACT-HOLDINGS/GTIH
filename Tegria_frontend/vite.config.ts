import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
    proxy: {
      "/lexiom13": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/inference": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/gt2/gtih": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/gt2/Lexiom_1_3/ca": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
