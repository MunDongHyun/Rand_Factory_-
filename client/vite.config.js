import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 개발 시 API 요청을 FastAPI 서버로 프록시
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
