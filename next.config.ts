import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Prisma نباید داخل باندل سرورلیس قرار بگیرد (اشکال رایج روی Vercel)
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
