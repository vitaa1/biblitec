import type { NextConfig } from "next";
import "./lib/env";

const nextConfig: NextConfig = {
  images: {
    // capaUrl pode vir de qualquer domínio externo; otimização desabilitada
    // para evitar que o endpoint /_next/image sirva como proxy arbitrário.
    unoptimized: true,
  },
};

export default nextConfig;
