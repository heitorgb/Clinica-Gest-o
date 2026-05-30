import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.FRONTEND_CONTAINER_PORT ?? 5180),
    allowedHosts: ["clinica.orderup.com.br"],
  },
});
