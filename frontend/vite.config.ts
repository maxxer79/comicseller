import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + photo requests to the backend on :4000,
// so the frontend can call same-origin paths like /comics and /photos.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/comics": "http://localhost:4000",
      "/import": "http://localhost:4000",
      "/photos": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});
