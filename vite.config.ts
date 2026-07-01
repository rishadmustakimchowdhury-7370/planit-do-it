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
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('scheduler') || id.match(/[\\/]react[\\/]/)) return 'react-vendor';
          if (id.includes('react-router')) return 'router';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('date-fns')) return 'date';
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms';
          if (id.includes('country-state-city')) return 'country-data';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('embla-carousel')) return 'carousel';
          return 'vendor';
        },
      },
    },
  },
}));
