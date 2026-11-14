import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:5176", changeOrigin: false },
      "/socket": { target: "http://127.0.0.1:5176", ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/data/manual.js")) return "manual";
          if (id.includes("/src/game/")) return "simulation";
          if (id.includes("/src/network/")) return "network";
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/scheduler")
          )
            return "react";
        },
      },
    },
  },
});
