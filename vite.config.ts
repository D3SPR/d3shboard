import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode single` bundles everything into one self-contained HTML file for static hosting.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "single" ? [viteSingleFile()] : [])],
  server: { port: 5173 },
  build: mode === "single" ? { outDir: "dist-single" } : {},
}));
