import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL(".", import.meta.url).pathname, "");
  const port = Number(env.VITE_DEV_PORT) || 5173;

  return {
    // base: "/elycapvest/",
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              "react",
              "react-dom",
              "react-router-dom",
              "react-hook-form",
              "zod",
              "axios",
              "react-hot-toast",
              "react-icons",
            ],
          },
        },
      },
    },
    server: {
      port,
      strictPort: true, // 👈 prevents auto-switching ports
    },
  };
});
