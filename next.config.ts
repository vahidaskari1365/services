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
  // فایل دیتابیس دمو و موتور Prisma باید داخل باندل serverless قرار بگیرند
  // (حالت دمو بدون Environment Variables روی Vercel)
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/demo.db", "./node_modules/.prisma/**/*"],
  },
};

export default nextConfig;
