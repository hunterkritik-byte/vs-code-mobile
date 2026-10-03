import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/terminal": { target: "ws://127.0.0.1:8787", ws: true, changeOrigin: false },
      "/workspace-preview": { target: "http://127.0.0.1:8787", changeOrigin: false }
    }
  }
});
