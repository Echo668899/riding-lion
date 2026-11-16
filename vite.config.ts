import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "client/dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
