import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Generate sourcemaps only when explicitly enabled via env var.
  // Set `GENERATE_SOURCEMAP=true` for debug builds. Default is false.
  build: {
    sourcemap: process.env.GENERATE_SOURCEMAP === "true",
  },
});