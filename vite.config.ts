import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // IMPORTANT: keep manualChunks limited to LEAF libraries only.
        // Splitting React/react-dom or shared runtime deps into their own
        // chunk while other vendor libs land in a generic "vendor" chunk
        // creates a circular import (vendor <-> react-vendor) that leaves
        // React's exports undefined on hard reload ("Cannot read properties
        // of undefined (reading 'forwardRef')"). Let Rollup handle the
        // shared graph automatically; only isolate large, route-specific
        // libraries so they lazy-load with their routes.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('country-state-city')) return 'country-data';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
        },
      },
    },
  },
}));
