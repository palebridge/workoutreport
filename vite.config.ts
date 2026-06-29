import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Project Pages serve from https://<user>.github.io/<repo>/, so assets
// must be referenced under that sub-path. Override with BASE_PATH for a custom
// domain (use "/") or a differently named repo.
const base = process.env.BASE_PATH ?? "/workoutreport/";

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
