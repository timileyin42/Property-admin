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
    server: {
      port,
      strictPort: true, // 👈 prevents auto-switching ports
    },
  };
});
