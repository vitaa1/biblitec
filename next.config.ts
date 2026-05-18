import type { NextConfig } from "next";
import "./lib/env";

const nextConfig: NextConfig = {
  images: {
    // capaUrl pode vir de qualquer domínio externo; otimização desabilitada
    // para evitar que o endpoint /_next/image sirva como proxy arbitrário.
    unoptimized: true,
  },
  experimental: {
    // Permite Server Actions a partir do domínio de encaminhamento do GitHub Codespaces.
    // O wildcard *.app.github.dev é seguro aqui: todos os subdomínios são controlados pelo GitHub.
    serverActions: {
      allowedOrigins: ["*.app.github.dev", "localhost:3000"],
    },
  },
};

export default nextConfig;
